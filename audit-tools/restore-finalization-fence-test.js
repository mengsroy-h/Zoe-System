const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
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

function finalizationWriteAllowed(before, after, sourceId) {
    const witness = after.zoew_restore_finalizations[sourceId];
    const claim = before.zoew_recently_deleted_cod_dod[sourceId] && before.zoew_recently_deleted_cod_dod[sourceId].restoreClaim;
    const beforeTarget = claim && before.zoew_scan_history_cod_dod[claim.targetId];
    const target = witness && after.zoew_scan_history_cod_dod[witness.targetId];
    return !!witness && !!claim &&
        claim.token === witness.token && claim.targetId === witness.targetId &&
        !!beforeTarget && beforeTarget.restoreClaimId === sourceId && beforeTarget.restoreClaimToken === claim.token &&
        !after.zoew_recently_deleted_cod_dod[sourceId] && !!target &&
        !target.restoreClaimId && !target.restoreClaimToken;
}

function trashDeleteAllowed(before, after, sourceId) {
    const source = before.zoew_recently_deleted_cod_dod[sourceId];
    const claim = source && source.restoreClaim;
    if (!claim) return true;
    const witness = after.zoew_restore_finalizations[sourceId];
    return !!witness && witness.token === claim.token && witness.targetId === claim.targetId;
}

function witnessCleanupAllowed(before, after, sourceId) {
    return !!before.zoew_restore_finalizations[sourceId] && !after.zoew_restore_finalizations[sourceId] &&
        !before.zoew_recently_deleted_cod_dod[sourceId];
}

function finalFanout(before, sourceId, token, targetId) {
    const after = clone(before);
    after.zoew_restore_finalizations[sourceId] = { token, targetId, finalizedAt: 1700000000000 };
    delete after.zoew_recently_deleted_cod_dod[sourceId];
    delete after.zoew_scan_history_cod_dod[targetId].restoreClaimId;
    delete after.zoew_scan_history_cod_dod[targetId].restoreClaimToken;
    return after;
}

const sourceId = 'source-1';
const targetId = 'target-1';
const base = {
    zoew_recently_deleted_cod_dod: {
        [sourceId]: { id: sourceId, restoreClaim: { token: 'claim-A', targetId, claimedAt: 100 } }
    },
    zoew_scan_history_cod_dod: {
        [targetId]: { id: targetId, restoreClaimId: sourceId, restoreClaimToken: 'claim-A' }
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

console.log('');
if (fail) {
    console.log('❌ ' + fail + ' បរាជ័យ / ' + pass + ' ជោគជ័យ');
    process.exit(1);
}
console.log('✅ restore finalization fence ទាំងអស់ជោគជ័យ (' + pass + ')');
