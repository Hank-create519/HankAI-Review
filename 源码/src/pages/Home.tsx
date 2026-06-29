import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DotFieldBg from '../components/DotFieldBg';

export default function Home() {
  const nav = useNavigate();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const features = [
    {
      icon: '◇',
      title: '多角色辩论',
      desc: '8 AI 角色从不同维度交叉审查，发现单一视角无法察觉的盲区。',
    },
    {
      icon: '◎',
      title: '模板化审查',
      desc: '内置代码/合同/论文/商业计划等审查模板，开箱即用。',
    },
    {
      icon: '◈',
      title: '实时监控',
      desc: '辩论过程可视化，每轮论点追溯，随时暂停、干预、重定向。',
    },
  ];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100%',
        padding: '80px 32px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Dot Field Background */}
      <DotFieldBg dotRadius={1.2} dotSpacing={18} activeRadius={2.5} activeColor="#4DABF7" />

      {/* Hero */}
      <div
        style={{
          textAlign: 'center',
          maxWidth: 720,
          position: 'relative',
          zIndex: 1,
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0)' : 'translateY(24px)',
          transition: 'opacity 800ms cubic-bezier(0.16, 1, 0.3, 1), transform 800ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <h1
          style={{
            fontSize: 56,
            fontWeight: 700,
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
            marginBottom: 16,
            textShadow: '0 0 40px rgba(77,171,247,0.3)',
          }}
        >
          <span className="text-gradient">Hank Review</span>
        </h1>

        <p
          style={{
            fontSize: 18,
            color: 'var(--text-secondary)',
            lineHeight: 1.7,
            marginBottom: 40,
            maxWidth: 560,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          多 AI 角色交叉辩论审查引擎。让 8 个视角互相质疑、验证、补充，在最深层的对话中逼近真相。
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button
            className="btn btn-primary btn-lg"
            onClick={() => nav('/new')}
            style={{ boxShadow: '0 0 20px rgba(77,171,247,0.2)' }}
          >
            开始审查
          </button>
          <button className="btn btn-secondary btn-lg" onClick={() => nav('/config')}>
            配置引擎
          </button>
        </div>
      </div>

      {/* Feature Cards */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          maxWidth: 800,
          width: '100%',
          marginTop: 80,
          position: 'relative',
          zIndex: 1,
        }}
      >
        {features.map((f, i) => (
          <div
            key={i}
            className="glass-card"
            style={{
              padding: '28px 32px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 20,
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateY(0)' : 'translateY(16px)',
              transition: `all 500ms cubic-bezier(0.16, 1, 0.3, 1) ${0.1 + i * 0.08}s`,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.boxShadow =
                '0 4px 16px rgba(0,0,0,0.4), 0 0 30px rgba(77,171,247,0.12)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.boxShadow = '';
            }}
            onClick={() => nav('/new')}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'rgba(77,171,247,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20,
                color: 'var(--accent)',
                flexShrink: 0,
              }}
            >
              {f.icon}
            </div>
            <div>
              <h3
                style={{
                  fontSize: 17,
                  fontWeight: 600,
                  marginBottom: 4,
                  letterSpacing: '-0.01em',
                  color: 'var(--text-primary)',
                }}
              >
                {f.title}
              </h3>
              <p
                style={{
                  fontSize: 14,
                  color: 'var(--text-secondary)',
                  lineHeight: 1.6,
                }}
              >
                {f.desc}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
