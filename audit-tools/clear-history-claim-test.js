const fs = require('fs');
const path = require('path');
// ថត app អាច override បាន ដើម្បីឲ្យ `run-all.sh <baseline>` និង
// `checker-coverage.js` បញ្ជាក់បានថា checker នេះពិតជាអានកូដមែន។
const APP_ROOT = process.env.CLEARCLAIM_APP_DIR ? path.resolve(process.env.CLEARCLAIM_APP_DIR) : path.resolve(__dirname, '..');
const vm = require('vm');

let pass = 0;
let fail = 0;

function check(condition, label, detail) {
    if (condition) {
        pass++;
        console.log('  ok    ' + label);
    } else {
        fail++;
        console.log('  FAIL  ' + label + (detail ? '\n        ' + detail : ''));
    }
}

function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function makeRuntime() {
    const store = {
        zoew_scan_history_cod_dod: {
            id_clear: {
                id: 'id_clear', phone: '0988000001', scanDate: '2026-08-19', createdAt: 1,
                cod: 9, dod: 1, price: 10, count: 1, barcode: 'CLEAR1', isClosed: false,
                barcodes: [{ code: 'CLEAR1', cod: 9, dod: 1, locker: 'A1', lockerUpdatedAt: 10, lockerUpdatedBy: 'scanner-uid', lockerRevision: 3, isClosed: false, isDeducted: false, isFromDeletion: false, createdAt: 1 }]
            }
        },
        zoew_recently_deleted_cod_dod: {},
        zoew_clear_history_finalizations: {}
    };
    const shared = { store, now: 200000, db: {} };
    const getPath = (rawPath) => {
        const parts = String(rawPath || '').split('/').filter(Boolean);
        let value = store;
        for (const part of parts) {
            if (!value || typeof value !== 'object') return null;
            value = value[part];
        }
        return value === undefined ? null : value;
    };
    const setPath = (rawPath, value) => {
        const parts = String(rawPath || '').split('/').filter(Boolean);
        let target = store;
        for (let i = 0; i < parts.length - 1; i++) {
            if (!target[parts[i]] || typeof target[parts[i]] !== 'object') target[parts[i]] = {};
            target = target[parts[i]];
        }
        const key = parts[parts.length - 1];
        if (value === null) delete target[key]; else target[key] = clone(value);
    };
    const snapshot = (rawPath) => {
        const value = getPath(rawPath);
        return { exists: () => value !== null && value !== undefined, val: () => clone(value) };
    };
    const joined = (base, leaf) => [base, leaf].filter(Boolean).join('/');

    function validateFanout(base, updates) {
        const entries = Object.entries(updates).map(([key, value]) => [joined(base, key), value]);
        for (const [entryPath, witness] of entries) {
            const match = /^zoew_clear_history_finalizations\/([^/]+)$/.exec(entryPath);
            if (!match) continue;
            const id = match[1];
            const history = getPath(`zoew_scan_history_cod_dod/${id}`);
            const trash = getPath(`zoew_recently_deleted_cod_dod/${id}`);
            const deletesHistory = updates[`zoew_scan_history_cod_dod/${id}`] === null;
            const nextTrash = updates[`zoew_recently_deleted_cod_dod/${id}`];
            if (getPath(entryPath) || !history || !history.clearClaim || !witness || witness.token !== history.clearClaim.token ||
                trash || !deletesHistory || !nextTrash || nextTrash.clearClaim || nextTrash.restoreClaimId || nextTrash.restoreClaimToken) {
                throw new Error('permission_denied: clear history fence');
            }
        }
    }

    shared.fb = {
        ref: (db, rawPath) => ({ path: rawPath === undefined ? '' : String(rawPath) }),
        get: (ref) => Promise.resolve(snapshot(ref.path)),
        runTransaction: async (ref, updater) => {
            const next = updater(clone(getPath(ref.path)));
            if (next === undefined) return { committed: false, snapshot: snapshot(ref.path) };
            setPath(ref.path, next);
            return { committed: true, snapshot: snapshot(ref.path) };
        },
        update: async (ref, updates) => {
            validateFanout(ref.path, updates);
            Object.entries(updates).forEach(([key, value]) => setPath(joined(ref.path, key), value));
        }
    };
    shared.getPath = getPath;
    return shared;
}

function extractFn(src, name) {
    const at = src.search(new RegExp('(?:async\\s+)?function\\s+' + name + '\\s*\\('));
    if (at === -1) return '';
    let depth = 0;
    const open = src.indexOf('{', src.indexOf(')', at));
    for (let k = open; k < src.length; k++) {
        if (src[k] === '{') depth++;
        else if (src[k] === '}') { depth--; if (!depth) return src.slice(at, k + 1); }
    }
    return '';
}

function makeTab(app, shared, suffix) {
    const source = fs.readFileSync(path.join(APP_ROOT, app, 'app.js'), 'utf8');
    const start = source.indexOf('    const CLEAR_HISTORY_CLAIM_LEASE_MS =');
    const end = source.indexOf('    async function clearHistory()', start);
    if (start === -1 || end === -1) throw new Error('clear history helper block not found');
    // ⛔ ពិដានការហៅ Firebase (db-stall-guard) ស្ថិត **ក្រៅ** ប្លុកនេះ
    const guardBlock = [
        (source.match(/^ *const DB_OP_TIMEOUT_MS = .*$/m) || [''])[0],
        extractFn(source, 'withTimeout'),
        extractFn(source, 'dbOp'),
        extractFn(source, 'dbOpStalled')
    ].filter(Boolean).join('\n');
    const helpers = guardBlock + '\n' + source.slice(start, end);
    let sequence = 0;
    const context = vm.createContext({
        console,
        db: shared.db,
        fb: shared.fb,
        getServerNow: () => shared.now,
        generateUniqueId: () => `${suffix}_${++sequence}`,
        normalizeBarcodesOf: (item) => item,
        cloneRestoreItem: (item) => clone(item),
        // ⛔ backoff ខ្លីបង្រួម; ពិដាន ១៥ វិ. ត្រូវនៅជាតួរម៉ោងពិត
        setTimeout: (fn, ms) => (ms >= 10000 ? setTimeout(fn, ms) : (fn(), 0)),
        clearTimeout: (t) => { if (t) clearTimeout(t); }
    });
    new vm.Script(`function stripHistoryOnlyMarkers(item) { if (!item || typeof item !== 'object') return item; delete item.clearClaim; delete item.restoreClaim; delete item.restoreClaimId; delete item.restoreClaimToken; return item; }\n${helpers}\nglobalThis.clearHelpers = { claimHistoryItemForClear, buildClearHistoryTrashItem, finalizeClaimedHistoryClear, clearClearHistoryFinalization, CLEAR_HISTORY_CLAIM_LEASE_MS };`).runInContext(context);
    return context.clearHelpers;
}

async function rejected(work) {
    try {
        await work();
        return null;
    } catch (error) {
        return error && error.message;
    }
}

(async () => {
    for (const app of ['ZoeW']) {
        console.log('\n=== ' + app + ' Clear All claims ===');
        const shared = makeRuntime();
        const tabA = makeTab(app, shared, 'A');
        const tabB = makeTab(app, shared, 'B');

        const source = await tabA.claimHistoryItemForClear('id_clear', 'clear-old');
        const legacyTrashPreview = tabA.buildClearHistoryTrashItem({
            id: 'id_clear_legacy', phone: '0988000002', scanDate: '2026-08-19', createdAt: 1,
            cod: 2, dod: 0, price: 2, count: 1, barcode: 'CLEARLEGACY', locker: 'A2', lockerRevision: 6,
            clearClaim: { token: 'legacy-claim', claimedAt: shared.now }
        }, 'id_clear_legacy');
        check(legacyTrashPreview && legacyTrashPreview.lockerRevision === 6 && !legacyTrashPreview.clearClaim,
            app + ': Clear All trash builder preserves legacy locker revision while removing transient claim state', JSON.stringify(legacyTrashPreview));
        const preFinalHistory = shared.getPath('zoew_scan_history_cod_dod/id_clear');
        check(preFinalHistory && preFinalHistory.clearClaim && preFinalHistory.clearClaim.token === 'clear-old' &&
            !shared.getPath('zoew_recently_deleted_cod_dod/id_clear'),
        app + ': Clear All crash before final fanout leaves live record with a durable claim', JSON.stringify(preFinalHistory));

        const activeTakeover = await rejected(() => tabB.claimHistoryItemForClear('id_clear', 'clear-new',));
        check(activeTakeover === 'CLEAR_HISTORY_IN_PROGRESS', app + ': Clear All second tab cannot take an active claim', activeTakeover);

        shared.store.zoew_scan_history_cod_dod.id_clear.clearClaim.claimedAt = shared.now - tabA.CLEAR_HISTORY_CLAIM_LEASE_MS - 1;
        const sourceNew = await tabB.claimHistoryItemForClear('id_clear', 'clear-new');
        const oldTrash = tabA.buildClearHistoryTrashItem(source, 'id_clear');
        const oldFinalize = await rejected(() => tabA.finalizeClaimedHistoryClear('id_clear', 'clear-old', oldTrash));
        const stillLive = shared.getPath('zoew_scan_history_cod_dod/id_clear');
        check(oldFinalize === 'CLEAR_HISTORY_CLAIM_LOST' && stillLive && stillLive.clearClaim.token === 'clear-new' &&
            !shared.getPath('zoew_recently_deleted_cod_dod/id_clear'),
        app + ': Clear All expired old-token fanout cannot delete or overwrite after takeover', JSON.stringify({ oldFinalize, stillLive }));

        const newTrash = tabB.buildClearHistoryTrashItem(sourceNew, 'id_clear');
        await tabB.finalizeClaimedHistoryClear('id_clear', 'clear-new', newTrash);
        const finalTrash = shared.getPath('zoew_recently_deleted_cod_dod/id_clear');
        const finalWitness = shared.getPath('zoew_clear_history_finalizations/id_clear');
        check(!shared.getPath('zoew_scan_history_cod_dod/id_clear') && finalTrash && !finalTrash.clearClaim &&
            !finalTrash.restoreClaimId && !finalTrash.restoreClaimToken &&
            finalWitness && finalWitness.token === 'clear-new' && finalTrash.barcodes[0].lockerUpdatedBy === 'scanner-uid' && finalTrash.barcodes[0].lockerRevision === 3,
        app + ': Clear All current claim atomically moves sanitized data to trash', JSON.stringify({ finalTrash, finalWitness }));

        await tabB.clearClearHistoryFinalization('id_clear', 'clear-new');
        const staleAfterFinal = await rejected(() => tabA.finalizeClaimedHistoryClear('id_clear', 'clear-old', oldTrash));
        check(staleAfterFinal === 'CLEAR_HISTORY_CLAIM_LOST' && finalTrash.id === 'id_clear' && !shared.getPath('zoew_clear_history_finalizations/id_clear'),
            app + ': Clear All stale tab after finalization cannot replace the finalized trash record', staleAfterFinal);
    }

    console.log('\n' + (fail ? 'FAIL ' + fail + '/' + (pass + fail) : 'PASS ' + pass + '/' + pass));
    process.exit(fail ? 1 : 0);
})().catch((error) => {
    console.error(error && error.stack || error);
    process.exit(1);
});
