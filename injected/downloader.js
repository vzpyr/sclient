function injectDownloadButton() {
	if (document.getElementById("sclient-download-btn")) return;

	const showQueueBtn = document.querySelector(".playbackSoundBadge__showQueue");
	if (!showQueueBtn || !showQueueBtn.parentNode) return;

	const dlBtn = document.createElement("button");
	dlBtn.id = "sclient-download-btn";
	dlBtn.className =
		"sc-button sc-button-secondary sc-button-small sc-button-icon sc-button-responsive sc-mr-1x";
	dlBtn.title = "Download";
	dlBtn.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/></svg></div>`;

	dlBtn.addEventListener("click", (e) => {
		e.preventDefault();
		const titleLink = document.querySelector(".playbackSoundBadge__titleLink");
		if (!titleLink) return;

		const urlPath = titleLink.getAttribute("href").split("?")[0];
		const songIdentifier = urlPath.substring(1);
		const fullUrl = "https://soundcloud.com" + urlPath;

		const toast = document.createElement("div");
		toast.className = "sclient-download-toast";
		toast.textContent = `Downloading ${songIdentifier}...\nYou will be notified upon completion.`;
		toast.style.right = lazyScrollEnabled ? "70px" : "20px";
		document.body.appendChild(toast);
		requestAnimationFrame(() => {
			toast.style.opacity = "1";
		});

		sendBridgeMsg("download_song", { url: fullUrl })
			.then(() => {
				toast.style.opacity = "0";
				setTimeout(() => {
					toast.textContent = "Download finished!";
					toast.style.opacity = "1";
					setTimeout(() => {
						toast.style.opacity = "0";
						setTimeout(() => toast.remove(), 300);
					}, 3000);
				}, 300);
			})
			.catch((err) => {
				toast.style.opacity = "0";
				setTimeout(() => {
					toast.textContent = "Download failed: " + (err.message || err);
					toast.style.opacity = "1";
					setTimeout(() => {
						toast.style.opacity = "0";
						setTimeout(() => toast.remove(), 300);
					}, 5000);
				}, 300);
			});
	});

	showQueueBtn.parentNode.insertBefore(dlBtn, showQueueBtn);
}
