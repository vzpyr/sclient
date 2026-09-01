class HideUpsellFeature extends Feature {
  get featureKey() {
    return "features.hide_upsell";
  }
  get settingsCategory() {
    return "playback";
  }
  get settingsLabel() {
    return "Hide Upsell";
  }

  init() {
    if (this.enabled) return;
    super.init();
    this.addStyle("sclient-hide-upsell", ".header__upsellWrapper { display: none !important; }");
  }
}

class HideArtistsFeature extends Feature {
  get featureKey() {
    return "features.hide_artists";
  }
  get settingsCategory() {
    return "playback";
  }
  get settingsLabel() {
    return "Hide Artists";
  }

  init() {
    if (this.enabled) return;
    super.init();
    this.addStyle(
      "sclient-hide-artists",
      ".header__forArtistsButton, .sidebarModule:has(.sidebarModule__webiEmbeddedModule) { display: none !important; }"
    );
  }
}

const HIDE_UPSELL_FEATURE = new HideUpsellFeature();
FEATURES.push(HIDE_UPSELL_FEATURE);
const HIDE_ARTISTS_FEATURE = new HideArtistsFeature();
FEATURES.push(HIDE_ARTISTS_FEATURE);
