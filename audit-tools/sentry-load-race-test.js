// ថ្នាក់កំហុស៖ **ការតាមដានស្ងាត់ជាងការពិត** — Sentry មើលទៅដំណើរការ តែ
// event ធ្លាក់ចោល។ ទាំងអស់ស្ថិតក្នុងផ្លូវ monitoring (មិនប៉ះលុយ/ទិន្នន័យ)
// ប៉ុន្តែផលគឺ **យើងបាត់ error ដោយមិនដឹងខ្លួន** ដែលធ្វើឲ្យជុំ audit ក្រោយ
// ខ្វះភស្តុតាងពិតពីអ្នកប្រើ។ Race ៣៖
//
//   ១. CDN យឺតលើស `SDK_LOAD_TIMEOUT_MS` ➜ `loadSentrySdk()` reject ➜
//      `init()` ត្រឡប់ false។ តែ `<script>` នៅក្នុង DOM ហើយនៅបន្តផ្ទុក ➜
//      ពេលវាមកដល់ `window.Sentry` **មាន** តែ `Sentry.init()` **មិនដែលហៅ** ➜
//      `capture()` ឃើញ `captureException` ជា function ➜ ហៅវា ➜ **ធ្លាក់ចោល**។
//   ២. Error ក្នុងបង្អួច boot (មុន SDK មកដល់) ➜ `window.Sentry` undefined ➜
//      `capture()` no-op ➜ **error ដែលមានតម្លៃបំផុតបាត់អស់**។
//   ៣. លុប DSN ➜ `init()` ចាកចេញមុន ➜ **client ចាស់នៅ bound ហើយនៅផ្ញើបន្ត**
//      រហូតដល់ reload (រួមទាំង global handler របស់ Sentry ខ្លួនវា)។
//
// តេស្តប្រើ `error-reporting.js` **ពិត** ហើយចាក់ SDK ក្លែងក្លាយជំនួស CDN
// ដោយ `page.route()` ដែលអាចពន្យារបាន។ SDK ក្លែងក្លាយកត់ត្រា event តែពេល
// `init()` ត្រូវហៅ និង client នៅ bound — ដូចឥរិយាបថពិតរបស់ Sentry។
let chromium;
try { chromium = require('playwright-core').chromium; } catch (e) { console.log('SKIP — ត្រូវការ playwright-core'); process.exit(0); }
const CHROME = process.env.SENTRYRACE_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const fs = require('fs'), http = require('http'), path = require('path');
if (!fs.existsSync(CHROME)) { console.log('SKIP — រកមិនឃើញ Chromium'); process.exit(0); }
const ROOT = process.env.SENTRYRACE_APP_DIR || path.join(__dirname, '..');

let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { pass++; console.log('   ok    ' + label); }
    else { fail++; console.log('   FAIL  ' + label + (detail !== undefined ? '\n         ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : '')); }
}

const PAGE = `<!doctype html><meta charset="utf-8"><title>t</title><body></body>`;

// SDK ក្លែងក្លាយ — event ទៅដល់គោលដៅ **តែពេល** `init()` ត្រូវហៅ និង client
// នៅ bound។ នេះជាឥរិយាបថពិតរបស់ Sentry៖ `captureException` លើ SDK ដែល
// មិនទាន់ init ដើរដោយគ្មាន error តែ event មិនទៅណាទេ។
const FAKE_SDK = `
window.__log = { init: [], sent: [], closed: 0, unbound: 0 };
(function () {
    var bound = false;
    window.Sentry = {
        init: function (o) { window.__log.init.push(o && o.dsn); bound = true; },
        captureException: function (e) { if (!bound) return; window.__log.sent.push(String(e && e.message || e)); },
        setTag: function () {},
        close: function () { window.__log.closed++; bound = false; return Promise.resolve(true); },
        getCurrentHub: function () {
            return { bindClient: function (c) { if (c === undefined) { window.__log.unbound++; bound = false; } } };
        }
    };
})();
`;

function serve(dir) {
    return new Promise((res) => {
        const s = http.createServer((req, rsp) => {
            const p = decodeURIComponent(req.url.split('?')[0]);
            if (p === '/' ) { rsp.writeHead(200, { 'Content-Type': 'text/html' }); return rsp.end(PAGE); }
            const f = path.join(dir, p);
            if (!f.startsWith(dir) || !fs.existsSync(f)) { rsp.writeHead(404); return rsp.end(); }
            rsp.writeHead(200, { 'Content-Type': 'application/javascript' });
            rsp.end(fs.readFileSync(f));
        });
        s.listen(0, '127.0.0.1', () => res(s));
    });
}

// បង្រួម timer ≥5s ចុះ ៥០ ដង ➜ បង្អួច timeout ១០វិ ក្លាយជា ២០០ms
// (លំនាំដដែលនឹង `slow-write-test.js`) ដូច្នេះតេស្តលឿន តែផ្លូវកូដដដែល។
const SHRINK_TIMERS = `
(function () {
    var raw = window.setTimeout;
    window.setTimeout = function (fn, ms) {
        var d = (typeof ms === 'number' && ms >= 5000) ? Math.round(ms / 50) : ms;
        return raw(fn, d);
    };
})();
`;

async function makePage(browser, origin, sdkDelayMs) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.route('**', async (r) => {
        const u = r.request().url();
        if (u.indexOf('sentry-cdn.com') !== -1) {
            if (sdkDelayMs) await new Promise((x) => setTimeout(x, sdkDelayMs));
            return r.fulfill({ status: 200, contentType: 'application/javascript', body: FAKE_SDK });
        }
        if (u.startsWith(origin)) return r.continue();
        return r.abort();
    });
    await page.addInitScript(SHRINK_TIMERS);
    await page.addInitScript(`window.localStorage.setItem('zoe_sentry_dsn', 'https://k@o0.ingest.sentry.io/1');`);
    await page.goto(origin + '/', { waitUntil: 'domcontentloaded' });
    await page.addScriptTag({ url: '/error-reporting.js' });
    return { ctx, page };
}

(async () => {
    const server = await serve(path.join(ROOT, 'ZoeW'));
    const origin = 'http://127.0.0.1:' + server.address().port;
    const browser = await chromium.launch({ executablePath: CHROME });

    // ១ — CDN យឺតលើសបង្អួច timeout រួចមកដល់ក្រោយមក
    {
        const { ctx, page } = await makePage(browser, origin, 700);
        const out = await page.evaluate(async () => {
            const wait = (ms) => new Promise((x) => setTimeout(x, ms));
            const started = await window.ZoeErrors.init('zoew');
            await wait(1500);
            window.ZoeErrors.capture(new Error('after-late-load'));
            await wait(150);
            return { started, log: window.__log, hasSentry: typeof window.Sentry };
        });
        ok('CDN យឺត ➜ init() រាយការណ៍ការបរាជ័យដោយស្មោះ', out.started === false, out);
        ok('SDK មកដល់យឺត ➜ init ត្រូវបញ្ចប់ (មិនទុក SDK ដែលមិនទាន់ init)',
            out.log.init.length === 1, out.log);
        ok('capture() ក្រោយ SDK មកដល់យឺត ➜ event **ទៅដល់ពិត** មិនធ្លាក់ចោល',
            out.log.sent.indexOf('after-late-load') !== -1, out.log);
        await ctx.close();
    }

    // ២ — error ក្នុងបង្អួច boot មុន SDK មកដល់
    {
        const { ctx, page } = await makePage(browser, origin, 300);
        const out = await page.evaluate(async () => {
            const wait = (ms) => new Promise((x) => setTimeout(x, ms));
            window.ZoeErrors.capture(new Error('boot-error'));
            const started = window.ZoeErrors.init('zoew');
            window.ZoeErrors.capture(new Error('boot-error-2'));
            await started;
            await wait(200);
            return { log: window.__log };
        });
        ok('error មុន SDK មកដល់ ➜ ត្រូវទុកជួរ រួចផ្ញើពេលរួចរាល់',
            out.log.sent.indexOf('boot-error') !== -1 && out.log.sent.indexOf('boot-error-2') !== -1, out.log);
        await ctx.close();
    }

    // ៣ — លុប DSN ➜ ត្រូវផ្តាច់ client ពិត
    {
        const { ctx, page } = await makePage(browser, origin, 0);
        const out = await page.evaluate(async () => {
            const wait = (ms) => new Promise((x) => setTimeout(x, ms));
            await window.ZoeErrors.init('zoew');
            await wait(50);
            window.ZoeErrors.capture(new Error('before-clear'));
            window.ZoeErrors.setDsn('');
            await window.ZoeErrors.init('zoew');
            await wait(50);
            window.ZoeErrors.capture(new Error('after-clear'));
            await wait(50);
            return { log: window.__log };
        });
        ok('មុនលុប DSN ➜ event ទៅដល់ធម្មតា', out.log.sent.indexOf('before-clear') !== -1, out.log);
        ok('លុប DSN ➜ client ត្រូវផ្តាច់ពិត (close ឬ bindClient(undefined))',
            (out.log.closed + out.log.unbound) >= 1, out.log);
        ok('លុប DSN ➜ event ក្រោយមកលែងផ្ញើ', out.log.sent.indexOf('after-clear') === -1, out.log);
        await ctx.close();
    }

    // ៤ — init ២ ដងស្របគ្នា (boot + saveFirebaseConfig) ➜ DSN ចុងក្រោយត្រូវឈ្នះ
    {
        const { ctx, page } = await makePage(browser, origin, 60);
        const out = await page.evaluate(async () => {
            const wait = (ms) => new Promise((x) => setTimeout(x, ms));
            const first = window.ZoeErrors.init('zoew');
            window.ZoeErrors.setDsn('https://new@o0.ingest.sentry.io/2');
            const second = window.ZoeErrors.init('zoew');
            await Promise.all([first, second]);
            await wait(150);
            return { log: window.__log };
        });
        const last = out.log.init[out.log.init.length - 1] || '';
        ok('init ស្របគ្នា ➜ DSN ចុងក្រោយឈ្នះ (init ចាស់មិនសរសេរជាន់)',
            last.indexOf('new@') !== -1, out.log);
        ok('init ស្របគ្នា ➜ មិន init ស្ទួនដោយឥតប្រយោជន៍',
            out.log.init.length === 1, out.log);
        await ctx.close();
    }

    await browser.close();
    server.close();
    console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')' : '✅ ជោគជ័យ ' + pass));
    process.exit(fail ? 1 : 0);
})().then(() => {}, (e) => { console.log('ERROR', e && e.message || e); process.exit(1); });
