(function () {
  function findEditable(doc, target) {
    var el = target;
    while (el && el !== doc.body) {
      if (el.tagName === "INPUT") {
        var t = (el.type || "").toLowerCase();
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
    var el = target;
    while (el && el !== doc.body) {
      if (el.tagName === "A" && el.href) return el;
      el = el.parentElement;
    }
    return null;
  }

  function findImageEl(doc, target) {
    var el = target;
    while (el && el !== doc.body) {
      if (el.tagName === "IMG" && el.currentSrc) return el;
      var bg = el.style && el.style.backgroundImage;
      if (bg && bg !== "none" && bg.indexOf("url(") !== -1) return el;
      if (el.classList && el.classList.contains("sc-artwork")) {
        var cbg = getComputedStyle(el).backgroundImage;
        if (cbg && cbg !== "none" && cbg.indexOf("url(") !== -1) return el;
      }
      el = el.parentElement;
    }
    return null;
  }

  function imageUrlFrom(el) {
    if (el.tagName === "IMG") return el.currentSrc || el.src;
    var bg = (el.style && el.style.backgroundImage) || getComputedStyle(el).backgroundImage;
    if (!bg || bg === "none") return null;
    var url = bg.replace(/^url\(['"]?/, "").replace(/['"]?\)$/, "");
    url = url.replace(
      /-(t50x50|badge|large|t120x120|small|t67x67|t300x300|crop|t200x200|original)\.(jpg|png|jpeg|webp)/i,
      "-t500x500.$2"
    );
    return url;
  }

  function navigateToUrlModal(doc) {
    var overlay = doc.createElement("div");
    overlay.className = "sc-modal-backdrop";

    var modal = doc.createElement("div");
    modal.className = "sc-modal-surface";
    modal.style.cssText = "text-align:center;max-width:440px;";

    var title = doc.createElement("div");
    title.textContent = "Navigate to URL";
    title.className = "sc-text-body";
    title.style.cssText = "font-weight:600;margin-bottom:16px;font-size:var(--sc-text-lg);";
    modal.appendChild(title);

    var input = doc.createElement("input");
    input.type = "text";
    input.placeholder = "Enter URL...";
    input.style.cssText =
      "width:100%;padding:10px 14px;border:1px solid var(--sc-border);border-radius:var(--sc-radius-lg);background:var(--sc-bg-surface);color:var(--sc-text-main);font-size:var(--sc-text-base);font-family:var(--sc-font-sans);outline:none;box-sizing:border-box;margin-bottom:16px;";
    input.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") go();
    });
    modal.appendChild(input);

    var btnRow = doc.createElement("div");
    btnRow.style.cssText = "display:flex;gap:10px;justify-content:center;";

    var cancelBtn = doc.createElement("button");
    cancelBtn.textContent = "Cancel";
    cancelBtn.className = "sc-btn";
    cancelBtn.onclick = close;
    btnRow.appendChild(cancelBtn);

    var goBtn = doc.createElement("button");
    goBtn.textContent = "Go";
    goBtn.className = "sc-btn sc-btn-primary";
    btnRow.appendChild(goBtn);

    modal.appendChild(btnRow);
    overlay.appendChild(modal);
    doc.body.appendChild(overlay);

    function go() {
      var url = input.value.trim();
      if (!url) return;
      if (!/^https?:\/\//i.test(url)) url = "https://" + url;
      close();
      var win = doc.defaultView || doc.parentWindow;
      win.location.href = url;
    }

    function close() {
      overlay.style.opacity = "0";
      modal.style.transform = "scale(0.95)";
      setTimeout(function () {
        overlay.remove();
      }, 200);
    }

    goBtn.onclick = go;

    overlay.addEventListener("click", function (ev) {
      if (ev.target === overlay) close();
    });

    requestAnimationFrame(function () {
      overlay.style.opacity = "1";
      modal.style.transform = "scale(1)";
      input.focus();
    });
  }

  function viewImage(doc, url) {
    var overlay = doc.createElement("div");
    overlay.className = "sc-modal-backdrop";
    var img = doc.createElement("img");
    img.src = url;
    img.style.cssText =
      "max-width:90vw;max-height:90vh;border-radius:var(--sc-radius-lg);box-shadow:0 10px 40px rgba(0,0,0,0.5);object-fit:contain;transform:scale(0.95);transition:transform 0.2s ease;";
    overlay.appendChild(img);

    var btnContainer = doc.createElement("div");
    btnContainer.style.cssText =
      "position: absolute; bottom: 20px; right: 20px; display: flex; gap: 10px;";

    var copyBtn = doc.createElement("button");
    copyBtn.className = "sclient-floating-btn";
    copyBtn.style.cssText = "position: static !important; backdrop-filter: blur(4px);";
    copyBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-copy-icon lucide-copy"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`;
    copyBtn.onclick = function (ev) {
      ev.stopPropagation();
      fetch(url)
        .then(function (r) {
          return r.blob();
        })
        .then(function (blob) {
          var canvas = doc.createElement("canvas");
          var ctx = canvas.getContext("2d");
          var imgObj = new Image();
          imgObj.onload = function () {
            canvas.width = imgObj.width;
            canvas.height = imgObj.height;
            ctx.drawImage(imgObj, 0, 0);
            canvas.toBlob(function (pngBlob) {
              var item = {};
              item[pngBlob.type] = pngBlob;
              navigator.clipboard
                .write([new ClipboardItem(item)])
                .then(function () {
                  showToast("Image copied to clipboard.");
                })
                .catch(function (e) {
                  showToast("Copy failed: " + e.message);
                });
            }, "image/png");
          };
          imgObj.src = URL.createObjectURL(blob);
        })
        .catch(function (e) {
          showToast("Fetch failed: " + e.message);
        });
    };

    var saveBtn = doc.createElement("button");
    saveBtn.className = "sclient-floating-btn";
    saveBtn.style.cssText = "position: static !important; backdrop-filter: blur(4px);";
    saveBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-download-icon lucide-download"><path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/></svg>`;
    saveBtn.onclick = function (ev) {
      ev.stopPropagation();
      fetch(url)
        .then(function (r) {
          return r.blob();
        })
        .then(function (blob) {
          var objUrl = URL.createObjectURL(blob);
          var a = doc.createElement("a");
          a.href = objUrl;
          a.download = url.split("/").pop().split("?")[0] || "soundcloud_image.jpg";
          doc.body.appendChild(a);
          a.click();
          doc.body.removeChild(a);
          setTimeout(function () {
            URL.revokeObjectURL(objUrl);
          }, 1000);
        })
        .catch(function (e) {
          showToast("Download failed: " + e.message);
        });
    };

    btnContainer.appendChild(copyBtn);
    btnContainer.appendChild(saveBtn);
    overlay.appendChild(btnContainer);

    doc.body.appendChild(overlay);
    requestAnimationFrame(function () {
      overlay.style.opacity = "1";
      img.style.transform = "scale(1)";
    });
    overlay.addEventListener("click", function () {
      overlay.style.opacity = "0";
      img.style.transform = "scale(0.95)";
      setTimeout(function () {
        overlay.remove();
      }, 200);
    });
  }

  function writeClipboard(text) {
    if (typeof sendBridge === "function") {
      sendBridge("clipboard_writeText", { text: text }).catch(function () {});
      return;
    }
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;left:-9999px;top:-9999px";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }

  function execEdit(doc, cmd) {
    if (typeof sendBridge === "function") {
      var map = {
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

  function handleContextMenu(doc, e) {
    var menuEl = null;

    function close() {
      if (menuEl) {
        menuEl.remove();
        menuEl = null;
      }
    }

    function buildItem(label, action) {
      var el = doc.createElement("div");
      el.className = "sclient-cm-item";
      el.textContent = label;
      el.addEventListener("click", function () {
        close();
        action();
      });
      return el;
    }

    function buildSep() {
      var el = doc.createElement("div");
      el.className = "sclient-cm-sep";
      return el;
    }

    if (e.target.closest("#sclient-playlists-overlay")) return;
    e.preventDefault();
    close();

    var editableEl = null;
    try {
      editableEl = findEditable(doc, e.target);
    } catch (err) {
      editableEl = null;
    }
    var isEditable = !!editableEl;

    var linkEl = findLink(doc, e.target);

    var imageEl = null;
    try {
      imageEl = findImageEl(doc, e.target);
    } catch (err) {
      imageEl = null;
    }
    if (e.target.closest(".sc-modal-backdrop")) {
      imageEl = null;
    }

    var win = doc.defaultView || doc.parentWindow;
    var sel = win.getSelection().toString().trim();
    var hasSel = sel.length > 0;

    var accent = "#f50";
    try {
      accent = typeof getAccent === "function" ? getAccent() : accent;
    } catch (ex) {}
    if (typeof getAccent !== "function") {
      var ca = getComputedStyle(document.documentElement).getPropertyValue("--sc-accent").trim();
      if (ca) accent = ca;
    }

    var menu = doc.createElement("div");
    menu.className = "sclient-cm";

    var style = doc.createElement("style");
    style.textContent = [
      ".sclient-cm {",
      "  position:fixed; z-index:9999999; min-width:200px;",
      "  background:var(--sc-bg-elevated);",
      "  border:1px solid var(--sc-border);",
      "  border-radius:var(--sc-radius-lg);",
      "  padding:6px;",
      "  box-shadow:0 10px 30px rgba(0,0,0,0.5);",
      "  font-family:var(--sc-font-sans);",
      "  font-size:var(--sc-text-base);",
      "  color:var(--sc-text-main);",
      "  -webkit-user-select:none; user-select:none;",
      "}",
      ".sclient-cm-item {",
      "  padding:8px 12px; border-radius:5px; cursor:pointer;",
      "  display:flex; justify-content:space-between; align-items:center; gap:14px;",
      "}",
      ".sclient-cm-item:hover { background:" + accent + "; color:#fff; }",
      ".sclient-cm-sep { height:1px; background:var(--sc-border); margin:4px 0; }",
    ].join("\n");
    menu.appendChild(style);

    var items = [];

    if (linkEl) {
      items.push(
        buildItem("Copy link address", function () {
          writeClipboard(linkEl.href);
        })
      );
    }

    if (imageEl) {
      var imgUrl = imageUrlFrom(imageEl);
      if (imgUrl) {
        items.push(
          buildItem("View image", function () {
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
        buildItem("Cut", function () {
          execEdit(doc, "cut");
        })
      );
    }

    if (hasSel) {
      items.push(
        buildItem("Copy", function () {
          execEdit(doc, "copy");
        })
      );
    }

    if (isEditable) {
      items.push(
        buildItem("Paste", function () {
          if (typeof sendBridge === "function") {
            sendBridge("webcontents_paste").catch(function () {});
            return;
          }
          doc.execCommand("paste");
        })
      );
    }

    items.push(
      buildItem("Select All", function () {
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
      buildItem("Copy URL", function () {
        writeClipboard(win.location.href);
      })
    );

    items.push(
      buildItem("Navigate to URL", function () {
        navigateToUrlModal(doc);
      })
    );

    items.push(
      buildItem("Reload", function () {
        win.location.reload();
      })
    );

    for (var i = items.length - 1; i >= 0; i--) {
      if (items[i].className === "sclient-cm-sep") {
        var hasBefore = false;
        for (var b = i - 1; b >= 0; b--) {
          if (items[b].className !== "sclient-cm-sep") {
            hasBefore = true;
            break;
          }
        }
        var hasAfter = false;
        for (var a = i + 1; a < items.length; a++) {
          if (items[a].className !== "sclient-cm-sep") {
            hasAfter = true;
            break;
          }
        }
        if (!hasBefore || !hasAfter) items.splice(i, 1);
      }
    }

    for (var j = 0; j < items.length; j++) {
      menu.appendChild(items[j]);
    }

    menu.addEventListener(
      "mousedown",
      function (ev) {
        ev.preventDefault();
      },
      true
    );

    menu.style.left = Math.min(e.clientX, win.innerWidth - 210) + "px";
    menu.style.top = Math.min(e.clientY, win.innerHeight - menu.offsetHeight - 5) + "px";
    doc.body.appendChild(menu);
    menuEl = menu;

    requestAnimationFrame(function () {
      menu.style.top = Math.min(e.clientY, win.innerHeight - menu.offsetHeight - 5) + "px";
    });

    var dismiss = function (ev) {
      if (menuEl && menuEl.contains(ev.target)) return;
      close();
      doc.removeEventListener("mousedown", dismiss, true);
      doc.removeEventListener("keydown", onKey, true);
    };

    var onKey = function (ev) {
      if (ev.key === "Escape") {
        close();
      }
    };

    setTimeout(function () {
      doc.addEventListener("mousedown", dismiss, true);
      doc.addEventListener("keydown", onKey, true);
    }, 0);
  }

  document.addEventListener("contextmenu", function (e) {
    handleContextMenu(document, e);
  });

  function injectIntoIframes() {
    function inject(ifr) {
      try {
        var doc = ifr.contentDocument;
        if (!doc) return;
        if (!doc.__sclient_cm) {
          doc.__sclient_cm = true;
          doc.addEventListener("contextmenu", function (e) {
            handleContextMenu(doc, e);
          });
          if (!ifr.__sclient_cm_hooked) {
            ifr.__sclient_cm_hooked = true;
            ifr.addEventListener("load", function () {
              inject(ifr);
            });
          }
        }
      } catch (ex) {}
    }

    document.querySelectorAll("iframe").forEach(inject);

    var obs = new MutationObserver(function (mutations) {
      for (var i = 0; i < mutations.length; i++) {
        for (var j = 0; j < mutations[i].addedNodes.length; j++) {
          var node = mutations[i].addedNodes[j];
          if (node.tagName === "IFRAME") {
            node.addEventListener("load", function () {
              inject(node);
            });
            inject(node);
          } else if (node.querySelectorAll) {
            node.querySelectorAll("iframe").forEach(function (ifr) {
              ifr.addEventListener("load", function () {
                inject(ifr);
              });
              inject(ifr);
            });
          }
        }
      }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
  }

  injectIntoIframes();
})();
