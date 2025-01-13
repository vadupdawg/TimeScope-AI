const { app, BrowserWindow, ipcMain, Tray, Menu } = require('electron');
const path = require('path');
const screenshot = require('screenshot-desktop');
const Store = require('electron-store');
const isDev = require('electron-is-dev');

const store = new Store();
let mainWindow;
let tray;
let isQuitting = false;

function createWindow() {
    // Maak het hoofdvenster
    mainWindow = new BrowserWindow({
        width: 900,
        height: 700,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        icon: path.join(__dirname, 'assets/icon.png')
    });

    // Laad de index.html
    mainWindow.loadFile(path.join(__dirname, '../src/index.html'));

    // Voorkom sluiten bij klikken op X, minimaliseer naar tray
    mainWindow.on('close', (event) => {
        if (!isQuitting) {
            event.preventDefault();
            mainWindow.hide();
        }
    });

    // Open DevTools in development mode
    if (isDev) {
        mainWindow.webContents.openDevTools();
    }
}

function createTray() {
    tray = new Tray(path.join(__dirname, 'assets/icon.png'));
    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Open TimeScope',
            click: () => mainWindow.show()
        },
        {
            label: 'Start Tracking',
            click: () => mainWindow.webContents.send('start-tracking')
        },
        {
            label: 'Stop Tracking',
            click: () => mainWindow.webContents.send('stop-tracking')
        },
        { type: 'separator' },
        {
            label: 'Quit',
            click: () => {
                isQuitting = true;
                app.quit();
            }
        }
    ]);

    tray.setToolTip('TimeScope AI');
    tray.setContextMenu(contextMenu);
    tray.on('click', () => mainWindow.show());
}

// Screenshot functionaliteit
ipcMain.handle('take-screenshot', async () => {
    try {
        const buffer = await screenshot();
        return buffer;
    } catch (error) {
        console.error('Screenshot error:', error);
        throw error;
    }
});

// Auto-launch functionaliteit
ipcMain.handle('toggle-auto-launch', async (_, shouldEnable) => {
    const AutoLaunch = require('auto-launch');
    const autoLauncher = new AutoLaunch({
        name: 'TimeScope AI',
        path: app.getPath('exe'),
    });

    try {
        if (shouldEnable) {
            await autoLauncher.enable();
        } else {
            await autoLauncher.disable();
        }
        store.set('autoLaunch', shouldEnable);
        return true;
    } catch (error) {
        console.error('Auto-launch error:', error);
        return false;
    }
});

// App ready
app.whenReady().then(() => {
    createWindow();
    createTray();

    // Activeer auto-launch als het was ingesteld
    const shouldAutoLaunch = store.get('autoLaunch', false);
    if (shouldAutoLaunch) {
        ipcMain.emit('toggle-auto-launch', null, true);
    }
});

// Activatie handler (voor macOS)
app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// Quit wanneer alle vensters gesloten zijn (behalve op macOS)
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Auto-updater voor productie
if (!isDev) {
    const { autoUpdater } = require('electron-updater');
    autoUpdater.checkForUpdatesAndNotify();
}