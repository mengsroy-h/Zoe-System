// Re-audit A444 (S1) ៖ the Supabase adapter keyed «Transaction outcome unknown» by the account signed in **when the report fired**.
// Most of those reports fire after a session change (give-up on a shop switch · a closed database) ➜ the new shop's tenant, or none,
// so a later unknown of the new shop on the same ledger path was folded into the old shop's dedup window and dropped. The scope is
// the project plus the tenant of the transaction's own topic.
import { afterEach, expect, it, vi } from 'vitest';

const captured: any = { hooks: null };
vi.mock('../src/services/supabase-rtdb', async (importOriginal) => {
    const real: any = await importOriginal();
    return { ...real, createSupabaseDatabase: (_transport: unknown, hooks: any) => {
        captured.hooks = hooks;
        return { setAuthed() {}, setTenantTopic() {}, close() {}, onBrowserOnline() {}, onBrowserOffline() {} };
    } };
});
import { createSupabaseSdk } from '../src/services/supabase-sdk';

afterEach(() => { captured.hooks = null; });

it('⛔ unknown ៖ scope = គម្រោង + tenant នៃ topic របស់ transaction ⛔ មិនមែនគណនីដែលកំពុងចូលពេលរាយការណ៍', () => {
    const reports: any[] = [];
    const sdk = createSupabaseSdk(() => ({ close() {} }), { onListenerError() {}, docsCache: null, writeJournal: null,
        onTxOutcomeUnknown: (path: any, scope: string) => { reports.push([path.join('/'), scope]); } });
    const app = sdk.initializeApp({ supabaseUrl: 'https://shop-p.supabase.co/' });
    app._auth = { currentUser: null, _account: { tenant_id: 'B' } };
    sdk.getDatabase(app);
    const path = ['zoew_daily_revenue_cod_dod', '2026-10-28'];
    captured.hooks.onTxOutcomeUnknown(path, 'zoe:A');
    captured.hooks.onTxOutcomeUnknown(path, null);
    expect(reports).toEqual([
        ['zoew_daily_revenue_cod_dod/2026-10-28', 'https://shop-p.supabase.co#A'],
        ['zoew_daily_revenue_cod_dod/2026-10-28', 'https://shop-p.supabase.co#']
    ]);
});
