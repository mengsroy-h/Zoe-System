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

const NEEDED = ['resumeScanVideo', 'onScanVideoPause', 'closeModal', 'dismissPhoneModal'];
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
        safeFocusScanner() { ctx.focusCalls++; }
    };
    vm.createContext(ctx);
    ['currentStream', 'isCameraScanning', 'scanVideoResumeTimer', 'phoneModalDismissPromptOpen',
     'pendingBarcode', 'editingItemId', 'markingItemId', 'isModalOpen'].forEach((n) => {
        const decl = (src.match(new RegExp('^ *let ' + n + ' = .*$', 'm')) || [])[0];
        vm.runInContext(decl || ('let ' + n + ';'), ctx);
    });
    vm.runInContext('currentStream = ' + (opts.stream === false ? 'null' : '{}') + ';', ctx);
    vm.runInContext('isCameraScanning = ' + (opts.scanning === false ? 'false' : 'true') + ';', ctx);
    NEEDED.forEach((n) => vm.runInContext(sliceFn(src, n), ctx));
    return ctx;
}

const flush = (ctx) => ctx.timers.forEach((t, i) => { if (t) { ctx.timers[i] = null; t.fn(); } });

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

c = buildContext({ modals: { phoneModal: 'flex', editModal: 'flex' }, paused: true });
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
ok('stopCurrentStream ដក listener pause ចេញវិញ',
    /videoElement\.removeEventListener\('pause', onScanVideoPause\)/.test(src));
ok('stopCurrentStream សម្អាត timer បន្តវីដេអូ',
    /clearTimeout\(scanVideoResumeTimer\)/.test(src));

console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')' : '✅ ជោគជ័យ ' + pass));
process.exit(fail ? 1 : 0);
