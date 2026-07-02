const scrollStyle = document.createElement('style');
scrollStyle.textContent = `
    ::-webkit-scrollbar { width: 6px; height: 6px; background: transparent; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: rgba(128, 128, 128, 0.4); border-radius: 6px; }
    ::-webkit-scrollbar-thumb:hover { background: rgba(128, 128, 128, 0.7); }
    * { scrollbar-width: thin; scrollbar-color: rgba(128, 128, 128, 0.4) transparent; }

    /* light theme */
    body.theme-light #sclient-settings-overlay,
    body.theme-light #sclient-lyrics-sidebar {
        background: rgba(250, 250, 250, 0.95) !important;
        color: #222 !important;
        border-left: 1px solid rgba(0,0,0,0.1) !important;
    }
    
    body.theme-light #sclient-lyrics-content {
        color: #444 !important;
    }



    body.theme-light #sclient-settings-scroll > div[style*="justify-content: space-between"] {
        background: rgba(0,0,0,0.05) !important;
        border-color: rgba(0,0,0,0.1) !important;
    }

    body.theme-light #sclient-accounts-list > div {
        background: rgba(0,0,0,0.05) !important;
        border: 1px solid rgba(0,0,0,0.1) !important;
    }

    body.theme-light #sclient-add-account-btn,
    body.theme-light #sclient-accounts-list button {
        background: #eee !important;
        color: #333 !important;
        border: 1px solid #ddd !important;
    }

    body.theme-light button#tab-css[style*="rgb(51, 51, 51)"],
    body.theme-light button#tab-css[style*="#333"],
    body.theme-light button#tab-js[style*="rgb(51, 51, 51)"],
    body.theme-light button#tab-js[style*="#333"] {
        background: #eee !important;
        color: #111 !important;
    }

    body.theme-light input[type="text"],
    body.theme-light textarea:not(#sclient-css-editor):not(#sclient-js-editor) {
        background: #fff !important;
        color: #333 !important;
        border: 1px solid #ccc !important;
    }

    body.theme-light #sclient-css-container,
    body.theme-light #sclient-js-container {
        border-top: 1px solid rgba(0,0,0,0.1) !important;
    }

    /* True Shuffle Settings - Light Theme */
    body.theme-light #sclient-trueshuffle-engine {
        background: #fff !important;
        color: #333 !important;
        border: 1px solid #ccc !important;
    }
    
    body.theme-light #sclient-trueshuffle-engine option {
        background: #fff;
        color: #333;
    }
    body.theme-light #sclient-proxyurl-input {
        background: #fff !important;
        color: #333 !important;
        border: 1px solid #ccc !important;
    }
`;
if (document.head) document.head.appendChild(scrollStyle);
else document.addEventListener('DOMContentLoaded', () => document.head.appendChild(scrollStyle));

let customAccentEnabled = window.__SCLIENT_CONFIG__ ? window.__SCLIENT_CONFIG__.custom_accent : false;
let accentColor = window.__SCLIENT_CONFIG__ ? window.__SCLIENT_CONFIG__.accent_color : '#FF0000';
let lazyScrollEnabled = window.__SCLIENT_CONFIG__ ? window.__SCLIENT_CONFIG__.lazy_scroll : false;
let hideDecorationsEnabled = window.__SCLIENT_CONFIG__ ? window.__SCLIENT_CONFIG__.hide_decorations : false;
let wideLayoutEnabled = window.__SCLIENT_CONFIG__ ? window.__SCLIENT_CONFIG__.wide_layout : false;
let wideLayoutWidth = window.__SCLIENT_CONFIG__ ? window.__SCLIENT_CONFIG__.wide_layout_width : '1200';
let collapsibleSidebarEnabled = window.__SCLIENT_CONFIG__ ? window.__SCLIENT_CONFIG__.collapsible_sidebar : false;
let oledDarkModeEnabled = window.__SCLIENT_CONFIG__ ? window.__SCLIENT_CONFIG__.oled_dark_mode : false;
let currentCss = window.__SCLIENT_CONFIG__ ? window.__SCLIENT_CONFIG__.css : '';
let currentJs = window.__SCLIENT_CONFIG__ ? window.__SCLIENT_CONFIG__.js : '';
let adblockEnabled = window.__SCLIENT_CONFIG__ ? window.__SCLIENT_CONFIG__.adblock : false;
let trueShuffleEnabled = window.__SCLIENT_CONFIG__ ? window.__SCLIENT_CONFIG__.true_shuffle : false;
let trueShuffleMode = window.__SCLIENT_CONFIG__ ? window.__SCLIENT_CONFIG__.true_shuffle_mode : 'native';
let discordRpcEnabled = window.__SCLIENT_CONFIG__ ? window.__SCLIENT_CONFIG__.discord_rpc : false;
let trayIconEnabled = window.__SCLIENT_CONFIG__ ? window.__SCLIENT_CONFIG__.tray_icon : false;
let hideUpsellEnabled = window.__SCLIENT_CONFIG__ ? window.__SCLIENT_CONFIG__.hide_upsell : false;
let hideArtistsEnabled = window.__SCLIENT_CONFIG__ ? window.__SCLIENT_CONFIG__.hide_artists : false;
let regionBypassEnabled = window.__SCLIENT_CONFIG__ ? window.__SCLIENT_CONFIG__.region_bypass : false;
let proxyUrl = window.__SCLIENT_CONFIG__ ? window.__SCLIENT_CONFIG__.proxy_url : '';
let enhancedHeaderEnabled = window.__SCLIENT_CONFIG__ ? window.__SCLIENT_CONFIG__.enhanced_header : true;
let listenbrainzEnabled = window.__SCLIENT_CONFIG__ ? window.__SCLIENT_CONFIG__.listenbrainz : false;
let listenbrainzToken = window.__SCLIENT_CONFIG__ ? window.__SCLIENT_CONFIG__.listenbrainz_token : '';
let lastfmEnabled = window.__SCLIENT_CONFIG__ ? window.__SCLIENT_CONFIG__.lastfm : false;
let lastfmApiKey = window.__SCLIENT_CONFIG__ ? window.__SCLIENT_CONFIG__.lastfm_api_key : '';
let lastfmSecret = window.__SCLIENT_CONFIG__ ? window.__SCLIENT_CONFIG__.lastfm_secret : '';
let lastfmSessionKey = window.__SCLIENT_CONFIG__ ? window.__SCLIENT_CONFIG__.lastfm_session_key : '';
let lastfmUsername = window.__SCLIENT_CONFIG__ ? window.__SCLIENT_CONFIG__.lastfm_username : '';

document.addEventListener("keydown", (e) => {
    if (e.key === "F5" || (e.ctrlKey && e.key.toLowerCase() === "r")) {
        e.preventDefault();
        window.location.reload();
    }
});

function customAlert(message) {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed; bottom: 20px; left: 20px; background: rgba(18, 18, 18, 0.95);
        color: white; padding: 12px 24px; border-radius: 8px; font-family: 'Inter', system-ui, sans-serif;
        font-size: 14px; font-weight: 500; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        border: 1px solid rgba(255,255,255,0.1); z-index: 9999999; opacity: 0;
        transform: translateY(10px); transition: all 0.3s ease;
    `;
    if (document.body.classList.contains('theme-light')) {
        toast.style.background = 'rgba(250, 250, 250, 0.95)'; toast.style.color = '#222';
        toast.style.border = '1px solid rgba(0,0,0,0.1)';
    }
    document.body.appendChild(toast);
    requestAnimationFrame(() => { toast.style.opacity = '1'; toast.style.transform = 'translateY(0)'; });
    setTimeout(() => {
        toast.style.opacity = '0'; toast.style.transform = 'translateY(10px)';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

function customConfirm(message) {
    return new Promise(resolve => {
        const overlay = document.createElement('div');
        overlay.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 9999999; display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.2s; backdrop-filter: blur(2px);`;
        const isLight = document.body.classList.contains('theme-light');
        const bg = isLight ? '#fff' : '#1e1e1e'; const text = isLight ? '#111' : '#fff'; const border = isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)';
        const modal = document.createElement('div');
        modal.style.cssText = `background: ${bg}; color: ${text}; padding: 24px; border-radius: 12px; max-width: 400px; width: 90%; text-align: center; font-family: 'Inter', system-ui, sans-serif; box-shadow: 0 10px 30px rgba(0,0,0,0.5); border: 1px solid ${border}; transform: scale(0.9); transition: transform 0.2s;`;
        modal.innerHTML = `<div style="font-size: 16px; font-weight: 500; margin-bottom: 24px;">${message}</div><div style="display: flex; gap: 12px; justify-content: center;"><button id="sc-confirm-cancel" style="padding: 8px 16px; background: transparent; border: 1px solid ${border}; color: ${text}; border-radius: 6px; cursor: pointer; font-weight: 500;">Cancel</button><button id="sc-confirm-ok" style="padding: 8px 16px; background: #d32f2f; border: none; color: white; border-radius: 6px; cursor: pointer; font-weight: 500;">Confirm</button></div>`;
        overlay.appendChild(modal); document.body.appendChild(overlay);
        requestAnimationFrame(() => { overlay.style.opacity = '1'; modal.style.transform = 'scale(1)'; });
        const cleanup = (res) => { overlay.style.opacity = '0'; modal.style.transform = 'scale(0.9)'; setTimeout(() => { overlay.remove(); resolve(res); }, 200); };
        modal.querySelector('#sc-confirm-cancel').onclick = () => cleanup(false);
        modal.querySelector('#sc-confirm-ok').onclick = () => cleanup(true);
    });
}

function applyCustomAccentColor(newColor) {
    const targetColors = ['#f50', '#ff5500'];
    const processedNodes = new Set();

    async function processCssText(cssText, originalNode) {
        if (!cssText) return;
        let modified = false;
        let newCssText = cssText;

        targetColors.forEach(color => {
            // strict hex match
            const regexStr = color.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![a-fA-F0-9])';
            const regex = new RegExp(regexStr, 'gi');
            if (regex.test(newCssText)) {
                newCssText = newCssText.replace(regex, newColor);
                modified = true;
            }
        });
        
        const hexToRgb = (hex) => {
            let c = hex.substring(1).split('');
            if(c.length === 3){
                c = [c[0], c[0], c[1], c[1], c[2], c[2]];
            }
            c = '0x' + c.join('');
            return [(c>>16)&255, (c>>8)&255, c&255].join(',');
        };
        const rgbVal = hexToRgb(newColor);
        
        const rgbRegex = /rgb\(\s*255\s*,\s*85\s*,\s*0\s*\)/gi;
        if (rgbRegex.test(newCssText)) {
            newCssText = newCssText.replace(rgbRegex, `rgb(${rgbVal})`);
            modified = true;
        }
        
        const rawRgbRegex = /255\s*,\s*85\s*,\s*0/gi;
        if (rawRgbRegex.test(newCssText)) {
            newCssText = newCssText.replace(rawRgbRegex, rgbVal);
            modified = true;
        }

        if (modified) {
            const style = document.createElement('style');
            style.setAttribute('data-sc-custom-accent', 'true');
            style.textContent = newCssText;
            // keep css order
            if (originalNode && originalNode.parentNode) {
                originalNode.parentNode.insertBefore(style, originalNode.nextSibling);
            } else {
                document.head.appendChild(style);
            }
        }
    }

    async function processNode(node) {
        if (node.hasAttribute('data-sc-custom-accent')) return;
        if (processedNodes.has(node)) return;
        processedNodes.add(node);
        try {
            if (node.tagName === 'LINK' && node.rel === 'stylesheet' && node.href && node.href.includes('sndcdn.com')) {
                let cssText = await fetch(node.href).then(r => r.text());
                await processCssText(cssText, node);
            } else if (node.tagName === 'STYLE') {
                await processCssText(node.textContent, node);
            }
        } catch (e) { }
    }

    const processStyles = () => {
        document.querySelectorAll('link[rel="stylesheet"], style').forEach(processNode);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', processStyles);
    } else {
        processStyles();
    }

    const observer = new MutationObserver((mutations) => {
        let shouldProcess = false;
        mutations.forEach(m => {
            m.addedNodes.forEach(node => {
                if ((node.tagName === 'LINK' && node.rel === 'stylesheet') || node.tagName === 'STYLE') {
                    shouldProcess = true;
                }
            });
        });
        if (shouldProcess) setTimeout(processStyles, 50);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
}

function applyWideLayout() {
    const width = (typeof wideLayoutWidth !== 'undefined' && wideLayoutWidth) ? wideLayoutWidth : '1200';
    const maxWidthRule = width === 'unlimited' ? 'max-width: none !important;' : `max-width: ${width}px !important;`;
    
    const style = document.createElement('style');
    style.id = 'sclient-fluid-viewport';
    style.textContent = `
        .l-container {
          min-width: 720px !important;
          ${maxWidthRule}
          width: 100% !important;
        }
        
        /* Let the header and playback controls stretch to full width */
        header .l-container,
        .playControls .l-container {
          max-width: none !important;
          padding: 0 24px !important;
        }
    `;
    if (document.head) {
        document.head.appendChild(style);
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            document.head.appendChild(style);
        });
    }
}

function applyLayoutFixes() {
    const style = document.createElement('style');
    style.id = 'sclient-layout-fixes';
    style.textContent = `
        /* Fix clipping for tile galleries when expanded beyond normal widths */
        .mixedSelectionModule,
        .mixedSelectionGallery,
        .tileGallery,
        .tileGallery__sliderPeekContainer,
        .tileGallery__sliderPanel {
            height: auto !important;
            min-height: min-content !important;
        }

        .tileGallery__slider {
            height: auto !important;
            min-height: min-content !important;
            padding: 0 !important; /* Override the 48px bottom padding that triggers at 1239px */
        }
        
        .playableTile {
            height: auto !important;
            padding-bottom: 10px !important; /* Ensure some space for text */
            margin-bottom: 0 !important; /* Override .sc-mb-6x */
        }
        
        .systemPlaylistTile {
            height: auto !important;
        }
    `;
    if (document.head) {
        document.head.appendChild(style);
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            document.head.appendChild(style);
        });
    }
}

function applyCollapsibleSidebar() {
    const style = document.createElement('style');
    style.id = 'sclient-collapsible-sidebar';
    style.textContent = `
        /* Collapsable Sidebar Styles */
        .l-fluid-fixed .l-main {
            margin-right: 0 !important;
        }
        .l-sidebar-right {
            position: fixed !important;
            top: 46px !important;
            bottom: 46px !important;
            right: -360px !important;
            width: 360px !important;
            background-color: var(--background-surface-color, #fff) !important;
            z-index: 100 !important;
            transition: right 0.3s ease !important;
            box-sizing: border-box !important;
            box-shadow: -5px 0 25px rgba(0,0,0,0.5) !important;
            overflow-y: auto !important;
            overflow-x: hidden !important;
            padding-top: 20px !important;
        }
        body.sclient-sidebar-open .l-sidebar-right {
            right: 0 !important;
        }
        #sclient-sidebar-toggle {
            display: none !important;
            top: 60px;
        }
        body:has(.l-sidebar-right) #sclient-sidebar-toggle {
            display: flex !important;
        }
    `;
    if (document.head) {
        document.head.appendChild(style);
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            document.head.appendChild(style);
        });
    }
}

function injectFloatingButtonStyles() {
    if (document.getElementById('sclient-floating-btn-styles')) return;
    const style = document.createElement('style');
    style.id = 'sclient-floating-btn-styles';
    style.textContent = `
        .sclient-floating-btn {
            position: fixed;
            right: 20px;
            z-index: 101;
            background: var(--background-surface-color, #f2f2f2);
            color: #333;
            border: 1px solid #ccc !important;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            transition: right 0.3s ease, background 0.2s, color 0.2s, border-color 0.2s;
            padding: 0;
            outline: none !important;
        }
        .sclient-floating-btn:focus {
            outline: none !important;
        }
        .sclient-floating-btn:hover {
            background: #e0e0e0;
        }
        .theme-dark .sclient-floating-btn {
            color: #fff;
            border: 1px solid #333 !important;
        }
        .theme-dark .sclient-floating-btn:hover {
            background: #333;
        }
        
        .sclient-download-toast {
            position: fixed;
            bottom: 68px;
            z-index: 99999;
            background: var(--background-surface-color, #f2f2f2);
            color: #333;
            border: 1px solid #ccc;
            border-radius: 50px;
            min-height: 40px;
            box-sizing: border-box;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 8px 20px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            transition: opacity 0.3s ease, right 0.3s ease;
            font-family: 'Inter', system-ui, sans-serif;
            font-size: 13px;
            font-weight: 500;
            pointer-events: none;
            opacity: 0;
            white-space: pre-line;
            text-align: center;
        }
        
        .theme-dark .sclient-download-toast {
            color: #fff;
            border: 1px solid #333;
        }
        
        /* Active State (High Specificity) */
        body button.sclient-floating-btn.active,
        .theme-dark body button.sclient-floating-btn.active {
            color: #f50 !important;
            border: 1px solid #f50 !important;
        }
        
        body button.sclient-floating-btn.active svg,
        .theme-dark body button.sclient-floating-btn.active svg {
            color: #f50 !important;
            stroke: #f50 !important;
        }
    `;
    if (document.head) document.head.appendChild(style);
    else document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style));
}

function setupLazyScroll() {
    if (document.getElementById('sclient-lazy-scroll')) return;

    const btn = document.createElement('button');
    btn.id = 'sclient-lazy-scroll';
    btn.className = 'sclient-floating-btn';
    btn.style.bottom = '68px';
    btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevrons-down-icon lucide-chevrons-down"><path d="m7 6 5 5 5-5"/><path d="m7 13 5 5 5-5"/></svg>`;

    let scrolling = false;
    let scrollInterval = null;

    btn.addEventListener('click', () => {
        scrolling = !scrolling;
        if (scrolling) {
            btn.classList.add('active');
            scrollInterval = setInterval(() => {
                window.scrollBy({ top: 300, behavior: 'auto' });
            }, 16);
        } else {
            btn.classList.remove('active');
            clearInterval(scrollInterval);
        }
    });

    document.body.appendChild(btn);
}

async function fetchGodModeData(songUrl) {
    let clientId = null;
    const resources = performance.getEntriesByType('resource');
    for (const r of resources) {
        if (r.name.includes('client_id=')) {
            const url = new URL(r.name);
            clientId = url.searchParams.get('client_id');
            if (clientId) break;
        }
    }
    if (!clientId) return null;

    try {
        const resolveUrl = `https://api-v2.soundcloud.com/resolve?url=${encodeURIComponent(songUrl)}&client_id=${clientId}`;
        const res = await fetch(resolveUrl);
        if (!res.ok) return null;
        return await res.json();
    } catch (e) {
        return null;
    }
}
