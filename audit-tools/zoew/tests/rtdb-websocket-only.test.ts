import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { afterEach, expect, it } from 'vitest';

// CSP `script-src` មិនអនុញ្ញាត host database (អ្នកណាក៏បង្កើត project Firebase បាន ➜ JSONP `.lp` ជាផ្លូវរំលង CSP)
// ➜ loader ត្រូវបិទ long-polling (JSONP តាម iframe + script) មុន SDK ភ្ជាប់។ SDK ចាប់ផ្តើមដោយ long-polling ពេល WebSocket
// ធ្លាប់បរាជ័យ (`firebase:previous_websocket_failure` ក្នុង localStorage ៖ ឧ. ទូរស័ព្ទក្រៅបណ្ដាញពេលភ្ជាប់លើកមុន)។ តេស្តនេះរត់
// loader ពិត និង SDK ពិត (build browser · `NODE_CLIENT = false` ដូច build browser របស់ @firebase/util ៖ build node គ្មាន
// long-polling) ហើយរាប់ធាតុ iframe/script ដែល SDK បង្កើត។
const root = path.resolve(__dirname, '../../../ZoeW');
const loaderText = fs.readFileSync(path.join(root, 'public/firebase-loader.js'), 'utf8');
afterEach(() => { localStorage.clear(); });

async function loadSdk() {
    const runnable = loaderText.replace(/import\(BASE \+ '([^']+)'\)/g, (_m, name) => `__zoeImport('${name}')`);
    expect(runnable).not.toBe(loaderText);
    const load = createRequire(__filename);
    load('@firebase/util').CONSTANTS.NODE_CLIENT = false;
    const zoeImport = (name: string) => Promise.resolve(name === 'firebase-app.js' ? load('@firebase/app')
        : name === 'firebase-database.js' ? load(fs.realpathSync(path.join(root, 'node_modules/@firebase/database/dist/index.cjs.js'))) : {});
    const ready = new Promise<void>((resolve) => window.addEventListener('firebasesdkready', () => resolve(), { once: true }));
    new Function('__zoeImport', runnable)(zoeImport);
    await ready;
    return (window as any).firebaseSDK;
}

it('RTDB ៖ loader ពិតបិទ long-polling (JSONP) ➜ គ្មាន iframe/script ទៅ host database ទោះ WebSocket ធ្លាប់បរាជ័យ', async () => {
    const created: string[] = [];
    const original = document.createElement.bind(document);
    document.createElement = ((tag: string, options?: ElementCreationOptions) => {
        if (/^(iframe|script)$/i.test(tag)) created.push(tag.toLowerCase());
        return original(tag, options);
    }) as typeof document.createElement;
    try {
        localStorage.setItem('firebase:previous_websocket_failure', 'true');
        const sdk = await loadSdk();
        expect(typeof sdk.getDatabase).toBe('function');
        const app = sdk.initializeApp({ apiKey: 'k', projectId: 'zoe-csp-probe', databaseURL: 'https://zoe-csp-probe-default-rtdb.firebaseio.com' }, 'csp-probe');
        const db = sdk.getDatabase(app);
        const stop = sdk.onValue(sdk.ref(db, 'probe'), () => {}, () => {});
        await new Promise((resolve) => setTimeout(resolve, 400));
        stop();
        await sdk.deleteApp(app);
        expect(created).toEqual([]);
        expect([...document.querySelectorAll('iframe, script')].map((node) => node.outerHTML)).toEqual([]);
    } finally { document.createElement = original as typeof document.createElement; }
});
