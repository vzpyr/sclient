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
    `,
    );
  }

  safeReplaceSvg(container, svgHtml) {
    if (!container || container.querySelector(".sclient-svg-container")) return;
    container.classList.add("sclient-svg-host");
    const icon = document.createElement("div");
    icon.className = "sclient-svg-container";
    icon.innerHTML = svgHtml;
    container.appendChild(icon);
  }

  replaceNavIcons() {
    const navIcons = {
      home: lucideIcon("home"),
      stream: lucideIcon("rss"),
      library: lucideIcon("library"),
    };

    for (const [name, svg] of Object.entries(navIcons)) {
      const tab = document.querySelector(`a[data-menu-name="${name}"]`);
      if (tab) this.safeReplaceSvg(tab, svg);
    }

    const notif = document.querySelector(
      ".header__userNavActivitiesButton .notificationIcon > div:first-child",
    );
    if (notif) {
      this.safeReplaceSvg(notif, lucideIcon("bell"));
      notif.title = "Notifications";
    }

    const msg = document.querySelector(
      ".header__userNavMessagesButton .notificationIcon > div:first-child",
    );
    if (msg) {
      this.safeReplaceSvg(msg, lucideIcon("mail"));
      msg.title = "Messages";
    }

    const chevron = document.querySelector(
      ".header__userNavUsernameButtonIcon > div:first-child",
    );
    if (chevron) this.safeReplaceSvg(chevron, lucideIcon("chevron-down", 16));

    const more = document.querySelector(
      "a.header__moreButton:not(#sclient-settings-btn) .header__moreButtonIcon > div:first-child",
    );
    if (more) this.safeReplaceSvg(more, lucideIcon("ellipsis"));

    const upload = document.querySelector(".uploadButton__title");
    if (upload) {
      this.safeReplaceSvg(upload, lucideIcon("upload"));
      const upBtn = document.querySelector(".uploadButton");
      if (upBtn) upBtn.title = "Upload";
    }

    const artist = document.querySelector(".header__forArtistsButton");
    if (artist) {
      this.safeReplaceSvg(artist, lucideIcon("keyboard-music"));
      artist.title = "Artist Studio";
    }

    const searchBtn = document.querySelector(
      ".headerSearch__submit > div:first-child",
    );
    if (searchBtn) {
      this.safeReplaceSvg(searchBtn, lucideIcon("search", 18));
    }
  }

  injectNavButtons() {
    if (document.getElementById("sclient-nav-back-btn")) return;

    const nav = document.querySelector(".header__navMenu");
    if (!nav || !nav.firstChild) return;

    const makeBtn = (id, title, mr, icon, handler) => {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.id = id;
      a.className = "header__navMenuItem sclient-svg-host";
      if (id === "sclient-nav-back-btn") a.classList.add("sc-mr-1x");
      a.title = title;
      a.innerHTML = `<div class="sclient-svg-container">${icon}</div>`;
      a.addEventListener("click", (e) => {
        e.preventDefault();
        handler();
      });
      li.appendChild(a);
      return li;
    };

    nav.insertBefore(
      makeBtn("sclient-nav-fwd-btn", "Forward", true, "m9 18 6-6-6-6", () =>
        window.history.forward(),
      ),
      nav.firstChild,
    );
    nav.insertBefore(
      makeBtn("sclient-nav-back-btn", "Back", false, "m15 18-6-6 6-6", () =>
        window.history.back(),
      ),
      nav.firstChild,
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
