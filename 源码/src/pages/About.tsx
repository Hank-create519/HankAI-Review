import { useTranslation } from 'react-i18next';

export default function About() {
  const { t } = useTranslation();

  return (
    <div style={{ height: '100%', overflowY: 'auto' }}>
      <div style={{ maxWidth: 560, margin: '0 auto', padding: '60px 40px' }} className="anim-up">
        <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 8 }}>
          {t('about.title')}
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginBottom: 48, lineHeight: 1.6 }}>
          {t('about.subtitle')}
        </p>

        <div className="glass" style={{ padding: '24px 28px', marginBottom: 16 }}>
          <h3 style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 20 }}>
            {t('about.contact')}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)', minWidth: 40 }}>{t('about.email')}</span>
              <a
                href="mailto:hanjienie119@gmail.com"
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: '#8b9cf7',
                  textDecoration: 'none',
                  transition: 'color 150ms',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = '#b3c1ff')}
                onMouseLeave={e => (e.currentTarget.style.color = '#8b9cf7')}
              >
                hanjienie119@gmail.com
              </a>
            </div>
          </div>

          <div style={{ marginTop: 20, padding: '16px', borderRadius: 8, background: 'rgba(79,108,247,0.04)', border: '1px solid rgba(79,108,247,0.08)' }}>
            <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              {t('about.note')}
            </p>
          </div>
        </div>

        <div className="glass" style={{ padding: '20px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{t('about.version')}</span>
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>1.0.0</span>
          </div>
        </div>

        <p style={{ fontSize: 10, color: 'rgba(180,190,230,0.25)', textAlign: 'center', marginTop: 32 }}>
          {t('about.copyright')}
        </p>
      </div>
    </div>
  );
}
