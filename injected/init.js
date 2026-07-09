// ui bootstrap — injects buttons, icons, toggles, and sets up observer

// --- settings button in nav menu ---

function injectSClientMenuButton() {
	if (document.getElementById("sclient-settings-btn")) return;

	const targetMenu = document.querySelector(".header__right .header__navMenu");
	if (!targetMenu || !targetMenu.parentNode) return;

	const customNavMenu = document.createElement("ul");
	customNavMenu.className = "header__navMenu sc-clearfix sc-list-nostyle left";
	customNavMenu.style.marginRight = "10px";

	const listItem = document.createElement("li");
	const button = document.createElement("a");
	button.id = "sclient-settings-btn";
	button.href = "#";
	button.className = "header__moreButton";
	button.style.cssText =
		"display: flex; align-items: center; justify-content: center;";
	button.title = "SClient Settings";
	button.innerHTML = `<div class="header__moreButtonIcon" style="width: 22px; height: 22px; display: flex; align-items: center; justify-content: center;">
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/></svg>
  </div>`;

	button.addEventListener("click", (e) => {
		e.preventDefault();
		toggleOverlay();
	});

	listItem.appendChild(button);
	customNavMenu.appendChild(listItem);
	targetMenu.parentNode.insertBefore(customNavMenu, targetMenu);
}

// --- sidebar toggle button ---

function injectSidebarToggle() {
	if (document.getElementById("sclient-sidebar-toggle")) return;

	const btn = document.createElement("button");
	btn.id = "sclient-sidebar-toggle";
	btn.className = "sclient-floating-btn";
	btn.title = "Toggle Sidebar";
	btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 3v18"/><path d="m10 15-3-3 3-3"/></svg>`;

	btn.addEventListener("click", (e) => {
		e.preventDefault();
		document.body.classList.toggle("sclient-sidebar-open");
		const isOpen = document.body.classList.contains("sclient-sidebar-open");
		btn.classList.toggle("active", isOpen);
		btn.style.right = isOpen ? "360px" : "20px";
		btn.innerHTML = isOpen
			? `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 3v18"/><path d="m8 9 3 3-3 3"/></svg>`
			: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 3v18"/><path d="m10 15-3-3 3-3"/></svg>`;
	});

	document.body.appendChild(btn);
}

// --- icon replacement helper ---

const NAV_ICON_MAP = {
	home: '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
	stream:
		'<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1"/></svg>',
	library:
		'<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 6 4 14"/><path d="M12 6v14"/><path d="M8 8v12"/><path d="M4 4v16"/></svg>',
};

function safeReplaceSvg(container, svgHtml) {
	if (!container || container.querySelector(".sclient-svg-container")) return;
	const nativeSvgs = container.querySelectorAll("svg");
	nativeSvgs.forEach((svg) => {
		svg.style.display = "none";
	});
	container.style.cssText =
		"font-size: 0; line-height: 0; display: flex; align-items: center; justify-content: center;";
	const customIcon = document.createElement("div");
	customIcon.className = "sclient-svg-container";
	customIcon.style.cssText =
		"display: flex; align-items: center; justify-content: center;";
	customIcon.innerHTML = svgHtml;
	container.appendChild(customIcon);
}

function replaceNavTabsWithIcons() {
	for (const [menuName, svg] of Object.entries(NAV_ICON_MAP)) {
		const tab = document.querySelector(`a[data-menu-name="${menuName}"]`);
		if (tab) safeReplaceSvg(tab, svg);
	}

	// notification bell
	const notifBtn = document.querySelector(
		".header__userNavActivitiesButton .notificationIcon > div:first-child",
	);
	if (notifBtn) {
		safeReplaceSvg(
			notifBtn,
			'<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>',
		);
		notifBtn.title = "Notifications";
	}

	// messages
	const msgBtn = document.querySelector(
		".header__userNavMessagesButton .notificationIcon > div:first-child",
	);
	if (msgBtn) {
		safeReplaceSvg(
			msgBtn,
			'<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>',
		);
		msgBtn.title = "Messages";
	}

	// user chevron
	const userChevron = document.querySelector(
		".header__userNavUsernameButtonIcon > div:first-child",
	);
	if (userChevron) {
		safeReplaceSvg(
			userChevron,
			'<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
		);
	}

	// more menu
	const moreContainer = document.querySelector(
		"a.header__moreButton:not(#sclient-settings-btn) .header__moreButtonIcon > div:first-child",
	);
	if (moreContainer) {
		safeReplaceSvg(
			moreContainer,
			'<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>',
		);
	}

	// upload
	const uploadTitle = document.querySelector(".uploadButton__title");
	if (uploadTitle) {
		safeReplaceSvg(
			uploadTitle,
			'<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m17 8-5-5-5 5"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/></svg>',
		);
		const uploadBtn = document.querySelector(".uploadButton");
		if (uploadBtn) uploadBtn.title = "Upload";
	}

	// artist studio
	const artistBtn = document.querySelector(".header__forArtistsButton");
	if (artistBtn) {
		safeReplaceSvg(
			artistBtn,
			'<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="M6 8h4"/><path d="M14 8h.01"/><path d="M18 8h.01"/><path d="M2 12h20"/><path d="M6 12v4"/><path d="M10 12v4"/><path d="M14 12v4"/><path d="M18 12v4"/></svg>',
		);
		artistBtn.title = "Artist Studio";
	}
}

// --- nav buttons (back/forward) ---

function injectNavigationButtons() {
	if (document.getElementById("sclient-nav-back-btn")) return;

	const navMenu = document.querySelector(".header__navMenu");
	if (!navMenu || !navMenu.firstChild) return;

	function makeNavBtn(id, title, marginRight, svgPath, handler) {
		const li = document.createElement("li");
		const btn = document.createElement("a");
		btn.id = id;
		btn.className = "header__navMenuItem";
		if (id === "sclient-nav-back-btn") btn.classList.add("sc-mr-1x");
		btn.title = title;
		btn.style.cssText = `font-size: 0px; line-height: 0; display: flex; align-items: center; justify-content: center; cursor: pointer; height: 46px; width: 30px; padding: 0; ${marginRight ? "margin-right: 10px;" : ""}`;
		btn.innerHTML = `<div class="sclient-svg-container" style="display: flex; align-items: center; justify-content: center; height: 100%; width: 100%;"><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${svgPath}"/></svg></div>`;
		btn.addEventListener("click", (e) => {
			e.preventDefault();
			handler();
		});
		li.appendChild(btn);
		return li;
	}

	const fwdLi = makeNavBtn(
		"sclient-nav-fwd-btn",
		"Forward",
		true,
		"m9 18 6-6-6-6",
		() => window.history.forward(),
	);
	const backLi = makeNavBtn(
		"sclient-nav-back-btn",
		"Back",
		false,
		"m15 18-6-6 6-6",
		() => window.history.back(),
	);

	navMenu.insertBefore(fwdLi, navMenu.firstChild);
	navMenu.insertBefore(backLi, navMenu.firstChild);
}

// --- apply all features ---

// baseline (always applied — not toggles)
applyLayoutFixes();
injectFloatingButtonStyles();
injectStyle(
	"sclient-player-fix",
	`
    .playControls__soundBadge { width: 40vw !important; min-width: 350px !important; max-width: 550px !important; flex: none !important; }
    .playbackSoundBadge__titleContextContainer { max-width: none !important; flex: 1 !important; overflow: hidden !important; }
    .playbackSoundBadge__actions { flex-shrink: 0 !important; }
  `,
);

// features (toggle-gated)
function applyFeatureStyles() {
	if (lazyScrollEnabled) setupLazyScroll();

	if (customAccentEnabled) applyCustomAccentColor(accentColor);

	if (wideLayoutEnabled) applyWideLayout();

	if (collapsibleSidebarEnabled) applyCollapsibleSidebar();

	applyLayoutFixes();
	injectFloatingButtonStyles();

	if (oledDarkModeEnabled) {
		injectStyle(
			"sclient-oled-dark-mode",
			`
      .theme-dark {
        --background-surface-color: #000000 !important;
        --button-secondary-background-color: #000000 !important;
        --button-secondary-selected-background-color: #000000 !important;
        --highlight-color: #000000 !important;
        --surface-color: #000000 !important;
      }
      .theme-dark div.MuiBox-root.mui-1i9nq8r { background-color: #000000 !important; }
      .theme-dark, .theme-dark *, .theme-dark body, .theme-dark html {
        --mui-palette-background-default: #000000 !important;
      }
    `,
		);

		// inject into iframes
		setInterval(() => {
			document.querySelectorAll("iframe").forEach((iframe) => {
				try {
					if (iframe.contentDocument && iframe.contentDocument.head) {
						if (
							!iframe.contentDocument.getElementById("sclient-oled-dark-mode")
						) {
							iframe.contentDocument.head.appendChild(
								document
									.getElementById("sclient-oled-dark-mode")
									.cloneNode(true),
							);
						}
						let forceStyle = iframe.contentDocument.getElementById(
							"sclient-oled-iframe-force",
						);
						if (!forceStyle) {
							forceStyle = document.createElement("style");
							forceStyle.id = "sclient-oled-iframe-force";
							forceStyle.textContent = `
                :root, html, body {
                  --mui-palette-background-default: #000000 !important;
                  --background-surface-color: #000000 !important;
                  --button-secondary-background-color: #000000 !important;
                  --button-secondary-selected-background-color: #000000 !important;
                  --highlight-color: #000000 !important;
                  --surface-color: #000000 !important;
                }
              `;
							iframe.contentDocument.head.appendChild(forceStyle);
						}
						const isDark =
							document.body && document.body.classList.contains("theme-dark");
						forceStyle.disabled = !isDark;
					}
				} catch (e) {
					/* cross-origin iframe */
				}
			});
		}, 1000);
	}

	if (adblockEnabled) applyAdblock();

	if (hideUpsellEnabled) {
		injectStyle(
			"sclient-hide-upsell",
			".header__upsellWrapper { display: none !important; }",
		);
	}

	if (hideArtistsEnabled) {
		injectStyle(
			"sclient-hide-artists",
			".header__forArtistsButton, .sidebarModule:has(.sidebarModule__webiEmbeddedModule) { display: none !important; }",
		);
	}

	// player fix

	if (enhancedHeaderEnabled) {
		injectStyle(
			"sclient-header-reorder",
			`
      .header__right { display: flex !important; align-items: center !important; }
      .header__userNav { display: contents !important; }
      .header__upsellWrapper { order: 1 !important; }
      .header__forArtistsButton { order: 2 !important; margin-right: 0 !important; }
      .header__soundInput { order: 3 !important; }
      .uploadButton { margin-right: 0 !important; }
      .header__userNavActivitiesButton { order: 4 !important; }
      .header__userNavMessagesButton { order: 5 !important; }
      .header__right > ul:has(#sclient-settings-btn) { order: 6 !important; margin-right: 0 !important; }
      .header__userNavUsernameButton { order: 7 !important; margin-left: 8px !important; margin-right: 8px !important; display: flex !important; align-items: center !important; }
      .header__right > ul:has(.header__moreButton:not(#sclient-settings-btn)) { order: 8 !important; }
      .headerSearch__input { border-radius: 50px !important; }
      .header__search .headerSearch { margin: 0 8px !important; }
    `,
		);
	}

	if (currentCss) {
		injectStyle("sclient-custom-css", currentCss);
	}

	try {
		if (currentJs) {
			const runJs = () => {
				const script = document.createElement("script");
				script.textContent = currentJs;
				document.body.appendChild(script);
			};
			if (document.readyState === "loading") {
				document.addEventListener("DOMContentLoaded", runJs);
			} else {
				runJs();
			}
		}
	} catch (e) {
		console.error("[SClient] Error executing custom JS:", e);
	}
}

// --- mutation observer (debounced to avoid hammering DOM on every mutation) ---

let _obsTimer = null;
const _obsRun = () => {
	injectSClientMenuButton();
	injectDownloadButton();
	injectLyricsButton();
	if (enhancedHeaderEnabled) {
		replaceNavTabsWithIcons();
		injectNavigationButtons();
	}
	if (collapsibleSidebarEnabled) {
		injectSidebarToggle();
	}
};

const settingsObserver = new MutationObserver(() => {
	clearTimeout(_obsTimer);
	_obsTimer = setTimeout(_obsRun, 100);
});

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", () => {
		settingsObserver.observe(document.body, { childList: true, subtree: true });
	});
} else {
	settingsObserver.observe(document.body, { childList: true, subtree: true });
}

// apply styles immediately (features that don't need observer)
applyFeatureStyles();
