const crypto = require("crypto");
const fetch = require("cross-fetch");
const { BrowserWindow } = require("electron");

let config = null;

function lastfmSig(params, secret) {
  const str =
    Object.keys(params)
      .sort()
      .map((k) => `${k}${params[k]}`)
      .join("") + secret;
  return crypto.createHash("md5").update(str, "utf8").digest("hex");
}

function lastfmCreds() {
  return {
    apiKey: config.getSecure("integrations.lastfm.api_key").trim(),
    secret: config.getSecure("integrations.lastfm.secret").trim(),
    sk: config.getSecure("integrations.lastfm.session_key").trim(),
  };
}

async function lastfmCall(method, extra = {}) {
  try {
    const { apiKey, secret, sk } = lastfmCreds();
    if (!apiKey || !secret || !sk) return { ok: false, code: 0 };
    const params = { method, api_key: apiKey, sk, ...extra };
    const api_sig = lastfmSig(params, secret);
    const res = await fetch("https://ws.audioscrobbler.com/2.0/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ ...params, api_sig, format: "json" }),
    });
    const data = await res.json();
    if (data.error) return { ok: false, code: data.error, message: data.message };
    return { ok: true };
  } catch (e) {
    console.error("[SClient] Last.fm error:", method, e);
    return { ok: false, code: 0, message: e.message };
  }
}

function register({ ipcMain, config: cfg }) {
  config = cfg;

  ipcMain.handle("lastfm_authenticate", async () => {
    const apiKey = config.getSecure("integrations.lastfm.api_key").trim();
    const secret = config.getSecure("integrations.lastfm.secret").trim();
    if (!apiKey || !secret) return { error: "Missing API key or secret" };

    return new Promise((resolve) => {
      let settled = false;
      const settle = (v) => {
        if (!settled) {
          settled = true;
          resolve(v);
        }
      };

      const win = new BrowserWindow({
        width: 850,
        height: 650,
        title: "Connect Last.fm",
        webPreferences: { nodeIntegration: false, contextIsolation: true },
      });

      win.loadURL(
        `https://www.last.fm/api/auth/?api_key=${apiKey}&cb=https://soundcloud.com/discover`
      );

      const handle = async (url) => {
        try {
          const token = new URL(url).searchParams.get("token");
          if (!token) return;
          const sig = lastfmSig({ method: "auth.getSession", api_key: apiKey, token }, secret);
          const res = await fetch(
            `https://ws.audioscrobbler.com/2.0/?method=auth.getSession&api_key=${apiKey}&token=${token}&api_sig=${sig}&format=json`
          );
          const data = await res.json();
          if (!win.isDestroyed()) win.close();
          if (data.error) {
            settle({ error: data.message });
          } else {
            config.setSecure("integrations.lastfm.session_key", data.session.key);
            config.set("integrations.lastfm.username", data.session.name);
            settle({ success: true, username: data.session.name });
          }
        } catch (e) {
          console.error("[SClient] Last.fm auth error:", e);
          settle({ error: e.message });
        }
      };

      win.webContents.on("will-redirect", (_e, url) => handle(url));
      win.webContents.on("will-navigate", (_e, url) => handle(url));
      win.on("closed", () => settle({ error: "cancelled" }));
    });
  });

  ipcMain.handle("lastfm_save_credentials", (_e, args) => {
    config.setSecure("integrations.lastfm.api_key", args.apiKey || "");
    config.setSecure("integrations.lastfm.secret", args.secret || "");
  });

  ipcMain.handle("lastfm_disconnect", () => {
    config.setSecure("integrations.lastfm.session_key", "");
    config.set("integrations.lastfm.username", "");
  });

  ipcMain.handle("lastfm_now_playing", async (_e, args) => {
    return lastfmCall("track.updateNowPlaying", {
      artist: args.artist,
      track: args.title,
    });
  });

  ipcMain.handle("lastfm_scrobble", async (_e, args) => {
    return lastfmCall("track.scrobble", {
      artist: args.artist,
      track: args.title,
      timestamp: args.timestamp.toString(),
    });
  });
}

module.exports = { register };
