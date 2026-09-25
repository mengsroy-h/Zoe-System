// ថ្នាក់កំហុស៖ **ខ្សែអក្សរដែលមកពី Firebase ធ្លាក់ចូល attribute របស់ handler។**
//
// Rules ផ្ទៀងផ្ទាត់តែ `newData.isString()` លើ `id`, `barcode`, `code`, `phone`,
// `locker` — **គ្មានការកំណត់តួអក្សរទេ**។ ដូច្នេះឧបករណ៍ណាមួយដែលចូលប្រព័ន្ធបាន
// (ឬកំហុសកូដ) អាចដាក់ `'`, `\`, `"`, `<`, `&#39;` ចូលវាលទាំងនោះ ហើយវាលទាំងនោះ
// ត្រូវបានបញ្ចូលទៅក្នុង HTML របស់ជួរដេកក្នុង ៣ កន្លែង៖ តារាងប្រវត្តិ,
// ប្រអប់បញ្ជីកញ្ចប់ និងប្រអប់ធុងសំរាម។
//
// **មុនកំណែ 2.13.0** តម្លៃទាំងនោះចូល `onclick="fn('…')"` ដែលមាន **escape ២
// ជាន់ជាន់គ្នា** — browser ឌិកូដ HTML entity **មុន** ហើយទើបប្រគល់លទ្ធផលទៅ JS
// parser ➜ `&#39;` ដែលមិន escape ក្លាយជា `'` ពិត ➜ បំបែកខ្សែអក្សរ JS បាន។
// កំណែ 2.13.0 ដក `'unsafe-inline'` ចេញពី `script-src` ហើយប្តូរទៅ `data-act`
// + `data-a1`/`data-a2` ➜ **គ្មាន JS parser ក្នុងផ្លូវនោះទៀតទេ** ➜ ថ្នាក់កំហុស
// នោះ **មិនអាចកើតឡើងបានតាមរចនាសម្ព័ន្ធ**។
//
// តេស្តនេះចាក់សោលទ្ធផលនោះ៖ វា seed ទិន្នន័យសត្រូវចូល App ពិតក្នុង Chromium
// រួចអះអាង **២ ខាង**៖
//   ១. គ្មានកូដណារត់ និងគ្មាន attribute event ថ្មីត្រូវ parse ចូល
//   ២. **ការចុចប៊ូតុងនៅតែបញ្ជូនខ្សែអក្សរដើមបេះបិទ** — escape ដែលតឹងពេក
//      (ឬការភ្លេច escape) នឹងបំបែកមុខងារ ហើយតេស្តត្រូវចាប់វាដែរ។
let chromium;
try { chromium = require('playwright-core').chromium; } catch (e) {
    console.log('SKIP — ត្រូវការ playwright-core (npm i playwright-core)');
    process.exit(0);
}
const fs = require('fs');
const http = require('http');
const path = require('path');
const CHROME = process.env.INLINEXSS_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
if (!fs.existsSync(CHROME)) { console.log('SKIP — រកមិនឃើញ Chromium'); process.exit(0); }

const ROOT = process.env.INLINEXSS_APP_DIR || path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm' };
let pass = 0, fail = 0;
const ok = (n) => { console.log('  ok    ' + n); pass++; };
const bad = (n, d) => { console.log('  FAIL  ' + n + (d !== undefined ? '\n        ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); fail++; };
const check = (c, n, d) => (c ? ok(n) : bad(n, d));

function serve(dir) {
    return new Promise((res) => {
        const s = http.createServer((req, rsp) => {
            let p = decodeURIComponent(req.url.split('?')[0]);
            if (p === '/') p = '/index.html';
            const f = path.join(dir, p);
            if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); return rsp.end(); }
            rsp.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'text/plain' });
            rsp.end(fs.readFileSync(f));
        });
        s.listen(0, '127.0.0.1', () => res(s));
    });
}

const LICENSE_STUB = `window.ZoeLicense = {
    getStatus: function () { return Promise.resolve({ state: 'active' }); },
    setServerTimeOffset: function () {}, syncServerTime: function () { return Promise.resolve(); },
    activate: function () { return Promise.resolve({ ok: true }); },
    verifyKeyString: function () { return Promise.resolve({ ok: true }); }, clearActivation: function () {}
};`;

// បន្ទុកសត្រូវ — គ្រប់មួយវាយប្រហារជាន់ escape ខុសគ្នា។ Firebase key មិនអាចមាន
// `.` `#` `$` `[` `]` `/` ទេ ប៉ុន្តែ **អាចមាន** សញ្ញាសម្រង់ backslash និង `<`
// ហើយវាល `id` ខាងក្នុងក៏ជា `isString()` ទទេដែរ។
const PAYLOADS = {
    quote_break:   "x');window.__xss=1;('",
    dquote_break:  'x" onmouseover="window.__xss=1" data-z="',
    backslash_tail: 'x\\',
    entity_quote:  'x&#39;);window.__xss=1;//',
    entity_amp:    'x&amp;#39;',
    tag_inject:    '<img src=x onerror=window.__xss=1>',
    close_script:  '</script><script>window.__xss=1</script>',
    newline_break: 'x\n;window.__xss=1;//',
    u2028_break:   'x ;window.__xss=1;//',
    backtick_tpl:  'x`+window.__xss=1+`'
};

const FAKE_SDK = function (seed) {
    const store = JSON.parse(JSON.stringify(seed));
    window.__fakeStore = store;
    window.__errs = [];
    const listeners = [];
    function getPath(p) {
        if (!p || p === '/') return store;
        let cur = store;
        for (const part of p.split('/').filter(Boolean)) {
            if (cur === null || cur === undefined || typeof cur !== 'object') return null;
            cur = cur[part];
        }
        return cur === undefined ? null : cur;
    }
    function setPath(p, val) {
        const parts = p.split('/').filter(Boolean);
        if (!parts.length) return;
        let cur = store;
        for (let i = 0; i < parts.length - 1; i++) {
            if (cur[parts[i]] === null || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
            cur = cur[parts[i]];
        }
        const last = parts[parts.length - 1];
        if (val === null) delete cur[last]; else cur[last] = JSON.parse(JSON.stringify(val));
    }
    function snapOf(p) {
        const v = getPath(p);
        return { val: () => (v === undefined || v === null) ? null : (typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v), exists: () => v !== null && v !== undefined };
    }
    function fire(p) { listeners.filter((l) => l.path === p).forEach((l) => { try { l.cb(snapOf(p)); } catch (e) { window.__errs.push(p + ': ' + (e && e.message)); } }); }
    window.__fireAll = () => [...new Set(listeners.map((l) => l.path))].forEach(fire);
    const user = { uid: 'admin-uid', email: 'a@b.c', getIdToken: () => Promise.resolve('tok'), metadata: { lastSignInTime: new Date().toISOString() } };
    window.firebaseSDK = {
        initializeApp: () => ({ name: 'fake' }), getApps: () => [], deleteApp: () => Promise.resolve(),
        getAuth: () => ({ currentUser: user }),
        onAuthStateChanged: (a, cb) => { setTimeout(() => cb(user), 0); return () => {}; },
        signInWithEmailAndPassword: () => Promise.resolve({ user }), signOut: () => Promise.resolve(),
        setPersistence: () => Promise.resolve(), browserLocalPersistence: {}, browserSessionPersistence: {},
        getIdTokenResult: () => Promise.resolve({ authTime: new Date().toISOString(), claims: {} }),
        getDatabase: () => ({ fake: true }), ref: (d, p) => ({ path: p === undefined ? '' : String(p) }),
        onValue: (r, cb) => {
            listeners.push({ path: r.path, cb });
            setTimeout(() => { if (r.path === '.info/connected') cb({ val: () => true }); else { try { cb(snapOf(r.path)); } catch (e) { window.__errs.push(r.path + ': ' + (e && e.message)); } } }, 0);
            return () => {};
        },
        off: () => {}, get: (r) => Promise.resolve(snapOf(r.path)),
        set: (r, v) => { setPath(r.path, v); window.__fireAll(); return Promise.resolve(); },
        update: (r, obj) => { Object.keys(obj).forEach((k) => setPath((r.path ? r.path + '/' : '') + k, obj[k])); window.__fireAll(); return Promise.resolve(); },
        goOnline: () => {}, goOffline: () => {},
        increment: (n) => ({ __inc: n }),
        runTransaction: (r, fn) => {
            const cur = getPath(r.path);
            const next = fn(cur === null ? null : JSON.parse(JSON.stringify(cur)));
            if (next === undefined) return Promise.resolve({ committed: false, snapshot: snapOf(r.path) });
            setPath(r.path, next); window.__fireAll();
            return Promise.resolve({ committed: true, snapshot: snapOf(r.path) });
        }
    };
    window.dispatchEvent(new Event('firebasesdkready'));
};

// រាយ **attribute event ពិត** ដែល browser parse ចូលធាតុ។ ចាប់ពីកំណែ 2.13.0
// គ្មាន attribute event ណាមួយត្រូវបានអនុញ្ញាតឡើយ (រួមទាំង `onclick`) ព្រោះ
// CSP បដិសេធវា — ដូច្នេះការឃើញណាមួយ = ការចាក់បញ្ចូល។ មិនមែនស្វែងរកអក្សរក្នុង
// `innerHTML` ទេ ព្រោះបន្ទុកសត្រូវដែល escape ត្រឹមត្រូវ **លេចជាអត្ថបទ**
// (`&quot; onmouseover=&quot;…`) ហើយការស្វែងរកអក្សរនឹងរាយវាជាកំហុសក្លែងក្លាយ។
const HANDLER_ATTRS = `(root) => {
    const found = [];
    root.querySelectorAll('*').forEach((el) => {
        for (const a of el.attributes) {
            if (/^on/i.test(a.name)) found.push(el.tagName + '[' + a.name + ']');
        }
    });
    return found;
}`;

const D = (() => { const t = new Date(); return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); })();

function buildSeed() {
    const history = {};
    const deleted = {};
    Object.keys(PAYLOADS).forEach((name, i) => {
        const evil = PAYLOADS[name];
        // `id` សត្រូវ (ធ្លាក់ចូល onclick នៃតារាងប្រវត្តិ និងធុងសំរាម)
        history['id_' + name] = {
            id: evil, phone: '01100' + String(i).padStart(4, '0'), scanDate: D,
            cod: 1, dod: 0, count: 1, barcode: 'B' + i, time: '09:00', isClosed: false,
            locker: evil,
            barcodes: [{ code: 'B' + i, cod: 1, dod: 0, locker: evil, isClosed: false, time: '09:00', isDeducted: false, isFromDeletion: false }]
        };
        // `code` សត្រូវ (ធ្លាក់ចូល onclick នៃប្រអប់បញ្ជីកញ្ចប់)
        history['code_' + name] = {
            id: 'code_' + name, phone: '01200' + String(i).padStart(4, '0'), scanDate: D,
            cod: 1, dod: 0, count: 1, barcode: evil, time: '09:01', isClosed: false,
            barcodes: [{ code: evil, cod: 1, dod: 0, locker: 'A1', isClosed: false, time: '09:01', isDeducted: false, isFromDeletion: false }]
        };
        deleted['del_' + name] = {
            id: evil, phone: '01300' + String(i).padStart(4, '0'), scanDate: D,
            cod: 1, dod: 0, count: 1, barcode: evil, time: '09:02', isClosed: false,
            deletedAt: Date.now(), isFromDeletion: true,
            barcodes: [{ code: evil, cod: 1, dod: 0, isClosed: false, isDeducted: false, isFromDeletion: true }]
        };
    });
    return {
        user_roles: { 'admin-uid': 'admin' },
        zoew_scan_history_cod_dod: history,
        zoew_recently_deleted_cod_dod: deleted,
        zoew_daily_revenue_cod_dod: { [D]: { codDollar: 10, dodDollar: 0, totalCount: 3 } },
        zoew_monthly_revenue_cod_dod: { [D.substring(0, 7)]: { codDollar: 10, dodDollar: 0, totalCount: 3 } },
        zoew_daily_pickup_cod_dod: {},
        zoew_settings: { exchange_rate: 4100 }
    };
}

// === ផ្នែកទី ១ — ច្បាប់ស្តាទិច ៖ តម្លៃពី DB ក្នុង attribute ត្រូវ escape ===
// នេះជាជាន់ការពារសម្រាប់ **កូដថ្មី** — តេស្ត runtime ខាងក្រោមគ្របតែ sink ដែល
// មានស្រាប់ប៉ុណ្ណោះ។ ការបន្ថែមប៊ូតុងថ្មីដោយភ្លេច escape នឹងធ្លាក់ត្រង់នេះ។
for (const app of ['ZoeW', 'ZoeKeyGen']) {
    const src = fs.readFileSync(path.join(ROOT, app, 'app.js'), 'utf8');
    const escaper = app === 'ZoeW' ? 'sanitizeInput' : 'escapeHtml';

    // ១ក. ផ្លូវ `onclick="fn('…')"` **មិនត្រូវត្រឡប់មកវិញ** — CSP បដិសេធវា
    //     ស្ងាត់ៗ ហើយវានាំ escape ២ ជាន់ត្រឡប់មកជាមួយ។
    const backAgain = (src.match(/\son(?:click|change|input|submit)\s*=\s*"/g) || []);
    check(backAgain.length === 0, app + ': គ្មាន `on*=` ក្នុង HTML ដែលបង្កើតដោយ JS (escape ២ ជាន់លែងមាន)', backAgain.join(' '));
    check(!/escapeForInlineJsAttr/.test(src),
        app + ': `escapeForInlineJsAttr()` ត្រូវបានដកចេញ (លែងមានបរិបទដែលត្រូវការវា)');

    // ១ខ. រាល់តម្លៃដែលចាក់ចូល `data-a1`/`data-a2` ត្រូវឆ្លងកាត់ escaper
    const offenders = [];
    src.split('\n').forEach((line, i) => {
        for (const m of line.matchAll(/data-a[12]="(\$\{[^}]*\})"/g)) {
            if (m[1].indexOf(escaper) !== -1) continue;
            offenders.push((i + 1) + ' ' + m[1] + ': ' + line.trim().slice(0, 90));
        }
    });
    check(offenders.length === 0, app + ': រាល់តម្លៃក្នុង `data-a1`/`data-a2` ឆ្លងកាត់ `' + escaper + '()`',
        offenders.join('\n        '));
}

(async () => {
    const dir = path.join(ROOT, 'ZoeW');
    const server = await serve(dir);
    const origin = 'http://127.0.0.1:' + server.address().port;
    const browser = await chromium.launch({ executablePath: CHROME });
    const ctx = await browser.newContext({ viewport: { width: 412, height: 780 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    await page.addInitScript(`window.addEventListener('unhandledrejection', function (ev) {
            var m; try { m = String((ev.reason && (ev.reason.message || ev.reason)) || 'unknown'); } catch (x) { m = 'unknown'; }
            setTimeout(function () { throw new Error('unhandledrejection: ' + m); }, 0);
        });`);
    page.on('dialog', (d) => d.accept());
    await page.route('**', (route) => {
        const u = route.request().url();
        if (u.indexOf('/license-verify.js') !== -1) return route.fulfill({ status: 200, contentType: 'application/javascript', body: LICENSE_STUB });
        if (u.startsWith(origin)) return route.continue();
        return route.abort();
    });
    await page.addInitScript(`window.localStorage.setItem('zoew_firebase_config', ${JSON.stringify(JSON.stringify({ apiKey: 'k', databaseURL: 'https://fake-default-rtdb.firebaseio.com', projectId: 'p' }))});`);
    await page.addInitScript('(' + FAKE_SDK.toString() + ')(' + JSON.stringify(buildSeed()) + ');');
    await page.goto(origin + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2500);
    await page.evaluate(() => { const b = document.getElementById('btnFilterAll'); if (b) b.click(); else window.filterDataByDate('all'); });
    await page.waitForTimeout(600);

    const payloads = PAYLOADS;

    // --- ១. តារាងប្រវត្តិ ---
    const table = await page.evaluate((src) => {
        const list = eval(src);
        return {
            rows: document.querySelectorAll('#historyTableBody tr').length,
            xss: !!window.__xss,
            handlers: list(document.getElementById('historyTableBody')),
            imgs: document.querySelectorAll('#historyTableBody img').length
        };
    }, HANDLER_ATTRS);
    check(table.rows === 20, 'តារាងប្រវត្តិបង្ហាញ item សត្រូវទាំង ២០', 'rows=' + table.rows);
    check(!table.xss, '**គ្មានកូដសត្រូវរត់ពេលបង្ហាញតារាងប្រវត្តិ**', 'window.__xss=' + table.xss);
    check(table.handlers.length === 0, '**គ្មាន attribute event ណាមួយត្រូវបាន parse ចូលជួរដេក**', table.handlers);
    check(table.imgs === 0, 'គ្មាន `<img>` ត្រូវបានចាក់ចូលជួរដេក (tag មិន parse)', 'imgs=' + table.imgs);

    // ការចុចប៊ូតុងត្រូវបញ្ជូន id **ដើមបេះបិទ** — ការ escape ខុសនឹងបំបែកមុខងារ
    const roundTrip = await page.evaluate((names) => {
        const seen = {};
        window.__spy = (label) => function (arg) { seen[label] = arg; };
        const originals = {};
        ['toggleCloseStatus', 'openViewListModal', 'openCallMarkModal', 'toggleMoreDropdown'].forEach((fn) => { originals[fn] = window[fn]; });
        const out = {};
        const rows = Array.from(document.querySelectorAll('#historyTableBody tr'));
        names.forEach((name) => {
            const tr = rows.find((r) => r.dataset && r.dataset.id !== undefined && r.querySelector('.close-btn'));
            void tr;
        });
        // ចាប់យកតាម dataset.id ដែល renderHistory ដាក់ទុក
        rows.forEach((tr) => {
            const id = tr.dataset.id;
            if (id === undefined) return;
            const btn = tr.querySelector('.close-btn');
            if (!btn) return;
            let got = null;
            if (typeof window.setupActionDelegation === 'function') {
                const orig = window.toggleCloseStatus;
                window.toggleCloseStatus = (a) => { got = a; };
                btn.click();
                window.toggleCloseStatus = orig;
            } else {
                // App React ៖ ការចុចហៅ `ACTION_REGISTRY` (មិនឆ្លង `window`) ➜ វាស់ **ការហៅពិត** ៖ `toggleCloseStatus()` ពិត
                // ទៅដល់ `confirm()` **តែពេល** id រកឃើញ item បេះបិទ (`===`) ➜ confirm ឆ្លើយ `false` (គ្មានផលរំខាន)
                // ហើយ id ដែលបញ្ជូនអានពី handler ពិតរបស់ React (`onAct(…, { args })`)
                const key = Object.keys(btn).find((k) => k.startsWith('__reactProps$'));
                const h = key && btn[key] && btn[key].onClick;
                let confirms = 0;
                const origConfirm = window.confirm;
                window.confirm = () => { confirms++; return false; };
                btn.click();
                window.confirm = origConfirm;
                const args = h && h.actionName === 'toggleCloseStatus' && h.actionOptions ? h.actionOptions.args : null;
                got = confirms === 1 && args ? args[0] : null;
            }
            out[id] = got;
        });
        Object.keys(originals).forEach((fn) => { window[fn] = originals[fn]; });
        return { out, xss: !!window.__xss, seen };
    }, Object.keys(PAYLOADS));
    const rtMismatch = [];
    Object.keys(payloads).forEach((name) => {
        const evil = payloads[name];
        if (!(evil in roundTrip.out)) { rtMismatch.push(name + ': គ្មានជួរដេក'); return; }
        if (roundTrip.out[evil] !== evil) rtMismatch.push(name + ': ទទួល ' + JSON.stringify(roundTrip.out[evil]));
    });
    check(rtMismatch.length === 0, '**ចុចប៊ូតុង «បិទ» ➜ id ដើមបេះបិទ (escape មិនបំបែកមុខងារ)**', rtMismatch.slice(0, 4));
    check(!roundTrip.xss, 'គ្មានកូដសត្រូវរត់ពេលចុចប៊ូតុងក្នុងជួរដេក', 'window.__xss=' + roundTrip.xss);

    // --- ២. ប្រអប់បញ្ជីកញ្ចប់ (`b.code` ធ្លាក់ចូល onclick ២ អាគុយម៉ង់) ---
    const viewList = await page.evaluate(({ names, src }) => {
        const list = eval(src);
        const res = {};
        let xssSeen = false;
        names.forEach((name) => {
            const id = 'code_' + name;
            window.openViewListModal(id);
            // App React ៖ ប្រអប់គូរក្នុង microtask ➜ `commitNow()` ពិត (flushSync) ដូច App ដើមដែលកែ DOM ភ្លាម
            if (typeof window.commitNow === 'function') window.commitNow();
            const box = document.getElementById('barcodeListContainer') || document.querySelector('#viewListModal .barcode-list-item') && document.querySelector('#viewListModal');
            const container = document.querySelector('#viewListModal');
            const btn = container ? container.querySelector('.btn-toggle-bc-close') : null;
            if (!btn) { res[name] = { err: 'no button' }; return; }
            let got = null;
            if (typeof window.setupActionDelegation === 'function') {
                const orig = window.toggleIndividualBarcodeClose;
                window.toggleIndividualBarcodeClose = (a, b) => { got = [a, b]; };
                btn.click();
                window.toggleIndividualBarcodeClose = orig;
            } else {
                // App React ៖ `toggleIndividualBarcodeClose()` ពិតទៅដល់ `confirm()` តែពេល item **និង** barcode រកឃើញ
                // បេះបិទ ហើយសារ confirm ផ្ទុក barcode ពិត ➜ វាស់ការហៅពិត (confirm ➜ `false` គ្មានផលរំខាន)
                const key = Object.keys(btn).find((k) => k.startsWith('__reactProps$'));
                const h = key && btn[key] && btn[key].onClick;
                const asked = [];
                const origConfirm = window.confirm;
                window.confirm = (msg) => { asked.push(String(msg)); return false; };
                btn.click();
                window.confirm = origConfirm;
                const args = h && h.actionName === 'toggleIndividualBarcodeClose' && h.actionOptions ? h.actionOptions.args : null;
                got = asked.length === 1 && args && asked[0].indexOf(String(args[1])) !== -1 ? [args[0], args[1]] : null;
            }
            res[name] = { got, handlers: list(container), imgs: container.querySelectorAll('img').length };
            void box;
            if (window.__xss) xssSeen = true;
        });
        return { res, xssSeen, xss: !!window.__xss };
    }, { names: Object.keys(PAYLOADS), src: HANDLER_ATTRS });
    const vlMismatch = [];
    Object.keys(payloads).forEach((name) => {
        const r = viewList.res[name];
        if (!r || r.err) { vlMismatch.push(name + ': ' + (r && r.err)); return; }
        if (r.handlers && r.handlers.length) { vlMismatch.push(name + ': attribute event ' + r.handlers.join(',')); return; }
        if (r.imgs) { vlMismatch.push(name + ': tag <img> ត្រូវចាក់ចូល'); return; }
        if (!r.got || r.got[0] !== 'code_' + name || r.got[1] !== payloads[name]) vlMismatch.push(name + ': ទទួល ' + JSON.stringify(r.got));
    });
    check(vlMismatch.length === 0, '**ប្រអប់បញ្ជីកញ្ចប់ ៖ barcode សត្រូវធ្វើ round-trip ត្រឹមត្រូវ**', vlMismatch.slice(0, 4));
    check(!viewList.xss, '**គ្មានកូដសត្រូវរត់ក្នុងប្រអប់បញ្ជីកញ្ចប់**', 'window.__xss=' + viewList.xss);

    // --- ៣. ប្រអប់ធុងសំរាម ---
    const trash = await page.evaluate((src) => {
        const list = eval(src);
        window.openRecentlyDeletedModal();
        const tbody = document.getElementById('deletedTableBody');
        const handlers = tbody ? list(tbody) : ['no tbody'];
        const btns = tbody ? Array.from(tbody.querySelectorAll('button')).filter((b) => b.textContent.indexOf('🔄') !== -1) : [];
        const got = [];
        if (typeof window.setupActionDelegation === 'function') {
            const orig = window.promptRestoreDeletedItem;
            window.promptRestoreDeletedItem = (a) => { got.push(a); };
            btns.forEach((b) => b.click());
            window.promptRestoreDeletedItem = orig;
        } else {
            // App React ៖ `promptRestoreDeletedItem()` ពិតសរសេរ `pendingRestoreId` (ឃ្លាំង) ➜ អាន state ពិតក្រោយរាល់ការចុច
            btns.forEach((b) => {
                window.pendingRestoreId = null;
                b.click();
                if (window.pendingRestoreId !== null && window.pendingRestoreId !== undefined) got.push(window.pendingRestoreId);
            });
            window.pendingRestoreId = null;
        }
        return { got, handlers, imgs: tbody ? tbody.querySelectorAll('img').length : -1, xss: !!window.__xss, rows: btns.length };
    }, HANDLER_ATTRS);
    check(trash.rows === 10, 'ធុងសំរាមបង្ហាញ item សត្រូវទាំង ១០', 'rows=' + trash.rows);
    check(trash.handlers.length === 0, '**គ្មាន attribute event ណាមួយត្រូវចាក់ចូលធុងសំរាម**', trash.handlers);
    check(trash.imgs === 0, 'គ្មាន `<img>` ត្រូវបានចាក់ចូលធុងសំរាម', 'imgs=' + trash.imgs);
    const trashMissing = Object.keys(payloads).filter((n) => trash.got.indexOf(payloads[n]) === -1);
    check(trashMissing.length === 0, '**ធុងសំរាម ៖ id សត្រូវធ្វើ round-trip ត្រឹមត្រូវ**', trashMissing);
    check(!trash.xss, '**គ្មានកូដសត្រូវរត់ក្នុងធុងសំរាម**', 'window.__xss=' + trash.xss);

    const finalXss = await page.evaluate(() => ({ xss: !!window.__xss, errs: window.__errs || [] }));
    check(!finalXss.xss, '**គ្មាន window.__xss ត្រូវបានកំណត់ពេញវគ្គតេស្ត**');
    check(finalXss.errs.length === 0, 'listener មិន throw លើទិន្នន័យសត្រូវ', finalXss.errs.slice(0, 3));
    const real = errors.filter((e) => !/net::ERR_FAILED|Failed to load resource|ERR_BLOCKED|ERR_ABORTED/i.test(e));
    check(real.length === 0, 'គ្មានកំហុស runtime លើទិន្នន័យសត្រូវ', real.slice(0, 3).join('\n        '));

    await ctx.close();
    await browser.close();
    // ⛔ `server.close(cb)` ហៅ cb តែពេល **គ្រប់ការតភ្ជាប់បិទអស់** — Chromium
    // រក្សា socket keep-alive ➜ ការរង់ចាំនេះអាចមិនចេះចប់។ បិទវាដោយបង្ខំ។
    await new Promise((r) => {
        server.close(r);
        if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
    });
    console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')' : '✅ ជោគជ័យ ' + pass));
    process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e && e.stack || e); process.exit(1); });
