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
window.__log = { init: [], releases: [], sent: [], scopes: [], closed: 0, unbound: 0 };
(function () {
    var bound = false;
    window.Sentry = {
        init: function (o) { window.__log.init.push(o && o.dsn); window.__log.releases.push(o && o.release); bound = true; },
        captureException: function (e, s) { if (!bound) return; window.__log.sent.push(String(e && e.message || e)); window.__log.scopes.push({ msg: String(e && e.message || e), tags: (s && s.tags) || null, hasExtra: !!(s && s.extra), extra: (s && s.extra) || null }); },
        setTag: function () {},
        close: function () { window.__log.closed++; bound = false; return Promise.resolve(true); },
        getCurrentHub: function () {
            return { bindClient: function (c) { if (c === undefined) { window.__log.unbound++; bound = false; } } };
        }
    };
})();
`;

// Loader ក្លែង (`js.sentry-cdn.com/<key>.min.js` ក្នុង index.html) ៖ ច្របាច់ option របស់ App ពីលើការកំណត់លំនាំដើមរបស់ Loader
// ដែលម្ចាស់កំណត់ក្នុង Sentry UI (Session Replay 0.1/1.0 · tracing · logs · PII) ដូច Loader ពិត ➜ option ដែល App មិនកំណត់ = លំនាំដើមរបស់ UI។
const LOADER_SDK = `
window.__loader = { merged: [] };
(function () {
    var defaults = { dsn: 'https://k@o0.ingest.sentry.io/1', tracesSampleRate: 1, replaysSessionSampleRate: 0.1, replaysOnErrorSampleRate: 1, enableLogs: true, sendDefaultPii: true };
    window.Sentry = {
        onLoad: function (cb) { cb(); },
        init: function (o) {
            var merged = {};
            Object.keys(defaults).forEach(function (k) { merged[k] = defaults[k]; });
            Object.keys(o || {}).forEach(function (k) { merged[k] = o[k]; });
            window.__loader.merged.push({ traces: merged.tracesSampleRate, replaySession: merged.replaysSessionSampleRate, replayError: merged.replaysOnErrorSampleRate,
                logs: merged.enableLogs, pii: merged.sendDefaultPii, beforeSend: typeof merged.beforeSend, beforeBreadcrumb: typeof merged.beforeBreadcrumb });
        },
        setTag: function () {},
        captureException: function () {},
        close: function () { return Promise.resolve(true); },
        getCurrentHub: function () { return { bindClient: function () {} }; }
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

// ⛔ SENTRY-3 ៖ event គ្មាន release ➜ Sentry មិនបែងចែកកំណែ (regression · «Resolve ក្នុងកំណែបន្ទាប់» មិនដំណើរការ)។ ច្បាប់ ៖
//    រាល់ការហៅ `ZoeErrors.init(` ក្នុង App ទាំងពីរផ្តល់ release `<app>@<APP_VERSION>` (ដេរីវេពីកូដ ship ពិត · វាយតម្លៃ argument ក្នុង vm)។
function releaseCallSites(file, appName) {
    const vm = require('vm');
    const full = path.join(ROOT, file);
    if (!fs.existsSync(full)) return { calls: [], version: '', file };
    const src = fs.readFileSync(full, 'utf8');
    const version = (/(?:^|\n)\s*const APP_VERSION\s*=\s*'([^']+)'/.exec(src) || [])[1] || '';
    const calls = [];
    const re = /ZoeErrors\.init\(/g;
    let m;
    while ((m = re.exec(src)) !== null) {
        let depth = 1, i = m.index + m[0].length;
        for (; i < src.length && depth; i++) {
            if (src[i] === '(') depth++;
            else if (src[i] === ')') depth--;
        }
        const args = src.slice(m.index + m[0].length, i - 1);
        let value;
        try { value = vm.runInNewContext('[' + args + ']', { APP_VERSION: version }); } catch (e) { value = ['throw:' + e.message]; }
        calls.push({ args, value, want: appName + '@' + version });
    }
    return { calls, version, file };
}

(async () => {
    {
        [['ZoeW/app.js', 'zoew'], ['ZoeKeyGen/app.js', 'zoekeygen']].forEach(([file, appName]) => {
            const r = releaseCallSites(file, appName);
            ok('ជាន់អប្បបរមា ៖ ' + file + ' មាន APP_VERSION និងការហៅ `ZoeErrors.init(` យ៉ាងតិច ២', !!r.version && r.calls.length >= 2, r);
            r.calls.forEach((c, i) => {
                ok('⛔ ' + file + ' ការហៅ `ZoeErrors.init(` ទី ' + (i + 1) + ' ផ្តល់ release `' + c.want + '`',
                    Array.isArray(c.value) && c.value[0] === appName && c.value[1] === c.want, { args: c.args, value: c.value });
            });
        });
    }

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

    // ៥ខ — ⛔ SENTRY-3 ៖ release ទៅដល់ `Sentry.init` · វាល primitive ដែលកំណត់ក្នុង allowlist របស់ Error (`lookupCode` · `txOutcome` …)
    //    ទៅដល់ `extra.errorFields` (មុនកែ ៖ បាត់ ➜ event «Transaction outcome unknown» មិនប្រាប់ outcome) · វាលផ្សេង/វត្ថុ មិនផ្ញើ
    {
        const { ctx, page } = await makePage(browser, origin, 0);
        await page.evaluate(async () => {
            await window.ZoeErrors.init('zoew', 'zoew@9.8.7');
            const e1 = new Error('fields-err');
            e1.lookupCode = 'ZTO_UPSTREAM_REJECTED';
            e1.txOutcome = 'unknown';
            e1.txServerUnread = true;
            e1.status = 503;
            e1.privateNote = 'SHOULD_NOT_SEND';
            e1.lookupReason = { nested: 'x' };
            e1.code = 'X'.repeat(500);
            window.ZoeErrors.capture(e1, { zone: 'money', context: 'probe' });
            const e2 = new Error('fields-no-extra');
            e2.txOutcome = 'not-applied';
            window.ZoeErrors.capture(e2);
            window.ZoeErrors.capture(new Error('no-fields-no-extra'));
        });
        await waitForSdkLoad(page);
        const out = await readSentryLog(page);
        const scopes = Array.isArray(out.scopes) ? out.scopes : [];
        const find = (m) => scopes.filter((x) => x.msg === m)[0];
        const f1 = find('fields-err');
        const fields = f1 && f1.extra && f1.extra.errorFields;
        ok('⛔ release ទៅដល់ Sentry.init', Array.isArray(out.releases) && out.releases.indexOf('zoew@9.8.7') !== -1, out.releases);
        ok('⛔ វាល Error ក្នុង allowlist ទៅដល់ extra.errorFields (lookupCode · txOutcome · txServerUnread · status)',
            !!fields && fields.lookupCode === 'ZTO_UPSTREAM_REJECTED' && fields.txOutcome === 'unknown' && fields.txServerUnread === true && fields.status === 503, f1);
        ok('⛔ វាលក្រៅ allowlist និងតម្លៃវត្ថុ មិនផ្ញើ · ខ្សែអក្សរវែងកាត់ (≤ 200)',
            !!fields && !('privateNote' in fields) && !('lookupReason' in fields) && typeof fields.code === 'string' && fields.code.length <= 200
                && JSON.stringify(f1).indexOf('SHOULD_NOT_SEND') === -1, f1);
        ok('⛔ extra របស់អ្នកហៅនៅដដែល (zone ➜ tag · context)', !!f1 && f1.tags && f1.tags.zone === 'money' && f1.extra.context === 'probe', f1);
        const f2 = find('fields-no-extra');
        ok('⛔ Error មានវាល តែគ្មាន extra ➜ extra.errorFields នៅតែទៅ', !!f2 && f2.extra && f2.extra.errorFields && f2.extra.errorFields.txOutcome === 'not-applied', f2);
        const f3 = find('no-fields-no-extra');
        ok('⛔ ទិសផ្ទុយ ៖ Error គ្មានវាល គ្មាន extra ➜ គ្មាន extra (មិនប្តូរ scope)', !!f3 && f3.hasExtra === false, f3);
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

    // ៥ — Loader ពិត (index.html) ច្របាច់ option ពីលើលំនាំដើមរបស់ Sentry UI ➜ App ត្រូវបិទ Replay · tracing · logs · PII ដោយខ្លួនឯង
    //     ⛔ Session Replay · span (`http.client` មាន URL ពេញ) · log មិនឆ្លង `beforeSend`/`beforeBreadcrumb` ➜ ការលាក់ secret មិនគ្រប ➜
    //     មានតែ error event ដែលបានលាក់ secret ទើបចេញពីឧបករណ៍ (ផ្លូវទាំង ២ ៖ `tagApp()` តាម onLoad · `applySentryInit()` តាម DSN)
    {
        const ctx = await browser.newContext();
        const page = await ctx.newPage();
        await page.route('**', async (r) => {
            const u = r.request().url();
            if (u.indexOf('js.sentry-cdn.com') !== -1) return r.fulfill({ status: 200, contentType: 'application/javascript', body: LOADER_SDK });
            if (u.indexOf('sentry-cdn.com') !== -1) return r.fulfill({ status: 200, contentType: 'application/javascript', body: FAKE_SDK });
            if (u.startsWith(origin)) return r.continue();
            return r.abort();
        });
        await page.addInitScript(`window.localStorage.setItem('zoe_sentry_dsn', 'https://k@o0.ingest.sentry.io/1');`);
        await page.goto(origin + '/', { waitUntil: 'domcontentloaded' });
        await page.addScriptTag({ url: 'https://js.sentry-cdn.com/k.min.js' });
        await page.addScriptTag({ url: '/error-reporting.js' });
        await page.evaluate(() => window.ZoeErrors.init('zoew', 'zoew@9.8.7'));
        const merged = await page.evaluate(() => (window.__loader && window.__loader.merged) || []);
        ok('ជាន់អប្បបរមា ៖ App ហៅ `Sentry.init()` តាម Loader ២ ផ្លូវ (onLoad · DSN)', merged.length >= 2, merged);
        const leaks = merged.filter((m) => m.traces !== 0 || m.replaySession !== 0 || m.replayError !== 0 || m.logs !== false || m.pii !== false
            || m.beforeSend !== 'function' || m.beforeBreadcrumb !== 'function');
        ok('⛔ Loader + option របស់ App ➜ Session Replay = 0 · tracing = 0 · logs បិទ · PII បិទ · beforeSend/beforeBreadcrumb លាក់ secret (គ្រប់ការហៅ init)',
            merged.length >= 1 && leaks.length === 0, merged);
        const probe = await page.evaluate(() => { window.Sentry.init({}); const m = window.__loader.merged; return m[m.length - 1]; });
        ok('ទិសផ្ទុយ ៖ Loader ក្លែងបើក Replay · tracing · logs ពេល App មិនកំណត់ (ការវាស់អាចក្រហមពិត)',
            !!probe && probe.traces === 1 && probe.replaySession === 0.1 && probe.replayError === 1 && probe.logs === true, probe);
        await ctx.close();
    }

    await browser.close();
    server.close();
    console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')' : '✅ ជោគជ័យ ' + pass));
    process.exit(fail ? 1 : 0);
})().then(() => {}, (e) => { console.log('ERROR', e && e.message || e); process.exit(1); });
