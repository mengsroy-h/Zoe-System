import { describe, expect, it } from 'vitest';
import { applyZtoFinalMarks } from '../src/features/zto-final-marks';

const code = 'KH1000000088';
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const wishes = [
    { returned: 200 },
    { returned: 200, misplaced: true },
    { sentOut: 200 }
];

function record(extra = {}) {
    return { id: 'return-basis', createdAt: 100, trashReason: 'returned', trashMode: 'cookie',
        barcodes: [{ code, createdAt: 100, isClosed: false, cod: 3, dod: 1, ...extra }] };
}

describe('ត្រា ZTO ត្រឡប់ ៖ ភស្តុតាងត្រូវស្ថិតក្នុងវគ្គកញ្ចប់បច្ចុប្បន្ន', () => {
    it.each(wishes)('ភស្តុតាង %j មុនស្តារ ➜ មិនកត់ត្រាក្នុងវគ្គថ្មី', (wish) => {
        const current = record({ restoredAt: 300 });
        const before = clone(current);
        expect(applyZtoFinalMarks(current, { [code]: wish }, true)).toBeUndefined();
        expect(current).toEqual(before);
    });

    it.each(wishes)('ភស្តុតាង %j មុនចូលកញ្ចប់ថ្មី ➜ មិនកត់ត្រា', (wish) => {
        const current = record({ createdAt: 300 });
        expect(applyZtoFinalMarks(current, { [code]: wish }, true)).toBeUndefined();
    });

    it.each(wishes)('ភស្តុតាង %j នៅព្រំស្តារ ➜ កត់ម្ដង និងរក្សាលុយ', (wish) => {
        const current = record({ restoredAt: 200 });
        expect(applyZtoFinalMarks(current, { [code]: wish }, true)).toBe(current);
        expect(current.barcodes[0]).toMatchObject({ cod: 3, dod: 1, restoredAt: 200 });
        expect(applyZtoFinalMarks(current, { [code]: wish }, true)).toBeUndefined();
    });

    it('ហៅ helper ផ្ទាល់លើទិន្នន័យមុននិងក្រោយស្តារ ➜ បដិសេធភស្តុតាងចាស់', () => {
        const wish = { [code]: { returned: 200 } };
        expect(applyZtoFinalMarks(record(), wish, true)).toBeTruthy();
        expect(applyZtoFinalMarks(record({ restoredAt: 300 }), wish, true)).toBeUndefined();
    });

    it.each(wishes)('ភស្តុតាង %j ៖ គ្មានម៉ោង barcode ➜ ប្រើម៉ោងចូលរបស់ជួរដេក', (wish) => {
        const stale = record({ createdAt: undefined });
        stale.createdAt = 300;
        expect(applyZtoFinalMarks(stale, { [code]: wish }, true)).toBeUndefined();
        const boundary = record({ createdAt: undefined });
        boundary.createdAt = 200;
        expect(applyZtoFinalMarks(boundary, { [code]: wish }, true)).toBe(boundary);
        expect(applyZtoFinalMarks(boundary, { [code]: wish }, true)).toBeUndefined();
    });

    it.each(wishes)('ភស្តុតាង %j ៖ ជួររួមកត់តែកញ្ចប់ស្របវគ្គ ហើយរក្សាលុយ និងត្រា Sign', (wish) => {
        const freshCode = 'KH1000000089';
        const current = { ...record(), cod: 9, dod: 2, isDeducted: true, restoreBlocked: true,
            barcodes: [
                { code, createdAt: 100, restoredAt: 300, isClosed: false, cod: 3, dod: 1, ztoSignedAt: 150, ztoSignedExact: true },
                { code: freshCode, createdAt: 100, restoredAt: 100, isClosed: false, cod: 6, dod: 1, ztoSignedAt: 150, ztoSignedExact: true }
            ] };
        const expected = clone(current);
        const fresh = expected.barcodes[1];
        if ('returned' in wish) Object.assign(fresh, { ztoReturnedAt: 200 });
        if ('misplaced' in wish) Object.assign(fresh, { ztoMisplacedAt: 200 });
        if ('sentOut' in wish) Object.assign(fresh, { ztoSentOutAt: 200 });
        const wanted = { [code]: wish, [freshCode]: wish };
        expect(applyZtoFinalMarks(current, wanted, true)).toBe(current);
        expect(current).toEqual(expected);
        expect(applyZtoFinalMarks(current, wanted, true)).toBeUndefined();
        expect(current).toEqual(expected);
    });

});
