import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataState, firebaseState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import { appLocalStore } from '../src/core/storage';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { ABANDON_AGE_MS, clearSensitiveModalFields } from '../src/features/session';
import { PUSH_STATE_KEY, pushRuntime, syncExpirySchedule } from '../src/features/push';

const BASE = 'https://audit.supabase.co';
const saved = () => JSON.parse(appLocalStore.getItem(PUSH_STATE_KEY) || '{}');
const reply = () => new Response(JSON.stringify({ ok: true }), { status: 200 });

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((done) => { resolve = done; });
    return { promise, resolve };
}

function shop(tenant: string, token: () => Promise<string> = async () => 'token-' + tenant) {
    firebaseState.authGeneration++;
    firebaseState.auth = { currentUser: { uid: tenant, getIdToken: token }, _account: { tenant_id: tenant } } as any;
    appLocalStore.setItem(PUSH_STATE_KEY, JSON.stringify({ on: true, shop: BASE + '#' + tenant, schedSig: '', schedAt: 0 }));
    dataState.scanHistory = [{ id: tenant, phone: '081000001', createdAt: Date.now() - ABANDON_AGE_MS + 3600000,
        barcodes: [{ code: 'KH-' + tenant, isClosed: false }] }] as any;
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-26T03:00:00Z'));
    appLocalStore.clear();
    appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ supabaseUrl: BASE }));
    viewState.backendKind = 'supabase';
    firebaseState.isDatabaseInitialized = true;
    firebaseState.isInitializingFirebase = false;
    firebaseState.db = { name: 'push-test' } as any;
    firebaseState.fb = { tenantScope: (auth: any) => auth?._account?.tenant_id || '' } as any;
    dbListenerPendingPaths.clear();
    dbListenerFailedPaths.clear();
    pushRuntime.scheduleInFlight = false;
    pushRuntime.scheduleAttemptAt = 0;
    shop('a');
});

afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    appLocalStore.clear();
    pushRuntime.scheduleInFlight = false;
});

describe('កាលវិភាគ Push ៖ ចម្លើយយឺតមិនចូលហាងថ្មី', () => {
    it('session cleanup drops the schedule owner without disabling push and stale completion cannot release its replacement', async () => {
        const old = deferred<Response>();
        const next = deferred<Response>();
        const fetch = vi.fn().mockImplementationOnce(() => old.promise).mockImplementationOnce(() => next.promise);
        vi.stubGlobal('fetch', fetch);
        const oldRun = syncExpirySchedule(true);
        await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
        clearSensitiveModalFields();
        expect(pushRuntime.scheduleInFlight).toBe(false);
        expect(pushRuntime.scheduleAttemptAt).toBe(0);
        expect(saved().on).toBe(true);
        const nextRun = syncExpirySchedule(true);
        await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
        old.resolve(reply());
        expect(await oldRun).toBe(false);
        expect(pushRuntime.scheduleInFlight).toBe(true);
        next.resolve(reply());
        expect(await nextRun).toBe(true);
        expect(pushRuntime.scheduleInFlight).toBe(false);
    });
    it('token មកក្រោយប្តូរហាង ➜ មិនផ្ញើកាលវិភាគចាស់ និងមិនសរសេរលើការកំណត់ថ្មី', async () => {
        const credential = deferred<string>();
        shop('a', () => credential.promise);
        const fetch = vi.fn(async () => reply());
        vi.stubGlobal('fetch', fetch);
        const running = syncExpirySchedule(true);
        shop('b');
        const before = saved();
        credential.resolve('token-a');
        expect(await running).toBe(false);
        expect(fetch).not.toHaveBeenCalled();
        expect(saved()).toEqual(before);
    });

    it('POST ចាស់មកយឺត ➜ កាលវិភាគហាងថ្មីផ្ញើបាន និងចម្លើយចាស់មិនដោះសោការងារថ្មី', async () => {
        const old = deferred<Response>();
        const next = deferred<Response>();
        const fetch = vi.fn().mockImplementationOnce(() => old.promise).mockImplementationOnce(() => next.promise);
        vi.stubGlobal('fetch', fetch);
        const oldRun = syncExpirySchedule(true);
        await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
        shop('b');
        const nextRun = syncExpirySchedule(true);
        await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
        expect(JSON.parse(fetch.mock.calls[1][1].body).supabase).toBe('token-b');
        old.resolve(reply());
        expect(await oldRun).toBe(false);
        expect(saved().schedAt).toBe(0);
        expect(pushRuntime.scheduleInFlight).toBe(true);
        expect(await syncExpirySchedule(true)).toBe(false);
        expect(fetch).toHaveBeenCalledTimes(2);
        next.resolve(reply());
        expect(await nextRun).toBe(true);
        expect(saved()).toMatchObject({ shop: BASE + '#b', schedAt: Date.now() });
        expect(pushRuntime.scheduleInFlight).toBe(false);
    });

    it('បិទការជូនដំណឹងខណៈ POST រង់ចាំ ➜ ចម្លើយចាស់មិនកត់ថាបាន sync', async () => {
        const pending = deferred<Response>();
        const fetch = vi.fn(() => pending.promise);
        vi.stubGlobal('fetch', fetch);
        const running = syncExpirySchedule(true);
        await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
        appLocalStore.setItem(PUSH_STATE_KEY, JSON.stringify({ ...saved(), on: false, schedAt: 0 }));
        pending.resolve(reply());
        expect(await running).toBe(false);
        expect(saved()).toMatchObject({ on: false, schedAt: 0 });
    });
});
