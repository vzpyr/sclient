(function() {
  var menuEl = null;

  function close() {
    if (menuEl) { menuEl.remove(); menuEl = null; }
  }

  function findEditable(target) {
    var el = target;
    while (el && el !== document.body) {
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

  function findLink(target) {
    var el = target;
    while (el && el !== document.body) {
      if (el.tagName === 'A' && el.href) return el;
      el = el.parentElement;
    }
    return null;
  }

  function findImageEl(target) {
    var el = target;
    while (el && el !== document.body) {
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

  function viewImage(url) {
    var overlay = document.createElement('div');
    overlay.className = 'sc-modal-backdrop';
    var img = document.createElement('img');
    img.src = url;
    img.style.cssText = 'max-width:90vw;max-height:90vh;border-radius:var(--sc-radius-lg);box-shadow:0 10px 40px rgba(0,0,0,0.5);object-fit:contain;transform:scale(0.95);transition:transform 0.2s ease;';
    overlay.appendChild(img);
    document.body.appendChild(overlay);
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

  function buildItem(label, action) {
    var el = document.createElement('div');
    el.className = 'sclient-cm-item';
    el.textContent = label;
    el.addEventListener('click', function() { close(); action(); });
    return el;
  }

  function buildSep() {
    var el = document.createElement('div');
    el.className = 'sclient-cm-sep';
    return el;
  }

  document.addEventListener('contextmenu', function(e) {
    if (e.target.closest('#sclient-playlists-overlay')) return;

    e.preventDefault();
    close();

    var editableEl = null;
    try { editableEl = findEditable(e.target); } catch(err) { editableEl = null; }
    var isEditable = !!editableEl;

    var linkEl = findLink(e.target);

    var imageEl = null;
    try { imageEl = findImageEl(e.target); } catch(err) { imageEl = null; }

    var sel = window.getSelection().toString().trim();
    var hasSel = sel.length > 0;
    var accent = typeof getAccent === 'function' ? getAccent() : '#f50';

    var menu = document.createElement('div');
    menu.className = 'sclient-cm';

    var style = document.createElement('style');
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
        sendBridge('clipboard_writeText', { text: linkEl.href }).catch(function() {});
      }));
    }

    if (imageEl) {
      var imgUrl = imageUrlFrom(imageEl);
      if (imgUrl) {
        items.push(buildItem('View image', function() {
          viewImage(imgUrl);
        }));
      }
    }

    if (linkEl || (imageEl && imgUrl)) {
      items.push(buildSep());
    }

    if (isEditable && hasSel) {
      items.push(buildItem('Cut', function() {
        sendBridge('webcontents_cut').catch(function() {});
      }));
    }

    if (hasSel) {
      items.push(buildItem('Copy', function() {
        sendBridge('webcontents_copy').catch(function() {});
      }));
    }

    if (isEditable) {
      items.push(buildItem('Paste', function() {
        sendBridge('webcontents_paste').catch(function() {});
      }));
    }

    items.push(buildSep());

    items.push(buildItem('Select All', function() {
      if (editableEl && (editableEl.tagName === 'INPUT' || editableEl.tagName === 'TEXTAREA')) {
        editableEl.focus();
        editableEl.select();
      } else {
        sendBridge('webcontents_selectAll').catch(function() {});
      }
    }));

    items.push(buildItem('Copy URL', function() {
      sendBridge('clipboard_writeText', { text: window.location.href }).catch(function() {});
    }));

    items.push(buildItem('Reload', function() {
      window.location.reload();
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

    menu.style.left = Math.min(e.clientX, window.innerWidth - 210) + 'px';
    menu.style.top = Math.min(e.clientY, window.innerHeight - menu.offsetHeight - 5) + 'px';
    document.body.appendChild(menu);
    menuEl = menu;

    requestAnimationFrame(function() {
      menu.style.top = Math.min(e.clientY, window.innerHeight - menu.offsetHeight - 5) + 'px';
    });

    var dismiss = function(ev) {
      if (menuEl && menuEl.contains(ev.target)) return;
      close();
      document.removeEventListener('mousedown', dismiss, true);
      document.removeEventListener('keydown', onKey, true);
    };

    var onKey = function(ev) {
      if (ev.key === 'Escape') { close(); }
    };

    setTimeout(function() {
      document.addEventListener('mousedown', dismiss, true);
      document.addEventListener('keydown', onKey, true);
    }, 0);
  });
})();
