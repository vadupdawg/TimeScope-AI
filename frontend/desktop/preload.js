const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
    'electron',
    {
        // Screenshot functionaliteit
        takeScreenshot: () => ipcRenderer.invoke('take-screenshot'),
        
        // Auto-launch configuratie
        toggleAutoLaunch: (enable) => ipcRenderer.invoke('toggle-auto-launch', enable),
        
        // Listeners voor tray events
        onStartTracking: (callback) => ipcRenderer.on('start-tracking', () => callback()),
        onStopTracking: (callback) => ipcRenderer.on('stop-tracking', () => callback()),
        
        // App info
        platform: process.platform,
        isDev: process.env.NODE_ENV === 'development'
    }
);