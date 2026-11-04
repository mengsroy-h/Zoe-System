const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = process.env.RETURNEDTRASH_APP_DIR ? path.resolve(process.env.RETURNEDTRASH_APP_DIR) : path.join(__dirname, '..');
const APP = path.join(ROOT, 'ZoeW', 'app.js');
const source = fs.readFileSync(APP, 'utf8').replace(/\r\n?/g, '\n');

let pass = 0;
let fail = 0;

function check(condition, label, detail) {
    if (condition) {
        pass++;
        console.log('  ok    ' + label);
    } else {
        fail++;
        console.log('  FAIL  ' + label + (detail === undefined ? '' : '  ' + JSON.stringify(detail)));
    }
}

function optionalFunction(name, fallback) {
    // ⛔ tree មុនកែគ្មាន helper ថ្មី ➜ ត្រូវ stub ជំនួសការគាំង ដើម្បីឲ្យការ
    // អះអាងឥរិយាបថនៅតែរត់ (មេរៀន 2.19.3 ៖ កុំបញ្ឈប់ checker)។
    try { return balancedFunction(name); } catch (e) { return fallback; }
}

function balancedFunction(name) {
    const marker = 'function ' + name + '(';
    let start = source.indexOf(marker);
    if (start === -1) throw new Error('function not found: ' + name);
    if (source.slice(Math.max(0, start - 6), start) === 'async ') start -= 6;
    const brace = source.indexOf('{', start);
    let depth = 0;
    for (let i = brace; i < source.length; i++) {
        if (source[i] === '{') depth++;
        else if (source[i] === '}') {
            depth--;
            if (depth === 0) return source.slice(start, i + 1);
        }
    }
    throw new Error('unbalanced function: ' + name);
}

function constant(name) {
    const match = source.match(new RegExp('^\\s*const ' + name + ' = ([^;]+);', 'm'));
    if (!match) throw new Error('constant not found: ' + name);
    return 'const ' + name + ' = ' + match[1] + ';';
}

const DAY = 24 * 60 * 60 * 1000;
const NOW = 1800000000000;

function build(items, ledgerDays, ledgerMonths, exitState = 'failed') {
    const log = { batches: [], releasedClaims: [], releasedBarcodes: [], releasedKeys: [], toasts: [], exits: [] };
    items = items.map(item => ({ ...item, count: item.count ?? item.barcodes.length,
        ...(item.restoreClaim ? { restoreClaim: { ...item.restoreClaim, token: 'fixture-restore', targetId: 'absent_target' } } : {}) }));
    const clone = value => JSON.parse(JSON.stringify(value));
    const store = { zoew_scan_history_cod_dod: {}, zoew_recently_deleted_cod_dod: Object.fromEntries(items.map(item => [item.id, clone(item)])),
        zoew_barcode_registry: Object.fromEntries(items.flatMap(item => item.barcodes.map(barcode => [barcode.code, true]))),
        zoew_daily_revenue_cod_dod: clone(ledgerDays || {}), zoew_monthly_revenue_cod_dod: clone(ledgerMonths || {}) };
    const get = raw => { let value = store; for (const key of String(raw || '').split('/').filter(Boolean)) value = value?.[key]; return value ?? null; };
    const set = (raw, value) => {
        const parts = raw.split('/'); let target = store;
        for (const key of parts.slice(0, -1)) target = target[key] ||= {};
        if (value !== null) { target[parts.at(-1)] = clone(value); return; }
        delete target[parts.at(-1)];
        // RTDB ៖ node ដែលគ្មានកូនលែងមាន ➜ purge តាម slot/វាល (F03) លុបជួរទាំងមូលដូច server ពិត
        for (let depth = parts.length - 1; depth > 0; depth--) {
            const parent = parts.slice(0, depth).reduce((node, part) => node && node[part], store);
            if (!parent || typeof parent !== 'object' || Object.keys(parent).length) break;
            delete parts.slice(0, depth - 1).reduce((node, part) => node[part], store)[parts[depth - 1]];
        }
    };
    const fb = {
        ref: (_db, path = '') => ({ path }),
        get: async ref => ({ val: () => clone(get(ref.path)) }),
        runTransaction: async (ref, update) => {
            const before = clone(get(ref.path)); const after = update(clone(before));
            if (after !== undefined) {
                if (before?.restoreClaim && !after?.restoreClaim) log.releasedClaims.push(ref.path.split('/').at(-1));
                set(ref.path, after);
            }
            return { committed: after !== undefined, snapshot: { val: () => clone(get(ref.path)) } };
        },
        update: async (ref, updates) => {
            for (const [key, value] of Object.entries(updates)) {
                const full = [ref.path, key].filter(Boolean).join('/'); set(full, value);
                if (value === null && /^zoew_recently_deleted_cod_dod\/[^/]+$/.test(full)) log.batches.push([full.split('/').at(-1)]);
                // purge តាម slot (F03) ៖ consumption ដែលសរសេរជាមួយការលុបវាល = ធាតុនោះត្រូវ purge
                if (value && /^zoew_trash_consumptions\/[^/]+$/.test(full) && value.kind === 'purge') log.batches.push([full.split('/').at(-1)]);
                if (value === null && full.startsWith('zoew_barcode_registry/')) log.releasedBarcodes.push(full.split('/').at(-1));
            }
        }
    };
    const context = vm.createContext({
        console,
        TextEncoder,
        Promise,
        Set,
        Map,
        setTimeout,
        clearTimeout,
        window: {},
        deletedItems: JSON.parse(JSON.stringify(items)),
        deletedCleanupInFlight: false,
        db: { app: { options: { databaseURL: 'https://retention.invalid' } } }, fb,
        auth: { currentUser: { uid: 'retention-user' } }, crypto: require('crypto').webcrypto,
        appLocalStore: { getItem: () => null }, ztoStatusLoaded: true, ztoPickupStatus: new Map(),
        authGeneration: 0,
        getServerNow: () => NOW,
        cleanupClockIsTrustworthy: () => true,
        activeRestoreClaims: new Map(),
        isActiveRestoreClaim: (claim) => !!(claim && NOW - claim.claimedAt < 2 * 60 * 1000),
        collectItemBarcodes: (item) => (item.barcodes || []).map((barcode) => barcode.code),
        // ⛔ 2.50.49 ៖ purge លុបសោដក `ded/<trashId>` ជាមួយ ➜ `cleanupLedgerKeyOf()` ពិត (ផ្ទុកខាងក្រោម) · អ្នកដោះសោកត់ទុកតែប៉ុណ្ណោះ
        releaseCleanupLedgerKeys: async (list) => { (list || []).forEach((c) => { if (c && c.ledgerKey) log.releasedKeys.push(c.id + '@' + c.ledgerKey.scanDate); }); },
        dailyRevenueData: JSON.parse(JSON.stringify(ledgerDays || {})),
        getFormattedDate: () => '2027-01-15',
        showToast: (message) => { log.toasts.push(message); },
        readCleanupJournal: () => [],
        cleanupJournalLive: new Map(),
        Date: { now: () => NOW },
        deductCleanupLedgerKeyed: async (item, rev) => {
            log.exits.push({ id: item.id, at: item.deletedAt, rev: JSON.parse(JSON.stringify(rev)) });
            if (exitState !== 'deducted') return exitState;
            const entry = { at: item.deletedAt, cod: rev.cod, dod: rev.dod, count: rev.count };
            set('zoew_daily_revenue_cod_dod/' + rev.scanDate + '/ded/' + item.id, entry);
            set('zoew_monthly_revenue_cod_dod/' + rev.scanDate.slice(0, 7) + '/ded/' + item.id, entry);
            return 'deducted';
        }
    });
    const runtime = require('./react-view').moduleRuntime(ROOT, source, [
        'src/domain/barcode-key.ts', 'src/domain/scan-protocol.ts', 'src/services/row-operation-lock.ts', 'src/domain/trash-generation.ts', 'src/core/shop-scope.ts',
        { path: 'src/domain/registry-purge-proof.ts', expose: ['REGISTRY_RELEASES_ROOT', 'REGISTRY_PURGE_MAX_WRITES', 'boundedRegistryPurgeIntent', 'slotRegistryPurgeIntent', 'registryPurgeReceiptValid', 'registryPurgeReceiptMatches', 'registryPurgeIntent'] },
        { path: 'src/services/registry-purge.ts', expose: ['purgeTrashWithRegistry'] }
    ]);
    const code = [
        'let deletedCleanupOwner = null, deletedCleanupCursor = null;',
        ...['deletedCleanupCurrent', 'releaseStaleRestoreClaimForPurge', 'barcodeEntriesOf', 'barcodeZtoSigned', 'getZtoPickupVerdict', 'pickupBarcodeKey', 'barcodeRegistryKey', 'loadZtoPickupStatusOnce', 'safeStoreGet', 'txRestUrl', 'txReadServerValue'].map(balancedFunction),
        constant('RETURNED_TRASH_RETENTION_MS'),
        constant('TRASH_RETENTION_MS'),
        // ⛔ ការ purge ត្រូវឆ្លងកាត់ពិដាន (`dbOp`) ដើម្បីកុំឲ្យសោសម្អាតជាប់
        // អស់កល្ប ➜ sandbox ត្រូវផ្ទុក **function ពិត** មិនមែន stub ទេ។
        constant('DB_OP_TIMEOUT_MS'),
        balancedFunction('withTimeout'),
        balancedFunction('dbOp'),
        balancedFunction('dbOpStalled'),
        optionalFunction('armLateWrite', 'function armLateWrite() { return false; }'),
        balancedFunction('trashRetentionMs'),
        optionalFunction('ledgerNumber', 'function ledgerNumber(v) { const n = parseFloat(v); return isFinite(n) ? n : 0; }'),
        optionalFunction('ledgerDedOf', 'function ledgerDedOf() { return null; }'),
        optionalFunction('cleanupEventAt', 'function cleanupEventAt() { return 0; }'),
        optionalFunction('cleanupScanDateOf', 'function cleanupScanDateOf(item) { return item && item.scanDate; }'),
        optionalFunction('cleanupLedgerKeyOf', 'function cleanupLedgerKeyOf() { return null; }'),
        ...['elapsedSince', 'itemHasRestoreMarkers', 'recalcItemMoneyFromBarcodes', 'readRestoreServerNode'].map(balancedFunction),
        constant('PURGE_DEDUCTION_RETRY_MS'),
        constant('PURGE_DEDUCTION_RETRY_MAX_MS'),
        constant('purgeDeductionWaits'),
        ...['purgeDeductionWaitKey', 'samePurgeOwner', 'notePurgeDeductionWait', 'settlePurgeDeduction', 'notePurgeDeductionHeld'].map(balancedFunction),
        balancedFunction('runAutomaticDeletedCleanup'),
        'globalThis.__run = runAutomaticDeletedCleanup;',
        'globalThis.__items = () => deletedItems;',
        'globalThis.__retention = trashRetentionMs;'
    ].join('\n');
    new vm.Script(runtime.code + '\n' + runtime.withoutBindings(code)).runInContext(context);
    return { context, log, store };
}

(async () => {
    // ធាតុ «ត្រឡប់» · «ដក» ដែលការកាត់ប្រាក់ចុះរួច មាន flag `isDeducted` (ឬ receipt ថ្ងៃ + ខែ) ➜ purge តាមរយៈរក្សា ·
    // គ្មាន flag គ្មាន receipt = ការកាត់មិនទាន់ដល់ (ឧបករណ៍ដែលដកមិនទាន់ resume) ➜ purge រង់ចាំ (copy រាប់ជា «មិនទាន់យក»)
    const seed = [
        { id: 'returned_boundary', trashReason: 'returned', deletedAt: NOW - 2 * DAY, barcodes: [{ code: 'EB', isDeducted: true }] },
        { id: 'returned_old', trashReason: 'returned', scanDate: '2027-01-05', deletedAt: NOW - 2 * DAY - 1, barcodes: [{ code: 'EO', isDeducted: true }] },
        { id: 'returned_otherkey', trashReason: 'returned', scanDate: '2027-01-05', deletedAt: NOW - 2 * DAY - 5, barcodes: [{ code: 'EK', isDeducted: true }] },
        { id: 'returned_active', trashReason: 'returned', deletedAt: NOW - 3 * DAY, restoreClaim: { claimedAt: NOW - 30000 }, barcodes: [{ code: 'EA', isDeducted: true }] },
        { id: 'returned_stale', trashReason: 'returned', deletedAt: NOW - 3 * DAY, restoreClaim: { claimedAt: NOW - 10 * 60 * 1000 }, barcodes: [{ code: 'ES', isDeducted: true }] },
        { id: 'returned_unsettled', trashReason: 'returned', scanDate: '2027-01-05', deletedAt: NOW - 3 * DAY, barcodes: [{ code: 'EU' }] },
        { id: 'returned_receipted', trashReason: 'returned', scanDate: '2027-01-05', deletedAt: NOW - 4 * DAY, barcodes: [{ code: 'ER' }] },
        { id: 'remove_young', trashReason: 'remove', deletedAt: NOW - 3 * DAY, barcodes: [{ code: 'RY', isDeducted: true }] },
        { id: 'delete_young', trashReason: 'delete', deletedAt: NOW - 3 * DAY, barcodes: [{ code: 'DY' }] },
        { id: 'pickup_young', trashReason: 'pickup', deletedAt: NOW - 3 * DAY, barcodes: [{ code: 'PY' }] },
        { id: 'remove_old', trashReason: 'remove', deletedAt: NOW - 30 * DAY - 1, barcodes: [{ code: 'RO', isDeducted: true }] },
        { id: 'remove_unsettled', trashReason: 'remove', scanDate: '2027-01-05', deletedAt: NOW - 30 * DAY - 1, barcodes: [{ code: 'RU', cod: 4, dod: 1.5 }, { code: 'RF', cod: 9, isDeducted: true }] },
        { id: 'returned_otherkey_unsettled', trashReason: 'returned', scanDate: '2027-01-05', deletedAt: NOW - 3 * DAY - 7, barcodes: [{ code: 'EX', cod: 2.25 }] },
        { id: 'delete_old', trashReason: 'delete', deletedAt: NOW - 30 * DAY - 1, barcodes: [{ code: 'DO' }] },
        { id: 'pickup_old', trashReason: 'pickup', deletedAt: NOW - 30 * DAY - 1, barcodes: [{ code: 'PO' }] },
        { id: 'legacy_remove', isFromDeletion: false, deletedAt: NOW - 3 * DAY, barcodes: [{ code: 'LR' }] }
    ];

    const ledgerDays = { '2027-01-05': { codDollar: 9, dodDollar: 0, totalCount: 3, ded: {
        returned_old: { at: NOW - 2 * DAY - 1, cod: 1.25, dod: 0, count: 1 },
        returned_otherkey: { at: NOW - 9 * DAY, cod: 2, dod: 0, count: 1 },
        returned_otherkey_unsettled: { at: NOW - 9 * DAY, cod: 2.25, dod: 0, count: 1 },
        pickup_old: { at: NOW - 30 * DAY - 1, cod: 3, dod: 0, count: 1 },
        returned_receipted: { at: NOW - 4 * DAY, cod: 1, dod: 0, count: 1 }
    } } };
    const ledgerMonths = { '2027-01': { codDollar: 9, dodDollar: 0, totalCount: 3, ded: {
        returned_receipted: { at: NOW - 4 * DAY, cod: 1, dod: 0, count: 1 }
    } } };
    const world = build(seed, ledgerDays, ledgerMonths);
    check(vm.runInContext('__retention({ trashReason: "returned" })', world.context) === 2 * DAY,
        'returned ប្រើ retention ២ ថ្ងៃ');
    check(vm.runInContext('__retention({ trashReason: "remove" })', world.context) === 30 * DAY,
        'remove ប្រើ retention ៣០ ថ្ងៃ');
    check(vm.runInContext('__retention({})', world.context) === 30 * DAY,
        'ទិន្នន័យ legacy មិនត្រូវសន្មត់ថា returned');

    const hasKeyFnEarly = /function cleanupLedgerKeyOf\(/.test(source);
    await world.context.__run();
    const remaining = world.context.__items().map((item) => item.id).sort();
    const purged = world.log.batches.flat().sort();

    check(purged.includes('returned_old'), 'returned លើស ២ ថ្ងៃត្រូវ purge', purged);
    check(!purged.includes('returned_boundary') && remaining.includes('returned_boundary'),
        'returned ត្រឹម ២ ថ្ងៃពេញមិនទាន់ purge');
    check(!purged.includes('returned_active') && remaining.includes('returned_active'),
        'restore claim ដែលនៅរស់ការពារ returned មិនឱ្យ purge');
    check(purged.includes('returned_stale') && world.log.releasedClaims.includes('returned_stale'),
        'restore claim ដែលងាប់ត្រូវដោះមុន purge');
    check(['remove_young', 'delete_young', 'pickup_young', 'legacy_remove'].every((id) => remaining.includes(id)),
        'remove/delete/pickup/legacy នៅតែរក្សា ៣០ ថ្ងៃ', remaining);
    check(['remove_old', 'delete_old', 'pickup_old'].every((id) => purged.includes(id)),
        'remove/delete/pickup លើស ៣០ ថ្ងៃត្រូវ purge', purged);
    check(['EO', 'ES', 'RO', 'DO', 'PO'].every((code) => world.log.releasedBarcodes.includes(code)),
        'registry ត្រូវដោះតែ barcode ដែល purge ជោគជ័យ', world.log.releasedBarcodes);
    check(!world.log.releasedBarcodes.includes('EA') && !world.log.releasedBarcodes.includes('EB'),
        'registry មិនត្រូវដោះ barcode ដែលនៅរក្សាទុក', world.log.releasedBarcodes);
    const UNSETTLED = ['returned_otherkey_unsettled', 'returned_unsettled', 'remove_unsettled'];
    check(UNSETTLED.every((id) => remaining.includes(id) && !purged.includes(id))
        && !['EU', 'RU', 'RF', 'EX'].some(code => world.log.releasedBarcodes.includes(code)),
        '⛔ «ត្រឡប់» · «ដក» ដែលការកាត់មិនទាន់ដល់ ហើយការដកនៃផ្លូវចេញមិនចុះ ➜ មិន purge ហើយ registry នៅ (សោ `at` ផ្សេងមិនមែនភស្តុតាង)', { remaining, purged });
    check(JSON.stringify(world.log.exits.map(exit => [exit.id, exit.rev]).sort()) === JSON.stringify([
        ['remove_unsettled', { scanDate: '2027-01-05', cod: 4, dod: 1.5, count: 1 }],
        ['returned_otherkey_unsettled', { scanDate: '2027-01-05', cod: 2.25, dod: 0, count: 1 }],
        ['returned_unsettled', { scanDate: '2027-01-05', cod: 0, dod: 0, count: 1 }]]),
        'ផ្លូវចេញ (A522) ដកតែធាតុមិនទាន់កាត់ដែលផុតរយៈរក្សា ៖ ចំនួនពី barcode គ្មាន flag ប៉ុណ្ណោះ (ធាតុដែលកាត់រួច · ក្នុងរយៈរក្សា · pickup · delete មិនដក)', world.log.exits);
    const before = world.log.exits.length;
    await world.context.__run();
    check(world.log.exits.length === before, 'ការដកដែលបរាជ័យរង់ចាំ `PURGE_DEDUCTION_RETRY_MS` (មិនព្យាយាមរៀងរាល់ cycle)', world.log.exits.length - before);
    const settled = build(seed, ledgerDays, ledgerMonths, 'deducted');
    await settled.context.__run();
    const settledPurged = settled.log.batches.flat();
    check(UNSETTLED.every(id => settledPurged.includes(id)) && ['EU', 'RU', 'RF', 'EX'].every(code => settled.log.releasedBarcodes.includes(code))
        && settled.log.exits.length === 3,
        'ផ្លូវចេញ ៖ ការដកចុះ (receipt ថ្ងៃ + ខែ `at` = `deletedAt`) ➜ purge copy ហើយដោះ registry ក្នុង cycle ដដែល', { settledPurged, exits: settled.log.exits.length });
    check(!hasKeyFnEarly || ['returned_otherkey_unsettled@2027-01-05', 'returned_unsettled@2027-01-05'].every(key => settled.log.releasedKeys.includes(key))
        && !settled.log.releasedKeys.some(key => key.startsWith('remove_unsettled')),
        'ផ្លូវចេញ ៖ purge ដោះសោ `ded` ថ្ងៃតែរបស់ returned (ដូចផ្លូវធម្មតា)', settled.log.releasedKeys);
    check(purged.includes('returned_receipted') && world.log.releasedBarcodes.includes('ER'),
        'receipt ថ្ងៃ និងខែដែល `at` ត្រូវ = ការកាត់ដល់ ➜ purge បានទោះ flag មិនទាន់ flip', purged);
    check(!world.log.toasts.some((message) => message.includes('ធុងសំរាមចាស់ខ្លះ')),
        'ការរង់ចាំការកាត់មិនបង្ហាញ toast រៀងរាល់ cycle', world.log.toasts);
    // ⛔ សោដកដោះតែរបស់ព្រឹត្តិការណ៍ដដែល (`at` = `deletedAt`) របស់ធុងសំរាម `returned` ដែល purge ពិត · សោដែល `at` ផ្សេង (ព្រឹត្តិការណ៍មុន) និង `pickup` មិនប៉ះ
    check(purged.every(id => world.store.zoew_trash_consumptions?.[id]?.kind === 'purge'
        && world.store.zoew_trash_consumptions[id].sourceId === id),
        'actual atomic purge writes a consumption witness for every removed source');
    check(world.log.releasedBarcodes.every(code => Object.values(world.store.zoew_registry_releases || {}).some(receipt => receipt.code === code && receipt.v === 2)),
        'actual atomic purge retains a v2 release receipt for every removed registry key');
    const invalid = build([{ id: 'invalid_count', trashReason: 'returned', deletedAt: NOW - 3 * DAY, count: 9, barcodes: [{ code: 'INVALID' }] }]);
    await invalid.context.__run();
    check(invalid.store.zoew_recently_deleted_cod_dod.invalid_count && invalid.store.zoew_barcode_registry.INVALID === true
        && invalid.log.batches.length === 0, 'malformed purge basis stays held without deleting source or registry');
    const hasKeyFn = /function cleanupLedgerKeyOf\(/.test(source);
    check(!hasKeyFn || JSON.stringify(world.log.releasedKeys.slice().sort()) === JSON.stringify(['returned_old@2027-01-05', 'returned_receipted@2027-01-05']),
        'purge ➜ ដោះសោដក `ded` តែរបស់ returned ដែល purge ពិត ហើយ `at` ត្រូវ (មិនមែន at ផ្សេង · មិនមែន pickup)', world.log.releasedKeys);
    check(!hasKeyFn || purged.includes('returned_otherkey'), 'សោ `at` ផ្សេង មិនរារាំង purge របស់ធុងសំរាម', purged);

    console.log('\n' + pass + ' ok, ' + fail + ' fail');
    process.exit(fail ? 1 : 0);
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
