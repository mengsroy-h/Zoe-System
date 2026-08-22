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

const TYPES = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.json':'application/json' };
function serve(dir, port) { return new Promise((res) => { const s = http.createServer((req, rsp) => {
    let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
    const f = path.join(dir, p);
    if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); return rsp.end(); }
    rsp.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'text/plain' }); rsp.end(fs.readFileSync(f));
}); s.listen(port, () => res(s)); }); }

const CONFIG = { apiKey: 'AIzaFAKE', authDomain: 'biz-a.firebaseapp.com',
    databaseURL: 'https://biz-a-default-rtdb.firebaseio.com', projectId: 'biz-a',
    storageBucket: 'biz-a.appspot.com', messagingSenderId: '1', appId: '1:1:web:1' };
const PAYLOAD = Buffer.from(JSON.stringify(CONFIG)).toString('base64');

const SEL = {
    ZoeW: { pin: '#newSecurityPinInput', confirm: '#confirmSecurityPinInput', config: '#firebaseConfigInput' }
};

(async () => {
    const browser = await chromium.launch({ executablePath: CHROME });
    let port = 8810;
    for (const app of ['ZoeW']) {
        const sel = SEL[app];
        const server = await serve(path.join(ROOT, app), port);
        const ctx = await browser.newContext({ viewport: { width: 412, height: 780 } });
        const page = await ctx.newPage();
        const errs = [];
        page.on('pageerror', (e) => errs.push(e.message));
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

        await ctx.close(); server.close(); port++;
    }
    await browser.close();
    console.log('\n' + (fail ? 'FAIL ' : 'PASS ') + pass + '/' + (pass + fail));
    process.exit(fail ? 1 : 0);
})();
