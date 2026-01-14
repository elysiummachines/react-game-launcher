// preload.js
//const { contextBridge, ipcRenderer } = require("electron");

//contextBridge.exposeInMainWorld("electronAPI", {
  //launchGame: (command) => ipcRenderer.invoke("launch-game", command),
//});



//nst { contextBridge, ipcRenderer } = require("electron");

//ntextBridge.exposeInMainWorld("electronAPI", {
  //unchGame: (command) => ipcRenderer.invoke("launch-game", command),
//;



// preload.js
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  launchGame: (command) => ipcRenderer.invoke("launch-game", command),
  launchPCSX2: (exePath) => ipcRenderer.invoke("launch-pcsx2", exePath),
});