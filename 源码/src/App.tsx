import { HashRouter, Routes, Route } from 'react-router-dom';
import { ReviewEngineProvider } from './sdk/react';
import { Sidebar } from './components/Sidebar';
import ThemeToggle from './components/ThemeToggle';
import Home from './pages/Home';
import Config from './pages/Config';
import TaskNew from './pages/TaskNew';
import TaskMonitor from './pages/TaskMonitor';
import History from './pages/History';
import About from './pages/About';
import { useEffect } from 'react';
import { setPersistHandler } from './sdk/engine';
import { useReviewEngine } from './sdk/react';
import { useReviewStore } from './store/reviewStore';
import { loadConfigs, loadTasks, saveTask, saveOutputs, saveReport, updateConfig } from './hooks/useDB';
import { createDefaultAIConfigs } from './types';

function AppInit() {
  const { loadConfigs: setConfigs, setHistory, configs: storeConfigs } = useReviewStore();
  const { updateConfigs } = useReviewEngine();

  useEffect(() => {
    (async () => {
      const configs = await loadConfigs();
      if (configs.length > 0) {
        setConfigs(configs);
        updateConfigs(configs);
      } else {
        // DB 无数据或不可用，用默认配置种子
        const defaults = storeConfigs.length > 0 ? storeConfigs : createDefaultAIConfigs();
        setConfigs(defaults);
        updateConfigs(defaults);
        if (window.electronAPI?.db) {
          for (const c of defaults) {
            await updateConfig(c.roleKey, c);
          }
        }
      }
      const tasks = await loadTasks();
      if (tasks.length > 0) setHistory(tasks);
    })();
  }, []);

  useEffect(() => {
    setPersistHandler((action, data) => {
      if (!window.electronAPI?.db) return;
      switch (action) {
        case 'task': saveTask(data); break;
        case 'outputs': saveOutputs(data); break;
        case 'report': saveReport(data); break;
      }
    });
  }, []);

  return null;
}

function AmbientOrbs() {
  return (
    <>
      <div style={{
        position: 'fixed', top: '20%', left: '80%', width: '600px', height: '600px',
        background: 'radial-gradient(ellipse at center, rgba(79,108,247,0.16) 0%, rgba(139,92,246,0.10) 30%, transparent 70%)',
        filter: 'blur(60px)', pointerEvents: 'none', zIndex: 0,
        animation: 'orb-rotate 20s linear infinite',
      }} />
      <div style={{
        position: 'fixed', top: '60%', left: '30%', width: '500px', height: '500px',
        background: 'radial-gradient(ellipse at center, rgba(217,70,239,0.14) 0%, rgba(139,92,246,0.08) 30%, transparent 70%)',
        filter: 'blur(50px)', pointerEvents: 'none', zIndex: 0,
        animation: 'orb-rotate 25s linear infinite reverse',
      }} />
      <div style={{
        position: 'fixed', top: '10%', left: '50%', width: '400px', height: '400px',
        background: 'radial-gradient(ellipse at center, rgba(79,108,247,0.12) 0%, transparent 60%)',
        filter: 'blur(40px)', pointerEvents: 'none', zIndex: 0,
        animation: 'orb-pulse 6s ease-in-out infinite',
      }} />
    </>
  );
}

function AppLayout() {
  return (
    <div style={{ height: '100%', display: 'flex', background: 'var(--space-deepest)', position: 'relative' }}>
      <AmbientOrbs />
      {/* <ParticleField /> */}
      <Sidebar />
      <main style={{ flex: 1, overflow: 'hidden', position: 'relative', zIndex: 2 }}>
        <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 20 }}>
          <ThemeToggle />
        </div>
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
