import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function Home() {
  const nav = useNavigate();
  const { t } = useTranslation();

  const cards = [
    { title: t('home.card1Title'), desc: t('home.card1Desc') },
    { title: t('home.card2Title'), desc: t('home.card2Desc') },
    { title: t('home.card3Title'), desc: t('home.card3Desc') },
  ];

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      padding: '60px 48px 40px',
      overflow: 'auto',
    }}>
      {/* Hero */}
      <div style={{ maxWidth: 680, marginBottom: 64 }} className="anim-up">
        {/* Badge */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 14px',
          borderRadius: 100,
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.1em',
          color: 'rgba(139,156,247,0.8)',
          background: 'rgba(79,108,247,0.08)',
          border: '1px solid rgba(79,108,247,0.12)',
          marginBottom: 28,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4f6cf7', boxShadow: '0 0 8px rgba(79,108,247,0.5)' }} />
          {t('home.badge')}
        </div>

        <h1 style={{
          fontSize: 'clamp(60px, 8vw, 88px)',
          fontWeight: 700,
          lineHeight: 1.05,
          letterSpacing: '-0.03em',
          marginBottom: 20,
        }}>
          <span className="text-gradient">{t('home.studio')}</span>
        </h1>

        <p style={{
          fontSize: 15,
          fontWeight: 500,
          color: 'var(--text-secondary)',
          letterSpacing: '0.06em',
          marginBottom: 8,
        }}>
          {t('home.system')}
        </p>

        <p style={{
          fontSize: 13,
          color: 'var(--text-tertiary)',
          lineHeight: 1.6,
          maxWidth: 480,
          marginBottom: 36,
        }}>
          {t('home.subtitle')}
        </p>

        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={() => nav('/new')}
            style={{
              padding: '10px 28px',
              borderRadius: 10,
              border: 'none',
              fontSize: 13,
              fontWeight: 600,
              color: '#fff',
              background: 'linear-gradient(135deg, #4f6cf7, #8b5cf6)',
              boxShadow: '0 4px 20px rgba(79,108,247,0.3)',
              cursor: 'pointer',
              transition: 'transform 150ms var(--ease-out-expo), box-shadow 150ms var(--ease-out-expo)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'scale(1.03)';
              e.currentTarget.style.boxShadow = '0 6px 28px rgba(79,108,247,0.45)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.boxShadow = '0 4px 20px rgba(79,108,247,0.3)';
            }}
          >
            {t('home.startBtn')}
          </button>
          <button
            onClick={() => nav('/config')}
            style={{
              padding: '10px 24px',
              borderRadius: 10,
              border: 'none',
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--text-secondary)',
              background: 'rgba(255,255,255,0.04)',
              boxShadow: '0 0 0 1px rgba(255,255,255,0.06)',
              cursor: 'pointer',
              transition: 'all 150ms var(--ease-out-expo)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.07)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            {t('home.configBtn')}
          </button>
        </div>
      </div>

      {/* Bottom cards */}
      <div style={{ width: '100%', maxWidth: 680, animationDelay: '0.15s' } as React.CSSProperties} className="anim-up">
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12,
        }}>
          {cards.map((card, i) => (
            <div
              key={card.title}
              className="glass anim-up"
              style={{
                padding: '20px 16px',
                textAlign: 'left',
                cursor: 'default',
                animationDelay: `${0.2 + i * 0.06}s`,
              }}
            >
              <span style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'rgba(139,156,247,0.7)',
                letterSpacing: '0.08em',
                display: 'block',
                marginBottom: 8,
              }}>
                {card.title}
              </span>
              <p style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
                {card.desc}
              </p>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 24 }}>
          <div className="divider" />
          <p style={{
            fontSize: 10,
            color: 'rgba(180,190,230,0.25)',
            letterSpacing: '0.1em',
            textAlign: 'center',
            marginTop: 12,
          }}>
            {t('home.footerHint')}
          </p>
        </div>
      </div>
    </div>
  );
}
