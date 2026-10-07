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
const ROOT = process.env.GESTURE_APP_DIR || path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm' };

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

const BOOT = function (seed, standalone) {
    const nativeAddEventListener = EventTarget.prototype.addEventListener;
    const nativeRemoveEventListener = EventTarget.prototype.removeEventListener;
    const blockingTouchMoves = new Set();
    EventTarget.prototype.addEventListener = function (type, listener, options) {
        if (this === document && type === 'touchmove' && options && options.passive === false) blockingTouchMoves.add(listener);
        return nativeAddEventListener.call(this, type, listener, options);
    };
    EventTarget.prototype.removeEventListener = function (type, listener, options) {
        if (this === document && type === 'touchmove') blockingTouchMoves.delete(listener);
        return nativeRemoveEventListener.call(this, type, listener, options);
    };
    window.__blockingTouchMoveCount = () => blockingTouchMoves.size;
    if (standalone !== false) {
        try { Object.defineProperty(window.navigator, 'standalone', { configurable: true, value: true }); } catch (e) {}
        try {
            const nativeSupports = window.CSS.supports.bind(window.CSS);
            Object.defineProperty(window.CSS, 'supports', {
                configurable: true,
                value: (property, value) => property === '-webkit-touch-callout' && value === 'none' ? true : nativeSupports(property, value)
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
        runTransaction: (r, fn) => { const c = getPath(r.path); const n = fn(c === null ? null : JSON.parse(JSON.stringify(c))); if (n === undefined) return Promise.resolve({ committed: false, snapshot: snapOf(r.path) }); setPath(r.path, n); fireAll(); return Promise.resolve({ committed: true, snapshot: snapOf(r.path) }); }
    };
    window.dispatchEvent(new Event('firebasesdkready'));
};

function seed(n) {
    const t = new Date();
    const d = zoneDateKey(Date.now(), 0);
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
        const target = steps.selector ? document.querySelector(steps.selector) : (document.elementFromPoint(steps.x, steps.startY) || document.body);
        let prevented = 0;
        let maxIndicatorOpacity = 0;
        let secondTouch = null;
        let blockingAfterStart = 0;
        const bounced = [];
        const touch = (id, x, y) => new Touch({ identifier: id, target: target, clientX: x, clientY: y, pageX: x, pageY: y });
        const fire = (type, touches, changed) => {
            const event = new TouchEvent(type, {
                bubbles: true,
                cancelable: type !== 'touchcancel',
                touches: touches,
                targetTouches: touches,
                changedTouches: changed
            });
            target.dispatchEvent(event);
            if (type === 'touchmove' && event.defaultPrevented) prevented++;
        };
        let primary = touch(1, steps.x, steps.startY);
        fire('touchstart', [primary], [primary]);
        blockingAfterStart = typeof window.__blockingTouchMoveCount === 'function' ? window.__blockingTouchMoveCount() : -1;
        if (steps.negativeBounce) {
            const root = document.scrollingElement || document.documentElement;
            const active = typeof activePanelSections === 'function' ? activePanelSections().scroller : null;
            [root, document.body, document.getElementById('appPages'), active].forEach((el) => {
                if (!el || bounced.indexOf(el) !== -1) return;
                bounced.push(el);
                Object.defineProperty(el, 'scrollTop', { configurable: true, writable: true, value: -12 });
            });
        }
        let i = 0;
        const tick = () => {
            if (i < steps.points.length) {
                const pt = steps.points[i++];
                primary = touch(1, steps.x + (pt.dx || 0), pt.y);
                if (pt.addFinger && !secondTouch) {
                    secondTouch = touch(2, steps.x + 24, pt.y + 8);
                    fire('touchstart', [primary, secondTouch], [secondTouch]);
                }
                if (secondTouch) {
                    secondTouch = touch(2, steps.x + 24, pt.y + 8);
                    fire('touchmove', [primary, secondTouch], [primary, secondTouch]);
                } else {
                    fire('touchmove', [primary], [primary]);
                }
                const indicator = document.querySelector('.ptr-indicator');
                if (indicator) maxIndicatorOpacity = Math.max(maxIndicatorOpacity, parseFloat(indicator.style.opacity) || 0);
                requestAnimationFrame(tick);
                return;
            }
            if (Number.isFinite(steps.endY)) {
                primary = touch(1, steps.x + (steps.endDx || 0), steps.endY);
            }
            if (secondTouch) {
                fire('touchend', [secondTouch], [primary]);
                fire('touchend', [], [secondTouch]);
            } else {
                fire('touchend', [], [primary]);
            }
            if (steps.postEndPull && !secondTouch) {
                setTimeout(() => {
                    const nextStart = touch(3, steps.x, steps.startY);
                    const nextEnd = touch(3, steps.x, steps.startY + 80);
                    fire('touchstart', [nextStart], [nextStart]);
                    fire('touchmove', [nextEnd], [nextEnd]);
                    fire('touchend', [], [nextEnd]);
                }, 60);
            }
            bounced.forEach((el) => { delete el.scrollTop; el.scrollTop = 0; });
            setTimeout(() => resolve({ prevented: prevented, maxIndicatorOpacity: maxIndicatorOpacity,
                blockingAfterStart: blockingAfterStart,
                blockingAfterEnd: typeof window.__blockingTouchMoveCount === 'function' ? window.__blockingTouchMoveCount() : -1 }), 420);
        };
        requestAnimationFrame(tick);
    });
};

(async () => {
    const browser = await chromium.launch({ executablePath: CHROME });
    const server = await serve(path.join(ROOT, 'ZoeW'));
    const port = server.address().port;
    const ctx = await browser.newContext({ viewport: { width: 412, height: 780 }, hasTouch: true, isMobile: true, serviceWorkers: 'block' });
    const page = await ctx.newPage();
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    await page.addInitScript(`window.addEventListener('unhandledrejection', function (ev) {
            var m; try { m = String((ev.reason && (ev.reason.message || ev.reason)) || 'unknown'); } catch (x) { m = 'unknown'; }
            setTimeout(function () { throw new Error('unhandledrejection: ' + m); }, 0);
        });`);
    page.on('dialog', (d) => d.accept());
    let documentLoads = 0;
    let reloads = 0;
    let allowReload = false;
    let delayReloadCommit = false;
    await page.route('**', async (r) => {
        const req = r.request();
        const u = req.url();
        if (req.resourceType() === 'document' && u.startsWith('http://127.0.0.1:' + port)) {
            documentLoads++;
            // ការផ្ទុកដំបូងឆ្លងកាត់; ការ reload ក្រោយៗរាប់ទុក រួចបោះបង់ ដើម្បីរក្សាបរិបទទំព័រ
            if (documentLoads > 1) {
                reloads++;
                if (!allowReload) return r.abort();
                if (delayReloadCommit) await new Promise((resolve) => setTimeout(resolve, 5200));
            }
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
    await page.addInitScript(() => {
        window.addEventListener('load', () => {
            try { if (sessionStorage.getItem('__simulate_ptr_restore') !== '1') return; } catch (e) { return; }
            window.__ptrMarkerAtReloadBoot = sessionStorage.getItem('zoew_ptr_reload_pending');
            window.__ptrRestorationMarkerAtReloadBoot = sessionStorage.getItem('zoew_ptr_scroll_restoration');
            setTimeout(() => {
                const target = document.body;
                const touch = new Touch({ identifier: 99, target: target, clientX: 12, clientY: 12, pageX: 12, pageY: 12 });
                target.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, cancelable: true, touches: [touch], targetTouches: [touch], changedTouches: [touch] }));
                target.dispatchEvent(new TouchEvent('touchend', { bubbles: true, cancelable: true, touches: [], targetTouches: [], changedTouches: [touch] }));
                window.__ptrEarlyTap = true;
            }, 100);
            setTimeout(() => {
                const pages = document.getElementById('appPages');
                const table = document.getElementById('tableResponsive');
                const side = document.getElementById('dataSideSection');
                if (!pages || !table || !side) return;
                side.classList.add('collapsed');
                if (typeof syncHistoryExpandedLock === 'function') syncHistoryExpandedLock();
                document.documentElement.style.minHeight = 'calc(100dvh + 34px)';
                document.body.style.minHeight = 'calc(100dvh + 34px)';
                document.documentElement.style.overflowY = 'auto';
                document.body.style.overflowY = 'auto';
                window.scrollTo(0, 34);
                pages.scrollTop = 34;
                table.scrollTop = 45;
                window.__ptrRestoredScroll = { root: window.scrollY, pages: pages.scrollTop, table: table.scrollTop };
                document.documentElement.style.overflowY = '';
                document.body.style.overflowY = '';
            }, 120);
        }, { once: true });
    });
    await page.addInitScript('(' + BOOT.toString() + ')(' + JSON.stringify(seed(160)) + ');');
    await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => document.querySelectorAll('#historyTableBody tr').length > 5, null, { timeout: 30000 });
    await page.addStyleTag({ content: '*, *::before, *::after { scroll-behavior: auto !important; }' });

    console.log('\n=== pull-to-refresh (ZoeW, iOS PWA) ===');
    ok('indicator ត្រូវបានបង្កើត', await page.evaluate(() => !!document.querySelector('.ptr-indicator')));
    ok('តេស្ត browser បើកផ្លូវ iOS panel handoff ពិតក្នុង app.js',
        await page.evaluate(() => typeof usesIOSPanelHandoff === 'function' && usesIOSPanelHandoff()));
    ok('របៀបធម្មតា ➜ non-passive listener ត្រៀមមុន touchstart ដើម្បីឲ្យ Safari អនុញ្ញាត PTR',
        await page.evaluate(() => window.__blockingTouchMoveCount()) === 1);

    const runGesture = async (steps) => {
        const out = await page.evaluate('(' + GESTURE.toString() + ')(' + JSON.stringify(steps) + ')');
        out.reloaded = takeReloads() > 0;
        return out;
    };
    const resetState = async () => {
        takeReloads();
        return page.evaluate(() => {
        if (typeof resetIOSTouchArbiter === 'function') resetIOSTouchArbiter();
        const pages = document.getElementById('appPages');
        if (pages) pages.style.scrollBehavior = 'auto';
        if (pages) pages.scrollTop = 0;
        const tr = document.getElementById('tableResponsive');
        if (tr) tr.scrollTop = 0;
        const side = document.getElementById('dataSideSection');
        if (side) side.classList.remove('collapsed', 'search-focus');
        if (typeof syncHistoryExpandedLock === 'function') syncHistoryExpandedLock();
        const root = document.scrollingElement || document.documentElement;
        if (root) root.scrollTop = 0;
        document.body.scrollTop = 0;
        window.scrollTo(0, 0);
        if (typeof showAppChrome === 'function') showAppChrome();
        document.body.classList.remove('chrome-hidden', 'chrome-space-released');
        });
    };
    const setCollapsed = async () => page.evaluate(() => {
        const side = document.getElementById('dataSideSection');
        const pages = document.getElementById('appPages');
        const table = document.getElementById('tableResponsive');
        if (!side || !pages || !table) return false;
        side.classList.add('collapsed');
        table.scrollTop = 0;
        pages.scrollTop = 0;
        syncHistoryExpandedLock();
        return side.classList.contains('collapsed') && pages.classList.contains('history-expanded');
    });
    const panelState = async () => page.evaluate(() => ({
        collapsed: document.getElementById('dataSideSection').classList.contains('collapsed'),
        expandedLock: document.getElementById('appPages').classList.contains('history-expanded')
    }));

    // ១) កំហុសដែលអ្នកប្រើរាយការណ៍៖ រមូរធម្មតាពីកំពូល មិនត្រូវក្លាយជា refresh
    await resetState();
    const gentle = await runGesture({ selector: '#appPages', x: 200, startY: 300, points: [{ y: 303 }, { y: 307 }, { y: 311 }, { y: 314 }] });
    ok('អូសខ្លីៗពីកំពូល (14px) ➜ មិនរារាំងការរមូរ និងមិនកេះ refresh', gentle.prevented === 0 && !gentle.reloaded, gentle);

    await resetState();
    const ordinary = await runGesture({ selector: '#appPages', x: 200, startY: 300, points: [{ y: 312 }, { y: 326 }, { y: 338 }, { y: 348 }] });
    ok('អូសធម្មតា 48px ➜ ចាប់អ័ក្សដើម្បីទប់ native refresh តែមិនកេះ refresh', ordinary.prevented > 0 && !ordinary.reloaded, ordinary);
    ok('អូសធម្មតា 48px ➜ indicator PTR នៅលាក់ដដែល', ordinary.maxIndicatorOpacity === 0, ordinary);
    ok('PTR listener ត្រៀមមុន touchstart និងនៅត្រៀមសម្រាប់ gesture បន្ទាប់ក្នុងរបៀបធម្មតា',
        ordinary.blockingAfterStart === 1 && ordinary.blockingAfterEnd === 1, ordinary);

    // អូសមធ្យម៖ ចាប់កាយវិការ តែ indicator មិនត្រូវលេចពេញមុនជិតកម្រិត refresh
    await resetState();
    const medium = await runGesture({ selector: '#appPages', x: 200, startY: 300, points: [{ y: 320 }, { y: 342 }, { y: 358 }, { y: 366 }] });
    ok('អូសមធ្យម (66px) ➜ រអិលត្រឡប់វិញ មិន refresh', medium.reloaded === false, medium);
    ok('អូសមធ្យម ➜ ចាប់យកកាយវិការ (preventDefault) ដើម្បីបង្ហាញ indicator', medium.prevented > 0, medium);
    ok('អូសមធ្យម ➜ indicator មិនលេចពេញលឿនពេក', medium.maxIndicatorOpacity < 0.25, medium);

    await resetState();
    const bounce = await runGesture({ selector: '#appPages', negativeBounce: true, x: 200, startY: 300, points: [{ y: 324 }, { y: 360 }, { y: 390 }] });
    ok('Safari rubber-band (scrollTop អវិជ្ជមាន) ➜ PTR នៅតែចាប់ gesture បានដោយស្ថេរភាព',
        bounce.prevented > 0 && !bounce.reloaded, bounce);

    // ២) អូសផ្ដេក មិនត្រូវក្លាយជា pull
    await resetState();
    const sideways = await runGesture({ selector: '#appPages', x: 200, startY: 300, points: [{ y: 303, dx: 20 }, { y: 306, dx: 46 }, { y: 308, dx: 80 }] });
    ok('អូសផ្ដេក ➜ មិនកេះ refresh', sideways.prevented === 0 && !sideways.reloaded, sideways);

    // ៣) អូសឡើងលើ (រមូរចុះ) មិនត្រូវក្លាយជា pull
    await resetState();
    const upward = await runGesture({ selector: '#appPages', x: 200, startY: 400, points: [{ y: 380 }, { y: 350 }, { y: 310 }, { y: 270 }] });
    ok('អូសឡើងលើ ➜ មិនកេះ refresh', upward.prevented === 0 && !upward.reloaded, upward);

    // ៥) ពេលតារាងខាងក្នុងត្រូវបានរមូរចុះរួច ការទាញមិនត្រូវកេះ refresh
    await resetState();
    const nestedTop = await page.evaluate(() => { const tr = document.getElementById('tableResponsive'); if (!tr) return -1; tr.style.scrollBehavior = 'auto'; tr.scrollTop = 120; return tr.scrollTop; });
    ok('តារាងខាងក្នុងអាចរមូរបានពិត (ដូច្នេះតេស្តមិនទទេ)', nestedTop > 0, nestedTop);
    const nested = await runGesture({ selector: '#tableResponsive', x: 200, startY: 500, points: [{ y: 540 }, { y: 590 }, { y: 650 }, { y: 700 }] });
    ok('តារាងខាងក្នុងរមូរចុះរួច ➜ PTR មិនដណ្ដើម gesture និងមិនកេះ refresh',
        nested.prevented === 0 && nested.reloaded === false, nested);
    ok('តារាងមិននៅកំពូល ➜ PTR listener មិន preventDefault ហើយនៅត្រៀមសម្រាប់ Safari',
        nested.prevented === 0 && nested.blockingAfterStart === 1 && nested.blockingAfterEnd === 1, nested);

    // ៦) ប្រអប់បើក ➜ គ្មាន pull
    await resetState();
    await page.evaluate(() => window.openExchangeRateModal());
    const inModal = await runGesture({ x: 200, startY: 160, points: [{ y: 220 }, { y: 300 }, { y: 400 }, { y: 500 }] });
    ok('ប្រអប់បើក ➜ PTR មិនដណ្ដើម gesture និងមិនកេះ refresh',
        inModal.prevented === 0 && inModal.reloaded === false, inModal);
    await page.evaluate(() => window.closeModal('exchangeRateModal'));

    await resetState();
    await page.evaluate(() => window.openSideDrawer());
    const inDrawer = await runGesture({ selector: '#appPages', x: 200, startY: 160, points: [{ y: 220 }, { y: 300 }, { y: 400 }, { y: 500 }] });
    ok('ម៉ឺនុយចំហៀងបើក ➜ PTR មិនដណ្ដើម gesture និងមិនកេះ refresh',
        inDrawer.prevented === 0 && inDrawer.reloaded === false, inDrawer);
    await page.evaluate(() => window.closeSideDrawer());

    await resetState();
    const onControl = await runGesture({ selector: '#btnFilterToday', x: 80, startY: 210, points: [{ y: 250 }, { y: 320 }, { y: 410 }, { y: 520 }] });
    ok('អូសលើប៊ូតុង/វាលបញ្ចូល ➜ PTR មិនដណ្ដើម touch', onControl.prevented === 0 && !onControl.reloaded, onControl);

    await resetState();
    const rowControlShort = await runGesture({ selector: '#historyTableBody .close-btn', x: 330, startY: 300, points: [{ y: 303 }, { y: 307 }, { y: 311 }, { y: 314 }] });
    ok('អូសខ្លី 14px ចាប់ពីប៊ូតុងក្នុងជួរតារាង ➜ ទុកជា tap/scroll ធម្មតា',
        rowControlShort.prevented === 0 && !rowControlShort.reloaded, rowControlShort);

    // === ទីតាំងសញ្ញា PTR ធៀបនឹងរបាខាងលើ តាមទំហំអេក្រង់ ===
    // ⛔ tablet ផ្តេក (≥992px) ៖ របា Tab ផ្លាស់ទៅនៅក្រោម navbar ➜ សញ្ញា PTR (fixed · តម្លៃកំណត់សម្រាប់ទូរស័ព្ទ) ធ្លាក់ជាន់លើរបា Tab
    //    (វីដេអូ tablet 11.5" របស់ម្ចាស់គម្រោង)។ ច្បាប់ ៖ ពេល «ready» គម្លាតពីគែមក្រោមរបាខាងលើ ត្រូវស្មើទូរស័ព្ទ (±2px) · មិនជាន់។
    console.log('\n=== ទីតាំងសញ្ញា PTR ធៀបនឹងរបាខាងលើ (ទូរស័ព្ទ · tablet បញ្ឈរ/ផ្តេក) ===');
    const PULL_TO_READY = (opts) => new Promise((resolve) => {
        const target = document.elementFromPoint(opts.x, opts.startY);
        const ind = document.querySelector('.ptr-indicator');
        const touch = (y) => new Touch({ identifier: 7, target: target, clientX: opts.x, clientY: y, pageX: opts.x, pageY: y });
        const fire = (type, touches, changed) => target.dispatchEvent(new TouchEvent(type, {
            bubbles: true, cancelable: type !== 'touchcancel', touches: touches, targetTouches: touches, changedTouches: changed }));
        let y = opts.startY;
        let n = 0;
        let t = touch(y);
        fire('touchstart', [t], [t]);
        const tick = () => {
            y += 6;
            n++;
            t = touch(y);
            fire('touchmove', [t], [t]);
            requestAnimationFrame(() => {
                const ready = ind.classList.contains('ready');
                if (!ready && n < 120) return tick();
                const r = ind.getBoundingClientRect();
                const nav = document.querySelector('.app-navbar').getBoundingClientRect();
                const tabEl = document.getElementById('pageTabBar');
                const tab = tabEl ? tabEl.getBoundingClientRect() : null;
                const tabAtTop = !!tab && tab.top < window.innerHeight / 2;
                const chromeBottom = Math.max(nav.bottom, tabAtTop ? tab.bottom : 0);
                fire('touchcancel', [], [t]);
                resolve({ target: target ? (target.id || target.className || target.tagName) : null, ready: ready, width: window.innerWidth, top: Math.round(r.top * 10) / 10,
                    navBottom: Math.round(nav.bottom * 10) / 10, tabAtTop: tabAtTop,
                    chromeBottom: Math.round(chromeBottom * 10) / 10, gap: Math.round((r.top - chromeBottom) * 10) / 10 });
            });
        };
        requestAnimationFrame(tick);
    });
    const measurePtrAt = async (width, height) => {
        await page.setViewportSize({ width: width, height: height });
        await page.waitForTimeout(450);
        await resetState();
        const start = await page.evaluate(() => {
            const zone = Math.round(window.innerHeight * 0.4);
            const top = document.querySelector('.app-navbar').getBoundingClientRect().bottom;
            const blocked = 'button, a, input, textarea, select, [contenteditable="true"], .app-navbar, .page-tabbar';
            const xs = [0.62, 0.5, 0.8, 0.3].map((f) => Math.round(window.innerWidth * f));
            for (let y = zone - 12; y > top + 16; y -= 10) {
                for (const x of xs) {
                    const el = document.elementFromPoint(x, y);
                    if (el && el.closest && !el.closest(blocked) && el.closest('#appPages')) return { x: x, y: y };
                }
            }
            return { x: Math.round(window.innerWidth / 2), y: zone - 12 };
        });
        const out = await page.evaluate('(' + PULL_TO_READY.toString() + ')(' + JSON.stringify({ x: start.x, startY: start.y }) + ')');
        out.reloaded = takeReloads() > 0;
        await page.waitForTimeout(350);
        return out;
    };
    const ptrPhone = await measurePtrAt(412, 780);
    ok('ទូរស័ព្ទ (412px) ៖ ទាញដល់ ready ពិត (លក្ខខណ្ឌចាំបាច់)', ptrPhone.ready && !ptrPhone.tabAtTop && !ptrPhone.reloaded, ptrPhone);
    ok('ទូរស័ព្ទ ៖ សញ្ញា PTR ពេល ready មិនជាន់ navbar', ptrPhone.gap >= 0, ptrPhone);
    for (const [w, h, label] of [[1280, 800, 'tablet ផ្តេក 1280×800'], [1194, 834, 'iPad ផ្តេក 1194×834'], [800, 1280, 'tablet បញ្ឈរ 800×1280']]) {
        const m = await measurePtrAt(w, h);
        const wide = w >= 992;
        ok(`${label} ៖ ទាញដល់ ready ពិត · របា Tab ${wide ? 'នៅខាងលើ' : 'នៅខាងក្រោម'} (លក្ខខណ្ឌចាំបាច់)`,
            m.ready && m.tabAtTop === wide && !m.reloaded, m);
        ok(`${label} ៖ សញ្ញា PTR ពេល ready មិនជាន់របាខាងលើ (navbar${wide ? ' + Tab' : ''})`, m.gap >= 0, m);
        ok(`${label} ៖ គម្លាតពីរបាខាងលើស្មើទូរស័ព្ទ (${ptrPhone.gap}px ±2)`, Math.abs(m.gap - ptrPhone.gap) <= 2, { tablet: m.gap, phone: ptrPhone.gap });
    }
    await page.setViewportSize({ width: 412, height: 780 });
    await page.waitForTimeout(450);
    await resetState();

    console.log('\n=== PTR និងកាយវិការបើកផ្ទាំង មិនប្រជែងគ្នា ===');
    await resetState();
    const collapsedReady = await setCollapsed();
    ok('លក្ខខណ្ឌតេស្ត៖ ប្រវត្តិកំពុងពេញអេក្រង់', collapsedReady, collapsedReady);
    const shortPanelPull = await runGesture({ selector: '#tableResponsive', x: 200, startY: 220, points: [{ y: 232 }, { y: 244 }, { y: 256 }, { y: 268 }] });
    const shortPanelAfter = await panelState();
    ok('អូសខ្លី 48px លើតារាងពេញអេក្រង់ ➜ បើកផ្ទាំង មិន refresh',
        shortPanelPull.prevented > 0 && shortPanelPull.maxIndicatorOpacity === 0 && !shortPanelPull.reloaded &&
        !shortPanelAfter.collapsed && !shortPanelAfter.expandedLock,
        { gesture: shortPanelPull, state: shortPanelAfter });

    await resetState();
    await setCollapsed();
    const mediumPanelPull = await runGesture({ selector: '#tableResponsive', x: 200, startY: 220, points: [{ y: 244 }, { y: 278 }, { y: 300 }] });
    const mediumPanelAfter = await panelState();
    ok('អូសមធ្យម 80px លើតារាងពេញអេក្រង់ ➜ បិទ PTR ទាំងស្រុង ហើយបើកផ្ទាំង',
        mediumPanelPull.prevented > 0 && mediumPanelPull.maxIndicatorOpacity === 0 && !mediumPanelPull.reloaded &&
        !mediumPanelAfter.collapsed && !mediumPanelAfter.expandedLock,
        { gesture: mediumPanelPull, state: mediumPanelAfter });

    await resetState();
    await setCollapsed();
    const longPanelPull = await runGesture({ selector: '#tableResponsive', x: 200, startY: 220,
        points: [{ y: 280 }, { y: 360 }, { y: 445 }] });
    const longPanelAfter = await panelState();
    ok('អូសវែងដល់កម្រិត refresh លើតារាងពេញអេក្រង់ ➜ គ្មាន PTR/indicator ហើយបើកផ្ទាំងធម្មតា',
        longPanelPull.prevented > 0 && longPanelPull.maxIndicatorOpacity === 0 && !longPanelPull.reloaded &&
        longPanelPull.blockingAfterStart === 0 && longPanelPull.blockingAfterEnd === 1 &&
        !longPanelAfter.collapsed && !longPanelAfter.expandedLock,
        { gesture: longPanelPull, state: longPanelAfter });

    await resetState();
    await setCollapsed();
    const diagonalPanelPull = await runGesture({ selector: '#tableResponsive', x: 200, startY: 220, points: [{ y: 250, dx: 50 }, { y: 260, dx: 80 }] });
    const diagonalPanelAfter = await panelState();
    ok('អូសផ្ដេក/ទ្រេតលើតារាងពេញអេក្រង់ ➜ មិនបើកផ្ទាំង និងមិនកេះ PTR',
        diagonalPanelPull.prevented === 0 && !diagonalPanelPull.reloaded &&
        diagonalPanelAfter.collapsed && diagonalPanelAfter.expandedLock,
        { gesture: diagonalPanelPull, state: diagonalPanelAfter });

    await resetState();
    await setCollapsed();
    const multiBeforePTR = await runGesture({ selector: '#tableResponsive', x: 200, startY: 220, points: [{ y: 244 }, { y: 270, addFinger: true }, { y: 300 }] });
    const multiBeforeAfter = await panelState();
    ok('បន្ថែមម្រាមដៃទី២ មុនកម្រិត PTR ➜ បោះបង់ទាំង refresh និងការបើកផ្ទាំង',
        !multiBeforePTR.reloaded && multiBeforeAfter.collapsed && multiBeforeAfter.expandedLock,
        { gesture: multiBeforePTR, state: multiBeforeAfter });

    await resetState();
    await setCollapsed();
    const multiReady = await runGesture({ selector: '#tableResponsive', x: 200, startY: 220, points: [{ y: 280 }, { y: 360 }, { y: 445, addFinger: true }, { y: 500 }] });
    const multiReadyAfter = await panelState();
    ok('បន្ថែមម្រាមដៃទី២ ក្រោយ indicator ត្រៀម refresh ➜ បោះបង់ refresh និងមិនបើកផ្ទាំង',
        !multiReady.reloaded && multiReadyAfter.collapsed && multiReadyAfter.expandedLock,
        { gesture: multiReady, state: multiReadyAfter });

    await resetState();
    await setCollapsed();
    const finalReversal = await runGesture({ selector: '#tableResponsive', x: 200, startY: 220, points: [{ y: 280 }, { y: 360 }, { y: 445 }], endY: 140 });
    const finalReversalAfter = await panelState();
    ok('ម្រាមដៃត្រឡប់ឡើងលឿននៅ touchend ➜ មិន commit refresh/action ចាស់ពី touchmove',
        !finalReversal.reloaded && finalReversalAfter.collapsed && finalReversalAfter.expandedLock,
        { gesture: finalReversal, state: finalReversalAfter });

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
    // កំណែ 2.9.0៖ កាតបញ្ជីខ្ពស់ដូចគ្នាទាំង ២ របៀបដោយចេតនា ដូច្នេះកម្ពស់តារាង
    // **មិនត្រូវប្រែ** ទៀតទេ។ នេះជាលក្ខខណ្ឌដែលធ្វើឲ្យការរំកិល ១:១ ចុះចំកន្លែង
    // បេះបិទ ហើយវាក៏លុបថ្នាក់កំហុស «ប្តូរកម្ពស់កន្សោមរមូរកណ្តាល momentum» ចោល
    // តាមរចនាសម្ព័ន្ធផងដែរ។ (មុននេះ៖ 482px ធម្មតា ➜ 538px ពេញអេក្រង់។)
    ok('កម្ពស់តារាងមិនប្រែរវាង ២ របៀប (លក្ខខណ្ឌនៃការរំកិលរអិល)', fullscreen.tableH === fullscreen.tableHBefore, fullscreen);
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
    const scrollTo = (top) => page.evaluate(async (t) => {
        const el = document.getElementById('tableResponsive') || document.getElementById('appPages');
        el.style.scrollBehavior = 'auto';
        el.scrollTop = t;
        if (el.scrollTop !== t) return -1;
        el.dispatchEvent(new Event('scroll', { bubbles: false }));
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
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

    // ⛔ ម៉ឺនុយ ☰ / ផ្ទាំង 🔔 គ្របរបាដូច modal (backdrop z-index 1200 > 900) ➜ បើកមិនប្តូររបា (សំណើម្ចាស់គម្រោង ៖ «កែម៉ឺនុយ ☰ ដែរ»)
    await scrollTo(200); await scrollTo(400);
    ok('លក្ខខណ្ឌចាំបាច់ ៖ របាលាក់មុនបើកម៉ឺនុយ', await hidden() === true);
    await page.evaluate(() => window.openSideDrawer());
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const drawerOpen = await page.evaluate(() => document.getElementById('sideDrawer').classList.contains('open'));
    ok('⛔ បើកម៉ឺនុយ ☰ ពេលរបាលាក់ ➜ របានៅលាក់', drawerOpen && await hidden() === true, { drawerOpen });
    await page.evaluate(async () => {
        const box = document.querySelector('#sideDrawer .drawer-body') || document.getElementById('sideDrawer');
        [0, 120, 0].forEach((t) => { box.scrollTop = t; box.dispatchEvent(new Event('scroll', { bubbles: false })); });
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    });
    ok('រមូរក្នុងម៉ឺនុយមិនបង្ហាញរបា', await hidden() === true);
    await page.evaluate(() => window.closeSideDrawer());
    ok('បិទម៉ឺនុយ ➜ របានៅដដែល', await hidden() === true);
    await scrollTo(300);
    ok('បិទម៉ឺនុយរួចរមូរឡើង ➜ បង្ហាញវិញ', await hidden() === false);

    await scrollTo(200); await scrollTo(400);
    await page.evaluate(() => window.switchAppPage('entry'));
    ok('ប្តូរទំព័រ ➜ បង្ហាញរបាវិញ', await hidden() === false);
    await page.evaluate(() => window.switchAppPage('data'));

    // ⛔ modal គ្របរបា (z-index) ➜ បើក modal មិនប្តូររបាទេ ៖ ការបង្ហាញរបាប្តូរ clip-path · padding របស់បញ្ជី ➜ គូរបញ្ជីទាំងមូលឡើងវិញ
    //    (សំណើម្ចាស់គម្រោង ៖ «រមូរដល់ចុង កញ្ចប់ច្រើន ចុចបើកធុងសំរាម/បញ្ជី ZTO អាក់អាក់») · ការរមូរក្នុង modal មិនបញ្ជារបា
    await scrollTo(200); await scrollTo(400);
    ok('លក្ខខណ្ឌចាំបាច់ ៖ របាលាក់មុនបើក modal', await hidden() === true);
    const listPaint = () => page.evaluate(() => {
        const t = document.getElementById('tableResponsive');
        const main = t.closest('.page-main');
        const card = t.closest('.app-card');
        return [getComputedStyle(t).paddingBottom, getComputedStyle(main).clipPath, card ? getComputedStyle(card).clipPath : ''].join(' | ');
    });
    const paintBefore = await listPaint();
    await page.evaluate(() => window.openRecentlyDeletedModal());
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const modalOpen = await page.evaluate(() => getComputedStyle(document.getElementById('recentlyDeletedModal')).display !== 'none');
    ok('⛔ បើក modal ពេលរបាលាក់ ➜ របានៅលាក់', modalOpen && await hidden() === true, { modalOpen });
    ok('⛔ បើក modal មិនប្តូរ clip-path/padding របស់បញ្ជី (គ្មានការគូរបញ្ជីឡើងវិញ)', await listPaint() === paintBefore, paintBefore);
    await page.evaluate(async () => {
        const box = document.querySelector('#recentlyDeletedModal .modal-content');
        [0, 120, 0].forEach((t) => { box.scrollTop = t; box.dispatchEvent(new Event('scroll', { bubbles: false })); });
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    });
    ok('រមូរក្នុង modal មិនបង្ហាញរបា', await hidden() === true);
    await page.evaluate(() => window.closeModal('recentlyDeletedModal'));
    ok('បិទ modal ➜ របានៅដដែល', await hidden() === true);
    await scrollTo(300);
    ok('បិទ modal រួចរមូរឡើង ➜ បង្ហាញវិញ (ការលាក់តាមទិសរមូរនៅដដែល)', await hidden() === false);

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
        // គែម **ដែលមើលឃើញ** = គែមប្រអប់ ដក clip inset។ ចាប់ពីកំណែ 2.11.0
        // ប្រអប់មានកម្ពស់ថេរ ➜ អ្វីដែលប្រែគឺការកាត់រូបភាព មិនមែន layout ទេ។
        // ⛔ clip រស់លើ **កាត** ផង (ស៊ុមក្លែងរបស់ Android) ➜ វាស់គ្រប់ឪពុករហូតដល់ `.page-main`
        const snap = () => {
            const main = table.closest('.page-main');
            let vis = table.getBoundingClientRect().bottom;
            for (let el = table.parentElement; el; el = el.parentElement) {
                const m = /inset\(([^)]*)\)/.exec(getComputedStyle(el).clipPath || '');
                if (m) {
                    const tk = m[1].split('round')[0].trim().split(/\s+/);
                    vis = Math.min(vis, el.getBoundingClientRect().bottom - (parseFloat(tk.length >= 3 ? tk[2] : tk[0]) || 0));
                }
                if (el === main) break;
            }
            return { h: table.clientHeight, top: Math.round(table.getBoundingClientRect().top),
                     pad: window.getComputedStyle(pages).paddingBottom, vis: Math.round(vis) };
        };
        showAppChrome();
        await wait(240);
        const shown = snap();
        hideAppChrome();
        await wait(60);
        const duringHide = snap();
        await wait(180);
        const away = snap();
        showAppChrome();
        await wait(60);
        const duringShow = snap();
        await wait(180);
        const restored = snap();
        return { shown, duringHide, away, duringShow, restored, expanded: pages.classList.contains('history-expanded') };
    });
    ok('នៅក្នុងរបៀបប្រវត្តិពេញអេក្រង់ពិត (លក្ខខណ្ឌចាំបាច់)', noReflow.expanded === true, noReflow);
    // សំណើអ្នកប្រើ (ដូចកំណែ 2.2.0)៖ ពេលរបា Tab លាក់ខ្លួន កន្លែងរបស់វាត្រូវ
    // **ប្រគល់មកកាតវិញ** ➜ គ្មានចន្លោះទទេនៅបាតអេក្រង់។
    ok('លាក់របា ➜ ផ្ទៃដែលមើលឃើញរីកចុះបំពេញកន្លែងរបា (គ្មានចន្លោះទទេ)',
        noReflow.away.vis > noReflow.shown.vis, noReflow);
    // កំណែ 2.11.0៖ កម្ពស់កន្សោមរមូរ **មិនប្តូរសោះ** ទៀតទេ — មិនត្រឹមតែពេល
    // momentum ទេ។ នេះជាការធានាខ្លាំងជាងមុន ➜ ថ្នាក់កំហុស «បញ្ជីលោតរំលង»
    // ក្លាយជាមិនអាចកើតឡើងបានតាមរចនាសម្ព័ន្ធ។
    ok('លាក់/បង្ហាញរបា Tab ➜ កម្ពស់ scroll container មិនប្តូរសោះ (គ្រប់ដំណាក់កាល)',
        noReflow.duringHide.h === noReflow.shown.h && noReflow.away.h === noReflow.shown.h &&
        noReflow.duringShow.h === noReflow.shown.h && noReflow.restored.h === noReflow.shown.h, noReflow);
    ok('បង្ហាញរបាវិញ ➜ ផ្ទៃដែលមើលឃើញត្រឡប់ដូចដើម',
        noReflow.restored.vis === noReflow.shown.vis && noReflow.restored.pad === noReflow.shown.pad, noReflow);
    ok('លាក់របា ➜ ទីតាំង**កំពូល**តារាងមិនប្តូរ (រីកតែខាងក្រោម មិនរុញមាតិកា)',
        noReflow.shown.top === noReflow.away.top, noReflow);
    // ថ្នាក់កំហុស 2.2.1៖ padding នោះត្រូវបាន **ធ្វើចលនា** ➜ កម្ពស់កន្សោមរមូរ
    // ប្តូររាល់ស៊ុមអស់ ០.២៦ វិនាទី ចំពេល momentum scroll ➜ បញ្ជីលោតរំលង។
    // ការប្តូរភ្លាមមួយដងមិនស្ថិតក្នុងថ្នាក់នោះទេ — តែ transition ត្រូវហាមដាច់ខាត។
    const padTransition = await page.evaluate(() => {
        const cs = window.getComputedStyle(document.getElementById('appPages'));
        return { prop: cs.transitionProperty, dur: cs.transitionDuration };
    });
    ok('#appPages គ្មាន transition លើ padding (ឫសគល់នៃការលោតរំលងក្នុង 2.2.1)',
        !/padding|\ball\b/.test(padTransition.prop) || parseFloat(padTransition.dur) === 0, padTransition);
    const cssNoPadAnim = fs.readFileSync(path.join(ROOT, 'ZoeW', 'style.css'), 'utf8');
    ok('style.css គ្មានច្បាប់ណាធ្វើចលនាលើ padding របស់ .app-pages',
        !/\.app-pages[^{]*\{[^}]*transition:[^;}]*padding/.test(cssNoPadAnim));

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
        const main = table.closest('.page-main');
        let visible = table.getBoundingClientRect().bottom;
        for (let el = table.parentElement; el; el = el.parentElement) {
            const m = /inset\(([^)]*)\)/.exec(getComputedStyle(el).clipPath || '');
            if (m) {
                const tk = m[1].split('round')[0].trim().split(/\s+/);
                visible = Math.min(visible, el.getBoundingClientRect().bottom - (parseFloat(tk.length >= 3 ? tk[2] : tk[0]) || 0));
            }
            if (el === main) break;
        }
        return {
            tableBottom: Math.round(table.getBoundingClientRect().bottom),
            tableVisibleBottom: Math.round(visible),
            cardBottom: Math.round(card.getBoundingClientRect().bottom),
            tabbarTop: Math.round(tabbar.getBoundingClientRect().top),
            tabbarH: Math.round(tabbar.getBoundingClientRect().height),
            chromeBottom: window.getComputedStyle(document.documentElement).getPropertyValue('--chrome-bottom').trim()
        };
    });
    ok('កម្ពស់របា Tab ត្រូវបានវាស់ចូល --chrome-bottom', /^[0-9.]+px$/.test(bottomRoom.chromeBottom), bottomRoom);
    // ការអះអាងត្រូវមាន **២ ខាង**៖ មិនលិចក្រោមរបា *និង* មិនឈប់ខ្ពស់ជាងរបា។
    // កំណែ 2.11.0 ដំបូងអះអាងតែម្ខាង ➜ ចន្លោះទទេ 19–53px រអិលកាត់ ហើយអ្នកប្រើ
    // រាយការណ៍ថា «បាំងក្រាស់ណាស់»។ ⛔ ឥឡូវកាតឈប់ខាងលើរបា **៨px ដូច iOS** ជាមួយស៊ុមក្រោមកាតដែលគូរ
    // (អ្នកប្រើប្រៀបរូបថត iPhone/Android) — ការកាត់ចំគែមរបាពីមុន បាំងគែមក្រោម និងជ្រុងមូលរបស់កាតជានិច្ច។
    ok('ពេលរបា Tab ឲ្យឃើញ ➜ កាតដែលមើលឃើញឈប់ខាងលើរបា ៨px ដូច iOS (6–10px)',
        bottomRoom.tabbarTop - bottomRoom.tableVisibleBottom >= 6 &&
        bottomRoom.tabbarTop - bottomRoom.tableVisibleBottom <= 10, bottomRoom);
    const filled = await page.evaluate(async () => {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const card = document.querySelector('#dataMainSection .history-section');
        hideAppChrome();
        await wait(240);
        const bottom = Math.round(card.getBoundingClientRect().bottom);
        showAppChrome();
        await wait(240);
        return { bottom: bottom, viewport: window.innerHeight };
    });
    ok('ពេលរបា Tab លាក់ ➜ គែមក្រោមកាតចុះជិតបាតអេក្រង់ (គ្មានចន្លោះទទេ)',
        filled.viewport - filled.bottom <= 16, filled);

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

    // === --chrome-bottom ត្រូវវាស់ជា *កម្ពស់របា + ផ្នែក body លើស viewport* ===
    // `.app-pages` កក់កន្លែងរបា Tab ជា padding។ លើ Android body = viewport
    // ➜ ចម្ងាយនោះ = `offsetHeight` របស់របា។ តែក្នុង
    // របៀប standalone លើ iOS, CSS ធ្វើឲ្យ body វែងជាង viewport តាម
    // `env(safe-area-inset-bottom)` (ដើម្បីគ្របអេក្រង់) ➜ ចម្ងាយនោះធំជាង
    // `offsetHeight` តាមចំនួន inset។ ការវាស់ជា `offsetHeight` ➜ កក់ខ្វះ ➜
    // **របា Tab បាំងគែមកាតលើ iPhone** (Android មិនប៉ះ ព្រោះ inset = 0)។
    console.log('\n=== --chrome-bottom វាស់តាមកម្ពស់ body (កំហុស iPhone) ===');
    await resetState();
    await page.evaluate(() => { const h = document.getElementById('dragHandle'); if (h) h.click(); });
    await page.evaluate(() => new Promise((r) => setTimeout(r, 420)));
    const measure = await page.evaluate(async () => {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const tabbar = document.getElementById('pageTabBar');
        const card = document.querySelector('#dataMainSection .history-section');
        const read = () => ({
            chromeBottom: Math.round(parseFloat(
                getComputedStyle(document.documentElement).getPropertyValue('--chrome-bottom'))),
            pageExtension: Math.round(parseFloat(
                getComputedStyle(document.documentElement).getPropertyValue('--page-extension')) || 0),
            barH: Math.round(tabbar.offsetHeight),
            cardBottom: Math.round(card.getBoundingClientRect().bottom),
            tableBottom: Math.round(document.getElementById('tableResponsive').getBoundingClientRect().bottom),
            tableVisibleBottom: (() => {
                const t = document.getElementById('tableResponsive');
                const mn = t.closest('.page-main');
                let vis = t.getBoundingClientRect().bottom;
                for (let el = t.parentElement; el; el = el.parentElement) {
                    const m = /inset\(([^)]*)\)/.exec(getComputedStyle(el).clipPath || '');
                    if (m) {
                        const tk = m[1].split('round')[0].trim().split(/\s+/);
                        vis = Math.min(vis, el.getBoundingClientRect().bottom - (parseFloat(tk.length >= 3 ? tk[2] : tk[0]) || 0));
                    }
                    if (el === mn) break;
                }
                return Math.round(vis);
            })(),
            barTop: Math.round(tabbar.getBoundingClientRect().top),
            viewportH: Math.round(window.innerHeight)
        });
        window.measureAppChromeSize();
        await wait(120);
        const flat = read();
        // ធ្វើត្រាប់តាម iOS standalone៖ body វែងជាង viewport ៣៤px
        const st = document.createElement('style');
        st.textContent = 'html, body { min-height: calc(100dvh + 34px) !important; }';
        document.head.appendChild(st);
        await wait(120);
        window.measureAppChromeSize();
        await wait(160);
        const inset = read();
        document.documentElement.style.overflowY = 'auto';
        document.body.style.overflowY = 'auto';
        window.scrollTo(0, 34);
        await wait(120);
        window.measureAppChromeSize();
        await wait(120);
        const scrolled = Object.assign({ windowY: Math.round(window.scrollY) }, read());
        window.scrollTo(0, 0);
        document.documentElement.style.overflowY = '';
        document.body.style.overflowY = '';
        await wait(120);
        window.hideAppChrome();
        await wait(340);
        window.measureAppChromeSize();
        await wait(120);
        const hidden = read();
        window.showAppChrome();
        await wait(340);
        window.measureAppChromeSize();
        await wait(120);
        const shown = read();
        st.remove();
        await wait(120);
        window.measureAppChromeSize();
        return { flat: flat, inset: inset, scrolled: scrolled, hidden: hidden, shown: shown };
    });
    console.log('    inset 0 (Android) ៖ --chrome-bottom ' + measure.flat.chromeBottom +
                ' · កម្ពស់របា ' + measure.flat.barH);
    console.log('    inset ៣៤px (iPhone)៖ --chrome-bottom ' + measure.inset.chromeBottom +
                ' · កម្ពស់របា ' + measure.inset.barH);
    ok('inset 0 ➜ --chrome-bottom = កម្ពស់របា (Android មិនប្រែសោះ)',
        Math.abs(measure.flat.chromeBottom - measure.flat.barH) <= 1, measure.flat);
    ok('body វែងជាង viewport ៣៤px ➜ --chrome-bottom បូក inset ដោយស្វ័យប្រវត្តិ',
        measure.inset.chromeBottom >= measure.inset.barH + 33, measure.inset);
    ok('root មាន offset ៣៤px ពេល WebKit កំពុង restore ➜ ការវាស់ safe-area មិនរួញ',
        measure.scrolled.windowY > 0 && measure.scrolled.chromeBottom >= measure.scrolled.barH + 33,
        measure.scrolled);
    // កំណែ 2.11.0៖ ប្រអប់កាតលាតដល់បាតអេក្រង់ដោយចេតនា (កម្ពស់ថេរ ➜ គ្មានការ
    // ប្តូរ layout ពេលរបាលាក់)។ អ្វីដែលត្រូវអះអាងគឺគែម **ដែលមើលឃើញ** របស់
    // តារាង ដែលកាត់ដោយ `clip-path` ➜ ជួរដេកមិនលិចក្រោមរបា។
    ok('inset 0 ➜ គែមតារាងដែលមើលឃើញ ឈរខាងលើរបា Tab',
        measure.flat.tableVisibleBottom <= measure.flat.barTop + 1, measure.flat);
    ok('**inset ៣៤px ➜ គែមតារាងដែលមើលឃើញ នៅតែឈរខាងលើរបា Tab** (កំហុស iPhone ត្រូវកែ)',
        measure.inset.tableVisibleBottom <= measure.inset.barTop + 1, measure.inset);
    ok('វាស់ពេលរបា Tab លាក់ដោយ transform ➜ --chrome-bottom មិនរួញបាត់ safe-area',
        measure.hidden.chromeBottom >= measure.hidden.barH + 33, measure.hidden);
    ok('inset ៣៤px + របា Tab លាក់ ➜ គែមតារាងដែលមើលឃើញ ចុះដល់ជិតបាតអេក្រង់',
        measure.hidden.pageExtension >= 33 &&
        measure.hidden.viewportH - measure.hidden.tableVisibleBottom >= 0 &&
        measure.hidden.viewportH - measure.hidden.tableVisibleBottom <= 24, measure.hidden);
    ok('បង្ហាញរបា Tab វិញ ➜ គែមតារាងដែលមើលឃើញ នៅតែឈរខាងលើរបា',
        measure.shown.tableVisibleBottom <= measure.shown.barTop + 1, measure.shown);
    await page.evaluate(() => { const h = document.getElementById('dragHandle'); if (h) h.click(); });
    await page.evaluate(() => new Promise((r) => setTimeout(r, 420)));

    const scrollPolicy = await page.evaluate(() => {
        const pages = document.getElementById('appPages');
        const htmlStyle = getComputedStyle(document.documentElement);
        const bodyStyle = getComputedStyle(document.body);
        const pagesStyle = getComputedStyle(pages);
        return {
            navigatorStandalone: window.navigator.standalone === true,
            standaloneClass: document.documentElement.classList.contains('ios-standalone'),
            htmlOverflowY: htmlStyle.overflowY,
            bodyOverflowY: bodyStyle.overflowY,
            htmlOverscrollY: htmlStyle.overscrollBehaviorY,
            bodyOverscrollY: bodyStyle.overscrollBehaviorY,
            pagesMinHeight: pagesStyle.minHeight,
            pagesOverscrollY: pagesStyle.overscrollBehaviorY
        };
    });
    ok('តេស្តប្រើផ្លូវរកឃើញ iOS standalone ដូច production',
        scrollPolicy.navigatorStandalone && scrollPolicy.standaloneClass, scrollPolicy);
    ok('iOS standalone ➜ root html/body មិនមែនជា scroller ទៀតទេ',
        scrollPolicy.htmlOverflowY === 'hidden' && scrollPolicy.bodyOverflowY === 'hidden', scrollPolicy);
    ok('iOS standalone ➜ បិទ overscroll លើ root ទាំងពីរ',
        scrollPolicy.htmlOverscrollY === 'none' && scrollPolicy.bodyOverscrollY === 'none', scrollPolicy);
    ok('#appPages ជា scroll owner តែមួយ (min-height:0 + contain)',
        scrollPolicy.pagesMinHeight === '0px' && scrollPolicy.pagesOverscrollY === 'contain', scrollPolicy);

    const lateChrome = await page.evaluate(async () => {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const navbar = document.querySelector('.app-navbar');
        const pages = document.getElementById('appPages');
        if (!navbar || !pages) return { missing: true };
        measureAppChromeSize();
        const originalHeight = navbar.style.height;
        const beforeHeight = navbar.offsetHeight;
        navbar.style.height = (beforeHeight + 34) + 'px';
        await wait(180);
        const afterHeight = navbar.offsetHeight;
        const chromeTop = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--chrome-top'));
        const contentTop = pages.getBoundingClientRect().top + parseFloat(getComputedStyle(pages).paddingTop);
        const navbarBottom = navbar.getBoundingClientRect().bottom;
        navbar.style.height = originalHeight;
        await wait(180);
        return { beforeHeight, afterHeight, chromeTop, contentTop, navbarBottom };
    });
    ok('safe-area/navbar ធំឡើងយឺត 34px ➜ --chrome-top វាស់ឡើងវិញដោយស្វ័យប្រវត្តិ',
        !lateChrome.missing && Math.abs(lateChrome.chromeTop - lateChrome.afterHeight) <= 1, lateChrome);
    ok('ក្រោយ navbar ប្តូរកម្ពស់យឺត ➜ content នៅតែចាប់ផ្តើមក្រោម navbar',
        !lateChrome.missing && lateChrome.contentTop >= lateChrome.navbarBottom + 7, lateChrome);

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
    const longPullNormal = await page.evaluate(() => {
        const side = document.getElementById('dataSideSection');
        const pages = document.getElementById('appPages');
        return !!side && !side.classList.contains('collapsed') && !pages.classList.contains('history-expanded');
    });
    ok('លក្ខខណ្ឌតេស្ត long pull៖ ប្រវត្តិនៅរបៀបធម្មតា ដែលអនុញ្ញាត PTR', longPullNormal, longPullNormal);
    const preTop = await page.evaluate(() => {
        const tr = document.getElementById('tableResponsive');
        const pages = document.getElementById('appPages');
        const root = document.scrollingElement || document.documentElement;
        return { tr: tr ? tr.scrollTop : -1, pages: pages ? pages.scrollTop : -1, root: root ? root.scrollTop : -1 };
    });
    ok('មុនទាញ គ្រប់ scroller នៅកំពូល (លក្ខខណ្ឌចាំបាច់)', preTop.tr === 0 && preTop.pages === 0 && preTop.root === 0, preTop);
    const loadsBefore = await page.evaluate(() => parseInt(sessionStorage.getItem('__loads') || '0', 10));
    await page.evaluate(() => {
        sessionStorage.setItem('__simulate_ptr_restore', '1');
        sessionStorage.setItem('__panel_changed_during_ptr', '0');
        const side = document.getElementById('dataSideSection');
        if (!side) return;
        new MutationObserver(() => {
            sessionStorage.setItem('__panel_changed_during_ptr', '1');
        }).observe(side, { attributes: true, attributeFilter: ['class'] });
    });
    allowReload = true;
    delayReloadCommit = true;
    try {
        await runGesture({ selector: '#historyTableBody .close-btn', x: 200, startY: 220,
            points: [{ y: 250 }, { y: 360, dx: 80 }, { y: 400, dx: 100 }],
            endY: 445, endDx: 160, postEndPull: true });
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
    ok('ចាប់អ័ក្សបញ្ឈរ រួច drift ទ្រេត និងលើកនៅ ≥213px ➜ indicator/commit កេះ refresh ស្របគ្នា',
        loadsAfter === loadsBefore + 1, { loadsBefore, loadsAfter });

    await page.waitForFunction(() => !!window.__ptrRestoredScroll, null, { timeout: 5000 }).catch(() => {});
    await page.waitForFunction(() => document.querySelectorAll('#historyTableBody tr').length > 5, null, { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(760);
    const postRefresh = await page.evaluate((capturedErrors) => {
        const pages = document.getElementById('appPages');
        const table = document.getElementById('tableResponsive');
        const navbar = document.querySelector('.app-navbar');
        const card = document.querySelector('#dataMainSection .history-section');
        const firstRow = document.querySelector('#historyTableBody tr');
        const head = document.querySelector('#tableResponsive thead');
        const root = document.scrollingElement || document.documentElement;
        const out = {
            injected: window.__ptrRestoredScroll,
            reloadMarkerAtBoot: window.__ptrMarkerAtReloadBoot,
            restorationMarkerAtBoot: window.__ptrRestorationMarkerAtReloadBoot,
            earlyTap: window.__ptrEarlyTap === true,
            reloadMarker: sessionStorage.getItem('zoew_ptr_reload_pending'),
            restorationMarker: sessionStorage.getItem('zoew_ptr_scroll_restoration'),
            panelChangedDuringPull: sessionStorage.getItem('__panel_changed_during_ptr'),
            rowCount: document.querySelectorAll('#historyTableBody tr').length,
            readyState: document.readyState,
            pageErrors: capturedErrors,
            root: root ? root.scrollTop : -1,
            windowY: window.scrollY,
            pages: pages ? pages.scrollTop : -1,
            table: table ? table.scrollTop : -1,
            navbarBottom: navbar ? navbar.getBoundingClientRect().bottom : -1,
            cardTop: card ? card.getBoundingClientRect().top : -1,
            rowTop: firstRow ? firstRow.getBoundingClientRect().top : -1,
            headBottom: head ? head.getBoundingClientRect().bottom : -1,
            restoration: 'scrollRestoration' in history ? history.scrollRestoration : 'unsupported'
        };
        sessionStorage.removeItem('__simulate_ptr_restore');
        sessionStorage.removeItem('__panel_changed_during_ptr');
        return out;
    }, pageErrors.slice());
    ok('ក្រោយ PTR reload ➜ ទិន្នន័យប្រវត្តិបានផ្ទុកឡើងវិញ', postRefresh.rowCount > 5, postRefresh);
    ok('reload response យឺត >5s ➜ watchdog មិនលុប recovery markers មុនទំព័រថ្មី boot',
        postRefresh.reloadMarkerAtBoot === '1' &&
        (postRefresh.restorationMarkerAtBoot === 'auto' || postRefresh.restorationMarkerAtBoot === 'manual'),
        postRefresh);
    ok('តេស្តបានចាក់ offset ស្ដារក្រោយ reload ពិត (មិនមែនតេស្តទទេ)',
        !!postRefresh.injected && Math.max(postRefresh.injected.root, postRefresh.injected.pages, postRefresh.injected.table) > 0, postRefresh);
    ok('ក្រោយ PTR reload ➜ root, appPages និងតារាងត្រឡប់ទៅ scrollTop 0 ទាំងអស់',
        Math.abs(postRefresh.root) <= 1 && Math.abs(postRefresh.windowY) <= 1 &&
        Math.abs(postRefresh.pages) <= 1 && Math.abs(postRefresh.table) <= 1, postRefresh);
    ok('ក្រោយ PTR reload ➜ កាតប្រវត្តិនៅក្រោម navbar មិនរអិលឡើងពីក្រោយវា',
        postRefresh.cardTop >= postRefresh.navbarBottom + 8, postRefresh);
    ok('ក្រោយ PTR reload ➜ ជួរដំបូងមិនត្រូវ scroll សល់លាក់ក្រោយ sticky header',
        postRefresh.rowTop >= postRefresh.headBottom - 1, postRefresh);
    ok('settle ចប់ ➜ ស្ដារ scroll restoration ទៅរបៀប auto', postRefresh.restoration === 'auto', postRefresh);
    ok('tap ធម្មតា 100ms ក្រោយ reload ➜ មិនលុប settle timers', postRefresh.earlyTap === true, postRefresh);
    ok('settle បញ្ចប់ ➜ សម្អាត reload marker', postRefresh.reloadMarker === null, postRefresh);
    ok('settle បញ្ចប់ ➜ សម្អាត restoration marker', postRefresh.restorationMarker === null, postRefresh);
    ok('long PTR និង touch ថ្មីមុន navigation ➜ ស្ថានភាពផ្ទាំងខាងលើមិនប្តូរប្រជែង', postRefresh.panelChangedDuringPull === '0', postRefresh);
    ok('គ្មាន JavaScript page error ក្នុង regression ទាំងមូល', postRefresh.pageErrors.length === 0, postRefresh.pageErrors);


    // លើកុំព្យូទ័រ មិនត្រូវលាក់ទេ
    await ctx.close();
    const wideCtx = await browser.newContext({ viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' });
    const wide = await wideCtx.newPage();
    wide.on('dialog', (d) => d.accept());
    await wide.route('**', (r) => {
        const u = r.request().url();
        if (u.indexOf('/license-verify.js') !== -1) return r.fulfill({ status: 200, contentType: 'application/javascript', body: LICENSE_STUB });
        if (u.startsWith('http://127.0.0.1:' + port)) return r.continue();
        return r.abort();
    });
    await wide.addInitScript(`window.localStorage.setItem('zoew_firebase_config', ${JSON.stringify(JSON.stringify({ apiKey: 'k', databaseURL: 'https://fake-default-rtdb.firebaseio.com', projectId: 'p' }))});`);
    await wide.addInitScript('(' + BOOT.toString() + ')(' + JSON.stringify(seed(160)) + ', false);');
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
    const wideScrollPolicy = await wide.evaluate(() => {
        const html = getComputedStyle(document.documentElement);
        const body = getComputedStyle(document.body);
        const pages = getComputedStyle(document.getElementById('appPages'));
        return {
            iosClass: document.documentElement.classList.contains('ios-standalone'),
            htmlOverflowY: html.overflowY,
            bodyOverflowY: body.overflowY,
            htmlOverscrollY: html.overscrollBehaviorY,
            bodyOverscrollY: body.overscrollBehaviorY,
            pagesOverscrollY: pages.overscrollBehaviorY
        };
    });
    ok('បរិបទមិនមែន iOS standalone ➜ មិនបិទ root overscroll និងមិនដាក់ contain លើ #appPages',
        !wideScrollPolicy.iosClass && wideScrollPolicy.htmlOverscrollY !== 'none' &&
        wideScrollPolicy.bodyOverscrollY !== 'none' && wideScrollPolicy.pagesOverscrollY !== 'contain',
        wideScrollPolicy);

    await wideCtx.close();
    server.close();
    await browser.close();
    console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')' : '✅ ជោគជ័យ ' + pass));
    process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e && e.stack || e); process.exit(1); });
