class CollapsibleSidebarFeature extends Feature {
  get featureKey() {
    return "features.collapsible_sidebar";
  }
  get settingsCategory() {
    return "appearance";
  }
  get settingsLabel() {
    return "Collapsible Sidebar";
  }

  init() {
    if (this.enabled) return;
    super.init();
    const bgStyle = "var(--surface-color, var(--sclient-bg-surface))";
    this.addStyle(
      "sclient-collapsible-sidebar",
      `
      .l-fluid-fixed .l-main { margin-right: 0 !important; }
      .l-sidebar-right {
        position: fixed !important; top: 46px !important; bottom: 46px !important;
        right: -360px !important; width: 360px !important;
        background-color: ${bgStyle} !important;
        z-index: 100 !important; transition: right 0.3s ease !important;
        box-sizing: border-box !important; box-shadow: -5px 0 25px rgba(0,0,0,0.5) !important;
        overflow-y: auto !important; overflow-x: hidden !important;
        padding-top: 20px !important;
      }
      body.sclient-sidebar-open .l-sidebar-right { right: 0 !important; }
      #sclient-sidebar-toggle { display: none !important; top: 60px; right: 15px; }
      body:has(.l-sidebar-right) #sclient-sidebar-toggle { display: flex !important; }
    `,
    );
  }

  injectUI() {
    if (document.getElementById("sclient-sidebar-toggle")) return;
    if (!document.body) return;

    const btn = document.createElement("button");
    btn.id = "sclient-sidebar-toggle";
    btn.className = "sclient-floating-btn";
    btn.title = "Toggle Sidebar";

    const openIcon =
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-panel-right-open-icon lucide-panel-right-open"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 3v18"/><path d="m10 15-3-3 3-3"/></svg>';
    const closeIcon =
      '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-panel-right-close-icon lucide-panel-right-close"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 3v18"/><path d="m8 9 3 3-3 3"/></svg>';

    btn.innerHTML = closeIcon;

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      document.body.classList.toggle("sclient-sidebar-open");
      const open = document.body.classList.contains("sclient-sidebar-open");
      btn.classList.toggle("active", open);
      btn.innerHTML = open ? openIcon : closeIcon;
    });

    document.body.appendChild(btn);
  }
}

const COLLAPSIBLE_SIDEBAR_FEATURE = new CollapsibleSidebarFeature();
FEATURES.push(COLLAPSIBLE_SIDEBAR_FEATURE);
