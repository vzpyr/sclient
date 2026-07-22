function toggleHtml({ label, toggleId, bgId, sliderId }) {
  return `<div class="sc-card">
  <span style="font-size:var(--sc-text-base);font-weight:500;">${label}</span>
  ${toggleLabelHtml(toggleId, bgId, sliderId)}
</div>`;
}

function toggleLabelHtml(toggleId, bgId, sliderId) {
  return `<label style="position:relative;display:inline-block;width:44px;height:24px;">
    <input type="checkbox" id="${toggleId}" style="opacity:0;width:0;height:0;">
    <span id="${bgId}" style="position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background-color:#333;transition:.3s;border-radius:24px;">
      <span id="${sliderId}" style="position:absolute;height:18px;width:18px;left:3px;bottom:3px;background-color:white;transition:.3s;border-radius:50%;"></span>
    </span>
  </label>`;
}

function updateToggle(bg, slider, checked) {
  bg.style.backgroundColor = checked ? getAccent() : "#333";
  slider.style.transform = checked ? "translateX(20px)" : "translateX(0)";
}

function setupToggle(overlay, { toggleId, bgId, sliderId, initial, onChange }) {
  const toggle = overlay.querySelector("#" + toggleId);
  const bg = overlay.querySelector("#" + bgId);
  const slider = overlay.querySelector("#" + sliderId);
  toggle.checked = initial;
  updateToggle(bg, slider, initial);
  toggle.addEventListener("change", (e) => {
    updateToggle(bg, slider, e.target.checked);
    if (onChange) onChange(e.target.checked);
  });
  return { toggle, bg, slider };
}

function highlight(text, patterns) {
  let html = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const tokens = [];
  for (const [re, color] of patterns) {
    html = html.replace(re, (m, ...groups) => {
      const content = groups[0] != null && groups[1] != null ? groups[0] + groups[1] : m;
      const idx = tokens.length;
      tokens.push(`<span style="color:${color};">${content}</span>`);
      return `__T${idx}__`;
    });
  }
  html = html.replace(/__T(\d+)__/g, (_, i) => tokens[+i]);
  if (text[text.length - 1] === "\n") html += " ";
  return html;
}

function highlightCss(text) {
  return highlight(text, [
    [/(\/\*[\s\S]*?\*\/)/g, "#6a9955"],
    [/([.#][a-zA-Z0-9_-]+)(?=[\s{])/g, "#d7ba7d"],
    [/([a-zA-Z-]+)\s*(?=:)/g, "#9cdcfe"],
    [/(:\s*)([^;}]+)(?=;|\})/g, "#ce9178"],
  ]);
}

function highlightJs(text) {
  return highlight(text, [
    [/(\/\/.*)/g, "#6a9955"],
    [/('.*?'|".*?"|`[\s\S]*?`)/g, "#ce9178"],
    [
      /\b(const|let|var|function|return|if|else|for|while|try|catch|async|await|class|new|this|import|export|from|true|false|null|undefined)\b/g,
      "#569cd6",
    ],
    [/\b([a-zA-Z0-9_]+)(?=\s*\()/g, "#dcdcaa"],
  ]);
}

function setupEditors(overlay) {
  const $ = (id) => overlay.querySelector(id);
  const cssEd = $("#sclient-css-editor"),
    jsEd = $("#sclient-js-editor");
  const cssHl = $("#sclient-css-highlight"),
    jsHl = $("#sclient-js-highlight");
  const cssCon = $("#sclient-css-container"),
    jsCon = $("#sclient-js-container");
  const tabCss = $("#tab-css"),
    tabJs = $("#tab-js");

  const sync = (hl, fn) => (ed) => {
    hl.innerHTML = fn(ed.value);
  };
  const updateCss = sync(cssHl, highlightCss);
  const updateJs = sync(jsHl, highlightJs);

  cssEd.addEventListener("input", () => updateCss(cssEd));
  jsEd.addEventListener("input", () => updateJs(jsEd));
  cssEd.addEventListener("scroll", () => {
    cssHl.scrollTop = cssEd.scrollTop;
    cssHl.scrollLeft = cssEd.scrollLeft;
  });
  jsEd.addEventListener("scroll", () => {
    jsHl.scrollTop = jsEd.scrollTop;
    jsHl.scrollLeft = jsEd.scrollLeft;
  });

  const switchTab = (active, inactive, show, hide) => {
    active.style.background = getAccent();
    active.style.color = "white";
    inactive.style.background = "#333";
    inactive.style.color = "#ccc";
    show.style.display = "block";
    hide.style.display = "none";
  };
  tabCss.addEventListener("click", () => switchTab(tabCss, tabJs, cssCon, jsCon));
  tabJs.addEventListener("click", () => switchTab(tabJs, tabCss, jsCon, cssCon));

  cssEd.value = currentCss;
  jsEd.value = currentJs;
  updateCss(cssEd);
  updateJs(jsEd);
}

function renderAccounts(overlay) {
  sendBridge("get_accounts")
    .then((accounts) => {
      sendBridge("get_active_account")
        .then((active) => {
          const list = overlay.querySelector("#sclient-accounts-list");
          list.replaceChildren();
          for (const acc of accounts) {
            const div = document.createElement("div");
            div.style.cssText =
              "display:flex;justify-content:space-between;align-items:center;padding:8px;background:rgba(255,255,255,0.05);border-radius:4px;";

            const name = document.createElement("span");
            name.textContent = acc;
            if (acc === active) {
              name.style.cssText = `color:${getAccent()};font-weight:bold;`;
              name.textContent += " (Active)";
            }

            const btns = document.createElement("div");
            btns.style.cssText = "display:flex;gap:5px;";

            if (acc !== active) {
              const sw = document.createElement("button");
              sw.textContent = "Switch";
              sw.className = "sc-btn";
              sw.style.padding = "4px 8px";
              sw.onclick = () =>
                sendBridge("set_active_account", { name: acc })
                  .then(() => sendBridge("restart_app"))
                  .catch((e) => {
                    console.error("[SClient] Account switch failed:", e);
                    showToast("Switch Error: " + e);
                  });
              btns.appendChild(sw);
            }

            if (acc !== "main" && acc !== active) {
              const del = document.createElement("button");
              del.textContent = "Delete";
              del.className = "sc-btn sc-btn-danger";
              del.style.padding = "4px 8px";
              del.onclick = () =>
                showConfirm("Delete account " + acc + "?").then((ok) => {
                  if (ok)
                    sendBridge("delete_account", { name: acc })
                      .then(() => renderAccounts(overlay))
                      .catch((e) => {
                        console.error("[SClient] Account delete failed:", e);
                        showToast("Delete Error: " + e);
                      });
                });
              btns.appendChild(del);
            }

            if (acc === "main") {
              const rst = document.createElement("button");
              rst.textContent = "Reset";
              rst.className = "sc-btn sc-btn-danger";
              rst.style.padding = "4px 8px";
              rst.onclick = () => {
                const msg =
                  acc === active
                    ? "Clear all cookies and browser data? The app will restart."
                    : "Clear all cookies and browser data for main profile?";
                showConfirm(msg).then((ok) => {
                  if (ok) sendBridge(acc === active ? "clear_data_and_restart" : "clear_data");
                });
              };
              btns.appendChild(rst);
            }

            div.appendChild(name);
            div.appendChild(btns);
            list.appendChild(div);
          }
        })
        .catch((e) => {
          console.error("[SClient] Set active account failed:", e);
          showToast("Active Account Error: " + e);
        });
    })
    .catch((e) => {
      console.error("[SClient] Get accounts failed:", e);
      showToast("Get Accounts Error: " + e);
    });
}

function createOverlay() {
  if (document.getElementById("sclient-settings-overlay")) return;

  const accent = getAccent();
  const overlay = document.createElement("div");
  overlay.id = "sclient-settings-overlay";
  overlay.style.cssText = `
    position:fixed;top:0;right:-450px;width:400px;height:100%;
    background:rgba(18,18,18,0.95);backdrop-filter:blur(10px);
    border-left:1px solid rgba(255,255,255,0.1);
    box-shadow:-5px 0 25px rgba(0,0,0,0.5);z-index:999999;
    transition:right 0.3s ease;display:flex;flex-direction:column;
    color:#fff;font-family:'Inter',system-ui,-apple-system,sans-serif;
    padding:20px;box-sizing:border-box;
  `;

  const TOGGLES = [
    { label: "Enable Enhanced Header", id: "enhanced-header" },
    { label: "Enable Collapsible Sidebar", id: "collapsible-sidebar" },
    { label: "Enable Discord Rich Presence", id: "rpc" },
    { label: "Enable System Tray (Minimize to background)", id: "tray" },
    { label: "Enable Adblocker", id: "adblock" },
    { label: "Enable Lazy Scroll Button", id: "lazy-scroll" },
    { label: "Disable Window Decorations", id: "decorations" },
    { label: "Hide Subscription Upsell", id: "upsell" },
    { label: "Hide Artist Features", id: "artists" },
  ];

  const togglesHtml = TOGGLES.map((t) =>
    toggleHtml({
      label: t.label,
      toggleId: `sclient-${t.id}-toggle`,
      bgId: `sclient-toggle-bg-${t.id}`,
      sliderId: `sclient-toggle-slider-${t.id}`,
    })
  ).join("");

  overlay.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;border-bottom:1px solid var(--sc-border);padding-bottom:10px;">
      <h3 style="margin:0;font-size:var(--sc-text-xl);font-weight:600;color:var(--sc-accent);display:flex;align-items:center;gap:8px;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
        SClient Settings
      </h3>
      <button id="sclient-close-btn" class="sc-btn sc-btn-ghost" style="padding:4px 8px;font-size:var(--sc-text-xl);">&times;</button>
    </div>

    <style>
      #sclient-settings-scroll::-webkit-scrollbar { width:8px; }
      #sclient-settings-scroll::-webkit-scrollbar-track { background:rgba(0,0,0,0.2);border-radius:4px; }
      #sclient-settings-scroll::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.2);border-radius:4px; }
      #sclient-settings-scroll::-webkit-scrollbar-thumb:hover { background:rgba(255,255,255,0.3); }
      #sclient-settings-scroll label { flex-shrink:0; }
      .sc-card { display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; padding:12px; background:var(--sc-btn-bg); border-radius:var(--sc-radius-lg); border:1px solid var(--sc-border); transition:background 0.2s ease, border-color 0.2s ease, transform 0.15s ease; }
      .sc-card:hover { background:var(--sc-btn-bg-hover); border-color:var(--sc-border-hover); }
    </style>

    <div id="sclient-settings-scroll" style="flex:1;overflow-y:auto;overflow-x:hidden;padding-right:8px;display:flex;flex-direction:column;min-height:0;margin-bottom:15px;">

      <div class="sc-card">
        <span style="font-size:14px;font-weight:500;">Custom Accent Color</span>
        <div style="display:flex;align-items:center;gap:10px;">
          <input type="color" id="sclient-accent-color-picker" style="width:24px;height:24px;padding:0;border:none;border-radius:4px;cursor:pointer;background:transparent;">
          <input type="text" id="sclient-accent-color-text" class="sc-input" style="width:60px;padding:4px;font-family:monospace;font-size:12px;text-transform:uppercase;">
          ${toggleLabelHtml("sclient-accent-toggle", "sclient-toggle-bg-accent", "sclient-toggle-slider-accent")}
        </div>
      </div>

      <div class="sc-card">
        <span style="font-size:14px;font-weight:500;">Custom Background Color (Dark Mode)</span>
        <div style="display:flex;align-items:center;gap:10px;">
          <input type="color" id="sclient-bg-color-picker" style="width:24px;height:24px;padding:0;border:none;border-radius:4px;cursor:pointer;background:transparent;">
          <input type="text" id="sclient-bg-color-text" class="sc-input" style="width:60px;padding:4px;font-family:monospace;font-size:12px;text-transform:uppercase;">
          ${toggleLabelHtml("sclient-bg-color-toggle", "sclient-toggle-bg-bg-color", "sclient-toggle-slider-bg-color")}
        </div>
      </div>

      <div class="sc-card">
        <span style="font-size:14px;font-weight:500;">Custom Font</span>
        <div style="display:flex;align-items:center;gap:10px;">
          <input type="text" id="sclient-custom-font-text" class="sc-input" placeholder="e.g. Roboto" style="width:120px;padding:4px;font-family:monospace;font-size:12px;">
          ${toggleLabelHtml("sclient-custom-font-toggle", "sclient-toggle-bg-custom-font", "sclient-toggle-slider-custom-font")}
        </div>
      </div>

      ${togglesHtml}

      <div class="sc-card">
        <span style="font-size:14px;font-weight:500;">Enable Wide Layout</span>
        <div style="display:flex;align-items:center;gap:10px;">
          <input type="text" id="sclient-wide-layout-width" class="sc-input" placeholder="1200" style="width:50px;padding:4px;font-family:monospace;font-size:12px;text-align:center;" title="Max width in px (min 960)">
          ${toggleLabelHtml("sclient-wide-layout-toggle", "sclient-toggle-bg-wide-layout", "sclient-toggle-slider-wide-layout")}
        </div>
      </div>

      <div style="margin-bottom:15px;padding:12px;background:rgba(255,255,255,0.05);border-radius:8px;border:1px solid rgba(255,255,255,0.1);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <span style="font-size:14px;font-weight:500;">ListenBrainz Scrobbling</span>
          <div style="display:flex;align-items:center;gap:10px;">
            <span id="sclient-listenbrainz-status" style="font-size:11px;font-weight:bold;padding:2px 6px;border-radius:4px;background:rgba(255,255,255,0.1);color:#ccc;">Waiting...</span>
            ${toggleLabelHtml("sclient-listenbrainz-toggle", "sclient-toggle-bg-listenbrainz", "sclient-toggle-slider-listenbrainz")}
          </div>
        </div>
        <input type="password" id="sclient-listenbrainz-token-input" class="sc-input" placeholder="Enter ListenBrainz User Token...">
        <div style="margin-top:5px;font-size:11px;color:#888;">Get your token from <a href="https://listenbrainz.org/settings/" target="_blank" style="color:#aaa;text-decoration:underline;">listenbrainz.org/settings</a></div>
      </div>

      <div style="margin-bottom:15px;padding:12px;background:rgba(255,255,255,0.05);border-radius:8px;border:1px solid rgba(255,255,255,0.1);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
          <span style="font-size:14px;font-weight:500;">Last.fm Scrobbling</span>
          <div style="display:flex;align-items:center;gap:10px;">
            <span id="sclient-lastfm-status" style="font-size:11px;font-weight:bold;padding:2px 6px;border-radius:4px;background:rgba(255,255,255,0.1);color:#ccc;">Waiting...</span>
            ${toggleLabelHtml("sclient-lastfm-toggle", "sclient-toggle-bg-lastfm", "sclient-toggle-slider-lastfm")}
          </div>
        </div>
        <input type="text" id="sclient-lastfm-apikey-input" class="sc-input" placeholder="API Key" style="margin-bottom:6px;">
        <input type="password" id="sclient-lastfm-secret-input" class="sc-input" placeholder="Shared Secret" style="margin-bottom:8px;">
        <div style="display:flex;gap:8px;align-items:center;">
          <button id="sclient-lastfm-connect-btn" class="sc-btn sc-btn-primary" style="flex:1;">Connect Last.fm Account</button>
          <button id="sclient-lastfm-disconnect-btn" class="sc-btn sc-btn-danger" style="display:none;">Disconnect</button>
        </div>
        <div id="sclient-lastfm-connected-info" style="margin-top:6px;font-size:11px;color:#888;display:none;">Connected as: <span id="sclient-lastfm-username" style="color:${accent};font-weight:600;"></span></div>
        <div style="margin-top:5px;font-size:11px;color:#888;">Get your API key from <a href="https://www.last.fm/api/account/create" target="_blank" style="color:#aaa;text-decoration:underline;">last.fm/api/account/create</a></div>
      </div>

      <div style="margin-bottom:15px;padding:12px;background:rgba(255,255,255,0.05);border-radius:8px;border:1px solid rgba(255,255,255,0.1);">
        <span style="font-size:14px;font-weight:500;display:block;margin-bottom:12px;">Listening Stats</span>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:13px;color:#ccc;">History Sync</span>
            <span style="font-size:10px;color:#666;">(every 2h)</span>
          </div>
          ${toggleLabelHtml("sclient-stats-api-toggle", "sclient-toggle-bg-stats-api", "sclient-toggle-slider-stats-api")}
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:13px;color:#ccc;">Local Tracking</span>
            <span id="sclient-stats-status" style="font-size:10px;font-weight:bold;padding:1px 6px;border-radius:4px;background:rgba(255,255,255,0.1);color:#666;">--</span>
          </div>
          ${toggleLabelHtml("sclient-stats-local-toggle", "sclient-toggle-bg-stats-local", "sclient-toggle-slider-stats-local")}
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          <button id="sclient-stats-analytics-btn" class="sc-btn sc-btn-primary" style="flex:1;">Open Analytics</button>
          <button id="sclient-stats-wipe-btn" class="sc-btn sc-btn-danger">Wipe Data</button>
        </div>
      </div>

      <div style="margin-bottom:15px;padding:12px;background:rgba(255,255,255,0.05);border-radius:8px;border:1px solid rgba(255,255,255,0.1);">
        <span style="font-size:14px;font-weight:500;display:block;margin-bottom:12px;">Playlist Manager</span>
        <button id="sclient-playlists-btn" class="sc-btn sc-btn-primary" style="width:100%;">Open Playlist Manager</button>
      </div>

      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:15px;padding:12px;background:rgba(255,255,255,0.05);border-radius:8px;border:1px solid rgba(255,255,255,0.1);">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:14px;font-weight:500;">Enable True Shuffle (Fix native shuffle)</span>
          ${toggleLabelHtml("sclient-trueshuffle-toggle", "sclient-toggle-bg-trueshuffle", "sclient-toggle-slider-trueshuffle")}
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:12px;color:#888;">Engine:</span>
          <select id="sclient-trueshuffle-engine" style="-webkit-appearance:none;appearance:none;background:rgba(0,0,0,0.5) url('data:image/svg+xml;utf8,<svg fill=%22%23ccc%22 height=%2224%22 viewBox=%220 0 24 24%22 width=%2224%22 xmlns=%22http://www.w3.org/2000/svg%22><path d=%22M7 10l5 5 5-5z%22/></svg>') no-repeat right 4px center;padding:6px 28px 6px 10px;border:1px solid #333;color:white;border-radius:6px;font-family:Inter,sans-serif;font-size:12px;outline:none;cursor:pointer;transition:border-color 0.2s;">
            <option value="native" style="background:#1e1e1e;color:white;">Native (song ~1-50 won't be shuffled)</option>
            <option value="api" style="background:#1e1e1e;color:white;">API (overrides full order in the UI)</option>
          </select>
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:15px;padding:12px;background:rgba(255,255,255,0.05);border-radius:8px;border:1px solid rgba(255,255,255,0.1);">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:14px;font-weight:500;">Enable Region Bypass Proxy</span>
          ${toggleLabelHtml("sclient-regionbypass-toggle", "sclient-toggle-bg-regionbypass", "sclient-toggle-slider-regionbypass")}
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
          <span style="font-size:12px;color:#888;white-space:nowrap;flex-shrink:0;">Proxy URL:</span>
          <input type="text" id="sclient-proxyurl-input" placeholder="https://example.com/" style="flex:1;min-width:0;background:rgba(0,0,0,0.5);border:1px solid #333;color:white;border-radius:4px;padding:4px 8px;font-family:Inter,sans-serif;font-size:12px;outline:none;transition:border-color 0.2s;">
          <button id="sclient-proxyurl-public-btn" class="sc-btn" style="flex-shrink:0;white-space:nowrap;padding:4px 8px;font-size:11px;">Use Public</button>
        </div>
        <div style="font-size:10px;color:#666;margin-top:2px;">Opening profile may geo-lock some songs</div>
        <div style="font-size:10px;color:#f88;margin-top:2px;">Disclaimer: Whoever runs the proxy server can (in theory) steal your credentials by intercepting your traffic.</div>
      </div>

      <div style="display:flex;gap:10px;margin-bottom:15px;">
        <button id="tab-css" class="sc-btn sc-btn-primary" style="flex:1;">Custom CSS</button>
        <button id="tab-js" class="sc-btn" style="flex:1;">Custom JS</button>
      </div>

      <div style="flex:1 0 400px;min-height:400px;display:flex;flex-direction:column;margin-bottom:20px;position:relative;border:1px solid #333;border-radius:4px;background:#0c0c0c;">
        <div id="sclient-css-container" style="flex:1;position:relative;overflow:hidden;display:block;">
          <pre id="sclient-css-highlight" aria-hidden="true" style="margin:0;position:absolute;top:0;left:0;width:100%;height:100%;padding:10px;box-sizing:border-box;font-family:'Fira Code',Consolas,monospace;font-size:13px;line-height:1.5;color:#ccc;pointer-events:none;white-space:pre-wrap;word-wrap:break-word;overflow:hidden;"></pre>
          <textarea id="sclient-css-editor" spellcheck="false" style="margin:0;position:absolute;top:0;left:0;width:100%;height:100%;background:transparent;color:transparent;caret-color:#fff;border:none;font-family:'Fira Code',Consolas,monospace;font-size:13px;line-height:1.5;padding:10px;resize:none;box-sizing:border-box;outline:none;white-space:pre-wrap;word-wrap:break-word;" placeholder="/* Add your custom CSS here */"></textarea>
        </div>
        <div id="sclient-js-container" style="flex:1;position:relative;overflow:hidden;display:none;">
          <pre id="sclient-js-highlight" aria-hidden="true" style="margin:0;position:absolute;top:0;left:0;width:100%;height:100%;padding:10px;box-sizing:border-box;font-family:'Fira Code',Consolas,monospace;font-size:13px;line-height:1.5;color:#ccc;pointer-events:none;white-space:pre-wrap;word-wrap:break-word;overflow:hidden;"></pre>
          <textarea id="sclient-js-editor" spellcheck="false" style="margin:0;position:absolute;top:0;left:0;width:100%;height:100%;background:transparent;color:transparent;caret-color:#fff;border:none;font-family:'Fira Code',Consolas,monospace;font-size:13px;line-height:1.5;padding:10px;resize:none;box-sizing:border-box;outline:none;white-space:pre-wrap;word-wrap:break-word;" placeholder="// Add your custom JS here"></textarea>
        </div>
      </div>

      <div style="margin-top:20px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.1);margin-bottom:20px;">
        <span style="font-size:16px;font-weight:bold;margin-bottom:15px;display:block;">Accounts</span>
        <div id="sclient-accounts-list" style="display:flex;flex-direction:column;gap:8px;margin-bottom:15px;"></div>
        <div style="display:flex;gap:8px;">
          <input type="text" id="sclient-new-account-name" class="sc-input" placeholder="New Profile Name" style="flex:1;padding:8px;font-family:monospace;">
          <button id="sclient-add-account-btn" class="sc-btn sc-btn-primary">+ Add Account</button>
        </div>
      </div>
    </div>

    <div style="display:flex;gap:10px;margin-bottom:10px;">
      <button id="sclient-save-btn" class="sc-btn sc-btn-primary" style="flex:1;padding:12px;font-weight:bold;">Save &amp; Apply</button>
    </div>
    <div style="margin-top:10px;text-align:center;font-size:11px;color:#666;">
      Press <kbd style="background:#333;padding:2px 5px;border-radius:3px;color:#ccc;">Ctrl + I</kbd> to toggle this menu
    </div>
  `;

  document.body.appendChild(overlay);
  setupEditors(overlay);

  const TOGGLE_CONFIGS = [
    {
      toggleId: "sclient-lazy-scroll-toggle",
      bgId: "sclient-toggle-bg-lazy-scroll",
      sliderId: "sclient-toggle-slider-lazy-scroll",
      initial: lazyScrollOn,
    },
    {
      toggleId: "sclient-decorations-toggle",
      bgId: "sclient-toggle-bg-decorations",
      sliderId: "sclient-toggle-slider-decorations",
      initial: hideDecorationsOn,
    },
    {
      toggleId: "sclient-enhanced-header-toggle",
      bgId: "sclient-toggle-bg-enhanced-header",
      sliderId: "sclient-toggle-slider-enhanced-header",
      initial: enhancedHeaderOn,
    },
    {
      toggleId: "sclient-wide-layout-toggle",
      bgId: "sclient-toggle-bg-wide-layout",
      sliderId: "sclient-toggle-slider-wide-layout",
      initial: wideLayoutOn,
    },
    {
      toggleId: "sclient-collapsible-sidebar-toggle",
      bgId: "sclient-toggle-bg-collapsible-sidebar",
      sliderId: "sclient-toggle-slider-collapsible-sidebar",
      initial: collapsibleSidebarOn,
    },
    {
      toggleId: "sclient-adblock-toggle",
      bgId: "sclient-toggle-bg-adblock",
      sliderId: "sclient-toggle-slider-adblock",
      initial: adblockOn,
    },
    {
      toggleId: "sclient-tray-toggle",
      bgId: "sclient-toggle-bg-tray",
      sliderId: "sclient-toggle-slider-tray",
      initial: cfg.tray_icon || false,
    },
    {
      toggleId: "sclient-upsell-toggle",
      bgId: "sclient-toggle-bg-upsell",
      sliderId: "sclient-toggle-slider-upsell",
      initial: hideUpsellOn,
    },
    {
      toggleId: "sclient-artists-toggle",
      bgId: "sclient-toggle-bg-artists",
      sliderId: "sclient-toggle-slider-artists",
      initial: hideArtistsOn,
    },
    {
      toggleId: "sclient-trueshuffle-toggle",
      bgId: "sclient-toggle-bg-trueshuffle",
      sliderId: "sclient-toggle-slider-trueshuffle",
      initial: trueShuffleOn,
    },
    {
      toggleId: "sclient-regionbypass-toggle",
      bgId: "sclient-toggle-bg-regionbypass",
      sliderId: "sclient-toggle-slider-regionbypass",
      initial: regionBypassOn,
    },
    {
      toggleId: "sclient-listenbrainz-toggle",
      bgId: "sclient-toggle-bg-listenbrainz",
      sliderId: "sclient-toggle-slider-listenbrainz",
      initial: listenbrainzOn,
    },
    {
      toggleId: "sclient-lastfm-toggle",
      bgId: "sclient-toggle-bg-lastfm",
      sliderId: "sclient-toggle-slider-lastfm",
      initial: lastfmOn,
    },
    {
      toggleId: "sclient-stats-api-toggle",
      bgId: "sclient-toggle-bg-stats-api",
      sliderId: "sclient-toggle-slider-stats-api",
      initial: statsApiOn,
    },
    {
      toggleId: "sclient-stats-local-toggle",
      bgId: "sclient-toggle-bg-stats-local",
      sliderId: "sclient-toggle-slider-stats-local",
      initial: statsLocalOn,
    },
    {
      toggleId: "sclient-rpc-toggle",
      bgId: "sclient-toggle-bg-rpc",
      sliderId: "sclient-toggle-slider-rpc",
      initial: discordRpcOn,
      onChange(checked) {
        if (!checked)
          sendBridge("update_rpc", {
            title: "",
            artist: "",
            isPlaying: false,
            artwork: "",
            timeStart: 0,
            timeEnd: 0,
          });
      },
    },
  ];
  for (const cfg of TOGGLE_CONFIGS) setupToggle(overlay, cfg);

  const widthInput = overlay.querySelector("#sclient-wide-layout-width");
  widthInput.value = wideLayoutWidth && wideLayoutWidth !== "1200" ? wideLayoutWidth : "";
  overlay.querySelector("#sclient-trueshuffle-engine").value = trueShuffleMode;

  const accentToggle = overlay.querySelector("#sclient-accent-toggle");
  const accentBg = overlay.querySelector("#sclient-toggle-bg-accent");
  const accentSlider = overlay.querySelector("#sclient-toggle-slider-accent");
  const accentPicker = overlay.querySelector("#sclient-accent-color-picker");
  const accentText = overlay.querySelector("#sclient-accent-color-text");

  accentToggle.checked = customAccentOn;
  accentPicker.value = accentText.value = accentColor;

  function setAccentUi(on) {
    accentBg.style.backgroundColor = on ? getAccent() : "#333";
    accentSlider.style.transform = on ? "translateX(20px)" : "translateX(0)";
    accentPicker.style.opacity = accentText.style.opacity = on ? "1" : "0.5";
  }
  setAccentUi(customAccentOn);
  accentToggle.addEventListener("change", (e) => setAccentUi(e.target.checked));
  accentPicker.addEventListener("input", (e) => {
    accentText.value = e.target.value;
  });
  accentText.addEventListener("input", (e) => {
    if (/^#[0-9A-F]{6}$/i.test(e.target.value)) accentPicker.value = e.target.value;
  });

  const customFontToggle = overlay.querySelector("#sclient-custom-font-toggle");
  const customFontBg = overlay.querySelector("#sclient-toggle-bg-custom-font");
  const customFontSlider = overlay.querySelector("#sclient-toggle-slider-custom-font");
  const customFontText = overlay.querySelector("#sclient-custom-font-text");

  const bgColorToggle = overlay.querySelector("#sclient-bg-color-toggle");
  const bgColorBg = overlay.querySelector("#sclient-toggle-bg-bg-color");
  const bgColorSlider = overlay.querySelector("#sclient-toggle-slider-bg-color");
  const bgColorPicker = overlay.querySelector("#sclient-bg-color-picker");
  const bgColorText = overlay.querySelector("#sclient-bg-color-text");

  bgColorToggle.checked = cfg.custom_bg_color || false;
  bgColorPicker.value = bgColorText.value = cfg.bg_color || "#000000";

  function setBgColorUi(on) {
    bgColorBg.style.backgroundColor = on ? getAccent() : "#333";
    bgColorSlider.style.transform = on ? "translateX(20px)" : "translateX(0)";
    bgColorPicker.style.opacity = bgColorText.style.opacity = on ? "1" : "0.5";
  }
  setBgColorUi(cfg.custom_bg_color || false);
  bgColorToggle.addEventListener("change", (e) => setBgColorUi(e.target.checked));
  bgColorPicker.addEventListener("input", (e) => {
    bgColorText.value = e.target.value;
  });
  bgColorText.addEventListener("input", (e) => {
    if (/^#[0-9A-F]{6}$/i.test(e.target.value)) bgColorPicker.value = e.target.value;
  });

  customFontToggle.checked = cfg.custom_font || false;
  customFontText.value = cfg.custom_font_family || "";

  function setCustomFontUi(on) {
    customFontBg.style.backgroundColor = on ? getAccent() : "#333";
    customFontSlider.style.transform = on ? "translateX(20px)" : "translateX(0)";
    customFontText.style.opacity = on ? "1" : "0.5";
  }
  setCustomFontUi(cfg.custom_font || false);
  customFontToggle.addEventListener("change", (e) => setCustomFontUi(e.target.checked));

  overlay.querySelector("#sclient-listenbrainz-token-input").value = listenbrainzToken;
  overlay.querySelector("#sclient-lastfm-apikey-input").value = cfg.lastfm_api_key || "";
  overlay.querySelector("#sclient-lastfm-secret-input").value = cfg.lastfm_secret || "";

  function setLastfmUi(username) {
    const connect = overlay.querySelector("#sclient-lastfm-connect-btn");
    const disconnect = overlay.querySelector("#sclient-lastfm-disconnect-btn");
    const info = overlay.querySelector("#sclient-lastfm-connected-info");
    const userEl = overlay.querySelector("#sclient-lastfm-username");
    if (username) {
      connect.textContent = "Reconnect";
      disconnect.style.display = info.style.display = "";
      userEl.textContent = username;
    } else {
      connect.textContent = "Connect Last.fm Account";
      disconnect.style.display = info.style.display = "none";
    }
  }
  setLastfmUi(lastfmUsername);

  overlay.querySelector("#sclient-lastfm-connect-btn").addEventListener("click", async () => {
    const btn = overlay.querySelector("#sclient-lastfm-connect-btn");
    btn.textContent = "Waiting for Last.fm...";
    btn.disabled = true;
    await sendBridge("lastfm_save_credentials", {
      apiKey: overlay.querySelector("#sclient-lastfm-apikey-input").value.trim(),
      secret: overlay.querySelector("#sclient-lastfm-secret-input").value.trim(),
    });
    const result = await sendBridge("lastfm_authenticate", {});
    btn.disabled = false;
    if (result?.success) setLastfmUi(result.username);
    else {
      if (result?.error && result.error !== "cancelled")
        showToast("Last.fm auth failed: " + result.error);
      btn.textContent = "Connect Last.fm Account";
    }
  });

  overlay.querySelector("#sclient-lastfm-disconnect-btn").addEventListener("click", async () => {
    await sendBridge("lastfm_disconnect", {});
    setLastfmUi("");
  });

  overlay.querySelector("#sclient-stats-analytics-btn").addEventListener("click", () => {
    overlay.style.right = "-450px";
    if (typeof toggleAnalytics === "function") setTimeout(() => toggleAnalytics(), 300);
  });

  const playlistsBtn = overlay.querySelector("#sclient-playlists-btn");
  if (playlistsBtn) {
    playlistsBtn.addEventListener("click", () => {
      overlay.style.right = "-450px";
      if (typeof togglePlaylistManager === "function") setTimeout(() => togglePlaylistManager(), 300);
    });
  }

  overlay.querySelector("#sclient-stats-wipe-btn").addEventListener("click", () => {
    showConfirm("Delete all listening data? This cannot be undone.").then((ok) => {
      if (ok)
        sendBridge("stats_wipe_db", {})
          .then(() => showToast("Stats data wiped."))
          .catch((e) => {
            console.error("[SClient] Stats wipe failed:", e);
            showToast("Wipe failed: " + e);
          });
    });
  });

  overlay.querySelector("#sclient-proxyurl-input").value = proxyUrl;
  overlay.querySelector("#sclient-proxyurl-public-btn").addEventListener("click", () => {
    overlay.querySelector("#sclient-proxyurl-input").value = "https://sc.z-n.cc/";
  });

  overlay.querySelector("#sclient-close-btn").addEventListener("click", toggleOverlay);

  overlay.querySelector("#sclient-save-btn").addEventListener("click", () => {
    const $ = (sel) => overlay.querySelector(sel);
    let ww = widthInput.value.trim();

    if (wideLayoutOn) {
      if (ww === "") ww = "1200";
      else if (ww.toLowerCase() !== "unlimited") {
        const p = parseInt(ww, 10);
        if (isNaN(p) || p < 960) {
          showToast("Wide Layout max width must be a number >= 960");
          return;
        }
        ww = p.toString();
      }
    }

    sendBridge("save_custom_files", {
      css: $("#sclient-css-editor").value,
      js: $("#sclient-js-editor").value,
      lazyScroll: $("#sclient-lazy-scroll-toggle").checked,
      hideDecorations: $("#sclient-decorations-toggle").checked,
      customAccent: accentToggle.checked,
      accentColor: accentText.value,
      customFont: customFontToggle.checked,
      customFontFamily: customFontText.value,
      wideLayout: $("#sclient-wide-layout-toggle").checked,
      wideLayoutWidth: ww,
      collapsibleSidebar: $("#sclient-collapsible-sidebar-toggle").checked,
      customBgColor: $("#sclient-bg-color-toggle").checked,
      bgColor: $("#sclient-bg-color-text").value,
      adblock: $("#sclient-adblock-toggle").checked,
      discordRpc: $("#sclient-rpc-toggle").checked,
      trayIcon: $("#sclient-tray-toggle").checked,
      hideUpsell: $("#sclient-upsell-toggle").checked,
      hideArtists: $("#sclient-artists-toggle").checked,
      trueShuffle: $("#sclient-trueshuffle-toggle").checked,
      trueShuffleMode: $("#sclient-trueshuffle-engine").value,
      regionBypass: $("#sclient-regionbypass-toggle").checked,
      proxyUrl: $("#sclient-proxyurl-input").value,
      enhancedHeader: $("#sclient-enhanced-header-toggle").checked,
      listenbrainz: $("#sclient-listenbrainz-toggle").checked,
      listenbrainzToken: $("#sclient-listenbrainz-token-input").value,
      lastfm: $("#sclient-lastfm-toggle").checked,
      lastfmApiKey: $("#sclient-lastfm-apikey-input").value.trim(),
      lastfmSecret: $("#sclient-lastfm-secret-input").value.trim(),
      statsApiSync: $("#sclient-stats-api-toggle").checked,
      statsLocalTracking: $("#sclient-stats-local-toggle").checked,
    })
      .then(() => window.location.reload())
      .catch((e) => {
        console.error("[SClient] Settings save failed:", e);
        showToast("Failed to save: " + e);
      });
  });

  if (typeof refreshStatsStatus === "function") refreshStatsStatus();
  renderAccounts(overlay);
}

function toggleOverlay() {
  createOverlay();
  const overlay = document.getElementById("sclient-settings-overlay");
  if (overlay.style.right === "0px") {
    overlay.style.right = "-450px";
  } else {
    const ce = document.getElementById("sclient-css-editor");
    const je = document.getElementById("sclient-js-editor");
    if (ce) {
      ce.value = currentCss;
      ce.dispatchEvent(new Event("input"));
    }
    if (je) {
      je.value = currentJs;
      je.dispatchEvent(new Event("input"));
    }
    void overlay.offsetWidth;
    overlay.style.right = "0px";
  }
}

document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.key.toLowerCase() === "i") {
    e.preventDefault();
    toggleOverlay();
  }
});
