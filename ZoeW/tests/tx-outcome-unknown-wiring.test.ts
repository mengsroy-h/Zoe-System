// Re-audit (A438 follow-up) ៖ the Supabase «Transaction outcome unknown» money alert names the database that produced it.
// The handler built its URL from the live Config ➜ a Supabase db giving up its lost-reply transactions while the app switches to a
// Firebase Config reported `path: ''` and every path merged into one alert; and shops of one Supabase project shared one dedup key.
// The SDK hands the adapter's own project + tenant to the handler; the path is the database path as given.
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { firebaseState } from '../src/core/state';
import { txOutcomeUnknownReported } from '../src/services/tx-outcome';

const lab = vi.hoisted(() => ({ hooks: null as any }));
vi.mock('../src/services/supabase-rtdb', async (original) => ({
    ...await original() as any,
    createSupabaseDatabase: (_transport: any, hooks: any) => {
        lab.hooks = hooks;
        return { setAuthed() {}, setTenantTopic() {}, onBrowserOnline() {}, onBrowserOffline() {}, close() {} };
    }
}));
vi.mock('../src/services/supabase-backend', async () => {
    const { createSupabaseSdk } = await import('../src/services/supabase-sdk');
    return { createZoeSupabaseSdk: (env: any) => createSupabaseSdk(() => ({ close() {} }), env) };
});
import { loadSupabaseFb } from '../src/services/firebase-init';

let captures: any[] = [];
beforeEach(() => {
    captures = [];
    txOutcomeUnknownReported.clear();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.UTC(2026, 9, 28, 3, 0, 0));
    (window as any).ZoeErrors = { capture: (_e: any, ctx: any) => captures.push(ctx) };
});
afterEach(() => { vi.useRealTimers(); delete (window as any).ZoeErrors; });

async function supabaseDb(tenant: string) {
    const sdk: any = await loadSupabaseFb();
    const app = sdk.initializeApp({ supabaseUrl: 'https://proj-a.supabase.co', supabaseKey: 'sb_publishable_' + 'k'.repeat(24) });
    app._auth = { currentUser: null, _account: { tenant_id: tenant } };
    sdk.getDatabase(app);
    expect(typeof lab.hooks?.onTxOutcomeUnknown, 'លក្ខខណ្ឌមុន ៖ SDK ផ្តល់ hook ទៅ db').toBe('function');
    return lab.hooks;
}

it('the live Config already names a Firebase shop ➜ the Supabase alert keeps its own paths (never one merged `\'\'`)', async () => {
    const hooks = await supabaseDb('t1');
    firebaseState.firebaseConfig = { databaseURL: 'https://next.firebaseio.com' } as any;
    hooks.onTxOutcomeUnknown(['zoew_daily_revenue_cod_dod', '2026-10-27']);
    hooks.onTxOutcomeUnknown(['zoew_daily_revenue_cod_dod', '2026-10-28']);
    expect(captures.map((c) => [c.context, c.path])).toEqual([
        ['supabaseTransaction', '/zoew_daily_revenue_cod_dod/2026-10-27'],
        ['supabaseTransaction', '/zoew_daily_revenue_cod_dod/2026-10-28']
    ]);
});

it('two shops of one Supabase project ➜ the same ledger path reports once per shop', async () => {
    firebaseState.firebaseConfig = { supabaseUrl: 'https://proj-a.supabase.co' } as any;
    const first = await supabaseDb('t1');
    first.onTxOutcomeUnknown(['zoew_monthly_revenue_cod_dod', '2026-10']);
    first.onTxOutcomeUnknown(['zoew_monthly_revenue_cod_dod', '2026-10']);
    const second = await supabaseDb('t2');
    second.onTxOutcomeUnknown(['zoew_monthly_revenue_cod_dod', '2026-10']);
    expect(captures.map((c) => c.path)).toEqual(['/zoew_monthly_revenue_cod_dod/2026-10', '/zoew_monthly_revenue_cod_dod/2026-10']);
    expect(JSON.stringify(captures)).not.toMatch(/proj-a|t1|t2/);
});
