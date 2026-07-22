const { Client, StatusDisplayType } = require("@xhayper/discord-rpc");
const { app } = require("electron");

const CLIENT_ID = "1520494903954637072";

let rpc = null;
let login = null;

function buildRedirectUrl(trackId, artistSlug, trackSlug) {
  const p = new URLSearchParams();
  if (trackId) p.set('id', trackId);
  if (artistSlug) p.set('artist', artistSlug);
  if (trackSlug) p.set('track', trackSlug);
  return `https://sc.z-n.cc/redirect?${p.toString()}`;
}

async function updateRpc({ title, artist, isPlaying, artwork, timeStart, timeEnd, songUrl, trackId, artistSlug, trackSlug }) {
  if (!rpc) {
    rpc = new Client({ clientId: CLIENT_ID, transport: { type: "ipc" } });
    login = rpc.login().catch((e) => {
      console.error("[SClient] RPC Login failed:", e);
      rpc = null;
      login = null;
    });
  }

  if (login) await login;

  if (!isPlaying || !title) {
    if (rpc && rpc.user) {
      rpc.user
        .clearActivity()
        .catch((e) => console.error("[SClient] RPC clear activity failed:", e));
    }
    return;
  }

  const activity = {
    type: 2,
    statusDisplayType: StatusDisplayType.DETAILS,
    details: title,
    state: artist,
    largeImageKey: artwork || undefined,
    smallImageKey: "icon",
    smallImageText: `SClient | ${app.getVersion()}`,
    instance: false,
  };

  if (timeStart && timeEnd) {
    activity.startTimestamp = Math.floor(timeStart / 1000) * 1000;
    activity.endTimestamp = Math.floor(timeEnd / 1000) * 1000;
  }

  if (trackId) {
    activity.buttons = [
      { label: 'Listen on SoundCloud', url: buildRedirectUrl(trackId, artistSlug, trackSlug) },
    ];
  }

  if (rpc && rpc.user) {
    rpc.user
      .setActivity(activity)
      .catch((e) => console.error("[SClient] RPC set activity failed:", e));
  }
}

module.exports = { updateRpc };
