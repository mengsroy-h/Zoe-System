// M1 (deep audit 8): a scan save whose history write landed but whose reply was lost resolves `txOutcome: 'unknown'`
// (Firebase: another device wrote the same row before the REST read; Supabase: a lost-ACK replay that cannot be authorised).
// The save path treated every rejection as "not saved": it took the scan's +COD/DOD/+1 back out of both ledgers while the
// parcel stays on the server ➜ revenue understated, and the caller released the barcode's duplicate lock. An unknown outcome
// is decided by the server row (`ledgerCompanionState()`): the barcode is there ➜ saved · absent ➜ reverted · unreadable ➜
// nothing reverted, the save answers 'unknown' (the caller keeps the duplicate lock), Sentry money.
import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataState, firebaseState, uiState } from '../src/core/state';
import { getFormattedDate } from '../src/core/timezone';
import { addOrUpdateEntry, SCAN_SETTLE_READ_GAP_MS } from '../src/features/scan-action';
import { createScanEvidenceJournal } from '../src/services/scan-evidence';
import { pendingScanScope, preparePendingScan, notePendingScan, warnPendingScans } from '../src/services/scan-pending';
import { withTransactionOutcomeResolution } from '../src/services/tx-outcome';
import { dbListenerPendingPaths } from '../src/core/text';

const scanStorageFault = vi.hoisted(() => ({ phase: '', hits: 0 }));
vi.mock('../src/core/storage', async (importOriginal) => {
    const actual: any = await importOriginal();
    return { ...actual, appLocalStore: new Proxy(actual.appLocalStore, {
        get(target, key) {
            if (key === 'setItem') return (name: string, value: string) => {
                if (scanStorageFault.phase && name.startsWith('zoew_scan_evidence_v1:') && name.endsWith(':' + scanStorageFault.phase)) {
                    scanStorageFault.hits++; throw new Error('quota');
                }
                return target.setItem(name, value);
            };
            const value = Reflect.get(target, key, target);
            return typeof value === 'function' ? value.bind(target) : value;
        }
    }) };
});

const H = 'zoew_scan_history_cod_dod', D = 'zoew_daily_revenue_cod_dod', M = 'zoew_monthly_revenue_cod_dod';
const HOST = 'https://m1-unknown.firebaseio.com';
const NOW = Date.UTC(2026, 9, 24, 2);
const lab = { store: {} as any, fault: '' as '' | 'merge' | 'new' | 'mergeLost' | 'mergeThenRemoved' | 'mergeThenDeleted' | 'replacementDirect' | 'replacementUnknownBirth' | 'replacementMoved' | 'replacementAfterPurge', readFails: false, rootFails: 0 };
const clone = <V,>(v: V): V => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
const parts = (p: string) => p.split('/').filter(Boolean);
const getAt = (p: string) => clone(parts(p).reduce((n: any, k) => n?.[k], lab.store) ?? null);
function setAt(p: string, v: any) {
    const segs = parts(p); const leaf = segs.pop()!; let node = lab.store;
    for (const s of segs) node = node[s] ||= {};
    if (v === null || v === undefined) delete node[leaf]; else node[leaf] = clone(v);
}
const ref = (p = '') => ({ path: p, key: parts(p).at(-1) || null, toString: () => HOST + '/' + p });
const snap = (r: any, v: any) => ({ ref: r, key: r.key, val: () => clone(v), exists: () => v !== null && v !== undefined });
const unknown = () => Object.assign(new Error('disconnect'), { txOutcome: 'unknown' });
const DAY = () => getFormattedDate(new Date(NOW));
const settle = async () => { for (let i = 0; i < 20; i++) await new Promise((r) => setTimeout(r, 0)); };
const money = () => [getAt(D + '/' + DAY()), getAt(M + '/' + DAY().slice(0, 7))].map((r) => [r.codDollar, r.totalCount]);

beforeEach(() => {
    scanStorageFault.phase = ''; scanStorageFault.hits = 0;
    localStorage.clear();
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(NOW);
    vi.stubGlobal('crypto', webcrypto);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    lab.fault = ''; lab.readFails = false; lab.rootFails = 0;
    lab.store = {
        [H]: { itemI: { id: 'itemI', phone: '012000111', scanDate: DAY(), time: '08:00:00 (' + DAY() + ')', createdAt: NOW - 3600000, count: 1, cod: 10, dod: 0, price: 10,
            isClosed: false, isCalled: false, barcode: 'A100000001', barcodes: [{ code: 'A100000001', cod: 10, dod: 0, isClosed: false, isDeducted: false, isFromDeletion: false }] } },
        [D]: { [DAY()]: { codDollar: 10, dodDollar: 0, totalCount: 1 } },
        [M]: { [DAY().slice(0, 7)]: { codDollar: 10, dodDollar: 0, totalCount: 1 } }
    };
    dataState.scanHistory = Object.values(clone(lab.store[H]));
    dataState.dailyRevenueData = clone(lab.store[D]); dataState.monthlyRevenueData = clone(lab.store[M]);
    firebaseState.authGeneration++; firebaseState.db = { name: 'm1', app: { options: { databaseURL: HOST } } } as any;
    firebaseState.auth = { currentUser: { uid: 'u', getIdToken: async () => 'tok' } } as any;
    firebaseState.firebaseConfig = { databaseURL: HOST } as any;
    firebaseState.dbRefHistory = ref(H) as any; firebaseState.dbRefDailyRevenue = ref(D) as any; firebaseState.dbRefMonthlyRevenue = ref(M) as any;
    firebaseState.fb = {
        ref: (_db: any, p = '') => ref(p),
        increment: (n: number) => ({ __inc: n }),
        get: async (r: any) => snap(r, getAt(r.path)),
        update: async (r: any, ups: any) => {
            for (const [k, v] of Object.entries(ups)) setAt([r.path, k].filter(Boolean).join('/'), v);
            if (lab.fault === 'new' && r.path === H) throw unknown();
        },
        set: async (r: any, v: any) => setAt(r.path, v),
        runTransaction: async (r: any, fn: any) => {
            const prior = getAt(r.path); const next = fn(clone(prior));
            if (next === undefined) return { committed: false, snapshot: snap(r, prior) };
            if (lab.fault === 'mergeLost' && r.path === H + '/itemI') throw unknown();
            if (lab.fault.startsWith('replacement') && r.path === H + '/itemI') {
                const replacement = clone(next);
                const parcel = replacement.barcodes.find((b: any) => b.code === 'X200000002');
                if (lab.fault === 'replacementUnknownBirth') delete parcel.createdAt;
                else parcel.createdAt = NOW + 1;
                if (lab.fault === 'replacementMoved') {
                    setAt(r.path, prior);
                    setAt('zoew_recently_deleted_cod_dod/newLife', { id: 'newLife', phone: replacement.phone, scanDate: replacement.scanDate,
                        trashReason: 'delete', isFromDeletion: true, barcodes: [parcel] });
                } else setAt(r.path, replacement);
                // Refused old write + independently paid replacement => +5 remains unresolved.
                // Landed old write then Remove/purge/rescan => -5 +5 already nets out; never undo it again.
                if (lab.fault !== 'replacementAfterPurge') for (const path of [D + '/' + DAY(), M + '/' + DAY().slice(0, 7)]) {
                    const record = getAt(path); setAt(path, { ...record, codDollar: record.codDollar + 5, totalCount: record.totalCount + 1 });
                }
                throw unknown();
            }

            setAt(r.path, next);
            if (lab.fault === 'merge' && r.path === H + '/itemI') {
                const row = getAt(r.path); row.isCalled = true; setAt(r.path, row);
                throw unknown();
            }
            if (lab.fault === 'mergeThenRemoved' && r.path === H + '/itemI') {
                const row = getAt(r.path); const moved = row.barcodes.find((b: any) => b.code === 'X200000002');
                row.barcodes = row.barcodes.filter((b: any) => b !== moved); row.count = row.barcodes.length; row.cod = 10; row.price = 10;
                setAt(r.path, row);
                setAt('zoew_recently_deleted_cod_dod/rm1', { id: 'rm1', phone: row.phone, scanDate: row.scanDate, trashReason: 'remove', isFromDeletion: false,
                    deletedAt: NOW + 1, barcodes: [{ ...moved, isDeducted: true }] });
                for (const k of [D + '/' + DAY(), M + '/' + DAY().slice(0, 7)]) { const v = getAt(k); setAt(k, { ...v, codDollar: v.codDollar - 5, totalCount: v.totalCount - 1 }); }
                throw unknown();
            }
            if (lab.fault === 'mergeThenDeleted' && r.path === H + '/itemI') {
                const row = getAt(r.path); setAt(r.path, null);
                setAt('zoew_recently_deleted_cod_dod/itemI', { ...row, trashReason: 'delete', isFromDeletion: true, deletedAt: NOW + 1 });
                throw unknown();
            }
            return { committed: true, snapshot: snap(r, getAt(r.path)) };
        },
        onValue: () => () => {}, off: () => {}
    } as any;
    vi.stubGlobal('fetch', vi.fn(async (input: any) => {
        if (lab.readFails) throw new TypeError('Failed to fetch');
        const path = decodeURIComponent(new URL(String(input)).pathname).replace(/^\//, '').replace(/\.json$/, '');
        if (lab.rootFails > 0 && (path === H || path === 'zoew_recently_deleted_cod_dod')) { lab.rootFails--; throw new TypeError('Failed to fetch'); }
        return new Response(JSON.stringify(getAt(path)), { status: 200, headers: { 'content-type': 'application/json' } });
    }));
    (window as any).ZoeErrors = { capture: vi.fn() };
});
afterEach(() => {
    firebaseState.authGeneration++;
    vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); delete (window as any).ZoeErrors;
});

describe('M1 ៖ a scan save that landed but answered «unknown» keeps its revenue', () => {
    it('merge into an existing row lands, another device marks the row, the reply is lost ➜ saved, ledger +5', async () => {
        lab.fault = 'merge';
        const out = await addOrUpdateEntry('X200000002', '012000111', 5, 0, 'N/A').then((v) => v, (e) => e);
        expect(out).not.toBeInstanceOf(Error);
        expect(getAt(H + '/itemI').barcodes.map((b: any) => b.code)).toContain('X200000002');
        await settle();
        expect(money()).toEqual([[15, 2], [15, 2]]);
    });

    it('a new row lands but the write answers «unknown» ➜ saved, ledger +6', async () => {
        lab.fault = 'new';
        const out = await addOrUpdateEntry('Z300000003', '012999888', 6, 0, 'N/A').then((v) => v, (e) => e);
        expect(out).not.toBeInstanceOf(Error);
        await settle();
        expect(money()).toEqual([[16, 2], [16, 2]]);
    });

    it('control: the merge never landed (barcode absent on the server) ➜ rejected and the ledger reverted', async () => {
        lab.fault = 'mergeLost';
        const out = await addOrUpdateEntry('X200000002', '012000111', 5, 0, 'N/A').then((v) => v, (e) => e);
        expect(out).toBeInstanceOf(Error);
        await settle();
        expect(money()).toEqual([[10, 1], [10, 1]]);
    });

    it('re-audit ៖ the merge never landed · one whole-root read fails once ➜ read again · rejected and the ledger reverted (never «unknown»)', async () => {
        lab.fault = 'mergeLost'; lab.rootFails = 1;
        const out = await addOrUpdateEntry('X200000002', '012000111', 5, 0, 'N/A').then((v) => v, (e) => e);
        expect(lab.rootFails, 'លក្ខខណ្ឌមុន ៖ ការអាន root ធ្លាក់ម្តង').toBe(0);
        expect(out).toBeInstanceOf(Error);
        await settle();
        expect(money()).toEqual([[10, 1], [10, 1]]);
    });

    // Re-audit A444 (M1) ៖ an «unknown» save kept the scan's ledger delta and the caller's registry key for good: a refused write is
    // never resent, so once the server is readable again the outcome is final, yet nothing read it ➜ revenue +5 / +1 for a parcel that
    // is not in the system and a barcode every rescan refuses as «already used». The App keeps deciding while the page and session live.
    it('A444 ៖ the write never landed · the row cannot be read («unknown») · the network returns ➜ ledger reverted · registry key released', async () => {
        lab.fault = 'mergeLost'; lab.readFails = true;
        setAt('zoew_barcode_registry/X200000002', true);
        const out = await addOrUpdateEntry('X200000002', '012000111', 5, 0, 'N/A').then((v) => v, (e) => e);
        await settle();
        expect({ out, money: money(), key: getAt('zoew_barcode_registry/X200000002') }, 'លក្ខខណ្ឌមុន ៖ unknown · ledger +5 · key នៅ')
            .toEqual({ out: 'unknown', money: [[15, 2], [15, 2]], key: true });
        lab.readFails = false;
        await vi.waitFor(() => expect(money()).toEqual([[10, 1], [10, 1]]), { timeout: 6000 });
        await vi.waitFor(() => expect(getAt('zoew_barcode_registry/X200000002')).toBeNull(), { timeout: 3000 });
    }, 15000);

    it('A444 control ៖ the write landed · «unknown» · the network returns ➜ saved (ledger +5 kept · key kept)', async () => {
        lab.fault = 'merge'; lab.readFails = true;
        setAt('zoew_barcode_registry/X200000002', true);
        const out = await addOrUpdateEntry('X200000002', '012000111', 5, 0, 'N/A').then((v) => v, (e) => e);
        expect(out).toBe('unknown');
        lab.readFails = false;
        await new Promise((r) => setTimeout(r, 2500));
        await settle();
        expect({ money: money(), key: getAt('zoew_barcode_registry/X200000002') }).toEqual({ money: [[15, 2], [15, 2]], key: true });
    }, 15000);

    it('the row cannot be read ➜ nothing reverted (unconfirmed) and a money alarm', async () => {
        lab.fault = 'merge'; lab.readFails = true;
        const out = await addOrUpdateEntry('X200000002', '012000111', 5, 0, 'N/A').then((v) => v, (e) => e);
        expect(out).toBe('unknown');
        await settle();
        expect(money()).toEqual([[15, 2], [15, 2]]);
        expect(((window as any).ZoeErrors.capture as any).mock.calls.some(([, extra]: any) => extra && extra.zone === 'money')).toBe(true);
    });
});

describe('M2 (deep audit 9) ៖ an «unknown» merge whose barcode another device moved out of the row is not reverted', () => {
    it('merge lands · another device Removes the barcode (deducts it) · reply lost ➜ the scan +5 stays (no second deduction)', async () => {
        lab.fault = 'mergeThenRemoved';
        const out = await addOrUpdateEntry('X200000002', '012000111', 5, 0, 'N/A').then((v) => v, (e) => e);
        expect(out).not.toBeInstanceOf(Error);
        await settle();
        expect(money()).toEqual([[10, 1], [10, 1]]);
    });

    it('merge lands · another device Deletes the row (keeps money) · reply lost ➜ the scan +5 stays', async () => {
        lab.fault = 'mergeThenDeleted';
        const out = await addOrUpdateEntry('X200000002', '012000111', 5, 0, 'N/A').then((v) => v, (e) => e);
        expect(out).not.toBeInstanceOf(Error);
        await settle();
        expect(money()).toEqual([[15, 2], [15, 2]]);
    });
});

// M5 (deep audit 9) ៖ a server row without a `barcodes` array (vanilla-era shape · entries that are not objects) is not a parcel
// list (CLAUDE.md «field-shape»: never read `item.barcode` · `item.cod` · `item.isClosed` as a parcel). The scan merge converted
// it into one: a phantom barcode carrying the row's old item-level total joined the new scan ➜ the row's money exceeds the ledger.
// The merge must abort on such a row (nothing written · the scan refused · its ledger delta reverted).
describe('M5 (deep audit 9) ៖ the scan merge never converts a row without a barcode list into a parcel', () => {
    it.each([
        ['no barcodes key', (row: any) => { delete row.barcodes; }],
        ['barcodes holding no object', (row: any) => { row.barcodes = { 0: 'junk' }; }]
    ])('%s ➜ row untouched · scan refused · ledger 10/1', async (_label, shape) => {
        const row = getAt(H + '/itemI'); shape(row); row.cod = 50; row.price = 50; setAt(H + '/itemI', row);
        const before = getAt(H + '/itemI');
        const out = await addOrUpdateEntry('X200000002', '012000111', 5, 0, 'N/A').then((v) => v, (e) => e);
        await settle();
        expect({ refused: out instanceof Error || out === false, row: getAt(H + '/itemI'), money: money() })
            .toEqual({ refused: true, row: before, money: [[10, 1], [10, 1]] });
    });
});

// A451: another lifecycle is neither proof that our save landed nor proof that its money must be undone.
it.each([
    ['replacementDirect', 20, 3], ['replacementUnknownBirth', 20, 3], ['replacementMoved', 20, 3], ['replacementAfterPurge', 15, 2]
] as const)('unknown save holds on other/unproven lifecycle (%s) without releasing its registry or guessing compensation', async (fault, cod, count) => {
    lab.fault = fault;
    const timers: any[] = [];
    const schedule = globalThis.setTimeout;
    vi.spyOn(globalThis, 'setTimeout').mockImplementation(((callback: any, delay: number, ...args: any[]) => {
        const handle = schedule(callback, delay, ...args);
        if (delay === SCAN_SETTLE_READ_GAP_MS || delay === 2 * SCAN_SETTLE_READ_GAP_MS) timers.push({ callback, handle });
        return handle;
    }) as any);
    setAt('zoew_barcode_registry/X200000002', true);
    const out = await addOrUpdateEntry('X200000002', '012000111', 5, 0, 'N/A').catch(e => e);
    expect({ out, money: money(), registry: getAt('zoew_barcode_registry/X200000002') })
        .toEqual({ out: 'unknown', money: [[cod, count], [cod, count]], registry: true });
    // Execute the scheduled retry directly: no wall-clock sleep determines the race.
    const later = timers.at(-1);
    expect(later).toBeDefined();
    clearTimeout(later.handle);
    const reads = (fetch as any).mock.calls.length;
    if (fault === 'replacementAfterPurge') {
        const row = getAt(H + '/itemI');
        row.barcodes = row.barcodes.filter((b: any) => b.code !== 'X200000002');
        setAt(H + '/itemI', row);
    }
    later.callback();
    await vi.waitFor(() => expect((fetch as any).mock.calls.length).toBeGreaterThan(reads));
    await vi.waitFor(() => expect(timers.length, 'unresolved deferred check schedules another read').toBeGreaterThanOrEqual(4));
    expect({ money: money(), registry: getAt('zoew_barcode_registry/X200000002') })
        .toEqual({ money: [[cod, count], [cod, count]], registry: true });
    const capture = ((window as any).ZoeErrors.capture as any).mock.calls;
    expect(capture.some(([, extra]: any) => extra?.context === 'addOrUpdateEntry save outcome unknown')).toBe(true);
}, 15000);

it('unknown save holds earlier lifecycle ambiguity when that replacement disappears before the next read', async () => {
    lab.fault = 'replacementAfterPurge';
    setAt('zoew_barcode_registry/X200000002', true);
    const serve = globalThis.fetch;
    let replacedReads = 0;
    vi.stubGlobal('fetch', vi.fn(async (input: any, init?: any) => {
        const response = await serve(input, init);
        const path = new URL(String(input)).pathname;
        if (path === '/' + H + '/itemI.json' && ++replacedReads === 1) {
            // Preserve the returned snapshot, then a foreign permanent purge makes later reads empty.
            const row = getAt(H + '/itemI');
            row.barcodes = row.barcodes.filter((b: any) => b.code !== 'X200000002');
            setAt(H + '/itemI', row);
        }
        return response;
    }));
    const out = await addOrUpdateEntry('X200000002', '012000111', 5, 0, 'N/A').catch(e => e);
    expect(replacedReads).toBeGreaterThan(1);
    expect({ out, money: money(), registry: getAt('zoew_barcode_registry/X200000002') })
        .toEqual({ out: 'unknown', money: [[15, 2], [15, 2]], registry: true });
}, 15000);

const scanEvidence = (scope = pendingScanScope()) => createScanEvidenceJournal(localStorage).list(scope);

it('durable scan evidence clears after acknowledged data and both ledger outcomes', async () => {
    expect(await addOrUpdateEntry('X200000002', '012000111', 5, 0)).toBe(true);
    expect({ money: money(), pending: scanEvidence() }).toEqual({ money: [[15, 2], [15, 2]], pending: [] });
});

it.each(['prepared', 'save-pending'])('durable evidence %s storage failure blocks all money/data/registry effects for a direct call', async (phase) => {
    setAt('zoew_barcode_registry/X200000002', true);
    const tx = vi.spyOn(firebaseState.fb, 'runTransaction');
    const update = vi.spyOn(firebaseState.fb, 'update');
    scanStorageFault.phase = phase;
    await expect(addOrUpdateEntry('X200000002', '012000111', 5, 0)).rejects.toThrow();
    expect({ tx: tx.mock.calls.length, update: update.mock.calls.length, money: money(), registry: getAt('zoew_barcode_registry/X200000002') })
        .toEqual({ tx: 0, update: 0, money: [[10, 1], [10, 1]], registry: true });
    expect(scanStorageFault.hits, 'fault actually reached durable storage').toBeGreaterThan(0);
    expect(scanEvidence(), 'a definitely unused preparation can be retired').toEqual([]);
});

it('a stale prepared handle never releases a registry key or writes money in a new tenant', async () => {
    const prepared = preparePendingScan('X200000002', 5, 0, NOW);
    notePendingScan(prepared, 'claimed');
    const originalScope = prepared.record.scope;
    firebaseState.authGeneration++;
    firebaseState.db = { app: { options: { databaseURL: 'https://other.firebaseio.com' } } } as any;
    firebaseState.auth = { currentUser: { uid: 'other' } } as any;
    setAt('zoew_barcode_registry/X200000002', true);
    const tx = vi.spyOn(firebaseState.fb, 'runTransaction'); const update = vi.spyOn(firebaseState.fb, 'update');
    await expect(addOrUpdateEntry('X200000002', '012000111', 5, 0, 'N/A', NOW, 0, prepared)).rejects.toThrow('session changed');
    expect({ tx: tx.mock.calls.length, update: update.mock.calls.length, key: getAt('zoew_barcode_registry/X200000002') })
        .toEqual({ tx: 0, update: 0, key: true });
    expect(scanEvidence(originalScope)).toHaveLength(1);
});

it.each(['barcode', 'birth', 'money'])('a prepared handle with mismatched %s never releases a registry key', async (mismatch) => {
    const prepared = preparePendingScan('X200000002', 5, 0, NOW); notePendingScan(prepared, 'claimed');
    setAt('zoew_barcode_registry/X200000002', true); setAt('zoew_barcode_registry/Y200000003', true);
    const tx = vi.spyOn(firebaseState.fb, 'runTransaction'); const update = vi.spyOn(firebaseState.fb, 'update');
    await expect(addOrUpdateEntry(mismatch === 'barcode' ? 'Y200000003' : 'X200000002', '012000111', mismatch === 'money' ? 6 : 5, 0,
        'N/A', mismatch === 'birth' ? NOW + 1 : NOW, 0, prepared)).rejects.toThrow('identity changed');
    expect({ tx: tx.mock.calls.length, update: update.mock.calls.length, keyX: getAt('zoew_barcode_registry/X200000002'), keyY: getAt('zoew_barcode_registry/Y200000003') })
        .toEqual({ tx: 0, update: 0, keyX: true, keyY: true });
    expect(scanEvidence()).toHaveLength(1);
});

it('normal rejected save retains evidence until the actual ledger compensation commits', async () => {
    lab.fault = 'mergeLost'; setAt('zoew_barcode_registry/X200000002', true);
    uiState.toasts = [];
    const run = firebaseState.fb.runTransaction;
    let release!: () => void; let entered!: () => void;
    const ready = new Promise<void>(resolve => { entered = resolve; });
    const gate = new Promise<void>(resolve => { release = resolve; });
    (firebaseState.fb as any).runTransaction = async (r: any, fn: any) => {
        if (r.path === D + '/' + DAY() && getAt(r.path)?.codDollar === 15) { entered(); await gate; }
        return run(r, fn);
    };
    await expect(addOrUpdateEntry('X200000002', '012000111', 5, 0)).rejects.toThrow();
    await ready;
    expect(scanEvidence()).toHaveLength(1);
    expect(money()[0]).toEqual([15, 2]);
    expect(uiState.toasts.some((toast: any) => toast.msg.includes('អាចស្កេនម្ដងទៀត'))).toBe(false);
    release();
    await vi.waitFor(() => expect(scanEvidence()).toEqual([]));
    expect({ money: money(), key: getAt('zoew_barcode_registry/X200000002') }).toEqual({ money: [[10, 1], [10, 1]], key: null });
    expect(uiState.toasts.some((toast: any) => toast.msg.includes('អាចស្កេនម្ដងទៀត'))).toBe(true);
});

it('a failed compensation keeps durable evidence instead of declaring the rejected scan settled', async () => {
    lab.fault = 'mergeLost';
    const run = firebaseState.fb.runTransaction;
    (firebaseState.fb as any).runTransaction = async (r: any, fn: any) => {
        if (r.path === D + '/' + DAY() && getAt(r.path)?.codDollar === 15) throw new Error('permission_denied');
        return run(r, fn);
    };
    await expect(addOrUpdateEntry('X200000002', '012000111', 5, 0)).rejects.toThrow();
    await vi.waitFor(() => expect(money()[1]).toEqual([10, 1]));
    expect(scanEvidence()).toHaveLength(1);
    expect(money()[0]).toEqual([15, 2]);
});
it('native reboot retains actionable pending evidence after a refused unknown data write is retired', async () => {
    localStorage.clear(); dbListenerPendingPaths.clear();
    const journal = () => Object.keys(localStorage).filter(k => k.startsWith('zoew_connection_writes_v1:')).map(k => JSON.parse(localStorage.getItem(k)!));
    const base: any = firebaseState.fb;
    let denyHistory = true;
    const makeNative = () => {
        const app = { options: { databaseURL: HOST } };
        const auth = { app, currentUser: { uid: 'u', getIdToken: async () => 'tok' } };
        const db = { app };
        const raw = { ...base, getAuth: () => auth, getDatabase: () => db, deleteApp: async () => {},
            update: async (r: any, updates: any) => {
                if (denyHistory && Object.keys(updates).some(p => p.startsWith(H + '/'))) {
                    lab.readFails = true;
                    throw Object.assign(new Error('permission_denied'), { code: 'PERMISSION_DENIED' });
                }
                for (const [key, value] of Object.entries(updates)) setAt([r.path, key].filter(Boolean).join('/'), value);
            }
        };
        const sdk = withTransactionOutcomeResolution(raw); sdk.getAuth(app); sdk.getDatabase(app);
        Object.assign(firebaseState, { firebaseConfig: app.options, fb: sdk, auth, db, isDatabaseInitialized: true,
            isInitializingFirebase: false, firebaseSdkUnavailable: false, isDatabaseConnected: true, sessionExpiryCheck: 'live', authLoginOperation: null });
        firebaseState.dbRefHistory = sdk.ref(db, H); firebaseState.dbRefDailyRevenue = sdk.ref(db, D); firebaseState.dbRefMonthlyRevenue = sdk.ref(db, M);
        return { sdk, db, app };
    };
    setAt('zoew_barcode_registry/X200000002', true);
    const first = makeNative();
    const out = await addOrUpdateEntry('X200000002', '012999888', 5, 0, 'N/A');
    expect(out, 'unknown save is a precondition').toBe('unknown');
    expect(money(), 'both successful money transactions acknowledged').toEqual([[15, 2], [15, 2]]);
    expect(journal().map(row => ({ refused: row.refused, intent: row.intent?.kind })), 'only the refused data write survives, no money rollback intent')
        .toEqual([{ refused: true, intent: undefined }]);
    await first.sdk.deleteApp(first.app); firebaseState.authGeneration++;
    lab.readFails = false; denyHistory = false;
    const second = makeNative();
    await second.sdk.retryWriteRecovery(second.db);
    expect(journal(), 'actual native startup recovery retires the refused row').toEqual([]);
    expect(Object.values(lab.store[H]).flatMap((r: any) => r.barcodes).some((b: any) => b.code === 'X200000002')).toBe(false);
    expect({ money: money(), key: getAt('zoew_barcode_registry/X200000002') })
        .toEqual({ money: [[15, 2], [15, 2]], key: true });
    expect(scanEvidence().map(row => ({ code: row.barcode, cod: row.cod, birth: row.createdAt, phase: row.phase })))
        .toEqual([{ code: 'X200000002', cod: 5, birth: NOW, phase: 'pending' }]);
    uiState.toasts = [];
    warnPendingScans();
    expect(uiState.toasts.some((toast: any) => toast.msg.includes('X200000002') && toast.msg.includes('មិនទាន់'))).toBe(true);
    await second.sdk.deleteApp(second.app);
}, 15000);
