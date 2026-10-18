const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('orbit', {
  onState: (cb) => ipcRenderer.on('orbit:state', (_e, state) => cb(state)),
});
