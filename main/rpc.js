const { Client, StatusDisplayType } = require("@xhayper/discord-rpc");

const CLIENT_ID = "1520494903954637072";

let rpcClient = null;
let loginPromise = null;

async function updateRpc({
	title,
	artist,
	isPlaying,
	artwork,
	timeStart,
	timeEnd,
	songUrl,
}) {
	if (!rpcClient) {
		rpcClient = new Client({ clientId: CLIENT_ID, transport: { type: "ipc" } });
		loginPromise = rpcClient.login().catch((err) => {
			console.error("[SClient] RPC Login failed:", err);
			rpcClient = null;
			loginPromise = null;
		});
	}

	if (loginPromise) await loginPromise;

	if (!isPlaying || !title) {
		if (rpcClient && rpcClient.user) {
			rpcClient.user.clearActivity().catch(() => {});
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
		smallImageText: "SClient | 0.1",
		instance: false,
	};

	if (songUrl) {
		activity.buttons = [{ label: "Listen on SoundCloud", url: songUrl }];
	}

	if (timeStart && timeEnd) {
		activity.startTimestamp = Math.floor(timeStart / 1000) * 1000;
		activity.endTimestamp = Math.floor(timeEnd / 1000) * 1000;
	}

	if (rpcClient && rpcClient.user) {
		rpcClient.user.setActivity(activity).catch((err) => {
			console.error("[SClient] Failed to set activity:", err);
		});
	}
}

module.exports = { updateRpc };
