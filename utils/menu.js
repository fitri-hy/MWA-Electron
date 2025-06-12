const axios = require('axios');
const { dialog, nativeTheme, app, screen, Menu, BrowserWindow, shell } = require('electron');
const { clearAllData } = require('./tab');
const { createBotWindow } = require('./botWindow');
const { createAutoReplyWindow } = require('./autoReplyWindow');
const { createSettingWindow } = require('./settingWindow');

async function checkForUpdates(win) {
  const releasesUrl = 'https://api.github.com/repos/fitri-hy/MWA-Electron/releases/latest';
  
  try {
    const response = await axios.get(releasesUrl);
    const latest = response.data;
    const latestVersion = latest.tag_name;
    const releaseNotes = latest.body || 'No details provided.';
    const currentVersion = app.getVersion();

    if (latestVersion !== currentVersion) {
      const downloadUrl = latest.assets.length > 0 ? latest.assets[0].browser_download_url : null;

      const result = await dialog.showMessageBox(win, {
        type: 'info',
        buttons: ['Download', 'Cancel'],
        defaultId: 0,
        cancelId: 1,
        title: 'Update Available',
        message: `Latest version available: ${latestVersion}\nCurrent version: ${currentVersion}\n\nChangelog:\n${releaseNotes}\n\nDo you want to download the update?`,
      });

      if (result.response === 0 && downloadUrl) {
        shell.openExternal(downloadUrl);
      }
    } else {
      dialog.showMessageBox(win, {
        type: 'info',
        message: 'The application is already using the latest version.',
      });
    }
  } catch (err) {
    dialog.showMessageBox(win, {
      type: 'error',
      message: `Failed to check for updates.`,
    });
  }
}

function menuApp(win, tabsFilePath, tabsData) {
  return [
    {
      label: 'File',
      submenu: [
        {
          label: 'Clear All Data',
          click: async () => {
            const result = await dialog.showMessageBox({
              type: 'warning',
              buttons: ['Cancel', 'Clear'],
              defaultId: 1,
              cancelId: 0,
              title: 'Clear All Data',
              message: 'Are you sure you want to clear all data? This will reset all tabs and sessions.',
              noLink: true,
            });
            if (result.response === 1) {
              clearAllData(tabsFilePath, tabsData);
            }
          },
        },
		{
          label: 'Theme',
          accelerator: 'CmdOrCtrl+D',
          click: () => {
            nativeTheme.themeSource = nativeTheme.shouldUseDarkColors ? 'light' : 'dark';
            win.webContents.send('toggle-dark-mode', nativeTheme.shouldUseDarkColors);
          },
        },
		{
          label: 'Fullscreen',
          accelerator: process.platform === 'darwin' ? 'Ctrl+Command+F' : 'F11',
          click: () => win.setFullScreen(!win.isFullScreen()),
        },
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: () => win.reload() },
//        {
//          label: 'Developer Tools',
//          accelerator: process.platform === 'darwin' ? 'Alt+Command+I' : 'Ctrl+Shift+I',
//          click: () => win.webContents.toggleDevTools(),
//        },
		{
          label: 'About', accelerator: 'CmdOrCtrl+I',
          click: () =>
            dialog.showMessageBox(win, {
              type: 'info',
              title: 'About',
              message: 'M-WA is an Electron application that allows you to manage multiple WhatsApp accounts at once in one place. With multi-account bot features and auto-response management, M-WA helps automate WhatsApp conversations easily and efficiently.',
            }),
        },
		{
		  label: 'Setting', accelerator: 'CmdOrCtrl+S',
		  click: () => {
			createSettingWindow();
		  },
		},
        { label: 'Exit', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() },
      ],
    },
    {
      label: 'Bot',
      click: () => {
        createBotWindow();
      },
    },
    {
      label: 'Auto Reply',
      click: () => {
        createAutoReplyWindow();
      },
    },
	{
	  label: 'Check Updates',
	  click: () => checkForUpdates(win),
	},
  ];
}

module.exports = {
  menuApp,
};
