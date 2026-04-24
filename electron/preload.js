const { contextBridge, ipcRenderer } = require('electron');

// Expose safe APIs to the UI
contextBridge.exposeInMainWorld('electronAPI', {
  printBill: (billData) => ipcRenderer.send('print-bill', billData),
  getIP: () => ipcRenderer.invoke('get-local-ip')
});