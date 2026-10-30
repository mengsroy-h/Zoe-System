import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { firebaseState } from '../src/core/state';
import { TRASH_GENERATION_MAX, trashConsumptionOf, trashConsumptionSame, trashConsumptionValid, trashGenerationOf, trashSourceUnconsumed } from '../src/domain/trash-generation';
import { allocateTrashGeneration, captureTrashGenerationOwner, readTrashConsumption } from '../src/services/trash-generation';

const HOST = 'https://generation-proof.firebaseio.com';
const source = (generation?: number) => ({ id: 'source', deletedAt: 100, createdAt: 50, ...(generation === undefined ? {} : { trashGeneration: generation }) });
const owner = { uid: 'member', scope: HOST };
const receipt = (generation = 0) => trashConsumptionOf(source(generation), 'purge', owner)!;

it.each([null, false, true, '0', -1, 1.5, NaN, Infinity, TRASH_GENERATION_MAX + 1, undefined])('generation ៖ present %s ខូចមិនបម្លែងទៅ legacy0', value => {
    expect(trashGenerationOf({ trashGeneration: value })).toBeNull();
});
it('generation ៖ absent និង explicit0 ជា legacy តែ max មានព្រំដែន', () => {
    expect(trashGenerationOf(source())).toBe(0); expect(trashGenerationOf(source(0))).toBe(0); expect(trashGenerationOf(source(TRASH_GENERATION_MAX))).toBe(TRASH_GENERATION_MAX);
    expect(trashSourceUnconsumed(source(), null)).toBe(true); expect(trashSourceUnconsumed(source(1), null)).toBe(true); expect(trashSourceUnconsumed(source(2), null)).toBe(false);
    expect(trashSourceUnconsumed(source(0), undefined)).toBe(false); expect(trashSourceUnconsumed(source(1), receipt(0))).toBe(true);
    expect(trashSourceUnconsumed(source(0), receipt(0))).toBe(false); expect(trashSourceUnconsumed(source(3), receipt(1))).toBe(false);
    expect(trashSourceUnconsumed(source(TRASH_GENERATION_MAX), receipt(TRASH_GENERATION_MAX))).toBe(false);
});
it('generation ៖ receipt restore10 និង purge8 ប្រៀបធៀប exact tuple', () => {
    const restore = trashConsumptionOf(source(2), 'restore', owner, 'restore_token', 'target')!;
    expect(Object.keys(restore)).toHaveLength(10); expect(trashConsumptionValid(restore)).toBe(true);
    expect(Object.keys(receipt())).toHaveLength(8); expect(trashConsumptionSame(restore, { ...restore })).toBe(true);
    for (const key of Object.keys(restore)) expect(trashConsumptionSame(restore, { ...restore, [key]: typeof restore[key] === 'number' ? restore[key] + 1 : 'other' })).toBe(false);
    expect(trashConsumptionValid({ ...receipt(), token: 'extra' })).toBe(false);
});
it.each(['sourceId', 'generation', 'actorUid', 'scope', 'deletedAt', 'rowBirth', 'v', 'kind'])('generation ៖ receipt field %s បាត់មិនជាភស្តុតាង', field => {
    const value: any = receipt(); delete value[field]; expect(trashConsumptionValid(value)).toBe(false); expect(trashSourceUnconsumed(source(1), value)).toBe(false);
});

let value: any, fail: boolean, afterRead: (() => void) | null;
beforeEach(() => {
    localStorage.clear(); localStorage.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: HOST }));
    value = null; fail = false; afterRead = null; firebaseState.authGeneration++;
    firebaseState.db = { app: { options: { databaseURL: HOST } } } as any; firebaseState.auth = { currentUser: { uid: 'member' } } as any;
    firebaseState.fb = { ref: (_db: any, path: string) => ({ path, toString: () => 'supabase:' + path }), get: async () => {
        if (fail) throw new Error('unknown'); const saved = value; afterRead?.(); return { val: () => saved };
    } } as any;
});
afterEach(() => { firebaseState.authGeneration++; vi.restoreAllMocks(); });
it('generation ៖ fresh allocation ក្រោយ known absence ឬ K តែពេល current', async () => {
    const captured = captureTrashGenerationOwner()!;
    expect(await allocateTrashGeneration('source', captured)).toBe(1);
    value = receipt(4); expect(await allocateTrashGeneration('source', captured)).toBe(5);
    value = receipt(TRASH_GENERATION_MAX); expect(await allocateTrashGeneration('source', captured)).toBeNull();
});
it.each(['unknown', 'undefined', 'malformed', 'foreign-source', 'foreign-scope'])('generation ៖ read %s មិនមែន absence', async kind => {
    const captured = captureTrashGenerationOwner()!;
    if (kind === 'unknown') fail = true;
    if (kind === 'undefined') value = undefined;
    if (kind === 'malformed') value = { generation: 0 };
    if (kind === 'foreign-source') value = { ...receipt(), sourceId: 'other' };
    if (kind === 'foreign-scope') value = { ...receipt(), scope: 'other' };
    expect(await readTrashConsumption('source', captured)).toEqual({ ok: false }); expect(await allocateTrashGeneration('source', captured)).toBeNull();
});
it.each(['db', 'sdk', 'uid', 'scope', 'authGeneration'])('generation ៖ read ក្រោយ %s ប្ដូរត្រូវ HOLD', async kind => {
    const captured = captureTrashGenerationOwner()!;
    afterRead = () => {
        if (kind === 'db') firebaseState.db = { other: true } as any;
        if (kind === 'sdk') firebaseState.fb = { ...firebaseState.fb };
        if (kind === 'uid') firebaseState.auth.currentUser.uid = 'other';
        if (kind === 'scope') (firebaseState.db as any).app.options.databaseURL = HOST + '/other';
        if (kind === 'authGeneration') firebaseState.authGeneration++;
    };
    expect(await readTrashConsumption('source', captured)).toEqual({ ok: false });
});
