'use strict';

const ROOTS = Object.freeze({
    pickup: 'zoew_daily_pickup_cod_dod', history: 'zoew_scan_history_cod_dod',
    finalizations: 'zoew_restore_finalizations', consumptions: 'zoew_trash_consumptions'
});
const GUARD_FIELD = 'restoreGuard';
const copy = value => JSON.parse(JSON.stringify(value));

function restorePickupGuardCases({ uid = 'scan-user', scope = 'firebase|local', now = 1794225600000 } = {}) {
    const day = '2026-11-09', sourceId = 'restore_source', targetId = 'restore_target';
    const token = 'restore_guard_fixture_token', code = 'RPG1', phone = '012345678';
    const location = ROOTS.pickup + '/' + day;
    const historyPath = ROOTS.history + '/' + targetId;
    const finalizationPath = ROOTS.finalizations + '/' + sourceId;
    const consumptionPath = ROOTS.consumptions + '/' + sourceId;
    function fixture() {
        const finalization = { token, targetId, finalizedAt: now - 500 };
        const consumption = { v: 1, sourceId, generation: 1, kind: 'restore', actorUid: uid, scope,
            deletedAt: now - 3000, rowBirth: now - 20000, token, targetId };
        const barcode = { code, createdAt: now - 10000, restoredAt: now - 2000, closedAt: now - 1000,
            time: '12:00:00 (' + day + ')', cod: 5, dod: 0, isClosed: true, isDeducted: false, isFromDeletion: false, locker: 'L1' };
        const row = { id: targetId, phone, scanDate: day, createdAt: now - 20000, time: barcode.time,
            barcode: code, count: 1, cod: 5, dod: 0, price: 5, isCalled: false, isClosed: true,
            closedAt: barcode.closedAt, barcodes: { 0: barcode } };
        const guard = { v: 1, sourceId, token, targetId, finalizedAt: finalization.finalizedAt,
            generation: consumption.generation, deletedAt: consumption.deletedAt, rowBirth: consumption.rowBirth,
            actorUid: uid, scope, phone, phoneKey: phone, date: day, epoch: 0,
            target: { slot: '0', key: code, code, birth: barcode.createdAt, restored: barcode.restoredAt,
                closedAt: barcode.closedAt, scanIntent: '' } };
        const before = { pickupRevision: 1, pickupResetEpoch: 0, packagesPickedUp: 0 };
        const value = { pickupRevision: 2, pickupResetEpoch: 0, packagesPickedUp: 1,
            pickedUpPhones: { [phone]: 1 }, pickedUpBarcodes: { [code]: phone }, [GUARD_FIELD]: guard };
        return { seed: { [ROOTS.pickup]: { [day]: before }, [ROOTS.history]: { [targetId]: row },
            [ROOTS.finalizations]: { [sourceId]: finalization }, [ROOTS.consumptions]: { [sourceId]: consumption } },
            value, guard, row, barcode, finalization, consumption, before };
    }
    const vectors = [];
    const user = (f, allowed = false, extra = {}) => ({ method: 'PUT', path: location, value: copy(f.value), allowed,
        oldAllowed: !Object.prototype.hasOwnProperty.call(f.value, GUARD_FIELD) && allowed, ...extra });
    const add = (id, group, build) => vectors.push({ id, group, build: () => {
        const f = fixture();
        const steps = build(f);
        return { seed: copy(f.seed), steps: copy(steps) };
    } });
    const positive = (id, change = () => {}) => add(id, 'valid-guard', f => { change(f); return [user(f, true)]; });
    const badGuard = (id, change) => add(id, 'invalid-guard', f => { change(f.guard, f); return [user(f)]; });
    const badBasis = (id, change) => add(id, 'invalid-server-basis', f => { change(f); return [user(f)]; });
    const race = (id, interleave) => add(id, 'toctou', f => [ { owner: interleave(f) }, user(f) ]);
    const setPhone = (f, raw, key) => {
        f.row.phone = raw; f.guard.phone = raw; f.guard.phoneKey = key;
        f.value.pickedUpPhones = { [key]: 1 }; f.value.pickedUpBarcodes = { [code]: key };
    };

    positive('valid-serial-restore-guard');
    positive('valid-raw-phone-punctuation-explicit-counter', f => setPhone(f, '(012) 345-678', '_012__345_678'));
    positive('valid-khmer-no-number-counter', f => setPhone(f, 'គ្មានលេខ', '__item_' + targetId));
    positive('valid-empty-raw-phone-counter', f => setPhone(f, '', '__item_' + targetId));
    positive('valid-phone-counter-is-not-server-normalized', f => setPhone(f, '(012) 345-678', 'explicit_counter_identity'));
    positive('valid-phone-key-64-characters', f => setPhone(f, phone, 'p'.repeat(64)));
    positive('valid-restored-zero-absent', f => { delete f.barcode.restoredAt; f.guard.target.restored = 0; });
    positive('valid-restored-zero-present', f => { f.barcode.restoredAt = 0; f.guard.target.restored = 0; });
    positive('valid-scan-intent-present', f => { f.barcode.scanIntent = 'scan_' + 'a'.repeat(32); f.guard.target.scanIntent = f.barcode.scanIntent; });
    positive('valid-sparse-string-slot', f => { f.row.barcodes = { 7: f.barcode }; f.guard.target.slot = '7'; });
    positive('valid-max-safe-string-slot', f => { f.row.barcodes = { 9007199254740990: f.barcode }; f.guard.target.slot = '9007199254740990'; });
    positive('valid-legacy-consumption-generation-zero', f => { f.consumption.generation = 0; f.guard.generation = 0; });
    for (const outcome of ['committed', 'compensated']) positive('valid-settled-price-' + outcome, f => {
        f.row.pricePending = { token: 'price_' + 'a'.repeat(32), actorUid: uid, code, slot: '0',
            birth: f.barcode.createdAt, rowBirth: f.row.createdAt, scanDate: day, priorCod: 5, priorDod: 0,
            wantCod: 5, wantDod: 0, phase: 'settled', outcome };
    });

    race('race-history-reopened-before-write', f => {
        const row = copy(f.row); row.isClosed = false; delete row.closedAt;
        row.barcodes[0].isClosed = false; delete row.barcodes[0].closedAt;
        return { [historyPath]: row };
    });
    race('race-history-phone-changed-before-write', f => ({ [historyPath]: { ...f.row, phone: '098765432' } }));
    race('race-history-birth-changed-before-write', f => {
        const row = copy(f.row); row.barcodes[0].createdAt++;
        return { [historyPath]: row };
    });
    race('race-finalization-token-changed-before-write', f => ({ [finalizationPath]: { ...f.finalization, token: 'replacement-token' } }));
    race('race-finalization-removed-before-write', () => ({ [finalizationPath]: null }));
    race('race-consumption-replaced-before-write', f => ({ [consumptionPath]: { ...f.consumption, generation: 2 } }));
    race('race-reset-after-proof-before-write', f => {
        f.value.pickupRevision = 3; f.value.pickupResetEpoch = 1;
        return { [location]: { pickupRevision: 2, pickupResetEpoch: 1, packagesPickedUp: 0 } };
    });

    for (const field of ['token', 'targetId', 'finalizedAt']) {
        badBasis('missing-finalization-' + field, f => { delete f.finalization[field]; });
        badBasis('wrong-finalization-' + field, f => { f.finalization[field] = field === 'finalizedAt' ? now - 499 : 'different_' + field; });
    }
    add('extra-finalization-field', 'invalid-server-basis', f => [
        { method: 'PATCH', path: finalizationPath, value: { future: true }, allowed: false, oldAllowed: false }, user(f, true)
    ]);
    const consumptionWrong = { v: 2, sourceId: 'other_source', generation: 2, kind: 'purge', actorUid: 'foreign',
        scope: 'other-scope', deletedAt: now - 2999, rowBirth: now - 19999, token: 'other-token', targetId: 'other_target' };
    for (const [field, value] of Object.entries(consumptionWrong)) {
        badBasis('missing-consumption-' + field, f => { delete f.consumption[field]; });
        badBasis('wrong-consumption-' + field, f => { f.consumption[field] = value; });
    }
    add('extra-consumption-field', 'invalid-server-basis', f => [
        { method: 'PATCH', path: consumptionPath, value: { future: true }, allowed: false, oldAllowed: false }, user(f, true)
    ]);
    badBasis('foreign-consumption-actor-matches-guard', f => { f.consumption.actorUid = 'foreign'; f.guard.actorUid = 'foreign'; });

    const guardWrong = { v: 2, sourceId: 'other_source', token: 'other-token', targetId: 'other_target', finalizedAt: now - 499,
        generation: 2, deletedAt: now - 2999, rowBirth: now - 19999, actorUid: 'foreign', scope: 'other-scope',
        phone: '098765432', phoneKey: 'other_counter', date: '2026-11-08', epoch: 1 };
    for (const [field, value] of Object.entries(guardWrong)) {
        badGuard('wrong-guard-' + field, guard => { guard[field] = value; });
    }
    for (const field of [...Object.keys(guardWrong), 'target']) badGuard('missing-guard-' + field, guard => { delete guard[field]; });
    badGuard('extra-guard-field', guard => { guard.future = true; });
    badGuard('guard-is-string', (_guard, f) => { f.value[GUARD_FIELD] = 'restore'; });
    badGuard('guard-is-array', (_guard, f) => { f.value[GUARD_FIELD] = [{ v: 1 }]; });
    badGuard('guard-version-is-string', guard => { guard.v = '1'; });
    badGuard('guard-epoch-negative', guard => { guard.epoch = -1; });
    badGuard('guard-epoch-fractional', guard => { guard.epoch = 0.5; });
    badGuard('guard-epoch-is-string', guard => { guard.epoch = '0'; });
    badGuard('guard-phone-key-empty', guard => { guard.phoneKey = ''; });
    badGuard('guard-phone-key-too-long', guard => { guard.phoneKey = 'p'.repeat(65); });

    const targetWrong = { slot: '1', key: 'OTHER', code: 'OTHER', birth: now - 9999, restored: now - 1999,
        closedAt: now - 999, scanIntent: 'scan_' + 'b'.repeat(32) };
    for (const [field, value] of Object.entries(targetWrong)) {
        badGuard('wrong-target-' + field, guard => { guard.target[field] = value; });
        badGuard('missing-target-' + field, guard => { delete guard.target[field]; });
    }
    badGuard('extra-target-field', guard => { guard.target.future = true; });
    badGuard('target-is-array', guard => { guard.target = []; });
    badGuard('target-slot-is-number', guard => { guard.target.slot = 0; });
    badGuard('target-slot-empty', guard => { guard.target.slot = ''; });
    badGuard('target-slot-too-long', (guard, f) => { guard.target.slot = '12345678901234567'; f.row.barcodes = { [guard.target.slot]: f.barcode }; });
    badGuard('target-slot-is-descendant-path', guard => { guard.target.slot = '0/code'; });
    badBasis('target-slot-points-to-foreign-barcode', f => { f.row.barcodes.foreign = { ...f.barcode, code: 'FOREIGN', createdAt: now - 9999 }; f.guard.target.slot = 'foreign'; });
    badGuard('target-slot-negative', guard => { guard.target.slot = -1; });
    badGuard('target-slot-fractional', guard => { guard.target.slot = 0.5; });
    badGuard('target-slot-out-of-range', guard => { guard.target.slot = 9007199254740991; });
    badGuard('target-birth-zero', (guard, f) => { guard.target.birth = 0; f.barcode.createdAt = 0; });
    badGuard('target-restored-negative', (guard, f) => { guard.target.restored = -1; f.barcode.restoredAt = -1; });
    badGuard('target-closed-at-zero', (guard, f) => { guard.target.closedAt = 0; f.barcode.closedAt = 0; f.row.closedAt = 0; });
    badGuard('target-scan-intent-malformed', (guard, f) => { guard.target.scanIntent = 'scan_wrong'; f.barcode.scanIntent = 'scan_wrong'; });
    badBasis('target-has-uncaptured-scan-intent', f => { f.barcode.scanIntent = 'scan_' + 'c'.repeat(32); });
    badBasis('target-is-deducted', f => { f.barcode.isDeducted = true; });
    badBasis('target-is-open', f => { f.barcode.isClosed = false; });
    badBasis('target-slot-is-missing', f => { f.row.barcodes = {}; });
    badBasis('target-row-is-missing', f => { delete f.seed[ROOTS.history][targetId]; });
    badBasis('target-date-changed', f => { f.row.scanDate = '2026-11-08'; });
    badBasis('target-phone-changed', f => { f.row.phone = '098765432'; });
    for (const [field, value] of Object.entries({ restoreClaimId: sourceId, restoreClaimToken: token,
        restoreAddedCodes: '|' + code + '|', clearClaim: { token: 'clear', claimedAt: now - 100 },
        scanPending: { intent: 'scan_' + 'd'.repeat(32) }, pricePending: { token: 'pending-price' } })) {
        badBasis('target-has-' + field, f => { f.row[field] = value; });
    }

    add('ordinary-legacy-pickup-write', 'ordinary-compatibility', f => {
        f.seed = { [ROOTS.pickup]: { [day]: { packagesPickedUp: 0 } } };
        f.value = { packagesPickedUp: 1, pickedUpPhones: { [phone]: 1 }, pickedUpBarcodes: { [code]: phone } };
        return [user(f, true)];
    });
    add('ordinary-versioned-pickup-write', 'ordinary-compatibility', f => {
        delete f.value[GUARD_FIELD]; return [user(f, true)];
    });
    add('ordinary-write-can-drop-prior-guard', 'ordinary-compatibility', f => {
        f.seed[ROOTS.pickup][day] = copy(f.value);
        const row = copy(f.row); row.isClosed = false; row.barcodes[0].isClosed = false;
        const value = copy(f.value); delete value[GUARD_FIELD]; value.pickupRevision = 3;
        return [{ owner: { [historyPath]: row } }, { method: 'PUT', path: location, value, allowed: true, oldAllowed: true }];
    });
    for (const kind of ['history', 'finalization', 'consumption']) add('unchanged-guard-carry-after-' + kind + '-change', 'unchanged-guard-bypass', f => {
        f.seed[ROOTS.pickup][day] = copy(f.value);
        const changes = kind === 'history' ? { [historyPath + '/barcodes/0/isClosed']: false }
            : kind === 'finalization' ? { [finalizationPath + '/token']: 'new-token' }
                : { [consumptionPath + '/generation']: 2 };
        return [{ owner: changes }, { method: 'PATCH', path: location, value: { pickupRevision: 3 }, allowed: false, oldAllowed: false }];
    });
    add('ordinary-finalization-delete-compatibility', 'ordinary-compatibility', f => [
        { method: 'PATCH', path: '', value: { [finalizationPath]: null }, allowed: true, oldAllowed: true }
    ]);
    add('ordinary-history-reopen-compatibility', 'ordinary-compatibility', f => {
        const row = copy(f.row); row.isClosed = false; delete row.closedAt;
        row.barcodes[0].isClosed = false; delete row.barcodes[0].closedAt;
        return [{ method: 'PUT', path: historyPath, value: row, allowed: true, oldAllowed: true }];
    });
    add('ordinary-history-birth-change-compatibility', 'ordinary-compatibility', f => {
        const row = copy(f.row); row.barcodes[0].createdAt++;
        return [{ method: 'PUT', path: historyPath, value: row, allowed: true, oldAllowed: true }];
    });
    add('atomic-finalization-delete-and-guarded-pickup', 'same-write-fanout', f => [
        { method: 'PATCH', path: '', value: { [finalizationPath]: null, [location]: copy(f.value) }, allowed: false, oldAllowed: false }
    ]);
    add('atomic-history-reopen-and-guarded-pickup', 'same-write-fanout', f => {
        const row = copy(f.row); row.isClosed = false; delete row.closedAt;
        row.barcodes[0].isClosed = false; delete row.barcodes[0].closedAt;
        return [{ method: 'PATCH', path: '', value: { [historyPath]: row, [location]: copy(f.value) }, allowed: false, oldAllowed: false }];
    });
    add('atomic-history-birth-change-and-guarded-pickup', 'same-write-fanout', f => {
        const row = copy(f.row); row.barcodes[0].createdAt++;
        return [{ method: 'PATCH', path: '', value: { [historyPath]: row, [location]: copy(f.value) }, allowed: false, oldAllowed: false }];
    });
    add('atomic-identical-guard-carry-after-finalization-delete', 'same-write-fanout', f => {
        f.seed[ROOTS.pickup][day] = copy(f.value);
        return [{ method: 'PATCH', path: '', value: { [finalizationPath]: null, [location + '/pickupRevision']: 3 }, allowed: false, oldAllowed: false }];
    });
    return vectors;
}

module.exports = { restorePickupGuardCases, GUARD_FIELD, ROOTS };
