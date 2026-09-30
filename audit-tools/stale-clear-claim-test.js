// ⛔ ថ្នាក់កំហុស៖ **`clearClaim` ដែល «ងាប់» (lease ផុត) ជាអន្ទាក់ស្ថាពរ ➜
// ច្បាប់ ២ ម៉ោង និង ៧ ថ្ងៃ ងាប់លើកញ្ចប់នោះ ➜ លុយមិនត្រូវដក។**
//
// នេះជា **ថ្នាក់ដដែលនឹង «កូនសោ `zoew_barcode_registry` កំព្រា»** តាមទ្វារផ្សេង ៖
// marker ដែល **គ្មានម្ចាស់** នៅជាប់លើ server ហើយគ្មានអ្នកដោះ។
//
// លំដាប់ដែលបង្កើតវា ៖ អ្នកប្រើចុច «លុបទាំងអស់» ➜ `claimHistoryItemForClear()`
// ដាក់ `clearClaim` លើ server ➜ `finalizeClaimedHistoryClear()` **ធ្លាក់**
// (បណ្តាញដាច់ · rules បដិសេធ · អ្នកប្រើបិទ App) ➜ `activeClearHistoryClaims`
// (Map ក្នុងសតិ) បាត់ពេល reload ➜ **claim នៅលើ server ជារៀងរហូត**។
//
// `clearClaim` ត្រូវលុបតែ ២ កន្លែង ៖ `stripHistoryOnlyMarkers()` (ពេលធាតុចូល
// ធុងសំរាមពិត) និង `claimHistoryItemForClear()` (សរសេរជាន់ដោយ claim ថ្មី)។
// ⛔ **គ្មានផ្លូវណាមួយរត់ដោយស្វ័យប្រវត្តិទេ** ➜ អ្នកប្រើដោះវាបានតែដោយចុច
// «លុបទាំងអស់» ម្តងទៀត — ដែល **លុបកញ្ចប់នោះ** (មិនមែនអ្វីដែលគេចង់)។
//
// **វាស់បានលើ tree មុនកែ (កូដ ship ក្នុង `vm`)** ៖ `runAutomaticCleanupRules()`
// abort លើ `if (item.clearClaim) return;` — **វត្តមាន** មិនមែនភាពរស់ ➜
//   · claim ងាប់ ១០ នាទី  ➜ ការសម្អាតបាញ់ **០** (មូលដ្ឋាន ២)
//   · claim ងាប់ ៣០ ថ្ងៃ  ➜ ការសម្អាតបាញ់ **០**
//   · កញ្ចប់ផុតកំណត់ ៧ ថ្ងៃ **$12.50 មិនដែលត្រូវដក**
// ខណៈ `isActiveClearHistoryClaim()` ត្រឡប់ `false` រួចហើយ — helper វិនិច្ឆ័យ
// **មានស្រាប់** តែគ្មាននរណាអានវានៅផ្លូវនោះ។
//
// ច្បាប់ដែលឯកសារនេះចាក់សោ៖
//   ១. claim ដែល **ងាប់** ត្រូវត្រូវបានដោះដោយស្វ័យប្រវត្តិ ➜ ការសម្អាតបន្ត។
//   ២. ⛔ claim ដែល **នៅរស់** មិនត្រូវប៉ះ (ឧបករណ៍ផ្សេងកំពុងលុប)។
//   ３. ⛔ claim **របស់ឧបករណ៍នេះ** (`activeClearHistoryClaims`) មិនត្រូវប៉ះ។
//   ４. ⛔ ការសម្រេចត្រូវផ្អែកលើ **ទិដ្ឋភាព server** ក្នុង transaction —
//      ទិដ្ឋភាពសតិចាស់មិនត្រូវធ្វើឲ្យ claim រស់ត្រូវលុប។
//   ５. សោ sweep ត្រូវដោះ (ការព្យួរមិនត្រូវធ្វើឲ្យវាងាប់ជារៀងរហូត)។
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = process.env.STALECLAIM_APP_DIR
    ? path.resolve(process.env.STALECLAIM_APP_DIR)
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
    const m = new RegExp('\\n\\s*const ' + name + ' = ([^;]+);').exec(src);
    return m ? 'const ' + name + ' = ' + m[1] + ';' : null;
}

const src = fs.existsSync(APP) ? fs.readFileSync(APP, 'utf8').replace(/\r\n?/g, '\n') : '';

// ── ១. ជាន់អប្បបរមា ─────────────────────────────────────────────────────────
console.log('== ១. ជាន់អប្បបរមា ==');
ok('អាន ZoeW/app.js បាន (>= ១០០ KB)', src.length > 100000, src.length);
const NEEDED = ['runAutomaticCleanupRules', 'isActiveClearHistoryClaim', 'releaseStaleClearHistoryClaim',
    'cleanupClockIsTrustworthy', 'itemHasRestoreMarkers', 'withTimeout', 'dbOp', 'dbOpStalled'];
const missing = NEEDED.filter((n) => !extractFn(src, n));
ok('រកឃើញ function ដែលត្រូវវាស់ ' + NEEDED.length, missing.length === 0, { missing: missing });
const NEEDED_CONSTS = ['TWO_HOURS_MS', 'ABANDON_AGE_MS', 'CLEAR_HISTORY_CLAIM_LEASE_MS', 'DB_OP_TIMEOUT_MS'];
const cmissing = NEEDED_CONSTS.filter((n) => !extractConst(src, n));
ok('រកឃើញថេរដែលត្រូវវាស់ ' + NEEDED_CONSTS.length, cmissing.length === 0, { missing: cmissing });

// ⛔ កុំបញ្ឈប់ checker ពេលរកឈ្មោះមិនឃើញ — stub ជំនួស ដើម្បីឲ្យការអះអាង
// ឥរិយាបថនៅតែរត់ (មេរៀន `checker-coverage.js` ផ្នែក ៣)។
function fnSource(name) { return extractFn(src, name) || ('function ' + name + '() {}'); }
function constSource(name) { return extractConst(src, name) || ('const ' + name + ' = 0;'); }

const LEASE = Number((extractConst(src, 'CLEAR_HISTORY_CLAIM_LEASE_MS') || '= 120000')
    .replace(/[^0-9*]/g, '').split('*').reduce((a, p) => a * (Number(p) || 1), 1)) || 120000;

const NOW = 1750000000000;

// ── ２. Sandbox ដែលរត់កូដ ship ពិត ─────────────────────────────────────────
function buildWorld(mode) {
    const log = { cleanups: [], txs: 0, captures: [] };
    const recorder = { capture: (e, d) => log.captures.push({ message: String(e && e.message || e), details: d }) };
    const store = {};
    const ctx = {
        console: { log: () => {}, error: () => {}, warn: () => {} },
        Promise, JSON, Object, Array, Number, String, Boolean, Math, Set, Map, Date,
        setTimeout, clearTimeout, isNaN, parseFloat, parseInt, isFinite,
        window: { ZoeErrors: recorder }, ZoeErrors: recorder,
        __log: log
    };
    vm.createContext(ctx);
    const preamble = `
let db = {}, fb = null;
let scanHistory = [], deletedItems = [];
let serverClockTrusted = true, isDatabaseConnected = true;
const cleanupInFlight = new Set(), staleRestoreMarkerSweeps = new Set();
const staleClearClaimSweeps = new Set();
const activeRestoreClaims = new Map();
const activeClearHistoryClaims = new Map();
const dbListenerPendingPaths = new Set(), dbListenerFailedPaths = new Set(), dbListenerReportedFailures = new Set();
const DB_LISTENER_KEY_DELETED = 'deleted';
function getServerNow() { return ${NOW}; }
function elapsedSince(m) { if (!m) return Infinity; const d = getServerNow() - m; return d < 0 ? Infinity : d; }
function claimAndCleanupItem(id, reason) { __log.cleanups.push(id + ':' + reason); }
function clearStaleRestoreMarkers() {}
function dbListenerViewIsStale() { return false; }
function showToast() {}
function parseTimestampFromId() { return 0; }
function barcodeAbandonIsRipe(b, p, n) { return !b.isClosed && (n - p) > ABANDON_AGE_MS; }
function barcodeCloseIsRipe(b, n) { return !!(b && b.isClosed && typeof b.closedAt === 'number' && (n - b.closedAt) > TWO_HOURS_MS); }
`;
    const FNS = ['withTimeout', 'dbOp', 'dbOpStalled', 'isActiveClearHistoryClaim',
        'cleanupClockIsTrustworthy', 'itemHasRestoreMarkers',
        'releaseStaleClearHistoryClaim', 'runAutomaticCleanupRules'];
    // ⛔ `dbOp` ពិតហៅ `probeDatabaseLiveness()` ពេលព្យួរ (ការវាស់ភាពរស់ ៖ `emu/app-network-e2e-test`) ➜ stub «មិនវាស់»
    vm.runInContext('var probeDatabaseLiveness = function () { return Promise.resolve(null); };', ctx);
    vm.runInContext(preamble + NEEDED_CONSTS.map(constSource).join('\n') + '\n'
        + FNS.map(fnSource).join('\n') + `
globalThis.__setFb = (i) => { fb = i; };
globalThis.__seed = (h) => { scanHistory = h; };
globalThis.__run = runAutomaticCleanupRules;
globalThis.__ownClaim = (id, tok) => { activeClearHistoryClaims.set(id, tok); };
`, ctx);

    const later = [];
    ctx.__setFb({
        ref: (_d, p) => ({ path: p || '' }),
        runTransaction: (ref, updater) => {
            log.txs++;
            if (mode === 'hang') return new Promise((resolve) => later.push(() => {
                const cur = store[ref.path] ? JSON.parse(JSON.stringify(store[ref.path])) : null;
                let out; try { out = updater(cur); } catch (e) { out = undefined; }
                if (out !== undefined) store[ref.path] = out;
                resolve({ committed: out !== undefined, snapshot: { val: () => out } });
            }));
            const cur = store[ref.path] ? JSON.parse(JSON.stringify(store[ref.path])) : null;
            let out;
            try { out = updater(cur); } catch (e) { return Promise.reject(e); }
            if (out === undefined) return Promise.resolve({ committed: false, snapshot: { val: () => store[ref.path] } });
            store[ref.path] = out;
            return Promise.resolve({ committed: true, snapshot: { val: () => out } });
        }
    });
    return { ctx, log, store, release: () => later.splice(0).forEach((f) => f()) };
}

// កញ្ចប់ផុតកំណត់ ៧ ថ្ងៃ (លុយត្រូវដក) + កញ្ចប់បិទហួស ២ ម៉ោង
function seedPair(w, claim) {
    const expired = { id: 'itm_expired', scanDate: '2026-09-01', isClosed: false,
        createdAt: NOW - 9 * 24 * 3600 * 1000,
        barcodes: [{ code: 'BC1', cod: 12.5, dod: 0, isClosed: false }] };
    const closed = { id: 'itm_closed', scanDate: '2026-09-01', isClosed: true, closedAt: NOW - 3 * 3600 * 1000,
        barcodes: [{ code: 'BC2', cod: 4, dod: 0, isClosed: true, closedAt: NOW - 3 * 3600 * 1000 }] };
    if (claim) { expired.clearClaim = claim; closed.clearClaim = claim; }
    w.store['zoew_scan_history_cod_dod/itm_expired'] = JSON.parse(JSON.stringify(expired));
    w.store['zoew_scan_history_cod_dod/itm_closed'] = JSON.parse(JSON.stringify(closed));
    w.ctx.__seed([expired, closed]);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
    // ── ２. មូលដ្ឋាន ៖ គ្មាន claim ➜ ការសម្អាតបាញ់ ─────────────────────────
    console.log('\n== ២. មូលដ្ឋាន (ជាន់អប្បបរមា) ==');
    {
        const w = buildWorld('ok');
        seedPair(w, null);
        w.ctx.__run();
        await sleep(20);
        ok('ជាន់អប្បបរមា ៖ គ្មាន claim ➜ ការសម្អាតបាញ់ទាំង ២ ច្បាប់',
            w.log.cleanups.length === 2, w.log.cleanups);
    }

    // ── ３. ស្នូល ៖ claim ងាប់ ត្រូវដោះ ហើយការសម្អាតបន្ត ────────────────────
    console.log('\n== ៣. ស្នូល ៖ claim ងាប់ (lease ផុត) ==');
    for (const [label, ageMs] of [['ងាប់ ១០ នាទី', 10 * 60 * 1000], ['ងាប់ ៣០ ថ្ងៃ', 30 * 24 * 3600 * 1000]]) {
        const w = buildWorld('ok');
        seedPair(w, { token: 'dead', claimedAt: NOW - ageMs });
        w.ctx.__run();
        await sleep(30);
        ok(label + ' ➜ ⛔ claim ត្រូវដោះចេញពី server',
            !w.store['zoew_scan_history_cod_dod/itm_expired'].clearClaim,
            w.store['zoew_scan_history_cod_dod/itm_expired'].clearClaim);
        // ជុំបន្ទាប់ (វដ្ត ៦០ វិ.) ➜ ការសម្អាតត្រូវបន្ត ➜ លុយត្រូវដក
        w.ctx.__seed([
            Object.assign({}, JSON.parse(JSON.stringify(w.store['zoew_scan_history_cod_dod/itm_expired']))),
            Object.assign({}, JSON.parse(JSON.stringify(w.store['zoew_scan_history_cod_dod/itm_closed'])))
        ]);
        w.log.cleanups.length = 0;
        w.ctx.__run();
        await sleep(20);
        ok(label + ' ➜ ⛔ ជុំបន្ទាប់ ៖ ច្បាប់ ២ម៉ោង/៧ថ្ងៃ ដំណើរការវិញ (លុយត្រូវដក)',
            w.log.cleanups.length === 2, w.log.cleanups);
    }

    // ── ４. ⛔ claim ដែលនៅរស់ មិនត្រូវប៉ះ ────────────────────────────────────
    console.log('\n== ៤. ទិសផ្ទុយ ៖ claim ដែលនៅរស់ ==');
    {
        const w = buildWorld('ok');
        seedPair(w, { token: 'live', claimedAt: NOW - Math.round(LEASE / 4) });
        w.ctx.__run();
        await sleep(30);
        ok('⛔ claim រស់ ➜ **មិនត្រូវដោះ** (ឧបករណ៍ផ្សេងកំពុងលុប)',
            !!w.store['zoew_scan_history_cod_dod/itm_expired'].clearClaim);
        ok('⛔ claim រស់ ➜ ការសម្អាតត្រូវនៅទប់ដដែល', w.log.cleanups.length === 0, w.log.cleanups);
    }

    // ── ５. ⛔ claim របស់ឧបករណ៍នេះ មិនត្រូវប៉ះ ──────────────────────────────
    console.log('\n== ៥. ទិសផ្ទុយ ៖ claim របស់ឧបករណ៍នេះ ==');
    {
        const w = buildWorld('ok');
        seedPair(w, { token: 'mine', claimedAt: NOW - 10 * 60 * 1000 });
        // «លុបទាំងអស់» របស់ឧបករណ៍នេះកំពុងព្យាយាមឡើងវិញ ➜ token នៅក្នុងសតិ
        w.ctx.__ownClaim('itm_expired', 'mine');
        w.ctx.__ownClaim('itm_closed', 'mine');
        w.ctx.__run();
        await sleep(30);
        ok('⛔ claim របស់ឧបករណ៍នេះ ➜ **មិនត្រូវដោះ** (ការលុបកំពុងព្យាយាមឡើងវិញ)',
            !!w.store['zoew_scan_history_cod_dod/itm_expired'].clearClaim);
    }

    // ── ６. ⛔ ការសម្រេចត្រូវផ្អែកលើទិដ្ឋភាព server ─────────────────────────
    console.log('\n== ៦. ទិដ្ឋភាពសតិចាស់ មិនត្រូវលុប claim រស់ ==');
    {
        const w = buildWorld('ok');
        seedPair(w, { token: 'dead', claimedAt: NOW - 10 * 60 * 1000 });
        // server ទទួល claim **ថ្មី** មុន transaction រត់ (ឧបករណ៍ផ្សេងទើប claim)
        w.store['zoew_scan_history_cod_dod/itm_expired'].clearClaim = { token: 'fresh', claimedAt: NOW - 1000 };
        w.ctx.__run();
        await sleep(30);
        ok('⛔ transaction ត្រូវអាន server ឡើងវិញ ➜ claim រស់ត្រូវរក្សា',
            !!w.store['zoew_scan_history_cod_dod/itm_expired'].clearClaim
            && w.store['zoew_scan_history_cod_dod/itm_expired'].clearClaim.token === 'fresh',
            w.store['zoew_scan_history_cod_dod/itm_expired'].clearClaim);
    }

    // ── ７. សោ sweep ត្រូវដោះ ក្រោមការសរសេរដែលព្យួរ ─────────────────────────
    console.log('\n== ៧. សោ sweep ក្រោមការសរសេរដែលព្យួរ ==');
    {
        const w = buildWorld('hang');
        seedPair(w, { token: 'dead', claimedAt: NOW - 10 * 60 * 1000 });
        w.ctx.__run();
        await sleep(20);
        const first = w.log.txs;
        ok('ជាន់អប្បបរមា ៖ transaction បានចេញដំណើរពិត', first >= 1, first);
        // ការសរសេរនៅព្យួរ ➜ ជុំបន្ទាប់មិនត្រូវបាញ់ transaction ស្ទួន
        w.ctx.__run();
        await sleep(20);
        ok('⛔ សោ sweep ទប់ការស្ទួនខណៈការសរសេរនៅព្យួរ', w.log.txs === first, { first: first, after: w.log.txs });
        // ក្រោយពិដាន ➜ សោត្រូវដោះ ➜ ជុំបន្ទាប់ព្យាយាមម្តងទៀតបាន
        const DB_TIMEOUT = Number((extractConst(src, 'DB_OP_TIMEOUT_MS') || '= 15000').replace(/\D+/g, '')) || 15000;
        await sleep(DB_TIMEOUT + 2000);
        w.ctx.__run();
        await sleep(20);
        ok('⛔ ក្រោយពិដាន ➜ សោ sweep ត្រូវដោះ ➜ ព្យាយាមម្តងទៀតបាន',
            w.log.txs > first, { first: first, after: w.log.txs });
        ok('⛔ ការព្យួរមិនត្រូវបំពេញ Sentry',
            w.log.captures.filter((c) => !/stall/i.test(c.message)).length === 0, w.log.captures);
        w.release();
    }

    console.log('\n' + pass + ' ok, ' + fail + ' FAIL');
    process.exit(fail ? 1 : 0);
})();
