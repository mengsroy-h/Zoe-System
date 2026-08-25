// ថ្នាក់កំហុស៖ **ការធ្វើឲ្យស្រស់ខាងក្រោយរបស់ service worker ព្យួររហូត
// ➜ ពេញកូតា connection ➜ សំណើចាំបាច់ទាំងអស់ស្លាប់។**
//
// `revalidateShell()` រត់ក្នុង `event.waitUntil()` សម្រាប់ **រាល់ឯកសារ**
// នៃសំបកដែលឆ្លើយតបពី cache។ មុនកែ វាជា `fetch()` ឆៅ គ្មាន `AbortController`
// គ្មានពិដានចំនួនស្របគ្នា។ លើបណ្តាញ «ភ្ជាប់តែស្លាប់» (WiFi នៅតភ្ជាប់ តែ
// គ្មានផ្លូវចេញ — ករណីដែលឯកសារគម្រោងកត់ត្រារួច) សំណើទាំងនោះមិនធ្លាក់ទេ
// **វាព្យួរ** ➜ ការបើកទំព័រតែម្តងបង្កើតសំណើព្យួរ ៨–១០ ➜ ពេញពិដាន
// same-origin របស់ browser (៦) ➜ **គ្មានសំណើណាចេញបានទៀតទេ**។
//
// ការវាស់លើ Chromium ពិត (server ទទួលការតភ្ជាប់ តែមិនឆ្លើយសោះ)៖
//
//   | អ្វី                              | មុនកែ            | ក្រោយកែ |
//   |-----------------------------------|------------------|---------|
//   | ការតភ្ជាប់ដែល server កាន់ទុក      | ៦ (ពេញពិដាន)     | ៦       |
//   | សំណើថ្មីទៅដល់ server              | **០ ដង**         | ១ ដង    |
//   | ពេលវេលារបស់សំណើថ្មី               | **មិនដែលមកដល់**  | ~៦ ms   |
//
// នេះជាថ្នាក់កំហុសដដែលនឹង `network-pressure-test.js` (សំណើកកកុញនៅខាង App)
// តែនៅក្នុង **service worker** ដែលគ្មានឧបករណ៍ណាមើលពីមុន។
//
// ⚠️ ការធ្វើឲ្យស្រស់ជាការងារ **ស្រេចចិត្ត** — កំណែថ្មីរបស់សំបកមកតាមផ្លូវ
// `CACHE_VERSION` (install ទាញឡើងវិញទាំងក្រុម) ដូច្នេះការឲ្យវាធ្វើឲ្យសំណើ
// **ចាំបាច់** ស្លាប់ គឺជាការដោះដូរដែលខុសទាំងស្រុង។
const fs = require('fs');
const http = require('http');
const path = require('path');

const ROOT = process.env.SWREVAL_APP_DIR || path.join(__dirname, '..');
let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { pass++; console.log('  ok    ' + label); }
    else { fail++; console.log('  FAIL  ' + label + (detail !== undefined ? '\n        ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : '')); }
}

function sliceFn(src, name) {
    const start = src.indexOf('function ' + name + '(');
    if (start === -1) return null;
    let depth = 0, started = false, i = src.indexOf('{', start);
    for (; i < src.length; i++) {
        if (src[i] === '{') { depth++; started = true; }
        else if (src[i] === '}') { depth--; if (started && depth === 0) { i++; break; } }
    }
    return src.slice(start, i);
}

// === ផ្នែកទី ១ — រចនាសម្ព័ន្ធ sw.js ទាំង ៣ App ===
const APPS = ['ZoeW', 'ZoeKeyGen', 'ZoeImport'];
for (const app of APPS) {
    const swPath = path.join(ROOT, app, 'sw.js');
    if (!fs.existsSync(swPath)) continue;
    const sw = fs.readFileSync(swPath, 'utf8');
    const fn = sliceFn(sw, 'revalidateShell');
    ok(app + ': រកឃើញ revalidateShell', !!fn);
    if (!fn) continue;

    ok(app + ': ការធ្វើឲ្យស្រស់ **abort ពិត** (មិនត្រឹមតែឈប់រង់ចាំ)',
        /AbortController/.test(fn) && /signal/.test(fn) && /\.abort\(\)/.test(fn),
        'revalidateShell គ្មាន AbortController');
    ok(app + ': មានពេលកំណត់ជាថេរដែលអានចេញបាន',
        /REVALIDATE_TIMEOUT_MS/.test(fn) && /const REVALIDATE_TIMEOUT_MS = \d+;/.test(sw));
    ok(app + ': មានពិដានចំនួនស្របគ្នា (កូតា connection មិនត្រូវពេញ)',
        /REVALIDATE_MAX_IN_FLIGHT/.test(fn) && /const REVALIDATE_MAX_IN_FLIGHT = \d+;/.test(sw));
    ok(app + ': មិនធ្វើឲ្យស្រស់ស្ទួនលើកូនសោដដែល (dedup)',
        /revalidateInFlight\.has\(/.test(fn) && /revalidateInFlight\.add\(/.test(fn) && /revalidateInFlight\.delete\(/.test(fn));
    ok(app + ': timer ត្រូវលុប និងដកចេញពីបញ្ជីលើ **គ្រប់ផ្លូវ** (រួមទាំងផ្លូវបរាជ័យ)',
        /\.then\([\s\S]*?,\s*release\)/.test(fn) && /clearTimeout\(timer\)/.test(fn));
    ok(app + ': នៅតែរំលងពេលក្រៅបណ្តាញ',
        /navigator\.onLine === false/.test(fn));

    const timeout = Number((sw.match(/const REVALIDATE_TIMEOUT_MS = (\d+);/) || [])[1] || 0);
    ok(app + ': ពេលកំណត់សមហេតុផល (១–១៥ វិ.)', timeout >= 1000 && timeout <= 15000, timeout);
    const cap = Number((sw.match(/const REVALIDATE_MAX_IN_FLIGHT = (\d+);/) || [])[1] || 0);
    ok(app + ': ពិដានទុកកន្លែងទំនេរក្នុងកូតា browser (≤ ៤)', cap >= 1 && cap <= 4, cap);
}

// === ផ្នែកទី ២ — វាស់លើ Chromium ពិត ===
let chromium;
try { chromium = require('playwright-core').chromium; } catch (e) {
    console.log('\nSKIP ផ្នែក browser — ត្រូវការ playwright-core');
    console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')' : '✅ ជោគជ័យ ' + pass));
    process.exit(fail ? 1 : 0);
}
const CHROME = process.env.SWREVAL_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
if (!fs.existsSync(CHROME)) {
    console.log('\nSKIP ផ្នែក browser — រកមិនឃើញ Chromium');
    console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')' : '✅ ជោគជ័យ ' + pass));
    process.exit(fail ? 1 : 0);
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.png': 'image/png', '.txt': 'text/plain' };
const CANARY_PATH = '/zoe-audit-canary.txt';
const CANARY_BUDGET_MS = 9000;

(async () => {
    const APP = path.join(ROOT, 'ZoeW');
    let hangMode = false;
    const held = [];
    let canaryHits = 0;

    const server = http.createServer((req, res) => {
        let p = decodeURIComponent(req.url.split('?')[0]);
        // សំណើ canary ត្រូវឆ្លើយ **ភ្លាម** ជានិច្ច — បើវាមិនមកដល់ នោះមានន័យថា
        // កូតា connection ត្រូវបានស៊ីអស់ដោយការធ្វើឲ្យស្រស់ដែលព្យួរ។
        if (p === CANARY_PATH) {
            canaryHits++;
            res.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
            res.end('canary-ok');
            return;
        }
        if (hangMode) { held.push(res); return; }
        if (p === '/') p = '/index.html';
        const file = path.join(APP, p);
        if (!file.startsWith(APP) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
        res.end(fs.readFileSync(file));
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const base = 'http://127.0.0.1:' + server.address().port;

    const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
    let result = null;
    try {
        const ctx = await browser.newContext();
        const page = await ctx.newPage();
        page.on('pageerror', () => {});

        // ១) ការបើកលើកដំបូង — SW ដំឡើង និង cache សំបក
        await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
        await page.evaluate(() => navigator.serviceWorker.ready.then(() => new Promise((r) => setTimeout(r, 1500))));

        // ២) បណ្តាញក្លាយជា «ភ្ជាប់តែស្លាប់» — ទទួលការតភ្ជាប់ តែមិនឆ្លើយសោះ
        hangMode = true;
        await page.goto(base + '/', { waitUntil: 'domcontentloaded' });
        await page.evaluate(() => new Promise((r) => setTimeout(r, 800)));

        // ៣) សំណើ same-origin ថ្មី — server នឹងឆ្លើយវាភ្លាម បើវាទៅដល់
        result = await page.evaluate(([p, budget]) => {
            const t = performance.now();
            return Promise.race([
                fetch(p, { cache: 'no-store' }).then((r) => r.text()).then((txt) => ({ ok: txt === 'canary-ok', ms: Math.round(performance.now() - t) })),
                new Promise((res) => setTimeout(() => res({ ok: false, ms: Math.round(performance.now() - t), timedOut: true }), budget))
            ]);
        }, [CANARY_PATH, CANARY_BUDGET_MS]);
    } finally {
        await browser.close();
        held.forEach((r) => { try { r.destroy(); } catch (e) {} });
        server.close();
    }

    ok('សំណើ same-origin ថ្មីទៅដល់ server ខណៈការធ្វើឲ្យស្រស់កំពុងព្យួរ',
        canaryHits >= 1, { canaryHits: canaryHits, heldByServer: held.length });
    ok('សំណើនោះមិនត្រូវអត់ឃ្លានក្នុងកូតា connection',
        result && result.ok === true, result);

    console.log('\n  ↳ ការតភ្ជាប់ដែល server កាន់ទុក: ' + held.length +
        ' · សំណើ canary ទៅដល់: ' + canaryHits + ' ដង · ' + (result ? result.ms + ' ms' : 'n/a'));
    console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')' : '✅ ជោគជ័យ ' + pass));
    process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
