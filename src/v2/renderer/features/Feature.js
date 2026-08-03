class Feature {
  get featureKey() {
    return null;
  }
  get settingsCategory() {
    return null;
  }
  get settingsLabel() {
    return null;
  }
  get settingsDescription() {
    return "";
  }
  get hasToggle() {
    return true;
  }
  get settingsFields() {
    return [];
  }
  settingsCustom() {
    return "";
  }
  settingsInit(overlay) {}

  constructor() {
    this.enabled = false;
    this.injected = false;
    this.cleanup = [];
  }

  isEnabled() {
    return this.featureKey == null ? true : !!SCLIENT_CONFIG.get(this.featureKey, false);
  }

  init() {
    if (this.enabled) return;
    this.enabled = true;
  }

  destroy() {
    this.enabled = false;
    this.injected = false;
    this.cleanup.forEach((fn) => {
      try {
        fn();
      } catch (e) {}
    });
    this.cleanup = [];
  }

  injectUI() {}

  on(target, event, handler, opts) {
    target.addEventListener(event, handler, opts);
    this.cleanup.push(() => target.removeEventListener(event, handler, opts));
  }

  addStyle(id, css) {
    injectStyle(id, css);
    this.cleanup.push(() => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });
  }
}
