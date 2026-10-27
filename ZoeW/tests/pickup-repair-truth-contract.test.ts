// Checker audit (deep audit 8 · C3 · C4): two pickup rules with no behavioural guard (a mutation of each survived every test).
// C3 `planPickupLedgerRepair()` rebuilds a day's barcode set only when the rebuilt set has exactly `packagesPickedUp` keys:
// after «Reset ចំនួនយករួច» and one new close the record holds 1 key while history holds 3 closed barcodes ➜ no repair (the
// Reset stays); without the gate the repair wrote all 3 back. C4 `pickupTruthMarks()`: a barcode is closed when any copy
// of it (history or trash) is closed — never «the last copy read wins» (a resume would delete a counted pickup key).
import { describe, expect, it } from 'vitest';
import { collectPickupMarks, pickupBarcodeKey, pickupTruthMarks, planPickupLedgerRepair } from '../src/domain/pickup';

const DAY = '2026-10-20';
const bc = (code: string, closed: boolean) => ({ code, isClosed: closed, closedAt: closed ? 1760000000000 : undefined, cod: 1, dod: 0, isDeducted: false });
const item = (id: string, barcodes: any[], extra: any = {}) => ({ id, phone: '0961234567', scanDate: DAY, barcodes, ...extra });

describe('C3 ៖ ការជួសជុល pickup មិននាំ Reset ត្រឡប់', () => {
    const history = [item('it1', [bc('ZTC3A1', true), bc('ZTC3B1', true), bc('ZTC3C1', true)])];
    const marks = collectPickupMarks(history[0]);

    it('Reset then one new close ➜ no repair plan', () => {
        const c1 = pickupBarcodeKey('ZTC3C1');
        const phone = marks.find((m: any) => m.key === c1).phoneKey;
        expect(planPickupLedgerRepair({ [DAY]: { packagesPickedUp: 1, pickedUpBarcodes: { [c1]: phone } } }, history, [])).toEqual([]);
    });

    it('control ៖ an old record counting the same 3 parcels without keys ➜ rebuilt from history', () => {
        const plans = planPickupLedgerRepair({ [DAY]: { packagesPickedUp: 3 } }, history, []);
        expect(plans.map((p: any) => [p.date, Object.keys(p.pickedUpBarcodes).sort()]))
            .toEqual([[DAY, ['ZTC3A1', 'ZTC3B1', 'ZTC3C1'].map(pickupBarcodeKey).sort()]]);
    });
});

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
