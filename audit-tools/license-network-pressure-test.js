// ថ្នាក់កំហុស៖ **`license-verify.js` គ្មានពិដានសំណើស្របគ្នា និងគ្មាន guard
// ក្រៅបណ្តាញ** ➜ សំណើកកកុញលើ host ដដែល ➜ សំណើ **ចាំបាច់** ចេញមិនបាន។
//
// `network-pressure-test.js` ចាក់សោថ្នាក់នេះសម្រាប់ផ្លូវ Lookup របស់ ZoeW
// រួចហើយ ប៉ុន្តែវា **ជំនួស `license-verify.js` ដោយ stub ទាំងស្រុង**
// (`LICENSE_STUB`) ➜ ផ្លូវបណ្តាញពិតរបស់ license **មិនដែលត្រូវវាស់សោះ**។
// នេះជាមេរៀនដដែលនឹង `network-timeout-test.js` (2.12.1) និង
// `fluid-type-focus-test.js` (2.16.0)៖ **ពេលសរសេរ checker ត្រូវសួរថា
// «វាស្កេន/រត់ឯកសារ*ណា*ខ្លះ»**។
//
// ហេតុអ្វីវាកើតឡើងពិត៖ `window.addEventListener('online', …)` របស់ ZoeW ហៅ
// `ZoeLicense.syncServerTime()` **ដោយគ្មានពិដានល្បឿន** ខណៈការហៅ ៣ ផ្សេងទៀត
// ក្នុង handler ដដែល (`retryFirebaseSdkNow` · `nudgeDatabaseConnection` ·
// `retryFailedDbListenersNow`) សុទ្ធតែទទួលពិដានក្នុងកំណែ 2.14.0។ WiFi ដែល
// ភ្លឹបភ្លែត (គែមរបស់ជួរ, ការប្តូរ AP, ការប្តូរបណ្តាញទូរស័ព្ទ) បាញ់ `online`
// ច្រើនដងជាប់ៗគ្នា ➜ សំណើ license ច្រើនព្យួរស្របគ្នា។
//
// លេខដែលវាស់បានលើ Chromium ពិត (server ទទួលការតភ្ជាប់ តែមិនឆ្លើយ)៖
//
//   | រង្វាស់                                   | មុនកែ      | ក្រោយកែ |
//   |-------------------------------------------|-----------|---------|
//   | សំណើ **ចាំបាច់** លើ host ដដែល              | ៩ ៦០៤ ms  | ៥ ms    |
//   | សំណើ license ដែលដល់ server (ពី ១០ ការហៅ)  | ៧         | ១       |
//   | ការហៅខណៈ `navigator.onLine === false`     | ១០ ០០១ ms | ០ ms    |
//
// ⛔ `checkOnline()` ត្រូវត្រឡប់ `{ ok: null }` ពេលរំលង — **មិនមែន
// `{ ok: false }` ទេ**។ `getStatus()` លុប record មូលដ្ឋានតែពេល `ok === false`
// ដូច្នេះ `null` ជាតម្លៃសុវត្ថិភាព (ធ្លាក់ទៅការអនុគ្រោះ ៣ ថ្ងៃ)។ ការប្តូរវា
// ទៅ `false` នឹងធ្វើឲ្យ **License ត្រូវលុបចោលពេលបណ្តាញអន់** — កុំធ្វើ។
// ហេតុនេះ `activate()` (អ្នកប្រើចុចផ្ទាល់) ឆ្លងកាត់ `{ priority: true }`
// ដែលរំលងទាំងពិដាន និង guard ក្រៅបណ្តាញ។
let chromium;
try { chromium = require('playwright-core').chromium; } catch (e) {
    console.log('SKIP — ត្រូវការ playwright-core (npm i playwright-core)');
    process.exit(0);
}
const fs = require('fs');
const http = require('http');
const path = require('path');
const CHROME = process.env.LICPRESSURE_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
if (!fs.existsSync(CHROME)) { console.log('SKIP — រកមិនឃើញ Chromium'); process.exit(0); }

const ROOT = process.env.LICPRESSURE_APP_DIR || path.join(__dirname, '..');
let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { pass++; console.log('  ok    ' + label); }
    else { fail++; console.log('  FAIL  ' + label + (detail !== undefined ? '\n        ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : '')); }
}

// === ផ្នែកទី ១ — ច្បាប់ស្តាទិច ===
const LIC = path.join(ROOT, 'ZoeW', 'license-verify.js');
const KG_LIC = path.join(ROOT, 'ZoeKeyGen', 'license-verify.js');
const src = fs.readFileSync(LIC, 'utf8');

ok('license-verify.js មានពិដានចំនួនសំណើស្របគ្នា', /NET_MAX_IN_FLIGHT/.test(src));
ok('license-verify.js តាមដានសំណើដែលកំពុងដំណើរការ', /netInFlight/.test(src));
ok('ការតាមដាននោះត្រូវដោះទាំងផ្លូវជោគជ័យ និងផ្លូវបរាជ័យ',
    /started\.then\(release,\s*release\)/.test(src));
ok('`checkOnline()` មាន guard ក្រៅបណ្តាញ',
    /async function checkOnline[\s\S]{0,320}networkLooksDown\(\)/.test(src));
ok('`syncServerTime()` មាន guard ក្រៅបណ្តាញ',
    /async function syncServerTime[\s\S]{0,240}networkLooksDown\(\)/.test(src));
// ⛔ ការអះអាងត្រូវវាស់ **ការធានា** មិនមែន *អក្សរពិត* នៃបន្ទាត់នោះ ៖
//    ការបន្ថែម option ថ្មីចូល `checkOnline()` (ឧ. `claimSeat`) មិនត្រូវ
//    ធ្វើឲ្យអ្នកយាមធ្លាក់ ខណៈការធានានៅដដែល — តែការ**ដក** `priority: true`
//    ចេញ ត្រូវធ្វើឲ្យវាធ្លាក់ដដែល។
const activateBody = (() => {
    const i = src.indexOf('async function activate(');
    if (i === -1) return '';
    let depth = 0, started = false, j = src.indexOf('{', i);
    for (; j < src.length; j++) {
        if (src[j] === '{') { depth++; started = true; }
        else if (src[j] === '}') { depth--; if (started && depth === 0) { j++; break; } }
    }
    return src.slice(i, j);
})();
ok('`activate()` ជាអាទិភាព — មិនត្រូវទប់ដោយពិដាន',
    activateBody.length > 0 && /checkOnline\(\s*appCode\s*,[^)]*priority:\s*true/.test(activateBody));
// ⛔ ការរំលងត្រូវជា `ok: null` (មិនផ្ទៀងផ្ទាត់បាន) មិនមែន `ok: false` (បដិសេធ)
ok('ការរំលងត្រឡប់ `{ ok: null }` — មិនលុប License ចោល',
    !/if \(!pending\) return \{ ok: false/.test(src)
    && /if \(!pending\) return \{ ok: null, reason: 'network' \}/.test(src));
ok('license-verify.js byte-identical ទាំង ២ App',
    fs.existsSync(KG_LIC) && fs.readFileSync(KG_LIC, 'utf8') === src);

// === ផ្នែកទី ២ — វាស់ក្នុង Chromium ពិត ===
// host តែមួយ ៖ ព្យួរលើផ្លូវ license, ឆ្លើយភ្លាមលើ /URGENT — ដូច្នេះការពន្យារ
// ណាមួយលើ /URGENT គឺជា **ការកកកុញ** មិនមែនជាភាពយឺតរបស់ server ទេ។
function serveMixed() {
    const seen = [];
    return new Promise((res) => {
        const s = http.createServer((req, rsp) => {
            seen.push(req.url);
            if (req.url.indexOf('/URGENT') === 0) {
                rsp.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                return rsp.end('{"ok":true}');
            }
        });
        s.on('connection', (c) => c.setTimeout(0));
        s.listen(0, '127.0.0.1', () => res({ server: s, seen, port: s.address().port }));
    });
}
function servePage(licSrc) {
    return new Promise((res) => {
        const s = http.createServer((req, rsp) => {
            if (req.url.indexOf('/license-verify.js') === 0) {
                rsp.writeHead(200, { 'Content-Type': 'application/javascript' });
                return rsp.end(licSrc);
            }
            rsp.writeHead(200, { 'Content-Type': 'text/html' });
            rsp.end('<!doctype html><meta charset=utf-8><title>lic</title><script src="/license-verify.js"></script>');
        });
        s.listen(0, '127.0.0.1', () => res({ server: s, port: s.address().port }));
    });
}
function urgentMs(page, port) {
    return page.evaluate(async (p) => {
        const t = Date.now();
        try {
            const c = new AbortController();
            setTimeout(() => c.abort(), 15000);
            await fetch('http://127.0.0.1:' + p + '/URGENT.json?n=' + Math.random(), { signal: c.signal });
        } catch (e) {}
        return Date.now() - t;
    }, port);
}

(async () => {
    const host = await serveMixed();
    // ស្រង់ `license-verify.js` **ពិត** មករត់ — កុំសរសេរតេស្តលើកូដចម្លង
    const licSrc = src.replace('https://zoew-z1-default-rtdb.firebaseio.com', 'http://127.0.0.1:' + host.port);
    const pageSrv = await servePage(licSrc);
    const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
    try {
        const page = await browser.newPage();
        await page.goto('http://127.0.0.1:' + pageSrv.port + '/');
        await page.waitForFunction(() => !!window.ZoeLicense);

        const baseline = await urgentMs(page, host.port);
        ok('មូលដ្ឋាន៖ សំណើចាំបាច់លឿន ពេលគ្មានសម្ពាធ (< 1500ms)', baseline < 1500, baseline + 'ms');

        // WiFi ភ្លឹបភ្លែត ➜ `online` បាញ់ ១០ ដង ➜ `syncServerTime()` ១០ ដង
        await page.evaluate(() => { for (let i = 0; i < 10; i++) ZoeLicense.syncServerTime().catch(() => {}); });
        await new Promise((r) => setTimeout(r, 400));

        const reached = host.seen.filter((u) => u.indexOf('URGENT') === -1).length;
        ok('១០ ការហៅ ➜ យ៉ាងច្រើន ២ សំណើដល់ server (dedup + ពិដាន)', reached <= 2,
            'ដល់ server ' + reached + ' សំណើ (មុនកែ ៖ ៧ — ពេញកូតា browser)');

        const pressured = await urgentMs(page, host.port);
        ok('សំណើចាំបាច់នៅតែឆាប់រហ័សខណៈ license ព្យួរ (< 1500ms)', pressured < 1500,
            pressured + 'ms (មុនកែ ៖ ៩ ៦០៤ ms — ជាប់ក្រោយសំណើ license)');

        // guard ក្រៅបណ្តាញ ៖ មិនត្រូវកាន់ socket ១០ វិនាទីទទេៗ
        const offline = await page.evaluate(async () => {
            Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true });
            const t = performance.now();
            const returned = await ZoeLicense.syncServerTime();
            return { ms: Math.round(performance.now() - t), returned: returned };
        });
        ok('ក្រៅបណ្តាញ ➜ ត្រឡប់ភ្លាម មិនកាន់ socket (< 500ms)', offline.ms < 500,
            offline.ms + 'ms (មុនកែ ៖ ១០ ០០១ ms)');
        ok('ក្រៅបណ្តាញ ➜ `syncServerTime()` ត្រឡប់ false', offline.returned === false, offline.returned);

        // ⛔ ការការពារធំបំផុត ៖ ក្រៅបណ្តាញ **មិនត្រូវ** លុប License ចោល
        const status = await page.evaluate(async () => {
            localStorage.setItem('zoe_license_activation_ADM', JSON.stringify({
                keyString: 'ZOEKEY-bad.bad', id: 'X', a: 'ADM',
                iat: 1, exp: Math.floor(Date.now() / 1000) + 86400,
                lastOnlineCheck: Date.now(), onlineExp: Date.now() + 86400000
            }));
            const r = await ZoeLicense.checkOnline('ADM', 'X');
            return { ok: r.ok, reason: r.reason };
        });
        ok('ក្រៅបណ្តាញ ➜ `checkOnline()` ត្រឡប់ `ok: null` (មិនបដិសេធ License)',
            status.ok === null, status);
    } finally {
        await browser.close();
        host.server.close();
        pageSrv.server.close();
    }

    console.log('\n' + (fail === 0 ? 'PASS' : 'FAIL') + ' — ' + pass + ' ok, ' + fail + ' fail');
    process.exit(fail === 0 ? 0 : 1);
})();
