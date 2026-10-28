// Checker audit (deep audit 8 · C4): `pickupTruthMarks()` had no behavioural guard (a mutation survived every test):
// a barcode is closed when any copy of it (history or trash) is closed — never «the last copy read wins» (a resume would
// delete a counted pickup key).
import { describe, expect, it } from 'vitest';
import { pickupBarcodeKey, pickupTruthMarks } from '../src/domain/pickup';

const DAY = '2026-10-20';
const bc = (code: string, closed: boolean) => ({ code, isClosed: closed, closedAt: closed ? 1760000000000 : undefined, cod: 1, dod: 0, isDeducted: false });
const item = (id: string, barcodes: any[], extra: any = {}) => ({ id, phone: '0961234567', scanDate: DAY, barcodes, ...extra });

describe('C4 ៖ Barcode បិទ ពេលច្បាប់ចម្លងណាមួយបិទ', () => {
    const key = pickupBarcodeKey('ZTC4X1');
    it('history copy closed · trash copy open ➜ closed', () => {
        const marks = pickupTruthMarks(DAY, [key], [item('h1', [bc('ZTC4X1', true)])], [item('t1', [bc('ZTC4X1', false)], { trashReason: 'remove' })]);
        expect(marks.map((m: any) => [m.key, m.closed])).toEqual([[key, true]]);
    });

    it('history copy open · trash copy closed ➜ closed', () => {
        const marks = pickupTruthMarks(DAY, [key], [item('h1', [bc('ZTC4X1', false)])], [item('t1', [bc('ZTC4X1', true)], { trashReason: 'pickup' })]);
        expect(marks.map((m: any) => [m.key, m.closed])).toEqual([[key, true]]);
    });
});
