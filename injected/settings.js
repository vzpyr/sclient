function toggleHtml({ label, toggleId, bgId, sliderId }) {
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

function updateToggle(bg, slider, checked) {
	if (checked) {
		bg.style.backgroundColor = getAccent();
		slider.style.transform = "translateX(20px)";
	} else {
		bg.style.backgroundColor = "#333";
		slider.style.transform = "translateX(0)";
	}
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

function highlightCss(text) {
	let html = text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
	const tokens = [];

	const patterns = [
		[/(\/\*[\s\S]*?\*\/)/g, "#6a9955"],
		[/([.#][a-zA-Z0-9_-]+)(?=[\s{])/g, "#d7ba7d"],
		[/([a-zA-Z-]+)\s*(?=:)/g, "#9cdcfe"],
		[/(:\s*)([^;}]+)(?=;|\})/g, "#ce9178"],
	];

	for (const [re, color] of patterns) {
		html = html.replace(re, (m, ...groups) => {
			const content = groups[0] ? groups[0] + groups[1] : m;
			const idx = tokens.length;
			tokens.push(`<span style="color: ${color};">${content}</span>`);
			return `__T${idx}__`;
		});
	}

	html = html.replace(/__T(\d+)__/g, (_, i) => tokens[parseInt(i)]);
	if (text[text.length - 1] === "\n") html += " ";
	return html;
}

function highlightJs(text) {
	let html = text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
	const tokens = [];

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
		html = html.replace(re, (m) => {
			const idx = tokens.length;
			tokens.push(`<span style="color: ${color};">${m}</span>`);
			return `__T${idx}__`;
		});
	}

	html = html.replace(/__T(\d+)__/g, (_, i) => tokens[parseInt(i)]);
	if (text[text.length - 1] === "\n") html += " ";
	return html;
}

function setupEditors(overlay) {
	const tabCss = overlay.querySelector("#tab-css");
	const tabJs = overlay.querySelector("#tab-js");
	const cssEd = overlay.querySelector("#sclient-css-editor");
	const jsEd = overlay.querySelector("#sclient-js-editor");
	const cssCon = overlay.querySelector("#sclient-css-container");
	const jsCon = overlay.querySelector("#sclient-js-container");
	const cssHl = overlay.querySelector("#sclient-css-highlight");
	const jsHl = overlay.querySelector("#sclient-js-highlight");

	const updateCss = () => {
		cssHl.innerHTML = highlightCss(cssEd.value);
	};
	const updateJs = () => {
		jsHl.innerHTML = highlightJs(jsEd.value);
	};

	cssEd.addEventListener("input", updateCss);
	jsEd.addEventListener("input", updateJs);

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

	tabCss.addEventListener("click", () =>
		switchTab(tabCss, tabJs, cssCon, jsCon),
	);
	tabJs.addEventListener("click", () =>
		switchTab(tabJs, tabCss, jsCon, cssCon),
	);

	cssEd.value = currentCss;
	jsEd.value = currentJs;
	updateCss();
	updateJs();
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
							"display: flex; justify-content: space-between; align-items: center; padding: 8px; background: rgba(255,255,255,0.05); border-radius: 4px;";

						const name = document.createElement("span");
						name.textContent = acc;
						if (acc === active) {
							name.style.cssText = `color: ${getAccent()}; font-weight: bold;`;
							name.textContent += " (Active)";
						}

						const btns = document.createElement("div");
						btns.style.cssText = "display: flex; gap: 5px;";

						if (acc !== active) {
							const sw = document.createElement("button");
							sw.textContent = "Switch";
							sw.style.cssText =
								"padding: 4px 8px; background: #333; color: white; border: none; border-radius: 3px; cursor: pointer;";
							sw.onclick = () => {
								sendBridge("set_active_account", { name: acc })
									.then(() => sendBridge("restart_app"))
									.catch((e) => {
										console.error("[SClient] Account switch failed:", e);
										showToast("Switch Error: " + e);
									});
							};
							btns.appendChild(sw);
						}

						if (acc !== "main" && acc !== active) {
							const del = document.createElement("button");
							del.textContent = "Delete";
							del.style.cssText =
								"padding: 4px 8px; background: #800; color: white; border: none; border-radius: 3px; cursor: pointer;";
							del.onclick = () => {
								showConfirm("Delete account " + acc + "?").then((ok) => {
									if (ok) {
										sendBridge("delete_account", { name: acc })
											.then(() => renderAccounts(overlay))
											.catch((e) => {
												console.error("[SClient] Account delete failed:", e);
												showToast("Delete Error: " + e);
											});
									}
								});
							};
							btns.appendChild(del);
						}

						if (acc === "main") {
							const rst = document.createElement("button");
							rst.textContent = "Reset";
							rst.style.cssText =
								"padding: 4px 8px; background: #3a1515; color: #f88; border: 1px solid #5a2020; border-radius: 3px; cursor: pointer;";
							rst.onclick = () => {
								const msg =
									acc === active
										? "Clear all cookies and browser data? The app will restart."
										: "Clear all cookies and browser data for main profile?";
								showConfirm(msg).then((ok) => {
									if (ok)
										sendBridge(
											acc === active ? "clear_data_and_restart" : "clear_data",
										);
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
    position: fixed; top: 0; right: -450px; width: 400px; height: 100%;
    background: rgba(18, 18, 18, 0.95); backdrop-filter: blur(10px);
    border-left: 1px solid rgba(255, 255, 255, 0.1);
    box-shadow: -5px 0 25px rgba(0,0,0,0.5); z-index: 999999;
    transition: right 0.3s ease; display: flex; flex-direction: column;
    color: #fff; font-family: 'Inter', system-ui, -apple-system, sans-serif;
    padding: 20px; box-sizing: border-box;
  `;

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

	const togglesHtml = TOGGLES.map((t) =>
		toggleHtml({
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

      ${togglesHtml}

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

	setupEditors(overlay);

	setupToggle(overlay, {
		toggleId: "sclient-lazy-scroll-toggle",
		bgId: "sclient-toggle-bg-lazy-scroll",
		sliderId: "sclient-toggle-slider-lazy-scroll",
		initial: lazyScrollOn,
	});
	setupToggle(overlay, {
		toggleId: "sclient-decorations-toggle",
		bgId: "sclient-toggle-bg-decorations",
		sliderId: "sclient-toggle-slider-decorations",
		initial: hideDecorationsOn,
	});
	setupToggle(overlay, {
		toggleId: "sclient-oled-dark-mode-toggle",
		bgId: "sclient-toggle-bg-oled-dark-mode",
		sliderId: "sclient-toggle-slider-oled-dark-mode",
		initial: oledDarkOn,
	});
	setupToggle(overlay, {
		toggleId: "sclient-enhanced-header-toggle",
		bgId: "sclient-toggle-bg-enhanced-header",
		sliderId: "sclient-toggle-slider-enhanced-header",
		initial: enhancedHeaderOn,
	});

	setupToggle(overlay, {
		toggleId: "sclient-wide-layout-toggle",
		bgId: "sclient-toggle-bg-wide-layout",
		sliderId: "sclient-toggle-slider-wide-layout",
		initial: wideLayoutOn,
	});
	const widthInput = overlay.querySelector("#sclient-wide-layout-width");
	widthInput.value =
		wideLayoutWidth && wideLayoutWidth !== "1200" ? wideLayoutWidth : "";

	setupToggle(overlay, {
		toggleId: "sclient-collapsible-sidebar-toggle",
		bgId: "sclient-toggle-bg-collapsible-sidebar",
		sliderId: "sclient-toggle-slider-collapsible-sidebar",
		initial: collapsibleSidebarOn,
	});
	setupToggle(overlay, {
		toggleId: "sclient-adblock-toggle",
		bgId: "sclient-toggle-bg-adblock",
		sliderId: "sclient-toggle-slider-adblock",
		initial: adblockOn,
	});

	setupToggle(overlay, {
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
	});

	setupToggle(overlay, {
		toggleId: "sclient-tray-toggle",
		bgId: "sclient-toggle-bg-tray",
		sliderId: "sclient-toggle-slider-tray",
		initial: cfg.tray_icon || false,
	});
	setupToggle(overlay, {
		toggleId: "sclient-upsell-toggle",
		bgId: "sclient-toggle-bg-upsell",
		sliderId: "sclient-toggle-slider-upsell",
		initial: hideUpsellOn,
	});
	setupToggle(overlay, {
		toggleId: "sclient-artists-toggle",
		bgId: "sclient-toggle-bg-artists",
		sliderId: "sclient-toggle-slider-artists",
		initial: hideArtistsOn,
	});

	setupToggle(overlay, {
		toggleId: "sclient-trueshuffle-toggle",
		bgId: "sclient-toggle-bg-trueshuffle",
		sliderId: "sclient-toggle-slider-trueshuffle",
		initial: trueShuffleOn,
	});
	overlay.querySelector("#sclient-trueshuffle-engine").value = trueShuffleMode;

	setupToggle(overlay, {
		toggleId: "sclient-regionbypass-toggle",
		bgId: "sclient-toggle-bg-regionbypass",
		sliderId: "sclient-toggle-slider-regionbypass",
		initial: regionBypassOn,
	});

	const accentToggle = overlay.querySelector("#sclient-accent-toggle");
	const accentBg = overlay.querySelector("#sclient-toggle-bg-accent");
	const accentSlider = overlay.querySelector("#sclient-toggle-slider-accent");
	const accentPicker = overlay.querySelector("#sclient-accent-color-picker");
	const accentText = overlay.querySelector("#sclient-accent-color-text");

	accentToggle.checked = customAccentOn;
	accentPicker.value = accentColor;
	accentText.value = accentColor;

	function setAccentUi(on) {
		if (on) {
			accentBg.style.backgroundColor = getAccent();
			accentSlider.style.transform = "translateX(20px)";
			accentPicker.style.opacity = "1";
			accentText.style.opacity = "1";
		} else {
			accentBg.style.backgroundColor = "#333";
			accentSlider.style.transform = "translateX(0)";
			accentPicker.style.opacity = "0.5";
			accentText.style.opacity = "0.5";
		}
	}
	setAccentUi(customAccentOn);
	accentToggle.addEventListener("change", (e) => setAccentUi(e.target.checked));
	accentPicker.addEventListener("input", (e) => {
		accentText.value = e.target.value;
	});
	accentText.addEventListener("input", (e) => {
		if (/^#[0-9A-F]{6}$/i.test(e.target.value))
			accentPicker.value = e.target.value;
	});

	setupToggle(overlay, {
		toggleId: "sclient-listenbrainz-toggle",
		bgId: "sclient-toggle-bg-listenbrainz",
		sliderId: "sclient-toggle-slider-listenbrainz",
		initial: listenbrainzOn,
	});
	overlay.querySelector("#sclient-listenbrainz-token-input").value =
		listenbrainzToken;

	setupToggle(overlay, {
		toggleId: "sclient-lastfm-toggle",
		bgId: "sclient-toggle-bg-lastfm",
		sliderId: "sclient-toggle-slider-lastfm",
		initial: lastfmOn,
	});
	overlay.querySelector("#sclient-lastfm-apikey-input").value =
		cfg.lastfm_api_key || "";
	overlay.querySelector("#sclient-lastfm-secret-input").value =
		cfg.lastfm_secret || "";

	function setLastfmUi(username) {
		const connect = overlay.querySelector("#sclient-lastfm-connect-btn");
		const disconnect = overlay.querySelector("#sclient-lastfm-disconnect-btn");
		const info = overlay.querySelector("#sclient-lastfm-connected-info");
		const userEl = overlay.querySelector("#sclient-lastfm-username");
		if (username) {
			connect.textContent = "Reconnect";
			disconnect.style.display = "";
			info.style.display = "";
			userEl.textContent = username;
		} else {
			connect.textContent = "Connect Last.fm Account";
			disconnect.style.display = "none";
			info.style.display = "none";
		}
	}
	setLastfmUi(lastfmUsername);

	overlay
		.querySelector("#sclient-lastfm-connect-btn")
		.addEventListener("click", async () => {
			const btn = overlay.querySelector("#sclient-lastfm-connect-btn");
			btn.textContent = "Waiting for Last.fm...";
			btn.disabled = true;
			await sendBridge("lastfm_save_credentials", {
				apiKey: overlay
					.querySelector("#sclient-lastfm-apikey-input")
					.value.trim(),
				secret: overlay
					.querySelector("#sclient-lastfm-secret-input")
					.value.trim(),
			});
			const result = await sendBridge("lastfm_authenticate", {});
			btn.disabled = false;
			if (result && result.success) setLastfmUi(result.username);
			else if (result && result.error && result.error !== "cancelled") {
				showToast("Last.fm auth failed: " + result.error);
				btn.textContent = "Connect Last.fm Account";
			} else btn.textContent = "Connect Last.fm Account";
		});

	overlay
		.querySelector("#sclient-lastfm-disconnect-btn")
		.addEventListener("click", async () => {
			await sendBridge("lastfm_disconnect", {});
			setLastfmUi("");
		});

	setupToggle(overlay, {
		toggleId: "sclient-stats-api-toggle",
		bgId: "sclient-toggle-bg-stats-api",
		sliderId: "sclient-toggle-slider-stats-api",
		initial: statsApiOn,
	});
	setupToggle(overlay, {
		toggleId: "sclient-stats-local-toggle",
		bgId: "sclient-toggle-bg-stats-local",
		sliderId: "sclient-toggle-slider-stats-local",
		initial: statsLocalOn,
	});

	overlay
		.querySelector("#sclient-stats-analytics-btn")
		.addEventListener("click", () => {
			overlay.style.right = "-450px";
			if (typeof toggleAnalytics === "function")
				setTimeout(() => toggleAnalytics(), 300);
		});

	overlay
		.querySelector("#sclient-stats-wipe-btn")
		.addEventListener("click", () => {
			showConfirm("Delete all listening data? This cannot be undone.").then(
				(ok) => {
					if (ok) {
						sendBridge("stats_wipe_db", {})
							.then(() => showToast("Stats data wiped."))
							.catch((e) => {
								console.error("[SClient] Stats wipe failed:", e);
								showToast("Wipe failed: " + e);
							});
					}
				},
			);
		});

	overlay.querySelector("#sclient-proxyurl-input").value = proxyUrl;
	overlay
		.querySelector("#sclient-proxyurl-public-btn")
		.addEventListener("click", () => {
			overlay.querySelector("#sclient-proxyurl-input").value =
				"https://scproxy.vercel.app/";
		});

	overlay
		.querySelector("#sclient-close-btn")
		.addEventListener("click", toggleOverlay);

	overlay.querySelector("#sclient-save-btn").addEventListener("click", () => {
		const $ = (sel) => overlay.querySelector(sel);
		let ww = widthInput.value.trim();

		if (wideLayoutOn) {
			if (ww === "") ww = "1200";
			else if (ww.toLowerCase() === "unlimited") ww = "unlimited";
			else {
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
			wideLayout: $("#sclient-wide-layout-toggle").checked,
			wideLayoutWidth: ww,
			collapsibleSidebar: $("#sclient-collapsible-sidebar-toggle").checked,
			oledDarkMode: $("#sclient-oled-dark-mode-toggle").checked,
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
		overlay.style.right = "0px";
	}
}

document.addEventListener("keydown", (e) => {
	if (e.ctrlKey && e.key.toLowerCase() === "i") {
		e.preventDefault();
		toggleOverlay();
	}
});
