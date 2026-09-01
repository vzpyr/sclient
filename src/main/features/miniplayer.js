const path = require("path");

let miniWin = null;

function register({ ipcMain, BrowserWindow, win, app }) {
  ipcMain.on("toggle_miniplayer", () => {
    if (miniWin) {
      miniWin.close();
      return;
    }
    miniWin = new BrowserWindow({
      width: 480,
      height: 180,
      frame: false,
      resizable: false,
      alwaysOnTop: true,
      icon: path.join(__dirname, "..", "..", "assets", "32x32.png"),
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
    });
    miniWin.loadFile(
      path.join(__dirname, "..", "..", "miniplayer", "index.html"),
    );
    miniWin.on("closed", () => {
      miniWin = null;
      if (win && !win.isDestroyed()) win.show();
    });
    if (win && !win.isDestroyed()) win.hide();
  });

  ipcMain.on("mini_close", () => {
    if (miniWin) miniWin.close();
  });
  ipcMain.on("mini_minimize", () => {
    if (miniWin) miniWin.minimize();
  });
  ipcMain.on("mini_fullscreen", () => {
    if (miniWin && !miniWin.isDestroyed()) {
      const willBeFS = !miniWin.isFullScreen();
      if (willBeFS) {
        miniWin.setResizable(true);
        miniWin.setFullScreen(true);
      } else {
        miniWin.setFullScreen(false);
        setTimeout(() => {
          if (!miniWin.isDestroyed() && !miniWin.isFullScreen()) {
            if (miniWin.desiredSize) {
              miniWin.setResizable(true);
              miniWin.setSize(
                miniWin.desiredSize.width,
                miniWin.desiredSize.height,
              );
            }
            miniWin.setResizable(false);
          }
        }, 100);
      }
    }
  });
  ipcMain.on("mini_action", (_e, action) => {
    if (win && !win.isDestroyed()) win.webContents.send("mini_action", action);
  });
  ipcMain.on("mini_update", (_e, data) => {
    if (miniWin && !miniWin.isDestroyed())
      miniWin.webContents.send("mini_update", data);
  });
  ipcMain.on("mini_visualizer", (_e, data) => {
    if (miniWin && !miniWin.isDestroyed())
      miniWin.webContents.send("mini_visualizer", data);
  });
  ipcMain.on("mini_time", (_e, data) => {
    if (miniWin && !miniWin.isDestroyed())
      miniWin.webContents.send("mini_time", data);
  });
  ipcMain.on("resize_mini", (_e, width, height) => {
    if (miniWin && !miniWin.isDestroyed()) {
      miniWin.desiredSize = { width, height };
      if (miniWin.isFullScreen()) return;
      miniWin.setResizable(true);
      miniWin.setSize(width, height);
      setTimeout(() => {
        if (miniWin && !miniWin.isDestroyed() && !miniWin.isFullScreen()) {
          miniWin.setResizable(false);
        }
      }, 150);
    }
  });
}

function stop() {
  if (miniWin) {
    miniWin.destroy();
    miniWin = null;
  }
}

module.exports = { register, stop };
