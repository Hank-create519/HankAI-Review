// Hank个人工作室 AI审查系统 · 类型定义 v1.0

export interface AIConfig {
  id: number;
  roleKey: string;
  roleName: string;
  phase: 'prep' | 'debate' | 'debate_summarizer' | 'summary';
  provider: string;
  apiKey: string;
  baseUrl: string;
  modelName: string;
  temperature: number;
  maxTokens: number;
  isEnabled: boolean;
  systemPrompt: string;
  enableWebSearch: boolean;
  skills: string[];
}

export interface ReviewTask {
  id: string;
  title: string;
  status: 'preparing' | 'debating' | 'summarizing' | 'completed' | 'error';
  totalRounds: number;
  createdAt: string;
  completedAt?: string;
  errorMessage?: string;
}

export interface ReviewOutput {
  id: number;
  roundNumber: number;
  roleName: string;
  roleKey: string;
  status: 'running' | 'completed' | 'error';
  outputContent: string;
  responseTimeMs: number;
}

export interface FinalReport {
  taskId: string;
  reportContent: string;
  generatedAt: string;
}

export interface ReviewProgress {
  phase: 'idle' | 'preparation' | 'debate' | 'summary' | 'completed' | 'error';
  completedSteps: number;
  totalSteps: number;
  currentRound?: number;
  totalRounds?: number;
}

export interface PromptInput {
  label: string;
  value: string;
  multiline?: boolean;
}

// ============ 技能管理相关类型 ============

/** 数据源类型 */
export type DataSourceType = 'github' | 'database';

/** GitHub 仓库数据源 */
export interface GitHubRepo {
  type: 'github';
  id: string;
  url: string;
  token?: string;
  label: string;
}

/** 数据库连接（UI 占位） */
export interface DatabaseConnection {
  type: 'database';
  id: string;
  dbType: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  label: string;
}

export type DataSource = GitHubRepo | DatabaseConnection;

/** 技能来源 */
export type SkillSource = 'builtin' | 'github' | 'database';

/** 外部技能配置 */
export interface ExternalSkill {
  name: string;
  description: string;
  toolType: string;
  icon?: string;
  source: SkillSource;
  sourceUrl?: string;
  sourceId?: string;
  params?: Record<string, unknown>;
}

/** 技能池条目（含来源标记） */
export interface SkillEntry {
  name: string;
  description: string;
  toolType: string;
  icon?: string;
  source: SkillSource;
  sourceUrl?: string;
  sourceId?: string;
}

/** 技能分配快照（用于导出/导入） */
export interface SkillAssignmentSnapshot {
  version: 1;
  exportedAt: string;
  dataSources: DataSource[];
  assignments: Record<string, string[]>;
}

// ============ 原有常量 ============

export const PROVIDER_DEFAULTS: Record<string, { baseUrl: string; modelName: string }> = {
  openai: { baseUrl: 'https://api.openai.com/v1/chat/completions', modelName: 'gpt-4o' },
  anthropic: { baseUrl: 'https://api.anthropic.com/v1/messages', modelName: 'claude-3-opus-20240229' },
  google: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent', modelName: 'gemini-pro' },
  deepseek: { baseUrl: 'https://api.deepseek.com/v1/chat/completions', modelName: 'deepseek-chat' },
  zhipu: { baseUrl: 'https://open.bigmodel.cn/api/paas/v4/chat/completions', modelName: 'glm-4' },
  moonshot: { baseUrl: 'https://api.moonshot.cn/v1/chat/completions', modelName: 'moonshot-v1-8k' },
  baichuan: { baseUrl: 'https://api.baichuan-ai.com/v1/chat/completions', modelName: 'Baichuan4' },
  qwen: { baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', modelName: 'qwen-max' },
  wenxin: { baseUrl: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions', modelName: 'ernie-4.0-8k' },
  custom: { baseUrl: 'https://api.openai.com/v1/chat/completions', modelName: 'gpt-4o' },
};

export const DEFAULT_SYSTEM_PROMPTS: Record<string, string> = {
  extractor: `你是Hank个人工作室 AI审查系统的信息提取器。你的职责是：
1. 从用户输入中提取核心要素（主题、关键实体、上下文范围）
2. 识别缺失的关键信息并提出补充建议
3. 将信息结构化，为下游辩论层提供清晰的输入

【强制工具使用规则 - 必须严格遵守】
- 当用户问题涉及任何实时信息、最新数据、具体行业动态、政策法规、市场趋势时，你必须调用 web_search 工具进行搜索。不能凭你的训练知识回答。
- 对于需要验证的事实、数据、或你不太确定的信息，必须搜索确认，严禁凭记忆猜测。
- 在输出分析结论之前，先搜索相关背景信息，确保分析基于最新、可靠的数据。
- 如果用户输入的信息明显不足，先搜索补充背景后再进行提取。`,

  extractor2: `你是Hank个人工作室 AI审查系统的辅助信息提取器。请从不同于主提取器的角度对输入进行分析：
1. 关注业务背景、技术约束和利益相关者
2. 识别输入中隐含的前提假设
3. 与主提取器形成互补视角

【强制工具使用规则】
- 主动搜索相关行业案例、法规更新和竞品动态，补充主提取器可能遗漏的外部信息
- 对于不确定性高的领域，搜索确认最新的行业标准和最佳实践
- 搜索确认你引用的任何具体数据、案例或法规是否仍然有效
- 请在输出中注明信息搜索来源。`,

  debate_ai1: `你是Hank个人工作室 AI审查系统的辩论AI。请基于审查任务说明书对问题进行深入分析：
1. 识别方案中的逻辑漏洞和不一致之处
2. 评估事实依据的可靠性
3. 提出改进建议和替代方案

【强制工具使用规则 - 必须严格遵守】
- 辩论中引用的任何事实、数据、案例、技术细节都必须经过搜索验证，严禁凭你的训练知识编造。
- 在提出论点前，必须先调用 web_search 搜索相关的最新信息作为论据支撑。
- 当你需要深入阅读某篇文章以获取精确数据时，使用 web_fetch 工具抓取网页内容。
- 你的论证必须建立在可验证的事实基础上，而非臆测。`,

  debate_ai2: `你是Hank个人工作室 AI审查系统的辩论AI（第2号）。请从不同视角对问题进行审查：
1. 关注实施层面的可行性和风险
2. 评估资源需求和约束条件
3. 对前一轮辩论中其他AI的观点进行评价

【强制工具使用规则 - 必须严格遵守】
- 涉及技术可行性、成本数据、实施案例时，必须先调用 web_search 搜索验证。
- 对其他AI的论点有异议时，必须搜索事实依据来支撑你的反驳，不能仅凭推理。
- 需要精确数据（如成本、时间、技术指标）时，使用 web_fetch 抓取相关文章详情。
- 你的分析必须可追溯，引用时请标注信息来源。`,

  debate_ai3: `你是Hank个人工作室 AI审查系统的辩论AI（第3号）。请从长期影响和战略角度进行分析：
1. 评估方案的长期可持续性
2. 分析对利益相关者的影响
3. 提出前瞻性建议

【强制工具使用规则 - 必须严格遵守】
- 行业趋势、政策走向、前沿研究成果等分析必须基于搜索获取的最新信息。
- 在做出前瞻性判断前，必须先调用 web_search 了解当前行业格局和发展方向。
- 需要参考具体研究报告或专业文章时，使用 web_fetch 抓取网页内容深入阅读。
- 你的战略建议必须有可查证的行业趋势或案例支撑。`,

  integrator: `你是Hank个人工作室 AI审查系统的辩论汇总员。请对当前轮次的辩论情况进行汇总：
1. 识别审查AI之间的共识点和分歧点
2. 评估辩论质量（是否充分展开、是否有盲区）
3. 判断是否需要进行下一轮辩论

工具使用指引：
- 当汇总时需要核实各方引用的背景事实或补充最新数据以做出更准确判断时，使用 web_search 工具联网搜索
- 请以中性、客观的态度进行汇总。`,

  round_judge: `你是Hank个人工作室 AI审查系统的轮次裁判。你的职责是在信息提取阶段完成后，基于提取器对用户输入的结构化分析，评估审查内容的复杂度，判定需要几轮辩论。

判定标准：
- 简单问题（观点明确、维度单一）：1-2轮
- 一般问题（有一定复杂度、涉及2-3个维度）：2-3轮
- 复杂问题（多维度交叉、需要深入辩论）：3-4轮
- 高度复杂问题（涉及多方利益、战略决策）：4-5轮

请在分析后明确输出轮数判定，格式为："经评估，需要X轮辩论"，并简要说明判定理由。`,

  final_integrator: `你是Hank个人工作室 AI审查系统的最终报告生成员。请基于所有对话记录生成最终审查报告：
1. 综合所有AI的审查意见
2. 汇总关键发现和建议
3. 给出明确的结论和行动建议

工具使用指引：
- 当生成报告时需要补充最新行业数据、核实关键事实或引用权威来源以增强报告可信度时，使用 web_search 工具联网搜索
- 请以正式报告格式输出，结构清晰、逻辑连贯。`,
};

export const DEFAULT_CONFIGS: AIConfig[] = [
  {
    id: 1,
    roleKey: 'extractor',
    roleName: '信息提取器',
    phase: 'prep',
    provider: 'deepseek',
    apiKey: '',
    baseUrl: 'https://api.deepseek.com/v1/chat/completions',
    modelName: 'deepseek-chat',
    temperature: 0.1,
    maxTokens: 4096,
    isEnabled: true,
    systemPrompt: DEFAULT_SYSTEM_PROMPTS.extractor,
    enableWebSearch: false,
    skills: ['web_search'],
  },
  {
    id: 2,
    roleKey: 'extractor2',
    roleName: '辅助提取器',
    phase: 'prep',
    provider: 'deepseek',
    apiKey: '',
    baseUrl: 'https://api.deepseek.com/v1/chat/completions',
    modelName: 'deepseek-chat',
    temperature: 0.2,
    maxTokens: 4096,
    isEnabled: true,
    systemPrompt: DEFAULT_SYSTEM_PROMPTS.extractor2,
    enableWebSearch: false,
    skills: ['web_search'],
  },
  {
    id: 3,
    roleKey: 'debate_ai1',
    roleName: '审查AI-1',
    phase: 'debate',
    provider: 'deepseek',
    apiKey: '',
    baseUrl: 'https://api.deepseek.com/v1/chat/completions',
    modelName: 'deepseek-chat',
    temperature: 0.3,
    maxTokens: 4096,
    isEnabled: true,
    systemPrompt: DEFAULT_SYSTEM_PROMPTS.debate_ai1,
    enableWebSearch: false,
    skills: ['web_search', 'web_fetch'],
  },
  {
    id: 4,
    roleKey: 'debate_ai2',
    roleName: '审查AI-2',
    phase: 'debate',
    provider: 'deepseek',
    apiKey: '',
    baseUrl: 'https://api.deepseek.com/v1/chat/completions',
    modelName: 'deepseek-chat',
    temperature: 0.4,
    maxTokens: 4096,
    isEnabled: true,
    systemPrompt: DEFAULT_SYSTEM_PROMPTS.debate_ai2,
    enableWebSearch: false,
    skills: ['web_search', 'web_fetch'],
  },
  {
    id: 5,
    roleKey: 'debate_ai3',
    roleName: '审查AI-3',
    phase: 'debate',
    provider: 'deepseek',
    apiKey: '',
    baseUrl: 'https://api.deepseek.com/v1/chat/completions',
    modelName: 'deepseek-chat',
    temperature: 0.35,
    maxTokens: 4096,
    isEnabled: true,
    systemPrompt: DEFAULT_SYSTEM_PROMPTS.debate_ai3,
    enableWebSearch: false,
    skills: ['web_search', 'web_fetch'],
  },
  {
    id: 6,
    roleKey: 'integrator',
    roleName: '辩论汇总员',
    phase: 'debate_summarizer',
    provider: 'deepseek',
    apiKey: '',
    baseUrl: 'https://api.deepseek.com/v1/chat/completions',
    modelName: 'deepseek-chat',
    temperature: 0.1,
    maxTokens: 4096,
    isEnabled: true,
    systemPrompt: DEFAULT_SYSTEM_PROMPTS.integrator,
    enableWebSearch: false,
    skills: ['web_search'],
  },
  {
    id: 7,
    roleKey: 'round_judge',
    roleName: '轮次裁判',
    phase: 'prep',
    provider: 'deepseek',
    apiKey: '',
    baseUrl: 'https://api.deepseek.com/v1/chat/completions',
    modelName: 'deepseek-chat',
    temperature: 0.1,
    maxTokens: 2048,
    isEnabled: true,
    systemPrompt: DEFAULT_SYSTEM_PROMPTS.round_judge,
    enableWebSearch: false,
    skills: [],
  },
  {
    id: 8,
    roleKey: 'final_integrator',
    roleName: '最终报告员',
    phase: 'summary',
    provider: 'deepseek',
    apiKey: '',
    baseUrl: 'https://api.deepseek.com/v1/chat/completions',
    modelName: 'deepseek-chat',
    temperature: 0.2,
    maxTokens: 8192,
    isEnabled: true,
    systemPrompt: DEFAULT_SYSTEM_PROMPTS.final_integrator,
    enableWebSearch: false,
    skills: ['web_search'],
  },
];

// ============ SDK 桥接类型 ============

export type RoundOutput = ReviewOutput;

export type ReviewEvent = string;
export type ReviewEventType = string;
export type ReviewEventListener = (event: ReviewEvent) => void;

export interface LLMRequest {
  provider: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  messages: { role: string; content: string }[];
  temperature?: number;
  maxTokens?: number;
}

export interface LLMResponse {
  content: string;
  responseTimeMs: number;
  error?: string;
}

export type LLMCaller = (req: LLMRequest) => Promise<LLMResponse>;

export interface EngineOptions {
  configs?: AIConfig[];
}

export interface SkillConfig {
  name: string;
  enabled: boolean;
}

export const DEFAULT_ROLES = DEFAULT_CONFIGS;

export function createDefaultAIConfigs(): AIConfig[] {
  return JSON.parse(JSON.stringify(DEFAULT_CONFIGS));
}

export function extractRoundCount(input: string): number {
  const match = input.match(/轮数[：:]\s*(\d+)/);
  return match ? Math.max(1, parseInt(match[1], 10)) : 3;
}
