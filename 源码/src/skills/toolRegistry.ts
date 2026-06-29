// Hank个人工作室 AI审查系统 · 工具注册表 v1.0
// 定义所有可用工具及其 JSON Schema、risk 等级、executor

import { searchGitHubSkills } from './githubSkillSearch';

// ============ 工具定义 ============

export interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, any>; // JSON Schema for OpenAI function calling
  risk: 'low' | 'medium' | 'high';
  executor: (args: Record<string, string>) => Promise<string>;
}

// ============ 共享搜索执行器 ============

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function executeSearch(query: string): Promise<string> {
  if (!query.trim()) return '搜索关键词不能为空。';
  const q = encodeURIComponent(query);

  const tryBing = async (): Promise<string> => {
    const res = await fetch(`https://www.bing.com/search?q=${q}&setlang=zh-cn`, {
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'zh-CN,zh;q=0.9' },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const blocks = html.match(/<li[^>]*class="b_algo"[^>]*>[\s\S]*?<\/li>/gi) || [];
    const results: string[] = [];
    for (const block of blocks) {
      if (results.length >= 8) break;
      const titleMatch = block.match(/<h2[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i);
      const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : '';
      let snippet = '';
      const snipMatch = block.match(/<p[^>]*class="[^"]*b_lineclamp[^"]*"[^>]*>([\s\S]*?)<\/p>/i)
        || block.match(/<p[^>]*>([\s\S]{20,300}?)<\/p>/i);
      if (snipMatch) {
        snippet = snipMatch[1].replace(/<[^>]+>/g, '').replace(/&ensp;/g, ' ').replace(/&#0?\d+;/g, ' ').trim();
      }
      const entry = [title, snippet].filter(Boolean).join('\n   ');
      if (entry.length > 10) results.push(entry);
    }
    if (results.length === 0) throw new Error('未提取到搜索结果');
    return results.map((r, i) => `${i + 1}. ${r}`).join('\n\n');
  };

  const tryDuckDuckGo = async (): Promise<string> => {
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${q}`, {
      headers: { 'User-Agent': 'HankAI-Review/1.0' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const snippets: string[] = [];
    const snippetRe = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
    let m: RegExpExecArray | null;
    while ((m = snippetRe.exec(html)) !== null && snippets.length < 10) {
      const text = m[1].replace(/<[^>]+>/g, '').trim();
      if (text) snippets.push(text);
    }
    if (snippets.length === 0) throw new Error('未找到相关搜索结果');
    return snippets.map((s, i) => `${i + 1}. ${s}`).join('\n\n');
  };

  try {
    return await tryBing();
  } catch (bingErr: any) {
    try {
      return await tryDuckDuckGo();
    } catch (ddgErr: any) {
      return `搜索执行失败: Bing(${bingErr.message}), DuckDuckGo(${ddgErr.message})`;
    }
  }
}

/** 所有可用工具的注册表 */
export const TOOL_REGISTRY: ToolDef[] = [
  // ============ 基础工具 ============
  {
    name: 'web_search',
    description: '搜索互联网获取最新信息。当需要查找当前事件、最新数据、或知识库之外的信息时使用。',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '搜索关键词或问题' },
      },
      required: ['query'],
    },
    risk: 'low',
    executor: async (args) => executeSearch(args.query || ''),
  },
  {
    name: 'web_fetch',
    description: '抓取指定网页的正文内容。当需要读取具体网页文章内容时使用。',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: '要抓取的网页完整 URL（必须以 https:// 开头）' },
      },
      required: ['url'],
    },
    risk: 'medium',
    executor: async (args) => {
      const url = args.url || '';
      try {
        const res = await fetch(url, {
          headers: { 'User-Agent': 'HankAI-Review/1.0' },
          signal: AbortSignal.timeout(20000),
        });
        if (!res.ok) return `网页抓取失败: HTTP ${res.status}`;
        const html = await res.text();
        let text = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&nbsp;/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (text.length > 4000) text = text.slice(0, 4000) + '...';
        return text || '网页内容为空。';
      } catch (err: any) {
        return `网页抓取失败: ${err.message}`;
      }
    },
  },

  // ============ 专业审查工具 ============
  {
    name: 'fact_check',
    description: '事实核查工具。对一段声明中的具体事实进行搜索验证，返回验证结果和可信度评级。使用场景：辩论AI引用了某个"事实"需要核实、方案中出现了需要验证的数据。',
    parameters: {
      type: 'object',
      properties: {
        claim: { type: 'string', description: '需要核查的声明或事实陈述（原文）' },
      },
      required: ['claim'],
    },
    risk: 'low',
    executor: async (args) => {
      const claim = (args.claim || '').trim();
      if (!claim) return '核查声明不能为空。';
      // 搜索该声明的验证信息
      const searchResult = await executeSearch(`"${claim.slice(0, 80)}" 事实核查 验证`);
      return `[事实核查报告]\n待核查声明: ${claim}\n\n搜索验证结果:\n${searchResult}\n\n请在上述搜索结果基础上做出判断：该声明是否真实？可信度评级（高/中/低），并说明依据。`;
    },
  },
  {
    name: 'logical_fallacy_check',
    description: '逻辑谬误检测工具。扫描一段论证文本，识别其中可能存在的逻辑谬误（如稻草人、滑坡、因果倒置、以偏概全、人身攻击等）。使用场景：辩论过程中需要拆解对方论证的逻辑结构。',
    parameters: {
      type: 'object',
      properties: {
        argument: { type: 'string', description: '需要检测的论证文本' },
      },
      required: ['argument'],
    },
    risk: 'low',
    executor: async (args) => {
      const arg = (args.argument || '').trim();
      if (!arg) return '论证文本不能为空。';
      // 搜索相关逻辑谬误类型以辅助分析
      const searchResult = await executeSearch('常见逻辑谬误 种类 定义 稻草人 滑坡 因果倒置');
      return `[逻辑谬误检测报告]\n待检测论证: ${arg.slice(0, 300)}...\n\n常见逻辑谬误类型参考:\n${searchResult}\n\n请基于上述谬误类型对论证进行逐句扫描，列出所有发现的谬误，格式: [谬误类型] + 具体位置（引用原文） + 为何属于该谬误。`;
    },
  },
  {
    name: 'data_audit',
    description: '数据审计工具。检查方案/论证中出现的所有数字、百分比、金额、时间等数据声明，搜索验证其准确性。使用场景：方案中出现了具体的成本、市场规模、增长率等数字。',
    parameters: {
      type: 'object',
      properties: {
        statement: { type: 'string', description: '包含数据声明的文本段落' },
      },
      required: ['statement'],
    },
    risk: 'low',
    executor: async (args) => {
      const stmt = (args.statement || '').trim();
      if (!stmt) return '数据声明不能为空。';
      // 提取数字并搜索验证
      const numbers = stmt.match(/\d[\d,.]*[万亿千百%％倍美欧人元¥\$€￡]*/g) || [];
      const queries = numbers.slice(0, 3).map(n => `${n}`).join(' OR ');
      const searchResult = queries ? await executeSearch(`${queries} 数据 统计`) : '未提取到数字';
      return `[数据审计报告]\n待审计文本: ${stmt.slice(0, 400)}\n提取到的关键数字: ${numbers.join(', ')}\n\n搜索验证结果:\n${searchResult}\n\n请逐项验证每个数字：是否准确？来源是否可靠？与当前最新数据是否一致？`;
    },
  },
  {
    name: 'source_credibility',
    description: '来源可信度评估工具。评估某个信息来源（网站、机构、个人）的可信度，基于搜索到的声誉、历史记录、资质等信息。使用场景：需要判断某方引用的来源是否可靠。',
    parameters: {
      type: 'object',
      properties: {
        source: { type: 'string', description: '需要评估的信息来源（URL、机构名、人名等）' },
        context: { type: 'string', description: '该来源在什么上下文下被引用（可选）' },
      },
      required: ['source'],
    },
    risk: 'low',
    executor: async (args) => {
      const src = (args.source || '').trim();
      const ctx = (args.context || '').trim();
      if (!src) return '来源不能为空。';
      const q = ctx ? `${src} ${ctx} 可信度 评价 争议` : `${src} 可信度 权威性 争议 资质`;
      const searchResult = await executeSearch(q);
      return `[来源可信度评估报告]\n评估对象: ${src}\n${ctx ? `引用上下文: ${ctx}\n` : ''}\n搜索验证结果:\n${searchResult}\n\n请基于搜索结果评估该来源的可信度（高/中/低），并给出信任分（1-10）和判断依据。`;
    },
  },
  {
    name: 'counter_example_search',
    description: '反例搜索工具。搜索与某个主张或方案相反的真实案例、失败记录或反对方观点。使用场景：需要论证"这个方案在别处失败了"、"有更好的替代方案"。',
    parameters: {
      type: 'object',
      properties: {
        proposition: { type: 'string', description: '需要寻找反例的主张或方案描述' },
      },
      required: ['proposition'],
    },
    risk: 'low',
    executor: async (args) => {
      const prop = (args.proposition || '').trim();
      if (!prop) return '主张描述不能为空。';
      const searchResult = await executeSearch(`${prop.slice(0, 60)} 失败案例 反面例子 争议 批评 替代方案`);
      return `[反例搜索报告]\n目标主张: ${prop}\n\n搜索结果:\n${searchResult}\n\n请基于搜索结果列出最有力的反例和反对观点，每条标注来源。`;
    },
  },
  {
    name: 'bias_detector',
    description: '偏差检测工具。分析一段论述中可能存在的认知偏差（确认偏差、锚定效应、过度自信、幸存者偏差、框架效应等）。使用场景：辩论中发现对方的论证可能带有偏见。',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: '需要检测偏差的论述文本' },
      },
      required: ['text'],
    },
    risk: 'low',
    executor: async (args) => {
      const txt = (args.text || '').trim();
      if (!txt) return '论述文本不能为空。';
      const searchResult = await executeSearch('认知偏差 类型 确认偏差 幸存者偏差 锚定效应 过度自信 框架效应');
      return `[偏差检测报告]\n待检测文本: ${txt.slice(0, 400)}\n\n常见认知偏差类型参考:\n${searchResult}\n\n请检测文本中存在的所有认知偏差，格式: [偏差类型] + 表现（引用原文） + 为何判定为该偏差。`;
    },
  },
  {
    name: 'read_file',
    description: '读取本地文件内容。仅限工作目录范围内的文件。',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '要读取的文件路径（必须在工作目录范围内）',
        },
      },
      required: ['path'],
    },
    risk: 'medium',
    executor: async (_args) => {
      // read_file 的 executor 在 safetyGuard 中经过路径校验后才进入
      // 这里做占位：实际读取由 engine 中的安全包装层完成
      return '[read_file executor - 由安全层路由拦截]';
    },
  },
  {
    name: 'python_exec',
    description: '在沙箱中执行 Python 代码并返回结果。代码受安全限制。',
    parameters: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: '要执行的 Python 代码（受安全限制，禁用 os/subprocess/eval/exec 等）',
        },
      },
      required: ['code'],
    },
    risk: 'high',
    executor: async (_args) => {
      // python_exec 的 executor 在 safetyGuard 中经过安全校验后才进入
      return '[python_exec executor - 由安全层路由拦截]';
    },
  },
  {
    name: 'github_skill_search',
    description:
      '搜索 GitHub 上可接入框架的 AI 技能。输入需求描述后自动搜索包含 marvis-skills.json 的公开仓库，返回匹配的技能及其原仓库地址。适合发现社区贡献的审查/分析/文档处理等技能。',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '需求描述，如"合同条款合规检查"、"财务报表数据分析"、"医疗文献证据等级评估"',
        },
        max_repos: {
          type: 'integer',
          description: '最大返回仓库数，默认 10',
        },
      },
      required: ['query'],
    },
    risk: 'low',
    executor: async (args) => {
      const query = (args.query || '').trim();
      if (!query) return '搜索需求描述不能为空。';
      const maxRepos = args.max_repos ? Number(args.max_repos) : 10;
      try {
        const results = await searchGitHubSkills({ query, maxRepos });
        if (results.length === 0) {
          return `未找到与「${query}」匹配的可接入技能。请尝试更通用的关键词，或确认 GitHub 上已有社区贡献的相关 marvis-skills.json 仓库。`;
        }
        // 格式化输出
        const lines: string[] = [`### GitHub 技能搜索结果: 「${query}」\n`];
        for (let i = 0; i < results.length; i++) {
          const r = results[i];
          lines.push(`**${i + 1}. [${r.fullName}](${r.htmlUrl})**  ⭐ ${r.stars}`);
          if (r.description && r.description !== '(无描述)') {
            lines.push(`   > ${r.description.slice(0, 200)}`);
          }
          lines.push(`   语言: ${r.language}  |  更新: ${r.updatedAt.slice(0, 10)}  |  技能总数: ${r.totalSkills}`);
          lines.push('');
          for (const sk of r.skills) {
            const scoreBar = '█'.repeat(Math.round(sk.matchScore / 10)) + '░'.repeat(10 - Math.round(sk.matchScore / 10));
            lines.push(`   - **${sk.name}** (${sk.toolType}) 匹配度: ${sk.matchScore}% ${scoreBar}`);
            lines.push(`     ${sk.description.slice(0, 120)}`);
          }
          lines.push('');
        }
        lines.push('---');
        lines.push('> 使用 `import_github_skill` 工具并传入仓库地址即可一键导入上述技能。');
        return lines.join('\n');
      } catch (err: any) {
        return `GitHub 技能搜索失败: ${err.message}`;
      }
    },
  },
];

// ============ 工具查找辅助 ============

export function getToolByName(name: string): ToolDef | undefined {
  return TOOL_REGISTRY.find(t => t.name === name);
}

// ============ OpenAI 工具格式转换 ============

export function toOpenAITools(tools: ToolDef[]): Record<string, any>[] {
  return tools.map(t => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}
