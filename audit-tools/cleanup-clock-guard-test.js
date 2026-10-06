// ⛔ ថ្នាក់កំហុស៖ **ការសម្អាតស្វ័យប្រវត្តិដែលបំផ្លាញទិន្នន័យ រត់ដោយនាឡិកា
// ឧបករណ៍ដែលមិនដែលត្រូវបានផ្ទៀងផ្ទាត់ជាមួយ server។**
//
// 🔴 រកឃើញដោយសំណួររបស់អ្នកប្រើ (2026-08-27)៖ *«ប្តូរកាលបរិច្ឆេទហើយចុះ auto
// cleanup និងធុងសំរាម ខ្លាចបាត់ទិន្នន័យអស់»*។ គាត់ត្រូវ។
//
// `getServerNow()` គឺ `Date.now() + serverTimeOffsetMs` ហើយ `serverTimeOffsetMs`
// ត្រូវសរសេរ **តែពី `.info/serverTimeOffset`**។ ក្រៅបណ្តាញ ➜ វា `0` ➜
// `getServerNow()` គឺជា **នាឡិកាឧបករណ៍ឆៅ**។ ប៉ុន្តែច្រកទ្វារនៃការសម្អាត
// (`runScheduledCleanup()`) ពិនិត្យតែ `db` · `isDatabaseInitialized` ·
// `dbListenersFailed` — **គ្មានការពិនិត្យការតភ្ជាប់ ឬនាឡិកាសោះ**។
//
// ដូច្នេះទូរស័ព្ទដែលថ្ងៃលោតទៅមុខ (អស់ថ្ម ➜ boot ថ្ងៃខុស ឬអ្នកប្រើកែដោយដៃ)
// ខណៈក្រៅបណ្តាញ៖
//   • ច្បាប់ ៨ ថ្ងៃ  ➜ កញ្ចប់ **ដែលមិនទាន់យកទាំងអស់** មើលទៅដូចចាស់ ១ ឆ្នាំ
//     ➜ ចូលធុងសំរាមជា `expired` ➜ ⛔ **`isDeducted: true` ➜ ដកលុយចេញ**
//   • ច្បាប់ ២ ម៉ោង ➜ barcode ដែលបិទ «យក» ទាំងអស់ ➜ ចូលធុងសំរាម
//   • ច្បាប់ ៣០ ថ្ងៃ ➜ ធាតុធុងសំរាម **ទាំងអស់** ➜ **លុបជាអចិន្ត្រៃយ៍**
//
// ⛔ ការក្រៅបណ្តាញធ្វើឲ្យវា **អាក្រក់ជាង** មិនមែនសុវត្ថិភាពទេ — ការសរសេរ
// ចូលជួរក្នុងឧបករណ៍ រួចហូរទៅ server ពេលភ្ជាប់មកវិញ។ ជាពិសេស
// `purgeDeletedItemsQuietly()` ជា **`fb.update()` ធម្មតាដែលដាក់ `null`** —
// គ្មាន transaction គ្មានការផ្ទៀងផ្ទាត់នាឡិកាឡើងវិញសោះ ➜ លុបដោយឥតលក្ខខណ្ឌ។
//
// ⚠️ `CLAUDE.md` ធ្លាប់ចែងថា «បង្អួច 2h/8d/10d មិនរងផលទេ (គណនាតាម epoch)» —
// នោះពិតសម្រាប់ការប្តូរ **តំបន់ម៉ោង** (epoch មិនរំកិល) តែ **មិនពិតទេ**
// សម្រាប់នាឡិកាដែលខុសពិត។ ការប្តូរ *ថ្ងៃ* រំកិល `Date.now()` ដោយផ្ទាល់។
//
// ច្បាប់ (ដូចអ័ក្សនាឡិការបស់ License ក្នុង 2.20.1/2.20.4)៖
// **ការបំផ្លាញដែលមិនអាចត្រឡប់វិញបាន ត្រូវទាមទារនាឡិកាដែលមកពី server ពិត។**
//
// ⚠️ ឯកសារនេះរត់ **កូដពិត** ៖ `attachInfoListeners()` · `getServerNow()` ·
// `serverClockOffsetIsFromServer()` · `runAutomaticCleanupRules()` និង
// `runAutomaticDeletedCleanup()` ដកចេញពី `app.js` ពិត។ helper ដែល **បំផ្លាញ**
// (`claimAndCleanupItem` · `purgeDeletedItemsQuietly`) ត្រូវជា **អ្នកកត់ត្រា**
// ដើម្បីវាស់ថា *តើការសម្រេចបំផ្លាញត្រូវបានធ្វើឬអត់* — មិនមែនដើម្បីធ្វើវាទេ។
// ខ្លឹមសារខាងក្នុងនៃការសម្អាតត្រូវបានចាក់សោរួចដោយ
// `partial-pickup-cleanup-test.js` (៤៨ assertion) ដាច់ដោយឡែក។
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const unexpectedErrors = [];
const auditConsole = { ...console, error: (...args) => unexpectedErrors.push(args.map(String).join(' ')) };

const ROOT = process.env.CLEANUPCLOCK_APP_DIR
    ? path.resolve(process.env.CLEANUPCLOCK_APP_DIR)
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

// ── ជាន់អប្បបរមា ៖ ការស្កេនទទេមិនត្រូវបៃតង ─────────────────────────────
const NEEDED_FNS = ['getServerNow', 'serverClockOffsetIsFromServer', 'attachInfoListeners',
                    'runAutomaticCleanupRules', 'trashRetentionMs', 'runAutomaticDeletedCleanup', 'runScheduledCleanup'];
const foundFns = NEEDED_FNS.filter((n) => !!extractFn(src, n));
ok('ជាន់អប្បបរមា ៖ រកឃើញ function ដែលត្រូវវាស់ ' + NEEDED_FNS.length,
    foundFns.length === NEEDED_FNS.length, { missing: NEEDED_FNS.filter((n) => foundFns.indexOf(n) === -1) });

const NEEDED_CONSTS = ['TWO_HOURS_MS', 'ABANDON_AGE_MS', 'EXPIRED_TRASH_RETENTION_MS', 'TRASH_RETENTION_MS'];
const foundConsts = NEEDED_CONSTS.filter((n) => !!extractConst(src, n));
ok('ជាន់អប្បបរមា ៖ រកឃើញថេររយៈពេល ' + NEEDED_CONSTS.length,
    foundConsts.length === NEEDED_CONSTS.length, { missing: NEEDED_CONSTS.filter((n) => foundConsts.indexOf(n) === -1) });

if (foundFns.length !== NEEDED_FNS.length || foundConsts.length !== NEEDED_CONSTS.length) {
    console.log('\n' + pass + ' ok, ' + fail + ' FAIL');
    process.exit(fail ? 1 : 0);
}

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const REAL_NOW = 1780000000000;

// ⛔ ការសម្អាតត្រូវ **អាចរត់បាន** លុះត្រាតែច្រកទ្វារបើក។ បើ tree មិនទាន់មាន
// ច្រកទ្វារ នោះ stub `() => true` ធ្វើឲ្យការអះអាង «មិនត្រូវសម្អាត» ធ្លាក់
// ដោយ **ហេតុផលរបស់វាផ្ទាល់** មិនមែនដោយ ReferenceError ដែលបិទបាំងអ្វីៗទាំងអស់
// (មេរៀន `CLAUDE.md` ចំណុច ៣ នៃ checker-coverage)។
const CLOCK_GATE = extractFn(src, 'cleanupClockIsTrustworthy')
    || 'function cleanupClockIsTrustworthy() { return true; }';

function buildWorld(opts) {
    let deviceNow = opts.deviceNow;
    const RealDate = Date;
    function FakeDate(...args) {
        if (!(this instanceof FakeDate)) return new RealDate(...args).toString();
        return args.length ? new RealDate(...args) : new RealDate(deviceNow);
    }
    FakeDate.now = () => deviceNow;
    FakeDate.prototype = RealDate.prototype;

    const log = { claims: [], purges: [], staleMarkerClears: [] };

    const ctx = {
        console: auditConsole, Promise, JSON, Object, Array, Number, String, Boolean, Math, Set, Map,
        setTimeout, clearTimeout, isNaN, parseFloat, parseInt,
        Date: FakeDate,
        navigator: { onLine: !!opts.online },
        window: {},
        __log: log
    };
    vm.createContext(ctx);

    const code = [
        extractConst(src, 'TWO_HOURS_MS'),
        extractConst(src, 'ABANDON_AGE_MS'),
        extractConst(src, 'EXPIRED_TRASH_RETENTION_MS'),
        extractConst(src, 'TRASH_RETENTION_MS'),
        extractConst(src, 'DB_OP_TIMEOUT_MS'),
        extractFn(src, 'withTimeout'),
        extractFn(src, 'dbOp'),
        extractFn(src, 'dbOpStalled'),
        'let serverTimeOffsetMs = 0;',
        'let serverClockTrusted = false;',
        'let isDatabaseConnected = false, hasEverConnectedToDatabase = false;',
        'let dbRefConnected = "connected", dbRefServerTimeOffset = "offset";',
        'let db = {}, fb = null;',
        'let infoListenerGeneration = 0;',
        'let deletedCleanupInFlight = false;',
        'let scanHistory = [], deletedItems = [];',
        'const activeRestoreClaims = new Set();',
        'const cleanupInFlight = new Set();',
        // ── អ្នកកត់ត្រា ៖ វាស់ **ការសម្រេចបំផ្លាញ** មិនមែនអនុវត្តវាទេ ──
        'function claimAndCleanupItem(id, reason) { __log.claims.push({ id, reason }); return Promise.resolve(); }',
        'function purgeDeletedItemsQuietly(ids) { __log.purges.push(ids.slice()); return Promise.resolve(); }',
        'function clearStaleRestoreMarkers(item) { __log.staleMarkerClears.push(item.id); }',
        'function itemHasRestoreMarkers() { return false; }',
        'function isActiveRestoreClaim() { return false; }',
        'function collectItemBarcodes() { return []; }',
        'function releaseStaleRestoreClaimForPurge() { return Promise.resolve(); }',
        'function releaseBarcodesInRegistry() { return Promise.resolve(); }',
        'function barcodeCloseIsRipe(b, now) { return !!(b && b.isClosed && typeof b.closedAt === "number" && (now - b.closedAt) > TWO_HOURS_MS); }',
        'function parseTimestampFromId() { return null; }',
        'function showToast() {}',
        'function clearInfoListenerRecovery() {}',
        'function clearReconnectWatchdog() {}',
        'function retryFailedDbListenersNow() {}',
        'function flushPendingHistoryPatches() {}',
        'function flushPendingRegistryReleases() {}',
        'let pendingRegistryReleases = new Map();',
        'let registryReleaseFlushInFlight = false;',
        'function scheduleReconnectWatchdog() {}',
        'function renderConnectionStatus() {}',
        'function handleInfoListenerError() {}',
        'function noteInfoListenerAlive() {}',
        'const infoListenerFailedPaths = new Set();',
        "const INFO_LISTENER_KEY_CONNECTED = 'connected';",
        "const INFO_LISTENER_KEY_OFFSET = 'serverTimeOffset';",
        extractFn(src, 'getServerNow'),
        extractFn(src, 'serverClockOffsetIsFromServer'),
        CLOCK_GATE,
        extractFn(src, 'detachInfoListeners'),
        extractFn(src, 'attachInfoListeners'),
        extractFn(src, 'runAutomaticCleanupRules'),
        // ⛔ ZTO-E1 ៖ ច្រកទ្វាររង់ចាំបញ្ជី «ចុះហត្ថលេខា» ➜ sandbox គ្មាន ZTO ➜ ច្រកទ្វារពិតឆ្លើយ `false` (វាស់ក្នុង
        //    `ZoeW/tests/zto-abandon-signed-gate.test.tsx`)។ checker នេះវាស់តែច្រកទ្វារនាឡិកា។
        'function ztoAbandonCleanupIsHeld() { return false; }',
        extractFn(src, 'barcodeAbandonIsRipe'),
        extractFn(src, 'barcodeAbandonBasis'),
        extractFn(src, 'itemAbandonRipeAt'),
        extractFn(src, 'trashRetentionMs'),
        extractFn(src, 'runAutomaticDeletedCleanup'),
        'globalThis.__seed = (h, t) => { scanHistory = h; deletedItems = t; };',
        'globalThis.__handshake = (offset) => {',
        '    fb = { off() {}, onValue(ref, cb) { cb({ val: () => (ref === "connected" ? true : offset) }); } };',
        '    attachInfoListeners();',
        '};',
        // ⛔ WiFi ដាច់ ៖ `.info/connected` បាញ់ `false` ខណៈ offset **នៅដដែល**
        //    (RTDB មិនផ្ញើ offset ថ្មីពេលដាច់ទេ) — នេះជាស្ថានភាពពិត
        //    ដែលអ្នកប្រើប្តូរនាឡិកាទូរស័ព្ទក្នុងវា។
        'globalThis.__disconnect = (offset) => {',
        '    fb = { off() {}, onValue(ref, cb) { cb({ val: () => (ref === "connected" ? false : offset) }); } };',
        '    attachInfoListeners();',
        '};',
        'globalThis.__run = async () => { runAutomaticCleanupRules(); await runAutomaticDeletedCleanup(); };',
        'globalThis.__serverNow = () => getServerNow();'
    ].filter(Boolean).join('\n\n');

    new vm.Script(code).runInContext(ctx);
    return { ctx, log, setDeviceNow: (ms) => { deviceNow = ms; } };
}

// ធាតុពិត ៖ កញ្ចប់បើកថ្មីៗ · barcode ដែលទើបបិទ · ធុងសំរាមថ្មីៗ
// គ្មានមួយណាដល់ពេលត្រូវសម្អាតទេ **តាមម៉ោងពិត**
function freshSeed() {
    const history = [
        { id: 'id_open', createdAt: REAL_NOW - 60000, isClosed: false,
          barcodes: [{ code: 'A1', isClosed: false, cod: 10, dod: 0 }] },
        { id: 'id_closed', createdAt: REAL_NOW - 60000, isClosed: true, closedAt: REAL_NOW - 60000,
          barcodes: [{ code: 'B1', isClosed: true, closedAt: REAL_NOW - 60000, cod: 20, dod: 0 }] }
    ];
    const trash = [{ id: 'trash_1', deletedAt: REAL_NOW - 60000 }];
    return { history, trash };
}

(async () => {
    console.log('=== ការសម្អាតដែលបំផ្លាញ ត្រូវការនាឡិកាដែលមកពី server ===\n');

    // ── ១. ⛔ សេណារីយ៉ូរបស់អ្នកប្រើ ៖ ក្រៅបណ្តាញ + ថ្ងៃលោត ១ ឆ្នាំ ────────
    {
        const w = buildWorld({ deviceNow: REAL_NOW + YEAR_MS, online: false });
        const seed = freshSeed();
        w.ctx.__seed(seed.history, seed.trash);
        await w.ctx.__run();
        ok('⛔ ក្រៅបណ្តាញ + នាឡិកាលោត ១ ឆ្នាំ ➜ **គ្មានកញ្ចប់ណាត្រូវសម្អាត**',
            w.log.claims.length === 0, w.log.claims);
        ok('⛔ ក្រៅបណ្តាញ + នាឡិកាលោត ១ ឆ្នាំ ➜ **ធុងសំរាមមិនត្រូវ purge**',
            w.log.purges.length === 0, w.log.purges);
    }

    // ── ២. ⛔ ទិសផ្ទុយ ៖ នាឡិកាដែល sync ពិត ➜ ការសម្អាត **ត្រូវនៅដំណើរការ** ─
    //     បើគ្មានការអះអាងនេះ ការ «កុំសម្អាតគ្រប់ពេល» នឹងបៃតង ហើយកញ្ចប់
    //     នឹងកកកុញជារៀងរហូត។
    {
        const w = buildWorld({ deviceNow: REAL_NOW + YEAR_MS, online: true });
        // handshake ពិត ៖ server ប្រាប់ថាម៉ោងពិតគឺ REAL_NOW ➜ offset ជាអវិជ្ជមាន
        w.ctx.__handshake(-YEAR_MS);
        const seed = freshSeed();
        // ធាតុដែល **ដល់ពេលពិត** តាមម៉ោង server
        seed.history[0].createdAt = REAL_NOW - 9 * 24 * 60 * 60 * 1000;
        seed.history[1].closedAt = REAL_NOW - 3 * 60 * 60 * 1000;
        seed.history[1].barcodes[0].closedAt = REAL_NOW - 3 * 60 * 60 * 1000;
        seed.trash[0].deletedAt = REAL_NOW - 31 * 24 * 60 * 60 * 1000;
        w.ctx.__seed(seed.history, seed.trash);
        ok('   នាឡិកា sync ➜ getServerNow() ត្រឡប់ម៉ោង server មិនមែនម៉ោងឧបករណ៍',
            Math.abs(w.ctx.__serverNow() - REAL_NOW) < 1000, w.ctx.__serverNow() - REAL_NOW);
        await w.ctx.__run();
        ok('⛔ ទិសផ្ទុយ ៖ នាឡិកា sync + ធាតុដល់ពេលពិត ➜ ការសម្អាត **ត្រូវរត់**',
            w.log.claims.length >= 2, w.log.claims);
        ok('⛔ ទិសផ្ទុយ ៖ នាឡិកា sync + ធុងសំរាមហួស ៣០ ថ្ងៃ ➜ purge **ត្រូវរត់**',
            w.log.purges.length === 1, w.log.purges);
    }

    // ── ៣. នាឡិកា sync តែគ្មានអ្វីដល់ពេល ➜ មិនត្រូវប៉ះអ្វីទាំងអស់ ──────────
    {
        const w = buildWorld({ deviceNow: REAL_NOW, online: true });
        w.ctx.__handshake(0);
        const seed = freshSeed();
        w.ctx.__seed(seed.history, seed.trash);
        await w.ctx.__run();
        ok('នាឡិកា sync + គ្មានអ្វីដល់ពេល ➜ គ្មានការសម្អាត (មិនមែនសម្អាតគ្រប់ពេល)',
            w.log.claims.length === 0 && w.log.purges.length === 0,
            { claims: w.log.claims, purges: w.log.purges });
    }

    // ── ៤. ក្រៅបណ្តាញទាំងស្រុង តែធាតុដល់ពេលពិត ➜ ត្រូវ **ពន្យារ** មិនមែនបំផ្លាញ ─
    //     នេះជាចំណុចសំខាន់ ៖ ការពន្យារមិនបាត់ការងារទេ — ការសម្អាតនឹងរត់
    //     ពេលភ្ជាប់មកវិញ ដោយម៉ោង server ពិត។
    {
        const w = buildWorld({ deviceNow: REAL_NOW, online: false });
        const seed = freshSeed();
        seed.history[0].createdAt = REAL_NOW - 9 * 24 * 60 * 60 * 1000;
        seed.trash[0].deletedAt = REAL_NOW - 31 * 24 * 60 * 60 * 1000;
        w.ctx.__seed(seed.history, seed.trash);
        await w.ctx.__run();
        ok('⛔ ក្រៅបណ្តាញ (នាឡិកាមិនទាន់ផ្ទៀងផ្ទាត់) ➜ ការសម្អាតត្រូវ **ពន្យារ**',
            w.log.claims.length === 0 && w.log.purges.length === 0,
            { claims: w.log.claims, purges: w.log.purges });

        // រួចពេលភ្ជាប់មកវិញ ➜ ការងារដដែលត្រូវរត់
        w.ctx.__handshake(0);
        await w.ctx.__run();
        ok('   ក្រោយភ្ជាប់មកវិញ ➜ ការសម្អាតដដែល **រត់វិញ** (ការពន្យារមិនបាត់ការងារ)',
            w.log.claims.length >= 1 && w.log.purges.length === 1,
            { claims: w.log.claims, purges: w.log.purges });
    }

    // ── ៦. ⛔ ការភ្ជាប់ដាច់ **ក្រោយ** handshake ➜ នាឡិកាឧបករណ៍លោត ─────────────
    //     នេះជាចន្លោះដែលកំណែ 2.20.5 ទុកចោល ៖ `serverClockTrusted` ត្រូវសរសេរ
    //     **តែម្តង** ហើយ **មិនដែលត្រឡប់ជា false វិញ**។ ដូច្នេះលំដាប់ពិត
    //     «បើក App ➜ ភ្ជាប់ ➜ បិទ WiFi ➜ ប្តូរថ្ងៃទូរស័ព្ទ» ធ្វើឲ្យ
    //     `getServerNow()` រំកិលតាមនាឡិកាឧបករណ៍ម្តងទៀត ខណៈច្រកទ្វារនៅបើក ➜
    //     ការសម្អាតបំផ្លាញរត់ដោយម៉ោងខុស។ (ថ្នាក់ដដែលនឹងមេរៀន 2.20.6 អំពី
    //     License ៖ «ទង់នៅ true បន្តក្រោយចាកចេញពីបណ្តាញ ហើយ offset ក្លាយជាចាស់»។)
    {
        const w = buildWorld({ deviceNow: REAL_NOW, online: true });
        w.ctx.__handshake(0);
        const seed = freshSeed();
        w.ctx.__seed(seed.history, seed.trash);
        await w.ctx.__run();
        ok('   handshake ពិត + គ្មានអ្វីដល់ពេល ➜ គ្មានការសម្អាត (ចំណុចចាប់ផ្តើម)',
            w.log.claims.length === 0 && w.log.purges.length === 0,
            { claims: w.log.claims, purges: w.log.purges });

        w.ctx.__disconnect(0);
        w.setDeviceNow(REAL_NOW + YEAR_MS);
        await w.ctx.__run();
        ok('⛔ ដាច់បណ្តាញក្រោយ handshake + នាឡិកាលោត ១ ឆ្នាំ ➜ **គ្មានកញ្ចប់ត្រូវសម្អាត**',
            w.log.claims.length === 0, w.log.claims);
        ok('⛔ ដាច់បណ្តាញក្រោយ handshake + នាឡិកាលោត ១ ឆ្នាំ ➜ **ធុងសំរាមមិនត្រូវ purge**',
            w.log.purges.length === 0, w.log.purges);

        // ទិសផ្ទុយ ៖ ភ្ជាប់មកវិញ (server ប្រាប់ម៉ោងពិត) ➜ ការងារដដែលត្រូវរត់
        const ripe = freshSeed();
        ripe.history[0].createdAt = REAL_NOW - 9 * 24 * 60 * 60 * 1000;
        ripe.history[1].closedAt = REAL_NOW - 3 * 60 * 60 * 1000;
        ripe.history[1].barcodes[0].closedAt = REAL_NOW - 3 * 60 * 60 * 1000;
        ripe.trash[0].deletedAt = REAL_NOW - 31 * 24 * 60 * 60 * 1000;
        w.ctx.__seed(ripe.history, ripe.trash);
        w.ctx.__handshake(-YEAR_MS);
        await w.ctx.__run();
        ok('   ភ្ជាប់មកវិញដោយម៉ោង server ពិត ➜ ការសម្អាត **រត់វិញ** (ការពន្យារមិនបាត់ការងារ)',
            w.log.claims.length >= 2 && w.log.purges.length === 1,
            { claims: w.log.claims, purges: w.log.purges });
    }

    // ── ៥. ស្តាទិច ៖ ច្រកទ្វារត្រូវឈរនៅ **កន្លែងសម្រេច** មិនមែនត្រឹមអ្នកហៅ ──
    //     `runAutomaticCleanupRules()` ក៏ត្រូវហៅពី `debouncedRenderAfterHistorySync`
    //     ដែរ (១២០ms ក្រោយ snapshot) ➜ ការដាក់ច្រកទ្វារត្រឹម `runScheduledCleanup()`
    //     តែម្យ៉ាង **មិនគ្របផ្លូវនោះទេ**។
    {
        const rules = extractFn(src, 'runAutomaticCleanupRules') || '';
        const purge = extractFn(src, 'runAutomaticDeletedCleanup') || '';
        ok('⛔ ច្រកទ្វារនាឡិកាឈរក្នុង `runAutomaticCleanupRules()` ខ្លួនវា',
            /cleanupClockIsTrustworthy\s*\(\s*\)/.test(rules),
            'ផ្លូវ debouncedRenderAfterHistorySync នឹងរំលងច្រកទ្វារ');
        ok('⛔ ច្រកទ្វារនាឡិកាឈរក្នុង `runAutomaticDeletedCleanup()` ខ្លួនវា',
            /cleanupClockIsTrustworthy\s*\(\s*\)/.test(purge));
    }

    ok('fixture មិនលាក់ runtime error ដែលមិនបានរំពឹងទុក', unexpectedErrors.length === 0, unexpectedErrors);
    console.log('\n' + pass + ' ok, ' + fail + ' FAIL');
    process.exit(fail ? 1 : 0);
})();
