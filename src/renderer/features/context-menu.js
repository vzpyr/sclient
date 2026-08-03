class ContextMenuFeature extends Feature {
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

  init() {
    if (this.enabled) return;
    super.init();
    this.on(document, "contextmenu", (e) => this.handleContextMenu(document, e));
    this.injectIntoIframes();
  }

  injectIntoIframes() {
    const inject = (ifr) => {
      try {
        const doc = ifr.contentDocument;
        if (!doc) return;
        if (!doc.__sclient_cm) {
          doc.__sclient_cm = true;
          doc.addEventListener("contextmenu", (e) => this.handleContextMenu(doc, e));
          if (!ifr.__sclient_cm_hooked) {
            ifr.__sclient_cm_hooked = true;
            ifr.addEventListener("load", () => inject(ifr));
          }
        }
      } catch (ex) {}
    };

    document.querySelectorAll("iframe").forEach(inject);

    const obs = new MutationObserver((mutations) => {
      for (let i = 0; i < mutations.length; i++) {
        for (let j = 0; j < mutations[i].addedNodes.length; j++) {
          const node = mutations[i].addedNodes[j];
          if (node.tagName === "IFRAME") {
            node.addEventListener("load", () => inject(node));
            inject(node);
          } else if (node.querySelectorAll) {
            node.querySelectorAll("iframe").forEach((ifr) => {
              ifr.addEventListener("load", () => inject(ifr));
              inject(ifr);
            });
          }
        }
      }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
    this.iframeObserver = obs;
    this.cleanup.push(() => obs.disconnect());
  }

  handleContextMenu(doc, e) {
    let menuEl = null;

    const close = () => {
      if (menuEl) {
        menuEl.remove();
        menuEl = null;
      }
    };

    const buildItem = (label, action) => {
      const el = doc.createElement("div");
      el.className = "sclient-cm-item";
      el.textContent = label;
      el.addEventListener("click", () => {
        close();
        action();
      });
      return el;
    };

    const buildSep = () => {
      const el = doc.createElement("div");
      el.className = "sclient-cm-sep";
      return el;
    };

    if (e.target.closest("#sclient-playlists-overlay")) return;
    e.preventDefault();
    close();

    let editableEl = null;
    try {
      editableEl = findEditable(doc, e.target);
    } catch (err) {
      editableEl = null;
    }
    const isEditable = !!editableEl;

    const linkEl = findLink(doc, e.target);

    let imageEl = null;
    try {
      imageEl = findImageEl(doc, e.target);
    } catch (err) {
      imageEl = null;
    }
    if (e.target.closest(".sclient-modal-backdrop")) {
      imageEl = null;
    }

    const win = doc.defaultView || doc.parentWindow;
    const sel = win.getSelection().toString().trim();
    const hasSel = sel.length > 0;

    let accent = "#f50";
    try {
      accent = typeof getAccent === "function" ? getAccent() : accent;
    } catch (ex) {}
    if (typeof getAccent !== "function") {
      const ca = getComputedStyle(document.documentElement)
        .getPropertyValue("--sclient-accent")
        .trim();
      if (ca) accent = ca;
    }

    const menu = doc.createElement("div");
    menu.className = "sclient-cm";

    const style = doc.createElement("style");
    style.textContent = [
      ".sclient-cm {",
      "  position:fixed; z-index:9999999; min-width:200px;",
      "  background:var(--sclient-bg-elevated);",
      "  border:1px solid var(--sclient-border);",
      "  border-radius:var(--sclient-radius-lg);",
      "  padding:6px;",
      "  box-shadow:0 10px 30px rgba(0,0,0,0.5);",
      "  font-family:var(--sclient-font-sans);",
      "  font-size:var(--sclient-text-base);",
      "  color:var(--sclient-text-main);",
      "  -webkit-user-select:none; user-select:none;",
      "}",
      ".sclient-cm-item {",
      "  padding:8px 12px; border-radius:5px; cursor:pointer;",
      "  display:flex; justify-content:space-between; align-items:center; gap:14px;",
      "}",
      ".sclient-cm-item:hover { background:" + accent + "; color:#fff; }",
      ".sclient-cm-sep { height:1px; background:var(--sclient-border); margin:4px 0; }",
    ].join("\n");
    menu.appendChild(style);

    const items = [];

    let imgUrl = null;

    if (linkEl) {
      items.push(
        buildItem("Copy link address", () => {
          writeClipboard(linkEl.href);
        })
      );
    }

    if (imageEl) {
      imgUrl = imageUrlFrom(imageEl);
      if (imgUrl) {
        items.push(
          buildItem("View image", () => {
            viewImage(doc, imgUrl);
          })
        );
      }
    }

    if (linkEl || (imageEl && imgUrl)) {
      items.push(buildSep());
    }

    if (isEditable && hasSel) {
      items.push(
        buildItem("Cut", () => {
          execEdit(doc, "cut");
        })
      );
    }

    if (hasSel) {
      items.push(
        buildItem("Copy", () => {
          execEdit(doc, "copy");
        })
      );
    }

    if (isEditable) {
      items.push(
        buildItem("Paste", () => {
          if (typeof sendBridge === "function") {
            sendBridge("webcontents_paste").catch(function () {});
            return;
          }
          doc.execCommand("paste");
        })
      );
    }

    items.push(
      buildItem("Select All", () => {
        if (editableEl && (editableEl.tagName === "INPUT" || editableEl.tagName === "TEXTAREA")) {
          editableEl.focus();
          editableEl.select();
        } else {
          execEdit(doc, "selectAll");
        }
      })
    );

    items.push(buildSep());

    items.push(
      buildItem("Copy URL", () => {
        writeClipboard(win.location.href);
      })
    );

    items.push(
      buildItem("Navigate to URL", () => {
        navigateToUrlModal(doc);
      })
    );

    items.push(
      buildItem("Reload", () => {
        win.location.reload();
      })
    );

    for (let i = items.length - 1; i >= 0; i--) {
      if (items[i].className === "sclient-cm-sep") {
        let hasBefore = false;
        for (let b = i - 1; b >= 0; b--) {
          if (items[b].className !== "sclient-cm-sep") {
            hasBefore = true;
            break;
          }
        }
        let hasAfter = false;
        for (let a = i + 1; a < items.length; a++) {
          if (items[a].className !== "sclient-cm-sep") {
            hasAfter = true;
            break;
          }
        }
        if (!hasBefore || !hasAfter) items.splice(i, 1);
      }
    }

    for (let j = 0; j < items.length; j++) {
      menu.appendChild(items[j]);
    }

    menu.addEventListener(
      "mousedown",
      (ev) => {
        ev.preventDefault();
      },
      true
    );

    menu.style.left = Math.min(e.clientX, win.innerWidth - 210) + "px";
    menu.style.top = Math.min(e.clientY, win.innerHeight - menu.offsetHeight - 5) + "px";
    doc.body.appendChild(menu);
    menuEl = menu;

    requestAnimationFrame(() => {
      menu.style.top = Math.min(e.clientY, win.innerHeight - menu.offsetHeight - 5) + "px";
    });

    const dismiss = (ev) => {
      if (menuEl && menuEl.contains(ev.target)) return;
      close();
      doc.removeEventListener("mousedown", dismiss, true);
      doc.removeEventListener("keydown", onKey, true);
    };

    const onKey = (ev) => {
      if (ev.key === "Escape") {
        close();
      }
    };

    setTimeout(() => {
      doc.addEventListener("mousedown", dismiss, true);
      doc.addEventListener("keydown", onKey, true);
    }, 0);
  }
}

function findEditable(doc, target) {
  let el = target;
  while (el && el !== doc.body) {
    if (el.tagName === "INPUT") {
      const t = (el.type || "").toLowerCase();
      if (
        [
          "checkbox",
          "radio",
          "button",
          "submit",
          "reset",
          "image",
          "file",
          "range",
          "color",
          "hidden",
        ].indexOf(t) === -1
      )
        return el;
    }
    if (el.tagName === "TEXTAREA") return el;
    if (el.isContentEditable) return el;
    el = el.parentElement;
  }
  return null;
}

function findLink(doc, target) {
  let el = target;
  while (el && el !== doc.body) {
    if (el.tagName === "A" && el.href) return el;
    el = el.parentElement;
  }
  return null;
}

function findImageEl(doc, target) {
  let el = target;
  while (el && el !== doc.body) {
    if (el.tagName === "IMG" && el.currentSrc) return el;
    const bg = el.style && el.style.backgroundImage;
    if (bg && bg !== "none" && bg.indexOf("url(") !== -1) return el;
    if (el.classList && el.classList.contains("sc-artwork")) {
      const cbg = getComputedStyle(el).backgroundImage;
      if (cbg && cbg !== "none" && cbg.indexOf("url(") !== -1) return el;
    }
    el = el.parentElement;
  }
  return null;
}

function imageUrlFrom(el) {
  if (el.tagName === "IMG") return el.currentSrc || el.src;
  const bg = (el.style && el.style.backgroundImage) || getComputedStyle(el).backgroundImage;
  if (!bg || bg === "none") return null;
  let url = bg.replace(/^url\(['"]?/, "").replace(/['"]?\)$/, "");
  url = url.replace(
    /-(t50x50|badge|large|t120x120|small|t67x67|t300x300|crop|t200x200|original)\.(jpg|png|jpeg|webp)/i,
    "-t500x500.$2"
  );
  return url;
}

function navigateToUrlModal(doc) {
  const overlay = doc.createElement("div");
  overlay.className = "sclient-modal-backdrop";

  const modal = doc.createElement("div");
  modal.className = "sclient-modal-surface";
  modal.style.cssText = "text-align:center;max-width:440px;";

  const title = doc.createElement("div");
  title.textContent = "Navigate to URL";
  title.className = "sclient-text-body";
  title.style.cssText = "font-weight:600;margin-bottom:16px;font-size:var(--sclient-text-lg);";
  modal.appendChild(title);

  const input = doc.createElement("input");
  input.type = "text";
  input.placeholder = "Enter URL...";
  input.style.cssText =
    "width:100%;padding:10px 14px;border:1px solid var(--sclient-border);border-radius:var(--sclient-radius-lg);background:var(--sclient-bg-surface);color:var(--sclient-text-main);font-size:var(--sclient-text-base);font-family:var(--sclient-font-sans);outline:none;box-sizing:border-box;margin-bottom:16px;";
  input.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") go();
  });
  modal.appendChild(input);

  const btnRow = doc.createElement("div");
  btnRow.style.cssText = "display:flex;gap:10px;justify-content:center;";

  const cancelBtn = doc.createElement("button");
  cancelBtn.textContent = "Cancel";
  cancelBtn.className = "sclient-btn";
  cancelBtn.onclick = close;
  btnRow.appendChild(cancelBtn);

  const goBtn = doc.createElement("button");
  goBtn.textContent = "Go";
  goBtn.className = "sclient-btn sclient-btn-primary";
  btnRow.appendChild(goBtn);

  modal.appendChild(btnRow);
  overlay.appendChild(modal);
  doc.body.appendChild(overlay);

  function go() {
    let url = input.value.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    close();
    const win = doc.defaultView || doc.parentWindow;
    win.location.href = url;
  }

  function close() {
    overlay.style.opacity = "0";
    modal.style.transform = "scale(0.95)";
    setTimeout(() => {
      overlay.remove();
    }, 200);
  }

  goBtn.onclick = go;

  overlay.addEventListener("click", (ev) => {
    if (ev.target === overlay) close();
  });

  requestAnimationFrame(() => {
    overlay.style.opacity = "1";
    modal.style.transform = "scale(1)";
    input.focus();
  });
}

function viewImage(doc, url) {
  const overlay = doc.createElement("div");
  overlay.className = "sclient-modal-backdrop";
  const img = doc.createElement("img");
  img.src = url;
  img.style.cssText =
    "max-width:90vw;max-height:90vh;border-radius:var(--sclient-radius-lg);box-shadow:0 10px 40px rgba(0,0,0,0.5);object-fit:contain;transform:scale(0.95);transition:transform 0.2s ease;";
  overlay.appendChild(img);

  const btnContainer = doc.createElement("div");
  btnContainer.style.cssText =
    "position: absolute; bottom: 20px; right: 20px; display: flex; gap: 10px;";

  const copyBtn = doc.createElement("button");
  copyBtn.className = "sclient-floating-btn";
  copyBtn.style.cssText = "position: static !important; backdrop-filter: blur(4px);";
  copyBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-copy-icon lucide-copy"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
  copyBtn.onclick = (ev) => {
    ev.stopPropagation();
    fetch(url)
      .then((r) => {
        return r.blob();
      })
      .then((blob) => {
        const canvas = doc.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const imgObj = new Image();
        imgObj.onload = () => {
          canvas.width = imgObj.width;
          canvas.height = imgObj.height;
          ctx.drawImage(imgObj, 0, 0);
          canvas.toBlob((pngBlob) => {
            const item = {};
            item[pngBlob.type] = pngBlob;
            navigator.clipboard
              .write([new ClipboardItem(item)])
              .then(() => {
                showToast("Image copied to clipboard.");
              })
              .catch((e) => {
                showToast("Copy failed: " + e.message);
              });
          }, "image/png");
        };
        imgObj.src = URL.createObjectURL(blob);
      })
      .catch((e) => {
        showToast("Fetch failed: " + e.message);
      });
  };

  const saveBtn = doc.createElement("button");
  saveBtn.className = "sclient-floating-btn";
  saveBtn.style.cssText = "position: static !important; backdrop-filter: blur(4px);";
  saveBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-download-icon lucide-download"><path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/></svg>`;
  saveBtn.onclick = (ev) => {
    ev.stopPropagation();
    fetch(url)
      .then((r) => {
        return r.blob();
      })
      .then((blob) => {
        const objUrl = URL.createObjectURL(blob);
        const a = doc.createElement("a");
        a.href = objUrl;
        a.download = url.split("/").pop().split("?")[0] || "soundcloud_image.jpg";
        doc.body.appendChild(a);
        a.click();
        doc.body.removeChild(a);
        setTimeout(() => {
          URL.revokeObjectURL(objUrl);
        }, 1000);
      })
      .catch((e) => {
        showToast("Download failed: " + e.message);
      });
  };

  btnContainer.appendChild(copyBtn);
  btnContainer.appendChild(saveBtn);
  overlay.appendChild(btnContainer);

  doc.body.appendChild(overlay);
  requestAnimationFrame(() => {
    overlay.style.opacity = "1";
    img.style.transform = "scale(1)";
  });
  overlay.addEventListener("click", () => {
    overlay.style.opacity = "0";
    img.style.transform = "scale(0.95)";
    setTimeout(() => {
      overlay.remove();
    }, 200);
  });
}

function writeClipboard(text) {
  if (typeof sendBridge === "function") {
    sendBridge("clipboard_writeText", { text: text }).catch(function () {});
    return;
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.cssText = "position:fixed;left:-9999px;top:-9999px";
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  ta.remove();
}

function execEdit(doc, cmd) {
  if (typeof sendBridge === "function") {
    const map = {
      copy: "webcontents_copy",
      cut: "webcontents_cut",
      paste: "webcontents_paste",
      selectAll: "webcontents_selectAll",
    };
    sendBridge(map[cmd]).catch(function () {});
    return;
  }
  doc.execCommand(cmd);
}

const CONTEXT_MENU_FEATURE = new ContextMenuFeature();
FEATURES.push(CONTEXT_MENU_FEATURE);
