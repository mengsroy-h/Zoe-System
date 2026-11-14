import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'acorn';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createSupabaseDatabase } from '../../../../ZoeW/src/services/supabase-rtdb';
import { attachInfoListeners, detachInfoListeners } from '../../../../ZoeW/src/services/connection';
import { firebaseState } from '../../../../ZoeW/src/core/state';
import { getServerClockBounds, resetServerClock, serverClockIsTrustworthy } from '../../../../ZoeW/src/core/clock';
import { armSessionExpiryCheck } from '../../../../ZoeW/src/features/session';
import { acceptFixtureSession } from './helpers/accepted-session';

const root = path.resolve(process.env.NETWORK_FIXTURE_ROOT || '..');
const source = readFileSync(path.join(root, 'tools/audit-tools/supabase-app-network-e2e-test.js'), 'utf8');
const START = Date.UTC(2026, 10, 9), HOUR = 3600000;
const turn = async () => { for (let i = 0; i < 100; i++) await Promise.resolve(); };
let database: any;
let fixtureNumber = 0;
let config: { supabaseUrl: string; supabaseKey: string };
function pageFixture() {
    const tree: any = parse(source, { ecmaVersion: 'latest', sourceType: 'script' });
    let found: any;
    const walk = (node: any) => {
        if (!node || typeof node !== 'object') return;
        if (node.type === 'CallExpression' && node.callee.property?.name === 'addInitScript'
            && node.arguments[0]?.type === 'ArrowFunctionExpression'
            && source.slice(node.arguments[0].start, node.arguments[0].end).includes('let armed = false')) found = node.arguments[0];
        for (const key of Object.keys(node)) {
            const value = node[key]; if (Array.isArray(value)) value.forEach(walk); else if (value && typeof value === 'object') walk(value);
        }
    };
    walk(tree); expect(found).toBeDefined();
    new Function('return (' + source.slice(found.start, found.end) + ')')()();
}
function serverFixture(fake: any) {
    const start = source.indexOf('        const race = { pullBeforeLogout:');
    const end = source.indexOf('        await page.reload(', start);
    expect(start).toBeGreaterThan(0); expect(end).toBeGreaterThan(start);
    return new Function('fake', 'sleep', 'reloadMark', source.slice(start, end) + '\n return race;')(fake, (ms: number) => new Promise(resolve => setTimeout(resolve, ms)), 0);
}
beforeEach(() => {
    vi.useFakeTimers(); vi.setSystemTime(START);
    vi.spyOn(performance, 'now').mockImplementation(() => Date.now() - START + 1000);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    localStorage.clear(); sessionStorage.clear(); resetServerClock();
    config = { supabaseUrl: 'https://expiry-' + (++fixtureNumber) + '.fixture.test', supabaseKey: 'fixture' };
    localStorage.setItem('zoew_firebase_config', JSON.stringify(config));
});
afterEach(() => {
    database?.close('test'); detachInfoListeners(); resetServerClock();
    delete (window as any).__zoeExpiryRace; delete (window as any).firebaseState;
    firebaseState.auth = null;
    vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals();
});
it.each(['valid', 'missing'])('fixture ផុតកំណត់ទាមទារ clock %s ពិត មុនចម្លើយ delta ដែលកាន់ទុក', async clockMode => {
    const events: any[] = [];
    const fake: any = { requests: [{ path: '/auth/v1/token', search: '?grant_type=refresh_token' }],
        setRpcHook(fn: any) { this.rpcHook = fn; }, setAuthHook(fn: any) { this.authHook = fn; } };
    const race = serverFixture(fake);
    vi.stubGlobal('fetch', async (input: string, options: any) => {
        const url = new URL(String(input)); const body = JSON.parse(options?.body || '{}');
        const request = { id: fake.requests.length, path: url.pathname, search: url.search, body };
        fake.requests.push(request); events.push({ phase: 'request', id: request.id, path: request.path, at: Date.now() - START });
        const fn = url.pathname.split('/').at(-1);
        await fake.rpcHook({ fn, body, phase: 'before' });
        const result = fn === 'zoe_read' ? { now: clockMode === 'valid' ? Date.now() : undefined, docs: [] }
            : { seq: 7, head: 7, more: false, reset: false, tenant: 't1', now: Date.now(), rows: [] };
        await fake.rpcHook({ fn, body, phase: 'after', result: [{ r: result }] });
        events.push({ phase: 'response', id: request.id, path: request.path, at: Date.now() - START });
        return new Response(JSON.stringify(result), { status: 200 });
    });
    const transport = { rpc: (fn: string, body: any) => window.fetch(config.supabaseUrl + '/rest/v1/rpc/' + fn,
        { method: 'POST', body: JSON.stringify(body) }).then(response => response.json()), ping: async () => true, subscribe: () => () => {} };
    database = createSupabaseDatabase(transport, { onListenerError: (error: any) => { throw error; }, onSynced() {}, onForbidden() {}, onTxOutcomeUnknown() {} },
        { deltaPull: true, pollFallbackMs: 600000, docsCache: { load: async (scope: string) => ({ v: 1, scope, tenant: 't1', cursor: 5, docs: [] }), save: async () => {}, clear: async () => {} } });
    const user = { uid: 'fixture' };
    const sdk = { __supabase: true, ref: (_db: any, name: string) => database.ref(name), get: (ref: any) => database.get(ref),
        off: (ref: any) => database.off(ref), goOnline() {}, goOffline() {},
        onValue(ref: any, callback: any) {
            if (ref._path[1] === 'connected') { callback({ val: () => true }); return () => {}; }
            return database.onValue(ref, (snapshot: any) => {
                callback(snapshot);
                events.push({ phase: 'clock', at: Date.now() - START, bounds: getServerClockBounds(), verdict: firebaseState.sessionExpiryCheck });
            });
        },
        getIdTokenResult: async () => { events.push({ phase: 'token', at: Date.now() - START, trusted: serverClockIsTrustworthy() }); return { authTime: new Date(START - 6.5 * HOUR).toISOString() }; },
        signOut: () => {
            events.push({ phase: 'logout', at: Date.now() - START, trusted: serverClockIsTrustworthy(), verdict: firebaseState.sessionExpiryCheck });
            database.resetForSignOut();
            fake.requests.push({ path: '/auth/v1/logout', search: '?scope=local' });
            void fake.authHook({ path: '/auth/v1/logout' });
            return new Promise<void>(() => {});
        } };
    Object.assign(firebaseState, { db: database, fb: sdk, auth: { app: { options: config }, currentUser: user }, authGeneration: firebaseState.authGeneration + 1,
        firebaseConfig: config, authLoginOperation: null,
        sessionExpiryCheck: 'live', sessionExpiryCheckInFlight: false, isDatabaseConnected: false, hasEverConnectedToDatabase: false,
        infoListenersFailed: false, infoListenerRecoveryTimer: null, reconnectWatchdogTimer: null,
        dbRefConnected: database.ref('.info/connected'), dbRefServerTimeOffset: database.ref('.info/serverTimeOffset') });
    acceptFixtureSession();
    (window as any).firebaseState = firebaseState;
    sessionStorage.setItem('__zoeExpiryRace', '1'); pageFixture();
    attachInfoListeners(); database.setTenantTopic('zoe:t1'); database.setAuthed(true, 'scope');
    await vi.advanceTimersByTimeAsync(10); await turn();
    expect(race.pullHeld).toBe(true);
    armSessionExpiryCheck(user, firebaseState.authGeneration);
    await vi.advanceTimersByTimeAsync(1000); await turn();
    const beforeCeiling = { verdict: firebaseState.sessionExpiryCheck, trusted: serverClockIsTrustworthy(), released: race.pullReleasedAfterLogout };
    await vi.advanceTimersByTimeAsync(15000); await turn();
    console.log(JSON.stringify({ beforeCeiling, race, page: (window as any).__zoeExpiryRace, events }));
    expect.soft(beforeCeiling.verdict).toBe(clockMode === 'valid' ? 'expired' : 'unverified');
    expect.soft(race.pullReleasedAfterLogout).toBe(clockMode === 'valid');
    const pullResponse = events.find(event => event.phase === 'response' && event.path.endsWith('zoe_pull_delta'));
    const logout = events.find(event => event.phase === 'logout');
    if (clockMode === 'valid') {
        expect.soft(logout?.at).toBeLessThan(pullResponse?.at);
        expect.soft((window as any).__zoeExpiryRace.clockTrusted).toBe(true);
        expect.soft(race.clockReads).toHaveLength(1);
        expect.soft(race.requestIndex).toBe(1);
    } else {
        expect.soft(logout?.at).toBeGreaterThanOrEqual(pullResponse?.at);
        expect.soft((window as any).__zoeExpiryRace.clockTrusted).toBe(false);
    }
    expect.soft(database.cursor()).toBe(0);
});

it('hook កាន់តែចម្លើយ request ដែលបានជ្រើស មិនច្រឡំជាមួយ pull ស្របគ្នា', async () => {
    const selected = { p_since: 5 }, sibling = { p_since: 7 };
    const fake: any = { requests: [{ path: '/auth/v1/token', search: '?grant_type=refresh_token' },
        { path: '/rest/v1/rpc/zoe_pull_delta', body: selected }, { path: '/rest/v1/rpc/zoe_pull_delta', body: sibling }],
        setRpcHook(fn: any) { this.rpcHook = fn; }, setAuthHook(fn: any) { this.authHook = fn; } };
    const race = serverFixture(fake);
    await fake.rpcHook({ fn: 'zoe_pull_delta', body: selected, phase: 'before' });
    let siblingReturned = false;
    void fake.rpcHook({ fn: 'zoe_pull_delta', body: sibling, phase: 'after' }).then(() => { siblingReturned = true; });
    await turn();
    expect(siblingReturned).toBe(true); expect(race.pullHeld).toBe(false);
    const pending = fake.rpcHook({ fn: 'zoe_pull_delta', body: selected, phase: 'after' });
    await turn(); expect(race.pullHeld).toBe(true); expect(race.requestIndex).toBe(1);
    fake.requests.push({ path: '/auth/v1/logout' }); await fake.authHook({ path: '/auth/v1/logout' });
    await vi.advanceTimersByTimeAsync(400); await pending;
    expect(race.pullReleasedAfterLogout).toBe(true);
});
it('clock read មកមុន pull លើ server ត្រូវរង់ចាំ request ដែលជ្រើស មិនអនុញ្ញាត logout មុនវា', async () => {
    const selected = { p_since: 5 }, clock = { p_root: 'zoew_settings', p_key: 'exchange_rate' };
    const fake: any = { requests: [{ path: '/auth/v1/token', search: '?grant_type=refresh_token' },
        { path: '/rest/v1/rpc/zoe_read', body: clock }],
        setRpcHook(fn: any) { this.rpcHook = fn; }, setAuthHook(fn: any) { this.authHook = fn; } };
    const race = serverFixture(fake);
    let returned = false;
    const read = fake.rpcHook({ fn: 'zoe_read', body: clock, phase: 'before' }).then(() => { returned = true; });
    await turn(); expect(returned).toBe(false);
    fake.requests.push({ path: '/rest/v1/rpc/zoe_pull_delta', body: selected });
    await fake.rpcHook({ fn: 'zoe_pull_delta', body: selected, phase: 'before' });
    await vi.advanceTimersByTimeAsync(20); await read;
    expect(returned).toBe(true); expect(race.pullBeforeLogout).toBe(true);
});
