// preload.js

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // Get app version from Electron
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
  // Launch a game using generic command
  launchGame: (command) => ipcRenderer.invoke("launch-game", command),
  //launch PCSX2 directory
  launchPCSX2: (exePath) => ipcRenderer.invoke("launch-pcsx2", exePath),
});