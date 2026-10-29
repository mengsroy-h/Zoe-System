import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { firebaseState, uiState } from '../src/core/state';
import { appLocalStore } from '../src/core/storage';
import { createScanEvidenceJournal, SCAN_EVIDENCE_MAX_PENDING, SCAN_EVIDENCE_PREFIX } from '../src/services/scan-evidence';
import { finishPendingScan, notePendingScan, pendingScanIsCurrent, pendingScanScope, preparePendingScan, releasePendingScan,
    settlePendingScanRelease, warnPendingScans } from '../src/services/scan-pending';

const fault = vi.hoisted(() => ({ enabled: false, attempted: 0 }));
vi.mock('../src/core/storage', async (load) => {
    const original: any = await load();
    return { ...original, appLocalStore: new Proxy(original.appLocalStore, {
        get(target, property) {
            if (property === 'setItem') return (key: string, value: string) => {
                if (fault.enabled && key.startsWith('zoew_scan_evidence_v1:')) {
                    fault.attempted++;
                    throw new DOMException('quota', 'QuotaExceededError');
                }
                return target.setItem(key, value);
            };
            const value = Reflect.get(target, property, target);
            return typeof value === 'function' ? value.bind(target) : value;
        }
    }) };
});

const storage = appLocalStore!;
const handles: any[] = [];
const stamp = 1793000000000;
let serial = 0;
let writes: ReturnType<typeof vi.fn>;
const rows = (scope = pendingScanScope()) => createScanEvidenceJournal(storage).list(scope);
const messages = () => uiState.toasts.map((toast: any) => String(toast.msg));
const prepare = (barcode = 'PENDING001') => {
    const handle = preparePendingScan(barcode, 5.25, 1.75, stamp, 'interactive');
    handles.push(handle);
    return handle;
};
const storageFailure = () => {
    fault.enabled = true;
    return { mockRestore: () => { fault.enabled = false; } };
};
beforeEach(() => {
    vi.useFakeTimers();
    fault.enabled = false; fault.attempted = 0;
    storage.clear(); uiState.toasts = [];
    writes = vi.fn();
    const options = { databaseURL: 'https://scan-wrapper.firebaseio.com' };
    firebaseState.db = { app: { options } } as any;
    firebaseState.auth = { currentUser: { uid: 'u' + ++serial }, app: { options } } as any;
    firebaseState.authGeneration++;
    firebaseState.isInitializingFirebase = false;
    firebaseState.fb = { set: writes, update: writes, runTransaction: writes } as any;
    storage.setItem('zoew_firebase_config', JSON.stringify(options));
    warnPendingScans();
});
afterEach(() => {
    fault.enabled = false;
    handles.splice(0).forEach(releasePendingScan);
    vi.restoreAllMocks(); vi.clearAllTimers(); vi.useRealTimers();
    storage.clear(); uiState.toasts = [];
    delete window.ZoeErrors;
});

it('ការត្រៀមរក្សា barcode/ប្រាក់ និង db/auth/UID scope ពិត ដោយមិនសរសេរ backend', () => {
    const handle = prepare();
    expect(JSON.parse(handle.record.scope)).toEqual(['https://scan-wrapper.firebaseio.com', firebaseState.auth.currentUser.uid]);
    expect(handle.db).toBe(firebaseState.db);
    expect(handle.auth).toBe(firebaseState.authGeneration);
    expect(rows()).toEqual([expect.objectContaining({ barcode: 'PENDING001', cod: 5.25, dod: 1.75, createdAt: stamp, phase: 'prepared', mode: 'interactive' })]);
    expect(pendingScanIsCurrent(handle)).toBe(true);
    expect(writes).not.toHaveBeenCalled();
});

it.each(['uid', 'db', 'sdk', 'scope'])('គ្មាន %s ➜ បដិសេធមុន evidence/backend write', (missing) => {
    if (missing === 'uid') firebaseState.auth = { currentUser: null } as any;
    if (missing === 'db') firebaseState.db = null as any;
    if (missing === 'sdk') firebaseState.fb = null as any;
    if (missing === 'scope') {
        storage.clear(); firebaseState.db = {} as any;
        firebaseState.auth = { currentUser: { uid: 'u' } } as any;
    }
    expect(() => prepare()).toThrow(/scope unavailable/);
    expect(Object.keys(storage).filter((key) => key.startsWith(SCAN_EVIDENCE_PREFIX))).toEqual([]);
    expect(writes).not.toHaveBeenCalled();
});

it('storage quota ធ្លាក់ ➜ prepare បដិសេធ និងគ្មាន backend mutation', () => {
    storageFailure();
    expect(() => prepare()).toThrow(/not persisted/);
    expect(fault.attempted).toBe(1);
    expect(rows()).toEqual([]);
    expect(writes).not.toHaveBeenCalled();
});

it('journal ពេញ ➜ មិនលុប evidence ចាស់ ឬទទួល scan ថ្មី', () => {
    const journal = createScanEvidenceJournal(storage);
    for (let i = 0; i < SCAN_EVIDENCE_MAX_PENDING; i++) journal.prepare(pendingScanScope(), { barcode: 'OLD' + i, createdAt: stamp, cod: 1, dod: 0 });
    expect(() => prepare('OVERFLOW')).toThrow(/pending limit/);
    expect(rows()).toHaveLength(SCAN_EVIDENCE_MAX_PENDING);
    expect(rows().some((row) => row.barcode === 'OVERFLOW')).toBe(false);
    expect(writes).not.toHaveBeenCalled();
});

it.each(['db', 'generation', 'uid', 'tenant'])('%s ប្តូរ ➜ handle ចាស់មិន append/finish នៅ scope ថ្មី', (changed) => {
    if (changed === 'tenant') {
        const options = { supabaseUrl: 'https://scan-wrapper.supabase.co' };
        storage.setItem('zoew_firebase_config', JSON.stringify(options));
        firebaseState.db = { app: { options } } as any;
        firebaseState.auth = { app: { options }, currentUser: { uid: 'u' }, _account: { tenant_id: 'A' } } as any;
        (firebaseState.fb as any).tenantScope = (auth: any) => auth._account.tenant_id;
    }
    const handle = prepare();
    if (changed === 'db') firebaseState.db = { ...firebaseState.db } as any;
    if (changed === 'generation') firebaseState.authGeneration++;
    if (changed === 'uid') firebaseState.auth.currentUser.uid = 'other';
    if (changed === 'tenant') (firebaseState.auth as any)._account.tenant_id = 'B';
    expect(pendingScanIsCurrent(handle)).toBe(false);
    expect(() => notePendingScan(handle, 'claimed')).toThrow(/session changed/);
    expect(finishPendingScan(handle, 'saved-and-ledger-confirmed')).toBe(false);
    expect(rows(handle.record.scope)).toEqual([expect.objectContaining({ id: handle.record.id, phase: 'prepared' })]);
    expect(writes).not.toHaveBeenCalled();
});

it('append/finish storage failure រក្សា prepared evidence ហើយអនុញ្ញាត warning', () => {
    const handle = prepare();
    const failed = storageFailure();
    expect(() => notePendingScan(handle, 'claimed')).toThrow(/not persisted/);
    expect(handle.claimed).toBeUndefined();
    expect(finishPendingScan(handle, 'saved-and-ledger-confirmed')).toBe(false);
    expect(fault.attempted).toBe(2);
    failed.mockRestore();
    expect(rows()).toEqual([expect.objectContaining({ id: handle.record.id, phase: 'prepared' })]);
    warnPendingScans();
    expect(messages().join('\n')).toContain('PENDING001');
    expect(writes).not.toHaveBeenCalled();
});

it('live scan មិនរំខាន; released/restarted evidence រំលឹក barcode និងផ្ទាំងផ្សេង តែម្តង', () => {
    const handle = prepare();
    warnPendingScans(); expect(messages()).toEqual([]);
    releasePendingScan(handle);
    const journal = createScanEvidenceJournal(storage);
    journal.prepare(pendingScanScope(), { barcode: 'RESTART002', createdAt: stamp, cod: 8, dod: 2 });
    warnPendingScans(); warnPendingScans();
    expect(messages()).toHaveLength(1);
    expect(messages()[0]).toContain('PENDING001');
    expect(messages()[0]).toContain('RESTART002');
    expect(messages()[0]).toContain('វាអាចកំពុងរក្សាទុកក្នុងផ្ទាំងផ្សេង');
    expect(rows()).toHaveLength(2);
    expect(writes).not.toHaveBeenCalled();
});

it('warning scope មិនលេច barcode របស់ user ផ្សេង និងមិនបញ្ជា replay', () => {
    const handle = prepare('PRIVATE003'); releasePendingScan(handle);
    const user = firebaseState.auth.currentUser.uid;
    firebaseState.auth.currentUser.uid = 'other';
    warnPendingScans(); expect(messages()).toEqual([]);
    firebaseState.auth.currentUser.uid = user;
    warnPendingScans(); expect(messages().join('\n')).toContain('PRIVATE003');
    expect(rows()).toHaveLength(1);
    expect(writes).not.toHaveBeenCalled();
});

it.each([[true, true, true], [true, false, false], [false, true, false]])('compensation %s / registry release %s ➜ completion %s', async (money, registry, expected) => {
    const handle = prepare(); notePendingScan(handle, 'claimed');
    expect(handle.claimed).toBe(true);
    expect(await settlePendingScanRelease(handle, Promise.resolve(money), Promise.resolve(registry))).toBe(expected);
    expect(rows()).toHaveLength(expected ? 0 : 1);
    warnPendingScans();
    expect(messages().filter((text) => text.includes('មិនទាន់មានភស្តុតាងបញ្ចប់'))).toHaveLength(expected ? 0 : 1);
    expect(messages().some((text) => text.includes('បានដោះរួច'))).toBe(expected);
    expect(writes).not.toHaveBeenCalled();
});

it('compensation rejection មិនអះអាង completed និងរក្សា warning', async () => {
    const handle = prepare(); notePendingScan(handle, 'claimed');
    expect(await settlePendingScanRelease(handle, Promise.reject(new Error('lost response')), Promise.resolve(true))).toBe(false);
    expect(rows()).toHaveLength(1);
    warnPendingScans();
    expect(messages().filter((text) => text.includes('មិនទាន់មានភស្តុតាងបញ្ចប់'))).toHaveLength(1);
    expect(messages().some((text) => text.includes('បានដោះរួច'))).toBe(false);
    expect(writes).not.toHaveBeenCalled();
});
