export default async function handler(req, res) {
  const origin = req.headers["origin"] || "*";

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Max-Age": "86400"
    });
    return res.end();
  }

  const url = new URL(req.url, `https://${req.headers.host}`);
  const target = url.searchParams.get("url");
  if (!target) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.statusCode = 400;
    return res.end("Missing 'url'");
  }

  let finalUrl;
  try {
    const tu = new URL(target);
    if (!tu.hostname.endsWith("soundcloud.com") && !tu.hostname.endsWith("sndcdn.com")) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.statusCode = 403;
      return res.end("Forbidden");
    }
    if (tu.pathname.includes("/media/")) {
      tu.searchParams.delete("track_authorization");
    }
    finalUrl = tu.toString();
  } catch {
    res.setHeader("Access-Control-Allow-Origin", origin);
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
    delete outHeaders["authorization"];

    const response = await fetch(finalUrl, {
      method: req.method,
      headers: outHeaders,
      redirect: "follow"
    });

    const body = Buffer.from(await response.arrayBuffer());

    response.headers.forEach((value, key) => {
      const kl = key.toLowerCase();
      if (kl === "content-encoding" || kl === "transfer-encoding" || kl === "content-length") return;
      res.setHeader(key, value);
    });

    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.statusCode = response.status;
    res.end(body);
  } catch (e) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.statusCode = 502;
    res.end();
  }
}
