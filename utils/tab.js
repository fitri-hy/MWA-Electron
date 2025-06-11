const { session, BrowserWindow, app } = require('electron');
const { removeFile } = require('./file');

async function clearAllData(tabsFilePath, tabsData) {
  try {
    removeFile(tabsFilePath);
    await session.defaultSession.clearStorageData();

    for (const tab of tabsData) {
      try {
        const ses = session.fromPartition(`persist:${tab.id}`);
        await ses.clearStorageData();
      } catch (e) {
        console.warn(`Failed to clear session for tab ${tab.id}:`, e);
      }
    }

    BrowserWindow.getAllWindows().forEach(win => win.destroy());

    app.relaunch();
    app.exit(0);
  } catch (err) {
    console.error('Failed to clear all data:', err);
  }
}

module.exports = {
  clearAllData,
};
