// Hank个人工作室 AI审查系统 · Preload (Context Bridge)
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // === 安全存储 ===
  setSecureKey: (roleKey, apiKey) => ipcRenderer.invoke('secure:set-key', roleKey, apiKey),
  getSecureKey: (roleKey) => ipcRenderer.invoke('secure:get-key', roleKey),
  deleteSecureKey: (roleKey) => ipcRenderer.invoke('secure:delete-key', roleKey),

  // === 数据库操作 ===
  db: {
    getConfigs: () => ipcRenderer.invoke('db:get-configs'),
    updateConfig: (roleKey, patch) => ipcRenderer.invoke('db:update-config', roleKey, patch),
    getTasks: () => ipcRenderer.invoke('db:get-tasks'),
    saveTask: (task) => ipcRenderer.invoke('db:save-task', task),
    updateTask: (id, status, errorMessage) => ipcRenderer.invoke('db:update-task', id, status, errorMessage),
    deleteTask: (id) => ipcRenderer.invoke('db:delete-task', id),
    saveOutputs: (outputs) => ipcRenderer.invoke('db:save-outputs', outputs),
    getOutputs: (taskId) => ipcRenderer.invoke('db:get-outputs', taskId),
    saveReport: (report) => ipcRenderer.invoke('db:save-report', report),
    getReport: (taskId) => ipcRenderer.invoke('db:get-report', taskId),
  },
});

// === DOM 级粘贴拦截（精简测试版） ===
document.addEventListener('keydown', (e) => {
  if ((e.key === 'v' || e.key === 'V') && (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
    const target = document.activeElement;
    const isEditable = target && (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    );
    if (!isEditable) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    ipcRenderer.invoke('clipboard:readText').then((text) => {
      if (text) {
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
          const start = target.selectionStart ?? 0;
          const end = target.selectionEnd ?? 0;
          target.setRangeText(text, start, end, 'end');
          target.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
          document.execCommand('insertText', false, text);
        }
      }
    }).catch((err) => console.error('[Preload] paste failed:', err));
  }
}, true);
