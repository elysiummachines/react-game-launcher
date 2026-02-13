// preload.js

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // Get app version from Electron
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
  // Launch a game using generic command
  launchGame: (command, gameId) => ipcRenderer.invoke("launch-game", command, gameId),
  // Listen for when a game process exits
  // Callback receives: { gameId, elapsedSeconds }
  onGameClosed: (callback) => {
    ipcRenderer.on("game-closed", (_event, data) => callback(data));
  },
});