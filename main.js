const { app, BrowserWindow, ipcMain, session, Tray, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { Client, StatusDisplayType } = require('@xhayper/discord-rpc');
const ytdlexec = require('youtube-dl-exec');
let ytdlBin = ytdlexec.constants.YOUTUBE_DL_PATH;
if (ytdlBin.includes('app.asar')) ytdlBin = ytdlBin.replace('app.asar', 'app.asar.unpacked');
const exec = ytdlexec.create(ytdlBin);

const clientId = '1520494903954637072';
let rpc;
let rpcLoginPromise = null;
let tray = null;
let mainWindow = null;
let isQuitting = false;

app.on('before-quit', () => { isQuitting = true; });

app.name = 'sclient';

const configDir = path.join(app.getPath('userData'), 'SClient');
if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
}

function readConfig(name, defaultVal) {
    const p = path.join(configDir, name);
    if (!fs.existsSync(p)) return defaultVal;
    return fs.readFileSync(p, 'utf8');
}
function writeConfig(name, val) {
    const p = path.join(configDir, name);
    fs.writeFileSync(p, val);
}

let adblockEnabled = readConfig('adblock.conf', 'false') === 'true';

const DEFAULT_CSS = ``;
const DEFAULT_JS = ``;

if (!fs.existsSync(path.join(configDir, 'custom.css'))) {
    writeConfig('custom.css', DEFAULT_CSS);
}
if (!fs.existsSync(path.join(configDir, 'custom.js'))) {
    writeConfig('custom.js', DEFAULT_JS);
}

// ipc sync for proxy
ipcMain.on('get-proxy-config', (event) => {
    event.returnValue = {
        enabled: readConfig('region_bypass.conf', 'false') === 'true',
        url: readConfig('proxy_url.conf', '')
    };
});

ipcMain.handle('get_custom_files', () => {
    return {
        css: readConfig('custom.css', ''),
        js: readConfig('custom.js', ''),
        lazy_scroll: readConfig('lazy_scroll.conf', 'false') === 'true',
        hide_decorations: readConfig('hide_decorations.conf', 'false') === 'true',
        custom_accent: readConfig('custom_accent.conf', 'false') === 'true',
        accent_color: readConfig('accent_color.conf', '#FF0000'),
        wide_layout: readConfig('wide_layout.conf', 'false') === 'true',
        oled_dark_mode: readConfig('oled_dark_mode.conf', 'false') === 'true',
        adblock: readConfig('adblock.conf', 'false') === 'true',
        discord_rpc: readConfig('discord_rpc.conf', 'false') === 'true',
        tray_icon: readConfig('tray_icon.conf', 'false') === 'true',
        hide_upsell: readConfig('hide_upsell.conf', 'false') === 'true',
        hide_artists: readConfig('hide_artists.conf', 'false') === 'true',
        true_shuffle: readConfig('true_shuffle.conf', 'false') === 'true',
        true_shuffle_mode: readConfig('true_shuffle_mode.conf', 'native'),
        region_bypass: readConfig('region_bypass.conf', 'false') === 'true',
        proxy_url: readConfig('proxy_url.conf', ''),
        enhanced_header: readConfig('enhanced_header.conf', 'true') === 'true',
        collapsible_sidebar: readConfig('collapsible_sidebar.conf', 'false') === 'true'
    };
});

ipcMain.handle('save_custom_files', (e, args) => {
    writeConfig('custom.css', args.css);
    writeConfig('custom.js', args.js);
    writeConfig('lazy_scroll.conf', args.lazyScroll ? 'true' : 'false');
    writeConfig('hide_decorations.conf', args.hideDecorations ? 'true' : 'false');
    writeConfig('custom_accent.conf', args.customAccent ? 'true' : 'false');
    writeConfig('accent_color.conf', args.accentColor || '#f50');
    writeConfig('wide_layout.conf', args.wideLayout ? 'true' : 'false');
    writeConfig('oled_dark_mode.conf', args.oledDarkMode ? 'true' : 'false');
    adblockEnabled = args.adblock ? true : false;
    writeConfig('adblock.conf', args.adblock ? 'true' : 'false');
    writeConfig('discord_rpc.conf', args.discordRpc ? 'true' : 'false');
    writeConfig('tray_icon.conf', args.trayIcon ? 'true' : 'false');
    writeConfig('hide_upsell.conf', args.hideUpsell ? 'true' : 'false');
    writeConfig('hide_artists.conf', args.hideArtists ? 'true' : 'false');
    writeConfig('true_shuffle.conf', args.true_shuffle || args.trueShuffle ? 'true' : 'false');
    writeConfig('true_shuffle_mode.conf', args.true_shuffle_mode || args.trueShuffleMode || 'native');
    writeConfig('region_bypass.conf', args.regionBypass ? 'true' : 'false');
    writeConfig('proxy_url.conf', args.proxyUrl || '');
    writeConfig('enhanced_header.conf', args.enhancedHeader ? 'true' : 'false');
    writeConfig('collapsible_sidebar.conf', args.collapsibleSidebar ? 'true' : 'false');
});

ipcMain.handle('__internal_fetch_sc_css', async (e, args) => {
    const res = await fetch(args.url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } });
    return await res.text();
});

ipcMain.handle('download_song', async (e, args) => {
    const dlDir = app.getPath('downloads');
    try {
        await exec(args.url, {
            extractAudio: true,
            audioFormat: 'best',
            noProgress: true,
            noWarnings: true,
            paths: dlDir
        });
    } catch (err) {
        if (err.stderr && err.stderr.includes('DRM protected')) {
            throw new Error('This track is DRM protected and cannot be downloaded.');
        } else if (err.stderr) {
            const errorLines = err.stderr.split('\n').filter(line => line.includes('ERROR:'));
            const cleanError = errorLines.length > 0 ? errorLines.join(' | ') : `Unknown youtube-dl error. (${err.stderr})`;
            throw new Error(cleanError);
        } else {
            throw new Error(`Unknown download error occurred: ${err.message || err.toString()}`);
        }
    }
});

ipcMain.handle('update_rpc', async (e, args) => {
    const { title, artist, isPlaying, artwork, timeStart, timeEnd, songUrl } = args;
    
    if (!rpc) {
        rpc = new Client({
            clientId: clientId,
            transport: {
                type: 'ipc'
            }
        });
        
        rpcLoginPromise = rpc.login().catch((err) => {
            console.error("[SClient] RPC Login failed:", err);
            rpc = null;
            rpcLoginPromise = null;
        });
    }
    
    if (rpcLoginPromise) {
        await rpcLoginPromise;
    }
    
    if (!isPlaying || !title) {
        if (rpc && rpc.user) {
            rpc.user.clearActivity().catch(() => {});
        }
        return;
    }
    
    const activity = {
        type: 2,
        statusDisplayType: StatusDisplayType.DETAILS,
        details: title,
        state: artist,
        largeImageKey: artwork || undefined,
        smallImageKey: "icon",
        smallImageText: "SClient | 0.1",
        instance: false
    };

    if (songUrl) {
        activity.buttons = [
            { label: "Listen on SoundCloud", url: songUrl }
        ];
    }
    
    if (timeStart && timeEnd) {
        activity.startTimestamp = Math.floor(timeStart / 1000) * 1000;
        activity.endTimestamp = Math.floor(timeEnd / 1000) * 1000;
    }
    
    if (rpc && rpc.user) {
        rpc.user.setActivity(activity).catch((err) => {
            console.error("[SClient] Failed to set activity:", err);
        });
    }
});

ipcMain.handle('get_active_account', () => readConfig('active_account.conf', 'main'));
ipcMain.handle('set_active_account', (e, args) => writeConfig('active_account.conf', args.name));
ipcMain.handle('get_accounts', () => {
    const partitionsDir = path.join(app.getPath('userData'), 'Partitions');
    if (!fs.existsSync(partitionsDir)) return ['main'];
    const accs = ['main', ...fs.readdirSync(partitionsDir).filter(f => fs.statSync(path.join(partitionsDir, f)).isDirectory())];
    return [...new Set(accs)];
});
ipcMain.handle('create_account', (e, args) => {
    const partitionDir = path.join(app.getPath('userData'), 'Partitions', args.name);
    fs.mkdirSync(partitionDir, { recursive: true });
});
ipcMain.handle('delete_account', (e, args) => {
    const partitionDir = path.join(app.getPath('userData'), 'Partitions', args.name);
    if (fs.existsSync(partitionDir)) fs.rmSync(partitionDir, { recursive: true, force: true });
});
ipcMain.handle('restart_app', () => { 
    app.relaunch({ args: [__dirname] });
    app.exit(0);
});
ipcMain.handle('clear_data', async () => {
    const active_account = readConfig('active_account.conf', 'main');
    const partition = active_account === 'main' ? 'persist:main' : `persist:${active_account}`;
    await session.fromPartition(partition).clearStorageData();
    return 'done';
});
ipcMain.handle('clear_data_and_restart', async () => {
    const active_account = readConfig('active_account.conf', 'main');
    const partition = active_account === 'main' ? 'persist:main' : `persist:${active_account}`;
    await session.fromPartition(partition).clearStorageData();
    app.relaunch({ args: [__dirname] });
    app.exit(0);
});

function createWindow() {
    const hide_decorations = readConfig('hide_decorations.conf', 'false') === 'true';
    const active_account = readConfig('active_account.conf', 'main');
    
    const partition = active_account === 'main' ? 'persist:main' : `persist:${active_account}`;
    const ses = session.fromPartition(partition);

    const adDomains = ['adswizz.com', 'doubleclick.net', '/ads'];
    ses.webRequest.onBeforeRequest((details, callback) => {
        if (adblockEnabled) {
            const url = details.url;
            if (adDomains.some(domain => url.includes(domain))) {
                console.log('[SClient] Blocked ad request (network):', url);
                return callback({ cancel: true });
            }
        }
        callback({ cancel: false });
    });

    // spoof ua
    const defaultUA = ses.getUserAgent();
    const cleanUA = defaultUA
        .replace(/Electron\/\S+\s?/, '')
        .replace(/sclient\/\S+\s?/, '')
        .replace(/SClient\/\S+\s?/, '');
    ses.setUserAgent(cleanUA);
    app.userAgentFallback = cleanUA;

    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        frame: !hide_decorations,
        title: "SClient",
        icon: path.join(__dirname, 'assets', 'tray.png'),
        webPreferences: {
            partition,
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true
        }
    });

    mainWindow.setMenu(null);

    mainWindow.on('page-title-updated', (e) => {
        e.preventDefault();
    });

        mainWindow.webContents.on('before-input-event', (event, input) => {
        if (input.key === 'F12' && input.type === 'keyDown') {
            mainWindow.webContents.toggleDevTools();
            event.preventDefault();
        }
    });
    mainWindow.loadURL('https://soundcloud.com');

    mainWindow.webContents.on('dom-ready', () => {
        const injectedFiles = [
            'core.js',
            'adblock.js',
            'shuffle.js',
            'rpc.js',
            'downloader.js',
            'lyrics.js',
            'settings.js',
            'init.js'
        ];
        let injectedJs = injectedFiles
            .map(file => fs.readFileSync(path.join(__dirname, 'injected', file), 'utf8'))
            .join('\n');
        const config = {
            css: readConfig('custom.css', ''),
            js: readConfig('custom.js', ''),
            lazy_scroll: readConfig('lazy_scroll.conf', 'false') === 'true',
            hide_decorations: readConfig('hide_decorations.conf', 'false') === 'true',
            custom_accent: readConfig('custom_accent.conf', 'false') === 'true',
            accent_color: readConfig('accent_color.conf', '#FF0000'),
            wide_layout: readConfig('wide_layout.conf', 'false') === 'true',
            oled_dark_mode: readConfig('oled_dark_mode.conf', 'false') === 'true',
            adblock: readConfig('adblock.conf', 'false') === 'true',
            discord_rpc: readConfig('discord_rpc.conf', 'false') === 'true',
            tray_icon: readConfig('tray_icon.conf', 'false') === 'true',
            hide_upsell: readConfig('hide_upsell.conf', 'false') === 'true',
            hide_artists: readConfig('hide_artists.conf', 'false') === 'true',
            true_shuffle: readConfig('true_shuffle.conf', 'false') === 'true',
            true_shuffle_mode: readConfig('true_shuffle_mode.conf', 'native'),
            region_bypass: readConfig('region_bypass.conf', 'false') === 'true',
            proxy_url: readConfig('proxy_url.conf', ''),
            enhanced_header: readConfig('enhanced_header.conf', 'true') === 'true',
            collapsible_sidebar: readConfig('collapsible_sidebar.conf', 'false') === 'true'
        };

        // inject config & mock tauri
        injectedJs = injectedJs
            .replace(/window\.__TAURI__/g, '__TAURI__')
            .replace(/window\.__SCLIENT_CONFIG__/g, '__SCLIENT_CONFIG__');

        const wrapperJs = `
(function() {
    const __SCLIENT_CONFIG__ = ${JSON.stringify(config)};
    
    const __TAURI__ = (() => {
        const callbacks = new Map();
        let callbackIdCounter = 0;
        
        window.addEventListener('message', (event) => {
            if (event.source !== window) return;
            if (event.data && event.data.source === 'sclient-bridge-reply') {
                const { callbackId, success, result, error } = event.data;
                const cb = callbacks.get(callbackId);
                if (cb) {
                    callbacks.delete(callbackId);
                    if (success) {
                        cb.resolve(result);
                    } else {
                        cb.reject(new Error(error));
                    }
                }
            }
        });
        
        return {
            core: {
                invoke: (cmd, args) => {
                    return new Promise((resolve, reject) => {
                        const callbackId = callbackIdCounter++;
                        callbacks.set(callbackId, { resolve, reject });
                        window.postMessage({ source: 'sclient-bridge', action: 'invoke', cmd, args, callbackId }, '*');
                    });
                }
            }
        };
    })();

    ${injectedJs}
})();
        `;

        mainWindow.webContents.executeJavaScript(wrapperJs);
    });

    mainWindow.on('close', (e) => {
        const trayEnabled = readConfig('tray_icon.conf', 'false') === 'true';
        if (!isQuitting && trayEnabled && tray) {
            e.preventDefault();
            mainWindow.hide();
        }
    });
}

app.whenReady().then(async () => {
    createWindow();

    const trayEnabled = readConfig('tray_icon.conf', 'false') === 'true';
    if (trayEnabled) {
        try {
            tray = new Tray(path.join(__dirname, 'assets', 'tray.png'));
            const contextMenu = Menu.buildFromTemplate([
                { label: 'Show', click: () => { mainWindow.show(); mainWindow.focus(); } },
                { label: 'Previous', click: () => mainWindow.webContents.executeJavaScript("document.querySelector('.skipControl__previous').click();") },
                { label: 'Pause/Resume', click: () => mainWindow.webContents.executeJavaScript("document.querySelector('.playControl').click();") },
                { label: 'Next', click: () => mainWindow.webContents.executeJavaScript("document.querySelector('.skipControl__next').click();") },
                { label: 'Exit', click: () => { app.quit(); } }
            ]);
            tray.setToolTip('SClient');
            tray.setContextMenu(contextMenu);
            tray.on('click', () => { mainWindow.show(); mainWindow.focus(); });
        } catch (e) {
            console.error("[SClient] Failed to create tray:", e);
        }
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
