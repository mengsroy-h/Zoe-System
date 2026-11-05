import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { scanTransportIntent, scanTransportReceipt } from '../src/domain/scan-transport-proof';
import { SCAN_OPERATIONS_ROOT, SCAN_PENDING_ROOT, scanRegistryOwner } from '../src/domain/scan-protocol';
import { firebaseState } from '../src/core/state';
import { withTransactionOutcomeResolution } from '../src/services/tx-outcome';
import { createLocalWriteJournal } from '../src/services/write-journal';
import { nativeWriteRecoveryState } from '../src/services/native-write-recovery';
import { createSupabaseDatabase } from '../src/services/supabase-rtdb';

const host = 'https://scan-proof.firebaseio.com';
const id = 'scan_' + 'a'.repeat(32);
const operation = { v: 2, id, actorUid: 'user', scope: host, code: 'SCAN0001', registryKey: 'SCAN0001', birth: 1792800000000,
    scanDate: '2026-10-24', month: '2026-10', cod: 5, dod: 0.29, count: 1, monthToken: 'op_m' + 'a'.repeat(32),
    phase: 'committed', targetId: 'row1', payloadHash: 'b'.repeat(64), phone: '012345678', locker: 'A1', closedAt: 0 };
const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const set = (path: string, value: any) => ({ k: 'set', p: path.split('/'), v: value });
const turn = async () => { for (let i = 0; i < 100; i++) await Promise.resolve(); };

function finalOps(native = false): any[] {
    const ops: any[] = [set(SCAN_OPERATIONS_ROOT + '/' + id, copy(operation)), set(SCAN_PENDING_ROOT + '/' + id, null),
        set('zoew_scan_history_cod_dod/row1/scanPending', null), set('zoew_barcode_registry/SCAN0001', scanRegistryOwner(operation as any))];
    for (const root of ['zoew_daily_revenue_cod_dod/2026-10-24', 'zoew_monthly_revenue_cod_dod/2026-10']) {
        for (const [field, delta] of [['codDollar', 5], ['dodDollar', 0.29], ['totalCount', 1]] as const) {
            ops.push(native ? set(root + '/' + field, { '.sv': { increment: delta } }) : { k: 'inc', p: (root + '/' + field).split('/'), d: delta });
        }
    }
    return ops;
}

beforeEach(() => { localStorage.clear(); firebaseState.authGeneration++; vi.stubGlobal('crypto', webcrypto); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it.each([false, true])('receipt ផ្ទៀង payload ពេញលេញ មិនពឹងលើអាយុ transport ឬ history បច្ចុប្បន្ន native=%s', native => {
    const intent = scanTransportIntent(finalOps(native));
    expect(intent?.kind).toBe('finalize');
    expect(scanTransportReceipt(intent, copy(operation), 'user')).toBe('applied');
});

it.each(['extra', 'missing', 'duplicate', 'delta', 'date', 'owner', 'birth', 'hash', 'phase', 'kind'])('payload/receipt %s ខុស ត្រូវ HOLD មិនបាត់ journal', fault => {
    const ops = finalOps(); const receipt: any = copy(operation);
    if (fault === 'extra') ops.push(set('zoew_settings/exchange_rate', 1));
    if (fault === 'missing') ops.pop();
    if (fault === 'duplicate') ops[9] = copy(ops[8]);
    if (fault === 'delta') ops[4].d++;
    if (fault === 'date') ops[4].p[1] = '2026-10-25';
    if (fault === 'owner') receipt.actorUid = 'other';
    if (fault === 'birth') receipt.birth++;
    if (fault === 'hash') receipt.payloadHash = 'c'.repeat(64);
    if (fault === 'phase') receipt.phase = 'prepared';
    if (fault === 'kind') ops[4].k = 'cas';
    expect(scanTransportReceipt(scanTransportIntent(ops), receipt, 'user')).toBeNull();
});

it('admission មាន successor ស្របច្បាប់ ប៉ុន្តែ cancel ដែលចាញ់ committed មិនត្រូវហៅថា applied', () => {
    const admitted: any = { ...operation, phase: 'admitted' };
    for (const key of ['targetId', 'payloadHash', 'phone', 'locker', 'closedAt']) delete admitted[key];
    const admit = scanTransportIntent([set(SCAN_OPERATIONS_ROOT + '/' + id, admitted), set(SCAN_PENDING_ROOT + '/' + id, 'user')]);
    expect(scanTransportReceipt(admit, operation, 'user')).toBe('applied');
    const cancel = scanTransportIntent([set(SCAN_OPERATIONS_ROOT + '/' + id, { ...operation, phase: 'cancelled' }), set(SCAN_PENDING_ROOT + '/' + id, null)]);
    expect(scanTransportReceipt(cancel, operation, 'user')).toBe('superseded');
    expect(scanTransportReceipt(cancel, { ...operation, phase: 'prepared' }, 'user')).toBeNull();
});

it.each(['targetId', 'payloadHash', 'phone', 'locker', 'closedAt'])('cancel មាន prepared tuple ខុស %s មិនអាចលាក់ transport row', field => {
    const request: any = { ...operation, phase: 'cancelled' };
    request[field] = field === 'closedAt' ? 1 : field === 'payloadHash' ? 'c'.repeat(64) : 'other';
    const intent = scanTransportIntent([set(SCAN_OPERATIONS_ROOT + '/' + id, request), set(SCAN_PENDING_ROOT + '/' + id, null)]);
    expect(intent).not.toBeNull();
    expect(scanTransportReceipt(intent, operation, 'user')).toBeNull();
});

it('key ដែលមិនមែន canonical ទោះ receipt និង payload ដូចគ្នា ក៏មិនអាចលាក់ journal', () => {
    const ops = finalOps();
    ops[0].v.registryKey = 'OTHER';
    ops[3].p[1] = 'OTHER';
    expect(scanTransportIntent(ops)).toBeNull();
});

for (const mode of ['receipt', 'absent', 'foreign', 'extra']) it('native restart លើស២ថ្ងៃ ' + mode + ' មិន replay increment', async () => {
    const ops = finalOps(true);
    if (mode === 'extra') ops.push(set('zoew_settings/exchange_rate', 1));
    const hash = Array.from(new Uint8Array(await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(ops)))), n => n.toString(16).padStart(2, '0')).join('');
    const journal = createLocalWriteJournal(); const scope = host + '/|user';
    journal.put({ v: 1, scope, topic: 'firebase', opId: 'operation_scan_final', ops, hash, stage: 'sent', sentAfter: 1, queuedAt: Date.now() - 3 * 86400000 });
    const receipt = mode === 'absent' ? null : { ...operation, actorUid: mode === 'foreign' ? 'other' : 'user' };
    vi.stubGlobal('fetch', async (url: any) => Response.json(String(url).includes(SCAN_OPERATIONS_ROOT) ? receipt : null));
    const app = { options: { databaseURL: host } }; const db = { app };
    const auth = { app, currentUser: { uid: 'user', getIdToken: async () => 'fixture' } };
    const sent = vi.fn(async () => {});
    const raw = { getAuth: () => auth, getDatabase: () => db, ref: (_db: any, path = '') => ({ toString: () => host + '/' + path }),
        update: sent, set: sent, runTransaction: vi.fn(), deleteApp: async () => {}, get: async () => ({ val: () => null }) };
    const sdk = withTransactionOutcomeResolution(raw); sdk.getAuth(app); sdk.getDatabase(app);
    Object.assign(firebaseState, { firebaseConfig: app.options, fb: sdk, auth, db, isDatabaseInitialized: true,
        isInitializingFirebase: false, firebaseSdkUnavailable: false, isDatabaseConnected: true, sessionExpiryCheck: 'live', authLoginOperation: null });
    try {
        const verdict = await sdk.set(sdk.ref(db, 'zoew_settings/exchange_rate'), 4200).then(() => 'sent', (error: any) => error.code);
        const proven = mode === 'receipt';
        expect(verdict).toBe(proven ? 'sent' : 'write_recovery_pending');
        expect(sent).toHaveBeenCalledTimes(proven ? 1 : 0);
        expect(journal.list(scope, 'firebase')).toHaveLength(proven ? 0 : 1);
        expect(nativeWriteRecoveryState(db).blocked).toBe(proven ? 0 : 1);
    } finally { await sdk.deleteApp(app); }
});

for (const mode of ['receipt', 'absent', 'foreign', 'extra', 'legacy']) it('Supabase restart លើស២៤ម៉ោង ' + mode + ' មិន replay increment', async () => {
    const ops = finalOps();
    if (mode === 'extra') ops.push(set('zoew_settings/exchange_rate', 1));
    const journal = createLocalWriteJournal();
    journal.put({ v: 1, ...(mode === 'legacy' ? {} : { writeProtocol: 2 }), scope: 'project|user', topic: 'zoe:A', opId: 'operation_scan_final', ops, stage: 'unresolved',
        sentAfter: Date.now() - 3 * 86400000, queuedAt: Date.now() - 3 * 86400000 });
    const writes: any[] = [];
    const calls: string[] = [];
    const receipt = mode === 'absent' ? null : { ...operation, actorUid: mode === 'foreign' ? 'other' : 'user' };
    const db = createSupabaseDatabase({ subscribe: () => () => {}, rpc: async (fn: string, args: any) => {
        calls.push(fn);
        if (fn === 'zoe_now') return Date.now();
        if (fn === 'zoe_read') return { docs: receipt ? [{ k: id, v: receipt, s: 1 }] : [], now: Date.now() };
        if (fn === 'zoe_write_v2') { expect.soft(args.p_expected_tenant).toBe('A'); writes.push(args); return { ok: true, docs: [], now: Date.now() }; }
        return { seq: 1, more: false, reset: true, tenant: 'A', now: Date.now(), rows: [] };
    } }, { onListenerError: vi.fn(), onSynced: vi.fn(), onForbidden: vi.fn(), onTxOutcomeUnknown: vi.fn() }, { writeJournal: journal });
    try {
        db.setTenantTopic('zoe:A'); db.setAuthed(true, 'project|user'); await turn();
        const verdict = await db.set(db.ref('zoew_settings/exchange_rate'), 4200).then(() => 'sent', (error: any) => error.code);
        const proven = mode === 'receipt';
        expect(verdict).toBe(proven ? 'sent' : 'WRITE_RECOVERY_PENDING');
        expect(writes).toHaveLength(proven ? 1 : 0);
        expect(calls).not.toContain('zoe_write');
        if (mode === 'legacy') expect(calls.filter(fn => fn.startsWith('zoe_write') || fn === 'zoe_read')).toEqual([]);
        expect(journal.list('project|user', 'zoe:A')).toHaveLength(proven ? 0 : 1);
        expect(db.recoveryState().blocked).toBe(proven ? 0 : 1);
    } finally { db.close('test'); }
});
