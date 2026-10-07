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

export function addRevenueToDailyAndMonthlyRecord(scanDateStr, codToAdd, dodToAdd, countToAdd) {
    const operationDb = firebaseState.db;
    const operationAuth = firebaseState.authGeneration;
    if (!scanDateStr) scanDateStr = getFormattedDate();
    const ymKey = scanDateStr.substring(0, 7);
    const appliedDaily = applyLedgerBucketDelta(dataState.dailyRevenueData, scanDateStr, codToAdd, dodToAdd, countToAdd);
    const dailyServer = commitDailyRevenueDelta(scanDateStr, codToAdd, dodToAdd, countToAdd, appliedDaily);
    const appliedMonthly = applyLedgerBucketDelta(dataState.monthlyRevenueData, ymKey, codToAdd, dodToAdd, countToAdd);
    const monthlyServer = commitMonthlyRevenueDelta(ymKey, codToAdd, dodToAdd, countToAdd, appliedMonthly);
    return {
        isCurrent: () => operationDb === firebaseState.db && operationAuth === firebaseState.authGeneration,
        scanDate: scanDateStr,
        daily: appliedDaily, monthly: appliedMonthly,
        dailyServer: dailyServer,
        monthlyServer: alignMonthlyLedgerToDaily(ymKey, dailyServer, monthlyServer)
    };
}

export function runLedgerTransaction(ref, update, notAppliedRetries = 3) {
    const sdk = firebaseState.fb;
    let op = 'op_';
    try {
        const bytes = new Uint8Array(12);
        crypto.getRandomValues(bytes);
        bytes.forEach((b) => { op += (b % 36).toString(36); });
    } catch (e) {
        op = 'op_';
        for (let i = 0; i < 12; i++) op += Math.floor(Math.random() * 36).toString(36);
    }
    const send = (tagged, retries) => sdk.runTransaction(ref, (current) => update(current, tagged ? op : null)).catch((error) => {
        if (error && error.txOutcome === 'not-applied' && retries > 0) return send(tagged, retries - 1);
        if (!tagged || !/permission[_ ]denied/i.test(String((error && (error.code || error.message)) || error))) throw error;
        return send(false, retries);
    });
    return send(true, notAppliedRetries);
}

export function ledgerZeroDelta() {
    return { cod: 0, dod: 0, count: 0 };
}

export function ledgerRejectionVerdict(error) {
    return error && error.txOutcome === 'unknown' && error.txServerUnread === true ? { cod: 0, dod: 0, count: 0, unknown: true } : null;
}

export function ledgerMarkUnknown(total, unknown) {
    return unknown ? { ...total, unknown: true } : total;
}

export function ledgerServerVerdict(serverPromise) {
    return Promise.resolve(serverPromise).then(
        (serverApplied) => serverApplied || ledgerZeroDelta(),
        () => ledgerZeroDelta()
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
            () => ({ ok: false, delta: ledgerZeroDelta() })
        );
        const monthlyStatus = Promise.resolve(monthlyFix).then(
            (value) => ({ delta: value || ledgerZeroDelta() }),
            () => ({ delta: ledgerZeroDelta() })
        );
        return Promise.all([dailyStatus, monthlyStatus]).then((fixed) => {
            if (!current()) return { ok: false, stale: true, daily: daily, monthly: monthly };
            const unknownOutcome = !!(daily.unknown || monthly.unknown || fixed[0].delta.unknown || fixed[1].delta.unknown);
            const dailyTotal = {
                cod: r2(daily.cod + fixed[0].delta.cod),
                dod: r2(daily.dod + fixed[0].delta.dod),
                count: daily.count + fixed[0].delta.count
            };
            const monthlyTotal = {
                cod: r2(monthly.cod + fixed[1].delta.cod),
                dod: r2(monthly.dod + fixed[1].delta.dod),
                count: monthly.count + fixed[1].delta.count
            };
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

export function commitDailyRevenueDelta(scanDateStr, codToAdd, dodToAdd, countToAdd, appliedDelta, serverOnly?) {
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
    return runLedgerTransaction(dateRef, (current, op) => {
        serverBefore = {
            codDollar: parseFloat(current && current.codDollar) || 0,
            dodDollar: parseFloat(current && current.dodDollar) || 0,
            totalCount: parseFloat(current && current.totalCount) || 0
        };
        serverAfter = ledgerDeltaWithClamp(serverBefore, codToAdd, dodToAdd, countToAdd, 'Daily', scanDateStr);
        return op ? { ...serverAfter, op } : serverAfter;
    }).then((result) => {
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

export function commitMonthlyRevenueDelta(ymKey, codToAdd, dodToAdd, countToAdd, appliedDelta, serverOnly?) {
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
    return runLedgerTransaction(firebaseState.dbRefMonthlyRevenue, (current, op) => {
        const months = (current && typeof current === 'object') ? current : {};
        const existing = months[ymKey] || {};
        serverBefore = {
            codDollar: parseFloat(existing.codDollar) || 0,
            dodDollar: parseFloat(existing.dodDollar) || 0,
            totalCount: parseFloat(existing.totalCount) || 0
        };
        serverAfter = ledgerDeltaWithClamp(serverBefore, codToAdd, dodToAdd, countToAdd, 'Monthly', ymKey);
        months[ymKey] = op ? { ...serverAfter, op } : serverAfter;

        const latestThreeMonths = {};
        Object.keys(months).sort().reverse().slice(0, 3).forEach((key) => {
            latestThreeMonths[key] = months[key];
        });
        return latestThreeMonths;
    }).then((result) => {
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
