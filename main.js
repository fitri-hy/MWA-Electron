const { app, BrowserWindow, BrowserView, ipcMain, session, Menu, shell, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

let mainWindow;
let productWindow = null;
let tabCounter = 1;
let tabs = [];
let activeTabId = null;

const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
const appTitle = 'M-WA';
const userDataPath = path.join(localAppData, appTitle);
const sessionFolder = path.join(userDataPath, 'session');
const tabsFile = path.join(userDataPath, 'tabs.json');
const productFilePath = path.join(userDataPath, 'products.json');

if (!fs.existsSync(sessionFolder)) {
  fs.mkdirSync(sessionFolder, { recursive: true });
}

if (!fs.existsSync(userDataPath)) {
  fs.mkdirSync(userDataPath, { recursive: true });
}

function readProducts() {
  try {
    if (!fs.existsSync(productFilePath)) {
      fs.writeFileSync(productFilePath, '[]', 'utf-8');
      return [];
    }
    const data = fs.readFileSync(productFilePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading products:', error);
    return [];
  }
}

function writeProducts(products) {
  try {
    fs.writeFileSync(productFilePath, JSON.stringify(products, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing products:', error);
  }
}

app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.commandLine.appendSwitch('enable-experimental-web-platform-features');

function saveTabs() {
  const savedTabs = tabs.map(t => ({ id: t.id, partition: t.partition }));
  const data = {
    tabs: savedTabs,
    activeTabId
  };
  fs.writeFileSync(tabsFile, JSON.stringify(data, null, 2));
}

function loadTabs() {
  try {
    const data = fs.readFileSync(tabsFile);
    return JSON.parse(data);
  } catch {
    return { tabs: [], activeTabId: null };
  }
}

function logHistory(tabId, url) {
  const filePath = path.join(sessionFolder, `tab_${tabId}.json`);
  let history = [];

  if (fs.existsSync(filePath)) {
    try {
      history = JSON.parse(fs.readFileSync(filePath));
    } catch {
      history = [];
    }
  }

  history.push({ timestamp: Date.now(), url });
  history = history.slice(-100);
  fs.writeFileSync(filePath, JSON.stringify(history, null, 2));
}

function injectThemeCSS(view, theme) {
  const darkCSS = `
    html, body {
      background-color: #121212 !important;
      color: #e0e0e0 !important;
    }
    ._1N1BB {
      background-color: #1f1f1f !important;
    }
  `;

  const lightCSS = `
    html, body {
      background-color: #ffffff !important;
      color: #000000 !important;
    }
    ._1N1BB {
      background-color: #f0f0f0 !important;
    }
  `;

  view.webContents.insertCSS(theme === 'dark' ? darkCSS : lightCSS).catch(console.error);
  view.webContents.insertCSS('body { -webkit-user-select: text !important; }').catch(console.error);
}

function resizeActiveTabView() {
  const tab = tabs.find(t => t.id === activeTabId);
  if (tab && tab.view) {
    const [width, height] = mainWindow.getContentSize();
    tab.view.setBounds({
      x: 0,
      y: 35,
      width: width,
      height: height - 35
    });
  }
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    title: 'M-WA',
    darkTheme: true,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'src', 'preload.js')
    }
  });

  mainWindow.loadFile('src/index.html');
  mainWindow.maximize();

  mainWindow.on('resize', () => {
    resizeActiveTabView();
  });

  mainWindow.on('maximize', () => {
    resizeActiveTabView();
  });

  mainWindow.on('unmaximize', () => {
    resizeActiveTabView();
  });
  
  mainWindow.once('ready-to-show', () => {
    resizeActiveTabView();
    const tab = tabs.find(t => t.id === activeTabId);
    if (tab && tab.view) {
      tab.view.setAutoResize({ width: true, height: true });
    }
  });
}

function createNewTab(partitionName = null, reuseId = null) {
  const id = reuseId ?? tabCounter++;
  const partition = partitionName ?? `persist:tab_${id}`;
  const chromeUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

  if (reuseId !== null && reuseId >= tabCounter) {
    tabCounter = reuseId + 1;
  }

  const view = new BrowserView({
    webPreferences: {
      contextIsolation: true,
      partition: partition,
      preload: path.join(__dirname, 'src', 'preload.js'),
      nodeIntegration: false,
      sandbox: false,
      autoplayPolicy: 'no-user-gesture-required',
      webSecurity: false,
      plugins: true,
      enableBlinkFeatures: 'MediaSessionService',
      allowRunningInsecureContent: false,
    }
  });

  const loadWhatsApp = () => {
    view.webContents.loadURL('https://web.whatsapp.com', { userAgent: chromeUA });
  };

  if (partition.startsWith('persist:')) {
    setTimeout(loadWhatsApp, 500);
  } else {
    loadWhatsApp();
  }

  view.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  view.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('https://web.whatsapp.com')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  view.webContents.on('did-start-loading', () => {
    mainWindow.webContents.send('tab-loading', { id, loading: true });
  });

  view.webContents.on('did-stop-loading', () => {
    mainWindow.webContents.send('tab-loading', { id, loading: false });
  });

  view.webContents.on('did-navigate', (_, url) => {
    logHistory(id, url);
  });

  view.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('theme-updated', nativeTheme.shouldUseDarkColors ? 'dark' : 'light');

    view.webContents.executeJavaScript(`
      const mediaEls = [...document.querySelectorAll('video, audio')];
      mediaEls.forEach(el => el.play().catch(e => console.error('Error saat play media:', e)));
      const event = new MouseEvent('click', { bubbles: true, cancelable: true });
      document.body.dispatchEvent(event);
    `).catch(console.error);
  });

  nativeTheme.on('updated', () => {
    if (mainWindow) {
      const theme = nativeTheme.shouldUseDarkColors ? 'dark' : 'light';
      mainWindow.webContents.send('theme-updated', theme);

      tabs.forEach(tab => {
        injectThemeCSS(tab.view, theme);
      });

      if (productWindow && !productWindow.isDestroyed()) {
        productWindow.webContents.send('theme-updated', theme);
      }
    }
  });

  tabs.push({ id, view, partition });
  mainWindow.webContents.send('add-tab', { id });
  switchTab(id);

  return id;
}

function switchTab(id) {
  const tab = tabs.find(t => t.id === id);
  if (!tab) return;

  mainWindow.getBrowserViews().forEach(v => {
    if (v !== tab.view) mainWindow.removeBrowserView(v);
  });
  mainWindow.setBrowserView(tab.view);

  const [width, height] = mainWindow.getContentSize();
  tab.view.setBounds({
    x: 0,
    y: 35,
    width: width,
    height: height - 35
  });

  tab.view.setAutoResize({ width: true, height: true });
  activeTabId = id;
  saveTabs();
  mainWindow.webContents.send('switch-tab', id);
}

async function closeTab(id) {
  const index = tabs.findIndex(t => t.id === id);
  if (index === -1) return;

  const tab = tabs[index];
  if (mainWindow.getBrowserView() === tab.view) {
    mainWindow.removeBrowserView(tab.view);
  }

  tab.view.webContents.destroy();
  tabs.splice(index, 1);
  mainWindow.webContents.send('remove-tab', id);

  const filePath = path.join(sessionFolder, `tab_${id}.json`);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  if (tabs.length > 0) {
    switchTab(tabs[0].id);
  } else {
    activeTabId = null;
    saveTabs();
  }
}

function clearAllData() {
  tabs.forEach(tab => {
    if (tab.view && !tab.view.webContents.isDestroyed()) {
      tab.view.webContents.destroy();
    }
  });

  const clearPromises = tabs.map(tab => {
    const ses = session.fromPartition(tab.partition);
    return ses.clearStorageData();
  });

  Promise.allSettled(clearPromises).then(() => {
    setTimeout(() => {
      try {
        const userDataPath = path.join(localAppData, appTitle);
        const partitionsPath = path.join(userDataPath, 'Partitions');
        const multiTabPath = path.join(__dirname, 'multi-tab-browser');

        if (fs.existsSync(partitionsPath)) {
          fs.rmSync(partitionsPath, { recursive: true, force: true });
        }

        if (fs.existsSync(multiTabPath)) {
          fs.rmSync(multiTabPath, { recursive: true, force: true });
        }

        if (fs.existsSync(tabsFile)) fs.unlinkSync(tabsFile);
        if (fs.existsSync(sessionFolder)) {
          fs.rmSync(sessionFolder, { recursive: true, force: true });
        }

        app.relaunch();
        app.exit();
      } catch (err) {
        console.error('Error clearing data:', err);
      }
    }, 1000);
  });
}

function createProductWindow() {
  if (productWindow) {
    productWindow.focus();
    return;
  }

  productWindow = new BrowserWindow({
    width: 800,
    height: 600,
    title: 'Daftar Produk',
    autoHideMenuBar: true,
    menuBarVisible: false,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'src', 'preload.js')
    }
  });

  productWindow.loadFile(path.join(__dirname, 'src', 'product.html'));

  productWindow.webContents.on('did-finish-load', () => {
    productWindow.webContents.send('theme-updated', nativeTheme.shouldUseDarkColors ? 'dark' : 'light');
  });

  productWindow.on('closed', () => {
    productWindow = null;
  });
}

function createAppMenu() {
  const menu = Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [
        {
          label: 'Clear Data',
          click: () => clearAllData()
        },
		{
		  label: 'Theme',
		  click: () => {
			const isDark = nativeTheme.shouldUseDarkColors;
			nativeTheme.themeSource = isDark ? 'light' : 'dark';
			mainWindow?.webContents.send('theme-updated', nativeTheme.themeSource);
		  }
		},
		{
		  label: 'Github',
		  click: async () => {
		    await shell.openExternal('https://github.com/fitri-hy/MWA-Electron');
		  }
		},
        { role: 'quit' }
      ]
    },
    {
      label: 'Notes/Products',
      click: () => createProductWindow()
    }
  ]);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(async () => {
  createAppMenu();
  createMainWindow();

  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const url = webContents.getURL();
    console.log(`Request permission: ${permission} dari ${url}`);
    if (url.startsWith('https://web.whatsapp.com')) {
      if (['media', 'camera', 'microphone', 'fullscreen', 'mediaKeySystem'].includes(permission)) {
        callback(true);
        return;
      }
    }
    callback(false);
  });

  ipcMain.handle('new-tab', () => createNewTab());
  ipcMain.handle('reload-tab', (event, id) => {
    const tab = tabs.find(t => t.id === id);
    if (tab && tab.view) tab.view.webContents.reload();
  });
  ipcMain.handle('switch-tab', (event, id) => switchTab(id));
  ipcMain.handle('close-tab', (event, id) => closeTab(id));
  ipcMain.handle('clear-data', () => clearAllData());

ipcMain.handle('get-products', () => {
  return readProducts();
});

ipcMain.handle('add-product', (_, product) => {
  const products = readProducts();
  const maxId = products.length > 0 ? Math.max(...products.map(p => p.id)) : 0;
  const newId = maxId + 1;

  const newProduct = { id: newId, ...product };
  products.push(newProduct);
  writeProducts(products);
  return products;
});

ipcMain.handle('update-product', (_, editedProduct) => {
  let products = readProducts();
  products = products.map(p => (p.id === editedProduct.id ? editedProduct : p));
  writeProducts(products);
  return products;
});

ipcMain.handle('delete-product', (_, productId) => {
  let products = readProducts();
  products = products.filter(p => p.id !== productId);
  writeProducts(products);
  return products;
});


  const savedData = loadTabs();
  if (savedData.tabs.length > 0) {
    for (const t of savedData.tabs) {
      await createNewTab(t.partition, t.id);
    }
    if (savedData.activeTabId) switchTab(savedData.activeTabId);
  } else {
    createNewTab();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
