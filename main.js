const { app, BrowserWindow } = require('electron');
const path = require('path');
const os = require('os');

const startExpressServer = require('./app');
const fileUtils = require('./utils/file');
const { ensureDirExists } = require('./utils/file');
const { createWindow } = require('./utils/window');
const { registerIPC } = require('./utils/ipc');

let tabsFilePath;
const tabsDataRef = { value: [] };

app.whenReady().then(() => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.fhylabs.mwa');
  }
  
  startExpressServer();
  
  tabsFilePath = path.join(app.getPath('appData'), 'M-WA', 'tabs.json');

  ensureDirExists(path.dirname(tabsFilePath));
  registerIPC(tabsFilePath, tabsDataRef);
  createWindow(tabsFilePath, tabsDataRef.value);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(tabsFilePath, tabsDataRef.value);
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
