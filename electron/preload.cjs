const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Get local IP addresses for displaying server info
  getLocalIPs: () => ipcRenderer.invoke('get-local-ips'),

  // Check if Windows Service is installed
  checkServiceStatus: () => ipcRenderer.invoke('check-service-status'),

  // Install Windows Service
  installService: () => ipcRenderer.invoke('install-service'),

  // Send messages to main process
  send: (channel, data) => {
    const validChannels = ['install-service'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },

  // Receive messages from main process
  on: (channel, func) => {
    const validChannels = ['service-status'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  },
});
