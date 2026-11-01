const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('hh', {
  getState: () => ipcRenderer.invoke('hh:getState'),
  addWater: (ml) => ipcRenderer.invoke('hh:addWater', ml),
  undoWater: () => ipcRenderer.invoke('hh:undoWater'),
  setProfile: (patch) => ipcRenderer.invoke('hh:setProfile', patch),
  logWeight: (kg) => ipcRenderer.invoke('hh:logWeight', kg),
  regenerate: () => ipcRenderer.invoke('hh:regenerate'),
  logMeal: (slot) => ipcRenderer.invoke('hh:logMeal', slot),
  logManualMeal: (input) => ipcRenderer.invoke('hh:logManualMeal', input),
  quiet: (min) => ipcRenderer.invoke('hh:quiet', min),
  previewReminder:()=>ipcRenderer.invoke('hh:previewReminder'),
  openDataDir: () => ipcRenderer.invoke('hh:openDataDir'),
  hide: () => ipcRenderer.invoke('hh:hide'),
  loginItem: (on) => ipcRenderer.invoke('hh:loginItem', on),
  sync: (action) => ipcRenderer.invoke('hh:sync', action),
  configureSync: (config) => ipcRenderer.invoke('hh:configureSync', config),
  mealAction: (action,slot,id) => ipcRenderer.invoke('hh:mealAction',action,slot,id),
  takeaway: (action,options) => ipcRenderer.invoke('hh:takeaway',action,options),
  onStatus: (cb) => ipcRenderer.on('hh:status', (_e, s) => cb(s))
});
