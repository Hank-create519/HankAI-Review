// Hank个人工作室 AI审查系统 · GitHub 技能搜索引擎 v1.0
//
// 功能：用户输入需求后，自动搜索 GitHub 上包含 marvis-skills.json 的仓库，
//       匹配技能描述，返回可一键导入的原仓库地址和技能详情。

import { importFromGitHub, unimportFromGitHub } from './githubImporter';
import type { ExternalSkill } from '../types';

// ============ 类型定义 ============

/** 单个仓库搜索结果 */
export interface RepoSearchResult {
  /** 仓库完整名称 owner/repo */
  fullName: string;
  /** 仓库 GitHub URL */
  htmlUrl: string;
  /** 仓库描述 */
  description: string;
  /** Star 数 */
  stars: number;
  /** 最后更新时间 (ISO string) */
  updatedAt: string;
  /** 仓库语言 */
  language: string;
  /** 匹配到的技能列表（从 marvis-skills.json 中提取） */
  skills: SkillPreview[];
  /** 原始 marvis-skills.json 中的技能总数 */
  totalSkills: number;
}

/** 技能预览信息 */
export interface SkillPreview {
  name: string;
  description: string;
  toolType: string;
  icon?: string;
  /** 匹配得分 (0-100) */
  matchScore: number;
}

/** 搜索选项 */
export interface SearchOptions {
  /** 搜索查询（用户需求描述） */
  query: string;
  /** GitHub Personal Access Token（可选，提升速率限制） */
  token?: string;
  /** 最大返回仓库数 */
  maxRepos?: number;
  /** 最低匹配分 (0-100)，低于此分不返回 */
  minScore?: number;
}

// ============ GitHub API 封装 ============

function gitHubHeaders(token?: string): Record<string, string> {
  const h: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'HankAI-Review/1.0',
  };
  if (token) h['Authorization'] = `token ${token}`;
  return h;
}

async function gitHubFetch(url: string, token?: string): Promise<any> {
  const res = await fetch(url, { headers: gitHubHeaders(token) });
  if (!res.ok) {
    if (res.status === 403 && res.headers.get('X-RateLimit-Remaining') === '0') {
      throw new Error('GitHub API 请求次数已达上限，请稍后重试或提供 Token。');
    }
    throw new Error(`GitHub API 返回错误: HTTP ${res.status}`);
  }
  return res.json();
}

// ============ 搜索逻辑 ============

/**
 * 搜索 GitHub 上包含 marvis-skills.json 的仓库。
 *
 * 搜索策略：
 * 1. 使用 GitHub Code Search 查找包含 "marvis-skills.json" 的仓库
 * 2. 对找到的仓库，拉取 marvis-skills.json 原文件
 * 3. 将技能描述与用户查询做匹配评分
 * 4. 返回排序后的结果列表
 */
export async function searchGitHubSkills(options: SearchOptions): Promise<RepoSearchResult[]> {
  const {
    query,
    token,
    maxRepos = 10,
    minScore = 20,
  } = options;

  if (!query || !query.trim()) {
    throw new Error('请提供搜索需求描述。');
  }

  // Step 1: 搜索包含 marvis-skills.json 的代码
  const searchUrl = `https://api.github.com/search/code?q=marvis-skills.json+in:path&per_page=${Math.min(maxRepos * 2, 30)}`;
  let searchResult: any;
  try {
    searchResult = await gitHubFetch(searchUrl, token);
  } catch (err: any) {
    throw new Error(`GitHub 代码搜索失败: ${err.message}`);
  }

  if (!searchResult.items || searchResult.items.length === 0) {
    return [];
  }

  // Step 2: 按仓库分组，获取文件内容
  const repoMap = new Map<string, {
    repo: any;
    skills: SkillPreview[];
    totalSkills: number;
  }>();

  for (const item of searchResult.items) {
    const repoKey = item.repository?.full_name;
    if (!repoKey || repoMap.has(repoKey)) continue;

    try {
      const skillData = await fetchRepoSkills(item.repository, token);
      if (skillData.skills.length > 0) {
        repoMap.set(repoKey, skillData);
      }
    } catch {
      // 某个仓库获取失败，跳过
    }
  }

  // Step 3: 对每个仓库的技能做匹配评分
  const results: RepoSearchResult[] = [];

  for (const [fullName, data] of repoMap) {
    const scoredSkills = data.skills.map(sk => ({
      ...sk,
      matchScore: calculateMatchScore(query, sk.name, sk.description),
    })).filter(sk => sk.matchScore >= minScore)
      .sort((a, b) => b.matchScore - a.matchScore);

    if (scoredSkills.length === 0) continue;

    results.push({
      fullName,
      htmlUrl: data.repo.html_url,
      description: data.repo.description || '(无描述)',
      stars: data.repo.stargazers_count ?? 0,
      updatedAt: data.repo.updated_at ?? '',
      language: data.repo.language ?? 'Unknown',
      skills: scoredSkills,
      totalSkills: data.totalSkills,
    });
  }

  // 按匹配技能的最高分排序
  results.sort((a, b) => {
    const aMax = Math.max(...a.skills.map(s => s.matchScore));
    const bMax = Math.max(...b.skills.map(s => s.matchScore));
    return bMax - aMax;
  });

  return results.slice(0, maxRepos);
}

/**
 * 从仓库拉取 marvis-skills.json 并提取技能信息。
 */
async function fetchRepoSkills(
  repo: any,
  token?: string,
): Promise<{ repo: any; skills: SkillPreview[]; totalSkills: number }> {
  const owner = repo.owner?.login;
  const repoName = repo.name;
  const defaultBranch = repo.default_branch || 'main';

  const rawUrl = `https://raw.githubusercontent.com/${owner}/${repoName}/${defaultBranch}/marvis-skills.json`;

  let manifest: any;
  try {
    const res = await fetch(rawUrl, {
      headers: gitHubHeaders(token),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error('fetch failed');
    manifest = await res.json();
  } catch {
    return { repo, skills: [], totalSkills: 0 };
  }

  if (!manifest.skills || !Array.isArray(manifest.skills)) {
    return { repo, skills: [], totalSkills: 0 };
  }

  const skills: SkillPreview[] = manifest.skills.map((s: any) => ({
    name: s.name || '',
    description: s.description || '',
    toolType: s.toolType || 'unknown',
    icon: s.icon,
    matchScore: 0,
  }));

  return { repo, skills, totalSkills: skills.length };
}

// ============ 匹配评分算法 ============

/**
 * 基于关键词匹配计算技能与用户需求的相关度得分 (0-100)。
 *
 * 策略：
 * - 技能名直接命中 → +40
 * - 技能描述中的关键词命中 → 每个 +15
 * - 技能名包含查询词的部分匹配 → +20
 */
function calculateMatchScore(query: string, skillName: string, skillDescription: string): number {
  let score = 0;
  const qLower = query.toLowerCase();
  const qWords = tokenize(qLower);
  const nameLower = skillName.toLowerCase();
  const descLower = skillDescription.toLowerCase();

  // 技能名精确命中
  if (qLower.includes(nameLower) || nameLower.includes(qLower)) {
    score += 40;
  }

  // 技能名分词匹配
  const nameWords = tokenize(nameLower);
  for (const qw of qWords) {
    if (nameWords.some(nw => nw.includes(qw) || qw.includes(nw))) {
      score += 20;
      break;
    }
  }

  // 描述关键词命中
  for (const qw of qWords) {
    if (qw.length < 2) continue; // 跳过单字
    if (descLower.includes(qw)) {
      score += 15;
    }
  }

  return Math.min(100, score);
}

/**
 * 简易分词：按空白 + 中英文标点切分。
 */
function tokenize(text: string): string[] {
  // 按空格、逗号、句号、分号、冒号、中文标点等切分
  return text
    .split(/[\s,，。；;：:、！!？?]+/)
    .filter(w => w.length > 0);
}

// ============ 一键导入 ============

/**
 * 搜索结果的一键导入：给定搜索结果的仓库地址，调用 githubImporter 导入。
 */
export async function importSearchResult(
  result: RepoSearchResult,
  token?: string,
): Promise<{
  sourceId: string;
  skills: ExternalSkill[];
  repoLabel: string;
}> {
  return importFromGitHub(result.htmlUrl, token);
}

/**
 * 撤销某次搜索结果的导入。
 */
export { unimportFromGitHub };
