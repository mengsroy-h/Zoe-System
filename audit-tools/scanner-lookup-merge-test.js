const fs = require('fs');
const path = require('path');
const vm = require('vm');

let pass = 0;
let fail = 0;
const NOW = 1700000000000;
const PENDING_LEASE_MS = 2 * 60 * 1000;
const PENDING_FUTURE_SKEW_MS = 30 * 1000;

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
    return JSON.parse(JSON.stringify(value));
}

function contextEntries(entries) {
    if (Array.isArray(entries)) {
        return entries.map((barcode, index) => ({ barcode, index })).filter(({ barcode }) => barcode !== null && barcode !== undefined);
    }
    if (entries && typeof entries === 'object') {
        return Object.keys(entries)
            .filter((key) => /^\d+$/.test(key))
            .sort((a, b) => Number(a) - Number(b))
            .map((key) => ({ barcode: entries[key], index: Number(key) }))
            .filter(({ barcode }) => barcode !== null && barcode !== undefined);
    }
    return [];
}

function loadMerge(app) {
    const source = fs.readFileSync(path.join(__dirname, '..', app, 'app.js'), 'utf8');
    const start = source.indexOf('    function buildScannerLookupPayload(item, omitClosedState) {');
    const end = source.indexOf('    function clearScannerLookupEntry(itemId) {', start);
    if (start === -1 || end === -1) throw new Error(app + ': lookup merge block not found');
    const block = source.slice(start, end);
    const normalizeStart = source.indexOf('    function normalizeBarcodesOf(item) {');
    const normalizeEnd = source.indexOf('    function sanitizeInput(str) {', normalizeStart);
    if (normalizeStart === -1 || normalizeEnd === -1) throw new Error(app + ': barcode normalizer not found');
    const normalizeBlock = source.slice(normalizeStart, normalizeEnd);
    const context = vm.createContext({
        getServerNow: () => NOW,
        barcodeEntriesOf: (entries) => {
            if (Array.isArray(entries)) {
                return entries.map((barcode, index) => ({ barcode, index })).filter(({ barcode }) => barcode !== null && barcode !== undefined);
            }
            if (entries && typeof entries === 'object') {
                return Object.keys(entries)
                    .filter((key) => /^\d+$/.test(key))
                    .sort((a, b) => Number(a) - Number(b))
                    .map((key) => ({ barcode: entries[key], index: Number(key) }))
                    .filter(({ barcode }) => barcode !== null && barcode !== undefined);
            }
            return [];
        }
    });
    new vm.Script(`${block}\n${normalizeBlock}\nglobalThis.lookupMerge = { mergeScannerLookupPayload, buildScannerLookupPayload, normalizeBarcodesOf };`).runInContext(context);
    const saveEditedPhoneAt = source.indexOf('function saveEditedPhone()');
    const saveEditedPhoneBody = source.slice(saveEditedPhoneAt, saveEditedPhoneAt + 5000);
    const cleanupStart = source.indexOf('async function claimAndCleanupItem(');
    const cleanupEnd = source.indexOf('function barcodeRegistryKey(', cleanupStart);
    const cleanupBody = source.slice(cleanupStart, cleanupEnd);
    return { merge: context.lookupMerge.mergeScannerLookupPayload, build: context.lookupMerge.buildScannerLookupPayload, normalize: context.lookupMerge.normalizeBarcodesOf, saveEditedPhoneBody, cleanupBody, block };
}

for (const app of ['ZoeAdmin', 'ZoeW']) {
    console.log('\n=== ' + app + ' scanner lookup merge ===');
    const { merge, build, normalize, saveEditedPhoneBody, cleanupBody, block } = loadMerge(app);

    const currentBarcodeLookup = {
        id: 'id_lookup', phone: 'old', barcode: 'BC2', locker: 'old-top', isClosed: false,
        barcodes: [
            { code: 'BC2', locker: 'B2-new', lockerUpdatedAt: 400, lockerUpdatedBy: 'scanner-b', lockerRevision: 4 },
            {
                code: 'BC1', locker: 'B1-new', lockerUpdatedAt: 500, lockerUpdatedBy: 'scanner-a', lockerRevision: 8,
                lockerPending: { revision: 9, code: 'BC1', locker: 'B1-pending', updatedAt: NOW - 1000, updatedBy: 'scanner-pending' }
            }
        ]
    };
    const staleHistoryItem = {
        id: 'id_lookup', phone: 'new-phone', barcode: 'BC2', locker: 'stale-top', isClosed: false,
        barcodes: [
            { code: 'BC1', locker: 'B1-stale', lockerUpdatedAt: 100, isClosed: false },
            { code: 'BC2', locker: 'B2-stale', lockerUpdatedAt: 100, isClosed: false }
        ]
    };
    const mergedBarcode = merge(clone(currentBarcodeLookup), staleHistoryItem, false);
    const mergedBc1 = mergedBarcode.barcodes.find((barcode) => barcode.code === 'BC1');
    const mergedBc2 = mergedBarcode.barcodes.find((barcode) => barcode.code === 'BC2');
    check(mergedBarcode.phone === 'new-phone' && mergedBc1.locker === 'B1-new' && mergedBc1.lockerUpdatedAt === 500 &&
        mergedBc1.lockerUpdatedBy === 'scanner-a' && mergedBc1.lockerRevision === 8 &&
        JSON.stringify(mergedBc1.lockerPending) === JSON.stringify(currentBarcodeLookup.barcodes[1].lockerPending) &&
        mergedBc2.locker === 'B2-new' && mergedBc2.lockerRevision === 4,
    app + ': stale phone/full lookup sync keeps scanner barcode state by barcode code', JSON.stringify(mergedBarcode));
    check(!mergedBarcode.barcodes.some((barcode) => barcode.lockerPending && barcode.code !== 'BC1'),
        app + ': merge does not transfer pending state by array index', JSON.stringify(mergedBarcode.barcodes));

    const stalePendingLookup = clone(currentBarcodeLookup);
    stalePendingLookup.barcodes[1].lockerPending.updatedAt = NOW - PENDING_LEASE_MS - 1;
    const stalePendingMerged = merge(stalePendingLookup, staleHistoryItem, false);
    const stalePendingBc1 = stalePendingMerged.barcodes.find((barcode) => barcode.code === 'BC1');
    check(!stalePendingBc1.lockerPending && stalePendingBc1.locker === 'B1-new' && stalePendingBc1.lockerRevision === 8,
        app + ': expired barcode pending reservation is removed without replacing newer committed locker state', JSON.stringify(stalePendingBc1));

    const futurePendingLookup = clone(currentBarcodeLookup);
    futurePendingLookup.barcodes[1].lockerPending.updatedAt = NOW + PENDING_FUTURE_SKEW_MS + 1;
    const futurePendingMerged = merge(futurePendingLookup, staleHistoryItem, false);
    const futurePendingBc1 = futurePendingMerged.barcodes.find((barcode) => barcode.code === 'BC1');
    check(!futurePendingBc1.lockerPending,
        app + ': materially future barcode pending reservation is removed', JSON.stringify(futurePendingBc1));

    const currentLegacyLookup = {
        id: 'id_legacy', phone: 'old', barcode: 'LEGACY1', locker: 'L-new', lockerUpdatedAt: 700, lockerUpdatedBy: 'scanner-legacy',
        lockerAssignment: {
            revision: 6,
            pending: { revision: 7, code: 'LEGACY1', locker: 'L-pending', updatedAt: NOW - 1000, updatedBy: 'scanner-pending' }
        }
    };
    const staleLegacyHistory = { id: 'id_legacy', phone: 'new-phone', barcode: 'LEGACY1', locker: 'L-stale', lockerUpdatedAt: 10, lockerUpdatedBy: 'old', lockerRevision: 6 };
    const rebuiltLegacy = build(staleLegacyHistory, false);
    check(JSON.stringify(rebuiltLegacy.lockerAssignment) === JSON.stringify({ revision: 6 }) && !Object.prototype.hasOwnProperty.call(rebuiltLegacy, 'lockerRevision'),
        app + ': legacy lookup rebuild initializes its allowed assignment revision from live history', JSON.stringify(rebuiltLegacy));
    const mergedLegacy = merge(clone(currentLegacyLookup), staleLegacyHistory, false);
    check(mergedLegacy.phone === 'new-phone' && mergedLegacy.locker === 'L-new' && mergedLegacy.lockerUpdatedAt === 700 &&
        mergedLegacy.lockerUpdatedBy === 'scanner-legacy' &&
        JSON.stringify(mergedLegacy.lockerAssignment) === JSON.stringify(currentLegacyLookup.lockerAssignment) && !Object.prototype.hasOwnProperty.call(mergedLegacy, 'lockerRevision'),
    app + ': legacy lookup sync preserves only a fresh assignment aligned to history revision', JSON.stringify(mergedLegacy));

    const staleLegacyLookup = clone(currentLegacyLookup);
    staleLegacyLookup.lockerAssignment.pending.updatedAt = NOW - PENDING_LEASE_MS - 1;
    const staleLegacyMerged = merge(staleLegacyLookup, staleLegacyHistory, false);
    check(staleLegacyMerged.locker === 'L-stale' &&
        JSON.stringify(staleLegacyMerged.lockerAssignment) === JSON.stringify({ revision: 6 }),
    app + ': expired legacy pending reservation yields to authoritative history state', JSON.stringify(staleLegacyMerged));

    const sparseHistory = {
        id: 'id_sparse', phone: '0900000000', barcode: 'S0', locker: '', isClosed: false,
        barcodes: {
            0: { code: 'S0', locker: 'N/A', isClosed: false },
            2: { code: 'S2', locker: 'N/A', isClosed: false }
        }
    };
    normalize(sparseHistory);
    const sparsePayload = build(sparseHistory, false);
    const sparseEntries = contextEntries(sparsePayload.barcodes);
    check(sparseEntries.length === 2 && sparseEntries[0].index === 0 && sparseEntries[0].barcode.code === 'S0' &&
        sparseEntries[1].index === 2 && sparseEntries[1].barcode.code === 'S2',
    app + ': sparse live barcode keys retain their physical lookup slots after normalization', JSON.stringify(sparsePayload.barcodes));

    const sparseMerged = merge({ id: 'id_sparse', barcodes: { 0: { code: 'S0', locker: 'L0' }, 2: { code: 'S2', locker: 'L2' } } }, sparseHistory, false);
    const sparseMergedEntries = contextEntries(sparseMerged.barcodes);
    check(sparseMergedEntries.length === 2 && sparseMergedEntries[0].index === 0 && sparseMergedEntries[1].index === 2 &&
        sparseMergedEntries[1].barcode.code === 'S2',
    app + ': lookup sync keeps sparse physical slots while merging current scanner state', JSON.stringify(sparseMerged.barcodes));

    check(cleanupBody.includes('const committedRemainder = result.snapshot') && !cleanupBody.includes('syncScannerLookupEntry(id, updatedRemainder);'),
        app + ': cleanup sync reads the committed sparse shape rather than a pre-write normalized projection');
    check(saveEditedPhoneBody.includes('syncScannerLookupEntry(item.id, saved)'),
        app + ': saveEditedPhone syncs the committed server item rather than stale local data');
    check(!/currentIndex/.test(block) && !/index \}\) \|\| \{\}\)\.barcode/.test(block),
        app + ': barcode locker merge has no array-index fallback');
}

console.log('\n' + (fail ? 'FAIL ' + fail + '/' + (pass + fail) : 'PASS ' + pass + '/' + pass));
process.exit(fail ? 1 : 0);
