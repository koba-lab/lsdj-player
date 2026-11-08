'use strict';
const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('lsdj', {
  getState: () => ipcRenderer.invoke('get-state'),
  openDialog: () => ipcRenderer.invoke('open-dialog'),
  openFile: (file) => ipcRenderer.invoke('open-path', webUtils.getPathForFile(file)),
  readWav: (key) => ipcRenderer.invoke('read-wav', key),
  reveal: (key) => ipcRenderer.invoke('reveal', key),
  remove: (key) => ipcRenderer.invoke('delete', key),
  chooseRom: () => ipcRenderer.invoke('choose-rom'),
  setConfig: (patch) => ipcRenderer.invoke('set-config', patch),
  on: (channel, fn) => {
    if (!['state', 'status', 'play'].includes(channel)) return;
    ipcRenderer.on(channel, (_e, payload) => fn(payload));
  },
});
