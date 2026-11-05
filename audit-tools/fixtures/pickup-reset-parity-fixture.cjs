'use strict';
const { createHash } = require('node:crypto');
const P = 'zoew_daily_pickup_cod_dod', D = 'zoew_daily_revenue_cod_dod', M = 'zoew_monthly_revenue_cod_dod', H = 'zoew_scan_history_cod_dod';
const DAY = '2026-11-01', OTHER = '2026-10-31', TAIL = '2026-11-02';
const PRIOR = { pickupRevision: 5, pickupResetEpoch: 2, packagesPickedUp: 2, pickedUpPhones: { PHONE: 2 }, pickedUpBarcodes: { CODE_A: 'PHONE', CODE_B: 'PHONE' } };
const MONEY = { codDollar: 37, dodDollar: 5, totalCount: 11 };
const IMPORTED = new Set(['native-drop-proof-rejected', 'native-malformed-proof-rejected', 'old-client-failclosed-after-proof']);
const clone = value => JSON.parse(JSON.stringify(value));
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const commonSeed = () => ({ [P]: { [DAY]: clone(PRIOR), [OTHER]: clone(PRIOR), [TAIL]: clone(PRIOR) },
    [D]: { [DAY]: clone(MONEY) }, [M]: { '2026-11': clone(MONEY) },
    [H]: { retained: { id: 'retained', isClosed: true, count: 1, cod: 37, dod: 5 } } });
const seedProfileFor = id => IMPORTED.has(id) ? 'imported-native-day' : 'fresh';
async function seedFor(id, codec) {
    const value = commonSeed(), profile = seedProfileFor(id);
    let provenance = { kind: 'fresh-common-record', historicalAppliedClaim: false };
    if (profile === 'imported-native-day') {
        const tenant = 'demo-f09-reset', actorUid = 'f09-imported-archive-creator';
        const batchId = 'paired-import-archive-v1', scope = 'https://archive-f09.invalid#original';
        const batchHash = await codec.pickupResetBatchHash(tenant, scope, actorUid, batchId, [DAY]);
        const context = { v: 1, scope, batchId, batchHash, dayId: batchId + ':' + DAY, day: DAY, nonce: 'paired-import-nonce-v1' };
        const basis = { pickupRevision: 3, pickupResetEpoch: 1, packagesPickedUp: 1,
            pickedUpPhones: { ARCHIVE_PHONE: 1 }, pickedUpBarcodes: { ARCHIVE_CODE: 'ARCHIVE_PHONE' } };
        const desired = { pickupRevision: 4, pickupResetEpoch: 2, packagesPickedUp: 0, pickedUpPhones: null, pickedUpBarcodes: null };
        const casText = codec.pickupResetCasText(DAY, basis, desired);
        const attemptId = await codec.pickupResetAttemptId(tenant, actorUid, context, casText);
        const proof = await codec.pickupResetBoundReceipt(tenant, actorUid, context, attemptId, casText, 'native-day');
        if (!proof || proof.afterRevision !== 4 || proof.afterEpoch !== 2 || proof.actorUid !== actorUid || proof.tenant !== tenant) throw new Error('Invalid imported proof fixture');
        value[P][DAY].pickupResetApplied = clone(proof);
        provenance = { kind: 'supported-imported-native-day-document-fixture', historicalAppliedClaim: false,
            authority: 'Imported metadata precondition, not an observed native commit or SQL operation receipt',
            originTenant: tenant, originActor: actorUid, proofHash: hash(proof), originalCasHash: hash(casText) };
    }
    return { value, profile, provenance, seedHash: hash(value) };
}
module.exports = { commonSeed, seedProfileFor, seedFor };
