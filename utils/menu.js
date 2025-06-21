const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');
const AdmZip = require('adm-zip');

const { dialog, nativeTheme, app, screen, Menu, BrowserWindow, shell } = require('electron');
const { clearAllTab } = require('./tab');
const { resetAllData } = require('./file');
const { createBotWindow } = require('./botWindow');
const { createAutoReplyWindow } = require('./autoReplyWindow');
const { createSettingWindow } = require('./settingWindow');
const { createAIWindow } = require('./aiWindow');
const { createNotesWindow } = require('./notesWindow');
const { createPosWindow } = require('./posWindow');
const { createDocsWindow } = require('./docsWindow');

const homeDir = os.homedir();
const configDir = path.join(homeDir, '.config', 'M-WA');
const downloadsDir = path.join(homeDir, 'Downloads');
const backupFileName = `mwa-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.zip`;
const zipFilePath = path.join(downloadsDir, backupFileName);

function backupPosFolder() {
  try {
    if (!fs.existsSync(configDir)) {
      dialog.showErrorBox('Backup Failed', `Config directory not found:\n${configDir}`);
      return false;
    }
    const zip = new AdmZip();
    zip.addLocalFolder(configDir);
    zip.writeZip(zipFilePath);
    dialog.showMessageBox({
      type: 'info',
      title: 'Backup Successful',
      message: `Backup saved to:\n${zipFilePath}`,
      buttons: ['Open Folder', 'OK']
    }).then(result => {
      if (result.response === 0) {
        shell.showItemInFolder(zipFilePath);
      }
    });
    return true;
  } catch (err) {
    console.error('Backup failed:', err);
    dialog.showErrorBox('Backup Failed', err.message || 'Unknown error');
    return false;
  }
}

async function restorePosFolder(win) {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Select Backup ZIP File',
    defaultPath: downloadsDir,
    filters: [
      { name: 'ZIP Files', extensions: ['zip'] }
    ],
    properties: ['openFile']
  });

  if (canceled || filePaths.length === 0) return false;

  const selectedZip = filePaths[0];
  try {
    if (fs.existsSync(configDir)) {
      fs.rmSync(configDir, { recursive: true, force: true });
    }
    const zip = new AdmZip(selectedZip);
    zip.extractAllTo(configDir, true);
    dialog.showMessageBox(win, {
      type: 'info',
      title: 'Restore Successful',
      message: 'Backup has been restored successfully!'
    });
    return true;
  } catch (err) {
    console.error('Restore failed:', err);
    dialog.showErrorBox('Restore Failed', err.message || 'Unknown error');
    return false;
  }
}

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
          label: 'Clear Tabs',
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
              clearAllTab(tabsFilePath, tabsData);
            }
          },
        },
		{
		  label: 'Clear Data',
		  click: async () => {
			const result = await dialog.showMessageBox({
			  type: 'warning',
			  buttons: ['Cancel', 'Reset'],
			  defaultId: 1,
			  cancelId: 0,
			  title: 'Reset All Data',
			  message: 'Are you sure you want to delete all data files? This action cannot be undone.',
			  noLink: true,
			});

			if (result.response === 1) {
			  resetAllData();
			  setTimeout(() => {
				app.relaunch();
				app.exit(0);
			  }, 500);
			}
		  }
		},
        {
          type: 'separator',
        },
		{
          label: 'Theme',
          click: () => {
            nativeTheme.themeSource = nativeTheme.shouldUseDarkColors ? 'light' : 'dark';
            win.webContents.send('toggle-dark-mode', nativeTheme.shouldUseDarkColors);
          },
        },
		{
          label: 'Fullscreen',
          accelerator: process.platform === 'darwin' ? 'Cmd+Ctrl+F' : 'F11',
          click: () => win.setFullScreen(!win.isFullScreen()),
        },
        { label: 'Reload', 
          accelerator: process.platform === 'darwin' ? 'Cmd+R' : 'Ctrl+R',
		  click: () => win.reload() 
		},
		{
		  label: 'Screenshot',
		  accelerator: process.platform === 'darwin' ? 'Cmd+Shift+S' : 'Ctrl+Shift+S',
		  click: () => {
			win.webContents.capturePage().then(image => {
			  const filePath = dialog.showSaveDialogSync(win, {
				title: 'Simpan Screenshot',
				defaultPath: path.join(app.getPath('pictures'), 'screenshot.png'),
				filters: [{ name: 'Images', extensions: ['png'] }]
			  })

			  if (filePath) {
				fs.writeFile(filePath, image.toPNG(), err => {
				  if (err) {
					dialog.showErrorBox('Error', 'Failed to save screenshot')
				  } else {
					dialog.showMessageBox(win, {
					  type: 'info',
					  title: 'Success',
					  message: 'Screenshot successfully saved in:\n' + filePath
					})
				  }
				})
			  }
			})
		  }
		},
//        {
//          label: 'Developer Tools',
//          click: () => win.webContents.toggleDevTools(),
//        },
        {
          type: 'separator',
        },
		{
		  label: 'Backup',
		  click: () => {
			backupPosFolder();
		  },
		},
		{
		  label: 'Restore',
		  click: () => {
			restorePosFolder(win);
		  },
		},
        {
          type: 'separator',
        },
		{
		  label: 'Setting',
		  click: () => {
			createSettingWindow();
		  },
		},
        { label: 'Exit', click: () => app.quit() },
      ],
    },
	
	{
      label: 'Help',
      submenu: [
		{
		  label: 'Check Updates',
		  click: () => checkForUpdates(win),
		},
		{
		  label: 'Documentation',
		  click: () => {
            createDocsWindow();
          },
		},
		{
		  label: 'About',
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
	  ],
	},
	
    {
      label: 'AI',
      click: () => {
        createAIWindow();
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
      label: 'POS',
      click: () => {
        createPosWindow();
      },
    },
    {
      label: 'Notes',
      click: () => {
        createNotesWindow();
      },
    },
  ];
}

module.exports = {
  menuApp, checkForUpdates
};
