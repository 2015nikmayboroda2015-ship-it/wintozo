const { app, BrowserWindow } = require("electron");
const path = require("path");
const isDev = !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width: 430,
    height: 700,
    minWidth: 360,
    minHeight: 500,
    frame: false, // без рамки — кастомный хедер
    backgroundColor: "#f5f5f2",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      // Разрешаем микрофон и камеру даже в packaged-режиме
      webSecurity: true,
    },
  });

  if (isDev) {
    win.loadURL("http://localhost:5173");
    win.webContents.openDevTools();
  } else {
    // Для GitHub Actions: dist/index.html — singlefile build
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
