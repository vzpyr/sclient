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

    const overlay = document.createElement("div");
    overlay.className = "sclient-modal-backdrop";

    const img = document.createElement("img");
    img.src = imgUrl;
    img.style.cssText =
      "max-width: 90vw; max-height: 90vh; border-radius: var(--sclient-radius-lg); box-shadow: 0 10px 40px rgba(0,0,0,0.5); object-fit: contain; transform: scale(0.95); transition: transform 0.2s ease;";

    overlay.appendChild(img);

    const btnContainer = document.createElement("div");
    btnContainer.style.cssText =
      "position: absolute; bottom: 20px; right: 20px; display: flex; gap: 10px;";

    const copyBtn = document.createElement("button");
    copyBtn.className = "sclient-floating-btn";
    copyBtn.style.cssText =
      "position: static !important; backdrop-filter: blur(4px);";
    copyBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-copy-icon lucide-copy"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
    copyBtn.onclick = (ev) => {
      ev.stopPropagation();
      fetch(imgUrl)
        .then((r) => r.blob())
        .then((blob) => {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          const image = new Image();
          image.onload = () => {
            canvas.width = image.width;
            canvas.height = image.height;
            ctx.drawImage(image, 0, 0);
            canvas.toBlob((pngBlob) => {
              navigator.clipboard
                .write([new ClipboardItem({ [pngBlob.type]: pngBlob })])
                .then(() => showToast("Image copied to clipboard."))
                .catch((err) => showToast("Copy failed: " + err.message));
            }, "image/png");
          };
          image.src = URL.createObjectURL(blob);
        })
        .catch((err) => showToast("Fetch failed: " + err.message));
    };

    const saveBtn = document.createElement("button");
    saveBtn.className = "sclient-floating-btn";
    saveBtn.style.cssText =
      "position: static !important; backdrop-filter: blur(4px);";
    saveBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-download-icon lucide-download"><path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/></svg>`;
    saveBtn.onclick = (ev) => {
      ev.stopPropagation();
      fetch(imgUrl)
        .then((r) => r.blob())
        .then((blob) => {
          const objUrl = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = objUrl;
          a.download =
            imgUrl.split("/").pop().split("?")[0] || "soundcloud_image.jpg";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(objUrl), 1000);
        })
        .catch((err) => showToast("Download failed: " + err.message));
    };

    btnContainer.appendChild(copyBtn);
    btnContainer.appendChild(saveBtn);
    overlay.appendChild(btnContainer);

    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
      overlay.style.opacity = "1";
      img.style.transform = "scale(1)";
    });

    overlay.addEventListener("click", () => {
      overlay.style.opacity = "0";
      img.style.transform = "scale(0.95)";
      setTimeout(() => overlay.remove(), 200);
    });
  }
}

const ARTWORK_VIEWER_FEATURE = new ArtworkViewerFeature();
FEATURES.push(ARTWORK_VIEWER_FEATURE);
