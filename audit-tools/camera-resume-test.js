// ថ្នាក់កំហុស៖ **កាមេរ៉ាកក (freeze) ក្រោយប្រអប់ native**។
//
// កំហុសពិតដែលអ្នកប្រើរាយការណ៍លើ iPhone៖ ស្កេនរួច ➜ ប្រអប់វាយលេខទូរស័ព្ទលេច
// ➜ ចុច ✖ ➜ កាមេរ៉ាកកតែម្តង (លើ Android គ្មានបញ្ហា)។ ឫសគល់៖ ប៊ូតុង ✖ ហៅ
// `dismissPhoneModal()` ដែលបើកប្រអប់ native `confirm()` ។ WebKit **ផ្អាក
// `<video>` ទាំងអស់ពេលបង្ហាញប្រអប់ native ហើយមិនបន្តវិញដោយស្វ័យប្រវត្តិទេ** ។
// ប៊ូតុង «រំលង» / «យល់ព្រម» ហៅ confirmPhone() ដែលគ្មាន confirm() ➜ ដូច្នេះ
// មានតែ ✖ ទេដែលកក — ត្រូវនឹងរបាយការណ៍អ្នកប្រើយ៉ាងជាក់លាក់។
//
// តេស្តនេះដក function **ពិត** ចេញពី app.js មករត់ក្នុង vm លើ DOM ក្លែង
// ដែលកត់ត្រារាល់ការហៅ video.play() ។
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { reactRuntime } = require('./react-view.js');

const ROOT = process.env.CAMERA_APP_DIR || path.join(__dirname, '..');
let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { console.log('   ok    ' + label); pass++; }
    else { console.log('   FAIL  ' + label + (detail !== undefined ? '\n         ' + JSON.stringify(detail) : '')); fail++; }
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

const src = fs.readFileSync(path.join(ROOT, 'ZoeW', 'app.js'), 'utf8');

const NEEDED = ['resumeScanVideo', 'onScanVideoPause', 'closeModal', 'dismissPhoneModal', 'requestCameraPermission'];
NEEDED.forEach((n) => ok('រកឃើញ ' + n + '() ក្នុង app.js', !!sliceFn(src, n)));
if (NEEDED.some((n) => !sliceFn(src, n))) {
    console.log('\n❌ ធ្លាក់ ' + (fail || 1));
    process.exit(1);
}

function buildContext(opts) {
    const video = {
        paused: !!opts.paused,
        playCalls: 0,
        pauseListeners: [],
        play() { this.playCalls++; this.paused = false; return Promise.resolve(); },
        addEventListener(type, fn) { if (type === 'pause') this.pauseListeners.push(fn); },
        removeEventListener(type, fn) {
            if (type !== 'pause') return;
            const i = this.pauseListeners.indexOf(fn);
            if (i !== -1) this.pauseListeners.splice(i, 1);
        }
    };
    const modals = opts.modals || { phoneModal: 'flex' };
    const els = {};
    Object.keys(modals).forEach((id) => { els[id] = { id: id, style: { display: modals[id] } }; });
    const timers = [];
    const ctx = {
        console,
        video: video,
        timers: timers,
        confirmResult: opts.confirmResult !== false,
        confirmCalls: 0,
        focusCalls: 0,
        document: {
            body: { style: {} },
            getElementById(id) {
                if (id === 'video') return opts.noVideo ? null : video;
                return els[id] || null;
            },
            querySelectorAll() { return Object.keys(els).map((id) => els[id]); }
        },
        setTimeout(fn, ms) { timers.push({ fn: fn, ms: ms }); return timers.length; },
        clearTimeout(handle) { if (timers[handle - 1]) timers[handle - 1] = null; },
        confirm(msg) { ctx.confirmCalls++; video.paused = true; return ctx.confirmResult; },
        safeFocusScanner() { ctx.focusCalls++; },
        queueMicrotask
    };
    vm.createContext(ctx);
    vm.runInContext(reactRuntime(src, { exclude: NEEDED, context: ctx }), ctx);
    ['currentStream', 'isCameraScanning', 'scanVideoResumeTimer', 'phoneModalDismissPromptOpen',
     'pendingBarcode', 'editingItemId', 'markingItemId', 'isModalOpen'].forEach((n) => {
        const decl = (src.match(new RegExp('^ *let ' + n + ' = .*$', 'm')) || [])[0];
        vm.runInContext(decl || ('let ' + n + ';'), ctx);
    });
    vm.runInContext('currentStream = ' + (opts.stream === false ? 'null' : '{}') + ';', ctx);
    vm.runInContext('isCameraScanning = ' + (opts.scanning === false ? 'false' : 'true') + ';', ctx);
    NEEDED.filter((n) => n !== 'requestCameraPermission').forEach((n) => vm.runInContext(sliceFn(src, n), ctx));
    // ⛔ `clearLookupStatus()` សម្អាតចម្លើយ Lookup ដែលទុកពេលកំពុងរក្សាទុក ➜ ប្រកាស Map **ពិត** ពី app.js
    const heldDecl = (src.match(/^ *const lookupAnswersHeldWhileSaving = .*$/m) || [])[0];
    vm.runInContext(heldDecl || 'const lookupAnswersHeldWhileSaving = new Map();', ctx);
    const clearLookupStatusFn = sliceFn(src, 'clearLookupStatus');
    if (clearLookupStatusFn) vm.runInContext(clearLookupStatusFn, ctx);
    return ctx;
}

const flush = (ctx) => ctx.timers.forEach((t, i) => { if (t) { ctx.timers[i] = null; t.fn(); } });

// ⛔ ថ្នាក់កំហុស៖ **`navigator.mediaDevices` អវត្តមាន ➜ កាមេរ៉ាលែងបើកបាន
// ពេញវគ្គ ដោយស្ងាត់។**
//
// `requestCameraPermission()` ដាក់ `isCameraStarting = true` **មុន** ហៅ
// `navigator.mediaDevices.getUserMedia(...)`។ ពេល `mediaDevices` ជា
// `undefined` (បរិបទមិន secure · WKWebView ក្នុង app ខ្លះ · browser ចាស់)
// នោះ **`TypeError` បោះ *synchronously*** — មុន promise ត្រូវបង្កើតផង។
// ⛔ `.catch(err => { isCameraStarting = false; … })` នៅចុង chain
// **ចាប់តែ promise rejection** ➜ វា **មិនចាប់ TypeError នោះទេ** ➜
// `isCameraStarting` ជាប់ `true` ជារៀងរហូត ➜ ការចុចប៊ូតុងកាមេរ៉ាលើកក្រោយ
// ត្រូវ `if (isCameraStarting) return;` ច្រានចេញ **ដោយស្ងាត់** ➜
// អ្នកប្រើឃើញប៊ូតុងមិនឆ្លើយតប គ្មានសារ គ្មានហេតុផល រហូតបិទបើក App។
//
// នេះជាថ្នាក់ «សំណួរទី ៩» ៖ dependency អាចបរាជ័យក្នុង **របៀបផ្សេងគ្នា** —
// ការបដិសេធសិទ្ធិ (promise reject — គ្របរួច) ធៀបនឹង **អវត្តមានទាំងស្រុង**
// (synchronous throw — មិនទាន់គ្រប)។
console.log('\n=== ⛔ `navigator.mediaDevices` អវត្តមាន (បរិបទមិន secure) ===');
{
    const camSrc = sliceFn(src, 'requestCameraPermission');
    ok('រកឃើញ requestCameraPermission() ក្នុង app.js', !!camSrc);
    if (camSrc) {
        function buildCam(opts) {
            const toasts = [];
            const ctx = {
                console: { error: () => {}, log: () => {} },
                Promise: Promise, Error: Error, Object: Object, String: String, Math: Math,
                setTimeout: () => 1, clearTimeout: () => {},
                navigator: opts.noMediaDevices ? {} : {
                    mediaDevices: { getUserMedia: () => Promise.reject(Object.assign(new Error('denied'), { name: 'NotAllowedError' })) }
                },
                document: { getElementById: () => null, querySelectorAll: () => [] },
                window: {},
                noteAppLockExcuse: () => {},
                warmZtoLookupProxyNow: () => false,
                stopCurrentStream: () => {},
                showToast: (m) => toasts.push(String(m)),
                setupTrackCapabilities: () => {},
                showCameraClosedBox: () => {},
                startFastNativeScan: () => {}, startZxingVideoScan: () => {},
                alert: (m) => toasts.push(String(m)),
                __toasts: toasts
            };
            ctx.globalThis = ctx;
            ctx.queueMicrotask = queueMicrotask;
            vm.createContext(ctx);
            vm.runInContext(reactRuntime(src, { exclude: NEEDED, context: ctx }), ctx);
            ['isCameraStarting', 'cameraRequestId', 'currentStream', 'isCameraScanning',
             'nativeDetector', 'liveScanCodeReader', 'pendingLoadedMetadataHandler'].forEach((n) => {
                const decl = (src.match(new RegExp('^ *let ' + n + ' = .*$', 'm')) || [])[0];
                vm.runInContext(decl || ('let ' + n + ';'), ctx);
            });
            vm.runInContext(camSrc, ctx);
            return ctx;
        }

        // ⛔ ខាងអវិជ្ជមាន ៖ mediaDevices អវត្តមាន
        const gone = buildCam({ noMediaDevices: true });
        let threw = null;
        try { vm.runInContext('requestCameraPermission();', gone); } catch (e) { threw = e && e.message; }
        ok('⛔ `mediaDevices` អវត្តមាន ➜ **មិនបោះចេញក្រៅ**', threw === null, threw);
        ok('⛔ ហើយ `isCameraStarting` ត្រូវដោះវិញ (បើអត់ ➜ កាមេរ៉ាលែងបើកបានពេញវគ្គ)',
            vm.runInContext('isCameraStarting', gone) === false,
            'isCameraStarting=' + vm.runInContext('isCameraStarting', gone));
        ok('⛔ ហើយអ្នកប្រើត្រូវឃើញមូលហេតុពិត (មិនស្ងាត់)',
            gone.__toasts.length >= 1, gone.__toasts);

        // ⛔ ទិសផ្ទុយ ៖ mediaDevices មាន តែសិទ្ធិត្រូវបដិសេធ ➜ ផ្លូវចាស់ត្រូវនៅដដែល
        const denied = buildCam({});
        let threw2 = null;
        try { vm.runInContext('requestCameraPermission();', denied); } catch (e) { threw2 = e && e.message; }
        ok('⛔ ទិសផ្ទុយ ៖ mediaDevices មាន ➜ ផ្លូវសំណើដើរធម្មតា (មិនបោះ)', threw2 === null, threw2);
    }
}

console.log('\n=== ✖ លើប្រអប់លេខទូរស័ព្ទ (iOS ផ្អាកវីដេអូដោយសារ confirm()) ===');

let c = buildContext({ confirmResult: true });
vm.runInContext('dismissPhoneModal();', c);
ok('✖ ➜ បញ្ជាក់ «បាទ/ចាស» — ប្រអប់ native ត្រូវបានបើកពិត', c.confirmCalls === 1, c.confirmCalls);
ok('✖ ➜ បញ្ជាក់ «បាទ/ចាស» — កាមេរ៉ាត្រូវបានបន្តវិញ (មិនកក)', c.video.playCalls >= 1, c.video.playCalls);
ok('✖ ➜ បញ្ជាក់ «បាទ/ចាស» — ប្រអប់ត្រូវបានបិទ',
    vm.runInContext('document.getElementById("phoneModal").style.display', c) === 'none');
ok('✖ ➜ បញ្ជាក់ «បាទ/ចាស» — វីដេអូលែងផ្អាក', c.video.paused === false);

c = buildContext({ confirmResult: false });
vm.runInContext('dismissPhoneModal();', c);
ok('✖ ➜ បោះបង់ការបញ្ជាក់ — កាមេរ៉ានៅតែត្រូវបានបន្តវិញ', c.video.playCalls >= 1, c.video.playCalls);
ok('✖ ➜ បោះបង់ការបញ្ជាក់ — ប្រអប់នៅបើកដដែល',
    vm.runInContext('document.getElementById("phoneModal").style.display', c) === 'flex');

console.log('\n=== ការបិទប្រអប់ធម្មតា ===');

c = buildContext({ modals: { phoneModal: 'flex' }, paused: true });
vm.runInContext('closeModal("phoneModal");', c);
ok('បិទប្រអប់ចុងក្រោយ ➜ បន្តកាមេរ៉ា', c.video.playCalls === 1, c.video.playCalls);
ok('បិទប្រអប់ចុងក្រោយ ➜ focus ត្រឡប់ទៅម៉ាស៊ីនស្កេន', c.focusCalls === 1, c.focusCalls);

// ⛔ ប្រអប់ទី ២ ត្រូវជាប្រអប់ **ពិត** របស់ App (`editPhoneModal`) ៖ App React រាប់ប្រអប់បើកតាមបញ្ជីប្រអប់ពិត
//    (`MODAL_IDS`) មិនមែនគ្រប់ `.modal` ក្នុង DOM ➜ id ប្រឌិតមិនដែលជាស្ថានភាពដែលអាចកើត
c = buildContext({ modals: { phoneModal: 'flex', editPhoneModal: 'flex' }, paused: true });
vm.runInContext('closeModal("phoneModal");', c);
ok('នៅមានប្រអប់មួយទៀតបើក ➜ មិនបន្តកាមេរ៉ា (វានៅត្រូវផ្អាកដដែល)', c.video.playCalls === 0, c.video.playCalls);

console.log('\n=== មិនត្រូវប្រយុទ្ធនឹងការបិទកាមេរ៉ា ===');

c = buildContext({ scanning: false, paused: true, confirmResult: true });
vm.runInContext('dismissPhoneModal();', c);
ok('កាមេរ៉ាបិទរួច ➜ មិនហៅ play() ឡើងវិញ', c.video.playCalls === 0, c.video.playCalls);

c = buildContext({ stream: false, paused: true });
vm.runInContext('closeModal("phoneModal");', c);
ok('គ្មាន stream ➜ មិនហៅ play()', c.video.playCalls === 0, c.video.playCalls);

c = buildContext({ noVideo: true, paused: true, confirmResult: true });
let threw = null;
try { vm.runInContext('dismissPhoneModal();', c); } catch (e) { threw = e; }
ok('គ្មាន <video> ក្នុង DOM ➜ មិន throw', !threw, threw && threw.message);

console.log('\n=== ការស្តាប់ព្រឹត្តិការណ៍ pause (ការការពារជាន់ទី ២) ===');

c = buildContext({ paused: false });
vm.runInContext('video.pauseListeners.length === 0 || 0;', c);
ok('onScanVideoPause ជា function ដែលអាចហៅបាន', vm.runInContext('typeof onScanVideoPause', c) === 'function');
vm.runInContext('video.paused = true; onScanVideoPause();', c);
ok('pause ➜ តាំង timer បន្ត (មិនហៅ play ភ្លាម)', c.video.playCalls === 0 && c.timers.filter(Boolean).length === 1,
    { play: c.video.playCalls, timers: c.timers.filter(Boolean).length });
vm.runInContext('onScanVideoPause(); onScanVideoPause();', c);
ok('pause ជាប់ៗគ្នា ➜ timer តែមួយ (គ្មានរង្វិលជុំ)', c.timers.filter(Boolean).length === 1,
    c.timers.filter(Boolean).length);
flush(c);
ok('timer ដល់ពេល ➜ បន្តវីដេអូ', c.video.playCalls === 1, c.video.playCalls);

c = buildContext({ paused: false });
vm.runInContext('onScanVideoPause();', c);
flush(c);
ok('វីដេអូលែងផ្អាករួចហើយ ➜ timer មិនហៅ play() ទៀត', c.video.playCalls === 0, c.video.playCalls);

c = buildContext({ scanning: false, paused: true });
vm.runInContext('onScanVideoPause();', c);
ok('កាមេរ៉ាបិទរួច ➜ pause មិនតាំង timer សោះ', c.timers.filter(Boolean).length === 0);

console.log('\n=== ការតភ្ជាប់ក្នុង app.js ===');
ok('beginScanning ចុះឈ្មោះ listener pause លើ <video>',
    /videoElement\.addEventListener\('pause', onScanVideoPause\)/.test(src));
// ⛔ វាស់ **ក្នុងតួ `stopCurrentStream()`** (មិនមែនគ្រប់ទីកន្លែងក្នុងឯកសារ) ហើយមិនចងនឹងឈ្មោះអថេររបស់ធាតុ
ok('stopCurrentStream ដក listener pause ចេញវិញ',
    /\b\w+\.removeEventListener\('pause', onScanVideoPause\)/.test(sliceFn(src, 'stopCurrentStream') || ''));
ok('stopCurrentStream សម្អាត timer បន្តវីដេអូ',
    /clearTimeout\(scanVideoResumeTimer\)/.test(src));

console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')' : '✅ ជោគជ័យ ' + pass));
process.exit(fail ? 1 : 0);
