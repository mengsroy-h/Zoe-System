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
const CSS_SRC = fs.existsSync(path.join(APP_DIR, 'style.css')) ? fs.readFileSync(path.join(APP_DIR, 'style.css'), 'utf8') : '';

ok('អាន app.js បាន (ជាន់អប្បបរមា)', APP_SRC.length > 100000, APP_SRC.length);
ok('អាន index.html បាន (ជាន់អប្បបរមា)', HTML_SRC.length > 20000, HTML_SRC.length);
ok('index.html មានរបា `ztoSyncBanner`', HTML_SRC.indexOf('id="ztoSyncBanner"') !== -1);
ok('⛔ របាលាក់តាមលំនាំដើម (class `hidden`)',
    /<div class="zto-sync-banner hidden" id="ztoSyncBanner"/.test(HTML_SRC));
ok('⛔ របាហៅតាម `data-act` (គ្មាន `onclick=`)',
    /id="ztoSyncBanner"[^>]*data-act="openZtoSyncModal"/.test(HTML_SRC));
ok('សកម្មភាពស្ថិតក្នុង ACTION_ALLOWLIST',
    APP_SRC.indexOf('"recheckZtoPickupStatus"') !== -1
    && APP_SRC.indexOf('"openZtoSyncModal"') !== -1
    && APP_SRC.indexOf('"closeZtoSyncModal"') !== -1);
ok('index.html មានប្រអប់ `ztoSyncModal` និងបញ្ជី `ztoSyncList`',
    HTML_SRC.indexOf('id="ztoSyncModal"') !== -1 && HTML_SRC.indexOf('id="ztoSyncList"') !== -1);
ok('⛔ ប្រអប់មានប៊ូតុងពិនិត្យម្តងទៀត និងបិទ (គ្មាន `onclick=`)',
    /id="ztoSyncModal"[\s\S]{0,900}data-act="recheckZtoPickupStatus"/.test(HTML_SRC)
    && /id="ztoSyncModal"[\s\S]{0,900}data-act="closeZtoSyncModal"/.test(HTML_SRC));
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
        // ⛔ ត្រូវលើសជំហានទប់ **ច្បាស់លាស់** — ការឈរចំគែម (៦០០០០ ធៀប ៦០០០០)
        // ធ្វើឲ្យបៃតងអាស្រ័យលើ `<` ធៀប `<=` ជំនួសលើឥរិយាបថពិត។
        shift += 150000;
        await runZtoStatusSweep(false, items, []);
        Date.now = realNow;
        window.fetchWithTimeout = realFetch;
        return { first: first, second: asked.length - first };
    });
    ok('លក្ខខណ្ឌចាំបាច់ ៖ upstream ធ្លាក់ ➜ ជុំទី ១ សួរពិត', upstreamDown.first > 0, upstreamDown);
    ok('⛔ upstream ធ្លាក់ ≠ «វាស់មិនបាន» ➜ ត្រូវសាកឡើងវិញ',
        upstreamDown.second > 0, upstreamDown);

    // ⛔ **ការសាកឡើងវិញត្រូវមានព្រំដែន។** ជួរខាងលើទាមទារថា ZTO ដែលដាច់មួយភ្លែត
    // មិនត្រូវបិទមុខងារពេញ TTL — តែបើគ្មានការទប់សោះ ការធ្លាក់ **យូរ** ក្លាយជា
    // ១០ ការហៅរៀងរាល់ ២០ វិនាទី គ្មានទីបញ្ចប់ (៣០ ការហៅ/នាទី លើទិន្នន័យ
    // ទូរស័ព្ទ)។ ⛔ ការទប់ត្រូវដើរលើ **ចង្វាក់សាកឡើងវិញ** មិនមែនលើការចងចាំ
    // សាលក្រម ➜ គ្មានការធ្លាក់ណាចូល `ztoPickupStatus` ហើយជោគជ័យតែមួយ
    // (ឬបណ្ដាញត្រឡប់មកវិញ) ត្រូវលុបការទប់ភ្លាម។
    await setup(ZTO_URL);
    const backoff = await page.evaluate(async () => {
        const asked = [];
        const realFetch = window.fetchWithTimeout;
        const realNow = Date.now;
        let mode = 'down';
        window.fetchWithTimeout = async (url) => {
            asked.push(String(url));
            if (mode === 'down') return { res: { ok: false, status: 502 }, body: null };
            return { res: { ok: true, status: 200 }, body: { ztoClosed: true } };
        };
        let shift = 0;
        Date.now = () => realNow.call(Date) + shift;
        const itemA = { id: 'a', phone: '011', barcodes: [{ code: 'BARBACK001', isClosed: true }] };
        const itemB = { id: 'b', phone: '012', barcodes: [{ code: 'BARBACK002', isClosed: true }] };
        const step = async (advanceMs, item) => {
            shift += advanceMs;
            const before = asked.length;
            await runZtoStatusSweep(false, [item], []);
            return asked.length - before;
        };
        const out = {};
        out.first = await step(10 * 60000, itemA);
        out.tooSoon = await step(25000, itemA);
        out.afterBackoff = await step(120000, itemA);
        mode = 'up';
        out.recovered = await step(5 * 60000, itemA);
        out.afterReset = await step(25000, itemB);
        Date.now = realNow;
        window.fetchWithTimeout = realFetch;
        return out;
    });
    ok('លក្ខខណ្ឌចាំបាច់ ៖ upstream ធ្លាក់ ➜ ជុំទី ១ សួរពិត', backoff.first === 1, backoff);
    ok('⛔ ការធ្លាក់ជាប់ៗ ➜ ជុំបន្ទាប់ត្រូវទប់ (មិនហៅរាល់ ២០ វិ.)',
        backoff.tooSoon === 0, backoff);
    ok('⛔ ការទប់មានព្រំដែន ➜ ផុតជំហានហើយត្រូវសាកឡើងវិញ',
        backoff.afterBackoff === 1, backoff);
    ok('ទិសផ្ទុយ ៖ ជោគជ័យ ➜ ការទប់ត្រូវលុប ➜ barcode ថ្មីសួរតាមចង្វាក់ធម្មតា',
        backoff.recovered === 1 && backoff.afterReset === 1, backoff);

    // ⛔ ការទប់ខ្លួនឯងបង្កើត **ការយឺត** ថ្មី ៖ ជំហានចុងក្រោយ (១០ នាទី) អាចនៅ
    // ដំណើរការខណៈបណ្ដាញត្រឡប់មកវិញរួច ➜ របាធ្វើឲ្យស្រស់យឺតដល់ ១០ នាទី។
    // `online` ត្រូវ **កាត់ម៉ោងដែលកំពុងរង់ចាំឲ្យខ្លី** — ⛔ តែវាត្រូវប៉ះ
    // **តែម៉ោងដែលដាក់រួច** ប៉ុណ្ណោះ ➜ បណ្ដាញភ្លឹបភ្លែត មិនអាចបង្កើតជុំបោស
    // បន្ថែមបានទេ (ចង្វាក់ ២០ វិ. ក្នុង `runZtoStatusSweep` នៅឈរដដែល)។
    await setup(ZTO_URL);
    const reconnect = await page.evaluate(async () => {
        const out = { armedBefore: false, armedAfter: false, noTimerStaysNoTimer: false, present: false };
        // ⛔ tree មុនកែគ្មាន helper នេះ ➜ **stub** ជំនួសការគាំង ដើម្បីឲ្យការ
        // អះអាងធ្លាក់ដោយ **មានឈ្មោះ** មិនមែនលេប checker ទាំងមូល (មេរៀន 2.19.3)។
        out.present = typeof resumeZtoStatusSweep === 'function';
        const resume = out.present ? resumeZtoStatusSweep : function () {};
        if (ztoStatusSweepTimer) { clearTimeout(ztoStatusSweepTimer); ztoStatusSweepTimer = null; }
        resume();
        out.noTimerStaysNoTimer = !ztoStatusSweepTimer;
        scheduleZtoStatusSweep(10 * 60000);
        out.armedBefore = !!ztoStatusSweepTimer;
        const longId = ztoStatusSweepTimer;
        resume();
        out.armedAfter = !!ztoStatusSweepTimer && ztoStatusSweepTimer !== longId;
        if (ztoStatusSweepTimer) { clearTimeout(ztoStatusSweepTimer); ztoStatusSweepTimer = null; }
        return out;
    });
    ok('លក្ខខណ្ឌចាំបាច់ ៖ ការទប់វែងដាក់ម៉ោងពិត', reconnect.armedBefore === true, reconnect);
    ok('⛔ `resumeZtoStatusSweep()` ត្រូវមានក្នុងកូដ ship', reconnect.present === true, reconnect);
    ok('⛔ បណ្ដាញត្រឡប់មកវិញ ➜ ម៉ោងវែងត្រូវជំនួសដោយម៉ោងខ្លី',
        reconnect.armedAfter === true, reconnect);
    ok('⛔ គ្មានម៉ោងដាក់រួច ➜ `online` មិនបង្កើតជុំបោសបន្ថែម (បណ្ដាញភ្លឹបភ្លែត)',
        reconnect.noTimerStaysNoTimer === true, reconnect);

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

    // ⛔ **ទិសផ្ទុយនៃជួរខាងលើ** — ជួរខាងលើវាស់ថា សាលក្រម `false` **រស់** ពេល
    // cache ពេញដោយ `true`។ តែថ្ងៃរវល់ (ឬ `ZTO_SIGNED_VALUES` កំណត់ខុស ➜
    // **គ្រប់** កញ្ចប់អាន `false`) ធ្វើឲ្យ cache ពេញដោយ `false` វិញ ➜ ត្រង់នោះ
    // សាលក្រម **ថ្មី** ដែលជា `true` ឬ «វាស់មិនបាន» ត្រូវតែ **ចូលបាន**។
    // វាស់បាន (2026-09-10) ៖ អ្នកបោះជ្រើស «ធាតុទី ១ ដែលមិនមែន `false`» ➜
    // ធាតុនោះគឺ **ធាតុដែលទើបចាក់ចូល** ព្រោះវាជាធាតុតែមួយដែលមិនមែន `false`
    // ➜ សាលក្រមថ្មីត្រូវបោះភ្លាម ➜ barcode នោះក្លាយជា «មិនទាន់វាស់» រៀងរាល់
    // ជុំ ➜ **១០ ការហៅក្នុង ១០ ជុំ** ជំនួស ១ (ថ្នាក់ដដែលនឹង 2.31.9)។
    await setup(ZTO_URL);
    const capNew = await page.evaluate(async (cap) => {
        const asked = [];
        const realFetch = window.fetchWithTimeout;
        window.fetchWithTimeout = async (url) => {
            asked.push(String(url));
            return { res: { ok: true, status: 200 }, body: { ztoClosed: true } };
        };
        for (let i = 1; i <= cap; i++) {
            setZtoPickupVerdict('BARSAT' + String(i).padStart(4, '0'), false);
        }
        const item = { id: 'x1', phone: '011', barcodes: [{ code: 'BARFRESH01', isClosed: true }] };
        const realNow = Date.now;
        let shift = 0;
        Date.now = () => realNow.call(Date) + shift;
        const perRound = [];
        for (let round = 0; round < 4; round++) {
            shift += 30 * 60000;
            const before = asked.length;
            await runZtoStatusSweep(false, [item], []);
            perRound.push(asked.length - before);
        }
        // សាលក្រម «វាស់មិនបាន» (`null`) ត្រូវចងចាំដូចគ្នា
        setZtoPickupVerdict('BARNULL001', null);
        const item2 = { id: 'x2', phone: '012', barcodes: [{ code: 'BARNULL001', isClosed: true }] };
        shift += 30 * 60000;
        const beforeNull = asked.length;
        await runZtoStatusSweep(false, [item2], []);
        const nullCalls = asked.length - beforeNull;
        Date.now = realNow;
        window.fetchWithTimeout = realFetch;
        return { perRound: perRound, total: asked.filter((u) => u.indexOf('BARFRESH01') !== -1).length,
            nullCalls: nullCalls };
    }, MAXCAP);
    ok('លក្ខខណ្ឌចាំបាច់ ៖ cache ពេញដោយ `false` ➜ ជុំទី ១ សួរ barcode ថ្មីពិត',
        capNew.perRound[0] === 1, capNew);
    ok('⛔ cache ពេញដោយ `false` ➜ សាលក្រម `true` **ថ្មី** ត្រូវចងចាំ (មិនបោះខ្លួនឯង)',
        capNew.perRound[1] === 0 && capNew.perRound[2] === 0 && capNew.perRound[3] === 0, capNew);
    ok('⛔ គ្មានការហៅជាប់រហូត ៖ barcode ថ្មី ១ សួរតែ ១ ដងក្នុង ៤ ជុំ',
        capNew.total === 1, capNew);
    ok('⛔ សាលក្រម «វាស់មិនបាន» ថ្មី ក៏ត្រូវចងចាំពេល cache ពេញដែរ',
        capNew.nullCalls === 0, capNew);

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

    // ── ១៥. ចុចរបា ➜ ប្រអប់បញ្ជី Barcode ─────────────────────────────────
    // ⛔ សំណើអ្នកប្រើ (2026-09-10) ៖ របាប្រាប់ថា «មាន N កញ្ចប់» តែមិនប្រាប់ថា
    // **លេខណា** ➜ អ្នកប្រើត្រូវរកដោយភ្នែកក្នុងតារាង មុននឹងស្កេនចូល Palm។
    // ការចុចត្រូវបើកបញ្ជីលេខ **តែម្តង**។ ⛔ បញ្ជីត្រូវផ្ទុក **តែ** barcode ដែល
    // មានសាលក្រម `false` ពិត — សាលក្រម `true` និង «មិនទាន់វាស់» មិនត្រូវលេច
    // (បើអត់ អ្នកប្រើនឹងស្កេនកញ្ចប់ដែលបិទរួចចូល Palm ម្តងទៀត)។
    console.log('\n== ១៥. ចុចរបា ➜ ប្រអប់បញ្ជី Barcode ==');
    await setup(ZTO_URL);
    const modalReady = await page.evaluate(() => ({
        modal: !!document.getElementById('ztoSyncModal'),
        list: !!document.getElementById('ztoSyncList'),
        open: typeof openZtoSyncModal === 'function',
        close: typeof closeZtoSyncModal === 'function',
        renderList: typeof renderZtoSyncModalList === 'function'
    }));
    ok('លក្ខខណ្ឌចាំបាច់ ៖ ប្រអប់ និង function ទាំងអស់មានពិត',
        modalReady.modal && modalReady.list && modalReady.open
        && modalReady.close && modalReady.renderList, modalReady);

    if (modalReady.modal && modalReady.open) {
        const tap = await page.evaluate(async () => {
            const item = { id: 'm1', phone: '0967778889', barcodes: [
                { code: 'MODAL0000001', isClosed: true, locker: 'A-01' },
                { code: 'MODAL0000002', isClosed: true },
                { code: 'MODAL0000003', isClosed: true }
            ] };
            setZtoPickupVerdict('MODAL0000001', false);
            setZtoPickupVerdict('MODAL0000002', true);
            setZtoPickupVerdict('MODAL0000003', false);
            renderZtoSyncBanner([item]);
            const banner = document.getElementById('ztoSyncBanner');
            const bannerShown = !banner.classList.contains('hidden');
            banner.click();
            await new Promise((r) => setTimeout(r, 60));
            const modal = document.getElementById('ztoSyncModal');
            renderZtoSyncModalList([item]);
            const rows = Array.from(document.querySelectorAll('#ztoSyncList .zto-sync-item'));
            const codes = rows.map((el) => {
                const c = el.querySelector('.zto-sync-code');
                return c ? c.textContent.trim() : '';
            });
            const metaText = rows.map((el) => {
                const m = el.querySelector('.zto-sync-meta');
                return m ? m.textContent : '';
            }).join(' | ');
            const openState = modal.style.display;
            document.getElementById('ztoSyncCloseBtn').click();
            await new Promise((r) => setTimeout(r, 60));
            return {
                bannerShown: bannerShown,
                openState: openState,
                closedState: modal.style.display,
                codes: codes,
                metaText: metaText
            };
        });
        ok('លក្ខខណ្ឌចាំបាច់ ៖ របាលេចមុនចុច', tap.bannerShown, tap);
        ok('⛔ ចុចរបា ➜ ប្រអប់បើក', tap.openState === 'flex', tap);
        ok('⛔ បញ្ជីផ្ទុក **តែ** barcode ដែលមានសាលក្រម «មិនទាន់បិទ»',
            tap.codes.length === 2
            && tap.codes.indexOf('MODAL0000001') !== -1
            && tap.codes.indexOf('MODAL0000003') !== -1, tap.codes);
        ok('⛔ barcode ដែល ZTO បិទរួច មិនត្រូវលេចក្នុងបញ្ជី',
            tap.codes.indexOf('MODAL0000002') === -1, tap.codes);
        ok('⛔ ជួរនីមួយៗបង្ហាញលេខទូរស័ព្ទអតិថិជន (ងាយផ្ទៀងផ្ទាត់)',
            tap.metaText.indexOf('0967778889') !== -1, tap.metaText);
        ok('⛔ ទីតាំង Locker បង្ហាញពេលមាន', tap.metaText.indexOf('A-01') !== -1, tap.metaText);
        // ⛔ ចន្លោះដែល mutation បង្ហាញ (2.31.10) ៖ ទីតាំង Locker រស់នៅ **២
        // កម្រិត** — លើ barcode ឬលើ item។ ការវាស់ដើមដាក់វាលើ **barcode
        // តែម្យ៉ាង** ➜ mutation «ដក fallback របស់ item ចេញ» **រស់រាន**
        // (120 ok · 0 FAIL) ខណៈកញ្ចប់ដែលកំណត់ Locker នៅកម្រិត item
        // (ផ្លូវធម្មតារបស់ `assignLockerToEntry()`) នឹង **បាត់ទីតាំង** ➜
        // អ្នកប្រើរកកញ្ចប់មិនឃើញ។
        const lockerFallback = await page.evaluate(async () => {
            const item = { id: 'lk1', phone: '0961112223', locker: 'B-07', barcodes: [
                { code: 'LOCKER00000001', isClosed: true }
            ] };
            setZtoPickupVerdict('LOCKER00000001', false);
            openZtoSyncModal([item]);
            await new Promise((r) => setTimeout(r, 60));
            const meta = document.querySelector('#ztoSyncList .zto-sync-meta');
            const out = { meta: meta ? meta.textContent : '' };
            closeZtoSyncModal();
            return out;
        });
        ok('⛔ ទីតាំង Locker ដែលកំណត់នៅកម្រិត **item** ក៏ត្រូវបង្ហាញដែរ',
            lockerFallback.meta.indexOf('B-07') !== -1, lockerFallback);

        // ⛔ ចន្លោះដែល mutation បង្ហាញ (2.31.10) ៖ `ztoStatusModalSig` ជា
        // cache នៃការគូរឡើងវិញ។ បើ **N ដែលនៅសល់** មិនចូល signature នោះ
        // អត្ថបទ «កំពុងពិនិត្យបន្ត N ទៀត» **បង្កកនៅលេខចាស់** ខណៈជុំបោស
        // ដើរបន្ត — ព្រោះបញ្ជីកូដមិនប្រែ។ នេះជាច្បាប់ដដែលដែល `CLAUDE.md`
        // សរសេរសម្រាប់ **របា** រួចហើយ ➜ វាអនុវត្តលើ **បញ្ជី** ដែរ។
        // mutation «ដក `waiting` ចេញពី signature» ➜ រស់រាន (120 ok) មុនបន្ថែម។
        const noteFresh = await page.evaluate(async () => {
            const item = { id: 'nf1', phone: '0964440001', barcodes: [
                { code: 'NOTE000000001', isClosed: true },
                { code: 'NOTE000000002', isClosed: true },
                { code: 'NOTE000000003', isClosed: true }
            ] };
            setZtoPickupVerdict('NOTE000000001', false);
            openZtoSyncModal([item]);
            await new Promise((r) => setTimeout(r, 60));
            const noteEl = document.getElementById('ztoSyncModalNote');
            const before = noteEl ? noteEl.textContent : '';
            // ⛔ សាលក្រម `true` ➜ `waiting` ថយ ១ ខណៈ **បញ្ជីកូដមិនប្រែ**
            setZtoPickupVerdict('NOTE000000002', true);
            renderZtoSyncModalList([item]);
            await new Promise((r) => setTimeout(r, 30));
            const after = noteEl ? noteEl.textContent : '';
            const rows = document.querySelectorAll('#ztoSyncList .zto-sync-item').length;
            closeZtoSyncModal();
            return { before: before, after: after, rows: rows };
        });
        ok('លក្ខខណ្ឌចាំបាច់ ៖ អត្ថបទដំបូងរាយចំនួនដែលនៅសល់ពិត',
            /2/.test(noteFresh.before) && noteFresh.rows === 1, noteFresh);
        ok('⛔ អត្ថបទ «កំពុងពិនិត្យបន្ត N ទៀត» ត្រូវស្រស់ ខណៈបញ្ជីកូដមិនប្រែ',
            noteFresh.after !== noteFresh.before, noteFresh);

        ok('⛔ ចុច «បិទ» ➜ ប្រអប់បិទពិត', tap.closedState === 'none', tap);

        // ⛔ ថ្នាក់កំហុស ៖ barcode មកពី Firebase ➜ អាចផ្ទុក HTML។ បញ្ជីនេះជា
        // sink ថ្មី ➜ ត្រូវឆ្លងកាត់ `sanitizeInput()` ដូច sink ដទៃទាំងអស់។
        const xss = await page.evaluate(async () => {
            const payload = '<img src=x onerror="window.__ztoModalXss=1">';
            const item = { id: 'm2', phone: '011', barcodes: [{ code: payload, isClosed: true }] };
            setZtoPickupVerdict(payload, false);
            openZtoSyncModal([item]);
            await new Promise((r) => setTimeout(r, 80));
            const injected = document.querySelectorAll('#ztoSyncList img').length;
            const text = (document.getElementById('ztoSyncList') || {}).textContent || '';
            closeZtoSyncModal();
            return { injected: injected, fired: !!window.__ztoModalXss, hasText: text.indexOf('onerror') !== -1 };
        });
        ok('⛔ បញ្ជីមិនចាក់ HTML ចូល (គ្មាន img ថ្មី · គ្មានការរត់)',
            xss.injected === 0 && !xss.fired, xss);
        ok('លក្ខខណ្ឌចាំបាច់ ៖ អត្ថបទឆៅនៅបង្ហាញជាអក្សរ', xss.hasText, xss);

        // ⛔ ច្បាប់គម្រោង ៖ ទិន្នន័យអតិថិជនមិនត្រូវសល់ក្រោយចាកចេញ។ បញ្ជីនេះ
        // ផ្ទុក **លេខទូរស័ព្ទ** ➜ វាជា sink ថ្មីសម្រាប់ `dom-hygiene`។
        const afterLogout = await page.evaluate(async () => {
            const item = { id: 'm3', phone: '0961112223', barcodes: [{ code: 'MODAL0000009', isClosed: true }] };
            setZtoPickupVerdict('MODAL0000009', false);
            openZtoSyncModal([item]);
            await new Promise((r) => setTimeout(r, 60));
            const before = (document.getElementById('ztoSyncList') || {}).innerHTML || '';
            clearSensitiveModalFields();
            await new Promise((r) => setTimeout(r, 60));
            const modal = document.getElementById('ztoSyncModal');
            return {
                before: before.indexOf('0961112223') !== -1,
                after: (document.getElementById('ztoSyncList') || {}).innerHTML || '',
                display: modal.style.display
            };
        });
        ok('លក្ខខណ្ឌចាំបាច់ ៖ បញ្ជីពិតជាផ្ទុកលេខទូរស័ព្ទមុនចាកចេញ', afterLogout.before, afterLogout);
        ok('⛔ ចាកចេញ ➜ បញ្ជីត្រូវទទេ (គ្មានលេខអតិថិជនសល់ក្នុង DOM)',
            afterLogout.after === '', afterLogout);
        ok('⛔ ចាកចេញ ➜ ប្រអប់ត្រូវបិទ', afterLogout.display === 'none', afterLogout);

        // ⛔ ទិសផ្ទុយ ៖ Lookup មិនមែន ZTO ➜ មុខងារទាំងមូលដេកលក់ ➜ ការបើក
        // ប្រអប់ដោយកូដ មិនត្រូវបង្ហាញអ្វីទេ។
        await setup(PLAIN_URL);
        const plain = await page.evaluate(async () => {
            const item = { id: 'm4', phone: '011', barcodes: [{ code: 'MODAL0000010', isClosed: true }] };
            setZtoPickupVerdict('MODAL0000010', false);
            openZtoSyncModal([item]);
            await new Promise((r) => setTimeout(r, 60));
            const modal = document.getElementById('ztoSyncModal');
            return { display: modal.style.display };
        });
        ok('⛔ ទិសផ្ទុយ ៖ Lookup មិនមែន ZTO ➜ ប្រអប់មិនបើក',
            plain.display !== 'flex', plain);
    }

    // ── ១៦. រូប Barcode ត្រូវអានចេញវិញជា **លេខដដែល** ────────────────────
    // ⛔ ថ្នាក់កំហុសដែលថ្លៃបំផុតនៃមុខងារនេះ ៖ រូបដែលគូរខុស ➜ អ្នកប្រើស្កេនវា
    // ចូល ZTO Palm ➜ **កញ្ចប់ខុសត្រូវបិទ**។ ការអានកូដមិនអាចបញ្ជាក់តារាងលំនាំ
    // ១០៧ ធាតុ · checksum mod 103 · ការជ្រើស Code Set B/C បានទេ ➜ ត្រូវ
    // **គូរពិត រួចអានវិញដោយ ZXing ពិត** (engine ដដែលនឹងកាមេរ៉ារបស់ App)។
    console.log('\n== ១៦. រូប Barcode ➜ អានវិញដោយ ZXing ពិត ==');
    const engineReady = await page.evaluate(async () => {
        if (typeof ZXingWASM === 'undefined' || !ZXingWASM.readBarcodes) return false;
        try {
            ZXingWASM.prepareZXingModule({
                overrides: { locateFile: (f, p) => (f.endsWith('.wasm') ? './vendor/' + f : p + f) },
                fireImmediately: true
            });
        } catch (e) { return false; }
        return true;
    });
    ok('លក្ខខណ្ឌចាំបាច់ ៖ engine ZXing ពិតផ្ទុកបាន', engineReady, engineReady);

    if (engineReady && (await page.evaluate(() => typeof code128Bars)) === 'function') {
        const roundTrip = await page.evaluate(async () => {
        // ⛔ គំរូលេខ **សេស** ចាំបាច់ (2.31.10) ៖ Set C ដើរជា **គូ** ➜
        // `code128Values()` ត្រូវធ្លាក់ទៅ Set B ពេលចំនួនខ្ទង់សេស។ បើគំរូ
        // ទាំងអស់ជាលេខគូ នោះ mutation «ដក `raw.length % 2 === 0` ចេញ»
        // **រស់រាន** (វាស់បាន ៖ 113 ok · 0 FAIL) ខណៈខ្ទង់ចុងក្រោយចូល Set C
        // ជា `parseInt('7')` = 7 ➜ ចេញជាគូ `07` ➜ `1234567` អានចេញវិញជា
        // **`12345607`** ➜ ⛔ **កញ្ចប់ខុសត្រូវបិទក្នុង ZTO**។
        const SAMPLES = ['77130534020575', '11600100131126', '0123456789', '1234567', '7713053402057', 'ZTO7788123456', 'AB-12'];
            const out = [];
            for (let i = 0; i < SAMPLES.length; i++) {
                const text = SAMPLES[i];
                const drawing = code128Bars(text);
                if (!drawing) { out.push({ text: text, decoded: null, drawn: false }); continue; }
                const scale = 3;
                const height = 90;
                const c = document.createElement('canvas');
                c.width = drawing.width * scale;
                c.height = height;
                const g = c.getContext('2d', { willReadFrequently: true });
                g.fillStyle = '#fff';
                g.fillRect(0, 0, c.width, c.height);
                g.fillStyle = '#000';
                for (let b = 0; b < drawing.bars.length; b++) {
                    g.fillRect(drawing.bars[b][0] * scale, 0, drawing.bars[b][1] * scale, height);
                }
                const data = g.getImageData(0, 0, c.width, c.height);
                let decoded = '';
                try {
                    const res = await ZXingWASM.readBarcodes(data, { formats: ['Code128'], tryHarder: true, maxNumberOfSymbols: 1 });
                    decoded = (res && res.length && res[0] && res[0].text) || '';
                } catch (e) { decoded = 'ERR:' + String(e && e.message); }
                out.push({ text: text, decoded: decoded, drawn: true });
            }
            return out;
        });
        const mismatched = roundTrip.filter((r) => r.drawn && r.decoded !== r.text);
        ok('លក្ខខណ្ឌចាំបាច់ ៖ គូររូបបានពិតគ្រប់គំរូ',
            roundTrip.filter((r) => r.drawn).length === roundTrip.length, roundTrip);
        ok('⛔ រូបដែលគូរ ត្រូវអានចេញវិញជា **លេខដដែលបេះបិទ** (Code Set B និង C)',
            mismatched.length === 0, mismatched);
        ok('លក្ខខណ្ឌចាំបាច់ ៖ គំរូគ្រប ១៤ ខ្ទង់ពិតរបស់ ZTO',
            roundTrip.some((r) => r.text === '77130534020575' && r.decoded === r.text), roundTrip[0]);

        // ⛔ probe ទិសផ្ទុយ ៖ បើអ្នកវាស់ «អានចេញវិញដដែល» ដោយចៃដន្យបៃតង
        // (ឧ. decoder ត្រឡប់ input) នោះការបំភ្លៃរូបមួយបន្ទាត់ត្រូវនៅតែធ្លាក់។
        const poisoned = await page.evaluate(async () => {
            const drawing = code128Bars('77130534020575');
            const scale = 3;
            const c = document.createElement('canvas');
            c.width = drawing.width * scale; c.height = 90;
            const g = c.getContext('2d', { willReadFrequently: true });
            g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
            g.fillStyle = '#000';
            for (let b = 0; b < drawing.bars.length; b++) {
                const w = b === 3 ? drawing.bars[b][1] + 1 : drawing.bars[b][1];
                g.fillRect(drawing.bars[b][0] * scale, 0, w * scale, 90);
            }
            const data = g.getImageData(0, 0, c.width, c.height);
            try {
                const res = await ZXingWASM.readBarcodes(data, { formats: ['Code128'], tryHarder: true, maxNumberOfSymbols: 1 });
                return (res && res.length && res[0] && res[0].text) || '';
            } catch (e) { return ''; }
        });
        // ⛔ ចន្លោះដែល mutation បង្ហាញ (2026-09-10) ៖ ការដក **quiet zone**
        // ចេញទាំងស្រុង **រស់រាន** ការអានវិញដោយ ZXing — ព្រោះ ZXing ធូរ ហើយ
        // canvas របស់តេស្តមានទំហំត្រូវនឹងរូបបេះបិទ។ ⛔ តែម៉ាស៊ីនស្កេនដៃពិត
        // (ZTO Palm) ត្រូវការចន្លោះស ១០ module ក្នុងមួយចំហៀងតាមស្តង់ដារ ➜
        // ការវាស់ត្រូវជា **រចនាសម្ព័ន្ធ** មិនមែនតាមការអានវិញ។
        const quiet = await page.evaluate(() => {
            const d = code128Bars("77130534020575");
            const last = d.bars[d.bars.length - 1];
            return { firstX: d.bars[0][0], lastEnd: last[0] + last[1], width: d.width };
        });
        ok("⛔ quiet zone ខាងឆ្វេង >= ១០ module", quiet.firstX >= 10, quiet);
        ok("⛔ quiet zone ខាងស្តាំ >= ១០ module", quiet.width - quiet.lastEnd >= 10, quiet);
        ok('⛔ probe ទិសផ្ទុយ ៖ រូបដែលបំភ្លៃ មិនត្រូវអានចេញជាលេខដដែល',
            poisoned !== '77130534020575', poisoned);

        // ⛔ រូបក្នុងប្រអប់ត្រូវដេរីវេពី `code128Bars()` ដដែល — មិនមែនផ្លូវទី ២
        // (ផ្លូវ ២ = ថ្ងៃណាមួយវាឃ្លាតគ្នា ហើយអ្នកយាមខាងលើមើលមិនឃើញ)។
        await setup(ZTO_URL);
        const inModal = await page.evaluate(async () => {
            const code = '77130534020575';
            const item = { id: 'bc1', phone: '011', barcodes: [{ code: code, isClosed: true }] };
            setZtoPickupVerdict(code, false);
            openZtoSyncModal([item]);
            await new Promise((r) => setTimeout(r, 80));
            const svg = document.querySelector('#ztoSyncList .zto-sync-bc');
            const rects = svg ? svg.querySelectorAll('rect').length : 0;
            const viewBox = svg ? svg.getAttribute('viewBox') : '';
            const drawing = code128Bars(code);
            closeZtoSyncModal();
            return {
                rects: rects,
                viewBox: viewBox,
                wantRects: drawing.bars.length,
                wantViewBox: '0 0 ' + drawing.width + ' 60'
            };
        });
        ok('⛔ ប្រអប់គូររូប Barcode ពិត (មិនត្រឹមអក្សរ)', inModal.rects > 20, inModal);
        ok('⛔ របារបស់រូបក្នុងប្រអប់ = លទ្ធផលរបស់ code128Bars() បេះបិទ',
            inModal.rects === inModal.wantRects && inModal.viewBox === inModal.wantViewBox, inModal);
    } else {
        ok('⛔ វាស់រូប Barcode មិនបាន — code128Bars ឬ engine មិនមាន', false, engineReady);
    }

    // ── ១៧. សោ PIN ➜ ជុំបោសមិនត្រូវបាញ់សំណើដែលធ្លាក់ជានិច្ច ────────────
    // ⛔ សោសម្ងាត់របស់ ZTO (`headerValueEnc`) ស្រាយបានតែក្រោយអ្នកប្រើវាយ PIN។
    // មុននោះ `buildLookupRequestHeaders()` ត្រឡប់ header **ទទេ** ➜ Function
    // ឆ្លើយ 401 ជានិច្ច ➜ ជុំបោសបាញ់ ១០ សំណើរាល់ ២០ វិ. ដែល **មិនអាចជោគជ័យ
    // បានទេ**។ ផ្លូវស្កេនធម្មតាមានច្រកទ្វារនេះរួចហើយ (`attemptAutoLookup`)
    // ➜ ជុំបោសត្រូវមានដូចគ្នា។ ⛔ ហើយការចុចរបស់អ្នកប្រើត្រូវប្រាប់ **មូលហេតុ
    // ពិត** — «សូមសាកម្ដងទៀត» ជាសារកុហក ព្រោះការសាកម្ដងទៀតធ្លាក់ដដែល។
    console.log('\n== ១៧. សោ PIN ➜ ជុំបោសមិនបាញ់សំណើឥតប្រយោជន៍ ==');
    const lockedGate = await page.evaluate(async () => {
        const item = { id: 'p1', phone: '011', barcodes: [{ code: 'LOCK00000001', isClosed: true }] };
        const base = 'https://example.invalid/.netlify/functions/zto-order-detail?barcode={barcode}';
        const run = async (cfg) => {
            localStorage.setItem('zoew_lookup_api_config', JSON.stringify(cfg));
            document.querySelectorAll('.modal').forEach((m) => { m.style.display = 'none'; });
            clearZtoPickupStatusStore();
            let calls = 0;
            const real = window.fetchWithTimeout;
            window.fetchWithTimeout = async () => {
                calls++;
                return { res: { ok: true, status: 200 }, body: { ztoClosed: false } };
            };
            let measured = 0;
            try { measured = await runZtoStatusSweep(true, [item], []); } finally { window.fetchWithTimeout = real; }
            return { calls: calls, measured: measured };
        };
        const locked = await run({
            enabled: true, url: base,
            headerName: 'X-Zoe-Proxy-Key',
            headerValueEnc: { data: [1, 2, 3], iv: [4, 5, 6] }
        });
        const unlocked = await run({ enabled: true, url: base });
        return { locked: locked, unlocked: unlocked };
    });
    ok('⛔ សោ PIN មិនទាន់ដោះ ➜ ជុំបោសបាញ់ **០** សំណើ',
        lockedGate.locked.calls === 0 && lockedGate.locked.measured === 0, lockedGate.locked);
    ok('ទិសផ្ទុយ ៖ គ្មានសោអ៊ិនគ្រីប ➜ ជុំបោសដើរធម្មតា',
        lockedGate.unlocked.calls > 0 && lockedGate.unlocked.measured > 0, lockedGate.unlocked);

    const lockedToast = await page.evaluate(async () => {
        localStorage.setItem('zoew_lookup_api_config', JSON.stringify({
            enabled: true,
            url: 'https://example.invalid/.netlify/functions/zto-order-detail?barcode={barcode}',
            headerName: 'X-Zoe-Proxy-Key',
            headerValueEnc: { data: [1, 2, 3], iv: [4, 5, 6] }
        }));
        document.querySelectorAll('.toast-container').forEach((c) => { c.innerHTML = ''; });
        let calls = 0;
        const real = window.fetchWithTimeout;
        window.fetchWithTimeout = async () => { calls++; return { res: { ok: true, status: 200 }, body: {} }; };
        try { await recheckZtoPickupStatus(); } finally { window.fetchWithTimeout = real; }
        await new Promise((r) => setTimeout(r, 60));
        const box = document.querySelector('.toast-container');
        const text = box ? box.textContent : '';
        document.querySelectorAll('.modal').forEach((m) => { m.style.display = 'none'; });
        return { text: text, calls: calls };
    });
    ok('⛔ ការចុចខណៈសោជាប់ ➜ សារប្រាប់ថាត្រូវវាយ PIN',
        lockedToast.text.indexOf('PIN') !== -1, lockedToast);
    ok('⛔ សារមិនត្រូវនិយាយ «សូមសាកម្ដងទៀត» (ការសាកម្ដងទៀតធ្លាក់ដដែល)',
        lockedToast.text.indexOf('សូមសាកម្ដងទៀត') === -1, lockedToast);
    ok('⛔ ការចុចខណៈសោជាប់ ➜ មិនបាញ់សំណើសោះ', lockedToast.calls === 0, lockedToast);

    // ── ១៨. ការដោះសោ App Lock ត្រូវដោះសោ ZTO Lookup ដែរ ─────────────────
    // ⛔ ស្នាមភ្ជាប់ ៖ `completeAppUnlock(pin)` ជាផ្លូវ **តែមួយ** សម្រាប់ទាំង
    // ការវាយ PIN និងជីវមាត្រ (ជីវមាត្រត្រឹមតែ *រុំ PIN ទុក* ➜ វាស្រាយ PIN
    // ចេញ ផ្ទៀងផ្ទាត់នឹង `zoew_security_pin_hash` រួចហៅ function ដដែល)។
    // បើថ្ងៃណាវាឈប់កំណត់ `lookupSecretKey` នោះអ្នកប្រើដែលដោះសោ App Lock
    // រួច នឹងនៅតែឃើញ «🔒 សូមវាយ PIN» លើ ZTO Lookup ដោយគ្មានហេតុផល។
    console.log('\n== ១៨. ដោះសោ App Lock ➜ ដោះសោ ZTO Lookup ដែរ ==');
    const seamReady = await page.evaluate(() => ({
        gate: typeof ztoStatusSecretIsLocked === 'function',
        unlock: typeof completeAppUnlock === 'function'
    }));
    ok('លក្ខខណ្ឌចាំបាច់ ៖ `ztoStatusSecretIsLocked` និង `completeAppUnlock` មានពិត',
        seamReady.gate && seamReady.unlock, seamReady);
    const unlockSeam = (seamReady.gate && seamReady.unlock) ? await page.evaluate(async () => {
        const cfg = {
            enabled: true,
            url: 'https://example.invalid/.netlify/functions/zto-order-detail?barcode={barcode}',
            headerName: 'X-Zoe-Proxy-Key',
            headerValueEnc: { data: [1, 2, 3], iv: [4, 5, 6] }
        };
        const before = ztoStatusSecretIsLocked(cfg);
        let threw = '';
        try { await completeAppUnlock('123456'); } catch (e) { threw = String(e && e.message); }
        const after = ztoStatusSecretIsLocked(cfg);
        document.querySelectorAll('.modal').forEach((m) => { m.style.display = 'none'; });
        return { before: before, after: after, threw: threw };
    }) : { before: null, after: null, threw: 'មិនមាន function' };
    ok('លក្ខខណ្ឌចាំបាច់ ៖ មុនដោះសោ សោពិតជាជាប់', unlockSeam.before === true, unlockSeam);
    ok('⛔ `completeAppUnlock()` ត្រូវដោះសោ ZTO Lookup ដែរ',
        unlockSeam.after === false, unlockSeam);
    ok('⛔ ការដោះសោមិនត្រូវបោះកំហុស', unlockSeam.threw === '', unlockSeam);

    // ⛔ ជីវមាត្រមិនមែនផ្លូវទី ២ ៖ វាត្រូវហូរតាម `completeAppUnlock` ដដែល
    // (បើវាមានផ្លូវផ្ទាល់ខ្លួន នោះការកែម្ខាងនឹងភ្លេចម្ខាង)។
    ok('⛔ ផ្លូវជីវមាត្រហូរតាម `completeAppUnlock` ដដែល',
        (APP_SRC.match(/completeAppUnlock\(/g) || []).length >= 3
        && /biometricUnlockPin\(\)[\s\S]{0,900}completeAppUnlock\(/.test(APP_SRC),
        (APP_SRC.match(/completeAppUnlock\(/g) || []).length);

    // ── ១៩. បញ្ជីត្រូវស្រស់ *ខណៈប្រអប់នៅបើក* ─────────────────────────────
    // ⛔ ចន្លោះការគ្រប ៖ ការចុច «ពិនិត្យម្តងទៀត» កើតឡើង **ខណៈប្រអប់បើក** ➜
    // (១) `isModalOpen` ជា `true` ➜ ច្រកទ្វារ `ztoStatusNetworkAllowed` ត្រូវ
    // អនុញ្ញាតវា ព្រោះវាជា **ការចុចរបស់អ្នកប្រើ** (`force`); បើអត់ ➜ toast រាយ
    // «សូមសាកម្ដងទៀត» ខណៈការសាកម្ដងទៀតធ្លាក់ដដែល = សារកុហក។ (២) ជួរដេកដែល
    // ZTO បិទរួច ត្រូវ **ធ្លាក់ចេញភ្លាម** ដោយមិនបាច់បិទ-បើកប្រអប់ឡើងវិញ។
    console.log("\n== ១៩. បញ្ជីស្រស់ខណៈប្រអប់នៅបើក ==");
    await setup(ZTO_URL);
    const liveRefresh = await page.evaluate(async () => {
        const item = { id: "live1", phone: "011", barcodes: [
            { code: "LIVE00000001", isClosed: true },
            { code: "LIVE00000002", isClosed: true }
        ] };
        setZtoPickupVerdict("LIVE00000001", false);
        setZtoPickupVerdict("LIVE00000002", false);
        openZtoSyncModal([item]);
        await new Promise((r) => setTimeout(r, 60));
        const rowsBefore = document.querySelectorAll("#ztoSyncList .zto-sync-item").length;
        const openBefore = document.getElementById("ztoSyncModal").style.display;
        let calls = 0;
        const real = window.fetchWithTimeout;
        window.fetchWithTimeout = async (url) => {
            calls++;
            const closed = String(url).indexOf("LIVE00000001") !== -1;
            return { res: { ok: true, status: 200 }, body: { ztoClosed: closed } };
        };
        let measured = 0;
        try { measured = await runZtoStatusSweep(true, [item], []); } finally { window.fetchWithTimeout = real; }
        await new Promise((r) => setTimeout(r, 60));
        const rowsAfter = Array.from(document.querySelectorAll("#ztoSyncList .zto-sync-item"))
            .map((el) => { const c = el.querySelector(".zto-sync-code"); return c ? c.textContent.trim() : ""; });
        const stillOpen = document.getElementById("ztoSyncModal").style.display;
        closeZtoSyncModal();
        return {
            rowsBefore: rowsBefore, openBefore: openBefore, calls: calls,
            measured: measured, rowsAfter: rowsAfter, stillOpen: stillOpen
        };
    });
    ok("លក្ខខណ្ឌចាំបាច់ ៖ ប្រអប់បើកជាមួយជួរដេក ២", liveRefresh.openBefore === "flex" && liveRefresh.rowsBefore === 2, liveRefresh);
    ok("⛔ ការចុចខណៈប្រអប់បើក ➜ សំណើត្រូវចេញពិត (`isModalOpen` មិនទប់ការចុច)",
        liveRefresh.calls === 2 && liveRefresh.measured === 2, liveRefresh);
    ok("⛔ Barcode ដែល ZTO បិទរួច ត្រូវធ្លាក់ចេញភ្លាម ដោយមិនបាច់បើកឡើងវិញ",
        liveRefresh.rowsAfter.length === 1 && liveRefresh.rowsAfter[0] === "LIVE00000002", liveRefresh);
    ok("⛔ ប្រអប់មិនត្រូវបិទដោយខ្លួនឯងអំឡុងការធ្វើឲ្យស្រស់", liveRefresh.stillOpen === "flex", liveRefresh);

    // ── ២០. ប្រអប់ត្រូវសមគ្រប់ទំហំអេក្រង់ ─────────────────────────────────
    // ⛔ សំណើអ្នកប្រើ ៖ «សាង modal អោយស្របតាមគ្រប់ទំហំអេក្រង»។ ការវាស់ត្រូវជា
    // **ការហៀរពិត** មិនមែនការអានកូដ CSS ៖ រូប Barcode មាន `viewBox` ធំ
    // (~១៣២ module) ➜ បើ CSS ណាមួយបាត់ វានឹងលាតប្រអប់ចេញក្រៅអេក្រង់។
    console.log("\n== ២០. ប្រអប់សមគ្រប់ទំហំអេក្រង់ ==");
    const WIDTHS = [320, 360, 412, 768, 1280];
    const fitRows = [];
    for (let w = 0; w < WIDTHS.length; w++) {
        await page.setViewportSize({ width: WIDTHS[w], height: 760 });
        const fit = await page.evaluate(async () => {
            const codes = ["77130534020575", "AB-1234567890XY", "0123456789012345678901234"];
            const item = { id: "fit1", phone: "0964310697", barcodes: codes.map((c) => ({ code: c, isClosed: true, locker: "A-01" })) };
            codes.forEach((c) => setZtoPickupVerdict(c, false));
            openZtoSyncModal([item]);
            await new Promise((r) => setTimeout(r, 80));
            const modal = document.getElementById("ztoSyncModal");
            const box = modal.querySelector(".modal-content");
            const list = document.getElementById("ztoSyncList");
            const svgs = Array.from(list.querySelectorAll(".zto-sync-bc"));
            const wraps = Array.from(list.querySelectorAll(".zto-sync-bc-wrap"));
            const out = {
                vw: window.innerWidth,
                docOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
                boxOverflow: box.scrollWidth - box.clientWidth,
                boxRight: Math.round(box.getBoundingClientRect().right),
                boxLeft: Math.round(box.getBoundingClientRect().left),
                listScrolls: list.scrollHeight > list.clientHeight + 1,
                svgCount: svgs.length,
                svgWide: svgs.filter((el, i) => el.getBoundingClientRect().width > wraps[i].getBoundingClientRect().width + 1).length,
                svgTooThin: svgs.filter((el) => el.getBoundingClientRect().width < 120).length,
                svgTall: svgs.filter((el) => el.getBoundingClientRect().height < 40).length,
                bc: Array.from(list.querySelectorAll(".zto-sync-item")).map((it) => {
                    const el = it.querySelector(".zto-sync-bc");
                    const codeEl = it.querySelector(".zto-sync-code");
                    const vb = el ? String(el.getAttribute("viewBox") || "").trim().split(/\s+/) : [];
                    const modules = Number(vb[2]) || 0;
                    const w = el ? el.getBoundingClientRect().width : 0;
                    return {
                        code: codeEl ? String(codeEl.textContent || "") : "",
                        modules: modules,
                        px: modules ? Number((w / modules).toFixed(3)) : 0
                    };
                })
            };
            closeZtoSyncModal();
            return out;
        });
        fitRows.push(Object.assign({ w: WIDTHS[w] }, fit));
    }
    await page.setViewportSize({ width: 412, height: 800 });
    ok("លក្ខខណ្ឌចាំបាច់ ៖ រូប Barcode គូរពិតគ្រប់ទទឹង",
        fitRows.every((r) => r.svgCount === 3), fitRows);
    ok("⛔ ទំព័រមិនត្រូវរមូរផ្តេក លើទទឹងណាមួយ",
        fitRows.every((r) => r.docOverflow <= 0), fitRows.filter((r) => r.docOverflow > 0));
    ok("⛔ ប្រអប់មិនត្រូវហៀរខាងក្នុង (គ្មានការរមូរផ្តេក)",
        fitRows.every((r) => r.boxOverflow <= 1), fitRows.filter((r) => r.boxOverflow > 1));
    ok("⛔ ប្រអប់ត្រូវនៅក្នុងអេក្រង់ទាំងស្រុង",
        fitRows.every((r) => r.boxLeft >= 0 && r.boxRight <= r.vw), fitRows.filter((r) => r.boxLeft < 0 || r.boxRight > r.vw));
    ok("⛔ រូប Barcode មិនត្រូវលើសក្របរបស់វា",
        fitRows.every((r) => r.svgWide === 0), fitRows.filter((r) => r.svgWide > 0));
    ok("⛔ រូបមិនត្រូវតូចជាង 120×40px (ព្រំដែនអប្បបរមានៃការបង្ហាញ)",
        fitRows.every((r) => r.svgTooThin === 0 && r.svgTall === 0), fitRows.filter((r) => r.svgTooThin || r.svgTall));

    // ⛔ ចន្លោះដែលវាស់បាន (2.31.10) ៖ **ទទឹងសរុបមិនមែនជារង្វាស់នៃភាព
    // ស្កេនបានទេ** — អ្វីដែលសម្រេចគឺ **ទទឹងក្នុងមួយ module**។ រូបលាតពេញ
    // ក្របជានិច្ច (`width: 100%` + `preserveAspectRatio: none`) ➜ លេខវែង
    // ជាង ចែកទទឹងដដែលជា module ច្រើនជាង ➜ របានីមួយៗស្តើងជាង។ វាស់បាន ៖
    // លេខ ២៥ ខ្ទង់ (៣៣០ module) ធ្លាក់ត្រឹម **0.77px/module** នៅ 320px
    // ➜ ស្នាមប្រផេះ ស្កេនមិនចេញ — ខណៈការអះអាង «ធំល្មមស្កេនបាន» ខាងលើ
    // រាយ ✅ ព្រោះទទឹងសរុប > 120px។ ⛔ នោះជា «✅ លើអ្វីដែលមិនបានវាស់»។
    // ពិដាន 1.5px ដេរីវេពីស្តង់ដារ X-dimension ~0.25mm (1 CSS px ≈ 0.15mm
    // លើទូរស័ព្ទ ➜ 0.25mm ≈ 1.7px) ដោយទុករង្វាន់សុវត្ថិភាពបន្តិច។
    // ⛔ ការអះអាងគ្របតែប្រវែងដែលប្រព័ន្ធនេះ **ពិតជាផលិត** ៖ Waybill ZTO
    // ជា **១២–១៤ ខ្ទង់** (គំរូពិត `77130534020575`) ➜ ១៤ ជាពិដាន។ វាមិនមែន
    // លេខដែលជ្រើសឲ្យតេស្តបៃតងទេ — វាជាប្រវែងដែលឯកសារ ZTO និងគំរូពិត
    // របស់ការវាស់នេះប្រើ។ វាស់បាន ៖ ១៤ ខ្ទង់ ➜ ១៣២ module ➜ **>= 1.5px
    // គ្រប់ទទឹង ៣២០–១២៨០**។
    // ⚠️ **ព្រំដែនដែលវាស់បាន ហើយ *មិន* បានកែ** ៖ លេខ **១៥ តួឡើងទៅ**
    // (>= ២២០ module) ធ្លាក់ត្រឹម **0.99px/module នៅ 320px** · 1.20px នៅ
    // 412px ➜ ស្កេនពីអេក្រង់មិនចេញ។ វាមិនអាចកែដោយ CSS បានទេ ៖ ២២០ module
    // × 1.5px = **330px** ធំជាងអេក្រង់ 320px ទាំងមូល។ ផ្លូវចេញធម្មជាតិ
    // មានរួចហើយ ៖ ប្រអប់បង្ហាញ **លេខជាអក្សរ monospace** ខាងលើរូបជានិច្ច
    // ➜ វាយចូល Palm ដោយដៃបាន។ ⛔ គ្មានភស្តុតាងថាអាជីវកម្មនេះមានលេខបែបនោះ
    // ➜ **កុំសាង UI ថ្មីលើការសង្ស័យ** (ច្បាប់គម្រោង) — បើថ្ងៃណាអ្នកប្រើ
    // រាយការណ៍លេខវែង នោះទើបជាពេលកែ ហើយលេខនៅទីនេះជាចំណុចចាប់ផ្តើម។
    // ⛔ ចន្លោះទី ៨ ដែល mutation បង្ហាញ (2.31.10) ៖ mutation ដែលធ្វើឲ្យ
    // `.zto-sync-modal-content { max-width }` **តូចជាងមុនច្រើន** មិនប្តូរ
    // ការវាស់អ្វីសោះ ➜ ការប្រកាសនោះ **ស្លាប់ស្ងាត់ៗ** ៖ វាឈរ **មុន**
    // `.modal-content` ក្នុងឯកសារដដែល ដោយ specificity **ស្មើ** (class ១
    // ដូចគ្នា) ➜ **លំដាប់សម្រេច** ➜ ច្បាប់ទូទៅឈ្នះ។ នេះជាច្បាប់ CSS
    // invariant ដែលមានក្នុង `CLAUDE.md` រួចហើយ («ការសរសេរជាន់ត្រូវឈរក្រោយ
    // វា ឬបង្កើន specificity»)។ រាល់ការសរសេរជាន់ដទៃរបស់ modal ក្នុងឯកសារ
    // នេះ (`.trash-modal-content` · `.scan-remove-modal-content` · `#…
    // .modal-content`) ឈរ **ក្រោយ** ➜ មានតែជួរ ZTO ដែលខុស។
    // ⛔ អះអាងលើ **តម្លៃដែលគណនាចេញពិត** ដោយ **ដេរីវេពី CSS** ទាំង ២ ជួរ
    // (មិនចាក់ literal) បូក probe ថាតម្លៃទាំង ២ **ខុសគ្នាពិត** — បើដូចគ្នា
    // នោះការអះអាងបៃតងដោយចៃដន្យ។
    {
        const clampOf = (sel) => {
            const re = new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{[^}]*max-width:\\s*clamp\\(([^)]*)\\)');
            const m = re.exec(CSS_SRC);
            if (!m) return null;
            const parts = m[1].split(',').map((x) => x.trim());
            return parts.length === 3 ? parts : null;
        };
        const px = (v, vw) => (/vw$/.test(v) ? (parseFloat(v) / 100) * vw : parseFloat(v));
        const evalClamp = (parts, vw) => Math.min(Math.max(px(parts[0], vw), px(parts[1], vw)), px(parts[2], vw));
        const ztoClamp = clampOf('.zto-sync-modal-content');
        const genericClamp = clampOf('.modal-content');
        ok('លក្ខខណ្ឌចាំបាច់ ៖ អាន max-width ទាំង ២ ជួរចេញពី style.css បាន',
            !!(ztoClamp && genericClamp), { ztoClamp: ztoClamp, genericClamp: genericClamp });
        if (ztoClamp && genericClamp) {
            const VW = 1280;
            const want = evalClamp(ztoClamp, VW);
            const generic = evalClamp(genericClamp, VW);
            ok('លក្ខខណ្ឌចាំបាច់ ៖ ជួរ ZTO និងជួរទូទៅផ្តល់តម្លៃខុសគ្នានៅ ' + VW + 'px',
                Math.abs(want - generic) > 1, { want: want, generic: generic });
            await page.setViewportSize({ width: VW, height: 800 });
            const applied = await page.evaluate(async () => {
                const item = { id: 'css1', phone: '011', barcodes: [{ code: '77130534020575', isClosed: true }] };
                setZtoPickupVerdict('77130534020575', false);
                openZtoSyncModal([item]);
                await new Promise((r) => setTimeout(r, 60));
                const box = document.querySelector('#ztoSyncModal .modal-content');
                const cs = getComputedStyle(box);
                const out = { maxWidth: parseFloat(cs.maxWidth), textAlign: cs.textAlign };
                closeZtoSyncModal();
                return out;
            });
            await page.setViewportSize({ width: 412, height: 800 });
            ok('⛔ ការប្រកាស `max-width` របស់ប្រអប់ ZTO ត្រូវ **ឈ្នះ** មិនស្លាប់ស្ងាត់ៗ',
                Math.abs(applied.maxWidth - want) <= 1, { applied: applied.maxWidth, want: want, generic: generic });
            const wantAlign = /\.zto-sync-modal-content\s*\{[^}]*text-align:\s*([a-z]+)/.exec(CSS_SRC);
            ok('លក្ខខណ្ឌចាំបាច់ ៖ អាន text-align របស់ជួរ ZTO បាន', !!wantAlign, wantAlign && wantAlign[1]);
            if (wantAlign) {
                ok('⛔ ការប្រកាស `text-align` របស់ប្រអប់ ZTO ត្រូវ **ឈ្នះ** ដែរ',
                    applied.textAlign === wantAlign[1], { applied: applied.textAlign, want: wantAlign[1] });
            }
        }
    }

    const SCAN_MIN_MODULE_PX = 1.5;
    const REALISTIC_CODE_MAX = 14;
    const realistic = [];
    fitRows.forEach((r) => {
        (r.bc || []).forEach((b) => {
            if (b.code && b.code.length <= REALISTIC_CODE_MAX) realistic.push({ w: r.w, code: b.code, modules: b.modules, px: b.px });
        });
    });
    ok("លក្ខខណ្ឌចាំបាច់ ៖ វាស់ទទឹងក្នុងមួយ module បានពិត",
        realistic.length >= WIDTHS.length && realistic.every((b) => b.modules > 0 && b.px > 0), realistic);
    ok("⛔ រូបរបស់លេខដែលប្រព័ន្ធផលិតពិត ត្រូវ >= " + SCAN_MIN_MODULE_PX + "px ក្នុងមួយ module",
        realistic.every((b) => b.px >= SCAN_MIN_MODULE_PX),
        realistic.filter((b) => b.px < SCAN_MIN_MODULE_PX));

    // ── ២១. បញ្ជីមិនត្រូវសាងឡើងវិញដោយឥតប្រយោជន៍ ─────────────────────────
    // ⛔ ជុំបោសហៅការគូរឡើងវិញ **ក្នុងមួយ barcode ដែលវាស់បាន** (ដល់ ១០ ដង
    // ក្នុងមួយជុំ)។ ការសាង `innerHTML` ឡើងវិញរាល់ដង ➜ (ក) **ទីតាំងរមូរលោត
    // ត្រឡប់ទៅកំពូល** ខណៈអ្នកប្រើកំពុងអានបញ្ជីដើម្បីស្កេន · (ខ) វាស់បាន
    // **៣៥ms ក្នុងមួយដង** នៅពិដាន ៣០០ ជួរ (លើសពិដានស៊ុមវែង)។ របាមាន
    // `ztoStatusBannerSig` រួចហើយ ➜ បញ្ជីត្រូវមានលំនាំដដែល។
    console.log("\n== ២១. បញ្ជីមិនសាងឡើងវិញដោយឥតប្រយោជន៍ ==");
    await setup(ZTO_URL);
    const rebuild = await page.evaluate(async () => {
        const mk = (n) => {
            const barcodes = [];
            for (let i = 0; i < n; i++) barcodes.push({ code: "SIG" + String(100000 + i), isClosed: true });
            return [{ id: "sig1", phone: "011", barcodes: barcodes }];
        };
        const items = mk(12);
        items[0].barcodes.forEach((b) => setZtoPickupVerdict(b.code, false));
        openZtoSyncModal(items);
        await new Promise((r) => setTimeout(r, 60));
        const list = document.getElementById("ztoSyncList");
        const first = list.firstElementChild;
        first.setAttribute("data-probe", "1");
        renderZtoSyncModalList(items, []);
        renderZtoSyncModalList(items, []);
        const survived = list.firstElementChild === first && list.firstElementChild.getAttribute("data-probe") === "1";
        // ការប្តូរពិត ➜ ត្រូវសាងឡើងវិញ
        setZtoPickupVerdict(items[0].barcodes[0].code, true);
        renderZtoSyncModalList(items, []);
        const rebuilt = list.firstElementChild !== first;
        const rowsNow = list.querySelectorAll(".zto-sync-item").length;
        closeZtoSyncModal();
        return { survived: survived, rebuilt: rebuilt, rowsNow: rowsNow };
    });
    ok("⛔ ទិន្នន័យដដែល ➜ បញ្ជីមិនសាងឡើងវិញ (node ដដែលនៅរស់)", rebuild.survived === true, rebuild);
    ok("ទិសផ្ទុយ ៖ សាលក្រមប្តូរ ➜ បញ្ជីត្រូវសាងឡើងវិញពិត",
        rebuild.rebuilt === true && rebuild.rowsNow === 11, rebuild);

    ok('⛔ គ្មានកំហុស runtime អំឡុងការវាស់', errors.length === 0, errors.slice(0, 3));

    await browser.close();
    server.close();
    console.log('\nសរុប ៖ ' + pass + ' ok, ' + fail + ' FAIL');
    process.exit(fail ? 1 : 0);
})();
