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

		const toast = document.createElement("div");
		toast.className = "sclient-download-toast";
		toast.textContent = `Downloading ${id}...\nYou will be notified upon completion.`;
		toast.style.right = lazyScrollOn ? "70px" : "20px";
		document.body.appendChild(toast);
		requestAnimationFrame(() => {
			toast.style.opacity = "1";
		});

		sendBridge("download_song", { url: fullUrl })
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

	queueBtn.parentNode.insertBefore(btn, queueBtn);
}
