# Project Overview: SClient

This project is a custom Electron-based desktop client for SoundCloud. It acts as a wrapper that injects custom features, UI tweaks, and a native settings menu into the SoundCloud web app.

## Key Files & Code Structure

### 1. Electron Core (Main Process & Preload)
*   **[main.js](file:///home/daniel/Code/sclient/main.js)**: The main Electron process. Handles window creation via [createWindow](file:///home/daniel/Code/sclient/main.js#L291), IPC communication (via `sclient-bridge`), downloading tracks via `youtube-dl-exec`, system tray integration, multi-account profile partition management, and secure configuration storage using Electron's `safeStorage`.
    *   *Configuration handlers*: [readConfig](file:///home/daniel/Code/sclient/main.js#L30) / [writeConfig](file:///home/daniel/Code/sclient/main.js#L35) for standard options, and [readSecureConfig](file:///home/daniel/Code/sclient/main.js#L40) / [writeSecureConfig](file:///home/daniel/Code/sclient/main.js#L55) for encrypted storage (e.g. ListenBrainz tokens).
*   **[preload.js](file:///home/daniel/Code/sclient/preload.js)**: The preload bridge script. Spoofs the User-Agent and client parameters (`navigator.userAgentData`, `navigator.webdriver`) to match a standard web browser. Bypasses geo-restrictions by intercepting and routing SoundCloud API calls through a proxy server (`window.__SC_FAST_PROXY__`) if enabled. Bridges page contexts to Electron main via postMessages.

### 2. Injected Scripts ([injected/](file:///home/daniel/Code/sclient/injected) directory)
These scripts are injected directly into the SoundCloud web page at DOM-ready to modify behavior and styling.
*   **[injected/core.js](file:///home/daniel/Code/sclient/injected/core.js)**: Core setup and utility script. Reads initial configuration variables from `window.__SCLIENT_CONFIG__` and initializes layout/accent features:
    *   [applyCustomAccentColor](file:///home/daniel/Code/sclient/injected/core.js#L149): Rewrites CSS color schemes dynamically to apply custom accents.
    *   [applyWideLayout](file:///home/daniel/Code/sclient/injected/core.js#L241): Enhances layout widths.
    *   [fetchGodModeData](file:///home/daniel/Code/sclient/injected/core.js#L465): Utility to fetch track metadata by obtaining client credentials dynamically from resource timing APIs.
*   **[injected/init.js](file:///home/daniel/Code/sclient/injected/init.js)**: Main entry point/initialization script. Instantiates floating tools, enables lazy scrolling, applies OLED dark mode to the page (and recursively to same-origin iframes), replaces header navigation tabs with modern Lucide icons, and hooks DOM mutation observers to continuously update SClient UI elements.
*   **[injected/settings.js](file:///home/daniel/Code/sclient/injected/settings.js)**: The customizable HTML/CSS settings panel overlay (toggled via `Ctrl+I` or settings gear). Allows managing multi-account profiles, toggling adblocking, tray controls, true shuffle modes, proxy settings, Custom CSS/JS inject fields, and ListenBrainz authentication keys.

### 3. Specialized Feature Modules ([injected/](file:///home/daniel/Code/sclient/injected))
*   **[injected/adblock.js](file:///home/daniel/Code/sclient/injected/adblock.js)**: Implements [applyAdblock](file:///home/daniel/Code/sclient/injected/adblock.js#L1) which intercepts and cancels ad-related tracking/media fetches (`adswizz.com`, `doubleclick.net`, `/ads`) at the browser `fetch` and `XMLHttpRequest` level. Note that Ghostery-based blocking is also run at the session level in the main process.
*   **[injected/lyrics.js](file:///home/daniel/Code/sclient/injected/lyrics.js)**: Embeds a sleek floating lyrics panel on the left side. Fetches lyrics automatically from the LrcLib API with support for manual input fallback.
*   **[injected/rpc.js](file:///home/daniel/Code/sclient/injected/rpc.js)**: Formulates media session state details (title, artist, timeline, album artwork) and posts updates to update Discord Rich Presence via IPC.
*   **[injected/downloader.js](file:///home/daniel/Code/sclient/injected/downloader.js)**: Adds a download button next to the player's queue control. Sends track URLs through the IPC bridge to be processed by `youtube-dl` in the main process.
*   **[injected/shuffle.js](file:///home/daniel/Code/sclient/injected/shuffle.js)**: Overrides SoundCloud's client-side shuffle system with custom shuffling algorithms (preloading lists or using SoundCloud API pagination).
*   **[injected/listenbrainz.js](file:///home/daniel/Code/sclient/injected/listenbrainz.js)**: Listens to the HTML5 media session state and scrobbles played tracks to ListenBrainz once the configured duration threshold is crossed.

### 4. Media & Proxy Utilities
*   **[app.js](file:///home/daniel/Code/sclient/app.js)**: A standalone Serverless-compatible API handler that proxies request calls (headers and URL params) to and from SoundCloud endpoints. Useful as a self-hosted regional bypass proxy.


