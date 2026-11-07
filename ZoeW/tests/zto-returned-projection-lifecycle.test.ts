import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { dataState } from '../src/core/state';
import { appLocalStore } from '../src/core/storage';
import { applyZtoFinalMarks, barcodeZtoLeftKind, collectZtoFinalTargets, noteZtoReturnedEvidence, resetZtoFinalMarks, trashItemLeftBranch, trashRestoreBlockOf } from '../src/features/zto-final-marks';

const code = 'SYNTHETIC-RETURN-1';
function trash(extra = {}, parentCreatedAt = 100) {
    return { id: 'synthetic-trash', createdAt: parentCreatedAt, trashMode: 'cookie', trashReason: 'returned',
        barcodes: [{ code, createdAt: 100, isClosed: false, ...extra }] };
}
beforeEach(() => { appLocalStore.clear(); resetZtoFinalMarks(); dataState.scanHistory = []; dataState.deletedItems = []; });
afterEach(() => { resetZtoFinalMarks(); appLocalStore.clear(); });

describe('Return evidence projection respects parcel lifecycle like the stamp writer', () => {
    it.each([{ restoredAt: 300 }, { createdAt: 300 }, { createdAt: undefined }])('old return cannot block a newer lifecycle %j', (extra) => {
        const current = trash(extra, 300);
        noteZtoReturnedEvidence(code, 200);
        expect(applyZtoFinalMarks(structuredClone(current), { [code]: { returned: 200 } }, true)).toBeUndefined();
        expect(trashRestoreBlockOf(current, true)).toBe('');
    });
    it.each(['sent', 'misplaced', 'left'].flatMap(kind => [{ kind, extra: { restoredAt: 300 } }, { kind, extra: { createdAt: undefined } }]))('old $kind cannot override a new lifecycle $extra', ({ kind, extra }) => {
        const current = trash({ ...extra, ztoReturnedAt: 400 }, 300);
        noteZtoReturnedEvidence(code, 200, kind);
        expect(trashItemLeftBranch(current)).toBe(false);
        expect(trashRestoreBlockOf(current, true)).toBe('returned');
    });
    it.each(['returned', 'sent', 'misplaced'])('stale %s is not queued for repeated final marking', (kind) => {
        noteZtoReturnedEvidence(code, 200, kind);
        dataState.deletedItems = [trash({ restoredAt: 300 })];
        expect(collectZtoFinalTargets()).toEqual([]);
    });
    it.each([undefined, null, NaN, {}, []])('projection safely accepts %j', (value) => {
        expect(barcodeZtoLeftKind(value)).toBe('');
        expect(trashRestoreBlockOf(value, true)).toBe('');
    });
    it('return evidence at the lifecycle boundary still blocks', () => {
        noteZtoReturnedEvidence(code, 300);
        expect(trashRestoreBlockOf(trash({ restoredAt: 300 }), true)).toBe('returned');
    });
    it.each(['sent', 'misplaced', 'left'])('current %s evidence still projects as leaving branch', (kind) => {
        noteZtoReturnedEvidence(code, 300, kind);
        expect(trashItemLeftBranch(trash({ restoredAt: 300 }))).toBe(true);
    });
});
