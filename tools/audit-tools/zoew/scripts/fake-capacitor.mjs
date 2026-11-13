/**
 * bridge native របស់ Capacitor **ក្លែង** សម្រាប់ការវាស់ក្នុង Chromium ៖ ទម្រង់
 * ដូច `native-bridge.js` ពិតរបស់ Android (`PluginHeaders` · `nativePromise` ·
 * `nativeCallback` · `window.androidBridge`) ➜ `@capacitor/core` និង plugin ពិត
 * ដើរផ្លូវ native ដដែល។ ប្រើដោយ `native-check.mjs` និង `cleanup-rules-check.mjs`។
 *
 * ⛔ function ទាំងនេះត្រូវ **ឯករាជ្យ** (គ្មានអថេរខាងក្រៅ) ៖ វាត្រូវបម្លែងជាអត្ថបទ
 *    ហើយចាក់ចូលទំព័រតាម `addInitScript` **មុន** script ណាមួយរបស់ App។
 */
export const FAKE_BRIDGE = function () {
    const calls = (window.__nativeCalls = []);
    const listeners = (window.__nativeListeners = {});
    let nextId = 1;
    const header = (name, promise) => ({
        name,
        methods: [...promise.map((m) => ({ name: m, rtype: 'promise' })), { name: 'addListener', rtype: 'callback' }]
    });
    window.androidBridge = { postMessage() {} };
    window.Capacitor = {
        PluginHeaders: [
            header('App', ['removeListener', 'minimizeApp', 'exitApp', 'getInfo', 'getState']),
            header('SystemBars', ['setStyle', 'show', 'hide', 'removeListener']),
            header('SplashScreen', ['hide', 'show', 'removeListener']),
            header('Filesystem', ['writeFile', 'removeListener']),
            header('Share', ['share', 'canShare', 'removeListener']),
            header('Printer', ['printWebView', 'removeListener']),
            header('NativeBiometric', ['isAvailable', 'setCredentials', 'getSecureCredentials', 'deleteCredentials', 'removeListener']),
            header('Haptics', ['impact', 'notification', 'vibrate', 'selectionStart', 'selectionChanged', 'selectionEnd', 'removeListener'])
        ],
        isNativePlatform: () => true,
        getPlatform: () => 'android',
        nativePromise(plugin, method, options) {
            calls.push({ plugin, method, options: JSON.parse(JSON.stringify(options || {})) });
            if (method === 'removeListener') {
                const key = plugin + ':' + options.eventName;
                listeners[key] = (listeners[key] || []).filter((l) => l.id !== options.callbackId);
                return Promise.resolve();
            }
            const answer = window.__nativeRespond ? window.__nativeRespond(plugin, method, options) : undefined;
            if (answer && answer.__reject) {
                const err = new Error(answer.message || 'rejected');
                err.code = answer.code;
                return Promise.reject(err);
            }
            return Promise.resolve(answer === undefined ? {} : answer);
        },
        nativeCallback(plugin, method, options, callback) {
            calls.push({ plugin, method, options: JSON.parse(JSON.stringify(options || {})) });
            if (method !== 'addListener') return '';
            const id = String(nextId++);
            const key = plugin + ':' + options.eventName;
            (listeners[key] = listeners[key] || []).push({ id, callback });
            return id;
        }
    };
    window.__fireNative = (plugin, event, data) => {
        const list = listeners[plugin + ':' + event] || [];
        list.forEach((l) => l.callback(data || {}));
        return list.length;
    };
};

export const RESPOND_DEFAULT = function () {
    window.__nativeRespond = (plugin, method) => {
        if (plugin === 'NativeBiometric' && method === 'isAvailable') return { isAvailable: true };
        if (plugin === 'Filesystem' && method === 'writeFile') return { uri: 'file:///data/user/0/com.zoesystem.zoew/cache/exports/x' };
        if (plugin === 'Printer' && method === 'printWebView') return {};
        return undefined;
    };
};
