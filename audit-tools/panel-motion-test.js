// ថ្នាក់កំហុស៖ **លក្ខខណ្ឌនៃចលនាផ្ទាំងប្រវត្តិ (កំណែ 2.9.0)**។
//
// ចលនា ១:១ ដំណើរការបានលុះត្រាតែ៖
//   • កាតបញ្ជី និងតារាង **ខ្ពស់ដូចគ្នា** ទាំងរបៀបធម្មតា និងពេញអេក្រង់ —
//     បើខុសគ្នា ការរំកិលនឹងបន្សល់ចន្លោះ ហើយការប្តូរ class នឹងលោត។
//     វាក៏ជាអ្វីដែលធ្វើឲ្យ **កម្ពស់កន្សោមរមូរលែងប្តូរ** ➜ ថ្នាក់កំហុស
//     «ប្តូរកម្ពស់កណ្តាល momentum» មិនអាចកើតឡើងបាន។
//   • `scroll-snap` ត្រូវឈប់ត្រឹម **scrollTop 0** មិនមែន 71 — បើភ្លេច
//     `scroll-padding-top` នោះ **PTR លែងកេះបាន** (វាទាមទារ `scrollTop <= 1`)។
//   • ចលនា FLIP មិនត្រូវបន្សល់ `transform` សេសសល់លើកាតឡើយ។
//
// ព្រមទាំងចាក់សោថាប៊ូតុងក្នុងជួរដេកសរសេរ «បញ្ជី» ហើយការកែតម្លៃកញ្ចប់
// **នៅតែមាន** ក្នុងម៉ឺនុយ (...) ខណៈការដកត្រូវផ្ទៀងផ្ទាត់តាមរបៀបស្កេន។
// ដំណើរការពេល scanHistory ធំ (ថ្ងៃមមាញឹក) — ថ្នាក់ដែល runbook រាយថាមិនទាន់មានឧបករណ៍។
// វាស់ក្នុង Chromium ពិត៖ ការ render តារាង, ការវាយក្នុងប្រអប់ស្វែងរកលេខ, និងការ repaint ពី listener។
let chromium;
try { chromium = require('playwright-core').chromium; } catch (e) { console.log('SKIP — ត្រូវការ playwright-core'); process.exit(0); }
const CHROME = process.env.PANELMOTION_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
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
const ROOT = process.env.PANELMOTION_APP_DIR || path.join(__dirname, '..');
const ORDERS = parseInt(process.env.PANELMOTION_ORDERS || '1200', 10);
// កម្រិតតាមបន្ទុក៖ ការវាស់ពិតគឺ ~120ms នៅ 1200 order ➜ ទុកចន្លោះ ~6x តែនៅតែចាប់ការថយចុះ 8x បាន
const COLD_LIMIT = Math.max(300, Math.round(ORDERS * 0.6));
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm' };
const REPORT = process.env.PERF_REPORT === '1';

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

const BOOT = function (seed) {
    const store = JSON.parse(JSON.stringify(seed));
    window.__fakeStore = store;
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
    function fire(p) { listeners.filter((l) => l.path === p).forEach((l) => { try { l.cb(snapOf(p)); } catch (e) { window.__listenerThrew = String(e && e.message); } }); }
    function fireAll() { [...new Set(listeners.map((l) => l.path))].forEach(fire); }
    window.__fireHistory = () => fire('zoew_scan_history_cod_dod');
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

function seedBig(n) {
    const t = new Date();
    const d = zoneDateKey(Date.now(), 0);
    const now = Date.now();
    const hist = {};
    let cod = 0, cnt = 0;
    for (let i = 0; i < n; i++) {
        const id = 'id_' + (now - i * 1000) + '_' + i;
        const phone = '09' + String(60000000 + i).slice(0, 8);
        const bcs = [];
        const per = (i % 3) + 1;
        for (let k = 0; k < per; k++) {
            bcs.push({ code: 'PF' + i + '_' + k, time: '10:00', cod: 5, dod: 0, locker: 'A' + (i % 40), isClosed: (i % 4 === 0), isDeducted: false, isFromDeletion: false, createdAt: now - i * 1000 });
            cod += 5; cnt++;
        }
        hist[id] = { id, phone, scanDate: d, createdAt: now - i * 1000, cod: 5 * per, dod: 0, price: 5 * per, count: per, barcode: bcs[0].code, time: '10:00', isClosed: (i % 4 === 0), barcodes: bcs };
        if (hist[id].isClosed) hist[id].closedAt = now - i * 1000;
    }
    return {
        user_roles: { 'admin-uid': 'admin' },
        zoew_scan_history_cod_dod: hist, zoew_recently_deleted_cod_dod: {},
        zoew_daily_revenue_cod_dod: { [d]: { codDollar: cod, dodDollar: 0, totalCount: cnt } },
        zoew_monthly_revenue_cod_dod: {}, zoew_daily_pickup_cod_dod: {}, zoew_scanner_lookup: {},
        zoew_barcode_registry: {}, zoew_settings: { exchange_rate: 4100 }, _dateKey: d
    };
}

// ⛔ iOS ពិតមិនផ្គូផ្គង `@supports (not (-webkit-touch-callout: none))` ទេ ➜ ការក្លែង iOS ក្នុង Chromium
// ត្រូវ **ដកប្លុកទាំងនោះចេញ** បន្ថែមលើការចាក់ប្លុក iOS បើមិនដូច្នេះ ស៊ុមក្លែងរបស់ Android (clip-path + ::before/::after
// លើកាត) កាត់កាត iOS ក្លែង ➜ «ឯកសារយោង iOS» មិនមែន iOS ទៀតទេ។
const dropAndroidOnlyCss = () => {
    let n = 0;
    const walk = (list, owner) => {
        for (let i = list.length - 1; i >= 0; i--) {
            const r = list[i];
            if (r instanceof CSSSupportsRule && /not\s*\(\s*-webkit-touch-callout/.test(r.conditionText)) { owner.deleteRule(i); n++; }
            else if (r.cssRules) walk(r.cssRules, r);
        }
    };
    for (const sh of Array.from(document.styleSheets)) { let rules; try { rules = sh.cssRules; } catch (e) { continue; } walk(rules, sh); }
    return n;
};

// អ្នកស្រាយ PNG តូច (8-bit · non-interlaced · ទម្រង់ដែល Chromium ថត) ➜ ប្រៀប pixel ផ្ទាល់ មិនមែនប្រៀបលេខ geometry
// ដែលមើលមិនឃើញថាស៊ុមត្រូវ **គូរ** ឬអត់។
function decodePng(buf) {
    const zlib = require('zlib');
    let p = 8, w = 0, h = 0, ct = 0, bd = 0; const idat = [];
    while (p < buf.length) {
        const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8), data = buf.slice(p + 8, p + 8 + len);
        if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bd = data[8]; ct = data[9]; }
        else if (type === 'IDAT') idat.push(data);
        p += 12 + len;
    }
    const bpp = ct === 6 ? 4 : ct === 2 ? 3 : 0;
    if (bd !== 8 || !bpp) throw new Error('PNG មិនគាំទ្រ ៖ bitDepth ' + bd + ' colorType ' + ct);
    const raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * bpp, px = Buffer.alloc(h * stride);
    for (let y = 0; y < h; y++) {
        const f = raw[y * (stride + 1)], src = y * (stride + 1) + 1;
        for (let x = 0; x < stride; x++) {
            const a = x >= bpp ? px[y * stride + x - bpp] : 0, b = y ? px[(y - 1) * stride + x] : 0;
            const c = (x >= bpp && y) ? px[(y - 1) * stride + x - bpp] : 0;
            let v = raw[src + x];
            if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
            else if (f === 4) { const q = a + b - c, pa = Math.abs(q - a), pb = Math.abs(q - b), pc = Math.abs(q - c); v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c); }
            px[y * stride + x] = v & 255;
        }
    }
    return { w, h, bpp, px };
}
function pngDiff(bufA, bufB, tol) {
    const A = decodePng(bufA), B = decodePng(bufB);
    if (A.w !== B.w || A.h !== B.h) return { n: Infinity, size: [A.w, A.h, B.w, B.h] };
    let n = 0, max = 0, dark = 0;
    for (let i = 0; i < A.w * A.h; i++) {
        let d = 0;
        for (let k = 0; k < 3; k++) d = Math.max(d, Math.abs(A.px[i * A.bpp + k] - B.px[i * B.bpp + k]));
        if (d > tol) n++;
        if (d > max) max = d;
        if (B.px[i * B.bpp] < 128) dark++;
    }
    return { n, max, dark, px: A.w * A.h };
}

(async () => {
    const browser = await chromium.launch({ executablePath: CHROME });
    const server = await serve(path.join(ROOT, 'ZoeW'));
    const port = server.address().port;
    const results = [];
    const ok = (n, c, d) => results.push([n, !!c, d]);

    for (const vp of [{ w: 320, h: 640 }, { w: 412, h: 780 }, { w: 768, h: 1024 }]) {
        const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, hasTouch: true, isMobile: true });
        const page = await ctx.newPage();
        page.on('dialog', (d) => d.accept());
        page.on('pageerror', (e) => ok('vp' + vp.w + ': គ្មាន pageerror', false, e.message));
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
        await page.addInitScript(`Object.defineProperty(window.navigator,'standalone',{value:true,configurable:true});`);
        await page.addInitScript(`window.localStorage.setItem('zoew_firebase_config', ${JSON.stringify(JSON.stringify({ apiKey: 'k', databaseURL: 'https://fake-default-rtdb.firebaseio.com', projectId: 'p' }))});`);
        await page.addInitScript('(' + BOOT.toString() + ')(' + JSON.stringify(seedBig(80)) + ');');
        await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForFunction(() => document.querySelectorAll('#historyTableBody tr').length > 5, null, { timeout: 30000 });
        await page.waitForTimeout(250);

        const r = await page.evaluate(async () => {
            const wait = (ms) => new Promise((x) => setTimeout(x, ms));
            const out = {};
            // ១ — ប៊ូតុងជួរដេក
            const btns = Array.from(document.querySelectorAll('#historyTableBody .btn-view-list'));
            out.rowBtnCount = btns.length;
            out.rowBtnTexts = Array.from(new Set(btns.map((b) => b.textContent.replace(/\d+/g, 'N').trim()))).slice(0, 4);
            out.anyOldLabel = btns.some((b) => b.textContent.indexOf('កែ/ដក') !== -1);
            out.anyInlineYellow = btns.some((b) => (b.getAttribute('style') || '').indexOf('fef08a') !== -1);
            // ២ — ម៉ឺនុយ (...) នៅតែមានការកែតម្លៃកញ្ចប់
            const firstId = document.querySelector('#historyTableBody tr') ? document.querySelector('#historyTableBody tr').dataset.id : null;
            if (firstId) {
                window.toggleMoreDropdown(document.querySelector('#historyTableBody .more-btn') || document.body,
                    { stopPropagation() {} }, firstId);
                out.menuHasEdit = document.getElementById('menuContentContainer').textContent.indexOf('កែតម្លៃកញ្ចប់') !== -1;
                document.getElementById('globalMoreMenu').classList.remove('show');
            }
            // ៣ — កម្ពស់កាតស្មើគ្នា + តារាងរមូរបាន
            const side = document.getElementById('dataSideSection');
            const main = document.getElementById('dataMainSection');
            const table = document.getElementById('tableResponsive');
            const pages = document.getElementById('appPages');
            const waitForPanelGlide = async () => {
                const deadline = performance.now() + 1500;
                while (pages.classList.contains('panel-gliding') && performance.now() < deadline) await wait(20);
            };
            const hN = Math.round(main.getBoundingClientRect().height), tN = table.clientHeight;
            side.classList.add('collapsed'); window.syncHistoryExpandedLock(); await wait(60);
            const hC = Math.round(main.getBoundingClientRect().height), tC = table.clientHeight;
            side.classList.remove('collapsed'); window.syncHistoryExpandedLock(); await wait(60);
            out.cardHeightDelta = Math.abs(hN - hC);
            out.tableHeightDelta = Math.abs(tN - tC);
            out.tableScrolls = table.scrollHeight > table.clientHeight + 1;
            // ៤ — snap ឈប់ត្រឹម 0 (PTR ត្រូវការ scrollTop<=1)
            pages.scrollTop = 30; await wait(350);
            out.snapRestNearTop = pages.scrollTop;
            pages.scrollTop = 0; await wait(120);
            // ៥ — គ្មាន transform សេសសល់ក្រោយចលនា
            const handle = document.getElementById('dragHandle');
            if (handle) { handle.click(); await waitForPanelGlide(); handle.click(); await waitForPanelGlide(); }
            out.residualTransform = getComputedStyle(main).transform;
            out.sideAfterToggles = side.classList.contains('collapsed');
            // ៥ខ — កន្លែងរបា Tab ត្រូវប្រគល់មកវិញ **ស្របគ្នានឹងរបា** មិនមែនពន្យារ
            // ១៨០ms ក្រោយរមូរស្ងប់ទេ។ មុនកំណែ 2.11.0 អ្នកប្រើឃើញចន្លោះទទេប្រផេះ
            // មួយភ្លែត ហើយជួរដេកចុងក្រោយត្រូវកាត់ពាក់កណ្តាល (វីដេអូពីអ្នកប្រើ)។
            // គែម **ដែលមើលឃើញ** = តូចបំផុតនៃគែមតារាង និង (គែមក្រោម − clip inset) របស់ **រាល់** ឪពុកដល់ `.page-main`
            // ⛔ មិនមែនតែ `.page-main` ទេ ៖ ស៊ុមរបស់ Android កាត់លើ **កាត** ➜ ការអានតែ `.page-main` វាស់ខុសកន្លែង ហើយបៃតងជានិច្ច។
            const visBottom = () => {
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
            };
            side.classList.add('collapsed'); window.syncHistoryExpandedLock(); await wait(80);
            document.body.classList.remove('chrome-hidden'); await wait(80);
            const visShown = visBottom();
            out.gapVisibleToBar = Math.round(
                document.getElementById('pageTabBar').getBoundingClientRect().top - visShown);
            // ⛔ ស៊ុមក្លែងគ្របជួរដេកដែលលាក់ ➜ ការចុចលើវាមិនត្រូវទៅដល់ប៊ូតុង «ខល»/«បិទ» ដែលមើលមិនឃើញ
            {
                const cardEl = table.closest('.app-card');
                const cr = cardEl.getBoundingClientRect();
                const cx = Math.round((cr.left + cr.right) / 2);
                const inBand = document.elementFromPoint(cx, visShown - 4);
                const inRows = document.elementFromPoint(cx, visShown - 36);
                const inGap = document.elementFromPoint(cx, visShown + 3);
                out.bandHit = inBand === cardEl ? 'card' : (inBand && table.contains(inBand) ? 'row' : String(inBand && inBand.className));
                out.rowsHit = !!(inRows && table.contains(inRows));
                out.gapHit = inGap && cardEl.contains(inGap) ? 'card' : 'outside';
            }
            const hShown = table.clientHeight;
            document.body.classList.add('chrome-hidden');
            await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
            out.visReleasedImmediately = visBottom() - visShown;
            out.heightStableOnHide = table.clientHeight === hShown;
            document.body.classList.remove('chrome-hidden');
            side.classList.remove('collapsed'); window.syncHistoryExpandedLock(); await wait(80);

            // ៦ — ទំព័រ ២ ដូចគ្នា
            window.switchAppPage('entry'); await wait(150);
            const em = document.getElementById('entryMainSection');
            out.entryCardH = Math.round(em.getBoundingClientRect().height);
            out.entryPagesOverflow = getComputedStyle(pages).overflowY;
            window.switchAppPage('data'); await wait(100);
            // ៧ — គ្មានការហូរផ្តេក
            out.hOverflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
            return out;
        });
        // ៨ — ⛔ ការហូតប្រអប់ប្រវត្តិមិនត្រូវ **relayout ទំព័រទាំងមូល**។ វាស់បាន (trace ពិត · ២៦០ ជួរ · CPU ពិត) ៖
        // `.app-pages.history-expanded` ប្តូរ `display` block ➜ flex ➜ browser បង្កើត layout tree ឡើងវិញ
        // (dirtyObjects ១៦,៧៩២ / ១៦,៨៧៨ ➜ Layout ៤៣៧–៦៤៦ms រាល់ការហូត · ទូរស័ព្ទយឺតជាងនេះ ២–៥ ដង) ខណៈ
        // ពេល `display` មិនប្រែ ➜ dirtyObjects ៦ · Layout ១–២ms។ ⛔ រង្វាស់ជា **សមាមាត្រ object ដែល dirty**
        // (កំណត់ដោយរចនាសម្ព័ន្ធ មិនអាស្រ័យលើល្បឿនម៉ាស៊ីន) មិនមែនមិល្លីវិនាទី។
        await browser.startTracing(page, { categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline'] });
        await page.evaluate(async () => {
            const wait = (ms) => new Promise((x) => setTimeout(x, ms));
            const handle = document.getElementById('dragHandle');
            if (!handle) return;
            handle.click(); await wait(500);
            handle.click(); await wait(500);
        });
        const traceEvents = JSON.parse((await browser.stopTracing()).toString()).traceEvents || [];
        const layouts = traceEvents.filter((e) => e.name === 'Layout' && e.args && e.args.beginData
            && typeof e.args.beginData.dirtyObjects === 'number' && e.args.beginData.totalObjects > 0);
        const worst = layouts.reduce((m, e) => Math.max(m, e.args.beginData.dirtyObjects / e.args.beginData.totalObjects), 0);
        const totalObjects = layouts.reduce((m, e) => Math.max(m, e.args.beginData.totalObjects), 0);
        r.toggleLayouts = layouts.length;
        r.toggleWorstDirty = worst;
        r.toggleTotalObjects = totalObjects;
        const tag = vp.w + 'px';
        ok(tag + ': ជាន់អប្បបរមា ៖ trace ឃើញ Layout ពេលហូត លើទំព័រ > ១០០០ object', layouts.length > 0 && totalObjects > 1000,
            'layouts=' + layouts.length + ' objects=' + totalObjects);
        ok(tag + ': ⛔ ហូតប្រអប់ប្រវត្តិមិន relayout ទំព័រទាំងមូល (object dirty < ៥០%)', layouts.length > 0 && worst < 0.5,
            'dirty=' + Math.round(worst * 1000) / 10 + '% នៃ ' + totalObjects);
        ok(tag + ': ប៊ូតុងជួរដេកលែងមាន «កែ/ដក»', r.anyOldLabel === false, JSON.stringify(r.rowBtnTexts));
        ok(tag + ': លែងមានពណ៌លឿង inline', r.anyInlineYellow === false, '');
        ok(tag + ': ម៉ឺនុយ (...) នៅមានការកែតម្លៃកញ្ចប់', r.menuHasEdit === true, String(r.menuHasEdit));
        ok(tag + ': កម្ពស់កាតស្មើគ្នា ២ របៀប (≤2px)', r.cardHeightDelta <= 2, 'delta=' + r.cardHeightDelta);
        ok(tag + ': កម្ពស់តារាងស្មើគ្នា ២ របៀប (≤2px)', r.tableHeightDelta <= 2, 'delta=' + r.tableHeightDelta);
        ok(tag + ': តារាងនៅតែរមូរបាន', r.tableScrolls === true, '');
        ok(tag + ': snap ឈប់ត្រឹម 0 (PTR កេះបាន)', r.snapRestNearTop <= 1, 'scrollTop=' + r.snapRestNearTop);
        ok(tag + ': គ្មាន transform សេសសល់ក្រោយចលនា', r.residualTransform === 'none' || r.residualTransform === 'matrix(1, 0, 0, 1, 0, 0)', r.residualTransform);
        ok(tag + ': ចុចដងអូស ២ ដង ➜ ត្រឡប់ដើម', r.sideAfterToggles === false, String(r.sideAfterToggles));
        // ⛔ ២ ខាង ៖ មិនលិចក្រោមរបា (≥ 6) · មិនមែនចន្លោះក្រាស់ (≤ 10) ➜ កាតឈប់ខាងលើរបា **៨px ដូច iOS** ហើយ
        // ស៊ុមក្រោមកាតត្រូវគូរ (ការប្រៀប pixel ជាមួយ iOS ខាងក្រោម)។ អ្នកប្រើរាយការណ៍ (រូបថត iPhone ធៀប Android) ៖ ការកាត់
        // ចំគែមរបា (gap ≈ 0) ធ្វើឲ្យជួរដេករត់ចូលក្រោមរបា ហើយគែមក្រោម/ជ្រុងមូលរបស់កាតមិនដែលលេច។
        ok(tag + ': កាតដែលមើលឃើញឈប់ខាងលើរបា Tab ៨px ដូច iOS (6–10px)',
            r.gapVisibleToBar >= 6 && r.gapVisibleToBar <= 10, 'gap=' + r.gapVisibleToBar + 'px');
        ok(tag + ': ចុចលើស៊ុមក្រោមកាត ➜ ទៅកាត មិនមែនជួរដេកដែលលាក់', r.bandHit === 'card', 'hit=' + r.bandHit);
        ok(tag + ': ជួរដេកខាងលើស៊ុមនៅតែចុចបាន', r.rowsHit === true, String(r.rowsHit));
        ok(tag + ': ចន្លោះរវាងកាត និងរបា មិនមែនកាត (clip កាត់ការចុចដែរ)', r.gapHit === 'outside', 'hit=' + r.gapHit);
        ok(tag + ': កន្លែងរបា Tab ប្រគល់មកវិញក្នុង ២ ស៊ុម (ស្របនឹងរបា មិនពន្យារ)',
            r.visReleasedImmediately >= 20, 'delta=' + r.visReleasedImmediately + 'px');
        ok(tag + ': ការលាក់របាមិនប្តូរកម្ពស់កន្សោមរមូរ', r.heightStableOnHide === true, String(r.heightStableOnHide));
        ok(tag + ': ទំព័រ ២ កាតមានកម្ពស់ត្រឹមត្រូវ', r.entryCardH > 100, 'h=' + r.entryCardH);
        ok(tag + ': គ្មានការហូរផ្តេក', r.hOverflow <= 0, 'overflow=' + r.hOverflow);

        // ៩ — ⛔ ស៊ុមក្រោមកាតលើ Android ត្រូវ **ដូច iOS pixel ទល់ pixel** (សំណើអ្នកប្រើ ៖ «iOS រក្សាកម្លាត ស៊ុមស្អាត តែ
        // Android …»)។ ផ្លូវ Android រក្សាកម្ពស់កន្សោមរមូរថេរ (clip-path) ➜ គែមតារាង · កម្លាតកាត · គែមកាត · ជ្រុងមូល ត្រូវ
        // **គូរក្លែង** ➜ ការវាស់ geometry មិនឃើញថាវាត្រូវគូរឬអត់ ➜ ប្រៀបរូបថតតំបន់ក្រោមកាតនៃផ្លូវទាំង ២ លើស្ថានភាពដដែល។
        // ⛔ សេណារីយ៉ូ ៥ ៖ តារាងប្រវត្តិរមូរកណ្តាល · បញ្ជីទំព័រស្កេន · បញ្ជីទំព័រស្កេន **ទទេ** (សារ «មិនទាន់មាន…» ជាកូនចុងក្រោយ
        // របស់កាត មិនមែនតារាង ➜ ផ្លូវ Android ធ្លាប់រុញវាលិចក្រោមរបា Tab ទាំងស្រុង) · និងទាំង ២ ពេល **ផ្ទាំងខាងលើបើក** (`-open` ៖ កាត
        // មានកម្ពស់តាមមាតិកា ➜ ស៊ុមត្រូវឈរចុងមាតិកា មិនមែនចំរបា)។ ⛔ ប្រអប់ថតជារបស់ **Android** ហើយប្រើដដែលលើ iOS ➜ ការឃ្លាតទីតាំង
        // ក៏ជា pixel ខុសដែរ។ ⛔ ពិដាន ២០ (មិនមែន ៤៨) ៖ គែម `--border-color` ខុសពីពណ៌ស **២៩** ➜ ពិដានធំជាងនេះមើលមិនឃើញគែមដែលបាត់
        // (វាស់បាន ៖ mutation «ដកគែមកាត» រស់រានលើពិដាន ៤៨)។ ប្រអប់ឈប់ **ត្រឹមគែមកាត** ៖ ស្រមោល `--shadow-sm` ក្រោមកាត iOS (ខុស ≤ ១៨)
        // ស្ថិតក្នុងចន្លោះ ៨px ដែល clip របស់ Android កាត់ចោល ➜ ចន្លោះនោះវាស់ដោយ gap (6–10px) និងទីតាំង `vis` ជំនួសវិញ។
        const SCENES = ['data', 'entry', 'entry-empty', 'entry-open', 'entry-empty-open'];
        const band = async (scene, fixedBox) => page.evaluate(async ({ scene, fixedBox }) => {
            const wait = (ms) => new Promise((x) => setTimeout(x, ms));
            const entry = scene !== 'data';
            const open = /-open$/.test(scene);
            window.switchAppPage(entry ? 'entry' : 'data'); await wait(80);
            document.getElementById(entry ? 'entrySideSection' : 'dataSideSection').classList.toggle('collapsed', !open);
            window.syncHistoryExpandedLock();
            document.body.classList.remove('chrome-hidden');
            if (entry) {
                const q = document.getElementById('entryListSearchInput');
                q.value = /empty/.test(scene) ? 'zz-no-such-row' : '';
                q.dispatchEvent(new Event('input', { bubbles: true }));
                await wait(150);
            }
            const pages = document.getElementById('appPages');
            pages.scrollTop = open ? pages.scrollHeight : 0;
            const t = document.getElementById(entry ? 'entryTableResponsive' : 'tableResponsive');
            t.scrollTop = entry ? 0 : 160;
            await wait(400);
            const cardEl = t.closest('.app-card');
            const card = cardEl.getBoundingClientRect();
            let vis = card.bottom;
            for (let el = cardEl; el; el = el.parentElement) {
                const m = /inset\(([^)]*)\)/.exec(getComputedStyle(el).clipPath || '');
                if (m) {
                    const tk = m[1].split('round')[0].trim().split(/\s+/);
                    vis = Math.min(vis, el.getBoundingClientRect().bottom - (parseFloat(tk.length >= 3 ? tk[2] : tk[0]) || 0));
                }
                if (el.classList.contains('page-main')) break;
            }
            vis = Math.min(vis, document.getElementById('pageTabBar').getBoundingClientRect().top);
            const empty = cardEl.querySelector(':scope > .empty-state');
            return { box: fixedBox || { x: Math.ceil(card.left), y: Math.round(vis) - 110, width: Math.floor(card.right) - Math.ceil(card.left), height: 110 },
                     vis: Math.round(vis), scrollTop: t.scrollTop, pagesTop: pages.scrollTop, cardClip: getComputedStyle(cardEl).clipPath,
                     after: getComputedStyle(cardEl, '::after').content,
                     emptyShown: !!(empty && empty.offsetParent) };
        }, { scene, fixedBox });
        await page.addStyleTag({ content: '*, *::before, *::after { animation: none !important; transition: none !important; } .toast-container { display: none !important; }' });
        const shots = { android: {}, ios: {} };
        for (const scene of SCENES) {
            const b = await band(scene, null);
            shots.android[scene] = { b, png: await page.screenshot({ clip: b.box }) };
        }
        const iosCss = fs.readFileSync(path.join(ROOT, 'ZoeW', 'style.css'), 'utf8');
        const iosAt = iosCss.indexOf('@supports (-webkit-touch-callout: none) {');
        let iosDepth = 0, iosStart = iosCss.indexOf('{', iosAt), iosEnd = iosStart;
        for (let k = iosStart; iosAt !== -1 && k < iosCss.length; k++) {
            if (iosCss[k] === '{') iosDepth++;
            else if (iosCss[k] === '}') { iosDepth--; if (!iosDepth) { iosEnd = k; break; } }
        }
        if (iosAt !== -1) await page.addStyleTag({ content: iosCss.slice(iosStart + 1, iosEnd) });
        await page.evaluate(dropAndroidOnlyCss);
        for (const scene of SCENES) {
            const b = await band(scene, shots.android[scene].b.box);
            shots.ios[scene] = { b, png: await page.screenshot({ clip: b.box }) };
        }
        for (const scene of SCENES) {
            const A = shots.android[scene], I = shots.ios[scene];
            const d = pngDiff(A.png, I.png, 20);
            if (process.env.PANELMOTION_SHOT_DIR) {
                fs.mkdirSync(process.env.PANELMOTION_SHOT_DIR, { recursive: true });
                fs.writeFileSync(path.join(process.env.PANELMOTION_SHOT_DIR, tag + '-' + scene + '-android.png'), A.png);
                fs.writeFileSync(path.join(process.env.PANELMOTION_SHOT_DIR, tag + '-' + scene + '-ios.png'), I.png);
            }
            console.log('    ' + tag + ' ' + scene + ' ៖ គែមមើលឃើញ Android ' + A.b.vis + ' · iOS ' + I.b.vis + ' · pixel ខុស ' + d.n + '/' + d.px + ' (max ' + d.max + ')');
            ok(tag + ' ' + scene + ': ការក្លែង iOS គ្មានស៊ុមក្លែងរបស់ Android (clip · ::after)',
                I.b.cardClip === 'none' && I.b.after === 'none', JSON.stringify(I.b));
            ok(tag + ' ' + scene + ': ជាន់អប្បបរមា ៖ តំបន់ប្រៀបមានមាតិកាពិត · ស្ថានភាពដដែលទាំង ២ ផ្លូវ',
                d.dark > 50 && A.b.scrollTop === I.b.scrollTop && A.b.pagesTop === I.b.pagesTop &&
                A.b.emptyShown === I.b.emptyShown && A.b.emptyShown === /empty/.test(scene),
                'dark=' + d.dark + ' scroll=' + A.b.scrollTop + '/' + I.b.scrollTop + ' pages=' + A.b.pagesTop + '/' + I.b.pagesTop +
                ' empty=' + A.b.emptyShown + '/' + I.b.emptyShown);
            ok(tag + ' ' + scene + ': ⛔ ស៊ុមក្រោមកាត Android ដូច iOS (ទីតាំង ±1 · pixel ខុស ≤ ១២)',
                Math.abs(A.b.vis - I.b.vis) <= 1 && d.n <= 12,
                'vis=' + A.b.vis + '/' + I.b.vis + ' n=' + d.n + ' max=' + d.max + ' box=' + JSON.stringify(A.b.box));
        }
        await ctx.close();
    }
    // ---- ផ្លូវ iOS ដាច់ដោយឡែក ----
    // Chromium មិនអាចផ្គូផ្គង `@supports (-webkit-touch-callout: none)` បានទេ
    // (វាត្រឡប់ false) ➜ ច្បាប់ក្នុងនោះ **មិនដែលត្រូវសាកសោះ** បើមិនចាក់វាដោយដៃ។
    // ផ្លូវ iOS មិនប្រើ `clip-path` ទេ — កាតមានកម្ពស់ពិត ហើយ **រីកចុះមកបំពេញ**
    // កន្លែងរបា។ បើផ្នែកនេះខូច អ្នកប្រើ iPhone ឃើញកាត «លែងធ្លាក់»។
    {
        const cssSrc = fs.readFileSync(path.join(ROOT, 'ZoeW', 'style.css'), 'utf8');
        const at = cssSrc.indexOf('@supports (-webkit-touch-callout: none) {');
        const ctx2 = await browser.newContext({ viewport: { width: 412, height: 780 } });
        const page2 = await ctx2.newPage();
        page2.on('dialog', (d) => d.accept());
        await page2.route('**', (r) => {
            const u = r.request().url();
            if (u.indexOf('/license-verify.js') !== -1) return r.fulfill({ status: 200, contentType: 'application/javascript', body: LICENSE_STUB });
            if (u.startsWith('http://127.0.0.1:' + port)) return r.continue();
            return r.abort();
        });
        await page2.addInitScript(`window.localStorage.setItem('zoew_firebase_config', ${JSON.stringify(JSON.stringify({ apiKey: 'k', databaseURL: 'https://fake-default-rtdb.firebaseio.com', projectId: 'p' }))});`);
        await page2.addInitScript('(' + BOOT.toString() + ')(' + JSON.stringify(seedBig(120)) + ');');
        await page2.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page2.waitForFunction(() => document.querySelectorAll('#historyTableBody tr').length > 5, null, { timeout: 30000 });
        await page2.waitForTimeout(250);

        ok('iOS: style.css មានប្លុក @supports (-webkit-touch-callout: none)', at !== -1);
        if (at !== -1) {
            let depth = 0, start = cssSrc.indexOf('{', at), end = start;
            for (let k = start; k < cssSrc.length; k++) {
                if (cssSrc[k] === '{') depth++;
                else if (cssSrc[k] === '}') { depth--; if (!depth) { end = k; break; } }
            }
            await page2.addStyleTag({ content: cssSrc.slice(start + 1, end) });
            await page2.evaluate(dropAndroidOnlyCss);
            await page2.waitForTimeout(200);
            const r2 = await page2.evaluate(async () => {
                const wait = (ms) => new Promise((x) => setTimeout(x, ms));
                const main = document.getElementById('dataMainSection');
                const table = document.getElementById('tableResponsive');
                document.getElementById('dataSideSection').classList.add('collapsed');
                window.syncHistoryExpandedLock();
                await wait(150);
                document.body.classList.remove('chrome-hidden');
                await wait(120);
                const shown = { cardH: Math.round(main.getBoundingClientRect().height),
                                cardBottom: Math.round(main.getBoundingClientRect().bottom),
                                tableBottom: Math.round(table.getBoundingClientRect().bottom),
                                barTop: Math.round(document.getElementById('pageTabBar').getBoundingClientRect().top),
                                clip: getComputedStyle(main).clipPath };
                document.body.classList.add('chrome-hidden');
                await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
                const hidden = { cardH: Math.round(main.getBoundingClientRect().height),
                                 cardBottom: Math.round(main.getBoundingClientRect().bottom),
                                 tableBottom: Math.round(table.getBoundingClientRect().bottom) };
                document.body.classList.remove('chrome-hidden');
                return { shown, hidden, viewportH: window.innerHeight };
            });
            ok('iOS: មិនប្រើ clip-path (Safari មិនអាចពឹងលើវាបាន)',
                r2.shown.clip === 'none', r2.shown.clip);
            ok('iOS: គែមក្រោមកាតឈរខាងលើរបា Tab ពេលរបាឲ្យឃើញ',
                r2.shown.cardBottom <= r2.shown.barTop + 1, r2.shown);
            ok('iOS: លាក់របា ➜ កាត **រីកចុះពិត** មកបំពេញកន្លែងរបា (ក្នុង ២ ស៊ុម)',
                r2.hidden.cardH - r2.shown.cardH >= 20, 'delta=' + (r2.hidden.cardH - r2.shown.cardH) + 'px');
            ok('iOS: លាក់របា ➜ គែមក្រោមកាតចុះជិតបាតអេក្រង់ (គ្មានចន្លោះទទេ)',
                r2.viewportH - r2.hidden.cardBottom >= 0 && r2.viewportH - r2.hidden.cardBottom <= 16,
                { bottom: r2.hidden.cardBottom, viewportH: r2.viewportH });
        }
        await ctx2.close();
    }

    server.close(); await browser.close();
    let bad = 0;
    results.forEach(([n, c, d]) => { if (!c) bad++; console.log((c ? '  ok    ' : '  FAIL  ') + n + (c ? '' : '   [' + d + ']')); });
    console.log(bad ? '\n❌ ធ្លាក់ ' + bad : '\n✅ ជោគជ័យ ' + results.length + '/' + results.length);
    process.exit(bad ? 1 : 0);
})();
