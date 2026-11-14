'use strict';

// Legacy client packets are deliberately complete: rejecting an unrelated malformed
// record is not evidence that a database requires trusted upstream attestation.
function legacyRestoreVector(mode, id, actorUid, now = Date.now()) {
    const day = new Date(now).toISOString().slice(0, 10);
    const source = { id, phone: '012000000', createdAt: now - 10000, deletedAt: now - 1000,
        scanDate: day, cod: 7, dod: 2, price: 9, count: 1, isClosed: false,
        trashReason: 'remove', trashMode: mode, isFromDeletion: false,
        barcodes: [{ code: 'ZAT0000_' + id, cod: 7, dod: 2, createdAt: now - 10000,
            isClosed: false, isDeducted: true }] };
    const claim = { token: 'attest_token_' + id, targetId: 'attest_target_' + id, claimedAt: now };
    const prepared = { id: claim.targetId, phone: source.phone, createdAt: source.createdAt,
        scanDate: day, cod: 7, dod: 2, price: 9, count: 1, isClosed: false,
        barcodes: [{ ...source.barcodes[0], isDeducted: false }],
        restoreClaimId: id, restoreClaimToken: claim.token };
    const live = { ...prepared };
    delete live.restoreClaimId;
    delete live.restoreClaimToken;
    const money = { codDollar: 7, dodDollar: 2, totalCount: 1 };
    const consumption = { v: 1, sourceId: id, generation: 0, kind: 'restore', actorUid,
        scope: 'qa_restore_attestation', deletedAt: source.deletedAt, rowBirth: source.createdAt,
        token: claim.token, targetId: claim.targetId };
    const finalization = { token: claim.token, targetId: claim.targetId, finalizedAt: now + 1 };
    return { source, claim, prepared, live, day, month: day.slice(0, 7), money, consumption, finalization,
        finalPacket: { ['zoew_recently_deleted_cod_dod/' + id]: null,
            ['zoew_scan_history_cod_dod/' + claim.targetId]: live,
            ['zoew_restore_finalizations/' + id]: finalization,
            ['zoew_trash_consumptions/' + id]: consumption,
            ['zoew_daily_revenue_cod_dod/' + day]: money,
            ['zoew_monthly_revenue_cod_dod/' + day.slice(0, 7)]: money } };
}

function attestedRestoreVector(mode, id, actorUid, scope, now = Date.now()) {
    const vector = legacyRestoreVector(mode, id, actorUid, now);
    vector.consumption.scope = scope;
    return vector;
}

function invalidGrantMutations(now = Date.now()) {
    return [
        ['missing', null],
        ['modified-id', { id: 'foreign-proof' }],
        ['wrong-actor', { actorUid: 'foreign-user' }],
        ['wrong-source', { sourceId: 'foreign-source' }],
        ['wrong-generation', { generation: 1 }],
        ['wrong-target', { targetId: 'foreign-target' }],
        ['wrong-token', { token: 'foreign-token' }],
        ['wrong-scope', { scope: 'foreign-scope' }],
        ['wrong-policy', { policyEpoch: 2 }],
        ['wrong-birth', { rowBirth: 1 }],
        ['wrong-deletion', { deletedAt: 1 }],
        ['expired', { expiresAt: now - 1 }]
    ];
}

function invalidPolicyEpochs() { return [0, 0.5, -1, Number.MAX_SAFE_INTEGER + 1]; }

function mergedAttestedRestoreVector(mode, id, actorUid, scope, now = Date.now()) {
    const vector = attestedRestoreVector(mode, id, actorUid, scope, now);
    const existing = { code: 'EXISTING_B_' + id, cod: 3, dod: 1, createdAt: now - 20000, isClosed: false, isDeducted: false };
    vector.neighbor = { id: vector.claim.targetId, phone: vector.source.phone, createdAt: existing.createdAt,
        scanDate: vector.day, cod: 3, dod: 1, price: 4, count: 1, isClosed: false, barcodes: { 3: existing } };
    vector.initialMoney = { codDollar: 3, dodDollar: 1, totalCount: 1 };
    vector.money = { codDollar: 10, dodDollar: 3, totalCount: 2 };
    vector.prepared = { ...vector.neighbor, cod: 10, dod: 3, price: 13, count: 2,
        barcodes: [existing, { ...vector.source.barcodes[0], isDeducted: false }],
        restoreClaimId: id, restoreClaimToken: vector.claim.token, restoreAddedCodes: JSON.stringify([vector.source.barcodes[0].code]) };
    vector.live = { ...vector.prepared };
    delete vector.live.restoreClaimId; delete vector.live.restoreClaimToken; delete vector.live.restoreAddedCodes;
    vector.finalPacket['zoew_scan_history_cod_dod/' + vector.claim.targetId] = vector.live;
    vector.finalPacket['zoew_daily_revenue_cod_dod/' + vector.day] = vector.money;
    vector.finalPacket['zoew_monthly_revenue_cod_dod/' + vector.month] = vector.money;
    return vector;
}

module.exports = { legacyRestoreVector, attestedRestoreVector, mergedAttestedRestoreVector, invalidGrantMutations, invalidPolicyEpochs };
