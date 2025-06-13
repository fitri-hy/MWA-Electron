const axios = require('axios');
const { dialog, nativeTheme, app, screen, Menu, BrowserWindow, shell } = require('electron');
const { clearAllData } = require('./tab');
const { createBotWindow } = require('./botWindow');
const { createAutoReplyWindow } = require('./autoReplyWindow');
const { createSettingWindow } = require('./settingWindow');
const { createAIWindow } = require('./aiWindow');
const { createNotesWindow } = require('./notesWindow');
const { createPosWindow } = require('./posWindow');

async function checkForUpdates(win, silent = false) {
  const releasesUrl = 'https://api.github.com/repos/fitri-hy/MWA-Electron/releases/latest';

  try {
    const response = await axios.get(releasesUrl);
    const latest = response.data;
    const latestVersion = latest.tag_name?.replace(/^v/, '');
    const releaseNotes = latest.body || 'No details provided.';
    const currentVersion = app.getVersion();

    if (latestVersion && latestVersion !== currentVersion) {
      const downloadUrl = latest.assets.length > 0 ? latest.assets[0].browser_download_url : null;

      const result = await dialog.showMessageBox(win, {
        type: 'info',
        buttons: ['Update Now', 'Later'],
        defaultId: 0,
        cancelId: 1,
        title: 'New Update Available',
        message: `M-WA has a new version: v${latestVersion}`,
        detail: `You're using version v${currentVersion}.\n\nChangelog:\n${releaseNotes}`,
        noLink: true,
      });

      if (result.response === 0 && downloadUrl) {
        shell.openExternal(downloadUrl);
      }
    } else if (!silent) {
      dialog.showMessageBox(win, {
        type: 'info',
        title: 'No Updates',
        message: 'You are already using the latest version.',
        buttons: ['OK'],
      });
    }
  } catch (err) {
    if (!silent) {
      dialog.showMessageBox(win, {
        type: 'error',
        title: 'Update Check Failed',
        message: 'Failed to check for updates. Please try again later.',
      });
    }
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
		  click: async () => {
			const result = await dialog.showMessageBox(win, {
			  type: 'info',
			  title: 'About',
			  message: 'M-WA is an Electron application that allows you to manage multiple WhatsApp accounts at once in one place. With multi-account bot features and auto-response management, M-WA helps automate WhatsApp conversations easily and efficiently.',
			  buttons: ['Visit GitHub', 'Close'],
			  defaultId: 0,
			});

			if (result.response === 0) {
			  shell.openExternal('https://github.com/fitri-hy');
			}
		  }
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
      label: 'POS',
      click: () => {
        createPosWindow();
      },
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
      label: 'Notes',
      click: () => {
        createNotesWindow();
      },
    },
    {
      label: 'AI',
      click: () => {
        createAIWindow();
      },
    },
	{
	  label: 'Check Updates',
	  click: () => checkForUpdates(win),
	},
  ];
}

module.exports = {
  menuApp, checkForUpdates
};
