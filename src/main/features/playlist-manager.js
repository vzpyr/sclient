const fs = require("fs");

function register({ ipcMain, dialog }) {
  ipcMain.handle("playlist_save_file", async (_e, args) => {
    const res = await dialog.showSaveDialog({
      title: "Export Playlist",
      defaultPath: args.defaultName || "playlist.json",
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (res.canceled) return { ok: false, canceled: true };
    fs.writeFileSync(res.filePath, args.content, "utf8");
    return { ok: true, path: res.filePath };
  });

  ipcMain.handle("playlist_pick_import_file", async () => {
    const res = await dialog.showOpenDialog({
      title: "Import Playlist",
      filters: [{ name: "Playlist Files", extensions: ["json", "csv"] }],
      properties: ["openFile"],
    });
    if (res.canceled || res.filePaths.length === 0) return null;
    return fs.readFileSync(res.filePaths[0], "utf8");
  });
}

module.exports = { register };
