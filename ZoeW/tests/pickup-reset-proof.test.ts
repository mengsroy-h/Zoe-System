import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { pickupResetAppliedReceipt, pickupResetAttemptId, pickupResetAttemptPreimage, pickupResetBatchHash, pickupResetBatchPreimage,
    pickupResetBoundReceipt, pickupResetCasOf, pickupResetCasText, pickupResetContextOf, pickupResetReceiptMatches, pickupResetReceiptOf } from '../src/domain/pickup-reset-proof';

const VECTORS = [
  {
    "name": "legacy-ascii",
    "tenant": "demo-f09",
    "actorUid": "owner",
    "dates": [
      "2026-10-30"
    ],
    "context": {
      "v": 1,
      "scope": "https://f09.invalid",
      "batchId": "batch-a",
      "batchHash": "ced74c01c77bcdb25de6ff8f3f3b315cd7b55339540a1382bc84760cad8227e9",
      "dayId": "batch-a:2026-10-30",
      "day": "2026-10-30",
      "nonce": "nonce-original"
    },
    "casText": "{\"k\":\"cas\",\"p\":[\"zoew_daily_pickup_cod_dod\",\"2026-10-30\"],\"x\":null,\"v\":{\"pickupRevision\":1,\"pickupResetEpoch\":1,\"packagesPickedUp\":0,\"pickedUpPhones\":null,\"pickedUpBarcodes\":null}}",
    "batchPreimage": "[\"zoew-pickup-reset-batch-v1\",1,\"demo-f09\",\"https://f09.invalid\",\"owner\",\"batch-a\",[\"2026-10-30\"]]",
    "batchHash": "ced74c01c77bcdb25de6ff8f3f3b315cd7b55339540a1382bc84760cad8227e9",
    "attemptPreimage": "[\"zoew-pickup-reset-attempt-v1\",1,\"demo-f09\",\"owner\",\"https://f09.invalid\",\"batch-a\",\"ced74c01c77bcdb25de6ff8f3f3b315cd7b55339540a1382bc84760cad8227e9\",\"batch-a:2026-10-30\",\"2026-10-30\",\"nonce-original\",\"{\\\"k\\\":\\\"cas\\\",\\\"p\\\":[\\\"zoew_daily_pickup_cod_dod\\\",\\\"2026-10-30\\\"],\\\"x\\\":null,\\\"v\\\":{\\\"pickupRevision\\\":1,\\\"pickupResetEpoch\\\":1,\\\"packagesPickedUp\\\":0,\\\"pickedUpPhones\\\":null,\\\"pickedUpBarcodes\\\":null}}\"]",
    "attemptId": "b9da1664a37f020c6fc2b841a54b0fe4428819c59a848d6ae5ba84bfd8b0985f"
  },
  {
    "name": "unicode-escaped",
    "tenant": "tenant-uuid",
    "actorUid": "owner \\\"\t\ud83d\ude00",
    "dates": [
      "2026-10-29",
      "2026-10-30"
    ],
    "context": {
      "v": 1,
      "scope": "https://\u4f8b\u3048.invalid/\u5e97\\\n",
      "batchId": "batch-b",
      "batchHash": "0455236daeb826dbb353ac041bc189e97957a17f445dafb5875aca8006fcd4d7",
      "dayId": "batch-b:2026-10-30",
      "day": "2026-10-30",
      "nonce": "nonce-original"
    },
    "casText": "{\"k\":\"cas\",\"p\":[\"zoew_daily_pickup_cod_dod\",\"2026-10-30\"],\"x\":{\"pickupRevision\":3,\"pickupResetEpoch\":1,\"packagesPickedUp\":1,\"pickedUpBarcodes\":{\"STRASSE\ud83d\ude00\":\"0001\"}},\"v\":{\"pickupRevision\":4,\"pickupResetEpoch\":2,\"packagesPickedUp\":0,\"pickedUpPhones\":null,\"pickedUpBarcodes\":null}}",
    "batchPreimage": "[\"zoew-pickup-reset-batch-v1\",1,\"tenant-uuid\",\"https://\u4f8b\u3048.invalid/\u5e97\\\\\\n\",\"owner \\\\\\\"\\t\ud83d\ude00\",\"batch-b\",[\"2026-10-29\",\"2026-10-30\"]]",
    "batchHash": "0455236daeb826dbb353ac041bc189e97957a17f445dafb5875aca8006fcd4d7",
    "attemptPreimage": "[\"zoew-pickup-reset-attempt-v1\",1,\"tenant-uuid\",\"owner \\\\\\\"\\t\ud83d\ude00\",\"https://\u4f8b\u3048.invalid/\u5e97\\\\\\n\",\"batch-b\",\"0455236daeb826dbb353ac041bc189e97957a17f445dafb5875aca8006fcd4d7\",\"batch-b:2026-10-30\",\"2026-10-30\",\"nonce-original\",\"{\\\"k\\\":\\\"cas\\\",\\\"p\\\":[\\\"zoew_daily_pickup_cod_dod\\\",\\\"2026-10-30\\\"],\\\"x\\\":{\\\"pickupRevision\\\":3,\\\"pickupResetEpoch\\\":1,\\\"packagesPickedUp\\\":1,\\\"pickedUpBarcodes\\\":{\\\"STRASSE\ud83d\ude00\\\":\\\"0001\\\"}},\\\"v\\\":{\\\"pickupRevision\\\":4,\\\"pickupResetEpoch\\\":2,\\\"packagesPickedUp\\\":0,\\\"pickedUpPhones\\\":null,\\\"pickedUpBarcodes\\\":null}}\"]",
    "attemptId": "1a88cdd6c7c0e0ec6e45ab4a2a9e8429c604e461e15cf67b6b8f0ad52844e46d"
  },
  {
    "name": "exact-cas-number-text",
    "tenant": "tenant-uuid",
    "actorUid": "owner",
    "dates": [
      "2026-10-30"
    ],
    "context": {
      "v": 1,
      "scope": "scope",
      "batchId": "batch-c",
      "batchHash": "d62eb4ea5b14d444a11ed2ace26bc22c7fd38c39327fc2599be82ac9889216de",
      "dayId": "batch-c:2026-10-30",
      "day": "2026-10-30",
      "nonce": "nonce-original"
    },
    "casText": "{ \"k\":\"cas\", \"p\":[\"zoew_daily_pickup_cod_dod\",\"2026-10-30\"], \"x\":{\"pickupRevision\":3,\"pickupResetEpoch\":1,\"packagesPickedUp\":1.000,\"legacyRatio\":1e-7}, \"v\":{\"pickupRevision\":4,\"pickupResetEpoch\":2,\"packagesPickedUp\":0,\"pickedUpPhones\":null,\"pickedUpBarcodes\":null} }",
    "batchPreimage": "[\"zoew-pickup-reset-batch-v1\",1,\"tenant-uuid\",\"scope\",\"owner\",\"batch-c\",[\"2026-10-30\"]]",
    "batchHash": "d62eb4ea5b14d444a11ed2ace26bc22c7fd38c39327fc2599be82ac9889216de",
    "attemptPreimage": "[\"zoew-pickup-reset-attempt-v1\",1,\"tenant-uuid\",\"owner\",\"scope\",\"batch-c\",\"d62eb4ea5b14d444a11ed2ace26bc22c7fd38c39327fc2599be82ac9889216de\",\"batch-c:2026-10-30\",\"2026-10-30\",\"nonce-original\",\"{ \\\"k\\\":\\\"cas\\\", \\\"p\\\":[\\\"zoew_daily_pickup_cod_dod\\\",\\\"2026-10-30\\\"], \\\"x\\\":{\\\"pickupRevision\\\":3,\\\"pickupResetEpoch\\\":1,\\\"packagesPickedUp\\\":1.000,\\\"legacyRatio\\\":1e-7}, \\\"v\\\":{\\\"pickupRevision\\\":4,\\\"pickupResetEpoch\\\":2,\\\"packagesPickedUp\\\":0,\\\"pickedUpPhones\\\":null,\\\"pickedUpBarcodes\\\":null} }\"]",
    "attemptId": "a113402088e6a69f14e1dd3af0be959dc144bf838a565e60f44074cfcde736f6"
  }
];
beforeEach(() => vi.stubGlobal('crypto', webcrypto));
afterEach(() => vi.unstubAllGlobals());
const first = () => structuredClone(VECTORS[0]);

it.each(VECTORS)('F09 immutable codec vector $name exact preimages/SHA256', async vector => {
    const { tenant, actorUid, context, dates, casText } = vector;
    expect(pickupResetBatchPreimage(tenant, context.scope, actorUid, context.batchId, dates)).toBe(vector.batchPreimage);
    expect(await pickupResetBatchHash(tenant, context.scope, actorUid, context.batchId, dates)).toBe(vector.batchHash);
    expect(pickupResetAttemptPreimage(tenant, actorUid, context, casText)).toBe(vector.attemptPreimage);
    expect(await pickupResetAttemptId(tenant, actorUid, context, casText)).toBe(vector.attemptId);
});
it('F09 ordinary valid original basis builds exact base CAS without receipt', () => {
    const v = first(), parsed = pickupResetCasOf(v.casText)!;
    expect(pickupResetCasText(v.context.day, null, parsed.operation.v)).toBe(v.casText);
    expect(parsed).toMatchObject({ beforeRevision: 0, beforeEpoch: 0, afterRevision: 1, afterEpoch: 1 });
});
it.each(['tenant', 'actorUid', 'scope', 'batchId', 'batchHash', 'dayId', 'day', 'nonce', 'casText'])('F09 changed original %s cannot retain original attempt ID', async field => {
    const v = first();
    if (field === 'tenant' || field === 'actorUid') v[field] += '-changed';
    else if (field === 'casText') v.casText += ' ';
    else if (field === 'day') v.context.day = '2026-10-31';
    else if (field === 'batchHash') v.context.batchHash = 'f'.repeat(64);
    else v.context[field] += '-changed';
    expect(await pickupResetAttemptId(v.tenant, v.actorUid, v.context, v.casText)).not.toBe(VECTORS[0].attemptId);
});
it.each([null, {}, { ...VECTORS[0].context, extra: true }, { ...VECTORS[0].context, batchHash: ['a'.repeat(64)] },
    { ...VECTORS[0].context, dayId: 'foreign-day' }])('F09 malformed context is not promoted (%j)', context => {
    expect(pickupResetContextOf(context)).toBeNull();
});
it.each(['\u0000', '\ud800', '\udc00'])('F09 forbidden Unicode scalar %j cannot enter content-addressed context', async bad => {
    const v = first(); v.context.scope += bad;
    expect(pickupResetContextOf(v.context)).toBeNull();
    expect(await pickupResetAttemptId(v.tenant, v.actorUid, v.context, v.casText)).toBeNull();
});
it.each(['extra', 'increment', 'wrong-day', 'null-meta', 'partial-meta', 'wrong-revision', 'wrong-epoch', 'receipt-in-base', 'max-meta'])('F09 non-reset CAS shape %s rejected', kind => {
    const parsed = JSON.parse(VECTORS[0].casText);
    if (kind === 'extra') parsed.extra = true;
    if (kind === 'increment') parsed.k = 'inc';
    if (kind === 'wrong-day') parsed.p[1] = 'not-a-day';
    if (kind === 'null-meta') parsed.x = { pickupRevision: null, pickupResetEpoch: null };
    if (kind === 'partial-meta') parsed.x = { pickupRevision: 1 };
    if (kind === 'wrong-revision') parsed.v.pickupRevision = 2;
    if (kind === 'wrong-epoch') parsed.v.pickupResetEpoch = 2;
    if (kind === 'receipt-in-base') parsed.v.pickupResetApplied = {};
    if (kind === 'max-meta') parsed.x = { pickupRevision: 9007199254740990, pickupResetEpoch: 0 };
    expect(pickupResetCasOf(JSON.stringify(parsed))).toBeNull();
});
it('F09 exact typed receipt roundtrip and unknown/foreign/malformed stay unresolved', async () => {
    const v = first(), expected = pickupResetAppliedReceipt(v.tenant, v.actorUid, v.context, v.attemptId, v.casText, 'native-day')!;
    expect(pickupResetReceiptOf(expected)).toEqual(expected);
    expect(await pickupResetBoundReceipt(v.tenant, v.actorUid, v.context, v.attemptId, v.casText, 'native-day')).toEqual(expected);
    expect(pickupResetReceiptMatches({ ...expected }, expected)).toBe(true);
    for (const actual of [null, {}, { ...expected, outcome: 'unknown' }, { ...expected, actorUid: 'foreign' },
        { ...expected, scope: 'foreign' }, { ...expected, nonce: 'foreign' }, { ...expected, extra: true },
        { ...expected, intentHash: 'f'.repeat(64) }, { ...expected, afterRevision: 2 }]) {
        expect(pickupResetReceiptMatches(actual, expected)).toBe(false);
    }
    expect(await pickupResetBoundReceipt(v.tenant, v.actorUid, v.context, 'f'.repeat(64), v.casText, 'native-day')).toBeNull();
});
it('F09 ordered All32 batch hash remains supported without sorting or a new date cap', async () => {
    const days = Array.from({ length: 32 }, (_, index) => new Date(Date.UTC(2026, 9, index + 1)).toISOString().slice(0, 10));
    expect(await pickupResetBatchHash('tenant', 'scope', 'actor', 'batch', days)).toMatch(/^[a-f0-9]{64}$/);
    expect(await pickupResetBatchHash('tenant', 'scope', 'actor', 'batch', days.slice().reverse())).not.toBe(await pickupResetBatchHash('tenant', 'scope', 'actor', 'batch', days));
    expect(pickupResetBatchPreimage('tenant', 'scope', 'actor', 'batch', [days[0], days[0]])).toBeNull();
});

it('F09 codec does not introduce scope/nonce/legacy-basis length policies', async () => {
    const v = first(); v.context.scope = 's'.repeat(4097); v.context.nonce = 'n'.repeat(4097);
    expect(pickupResetContextOf(v.context)).not.toBeNull();
    const parsed = JSON.parse(v.casText); parsed.x = { legacyNote: 'x'.repeat(4097) };
    const casText = JSON.stringify(parsed);
    expect(pickupResetCasOf(casText)).not.toBeNull();
    expect(await pickupResetAttemptId(v.tenant, v.actorUid, v.context, casText)).toMatch(/^[a-f0-9]{64}$/);
});
it('F09 digest unavailability is unresolved null, not an unhandled exception or fresh identity', async () => {
    const v = first(); vi.stubGlobal('crypto', { subtle: { digest: async () => { throw new Error('Synthetic digest unavailable'); } } });
    expect(await pickupResetAttemptId(v.tenant, v.actorUid, v.context, v.casText)).toBeNull();
    expect(await pickupResetBatchHash(v.tenant, v.context.scope, v.actorUid, v.context.batchId, v.dates)).toBeNull();
    expect(await pickupResetBoundReceipt(v.tenant, v.actorUid, v.context, v.attemptId, v.casText, 'native-day')).toBeNull();
});
it('F09 bound receipt snapshots original context before asynchronous digest', async () => {
    const v = first();
    const expected = pickupResetAppliedReceipt(v.tenant, v.actorUid, v.context, v.attemptId, v.casText, 'native-day');
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    vi.stubGlobal('crypto', { subtle: { digest: async (algorithm: any, bytes: any) => { await gate; return webcrypto.subtle.digest(algorithm, bytes); } } });
    const pending = pickupResetBoundReceipt(v.tenant, v.actorUid, v.context, v.attemptId, v.casText, 'native-day');
    v.context.nonce = 'changed-while-hashing';
    release();
    expect(await pending).toEqual(expected);
});
