// ថ្នាក់កំហុស៖ **CSP បិទមុខងារលើផលិតកម្ម ខណៈតេស្តក្នុង repo ជោគជ័យទាំងអស់។**
//
// តេស្តផ្សេងទៀតក្នុងថតនេះបម្រើ App ដោយ **គ្មាន header CSP សោះ** ➜ អ្វីៗដំណើរការ
// ទាំងអស់។ លើ Netlify វិញ CSP ពិតត្រូវអនុវត្ត។ ថ្នាក់កំហុសនេះចាប់បានពិតម្តងរួច
// មកហើយ (`'wasm-unsafe-eval'` ក្នុងកំណែ 2.10.0 — បើគ្មានវា browser បដិសេធការ
// ចងក្រង WebAssembly ➜ ការស្កេនស្លាប់ទាំងស្រុងលើផលិតកម្ម)។
//
// ចាប់ពីកំណែ 2.13.0 `script-src` **លែងមាន `'unsafe-inline'`** ទៀតហើយ ➜ រាល់
// `onclick="…"` និង `<script>` ខាងក្នុង **នឹងត្រូវ browser បដិសេធ**។ ដូច្នេះ
// តេស្តនេះជាអ្នកយាមផ្លូវ៖ វាបម្រើ App ជាមួយ **header CSP ពិតដកចេញពី
// `netlify.toml`** រួចអះអាងថា គ្មានការរំលោភ CSP ណាមួយ **ហើយ UI នៅដើរ**។
const fs = require('fs');
const http = require('http');
const path = require('path');
const { actionUsages } = require('./react-view');

const root = path.resolve(__dirname, '..');
const appRoot = process.env.CSP_APP_DIR ? path.resolve(process.env.CSP_APP_DIR) : root;
let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { pass++; console.log('   ok    ' + label); }
    else { fail++; console.log('  FAIL   ' + label + (detail !== undefined ? '\n         ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : '')); }
}

function readCsp(app) {
    const toml = fs.readFileSync(path.join(appRoot, app, 'netlify.toml'), 'utf8');
    const m = /Content-Security-Policy\s*=\s*"([^"]+)"/.exec(toml);
    return m ? m[1] : null;
}

// === ផ្នែកទី ១ — ស្តាទិច ===
for (const app of ['ZoeW', 'ZoeKeyGen']) {
    const dir = path.join(appRoot, app);
    if (!fs.existsSync(dir)) continue;
    const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
    const csp = readCsp(app);
    const scriptSrc = csp ? (/script-src([^;]*)/.exec(csp) || [])[1] || '' : '';

    ok(app + ": `script-src` គ្មាន 'unsafe-inline' ទៀតទេ",
        scriptSrc.indexOf("'unsafe-inline'") === -1, scriptSrc.trim());
    ok(app + ": `script-src` គ្មាន 'unsafe-eval'",
        scriptSrc.indexOf("'unsafe-eval'") === -1, scriptSrc.trim());

    const inline = html.match(/<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/g) || [];
    ok(app + ': គ្មាន `<script>` ខាងក្នុង HTML ទៀតទេ', inline.length === 0,
        inline.map((x) => x.slice(0, 70)));

    const handlers = html.match(/\son(?:click|change|input|submit|keyup|keydown|focus|blur|error|load)\s*=\s*"/g) || [];
    ok(app + ': គ្មាន attribute `on*=` ក្នុង index.html', handlers.length === 0, handlers);

    const jsPath = path.join(dir, 'app.js');
    if (fs.existsSync(jsPath)) {
        const js = fs.readFileSync(jsPath, 'utf8');
        const gen = js.match(/\son(?:click|change|input|submit)\s*=\s*"/g) || [];
        ok(app + ': គ្មាន `on*=` ក្នុង HTML ដែលបង្កើតដោយ JS', gen.length === 0, gen);
    }
}

// ZoeW/ZoeKeyGen ត្រូវមានយន្តការ delegation ពិត
for (const app of ['ZoeW', 'ZoeKeyGen']) {
    const js = fs.readFileSync(path.join(appRoot, app, 'app.js'), 'utf8');
    ok(app + ': មានបញ្ជីសកម្មភាពដែលអនុញ្ញាត (ACTION_ALLOWLIST)', /const ACTION_ALLOWLIST = \[/.test(js));
    const allowBlock = (/const ACTION_ALLOWLIST = \[([\s\S]*?)\];/.exec(js) || [])[1] || '';
    const allowed = new Set([...allowBlock.matchAll(/"([^"]+)"/g)].map((m) => m[1]));
    // App React ៖ ព្រំដែនគឺ `act()` ➜ `lookupAction()` ➜ `ACTION_REGISTRY` (own property តែប៉ុណ្ណោះ) ហើយ **គ្មាន**
    // listener delegation កម្រិត `document` ទៀតទេ (វានឹងធ្វើឲ្យសកម្មភាពរត់ ២ ដង ជាមួយ `onClick` របស់ React)
    const isReact = /function lookupAction\(name\)/.test(js);
    if (isReact) {
        ok(app + ': dispatcher ពិនិត្យបញ្ជីមុនហៅ (`lookupAction()` ៖ own property នៃ ACTION_REGISTRY · ឈ្មោះក្រៅបញ្ជី ➜ មិនហៅ)',
            /function lookupAction\(name\) \{\s*if \(!name \|\| !Object\.prototype\.hasOwnProperty\.call\(ACTION_REGISTRY, name\)\) return null;/.test(js) &&
            /function act\(name, \.\.\.args\) \{\s*const fn = lookupAction\(name\);\s*if \(!fn\) \{[^}]*return;\s*\}\s*fn\(\.\.\.args\);/.test(js) &&
            /function onAct\(name, opts\) \{[\s\S]*?\bact\(name, \.\.\.args\);/.test(js));
        const registryBlock = (/const ACTION_REGISTRY = Object\.freeze\(\{([\s\S]*?)\}\);/.exec(js) || [])[1];
        const registry = new Set([...(registryBlock || '').matchAll(/^\s*([A-Za-z_$][\w$]*),?\s*$/gm)].map((m) => m[1]));
        const drift = [...allowed].filter((a) => !registry.has(a)).concat([...registry].filter((a) => !allowed.has(a)));
        ok(app + ': ACTION_REGISTRY ត្រូវ freeze ហើយស្មើ ACTION_ALLOWLIST (គ្មានច្រកចូលទី ២)',
            registryBlock !== undefined && registry.size > 0 && drift.length === 0, drift);
        ok(app + ': គ្មាន delegation `data-act` កម្រិត document (React `onClick` ជាអ្នកស្តាប់តែមួយ)',
            !/closest\(\s*['"]\[data-act\]/.test(js) && !/function setupActionDelegation\(/.test(js));
    } else {
        ok(app + ': dispatcher ពិនិត្យបញ្ជីមុនហៅ (មិនហៅ window[name] ដោយងងឹត)',
            /ACTION_ALLOWLIST\.indexOf\(name\) === -1\) return;/.test(js));
        ok(app + ': មាន setupActionDelegation() ហើយត្រូវហៅពេល boot',
            /function setupActionDelegation\(\)/.test(js) && /\n\s*setupActionDelegation\(\);/.test(js));
    }
    // រាល់ `data-act` ក្នុង HTML ត្រូវស្ថិតក្នុងបញ្ជី ហើយត្រូវជា function ពិត
    const html = fs.readFileSync(path.join(appRoot, app, 'index.html'), 'utf8');
    const usedSet = new Set([...(html + js).matchAll(/data-act="([^"$]+)"/g)].map((m) => m[1]));
    try {
        const reactActs = actionUsages(path.join(appRoot, app), js);
        if (reactActs) reactActs.forEach((a) => usedSet.add(a));
    } catch (e) {
        ok(app + ': អានសកម្មភាពដែល React ហៅបាន', false, e.message);
    }
    const used = [...usedSet];
    const notAllowed = used.filter((a) => !allowed.has(a));
    ok(app + ': រាល់ `data-act` ស្ថិតក្នុងបញ្ជីដែលអនុញ្ញាត', notAllowed.length === 0, notAllowed);
    const notDefined = [...allowed].filter((a) => !new RegExp('function ' + a + '\\s*\\(').test(js));
    ok(app + ': រាល់សកម្មភាពក្នុងបញ្ជីមាន function ពិត', notDefined.length === 0, notDefined);
    const unused = [...allowed].filter((a) => used.indexOf(a) === -1);
    ok(app + ': បញ្ជីគ្មានធាតុលើស (សិទ្ធិតូចបំផុត)', unused.length === 0, unused);
}

// === ផ្នែកទី ២ — CSP ពិតត្រូវអនុវត្តក្នុង Chromium ===
let chromium;
try { chromium = require('playwright-core').chromium; } catch (e) {
    console.log('\nSKIP ផ្នែក browser — ត្រូវការ playwright-core');
    console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')' : '✅ ជោគជ័យ ' + pass));
    process.exit(fail ? 1 : 0);
}
const CHROME = process.env.CSP_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
if (!fs.existsSync(CHROME)) {
    console.log('\nSKIP ផ្នែក browser — រកមិនឃើញ Chromium');
    console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')' : '✅ ជោគជ័យ ' + pass));
    process.exit(fail ? 1 : 0);
}

const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.png': 'image/png' };
const LICENSE_STUB = `window.ZoeLicense = {
    getStatus: function () { return Promise.resolve({ state: 'active' }); },
    setServerTimeOffset: function () {}, syncServerTime: function () { return Promise.resolve(); },
    activate: function () { return Promise.resolve({ ok: true }); },
    verifyKeyString: function () { return Promise.resolve({ ok: true }); }, clearActivation: function () {}
};`;

const FAKE_SDK = function (seed) {
    const store = JSON.parse(JSON.stringify(seed));
    window.__fakeStore = store;
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
    function snapOf(p) {
        const v = getPath(p);
        return { val: () => (v === undefined || v === null) ? null : (typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v), exists: () => v !== null && v !== undefined };
    }
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
            setTimeout(() => { if (r.path === '.info/connected') cb({ val: () => true }); else cb(snapOf(r.path)); }, 0);
            return () => {};
        },
        off: () => {}, get: (r) => Promise.resolve(snapOf(r.path)),
        set: () => Promise.resolve(), update: () => Promise.resolve(),
        goOnline: () => {}, goOffline: () => {}, increment: (n) => ({ __inc: n }),
        runTransaction: (r, fn) => { const c = getPath(r.path); const n = fn(c === null ? null : JSON.parse(JSON.stringify(c))); return Promise.resolve({ committed: n !== undefined, snapshot: snapOf(r.path) }); }
    };
    window.dispatchEvent(new Event('firebasesdkready'));
};

function serve(dir, csp) {
    return new Promise((res) => {
        const s = http.createServer((req, rsp) => {
            let p = decodeURIComponent(req.url.split('?')[0]);
            if (p === '/') p = '/index.html';
            const f = path.join(dir, p);
            if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); return rsp.end(); }
            // **header CSP ពិត** ដកចេញពី netlify.toml — នេះជាចំណុចសំខាន់នៃតេស្ត
            rsp.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'text/plain', 'Content-Security-Policy': csp });
            rsp.end(fs.readFileSync(f));
        });
        s.listen(0, '127.0.0.1', () => res(s));
    });
}

const D = (() => { const t = new Date(); return t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0'); })();

(async () => {
    const csp = readCsp('ZoeW');
    ok('អាន CSP ពិតចេញពី ZoeW/netlify.toml បាន', !!csp && csp.indexOf('script-src') !== -1);
    const dir = path.join(appRoot, 'ZoeW');
    const server = await serve(dir, csp);
    const origin = 'http://127.0.0.1:' + server.address().port;
    const browser = await chromium.launch({ executablePath: CHROME });
    const ctx = await browser.newContext({ viewport: { width: 412, height: 780 } });
    const page = await ctx.newPage();
    const violations = [];
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e && e.message || e)));
    await page.addInitScript(`window.addEventListener('unhandledrejection', function (ev) {
            var m; try { m = String((ev.reason && (ev.reason.message || ev.reason)) || 'unknown'); } catch (x) { m = 'unknown'; }
            setTimeout(function () { throw new Error('unhandledrejection: ' + m); }, 0);
        });`);
    const dialogs = [];
    page.on('dialog', (d) => { dialogs.push(d.message()); d.accept(); });
    // សារដែល `loginWithFirebase()` បង្ហាញពេលវាលទទេ — អានចេញពី `app.js` ពិត (មិនមែន literal ទី ២)
    const loginEmptyMessage = (/if \(!email \|\| !password\) \{\s*alert\((["'])([^"']+)\1\)/.exec(
        fs.readFileSync(path.join(appRoot, 'ZoeW', 'app.js'), 'utf8')) || [])[2] || null;
    ok('អានសារ «វាលទទេ» របស់ `loginWithFirebase()` ពី app.js បាន', !!loginEmptyMessage);
    await page.addInitScript(() => {
        window.__cspViolations = [];
        document.addEventListener('securitypolicyviolation', (e) => {
            window.__cspViolations.push({
                directive: e.violatedDirective,
                blocked: String(e.blockedURI || '').slice(0, 80),
                sample: String(e.sample || '').slice(0, 80)
            });
        });
    });
    await page.route('**', (route) => {
        const u = route.request().url();
        if (u.indexOf('/license-verify.js') !== -1) return route.fulfill({ status: 200, contentType: 'application/javascript', headers: { 'Content-Security-Policy': csp }, body: LICENSE_STUB });
        if (u.startsWith(origin)) return route.continue();
        return route.abort();
    });
    await page.addInitScript(`window.localStorage.setItem('zoew_firebase_config', ${JSON.stringify(JSON.stringify({ apiKey: 'k', databaseURL: 'https://fake-default-rtdb.firebaseio.com', projectId: 'p' }))});`);
    await page.addInitScript('(' + FAKE_SDK.toString() + ')(' + JSON.stringify({
        user_roles: { 'admin-uid': 'admin' },
        zoew_scan_history_cod_dod: {
            row1: { id: 'row1', phone: '011222333', scanDate: D, cod: 5, dod: 1, count: 1, barcode: 'BC1', time: '09:00', isClosed: false,
                barcodes: [{ code: 'BC1', cod: 5, dod: 1, locker: 'A1', isClosed: false, time: '09:00', isDeducted: false, isFromDeletion: false }] }
        },
        zoew_recently_deleted_cod_dod: {},
        zoew_daily_revenue_cod_dod: { [D]: { codDollar: 5, dodDollar: 1, totalCount: 1 } },
        zoew_monthly_revenue_cod_dod: {}, zoew_daily_pickup_cod_dod: {},
        zoew_settings: { exchange_rate: 4100 }
    }) + ');');

    await page.goto(origin + '/', { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(2500);

    const boot = await page.evaluate(() => ({
        violations: window.__cspViolations || [],
        hasShell: !!document.getElementById('appPages'),
        appJs: typeof window.initScanEngine === 'function',
        // App React ៖ ធាតុ `data-act` ត្រូវមាន handler `onAct()` ពិតរបស់ React (actionName ស្មើ data-act)
        delegation: typeof window.setupActionDelegation === 'function' || (() => {
            const els = Array.from(document.querySelectorAll('[data-act]'));
            return els.length > 0 && els.some((el) => {
                const k = Object.keys(el).find((x) => x.startsWith('__reactProps$'));
                return !!k && !!el[k] && Object.values(el[k]).some((h) => h && h.actionName === el.getAttribute('data-act'));
            });
        })(),
        iosClassHookRan: typeof window.ACTION_ALLOWLIST !== 'undefined' || true
    }));
    violations.push(...boot.violations);
    ok('**គ្មានការរំលោភ CSP ពេល boot** (script-src តឹងរឹង)', boot.violations.length === 0, boot.violations);
    ok('សំបក App ឡើងពេញលេញក្រោម CSP តឹងរឹង', boot.hasShell && boot.appJs, boot);
    ok('យន្តការ delegation មានវត្តមាន', boot.delegation);

    // --- ប៊ូតុងឋិតិវន្ត (data-args JSON) ---
    const staticBtn = await page.evaluate(async () => {
        const before = document.querySelectorAll('#historyTableBody tr').length;
        const btn = document.getElementById('btnFilterAll');
        if (!btn) return { err: 'no btnFilterAll' };
        btn.click();
        await new Promise((r) => setTimeout(r, 400));
        return { before, active: btn.classList.contains('active'), rows: document.querySelectorAll('#historyTableBody tr').length };
    });
    ok('**ប៊ូតុងឋិតិវន្តនៅដើរ** (`data-act` + `data-args`)', !staticBtn.err && staticBtn.active === true, staticBtn);

    // --- របា Slide (ការហៅគ្មានអាគុយម៉ង់) ---
    const drawer = await page.evaluate(async () => {
        const btn = document.querySelector('[data-act="openSideDrawer"]');
        if (!btn) return { err: 'no drawer button' };
        btn.click();
        await new Promise((r) => setTimeout(r, 300));
        const d = document.getElementById('sideDrawer');
        return { open: !!d && d.classList.contains('open') };
    });
    ok('របា Slide បើកបាន (សកម្មភាពគ្មានអាគុយម៉ង់)', drawer.open === true, drawer);

    // --- ជួរដេកដែលបង្កើតដោយ JS (data-a1 / data-a2) ---
    const rowBtn = await page.evaluate(async () => {
        window.closeSideDrawer && window.closeSideDrawer();
        await new Promise((r) => setTimeout(r, 200));
        const tr = document.querySelector('#historyTableBody tr[data-id]');
        if (!tr) return { err: 'no row' };
        const btn = tr.querySelector('[data-act="openViewListModal"]');
        if (!btn) return { err: 'no view-list button', html: tr.innerHTML.slice(0, 200) };
        // ⛔ វាស់ **ផល** មិនមែនជំនួស `window.openViewListModal` — App React ហៅតាម `ACTION_REGISTRY` មិនឆ្លង `window`
        // ➜ id ខុស = ប្រអប់មិនបង្ហាញលេខទូរស័ព្ទ/Barcode របស់ជួរ `row1`
        const phoneEl = document.getElementById('listModalPhoneText');
        const listEl = document.getElementById('barcodeListContainer');
        const before = { phone: phoneEl ? phoneEl.textContent : null, list: listEl ? listEl.textContent : null };
        btn.click();
        await new Promise((r) => setTimeout(r, 300));
        const phone = document.getElementById('listModalPhoneText');
        const list = document.getElementById('barcodeListContainer');
        const shown = !!phone && phone.textContent.indexOf('011222333') !== -1 && !!list && list.textContent.indexOf('BC1') !== -1;
        return { before, got: shown ? 'row1' : null, phone: phone && phone.textContent, list: list && list.textContent.slice(0, 80) };
    });
    ok('**ប៊ូតុងក្នុងជួរដេកនៅដើរ ហើយបញ្ជូន id ត្រឹមត្រូវ**',
        rowBtn.got === 'row1' && !!rowBtn.before && (rowBtn.before.phone || '').indexOf('011222333') === -1, rowBtn);

    // --- ការ submit ទម្រង់ (ផ្លូវចូលប្រព័ន្ធ — ព្រឹត្តិការណ៍ក្រៅ `click`) ---
    dialogs.length = 0;
    const formSubmit = await page.evaluate(async () => {
        const form = document.querySelector('form[data-act="submitLoginForm"]');
        if (!form) return { err: 'no login form' };
        let defaultPrevented = null;
        // ⛔ វាស់ **ផល** ៖ វាលទទេ ➜ `loginWithFirebase()` ពិតបង្ហាញសារ «សូមបញ្ចូល…» (មិនជំនួស `window.*`)
        const ev = new Event('submit', { bubbles: true, cancelable: true });
        form.dispatchEvent(ev);
        defaultPrevented = ev.defaultPrevented;
        await new Promise((r) => setTimeout(r, 250));
        return { defaultPrevented };
    });
    formSubmit.called = !!loginEmptyMessage && dialogs.indexOf(loginEmptyMessage) !== -1;
    ok('**ការ submit ទម្រង់ចូលប្រព័ន្ធនៅដើរ** (`data-on="submit"`)',
        formSubmit.called === true, { formSubmit, dialogs, expected: loginEmptyMessage });
    ok('ការ submit ត្រូវបានទប់ (ទំព័រមិន reload)', formSubmit.defaultPrevented === true, formSubmit);

    const after = await page.evaluate(() => window.__cspViolations || []);
    ok('**គ្មានការរំលោភ CSP ក្រោយអន្តរកម្មទាំងអស់**', after.length === 0, after);
    const realErrs = pageErrors.filter((e) => !/net::ERR_FAILED|Failed to load resource|ERR_BLOCKED|ERR_ABORTED/i.test(e));
    ok('គ្មានកំហុស runtime ក្រោម CSP តឹងរឹង', realErrs.length === 0, realErrs.slice(0, 3));

    await ctx.close();
    await browser.close();
    await new Promise((r) => { server.close(r); if (server.closeAllConnections) server.closeAllConnections(); });
    console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')' : '✅ ជោគជ័យ ' + pass));
    process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e && e.stack || e); process.exit(1); });
