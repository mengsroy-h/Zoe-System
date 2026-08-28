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

const ROOT = process.env.SCAN_APP_DIR || path.join(__dirname, '..');

// engine ស្កេនស្ថិតក្នុង repo ➜ តេស្តនេះលែងត្រូវការ npm dependency ណាមួយទៀតទេ។
// ⛔ ដូច្នេះការបាត់ `zxing_reader.wasm` **មិនមែនជា SKIP បរិស្ថានទេ** — វាជា
// **ការធ្លាក់**៖ ឯកសារនោះនៅក្នុង `CORE_SHELL` របស់ `sw.js` ហើយបើវាបាត់ នោះ
// ការស្កេនស្លាប់លើផលិតកម្ម។ ការចេញជា SKIP (exit 0) នៅទីនេះជាការបៃតង
// ក្លែងក្លាយ៖ ថត app ដែលទទេ ឬ override ដែលខុស នឹងធ្វើឲ្យ checker នេះ
// «ជោគជ័យ» ដោយមិនបានពិនិត្យអ្វីសោះ។ មើល `checker-coverage.js`។
if (!fs.existsSync(path.join(ROOT, 'ZoeW/vendor/zxing_reader.wasm'))) {
    console.log('❌ រកមិនឃើញ ZoeW/vendor/zxing_reader.wasm — engine ស្កេនត្រូវនៅក្នុង repo');
    process.exit(1);
}
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
    const buildFn = (sliceFn(src, 'scanEngineReady') || '') + '\n' + (sliceFn(src, 'buildReaderOptions') || '');
    // ⛔ `confirmLiveScan()` ឥឡូវវាស់បង្អួចតាម `elapsedSince()` (2.20.7)
    //    ➜ ត្រូវចាក់ helper **ពិត** ចូលទំព័រ បើមិនដូច្នេះវាបោះ ReferenceError។
    const confirmFn = (sliceFn(src, 'elapsedSince')
            || 'function elapsedSince(mark) { return Date.now() - mark; }') + '\n'
        + (sliceFn(src, 'resetScanConfirm') || '') + '\n' + (sliceFn(src, 'confirmLiveScan') || '');
    const tryFn = (sliceFn(src, 'readResultText') || '') + '\n' +
                  (sliceFn(src, 'decodeLiveFrame') || '') + '\n' +
                  (sliceFn(src, 'liveScanTargetWidth') || '') + '\n' +
                  (sliceFn(src, 'noteLiveScanCost') || '') + '\n' +
                  (sliceFn(src, 'resetLiveScanQuality') || '') + '\n' +
                  (sliceFn(src, 'liveScanFrameSize') || '') + '\n' +
                  (sliceFn(src, 'takeFreshVideoFrame') || '');
    ok('រកឃើញ liveScanFrameSize() ក្នុង app.js', !!sliceFn(src, 'liveScanFrameSize'));
    ok('រកឃើញ buildReaderOptions() ក្នុង app.js', !!sliceFn(src, 'buildReaderOptions'));
    ok('រកឃើញ confirmLiveScan() ក្នុង app.js', !!sliceFn(src, 'confirmLiveScan'));
    if (!buildFn || !confirmFn.trim()) { console.log('\n❌ ធ្លាក់ ' + (fail || 1)); process.exit(1); }
    const constLines = ['SCAN_FORMAT_NAMES', 'NATIVE_SCAN_FORMAT_NAMES', 'LIVE_SCAN_WIDTH_STEPS', 'LIVE_SCAN_MAX_DIM',
        'LIVE_SCAN_MAX_BAND_PX', 'LIVE_SCAN_MAX_FPS', 'LIVE_SCAN_MIN_FPS',
        'LIVE_SCAN_MIN_INTERVAL_MS', 'LIVE_SCAN_MAX_INTERVAL_MS',
        'LIVE_SCAN_BACKOFF', 'LIVE_SCAN_SLOW_MS', 'LIVE_SCAN_FAST_MS', 'FRESH_FRAME_GIVE_UP',
        'SCAN_CONFIRM_REPEATS', 'SCAN_CONFIRM_WINDOW_MS']
        .map((n) => (src.match(new RegExp('^ *const ' + n + ' = .*$', 'm')) || [''])[0]).join('\n');

    const page1 = `<!doctype html><meta charset="utf-8"><body>
<script src="/zxing-wasm.js"></script>
<script>
let codeReader = null, liveScanCodeReader = null;
let scanConfirmCode = '', scanConfirmCount = 0, scanConfirmAt = 0;
let liveScanWidthIndex = -1, liveScanCostEma = 0, lastDecodedVideoTime = -1;
let staleFrameStreak = 0, freshFrameGateUsable = true;
${constLines}
${buildFn || ''}
${initFn}
${decodeFn}
${cropFn}
${confirmFn}
${tryFn || ''}
window.__api = { initScanEngine, decodeBarcodeFromCanvasManual, getCoverCropRect,
                 makeRowLuminanceSource: typeof makeRowLuminanceSource === 'function' ? makeRowLuminanceSource : null,
                 liveScanFrameSize: typeof liveScanFrameSize === 'function' ? liveScanFrameSize : null,
                 resetLiveScanQuality: typeof resetLiveScanQuality === 'function' ? resetLiveScanQuality : null,
                 noteLiveScanCost: typeof noteLiveScanCost === 'function' ? noteLiveScanCost : null,
                 liveScanTargetWidth: typeof liveScanTargetWidth === 'function' ? liveScanTargetWidth : null,
                 takeFreshVideoFrame: typeof takeFreshVideoFrame === 'function' ? takeFreshVideoFrame : null,
                 giveUp: () => FRESH_FRAME_GIVE_UP,
                 fpsBand: () => ({ min: LIVE_SCAN_MIN_FPS, max: LIVE_SCAN_MAX_FPS,
                                   minMs: LIVE_SCAN_MIN_INTERVAL_MS, maxMs: LIVE_SCAN_MAX_INTERVAL_MS }),
                 widthSteps: () => LIVE_SCAN_WIDTH_STEPS.slice(),
                 bandCap: () => LIVE_SCAN_MAX_BAND_PX,
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
        '/zxing-wasm.js': { type: 'application/javascript', body: fs.readFileSync(path.join(ROOT, 'ZoeW/vendor/zxing-wasm.js')) },
        '/vendor/zxing_reader.wasm': { type: 'application/wasm', body: fs.readFileSync(path.join(ROOT, 'ZoeW/vendor/zxing_reader.wasm')) }
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
    ok('បញ្ជី format របស់ engine មានតែ Code128',
        JSON.stringify(await page.evaluate(() => window.__api.formats())) === '["Code128"]',
        await page.evaluate(() => window.__api.formats()));
    ok('បញ្ជី format របស់ BarcodeDetector (Android) មានតែ code_128',
        JSON.stringify(await page.evaluate(() => window.__api.nativeFormats())) === '["code_128"]',
        await page.evaluate(() => window.__api.nativeFormats()));

    // សាង CODE_128 ដោយ encoder របស់ ZXing ខ្លួនឯង រួចគូរជាស៊ុមវីដេអូក្លែងធម្មជាតិ
    const bench = await page.evaluate(async () => {
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
            return { formats: names.slice(), tryHarder: false, maxNumberOfSymbols: 1 };
        }
        const ALL = ['Code128', 'Code39', 'Code93', 'Codabar', 'EANUPC', 'ITF', 'DataBar', 'DataBarLtd', 'Telepen'];
        const emptyRef = paintEmpty(640, 397);
        const hitRef = paintFrame(640, 397);
        for (const [label, names] of [['ALL_11', ALL], ['CODE128_only', ['Code128']], ['CODE128_39', ['Code128', 'Code39']]]) {
            const r = readerFor(names);
            let tf = performance.now();
            for (let i = 0; i < 8; i++) { try { await window.__api.decodeBarcodeFromCanvasManual(r, emptyRef); } catch (e) {} }
            const miss = Math.round(((performance.now() - tf) / 8) * 100) / 100;
            tf = performance.now();
            let hits = 0;
            for (let i = 0; i < 12; i++) { try { if (await window.__api.decodeBarcodeFromCanvasManual(r, hitRef)) hits++; } catch (e) {} }
            out['FMT_' + label] = { ms: Math.round(((performance.now() - tf) / 12) * 100) / 100, hitRate: hits / 12, miss: miss };
        }

        // ផ្លូវ live ពិតរបស់ App (decodeLiveFrame ➜ liveScanCodeReader តែមួយ)
        // ធៀបនឹងផ្លូវចាស់ដែលបោសគ្រប់ ១១ format រាល់ស៊ុម
        const emptyLive = paintEmpty(640, 397);
        const fullReader = readerFor(ALL);
        let tLane = performance.now();
        for (let i = 0; i < 24; i++) await window.__api.decodeLiveFrame(emptyLive);
        out.LIVE_now = { ms: Math.round(((performance.now() - tLane) / 24) * 100) / 100, hitRate: 0 };
        tLane = performance.now();
        for (let i = 0; i < 16; i++) { try { await window.__api.decodeBarcodeFromCanvasManual(fullReader, emptyLive); } catch (e) {} }
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
        async function tryDecode(reader, canvas) {
            try { return (await window.__api.decodeBarcodeFromCanvasManual(reader, canvas)) || ''; }
            catch (e) { return ''; }
        }
        const ITF_TEXT = '17251234';
        const itfFrame = paintITF(ITF_TEXT, 460, 3);
        out.__misread = {
            itfText: ITF_TEXT,
            all11: await tryDecode(readerFor(ALL), itfFrame),
            app: await tryDecode(readers.liveScanCodeReader, itfFrame),
            appImage: await tryDecode(window.__api.readers().codeReader, itfFrame)
        };

        // === ជួរអាន៖ barcode តូចប៉ុនណាដែលនៅតែអានចេញបាន ===
        // Android ឌិកូដលើ ImageBitmap ពេញគុណភាព (~1920px) ចំណែក iPhone ឌិកូដលើ
        // canvas ដែល downscale រួច។ ទទឹង canvas នោះហើយជា **ព្រំដែនជួរអាន**៖
        // CODE_128 ១៣ តួ ≈ ២១១ module ➜ ត្រូវការ ~1.6px/module ➜ ~340px នៃ barcode។
        // គូរស៊ុមប្រភព 1920×880 ដែល barcode កាន់កាប់ភាគរយផ្សេងៗ រួច downscale
        // ទៅទទឹងនីមួយៗ ដូចផ្លូវពិត រួចរាប់ថាអានចេញបានប៉ុន្មាន។
        function downscaled(srcCanvas, w, h) {
            const c2 = document.createElement('canvas');
            c2.width = w; c2.height = h;
            c2.getContext('2d', { willReadFrequently: true })
                .drawImage(srcCanvas, 0, 0, srcCanvas.width, srcCanvas.height, 0, 0, w, h);
            return c2;
        }
        function paintWideFrame(W, H, barPx, jitter) {
            const values = code128Values(TEXT);
            let modules = 0;
            values.forEach((v) => { for (const d of CODE128[v]) modules += Number(d); });
            const mw = barPx / modules;
            const bw = modules * mw;
            const bh = Math.round(H * 0.30);
            const c2 = document.createElement('canvas');
            c2.width = W; c2.height = H;
            const g = c2.getContext('2d', { willReadFrequently: true });
            g.fillStyle = '#9aa0a6'; g.fillRect(0, 0, W, H);
            const ox = Math.round((W - bw) / 2) + jitter;
            const oy = Math.round(H * 0.34) + jitter;
            g.fillStyle = '#ffffff'; g.fillRect(ox - mw * 12, oy - 14, bw + mw * 24, bh + 28);
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
            return c2;
        }
        const SRC_W = 1920, SRC_H = 880;
        const bandCap = window.__api.bandCap ? window.__api.bandCap() : 240;
        async function readRange(width) {
            let good = 0, total = 0;
            for (const frac of [0.50, 0.42, 0.36, 0.30]) {
                for (let k = 0; k < 3; k++) {
                    const src = paintWideFrame(SRC_W, SRC_H, SRC_W * frac, (k * 7 % 13) - 6);
                    const h = Math.min(Math.round(SRC_H * width / SRC_W), bandCap);
                    total++;
                    if ((await window.__api.decodeLiveFrame(downscaled(src, width, h))) === TEXT) good++;
                }
            }
            return { good: good, total: total };
        }
        out.__range = {
            steps: window.__api.widthSteps ? window.__api.widthSteps() : [],
            at640: await readRange(640),
            atMax: await readRange(window.__api.liveScanTargetWidth ? window.__api.liveScanTargetWidth() : 1280),
            bandCap: bandCap
        };

        // ថ្លៃពិតក្នុងមួយស៊ុមលើផ្លូវបរាជ័យ នៅទំហំស៊ុមពេញ (1280×bandCap)។
        // engine WASM ទទួល `ImageData` ផ្ទាល់ ដូច្នេះលែងមាន luminance source
        // ជា JavaScript ទៀតទេ — ថ្លៃដែលនៅសល់គឺ `getImageData()` បូកការឌិកូដ។
        const missBig = paintEmpty(1280, bandCap);
        let tt = performance.now();
        for (let i = 0; i < 24; i++) await window.__api.decodeLiveFrame(missBig);
        out.LANE_rowSource = { ms: Math.round(((performance.now() - tt) / 24) * 100) / 100, hitRate: 0 };

        // ការសម្របតាមឧបករណ៍៖ ថ្លៃខ្ពស់ ➜ ទម្លាក់ជំហានទទឹង; ថ្លៃទាប ➜ ឡើងវិញ
        if (window.__api.resetLiveScanQuality && window.__api.noteLiveScanCost) {
            window.__api.resetLiveScanQuality();
            const top = window.__api.liveScanTargetWidth();
            for (let i = 0; i < 12; i++) window.__api.noteLiveScanCost(80);
            const slow = window.__api.liveScanTargetWidth();
            for (let i = 0; i < 12; i++) window.__api.noteLiveScanCost(2);
            const fast = window.__api.liveScanTargetWidth();
            window.__api.resetLiveScanQuality();
            out.__adaptive = { top: top, slow: slow, fast: fast };
        }

        // ទំហំស៊ុមឌិកូដ ត្រូវកាត់កម្ពស់ត្រឹមពិដាន មិនមែនតាមមាត្រដ្ឋានទេ
        if (window.__api.liveScanFrameSize) {
            window.__api.resetLiveScanQuality();
            out.__frameSize = window.__api.liveScanFrameSize({ sx: 0, sy: 0, sWidth: 1920, sHeight: 880 });
        }

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
    // ក្រោយប្តូរទៅ engine WASM ការឌិកូដលែងជាថ្លៃលេចធ្លោទៀតទេ — ថ្លៃដែលនៅសល់
    // គឺ `getImageData()` ដែលដូចគ្នាទាំង ២ ផ្លូវ ➜ ការប្រៀបធៀបសមាមាត្រលែងមានន័យ។
    // អ្វីដែលការពារការថយក្រោយពិតគឺ **ថវិកាដាច់ខាត**៖ ZXing-JS ចាស់វាស់បាន
    // ១៦.៦ ms/ស៊ុមលើផ្លូវនេះ ដូច្នេះពិដាន ៨ ms ចាប់ការត្រឡប់ទៅ engine JS វិញ។
    ok('ផ្លូវ live លើផ្លូវបរាជ័យ ក្រោម ៨ ms/ស៊ុម (engine WASM)',
        bench.LIVE_now.ms < 8,
        { now: bench.LIVE_now.ms, all11: bench.LIVE_all11.ms });

    console.log('\n=== ជួរអាន (barcode តូច/ឆ្ងាយ) ===');
    console.log('    ជំហានទទឹងឌិកូដ      ៖ ' + JSON.stringify(bench.__range.steps) + '  ពិដានកម្ពស់ ' + bench.__range.bandCap + 'px');
    console.log('    ទទឹង 640 (កំណែចាស់) ៖ អានបាន ' + bench.__range.at640.good + '/' + bench.__range.at640.total);
    console.log('    ទទឹងអតិបរមាឥឡូវ     ៖ អានបាន ' + bench.__range.atMax.good + '/' + bench.__range.atMax.total);
    ok('ទទឹងឌិកូដ 640 នៅតែអាន barcode ធំបាន (តេស្តមិនទទេ)', bench.__range.at640.good > 0, bench.__range.at640);
    ok('ទទឹងឌិកូដអតិបរមាឥឡូវ អាន barcode តូចបានច្រើនជាង 640 យ៉ាងតិច ៥០%',
        bench.__range.atMax.good >= bench.__range.at640.good + Math.ceil(bench.__range.at640.good * 0.5),
        bench.__range);
    ok('ទទឹងឌិកូដអតិបរមា អានបានគ្រប់ករណីដែល 640 អានបាន (គ្មានការថយក្រោយ)',
        bench.__range.atMax.good >= bench.__range.at640.good, bench.__range);

    console.log('\n=== ថ្លៃឌិកូដក្នុងមួយស៊ុម (ផ្លូវបរាជ័យ 1280px) ===');
    console.log('    ស៊ុមពេញ 1280px ៖ ' + bench.LANE_rowSource.ms + ' ms/ស៊ុម  (ព័ត៌មានតែប៉ុណ្ណោះ)');
    // ចំណាំ៖ លេខ 1280px ខាងលើ **មិនត្រូវអះអាង** ទេ — វាត្រូវបានគ្រប់គ្រងដោយ
    // `getImageData()` ដែលប្រែប្រួលតាមបន្ទុក container (វាស់បាន ៣.២–៨.២ ms
    // លើ tree ដដែល) ➜ ការដាក់ពិដានលើវានឹងក្លាយជាតេស្តភ្លឹបភ្លែត។
    //
    // អ្វីដែលបែងចែក engine បានច្បាស់គឺ **ផ្លូវបរាជ័យនៅទទឹង 800**៖
    // ZXing-JS វាស់បាន ១៣.៩ ms/ស៊ុម ចំណែក WASM វាស់បាន ១.៦–២.២ ms ➜ គម្លាត ៦×
    // ដែលធំជាងភាពប្រែប្រួលឆ្ងាយ។ ពិដាន ៨ ms ចាប់ការត្រឡប់ទៅ engine JS វិញ។
    console.log('    ផ្លូវបរាជ័យ 800px ៖ ' + bench.MISS_full_800.ms + ' ms/ស៊ុម');
    ok('ផ្លូវបរាជ័យនៅទទឹង 800 ក្រោម ៨ ms/ស៊ុម (engine WASM មិនត្រូវថយក្រោយទៅ JS)',
        bench.MISS_full_800.ms < 8, { ms: bench.MISS_full_800.ms });

    console.log('\n=== ការសម្របតាមឧបករណ៍ដោយស្វ័យប្រវត្តិ ===');
    console.log('    ចាប់ផ្តើម ' + bench.__adaptive.top + 'px ➜ ថ្លៃខ្ពស់ ' + bench.__adaptive.slow +
                'px ➜ ថ្លៃទាបវិញ ' + bench.__adaptive.fast + 'px');
    ok('ថ្លៃឌិកូដខ្ពស់ ➜ ទម្លាក់ទទឹងឌិកូដចុះ (ឧបករណ៍ចាស់នៅតែរលូន)',
        bench.__adaptive.slow < bench.__adaptive.top, bench.__adaptive);
    ok('ថ្លៃឌិកូដទាបវិញ ➜ ឡើងទទឹងឌិកូដមកវិញ (ឧបករណ៍លឿនបានគុណភាពពេញ)',
        bench.__adaptive.fast > bench.__adaptive.slow, bench.__adaptive);
    console.log('    ស៊ុមឌិកូដពី crop 1920x880 ៖ ' + JSON.stringify(bench.__frameSize));
    ok('កម្ពស់ស៊ុមឌិកូដត្រូវកាត់ត្រឹមពិដាន (មិនរីកតាមមាត្រដ្ឋាន)',
        bench.__frameSize.height <= bench.__range.bandCap, bench.__frameSize);
    ok('ទទឹងស៊ុមឌិកូដមិនហួសពិដាន',
        bench.__frameSize.width <= bench.__range.steps[bench.__range.steps.length - 1], bench.__frameSize);

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

    // ស៊ុមវីដេអូដដែលមិនត្រូវរាប់ជាពីរ — បើរាប់ ជាន់បញ្ជាក់ ២ ស៊ុមក្លាយជា ១ ស៊ុមភ្លាម។
    // តែបើ browser ណាទុក `currentTime` ថេរលើ MediaStream នោះ gate នេះនឹងបិទការ
    // ស្កេនទាំងស្រុង ➜ វាត្រូវ **fail open** ក្រោយភស្តុតាងគ្រប់គ្រាន់។
    const freshGate = await page.evaluate(() => {
        const api = window.__api;
        if (!api.takeFreshVideoFrame || !api.resetLiveScanQuality) return null;
        api.resetLiveScanQuality();
        const video = { currentTime: 1.5 };
        const first = api.takeFreshVideoFrame(video);
        const same = api.takeFreshVideoFrame(video);
        video.currentTime = 1.533;
        const moved = api.takeFreshVideoFrame(video);
        api.resetLiveScanQuality();
        const frozen = { currentTime: 4.2 };
        api.takeFreshVideoFrame(frozen);
        let openedAfter = -1;
        for (let i = 1; i <= api.giveUp() + 4; i++) {
            if (api.takeFreshVideoFrame(frozen)) { openedAfter = i; break; }
        }
        api.resetLiveScanQuality();
        return { first: first, same: same, moved: moved, openedAfter: openedAfter, giveUp: api.giveUp() };
    });
    const fpsBand = await page.evaluate(() => window.__api.fpsBand ? window.__api.fpsBand() : null);
    console.log('\n=== ចន្លោះល្បឿនស្កេន (fps) ===');
    console.log('    ' + JSON.stringify(fpsBand));
    ok('ចន្លោះស្កេនគាំទ្រដល់ ១២០ fps (មិនបង្អាក់ឧបករណ៍លឿន)',
        !!fpsBand && fpsBand.max >= 120 && fpsBand.minMs <= 9, fpsBand);
    ok('ចន្លោះស្កេនធ្លាក់ដល់ ១០ fps បាន (ឧបករណ៍យឺតមិនត្រូវបង្ខំ)',
        !!fpsBand && fpsBand.min <= 10 && fpsBand.maxMs >= 100, fpsBand);

    console.log('\n=== ស៊ុមវីដេអូថ្មី (ការពារការរាប់ស៊ុមដដែលពីរដង) ===');
    ok('takeFreshVideoFrame() អាចហៅបានពី app.js ពិត', !!freshGate, freshGate);
    if (freshGate) {
        ok('ស៊ុមថ្មី ➜ ទទួលយកឲ្យឌិកូដ', freshGate.first === true, freshGate);
        ok('ស៊ុមដដែល ➜ បដិសេធ (ជាន់បញ្ជាក់ ២ ស៊ុមនៅរឹងមាំ)', freshGate.same === false, freshGate);
        ok('currentTime រំកិល ➜ ទទួលយកវិញ', freshGate.moved === true, freshGate);
        ok('currentTime កក ➜ fail open ក្រោយភស្តុតាងគ្រប់គ្រាន់ (ការស្កេនមិនស្លាប់)',
            freshGate.openedAfter > 0 && freshGate.openedAfter <= freshGate.giveUp, freshGate);
    }

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
        const bandMax = (src.match(/const LIVE_SCAN_MAX_BAND_PX = (\d+);/) || [])[1];
        ok('app.js មាន LIVE_SCAN_MAX_DIM ≤ 1280 (ទទឹងឌិកូដមានពិដាន)', !!liveMax && Number(liveMax) <= 1280, liveMax);
        ok('app.js មាន LIVE_SCAN_MAX_BAND_PX ≤ 320 (កម្ពស់ស៊ុមឌិកូដមានពិដាន)', !!bandMax && Number(bandMax) <= 320, bandMax);
        ok('ថវិកា pixel ក្នុងមួយស៊ុមឌិកូដ ≤ 320,000 (ទប់ថ្លៃ drawImage/getImageData)',
            !!liveMax && !!bandMax && Number(liveMax) * Number(bandMax) <= 320000, { liveMax, bandMax });
        // engine WASM ទទួល `ImageData` ផ្ទាល់ ➜ លែងមាន luminance source ជា JavaScript។
        // អ្វីដែលត្រូវចាក់សោវិញគឺ៖ ZXing-JS ត្រូវបានដកចេញទាំងស្រុង មិនមែនដេកស្ងៀមទេ។
        ok('ផ្លូវ live ប្រើ engine WASM (ZXing-JS ត្រូវបានដកចេញទាំងស្រុង)',
            /ZXingWASM\.readBarcodes\(/.test(src) && !/new ZXing\./.test(src) && !/ZXing\.BarcodeFormat/.test(src));
        ok('ស៊ុមវីដេអូដដែលមិនត្រូវឌិកូដពីរដង (takeFreshVideoFrame ការពារជាន់បញ្ជាក់ ២ ស៊ុម)',
            /function takeFreshVideoFrame\(/.test(src) && (src.match(/takeFreshVideoFrame\(videoElement\)/g) || []).length >= 2);
        ok('app.js គ្មានបញ្ជី format ច្រើនទៀត (ONE_D_FORMAT_NAMES ត្រូវបានដករួច)',
            src.indexOf('ONE_D_FORMAT_NAMES') === -1);
        ok('app.js គ្មានជាន់ ២ ទៀត (fastScanCodeReader / syncFastScanFormat ត្រូវបានដករួច)',
            src.indexOf('fastScanCodeReader') === -1 && src.indexOf('syncFastScanFormat') === -1);
        ok('SCAN_FORMAT_NAMES ក្នុង app.js មានតែ Code128',
            /const SCAN_FORMAT_NAMES = \['Code128'\];/.test(src));
        ok('NATIVE_SCAN_FORMAT_NAMES ក្នុង app.js មានតែ code_128',
            /const NATIVE_SCAN_FORMAT_NAMES = \['code_128'\];/.test(src));

        // ថ្នាក់កំហុសដែលចាប់បានពិត៖ CSP ដែលគ្មាន `'wasm-unsafe-eval'` ធ្វើឲ្យ browser
        // **បដិសេធការចងក្រង WebAssembly** ➜ ការស្កេនស្លាប់ទាំងស្រុងលើផលិតកម្ម
        // ខណៈតេស្តក្នុង repo (ដែលគ្មាន CSP) ជោគជ័យទាំងអស់។ ការវាស់ពិត៖
        // "Refused to compile or instantiate WebAssembly module"។
        const netlify = fs.readFileSync(path.join(ROOT, 'ZoeW', 'netlify.toml'), 'utf8');
        const cspLine = (netlify.match(/Content-Security-Policy = "([^"]+)"/) || [])[1] || '';
        const scriptSrc = (cspLine.match(/script-src ([^;]+)/) || [])[1] || '';
        ok('CSP អនុញ្ញាត WebAssembly (script-src មាន wasm-unsafe-eval)',
            scriptSrc.indexOf("'wasm-unsafe-eval'") !== -1, scriptSrc);
        ok('netlify.toml បម្រើ .wasm ជា application/wasm (បើអត់ ➜ ធ្លាក់ទៅផ្លូវយឺត)',
            /for = "\/\*\.wasm"/.test(netlify) && /Content-Type = "application\/wasm"/.test(netlify));
        ok('engine WASM ស្ថិតក្នុង repo (មិនមែន CDN)',
            fs.existsSync(path.join(ROOT, 'ZoeW/vendor/zxing-wasm.js')) &&
            fs.existsSync(path.join(ROOT, 'ZoeW/vendor/zxing_reader.wasm')));
        // ការស្កេន QR នៅតែជាបញ្ជី format **ដាច់ដោយឡែក** ➜ ការកែបញ្ជី 1D
        // មិនអាចប៉ះការស្កេន QR បានទេ (និងផ្ទុយមកវិញ)។
        ok('ការស្កេន QR ពេល Config/Reconfig ប្រើបញ្ជី format ដាច់ដោយឡែក (មិនរងផល)',
            /const CONFIG_QR_FORMAT_NAMES = \['QRCode'\];/.test(src) &&
            /configQrReader = buildReaderOptions\(false, CONFIG_QR_FORMAT_NAMES\)/.test(src));
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
