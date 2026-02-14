// preload.js

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // Get app version from Electron
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
  // Launch a game using generic command
  launchGame: (command, gameId) => ipcRenderer.invoke("launch-game", command, gameId),
  // Launch a game via steam:// protocol (anti-cheat safe)
  // steamUrl: e.g. "steam://rungameid/730"
  // gameId:   internal game ID for play time tracking
  // exeName:  optional exe name for tasklist polling (e.g. "cs2.exe")
  launchSteamUrl: (steamUrl, gameId, exeName) =>
    ipcRenderer.invoke("launch-steam-url", steamUrl, gameId, exeName),
  // Listen for when a game process exits
  // Callback receives: { gameId, elapsedSeconds }
  onGameClosed: (callback) => {
    ipcRenderer.on("game-closed", (_event, data) => callback(data));
  },
});