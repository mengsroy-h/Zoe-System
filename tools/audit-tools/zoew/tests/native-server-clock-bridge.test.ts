import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { parse } from 'acorn';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { attachInfoListeners, detachInfoListeners } from '../../../../ZoeW/src/services/connection';
import { firebaseState } from '../../../../ZoeW/src/core/state';
import { acceptServerClockOffset, captureClockOperation, cleanupClockIsTrustworthy, getServerClockBounds, getServerNow, resetServerClock, serverClockIsTrustworthy, SERVER_CLOCK_REFRESH_GAP_MS } from '../../../../ZoeW/src/core/clock';
import { getFirebaseSessionVerdict } from '../../../../ZoeW/src/features/session';
import * as licenseRecovery from '../../../../ZoeW/src/features/license';
import { scanOperationValid } from '../../../../ZoeW/src/domain/scan-protocol';
import { canonicalBarcodeRegistryKey } from '../../../../ZoeW/src/domain/barcode-key';
import { acceptFixtureSession, configureFixtureBackend } from './helpers/accepted-session';

const START = Date.UTC(2026, 10, 8);
const HOUR = 3600000;
const turn = async () => { for (let n = 0; n < 80; n++) await Promise.resolve(); };
const verifierSource = readFileSync('public/license-verify.js', 'utf8');
const require = createRequire(import.meta.url);
const sdkSource = readFileSync(require.resolve('@firebase/database'), 'utf8');
const sdkTree: any = parse(sdkSource, { ecmaVersion: 'latest', sourceType: 'module' });
const connectionClass = sdkTree.body.find((node: any) => node.type === 'ClassDeclaration' && node.id.name === 'PersistentConnection');
function sdkMethod(name: string) {
    const node = connectionClass.body.body.find((value: any) => value.key.name === name).value;
    return new Function('return function' + sdkSource.slice(node.start, node.end))();
}
let elapsed: number;
let connected: boolean;
let offset: number;
let callbacks: Map<string, (snap: any) => void>;
let requests: Array<{ url: string; resolve: (value: any) => void }>;
let api: any;

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(START);
    elapsed = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => elapsed);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    callbacks = new Map(); requests = []; connected = true; offset = 0;
    vi.stubGlobal('fetch', vi.fn((url: string) => new Promise(resolve => requests.push({ url, resolve }))));
    new Function(verifierSource)();
    api = window.ZoeLicense;
    resetServerClock();
    configureFixtureBackend('native-server-clock');
    Object.assign(firebaseState, { db: {}, auth: null, isDatabaseConnected: false, hasEverConnectedToDatabase: false,
        infoListenersFailed: false, infoListenerRecoveryTimer: null, reconnectWatchdogTimer: null,
        sessionExpiryCheck: 'live', sessionExpiryCheckInFlight: false,
        dbRefConnected: 'connected', dbRefServerTimeOffset: 'offset',
        fb: { off: (ref: string) => callbacks.delete(ref), onValue: (ref: string, cb: (value: any) => void) => {
            callbacks.set(ref, cb); cb({ val: () => ref === 'connected' ? connected : offset });
        }, goOnline: vi.fn(), goOffline: vi.fn(), signOut: vi.fn(async () => {}),
        getIdTokenResult: vi.fn(async () => ({ authTime: new Date(START - 2 * HOUR).toISOString() })) } });
});

afterEach(() => {
    detachInfoListeners(); resetServerClock(); delete window.ZoeLicense;
    vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals();
});

function installUser(uid = 'fixture') {
    const user = { uid };
    firebaseState.auth = { app: { options: firebaseState.firebaseConfig }, currentUser: user } as any;
    acceptFixtureSession();
    return user;
}

function reply(index = requests.length - 1, now = Date.now(), extra = {}) {
    const request = requests[index];
    expect(request).toBeDefined();
    request.resolve({ ok: true, status: 200, redirected: false,
        headers: { get: (name: string) => name === 'Content-Type' ? 'application/json' : null },
        json: async () => ({ now, nonce: new URL(request.url).searchParams.get('nonce'), ...extra }) });
}
async function seed() {
    const pending = api.syncServerTime({ priority: true });
    reply(); expect(await pending).toBe(true);
    expect(Object.isFrozen(api.getServerTimeSample())).toBe(true);
    expect(attachInfoListeners()).toBe(true);
    expect(cleanupClockIsTrustworthy()).toBe(true);
    expect(getServerNow()).toBe(START);
    await turn();
}
function sdkReady(timestamp: number) {
    const events: string[] = [];
    const native = { log_: () => {}, firstConnection_: false, restoreState_: () => {},
        handleTimestamp_: sdkMethod('handleTimestamp_'),
        onServerInfoUpdate_: (value: any) => {
            events.push('offset');
            if (value.serverTimeOffset !== offset) { offset = value.serverTimeOffset; callbacks.get('offset')!({ val: () => offset }); }
        }, onConnectStatus_: (value: boolean) => { events.push('connected'); connected = value; callbacks.get('connected')!({ val: () => value }); } };
    sdkMethod('onReady_').call(native, timestamp, 'fixture');
    expect(events).toEqual(['offset', 'connected']);
}

it('Firebase ភ្ជាប់ដោយគ្មាន verifier មិនបើក trust', async () => {
    delete window.ZoeLicense;
    expect(attachInfoListeners()).toBe(true); await turn();
    expect(cleanupClockIsTrustworthy()).toBe(false);
    expect(globalThis.fetch).not.toHaveBeenCalled();
});

it('Firebase រង់ចាំ nonce request ស្រស់ មិនជឿ info offset', async () => {
    expect(attachInfoListeners()).toBe(true);
    expect(cleanupClockIsTrustworthy()).toBe(false); await turn();
    expect(requests).toHaveLength(1);
    reply(); await turn();
    expect(cleanupClockIsTrustworthy()).toBe(true);
    expect(getServerNow()).toBe(START);
    expect(api.getServerTimeSample().source).toBe('nonce');
    expect(firebaseState.fb.goOffline).not.toHaveBeenCalled();
});

it('sample HTTP Date ដែល verifier ផ្ទៀងផ្ទាត់ អាចបើក trust', async () => {
    const pending = api.checkOnline('ZOEW', 'fixture', { priority: true });
    expect(requests).toHaveLength(1);
    requests[0].resolve({ ok: true, status: 200, headers: { get: (key: string) => key === 'Date' ? new Date(START).toUTCString() : null }, json: async () => null });
    await pending;
    expect(api.getServerTimeSample().source).toBe('http-date');
    attachInfoListeners();
    expect(cleanupClockIsTrustworthy()).toBe(true);
});

it('offset ពី app មិនអាចជុំវិញទៅជា sample ស្រស់', async () => {
    api.setServerTimeOffset(500);
    expect(api.getServerTimeSample().source).toBe('offset');
    attachInfoListeners(); await turn();
    expect(cleanupClockIsTrustworthy()).toBe(false);
    expect(requests).toHaveLength(1);
    reply(); await turn();
    expect(cleanupClockIsTrustworthy()).toBe(true);
    expect(api.getServerTimeSample().source).toBe('nonce');
});

it.each([false, true])('SDK handshake ចាស់ក្រោយផ្អាក មិនផ្តល់ session live %s', async checked => {
    await seed();
    const lease = captureClockOperation();
    connected = false; callbacks.get('connected')!({ val: () => false });
    vi.setSystemTime(START + 3 * HOUR);
    if (checked) expect(cleanupClockIsTrustworthy()).toBe(false);
    sdkReady(START);
    expect(offset).toBe(-3 * HOUR);
    const user = installUser();
    expect(await getFirebaseSessionVerdict(user)).toBe('unverified');
    expect(lease.current()).toBe(false);
    expect(cleanupClockIsTrustworthy()).toBe(false);
    expect(firebaseState.fb.signOut).not.toHaveBeenCalled();
});

it.each([false, true])('bootstrap និង listener ថ្មីមិនជឿ SDK request ដែលផ្អាក %s', async reattach => {
    connected = false;
    attachInfoListeners(); await turn();
    vi.setSystemTime(START + 3 * HOUR);
    if (reattach) attachInfoListeners();
    sdkReady(START);
    reply(0, START); await turn();
    expect(cleanupClockIsTrustworthy()).toBe(false);
    const user = installUser();
    expect(await getFirebaseSessionVerdict(user)).toBe('unverified');
});

it('SDK handshake ស្រស់តែមួយក៏មិនមែន time authority', async () => {
    await seed();
    connected = false; callbacks.get('connected')!({ val: () => false });
    vi.setSystemTime(START + 3 * HOUR);
    sdkReady(START + 3 * HOUR);
    expect(cleanupClockIsTrustworthy()).toBe(false); await turn();
    reply(); await turn();
    expect(cleanupClockIsTrustworthy()).toBe(true);
    expect(getServerNow()).toBe(START + 3 * HOUR);
    const user = installUser();
    expect(await getFirebaseSessionVerdict(user)).toBe('expired');
});

it('nonce មិនត្រូវគ្នាមិនបើក trust', async () => {
    attachInfoListeners(); await turn(); reply(0, START, { nonce: 'old-response' }); await turn();
    expect(cleanupClockIsTrustworthy()).toBe(false);
});

it('endpoint បរាជ័យនៅ unverified ហើយសាកឡើងវិញមានចន្លោះ', async () => {
    attachInfoListeners(); await turn();
    requests[0].resolve({ ok: false, status: 503, headers: { get: () => null } }); await turn();
    for (let n = 0; n < 20; n++) expect(cleanupClockIsTrustworthy()).toBe(false);
    await turn(); expect(requests).toHaveLength(1);
    elapsed += SERVER_CLOCK_REFRESH_GAP_MS; vi.setSystemTime(START + SERVER_CLOCK_REFRESH_GAP_MS);
    expect(cleanupClockIsTrustworthy()).toBe(false); await turn(); expect(requests).toHaveLength(2);
    reply(); await turn(); expect(cleanupClockIsTrustworthy()).toBe(true);
});

it.each(['sleep', 'slow'])('request មិនស្រស់ %s មិនបើក trust', async mode => {
    attachInfoListeners(); await turn();
    vi.setSystemTime(START + 3 * HOUR); if (mode === 'slow') elapsed += 3 * HOUR;
    reply(0, START); await turn();
    expect(cleanupClockIsTrustworthy()).toBe(false);
});

it.each(['listener', 'database', 'sdk', 'library', 'reset'])('ចម្លើយពី owner ចាស់ %s មិនបើក trust', async owner => {
    attachInfoListeners(); await turn();
    if (owner === 'listener') detachInfoListeners();
    if (owner === 'database') firebaseState.db = {};
    if (owner === 'sdk') firebaseState.fb = { ...firebaseState.fb };
    if (owner === 'library') new Function(verifierSource)();
    if (owner === 'reset') api.resetServerTime();
    reply(); await turn();
    expect(firebaseState.serverClockTrusted).toBe(false);
});

it('cached sample រក្សា epoch និង monotonic ដើមពេល listener ភ្ជាប់ឡើងវិញ', async () => {
    await seed();
    const sample = api.getServerTimeSample();
    elapsed += 1500; vi.setSystemTime(START + 1500);
    attachInfoListeners();
    expect(api.getServerTimeSample()).toBe(sample);
    expect(getServerNow()).toBe(START + 1500);
    vi.setSystemTime(START + 3 * HOUR + 1500);
    attachInfoListeners();
    expect(getServerNow()).toBe(START + 1500);
    expect(cleanupClockIsTrustworthy()).toBe(false);
});

it('ម៉ោងនៅក្រៅបណ្តាញត្រឹមត្រូវរក្សា anchor និង session expiry', async () => {
    await seed();
    connected = false; callbacks.get('connected')!({ val: () => false });
    elapsed += 3 * HOUR; vi.setSystemTime(START + 3 * HOUR);
    expect(serverClockIsTrustworthy()).toBe(true);
    expect(cleanupClockIsTrustworthy()).toBe(false);
    const user = installUser();
    expect(await getFirebaseSessionVerdict(user)).toBe('expired');
    await turn(); expect(requests).toHaveLength(1);
});

it('provider មិនត្រូវបានកែ offset ដោយ native info', async () => {
    await seed();
    const sample = api.getServerTimeSample(); const setter = vi.spyOn(api, 'setServerTimeOffset');
    offset = 500; callbacks.get('offset')!({ val: () => offset });
    expect(setter).not.toHaveBeenCalled();
    expect(api.getServerTimeSample()).toBe(sample);
    expect(getServerNow()).toBe(START);
});

it('ផ្អាកក្រោយ verifier ទទួល sample មុន bridge មិន recapture', async () => {
    const original = api.syncServerTime;
    api.syncServerTime = async (options: any) => { const result = await original(options); vi.setSystemTime(START + 3 * HOUR); return result; };
    attachInfoListeners(); await turn(); reply(); await turn();
    expect(cleanupClockIsTrustworthy()).toBe(false);
});

it('nonce ស្រស់ offset សូន្យផ្ទៀងផ្ទាត់ session ទោះ DB មិនទាន់ភ្ជាប់', async () => {
    connected = false;
    attachInfoListeners(); await turn(); reply(); await turn();
    expect(serverClockIsTrustworthy()).toBe(true);
    expect(cleanupClockIsTrustworthy()).toBe(false);
    const user = installUser();
    expect(await getFirebaseSessionVerdict(user)).toBe('live');
});

it('nonce ស្រស់កែ provider offset ខុស មិនរង់ចាំ retry មួយទៀត', async () => {
    api.setServerTimeOffset(24 * HOUR);
    attachInfoListeners(); await turn(); reply(); await turn();
    expect(cleanupClockIsTrustworthy()).toBe(true);
    expect(getServerNow()).toBe(START);
});


it.each([null, undefined, Object.freeze({}), Object.freeze([]), Object.freeze({ epochMs: 0, wallMs: START, monotonicMs: 1000 }), Object.freeze({ epochMs: START, wallMs: NaN, monotonicMs: 1000 }), Object.freeze({ epochMs: START, wallMs: START, monotonicMs: -1 })])('metadata មិនត្រឹមត្រូវ %s មិនជំនួសច្រក offset សូន្យ', sample => {
    expect(acceptServerClockOffset(0, sample, false)).toBe(false);
    expect(serverClockIsTrustworthy()).toBe(false);
});

it('nonce ស្រស់បើក session ដែល unverified ដោយមិន sign out', async () => {
    installUser();
    firebaseState.sessionExpiryCheck = 'unverified';
    attachInfoListeners(); await turn();
    expect(firebaseState.sessionExpiryCheck).toBe('unverified');
    reply(); await turn();
    expect(firebaseState.sessionExpiryCheck).toBe('live');
    expect(firebaseState.fb.signOut).not.toHaveBeenCalled();
});

it('request ដែល hang ផុតពេលហើយអាចសាកឡើងវិញដោយ sample ស្រស់', async () => {
    attachInfoListeners(); await turn(); expect(requests).toHaveLength(1);
    elapsed += 10001; await vi.advanceTimersByTimeAsync(10001); await turn();
    expect(cleanupClockIsTrustworthy()).toBe(false);
    elapsed += SERVER_CLOCK_REFRESH_GAP_MS; vi.setSystemTime(Date.now() + SERVER_CLOCK_REFRESH_GAP_MS);
    expect(cleanupClockIsTrustworthy()).toBe(false); await turn(); expect(requests).toHaveLength(2);
    reply(); await turn(); expect(cleanupClockIsTrustworthy()).toBe(true);
    reply(0, START); await turn(); expect(getServerNow()).toBe(START + 10001 + SERVER_CLOCK_REFRESH_GAP_MS);
});

it('ព្រំដែនលើឆ្លងពេលផុតវគ្គ មិនផ្ដល់សិទ្ធិ live', async () => {
 attachInfoListeners(); await turn();
 elapsed += 9000; vi.setSystemTime(START + 9000);
 reply(0, START); await turn();
 expect(api.getServerTimeSample().uncertaintyMs).toBe(9000);
 expect(serverClockIsTrustworthy()).toBe(true);
 const user = installUser('synthetic');
 firebaseState.fb.getIdTokenResult.mockResolvedValue({authTime:new Date(START - 4*HOUR + 5000).toISOString()});
 expect(Date.now() - (START - 4*HOUR + 5000)).toBeGreaterThan(4*HOUR);
 expect(await getFirebaseSessionVerdict(user)).toBe('unverified');
});
it('sample ស្រស់ដែល interval ត្រួតគ្នា រក្សា lease ដើម', async () => {
 attachInfoListeners(); await turn();
 elapsed += 9000; vi.setSystemTime(START + 9000);
 reply(0, START); await turn();
 const generation=api.getServerTimeGeneration();
 const lease=captureClockOperation(); expect(lease.current()).toBe(true);
 const pending=api.syncServerTime({priority:true}); reply(1,START+9000); await pending;
 expect(api.getServerTimeGeneration()).toBe(generation);
 callbacks.get('connected')!({val:()=>true});
 expect(serverClockIsTrustworthy()).toBe(true);
 expect(lease.current()).toBe(true);
});


it('nonce យឺតរក្សា estimate សម្រាប់ timestamp និង bounds សម្រាប់សុវត្ថិភាព', async () => {
    attachInfoListeners(); await turn();
    elapsed += 9000; vi.setSystemTime(START + 9000);
    reply(0, START); await turn();
    expect(getServerNow()).toBe(START + 4500);
    expect(getServerClockBounds()).toEqual({ lowerMs: START, upperMs: START + 9000 });
    expect(api.getTrustedServerNow()).toBe(START);
});

it.each([null, NaN, Infinity, -1, '1'])('uncertainty មិនត្រឹមត្រូវមិនអាចបើក trust %s', uncertaintyMs => {
    const sample = Object.freeze({ epochMs: START, wallMs: START, monotonicMs: 1000, uncertaintyMs });
    expect(acceptServerClockOffset(0, sample, false)).toBe(false);
    expect(getServerClockBounds()).toBe(null);
});


it('sample native ស្រស់សាក Activation ម្តង មិនធ្វើម្ដងទៀតពី cache', async () => {
    const retry = vi.spyOn(licenseRecovery, 'retryPendingActivation').mockResolvedValue(false);
    await seed(); expect(retry).toHaveBeenCalledTimes(1);
    callbacks.get('offset')!({ val: () => 0 }); callbacks.get('connected')!({ val: () => true }); await turn();
    expect(retry).toHaveBeenCalledTimes(1);
    elapsed += 1000; vi.setSystemTime(START + 1000);
    const pending = api.syncServerTime({ priority: true }); reply(); await pending;
    callbacks.get('offset')!({ val: () => 0 }); await turn();
    expect(retry).toHaveBeenCalledTimes(2); retry.mockRestore();
});

it('sample Supabase ស្រស់សាក Activation ម្តង ហើយ cache មិនសាកម្ដងទៀត', async () => {
    const retry = vi.spyOn(licenseRecovery, 'retryPendingActivation').mockResolvedValue(false);
    firebaseState.fb.__supabase = true; attachInfoListeners();
    const sample = Object.freeze({ epochMs: START, estimateEpochMs: START, uncertaintyMs: 0, monotonicMs: elapsed, wallMs: START, source: 'supabase-rpc' });
    callbacks.get('offset')!({ val: () => 0, serverClockSample: sample } as any); await turn();
    expect(retry).toHaveBeenCalledTimes(1);
    callbacks.get('offset')!({ val: () => 0, serverClockSample: sample } as any); await turn();
    expect(retry).toHaveBeenCalledTimes(1); retry.mockRestore();
});

it('offset native ដែលមិនផ្ទៀង មិនជំរុញ Activation ឡើងវិញ', async () => {
    const retry = vi.spyOn(licenseRecovery, 'retryPendingActivation').mockResolvedValue(false);
    attachInfoListeners(); await turn();
    callbacks.get('offset')!({ val: () => 1000 }); await turn();
    expect(retry).not.toHaveBeenCalled(); retry.mockRestore();
});


it.each(['reset', 'uncertain'])('ជំនាន់ verifier ថ្មីបោះបង់ lease ទោះ core មិនឃើញការរំខាន %s', async change => {
    await seed();
    const first = api.getServerTimeSample();
    const lease = captureClockOperation();
    expect(lease.current()).toBe(true);
    if (change === 'reset') api.resetServerTime();
    else {
        vi.setSystemTime(START + 24 * HOUR);
        expect(api.getTrustedServerNow()).toBe(null);
        vi.setSystemTime(START);
    }
    expect(firebaseState.serverClockTrusted).toBe(true);
    const pending = api.syncServerTime({ priority: true });
    reply(); expect(await pending).toBe(true);
    const fresh = api.getServerTimeSample();
    expect(fresh.generation).not.toBe(first.generation);
    expect(fresh.epochMs).toBe(first.epochMs);
    expect(fresh.monotonicMs).toBe(first.monotonicMs);
    callbacks.get('connected')!({ val: () => true });
    expect(serverClockIsTrustworthy()).toBe(true);
    expect(getServerNow()).toBe(START);
    expect(lease.current()).toBe(false);
});


it.each([1, 3.25])('nonce RTT %s ms នៅតែបង្កើត timestamp ដែល Scan Protocol ទទួល', async roundTrip => {
    attachInfoListeners(); await turn();
    elapsed += roundTrip; vi.setSystemTime(START + Math.floor(roundTrip));
    reply(0, START); await turn();
    const operation = { v: 2, id: 'scan_' + 'a'.repeat(32), actorUid: 'fixture', scope: 'fixture', code: 'CLOCK',
        registryKey: canonicalBarcodeRegistryKey('CLOCK'), birth: START, scanDate: '2026-11-08', month: '2026-11',
        cod: 0, dod: 0, count: 1, monthToken: 'op_m' + 'a'.repeat(32), phase: 'admitted' };
    expect(scanOperationValid(operation)).toBe(true);
    const stamp = getServerNow();
    expect(stamp).toBeGreaterThanOrEqual(START);
    expect(stamp).toBeLessThanOrEqual(START + roundTrip);
    expect(scanOperationValid({ ...operation, birth: stamp })).toBe(true);
    expect(getServerClockBounds()).toEqual({ lowerMs: START, upperMs: START + roundTrip });
    elapsed += 1.5; vi.setSystemTime(Date.now() + 1);
    expect(scanOperationValid({ ...operation, birth: getServerNow() })).toBe(true);
});


it('HTTP Date មាន body elapsed ប្រភាគ រក្សា timestamp ជាចំនួនគត់ និង bounds ដើម', async () => {
    const pending = api.checkOnline('ZOEW', 'fixture', { priority: true });
    requests[0].resolve({ ok: true, status: 200,
        headers: { get: (key: string) => key === 'Date' ? new Date(START).toUTCString() : null },
        json: async () => { elapsed += 0.5; vi.setSystemTime(START + 1); return null; } });
    await pending;
    const sample = api.getServerTimeSample();
    expect(sample.source).toBe('http-date');
    expect(sample.epochMs).toBe(START + 0.5);
    attachInfoListeners();
    expect(serverClockIsTrustworthy()).toBe(true);
    expect(getServerNow()).toBe(Math.round(sample.epochMs + sample.uncertaintyMs / 2));
    expect(Number.isSafeInteger(getServerNow())).toBe(true);
    expect(getServerClockBounds()).toEqual({ lowerMs: sample.epochMs, upperMs: sample.epochMs + sample.uncertaintyMs });
});
