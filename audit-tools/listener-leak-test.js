// ⛔ ថ្នាក់កំហុស៖ **listener ដែលកកកុញ (duplicate listener)។**
//
// App នេះរស់នៅ **វគ្គវែង** ៖ អ្នកប្រើបើកវាពេញថ្ងៃ ស្កេនរាប់រយកញ្ចប់
// ចាកចេញ/ចូលវិញ ប្តូរ Config ហើយបណ្តាញដាច់/មកវិញច្រើនដង។ រាល់វដ្តទាំងនោះ
// រត់ function ដែល **ចុះឈ្មោះ listener ឡើងវិញ** ៖ `proceedAfterLogin()` ·
// `initDatabaseListeners()` · `attachInfoListeners()` · `initFirebase()` ·
// `initScanEngine()`។ បើមួយណាបន្ថែមដោយ **មិនដក** នោះចំនួន listener
// **កើនឥតឈប់** ➜ ៣ ថ្នាក់កំហុសពិត៖
//
//   ១. **សកម្មភាពរត់ច្រើនដង** — `click` ស្ទួន ➜ `executePermanentDelete`
//      រត់ ២ ដង (ថ្នាក់ដដែលនឹងមេរៀន `bindClickBackup()` ក្នុង 2.13.0)។
//   ២. **ការសរសេរស្ទួនចូល Firebase** — `onValue` ស្ទួន ➜ handler ដដែល
//      រត់ N ដងក្នុងមួយ snapshot ➜ `debouncedRenderAfterHistorySync` និង
//      `runAutomaticCleanupRules()` រត់ស្ទួន។
//   ៣. **ការស៊ីអង្គចងចាំ និងស៊ីថ្ម** — `touchmove` ស្ទួនលើ `document`
//      ធ្វើឲ្យរាល់កាយវិការចំណាយ N ដង ➜ ការរមូរញាក់លើទូរស័ព្ទចាស់។
//
// ⚠️ **ការស្កេនស្តាទិចមិនអាចបញ្ជាក់រឿងនេះបានទេ** ៖ `bindPanelSwipe()` ត្រូវ
// ហៅ **២ ដង** ដោយចេតនា (ទំព័រ ២ ដាច់ដោយឡែក) ហើយ `renderLockerGrid()`
// បង្កើតប៊ូតុង **ថ្មី** រាល់ដង ➜ ការរាប់ការហៅ ឬការរក
// `addEventListener` ដោយគ្មាន `removeEventListener` ផ្តល់ **false positive**។
// មានតែ **ការរាប់ listener ពិតក្រោយវដ្តពិត** ទេដែលឆ្លើយសំណួរនេះបាន។
//
// ⚠️ ហើយវាត្រូវដាក់ប្រព័ន្ធក្នុង **ស្ថានភាពពិត** (សំណួរទី ៨) — មិនមែនត្រឹម
// ហៅ function ដដែល ២ ដងទេ ៖ វដ្ត login/logout · reconnect · reconfig ·
// ការប្តូរទំព័រ · ការបើក/បិទ modal។
//
// ⚠️⚠️ **មេរៀន ២ ដែលជុំនេះវាស់បានលើ harness ខ្លួនឯង** — ជំនាន់ដំបូងរាយ
// «ការធ្លាក់» ២ ដែល **ទាំង ២ ជាសំណល់នៃការវាស់ មិនមែនកំហុស App**៖
//
//   ១. **node ដែលផ្តាច់ចេញ មិនមែនការលេច។** `renderLockerGrid()` សាង
//      ប៊ូតុងថ្មីរាល់ដងរួច `grid.innerHTML = ''` ➜ ការរាប់ដោយមិនសួរ
//      `isConnected` រាយ **១៤៤ ការលេច** ដែលពិតជា node ដែលបាញ់មិនបាន
//      និងត្រូវ GC។ ➜ ការរាប់ត្រង តាម `isConnected`។
//      ⛔ តែការត្រងនោះ **មិនត្រូវលាក់ការលេចពិត** — mutation ដែលដាក់
//      listener ស្ទួនលើ `#lockerGrid` (ដែល **នៅភ្ជាប់**) នៅតែធ្លាក់។
//
//   ២. **ការភ្ជាប់លើកដំបូង មិនមែនការកកកុញ។** ការថតរូបភាពមុនជុំទី ១
//      ផ្តល់ «0 ➜ 1» សម្រាប់ path ទាំង ៦ — នោះជា *ការភ្ជាប់* មិនមែន
//      *ការកើន*។ ➜ ត្រូវ **កម្តៅ ១ ជុំ** មុនថត រួចសួរថា «ជុំទី ២–៦
//      បន្ថែមទេ?»។
//
// **ថ្នាក់រួម ៖ ការវាស់ដែលរាយការណ៍ខុស ថ្លៃដូចការវាស់ដែលបៃតងក្លែងក្លាយ** —
// មួយលាក់កំហុស មួយទៀតបង្កើតកំហុសក្លែងក្លាយដែលជុំក្រោយនឹងចំណាយពេល
// «កែ» អ្វីដែលមិនខូច។ ដូច្នេះការអះអាងទាំងអស់មាន **២ ខាង**៖ ការមិនកកកុញ
// **និង** ភស្តុតាងថាវដ្តនោះពិតជាបានរត់ (ជាន់អប្បបរមា + ការរាប់ node
// ដែលបោះបង់ + probe ទិសផ្ទុយ)។
//
// Mutation ដែលវាស់រួច ➜ ចាប់បានទាំង ៥៖ ដក `detachDatabaseListeners()` ·
// document listener ស្ទួនរាល់ការភ្ជាប់ឡើងវិញ · window listener ស្ទួនរាល់
// ការប្តូរទំព័រ · listener ស្ទួនលើ node ដែលនៅភ្ជាប់ · ដក `innerHTML = ''`។
let chromium;
try { chromium = require('playwright-core').chromium; } catch (e) {
    console.log('SKIP — ត្រូវការ playwright-core (npm i playwright-core)');
    process.exit(0);
}
const fs = require('fs');
const http = require('http');
const path = require('path');
const CHROME = process.env.LEAK_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
if (!fs.existsSync(CHROME)) { console.log('SKIP — រកមិនឃើញ Chromium'); process.exit(0); }

const ROOT = process.env.LEAK_APP_DIR || path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm' };

let pass = 0, fail = 0;
const ok = (n) => { console.log('   ok    ' + n); pass++; };
const bad = (n, d) => { console.log('   FAIL  ' + n + (d !== undefined ? '\n         ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); fail++; };
const check = (c, n, d) => (c ? ok(n) : bad(n, d));

// ⛔ សំបុត្រ toast និងធាតុបណ្តោះអាសន្នអាចនៅសល់មួយ ២ ក្នុងស្របពេលថត ➜
// ការអនុគ្រោះតូចមួយ។ ⛔ កុំតម្លើងវាដើម្បីឲ្យតេស្តបៃតង — វដ្តទាំងអស់
// មាន ៦–៨ ជុំ ដូច្នេះការលេចពិត ១ node/ជុំ នៅតែឆ្លងកាត់ការអនុគ្រោះនេះ។
const NODE_ALLOWANCE = 4;

function serve(dir) {
    return new Promise((res, rej) => {
        if (!fs.existsSync(dir)) return rej(new Error('រកថត App មិនឃើញ: ' + dir));
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

// ⛔ រាប់ listener **ពិត** ៖ patch `EventTarget.prototype` មុនកូដ App រត់។
// រាប់តាមកូនសោ `<target>|<type>` ដោយប្រើ `WeakRef` មិនបាន (target ជា
// document/window ភាគច្រើន) ➜ ប្រើស្លាកអត្តសញ្ញាណដែលស្ថិតស្ថេរ។
const COUNTER = `(function () {
    const add = EventTarget.prototype.addEventListener;
    const rem = EventTarget.prototype.removeEventListener;
    const records = [];
    const tag = (t) => {
        if (t === window) return 'window';
        if (t === document) return 'document';
        if (typeof visualViewport !== 'undefined' && t === visualViewport) return 'visualViewport';
        if (t && t.nodeType === 1) return (t.tagName || '?') + '#' + (t.id || '') + '.' + String(t.className || '').split(' ')[0];
        try { return Object.prototype.toString.call(t); } catch (e) { return '?'; }
    };
    const alive = (t) => {
        if (t === window || t === document) return true;
        if (typeof visualViewport !== 'undefined' && t === visualViewport) return true;
        if (t && typeof t.nodeType === 'number') return t.isConnected === true;
        return true;
    };
    EventTarget.prototype.addEventListener = function (type, fn, opts) {
        try {
            let dup = false;
            for (let i = 0; i < records.length; i++) {
                const r = records[i];
                if (r.t === this && r.type === type && r.fn === fn) { dup = true; break; }
            }
            if (!dup) records.push({ t: this, type: type, fn: fn });
        } catch (e) {}
        return add.call(this, type, fn, opts);
    };
    EventTarget.prototype.removeEventListener = function (type, fn, opts) {
        try {
            for (let i = 0; i < records.length; i++) {
                const r = records[i];
                if (r.t === this && r.type === type && r.fn === fn) { records.splice(i, 1); break; }
            }
        } catch (e) {}
        return rem.call(this, type, fn, opts);
    };
    window.__listenerSnapshot = function () {
        const out = {};
        for (let i = 0; i < records.length; i++) {
            const r = records[i];
            if (!alive(r.t)) continue;
            const k = tag(r.t) + '|' + r.type;
            out[k] = (out[k] || 0) + 1;
        }
        return out;
    };
    window.__listenerDetached = function () {
        let n = 0;
        for (let i = 0; i < records.length; i++) if (!alive(records[i].t)) n++;
        return n;
    };
    // App React ៖ listener នៃធាតុរស់នៅ root (delegation) ➜ node ដែលបោះចោលមិនដឹក listener ➜ ការបញ្ជាក់ថាវដ្តពិតជា
    // បោះ node ចោល ត្រូវរាប់ធាតុដែលដកចេញពី DOM (MutationObserver) · React ចំណាំដោយ container __reactContainer
    let removed = 0;
    const mo = new MutationObserver((list) => {
        for (const m of list) for (const n of m.removedNodes) {
            if (n.nodeType === 1) removed += 1 + n.getElementsByTagName('*').length;
        }
    });
    const start = () => mo.observe(document.documentElement, { childList: true, subtree: true });
    if (document.documentElement) start(); else add.call(document, 'readystatechange', start, { once: true });
    window.__removedElements = () => removed;
    window.__isReactApp = () => {
        const root = document.getElementById('root');
        return !!root && Object.keys(root).some((k) => k.indexOf('__reactContainer$') === 0);
    };
})();`;

// SDK ក្លែង ៖ អនុញ្ញាតឲ្យវដ្ត login/logout · reconnect · reconfig រត់ពិត
// ដោយមិនប៉ះបណ្តាញ។ ⛔ វារាប់ `onValue` ដែលនៅរស់ដែរ។
const FAKE_SDK = function () {
    const listeners = new Map();
    let authCb = null;
    let user = null;
    const refKey = (r) => (r && r.__path) || '?';
    window.__fbLive = () => {
        const out = {};
        listeners.forEach((set, k) => { if (set.size) out[k] = set.size; });
        return out;
    };
    window.__setUser = (u) => { user = u; if (authCb) authCb(u); };
    window.firebaseSDK = {
        initializeApp: () => ({ name: 'fake' }),
        getApps: () => (window.__fbApp ? [window.__fbApp] : []),
        deleteApp: () => { window.__fbApp = null; return Promise.resolve(); },
        getAuth: () => ({ get currentUser() { return user; } }),
        getDatabase: () => ({}),
        ref: (db, p) => ({ __path: p }),
        onValue: (ref, cb, errCb) => {
            const k = refKey(ref);
            const set = listeners.get(k) || new Set();
            set.add(cb);
            listeners.set(k, set);
            setTimeout(() => { try { cb({ val: () => (k === '.info/connected' ? true : null), exists: () => false }); } catch (e) {} }, 5);
            return () => {};
        },
        off: (ref) => { listeners.delete(refKey(ref)); },
        onAuthStateChanged: (a, cb) => { authCb = cb; setTimeout(() => cb(user), 5); return () => { authCb = null; }; },
        signInWithEmailAndPassword: () => Promise.resolve({ user: { uid: 'u1', email: 'a@b.c' } }),
        signOut: () => { window.__setUser(null); return Promise.resolve(); },
        goOnline: () => {}, goOffline: () => {},
        serverTimestamp: () => 0, increment: (n) => n,
        runTransaction: () => Promise.resolve({ committed: true, snapshot: { val: () => null } }),
        set: () => Promise.resolve(), update: () => Promise.resolve(), remove: () => Promise.resolve(),
        get: () => Promise.resolve({ val: () => null, exists: () => false })
    };
    window.__fbApp = { name: 'fake' };
    window.dispatchEvent(new Event('firebasesdkready'));
};

async function boot(browser, port) {
    const ctx = await browser.newContext({ viewport: { width: 412, height: 780 } });
    const page = await ctx.newPage();
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    await page.addInitScript(COUNTER);
    await page.addInitScript('(' + FAKE_SDK.toString() + ')();');
    await page.addInitScript(`try {
        localStorage.setItem('zoew_firebase_config', JSON.stringify({ apiKey: 'k', databaseURL: 'https://x.firebaseio.com', projectId: 'p' }));
        localStorage.setItem('zoew_login_time', String(Date.now()));
        localStorage.removeItem('zoew_security_pin_hash');
        sessionStorage.setItem('zoew_app_unlocked', '1');
    } catch (e) {}`);
    await page.route('**', (r) => r.request().url().startsWith('http://127.0.0.1:' + port) ? r.continue() : r.abort());
    await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2600);
    return { ctx, page };
}

const snap = (page) => page.evaluate(() => ({
    dom: window.__listenerSnapshot(),
    detached: window.__listenerDetached(),
    removed: window.__removedElements(),
    react: window.__isReactApp(),
    nodes: document.getElementsByTagName('*').length,
    fb: typeof window.__fbLive === 'function' ? window.__fbLive() : {}
}));

// ប្រៀបធៀប ២ រូបភាព ៖ ត្រឡប់កូនសោដែល **កើន**
function grew(before, after, allowance) {
    const out = {};
    Object.keys(after).forEach((k) => {
        const b = before[k] || 0;
        if (after[k] > b + (allowance || 0)) out[k] = b + ' ➜ ' + after[k];
    });
    return out;
}

(async () => {
    const browser = await chromium.launch({ executablePath: CHROME });
    let server;
    try { server = await serve(path.join(ROOT, 'ZoeW')); }
    catch (e) { bad('បម្រើថត ZoeW បាន', String(e && e.message)); }
    if (server) {
        const port = server.address().port;
        const s = await boot(browser, port);
        const { page } = s;

        // ⛔ ជាន់អប្បបរមា ៖ ការវាស់ត្រូវពិតជាបានឃើញ listener។ បើអត់
        // នោះការប្រៀបធៀប «គ្មានការកើន» ពិតដោយស្វ័យប្រវត្តិ (បៃតងក្លែងក្លាយ)។
        const first = await snap(page);
        const domTotal = Object.values(first.dom).reduce((a, b) => a + b, 0);
        check(domTotal >= 20, 'ជាន់អប្បបរមា ៖ រាប់ DOM listener បាន ' + domTotal + ' (>= 20)', first.dom);
        check(Object.keys(first.fb).length >= 1, 'ជាន់អប្បបរមា ៖ រាប់ Firebase listener បាន', first.fb);

        // ── វដ្ត ១ ៖ login ➜ logout ➜ login (× 3) ────────────────────
        await page.evaluate(() => window.__setUser({ uid: 'u1', email: 'a@b.c' }));
        await page.waitForTimeout(900);
        const base = await snap(page);
        for (let i = 0; i < 3; i++) {
            await page.evaluate(() => window.__setUser(null));
            await page.waitForTimeout(320);
            await page.evaluate(() => window.__setUser({ uid: 'u1', email: 'a@b.c' }));
            await page.waitForTimeout(420);
        }
        const afterAuth = await snap(page);
        check(Object.keys(grew(base.dom, afterAuth.dom)).length === 0,
            '⛔ វដ្ត login/logout × 3 ➜ DOM listener មិនកកកុញ', grew(base.dom, afterAuth.dom));
        check(Object.keys(grew(base.fb, afterAuth.fb)).length === 0,
            '⛔ វដ្ត login/logout × 3 ➜ Firebase listener មិនកកកុញ', grew(base.fb, afterAuth.fb));
        check(afterAuth.nodes <= base.nodes + NODE_ALLOWANCE,
            '⛔ វដ្ត login/logout × 3 ➜ ចំនួន DOM node មិនកកកុញ', { before: base.nodes, after: afterAuth.nodes });

        // ── វដ្ត ២ ៖ ការភ្ជាប់ឡើងវិញ (initDatabaseListeners × 5) ─────
        // ⛔ **កម្តៅ ១ ជុំមុនថតរូបភាព។** បើថតមុនការភ្ជាប់លើកដំបូង នោះ
        // ការវាស់ឃើញ «0 ➜ 1» ដែលជា **ការភ្ជាប់ដំបូង** មិនមែនការកកកុញ ➜
        // ការធ្លាក់ក្លែងក្លាយ។ អ្វីដែលសួរគឺ «ជុំទី ២ ដល់ទី ៦ បន្ថែមទេ?»។
        await page.evaluate(() => {
            if (typeof initDatabaseListeners === 'function') initDatabaseListeners();
            if (typeof attachInfoListeners === 'function') attachInfoListeners();
        });
        await page.waitForTimeout(420);
        const b2 = await snap(page);
        check(Object.keys(b2.fb).length >= 6,
            'ជាន់អប្បបរមា ៖ ក្រោយកម្តៅ មាន Firebase listener រស់ ' + Object.keys(b2.fb).length + ' path (>= 6)', b2.fb);
        await page.evaluate(() => {
            for (let i = 0; i < 5; i++) {
                if (typeof initDatabaseListeners === 'function') initDatabaseListeners();
                if (typeof attachInfoListeners === 'function') attachInfoListeners();
            }
        });
        await page.waitForTimeout(700);
        const a2 = await snap(page);
        check(Object.keys(grew(b2.fb, a2.fb)).length === 0,
            '⛔ initDatabaseListeners() + attachInfoListeners() × 5 ➜ មិនកកកុញ', grew(b2.fb, a2.fb));
        check(Object.keys(grew(b2.dom, a2.dom)).length === 0,
            '⛔ ការភ្ជាប់ឡើងវិញ × 5 ➜ DOM listener មិនកកកុញ', grew(b2.dom, a2.dom));

        // ── វដ្ត ៣ ៖ initFirebase (reconfig) × 3 ────────────────────
        await page.evaluate(async () => {
            if (typeof initFirebase === 'function') { try { await initFirebase(); } catch (e) {} }
        });
        await page.waitForTimeout(500);
        const b3 = await snap(page);
        await page.evaluate(async () => {
            for (let i = 0; i < 3; i++) {
                if (typeof initFirebase === 'function') { try { await initFirebase(); } catch (e) {} }
            }
        });
        await page.waitForTimeout(900);
        const a3 = await snap(page);
        check(Object.keys(grew(b3.fb, a3.fb)).length === 0,
            '⛔ initFirebase() × 3 (reconfig) ➜ Firebase listener មិនកកកុញ', grew(b3.fb, a3.fb));
        check(Object.keys(grew(b3.dom, a3.dom)).length === 0,
            '⛔ initFirebase() × 3 ➜ DOM listener មិនកកកុញ', grew(b3.dom, a3.dom));

        // ── វដ្ត ៤ ៖ ការប្តូរទំព័រ និងបើក/បិទ modal × 6 ──────────────
        await page.evaluate(async () => {
            const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
            if (typeof switchAppPage === 'function') { switchAppPage('entry'); await sleep(40); switchAppPage('data'); await sleep(40); }
            if (typeof openLockerPicker === 'function') { try { openLockerPicker(); } catch (e) {} await sleep(30); }
            if (typeof closeModal === 'function') { try { closeModal('lockerPickerModal'); } catch (e) {} await sleep(30); }
        });
        await page.waitForTimeout(400);
        const b4 = await snap(page);
        const cycle4 = await page.evaluate(async () => {
            const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
            // ⛔ ភស្តុតាងថាវដ្តរត់ពិត ៖ ប្រអប់ Locker **បើកពិត** ហើយមានប៊ូតុងក្រឡា (រាប់ពេលវាលេច)
            let opened = 0, cells = 0;
            for (let i = 0; i < 6; i++) {
                if (typeof switchAppPage === 'function') { switchAppPage('entry'); await sleep(40); switchAppPage('data'); await sleep(40); }
                if (typeof openLockerPicker === 'function') { try { openLockerPicker(); } catch (e) {} await sleep(30); }
                const modal = document.getElementById('lockerPickerModal');
                if (modal && getComputedStyle(modal).display !== 'none') {
                    opened++;
                    cells = Math.max(cells, modal.querySelectorAll('button').length);
                }
                if (typeof closeModal === 'function') { try { closeModal('lockerPickerModal'); } catch (e) {} await sleep(30); }
            }
            return { opened, cells };
        });
        await page.waitForTimeout(700);
        const a4 = await snap(page);
        check(Object.keys(grew(b4.dom, a4.dom)).length === 0,
            '⛔ ប្តូរទំព័រ + បើក/បិទ modal × 6 ➜ DOM listener មិនកកកុញ', grew(b4.dom, a4.dom));
        // ⛔ ទិសផ្ទុយនៃច្បាប់ `isConnected` ៖ `renderLockerGrid()` សាងប៊ូតុង
        // ថ្មីរាល់ដងរួច `grid.innerHTML = ''` ➜ listener ចាស់អង្គុយលើ node
        // **ដែលផ្តាច់ចេញ** ➜ បាញ់មិនបាន និងត្រូវ GC ➜ **មិនមែនការលេច**។
        // បើការវាស់មិនឃើញ node ផ្តាច់ចេញសោះ នោះមានន័យថាការត្រងនោះ
        // កំពុងលាក់អ្វីមួយ ឬវដ្តមិនបានរត់ ➜ ការអះអាងខាងលើក្លាយជាទទេ។
        check(a4.nodes <= b4.nodes + NODE_ALLOWANCE,
            '⛔ ប្តូរទំព័រ + បើក/បិទ modal × 6 ➜ ចំនួន DOM node មិនកកកុញ', { before: b4.nodes, after: a4.nodes });
        if (a4.react) {
            // App React ៖ ប៊ូតុង Locker ចងតាម prop (React delegation នៅ root) ➜ node ផ្តាច់ **មិនដឹក** listener (០ តាម
            // រចនាសម្ព័ន្ធ) ➜ ទិសផ្ទុយត្រូវជា «វដ្តពិតជាបោះ node ចោល» ហើយ node ផ្តាច់ដែលដឹក listener ត្រូវនៅ ០
            // ⛔ React រក្សាក្រឡាដដែល (reconcile) មិនសាងឡើងវិញរាល់ការបើក ➜ ភស្តុតាងថាវដ្តរត់ពិត = ប្រអប់បើក ៦/៦ ជាមួយ
            //    ប៊ូតុងក្រឡា ≥ ២០ · ហើយ node ផ្តាច់ដែលដឹក listener នៅ ០
            check(cycle4.opened === 6 && cycle4.cells >= 20 && (a4.detached - b4.detached) === 0,
                '⛔ ទិសផ្ទុយ ៖ វដ្ត Locker ពិតជារត់ (ប្រអប់បើក ' + cycle4.opened + '/6 · ក្រឡា ' + cycle4.cells + ') ហើយគ្មាន node ផ្តាច់ដឹក listener',
                { cycle4, removed: [b4.removed, a4.removed], detached: [b4.detached, a4.detached] });
        } else {
            check((a4.detached - b4.detached) >= 100,
                '⛔ ទិសផ្ទុយ ៖ វដ្ត Locker ពិតជាបោះបង់ node ដែលមាន listener (' + (a4.detached - b4.detached) + ' >= 100)',
                { before: b4.detached, after: a4.detached });
        }

        // ── វដ្ត ៥ ៖ online/offline + visibilitychange × 8 ──────────
        const b5 = await snap(page);
        await page.evaluate(async () => {
            const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
            for (let i = 0; i < 8; i++) {
                window.dispatchEvent(new Event('offline'));
                window.dispatchEvent(new Event('online'));
                document.dispatchEvent(new Event('visibilitychange'));
                await sleep(30);
            }
        });
        await page.waitForTimeout(700);
        const a5 = await snap(page);
        check(Object.keys(grew(b5.dom, a5.dom)).length === 0,
            '⛔ online/offline/visibilitychange × 8 ➜ DOM listener មិនកកកុញ', grew(b5.dom, a5.dom));
        check(Object.keys(grew(b5.fb, a5.fb)).length === 0,
            '⛔ online/offline × 8 ➜ Firebase listener មិនកកកុញ', grew(b5.fb, a5.fb));
        check(a5.nodes <= b5.nodes + NODE_ALLOWANCE,
            '⛔ online/offline/visibilitychange × 8 ➜ ចំនួន DOM node មិនកកកុញ', { before: b5.nodes, after: a5.nodes });

        // ⛔ ទិសផ្ទុយ ៖ ការវាស់ត្រូវ **អាចឃើញការកើន** បើវាកើតឡើងពិត។
        // បើអត់ ការអះអាងទាំងអស់ខាងលើពិតដោយស្វ័យប្រវត្តិ។
        const b6 = await snap(page);
        await page.evaluate(() => {
            for (let i = 0; i < 4; i++) document.addEventListener('zoe-leak-probe', function () {});
        });
        const a6 = await snap(page);
        const probe = grew(b6.dom, a6.dom);
        check(probe['document|zoe-leak-probe'] === '0 ➜ 4',
            '⛔ ទិសផ្ទុយ ៖ ការវាស់ឃើញការកកកុញពិត (0 ➜ 4)', probe);

        await s.ctx.close();
        server.close();
    }
    await browser.close();
    console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')' : '✅ ជោគជ័យ ' + pass));
    process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
