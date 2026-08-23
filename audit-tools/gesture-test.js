// ថ្នាក់កំហុស៖ កាយវិការលើទូរស័ព្ទ — pull-to-refresh ដែលកេះខុស និងការលាក់របា
// navbar/tabbar តាមទិសរមូរ។ រត់ក្នុង Chromium ពិត ដោយបញ្ជូន touch event ពិត។
//
// កំហុសពិតដែលអ្នកប្រើរាយការណ៍៖ «កំពុង scroll ចុះសុខៗ ទាញ refresh បាត់» —
// កូដចាស់ហៅ e.preventDefault() តាំងពី pixel ដំបូង ដោយគ្មានការសម្រេចអ័ក្ស
// ដូច្នេះការរមូរធម្មតាពីកំពូល ក្លាយជា pull-to-refresh ភ្លាម។
let chromium;
try { chromium = require('playwright-core').chromium; } catch (e) { console.log('SKIP — ត្រូវការ playwright-core'); process.exit(0); }
const CHROME = process.env.GESTURE_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const fs = require('fs'), http = require('http'), path = require('path');
if (!fs.existsSync(CHROME)) { console.log('SKIP — រកមិនឃើញ Chromium'); process.exit(0); }
const ROOT = process.env.GESTURE_APP_DIR || path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json' };

let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { console.log('  ok    ' + label); pass++; }
    else { console.log('  FAIL  ' + label + (detail !== undefined ? '\n        ' + JSON.stringify(detail) : '')); fail++; }
}

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

const BOOT = function (seed) {
    try { Object.defineProperty(window.navigator, 'standalone', { configurable: true, value: true }); } catch (e) {}
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
        runTransaction: (r, fn) => { const c = getPath(r.path); const n = fn(c === null ? null : JSON.parse(JSON.stringify(c))); if (n === undefined) return Promise.resolve({ committed: false, snapshot: snapOf(r.path) }); setPath(r.path, n); fireAll(); return Promise.resolve({ committed: true, snapshot: snapOf(r.path) }); }
    };
    window.dispatchEvent(new Event('firebasesdkready'));
};

function seed(n) {
    const t = new Date();
    const d = t.getFullYear() + '-' + String(t.getMonth() + 1).padStart(2, '0') + '-' + String(t.getDate()).padStart(2, '0');
    const now = Date.now();
    const hist = {};
    for (let i = 0; i < n; i++) {
        const id = 'id_' + (now - i * 1000) + '_' + i;
        hist[id] = { id, phone: '09' + String(60000000 + i).slice(0, 8), scanDate: d, createdAt: now - i * 1000, cod: 5, dod: 0, price: 5, count: 1, barcode: 'G' + i, time: '10:00', isClosed: false, barcodes: [{ code: 'G' + i, time: '10:00', cod: 5, dod: 0, locker: 'A' + (i % 12), isClosed: false, isDeducted: false, isFromDeletion: false, createdAt: now - i * 1000 }] };
    }
    return {
        zoew_scan_history_cod_dod: hist, zoew_recently_deleted_cod_dod: {},
        zoew_daily_revenue_cod_dod: { [d]: { codDollar: 5 * n, dodDollar: 0, totalCount: n } },
        zoew_monthly_revenue_cod_dod: {}, zoew_daily_pickup_cod_dod: {},
        zoew_barcode_registry: {}, zoew_settings: { exchange_rate: 4100 }
    };
}

// បញ្ជូន touch event ពិតចូលទំព័រ ហើយរាយការណ៍ថាតើ touchmove ត្រូវបាន preventDefault ដែរឬទេ
const GESTURE = function (steps) {
    return new Promise((resolve) => {
        const target = document.elementFromPoint(steps.x, steps.startY) || document.body;
        let prevented = 0;
        const spy = (e) => { if (e.defaultPrevented) prevented++; };
        document.addEventListener('touchmove', spy, { passive: true });
        const mk = (type, x, y) => {
            const touch = new Touch({ identifier: 1, target: target, clientX: x, clientY: y, pageX: x, pageY: y });
            return new TouchEvent(type, { bubbles: true, cancelable: type !== 'touchcancel', touches: type === 'touchend' ? [] : [touch], targetTouches: type === 'touchend' ? [] : [touch], changedTouches: [touch] });
        };
        target.dispatchEvent(mk('touchstart', steps.x, steps.startY));
        let i = 0;
        const tick = () => {
            if (i < steps.points.length) {
                const pt = steps.points[i++];
                target.dispatchEvent(mk('touchmove', steps.x + (pt.dx || 0), pt.y));
                requestAnimationFrame(tick);
                return;
            }
            target.dispatchEvent(mk('touchend', steps.x, steps.points.length ? steps.points[steps.points.length - 1].y : steps.startY));
            document.removeEventListener('touchmove', spy);
            setTimeout(() => resolve({ prevented: prevented }), 420);
        };
        requestAnimationFrame(tick);
    });
};

(async () => {
    const browser = await chromium.launch({ executablePath: CHROME });
    const server = await serve(path.join(ROOT, 'ZoeW'));
    const port = server.address().port;
    const ctx = await browser.newContext({ viewport: { width: 412, height: 780 }, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    page.on('dialog', (d) => d.accept());
    let documentLoads = 0;
    let reloads = 0;
    let allowReload = false;
    await page.route('**', (r) => {
        const req = r.request();
        const u = req.url();
        if (req.resourceType() === 'document' && u.startsWith('http://127.0.0.1:' + port)) {
            documentLoads++;
            // ការផ្ទុកដំបូងឆ្លងកាត់; ការ reload ក្រោយៗរាប់ទុក រួចបោះបង់ ដើម្បីរក្សាបរិបទទំព័រ
            if (documentLoads > 1) { reloads++; if (!allowReload) return r.abort(); }
            return r.continue();
        }
        if (u.indexOf('/license-verify.js') !== -1) return r.fulfill({ status: 200, contentType: 'application/javascript', body: LICENSE_STUB });
        if (u.startsWith('http://127.0.0.1:' + port)) return r.continue();
        return r.abort();
    });
    const takeReloads = () => { const n = reloads; reloads = 0; return n; };
    await page.addInitScript(`window.localStorage.setItem('zoew_firebase_config', ${JSON.stringify(JSON.stringify({ apiKey: 'k', databaseURL: 'https://fake-default-rtdb.firebaseio.com', projectId: 'p' }))});`);
    await page.addInitScript(() => {
        try { sessionStorage.setItem('__loads', String(parseInt(sessionStorage.getItem('__loads') || '0', 10) + 1)); } catch (e) {}
    });
    await page.addInitScript('(' + BOOT.toString() + ')(' + JSON.stringify(seed(160)) + ');');
    await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => document.querySelectorAll('#historyTableBody tr').length > 5, null, { timeout: 30000 });
    await page.addStyleTag({ content: '*, *::before, *::after { scroll-behavior: auto !important; }' });

    console.log('\n=== pull-to-refresh (ZoeW, iOS PWA) ===');
    ok('indicator ត្រូវបានបង្កើត', await page.evaluate(() => !!document.querySelector('.ptr-indicator')));

    const runGesture = async (steps) => {
        const out = await page.evaluate('(' + GESTURE.toString() + ')(' + JSON.stringify(steps) + ')');
        out.reloaded = takeReloads() > 0;
        return out;
    };
    const resetState = async () => {
        takeReloads();
        return page.evaluate(() => {
        const pages = document.getElementById('appPages');
        if (pages) pages.style.scrollBehavior = 'auto';
        if (pages) pages.scrollTop = 0;
        const tr = document.getElementById('tableResponsive');
        if (tr) tr.scrollTop = 0;
        document.body.classList.remove('chrome-hidden');
        });
    };

    // ១) កំហុសដែលអ្នកប្រើរាយការណ៍៖ រមូរធម្មតាពីកំពូល មិនត្រូវក្លាយជា refresh
    await resetState();
    const gentle = await runGesture({ x: 200, startY: 300, points: [{ y: 303 }, { y: 307 }, { y: 311 }, { y: 314 }] });
    ok('អូសខ្លីៗពីកំពូល (14px) ➜ មិនរារាំងការរមូរ និងមិនកេះ refresh', gentle.prevented === 0 && !gentle.reloaded, gentle);

    // អូសមធ្យម៖ អាចបង្ហាញ indicator តែមិនត្រូវ refresh (វាត្រូវរអិលត្រឡប់វិញ)
    await resetState();
    const medium = await runGesture({ x: 200, startY: 300, points: [{ y: 320 }, { y: 342 }, { y: 358 }, { y: 366 }] });
    ok('អូសមធ្យម (66px) ➜ រអិលត្រឡប់វិញ មិន refresh', medium.reloaded === false, medium);
    ok('អូសមធ្យម ➜ ចាប់យកកាយវិការ (preventDefault) ដើម្បីបង្ហាញ indicator', medium.prevented > 0, medium);

    // ២) អូសផ្ដេក មិនត្រូវក្លាយជា pull
    await resetState();
    const sideways = await runGesture({ x: 200, startY: 300, points: [{ y: 303, dx: 20 }, { y: 306, dx: 46 }, { y: 308, dx: 80 }] });
    ok('អូសផ្ដេក ➜ មិនកេះ refresh', sideways.prevented === 0 && !sideways.reloaded, sideways);

    // ៣) អូសឡើងលើ (រមូរចុះ) មិនត្រូវក្លាយជា pull
    await resetState();
    const upward = await runGesture({ x: 200, startY: 400, points: [{ y: 380 }, { y: 350 }, { y: 310 }, { y: 270 }] });
    ok('អូសឡើងលើ ➜ មិនកេះ refresh', upward.prevented === 0 && !upward.reloaded, upward);

    // ៥) ពេលតារាងខាងក្នុងត្រូវបានរមូរចុះរួច ការទាញមិនត្រូវកេះ refresh
    await resetState();
    const nestedTop = await page.evaluate(() => { const tr = document.getElementById('tableResponsive'); if (!tr) return -1; tr.style.scrollBehavior = 'auto'; tr.scrollTop = 120; return tr.scrollTop; });
    ok('តារាងខាងក្នុងអាចរមូរបានពិត (ដូច្នេះតេស្តមិនទទេ)', nestedTop > 0, nestedTop);
    const nested = await runGesture({ x: 200, startY: 500, points: [{ y: 540 }, { y: 590 }, { y: 650 }, { y: 700 }] });
    ok('តារាងខាងក្នុងរមូរចុះរួច ➜ ការទាញមិនកេះ refresh', nested.reloaded === false, nested);

    // ៦) ប្រអប់បើក ➜ គ្មាន pull
    await resetState();
    await page.evaluate(() => window.openExchangeRateModal());
    const inModal = await runGesture({ x: 200, startY: 160, points: [{ y: 220 }, { y: 300 }, { y: 400 }, { y: 500 }] });
    ok('ប្រអប់បើក ➜ មិនកេះ refresh', inModal.reloaded === false, inModal);
    await page.evaluate(() => window.closeModal('exchangeRateModal'));

    console.log('\n=== ផ្ទាំងប្រវត្តិពេញអេក្រង់ (ទាញឡើង) ===');
    await resetState();
    const fullscreen = await page.evaluate(async () => {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const pages = document.getElementById('appPages');
        const table = document.getElementById('tableResponsive');
        const handle = document.getElementById('dragHandle');
        const side = document.getElementById('dataSideSection');
        if (!pages || !table || !handle || !side) return { missing: true };

        const before = { expanded: pages.classList.contains('history-expanded'), tableH: table.clientHeight };
        handle.click();
        await wait(450);

        const pagesBox = pages.getBoundingClientRect();
        const pagesStyle = window.getComputedStyle(pages);
        const padTop = parseFloat(pagesStyle.paddingTop);
        const padBottom = parseFloat(pagesStyle.paddingBottom);
        const innerTop = pagesBox.top + padTop;
        const innerBottom = pagesBox.bottom - padBottom;
        const tableBox = table.getBoundingClientRect();
        const card = table.closest('.history-section');
        const cardBox = card ? card.getBoundingClientRect() : tableBox;
        const handleBox = handle.getBoundingClientRect();

        return {
            expandedBefore: before.expanded,
            expanded: pages.classList.contains('history-expanded'),
            sideCollapsed: side.classList.contains('collapsed'),
            tableHBefore: before.tableH,
            tableH: table.clientHeight,
            // ចន្លោះទទេនៅសល់ខាងលើ និងខាងក្រោមកាតប្រវត្តិ ក្នុងតំបន់មាតិកា
            // ដងអូសជាឧបករណ៍ពិត មិនមែនចន្លោះទទេទេ — វាស់ចន្លោះខាងលើដងអូស
            gapTop: Math.round(handleBox.top - innerTop),
            handleToCard: Math.round(cardBox.top - handleBox.bottom),
            gapBottom: Math.round(innerBottom - cardBox.bottom),
            pagesScrolls: pages.scrollHeight > pages.clientHeight + 1,
            viewportH: window.innerHeight
        };
    });
    ok('ចុចដងអូស ➜ ចូលរបៀបប្រវត្តិពេញអេក្រង់', fullscreen.expanded === true && fullscreen.sideCollapsed === true, fullscreen);
    ok('តារាងខ្ពស់ជាងមុនក្រោយទាញឡើង', fullscreen.tableH > fullscreen.tableHBefore, fullscreen);
    ok('គ្មានចន្លោះទទេនៅសល់ខាងលើដងអូស (≤2px)', Math.abs(fullscreen.gapTop) <= 2, fullscreen);
    ok('ដងអូសនៅជាប់កាតប្រវត្តិ (≤10px)', fullscreen.handleToCard <= 10, fullscreen);
    ok('គ្មានចន្លោះទទេនៅសល់ខាងក្រោមកាតប្រវត្តិ (≤2px)', Math.abs(fullscreen.gapBottom) <= 2, fullscreen);
    ok('របៀបពេញអេក្រង់ ➜ ទំព័រខាងក្រៅលែងរមូរ (តារាងទទួលការរមូរទាំងអស់)', fullscreen.pagesScrolls === false, fullscreen);

    // ត្រូវសម្របតាមទំហំអេក្រង់ ដោយស្វ័យប្រវត្តិ — មិនមែនតួលេខ vh ថេរទេ
    const adaptive = [];
    for (const h of [640, 780, 900, 1024]) {
        await page.setViewportSize({ width: 412, height: h });
        await page.evaluate(() => new Promise((r) => setTimeout(r, 260)));
        adaptive.push(await page.evaluate(() => {
            const pages = document.getElementById('appPages');
            const table = document.getElementById('tableResponsive');
            const st = window.getComputedStyle(pages);
            const innerH = pages.clientHeight - parseFloat(st.paddingTop) - parseFloat(st.paddingBottom);
            const card = table.closest('.history-section');
            const handle = document.getElementById('dragHandle');
            const used = card.getBoundingClientRect().height + handle.getBoundingClientRect().height +
                parseFloat(window.getComputedStyle(document.getElementById('dataMainSection')).rowGap || '0');
            return { vh: window.innerHeight, tableH: table.clientHeight, gap: Math.round(innerH - used) };
        }));
    }
    await page.setViewportSize({ width: 412, height: 780 });
    await page.evaluate(() => new Promise((r) => setTimeout(r, 260)));
    ok('កម្ពស់តារាងកើនតាមកម្ពស់អេក្រង់ (សម្របស្វ័យប្រវត្តិ)',
        adaptive.every((a, i) => i === 0 || a.tableH > adaptive[i - 1].tableH), JSON.stringify(adaptive));
    ok('គ្មានចន្លោះទទេនៅសល់លើគ្រប់ទំហំអេក្រង់ដែលសាកល្បង',
        adaptive.every((a) => Math.abs(a.gap) <= 2), JSON.stringify(adaptive));

    await page.evaluate(() => { const h = document.getElementById('dragHandle'); if (h) h.click(); });
    await page.evaluate(() => new Promise((r) => setTimeout(r, 400)));

    console.log('\n=== ការលាក់ navbar/tabbar តាមទិសរមូរ ===');
    const scrollTo = (top) => page.evaluate((t) => {
        const el = document.getElementById('tableResponsive') || document.getElementById('appPages');
        el.style.scrollBehavior = 'auto';
        el.scrollTop = t;
        if (el.scrollTop !== t) return -1;
        el.dispatchEvent(new Event('scroll', { bubbles: false }));
        return el.scrollTop;
    }, top);
    const hidden = () => page.evaluate(() => document.body.classList.contains('chrome-hidden'));

    await resetState();
    await scrollTo(0);
    const scrollWorks = await scrollTo(60);
    ok('ការកំណត់ scrollTop ក្នុងតេស្តដំណើរការពិត (មិនមែន smooth)', scrollWorks === 60, scrollWorks);
    ok('រមូរចុះ ➜ លាក់របា Tab', await hidden() === true);
    await page.evaluate(() => new Promise((r) => setTimeout(r, 340)));
    const barsWhileHidden = await page.evaluate(() => {
        const nav = document.querySelector('.app-navbar');
        const tab = document.getElementById('pageTabBar');
        return {
            navBottom: Math.round(nav.getBoundingClientRect().bottom),
            navTop: Math.round(nav.getBoundingClientRect().top),
            tabTop: Math.round(tab.getBoundingClientRect().top),
            viewportH: window.innerHeight
        };
    });
    ok('របាខាងលើ **មិនលាក់ទេ** ពេលរមូរចុះ (សំណើអ្នកប្រើ)',
        barsWhileHidden.navTop === 0 && barsWhileHidden.navBottom > 0, barsWhileHidden);
    ok('របា Tab ខាងក្រោមរអិលចេញផុតអេក្រង់',
        barsWhileHidden.tabTop >= barsWhileHidden.viewportH - 1, barsWhileHidden);
    await scrollTo(20);
    ok('រមូរឡើង ➜ បង្ហាញវិញ', await hidden() === false);
    await scrollTo(200); await scrollTo(400);
    ok('រមូរចុះម្ដងទៀត ➜ លាក់វិញ', await hidden() === true);
    await scrollTo(10);
    ok('ត្រឡប់ដល់កំពូល ➜ បង្ហាញជានិច្ច', await hidden() === false);

    await scrollTo(200); await scrollTo(400);
    await page.evaluate(() => window.openSideDrawer());
    ok('បើកម៉ឺនុយ ➜ បង្ហាញរបាវិញ', await hidden() === false);
    await page.evaluate(() => window.closeSideDrawer());

    await scrollTo(200); await scrollTo(400);
    await page.evaluate(() => window.switchAppPage('entry'));
    ok('ប្តូរទំព័រ ➜ បង្ហាញរបាវិញ', await hidden() === false);
    await page.evaluate(() => window.switchAppPage('data'));

    const navFixed = await page.evaluate(() => window.getComputedStyle(document.querySelector('.app-navbar')).position);
    ok('លើទូរស័ព្ទ navbar ជា fixed (ដូច្នេះការលាក់មិនបន្សល់ចន្លោះទទេ)', navFixed === 'fixed', navFixed);
    const padTop = await page.evaluate(() => parseFloat(window.getComputedStyle(document.getElementById('appPages')).paddingTop));
    const navH = await page.evaluate(() => document.querySelector('.app-navbar').offsetHeight);
    ok('#appPages មាន padding-top ធំជាងកម្ពស់ navbar (មិនត្រូវជាន់គ្នា)', padTop >= navH, { padTop, navH });

    // === iOS៖ ការលាក់របា មិនត្រូវប្តូរ layout របស់ប្រអប់រមូរទេ ===
    // អ្នកប្រើរាយការណ៍ «រំលង list លឿនជ្រុល» លើ iOS។ ឫសគល់៖ ពេលរបា Tab លាក់
    // កូដចាស់បង្រួម padding-bottom របស់ #appPages ដោយ transition ➜ កម្ពស់
    // ប្រអប់រមូរប្តូរ *ចំពេល* momentum scroll របស់ WebKit កំពុងដើរ ➜ បញ្ជីលោត។
    console.log('\n=== ការលាក់របា មិនប៉ះ layout (iOS) ===');
    await resetState();
    await page.evaluate(() => { const h = document.getElementById('dragHandle'); if (h) h.click(); });
    await page.evaluate(() => new Promise((r) => setTimeout(r, 420)));
    const noReflow = await page.evaluate(async () => {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const table = document.getElementById('tableResponsive');
        const pages = document.getElementById('appPages');
        document.body.classList.remove('chrome-hidden');
        await wait(340);
        const shown = { h: table.clientHeight, top: Math.round(table.getBoundingClientRect().top),
                        pad: window.getComputedStyle(pages).paddingBottom };
        document.body.classList.add('chrome-hidden');
        await wait(340);
        const away = { h: table.clientHeight, top: Math.round(table.getBoundingClientRect().top),
                       pad: window.getComputedStyle(pages).paddingBottom };
        document.body.classList.remove('chrome-hidden');
        await wait(340);
        return { shown: shown, away: away, expanded: pages.classList.contains('history-expanded') };
    });
    ok('នៅក្នុងរបៀបប្រវត្តិពេញអេក្រង់ពិត (លក្ខខណ្ឌចាំបាច់)', noReflow.expanded === true, noReflow);
    ok('លាក់របា ➜ កម្ពស់ប្រអប់រមូរមិនប្តូរ (បញ្ជីលែងលោតរំលងលើ iOS)',
        noReflow.shown.h === noReflow.away.h, noReflow);
    ok('លាក់របា ➜ padding-bottom របស់ #appPages មិនប្តូរ (គ្មាន transition លើ layout)',
        noReflow.shown.pad === noReflow.away.pad, noReflow);
    ok('លាក់របា ➜ ទីតាំងកំពូលតារាងមិនប្តូរ', noReflow.shown.top === noReflow.away.top, noReflow);

    // កាតប្រវត្តិត្រូវ **ឈប់ត្រង់ខាងលើរបា Tab** — មិនត្រូវរត់ចូលពីក្រោមវាទេ។
    // កំណែ 2.4.0 ទុកឲ្យកាតលាតដល់បាតអេក្រង់ រួចកក់កន្លែងដោយ ::after ខាងក្នុង
    // កន្សោមរមូរ ➜ ជួរដេកលិចចូលពីក្រោមរបា Tab ពេលរមូរ (អ្នកប្រើរាយការណ៍ថា
    // «បាំងពីលើ អត់សូវស្អាត»)។ ឥឡូវកន្លែងកក់ជា padding ថេររបស់ #appPages
    // ➜ គែមក្រោមកាតឈរខាងលើរបា ហើយ layout នៅតែមិនប្តូរពេលរបាលាក់/បង្ហាញ។
    const bottomRoom = await page.evaluate(() => {
        const table = document.getElementById('tableResponsive');
        const tabbar = document.getElementById('pageTabBar');
        const card = document.querySelector('#dataMainSection .history-section') ||
                     document.getElementById('dataMainSection');
        return {
            tableBottom: Math.round(table.getBoundingClientRect().bottom),
            cardBottom: Math.round(card.getBoundingClientRect().bottom),
            tabbarTop: Math.round(tabbar.getBoundingClientRect().top),
            tabbarH: Math.round(tabbar.getBoundingClientRect().height),
            chromeBottom: window.getComputedStyle(document.documentElement).getPropertyValue('--chrome-bottom').trim()
        };
    });
    ok('កម្ពស់របា Tab ត្រូវបានវាស់ចូល --chrome-bottom', /^[0-9.]+px$/.test(bottomRoom.chromeBottom), bottomRoom);
    ok('គែមក្រោមតារាងប្រវត្តិឈរខាងលើរបា Tab (របាមិនបាំងជួរដេក)',
        bottomRoom.tableBottom <= bottomRoom.tabbarTop + 1, bottomRoom);
    ok('គែមក្រោមកាតប្រវត្តិទាំងមូលក៏ឈរខាងលើរបា Tab ដែរ',
        bottomRoom.cardBottom <= bottomRoom.tabbarTop + 1, bottomRoom);

    await page.evaluate(() => { const h = document.getElementById('dragHandle'); if (h) h.click(); });
    await page.evaluate(() => new Promise((r) => setTimeout(r, 420)));

    // === ស្ថេរភាព៖ momentum របស់ iOS បញ្ចេញ delta ធំៗ និងបញ្ច្រាសទិសបន្តិចបន្តួច ===
    // ពិដានបង្ហាញទាបពេក ➜ របាភ្លឹបភ្លែតឡើងចុះ ➜ «អត់ smooth ដូច android»
    console.log('\n=== ស្ថេរភាពការលាក់របា (ប្រឆាំងការភ្លឹបភ្លែត) ===');
    await resetState();
    await page.evaluate(() => { window.hideAppChrome(); window.showAppChrome(); });
    await scrollTo(0);
    const at300 = await scrollTo(300);
    const at600 = await scrollTo(600);
    ok('អាចរមូរដល់ 600px ពិត (លក្ខខណ្ឌចាំបាច់)', at300 === 300 && at600 === 600, { at300, at600 });
    ok('រមូរចុះឆ្ងាយ ➜ លាក់របា', await hidden() === true);
    await scrollTo(580);
    ok('រញ្ជួយឡើង 20px ➜ នៅតែលាក់ (មិនភ្លឹបភ្លែត)', await hidden() === true);
    await scrollTo(570);
    ok('រញ្ជួយឡើងបន្តទៀត (សរុប 30px) ➜ នៅតែលាក់', await hidden() === true);
    await scrollTo(500);
    ok('រមូរឡើងពិតប្រាកដ (>48px) ➜ បង្ហាញវិញ', await hidden() === false);

    // === ចង្វាក់ស៊ុមសម្របតាមឧបករណ៍ (១០–១២០ fps) ===
    // ទំព័រវែបមិនអាចដំឡើងល្បឿន refresh របស់អេក្រង់បានទេ — អ្វីដែលធ្វើបានគឺ
    // **វាស់** ចង្វាក់ពិតរបស់ឧបករណ៍ រួចយកវាធ្វើមូលដ្ឋាននៃពិដាន «ស៊ុមវែង»។
    // ពិដានថេរ ២៦ms ខុសទាំង ២ ទិស៖ លើអេក្រង់ ១២០Hz វាធូរពេក (ស៊ុមវែងពិត
    // គឺ >8.3ms) ចំណែកលើឧបករណ៍ដែល browser ចាក់ត្រឹម ៣០Hz វាតឹងពេក។
    console.log('\n=== ចង្វាក់ស៊ុមសម្របតាមឧបករណ៍ (១០–១២០ fps) ===');
    const hz = await page.evaluate(async () => {
        if (typeof window.measureDisplayHz !== 'function') return null;
        const measured = await new Promise((r) => window.measureDisplayHz(r));
        const atMeasured = window.longFrameThresholdMs();
        const budget = window.displayFrameBudgetMs();
        return {
            measured: measured,
            atMeasured: atMeasured,
            budget: Math.round(budget * 100) / 100,
            clampLow: window.clampDisplayHz(2),
            clampHigh: window.clampDisplayHz(240),
            clampNaN: window.clampDisplayHz(NaN)
        };
    });
    ok('measureDisplayHz() មានក្នុង App ពិត', !!hz, hz);
    if (hz) {
        console.log('    វាស់បាន ' + hz.measured + ' Hz  ➜ ថវិកាមួយស៊ុម ' + hz.budget +
                    'ms  ➜ ពិដានស៊ុមវែង ' + hz.atMeasured + 'ms');
        ok('ចង្វាក់ដែលវាស់បាន ស្ថិតក្នុងចន្លោះ ១០–១២០ Hz',
            hz.measured >= 10 && hz.measured <= 120, hz);
        ok('ចង្វាក់លឿនហួសហេតុ ត្រូវកាត់ត្រឹម ១២០ Hz', hz.clampHigh === 120, hz);
        ok('ចង្វាក់យឺតហួសហេតុ ត្រូវលើក ១០ Hz', hz.clampLow === 10, hz);
        ok('តម្លៃវាស់មិនត្រឹមត្រូវ (NaN) មិនធ្វើឲ្យបែក', hz.clampNaN === 10, hz);
        ok('ពិដានស៊ុមវែងចេញពីចង្វាក់ពិត មិនមែនលេខថេរទេ',
            hz.atMeasured === Math.max(12, Math.round(hz.budget * 1.6)), hz);
    }
    const hzBand = await page.evaluate(() => {
        if (typeof window.clampDisplayHz !== 'function') return null;
        const out = {};
        [-5, 0, 9, 10, 30, 60, 90, 120, 121, 240].forEach((v) => { out[v] = window.clampDisplayHz(v); });
        return out;
    });
    ok('ចង្វាក់ក្នុងចន្លោះ ១០–១២០ ត្រូវរក្សាដដែល (គ្រប់តម្លៃ)',
        !!hzBand && [10, 30, 60, 90, 120].every((v) => hzBand[v] === v), hzBand);
    ok('ចង្វាក់ក្រៅចន្លោះត្រូវកាត់ចូលចន្លោះ (គ្មានតម្លៃឆ្កួតឆ្លងចេញ)',
        !!hzBand && hzBand[-5] === 10 && hzBand[0] === 10 && hzBand[9] === 10 &&
        hzBand[121] === 120 && hzBand[240] === 120, hzBand);

    const cssSrc = fs.readFileSync(path.join(ROOT, 'ZoeW', 'style.css'), 'utf8');
    ok('.table-responsive គ្មាន scroll-behavior: smooth (WebKit អនុវត្តវាលើ momentum ➜ លោតរំលង)',
        !/\.table-responsive\s*\{[^}]*scroll-behavior:\s*smooth/.test(cssSrc));
    ok('body គ្មាន scroll-behavior: smooth',
        !/\bbody\s*\{[^}]*scroll-behavior:\s*smooth/.test(cssSrc));
    ok('.app-navbar គ្មាន backdrop-filter (iOS គណនា blur ឡើងវិញរាល់ស៊ុមពេលរបារំកិល)',
        !/\.app-navbar\s*\{[^}]*backdrop-filter/.test(cssSrc));
    ok('របា Tab ប្រើ translate3d (បង្ខំឲ្យរំកិលលើ GPU)',
        /body\.chrome-hidden \.page-tabbar \{ transform: translate3d\(0, 100%, 0\); \}/.test(cssSrc));
    ok('គ្មានច្បាប់ណាលាក់របាខាងលើទេ (.app-navbar មិនត្រូវ translate)',
        !/body\.chrome-hidden \.app-navbar/.test(cssSrc));

    // ការទាញពិតប្រាកដ ត្រូវកេះ refresh — ដាក់ចុងក្រោយព្រោះវាបង្កើត navigation ពិត
    console.log('\n=== ការទាញពិតប្រាកដ ===');
    await resetState();
    const preTop = await page.evaluate(() => {
        const tr = document.getElementById('tableResponsive');
        const pages = document.getElementById('appPages');
        return { tr: tr ? tr.scrollTop : -1, pages: pages ? pages.scrollTop : -1 };
    });
    ok('មុនទាញ គ្រប់ scroller នៅកំពូល (លក្ខខណ្ឌចាំបាច់)', preTop.tr === 0 && preTop.pages === 0, preTop);
    const loadsBefore = await page.evaluate(() => parseInt(sessionStorage.getItem('__loads') || '0', 10));
    allowReload = true;
    try {
        await runGesture({ x: 200, startY: 140, points: [{ y: 175 }, { y: 235 }, { y: 300 }, { y: 375 }, { y: 450 }, { y: 520 }, { y: 580 }] });
    } catch (e) { /* បរិបទត្រូវបំផ្លាញដោយ navigation — នោះជាអ្វីដែលរំពឹងទុក */ }
    let loadsAfter = loadsBefore;
    for (let i = 0; i < 20; i++) {
        try {
            await page.waitForLoadState('domcontentloaded', { timeout: 2000 });
            loadsAfter = await page.evaluate(() => parseInt(sessionStorage.getItem('__loads') || '0', 10));
            if (loadsAfter > loadsBefore) break;
        } catch (e) {}
        await new Promise((r) => setTimeout(r, 200));
    }
    ok('ទាញវែងចុះក្រោម (>120px) ➜ កេះ refresh ពិត (ទំព័រផ្ទុកឡើងវិញ)', loadsAfter === loadsBefore + 1, { loadsBefore, loadsAfter });


    // លើកុំព្យូទ័រ មិនត្រូវលាក់ទេ
    await ctx.close();
    const wideCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const wide = await wideCtx.newPage();
    wide.on('dialog', (d) => d.accept());
    await wide.route('**', (r) => {
        const u = r.request().url();
        if (u.indexOf('/license-verify.js') !== -1) return r.fulfill({ status: 200, contentType: 'application/javascript', body: LICENSE_STUB });
        if (u.startsWith('http://127.0.0.1:' + port)) return r.continue();
        return r.abort();
    });
    await wide.addInitScript(`window.localStorage.setItem('zoew_firebase_config', ${JSON.stringify(JSON.stringify({ apiKey: 'k', databaseURL: 'https://fake-default-rtdb.firebaseio.com', projectId: 'p' }))});`);
    await wide.addInitScript('(' + BOOT.toString() + ')(' + JSON.stringify(seed(160)) + ');');
    await wide.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await wide.waitForFunction(() => document.querySelectorAll('#historyTableBody tr').length > 5, null, { timeout: 30000 });
    const wideHidden = await wide.evaluate(() => {
        const el = document.getElementById('tableResponsive') || document.getElementById('appPages');
        [0, 60, 200, 500].forEach((t) => { el.scrollTop = t; el.dispatchEvent(new Event('scroll', { bubbles: false })); });
        return document.body.classList.contains('chrome-hidden');
    });
    ok('លើកុំព្យូទ័រ (1280px) ➜ មិនលាក់របាទេ', wideHidden === false);
    const wideNav = await wide.evaluate(() => window.getComputedStyle(document.querySelector('.app-navbar')).position);
    ok('លើកុំព្យូទ័រ navbar នៅ sticky ដដែល', wideNav === 'sticky', wideNav);

    await wideCtx.close();
    server.close();
    await browser.close();
    console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')' : '✅ ជោគជ័យ ' + pass));
    process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e && e.stack || e); process.exit(1); });
