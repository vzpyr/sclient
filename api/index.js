export default async function handler(req, res) {
  const url = new URL(req.url, `https://${req.headers.host}`);

  if (url.pathname === '/redirect') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end(`<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="icon" href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAQAAAC1+jfqAAAAIGNIUk0AAHomAACAhAAA+gAAAIDoAAB1MAAA6mAAADqYAAAXcJy6UTwAAAACYktHRAD/h4/MvwAAAAd0SU1FB+oGHBEiHq7dPccAAAAldEVYdGRhdGU6Y3JlYXRlADIwMjYtMDYtMjhUMTM6MzU6MTQrMDA6MDAjdTyZAAAAJXRFWHRkYXRlOm1vZGlmeQAyMDI2LTA2LTI4VDEzOjM1OjE0KzAwOjAwUiiEJQAAACh0RVh0ZGF0ZTp0aW1lc3RhbXAAMjAyNi0wNi0yOFQxNzozNDozMCswMDowMJwshzwAAADYSURBVCjPhdEhTkNhEATg7+f9aQttCAgSBBWgUWgSNCcAR57EcwEktyBowhEQ3OA5KiCcgIKiTUsX0UdDIaU7ZndG7MwuWakyEL8wUCllSv0/4jf6SqqFcghVMtC0uIZJzDNJYfxjzvPyjgtdD669z7h620bsx0Gcx2tEjOIqUs1nki1rDu0qNI2NJWc67twLSew51dHWkIyc2BSS7NGxF5mGtlWfPkwkhVz7bslTk09udGWEpm3rQjJy6xmzmGkWa9pN6rBLD7Wi57/qFYaOtBbIby4te/cXxmhxOkWRNSwAAAAASUVORK5CYII=">
<title>SClient</title>
<style>@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap");*{box-sizing:border-box;margin:0;padding:0}html,body{width:100%;height:100%;background:#0a0a0c;color:#fff;font-family:Inter,system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;padding:24px}.wrap{width:100%;max-width:900px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:4px;padding:4px}.wrap iframe{display:block;width:100%;height:166px;border:0}a.btn{padding:10px 20px;background:#f50;color:#fff;border-radius:4px;text-decoration:none;font-weight:600;font-size:14px}a.btn:hover{background:#e04800}.hint{opacity:0.4;font-size:13px}.hint a{color:#f50}</style></head>
<body>
<div class="wrap" id="embed"></div>
<a class="btn" id="openBtn" href="#">Open in SClient</a>
<span class="hint">Don't have SClient? <a href="https://github.com/vzpyr/sclient">Get it here</a></span>
<script>(function(){var q=new URLSearchParams(window.location.search);var id=q.get('id');var artist=q.get('artist');var track=q.get('track');var embed=document.getElementById('embed');var btn=document.getElementById('openBtn');if(id){embed.innerHTML='<iframe allow="autoplay" src="https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/'+encodeURIComponent(id)+'"></iframe>'}else{embed.innerHTML='<p style="opacity:0.4;text-align:center;padding:20px">No track specified</p>'}if(artist&&track){var protoUrl='sclient://redirect/'+encodeURIComponent(artist)+'/'+encodeURIComponent(track);btn.href=protoUrl;window.location=protoUrl}else{btn.textContent='Missing track info';btn.style.opacity='0.4'}})()</script>
</body>
</html>`);
  }

  const origin = req.headers.origin || "*";

  const setCors = () => {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "*");
  };

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Max-Age": "86400",
    });
    return res.end();
  }

  const target = url.searchParams.get("url");
  if (!target) {
    setCors();
    res.statusCode = 400;
    return res.end("Missing 'url'");
  }

  let finalUrl;
  try {
    const tu = new URL(target);
    if (!tu.hostname.endsWith("soundcloud.com") && !tu.hostname.endsWith("sndcdn.com")) {
      setCors();
      res.statusCode = 403;
      return res.end("Forbidden");
    }
    finalUrl = tu.toString();
  } catch {
    console.error("[SClient] Proxy: invalid URL:", target);
    setCors();
    res.statusCode = 400;
    return res.end("Invalid URL");
  }

  try {
    const outHeaders = {};
    for (const [k, v] of Object.entries(req.headers)) {
      const kl = k.toLowerCase();
      if (kl === "host" || kl === "origin" || kl === "referer") continue;
      outHeaders[k] = v;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(finalUrl, {
      method: req.method,
      headers: outHeaders,
      redirect: "follow",
      signal: controller.signal,
    });

    clearTimeout(timeout);

    response.headers.forEach((value, key) => {
      const kl = key.toLowerCase();
      if (kl === "content-encoding" || kl === "transfer-encoding" || kl === "content-length")
        return;
      res.setHeader(key, value);
    });

    setCors();
    res.statusCode = response.status;

    const reader = response.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        res.end();
        break;
      }
      res.write(value);
    }
  } catch (e) {
    console.error("[SClient] Proxy: fetch failed:", finalUrl, e.message);
    setCors();
    res.statusCode = 502;
    res.end();
  }
}
