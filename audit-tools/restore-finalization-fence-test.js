const fs = require('fs');
const path = require('path');

// ថត app អាច override បាន ដើម្បីឲ្យ `run-all.sh <baseline>` និង
// `checker-coverage.js` បញ្ជាក់បានថា checker នេះពិតជាអានកូដមែន។
const root = process.env.RESTOREFENCE_APP_DIR ? path.resolve(process.env.RESTOREFENCE_APP_DIR) : path.resolve(__dirname, '..');
const rules = JSON.parse(fs.readFileSync(path.join(root, 'firebase-database.rules.json'), 'utf8'));
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

// Evaluate the shipped rule expressions against before/after snapshots. This is a
// small snapshot adapter, not a duplicate implementation of the restore policy.
function ruleSnapshot(tree, parts = []) {
    const val = () => parts.reduce((node, key) => node && typeof node === 'object' ? node[key] : undefined, tree) ?? null;
    return {
        val, exists: () => val() !== null,
        child: (key) => ruleSnapshot(tree, parts.concat(String(key).split('/').filter(Boolean))),
        parent: () => ruleSnapshot(tree, parts.slice(0, -1)),
        isString: () => typeof val() === 'string',
        isNumber: () => typeof val() === 'number',
        isBoolean: () => typeof val() === 'boolean'
    };
}
function ruleAllows(expression, before, after, node, sourceId) {
    return !!new Function('auth', 'root', 'data', 'newData', 'now', '$sourceId', '$itemId', 'return (' + expression + ');')(
        { uid: 'audit-user' }, ruleSnapshot(before), ruleSnapshot(before, node), ruleSnapshot(after, node),
        1700000000000, sourceId, sourceId);
}
function finalizationWriteAllowed(before, after, sourceId) {
    return ruleAllows(rules.rules.zoew_restore_finalizations.$sourceId['.write'], before, after, ['zoew_restore_finalizations', sourceId], sourceId);
}
function trashDeleteAllowed(before, after, sourceId) {
    return ruleAllows(rules.rules.zoew_recently_deleted_cod_dod.$itemId['.write'], before, after, ['zoew_recently_deleted_cod_dod', sourceId], sourceId);
}
function witnessCleanupAllowed(before, after, sourceId) {
    return finalizationWriteAllowed(before, after, sourceId);
}

function finalFanout(before, sourceId, token, targetId) {
    const after = clone(before);
    after.zoew_restore_finalizations[sourceId] = { token, targetId, finalizedAt: 1700000000000 };
    delete after.zoew_recently_deleted_cod_dod[sourceId];
    delete after.zoew_scan_history_cod_dod[targetId].restoreClaimId;
    delete after.zoew_scan_history_cod_dod[targetId].restoreClaimToken;
    delete after.zoew_scan_history_cod_dod[targetId].restoreAddedCodes;
    return after;
}

const sourceId = 'source-1';
const targetId = 'target-1';
const base = {
    zoew_recently_deleted_cod_dod: {
        [sourceId]: { id: sourceId, restoreClaim: { token: 'claim-A', targetId, claimedAt: 100 } }
    },
    zoew_scan_history_cod_dod: {
        [targetId]: { id: targetId, restoreClaimId: sourceId, restoreClaimToken: 'claim-A', restoreAddedCodes: '["C"]' }
    },
    zoew_restore_finalizations: {}
};

console.log('-- structure នៃ witness rule --');
const trashWrite = rules.rules.zoew_recently_deleted_cod_dod.$itemId['.write'];
const witnessRules = rules.rules.zoew_restore_finalizations.$sourceId;
const witnessWrite = witnessRules['.write'];
ok('trash delete ពិនិត្យ witness post-write',
    trashWrite.includes("newData.parent().parent().child('zoew_restore_finalizations')") && trashWrite.includes("child('token')") && trashWrite.includes("child('targetId')"));
ok('witness បង្កើតតែពី claim បច្ចុប្បន្ន និង final fanout',
    witnessWrite.includes("root.child('zoew_recently_deleted_cod_dod')") && witnessWrite.includes("root.child('zoew_scan_history_cod_dod')") && witnessWrite.includes("restoreClaimToken") && witnessWrite.includes("!newData.parent().parent().child('zoew_recently_deleted_cod_dod')") && witnessWrite.includes("restoreClaimId"));
ok('⛔ witness ចាស់ដែលបន្សល់ មិនត្រូវចាក់សោ id ជារៀងរហូត (deadlock ៣ ខាង)',
    !witnessWrite.includes("!data.exists() && newData.exists()"));
ok('witness មិនអនុញ្ញាត overwrite ហើយ cleanup ត្រូវការធុងសំរាមលុបរួច',
    witnessWrite.includes("data.exists() && !newData.exists() && !root.child('zoew_recently_deleted_cod_dod')"));
ok('witness schema តម្រូវ token/targetId/finalizedAt',
    witnessRules['.validate'].includes("['token','targetId','finalizedAt']") && witnessRules.$other['.validate'] === false);

console.log('-- terminal policy and provenance use actual shipped rule expressions --');
for (const policy of [{ restoreBlocked: true }, { trashMode: 'palm' }]) {
    const blocked = clone(base);
    Object.assign(blocked.zoew_recently_deleted_cod_dod[sourceId], policy);
    ok('terminal trash rejects finalization: ' + JSON.stringify(policy),
        !finalizationWriteAllowed(blocked, finalFanout(blocked, sourceId, 'claim-A', targetId), sourceId));
}
const lingeringProvenance = finalFanout(base, sourceId, 'claim-A', targetId);
lingeringProvenance.zoew_scan_history_cod_dod[targetId].restoreAddedCodes = '["C"]';
ok('finalization must clear insertion provenance alongside both markers', !finalizationWriteAllowed(base, lingeringProvenance, sourceId));

console.log('-- reclaim: A ចាស់ មិនអាច finalize ក្រោយ B takeover --');
const takenOver = clone(base);
takenOver.zoew_recently_deleted_cod_dod[sourceId].restoreClaim = { token: 'claim-B', targetId, claimedAt: 200 };
takenOver.zoew_scan_history_cod_dod[targetId].restoreClaimToken = 'claim-B';
const staleA = finalFanout(takenOver, sourceId, 'claim-A', targetId);
ok('witness របស់ A មិនត្រូវនឹង claim B', !finalizationWriteAllowed(takenOver, staleA, sourceId));
ok('trash delete របស់ A មិនត្រូវនឹង witness A post-write', !trashDeleteAllowed(takenOver, staleA, sourceId));
const unpreparedB = clone(takenOver);
delete unpreparedB.zoew_scan_history_cod_dod[targetId].restoreClaimId;
delete unpreparedB.zoew_scan_history_cod_dod[targetId].restoreClaimToken;
const malformedB = finalFanout(unpreparedB, sourceId, 'claim-B', targetId);
ok('B មិនអាច finalize បើ prewrite history marker មិនត្រូវបានរៀបចំ', !finalizationWriteAllowed(unpreparedB, malformedB, sourceId));

console.log('-- B finalize បានតែម្តង និង cleanup មានសុវត្ថិភាព --');
const finalB = finalFanout(takenOver, sourceId, 'claim-B', targetId);
ok('B witness បាន bind ទៅ claim B', finalizationWriteAllowed(takenOver, finalB, sourceId));
ok('B trash delete បាន bind ទៅ witness B', trashDeleteAllowed(takenOver, finalB, sourceId));
const staleAfterB = finalFanout(finalB, sourceId, 'claim-A', targetId);
ok('A retry ក្រោយ B final មិនអាចបង្កើត witness ឡើងវិញ', !finalizationWriteAllowed(finalB, staleAfterB, sourceId));
const earlyCleanup = clone(takenOver);
earlyCleanup.zoew_restore_finalizations[sourceId] = { token: 'claim-B', targetId, finalizedAt: 1700000000000 };
const earlyCleanupAfter = clone(earlyCleanup);
delete earlyCleanupAfter.zoew_restore_finalizations[sourceId];
ok('មិនអាច cleanup witness មុន trash delete', !witnessCleanupAllowed(earlyCleanup, earlyCleanupAfter, sourceId));
const cleanup = clone(finalB);
delete cleanup.zoew_restore_finalizations[sourceId];
ok('អាច cleanup witness ក្រោយ final success', witnessCleanupAllowed(finalB, cleanup, sourceId));

console.log('-- witness ដែលបន្សល់ (cleanup បរាជ័យ) មិនត្រូវចាក់សោ id --');
// `clearRestoreFinalization()` រត់ក្នុង `.catch(() => {})` ➜ បណ្តាញដាច់ភ្លាមក្រោយ
// finalize ➜ witness នៅជាប់។ បើវាចាក់សោ id នោះការស្តារលើកក្រោយនៃ id ដដែល
// ត្រូវបដិសេធ · witness លុបមិនចេញ (ទាមទារធុងសំរាមលែងមាន) · ធាតុធុងសំរាមលុប
// មិនចេញ (ទាមទារ witness fence) = **DEADLOCK ៣ ខាង** — កំហុសផលិតកម្មពិត។
const orphanWitness = clone(base);
orphanWitness.zoew_restore_finalizations[sourceId] = { token: 'claim-OLD', targetId, finalizedAt: 1600000000000 };
const restoreOverOrphan = finalFanout(orphanWitness, sourceId, 'claim-A', targetId);
ok('⛔ ស្តារបានទោះមាន witness ចាស់បន្សល់', finalizationWriteAllowed(orphanWitness, restoreOverOrphan, sourceId));
ok('⛔ replay ក្រោយនោះ នៅតែត្រូវបដិសេធ (លុយមិនបូកស្ទួន)',
    !finalizationWriteAllowed(restoreOverOrphan, finalFanout(restoreOverOrphan, sourceId, 'claim-A', targetId), sourceId));
const noClaimAtAll = clone(base);
delete noClaimAtAll.zoew_recently_deleted_cod_dod[sourceId];
noClaimAtAll.zoew_restore_finalizations[sourceId] = { token: 'claim-OLD', targetId, finalizedAt: 1600000000000 };
const forged = clone(noClaimAtAll);
forged.zoew_restore_finalizations[sourceId] = { token: 'claim-A', targetId, finalizedAt: 1700000000000 };
ok('⛔ witness ក្លែងក្លាយដោយគ្មាន claim ត្រូវបដិសេធ', !finalizationWriteAllowed(noClaimAtAll, forged, sourceId));

console.log('-- ការស្តារ legacy ដែលជាប់ (A6) ៖ client ចាស់បដិសេធ · ការសរសេរ atomic របស់ 🛠️ ទទួល --');
// ជួរ legacy (គ្មាន restoreAddedCodes) ចង្អុល T ដែល freeze ៖ client 2.50.135 (`clearStaleRestoreMarkers` = transaction ជួរ H តែឯង
// ដក markers ទុក barcodes) ត្រូវបដិសេធ ព្រោះ claim T នៅ · `releaseHeldRestoreRow()` ដោះ claim T ក្នុងការសរសេរតែមួយ ➜ ទទួល។
function historyWriteAllowed(before, after, itemId) {
    return ruleAllows(rules.rules.zoew_scan_history_cod_dod.$itemId['.write'], before, after, ['zoew_scan_history_cod_dod', itemId], itemId);
}
const heldLegacy = clone(base);
Object.assign(heldLegacy.zoew_recently_deleted_cod_dod[sourceId], { restoreBlocked: true, trashMode: 'cookie' });
delete heldLegacy.zoew_scan_history_cod_dod[targetId].restoreAddedCodes;
heldLegacy.zoew_scan_history_cod_dod[targetId].restoreClaimToken = 'claim-OLD';
heldLegacy.zoew_scan_history_cod_dod[targetId].barcodes = [{ code: 'N' }, { code: 'C' }];
const stripMarkers = (tree) => {
    const row = tree.zoew_scan_history_cod_dod[targetId];
    delete row.restoreClaimId;
    delete row.restoreClaimToken;
    delete row.restoreAddedCodes;
    return tree;
};
const oldClientClear = stripMarkers(clone(heldLegacy));
ok('⛔ client ចាស់ ៖ ដក markers ក្នុងជួរតែឯង (claim T នៅ) ត្រូវបដិសេធ', !historyWriteAllowed(heldLegacy, oldClientClear, targetId));
const oldClientDelete = clone(heldLegacy);
delete oldClientDelete.zoew_scan_history_cod_dod[targetId];
ok('⛔ client ចាស់ ៖ លុបជួរតែឯង (claim T នៅ) ត្រូវបដិសេធ', !historyWriteAllowed(heldLegacy, oldClientDelete, targetId));
const atomicHeld = (before, mutate) => {
    const after = stripMarkers(clone(before));
    after.zoew_scan_history_cod_dod[targetId].barcodes = [{ code: 'N' }];
    delete after.zoew_recently_deleted_cod_dod[sourceId].restoreClaim;
    if (mutate) mutate(after);
    return after;
};
ok('🛠️ ការសរសេរតែមួយ (ជួរស្អាត + release claim T) ទទួល ទោះ token H ខុសពី T', historyWriteAllowed(heldLegacy, atomicHeld(heldLegacy), targetId));
ok('🛠️ ការសរសេរតែមួយ ៖ លុបជួរ + release claim T ទទួល',
    historyWriteAllowed(heldLegacy, atomicHeld(heldLegacy, (after) => { delete after.zoew_scan_history_cod_dod[targetId]; }), targetId));
ok('⛔ ការសរសេរតែមួយដែលទុក restoreClaimId ត្រូវបដិសេធ',
    !historyWriteAllowed(heldLegacy, atomicHeld(heldLegacy, (after) => { after.zoew_scan_history_cod_dod[targetId].restoreClaimId = sourceId; }), targetId));
const unfrozenLegacy = clone(heldLegacy);
delete unfrozenLegacy.zoew_recently_deleted_cod_dod[sourceId].restoreBlocked;
ok('⛔ source មិនទាន់ freeze ៖ ការសរសេរ atomic ត្រូវបដិសេធ', !historyWriteAllowed(unfrozenLegacy, atomicHeld(unfrozenLegacy), targetId));
const otherTargetLegacy = clone(heldLegacy);
otherTargetLegacy.zoew_recently_deleted_cod_dod[sourceId].restoreClaim.targetId = 'target-other';
ok('⛔ claim T ចង្អុលជួរផ្សេង ៖ ការសរសេរ atomic ត្រូវបដិសេធ', !historyWriteAllowed(otherTargetLegacy, atomicHeld(otherTargetLegacy), targetId));
const heldModern = clone(heldLegacy);
heldModern.zoew_scan_history_cod_dod[targetId].restoreClaimToken = 'claim-A';
heldModern.zoew_scan_history_cod_dod[targetId].restoreAddedCodes = '["C"]';
ok('modern មាន provenance ៖ ដក markers ៣ ក្នុងជួរតែឯង ទទួល (A5 មិនប្រែ)', historyWriteAllowed(heldModern, stripMarkers(clone(heldModern)), targetId));

console.log('');
if (fail) {
    console.log('❌ ' + fail + ' បរាជ័យ / ' + pass + ' ជោគជ័យ');
    process.exit(1);
}
console.log('✅ restore finalization fence ទាំងអស់ជោគជ័យ (' + pass + ')');
