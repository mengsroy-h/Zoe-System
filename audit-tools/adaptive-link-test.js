// ថ្នាក់កំហុស៖ **ការងារបណ្តាញ «ស្រេចចិត្ត» មិនសម្របតាមគុណភាពតំណ។**
//
// App សម្របតាម **ឧបករណ៍** រួចហើយ (`measureDisplayHz()`, `setupAdaptivePerformance()`
// ➜ `perf-lite`, `LIVE_SCAN_WIDTH_STEPS`) ប៉ុន្តែវា **មិនសម្របតាមតំណបណ្តាញទេ** —
// `navigator.connection` មិនត្រូវបានប្រើកន្លែងណាសោះ។ ផលៈ លើ 2G ឬពេលអ្នកប្រើ
// បើក «Data Saver» ការងារ **ស្រេចចិត្ត** នៅតែរត់ពេញ៖
//
//   ១. `revalidateShell()` ៖ ការបើកទំព័រតែម្តងបង្កើតសំណើ ៨–១០ ក្នុងផ្ទៃខាងក្រោយ
//      ខណៈ **កំណែថ្មីមកតាមផ្លូវ `CACHE_VERSION` រួចហើយ** (CLAUDE.md ៖ ការធ្វើឲ្យ
//      ស្រស់ជាការងារ «ស្រេចចិត្ត»)។ លើ 2G សំណើទាំងនោះដណ្តើមកូតា connection
//      ពីសំណើ **ចាំបាច់**។
//   ២. `prefetchCustomerDataTableRowsIfConfigured()` ៖ ទាញ **តារាងអតិថិជនទាំងមូល**
//      រៀងរាល់ ១៥ នាទី ខណៈទិន្នន័យនោះទាញតាមតម្រូវការបានស្រាប់។ នេះជាអ្វីដែល
//      `saveData` មានន័យត្រង់ៗថាត្រូវជៀសវាង។
//
// ⛔ `linkIsFrugal()` ត្រូវ **fail open** ៖ browser ដែលគ្មាន NetworkInformation API
// (Safari/iOS — គ្មានទាល់តែសោះ) ត្រូវទទួលឥរិយាបថ **ដដែលនឹងមុន**។ ការ fail closed
// នឹងបិទការធ្វើឲ្យស្រស់លើ iPhone ទាំងអស់ — ថ្នាក់កំហុសធ្ងន់ជាងបញ្ហាដើម។
//
// តេស្តនេះស្រង់ `revalidateShell()` និង `linkIsFrugal()` **ពិត** ចេញពី `sw.js`
// ដែល ship រួច មករត់ក្នុង `vm` ជាមួយ `navigator` ក្លែងក្លាយ — មិនមែនកូដចម្លងទេ។
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = process.env.ADAPTIVE_APP_DIR || path.join(__dirname, '..');
const APPS = ['ZoeW', 'ZoeKeyGen'];
let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { pass++; console.log('  ok    ' + label); }
    else { fail++; console.log('  FAIL  ' + label + (detail !== undefined ? '\n        ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : '')); }
}

// ស្រង់តួ function ពេញលេញតាមការរាប់រង្វង់ក្រចក
function sliceFn(src, name) {
    const start = src.indexOf('function ' + name + '(');
    if (start === -1) return null;
    let i = src.indexOf('{', start), depth = 0;
    for (; i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(start, i + 1); }
    }
    return null;
}

console.log('\n=== ការធ្វើឲ្យសំបកស្រស់ត្រូវសម្របតាមគុណភាពតំណ (sw.js ទាំង ៣) ===');

// តំណ ៖ [ឈ្មោះ, connection, តើត្រូវទាញឬ]
const LINKS = [
    ['គ្មាន NetworkInformation API (Safari/iOS)', undefined, true],
    ['4g', { effectiveType: '4g', saveData: false }, true],
    ['3g', { effectiveType: '3g', saveData: false }, true],
    ['2g', { effectiveType: '2g', saveData: false }, false],
    ['slow-2g', { effectiveType: 'slow-2g', saveData: false }, false],
    ['Data Saver បើក (4g)', { effectiveType: '4g', saveData: true }, false]
];

const flush = () => new Promise((resolve) => setImmediate(resolve));
const SW_URL = 'https://zoe.invalid/sw.js';

(async () => {
for (const app of APPS) {
    const swPath = path.join(ROOT, app, 'sw.js');
    if (!fs.existsSync(swPath)) continue;
    const sw = fs.readFileSync(swPath, 'utf8');
    const revalidate = sliceFn(sw, 'revalidateShell');
    const frugal = sliceFn(sw, 'linkIsFrugal');
    ok(app + ': រកឃើញ linkIsFrugal() ក្នុង sw.js ពិត', !!frugal);
    ok(app + ': revalidateShell() ពិគ្រោះនឹងគុណភាពតំណ',
        !!revalidate && /linkIsFrugal\(\)/.test(revalidate));
    if (!revalidate || !frugal) continue;
    // ថេរខ្សែអក្សរកម្រិតកំពូលដែល revalidateShell() យោង (ឧ. FRESH) ត្រូវស្រង់ពី sw.js ពិត
    // មិនមែនចាក់ក្នុង sandbox — ការប្តូរតម្លៃរបស់វាត្រូវហូរមកដល់ការវាស់ដោយស្វ័យប្រវត្តិ
    // ⛔ helper ដែល revalidateShell() ហៅ (ឧ. `shellDeployIsCurrent()` ៖ មិនចាក់កំណែ deploy ថ្មីចូល cache ចាស់)
    //    ត្រូវស្រង់ពី sw.js ពិតដែរ — stub វា = ស្នាមភ្ជាប់គ្មានអ្នកវាស់
    const helpers = ['shellDeployIsCurrent'].filter((n) => new RegExp('\\b' + n + '\\(').test(revalidate))
        .map((n) => sliceFn(sw, n)).filter(Boolean);
    const referenced = [revalidate].concat(helpers).join('\n');
    const stringConsts = (sw.match(/^const [A-Z_][A-Z0-9_]* = '[^'\n]*';$/gm) || [])
        .filter((line) => new RegExp('\\b' + line.split(' ')[1] + '\\b').test(referenced))
        .join('\n');
    const numberConsts = (sw.match(/^const DEPLOY_[A-Z0-9_]* = \d+;$/gm) || []).join('\n');
    const lets = helpers.length ? (sw.match(/^let deployCheck = null;$/m) || [''])[0] : '';
    const swCode = [stringConsts, numberConsts, lets, frugal].concat(helpers, [revalidate]).join('\n');

    for (const [label, connection, shouldFetch] of LINKS) {
        let fetched = 0;
        const sandbox = {
            navigator: { onLine: true, connection: connection },
            setTimeout: setTimeout, clearTimeout: clearTimeout, Set: Set, String: String, Date: Date,
            self: { location: { href: SW_URL } },
            AbortController: function () { this.signal = {}; this.abort = function () {}; },
            fetch: function (url) {
                if (url === SW_URL) return Promise.resolve({ ok: true, text: () => Promise.resolve(sw) });
                fetched++;
                return Promise.resolve({ ok: true, redirected: false, clone: () => ({}) });
            },
            REVALIDATE_TIMEOUT_MS: 6000,
            REVALIDATE_MAX_IN_FLIGHT: 4,
            revalidateInFlight: new Set()
        };
        vm.createContext(sandbox);
        vm.runInContext(swCode, sandbox);
        const cache = { put: () => Promise.resolve() };
        vm.runInContext('revalidateShell(__cache, { url: "/app.js" }, "./app.js");',
            Object.assign(sandbox, { __cache: cache }));
        await flush(); await flush(); await flush();
        ok(app + ': ' + label + ' ➜ ' + (shouldFetch ? 'ធ្វើឲ្យស្រស់' : 'រំលង'),
            (fetched > 0) === shouldFetch, 'fetched=' + fetched);
    }

    // ⛔ guard ក្រៅបណ្តាញត្រូវនៅដដែល — កុំឲ្យការសម្របជំនួសវា
    let offFetched = 0;
    const offBox = {
        navigator: { onLine: false, connection: { effectiveType: '4g', saveData: false } },
        setTimeout: setTimeout, clearTimeout: clearTimeout, Set: Set, String: String,
        AbortController: function () { this.signal = {}; this.abort = function () {}; },
        fetch: function () { offFetched++; return Promise.resolve({ ok: true, redirected: false, clone: () => ({}) }); },
        REVALIDATE_TIMEOUT_MS: 6000, REVALIDATE_MAX_IN_FLIGHT: 4, revalidateInFlight: new Set()
    };
    vm.createContext(offBox);
    vm.runInContext(swCode, offBox);
    vm.runInContext('revalidateShell({ put: () => Promise.resolve() }, { url: "/app.js" }, "./app.js");', offBox);
    await flush(); await flush();
    ok(app + ': ក្រៅបណ្តាញ ➜ រំលងដដែល', offFetched === 0, 'fetched=' + offFetched);
}
})().then(() => {

// === ⛔ ផ្លូវ cache-miss របស់ sw.js ត្រូវនៅ **គ្មានពេលកំណត់** ===
// ជុំ 2.17.5 បានពិចារណាបន្ថែម timeout លើ `fetch(request)` ក្នុងផ្លូវ cache-miss
// (ដើម្បីកុំឲ្យទំព័រព្យួរលើបណ្តាញស្លាប់) រួច **បដិសេធវាដោយផ្អែកលើការវាស់**៖
//   ១. `CORE_SHELL` ប្រើ `cache.addAll()` **atomic** ➜ ធនធានស្នូល **មិនអាច
//      បាត់ពី cache បានទេ** ក្រោយ install ជោគជ័យ (បាត់មួយ ➜ install ធ្លាក់
//      ➜ SW ចាស់នៅដដែល)។ មានតែ `OPTIONAL_SHELL` (manifest + icon ២) ដែល
//      អាចបាត់ ហើយ **គ្មានមួយណាទប់ការគូរទេ**។
//   ២. `zxing_reader.wasm` = **១ ០៦៨ kB** ➜ លើ 2G វាត្រូវការ **៣១ វិនាទី**
//      និងលើ slow-2G **៥៣ វិនាទី** ដោយស្របច្បាប់។ timeout ១០ វិនាទីនឹង
//      **បោះបង់ធនធានដែលធ្វើឲ្យការស្កេនដើរក្រៅបណ្តាញ** — ជាការថយក្រោយទៅ
//      ថ្នាក់កំហុសដដែលដែលកំណែ 2.10.0 ដោះស្រាយដោយនាំ ZXing ចូល repo។
// ដូច្នេះ **កុំបន្ថែម timeout ទីនោះ**។ ការការពារត្រឹមត្រូវគឺ cache-first
// (មានស្រាប់) បូក `linkIsFrugal()` លើការងារ **ស្រេចចិត្ត** តែប៉ុណ្ណោះ។
console.log('\n=== ផ្លូវ cache-miss ត្រូវនៅគ្មានពេលកំណត់ (ធនធានធំលើ 2G) ===');
for (const app of APPS) {
    const swPath = path.join(ROOT, app, 'sw.js');
    if (!fs.existsSync(swPath)) continue;
    const sw = fs.readFileSync(swPath, 'utf8');
    ok(app + ': ធនធានស្នូលដំឡើងជា **ក្រុម** (atomic) ➜ cache-miss មិនកើតលើស្នូល',
        /cache\.addAll\(CORE_SHELL[).]/.test(sw));
    const fetchHandler = sw.slice(sw.indexOf("addEventListener('fetch'"));
    ok(app + ': គ្មាន timeout បោះបង់លើផ្លូវ cache-miss',
        !/AbortController/.test(fetchHandler),
        'ការបន្ថែម AbortController ទីនោះនឹងសម្លាប់ការទាញ wasm ១ MB លើ 2G');
}
if (fs.existsSync(path.join(ROOT, 'ZoeW', 'vendor', 'zxing_reader.wasm'))) {
    const kb = fs.statSync(path.join(ROOT, 'ZoeW', 'vendor', 'zxing_reader.wasm')).size / 1024;
    ok('ZoeW: `zxing_reader.wasm` ធំល្មមឲ្យ timeout ថេរជាគ្រោះថ្នាក់ (> 500 kB)',
        kb > 500, Math.round(kb) + ' kB ➜ ~' + Math.round(kb / 35) + 's លើ 2G');
}

// === ការទាញតារាងអតិថិជនជាមុន (ZoeW) ===
console.log('\n=== ការទាញជាមុនត្រូវគោរព Data Saver / 2G ===');
{
    const appSrc = fs.readFileSync(path.join(ROOT, 'ZoeW', 'app.js'), 'utf8');
    const fn = sliceFn(appSrc, 'prefetchCustomerDataTableRowsIfConfigured');
    ok('ZoeW: រកឃើញ prefetchCustomerDataTableRowsIfConfigured()', !!fn);
    ok('ZoeW: មាន linkIsFrugal() ក្នុង app.js', !!sliceFn(appSrc, 'linkIsFrugal'));
    // ⛔ ការការពារអាចរស់នៅ **ក្នុង helper** (`customerTablePrefetchAllowed()`
    // តាំងពី 2.20.2) — ការអះអាងលើតួ function តែម្យ៉ាងជាថ្នាក់ «checker ស្កេនអ្វី»
    // ដដែលនឹង 2.19.3។ ដូច្នេះវាដើរតាមការបញ្ជូនបន្ត ១ ជាន់ ហើយ
    // `lookup-prefetch-test.js` អះអាង **ឥរិយាបថ** ពិតក្នុង `vm` ជាជាន់ទី ២។
    const gateFn = sliceFn(appSrc, 'customerTablePrefetchAllowed') || '';
    const viaGate = !!fn && /customerTablePrefetchAllowed\(\)/.test(fn);
    ok('ZoeW: ការទាញជាមុនរំលងលើតំណសន្សំទិន្នន័យ',
        (!!fn && /linkIsFrugal\(\)/.test(fn)) || (viaGate && /linkIsFrugal\(\)/.test(gateFn)));
    ok('ZoeW: ការទាញជាមុននៅតែរំលងពេលក្រៅបណ្តាញ',
        (!!fn && /navigator\.onLine === false/.test(fn)) || (viaGate && /navigator\.onLine === false/.test(gateFn)));

    // `linkIsFrugal()` ពិតរបស់ app.js ត្រូវសម្រេចដូច sw.js បេះបិទ
    const appFrugal = sliceFn(appSrc, 'linkIsFrugal');
    if (appFrugal) {
        for (const [label, connection, shouldFetch] of LINKS) {
            const box = { navigator: { connection: connection }, String: String };
            vm.createContext(box);
            vm.runInContext(appFrugal, box);
            const frugalNow = vm.runInContext('linkIsFrugal()', box);
            ok('ZoeW: linkIsFrugal() ➜ ' + label + ' = ' + (!shouldFetch),
                frugalNow === !shouldFetch, 'got ' + frugalNow);
        }
    }
}

console.log('\n' + (fail === 0 ? 'PASS' : 'FAIL') + ' — ' + pass + ' ok, ' + fail + ' fail');
process.exit(fail === 0 ? 0 : 1);
}).catch((e) => {
    console.log('  FAIL  checker គាំង ៖ ' + (e && e.stack || e));
    process.exit(1);
});
