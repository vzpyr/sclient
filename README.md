# SClient

A customizable desktop client for SoundCloud, built with Electron.


## Features

SClient adds several enhancements and quality of life features to the standard web player. All settings can be toggled on the fly.

* **Zero Telemetry**: Actively blocks third-party trackers, analytics, and marketing pixels natively using Ghostery. SClient itself also collects absolutely zero data.
* **DRM Support**: Play DRM-protected tracks using proper Widevine DRM out of the box (Castlabs Electron).
* **True Shuffle**: Fixes the default shuffle behavior by loading the entire playlist or using an API-based shuffle engine.
* **Ad Blocker**: Powered by Ghostery's WebAssembly engine (EasyList/EasyPrivacy) to block all audio and banner advertisements directly at the network level.
* **Track Downloader**: Download tracks directly from the player interface.
* **Lyrics Integration**: View lyrics for the currently playing song in a sidebar, including a manual search fallback.
* **Customization**: Inject your own custom CSS and JavaScript or change the global UI accent color.
* **OLED Dark Mode**: A true black dark mode that comprehensively overrides the default theme, perfect for OLED displays.
* **Discord Rich Presence**: Show what you are currently listening to on your Discord profile.
* **ListenBrainz Scrobbling**: Automatically scrobble your playback history directly to ListenBrainz. Securely stores your user token using your operating system's native encrypted keyring (safeStorage).
* **Multi-Account Support**: Create, manage, and switch between multiple isolated profiles.
* **Region Bypass**: Built-in proxy support to bypass geographic track restrictions. You can use the free public proxy (https://scproxy.vercel.app/) or self-host your own using the included `app.js` file.
* **Interface Tweaks**: Options to hide window decorations, enable a wide layout, use a collapsible sidebar, enable an enhanced header (with modern Lucide icons and navigation buttons), add a lazy scroll button, hide subscription upsells and hide artist features.
* **System Tray**: Run the application in the background and control playback from your system tray.

## Installation

You can install SClient by downloading a pre-built binary or by compiling it from source.

### Pre-built Releases

Check the Releases page to download the latest version for your operating system.

Linux:
* DEB
* RPM
* AppImage
* Flatpak

Windows:
* Setup Executable
* Portable Executable

### Build from Source

If you prefer to compile the application yourself, make sure you have Node.js and npm installed on your system.

1. Clone the repository and navigate into the project directory.
2. Install the required dependencies:

   `npm install`

3. Build the application for your operating system:

   Linux: `npm run build:linux`

   Windows: `npm run build:windows`

The compiled binaries will be located in the `dist` directory.

## Usage

* Press Ctrl + I or use the new gear icon in the header to open the settings menu.
* Use the settings menu to configure all features or to manage accounts.
* Access the Lyrics and Download buttons directly from the playback bar.

## License

MIT