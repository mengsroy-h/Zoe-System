const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = process.env.MARKER_APP_DIR ? path.resolve(process.env.MARKER_APP_DIR) : path.join(__dirname, '..');
const APP = path.join(ROOT, 'ZoeW', 'app.js');

let pass = 0, fail = 0;
function check(cond, label, detail) {
    if (cond) { pass++; console.log('  ok    ' + label); }
    else { fail++; console.log('  FAIL  ' + label + (detail ? '\n        ' + detail : '')); }
}
const clone = (v) => v === undefined ? undefined : JSON.parse(JSON.stringify(v));

function sliceBalanced(src, from) {
    let depth = 0;
    for (let i = from; i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(from, i + 1); }
    }
    throw new Error('unbalanced braces');
}
function extractFn(src, name) {
    const re = new RegExp('\\n(\\s*)(async\\s+)?function ' + name + '\\s*\\(');
    const m = re.exec(src);
    if (!m) throw new Error('function not found in shipped code: ' + name);
    const head = src.indexOf('function ' + name, m.index);
    const brace = src.indexOf('{', src.indexOf('(', head));
    return (m[2] ? 'async ' : '') + src.slice(head, brace) + sliceBalanced(src, brace);
}
function extractConst(src, name) {
    const m = new RegExp('\\n\\s*const ' + name + ' = ([^;]+);').exec(src);
    if (!m) throw new Error('const not found: ' + name);
    return 'const ' + name + ' = ' + m[1] + ';';
}

const src = fs.readFileSync(APP, 'utf8').replace(/\r\n?/g, '\n');

const FNS = ['barcodeEntriesOf', 'normalizeBarcodesOf', 'stripHistoryOnlyMarkers', 'itemHasRestoreMarkers', 'dropStaleRestoreMarkers',
    'applyBarcodeCloseState', 'barcodeCloseIsRipe', 'normalizeBarcodeCloseStamps', 'parseTimestampFromId',
    'generateUniqueId', 'retryAsync', 'cloneRestoreItem', 'isActiveRestoreClaim',
    'saveSingleDeletedItemToFirebase', 'restoreClaimedItemToScanHistory', 'clearStaleRestoreMarkers',
    'releaseStaleRestoreClaimForPurge', 'claimAndCleanupItem', 'runAutomaticCleanupRules'];

function buildWorld(store, now) {
    const world = { store, now, revenueLog: [], commits: 0, writtenPaths: [] };
    const getPath = (raw) => {
        const parts = String(raw || '').split('/').filter(Boolean);
        let cur = store;
        for (const p of parts) { if (!cur || typeof cur !== 'object') return null; cur = cur[p]; }
        return cur === undefined ? null : cur;
    };
    const setPath = (raw, value) => {
        const parts = String(raw || '').split('/').filter(Boolean);
        let cur = store;
        for (let i = 0; i < parts.length - 1; i++) {
            if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
            cur = cur[parts[i]];
        }
        const key = parts[parts.length - 1];
        if (value === null) { delete cur[key]; return; }
        cur[key] = clone(value);
    };
    const fb = {
        ref: (db, raw) => ({ path: raw === undefined ? '' : String(raw) }),
        get: (ref) => { const v = getPath(ref.path); return Promise.resolve({ exists: () => v !== null, val: () => clone(v) }); },
        runTransaction: (ref, updater) => Promise.resolve().then(() => {
            const next = updater(clone(getPath(ref.path)));
            if (next === undefined) return { committed: false, snapshot: { val: () => clone(getPath(ref.path)) } };
            world.commits++; world.writtenPaths.push(ref.path);
            setPath(ref.path, next);
            return { committed: true, snapshot: { val: () => clone(getPath(ref.path)) } };
        }),
        update: (ref, updates) => Promise.resolve().then(() => {
            Object.entries(updates).forEach(([k, v]) => {
                const full = [ref.path, k].filter(Boolean).join('/');
                world.commits++; world.writtenPaths.push(full);
                setPath(full, v);
            });
        })
    };
    const context = vm.createContext({
        console, setTimeout, clearTimeout, Promise, Math, Date, JSON, window: {},
        db: {}, fb,
        dbRefDeleted: fb.ref({}, 'zoew_recently_deleted_cod_dod'),
        dbRefHistory: fb.ref({}, 'zoew_scan_history_cod_dod'),
        getServerNow: () => world.now,
        getFormattedDate: () => '2026-08-26',
        addRevenueToDailyAndMonthlyRecord: (d, cod, dod, count) => world.revenueLog.push({ d, cod, dod, count }),
        showToast: () => {},
        scanHistory: [], deletedItems: []
    });
    new vm.Script([
        extractConst(src, 'TWO_HOURS_MS'), extractConst(src, 'EIGHT_DAYS_MS'), extractConst(src, 'RESTORE_CLAIM_LEASE_MS'),
        'const cleanupInFlight = new Set();', 'const staleRestoreMarkerSweeps = new Set();', 'const dbListenerPendingPaths = new Set();', 'const activeRestoreClaims = new Map();',
        ...FNS.map((n) => extractFn(src, n)),
        'globalThis.api = { runAutomaticCleanupRules, claimAndCleanupItem, clearStaleRestoreMarkers, releaseStaleRestoreClaimForPurge, stripHistoryOnlyMarkers, itemHasRestoreMarkers };'
    ].join('\n\n')).runInContext(context);
    world.context = context;
    world.getPath = getPath;
    world.sync = () => {
        const h = getPath('zoew_scan_history_cod_dod') || {};
        context.scanHistory.length = 0;
        Object.keys(h).forEach((k) => context.scanHistory.push(clone(h[k])));
        const t = getPath('zoew_recently_deleted_cod_dod') || {};
        context.deletedItems.length = 0;
        Object.keys(t).forEach((k) => context.deletedItems.push(clone(t[k])));
    };
    world.drain = async () => { for (let i = 0; i < 25; i++) await new Promise((r) => setTimeout(r, 0)); };
    world.sync();
    return world;
}

const T0 = 1750000000000;
const HOUR = 3600000;
const bcode = (code, closed, closedAt) => Object.assign(
    { code, cod: 1, dod: 0, locker: 'N/A', time: 't', isClosed: !!closed, isDeducted: false, isFromDeletion: false, createdAt: T0 },
    closed && closedAt !== undefined ? { closedAt } : {});
const parcel = (id, barcodes, extra) => Object.assign({
    id, phone: '098798880', scanDate: '2026-08-26', createdAt: T0, time: 't',
    barcodes, count: barcodes.length,
    cod: barcodes.reduce((s, b) => s + b.cod, 0), dod: 0,
    price: barcodes.reduce((s, b) => s + b.cod, 0),
    barcode: barcodes[0].code, isClosed: barcodes.every((b) => b.isClosed), isCalled: false
}, extra || {});

async function scenarioCleanupSkipsRestore() {
    console.log('\nសេណារីយ៉ូ ១ — ការសម្អាតស្វ័យប្រវត្តិមិនត្រូវប៉ះធាតុដែលកំពុងស្តារ');
    const item = parcel('id_a', [bcode('A1', true, T0)], { restoreClaimId: 'src_a', restoreClaimToken: 'tok_a' });
    const world = buildWorld({
        zoew_scan_history_cod_dod: { id_a: item },
        zoew_recently_deleted_cod_dod: { src_a: { id: 'src_a', restoreClaim: { token: 'tok_a', targetId: 'id_a', claimedAt: T0 + 5 * HOUR } } }
    }, T0 + 5 * HOUR);

    const before = world.commits;
    world.now = T0 + 5 * HOUR;
    world.sync();
    world.context.claimAndCleanupItem('id_a', 'close');
    await world.drain();
    const live = world.getPath('zoew_scan_history_cod_dod/id_a');
    check(world.commits === before, '⛔ ស្នូល៖ claimAndCleanupItem **មិនសរសេរអ្វីទាល់តែសោះ** លើធាតុដែលមាន marker ស្តារ', 'commits ' + before + ' ➜ ' + world.commits);
    check(!!live && live.restoreClaimId === 'src_a' && live.restoreClaimToken === 'tok_a', 'marker ស្តារនៅគ្រប់ — ការស្តារនៅតែបញ្ចប់បាន');
    check(!!live && live.barcodes.length === 1, 'barcode មិនត្រូវផ្លាស់ចេញ');
    check(Object.keys(world.getPath('zoew_recently_deleted_cod_dod') || {}).length === 1, 'គ្មានធាតុថ្មីចូលធុងសំរាម');
}

async function scenarioStaleMarkerSweep() {
    console.log('\nសេណារីយ៉ូ ២ — marker ស្តារដែលងាប់ ត្រូវបោសចោលឲ្យធាតុប្រើការវិញ');
    const world = buildWorld({
        zoew_scan_history_cod_dod: {
            id_live: parcel('id_live', [bcode('L1', true, T0)], { restoreClaimId: 'src_live', restoreClaimToken: 'tok_live' }),
            id_dead: parcel('id_dead', [bcode('D1', true, T0)], { restoreClaimId: 'src_dead', restoreClaimToken: 'tok_dead' }),
            id_orphan: parcel('id_orphan', [bcode('O1', true, T0)], { restoreClaimId: 'gone', restoreClaimToken: 'tok_gone' })
        },
        zoew_recently_deleted_cod_dod: {
            src_live: { id: 'src_live', restoreClaim: { token: 'tok_live', targetId: 'id_live', claimedAt: T0 + 5 * HOUR } },
            src_dead: { id: 'src_dead', restoreClaim: { token: 'tok_dead', targetId: 'id_dead', claimedAt: T0 } }
        }
    }, T0 + 5 * HOUR);

    world.sync();
    world.context.runAutomaticCleanupRules();
    await world.drain();

    const live = world.getPath('zoew_scan_history_cod_dod/id_live');
    const dead = world.getPath('zoew_scan_history_cod_dod/id_dead');
    const orphan = world.getPath('zoew_scan_history_cod_dod/id_orphan');
    check(!!live && live.restoreClaimId === 'src_live', 'ការស្តារដែលនៅរស់ (claim ក្នុង lease) **មិនត្រូវប៉ះ**');
    check(!!dead && dead.restoreClaimId === undefined && dead.restoreClaimToken === undefined,
        '⛔ ស្នូល៖ marker ដែលងាប់ (claim ហួស lease) ត្រូវបោសចោល', JSON.stringify(dead && { id: dead.restoreClaimId, tok: dead.restoreClaimToken }));
    check(!!orphan && orphan.restoreClaimId === undefined,
        '⛔ ស្នូល៖ marker ដែលធុងសំរាមរបស់វាបាត់ ក៏ត្រូវបោសចោលដែរ');
}

async function scenarioTrashNeverCarriesMarkers() {
    console.log('\nសេណារីយ៉ូ ៣ — ធាតុដែលចូលធុងសំរាមមិនត្រូវផ្ទុក marker របស់ scan_history');
    const world = buildWorld({
        zoew_scan_history_cod_dod: {
            id_p: parcel('id_p', [bcode('P1', true, T0), bcode('P2', false)], {})
        },
        zoew_recently_deleted_cod_dod: {}
    }, T0 + 5 * HOUR);

    const poisoned = world.getPath('zoew_scan_history_cod_dod/id_p');
    poisoned.restoreClaimId = 'ghost';
    poisoned.restoreClaimToken = 'ghost_tok';
    world.store.zoew_scan_history_cod_dod.id_p = poisoned;

    const stripped = world.context.stripHistoryOnlyMarkers({ ...poisoned, deletedAt: 1, trashReason: 'remove' });
    check(stripped.restoreClaimId === undefined && stripped.restoreClaimToken === undefined && stripped.clearClaim === undefined && stripped.restoreClaim === undefined,
        '⛔ ស្នូល៖ stripHistoryOnlyMarkers លុប marker ទាំង ៤', JSON.stringify(Object.keys(stripped).filter((k) => /Claim/.test(k))));

    const rules = JSON.parse(fs.readFileSync(path.join(ROOT, 'firebase-database.rules.json'), 'utf8')).rules;
    const trashSchema = rules.zoew_recently_deleted_cod_dod.$itemId;
    check(trashSchema.$other && trashSchema.$other['.validate'] === false, 'rules ធុងសំរាមបិទវាលចម្លែក ($other false)');
    ['restoreClaimId', 'restoreClaimToken', 'clearClaim'].forEach((f) => {
        check(!trashSchema[f], `rules ធុងសំរាម **មិនទទួល** '${f}' ➜ ការមិនលុបវា = permission_denied`);
    });

    const paths = [
        ['deleteSingleItem', 'const removed = stripHistoryOnlyMarkers({ ...claimedWhole, id });'],
        ['removeSingleBarcode', 'const itemToTrash = stripHistoryOnlyMarkers({ ...claimedParent, barcodes: [removedBc], count: 1 });'],
        ['claimAndCleanupItem', 'stripHistoryOnlyMarkers(trashItem);'],
        ['buildClearHistoryTrashItem', 'stripHistoryOnlyMarkers(trashItem);']
    ];
    paths.forEach(([fn, needle]) => {
        check(extractFn(src, fn).includes(needle), `ផ្លូវ '${fn}' លុប marker មុនសរសេរចូលធុងសំរាម`);
    });
}

async function scenarioPurgeReleasesDeadClaim() {
    console.log('\nសេណារីយ៉ូ ៤ — លុបជាអចិន្ត្រៃយ៍ត្រូវដោះ claim ដែលងាប់ជាមុន');
    const world = buildWorld({
        zoew_scan_history_cod_dod: {},
        zoew_recently_deleted_cod_dod: {
            t_dead: { id: 't_dead', restoreClaim: { token: 'x', targetId: 'y', claimedAt: T0 } },
            t_live: { id: 't_live', restoreClaim: { token: 'x', targetId: 'y', claimedAt: T0 + 5 * HOUR } },
            t_clean: { id: 't_clean' }
        }
    }, T0 + 5 * HOUR);
    world.sync();

    await world.context.releaseStaleRestoreClaimForPurge('t_dead');
    await world.context.releaseStaleRestoreClaimForPurge('t_live');
    const before = world.commits;
    await world.context.releaseStaleRestoreClaimForPurge('t_clean');

    check(!world.getPath('zoew_recently_deleted_cod_dod/t_dead').restoreClaim,
        '⛔ ស្នូល៖ claim ដែលងាប់ត្រូវដោះ ➜ ✖️ លុបបាន');
    check(!!world.getPath('zoew_recently_deleted_cod_dod/t_live').restoreClaim,
        'claim ដែលនៅរស់ **មិនត្រូវដោះ** (ឧបករណ៍ផ្សេងកំពុងស្តារ)');
    check(world.commits === before, 'ធាតុគ្មាន claim ➜ មិនសរសេរអ្វីទេ');
}

(async () => {
    console.log('restore-marker-hygiene-test — marker ស្តារ ↔ schema ធុងសំរាម');
    console.log('App: ' + APP);
    await scenarioCleanupSkipsRestore();
    await scenarioStaleMarkerSweep();
    await scenarioTrashNeverCarriesMarkers();
    await scenarioPurgeReleasesDeadClaim();
    console.log('\n' + pass + ' ok, ' + fail + ' fail');
    process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
