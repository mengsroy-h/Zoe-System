import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseTransport, SB_AUTH_STORAGE_KEY, SB_AUTH_OWNER_KEY } from '../src/services/supabase-transport';
import { createSupabaseSdk } from '../src/services/supabase-sdk';
import { createSupabaseDatabase } from '../src/services/supabase-rtdb';

const auth = vi.hoisted(() => ({
    initialize: vi.fn(async () => {}), dispose: vi.fn(async () => {}),
    getSession: vi.fn(), refreshSession: vi.fn()
}));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth, removeAllChannels: vi.fn(async () => {}) }) }));
const session = { access_token: 'test-private-token', expires_at: 9999999999, user: { id: 'user-a' } };
const deferred = () => { let resolve!: (value: any) => void; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const turn = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); };
let transport: ReturnType<typeof createSupabaseTransport>;
let database: any;
let fetchSpy: ReturnType<typeof vi.fn>;
let owner = true;
let stored: Map<string, string>;
function read() { return database.getForHealth(database.ref('zoew_barcode_registry/__zoew_liveness__'), 1000, () => owner); }
beforeEach(async () => {
    vi.useFakeTimers(); vi.clearAllMocks(); owner = true;
    auth.getSession.mockResolvedValue({ data: { session } });
    fetchSpy = vi.fn(async () => new Response(JSON.stringify({ docs: [], now: Date.now() + 600000 })));
    stored = new Map([[SB_AUTH_STORAGE_KEY, JSON.stringify(session)]]);
    const storage = { getItem: (key: string) => stored.get(key) ?? null, setItem: (key: string, value: string) => stored.set(key, value), removeItem: (key: string) => stored.delete(key) };
    transport = createSupabaseTransport({ supabaseUrl: 'https://health-test.supabase.co', supabaseKey: 'test-publishable' },
        { fetch: fetchSpy, localStorage: storage, sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} }, eventTarget: new EventTarget() });
    await transport.restoreSession();
    auth.getSession.mockClear();
    database = createSupabaseDatabase(transport, {});
});
afterEach(() => { database.close('test'); transport.close(); vi.clearAllTimers(); vi.useRealTimers(); });

describe('សុខភាព Supabase ប្រើ transport និង database ពិត ដោយក្លែងតែ auth/fetch', () => {
    it('SDK បញ្ជូនការអានសុខភាពទៅ adapter ដាច់ដោយឡែក', async () => {
        const sdk = createSupabaseSdk(() => transport, {});
        const result = await sdk.getForHealth(database.ref('zoew_barcode_registry/__zoew_liveness__'), 1000, () => true);
        expect(result.val()).toBe(null);
        expect(fetchSpy).toHaveBeenCalledTimes(1);
        expect(auth.getSession).not.toHaveBeenCalled();
    });
    it('អាន authenticated no-store ម្ដង ដោយមិនកែ cache នាឡិកា ឬស្ថានភាព', async () => {
        const connected: any[] = []; const offsets: any[] = [];
        database.onValue(database.ref('.info/connected'), snap => connected.push(snap.val()));
        database.onValue(database.ref('.info/serverTimeOffset'), snap => offsets.push(snap.val()));
        await turn();
        const before = database.snapshotState();
        expect((await read()).val()).toBe(null);
        expect(database.snapshotState()).toEqual(before);
        expect(connected).toEqual([false]); expect(offsets).toEqual([0]);
        expect(fetchSpy).toHaveBeenCalledTimes(1);
        expect(auth.getSession).not.toHaveBeenCalled();
        expect(auth.refreshSession).not.toHaveBeenCalled();
        expect(fetchSpy.mock.calls[0]).toEqual(['https://health-test.supabase.co/rest/v1/rpc/zoe_read', expect.objectContaining({
            method: 'POST', cache: 'no-store', credentials: 'omit',
            headers: expect.objectContaining({ Authorization: 'Bearer test-private-token' }),
            body: JSON.stringify({ p_root: 'zoew_barcode_registry', p_key: '__zoew_liveness__' })
        })]);
    });
    it.each([401, 403, 503])('HTTP %s មិន refresh auth និងមិនកំណត់ការសាកឡើងវិញ', async status => {
        fetchSpy.mockResolvedValue(new Response('{"message":"denied"}', { status }));
        await expect(read()).rejects.toThrow();
        await vi.advanceTimersByTimeAsync(60000);
        expect(fetchSpy).toHaveBeenCalledTimes(1); expect(auth.refreshSession).not.toHaveBeenCalled();
    });
    it.each(['absent', 'expired', 'malformed', 'foreign-user', 'foreign-project', 'missing-expiry', 'missing-token'])('សម័យរក្សាទុក %s មិនឆ្លងកាត់ ដោយមិនប៉ះ auth ឬ storage', async state => {
        if (state === 'absent') stored.delete(SB_AUTH_STORAGE_KEY);
        if (state === 'expired') stored.set(SB_AUTH_STORAGE_KEY, JSON.stringify({ ...session, expires_at: Date.now() / 1000 - 1 }));
        if (state === 'malformed') stored.set(SB_AUTH_STORAGE_KEY, '{invalid');
        if (state === 'foreign-user') stored.set(SB_AUTH_STORAGE_KEY, JSON.stringify({ ...session, user: { id: 'foreign' } }));
        if (state === 'foreign-project') stored.set(SB_AUTH_OWNER_KEY, 'https://other.supabase.co');
        if (state === 'missing-expiry') stored.set(SB_AUTH_STORAGE_KEY, JSON.stringify({ ...session, expires_at: null }));
        if (state === 'missing-token') stored.set(SB_AUTH_STORAGE_KEY, JSON.stringify({ ...session, access_token: null }));
        const before = Array.from(stored);
        const foreign = vi.fn(); transport.onForeignSession(foreign);
        await expect(read()).rejects.toThrow(); expect(fetchSpy).not.toHaveBeenCalled();
        expect(auth.getSession).not.toHaveBeenCalled(); expect(auth.refreshSession).not.toHaveBeenCalled();
        expect(foreign).not.toHaveBeenCalled(); expect(Array.from(stored)).toEqual(before);
    });
    it.each(['owner', 'close'])('បដិសេធការប្ដូរ %s មុនផ្ញើ POST', async change => {
        if (change === 'owner') owner = false;
        if (change === 'close') transport.close();
        await expect(read()).rejects.toThrow(); expect(fetchSpy).not.toHaveBeenCalled();
    });
    it.each(['fetch', 'body'])('ពិដានតែមួយកំណត់ %s ហើយ abort សំណើ', async stage => {
        const pending = deferred();
        if (stage === 'fetch') fetchSpy.mockReturnValue(pending.promise);
        else fetchSpy.mockResolvedValue({ ok: true, status: 200, text: () => pending.promise });
        const rejection = expect(read()).rejects.toThrow('timed out');
        await turn();
        expect(fetchSpy).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(1000); await rejection;
        expect((fetchSpy.mock.calls[0] as any)[1].signal.aborted).toBe(true);
        pending.resolve(stage === 'fetch' ? new Response('{"docs":[]}') : '{"docs":[]}');
        await turn(); expect(database.snapshotState().docs).toEqual({});
    });
    it.each(['owner', 'signout', 'tenant', 'close'])('ចម្លើយយឺតក្រោយ %s មិនត្រូវទទួលយក', async change => {
        const pending = deferred(); fetchSpy.mockReturnValue(pending.promise);
        const rejection = expect(read()).rejects.toThrow(); await turn();
        if (change === 'owner') owner = false;
        if (change === 'signout') database.resetForSignOut();
        if (change === 'tenant') database.setTenantTopic('other');
        if (change === 'close') transport.close();
        pending.resolve(new Response('{"docs":[]}')); await rejection;
        expect(database.snapshotState().docs).toEqual({});
    });
    it.each([{ docs: null }, { docs: [{}] }, { docs: [{ r: 'foreign', k: '__zoew_liveness__', v: true }] }])('ចម្លើយអានខុសទម្រង់ %j មិនមែនមានសុខភាពល្អ', async body => {
        fetchSpy.mockResolvedValue(new Response(JSON.stringify(body)));
        await expect(read()).rejects.toThrow('bad read response');
    });
    it('នាឡិកាថយក្រោយមិនពន្យារពិដានសំណើពិនិត្យសុខភាព', async () => {
        const pending = deferred(); fetchSpy.mockReturnValue(pending.promise);
        const rejection = expect(read()).rejects.toThrow('timed out'); await turn();
        vi.setSystemTime(Date.now() - 3600000);
        await vi.advanceTimersByTimeAsync(1000); await rejection;
        expect((fetchSpy.mock.calls[0] as any)[1].signal.aborted).toBe(true);
    });

});
