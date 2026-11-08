import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataState, firebaseState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import { acceptServerClockOffset } from '../src/core/clock';
import { appLocalStore } from '../src/core/storage';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { ABANDON_AGE_MS, clearSensitiveModalFields } from '../src/features/session';
import { expiryScheduleTimes, nearExpiryView, NOTIFY_SCHEDULE_MAX } from '../src/features/notifications';
import { PUSH_SCHEDULE_MIN_GAP_MS, PUSH_STATE_KEY, pushRuntime, scheduleSignature, syncExpirySchedule } from '../src/features/push';

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
    firebaseState.serverClockTrusted = true;
    firebaseState.serverTimeOffsetMs = 0;
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

describe('កាលវិភាគ Push ៖ ភាពច្បាស់នៃពេល និង cache កំណែចាស់', () => {
    it('cache នាទីមុនឡើងកំណែ ➜ ផ្ញើពេលពិតដោយមិនរង់ចាំ ៦ ម៉ោង', async () => {
        vi.setSystemTime(new Date('2026-09-29T00:02:00Z'));
        const at8 = Date.now() + 3600e3;
        dataState.scanHistory = [
            { id: 'inside', createdAt: at8 + 3600e3 - ABANDON_AGE_MS, barcodes: [{ code: 'INSIDE', isClosed: false }] },
            { id: 'cutoff', createdAt: at8 + 24 * 3600e3 - ABANDON_AGE_MS - 1, barcodes: [{ code: 'CUTOFF', isClosed: false }] }
        ] as any;
        // Fixture ពី 578ca5be៖ times [1790647334062,1790730148125] មាន schedSig '2:fsl8ys'។
        appLocalStore.setItem(PUSH_STATE_KEY, JSON.stringify({ ...saved(), schedSig: '2:fsl8ys', schedAt: Date.now() }));
        const expected = [1790647320001, 1790730120000];
        expect(expiryScheduleTimes(dataState.scanHistory, Date.now())).toEqual(expected);
        const posts: any[] = [];
        vi.stubGlobal('fetch', vi.fn(async (_url, options) => { posts.push(JSON.parse(options.body)); return reply(); }));
        expect(await syncExpirySchedule()).toBe(true);
        expect(posts.map(post => post.times)).toEqual([expected]);
        expect(saved().schedSig).toBe(scheduleSignature(expected));
        expect(saved().schedSig).not.toBe('2:fsl8ys');
        vi.setSystemTime(Date.now() + PUSH_SCHEDULE_MIN_GAP_MS + 1);
        expect(await syncExpirySchedule()).toBe(false);
        expect(posts).toHaveLength(1);
    });

    it('ពេលពីរផ្លាស់ +១/−៣១ ms ➜ ចំនួនក្នុង ២៤ ម៉ោងប្រែ ហើយ cache មិនបាំងការផ្ញើ', async () => {
        vi.setSystemTime(new Date('2026-09-29T00:02:00Z'));
        const at8 = Date.now() + 3600e3;
        const first = [1790647320000, 1790730120001];
        const second = [1790647320001, 1790730119970];
        dataState.scanHistory = first.map((at, i) => ({ id: 'collision-' + i, createdAt: at - ABANDON_AGE_MS - 1,
            barcodes: [{ code: 'COLLISION-' + i, isClosed: false }] })) as any;
        expect(nearExpiryView(dataState.scanHistory, at8, false).packages).toBe(1);
        const posts: any[] = [];
        vi.stubGlobal('fetch', vi.fn(async (_url, options) => { posts.push(JSON.parse(options.body)); return reply(); }));
        expect(await syncExpirySchedule()).toBe(true);
        expect(posts.map(post => post.times)).toEqual([first]);
        dataState.scanHistory.forEach((item, i) => { item.createdAt = second[i] - ABANDON_AGE_MS - 1; });
        expect(nearExpiryView(dataState.scanHistory, at8, false).packages).toBe(2);
        vi.setSystemTime(Date.now() + PUSH_SCHEDULE_MIN_GAP_MS + 1);
        expect(expiryScheduleTimes(dataState.scanHistory, Date.now())).toEqual(second);
        expect(await syncExpirySchedule()).toBe(true);
        expect(posts.map(post => post.times)).toEqual([first, second]);
        expect(scheduleSignature(first)).not.toBe(scheduleSignature(second));
    });

    it('cache ពេញពិដាន ២០០០ ពេល មានទំហំកំណត់ក្នុង record តែមួយ', async () => {
        const times = Array.from({ length: NOTIFY_SCHEDULE_MAX }, (_, i) => Date.now() + 3600e3 + i);
        dataState.scanHistory = times.map((at, i) => ({ id: 'bounded-' + i, createdAt: at - ABANDON_AGE_MS - 1,
            barcodes: [{ code: 'BOUNDED-' + i, isClosed: false }] })) as any;
        const posts: any[] = [];
        vi.stubGlobal('fetch', vi.fn(async (_url, options) => { posts.push(JSON.parse(options.body)); return reply(); }));
        expect(await syncExpirySchedule()).toBe(true);
        expect(posts.map(post => post.times)).toEqual([times]);
        expect(saved().schedSig).toBe(scheduleSignature(times));
        expect(saved().schedSig.length).toBeLessThanOrEqual(NOTIFY_SCHEDULE_MAX * 14 + 16);
        expect(appLocalStore.getItem(PUSH_STATE_KEY)!.length).toBeLessThan(NOTIFY_SCHEDULE_MAX * 14 + 1024);
    });

    it('កែពេលដល់កំណត់ ១០ វិនាទីក្នុងនាទីដដែល ➜ វដ្តបន្ទាប់ផ្ញើកាលវិភាគថ្មី', async () => {
        const posts: any[] = [];
        vi.stubGlobal('fetch', vi.fn(async (_url, options) => { posts.push(JSON.parse(options.body)); return reply(); }));
        expect(await syncExpirySchedule()).toBe(true);
        expect(posts).toHaveLength(1);
        const before = posts[0].times[0];
        const firstSignature = saved().schedSig;
        dataState.scanHistory[0].createdAt += 10000;
        vi.setSystemTime(Date.now() + PUSH_SCHEDULE_MIN_GAP_MS + 1);
        expect(Math.floor((before + 10000) / 60000)).toBe(Math.floor(before / 60000));
        expect(await syncExpirySchedule()).toBe(true);
        expect(posts.map(post => post.times)).toEqual([[before], [before + 10000]]);
        expect(saved().schedSig).not.toBe(firstSignature);
    });
});

describe('កាលវិភាគ Push ៖ ចម្លើយយឺតមិនចូលហាងថ្មី', () => {
    it('ត្រា Sign មកក្នុង snapshot ថ្មី ➜ វដ្តបន្ទាប់ផ្ញើកាលវិភាគទទេជំនួសកាលវិភាគដែលបានទទួលរួច', async () => {
        const posts: any[] = [];
        vi.stubGlobal('fetch', vi.fn(async (_url, options) => {
            posts.push(JSON.parse(options.body));
            return reply();
        }));
        expect(await syncExpirySchedule(true)).toBe(true);
        expect(posts[0].times).toHaveLength(1);
        expect(saved().schedSig).toBe(scheduleSignature(posts[0].times));
        const barcode = dataState.scanHistory[0].barcodes[0];
        barcode.ztoSignedAt = Date.now();
        expect(barcode.isClosed).toBe(false);
        expect(await syncExpirySchedule()).toBe(false);
        vi.setSystemTime(Date.now() + PUSH_SCHEDULE_MIN_GAP_MS + 1);
        expect(await syncExpirySchedule()).toBe(true);
        expect(posts).toHaveLength(2);
        expect(posts[1].times).toEqual([]);
        expect(saved().schedSig).toBe(scheduleSignature([]));
        expect(barcode.isClosed).toBe(false);
    });

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


it.each([[false, 0], [true, NaN], [true, Infinity]])('Push៖ force មិនជំនួស schedule ពេលម៉ោងមិនទាន់ទុកចិត្ត %s/%s', async (trusted, offset) => {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    vi.setSystemTime(now + 9 * day);
    firebaseState.serverClockTrusted = trusted as boolean;
    firebaseState.serverTimeOffsetMs = offset as number;
    appLocalStore.setItem(PUSH_STATE_KEY, JSON.stringify({ ...saved(), schedSig: 'keep-existing', schedAt: now }));
    const before = appLocalStore.getItem(PUSH_STATE_KEY);
    const posts: any[] = [];
    const fetch = vi.fn(async (_url, options) => { posts.push(JSON.parse(options.body)); return reply(); });
    vi.stubGlobal('fetch', fetch);
    expect(await syncExpirySchedule(true)).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
    expect(appLocalStore.getItem(PUSH_STATE_KEY)).toBe(before);
    expect(pushRuntime.scheduleAttemptAt).toBe(0);
    firebaseState.serverClockTrusted = true;
    firebaseState.serverTimeOffsetMs = -9 * day;
    expect(await syncExpirySchedule(true)).toBe(true);
    expect(posts).toHaveLength(1);
    expect(posts[0].times).toHaveLength(1);
    expect(posts[0].times[0]).toBeGreaterThan(now);
});


it('ម៉ោងលោតក្រោយ sync មិនជំនួសកាលវិភាគដែលបានរក្សា', async () => {
    firebaseState.isDatabaseConnected = true;
    expect(acceptServerClockOffset(0, null, false)).toBe(true);
    const before = saved();
    const send = vi.fn(async () => reply());
    vi.stubGlobal('fetch', send);
    vi.setSystemTime(Date.now() + 365 * 86400000);
    expect(await syncExpirySchedule(true)).toBe(false);
    expect(send).not.toHaveBeenCalled();
    expect(saved()).toEqual(before);
});
