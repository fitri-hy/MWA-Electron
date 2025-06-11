const { ipcMain, nativeTheme } = require('electron');
const { readJSON, writeJSON } = require('./file');

function registerIPC(tabsFilePath, tabsDataRef) {
  ipcMain.handle('save-tabs', async (event, tabs) => {
    try {
      tabsDataRef.value = tabs;
      writeJSON(tabsFilePath, tabsDataRef.value);
      return true;
    } catch (err) {
      console.error('Failed to save tabs:', err);
      return false;
    }
  });

  ipcMain.handle('load-tabs', async () => {
    try {
      const data = readJSON(tabsFilePath);
      tabsDataRef.value = Array.isArray(data) ? data : [];
      return tabsDataRef.value;
    } catch (err) {
      console.error('Failed to load tabs:', err);
      return [];
    }
  });

  ipcMain.on('update-tab-session', (event, { tabId, session }) => {
    if (!tabId || !session) return;
    const tab = tabsDataRef.value.find(t => t.id === tabId);
    if (!tab) return;
    tab.session = { ...tab.session, ...session };

    try {
      writeJSON(tabsFilePath, tabsDataRef.value);
    } catch (err) {
      console.error('Failed to save updated session for tab:', err);
    }
  });

  ipcMain.on('set-dark-mode-preference', (event, isDark) => {
    nativeTheme.themeSource = isDark ? 'dark' : 'light';
  });
}

module.exports = { registerIPC };
