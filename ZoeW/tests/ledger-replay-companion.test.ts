/**
 * ⛔ ថ្នាក់ ៖ ការ replay ledger ក្រោយ reload អនុវត្ត **ពាក់កណ្តាលប្រតិបត្តិការ** ៖ កែតម្លៃ (ledger មុន · history ក្រោយ) ឬស្កេន (ledger មុន · save ក្រោយ)
 *    ក្រៅបណ្តាញ ➜ reload ➜ queue បាត់ ➜ recovery replay delta ledger (intent `revenue-delta`) ខណៈ row CAS របស់ history ត្រូវទម្លាក់
 *    ➜ ledger ប្រែ តែតម្លៃកញ្ចប់មិនប្រែ (វាស់ដោយ `emu/money-multidevice-emu-test` ៖ ៣/៣ លំដាប់ធ្លាក់លើដើមឈើមុនកែ)។
 *    ច្បាប់ ៖ delta ដែលមាន `companion` (`ledgerDeltaCompanion()`) replay តែពេល barcode លើ server ថ្លែងតម្លៃថ្មី (`holds`) ·
 *    delta ដែលចុះរួចតែ barcode នៅតម្លៃចាស់ (`prior`) ➜ ដកវិញម្តង (token `op_r…` · idempotent) · `absent`/`unknown` ➜ ទម្លាក់ (មិនទាយ) ·
 *    អានមិនបាន ➜ `deferred` (មិនមែន blocked · មិន replay) · intent គ្មាន companion (កែស្ថិតិដោយដៃ · cleanup) ➜ replay ដូចដើម។
 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { dataState, firebaseState } from '../src/core/state';
import { withTransactionOutcomeResolution } from '../src/services/tx-outcome';
import { nativeWriteRecoveryState } from '../src/services/native-write-recovery';
import { addRevenueToDailyAndMonthlyRecord, ledgerCompanionCopyState, ledgerCompanionState, ledgerDeltaCompanion } from '../src/domain/ledger';
import { dbListenerPendingPaths } from '../src/core/text';

const host = 'https://shop.firebaseio.com';
const DAY = '2026-10-14';
const MONTH = '2026-10';
const DAILY = 'zoew_daily_revenue_cod_dod/' + DAY;
const MONTHLY = 'zoew_monthly_revenue_cod_dod';
const ITEM = 'zoew_scan_history_cod_dod/item1';
const turn = async () => { for (let i = 0; i < 80; i++) await Promise.resolve(); };
const records = () => Object.keys(localStorage).filter(k => k.startsWith('zoew_connection_writes_v1:')).map(k => JSON.parse(localStorage.getItem(k)!));
const pathOf = (ref: any) => String(ref).slice(host.length + 1);

function fakeLocks() {
    const chains = new Map<string, Promise<any>>();
    return { request: (name: string, options: any, callback?: any) => {
        const run = typeof options === 'function' ? options : callback;
        const prev = chains.get(name) || Promise.resolve();
        const next = prev.then(() => run({ name }));
        chains.set(name, next.catch(() => {}));
        return next;
    } };
}
beforeEach(() => {
    localStorage.clear(); dbListenerPendingPaths.clear(); firebaseState.authGeneration++;
    vi.stubGlobal('navigator', { onLine: true, locks: fakeLocks() });
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function lab(transaction: any, update: any = vi.fn(async () => {})) {
    const app = { options: { databaseURL: host } }; const auth = { app, currentUser: { uid: 'A', getIdToken: async () => 'fake-token' } }; const db = { app };
    const raw = { getAuth: () => auth, getDatabase: () => db, ref: (_db: any, path = '') => ({ toString: () => host + '/' + path }),
        update, set: update, runTransaction: transaction, deleteApp: async () => {} };
    const sdk = withTransactionOutcomeResolution(raw); sdk.getAuth(app); sdk.getDatabase(app);
    Object.assign(firebaseState, { firebaseConfig: app.options, fb: sdk, auth, db, isDatabaseInitialized: true,
        isInitializingFirebase: false, firebaseSdkUnavailable: false, isDatabaseConnected: true, sessionExpiryCheck: 'live', authLoginOperation: null });
    firebaseState.dbRefDailyRevenue = sdk.ref(db, 'zoew_daily_revenue_cod_dod');
    firebaseState.dbRefMonthlyRevenue = sdk.ref(db, MONTHLY);
    dataState.dailyRevenueData = { [DAY]: { codDollar: 40, dodDollar: 0, totalCount: 2 } };
    dataState.monthlyRevenueData = { [MONTH]: { codDollar: 40, dodDollar: 0, totalCount: 2 } };
    return { sdk, db, app };
}

const priorDaily = { codDollar: 40, dodDollar: 0, totalCount: 2, op: 'op_prior_day', ops: { op_prior_day: 3 } };
const priorMonths = { [MONTH]: { codDollar: 40, dodDollar: 0, totalCount: 2, op: 'op_prior_mon', ops: { op_prior_mon: 3 } } };
const item = (cod: number) => ({ id: 'item1', phone: '012000111', scanDate: DAY, barcodes: [{ code: 'B1', cod, dod: 0, isClosed: false }] });

/** session ១ ៖ delta ledger (ថ្ងៃ + ខែ) ចូល queue ហើយមិនដែលចុះ (reload មុន ack ៖ promise របស់ SDK ចាស់មិនដែល settle) ➜ journal ២ row */
async function queueDelta(cod: number, companion: any) {
    const pending: any[] = [];
    const first = lab((_ref: any, updater: any) => { updater(pathOf(_ref) === DAILY ? structuredClone(priorDaily) : structuredClone(priorMonths)); return new Promise(r => { pending.push(r); }); });
    addRevenueToDailyAndMonthlyRecord(DAY, cod, 0, 0, companion);
    await vi.waitFor(() => expect(records()).toHaveLength(2)); await turn();
    const saved = records();
    await first.sdk.deleteApp(first.app);
    return saved;
}

/** session ២ ៖ server ឆ្លើយតាម path · transaction ពិតកត់ផ្លូវនិងតម្លៃដែលសរសេរ */
function boot(server: Record<string, any>, serverDaily = priorDaily, serverMonths: any = priorMonths) {
    vi.stubGlobal('fetch', async (url: string) => {
        const p = decodeURIComponent(new URL(String(url)).pathname).replace(/^\/|\.json$/g, '');
        if (p in server) { if (server[p] instanceof Error) throw server[p]; return Response.json(server[p]); }
        if (p === DAILY) return Response.json(serverDaily);
        if (p === MONTHLY) return Response.json(serverMonths);
        return Response.json(null);
    });
    const writes: { path: string; value: any }[] = [];
    const state = { daily: structuredClone(serverDaily), months: structuredClone(serverMonths) };
    const second = lab(async (ref: any, updater: any) => {
        const path = pathOf(ref);
        const current = path === DAILY ? state.daily : state.months;
        const next = updater(structuredClone(current));
        if (next === undefined) return { committed: false, snapshot: { val: () => current } };
        if (path === DAILY) state.daily = next; else state.months = next;
        writes.push({ path, value: next });
        return { committed: true, snapshot: { val: () => next } };
    });
    return { ...second, writes, state };
}
const settle = async (lab2: any) => {
    const verdict = await lab2.sdk.set(lab2.sdk.ref(lab2.db, 'zoew_settings/exchange_rate'), 4300).then(() => 'sent', (e: any) => e.code || e.message);
    return { verdict, rows: records().length, blocked: nativeWriteRecoveryState(lab2.db).blocked, deferred: nativeWriteRecoveryState(lab2.db).deferred };
};

it('ledgerDeltaCompanion ៖ កែតម្លៃកត់ item · code · តម្លៃថ្មីនិងចាស់ · ស្កេនកត់ item · code · តម្លៃ · id មិនត្រឹមត្រូវ ➜ null', () => {
    expect(ledgerDeltaCompanion('item1', 'B1', 15, 0, 10, 0)).toEqual({ path: ITEM, code: 'B1', wantCod: 15, wantDod: 0, priorCod: 10, priorDod: 0 });
    expect(ledgerDeltaCompanion('item1', 'B1', 15, 2)).toEqual({ path: ITEM, code: 'B1', wantCod: 15, wantDod: 2 });
    expect(ledgerDeltaCompanion('../x', 'B1')).toBeNull();
    expect(ledgerDeltaCompanion('item1', '')).toBeNull();
    const c = ledgerDeltaCompanion('item1', 'B1', 15, 0, 10, 0)!;
    expect(ledgerCompanionState(item(15), c)).toBe('holds');
    expect(ledgerCompanionState(item(10), c)).toBe('prior');
    expect(ledgerCompanionState(item(12), c)).toBe('unknown');
    expect(ledgerCompanionState({ id: 'item1', barcodes: [] }, c)).toBe('absent');
    expect(ledgerCompanionState(null, c)).toBe('absent');
    expect(ledgerCompanionState({ id: 'item1', barcode: 'B1', cod: 15, dod: 0 }, c), 'ជួរគ្មាន barcodes មិនមែនភស្តុតាង').toBe('absent');
});

it('⛔ កែតម្លៃក្រៅបណ្តាញ ➜ reload ៖ barcode នៅតម្លៃចាស់ (history មិនដែលចុះ) ➜ delta ledger មិន replay · row ទម្លាក់ · មិន blocked', async () => {
    await queueDelta(5, ledgerDeltaCompanion('item1', 'B1', 15, 0, 10, 0));
    const second = boot({ [ITEM]: item(10) });
    const out = await settle(second);
    expect({ ...out, ledgerWrites: second.writes.map(w => w.path) }).toEqual({ verdict: 'sent', rows: 0, blocked: 0, deferred: false, ledgerWrites: [] });
});

it('history ចុះ (barcode ថ្លែងតម្លៃថ្មី) តែ delta ledger បាត់ ➜ replay ម្តង (ថ្ងៃ + ខែ)', async () => {
    await queueDelta(5, ledgerDeltaCompanion('item1', 'B1', 15, 0, 10, 0));
    const second = boot({ [ITEM]: item(15) });
    const out = await settle(second);
    expect({ ...out, ledgerWrites: second.writes.map(w => w.path).sort() }).toEqual({ verdict: 'sent', rows: 0, blocked: 0, deferred: false, ledgerWrites: [DAILY, MONTHLY] });
    expect(second.state.daily.codDollar).toBe(45);
    expect(second.state.months[MONTH].codDollar).toBe(45);
});

it('ស្កេនក្រៅបណ្តាញ ➜ reload ៖ barcode មិនមានក្នុង item (save មិនដែលចុះ) ➜ មិន replay · ទម្លាក់; barcode មាន ➜ replay', async () => {
    await queueDelta(7, ledgerDeltaCompanion('item1', 'B9', 7, 0));
    const lost = boot({ [ITEM]: item(10) });
    const outLost = await settle(lost);
    expect({ ...outLost, writes: lost.writes.length }).toEqual({ verdict: 'sent', rows: 0, blocked: 0, deferred: false, writes: 0 });
    await queueDelta(7, ledgerDeltaCompanion('item1', 'B9', 7, 0));
    const saved = boot({ [ITEM]: { ...item(10), barcodes: [{ code: 'B1', cod: 10, dod: 0 }, { code: 'B9', cod: 7, dod: 0 }] } });
    const outSaved = await settle(saved);
    expect({ ...outSaved, writes: saved.writes.map(w => w.path).sort() }).toEqual({ verdict: 'sent', rows: 0, blocked: 0, deferred: false, writes: [DAILY, MONTHLY] });
    expect(saved.state.daily.totalCount).toBe(2);
});

it('delta ledger ចុះរួច (token ក្នុង ring) តែ barcode នៅតម្លៃចាស់ ➜ ដកវិញម្តង (op_r…) · recovery ម្តងទៀតមិនដកស្ទួន', async () => {
    const saved = await queueDelta(5, ledgerDeltaCompanion('item1', 'B1', 15, 0, 10, 0));
    const tokens = saved.map((r: any) => r.intent.token);
    const applied = { codDollar: 45, dodDollar: 0, totalCount: 2, op: tokens[0], ops: { op_prior_day: 3, [tokens[0]]: 4 } };
    const appliedMonths = { [MONTH]: { codDollar: 45, dodDollar: 0, totalCount: 2, op: tokens[1], ops: { op_prior_mon: 3, [tokens[1]]: 4 } } };
    const second = boot({ [ITEM]: item(10) }, applied, appliedMonths);
    const out = await settle(second);
    expect({ ...out, writes: second.writes.map(w => w.path).sort() }).toEqual({ verdict: 'sent', rows: 0, blocked: 0, deferred: false, writes: [DAILY, MONTHLY] });
    expect(second.state.daily.codDollar).toBe(40);
    expect(second.state.months[MONTH].codDollar).toBe(40);
    expect(Object.keys(second.state.daily.ops).some(t => /^op_r/.test(t))).toBe(true);
    await second.sdk.deleteApp(second.app);
    saved.forEach((r: any) => localStorage.setItem('zoew_connection_writes_v1:' + encodeURIComponent(r.scope) + ':' + encodeURIComponent(r.topic) + ':' + r.opId, JSON.stringify(r)));
    const third = boot({ [ITEM]: item(10) }, second.state.daily, second.state.months);
    const again = await settle(third);
    expect({ ...again, writes: third.writes.length, cod: third.state.daily.codDollar }).toEqual({ verdict: 'sent', rows: 0, blocked: 0, deferred: false, writes: 0, cod: 40 });
});

it('delta ចុះរួច · barcode ថ្លែងតម្លៃផ្សេង (ឧបករណ៍ផ្សេងកែបន្ត) ឬបាត់ ➜ មិនដកវិញ · ទម្លាក់ (មិនទាយ)', async () => {
    for (const serverItem of [item(12), { id: 'item1', barcodes: [] }]) {
        const saved = await queueDelta(5, ledgerDeltaCompanion('item1', 'B1', 15, 0, 10, 0));
        const tokens = saved.map((r: any) => r.intent.token);
        const applied = { codDollar: 45, dodDollar: 0, totalCount: 2, op: tokens[0], ops: { op_prior_day: 3, [tokens[0]]: 4 } };
        const appliedMonths = { [MONTH]: { codDollar: 45, dodDollar: 0, totalCount: 2, op: tokens[1], ops: { op_prior_mon: 3, [tokens[1]]: 4 } } };
        const second = boot({ [ITEM]: serverItem }, applied, appliedMonths);
        const out = await settle(second);
        expect({ ...out, writes: second.writes.length, cod: second.state.daily.codDollar }).toEqual({ verdict: 'sent', rows: 0, blocked: 0, deferred: false, writes: 0, cod: 45 });
        await second.sdk.deleteApp(second.app);
    }
});

it('companion អានមិនបាន (បណ្តាញ) ➜ deferred · មិន replay · row នៅ (មិន blocked · មិនទាយ)', async () => {
    await queueDelta(5, ledgerDeltaCompanion('item1', 'B1', 15, 0, 10, 0));
    const second = boot({ [ITEM]: new TypeError('Failed to fetch') });
    const pending = settle(second);
    await vi.waitFor(() => expect(nativeWriteRecoveryState(second.db).deferred).toBe(true));
    const whileDown = { rows: records().length, blocked: nativeWriteRecoveryState(second.db).blocked, writes: second.writes.length };
    expect(whileDown).toEqual({ rows: 2, blocked: 0, writes: 0 });
    await second.sdk.deleteApp(second.app);
    await Promise.race([pending, new Promise(r => setTimeout(r, 50))]);
});

it('ទិសផ្ទុយ ៖ intent គ្មាន companion (កែស្ថិតិដោយដៃ · cleanup) ➜ replay ដូចដើម', async () => {
    await queueDelta(5, null);
    const second = boot({});
    const out = await settle(second);
    expect({ ...out, writes: second.writes.map(w => w.path).sort() }).toEqual({ verdict: 'sent', rows: 0, blocked: 0, deferred: false, writes: [DAILY, MONTHLY] });
    expect(second.state.daily.codDollar).toBe(45);
});

it('⛔ ស្កេន item ថ្មីក្រៅបណ្តាញ ➜ reload ៖ update (receipt) នៃ item ត្រូវផ្ញើឡើងវិញ **មុន** សម្រេច delta ledger ➜ item ចុះ · delta replay (មិនបាត់)', async () => {
    const pendingUpdate: any[] = []; const pendingTx: any[] = [];
    const first = lab((_ref: any, updater: any) => { updater(pathOf(_ref) === DAILY ? structuredClone(priorDaily) : structuredClone(priorMonths)); return new Promise(r => { pendingTx.push(r); }); },
        () => new Promise(r => { pendingUpdate.push(r); }));
    addRevenueToDailyAndMonthlyRecord(DAY, 7, 0, 1, ledgerDeltaCompanion('item9', 'B9', 7, 0));
    await vi.waitFor(() => expect(records()).toHaveLength(2)); await turn();
    first.sdk.update(first.sdk.ref(first.db, 'zoew_scan_history_cod_dod'), { item9: { id: 'item9', phone: '012000999', scanDate: DAY, barcodes: [{ code: 'B9', cod: 7, dod: 0 }] } }).catch(() => {});
    await vi.waitFor(() => expect(records()).toHaveLength(3)); await turn();
    await first.sdk.deleteApp(first.app);
    const server: Record<string, any> = {};
    vi.stubGlobal('fetch', async (url: string) => {
        const p = decodeURIComponent(new URL(String(url)).pathname).replace(/^\/|\.json$/g, '');
        if (p === DAILY) return Response.json(priorDaily);
        if (p === MONTHLY) return Response.json(priorMonths);
        return Response.json(p in server ? server[p] : null);
    });
    const writes: string[] = [];
    const state = { daily: structuredClone(priorDaily), months: structuredClone(priorMonths) };
    const second = lab(async (ref: any, updater: any) => {
        const path = pathOf(ref); const current = path === DAILY ? state.daily : state.months;
        const next = updater(structuredClone(current));
        if (next === undefined) return { committed: false, snapshot: { val: () => current } };
        if (path === DAILY) state.daily = next; else state.months = next;
        writes.push(path);
        return { committed: true, snapshot: { val: () => next } };
    }, async (_ref: any, value: any) => { for (const key of Object.keys(value)) if (!key.startsWith('zoew_write_receipts/')) server[key] = value[key]; writes.push('update:' + Object.keys(value).filter(k => !k.startsWith('zoew_write_receipts/')).join(',')); });
    const out = await settle(second);
    expect({ ...out, writes: writes.sort(), item: !!server['zoew_scan_history_cod_dod/item9'], count: state.daily.totalCount })
        .toEqual({ verdict: 'sent', rows: 0, blocked: 0, deferred: false, writes: [DAILY, MONTHLY, 'update:zoew_scan_history_cod_dod/item9', 'update:zoew_settings/exchange_rate'].sort(), item: true, count: 3 });
});

// Re-audit (money ②) ៖ a delta whose data write landed but whose barcode another device moved out of the row before this device
// reopened (pickup cleanup two hours after the close · Remove · Delete · the 8-day rule) read `absent` and was dropped ➜ the ledger
// never counted a parcel whose later move deducted (Remove · 8-day) or kept it (pickup · Delete). The barcode's own copy decides:
// the same code and `createdAt` in history or trash (`ledgerCompanionCopyState()`), read like the row (holds ➜ apply · prior ➜ undo).
// A barcode found nowhere is never proof the write never landed (a hand purge also leaves nothing) ➜ dropped as before.
const CREATED = Date.UTC(2026, 9, 14, 3);
const HISTORY_ROOT = 'zoew_scan_history_cod_dod';
const TRASH_ROOT = 'zoew_recently_deleted_cod_dod';
const movedTo = (code: string, cod: number, createdAt: number, trashReason = 'pickup') => ({ tr1: { id: 'tr1', phone: '012000111', scanDate: DAY,
    trashReason, deletedAt: CREATED + 7200000, barcodes: [{ code, cod, dod: 0, isClosed: true, createdAt }] } });

it('ledgerDeltaCompanion កត់ createdAt · ledgerCompanionCopyState អានច្បាប់ចម្លងដែល code + createdAt ដូចគ្នាតែប៉ុណ្ណោះ', () => {
    const scan = ledgerDeltaCompanion('item1', 'B9', 7, 0, undefined, undefined, CREATED)!;
    expect(scan).toEqual({ path: ITEM, code: 'B9', wantCod: 7, wantDod: 0, createdAt: CREATED });
    expect(ledgerCompanionCopyState([{ item1: item(10) }, movedTo('B9', 7, CREATED)], scan)).toBe('holds');
    expect(ledgerCompanionCopyState([{ item2: { barcodes: { 0: { code: 'B9', cod: 7, dod: 0, createdAt: CREATED } } } }, null], scan), 'another row of history').toBe('holds');
    expect(ledgerCompanionCopyState([{ item1: item(10) }, movedTo('B9', 7, CREATED + 1)], scan), 'another lifecycle').toBe('absent');
    expect(ledgerCompanionCopyState([null, null], scan)).toBe('absent');
    const edit = ledgerDeltaCompanion('item1', 'B1', 15, 0, 10, 0, CREATED)!;
    expect(ledgerCompanionCopyState([{}, movedTo('B1', 10, CREATED)], edit)).toBe('prior');
    expect(ledgerCompanionCopyState([{}, movedTo('B1', 15, CREATED)], ledgerDeltaCompanion('item1', 'B1', 15, 0, 10, 0)!), 'no createdAt ➜ no copy search').toBe('absent');
});

it('⛔ ស្កេនចុះ · delta ledger មិនចុះ · ឧបករណ៍ផ្សេងរំកិល barcode ទៅធុងសំរាម (យករួច ២ ម៉ោង) មុន reload ➜ ច្បាប់ចម្លង ➜ replay ម្តង', async () => {
    await queueDelta(7, ledgerDeltaCompanion('item1', 'B9', 7, 0, undefined, undefined, CREATED));
    const second = boot({ [ITEM]: item(10), [HISTORY_ROOT]: { item1: item(10) }, [TRASH_ROOT]: movedTo('B9', 7, CREATED) });
    const out = await settle(second);
    expect({ ...out, writes: second.writes.map(w => w.path).sort(), day: second.state.daily.codDollar, month: second.state.months[MONTH].codDollar })
        .toEqual({ verdict: 'sent', rows: 0, blocked: 0, deferred: false, writes: [DAILY, MONTHLY], day: 47, month: 47 });
});

it('control ៖ barcode ដដែលក្នុងធុងសំរាម តែ createdAt ផ្សេង ឬគ្មានច្បាប់ចម្លងណាមួយ ➜ មិន replay · ទម្លាក់ (មិនទាយ)', async () => {
    for (const trash of [movedTo('B9', 7, CREATED + 1), {}]) {
        await queueDelta(7, ledgerDeltaCompanion('item1', 'B9', 7, 0, undefined, undefined, CREATED));
        const second = boot({ [ITEM]: item(10), [HISTORY_ROOT]: { item1: item(10) }, [TRASH_ROOT]: trash });
        const out = await settle(second);
        expect({ ...out, writes: second.writes.length, day: second.state.daily.codDollar }).toEqual({ verdict: 'sent', rows: 0, blocked: 0, deferred: false, writes: 0, day: 40 });
        await second.sdk.deleteApp(second.app);
    }
});

it('⛔ កែតម្លៃ ១០ ➜ ១៥ ៖ barcode រំកិលទៅធុងសំរាមដោយតម្លៃថ្មី · delta មិនចុះ ➜ replay +៥ · ដោយតម្លៃចាស់ · delta ចុះរួច ➜ ដកវិញម្តង', async () => {
    await queueDelta(5, ledgerDeltaCompanion('item1', 'B1', 15, 0, 10, 0, CREATED));
    const landed = boot({ [ITEM]: { id: 'item1', barcodes: [] }, [HISTORY_ROOT]: {}, [TRASH_ROOT]: movedTo('B1', 15, CREATED, 'remove') });
    const outLanded = await settle(landed);
    expect({ ...outLanded, day: landed.state.daily.codDollar }).toEqual({ verdict: 'sent', rows: 0, blocked: 0, deferred: false, day: 45 });
    await landed.sdk.deleteApp(landed.app);
    const saved = await queueDelta(5, ledgerDeltaCompanion('item1', 'B1', 15, 0, 10, 0, CREATED));
    const tokens = saved.map((r: any) => r.intent.token);
    const applied = { codDollar: 45, dodDollar: 0, totalCount: 2, op: tokens[0], ops: { op_prior_day: 3, [tokens[0]]: 4 } };
    const appliedMonths = { [MONTH]: { codDollar: 45, dodDollar: 0, totalCount: 2, op: tokens[1], ops: { op_prior_mon: 3, [tokens[1]]: 4 } } };
    const lost = boot({ [ITEM]: { id: 'item1', barcodes: [] }, [HISTORY_ROOT]: {}, [TRASH_ROOT]: movedTo('B1', 10, CREATED, 'remove') }, applied, appliedMonths);
    const outLost = await settle(lost);
    expect({ ...outLost, day: lost.state.daily.codDollar, month: lost.state.months[MONTH].codDollar }).toEqual({ verdict: 'sent', rows: 0, blocked: 0, deferred: false, day: 40, month: 40 });
});
