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
		loginPromise = rpcClient.login().catch((e) => {
			console.error("[SClient] RPC Login failed:", e);
			rpcClient = null;
			loginPromise = null;
		});
	}

	if (loginPromise) await loginPromise;

	if (!isPlaying || !title) {
		if (rpcClient && rpcClient.user) {
			rpcClient.user.clearActivity().catch((e) => {
				console.error("[SClient] RPC clear activity failed:", e);
			});
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
		rpcClient.user.setActivity(activity).catch((e) => {
			console.error("[SClient] RPC set activity failed:", e);
		});
	}
}

module.exports = { updateRpc };
