function applyAdblock() {
	if (window.__sc_adblock_installed) return;
	window.__sc_adblock_installed = true;

	const adDomains = ["adswizz.com", "doubleclick.net", "/ads"];

	const originalFetch = window.fetch;
	window.fetch = async function (...args) {
		const url = typeof args[0] === "string" ? args[0] : args[0]?.url || "";
		if (adDomains.some((domain) => url.includes(domain))) {
			console.debug("[SClient] Blocked ad request (fetch):", url);
			return new Response(JSON.stringify({}), {
				status: 200,
				statusText: "OK",
				headers: new Headers({ "Content-Type": "application/json" }),
			});
		}
		return originalFetch.apply(this, args);
	};

	const originalXhrOpen = XMLHttpRequest.prototype.open;
	XMLHttpRequest.prototype.open = function (method, url, ...rest) {
		if (
			typeof url === "string" &&
			adDomains.some((domain) => url.includes(domain))
		) {
			console.debug("[SClient] Blocked ad request (xhr):", url);
			this.send = function () {
				Object.defineProperty(this, "readyState", {
					value: 4,
					writable: false,
				});
				Object.defineProperty(this, "status", { value: 200, writable: false });
				Object.defineProperty(this, "responseText", {
					value: "{}",
					writable: false,
				});
				this.dispatchEvent(new Event("readystatechange"));
				this.dispatchEvent(new Event("load"));
			};
		}
		return originalXhrOpen.call(this, method, url, ...rest);
	};
}
