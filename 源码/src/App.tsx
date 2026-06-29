import { useState, useEffect, createContext, useContext } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { ReviewEngineProvider } from './sdk/react';
import { Sidebar } from './components/Sidebar';
import StarfieldBg from './components/StarfieldBg';
import Home from './pages/Home';
import Config from './pages/Config';
import TaskNew from './pages/TaskNew';
import TaskMonitor from './pages/TaskMonitor';
import History from './pages/History';
import About from './pages/About';

type Theme = 'dark' | 'light';

export const ThemeContext = createContext<{
  theme: Theme;
  toggleTheme: () => void;
}>({ theme: 'dark', toggleTheme: () => {} });

export const useTheme = () => useContext(ThemeContext);

function AppInit() {
  return null;
}

function AppLayout() {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('hank-review-theme');
    return (saved === 'light' || saved === 'dark') ? saved : 'dark';
  });

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('hank-review-theme', next);
      return next;
    });
  };

  useEffect(() => {
    document.documentElement.classList.toggle('theme-light', theme === 'light');
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <div
        style={{
          height: '100%',
          background: 'var(--bg-primary)',
          position: 'relative',
          transition: 'background 400ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <StarfieldBg />
        <Sidebar />
        <main
          style={{
            height: '100%',
            marginLeft: 68,
            padding: 0,
            position: 'relative',
            zIndex: 1,
            overflow: 'auto',
          }}
        >
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/new" element={<TaskNew />} />
            <Route path="/monitor" element={<TaskMonitor />} />
            <Route path="/config" element={<Config />} />
            <Route path="/history" element={<History />} />
            <Route path="/about" element={<About />} />
          </Routes>
        </main>
      </div>
    </ThemeContext.Provider>
  );
}

export default function App() {
  return (
    <HashRouter>
      <ReviewEngineProvider>
        <AppInit />
        <AppLayout />
      </ReviewEngineProvider>
    </HashRouter>
  );
}
