// M2 (deep audit 8): between a restore's prepare and its finalize the same barcode sits in history (open, its `isDeducted`
// stripped) and in its trash source (holding `restoreClaim`). `uncollectedValueByDate()` counted both: a Delete source
// (not deducted) was subtracted twice from «ចំណូល (យករួច)», a Remove/returned source (deducted, ledger not yet credited)
// once although the ledger no longer holds it. While the source holds its claim, the trash copy alone decides — the money
// state does not change before the finalize.
import { beforeEach, describe, expect, it } from 'vitest';
import { dataState } from '../src/core/state';
import { uncollectedValueByDate } from '../src/features/export';

const DAY = '2026-10-20';
const bc = (code: string, cod: number, extra: any = {}) => ({ code, cod, dod: 0, isClosed: false, isDeducted: false, ...extra });

beforeEach(() => { dataState.scanHistory = []; dataState.deletedItems = []; });

describe('M2 ៖ barcode ដែលកំពុងស្តារ រាប់តែម្តង តាមច្បាប់ក្នុងធុងសំរាម', () => {
    for (const [reason, deducted, open] of [['delete', false, 10], ['remove', true, 0], ['returned', true, 0]] as const) {
        it(reason + ' source holding its claim ➜ uncollected ' + open + ' (the history copy is not counted again)', () => {
            dataState.scanHistory = [{ id: 'row1', scanDate: DAY, phone: '012', restoreClaimId: 'trash1', restoreClaimToken: 'tok', restoreAddedCodes: JSON.stringify(['X1']),
                barcodes: [bc('X1', 10, { restoredAt: 1 }), bc('KEEP', 5)] }] as any;
            dataState.deletedItems = [{ id: 'trash1', scanDate: DAY, phone: '012', trashReason: reason, restoreClaim: { token: 'tok', claimedAt: 1 },
                barcodes: [bc('X1', 10, { isDeducted: deducted })] }] as any;
            expect(uncollectedValueByDate()[DAY]).toEqual({ cod: open + 5, dod: 0 });
        });
    }

    it('control ៖ after the finalize (no trash source) the history copy counts', () => {
        dataState.scanHistory = [{ id: 'row1', scanDate: DAY, phone: '012', barcodes: [bc('X1', 10), bc('KEEP', 5)] }] as any;
        expect(uncollectedValueByDate()[DAY]).toEqual({ cod: 15, dod: 0 });
    });
});
