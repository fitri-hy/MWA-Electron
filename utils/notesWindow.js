const { BrowserWindow, screen } = require('electron');
const path = require('path');
require('dotenv').config();

const port = process.env.PORT || 3000;
const iconPath = path.join(__dirname, '..', 'public', 'assets', 'images', 'logo.png');

function createNotesWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;

  const win = new BrowserWindow({
    width: Math.min(900, width * 0.8),
    height: Math.min(550, height * 0.8),
    minWidth: 800,
    minHeight: 450,
    icon: iconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  win.loadURL(`http://localhost:${port}/notes`);
  win.setMenu(null);
  win.once('ready-to-show', () => win.show());

  return win;
}

module.exports = { createNotesWindow };
