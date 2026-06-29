# Project Overview: SClient

This project is a custom Electron-based desktop client for SoundCloud. It acts as a wrapper that injects custom features, UI tweaks, and a native settings menu into the SoundCloud web app.

## Key Files & Code Structure

### 1. Electron Core (Main Process & Preload)
*   **`main.js`**: The main Electron process. Handles window creation, IPC communication (via `sclient-bridge`), downloading files, and reading/writing user configuration files to disk (e.g., `readConfig()`, `writeConfig()`).
*   **`preload.js`**: The preload script. Acts as a bridge between the Node.js environment and the injected web context. It securely exposes IPC methods and populates `window.__SCLIENT_CONFIG__` with user preferences.

### 2. Injected Scripts (`injected/` directory)
These scripts are injected directly into the SoundCloud web page to modify its behavior and appearance.
*   **`injected/core.js`**: Core setup script. Reads configuration flags from `window.__SCLIENT_CONFIG__` and sets up global variables (e.g., `oledDarkModeEnabled`, `fluidViewportEnabled`).
*   **`injected/init.js`**: Main initialization script. This is where features are actually applied to the page (e.g., injecting custom CSS, applying adblock logic, or hiding UI elements).
*   **`injected/settings.js`**: The custom settings overlay (toggled via `Ctrl+I`). Contains the HTML UI for the settings menu, event listeners for toggles, state updates (`updateToggleUI`), and logic to save configurations back to the main process via `sendBridgeMsg('save_custom_files', ...)`.

### 3. Specialized Feature Modules (`injected/`)
*   **`injected/adblock.js`**: Logic for blocking audio/video ads.
*   **`injected/lyrics.js`**: Logic for fetching and displaying lyrics.
*   **`injected/rpc.js`**: Discord Rich Presence integration.
*   **`injected/downloader.js`**: Utilities for downloading tracks.
*   **`injected/shuffle.js`**: "True shuffle" functionality.

