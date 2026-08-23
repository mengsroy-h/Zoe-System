// ថ្នាក់៖ **ការសម្របតាមអត្រាស៊ុមរបស់អេក្រង់ (adaptive frame rate)**។
//
// គ្មាន API ណាលើ Web ដែលអាច *កំណត់* អត្រាស៊ុមរបស់អេក្រង់បានទេ — ប្រព័ន្ធជាអ្នកសម្រេច។
// អ្វីដែល App គ្រប់គ្រងបានគឺ **ការមិនធ្វើឲ្យ browser ខកខានស៊ុម**៖ វាស់អត្រាស៊ុមពិត
// របស់ឧបករណ៍ (10–120fps) រួចកំណត់ចង្វាក់ការងាររបស់ខ្លួនឲ្យសមនឹងថវិកាស៊ុមនោះ។
//
// តេស្តនេះដក function **ពិត** ចេញពី app.js មករត់ក្នុង Chromium ពិត ដោយប្រើ
// `requestAnimationFrame` ពិត និងព្រឹត្តិការណ៍ scroll ពិត។
let chromium;
try { chromium = require('playwright-core').chromium; } catch (e) { console.log('SKIP — ត្រូវការ playwright-core'); process.exit(0); }
const fs = require('fs'), http = require('http'), path = require('path');
const CHROME = process.env.FRAME_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
if (!fs.existsSync(CHROME)) { console.log('SKIP — រកមិនឃើញ Chromium'); process.exit(0); }
const ROOT = process.env.FRAME_APP_DIR || path.join(__dirname, '..');

let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { console.log('  ok    ' + label); pass++; }
    else { console.log('  FAIL  ' + label + (detail !== undefined ? '\n        ' + JSON.stringify(detail) : '')); fail++; }
}

function sliceFn(src, name) {
    let start = src.indexOf('function ' + name + '(');
    if (start === -1) return null;
    if (src.slice(Math.max(0, start - 6), start) === 'async ') start -= 6;
    let depth = 0, started = false, i = src.indexOf('{', start);
    for (; i < src.length; i++) {
        if (src[i] === '{') { depth++; started = true; }
        else if (src[i] === '}') { depth--; if (started && depth === 0) { i++; break; } }
    }
    return src.slice(start, i);
}

function constLine(src, name) {
    return (src.match(new RegExp('^ *const ' + name + ' = .*$', 'm')) || [''])[0];
}
function letLine(src, name) {
    return (src.match(new RegExp('^ *let ' + name + ' = .*$', 'm')) || [''])[0];
}

(async () => {
    const src = fs.readFileSync(path.join(ROOT, 'ZoeW', 'app.js'), 'utf8');

    const FNS = ['measureDisplayFrameRate', 'displayFrameRate', 'scrollQuietWindowMs', 'scrollIsActive',
        'runAfterScrollSettles', 'setupFrameBudget', 'liveScanMinIntervalMs', 'nextScanPaceMultiplier', 'nextScanDelayMs'];
    FNS.forEach((n) => ok('រកឃើញ ' + n + '() ក្នុង app.js', !!sliceFn(src, n)));
    if (FNS.some((n) => !sliceFn(src, n))) { console.log('\n❌ ធ្លាក់ ' + (fail || 1)); process.exit(1); }

    const CONSTS = ['FRAME_RATE_MIN_FPS', 'FRAME_RATE_MAX_FPS', 'FRAME_SAMPLE_COUNT', 'FRAME_SAMPLE_MAX_TRIES',
        'SCROLL_QUIET_FRAMES', 'SCROLL_QUIET_MIN_MS', 'DEFERRED_WORK_MAX_WAIT_MS',
        'LIVE_SCAN_MIN_INTERVAL_MS', 'LIVE_SCAN_MAX_INTERVAL_MS',
        'SCAN_PACE_MULTIPLIER_MIN', 'SCAN_PACE_MULTIPLIER_MAX', 'SCAN_PACE_DROP_THRESHOLD'];
    const constLines = CONSTS.map((n) => constLine(src, n)).join('\n');
    ok('គ្រប់ថេរនៃថវិកាស៊ុមមានក្នុង app.js', CONSTS.every((n) => constLine(src, n)),
        CONSTS.filter((n) => !constLine(src, n)));

    const page = `<!doctype html><meta charset="utf-8"><body>
<div id="scroller" style="height:120px;overflow-y:auto"><div style="height:4000px"></div></div>
<script>
${letLine(src, 'displayFrameIntervalMs')}
${letLine(src, 'lastScrollAt')}
let currentVideoTrack = null;
${constLines}
${FNS.map((n) => sliceFn(src, n)).join('\n')}
window.__api = {
    measureDisplayFrameRate, displayFrameRate, scrollQuietWindowMs, scrollIsActive,
    runAfterScrollSettles, setupFrameBudget, liveScanMinIntervalMs,
    nextScanPaceMultiplier, nextScanDelayMs,
    interval: () => displayFrameIntervalMs,
    setInterval_: (v) => { displayFrameIntervalMs = v; },
    setTrack: (fps) => { currentVideoTrack = fps === null ? null : { getSettings: () => ({ frameRate: fps }) }; },
    touchScroll: () => { lastScrollAt = Date.now(); }
};
</script></body>`;

    const server = await new Promise((res) => {
        const s = http.createServer((req, rsp) => {
            rsp.writeHead(200, { 'Content-Type': 'text/html' });
            rsp.end(page);
        });
        s.listen(0, '127.0.0.1', () => res(s));
    });
    const port = server.address().port;

    const browser = await chromium.launch({ executablePath: CHROME });
    const ctx = await browser.newContext({ viewport: { width: 412, height: 780 } });
    const pg = await ctx.newPage();
    await pg.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'load', timeout: 30000 });

    console.log('\n=== ការវាស់អត្រាស៊ុមរបស់ឧបករណ៍ ===');
    const measured = await pg.evaluate(async () => {
        window.__api.setupFrameBudget();
        await new Promise((r) => setTimeout(r, 1200));
        return {
            interval: window.__api.interval(),
            fps: window.__api.displayFrameRate(),
            cssVar: window.getComputedStyle(document.documentElement).getPropertyValue('--frame-ms').trim()
        };
    });
    console.log('    វាស់បាន៖ ' + Math.round(measured.interval * 100) / 100 + ' ms/ស៊ុម  (' + measured.fps + ' fps)   --frame-ms: ' + (measured.cssVar || '(none)'));
    ok('អត្រាស៊ុមត្រូវបានវាស់ពី rAF ពិត (--frame-ms ត្រូវនឹងតម្លៃដែលវាស់បាន)',
        measured.cssVar === (Math.round(measured.interval * 100) / 100) + 'ms', measured);
    ok('អត្រាស៊ុមស្ថិតក្នុងចន្លោះ 10–120 fps', measured.fps >= 10 && measured.fps <= 120, measured);
    ok('អត្រាស៊ុមត្រូវបានបោះចេញជា --frame-ms សម្រាប់ CSS', /^[0-9.]+ms$/.test(measured.cssVar), measured);

    const clamp = await pg.evaluate(() => {
        const before = window.__api.interval();
        // អេក្រង់លឿនខ្លាំង (240fps) និងយឺតខ្លាំង (2fps) ត្រូវត្រូវបានចាក់ក្នុងចន្លោះ
        const out = {};
        window.__api.setInterval_(1000 / 240);
        out.tooFast = window.__api.displayFrameRate();
        window.__api.setInterval_(1000 / 2);
        out.tooSlow = window.__api.displayFrameRate();
        window.__api.setInterval_(before);
        return out;
    });
    ok('ថេរនៃការចាក់៖ អប្បបរមា 10 fps · អតិបរមា 120 fps',
        /FRAME_RATE_MIN_FPS = 10;/.test(src) && /FRAME_RATE_MAX_FPS = 120;/.test(src), clamp);

    console.log('\n=== ការពន្យារការគូរឡើងវិញ ខណៈអ្នកប្រើកំពុងរមូរ ===');
    const defer = await pg.evaluate(async () => {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const el = document.getElementById('scroller');
        const out = {};

        // ក) មិនកំពុងរមូរ ➜ ត្រូវរត់ភ្លាមៗ (synchronous)
        let ranAt = 0;
        window.__api.runAfterScrollSettles(() => { ranAt = 1; });
        out.idleRunsImmediately = ranAt === 1;

        // ខ) កំពុងរមូរ ➜ មិនត្រូវរត់ភ្លាមៗទេ
        el.scrollTop = 100;
        el.dispatchEvent(new Event('scroll', { bubbles: false }));
        await wait(5);
        out.scrollSeen = window.__api.scrollIsActive();
        let deferred = 0;
        const started = performance.now();
        window.__api.runAfterScrollSettles(() => { deferred = performance.now() - started; });
        out.notImmediate = deferred === 0;

        // គ) ពេលការរមូរស្ងប់ ➜ ត្រូវរត់
        await wait(window.__api.scrollQuietWindowMs() + 200);
        out.ranAfterQuiet = deferred > 0;
        out.quietWindowMs = window.__api.scrollQuietWindowMs();
        out.deferredMs = Math.round(deferred);
        return out;
    });
    console.log('    បង្អួចស្ងប់៖ ' + defer.quietWindowMs + ' ms   ការងារពន្យារ រត់ក្រោយ ' + defer.deferredMs + ' ms');
    ok('មិនកំពុងរមូរ ➜ ការងារត្រូវរត់ភ្លាមៗ (គ្មានការពន្យារឥតប្រយោជន៍)', defer.idleRunsImmediately, defer);
    ok('ព្រឹត្តិការណ៍ scroll ពិតត្រូវបានឃើញ (តេស្តមិនទទេ)', defer.scrollSeen === true, defer);
    ok('កំពុងរមូរ ➜ ការគូរឡើងវិញត្រូវពន្យារ (មិនប្លុក main thread ចំពេលរមូរ)', defer.notImmediate, defer);
    ok('ការរមូរស្ងប់ ➜ ការងារត្រូវរត់', defer.ranAfterQuiet, defer);

    const deadline = await pg.evaluate(async () => {
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const el = document.getElementById('scroller');
        let ran = false;
        let ranAt = 0;
        // ការរមូរត្រូវកំពុងដំណើរការ *មុន* ការហៅ បើមិនដូច្នេះការងាររត់ភ្លាមៗ
        el.scrollTop += 7;
        el.dispatchEvent(new Event('scroll', { bubbles: false }));
        const spam = setInterval(() => {
            el.scrollTop += 7;
            el.dispatchEvent(new Event('scroll', { bubbles: false }));
        }, 16);
        const started = performance.now();
        const activeAtCall = window.__api.scrollIsActive();
        window.__api.runAfterScrollSettles(() => { ran = true; ranAt = performance.now() - started; });
        const immediate = ran;
        await wait(1100);
        clearInterval(spam);
        await wait(300);
        return { activeAtCall: activeAtCall, immediate: immediate, ran: ran, ranAt: Math.round(ranAt), maxWait: 600 };
    });
    console.log('    រមូរឥតឈប់ ➜ ការងាររត់ក្រោយ ' + deadline.ranAt + ' ms (ពិដាន ' + deadline.maxWait + ' ms)');
    ok('រមូរឥតឈប់ ៖ ការរមូរកំពុងដំណើរការពិតពេលហៅ (តេស្តមិនទទេ)', deadline.activeAtCall === true, deadline);
    ok('រមូរឥតឈប់ ➜ មិនរត់ភ្លាមៗទេ', deadline.immediate === false, deadline);
    ok('រមូរឥតឈប់ ➜ ការងារនៅតែរត់ ក្នុងពិដានរឹង (ទិន្នន័យមិនចាស់)',
        deadline.ran === true && deadline.ranAt <= deadline.maxWait + 250, deadline);

    console.log('\n=== ចង្វាក់ស្កេនសម្របតាមកាមេរ៉ា និងអេក្រង់ ===');
    const pace = await pg.evaluate(() => {
        const out = {};
        window.__api.setTrack(null);
        out.noTrack = window.__api.liveScanMinIntervalMs();
        window.__api.setTrack(24);
        out.fps24 = window.__api.liveScanMinIntervalMs();
        window.__api.setTrack(10);
        out.fps10 = window.__api.liveScanMinIntervalMs();
        window.__api.setTrack(60);
        out.fps60 = window.__api.liveScanMinIntervalMs();
        window.__api.setTrack(null);

        // ពហុគុណត្រូវឡើងពេលស៊ុមខកខាន និងចុះវិញពេលរលូន
        const frame = window.__api.interval();
        let m = 1.6;
        for (let i = 0; i < 12; i++) m = window.__api.nextScanPaceMultiplier(m, frame * 4);
        out.afterDrops = m;
        for (let i = 0; i < 60; i++) m = window.__api.nextScanPaceMultiplier(m, frame);
        out.afterSmooth = m;
        out.ignoresZero = window.__api.nextScanPaceMultiplier(2.2, 0);
        out.delayFast = window.__api.nextScanDelayMs(3, 1.6);
        out.delaySlow = window.__api.nextScanDelayMs(400, 3);
        return out;
    });
    console.log('    ចន្លោះអប្បបរមា៖ គ្មាន track ' + pace.noTrack + ' ms · 24fps ' + pace.fps24 +
        ' ms · 10fps ' + pace.fps10 + ' ms · 60fps ' + pace.fps60 + ' ms');
    console.log('    ពហុគុណ៖ ក្រោយស៊ុមខកខាន ' + pace.afterDrops + ' · ក្រោយរលូនវិញ ' + pace.afterSmooth);
    ok('កាមេរ៉ា 10fps ➜ ឈប់ឌិកូដស៊ុមដដែលច្រើនដង (ចន្លោះ ≥ 100ms)', pace.fps10 >= 100, pace);
    ok('កាមេរ៉ាលឿន ➜ ចន្លោះមិនចុះក្រោមពិដានសុវត្ថិភាព', pace.fps60 === pace.noTrack && pace.fps24 === pace.noTrack, pace);
    ok('ស៊ុមខកខាន ➜ ពហុគុណឡើង (បន្ថយបន្ទុក main thread)', pace.afterDrops > 1.6, pace);
    ok('ពហុគុណមិនហួសពិដានអតិបរមា 3', pace.afterDrops <= 3, pace);
    ok('រលូនវិញ ➜ ពហុគុណត្រឡប់មកអប្បបរមា', pace.afterSmooth === 1.6, pace);
    ok('គម្លាតស៊ុមមិនត្រឹមត្រូវ ➜ មិនប្តូរពហុគុណ', pace.ignoresZero === 2.2, pace);
    ok('ការឌិកូដលឿន ➜ ចន្លោះជាប់ពិដានអប្បបរមា', pace.delayFast === pace.noTrack, pace);
    ok('ការឌិកូដយឺត ➜ ចន្លោះជាប់ពិដានអតិបរមា 220ms', pace.delaySlow === 220, pace);

    console.log('\n=== ការតភ្ជាប់ក្នុង app.js ===');
    ok('setupFrameBudget() ត្រូវបានហៅពេល boot', /^ *setupFrameBudget\(\);$/m.test(src));
    ok('ការគូរឡើងវិញពី Firebase ឆ្លងកាត់ runAfterScrollSettles()',
        /debouncedRenderAfterHistorySync = debounce\(\(\) => \{\s*runAfterScrollSettles\(/.test(src));
    ok('ការវាស់ឡើងវិញពេលត្រឡប់មកមើល App វិញ (ProMotion ប្តូរអត្រា)',
        /visibilitychange[\s\S]{0,120}measureDisplayFrameRate\(\)/.test(src));
    ok('ផ្លូវស្កេនទាំង ២ ប្រើ nextScanDelayMs()', (src.match(/nextScanDelayMs\(/g) || []).length >= 3);
    ok('ផ្លូវស្កេនទាំង ២ ប្រើ nextScanPaceMultiplier()', (src.match(/nextScanPaceMultiplier\(/g) || []).length >= 3);

    await ctx.close(); server.close(); await browser.close();
    console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')' : '✅ ជោគជ័យ ' + pass));
    process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e && e.stack || e); process.exit(1); });
