# SClient

A customizable desktop client for SoundCloud, built with Electron.

## Features

SClient adds several enhancements and quality of life features to the standard web player.

### 🛡️ Privacy & Security
* **Zero Telemetry**: SClient collects absolutely no data and actively blocks SoundCloud's own trackers, analytics, and marketing pixels natively using Ghostery.
* **Adblocker**: Block all audio ads natively using Ghostery's WebAssembly engine.

### 🎧 Playback & Discovery
* **DRM Support**: Play DRM-protected tracks using proper Widevine DRM out of the box (Castlabs Electron).
* **True Shuffle**: Fixes the default shuffle behavior by pre-loading the entire playlist or using an API-based shuffle engine.
* **Region Bypass**: Experimental built-in proxy support to bypass geographic track restrictions. Use the free public proxy (accessible within the app) or self-host your own (app.js).

### 🔌 Integrations & Tools
* **Track Downloader**: Download tracks directly from the player interface using `youtube-dl`.
* **ListenBrainz and Last.fm Scrobbling**: Automatically scrobble your active song. Any sensitive information is securely stored and encrypted using your OS's native keyring (safeStorage).
* **Discord Rich Presence**: Show what you are currently listening to on your Discord profile.
* **Lyrics Integration**: View lyrics for the currently playing song in a sleek sidebar (with a manual search fallback).

### 🎨 Customization & UI Tweaks
* **Extensive Interface Tweaks**: Enable a true black OLED dark mode, wide layout, collapsible sidebar, and an enhanced header with modern Lucide icons. Add a lazy scroll button, hide window decorations, and disable subscription upsells.
* **Custom CSS/JS**: Fully inject your own custom CSS and JavaScript.
* **Multi-Account Support**: Create, manage, and switch between multiple isolated profiles.
* **System Tray**: Run the application in the background and control playback from your system tray.

## Installation

You can install SClient by downloading a pre-built binary or by compiling it from source.

### Pre-built Releases

Check the Releases page to download the latest version for your operating system.

- Linux: .deb, .rpm, .AppImage, .flatpak
- Windows: .exe (Setup), .exe (Portable)

### Build from Source

Requirements: Node.js and npm installed on your system.

1. Clone this repository and navigate into the project directory.
2. Install the required dependencies:
- `npm install`

3. Build the application for your operating system:
- Linux: `npm run build:linux`
- Windows: `npm run build:windows`

All compiled binaries will go to the `dist` directory.

## Usage

* Press Ctrl + I or use the new gear icon in the header to open the settings menu.
* Use the settings menu to configure all features or to manage accounts.
* Access the Lyrics and Download buttons directly from the playback bar.

## License

MIT
