function sendBridgeMsg(cmd, args = {}) {
    return new Promise((resolve, reject) => {
        const callbackId = cmd + '_' + Date.now();
        const handler = (event) => {
            if (event.source !== window || !event.data || event.data.source !== 'sclient-bridge-reply') return;
            if (event.data.callbackId === callbackId) {
                window.removeEventListener('message', handler);
                if (event.data.success) resolve(event.data.result);
                else reject(event.data.error);
            }
        };
        window.addEventListener('message', handler);
        window.postMessage({
            source: 'sclient-bridge',
            action: 'invoke',
            cmd: cmd,
            args: args,
            callbackId: callbackId
        }, '*');
    });
}

function createOverlay() {
    if (document.getElementById('sclient-settings-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'sclient-settings-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        right: -450px;
        width: 400px;
        height: 100%;
        background: rgba(18, 18, 18, 0.95);
        backdrop-filter: blur(10px);
        border-left: 1px solid rgba(255, 255, 255, 0.1);
        box-shadow: -5px 0 25px rgba(0,0,0,0.5);
        z-index: 999999;
        transition: right 0.3s ease;
        display: flex;
        flex-direction: column;
        color: #fff;
        font-family: 'Inter', system-ui, -apple-system, sans-serif;
        padding: 20px;
        box-sizing: border-box;
    `;

    overlay.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px;">
            <h3 style="margin: 0; font-size: 18px; font-weight: 600; color: ${customAccentEnabled ? accentColor : '#f50'}; display: flex; align-items: center; gap: 8px;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.1a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
                SClient Settings
            </h3>
            <button id="sclient-close-btn" style="background: none; border: none; color: #aaa; cursor: pointer; font-size: 20px; padding: 5px;">&times;</button>
        </div>
        
        <style>
            #sclient-settings-scroll::-webkit-scrollbar { width: 8px; }
            #sclient-settings-scroll::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); border-radius: 4px; }
            #sclient-settings-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 4px; }
            #sclient-settings-scroll::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.3); }
            #sclient-settings-scroll label { flex-shrink: 0; }
        </style>
        <div id="sclient-settings-scroll" style="flex: 1; overflow-y: auto; overflow-x: hidden; padding-right: 8px; display: flex; flex-direction: column; min-height: 0; margin-bottom: 15px;">
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding: 12px; background: rgba(255,255,255,0.05); border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
            <span style="font-size: 14px; font-weight: 500;">Custom Accent Color</span>
            <div style="display: flex; align-items: center; gap: 10px;">
                <input type="color" id="sclient-accent-color-picker" style="width: 24px; height: 24px; padding: 0; border: none; border-radius: 4px; cursor: pointer; background: transparent;">
                <input type="text" id="sclient-accent-color-text" style="width: 60px; background: rgba(0,0,0,0.5); border: 1px solid #333; color: #fff; border-radius: 4px; padding: 4px; font-family: monospace; font-size: 12px; text-transform: uppercase;">
                <label style="position: relative; display: inline-block; width: 44px; height: 24px;">
                    <input type="checkbox" id="sclient-accent-toggle" style="opacity: 0; width: 0; height: 0;">
                    <span id="sclient-toggle-bg-accent" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #333; transition: .3s; border-radius: 24px;">
                        <span id="sclient-toggle-slider-accent" style="position: absolute; content: ''; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .3s; border-radius: 50%;"></span>
                    </span>
                </label>
            </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding: 12px; background: rgba(255,255,255,0.05); border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
            <span style="font-size: 14px; font-weight: 500;">Fluid Viewport (Wide Mode)</span>
            <label style="position: relative; display: inline-block; width: 44px; height: 24px;">
                <input type="checkbox" id="sclient-fluid-viewport-toggle" style="opacity: 0; width: 0; height: 0;">
                <span id="sclient-toggle-bg-fluid" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #333; transition: .3s; border-radius: 24px;">
                    <span id="sclient-toggle-slider-fluid" style="position: absolute; content: ''; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .3s; border-radius: 50%;"></span>
                </span>
            </label>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding: 12px; background: rgba(255,255,255,0.05); border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
            <span style="font-size: 14px; font-weight: 500;">Enable Discord Rich Presence</span>
            <label style="position: relative; display: inline-block; width: 44px; height: 24px;">
                <input type="checkbox" id="sclient-rpc-toggle" style="opacity: 0; width: 0; height: 0;">
                <span id="sclient-toggle-bg-rpc" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #333; transition: .3s; border-radius: 24px;">
                    <span id="sclient-toggle-slider-rpc" style="position: absolute; content: ''; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .3s; border-radius: 50%;"></span>
                </span>
            </label>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding: 12px; background: rgba(255,255,255,0.05); border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
            <span style="font-size: 14px; font-weight: 500;">Enable System Tray (Minimize to background)</span>
            <label style="position: relative; display: inline-block; width: 44px; height: 24px;">
                <input type="checkbox" id="sclient-tray-toggle" style="opacity: 0; width: 0; height: 0;">
                <span id="sclient-toggle-bg-tray" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #333; transition: .3s; border-radius: 24px;">
                    <span id="sclient-toggle-slider-tray" style="position: absolute; content: ''; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .3s; border-radius: 50%;"></span>
                </span>
            </label>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding: 12px; background: rgba(255,255,255,0.05); border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
            <span style="font-size: 14px; font-weight: 500;">Enable Adblocker (Audio & Banners)</span>
            <label style="position: relative; display: inline-block; width: 44px; height: 24px;">
                <input type="checkbox" id="sclient-adblock-toggle" style="opacity: 0; width: 0; height: 0;">
                <span id="sclient-toggle-bg-adblock" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #333; transition: .3s; border-radius: 24px;">
                    <span id="sclient-toggle-slider-adblock" style="position: absolute; content: ''; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .3s; border-radius: 50%;"></span>
                </span>
            </label>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding: 12px; background: rgba(255,255,255,0.05); border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
            <span style="font-size: 14px; font-weight: 500;">Enable Lazy Scroll Button</span>
            <label style="position: relative; display: inline-block; width: 44px; height: 24px;">
                <input type="checkbox" id="sclient-lazy-scroll-toggle" style="opacity: 0; width: 0; height: 0;">
                <span id="sclient-toggle-bg" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #333; transition: .3s; border-radius: 24px;">
                    <span id="sclient-toggle-slider" style="position: absolute; content: ''; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .3s; border-radius: 50%;"></span>
                </span>
            </label>
        </div>
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding: 12px; background: rgba(255,255,255,0.05); border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
            <span style="font-size: 14px; font-weight: 500;">Disable Window Decorations</span>
            <label style="position: relative; display: inline-block; width: 44px; height: 24px;">
                <input type="checkbox" id="sclient-decorations-toggle" style="opacity: 0; width: 0; height: 0;">
                <span id="sclient-toggle-bg-dec" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #333; transition: .3s; border-radius: 24px;">
                    <span id="sclient-toggle-slider-dec" style="position: absolute; content: ''; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .3s; border-radius: 50%;"></span>
                </span>
            </label>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding: 12px; background: rgba(255,255,255,0.05); border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
            <span style="font-size: 14px; font-weight: 500;">Hide Subscription Upsell</span>
            <label style="position: relative; display: inline-block; width: 44px; height: 24px;">
                <input type="checkbox" id="sclient-upsell-toggle" style="opacity: 0; width: 0; height: 0;">
                <span id="sclient-toggle-bg-upsell" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #333; transition: .3s; border-radius: 24px;">
                    <span id="sclient-toggle-slider-upsell" style="position: absolute; content: ''; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .3s; border-radius: 50%;"></span>
                </span>
            </label>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding: 12px; background: rgba(255,255,255,0.05); border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
            <span style="font-size: 14px; font-weight: 500;">Hide Artist Features</span>
            <label style="position: relative; display: inline-block; width: 44px; height: 24px;">
                <input type="checkbox" id="sclient-artists-toggle" style="opacity: 0; width: 0; height: 0;">
                <span id="sclient-toggle-bg-artists" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #333; transition: .3s; border-radius: 24px;">
                    <span id="sclient-toggle-slider-artists" style="position: absolute; content: ''; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .3s; border-radius: 50%;"></span>
                </span>
            </label>
        </div>

        <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 15px; padding: 12px; background: rgba(255,255,255,0.05); border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 14px; font-weight: 500;">Enable True Shuffle (Fix native shuffle)</span>
                <label style="position: relative; display: inline-block; width: 44px; height: 24px;">
                    <input type="checkbox" id="sclient-trueshuffle-toggle" style="opacity: 0; width: 0; height: 0;">
                    <span id="sclient-toggle-bg-trueshuffle" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #333; transition: .3s; border-radius: 24px;">
                        <span id="sclient-toggle-slider-trueshuffle" style="position: absolute; content: ''; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .3s; border-radius: 50%;"></span>
                    </span>
                </label>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 12px; color: #888;">Engine:</span>
                <select id="sclient-trueshuffle-engine" style="-webkit-appearance: none; appearance: none; background: rgba(0,0,0,0.5) url('data:image/svg+xml;utf8,<svg fill=%22%23ccc%22 height=%2224%22 viewBox=%220 0 24 24%22 width=%2224%22 xmlns=%22http://www.w3.org/2000/svg%22><path d=%22M7 10l5 5 5-5z%22/></svg>') no-repeat right 4px center; padding-right: 28px; border: 1px solid #333; color: white; border-radius: 6px; padding-top: 6px; padding-bottom: 6px; padding-left: 10px; font-family: Inter, sans-serif; font-size: 12px; outline: none; cursor: pointer; transition: border-color 0.2s;">
                    <option value="native" style="background: #1e1e1e; color: white;">Native (song ~1-50 won't be shuffled)</option>
                    <option value="api" style="background: #1e1e1e; color: white;">API (overrides full order in the UI)</option>
                </select>
            </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 15px; padding: 12px; background: rgba(255,255,255,0.05); border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 14px; font-weight: 500;">Bypass Song Region Blocks</span>
                <label style="position: relative; display: inline-block; width: 44px; height: 24px;">
                    <input type="checkbox" id="sclient-regionbypass-toggle" style="opacity: 0; width: 0; height: 0;">
                    <span id="sclient-toggle-bg-regionbypass" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #333; transition: .3s; border-radius: 24px;">
                        <span id="sclient-toggle-slider-regionbypass" style="position: absolute; content: ''; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .3s; border-radius: 50%;"></span>
                    </span>
                </label>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                <span style="font-size: 12px; color: #888; white-space: nowrap; flex-shrink: 0;">Proxy URL:</span>
                <input type="text" id="sclient-proxyurl-input" placeholder="https://example.com/" style="flex: 1; min-width: 0; background: rgba(0,0,0,0.5); border: 1px solid #333; color: white; border-radius: 4px; padding: 4px 8px; font-family: Inter, sans-serif; font-size: 12px; outline: none; transition: border-color 0.2s;">
                <button id="sclient-proxyurl-public-btn" style="flex-shrink: 0; white-space: nowrap; padding: 4px 8px; background: #333; border: 1px solid #444; color: #ccc; border-radius: 4px; font-size: 11px; font-family: Inter, sans-serif; cursor: pointer; transition: background 0.2s;">Use Public</button>
            </div>
            <div style="font-size: 10px; color: #666; margin-top: 2px;">Opening profile may geo-lock some songs</div>
        </div>

        <div style="display: flex; gap: 10px; margin-bottom: 15px;">
            <button id="tab-css" style="flex: 1; padding: 8px; background: ${customAccentEnabled ? accentColor : '#f50'}; border: none; color: white; border-radius: 4px; cursor: pointer; font-weight: 500;">Custom CSS</button>
            <button id="tab-js" style="flex: 1; padding: 8px; background: #333; border: none; color: #ccc; border-radius: 4px; cursor: pointer; font-weight: 500;">Custom JS</button>
        </div>

        <div style="flex: 1 0 400px; min-height: 400px; display: flex; flex-direction: column; margin-bottom: 20px; position: relative; border: 1px solid #333; border-radius: 4px; background: #0c0c0c;">
            <div id="sclient-css-container" style="flex: 1; position: relative; overflow: hidden; display: block;">
                <pre id="sclient-css-highlight" aria-hidden="true" style="margin: 0; position: absolute; top: 0; left: 0; width: 100%; height: 100%; padding: 10px; box-sizing: border-box; font-family: 'Fira Code', Consolas, monospace; font-size: 13px; line-height: 1.5; letter-spacing: normal; word-spacing: normal; tab-size: 4; color: #ccc; pointer-events: none; white-space: pre-wrap; word-wrap: break-word; overflow: hidden;"></pre>
                <textarea id="sclient-css-editor" spellcheck="false" style="margin: 0; position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: transparent; color: transparent; caret-color: #fff; border: none; font-family: 'Fira Code', Consolas, monospace; font-size: 13px; line-height: 1.5; letter-spacing: normal; word-spacing: normal; tab-size: 4; padding: 10px; resize: none; box-sizing: border-box; outline: none; white-space: pre-wrap; word-wrap: break-word;" placeholder="/* Add your custom CSS here */"></textarea>
            </div>
            <div id="sclient-js-container" style="flex: 1; position: relative; overflow: hidden; display: none;">
                <pre id="sclient-js-highlight" aria-hidden="true" style="margin: 0; position: absolute; top: 0; left: 0; width: 100%; height: 100%; padding: 10px; box-sizing: border-box; font-family: 'Fira Code', Consolas, monospace; font-size: 13px; line-height: 1.5; letter-spacing: normal; word-spacing: normal; tab-size: 4; color: #ccc; pointer-events: none; white-space: pre-wrap; word-wrap: break-word; overflow: hidden;"></pre>
                <textarea id="sclient-js-editor" spellcheck="false" style="margin: 0; position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: transparent; color: transparent; caret-color: #fff; border: none; font-family: 'Fira Code', Consolas, monospace; font-size: 13px; line-height: 1.5; letter-spacing: normal; word-spacing: normal; tab-size: 4; padding: 10px; resize: none; box-sizing: border-box; outline: none; white-space: pre-wrap; word-wrap: break-word;" placeholder="// Add your custom JS here"></textarea>
            </div>
        </div>

        <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1); margin-bottom: 20px;">
            <span style="font-size: 16px; font-weight: bold; margin-bottom: 15px; display: block;">Accounts</span>
            <div id="sclient-accounts-list" style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 15px;">
            </div>
            <div style="display: flex; gap: 8px;">
                <input type="text" id="sclient-new-account-name" placeholder="New Profile Name" style="flex: 1; padding: 8px; background: rgba(0,0,0,0.5); border: 1px solid #333; color: white; border-radius: 4px; font-family: monospace;">
                <button id="sclient-add-account-btn" style="padding: 8px 15px; background: #333; border: none; color: white; border-radius: 4px; cursor: pointer; font-weight: bold;">+ Add Account</button>
            </div>
        </div>

        </div>

        <div style="display: flex; gap: 10px; margin-bottom: 10px;">
            <button id="sclient-save-btn" style="flex: 1; padding: 12px; background: ${customAccentEnabled ? accentColor : '#f50'}; border: none; color: white; border-radius: 4px; font-weight: bold; cursor: pointer; transition: background 0.2s;">Save & Apply</button>
        </div>
        <div style="margin-top: 10px; text-align: center; font-size: 11px; color: #666;">
            Press <kbd style="background: #333; padding: 2px 5px; border-radius: 3px; color: #ccc;">Ctrl + I</kbd> to toggle this menu
        </div>
    `;

    document.body.appendChild(overlay);
    void overlay.offsetHeight;

    const tabCss = overlay.querySelector('#tab-css');
    const tabJs = overlay.querySelector('#tab-js');
    const cssEditor = overlay.querySelector('#sclient-css-editor');
    const jsEditor = overlay.querySelector('#sclient-js-editor');
    const cssContainer = overlay.querySelector('#sclient-css-container');
    const jsContainer = overlay.querySelector('#sclient-js-container');
    const cssHighlight = overlay.querySelector('#sclient-css-highlight');
    const jsHighlight = overlay.querySelector('#sclient-js-highlight');

    function highlightCss(text) {
        let tokens = [];
        let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        
        html = html.replace(/(\/\*[\s\S]*?\*\/)/g, (m) => { tokens.push(`<span style="color: #6a9955;">${m}</span>`); return `__TOKEN${tokens.length-1}__`; });
        html = html.replace(/([\.#][a-zA-Z0-9_-]+)(?=[\s\{])/g, (m) => { tokens.push(`<span style="color: #d7ba7d;">${m}</span>`); return `__TOKEN${tokens.length-1}__`; });
        html = html.replace(/([a-zA-Z-]+)\s*(?=:)/g, (m) => { tokens.push(`<span style="color: #9cdcfe;">${m}</span>`); return `__TOKEN${tokens.length-1}__`; });
        html = html.replace(/(:\s*)([^;\}]+)(?=;|\})/g, (m, p1, p2) => { tokens.push(`${p1}<span style="color: #ce9178;">${p2}</span>`); return `__TOKEN${tokens.length-1}__`; });
        
        for (let i = tokens.length - 1; i >= 0; i--) {
            html = html.replace(`__TOKEN${i}__`, tokens[i]);
        }
        
        if (text[text.length - 1] === '\n') html += ' ';
        return html;
    }

    function highlightJs(text) {
        let tokens = [];
        let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        
        html = html.replace(/(\/\/.*)/g, (m) => { tokens.push(`<span style="color: #6a9955;">${m}</span>`); return `__TOKEN${tokens.length-1}__`; });
        html = html.replace(/('.*?'|".*?"|`[\s\S]*?`)/g, (m) => { tokens.push(`<span style="color: #ce9178;">${m}</span>`); return `__TOKEN${tokens.length-1}__`; });
        html = html.replace(/\b(const|let|var|function|return|if|else|for|while|try|catch|async|await|class|new|this|import|export|from|true|false|null|undefined)\b/g, (m) => { tokens.push(`<span style="color: #569cd6;">${m}</span>`); return `__TOKEN${tokens.length-1}__`; });
        html = html.replace(/\b([a-zA-Z0-9_]+)(?=\s*\()/g, (m) => { tokens.push(`<span style="color: #dcdcaa;">${m}</span>`); return `__TOKEN${tokens.length-1}__`; });
        
        for (let i = tokens.length - 1; i >= 0; i--) {
            html = html.replace(`__TOKEN${i}__`, tokens[i]);
        }
        
        if (text[text.length - 1] === '\n') html += ' ';
        return html;
    }

    function updateCssHighlight() { cssHighlight.innerHTML = highlightCss(cssEditor.value); }
    function updateJsHighlight() { jsHighlight.innerHTML = highlightJs(jsEditor.value); }

    cssEditor.addEventListener('input', updateCssHighlight);
    jsEditor.addEventListener('input', updateJsHighlight);
    
    cssEditor.addEventListener('scroll', () => {
        cssHighlight.scrollTop = cssEditor.scrollTop;
        cssHighlight.scrollLeft = cssEditor.scrollLeft;
    });
    jsEditor.addEventListener('scroll', () => {
        jsHighlight.scrollTop = jsEditor.scrollTop;
        jsHighlight.scrollLeft = jsEditor.scrollLeft;
    });

    tabCss.addEventListener('click', () => {
        tabCss.style.background = customAccentEnabled ? accentColor : '#f50';
        tabCss.style.color = 'white';
        tabJs.style.background = '#333';
        tabJs.style.color = '#ccc';
        cssContainer.style.display = 'block';
        jsContainer.style.display = 'none';
    });

    tabJs.addEventListener('click', () => {
        tabJs.style.background = customAccentEnabled ? accentColor : '#f50';
        tabJs.style.color = 'white';
        tabCss.style.background = '#333';
        tabCss.style.color = '#ccc';
        jsContainer.style.display = 'block';
        cssContainer.style.display = 'none';
    });

    cssEditor.value = currentCss;
    jsEditor.value = currentJs;
    updateCssHighlight();
    updateJsHighlight();

    const lazyScrollToggle = overlay.querySelector('#sclient-lazy-scroll-toggle');
    const toggleBg = overlay.querySelector('#sclient-toggle-bg');
    const toggleSlider = overlay.querySelector('#sclient-toggle-slider');

    const decToggle = overlay.querySelector('#sclient-decorations-toggle');
    const decToggleBg = overlay.querySelector('#sclient-toggle-bg-dec');
    const decToggleSlider = overlay.querySelector('#sclient-toggle-slider-dec');

    const accentToggle = overlay.querySelector('#sclient-accent-toggle');
    const accentToggleBg = overlay.querySelector('#sclient-toggle-bg-accent');
    const accentToggleSlider = overlay.querySelector('#sclient-toggle-slider-accent');
    const accentPicker = overlay.querySelector('#sclient-accent-color-picker');
    const accentText = overlay.querySelector('#sclient-accent-color-text');

    const fluidToggle = overlay.querySelector('#sclient-fluid-viewport-toggle');
    const fluidToggleBg = overlay.querySelector('#sclient-toggle-bg-fluid');
    const fluidToggleSlider = overlay.querySelector('#sclient-toggle-slider-fluid');
    
    const adblockToggle = overlay.querySelector('#sclient-adblock-toggle');
    const adblockToggleBg = overlay.querySelector('#sclient-toggle-bg-adblock');
    const adblockToggleSlider = overlay.querySelector('#sclient-toggle-slider-adblock');
    
    const rpcToggle = overlay.querySelector('#sclient-rpc-toggle');
    const rpcToggleBg = overlay.querySelector('#sclient-toggle-bg-rpc');
    const rpcToggleSlider = overlay.querySelector('#sclient-toggle-slider-rpc');

    const trayToggle = overlay.querySelector('#sclient-tray-toggle');
    const trayToggleBg = overlay.querySelector('#sclient-toggle-bg-tray');
    const trayToggleSlider = overlay.querySelector('#sclient-toggle-slider-tray');

    const upsellToggle = overlay.querySelector('#sclient-upsell-toggle');
    const upsellToggleBg = overlay.querySelector('#sclient-toggle-bg-upsell');
    const upsellToggleSlider = overlay.querySelector('#sclient-toggle-slider-upsell');

    const artistsToggle = overlay.querySelector('#sclient-artists-toggle');
    const artistsToggleBg = overlay.querySelector('#sclient-toggle-bg-artists');
    const artistsToggleSlider = overlay.querySelector('#sclient-toggle-slider-artists');

    const trueShuffleToggle = overlay.querySelector('#sclient-trueshuffle-toggle');
    const trueShuffleToggleBg = overlay.querySelector('#sclient-toggle-bg-trueshuffle');
    const trueShuffleToggleSlider = overlay.querySelector('#sclient-toggle-slider-trueshuffle');
    const trueShuffleEngineSelect = overlay.querySelector('#sclient-trueshuffle-engine');
    const regionBypassToggle = overlay.querySelector("#sclient-regionbypass-toggle");
    const proxyUrlInput = overlay.querySelector("#sclient-proxyurl-input");
    const toggleBgRegionBypass = overlay.querySelector("#sclient-toggle-bg-regionbypass");
    const toggleSliderRegionBypass = overlay.querySelector("#sclient-toggle-slider-regionbypass");

    function updateToggleUI(checked) {
        if (checked) {
            toggleBg.style.backgroundColor = customAccentEnabled ? accentColor : '#f50';
            toggleSlider.style.transform = 'translateX(20px)';
        } else {
            toggleBg.style.backgroundColor = '#333';
            toggleSlider.style.transform = 'translateX(0)';
        }
    }

    function updateDecToggleUI(checked) {
        if (checked) {
            decToggleBg.style.backgroundColor = customAccentEnabled ? accentColor : '#f50';
            decToggleSlider.style.transform = 'translateX(20px)';
        } else {
            decToggleBg.style.backgroundColor = '#333';
            decToggleSlider.style.transform = 'translateX(0)';
        }
    }

    function updateRpcToggleUI(enabled) {
        if (enabled) {
            rpcToggleBg.style.backgroundColor = customAccentEnabled ? accentColor : '#f50';
            rpcToggleSlider.style.transform = 'translateX(20px)';
        } else {
            rpcToggleBg.style.backgroundColor = '#333';
            rpcToggleSlider.style.transform = 'translateX(0)';
        }
    }

    function updateTrayToggleUI(enabled) {
        if (enabled) {
            trayToggleBg.style.backgroundColor = customAccentEnabled ? accentColor : '#f50';
            trayToggleSlider.style.transform = 'translateX(20px)';
        } else {
            trayToggleBg.style.backgroundColor = '#333';
            trayToggleSlider.style.transform = 'translateX(0)';
        }
    }

    function updateAdblockToggleUI(checked) {
        if (checked) {
            adblockToggleBg.style.backgroundColor = customAccentEnabled ? accentColor : '#f50';
            adblockToggleSlider.style.transform = 'translateX(20px)';
        } else {
            adblockToggleBg.style.backgroundColor = '#333';
            adblockToggleSlider.style.transform = 'translateX(0)';
        }
    }

    function updateFluidToggleUI(checked) {
        if (checked) {
            fluidToggleBg.style.backgroundColor = customAccentEnabled ? accentColor : '#f50';
            fluidToggleSlider.style.transform = 'translateX(20px)';
        } else {
            fluidToggleBg.style.backgroundColor = '#333';
            fluidToggleSlider.style.transform = 'translateX(0)';
        }
    }

    function updateAccentToggleUI(checked) {
        if (checked) {
            accentToggleBg.style.backgroundColor = customAccentEnabled ? accentColor : '#f50';
            accentToggleSlider.style.transform = 'translateX(20px)';
            accentPicker.style.opacity = '1';
            accentText.style.opacity = '1';
        } else {
            accentToggleBg.style.backgroundColor = '#333';
            accentToggleSlider.style.transform = 'translateX(0)';
            accentPicker.style.opacity = '0.5';
            accentText.style.opacity = '0.5';
        }
    }

    function updateUpsellToggleUI(checked) {
        if (checked) {
            upsellToggleBg.style.backgroundColor = customAccentEnabled ? accentColor : '#f50';
            upsellToggleSlider.style.transform = 'translateX(20px)';
        } else {
            upsellToggleBg.style.backgroundColor = '#333';
            upsellToggleSlider.style.transform = 'translateX(0)';
        }
    }

    function updateArtistsToggleUI(checked) {
        if (checked) {
            artistsToggleBg.style.backgroundColor = customAccentEnabled ? accentColor : '#f50';
            artistsToggleSlider.style.transform = 'translateX(20px)';
        } else {
            artistsToggleBg.style.backgroundColor = '#333';
            artistsToggleSlider.style.transform = 'translateX(0)';
        }
    }
    
    function updateTrueShuffleToggleUI(checked) {
        if (checked) {
            trueShuffleToggleBg.style.backgroundColor = customAccentEnabled ? accentColor : '#f50';
            trueShuffleToggleSlider.style.transform = 'translateX(20px)';
        } else {
            trueShuffleToggleBg.style.backgroundColor = '#333';
            trueShuffleToggleSlider.style.transform = 'translateX(0)';
        }
    }

    function updateRegionBypassToggleUI(checked) {
        if (checked) {
            toggleBgRegionBypass.style.backgroundColor = customAccentEnabled ? accentColor : "#f50";
            toggleSliderRegionBypass.style.transform = "translateX(20px)";
        } else {
            toggleBgRegionBypass.style.backgroundColor = "#333";
            toggleSliderRegionBypass.style.transform = "translateX(0)";
        }
    }

    lazyScrollToggle.checked = lazyScrollEnabled;
    updateToggleUI(lazyScrollEnabled);
    lazyScrollToggle.addEventListener('change', (e) => updateToggleUI(e.target.checked));

    decToggle.checked = hideDecorationsEnabled;
    updateDecToggleUI(hideDecorationsEnabled);
    decToggle.addEventListener('change', (e) => updateDecToggleUI(e.target.checked));

    fluidToggle.checked = fluidViewportEnabled;
    updateFluidToggleUI(fluidViewportEnabled);
    fluidToggle.addEventListener('change', (e) => updateFluidToggleUI(e.target.checked));

    adblockToggle.checked = adblockEnabled;
    updateAdblockToggleUI(adblockEnabled);
    adblockToggle.addEventListener('change', (e) => updateAdblockToggleUI(e.target.checked));

    rpcToggle.checked = discordRpcEnabled;
    updateRpcToggleUI(discordRpcEnabled);
    
    // clear rpc
    rpcToggle.addEventListener('change', (e) => {
        updateRpcToggleUI(e.target.checked);
        if (!e.target.checked) {
            if (true) {
                sendBridgeMsg('update_rpc', { title: '', artist: '', isPlaying: false, artwork: '', timeStart: 0, timeEnd: 0 });
            }
        }
    });
    
    trayToggle.checked = trayIconEnabled;
    updateTrayToggleUI(trayIconEnabled);
    trayToggle.addEventListener('change', (e) => updateTrayToggleUI(e.target.checked));

    upsellToggle.checked = hideUpsellEnabled;
    updateUpsellToggleUI(hideUpsellEnabled);
    upsellToggle.addEventListener('change', (e) => updateUpsellToggleUI(e.target.checked));

    artistsToggle.checked = hideArtistsEnabled;
    updateArtistsToggleUI(hideArtistsEnabled);
    artistsToggle.addEventListener('change', (e) => updateArtistsToggleUI(e.target.checked));
    
    trueShuffleToggle.checked = trueShuffleEnabled;
    updateTrueShuffleToggleUI(trueShuffleEnabled);
    trueShuffleToggle.addEventListener('change', (e) => updateTrueShuffleToggleUI(e.target.checked));
    
    trueShuffleEngineSelect.value = trueShuffleMode;

    regionBypassToggle.checked = regionBypassEnabled;
    proxyUrlInput.value = proxyUrl;
    updateRegionBypassToggleUI(regionBypassEnabled);
    regionBypassToggle.addEventListener('change', (e) => updateRegionBypassToggleUI(e.target.checked));

    accentToggle.checked = customAccentEnabled;
    accentPicker.value = accentColor;
    accentText.value = accentColor;
    updateAccentToggleUI(customAccentEnabled);

    accentToggle.addEventListener('change', (e) => updateAccentToggleUI(e.target.checked));
    accentPicker.addEventListener('input', (e) => { accentText.value = e.target.value; });
    accentText.addEventListener('input', (e) => {
        if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
            accentPicker.value = e.target.value;
        }
    });

    const renderAccounts = () => {
        sendBridgeMsg('get_accounts').then(accounts => {
            sendBridgeMsg('get_active_account').then(active => {
                const list = overlay.querySelector('#sclient-accounts-list');
                list.innerHTML = '';
                accounts.forEach(acc => {
                    const div = document.createElement('div');
                    div.style.display = 'flex';
                    div.style.justifyContent = 'space-between';
                    div.style.alignItems = 'center';
                    div.style.padding = '8px';
                    div.style.background = 'rgba(255,255,255,0.05)';
                    div.style.borderRadius = '4px';
                    
                    const nameSpan = document.createElement('span');
                    nameSpan.innerText = acc;
                    if (acc === active) {
                        nameSpan.style.color = customAccentEnabled ? accentColor : '#f50';
                        nameSpan.style.fontWeight = 'bold';
                        nameSpan.innerText += ' (Active)';
                    }
                    
                    const btnContainer = document.createElement('div');
                    btnContainer.style.display = 'flex';
                    btnContainer.style.gap = '5px';
                    
                    if (acc !== active) {
                        const switchBtn = document.createElement('button');
                        switchBtn.innerText = 'Switch';
                        switchBtn.style.padding = '4px 8px';
                        switchBtn.style.background = '#333';
                        switchBtn.style.color = 'white';
                        switchBtn.style.border = 'none';
                        switchBtn.style.borderRadius = '3px';
                        switchBtn.style.cursor = 'pointer';
                        switchBtn.onclick = () => {
                            sendBridgeMsg('set_active_account', { name: acc }).then(() => {
                                sendBridgeMsg('restart_app');
                            }).catch(e => customAlert("Switch Error: " + e));
                        };
                        btnContainer.appendChild(switchBtn);
                    }
                    
                    if (acc !== 'main' && acc !== active) {
                        const deleteBtn = document.createElement('button');
                        deleteBtn.innerText = 'Delete';
                        deleteBtn.style.padding = '4px 8px';
                        deleteBtn.style.background = '#800';
                        deleteBtn.style.color = 'white';
                        deleteBtn.style.border = 'none';
                        deleteBtn.style.borderRadius = '3px';
                        deleteBtn.style.cursor = 'pointer';
                        deleteBtn.onclick = () => {
                            customConfirm('Delete account ' + acc + '?').then(confirmed => {
                                if (confirmed) {
                                    sendBridgeMsg('delete_account', { name: acc }).then(() => renderAccounts()).catch(e => customAlert("Delete Error: " + e));
                                }
                            });
                        };
                        btnContainer.appendChild(deleteBtn);
                    }

                    if (acc === 'main') {
                        const resetBtn = document.createElement('button');
                        resetBtn.innerText = 'Reset';
                        resetBtn.style.padding = '4px 8px';
                        resetBtn.style.background = '#3a1515';
                        resetBtn.style.color = '#f88';
                        resetBtn.style.border = '1px solid #5a2020';
                        resetBtn.style.borderRadius = '3px';
                        resetBtn.style.cursor = 'pointer';
                        resetBtn.onclick = () => {
                            const isActive = acc === active;
                            const msg = isActive ? 'Clear all cookies and browser data? The app will restart.' : 'Clear all cookies and browser data for main profile?';
                            customConfirm(msg).then(confirmed => {
                                if (confirmed && window.__TAURI__ && window.__TAURI__.core) {
                                    sendBridgeMsg(isActive ? 'clear_data_and_restart' : 'clear_data');
                                }
                            });
                        };
                        btnContainer.appendChild(resetBtn);
                    }
                    
                    div.appendChild(nameSpan);
                    div.appendChild(btnContainer);
                    list.appendChild(div);
                });
            }).catch(e => customAlert("Active Account Error: " + e));
        }).catch(e => customAlert("Get Accounts Error: " + e));
    };
    renderAccounts();
    
    overlay.querySelector('#sclient-add-account-btn').addEventListener('click', () => {
        const input = overlay.querySelector('#sclient-new-account-name');
        const val = input.value.trim().replace(/[^a-zA-Z0-9_-]/g, '');
        if (val) {
            if (true) {
                sendBridgeMsg('create_account', { name: val }).then(() => {
                    input.value = '';
                    renderAccounts();
                }).catch(e => customAlert("Create Account Error: " + e));
            }
        } else {
            customAlert("Invalid account name. Only letters, numbers, hyphens, and underscores are allowed.");
        }
    });

    overlay.querySelector('#sclient-close-btn').addEventListener('click', toggleOverlay);
    
    const publicBtn = overlay.querySelector('#sclient-proxyurl-public-btn');
    if (publicBtn) {
        publicBtn.addEventListener('click', () => {
            overlay.querySelector('#sclient-proxyurl-input').value = 'https://scproxy.vercel.app/';
        });
    }

    overlay.querySelector('#sclient-save-btn').addEventListener('click', () => {
        const newCss = cssEditor.value;
        const newJs = jsEditor.value;
        const newLazyScroll = lazyScrollToggle.checked;
        const newHideDecorations = decToggle.checked;
        const newCustomAccent = accentToggle.checked;
        const newAccentColor = accentText.value;
        const newFluidViewport = fluidToggle.checked;
        const newAdblock = adblockToggle.checked;
        const newDiscordRpc = rpcToggle.checked;
        const newTrayIcon = trayToggle.checked;
        const newHideUpsell = upsellToggle.checked;
        const newHideArtists = artistsToggle.checked;
        const newTrueShuffle = trueShuffleToggle.checked;
        const newTrueShuffleMode = trueShuffleEngineSelect.value;
        const newRegionBypass = document.querySelector('#sclient-regionbypass-toggle').checked;
        const newProxyUrl = document.querySelector('#sclient-proxyurl-input').value;
        
        if (true) {
            sendBridgeMsg('save_custom_files', { css: newCss, js: newJs, lazyScroll: newLazyScroll, hideDecorations: newHideDecorations, customAccent: newCustomAccent, accentColor: newAccentColor, fluidViewport: newFluidViewport, adblock: newAdblock, discordRpc: newDiscordRpc, trayIcon: newTrayIcon, hideUpsell: newHideUpsell, hideArtists: newHideArtists, trueShuffle: newTrueShuffle, trueShuffleMode: newTrueShuffleMode, regionBypass: newRegionBypass, proxyUrl: newProxyUrl })
                .then(() => {
                    window.location.reload();
                })
                .catch((err) => {
                    customAlert('Failed to save to disk: ' + err);
                });
        } else {
            window.location.reload();
        }
    });
}

function toggleOverlay() {
    createOverlay();
    const overlay = document.getElementById('sclient-settings-overlay');
    if (overlay.style.right === '0px') {
        overlay.style.right = '-450px';
    } else {
        const ce = document.getElementById('sclient-css-editor');
        const je = document.getElementById('sclient-js-editor');
        ce.value = currentCss;
        je.value = currentJs;
        
        ce.dispatchEvent(new Event('input'));
        je.dispatchEvent(new Event('input'));

        const lazyToggle = document.getElementById('sclient-lazy-scroll-toggle');
        lazyToggle.checked = lazyScrollEnabled;
        const lazyToggleBg = document.getElementById('sclient-toggle-bg');
        const lazyToggleSlider = document.getElementById('sclient-toggle-slider');
        if (lazyScrollEnabled) {
            lazyToggleBg.style.backgroundColor = customAccentEnabled ? accentColor : '#f50';
            lazyToggleSlider.style.transform = 'translateX(20px)';
        } else {
            lazyToggleBg.style.backgroundColor = '#333';
            lazyToggleSlider.style.transform = 'translateX(0)';
        }

        const decToggleEl = document.getElementById('sclient-decorations-toggle');
        decToggleEl.checked = hideDecorationsEnabled;
        const decToggleBgEl = document.getElementById('sclient-toggle-bg-dec');
        const decToggleSliderEl = document.getElementById('sclient-toggle-slider-dec');
        if (hideDecorationsEnabled) {
            decToggleBgEl.style.backgroundColor = customAccentEnabled ? accentColor : '#f50';
            decToggleSliderEl.style.transform = 'translateX(20px)';
        } else {
            decToggleBgEl.style.backgroundColor = '#333';
            decToggleSliderEl.style.transform = 'translateX(0)';
        }

        const fluidToggleEl = document.getElementById('sclient-fluid-viewport-toggle');
        fluidToggleEl.checked = fluidViewportEnabled;
        const fluidToggleBgEl = document.getElementById('sclient-toggle-bg-fluid');
        const fluidToggleSliderEl = document.getElementById('sclient-toggle-slider-fluid');
        if (fluidViewportEnabled) {
            fluidToggleBgEl.style.backgroundColor = customAccentEnabled ? accentColor : '#f50';
            fluidToggleSliderEl.style.transform = 'translateX(20px)';
        } else {
            fluidToggleBgEl.style.backgroundColor = '#333';
            fluidToggleSliderEl.style.transform = 'translateX(0)';
        }

        const adblockToggleEl = document.getElementById('sclient-adblock-toggle');
        adblockToggleEl.checked = adblockEnabled;
        const adblockToggleBgEl = document.getElementById('sclient-toggle-bg-adblock');
        const adblockToggleSliderEl = document.getElementById('sclient-toggle-slider-adblock');
        if (adblockEnabled) {
            adblockToggleBgEl.style.backgroundColor = customAccentEnabled ? accentColor : '#f50';
            adblockToggleSliderEl.style.transform = 'translateX(20px)';
        } else {
            adblockToggleBgEl.style.backgroundColor = '#333';
            adblockToggleSliderEl.style.transform = 'translateX(0)';
        }

        const rpcToggleEl = document.getElementById('sclient-rpc-toggle');
        rpcToggleEl.checked = discordRpcEnabled;
        const rpcToggleBgEl = document.getElementById('sclient-toggle-bg-rpc');
        const rpcToggleSliderEl = document.getElementById('sclient-toggle-slider-rpc');
        if (discordRpcEnabled) {
            rpcToggleBgEl.style.backgroundColor = customAccentEnabled ? accentColor : '#f50';
            rpcToggleSliderEl.style.transform = 'translateX(20px)';
        } else {
            rpcToggleBgEl.style.backgroundColor = '#333';
            rpcToggleSliderEl.style.transform = 'translateX(0)';
        }

        const accentToggleEl = document.getElementById('sclient-accent-toggle');
        accentToggleEl.checked = customAccentEnabled;
        const accentToggleBgEl = document.getElementById('sclient-toggle-bg-accent');
        const accentToggleSliderEl = document.getElementById('sclient-toggle-slider-accent');
        if (customAccentEnabled) {
            accentToggleBgEl.style.backgroundColor = customAccentEnabled ? accentColor : '#f50';
            accentToggleSliderEl.style.transform = 'translateX(20px)';
        } else {
            accentToggleBgEl.style.backgroundColor = '#333';
            accentToggleSliderEl.style.transform = 'translateX(0)';
        }

        document.getElementById('sclient-accent-color-picker').value = accentColor;
        document.getElementById('sclient-accent-color-text').value = accentColor;

        overlay.style.right = '0px';
    }
}

// toggle on ctrl+i
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        toggleOverlay();
    }
});
