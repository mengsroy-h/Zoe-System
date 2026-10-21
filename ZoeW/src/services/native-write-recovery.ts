import { createLocalWriteJournal } from './write-journal';
import { txReadServerValue, txReadWasRefused, txRestUrl, txSameValue } from './tx-outcome';
import { ledgerCompanionState, ledgerJournalRecord, ledgerJournalUpdate, ledgerJournalWitness, ledgerRecordTokens, ledgerOpRing } from '../domain/ledger';
import { txMutationSources } from './tx-disconnect';
import { getServerNow } from '../core/clock';

const nativeRecoveryStates = new WeakMap<object, any>();
export const NATIVE_WRITE_RECEIPTS = 'zoew_write_receipts';
export const NATIVE_RECOVERY_RETRY_GAP_MS = 2000;
export const NATIVE_RECEIPT_RETENTION_MS = 2 * 86400000;
export const NATIVE_RECEIPT_PURGE_MAX = 500;
export const NATIVE_RECEIPT_PURGE_MARGIN_MS = 60000;

export function nativeWriteRecoveryState(db) {
    return db && nativeRecoveryStates.get(db) || { blocked: 0, recovering: false, deferred: false, pending: 0 };
}

export function createNativeWriteRecovery(sdk, auth, db, current, report, leaseFactory) {
    const journal = createLocalWriteJournal();
    const uid = auth.currentUser && auth.currentUser.uid;
    const root = sdk.ref(db);
    const scope = String(root) + '|' + uid;
    const topic = 'firebase';
    const state = { blocked: 0, recovering: true, deferred: false, external: 0, pending: 0, purged: false };
    const externalRows = [];
    const journaled = journal.available();
    nativeRecoveryStates.set(db, state);
    const changed = () => { if (current()) report(); };
    const remove = (id) => journal.remove(scope, topic, id);
    const payloadHash = async (ops) => {
        const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(ops)));
        return Array.from(new Uint8Array(bytes), n => n.toString(16).padStart(2, '0')).join('');
    };
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
        catch (e) {
            if (!current()) throw e;
            if (/permission[_ ]denied/i.test(String(e.code || e.message))) { e.receiptRefused = true; throw e; }
            if (!receiptMatches(await read(NATIVE_WRITE_RECEIPTS + '/' + row.opId), row)) throw e;
        }
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
    const plainCasRow = (row) => !row.hash && !row.intent && row.ops.every((op) => !(op.v && typeof op.v === 'object' && op.v.op));
    const recoverRow = async (row, canReplay) => {
        try { await settleRow(row, canReplay); }
        catch (e) {
            if (!current() || e.code === 'CONNECTION_SCOPE_CHANGED') throw e;
            if (e.receiptRefused || (row.hash || plainCasRow(row)) && txReadWasRefused(e)) { remove(row.opId); return; }
            if (txReadWasRefused(e) || e.noRetry || /permission[_ ]denied/i.test(String(e.code || e.message))) { state.blocked++; return; }
            throw e;
        }
    };
    const purgeReceipts = async () => {
        if (state.purged || !current()) return;
        state.purged = true;
        const snapshot = await sdk.get(sdk.ref(db, NATIVE_WRITE_RECEIPTS));
        if (!current()) return;
        const receipts = snapshot && typeof snapshot.val === 'function' ? snapshot.val() : null;
        const cutoff = getServerNow() - NATIVE_RECEIPT_RETENTION_MS - NATIVE_RECEIPT_PURGE_MARGIN_MS;
        const updates = {};
        let count = 0;
        for (const id of Object.keys(receipts && typeof receipts === 'object' ? receipts : {})) {
            const receipt = receipts[id];
            if (!receipt || receipt.uid !== uid || typeof receipt.at !== 'number' || receipt.at >= cutoff) continue;
            updates[NATIVE_WRITE_RECEIPTS + '/' + id] = null;
            if (++count >= NATIVE_RECEIPT_PURGE_MAX) break;
        }
        if (count && current()) await sdk.update(root, updates);
    };
    const companionState = async (companion) => ledgerCompanionState(await read(String(companion.path)), companion);
    const undoAppliedDelta = async (op, intent) => {
        const undo = { ...intent, token: String(intent.token).replace(/^op_/, 'op_r'), cod: -(Number(intent.cod) || 0), dod: -(Number(intent.dod) || 0), count: -(Number(intent.count) || 0) };
        delete undo.companion;
        const updater = Object.assign(latest => {
            if (!current() || ledgerJournalWitness(latest, null, undo) === 'applied') return;
            return ledgerJournalUpdate(latest, undo);
        }, { txOutcomeWitness: (server, prior) => ledgerJournalWitness(server, prior, undo) });
        await sdk.runTransaction(sdk.ref(db, op.p.join('/')), updater);
    };
    const settleRow = async (row, canReplay) => {
        if (!current()) return;
        if (row.hash) {
            if (!(row.queuedAt > 0) || getServerNow() - row.queuedAt > NATIVE_RECEIPT_RETENTION_MS) { state.blocked++; return; }
            if (await payloadHash(row.ops) !== row.hash) { if (current()) state.blocked++; return; }
            if (!current()) return;
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
                if (intent.kind === 'revenue-delta' && intent.companion && typeof intent.companion === 'object') {
                    const held = await companionState(intent.companion);
                    if (witnessed === 'applied') {
                        if (held !== 'prior') continue;
                        if (!canReplay) { resolved = false; continue; }
                        await undoAppliedDelta(op, intent);
                        continue;
                    }
                    if (held !== 'holds') continue;
                }
                if (witnessed === 'applied') continue;
                const prepared = row.stage === 'prepared';
                if (!canReplay || !prepared && witnessed !== 'not-applied' && !txSameValue(value, op.x)) { resolved = false; continue; }
                const updater = Object.assign(latest => {
                    if (!current() || ledgerJournalWitness(latest, op.x, intent) === 'applied') return;
                    if (!prepared && ledgerJournalWitness(latest, op.x, intent) !== 'not-applied' && !txSameValue(latest, op.x)) return;
                    const before = latest === undefined ? null : JSON.parse(JSON.stringify(latest));
                    const next = ledgerJournalUpdate(latest, intent);
                    if (next !== undefined) {
                        row.stage = 'sent'; row.ops = [{ k: 'cas', p: op.p, x: before, v: next }];
                        if (!journal.put(row)) throw Object.assign(new Error('Write journal unavailable'), { code: 'write_journal_unavailable', noRetry: true });
                    }
                    return next;
                }, { txOutcomeWitness: (server, prior) => ledgerJournalWitness(server, prior, intent) });
                const result = await sdk.runTransaction(sdk.ref(db, op.p.join('/')), updater);
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
            if (token) resolved = false;
        }
        if (current()) { if (resolved) remove(row.opId); else state.blocked++; }
    };
    let recovery: Promise<void> = Promise.resolve();
    const runRecovery = () => {
        state.recovering = true;
        state.deferred = false;
        state.blocked = 0;
        state.external = 0;
        externalRows.length = 0;
        recovery = (async () => {
        if (!journaled) return;
        try {
            const rows = journal.list(scope, topic);
            const companion = (row) => !!(row.intent && row.intent.companion);
            for (const row of rows.filter(row => !companion(row)).concat(rows.filter(companion))) {
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
        } catch (e) { if (current()) state.deferred = true; }
        finally {
            state.recovering = false;
            changed();
            if (!state.deferred && !state.blocked && current()) purgeReceipts().catch(() => {});
        }
        })();
        return recovery;
    };
    runRecovery();
    const verified = async () => {
        for (;;) {
            await recovery;
            if (!state.deferred || !current()) return;
            await new Promise(resolve => setTimeout(resolve, NATIVE_RECOVERY_RETRY_GAP_MS));
            if (!current()) return;
            if ((navigator.onLine as boolean) === false) continue;
            if (!state.recovering) runRecovery();
        }
    };
    const retry = () => { if (!state.recovering) runRecovery(); return verified(); };
    const discard = () => {
        const out = { count: 0, paths: [] as string[] };
        if (!journaled) return out;
        let rows = [];
        try { rows = journal.list(scope, topic); } catch (e) { rows = []; }
        for (const row of rows) {
            for (const op of row.ops) out.paths.push(op.p.join('/'));
            remove(row.opId);
            out.count++;
        }
        runRecovery();
        return out;
    };
    const mutate = (method, ref, value, options?, ownedPath?) => {
        if (!journaled) return method === 'runTransaction' ? sdk.runTransaction(ref, value, options) : sdk[method](ref, value);
        const opId = 'native_' + crypto.randomUUID().replace(/-/g, '');
        const source = { promise: null };
        state.pending++;
        const running = operationLock(opId, false, async () => {
            await verified();
            if (!current() || state.blocked) throw Object.assign(new Error('Write outcome needs verification'), { code: 'write_recovery_pending', noRetry: true });
            for (const external of externalRows) {
                await operationLock(external.opId, false, async allowed => {
                    const row = journal.list(scope, topic).find(r => r.opId === external.opId);
                    if (row) await recoverRow(row, allowed);
                });
            }
            state.external = 0;
            if (!current() || state.blocked) throw Object.assign(new Error('Write outcome needs verification'), { code: 'write_recovery_pending', noRetry: true });
            const path = ownedPath === undefined ? new URL(String(ref)).pathname.split('/').filter(Boolean).map(decodeURIComponent)
                : String(ownedPath).split('/').filter(Boolean);
            const row: any = { v: 1, scope, topic, opId, sentAfter: 0, stage: 'sent', queuedAt: getServerNow(), ops: [] as any[] };
            if (method === 'runTransaction' && value.connectionIntent) row.intent = value.connectionIntent;
            const persist = () => {
                if (!current() || !journal.put(row)) throw Object.assign(new Error('Write journal unavailable'), { code: 'write_journal_unavailable', noRetry: true });
            };
            try {
                let result;
                if (method === 'runTransaction') {
                    let needsAnchor = false;
                    const updater = Object.assign((prior) => {
                        if (!current()) return;
                        const record = row.intent && ledgerJournalRecord(prior, row.intent);
                        if (record && typeof record === 'object' && !ledgerRecordTokens(record).length) {
                            const tagged = { ...record, op: row.intent.token, ops: ledgerOpRing(record, row.intent.token) };
                            row.stage = 'prepared'; row.ops = [{ k: 'cas', p: path, x: JSON.parse(JSON.stringify(prior)),
                                v: row.intent.bucket === 'daily' ? tagged : { ...prior, [row.intent.key]: tagged } }];
                            persist(); needsAnchor = true; return;
                        }
                        const before = prior === undefined ? null : JSON.parse(JSON.stringify(prior));
                        const next = value(prior);
                        if (next !== undefined && value.txAdvisory !== true) { row.stage = 'sent'; row.ops = [{ k: 'cas', p: path, x: before, v: next }]; persist(); }
                        return next;
                    }, value);
                    for (let attempt = 0; attempt < 3; attempt++) {
                        needsAnchor = false;
                        source.promise = sdk.runTransaction(ref, updater, options);
                        result = await source.promise;
                        if (!needsAnchor) break;
                        const anchor = 'op_a' + crypto.randomUUID().replace(/-/g, '');
                        try {
                            source.promise = sdk.runTransaction(ref, latest => {
                                if (!current()) return;
                                const record = ledgerJournalRecord(latest, row.intent);
                                if (!record || typeof record !== 'object' || ledgerRecordTokens(record).length) return;
                                const tagged = { ...record, op: anchor, ops: ledgerOpRing(record, anchor) };
                                return row.intent.bucket === 'daily' ? tagged : { ...latest, [row.intent.key]: tagged };
                            }, options);
                            await source.promise;
                        } catch (e) {
                            if (!current() || e.noRetry || /permission[_ ]denied/i.test(String(e.code || e.message))) throw e;
                        }
                    }
                    if (needsAnchor) throw Object.assign(new Error('Ledger identity initialization needs retry'), { code: 'write_recovery_pending', noRetry: true });
                    if (!current() && row.stage === 'prepared') throw Object.assign(new Error('Connection session changed'), { code: 'CONNECTION_SCOPE_CHANGED', txOutcome: 'unknown', noRetry: true });
                } else {
                    row.ops = method === 'update' ? Object.keys(value).map((key) => ({ k: 'set', p: path.concat(key.split('/')), v: value[key] }))
                        : [{ k: 'set', p: path, v: value }];
                    if (row.ops.some((op) => op.p[0] === NATIVE_WRITE_RECEIPTS)) throw new Error('Write receipt path is reserved');
                    row.hash = await payloadHash(row.ops);
                    persist();
                    try { await sendAtomic(row); }
                    catch (e) {
                        if (!current() || !e.receiptRefused) throw e;
                        remove(opId); row.ops = [];
                        await sdk[method](ref, value);
                    }
                    result = undefined;
                }
                remove(opId);
                return result;
            } catch (e) {
                if (method === 'runTransaction' && value.txAdvisory === true || e.nativeUnsent || e.txOutcome === 'not-applied' || /permission[_ ]denied|write_journal_unavailable/i.test(String(e && (e.code || e.message)))) remove(opId);
                else if (row.ops.length && current()) { state.blocked++; changed(); }
                throw e;
            }
        });
        running.finally(() => { state.pending = Math.max(0, state.pending - 1); }).catch(() => {});
        txMutationSources.set(running, source);
        return running;
    };
    return { uid, retry, discard, mutate, current };
}
