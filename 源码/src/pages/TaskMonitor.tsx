import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface DebateMessage {
  id: string;
  role: string;
  roleLabel: string;
  content: string;
  timestamp: number;
}

const ROLE_COLORS: Record<string, string> = {
  extractor: '#007AFF',
  debater_a: '#FF9500',
  debater_b: '#34C759',
  integrator: '#AF52DE',
  arbiter: '#FF3B30',
};

export default function TaskMonitor() {
  const nav = useNavigate();
  const [messages, setMessages] = useState<DebateMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMessages([
        {
          id: '1',
          role: 'extractor',
          roleLabel: '提取器',
          content: '正在检索相关资料...已定位 3 个关键信息来源，正在提取核心论点。',
          timestamp: Date.now() - 120000,
        },
        {
          id: '2',
          role: 'debater_a',
          roleLabel: '辩论方A',
          content: '从安全性角度分析，该方案存在以下隐患：权限模型过于宽松，数据加密未覆盖传输层。',
          timestamp: Date.now() - 90000,
        },
        {
          id: '3',
          role: 'debater_b',
          roleLabel: '辩论方B',
          content: '反对。当前的安全措施在同类产品中已属领先，风险可控。建议补充传输层加密后即可达标。',
          timestamp: Date.now() - 60000,
        },
        {
          id: '4',
          role: 'integrator',
          roleLabel: '汇总',
          content: '双方核心分歧在于风险容忍度。正方强调 Zero Trust 原则，反方指出行业基准已满足。建议补充传输加密作为折中方案。',
          timestamp: Date.now() - 30000,
        },
      ]);
      setLoading(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        className="glass-card"
        style={{
          margin: '24px 32px 0',
          padding: '20px 28px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          borderRadius: 20,
        }}
      >
        <button
          className="btn btn-ghost"
          onClick={() => nav('/')}
          style={{ padding: '6px 10px', fontSize: 16 }}
        >
          ← 返回
        </button>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.01em' }}>
            审查进行中
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
            Q3 合同审查 · 第 2 轮辩论
          </p>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 14px',
            borderRadius: 20,
            background: 'rgba(52, 199, 89, 0.1)',
            color: 'var(--accent-green)',
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: 'var(--accent-green)',
              animation: 'dot-pulse 1.4s cubic-bezier(0.16, 1, 0.3, 1) infinite',
            }}
          />
          进行中
        </div>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '24px 32px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {loading ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 16,
            }}
          >
            <div className="dot-loader">
              <span />
              <span />
              <span />
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
              AI 角色正在分析内容...
            </p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={msg.id}
              className="glass-card"
              style={{
                padding: '20px 24px',
                borderLeft: `3px solid ${ROLE_COLORS[msg.role] || 'var(--accent)'}`,
                animation: `fade-up 500ms cubic-bezier(0.16, 1, 0.3, 1) ${i * 0.08}s both`,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: 10,
                }}
              >
                <span
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: `${ROLE_COLORS[msg.role]}20`,
                    color: ROLE_COLORS[msg.role],
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  {msg.roleLabel?.[0] || '?'}
                </span>
                <span
                  style={{
                    fontWeight: 600,
                    fontSize: 14,
                    color: ROLE_COLORS[msg.role],
                  }}
                >
                  {msg.roleLabel || msg.role}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                  {new Date(msg.timestamp).toLocaleTimeString('zh-CN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </span>
              </div>
              <p
                style={{
                  fontSize: 14,
                  color: 'var(--text-secondary)',
                  lineHeight: 1.7,
                }}
              >
                {msg.content}
              </p>
            </div>
          ))
        )}

        {!loading && (
          <div
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
            }}
          >
            <div className="dot-loader">
              <span />
              <span />
              <span />
            </div>
            <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
              等待下一轮辩论...
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
