import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { firebaseState, securityState, uiState } from '../../../ZoeW/src/core/state';
import { viewState } from '../../../ZoeW/src/core/view-state';
import { liveShopScope } from '../../../ZoeW/src/core/shop-scope';
import { barcodeRegistryKey } from '../../../ZoeW/src/domain/registry';
import { ACTION_REGISTRY } from '../../../ZoeW/src/core/action-registry';
import { createScanEvidenceJournal, SCAN_EVIDENCE_MAX_PENDING } from '../../../ZoeW/src/services/scan-evidence';
import { pendingScanScope, preparePendingScan, scanEvidenceRefusalText, warnPendingScans } from '../../../ZoeW/src/services/scan-pending';
import { addOrUpdateEntry } from '../../../ZoeW/src/features/scan-action';
import { drawerResolveScanEvidenceFlow, resolveScanEvidence } from '../../../ZoeW/src/features/pending-writes';
import { withTransactionOutcomeResolution } from '../../../ZoeW/src/services/tx-outcome';
import { SideDrawer } from '../../../ZoeW/src/app/components/SideDrawer';
import '../../../ZoeW/src/app/flush';
import { mount, step, unmount } from './native/react-harness';

const HOST = 'https://scan-exit.firebaseio.com', NOW = Date.UTC(2026, 10, 3, 2), DAY = '2026-11-03';
const copy = <T,>(value: T): T => value === undefined ? value : JSON.parse(JSON.stringify(value));
let tree: Record<string, any> = {};
let held = new Set<string>();
const get = (path: string) => copy(path.split('/').filter(Boolean).reduce((node, key) => node?.[key], tree) ?? null);
const journal = (version: 1 | 2 = 2) => createScanEvidenceJournal(localStorage, version);
const payload = (barcode: string) => ({ barcode, createdAt: NOW, cod: 5, dod: 0, scanDate: DAY, mode: 'direct' });
const receiptOf = (record: any, phase: string) => ({ v: 2, id: record.id, actorUid: 'exit-owner', scope: liveShopScope(), code: record.barcode,
    registryKey: barcodeRegistryKey(record.barcode), birth: record.createdAt, scanDate: DAY, month: DAY.slice(0, 7), cod: 5, dod: 0, count: 1,
    monthToken: 'op_m' + record.id.slice(5), phase });

function connect() {
    const app = { options: { databaseURL: HOST } }, db = { app };
    const auth = { app, currentUser: { uid: 'exit-owner', getIdToken: async () => 'token' } };
    const reference = (path = '') => ({ path, key: path.split('/').at(-1) || null, toString: () => HOST + '/' + path });
    const snapshot = (ref: any) => { const value = get(ref.path); return { ref, key: ref.key, exists: () => value !== null, val: () => copy(value) }; };
    const write = vi.fn(async () => {});
    const raw = { getAuth: () => auth, getDatabase: () => db, deleteApp: async () => {}, ref: (_db: any, path = '') => reference(path),
        get: async (ref: any) => snapshot(ref), set: write, update: write, runTransaction: vi.fn(async (ref: any) => ({ committed: false, snapshot: snapshot(ref) })),
        onValue: () => () => {}, off: () => {} };
    const sdk = withTransactionOutcomeResolution(raw); sdk.getAuth(app); sdk.getDatabase(app);
    Object.assign(firebaseState, { firebaseConfig: app.options, fb: sdk, auth, db, isDatabaseInitialized: true, isInitializingFirebase: false,
        firebaseSdkUnavailable: false, isDatabaseConnected: true, serverClockTrusted: true, sessionExpiryCheck: 'live', authLoginOperation: null });
    firebaseState.authGeneration++;
    return { write, raw };
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(NOW);
    vi.stubGlobal('crypto', webcrypto);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    localStorage.clear(); localStorage.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: HOST }));
    tree = {}; held = new Set(); uiState.toasts = []; viewState.scanEvidenceRetained = 0;
    vi.stubGlobal('fetch', vi.fn(async (url: any) => {
        const path = decodeURIComponent(new URL(String(url)).pathname).replace(/^\//, '').replace(/\.json$/, '');
        return Response.json(get(path));
    }));
    Object.defineProperty(navigator, 'locks', { configurable: true, value: { request: async (name: string, options: any, callback?: any) => {
        if (typeof options === 'function') { callback = options; options = {}; }
        return callback(held.has(name) && options.ifAvailable ? null : { name });
    } } });
    (window as any).ZoeErrors = { capture: vi.fn() };
});
afterEach(() => {
    vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers();
    delete (navigator as any).locks; delete (window as any).ZoeErrors;
    firebaseState.authGeneration++;
});

function seed() {
    const scope = pendingScanScope();
    const proven = journal().prepare(scope, payload('EXITPROVEN01')); journal().appendPhase(proven, { phase: 'claim-pending' });
    const lost = journal().prepare(scope, payload('EXITLOST0001')); journal().appendPhase(lost, { phase: 'claim-pending' }); journal().appendPhase(lost, { phase: 'save-pending', itemId: 'row1' });
    const legacy = journal(1).prepare(scope, payload('EXITLEGACY01')); journal(1).appendPhase(legacy, { phase: 'pending' });
    const otherTab = journal().prepare(scope, payload('EXITOTHERTAB')); journal().appendPhase(otherTab, { phase: 'claim-pending' });
    const foreign = journal().prepare(JSON.stringify(['https://other-shop.firebaseio.com', 'other-user']), payload('EXITFOREIGN1'));
    tree.zoew_scan_operations = { [proven.id]: receiptOf(proven, 'cancelled') };
    held.add('zoew-scan-live:' + otherTab.id);
    return { scope, proven, lost, legacy, otherTab, foreign };
}

it('the owner exit re-reads the server, finishes proven scans, drops the unprovable rest with Sentry money and keeps another tab’s live scan', async () => {
    const { write } = connect();
    const { scope, lost, legacy, otherTab, foreign } = seed();
    vi.stubGlobal('confirm', () => true);
    const serverBefore = copy(tree);
    expect(await resolveScanEvidence()).toBe(true);
    const left = [...journal().list(scope), ...journal(1).list(scope)].map(row => row.id);
    expect(left).toEqual([otherTab.id]);
    expect(journal().list(foreign.scope).map(row => row.id), 'ហាង/គណនីផ្សេងមិនត្រូវប៉ះ').toEqual([foreign.id]);
    expect(tree, 'ការបញ្ចប់មិនសរសេរប្រាក់ ឬកញ្ចប់លើ Server').toEqual(serverBefore);
    expect(write).not.toHaveBeenCalled();
    const capture = (window as any).ZoeErrors.capture;
    const dropped = capture.mock.calls.filter((call: any[]) => call[1]?.context === 'resolveRetainedScanEvidence');
    expect(dropped).toHaveLength(1);
    expect(dropped[0][1]).toMatchObject({ zone: 'money', count: 2, kept: 1 });
    expect(dropped[0][1].codes.split(' · ').sort()).toEqual(['EXITLEGACY01', 'EXITLOST0001']);
    expect(dropped[0][1].phases).toContain('/none');
    expect(viewState.scanEvidenceRetained).toBe(1);
    expect(uiState.toasts.some((toast: any) => toast.msg.includes('✅ បានបញ្ចប់ 1') && toast.msg.includes('លុបភស្តុតាងដែលផ្ទៀងមិនបាន 2'))).toBe(true);
    expect([lost.id, legacy.id].every(id => !Object.keys(localStorage).some(key => key.includes(id)))).toBe(true);
});

it('offline or a cancelled confirm drops nothing', async () => {
    connect();
    const { scope } = seed();
    const count = () => [...journal().list(scope), ...journal(1).list(scope)].length;
    vi.stubGlobal('confirm', () => false);
    expect(await resolveScanEvidence()).toBe(false);
    expect(count()).toBe(4);
    firebaseState.isDatabaseConnected = false;
    vi.stubGlobal('confirm', () => true);
    expect(await resolveScanEvidence()).toBe(false);
    expect(count()).toBe(4);
    expect(uiState.toasts.some((toast: any) => toast.msg.includes('ត្រូវភ្ជាប់ Server មុន'))).toBe(true);
    expect((window as any).ZoeErrors.capture.mock.calls.filter((call: any[]) => call[1]?.context === 'resolveRetainedScanEvidence')).toEqual([]);
});

it('the drawer offers the exit only while this shop/account holds unfinished scan evidence, behind its own PIN prompt', () => {
    connect();
    uiState.drawerOpen = true;
    warnPendingScans();
    mount(<SideDrawer />);
    const btn = () => document.getElementById('resolveScanEvidenceBtn')!;
    const hiddenWhenNone = btn().classList.contains('hidden');
    step(() => { seed(); warnPendingScans(); });
    const shown = !btn().classList.contains('hidden') && btn().textContent!.includes('(4)');
    securityState.pinTargetAction = null;
    localStorage.setItem('zoew_security_pin_hash', 'x');
    drawerResolveScanEvidenceFlow();
    const gated = securityState.pinTargetAction === resolveScanEvidence && viewState.pinPromptVerifyText.includes('បញ្ចប់ភស្តុតាងស្កេនរង់ចាំ');
    unmount(); document.body.innerHTML = '';
    expect({ hiddenWhenNone, shown, gated }).toEqual({ hiddenWhenNone: true, shown: true, gated: true });
    expect(Object.keys(ACTION_REGISTRY)).toContain('drawerResolveScanEvidenceFlow');
    expect(Object.keys(ACTION_REGISTRY)).not.toContain('resolveScanEvidence');
});

it('a full scope refuses new scans with the real cause and never blocks another shop or account', async () => {
    connect();
    const scope = pendingScanScope();
    for (let n = 0; n < SCAN_EVIDENCE_MAX_PENDING; n++) journal().prepare(scope, payload('FULL' + n));
    let refused: any = null;
    try { preparePendingScan('NEXT0001', 5, 0, NOW, 'direct', 2); } catch (e) { refused = e; }
    expect(refused).toMatchObject({ code: 'scan_evidence_unavailable', reason: 'unresolved' });
    const text = scanEvidenceRefusalText(refused);
    expect(text).toContain('មិនទាន់បញ្ចប់');
    expect(text).toContain('☰ ឧបករណ៍');
    expect(text).not.toContain('ទំហំផ្ទុក');
    await expect(addOrUpdateEntry('NEXT0002', '012000111', 5, 0)).rejects.toMatchObject({ reason: 'unresolved' });
    (firebaseState.auth as any).currentUser = { uid: 'second-account', getIdToken: async () => 'token' };
    expect(pendingScanScope()).not.toBe(scope);
    expect(preparePendingScan('NEXT0003', 5, 0, NOW, 'direct', 2).record.scope).toBe(pendingScanScope());
});
