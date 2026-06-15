import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export function Sidebar() {
  const { t, i18n } = useTranslation();
  const loc = useLocation();
  const nav = useNavigate();
  const [collapsed, setCollapsed] = useState(false);

  const NAV = [
    { path: '/', label: t('nav.home'), icon: '◆' },
    { path: '/new', label: t('nav.newReview'), icon: '◇' },
    { path: '/monitor', label: t('nav.monitor'), icon: '◎' },
    { path: '/config', label: t('nav.config'), icon: '◈' },
    { path: '/history', label: t('nav.history'), icon: '◉' },
    { path: '/about', label: t('nav.about'), icon: '○' },
  ];

  const isActive = (path: string) =>
    path === '/' ? loc.pathname === '/' : loc.pathname.startsWith(path);

  const toggleLang = () => {
    const next = i18n.language === 'zh' ? 'en' : 'zh';
    i18n.changeLanguage(next);
  };

  return (
    <aside style={{
      width: collapsed ? 52 : 200,
      flexShrink: 0,
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'rgba(5,5,25,0.8)',
      backdropFilter: 'blur(32px)',
      WebkitBackdropFilter: 'blur(32px)',
      boxShadow: '1px 0 0 rgba(255,255,255,0.04), 4px 0 24px rgba(0,0,0,0.3)',
      position: 'relative',
      zIndex: 10,
      transition: 'width 300ms var(--ease-out-expo)',
      userSelect: 'none',
    }}>
      {/* macOS 拖拽区 */}
      <div style={{ height: 40, flexShrink: 0, WebkitAppRegion: 'drag' } as React.CSSProperties} />

      {/* Logo */}
      {!collapsed && (
        <div style={{ padding: '0 16px 20px' }}>
          <button
            onClick={() => nav('/')}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              textAlign: 'left',
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: '0.15em',
              backgroundImage: 'linear-gradient(135deg, #eef0ff, #b3bdf8, #8b5cf6)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            {t('home.studio')}
          </button>
        </div>
      )}

      {/* Navigation */}
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, padding: collapsed ? '0 10px' : '0 8px' }}>
        {NAV.map((item) => {
          const active = isActive(item.path);
          return (
            <button
              key={item.path}
              onClick={() => nav(item.path)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: collapsed ? '10px 0' : '10px 12px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: active ? 600 : 400,
                textDecoration: 'none',
                justifyContent: collapsed ? 'center' : 'flex-start',
                color: active ? 'rgba(237,240,255,0.95)' : 'rgba(180,190,230,0.40)',
                background: active ? 'rgba(79,108,247,0.10)' : 'transparent',
                position: 'relative',
                transition: 'all 150ms var(--ease-out-expo)',
                border: 'none',
                cursor: 'pointer',
                width: '100%',
              }}
            >
              {active && (
                <span style={{
                  position: 'absolute',
                  left: 0,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: 3,
                  height: 16,
                  borderRadius: '0 3px 3px 0',
                  background: 'linear-gradient(180deg, #4f6cf7, #d946ef)',
                }} />
              )}
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 18,
                height: 18,
                fontSize: 10,
                borderRadius: '50%',
                color: active ? 'rgba(200,210,245,0.9)' : 'rgba(255,255,255,0.20)',
                flexShrink: 0,
                transition: 'all 150ms var(--ease-out-expo)',
              }}>
                {item.icon}
              </span>
              {!collapsed && item.label}
            </button>
          );
        })}
      </nav>

      {/* Language switcher & footer */}
      {!collapsed && (
        <div style={{ padding: '16px 16px 24px' }}>
          <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)', marginBottom: 12 }} />
          <button
            onClick={toggleLang}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 10px',
              borderRadius: 6,
              border: 'none',
              background: 'rgba(255,255,255,0.03)',
              color: 'rgba(180,190,230,0.35)',
              fontSize: 10,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 150ms',
              marginBottom: 12,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
              e.currentTarget.style.color = 'rgba(200,210,245,0.6)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
              e.currentTarget.style.color = 'rgba(180,190,230,0.35)';
            }}
          >
            <span style={{ fontSize: 10 }}>{i18n.language === 'zh' ? 'EN' : '中'}</span>
            <span>{t('lang.switch')}</span>
          </button>
          <p style={{ fontSize: 10, color: 'rgba(180,190,230,0.25)', lineHeight: 1.4 }}>
            {t('home.footerHint')}
          </p>
        </div>
      )}

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        style={{
          position: 'absolute',
          right: -14,
          bottom: 80,
          width: 14,
          height: 48,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          background: 'rgba(15,15,40,0.9)',
          border: 'none',
          borderRadius: '0 8px 8px 0',
          boxShadow: '4px 0 12px rgba(0,0,0,0.3)',
          opacity: 0.5,
          transition: 'opacity 150ms',
          zIndex: 11,
        }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '0.5')}
        title={collapsed ? t('lang.switch') : ''}
      >
        <span style={{ fontSize: 8, color: 'rgba(200,210,245,0.6)', transform: collapsed ? 'none' : 'rotate(180deg)', transition: 'transform 300ms' }}>
          ◀
        </span>
      </button>
    </aside>
  );
}
