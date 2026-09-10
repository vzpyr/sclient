class ArtworkViewerFeature extends Feature {
  get featureKey() {
    return null;
  }
  get settingsCategory() {
    return null;
  }
  get settingsLabel() {
    return null;
  }
  get hasToggle() {
    return false;
  }

  constructor() {
    super();
    this.onAvatarClick = this.onAvatarClick.bind(this);
  }

  init() {
    if (this.enabled) return;
    super.init();
    this.on(document, "click", this.onAvatarClick, true);
  }

  onAvatarClick(e) {
    const avatarLink = e.target.closest(".playbackSoundBadge__avatar");
    if (!avatarLink) return;
    e.preventDefault();
    e.stopPropagation();

    const span = avatarLink.querySelector("span.sc-artwork");
    if (!span) return;

    const bg = span.style.backgroundImage;
    if (!bg) return;

    let imgUrl = bg.replace(/^url\(['"]?/, "").replace(/['"]?\)$/, "");

    imgUrl = imgUrl.replace(
      /-(t50x50|badge|large|t120x120)\.(jpg|png)/i,
      "-t500x500.$2",
    );

    viewImage(imgUrl);
  }
}

const ARTWORK_VIEWER_FEATURE = new ArtworkViewerFeature();
FEATURES.push(ARTWORK_VIEWER_FEATURE);
