let chromium;
try { chromium = require('playwright-core').chromium; } catch (e) {
    console.log('SKIP — ត្រូវការ playwright-core (npm i playwright-core)'); process.exit(0);
}
const fs = require('fs'); const http = require('http'); const path = require('path');
const CHROME = process.env.SETUPLINK_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
if (!fs.existsSync(CHROME)) { console.log('SKIP — រកមិនឃើញ Chromium នៅ ' + CHROME); process.exit(0); }

const ROOT = process.env.SETUPLINK_APP_DIR || path.join(__dirname, '..');
let pass = 0, fail = 0;
function ok(cond, label, got) {
    if (cond) { pass++; console.log('   ok    ' + label); }
    else { fail++; console.log('   FAIL  ' + label + (got !== undefined ? '  ➜ ' + JSON.stringify(got) : '')); }
}

const TYPES = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.json':'application/json', '.wasm':'application/wasm' };
function serve(dir) { return new Promise((res) => { const s = http.createServer((req, rsp) => {
    let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
    const f = path.join(dir, p);
    if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); return rsp.end(); }
    rsp.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'text/plain' }); rsp.end(fs.readFileSync(f));
}); s.listen(0, '127.0.0.1', () => res(s)); }); }

const CONFIG = { apiKey: 'AIzaFAKE', authDomain: 'biz-a.firebaseapp.com',
    databaseURL: 'https://biz-a-default-rtdb.firebaseio.com', projectId: 'biz-a',
    storageBucket: 'biz-a.appspot.com', messagingSenderId: '1', appId: '1:1:web:1' };
const PAYLOAD = Buffer.from(JSON.stringify(CONFIG)).toString('base64');

const SEL = {
    ZoeW: { pin: '#newSecurityPinInput', confirm: '#confirmSecurityPinInput', config: '#firebaseConfigInput' }
};

(async () => {
    const browser = await chromium.launch({ executablePath: CHROME });
    for (const app of ['ZoeW']) {
        const sel = SEL[app];
        const server = await serve(path.join(ROOT, app));
        const port = server.address().port;
        const ctx = await browser.newContext({ viewport: { width: 412, height: 780 } });
        const page = await ctx.newPage();
        const errs = [];
        page.on('pageerror', (e) => errs.push(e.message));
        await page.addInitScript(`window.addEventListener('unhandledrejection', function (ev) {
                    var m; try { m = String((ev.reason && (ev.reason.message || ev.reason)) || 'unknown'); } catch (x) { m = 'unknown'; }
                    setTimeout(function () { throw new Error('unhandledrejection: ' + m); }, 0);
                });`);
        await page.route('**', (r) => r.request().url().startsWith('http://127.0.0.1:' + port) ? r.continue() : r.abort());

        console.log('\n=== ' + app + ' — Setup Link លើឧបករណ៍ថ្មី ===');
        await page.goto('http://127.0.0.1:' + port + '/?setup=' + PAYLOAD, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1500);

        ok(!page.url().includes('setup='), 'query string ត្រូវបានលុប (config មិនលេចក្នុងប្រវត្តិ)');

        const openModals = () => page.evaluate(() =>
            [...document.querySelectorAll('.modal')].filter((m) => getComputedStyle(m).display !== 'none').map((m) => m.id));
        const before = await openModals();
        ok(before.includes('pinSetupModal') || before.includes('pinModal'),
            'Setup Link ឆ្លងកាត់ PIN gate មិនរក្សាទុកដោយផ្ទាល់', before);

        await page.fill(sel.pin, '123456');
        if (await page.$(sel.confirm)) await page.fill(sel.confirm, '123456');
        await (await page.$('#pinSetupSaveBtn')).click();
        await page.waitForTimeout(1200);

        const after = await openModals();
        ok(after.includes('configModal'), 'ក្រោយកំណត់ PIN ➜ ប្រអប់ Config បើក', after);

        const filled = await page.evaluate((s) => { const e = document.querySelector(s); return e ? e.value : null; }, sel.config);
        let parsedOk = false;
        try { parsedOk = !!filled && JSON.parse(filled).projectId === 'biz-a'; } catch (e) {}
        ok(parsedOk, 'Config របស់អាជីវកម្មត្រូវបានបំពេញស្វ័យប្រវត្តិ', (filled || '').slice(0, 60));

        const saved = await page.evaluate(() => localStorage.getItem('zoew_firebase_config'));
        ok(!saved, 'មិនរក្សាទុករហូតដល់មនុស្សចុច Save');
        ok(errs.length === 0, 'គ្មានកំហុស runtime កំឡុងផ្លូវនេះ', errs.slice(0, 2));

        await ctx.close();

        // ── DSN ក្នុង Setup Link ៖ ផ្លូវពិតក្នុង browser ────────────────
        // roundtrip test វាស់ *payload*; ត្រង់នេះវាស់ *អ្វីដែលកើតលើឧបករណ៍*៖
        // តើ DSN ចូល localStorage ដែរឬទេ · តើវាចូល **មុន** PIN ឬអត់ ·
        // តើ `dsn` លេចក្នុងប្រអប់ Config ដែលមនុស្សនឹងចុច Save ឬអត់។
        const DSN_CASES = [
            { name: 'DSN ត្រឹមត្រូវ', dsn: 'https://abc123@o1.ingest.sentry.io/456', expect: 'https://abc123@o1.ingest.sentry.io/456' },
            { name: 'DSN ក្រៅ Sentry (អរិ)', dsn: 'https://abc@evil.example.com/1', expect: null }
        ];
        for (const tc of DSN_CASES) {
            const c2 = await browser.newContext({ viewport: { width: 412, height: 780 } });
            const p2 = await c2.newPage();
            const errs2 = [];
            p2.on('pageerror', (e) => errs2.push(e.message));
            await p2.route('**', (r) => r.request().url().startsWith('http://127.0.0.1:' + port) ? r.continue() : r.abort());

            const payload = Buffer.from(JSON.stringify(Object.assign({}, CONFIG, { dsn: tc.dsn }))).toString('base64');
            console.log('\n=== ' + app + ' — Setup Link + ' + tc.name + ' ===');
            await p2.goto('http://127.0.0.1:' + port + '/?setup=' + payload, { waitUntil: 'domcontentloaded' });
            await p2.waitForTimeout(1500);

            const dsnBeforePin = await p2.evaluate(() => localStorage.getItem('zoe_sentry_dsn'));
            ok(!dsnBeforePin, tc.name + ' ៖ DSN **មិន**ត្រូវកំណត់មុនឆ្លងកាត់ PIN', dsnBeforePin);

            await p2.fill(sel.pin, '123456');
            if (await p2.$(sel.confirm)) await p2.fill(sel.confirm, '123456');
            await (await p2.$('#pinSetupSaveBtn')).click();
            await p2.waitForTimeout(1200);

            const dsnAfterPin = await p2.evaluate(() => localStorage.getItem('zoe_sentry_dsn'));
            ok(!dsnAfterPin, tc.name + ' ៖ DSN **មិន**ទាន់កំណត់ក្រោយ PIN (កាត Setup Link រង់ចាំ «✅ ភ្ជាប់»)', dsnAfterPin);

            const filled2 = await p2.evaluate((q) => { const e = document.querySelector(q); return e ? e.value : null; }, sel.config);
            let clean = false, keptCfg = false;
            try {
                const obj = JSON.parse(filled2);
                clean = !('dsn' in obj);
                keptCfg = obj.projectId === 'biz-a' && obj.apiKey === CONFIG.apiKey;
            } catch (e) {}
            ok(clean, tc.name + ' ៖ `dsn` មិនលេចក្នុងប្រអប់ Config', (filled2 || '').slice(0, 80));
            ok(keptCfg, tc.name + ' ៖ វាល Firebase នៅគ្រប់ដដែល', (filled2 || '').slice(0, 80));
            const card = await p2.$('#configLinkConnectBtn');
            ok(!!card, tc.name + ' ៖ កាត Setup Link មានប៊ូតុង «✅ ភ្ជាប់»');
            if (card) await card.click();
            await p2.waitForTimeout(800);
            const dsnAfterTap = await p2.evaluate(() => localStorage.getItem('zoe_sentry_dsn'));
            ok((dsnAfterTap || null) === tc.expect, tc.name + ' ៖ DSN ក្រោយចុច «✅ ភ្ជាប់» ត្រូវជា ' + tc.expect, dsnAfterTap);
            const savedAfterTap = await p2.evaluate(() => localStorage.getItem('zoew_firebase_config'));
            ok(!!savedAfterTap && JSON.parse(savedAfterTap).projectId === 'biz-a', tc.name + ' ៖ ចុច «✅ ភ្ជាប់» ➜ Config រក្សាទុក', (savedAfterTap || '').slice(0, 60));
            ok(errs2.length === 0, tc.name + ' ៖ គ្មានកំហុស runtime', errs2.slice(0, 2));

            await c2.close();
        }

        server.close();
    }
    await browser.close();
    console.log('\n' + (fail ? 'FAIL ' : 'PASS ') + pass + '/' + (pass + fail));
    process.exit(fail ? 1 : 0);
})();
