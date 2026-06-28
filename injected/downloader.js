function injectDownloadButton() {
    if (document.getElementById('sclient-download-btn')) return;

    const showQueueBtn = document.querySelector('.playbackSoundBadge__showQueue');
    if (showQueueBtn && showQueueBtn.parentNode) {
        const dlBtn = document.createElement('button');
        dlBtn.id = 'sclient-download-btn';
        dlBtn.className = 'sc-button sc-button-secondary sc-button-small sc-button-icon sc-button-responsive sc-mr-1x';
        dlBtn.title = 'Download';
        dlBtn.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"></path></svg></div>`;
        
        dlBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const titleLink = document.querySelector('.playbackSoundBadge__titleLink');
            if (titleLink) {
                let urlPath = titleLink.getAttribute('href').split('?')[0];
                let songIdentifier = urlPath.substring(1);
                let fullUrl = "https://soundcloud.com" + urlPath;
                let toast = document.createElement('div');
                toast.innerText = `Downloading ${songIdentifier}...\nYou will be notified upon completion.`;
                Object.assign(toast.style, {
                    position: 'fixed', bottom: '68px', right: (typeof lazyScrollEnabled !== 'undefined' && lazyScrollEnabled) ? '90px' : '20px', 
                    background: 'rgba(18, 18, 18, 0.8)', color: '#fff', border: '2px solid #fff', backdropFilter: 'blur(5px)',
                    padding: '12px 24px', borderRadius: '50px', zIndex: '99999', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', transition: 'opacity 0.3s'
                });
                document.body.appendChild(toast);
                const callbackId = 'download_song_' + Date.now();
                const handler = (event) => {
                    if (event.source !== window || !event.data || event.data.source !== 'sclient-bridge-reply') return;
                    if (event.data.callbackId === callbackId) {
                        window.removeEventListener('message', handler);
                        if (event.data.success) {
                            toast.innerText = 'Download finished!';
                            setTimeout(() => toast.remove(), 3000);
                        } else {
                            toast.innerText = 'Download failed: ' + event.data.error;
                            setTimeout(() => toast.remove(), 5000);
                        }
                    }
                };
                window.addEventListener('message', handler);
                window.postMessage({
                    source: 'sclient-bridge',
                    action: 'invoke',
                    cmd: 'download_song',
                    args: { url: fullUrl },
                    callbackId: callbackId
                }, '*');
            } else {
                console.warn('[SClient] No song currently playing to download.');
            }
        });

        showQueueBtn.parentNode.insertBefore(dlBtn, showQueueBtn);
    }
}
