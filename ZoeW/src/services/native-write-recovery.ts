import { createLocalWriteJournal } from './write-journal';
import { txReadServerValue, txRestUrl, txSameValue } from './tx-outcome';
import { ledgerJournalRecord, ledgerJournalUpdate, ledgerJournalWitness } from '../domain/ledger';
import { txMutationSources } from './tx-disconnect';

const nativeRecoveryStates = new WeakMap<object, any>();
export const NATIVE_WRITE_RECEIPTS = 'zoew_write_receipts';

export function nativeWriteRecoveryState(db) {
    return db && nativeRecoveryStates.get(db) || { blocked: 0, recovering: false };
}

export function createNativeWriteRecovery(sdk, auth, db, current, report, leaseFactory) {
    const journal = createLocalWriteJournal();
    const uid = auth.currentUser && auth.currentUser.uid;
    const root = sdk.ref(db);
    const scope = String(root) + '|' + uid;
    const topic = 'firebase';
    const state = { blocked: 0, recovering: true, external: 0 };
    const externalRows = [];
    nativeRecoveryStates.set(db, state);
    const changed = () => { if (current()) report(); };
    const remove = (id) => journal.remove(scope, topic, id);
    const read = async (path) => {
        if (!current()) throw new Error('Connection session changed');
        const ref = sdk.ref(db, path);
        const result = await txReadServerValue(txRestUrl(ref));
        if (!current()) throw new Error('Connection session changed');
        return result;
    };
    const receiptMatches = (receipt, row) => !!receipt && receipt.uid === uid && receipt.hash === row.hash;
    const sendAtomic = async (row) => {
        if (!current()) throw new Error('Connection session changed');
        const updates = {};
        for (const op of row.ops) updates[op.p.join('/')] = op.v;
        updates[NATIVE_WRITE_RECEIPTS + '/' + row.opId] = { uid, at: { '.sv': 'timestamp' }, hash: row.hash };
        let started;
        try { started = sdk.update(root, updates); } catch (e) { e.nativeUnsent = true; throw e; }
        try { await started; }
        catch (e) { if (!current() || !receiptMatches(await read(NATIVE_WRITE_RECEIPTS + '/' + row.opId), row)) throw e; }
    };
    const operationLock = (id, available, action) => {
        const locks = typeof navigator !== 'undefined' && navigator.locks;
        if (!locks || typeof locks.request !== 'function') return action(false);
        if (available) return locks.request('zoew-write:' + id, { ifAvailable: true }, lock => lock ? action(true) : null);
        const lease = leaseFactory(); const controller = new AbortController();
        let endScope;
        const ended = new Promise((_, reject) => { endScope = () => reject(Object.assign(new Error('Connection session changed'), { code: 'CONNECTION_SCOPE_CHANGED', txOutcome: 'unknown', noRetry: true })); });
        const stop = lease.watch(() => { controller.abort(); endScope(); });
        const running = locks.request('zoew-write:' + id, { signal: controller.signal }, () => Promise.race([action(true), ended]));
        running.finally(stop).catch(() => {});
        ended.catch(() => {});
        return running;
    };
    const recoverRow = async (row, canReplay) => {
        if (!current()) return;
        if (row.hash) {
            const receipt = await read(NATIVE_WRITE_RECEIPTS + '/' + row.opId);
            if (!receiptMatches(receipt, row)) {
                if (receipt) { state.blocked++; return; }
                await sendAtomic(row);
            }
            if (current()) remove(row.opId);
            return;
        }
        let resolved = true;
        for (const op of row.ops) {
            const value = await read(op.p.join('/'));
            if (row.intent) {
                const intent = row.intent;
                const rootName = intent.bucket === 'daily' ? 'zoew_daily_revenue_cod_dod' : 'zoew_monthly_revenue_cod_dod';
                if (op.k !== 'cas' || op.p[0] !== rootName || !['ledger-event', 'revenue-delta'].includes(intent.kind)
                    || !/^op_[0-9a-z_]{5,37}$/.test(intent.token) || ledgerJournalRecord(op.v, intent)?.op !== intent.token) { resolved = false; continue; }
                const witnessed = ledgerJournalWitness(value, op.x, intent);
                if (witnessed === 'applied') continue;
                if (!canReplay || witnessed !== 'not-applied' && !txSameValue(value, op.x)) { resolved = false; continue; }
                const result = await sdk.runTransaction(sdk.ref(db, op.p.join('/')), latest => {
                    if (!current() || ledgerJournalWitness(latest, op.x, intent) === 'applied') return;
                    if (ledgerJournalWitness(latest, op.x, intent) !== 'not-applied' && !txSameValue(latest, op.x)) return;
                    return ledgerJournalUpdate(latest, intent);
                });
                if (result && (result.committed || ledgerJournalWitness(result.snapshot?.val(), op.x, intent) === 'applied')) continue;
                resolved = false; continue;
            }
            if (txSameValue(value, op.v)) continue;
            const token = op.v && typeof op.v === 'object' && op.v.op;
            if (token && value && (value.op === token || value.ops && value.ops[token])) continue;
            if (canReplay && op.k === 'cas' && token && txSameValue(value, op.x)) {
                const result = await sdk.runTransaction(sdk.ref(db, op.p.join('/')), latest => {
                    if (!current() || !txSameValue(latest, op.x)) return;
                    return op.v;
                });
                const latest = result && result.snapshot && result.snapshot.val();
                if (result && result.committed || latest && (latest.op === token || latest.ops && latest.ops[token])) continue;
            }
            resolved = false;
        }
        if (current()) { if (resolved) remove(row.opId); else state.blocked++; }
    };
    const recovery = (async () => {
        try {
            for (const row of journal.list(scope, topic)) {
                if (!current()) return;
                const result = await operationLock(row.opId, true, async allowed => { await recoverRow(row, allowed); return true; });
                if (result === null) { externalRows.push(row); state.external++; }
            }
            for (const external of externalRows) {
                await operationLock(external.opId, false, async allowed => {
                    const row = journal.list(scope, topic).find(r => r.opId === external.opId);
                    if (row) await recoverRow(row, allowed);
                });
                state.external = Math.max(0, state.external - 1);
            }
            externalRows.length = 0;
        } catch (e) { if (current()) state.blocked++; }
        finally { state.recovering = false; changed(); }
    })();
    const mutate = (method, ref, value, options?) => {
        const opId = 'native_' + crypto.randomUUID().replace(/-/g, '');
        const source = { promise: null };
        const running = operationLock(opId, false, async () => {
        await recovery;
        if (!current() || state.blocked) throw Object.assign(new Error('Write outcome needs verification'), { code: 'write_recovery_pending', noRetry: true });
        for (const external of externalRows) {
            await operationLock(external.opId, false, async allowed => {
                const row = journal.list(scope, topic).find(r => r.opId === external.opId);
                if (row) await recoverRow(row, allowed);
            });
        }
        state.external = 0;
        if (!current() || state.blocked) throw Object.assign(new Error('Write outcome needs verification'), { code: 'write_recovery_pending', noRetry: true });
        const path = new URL(String(ref)).pathname.split('/').filter(Boolean).map(decodeURIComponent);
        const row: any = { v: 1, scope, topic, opId, sentAfter: 0, stage: 'sent', createdAt: Date.now(), ops: [] as any[] };
        if (method === 'runTransaction' && value.connectionIntent) row.intent = value.connectionIntent;
        const persist = () => {
            if (!current() || !journal.put(row)) throw Object.assign(new Error('Write journal unavailable'), { code: 'write_journal_unavailable', noRetry: true });
        };
        try {
            let result;
            if (method === 'runTransaction') {
                const updater = Object.assign((prior) => {
                    if (!current()) return;
                    const before = prior === undefined ? null : JSON.parse(JSON.stringify(prior));
                    const next = value(prior);
                    if (next !== undefined) { row.ops = [{ k: 'cas', p: path, x: before, v: next }]; persist(); }
                    return next;
                }, value);
                source.promise = sdk.runTransaction(ref, updater, options);
                result = await source.promise;
            } else {
                row.ops = method === 'update' ? Object.keys(value).map((key) => ({ k: 'set', p: path.concat(key.split('/')), v: value[key] }))
                    : [{ k: 'set', p: path, v: value }];
                if (row.ops.some((op) => op.p[0] === NATIVE_WRITE_RECEIPTS)) throw new Error('Write receipt path is reserved');
                const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(row.ops)));
                row.hash = Array.from(new Uint8Array(bytes), (n) => n.toString(16).padStart(2, '0')).join('');
                persist();
                await sendAtomic(row);
                result = undefined;
            }
            remove(opId);
            return result;
        } catch (e) {
            if (e.nativeUnsent || e.txOutcome === 'not-applied' || /permission_denied|PERMISSION_DENIED|write_journal_unavailable/.test(String(e && (e.code || e.message)))) remove(opId);
            else if (row.ops.length && current()) { state.blocked++; changed(); }
            throw e;
        }
        });
        txMutationSources.set(running, source);
        return running;
    };
    return { uid, recovery, mutate, current };
}
