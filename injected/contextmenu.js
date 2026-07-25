(function() {
  function findEditable(doc, target) {
    var el = target;
    while (el && el !== doc.body) {
      if (el.tagName === 'INPUT') {
        var t = (el.type || '').toLowerCase();
        if (['checkbox','radio','button','submit','reset','image','file','range','color','hidden'].indexOf(t) === -1) return el;
      }
      if (el.tagName === 'TEXTAREA') return el;
      if (el.isContentEditable) return el;
      el = el.parentElement;
    }
    return null;
  }

  function findLink(doc, target) {
    var el = target;
    while (el && el !== doc.body) {
      if (el.tagName === 'A' && el.href) return el;
      el = el.parentElement;
    }
    return null;
  }

  function findImageEl(doc, target) {
    var el = target;
    while (el && el !== doc.body) {
      if (el.tagName === 'IMG' && el.currentSrc) return el;
      var bg = el.style && el.style.backgroundImage;
      if (bg && bg !== 'none' && bg.indexOf('url(') !== -1) return el;
      if (el.classList && el.classList.contains('sc-artwork')) {
        var cbg = getComputedStyle(el).backgroundImage;
        if (cbg && cbg !== 'none' && cbg.indexOf('url(') !== -1) return el;
      }
      el = el.parentElement;
    }
    return null;
  }

  function imageUrlFrom(el) {
    if (el.tagName === 'IMG') return el.currentSrc || el.src;
    var bg = (el.style && el.style.backgroundImage) || getComputedStyle(el).backgroundImage;
    if (!bg || bg === 'none') return null;
    var url = bg.replace(/^url\(['"]?/, '').replace(/['"]?\)$/, '');
    url = url.replace(/-(t50x50|badge|large|t120x120|small|t67x67|t300x300|crop|t200x200|original)\.(jpg|png|jpeg|webp)/i, '-t500x500.$2');
    return url;
  }

  function viewImage(doc, url) {
    var overlay = doc.createElement('div');
    overlay.className = 'sc-modal-backdrop';
    var img = doc.createElement('img');
    img.src = url;
    img.style.cssText = 'max-width:90vw;max-height:90vh;border-radius:var(--sc-radius-lg);box-shadow:0 10px 40px rgba(0,0,0,0.5);object-fit:contain;transform:scale(0.95);transition:transform 0.2s ease;';
    overlay.appendChild(img);
    doc.body.appendChild(overlay);
    requestAnimationFrame(function() {
      overlay.style.opacity = '1';
      img.style.transform = 'scale(1)';
    });
    overlay.addEventListener('click', function() {
      overlay.style.opacity = '0';
      img.style.transform = 'scale(0.95)';
      setTimeout(function() { overlay.remove(); }, 200);
    });
  }

  function writeClipboard(text) {
    if (typeof sendBridge === 'function') {
      sendBridge('clipboard_writeText', { text: text }).catch(function() {});
      return;
    }
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }

  function execEdit(doc, cmd) {
    if (typeof sendBridge === 'function') {
      var map = { copy: 'webcontents_copy', cut: 'webcontents_cut', paste: 'webcontents_paste', selectAll: 'webcontents_selectAll' };
      sendBridge(map[cmd]).catch(function() {});
      return;
    }
    doc.execCommand(cmd);
  }

  function handleContextMenu(doc, e) {
    var menuEl = null;

    function close() {
      if (menuEl) { menuEl.remove(); menuEl = null; }
    }

    function buildItem(label, action) {
      var el = doc.createElement('div');
      el.className = 'sclient-cm-item';
      el.textContent = label;
      el.addEventListener('click', function() { close(); action(); });
      return el;
    }

    function buildSep() {
      var el = doc.createElement('div');
      el.className = 'sclient-cm-sep';
      return el;
    }

    if (e.target.closest('#sclient-playlists-overlay')) return;
    e.preventDefault();
    close();

    var editableEl = null;
    try { editableEl = findEditable(doc, e.target); } catch(err) { editableEl = null; }
    var isEditable = !!editableEl;

    var linkEl = findLink(doc, e.target);

    var imageEl = null;
    try { imageEl = findImageEl(doc, e.target); } catch(err) { imageEl = null; }

    var win = doc.defaultView || doc.parentWindow;
    var sel = win.getSelection().toString().trim();
    var hasSel = sel.length > 0;

    var accent = '#f50';
    try { accent = typeof getAccent === 'function' ? getAccent() : accent; } catch(ex) {}
    if (typeof getAccent !== 'function') {
      var ca = getComputedStyle(document.documentElement).getPropertyValue('--sc-accent').trim();
      if (ca) accent = ca;
    }

    var menu = doc.createElement('div');
    menu.className = 'sclient-cm';

    var style = doc.createElement('style');
    style.textContent = [
      '.sclient-cm {',
      '  position:fixed; z-index:9999999; min-width:200px;',
      '  background:var(--sc-bg-elevated);',
      '  border:1px solid var(--sc-border);',
      '  border-radius:var(--sc-radius-lg);',
      '  padding:6px;',
      '  box-shadow:0 10px 30px rgba(0,0,0,0.5);',
      '  font-family:var(--sc-font-sans);',
      '  font-size:var(--sc-text-base);',
      '  color:var(--sc-text-main);',
      '  -webkit-user-select:none; user-select:none;',
      '}',
      '.sclient-cm-item {',
      '  padding:8px 12px; border-radius:5px; cursor:pointer;',
      '  display:flex; justify-content:space-between; align-items:center; gap:14px;',
      '}',
      '.sclient-cm-item:hover { background:' + accent + '; color:#fff; }',
      '.sclient-cm-sep { height:1px; background:var(--sc-border); margin:4px 0; }',
    ].join('\n');
    menu.appendChild(style);

    var items = [];

    if (linkEl) {
      items.push(buildItem('Copy link address', function() {
        writeClipboard(linkEl.href);
      }));
    }

    if (imageEl) {
      var imgUrl = imageUrlFrom(imageEl);
      if (imgUrl) {
        items.push(buildItem('View image', function() {
          viewImage(doc, imgUrl);
        }));
      }
    }

    if (linkEl || (imageEl && imgUrl)) {
      items.push(buildSep());
    }

    if (isEditable && hasSel) {
      items.push(buildItem('Cut', function() {
        execEdit(doc, 'cut');
      }));
    }

    if (hasSel) {
      items.push(buildItem('Copy', function() {
        execEdit(doc, 'copy');
      }));
    }

    if (isEditable) {
      items.push(buildItem('Paste', function() {
        if (typeof sendBridge === 'function') {
          sendBridge('webcontents_paste').catch(function() {});
          return;
        }
        doc.execCommand('paste');
      }));
    }

    items.push(buildItem('Select All', function() {
      if (editableEl && (editableEl.tagName === 'INPUT' || editableEl.tagName === 'TEXTAREA')) {
        editableEl.focus();
        editableEl.select();
      } else {
        execEdit(doc, 'selectAll');
      }
    }));

    items.push(buildSep());

    items.push(buildItem('Copy URL', function() {
      writeClipboard(win.location.href);
    }));

    items.push(buildItem('Reload', function() {
      win.location.reload();
    }));

    for (var i = items.length - 1; i >= 0; i--) {
      if (items[i].className === 'sclient-cm-sep') {
        var hasBefore = false;
        for (var b = i - 1; b >= 0; b--) {
          if (items[b].className !== 'sclient-cm-sep') { hasBefore = true; break; }
        }
        var hasAfter = false;
        for (var a = i + 1; a < items.length; a++) {
          if (items[a].className !== 'sclient-cm-sep') { hasAfter = true; break; }
        }
        if (!hasBefore || !hasAfter) items.splice(i, 1);
      }
    }

    for (var j = 0; j < items.length; j++) {
      menu.appendChild(items[j]);
    }

    menu.addEventListener('mousedown', function(ev) { ev.preventDefault(); }, true);

    menu.style.left = Math.min(e.clientX, win.innerWidth - 210) + 'px';
    menu.style.top = Math.min(e.clientY, win.innerHeight - menu.offsetHeight - 5) + 'px';
    doc.body.appendChild(menu);
    menuEl = menu;

    requestAnimationFrame(function() {
      menu.style.top = Math.min(e.clientY, win.innerHeight - menu.offsetHeight - 5) + 'px';
    });

    var dismiss = function(ev) {
      if (menuEl && menuEl.contains(ev.target)) return;
      close();
      doc.removeEventListener('mousedown', dismiss, true);
      doc.removeEventListener('keydown', onKey, true);
    };

    var onKey = function(ev) {
      if (ev.key === 'Escape') { close(); }
    };

    setTimeout(function() {
      doc.addEventListener('mousedown', dismiss, true);
      doc.addEventListener('keydown', onKey, true);
    }, 0);
  }

  document.addEventListener('contextmenu', function(e) {
    handleContextMenu(document, e);
  });

  function injectIntoIframes() {
    function inject(ifr) {
      try {
        var doc = ifr.contentDocument;
        if (!doc) return;
        if (!doc.__sclient_cm) {
          doc.__sclient_cm = true;
          doc.addEventListener('contextmenu', function(e) {
            handleContextMenu(doc, e);
          });
          if (!ifr.__sclient_cm_hooked) {
            ifr.__sclient_cm_hooked = true;
            ifr.addEventListener('load', function() { inject(ifr); });
          }
        }
      } catch(ex) {}
    }

    document.querySelectorAll('iframe').forEach(inject);

    var obs = new MutationObserver(function(mutations) {
      for (var i = 0; i < mutations.length; i++) {
        for (var j = 0; j < mutations[i].addedNodes.length; j++) {
          var node = mutations[i].addedNodes[j];
          if (node.tagName === 'IFRAME') {
            node.addEventListener('load', function() { inject(node); });
            inject(node);
          } else if (node.querySelectorAll) {
            node.querySelectorAll('iframe').forEach(function(ifr) {
              ifr.addEventListener('load', function() { inject(ifr); });
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
