const scrollStyle = document.createElement('style');
scrollStyle.textContent = `
    ::-webkit-scrollbar { width: 6px; height: 6px; background: transparent; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: rgba(128, 128, 128, 0.4); border-radius: 6px; }
    ::-webkit-scrollbar-thumb:hover { background: rgba(128, 128, 128, 0.7); }
    * { scrollbar-width: thin; scrollbar-color: rgba(128, 128, 128, 0.4) transparent; }

    // light theme
    body.theme-light #sclient-settings-overlay,
    body.theme-light #sclient-lyrics-sidebar {
        background: rgba(250, 250, 250, 0.95) !important;
        color: #222 !important;
        border-left: 1px solid rgba(0,0,0,0.1) !important;
    }
    
    body.theme-light #sclient-lyrics-content {
        color: #444 !important;
    }

    body.theme-light #sclient-lazy-scroll {
        background: rgba(250, 250, 250, 0.9) !important;
        color: #333 !important;
        border: 1px solid #ccc !important;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1) !important;
    }

    body.theme-light #sclient-lazy-scroll:hover {
        background: rgba(235, 235, 235, 0.95) !important;
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
        background: #e0e0e0 !important;
        color: #333 !important;
        border: 1px solid #ccc !important;
    }

    body.theme-light button#tab-css[style*="rgb(51, 51, 51)"],
    body.theme-light button#tab-css[style*="#333"],
    body.theme-light button#tab-js[style*="rgb(51, 51, 51)"],
    body.theme-light button#tab-js[style*="#333"] {
        background: #e0e0e0 !important;
        color: #333 !important;
        border: 1px solid #ccc !important;
    }

    body.theme-light input[type="text"],
    body.theme-light textarea:not(#sclient-css-editor):not(#sclient-js-editor) {
        background: #fff !important;
        color: #333 !important;
        border: 1px solid #bbb !important;
        box-shadow: inset 0 1px 3px rgba(0,0,0,0.05) !important;
    }

    body.theme-light #sclient-css-container,
    body.theme-light #sclient-js-container {
        background: #121212 !important;
        filter: invert(1) hue-rotate(180deg);
        border: 1px solid #333 !important;
        border-radius: 4px;
    }

    body.theme-light #sclient-trueshuffle-engine {
        background-color: #fff !important;
        color: #333 !important;
        border: 1px solid #ccc !important;
        background-image: url('data:image/svg+xml;utf8,<svg fill="%23333" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg"><path d="M7 10l5 5 5-5z"/></svg>') !important;
    }
    body.theme-light #sclient-trueshuffle-engine option {
        background: #fff !important;
        color: #333 !important;
    }
    body.theme-light #sclient-proxyurl-input {
        background: #fff !important;
        color: #333 !important;
        border-color: #ccc !important;
    }
`;
if (document.head) document.head.appendChild(scrollStyle);
else document.addEventListener('DOMContentLoaded', () => document.head.appendChild(scrollStyle));

let customAccentEnabled = window.__SCLIENT_CONFIG__ ? window.__SCLIENT_CONFIG__.custom_accent : false;
let accentColor = window.__SCLIENT_CONFIG__ ? window.__SCLIENT_CONFIG__.accent_color : '#FF0000';
let lazyScrollEnabled = window.__SCLIENT_CONFIG__ ? window.__SCLIENT_CONFIG__.lazy_scroll : false;
let hideDecorationsEnabled = window.__SCLIENT_CONFIG__ ? window.__SCLIENT_CONFIG__.hide_decorations : false;
let fluidViewportEnabled = window.__SCLIENT_CONFIG__ ? window.__SCLIENT_CONFIG__.fluid_viewport : false;
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

function applyFluidViewport() {
    const style = document.createElement('style');
    style.id = 'sclient-fluid-viewport';
    style.textContent = `
        .l-container {
          min-width: 720px !important;
          max-width: 1469px !important;
          width: 100% !important;
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

function setupLazyScroll() {
    if (document.getElementById('sclient-lazy-scroll')) return;

    const btn = document.createElement('button');
    btn.id = 'sclient-lazy-scroll';
    btn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="7 13 12 18 17 13"></polyline><polyline points="7 6 12 11 17 6"></polyline></svg>`;
    btn.style.cssText = `
        position: fixed;
        bottom: 68px;
        right: 20px;
        z-index: 999999;
        background: rgba(18, 18, 18, 0.8);
        color: #fff;
        border: 2px solid #fff;
        border-radius: 50%;
        width: 50px;
        height: 50px;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        cursor: pointer;
        backdrop-filter: blur(5px);
        transition: all 0.2s ease;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;

    let scrolling = false;
    let scrollInterval = null;

    btn.addEventListener('click', () => {
        scrolling = !scrolling;
        if (scrolling) {
            btn.style.background = customAccentEnabled ? accentColor : '#f50';
            btn.style.border = '2px solid #fff';
            scrollInterval = setInterval(() => {
                window.scrollBy({ top: 300, behavior: 'auto' });
            }, 16);
        } else {
            btn.style.background = 'rgba(18, 18, 18, 0.8)';
            btn.style.border = '2px solid #fff';
            clearInterval(scrollInterval);
        }
    });

    btn.addEventListener('mouseenter', () => {
        if (!scrolling) btn.style.background = 'rgba(30, 30, 30, 0.9)';
    });
    btn.addEventListener('mouseleave', () => {
        if (!scrolling) btn.style.background = 'rgba(18, 18, 18, 0.8)';
    });

    document.body.appendChild(btn);
}
