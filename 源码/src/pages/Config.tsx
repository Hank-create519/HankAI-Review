import { useState, useEffect, useRef } from 'react';
import { useReviewEngine } from '../sdk/react';
import { PROVIDER_DEFAULTS } from '../types';
import { updateConfig } from '../hooks/useDB';
import { useTranslation } from 'react-i18next';
import SkillManager from '../components/SkillManager';
import type { AIConfig } from '../types';

const PROVIDERS: { key: string; label: string }[] = [
  { key: 'openai', label: 'OpenAI' },
  { key: 'anthropic', label: 'Anthropic' },
  { key: 'google', label: 'Gemini' },
  { key: 'deepseek', label: 'DeepSeek' },
  { key: 'zhipu', label: '智谱' },
  { key: 'moonshot', label: 'Moonshot' },
  { key: 'baichuan', label: '百川' },
  { key: 'qwen', label: '通义千问' },
  { key: 'wenxin', label: '文心一言' },
  { key: 'custom', label: '自定义' },
];

interface SkillOption { key: string; label: string; }

function getRoleSkillOptions(roleKey: string): SkillOption[] {
  const ALL_SKILLS: SkillOption[] = [
    { key: 'web_search', label: '联网搜索' },
    { key: 'web_fetch', label: '网页抓取' },
    { key: 'fact_check', label: '事实核查' },
    { key: 'logical_fallacy_check', label: '逻辑谬误检测' },
    { key: 'data_audit', label: '数据审计' },
    { key: 'source_credibility', label: '来源可信度' },
    { key: 'counter_example_search', label: '反例搜索' },
    { key: 'bias_detector', label: '偏差检测' },
  ];

  if (roleKey === 'extractor' || roleKey === 'extractor2') {
    return ALL_SKILLS.filter(s => s.key === 'web_search' || s.key === 'web_fetch');
  }
  if (
    roleKey === 'debate_ai1' || roleKey === 'debate_ai2' || roleKey === 'debate_ai3' ||
    roleKey.startsWith('ai_debate_')
  ) {
    return ALL_SKILLS;
  }
  if (roleKey === 'integrator' || roleKey === 'final_integrator') {
    return ALL_SKILLS.filter(s => s.key === 'web_search');
  }
  return [];
}

type ConfigTab = 'basic' | 'skills';

export default function Config() {
  const { t } = useTranslation();
  const { configs, updateConfigs } = useReviewEngine();
  const [openRole, setOpenRole] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ConfigTab>('basic');

  const persistTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const persistConfig = (rk: string, p: Partial<AIConfig>) => {
    const existing = persistTimers.current.get(rk);
    if (existing) clearTimeout(existing);
    persistTimers.current.set(rk, setTimeout(() => {
      updateConfig(rk, p);
      persistTimers.current.delete(rk);
    }, 500));
  };

  const up = (rk: string, p: Partial<AIConfig>) => {
    updateConfigs(configs.map(c => c.roleKey === rk ? { ...c, ...p } : c));
    persistConfig(rk, p);
  };
  const upAll = (cs: AIConfig[]) => updateConfigs(cs);

  // 从现有 configs 推导下一个 debate 编号，避免模块级变量刷新重置导致 roleKey 冲突
  const nextDebateNum = Math.max(
    3,
    ...configs
      .filter(c => c.phase === 'debate' && c.roleKey.startsWith('ai_debate_'))
      .map(c => parseInt(c.roleKey.replace('ai_debate_', ''), 10) || 0)
  ) + 1;

  const addDebater = () => {
    const maxId = configs.reduce((m, c) => Math.max(m, c.id), 0);
    const newAI: AIConfig = {
      id: maxId + 1,
      roleKey: `ai_debate_${nextDebateNum}`,
      roleName: t('config.customAi', { n: nextDebateNum }),
      phase: 'debate',
      provider: 'custom',
      apiKey: '',
      baseUrl: 'https://api.openai.com/v1',
      modelName: 'gpt-4o',
      temperature: 0.3,
      maxTokens: 4096,
      isEnabled: true,
      systemPrompt: t('config.customSystemPrompt'),
      enableWebSearch: false,
      skills: [],
    };
    upAll([...configs, newAI]);
    setOpenRole(newAI.roleKey);
  };

  const removeDebater = (rk: string) => {
    upAll(configs.filter(c => c.roleKey !== rk));
    if (openRole === rk) setOpenRole(null);
  };

  const debateCount = configs.filter(c => c.phase === 'debate').length;

  if (activeTab === 'skills') {
    return <SkillManager />;
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto' }}>
      <div style={{ maxWidth: 580, margin: '0 auto', padding: '48px 40px' }}>
        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 32, borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          {([
            { key: 'basic' as ConfigTab, label: '基础配置' },
            { key: 'skills' as ConfigTab, label: '技能管理' },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '8px 16px',
                fontSize: 13,
                fontWeight: activeTab === tab.key ? 600 : 400,
                color: activeTab === tab.key ? 'var(--text-primary)' : 'var(--text-tertiary)',
                border: 'none',
                borderBottom: activeTab === tab.key ? '2px solid #007AFF' : '2px solid transparent',
                background: 'transparent',
                cursor: 'pointer',
                transition: 'all 150ms',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 40 }} className="anim-up">
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em', marginBottom: 4 }}>
              {t('config.title')}
            </h2>
            <p style={{ fontSize: 12.5, color: 'var(--text-tertiary)', fontWeight: 500 }}>
              {t('config.debateAiCount', { count: debateCount })}
            </p>
          </div>
          <button onClick={addDebater} className="btn btn-secondary" style={{ fontSize: 12, padding: '6px 14px' }}>
            {t('config.addDebate')}
          </button>
        </div>

        {/* Prep layer */}
        <SectionLabel label={t('config.preparation')} />
        <div>
        {configs.filter(c => c.phase === 'prep').map((cfg, i) => (
          <div key={cfg.roleKey} className="anim-up" style={{ animationDelay: `${i * 0.04}s` } as React.CSSProperties}>
            <ConfigCard cfg={cfg} isOpen={openRole === cfg.roleKey}
              onToggle={() => setOpenRole(openRole === cfg.roleKey ? null : cfg.roleKey)}
              onUpdate={up} isFixed />
          </div>
        ))}
        </div>

        {/* Debate layer */}
        <SectionLabel label={t('config.debateLayerDesc', { count: debateCount })} />
        <div>
        {configs.filter(c => c.phase === 'debate').map((cfg, i) => (
          <div key={cfg.roleKey} className="anim-up" style={{ animationDelay: `${i * 0.04}s` } as React.CSSProperties}>
            <ConfigCard cfg={cfg} isOpen={openRole === cfg.roleKey}
              onToggle={() => setOpenRole(openRole === cfg.roleKey ? null : cfg.roleKey)}
              onUpdate={up} isFixed={false}
              onRemove={() => removeDebater(cfg.roleKey)} canRemove={configs.filter(c => c.phase === 'debate').length > 1} />
          </div>
        ))}
        {configs.filter(c => c.phase === 'debate_summarizer').map((cfg, i) => (
          <div key={cfg.roleKey} className="anim-up" style={{ animationDelay: `${(configs.filter(c => c.phase === 'debate').length + i) * 0.04}s` } as React.CSSProperties}>
            <ConfigCard cfg={cfg} isOpen={openRole === cfg.roleKey}
              onToggle={() => setOpenRole(openRole === cfg.roleKey ? null : cfg.roleKey)}
              onUpdate={up} isFixed />
          </div>
        ))}
        </div>

        {/* Summary layer */}
        <SectionLabel label={t('config.summary')} />
        <div>
        {configs.filter(c => c.phase === 'summary').map((cfg, i) => (
          <div key={cfg.roleKey} className="anim-up" style={{ animationDelay: `${i * 0.04}s` } as React.CSSProperties}>
            <ConfigCard cfg={cfg} isOpen={openRole === cfg.roleKey}
              onToggle={() => setOpenRole(openRole === cfg.roleKey ? null : cfg.roleKey)}
              onUpdate={up} isFixed />
          </div>
        ))}
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0 12px' }}>
      <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
        {label}
      </span>
      <div style={{
        flex: 1, height: 1,
        background: 'linear-gradient(90deg, rgba(0,122,255,0.15), rgba(88,86,214,0.06), transparent)',
      }} />
    </div>
  );
}

function ConfigCard({
  cfg, isOpen, onToggle, onUpdate, isFixed, onRemove, canRemove,
}: {
  cfg: AIConfig; isOpen: boolean; onToggle: () => void;
  onUpdate: (rk: string, p: Partial<AIConfig>) => void;
  isFixed: boolean; onRemove?: () => void; canRemove?: boolean;
}) {
  const { t } = useTranslation();
  const [apiKeyLoaded, setApiKeyLoaded] = useState(false);
  const [keyValue, setKeyValue] = useState('');

  useEffect(() => {
    const load = async () => {
      if (window.electronAPI && cfg.roleKey) {
        const key = await window.electronAPI.getSecureKey(cfg.roleKey);
        if (key) {
          setKeyValue(key);
          onUpdate(cfg.roleKey, { apiKey: key });
        }
        setApiKeyLoaded(true);
      } else {
        setKeyValue(cfg.apiKey || '');
        setApiKeyLoaded(true);
      }
    };
    load();
  }, []);

  const handleKeyChange = async (newKey: string) => {
    setKeyValue(newKey);
    if (window.electronAPI && cfg.roleKey) {
      if (newKey) {
        await window.electronAPI.setSecureKey(cfg.roleKey, newKey);
      } else {
        await window.electronAPI.deleteSecureKey(cfg.roleKey);
      }
    }
    onUpdate(cfg.roleKey, { apiKey: newKey });
  };

  const hasKey = keyValue && keyValue !== 'demo';

  if (!apiKeyLoaded) {
    return (
      <div className="glass" style={{ marginBottom: 8, padding: '10px 16px' }}>
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{t('config.loading')}</span>
      </div>
    );
  }

  return (
    <div style={{
      marginBottom: 8,
      borderRadius: 'var(--radius-md)',
      border: isOpen ? '1px solid rgba(0,122,255,0.20)' : '1px solid rgba(0,0,0,0.04)',
      transition: 'all 250ms var(--ease-out-expo)',
      boxShadow: isOpen ? '0 0 20px rgba(0,122,255,0.08)' : 'none',
    }}>
      <div style={{
        borderRadius: 'var(--radius-md)',
        background: isOpen
          ? 'linear-gradient(180deg, rgba(0,122,255,0.06) 0%, rgba(255,255,255,0.85) 100%)'
          : 'rgba(0,0,0,0.015)',
        transition: 'background 250ms var(--ease-out-expo)',
      }}>
        <button
          onClick={onToggle}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 16px', textAlign: 'left', cursor: 'pointer',
            border: 'none', background: 'transparent',
            borderRadius: 'var(--radius-md)',
            color: 'inherit',
            transition: 'background 150ms',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.01)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
        >
          <span style={{ fontSize: 10, fontWeight: 500, color: 'var(--text-tertiary)', width: 28, flexShrink: 0 }}>
            {isFixed ? `#${cfg.id}` : '⚡'}
          </span>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <input
              type="text"
              value={cfg.roleName}
              onChange={e => { e.stopPropagation(); onUpdate(cfg.roleKey, { roleName: e.target.value }); }}
              onClick={e => e.stopPropagation()}
              style={{
                width: '100%', background: 'transparent', border: 'none', outline: 'none',
                fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', letterSpacing: '-0.01em',
              }}
            />
            {cfg.systemPrompt && (
              <span style={{
                fontSize: 10, color: 'var(--text-tertiary)', lineHeight: 1.3,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                maxWidth: '100%',
              }}>
                {cfg.systemPrompt.replace(/\n/g, ' ').slice(0, 60)}{cfg.systemPrompt.length > 60 ? '…' : ''}
              </span>
            )}
          </div>
          <span style={{ fontSize: 10.5, fontWeight: 500, color: hasKey ? 'var(--text-secondary)' : 'var(--text-tertiary)', flexShrink: 0 }}>
            {hasKey ? (PROVIDERS.find(p => p.key === cfg.provider)?.label || cfg.provider) : t('config.unconfigured')}
          </span>
          <span
            className={`status-dot ${hasKey ? 'active' : 'idle'}`}
            style={hasKey ? undefined : { background: '#54545a', animation: 'none' }}
          />
          <span style={{
            fontSize: 10, color: 'var(--text-tertiary)',
            transform: isOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform 300ms',
          }}>▼</span>
          {!isFixed && onRemove && canRemove && (
            <button
              onClick={e => { e.stopPropagation(); onRemove(); }}
              style={{
                fontSize: 10, color: 'var(--err)', opacity: 0.5, border: 'none', background: 'transparent',
                cursor: 'pointer', marginLeft: 4,
                transition: 'opacity 150ms',
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '0.5')}
            >{t('config.delete')}</button>
          )}
        </button>

        {isOpen && (
          <div
            className="config-card-content open"
            style={{ borderTop: '1px solid rgba(0,0,0,0.02)' }}
          >
            <div>
            <div style={{ padding: '0 16px 20px', paddingTop: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.08em', marginBottom: 6 }}>
                      {t('config.provider')}
                    </label>
                    <select
                      value={cfg.provider}
                      onChange={e => {
                        const d = PROVIDER_DEFAULTS[e.target.value];
                        onUpdate(cfg.roleKey, { provider: e.target.value, baseUrl: d?.baseUrl || '', modelName: d?.modelName || '' });
                      }}
                      className="input" style={{ fontSize: 13, padding: '7px 10px' }}
                    >
                      {PROVIDERS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.08em', marginBottom: 6 }}>
                      {t('config.model')}
                    </label>
                    <input
                      type="text" value={cfg.modelName}
                      onChange={e => onUpdate(cfg.roleKey, { modelName: e.target.value })}
                      className="input" style={{ fontSize: 13, padding: '7px 10px' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.08em', marginBottom: 6 }}>
                    {t('config.apiKey')} {window.electronAPI ? t('config.secure') : ''}
                  </label>
                  <input
                    type="password"
                    value={keyValue}
                    onChange={e => handleKeyChange(e.target.value)}
                    placeholder={t('config.apiKeyPlaceholder')}
                    className="input" style={{ fontSize: 13, padding: '7px 10px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.08em', marginBottom: 6 }}>
                    {t('config.baseUrl')}
                  </label>
                  <input
                    type="text" value={cfg.baseUrl}
                    onChange={e => onUpdate(cfg.roleKey, { baseUrl: e.target.value })}
                    className="input" style={{ fontSize: 13, padding: '7px 10px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.08em', marginBottom: 6 }}>
                    {t('config.temperature')} · {cfg.temperature}
                  </label>
                  <input
                    type="range" min="0" max="2" step="0.1" value={cfg.temperature}
                    onChange={e => onUpdate(cfg.roleKey, { temperature: parseFloat(e.target.value) })}
                    style={{ width: '100%', accentColor: '#007AFF', height: 3 }}
                  />
                </div>

                {cfg.roleKey !== 'round_judge' && (() => {
                  const skillOpts = getRoleSkillOptions(cfg.roleKey);
                  if (skillOpts.length === 0) return null;
                  const cur = cfg.skills || [];
                  return (
                    <div>
                      <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.08em', marginBottom: 6 }}>
                        Skills · 工具
                      </label>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        {skillOpts.map(sk => (
                          <label key={sk.key} style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer',
                          }}>
                            <input
                              type="checkbox"
                              checked={cur.includes(sk.key)}
                              onChange={e => {
                                const next = e.target.checked
                                  ? [...cur, sk.key]
                                  : cur.filter(k => k !== sk.key);
                                onUpdate(cfg.roleKey, { skills: next });
                              }}
                              style={{ accentColor: '#007AFF' }}
                            />
                            {sk.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                <div>
                  <label style={{ display: 'block', fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.08em', marginBottom: 6 }}>
                    {t('config.systemPrompt')}
                  </label>
                  <textarea
                    value={cfg.systemPrompt} rows={isFixed ? 5 : 6}
                    onChange={e => onUpdate(cfg.roleKey, { systemPrompt: e.target.value })}
                    className="input"
                    style={{
                      fontSize: 12, lineHeight: 1.6, resize: 'vertical', padding: '8px 10px',
                      fontFamily: 'ui-monospace, SF Mono, monospace', minHeight: 80,
                    }}
                    placeholder={isFixed ? '' : t('config.systemPromptPlaceholder')}
                  />
                </div>
              </div>
            </div>
            </div>
          </div>
        )}

        <div style={{
          padding: '8px 16px',
          borderTop: '1px solid rgba(0,0,0,0.02)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{t('config.enabled')}</span>
          <label style={{ position: 'relative', display: 'inline-block', width: 32, height: 18, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={cfg.isEnabled}
              onChange={e => onUpdate(cfg.roleKey, { isEnabled: e.target.checked })}
              style={{ opacity: 0, width: 0, height: 0 }}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
