import { useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from '../App';

export function Sidebar() {
  const loc = useLocation();
  const nav = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const NAV = [
    { path: '/', icon: '◆', label: '审查大厅' },
    { path: '/new', icon: '◇', label: '新建审查' },
    { path: '/monitor', icon: '◎', label: '审查监控' },
    { path: '/config', icon: '◈', label: '引擎配置' },
    { path: '/history', icon: '◉', label: '历史记录' },
    { path: '/about', icon: '○', label: '关于' },
  ];

  const isActive = (path: string) =>
    path === '/' ? loc.pathname === '/' : loc.pathname.startsWith(path);

  return (
    <aside
      style={{
        position: 'fixed',
        left: 8,
        top: 8,
        bottom: 8,
        width: 56,
        zIndex: 50,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '10px 0',
        borderRadius: 20,
        background: 'var(--bg-card)',
        backdropFilter: 'blur(40px) saturate(180%)',
        WebkitBackdropFilter: 'blur(40px) saturate(180%)',
        border: '1px solid var(--border)',
        userSelect: 'none',
      }}
    >
      {/* Logo */}
      <button
        onClick={() => nav('/')}
        title="HankAI"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          marginBottom: 24,
        }}
      >
        <span
          style={{
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: '-0.03em',
            background: 'linear-gradient(135deg, var(--accent), var(--accent-secondary))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          H
        </span>
      </button>

      {/* Navigation */}
      <nav
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
        }}
      >
        {NAV.map((item) => {
          const active = isActive(item.path);
          return (
            <button
              key={item.path}
              onClick={() => nav(item.path)}
              title={item.label}
              style={{
                width: 36,
                height: 36,
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                cursor: 'pointer',
                border: 'none',
                background: active
                  ? 'rgba(0, 122, 255, 0.15)'
                  : 'transparent',
                color: active
                  ? 'var(--accent)'
                  : 'var(--text-tertiary)',
                transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.color = 'var(--text-secondary)';
                  e.currentTarget.style.background = 'var(--bg-card-hover)';
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.color = 'var(--text-tertiary)';
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              {item.icon}
            </button>
          );
        })}
      </nav>

      {/* Theme Toggle */}
      <button
        onClick={toggleTheme}
        title={theme === 'dark' ? '切换浅色模式' : '切换深色模式'}
        style={{
          width: 36,
          height: 36,
          borderRadius: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 14,
          cursor: 'pointer',
          border: 'none',
          background: 'transparent',
          color: 'var(--text-tertiary)',
          transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
          marginTop: 4,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--text-secondary)';
          e.currentTarget.style.background = 'var(--bg-card-hover)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--text-tertiary)';
          e.currentTarget.style.background = 'transparent';
        }}
      >
        {theme === 'dark' ? '☀' : '🌙'}
      </button>
    </aside>
  );
}
