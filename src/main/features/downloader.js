const { execSync } = require("child_process");

const hasFfmpeg = (() => {
  try {
    execSync("ffmpeg -version", { stdio: "ignore" });
    return true;
  } catch (e) {
    return false;
  }
})();

const ytdlexec = require("youtube-dl-exec");
let ytdlBin = ytdlexec.constants.YOUTUBE_DL_PATH;
if (ytdlBin.includes("app.asar")) ytdlBin = ytdlBin.replace("app.asar", "app.asar.unpacked");
const ytdl = ytdlexec.create(ytdlBin);

function register({ ipcMain, app }) {
  ipcMain.handle("download_song", async (_e, args) => {
    return new Promise((resolve, reject) => {
      const options = {
        format: "bestaudio/best",
        noWarnings: true,
        paths: app.getPath("downloads"),
      };
      if (hasFfmpeg) {
        options.extractAudio = true;
        options.audioFormat = "best";
        options.addMetadata = true;
        options.embedThumbnail = true;
      }
      if (args.isPlaylist) {
        options.output =
          "%(playlist_title)s/%(playlist_index)s. %(artist|uploader)s - %(title)s.%(ext)s";
        options.ignoreErrors = true;
      } else {
        options.output = "%(artist|uploader)s - %(title)s.%(ext)s";
      }
      const proc = ytdl.exec(args.url, options);
      proc.catch(() => {});

      let stdoutBuf = "";
      let currentTrack = 1;
      let totalTracks = 1;

      proc.stdout.on("data", (data) => {
        stdoutBuf += data.toString();
        const parts = stdoutBuf.split(/[\r\n]+/);
        stdoutBuf = parts.pop();
        for (const part of parts) {
          const vmatch = part.match(/\[download\] Downloading (?:video|item) (\d+) of (\d+)/);
          if (vmatch) {
            currentTrack = parseInt(vmatch[1], 10);
            totalTracks = parseInt(vmatch[2], 10);
          }
          const match = part.match(/\[download\]\s+([\d\.]+)%/);
          if (match && match[1]) {
            const pct = parseFloat(match[1]);
            const finalPct =
              args.isPlaylist && totalTracks ? ((currentTrack - 1) * 100 + pct) / totalTracks : pct;
            _e.sender.send("download_progress", { url: args.url, percent: finalPct.toFixed(1) });
          }
        }

        const matchEnd = stdoutBuf.match(/\[download\]\s+([\d\.]+)%/);
        if (matchEnd && matchEnd[1]) {
          const pct = parseFloat(matchEnd[1]);
          const finalPct =
            args.isPlaylist && totalTracks ? ((currentTrack - 1) * 100 + pct) / totalTracks : pct;
          _e.sender.send("download_progress", { url: args.url, percent: finalPct.toFixed(1) });
        }
      });

      let stderr = "";
      proc.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      proc.on("close", (code) => {
        const hasFatalError =
          stderr.includes("Unable to download JSON metadata") || stderr.includes("HTTP Error");
        if (code === 0 || (args.isPlaylist && !hasFatalError)) {
          resolve();
        } else {
          if (stderr.includes("DRM protected")) {
            reject(new Error("This track is DRM protected and cannot be downloaded."));
          } else if (hasFatalError) {
            reject(new Error("Rate limited by SoundCloud. Please wait a few minutes."));
          } else {
            const lines = stderr.split("\n").filter((l) => l.includes("ERROR:"));
            reject(
              new Error(
                lines.length > 0 ? lines.join(" | ") : `Unknown youtube-dl error. (${stderr})`
              )
            );
          }
        }
      });

      proc.on("error", (err) => {
        reject(new Error(`Unknown download error: ${err.message || err.toString()}`));
      });
    });
  });
}

module.exports = { register };
