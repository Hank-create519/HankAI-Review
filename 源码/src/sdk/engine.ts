// Hank个人工作室 AI审查系统 · 审查引擎 v1.1（支持工具调用）

import type { AIConfig, ReviewTask, ReviewOutput, FinalReport, ReviewProgress, PromptInput } from '../types';
import { DEFAULT_CONFIGS } from '../types';
import { getToolByName, toOpenAITools } from '../skills/toolRegistry';
import {
  fullSafetyCheck,
  executeTool,
  recordToolCall,
  clearSession,
  sanitizeResult,
  validateFilePath,
  PYTHON_TIMEOUT_MS,
  setWorkDir,
  type SafetyCheckResult,
} from '../skills/safetyGuard';

// ============ 工作目录初始化 ============

// 从 AIConfig 注入工作目录（审查开始前调用）
function initWorkDir() {
  // 使用 Electron userData 或默认路径
  if (typeof window !== 'undefined' && (window as any).electronAPI?.getWorkDir) {
    (window as any).electronAPI.getWorkDir().then((dir: string) => setWorkDir(dir));
  }
}

// ============ 外部 AI 调用（原始，无工具） ============

async function callAI(cfg: AIConfig, messages: { role: string; content: string }[], signal?: AbortSignal): Promise<string> {
  if (!cfg.apiKey || cfg.apiKey === 'demo') {
    throw new Error(`角色「${cfg.roleName}」未配置有效的 API Key，请在配置页面填写真实 API Key 后重试。`);
  }

  const controller = new AbortController();
  const link = signal;
  if (link) {
    link.addEventListener('abort', () => controller.abort());
  }

  const res = await fetch(cfg.baseUrl || 'https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.modelName || 'gpt-4o',
      messages,
      temperature: cfg.temperature ?? 0.3,
      max_tokens: cfg.maxTokens || 4096,
    }),
    signal: controller.signal,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI 调用失败 [${res.status}]: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

// ============ AI 调用（支持 Function Calling 工具循环） ============

interface ToolMessage {
  role: string;
  content: string | null;
  tool_calls?: any[];
  tool_call_id?: string;
  name?: string;
}

/**
 * callAIWithTools：支持 OpenAI function calling 的 tool loop。
 * 当 LLM 返回 tool_calls 时，通过 safetyGuard 校验后执行工具，
 * 结果注入 messages 继续循环，直到模型返回最终文本或达到最大迭代次数。
 */
async function callAIWithTools(
  cfg: AIConfig,
  messages: ToolMessage[],
  tools: Record<string, any>[],
  sessionId: string,
  round: number,
  signal?: AbortSignal,
): Promise<string> {
  if (!cfg.apiKey || cfg.apiKey === 'demo') {
    throw new Error(`角色「${cfg.roleName}」未配置有效的 API Key，请在配置页面填写真实 API Key 后重试。`);
  }

  const controller = new AbortController();
  if (signal) {
    signal.addEventListener('abort', () => controller.abort());
  }

  const MAX_ITERATIONS = 5;

  // 深拷贝 messages 以避免污染原始数组
  const localMessages: ToolMessage[] = messages.map(m => ({ ...m }));

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');

    const res = await fetch(cfg.baseUrl || 'https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.modelName || 'gpt-4o',
        messages: localMessages,
        tools,
        temperature: cfg.temperature ?? 0.3,
        max_tokens: cfg.maxTokens || 4096,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`AI 调用失败 [${res.status}]: ${text.slice(0, 200)}`);
    }

    const data = await res.json();
    const choice = data.choices?.[0];
    if (!choice) return '';

    // 检查是否有 tool_calls
    if (choice.finish_reason === 'tool_calls' && choice.message?.tool_calls?.length > 0) {
      const toolCalls = choice.message.tool_calls;

      // 将 assistant 消息（含 tool_calls）加入 messages
      localMessages.push({
        role: 'assistant',
        content: '', // OpenAI 协议：有 tool_calls 时 content 应为空字符串
        tool_calls: toolCalls,
      });

      // 依次执行每个工具调用
      const toolResults: ToolMessage[] = [];
      for (const tc of toolCalls) {
        const toolName = tc.function?.name || '';
        let args: Record<string, string> = {};
        try {
          args = JSON.parse(tc.function?.arguments || '{}');
        } catch {
          args = {};
        }

        // 五层安全校验
        const safetyResult: SafetyCheckResult = fullSafetyCheck(
          cfg.roleKey,
          toolName,
          args,
          sessionId,
          round,
        );

        let toolContent: string;
        if (!safetyResult.passed) {
          toolContent = `[安全拦截] ${safetyResult.error}`;
        } else {
          recordToolCall(sessionId, cfg.roleKey, round);
          toolContent = await executeTool(toolName, args, {
            readFile: executeReadFile,
            pythonExec: executePythonSandbox,
          });
        }

        toolResults.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: toolContent,
        });
      }

      // 将工具结果加入 messages
      localMessages.push(...toolResults);

      // 继续循环
      continue;
    }

    // 正常文本回复
    return choice.message?.content || '';
  }

  // 达到最大迭代次数：收集所有 assistant 文本回复并拼接
  const texts = localMessages
    .filter(m => m.role === 'assistant' && typeof m.content === 'string' && m.content)
    .map(m => m.content as string);
  return texts.join('\n\n') || '[工具循环达到最大迭代次数，未获得最终文本回复]';
}

// ============ read_file 安全执行器 ============

async function executeReadFile(filePath: string): Promise<string> {
  // 二次校验（safetyGuard 已做，此处兜底）
  const err = validateFilePath(filePath);
  if (err) return `[安全拦截] ${err}`;

  try {
    // 在 Electron 环境中通过 IPC 读取文件
    if (typeof window !== 'undefined' && (window as any).electronAPI?.readFile) {
      const content = await (window as any).electronAPI.readFile(filePath);
      return sanitizeResult(content);
    }
    // 浏览器环境兜底：尝试 fetch（仅限 public 可访问文件）
    const res = await fetch(`file://${filePath}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return `文件读取失败: HTTP ${res.status}`;
    return sanitizeResult(await res.text());
  } catch (err: any) {
    return `文件读取失败: ${err.message}`;
  }
}

// ============ Python 沙箱执行器 ============

async function executePythonSandbox(code: string): Promise<string> {
  try {
    // Electron 环境：通过 IPC 调用主进程执行 Python
    if (typeof window !== 'undefined' && (window as any).electronAPI?.execPython) {
      const result = await (window as any).electronAPI.execPython(code, PYTHON_TIMEOUT_MS);
      return sanitizeResult(result);
    }

    // 浏览器环境（Vite dev 模式）：Python 不可用，返回说明
    return '[Python 执行不可用] 当前运行在浏览器环境，Python 子进程需要 Electron 主进程支持。' +
      '\n请在 Electron 应用中运行以启用此功能，或通过 electronAPI.execPython 桥接。';
  } catch (err: any) {
    return `Python 执行错误: ${err.message}`;
  }
}

// ============ 轮数判定（内嵌算法，不调用 AI） ============

/** 复杂度信号词及权重 */
const COMPLEXITY_SIGNALS: [RegExp, number][] = [
  // 高复杂度信号（每个 +3）
  [/合规|监管|法律风险|诉讼|判刑|刑事/, 3],
  [/战略决策|投资|收购|上市|融资/, 3],
  [/多方利益|利益冲突|博弈|竞争格局/, 3],
  [/安全漏洞|数据泄露|隐私合规|GDPR|个人信息保护/, 3],
  // 中复杂度信号（每个 +2）
  [/成本.*分析|ROI|预算.*评估|财务.*风险/, 2],
  [/技术选型|架构.*设计|系统.*重构|性能.*瓶颈/, 2],
  [/竞品|市场.*分析|用户.*研究|产品.*定位/, 2],
  [/多维度|多个.*方面|以下.*几点|几.*维度/, 2],
  [/复杂|深度|深入|全面.*评估|综合.*考量/, 2],
  // 低复杂度信号（每个 +1）
  [/风险|隐患|问题|缺陷|不足|改进/, 1],
  [/建议|推荐|方案|策略|对策/, 1],
];

/** 维度词：出现越多说明问题越复杂 */
const DIMENSION_MARKERS = [
  /维度[：:]\s*[一二三四五六七八九十\d]/g,
  /第[一二三四五六七八九十\d]\s*[，,]/g,
  /^\d+[.、]/gm,
];

/**
 * 基于提取器输出内容的本地复杂度估算。
 * 不需要调用 AI，零成本、毫秒级。
 */
function estimateRoundCount(
  extractorOutputs: { roleName: string; outputContent: string }[],
  userInput: string,
): number {
  const combined = extractorOutputs.map(o => o.outputContent).join('\n');
  const totalText = combined + '\n' + userInput;

  // 1. 信号词评分
  let signalScore = 0;
  for (const [pattern, weight] of COMPLEXITY_SIGNALS) {
    const matches = totalText.match(new RegExp(pattern.source, 'gi'));
    if (matches) signalScore += weight * Math.min(matches.length, 3); // 每种最多 ×3
  }

  // 2. 维度数量检测
  let dimensionCount = 0;
  for (const marker of DIMENSION_MARKERS) {
    const m = totalText.match(new RegExp(marker.source, 'gi'));
    if (m) dimensionCount += m.length;
  }

  // 3. 内容长度因子
  const lengthScore = Math.min(Math.floor(combined.length / 800), 5); // 每 800 字 +1，上限 5

  // 4. 综合评分 → 轮数
  const total = signalScore + dimensionCount * 1.5 + lengthScore;

  if (total >= 28) return 10;
  if (total >= 24) return 9;
  if (total >= 20) return 8;
  if (total >= 17) return 7;
  if (total >= 14) return 6;
  if (total >= 12) return 5;
  if (total >= 9)  return 4;
  if (total >= 5)  return 3;
  if (total >= 2)  return 2;
  return 1;
}

// ============ 引擎状态管理 ============

export interface EngineState {
  configs: AIConfig[];
  task: ReviewTask | null;
  outputs: ReviewOutput[];
  finalReport: FinalReport | null;
  progress: ReviewProgress;
  isRunning: boolean;
  isPaused: boolean;
  abortController: AbortController | null;
  pausedResolve: (() => void) | null;
}

let _state: EngineState = {
  configs: DEFAULT_CONFIGS,
  task: null,
  outputs: [],
  finalReport: null,
  progress: { phase: 'idle', completedSteps: 0, totalSteps: 0 },
  isRunning: false,
  isPaused: false,
  abortController: null,
  pausedResolve: null,
};

let _listeners: Set<() => void> = new Set();

// === 持久化回调（由 App 层注入，支持 DB/文件等后端） ===
type PersistHandler = (action: 'task' | 'outputs' | 'report', data: any) => void;
let _persist: PersistHandler | null = null;
export function setPersistHandler(fn: PersistHandler | null) { _persist = fn; }

function notify() {
  _listeners.forEach(fn => fn());
}

export function subscribe(fn: () => void) {
  _listeners.add(fn);
  return () => { _listeners.delete(fn); };
}

export function getState(): Readonly<EngineState> {
  return _state;
}

export function setConfigs(configs: AIConfig[]) {
  _state.configs = configs;
  notify();
}

export async function startReview(title: string, userInput: string, _promptInputs?: PromptInput[]) {
  if (_state.isRunning) return;

  // 初始化工作目录
  initWorkDir();

  const enabledConfigs = _state.configs.filter(c => c.isEnabled);
  if (enabledConfigs.length === 0) {
    throw new Error('没有启用任何 AI 配置');
  }

  const abortController = new AbortController();
  _state.abortController = abortController;
  _state.isRunning = true;
  _state.isPaused = false;
  _state.outputs = [];
  _state.finalReport = null;

  const taskId = Date.now().toString();
  const sessionId = taskId; // 使用 taskId 作为 sessionId

  _state.task = {
    id: taskId,
    title,
    status: 'preparing',
    totalRounds: 0,
    createdAt: new Date().toISOString(),
  };
  notify();
  _persist?.('task', { ..._state.task, userInput });

  // Get prep configs (round_judge 不再调用 API，仅保留配置项）
  const prepConfigs = enabledConfigs.filter(c => c.phase === 'prep' && c.roleKey !== 'round_judge');
  const debateConfigs = enabledConfigs.filter(c => c.phase === 'debate');
  const summarizerConfigs = enabledConfigs.filter(c => c.phase === 'debate_summarizer');
  const finalConfigs = enabledConfigs.filter(c => c.phase === 'summary');

  let totalRounds = 3;
  let allSteps = prepConfigs.length + (debateConfigs.length + summarizerConfigs.length + 1) * 3 + finalConfigs.length;
  let completedSteps = 0;

  function updateProgress(phase: ReviewProgress['phase'], currentRound?: number) {
    completedSteps++;
    _state.progress = {
      phase,
      completedSteps,
      totalSteps: allSteps,
      currentRound: currentRound ?? _state.progress.currentRound,
      totalRounds,
    };
    notify();
  }

  let outputIdCounter = 0;

  /**
   * runPhase：执行阶段任务。
   * 支持 skills 参数：当 cfg.skills 非空且包含支持的工具时，使用 callAIWithTools；
   * 否则降级使用原始 callAI。
   */
  async function runPhase(
    configs: AIConfig[],
    round: number,
    systemMsg: string,
    userMsg: string,
    phase: string,
    skills?: string[],
  ): Promise<void> {
    for (const cfg of configs) {
      if (abortController.signal.aborted) return;

      // Check pause
      while (_state.isPaused) {
        await new Promise<void>(resolve => { _state.pausedResolve = resolve; });
        if (abortController.signal.aborted) return;
      }

      const startTime = Date.now();
      const outputId = ++outputIdCounter;

      _state.outputs.push({
        id: outputId,
        roundNumber: round,
        roleName: cfg.roleName,
        roleKey: cfg.roleKey,
        status: 'running',
        outputContent: '',
        responseTimeMs: 0,
      });
      notify();

      try {
        // 决定使用哪种调用方式
        const effectiveSkills = skills ?? cfg.skills;
        const hasTools = effectiveSkills && effectiveSkills.length > 0;

        let result: string;
        if (hasTools) {
          const tools = toOpenAITools(
            effectiveSkills.map(s => getToolByName(s)).filter(Boolean) as any[],
          );
          if (tools.length > 0) {
            result = await callAIWithTools(
              cfg,
              [
                { role: 'system', content: systemMsg },
                { role: 'user', content: userMsg },
              ],
              tools,
              sessionId,
              round,
              abortController.signal,
            );
          } else {
            // skills 配置了但未匹配到任何工具，降级为原始调用
            result = await callAI(cfg, [
              { role: 'system', content: systemMsg },
              { role: 'user', content: userMsg },
            ], abortController.signal);
          }
        } else {
          result = await callAI(cfg, [
            { role: 'system', content: systemMsg },
            { role: 'user', content: userMsg },
          ], abortController.signal);
        }

        const elapsed = Date.now() - startTime;

        _state.outputs = _state.outputs.map(o =>
          o.id === outputId ? { ...o, status: 'completed' as const, outputContent: result, responseTimeMs: elapsed } : o
        );
      } catch (err: any) {
        const elapsed = Date.now() - startTime;
        _state.outputs = _state.outputs.map(o =>
          o.id === outputId ? { ...o, status: 'error' as const, outputContent: `错误: ${err.message}`, responseTimeMs: elapsed } : o
        );
      }

      updateProgress(phase as any, round);
    }
  }

  try {
    // Phase 1: Preparation
    _state.task = { ..._state.task!, status: 'preparing' };
    notify();

    for (const cfg of prepConfigs) {
      await runPhase([cfg], 0, cfg.systemPrompt, userInput, 'preparation');
    }

    // ---- 本地算法判定辩论轮数（内嵌，不调用 AI） ----
    const extractorOutputs = _state.outputs.filter(o => o.roundNumber === 0 && o.status === 'completed' && (o.roleKey === 'extractor' || o.roleKey === 'extractor2'));
    totalRounds = estimateRoundCount(extractorOutputs, userInput);
    totalRounds = Math.max(1, Math.min(10, totalRounds));

    // 用实际轮数重新计算总步数并更新任务
    allSteps = completedSteps + (debateConfigs.length + summarizerConfigs.length + 1) * totalRounds + finalConfigs.length;
    _state.progress = { ..._state.progress, totalSteps: allSteps, totalRounds };
    _state.task = { ..._state.task!, totalRounds };
    notify();
    _persist?.('task', _state.task);

    // Track debate outputs for context
    const debateHistory: { roleName: string; content: string }[] = [];

    // Phase 2: Debate rounds
    _state.task = { ..._state.task!, status: 'debating' };
    _state.progress = { ..._state.progress, currentRound: 1 };
    notify();

    for (let round = 1; round <= totalRounds; round++) {
      _state.progress = { ..._state.progress, currentRound: round };
      notify();

      // Debate round
      const debateMsg = round === 1
        ? userInput
        : `【第 ${round} 轮辩论】\n请基于前几轮的辩论结果，进一步深化分析。\n\n前序讨论摘要：\n${debateHistory.slice(-3).map(d => `[${d.roleName}]: ${d.content.slice(0, 300)}`).join('\n\n')}`;

      for (const cfg of debateConfigs) {
        const result = await callAI(cfg, [
          { role: 'system', content: cfg.systemPrompt },
          { role: 'user', content: debateMsg },
        ], abortController.signal);

        debateHistory.push({ roleName: cfg.roleName, content: result });

        _state.outputs.push({
          id: ++outputIdCounter,
          roundNumber: round,
          roleName: cfg.roleName,
          roleKey: cfg.roleKey,
          status: 'completed',
          outputContent: result,
          responseTimeMs: 0,
        });
        updateProgress('debate', round);
      }

      // Summarizer
      for (const cfg of summarizerConfigs) {
        const roundDebates = debateHistory.slice(-debateConfigs.length);
        const summaryInput = `请对第 ${round} 轮辩论进行汇总：\n\n${roundDebates.map(d => `[${d.roleName}]:\n${d.content}`).join('\n\n')}`;

        await runPhase([cfg], round, cfg.systemPrompt, summaryInput, 'debate');
      }

      // Judge
      updateProgress('debate', round);
    }

    // Phase 3: Summary
    _state.task = { ..._state.task!, status: 'summarizing' };
    notify();

    const allContent = _state.outputs.map(o => `[${o.roleName} (轮${o.roundNumber})]:\n${o.outputContent}`).join('\n\n');
    const summaryMsg = `请基于以下全部审查内容生成最终报告：\n\n${allContent}`;
    for (const cfg of finalConfigs) {
      let summaryOk = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) {
          if (abortController.signal.aborted) break;
          await new Promise<void>(r => setTimeout(r, 3000));
        }
        try {
          await runPhase([cfg], 999, cfg.systemPrompt, summaryMsg, 'summary');
        } catch {
          // runPhase 内部已记录错误，继续重试
        }
        const lastOut = _state.outputs[_state.outputs.length - 1];
        if (lastOut && lastOut.status === 'completed') {
          summaryOk = true;
          break;
        }
      }
      if (!summaryOk && !abortController.signal.aborted) {
        throw new Error('最终报告生成失败（重试 3 次后仍失败）');
      }
    }

    const finalContent = _state.outputs
      .filter(o => o.roundNumber === 999 && o.status === 'completed')
      .map(o => o.outputContent)
      .join('\n\n');

    if (!finalContent) {
      throw new Error('最终报告生成为空');
    }

    _state.task = {
      ..._state.task!,
      status: 'completed',
      completedAt: new Date().toISOString(),
    };

    if (finalContent) {
      _state.finalReport = {
        taskId,
        reportContent: finalContent,
        generatedAt: new Date().toISOString(),
      };
      _persist?.('report', _state.finalReport);
    }

    _state.progress = { ..._state.progress, phase: 'completed' };
    _persist?.('task', _state.task);
    _persist?.('outputs', _state.outputs.map(o => ({ ...o, taskId })));
  } catch (err: any) {
    if (err.name === 'AbortError') {
      _state.task = { ..._state.task!, status: 'error', errorMessage: '用户停止' };
    } else {
      _state.task = { ..._state.task!, status: 'error', errorMessage: err.message };
    }
    _state.progress = { ..._state.progress, phase: 'error' };
    _persist?.('task', _state.task);
  } finally {
    _state.isRunning = false;
    _state.isPaused = false;
    _state.abortController = null;
    clearSession(sessionId);
    notify();
  }
}

export function pause() {
  _state.isPaused = true;
  notify();
}

export function resume() {
  _state.isPaused = false;
  _state.pausedResolve?.();
  _state.pausedResolve = null;
  notify();
}

export function stop() {
  _state.abortController?.abort();
  _state.isPaused = false;
  _state.pausedResolve?.();
  _state.pausedResolve = null;
  notify();
}

export function supplement(text: string) {
  // Currently not implemented for mock mode
  // In production, this would inject additional context into the running debate
  console.log('[HankReview] Supplement received:', text.slice(0, 100));
}

// ============ ReviewEngine 类包装（供 React Provider 使用） ============

type Listener = () => void;

export class ReviewEngine {
  private listeners = new Map<string, Set<Listener>>();
  private unsub: (() => void) | null = null;

  constructor(_options?: unknown) {
    this.unsub = subscribe(() => {
      const s = getState();
      if (s.isRunning && !this._wasRunning) {
        this._wasRunning = true;
        this.emit('task_created');
      }
      if (!s.isRunning && this._wasRunning && s.task?.status === 'completed') {
        this._wasRunning = false;
        this.emit('task_complete');
      } else if (!s.isRunning && this._wasRunning && s.task?.status === 'error') {
        this._wasRunning = false;
        this.emit('task_error');
      }
      this.emit('progress');
      this.emit('ai_complete');
    });
  }

  private _wasRunning = false;

  emit(event: string) {
    this.listeners.get(event)?.forEach(fn => fn());
  }

  on(event: string, fn: Listener) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(fn);
    return () => this.listeners.get(event)?.delete(fn);
  }

  getState() { return getState(); }
  getConfigs() { return getState().configs; }
  updateConfigs(configs: AIConfig[]) { setConfigs(configs); }

  async runReview(title: string, input: string) {
    try {
      await startReview(title, input);
      const s = getState();
      if (s.task?.status === 'completed') {
        this.emit('task_complete');
      } else if (s.task?.status === 'error') {
        this.emit('task_error');
      }
    } catch {
      this.emit('task_error');
    }
  }

  pause() { pause(); this.emit('paused'); }
  resume() { resume(); this.emit('resumed'); }
  stop() { stop(); this.emit('stopped'); }
  supplement(text: string) { supplement(text); }

  destroy() { this.unsub?.(); }
}
