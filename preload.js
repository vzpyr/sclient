const { ipcRenderer, webFrame } = require("electron");

const ENDPOINTS = [
	"api-v2.soundcloud.com/resolve",
	"api-v2.soundcloud.com/tracks",
	"api-v2.soundcloud.com/playlists",
	"api-v2.soundcloud.com/media",
];

const proxyCfg = ipcRenderer.sendSync("get-proxy-config");

if (proxyCfg.enabled && proxyCfg.url && proxyCfg.url.startsWith("http")) {
	webFrame.executeJavaScript(`
(function() {
  var proxyUrl = '${proxyCfg.url}'
  var endpoints = ${JSON.stringify(ENDPOINTS)}

  var origFetch = window.fetch
  window.fetch = function() {
    var url = typeof arguments[0] === 'string' ? arguments[0] : (arguments[0] instanceof URL ? arguments[0].href : (arguments[0] && arguments[0].url || ''))
    if (endpoints.some(function(d) { return url.indexOf(d) !== -1 })) {
      var p = new URL(proxyUrl)
      p.searchParams.set('url', url)
      if (typeof arguments[0] === 'string' || arguments[0] instanceof URL) arguments[0] = p.toString()
      else if (arguments[0] instanceof Request) arguments[0] = new Request(p.toString(), arguments[0])
    }
    return origFetch.apply(this, arguments)
  }

  var origOpen = XMLHttpRequest.prototype.open
  XMLHttpRequest.prototype.open = function(method, url) {
    var f = typeof url === 'string' ? url : (url instanceof URL ? url.href : '')
    if (f && endpoints.some(function(d) { return f.indexOf(d) !== -1 })) {
      var p = new URL(proxyUrl)
      p.searchParams.set('url', f)
      f = p.toString()
    }
    arguments[1] = f
    return origOpen.apply(this, arguments)
  }
})()`);
}

const ua = navigator.userAgent;
const chromeVersion =
	(ua.match(/Chrome\/(\d+\.\d+\.\d+\.\d+)/) || [])[1] || "120.0.0.0";
const majorVersion = chromeVersion.split(".")[0];

const PLATFORMS = { win32: "Windows", darwin: "macOS", linux: "Linux" };
const platform = PLATFORMS[process.platform] || "Linux";

webFrame.executeJavaScript(`
(function() {
  var brands = [
    { brand: 'Google Chrome', version: '${majorVersion}' },
    { brand: 'Chromium', version: '${majorVersion}' },
    { brand: 'Not_A Brand', version: '8' }
  ]

  Object.defineProperty(navigator, 'userAgentData', {
    get: function() {
      return {
        brands: brands, mobile: false, platform: '${platform}',
        getHighEntropyValues: function() {
          return Promise.resolve({
            brands: brands, mobile: false, platform: '${platform}',
            platformVersion: '10.0.0', architecture: 'x86', model: '', bitness: '64'
          })
        }
      }
    },
    configurable: true
  })

  Object.defineProperty(navigator, 'webdriver', {
    get: function() { return false },
    configurable: true
  })
})()`);

window.addEventListener("message", (event) => {
	if (event.source !== window) return;
	if (!event.data || event.data.source !== "sclient-bridge") return;

	const { action, cmd, args, callbackId } = event.data;
	if (action !== "invoke") return;

	ipcRenderer
		.invoke(cmd, args)
		.then((result) => {
			window.postMessage(
				{ source: "sclient-bridge-reply", callbackId, success: true, result },
				"*",
			);
		})
		.catch((err) => {
			window.postMessage(
				{
					source: "sclient-bridge-reply",
					callbackId,
					success: false,
					error: err.message,
				},
				"*",
			);
		});
});
