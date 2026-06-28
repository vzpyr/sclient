// hydrate fetch
const originalFetch = window.fetch;
window.fetch = async function(...args) {
    let url = "";
    if (typeof args[0] === "string") {
        url = args[0];
    } else if (args[0] instanceof URL) {
        url = args[0].href;
    } else if (args[0] && args[0].url) {
        url = args[0].url;
    }

    // proxy
    if (!window.__SC_FAST_PROXY__ && regionBypassEnabled && proxyUrl && proxyUrl.startsWith("http")) {
        if (url.includes("api-v2.soundcloud.com/resolve") ||
            url.includes("api-v2.soundcloud.com/tracks") ||
            url.includes("api-v2.soundcloud.com/playlists") ||
            url.includes("api-v2.soundcloud.com/media")) {
            
            const targetUrl = new URL(proxyUrl);
            targetUrl.searchParams.set("url", url);
            
            if (typeof args[0] === "string" || args[0] instanceof URL) {
                args[0] = targetUrl.toString();
            } else if (args[0] && args[0].url) {
                args[0].url = targetUrl.toString();
            }
        }
    }

    if (trueShuffleEnabled && url && typeof url === "string" &&
        url.includes("api-v2.soundcloud.com/playlists/") && 
        url.includes("representation=full")) {
        
        try {
            const response = await originalFetch.apply(this, args);
            const clone = response.clone();
            const data = await clone.json();
            
            if (data && data.tracks && Array.isArray(data.tracks)) {
                const stubIds = [];
                data.tracks.forEach((track, index) => {
                    if (!track.title && track.id) {
                        stubIds.push(track.id);
                    }
                });

                if (stubIds.length > 0) {
                    console.log(`[SClient] Hydrating ${stubIds.length} track stubs for True Shuffle...`);
                    const urlObj = new URL(url);
                    const clientId = urlObj.searchParams.get('client_id');
                    
                    if (clientId) {
                        const chunkSize = 50;
                        const hydrationPromises = [];
                        
                        for (let i = 0; i < stubIds.length; i += chunkSize) {
                            const chunk = stubIds.slice(i, i + chunkSize);
                            const hydrateUrl = `https://api-v2.soundcloud.com/tracks?ids=${chunk.join(',')}&client_id=${clientId}`;
                            hydrationPromises.push(
                                window.fetch(hydrateUrl)
                                    .then(res => res.json())
                                    .catch(e => { console.error('[SClient] Hydration chunk failed:', e); return []; })
                            );
                        }
                        
                        const hydratedChunks = await Promise.all(hydrationPromises);
                        const hydratedTracksMap = {};
                        hydratedChunks.forEach(chunkTracks => {
                            if (Array.isArray(chunkTracks)) {
                                chunkTracks.forEach(t => {
                                    hydratedTracksMap[t.id] = t;
                                });
                            }
                        });
                        
                        data.tracks = data.tracks.map(track => {
                            if (!track.title && hydratedTracksMap[track.id]) {
                                return hydratedTracksMap[track.id];
                            }
                            return track;
                        });
                        
                        console.log('[SClient] Playlist hydration complete!');
                        return new Response(JSON.stringify(data), {
                            status: response.status,
                            statusText: response.statusText,
                            headers: response.headers
                        });
                    }
                }
            }
            return response;
        } catch (e) {
            console.error('[SClient] Fetch interception error:', e);
            return originalFetch.apply(this, args);
        }
    }
    
    return originalFetch.apply(this, args);
};

// hydrate xhr
const origOpen = XMLHttpRequest.prototype.open;
const origSend = XMLHttpRequest.prototype.send;
const origSetReqHeader = XMLHttpRequest.prototype.setRequestHeader;

XMLHttpRequest.prototype.open = function(method, url) {
    let finalUrl = "";
    if (typeof url === "string") {
        finalUrl = url;
    } else if (url instanceof URL) {
        finalUrl = url.href;
    }

    // region bypass proxy
    if (!window.__SC_FAST_PROXY__ && regionBypassEnabled && proxyUrl && proxyUrl.startsWith("http") && finalUrl) {
        if (finalUrl.includes("api-v2.soundcloud.com/resolve") ||
            finalUrl.includes("api-v2.soundcloud.com/tracks") ||
            finalUrl.includes("api-v2.soundcloud.com/playlists") ||
            finalUrl.includes("api-v2.soundcloud.com/media")) {
            const targetUrl = new URL(proxyUrl);
            targetUrl.searchParams.set("url", finalUrl);
            finalUrl = targetUrl.toString();
        }
    }
    
    this._scMethod = method;
    this._scUrl = finalUrl;
    this._scHeaders = {};
    
    const newArgs = Array.prototype.slice.call(arguments);
    newArgs[1] = finalUrl;
    return origOpen.apply(this, newArgs);
};

XMLHttpRequest.prototype.setRequestHeader = function(header, value) {
    this._scHeaders[header] = value;
    return origSetReqHeader.apply(this, arguments);
};

XMLHttpRequest.prototype.send = function(body) {
    if (trueShuffleEnabled && this._scUrl && typeof this._scUrl === 'string' &&
        this._scUrl.includes('api-v2.soundcloud.com/playlists/') && 
        this._scUrl.includes('representation=full')) {
        
        console.log('[SClient] Intercepting XHR playlist request:', this._scUrl);
        
        fetch(this._scUrl, {
            method: this._scMethod,
            headers: this._scHeaders,
            body: body
        })
        .then(res => res.json())
        .then(async data => {
            if (data && data.tracks && Array.isArray(data.tracks)) {
                const stubIds = [];
                data.tracks.forEach(t => { if (!t.title && t.id) stubIds.push(t.id); });
                
                if (stubIds.length > 0) {
                    console.log(`[SClient] XHR Hydrating ${stubIds.length} track stubs for True Shuffle...`);
                    const clientId = new URL(this._scUrl, window.location.origin).searchParams.get('client_id');
                    if (clientId) {
                        const chunkSize = 50;
                        const promises = [];
                        for (let i = 0; i < stubIds.length; i += chunkSize) {
                            const chunk = stubIds.slice(i, i + chunkSize);
                            promises.push(
                                fetch(`https://api-v2.soundcloud.com/tracks?ids=${chunk.join(',')}&client_id=${clientId}`)
                                .then(r => r.json())
                                .catch(() => [])
                            );
                        }
                        
                        const hydratedChunks = await Promise.all(promises);
                        const map = {};
                        hydratedChunks.forEach(c => Array.isArray(c) && c.forEach(t => map[t.id] = t));
                        
                        data.tracks = data.tracks.map(t => (!t.title && map[t.id]) ? map[t.id] : t);
                        console.log('[SClient] XHR Playlist hydration complete!');
                    }
                }
            }

            // shuffle memory
            if (trueShuffleEnabled && trueShuffleMode === 'api' && data.tracks.length > 1) {
                for (let i = data.tracks.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [data.tracks[i], data.tracks[j]] = [data.tracks[j], data.tracks[i]];
                }
                console.log(`[SClient] XHR True Shuffle (API Mode) perfectly randomized ${data.tracks.length} tracks in memory!`);
            }
            
            const hydratedText = JSON.stringify(data);
            
            Object.defineProperty(this, 'responseText', { get: () => hydratedText });
            Object.defineProperty(this, 'response', { get: () => hydratedText });
            Object.defineProperty(this, 'readyState', { get: () => 4 });
            Object.defineProperty(this, 'status', { get: () => 200 });
            Object.defineProperty(this, 'statusText', { get: () => 'OK' });
            
            Object.defineProperty(this, 'getAllResponseHeaders', { value: () => "content-type: application/json; charset=utf-8\r\n" });
            Object.defineProperty(this, 'getResponseHeader', { value: (hdr) => hdr.toLowerCase() === 'content-type' ? 'application/json; charset=utf-8' : null });
            
            if (this.onreadystatechange) this.onreadystatechange();
            this.dispatchEvent(new Event('readystatechange'));
            
            if (this.onload) this.onload();
            this.dispatchEvent(new Event('load'));
            
            if (this.onloadend) this.onloadend();
            this.dispatchEvent(new Event('loadend'));
            
        }).catch(err => {
            console.error('[SClient] XHR Hydration failed, falling back:', err);
            origSend.call(this, body);
        });
        
        return;
    }
    
    return origSend.apply(this, arguments);
};

// load queue
async function forceLoadQueue() {
    const queueBtn = document.querySelector('.playbackSoundBadge__showQueue');
    if (!queueBtn) return;
    
    let queueContainer = document.querySelector('.playControls__queue .queue.m-visible');
    const wasOpen = !!queueContainer;
    
    // stop auto radio
    const styleNode = document.createElement('style');
    styleNode.textContent = `.queue__fallback { display: none !important; }`;
    document.head.appendChild(styleNode);
    
    if (!wasOpen) {
        queueBtn.click();
        await new Promise(r => setTimeout(r, 250));
    }
    
    let scrollable = null;
    for (let i = 0; i < 20; i++) {
        scrollable = document.querySelector('.queue__scrollable');
        if (scrollable) break;
        await new Promise(r => setTimeout(r, 100));
    }
    
    if (scrollable) {
        let sameCount = 0;
        let blankCount = 0;
        let lastTransform = '';
        
        while (true) {
            // bypass bot check
            const rect = scrollable.getBoundingClientRect();
            scrollable.dispatchEvent(new WheelEvent('wheel', {
                deltaY: 1000,
                clientX: rect.left + (rect.width / 2),
                clientY: rect.top + (rect.height / 2),
                bubbles: true,
                cancelable: true
            }));
            
            await new Promise(r => setTimeout(r, 80)); 
            
            const newItems = document.querySelectorAll('.queue__itemWrapper:not(.queue__fallback)');
            if (newItems.length === 0) {
                blankCount++;
                if (blankCount > 10) break;
                await new Promise(r => setTimeout(r, 100));
                continue;
            }
            blankCount = 0;
            
            const newLastItem = newItems[newItems.length - 1];
            const currentTransform = newLastItem.style.transform;
            
            if (currentTransform === lastTransform) {
                sameCount++;
                if (sameCount === 4) await new Promise(r => setTimeout(r, 400));
                if (sameCount > 8) break;
            } else {
                sameCount = 0;
            }
            lastTransform = currentTransform;
        }
    }
    
    await new Promise(r => setTimeout(r, 400));
    
    if (!wasOpen) {
        queueBtn.click();
    }
    if (styleNode.parentNode) styleNode.remove();
}

// catch shuffle click
window.addEventListener('click', async (e) => {
    if (!trueShuffleEnabled || trueShuffleMode !== 'native' || !e.isTrusted) return;
    
    const shuffleBtn = e.target.closest('.shuffleControl');
    if (shuffleBtn) {
        const isTurningOn = !shuffleBtn.classList.contains('m-shuffling');
        
        if (isTurningOn) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            
            customAlert("True Shuffle (Native Mode): Loading full playlist...");
            
            await forceLoadQueue();
            
            shuffleBtn.click();
        }
    }
}, true);
