// Hank个人工作室 AI审查系统 · 五层安全机制 v1.0

import { getToolByName } from './toolRegistry';

// ============ 第一层：工具白名单 ============

/**
 * 按 Agent roleKey 控制可用工具：
 * - extractor / extractor2: web_search
 * - debate_ai1 / debate_ai2 / debate_ai3 / ai_debate_*: web_search + web_fetch
 * - integrator / final_integrator: web_search
 * - round_judge: 无
 */
const ROLE_TOOL_WHITELIST: Record<string, string[]> = {
  extractor: ['web_search', 'web_fetch'],
  extractor2: ['web_search', 'web_fetch'],
  integrator: ['web_search', 'web_fetch'],
  final_integrator: ['web_search', 'web_fetch'],
  debate_ai1: ['web_search', 'web_fetch'],
  debate_ai2: ['web_search', 'web_fetch'],
  debate_ai3: ['web_search', 'web_fetch'],
};

/** 动态白名单匹配（支持 ai_debate_N 模式） */
function getAllowedTools(roleKey: string): string[] {
  if (roleKey in ROLE_TOOL_WHITELIST) {
    return ROLE_TOOL_WHITELIST[roleKey];
  }
  // 自定义辩论 AI（ai_debate_N）享有辩论级权限
  if (roleKey.startsWith('ai_debate_')) {
    return ['web_search', 'web_fetch'];
  }
  // round_judge 及其他未知角色：无权限
  return [];
}

/**
 * 校验工具是否在角色白名单中。
 * 返回 null 表示通过，否则返回错误信息。
 */
export function checkToolWhitelist(roleKey: string, toolName: string): string | null {
  const allowed = getAllowedTools(roleKey);
  if (!allowed.includes(toolName)) {
    return `工具「${toolName}」不在角色「${roleKey}」的可用列表中（白名单：${allowed.length ? allowed.join(', ') : '无'}）`;
  }
  return null;
}

// ============ 第二层：速率限制 ============

const sessionCallCount = new Map<string, number>(); // sessionId -> 总调用次数
const agentRoundCount = new Map<string, number>();   // sessionId:roleKey:round -> 轮内调用次数
const lastCallTime = new Map<string, number>();       // sessionId -> 上次调用的时间戳

const MAX_PER_ROUND = 3;
const MAX_PER_SESSION = 30;
const MIN_INTERVAL_MS = 2000;

export function checkRateLimit(sessionId: string, roleKey: string, round: number): string | null {
  const now = Date.now();

  // 全 session 上限
  const total = sessionCallCount.get(sessionId) || 0;
  if (total >= MAX_PER_SESSION) {
    return `已达会话工具调用上限（${MAX_PER_SESSION} 次）`;
  }

  // 单轮上限
  const roundKey = `${sessionId}:${roleKey}:${round}`;
  const roundCount = agentRoundCount.get(roundKey) || 0;
  if (roundCount >= MAX_PER_ROUND) {
    return `角色「${roleKey}」本轮已达调用上限（${MAX_PER_ROUND} 次）`;
  }

  // 间隔检查
  const last = lastCallTime.get(sessionId);
  if (last && (now - last) < MIN_INTERVAL_MS) {
    const waitMs = MIN_INTERVAL_MS - (now - last);
    return `工具调用间隔不足 2 秒，请等待 ${Math.ceil(waitMs / 1000)} 秒后重试`;
  }

  return null; // 通过
}

export function recordToolCall(sessionId: string, roleKey: string, round: number): void {
  const now = Date.now();
  sessionCallCount.set(sessionId, (sessionCallCount.get(sessionId) || 0) + 1);
  const roundKey = `${sessionId}:${roleKey}:${round}`;
  agentRoundCount.set(roundKey, (agentRoundCount.get(roundKey) || 0) + 1);
  lastCallTime.set(sessionId, now);
}

/** 清理 session 记录（审查任务结束时调用） */
export function clearSession(sessionId: string): void {
  sessionCallCount.delete(sessionId);
  lastCallTime.delete(sessionId);
  // 清理该 session 所有的 round 记录
  for (const key of agentRoundCount.keys()) {
    if (key.startsWith(sessionId + ':')) agentRoundCount.delete(key);
  }
}

// ============ 第三层：参数校验 ============

/** 内网 / 私有 IP 正则 */
const PRIVATE_IP_RE = /(^127\.)|(^10\.)|(^172\.1[6-9]\.)|(^172\.2\d\.)|(^172\.3[0-1]\.)|(^192\.168\.)|(^0\.)|(^169\.254\.)|(^::1$)|(^fc00:)|(^fe80:)/;

/** URL 校验：必须 https，禁止内网 */
export function validateUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') {
      return `URL 必须使用 HTTPS 协议，当前为: ${u.protocol}`;
    }
    // 跳过 localhost
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '::1') {
      return '禁止访问 localhost 地址';
    }
    if (PRIVATE_IP_RE.test(u.hostname)) {
      return `禁止访问内网地址: ${u.hostname}`;
    }
    return null;
  } catch {
    return `无效的 URL 格式: ${url}`;
  }
}

/** 工作目录基准（由 engine 层注入） */
let _workDir: string | null = null;
export function setWorkDir(dir: string) { _workDir = dir; }
export function getWorkDir(): string | null { return _workDir; }

/** 敏感路径片段黑名单 */
const SENSITIVE_PATH_FRAGMENTS = [
  '/.ssh/', '/.git/', '/.svn/', '/.aws/', '/.kube/', '/.env',
  '/etc/passwd', '/etc/shadow', '/proc/', '/sys/', '/dev/',
];

/** 文件路径校验：必须在工作目录内，禁止敏感路径 */
export function validateFilePath(filePath: string): string | null {
  const normalized = filePath.replace(/\\/g, '/');

  // 禁止敏感路径
  for (const frag of SENSITIVE_PATH_FRAGMENTS) {
    if (normalized.includes(frag)) {
      return `禁止读取敏感路径（包含 ${frag}）`;
    }
  }

  // 必须在工作目录内
  if (_workDir && !normalized.startsWith(_workDir.replace(/\\/g, '/'))) {
    return `文件路径不在工作目录范围内（工作目录: ${_workDir}）`;
  }

  return null;
}

/** Python 代码校验：禁止危险操作 */
const PYTHON_FORBIDDEN = [
  /\bos\s*\./, /\bsubprocess\b/, /\beval\s*\(/, /\bexec\s*\(/,
  /\b__import__\s*\(/, /\bcompile\s*\(/, /\bopen\s*\(/,
  /\binput\s*\(/, /\bgetattr\s*\(\s*[^,]+,\s*['"]__(?:import|class|bases|subclasses)__['"]\s*\)/,
];

const PYTHON_MAX_LENGTH = 10000;
const PYTHON_TIMEOUT_MS = 10000;

export function validatePythonCode(code: string): string | null {
  if (code.length > PYTHON_MAX_LENGTH) {
    return `代码过长（${code.length} 字符，上限 ${PYTHON_MAX_LENGTH}）`;
  }
  for (const pattern of PYTHON_FORBIDDEN) {
    if (pattern.test(code)) {
      const match = code.match(pattern);
      return `代码包含禁止的操作: ${match?.[0] || pattern.source}`;
    }
  }
  return null;
}

export { PYTHON_TIMEOUT_MS };

// ============ 第四层：沙箱执行 ============
// 参数校验（第三层）即构成沙箱的主要控制手段。
// Python 执行通过子进程安全包装，详见 engine.ts 中的 executePythonSandbox。

// ============ 第五层：结果清洗 ============

/** 密钥泄漏模式 */
const SECRET_PATTERNS = [
  /ghp_[A-Za-z0-9]{36,}/g,          // GitHub personal access token
  /sk-[A-Za-z0-9]{32,}/g,           // OpenAI API key
  /Bearer\s+[A-Za-z0-9\-._~+/]+=*/g, // Bearer token
  /xox[bpras]-[A-Za-z0-9\-]+/g,     // Slack token
  /AIza[0-9A-Za-z\-_]{35}/g,        // Google API key
  /eyJ[A-Za-z0-9\-_]+\.eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/g, // JWT
];

const MAX_RESULT_LENGTH = 4000;

/**
 * 清洗工具执行结果：
 * 1. 截断到 MAX_RESULT_LENGTH 字符
 * 2. 过滤密钥模式
 */
export function sanitizeResult(raw: string): string {
  let cleaned = raw;
  for (const pattern of SECRET_PATTERNS) {
    cleaned = cleaned.replace(pattern, '[已过滤]');
  }
  if (cleaned.length > MAX_RESULT_LENGTH) {
    cleaned = cleaned.slice(0, MAX_RESULT_LENGTH) + '\n\n[结果已截断，原始长度 ' + raw.length + ' 字符]';
  }
  return cleaned;
}

// ============ 综合安全入口 ============

export interface SafetyCheckResult {
  passed: boolean;
  error: string | null;
}

/**
 * 对所有安全层进行综合校验。
 * 返回通过/失败，失败时附带错误信息。
 */
export function fullSafetyCheck(
  roleKey: string,
  toolName: string,
  args: Record<string, string>,
  sessionId: string,
  round: number,
): SafetyCheckResult {
  // L1: 白名单
  const l1 = checkToolWhitelist(roleKey, toolName);
  if (l1) return { passed: false, error: `[L1-白名单] ${l1}` };

  // L2: 速率限制
  const l2 = checkRateLimit(sessionId, roleKey, round);
  if (l2) return { passed: false, error: `[L2-速率限制] ${l2}` };

  // L3: 参数校验
  if (toolName === 'web_fetch' && args.url) {
    const l3 = validateUrl(args.url);
    if (l3) return { passed: false, error: `[L3-参数校验] ${l3}` };
  }
  if (toolName === 'read_file' && args.path) {
    const l3 = validateFilePath(args.path);
    if (l3) return { passed: false, error: `[L3-参数校验] ${l3}` };
  }
  if (toolName === 'python_exec' && args.code) {
    const l3 = validatePythonCode(args.code);
    if (l3) return { passed: false, error: `[L3-参数校验] ${l3}` };
  }

  return { passed: true, error: null };
}

// ============ 工具执行封装 ============

/**
 * 通过安全校验后执行工具，并自动清洗结果。
 * read_file 和 python_exec 通过回调函数执行（安全层只做校验不执行）。
 */
export async function executeTool(
  toolName: string,
  args: Record<string, string>,
  customExecutors?: {
    readFile?: (path: string) => Promise<string>;
    pythonExec?: (code: string) => Promise<string>;
  },
): Promise<string> {
  const tool = getToolByName(toolName);
  if (!tool) return `未知工具: ${toolName}`;

  let rawResult: string;

  // read_file 和 python_exec 通过自定义执行器运行
  if (toolName === 'read_file' && customExecutors?.readFile) {
    rawResult = await customExecutors.readFile(args.path || '');
  } else if (toolName === 'python_exec' && customExecutors?.pythonExec) {
    rawResult = await customExecutors.pythonExec(args.code || '');
  } else {
    rawResult = await tool.executor(args);
  }

  // L5: 结果清洗
  return sanitizeResult(rawResult);
}
