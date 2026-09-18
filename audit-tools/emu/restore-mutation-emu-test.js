const fs = require('fs');
const path = require('path');
const http = require('http');
const vm = require('vm');
const acorn = require('acorn');
const { isDeepStrictEqual } = require('util');
const { emuNamespace } = require('./ns.js');
process.exitCode = 1;

// សាកចន្លោះ prepare → finalize ជាមួយកូដ App និង Firebase rules ពិត។
// ការសរសេររបស់ឧបករណ៍ទី ២ ត្រូវកើតនៅចន្លោះនោះ មិនមែនក្រោយ restore ចប់។
const ROOT = path.resolve(process.env.RESTOREMUTATION_APP_DIR || path.join(__dirname, '..', '..'));
const PORT = Number(process.env.RESTOREMUTATION_PORT || 9000);
const NS = emuNamespace('demo-zoe-restore-mutation');
const DATE = '2026-09-08';
const MONTH = DATE.slice(0, 7);
const NOW = Date.now();
let pass = 0, fail = 0;
function check(value, label, detail) {
    if (value) { pass++; console.log('  ok    ' + label); }
    else { fail++; console.log('  FAIL  ' + label + (detail === undefined ? '' : '\n        ' + JSON.stringify(detail))); }
}
const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
function request(method, node, body, owner, extraHeaders, unauthenticated) {
    return new Promise((resolve, reject) => {
        const payload = body === undefined ? null : JSON.stringify(body);
        const query = 'ns=' + NS + (owner || unauthenticated ? '' : '&auth_variable_override=' + encodeURIComponent(JSON.stringify({ uid: 'audit-user' })));
        const headers = Object.assign(unauthenticated ? {} : { Authorization: 'Bearer owner' }, extraHeaders || {});
        if (payload !== null) { headers['Content-Type'] = 'application/json'; headers['Content-Length'] = Buffer.byteLength(payload); }
        const req = http.request({ hostname: '127.0.0.1', port: PORT, method, path: node + '.json?' + query, headers }, (res) => {
            let text = '';
            res.on('data', (chunk) => { text += chunk; });
            res.on('end', () => {
                let value;
                try { value = JSON.parse(text); } catch (_) { value = text; }
                resolve({ status: res.statusCode, value, etag: res.headers.etag });
            });
        });
        req.setTimeout(5000, () => req.destroy(new Error('EMULATOR_REQUEST_TIMEOUT')));
        req.on('error', reject);
        if (payload !== null) req.write(payload);
        req.end();
    });
}
function accepted(result) {
    if (result.status !== 200) throw new Error('Firebase rules rejected: ' + result.status + ' ' + JSON.stringify(result.value));
    return result.value;
}
const snapshot = (value) => ({ exists: () => value !== null, val: () => clone(value) });
function adapter(pending, hooks = {}) {
    const track = (promise) => {
        pending.add(promise);
        promise.then(() => pending.delete(promise), () => pending.delete(promise));
        return promise;
    };
    return {
        ref: (_, node = '') => ({ path: '/' + node }),
        get: (ref) => track(request('GET', ref.path).then((result) => snapshot(accepted(result)))),
        increment: (amount) => ({ '.sv': { increment: amount } }),
        update: (ref, values) => track((async () => {
            const write = { method: 'PATCH', path: ref.path, value: clone(values) };
            if (hooks.beforeWrite) await hooks.beforeWrite(write);
            const result = await request('PATCH', ref.path, values);
            if (hooks.afterWrite) hooks.afterWrite({ ...write, status: result.status });
            return accepted(result);
        })()),
        runTransaction: (ref, updater) => track((async () => {
            for (let attempt = 0; attempt < 12; attempt++) {
                const current = await request('GET', ref.path, undefined, false, { 'X-Firebase-ETag': 'true' });
                accepted(current);
                const next = updater(clone(current.value));
                if (next === undefined) return { committed: false, snapshot: snapshot(current.value) };
                const write = { method: 'PUT', path: ref.path, value: clone(next), etag: current.etag, attempt };
                if (hooks.beforeWrite) await hooks.beforeWrite(write);
                const written = await request('PUT', ref.path, next, false, { 'if-match': current.etag });
                if (hooks.afterWrite) hooks.afterWrite({ ...write, status: written.status });
                if (written.status === 412) continue;
                return { committed: true, snapshot: snapshot(accepted(written)) };
            }
            throw new Error('TRANSACTION_RETRY_EXHAUSTED');
        })())
    };
}
const SOURCE = fs.readFileSync(path.join(ROOT, 'ZoeW', 'app.js'), 'utf8');
const AST = acorn.parse(SOURCE, { ecmaVersion: 'latest' });
const FNS = AST.body.filter((node) => node.type === 'FunctionDeclaration');
const NEEDED_CONSTANTS = new Set(['DB_OP_TIMEOUT_MS', 'TRASH_WRITE_SLOW_NOTICE_MS', 'RESTORE_CLAIM_LEASE_MS',
    'DB_LISTENER_KEY_DELETED', 'DB_LISTENER_KEY_HISTORY', 'TWO_HOURS_MS', 'ABANDON_AGE_MS',
    'DAILY_COLLECTED_KEEP_DAYS', 'DAILY_COLLECTED_DAY_PATTERN', 'DB_LISTENER_KEY_DAILY_COLLECTED',
    'PICKUP_DATE_KEY_PATTERN', 'APP_TIME_ZONE', 'APP_TIME_ZONE_OFFSET_MINUTES',
    'CLEANUP_JOURNAL_KEY', 'CLEANUP_JOURNAL_MAX', 'CLEANUP_STAGE_MOVED', 'CLEANUP_STAGE_LEDGER']);
const CONSTANTS = AST.body.filter((node) => node.type === 'VariableDeclaration')
    .flatMap((node) => node.declarations.filter((decl) => NEEDED_CONSTANTS.has(decl.id.name))
        .map((decl) => 'const ' + SOURCE.slice(decl.start, decl.end) + ';'));
function tab(suffix, hooks) {
    const pending = new Set();
    const fb = adapter(pending, hooks);
    const toasts = [];
    let seq = 0;
    const context = vm.createContext({
        console: { log() {}, warn() {}, error() {} },
        setTimeout: (fn, ms) => setTimeout(fn, ms < 10000 ? 0 : ms), clearTimeout,
        Date, Math, JSON, Promise, window: {}, navigator: {},
        document: { getElementById: (id) => id === 'editBcCodInput' ? { value: '4' } : id === 'editBcDodInput' ? { value: '2' } : null },
        db: {}, authGeneration: 0, fb, dbRefHistory: fb.ref(null, 'zoew_scan_history_cod_dod'), dbRefDeleted: fb.ref(null, 'zoew_recently_deleted_cod_dod'),
        dbRefDailyRevenue: fb.ref(null, 'zoew_daily_revenue_cod_dod'), dbRefMonthlyRevenue: fb.ref(null, 'zoew_monthly_revenue_cod_dod'),
        dbRefDailyCollected: fb.ref(null, 'zoew_daily_collected_cod_dod'), dailyCollectedData: {},
        dailyRevenueData: { [DATE]: { codDollar: 0, dodDollar: 0, totalCount: 0 } },
        monthlyRevenueData: { [MONTH]: { codDollar: 0, dodDollar: 0, totalCount: 0 } },
        scanHistory: [], deletedItems: [], scanRemoveInFlight: null, pendingRestoreId: null,
        activeRestoreClaims: new Map(), cleanupInFlight: new Set(), staleRestoreMarkerSweeps: new Set(), dbListenerPendingPaths: new Set(), dbListenerFailedPaths: new Set(),
        activeParentItemId: 'id_restore', activeEditingBarcode: 'RESTORE_BC',
        confirm: () => true, alert: (message) => toasts.push(message),
        appLocalStore: (function () { const d = {}; return { getItem: (k) => (Object.prototype.hasOwnProperty.call(d, k) ? d[k] : null), setItem: (k, v) => { d[k] = String(v); }, removeItem: (k) => { delete d[k]; } }; })()
    });
    vm.runInContext(CONSTANTS.join('\n') + '\n' + FNS.map((node) => SOURCE.slice(node.start, node.end)).join('\n'), context);
    Object.assign(context, {
        getServerNow: () => NOW, getFormattedDate: () => DATE,
        generateUniqueId: () => suffix + '_' + (++seq),
        showToast: (message) => toasts.push(message), closeModal() {}, openViewListModal() {},
        openRecentlyDeletedModal() {}, refreshCurrentHistoryView() {}, updateRecentPhonesList() {},
        viewListModalShowing: () => false
    });
    const settle = async () => {
        for (let round = 0; round < 80; round++) {
            await Promise.allSettled(Array.from(pending));
            await new Promise((resolve) => setTimeout(resolve, 0));
            if (!pending.size) return;
        }
        throw new Error('APP_WRITES_DID_NOT_SETTLE');
    };
    const sync = async () => {
        const state = accepted(await request('GET', '/', undefined, true));
        context.scanHistory = Object.values(state.zoew_scan_history_cod_dod || {});
        context.deletedItems = Object.values(state.zoew_recently_deleted_cod_dod || {});
        context.dailyRevenueData = state.zoew_daily_revenue_cod_dod || {};
        context.monthlyRevenueData = state.zoew_monthly_revenue_cod_dod || {};
        context.dailyCollectedData = state.zoew_daily_collected_cod_dod || {};
    };
    return { context, pending, toasts, settle, sync };
}
function seedItem() {
    return {
        id: 'id_restore', phone: '012345678', scanDate: DATE, createdAt: NOW - 1000, deletedAt: NOW - 500,
        cod: 10, dod: 2, price: 12, count: 1, barcode: 'RESTORE_BC', isClosed: false, isFromDeletion: false, trashReason: 'remove',
        barcodes: [{ code: 'RESTORE_BC', cod: 10, dod: 2, locker: 'A', isClosed: false, isDeducted: true, isFromDeletion: false, createdAt: NOW - 1000 }]
    };
}
async function runScenario(action) {
    const removal = action.startsWith('Remove');
    const markerOnly = action === 'Sweep stale' || action === 'Drop stale';
    const initial = {
        zoew_recently_deleted_cod_dod: { id_restore: seedItem() },
        zoew_daily_revenue_cod_dod: { [DATE]: { codDollar: 0, dodDollar: 0, totalCount: 0 } },
        zoew_monthly_revenue_cod_dod: { [MONTH]: { codDollar: 0, dodDollar: 0, totalCount: 0 } }
    };
    accepted(await request('PUT', '/', initial, true));
    const restoring = tab('restoring');
    const other = tab('other');
    const realFinalize = restoring.context.finalizeClaimedRestore;
    let interposed = 0;
    restoring.context.finalizeClaimedRestore = async (...args) => {
        interposed++;
        await other.sync();
        const before = clone(other.context.scanHistory[0]);
        check(!!before && !!before.restoreClaimId && before.barcodes[0].isDeducted === false,
            action + '៖ ឧបករណ៍ទី ២ ឃើញ prepare ពិត មុន finalize');
        if (action.endsWith('stale')) other.context.deletedItems = [seedItem()];
        if (action === 'Delete') await other.context.deleteSingleItem('id_restore');
        else if (removal) await other.context.removeSingleBarcode('id_restore', 'RESTORE_BC');
        else if (action === 'Sweep stale') other.context.clearStaleRestoreMarkers(before);
        else if (action === 'Drop stale') await other.context.fb.runTransaction(other.context.fb.ref(null, 'zoew_scan_history_cod_dod/id_restore'), (current) => {
            other.context.dropStaleRestoreMarkers(current);
            return current;
        });
        else other.context.saveEditedBarcodePrice();
        await other.settle();
        if (action === 'Delete' || removal || action === 'Price') {
            check(other.toasts.some((message) => message.includes('កំពុងស្តារ')) && !other.toasts.some((message) => message.startsWith('✅')),
                action + '៖ សារប្រាប់ថាកំពុងស្តារ មិនអះអាងបាត់កញ្ចប់ ឬជោគជ័យ', other.toasts);
        }
        const live = accepted(await request('GET', '/zoew_scan_history_cod_dod/id_restore'));
        const trash = accepted(await request('GET', '/zoew_recently_deleted_cod_dod/id_restore'));
        check(JSON.stringify(live) === JSON.stringify(before), action + '៖ មិនអាចកែទិន្នន័យពេលស្តារកំពុងដំណើរការ', live);
        check(!!trash && !!trash.restoreClaim && trash.barcodes[0].isDeducted === true,
            action + '៖ trash និងសិទ្ធិ finalize នៅគ្រប់', trash);
        return realFinalize(...args);
    };
    restoring.context.pendingRestoreId = 'id_restore';
    await restoring.context.executeRestoreItem();
    await restoring.settle();
    check(interposed === 1, action + '៖ ចាក់សកម្មភាពប្រណាំង ១ ដងពិត');
    const final = accepted(await request('GET', '/', undefined, true));
    const live = final.zoew_scan_history_cod_dod && final.zoew_scan_history_cod_dod.id_restore;
    const daily = final.zoew_daily_revenue_cod_dod[DATE];
    const monthly = final.zoew_monthly_revenue_cod_dod[MONTH];
    check(!!live && live.barcodes.length === 1 && live.cod === 10 && live.dod === 2,
        action + '៖ ស្តារបាន barcode ដើម ១ ដដែល', live);
    check(!Object.keys(final.zoew_recently_deleted_cod_dod || {}).length,
        action + '៖ ស្តារចប់មិនសល់ barcode ស្ទួនក្នុង trash', final.zoew_recently_deleted_cod_dod);
    check(daily.codDollar === 10 && daily.dodDollar === 2 && daily.totalCount === 1,
        action + '៖ ledger ថ្ងៃត្រឡប់ $12 និង ១ កញ្ចប់ ម្តងគត់', daily);
    check(JSON.stringify(daily) === JSON.stringify(monthly), action + '៖ ledger ខែស្មើថ្ងៃ', monthly);
    check(restoring.toasts.some((message) => message.startsWith('✅')), action + '៖ restore បាន commit និងប្រកាសជោគជ័យពិត', restoring.toasts);

    if (live && !live.restoreClaimId && !live.restoreClaimToken) {
        await other.sync();
        if (action === 'Delete') await other.context.deleteSingleItem('id_restore');
        else if (removal) await other.context.removeSingleBarcode('id_restore', 'RESTORE_BC');
        else if (!markerOnly) other.context.saveEditedBarcodePrice();
        await other.settle();
        const normal = accepted(await request('GET', '/', undefined, true));
        const day = normal.zoew_daily_revenue_cod_dod[DATE];
        const expectedCod = action === 'Delete' || markerOnly ? 10 : removal ? 0 : 4;
        check(day.codDollar === expectedCod && day.dodDollar === (removal ? 0 : 2),
            action + '៖ ក្រោយ finalize សកម្មភាពធម្មតានៅដំណើរការ', day);
    } else check(false, action + '៖ មិនអាចផ្ទៀងផ្ទាត់ផ្លូវធម្មតា ព្រោះ restore មិនចប់');
}
async function markerRecoveryScenario(mode) {
    const live = seedItem();
    delete live.deletedAt;
    delete live.isFromDeletion;
    delete live.trashReason;
    live.restoreClaimId = 'id_restore';
    live.restoreClaimToken = 'expired_token';
    live.barcodes[0].isDeducted = false;
    const stale = seedItem();
    stale.restoreClaim = { token: 'expired_token', targetId: 'id_restore', claimedAt: NOW - 3 * 60 * 1000 };
    accepted(await request('PUT', '/', {
        zoew_scan_history_cod_dod: { id_restore: live },
        zoew_recently_deleted_cod_dod: mode === 'missing' ? {} : { id_restore: stale }
    }, true));
    const client = tab('cleanup');
    await client.sync();
    if (mode === 'unavailable') {
        client.context.fb.get = () => Promise.reject(new Error('NETWORK_UNAVAILABLE'));
    } else if (mode === 'replaced') {
        const realGet = client.context.fb.get;
        client.context.fb.get = (ref) => {
            const operation = (async () => {
                const snap = await realGet(ref);
                const replacement = { ...live, restoreClaimToken: 'replacement_token' };
                accepted(await request('PUT', '/zoew_scan_history_cod_dod/id_restore', replacement, true));
                accepted(await request('PUT', '/zoew_recently_deleted_cod_dod/id_restore/restoreClaim', {
                    token: 'replacement_token', targetId: 'id_restore', claimedAt: NOW
                }, true));
                return snap;
            })();
            client.pending.add(operation);
            operation.then(() => client.pending.delete(operation), () => client.pending.delete(operation));
            return operation;
        };
    }
    client.context.clearStaleRestoreMarkers(clone(live));
    await client.settle();
    const saved = accepted(await request('GET', '/zoew_scan_history_cod_dod/id_restore'));
    if (mode === 'missing' || mode === 'expired') {
        check(!!saved && !saved.restoreClaimId && !saved.restoreClaimToken,
            mode + '៖ server បញ្ជាក់ claim មិនរស់ ➜ ដោះ marker កំព្រាបាន', saved);
    } else {
        const token = mode === 'replaced' ? 'replacement_token' : 'expired_token';
        check(!!saved && saved.restoreClaimToken === token,
            mode + '៖ មិនលុប marker បើ server អានមិនបាន ឬសិទ្ធិស្តារបានប្តូរ', saved);
    }
    check(client.context.staleRestoreMarkerSweeps.size === 0, mode + '៖ សោសម្អាតត្រូវដោះវិញ');
}
async function retentionScenario(mode) {
    const oldAt = mode === 'fresh' ? NOW - 1000 : NOW - 8 * 24 * 60 * 60 * 1000;
    const trash = seedItem();
    trash.createdAt = oldAt;
    trash.barcodes[0].createdAt = oldAt;
    const parentId = mode.startsWith('occupied') ? 'id_restore' : 'id_parent';
    const parent = clone(trash);
    Object.assign(parent, { id: parentId, cod: 10, dod: 0, price: 10, barcode: 'PARENT_BC', isClosed: mode === 'closed' || mode === 'occupied closed' });
    delete parent.deletedAt;
    delete parent.isFromDeletion;
    delete parent.trashReason;
    parent.barcodes = [{ ...trash.barcodes[0], code: 'PARENT_BC', cod: 10, dod: 0, isDeducted: false, isClosed: parent.isClosed }];
    if (parent.isClosed) { parent.closedAt = NOW; parent.barcodes[0].closedAt = NOW; }
    accepted(await request('PUT', '/', {
        zoew_scan_history_cod_dod: { [parentId]: parent },
        zoew_recently_deleted_cod_dod: { id_restore: trash },
        zoew_daily_revenue_cod_dod: { [DATE]: { codDollar: 10, dodDollar: 0, totalCount: 1 } },
        zoew_monthly_revenue_cod_dod: { [MONTH]: { codDollar: 10, dodDollar: 0, totalCount: 1 } }
    }, true));
    const client = tab('retention');
    client.context.pendingRestoreId = 'id_restore';
    await client.context.executeRestoreItem();
    await client.settle();
    await client.sync();
    check(client.toasts.some((message) => message.startsWith('✅')), mode + '៖ restore commit បានជោគជ័យ');
    const before = accepted(await request('GET', '/zoew_scan_history_cod_dod'));
    const restored = Object.values(before || {}).find((item) => item.barcodes.some((b) => b.code === 'RESTORE_BC'));
    check(!!restored && restored.barcodes.find((barcode) => barcode.code === 'RESTORE_BC').restoredAt === NOW,
        mode + '៖ barcode ស្តារមិនត្រូវទទួលនាឡិកា parent ដែលលើស៧ថ្ងៃ', restored);
    check(before[parentId].createdAt === oldAt, mode + '៖ មិនពន្យារអាយុកញ្ចប់ចាស់ផ្សេង');
    await client.context.claimAndCleanupItem(parentId, 'abandon');
    await client.settle();
    const final = accepted(await request('GET', '/', undefined, true));
    const live = Object.values(final.zoew_scan_history_cod_dod || {});
    check(live.some((item) => item.barcodes.some((b) => b.code === 'RESTORE_BC')),
        mode + '៖ ស្តារហើយ មិនផុតកំណត់វិញភ្លាម');
    check(parent.isClosed || mode === 'fresh' || !live.some((item) => item.barcodes.some((b) => b.code === 'PARENT_BC')),
        mode + '៖ sibling ចាស់ដែលមិនទាន់យក នៅតែផុតកំណត់តាមច្បាប់');
    const daily = final.zoew_daily_revenue_cod_dod[DATE];
    check(daily.codDollar === (parent.isClosed || mode === 'fresh' ? 20 : 10) && daily.dodDollar === 2,
        mode + '៖ មិនកាត់ប្រាក់របស់ barcode ដែលទើបស្តារ', daily);
    const restoredRow = live.find((item) => item.barcodes.some((b) => b.code === 'RESTORE_BC'));
    if (!restoredRow) { check(false, mode + '៖ មិនអាចសាកព្រំដែន៧ថ្ងៃ ព្រោះ barcode បាត់'); return; }
    client.context.getServerNow = () => NOW + 7 * 24 * 60 * 60 * 1000;
    await client.context.claimAndCleanupItem(restoredRow.id, 'abandon');
    await client.settle();
    const boundary = accepted(await request('GET', '/zoew_scan_history_cod_dod'));
    check(Object.values(boundary || {}).some((item) => item.barcodes.some((b) => b.code === 'RESTORE_BC')),
        mode + '៖ restored barcode នៅគ្រប់៧ថ្ងៃគត់ មិនទាន់ផុតកំណត់');
    client.context.getServerNow = () => NOW + 7 * 24 * 60 * 60 * 1000 + 1;
    await client.context.claimAndCleanupItem(restoredRow.id, 'abandon');
    await client.settle();
    const expired = accepted(await request('GET', '/', undefined, true));
    check(!Object.values(expired.zoew_scan_history_cod_dod || {}).some((item) => item.barcodes.some((b) => b.code === 'RESTORE_BC')),
        mode + '៖ លើស៧ថ្ងៃពីការស្តារ ទើបផុតកំណត់');
    const endDaily = expired.zoew_daily_revenue_cod_dod[DATE];
    check(endDaily.codDollar === (parent.isClosed ? 10 : 0) && endDaily.dodDollar === 0,
        mode + '៖ ផុតកំណត់កាត់ប្រាក់តែម្តងគត់', endDaily);
}
async function preparedRetryScenario(mode) {
    const trash = seedItem();
    trash.restoreClaim = { token: 'prepared_token', targetId: 'id_parent', claimedAt: NOW - 3 * 60 * 1000 };
    const parent = clone(trash);
    delete parent.deletedAt;
    delete parent.isFromDeletion;
    delete parent.trashReason;
    delete parent.restoreClaim;
    Object.assign(parent, { id: 'id_parent', createdAt: NOW - 8 * 24 * 60 * 60 * 1000,
        cod: 20, dod: 2, price: 22, count: 2, restoreClaimId: 'id_restore', restoreClaimToken: 'prepared_token' });
    parent.barcodes = [{ ...trash.barcodes[0], code: 'PARENT_BC', cod: 10, dod: 0, isDeducted: false },
        { ...trash.barcodes[0], isDeducted: false }];
    accepted(await request('PUT', '/', {
        zoew_scan_history_cod_dod: { id_parent: parent },
        zoew_recently_deleted_cod_dod: { id_restore: trash },
        zoew_daily_revenue_cod_dod: { [DATE]: { codDollar: 10, dodDollar: 0, totalCount: 1 } },
        zoew_monthly_revenue_cod_dod: { [MONTH]: { codDollar: 10, dodDollar: 0, totalCount: 1 } }
    }, true));
    const client = tab('retry');
    if (mode === 'same token') client.context.activeRestoreClaims.set('id_restore', { token: 'prepared_token', targetId: 'id_parent' });
    if (mode.startsWith('cached')) {
        const realGet = client.context.fb.get;
        let cachedReads = 0;
        const compatible = clone(parent);
        compatible.id = 'id_other';
        delete compatible.restoreClaimId;
        delete compatible.restoreClaimToken;
        compatible.barcodes = [compatible.barcodes[0]];
        compatible.barcodes[0].code = 'OTHER_BC';
        Object.assign(compatible, { barcode: 'OTHER_BC', cod: 10, dod: 0, price: 10, count: 1 });
        if (mode === 'cached compatible') {
            accepted(await request('PUT', '/zoew_scan_history_cod_dod/id_other', compatible, true));
            accepted(await request('PATCH', '/', {
                ['zoew_daily_revenue_cod_dod/' + DATE + '/codDollar']: 20,
                ['zoew_daily_revenue_cod_dod/' + DATE + '/totalCount']: 2,
                ['zoew_monthly_revenue_cod_dod/' + MONTH + '/codDollar']: 20,
                ['zoew_monthly_revenue_cod_dod/' + MONTH + '/totalCount']: 2
            }, true));
        }
        client.context.fb.get = (ref) => {
            if (ref.path === '/zoew_scan_history_cod_dod' && cachedReads++ === 0) {
                return Promise.resolve(snapshot(mode === 'cached missing' ? null : { id_other: compatible }));
            }
            return realGet(ref);
        };
    }
    client.context.pendingRestoreId = 'id_restore';
    await client.context.executeRestoreItem();
    await client.settle();
    const final = accepted(await request('GET', '/', undefined, true));
    const rows = Object.values(final.zoew_scan_history_cod_dod || {}).filter((item) => item.barcodes.some((b) => b.code === 'RESTORE_BC'));
    check(rows.length === 1 && rows[0].id === 'id_parent', mode + '៖ retry មិន clone barcode ដែល prepare រួច ទោះ parent លើស៧ថ្ងៃ', rows);
    check(rows.length === 1 && !rows[0].restoreClaimId && !rows[0].restoreClaimToken && !Object.keys(final.zoew_recently_deleted_cod_dod || {}).length,
        mode + '៖ ស្តារបញ្ចប់ source និង marker ដោយ atomic');
    const daily = final.zoew_daily_revenue_cod_dod[DATE];
    check(daily.codDollar === (mode === 'cached compatible' ? 30 : 20) && daily.dodDollar === 2 && daily.totalCount === (mode === 'cached compatible' ? 3 : 2),
        mode + '៖ retry បូកតែ delta ដែលនៅខ្វះ ម្តងគត់', daily);
    await client.context.claimAndCleanupItem('id_parent', 'abandon');
    await client.settle();
    const afterCleanup = accepted(await request('GET', '/', undefined, true));
    const remaining = Object.values(afterCleanup.zoew_scan_history_cod_dod || {}).flatMap((item) => item.barcodes);
    const restoredRemaining = remaining.filter((barcode) => barcode.code === 'RESTORE_BC');
    check(restoredRemaining.length === 1 && restoredRemaining[0].restoredAt === NOW &&
        (!afterCleanup.zoew_scan_history_cod_dod.id_parent || afterCleanup.zoew_scan_history_cod_dod.id_parent.barcodes.every((barcode) => barcode.code === 'RESTORE_BC')),
        mode + '៖ សម្អាតក្រោយ retry រក្សា barcode ស្តារ ហើយដកតែ sibling ចាស់', remaining);
}
async function collectedCleanupScenario(mode) {
    const racing = mode === 'cleanup';
    const label = racing ? 'សម្អាតជាន់ការកែតម្លៃ' : mode === 'recent' ? 'កែតម្លៃថ្ងៃថ្មី' : 'កែតម្លៃថ្ងៃចាស់បំផុតដែលនៅរក្សា';
    const collectedPath = '/zoew_daily_collected_cod_dod';
    const beforeMidnight = Date.parse('2026-09-13T23:59:59+07:00');
    let releaseWrite, markReached, gateTimer, heldWrite = null, released = false;
    const release = new Promise((resolve) => { releaseWrite = resolve; });
    const reached = new Promise((resolve) => { markReached = resolve; });
    const completedWrites = [];
    const writer = tab('collected-price', {
        beforeWrite: async (write) => {
            if (!racing || heldWrite || write.path !== collectedPath) return;
            heldWrite = write;
            markReached();
            await release;
        },
        afterWrite: (write) => {
            if (write.path === collectedPath) completedWrites.push({ ...write, released });
        }
    });
    const currentDay = writer.context.getZoneDateKey(beforeMidnight);
    const oldestDay = writer.context.collectedRetentionCutoffKey(beforeMidnight);
    const markerDay = mode === 'recent' ? currentDay : oldestDay;
    const key = writer.context.pickupBarcodeKey('RESTORE_BC');
    const keepKey = writer.context.pickupBarcodeKey('KEEP_COLLECTED');
    const oldSiblingKey = writer.context.pickupBarcodeKey('OLD_SIBLING');
    const live = seedItem();
    delete live.deletedAt;
    delete live.isFromDeletion;
    delete live.trashReason;
    const closedAt = Date.parse(markerDay + 'T12:00:00+07:00');
    Object.assign(live, { scanDate: currentDay, createdAt: closedAt - 1000, cod: 10.25, dod: 2.5, price: 12.75, isClosed: true, closedAt });
    Object.assign(live.barcodes[0], { createdAt: closedAt - 1000, cod: 10.25, dod: 2.5, isClosed: true, isDeducted: false, closedAt });
    const unrelated = clone(live);
    Object.assign(unrelated, { id: 'id_unrelated', barcode: 'KEEP_HISTORY', cod: 7.75, dod: 0.5, price: 8.25 });
    Object.assign(unrelated.barcodes[0], { code: 'KEEP_HISTORY', cod: 7.75, dod: 0.5 });
    const collected = { [currentDay]: { [keepKey]: { c: 7.75, d: 0.5 } } };
    collected[markerDay] = { ...collected[markerDay], [key]: { c: 10.25, d: 2.5 }, [oldSiblingKey]: { c: 3.75, d: 0.25 } };
    accepted(await request('PUT', '/', {
        zoew_scan_history_cod_dod: { id_restore: live, id_unrelated: unrelated },
        zoew_daily_revenue_cod_dod: { [currentDay]: { codDollar: 18, dodDollar: 3, totalCount: 2 } },
        zoew_monthly_revenue_cod_dod: { [currentDay.slice(0, 7)]: { codDollar: 18, dodDollar: 3, totalCount: 2 } },
        zoew_daily_collected_cod_dod: collected
    }, true));
    writer.context.getServerNow = () => beforeMidnight;
    writer.context.getFormattedDate = () => currentDay;
    writer.context.document.getElementById = (id) => id === 'editBcCodInput' ? { value: '24.50' } : id === 'editBcDodInput' ? { value: '1.75' } : null;
    await writer.sync();
    try {
        writer.context.saveEditedBarcodePrice();
        if (racing) {
            await new Promise((resolve, reject) => {
                gateTimer = setTimeout(() => reject(new Error('COLLECTED_WRITE_DID_NOT_REACH_GATE')), 5000);
                reached.then(resolve, reject);
            });
            clearTimeout(gateTimer);
            const queued = accepted(await request('GET', '/', undefined, true));
            const queuedPrice = queued.zoew_scan_history_cod_dod.id_restore.barcodes[0];
            check(queuedPrice.cod === 24.5 && queuedPrice.dod === 1.75,
                label + '៖ តម្លៃកញ្ចប់បាន commit ពិត មុន collect write ដល់ server', queuedPrice);
            check(queued.zoew_daily_collected_cod_dod[markerDay][key].c === 10.25 && completedWrites.length === 0,
                label + '៖ ទប់មុន HTTP ផ្ញើ មិនមែនពន្យារ ACK ក្រោយទិន្នន័យបានប្តូរ', completedWrites);
            const cleaner = tab('collected-cleanup');
            cleaner.context.serverClockTrusted = true;
            cleaner.context.isDatabaseConnected = true;
            cleaner.context.getServerNow = () => beforeMidnight + 2000;
            await cleaner.sync();
            check(cleaner.context.collectedRetentionCutoffKey(beforeMidnight + 2000) > markerDay,
                label + '៖ ឆ្លងអធ្រាត្រ Phnom Penh ធ្វើឲ្យថ្ងៃគោលផុតពីរយៈពេលរក្សា');
            cleaner.context.runAutomaticCollectedCleanup();
            await cleaner.settle();
            const cleaned = accepted(await request('GET', collectedPath + '/' + markerDay));
            check(cleaned === null, label + '៖ client ទី២ សម្អាតបានជោគជ័យលើ server មុនដោះ writer', cleaned);
            accepted(await request('PATCH', collectedPath + '/' + currentDay, { [keepKey]: { c: 9.25, d: 0.75 } }));
        }
    } finally {
        clearTimeout(gateTimer);
        released = true;
        releaseWrite();
        await writer.settle();
    }
    const final = accepted(await request('GET', '/', undefined, true));
    const finalCollected = final.zoew_daily_collected_cod_dod || {};
    const targetDays = Object.keys(finalCollected).filter((day) => finalCollected[day] && Object.prototype.hasOwnProperty.call(finalCollected[day], key));
    if (racing) {
        console.log('  ភស្តុតាងសរសេរក្រោយដោះ៖ ' + JSON.stringify(completedWrites.map(({ method, status, released: afterRelease }) => ({ method, status, afterRelease }))));
        check(completedWrites.length > 0 && completedWrites.every((write) => write.released),
            label + '៖ ដោះការសរសេរទៅ RTDB ពិតក្រោយ cleanup ចប់', completedWrites.map(({ method, status, released: afterRelease }) => ({ method, status, afterRelease })));
        check(!finalCollected[markerDay] && targetDays.length === 0,
            label + '៖ ការសរសេរយឺតមិនបង្កើតថ្ងៃដែលបានសម្អាតវិញ', finalCollected);
    } else {
        const saved = finalCollected[markerDay] && finalCollected[markerDay][key];
        check(targetDays.length === 1 && targetDays[0] === markerDay && saved.c === 24.5 && saved.d === 1.75,
            label + '៖ ថ្ងៃដើមនៅតែមួយ ហើយ COD/DOD រក្សាសេនត្រឹមត្រូវ', finalCollected);
        check(JSON.stringify(finalCollected[markerDay][oldSiblingKey]) === JSON.stringify(collected[markerDay][oldSiblingKey]),
            label + '៖ barcode ផ្សេងក្នុងថ្ងៃដូចគ្នានៅដដែល');
    }
    const kept = finalCollected[currentDay] && finalCollected[currentDay][keepKey];
    check(!!kept && kept.c === (racing ? 9.25 : 7.75) && kept.d === (racing ? 0.75 : 0.5),
        label + '៖ រក្សាតម្លៃថ្មីរបស់ជួរ collected ផ្សេងដែលកែជាន់គ្នា', kept);
    const savedPrice = final.zoew_scan_history_cod_dod.id_restore.barcodes[0];
    check(savedPrice.cod === 24.5 && savedPrice.dod === 1.75 && savedPrice.isClosed && savedPrice.closedAt === closedAt,
        label + '៖ cleanup មិនលុបតម្លៃ ឬប្តូរស្ថានភាពនិងថ្ងៃបិទកញ្ចប់', savedPrice);
    check(isDeepStrictEqual(final.zoew_scan_history_cod_dod.id_unrelated, unrelated),
        label + '៖ history ជួរផ្សេងមិនត្រូវបានប៉ះ');
    const daily = final.zoew_daily_revenue_cod_dod[currentDay];
    const monthly = final.zoew_monthly_revenue_cod_dod[currentDay.slice(0, 7)];
    check(daily.codDollar === 32.25 && daily.dodDollar === 2.25 && daily.totalCount === 2 && JSON.stringify(monthly) === JSON.stringify(daily),
        label + '៖ ledger ថ្ងៃនិងខែរក្សាផលបូកត្រឹមត្រូវក្រោយកែតម្លៃ', { daily, monthly });
    check(writer.toasts.some((message) => message.startsWith('✅')),
        label + '៖ ការកែតម្លៃបញ្ចប់ពិត និងប្រាប់ជោគជ័យ', writer.toasts);
}
async function serverFenceScenario(mode) {
    const historyPath = '/zoew_scan_history_cod_dod/id_parent';
    const sourcePath = '/zoew_recently_deleted_cod_dod/id_restore';
    const serverNow = Date.now();
    const oldLease = serverNow - 3 * 60 * 1000;
    const live = seedItem();
    delete live.deletedAt;
    delete live.isFromDeletion;
    delete live.trashReason;
    Object.assign(live, { id: 'id_parent', restoreClaimId: 'id_restore', restoreClaimToken: 'fence_token' });
    live.barcodes[0].isDeducted = false;
    const trash = seedItem();
    trash.restoreClaim = { token: 'fence_token', targetId: 'id_parent', claimedAt: mode === 'cached' || mode === 'control' ? serverNow : oldLease };
    accepted(await request('PUT', '/', {
        zoew_scan_history_cod_dod: { id_parent: live },
        zoew_recently_deleted_cod_dod: mode === 'missing' ? {} : { id_restore: trash }
    }, true));
    if (mode === 'control') {
        const deleted = await request('DELETE', historyPath);
        check(deleted.status === 401, 'server fence៖ active marker រារាំងការលុប row ទាំងមូល', deleted.status);
        const metadata = await request('PATCH', historyPath, { phone: '099888777' });
        check(metadata.status === 200, 'server fence៖ ការកែ metadata ដែលរក្សា marker នៅអនុញ្ញាត', metadata.status);
        const finalized = await request('PATCH', '/', {
            'zoew_restore_finalizations/id_restore': { token: 'fence_token', targetId: 'id_parent', finalizedAt: Date.now() },
            'zoew_recently_deleted_cod_dod/id_restore': null,
            'zoew_scan_history_cod_dod/id_parent/restoreClaimId': null,
            'zoew_scan_history_cod_dod/id_parent/restoreClaimToken': null
        });
        check(finalized.status === 200, 'server fence៖ atomic finalize មាន witness ត្រឹមត្រូវ នៅអនុញ្ញាត', finalized.status);
        const final = accepted(await request('GET', '/', undefined, true));
        check(!final.zoew_recently_deleted_cod_dod && !final.zoew_scan_history_cod_dod.id_parent.restoreClaimToken,
            'server fence៖ finalize លុប source និង marker ពិត');
        return;
    }
    const pending = [];
    const statuses = [];
    let releasedBeforeLateWrite = false;
    const fb = {
        ref: (_, node) => ({ path: '/' + node }),
        get: async (ref) => {
            if (mode === 'cached') {
                const cached = clone(trash);
                cached.restoreClaim.claimedAt = oldLease;
                return snapshot(cached);
            }
            const value = accepted(await request('GET', ref.path));
            if (mode === 'renew') accepted(await request('PATCH', sourcePath + '/restoreClaim', { claimedAt: Date.now() }));
            return snapshot(value);
        },
        runTransaction: (ref, updater) => {
            const operation = (async () => {
                const before = await request('GET', ref.path, undefined, false, { 'X-Firebase-ETag': 'true' });
                accepted(before);
                const next = updater(clone(before.value));
                if (next === undefined) return { committed: false, snapshot: snapshot(before.value) };
                if (mode === 'late') {
                    await new Promise((resolve) => setTimeout(resolve, 250));
                    releasedBeforeLateWrite = context.staleRestoreMarkerSweeps.size === 0;
                    accepted(await request('PATCH', sourcePath + '/restoreClaim', { claimedAt: Date.now() }));
                }
                const written = await request('PUT', ref.path, next, false, { 'if-match': before.etag });
                statuses.push(written.status);
                return { committed: true, snapshot: snapshot(accepted(written)) };
            })();
            pending.push(operation);
            operation.catch(() => {});
            return operation;
        }
    };
    const context = vm.createContext({
        db: {}, fb, console: { error() {} }, window: {}, setTimeout, clearTimeout,
        staleRestoreMarkerSweeps: new Set(), activeRestoreClaims: new Map(), deletedItems: [],
        DB_LISTENER_KEY_DELETED: 'deleted', dbListenerViewIsStale: () => false,
        DB_OP_TIMEOUT_MS: mode === 'late' ? 100 : 2000, RESTORE_CLAIM_LEASE_MS: 120000, getServerNow: () => Date.now()
    });
    const names = new Set(['clearStaleRestoreMarkers', 'itemHasRestoreMarkers', 'isActiveRestoreClaim', 'dbOp', 'dbOpStalled', 'withTimeout']);
    vm.runInContext(FNS.filter((node) => names.has(node.id.name)).map((node) => SOURCE.slice(node.start, node.end)).join('\n'), context);
    context.clearStaleRestoreMarkers(clone(live));
    for (let attempt = 0; attempt < 500 && context.staleRestoreMarkerSweeps.size; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 5));
    }
    await Promise.allSettled(pending);
    const saved = accepted(await request('GET', historyPath));
    const protectedClaim = mode === 'cached' || mode === 'renew' || mode === 'late';
    check(statuses.length === 1 && statuses[0] === (protectedClaim ? 401 : 200),
        mode + '៖ server វាយតម្លៃសិទ្ធិពេល write ពិត', statuses);
    check(protectedClaim ? saved.restoreClaimToken === 'fence_token' : !saved.restoreClaimToken,
        mode + '៖ claim រស់ត្រូវរក្សា; claim ចាស់ឬបាត់ដោះបាន', saved.restoreClaimToken);
    check(context.staleRestoreMarkerSweeps.size === 0, mode + '៖ ការសម្អាតដោះសោក្រោយចប់ឬtimeout');
    if (mode === 'late') check(releasedBeforeLateWrite, 'server fence៖ late write កើតក្រោយ client timeout ពិត');
}
(async () => {
    console.log('restore-mutation-emu-test — ការប្រណាំងស្តារ និងការកែទិន្នន័យ (RTDB ពិត)');
    console.log('  Namespace៖ ' + NS);
    check(FNS.length >= 100, 'ស្រង់ function ពិតពី App មិនមែនច្បាប់ចម្លង');
    const rules = JSON.parse(fs.readFileSync(path.join(ROOT, 'firebase-database.rules.json'), 'utf8'));
    if (fail || !rules || !rules.rules || !rules.rules.zoew_scan_history_cod_dod || !rules.rules.zoew_recently_deleted_cod_dod) {
        throw new Error('App ឬ Firebase rules មិនគ្រប់គ្រាន់សម្រាប់ការសាកល្បង');
    }
    let loaded;
    try {
        loaded = await request('PUT', '/.settings/rules', rules, true);
    } catch (error) {
        if (error.code !== 'ECONNREFUSED' && error.code !== 'ETIMEDOUT' && error.message !== 'EMULATOR_REQUEST_TIMEOUT') throw error;
        const strict = process.env.CRUD_FLOW_STRICT === '1';
        console.log((strict ? 'FAIL' : 'SKIP') + ' — តភ្ជាប់ emulator មិនបាន (127.0.0.1:' + PORT + '): ' + error.message);
        process.exitCode = strict ? 1 : 0;
        return;
    }
    const loadedRules = accepted(loaded);
    check(loadedRules && loadedRules.status === 'ok', 'Firebase rules ត្រូវបាន load ពិត');
    if (fail) throw new Error('Firebase rules មិនបាន load');
    const denied = await request('PUT', '/zoew_daily_revenue_cod_dod/' + DATE, { codDollar: -1, dodDollar: 0, totalCount: 0 });
    check(denied.status === 401, 'Firebase rules ពិតបដិសេធលុយអវិជ្ជមាន', denied.status);
    const unauth = await request('GET', '/zoew_recently_deleted_cod_dod', undefined, false, undefined, true);
    check(unauth.status === 401, 'គ្មាន auth ត្រូវបដិសេធពិត', unauth.status);
    for (const action of ['Delete', 'Remove', 'Remove stale', 'Price', 'Sweep stale', 'Drop stale']) {
        try { await runScenario(action); }
        catch (error) { check(false, action + '៖ សេណារីយ៉ូបរាជ័យ', error.message); }
    }
    for (const mode of ['missing', 'expired', 'unavailable', 'replaced']) {
        try { await markerRecoveryScenario(mode); }
        catch (error) { check(false, mode + '៖ សេណារីយ៉ូសម្អាតបរាជ័យ', error.message); }
    }
    for (const mode of ['closed', 'open', 'occupied', 'occupied closed', 'fresh']) {
        try { await retentionScenario(mode); }
        catch (error) { check(false, mode + '៖ សេណារីយ៉ូស្តារអាយុកញ្ចប់បរាជ័យ', error.message); }
    }
    for (const mode of ['same token', 'takeover', 'cached missing', 'cached compatible']) {
        try { await preparedRetryScenario(mode); }
        catch (error) { check(false, mode + '៖ សេណារីយ៉ូ retry បរាជ័យ', error.message); }
    }
    for (const mode of ['cleanup', 'recent', 'oldest']) {
        try { await collectedCleanupScenario(mode); }
        catch (error) { check(false, mode + '៖ សេណារីយ៉ូ collected cleanup បរាជ័យ', error.message); }
    }
    for (const mode of ['cached', 'renew', 'late', 'expired', 'missing', 'control']) {
        try { await serverFenceScenario(mode); }
        catch (error) { check(false, mode + '៖ សេណារីយ៉ូ server fence បរាជ័យ', error.message); }
    }
    console.log('\n' + pass + ' ok, ' + fail + ' FAIL');
    process.exitCode = fail ? 1 : 0;
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
