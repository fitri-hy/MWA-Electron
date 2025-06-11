const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  saveTabs: (tabs) => ipcRenderer.invoke('save-tabs', tabs),
  loadTabs: () => ipcRenderer.invoke('load-tabs'),
  sendDarkModePreference: (isDark) => ipcRenderer.send('set-dark-mode-preference', isDark),
  onToggleDarkMode: (callback) => ipcRenderer.on('toggle-dark-mode', callback),
  onOnlineStatusChange: (callback) => {
    window.addEventListener('online', () => callback(true));
    window.addEventListener('offline', () => callback(false));
  },
});
