// ⛔ ថ្នាក់កំហុស៖ **ការរង់ចាំដែលគ្មានពិដាន ➜ App ជាប់ស្ងាត់ៗ។**
//
// នេះជាថ្នាក់ដាច់ដោយឡែកពី «បណ្តាញធ្លាក់» ៖ បណ្តាញដែល **ភ្ជាប់តែស្លាប់**
// (captive portal · តំបន់សេវាអន់ · proxy ដែលទទួល TCP រួចស្ងាត់) មិនបោះ
// កំហុសទេ — វា **ព្យួរ**។ រាល់ការរង់ចាំដែលគ្មាន `AbortController` ឬ
// timer នៅចុងសង្វាក់នោះ ក្លាយជាការរង់ចាំ **អស់កល្ប**។
//
// ២ រន្ធពិតដែលឯកសារនេះចាក់សោ ៖
//
// ១. **`sw.js` ៖ `fetch(request)` សម្រាប់សំណើដែល cache មិនមាន គ្មានពិដាន។**
//    `event.respondWith(p)` ដែល `p` មិនដែល settle ➜ browser រង់ចាំធនធាន
//    នោះ **អស់កល្ប** ដោយគ្មានកំហុស គ្មាន timeout គ្មានអ្វីសោះ។
//    ⚠️ `sw-cache-failure-test.js` សួរថា «បើ cache **បរាជ័យ** មានអ្វីកើតឡើង?»
//    ហើយ `sw-shell-latency-test.js` សួរថា «សំបកដែល cache ទុក ឆ្លើយលឿនទេ?» —
//    **គ្មានមួយណាសួរថា «បើបណ្តាញ *ព្យួរ* លើធនធានដែល cache **មិន**មាន?»** ទេ។
//    នេះជាសំណួរទី ៨ ៖ «តើ checker ដាក់ប្រព័ន្ធក្នុង *ស្ថានភាព* ណា មុនអះអាង?»
//    — ពួកវាទាំងអស់ដាក់ `fetch` ដែល **ឆ្លើយ ឬបដិសេធ** មិនដែលដាក់ `fetch`
//    ដែល **ព្យួរ** សោះ។
//
// ២. **`loadScriptOnce()` គ្មានពិដាន ហើយ memoize ការរង់ចាំនោះ។**
//    `<script>` ដែល browser មិនដែលឆ្លើយ បាញ់ **ទាំង `onload` ទាំង `onerror`
//    មិនកើត** ➜ promise ព្យួរ ➜ «Export Excel» និង «នាំចូល Excel ➜ រើសឯកសារ»
//    ជាប់ជារៀងរហូត។ ហើយព្រោះលទ្ធផលត្រូវ memoize ក្នុង `loadedScriptPromises`
//    នោះ **ការសាកម្តងទៀតក្នុងវគ្គដដែល ក៏ជាប់ដែរ** — អ្នកប្រើដោះមិនរួច
//    លុះត្រាតែបិទបើក App។ (`csp-lazy-resource-test.js` វាស់តែផ្លូវ
//    **បដិសេធ** ៖ CSP ទប់ ➜ `onerror` បាញ់ ➜ សារពិតលេច។)
//
// ⚠️ ឯកសារនេះរត់ **`sw.js` ពិត** ក្នុង `vm` និង **`loadScriptOnce()` ពិត**
// ដែលស្រង់ចេញពី `app.js` — មិនមែនកូដចម្លងទេ។
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = process.env.STALLGUARD_APP_DIR || path.join(__dirname, '..');
const APPS = ['ZoeW', 'ZoeKeyGen'];

// ពិដានដែលការវាស់ត្រូវរង់ចាំ។ វាត្រូវ **វែងជាង** ពិដានពិតក្នុងកូដ
// ដើម្បីកុំឲ្យការវាស់ខ្លួនវាក្លាយជាការធ្លាក់ក្លែងក្លាយលើម៉ាស៊ីនយឺត។
const SETTLE_BUDGET_MS = 45000;

let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { pass++; console.log('   ok    ' + label); }
    else { fail++; console.log('   FAIL  ' + label + (detail !== undefined ? '\n         ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : '')); }
}

// រង់ចាំ promise ដោយប្រាប់ថាវា settle ឬអត់ — ដោយ **មិន** ព្យួរខ្លួនឯង
// (ការព្យួររបស់ checker ជាការបាត់ CI ទាំងមូល — មើល `hang-guard.js`)។
function settlesWithin(p, ms, clock) {
    let done = null;
    Promise.resolve(p).then((v) => { done = { state: 'resolved', value: v }; },
                            (e) => { done = { state: 'rejected', error: e }; });
    return clock.advanceUntil(() => done !== null, ms).then(() => done);
}

// នាឡិកាក្លែងក្លាយ ៖ `setTimeout` ក្នុង sandbox ចុះឈ្មោះទីនេះ ដូច្នេះការ
// វាស់ «តើវា settle ក្នុង ៣០ វិ. ទេ?» ចំណាយពេលពិត **ប៉ុន្មាន ms** ប៉ុណ្ណោះ។
function makeClock() {
    let now = 0;
    let seq = 0;
    const timers = new Map();
    const api = {
        now: () => now,
        setTimeout(fn, ms) {
            const id = ++seq;
            timers.set(id, { at: now + (Number(ms) || 0), fn: fn, seq: id });
            return id;
        },
        clearTimeout(id) { timers.delete(id); },
        // រត់ timer ទៅមុខរហូតដល់ `cond()` ពិត ឬឈានដល់ `limitMs`
        advanceUntil(cond, limitMs) {
            const drain = () => new Promise((res) => setImmediate(res));
            const step = () => drain().then(() => {
                if (cond()) return;
                let next = null;
                timers.forEach((t) => { if (!next || t.at < next.at || (t.at === next.at && t.seq < next.seq)) next = t; });
                if (!next || next.at > limitMs) return;
                now = next.at;
                timers.delete(next.seq);
                try { next.fn(); } catch (e) {}
                return step();
            });
            return step();
        }
    };
    return api;
}

function makeResponse(status, tag) {
    return { status: status, ok: status >= 200 && status < 300, redirected: false, __tag: tag,
             clone() { return makeResponse(status, tag); } };
}

// ================= ផ្នែក ១ — `sw.js` ក្រោមបណ្តាញ «ភ្ជាប់តែស្លាប់» =================

function loadSw(app, opts) {
    const src = fs.readFileSync(path.join(ROOT, app, 'sw.js'), 'utf8');
    const clock = opts.clock;
    const listeners = {};
    const netCalls = [];
    const aborted = [];
    const cacheUrl = (key) => new URL(typeof key === 'string' ? key : key.url, 'https://example.test/').href;
    const store = new Map(Object.entries(opts.seed || {}).map(([key, value]) => [cacheUrl(key), value]));
    const cache = {
        match(key) { return Promise.resolve(store.get(cacheUrl(key))); },
        put(key, res) { store.set(cacheUrl(key), res); return Promise.resolve(); },
        add() { return Promise.resolve(); },
        addAll() { return Promise.resolve(); }
    };
    const self = {
        location: { href: 'https://example.test/', origin: 'https://example.test' },
        addEventListener: (type, fn) => { listeners[type] = fn; },
        skipWaiting: () => Promise.resolve(),
        clients: { claim: () => Promise.resolve() }
    };
    const ctx = {
        self, URL, Set, Map, Promise, Math, Date, JSON, console,
        setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout,
        setImmediate,
        navigator: { onLine: true },
        caches: {
            open() {
                if (opts.cacheMode === 'open') return Promise.reject(new Error('SecurityError'));
                return Promise.resolve(cache);
            },
            match(k) { return cache.match(k); },
            keys() { return Promise.resolve([]); },
            delete() { return Promise.resolve(true); }
        },
        Response: { error: () => makeResponse(0, 'Response.error') },
        AbortController: function () {
            const listeners2 = [];
            this.signal = { aborted: false, addEventListener: (t, fn) => listeners2.push(fn) };
            this.abort = () => {
                if (this.signal.aborted) return;
                this.signal.aborted = true;
                aborted.push(1);
                listeners2.forEach((fn) => { try { fn(); } catch (e) {} });
            };
        },
        // ⛔ បណ្តាញ «ភ្ជាប់តែស្លាប់» ៖ មិនឆ្លើយ មិនបដិសេធ — **ព្យួរ**
        // លុះត្រាតែអ្នកហៅ abort វា។
        fetch: (reqObj, init) => {
            netCalls.push(typeof reqObj === 'string' ? reqObj : reqObj.url);
            return new Promise((resolve, reject) => {
                const sig = init && init.signal;
                if (!sig) return;
                if (sig.aborted) return reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
                sig.addEventListener('abort', () => reject(Object.assign(new Error('Aborted'), { name: 'AbortError' })));
            });
        }
    };
    ctx.globalThis = ctx;
    vm.createContext(ctx);
    vm.runInContext(src, ctx, { filename: app + '/sw.js' });
    return { listeners, netCalls, aborted, store };
}

function dispatchFetch(sw, request) {
    let responded = null;
    sw.listeners.fetch({ request, respondWith: (p) => { responded = p; }, waitUntil: () => {} });
    return responded;
}

const req = (url, mode) => ({ url: url, method: 'GET', mode: mode || 'no-cors' });

async function swSection() {
    for (const app of APPS) {
        console.log('\n== ' + app + '/sw.js — បណ្តាញភ្ជាប់តែស្លាប់ ==');

        // ១ — ធនធានដែល cache **មិន**មាន + បណ្តាញព្យួរ
        //     ⛔ នេះជាផ្លូវរបស់ `./vendor/xlsx.full.min.js` ពេល
        //     `OPTIONAL_SHELL` ធ្លាក់ពេលដំឡើង (`cache.add(...).catch(() => {})`)។
        {
            const clock = makeClock();
            const sw = loadSw(app, { clock: clock, seed: {} });
            const p = dispatchFetch(sw, req('https://example.test/vendor/xlsx.full.min.js'));
            const out = await settlesWithin(p, SETTLE_BUDGET_MS, clock);
            ok(app + ' ៖ ធនធានក្រៅ cache + បណ្តាញព្យួរ ➜ `respondWith` ត្រូវ settle',
                !!out, 'មិន settle ក្នុង ' + SETTLE_BUDGET_MS + 'ms ➜ ធនធាននោះព្យួរអស់កល្ប');
            ok(app + ' ៖ ការព្យួរនោះត្រូវ **abort** ពិត (មិនទុកសំណើសំយ៉ោង)',
                sw.aborted.length >= 1, 'abort=' + sw.aborted.length);
        }

        // ១ខ — សំណើ navigate ខណៈ cache ទទេទាំងស្រុង (ការដំឡើងលើកដំបូងធ្លាក់)
        //      ⛔ បើវាព្យួរ ➜ **អេក្រង់សទទេគ្មានទីបញ្ចប់**
        {
            const clock = makeClock();
            const sw = loadSw(app, { clock: clock, seed: {} });
            const p = dispatchFetch(sw, req('https://example.test/', 'navigate'));
            const out = await settlesWithin(p, SETTLE_BUDGET_MS, clock);
            ok(app + ' ៖ navigate ខណៈ cache ទទេ + បណ្តាញព្យួរ ➜ ត្រូវ settle',
                !!out, 'មិន settle ➜ អេក្រង់សទទេគ្មានទីបញ្ចប់');
        }

        // ១គ — cache បរាជ័យ (Safari ITP ជម្រះ storage · ឧបករណ៍ជិតពេញ)
        //      **និង** បណ្តាញព្យួរ ➜ ផ្លូវ `networkOnly()` ក៏ត្រូវមានពិដានដែរ។
        //      ⛔ បើអត់ ៖ រាល់សំណើព្យួរអស់កល្ប ខណៈ SW នៅរស់ ➜ អ្នកប្រើដោះមិនរួច។
        {
            const clock = makeClock();
            const sw = loadSw(app, { clock: clock, cacheMode: 'open', seed: {} });
            const p = dispatchFetch(sw, req('https://example.test/app.js'));
            const out = await settlesWithin(p, SETTLE_BUDGET_MS, clock);
            ok(app + ' ៖ cache បរាជ័យ + បណ្តាញព្យួរ ➜ `networkOnly()` ត្រូវ settle',
                !!out, 'មិន settle ➜ រាល់សំណើព្យួរអស់កល្ប');
            ok(app + ' ៖ ហើយវា **resolve** ជា Response.error() មិនមែន reject',
                !!out && out.state === 'resolved' && out.value && out.value.__tag === 'Response.error',
                out ? out.state + ' ' + JSON.stringify(out.value) : 'មិន settle');
        }

        // ២ — ⛔ ទិសផ្ទុយ ៖ សំបកដែល cache ទុករួច ត្រូវឆ្លើយ **ភ្លាមៗ**
        //     ទោះបណ្តាញព្យួរក៏ដោយ (បើអត់ = ការកែនេះបំផ្លាញ cache-first)
        {
            const clock = makeClock();
            const cached = makeResponse(200, 'cached');
            const sw = loadSw(app, { clock: clock, seed: { 'https://example.test/app.js': cached } });
            const out = await settlesWithin(dispatchFetch(sw, req('https://example.test/app.js')), 50, clock);
            ok(app + ' ៖ ⛔ ទិសផ្ទុយ — សំបកក្នុង cache ឆ្លើយភ្លាម ទោះបណ្តាញព្យួរ',
                out && out.state === 'resolved' && out.value && out.value.__tag === 'cached',
                JSON.stringify(out && out.value));
        }
    }
}

// ================= ផ្នែក ២ — `loadScriptOnce()` ពិតចេញពី app.js =================

function sliceFn(src, name) {
    const head = src.indexOf('function ' + name + '(');
    if (head === -1) return null;
    let i = src.indexOf('{', head), depth = 0;
    for (let j = i; j < src.length; j++) {
        if (src[j] === '{') depth++;
        else if (src[j] === '}') { depth--; if (!depth) return src.slice(head, j + 1); }
    }
    return null;
}

async function scriptSection() {
    console.log('\n== ZoeW ៖ `loadScriptOnce()` ក្រោមធនធានដែលមិនដែលឆ្លើយ ==');
    const src = fs.readFileSync(path.join(ROOT, 'ZoeW', 'app.js'), 'utf8');
    const body = sliceFn(src, 'loadScriptOnce');
    if (!body) { ok('ZoeW ៖ រកឃើញ `loadScriptOnce()` ក្នុង app.js', false, 'រកមិនឃើញ'); return; }
    ok('ZoeW ៖ រកឃើញ `loadScriptOnce()` ក្នុង app.js', true);

    const clock = makeClock();
    const appended = [];
    const ctx = {
        console, Promise, Error, Object, String, Number,
        setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout,
        EXPORT_LIBS: { xlsx: { url: './vendor/xlsx.full.min.js' } },
        loadedScriptPromises: {},
        // ⛔ `<script>` ដែល browser មិនដែលឆ្លើយ ៖ គ្មាន onload គ្មាន onerror
        document: {
            createElement: () => ({ set src(v) { this._src = v; }, get src() { return this._src; } }),
            head: { appendChild: (el) => appended.push(el) }
        }
    };
    ctx.globalThis = ctx;
    vm.createContext(ctx);
    vm.runInContext(body, ctx, { filename: 'ZoeW/app.js#loadScriptOnce' });

    const first = ctx.loadScriptOnce('xlsx');
    const out = await settlesWithin(first, SETTLE_BUDGET_MS, clock);
    ok('ZoeW ៖ ធនធានផ្ទុកយឺតដែលមិនដែលឆ្លើយ ➜ `loadScriptOnce()` ត្រូវ settle',
        !!out, 'មិន settle ក្នុង ' + SETTLE_BUDGET_MS + 'ms ➜ Export Excel និងការនាំចូល Excel ជាប់ជារៀងរហូត');
    ok('ZoeW ៖ ការ settle នោះជាការ **បដិសេធ** ដែលមានហេតុផល (មិនមែនជោគជ័យក្លែងក្លាយ)',
        !!out && out.state === 'rejected' && out.error && /timed out|អស់ពេល|timeout/i.test(String(out.error.message)),
        out ? out.state + ': ' + (out.error && out.error.message) : 'មិន settle');

    // ⛔ ការ memoize ត្រូវត្រូវលុបចោលពេលធ្លាក់ — បើអត់ ការសាកម្តងទៀត
    //    ក្នុងវគ្គដដែល ត្រឡប់ promise ដែលធ្លាក់រួច ➜ អ្នកប្រើដោះមិនរួច។
    ok('ZoeW ៖ ក្រោយធ្លាក់ ➜ ការចងចាំត្រូវលុប ➜ សាកម្តងទៀតបាន',
        ctx.loadedScriptPromises.xlsx === undefined,
        'promise ដែលធ្លាក់នៅជាប់ក្នុង loadedScriptPromises ➜ សាកម្តងទៀតធ្លាក់ភ្លាមជារៀងរហូត');

    const retried = ctx.loadScriptOnce('xlsx');
    ok('ZoeW ៖ ការសាកម្តងទៀតបង្កើត <script> ថ្មីពិត', appended.length >= 2, 'appended=' + appended.length);
    retried.catch(() => {});

    // ⛔ ទិសផ្ទុយ ៖ ការផ្ទុកដែលជោគជ័យត្រូវនៅតែជោគជ័យ ហើយត្រូវត្រូវចងចាំ
    {
        const clock2 = makeClock();
        const loaded = [];
        const ctx2 = {
            console, Promise, Error, Object, String, Number,
            setTimeout: clock2.setTimeout, clearTimeout: clock2.clearTimeout,
            EXPORT_LIBS: { xlsx: { url: './vendor/xlsx.full.min.js' } },
            loadedScriptPromises: {},
            document: {
                createElement: () => {
                    const el = {};
                    loaded.push(el);
                    return el;
                },
                head: { appendChild: (el) => { clock2.setTimeout(() => el.onload && el.onload(), 5); } }
            }
        };
        ctx2.globalThis = ctx2;
        vm.createContext(ctx2);
        vm.runInContext(body, ctx2, { filename: 'ZoeW/app.js#loadScriptOnce' });
        const good = ctx2.loadScriptOnce('xlsx');
        const res = await settlesWithin(good, 5000, clock2);
        ok('ZoeW ៖ ⛔ ទិសផ្ទុយ — ការផ្ទុកដែលជោគជ័យនៅតែជោគជ័យ',
            !!res && res.state === 'resolved', JSON.stringify(res));
        ok('ZoeW ៖ ⛔ ទិសផ្ទុយ — លទ្ធផលជោគជ័យត្រូវចងចាំ (ផ្ទុកតែម្តង)',
            ctx2.loadedScriptPromises.xlsx === good && ctx2.loadScriptOnce('xlsx') === good,
            'ការចងចាំបាត់ ➜ រាល់ការ Export ផ្ទុក script ឡើងវិញ');
    }
}

(async () => {
    await swSection();
    await scriptSection();
    console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')' : '✅ ជោគជ័យ ' + pass));
    process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
