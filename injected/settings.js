// settings overlay — uses consolidated core helpers

function createToggleHtml({ label, toggleId, bgId, sliderId }) {
	return `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding: 12px; background: rgba(255,255,255,0.05); border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
      <span style="font-size: 14px; font-weight: 500;">${label}</span>
      <label style="position: relative; display: inline-block; width: 44px; height: 24px;">
        <input type="checkbox" id="${toggleId}" style="opacity: 0; width: 0; height: 0;">
        <span id="${bgId}" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #333; transition: .3s; border-radius: 24px;">
          <span id="${sliderId}" style="position: absolute; content: ''; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .3s; border-radius: 50%;"></span>
        </span>
      </label>
    </div>`;
}

function updateToggleUI(bgEl, sliderEl, checked) {
	if (checked) {
		bgEl.style.backgroundColor = getAccent();
		sliderEl.style.transform = "translateX(20px)";
	} else {
		bgEl.style.backgroundColor = "#333";
		sliderEl.style.transform = "translateX(0)";
	}
}

function setupToggle(
	overlay,
	{ toggleId, bgId, sliderId, initialValue, onChange },
) {
	const toggle = overlay.querySelector("#" + toggleId);
	const bg = overlay.querySelector("#" + bgId);
	const slider = overlay.querySelector("#" + sliderId);
	toggle.checked = initialValue;
	updateToggleUI(bg, slider, initialValue);
	toggle.addEventListener("change", (e) => {
		updateToggleUI(bg, slider, e.target.checked);
		if (onChange) onChange(e.target.checked);
	});
	return { toggle, bg, slider };
}

// --- syntax highlighting ---

function highlightCss(text) {
	const tokens = [];
	let html = text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");

	const patterns = [
		[/(\/\*[\s\S]*?\*\/)/g, "#6a9955"],
		[/([.#][a-zA-Z0-9_-]+)(?=[\s{])/g, "#d7ba7d"],
		[/([a-zA-Z-]+)\s*(?=:)/g, "#9cdcfe"],
		[/(:\s*)([^;}]+)(?=;|\})/g, "#ce9178"],
	];

	for (const [re, color] of patterns) {
		html = html.replace(re, (match, ...groups) => {
			const content = groups[0] ? groups[0] + groups[1] : match;
			const wrapped = `<span style="color: ${color};">${content}</span>`;
			const tokenIdx = tokens.length;
			tokens.push(wrapped);
			return `__TOKEN${tokenIdx}__`;
		});
	}

	// last pattern has positional groups
	html = html.replace(/__TOKEN(\d+)__/g, (_, i) => tokens[parseInt(i)]);

	if (text[text.length - 1] === "\n") html += " ";
	return html;
}

function highlightJs(text) {
	const tokens = [];
	let html = text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");

	const patterns = [
		[/(\/\/.*)/g, "#6a9955"],
		[/('.*?'|".*?"|`[\s\S]*?`)/g, "#ce9178"],
		[
			/\b(const|let|var|function|return|if|else|for|while|try|catch|async|await|class|new|this|import|export|from|true|false|null|undefined)\b/g,
			"#569cd6",
		],
		[/\b([a-zA-Z0-9_]+)(?=\s*\()/g, "#dcdcaa"],
	];

	for (const [re, color] of patterns) {
		html = html.replace(re, (match) => {
			const wrapped = `<span style="color: ${color};">${match}</span>`;
			const tokenIdx = tokens.length;
			tokens.push(wrapped);
			return `__TOKEN${tokenIdx}__`;
		});
	}

	html = html.replace(/__TOKEN(\d+)__/g, (_, i) => tokens[parseInt(i)]);

	if (text[text.length - 1] === "\n") html += " ";
	return html;
}

// --- code editor setup ---

function setupCodeEditors(overlay) {
	const tabCss = overlay.querySelector("#tab-css");
	const tabJs = overlay.querySelector("#tab-js");
	const cssEditor = overlay.querySelector("#sclient-css-editor");
	const jsEditor = overlay.querySelector("#sclient-js-editor");
	const cssContainer = overlay.querySelector("#sclient-css-container");
	const jsContainer = overlay.querySelector("#sclient-js-container");
	const cssHighlight = overlay.querySelector("#sclient-css-highlight");
	const jsHighlight = overlay.querySelector("#sclient-js-highlight");

	function updateCssHighlight() {
		cssHighlight.innerHTML = highlightCss(cssEditor.value);
	}
	function updateJsHighlight() {
		jsHighlight.innerHTML = highlightJs(jsEditor.value);
	}

	cssEditor.addEventListener("input", updateCssHighlight);
	jsEditor.addEventListener("input", updateJsHighlight);

	cssEditor.addEventListener("scroll", () => {
		cssHighlight.scrollTop = cssEditor.scrollTop;
		cssHighlight.scrollLeft = cssEditor.scrollLeft;
	});
	jsEditor.addEventListener("scroll", () => {
		jsHighlight.scrollTop = jsEditor.scrollTop;
		jsHighlight.scrollLeft = jsEditor.scrollLeft;
	});

	const switchTab = (activeTab, inactiveTab, show, hide) => {
		activeTab.style.background = getAccent();
		activeTab.style.color = "white";
		inactiveTab.style.background = "#333";
		inactiveTab.style.color = "#ccc";
		show.style.display = "block";
		hide.style.display = "none";
	};

	tabCss.addEventListener("click", () =>
		switchTab(tabCss, tabJs, cssContainer, jsContainer),
	);
	tabJs.addEventListener("click", () =>
		switchTab(tabJs, tabCss, jsContainer, cssContainer),
	);

	cssEditor.value = currentCss;
	jsEditor.value = currentJs;
	updateCssHighlight();
	updateJsHighlight();
}

// --- account management ---

function renderAccounts(overlay) {
	sendBridgeMsg("get_accounts")
		.then((accounts) => {
			sendBridgeMsg("get_active_account")
				.then((active) => {
					const list = overlay.querySelector("#sclient-accounts-list");
					list.replaceChildren();
					for (const acc of accounts) {
						const div = document.createElement("div");
						div.style.cssText =
							"display: flex; justify-content: space-between; align-items: center; padding: 8px; background: rgba(255,255,255,0.05); border-radius: 4px;";

						const nameSpan = document.createElement("span");
						nameSpan.textContent = acc;
						if (acc === active) {
							nameSpan.style.cssText = `color: ${getAccent()}; font-weight: bold;`;
							nameSpan.textContent += " (Active)";
						}

						const btnContainer = document.createElement("div");
						btnContainer.style.cssText = "display: flex; gap: 5px;";

						if (acc !== active) {
							const switchBtn = document.createElement("button");
							switchBtn.textContent = "Switch";
							switchBtn.style.cssText =
								"padding: 4px 8px; background: #333; color: white; border: none; border-radius: 3px; cursor: pointer;";
							switchBtn.onclick = () => {
								sendBridgeMsg("set_active_account", { name: acc })
									.then(() => sendBridgeMsg("restart_app"))
									.catch((e) => customAlert("Switch Error: " + e));
							};
							btnContainer.appendChild(switchBtn);
						}

						if (acc !== "main" && acc !== active) {
							const deleteBtn = document.createElement("button");
							deleteBtn.textContent = "Delete";
							deleteBtn.style.cssText =
								"padding: 4px 8px; background: #800; color: white; border: none; border-radius: 3px; cursor: pointer;";
							deleteBtn.onclick = () => {
								customConfirm("Delete account " + acc + "?").then(
									(confirmed) => {
										if (confirmed) {
											sendBridgeMsg("delete_account", { name: acc })
												.then(() => renderAccounts(overlay))
												.catch((e) => customAlert("Delete Error: " + e));
										}
									},
								);
							};
							btnContainer.appendChild(deleteBtn);
						}

						if (acc === "main") {
							const resetBtn = document.createElement("button");
							resetBtn.textContent = "Reset";
							resetBtn.style.cssText =
								"padding: 4px 8px; background: #3a1515; color: #f88; border: 1px solid #5a2020; border-radius: 3px; cursor: pointer;";
							resetBtn.onclick = () => {
								const isActive = acc === active;
								const msg = isActive
									? "Clear all cookies and browser data? The app will restart."
									: "Clear all cookies and browser data for main profile?";
								customConfirm(msg).then((confirmed) => {
									if (confirmed && window.__TAURI__ && window.__TAURI__.core) {
										sendBridgeMsg(
											isActive ? "clear_data_and_restart" : "clear_data",
										);
									}
								});
							};
							btnContainer.appendChild(resetBtn);
						}

						div.appendChild(nameSpan);
						div.appendChild(btnContainer);
						list.appendChild(div);
					}
				})
				.catch((e) => customAlert("Active Account Error: " + e));
		})
		.catch((e) => customAlert("Get Accounts Error: " + e));
}

// --- main overlay ---

function createOverlay() {
	if (document.getElementById("sclient-settings-overlay")) return;

	const accent = getAccent();

	const overlay = document.createElement("div");
	overlay.id = "sclient-settings-overlay";
	overlay.style.cssText = `
    position: fixed; top: 0; right: -450px; width: 400px; height: 100%;
    background: rgba(18, 18, 18, 0.95); backdrop-filter: blur(10px);
    border-left: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: -5px 0 25px rgba(0,0,0,0.5); z-index: 999999;
    transition: right 0.3s ease; display: flex; flex-direction: column;
    color: #fff; font-family: 'Inter', system-ui, -apple-system, sans-serif;
    padding: 20px; box-sizing: border-box;
  `;

	// build toggle definitions (simple toggles only; accent & wide-layout have their own row)
	const TOGGLES = [
		{ label: "Enable OLED Dark Mode", id: "oled-dark-mode" },
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

	const toggleHtml = TOGGLES.map((t) =>
		createToggleHtml({
			label: t.label,
			toggleId: `sclient-${t.id}-toggle`,
			bgId: `sclient-toggle-bg-${t.id}`,
			sliderId: `sclient-toggle-slider-${t.id}`,
		}),
	).join("");

	overlay.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px;">
      <h3 style="margin: 0; font-size: 18px; font-weight: 600; color: ${accent}; display: flex; align-items: center; gap: 8px;">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
        SClient Settings
      </h3>
      <button id="sclient-close-btn" style="background: none; border: none; color: #aaa; cursor: pointer; font-size: 20px; padding: 5px;">&times;</button>
    </div>

    <style>
      #sclient-settings-scroll::-webkit-scrollbar { width: 8px; }
      #sclient-settings-scroll::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); border-radius: 4px; }
      #sclient-settings-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 4px; }
      #sclient-settings-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.3); }
      #sclient-settings-scroll label { flex-shrink: 0; }
    </style>

    <div id="sclient-settings-scroll" style="flex: 1; overflow-y: auto; overflow-x: hidden; padding-right: 8px; display: flex; flex-direction: column; min-height: 0; margin-bottom: 15px;">

      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding: 12px; background: rgba(255,255,255,0.05); border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
        <span style="font-size: 14px; font-weight: 500;">Custom Accent Color</span>
        <div style="display: flex; align-items: center; gap: 10px;">
          <input type="color" id="sclient-accent-color-picker" style="width: 24px; height: 24px; padding: 0; border: none; border-radius: 4px; cursor: pointer; background: transparent;">
          <input type="text" id="sclient-accent-color-text" style="width: 60px; background: rgba(0,0,0,0.5); border: 1px solid #333; color: #fff; border-radius: 4px; padding: 4px; font-family: monospace; font-size: 12px; text-transform: uppercase;">
          <label style="position: relative; display: inline-block; width: 44px; height: 24px;">
            <input type="checkbox" id="sclient-accent-toggle" style="opacity: 0; width: 0; height: 0;">
            <span id="sclient-toggle-bg-accent" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #333; transition: .3s; border-radius: 24px;">
              <span id="sclient-toggle-slider-accent" style="position: absolute; content: ''; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .3s; border-radius: 50%;"></span>
            </span>
          </label>
        </div>
      </div>

      ${toggleHtml}

      <!-- Wide Layout toggle with width input -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding: 12px; background: rgba(255,255,255,0.05); border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
        <span style="font-size: 14px; font-weight: 500;">Enable Wide Layout</span>
        <div style="display: flex; align-items: center; gap: 10px;">
          <input type="text" id="sclient-wide-layout-width" placeholder="1200" style="width: 50px; background: rgba(0,0,0,0.5); border: 1px solid #333; color: #fff; border-radius: 4px; padding: 4px; font-family: monospace; font-size: 12px; text-align: center;" title="Max width in px (min 960)">
          <label style="position: relative; display: inline-block; width: 44px; height: 24px;">
            <input type="checkbox" id="sclient-wide-layout-toggle" style="opacity: 0; width: 0; height: 0;">
            <span id="sclient-toggle-bg-wide-layout" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #333; transition: .3s; border-radius: 24px;">
              <span id="sclient-toggle-slider-wide-layout" style="position: absolute; content: ''; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .3s; border-radius: 50%;"></span>
            </span>
          </label>
        </div>
      </div>

      <!-- ListenBrainz -->
      <div style="margin-bottom: 15px; padding: 12px; background: rgba(255,255,255,0.05); border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <span style="font-size: 14px; font-weight: 500;">ListenBrainz Scrobbling</span>
          <div style="display: flex; align-items: center; gap: 10px;">
            <span id="sclient-listenbrainz-status" style="font-size: 11px; font-weight: bold; padding: 2px 6px; border-radius: 4px; background: rgba(255,255,255,0.1); color: #ccc;">Waiting...</span>
            <label style="position: relative; display: inline-block; width: 44px; height: 24px;">
              <input type="checkbox" id="sclient-listenbrainz-toggle" style="opacity: 0; width: 0; height: 0;">
              <span id="sclient-toggle-bg-listenbrainz" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #333; transition: .3s; border-radius: 24px;">
                <span id="sclient-toggle-slider-listenbrainz" style="position: absolute; content: ''; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .3s; border-radius: 50%;"></span>
              </span>
            </label>
          </div>
        </div>
        <input type="password" id="sclient-listenbrainz-token-input" placeholder="Enter ListenBrainz User Token..." style="width: 100%; box-sizing: border-box; background: rgba(0,0,0,0.5); border: 1px solid #333; color: white; border-radius: 4px; padding: 6px 10px; font-family: Inter, sans-serif; font-size: 12px; outline: none; transition: border-color 0.2s;">
        <div style="margin-top: 5px; font-size: 11px; color: #888;">Get your token from <a href="https://listenbrainz.org/profile/" target="_blank" style="color: #aaa; text-decoration: underline;">listenbrainz.org/profile</a></div>
      </div>

      <!-- Last.fm -->
      <div style="margin-bottom: 15px; padding: 12px; background: rgba(255,255,255,0.05); border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <span style="font-size: 14px; font-weight: 500;">Last.fm Scrobbling</span>
          <div style="display: flex; align-items: center; gap: 10px;">
            <span id="sclient-lastfm-status" style="font-size: 11px; font-weight: bold; padding: 2px 6px; border-radius: 4px; background: rgba(255,255,255,0.1); color: #ccc;">Waiting...</span>
            <label style="position: relative; display: inline-block; width: 44px; height: 24px;">
              <input type="checkbox" id="sclient-lastfm-toggle" style="opacity: 0; width: 0; height: 0;">
              <span id="sclient-toggle-bg-lastfm" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #333; transition: .3s; border-radius: 24px;">
                <span id="sclient-toggle-slider-lastfm" style="position: absolute; content: ''; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .3s; border-radius: 50%;"></span>
              </span>
            </label>
          </div>
        </div>
        <input type="text" id="sclient-lastfm-apikey-input" placeholder="API Key" style="width: 100%; box-sizing: border-box; background: rgba(0,0,0,0.5); border: 1px solid #333; color: white; border-radius: 4px; padding: 6px 10px; font-family: Inter, sans-serif; font-size: 12px; outline: none; transition: border-color 0.2s; margin-bottom: 6px;">
        <input type="password" id="sclient-lastfm-secret-input" placeholder="Shared Secret" style="width: 100%; box-sizing: border-box; background: rgba(0,0,0,0.5); border: 1px solid #333; color: white; border-radius: 4px; padding: 6px 10px; font-family: Inter, sans-serif; font-size: 12px; outline: none; transition: border-color 0.2s; margin-bottom: 8px;">
        <div style="display: flex; gap: 8px; align-items: center;">
          <button id="sclient-lastfm-connect-btn" style="flex: 1; padding: 7px 12px; background: ${accent}; color: white; border: none; border-radius: 4px; font-size: 12px; font-family: Inter, sans-serif; cursor: pointer; transition: background 0.2s;">Connect Last.fm Account</button>
          <button id="sclient-lastfm-disconnect-btn" style="padding: 7px 12px; background: rgba(255,255,255,0.08); color: #aaa; border: 1px solid #444; border-radius: 4px; font-size: 12px; font-family: Inter, sans-serif; cursor: pointer; display: none;">Disconnect</button>
        </div>
        <div id="sclient-lastfm-connected-info" style="margin-top: 6px; font-size: 11px; color: #888; display: none;">Connected as: <span id="sclient-lastfm-username" style="color: ${accent}; font-weight: 600;"></span></div>
        <div style="margin-top: 5px; font-size: 11px; color: #888;">Get your API key from <a href="https://www.last.fm/api/account/create" target="_blank" style="color: #aaa; text-decoration: underline;">last.fm/api/account/create</a></div>
      </div>

      <!-- Stats -->
      <div style="margin-bottom: 15px; padding: 12px; background: rgba(255,255,255,0.05); border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
        <span style="font-size: 14px; font-weight: 500; display: block; margin-bottom: 12px;">Listening Stats</span>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 13px; color: #ccc;">History Sync</span>
            <span style="font-size: 10px; color: #666;">(every 2h)</span>
          </div>
          <label style="position: relative; display: inline-block; width: 44px; height: 24px;">
            <input type="checkbox" id="sclient-stats-api-toggle" style="opacity: 0; width: 0; height: 0;">
            <span id="sclient-toggle-bg-stats-api" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #333; transition: .3s; border-radius: 24px;">
              <span id="sclient-toggle-slider-stats-api" style="position: absolute; content: ''; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .3s; border-radius: 50%;"></span>
            </span>
          </label>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 13px; color: #ccc;">Local Tracking</span>
            <span id="sclient-stats-status" style="font-size: 10px; font-weight: bold; padding: 1px 6px; border-radius: 4px; background: rgba(255,255,255,0.1); color: #666;">--</span>
          </div>
          <label style="position: relative; display: inline-block; width: 44px; height: 24px;">
            <input type="checkbox" id="sclient-stats-local-toggle" style="opacity: 0; width: 0; height: 0;">
            <span id="sclient-toggle-bg-stats-local" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #333; transition: .3s; border-radius: 24px;">
              <span id="sclient-toggle-slider-stats-local" style="position: absolute; content: ''; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .3s; border-radius: 50%;"></span>
            </span>
          </label>
        </div>
        <div style="display: flex; gap: 8px; align-items: center;">
          <button id="sclient-stats-analytics-btn" style="flex: 1; padding: 7px 12px; background: ${accent}; color: white; border: none; border-radius: 4px; font-size: 12px; font-family: Inter, sans-serif; cursor: pointer; transition: background 0.2s;">Open Analytics</button>
          <button id="sclient-stats-wipe-btn" style="padding: 7px 12px; background: rgba(255,255,255,0.08); color: #aaa; border: 1px solid #444; border-radius: 4px; font-size: 12px; font-family: Inter, sans-serif; cursor: pointer;">Wipe Data</button>
        </div>
      </div>

      <!-- True Shuffle -->
      <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 15px; padding: 12px; background: rgba(255,255,255,0.05); border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 14px; font-weight: 500;">Enable True Shuffle (Fix native shuffle)</span>
          <label style="position: relative; display: inline-block; width: 44px; height: 24px;">
            <input type="checkbox" id="sclient-trueshuffle-toggle" style="opacity: 0; width: 0; height: 0;">
            <span id="sclient-toggle-bg-trueshuffle" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #333; transition: .3s; border-radius: 24px;">
              <span id="sclient-toggle-slider-trueshuffle" style="position: absolute; content: ''; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .3s; border-radius: 50%;"></span>
            </span>
          </label>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 12px; color: #888;">Engine:</span>
          <select id="sclient-trueshuffle-engine" style="-webkit-appearance: none; appearance: none; background: rgba(0,0,0,0.5) url('data:image/svg+xml;utf8,<svg fill=%22%23ccc%22 height=%2224%22 viewBox=%220 0 24 24%22 width=%2224%22 xmlns=%22http://www.w3.org/2000/svg%22><path d=%22M7 10l5 5 5-5z%22/></svg>') no-repeat right 4px center; padding-right: 28px; border: 1px solid #333; color: white; border-radius: 6px; padding-top: 6px; padding-bottom: 6px; padding-left: 10px; font-family: Inter, sans-serif; font-size: 12px; outline: none; cursor: pointer; transition: border-color 0.2s;">
            <option value="native" style="background: #1e1e1e; color: white;">Native (song ~1-50 won't be shuffled)</option>
            <option value="api" style="background: #1e1e1e; color: white;">API (overrides full order in the UI)</option>
          </select>
        </div>
      </div>

      <!-- Region Bypass -->
      <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 15px; padding: 12px; background: rgba(255,255,255,0.05); border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 14px; font-weight: 500;">Bypass Song Region Blocks</span>
          <label style="position: relative; display: inline-block; width: 44px; height: 24px;">
            <input type="checkbox" id="sclient-regionbypass-toggle" style="opacity: 0; width: 0; height: 0;">
            <span id="sclient-toggle-bg-regionbypass" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #333; transition: .3s; border-radius: 24px;">
              <span id="sclient-toggle-slider-regionbypass" style="position: absolute; content: ''; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .3s; border-radius: 50%;"></span>
            </span>
          </label>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
          <span style="font-size: 12px; color: #888; white-space: nowrap; flex-shrink: 0;">Proxy URL:</span>
          <input type="text" id="sclient-proxyurl-input" placeholder="https://example.com/" style="flex: 1; min-width: 0; background: rgba(0,0,0,0.5); border: 1px solid #333; color: white; border-radius: 4px; padding: 4px 8px; font-family: Inter, sans-serif; font-size: 12px; outline: none; transition: border-color 0.2s;">
          <button id="sclient-proxyurl-public-btn" style="flex-shrink: 0; white-space: nowrap; padding: 4px 8px; background: #333; border: 1px solid #444; color: #ccc; border-radius: 4px; font-size: 11px; font-family: Inter, sans-serif; cursor: pointer; transition: background 0.2s;">Use Public</button>
        </div>
        <div style="font-size: 10px; color: #666; margin-top: 2px;">Opening profile may geo-lock some songs</div>
      </div>

      <!-- Code Editors -->
      <div style="display: flex; gap: 10px; margin-bottom: 15px;">
        <button id="tab-css" style="flex: 1; padding: 8px; background: ${accent}; border: none; color: white; border-radius: 4px; cursor: pointer; font-weight: 500;">Custom CSS</button>
        <button id="tab-js" style="flex: 1; padding: 8px; background: #333; border: none; color: #ccc; border-radius: 4px; cursor: pointer; font-weight: 500;">Custom JS</button>
      </div>

      <div style="flex: 1 0 400px; min-height: 400px; display: flex; flex-direction: column; margin-bottom: 20px; position: relative; border: 1px solid #333; border-radius: 4px; background: #0c0c0c;">
        <div id="sclient-css-container" style="flex: 1; position: relative; overflow: hidden; display: block;">
          <pre id="sclient-css-highlight" aria-hidden="true" style="margin: 0; position: absolute; top: 0; left: 0; width: 100%; height: 100%; padding: 10px; box-sizing: border-box; font-family: 'Fira Code', Consolas, monospace; font-size: 13px; line-height: 1.5; color: #ccc; pointer-events: none; white-space: pre-wrap; word-wrap: break-word; overflow: hidden;"></pre>
          <textarea id="sclient-css-editor" spellcheck="false" style="margin: 0; position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: transparent; color: transparent; caret-color: #fff; border: none; font-family: 'Fira Code', Consolas, monospace; font-size: 13px; line-height: 1.5; padding: 10px; resize: none; box-sizing: border-box; outline: none; white-space: pre-wrap; word-wrap: break-word;" placeholder="/* Add your custom CSS here */"></textarea>
        </div>
        <div id="sclient-js-container" style="flex: 1; position: relative; overflow: hidden; display: none;">
          <pre id="sclient-js-highlight" aria-hidden="true" style="margin: 0; position: absolute; top: 0; left: 0; width: 100%; height: 100%; padding: 10px; box-sizing: border-box; font-family: 'Fira Code', Consolas, monospace; font-size: 13px; line-height: 1.5; color: #ccc; pointer-events: none; white-space: pre-wrap; word-wrap: break-word; overflow: hidden;"></pre>
          <textarea id="sclient-js-editor" spellcheck="false" style="margin: 0; position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: transparent; color: transparent; caret-color: #fff; border: none; font-family: 'Fira Code', Consolas, monospace; font-size: 13px; line-height: 1.5; padding: 10px; resize: none; box-sizing: border-box; outline: none; white-space: pre-wrap; word-wrap: break-word;" placeholder="// Add your custom JS here"></textarea>
        </div>
      </div>

      <!-- Accounts -->
      <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1); margin-bottom: 20px;">
        <span style="font-size: 16px; font-weight: bold; margin-bottom: 15px; display: block;">Accounts</span>
        <div id="sclient-accounts-list" style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 15px;"></div>
        <div style="display: flex; gap: 8px;">
          <input type="text" id="sclient-new-account-name" placeholder="New Profile Name" style="flex: 1; padding: 8px; background: rgba(0,0,0,0.5); border: 1px solid #333; color: white; border-radius: 4px; font-family: monospace;">
          <button id="sclient-add-account-btn" style="padding: 8px 15px; background: #333; border: none; color: white; border-radius: 4px; cursor: pointer; font-weight: bold;">+ Add Account</button>
        </div>
      </div>
    </div>

    <div style="display: flex; gap: 10px; margin-bottom: 10px;">
      <button id="sclient-save-btn" style="flex: 1; padding: 12px; background: ${accent}; border: none; color: white; border-radius: 4px; font-weight: bold; cursor: pointer; transition: background 0.2s;">Save &amp; Apply</button>
    </div>
    <div style="margin-top: 10px; text-align: center; font-size: 11px; color: #666;">
      Press <kbd style="background: #333; padding: 2px 5px; border-radius: 3px; color: #ccc;">Ctrl + I</kbd> to toggle this menu
    </div>
  `;

	document.body.appendChild(overlay);
	void overlay.offsetHeight; // force reflow

	setupCodeEditors(overlay);

	// --- wire toggles ---

	// lazy scroll
	setupToggle(overlay, {
		toggleId: "sclient-lazy-scroll-toggle",
		bgId: "sclient-toggle-bg-lazy-scroll",
		sliderId: "sclient-toggle-slider-lazy-scroll",
		initialValue: lazyScrollEnabled,
	});

	// decorations
	setupToggle(overlay, {
		toggleId: "sclient-decorations-toggle",
		bgId: "sclient-toggle-bg-decorations",
		sliderId: "sclient-toggle-slider-decorations",
		initialValue: hideDecorationsEnabled,
	});

	// oled dark
	setupToggle(overlay, {
		toggleId: "sclient-oled-dark-mode-toggle",
		bgId: "sclient-toggle-bg-oled-dark-mode",
		sliderId: "sclient-toggle-slider-oled-dark-mode",
		initialValue: oledDarkModeEnabled,
	});

	// enhanced header
	setupToggle(overlay, {
		toggleId: "sclient-enhanced-header-toggle",
		bgId: "sclient-toggle-bg-enhanced-header",
		sliderId: "sclient-toggle-slider-enhanced-header",
		initialValue: enhancedHeaderEnabled,
	});

	// wide layout
	setupToggle(overlay, {
		toggleId: "sclient-wide-layout-toggle",
		bgId: "sclient-toggle-bg-wide-layout",
		sliderId: "sclient-toggle-slider-wide-layout",
		initialValue: wideLayoutEnabled,
	});
	const wideWidthInput = overlay.querySelector("#sclient-wide-layout-width");
	wideWidthInput.value =
		wideLayoutWidth && wideLayoutWidth !== "1200" ? wideLayoutWidth : "";

	// collapsible sidebar
	setupToggle(overlay, {
		toggleId: "sclient-collapsible-sidebar-toggle",
		bgId: "sclient-toggle-bg-collapsible-sidebar",
		sliderId: "sclient-toggle-slider-collapsible-sidebar",
		initialValue: collapsibleSidebarEnabled,
	});

	// adblock
	setupToggle(overlay, {
		toggleId: "sclient-adblock-toggle",
		bgId: "sclient-toggle-bg-adblock",
		sliderId: "sclient-toggle-slider-adblock",
		initialValue: adblockEnabled,
	});

	// rpc
	setupToggle(overlay, {
		toggleId: "sclient-rpc-toggle",
		bgId: "sclient-toggle-bg-rpc",
		sliderId: "sclient-toggle-slider-rpc",
		initialValue: discordRpcEnabled,
		onChange(checked) {
			if (!checked) {
				sendBridgeMsg("update_rpc", {
					title: "",
					artist: "",
					isPlaying: false,
					artwork: "",
					timeStart: 0,
					timeEnd: 0,
				});
			}
		},
	});

	// tray
	setupToggle(overlay, {
		toggleId: "sclient-tray-toggle",
		bgId: "sclient-toggle-bg-tray",
		sliderId: "sclient-toggle-slider-tray",
		initialValue: trayIconEnabled,
	});

	// upsell
	setupToggle(overlay, {
		toggleId: "sclient-upsell-toggle",
		bgId: "sclient-toggle-bg-upsell",
		sliderId: "sclient-toggle-slider-upsell",
		initialValue: hideUpsellEnabled,
	});

	// artists
	setupToggle(overlay, {
		toggleId: "sclient-artists-toggle",
		bgId: "sclient-toggle-bg-artists",
		sliderId: "sclient-toggle-slider-artists",
		initialValue: hideArtistsEnabled,
	});

	// true shuffle
	setupToggle(overlay, {
		toggleId: "sclient-trueshuffle-toggle",
		bgId: "sclient-toggle-bg-trueshuffle",
		sliderId: "sclient-toggle-slider-trueshuffle",
		initialValue: trueShuffleEnabled,
	});
	overlay.querySelector("#sclient-trueshuffle-engine").value = trueShuffleMode;

	// region bypass
	setupToggle(overlay, {
		toggleId: "sclient-regionbypass-toggle",
		bgId: "sclient-toggle-bg-regionbypass",
		sliderId: "sclient-toggle-slider-regionbypass",
		initialValue: regionBypassEnabled,
	});

	// --- wire special elements ---

	// accent
	const accentToggle = overlay.querySelector("#sclient-accent-toggle");
	const accentToggleBg = overlay.querySelector("#sclient-toggle-bg-accent");
	const accentToggleSlider = overlay.querySelector(
		"#sclient-toggle-slider-accent",
	);
	const accentPicker = overlay.querySelector("#sclient-accent-color-picker");
	const accentText = overlay.querySelector("#sclient-accent-color-text");

	accentToggle.checked = customAccentEnabled;
	accentPicker.value = accentColor;
	accentText.value = accentColor;

	function updateAccentToggleUI(checked) {
		if (checked) {
			accentToggleBg.style.backgroundColor = getAccent();
			accentToggleSlider.style.transform = "translateX(20px)";
			accentPicker.style.opacity = "1";
			accentText.style.opacity = "1";
		} else {
			accentToggleBg.style.backgroundColor = "#333";
			accentToggleSlider.style.transform = "translateX(0)";
			accentPicker.style.opacity = "0.5";
			accentText.style.opacity = "0.5";
		}
	}
	updateAccentToggleUI(customAccentEnabled);
	accentToggle.addEventListener("change", (e) =>
		updateAccentToggleUI(e.target.checked),
	);
	accentPicker.addEventListener("input", (e) => {
		accentText.value = e.target.value;
	});
	accentText.addEventListener("input", (e) => {
		if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
			accentPicker.value = e.target.value;
		}
	});

	// listenbrainz
	setupToggle(overlay, {
		toggleId: "sclient-listenbrainz-toggle",
		bgId: "sclient-toggle-bg-listenbrainz",
		sliderId: "sclient-toggle-slider-listenbrainz",
		initialValue: listenbrainzEnabled,
	});
	overlay.querySelector("#sclient-listenbrainz-token-input").value =
		listenbrainzToken;

	// last.fm
	setupToggle(overlay, {
		toggleId: "sclient-lastfm-toggle",
		bgId: "sclient-toggle-bg-lastfm",
		sliderId: "sclient-toggle-slider-lastfm",
		initialValue: lastfmEnabled,
	});
	overlay.querySelector("#sclient-lastfm-apikey-input").value = lastfmApiKey;
	overlay.querySelector("#sclient-lastfm-secret-input").value = lastfmSecret;

	function updateLastfmConnectedUI(username) {
		const connectBtn = overlay.querySelector("#sclient-lastfm-connect-btn");
		const disconnectBtn = overlay.querySelector(
			"#sclient-lastfm-disconnect-btn",
		);
		const connectedInfo = overlay.querySelector(
			"#sclient-lastfm-connected-info",
		);
		const usernameEl = overlay.querySelector("#sclient-lastfm-username");
		if (username) {
			connectBtn.textContent = "Reconnect";
			disconnectBtn.style.display = "";
			connectedInfo.style.display = "";
			usernameEl.textContent = username;
		} else {
			connectBtn.textContent = "Connect Last.fm Account";
			disconnectBtn.style.display = "none";
			connectedInfo.style.display = "none";
		}
	}
	updateLastfmConnectedUI(lastfmUsername);

	overlay
		.querySelector("#sclient-lastfm-connect-btn")
		.addEventListener("click", async () => {
			const connectBtn = overlay.querySelector("#sclient-lastfm-connect-btn");
			connectBtn.textContent = "Waiting for Last.fm...";
			connectBtn.disabled = true;
			await sendBridgeMsg("lastfm_save_credentials", {
				apiKey: overlay
					.querySelector("#sclient-lastfm-apikey-input")
					.value.trim(),
				secret: overlay
					.querySelector("#sclient-lastfm-secret-input")
					.value.trim(),
			});
			const result = await sendBridgeMsg("lastfm_authenticate", {});
			connectBtn.disabled = false;
			if (result && result.success) {
				updateLastfmConnectedUI(result.username);
			} else if (result && result.error && result.error !== "cancelled") {
				customAlert("Last.fm auth failed: " + result.error);
				connectBtn.textContent = "Connect Last.fm Account";
			} else {
				connectBtn.textContent = "Connect Last.fm Account";
			}
		});

	overlay
		.querySelector("#sclient-lastfm-disconnect-btn")
		.addEventListener("click", async () => {
			await sendBridgeMsg("lastfm_disconnect", {});
			updateLastfmConnectedUI("");
		});

	// stats toggles
	function setupStatsToggle(toggleId, bgId, sliderId, initial) {
		setupToggle(overlay, { toggleId, bgId, sliderId, initialValue: initial });
	}

	setupStatsToggle(
		"sclient-stats-api-toggle",
		"sclient-toggle-bg-stats-api",
		"sclient-toggle-slider-stats-api",
		statsApiSyncEnabled,
	);
	setupStatsToggle(
		"sclient-stats-local-toggle",
		"sclient-toggle-bg-stats-local",
		"sclient-toggle-slider-stats-local",
		statsLocalTrackingEnabled,
	);

	overlay
		.querySelector("#sclient-stats-analytics-btn")
		.addEventListener("click", () => {
			overlay.style.right = "-450px";
			if (typeof toggleAnalyticsOverlay === "function") {
				setTimeout(() => toggleAnalyticsOverlay(), 300);
			}
		});

	overlay
		.querySelector("#sclient-stats-wipe-btn")
		.addEventListener("click", () => {
			customConfirm("Delete all listening data? This cannot be undone.").then(
				(confirmed) => {
					if (confirmed) {
						sendBridgeMsg("stats_wipe_db", {})
							.then(() => customAlert("Stats data wiped."))
							.catch((e) => customAlert("Wipe failed: " + e));
					}
				},
			);
		});

	// proxy URL
	overlay.querySelector("#sclient-proxyurl-input").value = proxyUrl;
	overlay
		.querySelector("#sclient-proxyurl-public-btn")
		.addEventListener("click", () => {
			overlay.querySelector("#sclient-proxyurl-input").value =
				"https://scproxy.vercel.app/";
		});

	// close
	overlay
		.querySelector("#sclient-close-btn")
		.addEventListener("click", toggleOverlay);

	// save
	overlay.querySelector("#sclient-save-btn").addEventListener("click", () => {
		const collect = (sel) => overlay.querySelector(sel);
		const newCss = collect("#sclient-css-editor").value;
		const newJs = collect("#sclient-js-editor").value;
		const newLazyScroll = collect("#sclient-lazy-scroll-toggle").checked;
		const newHideDecorations = collect("#sclient-decorations-toggle").checked;
		const newCustomAccent = accentToggle.checked;
		const newAccentColor = accentText.value;
		const newWideLayout = collect("#sclient-wide-layout-toggle").checked;
		let newWideLayoutWidth = wideWidthInput.value.trim();
		const newCollapsibleSidebar = collect(
			"#sclient-collapsible-sidebar-toggle",
		).checked;
		const newOledDarkMode = collect("#sclient-oled-dark-mode-toggle").checked;
		const newEnhancedHeader = collect(
			"#sclient-enhanced-header-toggle",
		).checked;
		const newAdblock = collect("#sclient-adblock-toggle").checked;
		const newDiscordRpc = collect("#sclient-rpc-toggle").checked;
		const newTrayIcon = collect("#sclient-tray-toggle").checked;
		const newHideUpsell = collect("#sclient-upsell-toggle").checked;
		const newHideArtists = collect("#sclient-artists-toggle").checked;
		const newTrueShuffle = collect("#sclient-trueshuffle-toggle").checked;
		const newTrueShuffleMode = collect("#sclient-trueshuffle-engine").value;
		const newRegionBypass = collect("#sclient-regionbypass-toggle").checked;
		const newProxyUrl = collect("#sclient-proxyurl-input").value;
		const newListenbrainz = collect("#sclient-listenbrainz-toggle").checked;
		const newListenbrainzToken = collect(
			"#sclient-listenbrainz-token-input",
		).value;
		const newLastfm = collect("#sclient-lastfm-toggle").checked;
		const newLastfmApiKey = collect(
			"#sclient-lastfm-apikey-input",
		).value.trim();
		const newLastfmSecret = collect(
			"#sclient-lastfm-secret-input",
		).value.trim();
		const newStatsApiSync = collect("#sclient-stats-api-toggle").checked;
		const newStatsLocalTracking = collect(
			"#sclient-stats-local-toggle",
		).checked;

		// validate wide layout width
		if (newWideLayout) {
			if (newWideLayoutWidth === "") {
				newWideLayoutWidth = "1200";
			} else if (newWideLayoutWidth.toLowerCase() === "unlimited") {
				newWideLayoutWidth = "unlimited";
			} else {
				const parsed = parseInt(newWideLayoutWidth, 10);
				if (isNaN(parsed) || parsed < 960) {
					customAlert("Wide Layout max width must be a number >= 960");
					return;
				}
				newWideLayoutWidth = parsed.toString();
			}
		}

		sendBridgeMsg("save_custom_files", {
			css: newCss,
			js: newJs,
			lazyScroll: newLazyScroll,
			hideDecorations: newHideDecorations,
			customAccent: newCustomAccent,
			accentColor: newAccentColor,
			wideLayout: newWideLayout,
			wideLayoutWidth: newWideLayoutWidth,
			collapsibleSidebar: newCollapsibleSidebar,
			oledDarkMode: newOledDarkMode,
			adblock: newAdblock,
			discordRpc: newDiscordRpc,
			trayIcon: newTrayIcon,
			hideUpsell: newHideUpsell,
			hideArtists: newHideArtists,
			trueShuffle: newTrueShuffle,
			trueShuffleMode: newTrueShuffleMode,
			regionBypass: newRegionBypass,
			proxyUrl: newProxyUrl,
			enhancedHeader: newEnhancedHeader,
			listenbrainz: newListenbrainz,
			listenbrainzToken: newListenbrainzToken,
			lastfm: newLastfm,
			lastfmApiKey: newLastfmApiKey,
			lastfmSecret: newLastfmSecret,
			statsApiSync: newStatsApiSync,
			statsLocalTracking: newStatsLocalTracking,
		})
			.then(() => {
				window.location.reload();
			})
			.catch((err) => {
				customAlert("Failed to save: " + err);
			});
	});

	renderAccounts(overlay);
}

function toggleOverlay() {
	createOverlay();
	const overlay = document.getElementById("sclient-settings-overlay");
	if (overlay.style.right === "0px") {
		overlay.style.right = "-450px";
	} else {
		// re-sync editor contents on open
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

		overlay.style.right = "0px";
	}
}

// toggle on ctrl+i
document.addEventListener("keydown", (e) => {
	if (e.ctrlKey && e.key.toLowerCase() === "i") {
		e.preventDefault();
		toggleOverlay();
	}
});
