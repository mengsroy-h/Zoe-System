// ⛔ ថ្នាក់កំហុស ៖ **របាដាស់តឿន «ZTO មិនទាន់បិទ» ដែលកុហក ឬដែលមិនរលត់។**
//
// ZoeW បិទបញ្ជី «យករួច» ក្នុងខ្លួនវា ចំណែក Argus បិទដោយ Palm app ដាច់ដោយឡែក។
// របានេះប្រាប់ថាកញ្ចប់ណាបិទក្នុង ZoeW តែ ZTO មិនទាន់ដឹង។ ⛔ ការបង្ហាញខុស
// ធ្ងន់ជាងការមិនបង្ហាញ ៖ វាបញ្ជូនអ្នកប្រើទៅបើក Palm ដោយឥតប្រយោជន៍ ហើយ
// បំផ្លាញទំនុកចិត្តលើរបានេះទាំងមូល។ ច្បាប់ដែលចាក់សោ ៖
//
// ១. ⛔ **«មិនទាន់វាស់» មិនត្រូវក្លាយជា «មិនទាន់បិទ»** — គ្មានសាលក្រម ➜ របាលាក់។
// ២. ⛔ របាលាក់ពេលមុខងារ **ដេកលក់** (Lookup មិនមែន ZTO ឬបិទ)។
// ៣. ⛔ Barcode ដែលបើកវិញក្នុង ZoeW ត្រូវធ្លាក់ចេញពីរបាភ្លាម។
// ៤. ⛔ អត្ថបទ Barcode ត្រូវ escape (វាមកពី Firebase ➜ អ្នកប្រើវាយបាន)។
// ៥. ⛔ ការចាកចេញត្រូវលុបរបាចោល (ទិន្នន័យអតិថិជនមិនសល់ក្នុង DOM)។
'use strict';

let chromium;
try { chromium = require('playwright-core').chromium; } catch (e) {
    console.log('SKIP — ត្រូវការ playwright-core (npm i playwright-core)');
    process.exit(0);
}
const fs = require('fs');
const http = require('http');
const path = require('path');

const CHROME = process.env.ZTOBANNER_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const ROOT = process.env.ZTOBANNER_APP_DIR ? path.resolve(process.env.ZTOBANNER_APP_DIR) : path.resolve(__dirname, '..');
const APP_DIR = path.join(ROOT, 'ZoeW');
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm' };

let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { console.log('   ok    ' + label); pass++; }
    else { console.log('   FAIL  ' + label + (detail !== undefined ? '  ➜ ' + JSON.stringify(detail) : '')); fail++; }
}

if (!fs.existsSync(CHROME)) { console.log('SKIP — រកមិនឃើញ Chromium'); process.exit(0); }

// ── ការអះអាងស្តាទិច (ជាន់អប្បបរមា ៖ ថតទទេ ➜ ធ្លាក់) ──────────────────────
const APP_SRC = fs.existsSync(path.join(APP_DIR, 'app.js')) ? fs.readFileSync(path.join(APP_DIR, 'app.js'), 'utf8') : '';
const HTML_SRC = fs.existsSync(path.join(APP_DIR, 'index.html')) ? fs.readFileSync(path.join(APP_DIR, 'index.html'), 'utf8') : '';

ok('អាន app.js បាន (ជាន់អប្បបរមា)', APP_SRC.length > 100000, APP_SRC.length);
ok('អាន index.html បាន (ជាន់អប្បបរមា)', HTML_SRC.length > 20000, HTML_SRC.length);
ok('index.html មានរបា `ztoSyncBanner`', HTML_SRC.indexOf('id="ztoSyncBanner"') !== -1);
ok('⛔ របាលាក់តាមលំនាំដើម (class `hidden`)',
    /<div class="zto-sync-banner hidden" id="ztoSyncBanner"/.test(HTML_SRC));
ok('⛔ របាហៅតាម `data-act` (គ្មាន `onclick=`)',
    /id="ztoSyncBanner"[^>]*data-act="recheckZtoPickupStatus"/.test(HTML_SRC));
ok('សកម្មភាពស្ថិតក្នុង ACTION_ALLOWLIST',
    APP_SRC.indexOf('"recheckZtoPickupStatus"') !== -1);
ok('⛔ សាលក្រមរស់ក្នុង localStorage ពិត',
    APP_SRC.indexOf('zoew_zto_pickup_status_v1') !== -1);

// ⛔ អ្នកយាមចាស់ពិនិត្យតែ literal តែមួយ ➜ វាមិនចាប់ `fb.set()` ·
// `runTransaction` · ការប៉ះ `isDeducted` ឬ node ចំណូលទេ។ ត្រង់នេះយើងស្រង់
// **ម៉ូឌុលពិត** ចេញពី `app.js` រួចទាមទារថាគ្មាន token លុយ/Firebase ណាមួយ
// នៅក្នុងវាសោះ។
function ztoStatusModuleSource(appSrc) {
    const from = appSrc.indexOf('const ZTO_STATUS_STORE_KEY');
    if (from === -1) return '';
    const head = appSrc.indexOf('async function recheckZtoPickupStatus', from);
    if (head === -1) return '';
    const tail = appSrc.indexOf('\n    }', appSrc.indexOf('showToast(left', head));
    if (tail === -1) return '';
    return appSrc.slice(from, tail + 6);
}

const ZTO_MODULE = ztoStatusModuleSource(APP_SRC);
ok('លក្ខខណ្ឌចាំបាច់ ៖ ស្រង់ម៉ូឌុលស្ថានភាព ZTO ចេញពី app.js ពិត',
    ZTO_MODULE.length > 2000 && ZTO_MODULE.indexOf('runZtoStatusSweep') !== -1,
    ZTO_MODULE.length);

const MONEY_TOKENS = ['fb.', 'runTransaction', 'isDeducted', 'dbRef', 'dbOp(',
    'zoew_daily_revenue', 'zoew_monthly_revenue', 'pickedUpBarcodes',
    'packagesPickedUp', 'zoew_scan_history', 'zoew_recently_deleted',
    'claimAndCleanupItem', 'applyBarcodeCloseState', 'removeSingleBarcode',
    'deleteSingleItem', 'ledgerAppliedDelta', 'commitDailyRevenueDelta',
    'commitMonthlyRevenueDelta', 'armLateCommit', 'trashReason ='];
const MONEY_HITS = MONEY_TOKENS.filter((t) => ZTO_MODULE.indexOf(t) !== -1);
ok('⛔ ម៉ូឌុលមិនប៉ះលុយ · Firebase · ធុងសំរាម · ស្ថិតិយក (គ្មាន token ណាមួយ)',
    MONEY_HITS.length === 0, MONEY_HITS);

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

const ZTO_URL = 'https://example.invalid/.netlify/functions/zto-order-detail?barcode={barcode}';
const PLAIN_URL = 'https://example.invalid/api?code={barcode}';

const closedItem = (code) => ({ id: 'x1', phone: '011', barcodes: [{ code: code, isClosed: true, cod: 1, dod: 0 }] });
const openItem = (code) => ({ id: 'x1', phone: '011', barcodes: [{ code: code, isClosed: false, cod: 1, dod: 0 }] });

(async () => {
    const server = await serve(APP_DIR);
    const port = server.address().port;
    const browser = await chromium.launch({ executablePath: CHROME });
    const ctx = await browser.newContext({ viewport: { width: 412, height: 800 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    await page.addInitScript(`window.addEventListener('unhandledrejection', function (ev) {
            var m; try { m = String((ev.reason && (ev.reason.message || ev.reason)) || 'unknown'); } catch (x) { m = 'unknown'; }
            setTimeout(function () { throw new Error('unhandledrejection: ' + m); }, 0);
        });`);
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    await page.route('**', (r) => r.request().url().startsWith('http://127.0.0.1:' + port) ? r.continue() : r.abort());
    await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(1200);

    const ready = await page.evaluate(() => ({
        banner: !!document.getElementById('ztoSyncBanner'),
        render: typeof renderZtoSyncBanner === 'function',
        setVerdict: typeof setZtoPickupVerdict === 'function',
        pending: typeof ztoStatusPendingCodes === 'function',
        recheck: typeof recheckZtoPickupStatus === 'function',
        clearStore: typeof clearZtoPickupStatusStore === 'function'
    }));
    ok('លក្ខខណ្ឌចាំបាច់ ៖ របា និង function ទាំងអស់មានពិត',
        ready.banner && ready.render && ready.setVerdict && ready.pending && ready.recheck && ready.clearStore, ready);

    // ⛔ បើ function មិនមាន ➜ ការអះអាងខាងក្រោមមិនអាចវាស់អ្វីបានទេ ➜ ចេញដោយធ្លាក់
    // **មានឈ្មោះ** (មិនមែនបោះ TypeError ដែលបិទបាំងអ្វីៗទាំងអស់)។
    if (!ready.banner || !ready.render || !ready.setVerdict) {
        ok('⛔ វាស់ឥរិយាបថរបាមិនបាន — កូដមិនទាន់មាន', false, ready);
        await browser.close();
        server.close();
        console.log('\nសរុប ៖ ' + pass + ' ok, ' + fail + ' FAIL');
        process.exit(fail ? 1 : 0);
    }

    const setup = (cfgUrl) => page.evaluate((url) => {
        localStorage.setItem('zoew_lookup_api_config', JSON.stringify({ enabled: true, url: url }));
        localStorage.removeItem('zoew_zto_pickup_status_v1');
        const banner = document.getElementById('ztoSyncBanner');
        banner.innerHTML = '';
        banner.classList.add('hidden');
        document.querySelectorAll('.modal').forEach((m) => { m.style.display = 'none'; });
        try { closeModal(); } catch (e) { /* sandbox */ }
        clearZtoPickupStatusStore();
    }, cfgUrl);

    const bannerState = () => page.evaluate(() => {
        const banner = document.getElementById('ztoSyncBanner');
        return {
            hidden: banner.classList.contains('hidden'),
            text: banner.textContent || '',
            html: banner.innerHTML || '',
            injected: banner.querySelectorAll('img,script,svg').length
        };
    });

    console.log('\n== ១. «មិនទាន់វាស់» មិនត្រូវក្លាយជា «មិនទាន់បិទ» ==');

    await setup(ZTO_URL);
    await page.evaluate((item) => { renderZtoSyncBanner([item]); }, closedItem('BAR000001'));
    let state = await bannerState();
    ok('⛔ គ្មានសាលក្រម ➜ របាលាក់', state.hidden === true, state);

    await page.evaluate((item) => {
        setZtoPickupVerdict('BAR000001', true);
        renderZtoSyncBanner([item]);
    }, closedItem('BAR000001'));
    state = await bannerState();
    ok('⛔ ZTO បិទរួច (`true`) ➜ របាលាក់', state.hidden === true, state);

    console.log('\n== ២. សាលក្រម `false` ➜ របាលេច ==');

    await setup(ZTO_URL);
    await page.evaluate((item) => {
        setZtoPickupVerdict('BAR000001', false);
        renderZtoSyncBanner([item]);
    }, closedItem('BAR000001'));
    state = await bannerState();
    ok('ZTO មិនទាន់បិទ ➜ របាលេច', state.hidden === false, state);
    ok('របារាយចំនួន ១', state.text.indexOf('1 កញ្ចប់') !== -1, state.text);
    ok('របារាយលេខ Barcode', state.text.indexOf('BAR000001') !== -1, state.text);

    await page.evaluate((item) => {
        setZtoPickupVerdict('BAR000002', false);
        setZtoPickupVerdict('BAR000003', false);
        renderZtoSyncBanner([item]);
    }, { id: 'x1', phone: '011', barcodes: [
        { code: 'BAR000001', isClosed: true }, { code: 'BAR000002', isClosed: true }, { code: 'BAR000003', isClosed: true }
    ] });
    state = await bannerState();
    ok('៣ កញ្ចប់ ➜ រាយចំនួន ៣', state.text.indexOf('3 កញ្ចប់') !== -1, state.text);

    console.log('\n== ៣. បើកវិញក្នុង ZoeW ➜ ធ្លាក់ចេញភ្លាម ==');

    await page.evaluate((item) => { renderZtoSyncBanner([item]); }, openItem('BAR000001'));
    state = await bannerState();
    ok('⛔ Barcode បើកវិញ ➜ របាលាក់ (សាលក្រមចាស់មិនកាន់កាប់)', state.hidden === true, state);

    console.log('\n== ៣ខ. ការសម្អាត ២ ម៉ោង ➜ ធុងសំរាម (របាមិនត្រូវបាត់) ==');

    // ⛔ ថ្នាក់កំហុស ៖ ច្បាប់ ២ ម៉ោងផ្លាស់ barcode បិទចេញពី `scanHistory` ចូល
    // ធុងសំរាម (`trashReason: 'pickup'`) ➜ បើរបាស្កេនតែប្រវត្តិ នោះការដាស់តឿន
    // **រលត់ស្ងាត់ៗ** ខណៈកញ្ចប់នោះនៅតែមិនទាន់បិទក្នុង Palm ➜ ការភ្លេចនោះ
    // **គ្មានអ្នកណាប្រាប់ទៀតទេ** ជារៀងរហូត។ ច្បាប់ដដែលនឹង `uncollectedValueByDate()`
    // ៖ ត្រូវស្កេន **ទាំង ២ បញ្ជី**។
    await setup(ZTO_URL);
    const afterCleanup = await page.evaluate((trashItem) => {
        setZtoPickupVerdict('BAR000001', false);
        renderZtoSyncBanner([], [trashItem]);
        const banner = document.getElementById('ztoSyncBanner');
        return { hidden: banner.classList.contains('hidden'), text: banner.textContent || '' };
    }, {
        id: 't1', phone: '011', trashReason: 'pickup', isFromDeletion: true,
        deletedAt: Date.now(), barcodes: [{ code: 'BAR000001', isClosed: true, isFromDeletion: true }]
    });
    ok('⛔ បិទរួច ➜ ចូលធុងសំរាម `pickup` ➜ របា **នៅតែលេច**',
        afterCleanup.hidden === false && afterCleanup.text.indexOf('BAR000001') !== -1, afterCleanup);

    // ⛔ ទិសផ្ទុយ ៖ ធុងសំរាមប្រភេទផ្សេង **មិនរាប់** — «ដក» និង «ផុតកំណត់»
    // ដកលុយចេញ ហើយកញ្ចប់ត្រឡប់ទៅសាខាកណ្តាល ➜ ស្ថានភាព ZTO លែងពាក់ព័ន្ធ។
    for (const reason of ['remove', 'expired', 'delete']) {
        const other = await page.evaluate((args) => {
            clearZtoPickupStatusStore();
            setZtoPickupVerdict('BAR000009', false);
            renderZtoSyncBanner([], [{
                id: 't2', phone: '011', trashReason: args.reason, deletedAt: Date.now(),
                barcodes: [{ code: 'BAR000009', isClosed: true }]
            }]);
            const banner = document.getElementById('ztoSyncBanner');
            return banner.classList.contains('hidden');
        }, { reason: reason });
        ok('⛔ ទិសផ្ទុយ ៖ ធុងសំរាម «' + reason + '» ➜ របាលាក់', other === true, other);
    }

    // ⛔ ធុងសំរាមរក្សា ៣០ ថ្ងៃ ➜ ត្រូវមានព្រំដែនអាយុ បើមិនដូច្នេះរបាដាស់តឿន
    // កញ្ចប់ចាស់ជាសប្តាហ៍។
    const tooOld = await page.evaluate(() => {
        clearZtoPickupStatusStore();
        setZtoPickupVerdict('BAR000010', false);
        renderZtoSyncBanner([], [{
            id: 't3', phone: '011', trashReason: 'pickup',
            deletedAt: Date.now() - (48 * 60 * 60 * 1000),
            barcodes: [{ code: 'BAR000010', isClosed: true }]
        }]);
        const banner = document.getElementById('ztoSyncBanner');
        return banner.classList.contains('hidden');
    });
    ok('⛔ ធុងសំរាមចាស់ជាងព្រំដែន ➜ របាលាក់', tooOld === true, tooOld);

    console.log('\n== ៤. មុខងារដេកលក់ ==');

    await setup(PLAIN_URL);
    await page.evaluate((item) => {
        setZtoPickupVerdict('BAR000001', false);
        renderZtoSyncBanner([item]);
    }, closedItem('BAR000001'));
    state = await bannerState();
    ok('⛔ Lookup មិនមែន ZTO ➜ របាលាក់ ទោះមានសាលក្រម', state.hidden === true, state);

    await page.evaluate((item) => {
        localStorage.removeItem('zoew_lookup_api_config');
        renderZtoSyncBanner([item]);
    }, closedItem('BAR000001'));
    state = await bannerState();
    ok('⛔ គ្មាន Lookup config ➜ របាលាក់', state.hidden === true, state);

    console.log('\n== ៥. XSS ៖ Barcode មកពី Firebase ==');

    await setup(ZTO_URL);
    const evil = '<img src=x onerror=alert(1)>';
    await page.evaluate((payload) => {
        setZtoPickupVerdict(payload, false);
        renderZtoSyncBanner([{ id: 'x1', phone: '011', barcodes: [{ code: payload, isClosed: true }] }]);
    }, evil);
    state = await bannerState();
    ok('⛔ Barcode អាក្រក់ ➜ គ្មាន element ចាក់ចូល', state.injected === 0, state.html.slice(0, 200));
    ok('⛔ Barcode អាក្រក់ ➜ escape ជាអត្ថបទ', state.html.indexOf('&lt;img') !== -1, state.html.slice(0, 200));

    console.log('\n== ៦. ការចាកចេញ ==');

    await setup(ZTO_URL);
    await page.evaluate((item) => {
        setZtoPickupVerdict('BAR000001', false);
        renderZtoSyncBanner([item]);
    }, closedItem('BAR000001'));
    const before = await bannerState();
    ok('លក្ខខណ្ឌចាំបាច់ ៖ របាលេចមុនចាកចេញ', before.hidden === false, before);
    await page.evaluate(() => { clearSensitiveModalFields(); });
    state = await bannerState();
    ok('⛔ ចាកចេញ ➜ របាទទេ និងលាក់', state.hidden === true && state.text.trim() === '', state);
    const stored = await page.evaluate(() => localStorage.getItem('zoew_zto_pickup_status_v1'));
    ok('⛔ ចាកចេញ ➜ សាលក្រមក្នុងឧបករណ៍ត្រូវលុប', stored === null, stored);

    console.log('\n== ៧. ការពិនិត្យដោយដៃត្រូវទៅដល់កញ្ចប់ដែលនៅសល់ ==');

    // ⛔ ថ្នាក់កំហុស ៖ សាលក្រម `true` ជា **ស្ថាពរ** ➜ ការសាកវាឡើងវិញស៊ីកូតា
    // របស់ជុំ (១០ ក្នុងមួយជុំ) ➜ កញ្ចប់ដែល **មិនទាន់បិទ** មិនដែលត្រូវពិនិត្យ
    // ឡើងវិញសោះ ➜ ចុចលើរបា **មិនធ្វើអ្វីសោះ**។
    await setup(ZTO_URL);
    const forced = await page.evaluate(async () => {
        const asked = [];
        const realFetch = window.fetchWithTimeout;
        window.fetchWithTimeout = async (url) => {
            asked.push(String(url));
            return { res: { ok: true, status: 200 }, body: { ztoClosed: true } };
        };
        const barcodes = [];
        for (let i = 1; i <= 12; i++) {
            const code = 'BARDONE' + String(i).padStart(3, '0');
            setZtoPickupVerdict(code, true);
            barcodes.push({ code: code, isClosed: true });
        }
        setZtoPickupVerdict('BARLEFT001', false);
        barcodes.push({ code: 'BARLEFT001', isClosed: true });
        await runZtoStatusSweep(true, [{ id: 'x1', phone: '011', barcodes: barcodes }]);
        window.fetchWithTimeout = realFetch;
        return { asked: asked, reachedPending: asked.some((u) => u.indexOf('BARLEFT001') !== -1) };
    });
    ok('⛔ ការពិនិត្យដោយដៃ ➜ ទៅដល់កញ្ចប់ដែល ZTO មិនទាន់បិទ',
        forced.reachedPending === true, forced.asked.slice(0, 4));
    ok('⛔ សាលក្រម «បិទរួច» ជាស្ថាពរ ➜ មិនសាកឡើងវិញ',
        forced.asked.every((u) => u.indexOf('BARDONE') === -1), forced.asked.slice(0, 4));

    console.log('\n== ៧. ក្រៅបណ្ដាញ ==');

    await setup(ZTO_URL);
    const offlineVerdict = await page.evaluate(async () => {
        Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
        const measured = await runZtoStatusSweep(true);
        Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
        return measured;
    });
    ok('⛔ ក្រៅបណ្ដាញ ➜ មិនហៅបណ្ដាញសោះ', offlineVerdict === 0, offlineVerdict);

    console.log('\n== ១៣. ទទឹងលើទូរស័ព្ទតូច (អត្ថបទវែងបំផុត) ==');

    // ⛔ របាលាក់តាមលំនាំដើម ➜ `layout-check` **មិនដែលឃើញវាពេលមានអត្ថបទ**
    // (០ ការយោង) ➜ ទទឹងគ្មានអ្នកវាស់។ អត្ថបទវែងបំផុត = barcode ៣ + «និង N
    // ទៀត» + «កំពុងពិនិត្យបន្ត N ទៀត» + ការណែនាំចុច។
    await setup(ZTO_URL);
    await page.setViewportSize({ width: 360, height: 780 });
    const widest = await page.evaluate(() => {
        const barcodes = [];
        for (let i = 1; i <= 40; i++) {
            const code = 'BARWIDE' + String(i).padStart(6, '0');
            barcodes.push({ code: code, isClosed: true });
            if (i <= 25) setZtoPickupVerdict(code, false);
        }
        const items = [{ id: 'x1', phone: '011', barcodes: barcodes }];
        renderZtoSyncBanner(items, []);
        const el = document.getElementById('ztoSyncBanner');
        const parent = el.parentElement;
        return {
            hidden: el.classList.contains('hidden'),
            text: (el.textContent || '').slice(0, 120),
            bannerW: Math.round(el.getBoundingClientRect().width),
            parentW: Math.round(parent.getBoundingClientRect().width),
            bannerScrollW: el.scrollWidth,
            bannerClientW: el.clientWidth,
            docScrollW: document.documentElement.scrollWidth,
            innerW: window.innerWidth
        };
    });
    ok('លក្ខខណ្ឌចាំបាច់ ៖ របាលេចជាមួយអត្ថបទវែងបំផុត',
        widest.hidden === false && widest.text.indexOf('កំពុងពិនិត្យបន្ត') !== -1, widest);
    ok('⛔ របាមិនលើសទទឹងឪពុករបស់វា', widest.bannerW <= widest.parentW + 1, widest);
    ok('⛔ របាខ្លួនវាមិនរមូរផ្តេក', widest.bannerScrollW <= widest.bannerClientW + 1, widest);
    ok('⛔ ទំព័រមិនរមូរផ្តេកដោយសាររបា', widest.docScrollW <= widest.innerW + 1, widest);
    await page.setViewportSize({ width: 412, height: 800 });

    console.log('\n== ១២. របាត្រូវប្រាប់ថាការរាប់មិនទាន់ចប់ ==');

    // ⛔ របារាយចំនួន **ដែលវាស់រួច** ប៉ុណ្ណោះ ៖ ជុំបោសដើរ ១០ ក្នុង ២០ វិ. ➜
    // កញ្ចប់ ១០០ ត្រូវការ ~៣ នាទីទំរាំគ្រប់។ អំឡុងនោះ លេខតូចជាងការពិត ➜
    // អ្នកប្រើអាចបិទ App ដោយគិតថាសល់ត្រឹមប៉ុណ្ណោះ។ ច្បាប់ដដែលនឹង
    // «អេក្រង់ត្រូវប្រាប់ថាវាស់មិនបាន» ៖ ការរាប់ដែលមិនទាន់ចប់ ត្រូវនិយាយឲ្យដឹង។
    await setup(ZTO_URL);
    const partial = await page.evaluate(() => {
        setZtoPickupVerdict('BARSEEN001', false);
        const items = [{ id: 'x1', phone: '011', barcodes: [
            { code: 'BARSEEN001', isClosed: true },
            { code: 'BARWAIT001', isClosed: true },
            { code: 'BARWAIT002', isClosed: true }
        ] }];
        renderZtoSyncBanner(items, []);
        const el = document.getElementById('ztoSyncBanner');
        const partialText = el.textContent || '';
        setZtoPickupVerdict('BARWAIT001', true);
        setZtoPickupVerdict('BARWAIT002', true);
        renderZtoSyncBanner(items, []);
        return { partialText: partialText, doneText: el.textContent || '' };
    });
    ok('លក្ខខណ្ឌចាំបាច់ ៖ របាលេចពេលមានសាលក្រម «មិនទាន់បិទ»',
        partial.partialText.indexOf('១') !== -1 || /\d/.test(partial.partialText), partial);
    ok('⛔ នៅមានកញ្ចប់មិនទាន់វាស់ ➜ របាត្រូវប្រាប់',
        partial.partialText.indexOf('កំពុងពិនិត្យបន្ត') !== -1, partial);
    ok('⛔ ចំនួនដែលមិនទាន់វាស់ត្រូវត្រឹមត្រូវ (២)',
        partial.partialText.indexOf('2') !== -1, partial);
    ok('ទិសផ្ទុយ ៖ វាស់គ្រប់រួច ➜ គ្មានសារនោះទៀត',
        partial.doneText.indexOf('កំពុងពិនិត្យបន្ត') === -1
        && partial.doneText.trim() !== '', partial);

    console.log('\n== ១១. ការទប់រយៈពេលវែង មិនត្រូវភ្ញាក់រហូត ==');

    // ⛔ ច្បាប់គម្រោង ៖ «ការភ្ញាក់រាល់ ៣ វិនាទីខណៈក្រៅបណ្តាញ ជាការស៊ីថ្មសុទ្ធសាធ»។
    // ការទប់ដែល **រយៈពេលវែង** (ក្រៅបណ្ដាញ · 2G · ប្រអប់បើក) មិនត្រូវតាំងម៉ោង
    // ឡើងវិញគ្មានទីបញ្ចប់ — `renderHistory` ជាអ្នកដោះទី ២ រួចហើយ។
    await setup(ZTO_URL);
    const rearm = await page.evaluate(async () => {
        const realSched = window.scheduleZtoStatusSweep;
        const realFetch = window.fetchWithTimeout;
        const realNow = Date.now;
        let calls = 0;
        window.scheduleZtoStatusSweep = function () { calls++; };
        window.fetchWithTimeout = async () => ({ res: { ok: true, status: 200 }, body: { ztoClosed: false } });
        Date.now = () => realNow.call(Date) + 400 * 60000;

        const many = [];
        for (let i = 1; i <= 12; i++) many.push({ code: 'BARARM' + String(i).padStart(4, '0'), isClosed: true });
        await runZtoStatusSweep(false, [{ id: 'x1', phone: '011', barcodes: many }], []);
        const afterFullBatch = calls;

        calls = 0;
        Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
        await runZtoStatusSweep(false, [{ id: 'x2', phone: '011',
            barcodes: [{ code: 'BAROFF0001', isClosed: true }] }], []);
        const offlineCalls = calls;
        Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });

        Date.now = realNow;
        window.fetchWithTimeout = realFetch;
        window.scheduleZtoStatusSweep = realSched;
        return { afterFullBatch: afterFullBatch, offlineCalls: offlineCalls };
    });
    ok('លក្ខខណ្ឌចាំបាច់ ៖ ជុំពេញ ➜ តាំងម៉ោងបន្តពិត (ការរាប់ដើរ)',
        rearm.afterFullBatch > 0, rearm);
    ok('⛔ ក្រៅបណ្ដាញ ➜ មិនតាំងម៉ោងភ្ញាក់ឡើងវិញ', rearm.offlineCalls === 0, rearm);

    console.log('\n== ១០. ស្នាមភ្ជាប់ ៖ ឈ្មោះវាលរវាង Function និង App ==');

    // ⛔ សំណួរទី ៧ នៃវិន័យឧបករណ៍ ៖ ឈ្មោះវាលរស់នៅ **២ ឯកសារ** ៖ Function
    // ផលិតវា ហើយ `app.js` អានវា។ តេស្តនីមួយៗចាក់សោ *ខាងខ្លួន* ដោយ literal
    // ➜ ការស៊ីគ្នាជាការចៃដន្យ មិនមែនការវាស់។ ត្រង់នេះយើងដេរីវេឈ្មោះចេញពី
    // Function ពិត រួចទាមទារឲ្យ App អានឈ្មោះ **ដដែល**។
    const FN_PATH = path.join(APP_DIR, 'netlify', 'functions', 'zto-order-detail.js');
    const FN_SRC = fs.existsSync(FN_PATH) ? fs.readFileSync(FN_PATH, 'utf8') : '';
    ok('លក្ខខណ្ឌចាំបាច់ ៖ អាន Function ពិតបាន', FN_SRC.length > 0, FN_PATH);
    const emitted = /(\w+)\s*:\s*order\.signed\b/.exec(FN_SRC);
    ok('លក្ខខណ្ឌចាំបាច់ ៖ រកឃើញឈ្មោះវាលដែល Function ផលិត', !!emitted,
        emitted ? emitted[1] : null);
    if (emitted) {
        const field = emitted[1];
        const readRe = new RegExp('data\\.' + field + '\\b');
        ok('⛔ App ត្រូវអានឈ្មោះវាល **ដដែល** នឹង Function ផលិត ៖ ' + field,
            readRe.test(APP_SRC), field);
        ok('⛔ App មិនត្រូវអានឈ្មោះផ្សេងសម្រាប់ស្ថានភាព ZTO',
            (APP_SRC.match(/data\.zto[A-Za-z]+/g) || [])
                .every((m) => m === 'data.' + field),
            (APP_SRC.match(/data\.zto[A-Za-z]+/g) || []).slice(0, 4));
    }

    console.log('\n== ៨. សាលក្រម «វាស់មិនបាន» ត្រូវចងចាំ — កុំហៅជាប់រហូត ==');

    await setup(ZTO_URL);
    const gateDiag = await page.evaluate(() => ({
        frugal: linkIsFrugal(),
        allowed: ztoStatusNetworkAllowed()
    }));
    ok('លក្ខខណ្ឌចាំបាច់ ៖ ច្រកទ្វារបើកមុនវាស់ (គ្មានសំណល់ឆ្លងសេណារីយ៉ូ)',
        gateDiag.allowed === true && gateDiag.frugal === false, gateDiag);

    // ⛔ ថ្នាក់កំហុស ៖ ក្នុងស្ថានភាព «ដេកលក់» (env `ZTO_FIELD_SIGNED` មិនទាន់
    // ដាក់) Function ត្រឡប់ `ztoClosed: null` ជានិច្ច ➜ `setZtoPickupVerdict`
    // មិនដែលត្រូវហៅ ➜ barcode នៅ «មិនទាន់វាស់» ជារៀងរហូត ➜ រាល់ជុំសួរដដែល
    // ➜ **ហៅ ZTO ១០ ដងរាល់ ២០ វិនាទី គ្មានទីបញ្ចប់**។ នេះផ្ទុយនឹងច្បាប់
    // «គ្មានការហៅជាប់រហូត ៖ ១ ដងក្នុងមួយ barcode»។
    await setup(ZTO_URL);
    const dormant = await page.evaluate(async () => {
        const asked = [];
        const realFetch = window.fetchWithTimeout;
        const realNow = Date.now;
        window.fetchWithTimeout = async (url) => {
            asked.push(String(url));
            return { res: { ok: true, status: 200 }, body: { ztoClosed: null } };
        };
        const barcodes = [];
        for (let i = 1; i <= 12; i++) {
            barcodes.push({ code: 'BARDORM' + String(i).padStart(3, '0'), isClosed: true });
        }
        const items = [{ id: 'x1', phone: '011', barcodes: barcodes }];
        const perRound = [];
        let shift = 60000;
        Date.now = () => realNow.call(Date) + shift;
        for (let round = 0; round < 4; round++) {
            const before = asked.length;
            await runZtoStatusSweep(false, items, []);
            perRound.push(asked.length - before);
            shift += 60000;
            Date.now = () => realNow.call(Date) + shift;
        }
        Date.now = realNow;
        window.fetchWithTimeout = realFetch;
        const unique = {};
        asked.forEach((u) => {
            const m = /BARDORM\d+/.exec(u);
            if (m) unique[m[0]] = (unique[m[0]] || 0) + 1;
        });
        let maxPerCode = 0;
        Object.keys(unique).forEach((k) => { if (unique[k] > maxPerCode) maxPerCode = unique[k]; });
        return { total: asked.length, perRound: perRound, maxPerCode: maxPerCode };
    });
    ok('លក្ខខណ្ឌចាំបាច់ ៖ ជុំទី ១ សួរ upstream ពិត', dormant.perRound[0] > 0, dormant);
    ok('⛔ ចម្លើយ «វាស់មិនបាន» ត្រូវចងចាំ ➜ ជុំបោសត្រូវឈប់',
        dormant.perRound[2] === 0 && dormant.perRound[3] === 0, dormant);
    ok('⛔ គ្មានការហៅជាប់រហូត ៖ barcode ១ មិនត្រូវសួរលើស ១ ដង',
        dormant.maxPerCode <= 1, dormant);
    ok('⛔ ការហៅសរុប = ចំនួន barcode (មិនកើនតាមចំនួនជុំ)',
        dormant.total === 12, dormant);

    // ⛔ ថ្នាក់កំហុសទី ២ ៖ ការបោះចោលពេលពេញ (`ZTO_STATUS_MAX`) ដើរតាមលំដាប់
    // ចាក់ចូល ➜ សាលក្រម `false` (អ្វីដែលរបាត្រូវការ!) ត្រូវបោះមុនសាលក្រម
    // `true` ដែលគ្មានតម្លៃ ➜ ការដាស់តឿនរលត់ស្ងាត់ៗ លើសាខាដែលរវល់។
    console.log('\n== ៩. ច្រកទ្វារដូចផ្លូវ Lookup ==');

    // ⛔ ចេតនាអ្នកប្រើត្រូវឈ្នះការសន្សំ ៖ ច្បាប់ដដែលនឹង `activate()` របស់
    // `license-verify.js` (ការចុចផ្ទាល់ ➜ `priority: true`)។ បើការចុចត្រូវ
    // បិទដោយ Data Saver នោះ toast រាយ «សូមសាកម្ដងទៀត» ខណៈការសាកម្ដងទៀត
    // ធ្លាក់ដដែល ➜ សារកុហក។
    await setup(ZTO_URL);
    const userIntent = await page.evaluate(async () => {
        const asked = [];
        const realFetch = window.fetchWithTimeout;
        window.fetchWithTimeout = async (url) => {
            asked.push(String(url));
            return { res: { ok: true, status: 200 }, body: { ztoClosed: false } };
        };
        Object.defineProperty(navigator, 'connection', { value: { saveData: true }, configurable: true });
        const items = [{ id: 'x1', phone: '011', barcodes: [{ code: 'BARWISH001', isClosed: true }] }];
        const realNow = Date.now;
        Date.now = () => realNow.call(Date) + 30 * 60000;
        const auto = await runZtoStatusSweep(false, items, []);
        const afterAuto = asked.length;
        const manual = await runZtoStatusSweep(true, items, []);
        Date.now = realNow;
        Object.defineProperty(navigator, 'connection', { value: undefined, configurable: true });
        window.fetchWithTimeout = realFetch;
        return { autoCalls: afterAuto, manualCalls: asked.length - afterAuto, auto: auto, manual: manual };
    });
    ok('⛔ 2G ៖ ជុំបោស **ស្វ័យប្រវត្តិ** មិនហៅបណ្ដាញ', userIntent.autoCalls === 0, userIntent);
    ok('⛔ 2G ៖ ការចុច **ដោយអ្នកប្រើ** ត្រូវដើរដដែល', userIntent.manualCalls > 0, userIntent);

    // ⛔ ជុំបោសនេះជា **ការងារបណ្តាញស្រេចចិត្ត** (ការដាស់តឿន មិនមែនមុខងារ
    // អាជីវកម្ម) ➜ វាត្រូវគោរពច្រកទ្វារដដែលនឹង `customerTablePrefetchAllowed()`
    // ៖ `linkIsFrugal()` (2G/Data Saver) និង `isModalOpen` (កំពុងស្កេន)។
    const gateProbe = async (mode, baseMin) => {
        await setup(ZTO_URL);
        return page.evaluate(async (args) => {
            const m = args.m;
            const asked = [];
            const realFetch = window.fetchWithTimeout;
            window.fetchWithTimeout = async (url) => {
                asked.push(String(url));
                return { res: { ok: true, status: 200 }, body: { ztoClosed: false } };
            };
            if (m === 'frugal') {
                Object.defineProperty(navigator, 'connection', {
                    value: { saveData: true }, configurable: true });
            }
            if (m === 'modal') openModalHelper('ztoGateProbeModal');
            const items = [{ id: 'x1', phone: '011', barcodes: [{ code: 'BARGATE001', isClosed: true }] }];
            const realNow = Date.now;
            let shift = args.baseMin * 60000;
            Date.now = () => realNow.call(Date) + shift;
            await runZtoStatusSweep(false, items, []);
            const blocked = asked.length;
            if (m === 'frugal') {
                Object.defineProperty(navigator, 'connection', {
                    value: undefined, configurable: true });
            }
            if (m === 'modal') closeModal();
            shift += 30 * 60000;
            await runZtoStatusSweep(false, items, []);
            Date.now = realNow;
            window.fetchWithTimeout = realFetch;
            return { blocked: blocked, afterRelease: asked.length - blocked };
        }, { m: mode, baseMin: baseMin });
    };

    const frugalGate = await gateProbe('frugal', 90);
    ok('⛔ 2G / Data Saver ➜ ជុំបោសមិនហៅបណ្ដាញ', frugalGate.blocked === 0, frugalGate);
    ok('ទិសផ្ទុយ ៖ បណ្ដាញធម្មតាវិញ ➜ ជុំបោសដើរ', frugalGate.afterRelease > 0, frugalGate);

    const modalGate = await gateProbe('modal', 240);
    ok('⛔ ប្រអប់បើក (កំពុងស្កេន) ➜ ជុំបោសមិនហៅបណ្ដាញ', modalGate.blocked === 0, modalGate);
    ok('ទិសផ្ទុយ ៖ ប្រអប់បិទវិញ ➜ ជុំបោសដើរ', modalGate.afterRelease > 0, modalGate);

    // ⛔ ទិសផ្ទុយ ៖ «upstream ធ្លាក់» ≠ «ZTO គ្មានវាលនេះ» — ការចងចាំការធ្លាក់
    // បណ្ដាញជា «វាស់មិនបាន» នឹងបិទការពិនិត្យពេញ TTL ខណៈ ZTO ដាច់ត្រឹមមួយភ្លែត។
    await setup(ZTO_URL);
    const upstreamDown = await page.evaluate(async () => {
        const asked = [];
        const realFetch = window.fetchWithTimeout;
        const realNow = Date.now;
        window.fetchWithTimeout = async (url) => {
            asked.push(String(url));
            return { res: { ok: false, status: 502 }, body: null };
        };
        const items = [{ id: 'x1', phone: '011', barcodes: [{ code: 'BARDOWN001', isClosed: true }] }];
        let shift = 60000;
        Date.now = () => realNow.call(Date) + shift;
        await runZtoStatusSweep(false, items, []);
        const first = asked.length;
        shift += 60000;
        await runZtoStatusSweep(false, items, []);
        Date.now = realNow;
        window.fetchWithTimeout = realFetch;
        return { first: first, second: asked.length - first };
    });
    ok('លក្ខខណ្ឌចាំបាច់ ៖ upstream ធ្លាក់ ➜ ជុំទី ១ សួរពិត', upstreamDown.first > 0, upstreamDown);
    ok('⛔ upstream ធ្លាក់ ≠ «វាស់មិនបាន» ➜ ត្រូវសាកឡើងវិញ',
        upstreamDown.second > 0, upstreamDown);

    const MAXCAP = (() => {
        const m = /ZTO_STATUS_MAX\s*=\s*(\d+)/.exec(APP_SRC);
        return m ? parseInt(m[1], 10) : 0;
    })();
    ok('លក្ខខណ្ឌចាំបាច់ ៖ អាន `ZTO_STATUS_MAX` ចេញពីកូដពិត', MAXCAP > 0, MAXCAP);
    await setup(ZTO_URL);
    const evicted = await page.evaluate((cap) => {
        setZtoPickupVerdict('BAROPEN001', false);
        for (let i = 1; i <= cap + 20; i++) {
            setZtoPickupVerdict('BARFILL' + String(i).padStart(4, '0'), true);
        }
        const item = { id: 'x1', phone: '011', barcodes: [{ code: 'BAROPEN001', isClosed: true }] };
        renderZtoSyncBanner([item], []);
        const el = document.getElementById('ztoSyncBanner');
        return { hidden: el.classList.contains('hidden'), text: (el.textContent || '').trim() };
    }, MAXCAP);
    ok('⛔ ពេញពិដាន ➜ សាលក្រម «មិនទាន់បិទ» ត្រូវរស់ (កុំបោះមុន «បិទរួច»)',
        evicted.hidden === false, evicted);

    console.log('\n== ១៤. លំដាប់ចៃដន្យ (fuzz) ==');

    // ⛔ ជាន់ទី ៥ នៃមេរៀនគម្រោង ៖ សេណារីយ៉ូ **សរសេរដោយដៃ** ទាំងអស់ ➜ រាល់ជុំ
    // សរសេរល្អជាងមុនបន្តិច ➜ រកឃើញកំហុសមួយទៀតក្នុងកូដដដែល។ ត្រង់នេះលំដាប់
    // ជាចៃដន្យ ៖ ចំនួន barcode · បិទ/បើក · ចម្លើយ upstream (true · false ·
    // គ្មានវាល · HTTP ធ្លាក់) ➜ អថេរ ៣ ត្រូវឈរជានិច្ច។
    await setup(ZTO_URL);
    const FUZZ_RUNS = parseInt(process.env.ZTOBANNER_FUZZ_RUNS || '40', 10);
    const fuzz = await page.evaluate(async (runs) => {
        const bad = [];
        const rnd = (s) => { let x = s; return () => { x = (x * 1103515245 + 12345) & 0x7fffffff; return x / 0x7fffffff; }; };
        for (let run = 0; run < runs; run++) {
            const r = rnd(run * 7919 + 13);
            document.querySelectorAll('.modal').forEach((m) => { m.style.display = 'none'; });
            try { closeModal(); } catch (e) { /* sandbox */ }
            clearZtoPickupStatusStore();
            const n = 1 + Math.floor(r() * 14);
            const barcodes = [];
            const truth = {};
            for (let i = 0; i < n; i++) {
                const code = 'FZ' + run + 'X' + String(i).padStart(3, '0');
                const closed = r() < 0.7;
                barcodes.push({ code: code, isClosed: closed });
                truth[code] = closed;
            }
            const items = [{ id: 'i' + run, phone: '011', barcodes: barcodes }];
            const answers = {};
            const realFetch = window.fetchWithTimeout;
            window.fetchWithTimeout = async (url) => {
                const m = /FZ\d+X\d{3}/.exec(String(url));
                const code = m ? m[0] : '';
                const roll = r();
                let body;
                if (roll < 0.25) body = { ztoClosed: true };
                else if (roll < 0.55) body = { ztoClosed: false };
                else if (roll < 0.8) body = {};
                else return { res: { ok: false, status: 502 }, body: null };
                answers[code] = body.ztoClosed === undefined ? null : body.ztoClosed;
                return { res: { ok: true, status: 200 }, body: body };
            };
            const realNow = Date.now;
            let shift = (run + 1) * 3600000;
            Date.now = () => realNow.call(Date) + shift;
            for (let round = 0; round < 4; round++) {
                await runZtoStatusSweep(false, items, []);
                shift += 1800000;
            }
            Date.now = realNow;
            window.fetchWithTimeout = realFetch;

            renderZtoSyncBanner(items, []);
            const el = document.getElementById('ztoSyncBanner');
            const hidden = el.classList.contains('hidden');
            const txt = el.textContent || '';
            let expectShown = false;
            let expectCount = 0;
            Object.keys(answers).forEach((c) => {
                if (answers[c] === false && truth[c] === true) { expectShown = true; expectCount++; }
            });
            if (hidden === expectShown) bad.push({ run: run, why: 'hidden', hidden: hidden, expect: expectShown });
            if (expectShown) {
                const m = /^\D*(\d+)/.exec(txt.replace('🔄', ''));
                const shown = m ? parseInt(m[1], 10) : -1;
                if (shown !== expectCount) bad.push({ run: run, why: 'count', shown: shown, expect: expectCount });
            }
            Object.keys(truth).forEach((c) => {
                if (!truth[c] && txt.indexOf(c) !== -1) bad.push({ run: run, why: 'open nagged', code: c });
            });
        }
        return { bad: bad.slice(0, 5), badCount: bad.length, runs: runs };
    }, FUZZ_RUNS);
    ok('លក្ខខណ្ឌចាំបាច់ ៖ ជុំ fuzz រត់ពិត', fuzz.runs >= 40, fuzz);
    ok('⛔ របាលេច ⇔ មានសាលក្រម «មិនទាន់បិទ» ពិត (លំដាប់ចៃដន្យ)',
        fuzz.bad.filter((b) => b.why === 'hidden').length === 0, fuzz);
    ok('⛔ លេខលើរបា = ចំនួនសាលក្រម «មិនទាន់បិទ» (លំដាប់ចៃដន្យ)',
        fuzz.bad.filter((b) => b.why === 'count').length === 0, fuzz);
    ok('⛔ Barcode ដែល ZoeW មិនបិទ មិនដែលលេចលើរបា (លំដាប់ចៃដន្យ)',
        fuzz.bad.filter((b) => b.why === 'open nagged').length === 0, fuzz);

    ok('⛔ គ្មានកំហុស runtime អំឡុងការវាស់', errors.length === 0, errors.slice(0, 3));

    await browser.close();
    server.close();
    console.log('\nសរុប ៖ ' + pass + ' ok, ' + fail + ' FAIL');
    process.exit(fail ? 1 : 0);
})();
