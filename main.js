// main.js
const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const { spawn, execSync } = require("child_process");

// REQUIRED for correct Windows taskbar & pinned icon
app.setAppUserModelId("com.yourname.gamelauncher");

const isDev = !app.isPackaged;

/*
|--------------------------------------------------------------------------
| PLAY HISTORY FILE
|--------------------------------------------------------------------------
| Stores play time and last played date for all games, keyed by game name.
| Lives in Electron's userData directory so it survives reinstalls.
| Path: %APPDATA%/Game Launcher/play-history.json
|--------------------------------------------------------------------------
*/
const historyFilePath = path.join(app.getPath("userData"), "play-history.json");

function loadPlayHistory() {
  try {
    if (fs.existsSync(historyFilePath)) {
      const data = fs.readFileSync(historyFilePath, "utf-8");
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("Failed to load play history:", err);
  }
  return {};
}

function savePlayHistory(history) {
  try {
    fs.writeFileSync(historyFilePath, JSON.stringify(history, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save play history:", err);
  }
}

/*
|--------------------------------------------------------------------------
| PLAY TIME TRACKER
|--------------------------------------------------------------------------
| When a game launches, we store the start time + game ID.
| When the process exits, we calculate elapsed seconds and
| send it back to the renderer via webContents.send().
|
| For Steam games, the spawned process exits immediately because
| Steam takes over. In that case, we fall back to polling Windows
| tasklist to check if the game exe is still running.
|
| For steam:// protocol launches, the child process is just `cmd`
| opening a URL — it exits instantly. We rely on polling the exe
| name if provided, or just record the timestamp.
*/
let mainWindow = null;

// Tracks running games: Map<exeKey, { pid, startTime, gameId }>
const activeGames = new Map();

function getExeKey(exePath) {
  return exePath.toLowerCase().trim();
}

/*
|--------------------------------------------------------------------------
| CHECK IF AN EXE IS RUNNING VIA WINDOWS TASKLIST
|--------------------------------------------------------------------------
*/
function isExeRunning(exeName) {
  try {
    const result = execSync(`tasklist /FI "IMAGENAME eq ${exeName}" /NH`, {
      encoding: "utf-8",
      timeout: 5000,
      windowsHide: true,
    });
    return result.toLowerCase().includes(exeName.toLowerCase());
  } catch {
    return false;
  }
}

/*
|--------------------------------------------------------------------------
| POLL FOR GAME EXIT — used when Steam takes over the process
|--------------------------------------------------------------------------
| Checks every 10 seconds if the exe is still in the task list.
| When it disappears, calculates elapsed time and notifies renderer.
*/
function startPollingForExit(exeName, exeKey) {
  console.log(`Starting tasklist polling for: ${exeName}`);

  const interval = setInterval(() => {
    const stillRunning = isExeRunning(exeName);

    if (!stillRunning) {
      clearInterval(interval);

      const tracked = activeGames.get(exeKey);
      if (tracked && tracked.gameId) {
        const elapsedSeconds = Math.floor((Date.now() - tracked.startTime) / 1000);
        console.log(`Game exited via polling (${tracked.gameId}): played for ${elapsedSeconds}s`);

        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("game-closed", {
            gameId: tracked.gameId,
            elapsedSeconds: elapsedSeconds,
          });
        }

        activeGames.delete(exeKey);
      }
    }
  }, 10000); // Check every 10 seconds
}

/*
|--------------------------------------------------------------------------
| CREATE WINDOW
|--------------------------------------------------------------------------
*/
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 2250,
    height: 1250,
    title: "Game Launcher",
    icon: path.join(__dirname, "assets", "icon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:3000");
  } else {
    mainWindow.loadFile(path.join(__dirname, "build", "index.html"));
  }

  // Force title after load (Windows sometimes overrides)
  mainWindow.webContents.once("did-finish-load", () => {
    mainWindow.setTitle("Game Launcher");
  });
}

/*
|--------------------------------------------------------------------------
| GET APP VERSION
|--------------------------------------------------------------------------
*/
ipcMain.handle("get-app-version", async () => {
  return app.getVersion();
});

/*
|--------------------------------------------------------------------------
| PLAY HISTORY IPC HANDLERS
|--------------------------------------------------------------------------
| load-play-history  → returns the entire history object
| save-play-history  → receives updated history object and writes to disk
| get-game-history   → returns history for a single game by name
|--------------------------------------------------------------------------
*/
ipcMain.handle("load-play-history", async () => {
  return loadPlayHistory();
});

ipcMain.handle("save-play-history", async (_evt, history) => {
  savePlayHistory(history);
  return { ok: true };
});

ipcMain.handle("get-game-history", async (_evt, gameName) => {
  const history = loadPlayHistory();
  const key = gameName.toLowerCase().trim();
  return history[key] || null;
});

/*
|--------------------------------------------------------------------------
| LAUNCH STEAM URL — opens steam://rungameid/<appId>
|--------------------------------------------------------------------------
| This is the anti-cheat safe way to launch Steam games.
| It uses shell.openExternal to let the OS handle the steam:// protocol.
|
| For play time tracking, we try to find the game's exe in the tasklist
| after a delay and poll for its exit. If exeName is provided by the
| renderer, we use that; otherwise we skip play time tracking for
| steam:// launches (the renderer still records lastPlayed timestamp).
|--------------------------------------------------------------------------
*/
ipcMain.handle("launch-steam-url", async (_evt, steamUrl, gameId, exeName) => {
  console.log("Launching Steam URL:", steamUrl);
  if (gameId) console.log("Tracking play time for gameId:", gameId);

  try {
    await shell.openExternal(steamUrl);

    if (gameId && exeName) {
      const exeKey = getExeKey(exeName);

      activeGames.set(exeKey, {
        pid: null,
        startTime: Date.now(),
        gameId: gameId,
        exeName: exeName,
      });

      // Wait for Steam to actually start the game, then begin polling
      setTimeout(() => {
        if (isExeRunning(exeName)) {
          console.log(`${exeName} detected after steam:// launch. Starting polling.`);
          startPollingForExit(exeName, exeKey);
        } else {
          console.log(`${exeName} not yet running after steam:// launch. Retrying in 15s...`);
          setTimeout(() => {
            if (isExeRunning(exeName)) {
              console.log(`${exeName} detected on retry. Starting polling.`);
              startPollingForExit(exeName, exeKey);
            } else {
              console.log(`${exeName} never appeared. Giving up on play time tracking.`);
              activeGames.delete(exeKey);
            }
          }, 15000);
        }
      }, 10000); // Initial wait: 10 seconds for Steam to boot the game
    }

    return { ok: true };
  } catch (err) {
    console.error("Failed to open Steam URL:", err);
    return { ok: false, error: String(err) };
  }
});

/*
|--------------------------------------------------------------------------
| GENERIC COMMAND LAUNCHER — WITH PLAY TIME TRACKING + POLLING FALLBACK
|--------------------------------------------------------------------------
| If the child process exits within 30 seconds (Steam takeover),
| we switch to tasklist polling to detect when the game actually closes.
*/
ipcMain.handle("launch-game", async (_evt, command, gameId, useCwd = false) => {
  console.log("Launching via Electron (launch-game):", command);
  if (gameId) console.log("Tracking play time for gameId:", gameId);

  return new Promise((resolve) => {
    const parts = command.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
    const exe = parts[0].replace(/"/g, "");
    const args = parts.slice(1).map((a) => a.replace(/"/g, ""));
    const exeName = path.basename(exe);
    const exeKey = getExeKey(exe);

    const child = spawn(exe, args, {
      detached: true,
      stdio: "ignore",
      ...(useCwd ? { cwd: path.dirname(exe) } : {}),
    });

    if (gameId) {
      activeGames.set(exeKey, {
        pid: child.pid,
        startTime: Date.now(),
        gameId: gameId,
        exeName: exeName,
      });
    }

    child.on("exit", (code) => {
      const tracked = activeGames.get(exeKey);
      if (!tracked || !tracked.gameId) return;

      const elapsedSeconds = Math.floor((Date.now() - tracked.startTime) / 1000);

      if (elapsedSeconds < 30) {
        // Process exited too fast — likely Steam took over
        console.log(`Child exited after ${elapsedSeconds}s — checking if ${exeName} is still running...`);

        setTimeout(() => {
          if (isExeRunning(exeName)) {
            console.log(`${exeName} is still running (Steam takeover). Switching to polling.`);
            startPollingForExit(exeName, exeKey);
          } else {
            console.log(`${exeName} is not running. Recording ${elapsedSeconds}s.`);
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send("game-closed", {
                gameId: tracked.gameId,
                elapsedSeconds: elapsedSeconds,
              });
            }
            activeGames.delete(exeKey);
          }
        }, 3000);
      } else {
        // Normal exit — process ran for more than 30 seconds
        console.log(`Game exited (${tracked.gameId}): played for ${elapsedSeconds}s`);

        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("game-closed", {
            gameId: tracked.gameId,
            elapsedSeconds: elapsedSeconds,
          });
        }

        activeGames.delete(exeKey);
      }
    });

    child.on("error", (err) => {
      console.error("Launch error:", err);
      activeGames.delete(exeKey);
      resolve({ ok: false, error: String(err) });
    });

    child.unref();
    resolve({ ok: true, pid: child.pid });
  });
});

/*
|--------------------------------------------------------------------------
| APP LIFECYCLE
|--------------------------------------------------------------------------
*/
app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});