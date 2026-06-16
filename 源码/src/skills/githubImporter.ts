// Hank个人工作室 AI审查系统 · GitHub 仓库技能导入器 v1.0

import { registerExternalSkills, removeSkillsBySourceId } from './skillManager';
import type { ExternalSkill } from '../types';

/** marvis-skills.json 根结构 */
interface MarvisSkillsManifest {
  skills: Array<{
    name: string;
    description: string;
    toolType: string;
    icon?: string;
    params?: Record<string, unknown>;
  }>;
}

/**
 * 从 GitHub 仓库读取技能定义。
 * - 公开仓库直接 fetch raw content
 * - 私有仓库需要提供 token
 *
 * 技能定义文件必须位于仓库根目录下，名为 marvis-skills.json。
 */
export async function importFromGitHub(
  repoUrl: string,
  token?: string,
): Promise<{
  sourceId: string;
  skills: ExternalSkill[];
  repoLabel: string;
}> {
  // 解析 GitHub URL，提取 owner/repo
  const parsed = parseGitHubUrl(repoUrl);
  if (!parsed) {
    throw new Error(`无效的 GitHub 仓库 URL: ${repoUrl}`);
  }

  const { owner, repo } = parsed;
  const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/marvis-skills.json`;

  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3.raw',
    'User-Agent': 'HankAI-Review/1.0',
  };

  if (token) {
    headers['Authorization'] = `token ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(rawUrl, {
      headers,
      signal: AbortSignal.timeout(15000),
    });
  } catch (err) {
    throw new Error(`无法访问仓库文件: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(
        `仓库中未找到 marvis-skills.json 文件。请确保文件位于 ${owner}/${repo} 的根目录下。`,
      );
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error(
        `访问被拒绝：这可能是私有仓库或需要认证。请提供有效的 GitHub Token。`,
      );
    }
    throw new Error(`GitHub API 返回错误: HTTP ${response.status} ${response.statusText}`);
  }

  let manifest: MarvisSkillsManifest;
  try {
    manifest = await response.json();
  } catch {
    throw new Error('marvis-skills.json 格式无效，无法解析为 JSON。');
  }

  if (!manifest.skills || !Array.isArray(manifest.skills)) {
    throw new Error('marvis-skills.json 缺少 skills 数组字段。');
  }

  const sourceId = `github_${owner}_${repo}_${Date.now()}`;
  const repoLabel = `${owner}/${repo}`;

  const skills: ExternalSkill[] = manifest.skills.map((sk, idx) => ({
    name: sk.name,
    description: sk.description,
    toolType: sk.toolType,
    icon: sk.icon,
    source: 'github' as const,
    sourceUrl: repoUrl,
    sourceId,
    params: sk.params,
    _order: idx,
  }));

  // 注册到技能管理器
  registerExternalSkills(skills);

  return { sourceId, skills, repoLabel };
}

/**
 * 撤销某次 GitHub 导入的所有技能。
 */
export function unimportFromGitHub(sourceId: string): number {
  return removeSkillsBySourceId(sourceId);
}

/**
 * 解析 GitHub URL 格式：
 * - https://github.com/user/repo
 * - https://github.com/user/repo.git
 * - github.com/user/repo
 */
function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  // 去除首尾空白
  let clean = url.trim();

  // 去除协议前缀
  clean = clean.replace(/^https?:\/\//, '');

  // 必须是 github.com 开头的
  if (!clean.startsWith('github.com/')) return null;

  // 去除 github.com/
  clean = clean.slice('github.com/'.length);

  // 去除 .git 后缀
  clean = clean.replace(/\.git$/, '');

  // 去除末尾斜杠
  clean = clean.replace(/\/$/, '');

  const parts = clean.split('/');

  return { owner: parts[0], repo: parts[1] };
}
