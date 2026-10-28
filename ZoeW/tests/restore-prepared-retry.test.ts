// Checker audit (deep audit 8 · C8): a restore retry that finds its target already prepared by the same source
// (`restoreClaimId`) but missing some of the source's codes (another device removed them meanwhile) stops with
// `RESTORE_RECOVERY_REQUIRED` (held, reported as a money event) ⛔ never re-inserts those codes: their removal already moved
// money, and a second insert would count them again. No scenario retried a prepared restore after the target lost codes.
import { beforeEach, describe, expect, it } from 'vitest';
import { firebaseState } from '../src/core/state';
import { applyClaimedRestoreToHistory } from '../src/features/restore';

const H = 'zoew_scan_history_cod_dod';
const store: Record<string, any> = {};
const clone = (v: any) => (v === undefined ? null : JSON.parse(JSON.stringify(v)));
const bc = (code: string) => ({ code, cod: 2, dod: 0, isClosed: false, isDeducted: false });
const source = { id: 'trash1', phone: '012000111', scanDate: '2026-10-20', barcodes: [bc('R1'), bc('R2')] };
const merge = (target: any, codes: string[]) => {
    target.barcodes = target.barcodes || [];
    for (const b of source.barcodes) if (codes.includes(b.code) && !target.barcodes.some((x: any) => x.code === b.code)) target.barcodes.push(clone(b));
    return target;
};

beforeEach(() => {
    for (const k of Object.keys(store)) delete store[k];
    firebaseState.db = { restore: true } as any;
    firebaseState.fb = {
        ref: (_db: unknown, path: string) => ({ path }),
        runTransaction: async (ref: any, fn: any) => {
            const next = fn(clone(store[ref.path]));
            if (next === undefined) return { committed: false, snapshot: { val: () => clone(store[ref.path]) } };
            store[ref.path] = clone(next);
            return { committed: true, snapshot: { val: () => clone(store[ref.path]) } };
        }
    } as any;
});

describe('C8 ៖ ការស្តារម្តងទៀតលើគោលដៅដែលរៀបរួច ហើយបាត់កូដ', () => {
    it('a prepared target that lost R2 ➜ RESTORE_RECOVERY_REQUIRED, nothing written', async () => {
        const prepared = { id: 'row1', phone: '012000111', scanDate: '2026-10-20', restoreClaimId: 'trash1', restoreClaimToken: 'tok',
            restoreAddedCodes: JSON.stringify(['R1', 'R2']), barcodes: [bc('R1')] };
        store[H + '/row1'] = clone(prepared);
        await expect(applyClaimedRestoreToHistory('row1', 'trash1', 'tok', clone(source), merge)).rejects.toThrow('RESTORE_RECOVERY_REQUIRED');
        expect(store[H + '/row1'].barcodes.map((b: any) => b.code)).toEqual(['R1']);
    });

    it('control ៖ a prepared target holding every code ➜ settles without inserting anything again', async () => {
        const prepared = { id: 'row1', phone: '012000111', scanDate: '2026-10-20', restoreClaimId: 'trash1', restoreClaimToken: 'tok',
            restoreAddedCodes: JSON.stringify(['R1', 'R2']), barcodes: [bc('R1'), bc('R2')] };
        store[H + '/row1'] = clone(prepared);
        const out = await applyClaimedRestoreToHistory('row1', 'trash1', 'tok', clone(source), merge);
        expect(out.targetChanged).toBe(false);
        expect(store[H + '/row1'].barcodes.map((b: any) => b.code)).toEqual(['R1', 'R2']);
    });
});
