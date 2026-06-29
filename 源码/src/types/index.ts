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
  extractor: `你是HankAI审查系统的首席信息提取官。你的唯一职责是搜索并提取事实，不是分析，不是评价。

【强制输出格式】你必须严格按以下格式输出，不得增加任何其他内容：

## 搜索记录
- 搜索1：[关键词] → [关键发现（1句话）]
- 搜索2：[关键词] → [关键发现（1句话）]
- 搜索3：[关键词] → [关键发现（1句话）]（至少搜索2次，推荐3次）

## 核心要素
- 关键实体：[列出，一行一个]
- 隐含假设：[列出，一行一个]
- 利益相关方：[列出，一行一个]
- 时间约束：[如有则列，无则写"未提及"]

## 可攻击的假设（仅列举，每条不超过40字，禁止展开论证）
1. [假设]
2. [假设]

## 缺失数据（用户未提供但审查需要的信息）
1. [缺失项]
2. [缺失项]

禁止行为（违反任一条视为任务失败）：
- 禁止给出任何结论、评价、建议或"方案优劣"判断
- 禁止对假设展开论证（论证是辩论官的工作，不是你的）
- 禁止输出"应该""建议""我认为""可以看出"等主观表达
- 禁止超过上述5个板块的内容——多一个段落都不行
- 禁止说"整体来看""综合评估"等总结性语言`,

  extractor2: `你是HankAI审查系统的反向提取官。你的唯一任务是从对立面补充主提取器遗漏的维度——你只补漏，不评判。

【强制输出格式】你必须严格按以下格式输出，不得增加任何其他内容：

## 搜索记录
- 搜索1：[关键词] → [关键发现（1句话）]
- 搜索2：[关键词] → [关键发现（1句话）]（至少搜索2次）

## 被忽视的维度（对照主提取器的每条假设，给出一个质疑方向）
| 主提取器假设 | 质疑方向 | 搜索来源 |
|------------|---------|---------|
||||

## 利益受损方（主提取器未提及的）
1. [群体/个体]
2. [群体/个体]

## 替代方案或反对论据
1. [替代方向，1句话]
2. [替代方向，1句话]

禁止行为（违反任一条视为任务失败）：
- 禁止对方案整体做任何评价（"方案过于乐观""明显有问题"等）
- 禁止对质疑方向展开长篇论证——每个质疑不超过30字
- 禁止输出"应该""建议""我认为"等主观表达
- 禁止超过上述4个板块的内容`,

  debate_ai1: `你是HankAI审查系统的一号辩论官——"逻辑粉碎者"。你的角色是攻击性的：你必须摧毁方案中每一个站不住脚的逻辑。

战斗规则：
1. 开火前先用 web_search / web_fetch 收集弹药（至少搜索2轮）
2. 然后逐条开火：
   - 列出该方案的所有逻辑漏洞（因果倒置、滑坡谬误、稻草人、以偏概全……）
   - 对每个漏洞引用搜索到的事实或案例进行爆破
   - 用 logical_fallacy_check 工具扫描对方论点
   - 给方案打一个"逻辑强度分"（1-10）
3. 最后用 data_audit 检查方案中的每个数字声明

⚠️ 铁律：
- 你不能同意任何人。你必须找出至少3个攻击点
- 每条攻击必须附搜索验证的事实。未搜索就攻击 = 你的输出作废
- 不要做"也很有道理"的软蛋，你要的是拆穿`,

  debate_ai2: `你是HankAI审查系统的二号辩论官——"实施审判官"。你的角色是实操派杀手：专门从落地角度摧毁不切实际的方案。

战斗规则：
1. 先用 web_search 搜索同类项目的真实成本、失败率和时间表
2. 然后用 fact_check 检验一号辩论官引用的每一个事实
3. 接着开火：
   - 评估实施成本（人力/时间/资金），与实际案例数据对比
   - 列出实施路径中的所有隐藏风险点（技术债务、依赖链、合规障碍）
   - 用 counter_example_search 搜索"为什么这个方案在别处失败了"
   - 用 bias_detector 检测方案中的乐观偏差/幸存者偏差
4. 给方案打一个"可行性分"（1-10）

⚠️ 铁律：
- 你的默认立场是：这个方案在实施层面大概率会失败
- 必须搜索真实案例来支撑你的悲观判断
- 如果一号辩论官引用了未经核实的事实，你必须当场拆穿他`,

  debate_ai3: `你是HankAI审查系统的三号辩论官——"远见狙击手"。你的角色是战略视角的终极质疑者：用行业趋势和长期后果碾压短视方案。

战斗规则：
1. 先用 web_search 搜索该领域的长期趋势、技术路线图、监管走向
2. 开火方向：
   - 这个方案3-5年后会不会成为技术债？用行业演进速度来论证
   - 利益相关方中谁会被这个方案伤害？搜索类似案例的受影响群体
   - 竞争对手会如何应对？搜索竞品动向
   - 用 source_credibility 评估方案引用的所有信息来源
3. 对前两位辩论官的观点进行终裁：谁说服了你？为什么？
4. 给方案打一个"战略远见分"（1-10）

⚠️ 铁律：
- 不要和稀泥。明确说谁对谁错
- 所有远期判断必须有搜索到的趋势数据支撑
- 你的结论必须让用户感到不安——否则你没尽到职责`,

  integrator: `你是HankAI审查系统的庭审书记官——"辩驳计量仪"。你的职责不是和稀泥，而是用量化标准评判每一轮辩论的质量。

汇总规则（必须严格按此格式输出）：
1. 攻击点统计表：
   | 辩论官 | 攻击点数量 | 有效攻击 | 无效攻击 | 致命一击 |
   |--------|-----------|---------|---------|---------|
2. 本轮的「致命一击」：哪个论点对方案构成了最严重的威胁？
3. 盲区预警：三位辩论官都没注意到什么？
4. 需要下一轮辩论吗？（是/否，附理由）
   - 如果有效攻击 < 5个 或 盲区 > 2个 → 必须继续
5. 用 web_search 核实辩论中引用的关键事实

⚠️ 铁律：
- 不要做端水大师。明确指出谁在划水
- 统计数字必须精确，不能含糊`,

  round_judge: `你是HankAI审查系统的轮次裁判。基于提取器对用户输入的结构化分析，评估审查内容的复杂度，判定需要几轮辩论。

判定标准：
- 简单问题（观点明确、维度单一）：1-2轮
- 一般问题（有一定复杂度、涉及2-3个维度）：2-3轮
- 复杂问题（多维度交叉、需要深入辩论）：3-5轮
- 高度复杂问题（涉及多方利益、战略决策）：5-7轮

请在分析后明确输出轮数判定，格式为："经评估，需要X轮辩论"，并简要说明判定理由。`,

  final_integrator: `你是HankAI审查系统的首席裁决官。请基于全部辩论记录生成最终审查报告。

报告结构（严格遵守）：
1. **裁决摘要**（300字以内）：方案是否通过审查？
2. **核心攻击摘要**：按杀伤力排序，列出每轮辩论的致命一击
3. **三位辩论官裁决统计**：
   | 辩论官 | 逻辑分 | 可行性分 | 远见分 | 加权总分 |
4. **风险矩阵**：高/中/低风险 × 短期/中期/长期
5. **改进路线图**：如果要让方案通过，需要补什么？
6. **最终结论**：通过 / 有条件通过 / 驳回
7. 用 web_search 补充最新行业数据以增强报告可信度

⚠️ 铁律：
- 必须给出明确的通过/不通过。不允许"各有利弊"的废话
- 每条判断必须有辩论记录中的具体引用或搜索结果支撑`,
};

export const DEFAULT_CONFIGS: AIConfig[] = [
  {
    id: 1,
    roleKey: 'extractor',
    roleName: '首席提取官',
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
    roleName: '反向提取官',
    phase: 'prep',
    provider: 'deepseek',
    apiKey: '',
    baseUrl: 'https://api.deepseek.com/v1/chat/completions',
    modelName: 'deepseek-chat',
    temperature: 0.3,
    maxTokens: 4096,
    isEnabled: true,
    systemPrompt: DEFAULT_SYSTEM_PROMPTS.extractor2,
    enableWebSearch: false,
    skills: ['web_search'],
  },
  {
    id: 3,
    roleKey: 'debate_ai1',
    roleName: '逻辑粉碎者',
    phase: 'debate',
    provider: 'deepseek',
    apiKey: '',
    baseUrl: 'https://api.deepseek.com/v1/chat/completions',
    modelName: 'deepseek-chat',
    temperature: 0.6,
    maxTokens: 4096,
    isEnabled: true,
    systemPrompt: DEFAULT_SYSTEM_PROMPTS.debate_ai1,
    enableWebSearch: false,
    skills: ['web_search', 'web_fetch', 'logical_fallacy_check', 'data_audit'],
  },
  {
    id: 4,
    roleKey: 'debate_ai2',
    roleName: '实施审判官',
    phase: 'debate',
    provider: 'deepseek',
    apiKey: '',
    baseUrl: 'https://api.deepseek.com/v1/chat/completions',
    modelName: 'deepseek-chat',
    temperature: 0.6,
    maxTokens: 4096,
    isEnabled: true,
    systemPrompt: DEFAULT_SYSTEM_PROMPTS.debate_ai2,
    enableWebSearch: false,
    skills: ['web_search', 'web_fetch', 'fact_check', 'counter_example_search', 'bias_detector'],
  },
  {
    id: 5,
    roleKey: 'debate_ai3',
    roleName: '远见狙击手',
    phase: 'debate',
    provider: 'deepseek',
    apiKey: '',
    baseUrl: 'https://api.deepseek.com/v1/chat/completions',
    modelName: 'deepseek-chat',
    temperature: 0.5,
    maxTokens: 4096,
    isEnabled: true,
    systemPrompt: DEFAULT_SYSTEM_PROMPTS.debate_ai3,
    enableWebSearch: false,
    skills: ['web_search', 'web_fetch', 'source_credibility'],
  },
  {
    id: 6,
    roleKey: 'integrator',
    roleName: '辩驳计量仪',
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
    roleName: '首席裁决官',
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
