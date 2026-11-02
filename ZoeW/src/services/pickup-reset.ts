import { firebaseState } from '../core/state';
import { liveShopScope } from '../core/shop-scope';
import { appLocalStore, safeStoreSet } from '../core/storage';
import { generateUniqueId } from '../domain/barcode';
import { pickupResetRecord } from '../domain/pickup';
import { pickupResetAppliedReceipt, pickupResetAttemptId, pickupResetBatchHash, pickupResetBoundReceipt,
    pickupResetCasOf, pickupResetCasText, pickupResetContextOf, pickupResetReceiptMatches } from '../domain/pickup-reset-proof';
import { dbOp, dbOpStalled } from './network';
import { txReadServerValue, txRestUrl } from './tx-outcome';

export const PICKUP_RESET_PENDING_TEXT = '⏳ Reset មិនទាន់ផ្ទៀងផ្ទាត់ — ភស្តុតាងការងារត្រូវបានរក្សាទុក។ សូមកុំ Reset ម្តងទៀត រហូតបានផ្ទៀងផ្ទាត់លទ្ធផល។';
export const PICKUP_RESET_UNAVAILABLE_TEXT = '⏳ មិនអាចពិនិត្យភស្តុតាង Reset ក្នុងឧបករណ៍នេះបានទេ — មិនផ្ញើ Reset ថ្មី។ សូមពិនិត្យទំហំផ្ទុក និង Sync។';
const PREFIX = 'zoew_pickup_reset_pending_v2:';
const LEGACY = 'zoew_pickup_reset_pending_v1:';
const active = new Map<string, string>();
const object = value => !!value && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.length > 0;
const nativeRealm = value => text(value) && !/[\s\u0000-\u001F\u007F]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value);
const normalizedScope = scope => String(scope).trim().replace(/\/+(#|$)/, '$1').toLowerCase();
const suffix = (scope, uid) => encodeURIComponent(normalizedScope(scope)) + ':' + encodeURIComponent(uid) + ':';
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);

function authority() {
    const options = firebaseState.db?.app?.options || firebaseState.auth?.app?.options;
    if (text(options?.supabaseUrl)) {
        const tenant = firebaseState.fb?.tenantScope?.(firebaseState.auth);
        return text(tenant) ? { tenant, backend: 'supabase' } : null;
    }
    if (nativeRealm(options?.projectId)) return { tenant: options.projectId, backend: 'native' };
    return options?.projectId === undefined && text(options?.databaseURL) ? { tenant: null, backend: 'native' } : null;
}

async function capture(isCurrent = () => true) {
    const source = authority();
    const owner = { db: firebaseState.db, sdk: firebaseState.fb, auth: firebaseState.auth, user: firebaseState.auth?.currentUser,
        generation: firebaseState.authGeneration, scope: liveShopScope(), uid: firebaseState.auth?.currentUser?.uid, ...source };
    const current = () => isCurrent() && !firebaseState.isInitializingFirebase && owner.db === firebaseState.db
        && owner.sdk === firebaseState.fb && owner.auth === firebaseState.auth && owner.user === firebaseState.auth?.currentUser
        && owner.generation === firebaseState.authGeneration && owner.scope === liveShopScope() && owner.uid === firebaseState.auth?.currentUser?.uid
        && same(source, authority());
    if (!source || !owner.db || !owner.sdk || !text(owner.scope) || !text(owner.uid) || !current()) return null;
    if (source.backend === 'native' && source.tenant === null) {
        if (typeof owner.user?.getIdTokenResult !== 'function') return null;
        try {
            const result = await dbOp(owner.user.getIdTokenResult());
            const realm = result?.claims?.aud;
            return current() && nativeRealm(realm) ? { ...owner, tenant: realm, current } : null;
        } catch (error) { return null; }
    }
    return { ...owner, current };
}

function raw(key) {
    if (!appLocalStore) throw new Error('PICKUP_RESET_STORAGE');
    return appLocalStore.getItem(key);
}

function last(day) { return day.attempts[day.attempts.length - 1]; }

function journalOf(value) {
    if (!object(value) || value.v !== 2 || !['id', 'scope', 'tenant', 'actorUid', 'batchHash'].every(key => text(value[key]))
        || !['native', 'supabase'].includes(value.backend) || !Number.isSafeInteger(value.at) || value.at < 0
        || !Array.isArray(value.dates) || !value.dates.length || value.dates.some(day => typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day))
        || new Set(value.dates).size !== value.dates.length || !/^[a-f0-9]{64}$/.test(value.batchHash)
        || !object(value.owner) || !text(value.owner.token) || typeof value.owner.locked !== 'boolean' || typeof value.owner.ended !== 'boolean'
        || typeof value.complete !== 'boolean' || typeof value.settled !== 'boolean' || !Array.isArray(value.days) || value.days.length !== value.dates.length) return null;
    for (let index = 0; index < value.days.length; index++) {
        const day = value.days[index];
        if (!object(day) || day.day !== value.dates[index] || !Array.isArray(day.attempts)) return null;
        for (let attemptIndex = 0; attemptIndex < day.attempts.length; attemptIndex++) {
            const attempt = day.attempts[attemptIndex], context = pickupResetContextOf(attempt?.context), cas = pickupResetCasOf(attempt?.casText);
            if (!context || !cas || cas.day !== day.day || attempt.tenant !== value.tenant || attempt.actorUid !== value.actorUid
                || context.scope !== value.scope || context.batchId !== value.id || context.batchHash !== value.batchHash || context.day !== day.day
                || !/^[a-f0-9]{64}$/.test(attempt.attemptId) || !['pending', 'applied', 'not-applied'].includes(attempt.outcome)
                || attemptIndex + 1 < day.attempts.length && attempt.outcome !== 'not-applied') return null;
            const expected = pickupResetAppliedReceipt(value.tenant, value.actorUid, context, attempt.attemptId, attempt.casText,
                value.backend === 'native' ? 'native-day' : 'operation');
            if (!expected || attempt.outcome === 'applied' && !pickupResetReceiptMatches(attempt.receipt, expected)
                || attempt.outcome !== 'applied' && attempt.receipt !== undefined) return null;
        }
    }
    const complete = value.days.every(day => last(day)?.outcome === 'applied');
    if (value.complete !== complete || value.settled && (!value.owner.ended || value.days.some(day => last(day)?.outcome === 'pending'))) return null;
    return value;
}

function storedJournal(key) {
    const encoded = raw(key);
    if (encoded === null) return null;
    try {
        const value = journalOf(JSON.parse(encoded));
        if (!value || key !== PREFIX + suffix(value.scope, value.actorUid) + value.id) return null;
        return { value, encoded };
    } catch (error) { return null; }
}

export function pickupResetPendingState(scope, uid, ownedKey?) {
    try {
        if (!appLocalStore) return 'unavailable';
        const legacy = LEGACY + suffix(scope, uid), prefix = PREFIX + suffix(scope, uid);
        for (let index = 0; index < appLocalStore.length; index++) {
            const key = appLocalStore.key(index);
            if (key === ownedKey) continue;
            if (key?.startsWith(legacy)) return 'pending';
            if (key?.startsWith(prefix)) {
                const journal = storedJournal(key);
                if (!journal || !journal.value.settled) return 'pending';
            }
        }
        return '';
    } catch (error) { return 'unavailable'; }
}

function refusalStatus(owner) {
    return pickupResetPendingState(owner.scope, owner.uid) === 'pending' ? 'hold' : 'unavailable';
}

async function withOwnerLock(owner, recovery, action) {
    const locks = typeof navigator !== 'undefined' && navigator.locks;
    if (!locks || typeof locks.request !== 'function') return recovery ? null : action(false);
    try {
        return await locks.request('zoew-pickup-reset:' + JSON.stringify([normalizedScope(owner.scope), owner.tenant, owner.uid]),
            { ifAvailable: true }, lock => lock ? action(true) : null);
    } catch (error) { return null; }
}

function persist(key, previous, value) {
    if (!journalOf(value) || raw(key) !== previous) throw new Error('PICKUP_RESET_JOURNAL_CHANGED');
    const encoded = JSON.stringify(value);
    if (!safeStoreSet(appLocalStore, key, encoded) || raw(key) !== encoded) throw new Error('PICKUP_RESET_STORAGE');
    return encoded;
}

function settle(value) {
    value.complete = value.days.every(day => last(day)?.outcome === 'applied');
    value.settled = value.owner.ended && !value.days.some(day => last(day)?.outcome === 'pending');
}

function requestOf(attempt) {
    return Object.freeze({ tenant: attempt.tenant, actorUid: attempt.actorUid, context: Object.freeze({ ...attempt.context }),
        attemptId: attempt.attemptId, casText: attempt.casText });
}

function definiteRejection(error) {
    if (error?.txOutcome === 'unknown' || dbOpStalled(error)) return false;
    return error?.txOutcome === 'not-applied' || /^(?:permission_denied|PERMISSION_DENIED)$/.test(String(error?.code || error?.message || ''));
}

async function annotateLate(owner, key, token, request, result) {
    await withOwnerLock(owner, true, async () => {
        const stored = storedJournal(key);
        if (!stored || stored.value.owner.token !== token || !stored.value.owner.ended) return;
        const value = stored.value, day = value.days.find(day => day.day === request.context.day), attempt = day && last(day);
        if (!attempt || attempt.outcome !== 'pending' || !same(requestOf(attempt), request)) return;
        const expected = await pickupResetBoundReceipt(owner.tenant, owner.uid, request.context, request.attemptId, request.casText,
            owner.backend === 'native' ? 'native-day' : 'operation');
        if (!expected || raw(key) !== stored.encoded) return;
        if (result?.committed === true && pickupResetReceiptMatches(result.pickupReset, expected)) {
            attempt.outcome = 'applied'; attempt.receipt = { ...expected };
        } else if (owner.current() && result?.committed === false && result.pickupReset === undefined) attempt.outcome = 'not-applied';
        else return;
        settle(value);
        persist(key, stored.encoded, value);
    });
}

export async function runPickupResetBatch(dates, isCurrent = () => true, onApplied = (_day, _result) => {}) {
    const owner = await capture(isCurrent);
    const summary = { status: 'unavailable', doneCount: 0, failedCount: 0 };
    if (!owner || typeof owner.sdk.executePickupReset !== 'function' || typeof owner.sdk.pickupResetStatus !== 'function'
        || !Array.isArray(dates) || !dates.length) return summary;
    const orderedDates = [...dates], ownerId = suffix(owner.scope, owner.uid);
    const deferredAcknowledgements = [];
    const result = await withOwnerLock(owner, false, async locked => {
        if (!owner.current() || active.has(ownerId) || pickupResetPendingState(owner.scope, owner.uid)) return { ...summary, status: refusalStatus(owner) };
        const id = generateUniqueId(), token = generateUniqueId();
        const batchHash = await pickupResetBatchHash(owner.tenant, owner.scope, owner.uid, id, orderedDates);
        if (!batchHash || !owner.current() || active.has(ownerId) || pickupResetPendingState(owner.scope, owner.uid)) return { ...summary, status: refusalStatus(owner) };
        const key = PREFIX + ownerId + id;
        const value = { v: 2, id, scope: owner.scope, tenant: owner.tenant, actorUid: owner.uid, backend: owner.backend,
            dates: orderedDates, batchHash, at: Date.now(), owner: { token, locked, ended: false },
            days: orderedDates.map(day => ({ day, attempts: [] })), complete: false, settled: false };
        let encoded;
        try { encoded = persist(key, null, value); } catch (error) { return summary; }
        active.set(ownerId, token);
        const owns = () => {
            try { return owner.current() && active.get(ownerId) === token && !value.owner.ended && raw(key) === encoded
                && pickupResetPendingState(owner.scope, owner.uid, key) === ''; } catch (error) { return false; }
        };
        summary.status = 'hold';
        try {
            days: for (const day of value.days) {
                let previousCas = '';
                for (let conflict = 0; conflict < 25; conflict++) {
                    if (!owns()) break days;
                    const ref = owner.sdk.ref(owner.db, 'zoew_daily_pickup_cod_dod/' + day.day);
                    let basis;
                    try {
                        const url = txRestUrl(ref);
                        basis = url ? await txReadServerValue(url) : (await dbOp(owner.sdk.get(ref))).val();
                    } catch (error) { break days; }
                    if (!owns()) break days;
                    let casText;
                    try { casText = pickupResetCasText(day.day, basis, pickupResetRecord(basis)); } catch (error) { break days; }
                    if (!casText) break days;
                    if (casText === previousCas) { summary.failedCount++; break; }
                    previousCas = casText;
                    const context = Object.freeze({ v: 1, scope: owner.scope, batchId: id, batchHash, dayId: id + ':' + day.day, day: day.day, nonce: generateUniqueId() });
                    const attemptId = await pickupResetAttemptId(owner.tenant, owner.uid, context, casText);
                    const expected = attemptId && await pickupResetBoundReceipt(owner.tenant, owner.uid, context, attemptId, casText,
                        owner.backend === 'native' ? 'native-day' : 'operation');
                    if (!expected || !owns()) break days;
                    const attempt: any = { tenant: owner.tenant, actorUid: owner.uid, context, attemptId, casText, outcome: 'pending' };
                    day.attempts.push(attempt);
                    encoded = persist(key, encoded, value);
                    const request = requestOf(attempt);
                    let write;
                    try {
                        if (!owns()) break days;
                        write = owner.sdk.executePickupReset(ref, request, owns);
                        const saved = await dbOp(write);
                        if (!owns()) {
                            if (saved?.committed === true && pickupResetReceiptMatches(saved.pickupReset, expected)) deferredAcknowledgements.push({ key, token, request, saved });
                            break days;
                        }
                        if (saved?.committed === true && pickupResetReceiptMatches(saved.pickupReset, expected)) {
                            attempt.outcome = 'applied'; attempt.receipt = { ...expected };
                            value.complete = value.days.every(entry => last(entry)?.outcome === 'applied');
                            encoded = persist(key, encoded, value);
                            summary.doneCount++;
                            if (owns()) onApplied(day.day, saved);
                            break;
                        }
                        if (saved?.committed !== false || saved.pickupReset !== undefined) break days;
                        attempt.outcome = 'not-applied'; encoded = persist(key, encoded, value);
                        if (conflict === 24) summary.failedCount++;
                    } catch (error) {
                        if (!owns()) break days;
                        if (!definiteRejection(error)) {
                            if (write && dbOpStalled(error)) Promise.resolve(write).then(saved => annotateLate(owner, key, token, request, saved), () => {}).catch(() => {});
                            break days;
                        }
                        attempt.outcome = 'not-applied'; encoded = persist(key, encoded, value); summary.failedCount++;
                        break;
                    }
                }
            }
        } catch (error) {
            summary.status = 'hold';
        } finally {
            try {
                if (active.get(ownerId) === token && raw(key) === encoded) {
                    value.owner.ended = true;
                    settle(value);
                    encoded = persist(key, encoded, value);
                    if (value.settled) summary.status = value.complete ? 'complete' : 'partial';
                }
            } catch (error) { summary.status = 'hold'; }
            if (active.get(ownerId) === token) active.delete(ownerId);
        }
        return owner.current() ? summary : { ...summary, status: 'stale' };
    });
    for (const acknowledgement of deferredAcknowledgements) {
        try { await annotateLate(owner, acknowledgement.key, acknowledgement.token, acknowledgement.request, acknowledgement.saved); } catch (error) {}
    }
    return result || { ...summary, status: refusalStatus(owner) };
}

export async function resumePickupResetOutcomes() {
    const owner = await capture();
    if (!owner || typeof owner.sdk.pickupResetStatus !== 'function') return { checked: 0, resolved: 0, held: true };
    const result = await withOwnerLock(owner, true, async () => {
        const summary = { checked: 0, resolved: 0, held: false }, prefix = PREFIX + suffix(owner.scope, owner.uid);
        try {
            const keys = [];
            for (let index = 0; index < appLocalStore.length; index++) {
                const key = appLocalStore.key(index);
                if (key?.startsWith(prefix)) keys.push(key);
            }
            for (const key of keys) {
                if (!owner.current()) return { ...summary, held: true };
                const stored = storedJournal(key);
                if (!stored || stored.value.tenant !== owner.tenant || stored.value.backend !== owner.backend) { summary.held = true; continue; }
                const value = stored.value;
                if (value.settled) continue;
                if (!value.owner.ended && !value.owner.locked || active.has(suffix(owner.scope, owner.uid))) { summary.held = true; continue; }
                let encoded = stored.encoded;
                const batchHash = await pickupResetBatchHash(owner.tenant, owner.scope, owner.uid, value.id, value.dates);
                if (!owner.current() || raw(key) !== encoded || batchHash !== value.batchHash) { summary.held = true; continue; }
                value.owner = { token: generateUniqueId(), locked: true, ended: true };
                encoded = persist(key, encoded, value);
                const current = () => {
                    try { return owner.current() && raw(key) === encoded; } catch (error) { return false; }
                };
                for (const day of value.days) {
                    for (const attempt of day.attempts) {
                        const request = requestOf(attempt);
                        const expected = await pickupResetBoundReceipt(owner.tenant, owner.uid, request.context, request.attemptId, request.casText,
                            owner.backend === 'native' ? 'native-day' : 'operation');
                        if (!expected || !current()) { summary.held = true; break; }
                        if (attempt.outcome !== 'pending') continue;
                        summary.checked++;
                        let status;
                        try { status = await dbOp(owner.sdk.pickupResetStatus(owner.sdk.ref(owner.db, 'zoew_daily_pickup_cod_dod/' + day.day), request, current)); }
                        catch (error) { summary.held = true; continue; }
                        if (!current() || status?.outcome !== 'applied' || !pickupResetReceiptMatches(status.pickupReset, expected)) { summary.held = true; continue; }
                        attempt.outcome = 'applied'; attempt.receipt = { ...expected };
                        value.complete = value.days.every(entry => last(entry)?.outcome === 'applied');
                        encoded = persist(key, encoded, value); summary.resolved++;
                    }
                }
                if (!current()) return { ...summary, held: true };
                settle(value); encoded = persist(key, encoded, value);
                if (!value.settled) summary.held = true;
            }
            if (pickupResetPendingState(owner.scope, owner.uid)) summary.held = true;
            return summary;
        } catch (error) { return { ...summary, held: true }; }
    });
    return result || { checked: 0, resolved: 0, held: true };
}
