class EnhancedHeaderFeature extends Feature {
  get featureKey() {
    return "features.enhanced_header";
  }
  get settingsCategory() {
    return "appearance";
  }
  get settingsLabel() {
    return "Enhanced Header";
  }

  init() {
    if (this.enabled) return;
    super.init();
    this.addStyle(
      "sclient-header-reorder",
      `
      .header__right { display: flex !important; }
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
      .headerSearch__input { border-radius: 50px !important; background: var(--sclient-bg-surface) !important; border: 1px solid var(--sclient-border) !important; }
      .headerSearch { margin: 0 8px !important; }
    `
    );
  }

  safeReplaceSvg(container, svgHtml) {
    if (!container || container.querySelector(".sclient-svg-container")) return;
    container.querySelectorAll("svg").forEach((s) => {
      s.style.display = "none";
    });
    container.style.cssText =
      "font-size: 0; line-height: 0; display: flex; align-items: center; justify-content: center;";
    const icon = document.createElement("div");
    icon.className = "sclient-svg-container";
    icon.style.cssText = "display: flex; align-items: center; justify-content: center;";
    icon.innerHTML = svgHtml;
    container.appendChild(icon);
  }

  replaceNavIcons() {
    const navIcons = {
      home: '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
      stream:
        '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1"/></svg>',
      library:
        '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 6 4 14"/><path d="M12 6v14"/><path d="M8 8v12"/><path d="M4 4v16"/></svg>',
    };

    for (const [name, svg] of Object.entries(navIcons)) {
      const tab = document.querySelector(`a[data-menu-name="${name}"]`);
      if (tab) this.safeReplaceSvg(tab, svg);
    }

    const notif = document.querySelector(
      ".header__userNavActivitiesButton .notificationIcon > div:first-child"
    );
    if (notif) {
      this.safeReplaceSvg(
        notif,
        '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>'
      );
      notif.title = "Notifications";
    }

    const msg = document.querySelector(
      ".header__userNavMessagesButton .notificationIcon > div:first-child"
    );
    if (msg) {
      this.safeReplaceSvg(
        msg,
        '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>'
      );
      msg.title = "Messages";
    }

    const chevron = document.querySelector(".header__userNavUsernameButtonIcon > div:first-child");
    if (chevron)
      this.safeReplaceSvg(
        chevron,
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>'
      );

    const more = document.querySelector(
      "a.header__moreButton:not(#sclient-settings-btn) .header__moreButtonIcon > div:first-child"
    );
    if (more)
      this.safeReplaceSvg(
        more,
        '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>'
      );

    const upload = document.querySelector(".uploadButton__title");
    if (upload) {
      this.safeReplaceSvg(
        upload,
        '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m17 8-5-5-5 5"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/></svg>'
      );
      const upBtn = document.querySelector(".uploadButton");
      if (upBtn) upBtn.title = "Upload";
    }

    const artist = document.querySelector(".header__forArtistsButton");
    if (artist) {
      this.safeReplaceSvg(
        artist,
        '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="M6 8h4"/><path d="M14 8h.01"/><path d="M18 8h.01"/><path d="M2 12h20"/><path d="M6 12v4"/><path d="M10 12v4"/><path d="M14 12v4"/><path d="M18 12v4"/></svg>'
      );
      artist.title = "Artist Studio";
    }

    const searchBtn = document.querySelector(".headerSearch__submit > div:first-child");
    if (searchBtn) {
      this.safeReplaceSvg(
        searchBtn,
        '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-search-icon lucide-search"><path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/></svg>'
      );
    }
  }

  injectNavButtons() {
    if (document.getElementById("sclient-nav-back-btn")) return;

    const nav = document.querySelector(".header__navMenu");
    if (!nav || !nav.firstChild) return;

    const makeBtn = (id, title, mr, path, handler) => {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.id = id;
      a.className = "header__navMenuItem";
      if (id === "sclient-nav-back-btn") a.classList.add("sc-mr-1x");
      a.title = title;
      a.style.cssText = `font-size: 0px; line-height: 0; display: flex; align-items: center; justify-content: center; cursor: pointer; height: 46px; width: 30px; padding: 0; ${mr ? "margin-right: 10px;" : ""}`;
      a.innerHTML = `<div class="sclient-svg-container" style="display: flex; align-items: center; justify-content: center; height: 100%; width: 100%;"><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"/></svg></div>`;
      a.addEventListener("click", (e) => {
        e.preventDefault();
        handler();
      });
      li.appendChild(a);
      return li;
    };

    nav.insertBefore(
      makeBtn("sclient-nav-fwd-btn", "Forward", true, "m9 18 6-6-6-6", () =>
        window.history.forward()
      ),
      nav.firstChild
    );
    nav.insertBefore(
      makeBtn("sclient-nav-back-btn", "Back", false, "m15 18-6-6 6-6", () => window.history.back()),
      nav.firstChild
    );
  }

  injectUI() {
    this.replaceNavIcons();
    if (SCLIENT_CONFIG.titlebarStyle !== "custom") {
      this.injectNavButtons();
    }
  }
}

const ENHANCED_HEADER_FEATURE = new EnhancedHeaderFeature();
FEATURES.push(ENHANCED_HEADER_FEATURE);
