import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { dataState } from '../src/core/state';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { collectedValueIsMeasurable, collectedMoneyText } from '../src/features/export';

beforeEach(() => {
    dataState.scanHistory = [];
    dataState.deletedItems = [];
    dbListenerFailedPaths.clear();
    dbListenerPendingPaths.clear();
});
afterEach(() => {
    dataState.scanHistory = [];
    dataState.deletedItems = [];
    dbListenerFailedPaths.clear();
    dbListenerPendingPaths.clear();
});
describe('collected values require well-shaped authoritative row views', () => {
    for (const field of ['scanHistory', 'deletedItems'] as const) {
        it.each([null, undefined, {}, 'rows', [null], [undefined], [false], [3], ['row'], [[]]])(
            `${field}: malformed view %j stays unknown without throwing`, (value) => {
                dataState[field] = value as any;
                expect(collectedValueIsMeasurable()).toBe(false);
                expect(collectedMoneyText(17, collectedValueIsMeasurable())).not.toBe('$0.00');
                expect(collectedMoneyText(17, collectedValueIsMeasurable())).not.toBe('$17.00');
            });
    }
    it('valid empty and legacy row arrays remain measurable', () => {
        expect(collectedValueIsMeasurable()).toBe(true);
        dataState.scanHistory = [{ id: 'legacy', barcodes: [] }] as any;
        dataState.deletedItems = [{ id: 'old', barcodes: [] }] as any;
        expect(collectedValueIsMeasurable()).toBe(true);
        expect(collectedMoneyText(17, true)).toBe('$17.00');
    });
    it('fresh row shape does not bypass stale listener gates', () => {
        dbListenerPendingPaths.add('history');
        expect(collectedValueIsMeasurable()).toBe(false);
    });
});
