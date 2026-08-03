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
  toast.className = "sclient-modal-surface";
  toast.style.cssText = `
    position: fixed; bottom: 20px; left: 20px; width: auto; max-width: 360px;
    border-radius: var(--sclient-radius-xl); min-height: 40px; box-sizing: border-box;
    display: flex; align-items: center; justify-content: center;
    padding: 10px 20px; pointer-events: none; z-index: 9999999; opacity: 0; transform: translateY(10px);
    transition: all 0.3s ease; white-space: pre-line; text-align: center; font-size: var(--sclient-text-base);
  `;
  document.body.appendChild(toast);
  requestAnimationFrame(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";
  });
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(10px)";
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function showConfirm(message, options) {
  return new Promise((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.className = "sclient-modal-backdrop";

    const modal = document.createElement("div");
    modal.className = "sclient-modal-surface";
    modal.style.textAlign = "center";

    const msg = document.createElement("div");
    msg.textContent = message;
    msg.className = "sclient-text-body";
    msg.style.cssText = "font-weight: 500; margin-bottom: 24px; font-size: var(--sclient-text-lg);";
    modal.appendChild(msg);

    const btnRow = document.createElement("div");
    btnRow.style.cssText = "display: flex; gap: 12px; justify-content: center;";

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
      backdrop.style.opacity = "0";
      modal.style.transform = "scale(0.95)";
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

    requestAnimationFrame(() => {
      backdrop.style.opacity = "1";
      modal.style.transform = "scale(1)";
    });
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
