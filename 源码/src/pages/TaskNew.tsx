import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReviewEngine } from '../sdk/react';

const TEMPLATES = [
  { id: 'general', name: '通用审查', icon: '◇', desc: '适用于任何文本的通用多角度审查', systemPrompt: '' },
  { id: 'code', name: '代码审查', icon: '</>', desc: '安全性/性能/可维护性/最佳实践', systemPrompt: '请从安全性、性能、可维护性、代码规范四个维度审查以下代码。' },
  { id: 'contract', name: '合同审查', icon: '§', desc: '法律风险/权利义务/履约保障', systemPrompt: '请从法律风险、权利义务平衡、履约保障、争议解决四个维度审查以下合同。' },
  { id: 'paper', name: '论文审查', icon: '¶', desc: '逻辑/方法/论证/创新性', systemPrompt: '请从逻辑严谨性、方法论、论证结构、创新贡献四个维度审查以下论文。' },
];

export default function TaskNew() {
  const nav = useNavigate();
  const engine = useReviewEngine();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [template, setTemplate] = useState('general');
  const [isRunning, setIsRunning] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80);
    return () => clearTimeout(t);
  }, []);

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim() || isRunning) return;
    setIsRunning(true);
    try {
      const tmpl = TEMPLATES.find((t) => t.id === template);
      const fullContent = tmpl?.systemPrompt
        ? `${tmpl.systemPrompt}\n\n---\n\n${content.trim()}`
        : content.trim();
      await engine.startReview(title.trim(), fullContent);
      nav('/monitor');
    } catch (e) {
      console.error('Create task failed:', e);
    } finally {
      setIsRunning(false);
    }
  };

  const stg = (i: number) => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'translateY(0)' : 'translateY(20px)',
    transition: `all 500ms cubic-bezier(0.16, 1, 0.3, 1) ${0.08 + i * 0.06}s`,
  });

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        padding: '48px 32px',
        minHeight: '100%',
      }}
    >
      <div style={{ width: '100%', maxWidth: 720 }}>
        {/* Header */}
        <div style={{ marginBottom: 36, ...stg(0) }}>
          <button
            onClick={() => nav('/')}
            className="btn btn-ghost"
            style={{ marginBottom: 16, padding: '6px 10px', fontSize: 16 }}
          >
            ← 返回
          </button>
          <h1
            style={{
              fontSize: 32,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              marginBottom: 8,
            }}
          >
            新建审查
          </h1>
          <p style={{ fontSize: 15, color: 'var(--text-secondary)' }}>
            选择一个模板，输入需要审查的内容，引擎将启动 8 AI 多轮辩论。
          </p>
        </div>

        {/* Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {/* Title */}
          <div style={stg(1)}>
            <label
              style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                marginBottom: 8,
              }}
            >
              任务标题
            </label>
            <input
              className="glass-input"
              style={{ fontSize: 16, padding: '12px 16px' }}
              placeholder="输入任务标题，如「Q3 合同审查」"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isRunning}
            />
          </div>

          {/* Template Selector */}
          <div style={stg(2)}>
            <label
              style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                marginBottom: 12,
              }}
            >
              审查模板
            </label>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 12,
              }}
            >
              {TEMPLATES.map((tmpl) => {
                const active = template === tmpl.id;
                return (
                  <button
                    key={tmpl.id}
                    onClick={() => setTemplate(tmpl.id)}
                    disabled={isRunning}
                    className="glass-card"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 8,
                      padding: '20px 12px',
                      cursor: isRunning ? 'not-allowed' : 'pointer',
                      opacity: isRunning ? 0.5 : 1,
                      borderRadius: 16,
                      border: active
                        ? '1.5px solid var(--accent)'
                        : '1px solid var(--border)',
                      background: active
                        ? 'rgba(0, 122, 255, 0.06)'
                        : 'var(--bg-card)',
                      color: 'var(--text-primary)',
                      fontFamily: 'inherit',
                      fontSize: 13,
                      textAlign: 'center',
                      transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                  >
                    <span style={{ fontSize: 22 }}>{tmpl.icon}</span>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>
                      {tmpl.name}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        color: 'var(--text-tertiary)',
                        lineHeight: 1.4,
                      }}
                    >
                      {tmpl.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content */}
          <div style={stg(3)}>
            <label
              style={{
                display: 'block',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                marginBottom: 8,
              }}
            >
              审查内容
            </label>
            <textarea
              className="glass-input"
              style={{
                minHeight: 220,
                fontSize: 14,
                padding: '16px',
                lineHeight: 1.7,
                resize: 'vertical',
              }}
              placeholder="粘贴或输入需要审查的文本内容..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={isRunning}
            />
          </div>

          {/* Actions */}
          <div
            style={{
              ...stg(4),
              display: 'flex',
              gap: 12,
              justifyContent: 'flex-end',
            }}
          >
            <button
              className="btn btn-ghost"
              onClick={() => nav('/')}
              disabled={isRunning}
            >
              取消
            </button>
            <button
              className="btn btn-primary"
              style={{ padding: '12px 28px', fontSize: 15 }}
              onClick={handleSubmit}
              disabled={!title.trim() || !content.trim() || isRunning}
            >
              {isRunning ? '创建中...' : '开始审查'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
