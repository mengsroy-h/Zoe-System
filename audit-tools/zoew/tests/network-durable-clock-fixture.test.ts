import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { parse } from 'acorn';
import { webcrypto } from 'node:crypto';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { attachInfoListeners, detachInfoListeners } from '../../../ZoeW/src/services/connection';
import { firebaseState } from '../../../ZoeW/src/core/state';
import { captureClockOperation, getServerClockBounds, getServerNow, resetServerClock } from '../../../ZoeW/src/core/clock';
import { createNativeWriteRecovery, nativeWriteRecoveryState } from '../../../ZoeW/src/services/native-write-recovery';

const lab = vi.hoisted(() => ({ rows: [] as any[] }));
vi.mock('../../../ZoeW/src/services/write-journal', () => ({ createLocalWriteJournal: () => ({ available: () => true,
    list: () => lab.rows, put: (row: any) => { lab.rows = [structuredClone(row)]; return true; },
    remove: (_scope: string, _topic: string, id: string) => { lab.rows = lab.rows.filter(row => row.opId !== id); } }) }));
vi.mock('../../../ZoeW/src/services/tx-outcome', () => ({ txRestUrl: String, txReadServerValue: async () => null,
    txReadWasRefused: () => false, txSameValue: (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b) }));
const root = path.resolve(process.env.NETWORK_FIXTURE_ROOT || '..');
const filename = path.join(root, 'audit-tools/emu/app-network-e2e-test.js');
const source = readFileSync(filename, 'utf8');
const require = createRequire(filename);
const license = /body: (`window\.ZoeLicense = \{[\s\S]*?\};`(?: \+ require\('[^']+'\)\.CLOCK_FIXTURE)?)/.exec(source)![1];
const START = Date.UTC(2026, 10, 9, 2, 32), SKEW = 6 * 60000;
let wall: number, mono: number, alive: boolean;
const turn = async () => { for (let i = 0; i < 100; i++) await Promise.resolve(); };
function skewSetup() {
    const tree: any = parse(source, { ecmaVersion: 'latest', sourceType: 'script' });
    let setup: any;
    const walk = (node: any) => {
        if (!node || typeof node !== 'object') return;
        if (node.type === 'CallExpression' && node.callee.property?.name === 'addInitScript'
            && node.arguments[0]?.type === 'ArrowFunctionExpression'
            && source.slice(node.arguments[0].start, node.arguments[0].end).includes('__bootSkew')) setup = node.arguments[0];
        for (const key of Object.keys(node)) if (key !== 'parent') {
            const value = node[key]; if (Array.isArray(value)) value.forEach(walk); else if (value && typeof value === 'object') walk(value);
        }
    };
    walk(tree);
    const statements = setup.body.body;
    const start = statements.findIndex((node: any) => node.type === 'VariableDeclaration' && node.declarations[0].id.name === 'realNow');
    expect(start).toBeGreaterThan(-1);
    new Function(source.slice(statements[start].start, statements.at(-1).end))();
}
async function bootClock() {
    resetServerClock();
    // កូដ route ខាងលើត្រឡប់ script ដូច browser។
    const script = new Function('require', 'return ' + license)(require);
    new Function(script)();
    attachInfoListeners(); await turn();
}
beforeEach(() => {
    wall = START; mono = 1000; alive = true; lab.rows = []; localStorage.clear(); sessionStorage.clear();
    vi.spyOn(Date, 'now').mockImplementation(() => wall);
    vi.spyOn(performance, 'now').mockImplementation(() => mono);
    vi.stubGlobal('crypto', webcrypto);
    Object.assign(firebaseState, { db: {}, auth: null, isDatabaseConnected: false, hasEverConnectedToDatabase: false,
        infoListenersFailed: false, infoListenerRecoveryTimer: null, reconnectWatchdogTimer: null,
        sessionExpiryCheck: 'live', sessionExpiryCheckInFlight: false, dbRefConnected: 'connected', dbRefServerTimeOffset: 'offset',
        fb: { off() {}, onValue(ref: string, cb: any) { cb({ val: () => ref === 'connected' ? true : 0 }); },
            goOnline: vi.fn(), goOffline: vi.fn(), signOut: vi.fn(async () => {}) } });
});
afterEach(() => {
    alive = false; detachInfoListeners(); resetServerClock(); delete window.ZoeLicense;
    delete (window as any).__zoeFixtureServerNow; delete (window as any).__zoeSkew;
    vi.restoreAllMocks(); vi.unstubAllGlobals();
});
it.each([0, 3])('fixture បណ្តាញរក្សាពេល server ក្រោយ skew %s ដង និង reload៖ intent អនុវត្តតែម្តង', async cycles => {
    skewSetup(); await bootClock();
    for (let i = 0; i < cycles; i++) {
        (window as any).__zoeSkew(120000);
        await window.ZoeLicense!.syncServerTime(); detachInfoListeners(); attachInfoListeners(); await turn();
    }
    expect(Date.now()).toBe(START + cycles * SKEW / 3);
    expect.soft(getServerNow()).toBe(START);
    const oldDatabase = firebaseState.db;
    const offline = vi.fn(() => new Promise<void>(() => {}));
    const sdk = { ref: (_db: any, p = '') => 'https://example.test/' + p, get: async () => ({ val: () => null }), update: offline };
    const recovery = createNativeWriteRecovery(sdk, { currentUser: { uid: 'u' } }, oldDatabase,
        () => alive && oldDatabase === firebaseState.db, () => {}, () => ({ watch: () => () => {} }));
    await vi.waitFor(() => expect(nativeWriteRecoveryState(oldDatabase).recovering).toBe(false));
    void recovery.mutate('set', 'https://example.test/zoew_settings/exchange_rate', { '.sv': { increment: 5 } });
    await vi.waitFor(() => expect(lab.rows).toHaveLength(1));
    const queuedAt = lab.rows[0].queuedAt;
    expect.soft(queuedAt).toBe(START);
    detachInfoListeners(); firebaseState.db = {} as any;
    Date.now = () => wall; wall += 1000; mono += 1000;
    skewSetup(); await bootClock();
    const replay = vi.fn(async () => {});
    createNativeWriteRecovery({ ...sdk, update: replay }, { currentUser: { uid: 'u' } }, firebaseState.db,
        () => alive, () => {}, () => ({ watch: () => () => {} }));
    await vi.waitFor(() => expect(nativeWriteRecoveryState(firebaseState.db).recovering).toBe(false));
    console.log(JSON.stringify({ queuedAt, reloadBounds: getServerClockBounds(), recovery: nativeWriteRecoveryState(firebaseState.db), replayCount: replay.mock.calls.length }));
    expect.soft(nativeWriteRecoveryState(firebaseState.db)).toMatchObject({ blocked: 0, deferred: false });
    expect.soft(replay).toHaveBeenCalledTimes(1);
    expect.soft(lab.rows).toHaveLength(0);
});

it('clock fixture ដែលមិនទាន់ sync ស្រស់ មិនផ្តល់អាយុ replay ហើយ reanchor មិនសង្គ្រោះ lease ចាស់', async () => {
    skewSetup(); await bootClock(); const lease = captureClockOperation();
    (window as any).__zoeSkew(120000);
    (window as any).__zoeFixtureServerNow = () => NaN;
    expect(await window.ZoeLicense!.syncServerTime()).toBe(false);
    expect(lease.current()).toBe(false);
    detachInfoListeners(); attachInfoListeners(); await turn();
    expect(getServerClockBounds()).toBeNull();
    const oldDatabase = firebaseState.db;
    const sdk = { ref: (_db: any, p = '') => 'https://example.test/' + p, get: async () => ({ val: () => null }), update: vi.fn(() => new Promise<void>(() => {})) };
    const api = createNativeWriteRecovery(sdk, { currentUser: { uid: 'u' } }, oldDatabase,
        () => alive && oldDatabase === firebaseState.db, () => {}, () => ({ watch: () => () => {} }));
    await vi.waitFor(() => expect(nativeWriteRecoveryState(oldDatabase).recovering).toBe(false));
    void api.mutate('set', 'https://example.test/zoew_settings/exchange_rate', { '.sv': { increment: 5 } });
    await vi.waitFor(() => expect(lab.rows).toHaveLength(1));
    expect(lab.rows[0].queuedAt).toBe(0);
    detachInfoListeners(); firebaseState.db = {} as any; Date.now = () => wall;
    skewSetup(); await bootClock(); expect(lease.current()).toBe(false);
    const replay = vi.fn(async () => {});
    createNativeWriteRecovery({ ...sdk, update: replay }, { currentUser: { uid: 'u' } }, firebaseState.db,
        () => alive, () => {}, () => ({ watch: () => () => {} }));
    await vi.waitFor(() => expect(nativeWriteRecoveryState(firebaseState.db).recovering).toBe(false));
    expect(nativeWriteRecoveryState(firebaseState.db)).toMatchObject({ blocked: 1, deferred: false });
    expect(replay).not.toHaveBeenCalled(); expect(lab.rows).toHaveLength(1);
});
