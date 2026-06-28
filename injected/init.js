function injectSClientMenuButton() {
    if (document.getElementById('sclient-settings-btn')) return;

    const targetMenu = document.querySelector('.header__right .header__navMenu');
    if (targetMenu && targetMenu.parentNode) {
        const customNavMenu = document.createElement('ul');
        customNavMenu.className = 'header__navMenu sc-clearfix sc-list-nostyle left';
        customNavMenu.style.marginRight = '10px';

        const listItem = document.createElement('li');

        const button = document.createElement('a');
        button.id = 'sclient-settings-btn';
        button.href = '#';
        button.className = 'header__moreButton';
        button.style.display = 'flex';
        button.style.alignItems = 'center';
        button.style.justifyContent = 'center';
        button.title = 'SClient Settings';
        
        button.innerHTML = `
        <div class="header__moreButtonIcon" style="width: 16px; height: 16px; display: flex; align-items: center; justify-content: center;">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
            <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.06-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.73,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.06,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.43-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.49-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"></path>
            </svg>
        </div>
        `;

        button.addEventListener('click', (e) => {
            e.preventDefault();
            toggleOverlay();
        });

        listItem.appendChild(button);
        customNavMenu.appendChild(listItem);
        targetMenu.parentNode.insertBefore(customNavMenu, targetMenu);
    }
}



if (lazyScrollEnabled) {
    setupLazyScroll();
}

if (customAccentEnabled) {
    applyCustomAccentColor(accentColor);
}

if (fluidViewportEnabled) {
    applyFluidViewport();
}

if (adblockEnabled) {
    applyAdblock();
}

if (hideUpsellEnabled) {
    const style = document.createElement('style');
    style.textContent = '.header__upsellWrapper { display: none !important; }';
    if (document.head) document.head.appendChild(style);
    else document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style));
}

if (hideArtistsEnabled) {
    const style = document.createElement('style');
    style.textContent = '.header__forArtistsButton, .sidebarModule:has(.sidebarModule__webiEmbeddedModule) { display: none !important; }';
    if (document.head) document.head.appendChild(style);
    else document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style));
}

const playerFixStyle = document.createElement('style');
playerFixStyle.textContent = `
    .playControls__soundBadge { width: 40vw !important; min-width: 350px !important; max-width: 550px !important; flex: none !important; }
    .playbackSoundBadge__titleContextContainer { max-width: none !important; flex: 1 !important; overflow: hidden !important; }
    .playbackSoundBadge__actions { flex-shrink: 0 !important; }
`;
if (document.head) {
    document.head.appendChild(playerFixStyle);
} else {
    document.addEventListener('DOMContentLoaded', () => document.head.appendChild(playerFixStyle));
}

if (currentCss) {
    if (document.head) {
        const style = document.createElement('style');
        style.textContent = currentCss;
        style.id = 'sclient-custom-css';
        document.head.appendChild(style);
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            const style = document.createElement('style');
            style.textContent = currentCss;
            style.id = 'sclient-custom-css';
            document.head.appendChild(style);
        });
    }
}

try {
    if (currentJs) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                const script = document.createElement('script');
                script.textContent = currentJs;
                document.body.appendChild(script);
            });
        } else {
            const script = document.createElement('script');
            script.textContent = currentJs;
            document.body.appendChild(script);
        }
    }
} catch (e) {
    console.error('[SClient] Error executing custom JS:', e);
}

// observe dom
const settingsObserver = new MutationObserver(() => {
    injectSClientMenuButton();
    injectDownloadButton();
    injectLyricsButton();
});

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        settingsObserver.observe(document.body, { childList: true, subtree: true });
    });
} else {
    settingsObserver.observe(document.body, { childList: true, subtree: true });
}
