const path = require("path");
const Database = require("better-sqlite3");

let config = null;

let db = null;
let syncTimer = null;
let syncing = false;
let insertStmt = null;
const credentials = { clientId: null, oauthToken: null };

function getDb() {
  if (db) return db;
  try {
    db = new Database(path.join(config.CONFIG_DIR, "stats.db"));
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
    console.error("[SClient] Couldn't open stats database:", e);
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

    while (url) {
      const res = await fetch(url, {
        headers: { Authorization: `OAuth ${credentials.oauthToken}` },
      });
      if (!res.ok) {
        const body = await res.text();
        console.error("[SClient] Couldn't sync stats:", body.slice(0, 200));
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
      }
      url = data.next_href || null;
    }
  } catch (e) {
    console.error("[SClient] Couldn't sync stats:", e);
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
    console.error("[SClient] Couldn't record stats:", e);
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
    console.error("[SClient] Couldn't load stats:", e);
    return [];
  }
}

function wipeDb() {
  const database = getDb();
  if (!database) return;
  try {
    database.exec("DELETE FROM listens");
  } catch (e) {
    console.error("[SClient] Couldn't wipe stats:", e);
  }
}

function exportDb(savePath) {
  const currentDb = getDb();
  if (!currentDb) throw new Error("Stats database not open");

  const newDb = new Database(savePath);
  newDb.pragma("journal_mode = WAL");
  newDb.exec(`
		CREATE TABLE IF NOT EXISTS listens (
			played_at INTEGER NOT NULL,
			track_id INTEGER NOT NULL,
			track_json TEXT NOT NULL,
			source TEXT NOT NULL DEFAULT 'api',
			PRIMARY KEY (played_at, track_id)
		)
	`);

  const rows = currentDb.prepare("SELECT * FROM listens").all();
  const insert = newDb.prepare(
    "INSERT OR IGNORE INTO listens (played_at, track_id, track_json, source) VALUES (?, ?, ?, ?)",
  );
  newDb.transaction(() => {
    for (const r of rows) {
      insert.run(r.played_at, r.track_id, r.track_json, r.source);
    }
  })();
  newDb.close();
}

function importDb(openPath, overwrite = false) {
  const currentDb = getDb();
  if (!currentDb) throw new Error("Stats database not open");

  const impDb = new Database(openPath);
  const hasListens = impDb
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='listens'",
    )
    .get();
  if (!hasListens) {
    impDb.close();
    throw new Error("Invalid stats database: missing listens table");
  }

  const rows = impDb.prepare("SELECT * FROM listens").all();
  impDb.close();

  if (rows.length > 0) {
    const first = rows[0];
    if (!(
      "played_at" in first &&
      "track_id" in first &&
      "track_json" in first
    )) {
      throw new Error("Invalid stats database: missing required columns");
    }
  }

  const insert = currentDb.prepare(
    "INSERT OR IGNORE INTO listens (played_at, track_id, track_json, source) VALUES (?, ?, ?, ?)",
  );
  currentDb.transaction(() => {
    if (overwrite) {
      currentDb.exec("DELETE FROM listens");
    }
    for (const r of rows) {
      insert.run(r.played_at, r.track_id, r.track_json, r.source || "api");
    }
  })();
}

function register({ ipcMain, config: cfg, dialog }) {
  config = cfg;

  ipcMain.handle("stats_store_credentials", async (_e, args) => {
    storeCredentials(args.clientId, args.oauthToken);
  });

  ipcMain.handle("stats_record_listen", (_e, args) => {
    recordListen(args.played_at, args.track_id, args.track);
  });

  ipcMain.handle("stats_get_data", (_e, args) => {
    return getData(args && args.source);
  });

  ipcMain.handle("stats_wipe_db", () => {
    wipeDb();
  });

  ipcMain.handle("stats_export_db", async (_e) => {
    const res = await dialog.showSaveDialog({
      title: "Export Stats Database",
      defaultPath: "soundcloud-stats.db",
      filters: [{ name: "Database", extensions: ["db", "sqlite", "sqlite3"] }],
    });
    if (res.canceled) throw new Error("cancelled");
    exportDb(res.filePath);
  });

  ipcMain.handle("stats_pick_import_file", async () => {
    const res = await dialog.showOpenDialog({
      title: "Import Stats Database",
      filters: [{ name: "Database", extensions: ["db", "sqlite", "sqlite3"] }],
      properties: ["openFile"],
    });
    if (res.canceled || res.filePaths.length === 0) return null;
    return res.filePaths[0];
  });

  ipcMain.handle("stats_execute_import", async (_e, args) => {
    importDb(args.filePath, args.overwrite);
  });
}

module.exports = { register };
