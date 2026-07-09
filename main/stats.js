const path = require("path");
const fetch = require("cross-fetch");
const config = require("./config");

let Database = null;
try {
	Database = require("better-sqlite3");
} catch (e) {
	console.error("[SClient] better-sqlite3 not available, stats disabled.");
}

const DB_PATH = path.join(config.CONFIG_DIR, "stats.db");

let db = null;
let syncTimer = null;
let syncing = false;
let insertStmt = null;
const credentials = { clientId: null, oauthToken: null };

function getDb() {
	if (!Database) return null;
	if (db) return db;
	try {
		db = new Database(DB_PATH);
		db.pragma("journal_mode = WAL");
		db.exec(`
      CREATE TABLE IF NOT EXISTS listens (
        played_at INTEGER NOT NULL,
        track_id INTEGER NOT NULL,
        track_json TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'api',
        PRIMARY KEY (played_at, track_id)
      )
    `);
		const cols = db.pragma("table_info(listens)");
		if (!cols.some((c) => c.name === "source")) {
			db.exec(
				"ALTER TABLE listens ADD COLUMN source TEXT NOT NULL DEFAULT 'api'",
			);
		}
		db.exec(
			"CREATE INDEX IF NOT EXISTS idx_listens_played_at ON listens(played_at)",
		);
		return db;
	} catch (e) {
		console.error("[SClient] Failed to open stats DB:", e);
		return null;
	}
}

async function syncPlayHistory() {
	if (
		!config.statsApiSyncEnabled ||
		!credentials.clientId ||
		!credentials.oauthToken
	)
		return;
	const database = getDb();
	if (!database || syncing) return;
	syncing = true;

	try {
		const insert = database.prepare(
			"INSERT OR IGNORE INTO listens (played_at, track_id, track_json, source) VALUES (?, ?, ?, ?)",
		);
		const insertMany = database.transaction((entries) => {
			for (const e of entries)
				insert.run(e.played_at, e.track_id, JSON.stringify(e.track), "api");
		});

		let url = `https://api-v2.soundcloud.com/me/play-history/tracks?client_id=${credentials.clientId}&limit=50&linked_partitioning=1&app_version=1782999645&app_locale=en`;
		let total = 0;

		while (url) {
			const res = await fetch(url, {
				headers: { Authorization: `OAuth ${credentials.oauthToken}` },
			});
			if (!res.ok) {
				const body = await res.text();
				console.error("[SClient] Stats sync HTTP error:", body.slice(0, 200));
				break;
			}
			const data = await res.json();
			if (data.collection && data.collection.length > 0) {
				const entries = data.collection.map((e) => ({
					played_at: e.played_at,
					track_id: e.track_id,
					track: e.track,
				}));
				insertMany(entries);
				total += entries.length;
			}
			url = data.next_href || null;
		}
		if (total > 0)
			console.log(`[SClient] Stats sync done — ${total} new entries.`);
	} catch (e) {
		console.error("[SClient] Stats sync error:", e);
	} finally {
		syncing = false;
	}
}

function storeCredentials(clientId, oauthToken) {
	credentials.clientId = clientId;
	credentials.oauthToken = oauthToken;
	syncPlayHistory();
	if (syncTimer) clearInterval(syncTimer);
	syncTimer = setInterval(() => {
		if (config.statsApiSyncEnabled) syncPlayHistory();
	}, 7200000);
}

function recordListen(playedAt, trackId, track) {
	const database = getDb();
	if (!database) return;
	try {
		if (!insertStmt) {
			insertStmt = database.prepare(
				"INSERT OR IGNORE INTO listens (played_at, track_id, track_json, source) VALUES (?, ?, ?, ?)",
			);
		}
		insertStmt.run(playedAt, trackId, JSON.stringify(track), "local");
	} catch (e) {
		console.error("[SClient] Stats record error:", e);
	}
}

function getData(source) {
	const database = getDb();
	if (!database) return [];
	try {
		let query = "SELECT played_at, track_id, track_json, source FROM listens";
		const params = [];
		if (source === "api" || source === "local") {
			query += " WHERE source = ?";
			params.push(source);
		}
		query += " ORDER BY played_at DESC";
		return database.prepare(query).all(...params);
	} catch (e) {
		console.error("[SClient] Stats get data failed:", e);
		return [];
	}
}

function wipeDb() {
	const database = getDb();
	if (!database) return;
	try {
		database.exec("DELETE FROM listens");
		console.log("[SClient] Stats DB wiped.");
	} catch (e) {
		console.error("[SClient] Stats wipe failed:", e);
	}
}

module.exports = {
	storeCredentials,
	recordListen,
	getData,
	wipeDb,
	syncPlayHistory,
};
