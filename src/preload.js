const { contextBridge, ipcRenderer, clipboard } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
	newTab: () => ipcRenderer.invoke('new-tab'),
	switchTab: (id) => ipcRenderer.invoke('switch-tab', id),
	reloadTab: (id) => ipcRenderer.invoke('reload-tab', id),
	closeTab: (id) => ipcRenderer.invoke('close-tab', id),
	onAddTab: (cb) => ipcRenderer.on('add-tab', (e, data) => cb(data)),
	onRemoveTab: (cb) => ipcRenderer.on('remove-tab', (e, id) => cb(id)),
	onTabLoading: (cb) => ipcRenderer.on('tab-loading', (e, data) => cb(data)),
	onThemeUpdated: (callback) => ipcRenderer.on('theme-updated', callback),
});

contextBridge.exposeInMainWorld('productAPI', {
	onThemeUpdated: (callback) => ipcRenderer.on('theme-updated', callback),
	getProducts: () => ipcRenderer.invoke('get-products'),
	addProduct: (product) => ipcRenderer.invoke('add-product', product),
	updateProduct: (product) => ipcRenderer.invoke('update-product', product),
	deleteProduct: (id) => ipcRenderer.invoke('delete-product', id)
});

contextBridge.exposeInMainWorld('api', {
  copyToClipboard: (text) => {
    clipboard.writeText(text);
  }
});