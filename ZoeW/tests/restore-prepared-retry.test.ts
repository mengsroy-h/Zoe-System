// Checker audit (deep audit 8 · C8 · A413): a restore retry that finds its target already prepared by the same source
// (`restoreClaimId`) but missing some of the source's codes (they left the row meanwhile) finishes with the codes the row
// still holds and reports the rest (`lost`) ⛔ never re-inserts them: whoever removed the copy already treated it as
// restored, and a second insert would count it again. Provenance is needed only to cancel, never to finish.
import { beforeEach, describe, expect, it } from 'vitest';
import { firebaseState } from '../src/core/state';
import { applyClaimedRestoreToHistory } from '../src/features/restore';

const H = 'zoew_scan_history_cod_dod';
const store: Record<string, any> = {};
const clone = (v: any) => (v === undefined ? null : JSON.parse(JSON.stringify(v)));
const bc = (code: string) => ({ code, cod: 2, dod: 0, isClosed: false, isDeducted: false });
const source = { id: 'trash1', phone: '012000111', scanDate: '2026-10-20', barcodes: [bc('R1'), bc('R2')] };
const merge = (target: any, addedCodes: string[], insertMissing = true) => {
    target.barcodes = target.barcodes || [];
    for (const b of source.barcodes) {
        const existing = target.barcodes.find((x: any) => x.code === b.code);
        if (!existing) { if (insertMissing) target.barcodes.push(clone(b)); }
        else if (target.restoreClaimId === source.id && addedCodes.includes(b.code)) existing.restoredAt = 99;
    }
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

describe('C8 · A413 ៖ ការស្តារម្តងទៀតលើគោលដៅដែលរៀបរួច ហើយបាត់កូដ', () => {
    it('a prepared target that lost R2 ➜ settles with R1 only · R2 never re-inserted · reported as lost · markers kept for the finalize', async () => {
        const prepared = { id: 'row1', phone: '012000111', scanDate: '2026-10-20', restoreClaimId: 'trash1', restoreClaimToken: 'tok',
            restoreAddedCodes: JSON.stringify(['R1', 'R2']), barcodes: [bc('R1')] };
        store[H + '/row1'] = clone(prepared);
        const out = await applyClaimedRestoreToHistory('row1', 'trash1', 'tok', clone(source), merge);
        expect(out).toMatchObject({ targetChanged: false, lost: ['R2'] });
        expect(store[H + '/row1'].barcodes.map((b: any) => b.code)).toEqual(['R1']);
        expect(store[H + '/row1']).toMatchObject({ restoreClaimId: 'trash1', restoreClaimToken: 'tok', restoreAddedCodes: prepared.restoreAddedCodes });
    });

    it('a prepared target without provenance holding every code ➜ settles (provenance only matters to cancel) · nothing refreshed', async () => {
        const prepared = { id: 'row1', phone: '012000111', scanDate: '2026-10-20', restoreClaimId: 'trash1', restoreClaimToken: 'tok',
            barcodes: [bc('R1'), bc('R2')] };
        store[H + '/row1'] = clone(prepared);
        const out = await applyClaimedRestoreToHistory('row1', 'trash1', 'tok', clone(source), merge);
        expect(out).toMatchObject({ targetChanged: false, lost: [] });
        expect(store[H + '/row1'].barcodes).toEqual(prepared.barcodes);
        expect(store[H + '/row1'].restoreAddedCodes).toBeUndefined();
    });

    it.each([['an empty list', []], ['no barcodes field', undefined]])('a prepared target that lost every code (%s) ➜ settles · every code reported lost · nothing re-inserted', async (_label, barcodes) => {
        const prepared: any = { id: 'row1', phone: '012000111', scanDate: '2026-10-20', restoreClaimId: 'trash1', restoreClaimToken: 'tok',
            restoreAddedCodes: JSON.stringify(['R1', 'R2']) };
        if (barcodes) prepared.barcodes = barcodes;
        store[H + '/row1'] = clone(prepared);
        const out = await applyClaimedRestoreToHistory('row1', 'trash1', 'tok', clone(source), merge);
        expect(out).toMatchObject({ targetChanged: false, lost: ['R1', 'R2'] });
        expect(store[H + '/row1'].barcodes || []).toEqual([]);
        expect(store[H + '/row1']).toMatchObject({ restoreClaimId: 'trash1', restoreClaimToken: 'tok', restoreAddedCodes: prepared.restoreAddedCodes });
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
