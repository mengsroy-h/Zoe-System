import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { parse } from 'acorn';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { attachInfoListeners, detachInfoListeners } from '../src/services/connection';
import { firebaseState } from '../src/core/state';
import { captureClockOperation, getServerNow, resetServerClock, serverClockIsTrustworthy } from '../src/core/clock';
import { sessionUserActionAllowed } from '../src/core/session-verification';

// កំណត់ផ្លូវនេះទៅ snapshot ដើម ដើម្បីវាស់ថា checker ចាប់ fixture ចាស់បានពិត។
const root = path.resolve(process.env.BROWSER_FIXTURE_ROOT || '..');
const files = [
    'ui-flow-test.js', 'gesture-test.js', 'duplicate-money-test.js', 'revenue-fuzz-test.js',
    'ledger-clamp-symmetry-test.js', 'inline-handler-xss-test.js', 'duplicate-scan-test.js',
    'layout-thrash.js', 'perf-check.js', 'csp-enforced-test.js', 'app-lock-test.js',
    'panel-motion-test.js', 'ios-panel-glide-test.js', 'page-nav-test.js',
    'history-menu-dismiss-test.js', 'collected-mirror-lifecycle-test.js', 'toast-action-truth-test.js',
    'sheet-import-test.js', 'scan-remove-mode-test.js', 'field-shape-test.js', 'slow-write-test.js',
    'money-multidevice-core.js', 'item-money-integrity-test.js', 'stats-collected-truth-test.js'
].map(file => 'audit-tools/' + file).concat('ZoeW/scripts/fake-firebase.mjs', 'audit-tools/emu/app-network-e2e-test.js');
const START = Date.UTC(2026, 10, 8);
let mono: number;
const turn = async () => { for (let i = 0; i < 80; i++) await Promise.resolve(); };
function fixture(file = files[0]) {
    const filename = path.join(root, file);
    const source = readFileSync(filename, 'utf8');
    const tree: any = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
    const declaration = tree.body.flatMap((node: any) => (node.declaration || node).declarations || [])
        .find((node: any) => node.id.name === 'LICENSE_STUB');
    const inline = file.endsWith('emu/app-network-e2e-test.js')
        ? /body: (`window\.ZoeLicense = \{[\s\S]*?\};`(?: \+ require\('[^']+'\)\.CLOCK_FIXTURE)?)/.exec(source)?.[1] : null;
    expect(declaration || inline, file).toBeDefined();
    const FUZZ = readFileSync(path.join(root, 'audit-tools/revenue-fuzz-test.js'), 'utf8');
    const localRequire = createRequire(filename);
    // snapshot ដើមមិនត្រូវការ helper ថ្មីក្នុង initializer ទេ។
    const helper = /browserClockFixture/.test(source) ? localRequire('../../audit-tools/browser-clock-fixture.cjs') : null;
    const script = new Function('require', 'FUZZ', 'LIC_A', 'browserClockFixture',
        'return ' + (inline || source.slice(declaration.init.start, declaration.init.end)))(
        localRequire, FUZZ, FUZZ.indexOf('const LICENSE_STUB = `'), helper);
    new Function(script)();
    return window.ZoeLicense as any;
}
beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    vi.setSystemTime(START); mono = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => mono);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    resetServerClock();
    Object.assign(firebaseState, { db: {}, auth: null, isDatabaseConnected: false, hasEverConnectedToDatabase: false,
        infoListenersFailed: false, infoListenerRecoveryTimer: null, reconnectWatchdogTimer: null,
        sessionExpiryCheck: 'live', sessionExpiryCheckInFlight: false,
        dbRefConnected: 'connected', dbRefServerTimeOffset: 'offset',
        fb: { off() {}, onValue(ref: string, cb: any) { cb({ val: () => ref === 'connected' ? true : 0 }); },
            goOnline: vi.fn(), goOffline: vi.fn(), signOut: vi.fn(async () => {}) } });
});
afterEach(() => {
    detachInfoListeners(); resetServerClock(); delete window.ZoeLicense;
    vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks();
});
it.each(files)('%s៖ fixture ពិតផ្តល់ sample ក្រោយ sync ប៉ុណ្ណោះ ហើយ bridge ពិតទទួលយក', async file => {
    const api = fixture(file);
    expect(api.getServerTimeSample()).toBeNull();
    expect(api.getServerTimeGeneration()).toBe(0);
    expect(await api.getStatus()).toEqual({ state: 'active' });
    expect(await api.syncServerTime()).toBe(true);
    const sample = api.getServerTimeSample();
    expect(Object.isFrozen(sample)).toBe(true);
    expect(sample).toMatchObject({ epochMs: START, wallMs: START, monotonicMs: mono,
        generation: 0, observation: 1, uncertaintyMs: 0, source: 'nonce' });
    expect(api.getServerTimeSample()).toBe(sample);
    expect(attachInfoListeners()).toBe(true); await turn();
    expect(serverClockIsTrustworthy()).toBe(true);
    expect(getServerNow()).toBe(START);
    firebaseState.auth = { currentUser: { uid: 'fixture' } } as any;
    firebaseState.sessionExpiryCheck = 'live';
    expect(sessionUserActionAllowed('triggerScanAction')).toBe(true);
    firebaseState.sessionExpiryCheck = 'unverified';
    expect(sessionUserActionAllowed('triggerScanAction')).toBe(false);
});
it.each(['missing', 'mutable', 'source', 'generation', 'observation', 'uncertainty', 'coordinates', 'failed-sync'])('bridge ពិតបដិសេធ sample ខូច៖ %s', async defect => {
    const api = fixture();
    expect(await api.syncServerTime()).toBe(true);
    const sample = api.getServerTimeSample();
    const changes: Record<string, any> = { source: { source: 'offset' }, generation: { generation: 99 },
        observation: { observation: 0 }, uncertainty: { uncertaintyMs: -1 }, coordinates: { monotonicMs: -1 } };
    const bad = defect === 'missing' || defect === 'failed-sync' ? null
        : defect === 'mutable' ? { ...sample } : Object.freeze({ ...sample, ...changes[defect] });
    api.getServerTimeSample = () => bad;
    if (defect === 'failed-sync') api.syncServerTime = async () => false;
    expect(attachInfoListeners()).toBe(true); await turn();
    expect(serverClockIsTrustworthy()).toBe(false);
    firebaseState.auth = { currentUser: { uid: 'fixture' } } as any;
    firebaseState.sessionExpiryCheck = 'live';
    expect(sessionUserActionAllowed('triggerScanAction')).toBe(false);
});
it.each(['wall-forward', 'wall-backward', 'mono-backward', 'expired'])('%s៖ trust ត្រូវដក ហើយ getter មិនបង្កើត sample ជំនួស', async jump => {
    const api = fixture(); await api.syncServerTime(); attachInfoListeners(); await turn();
    const operation = captureClockOperation();
    const generation = api.getServerTimeGeneration();
    api.syncServerTime = async () => false; // ប្រភពពេលវេលាដែលដាច់មិនអាចជួសជុលនាឡិកាខូចបាន។
    if (jump === 'wall-forward') vi.setSystemTime(START + 3000);
    if (jump === 'wall-backward') vi.setSystemTime(START - 1);
    if (jump === 'mono-backward') mono--;
    if (jump === 'expired') { mono += 4 * 86400000; vi.setSystemTime(START + 4 * 86400000); }
    expect(api.getServerTimeSample()).toBeNull();
    expect(api.getServerTimeGeneration()).toBe(generation + 1);
    expect(api.getServerTimeSample()).toBeNull();
    if (jump !== 'expired') expect(operation.current()).toBe(false);
    // bridge ពិតត្រូវបដិសេធ sample ដែលបាត់ ក្រោយភ្ជាប់ listener ថ្មីដែរ។
    detachInfoListeners(); resetServerClock(); attachInfoListeners(); await turn();
    expect(serverClockIsTrustworthy()).toBe(false);
});
it('នាឡិកាទាំងពីរដើរស្មើ៖ sample នៅដដែល ហើយ sync ថ្មីប្ដូរតែ observation', async () => {
    const api = fixture(); await api.syncServerTime(); attachInfoListeners(); await turn();
    const sample = api.getServerTimeSample(); const operation = captureClockOperation();
    mono += 10000; vi.setSystemTime(START + 10000);
    expect(api.getServerTimeSample()).toBe(sample);
    expect(getServerNow()).toBe(START + 10000);
    expect(operation.current()).toBe(true);
    await api.syncServerTime();
    expect(api.getServerTimeSample()).not.toBe(sample);
    expect(api.getServerTimeSample().generation).toBe(sample.generation);
    expect(api.getServerTimeSample().observation).toBeGreaterThan(sample.observation);
    firebaseState.db = {} as any;
    expect(operation.current()).toBe(false);
});
it('sync ក្រោយនាឡិកាលោត មិនធ្វើឱ្យប្រតិបត្តិការចាស់មានសុពលភាពឡើងវិញ', async () => {
    const api = fixture(); await api.syncServerTime(); attachInfoListeners(); await turn();
    const operation = captureClockOperation();
    vi.setSystemTime(START + 3000);
    expect(api.getServerTimeSample()).toBeNull();
    expect(operation.current()).toBe(false);
    expect(await api.syncServerTime()).toBe(true);
    detachInfoListeners(); attachInfoListeners(); await turn();
    expect(serverClockIsTrustworthy()).toBe(true);
    expect(operation.current()).toBe(false);
});

it.each(['wall', 'mono'])('នាឡិកា %s មិនមែនលេខ finite៖ sync ក៏មិនអាចបង្កើត sample បាន', async invalid => {
    const api = fixture();
    if (invalid === 'wall') vi.spyOn(Date, 'now').mockReturnValue(NaN);
    else mono = NaN;
    expect(await api.syncServerTime()).toBe(false);
    expect(api.getServerTimeSample()).toBeNull();
    expect(attachInfoListeners()).toBe(true); await turn();
    expect(serverClockIsTrustworthy()).toBe(false);
});

it.each(['database', 'sdk', 'listener'])('sync មកយឺតក្រោយប្ដូរ %s៖ bridge មិនទទួល sample ចាស់', async target => {
    const api = fixture(); const originalSync = api.syncServerTime;
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    api.syncServerTime = () => gate.then(originalSync);
    expect(attachInfoListeners()).toBe(true); await turn();
    expect(serverClockIsTrustworthy()).toBe(false);
    if (target === 'database') firebaseState.db = {} as any;
    if (target === 'sdk') firebaseState.fb = { ...firebaseState.fb } as any;
    if (target === 'listener') detachInfoListeners();
    release(); await turn();
    expect(api.getServerTimeSample()).not.toBeNull();
    expect(serverClockIsTrustworthy()).toBe(false);
});
it('sync ចាស់មកក្រោយប្ដូរអ្នកប្រើ៖ នាឡិកាមិនអាចផ្ដល់សិទ្ធិឱ្យវគ្គមិនទាន់ផ្ទៀងផ្ទាត់', async () => {
    const api = fixture(); const originalSync = api.syncServerTime;
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    api.syncServerTime = () => gate.then(originalSync);
    firebaseState.auth = { currentUser: { uid: 'old-user' } } as any;
    firebaseState.sessionExpiryCheck = 'pending';
    attachInfoListeners(); await turn();
    firebaseState.auth = { currentUser: { uid: 'new-user' } } as any;
    release(); await turn();
    expect(serverClockIsTrustworthy()).toBe(true);
    expect(firebaseState.sessionExpiryCheck).toBe('pending');
    expect(sessionUserActionAllowed('triggerScanAction')).toBe(false);
});
