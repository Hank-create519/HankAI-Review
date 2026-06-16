// Hank个人工作室 AI审查系统 · 动态技能管理中心 v1.0

import type { SkillEntry, SkillSource, ExternalSkill } from '../types';

/** 内置技能定义 */
const BUILTIN_SKILLS: SkillEntry[] = [
  {
    name: 'web_search',
    description: '搜索互联网获取最新信息。当需要查找当前事件、最新数据、或知识库之外的信息时使用。',
    toolType: 'web_search',
    source: 'builtin',
  },
  {
    name: 'web_fetch',
    description: '抓取指定网页的正文内容。当需要读取具体网页文章内容时使用。',
    toolType: 'web_fetch',
    source: 'builtin',
  },
  {
    name: 'read_file',
    description: '读取本地文件内容。仅限工作目录范围内的文件。',
    toolType: 'read_file',
    source: 'builtin',
  },
  {
    name: 'python_exec',
    description: '在沙箱中执行 Python 代码并返回结果。代码受安全限制。',
    toolType: 'python_exec',
    source: 'builtin',
  },
];

/** 技能池：内置 + 外部导入 */
const skillPool: Map<string, SkillEntry> = new Map();

// 初始化内置技能
for (const skill of BUILTIN_SKILLS) {
  skillPool.set(skill.name, { ...skill });
}

/** 生成唯一 ID */
let _idCounter = 0;
function generateId(): string {
  _idCounter++;
  return `ext_${Date.now()}_${_idCounter}`;
}

/**
 * 注册外部技能。
 * 如果同名技能已存在，则覆盖。
 */
export function registerExternalSkill(
  name: string,
  config: Omit<ExternalSkill, 'name'>,
): SkillEntry {
  const entry: SkillEntry = {
    name,
    description: config.description,
    toolType: config.toolType,
    icon: config.icon,
    source: config.source,
    sourceUrl: config.sourceUrl,
    sourceId: config.sourceId || generateId(),
  };
  skillPool.set(name, entry);
  return entry;
}

/**
 * 批量注册外部技能。
 */
export function registerExternalSkills(skills: ExternalSkill[]): SkillEntry[] {
  const entries: SkillEntry[] = [];
  for (const sk of skills) {
    entries.push(registerExternalSkill(sk.name, sk));
  }
  return entries;
}

/**
 * 移除外部技能（内置技能不可移除）。
 */
export function removeExternalSkill(name: string): boolean {
  const skill = skillPool.get(name);
  if (!skill || skill.source === 'builtin') return false;
  return skillPool.delete(name);
}

/**
 * 按来源移除所有技能。
 */
export function removeSkillsBySource(source: SkillSource): number {
  let count = 0;
  for (const [name, skill] of skillPool) {
    if (skill.source === source && skill.source !== 'builtin') {
      skillPool.delete(name);
      count++;
    }
  }
  return count;
}

/**
 * 按 sourceId 移除所有关联技能。
 */
export function removeSkillsBySourceId(sourceId: string): number {
  let count = 0;
  for (const [name, skill] of skillPool) {
    if (skill.sourceId === sourceId) {
      skillPool.delete(name);
      count++;
    }
  }
  return count;
}

/** 获取所有可用技能列表 */
export function getAllSkills(): SkillEntry[] {
  return Array.from(skillPool.values());
}

/** 获取技能名列表 */
export function getAllSkillNames(): string[] {
  return Array.from(skillPool.keys());
}

/** 按名称获取技能 */
export function getSkill(name: string): SkillEntry | undefined {
  return skillPool.get(name);
}

/** 按名称列表获取技能 */
export function getSkillsByNames(names: string[]): SkillEntry[] {
  return names.map(n => skillPool.get(n)).filter(Boolean) as SkillEntry[];
}

/** 检查技能是否存在 */
export function hasSkill(name: string): boolean {
  return skillPool.has(name);
}

/** 重置技能池（仅保留内置技能） */
export function resetSkillPool(): void {
  skillPool.clear();
  for (const skill of BUILTIN_SKILLS) {
    skillPool.set(skill.name, { ...skill });
  }
  _idCounter = 0;
}
