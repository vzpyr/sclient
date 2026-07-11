function applyAdblock() {
  if (window.__sc_adblock_installed) return;
  window.__sc_adblock_installed = true;

  const domains = ["adswizz.com", "doubleclick.net", "/ads"];

  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    const url = typeof args[0] === "string" ? args[0] : args[0]?.url || "";
    if (domains.some((d) => url.includes(d))) {
      return new Response(JSON.stringify({}), {
        status: 200,
        statusText: "OK",
        headers: new Headers({ "Content-Type": "application/json" }),
      });
    }
    return origFetch.apply(this, args);
  };

  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    if (typeof url === "string" && domains.some((d) => url.includes(d))) {
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
    return origOpen.call(this, method, url, ...rest);
  };
}
