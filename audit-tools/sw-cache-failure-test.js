// ⛔ ថ្នាក់កំហុស៖ **service worker បង្វែរការបរាជ័យរបស់ Cache Storage
// ទៅជាការដាច់ App ទាំងស្រុង។**
//
// `event.respondWith(caches.open(...).then(...))` គ្មានផ្លូវសម្រាប់ការ
// **បដិសេធ** ទេ។ `caches.open()` និង `cache.match()` អាចបោះបាន៖
//   - Safari/iOS ៖ `SecurityError` / `UnknownError` ពេល ITF ជម្រះ storage
//     ឬពេលឧបករណ៍ជិតពេញ
//   - Chrome ៖ `QuotaExceededError` ពេលឧបករណ៍ជិតពេញ
//   - គ្រប់ browser ៖ ពេលអ្នកប្រើ «Clear site data» ខណៈ App នៅបើក
//
// ពេលនោះ promise របស់ `respondWith` បដិសេធ ➜ browser រាប់វាជា
// **NetworkError** ➜ **រាល់សំណើធ្លាក់** ➜ អេក្រង់សទទេ ខណៈបណ្តាញដើរធម្មតា
// ហើយអ្នកប្រើ **ដោះមិនរួច** លុះត្រាតែដក service worker ចេញដោយដៃ។
// នេះជាថ្នាក់ធ្ងន់ជាងអ្វីដែល SW នោះមកដោះស្រាយទៅទៀត។
//
// ការកែ៖ ការបរាជ័យរបស់ Cache API ត្រូវធ្លាក់ទៅ `fetch(request)` ធម្មតា
// (ហើយបើបណ្តាញក៏ធ្លាក់ដែរ ➜ `Response.error()` ដែលជាការ **resolve**
// មិនមែន reject) ➜ App នៅដំណើរការដដែលដរាបណាបណ្តាញដើរ។
//
// ⚠️ ឯកសារនេះរត់ **`sw.js` ពិត** ក្នុង `vm` — មិនមែនកូដចម្លងទេ។
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = process.env.SWFAIL_APP_DIR || path.join(__dirname, '..');
const APPS = ['ZoeW', 'ZoeKeyGen', 'ZoeImport'];

let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { pass++; console.log('   ok    ' + label); }
    else { fail++; console.log('   FAIL  ' + label + (detail !== undefined ? '\n         ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : '')); }
}

function makeResponse(status, tag) {
    return { status: status, ok: status >= 200 && status < 300, redirected: false, __tag: tag,
             clone() { return makeResponse(status, tag); } };
}

// `caches` ដែលបរាជ័យតាមរបៀបដែលកំណត់៖
//   'open'   — `caches.open()` បដិសេធ
//   'match'  — `cache.match()` បដិសេធ
//   'inner'  — តែការធ្លាក់ចុះទៅ './index.html' ប៉ុណ្ណោះដែលបដិសេធ
//   null     — ដំណើរការធម្មតា (cache ទទេ ឬមានតាម `seed`)
function buildCaches(mode, seed) {
    const store = new Map(Object.entries(seed || {}));
    const cache = {
        match(key) {
            if (mode === 'match') return Promise.reject(new Error('QuotaExceededError'));
            if (mode === 'inner' && key === './index.html') return Promise.reject(new Error('UnknownError'));
            const k = typeof key === 'string' ? key : key.url;
            return Promise.resolve(store.get(k));
        },
        put(key, res) { store.set(typeof key === 'string' ? key : key.url, res); return Promise.resolve(); },
        add() { return Promise.resolve(); },
        addAll() { return Promise.resolve(); }
    };
    return {
        open() {
            if (mode === 'open') return Promise.reject(new Error('SecurityError'));
            return Promise.resolve(cache);
        },
        match(k) { return cache.match(k); },
        keys() { return Promise.resolve([]); },
        delete() { return Promise.resolve(true); }
    };
}

// ដំណើរការ sw.js ពិត ហើយចាប់យក handler `fetch` របស់វា
function loadSw(app, opts) {
    const src = fs.readFileSync(path.join(ROOT, app, 'sw.js'), 'utf8');
    const listeners = {};
    const netCalls = [];
    const self = {
        location: { href: 'https://example.test/', origin: 'https://example.test' },
        addEventListener: (type, fn) => { listeners[type] = fn; },
        skipWaiting: () => Promise.resolve(),
        clients: { claim: () => Promise.resolve() }
    };
    const ctx = {
        self, URL, Set, Map, Promise, Math, Date, JSON, console,
        setTimeout, clearTimeout, AbortController,
        navigator: { onLine: true },
        caches: buildCaches(opts.cacheMode, opts.seed),
        Response: { error: () => makeResponse(0, 'Response.error') },
        fetch: (req) => {
            netCalls.push(typeof req === 'string' ? req : req.url);
            if (opts.networkDown) return Promise.reject(new TypeError('Failed to fetch'));
            return Promise.resolve(makeResponse(200, 'network'));
        }
    };
    ctx.globalThis = ctx;
    vm.createContext(ctx);
    vm.runInContext(src, ctx, { filename: app + '/sw.js' });
    return { listeners, netCalls, ctx };
}

function dispatchFetch(sw, request) {
    let responded = null;
    const event = {
        request,
        respondWith: (p) => { responded = p; },
        waitUntil: () => {}
    };
    sw.listeners.fetch(event);
    return responded;
}

function req(url, mode) {
    return { url: url, method: 'GET', mode: mode || 'no-cors' };
}

(async () => {
    for (const app of APPS) {
        console.log('\n== ' + app + ' ==');
        const SHELL = 'https://example.test/app.js';

        // ១ — cache បើកមិនបាន + បណ្តាញដើរ ➜ ត្រូវបម្រើពីបណ្តាញ មិនមែនធ្លាក់
        {
            const sw = loadSw(app, { cacheMode: 'open' });
            let res = null, err = null;
            try { res = await dispatchFetch(sw, req(SHELL)); } catch (e) { err = e; }
            ok(app + ' ៖ `caches.open()` បរាជ័យ + បណ្តាញដើរ ➜ នៅតែបម្រើទំព័របាន',
                !err && res && res.status === 200, err ? String(err.message) : JSON.stringify(res));
            ok(app + ' ៖ ការធ្លាក់នោះទៅដល់បណ្តាញពិត',
                sw.netCalls.length >= 1, sw.netCalls);
        }

        // ១ខ — navigate ក៏ត្រូវរួចដែរ (បើអត់ = អេក្រង់សទទេ)
        {
            const sw = loadSw(app, { cacheMode: 'open' });
            let res = null, err = null;
            try { res = await dispatchFetch(sw, req('https://example.test/', 'navigate')); } catch (e) { err = e; }
            ok(app + ' ៖ សំណើ navigate ក៏មិនត្រូវធ្លាក់ដែរ (បើធ្លាក់ = អេក្រង់សទទេ)',
                !err && res && res.status === 200, err ? String(err.message) : JSON.stringify(res));
        }

        // ២ — cache.match() បរាជ័យ ➜ ដដែល
        {
            const sw = loadSw(app, { cacheMode: 'match' });
            let res = null, err = null;
            try { res = await dispatchFetch(sw, req(SHELL)); } catch (e) { err = e; }
            ok(app + ' ៖ `cache.match()` បរាជ័យ ➜ នៅតែបម្រើពីបណ្តាញ',
                !err && res && res.status === 200, err ? String(err.message) : JSON.stringify(res));
        }

        // ៣ — cache បរាជ័យ **និង** បណ្តាញដាច់ ➜ ត្រូវ resolve ជាការឆ្លើយតបកំហុស
        //      មិនមែន **បដិសេធ** promise (ការបដិសេធធ្វើឲ្យ SW ខ្លួនវាក្លាយជាកំហុស)
        {
            const sw = loadSw(app, { cacheMode: 'open', networkDown: true });
            let res = null, err = null;
            try { res = await dispatchFetch(sw, req(SHELL)); } catch (e) { err = e; }
            ok(app + ' ៖ cache បរាជ័យ + ក្រៅបណ្តាញ ➜ resolve ជា Response.error() មិនមែន reject',
                !err && res && res.__tag === 'Response.error', err ? String(err.message) : JSON.stringify(res));
        }

        // ៤ — ការធ្លាក់ចុះទៅសំបកក្នុងផ្លូវ navigate ក៏ត្រូវការការការពារដែរ
        {
            const sw = loadSw(app, { cacheMode: 'inner', networkDown: true });
            let res = null, err = null;
            try { res = await dispatchFetch(sw, req('https://example.test/', 'navigate')); } catch (e) { err = e; }
            ok(app + ' ៖ ការអានសំបកបម្រុងបរាជ័យ ➜ resolve មិនមែន reject',
                !err && res && res.__tag === 'Response.error', err ? String(err.message) : JSON.stringify(res));
        }

        // ៥ — ផ្លូវធម្មតាមិនត្រូវប្រែ៖ សំបកដែល cache ទុក ត្រូវឆ្លើយភ្លាមពី cache
        {
            const cachedShell = makeResponse(200, 'cached');
            const sw = loadSw(app, { cacheMode: null, seed: { [SHELL]: cachedShell } });
            const res = await dispatchFetch(sw, req(SHELL));
            ok(app + ' ៖ ផ្លូវធម្មតាមិនប្រែ — សំបកដែល cache ទុកឆ្លើយពី cache',
                res && res.__tag === 'cached', JSON.stringify(res));
        }
    }

    console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')' : '✅ ជោគជ័យ ' + pass));
    process.exit(fail ? 1 : 0);
})();
