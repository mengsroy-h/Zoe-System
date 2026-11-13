import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createSupabaseDatabase } from '../../../../ZoeW/src/services/supabase-rtdb';
import { attachInfoListeners, detachInfoListeners } from '../../../../ZoeW/src/services/connection';
import { firebaseState } from '../../../../ZoeW/src/core/state';
import { cleanupClockIsTrustworthy, getServerClockBounds, getServerNow } from '../../../../ZoeW/src/core/clock';

const START = Date.UTC(2026, 10, 8);
const DAY = 86400000;
const turn = async () => { for (let n = 0; n < 80; n++) await Promise.resolve(); };
const databases: any[] = [];
let elapsed = 1000;

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(START);
    elapsed = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => elapsed);
    Object.assign(firebaseState, { serverTimeOffsetMs: 0, serverClockTrusted: false,
        hasEverConnectedToDatabase: false, isDatabaseConnected: false, auth: null,
        infoListenersFailed: false, infoListenerRecoveryTimer: null, reconnectWatchdogTimer: null });
});

afterEach(() => {
    detachInfoListeners();
    for (const db of databases.splice(0)) db.close('test');
    vi.clearAllTimers();
    vi.useRealTimers();
});

function sampleWorld(authenticated = true) {
    let finish!: (value: any) => void;
    let entered = false;
    let sample: any;
    const reply = new Promise(resolve => { finish = resolve; });
    const db = createSupabaseDatabase({ subscribe: () => () => {}, ping: async () => true,
        rpc: async (fn: string) => {
            expect(fn).toBe('zoe_pull');
            entered = true;
            await reply;
            return sample;
        } }, { onListenerError: vi.fn(), onSynced: vi.fn(), onForbidden: vi.fn(), onTxOutcomeUnknown: vi.fn() },
    { pollFallbackMs: DAY });
    databases.push(db);
    firebaseState.db = db;
    firebaseState.fb = { __supabase: true, off: ref => db.off(ref), onValue: (ref, cb, err) => db.onValue(ref, cb, err) };
    firebaseState.dbRefConnected = db.ref('.info/connected');
    firebaseState.dbRefServerTimeOffset = db.ref('.info/serverTimeOffset');
    expect(attachInfoListeners()).toBe(true);
    db.setTenantTopic('zoe:A');
    if (authenticated) db.setAuthed(true, 'project|user');
    else db.start();
    return { db, entered: () => entered, finish: (serverNow: unknown) => {
        sample = { seq: 0, head: 0, more: false, reset: true, tenant: 'A', now: serverNow, rows: [] };
        finish(sample);
    } };
}

it.each([-365 * DAY, 0, 365 * DAY])('RPC ដែលមានពេលវេលាមិនប្រាកដ រង់ចាំ sample ស្រស់ %s', async jump => {
    const world = sampleWorld(); await turn();
    expect(world.entered()).toBe(true);
    expect(firebaseState.serverClockTrusted).toBe(false);
    elapsed += 200;
    vi.setSystemTime(START + 200 + jump);
    world.finish(START + 100);
    await turn();
    expect(world.db.isReady()).toBe(true);
    expect(firebaseState.isDatabaseConnected).toBe(true);
    expect(cleanupClockIsTrustworthy()).toBe(jump === 0);
    if (jump === 0) expect(getServerNow()).toBe(START + 200);
    else {
        world.finish(START + 200);
        world.db.goOnline(); await turn();
        expect(cleanupClockIsTrustworthy()).toBe(true);
        expect(getServerNow()).toBe(START + 200);
    }
});

it('offset សូន្យពិតបន្ទាប់ពី placeholder ត្រូវបើកទំនុកចិត្ត', async () => {
    const world = sampleWorld(); await turn();
    expect(world.entered()).toBe(true);
    expect(cleanupClockIsTrustworthy()).toBe(false);
    world.finish(START); await turn();
    expect(world.db.isReady()).toBe(true);
    expect(firebaseState.isDatabaseConnected).toBe(true);
    expect(cleanupClockIsTrustworthy()).toBe(true);
    expect(getServerNow()).toBe(START);
});

it.each([-DAY, DAY])('offset មិនមែនសូន្យ %s នៅដំណើរការធម្មតា', async offset => {
    const world = sampleWorld(); await turn();
    expect(world.entered()).toBe(true);
    world.finish(START + offset); await turn();
    expect(cleanupClockIsTrustworthy()).toBe(true);
    expect(getServerNow()).toBe(START + offset);
});

it.each([undefined, null, NaN, Infinity, 0, -1])('ម៉ោង Server មិនត្រឹមត្រូវ %s មិនបើកទំនុកចិត្ត', async value => {
    const world = sampleWorld(); await turn();
    expect(world.entered()).toBe(true);
    world.finish(value); await turn();
    expect(world.db.isReady()).toBe(true);
    expect(firebaseState.isDatabaseConnected).toBe(true);
    expect(firebaseState.serverClockTrusted).toBe(false);
    expect(cleanupClockIsTrustworthy()).toBe(false);
});

it('ping ជោគជ័យដោយគ្មាន sample មិនបើកទំនុកចិត្តទោះភ្ជាប់ listener ឡើងវិញ', async () => {
    const world = sampleWorld(false); await turn();
    expect(world.entered()).toBe(false);
    expect(firebaseState.isDatabaseConnected).toBe(true);
    expect(firebaseState.serverClockTrusted).toBe(false);
    expect(attachInfoListeners()).toBe(true); await turn();
    expect(firebaseState.serverClockTrusted).toBe(false);
    world.db.goOffline(); await turn();
    expect(firebaseState.serverClockTrusted).toBe(false);
    world.db.goOnline(); await turn();
    expect(firebaseState.serverClockTrusted).toBe(false);
    world.db.setAuthed(true, 'project|user'); await turn();
    expect(world.entered()).toBe(true);
    world.finish(START); await turn();
    expect(cleanupClockIsTrustworthy()).toBe(true);
});

it('sample សូន្យដដែលនៅដំណើរការក្រោយភ្ជាប់ឡើងវិញ', async () => {
    const world = sampleWorld(); await turn();
    world.finish(START); await turn();
    expect(cleanupClockIsTrustworthy()).toBe(true);
    world.db.goOffline(); await turn();
    expect(cleanupClockIsTrustworthy()).toBe(false);
    world.db.goOnline(); await turn();
    expect(cleanupClockIsTrustworthy()).toBe(true);
    expect(getServerNow()).toBe(START);
});

it('reply ចាស់ក្រោយ goOffline មិនអាចបើកការសម្អាតឡើងវិញ', async () => {
    const world = sampleWorld(); await turn();
    expect(world.entered()).toBe(true);
    world.db.goOffline();
    world.finish(START + DAY); await turn();
    expect(firebaseState.isDatabaseConnected).toBe(false);
    expect(cleanupClockIsTrustworthy()).toBe(false);
    world.db.goOnline(); await turn();
    expect(firebaseState.isDatabaseConnected).toBe(true);
    expect(cleanupClockIsTrustworthy()).toBe(true);
});

it('reply ចាស់ក្រោយ browser offline មិនអាចបើកការសម្អាតឡើងវិញ', async () => {
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    const world = sampleWorld(); await turn();
    expect(world.entered()).toBe(true);
    online.mockReturnValue(false); world.db.onBrowserOffline();
    world.finish(START + DAY); await turn();
    expect(firebaseState.isDatabaseConnected).toBe(false);
    expect(cleanupClockIsTrustworthy()).toBe(false);
    online.mockReturnValue(true); world.db.onBrowserOnline(); await turn();
    expect(cleanupClockIsTrustworthy()).toBe(true);
});

it.each([0, 100, 200])('ភាពមិនស្មើបណ្តាញ %s មិនលើសព្រំដែន RTT ពាក់កណ្តាល', async serverProgress => {
    const world = sampleWorld(); await turn();
    expect(world.entered()).toBe(true);
    elapsed += 200;
    vi.setSystemTime(START + 200);
    world.finish(START + serverProgress); await turn();
    expect(cleanupClockIsTrustworthy()).toBe(true);
    expect(Math.abs(getServerNow() - (START + 200))).toBeLessThanOrEqual(100);
});

it.each([-365 * DAY, 365 * DAY])('ម៉ោងក្រោយ sample មិនលោតតាមឧបករណ៍ %s', async jump => {
    const world = sampleWorld(); await turn();
    world.finish(START); await turn();
    expect(cleanupClockIsTrustworthy()).toBe(true);
    elapsed += 1000;
    vi.setSystemTime(START + 1000 + jump);
    expect(getServerNow()).toBe(START + 1000);
    expect(attachInfoListeners()).toBe(true); await turn();
    expect(getServerNow()).toBe(START + 1000);
    expect(cleanupClockIsTrustworthy()).toBe(false);
});

it('listener ថ្មីយក sample ដើម មិនបង្កើតម៉ោងពី offset ចាស់', async () => {
    const world = sampleWorld(); await turn();
    detachInfoListeners();
    world.finish(START); await turn();
    elapsed += 1000;
    vi.setSystemTime(START + 365 * DAY + 1000);
    expect(attachInfoListeners()).toBe(true); await turn();
    expect(getServerNow()).toBe(START + 1000);
    expect(cleanupClockIsTrustworthy()).toBe(false);
});


it('sample ស្រស់មាន offset សូន្យដដែល កែម៉ោងក្រោយផ្អាក monotonic', async () => {
    const world = sampleWorld(); await turn();
    world.finish(START); await turn();
    expect(getServerNow()).toBe(START);
    world.db.goOffline();
    vi.setSystemTime(START + DAY);
    expect(getServerNow()).toBe(START);
    world.finish(START + DAY);
    world.db.goOnline(); await turn();
    expect(firebaseState.serverTimeOffsetMs).toBe(0);
    expect(getServerNow()).toBe(START + DAY);
    expect(cleanupClockIsTrustworthy()).toBe(true);
});


it('RPC ឆ្លងការផ្អាក monotonic មិនបើក trust ពីម៉ោងចាស់', async () => {
    const world = sampleWorld(); await turn();
    vi.setSystemTime(START + 20 * DAY);
    world.finish(START); await turn();
    expect(cleanupClockIsTrustworthy()).toBe(false);
});

it('RTT ហួសពិដានមិនបង្កើតម៉ោងអនាគត', async () => {
    const world = sampleWorld(); await turn();
    elapsed += 20 * DAY;
    vi.setSystemTime(START + 20 * DAY);
    world.finish(START + 20 * DAY); await turn();
    expect(cleanupClockIsTrustworthy()).toBe(false);
    expect(getServerNow()).toBeLessThanOrEqual(START + 20 * DAY);
});


it('Supabase រក្សា midpoint សម្រាប់ timestamp និង interval សម្រាប់អាយុ', async () => {
    const world = sampleWorld(); await turn();
    expect(world.entered()).toBe(true);
    elapsed += 19000; vi.setSystemTime(START + 19000);
    world.finish(START + 19000); await turn();
    expect(cleanupClockIsTrustworthy()).toBe(true);
    expect(getServerNow()).toBe(START + 28500);
    expect(getServerClockBounds()).toEqual({ lowerMs: START + 19000, upperMs: START + 38000 });
    const { barcodeCloseIsRipe } = await import('../../../../ZoeW/src/domain/barcode');
    const { TWO_HOURS_MS } = await import('../../../../ZoeW/src/features/session');
    const barcode = { code: 'SYNTHETIC', isClosed: true, closedAt: START + 19000 - TWO_HOURS_MS + 5000 };
    expect(barcodeCloseIsRipe(barcode, START + 19000, 'local')).toBe(false);
    expect(barcodeCloseIsRipe(barcode, getServerClockBounds()!.lowerMs, 'local')).toBe(false);
});

it('Supabase interval ឆ្លងពេលផុត License រក្សា Activation ជំនួសការលុប', async () => {
    vi.spyOn(crypto.subtle, 'importKey').mockResolvedValue({} as any);
    vi.spyOn(crypto.subtle, 'verify').mockResolvedValue(true);
    vi.stubGlobal('ZoeSeatConfig', { legacyProtocolEnabled: true });
    new Function(readFileSync('public/license-verify.js', 'utf8'))();
    const device = 'SYNTHETICDEVICE1234567890';
    const payload = { a: 'ZOE', id: 'SYNTHETICKEY', iat: START / 1000, exp: (START + DAY) / 1000 };
    const keyString = 'ZOEKEY-' + Buffer.from(JSON.stringify(payload)).toString('base64url') + '.AA';
    const storageKey = 'zoe_license_activation_ZOE';
    localStorage.setItem('zoe_license_device_id', device);
    localStorage.setItem(storageKey, JSON.stringify({ ...payload, keyString, activatedAt: START, lastOnlineCheck: START, onlineExp: START + 23000, seenMax: START, releaseEpoch: 0 }));
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: true, status: 200, headers: { get: () => null }, json: async () => {
        if (url.includes('/license_keys/')) return { expiresAt: START + 23000, maxDevices: 1 };
        if (url.includes('/license_seats/')) return { d1: { device, at: START, releaseEpoch: 0 } };
        throw new Error('Unexpected synthetic request');
    } })));
    try {
        const world = sampleWorld(); await turn();
        elapsed += 18000; vi.setSystemTime(START + 18000);
        world.finish(START + 18000); await turn();
        expect(getServerNow()).toBe(START + 27000);
        expect(window.ZoeLicense!.getServerTimeSample()).toMatchObject({ epochMs: START + 18000, uncertaintyMs: 18000, source: 'supabase-rpc' });
        expect(await window.ZoeLicense!.getStatus('ZOE')).toMatchObject({ state: 'offline-grace-exceeded', reason: 'clock-unverified' });
        expect(localStorage.getItem(storageKey)).not.toBe(null);
    } finally {
        delete window.ZoeLicense;
        localStorage.removeItem(storageKey); localStorage.removeItem('zoe_license_device_id');
        vi.unstubAllGlobals();
    }
});
