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
