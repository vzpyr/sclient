class WideLayoutFeature extends Feature {
  get featureKey() {
    return "features.wide_layout";
  }
  get settingsCategory() {
    return "appearance";
  }
  get settingsLabel() {
    return "Wide Layout";
  }
  get settingsFields() {
    return [{ type: "text", key: "features.wide_layout_width", label: "Max Width" }];
  }

  init() {
    if (this.enabled) return;
    super.init();
    const width = SCLIENT_CONFIG.wideLayoutWidth || "1200";
    const maxWidthRule =
      width === "unlimited" ? "max-width: none !important;" : `max-width: ${width}px !important;`;
    this.addStyle(
      "sclient-fluid-viewport",
      `
      .l-container {
        min-width: 720px !important;
        ${maxWidthRule}
        width: 100% !important;
      }
      header .l-container,
      .playControls .l-container {
        max-width: none !important;
        padding: 0 24px !important;
      }
    `
    );
  }
}

const WIDE_LAYOUT_FEATURE = new WideLayoutFeature();
FEATURES.push(WIDE_LAYOUT_FEATURE);
