// ថ្នាក់៖ ល្បឿនម៉ាស៊ីនស្កេន Barcode ។ វាស់ផ្លូវឌិកូដ **ពិត** ចេញពី app.js
// (decodeBarcodeFromCanvasManual + hints ពិតរបស់ initScanEngine) លើ CODE_128
// ដែលបង្កើតដោយ encoder របស់ ZXing ខ្លួនឯង ក្នុង Chromium ពិត។
//
// ហេតុអ្វីវាសំខាន់៖ `BarcodeDetector` គឺជា API របស់ Chromium — **Safari/iOS
// មិនមានវាទេ** ដូច្នេះលើ iPhone មានតែ ZXing (JavaScript សុទ្ធ) ដែលដំណើរការ
// ចំណែក Android ប្រើ decoder ដើមរបស់ប្រព័ន្ធ។ នោះជាឫសគល់នៃគម្លាតល្បឿន។
let chromium;
try { chromium = require('playwright-core').chromium; } catch (e) { console.log('SKIP — ត្រូវការ playwright-core'); process.exit(0); }
const fs = require('fs'), http = require('http'), path = require('path');
const CHROME = process.env.SCAN_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
if (!fs.existsSync(CHROME)) { console.log('SKIP — រកមិនឃើញ Chromium'); process.exit(0); }

let ZXING_PATH = null;
for (const dir of [path.join(__dirname, '..', 'node_modules'), path.join(process.env.HOME || '/root', 'node_modules')]) {
    const p = path.join(dir, '@zxing', 'library', 'umd', 'index.min.js');
    if (fs.existsSync(p)) { ZXING_PATH = p; break; }
}
if (!ZXING_PATH) { console.log('SKIP — ត្រូវការ @zxing/library (npm i @zxing/library@0.23.0)'); process.exit(0); }

const ROOT = process.env.SCAN_APP_DIR || path.join(__dirname, '..');
const REPORT = process.env.SCAN_REPORT === '1';

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

function serve(files) {
    return new Promise((res) => {
        const s = http.createServer((req, rsp) => {
            const p = decodeURIComponent(req.url.split('?')[0]);
            const entry = files[p];
            if (!entry) { rsp.writeHead(404); return rsp.end(); }
            rsp.writeHead(200, { 'Content-Type': entry.type });
            rsp.end(entry.body);
        });
        s.listen(0, '127.0.0.1', () => res(s));
    });
}

(async () => {
    const src = fs.readFileSync(path.join(ROOT, 'ZoeW', 'app.js'), 'utf8');
    const decodeFn = sliceFn(src, 'decodeBarcodeFromCanvasManual');
    const initFn = sliceFn(src, 'initScanEngine');
    const cropFn = sliceFn(src, 'getCoverCropRect');
    ok('រកឃើញ decodeBarcodeFromCanvasManual() ក្នុង app.js', !!decodeFn);
    ok('រកឃើញ initScanEngine() ក្នុង app.js', !!initFn);
    ok('រកឃើញ getCoverCropRect() ក្នុង app.js', !!cropFn);
    if (!decodeFn || !initFn) { console.log('\n❌ ធ្លាក់ ' + (fail || 1)); process.exit(1); }

    const liveMax = (src.match(/const LIVE_SCAN_MAX_DIM = (\d+);/) || [])[1];
    const buildFn = sliceFn(src, 'buildOneDReader');
    const syncFn = sliceFn(src, 'syncFastScanFormat');
    const tryFn = (sliceFn(src, 'readResultText') || '') + '\n' + (sliceFn(src, 'decodeLiveFrame') || '');
    ok('រកឃើញ buildOneDReader() ក្នុង app.js', !!buildFn);
    const constLines = ['ONE_D_FORMAT_NAMES', 'DEFAULT_FAST_SCAN_FORMAT', 'LIVE_SCAN_MAX_DIM',
        'LIVE_SCAN_MIN_INTERVAL_MS', 'LIVE_SCAN_MAX_INTERVAL_MS', 'LIVE_FULL_SWEEP_EVERY']
        .map((n) => (src.match(new RegExp('^ *const ' + n + ' = .*$', 'm')) || [''])[0]).join('\n');

    const page1 = `<!doctype html><meta charset="utf-8"><body>
<script src="/zxing.js"></script>
<script>
let codeReader = null, liveScanCodeReader = null, fastScanCodeReader = null;
let fastScanFormatName = '', lastDecodedFormatName = '';
${constLines}
${buildFn || ''}
${initFn}
${decodeFn}
${cropFn}
${syncFn || ''}
${tryFn || ''}
window.__api = { initScanEngine, decodeBarcodeFromCanvasManual, getCoverCropRect,
                 syncFastScanFormat: typeof syncFastScanFormat === 'function' ? syncFastScanFormat : null,
                 decodeLiveFrame: typeof decodeLiveFrame === 'function' ? decodeLiveFrame : null,
                 state: () => ({ fastScanFormatName, lastDecodedFormatName }),
                 setFast: (r, n) => { fastScanCodeReader = r; fastScanFormatName = n; },
                 readers: () => ({ codeReader, liveScanCodeReader, fastScanCodeReader }) };
</script></body>`;

    const server = await serve({
        '/': { type: 'text/html', body: page1 },
        '/zxing.js': { type: 'application/javascript', body: fs.readFileSync(ZXING_PATH) }
    });
    const port = server.address().port;

    const browser = await chromium.launch({ executablePath: CHROME });
    const ctx = await browser.newContext({ viewport: { width: 412, height: 780 } });
    const page = await ctx.newPage();
    await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'load', timeout: 30000 });

    const engineOk = await page.evaluate(() => {
        window.__api.initScanEngine();
        const r = window.__api.readers();
        return !!(r.codeReader && r.liveScanCodeReader && r.fastScanCodeReader);
    });
    ok('initScanEngine() សាង reader ទាំង ៣ បាន (ពេញ, live, លឿន)', engineOk);
    ok('ជាន់លឿនចាប់ផ្តើមដោយ CODE_128',
        (await page.evaluate(() => window.__api.state().fastScanFormatName)) === 'CODE_128');

    // សាង CODE_128 ដោយ encoder របស់ ZXing ខ្លួនឯង រួចគូរជាស៊ុមវីដេអូក្លែងធម្មជាតិ
    const bench = await page.evaluate(() => {
        const TEXT = 'ZTO7788123456';
        // build UMD នេះគ្មាន encoder 1D ទេ ➜ សរសេរ CODE_128 (Code B) ខ្លួនឯង។
        // ការឌិកូដដោយ ZXing ពិតជាអ្នកបញ្ជាក់ថាតារាងលំនាំត្រឹមត្រូវ (hitRate ត្រូវ = 1)។
        const CODE128 = ('212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 ' +
            '221312 231212 112232 122132 122231 113222 123122 123221 223211 221132 ' +
            '221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 ' +
            '212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 ' +
            '231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 ' +
            '231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 ' +
            '314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 ' +
            '112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 ' +
            '111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 ' +
            '214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 ' +
            '114131 311141 411131 211412 211214 211232 2331112').split(/\s+/);

        function code128Values(text) {
            const values = [104];
            let sum = 104;
            for (let i = 0; i < text.length; i++) {
                const v = text.charCodeAt(i) - 32;
                values.push(v);
                sum += v * (i + 1);
            }
            values.push(sum % 103);
            values.push(106);
            return values;
        }

        function paintFrame(w, h, moduleWidth) {
            const values = code128Values(TEXT);
            let modules = 0;
            values.forEach((v) => { for (const d of CODE128[v]) modules += Number(d); });
            const mw = moduleWidth || Math.max(2, Math.floor((w * 0.66) / modules));
            const bw = modules * mw;
            const bh = Math.round(h * 0.34);
            const c = document.createElement('canvas');
            c.width = w; c.height = h;
            const g = c.getContext('2d', { willReadFrequently: true });
            g.fillStyle = '#8a8f98'; g.fillRect(0, 0, w, h);
            const ox = Math.round((w - bw) / 2), oy = Math.round((h - bh) / 2);
            const quiet = mw * 12;
            g.fillStyle = '#ffffff'; g.fillRect(ox - quiet, oy - 16, bw + quiet * 2, bh + 32);
            g.fillStyle = '#000000';
            let x = ox;
            values.forEach((v) => {
                const pattern = CODE128[v];
                for (let i = 0; i < pattern.length; i++) {
                    const width = Number(pattern[i]) * mw;
                    if (i % 2 === 0) g.fillRect(x, oy, width, bh);
                    x += width;
                }
            });
            return c;
        }
        function crop(srcCanvas, bandRatio) {
            const h = Math.max(1, Math.round(srcCanvas.height * bandRatio));
            const c = document.createElement('canvas');
            c.width = srcCanvas.width; c.height = h;
            c.getContext('2d', { willReadFrequently: true })
                .drawImage(srcCanvas, 0, Math.round((srcCanvas.height - h) / 2), srcCanvas.width, h, 0, 0, srcCanvas.width, h);
            return c;
        }
        const readers = window.__api.readers();
        function timeDecode(canvas, reps) {
            let hits = 0;
            const t0 = performance.now();
            for (let i = 0; i < reps; i++) {
                try { if (window.__api.decodeBarcodeFromCanvasManual(readers.liveScanCodeReader, canvas)) hits++; } catch (e) {}
            }
            return { ms: Math.round(((performance.now() - t0) / reps) * 100) / 100, hitRate: hits / reps };
        }
        // ស៊ុមដែល **គ្មាន** barcode — នេះជាករណីភាគច្រើនពិតពេលស្កេន
        // (កាមេរ៉ាកំពុងតម្រង់, ព្រិល, ឬ barcode មិនទាន់ចូលស៊ុម)
        function paintEmpty(w, h) {
            const c = document.createElement('canvas');
            c.width = w; c.height = h;
            const g = c.getContext('2d', { willReadFrequently: true });
            const grad = g.createLinearGradient(0, 0, w, h);
            grad.addColorStop(0, '#6b7280'); grad.addColorStop(1, '#d1d5db');
            g.fillStyle = grad; g.fillRect(0, 0, w, h);
            for (let i = 0; i < 240; i++) {
                g.fillStyle = 'rgba(0,0,0,' + (0.05 + (i % 7) * 0.03) + ')';
                g.fillRect((i * 97) % w, (i * 61) % h, 3 + (i % 11), 2 + (i % 5));
            }
            return c;
        }

        const out = {};
        // បញ្ជាក់ជាមុនថា encoder ខ្លួនឯងត្រឹមត្រូវ — បើមិនត្រូវ លេខវាស់គ្មានន័យទេ
        try {
            const probe = paintFrame(900, 560, 4);
            out.__selfTest = window.__api.decodeBarcodeFromCanvasManual(readers.liveScanCodeReader, probe) || '(empty)';
        } catch (e) { out.__selfTest = 'ERR ' + (e && (e.name || e.message) || e); }
        // ទំហំពេញស៊ុមតាមកូដបច្ចុប្បន្ន (maxDim) និងជម្រើសតូចជាង
        [800, 640].forEach((w) => {
            out['full_' + w] = timeDecode(paintFrame(w, Math.round(w * 0.62)), 12);
        });
        // ផ្លូវបរាជ័យ — ថ្លៃជាងផ្លូវជោគជ័យច្រើន ព្រោះ reader ស្កេនគ្រប់ជួរ
        [800, 640].forEach((w) => {
            out['MISS_full_' + w] = timeDecode(paintEmpty(w, Math.round(w * 0.62)), 8);
        });

        // ចំនួន format ដែល reader ត្រូវសាកល្បង — MultiFormatOneDReader សាកម្នាក់ៗលើគ្រប់ជួរ
        function readerFor(names) {
            const formats = names.map((n) => ZXing.BarcodeFormat[n]).filter((f) => f !== undefined);
            const h = new Map();
            h.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, formats);
            return new ZXing.BrowserBarcodeReader(500, h);
        }
        const ALL = ['CODE_128', 'CODE_39', 'CODE_93', 'CODABAR', 'EAN_13', 'EAN_8', 'UPC_A', 'UPC_E', 'ITF', 'RSS_14', 'RSS_EXPANDED'];
        const emptyRef = paintEmpty(640, 397);
        const hitRef = paintFrame(640, 397);
        [['ALL_11', ALL], ['CODE128_only', ['CODE_128']], ['CODE128_39', ['CODE_128', 'CODE_39']]].forEach(([label, names]) => {
            const r = readerFor(names);
            let tf = performance.now();
            for (let i = 0; i < 8; i++) { try { window.__api.decodeBarcodeFromCanvasManual(r, emptyRef); } catch (e) {} }
            const miss = Math.round(((performance.now() - tf) / 8) * 100) / 100;
            tf = performance.now();
            let hits = 0;
            for (let i = 0; i < 12; i++) { try { if (window.__api.decodeBarcodeFromCanvasManual(r, hitRef)) hits++; } catch (e) {} }
            out['FMT_' + label] = { ms: Math.round(((performance.now() - tf) / 12) * 100) / 100, hitRate: hits / 12, miss: miss };
        });

        // តម្លៃមធ្យមក្នុងមួយស៊ុមតាមផ្លូវ ២ ជាន់ (fast lane រាល់ស៊ុម + full sweep រាល់ N ស៊ុម)
        const SWEEP_N = 4;
        const emptyLive = paintEmpty(640, 397);
        const fastReader = readerFor(['CODE_128']);
        const fullReader = readerFor(ALL);
        window.__api.setFast(fastReader, 'CODE_128');
        let tLane = performance.now();
        for (let i = 1; i <= 32; i++) window.__api.decodeLiveFrame(emptyLive, i % SWEEP_N === 0);
        out.TWO_LANE_avg = { ms: Math.round(((performance.now() - tLane) / 32) * 100) / 100, hitRate: 0 };
        tLane = performance.now();
        for (let i = 0; i < 16; i++) { try { window.__api.decodeBarcodeFromCanvasManual(fullReader, emptyLive); } catch (e) {} }
        out.ONE_LANE_avg = { ms: Math.round(((performance.now() - tLane) / 16) * 100) / 100, hitRate: 0 };

        // តម្លៃដែលកូដកំពុងប្រើពិត (គូរឡើងវិញរាល់ស៊ុម ធៀបនឹងការប្រើ canvas ដដែល)
        const c = paintFrame(800, 496);
        const t0 = performance.now();
        for (let i = 0; i < 30; i++) { c.width = 800; c.height = 496; }
        out.canvasResize30x = Math.round((performance.now() - t0) * 100) / 100;
        return out;
    });

    console.log('\n=== ល្បឿនឌិកូដ ZXing (ផ្លូវដែល iPhone ប្រើ) ===');
    console.log('    self-test decode: ' + bench.__selfTest);
    Object.keys(bench).filter((k) => k !== 'canvasResize30x' && k !== '__selfTest').forEach((k) => {
        const b = bench[k];
        console.log('    ' + k.padEnd(16) + ' ' + String(b.ms).padStart(7) + ' ms/ស៊ុម   រកឃើញ ' + Math.round(b.hitRate * 100) + '%' +
            (b.miss !== undefined ? '   ផ្លូវបរាជ័យ ' + b.miss + ' ms' : ''));
    });
    console.log('    ការកំណត់ទំហំ canvas ៣០ ដង៖ ' + bench.canvasResize30x + ' ms');

    ok('ការឌិកូដពេញស៊ុមរកឃើញ barcode ពិត (តេស្តមិនទទេ)', bench.full_640.hitRate === 1, bench.full_640);
    ok('បញ្ជី format តែមួយ នៅតែរកឃើញ barcode', bench.FMT_CODE128_only.hitRate === 1, bench.FMT_CODE128_only);
    ok('format តែមួយ លឿនជាង ១១ format យ៉ាងតិច ៣ ដង លើផ្លូវបរាជ័យ',
        bench.FMT_CODE128_only.miss * 3 <= bench.FMT_ALL_11.miss,
        { all11: bench.FMT_ALL_11.miss, one: bench.FMT_CODE128_only.miss });
    ok('ផ្លូវ ២ ជាន់ លឿនជាងផ្លូវ ១ ជាន់ (១១ format រាល់ស៊ុម) យ៉ាងតិច ១.៨ ដង',
        bench.TWO_LANE_avg.ms * 1.8 <= bench.ONE_LANE_avg.ms,
        { twoLane: bench.TWO_LANE_avg.ms, oneLane: bench.ONE_LANE_avg.ms });

    // ជាន់លឿនត្រូវប្ដូរខ្លួនតាម format ដែលរកឃើញពិត — កុំឲ្យអាជីវកម្មដែលប្រើ
    // format ផ្សេង (ឧ. CODE_39) ធ្លាក់ចុះល្បឿនជាងមុន
    const adaptive = await page.evaluate(() => {
        const before = window.__api.state().fastScanFormatName;
        window.__api.setFast(null, 'CODE_128');
        // ធ្វើត្រាប់តាមការរកឃើញ CODE_39 ដោយការបោសពេញ
        window.__api.decodeLiveFrame(document.createElement('canvas'), false);
        const s0 = window.__api.state();
        eval('lastDecodedFormatName = "CODE_39"');
        window.__api.syncFastScanFormat();
        const afterReal = window.__api.state().fastScanFormatName;
        eval('lastDecodedFormatName = "NOT_A_REAL_FORMAT"');
        window.__api.syncFastScanFormat();
        const afterBogus = window.__api.state().fastScanFormatName;
        return { before: before, afterReal: afterReal, afterBogus: afterBogus, s0: s0.fastScanFormatName };
    });
    ok('រកឃើញ CODE_39 ➜ ជាន់លឿនប្ដូរទៅ CODE_39', adaptive.afterReal === 'CODE_39', adaptive);
    ok('ឈ្មោះ format ក្លែងក្លាយ ➜ មិនប្ដូរជាន់លឿន (មិនធ្វើឲ្យស្កេនខូច)', adaptive.afterBogus === 'CODE_39', adaptive);

    if (!REPORT) {
        ok('app.js មាន LIVE_SCAN_MAX_DIM ≤ 640 (ទំហំឌិកូដសមរម្យ)', !!liveMax && Number(liveMax) <= 640, liveMax);
        ok('app.js មាន fastScanCodeReader (ជាន់លឿន)', src.indexOf('fastScanCodeReader') !== -1);
        ok('app.js មាន syncFastScanFormat() (ជាន់លឿនប្ដូរតាម format ដែលរកឃើញពិត)', !!sliceFn(src, 'syncFastScanFormat'));
        ok('app.js មាន LIVE_FULL_SWEEP_EVERY (ការបោសពេញរាល់ N ស៊ុម)', /const LIVE_FULL_SWEEP_EVERY = \d+;/.test(src));
        ok('សាខាស្លាប់ `nativeDetector && isIOSDevice()` ត្រូវបានដករួច (Safari គ្មាន BarcodeDetector)',
            !/nativeDetector && isIOSDevice\(\)/.test(src));
    }

    await ctx.close(); server.close(); await browser.close();
    if (REPORT) { console.log('\n(របាយការណ៍តែប៉ុណ្ណោះ)'); process.exit(0); }
    console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')' : '✅ ជោគជ័យ ' + pass));
    process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e && e.stack || e); process.exit(1); });
