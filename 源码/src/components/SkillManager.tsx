// Hank个人工作室 AI审查系统 · 技能管理界面 v1.0

import { useState, useEffect, useCallback } from 'react';
import { useReviewEngine } from '../sdk/react';
import { getAllSkills, removeSkillsBySourceId } from '../skills/skillManager';
import { importFromGitHub } from '../skills/githubImporter';
import { DEFAULT_SYSTEM_PROMPTS } from '../types';
import type { AIConfig, DataSource, GitHubRepo, DatabaseConnection, SkillEntry, SkillAssignmentSnapshot } from '../types';

// ============ Agent 角色定义 ============

interface AgentRole {
  roleKey: string;
  roleName: string;
  assignable: boolean; // 是否可分配技能
}

const AGENT_ROLES: AgentRole[] = [
  { roleKey: 'extractor', roleName: '信息提取器', assignable: true },
  { roleKey: 'extractor2', roleName: '辅助提取器', assignable: true },
  { roleKey: 'debate_ai1', roleName: '审查AI-1', assignable: true },
  { roleKey: 'debate_ai2', roleName: '审查AI-2', assignable: true },
  { roleKey: 'debate_ai3', roleName: '审查AI-3', assignable: true },
  { roleKey: 'integrator', roleName: '辩论汇总员', assignable: true },
  { roleKey: 'round_judge', roleName: '轮次裁判', assignable: false },
  { roleKey: 'final_integrator', roleName: '最终报告员', assignable: true },
];

// ============ 来源图标映射 ============

function SourceBadge({ source }: { source: SkillEntry['source'] }) {
  const map: Record<string, { icon: string; color: string; label: string }> = {
    builtin: { icon: '🏠', color: '#4f6cf7', label: '内置' },
    github: { icon: '🐙', color: '#6e5494', label: 'GitHub' },
    database: { icon: '🗄️', color: '#10b981', label: '数据库' },
  };
  const info = map[source] || { icon: '?', color: '#888', label: source };
  return (
    <span
      title={info.label}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 20, height: 20, borderRadius: 4, fontSize: 11,
        background: `${info.color}22`, flexShrink: 0,
      }}
    >
      {info.icon}
    </span>
  );
}

// ============ 主组件 ============

export default function SkillManager() {
  const { configs, updateConfigs } = useReviewEngine();

  // 数据源列表
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  // 技能池（从 skillManager 读取）
  const [skills, setSkills] = useState<SkillEntry[]>([]);
  // 分配矩阵: roleKey -> Set<skillName>
  const [assignments, setAssignments] = useState<Record<string, Set<string>>>({});
  // 弹窗状态
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [dsType, setDsType] = useState<'github' | 'database'>('github');
  // GitHub 表单
  const [ghUrl, setGhUrl] = useState('');
  const [ghToken, setGhToken] = useState('');
  // 数据库表单（占位）
  const [dbType, setDbType] = useState('mysql');
  const [dbHost, setDbHost] = useState('');
  const [dbPort, setDbPort] = useState('3306');
  const [dbName, setDbName] = useState('');
  const [dbUser, setDbUser] = useState('');
  const [dbPass, setDbPass] = useState('');
  // 导入状态
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  // 预览 prompt
  const [previewRole, setPreviewRole] = useState<string | null>(null);

  // 初始化：从 configs 推导当前分配矩阵
  useEffect(() => {
    updateFromConfigs(configs);
  }, [configs]);

  // 刷新技能列表
  const refreshSkills = useCallback(() => {
    setSkills(getAllSkills());
  }, []);

  useEffect(() => {
    refreshSkills();
  }, [refreshSkills]);

  function updateFromConfigs(cfgs: AIConfig[]) {
    const map: Record<string, Set<string>> = {};
    for (const c of cfgs) {
      map[c.roleKey] = new Set(c.skills || []);
    }
    for (const role of AGENT_ROLES) {
      if (!map[role.roleKey]) map[role.roleKey] = new Set();
    }
    setAssignments(map);
  }

  // 切换分配
  function toggleAssignment(roleKey: string, skillName: string) {
    setAssignments(prev => {
      const next = { ...prev };
      const set = new Set(next[roleKey] || []);
      if (set.has(skillName)) {
        set.delete(skillName);
      } else {
        set.add(skillName);
      }
      next[roleKey] = set;
      return next;
    });
  }

  // 生成预览的 systemPrompt
  function generatePreviewPrompt(roleKey: string): string {
    const role = AGENT_ROLES.find(r => r.roleKey === roleKey);
    if (!role) return '';

    const basePrompt = DEFAULT_SYSTEM_PROMPTS[roleKey] || '';
    const assigned = assignments[roleKey];
    if (!assigned || assigned.size === 0) {
      // 无技能时移除工具使用指引段
      return removeToolGuidanceSection(basePrompt);
    }

    const skillList = Array.from(assigned);
    const guidanceText = generateToolGuidance(roleKey, skillList);

    // 替换或添加工具使用指引
    return replaceToolGuidanceSection(basePrompt, guidanceText);
  }

  // 移除提示词中的"工具使用指引"段落
  function removeToolGuidanceSection(prompt: string): string {
    return prompt.replace(/工具使用指引：[\s\S]*?(?=\n\n|$)/, '').trim();
  }

  // 生成工具使用指引
  function generateToolGuidance(_roleKey: string, skillNames: string[]): string {
    const lines: string[] = ['工具使用指引：'];
    const hasSearch = skillNames.includes('web_search');
    const hasFetch = skillNames.includes('web_fetch');
    const hasReadFile = skillNames.includes('read_file');
    const hasPython = skillNames.includes('python_exec');

    if (hasSearch) {
      lines.push('- 当需要查找最新信息、核实事实或补充行业数据时，使用 web_search 工具联网搜索');
    }
    if (hasFetch) {
      lines.push('- 当搜索结果中有需要深入阅读的文章/报告时，使用 web_fetch 工具抓取网页详细内容');
    }
    if (hasReadFile) {
      lines.push('- 当需要读取本地文件内容进行参考分析时，使用 read_file 工具');
    }
    if (hasPython) {
      lines.push('- 当需要执行数据分析、计算或处理时，使用 python_exec 工具在沙箱中执行 Python 代码');
    }

    // 额外技能
    const extraSkills = skillNames.filter(
      n => !['web_search', 'web_fetch', 'read_file', 'python_exec'].includes(n),
    );
    for (const sk of extraSkills) {
      lines.push(`- 当任务涉及相关领域时，使用 ${sk} 工具`);
    }

    return lines.join('\n');
  }

  // 替换提示词中的"工具使用指引"段落
  function replaceToolGuidanceSection(prompt: string, newGuidance: string): string {
    if (prompt.includes('工具使用指引：')) {
      return prompt.replace(/工具使用指引：[\s\S]*?(?=\n\n|$)/, newGuidance);
    }
    // 不存在则追加
    return prompt + '\n\n' + newGuidance;
  }

  // 应用配置
  function handleApply() {
    const newConfigs = configs.map(c => {
      const assigned = assignments[c.roleKey];
      if (!assigned) return c;

      const skillNames = Array.from(assigned);
      const newPrompt = replaceToolGuidanceSection(
        c.systemPrompt,
        generateToolGuidance(c.roleKey, skillNames),
      );

      return { ...c, skills: skillNames, systemPrompt: newPrompt };
    });

    updateConfigs(newConfigs);
    alert('配置已应用！各 Agent 的 systemPrompt 和 skills 已更新。');
  }

  // 导出配置
  function handleExport() {
    const snapshot: SkillAssignmentSnapshot = {
      version: 1,
      exportedAt: new Date().toISOString(),
      dataSources,
      assignments: Object.fromEntries(
        Object.entries(assignments).map(([k, v]) => [k, Array.from(v)]),
      ),
    };

    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hankai-skill-config-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // 导入配置
  function handleImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const snapshot: SkillAssignmentSnapshot = JSON.parse(text);
        if (snapshot.version !== 1) throw new Error('不支持的配置版本');

        const map: Record<string, Set<string>> = {};
        for (const [roleKey, skills] of Object.entries(snapshot.assignments)) {
          map[roleKey] = new Set(skills);
        }
        setAssignments(map);
        if (snapshot.dataSources) setDataSources(snapshot.dataSources);

        alert('配置导入成功！请点击"应用配置"使其生效。');
      } catch (err) {
        alert(`导入失败: ${err instanceof Error ? err.message : '无效的 JSON 文件'}`);
      }
    };
    input.click();
  }

  // 添加数据源
  async function handleAddDataSource() {
    if (dsType === 'github') {
      if (!ghUrl.trim()) {
        setImportError('请输入 GitHub 仓库 URL');
        return;
      }
      setImporting(true);
      setImportError(null);
      try {
        const result = await importFromGitHub(ghUrl.trim(), ghToken || undefined);
        const newDS: GitHubRepo = {
          type: 'github',
          id: result.sourceId,
          url: ghUrl.trim(),
          token: ghToken || undefined,
          label: result.repoLabel,
        };
        setDataSources(prev => [...prev, newDS]);
        refreshSkills();
        // 新技能自动加入所有可分配 Agent
        const newNames = result.skills.map(s => s.name);
        setAssignments(prev => {
          const next = { ...prev };
          for (const role of AGENT_ROLES) {
            if (!role.assignable) continue;
            const set = new Set(next[role.roleKey] || []);
            for (const name of newNames) {
              set.add(name);
            }
            next[role.roleKey] = set;
          }
          return next;
        });
        setShowAddDialog(false);
        resetForm();
      } catch (err) {
        setImportError(err instanceof Error ? err.message : '导入失败');
      } finally {
        setImporting(false);
      }
    } else {
      // 数据库占位
      const id = `db_${Date.now()}`;
      const newDS: DatabaseConnection = {
        type: 'database',
        id,
        dbType,
        host: dbHost,
        port: parseInt(dbPort, 10) || 3306,
        database: dbName,
        username: dbUser,
        password: dbPass,
        label: `${dbType}://${dbHost}:${dbPort}/${dbName}`,
      };
      setDataSources(prev => [...prev, newDS]);
      setShowAddDialog(false);
      resetForm();
    }
  }

  function resetForm() {
    setGhUrl('');
    setGhToken('');
    setDbType('mysql');
    setDbHost('');
    setDbPort('3306');
    setDbName('');
    setDbUser('');
    setDbPass('');
    setImportError(null);
  }

  // 删除数据源
  function handleRemoveDataSource(ds: DataSource) {
    if (ds.type === 'github') {
      removeSkillsBySourceId(ds.id);
      refreshSkills();
      // 清理分配矩阵中已移除的技能
      setAssignments(prev => {
        const next = { ...prev };
        for (const role of AGENT_ROLES) {
          const validSkills = getAllSkills();
          const validNames = new Set(validSkills.map(s => s.name));
          next[role.roleKey] = new Set(
            Array.from(prev[role.roleKey] || []).filter(n => validNames.has(n)),
          );
        }
        return next;
      });
    }
    setDataSources(prev => prev.filter(d => d.id !== ds.id));
  }

  // ============ 渲染 ============

  const assignableRoles = AGENT_ROLES.filter(r => r.assignable);
  // 只展示有实际内容的行列
  const displaySkills = skills.filter(s => {
    // 检查是否至少有一个 agent 分配了此技能
    return assignableRoles.some(r => assignments[r.roleKey]?.has(s.name));
  });

  return (
    <div style={{ height: '100%', overflowY: 'auto' }}>
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '48px 40px' }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 8 }}>
          技能管理
        </h2>
        <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', fontWeight: 500, marginBottom: 32 }}>
          管理技能来源，配置各 Agent 可用的工具
        </p>

        {/* ===== 数据源管理 ===== */}
        <SectionLabel label="数据源管理" />
        <div style={{ marginBottom: 24 }}>
          {dataSources.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {dataSources.map(ds => (
                <DataSourceCard key={ds.id} ds={ds} onRemove={() => handleRemoveDataSource(ds)} />
              ))}
            </div>
          )}
          <button
            onClick={() => setShowAddDialog(true)}
            className="btn btn-secondary"
            style={{ fontSize: 12, padding: '6px 14px' }}
          >
            + 添加数据源
          </button>
        </div>

        {/* ===== 添加数据源对话框 ===== */}
        {showAddDialog && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              background: 'var(--space-deepest)', borderRadius: 'var(--radius-md)',
              border: '1px solid rgba(255,255,255,0.08)', padding: 28, width: 460,
              maxHeight: '80vh', overflowY: 'auto',
            }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>添加数据源</h3>

              {/* 类型选择 */}
              <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.08em', marginBottom: 8 }}>
                数据源类型
              </label>
              <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                {(['github', 'database'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setDsType(t)}
                    style={{
                      flex: 1, padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                      border: dsType === t ? '1px solid rgba(79,108,247,0.4)' : '1px solid rgba(255,255,255,0.06)',
                      background: dsType === t ? 'rgba(79,108,247,0.12)' : 'transparent',
                      color: 'var(--text-primary)', fontSize: 12, cursor: 'pointer',
                      transition: 'all 150ms',
                    }}
                  >
                    {t === 'github' ? '🐙 GitHub 仓库' : '🗄️ 数据库'}
                  </button>
                ))}
              </div>

              {dsType === 'github' && (
                <>
                  <Label text="仓库 URL" />
                  <Input
                    value={ghUrl}
                    onChange={setGhUrl}
                    placeholder="https://github.com/user/repo"
                  />
                  <Label text="Token（可选，私有仓库必填）" />
                  <Input
                    value={ghToken}
                    onChange={setGhToken}
                    type="password"
                    placeholder="ghp_xxxxxxxxxxxx"
                  />
                </>
              )}

              {dsType === 'database' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <Label text="数据库类型" />
                      <Select value={dbType} onChange={setDbType} options={['mysql', 'postgresql', 'mongodb', 'sqlite']} />
                    </div>
                    <div>
                      <Label text="端口" />
                      <Input value={dbPort} onChange={setDbPort} placeholder="3306" />
                    </div>
                  </div>
                  <Label text="主机" />
                  <Input value={dbHost} onChange={setDbHost} placeholder="localhost" />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <Label text="数据库名" />
                      <Input value={dbName} onChange={setDbName} placeholder="mydb" />
                    </div>
                    <div>
                      <Label text="用户名" />
                      <Input value={dbUser} onChange={setDbUser} placeholder="root" />
                    </div>
                  </div>
                  <Label text="密码" />
                  <Input value={dbPass} onChange={setDbPass} type="password" placeholder="密码" />
                </>
              )}

              {importError && (
                <div style={{ fontSize: 12, color: 'var(--err)', marginBottom: 12, padding: '8px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: 'var(--radius-sm)' }}>
                  {importError}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => { setShowAddDialog(false); resetForm(); }}
                  className="btn btn-secondary"
                  style={{ fontSize: 12, padding: '6px 14px' }}
                >
                  取消
                </button>
                <button
                  onClick={handleAddDataSource}
                  disabled={importing}
                  className="btn btn-primary"
                  style={{ fontSize: 12, padding: '6px 14px' }}
                >
                  {importing ? '导入中...' : (dsType === 'github' ? '导入技能' : '添加')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===== 技能-Agent 分配矩阵 ===== */}
        <SectionLabel label="技能分配矩阵" />

        {displaySkills.length === 0 ? (
          <div style={{
            padding: '32px 16px', textAlign: 'center', fontSize: 13,
            color: 'var(--text-tertiary)', border: '1px dashed rgba(255,255,255,0.06)',
            borderRadius: 'var(--radius-md)', marginBottom: 24,
          }}>
            暂无可用技能。请先添加数据源导入外部技能，或勾选下方内置技能分配给 Agent。
          </div>
        ) : (
          <div style={{ overflowX: 'auto', marginBottom: 24 }}>
            <table style={{
              width: '100%', borderCollapse: 'collapse', fontSize: 12,
            }}>
              <thead>
                <tr>
                  <th style={thStyle}>技能</th>
                  {assignableRoles.map(r => (
                    <th key={r.roleKey} style={{ ...thStyle, textAlign: 'center', minWidth: 56 }}>
                      {r.roleName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displaySkills.map((sk, idx) => (
                  <tr
                    key={sk.name}
                    style={{
                      background: idx % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
                    }}
                  >
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <SourceBadge source={sk.source} />
                        <span style={{ fontWeight: 500 }}>{sk.name}</span>
                      </div>
                    </td>
                    {assignableRoles.map(role => (
                      <td key={role.roleKey} style={{ ...tdStyle, textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={assignments[role.roleKey]?.has(sk.name) || false}
                          onChange={() => toggleAssignment(role.roleKey, sk.name)}
                          style={{ accentColor: '#4f6cf7', cursor: 'pointer' }}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 内置技能（始终展示，即使未被分配） */}
        <div style={{ marginBottom: 8 }}>
          <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.08em' }}>
            内置技能
          </span>
        </div>
        <div style={{
          display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24,
          padding: '12px', borderRadius: 'var(--radius-sm)',
          border: '1px solid rgba(255,255,255,0.04)',
        }}>
          {skills.filter(s => s.source === 'builtin').map(sk => (
            <div
              key={sk.name}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '4px 10px', borderRadius: 'var(--radius-sm)',
                background: 'rgba(79,108,247,0.08)', fontSize: 12,
                color: 'var(--text-secondary)',
              }}
            >
              <SourceBadge source="builtin" />
              <span>{sk.name}</span>
            </div>
          ))}
        </div>

        {/* ===== 预览面板 ===== */}
        {previewRole && (
          <div style={{
            marginBottom: 24, padding: 16, borderRadius: 'var(--radius-md)',
            border: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(255,255,255,0.015)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.06em' }}>
                预览 {AGENT_ROLES.find(r => r.roleKey === previewRole)?.roleName || previewRole} 的 systemPrompt
              </span>
              <button
                onClick={() => setPreviewRole(null)}
                style={{ fontSize: 11, color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
            <pre style={{
              fontSize: 11, lineHeight: 1.5, color: 'var(--text-secondary)',
              whiteSpace: 'pre-wrap', fontFamily: 'ui-monospace, SF Mono, monospace',
              maxHeight: 200, overflowY: 'auto',
            }}>
              {generatePreviewPrompt(previewRole)}
            </pre>
          </div>
        )}

        <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
          {assignableRoles.map(r => (
            <button
              key={r.roleKey}
              onClick={() => setPreviewRole(previewRole === r.roleKey ? null : r.roleKey)}
              className="btn btn-secondary"
              style={{
                fontSize: 11, padding: '4px 10px',
                background: previewRole === r.roleKey ? 'rgba(79,108,247,0.15)' : undefined,
              }}
            >
              {r.roleName} 预览
            </button>
          ))}
        </div>

        {/* ===== 操作按钮 ===== */}
        <SectionLabel label="操作" />
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={handleApply} className="btn btn-primary" style={{ fontSize: 13, padding: '8px 18px' }}>
            应用配置
          </button>
          <button onClick={handleExport} className="btn btn-secondary" style={{ fontSize: 13, padding: '8px 18px' }}>
            导出配置
          </button>
          <button onClick={handleImport} className="btn btn-secondary" style={{ fontSize: 13, padding: '8px 18px' }}>
            导入配置
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ 子组件 ============

function SectionLabel({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0 12px' }}>
      <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
        {label}
      </span>
      <div style={{
        flex: 1, height: 1,
        background: 'linear-gradient(90deg, rgba(79,108,247,0.15), rgba(139,92,246,0.06), transparent)',
      }} />
    </div>
  );
}

function DataSourceCard({ ds, onRemove }: { ds: DataSource; onRemove: () => void }) {
  const icon = ds.type === 'github' ? '🐙' : '🗄️';
  const typeLabel = ds.type === 'github' ? 'GitHub' : '数据库';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 14px', borderRadius: 'var(--radius-sm)',
      border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.015)',
      fontSize: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 14 }}>{icon}</span>
        <span style={{ color: 'var(--text-secondary)', fontSize: 10, fontWeight: 600 }}>{typeLabel}</span>
        <span style={{ color: 'var(--text-primary)' }}>{ds.label}</span>
      </div>
      <button
        onClick={onRemove}
        style={{
          fontSize: 11, color: 'var(--err)', opacity: 0.5, border: 'none',
          background: 'transparent', cursor: 'pointer',
        }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '0.5')}
      >
        删除
      </button>
    </div>
  );
}

function Label({ text }: { text: string }) {
  return (
    <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.08em', marginBottom: 4, marginTop: 12 }}>
      {text}
    </label>
  );
}

function Input({ value, onChange, placeholder, type }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <input
      type={type || 'text'}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="input"
      style={{ fontSize: 13, padding: '7px 10px', width: '100%' }}
    />
  );
}

function Select({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="input"
      style={{ fontSize: 13, padding: '7px 10px', width: '100%' }}
    >
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

// ============ 表格样式 ============

const thStyle: React.CSSProperties = {
  padding: '10px 12px',
  textAlign: 'left',
  fontSize: 10,
  fontWeight: 600,
  color: 'var(--text-tertiary)',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  borderBottom: '1px solid rgba(255,255,255,0.06)',
};

const tdStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderBottom: '1px solid rgba(255,255,255,0.03)',
  color: 'var(--text-secondary)',
};
