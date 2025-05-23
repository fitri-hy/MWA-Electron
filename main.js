const { app, BrowserWindow, BrowserView, ipcMain, session, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let tabCounter = 1;
let tabs = [];
let activeTabId = null;

const sessionFolder = path.join(__dirname, 'session');
if (!fs.existsSync(sessionFolder)) fs.mkdirSync(sessionFolder);

function saveTabs() {
	const savedTabs = tabs.map(t => ({ id: t.id, partition: t.partition }));
	const data = {
		tabs: savedTabs,
		activeTabId
	};
	fs.writeFileSync('tabs.json', JSON.stringify(data, null, 2));
}

function loadTabs() {
	try {
		const data = fs.readFileSync('tabs.json');
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

function createMainWindow() {
	mainWindow = new BrowserWindow({
		width: 1400,
		height: 900,
		title: 'M-WA',
		darkTheme: true,
		icon: path.join(__dirname, 'assets', 'icon.png'),
		webPreferences: {
			contextIsolation: true,
			preload: path.join(__dirname, 'src','preload.js')
		}
	});

	mainWindow.loadFile('src/index.html');
	mainWindow.maximize();
	mainWindow.on('resize', () => {
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
	});
	mainWindow.once('ready-to-show', () => {
		const tab = tabs.find(t => t.id === activeTabId);
		if (tab && tab.view) {
			const [width, height] = mainWindow.getContentSize();
			tab.view.setBounds({
				x: 0,
				y: 35,
				width: width,
				height: height - 35
			});
			tab.view.setAutoResize({ width: true, height: true });
		}
	});
}

function createNewTab(partitionName = null, reuseId = null) {
	const id = reuseId || tabCounter++;
	const partition = partitionName || `persist:tab_${id}`;
	const chromeUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

	if (reuseId && reuseId >= tabCounter) {
		tabCounter = reuseId + 1;
	}

	const view = new BrowserView({
		webPreferences: {
			contextIsolation: true,
			preload: path.join(__dirname, 'preload.js'),
			partition: partition
		}
	});

	if (partition.startsWith('persist:')) {
		setTimeout(() => {
		view.webContents.loadURL('https://web.whatsapp.com', { userAgent: chromeUA });
		}, 500);
	} else {
		view.webContents.loadURL('https://web.whatsapp.com', { userAgent: chromeUA });
	}

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
		const darkCSS = `
			html, body {
				background-color: #121212 !important;
				color: #e0e0e0 !important;
			}
			._1N1BB {
				background-color: #222 !important;
			}
		`;
		view.webContents.insertCSS(darkCSS).catch(console.error);
		view.webContents.insertCSS('body { -webkit-user-select: text !important; }');
		view.webContents.executeJavaScript(`
			window.addEventListener('contextmenu', e => {
				e.preventDefault();
				const selection = window.getSelection().toString();
				if (selection) {
					navigator.clipboard.writeText(selection).then(() => {
						console.log('Text copied to clipboard:', selection);
					});
				}
			});
		`).catch(console.error);
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

	try {
		const ses = session.fromPartition(tab.partition);
		await ses.clearStorageData();
		const userDataPath = app.getPath('userData');
		const partitionsPath = path.join(userDataPath, 'Partitions');
		const folderName = tab.partition.replace('persist:', '');
		const partitionFolderPath = path.join(partitionsPath, folderName);

		if (fs.existsSync(partitionFolderPath)) {
			fs.rmSync(partitionFolderPath, { recursive: true, force: true });
		}
	} catch (err) {
		console.error('Error clearing session or deleting folder:', err);
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
				const userDataPath = app.getPath('userData');
				const partitionsPath = path.join(userDataPath, 'Partitions');
				const multiTabPath = path.join(__dirname, 'multi-tab-browser');
  
			if (fs.existsSync(partitionsPath)) {
				fs.rmSync(partitionsPath, { recursive: true, force: true });
			}
  
			if (fs.existsSync(multiTabPath)) {
				fs.rmSync(multiTabPath, { recursive: true, force: true });
			}
  
			if (fs.existsSync('tabs.json')) fs.unlinkSync('tabs.json');
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
  

function createAppMenu() {
	const menu = Menu.buildFromTemplate([
		{
			label: 'File',
			submenu: [
				{
					label: 'Clear Data',
					click: () => clearAllData()
				},
				{ role: 'quit' }
			]
		}
	]);
	Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
	createAppMenu();
	createMainWindow();

	ipcMain.handle('new-tab', () => createNewTab());
	ipcMain.handle('reload-tab', (event, id) => {
		const tab = tabs.find(t => t.id === id);
		if (tab && tab.view && !tab.view.webContents.isDestroyed()) {
			tab.view.webContents.reload();
			return true;
		}
		return false;
	});
	ipcMain.on('switch-tab', (e, id) => switchTab(id));
	ipcMain.on('close-tab', (e, id) => closeTab(id));

	const { tabs: savedTabs, activeTabId: savedActiveId } = loadTabs();

	if (savedTabs.length > 0) {
		savedTabs.forEach(tab => createNewTab(tab.partition, tab.id));
		if (savedActiveId) {
		switchTab(savedActiveId);
		} else {
			switchTab(savedTabs[0].id);
		}
	} else {
		createNewTab();
	}
});

app.on('before-quit', () => {
	saveTabs();
});

app.on('window-all-closed', () => {
	app.quit();
});
