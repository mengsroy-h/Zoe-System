const fs = require('fs');
const path = require('path');
// ថត app អាច override បាន ដើម្បីឲ្យ `run-all.sh <baseline>` និង
// `checker-coverage.js` បញ្ជាក់បានថា checker នេះពិតជាអានកូដមែន។
const APP_ROOT = process.env.RESTORERACE_APP_DIR ? path.resolve(process.env.RESTORERACE_APP_DIR) : path.resolve(__dirname, '..');
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

function createSharedStore() {
    const today = '2026-08-19';
    const store = {
        zoew_scan_history_cod_dod: {
            id_live: {
                id: 'id_live', phone: '0913000001', scanDate: today, createdAt: 1,
                cod: 1, dod: 0, price: 1, count: 1, barcode: 'LIVE1', isClosed: false,
                barcodes: [{ code: 'LIVE1', cod: 1, dod: 0, locker: '', isClosed: false, isDeducted: false, isFromDeletion: false, createdAt: 1 }]
            }
        },
        zoew_recently_deleted_cod_dod: {},
        zoew_daily_revenue_cod_dod: { [today]: { codDollar: 0, dodDollar: 0, totalCount: 0 } },
        zoew_monthly_revenue_cod_dod: {},
        zoew_restore_finalizations: {}
    };
    const shared = { store, now: 100000, db: {} };

    function getPath(rawPath) {
        const parts = String(rawPath || '').split('/').filter(Boolean);
        let current = store;
        for (const part of parts) {
            if (!current || typeof current !== 'object') return null;
            current = current[part];
        }
        return current === undefined ? null : current;
    }

    function setPath(rawPath, value) {
        const parts = String(rawPath || '').split('/').filter(Boolean);
        if (!parts.length) return;
        let current = store;
        for (let i = 0; i < parts.length - 1; i++) {
            if (!current[parts[i]] || typeof current[parts[i]] !== 'object') current[parts[i]] = {};
            current = current[parts[i]];
        }
        const key = parts[parts.length - 1];
        if (value === null) {
            delete current[key];
            return;
        }
        if (value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, '__increment')) {
            const currentValue = Number(current[key]);
            current[key] = (Number.isFinite(currentValue) ? currentValue : 0) + Number(value.__increment);
            return;
        }
        current[key] = clone(value);
    }

    function snapshot(rawPath) {
        const value = getPath(rawPath);
        return { exists: () => value !== null && value !== undefined, val: () => clone(value) };
    }

    function fullPath(refPath, childPath) {
        return [refPath, childPath].filter(Boolean).join('/');
    }

    function validateFinalization(refPath, updates) {
        const entries = Object.entries(updates).map(([key, value]) => [fullPath(refPath, key), value]);
        for (const [entryPath, witness] of entries) {
            const witnessMatch = /^zoew_restore_finalizations\/([^/]+)$/.exec(entryPath);
            if (!witnessMatch) continue;
            const sourceId = witnessMatch[1];
            const claim = getPath(`zoew_recently_deleted_cod_dod/${sourceId}/restoreClaim`);
            if (getPath(entryPath) || !claim || !witness || witness.token !== claim.token || witness.targetId !== claim.targetId) {
                throw new Error('permission_denied: restore finalization witness');
            }
        }
        for (const [entryPath, value] of entries) {
            const trashMatch = /^zoew_recently_deleted_cod_dod\/([^/]+)$/.exec(entryPath);
            if (!trashMatch || value !== null) continue;
            const sourceId = trashMatch[1];
            const trash = getPath(entryPath);
            if (!trash || !trash.restoreClaim) continue;
            const claim = trash.restoreClaim;
            const witness = updates[`zoew_restore_finalizations/${sourceId}`];
            const history = getPath(`zoew_scan_history_cod_dod/${claim.targetId}`);
            const removesMarkers = updates[`zoew_scan_history_cod_dod/${claim.targetId}/restoreClaimId`] === null &&
                updates[`zoew_scan_history_cod_dod/${claim.targetId}/restoreClaimToken`] === null;
            if (!witness || witness.token !== claim.token || witness.targetId !== claim.targetId || !history ||
                history.restoreClaimId !== sourceId || history.restoreClaimToken !== claim.token || !removesMarkers) {
                throw new Error('permission_denied: restore delete fence');
            }
        }
    }

    shared.fb = {
        ref: (db, rawPath) => ({ path: rawPath === undefined ? '' : String(rawPath) }),
        get: (ref) => Promise.resolve(snapshot(ref.path)),
        increment: (amount) => ({ __increment: Number(amount) }),
        runTransaction: async (ref, updater) => {
            const current = getPath(ref.path);
            const next = updater(clone(current));
            if (next === undefined) return { committed: false, snapshot: snapshot(ref.path) };
            setPath(ref.path, next);
            return { committed: true, snapshot: snapshot(ref.path) };
        },
        update: async (ref, updates) => {
            validateFinalization(ref.path, updates);
            Object.entries(updates).forEach(([key, value]) => setPath(fullPath(ref.path, key), value));
        }
    };
    shared.getPath = getPath;
    shared.setPath = setPath;
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

function tabFor(app, shared, suffix) {
    const source = fs.readFileSync(path.join(APP_ROOT, app, 'app.js'), 'utf8');
    const start = source.indexOf('    const RESTORE_CLAIM_LEASE_MS =');
    const end = source.indexOf('    async function executeRestoreItem()', start);
    if (start === -1 || end === -1) throw new Error(app + ': restore helper block not found');
    // ⛔ ពិដានការហៅ Firebase (db-stall-guard) ស្ថិត **ក្រៅ** ប្លុកនេះ ➜
    // ត្រូវស្រង់បន្ថែម បើមិនដូច្នេះ sandbox ធ្លាក់ដោយ `dbOp is not defined`។
    const guardBlock = [
        (source.match(/^ *const DB_OP_TIMEOUT_MS = .*$/m) || [''])[0],
        extractFn(source, 'withTimeout'),
        extractFn(source, 'dbOp'),
        extractFn(source, 'dbOpStalled')
    ].filter(Boolean).join('\n');
    const restoreHelpers = guardBlock + '\n' + source.slice(start, end);
    let seq = 0;
    const context = vm.createContext({
        console,
        db: shared.db,
        authGeneration: 0,
        dbRefHistory: shared.fb.ref(shared.db, 'zoew_scan_history_cod_dod'),
        fb: shared.fb,
        getServerNow: () => shared.now,
        getFormattedDate: () => '2026-08-19',
        generateUniqueId: () => `${suffix}_${++seq}`,
        normalizeBarcodesOf: (item) => item,
        // ⛔ ការពន្យារ backoff ខ្លី ត្រូវបង្រួមឲ្យលឿន តែ **ពិដាន ១៥ វិ. របស់
        // `withTimeout()` ត្រូវនៅជាតួរម៉ោងពិត** — បើបាញ់ភ្លាម រាល់ការហៅ
        // Firebase នឹង «ផុតកំណត់» ភ្លាមៗ ➜ តេស្តវាស់អ្វីមួយផ្សេងទាំងស្រុង។
        setTimeout: (fn, ms) => (ms >= 10000 ? setTimeout(fn, ms) : (fn(), 0)),
        clearTimeout: (t) => { if (t) clearTimeout(t); }
    });
    new vm.Script(`${restoreHelpers}\nglobalThis.restoreHelpers = { claimDeletedItemForRestore, findRestoreTargetId, applyClaimedRestoreToHistory, finalizeClaimedRestore, clearRestoreFinalization, RESTORE_CLAIM_LEASE_MS };`).runInContext(context);
    return context.restoreHelpers;
}

function trashItem(id) {
    return {
        id, phone: '0913000001', scanDate: '2026-08-19', createdAt: 1, deletedAt: 2,
        cod: 10, dod: 2, price: 12, count: 1, barcode: `${id}_BC`, isClosed: false, isFromDeletion: false,
        barcodes: [{ code: `${id}_BC`, cod: 10, dod: 2, locker: '', isClosed: false, isDeducted: true, isFromDeletion: false, createdAt: 1 }]
    };
}

function restored(item) {
    const copy = clone(item);
    delete copy.deletedAt;
    delete copy.isFromDeletion;
    delete copy.restoreClaim;
    delete copy.restoreClaimId;
    delete copy.restoreClaimToken;
    copy.barcodes.forEach((barcode) => {
        barcode.isDeducted = false;
        barcode.isFromDeletion = false;
    });
    return copy;
}

function mergeIntoLive(item) {
    return (target) => {
        const next = clone(target);
        next.barcodes = Array.isArray(next.barcodes) ? next.barcodes : [];
        item.barcodes.forEach((barcode) => {
            if (!next.barcodes.some((current) => current && current.code === barcode.code)) next.barcodes.push(clone(barcode));
        });
        next.count = next.barcodes.length;
        next.cod = next.barcodes.reduce((sum, barcode) => sum + (Number(barcode.cod) || 0), 0);
        next.dod = next.barcodes.reduce((sum, barcode) => sum + (Number(barcode.dod) || 0), 0);
        next.price = next.cod + next.dod;
        return next;
    };
}

async function prepare(helpers, sourceId, token) {
    const claim = await helpers.claimDeletedItemForRestore(sourceId, token, 'id_live');
    const item = restored(claim.item);
    await helpers.applyClaimedRestoreToHistory('id_live', sourceId, token, item, mergeIntoLive(item));
    return item;
}

async function expectError(work) {
    try {
        await work();
        return null;
    } catch (error) {
        return error && error.message;
    }
}

(async () => {
    for (const app of ['ZoeW']) {
        console.log('\n=== ' + app + ' restore claims ===');
        const shared = createSharedStore();
        const tabA = tabFor(app, shared, 'A');
        const tabB = tabFor(app, shared, 'B');

        shared.store.zoew_recently_deleted_cod_dod.id_concurrent = trashItem('id_concurrent');
        const concurrentItem = await prepare(tabA, 'id_concurrent', 'token-concurrent-a');
        const concurrentError = await expectError(() => tabB.claimDeletedItemForRestore('id_concurrent', 'token-concurrent-b', 'id_live'));
        check(concurrentError === 'RESTORE_IN_PROGRESS', app + ': simultaneous second tab cannot take active restore claim', concurrentError);
        await tabA.finalizeClaimedRestore('id_concurrent', 'token-concurrent-a', 'id_live', [{ scanDate: '2026-08-19', cod: 10, dod: 2, count: 1 }]);
        const concurrentDaily = shared.getPath('zoew_daily_revenue_cod_dod/2026-08-19');
        check(!shared.getPath('zoew_recently_deleted_cod_dod/id_concurrent') && concurrentDaily.codDollar === 10 && concurrentDaily.dodDollar === 2 && concurrentDaily.totalCount === 1,
            app + ': two-tab restore finalizes once and adds revenue once', JSON.stringify(concurrentDaily));
        await tabA.clearRestoreFinalization('id_concurrent', 'token-concurrent-a');

        const dailyBeforePending = clone(shared.getPath('zoew_daily_revenue_cod_dod/2026-08-19'));
        shared.store.zoew_recently_deleted_cod_dod.id_before_final = trashItem('id_before_final');
        await prepare(tabA, 'id_before_final', 'token-before-final');
        const pendingTrash = shared.getPath('zoew_recently_deleted_cod_dod/id_before_final');
        const pendingHistory = shared.getPath('zoew_scan_history_cod_dod/id_live');
        check(!!pendingTrash && pendingTrash.restoreClaim && pendingTrash.restoreClaim.token === 'token-before-final' &&
            pendingHistory.restoreClaimId === 'id_before_final' && pendingHistory.restoreClaimToken === 'token-before-final' &&
            JSON.stringify(dailyBeforePending) === JSON.stringify(shared.getPath('zoew_daily_revenue_cod_dod/2026-08-19')),
        app + ': crash before final fanout leaves recoverable trash and no revenue mutation', JSON.stringify({ pendingTrash, pendingHistory, daily: shared.getPath('zoew_daily_revenue_cod_dod/2026-08-19') }));

        shared.store.zoew_recently_deleted_cod_dod.id_takeover = trashItem('id_takeover');
        await prepare(tabA, 'id_takeover', 'token-old');
        shared.store.zoew_recently_deleted_cod_dod.id_takeover.restoreClaim.claimedAt = shared.now - tabA.RESTORE_CLAIM_LEASE_MS - 1;
        const newClaim = await tabB.claimDeletedItemForRestore('id_takeover', 'token-new', 'id_live');
        const newItem = restored(newClaim.item);
        await tabB.applyClaimedRestoreToHistory('id_live', 'id_takeover', 'token-new', newItem, mergeIntoLive(newItem));
        const beforeOldFinal = clone(shared.getPath('zoew_daily_revenue_cod_dod/2026-08-19'));
        const oldFinalError = await expectError(() => tabA.finalizeClaimedRestore('id_takeover', 'token-old', 'id_live', [{ scanDate: '2026-08-19', cod: 10, dod: 2, count: 1 }]));
        const afterOldFinal = shared.getPath('zoew_daily_revenue_cod_dod/2026-08-19');
        const takeoverTrash = shared.getPath('zoew_recently_deleted_cod_dod/id_takeover');
        check(oldFinalError === 'RESTORE_CLAIM_LOST' && JSON.stringify(beforeOldFinal) === JSON.stringify(afterOldFinal) &&
            takeoverTrash && takeoverTrash.restoreClaim.token === 'token-new',
        app + ': expired takeover rejects old-token fanout before new finalization', JSON.stringify({ oldFinalError, afterOldFinal, takeoverTrash }));

        await tabB.finalizeClaimedRestore('id_takeover', 'token-new', 'id_live', [{ scanDate: '2026-08-19', cod: 10, dod: 2, count: 1 }]);
        const afterNewFinal = clone(shared.getPath('zoew_daily_revenue_cod_dod/2026-08-19'));
        check(afterNewFinal.codDollar === beforeOldFinal.codDollar + 10 && afterNewFinal.dodDollar === beforeOldFinal.dodDollar + 2 &&
            afterNewFinal.totalCount === beforeOldFinal.totalCount + 1 && !shared.getPath('zoew_recently_deleted_cod_dod/id_takeover'),
        app + ': new-token fanout succeeds once after takeover', JSON.stringify(afterNewFinal));

        await tabB.clearRestoreFinalization('id_takeover', 'token-new');
        const staleAfterFinal = await expectError(() => tabA.finalizeClaimedRestore('id_takeover', 'token-old', 'id_live', [{ scanDate: '2026-08-19', cod: 10, dod: 2, count: 1 }]));
        const afterStaleRetry = shared.getPath('zoew_daily_revenue_cod_dod/2026-08-19');
        check(staleAfterFinal === null && JSON.stringify(afterNewFinal) === JSON.stringify(afterStaleRetry) && !shared.getPath('zoew_restore_finalizations/id_takeover'),
            app + ': stale token after new finalization cannot add a second revenue increment', JSON.stringify({ staleAfterFinal, afterStaleRetry }));

        const clearTarget = shared.getPath('zoew_scan_history_cod_dod/id_live');
        clearTarget.clearClaim = { token: 'clear-target', claimedAt: shared.now };
        const crossSource = restored(trashItem('id_cross_flow'));
        const selectedTarget = await tabA.findRestoreTargetId(crossSource);
        const blockedMerge = await tabA.applyClaimedRestoreToHistory('id_live', 'id_cross_flow', 'restore-cross-flow', crossSource, mergeIntoLive(crossSource));
        check(selectedTarget === 'id_cross_flow' && blockedMerge.targetChanged === true &&
            !shared.getPath('zoew_scan_history_cod_dod/id_live').barcodes.some((barcode) => barcode.code === 'id_cross_flow_BC'),
        app + ': restore excludes a Clear All claimed target and cannot merge into it', JSON.stringify({ selectedTarget, blockedMerge }));
        delete clearTarget.clearClaim;
        check(concurrentItem && newItem, app + ': real restore helper preparation completed', 'missing prepared item');
    }
    console.log('\n' + (fail ? 'FAIL ' + fail + '/' + (pass + fail) : 'PASS ' + pass + '/' + pass));
    process.exit(fail ? 1 : 0);
})().catch((error) => {
    console.error(error && error.stack || error);
    process.exit(1);
});
