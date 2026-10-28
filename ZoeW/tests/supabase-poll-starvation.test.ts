/**
 * A415 (CI e2e ផ្នែក ឈ) ៖ realtime មិនដើរ ➜ ការទាញតាមវដ្ត (`pollFallbackMs`) ជាផ្លូវតែមួយដែលឧបករណ៍ដឹងការប្រែ (ឧ. session ត្រូវដក)។
 * មុនកែ status realtime នីមួយៗ (រាល់ការសាកឡើងវិញ ៥ · ១៥ · ៣០ វិ.) កំណត់ timer ការទាញឡើងវិញ ➜ ក្រោយចូលប្រព័ន្ធ ~១ នាទី
 * ការទាញមិនដែលចេញ។ ឥឡូវ ៖ timer កំណត់ឡើងវិញតែពេលសុខភាព realtime ប្រែ (ចន្លោះពេលអាស្រ័យលើវាតែប៉ុណ្ណោះ)។
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseDatabase } from '../src/services/supabase-rtdb';

afterEach(() => { vi.useRealTimers(); });

function harness() {
    const statusCallbacks: Array<(status: string) => void> = [];
    let pulls = 0;
    const transport = {
        rpc: async (fn: string, args: any) => {
            if (fn !== 'zoe_pull') throw new Error('unexpected ' + fn);
            pulls++;
            return { seq: 1, more: false, reset: args.p_since === 0, head: 1, tenant: 't1', now: Date.now(), rows: [] };
        },
        ping: async () => true,
        subscribe: (_topic: string, _onMessage: unknown, onStatus: (status: string) => void) => { statusCallbacks.push(onStatus); return () => {}; }
    };
    const db: any = createSupabaseDatabase(transport, {
        onListenerError: () => {}, onSynced: () => {}, onForbidden: () => {}, onTxOutcomeUnknown: () => {}
    }, { pollFallbackMs: 30000, retryStepsMs: [20, 40] });
    db.setTenantTopic('zoe:t1');
    db.setAuthed(true, 'scope1');
    return { db, pulls: () => pulls, status: (s: string) => statusCallbacks[statusCallbacks.length - 1](s) };
}

describe('ការទាញតាមវដ្ត មិនត្រូវ status realtime ពន្យារ', () => {
    it('realtime បរាជ័យរាល់ ៥ វិ. ➜ ការទាញ ៣០ វិ. នៅតែចេញក្នុង ៣៥ វិ.', async () => {
        vi.useFakeTimers();
        const h = harness();
        await vi.advanceTimersByTimeAsync(10);
        const afterSync = h.pulls();
        expect(afterSync).toBeGreaterThanOrEqual(1);
        for (let t = 0; t < 7; t++) {
            h.status('CHANNEL_ERROR');
            await vi.advanceTimersByTimeAsync(5000);
        }
        expect(h.pulls()).toBeGreaterThan(afterSync);
        h.db.close?.();
    });

    it('control ៖ realtime ដើរ (SUBSCRIBED) ➜ ចន្លោះការទាញវែង (មិនទាញរាល់ ៣០ វិ.)', async () => {
        vi.useFakeTimers();
        const h = harness();
        await vi.advanceTimersByTimeAsync(10);
        h.status('SUBSCRIBED');
        await vi.advanceTimersByTimeAsync(10);
        const afterHealthy = h.pulls();
        await vi.advanceTimersByTimeAsync(60000);
        expect(h.pulls()).toBe(afterHealthy);
        h.db.close?.();
    });
});
