import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { parse } from 'acorn';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { attachInfoListeners, detachInfoListeners } from '../../../../ZoeW/src/services/connection';
import { firebaseState } from '../../../../ZoeW/src/core/state';
import { acceptServerClockOffset, captureClockOperation, cleanupClockIsTrustworthy, getServerNow, resetServerClock, SERVER_CLOCK_REFRESH_GAP_MS } from '../../../../ZoeW/src/core/clock';

const START = Date.UTC(2026, 10, 8);
const DAY = 86400000;
let elapsed: number;
let currentOffset: unknown;
let currentSample: any;
const sampleAt = (offset: number) => Object.freeze({ epochMs: Date.now() + offset, wallMs: Date.now(), monotonicMs: elapsed });
let callbacks: Map<string, (value: any) => void>;

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(START);
    elapsed = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => elapsed);
    resetServerClock();
    currentOffset = 0;
    currentSample = sampleAt(0);
    callbacks = new Map();
    Object.assign(firebaseState, { db: {}, auth: null, serverTimeOffsetMs: 0, serverClockTrusted: false,
        isDatabaseConnected: false, hasEverConnectedToDatabase: false, infoListenersFailed: false,
        infoListenerRecoveryTimer: null, reconnectWatchdogTimer: null,
        dbRefConnected: 'connected', dbRefServerTimeOffset: 'offset',
        fb: { __supabase: true, off: (ref: string) => callbacks.delete(ref), onValue: (ref: string, cb: (value: any) => void) => {
            callbacks.set(ref, cb);
            cb({ val: () => ref === 'connected' ? true : currentOffset, serverClockSample: ref === 'offset' ? currentSample : undefined });
        } } });
    expect(attachInfoListeners()).toBe(true);
    expect(cleanupClockIsTrustworthy()).toBe(true);
    expect(getServerNow()).toBe(START);
});

afterEach(() => { detachInfoListeners(); vi.clearAllTimers(); vi.useRealTimers(); });

function emitOffset(value: unknown) {
    currentOffset = value;
    if (typeof value === 'number' && Number.isFinite(value)) currentSample = sampleAt(value);
    callbacks.get('offset')!({ val: () => value, serverClockSample: currentSample });
}

it.each([-365 * DAY, 365 * DAY])('Clock ក្រោយ sample មិនលោតតាមម៉ោងឧបករណ៍ %s', jump => {
    elapsed += 1500;
    vi.setSystemTime(START + jump + 1500);
    expect(getServerNow()).toBe(START + 1500);
    expect(cleanupClockIsTrustworthy()).toBe(false);
});

it('sample cache មិនប្តូរ anchor ពេលភ្ជាប់ listener ឡើងវិញ', () => {
    elapsed += 1500;
    vi.setSystemTime(START + DAY + 1500);
    expect(attachInfoListeners()).toBe(true);
    expect(getServerNow()).toBe(START + 1500);
});

it('sample ថ្មីកែម៉ោងក្រោយផ្អាក monotonic', () => {
    vi.setSystemTime(START + DAY);
    emitOffset(1);
    expect(getServerNow()).toBe(START + DAY + 1);
});

it.each([NaN, Infinity, -Infinity, '1', null, undefined, {}, []])('offset មិនត្រឹមត្រូវ %s មិនបំពុល anchor', value => {
    elapsed += 500;
    emitOffset(value);
    expect(getServerNow()).toBe(START + 500);
    expect(firebaseState.serverTimeOffsetMs).toBe(0);
});

it('monotonic ថយក្រោយមិនប្រើ wall clock ជំនួស', () => {
    vi.setSystemTime(START + 365 * DAY);
    elapsed = 1;
    expect(getServerNow()).toBe(START);
    expect(cleanupClockIsTrustworthy()).toBe(false);
});

it('monotonic មិនត្រឹមត្រូវមិនប្រើ wall clock ជំនួស', () => {
    vi.setSystemTime(START + 365 * DAY);
    elapsed = NaN;
    expect(getServerNow()).toBe(START);
    expect(cleanupClockIsTrustworthy()).toBe(false);
});

it('ផ្អាក monotonic មិនធ្វើឱ្យអាយុរីកដោយ wall clock', () => {
    vi.setSystemTime(START + 365 * DAY);
    expect(getServerNow()).toBe(START);
});

it('backend ថ្មីមិនយក anchor ចាស់', () => {
    firebaseState.db = {};
    firebaseState.serverClockTrusted = false;
    firebaseState.serverTimeOffsetMs = 0;
    vi.setSystemTime(START + DAY);
    currentOffset = -DAY;
    currentSample = sampleAt(-DAY);
    expect(attachInfoListeners()).toBe(true);
    expect(getServerNow()).toBe(START);
});

it('ច្រកសម្អាតរកឃើញភាពមិនប្រាកដ មុនអាន now', () => {
    vi.setSystemTime(START + DAY);
    expect(cleanupClockIsTrustworthy()).toBe(false);
    expect(firebaseState.serverClockTrusted).toBe(false);
    expect(attachInfoListeners()).toBe(true);
    expect(cleanupClockIsTrustworthy()).toBe(false);
});

it('ការផ្អាក iOS មិនបង្កកការសម្អាត ក្រោយ sample ស្រស់ offset ដដែល', async () => {
    vi.setSystemTime(START + DAY);
    const offline = vi.fn(() => callbacks.get('connected')!({ val: () => false }));
    const online = vi.fn(() => { emitOffset(0); callbacks.get('connected')!({ val: () => true }); });
    firebaseState.fb.goOffline = offline;
    firebaseState.fb.goOnline = online;
    firebaseState.lastForcedReconnectAt = 0;
    expect(cleanupClockIsTrustworthy()).toBe(false);
    for (let n = 0; n < 5; n++) await Promise.resolve();
    expect(offline).toHaveBeenCalledTimes(1);
    expect(online).toHaveBeenCalledTimes(1);
    expect(cleanupClockIsTrustworthy()).toBe(true);
    expect(getServerNow()).toBe(START + DAY);
});

it('ទិដ្ឋភាពជិតត្រឡប់ និងសុខភាពនាឡិកា បដិសេធភាពមិនប្រាកដនៅការហៅដំបូង', async () => {
    const { dataState, uiState } = await import('../../../../ZoeW/src/core/state');
    const { dbListenerFailedPaths, dbListenerPendingPaths } = await import('../../../../ZoeW/src/core/text');
    const { refreshNotifyView } = await import('../../../../ZoeW/src/features/notifications');
    const { healthClockRow } = await import('../../../../ZoeW/src/features/health-check');
    firebaseState.isDatabaseInitialized = true;
    dbListenerFailedPaths.clear(); dbListenerPendingPaths.clear();
    dataState.scanHistory = [{ id: 'fresh', createdAt: START, barcodes: [{ code: 'FRESH', isClosed: false }] }] as any;
    vi.setSystemTime(START + DAY);
    refreshNotifyView();
    expect(uiState.notifyView!.measurable).toBe(false);
    expect(healthClockRow().state).toBe('warn');
});


it('lease ចាស់មិនរស់ឡើងវិញក្រោយ sample ថ្មី', () => {
    const operation = captureClockOperation();
    expect(operation.current()).toBe(true);
    vi.setSystemTime(START + DAY);
    expect(operation.current()).toBe(false);
    emitOffset(-DAY);
    expect(cleanupClockIsTrustworthy()).toBe(true);
    expect(operation.current()).toBe(false);
    expect(captureClockOperation().current()).toBe(true);
});

it('sample ធម្មតាមិនកាត់ lease ដែលនៅត្រឹមត្រូវ', () => {
    const operation = captureClockOperation();
    elapsed += 1000; vi.setSystemTime(START + 1000);
    emitOffset(1);
    expect(operation.current()).toBe(true);
});

it('clock មានទំនុកចិត្តនៅក្រៅបណ្តាញ តែ cleanup នៅបិទ', () => {
    const operation = captureClockOperation();
    callbacks.get('connected')!({ val: () => false });
    elapsed += 5 * 3600000; vi.setSystemTime(START + 5 * 3600000);
    expect(operation.current()).toBe(true);
    expect(getServerNow()).toBe(START + 5 * 3600000);
    expect(cleanupClockIsTrustworthy()).toBe(false);
});

it('ការស្នើ sync មានពិដាន ហើយអាចសាកម្តងទៀតបន្ទាប់ពីបរាជ័យ', async () => {
    const online = vi.fn();
    firebaseState.fb.goOnline = online;
    firebaseState.fb.goOffline = vi.fn();
    firebaseState.lastForcedReconnectAt = 0;
    vi.setSystemTime(START + DAY);
    for (let n = 0; n < 20; n++) cleanupClockIsTrustworthy();
    for (let n = 0; n < 5; n++) await Promise.resolve();
    expect(online).toHaveBeenCalledTimes(1);
    elapsed += SERVER_CLOCK_REFRESH_GAP_MS;
    vi.setSystemTime(START + DAY + SERVER_CLOCK_REFRESH_GAP_MS);
    cleanupClockIsTrustworthy();
    for (let n = 0; n < 5; n++) await Promise.resolve();
    expect(online).toHaveBeenCalledTimes(2);
    expect(cleanupClockIsTrustworthy()).toBe(false);
});

it.each([undefined, null, NaN, {}, []])('sample មិនត្រឹមត្រូវ %s មិនបើក trust', sample => {
    vi.setSystemTime(START + DAY);
    expect(cleanupClockIsTrustworthy()).toBe(false);
    if (sample === undefined || sample === null) return;
    expect(() => acceptServerClockOffset(0, sample, false)).not.toThrow();
    expect(cleanupClockIsTrustworthy()).toBe(false);
});


it('sample ស្រស់មកមុនការអាន trust មិនសង្គ្រោះ lease ដែលឆ្លងម៉ោងលោត', () => {
    const operation = captureClockOperation();
    expect(operation.current()).toBe(true);
    vi.setSystemTime(START + DAY);
    emitOffset(-DAY);
    expect(cleanupClockIsTrustworthy()).toBe(true);
    expect(operation.current()).toBe(false);
    expect(captureClockOperation().current()).toBe(true);
});


it('Firebase SDK ពិតផ្តល់ timestamp មុន connected ប៉ុន្តែមិនបើក trust', async () => {
    firebaseState.fb.__supabase = false;
    attachInfoListeners();
    const require = createRequire(import.meta.url);
    const source = readFileSync(require.resolve('@firebase/database'), 'utf8');
    const tree: any = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
    const declaration = tree.body.find((node: any) => node.type === 'ClassDeclaration' && node.id.name === 'PersistentConnection');
    expect(declaration).toBeDefined();
    const method = (name: string) => {
        const node = declaration.body.body.find((value: any) => value.key.name === name).value;
        return new Function('return function' + source.slice(node.start, node.end))();
    };
    const events: string[] = [];
    const native: any = { log_: () => {}, firstConnection_: false, restoreState_: () => {},
        handleTimestamp_: method('handleTimestamp_'),
        onServerInfoUpdate_: (value: any) => {
            events.push('offset');
            if (value.serverTimeOffset !== currentOffset) emitOffset(value.serverTimeOffset);
        },
        onConnectStatus_: (value: boolean) => { events.push('connected'); callbacks.get('connected')!({ val: () => value }); } };
    vi.setSystemTime(START + DAY);
    firebaseState.fb.goOffline = vi.fn(() => callbacks.get('connected')!({ val: () => false }));
    firebaseState.fb.goOnline = vi.fn(() => method('onReady_').call(native, START + DAY, 'fixture'));
    firebaseState.lastForcedReconnectAt = 0;
    expect(cleanupClockIsTrustworthy()).toBe(false);
    callbacks.get('connected')!({ val: () => false });
    method('onReady_').call(native, START + DAY, 'fixture');
    for (let n = 0; n < 5; n++) await Promise.resolve();
    expect(events).toEqual(['offset', 'connected']);
    expect(cleanupClockIsTrustworthy()).toBe(false);
    expect(getServerNow()).toBe(START);
});

it('Server កែ epoch ខ្លាំង មិនអនុញ្ញាតឱ្យ lease ពីមូលដ្ឋានចាស់បន្ត', () => {
    const operation = captureClockOperation();
    expect(operation.current()).toBe(true);
    emitOffset(-DAY);
    expect(cleanupClockIsTrustworthy()).toBe(true);
    expect(getServerNow()).toBe(START - DAY);
    expect(operation.current()).toBe(false);
});
