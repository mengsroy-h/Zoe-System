// ថ្នាក់កំហុស៖ **ចលនាផ្ទាំងប្រវត្តិលើ iOS មិនដូច Android**។
//
// អ្នកប្រើរាយការណ៍ថា ពេលយក iPhone ទៅធៀបជាមួយ Android វា «មើលទៅដូច
// App ២ ផ្សេងគ្នា»។ មូលហេតុ៖ កំណែ 2.11.3 បានបិទ FLIP (`panelGlideFrom`)
// លើផ្លូវ iOS សម្រាប់ទិស `expand` ដោយខ្លាចថា transform 220ms លើ
// `.page-main` (ដែលជា `scroll-snap-align` target) នឹងធ្វើឲ្យ WebKit
// snap outer scroller ឡើងវិញ ➜ ផ្ទាំងប្រវត្តិ **លោតភ្លាម** ពេលធ្លាក់ចុះ
// ខណៈ Android រអិល 220ms។
//
// ដំណោះស្រាយត្រឹមត្រូវមិនមែនការដកចលនាចេញទេ — គឺ **ផ្អាក snap**
// (`scroll-snap-type: none`) តែក្នុងអំឡុងចលនា រួច **ស្តារវិញ**។
// ការស្តារវិញជាចំណុចស្លាប់រស់៖ បើ snap មិនត្រឡប់មក នោះចំណុច snap «បើក»
// ធ្លាក់ត្រឹម scrollTop 71 ➜ **PTR លែងកេះបានទាំងស្រុង** (វាទាមទារ <= 1)។
//
// តេស្តនេះបញ្ជូនកូដពិតក្នុង Chromium ដោយបើក iOS gate ទាំង JS
// (`navigator.standalone` + `CSS.supports('-webkit-touch-callout')`)
// និង CSS (ស្រង់ប្លុក `@supports` ចេញរួចចាក់ចូលដោយដៃ ព្រោះ Chromium
// ត្រឡប់ `false` សម្រាប់ `-webkit-touch-callout` ➜ ច្បាប់ក្នុងនោះ
// **មិនដែលត្រូវសាកសោះ** បើមិនចាក់វា)។
let chromium;
try { chromium = require('playwright-core').chromium; } catch (e) { console.log('SKIP — ត្រូវការ playwright-core'); process.exit(0); }
const CHROME = process.env.IOSGLIDE_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const fs = require('fs'), http = require('http'), path = require('path');

// ⛔ ថ្ងៃដែល seed ត្រូវគណនាតាម **ប្រតិទិនកម្ពុជា** ដូច App (កំណែ 2.20.5)។
// មុននេះវាប្រើប្រតិទិន **ឧបករណ៍** ➜ ក្នុងបង្អួច ៧ ម៉ោងរៀងរាល់យប់
// (00:00–07:00 ម៉ោងកម្ពុជា = 17:00–23:59 UTC) runner ដែលកំណត់ជា UTC
// នៅថ្ងៃមុន ខណៈ App នៅថ្ងៃបន្ទាប់ ➜ ជួរដេកដែល seed មិនត្រូវនឹងតម្រង
// «ថ្ងៃនេះ» ➜ គ្មានជួរដេកបង្ហាញ ➜ waitForFunction timeout។
const APP_ZONE = 'Asia/Phnom_Penh';
function zoneDateKey(ms, dayOffset) {
    const p = new Intl.DateTimeFormat('en-CA', {
        timeZone: APP_ZONE, year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(ms).split('-');
    const base = Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    const s = new Date(base + (dayOffset || 0) * 86400000);
    return s.getUTCFullYear() + '-'
        + String(s.getUTCMonth() + 1).padStart(2, '0') + '-'
        + String(s.getUTCDate()).padStart(2, '0');
}

if (!fs.existsSync(CHROME)) { console.log('SKIP — រកមិនឃើញ Chromium'); process.exit(0); }
const ROOT = process.env.IOSGLIDE_APP_DIR || path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm' };

let pass = 0, fail = 0;
function check(c, n, d) { if (c) { console.log('  ok    ' + n); pass++; } else { console.log('  FAIL  ' + n + (d ? '\n        ' + d : '')); fail++; } }

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

const LICENSE_STUB = `window.ZoeLicense = { getStatus: () => Promise.resolve({ state: 'active' }), setServerTimeOffset(){}, syncServerTime: () => Promise.resolve(), activate: () => Promise.resolve({ ok: true }), verifyKeyString: () => Promise.resolve({ ok: true }), clearActivation(){} };`;

const BOOT = function (seed, iosGate) {
    if (iosGate) {
        try { Object.defineProperty(window.navigator, 'standalone', { configurable: true, value: true }); } catch (e) {}
        try {
            const nativeSupports = window.CSS.supports.bind(window.CSS);
            Object.defineProperty(window.CSS, 'supports', {
                configurable: true,
                value: (property, value) => (property === '-webkit-touch-callout' && value === 'none') ? true : nativeSupports(property, value)
            });
        } catch (e) {}
    }
    const store = JSON.parse(JSON.stringify(seed));
    const listeners = [];
    function getPath(p) {
        if (!p || p === '/') return store;
        let cur = store;
        for (const part of p.split('/').filter(Boolean)) { if (cur === null || typeof cur !== 'object') return null; cur = cur[part]; }
        return cur === undefined ? null : cur;
    }
    function setPath(p, val) {
        const parts = p.split('/').filter(Boolean); if (!parts.length) return;
        let cur = store;
        for (let i = 0; i < parts.length - 1; i++) { if (cur[parts[i]] === null || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {}; cur = cur[parts[i]]; }
        const last = parts[parts.length - 1];
        if (val === null) delete cur[last]; else cur[last] = JSON.parse(JSON.stringify(val));
    }
    function snapOf(p) { const v = getPath(p); return { val: () => (v === undefined || v === null) ? null : (typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v), exists: () => v !== null && v !== undefined }; }
    function fire(p) { listeners.filter((l) => l.path === p).forEach((l) => { try { l.cb(snapOf(p)); } catch (e) {} }); }
    function fireAll() { [...new Set(listeners.map((l) => l.path))].forEach(fire); }
    const user = { uid: 'admin-uid', email: 'a@b.c', getIdToken: () => Promise.resolve('tok'), metadata: { lastSignInTime: new Date().toISOString() } };
    window.firebaseSDK = {
        initializeApp: () => ({ name: 'fake' }), getApps: () => [], deleteApp: () => Promise.resolve(),
        getAuth: () => ({ currentUser: user }),
        onAuthStateChanged: (a, cb) => { setTimeout(() => cb(user), 0); return () => {}; },
        signInWithEmailAndPassword: () => Promise.resolve({ user }), signOut: () => Promise.resolve(),
        setPersistence: () => Promise.resolve(), browserLocalPersistence: {}, browserSessionPersistence: {},
        getIdTokenResult: () => Promise.resolve({ authTime: new Date().toISOString(), claims: {} }),
        getDatabase: () => ({ fake: true }), ref: (d, p) => ({ path: p === undefined ? '' : String(p) }),
        onValue: (r, cb) => { listeners.push({ path: r.path, cb }); setTimeout(() => { if (r.path === '.info/connected') cb({ val: () => true }); else cb(snapOf(r.path)); }, 0); return () => {}; },
        off: () => {}, goOnline: () => {},
        get: (r) => Promise.resolve(snapOf(r.path)),
        set: (r, v) => { setPath(r.path, v); fireAll(); return Promise.resolve(); },
        update: (r, o) => { Object.keys(o).forEach((k) => setPath((r.path ? r.path + '/' : '') + k, o[k])); fireAll(); return Promise.resolve(); },
        increment: (n) => ({ __inc: n }),
        runTransaction: (r, fn) => { const c = getPath(r.path); const n = fn(c === null ? null : JSON.parse(JSON.stringify(c))); if (n === undefined) return Promise.resolve({ committed: false, snapshot: snapOf(r.path) }); setPath(r.path, n); fireAll(); return Promise.resolve({ committed: true, snapshot: snapOf(r.path) }); }
    };
    window.dispatchEvent(new Event('firebasesdkready'));
};

function seedBig(n) {
    const t = new Date();
    const d = zoneDateKey(Date.now(), 0);
    const now = Date.now();
    const hist = {};
    let cod = 0, cnt = 0;
    for (let i = 0; i < n; i++) {
        const id = 'id_' + (now - i * 1000) + '_' + i;
        const bcs = [];
        const per = (i % 3) + 1;
        for (let k = 0; k < per; k++) {
            bcs.push({ code: 'PF' + i + '_' + k, time: '10:00', cod: 5, dod: 0, locker: 'A' + (i % 40), isClosed: (i % 4 === 0), isDeducted: false, isFromDeletion: false, createdAt: now - i * 1000 });
            cod += 5; cnt++;
        }
        hist[id] = { id, phone: '09' + String(60000000 + i).slice(0, 8), scanDate: d, createdAt: now - i * 1000, cod: 5 * per, dod: 0, price: 5 * per, count: per, barcode: bcs[0].code, time: '10:00', isClosed: (i % 4 === 0), barcodes: bcs };
        if (hist[id].isClosed) hist[id].closedAt = now - i * 1000;
    }
    return {
        user_roles: { 'admin-uid': 'admin' },
        zoew_scan_history_cod_dod: hist, zoew_recently_deleted_cod_dod: {},
        zoew_daily_revenue_cod_dod: { [d]: { codDollar: cod, dodDollar: 0, totalCount: cnt } },
        zoew_monthly_revenue_cod_dod: {}, zoew_daily_pickup_cod_dod: {}, zoew_scanner_lookup: {},
        zoew_barcode_registry: {}, zoew_settings: { exchange_rate: 4100 }
    };
}

// ស្រង់ប្លុក `@supports (-webkit-touch-callout: none) { ... }` ចេញពី style.css
function extractIOSBlock(cssSrc) {
    const at = cssSrc.indexOf('@supports (-webkit-touch-callout: none) {');
    if (at === -1) return null;
    let depth = 0, start = cssSrc.indexOf('{', at), end = start;
    for (let k = start; k < cssSrc.length; k++) {
        if (cssSrc[k] === '{') depth++;
        else if (cssSrc[k] === '}') { depth--; if (!depth) { end = k; break; } }
    }
    return cssSrc.slice(start + 1, end);
}

// រង្វាស់ចលនាមួយជុំ៖ collapse ➜ expand ដោយចុច #dragHandle ដូចអ្នកប្រើពិត។
// វាស់ **គ្រប់ស៊ុម** តាម rAF ដើម្បីដឹងថាកាតរំកិលបន្តិចម្តងៗ ឬលោតតែម្តង។
const MEASURE = async () => {
    const wait = (ms) => new Promise((x) => setTimeout(x, ms));
    const snapSeen = [];
    const snapFailures = [];
    const frames = (n) => new Promise((res) => {
        const out = [];
        const main = document.getElementById('dataMainSection');
        const pg = document.getElementById('appPages');
        let left = n;
        const tick = () => {
            const tr = getComputedStyle(main).transform;
            const m = /matrix\(([^)]*)\)/.exec(tr);
            const dy = m ? Math.round(parseFloat(m[1].split(',')[5]) || 0) : 0;
            out.push(dy);
            if (Math.abs(dy) > 1) {
                const snap = getComputedStyle(pg).scrollSnapType;
                snapSeen.push(snap);
                if (snap !== 'none') snapFailures.push({
                    at: performance.now(), transform: tr, snap,
                    currentTransform: getComputedStyle(main).transform,
                    paused: pg.classList.contains('panel-gliding'), tokens: panelGlideTokens,
                    animations: main.getAnimations().map(a => ({
                        playState: a.playState, currentTime: a.currentTime,
                        pending: a.pending, duration: a.effect.getTiming().duration
                    }))
                });
            }
            if (--left <= 0) return res(out);
            requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    });
    const pages = document.getElementById('appPages');
    const side = document.getElementById('dataSideSection');
    const handle = document.getElementById('dragHandle');
    const out = {};

    out.snapBefore = getComputedStyle(pages).scrollSnapType;

    // --- ទិស «ឡើង» (collapse) ---
    handle.click();
    const upFrames = await frames(14);
    out.collapsedAfterUp = side.classList.contains('collapsed');
    out.upTravel = Math.max(...upFrames.map(Math.abs));
    out.upMovingFrames = upFrames.filter((v) => Math.abs(v) > 1).length;
    await wait(400);
    out.snapDuringSettled = getComputedStyle(pages).scrollSnapType;

    // --- ទិស «ចុះ» (expand) — នេះជាទិសដែល iOS លោត ---
    handle.click();
    const downFrames = await frames(14);
    out.downTravel = Math.max(...downFrames.map(Math.abs));
    out.downMovingFrames = downFrames.filter((v) => Math.abs(v) > 1).length;
    await wait(400);

    out.collapsedAfterDown = side.classList.contains('collapsed');

    // --- ការអូសដោយម្រាមដៃពិត (នេះជាអ្វីដែលអ្នកប្រើធ្វើ មិនមែនចុចដងអូសទេ) ---
    // ផ្លូវ `applyPanelAction()` ខុសពីផ្លូវ click របស់ដងអូស ➜ ត្រូវសាកទាំង ២។
    const table = document.getElementById('tableResponsive');
    const t = (el, type, y) => {
        const touch = new Touch({ identifier: 7, target: el, clientX: 100, clientY: y,
                                  pageX: 100, pageY: y, screenX: 100, screenY: y });
        const ended = type === 'touchend' || type === 'touchcancel';
        el.dispatchEvent(new TouchEvent(type, {
            bubbles: true, cancelable: true,
            touches: ended ? [] : [touch],
            targetTouches: ended ? [] : [touch],
            changedTouches: [touch]
        }));
    };
    // អូសឡើង លើតារាង ➜ ផ្ទាំងត្រូវបង្រួម (collapse)
    t(table, 'touchstart', 500); t(table, 'touchmove', 380); t(table, 'touchend', 380);
    const upSwipeFrames = await frames(14);
    out.swipeUpTravel = Math.max(...upSwipeFrames.map(Math.abs));
    out.swipeUpCollapsed = side.classList.contains('collapsed');
    await wait(400);
    // អូសចុះ លើតារាងនៅកំពូល ➜ ផ្ទាំងត្រូវត្រឡប់មកវិញ (expand)
    table.scrollTop = 0;
    t(table, 'touchstart', 300); t(table, 'touchmove', 430); t(table, 'touchend', 430);
    const downSwipeFrames = await frames(14);
    out.swipeDownTravel = Math.max(...downSwipeFrames.map(Math.abs));
    out.swipeDownExpanded = !side.classList.contains('collapsed');
    await wait(400);

    out.snapAfter = getComputedStyle(pages).scrollSnapType;
    out.residualTransform = getComputedStyle(document.getElementById('dataMainSection')).transform;
    out.pagesScrollTop = pages.scrollTop;
    // snap ត្រូវនៅតែធ្វើការ៖ រមូរទៅ 30 រួចវាត្រូវរអិលត្រឡប់មក 0
    pages.scrollTop = 30;
    await wait(400);
    out.snapRestNearTop = pages.scrollTop;
    pages.scrollTop = 0;
    out.snapWhileMoving = snapSeen.slice();
    out.snapFailures = snapFailures;
    return out;
};

// ចុចដងអូសពិត និងប្រើ WAAPI ពិត។ ផ្អាកចលនាចាស់ដោយចេតនាដើម្បីគ្រប់គ្រង
// លំដាប់ callback ក្រោយ watchdog/cleanup; នេះមិនមែនការវាស់ទូរស័ព្ទពិតទេ។
const MEASURE_OWNERSHIP = async () => {
    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
    const frame = () => new Promise(requestAnimationFrame);
    const main = document.getElementById('dataMainSection');
    const pages = document.getElementById('appPages');
    const handle = document.getElementById('dragHandle');
    const snapBefore = getComputedStyle(pages).scrollSnapType;
    const observations = [];
    const state = animation => ({
        snap: getComputedStyle(pages).scrollSnapType,
        paused: pages.classList.contains('panel-gliding'),
        playState: animation.playState, currentTime: animation.currentTime,
        duration: animation.effect.getTiming().duration
    });
    for (const action of ['cancel', 'finish', 'cleanup']) {
        handle.click();
        const old = main.getAnimations()[0];
        if (!old) throw new Error('ចុចលើកទី១មិនបង្កើតចលនា');
        old.pause();
        old.currentTime = 50;
        await frame();
        if (action === 'cleanup') endPanelGlideSnapPause();
        else await wait(PANEL_GLIDE_MS + PANEL_GLIDE_SNAP_GRACE_MS + 30);
        const reset = state(old);
        handle.click();
        const current = main.getAnimations().find(a => a !== old);
        if (!current) throw new Error('ចុចលើកទី២មិនបង្កើតចលនា');
        await frame();
        const before = state(current);
        if (action === 'finish') old.finish();
        else old.cancel();
        await frame();
        const after = state(current);
        await current.finished;
        await wait(50);
        observations.push({ action, snapBefore, reset, before, after, ended: state(current) });
        await wait(350);
    }
    return observations;
};

(async () => {
    const browser = await chromium.launch({ executablePath: CHROME });
    const server = await serve(path.join(ROOT, 'ZoeW'));
    const port = server.address().port;
    const cssSrc = fs.readFileSync(path.join(ROOT, 'ZoeW', 'style.css'), 'utf8');
    const iosBlock = extractIOSBlock(cssSrc);
    const results = [];
    const ok = (n, c, d) => results.push([n, !!c, d]);

    ok('style.css មានប្លុក @supports (-webkit-touch-callout: none)', iosBlock !== null);

    const runs = {};
    const openApp = async (mode) => {
        const ctx = await browser.newContext({ viewport: { width: 412, height: 780 }, hasTouch: true, isMobile: true });
        const page = await ctx.newPage();
        page.on('dialog', (d) => d.accept());
        page.on('pageerror', (e) => ok(mode + ': គ្មាន pageerror', false, e.message));
        await page.addInitScript(`window.addEventListener('unhandledrejection', function (ev) {
                    var m; try { m = String((ev.reason && (ev.reason.message || ev.reason)) || 'unknown'); } catch (x) { m = 'unknown'; }
                    setTimeout(function () { throw new Error('unhandledrejection: ' + m); }, 0);
                });`);
        await page.route('**', (r) => {
            const u = r.request().url();
            if (u.indexOf('/license-verify.js') !== -1) return r.fulfill({ status: 200, contentType: 'application/javascript', body: LICENSE_STUB });
            if (u.startsWith('http://127.0.0.1:' + port)) return r.continue();
            return r.abort();
        });
        await page.addInitScript(`window.localStorage.setItem('zoew_firebase_config', ${JSON.stringify(JSON.stringify({ apiKey: 'k', databaseURL: 'https://fake-default-rtdb.firebaseio.com', projectId: 'p' }))});`);
        await page.addInitScript('(' + BOOT.toString() + ')(' + JSON.stringify(seedBig(120)) + ',' + (mode === 'ios') + ');');
        await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForFunction(() => document.querySelectorAll('#historyTableBody tr').length > 5, null, { timeout: 30000 });
        if (mode === 'ios' && iosBlock) {
            await page.addStyleTag({ content: iosBlock });
            // ⛔ iOS ពិតមិនផ្គូផ្គង `@supports (not (-webkit-touch-callout: none))` ➜ ដកប្លុកទាំងនោះចេញ (ស៊ុមក្លែងរបស់ Android)
            await page.evaluate(() => {
                const walk = (list, owner) => {
                    for (let i = list.length - 1; i >= 0; i--) {
                        const r = list[i];
                        if (r instanceof CSSSupportsRule && /not\s*\(\s*-webkit-touch-callout/.test(r.conditionText)) owner.deleteRule(i);
                        else if (r.cssRules) walk(r.cssRules, r);
                    }
                };
                for (const sh of Array.from(document.styleSheets)) { let rules; try { rules = sh.cssRules; } catch (e) { continue; } walk(rules, sh); }
            });
        }
        await page.waitForTimeout(300);

        const gate = await page.evaluate(() => ({
            standalone: window.navigator.standalone === true,
            callout: window.CSS.supports('-webkit-touch-callout', 'none')
        }));
        ok(mode + ': iOS gate ត្រូវនឹងរបៀបដែលរំពឹងទុក',
            (mode === 'ios') === (gate.standalone && gate.callout), JSON.stringify(gate));
        return { ctx, page };
    };
    for (const mode of ['android', 'ios']) {
        const { ctx, page } = await openApp(mode);
        runs[mode] = await page.evaluate(MEASURE);
        runs[mode].ownership = await page.evaluate(MEASURE_OWNERSHIP);
        await ctx.close();
    }

    // ៧ — ⛔ ប្រអប់ស្វែងរកលេខទូរស័ព្ទដែលហូតឡើង (`search-focus`) មិនត្រូវបាត់ពេលអូសបញ្ជី (រាយការណ៍ម្ចាស់គម្រោង ៖ «PWA iOS ពេលកំពុងស្វែងរក scroll list
    //    ទៅក្រោម បាត់ប្រអប់ស្វែងរក»)។ ទ្វារ ២ ៖ (ក) keyboard បើក · លទ្ធផលតិច (តារាងរមូរមិនបាន) ➜ ការអូសហូរទៅ `#appPages` ➜ snap ត្រឹមក្បាល `.page-main` ➜ កាត
    //    ស្វែងរកនៅក្រោម navbar · (ខ) keyboard បិទ (blur) តែលេខនៅ ➜ អូសឡើង = `collapse` ➜ ផ្ទាំងទាំងមូល (រួមកាតស្វែងរក) លាក់។ ការអូសដោយម្រាមដៃពិត (CDP
    //    `Input.dispatchTouchEvent`) ព្រោះ TouchEvent ក្លែង មិនរមូរ · Android និង iOS ដូចគ្នា។ ទិសផ្ទុយ ៖ បញ្ជីវែង ➜ តារាងរមូរខ្លួនឯង · snap នៅផ្អាកអំឡុងចលនាហូតឡើង។
    const searchRuns = {};
    for (const mode of ['android', 'ios']) {
        const { ctx, page } = await openApp(mode);
        const cdp = await ctx.newCDPSession(page);
        const out = {};
        const drag = async () => {
            const box = await page.locator('#tableResponsive').boundingBox();
            const x = box.x + box.width / 2;
            // ចាប់ផ្តើមក្នុងបញ្ជីដែលមើលឃើញ (មិនមែនគែមកាតខាងក្រោម ៖ Android `::after` ចាប់ការចុចនៅលើរបា Tab)
            const y0 = Math.round(box.y + Math.min(box.height, 400) * 0.8);
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0, id: 1 }] });
            for (let k = 1; k <= 12; k++) {
                await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y0 - k * 25, id: 1 }] });
                await page.waitForTimeout(16);
            }
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
            await page.waitForTimeout(900);
        };
        const view = () => page.evaluate(() => {
            const card = document.getElementById('searchPhoneInput').closest('.app-card');
            const side = document.getElementById('dataSideSection');
            const title = card.getBoundingClientRect();
            const nav = document.querySelector('.app-navbar').getBoundingClientRect();
            const hit = document.elementFromPoint(title.left + title.width / 2, Math.max(title.top + 12, 0));
            return {
                visible: !!hit && card.contains(hit) && title.top >= nav.bottom - 1,
                cardTop: Math.round(title.top), navBottom: Math.round(nav.bottom),
                pagesTop: Math.round(document.getElementById('appPages').scrollTop),
                tableTop: Math.round(document.getElementById('tableResponsive').scrollTop),
                searchFocus: side.classList.contains('search-focus'), collapsed: side.classList.contains('collapsed'),
                rows: document.querySelectorAll('#historyTableBody tr[data-id]').length,
                focused: !!document.activeElement && document.activeElement.id === 'searchPhoneInput'
            };
        });
        const phone = await page.evaluate(() => {
            const row = document.querySelector('#historyTableBody tr[data-id]');
            const m = row ? /0\d{8,9}/.exec(row.textContent || '') : null;
            return m ? m[0] : '';
        });
        await page.evaluate(() => {
            window.__searchGlideSnaps = [];
            const pg = document.getElementById('appPages');
            const until = performance.now() + 1500;
            const tick = () => {
                if (pg.classList.contains('panel-gliding')) window.__searchGlideSnaps.push(getComputedStyle(pg).scrollSnapType);
                if (performance.now() < until) requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
        });
        const input = await page.locator('#searchPhoneInput').boundingBox();
        await page.touchscreen.tap(input.x + 30, input.y + input.height / 2);
        await page.waitForTimeout(1600);
        out.glideSnaps = await page.evaluate(() => window.__searchGlideSnaps);
        out.full = await view();
        out.listEnd = await page.evaluate(async () => {
            const tr = document.getElementById('tableResponsive');
            const pause = (ms) => new Promise((r) => setTimeout(r, ms));
            for (let k = 0; k < 12 && tr.scrollHeight - tr.clientHeight - tr.scrollTop > 1; k++) {
                tr.scrollTop = tr.scrollHeight;
                await pause(350);
            }
            const rows = document.querySelectorAll('#historyTableBody tr[data-id]');
            const last = rows[rows.length - 1].getBoundingClientRect();
            const bar = document.getElementById('pageTabBar');
            const visibleBottom = document.body.classList.contains('chrome-hidden') || !bar ? innerHeight : bar.getBoundingClientRect().top;
            const end = { lastBottom: Math.round(last.bottom), visibleBottom: Math.round(visibleBottom), atEnd: Math.round(tr.scrollHeight - tr.clientHeight - tr.scrollTop),
                pagesTop: Math.round(document.getElementById('appPages').scrollTop) };
            tr.scrollTop = 0;
            await pause(300);
            return end;
        });
        await drag();
        out.fullAfter = await view();
        await page.keyboard.type(phone, { delay: 20 });
        await page.waitForTimeout(900);
        out.typed = await view();
        await drag();
        out.typedAfter = await view();
        await page.evaluate(() => { document.getElementById('appPages').scrollTop = 0; });
        await page.waitForTimeout(300);
        await page.evaluate(() => { if (document.activeElement) document.activeElement.blur(); });
        await page.waitForTimeout(700);
        out.blurred = await view();
        await drag();
        out.blurredAfter = await view();
        out.phone = phone;
        searchRuns[mode] = out;
        await ctx.close();
    }
    for (const [tag, r] of [['Android', searchRuns.android], ['iOS', searchRuns.ios]]) {
        ok(tag + ': លក្ខខណ្ឌចាំបាច់ ៖ ចុចប្រអប់ស្វែងរក ➜ ហូតឡើង (`search-focus`) · ឃើញកាត',
            r.full.searchFocus && r.full.visible && r.full.focused, JSON.stringify(r.full));
        ok(tag + ': snap ផ្អាកអំឡុងចលនាហូតឡើង (`panel-gliding` ឈ្នះ)',
            r.glideSnaps.length > 0 && r.glideSnaps.every((v) => v === 'none'), JSON.stringify(r.glideSnaps));
        ok(tag + ': ⛔ ប្រអប់ហូតឡើង · បញ្ជីវែងរមូរដល់ចុង ➜ ជួរចុងក្រោយនៅខាងលើរបា Tab (កាតបញ្ជីយកតែកន្លែងនៅសល់ក្រោមកាតស្វែងរក)',
            r.listEnd.atEnd <= 1 && r.listEnd.lastBottom <= r.listEnd.visibleBottom + 1 && r.listEnd.pagesTop <= 1, JSON.stringify(r.listEnd));
        ok(tag + ': ទិសផ្ទុយ ៖ បញ្ជីវែង ➜ អូសឡើងរមូរតារាងខ្លួនឯង · កាតស្វែងរកនៅ',
            r.fullAfter.tableTop > 0 && r.fullAfter.visible && !r.fullAfter.collapsed, JSON.stringify(r.fullAfter));
        ok(tag + ': លក្ខខណ្ឌចាំបាច់ ៖ វាយលេខ «' + r.phone + '» ➜ លទ្ធផលតិច (តារាងរមូរមិនបាន)',
            !!r.phone && r.typed.rows >= 1 && r.typed.rows <= 3 && r.typed.visible, JSON.stringify(r.typed));
        ok(tag + ': ⛔⛔ keyboard បើក · អូសបញ្ជីលទ្ធផលតិច ➜ ប្រអប់ស្វែងរកនៅ (មិនរមូរទៅក្រោម navbar)',
            r.typedAfter.visible && r.typedAfter.pagesTop <= 1 && r.typedAfter.searchFocus, JSON.stringify(r.typedAfter));
        ok(tag + ': លក្ខខណ្ឌចាំបាច់ ៖ blur តែលេខនៅ ➜ នៅហូតឡើង (`search-focus`)',
            r.blurred.searchFocus && !r.blurred.focused && r.blurred.visible, JSON.stringify(r.blurred));
        ok(tag + ': ⛔⛔ keyboard បិទ · លេខនៅ · អូសឡើង ➜ ផ្ទាំងមិនបង្រួម · ប្រអប់ស្វែងរកនៅ',
            r.blurredAfter.visible && !r.blurredAfter.collapsed && r.blurredAfter.pagesTop <= 1, JSON.stringify(r.blurredAfter));
    }

    const a = runs.android, i = runs.ios;

    // ១ — ទិស «ឡើង» (collapse) ត្រូវមានចលនាទាំងពីរ (នេះដំណើរការរួចហើយ)
    ok('Android: ការហូតឡើង (collapse) មានចលនា', a.upTravel > 20, 'travel=' + a.upTravel);
    ok('iOS: ការហូតឡើង (collapse) មានចលនា', i.upTravel > 20, 'travel=' + i.upTravel);

    // ២ — ទិស «ចុះ» (expand) ត្រូវមានចលនាទាំងពីរ ➜ នេះជាកំហុសដែលអ្នកប្រើឃើញ
    ok('Android: ការហូតចុះ (expand) មានចលនា', a.downTravel > 20, 'travel=' + a.downTravel);
    ok('iOS: ការហូតចុះ (expand) មានចលនា — មិនលោត',
        i.downTravel > 20, 'travel=' + i.downTravel + 'px (0 = លោតភ្លាម គ្មានចលនា)');

    // ៣ — ចលនាត្រូវរំកិល **ច្រើនស៊ុម** មិនមែនលោតតែស៊ុមមួយ
    ok('iOS: ការហូតចុះរំកិលច្រើនស៊ុម (រអិល មិនមែនលោត)',
        i.downMovingFrames >= 4, 'frames=' + i.downMovingFrames);

    // ៤ — ចម្ងាយរំកិល iOS ត្រូវប្រហាក់ប្រហែល Android (កុំឲ្យដូច App ២ ផ្សេងគ្នា)
    const travelGap = Math.abs(a.downTravel - i.downTravel);
    ok('iOS ↔ Android: ចម្ងាយហូតចុះស្មើគ្នា (≤24px)',
        travelGap <= 24, 'android=' + a.downTravel + ' ios=' + i.downTravel);
    const upGap = Math.abs(a.upTravel - i.upTravel);
    ok('iOS ↔ Android: ចម្ងាយហូតឡើងស្មើគ្នា (≤24px)',
        upGap <= 24, 'android=' + a.upTravel + ' ios=' + i.upTravel);

    // ៤ខ — ការអូសដោយម្រាមដៃពិត ក៏ត្រូវរអិលដូចគ្នាទាំង ២ ប្រព័ន្ធ
    for (const [tag, r] of [['Android', a], ['iOS', i]]) {
        ok(tag + ': អូសឡើងលើតារាង ➜ ផ្ទាំងបង្រួមពិត', r.swipeUpCollapsed === true, String(r.swipeUpCollapsed));
        ok(tag + ': អូសចុះលើតារាង ➜ ផ្ទាំងត្រឡប់មកវិញ', r.swipeDownExpanded === true, String(r.swipeDownExpanded));
        ok(tag + ': អូសចុះមានចលនា មិនលោត', r.swipeDownTravel > 20, 'travel=' + r.swipeDownTravel);
    }
    ok('iOS ↔ Android: ចម្ងាយចលនាពេលអូសចុះស្មើគ្នា (≤24px)',
        Math.abs(a.swipeDownTravel - i.swipeDownTravel) <= 24,
        'android=' + a.swipeDownTravel + ' ios=' + i.swipeDownTravel);
    ok('iOS ↔ Android: ចម្ងាយចលនាពេលអូសឡើងស្មើគ្នា (≤24px)',
        Math.abs(a.swipeUpTravel - i.swipeUpTravel) <= 24,
        'android=' + a.swipeUpTravel + ' ios=' + i.swipeUpTravel);

    // ៥ — គ្មាន transform សេសសល់
    for (const [tag, r] of [['Android', a], ['iOS', i]]) {
        ok(tag + ': គ្មាន transform សេសសល់ក្រោយចលនា',
            r.residualTransform === 'none' || r.residualTransform === 'matrix(1, 0, 0, 1, 0, 0)', r.residualTransform);
        ok(tag + ': ចុចដងអូស ២ ដង ➜ ត្រឡប់ដើម', r.collapsedAfterDown === false, String(r.collapsedAfterDown));
        ok(tag + ': ការហូតឡើងធ្វើឲ្យផ្ទាំងបង្រួមពិត', r.collapsedAfterUp === true, String(r.collapsedAfterUp));
    }

    // ៦ — **ចំណុចស្លាប់រស់**៖ snap ត្រូវត្រឡប់មកវិញក្រោយចលនា បើអត់ PTR ស្លាប់
    for (const [tag, r] of [['Android', a], ['iOS', i]]) {
        ok(tag + ': scroll-snap ត្រឡប់មកវិញក្រោយចលនា (PTR នៅរស់)',
            r.snapAfter !== 'none' && r.snapAfter === r.snapBefore,
            'snapAfter=' + r.snapAfter + ' (before=' + r.snapBefore + ')');
        ok(tag + ': snap ត្រូវផ្អាក **អំឡុង** ចលនា (WebKit មិន snap ជាន់)',
            r.snapWhileMoving.length > 0 && r.snapWhileMoving.every((v) => v === 'none'),
            JSON.stringify({ snaps: r.snapWhileMoving, failures: r.snapFailures }));
        ok(tag + ': snap ឈប់ត្រឹម 0 (PTR កេះបាន)', r.snapRestNearTop <= 1, 'scrollTop=' + r.snapRestNearTop);
        ok(tag + ': #appPages មិនជាប់ offset ក្រោយហូតចុះ', r.pagesScrollTop <= 1, 'scrollTop=' + r.pagesScrollTop);
        for (const sample of r.ownership) {
            ok(tag + ': callback ចាស់មិនដក pause របស់ចលនាថ្មី (' + sample.action + ')',
                sample.snapBefore !== 'none' && !sample.reset.paused &&
                sample.before.snap === 'none' && sample.after.snap === 'none' &&
                sample.after.playState === 'running' && sample.after.currentTime < sample.after.duration &&
                sample.ended.snap === sample.snapBefore && !sample.ended.paused,
                JSON.stringify(sample));
        }
    }

    await browser.close();
    server.close();
    results.forEach(([n, c, d]) => check(c, n, d));
    console.log('\n  ' + pass + ' ok, ' + fail + ' fail');
    process.exit(fail ? 1 : 0);
})();
