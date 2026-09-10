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
  return SCLIENT_CONFIG.get(
    CONFIG_PAYLOAD_KEYS[key] || key.replace(/^features\./, ""),
    fallback,
  );
}

const AUXILIARY = {
  appearance: [
    {
      label: "Custom Background",
      toggleKey: "features.custom_bg_color",
      fields: [
        { type: "color", key: "features.bg_color", label: "Background Color" },
      ],
    },
    {
      label: "Custom Font",
      toggleKey: "features.custom_font",
      fields: [
        {
          type: "text",
          key: "features.custom_font_family",
          label: "Font Family",
        },
      ],
    },
  ],
  playback: [
    { label: "Enable Audio Visualizer", toggleKey: "features.show_visualizer" },
    {
      label: "Proxy (Region Bypass)",
      toggleKey: "features.region_bypass",
      fields: [{ type: "text", key: "features.proxy_url", label: "Proxy URL" }],
      custom:
        '<div class="sclient-field-action"><button id="sclient-proxyurl-public-btn" class="sclient-btn sclient-btn-sm">Use Public</button></div><div class="sclient-field-note">Disclaimer: Whoever runs the proxy server can (in theory) steal your credentials by intercepting your traffic. Opening your profile may temporarily geo-lock songs again.</div>',
    },
  ],
  stats: [
    {
      label: "History Sync",
      description: "Every 2h",
      toggleKey: "stats.api_sync",
    },
  ],
};

function highlight(text, patterns) {
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const tokens = [];
  for (const [re, color] of patterns) {
    html = html.replace(re, (m, ...groups) => {
      const content =
        groups[0] != null && groups[1] != null ? groups[0] + groups[1] : m;
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
    [/(\/\*[\s\S]*?\*\/)/g, "var(--sclient-syntax-comment)"],
    [/([.#][a-zA-Z0-9_-]+)(?=[\s{])/g, "var(--sclient-syntax-selector)"],
    [/([a-zA-Z-]+)\s*(?=:)/g, "var(--sclient-syntax-property)"],
    [/(:\s*)([^;}]+)(?=;|\})/g, "var(--sclient-syntax-value)"],
  ]);
}

function highlightJs(text) {
  return highlight(text, [
    [/(\/\/.*)/g, "var(--sclient-syntax-comment)"],
    [/('.*?'|".*?"|`[\s\S]*?`)/g, "var(--sclient-syntax-string)"],
    [
      /\b(const|let|var|function|return|if|else|for|while|try|catch|async|await|class|new|this|import|export|from|true|false|null|undefined)\b/g,
      "var(--sclient-syntax-keyword)",
    ],
    [/\b([a-zA-Z0-9_]+)(?=\s*\()/g, "var(--sclient-syntax-function)"],
  ]);
}

function toggleSwitchHtml(configKey) {
  return `<label class="sclient-switch">
    <input type="checkbox" data-config-key="${configKey}">
    <span class="sclient-switch-bg"></span>
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
  const custom =
    typeof f.settingsCustom === "function" ? f.settingsCustom() : "";
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
    settingsCustom: a.custom
      ? function () {
          return a.custom;
        }
      : null,
  });
}

function categorySectionHtml(category, title) {
  const features = FEATURES.filter(
    (f) => f.settingsCategory === category && f !== PLAYLIST_MANAGER_FEATURE,
  );
  const cards =
    features.map(renderFeatureCard).join("") +
    (AUXILIARY[category] || []).map(auxCard).join("");
  return `<div class="sclient-section-title">${title}</div>${cards}`;
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
    active.classList.add("active");
    inactive.classList.remove("active");
    show.classList.remove("hidden");
    hide.classList.add("hidden");
  };
  tabCss.addEventListener("click", () =>
    switchTab(tabCss, tabJs, cssCon, jsCon),
  );
  tabJs.addEventListener("click", () =>
    switchTab(tabJs, tabCss, jsCon, cssCon),
  );

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
            const row = document.createElement("div");
            row.className = "sclient-account-row";

            const name = document.createElement("span");
            name.className = "sclient-account-name";
            name.textContent = acc === "main" ? "Main" : acc;
            if (acc === active) {
              name.classList.add("active");
              name.textContent += " (Active)";
            }

            const btns = document.createElement("div");
            btns.className = "sclient-account-actions";

            if (acc !== active) {
              const sw = document.createElement("button");
              sw.textContent = "Switch";
              sw.className = "sclient-btn sclient-btn-sm";
              sw.onclick = () =>
                sendBridge("set_active_account", { name: acc })
                  .then(() => sendBridge("restart_app"))
                  .catch((e) => {
                    showToast("Switch Error: " + e);
                  });
              btns.appendChild(sw);
            }

            if (acc !== "main" && acc !== active) {
              const del = document.createElement("button");
              del.textContent = "Delete";
              del.className = "sclient-btn sclient-btn-danger sclient-btn-sm";
              del.onclick = () =>
                showConfirm("Delete account " + acc + "?").then((ok) => {
                  if (ok)
                    sendBridge("delete_account", { name: acc })
                      .then(() => renderAccounts(overlay))
                      .catch((e) => {
                        showToast("Delete Error: " + e);
                      });
                });
              btns.appendChild(del);
            }

            if (acc === "main") {
              const rst = document.createElement("button");
              rst.textContent = "Reset";
              rst.className = "sclient-btn sclient-btn-danger sclient-btn-sm";
              rst.onclick = () => {
                const msg =
                  acc === active
                    ? "Clear all cookies and browser data? The app will restart."
                    : "Clear all cookies and browser data for Main profile?";
                showConfirm(msg).then((ok) => {
                  if (ok)
                    sendBridge(
                      acc === active ? "clear_data_and_restart" : "clear_data",
                    ).catch(() => {});
                });
              };
              btns.appendChild(rst);
            }

            row.appendChild(name);
            row.appendChild(btns);
            list.appendChild(row);
          }
        })
        .catch((e) => {
          showToast("Active Account Error: " + e);
        });
    })
    .catch((e) => {
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
      showToast("Add Account Error: " + e);
    });
}

function wireCustomSections(overlay) {
  const connectBtn = overlay.querySelector("#sclient-lastfm-connect-btn");
  if (connectBtn) {
    const status = overlay.querySelector("#sclient-lastfm-status");
    const disconnectBtn = overlay.querySelector(
      "#sclient-lastfm-disconnect-btn",
    );
    const setConnected = (username) => {
      connectBtn.textContent = username
        ? "Reconnect"
        : "Connect Last.fm Account";
      if (disconnectBtn) disconnectBtn.classList.toggle("hidden", !username);
      if (status) {
        status.textContent = username ? "Connected: " + username : "Waiting...";
        status.dataset.tone = username ? "recorded" : "idle";
      }
    };
    if (SCLIENT_CONFIG.lastfmUsername)
      setConnected(SCLIENT_CONFIG.lastfmUsername);

    if (disconnectBtn) {
      disconnectBtn.addEventListener("click", async () => {
        await sendBridge("lastfm_disconnect", {});
        setConnected("");
      });
    }

    connectBtn.addEventListener("click", async () => {
      connectBtn.textContent = "Waiting for Last.fm...";
      connectBtn.disabled = true;
      const keyInput = overlay.querySelector(
        '[data-config-key="integrations.lastfm.api_key"]',
      );
      const secretInput = overlay.querySelector(
        '[data-config-key="integrations.lastfm.secret"]',
      );
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
  if (statsOpen)
    statsOpen.addEventListener("click", () => STATS_FEATURE.toggle());

  const publicBtn = overlay.querySelector("#sclient-proxyurl-public-btn");
  if (publicBtn)
    publicBtn.addEventListener("click", () => {
      const url = overlay.querySelector(
        '[data-config-key="features.proxy_url"]',
      );
      if (url) url.value = "https://sclient-app.vercel.app/";
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
    ul.classList.add("sclient-settings-menu");

    const li = document.createElement("li");
    const btn = document.createElement("a");
    btn.id = "sclient-settings-btn";
    btn.href = "#";
    btn.className = "header__moreButton sclient-settings-trigger";
    btn.title = "SClient Settings";
    btn.innerHTML =
      '<div class="header__moreButtonIcon"><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/></svg></div>';

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
    if (overlay.classList.contains("open")) {
      overlay.classList.remove("open");
      return;
    }
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
    overlay.classList.add("open");
  }

  createOverlay() {
    if (document.getElementById("sclient-settings-overlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "sclient-settings-overlay";

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
      <div class="sclient-editor-tabs">
        <button id="tab-css" class="sclient-btn sclient-editor-tab active">Custom CSS</button>
        <button id="tab-js" class="sclient-btn sclient-editor-tab">Custom JS</button>
      </div>
      <div class="sclient-editor">
        <div id="sclient-css-container" class="sclient-editor-pane">
          <pre id="sclient-css-highlight" aria-hidden="true" class="sclient-editor-highlight"></pre>
          <textarea id="sclient-css-editor" spellcheck="false" class="sclient-editor-input" placeholder="/* Add your custom CSS here */"></textarea>
        </div>
        <div id="sclient-js-container" class="sclient-editor-pane hidden">
          <pre id="sclient-js-highlight" aria-hidden="true" class="sclient-editor-highlight"></pre>
          <textarea id="sclient-js-editor" spellcheck="false" class="sclient-editor-input" placeholder="// Add your custom JS here"></textarea>
        </div>
      </div>
    `;

    const accountsHtml = `
      <div id="sclient-accounts-list" class="sclient-accounts-list"></div>
      <div class="sclient-sidebar-row">
        <input type="text" id="sclient-new-account-name" class="sclient-input" placeholder="New Profile Name">
        <button id="sclient-add-account-btn" class="sclient-btn sclient-btn-primary">+ Add Account</button>
      </div>
    `;

    overlay.innerHTML = `
      <div class="sclient-drawer-header">
        <h3 class="sclient-drawer-title">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-settings-icon lucide-settings"><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/></svg>
          SClient Settings
        </h3>
        <button id="sclient-close-btn" class="sclient-icon-btn visible" title="Close">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x-icon lucide-x"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      </div>

      <div id="sclient-settings-scroll" class="sclient-drawer-scroll">
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

      <div class="sclient-drawer-footer">
        <button id="sclient-save-btn" class="sclient-btn sclient-btn-primary sclient-save-btn">Save &amp; Apply</button>
      </div>
      <div class="sclient-drawer-hint">
        Press <kbd class="sclient-kbd">Ctrl + I</kbd> to toggle this menu
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelectorAll("[data-config-key]").forEach((el) => {
      const key = el.dataset.configKey;
      if (el.type === "checkbox") {
        const feature = FEATURES.find((f) => f.featureKey === key);
        el.checked = feature
          ? feature.isEnabled()
          : !!readConfigValue(key, false);
      } else {
        el.value = readConfigValue(key, el.type === "color" ? "#000000" : "");
      }
    });

    setupEditors(overlay);
    wireCustomSections(overlay);
    renderAccounts(overlay);
    STATS_FEATURE.refreshStatus();

    overlay
      .querySelector("#sclient-close-btn")
      .addEventListener("click", () => this.toggle());
    overlay
      .querySelector("#sclient-save-btn")
      .addEventListener("click", () => saveSettings(overlay));
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
