require('dotenv').config();
const { BrowserWindow, screen, Menu } = require('electron');
const path = require('path');
const { menuApp, checkForUpdates } = require('./menu');

const port = process.env.PORT || 3000;
const iconPath = path.join(__dirname, '..', 'public', 'assets', 'images', 'logo.png');

function createWindow(tabsFilePath, tabsData) {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  const win = new BrowserWindow({
    width: Math.min(1024, width * 0.8),
    height: Math.min(768, height * 0.8),
    minWidth: 860,
    minHeight: 650,
    show: false,
	icon: iconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webviewTag: true,
    },
    resizable: true,
    fullscreenable: true,
  });

  win.loadURL(`http://localhost:${port}`);
  win.once('ready-to-show', () => {
    win.show();
    checkForUpdates(win, true);
  });

  const menu = Menu.buildFromTemplate(menuApp(win, tabsFilePath, tabsData));
  Menu.setApplicationMenu(menu);

  return win;
}

module.exports = { createWindow };
