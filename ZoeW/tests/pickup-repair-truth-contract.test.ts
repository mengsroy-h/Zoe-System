// Checker audit (deep audit 8 · C4): `pickupTruthMarks()` had no behavioural guard (a mutation survived every test):
// a barcode is closed when any copy of it (history or trash) is closed — never «the last copy read wins» (a resume would
// delete a counted pickup key).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { pickupBarcodeKey, pickupTruthMarks, readPickupTruthViews } from '../src/domain/pickup';
import { firebaseState } from '../src/core/state';
import { TX_OUTCOME_READ_TIMEOUT_MS } from '../src/services/tx-outcome';

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

// Re-audit A444 ៖ the pickup repair (resume · heal · rejected-close revert) reads both whole roots (history · trash, several MB in a big
// shop) within the 8 s outcome budget ➜ on a slow link it never finished and «យករួច» stayed unrepaired. Whole roots get the root budget.
describe('A444 ៖ ការអានការពិត «យករួច» ទាញឫសទាំងមូលក្នុងថវិកាឫស', () => {
    afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
    it('ឫសមកយឺតជាង TX_OUTCOME_READ_TIMEOUT_MS ➜ នៅតែអានបាន (មិនបរាជ័យនៅ ៨ វិនាទី)', async () => {
        const host = 'https://pickup-root-budget.firebaseio.com';
        const user = { uid: 'u1', getIdToken: async () => 'token' };
        Object.assign(firebaseState, { firebaseConfig: { databaseURL: host }, db: { app: { options: { databaseURL: host } } },
            fb: { ref: (_db: unknown, path: string) => ({ toString: () => host + '/' + path }) }, auth: { currentUser: user } });
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        const slowMs = TX_OUTCOME_READ_TIMEOUT_MS + 1500;
        vi.stubGlobal('fetch', async (url: string) => {
            const root = decodeURIComponent(new URL(String(url)).pathname).replace(/^\/|\.json$/g, '');
            await new Promise((r) => setTimeout(r, slowMs));
            return Response.json(root === 'zoew_scan_history_cod_dod' ? { h1: item('h1', [bc('ZTC4X1', true)]) } : {});
        });
        let out: any = null;
        let failed: any = null;
        readPickupTruthViews().then((v) => { out = v; }, (e) => { failed = e; });
        await vi.advanceTimersByTimeAsync(slowMs + 500);
        vi.useRealTimers();
        await vi.waitFor(() => expect(out || failed).toBeTruthy(), { timeout: 3000 }).catch(() => {});
        expect({ failed: failed && failed.message, history: out && out.history.map((i: any) => i.id) }).toEqual({ failed: null, history: ['h1'] });
    });
});
