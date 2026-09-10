const FEATURES = [];

function injectStyle(id, css) {
  if (document.getElementById(id)) return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = css;
  if (document.head) {
    document.head.appendChild(style);
  } else {
    document.addEventListener("DOMContentLoaded", () => {
      if (!document.getElementById(id)) document.head.appendChild(style);
    });
  }
}

function injectToIframes(id, css) {
  const applyToIframe = (ifr) => {
    try {
      if (!ifr.contentDocument) return;
      if (ifr.contentDocument.getElementById(id + "-iframe")) return;
      const style = ifr.contentDocument.createElement("style");
      style.id = id + "-iframe";
      style.textContent = css;
      ifr.contentDocument.head.appendChild(style);
    } catch (e) {}
  };

  document.querySelectorAll("iframe").forEach(applyToIframe);

  const obs = new MutationObserver((mutations) => {
    for (const mut of mutations) {
      for (const node of mut.addedNodes) {
        if (node.tagName === "IFRAME") {
          node.addEventListener("load", () => applyToIframe(node));
          applyToIframe(node);
        } else if (node.querySelectorAll) {
          node.querySelectorAll("iframe").forEach((ifr) => {
            ifr.addEventListener("load", () => applyToIframe(ifr));
            applyToIframe(ifr);
          });
        }
      }
    }
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.textContent = message;
  toast.className = "sclient-toast";
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("open"));
  setTimeout(() => {
    toast.classList.remove("open");
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function showConfirm(message, options) {
  return new Promise((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.className = "sclient-modal-backdrop";

    const modal = document.createElement("div");
    modal.className = "sclient-modal-surface";

    const msg = document.createElement("div");
    msg.textContent = message;
    msg.className = "sclient-modal-msg";
    modal.appendChild(msg);

    const btnRow = document.createElement("div");
    btnRow.className = "sclient-modal-actions";

    let buttons = [];
    if (Array.isArray(options)) {
      buttons = options;
    } else {
      buttons = [
        { id: false, text: arguments[2] || "Cancel", type: "secondary" },
        { id: true, text: arguments[1] || "Confirm", type: "danger" },
      ];
    }

    const cleanup = (res) => {
      backdrop.classList.remove("open");
      setTimeout(() => {
        backdrop.remove();
        resolve(res);
      }, 200);
    };

    buttons.forEach((b) => {
      const btn = document.createElement("button");
      btn.textContent = b.text;
      btn.className = "sclient-btn";
      if (b.type === "danger") {
        btn.classList.add("sclient-btn-danger");
      } else if (b.type === "primary") {
        btn.classList.add("sclient-btn-primary");
      }
      btn.onclick = () => cleanup(b.id);
      btnRow.appendChild(btn);
    });

    modal.appendChild(btnRow);
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    requestAnimationFrame(() => backdrop.classList.add("open"));
  });
}

function esc(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getAccent() {
  return SCLIENT_CONFIG.customAccent ? SCLIENT_CONFIG.accentColor : "#f50";
}

function closeSettingsDrawer() {
  const el = document.getElementById("sclient-settings-overlay");
  if (el) el.classList.remove("open");
}

function closeLyricsSidebar() {
  const el = document.getElementById("sclient-lyrics-sidebar");
  if (el) el.classList.remove("open");
}
