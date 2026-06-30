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
        <div class="header__moreButtonIcon" style="width: 22px; height: 22px; display: flex; align-items: center; justify-content: center;">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-settings-icon lucide-settings"><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/></svg>
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

// REVERTED to vanilla



if (lazyScrollEnabled) {
    setupLazyScroll();
}

if (customAccentEnabled) {
    applyCustomAccentColor(accentColor);
}

if (typeof wideLayoutEnabled !== 'undefined' && wideLayoutEnabled) {
    applyWideLayout();
}
if (typeof collapsibleSidebarEnabled !== 'undefined' && collapsibleSidebarEnabled) {
    applyCollapsibleSidebar();
}
// Always apply layout and floating button styles
applyLayoutFixes();
injectFloatingButtonStyles();

if (oledDarkModeEnabled) {
    const oledStyle = document.createElement('style');
    oledStyle.id = 'sclient-oled-dark-mode';
    oledStyle.textContent = `
        .theme-dark {
          --background-surface-color: #000000 !important;
          --button-secondary-background-color: #000000 !important;
          --button-secondary-selected-background-color: #000000 !important;
          --highlight-color: #000000 !important;
          --surface-color: #000000 !important;
        }
        
        /* High specificity target for the artist tools container */
        .theme-dark div.MuiBox-root.mui-1i9nq8r {
          background-color: #000000 !important;
        }
        
        /* Aggressively override the MUI background variable everywhere but ONLY in dark mode */
        .theme-dark, .theme-dark *, .theme-dark body, .theme-dark html {
          --mui-palette-background-default: #000000 !important;
        }
    `;
    if (document.head) document.head.appendChild(oledStyle);
    else document.addEventListener('DOMContentLoaded', () => document.head.appendChild(oledStyle));

    // Also inject into any same-origin iframes (like artist tools or the new player iframe)
    setInterval(() => {
        document.querySelectorAll('iframe').forEach(iframe => {
            try {
                if (iframe.contentDocument && iframe.contentDocument.head) {
                    if (!iframe.contentDocument.getElementById('sclient-oled-dark-mode')) {
                        iframe.contentDocument.head.appendChild(oledStyle.cloneNode(true));
                    }
                    
                    // The new player iframe might not use the .theme-dark class internally, 
                    // or it defines MUI variables directly on :root. Force the variables here.
                    if (!iframe.contentDocument.getElementById('sclient-oled-iframe-force')) {
                        const isMainPageDark = document.body && document.body.classList.contains('theme-dark');
                        const isIframeDark = iframe.src && iframe.src.includes('theme=dark');
                        
                        const forceStyle = document.createElement('style');
                        forceStyle.id = 'sclient-oled-iframe-force';
                        forceStyle.textContent = `
                            :root, html, body {
                                --mui-palette-background-default: #000000 !important;
                                --background-surface-color: #000000 !important;
                                --button-secondary-background-color: #000000 !important;
                                --button-secondary-selected-background-color: #000000 !important;
                                --highlight-color: #000000 !important;
                                --surface-color: #000000 !important;
                            }
                        `;
                        // Only enable the forced styles if we are actually in dark mode
                        forceStyle.disabled = !(isMainPageDark || isIframeDark);
                        iframe.contentDocument.head.appendChild(forceStyle);
                    } else {
                        // Keep synced if user toggles the main page theme dynamically
                        const forceStyle = iframe.contentDocument.getElementById('sclient-oled-iframe-force');
                        const isMainPageDark = document.body && document.body.classList.contains('theme-dark');
                        forceStyle.disabled = !isMainPageDark;
                    }
                }
            } catch (e) {
                // Cross-origin iframe, ignore
            }
        });
    }, 1000);
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

// Spacing and reordering style
const safeReorderStyle = document.createElement('style');
safeReorderStyle.textContent = `
    .header__right {
        display: flex !important;
        align-items: center !important;
    }
    .header__userNav {
        display: contents !important;
    }
    .header__upsellWrapper {
        order: 1 !important;
    }
    .header__forArtistsButton {
        order: 2 !important;
        margin-right: 0 !important;
    }
    .header__soundInput {
        order: 3 !important;
    }
    .uploadButton {
        margin-right: 0 !important;
    }
    .header__userNavActivitiesButton {
        order: 4 !important;
    }
    .header__userNavMessagesButton {
        order: 5 !important;
    }
    .header__right > ul:has(#sclient-settings-btn) {
        order: 6 !important;
        margin-right: 0 !important;
    }
    .header__userNavUsernameButton {
        order: 7 !important;
        margin-left: 8px !important;
        margin-right: 8px !important;
        display: flex !important;
        align-items: center !important;
    }
    .header__right > ul:has(.header__moreButton:not(#sclient-settings-btn)) {
        order: 8 !important;
    }
    .headerSearch__input {
        border-radius: 50px !important;
    }
    .header__search .headerSearch {
        margin: 0 8px !important;
    }
    

`;
if (typeof enhancedHeaderEnabled !== 'undefined' && enhancedHeaderEnabled) {
    if (document.head) {
        document.head.appendChild(safeReorderStyle);
    } else {
        document.addEventListener('DOMContentLoaded', () => document.head.appendChild(safeReorderStyle));
    }
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

function injectSidebarToggle() {
    if (document.getElementById('sclient-sidebar-toggle')) return;
    
    const btn = document.createElement('button');
    btn.id = 'sclient-sidebar-toggle';
    btn.className = 'sclient-floating-btn';
    btn.title = "Toggle Sidebar";
    btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-panel-right-open-icon lucide-panel-right-open"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 3v18"/><path d="m10 15-3-3 3-3"/></svg>`;
    
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        document.body.classList.toggle('sclient-sidebar-open');
        const isOpen = document.body.classList.contains('sclient-sidebar-open');
        btn.classList.toggle('active', isOpen);
        btn.style.right = isOpen ? '360px' : '20px';
        btn.innerHTML = isOpen ? 
            `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-panel-right-close-icon lucide-panel-right-close"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 3v18"/><path d="m8 9 3 3-3 3"/></svg>` : 
            `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-panel-right-open-icon lucide-panel-right-open"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M15 3v18"/><path d="m10 15-3-3 3-3"/></svg>`;
    });

    document.body.appendChild(btn);
}

function replaceNavTabsWithIcons() {
    function safeReplaceSvg(container, svgHtml) {
        if (!container || container.querySelector('.sclient-svg-container')) return;
        
        // Hide native SVGs without removing them from DOM
        const nativeSvgs = container.querySelectorAll('svg');
        nativeSvgs.forEach(svg => {
            svg.style.display = 'none';
        });

        // Hide text nodes securely and collapse their physical dimensions
        container.style.fontSize = '0';
        container.style.lineHeight = '0';
        
        // Force the container to wrap the new SVG tightly
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        container.style.justifyContent = 'center';

        const customIcon = document.createElement('div');
        customIcon.className = 'sclient-svg-container';
        customIcon.style.display = 'flex';
        customIcon.style.alignItems = 'center';
        customIcon.style.justifyContent = 'center';
        customIcon.innerHTML = svgHtml;
        
        container.appendChild(customIcon);
    }

    const homeTab = document.querySelector('a[data-menu-name="home"]');
    if (homeTab) {
        safeReplaceSvg(homeTab, '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-house-icon lucide-house"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>');
        homeTab.title = "Home";
    }

    const streamTab = document.querySelector('a[data-menu-name="stream"]');
    if (streamTab) {
        safeReplaceSvg(streamTab, '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-rss-icon lucide-rss"><path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1"/></svg>');
        streamTab.title = "Feed";
    }

    const libraryTab = document.querySelector('a[data-menu-name="library"]');
    if (libraryTab) {
        safeReplaceSvg(libraryTab, '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-library-icon lucide-library"><path d="m16 6 4 14"/><path d="M12 6v14"/><path d="M8 8v12"/><path d="M4 4v16"/></svg>');
        libraryTab.title = "Library";
    }

    const notificationBtn = document.querySelector('.header__userNavActivitiesButton .notificationIcon > div:first-child');
    if (notificationBtn) {
        safeReplaceSvg(notificationBtn, '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-bell-icon lucide-bell"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>');
        notificationBtn.title = "Notifications";
    }

    const messageBtn = document.querySelector('.header__userNavMessagesButton .notificationIcon > div:first-child');
    if (messageBtn) {
        safeReplaceSvg(messageBtn, '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-mail-icon lucide-mail"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>');
        messageBtn.title = "Messages";
    }

    const userChevron = document.querySelector('.header__userNavUsernameButtonIcon > div:first-child');
    if (userChevron) {
        safeReplaceSvg(userChevron, '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-down-icon lucide-chevron-down"><path d="m6 9 6 6 6-6"/></svg>');
    }

    const moreContainer = document.querySelector('a.header__moreButton:not(#sclient-settings-btn) .header__moreButtonIcon > div:first-child');
    if (moreContainer) {
        safeReplaceSvg(moreContainer, '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-ellipsis-icon lucide-ellipsis"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>');
    }

    const uploadTitle = document.querySelector('.uploadButton__title');
    if (uploadTitle) {
        safeReplaceSvg(uploadTitle, '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-upload-icon lucide-upload"><path d="M12 3v12"/><path d="m17 8-5-5-5 5"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/></svg>');
        const uploadBtn = document.querySelector('.uploadButton');
        if (uploadBtn) uploadBtn.title = "Upload";
    }

    const artistStudioBtn = document.querySelector('.header__forArtistsButton');
    if (artistStudioBtn) {
        safeReplaceSvg(artistStudioBtn, '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-keyboard-music-icon lucide-keyboard-music"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="M6 8h4"/><path d="M14 8h.01"/><path d="M18 8h.01"/><path d="M2 12h20"/><path d="M6 12v4"/><path d="M10 12v4"/><path d="M14 12v4"/><path d="M18 12v4"/></svg>');
        artistStudioBtn.title = "Artist Studio";
    }
}

function injectNavigationButtons() {
    if (document.getElementById('sclient-nav-back-btn')) return;

    const navMenu = document.querySelector('.header__navMenu');
    if (navMenu && navMenu.firstChild) {
        const backLi = document.createElement('li');
        const backBtn = document.createElement('a');
        backBtn.id = 'sclient-nav-back-btn';
        backBtn.className = 'header__navMenuItem sc-mr-1x';
        backBtn.title = 'Back';
        backBtn.style.cssText = 'font-size: 0px; line-height: 0; display: flex; align-items: center; justify-content: center; cursor: pointer; height: 46px; width: 30px; padding: 0;';
        backBtn.innerHTML = `<div class="sclient-svg-container" style="display: flex; align-items: center; justify-content: center; height: 100%; width: 100%;"><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-left-icon lucide-chevron-left"><path d="m15 18-6-6 6-6"/></svg></div>`;
        backBtn.addEventListener('click', (e) => { e.preventDefault(); window.history.back(); });
        backLi.appendChild(backBtn);

        const fwdLi = document.createElement('li');
        const fwdBtn = document.createElement('a');
        fwdBtn.id = 'sclient-nav-fwd-btn';
        fwdBtn.className = 'header__navMenuItem';
        fwdBtn.title = 'Forward';
        fwdBtn.style.cssText = 'font-size: 0px; line-height: 0; display: flex; align-items: center; justify-content: center; cursor: pointer; height: 46px; width: 30px; padding: 0; margin-right: 10px;';
        fwdBtn.innerHTML = `<div class="sclient-svg-container" style="display: flex; align-items: center; justify-content: center; height: 100%; width: 100%;"><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-right-icon lucide-chevron-right"><path d="m9 18 6-6-6-6"/></svg></div>`;
        fwdBtn.addEventListener('click', (e) => { e.preventDefault(); window.history.forward(); });
        fwdLi.appendChild(fwdBtn);

        navMenu.insertBefore(fwdLi, navMenu.firstChild);
        navMenu.insertBefore(backLi, navMenu.firstChild);
    }
}

// observe dom
const settingsObserver = new MutationObserver(() => {
    injectSClientMenuButton();
    try { if (typeof injectDownloadButton === 'function') injectDownloadButton(); } catch(e) {}
    try { if (typeof injectLyricsButton === 'function') injectLyricsButton(); } catch(e) {}
    if (typeof enhancedHeaderEnabled !== 'undefined' && enhancedHeaderEnabled) {
        replaceNavTabsWithIcons();
        injectNavigationButtons();
    }
    if (typeof collapsibleSidebarEnabled !== 'undefined' && collapsibleSidebarEnabled) {
        injectSidebarToggle();
    }
});

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        settingsObserver.observe(document.body, { childList: true, subtree: true });
    });
} else {
    settingsObserver.observe(document.body, { childList: true, subtree: true });
}
