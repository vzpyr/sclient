const CONFIG_PAYLOAD_KEYS = {
  "features.accent_color": "accent_color",
  "features.wide_layout_width": "wide_layout_width",
  "features.true_shuffle_mode": "true_shuffle_mode",
  "features.proxy_url": "proxy_url",
  "features.bg_color": "bg_color",
  "features.custom_font_family": "custom_font_family",
  "integrations.lastfm.api_key": "lastfm_api_key",
  "integrations.lastfm.secret": "lastfm_secret",
  "integrations.listenbrainz.token": "listenbrainz_token",
  "stats.local_tracking": "stats_local_tracking",
  "stats.api_sync": "stats_api_sync",
};

function readConfigValue(key, fallback) {
  return SCLIENT_CONFIG.get(CONFIG_PAYLOAD_KEYS[key] || key.replace(/^features\./, ""), fallback);
}

const AUXILIARY = {
  appearance: [
    {
      label: "Custom Background Color",
      description: "Dark mode only",
      toggleKey: "features.custom_bg_color",
      fields: [{ type: "color", key: "features.bg_color", label: "Background Color" }],
    },
    {
      label: "Custom Font",
      toggleKey: "features.custom_font",
      fields: [{ type: "text", key: "features.custom_font_family", label: "Font Family" }],
    },
  ],
  playback: [
    { label: "Enable Audio Visualizer", toggleKey: "features.show_visualizer" },
    {
      label: "Proxy (Region Bypass)",
      toggleKey: "features.region_bypass",
      fields: [{ type: "text", key: "features.proxy_url", label: "Proxy URL" }],
      custom:
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:8px;"><button id="sclient-proxyurl-public-btn" class="sclient-btn" style="flex-shrink:0;white-space:nowrap;padding:4px 8px;font-size:11px;">Use Public</button></div><div style="font-size:10px;color:#f88;margin-top:4px;">Disclaimer: Whoever runs the proxy server can (in theory) steal your credentials by intercepting your traffic. Opening your profile may temporarily geo-lock songs again.</div>',
    },
  ],
  stats: [{ label: "History Sync", description: "Every 2h", toggleKey: "stats.api_sync" }],
};

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
    [/(\/\*[\s\S]*?\*\/)/g, "var(--sclient-syntax-comment, #6a9955)"],
    [/([.#][a-zA-Z0-9_-]+)(?=[\s{])/g, "var(--sclient-syntax-selector, #d7ba7d)"],
    [/([a-zA-Z-]+)\s*(?=:)/g, "var(--sclient-syntax-property, #9cdcfe)"],
    [/(:\s*)([^;}]+)(?=;|\})/g, "var(--sclient-syntax-value, #ce9178)"],
  ]);
}

function highlightJs(text) {
  return highlight(text, [
    [/(\/\/.*)/g, "var(--sclient-syntax-comment, #6a9955)"],
    [/('.*?'|".*?"|`[\s\S]*?`)/g, "var(--sclient-syntax-string, #ce9178)"],
    [
      /\b(const|let|var|function|return|if|else|for|while|try|catch|async|await|class|new|this|import|export|from|true|false|null|undefined)\b/g,
      "var(--sclient-syntax-keyword, #569cd6)",
    ],
    [/\b([a-zA-Z0-9_]+)(?=\s*\()/g, "var(--sclient-syntax-function, #dcdcaa)"],
  ]);
}

function toggleSwitchHtml(configKey) {
  return `<label class="sclient-toggle">
    <input type="checkbox" data-config-key="${configKey}">
    <span class="sclient-toggle-bg"><span class="sclient-toggle-slider"></span></span>
  </label>`;
}

function fieldHtml(field) {
  const key = field.key;
  if (field.type === "color") {
    return `<div class="sclient-field-row"><span class="sclient-field-label">${esc(field.label)}</span><input type="color" data-config-key="${key}" class="sclient-color-input"></div>`;
  }
  if (field.type === "select") {
    const options = (field.options || [])
      .map((o) => `<option value="${o.value}">${esc(o.label)}</option>`)
      .join("");
    return `<div class="sclient-field-row"><span class="sclient-field-label">${esc(field.label)}</span><select data-config-key="${key}" class="sclient-select">${options}</select></div>`;
  }
  if (field.type === "number") {
    return `<div class="sclient-field-row"><span class="sclient-field-label">${esc(field.label)}</span><input type="number" data-config-key="${key}" class="sclient-input sclient-field-input"></div>`;
  }
  if (field.type === "password") {
    return `<div class="sclient-field-row"><span class="sclient-field-label">${esc(field.label)}</span><input type="password" data-config-key="${key}" class="sclient-input sclient-field-input" placeholder="${esc(field.label)}"></div>`;
  }
  return `<div class="sclient-field-row"><span class="sclient-field-label">${esc(field.label)}</span><input type="text" data-config-key="${key}" class="sclient-input sclient-field-input" placeholder="${esc(field.label)}"></div>`;
}

function renderFeatureCard(f) {
  const fields = (f.settingsFields || []).map(fieldHtml).join("");
  const custom = typeof f.settingsCustom === "function" ? f.settingsCustom() : "";
  return `
    <div class="sclient-card">
      <div class="sclient-card-top">
        <span class="sclient-card-label">${esc(f.settingsLabel)}</span>
        ${f.hasToggle ? toggleSwitchHtml(f.featureKey) : ""}
      </div>
      ${f.settingsDescription ? `<div class="sclient-card-desc">${esc(f.settingsDescription)}</div>` : ""}
      ${fields ? `<div class="sclient-card-fields">${fields}</div>` : ""}
      ${custom ? `<div class="sclient-card-custom">${custom}</div>` : ""}
    </div>`;
}

function auxCard(a) {
  return renderFeatureCard({
    settingsLabel: a.label,
    settingsDescription: a.description || "",
    hasToggle: !!a.toggleKey,
    featureKey: a.toggleKey,
    settingsFields: a.fields || [],
    settingsCustom: a.custom ? function () { return a.custom; } : null,
  });
}

function categorySectionHtml(category, title) {
  const features = FEATURES.filter(
    (f) => f.settingsCategory === category && f !== PLAYLIST_MANAGER_FEATURE
  );
  const cards =
    features.map(renderFeatureCard).join("") +
    (AUXILIARY[category] || []).map(auxCard).join("");
  return `<div class="sclient-section-title">${title}</div>${cards}`;
}

function setupToggleVisual(input) {
  const label = input.closest("label");
  if (!label) return;
  const bg = label.querySelector(".sclient-toggle-bg");
  const slider = label.querySelector(".sclient-toggle-slider");
  if (!bg || !slider) return;
  const update = () => {
    bg.style.backgroundColor = input.checked ? getAccent() : "#333";
    slider.style.transform = input.checked ? "translateX(20px)" : "translateX(0)";
  };
  input.addEventListener("change", update);
  update();
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

  cssEd.value = SCLIENT_CONFIG.customCss;
  jsEd.value = SCLIENT_CONFIG.customJs;
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
            name.textContent = acc === "main" ? "Main" : acc;
            if (acc === active) {
              name.style.cssText = `color:${getAccent()};font-weight:bold;`;
              name.textContent += " (Active)";
            }

            const btns = document.createElement("div");
            btns.style.cssText = "display:flex;gap:5px;";

            if (acc !== active) {
              const sw = document.createElement("button");
              sw.textContent = "Switch";
              sw.className = "sclient-btn";
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
              del.className = "sclient-btn sclient-btn-danger";
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
              rst.className = "sclient-btn sclient-btn-danger";
              rst.style.padding = "4px 8px";
              rst.onclick = () => {
                const msg =
                  acc === active
                    ? "Clear all cookies and browser data? The app will restart."
                    : "Clear all cookies and browser data for Main profile?";
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

function addAccount(overlay) {
  const name = overlay.querySelector("#sclient-new-account-name").value.trim();
  if (!name) {
    showToast("Enter a profile name");
    return;
  }
  sendBridge("create_account", { name })
    .then(() => sendBridge("set_active_account", { name }))
    .then(() => sendBridge("restart_app"))
    .catch((e) => {
      console.error("[SClient] Add account failed:", e);
      showToast("Add Account Error: " + e);
    });
}

function wireCustomSections(overlay) {
  const connectBtn = overlay.querySelector("#sclient-lastfm-connect-btn");
  if (connectBtn) {
    const status = overlay.querySelector("#sclient-lastfm-status");
    const disconnectBtn = overlay.querySelector("#sclient-lastfm-disconnect-btn");
    const setConnected = (username) => {
      connectBtn.textContent = username ? "Reconnect" : "Connect Last.fm Account";
      if (disconnectBtn) disconnectBtn.style.display = username ? "" : "none";
      if (status) {
        status.textContent = username ? "Connected: " + username : "Waiting...";
        status.style.color = username ? getAccent() : "#ccc";
      }
    };
    if (SCLIENT_CONFIG.lastfmUsername) setConnected(SCLIENT_CONFIG.lastfmUsername);

    if (disconnectBtn) {
      disconnectBtn.addEventListener("click", async () => {
        await sendBridge("lastfm_disconnect", {});
        setConnected("");
      });
    }

    connectBtn.addEventListener("click", async () => {
      connectBtn.textContent = "Waiting for Last.fm...";
      connectBtn.disabled = true;
      const keyInput = overlay.querySelector('[data-config-key="integrations.lastfm.api_key"]');
      const secretInput = overlay.querySelector('[data-config-key="integrations.lastfm.secret"]');
      await sendBridge("lastfm_save_credentials", {
        apiKey: (keyInput ? keyInput.value : "").trim(),
        secret: (secretInput ? secretInput.value : "").trim(),
      });
      const result = await sendBridge("lastfm_authenticate", {});
      connectBtn.disabled = false;
      if (result && result.success) setConnected(result.username);
      else {
        if (result && result.error && result.error !== "cancelled")
          showToast("Last.fm auth failed: " + result.error);
        connectBtn.textContent = "Connect Last.fm Account";
      }
    });
  }

  const statsOpen = overlay.querySelector("#sclient-stats-open-btn");
  if (statsOpen) statsOpen.addEventListener("click", () => STATS_FEATURE.toggle());

  const publicBtn = overlay.querySelector("#sclient-proxyurl-public-btn");
  if (publicBtn)
    publicBtn.addEventListener("click", () => {
      const url = overlay.querySelector('[data-config-key="features.proxy_url"]');
      if (url) url.value = "https://sc.z-n.cc/";
    });

  FEATURES.forEach((f) => {
    if (typeof f.settingsInit === "function") f.settingsInit(overlay);
  });
}

function saveSettings(overlay) {
  const pairs = {};
  overlay.querySelectorAll("[data-config-key]").forEach((el) => {
    let value;
    if (el.type === "checkbox") value = el.checked;
    else if (el.type === "color") value = el.value;
    else value = el.value;
    pairs[el.dataset.configKey] = value;
  });
  const payload = {
    pairs,
    files: {
      css: overlay.querySelector("#sclient-css-editor").value,
      js: overlay.querySelector("#sclient-js-editor").value,
    },
  };
  sendBridge("save_custom_files", payload)
    .then(() => window.location.reload())
    .catch((e) => {
      console.error("[SClient] Settings save failed:", e);
      showToast("Failed to save: " + e);
    });
}

class SettingsFeature extends Feature {
  get featureKey() {
    return null;
  }
  get hasToggle() {
    return false;
  }
  get settingsCategory() {
    return null;
  }

  init() {
    if (this.enabled) return;
    super.init();
    this.on(document, "keydown", (e) => {
      if (e.ctrlKey && e.key.toLowerCase() === "i") {
        e.preventDefault();
        this.toggle();
      }
    });
  }

  injectUI() {
    this.injectMenuButton();
  }

  injectMenuButton() {
    if (document.getElementById("sclient-settings-btn")) return;

    const menu = document.querySelector(".header__right .header__navMenu");
    if (!menu || !menu.parentNode) {
      this.injected = false;
      return;
    }

    const ul = document.createElement("ul");
    ul.className = "header__navMenu sc-clearfix sc-list-nostyle left";
    ul.style.marginRight = "10px";

    const li = document.createElement("li");
    const btn = document.createElement("a");
    btn.id = "sclient-settings-btn";
    btn.href = "#";
    btn.className = "header__moreButton";
    btn.style.cssText = "display: flex; align-items: center; justify-content: center;";
    btn.title = "SClient Settings";
    btn.innerHTML =
      '<div class="header__moreButtonIcon" style="width: 22px; height: 22px; display: flex; align-items: center; justify-content: center;"><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/></svg></div>';

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      this.toggle();
    });

    li.appendChild(btn);
    ul.appendChild(li);
    menu.parentNode.insertBefore(ul, menu);
  }

  toggle() {
    this.createOverlay();
    const overlay = document.getElementById("sclient-settings-overlay");
    if (overlay.style.right === "0px") {
      overlay.style.right = "-450px";
    } else {
      const ce = document.getElementById("sclient-css-editor");
      const je = document.getElementById("sclient-js-editor");
      if (ce) {
        ce.value = SCLIENT_CONFIG.customCss;
        ce.dispatchEvent(new Event("input"));
      }
      if (je) {
        je.value = SCLIENT_CONFIG.customJs;
        je.dispatchEvent(new Event("input"));
      }
      void overlay.offsetWidth;
      overlay.style.right = "0px";
    }
  }

  createOverlay() {
    if (document.getElementById("sclient-settings-overlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "sclient-settings-overlay";
    overlay.style.cssText = `
    position:fixed;top:0;right:-450px;width:400px;height:100%;
    background:var(--sclient-bg-surface);backdrop-filter:blur(10px);
    border-left:1px solid var(--sclient-border);
    box-shadow:-5px 0 25px rgba(0,0,0,0.5);z-index:999999;
    transition:right 0.3s ease;display:flex;flex-direction:column;
    color:var(--sclient-text-main);font-family:var(--sclient-font-sans);
    padding:20px;box-sizing:border-box;
  `;

    const generalHtml = `
      <div class="sclient-section-title">General</div>
      <div class="sclient-card">
        <div class="sclient-card-top">
          <span class="sclient-card-label">Titlebar Style</span>
          <select data-config-key="features.titlebar_style" class="sclient-select">
            <option value="custom">Custom</option>
            <option value="native">Native</option>
            <option value="none">None</option>
          </select>
        </div>
      </div>
      <div class="sclient-card">
        <div class="sclient-card-top">
          <span class="sclient-card-label">Run in System Tray</span>
          ${toggleSwitchHtml("features.tray_icon")}
        </div>
      </div>
      <div class="sclient-card">
        <div class="sclient-card-top">
          <span class="sclient-card-label">Load Last Page</span>
          ${toggleSwitchHtml("features.load_last_page")}
        </div>
      </div>
    `;

    const editorsHtml = `
      <div style="display:flex;gap:10px;margin-bottom:15px;">
        <button id="tab-css" class="sclient-btn sclient-btn-primary" style="flex:1;">Custom CSS</button>
        <button id="tab-js" class="sclient-btn" style="flex:1;">Custom JS</button>
      </div>
      <div class="sclient-editor-box" style="flex:1 0 400px;min-height:400px;display:flex;flex-direction:column;margin-bottom:20px;position:relative;border:1px solid var(--sclient-border);border-radius:var(--sclient-radius-md);background:var(--sclient-editor-bg);transition:border-color 0.2s ease;">
        <div id="sclient-css-container" style="flex:1;position:relative;overflow:hidden;display:block;">
          <pre id="sclient-css-highlight" aria-hidden="true" style="margin:0;position:absolute;top:0;left:0;width:100%;height:100%;padding:10px;box-sizing:border-box;font-family:'Fira Code',Consolas,monospace;font-size:13px;line-height:1.5;color:#ccc;pointer-events:none;white-space:pre-wrap;word-wrap:break-word;overflow:hidden;"></pre>
          <textarea id="sclient-css-editor" spellcheck="false" style="margin:0;position:absolute;top:0;left:0;width:100%;height:100%;background:transparent;color:transparent;caret-color:#fff;border:none;font-family:'Fira Code',Consolas,monospace;font-size:13px;line-height:1.5;padding:10px;resize:none;box-sizing:border-box;outline:none;white-space:pre-wrap;word-wrap:break-word;" placeholder="/* Add your custom CSS here */"></textarea>
        </div>
        <div id="sclient-js-container" style="flex:1;position:relative;overflow:hidden;display:none;">
          <pre id="sclient-js-highlight" aria-hidden="true" style="margin:0;position:absolute;top:0;left:0;width:100%;height:100%;padding:10px;box-sizing:border-box;font-family:'Fira Code',Consolas,monospace;font-size:13px;line-height:1.5;color:#ccc;pointer-events:none;white-space:pre-wrap;word-wrap:break-word;overflow:hidden;"></pre>
          <textarea id="sclient-js-editor" spellcheck="false" style="margin:0;position:absolute;top:0;left:0;width:100%;height:100%;background:transparent;color:transparent;caret-color:#fff;border:none;font-family:'Fira Code',Consolas,monospace;font-size:13px;line-height:1.5;padding:10px;resize:none;box-sizing:border-box;outline:none;white-space:pre-wrap;word-wrap:break-word;" placeholder="// Add your custom JS here"></textarea>
        </div>
      </div>
    `;

    const accountsHtml = `
      <div id="sclient-accounts-list" style="display:flex;flex-direction:column;gap:8px;margin-bottom:15px;"></div>
      <div style="display:flex;gap:8px;">
        <input type="text" id="sclient-new-account-name" class="sclient-input" placeholder="New Profile Name" style="flex:1;height:auto;padding:8px 10px;font-family:monospace;">
        <button id="sclient-add-account-btn" class="sclient-btn sclient-btn-primary">+ Add Account</button>
      </div>
    `;

    overlay.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;border-bottom:1px solid var(--sclient-border);padding-bottom:10px;">
        <h3 style="margin:0;font-size:var(--sclient-text-xl);font-weight:600;color:var(--sclient-accent);display:flex;align-items:center;gap:8px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-settings-icon lucide-settings"><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/></svg>
          SClient Settings
        </h3>
        <button id="sclient-close-btn" class="sclient-btn sclient-btn-ghost" title="Close" style="padding:4px;display:flex;align-items:center;justify-content:center;">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x-icon lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </div>

      <style>
        #sclient-settings-scroll::-webkit-scrollbar { width:8px; }
        #sclient-settings-scroll::-webkit-scrollbar-track { background:rgba(0,0,0,0.2);border-radius:4px; }
        #sclient-settings-scroll::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.2);border-radius:4px; }
        #sclient-settings-scroll::-webkit-scrollbar-thumb:hover { background:rgba(255,255,255,0.3); }
        #sclient-settings-scroll label { flex-shrink:0; }
        .sclient-section-title { font-size:var(--sclient-text-sm);font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--sclient-accent);margin:20px 0 10px; }
        .sclient-section-title:first-child { margin-top:0; }
        .sclient-card { display:block;margin-bottom:15px;padding:12px;background:var(--sclient-btn-bg);border-radius:var(--sclient-radius-lg);border:1px solid var(--sclient-border);transition:background 0.2s ease,border-color 0.2s ease,transform 0.15s ease; }
        .sclient-card:hover { background:var(--sclient-btn-bg-hover);border-color:var(--sclient-border-hover); }
        .sclient-card-top { display:flex;justify-content:space-between;align-items:center;gap:10px; }
        .sclient-card-label { font-size:var(--sclient-text-base);font-weight:500;color:var(--sclient-text-main); }
        .sclient-card-desc { font-size:var(--sclient-text-sm);color:var(--sclient-text-muted);margin-top:4px; }
        .sclient-card-fields { display:flex;flex-direction:column;gap:8px;margin-top:10px; }
        .sclient-card-custom { margin-top:10px; }
        .sclient-field-row { display:flex;justify-content:space-between;align-items:center;gap:10px; }
        .sclient-field-label { font-size:var(--sclient-text-sm);color:var(--sclient-text-muted);white-space:nowrap; }
        .sclient-field-input { width:160px;flex-shrink:0; }
        .sclient-color-input { width:32px;height:26px;padding:0;border:1px solid var(--sclient-border);border-radius:var(--sclient-radius-sm);cursor:pointer;background:transparent;flex-shrink:0; }
        .sclient-editor-box:focus-within { border-color: var(--sclient-accent); }
        .sclient-toggle { position:relative;display:inline-block;width:44px;height:24px;flex-shrink:0; }
        .sclient-toggle input { opacity:0;width:0;height:0; }
        .sclient-toggle-bg { position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background-color:#333;transition:.3s;border-radius:24px; }
        .sclient-toggle-slider { position:absolute;height:18px;width:18px;left:3px;bottom:3px;background-color:white;transition:.3s;border-radius:50%; }
        .sclient-select { -webkit-appearance:none;appearance:none;background:var(--sclient-bg-surface) url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2224%22 height=%2224%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23ccc%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><path d=%22m6 9 6 6 6-6%22/></svg>') no-repeat right 6px center / 16px 16px;padding:6px 28px 6px 10px;border:1px solid var(--sclient-border);color:var(--sclient-text-main);border-radius:var(--sclient-radius-md);font-family:var(--sclient-font-sans);font-size:var(--sclient-text-sm);outline:none;cursor:pointer;transition:border-color 0.2s;flex-shrink:0; }
        .sclient-select option { background:#121212;color:white; }
        body.theme-light .sclient-select { background-image:url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2224%22 height=%2224%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23666%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><path d=%22m6 9 6 6 6-6%22/></svg>'); }
        body.theme-light .sclient-select option { background:#ffffff;color:#111111; }
      </style>

      <div id="sclient-settings-scroll" style="flex:1;overflow-y:auto;overflow-x:hidden;padding-right:8px;display:flex;flex-direction:column;min-height:0;margin-bottom:15px;">
        ${generalHtml}
        ${categorySectionHtml("appearance", "Appearance")}
        ${categorySectionHtml("playback", "Playback")}
        ${categorySectionHtml("integrations", "Integrations")}
        ${categorySectionHtml("stats", "Stats")}
        <div class="sclient-section-title">Playlist Manager</div>
        ${renderFeatureCard(PLAYLIST_MANAGER_FEATURE)}
        <div class="sclient-section-title">Custom CSS / JS</div>
        ${editorsHtml}
        <div class="sclient-section-title">Accounts</div>
        ${accountsHtml}
      </div>

      <div style="display:flex;gap:10px;margin-bottom:10px;">
        <button id="sclient-save-btn" class="sclient-btn sclient-btn-primary" style="flex:1;padding:12px;font-weight:bold;">Save &amp; Apply</button>
      </div>
      <div style="margin-top:10px;text-align:center;font-size:11px;color:#666;">
        Press <kbd style="background:#333;padding:2px 5px;border-radius:3px;color:#ccc;">Ctrl + I</kbd> to toggle this menu
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelectorAll("[data-config-key]").forEach((el) => {
      const key = el.dataset.configKey;
      if (el.type === "checkbox") {
        const feature = FEATURES.find((f) => f.featureKey === key);
        el.checked = feature ? feature.isEnabled() : !!readConfigValue(key, false);
      } else {
        el.value = readConfigValue(key, el.type === "color" ? "#000000" : "");
      }
    });

    overlay.querySelectorAll(".sclient-toggle input[type='checkbox']").forEach(setupToggleVisual);

    overlay.querySelectorAll(".sclient-card").forEach((card) => {
      const toggle = card.querySelector('input[type="checkbox"]');
      const fields = card.querySelector(".sclient-card-fields");
      if (!toggle || !fields) return;
      const sync = () => {
        fields.style.opacity = toggle.checked ? "1" : "0.5";
      };
      toggle.addEventListener("change", sync);
      sync();
    });

    setupEditors(overlay);
    wireCustomSections(overlay);
    renderAccounts(overlay);
    STATS_FEATURE.refreshStatus();

    overlay.querySelector("#sclient-close-btn").addEventListener("click", () => this.toggle());
    overlay.querySelector("#sclient-save-btn").addEventListener("click", () => saveSettings(overlay));
    overlay
      .querySelector("#sclient-add-account-btn")
      .addEventListener("click", () => addAccount(overlay));
  }

  destroy() {
    const ov = document.getElementById("sclient-settings-overlay");
    if (ov) ov.remove();
    const btn = document.getElementById("sclient-settings-btn");
    if (btn) {
      const ul = btn.closest("ul");
      if (ul) ul.remove();
    }
    super.destroy();
  }
}

const SETTINGS_FEATURE = new SettingsFeature();
FEATURES.push(SETTINGS_FEATURE);
