const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // Python process control
    startTracking: () => ipcRenderer.invoke('start-tracking'),
    startTrackingWithVideo: () => ipcRenderer.invoke('start-tracking-with-video'),
    stopTracking: () => ipcRenderer.invoke('stop-tracking'),
    getTrackingStatus: () => ipcRenderer.invoke('get-tracking-status'),
    
    // Performance monitoring
    getPerformance: () => ipcRenderer.invoke('get-performance'),
    
    // App information
    getAppInfo: () => ipcRenderer.invoke('get-app-info'),
    
    // System utilities
    openCameraSettings: () => ipcRenderer.invoke('open-camera-settings'),
    
    // Event listeners for Python process
    onPythonStatus: (callback) => ipcRenderer.on('python-status', (event, data) => callback(data)),
    onPythonError: (callback) => ipcRenderer.on('python-error', (event, data) => callback(data)),
    onPythonStopped: (callback) => ipcRenderer.on('python-stopped', callback),
    onPythonInfo: (callback) => ipcRenderer.on('python-info', callback),
    
    // New event listeners for data
    onBlinkCount: (callback) => ipcRenderer.on('blink-count', (event, data) => callback(data)),
    onVideoFrame: (callback) => ipcRenderer.on('video-frame', (event, data) => callback(data)),
    onPythonData: (callback) => ipcRenderer.on('python-data', (event, data) => callback(data)),
    
    // Performance and system events
    onPerformanceData: (callback) => ipcRenderer.on('performance-data', (event, data) => callback(data)),
    onCameraNotification: (callback) => ipcRenderer.on('camera-notification', callback),
    onSettingsUpdate: (callback) => ipcRenderer.on('settings-update', (event, data) => callback(data)),
    
    // Event listeners for data from main process
    onBlinkData: (callback) => ipcRenderer.on('blink-data', callback),
    onCameraNotFound: (callback) => ipcRenderer.on('camera-not-found', callback),
    
    // Remove event listeners
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
    
    // Platform info
    platform: process.platform,
    
    // Version info
    versions: {
        node: process.versions.node,
        chrome: process.versions.chrome,
        electron: process.versions.electron
    }
}); 