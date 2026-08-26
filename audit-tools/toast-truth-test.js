// Toasts and status labels must report what is TRUE RIGHT NOW.
//
// The class of bug this locks down was reported from production with a
// screenshot: the app had booted offline from a cached auth session, every
// figure on screen was 0 — and it announced «ចូលប្រព័ន្ធជោគជ័យ!» while the
// navbar label read «ក្រៅបណ្ដាញ» painted in the connected green. Three
// separate lies in one frame:
//
//   1. the label's colour was hard-coded `var(--success)` in `.brand-info span`,
//      so «ក្រៅបណ្ដាញ» rendered green — a CSS-only bug that no JS test could see;
//   2. every toast shared one dark pill, so a ⚠️ warning and a ✅ success were
//      visually identical;
//   3. the sign-in toast was a frozen literal fired from `onAuthStateChanged`,
//      which restores a cached user with no network at all.
//
// So this checker asserts TWO SIDES everywhere. "The success toast is green"
// alone stays green if every toast is green; "the sign-in toast is honest when
// offline" alone passes if it is honest and then never corrects itself. Each
// claim below is paired with the claim that would be false if the fix were
// only cosmetic.
//
// The browser half runs the REAL sliced functions against the REAL stylesheet:
// module-level `let`s never reach `window` in this project, so the state is
// injected around the real code rather than poked at through globals.

const fs = require('fs');
const path = require('path');

let chromium;
try { chromium = require('playwright-core').chromium; } catch (e) { chromium = null; }
const CHROME = process.env.TOAST_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const ROOT = path.resolve(process.env.TOAST_APP_DIR || path.join(__dirname, '..'));

let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { console.log('   ok    ' + label); pass++; }
    else { console.log('  FAIL   ' + label + (detail !== undefined ? '  got: ' + JSON.stringify(detail) : '')); fail++; }
}

function read(rel) {
    return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function sliceFn(src, name) {
    let start = src.indexOf('function ' + name + '(');
    if (start === -1) return null;
    if (src.slice(Math.max(0, start - 6), start) === 'async ') start -= 6;
    let depth = 0, i = src.indexOf('{', start), started = false;
    for (; i < src.length; i++) {
        if (src[i] === '{') { depth++; started = true; }
        else if (src[i] === '}') { depth--; if (started && depth === 0) { i++; break; } }
    }
    return src.slice(start, i);
}

function sliceConst(src, name) {
    const start = src.indexOf('const ' + name + ' =');
    if (start === -1) return null;
    let i = start, depth = 0;
    for (; i < src.length; i++) {
        const c = src[i];
        if (c === '[' || c === '{' || c === '(') depth++;
        else if (c === ']' || c === '}' || c === ')') depth--;
        else if (c === ';' && depth === 0) return src.slice(start, i + 1);
    }
    return null;
}

const APPS = ['ZoeW', 'ZoeKeyGen'];
const KINDS = ['info', 'success', 'warn', 'error'];

// ── ១. ការចាត់ថ្នាក់ toast — ២ ខាង ───────────────────────────────────
// មិនគ្រប់គ្រាន់ទេ បើគ្រាន់តែ «មានថ្នាក់ success»។ ថ្នាក់នីមួយៗត្រូវ
// **មើលទៅខុសគ្នា** បើមិនដូច្នេះ ⚠️ និង ✅ នៅតែដូចគ្នាបេះបិទ។
console.log('-- ១. ថ្នាក់ toast មានក្នុងកូដ និងមានពណ៌ដាច់ដោយឡែកក្នុង CSS --');
for (const app of APPS) {
    const js = read(app + '/app.js');
    const css = read(app + '/style.css');

    ok(app + ' ៖ showToast ទទួល kind', /function showToast\(msg, kind\)/.test(js));
    ok(app + ' ៖ មាន toastKindOf អានសញ្ញាចេញពីសារ', /function toastKindOf\(/.test(js));
    ok(app + ' ៖ paintToast សរសេរឈ្មោះ class ពេញ (មិនផ្គុំតាម string)',
        KINDS.every((kind) => js.indexOf("'toast-" + kind + "'") !== -1));

    const backgrounds = {};
    KINDS.forEach((kind) => {
        const rule = new RegExp('\\.toast-' + kind + '\\s*\\{([^}]*)\\}').exec(css);
        const decl = rule ? /background(?:-color)?:\s*([^;]+);/.exec(rule[1]) : null;
        backgrounds[kind] = decl ? decl[1].trim() : null;
    });
    const named = KINDS.filter((k) => backgrounds[k]);
    ok(app + ' ៖ CSS មានផ្ទៃខាងក្រោយសម្រាប់ថ្នាក់ទាំង ' + KINDS.length,
        named.length === KINDS.length, backgrounds);
    ok(app + ' ៖ ហើយពណ៌ទាំងនោះមិនដូចគ្នា (បើដូច = គ្មានសញ្ញាអ្វីទាល់តែសោះ)',
        named.length === KINDS.length &&
        new Set(named.map((k) => backgrounds[k])).size === KINDS.length, backgrounds);
}

// ── ២. ស្លាកស្ថានភាព — ពណ៌ត្រូវប្តូរតាមស្ថានភាព ─────────────────────
// នេះជាកំហុសក្នុងរូបថតដោយផ្ទាល់៖ `.brand-info span { color: var(--success) }`
// ធ្វើឲ្យអក្សរ «ក្រៅបណ្ដាញ» ចេញជាពណ៌បៃតងនៃការភ្ជាប់។
console.log('\n-- ២. ស្លាកស្ថានភាពក្នុងរបាខាងលើ ត្រូវប្តូរពណ៌តាមស្ថានភាព --');
for (const app of APPS) {
    const js = read(app + '/app.js');
    const css = read(app + '/style.css');
    const render = sliceFn(js, 'renderConnectionStatus') || '';

    ok(app + ' ៖ renderConnectionStatus ដាក់ class តាមស្ថានភាព',
        /is-online/.test(render) && /is-connecting/.test(render) && /is-offline/.test(render));
    ok(app + ' ៖ CSS ផ្តល់ពណ៌ដាច់ដោយឡែកឲ្យ is-online និង is-offline',
        /#firebaseStatusText\.is-online\s*\{/.test(css) && /#firebaseStatusText\.is-offline\s*\{/.test(css));
    ok(app + ' ៖ ស្លាកនោះលែងចាក់ពណ៌តែមួយថេរ',
        !/\.brand-info span \{[^}]*color: var\(--success\)/.test(css));
    ok(app + ' ៖ renderConnectionStatus ផ្សាយបន្តទៅ toast ដែលរស់',
        /refreshLiveToasts\(\);/.test(render));
}

// ── ៣. ការប្រកាសចូលប្រព័ន្ធ មិនត្រូវជាអក្សរកកទៀតទេ ──────────────────
// `onAuthStateChanged` បាញ់ចេញពី session ដែល cache ទុក **ដោយគ្មានបណ្តាញ**
// សោះ — ដូច្នេះការសរសេរ «ជោគជ័យ» ត្រង់នោះ គឺជាការអះអាងដែលកូដមិនអាចដឹង។
console.log('\n-- ៣. ការប្រកាសចូលប្រព័ន្ធ ត្រូវអានស្ថានភាពពិត --');
for (const app of APPS) {
    const js = read(app + '/app.js');
    ok(app + ' ៖ គ្មាន showToast("ចូលប្រព័ន្ធជោគជ័យ!") ជាអក្សរកក',
        js.indexOf('showToast("ចូលប្រព័ន្ធជោគជ័យ!")') === -1);
    ok(app + ' ៖ ប្រកាសតាម showLiveToast(\'signin\')', /showLiveToast\('signin'\)/.test(js));
    const state = sliceFn(js, 'liveToastState') || '';
    ok(app + ' ៖ liveToastState ពិនិត្យ navigator.onLine', /navigator\.onLine === false/.test(state));
    ok(app + ' ៖ ហើយបញ្ជាក់ថាស្ថានភាពណាទើប «ចប់»', /settled: true/.test(state) && /settled: false/.test(state));
    const live = sliceFn(js, 'showLiveToast') || '';
    ok(app + ' ៖ toast ដែលរស់ តែងតែមានពេលកំណត់ (មិនស្ថិតជាប់អេក្រង់)',
        /armToastDismiss\(toast, TOAST_LIVE_LIMIT_MS\)/.test(live));
}

// ── ៤. ZoeW ៖ ការទាញទិន្នន័យរួច ជាផ្នែកនៃសេចក្តីពិត ──────────────────
console.log('\n-- ៤. ZoeW ៖ «ភ្ជាប់រួច» មិនដូច «ទិន្នន័យមកដល់ហើយ» --');
{
    const js = read('ZoeW/app.js');
    const state = sliceFn(js, 'liveToastState') || '';
    ok('ZoeW ៖ liveToastState មើល dbListenerPendingPaths', /dbListenerPendingPaths\.size/.test(state));
    ok('ZoeW ៖ និងមើល dbListenersFailed', /dbListenersFailed/.test(state));
    const alive = sliceFn(js, 'noteDbListenerAlive') || '';
    ok('ZoeW ៖ snapshot ចុងក្រោយមកដល់ ➜ ធ្វើឲ្យ toast ស្រស់ភ្លាម',
        /refreshLiveToasts\(\)/.test(alive));
    const proceed = sliceFn(js, 'proceedAfterLogin') || '';
    const toastAt = proceed.indexOf("showLiveToast('signin')");
    const listenersAt = proceed.indexOf('initDatabaseListeners()');
    ok('ZoeW ៖ ប្រកាសក្រោយភ្ជាប់ listener (បើមុន វានឹងឃើញ pending ទទេ ➜ កុហក)',
        toastAt !== -1 && listenersAt !== -1 && toastAt > listenersAt, { toastAt, listenersAt });
}

// ── ៥. ZoeImport ៖ សូចនាករតំណ ត្រូវតាមការពិតរាល់ការហៅ ─────────────
console.log('\n-- ៥. ZoeImport ៖ ស្ថានភាពតំណត្រូវប្តូរតាមលទ្ធផលពិត --');
{
    const js = read('ZoeImport/app.js');
    const html = read('ZoeImport/index.html');
    const call = sliceFn(js, 'callApi') || '';
    ok('ZoeImport ៖ មានសូចនាករក្នុងរបាខាងលើ',
        /id="linkStatusDot"/.test(html) && /id="linkStatusText"/.test(html));
    ok('ZoeImport ៖ callApi បដិសេធមុនចេញដំណើរ ពេលឧបករណ៍ក្រៅបណ្ដាញ',
        /navigator\.onLine === false/.test(call) && /setLinkState\('offline'\)/.test(call));
    ok('ZoeImport ៖ callApi កត់ត្រាជោគជ័យពិត', /setLinkState\('ok'\)/.test(call));
    ok('ZoeImport ៖ callApi កត់ត្រាការបរាជ័យពិត (មិនទុកសូចនាករបៃតងចោល)',
        /setLinkState\('bad'\)/.test(call));
    ok('ZoeImport ៖ ព្រឹត្តិការណ៍បណ្តាញគូរសូចនាករឡើងវិញ',
        /addEventListener\('online', renderLinkStatus\)/.test(js) &&
        /addEventListener\('offline', renderLinkStatus\)/.test(js));
    ok('ZoeImport ៖ ចាក់សោវិញ ➜ សូចនាករត្រឡប់ទៅ «មិនទាន់ភ្ជាប់»',
        /setLinkState\('idle'\)/.test(sliceFn(js, 'resetSessionState') || ''));
    ok('ZoeImport ៖ toast ចាត់ថ្នាក់តាមសញ្ញាក្នុងសារ', /function toastKindOf\(/.test(js));
}

// ── ៦. ក្នុង browser ពិត ៖ CSS ពិត + កូដពិត ─────────────────────────
const PROBE_FNS = ['toastKindOf', 'paintToast', 'armToastDismiss', 'showToast', 'settleLiveToast',
    'showLiveToast', 'refreshLiveToasts', 'liveToastState', 'connectionLooksOnline',
    'connectionIsSettlingIn', 'renderConnectionStatus'];
const PROBE_CONSTS = ['TOAST_LIFETIME_MS', 'TOAST_LIVE_LIMIT_MS', 'TOAST_CLASSES', 'TOAST_KIND_MARKS'];

function buildProbe(app) {
    const js = read(app + '/app.js');
    const parts = [];
    for (const name of PROBE_CONSTS) {
        const c = sliceConst(js, name);
        if (!c) return null;
        parts.push(c);
    }
    for (const name of PROBE_FNS) {
        const f = sliceFn(js, name);
        if (!f) return null;
        parts.push(f);
    }
    return 'window.__toastProbe = (function () {\n' +
        'let isDatabaseConnected = false;\n' +
        'let dbListenersFailed = false;\n' +
        'let isDatabaseInitialized = true;\n' +
        'let firebaseSdkUnavailable = false;\n' +
        'let reconnectWatchdogAttempt = 0;\n' +
        'const CONNECTING_GRACE_ATTEMPTS = 3;\n' +
        'const dbListenerPendingPaths = new Set();\n' +
        parts.join('\n') + '\n' +
        'return {\n' +
        '  set(s) {\n' +
        '    isDatabaseConnected = !!s.connected;\n' +
        '    dbListenersFailed = !!s.listenersFailed;\n' +
        '    reconnectWatchdogAttempt = s.watchdog || 0;\n' +
        '    dbListenerPendingPaths.clear();\n' +
        '    (s.pending || []).forEach((p) => dbListenerPendingPaths.add(p));\n' +
        '  },\n' +
        '  render: renderConnectionStatus,\n' +
        '  signin: () => showLiveToast(\'signin\'),\n' +
        '  liveCount: () => document.querySelectorAll(\'#toastContainer [data-live-toast]\').length\n' +
        '};\n' +
        '})();';
}

const http = require('http');
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.png': 'image/png' };
function serve(dir, port) {
    return new Promise((res) => {
        const s = http.createServer((req, rsp) => {
            let p = decodeURIComponent(req.url.split('?')[0]);
            if (p === '/') p = '/index.html';
            const f = path.join(dir, p);
            if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); return rsp.end(); }
            rsp.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'text/plain' });
            rsp.end(fs.readFileSync(f));
        });
        s.listen(port, () => res(s));
    });
}

function readToast(page) {
    return page.evaluate(() => {
        const el = document.querySelector('#toastContainer .toast');
        if (!el) return null;
        const cs = getComputedStyle(el);
        return { text: el.textContent, bg: cs.backgroundColor, live: el.dataset.liveToast || null, stamp: el.__probeStamp || null };
    });
}

(async () => {
    if (!chromium || !fs.existsSync(CHROME)) {
        console.log('\n-- ៦. browser ពិត — SKIP (គ្មាន playwright-core ឬ Chromium) --');
        console.log('\nសរុប: ' + pass + ' ok, ' + fail + ' FAIL');
        process.exit(fail ? 1 : 0);
    }
    console.log('\n-- ៦. browser ពិត ៖ CSS ពិត + កូដពិត --');
    const browser = await chromium.launch({ executablePath: CHROME });
    let port = 8560;
    for (const app of APPS) {
        const probe = buildProbe(app);
        const dir = path.join(ROOT, app);
        const server = await serve(dir, port);
        const ctx = await browser.newContext({ viewport: { width: 412, height: 780 } });
        const page = await ctx.newPage();
        await page.route('**', (route) => {
            const u = route.request().url();
            if (u.startsWith('http://127.0.0.1:' + port)) return route.continue();
            return route.abort();
        });
        try {
            await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'domcontentloaded', timeout: 20000 });
            await page.waitForTimeout(1200);

            const labelColours = await page.evaluate(() => {
                const el = document.getElementById('firebaseStatusText');
                const out = {};
                ['is-online', 'is-connecting', 'is-offline'].forEach((cls) => {
                    el.classList.remove('is-online', 'is-connecting', 'is-offline');
                    el.classList.add(cls);
                    out[cls] = getComputedStyle(el).color;
                });
                el.classList.remove('is-online', 'is-connecting', 'is-offline');
                out.bare = getComputedStyle(el).color;
                return out;
            });
            ok(app + ' ៖ (CSS សុទ្ធ) ស្លាកភ្ជាប់រួច និងក្រៅបណ្ដាញ មិនចេញពណ៌ដដែល',
                labelColours['is-online'] !== labelColours['is-offline'], labelColours);
            ok(app + ' ៖ (CSS សុទ្ធ) ស្លាកទទេ មិនត្រូវចេញជាពណ៌នៃការភ្ជាប់',
                labelColours.bare !== labelColours['is-online'], labelColours);

            if (!probe) {
                ok(app + ' ៖ ស្រង់កូដ toast ពិតចេញបាន', false, 'មុខងារ ឬថេររបស់ toast បាត់');
            } else {
                await page.evaluate(probe);

                // ស្លាកស្ថានភាព ៖ ពណ៌ត្រូវខុសគ្នាពិតៗ នៅក្នុង CSS ដែល ship
                const colours = await page.evaluate(() => {
                    const el = document.getElementById('firebaseStatusText');
                    const out = {};
                    [['online', { connected: true }],
                     ['connecting', { connected: false, watchdog: 0 }],
                     ['offline', { connected: false, watchdog: 9 }]].forEach(([name, state]) => {
                        window.__toastProbe.set(state);
                        window.__toastProbe.render();
                        out[name] = { colour: getComputedStyle(el).color, text: el.innerText || el.textContent };
                    });
                    return out;
                });
                ok(app + ' ៖ ស្លាក «ក្រៅបណ្ដាញ» មិនប្រើពណ៌ដដែលនឹង «ភ្ជាប់រួច»',
                    colours.offline.colour !== colours.online.colour, colours);
                ok(app + ' ៖ ស្លាក «កំពុងភ្ជាប់» ក៏មានពណ៌ផ្ទាល់ខ្លួនដែរ',
                    colours.connecting.colour !== colours.online.colour &&
                    colours.connecting.colour !== colours.offline.colour, colours);
                ok(app + ' ៖ អត្ថបទស្លាកនៅតែផ្លាស់តាមស្ថានភាពដដែល',
                    colours.online.text !== colours.offline.text, colours);

                // toast ដែលរស់ ៖ សេចក្តីពិតត្រូវផ្លាស់ **ក្នុងធាតុដដែល**
                await page.evaluate(() => {
                    window.__toastProbe.set({ connected: false });
                    window.__toastProbe.signin();
                    const el = document.querySelector('#toastContainer .toast');
                    if (el) el.__probeStamp = 'first';
                });
                const pending = await readToast(page);
                ok(app + ' ៖ ចូលប្រព័ន្ធខណៈ socket មិនទាន់ឡើង ➜ មិនអះអាងថាជោគជ័យ',
                    !!pending && pending.text.indexOf('ជោគជ័យ') === -1, pending);
                ok(app + ' ៖ ហើយ toast នោះនៅ «រស់» (រង់ចាំសេចក្តីពិតបន្ទាប់)',
                    !!pending && pending.live === 'signin', pending);
                const successBg = await page.evaluate(() => {
                    const probe = document.createElement('div');
                    probe.className = 'toast toast-success';
                    document.getElementById('toastContainer').appendChild(probe);
                    const bg = getComputedStyle(probe).backgroundColor;
                    probe.remove();
                    return bg;
                });
                ok(app + ' ៖ ហើយវាមិនប្រើពណ៌បៃតងនៃជោគជ័យ',
                    !!pending && pending.bg !== successBg, { toast: pending && pending.bg, success: successBg });

                await page.evaluate(() => {
                    window.__toastProbe.set({ connected: true, pending: ['history', 'deleted'] });
                    window.__toastProbe.render();
                });
                const loading = await readToast(page);
                if (app === 'ZoeW') {
                    ok(app + ' ៖ socket ឡើង តែ snapshot មិនទាន់មក ➜ នៅមិនអះអាងជោគជ័យ',
                        !!loading && loading.text.indexOf('ជោគជ័យ') === -1, loading);
                }
                ok(app + ' ៖ ការធ្វើឲ្យស្រស់ប្រើ **ធាតុដដែល** (realtime មិនមែន toast ថ្មី)',
                    !!loading && loading.stamp === 'first' &&
                    (await page.evaluate(() => document.querySelectorAll('#toastContainer .toast').length)) === 1,
                    loading);

                await page.evaluate(() => {
                    window.__toastProbe.set({ connected: true, pending: [] });
                    window.__toastProbe.render();
                });
                const settled = await readToast(page);
                ok(app + ' ៖ ភ្ជាប់រួច ហើយទិន្នន័យមកដល់ ➜ ទើបប្រកាសជោគជ័យ',
                    !!settled && settled.text.indexOf('ជោគជ័យ') !== -1, settled);
                ok(app + ' ៖ ជាមួយពណ៌ជោគជ័យពិត',
                    !!settled && settled.bg === successBg, { toast: settled && settled.bg, success: successBg });
                ok(app + ' ៖ ហើយវាឈប់ «រស់» ទៀត (លែងសរសេរជាន់)',
                    !!settled && settled.live === null &&
                    (await page.evaluate(() => window.__toastProbe.liveCount())) === 0, settled);
            }
        } catch (e) {
            ok(app + ' ៖ ការវាស់ក្នុង browser រត់បាន', false, String(e && e.message));
        }
        await ctx.close();
        server.close();
        port++;
    }

    // ZoeImport ៖ ការបាត់បណ្តាញពិត ត្រូវផ្លាស់សូចនាករដោយគ្មានការ Refresh
    {
        const dir = path.join(ROOT, 'ZoeImport');
        const server = await serve(dir, port);
        const ctx = await browser.newContext({ viewport: { width: 412, height: 780 } });
        const page = await ctx.newPage();
        await page.route('**', (route) => {
            const u = route.request().url();
            if (u.startsWith('http://127.0.0.1:' + port)) return route.continue();
            return route.abort();
        });
        try {
            await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'domcontentloaded', timeout: 20000 });
            await page.waitForTimeout(1200);
            const before = await page.evaluate(() => {
                const t = document.getElementById('linkStatusText');
                return { text: t.textContent, colour: getComputedStyle(t).color, cls: t.className };
            });
            await ctx.setOffline(true);
            await page.waitForTimeout(300);
            const after = await page.evaluate(() => {
                const t = document.getElementById('linkStatusText');
                return { text: t.textContent, colour: getComputedStyle(t).color, cls: t.className };
            });
            await ctx.setOffline(false);
            await page.waitForTimeout(300);
            const back = await page.evaluate(() => document.getElementById('linkStatusText').textContent);
            ok('ZoeImport ៖ បណ្តាញដាច់ ➜ សូចនាករប្តូរភ្លាមដោយគ្មាន Refresh',
                after.text !== before.text && after.text.indexOf('ក្រៅបណ្ដាញ') !== -1, { before, after });
            ok('ZoeImport ៖ ហើយប្តូរពណ៌ដែរ មិនត្រឹមតែអត្ថបទ',
                after.colour !== before.colour, { before, after });
            ok('ZoeImport ៖ បណ្តាញមកវិញ ➜ ត្រឡប់ទៅស្ថានភាពពិតវិញ',
                back === before.text, { back, before: before.text });
        } catch (e) {
            ok('ZoeImport ៖ ការវាស់ក្នុង browser រត់បាន', false, String(e && e.message));
        }
        await ctx.close();
        server.close();
    }

    await browser.close();
    console.log('\nសរុប: ' + pass + ' ok, ' + fail + ' FAIL');
    process.exit(fail ? 1 : 0);
})();
