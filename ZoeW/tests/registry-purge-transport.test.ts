import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { REGISTRY_RELEASES_ROOT, registryPurgeIntent, registryPurgeReceiptMatches } from '../src/domain/registry-purge-proof';
import { firebaseState } from '../src/core/state';
import { withTransactionOutcomeResolution } from '../src/services/tx-outcome';
import { createLocalWriteJournal } from '../src/services/write-journal';
import { nativeWriteRecoveryState } from '../src/services/native-write-recovery';
import { createSupabaseDatabase } from '../src/services/supabase-rtdb';

const host = 'https://purge-proof.firebaseio.com';
const ids = ['scan_' + 'a'.repeat(32), 'release_' + 'b'.repeat(32)];
const receipts = ids.map((id, index) => ({ v: 1, id, kind: index === 0 ? 'scan' : 'legacy', actorUid: index === 0 ? 'scanner' : 'user',
    releasedBy: 'user', scope: host, code: 'PURGE' + index, registryKey: 'PURGE' + index, birth: index === 0 ? 1000 : 0,
    trashId: 'trash1', slot: String(index), deletedAt: 2000, rowBirth: 900, rowCount: 2 }));
const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const set = (path: string, value: any) => ({ k: 'set', p: path.split('/'), v: value });
const turn = async () => { for (let i = 0; i < 100; i++) await Promise.resolve(); };
const operations = () => [set('zoew_recently_deleted_cod_dod/trash1', null), ...receipts.flatMap(receipt => [
    set(REGISTRY_RELEASES_ROOT + '/' + receipt.id, copy(receipt)), set('zoew_barcode_registry/' + receipt.registryKey, null)])];
const actualReceipt = (id: string, mode: string) => {
    const index = ids.indexOf(id);
    if (index < 0 || mode === 'absent' || mode === 'partial' && index === 1) return null;
    const receipt = copy(receipts[index]);
    if (mode === 'foreign') receipt.releasedBy = 'other';
    if (mode === 'source') receipt.trashId = 'other';
    if (mode === 'birth') receipt.birth++;
    return receipt;
};
beforeEach(() => { localStorage.clear(); firebaseState.authGeneration++; vi.stubGlobal('crypto', webcrypto); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('purge payload ពេញលេញ mixed legacy/v2 ទើបអាចផ្ទៀង receipt ទាំងអស់', () => {
    const intent = registryPurgeIntent(operations());
    expect(intent?.sourceId).toBe('trash1'); expect(intent?.receipts).toHaveLength(2);
    expect(intent?.receipts.every(expected => registryPurgeReceiptMatches(expected, receipts.find(receipt => receipt.id === expected.id)))).toBe(true);
});

it.each(['extra', 'missing', 'duplicate', 'source', 'key', 'field', 'kind', 'birth'])('purge payload %s ខុស ត្រូវ HOLD', fault => {
    const ops = operations();
    if (fault === 'extra') ops.push(set('zoew_settings/exchange_rate', 1));
    if (fault === 'missing') ops.pop();
    if (fault === 'duplicate') ops[4] = copy(ops[2]);
    if (fault === 'source') ops[0].p[1] = 'other';
    if (fault === 'key') { (ops[1].v as any).registryKey = 'OTHER'; ops[2].p[1] = 'OTHER'; }
    if (fault === 'field') (ops[1].v as any).extra = true;
    if (fault === 'kind') (ops[2] as any).k = 'cas';
    if (fault === 'birth') (ops[1].v as any).birth = 0;
    expect(registryPurgeIntent(ops)).toBeNull();
});

for (const mode of ['receipt', 'absent', 'partial', 'foreign', 'source', 'birth', 'extra', 'hash']) it('native purge restart លើស២ថ្ងៃ ' + mode + ' ផ្ទៀង receipt ដោយមិនលុប claim ថ្មី', async () => {
    const ops = operations(); if (mode === 'extra') ops.push(set('zoew_settings/exchange_rate', 1));
    const hash = Array.from(new Uint8Array(await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(ops)))), value => value.toString(16).padStart(2, '0')).join('');
    const journal = createLocalWriteJournal(), scope = host + '/|user';
    journal.put({ v: 1, scope, topic: 'firebase', opId: 'operation_purge_complete', ops, hash: mode === 'hash' ? '0'.repeat(64) : hash,
        stage: 'sent', sentAfter: 1, queuedAt: Date.now() - 3 * 86400000 });
    vi.stubGlobal('fetch', async (url: any) => {
        const path = new URL(String(url)).pathname.replace(/^\//, '').replace(/\.json$/, '').split('/');
        return Response.json(path[0] === REGISTRY_RELEASES_ROOT ? actualReceipt(path[1], mode) : null);
    });
    const app = { options: { databaseURL: host } }, db = { app };
    const auth = { app, currentUser: { uid: 'user', getIdToken: async () => 'fixture' } };
    const sent = vi.fn(async (_ref: unknown, _patch: Record<string, unknown>) => {});
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
        if (proven) expect(Object.keys(sent.mock.calls[0][1])).not.toContain('zoew_barcode_registry/PURGE0');
    } finally { await sdk.deleteApp(app); }
});

for (const mode of ['receipt', 'absent', 'partial', 'foreign', 'source', 'birth', 'extra', 'tenant']) it('Supabase purge restart លើស២៤ម៉ោង ' + mode + ' មិន replay registry null', async () => {
    const ops = operations(); if (mode === 'extra') ops.push(set('zoew_settings/exchange_rate', 1));
    const journal = createLocalWriteJournal(), topic = mode === 'tenant' ? 'zoe:OLD' : 'zoe:A';
    journal.put({ v: 1, scope: 'project|user', topic, opId: 'operation_purge_complete', ops, stage: 'unresolved',
        sentAfter: Date.now() - 3 * 86400000, queuedAt: Date.now() - 3 * 86400000 });
    const writes: any[] = [];
    const db = createSupabaseDatabase({ subscribe: () => () => {}, rpc: async (fn: string, args: any) => {
        if (fn === 'zoe_now') return Date.now();
        if (fn === 'zoe_read') { const receipt = actualReceipt(args.p_key, mode); return { docs: receipt ? [{ k: args.p_key, v: receipt, s: 1 }] : [], now: Date.now() }; }
        if (fn === 'zoe_write') { writes.push(args); return { ok: true, docs: [], now: Date.now() }; }
        return { seq: 1, more: false, reset: true, tenant: 'A', now: Date.now(), rows: [] };
    } }, { onListenerError: vi.fn(), onSynced: vi.fn(), onForbidden: vi.fn(), onTxOutcomeUnknown: vi.fn() }, { writeJournal: journal });
    try {
        db.setTenantTopic('zoe:A'); db.setAuthed(true, 'project|user'); await turn();
        const verdict = await db.set(db.ref('zoew_settings/exchange_rate'), 4200).then(() => 'sent', (error: any) => error.code);
        const proven = mode === 'receipt';
        expect(verdict).toBe(proven || mode === 'tenant' ? 'sent' : 'WRITE_RECOVERY_PENDING');
        expect(writes).toHaveLength(proven || mode === 'tenant' ? 1 : 0);
        expect(journal.list('project|user', topic)).toHaveLength(proven ? 0 : 1);
        if (writes.length) expect(writes[0].p_ops.some(op => op.p[0] === 'zoew_barcode_registry')).toBe(false);
    } finally { db.close('test'); }
});
