import { webcrypto } from 'node:crypto';
import { setTimeout as realDelay } from 'node:timers/promises';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { dataState, firebaseState, scanState, uiState, ztoState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import { pendingRegistryReleases } from '../src/core/clock';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { getFormattedDate } from '../src/core/timezone';
import { LEDGER_OP_RING_MAX, ledgerOpRing } from '../src/domain/ledger';
import { clearZtoPickupStatusStore } from '../src/features/zto-status';
import { createScanEvidenceJournal } from '../src/services/scan-evidence';
import { pendingScanScope, preparePendingScan } from '../src/services/scan-pending';
import { claimScanOperation, resumePendingScanOperations, saveScanOperation } from '../src/services/scan-operation';
import { SbIncrement, SbNetworkError, SbRpcError, SB_OP_REPLAY_SAFE_MS, canonicalJson, createSupabaseDatabase, getAt, setAt } from '../src/services/supabase-rtdb';

/**
 * ស្កេន v2 លើ Supabase ៖ `prepareScanMonth()` ផ្ញើ CAS លើ root `zoew_monthly_revenue_cod_dod` ទាំងមូល ដែលបន្ថែមតែ token ខែ (`op_m…`)
 * ក្នុង ring (គ្មានប្រាក់ · គ្មាន `connectionIntent`)។ ក្រោយ a07144c `sbPlainCasRow()` ឃើញ token ក្រោមខែ ហើយចាត់ជួរនេះជា ledger ➜ ចម្លើយបាត់
 * រួចការផ្ញើឡើងវិញត្រូវបដិសេធ · ជួរហួស window · ជួរកំណែចាស់ ➜ HOLD ➜ ហាងទាំងមូលសរសេរមិនបាន (Firebase សម្រេចតាមតម្លៃ ហើយទម្លាក់)។
 * ការទម្លាក់ជួរនេះមិនអាចបូកពីរដង ឬបាត់ស្កេន ៖ ប្រាក់ចូលតែក្នុង update finalize (receipt prepared ➜ committed) ហើយ finalize រៀប token
 * ខែឡើងវិញពេលបាត់ (A491)។ Test នេះរត់កូដស្កេនពិត + adapter Supabase ពិត លើ engine zoe_* ក្នុង memory ៖ session ទី ២ ត្រូវ commit
 * ស្កេនម្តង (ប្រាក់ +1 ម្តង) មិនថា CAS ដែលបាត់ចម្លើយបានចុះ ឬមិនបានចុះ។
 */

const H = 'zoew_scan_history_cod_dod';
const D = 'zoew_daily_revenue_cod_dod';
const M = 'zoew_monthly_revenue_cod_dod';
const R = 'zoew_barcode_registry';
const OPS = 'zoew_scan_operations';
const URL = 'https://scan-month-token.supabase.co';
const SCOPE = URL + '|scan-owner';
const TOPIC = 'zoe:A';
const NOW = Date.UTC(2026, 10, 4, 2);
const CODE = 'MONTHTOKEN0001';
const copy = <T,>(value: T): T => value === undefined ? value : JSON.parse(JSON.stringify(value));
const day = () => getFormattedDate(new Date(NOW));
const month = () => day().slice(0, 7);

type Plan = { lost?: 'after' | 'before'; then?: 'pt401' | '42501' | 'close'; index?: number };
let tree: any;
let seq = 1;
const docSeq = new Map<string, number>();
const replies = new Map<string, any>();
let plan: Plan = {};
let monthCasIds: string[] = [];
let sendLog: string[] = [];
let faultedOps: any = null;
let faultedSends = 0;
let churned = false;
let rows: Map<string, any>;
let sessions: any[] = [];

const money = () => [getAt(tree, [D, day()]), getAt(tree, [M, month()])].map((row: any) => [row?.codDollar ?? 0, row?.dodDollar ?? 0, row?.totalCount ?? 0]);
const evidence = () => createScanEvidenceJournal(localStorage, 2).list(pendingScanScope());
const journalRows = () => [...rows.values()].filter((row) => row.scope === SCOPE && row.topic === TOPIC);
const docOf = (r: string, k: string) => ({ r, k, v: tree?.[r]?.[k] ?? null, s: docSeq.get(r + '/' + k) || 1 });

function churnMonth() {
    for (let i = 0; i <= LEDGER_OP_RING_MAX; i++) {
        const bucket = getAt(tree, [M, month()]);
        const token = 'op_churn' + String(i).padStart(6, '0');
        tree = setAt(tree, [M, month()], { ...bucket, op: token, ops: ledgerOpRing(bucket, token) }) || {};
    }
    docSeq.set(M + '/' + month(), ++seq);
}

function applyOps(ops: any[]) {
    let draft = copy(tree);
    const touched = new Set<string>();
    for (const op of ops) {
        const p = op.p as string[];
        if (op.k === 'cas') {
            const current = getAt(draft, p);
            if (canonicalJson(current) !== canonicalJson(op.x === undefined ? null : op.x)) return { conflict: true, value: current };
            draft = setAt(draft, p, op.v) || {};
        } else if (op.k === 'inc') {
            const current = getAt(draft, p);
            draft = setAt(draft, p, (typeof current === 'number' ? current : 0) + op.d) || {};
        } else draft = setAt(draft, p, op.v) || {};
        if (p.length === 1) for (const key of new Set([...Object.keys(tree[p[0]] || {}), ...Object.keys(draft[p[0]] || {})])) touched.add(p[0] + '/' + key);
        else touched.add(p[0] + '/' + p[1]);
    }
    const commit = ops.find((op) => op.p[0] === OPS && op.p.length === 2 && op.v?.phase === 'committed');
    if (commit && !(Number(getAt(draft, [M, commit.v.month, 'ops', commit.v.monthToken])) >= 1)) throw new SbRpcError('permission_denied', '42501', 403, '');
    tree = draft;
    seq++;
    for (const key of touched) docSeq.set(key, seq);
    if (!churned && ops.some((op) => op.k === 'cas' && op.p[0] === H && op.v?.scanPending)) { churned = true; churnMonth(); }
    return { ok: true, seq, now: Date.now(), docs: [...touched].map((key) => docOf(key.split('/')[0], key.split('/')[1])) };
}

function engine() {
    return { subscribe: () => () => {}, ping: async () => true, rpc: async (fn: string, args: any) => {
        if (fn === 'zoe_now') return Date.now();
        if (fn === 'zoe_pull') {
            const out: any[] = [];
            for (const r of Object.keys(tree)) for (const k of Object.keys(tree[r] || {})) out.push(docOf(r, k));
            return { seq, more: false, reset: true, tenant: 'A', now: Date.now(), rows: out };
        }
        if (fn === 'zoe_read') {
            const keys = args.p_key ? [args.p_key] : Object.keys(tree[args.p_root] || {});
            return { now: Date.now(), docs: keys.filter((k) => tree[args.p_root]?.[k] !== undefined).map((k) => docOf(args.p_root, k)) };
        }
        if (fn !== 'zoe_write_v2') throw new Error('Unexpected RPC ' + fn);
        expect.soft(args.p_expected_tenant).toBe('A');
        sendLog.push(args.p_op_id);
        const monthCas = args.p_ops.length === 1 && args.p_ops[0].k === 'cas' && args.p_ops[0].p.length === 1 && args.p_ops[0].p[0] === M;
        if (monthCas && !monthCasIds.includes(args.p_op_id)) monthCasIds.push(args.p_op_id);
        const faulted = plan.lost && monthCas && monthCasIds.indexOf(args.p_op_id) === (plan.index ?? 1);
        if (faulted && faultedSends++ > 0) {
            if (plan.then === 'pt401') throw new SbRpcError('session-revoked', 'PT401', 401, '');
            if (plan.then === '42501') throw new SbRpcError('forbidden', '42501', 403, '');
            throw new SbNetworkError('rpc timed out');
        }
        if (replies.has(args.p_op_id)) return { ...replies.get(args.p_op_id), replayed: true };
        if (faulted) {
            faultedOps = copy(args.p_ops);
            if (plan.lost === 'after') { const applied = applyOps(args.p_ops); if (applied.ok) replies.set(args.p_op_id, applied); }
            throw new SbNetworkError('rpc timed out');
        }
        const result = applyOps(args.p_ops);
        if (result.ok) replies.set(args.p_op_id, result);
        else return { ok: false, conflict: true, now: Date.now(), value: result.value };
        return result;
    } };
}

async function until(condition: () => boolean, label: string) {
    for (let i = 0; i < 400; i++) { if (condition()) return; await realDelay(5); }
    throw new Error('Condition not reached: ' + label);
}

async function openSession() {
    const hook = { onListenerError: vi.fn(), onSynced: vi.fn(), onForbidden: vi.fn(), onTxOutcomeUnknown: vi.fn() };
    const journal = { put: (row: any) => { rows.set(row.opId, copy(row)); return true; },
        list: (scope: string, topic: string) => [...rows.values()].filter((row) => row.scope === scope && row.topic === topic).map(copy),
        remove: (_scope: string, _topic: string, id: string) => { rows.delete(id); return true; } };
    const db: any = createSupabaseDatabase(engine(), hook, { writeJournal: journal, retryStepsMs: [5], pollFallbackMs: 600000 });
    const sdk: any = { __supabase: true, tenantScope: () => 'A', ref: (d: any, path?: string) => d.ref(path), get: (ref: any) => ref._db.get(ref),
        set: (ref: any, value: any) => ref._db.set(ref, value), update: (ref: any, values: any) => ref._db.update(ref, values),
        runTransaction: (ref: any, fn: any) => ref._db.runTransaction(ref, fn), increment: (delta: number) => new SbIncrement(delta) };
    const auth = { app: { options: { supabaseUrl: URL } }, currentUser: { uid: 'scan-owner' } };
    firebaseState.authGeneration++;
    Object.assign(firebaseState, { fb: sdk, db, auth, firebaseConfig: { supabaseUrl: URL }, isDatabaseInitialized: true, isInitializingFirebase: false,
        firebaseSdkUnavailable: false, isDatabaseConnected: true, serverClockTrusted: true, sessionExpiryCheck: 'live', authLoginOperation: null,
        dbRefHistory: db.ref(H), dbRefDailyRevenue: db.ref(D), dbRefMonthlyRevenue: db.ref(M) });
    db.setTenantTopic(TOPIC); db.setAuthed(true, SCOPE);
    await until(() => db.isReady() && !db.recoveryState().recovering, 'session ready');
    const session = { db, hook };
    sessions.push(session);
    return session;
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(NOW);
    vi.stubGlobal('crypto', webcrypto);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    localStorage.clear(); pendingRegistryReleases.clear(); clearZtoPickupStatusStore();
    dbListenerFailedPaths.clear(); dbListenerPendingPaths.clear();
    localStorage.setItem('zoew_firebase_config', JSON.stringify({ supabaseUrl: URL, supabaseKey: 'sb_publishable_fixture' }));
    const ring = { op_seed_month01: 1 };
    tree = { [D]: { [day()]: { codDollar: 10, dodDollar: 0, totalCount: 1 } },
        [M]: { [month()]: { codDollar: 10, dodDollar: 0, totalCount: 1, op: 'op_seed_month01', ops: ring } }, [R]: { EXISTING0001: true } };
    seq = 1; docSeq.clear(); replies.clear(); plan = {}; monthCasIds = []; sendLog = []; faultedOps = null; faultedSends = 0; churned = false;
    rows = new Map(); sessions = [];
    dataState.scanHistory = []; dataState.deletedItems = [];
    dataState.dailyRevenueData = copy(tree[D]); dataState.monthlyRevenueData = copy(tree[M]);
    dataState.dailyCollectedData = {}; dataState.dailyPickupData = {};
    scanState.pendingBarcode = ''; scanState.pendingScanSession = null;
    viewState.phoneModalBusy = false; uiState.modalDisplay = {}; uiState.isModalOpen = false; uiState.toasts = [];
    ztoState.ztoListSyncInFlight = false; ztoState.ztoListSyncResult = null;
    (window as any).ZoeErrors = { capture: vi.fn() };
});

afterEach(() => {
    for (const session of sessions) session.db.close('test');
    firebaseState.authGeneration++;
    vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers();
    delete (window as any).ZoeErrors;
});

async function firstSession(next: Plan) {
    const session = await openSession();
    const handle = preparePendingScan(CODE, 1, 0, NOW, 'direct', 2);
    expect(await claimScanOperation(handle, CODE)).toBe('claimed');
    plan = next;
    const saving = saveScanOperation(handle, '0915550001', 'N/A', 0);
    if (next.then === 'close') {
        await until(() => faultedSends >= 2, 'the faulted month CAS was resent');
        session.db.close('test');
    }
    const saved = await saving;
    return { saved, unknownReported: session.hook.onTxOutcomeUnknown.mock.calls.length, left: journalRows().map((row) => row.stage),
        moneyAfterFirst: money(), staged: !!Object.values(tree[H] || {}).some((row: any) => row?.scanPending?.code === CODE) };
}

async function secondSession() {
    plan = {};
    const session = await openSession();
    await resumePendingScanOperations();
    const later = await session.db.set(session.db.ref('zoew_settings/exchange_rate'), 4200).then(() => 'sent', (e: any) => e.code || e.message);
    const operation: any = Object.values(tree[OPS] || {})[0];
    return { blocked: session.db.recoveryState().blocked, later, phase: operation?.phase, money: money(), evidence: evidence().length, rows: journalRows().length,
        registryOwned: getAt(tree, [R, CODE])?.intent === operation?.id };
}

const BEFORE = [[10, 0, 1], [10, 0, 1]];
const ONCE = [[11, 0, 2], [11, 0, 2]];

it.each([
    ['after', 'pt401'], ['before', 'pt401'], ['after', '42501'], ['before', '42501']
] as const)('finalize re-prepares an evicted month token ៖ its CAS loses the reply (landed: %s), then the resend is refused (%s) ➜ the row is dropped like Firebase (never HOLD) · the next session commits the scan exactly once', async (lost, then) => {
    const first = await firstSession({ lost, then });
    expect(first).toEqual({ saved: 'unknown', unknownReported: 1, left: [], moneyAfterFirst: BEFORE, staged: true });
    expect(await secondSession()).toEqual({ blocked: 0, later: 'sent', phase: 'committed', money: ONCE, evidence: 0, rows: 0, registryOwned: true });
});

it.each([
    ['a new month bucket', false], ['a new month bucket that prunes the oldest kept month', true]
] as const)('save ៖ the first month-token CAS creates %s, loses its reply, then the resend is refused ➜ dropped (never HOLD) · the next session cancels the unstaged scan without money and releases its barcode', async (_name, prune) => {
    const old = (key: string, n: number) => ({ codDollar: n, dodDollar: 0, totalCount: 1, op: 'op_seed_old' + n + '0000', ops: { ['op_seed_old' + n + '0000']: 1 } });
    tree[M] = prune ? { '2026-08': old('2026-08', 3), '2026-09': old('2026-09', 4), '2026-10': old('2026-10', 5) } : { '2026-10': old('2026-10', 5) };
    const first = await firstSession({ lost: 'after', then: 'pt401', index: 0 });
    expect(faultedOps[0].v[month()]).toMatchObject({ codDollar: 0, dodDollar: 0, totalCount: 0, op: expect.stringMatching(/^op_m/) });
    expect(Object.keys(faultedOps[0].v).sort()).toEqual(prune ? ['2026-09', '2026-10', month()] : ['2026-10', month()]);
    expect(first).toEqual({ saved: 'unknown', unknownReported: 1, left: [], moneyAfterFirst: [[10, 0, 1], [0, 0, 0]], staged: false });
    const second = await secondSession();
    expect(second).toEqual({ blocked: 0, later: 'sent', phase: 'cancelled', money: [[10, 0, 1], [0, 0, 0]], evidence: 0, rows: 0, registryOwned: false });
    expect(getAt(tree, [R, CODE])).toBeNull();
});

const now = NOW;
const shapes: Record<string, (row: any) => any> = {
    'v2 row sent past the replay window': (row) => ({ ...row, stage: 'sent', uncertain: true, sentAfter: now - SB_OP_REPLAY_SAFE_MS - 60000 }),
    'v2 row left by a sign-out past the replay window': (row) => ({ ...row, stage: 'cancelled', uncertain: true, sentAfter: now - SB_OP_REPLAY_SAFE_MS - 60000 }),
    'v2 row left unresolved': (row) => ({ ...row, stage: 'unresolved', uncertain: true }),
    'legacy row (no writeProtocol, as 2.50.179 wrote it) sent': (row) => { const legacy = { ...row, stage: 'sent', uncertain: true }; delete legacy.writeProtocol; return legacy; },
    'legacy row (no writeProtocol) sent past the replay window': (row) => { const legacy = { ...row, stage: 'sent', uncertain: true, sentAfter: now - SB_OP_REPLAY_SAFE_MS - 60000 }; delete legacy.writeProtocol; return legacy; }
};

it.each(Object.keys(shapes).flatMap((shape) => (['after', 'before'] as const).map((lost) => [shape, lost])))('boot ៖ the real month-token CAS row, %s (landed: %s) ➜ dropped without a replay · the scan commits exactly once', async (shape, lost) => {
    const first = await firstSession({ lost: lost as any, then: 'close' });
    expect(first).toMatchObject({ saved: 'unknown', moneyAfterFirst: BEFORE, staged: true });
    const kept = journalRows();
    expect(kept, 'the closed session leaves the real month-token CAS row').toHaveLength(1);
    expect(kept[0].ops).toEqual(faultedOps);
    rows.set(kept[0].opId, shapes[shape](kept[0]));
    const sentBefore = sendLog.length;
    const second = await secondSession();
    expect({ ...second, replayedOldRow: sendLog.slice(sentBefore).includes(kept[0].opId) }).toEqual({ blocked: 0, later: 'sent', phase: 'committed', money: ONCE, evidence: 0, rows: 0,
        registryOwned: true, replayedOldRow: false });
});

it.each(['after', 'before'] as const)('control ៖ the same row sent inside the replay window replays once with its own op_id (plain CAS rule) · the scan commits exactly once (landed: %s)', async (lost) => {
    await firstSession({ lost, then: 'close' });
    const kept = journalRows();
    expect(kept).toHaveLength(1);
    expect(kept[0]).toMatchObject({ stage: 'sent', uncertain: true });
    expect(await secondSession()).toEqual({ blocked: 0, later: 'sent', phase: 'committed', money: ONCE, evidence: 0, rows: 0, registryOwned: true });
});

it('control ៖ a monthly ledger CAS that moves money (no intent, as an older client wrote it) still holds the shop', async () => {
    const session = await openSession();
    const base = copy(tree[M]);
    const moved = { [month()]: { ...base[month()], codDollar: 15, totalCount: 2, op: 'op_ledger_move01', ops: ledgerOpRing(base[month()], 'op_ledger_move01') } };
    session.db.close('test');
    rows.set('operation_monthmove01', { v: 1, scope: SCOPE, topic: TOPIC, opId: 'operation_monthmove01', queuedAt: now - 5000, stage: 'sent', uncertain: true,
        sentAfter: now - SB_OP_REPLAY_SAFE_MS - 60000, ops: [{ k: 'cas', p: [M], x: base, v: moved }] });
    const next = await openSession();
    const later = await next.db.set(next.db.ref('zoew_settings/exchange_rate'), 4200).then(() => 'sent', (e: any) => e.code || e.message);
    expect({ blocked: next.db.recoveryState().blocked, later, rows: journalRows().length, money: money() }).toEqual({ blocked: 1, later: 'WRITE_RECOVERY_PENDING', rows: 1, money: BEFORE });
});
