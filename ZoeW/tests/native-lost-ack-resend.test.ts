// A Firebase `set`/`update` goes out as one root update carrying its receipt (`zoew_write_receipts/<opId>`, create-once in the rules).
// When the server applies it but the acknowledgement is lost, the real SDK sends the same update again after reconnecting; the
// rules refuse that second copy (`permission_denied`) because the receipt now exists. That refusal says nothing about the first copy:
// the write is applied when the receipt on the server is ours (uid + payload hash). Deep audit 9 proved it on the real SDK + emulator
// (scan saved on the server, ledger reverted, registry key released). Only an absent receipt is a refusal.
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { firebaseState } from '../src/core/state';
import { withTransactionOutcomeResolution } from '../src/services/tx-outcome';
import { nativeWriteRecoveryState } from '../src/services/native-write-recovery';
import { dbListenerPendingPaths } from '../src/core/text';

const host = 'https://shop.firebaseio.com';
const records = () => Object.keys(localStorage).filter(k => k.startsWith('zoew_connection_writes_v1:')).map(k => JSON.parse(localStorage.getItem(k)!));
beforeEach(() => { localStorage.clear(); dbListenerPendingPaths.clear(); firebaseState.authGeneration++; vi.stubGlobal('navigator', { onLine: true }); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function lab(update: any) {
    const app = { options: { databaseURL: host } };
    const auth = { app, currentUser: { uid: 'A', getIdToken: async () => 'fake-token' } };
    const db = { app };
    const raw = { getAuth: () => auth, getDatabase: () => db, ref: (_db: any, path = '') => ({ toString: () => host + '/' + path }),
        update, set: update, runTransaction: vi.fn(), deleteApp: async () => {} };
    const sdk = withTransactionOutcomeResolution(raw); sdk.getAuth(app); sdk.getDatabase(app);
    Object.assign(firebaseState, { firebaseConfig: app.options, fb: sdk, auth, db, isDatabaseInitialized: true,
        isInitializingFirebase: false, firebaseSdkUnavailable: false, isDatabaseConnected: true, sessionExpiryCheck: 'live', authLoginOperation: null });
    return { sdk, db };
}
const verdictOf = (p: Promise<any>) => p.then(() => 'sent', (e: any) => e.code || e.message);
const denied = () => Object.assign(new Error('permission_denied'), { code: 'PERMISSION_DENIED' });

// The server keeps what the first copy wrote; `fetch` answers REST reads of it (the outcome reader's path).
function server() {
    const tree: Record<string, any> = {};
    vi.stubGlobal('fetch', vi.fn(async (input: any) => {
        const path = decodeURIComponent(new URL(String(input)).pathname.replace(/^\//, '').replace(/\.json$/, ''));
        return Response.json(path in tree ? tree[path] : null);
    }));
    return tree;
}
const rowOf = (phone: string) => ({ id: 'row1', phone, barcodes: [{ code: 'Z1', cod: 6, dod: 0 }] });

it('a lost acknowledgement whose resend the receipt rule refuses ➜ the write counts as applied (our receipt is on the server)', async () => {
    const tree = server();
    const native = lab(vi.fn(async (_ref: any, value: any) => {
        for (const [path, v] of Object.entries(value)) tree[path] = path.startsWith('zoew_write_receipts/') ? { ...(v as any), at: 1 } : v;
        throw denied();
    }));
    const verdict = await verdictOf(native.sdk.update(native.sdk.ref(native.db, 'zoew_scan_history_cod_dod'), { row1: rowOf('012000111') }));
    expect({ verdict, rows: records().length, blocked: nativeWriteRecoveryState(native.db).blocked, onServer: tree['zoew_scan_history_cod_dod/row1']?.phone })
        .toEqual({ verdict: 'sent', rows: 0, blocked: 0, onServer: '012000111' });
});

it('control ៖ rules that refuse the receipt (nothing applied) ➜ refused · row dropped · nothing blocked', async () => {
    server();
    const native = lab(vi.fn(async () => { throw denied(); }));
    const verdict = await verdictOf(native.sdk.update(native.sdk.ref(native.db, 'zoew_scan_history_cod_dod'), { row1: rowOf('012000111') }));
    expect({ verdict, rows: records().length, blocked: nativeWriteRecoveryState(native.db).blocked }).toEqual({ verdict: 'PERMISSION_DENIED', rows: 0, blocked: 0 });
});

it('control ៖ a receipt of another payload under the same id is never ours ➜ refused', async () => {
    const tree = server();
    const native = lab(vi.fn(async (_ref: any, value: any) => {
        for (const path of Object.keys(value)) if (path.startsWith('zoew_write_receipts/')) tree[path] = { uid: 'A', at: 1, hash: 'f'.repeat(64) };
        throw denied();
    }));
    const verdict = await verdictOf(native.sdk.update(native.sdk.ref(native.db, 'zoew_scan_history_cod_dod'), { row1: rowOf('012000111') }));
    expect({ verdict, rows: records().length }).toEqual({ verdict: 'PERMISSION_DENIED', rows: 0 });
});

it('a refusal whose receipt read fails on the network ➜ outcome unknown · the row stays for recovery (never a refusal that rolls back an applied write)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    const native = lab(vi.fn(async () => { throw denied(); }));
    const failure = await native.sdk.update(native.sdk.ref(native.db, 'zoew_scan_history_cod_dod'), { row1: rowOf('012000111') }).then(() => null, (e: any) => e);
    expect({ code: failure?.code, txOutcome: failure?.txOutcome, rows: records().length }).toEqual({ code: 'write_outcome_unknown', txOutcome: 'unknown', rows: 1 });
});
