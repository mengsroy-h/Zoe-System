import { describe, expect, it, vi } from 'vitest';
import { createSupabaseSdk } from '../../../ZoeW/src/services/supabase-sdk';
import { SbRpcError } from '../../../ZoeW/src/services/supabase-rtdb';

const ROOT = 'zoew_scan_operations';
const BEFORE = 1793836800000;

function fixture() {
    const rpc = vi.fn();
    const sdk = createSupabaseSdk(() => ({ rpc }), {});
    const auth = { currentUser: { uid: 'user-a' }, _account: { tenant_id: 'tenant-a' }, _transport: { rpc } };
    return { sdk, auth, rpc };
}

describe('Supabase evidence candidate key pages', () => {
    it.each([undefined, null])('requests the first key page for cursor %s and preserves the server order', async after => {
        const { sdk, auth, rpc } = fixture();
        const docs = [{ r: ROOT, k: '10', v: { birth: 100 }, s: 1 }, { r: ROOT, k: '2', v: { birth: 100 }, s: 2 }];
        rpc.mockResolvedValue({ docs, now: BEFORE });
        expect(await sdk.evidenceCandidates(auth, ROOT, BEFORE, 50, after)).toBe(docs);
        expect(rpc.mock.calls).toEqual([['zoe_evidence_candidates_page', { p_root: ROOT, p_before: BEFORE, p_limit: 50, p_after: null }, 20000]]);
    });

    it('passes an exclusive cursor even when its record was deleted', async () => {
        const { sdk, auth, rpc } = fixture();
        rpc.mockResolvedValue({ docs: [{ r: ROOT, k: 'scan_next', v: { birth: 100 }, s: 2 }] });
        const page = await sdk.evidenceCandidates(auth, ROOT, BEFORE, 50, 'scan_deleted');
        expect(page.map((doc: any) => doc.k)).toEqual(['scan_next']);
        expect(rpc).toHaveBeenCalledWith('zoe_evidence_candidates_page', { p_root: ROOT, p_before: BEFORE, p_limit: 50, p_after: 'scan_deleted' }, 20000);
    });

    it('retains a missing paging RPC failure without falling back to the age-ordered first page', async () => {
        const { sdk, auth, rpc } = fixture();
        const error = new SbRpcError('Could not find the function', 'PGRST202', 404, '');
        rpc.mockRejectedValue(error);
        await expect(sdk.evidenceCandidates(auth, ROOT, BEFORE, 50, 'scan_deleted')).rejects.toBe(error);
        expect(rpc).toHaveBeenCalledTimes(1);
        expect(rpc.mock.calls[0][0]).toBe('zoe_evidence_candidates_page');
    });

    it('reports an unreadable page as null and makes no request without an account', async () => {
        const { sdk, auth, rpc } = fixture();
        rpc.mockResolvedValue({ docs: {} });
        expect(await sdk.evidenceCandidates(auth, ROOT, BEFORE, 50)).toBeNull();
        expect(await sdk.evidenceCandidates(null, ROOT, BEFORE, 50)).toBeNull();
        expect(await sdk.evidenceCandidates({ ...auth, currentUser: null }, ROOT, BEFORE, 50)).toBeNull();
        expect(await sdk.evidenceCandidates({ ...auth, _account: null }, ROOT, BEFORE, 50)).toBeNull();
        expect(rpc).toHaveBeenCalledTimes(1);
    });
});
