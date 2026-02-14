// main.js
const { app, BrowserWindow, ipcMain, shell } = require("electron");
const path = require("path");
const { spawn, execSync } = require("child_process");

// REQUIRED for correct Windows taskbar & pinned icon
app.setAppUserModelId("com.yourname.gamelauncher");

const isDev = !app.isPackaged;

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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 1350,

    // Window title (kills "React App")
    title: "Game Launcher",

    // Runtime + taskbar icon
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

    // If we have an exe name, we can poll for play time
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
          // Retry once more — some games take a while to start
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
| GENERIC COMMAND LAUNCHER - WITH PLAY TIME TRACKING + POLLING FALLBACK
|--------------------------------------------------------------------------
| Accepts an optional gameId so we know which game to update
| when the process exits.
|
| The renderer calls:
|   launchGame(command)           ← old way, still works
|   launchGame(command, gameId)   ← new way, enables time tracking
| If the child process exits within 30 seconds (Steam takeover),
| we switch to tasklist polling to detect when the game actually closes.
*/
ipcMain.handle("launch-game", async (_evt, command, gameId) => {
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
    });

    // ── TRACK: store start time if we have a gameId
    if (gameId) {
      activeGames.set(exeKey, {
        pid: child.pid,
        startTime: Date.now(),
        gameId: gameId,
        exeName: exeName,
      });
    }

    // ── ON EXIT: check if this was a real exit or a Steam takeover
    child.on("exit", (code) => {
      const tracked = activeGames.get(exeKey);
      if (!tracked || !tracked.gameId) return;

        const elapsedSeconds = Math.floor((Date.now() - tracked.startTime) / 1000);

        if (elapsedSeconds < 30) {
        // Process exited too fast — likely Steam took over.
        // Check if the game exe is actually still running via tasklist.
        console.log(`Child exited after ${elapsedSeconds}s — checking if ${exeName} is still running...`);

        // Give Steam a moment to relaunch the game
        setTimeout(() => {
          if (isExeRunning(exeName)) {
            console.log(`${exeName} is still running (Steam takeover). Switching to polling.`);
            startPollingForExit(exeName, exeKey);
          } else {
            // Game genuinely exited quickly
            console.log(`${exeName} is not running. Recording ${elapsedSeconds}s.`);
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send("game-closed", {
                gameId: tracked.gameId,
                elapsedSeconds: elapsedSeconds,
              });
            }
            activeGames.delete(exeKey);
          }
        }, 3000); // Wait 3 seconds before checking
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

    // unref so our app can still close, but we keep the
    // child reference alive in activeGames for tracking
    child.unref();

    resolve({ ok: true, pid: child.pid });
  });
});

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});