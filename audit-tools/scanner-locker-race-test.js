const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'Zoescan', 'app.js'), 'utf8');
const rules = JSON.parse(fs.readFileSync(path.join(root, 'firebase-database.rules.json'), 'utf8'));
const MAX_LOCKER_REVISION = 9007199254740990;

let pass = 0;
let fail = 0;
function ok(label, condition, detail) {
    if (condition) {
        console.log('   ok    ' + label);
        pass++;
    } else {
        console.log('  FAIL   ' + label + (detail ? '  got: ' + detail : ''));
        fail++;
    }
}

function extractFunction(source, marker) {
    const start = source.indexOf(marker);
    if (start === -1) throw new Error('រកមិនឃើញ ' + marker);
    let depth = 0;
    let opened = false;
    for (let i = source.indexOf('{', start); i < source.length; i++) {
        if (source[i] === '{') {
            depth++;
            opened = true;
        } else if (source[i] === '}') {
            depth--;
            if (opened && depth === 0) return source.slice(start, i + 1);
        }
    }
    throw new Error('function បិទមិនគ្រប់');
}

function clone(value) {
    return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function pathParts(value) {
    return String(value || '').split('/').filter(Boolean);
}

function getAt(rootValue, location) {
    let current = rootValue;
    for (const part of pathParts(location)) {
        if (current === null || current === undefined || typeof current !== 'object') return null;
        current = current[part];
    }
    return current === undefined ? null : current;
}

function setAt(rootValue, location, value) {
    const parts = pathParts(location);
    if (!parts.length) throw new Error('root write មិនត្រូវបានអនុញ្ញាតក្នុង test');
    let current = rootValue;
    for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!current[part] || typeof current[part] !== 'object') current[part] = {};
        current = current[part];
    }
    const last = parts[parts.length - 1];
    if (value === null) delete current[last];
    else current[last] = clone(value);
}

function applyUpdates(rootValue, updates) {
    Object.keys(updates).forEach((location) => setAt(rootValue, location, updates[location]));
}

function snapshot(value) {
    const stored = clone(value);
    return { val: () => clone(stored) };
}

function protectedFieldsUnchanged(before, after) {
    return ['cod', 'dod', 'code', 'isClosed', 'isDeducted', 'isFromDeletion', 'time', 'createdAt']
        .every((field) => before[field] === after[field]);
}

function legacyAssignmentShapeAllowed(lookupItem, historyItem) {
    return !lookupItem.barcodes && !historyItem.barcodes && lookupItem.barcode === historyItem.barcode;
}

function barcodeAssignmentShapeAllowed(lookupBarcode, historyBarcodes, index) {
    const historyBarcode = historyBarcodes && historyBarcodes[index];
    return !!lookupBarcode && !!historyBarcode && lookupBarcode.code === historyBarcode.code;
}

function validLockerName(value) {
    const locker = String(value || '').trim();
    return locker.length > 0 && locker.length <= 64 && locker.toUpperCase() !== 'N/A';
}

function safeRevision(value, minimum) {
    return Number.isInteger(value) && value >= minimum && value <= MAX_LOCKER_REVISION;
}

function nextReservationRevision(committedRevision, pendingRevision) {
    const committed = safeRevision(committedRevision, 0) ? committedRevision : 0;
    const pending = safeRevision(pendingRevision, 1) && pendingRevision > committed ? pendingRevision : committed;
    return pending + 1;
}

function scannerReservationAllowed({ historyRevision, lookupRevision, pendingRevision, locker, updatedBy, authUid, updatedAt, now }) {
    return historyRevision === lookupRevision && safeRevision(lookupRevision, 0) &&
        pendingRevision === nextReservationRevision(lookupRevision, undefined) && pendingRevision <= MAX_LOCKER_REVISION &&
        validLockerName(locker) && updatedBy === authUid && updatedAt >= now - 30000 && updatedAt <= now + 30000;
}

function makeHarness(legacy) {
    const barcode = {
        code: legacy ? 'LEGACY-RACE' : 'RACE-1',
        cod: 8,
        dod: 2,
        locker: 'N/A',
        isClosed: false,
        isDeducted: false,
        isFromDeletion: false,
        time: '10:00',
        createdAt: 100
    };
    const historyItem = {
        id: 'it1',
        phone: '012345678',
        barcode: barcode.code,
        locker: 'N/A',
        isClosed: false,
        ...(legacy ? {} : { barcodes: [clone(barcode)] })
    };
    const lookupItem = {
        id: 'it1',
        phone: '012345678',
        barcode: barcode.code,
        locker: 'N/A',
        isClosed: false,
        ...(legacy ? {} : { barcodes: [{ code: barcode.code, locker: 'N/A', isClosed: false }] })
    };
    const store = {
        zoew_scanner_lookup: { it1: lookupItem },
        zoew_scan_history_cod_dod: { it1: historyItem }
    };
    const state = { accepted: 0, rejected: 0, toasts: [] };

    function validFinal(candidate) {
        const lookupPath = legacy
            ? 'zoew_scanner_lookup/it1/lockerAssignment'
            : 'zoew_scanner_lookup/it1/barcodes/0';
        const beforeLookup = getAt(store, lookupPath);
        const afterLookup = getAt(candidate, lookupPath);
        const pending = legacy ? beforeLookup && beforeLookup.pending : beforeLookup && beforeLookup.lockerPending;
        if (!pending || !afterLookup) return false;
        if (legacy) {
            const afterHistory = getAt(candidate, 'zoew_scan_history_cod_dod/it1');
            const afterItem = getAt(candidate, 'zoew_scanner_lookup/it1');
            return afterLookup.revision === pending.revision && !afterLookup.pending &&
                afterItem.locker === pending.locker && afterItem.lockerUpdatedAt === pending.updatedAt && afterItem.lockerUpdatedBy === pending.updatedBy &&
                afterHistory.barcode === pending.code && afterHistory.locker === pending.locker &&
                afterHistory.lockerUpdatedAt === pending.updatedAt && afterHistory.lockerUpdatedBy === pending.updatedBy && afterHistory.lockerRevision === pending.revision;
        }
        const beforeHistory = getAt(store, 'zoew_scan_history_cod_dod/it1/barcodes/0');
        const afterHistory = getAt(candidate, 'zoew_scan_history_cod_dod/it1/barcodes/0');
        return !afterLookup.lockerPending && afterLookup.code === pending.code &&
            afterLookup.locker === pending.locker && afterLookup.lockerUpdatedAt === pending.updatedAt &&
            afterLookup.lockerUpdatedBy === pending.updatedBy && afterLookup.lockerRevision === pending.revision &&
            afterHistory && protectedFieldsUnchanged(beforeHistory, afterHistory) &&
            afterHistory.code === pending.code && afterHistory.locker === pending.locker &&
            afterHistory.lockerUpdatedAt === pending.updatedAt && afterHistory.lockerUpdatedBy === pending.updatedBy &&
            afterHistory.lockerRevision === pending.revision;
    }

    const context = {
        console: { log: console.log, error: () => {} },
        Promise,
        Math,
        Number,
        Error,
        setTimeout,
        db: {},
        activeLocker: 'L1',
        currentUserId: 'scanner-a-uid',
        barcodeIndex: {},
        getServerNow: () => 1700000000000,
        isValidLockerName: (value) => {
            const locker = String(value || '').trim();
            return locker.length > 0 && locker.length <= 64 && locker.toUpperCase() !== 'N/A';
        },
        getEntryCurrentLocker: (entry) => entry.barcodeIdx === null
            ? entry.item.locker
            : entry.item.barcodes[entry.barcodeIdx].locker,
        sanitizePhoneNumber: (value) => String(value || ''),
        withTimeout: (promise) => promise,
        playErrorFeedback: () => {},
        playSuccessFeedback: () => {},
        showToast: (message) => state.toasts.push(message),
        window: { ZoeErrors: null }
    };
    context.barcodeIndex[barcode.code] = { itemId: 'it1', barcodeIdx: legacy ? null : 0, item: lookupItem };
    context.window.firebaseSDK = {
        ref: (_db, location) => ({ path: location || '' }),
        runTransaction: (reference, updater) => {
            const current = clone(getAt(store, reference.path));
            const next = updater(current);
            if (next === undefined) return Promise.resolve({ committed: false, snapshot: snapshot(current) });
            setAt(store, reference.path, next);
            return Promise.resolve({ committed: true, snapshot: snapshot(next) });
        },
        update: (_reference, updates) => {
            const revision = legacy
                ? updates['zoew_scanner_lookup/it1/lockerAssignment/revision']
                : updates['zoew_scanner_lookup/it1/barcodes/0/lockerRevision'];
            const delay = revision === 1 ? 30 : 0;
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    const candidate = clone(store);
                    applyUpdates(candidate, updates);
                    if (!validFinal(candidate)) {
                        state.rejected++;
                        reject(new Error('PERMISSION_DENIED: stale locker reservation'));
                        return;
                    }
                    applyUpdates(store, updates);
                    state.accepted++;
                    resolve();
                }, delay);
            });
        }
    };
    vm.createContext(context);
    vm.runInContext('let assignGeneration = 0;\n' + extractFunction(appSource, 'async function assignLockerToEntry('), context);
    return { store, state, context, code: barcode.code };
}

async function race(legacy) {
    const harness = makeHarness(legacy);
    const assign = vm.runInContext('assignLockerToEntry', harness.context);
    const first = assign(harness.code);
    harness.context.activeLocker = 'L2';
    harness.context.currentUserId = 'scanner-b-uid';
    const second = assign(harness.code);
    await Promise.all([first, second]);
    await new Promise((resolve) => setTimeout(resolve, 45));

    const lookup = harness.store.zoew_scanner_lookup.it1;
    const history = harness.store.zoew_scan_history_cod_dod.it1;
    const finalLookup = legacy ? lookup : lookup.barcodes[0];
    const finalHistory = legacy ? history : history.barcodes[0];
    const finalState = legacy ? lookup.lockerAssignment : finalLookup;
    const pending = legacy ? finalState.pending : finalState.lockerPending;
    const label = legacy ? 'legacy' : 'barcode';
    ok(label + ': scanner ទីពីរឈ្នះ ទោះ timestamp ដូចគ្នា',
        finalLookup.locker === 'L2' && finalHistory.locker === 'L2' && finalLookup.lockerUpdatedAt === 1700000000000 && finalHistory.lockerUpdatedAt === 1700000000000,
        JSON.stringify({ finalLookup, finalHistory }));
    ok(label + ': មានតែ atomic final មួយត្រូវបានទទួល', harness.state.accepted === 1 && harness.state.rejected === 1,
        JSON.stringify(harness.state));
    ok(label + ': reservation ចាស់មិនទុក split-brain ឬ pending ជាប់',
        !pending && (legacy ? finalState.revision === 2 : finalLookup.lockerRevision === 2), JSON.stringify(finalState));
    if (!legacy) {
        ok('barcode: protected fields នៅដដែល',
            finalHistory.cod === 8 && finalHistory.dod === 2 && finalHistory.code === 'RACE-1' && finalHistory.isClosed === false,
            JSON.stringify(finalHistory));
    }
}

console.log('-- Rule shape សម្រាប់ locker protocol --');
const historyItemRules = rules.rules.zoew_scan_history_cod_dod.$itemId;
const lookupItemRules = rules.rules.zoew_scanner_lookup.$itemId;
const historyBarcodeWrite = historyItemRules.barcodes.$idx['.write'];
const lookupBarcodeWrite = lookupItemRules.barcodes.$idx['.write'];
const legacyWrite = lookupItemRules.lockerAssignment['.write'];
ok('scanner មិនទទួល parent write លើ history', !historyItemRules['.write'].includes("=== 'scanner'"));
ok('scanner មិនទទួល parent write លើ lookup', !lookupItemRules['.write'].includes("=== 'scanner'"));
ok('barcode final ចង pending, revision និង mirror',
    historyBarcodeWrite.includes('lockerPending') && historyBarcodeWrite.includes('lockerRevision') && lookupBarcodeWrite.includes('zoew_scan_history_cod_dod'));
ok('legacy final ចង state pending និង mirror',
    legacyWrite.includes("child('pending')") && legacyWrite.includes('zoew_scan_history_cod_dod'));
ok('lookup legacy ចាស់ មិនអាចកែ history ដែលមាន barcodes[]',
    legacyWrite.includes("!root.child('zoew_scan_history_cod_dod').child($itemId).child('barcodes').exists()") &&
    legacyWrite.includes("child('barcode').val() === data.parent().child('barcode').val()") &&
    !legacyAssignmentShapeAllowed({ barcode: 'LEGACY' }, { barcodes: [{ code: 'ARRAY-1' }] }) &&
    !legacyAssignmentShapeAllowed({ barcode: 'LOOKUP' }, { barcode: 'HISTORY' }));
ok('lookup barcode index/code ត្រូវត្រូវនឹង history មុន reserve',
    lookupBarcodeWrite.includes("root.child('zoew_scan_history_cod_dod').child($itemId).child('barcodes').child($idx).exists()") &&
    lookupBarcodeWrite.includes("child('barcodes').child($idx).child('code').val() === data.child('code').val()") &&
    !barcodeAssignmentShapeAllowed({ code: 'B' }, [{ code: 'A' }, null, { code: 'B' }], 1) &&
    barcodeAssignmentShapeAllowed({ code: 'B' }, [{ code: 'A' }, null, { code: 'B' }], 2));
ok('locker revision ទទួលតែ integer ដើម្បីមិនអាច block transaction',
    historyItemRules.barcodes.$idx.lockerRevision['.validate'].includes('% 1 === 0') &&
    lookupItemRules.barcodes.$idx.lockerRevision['.validate'].includes('% 1 === 0') &&
    lookupItemRules.barcodes.$idx.lockerPending['.validate'].includes('% 1 === 0') &&
    lookupItemRules.lockerAssignment['.validate'].includes('% 1 === 0'));
ok('revision ត្រូវឡើងត្រឹមមួយ និងមិនលើស JS safe cap',
    lookupBarcodeWrite.includes("child('revision').val() + 1") &&
    legacyWrite.includes("child('revision').val() + 1") &&
    lookupBarcodeWrite.includes(String(MAX_LOCKER_REVISION)) &&
    legacyWrite.includes(String(MAX_LOCKER_REVISION)) &&
    !scannerReservationAllowed({ historyRevision: 2, lookupRevision: 2, pendingRevision: 9007199254740990, locker: 'L1', updatedBy: 'scanner-uid', authUid: 'scanner-uid', updatedAt: 1700000000000, now: 1700000000000 }));
ok('prewrite revision drift, forged actor/time និង N/A ត្រូវបានបដិសេធ',
    lookupBarcodeWrite.includes("child('lockerRevision').val() : 0) ===") &&
    legacyWrite.includes("child('lockerRevision').val() : 0) ===") &&
    lookupBarcodeWrite.includes("child('updatedBy').val() === auth.uid") &&
    legacyWrite.includes("child('updatedBy').val() === auth.uid") &&
    lookupBarcodeWrite.includes('now - 120000') && legacyWrite.includes('now - 120000') &&
    lookupBarcodeWrite.includes('now + 30000') && legacyWrite.includes('now + 30000') &&
    !scannerReservationAllowed({ historyRevision: 5, lookupRevision: 2, pendingRevision: 3, locker: 'L1', updatedBy: 'scanner-uid', authUid: 'scanner-uid', updatedAt: 1700000000000, now: 1700000000000 }) &&
    !scannerReservationAllowed({ historyRevision: 2, lookupRevision: 2, pendingRevision: 3, locker: 'N/A', updatedBy: 'scanner-uid', authUid: 'scanner-uid', updatedAt: 1700000000000, now: 1700000000000 }) &&
    !scannerReservationAllowed({ historyRevision: 2, lookupRevision: 2, pendingRevision: 3, locker: 'L1', updatedBy: 'forged', authUid: 'scanner-uid', updatedAt: 1700000000000, now: 1700000000000 }) &&
    !scannerReservationAllowed({ historyRevision: 2, lookupRevision: 2, pendingRevision: 3, locker: 'L1', updatedBy: 'scanner-uid', authUid: 'scanner-uid', updatedAt: 1700000030001, now: 1700000000000 }));
ok('legacy final mirror មាន history revision ថ្មី',
    historyItemRules.lockerRevision && historyItemRules.lockerRevision['.validate'].includes(String(MAX_LOCKER_REVISION)) &&
    appSource.includes('`${historyBase}/lockerRevision`] = revision'));
ok('scanner UI បដិសេធ Locker ទទេ, N/A និងវែងពេក',
    appSource.includes('function isValidLockerName') &&
    !validLockerName('') && !validLockerName(' N/A ') && !validLockerName(' '.repeat(65)) && validLockerName('L-64'));
ok('Zoescan ប្រើ transaction មុន atomic mirror update',
    appSource.includes('runTransaction(window.firebaseSDK.ref(db, reservationPath)') && appSource.includes('update(window.firebaseSDK.ref(db), buildAssignmentUpdates(pending.revision))'));

(async () => {
    console.log('-- race ពិតតាម assignLockerToEntry --');
    await race(false);
    await race(true);
    console.log('');
    if (fail) {
        console.log('❌ ' + fail + ' បរាជ័យ / ' + pass + ' ជោគជ័យ');
        process.exit(1);
    }
    console.log('✅ ការធ្វើតេស្ត locker race ទាំងអស់ជោគជ័យ (' + pass + ')');
})().catch((error) => {
    console.error(error && error.stack ? error.stack : error);
    process.exit(1);
});
