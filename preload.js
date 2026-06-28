const { ipcRenderer, webFrame } = require('electron');

const cfg = ipcRenderer.sendSync('get-proxy-config');

// fake native funcs
const patchToString = `
const _originalToString = Function.prototype.toString;
Function.prototype.toString = function() {
    if (this && this.__native_name) {
        return 'function ' + this.__native_name + '() { [native code] }';
    }
    return _originalToString.call(this);
};
function patchToString(fn, name) {
    Object.defineProperty(fn, 'name', { value: name, configurable: true });
    Object.defineProperty(fn, '__native_name', { value: name, enumerable: false, configurable: false, writable: false });
}
`;

if (cfg.enabled && cfg.url && cfg.url.startsWith('http')) {
    webFrame.executeJavaScript(`(function(){
${patchToString}
window.__SC_FAST_PROXY__=true;
var P='${cfg.url}';
var D=['api-v2.soundcloud.com/resolve','api-v2.soundcloud.com/tracks','api-v2.soundcloud.com/playlists','api-v2.soundcloud.com/media'];

var F=window.fetch;
var newFetch = function(){
    var a=arguments,u=typeof a[0]==='string'?a[0]:(a[0]instanceof URL?a[0].href:(a[0]&&a[0].url||''));
    if(D.some(function(d){return u.indexOf(d)!==-1})){
        console.log('%c[SClient]%c Proxy Intercept: fetch','color:#ff5500; font-weight:bold;','');
        var p=new URL(P);
        p.searchParams.set('url',u);
        if(typeof a[0]==='string'||a[0]instanceof URL)a[0]=p.toString();
        else if(a[0]instanceof Request)a[0]=new Request(p.toString(),a[0]);
    }else if((u.indexOf('api-v2.soundcloud.com')!==-1||u.indexOf('api.soundcloud.com')!==-1)&&!u.includes(P.replace('https://','').split('/')[0])){
        console.log('%c[SClient]%c Proxy Skip: fetch %c'+u.substring(0,120),'color:#ff5500; font-weight:bold;','','color:#aaa');
    }
    return F.apply(this,a);
};
patchToString(newFetch, 'fetch');
window.fetch = newFetch;

var X=XMLHttpRequest.prototype.open;
var newOpen = function(m,u){
    var f=typeof u==='string'?u:(u instanceof URL?u.href:'');
    if(f&&D.some(function(d){return f.indexOf(d)!==-1})){
        console.log('%c[SClient]%c Proxy Intercept: xhr  ','color:#ff5500; font-weight:bold;','');
        var p=new URL(P);
        p.searchParams.set('url',f);
        f=p.toString();
    }else if(f&&(f.indexOf('api-v2.soundcloud.com')!==-1||f.indexOf('api.soundcloud.com')!==-1)&&!f.includes(P.replace('https://','').split('/')[0])){
        console.log('%c[SClient]%c Proxy Skip: xhr   %c'+f.substring(0,120),'color:#ff5500; font-weight:bold;','','color:#aaa');
    }
    arguments[1]=f;
    return X.apply(this,arguments);
};
patchToString(newOpen, 'open');
XMLHttpRequest.prototype.open = newOpen;
})()`);
}

// strip electron ua
const ua = navigator.userAgent;
const chromeVersionMatch = ua.match(/Chrome\/(\d+\.\d+\.\d+\.\d+)/);
const chromeVersion = chromeVersionMatch ? chromeVersionMatch[1] : '120.0.0.0';
const majorVersion = chromeVersion.split('.')[0];

const platformMap = {
    win32: 'Windows',
    darwin: 'macOS',
    linux: 'Linux'
};
const platform = platformMap[process.platform] || 'Linux';

webFrame.executeJavaScript(`
(function() {
    const brands = [
        { brand: 'Google Chrome', version: '${majorVersion}' },
        { brand: 'Chromium', version: '${majorVersion}' },
        { brand: 'Not_A Brand', version: '8' }
    ];
    
    const getHighEntropyValues = function(hints) {
        return Promise.resolve({
            brands: brands,
            mobile: false,
            platform: '${platform}',
            platformVersion: '10.0.0',
            architecture: 'x86',
            model: '',
            bitness: '64'
        });
    };
    
    Object.defineProperty(navigator, 'userAgentData', {
        get: () => ({
            brands: brands,
            mobile: false,
            platform: '${platform}',
            getHighEntropyValues: getHighEntropyValues
        }),
        configurable: true
    });

    Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
        configurable: true
    });
})();
`);

// ipc bridge
window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (event.data && event.data.source === 'sclient-bridge') {
        const { action, cmd, args, callbackId } = event.data;
        if (action === 'invoke') {
            ipcRenderer.invoke(cmd, args)
                .then(result => {
                    window.postMessage({ source: 'sclient-bridge-reply', callbackId, success: true, result }, '*');
                })
                .catch(err => {
                    window.postMessage({ source: 'sclient-bridge-reply', callbackId, success: false, error: err.message }, '*');
                });
        }
    }
});
