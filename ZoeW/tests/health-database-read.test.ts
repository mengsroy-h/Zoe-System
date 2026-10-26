import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { firebaseState } from '../src/core/state';
import { DB_LIVENESS_PROBE_PATH, DB_LIVENESS_PROBE_TIMEOUT_MS } from '../src/services/connection';
import { createSupabaseDatabase, SbRpcError } from '../src/services/supabase-rtdb';
import { healthDatabaseRead } from '../src/features/health-database-read';

function deferred() { let resolve!: (value: any) => void; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }
let sdk: any;
let fetchSpy: ReturnType<typeof vi.fn>;
let closeDatabase: (() => void) | undefined;
beforeEach(() => {
    localStorage.clear();
    firebaseState.isDatabaseConnected = true;
    firebaseState.dbLivenessProbe = null;
    firebaseState.firebaseConfig = { databaseURL: 'https://health-test.firebaseio.com' } as any;
    firebaseState.db = {} as any;
    firebaseState.auth = { currentUser: { uid: 'health-user', getIdToken: vi.fn(async () => 'test-token') } } as any;
    sdk = { ref: vi.fn((_database, path) => ({ toString: () => 'https://health-test.firebaseio.com/' + path })),
        get: vi.fn(async () => ({ val: () => null })), goOnline: vi.fn(), goOffline: vi.fn(), retryWriteRecovery: vi.fn() };
    firebaseState.fb = sdk;
    fetchSpy = vi.fn(async () => new Response('null'));
    vi.stubGlobal('fetch', fetchSpy);
});
afterEach(() => {
    closeDatabase?.(); closeDatabase = undefined;
    expect(sdk.goOnline).not.toHaveBeenCalled(); expect(sdk.goOffline).not.toHaveBeenCalled(); expect(sdk.retryWriteRecovery).not.toHaveBeenCalled();
    vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); localStorage.clear();
});
function supabase() { firebaseState.firebaseConfig = { supabaseUrl: 'https://health-test.supabase.co' } as any; }

describe('អានសុខភាព Database ពី Server មិនមែន Cache', () => {
    it('Firebase អាន authenticated no-store តាម REST ពិត និងមិនប្រើ SDK cache', async () => {
        expect(await healthDatabaseRead()).toBe(true);
        expect(sdk.get).not.toHaveBeenCalled();
        expect(sdk.ref).toHaveBeenCalledWith(firebaseState.db, DB_LIVENESS_PROBE_PATH);
        expect(fetchSpy).toHaveBeenCalledTimes(1);
        const [url, options] = fetchSpy.mock.calls[0] as any;
        expect(new URL(url).pathname).toBe('/' + DB_LIVENESS_PROBE_PATH + '.json');
        expect(new URL(url).searchParams.get('auth')).toBe('test-token');
        expect(options).toMatchObject({ cache: 'no-store', credentials: 'omit' });
    });
    it.each([{}, [], 'cached-only', false, 1])('Firebase HTTP 200 ខុស schema %j មិនបញ្ជាក់សុខភាព', async value => {
        fetchSpy.mockResolvedValue(new Response(JSON.stringify(value))); expect(await healthDatabaseRead()).toBe(null);
    });
    it.each([{}, [], 'cached-only', false, 1, undefined])('Supabase ខុស schema %j មិនបញ្ជាក់សុខភាព', async value => {
        supabase(); sdk.get.mockResolvedValue({ val: () => value }); expect(await healthDatabaseRead()).toBe(null);
    });
    it.each(['firebase', 'supabase'])('%s marker true អានជោគជ័យ', async backend => {
        if (backend === 'supabase') { supabase(); sdk.get.mockResolvedValue({ val: () => true }); }
        else fetchSpy.mockResolvedValue(new Response('true'));
        expect(await healthDatabaseRead()).toBe(true);
    });
    it.each([401, 403, 500])('HTTP %s មិនមែនការអានជោគជ័យ ទោះ SDK មាន Cache', async status => {
        fetchSpy.mockResolvedValue(new Response('{}', { status }));
        expect(await healthDatabaseRead()).toBe(null); expect(sdk.get).not.toHaveBeenCalled();
    });
    it.each(['ref', 'auth', 'db', 'token', 'url'])('ខ្វះ %s មិនបង្ហាញជោគជ័យ', async missing => {
        if (missing === 'ref') sdk.ref = undefined;
        if (missing === 'auth') firebaseState.auth = null;
        if (missing === 'db') firebaseState.db = null;
        if (missing === 'token') firebaseState.auth.currentUser.getIdToken = undefined;
        if (missing === 'url') sdk.ref = () => ({ toString: () => 'https://untrusted.invalid/a' });
        expect(await healthDatabaseRead()).toBe(null); expect(fetchSpy).not.toHaveBeenCalled();
    });
    it.each(['token', 'fetch', 'body'])('Firebase %s ព្យួរ បញ្ចប់ត្រឹមពិដាន', async stage => {
        vi.useFakeTimers(); const pending = deferred();
        if (stage === 'token') firebaseState.auth.currentUser.getIdToken = () => pending.promise;
        if (stage === 'fetch') fetchSpy.mockReturnValue(pending.promise);
        if (stage === 'body') fetchSpy.mockResolvedValue({ ok: true, json: () => pending.promise });
        const result = healthDatabaseRead(); await vi.advanceTimersByTimeAsync(DB_LIVENESS_PROBE_TIMEOUT_MS);
        expect(await result).toBe(false);
        if (stage === 'token') { pending.resolve('late-token'); await vi.advanceTimersByTimeAsync(0); expect(fetchSpy).not.toHaveBeenCalled(); }
    });
    it.each(['firebase', 'supabase'])('%s មិនយកលទ្ធផលក្រោយប្ដូរ session', async backend => {
        const pending = deferred();
        if (backend === 'supabase') { supabase(); sdk.get.mockReturnValue(pending.promise); }
        else fetchSpy.mockReturnValue(pending.promise);
        const result = healthDatabaseRead(); await Promise.resolve(); await Promise.resolve();
        firebaseState.authGeneration++;
        pending.resolve(backend === 'firebase' ? new Response('null') : { val: () => null });
        expect(await result).toBe(null);
    });
    it.each(['database', 'sdk', 'user', 'tenant', 'config'])('មិនយកលទ្ធផលក្រោយ %s ប្ដូរ', async change => {
        supabase(); firebaseState.auth._account = { tenant_id: 'first' };
        const pending = deferred(); sdk.get.mockReturnValue(pending.promise);
        const result = healthDatabaseRead();
        if (change === 'database') firebaseState.db = {} as any;
        if (change === 'sdk') firebaseState.fb = { ...sdk };
        if (change === 'user') firebaseState.auth.currentUser = { uid: 'second' } as any;
        if (change === 'tenant') firebaseState.auth._account.tenant_id = 'second';
        if (change === 'config') localStorage.setItem('zoew_firebase_config', '{}');
        pending.resolve({ val: () => null }); expect(await result).toBe(null);
    });
    it('ប្រើ Config រក្សាទុក បើ Config runtime មិនទាន់មាន', async () => {
        firebaseState.firebaseConfig = null;
        localStorage.setItem('zoew_firebase_config', JSON.stringify({ supabaseUrl: 'https://health-test.supabase.co' }));
        expect(await healthDatabaseRead()).toBe(true); expect(sdk.get).toHaveBeenCalledTimes(1); expect(fetchSpy).not.toHaveBeenCalled();
    });
    it.each([undefined, null, {}, true])('Supabase snapshot មិនត្រឹមត្រូវ %j', async snapshot => {
        supabase(); sdk.get.mockResolvedValue(snapshot); expect(await healthDatabaseRead()).toBe(null);
    });
    it('Supabase ផុតពេល និង session ប្ដូរមិនមែន offline', async () => {
        supabase(); vi.useFakeTimers(); sdk.get.mockReturnValue(new Promise(() => {}));
        const result = healthDatabaseRead(); firebaseState.db = {} as any;
        await vi.advanceTimersByTimeAsync(DB_LIVENESS_PROBE_TIMEOUT_MS); expect(await result).toBe(null);
    });
    it('Supabase ព្យួរ បញ្ចប់ត្រឹមពិដាន', async () => {
        supabase(); vi.useFakeTimers(); sdk.get.mockReturnValue(new Promise(() => {}));
        const result = healthDatabaseRead(); await vi.advanceTimersByTimeAsync(DB_LIVENESS_PROBE_TIMEOUT_MS); expect(await result).toBe(false);
    });
    it.each(['missing', 'rejected', 'throws'])('Supabase get %s មិនជោគជ័យ', async mode => {
        supabase();
        if (mode === 'missing') sdk.get = undefined;
        if (mode === 'rejected') sdk.get.mockRejectedValue(Object.assign(new Error('private-token'), { code: 'permission_denied' }));
        if (mode === 'throws') sdk.get.mockImplementation(() => { throw new Error('private-token'); });
        expect(await healthDatabaseRead()).toBe(null); expect(fetchSpy).not.toHaveBeenCalled();
    });
    it.each([true, false])('Supabase adapter ពិត អាន zoe_read ជោគជ័យ=%s', async success => {
        supabase();
        const rpc = vi.fn(async () => { if (!success) throw new SbRpcError('denied', '42501', 403, ''); return { docs: [] }; });
        const database = createSupabaseDatabase({ rpc }, {});
        closeDatabase = () => database.close('test');
        firebaseState.db = database;
        sdk.ref = (_database, path) => database.ref(path); sdk.get = vi.fn(ref => database.get(ref));
        expect(await healthDatabaseRead()).toBe(success ? true : null);
        expect(rpc).toHaveBeenCalledWith('zoe_read', { p_root: 'zoew_barcode_registry', p_key: '__zoew_liveness__' }, expect.any(Number));
        expect(fetchSpy).not.toHaveBeenCalled();
    });
});
