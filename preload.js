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
    const handler = (_event, data) => callback(data);
    ipcRenderer.on("game-closed", handler);
    return () => ipcRenderer.removeListener("game-closed", handler);
  },
  // Play history persistence
  // Loads the entire play-history.json from disk
  loadPlayHistory: () => ipcRenderer.invoke("load-play-history"),
  // Saves the entire play-history.json to disk
  savePlayHistory: (history) => ipcRenderer.invoke("save-play-history", history),
  // Gets history for a single game by name (returns null if not found)
  getGameHistory: (gameName) => ipcRenderer.invoke("get-game-history", gameName),
});