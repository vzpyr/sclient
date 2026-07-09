export default async function handler(req, res) {
  const origin = req.headers.origin || '*'

  const setCors = () => {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Credentials', 'true')
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', '*')
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400'
    })
    return res.end()
  }

  const url = new URL(req.url, `https://${req.headers.host}`)
  const target = url.searchParams.get('url')
  if (!target) {
    setCors()
    res.statusCode = 400
    return res.end("Missing 'url'")
  }

  let finalUrl
  try {
    const tu = new URL(target)
    if (!tu.hostname.endsWith('soundcloud.com') && !tu.hostname.endsWith('sndcdn.com')) {
      setCors()
      res.statusCode = 403
      return res.end('Forbidden')
    }
    finalUrl = tu.toString()
  } catch {
    console.error('[SClient] Proxy: invalid URL:', target)
    setCors()
    res.statusCode = 400
    return res.end('Invalid URL')
  }

  try {
    const outHeaders = {}
    for (const [k, v] of Object.entries(req.headers)) {
      const kl = k.toLowerCase()
      if (kl === 'host' || kl === 'origin' || kl === 'referer') continue
      outHeaders[k] = v
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)

    const response = await fetch(finalUrl, {
      method: req.method,
      headers: outHeaders,
      redirect: 'follow',
      signal: controller.signal
    })

    clearTimeout(timeout)

    response.headers.forEach((value, key) => {
      const kl = key.toLowerCase()
      if (kl === 'content-encoding' || kl === 'transfer-encoding' || kl === 'content-length') return
      res.setHeader(key, value)
    })

    setCors()
    res.statusCode = response.status

    const reader = response.body.getReader()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) { res.end(); break }
      res.write(value)
    }
  } catch (e) {
    console.error('[SClient] Proxy: fetch failed:', finalUrl, e.message)
    setCors()
    res.statusCode = 502
    res.end()
  }
}
