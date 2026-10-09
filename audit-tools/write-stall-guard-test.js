// ⛔ ថ្នាក់កំហុស៖ **ការសរសេរ Firebase ដែល *ព្យួរ* ហើយឈរនៅ *ខាងក្រោយ helper*
// ធ្វើឲ្យសោ in-flight ជាប់ជារៀងរហូត — ឬធ្វើឲ្យអ្នកប្រើមិនឃើញសារអ្វីទាំងអស់។**
//
// នេះជា **មេរៀន 2.23.1 (`db-stall-guard-test.js`) ដែលវិលមកតាមទ្វារផ្សេង**។
// ឯកសារនោះស្កេនតែ `await fb.<dataOp>(…)` **ដោយផ្ទាល់** ➜ ការហៅតាមរយៈ
// helper (`await purgeDeletedItemsQuietly(…)` · `await retryAsync(() =>
// saveSingleDeletedItemToFirebase(…))`) **រអិលកាត់ទាំងស្រុង**។
// `CLAUDE.md` កត់ត្រាចន្លោះនោះទុករួច (ផ្នែក «ច. ការសរសេរធុងសំរាមដែលព្យួរ»)
// ហើយក៏សរសេរទុកដែរថា **ការកត់ត្រាមិនមែនជាការអនុវត្តទេ** (ច្បាប់ទី ១៣) ➜
// ឯកសារនេះជាឧបករណ៍ដែលចាក់សោវា។
//
// **វាស់បានលើ tree មុនកែ (stub ដែលព្យួរ — មិនមែនការអានកូដទេ)**៖
//   · `runAutomaticDeletedCleanup()` ➜ `deletedCleanupInFlight` ជាប់ `true`
//     **អស់កល្ប** ➜ ⛔ ការសម្អាតធុងសំរាម ២ ថ្ងៃ / ៣០ ថ្ងៃ **ងាប់ពេញវគ្គ**
//     ➜ កូនសោ `zoew_barcode_registry` មិនដែលត្រូវដោះ ➜ **barcode ស្កេនចូល
//     មិនបានទៀត** (ថ្នាក់ដដែលនឹងមេរៀន «claim ងាប់» 2.18.0)
//   · `clearStaleRestoreMarkers()` ➜ `staleRestoreMarkerSweeps` ជាប់ id
//     **អស់កល្ប** ➜ `runAutomaticCleanupRules()` `return` លើកញ្ចប់នោះរាល់ជុំ
//     ➜ ⛔ **ច្បាប់ ២ ម៉ោង និង ៧ ថ្ងៃ លែងអនុវត្តលើកញ្ចប់នោះទាល់តែសោះ**
//   · ការសរសេរធុងសំរាមរបស់ «ដក» · «លុប» · «លុបជាអចិន្ត្រៃយ៍» ➜ **គ្មាន toast
//     សោះ** ➜ អ្នកប្រើឃើញកញ្ចប់បាត់ពីអេក្រង់ ហើយលុយថយ ដោយគ្មានការបញ្ជាក់
//
// ច្បាប់ដែលឯកសារនេះចាក់សោ៖
//   ១. សោ in-flight ត្រូវ **ដោះក្នុងពេលកំណត់** ទោះការសរសេរព្យួរ។
//   ២. ការព្យួរ **មិនត្រូវបោះបង់ការងារ** — ការសរសេរដែលចុះយឺតត្រូវបញ្ចប់
//      ការងារក្រោយ commit (លុបក្នុងសតិ + ដោះកូនសោ registry)។
//   ៣. អ្នកប្រើត្រូវ **ដឹងថាមានអ្វីកើតឡើង** ក្នុងពេលកំណត់។
//   ៤. ⛔ **ទិសផ្ទុយត្រូវរក្សា** ៖ បណ្តាញធម្មតា ➜ លទ្ធផលដដែលបេះបិទ ·
//      គ្មានសារវឌ្ឍនភាពឥតប្រយោជន៍ · លុយមិនត្រូវបញ្ច្រាស។
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let acorn;
try { acorn = require('acorn'); } catch (e) {
    console.log('SKIP — ត្រូវការ acorn (npm i acorn)');
    process.exit(0);
}

const ROOT = process.env.WRITESTALL_APP_DIR
    ? path.resolve(process.env.WRITESTALL_APP_DIR)
    : path.resolve(__dirname, '..');
const APP = path.join(ROOT, 'ZoeW', 'app.js');

let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { console.log('   ok    ' + label); pass++; }
    else { console.log('  FAIL   ' + label + (detail !== undefined ? '  got: ' + JSON.stringify(detail) : '')); fail++; }
}

function sliceBalanced(src, from) {
    let depth = 0;
    for (let i = from; i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') { depth--; if (!depth) return src.slice(from, i + 1); }
    }
    return null;
}
function extractFn(src, name) {
    const re = new RegExp('\\n(\\s*)(async\\s+)?function ' + name + '\\s*\\(');
    const m = re.exec(src);
    if (!m) return null;
    const head = src.indexOf('function ' + name, m.index);
    const brace = src.indexOf('{', src.indexOf('(', head));
    const body = sliceBalanced(src, brace);
    if (!body) return null;
    return (m[2] ? 'async ' : '') + src.slice(head, brace) + body;
}
function extractConst(src, name) {
    const re = new RegExp('\\n\\s*const ' + name + ' = ([^;]+);');
    const m = re.exec(src);
    return m ? 'const ' + name + ' = ' + m[1] + ';' : null;
}

const src = fs.existsSync(APP) ? fs.readFileSync(APP, 'utf8').replace(/\r\n?/g, '\n') : '';

// ── ១. ជាន់អប្បបរមា ៖ ការស្កេនទទេមិនត្រូវបៃតង ──────────────────────────────
console.log('== ១. ជាន់អប្បបរមា ==');
ok('អាន ZoeW/app.js បាន (>= ១០០ KB)', src.length > 100000, src.length);

const NEEDED = ['runAutomaticDeletedCleanup', 'purgeDeletedItemsQuietly', 'clearStaleRestoreMarkers',
    'releaseBarcodesInRegistry', 'releaseRegistryKeys', 'dbOp', 'withTimeout', 'dbOpStalled',
    'releaseStaleRestoreClaimForPurge', 'itemHasRestoreMarkers', 'collectItemBarcodes',
    'trashRetentionMs', 'isActiveRestoreClaim', 'dbListenerViewIsStale', 'notifyIfSlow', 'armLateWrite'];
const missing = NEEDED.filter((n) => !extractFn(src, n));
ok('រកឃើញ function ដែលត្រូវវាស់ ' + NEEDED.length, missing.length === 0, { missing: missing });

const NEEDED_CONSTS = ['DB_OP_TIMEOUT_MS', 'TRASH_RETENTION_MS', 'EXPIRED_TRASH_RETENTION_MS',
    'REGISTRY_RELEASE_RETRY_MAX', 'REGISTRY_RELEASE_QUEUE_MAX', 'TRASH_WRITE_SLOW_NOTICE_MS'];
const cmissing = NEEDED_CONSTS.filter((n) => !extractConst(src, n));
ok('រកឃើញថេរដែលត្រូវវាស់ ' + NEEDED_CONSTS.length, cmissing.length === 0, { missing: cmissing });

// ⛔ កុំបញ្ឈប់ checker ពេលរកឈ្មោះមិនឃើញ — ត្រូវ **stub** ជំនួស ដើម្បីឲ្យ
// ការអះអាងឥរិយាបថនៅតែរត់ (មេរៀន `checker-coverage.js` ផ្នែក ៣)។
const STUBS = {
    notifyIfSlow: 'function notifyIfSlow(p) { return p; }',
    armLateWrite: 'function armLateWrite() { return false; }'
};
const CONST_STUBS = { TRASH_WRITE_SLOW_NOTICE_MS: 'const TRASH_WRITE_SLOW_NOTICE_MS = 15000;' };

function fnSource(name) { return extractFn(src, name) || STUBS[name] || ('function ' + name + '() {}'); }
function constSource(name) { return extractConst(src, name) || CONST_STUBS[name] || ('const ' + name + ' = 0;'); }

// ── ២. Sandbox ដែលរត់កូដ ship ពិត ─────────────────────────────────────────
function buildWorld(mode) {
    const log = { toasts: [], updates: 0, gets: 0, txs: 0, registryUpdates: 0, dedUpdates: 0, captures: [] };
    const errorRecorder = { capture: (error, details) => log.captures.push({ message: String(error && error.message || error), details }) };
    const ctx = {
        console: { log: () => {}, error: () => {}, warn: () => {} },
        Promise, JSON, Object, Array, Number, String, Boolean, Math, Set, Map, Date,
        setTimeout, clearTimeout, isNaN, parseFloat, parseInt,
        navigator: { onLine: true },
        ZoeErrors: errorRecorder,
        window: { ZoeErrors: errorRecorder },
        __log: log
    };
    ctx.authGeneration = 0;
    vm.createContext(ctx);

    // `hang` ➜ promise ដែលមិនដោះ មិនបដិសេធ (RTDB ក្រៅបណ្តាញពិត)
    // `ok`   ➜ ការសរសេរជោគជ័យធម្មតា (ទិសផ្ទុយ)
    const preamble = `
let deletedCleanupInFlight = false;
let db = {}, fb = null;
let dbRefDeleted = { p: 'del' };
let deletedItems = [], scanHistory = [];
let dailyRevenueData = {};
function getFormattedDate() { return '2027-01-15'; }
let serverTimeOffsetMs = 0;
const activeRestoreClaims = new Map();
const pendingRegistryReleases = new Map();
let registryReleaseFlushInFlight = false;
const staleRestoreMarkerSweeps = new Set();
const dbListenerPendingPaths = new Set();
const dbListenerFailedPaths = new Set();
const dbListenerReportedFailures = new Set();
const RESTORE_CLAIM_LEASE_MS = 120000;
const DB_LISTENER_KEY_HISTORY = 'history';
const DB_LISTENER_KEY_DELETED = 'deleted';
function getServerNow() { return Date.now(); }
function elapsedSince(mark) { if (!mark) return Infinity; const d = Date.now() - mark; return d < 0 ? Infinity : d; }
function showToast(msg) { __log.toasts.push(String(msg)); }
function cleanupClockIsTrustworthy() { return true; }
function refreshCurrentHistoryView() {}
`;
    const code = preamble
        + NEEDED_CONSTS.map(constSource).join('\n') + '\n'
        + ['withTimeout', 'dbOp', 'dbOpStalled', 'armLateWrite', 'notifyIfSlow', 'retryAsync',
           'barcodeRegistryKey', 'collectItemBarcodes', 'queueRegistryReleaseRetry', 'releaseRegistryKeys',
           'releaseBarcodesInRegistry', 'trashRetentionMs', 'isActiveRestoreClaim',
           'releaseStaleRestoreClaimForPurge', 'itemHasRestoreMarkers', 'dbListenerViewIsStale',
           'purgeDeletedItemsQuietly', 'runAutomaticDeletedCleanup', 'clearStaleRestoreMarkers',
           'ledgerNumber', 'ledgerDedOf', 'cleanupEventAt', 'cleanupScanDateOf', 'cleanupLedgerKeyOf', 'releaseCleanupLedgerKeys']
            .map(fnSource).join('\n')
        + `
globalThis.__setFb = (impl) => { fb = impl; };
globalThis.__seed = (d) => { deletedItems = d; };
globalThis.__seedLedger = (d) => { dailyRevenueData = d; };
globalThis.__lockHeld = () => deletedCleanupInFlight;
globalThis.__sweeps = () => Array.from(staleRestoreMarkerSweeps);
globalThis.__trash = () => deletedItems.map((i) => i.id);
globalThis.__pendingReleases = () => Array.from(pendingRegistryReleases.keys());
globalThis.__runPurge = runAutomaticDeletedCleanup;
globalThis.__clearStale = clearStaleRestoreMarkers;
globalThis.__notifyIfSlow = notifyIfSlow;
`;
    vm.runInContext(code, ctx);
    // ⛔ `dbOp` ពិតហៅ `probeDatabaseLiveness()` ពេលព្យួរ (ការវាស់ភាពរស់ ៖ `emu/app-network-e2e-test`) ➜ stub «មិនវាស់»
    vm.runInContext('var probeDatabaseLiveness = function () { return Promise.resolve(null); };', ctx);

    const hang = () => new Promise(() => {});
    const later = [];
    const fbImpl = {
        ref: () => ({}),
        increment: (n) => n,
        update: (ref, updates) => {
            log.updates++;
            if (ref && ref.registry) log.registryUpdates++;
            const dedRelease = Object.keys(updates || {}).some((k) => k.indexOf('/ded/') !== -1);
            if (dedRelease) log.dedUpdates++;
            if (mode === 'hang') return new Promise((resolve) => { later.push(resolve); });
            if (mode === 'ded-hang' && dedRelease) return hang();
            return Promise.resolve();
        },
        runTransaction: (ref, updater) => {
            log.txs++;
            if (mode === 'hang' || mode === 'tx-hang') return hang();
            try { updater(null); } catch (e) {}
            return Promise.resolve({ committed: true, snapshot: { val: () => null } });
        },
        get: () => {
            log.gets++;
            if (mode === 'get-reject') return Promise.reject(new Error('SOURCE_READ_FAILED'));
            return mode === 'hang' ? hang() : Promise.resolve({ exists: () => false, val: () => null });
        }
    };
    ctx.__setFb(fbImpl);
    return { ctx, log, releaseLateWrites: () => { later.splice(0).forEach((r) => r()); } };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// ⛔ ការវាស់ត្រូវធៀបនឹង **ពិដានពិត** មិនមែនលេខថេរ (មេរៀន 2.20.3) ៖
// ១៥ វិ. គឺជា `DB_OP_TIMEOUT_MS` ➜ ការរង់ចាំត្រូវវែងជាងវាបន្តិច។
const DB_TIMEOUT = Number((extractConst(src, 'DB_OP_TIMEOUT_MS') || '= 15000').replace(/\D+/g, '')) || 15000;
const WAIT_AFTER_TIMEOUT = DB_TIMEOUT + 2500;

(async () => {
    // ── ២. ការសម្អាតធុងសំរាម ៖ សោត្រូវដោះទោះការសរសេរព្យួរ ─────────────────
    console.log('\n== ២. សោសម្អាតធុងសំរាម ក្រោមការសរសេរដែលព្យួរ ==');
    {
        const w = buildWorld('hang');
        const trash = [];
        for (let i = 0; i < 3; i++) {
            trash.push({ id: 'id_1_' + i, deletedAt: Date.now() - 40 * 24 * 3600 * 1000,
                trashReason: 'delete', barcodes: [{ code: 'BC' + i }] });
        }
        w.ctx.__seed(trash);
        w.ctx.__runPurge();
        await sleep(200);
        ok('ការសរសេរបានចេញដំណើរពិត (ជាន់អប្បបរមា)', w.log.updates >= 1, w.log.updates);
        ok('សោត្រូវកាន់ខណៈការសរសេរនៅព្យួរ', w.ctx.__lockHeld() === true);
        await sleep(WAIT_AFTER_TIMEOUT);
        ok('⛔ សោត្រូវដោះក្នុងពេលកំណត់ (មិនជាប់អស់កល្ប)', w.ctx.__lockHeld() === false);

        const before = w.log.updates;
        w.ctx.__runPurge();
        await sleep(200);
        ok('⛔ ជុំបន្ទាប់ត្រូវព្យាយាមម្តងទៀតបាន (ការសម្អាតមិនងាប់)', w.log.updates > before,
            { before: before, after: w.log.updates });

        // ការសរសេរដែលចុះយឺត ➜ ការងារក្រោយ commit ត្រូវរត់
        w.releaseLateWrites();
        await sleep(300);
        ok('⛔ ការសរសេរដែលចុះយឺត ➜ ធាតុត្រូវចេញពីធុងសំរាមក្នុងសតិ',
            w.ctx.__trash().length === 0, w.ctx.__trash());
    }

    // ── ២ខ. សោដក `ded` (2.50.49) ៖ purge ជោគជ័យ តែការដោះសោ `ded` ព្យួរ ➜ សោត្រូវដោះ ────────
    // ⛔ purge ធុងសំរាម `expired` លុបសោ `ded/<trashId>` ជាមួយ (`releaseCleanupLedgerKeys()`) ក្នុង `applyPurged()` ដែលត្រូវ await ក្រោមសោ ➜
    //    បណ្តាញស្លាប់ចន្លោះការសរសេរទាំង ២ (ឬ socket zombie) ➜ ការសរសេរនោះព្យួរ ➜ សោ `deletedCleanupInFlight` ជាប់ ➜ purge ងាប់។
    console.log('\n== ២ខ. សោដក `ded` ៖ ការដោះសោព្យួរ មិនត្រូវជាប់សោសម្អាតធុងសំរាម ==');
    {
        const w = buildWorld('ded-hang');
        const at = Date.now() - 3 * 24 * 3600 * 1000;
        w.ctx.__seedLedger({ '2027-01-10': { codDollar: 5, dodDollar: 0, totalCount: 1, ded: { id_3_a: { at, cod: 4.57, dod: 0, count: 1 } } } });
        w.ctx.__seed([{ id: 'id_3_a', scanDate: '2027-01-10', deletedAt: at, trashReason: 'expired', barcodes: [{ code: 'DK1', isDeducted: true }] }]);
        w.ctx.__runPurge();
        await sleep(400);
        const hasKeyRelease = /function releaseCleanupLedgerKeys\(/.test(src);
        ok('ជាន់អប្បបរមា ៖ ការដោះសោ `ded` ចេញដំណើរពិត (tree ដែលមានសោ)', !hasKeyRelease || w.log.dedUpdates >= 1, w.log.dedUpdates);
        ok('ធាតុ purge ចេញពីធុងសំរាមក្នុងសតិ', w.ctx.__trash().length === 0, w.ctx.__trash());
        await sleep(WAIT_AFTER_TIMEOUT);
        ok('⛔ ការដោះសោ `ded` ព្យួរ ➜ សោសម្អាតធុងសំរាមត្រូវដោះក្នុងពិដាន (មិនជាប់អស់កល្ប)', w.ctx.__lockHeld() === false);
    }

    // ── ៣. ទិសផ្ទុយ ៖ បណ្តាញធម្មតា ─────────────────────────────────────────
    console.log('\n== ៣. ទិសផ្ទុយ ៖ បណ្តាញធម្មតា ==');
    {
        const w = buildWorld('ok');
        w.ctx.__seed([
            { id: 'id_2_a', deletedAt: Date.now() - 40 * 24 * 3600 * 1000, trashReason: 'delete', barcodes: [{ code: 'AA1' }] },
            { id: 'id_2_b', deletedAt: Date.now() - 3 * 24 * 3600 * 1000, trashReason: 'expired', barcodes: [{ code: 'BB2' }] },
            { id: 'id_2_c', deletedAt: Date.now() - 1000, trashReason: 'delete', barcodes: [{ code: 'CC3' }] }
        ]);
        w.ctx.__runPurge();
        await sleep(400);
        ok('សោត្រូវដោះក្រោយចប់', w.ctx.__lockHeld() === false);
        ok('ធាតុហួសកំណត់ត្រូវចេញ · ធាតុថ្មីនៅដដែល',
            JSON.stringify(w.ctx.__trash()) === JSON.stringify(['id_2_c']), w.ctx.__trash());
        ok('⛔ គ្មានសារបរាជ័យលើបណ្តាញធម្មតា',
            w.log.toasts.filter((t) => /បរាជ័យ/.test(t)).length === 0, w.log.toasts);
    }

    // ── ៤. `clearStaleRestoreMarkers` ៖ ការសម្អាតកញ្ចប់មិនត្រូវងាប់ ────────
    console.log('\n== ៤. សោសម្អាត marker ស្តារ ==');
    await Promise.all(['hang', 'tx-hang'].map(async (mode) => {
        const w = buildWorld(mode);
        const label = mode === 'hang' ? 'source GET ព្យួរ' : 'source GET ជោគជ័យ តែ transaction ព្យួរ';
        w.ctx.__clearStale({ id: 'id_9_9', restoreClaimId: 'src1', restoreClaimToken: 't' });
        await sleep(200);
        ok(label + ' ➜ អាន source ពិតមុនសរសេរ', w.log.gets === 1, w.log.gets);
        ok(label + ' ➜ ចាប់ transaction តែបន្ទាប់ពី source GET ជោគជ័យ',
            w.log.txs === (mode === 'hang' ? 0 : 1), w.log.txs);
        ok(label + ' ➜ id ត្រូវកាន់ខណៈកំពុងដំណើរការ',
            w.ctx.__sweeps().indexOf('id_9_9') !== -1, w.ctx.__sweeps());
        await sleep(WAIT_AFTER_TIMEOUT);
        ok(label + ' ➜ id ត្រូវដោះក្នុងពេលកំណត់ (ច្បាប់ ២ម៉ោង/៧ថ្ងៃ មិនងាប់លើកញ្ចប់នោះ)',
            w.ctx.__sweeps().length === 0, w.ctx.__sweeps());
        ok(label + ' ➜ ការព្យួរមិនត្រូវបំពេញ Sentry',
            w.log.captures.length === 0, w.log.captures);
        const beforeGets = w.log.gets;
        const beforeTxs = w.log.txs;
        w.ctx.__clearStale({ id: 'id_9_9', restoreClaimId: 'src1', restoreClaimToken: 't' });
        await sleep(200);
        ok(label + ' ➜ ក្រោយ timeout អាចចាប់សម្អាតម្តងទៀត',
            w.log.gets === beforeGets + 1 && w.log.txs === beforeTxs + (mode === 'hang' ? 0 : 1),
            { gets: w.log.gets, txs: w.log.txs });
    }));
    {
        const w = buildWorld('ok');
        w.ctx.__clearStale({ id: 'id_8_8', restoreClaimId: 'src2', restoreClaimToken: 't' });
        await sleep(300);
        ok('ទិសផ្ទុយ ៖ បណ្តាញធម្មតា ➜ id ត្រូវដោះដដែល',
            w.ctx.__sweeps().length === 0, w.ctx.__sweeps());
    }
    {
        const w = buildWorld('get-reject');
        w.ctx.__clearStale({ id: 'id_7_7', restoreClaimId: 'src3', restoreClaimToken: 't' });
        await sleep(300);
        ok('source GET បដិសេធ ➜ មិនចាប់ history transaction', w.log.gets === 1 && w.log.txs === 0, { gets: w.log.gets, txs: w.log.txs });
        ok('source GET បដិសេធ ➜ សោ sweep ត្រូវដោះ', w.ctx.__sweeps().length === 0, w.ctx.__sweeps());
        ok('ទិសផ្ទុយ Sentry៖ កំហុសមិនមែន timeout ត្រូវ capture ពិត',
            w.ctx.ZoeErrors === w.ctx.window.ZoeErrors && w.log.captures.length === 1 &&
            w.log.captures[0].message === 'SOURCE_READ_FAILED' && w.log.captures[0].details.context === 'clearStaleRestoreMarkers',
            w.log.captures);
    }

    // ── ៥. សារវឌ្ឍនភាព ៖ អ្នកប្រើត្រូវដឹងថាមានអ្វីកើតឡើង ──────────────────
    console.log('\n== ៥. សារវឌ្ឍនភាពនៃការសរសេរធុងសំរាម ==');
    {
        const w = buildWorld('ok');
        const notify = w.ctx.__notifyIfSlow;
        ok('`notifyIfSlow` មានពិតក្នុងកូដ ship', !!extractFn(src, 'notifyIfSlow'));

        let resolveSlow;
        const slow = new Promise((r) => { resolveSlow = r; });
        const returned = notify(slow, 120, '⏳ សាកល្បង');
        ok('⛔ `notifyIfSlow` ត្រឡប់ promise ដដែល (មិនលេបការបដិសេធ)', returned === slow);
        await sleep(300);
        ok('ការសរសេរដែលយឺត ➜ អ្នកប្រើឃើញសារវឌ្ឍនភាព',
            w.log.toasts.filter((t) => /⏳/.test(t)).length === 1, w.log.toasts);
        resolveSlow();
        await sleep(100);

        w.log.toasts.length = 0;
        await notify(Promise.resolve(), 120, '⏳ សាកល្បង');
        await sleep(300);
        ok('⛔ ទិសផ្ទុយ ៖ ការសរសេរលឿន ➜ គ្មានសារវឌ្ឍនភាព',
            w.log.toasts.length === 0, w.log.toasts);

        w.log.toasts.length = 0;
        const rejected = notify(Promise.reject(new Error('x')), 120, '⏳ សាកល្បង');
        await rejected.catch(() => {});
        await sleep(300);
        ok('⛔ ការបដិសេធលឿន ➜ គ្មានសារវឌ្ឍនភាព (timer ត្រូវលុប)',
            w.log.toasts.length === 0, w.log.toasts);
    }

    // ── ៦. ស្តាទិច ៖ ផ្លូវសរសេរធុងសំរាមទាំងអស់ត្រូវឆ្លងកាត់ `notifyIfSlow` ──
    console.log('\n== ៦. ការចងភ្ជាប់ស្តាទិច ==');
    {
        let ast = null;
        try { ast = acorn.parse(src, { ecmaVersion: 2022 }); } catch (e) {}
        ok('parse `app.js` បាន (parse error = ការធ្លាក់)', !!ast);
        if (ast) {
            // រាល់ `await` លើការសរសេរធុងសំរាម ត្រូវរុំដោយ `notifyIfSlow(`
            const WRITE_HELPERS = ['saveSingleDeletedItemToFirebase', 'deleteSingleDeletedItemFromFirebase'];
            const awaited = [];
            (function walk(node, stack) {
                if (!node || typeof node.type !== 'string') return;
                if (node.type === 'AwaitExpression') {
                    const inner = src.slice(node.start, node.end);
                    WRITE_HELPERS.forEach((h) => {
                        if (inner.indexOf(h + '(') !== -1) {
                            awaited.push({ helper: h, wrapped: /notifyIfSlow\s*\(/.test(inner) });
                        }
                    });
                }
                for (const k in node) {
                    if (k === 'type' || k === 'start' || k === 'end') continue;
                    const v = node[k];
                    if (Array.isArray(v)) v.forEach((c) => walk(c, stack));
                    else if (v && typeof v === 'object') walk(v, stack);
                }
            })(ast, []);
            ok('ជាន់អប្បបរមា ៖ រកឃើញ await លើការសរសេរធុងសំរាម >= ៣', awaited.length >= 3, awaited.length);
            const bare = awaited.filter((a) => !a.wrapped);
            ok('⛔ រាល់ការរង់ចាំការសរសេរធុងសំរាម ត្រូវមានសារវឌ្ឍនភាព',
                bare.length === 0, bare);

            // `purgeDeletedItemsQuietly` ត្រូវឆ្លងកាត់ពិដាន **ហើយ promise ដើម
            // ត្រូវរក្សាទុក** ដើម្បីឲ្យការសរសេរដែលចុះយឺតបញ្ចប់ការងារក្រោយ commit។
            const purgeBody = extractFn(src, 'runAutomaticDeletedCleanup') || '';
            const purgeCalls = (purgeBody.match(/purgeDeletedItemsQuietly\s*\(/g) || []).length;
            ok('ជាន់អប្បបរមា ៖ រកឃើញការហៅ purge >= ២ ក្នុង runAutomaticDeletedCleanup',
                purgeCalls >= 2, purgeCalls);
            ok('⛔ គ្មាន `await purgeDeletedItemsQuietly(` ទទេ (ការព្យួរចាក់សោការសម្អាត)',
                !/await\s+purgeDeletedItemsQuietly\s*\(/.test(purgeBody));
            const purgeHandles = (purgeBody.match(/const\s+(\w+)\s*=\s*purgeDeletedItemsQuietly\s*\(/g) || [])
                .map((m) => /const\s+(\w+)/.exec(m)[1]);
            ok('ការហៅ purge ទាំងអស់ត្រូវរក្សា promise ដើមទុក',
                purgeHandles.length === purgeCalls, { handles: purgeHandles, calls: purgeCalls });
            const guardedHandles = purgeHandles.filter((h) => new RegExp('dbOp\\(\\s*' + h + '\\s*\\)').test(purgeBody));
            ok('⛔ រាល់ promise នៃការ purge ត្រូវឆ្លងកាត់ `dbOp()`',
                guardedHandles.length === purgeHandles.length && purgeHandles.length > 0,
                { guarded: guardedHandles, all: purgeHandles });
            const lateHandles = purgeHandles.filter((h) => new RegExp('armLateWrite\\(\\s*' + h + '\\s*,').test(purgeBody));
            ok('⛔ រាល់ promise នៃការ purge ត្រូវមានផ្លូវបញ្ចប់យឺត (`armLateWrite`)',
                lateHandles.length === purgeHandles.length && purgeHandles.length > 0,
                { late: lateHandles, all: purgeHandles });
        }
    }

    console.log('\n' + pass + ' ok, ' + fail + ' FAIL');
    process.exit(fail ? 1 : 0);
})();
