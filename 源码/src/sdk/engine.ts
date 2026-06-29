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

  // 在首条 system 消息前注入当前日期
  const today = new Date().toISOString().slice(0, 10);
  const injectedMessages = messages.map((m, i) => {
    if (i === 0 && m.role === 'system' && typeof m.content === 'string') {
      return { ...m, content: `[系统] 当前日期：${today}。你的知识截止于此日期，如需更新信息请使用工具搜索。\n\n${m.content}` };
    }
    return m;
  });

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
      messages: injectedMessages,
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

  const MAX_ITERATIONS = 15;
  const WARN_AT = 10; // 提前警告的迭代阈值

  // 深拷贝 messages 以避免污染原始数组
  const localMessages: ToolMessage[] = messages.map(m => ({ ...m }));

  // 在首条 system 消息后追加当前日期和迭代限制提示
  const today = new Date().toISOString().slice(0, 10);
  for (const m of localMessages) {
    if (m.role === 'system' && typeof m.content === 'string') {
      m.content = `[系统] 当前日期：${today}。你的知识截止于此日期，如需更新信息请使用工具搜索。\n\n${m.content}`;
      m.content += `\n\n[系统提示] 你最多可调用 ${MAX_ITERATIONS} 轮工具。请在获得足够信息后尽早给出最终文本回复，避免耗尽所有轮次导致任务失败。`;
      break;
    }
  }

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');

    // 最后一轮：强制终止 — 如果前一轮返回了 tool_calls，不再执行，直接要求模型输出文本
    if (iter === MAX_ITERATIONS - 1) {
      // 检查上一条 assistant 消息是否仍有未处理的 tool_calls
      const lastMsg = localMessages[localMessages.length - 1];
      if (lastMsg?.role === 'assistant' && (lastMsg as any).tool_calls?.length > 0) {
        // 不执行工具，直接追加强制终止消息，调用 API 不带 tools
        localMessages.push({
          role: 'user',
          content:
            '工具调用轮次已达上限。请立即基于上述所有对话历史中的搜索结果和已有信息，直接输出最终文字结论。不要再请求调用任何工具。',
        });

        const finalRes = await fetch(cfg.baseUrl || 'https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${cfg.apiKey}`,
          },
          body: JSON.stringify({
            model: cfg.modelName || 'gpt-4o',
            messages: localMessages,
            // 不带 tools，强制模型只能输出文本
            temperature: cfg.temperature ?? 0.3,
            max_tokens: cfg.maxTokens || 4096,
          }),
          signal: controller.signal,
        });

        if (!finalRes.ok) {
          const t = await finalRes.text();
          throw new Error(`AI 强制终止调用失败 [${finalRes.status}]: ${t.slice(0, 200)}`);
        }

        const finalData = await finalRes.json();
        const finalChoice = finalData.choices?.[0];
        return finalChoice?.message?.content || '[工具循环耗尽 — 模型未返回文本]';
      }
    }

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

        // 接近上限时在结果末尾追加警告
        if (iter >= WARN_AT) {
          const remaining = MAX_ITERATIONS - iter - 1;
          toolContent += `\n\n[系统提示] 工具调用轮次即将耗尽，剩余 ${remaining} 轮。请准备基于现有信息给出最终文字结论，不要再发起不必要的搜索。`;
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

  // 兜底：所有迭代耗尽且无文本回复
  return '[工具循环耗尽 — 所有轮次已用完，未获得文本回复]';
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
    // 非 Electron 环境：文件读取不可用
    return '[文件读取不可用] 当前运行在浏览器环境，文件读取需要 Electron 主进程支持。' +
      '\n请在 Electron 应用中运行以启用此功能，或通过 electronAPI.readFile 桥接。';
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
    phase: ReviewProgress['phase'],
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

      updateProgress(phase, round);
    }
  }

  try {
    // Phase 1: Preparation
    _state.task = { ..._state.task!, status: 'preparing' };
    notify();

    for (const cfg of prepConfigs) {
      await runPhase([cfg], 0, cfg.systemPrompt, userInput, 'preparation');
    }

    // ---- AI 裁判判定辩论轮数 ----
    const judgeCfg = enabledConfigs.find(c => c.roleKey === 'round_judge');
    if (judgeCfg && judgeCfg.isEnabled) {
      try {
        const extractorOutputs = _state.outputs
          .filter(o => o.roundNumber === 0 && o.status === 'completed' && (o.roleKey === 'extractor' || o.roleKey === 'extractor2'))
          .map(o => `[${o.roleName}]:\n${o.outputContent}`)
          .join('\n\n');
        const judgeInput = `请基于以下提取器对用户输入的分析结果，判定需要几轮辩论：\n\n用户输入：\n${userInput}\n\n提取器分析：\n${extractorOutputs}`;
        const judgeResponse = await callAI(judgeCfg, [
          { role: 'system', content: judgeCfg.systemPrompt },
          { role: 'user', content: judgeInput },
        ], abortController.signal);
        const match = judgeResponse.match(/(\d+)\s*轮/);
        totalRounds = match ? parseInt(match[1], 10) : 3;
      } catch {
        totalRounds = 3; // AI 调用失败，默认 3 轮
      }
    } else {
      totalRounds = 3; // 无裁判配置，默认 3 轮
    }
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
        if (abortController.signal.aborted) break;

        while (_state.isPaused) {
          await new Promise<void>(resolve => { _state.pausedResolve = resolve; });
          if (abortController.signal.aborted) break;
        }
        if (abortController.signal.aborted) break;

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
          // 从 cfg.skills 构建 tools（参考 runPhase 逻辑）
          const debateSkills = cfg.skills;
          const debateTools = debateSkills && debateSkills.length > 0
            ? toOpenAITools(
                debateSkills.map(s => getToolByName(s)).filter(Boolean) as any[],
              )
            : [];

          let result: string;
          if (debateTools.length > 0) {
            result = await callAIWithTools(
              cfg,
              [
                { role: 'system', content: cfg.systemPrompt },
                { role: 'user', content: debateMsg },
              ],
              debateTools,
              sessionId,
              round,
              abortController.signal,
            );
          } else {
            result = await callAI(cfg, [
              { role: 'system', content: cfg.systemPrompt },
              { role: 'user', content: debateMsg },
            ], abortController.signal);
          }

          const elapsed = Date.now() - startTime;
          debateHistory.push({ roleName: cfg.roleName, content: result });

          _state.outputs = _state.outputs.map(o =>
            o.id === outputId ? { ...o, status: 'completed' as const, outputContent: result, responseTimeMs: elapsed } : o
          );
        } catch (err: any) {
          const elapsed = Date.now() - startTime;
          debateHistory.push({ roleName: cfg.roleName, content: `错误: ${err.message}` });
          _state.outputs = _state.outputs.map(o =>
            o.id === outputId ? { ...o, status: 'error' as const, outputContent: `错误: ${err.message}`, responseTimeMs: elapsed } : o
          );
        }

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
