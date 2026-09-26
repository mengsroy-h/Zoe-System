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
window.__log = { init: [], sent: [], scopes: [], closed: 0, unbound: 0 };
(function () {
    var bound = false;
    window.Sentry = {
        init: function (o) { window.__log.init.push(o && o.dsn); bound = true; },
        captureException: function (e, s) { if (!bound) return; window.__log.sent.push(String(e && e.message || e)); window.__log.scopes.push({ msg: String(e && e.message || e), tags: (s && s.tags) || null, hasExtra: !!(s && s.extra), extra: (s && s.extra) || null }); },
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
    await page.addInitScript(() => {
        window.__sentrySdkLoaded = false;
        document.addEventListener('load', (event) => {
            const script = event.target;
            if (script && script.tagName === 'SCRIPT' && script.src.indexOf('sentry-cdn.com') !== -1) {
                setTimeout(() => { window.__sentrySdkLoaded = true; }, 0);
            }
        }, true);
    });
    await page.addInitScript(`window.localStorage.setItem('zoe_sentry_dsn', 'https://k@o0.ingest.sentry.io/1');`);
    await page.goto(origin + '/', { waitUntil: 'domcontentloaded' });
    await page.addScriptTag({ url: '/error-reporting.js' });
    return { ctx, page };
}

async function waitForSdkLoad(page) {
    // ព្រឹត្តិការណ៍ load បញ្ជាក់តែការមកដល់ SDK។ កុំរង់ចាំ sent/init ដែល
    // ជាលទ្ធផលដែល assertion ខាងក្រោមត្រូវវាស់ដោយឯករាជ្យ។
    try {
        await page.waitForFunction(() => window.__sentrySdkLoaded === true, null, { timeout: 5000 });
    } catch (e) {
        ok('SDK មិនមានព្រឹត្តិការណ៍ load ក្នុងពិដាន ៥ វិនាទី', false);
    }
}

async function readSentryLog(page) {
    // SDK មិនមកដល់ក្នុងពិដាន ➜ assertion ក្រហមដែលមានឈ្មោះ; មិនបោះ
    // TypeError ដោយអាន __log ដែលមិនទាន់មាន រួចលេបសេណារីយ៉ូក្រោយ។
    return page.evaluate(() => window.__log || { init: [], sent: [], scopes: [], closed: 0, unbound: 0 });
}

(async () => {
    const server = await serve(path.join(ROOT, 'ZoeW'));
    const origin = 'http://127.0.0.1:' + server.address().port;
    const browser = await chromium.launch({ executablePath: CHROME });

    // ១ — CDN យឺតលើសបង្អួច timeout រួចមកដល់ក្រោយមក
    {
        const { ctx, page } = await makePage(browser, origin, 700);
        const started = await page.evaluate(() => window.ZoeErrors.init('zoew'));
        await waitForSdkLoad(page);
        await page.evaluate(() => {
            window.ZoeErrors.capture(new Error('after-late-load'));
        });
        const out = { started, log: await readSentryLog(page) };
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
        await page.evaluate(async () => {
            window.ZoeErrors.capture(new Error('boot-error'));
            const started = window.ZoeErrors.init('zoew');
            window.ZoeErrors.capture(new Error('boot-error-2'));
            await started;
        });
        await waitForSdkLoad(page);
        const out = { log: await readSentryLog(page) };
        ok('error មុន SDK មកដល់ ➜ ត្រូវទុកជួរ រួចផ្ញើពេលរួចរាល់',
            out.log.sent.indexOf('boot-error') !== -1 && out.log.sent.indexOf('boot-error-2') !== -1, out.log);
        await ctx.close();
    }

    // ៥ — `zone` ត្រូវក្លាយជា **tag** មិនមែន `extra`
    // ⛔ ច្បាប់ជាមួយ Sentry ៖ **alert rule ស្វែងរកបានតែលើ tag** — `extra`
    //    មិនអាចជាលក្ខខណ្ឌបានទេ។ បើ `zone` ដេកនៅ `extra` នោះការជូនដំណឹង
    //    «កំហុសលុយ» **សរសេរមិនកើត** ហើយ Sentry ក្លាយជាកន្លែងទុកកំហុសដែល
    //    គ្មាននរណាមើល។
    {
        const { ctx, page } = await makePage(browser, origin, 300);
        await page.evaluate(async () => {
            await window.ZoeErrors.init('zoew');
            window.ZoeErrors.capture(new Error('money-err'), { zone: 'money', context: 'x' });
            window.ZoeErrors.capture(new Error('plain-err'), { context: 'x' });
            window.ZoeErrors.capture(new Error('bad-zone'), { zone: 'NOT A TAG!', context: 'x' });
            window.ZoeErrors.capture(new Error('no-extra'));
        });
        await waitForSdkLoad(page);
        const out = await readSentryLog(page);
        const scopes = Array.isArray(out.scopes) ? out.scopes : [];
        const find = (m) => scopes.filter((x) => x.msg === m)[0];
        ok('`zone` ក្លាយជា tag ពិតដែលទៅដល់ Sentry (alert rule ស្វែងរកបាន)',
            find('money-err') && find('money-err').tags && find('money-err').tags.zone === 'money',
            find('money-err'));
        ok('`zone` នៅតែស្ថិតក្នុង `extra` ដែរ (សម្រាប់អ្នកអានកំហុស)',
            find('money-err') && find('money-err').hasExtra === true);
        ok('⛔ គ្មាន `zone` ➜ គ្មាន tag (មិនប៉ះការហៅដែលមានស្រាប់)',
            find('plain-err') && find('plain-err').tags === null, find('plain-err'));
        ok('⛔ `zone` ដែលមិនត្រឹមទម្រង់ ត្រូវច្រានចេញ (កុំបំពុលបញ្ជី tag)',
            find('bad-zone') && find('bad-zone').tags === null, find('bad-zone'));
        ok('⛔ capture() គ្មាន extra សោះ នៅតែដំណើរការ',
            out.sent.indexOf('no-extra') !== -1, out.sent);
        await ctx.close();
    }

    // ៦ — ⛔ Sentry storm ៖ event ដដែលៗ (សារ + context + zone ដូចគ្នា) មិនត្រូវស៊ីកូតា
    //    វាស់បានលើ Sentry ផលិតកម្ម ៖ listener ដែលត្រូវបដិសេធ ➜ ៧ event រាល់ជុំស្តារ (៦៣ ក្នុង ២ នាទី) ·
    //    `disconnect` លើការសម្អាតរាល់នាទី ➜ កូតាអស់ ➜ **ការជូនដំណឹង `zone: 'money'` ពិតបាត់**។
    //    ច្បាប់ ៖ event ដំបូងនៃហត្ថលេខានីមួយៗផ្ញើជានិច្ច · ដដែលក្នុងបង្អួច ➜ ទប់ · ក្រោយបង្អួច ➜ ផ្ញើវិញ ជាមួយចំនួនដែលទប់ ·
    //    នាឡិកាថយក្រោយ ➜ fail-open (ផ្ញើ)
    {
        const { ctx, page } = await makePage(browser, origin, 0);
        await page.evaluate(() => window.ZoeErrors.init('zoew'));
        await waitForSdkLoad(page);
        const out = await page.evaluate(() => {
            const realNow = Date.now;
            let offset = 0;
            Date.now = () => realNow() + offset;
            for (let i = 0; i < 40; i++) window.ZoeErrors.capture(new Error('storm-err'), { context: 'Firebase listener error' });
            window.ZoeErrors.capture(new Error('storm-err'), { context: 'another context' });
            window.ZoeErrors.capture(new Error('storm-err'), { zone: 'money', context: 'Firebase listener error' });
            window.ZoeErrors.capture(new Error('distinct-a'));
            window.ZoeErrors.capture(new Error('distinct-b'));
            const midSent = window.__log.sent.filter((m) => m === 'storm-err').length;
            offset = 11 * 60 * 1000;
            window.ZoeErrors.capture(new Error('storm-err'), { context: 'Firebase listener error' });
            offset = -60 * 1000;
            window.ZoeErrors.capture(new Error('distinct-a'));
            Date.now = realNow;
            return { log: window.__log, midSent };
        });
        const storm = out.log.scopes.filter((x) => x.msg === 'storm-err');
        ok('លក្ខខណ្ឌចាំបាច់ ៖ event ដំបូងទៅដល់ Sentry', storm.length >= 1, storm.length);
        ok('⛔ event ដដែល ៤០ ដងក្នុងបង្អួច ➜ ផ្ញើតែ ១ (context ដូចគ្នា)', out.midSent === 3, out.midSent);
        ok('⛔ ទិសផ្ទុយ ៖ context ផ្សេង ឬ zone ផ្សេង ➜ ហត្ថលេខាផ្សេង ➜ ផ្ញើ', storm.filter((x) => x.extra && x.extra.context === 'another context').length === 1
            && storm.filter((x) => x.tags && x.tags.zone === 'money').length === 1, storm.map((x) => x.extra));
        ok('⛔ ទិសផ្ទុយ ៖ សារផ្សេងគ្នាទៅដល់ទាំងអស់', out.log.sent.indexOf('distinct-a') !== -1 && out.log.sent.indexOf('distinct-b') !== -1, out.log.sent);
        const resent = storm.filter((x) => x.extra && x.extra.context === 'Firebase listener error' && !(x.tags && x.tags.zone));
        ok('⛔ ក្រោយបង្អួចផុត ➜ ផ្ញើវិញ ជាមួយចំនួនដែលបានទប់ (suppressedRepeats = 39)',
            resent.length === 2 && resent[1].extra.suppressedRepeats === 39, resent.map((x) => x.extra));
        ok('⛔ នាឡិកាថយក្រោយ ➜ fail-open (ផ្ញើ មិនទប់ជារៀងរហូត)', out.log.sent.filter((m) => m === 'distinct-a').length === 2, out.log.sent);
        await ctx.close();
    }

    // ៦ខ — ⛔ ការទប់ព្យុះមិនត្រូវលេប *អត្តសញ្ញាណ* ៖ event លុយដដែល (សារ + context) លើ **កញ្ចប់ផ្សេងគ្នា** (`itemId`)
    //    ឬ **path ផ្សេងគ្នា** ជាព័ត៌មានដាច់ដោយឡែក ➜ Admin ត្រូវការ id នីមួយៗដើម្បីពិនិត្យលើ Console
    //    (សារ «ទិន្នន័យកញ្ចប់ … អាចនឹងបាត់! សូមប្រាប់ Admin»)។ ព្យុះលើ id ដដែលនៅតែទប់ · ពិដានអត្តសញ្ញាណក្នុងមួយបង្អួច។
    {
        const { ctx, page } = await makePage(browser, origin, 0);
        await page.evaluate(() => window.ZoeErrors.init('zoew'));
        await waitForSdkLoad(page);
        const out = await page.evaluate(() => {
            const ctxName = 'claimAndCleanupItem trash write failed after retries';
            window.ZoeErrors.capture(new Error('trash-fail'), { zone: 'money', context: ctxName, itemId: 'id_A' });
            window.ZoeErrors.capture(new Error('trash-fail'), { zone: 'money', context: ctxName, itemId: 'id_B' });
            for (let i = 0; i < 10; i++) window.ZoeErrors.capture(new Error('trash-fail'), { zone: 'money', context: ctxName, itemId: 'id_A' });
            for (let i = 0; i < 20; i++) window.ZoeErrors.capture(new Error('tx-unknown'), { zone: 'money', context: 'runTransactionResolved', path: '/p/' + i });
            return window.__log;
        });
        const ids = out.scopes.filter((x) => x.msg === 'trash-fail').map((x) => x.extra && x.extra.itemId);
        ok('⛔ event លុយដដែលលើកញ្ចប់ ២ ផ្សេងគ្នា ➜ id ទាំង ២ ទៅដល់ Sentry', ids.indexOf('id_A') !== -1 && ids.indexOf('id_B') !== -1, ids);
        ok('⛔ ទិសផ្ទុយ ៖ ព្យុះលើ id ដដែល ➜ នៅតែទប់ (id_A ១ ដង)', ids.filter((x) => x === 'id_A').length === 1, ids);
        const paths = out.scopes.filter((x) => x.msg === 'tx-unknown').length;
        ok('⛔ path ផ្សេងគ្នា ➜ ផ្ញើច្រើនជាង ១ តែមានពិដាន (កុំស៊ីកូតា)', paths >= 2 && paths <= 5, paths);
        await ctx.close();
    }

    // ៣ — លុប DSN ➜ ត្រូវផ្តាច់ client ពិត
    {
        const { ctx, page } = await makePage(browser, origin, 0);
        await page.evaluate(() => window.ZoeErrors.init('zoew'));
        await waitForSdkLoad(page);
        await page.evaluate(async () => {
            window.ZoeErrors.capture(new Error('before-clear'));
            window.ZoeErrors.setDsn('');
            await window.ZoeErrors.init('zoew');
            window.ZoeErrors.capture(new Error('after-clear'));
        });
        const out = { log: await readSentryLog(page) };
        ok('មុនលុប DSN ➜ event ទៅដល់ធម្មតា', out.log.sent.indexOf('before-clear') !== -1, out.log);
        ok('លុប DSN ➜ client ត្រូវផ្តាច់ពិត (close ឬ bindClient(undefined))',
            (out.log.closed + out.log.unbound) >= 1, out.log);
        ok('លុប DSN ➜ event ក្រោយមកលែងផ្ញើ', out.log.sent.indexOf('after-clear') === -1, out.log);
        await ctx.close();
    }

    // ៤ — init ២ ដងស្របគ្នា (boot + saveFirebaseConfig) ➜ DSN ចុងក្រោយត្រូវឈ្នះ
    {
        const { ctx, page } = await makePage(browser, origin, 60);
        await page.evaluate(async () => {
            const first = window.ZoeErrors.init('zoew');
            window.ZoeErrors.setDsn('https://new@o0.ingest.sentry.io/2');
            const second = window.ZoeErrors.init('zoew');
            await Promise.all([first, second]);
        });
        await waitForSdkLoad(page);
        const out = { log: await readSentryLog(page) };
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
