const Player = require("mpris-service");

let player = null;
let getPositionOverride = null;

function init({ ipcMain, win }) {
  player = Player({
    name: "sclient",
    identity: "SClient",
    supportedUriSchemes: ["https"],
    supportedMimeTypes: ["audio/mpeg"],
    supportedInterfaces: ["player"],
  });

  player.canGoNext = true;
  player.canGoPrevious = true;
  player.canPlay = true;
  player.canPause = true;
  player.canSeek = true;
  player.canControl = true;
  player.playbackStatus = "Stopped";

  player.getPosition = function () {
    return getPositionOverride || 0;
  };

  function sendToRenderer(action) {
    if (win && !win.isDestroyed()) {
      win.webContents.send("mpris_command", action);
    }
  }

  player.on("play", () => sendToRenderer("play"));
  player.on("pause", () => sendToRenderer("pause"));
  player.on("playpause", () => sendToRenderer("playpause"));
  player.on("stop", () => sendToRenderer("stop"));
  player.on("next", () => sendToRenderer("next"));
  player.on("previous", () => sendToRenderer("previous"));

  player.on("seek", (offset) => {
    if (win && !win.isDestroyed()) {
      win.webContents.send("mpris_command", {
        action: "seek",
        offsetMicros: offset,
      });
    }
  });

  player.on("position", (args) => {
    if (win && !win.isDestroyed()) {
      win.webContents.send("mpris_command", {
        action: "setPosition",
        positionMicros: args.position,
      });
    }
  });

  player.on("volume", (volume) => {
    if (win && !win.isDestroyed()) {
      win.webContents.send("mpris_command", {
        action: "volume",
        volume,
      });
    }
  });

  ipcMain.on("mpris_update", (_e, data) => {
    if (!player) return;

    const { title, artist, artwork, isPlaying, position, duration, songUrl } =
      data;

    player.playbackStatus = isPlaying ? "Playing" : "Paused";

    const positionMicros = Math.floor((position || 0) * 1000000);
    const durationMicros = Math.floor((duration || 0) * 1000000);
    getPositionOverride = positionMicros;

    const volume = data.volume != null ? data.volume : 1;

    player.metadata = {
      "mpris:trackid": player.objectPath("track/now"),
      "mpris:length": durationMicros,
      "mpris:artUrl": artwork || "",
      "xesam:title": title || "",
      "xesam:artist": [artist || ""],
      "xesam:url": songUrl || "",
    };
    player.volume = volume;
  });
}

function stop() {
  if (player) {
    player.playbackStatus = "Stopped";
    player = null;
  }
}

function register({ ipcMain, win }) {
  init({ ipcMain, win });
}

module.exports = { init, stop, register };
