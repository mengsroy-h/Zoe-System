import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { firebaseState } from '../src/core/state';
import { dbListenerPendingPaths } from '../src/core/text';
import {
    DB_LIVENESS_CYCLE_MIN_GAP_MS, DB_LIVENESS_IDLE_MS, DB_LIVENESS_PROBE_PATH, DB_LIVENESS_PROBE_TIMEOUT_MS,
    attachInfoListeners, clearReconnectWatchdog, detachInfoListeners, probeDatabaseLiveness, probeDatabaseLivenessIfIdle
} from '../src/services/connection';

import { withConnectionOwnership } from '../src/services/connection-flow';

type Calls = { get: string[]; goOffline: number; goOnline: number; captures: any[] };

function install(getImpl: (ref: any) => any): Calls {
    const calls: Calls = { get: [], goOffline: 0, goOnline: 0, captures: [] };
    firebaseState.db = { id: 'db-1' } as any;
    firebaseState.fb = {
        ref: (db: any, path: string) => ({ db, path }),
        get: (ref: any) => { calls.get.push(ref.path); return getImpl(ref); },
        goOffline: () => { calls.goOffline++; },
        goOnline: () => { calls.goOnline++; }
    } as any;
    firebaseState.isDatabaseConnected = true;
    firebaseState.hasEverConnectedToDatabase = true;
    firebaseState.dbLivenessProbe = null;
    firebaseState.lastDbLivenessCycleAt = 0;
    firebaseState.lastDbLivenessOkAt = 0;
    firebaseState.lastForcedReconnectAt = 0;
    dbListenerPendingPaths.clear();
    (window as any).ZoeErrors = { capture: (err: any, ctx: any) => calls.captures.push({ err, ctx }) };
    return calls;
}

const never = () => new Promise(() => {});

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-30T08:00:00Z'));
});
afterEach(() => {
    clearReconnectWatchdog();
    dbListenerPendingPaths.clear();
    firebaseState.dbLivenessProbe = null;
    delete (window as any).ZoeErrors;
    vi.clearAllTimers();
    vi.useRealTimers();
});

describe('ការវាស់ភាពរស់របស់ការតភ្ជាប់ Database (zombie socket)', () => {
    it('Server ឆ្លើយ ➜ រស់ · មិនផ្តាច់ · round trip លើ path ដែលគ្មាន listener', async () => {
        const calls = install(() => Promise.resolve({ val: () => null }));
        const verdict = await probeDatabaseLiveness('test');
        expect(verdict).toBe(true);
        expect(calls.get).toEqual([DB_LIVENESS_PROBE_PATH]);
        expect(calls.goOffline).toBe(0);
        expect(firebaseState.lastDbLivenessOkAt).toBe(Date.now());
    });

    it('Server បដិសេធ (permission_denied) ➜ នៅតែជាភស្តុតាងនៃ round trip ➜ រស់', async () => {
        const calls = install(() => Promise.reject(new Error('permission_denied')));
        expect(await probeDatabaseLiveness('test')).toBe(true);
        expect(calls.goOffline).toBe(0);
    });

    it('Server មិនឆ្លើយ ➜ ផុតពិដាន ➜ ផ្តាច់ម្តង (goOffline ➜ goOnline) + Sentry zone network', async () => {
        const calls = install(never);
        const running = probeDatabaseLiveness('stall');
        await vi.advanceTimersByTimeAsync(DB_LIVENESS_PROBE_TIMEOUT_MS - 1);
        expect(calls.goOffline).toBe(0);
        await vi.advanceTimersByTimeAsync(1);
        expect(await running).toBe(false);
        expect(calls.goOffline).toBe(1);
        expect(calls.goOnline).toBe(1);
        expect(calls.captures.map((c) => c.ctx.zone)).toEqual(['network']);
    });

    it('ការហៅស្របគ្នា ➜ round trip តែមួយ', async () => {
        const calls = install(() => Promise.resolve(null));
        const a = probeDatabaseLiveness('a');
        const b = probeDatabaseLiveness('b');
        expect(a).toBe(b);
        await a;
        expect(calls.get.length).toBe(1);
    });

    it('⛔ listener នៅ pending (ការទាញដំបូង) ➜ មិនវាស់ (ចម្លើយត្រូវដាក់ខាងក្រោយការទាញធំ)', async () => {
        const calls = install(never);
        dbListenerPendingPaths.add('history');
        expect(await probeDatabaseLiveness('test')).toBe(null);
        expect(calls.get.length).toBe(0);
    });

    it('មិនទាន់ភ្ជាប់ ➜ មិនវាស់ (ជណ្តើរភ្ជាប់ឡើងវិញជាអ្នកទទួលខុសត្រូវ)', async () => {
        const calls = install(never);
        firebaseState.isDatabaseConnected = false;
        expect(await probeDatabaseLiveness('test')).toBe(null);
        expect(calls.get.length).toBe(0);
    });

    it('Database ប្តូរកណ្តាលការវាស់ (Reconfig) ➜ សាលក្រមចាស់មិនប៉ះការតភ្ជាប់ថ្មី', async () => {
        const calls = install(never);
        const running = probeDatabaseLiveness('test');
        firebaseState.db = { id: 'db-2' } as any;
        await vi.advanceTimersByTimeAsync(DB_LIVENESS_PROBE_TIMEOUT_MS);
        expect(await running).toBe(null);
        expect(calls.goOffline).toBe(0);
    });

    it('ការតភ្ជាប់ដាច់ដោយខ្លួនឯងកណ្តាលការវាស់ ➜ មិនផ្តាច់ស្ទួន', async () => {
        const calls = install(never);
        const running = probeDatabaseLiveness('test');
        firebaseState.isDatabaseConnected = false;
        await vi.advanceTimersByTimeAsync(DB_LIVENESS_PROBE_TIMEOUT_MS);
        expect(await running).toBe(false);
        expect(calls.goOffline).toBe(0);
    });

    it('ការផ្តាច់ ≤ ១ ដងក្នុង DB_LIVENESS_CYCLE_MIN_GAP_MS', async () => {
        const calls = install(never);
        const first = probeDatabaseLiveness('a');
        await vi.advanceTimersByTimeAsync(DB_LIVENESS_PROBE_TIMEOUT_MS);
        await first;
        firebaseState.isDatabaseConnected = true;
        const second = probeDatabaseLiveness('b');
        await vi.advanceTimersByTimeAsync(DB_LIVENESS_PROBE_TIMEOUT_MS);
        await second;
        expect(calls.goOffline).toBe(1);
        await vi.advanceTimersByTimeAsync(DB_LIVENESS_CYCLE_MIN_GAP_MS);
        firebaseState.isDatabaseConnected = true;
        const third = probeDatabaseLiveness('c');
        await vi.advanceTimersByTimeAsync(DB_LIVENESS_PROBE_TIMEOUT_MS);
        await third;
        expect(calls.goOffline).toBe(2);
    });

    it('`get()` បោះ synchronous ➜ មិនបានវាស់ (មិនផ្តាច់ និងមិនបង្កើតភស្តុតាង)', async () => {
        const calls = install(() => { throw new Error('boom'); });
        expect(await probeDatabaseLiveness('test')).toBe(null);
        expect(calls.goOffline).toBe(0);
        expect(firebaseState.lastDbLivenessOkAt).toBe(0);
    });

    it('ការបដិសេធពី client មិនស្មើចម្លើយ server', async () => {
        const calls = install(() => Promise.reject(new Error('offline')));
        expect(await probeDatabaseLiveness('test')).toBe(null);
        expect(calls.goOffline).toBe(0);
        expect(firebaseState.lastDbLivenessOkAt).toBe(0);
    });

    it('វដ្ត ៦០ វិ. ៖ វាស់តែពេលមើលឃើញ និងគ្មាន round trip ក្នុង DB_LIVENESS_IDLE_MS', async () => {
        const calls = install(() => Promise.resolve(null));
        firebaseState.lastDbLivenessOkAt = Date.now();
        expect(probeDatabaseLivenessIfIdle()).toBe(null);
        vi.setSystemTime(Date.now() + DB_LIVENESS_IDLE_MS);
        const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
        expect(probeDatabaseLivenessIfIdle()).toBe(null);
        hidden.mockReturnValue(false);
        expect(await probeDatabaseLivenessIfIdle()).toBe(true);
        expect(calls.get.length).toBe(1);
    });
});


describe('ការវាស់ភាពរស់តាមជំនាន់ transport និងការទាញទិន្នន័យ', () => {
    it('listener ចាប់ផ្តើមទាញក្រោយ probe ➜ timeout មិនផ្តាច់ការទាញថ្មី', async () => {
        const calls = install(never);
        const running = probeDatabaseLiveness('before-sync');
        expect(calls.get).toEqual([DB_LIVENESS_PROBE_PATH]);
        await vi.advanceTimersByTimeAsync(1);
        dbListenerPendingPaths.add('history');
        await vi.advanceTimersByTimeAsync(DB_LIVENESS_PROBE_TIMEOUT_MS);
        expect({ verdict: await running, cycles: calls.goOffline, reports: calls.captures.length })
            .toEqual({ verdict: null, cycles: 0, reports: 0 });
        dbListenerPendingPaths.clear();
        const current = probeDatabaseLiveness('after-sync');
        await vi.advanceTimersByTimeAsync(DB_LIVENESS_PROBE_TIMEOUT_MS);
        expect(await current).toBe(false);
        expect(calls.goOffline).toBe(1);
    });

    it('listener ទាញខណៈ probe ឆ្លើយពិត ➜ នៅកត់ភាពរស់ ដោយមិនផ្តាច់', async () => {
        let reply!: (value: unknown) => void;
        const calls = install(() => new Promise((resolve) => { reply = resolve; }));
        const running = probeDatabaseLiveness('before-sync');
        dbListenerPendingPaths.add('history');
        reply(null);
        expect(await running).toBe(true);
        expect(firebaseState.lastDbLivenessOkAt).toBe(Date.now());
        expect(calls.goOffline).toBe(0);
    });

    for (const backend of ['firebase', 'supabase']) {
        for (const change of ['reconnect', 'same-transport']) {
            it(backend + ' ៖ ' + change + ' មុន probe timeout ➜ ការផ្តាច់ត្រូវចង transport ដើម', async () => {
                const calls = install(never);
                const raw = firebaseState.fb;
                const app = { options: {} };
                const auth = { app, currentUser: null };
                const db = { app };
                const callbacks = new Map<string, (snapshot: unknown) => void>();
                const sdk = withConnectionOwnership({ ...raw, __supabase: backend === 'supabase',
                    getAuth: () => auth, getDatabase: () => db,
                    onValue: (ref: { path: string }, callback: (snapshot: unknown) => void) => {
                        callbacks.set(ref.path, callback);
                        return () => callbacks.delete(ref.path);
                    }, off: (ref: { path: string }) => callbacks.delete(ref.path)
                });
                firebaseState.fb = sdk;
                firebaseState.auth = sdk.getAuth(app);
                firebaseState.db = sdk.getDatabase(app);
                firebaseState.dbRefConnected = sdk.ref(db, '.info/connected');
                firebaseState.dbRefServerTimeOffset = sdk.ref(db, '.info/serverTimeOffset');
                firebaseState.dbListenersFailed = false;
                firebaseState.isDatabaseInitialized = true;
                const connected = (value: boolean) => callbacks.get('.info/connected')!({ val: () => value });
                try {
                    expect(attachInfoListeners()).toBe(true);
                    connected(true);
                    const generation = sdk.connectionEpoch(firebaseState.dbRefConnected);
                    expect(generation).toBe(1);
                    const running = probeDatabaseLiveness('before-reconnect');
                    expect(calls.get).toEqual([DB_LIVENESS_PROBE_PATH]);
                    await vi.advanceTimersByTimeAsync(1);
                    if (change === 'reconnect') connected(false);
                    connected(true);
                    expect(sdk.connectionEpoch(firebaseState.dbRefConnected)).toBe(change === 'reconnect' ? 3 : 1);
                    const recoveredAt = firebaseState.lastDbLivenessOkAt;
                    await vi.advanceTimersByTimeAsync(DB_LIVENESS_PROBE_TIMEOUT_MS);
                    expect({ verdict: await running, cycles: calls.goOffline, reports: calls.captures.length })
                        .toEqual(change === 'reconnect' ? { verdict: null, cycles: 0, reports: 0 }
                            : { verdict: false, cycles: 1, reports: 1 });
                    expect(firebaseState.lastDbLivenessOkAt).toBe(recoveredAt);
                    if (change === 'reconnect') {
                        const current = probeDatabaseLiveness('new-transport-stall');
                        await vi.advanceTimersByTimeAsync(DB_LIVENESS_PROBE_TIMEOUT_MS);
                        expect(await current).toBe(false);
                        expect(calls.goOffline).toBe(1);
                    }
                } finally {
                    detachInfoListeners();
                    firebaseState.auth = null;
                    firebaseState.dbRefConnected = null;
                    firebaseState.dbRefServerTimeOffset = null;
                }
            });
        }
    }
});
