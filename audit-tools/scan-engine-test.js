// ថ្នាក់៖ ល្បឿន **និងភាពត្រឹមត្រូវ** នៃម៉ាស៊ីនស្កេន Barcode ។ វាស់ផ្លូវឌិកូដ
// **ពិត** ចេញពី app.js (decodeBarcodeFromCanvasManual + hints ពិតរបស់
// initScanEngine) លើ CODE_128 ដែលបង្កើតដោយ encoder ក្នុងតេស្តនេះ រួចបញ្ជាក់
// ដោយ decoder ពិតរបស់ ZXing ក្នុង Chromium ពិត។
//
// ហេតុអ្វីវាសំខាន់៖ `BarcodeDetector` គឺជា API របស់ Chromium — **Safari/iOS
// មិនមានវាទេ** ដូច្នេះលើ iPhone មានតែ ZXing (JavaScript សុទ្ធ) ដែលដំណើរការ
// ចំណែក Android ប្រើ decoder ដើមរបស់ប្រព័ន្ធ។ នោះជាឫសគល់នៃគម្លាតល្បឿន។
//
// ថ្នាក់កំហុសទី ២ ដែលឯកសារនេះចាក់សោ៖ **ការអានលេខខុស (misread)**។ ITF, CODABAR
// និង CODE_39 គ្មានលេខផ្ទៀងផ្ទាត់ជាកាតព្វកិច្ចទេ ➜ ពេលបញ្ជី format មានពួកវា
// ស៊ុមមួយអាចឌិកូដចេញ **លេខផ្សេងទាំងស្រុង** ដោយជោគជ័យ។ CODE_128 មាន mod-103
// ជាកាតព្វកិច្ច។ តេស្តនេះគូរ ITF ពិតមួយ រួចអះអាងថា reader បច្ចុប្បន្នរបស់ App
// **បដិសេធវា** ចំណែក reader ១១ format **ទទួលយកវា** — នោះជាភស្តុតាងផ្ទាល់។
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
    const buildFn = sliceFn(src, 'buildScanReader');
    const confirmFn = (sliceFn(src, 'resetScanConfirm') || '') + '\n' + (sliceFn(src, 'confirmLiveScan') || '');
    const tryFn = (sliceFn(src, 'readResultText') || '') + '\n' + (sliceFn(src, 'decodeLiveFrame') || '');
    ok('រកឃើញ buildScanReader() ក្នុង app.js', !!buildFn);
    ok('រកឃើញ confirmLiveScan() ក្នុង app.js', !!sliceFn(src, 'confirmLiveScan'));
    if (!buildFn || !confirmFn.trim()) { console.log('\n❌ ធ្លាក់ ' + (fail || 1)); process.exit(1); }
    const constLines = ['SCAN_FORMAT_NAMES', 'NATIVE_SCAN_FORMAT_NAMES', 'LIVE_SCAN_MAX_DIM',
        'LIVE_SCAN_MIN_INTERVAL_MS', 'LIVE_SCAN_MAX_INTERVAL_MS', 'SCAN_CONFIRM_REPEATS', 'SCAN_CONFIRM_WINDOW_MS']
        .map((n) => (src.match(new RegExp('^ *const ' + n + ' = .*$', 'm')) || [''])[0]).join('\n');

    const page1 = `<!doctype html><meta charset="utf-8"><body>
<script src="/zxing.js"></script>
<script>
let codeReader = null, liveScanCodeReader = null;
let scanConfirmCode = '', scanConfirmCount = 0, scanConfirmAt = 0;
${constLines}
${buildFn || ''}
${initFn}
${decodeFn}
${cropFn}
${confirmFn}
${tryFn || ''}
window.__api = { initScanEngine, decodeBarcodeFromCanvasManual, getCoverCropRect,
                 decodeLiveFrame: typeof decodeLiveFrame === 'function' ? decodeLiveFrame : null,
                 confirmLiveScan: typeof confirmLiveScan === 'function' ? confirmLiveScan : null,
                 resetScanConfirm: typeof resetScanConfirm === 'function' ? resetScanConfirm : null,
                 setLive: (r) => { liveScanCodeReader = r; },
                 formats: () => SCAN_FORMAT_NAMES.slice(),
                 nativeFormats: () => NATIVE_SCAN_FORMAT_NAMES.slice(),
                 readers: () => ({ codeReader, liveScanCodeReader }) };
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
        return !!(r.codeReader && r.liveScanCodeReader);
    });
    ok('initScanEngine() សាង reader បានទាំង ២ (រូបភាព, live)', engineOk);
    ok('បញ្ជី format របស់ ZXing មានតែ CODE_128',
        JSON.stringify(await page.evaluate(() => window.__api.formats())) === '["CODE_128"]',
        await page.evaluate(() => window.__api.formats()));
    ok('បញ្ជី format របស់ BarcodeDetector (Android) មានតែ code_128',
        JSON.stringify(await page.evaluate(() => window.__api.nativeFormats())) === '["code_128"]',
        await page.evaluate(() => window.__api.nativeFormats()));

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

        // ផ្លូវ live ពិតរបស់ App (decodeLiveFrame ➜ liveScanCodeReader តែមួយ)
        // ធៀបនឹងផ្លូវចាស់ដែលបោសគ្រប់ ១១ format រាល់ស៊ុម
        const emptyLive = paintEmpty(640, 397);
        const fullReader = readerFor(ALL);
        let tLane = performance.now();
        for (let i = 0; i < 24; i++) window.__api.decodeLiveFrame(emptyLive);
        out.LIVE_now = { ms: Math.round(((performance.now() - tLane) / 24) * 100) / 100, hitRate: 0 };
        tLane = performance.now();
        for (let i = 0; i < 16; i++) { try { window.__api.decodeBarcodeFromCanvasManual(fullReader, emptyLive); } catch (e) {} }
        out.LIVE_all11 = { ms: Math.round(((performance.now() - tLane) / 16) * 100) / 100, hitRate: 0 };

        // === ការអានលេខខុសឆ្លង format ===
        // ITF (Interleaved 2 of 5) គ្មានលេខផ្ទៀងផ្ទាត់ជាកាតព្វកិច្ចទេ ➜ ស៊ុមមួយ
        // អាចឌិកូដចេញ **លេខផ្សេងទាំងស្រុង** ដោយជោគជ័យ។ គូរ ITF ពិតមួយ រួចមើល
        // ថា reader មួយណាទទួល មួយណាបដិសេធ។
        const ITF_DIGITS = { '0': 'NNWWN', '1': 'WNNNW', '2': 'NWNNW', '3': 'WWNNN', '4': 'NNWNW',
                             '5': 'WNWNN', '6': 'NWWNN', '7': 'NNNWW', '8': 'WNNWN', '9': 'NWNWN' };
        function paintITF(text, h, mw) {
            const nb = mw, wb = mw * 3;
            const runs = [];
            runs.push([nb, 1], [nb, 0], [nb, 1], [nb, 0]);
            for (let i = 0; i < text.length; i += 2) {
                const a = ITF_DIGITS[text[i]], b = ITF_DIGITS[text[i + 1]];
                for (let k = 0; k < 5; k++) {
                    runs.push([a[k] === 'W' ? wb : nb, 1]);
                    runs.push([b[k] === 'W' ? wb : nb, 0]);
                }
            }
            runs.push([wb, 1], [nb, 0], [nb, 1]);
            const bw = runs.reduce((acc, r) => acc + r[0], 0);
            const quiet = mw * 30;
            const w = bw + quiet * 2;
            const bh = Math.round(h * 0.4);
            const c = document.createElement('canvas');
            c.width = w; c.height = h;
            const g = c.getContext('2d', { willReadFrequently: true });
            g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
            const oy = Math.round((h - bh) / 2);
            let x = quiet;
            runs.forEach(([width, isBar]) => {
                if (isBar) { g.fillStyle = '#000000'; g.fillRect(x, oy, width, bh); }
                x += width;
            });
            return c;
        }
        function tryDecode(reader, canvas) {
            try { return window.__api.decodeBarcodeFromCanvasManual(reader, canvas) || ''; }
            catch (e) { return ''; }
        }
        const ITF_TEXT = '17251234';
        const itfFrame = paintITF(ITF_TEXT, 460, 3);
        out.__misread = {
            itfText: ITF_TEXT,
            all11: tryDecode(readerFor(ALL), itfFrame),
            app: tryDecode(readers.liveScanCodeReader, itfFrame),
            appImage: tryDecode(window.__api.readers().codeReader, itfFrame)
        };

        // តម្លៃដែលកូដកំពុងប្រើពិត (គូរឡើងវិញរាល់ស៊ុម ធៀបនឹងការប្រើ canvas ដដែល)
        const c = paintFrame(800, 496);
        const t0 = performance.now();
        for (let i = 0; i < 30; i++) { c.width = 800; c.height = 496; }
        out.canvasResize30x = Math.round((performance.now() - t0) * 100) / 100;
        return out;
    });

    console.log('\n=== ល្បឿនឌិកូដ ZXing (ផ្លូវដែល iPhone ប្រើ) ===');
    console.log('    self-test decode: ' + bench.__selfTest);
    Object.keys(bench).filter((k) => k !== 'canvasResize30x' && k[0] !== '_').forEach((k) => {
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
    ok('ផ្លូវ live ពិតរបស់ App លឿនជាងការបោស ១១ format យ៉ាងតិច ៣ ដង',
        bench.LIVE_now.ms * 3 <= bench.LIVE_all11.ms,
        { now: bench.LIVE_now.ms, all11: bench.LIVE_all11.ms });

    console.log('\n=== ការអានលេខខុសឆ្លង format (ស៊ុម ITF ពិត) ===');
    console.log('    ITF ដែលគូរ            ៖ ' + bench.__misread.itfText);
    console.log('    reader ១១ format អានចេញ ៖ ' + (bench.__misread.all11 || '(បដិសេធ)'));
    console.log('    reader បច្ចុប្បន្ន (live) ៖ ' + (bench.__misread.app || '(បដិសេធ)'));
    console.log('    reader បច្ចុប្បន្ន (រូបភាព)៖ ' + (bench.__misread.appImage || '(បដិសេធ)'));
    ok('ស៊ុម ITF ដែលគូរ ត្រូវបានឌិកូដដោយ reader ១១ format (តេស្តមិនទទេ)',
        bench.__misread.all11 !== '', bench.__misread);
    ok('ស៊ុម ITF ដដែល ➜ reader live របស់ App បដិសេធ (គ្មានលេខខុសទៀត)',
        bench.__misread.app === '', bench.__misread);
    ok('ស៊ុម ITF ដដែល ➜ reader រូបភាពរបស់ App បដិសេធផងដែរ',
        bench.__misread.appImage === '', bench.__misread);

    // ជាន់ការពារទី ២ ៖ ត្រូវអានបានលេខដដែល ២ ស៊ុមជាប់គ្នា ទើបទទួលយក
    const confirmSeq = await page.evaluate(() => {
        const api = window.__api;
        if (!api.confirmLiveScan) return null;
        api.resetScanConfirm();
        const a = api.confirmLiveScan('ZTO7788123456');
        const b = api.confirmLiveScan('ZTO7788123456');
        api.resetScanConfirm();
        const c = api.confirmLiveScan('ZTO7788123456');
        const d = api.confirmLiveScan('ZTO0000000000');
        const e = api.confirmLiveScan('ZTO0000000000');
        api.resetScanConfirm();
        const f = api.confirmLiveScan('');
        const g = api.confirmLiveScan('  ZTO1111  ');
        const h = api.confirmLiveScan('ZTO1111');
        return { a: a, b: b, c: c, d: d, e: e, f: f, g: g, h: h };
    });
    ok('confirmLiveScan() អាចហៅបានពី app.js ពិត', !!confirmSeq, confirmSeq);
    if (confirmSeq) {
        ok('ស៊ុមតែមួយ ➜ មិនទាន់ទទួលយក', confirmSeq.a === '', confirmSeq);
        ok('ស៊ុម ២ ជាប់គ្នាដូចគ្នា ➜ ទទួលយក', confirmSeq.b === 'ZTO7788123456', confirmSeq);
        ok('លេខផ្សេងកាត់ចូល ➜ រាប់ឡើងវិញ (ការអានខុសម្តងឯង ឆ្លងមិនរួច)',
            confirmSeq.c === '' && confirmSeq.d === '' && confirmSeq.e === 'ZTO0000000000', confirmSeq);
        ok('លេខទទេមិនចាប់ផ្តើមការរាប់', confirmSeq.f === '', confirmSeq);
        ok('ចន្លោះខាងមុខ/ក្រោយត្រូវកាត់ចោលមុនប្រៀបធៀប', confirmSeq.h === 'ZTO1111', confirmSeq);
    }

    if (!REPORT) {
        ok('app.js មាន LIVE_SCAN_MAX_DIM ≤ 640 (ទំហំឌិកូដសមរម្យ)', !!liveMax && Number(liveMax) <= 640, liveMax);
        ok('app.js គ្មានបញ្ជី format ច្រើនទៀត (ONE_D_FORMAT_NAMES ត្រូវបានដករួច)',
            src.indexOf('ONE_D_FORMAT_NAMES') === -1);
        ok('app.js គ្មានជាន់ ២ ទៀត (fastScanCodeReader / syncFastScanFormat ត្រូវបានដករួច)',
            src.indexOf('fastScanCodeReader') === -1 && src.indexOf('syncFastScanFormat') === -1);
        ok('SCAN_FORMAT_NAMES ក្នុង app.js មានតែ CODE_128',
            /const SCAN_FORMAT_NAMES = \['CODE_128'\];/.test(src));
        ok('NATIVE_SCAN_FORMAT_NAMES ក្នុង app.js មានតែ code_128',
            /const NATIVE_SCAN_FORMAT_NAMES = \['code_128'\];/.test(src));
        ok('ការស្កេន QR ពេល Config/Reconfig នៅប្រើ BrowserQRCodeReader ដាច់ដោយឡែក (មិនរងផល)',
            /configQrReader = new ZXing\.BrowserQRCodeReader\(/.test(src));
        ok('ផ្លូវ live ទាំង ២ (ZXing និង BarcodeDetector) ឆ្លងកាត់ confirmLiveScan()',
            (src.match(/confirmLiveScan\(/g) || []).length >= 3, (src.match(/confirmLiveScan\(/g) || []).length);
        ok('សាខាស្លាប់ `nativeDetector && isIOSDevice()` ត្រូវបានដករួច (Safari គ្មាន BarcodeDetector)',
            !/nativeDetector && isIOSDevice\(\)/.test(src));
    }

    await ctx.close(); server.close(); await browser.close();
    if (REPORT) { console.log('\n(របាយការណ៍តែប៉ុណ្ណោះ)'); process.exit(0); }
    console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')' : '✅ ជោគជ័យ ' + pass));
    process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e && e.stack || e); process.exit(1); });
