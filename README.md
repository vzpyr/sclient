# SClient

Customizable cross-platform desktop client for SoundCloud

## Features

SClient adds several enhancements and quality of life features to the standard web player.

### 🛡️ Privacy & Security

- **Zero Telemetry**: SClient collects absolutely no data.
- **Adblocker**: Ads, trackers and telemetry can be blocked natively (using Ghostery).

### 🎧 Playback & Discovery

- **DRM Support**: DRM-protected tracks can be played using proper Widevine DRM out of the box (Castlabs Electron, works on both Linux and Windows).
- **Region Bypass**: Experimental built-in proxy support to bypass geographic track restrictions. Use the free public proxy (accessible within the app) or self-host your own.
  - **🚀 Usage:** The proxy server code can be found in `api/index.js` and is ready to be deployed (also contains /redirect path).
  - **⚠️ Disclaimer:** Whoever runs the proxy server can (in theory) steal your credentials by intercepting your traffic. You should self-host it for maximum security (e.g. via Vercel, US).
- **True Shuffle**: Fixes the default shuffle behavior (by 1. pre-loading the entire playlist or 2. shuffling at API level, experimental).

### 🔌 Integrations & Tools

- **Playlist Manager**: Manage (import, export, re-order etc.) your playlists in a custom, dedicated overlay.
- **Track Downloader**: Download tracks directly from the player interface using `youtube-dl`.
- **Lyrics Integration**: Access synced lyrics in a sidebar (or mini player) for the current song directly from the playback bar (provided by `lrcmux.dev`).
- **ListenBrainz and Last.fm Scrobbling**: Automatically scrobble your active song. Sensitive information is securely stored using safeStorage.
- **Discord Rich Presence**: Share what you are currently listening to on Discord.
- **Listening Stats & Analytics**: Track your listening history locally and view detailed analytics (also allows importing, exporting and merging DB's).

### 🎨 Customization & UI Tweaks

- **Mini Player**: Access a compact player window for distraction-free listening, with integrated lyrics and a dedicated fullscreen mode.
- **Extensive UI Customization**: Personalize the interface layout, colors, typography, and navigation elements, while hiding clutter and unnecessary prompts.
- **Custom CSS/JS Editor**: Inject your own custom CSS and JavaScript by writing code directly into a textbox.
- **Multi-Account Support**: Manage (create, switch, delete) multiple isolated profiles.
- **System Tray**: Let SClient run in the background.

### ⚠️ ToS Disclaimer

Note that some of the features (Adblocker, Track Downloader, Proxying etc.) may conflict with SoundCloud's ToS. Most likely, nothing will happen, but keep this in mind.

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
- Windows: `npm run build:win` (see Windows DRM section below before building)

All compiled binaries will go to the `dist` directory.

### Windows DRM (Widevine VMP)

Windows enforces VMP (Verified Media Path) for Widevine DRM, which requires a production signature on the executable. This is handled automatically during `npm run build:win` via the `afterSign` hook.

**One-time setup:**

1. `python3 -m pip install castlabs-evs`
2. `python3 -m castlabs_evs.account signup`
3. `npm run vmp:sign` (re-run after `npm install` updates the electron binary)

## Usage

- Press Ctrl + I or use the new gear icon in the header to open the settings menu.
- Use the settings menu to configure all features or to manage accounts.
- Access the Lyrics and Download buttons directly from the playback bar.

## License

MIT
