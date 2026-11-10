class AdblockFeature extends Feature {
  get featureKey() {
    return "features.adblock";
  }
  get settingsCategory() {
    return "playback";
  }
  get settingsLabel() {
    return "Ad Blocking";
  }

  init() {
    if (this.enabled) return;
    super.init();
    this.applyAdblock();
  }

  applyAdblock() {}
}

const ADBLOCK_FEATURE = new AdblockFeature();
FEATURES.push(ADBLOCK_FEATURE);
