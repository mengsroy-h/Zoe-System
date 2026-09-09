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
ok('⛔ សាលក្រមមិនចូល Firebase (គ្មានផ្លូវសរសេរ)',
    APP_SRC.indexOf('zoew_zto_pickup_status_v1') !== -1
    && APP_SRC.indexOf("ref(db, `zoew_zto_pickup") === -1);

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

    ok('⛔ គ្មានកំហុស runtime អំឡុងការវាស់', errors.length === 0, errors.slice(0, 3));

    await browser.close();
    server.close();
    console.log('\nសរុប ៖ ' + pass + ' ok, ' + fail + ' FAIL');
    process.exit(fail ? 1 : 0);
})();
