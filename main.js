// main.js
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { spawn } = require("child_process");

// REQUIRED for correct Windows taskbar & pinned icon
app.setAppUserModelId("com.yourname.gamelauncher");

const isDev = !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width: 1300,
    height: 900,

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
    win.loadURL("http://localhost:3000");
  } else {
    win.loadFile(path.join(__dirname, "build", "index.html"));
  }

  // Force title after load (Windows sometimes overrides)
  win.webContents.once("did-finish-load", () => {
    win.setTitle("Game Launcher");
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
| GENERIC COMMAND LAUNCHER
|--------------------------------------------------------------------------
*/
ipcMain.handle("launch-game", async (_evt, command) => {
  console.log("Launching via Electron (launch-game):", command);

  return new Promise((resolve) => {
    const parts = command.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
    const exe = parts[0].replace(/"/g, "");
    const args = parts.slice(1).map((a) => a.replace(/"/g, ""));

    const child = spawn(exe, args, {
      detached: true,
      stdio: "ignore",
    });

    child.unref();

    child.on("error", (err) => {
      console.error("Launch error:", err);
      resolve({ ok: false, error: String(err) });
    });

    resolve({ ok: true });
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