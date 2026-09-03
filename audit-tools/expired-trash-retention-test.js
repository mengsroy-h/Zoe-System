const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = process.env.EXPIREDTRASH_APP_DIR ? path.resolve(process.env.EXPIREDTRASH_APP_DIR) : path.join(__dirname, '..');
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

function build(items) {
    const log = { batches: [], releasedClaims: [], releasedBarcodes: [], toasts: [] };
    const context = vm.createContext({
        console,
        Promise,
        Set,
        Map,
        setTimeout,
        clearTimeout,
        window: {},
        deletedItems: JSON.parse(JSON.stringify(items)),
        deletedCleanupInFlight: false,
        getServerNow: () => NOW,
        cleanupClockIsTrustworthy: () => true,
        activeRestoreClaims: new Map(),
        isActiveRestoreClaim: (claim) => !!(claim && NOW - claim.claimedAt < 2 * 60 * 1000),
        collectItemBarcodes: (item) => (item.barcodes || []).map((barcode) => barcode.code),
        releaseStaleRestoreClaimForPurge: async (id) => { log.releasedClaims.push(id); },
        purgeDeletedItemsQuietly: async (ids) => { log.batches.push(ids.slice()); },
        releaseBarcodesInRegistry: async (barcodes) => { log.releasedBarcodes.push(...barcodes); },
        showToast: (message) => { log.toasts.push(message); }
    });
    const code = [
        constant('EXPIRED_TRASH_RETENTION_MS'),
        constant('TRASH_RETENTION_MS'),
        // ⛔ ការ purge ត្រូវឆ្លងកាត់ពិដាន (`dbOp`) ដើម្បីកុំឲ្យសោសម្អាតជាប់
        // អស់កល្ប ➜ sandbox ត្រូវផ្ទុក **function ពិត** មិនមែន stub ទេ។
        constant('DB_OP_TIMEOUT_MS'),
        balancedFunction('withTimeout'),
        balancedFunction('dbOp'),
        balancedFunction('dbOpStalled'),
        optionalFunction('armLateWrite', 'function armLateWrite() { return false; }'),
        balancedFunction('trashRetentionMs'),
        balancedFunction('runAutomaticDeletedCleanup'),
        'globalThis.__run = runAutomaticDeletedCleanup;',
        'globalThis.__items = () => deletedItems;',
        'globalThis.__retention = trashRetentionMs;'
    ].join('\n');
    new vm.Script(code).runInContext(context);
    return { context, log };
}

(async () => {
    const seed = [
        { id: 'expired_boundary', trashReason: 'expired', deletedAt: NOW - 2 * DAY, barcodes: [{ code: 'EB' }] },
        { id: 'expired_old', trashReason: 'expired', deletedAt: NOW - 2 * DAY - 1, barcodes: [{ code: 'EO' }] },
        { id: 'expired_active', trashReason: 'expired', deletedAt: NOW - 3 * DAY, restoreClaim: { claimedAt: NOW - 30000 }, barcodes: [{ code: 'EA' }] },
        { id: 'expired_stale', trashReason: 'expired', deletedAt: NOW - 3 * DAY, restoreClaim: { claimedAt: NOW - 10 * 60 * 1000 }, barcodes: [{ code: 'ES' }] },
        { id: 'remove_young', trashReason: 'remove', deletedAt: NOW - 3 * DAY, barcodes: [{ code: 'RY' }] },
        { id: 'delete_young', trashReason: 'delete', deletedAt: NOW - 3 * DAY, barcodes: [{ code: 'DY' }] },
        { id: 'pickup_young', trashReason: 'pickup', deletedAt: NOW - 3 * DAY, barcodes: [{ code: 'PY' }] },
        { id: 'remove_old', trashReason: 'remove', deletedAt: NOW - 30 * DAY - 1, barcodes: [{ code: 'RO' }] },
        { id: 'delete_old', trashReason: 'delete', deletedAt: NOW - 30 * DAY - 1, barcodes: [{ code: 'DO' }] },
        { id: 'pickup_old', trashReason: 'pickup', deletedAt: NOW - 30 * DAY - 1, barcodes: [{ code: 'PO' }] },
        { id: 'legacy_remove', isFromDeletion: false, deletedAt: NOW - 3 * DAY, barcodes: [{ code: 'LR' }] }
    ];

    const world = build(seed);
    check(vm.runInContext('__retention({ trashReason: "expired" })', world.context) === 2 * DAY,
        'expired ប្រើ retention ២ ថ្ងៃ');
    check(vm.runInContext('__retention({ trashReason: "remove" })', world.context) === 30 * DAY,
        'remove ប្រើ retention ៣០ ថ្ងៃ');
    check(vm.runInContext('__retention({})', world.context) === 30 * DAY,
        'ទិន្នន័យ legacy មិនត្រូវសន្មត់ថា expired');

    await world.context.__run();
    const remaining = world.context.__items().map((item) => item.id).sort();
    const purged = world.log.batches.flat().sort();

    check(purged.includes('expired_old'), 'expired លើស ២ ថ្ងៃត្រូវ purge', purged);
    check(!purged.includes('expired_boundary') && remaining.includes('expired_boundary'),
        'expired ត្រឹម ២ ថ្ងៃពេញមិនទាន់ purge');
    check(!purged.includes('expired_active') && remaining.includes('expired_active'),
        'restore claim ដែលនៅរស់ការពារ expired មិនឱ្យ purge');
    check(purged.includes('expired_stale') && world.log.releasedClaims.includes('expired_stale'),
        'restore claim ដែលងាប់ត្រូវដោះមុន purge');
    check(['remove_young', 'delete_young', 'pickup_young', 'legacy_remove'].every((id) => remaining.includes(id)),
        'remove/delete/pickup/legacy នៅតែរក្សា ៣០ ថ្ងៃ', remaining);
    check(['remove_old', 'delete_old', 'pickup_old'].every((id) => purged.includes(id)),
        'remove/delete/pickup លើស ៣០ ថ្ងៃត្រូវ purge', purged);
    check(['EO', 'ES', 'RO', 'DO', 'PO'].every((code) => world.log.releasedBarcodes.includes(code)),
        'registry ត្រូវដោះតែ barcode ដែល purge ជោគជ័យ', world.log.releasedBarcodes);
    check(!world.log.releasedBarcodes.includes('EA') && !world.log.releasedBarcodes.includes('EB'),
        'registry មិនត្រូវដោះ barcode ដែលនៅរក្សាទុក', world.log.releasedBarcodes);

    console.log('\n' + pass + ' ok, ' + fail + ' fail');
    process.exit(fail ? 1 : 0);
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
