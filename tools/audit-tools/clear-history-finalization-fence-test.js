const fs = require('fs');
const path = require('path');

// ថត app អាច override បាន ដើម្បីឲ្យ `run-all.sh <baseline>` និង
// `checker-coverage.js` បញ្ជាក់បានថា checker នេះពិតជាអានកូដមែន។
const root = process.env.CLEARFENCE_APP_DIR ? path.resolve(process.env.CLEARFENCE_APP_DIR) : path.resolve(__dirname, '../..');
const rules = JSON.parse(fs.readFileSync(path.join(root, 'firebase-database.rules.json'), 'utf8'));
// Match rule ASTs after equivalent child-path/hasChild and Boolean grouping
// normalization, without depending on whitespace or compressed path spelling.
const { parseExpression } = require(path.join(root, 'supabase/scripts/rtdb-expression.cjs'));
function ruleGuard(expression, fragment) {
    const normalize = node => {
        if (!node || typeof node !== 'object') return node;
        if (Array.isArray(node)) return node.map(normalize);
        if (node.t === 'm' && node.n === 'hasChild') return normalize({ t: 'm', n: 'exists',
            o: { t: 'm', n: 'child', o: node.o, a: node.a }, a: [] });
        if (node.t === 'm' && node.n === 'child') {
            const parts = n => n.t === 'l' && typeof n.v === 'string' ? n.v : n.t === 'v' ? '\u0001' + n.n + '\u0001'
                : n.t === 'b' && n.o === '+' && parts(n.l) !== null && parts(n.r) !== null ? parts(n.l) + parts(n.r) : null;
            const joined = parts(node.a[0]);
            if (joined !== null) {
                const segments = joined.split('/').filter(Boolean);
                if (segments.every(p => !p.includes('\u0001') || /^\u0001\$[A-Za-z0-9_]+\u0001$/.test(p))) {
                    return segments.reduce((out, p) => ({ t: 'm', n: 'child', o: out,
                        a: [p.startsWith('\u0001') ? { t: 'v', n: p.slice(1, -1) } : { t: 'l', v: p }] }), normalize(node.o));
                }
            }
        }
        if (node.t === '&&' || node.t === '||') {
            const ordered = n => n.t === node.t ? [...ordered(n.l), ...ordered(n.r)] : [normalize(n)];
            return { t: node.t, ordered: ordered(node) };
        }
        return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, normalize(v)]));
    };
    const scope = ['$itemId', '$sourceId', '$idx'];
    const wanted = normalize(parseExpression(fragment, scope)), needle = JSON.stringify(wanted);
    const visit = node => {
        if (!node || typeof node !== 'object') return false;
        if (JSON.stringify(node) === needle) return true;
        if (wanted.ordered && node.t === wanted.t && node.ordered?.some((_, i) =>
            JSON.stringify(node.ordered.slice(i, i + wanted.ordered.length)) === JSON.stringify(wanted.ordered))) return true;
        return Object.values(node).some(value => Array.isArray(value) ? value.some(visit) : visit(value));
    };
    return visit(normalize(parseExpression(expression, scope)));
}

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

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function clearWitnessAllowed(before, after, itemId) {
    const witness = after.zoew_clear_history_finalizations[itemId];
    const live = before.zoew_scan_history_cod_dod[itemId];
    const clearClaim = live && live.clearClaim;
    const trash = after.zoew_recently_deleted_cod_dod[itemId];
    return !!witness && !!clearClaim && clearClaim.token === witness.token &&
        !before.zoew_recently_deleted_cod_dod[itemId] && !after.zoew_scan_history_cod_dod[itemId] &&
        !!trash && trash.id === itemId &&
        typeof trash.deletedAt === 'number' && trash.isFromDeletion === true && !trash.clearClaim;
}

function historyDeleteAllowed(before, after, itemId) {
    const live = before.zoew_scan_history_cod_dod[itemId];
    const clearClaim = live && live.clearClaim;
    if (!clearClaim) return true;
    const witness = after.zoew_clear_history_finalizations[itemId];
    return !!witness && witness.token === clearClaim.token;
}

function witnessCleanupAllowed(before, after, itemId) {
    return !!before.zoew_clear_history_finalizations[itemId] && !after.zoew_clear_history_finalizations[itemId] &&
        !before.zoew_scan_history_cod_dod[itemId];
}

function restoreMarkerAllowed(historyItem) {
    return !historyItem.clearClaim;
}

function clearClaimAllowed(historyItem) {
    return !historyItem.restoreClaimId && !historyItem.restoreClaimToken;
}

function finalFanout(before, itemId, token, trashPatch) {
    const after = clone(before);
    after.zoew_clear_history_finalizations[itemId] = { token, finalizedAt: 1700000000000 };
    after.zoew_recently_deleted_cod_dod[itemId] = {
        id: itemId,
        phone: '012',
        deletedAt: 1700000000000,
        isFromDeletion: true,
        ...(trashPatch || {})
    };
    delete after.zoew_scan_history_cod_dod[itemId];
    return after;
}

const itemId = 'clear-item-1';
const base = {
    zoew_scan_history_cod_dod: {
        [itemId]: { id: itemId, phone: '012', clearClaim: { token: 'clear-A', claimedAt: 100 } }
    },
    zoew_recently_deleted_cod_dod: {},
    zoew_clear_history_finalizations: {}
};

console.log('-- structure នៃ clear finalization rule --');
const historyRules = rules.rules.zoew_scan_history_cod_dod.$itemId;
const claimRules = historyRules.clearClaim;
const restoreClaimIdRules = historyRules.restoreClaimId;
const restoreClaimTokenRules = historyRules.restoreClaimToken;
const witnessRules = rules.rules.zoew_clear_history_finalizations.$itemId;
const witnessWrite = witnessRules['.write'];
const trashItemRules = rules.rules.zoew_recently_deleted_cod_dod.$itemId;
const trashBarcodeRules = rules.rules.zoew_recently_deleted_cod_dod.$itemId.barcodes.$idx;
ok('history parent delete ចង post-write witness',
    ruleGuard(historyRules['.write'], "data.child('clearClaim')") && ruleGuard(historyRules['.write'], "newData.parent().parent().child('zoew_clear_history_finalizations')"));
ok('clearClaim មាន token និង claimedAt ប៉ុណ្ណោះ',
    claimRules['.validate'].includes("['token','claimedAt']") && claimRules.$other['.validate'] === false);
ok('Clear និង Restore claim មិនអាចនៅ history ដូចគ្នា',
    ruleGuard(claimRules['.validate'], "!newData.parent().child('restoreClaimId').exists()") &&
    ruleGuard(claimRules['.validate'], "!newData.parent().child('restoreClaimToken').exists()") &&
    ruleGuard(restoreClaimIdRules['.validate'], "!newData.parent().child('clearClaim').exists()") &&
    ruleGuard(restoreClaimTokenRules['.validate'], "!newData.parent().child('clearClaim').exists()"));
ok('trash barcode រក្សា scanner locker metadata',
    trashBarcodeRules.lockerUpdatedBy['.validate'].includes('newData.isString()') && trashBarcodeRules.lockerRevision['.validate'].includes('newData.isNumber()'));
ok('trash រក្សា legacy lockerRevision សម្រាប់ Restore/Clear',
    trashItemRules.lockerRevision['.validate'].includes('newData.isNumber()') &&
    trashItemRules.lockerRevision['.validate'].includes('9007199254740990'));
ok('witness bind prewrite live claim និង post-write move',
    ruleGuard(witnessWrite, "root.child('zoew_scan_history_cod_dod').child($itemId).child('clearClaim').child('token').val() === newData.child('token').val()")
    && ruleGuard(witnessWrite, "!root.child('zoew_recently_deleted_cod_dod').child($itemId).exists()")
    && ruleGuard(witnessWrite, "!newData.parent().parent().child('zoew_scan_history_cod_dod').child($itemId).exists()")
    && ruleGuard(witnessWrite, "newData.parent().parent().child('zoew_recently_deleted_cod_dod').child($itemId).child('deletedAt').isNumber()")
    && ruleGuard(witnessWrite, "newData.parent().parent().child('zoew_recently_deleted_cod_dod').child($itemId).child('isFromDeletion').val() === true")
    && ruleGuard(witnessWrite, "newData.parent().parent().child('zoew_recently_deleted_cod_dod').child($itemId).exists()"));
ok('witness មិនអនុញ្ញាត overwrite និង cleanup ត្រូវ history អវត្តមាន',
    ruleGuard(witnessWrite, "data.exists() && !newData.exists() && !root.child('zoew_scan_history_cod_dod').child($itemId).exists()"));
ok('⛔ witness ចាស់ដែលបន្សល់ មិនត្រូវចាក់សោ id ជារៀងរហូត (deadlock ៣ ខាង)',
    !ruleGuard(witnessWrite, "!data.exists() && newData.exists()"));

console.log('-- crash មុន final: claim នៅ live និងមិនបង្កើត trash --');
ok('claim មួយគត់ មិនផ្លាស់ទី data មុន final',
    !!base.zoew_scan_history_cod_dod[itemId] && base.zoew_scan_history_cod_dod[itemId].clearClaim.token === 'clear-A' && !base.zoew_recently_deleted_cod_dod[itemId]);
ok('Restore marker ថ្មីត្រូវបានបដិសេធពេល Clear claim មាន',
    !restoreMarkerAllowed(base.zoew_scan_history_cod_dod[itemId]));
ok('Clear claim ថ្មីត្រូវបានបដិសេធពេល Restore marker មាន',
    !clearClaimAllowed({ restoreClaimId: 'source-1', restoreClaimToken: 'claim-A' }));

console.log('-- stale A ក្រោយ B takeover មិនអាច clear --');
const takenOver = clone(base);
takenOver.zoew_scan_history_cod_dod[itemId].clearClaim = { token: 'clear-B', claimedAt: 200 };
const staleA = finalFanout(takenOver, itemId, 'clear-A');
ok('A witness មិនត្រូវនឹង claim B', !clearWitnessAllowed(takenOver, staleA, itemId));
ok('A history delete មិនត្រូវនឹង witness A post-write', !historyDeleteAllowed(takenOver, staleA, itemId));

console.log('-- B final បានតែម្តង ហើយមិន overwrite trash --');
const finalB = finalFanout(takenOver, itemId, 'clear-B');
ok('B witness និង history delete ត្រូវគ្នា', clearWitnessAllowed(takenOver, finalB, itemId) && historyDeleteAllowed(takenOver, finalB, itemId));
const collision = clone(takenOver);
collision.zoew_recently_deleted_cod_dod[itemId] = { id: itemId, phone: 'old' };
const collisionFinal = finalFanout(collision, itemId, 'clear-B');
ok('trash ដែលមានរួច មិនអាច overwrite', !clearWitnessAllowed(collision, collisionFinal, itemId));
const unsanitized = finalFanout(takenOver, itemId, 'clear-B', { clearClaim: { token: 'clear-B', claimedAt: 200 } });
ok('trash final មិនអនុញ្ញាត clearClaim លេចធ្លាយ', !clearWitnessAllowed(takenOver, unsanitized, itemId));
const malformedTrash = finalFanout(takenOver, itemId, 'clear-B', { isFromDeletion: false });
ok('clear final ត្រូវទុក trash ដែលអាច recover បាន', !clearWitnessAllowed(takenOver, malformedTrash, itemId));
const staleAfterFinal = finalFanout(finalB, itemId, 'clear-A');
ok('A retry ក្រោយ B final មិនអាច replay', !clearWitnessAllowed(finalB, staleAfterFinal, itemId));
const earlyCleanup = clone(takenOver);
earlyCleanup.zoew_clear_history_finalizations[itemId] = { token: 'clear-B', finalizedAt: 1700000000000 };
const earlyCleanupAfter = clone(earlyCleanup);
delete earlyCleanupAfter.zoew_clear_history_finalizations[itemId];
ok('មិនអាច cleanup witness មុន history delete', !witnessCleanupAllowed(earlyCleanup, earlyCleanupAfter, itemId));
const cleanup = clone(finalB);
delete cleanup.zoew_clear_history_finalizations[itemId];
ok('អាច cleanup witness ក្រោយ final success', witnessCleanupAllowed(finalB, cleanup, itemId));

console.log('-- witness ដែលបន្សល់ (cleanup បរាជ័យ) មិនត្រូវចាក់សោ id --');
// `clearClearHistoryFinalization()` រត់ក្នុង `.catch(() => {})` — ដូច្នេះ witness
// អាចបន្សល់។ បើវាចាក់សោ id នោះ «លុបទាំងអស់» លើ id ដដែលស្លាប់ជារៀងរហូត។
const orphanWitness = clone(base);
orphanWitness.zoew_clear_history_finalizations[itemId] = { token: 'clear-OLD', finalizedAt: 1600000000000 };
const clearOverOrphan = finalFanout(orphanWitness, itemId, 'clear-A');
ok('⛔ លុបទាំងអស់បានទោះមាន witness ចាស់បន្សល់', clearWitnessAllowed(orphanWitness, clearOverOrphan, itemId));
ok('⛔ replay ក្រោយនោះ នៅតែត្រូវបដិសេធ',
    !clearWitnessAllowed(clearOverOrphan, finalFanout(clearOverOrphan, itemId, 'clear-A'), itemId));

console.log('');
if (fail) {
    console.log('❌ ' + fail + ' បរាជ័យ / ' + pass + ' ជោគជ័យ');
    process.exit(1);
}
console.log('✅ clear finalization fence ទាំងអស់ជោគជ័យ (' + pass + ')');
process.exitCode = 0;
