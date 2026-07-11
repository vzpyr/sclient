function injectDownloadButton() {
  if (document.getElementById("sclient-download-btn")) return;

  const queueBtn = document.querySelector(".playbackSoundBadge__showQueue");
  if (!queueBtn || !queueBtn.parentNode) return;

  const btn = document.createElement("button");
  btn.id = "sclient-download-btn";
  btn.className =
    "sc-button sc-button-secondary sc-button-small sc-button-icon sc-button-responsive sc-mr-1x";
  btn.title = "Download";
  btn.innerHTML =
    '<div style="display:flex;align-items:center;justify-content:center;height:100%;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/></svg></div>';

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    const link = document.querySelector(".playbackSoundBadge__titleLink");
    if (!link) return;

    const path = link.getAttribute("href").split("?")[0];
    const id = path.substring(1);
    const fullUrl = "https://soundcloud.com" + path;

    document.querySelectorAll(".sclient-download-toast").forEach((t) => t.remove());

    const toast = document.createElement("div");
    toast.className = "sclient-download-toast";
    toast.innerHTML = `
			<div style="display:flex; flex-direction:column; width:200px;">
				<div style="display:flex; justify-content:space-between; align-items:center;">
					<span class="sclient-toast-title" style="font-weight:600; font-size:13px;">Downloading...</span>
					<button class="sclient-toast-close" style="background:transparent; border:none; color:inherit; cursor:pointer; padding:0; display:flex; align-items:center; justify-content:center;">
						<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
					</button>
				</div>
				<div style="display:flex; align-items:center; gap:8px;">
					<div style="flex-grow:1; height:6px; background-color:#333; border-radius:10px; overflow:hidden; display:flex;">
						<div class="sclient-toast-progress" style="width: 0%; background-color: #ffffff; transition: width 0.2s;"></div>
					</div>
					<span class="sclient-toast-percent" style="font-size:12px; min-width:32px; text-align:right;">0%</span>
				</div>
			</div>
		`;
    toast.style.right = lazyScrollOn ? "70px" : "20px";
    toast.style.padding = "6px 10px";
    toast.style.textAlign = "left";
    toast.style.pointerEvents = "auto";

    const progressFill = toast.querySelector(".sclient-toast-progress");
    const percentText = toast.querySelector(".sclient-toast-percent");
    const titleText = toast.querySelector(".sclient-toast-title");
    const closeBtn = toast.querySelector(".sclient-toast-close");

    document.body.appendChild(toast);
    requestAnimationFrame(() => {
      toast.style.opacity = "1";
    });

    closeBtn.addEventListener("click", () => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 300);
    });

    const progressHandler = (event) => {
      if (
        event.data &&
        event.data.source === "sclient-bridge-event" &&
        event.data.event === "download_progress"
      ) {
        if (event.data.data.url === fullUrl) {
          const pct = event.data.data.percent;
          progressFill.style.width = pct + "%";
          percentText.textContent = Math.round(parseFloat(pct)) + "%";
        }
      }
    };
    window.addEventListener("message", progressHandler);

    sendBridge("download_song", { url: fullUrl })
      .then(() => {
        window.removeEventListener("message", progressHandler);
        progressFill.style.width = "100%";
        percentText.textContent = "100%";
        titleText.textContent = "Download finished.";
      })
      .catch((err) => {
        window.removeEventListener("message", progressHandler);
        titleText.textContent = "Failed: " + (err.message || err);
        titleText.style.color = "#F44336";
      });
  });

  queueBtn.parentNode.insertBefore(btn, queueBtn);
}
