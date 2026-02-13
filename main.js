// main.js
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { spawn } = require("child_process");

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
*/
let mainWindow = null;

// Tracks running games: Map<exeKey, { pid, startTime, gameId }>
const activeGames = new Map();
function getExeKey(exePath) {

  return exePath.toLowerCase().trim();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 1100,

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
| GENERIC COMMAND LAUNCHER - NOW WITH PLAY TIME TRACKING
|--------------------------------------------------------------------------
| Accepts an optional gameId so we know which game to update
| when the process exits.
|
| The renderer calls:
|   launchGame(command)           ← old way, still works
|   launchGame(command, gameId)   ← new way, enables time tracking
*/
ipcMain.handle("launch-game", async (_evt, command, gameId) => {
  console.log("Launching via Electron (launch-game):", command);
  if (gameId) console.log("Tracking play time for gameId:", gameId);

  return new Promise((resolve) => {
    const parts = command.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
    const exe = parts[0].replace(/"/g, "");
    const args = parts.slice(1).map((a) => a.replace(/"/g, ""));

    const child = spawn(exe, args, {
      detached: true,
      stdio: "ignore",
    });

    const exeKey = getExeKey(exe);

    // ── TRACK: store start time if we have a gameId ──
    if (gameId) {
      activeGames.set(exeKey, {
        pid: child.pid,
        startTime: Date.now(),
        gameId: gameId,
      });
    }

    // ── ON EXIT: calculate elapsed time and notify renderer ──
    child.on("exit", (code) => {
      const tracked = activeGames.get(exeKey);
      if (tracked && tracked.gameId) {
        const elapsedSeconds = Math.floor((Date.now() - tracked.startTime) / 1000);
        console.log(`Game exited (${tracked.gameId}): played for ${elapsedSeconds}s`);

        // Send elapsed time to the renderer
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