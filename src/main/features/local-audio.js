const http = require("http");
const fs = require("fs");
const path = require("path");
const { app } = require("electron");

const AUDIO_TYPES = {
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".flac": "audio/flac",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
};

let server = null;
let serverPort = 0;
let cachedTrackIds = null;
let cachedDirMtime = 0;

function getLocalTracksDir() {
  const dir = path.join(app.getPath("userData"), "SClient", "local_tracks");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getAvailableLocalTrackIds() {
  try {
    const dir = getLocalTracksDir();
    const mtime = fs.statSync(dir).mtimeMs;
    if (cachedTrackIds && cachedDirMtime === mtime) return cachedTrackIds;

    const ids = new Set();
    for (const file of fs.readdirSync(dir)) {
      const ext = path.extname(file).toLowerCase();
      if (AUDIO_TYPES[ext]) ids.add(path.parse(file).name);
    }

    cachedTrackIds = Array.from(ids);
    cachedDirMtime = mtime;
    return cachedTrackIds;
  } catch (e) {
    return [];
  }
}

function findLocalTrackFile(trackId) {
  if (!trackId) return null;
  const dir = getLocalTracksDir();
  for (const file of fs.readdirSync(dir)) {
    const ext = path.extname(file).toLowerCase();
    if (!AUDIO_TYPES[ext]) continue;
    if (path.parse(file).name === trackId) return path.join(dir, file);
  }
  return null;
}

function notFound(res, message) {
  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(message);
}

function parseRange(header, total) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;

  const [, startRaw, endRaw] = match;
  if (startRaw === "" && endRaw === "") return null;

  if (startRaw === "") {
    const suffix = parseInt(endRaw, 10);
    if (!Number.isFinite(suffix) || suffix <= 0) return null;
    return { start: Math.max(total - suffix, 0), end: total - 1 };
  }

  const start = parseInt(startRaw, 10);
  const end = endRaw === "" ? total - 1 : parseInt(endRaw, 10);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (start > end || start >= total) return null;
  return { start, end: Math.min(end, total - 1) };
}

function pipeFile(filePath, options, res) {
  const stream = fs.createReadStream(filePath, options);
  stream.on("error", (err) => {
    console.error("[SClient] Local audio file error:", err);
    if (res.headersSent) {
      res.destroy();
      return;
    }
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Internal Server Error");
  });
  stream.pipe(res);
}

function handleRequest(req, res) {
  const parsed = new URL(req.url, "http://127.0.0.1");
  const match = parsed.pathname.match(/^\/track\/([A-Za-z0-9_-]+)\/?$/);
  if (!match) return notFound(res, "Not Found");

  const filePath = findLocalTrackFile(match[1]);
  if (!filePath) return notFound(res, "Track not found");

  const total = fs.statSync(filePath).size;
  const headers = {
    "Content-Type": AUDIO_TYPES[path.extname(filePath).toLowerCase()],
    "Accept-Ranges": "bytes",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
  };

  if (req.headers.range) {
    const range = parseRange(req.headers.range, total);
    if (!range) {
      res.writeHead(416, { "Content-Range": `bytes */${total}` });
      res.end();
      return;
    }

    res.writeHead(206, {
      ...headers,
      "Content-Range": `bytes ${range.start}-${range.end}/${total}`,
      "Content-Length": range.end - range.start + 1,
    });
    pipeFile(filePath, range, res);
    return;
  }

  res.writeHead(200, { ...headers, "Content-Length": total });
  pipeFile(filePath, null, res);
}

function startServer() {
  if (server) return server.address()?.port || serverPort;

  server = http.createServer((req, res) => {
    try {
      handleRequest(req, res);
    } catch (err) {
      console.error("[SClient] Local audio request error:", err);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      }
      res.end("Internal Server Error");
    }
  });
  server.on("error", (err) => {
    console.error("[SClient] Local audio server error:", err);
    if (server && server.listening) server.close();
    server = null;
    serverPort = 0;
  });
  server.listen(0, "127.0.0.1", () => {
    serverPort = server.address().port;
  });

  return serverPort;
}

module.exports = {
  getLocalTracksDir,
  getAvailableLocalTrackIds,
  startServer,
};
