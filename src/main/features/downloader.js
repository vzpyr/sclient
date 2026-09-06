const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const ytdlexec = require("youtube-dl-exec");

const hasFfmpeg = (() => {
  try {
    execSync("ffmpeg -version", { stdio: "ignore" });
    return true;
  } catch (e) {
    return false;
  }
})();

let ytdlBin = ytdlexec.constants.YOUTUBE_DL_PATH;
if (ytdlBin.includes("app.asar"))
  ytdlBin = ytdlBin.replace("app.asar", "app.asar.unpacked");
const ytdl = ytdlexec.create(ytdlBin);

const activeDownloads = new Map();

function sanitizeFileName(name) {
  if (!name) return "";
  return name.replace(/[/\\?%*:|"<>]/g, "_").trim();
}

function formatTrackFileName(track, isPlaylist) {
  const account = sanitizeFileName(track.account || "");
  const artist = sanitizeFileName(track.artist || "");
  const title = sanitizeFileName(track.title || "");
  const hasSeparateArtist =
    artist.length > 0 && artist.toLowerCase() !== account.toLowerCase();
  const prefix = isPlaylist && track.index ? `${track.index}. ` : "";
  if (!account) {
    return `${prefix}${title}`;
  }
  if (hasSeparateArtist) {
    return `${prefix}${account} - ${artist} - ${title}`;
  }
  return `${prefix}${account} - ${title}`;
}

function parseErrorReason(stderr) {
  if (!stderr) return null;
  if (stderr.includes("DRM protected")) {
    return "This track is DRM protected and cannot be downloaded.";
  }
  if (stderr.includes("HTTP Error 403")) {
    return "HTTP Error 403: Forbidden.";
  }
  if (stderr.includes("HTTP Error 429")) {
    return "Rate limited by SoundCloud. Please wait a few minutes.";
  }
  const match = stderr.match(/ERROR:\s*(?:\[[^\]]+\]\s*)?[^:]+:\s*(.+)$/m);
  if (match && match[1]) {
    const msg = match[1].trim();
    return msg.endsWith(".") ? msg : msg + ".";
  }
  return null;
}

function writeSkippedFile(targetDir, skipped) {
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  const skippedPath = path.join(targetDir, "!skipped.json");
  if (skipped.length > 0) {
    fs.writeFileSync(skippedPath, JSON.stringify(skipped, null, 2), "utf8");
  } else if (fs.existsSync(skippedPath)) {
    try {
      fs.unlinkSync(skippedPath);
    } catch (_) {}
  }
}

function executeTrackDownload(url, options, downloadItem, onProgress) {
  return new Promise((resolve, reject) => {
    const proc = ytdl.exec(url, options);
    proc.catch(() => {});
    downloadItem.currentProc = proc;

    let stdoutBuf = "";
    proc.stdout.on("data", (data) => {
      stdoutBuf += data.toString();
      const parts = stdoutBuf.split(/[\r\n]+/);
      stdoutBuf = parts.pop();
      for (const part of parts) {
        const match = part.match(/\[download\]\s+([\d\.]+)%/);
        if (match && match[1]) {
          onProgress(parseFloat(match[1]));
        }
      }
      const matchEnd = stdoutBuf.match(/\[download\]\s+([\d\.]+)%/);
      if (matchEnd && matchEnd[1]) {
        onProgress(parseFloat(matchEnd[1]));
      }
    });

    let stderr = "";
    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      downloadItem.currentProc = null;
      if (downloadItem.cancelled) {
        resolve();
      } else if (code === 0) {
        resolve();
      } else {
        reject(new Error(stderr || "Unknown error."));
      }
    });

    proc.on("error", (err) => {
      downloadItem.currentProc = null;
      if (downloadItem.cancelled) {
        resolve();
      } else {
        reject(err);
      }
    });
  });
}

function register({ ipcMain, app }) {
  ipcMain.handle("cancel_download", (_e, args) => {
    if (!args || !args.url) return;
    const item = activeDownloads.get(args.url);
    if (item) {
      item.cancelled = true;
      if (item.currentProc) {
        try {
          item.currentProc.kill("SIGTERM");
        } catch (_) {}
      }
    }
  });

  ipcMain.handle("download_song", async (_e, args) => {
    const downloadItem = { cancelled: false, currentProc: null };
    activeDownloads.set(args.url, downloadItem);

    const baseOptions = {
      format: "bestaudio/best",
      noWarnings: true,
    };
    if (hasFfmpeg) {
      baseOptions.extractAudio = true;
      baseOptions.audioFormat = "best";
      baseOptions.addMetadata = true;
      baseOptions.embedThumbnail = true;
    }

    try {
      if (args.isPlaylist) {
        const folderName = sanitizeFileName(args.playlistTitle || "Playlist");
        const playlistDir = path.join(app.getPath("downloads"), folderName);
        if (!fs.existsSync(playlistDir)) {
          fs.mkdirSync(playlistDir, { recursive: true });
        }

        const tracks = Array.isArray(args.tracks) ? args.tracks : [];
        if (tracks.length === 0) {
          throw new Error("Playlist has no tracks.");
        }
        const skipped = [];

        for (let i = 0; i < tracks.length; i++) {
          if (downloadItem.cancelled) return;

          const track = tracks[i];
          const baseName = formatTrackFileName(track, true);
          const outputTemplate = path.join(playlistDir, `${baseName}.%(ext)s`);

          const trackOptions = {
            ...baseOptions,
            output: outputTemplate,
          };

          try {
            await executeTrackDownload(
              track.url,
              trackOptions,
              downloadItem,
              (pct) => {
                const overall = tracks.length
                  ? ((i * 100 + pct) / tracks.length).toFixed(1)
                  : pct.toFixed(1);
                _e.sender.send("download_progress", {
                  url: args.url,
                  percent: overall,
                });
              },
            );
          } catch (err) {
            if (downloadItem.cancelled) return;
            const reason = parseErrorReason(err.message);
            const entry = {
              fileName: `${baseName}.m4a`,
              url: track.url || "",
            };
            if (reason) entry.error = reason;
            skipped.push(entry);
          }

          if (downloadItem.cancelled) return;

          _e.sender.send("download_progress", {
            url: args.url,
            percent: tracks.length
              ? (((i + 1) * 100) / tracks.length).toFixed(1)
              : "100.0",
          });
        }

        if (downloadItem.cancelled) return;

        writeSkippedFile(playlistDir, skipped);
      } else {
        const track = args.track || {
          url: args.url,
          title: "Track",
        };
        const baseName = formatTrackFileName(track, false);
        const outputTemplate = path.join(
          app.getPath("downloads"),
          `${baseName}.%(ext)s`,
        );

        const trackOptions = {
          ...baseOptions,
          output: outputTemplate,
        };

        try {
          await executeTrackDownload(
            args.url,
            trackOptions,
            downloadItem,
            (pct) => {
              _e.sender.send("download_progress", {
                url: args.url,
                percent: pct.toFixed(1),
              });
            },
          );
        } catch (err) {
          if (downloadItem.cancelled) return;
          const reason = parseErrorReason(err.message);
          const entry = {
            fileName: `${baseName}.m4a`,
            url: args.url,
          };
          if (reason) entry.error = reason;
          writeSkippedFile(app.getPath("downloads"), [entry]);
          throw new Error(reason || err.message || "Download failed.");
        }
      }
    } finally {
      activeDownloads.delete(args.url);
    }
  });
}

module.exports = { register };
