const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
	newTab: () => ipcRenderer.invoke('new-tab'),
	switchTab: (id) => ipcRenderer.send('switch-tab', id),
	reloadTab: (id) => ipcRenderer.invoke('reload-tab', id),
	closeTab: (id) => ipcRenderer.send('close-tab', id),
	onAddTab: (cb) => ipcRenderer.on('add-tab', (e, data) => cb(data)),
	onRemoveTab: (cb) => ipcRenderer.on('remove-tab', (e, id) => cb(id)),
	onTabLoading: (cb) => ipcRenderer.on('tab-loading', (e, data) => cb(data))
});
