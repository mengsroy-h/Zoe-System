// ⛔ ថ្នាក់កំហុស៖ **ការដោះ barcode ចេញពី `zoew_barcode_registry` ដែលធ្លាក់
// ដោយស្ងាត់ ➜ barcode នោះស្កេនចូលមិនបានទៀត *ជារៀងរហូត*។**
//
// `claimBarcodeInRegistry()` ត្រឡប់ `'taken'` ពេលកូនសោមានក្នុង registry ➜
// `confirmPhone()` បដិសេធការស្កេនដោយសារ «ត្រូវបានបញ្ចូលរួចហើយ»។ ដូច្នេះ
// កូនសោដែល **គ្មានម្ចាស់** (កញ្ចប់ត្រូវលុបជាអចិន្ត្រៃយ៍រួច ឬការរក្សាទុក
// ធ្លាក់រួច rollback) ជា **អន្ទាក់ស្ថាពរ** ៖ អ្នកប្រើឃើញសារថាកញ្ចប់មាន
// ក្នុងប្រព័ន្ធ ខណៈវាគ្មាននៅក្នុងប្រវត្តិ ឬធុងសំរាមសោះ ហើយ **គ្មានផ្លូវ
// ដោះចេញពី UI ទេ**។
//
// មុនកែ ការដោះជា `fb.update(...).catch(() => {})` — ការធ្លាក់ត្រូវលេប
// ទាំងស្រុង៖ គ្មានការព្យាយាមឡើងវិញ · គ្មានជួរ · គ្មានការរាយការណ៍។
// ផ្លូវហៅ ៣ ដែលអាចលេច ៖ `executePermanentDelete` · ការ purge ស្វ័យប្រវត្តិ
// (៣០ ថ្ងៃ / ២ ថ្ងៃ) · និង rollback ពេលការរក្សាទុកធ្លាក់។
//
// នេះជាថ្នាក់ «claim ងាប់» ដដែលនឹងមេរៀន 2.18.0 ដែលវិលមកតាមទ្វារផ្សេង៖
// ជុំនោះកែ **ការដោះ claim ស្តារ** តែ **registry របស់ barcode រអិលកាត់**។
//
// ⚠️ **មូលហេតុដែល checker ១២៣ មិនចាប់** ៖ `duplicate-scan-test.js` សាក
// ករណី «ឧបករណ៍ផ្សេងកក់រួច» ដែលជា claim **ស្របច្បាប់** — គ្មានឯកសារណា
// ដាក់ការដោះក្នុង **របៀបបរាជ័យ** សោះ (សំណួរទី ៩)។
//
// ⛔ **ការជួសជុលដោយស្វ័យប្រវត្តិត្រូវបានច្រានចេញដោយចេតនា** ៖ ការដោះកូនសោ
// ដែល «មើលទៅដូចកំព្រា» បើកចន្លោះប្រណាំង — ឧបករណ៍ A កក់ registry រួច
// កំពុងសរសេរប្រវត្តិ (រហូតដល់ ១៥ វិ.) ខណៈឧបករណ៍ B មិនទាន់ឃើញ ➜ B នឹង
// ដោះកូនសោនោះ ➜ **កញ្ចប់ស្ទួន និងលុយបូកស្ទួន**។ ការដោះដែលទុកចិត្តបាន
// (ព្យាយាមឡើងវិញ + ជួរ) បិទប្រភពនៃការលេច ដោយមិនបង្កើតហានិភ័យលុយថ្មី។
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = process.env.REGISTRY_APP_DIR || path.join(__dirname, '..');
const APP = path.join(ROOT, 'ZoeW');

let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { pass++; console.log('   ok    ' + label); }
    else { fail++; console.log('  FAIL   ' + label + (detail !== undefined ? '\n         ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : '')); }
}

let SRC = '';
try {
    SRC = fs.readFileSync(path.join(APP, 'app.js'), 'utf8');
} catch (e) {
    console.log('  FAIL   អាន ZoeW/app.js មិនបាន ➜ ' + e.message);
    console.log('\n❌ ធ្លាក់ — កូដដែលតេស្តនេះការពារ បាត់ពី tree ដែលកំពុងពិនិត្យ');
    process.exit(1);
}

function sliceFn(name) {
    const at = SRC.search(new RegExp('(?:async\\s+)?function\\s+' + name + '\\s*\\('));
    if (at === -1) return null;
    let depth = 0;
    const start = SRC.indexOf('{', SRC.indexOf(')', at));
    for (let k = start; k < SRC.length; k++) {
        if (SRC[k] === '{') depth++;
        else if (SRC[k] === '}') { depth--; if (!depth) return SRC.slice(at, k + 1); }
    }
    return null;
}

console.log('\n=== ០. ជាន់អប្បបរមា ===');
ok('ZoeW/app.js មិនទទេ (>= 4000 បន្ទាត់)', SRC.split('\n').length >= 4000, SRC.split('\n').length);
const releaseCallSites = (SRC.match(/releaseBarcodesInRegistry\(/g) || []).length;
ok('ឃើញកន្លែងហៅ releaseBarcodesInRegistry >= 4', releaseCallSites >= 4, releaseCallSites);

const REQUIRED = ['barcodeRegistryKey', 'releaseBarcodesInRegistry', 'releaseRegistryKeys',
    'queueRegistryReleaseRetry', 'flushPendingRegistryReleases', 'retryAsync',
    'registryKeyIsOwned', 'registryReleaseVerdict', 'collectItemBarcodes'];
const fnSrc = {};
const missing = [];
for (const n of REQUIRED) {
    const s = sliceFn(n);
    if (s) fnSrc[n] = s; else missing.push(n);
}
// ⛔ កុំបញ្ឈប់ checker — stub រួចទុកឲ្យការអះអាងឥរិយាបថរត់ (មេរៀន 2.19.3)
ok('រក helper ដែលធ្វើឲ្យការដោះទុកចិត្តបាន ឃើញទាំង ' + REQUIRED.length, missing.length === 0, missing);
for (const n of missing) fnSrc[n] = 'function ' + n + '() { return Promise.resolve(); }';

// ── ១. ការតភ្ជាប់រចនាសម្ព័ន្ធ ─────────────────────────────────────────
console.log('\n=== ១. ការដោះត្រូវភ្ជាប់ទៅជួរ និងទៅការស្តារបណ្តាញ ===');
ok('⛔ ការដោះលែងជា `.catch(() => {})` ទទេ',
    !/fb\.update\(fb\.ref\(db, 'zoew_barcode_registry'\), updates\)\.catch\(\(\) => \{\}\)/.test(SRC));
ok('`.info/connected` ត្រឡប់ `true` ➜ ហៅ flushPendingRegistryReleases()',
    /isDatabaseConnected\)\s*\{[\s\S]{0,400}?flushPendingRegistryReleases\(\)/.test(SRC));
ok('ការចាកចេញសម្អាតជួរ (គ្មានកូនសោអតិថិជនសល់)',
    /pendingRegistryReleases\.clear\(\)/.test(SRC));
ok('ការដោះឆ្លងកាត់ `dbOp(` ➜ ការព្យួរក្លាយជាកំហុសធម្មតា (ច្បាប់ 2.23.1)',
    /releaseRegistryKeys[\s\S]{0,400}?dbOp\(fb\.update\(fb\.ref\(db, 'zoew_barcode_registry'\)/.test(SRC));

// ── ២. ឥរិយាបថ ៖ ការដោះដែលធ្លាក់ ត្រូវចូលជួរ រួចរត់ឡើងវិញ ─────────────
function makeCtx(behaviour) {
    const calls = [];
    const ctx = {
        console, Math, JSON, Promise, setTimeout, clearTimeout, Object, Array, String, Number,
        parseFloat, parseInt, isNaN, isFinite, Date, Error, Map, Set, window: {},
        db: {}, fb: {
            ref: (_d, p) => ({ path: p }),
            update: (r, updates) => {
                calls.push(Object.keys(updates));
                return behaviour(calls.length);
            }
        },
        dbOp: null,
        scanHistory: [], deletedItems: [],
        DB_LISTENER_KEY_HISTORY: 'history', DB_LISTENER_KEY_DELETED: 'deleted',
        staleKeys: new Set(),
        pendingRegistryReleases: new Map(),
        REGISTRY_RELEASE_RETRY_MAX: 6,
        REGISTRY_RELEASE_QUEUE_MAX: 500,
        registryReleaseFlushInFlight: false,
        __calls: calls
    };
    ctx.window = ctx;
    vm.createContext(ctx);
    // `dbOp` ពិតរុំដោយ withTimeout; ទីនេះយើងគ្រាន់តែបញ្ជូនបន្ត
    vm.runInContext('function dbOp(p) { return Promise.resolve(p); }', ctx);
    vm.runInContext('function dbListenerViewIsStale(k) { return staleKeys.has(k); }', ctx);
    vm.runInContext(fnSrc.retryAsync + '\n' + fnSrc.barcodeRegistryKey + '\n'
        + fnSrc.collectItemBarcodes + '\n' + fnSrc.registryKeyIsOwned + '\n'
        + fnSrc.registryReleaseVerdict + '\n'
        + fnSrc.releaseRegistryKeys + '\n' + fnSrc.queueRegistryReleaseRetry + '\n'
        + fnSrc.releaseBarcodesInRegistry + '\n' + fnSrc.flushPendingRegistryReleases + '\n', ctx);
    return ctx;
}

const tick = (n) => new Promise((resolve) => setTimeout(resolve, n || 0));

(async () => {
    console.log('\n=== ២. ការដោះដែលធ្លាក់រហូត ➜ ត្រូវចូលជួរ មិនត្រូវបាត់ស្ងាត់ ===');
    {
        const ctx = makeCtx(() => Promise.reject(new Error('disconnect')));
        vm.runInContext('releaseBarcodesInRegistry(["ZTO900111"])', ctx);
        await tick(50); await tick(1300); await tick(1300); await tick(1300); await tick(200);
        ok('ព្យាយាមឡើងវិញច្រើនដងមុនបោះបង់ (មិនមែនតែម្តង)', ctx.__calls.length >= 2, ctx.__calls.length);
        ok('⛔ កូនសោដែលដោះមិនបាន ត្រូវចូលជួរ (មិនបាត់ស្ងាត់)',
            ctx.pendingRegistryReleases.has('ZTO900111'), Array.from(ctx.pendingRegistryReleases.keys()));
    }

    console.log('\n=== ៣. ការភ្ជាប់មកវិញ ➜ ជួរត្រូវរត់ រួច registry ស្អាត ===');
    {
        let failing = true;
        const ctx = makeCtx(() => (failing ? Promise.reject(new Error('disconnect')) : Promise.resolve()));
        vm.runInContext('releaseBarcodesInRegistry(["ZTO900111", "ZTO900222"])', ctx);
        await tick(50); await tick(1300); await tick(1300); await tick(1300); await tick(200);
        ok('កូនសោទាំង ២ ចូលជួរ', ctx.pendingRegistryReleases.size === 2, Array.from(ctx.pendingRegistryReleases.keys()));
        failing = false;
        const before = ctx.__calls.length;
        vm.runInContext('flushPendingRegistryReleases()', ctx);
        await tick(20);
        ok('ការភ្ជាប់មកវិញកេះការសរសេរថ្មី', ctx.__calls.length > before, { before, after: ctx.__calls.length });
        ok('⛔ ជួរទទេវិញក្រោយជោគជ័យ ➜ barcode លែងជាប់អន្ទាក់',
            ctx.pendingRegistryReleases.size === 0, Array.from(ctx.pendingRegistryReleases.keys()));
        ok('ការសរសេរចុងក្រោយផ្ទុកកូនសោទាំង ២',
            ctx.__calls[ctx.__calls.length - 1].length === 2, ctx.__calls[ctx.__calls.length - 1]);
    }

    console.log('\n=== ៤. ⛔ ទិសផ្ទុយ ៖ បណ្តាញធម្មតា ➜ ដោះម្តងគត់ គ្មានជួរ ===');
    {
        const ctx = makeCtx(() => Promise.resolve());
        vm.runInContext('releaseBarcodesInRegistry(["ZTO900111"])', ctx);
        await tick(30);
        ok('ការដោះជោគជ័យហៅ update តែ ១ ដង', ctx.__calls.length === 1, ctx.__calls);
        ok('គ្មានអ្វីចូលជួរ', ctx.pendingRegistryReleases.size === 0, Array.from(ctx.pendingRegistryReleases.keys()));
    }

    console.log('\n=== ៥. ជួរមានពិដាន (មិនស៊ីសតិគ្មានទីបញ្ចប់) ===');
    {
        const ctx = makeCtx(() => Promise.resolve());
        vm.runInContext('for (var i = 0; i < 900; i++) queueRegistryReleaseRetry(["K" + i], 1);', ctx);
        ok('ជួរឈប់ត្រឹមពិដាន ' + ctx.REGISTRY_RELEASE_QUEUE_MAX,
            ctx.pendingRegistryReleases.size === ctx.REGISTRY_RELEASE_QUEUE_MAX, ctx.pendingRegistryReleases.size);
        vm.runInContext('queueRegistryReleaseRetry(["OVER"], 99);', ctx);
        ok('⛔ កូនសោដែលព្យាយាមលើសពិដាន ត្រូវបោះបង់ (មិនវិលជារៀងរហូត)',
            !ctx.pendingRegistryReleases.has('OVER'));
    }

    console.log('\n=== ៦. ការហៅស្របគ្នាមិនជាន់គ្នា ===');
    {
        const ctx = makeCtx(() => new Promise((r) => setTimeout(r, 30)));
        vm.runInContext('queueRegistryReleaseRetry(["A"], 1); flushPendingRegistryReleases(); flushPendingRegistryReleases();', ctx);
        await tick(80);
        ok('ការហៅ flush ២ ដងជាប់គ្នា ➜ សរសេរតែ ១ ដង', ctx.__calls.length === 1, ctx.__calls);
    }

    // ── ៧. ⛔ ការដោះដែលពន្យារ មិនត្រូវលុប claim ដែលកក់ឡើងវិញដោយស្របច្បាប់ ──
    // ថ្នាក់ ៖ កូនសោចូលជួរ ➜ អ្នកប្រើស្កេន barcode នោះចូលវិញ (claim ថ្មី) ➜
    // ការ flush លុបកូនសោនោះ ➜ ជាន់ការពារស្ទួន **ខាង server** បាត់ ➜
    // ថ្នាក់ «លុយបូកស្ទួន» របស់ 2.25.4 វិលមកវិញ។
    console.log('\n=== ៧. ⛔ ការដោះដែលពន្យារ គោរពម្ចាស់ថ្មី និងទិដ្ឋភាពដែលមិនទាន់មកដល់ ===');
    {
        const ctx = makeCtx(() => Promise.resolve());
        vm.runInContext('queueRegistryReleaseRetry(["ZTO900111"], 1);'
            + 'scanHistory.push({ id: "i1", barcodes: [{ code: "ZTO900111" }] });'
            + 'flushPendingRegistryReleases();', ctx);
        await tick(30);
        ok('⛔ barcode ត្រូវស្កេនចូលវិញរួច ➜ **មិនដោះ** (claim ជារបស់វា)',
            ctx.__calls.length === 0, ctx.__calls);
        ok('កូនសោត្រូវទម្លាក់ចេញពីជួរ (មិនព្យាយាមរហូត)',
            ctx.pendingRegistryReleases.size === 0, Array.from(ctx.pendingRegistryReleases.keys()));
    }
    {
        const ctx = makeCtx(() => Promise.resolve());
        vm.runInContext('queueRegistryReleaseRetry(["ZTO900111"], 1);'
            + 'deletedItems.push({ id: "d1", barcodes: [{ code: "ZTO900111" }] });'
            + 'flushPendingRegistryReleases();', ctx);
        await tick(30);
        ok('⛔ barcode នៅក្នុងធុងសំរាម ➜ **មិនដោះ** (វានៅជារបស់ប្រព័ន្ធ)',
            ctx.__calls.length === 0, ctx.__calls);
    }
    {
        const ctx = makeCtx(() => Promise.resolve());
        vm.runInContext('queueRegistryReleaseRetry(["ZTO900111"], 1);'
            + 'staleKeys.add("history");'
            + 'flushPendingRegistryReleases();', ctx);
        await tick(30);
        ok('⛔ ទិដ្ឋភាពប្រវត្តិមិនទាន់មកដល់ ➜ **ពន្យារ** មិនដោះ (មេរៀន 2.20.8)',
            ctx.__calls.length === 0, ctx.__calls);
        ok('ការពន្យារ **រក្សា** កូនសោក្នុងជួរ (មិនបាត់)',
            ctx.pendingRegistryReleases.has('ZTO900111'), Array.from(ctx.pendingRegistryReleases.keys()));
        vm.runInContext('staleKeys.clear(); flushPendingRegistryReleases();', ctx);
        await tick(30);
        ok('⛔ ទិសផ្ទុយ ៖ ទិដ្ឋភាពមកដល់ ហើយគ្មានម្ចាស់ ➜ **ដោះពិត**',
            ctx.__calls.length === 1, ctx.__calls);
        ok('ជួរទទេវិញ', ctx.pendingRegistryReleases.size === 0);
    }
    {
        const ctx = makeCtx(() => Promise.resolve());
        vm.runInContext('queueRegistryReleaseRetry(["ZTO900111"], 1);'
            + 'staleKeys.add("deleted");'
            + 'flushPendingRegistryReleases();', ctx);
        await tick(30);
        ok('⛔ ទិដ្ឋភាពធុងសំរាមមិនទាន់មកដល់ ➜ ពន្យារដែរ',
            ctx.__calls.length === 0 && ctx.pendingRegistryReleases.has('ZTO900111'), ctx.__calls);
    }
    {
        // ⛔ ផ្លូវ *ភ្លាមៗ* មិនត្រូវមានច្រកទ្វារនោះទេ — អ្នកហៅទើបលុបធាតុចេញ
        // ហើយបញ្ជីក្នុងសតិអាចមិនទាន់ធ្វើបច្ចុប្បន្នភាព ➜ ការត្រួតពិនិត្យនឹង
        // រំលងការដោះដែលត្រឹមត្រូវ ហើយបង្កើតកូនសោកំព្រាថ្មី។
        const ctx = makeCtx(() => Promise.resolve());
        vm.runInContext('scanHistory.push({ id: "i1", barcodes: [{ code: "ZTO900111" }] });'
            + 'staleKeys.add("history");'
            + 'releaseBarcodesInRegistry(["ZTO900111"]);', ctx);
        await tick(30);
        ok('⛔ ទិសផ្ទុយ ៖ ការដោះ *ភ្លាមៗ* មិនត្រូវត្រូវច្រកទ្វារនោះទប់',
            ctx.__calls.length === 1, ctx.__calls);
    }

    console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail : '✅ គ្មានបញ្ហា') + ' — ok ' + pass);
    process.exit(fail ? 1 : 0);
})().catch((e) => {
    console.log('  FAIL   តេស្តគាំង ➜ ' + (e && e.stack ? e.stack : e));
    process.exit(1);
});
