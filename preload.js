const { ipcRenderer, webFrame } = require("electron");

const PROXY_ENDPOINTS = [
	"api-v2.soundcloud.com/resolve",
	"api-v2.soundcloud.com/tracks",
	"api-v2.soundcloud.com/playlists",
	"api-v2.soundcloud.com/media",
];

// region bypass proxy injection
const cfg = ipcRenderer.sendSync("get-proxy-config");

if (cfg.enabled && cfg.url && cfg.url.startsWith("http")) {
	const proxyJs = `
    (function() {
      var proxyUrl = '${cfg.url}';
      var endpoints = ${JSON.stringify(PROXY_ENDPOINTS)};

      var origFetch = window.fetch;
      window.fetch = function() {
        var args = arguments;
        var url = typeof args[0] === 'string' ? args[0] : (args[0] instanceof URL ? args[0].href : (args[0] && args[0].url || ''));
        if (endpoints.some(function(d) { return url.indexOf(d) !== -1; })) {
          var p = new URL(proxyUrl);
          p.searchParams.set('url', url);
          if (typeof args[0] === 'string' || args[0] instanceof URL) args[0] = p.toString();
          else if (args[0] instanceof Request) args[0] = new Request(p.toString(), args[0]);
        }
        return origFetch.apply(this, args);
      };

      var origOpen = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function(method, url) {
        var f = typeof url === 'string' ? url : (url instanceof URL ? url.href : '');
        if (f && endpoints.some(function(d) { return f.indexOf(d) !== -1; })) {
          var p = new URL(proxyUrl);
          p.searchParams.set('url', f);
          f = p.toString();
        }
        arguments[1] = f;
        return origOpen.apply(this, arguments);
      };
    })()`;

	webFrame.executeJavaScript(proxyJs);
}

// strip electron from UA
const ua = navigator.userAgent;
const chromeVersion =
	(ua.match(/Chrome\/(\d+\.\d+\.\d+\.\d+)/) || [])[1] || "120.0.0.0";
const majorVersion = chromeVersion.split(".")[0];

const PLATFORM_MAP = { win32: "Windows", darwin: "macOS", linux: "Linux" };
const platform = PLATFORM_MAP[process.platform] || "Linux";

webFrame.executeJavaScript(`
(function() {
  var brands = [
    { brand: 'Google Chrome', version: '${majorVersion}' },
    { brand: 'Chromium', version: '${majorVersion}' },
    { brand: 'Not_A Brand', version: '8' }
  ];

  var getHighEntropyValues = function() {
    return Promise.resolve({
      brands: brands, mobile: false, platform: '${platform}',
      platformVersion: '10.0.0', architecture: 'x86', model: '', bitness: '64'
    });
  };

  Object.defineProperty(navigator, 'userAgentData', {
    get: function() { return { brands: brands, mobile: false, platform: '${platform}', getHighEntropyValues: getHighEntropyValues }; },
    configurable: true
  });

  Object.defineProperty(navigator, 'webdriver', {
    get: function() { return false; },
    configurable: true
  });
})();
`);

// IPC bridge: forward renderer requests to main process
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
