// ⛔ ថ្នាក់កំហុស៖ **browser ដែលបិទ site data ធ្វើឲ្យ App ដាច់ទាំងស្រុង។**
//
// ពេលអ្នកប្រើ (ឬ policy) បិទ site data ទាំងស្រុង — Chrome «Block all
// cookies» · Firefox strict · policy សហគ្រាស · បរិបទ origin ស្រអាប់ —
// នោះការប៉ះ `window.localStorage` **ខ្លួនវា** បោះ `SecurityError`។
// ⚠️ **វាមិនមែនត្រឹមការសរសេរទេ** ៖ `storage-guard.js` ធ្លាប់គ្របតែ
// `setItem`/`removeItem`/`clear` ដោយផ្អែកលើហេតុផល «QuotaExceededError»។
//
// ហើយផលរបស់ការអានធ្ងន់ជាងច្រើន ៖ `ZoeW/app.js` អានវា **កម្រិត top-level**
// (`let exchangeRateRiel = parseFloat(localStorage.getItem(...)) || 4100;`)។
// កូដ top-level ដែលបោះ **បញ្ឈប់ការវាយតម្លៃឯកសារទាំងមូល** ➜ អ្វីៗខាងក្រោម
// វាមិនរត់សោះ ៖ `initAppLock()` · `window.addEventListener('load')` ដែលហៅ
// `initFirebase()` · `revealAppAfterBoot()`។
//
// ⚠️ **អន្ទាក់នៃការវិនិច្ឆ័យ** ៖ **function declaration ត្រូវ hoist** ➜
// `typeof sanitizeInput === 'function'` ត្រឡប់ `true` ទោះឯកសារធ្លាក់ត្រង់
// បន្ទាត់ទី ២៨១។ ដូច្នេះការសួរ «តើ function មានទេ?» **បង្ហាញថាធម្មតា**
// ខណៈ App ស្លាប់។ សញ្ញាពិតគឺ ៖ **ផ្ទាំង boot ជាប់** និង **កំហុស runtime**។
//
// ⚠️ ការវាស់ក៏ត្រូវធ្វើត្រាប់តាមឲ្យត្រូវរបៀបដែរ ៖ **getter ខ្លួនវាបោះ**
// មិនមែនត្រឹម method ទេ។ នោះសំខាន់ ព្រោះគំរូ `safeStoreSet(localStorage, …)`
// វាយតម្លៃ `localStorage` **មុន** ចូល function ➜ ការការពារនោះ **មិនដំណើរការ**
// បើ getter ជាអ្នកបោះ។ ដំណោះស្រាយ ៖ shim ដែលអានក្នុង `try` **តែម្តង**។
let chromium;
try { chromium = require('playwright-core').chromium; } catch (e) {
    console.log('SKIP — ត្រូវការ playwright-core (npm i playwright-core)');
    process.exit(0);
}
const fs = require('fs');
const http = require('http');
const path = require('path');
const CHROME = process.env.STORAGEBOOT_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
if (!fs.existsSync(CHROME)) { console.log('SKIP — រកមិនឃើញ Chromium'); process.exit(0); }

const ROOT = process.env.STORAGEBOOT_APP_DIR || path.join(__dirname, '..');
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm' };

let pass = 0, fail = 0;
const ok = (n) => { console.log('   ok    ' + n); pass++; };
const bad = (n, d) => { console.log('   FAIL  ' + n + (d !== undefined ? '\n         ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); fail++; };
const check = (c, n, d) => (c ? ok(n) : bad(n, d));

function serve(dir) {
    return new Promise((res, rej) => {
        if (!fs.existsSync(dir)) return rej(new Error('រកថត App មិនឃើញ: ' + dir));
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

// `mode`៖ 'getter' — `window.localStorage` ខ្លួនវាបោះ (អ្វីដែល browser ធ្វើពិត)
//         'method' — object មក តែ method បោះ (Safari Private Mode ចាស់)
//         null     — storage ដំណើរការធម្មតា (ទិសផ្ទុយ)
function blockScript(mode) {
    if (!mode) return '';
    const boom = "const boom = () => { const e = new Error('SecurityError: site data blocked'); e.name = 'SecurityError'; throw e; };";
    if (mode === 'getter') {
        return `(function () { ${boom}
            for (const n of ['localStorage', 'sessionStorage'])
                Object.defineProperty(window, n, { configurable: true, get: boom });
        })();`;
    }
    return `(function () { ${boom}
        const stub = { getItem: boom, setItem: boom, removeItem: boom, clear: boom, key: boom };
        for (const n of ['localStorage', 'sessionStorage'])
            Object.defineProperty(window, n, { configurable: true, get() { return stub; } });
    })();`;
}

async function boot(browser, port, mode) {
    const ctx = await browser.newContext({ viewport: { width: 412, height: 780 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e && e.message).slice(0, 140)));
    await page.addInitScript(`window.addEventListener('unhandledrejection', function (ev) {
            var m; try { m = String((ev.reason && (ev.reason.message || ev.reason)) || 'unknown'); } catch (x) { m = 'unknown'; }
            setTimeout(function () { throw new Error('unhandledrejection: ' + m); }, 0);
        });`);
    page.on('dialog', (d) => d.dismiss().catch(() => {}));
    const s = blockScript(mode);
    if (s) await page.addInitScript(s);
    await page.route('**', (r) => r.request().url().startsWith('http://127.0.0.1:' + port) ? r.continue() : r.abort());
    await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2600);
    const state = await page.evaluate(() => {
        const splash = document.getElementById('bootSplash') || document.querySelector('.boot-splash');
        const splashStuck = !!splash
            && getComputedStyle(splash).display !== 'none'
            && !splash.classList.contains('boot-splash-gone');
        // ⛔ **កុំវាស់ដោយ `typeof <fn> === 'function'`** — function declaration
        // ត្រូវ **hoist** ➜ វាត្រឡប់ `true` ទោះឯកសារធ្លាក់ត្រង់បន្ទាត់ដំបូង។
        // ហើយឈ្មោះ function ក៏ខុសគ្នារវាង App ទាំង ២ ដែរ (`sanitizeInput`
        // មាននៅ ZoeW តែមិនមាននៅ ZoeKeyGen) ➜ ការវាស់បែបនោះចាក់សោ **ភាព
        // ដូចគ្នារវាង App** ដែលមិនមែនជាអ្វីដែលតេស្តនេះមកវាស់ទេ។
        // សញ្ញាពិតដែលមិនអាស្រ័យលើ App ៖ **ផ្ទាំង boot បាត់** · **គ្មានកំហុស
        // runtime** · **ខ្លឹមសារពិតត្រូវគូរ**។
        return {
            splashStuck: splashStuck,
            bodyText: (document.body.innerText || '').replace(/\s+/g, ' ').trim()
        };
    });
    await ctx.close();
    return { state, errors };
}

(async () => {
    const browser = await chromium.launch({ executablePath: CHROME });
    for (const app of ['ZoeW', 'ZoeKeyGen']) {
        console.log('\n== ' + app + ' ==');
        let server;
        try { server = await serve(path.join(ROOT, app)); }
        catch (e) { bad(app + ' ៖ បម្រើថត App បាន', String(e && e.message)); continue; }
        const port = server.address().port;

        // ⛔ ករណីធ្ងន់បំផុត ៖ getter ខ្លួនវាបោះ
        const blocked = await boot(browser, port, 'getter');
        check(blocked.errors.length === 0,
            app + ' ៖ ⛔ site data ត្រូវបិទ (getter បោះ) ➜ **គ្មានកំហុស runtime**',
            blocked.errors.slice(0, 2).join(' | '));
        check(blocked.state.splashStuck === false,
            app + ' ៖ ⛔ ផ្ទាំង boot **មិនជាប់** — កូដក្រោយ top-level រត់ពិត',
            blocked.state);
        check(blocked.state.bodyText.length > 40,
            app + ' ៖ App គូរខ្លឹមសារពិត (' + blocked.state.bodyText.length + ' តួ)',
            blocked.state.bodyText.slice(0, 70));

        // Safari Private Mode ចាស់ ៖ object មក តែ method បោះ
        const stubbed = await boot(browser, port, 'method');
        check(stubbed.errors.length === 0,
            app + ' ៖ ⛔ storage method បោះ (Private Mode ចាស់) ➜ គ្មានកំហុស runtime',
            stubbed.errors.slice(0, 2).join(' | '));
        check(stubbed.state.splashStuck === false,
            app + ' ៖ ផ្ទាំង boot មិនជាប់ក្នុងករណីនោះដែរ', stubbed.state);

        // ⛔ ទិសផ្ទុយ ៖ storage ធម្មតាត្រូវនៅដំណើរការដដែល
        const normal = await boot(browser, port, null);
        check(normal.errors.length === 0,
            app + ' ៖ ⛔ ទិសផ្ទុយ — storage ធម្មតា ➜ គ្មានកំហុស',
            normal.errors.slice(0, 2).join(' | '));
        check(normal.state.splashStuck === false,
            app + ' ៖ ⛔ ទិសផ្ទុយ — storage ធម្មតា ➜ App boot ធម្មតា', normal.state);

        // ⛔ ជាន់អប្បបរមា ៖ ការវាស់ត្រូវបានឃើញ App ពិត មិនមែនទំព័រទទេ។
        check(normal.state.bodyText.length > 60,
            app + ' ៖ ⛔ ជាន់អប្បបរមា — storage ធម្មតាគូរខ្លឹមសារពិត ('
                + normal.state.bodyText.length + ' តួ)',
            normal.state.bodyText.slice(0, 70));
        // ⛔ ការវាស់ស្នូល ៖ ការបិទ storage មិនត្រូវ **កាត់បន្ថយ** អ្វីដែល
        // អ្នកប្រើឃើញទេ។ ជំនាន់មុនកែ ៖ ធម្មតា 628 តួ ធៀបនឹងបិទ ~100 តួ។
        check(blocked.state.bodyText.length >= normal.state.bodyText.length * 0.6,
            app + ' ៖ ⛔ ការបិទ storage មិនកាត់បន្ថយអ្វីដែលអ្នកប្រើឃើញ',
            'ធម្មតា=' + normal.state.bodyText.length + ' បិទ=' + blocked.state.bodyText.length);

        server.close();
    }
    await browser.close();
    console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')' : '✅ ជោគជ័យ ' + pass));
    process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
