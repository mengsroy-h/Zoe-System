import { dataState, firebaseState } from '../core/state';
import { getFormattedDate } from '../core/timezone';
import { refreshCurrentHistoryView } from '../ui/history-refresh';
import { showToast } from '../ui/toast';

export function ledgerNumber(value) {
    const n = parseFloat(value);
    return isFinite(n) ? n : 0;
}

export function ledgerAppliedDelta(before, after) {
    return {
        cod: Math.round((ledgerNumber(after.codDollar) - ledgerNumber(before.codDollar)) * 100) / 100,
        dod: Math.round((ledgerNumber(after.dodDollar) - ledgerNumber(before.dodDollar)) * 100) / 100,
        count: ledgerNumber(after.totalCount) - ledgerNumber(before.totalCount)
    };
}

export function ledgerDeltaWithClamp(before, codToAdd, dodToAdd, countToAdd, label, context) {
    let codDollar = Math.round((before.codDollar + (parseFloat(codToAdd) || 0)) * 100) / 100;
    let dodDollar = Math.round((before.dodDollar + (parseFloat(dodToAdd) || 0)) * 100) / 100;
    let totalCount = before.totalCount + (parseFloat(countToAdd) || 0);
    if (codDollar < 0 || dodDollar < 0 || totalCount < 0) {
        if (window.ZoeErrors) ZoeErrors.capture(new Error(label + ' revenue underflow clamped to 0'), { zone: 'money', context: context, codDollar, dodDollar, totalCount });
    }
    if (codDollar < 0) codDollar = 0;
    if (dodDollar < 0) dodDollar = 0;
    if (totalCount < 0) totalCount = 0;
    return { codDollar, dodDollar, totalCount };
}

export function revertLedgerRecordInMemory(recordRef, applied) {
    recordRef.codDollar = Math.round((ledgerNumber(recordRef.codDollar) - applied.cod) * 100) / 100;
    recordRef.dodDollar = Math.round((ledgerNumber(recordRef.dodDollar) - applied.dod) * 100) / 100;
    recordRef.totalCount = ledgerNumber(recordRef.totalCount) - applied.count;
    if (recordRef.codDollar < 0) recordRef.codDollar = 0;
    if (recordRef.dodDollar < 0) recordRef.dodDollar = 0;
    if (recordRef.totalCount < 0) recordRef.totalCount = 0;
}

export function applyLedgerBucketDelta(bucketMap, key, codToAdd, dodToAdd, countToAdd) {
    if (!bucketMap[key]) bucketMap[key] = { codDollar: 0, dodDollar: 0, totalCount: 0 };
    const bucket = bucketMap[key];
    const before = { ...bucket };

    bucket.codDollar = Math.round(((parseFloat(bucket.codDollar) || 0) + (parseFloat(codToAdd) || 0)) * 100) / 100;
    bucket.dodDollar = Math.round(((parseFloat(bucket.dodDollar) || 0) + (parseFloat(dodToAdd) || 0)) * 100) / 100;
    bucket.totalCount = (parseFloat(bucket.totalCount) || 0) + (parseFloat(countToAdd) || 0);

    if (bucket.codDollar < 0) bucket.codDollar = 0;
    if (bucket.dodDollar < 0) bucket.dodDollar = 0;
    if (bucket.totalCount < 0) bucket.totalCount = 0;

    return ledgerAppliedDelta(before, bucket);
}

export function commitRevenueBucketDelta(scanDateStr, bucket, codToAdd, dodToAdd, countToAdd) {
    if (!codToAdd && !dodToAdd && !countToAdd) return { applied: { cod: 0, dod: 0, count: 0 }, server: Promise.resolve(null) };
    if (bucket === 'daily') {
        const applied = applyLedgerBucketDelta(dataState.dailyRevenueData, scanDateStr, codToAdd, dodToAdd, countToAdd);
        return { applied, server: commitDailyRevenueDelta(scanDateStr, codToAdd, dodToAdd, countToAdd, applied) };
    }
    const ymKey = scanDateStr.substring(0, 7);
    const applied = applyLedgerBucketDelta(dataState.monthlyRevenueData, ymKey, codToAdd, dodToAdd, countToAdd);
    return { applied, server: commitMonthlyRevenueDelta(ymKey, codToAdd, dodToAdd, countToAdd, applied) };
}

export function addRevenueToDailyAndMonthlyRecord(scanDateStr, codToAdd, dodToAdd, countToAdd, companion?) {
    const operationDb = firebaseState.db;
    const operationAuth = firebaseState.authGeneration;
    if (!scanDateStr) scanDateStr = getFormattedDate();
    const ymKey = scanDateStr.substring(0, 7);
    const appliedDaily = applyLedgerBucketDelta(dataState.dailyRevenueData, scanDateStr, codToAdd, dodToAdd, countToAdd);
    const dailyServer = commitDailyRevenueDelta(scanDateStr, codToAdd, dodToAdd, countToAdd, appliedDaily, false, companion);
    const appliedMonthly = applyLedgerBucketDelta(dataState.monthlyRevenueData, ymKey, codToAdd, dodToAdd, countToAdd);
    const monthlyServer = commitMonthlyRevenueDelta(ymKey, codToAdd, dodToAdd, countToAdd, appliedMonthly, false, companion);
    return {
        isCurrent: () => operationDb === firebaseState.db && operationAuth === firebaseState.authGeneration,
        scanDate: scanDateStr,
        daily: appliedDaily, monthly: appliedMonthly,
        dailyServer: dailyServer,
        monthlyServer: alignMonthlyLedgerToDaily(ymKey, dailyServer, monthlyServer)
    };
}

export const LEDGER_OP_RING_MAX = 12;

export function ledgerOpRingOf(record) {
    const ring = {};
    const ops = record && typeof record === 'object' ? record.ops : null;
    if (!ops || typeof ops !== 'object') return ring;
    Object.keys(ops).forEach((key) => {
        const seq = ops[key];
        if (typeof seq === 'number' && isFinite(seq) && seq >= 1 && /^op_[0-9a-z_]{5,37}$/.test(key)) ring[key] = seq;
    });
    return ring;
}

export function ledgerOpRing(record, op) {
    const ring = ledgerOpRingOf(record);
    const keys = Object.keys(ring);
    let top = keys.reduce((max, key) => Math.max(max, ring[key]), 0);
    if (!keys.length && record && typeof record === 'object') top = 1;
    ring[op] = top + 1;
    Object.keys(ring).sort((a, b) => ring[b] - ring[a]).slice(LEDGER_OP_RING_MAX).forEach((key) => { delete ring[key]; });
    return ring;
}

export function ledgerOpWitness(server, prior, op) {
    if (!op || !server || typeof server !== 'object') return null;
    const ring = ledgerOpRingOf(server);
    const has = (key) => Object.prototype.hasOwnProperty.call(ring, key);
    if (server.op === op || has(op)) return 'applied';
    const before = ledgerOpRing(prior, op);
    delete before[op];
    if (Object.keys(before).some(has)) return 'not-applied';
    if ((!prior || typeof prior !== 'object') && Object.keys(ring).some((key) => ring[key] === 1)) return 'not-applied';
    return null;
}

export function ledgerTagged(record, op, ring) {
    if (!op) return record;
    return ring ? { ...record, op, ops: ring } : { ...record, op };
}

export function runLedgerTransaction(ref, update, notAppliedRetries = 3, recordOf = (value) => value, event?, connectionIntent?) {
    const sdk = firebaseState.fb;
    let op = event ? event.token : 'op_';
    if (!event) {
        try {
            const bytes = new Uint8Array(12);
            crypto.getRandomValues(bytes);
            bytes.forEach((b) => { op += (b % 36).toString(36); });
        } catch (e) {
            op = 'op_';
            for (let i = 0; i < 12; i++) op += Math.floor(Math.random() * 36).toString(36);
        }
    }
    const send = (retries) => {
        let lastDelta = null;
        let replayed = false;
        let proposalBefore = null;
        const epoch = !sdk.__supabase && typeof sdk.connectionEpoch === 'function' ? sdk.connectionEpoch(ref) : null;
        const updater: any = (current) => {
            const record = recordOf(current);
            if (!event && ledgerTokenSeen(record, op)) {
                if (!lastDelta) throw Object.assign(new Error('Ledger operation outcome unknown'), { txOutcome: 'unknown' });
                replayed = true;
                return current;
            }
            if (lastDelta && epoch !== null && epoch !== sdk.connectionEpoch(ref)
                && ledgerOpWitness(record, proposalBefore, op) !== 'not-applied') throw Object.assign(new Error('Ledger operation outcome unknown'), { txOutcome: 'unknown' });
            const before = ledgerTotalsOf(record);
            if (!lastDelta) proposalBefore = record && typeof record === 'object' ? JSON.parse(JSON.stringify(record)) : record;
            const next = update(current, op, ledgerOpRing(recordOf(current), op), !!event);
            if (next !== undefined) lastDelta = ledgerAppliedDelta(before, ledgerTotalsOf(recordOf(next)));
            return next;
        };
        if (connectionIntent) updater.connectionIntent = { ...connectionIntent, token: op, keyed: !!event };
        updater.txOutcomeWitness = event
            ? (server, prior) => event.witness(recordOf(server), recordOf(prior))
            : (server, prior) => ledgerOpWitness(recordOf(server), recordOf(prior), op);
        return sdk.runTransaction(ref, updater).then((result) => replayed && result && result.committed ? { ...result, txAppliedDelta: lastDelta } : result).catch((error) => {
            if (error && error.txOutcome === 'not-applied' && retries > 0) return send(retries - 1);
            throw error;
        });
    };
    return send(notAppliedRetries);
}

export function ledgerJournalRecord(value, intent) {
    return intent.bucket === 'daily' ? value : value && typeof value === 'object' ? value[intent.key] : null;
}

export function ledgerJournalWitness(value, prior, intent) {
    const record = ledgerJournalRecord(value, intent);
    if (intent.kind === 'ledger-event') {
        const entry = ledgerDedOf(record, intent.trashId);
        if (entry && entry.at === intent.at && (intent.mode !== 'undo' || entry.back && entry.undo)) return 'applied';
    }
    return ledgerOpWitness(record, ledgerJournalRecord(prior, intent), intent.token);
}

export function ledgerJournalUpdate(value, intent) {
    const daily = intent.bucket === 'daily';
    const months = daily ? null : value && typeof value === 'object' ? value : {};
    const record = daily ? value : months[intent.key] || null;
    const ring = ledgerOpRing(record, intent.token);
    let cod = intent.cod; let dod = intent.dod; let count = intent.count; let decision;
    if (intent.kind === 'ledger-event') {
        decision = ledgerEventDecision(daily, intent.mode, record, intent.trashId, intent.at, intent.prior, intent.deductionPrior);
        if (decision.state !== 'apply') return;
        const size = intent.mode === 'undo' && decision.entry ? decision.entry : intent.amounts;
        cod = decision.sign * ledgerNumber(size.cod); dod = decision.sign * ledgerNumber(size.dod); count = decision.sign * ledgerNumber(size.count);
    }
    const before = ledgerTotalsOf(record);
    const after = ledgerDeltaWithClamp(before, cod, dod, count, daily ? 'Daily' : 'Monthly', intent.key);
    let next = ledgerCarryDed(record, after);
    if (intent.kind === 'ledger-event' && intent.keyed) {
        const applied = ledgerAppliedDelta(before, after);
        const entry = intent.mode === 'undo'
            ? { at: intent.at, cod: decision.entry.cod, dod: decision.entry.dod, count: decision.entry.count, back: true, undo: true }
            : { at: intent.at, cod: -applied.cod, dod: -applied.dod, count: -applied.count };
        next = { ...next, ded: { ...(next.ded || {}), [intent.trashId]: ledgerDedValue(entry) } };
    }
    const tagged = ledgerTagged(next, intent.token, ring);
    if (daily) return tagged;
    months[intent.key] = tagged;
    return ledgerLatestMonths(months);
}

export function ledgerEventToken(trashId, at, mode) {
    const text = String(trashId) + '|' + String(at) + '|' + String(mode);
    let a = 0x811c9dc5;
    let b = 0x9747b28c;
    for (let i = 0; i < text.length; i++) {
        const c = text.charCodeAt(i);
        a = Math.imul(a ^ c, 0x01000193) >>> 0;
        b = Math.imul(b ^ c, 0x5bd1e995) >>> 0;
        b = (b ^ (b >>> 13)) >>> 0;
    }
    return 'op_k' + String(mode) + a.toString(36).padStart(7, '0') + b.toString(36).padStart(7, '0');
}

export function ledgerRecordTokens(record) {
    const tokens = Object.keys(ledgerOpRingOf(record));
    const op = record && typeof record === 'object' ? record.op : null;
    if (typeof op === 'string' && /^op_[0-9a-z_]{5,37}$/.test(op) && tokens.indexOf(op) === -1) tokens.push(op);
    return tokens;
}

export function ledgerTokenSeen(record, token) {
    return !!token && ledgerRecordTokens(record).indexOf(token) !== -1;
}

export function ledgerPriorSeen(record, prior) {
    if (!Array.isArray(prior) || !prior.length) return false;
    const seen = ledgerRecordTokens(record);
    return prior.some((token) => seen.indexOf(token) !== -1);
}

export function ledgerDedOf(record, trashId) {
    const ded = record && typeof record === 'object' && record.ded && typeof record.ded === 'object' ? record.ded : null;
    const entry = ded && typeof trashId === 'string' ? ded[trashId] : null;
    if (!entry || typeof entry !== 'object' || typeof entry.at !== 'number' || !isFinite(entry.at) || entry.at <= 0) return null;
    return {
        at: entry.at,
        cod: Math.max(0, ledgerNumber(entry.cod)),
        dod: Math.max(0, ledgerNumber(entry.dod)),
        count: Math.max(0, ledgerNumber(entry.count)),
        back: entry.back === true,
        undo: entry.undo === true
    };
}

export function ledgerDedValue(entry) {
    const value: any = { at: entry.at, cod: entry.cod, dod: entry.dod, count: entry.count };
    if (entry.back) value.back = true;
    if (entry.undo) value.undo = true;
    return value;
}

export function ledgerCarryDed(record, next) {
    const ded = record && typeof record === 'object' && record.ded && typeof record.ded === 'object' ? record.ded : null;
    if (!ded) return next;
    const kept = {};
    Object.keys(ded).forEach((trashId) => {
        if (!/^[a-zA-Z0-9_-]{1,64}$/.test(trashId)) return;
        const entry = ledgerDedOf(record, trashId);
        if (entry) kept[trashId] = ledgerDedValue(entry);
    });
    return Object.keys(kept).length ? { ...next, ded: kept } : next;
}

export function ledgerTotalsOf(record) {
    return {
        codDollar: parseFloat(record && record.codDollar) || 0,
        dodDollar: parseFloat(record && record.dodDollar) || 0,
        totalCount: parseFloat(record && record.totalCount) || 0
    };
}

export function ledgerLatestMonths(months) {
    const latest = {};
    Object.keys(months).sort().reverse().slice(0, 3).forEach((key) => {
        latest[key] = months[key];
    });
    return latest;
}

export function ledgerMirrorStep(map, key, token, before, after) {
    if (!map || typeof map !== 'object') return;
    if (map[key] && ledgerTokenSeen(map[key], token)) return;
    const delta = ledgerAppliedDelta(before, after);
    if (!delta.cod && !delta.dod && !delta.count) return;
    applyLedgerBucketDelta(map, key, delta.cod, delta.dod, delta.count);
}

export function ledgerEventDecision(daily, mode, record, trashId, at, prior, deductionPrior) {
    const tokenD = ledgerEventToken(trashId, at, 'd');
    const tokenU = ledgerEventToken(trashId, at, 'u');
    const entry = ledgerDedOf(record, trashId);
    const same = !!entry && entry.at === at;
    if (mode !== 'undo') {
        if (same) return { state: entry.back ? 'restored' : 'already', entry };
        if (ledgerTokenSeen(record, tokenD)) return { state: 'already' };
        if (prior && !ledgerPriorSeen(record, prior)) return { state: 'unknown' };
        return { state: 'apply', sign: -1 };
    }
    if (same && entry.back) return { state: 'already', undo: entry.undo, entry };
    if (same) return { state: 'apply', sign: 1, entry };
    if (daily) {
        if (ledgerTokenSeen(record, tokenU)) return { state: 'already', undo: true };
        if (ledgerTokenSeen(record, tokenD)) return { state: 'unknown' };
        return { state: ledgerPriorSeen(record, prior) ? 'absent' : 'unknown' };
    }
    if (ledgerTokenSeen(record, tokenU)) return { state: 'already' };
    if (prior && !ledgerPriorSeen(record, prior)) return { state: 'unknown' };
    if (deductionPrior && !ledgerTokenSeen(record, tokenD)) return { state: ledgerPriorSeen(record, deductionPrior) ? 'absent' : 'unknown' };
    return { state: 'unknown' };
}

export function commitLedgerEventStep(bucket, scanDateStr, trashId, at, mode, amounts, prior, deductionPrior?) {
    const daily = bucket === 'daily';
    const undo = mode === 'undo';
    const ymKey = String(scanDateStr).substring(0, 7);
    const token = ledgerEventToken(trashId, at, undo ? 'u' : 'd');
    if (!firebaseState.fb || !firebaseState.db || !(daily ? firebaseState.dbRefDailyRevenue : firebaseState.dbRefMonthlyRevenue)) {
        return Promise.resolve({ state: 'failed' });
    }
    const ref = daily ? firebaseState.fb.ref(firebaseState.db, `zoew_daily_revenue_cod_dod/${scanDateStr}`) : firebaseState.dbRefMonthlyRevenue;
    const recordOf = daily ? (value) => value : (value) => (value && typeof value === 'object' ? value[ymKey] : null);
    const operationDb = firebaseState.db;
    const operationAuth = firebaseState.authGeneration;
    const current = () => operationDb === firebaseState.db && operationAuth === firebaseState.authGeneration;
    let verdict = null;
    const update = (value, op, ring, keyed) => {
        verdict = null;
        const months = daily ? null : (value && typeof value === 'object' ? value : {});
        const record = daily ? value : (months[ymKey] || null);
        const decision: any = ledgerEventDecision(daily, mode, record, trashId, at, prior, deductionPrior);
        if (decision.state !== 'apply') {
            verdict = decision;
            return undefined;
        }
        const size = undo && decision.entry ? decision.entry : amounts;
        const sign = decision.sign;
        const before = ledgerTotalsOf(record);
        const after = ledgerDeltaWithClamp(before, sign * ledgerNumber(size.cod), sign * ledgerNumber(size.dod), sign * ledgerNumber(size.count),
            daily ? 'Daily' : 'Monthly', daily ? scanDateStr : ymKey);
        const applied = ledgerAppliedDelta(before, after);
        let next = ledgerCarryDed(record, after);
        let entry = decision.entry || null;
        if (keyed) {
            entry = undo
                ? { at, cod: decision.entry.cod, dod: decision.entry.dod, count: decision.entry.count, back: true, undo: true }
                : { at, cod: -applied.cod, dod: -applied.dod, count: -applied.count };
            next = { ...next, ded: { ...(next.ded || {}), [trashId]: ledgerDedValue(entry) } };
        }
        verdict = { state: 'applied', before, after, entry };
        const tagged = ledgerTagged(next, token, ring);
        if (daily) return tagged;
        months[ymKey] = tagged;
        return ledgerLatestMonths(months);
    };
    const witness = (server, prior2) => {
        const entry = ledgerDedOf(server, trashId);
        if (entry && entry.at === at && (!undo || (entry.back && entry.undo))) return 'applied';
        return ledgerOpWitness(server, prior2, token);
    };
    return runLedgerTransaction(ref, update, 3, recordOf, { token, witness, requireReceipt: true }, { kind: 'ledger-event', bucket, key: daily ? scanDateStr : ymKey, trashId, at, mode, amounts, prior, deductionPrior }).then((result) => {
        if (!current()) return { state: 'stale' };
        if (!verdict) return { state: 'failed' };
        if (verdict.state !== 'applied') return verdict;
        if (!result || !result.committed) return { state: 'failed' };
        ledgerMirrorStep(daily ? dataState.dailyRevenueData : dataState.monthlyRevenueData, daily ? scanDateStr : ymKey, token, verdict.before, verdict.after);
        return verdict;
    }, (error) => {
        if (!current()) return { state: 'stale' };
        if (/permission[_ ]denied/i.test(String((error && (error.code || error.message)) || error))) return { state: 'failed' };
        return { state: error && error.txOutcome === 'unknown' ? 'unknown' : 'failed' };
    });
}

export function ledgerZeroDelta() {
    return { cod: 0, dod: 0, count: 0 };
}

export function ledgerRejectionVerdict(error) {
    return error && error.txOutcome === 'unknown' ? { cod: 0, dod: 0, count: 0, unknown: true } : null;
}

export function ledgerMarkUnknown(total, unknown) {
    return unknown ? { ...total, unknown: true } : total;
}

export function ledgerServerVerdict(serverPromise) {
    return Promise.resolve(serverPromise).then(
        (serverApplied) => serverApplied || ledgerZeroDelta(),
        (error) => ledgerRejectionVerdict(error) || ledgerZeroDelta()
    );
}

export function ledgerMemoryCompensationClaimed(applied) {
    if (!applied || typeof applied !== 'object') return false;
    if (applied.memoryCompensated) return true;
    applied.memoryCompensated = true;
    return false;
}

export function revertLedgerBucketOnServer(scanDateStr, bucket, serverPromise) {
    const operationDb = firebaseState.db;
    const operationAuth = firebaseState.authGeneration;
    return ledgerServerVerdict(serverPromise).then((d) => {
        if (operationDb !== firebaseState.db || operationAuth !== firebaseState.authGeneration) return null;
        if (!d || (!d.cod && !d.dod && !d.count)) return null;
        const ymKey = scanDateStr.substring(0, 7);
        return bucket === 'daily'
            ? commitDailyRevenueDelta(scanDateStr, -d.cod, -d.dod, -d.count, d, true)
            : commitMonthlyRevenueDelta(ymKey, -d.cod, -d.dod, -d.count, d, true);
    }, () => null);
}

export function revertRevenueLedgerDelta(applied) {
    if (!applied || !applied.scanDate) return null;
    if (typeof applied.isCurrent === 'function' && !applied.isCurrent()) return null;
    const daily = applied.daily || { cod: 0, dod: 0, count: 0 };
    const monthly = applied.monthly || { cod: 0, dod: 0, count: 0 };
    if ((daily.cod || daily.dod || daily.count) && !ledgerMemoryCompensationClaimed(daily)) {
        applyLedgerBucketDelta(dataState.dailyRevenueData, applied.scanDate, -daily.cod, -daily.dod, -daily.count);
    }
    if ((monthly.cod || monthly.dod || monthly.count) && !ledgerMemoryCompensationClaimed(monthly)) {
        applyLedgerBucketDelta(dataState.monthlyRevenueData, applied.scanDate.substring(0, 7), -monthly.cod, -monthly.dod, -monthly.count);
    }
    revertLedgerBucketOnServer(applied.scanDate, 'daily', applied.dailyServer);
    revertLedgerBucketOnServer(applied.scanDate, 'monthly', applied.monthlyServer);
    return applied;
}

export function correctRevenueLedgerToActual(scanDateStr, applied, actualCod, actualDod, actualCount) {
    const operationDb = firebaseState.db;
    const operationAuth = firebaseState.authGeneration;
    const current = () => operationDb === firebaseState.db && operationAuth === firebaseState.authGeneration
        && !(applied && typeof applied.isCurrent === 'function' && !applied.isCurrent());
    const r2 = (n) => Math.round(n * 100) / 100;
    const desired = { cod: ledgerNumber(actualCod), dod: ledgerNumber(actualDod), count: ledgerNumber(actualCount) };
    return Promise.all([
        ledgerServerVerdict(applied && applied.dailyServer),
        ledgerServerVerdict(applied && applied.monthlyServer)
    ]).then((initial) => {
        if (!current()) return { ok: false, stale: true, daily: initial[0], monthly: initial[1] };
        const daily = initial[0];
        const monthly = initial[1];
        if (daily.unknown || monthly.unknown) return { ok: false, stale: false, pending: true, daily, monthly };
        const dailyNeed = {
            cod: r2(desired.cod - daily.cod),
            dod: r2(desired.dod - daily.dod),
            count: desired.count - daily.count
        };
        const monthlyNeed = {
            cod: r2(desired.cod - monthly.cod),
            dod: r2(desired.dod - monthly.dod),
            count: desired.count - monthly.count
        };
        const dailyNeeded = !!(dailyNeed.cod || dailyNeed.dod || dailyNeed.count);
        const monthlyNeeded = !!(monthlyNeed.cod || monthlyNeed.dod || monthlyNeed.count);
        const dailyFix = dailyNeeded
            ? commitRevenueBucketDelta(scanDateStr, 'daily', dailyNeed.cod, dailyNeed.dod, dailyNeed.count).server
            : Promise.resolve(ledgerZeroDelta());
        const monthlyFix = monthlyNeeded
            ? commitRevenueBucketDelta(scanDateStr, 'monthly', monthlyNeed.cod, monthlyNeed.dod, monthlyNeed.count).server
            : Promise.resolve(ledgerZeroDelta());
        const dailyStatus = Promise.resolve(dailyFix).then(
            (value) => ({ ok: !dailyNeeded || value !== null, delta: value || ledgerZeroDelta() }),
            (error) => ({ ok: false, delta: ledgerRejectionVerdict(error) || ledgerZeroDelta() })
        );
        const monthlyStatus = Promise.resolve(monthlyFix).then(
            (value) => ({ delta: value || ledgerZeroDelta() }),
            (error) => ({ delta: ledgerRejectionVerdict(error) || ledgerZeroDelta() })
        );
        return Promise.all([dailyStatus, monthlyStatus]).then((fixed) => {
            if (!current()) return { ok: false, stale: true, daily: daily, monthly: monthly };
            const unknownOutcome = !!(daily.unknown || monthly.unknown || fixed[0].delta.unknown || fixed[1].delta.unknown);
            const dailyTotal = ledgerMarkUnknown({
                cod: r2(daily.cod + fixed[0].delta.cod),
                dod: r2(daily.dod + fixed[0].delta.dod),
                count: daily.count + fixed[0].delta.count
            }, daily.unknown || fixed[0].delta.unknown);
            const monthlyTotal = ledgerMarkUnknown({
                cod: r2(monthly.cod + fixed[1].delta.cod),
                dod: r2(monthly.dod + fixed[1].delta.dod),
                count: monthly.count + fixed[1].delta.count
            }, monthly.unknown || fixed[1].delta.unknown);
            if (unknownOutcome) return { ok: false, stale: false, pending: true, daily: dailyTotal, monthly: monthlyTotal };
            return ledgerServerVerdict(alignMonthlyLedgerToDaily(
                scanDateStr.substring(0, 7),
                Promise.resolve(dailyTotal),
                Promise.resolve(monthlyTotal)
            )).then((alignedMonthly) => ({
                ok: fixed[0].ok
                    && !unknownOutcome && !alignedMonthly.unknown
                    && dailyTotal.cod === desired.cod
                    && dailyTotal.dod === desired.dod
                    && dailyTotal.count === desired.count
                    && dailyTotal.cod === alignedMonthly.cod
                    && dailyTotal.dod === alignedMonthly.dod
                    && dailyTotal.count === alignedMonthly.count,
                stale: false,
                daily: dailyTotal,
                monthly: alignedMonthly
            }));
        });
    });
}

export function alignMonthlyLedgerToDaily(ymKey, dailyServer, monthlyServer) {
    const operationDb = firebaseState.db;
    const operationAuth = firebaseState.authGeneration;
    const monthlyVerdict = ledgerServerVerdict(monthlyServer);
    return Promise.all([ledgerServerVerdict(dailyServer), monthlyVerdict]).then((verdicts) => {
        const dailyApplied = verdicts[0];
        const monthlyApplied = verdicts[1];
        if (operationDb !== firebaseState.db || operationAuth !== firebaseState.authGeneration) return monthlyApplied;
        if (dailyApplied.unknown || monthlyApplied.unknown) return ledgerMarkUnknown(monthlyApplied, true);
        const cod = Math.round((dailyApplied.cod - monthlyApplied.cod) * 100) / 100;
        const dod = Math.round((dailyApplied.dod - monthlyApplied.dod) * 100) / 100;
        const count = dailyApplied.count - monthlyApplied.count;
        if (!cod && !dod && !count) return monthlyApplied;
        return ledgerServerVerdict(commitMonthlyRevenueDelta(ymKey, cod, dod, count, null, true)).then((fix) => ledgerMarkUnknown({
            cod: Math.round((monthlyApplied.cod + fix.cod) * 100) / 100,
            dod: Math.round((monthlyApplied.dod + fix.dod) * 100) / 100,
            count: monthlyApplied.count + fix.count
        }, monthlyApplied.unknown || fix.unknown), () => monthlyApplied);
    }).catch(() => monthlyVerdict);
}

export function ledgerDeltaCompanion(itemId, code, cod?, dod?, priorCod?, priorDod?, createdAt?) {
    if (!itemId || !/^[a-zA-Z0-9_-]+$/.test(String(itemId)) || !code) return null;
    const companion: any = { path: 'zoew_scan_history_cod_dod/' + itemId, code: String(code) };
    if (typeof cod === 'number' && isFinite(cod)) companion.wantCod = cod;
    if (typeof dod === 'number' && isFinite(dod)) companion.wantDod = dod;
    if (typeof priorCod === 'number' && isFinite(priorCod)) companion.priorCod = priorCod;
    if (typeof priorDod === 'number' && isFinite(priorDod)) companion.priorDod = priorDod;
    if (typeof createdAt === 'number' && isFinite(createdAt) && createdAt > 0) companion.createdAt = createdAt;
    return companion;
}

export function ledgerCompanionCopyState(roots, companion) {
    const createdAt = companion && Number(companion.createdAt);
    if (!(createdAt > 0) || !Array.isArray(roots)) return 'absent';
    for (const root of roots) {
        if (!root || typeof root !== 'object') continue;
        for (const id of Object.keys(root)) {
            const node = root[id];
            const list = node && typeof node === 'object' ? node.barcodes : null;
            const barcodes = Array.isArray(list) ? list : list && typeof list === 'object' ? Object.keys(list).map((k) => list[k]) : [];
            const copy = barcodes.find((b) => b && b.code === companion.code && Number(b.createdAt) === createdAt);
            if (copy) return ledgerCompanionState({ barcodes: [copy] }, companion);
        }
    }
    return 'absent';
}

export function ledgerCompanionState(item, companion) {
    const list = item && typeof item === 'object' ? item.barcodes : null;
    const barcodes = Array.isArray(list) ? list : list && typeof list === 'object' ? Object.keys(list).map((k) => list[k]) : [];
    let found = barcodes.find((b) => b && b.code === companion.code) || null;
    if (!found) return 'absent';
    const near = (actual, expected) => typeof expected !== 'number' || Math.abs((parseFloat(actual) || 0) - expected) < 0.005;
    if (near(found.cod, companion.wantCod) && near(found.dod, companion.wantDod)) return 'holds';
    if (typeof companion.priorCod === 'number' && near(found.cod, companion.priorCod) && near(found.dod, companion.priorDod)) return 'prior';
    return 'unknown';
}

export function ledgerDeltaIntent(bucket, key, cod, dod, count, companion?) {
    const intent: any = { kind: 'revenue-delta', bucket, key, cod, dod, count };
    if (companion && typeof companion === 'object' && companion.path && companion.code) intent.companion = companion;
    return intent;
}

export function commitDailyRevenueDelta(scanDateStr, codToAdd, dodToAdd, countToAdd, appliedDelta, serverOnly?, companion?) {
    const applied = appliedDelta || { cod: ledgerNumber(codToAdd), dod: ledgerNumber(dodToAdd), count: ledgerNumber(countToAdd) };
    const recordRef = serverOnly ? null : dataState.dailyRevenueData[scanDateStr];
    const rollbackMemory = () => {
        if (recordRef && dataState.dailyRevenueData[scanDateStr] === recordRef && !ledgerMemoryCompensationClaimed(applied)) {
            revertLedgerRecordInMemory(recordRef, applied);
            refreshCurrentHistoryView();
        }
    };
    if (!firebaseState.dbRefDailyRevenue) {
        rollbackMemory();
        return Promise.resolve(null);
    }
    const dateRef = firebaseState.fb.ref(firebaseState.db, `zoew_daily_revenue_cod_dod/${scanDateStr}`);
    let serverBefore = null;
    let serverAfter = null;
    return runLedgerTransaction(dateRef, (current, op, ring) => {
        serverBefore = {
            codDollar: parseFloat(current && current.codDollar) || 0,
            dodDollar: parseFloat(current && current.dodDollar) || 0,
            totalCount: parseFloat(current && current.totalCount) || 0
        };
        serverAfter = ledgerCarryDed(current, ledgerDeltaWithClamp(serverBefore, codToAdd, dodToAdd, countToAdd, 'Daily', scanDateStr));
        return ledgerTagged(serverAfter, op, ring);
    }, 3, (value) => value, null, ledgerDeltaIntent('daily', scanDateStr, codToAdd, dodToAdd, countToAdd, companion)).then((result) => {
        if (result && result.committed && result.txAppliedDelta) return result.txAppliedDelta;
        if (!result || !result.committed || !serverBefore || !serverAfter) {
            rollbackMemory();
            showToast("⚠️ បរាជ័យក្នុងការ Save Daily Revenue!");
            return null;
        }
        return ledgerAppliedDelta(serverBefore, serverAfter);
    }, (error) => {
        rollbackMemory();
        showToast("⚠️ បរាជ័យក្នុងការ Save Daily Revenue!");
        return ledgerRejectionVerdict(error);
    });
}

export function commitMonthlyRevenueDelta(ymKey, codToAdd, dodToAdd, countToAdd, appliedDelta, serverOnly?, companion?) {
    const applied = appliedDelta || { cod: ledgerNumber(codToAdd), dod: ledgerNumber(dodToAdd), count: ledgerNumber(countToAdd) };
    const recordRef = serverOnly ? null : dataState.monthlyRevenueData[ymKey];
    const rollbackMemory = () => {
        if (recordRef && dataState.monthlyRevenueData[ymKey] === recordRef && !ledgerMemoryCompensationClaimed(applied)) {
            revertLedgerRecordInMemory(recordRef, applied);
        }
    };
    if (!firebaseState.dbRefMonthlyRevenue) {
        rollbackMemory();
        return Promise.resolve(null);
    }
    let serverBefore = null;
    let serverAfter = null;
    return runLedgerTransaction(firebaseState.dbRefMonthlyRevenue, (current, op, ring) => {
        const months = (current && typeof current === 'object') ? current : {};
        const existing = months[ymKey] || {};
        serverBefore = {
            codDollar: parseFloat(existing.codDollar) || 0,
            dodDollar: parseFloat(existing.dodDollar) || 0,
            totalCount: parseFloat(existing.totalCount) || 0
        };
        serverAfter = ledgerDeltaWithClamp(serverBefore, codToAdd, dodToAdd, countToAdd, 'Monthly', ymKey);
        months[ymKey] = ledgerTagged(ledgerCarryDed(existing, serverAfter), op, ring);
        return ledgerLatestMonths(months);
    }, 3, (value) => (value && typeof value === 'object' ? value[ymKey] : null), null, ledgerDeltaIntent('monthly', ymKey, codToAdd, dodToAdd, countToAdd, companion)).then((result) => {
        if (result && result.committed && result.txAppliedDelta) return result.txAppliedDelta;
        if (!result || !result.committed || !serverBefore || !serverAfter) {
            rollbackMemory();
            showToast("⚠️ បរាជ័យក្នុងការ Save Monthly Revenue!");
            return null;
        }
        const storedMonths = result.snapshot ? result.snapshot.val() : null;
        const storedMonth = (storedMonths && typeof storedMonths === 'object') ? storedMonths[ymKey] : null;
        if (!storedMonth || typeof storedMonth !== 'object') return ledgerZeroDelta();
        return ledgerAppliedDelta(serverBefore, storedMonth);
    }, (error) => {
        rollbackMemory();
        showToast("⚠️ បរាជ័យក្នុងការ Save Monthly Revenue!");
        return ledgerRejectionVerdict(error);
    });
}
