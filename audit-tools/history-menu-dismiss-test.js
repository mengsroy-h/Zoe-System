// សាកកូដ App ពិតក្នុង Chromium៖ ម៉ឺនុយប្រវត្តិត្រូវបិទពេលចាប់ផ្តើមអូសខាងក្រៅ។
const fs = require('fs'), http = require('http'), path = require('path');
const ROOT = process.env.HISTORYMENU_APP_DIR || path.join(__dirname, '..');
for (const file of ['index.html', 'app.js', 'style.css']) {
    if (!fs.existsSync(path.join(ROOT, 'ZoeW', file))) {
        console.error('FAIL — បាត់ឯកសារ App: ' + file);
        process.exit(1);
    }
}
let chromium;
try { chromium = require('playwright-core').chromium; } catch (e) { console.log('SKIP — ត្រូវការ playwright-core'); process.exit(0); }
const CHROME = process.env.HISTORYMENU_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

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

async function settle(page) {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

(async () => {
    let browser;
    let server;
    try {
        server = await serve(path.join(ROOT, 'ZoeW'));
        const origin = 'http://127.0.0.1:' + server.address().port;
        browser = await chromium.launch({ executablePath: CHROME });
        for (const mobile of [true, false]) {
            const mode = mobile ? 'Mobile touch' : 'Desktop';
            console.log('\n=== ' + mode + ' — ម៉ឺនុយប្រវត្តិ ===');
            const context = await browser.newContext({ viewport: { width: mobile ? 412 : 1280, height: mobile ? 780 : 900 }, hasTouch: mobile, isMobile: mobile });
            const page = await context.newPage();
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.addInitScript(() => window.addEventListener('unhandledrejection', event => {
                const message = String(event.reason && (event.reason.message || event.reason) || 'unknown');
                setTimeout(() => { throw new Error('unhandledrejection: ' + message); }, 0);
            }));
            await page.route('**', route => {
                const url = route.request().url();
                if (url.includes('/license-verify.js')) return route.fulfill({ status: 200, contentType: 'application/javascript', body: LICENSE_STUB });
                return url.startsWith(origin) ? route.continue() : route.abort();
            });
            await page.addInitScript(() => localStorage.setItem('zoew_firebase_config', JSON.stringify({ apiKey: 'k', databaseURL: 'https://fake-default-rtdb.firebaseio.com', projectId: 'p' })));
            await page.addInitScript('(' + BOOT.toString() + ')(' + JSON.stringify(seedBig(20)) + ',false);');
            await page.goto(origin, { waitUntil: 'load' });
            await page.waitForFunction(() => document.querySelectorAll('#historyTableBody tr').length > 5);
            await page.waitForFunction(() => !document.body.classList.contains('app-locked'));
            await settle(page);
            const menu = page.locator('#globalMoreMenu');
            const visible = () => menu.evaluate(el => el.classList.contains('show'));
            const cdp = mobile ? await context.newCDPSession(page) : null;
            for (const [kind, selector] of [['header', '.header-more-btn'], ['row', '#historyTableBody .more-btn']]) {
                const trigger = page.locator(selector).first();
                if (mobile) await trigger.tap(); else await trigger.click();
                check(await visible(), kind + ': ចុច (…) ➜ ម៉ឺនុយបើក');
                if (mobile) {
                    const triggerBox = await trigger.boundingBox();
                    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: triggerBox.x + triggerBox.width / 2, y: triggerBox.y + triggerBox.height / 2 }] });
                    check(!await visible(), kind + ': ចាប់អូសលើប៊ូតុង (…) ផ្ទាល់ ➜ បិទម៉ឺនុយចាស់');
                    await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
                    await trigger.tap();
                    check(await visible(), kind + ': ចុចប៊ូតុងម្ដងទៀត ➜ ម៉ឺនុយបើកបាន');
                    const rect = await page.locator('#dragHandle').boundingBox();
                    const mainRect = await page.locator('#dataMainSection').boundingBox();
                    const x = mainRect.x + 16;
                    const y = rect.y + rect.height / 2;
                    check(await page.evaluate(({ x, y }) => {
                        const target = document.elementFromPoint(x, y);
                        return document.getElementById('dataMainSection').contains(target) && !target.closest('#globalMoreMenu');
                    }, { x, y }), kind + ': ម្រាមដៃចាប់លើផ្ទាំងប្រវត្តិខាងក្រៅម៉ឺនុយពិត');
                    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
                    check(!await visible(), kind + ': ចាប់ផ្តើមអូសក្រៅម៉ឺនុយ ➜ បិទភ្លាម');
                    for (const dy of [10, 25, 45, 65]) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - dy }] });
                    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
                    await settle(page);
                    check(!await visible(), kind + ': ក្រោយអូសប្រវត្តិឡើង ➜ គ្មានម៉ឺនុយអណ្តែត');
                } else {
                    const table = page.locator('#tableResponsive');
                    const before = await table.evaluate(el => el.scrollTop);
                    const bounds = await table.boundingBox();
                    await page.mouse.move(bounds.x + 20, bounds.y + 80);
                    await page.mouse.wheel(0, 200);
                    await page.waitForFunction(top => document.getElementById('tableResponsive').scrollTop !== top, before);
                    await settle(page);
                    check(!await visible(), kind + ': រមូរតារាងខាងក្នុង ➜ បិទម៉ឺនុយ');
                }
                await page.evaluate(() => {
                    closeGlobalMoreMenu();
                    document.getElementById('dataSideSection').classList.remove('collapsed');
                    syncHistoryExpandedLock();
                    document.getElementById('appPages').scrollTop = 0;
                    document.getElementById('tableResponsive').scrollTop = 0;
                });
                await settle(page);
            }

            if (mobile) {
                await page.locator('.header-more-btn').first().tap();
                const moved = await page.evaluate(() => {
                    const target = document.getElementById('dataMainSection');
                    const pointer = new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch', pointerId: 71, clientX: 24, clientY: 400 });
                    target.dispatchEvent(pointer);
                    const touch = y => new Touch({ identifier: 71, target, clientX: 24, clientY: y });
                    const dispatch = (type, y, ended) => {
                        const point = touch(y);
                        target.dispatchEvent(new TouchEvent(type, { bubbles: true, cancelable: true, touches: ended ? [] : [point], changedTouches: [point], targetTouches: ended ? [] : [point] }));
                    };
                    dispatch('touchstart', 400, false);
                    dispatch('touchmove', 330, false);
                    dispatch('touchend', 330, true);
                    return {
                        collapsed: document.getElementById('dataSideSection').classList.contains('collapsed'),
                        menuOpen: document.getElementById('globalMoreMenu').classList.contains('show')
                    };
                });
                check(moved.collapsed, 'ផ្លូវ touch handler ពិត ➜ ផ្ទាំងប្រវត្តិបង្រួមដោយ transform');
                check(!moved.menuOpen, 'ចលនា transform ដែលមិនទាន់មាន native scroll ➜ ម៉ឺនុយបិទ');
                await page.evaluate(() => {
                    closeGlobalMoreMenu();
                    document.getElementById('dataSideSection').classList.remove('collapsed');
                    syncHistoryExpandedLock();
                });
                await settle(page);
            }

            const header = page.locator('.header-more-btn').first();
            if (mobile) await header.tap(); else await header.click();
            const action = page.locator('#globalMoreMenu [data-act="moreMenuExchangeRate"]');
            const actionBox = await action.boundingBox();
            if (mobile) {
                await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: actionBox.x + 20, y: actionBox.y + actionBox.height / 2 }] });
                check(await visible(), 'ចាប់ផ្តើមចុចក្នុងម៉ឺនុយ ➜ រក្សាម៉ឺនុយដើម្បីប្រើប៊ូតុង');
                await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
            } else await action.click();
            await page.waitForFunction(() => document.getElementById('exchangeRateModal').style.display === 'flex');
            check(!await visible(), 'ប៊ូតុងម៉ឺនុយដំណើរការពិត ហើយបិទម៉ឺនុយ');
            await page.evaluate(() => closeModal('exchangeRateModal'));

            if (mobile) await header.tap(); else await header.click();
            const menuScrollTop = await page.evaluate(() => {
                const menu = document.getElementById('globalMoreMenu');
                menu.style.maxHeight = '100px';
                menu.style.overflowY = 'auto';
                menu.scrollTop = 50;
                return menu.scrollTop;
            });
            await settle(page);
            check(menuScrollTop > 0, 'តេស្តបានរមូរខាងក្នុងម៉ឺនុយពិត', menuScrollTop);
            check(await visible(), 'រមូរខាងក្នុងម៉ឺនុយ ➜ ម៉ឺនុយនៅបើក');
            await page.evaluate(() => {
                const menu = document.getElementById('globalMoreMenu');
                menu.style.maxHeight = '';
                menu.style.overflowY = '';
                closeGlobalMoreMenu();
            });
            if (mobile) await header.tap(); else await header.click();
            await page.setViewportSize({ width: mobile ? 430 : 1300, height: mobile ? 790 : 910 });
            await page.waitForFunction(() => !document.getElementById('globalMoreMenu').classList.contains('show'));
            check(!await visible(), 'ប្តូរទំហំអេក្រង់ ➜ បិទម៉ឺនុយ');
            check(errors.length === 0, 'គ្មានកំហុស runtime', JSON.stringify(errors));
            await context.close();
        }
    } catch (error) {
        check(false, 'តេស្តដំណើរការដល់ចប់', error.stack);
    } finally {
        if (browser) await browser.close();
        if (server) await new Promise(resolve => server.close(resolve));
    }
    console.log('\n' + (fail ? 'FAIL ' : 'PASS ') + pass + '/' + (pass + fail));
    process.exitCode = fail ? 1 : 0;
})();
