// Deep audit ៩ (network N4) ៖ «Transaction outcome unknown» is a money alert. It was deduplicated forever by URL pathname in one
// module-level Set ➜ one alert per ledger path per page lifetime: a later unknown on the same path (hours later, or in another shop
// after a switch) never reached Sentry. Dedup is per database origin + path within a 10-minute window (the `ZoeErrors` storm window).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reportTxOutcomeUnknown, txOutcomeUnknownReported } from '../src/services/tx-outcome';

let captures: any[] = [];
beforeEach(() => {
    captures = [];
    txOutcomeUnknownReported.clear();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.UTC(2026, 9, 28, 3, 0, 0));
    (window as any).ZoeErrors = { capture: (_e: any, ctx: any) => captures.push(ctx) };
});
afterEach(() => { vi.useRealTimers(); delete (window as any).ZoeErrors; });

describe('N4 ៖ the unknown-outcome money alert is not silenced for the page lifetime', () => {
    it('the same ledger path in another shop, hours later, still reaches Sentry', () => {
        reportTxOutcomeUnknown('https://shop-a.firebaseio.com/zoew_monthly_revenue_cod_dod.json');
        vi.setSystemTime(Date.now() + 6 * 60 * 60 * 1000);
        reportTxOutcomeUnknown('https://shop-b.firebaseio.com/zoew_monthly_revenue_cod_dod.json');
        expect(captures.filter((c) => c.zone === 'money').length).toBe(2);
    });

    it('the same path of the same shop after the window reports again', () => {
        reportTxOutcomeUnknown('https://shop-a.firebaseio.com/zoew_daily_revenue_cod_dod/2026-10-28.json');
        vi.setSystemTime(Date.now() + 11 * 60 * 1000);
        reportTxOutcomeUnknown('https://shop-a.firebaseio.com/zoew_daily_revenue_cod_dod/2026-10-28.json');
        expect(captures.length).toBe(2);
    });

    it('control ៖ a storm on one path of one shop inside the window reports once · the path, never the host, reaches Sentry', () => {
        for (let i = 0; i < 5; i++) reportTxOutcomeUnknown('https://shop-a.firebaseio.com/zoew_daily_revenue_cod_dod/2026-10-28.json');
        expect(captures.map((c) => c.path)).toEqual(['/zoew_daily_revenue_cod_dod/2026-10-28.json']);
    });
});
