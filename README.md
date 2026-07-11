# SClient

A customizable desktop client for SoundCloud, built with Electron.

## Features

SClient adds several enhancements and quality of life features to the standard web player.

### 🛡️ Privacy & Security

- **Zero Telemetry**: SClient collects absolutely no data and actively blocks SoundCloud's own trackers, analytics, and marketing pixels natively using Ghostery.
- **Adblocker**: Block all audio ads natively using Ghostery's WebAssembly engine.

### 🎧 Playback & Discovery

- **DRM Support**: Play DRM-protected tracks using proper Widevine DRM out of the box (Castlabs Electron).
- **True Shuffle**: Fixes the default shuffle behavior by pre-loading the entire playlist or using an API-based shuffle engine.
- **Region Bypass**: Experimental built-in proxy support to bypass geographic track restrictions. Use the free public proxy (accessible within the app) or self-host your own.
  - **🚀 Usage:** The proxy server code can be found in `api/index.js` and is ready to be deployed.
  - **⚠️ Disclaimer:** Whoever runs the proxy server can (in theory) steal your credentials by intercepting your traffic. You should self-host it for maximum security (e.g. via Vercel).

### 🔌 Integrations & Tools

- **Track Downloader**: Download tracks directly from the player interface using `youtube-dl`, featuring a sleek UI toast with a live download progress bar.
- **Lyrics Integration**: Access lyrics for the current song directly from the playback bar. Includes a dedicated sidebar with manual artist and title search fallbacks.
- **ListenBrainz and Last.fm Scrobbling**: Automatically scrobble your active song. Any sensitive information is securely stored and encrypted using your OS's native keyring (safeStorage).
- **Discord Rich Presence**: Show what you are currently listening to on your Discord profile.
- **Listening Stats & Analytics**: Track your listening history locally with an SQLite database. View detailed analytics with charts for top artists, tracks, genres, and listening hours. You can securely export, import, or merge your local database to seamlessly migrate your data.

### 🎨 Customization & UI Tweaks

- **Mini Player**: Switch to a sleek, compact player window for distraction-free listening. Includes integrated lyrics and a dedicated fullscreen mode.
- **Extensive Interface Tweaks**: Enable a custom background color (Dark Mode), wide layout, collapsible sidebar, and an enhanced header with modern Lucide icons. Add a lazy scroll button, hide window decorations, and disable subscription upsells.
- **Custom Accent Color**: Personalize the entire app interface by choosing a custom accent color using the built-in color picker in the settings menu.
- **Custom Font**: Globally apply any Google Web Font to the entire interface right from the settings.
- **Custom CSS/JS Editor**: Inject your own custom CSS and JavaScript. No need to modify source files, write your code directly in the live, syntax-highlighted editor built right into the settings overlay.
- **Multi-Account Support**: Create, manage, and switch between multiple isolated profiles.
- **System Tray**: Run the application in the background and control playback from your system tray.

### ⚠️ ToS Disclaimer

Please note that some of the features (such as adblocking, track downloading, and region bypassing) may conflict with SoundCloud's ToS. Most likely, nothing will happen, but keep this in mind. Use this application at your own risk.

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

- Press Ctrl + I or use the new gear icon in the header to open the settings menu.
- Use the settings menu to configure all features or to manage accounts.
- Access the Lyrics and Download buttons directly from the playback bar.

## License

MIT
