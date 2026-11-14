import { webcrypto } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import { acceptFixtureSession } from './helpers/accepted-session';
import { createScanMemorySdk } from './helpers/scan-memory-sdk';
import { resetServerClock } from '../../../../ZoeW/src/core/clock';
import { dataState, firebaseState, securityState, uiState, ztoState } from '../../../../ZoeW/src/core/state';
import { appLocalStore } from '../../../../ZoeW/src/core/storage';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../../../../ZoeW/src/core/text';
import { ztoScanStampMillis } from '../../../../ZoeW/src/core/timezone';
import { barcodeEntriesOf, normalizeBarcodesOf } from '../../../../ZoeW/src/domain/barcode';
import { clearCustomerDataTableCache } from '../../../../ZoeW/src/features/customer-table';
import { resetZtoFinalMarks, syncZtoFinalMarks } from '../../../../ZoeW/src/features/zto-final-marks';
import { removeReturnedZtoBarcodes } from '../../../../ZoeW/src/features/zto-returned';
import { clearZtoPickupStatusStore, runZtoStatusSweep, ztoPickupStatus } from '../../../../ZoeW/src/features/zto-status';
import { buildTrashGroups, trashGroupInFilter } from '../../../../ZoeW/src/features/trash';

// Real application sweep/list/final-mark paths with SDK data semantics only.
// Projected provider HTTP and the accepted SDK actor are controlled here; this
// does not claim to exercise Firebase Rules, Supabase RLS, or live ZTO.
const NOW = Date.UTC(2026, 10, 14, 4);
const STAMP_TEXT = '2026-11-14 10:59:00';
const STAMP = ztoScanStampMillis(STAMP_TEXT);
const SCOPE = 'https://terminal-status-fixture.firebaseio.com';
const H = 'zoew_scan_history_cod_dod', T = 'zoew_recently_deleted_cod_dod';
const MONEY = ['zoew_daily_revenue_cod_dod', 'zoew_monthly_revenue_cod_dod', 'zoew_daily_pickup_cod_dod',
    'zoew_daily_collected_cod_dod', 'zoew_barcode_registry'];
type Mode = 'cookie' | 'palm';
type Reason = 'delete' | 'remove' | 'pickup';
type Decision = 'signed' | 'returned';

function row(mode: Mode, reason: Reason, closed: boolean, decision?: Decision) {
    return { id: 'terminal-source', phone: '012345678', scanDate: '2026-11-13', time: '11:00',
        createdAt: NOW - 24 * 60 * 60 * 1000, deletedAt: NOW - 10_000, restoreGeneration: 2,
        restorePublication: 3, trashMode: mode, trashReason: reason, isFromDeletion: reason !== 'remove',
        isClosed: closed, count: 1, cod: 10, dod: 2, price: 12, isDeducted: reason !== 'delete',
        ...(decision ? { ztoTerminalDecision: decision } : {}),
        barcodes: [{ code: 'TERM123456', cod: 10, dod: 2, isClosed: closed, isDeducted: reason !== 'delete',
            createdAt: NOW - 24 * 60 * 60 * 1000, time: '11:00', ...(closed ? { closedAt: NOW - 60 * 60 * 1000 } : {}) }] };
}

function businessView(item: any) {
    const copy = structuredClone(item);
    delete copy.restoreBlocked;
    barcodeEntriesOf(copy.barcodes).forEach(({ barcode }) => {
        delete barcode.ztoSignedAt;
        delete barcode.ztoSignedExact;
        delete barcode.ztoReturnedAt;
        delete barcode.ztoMisplacedAt;
        delete barcode.ztoSentOutAt;
    });
    return copy;
}

function groupsView(items: any[]) {
    return buildTrashGroups(items).map(group => ({ reason: group.reason, cod: group.cod, dod: group.dod,
        count: group.count, total: group.total, codes: group.codes,
        deducted: trashGroupInFilter(group, 'deducted'), kept: trashGroupInFilter(group, 'kept') }));
}

function world(mode: Mode, source: any, outcome: 'signed' | 'returned' | 'unsigned' | 'boolean-only' = 'unsigned',
    returnedText = STAMP_TEXT, provider: { signedListAt?: string; signedDetailAt?: string } = {}) {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    vi.stubGlobal('crypto', webcrypto);
    appLocalStore.clear();
    clearZtoPickupStatusStore();
    resetZtoFinalMarks();
    resetServerClock();
    clearCustomerDataTableCache();
    dbListenerPendingPaths.clear();
    dbListenerFailedPaths.clear();
    const options = { databaseURL: SCOPE };
    appLocalStore.setItem('zoew_firebase_config', JSON.stringify(options));
    appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ enabled: true, fastMode: true,
        url: window.location.origin + '/.netlify/functions/zto-order-detail?'
            + (mode === 'palm' ? 'palm=1&' : '') + 'barcode={barcode}' }));
    const mem = createScanMemorySdk();
    const writes: { path: string; value: any }[] = [];
    const transact = mem.sdk.runTransaction;
    mem.sdk.runTransaction = async (ref, updater) => {
        const before = mem.get(ref.path), answer = await transact(ref, updater);
        if (answer.committed && JSON.stringify(before) !== JSON.stringify(answer.snapshot.val()))
            writes.push({ path: ref.path, value: answer.snapshot.val() });
        return answer;
    };
    firebaseState.auth = { currentUser: { uid: 'terminal-owner' }, app: { options } } as any;
    firebaseState.firebaseConfig = options;
    firebaseState.db = { name: 'terminal-db', app: { options } } as any;
    firebaseState.fb = mem.sdk as any;
    acceptFixtureSession();
    firebaseState.serverTimeOffsetMs = 0;
    firebaseState.serverClockTrusted = true;
    firebaseState.sessionExpiryCheck = 'live';
    firebaseState.isDatabaseConnected = true;
    firebaseState.isDatabaseInitialized = true;
    firebaseState.isInitializingFirebase = false;
    const refs = { dbRefHistory: H, dbRefDeleted: T, dbRefDailyRevenue: MONEY[0], dbRefMonthlyRevenue: MONEY[1],
        dbRefDailyPickup: MONEY[2], dbRefDailyCollected: MONEY[3], dbRefRegistry: MONEY[4] };
    for (const [name, path] of Object.entries(refs)) (firebaseState as any)[name] = mem.sdk.ref(firebaseState.db, path);
    securityState.appIsLocked = false;
    uiState.isModalOpen = false;
    dataState.scanHistory = [];
    mem.put(T + '/' + source.id, source);
    mem.put(MONEY[0], { '2026-11-13': { codDollar: 100, dodDollar: 10, totalCount: 7 } });
    mem.put(MONEY[1], { '2026-11': { codDollar: 100, dodDollar: 10, totalCount: 7 } });
    mem.put(MONEY[2], { '2026-11-13': { count: 3, pickedUpBarcodes: { unrelated: true } } });
    mem.put(MONEY[3], { '2026-11-13': { count: 2, totalDollar: 9 } });
    mem.put(MONEY[4], { unrelated: { rowId: 'unrelated-row' } });
    const sync = () => {
        dataState.deletedItems = Object.entries(mem.get(T) || {}).map(([id, value]: any) => normalizeBarcodesOf({ ...value, id }));
        dataState.scanHistory = Object.entries(mem.get(H) || {}).map(([id, value]: any) => normalizeBarcodesOf({ ...value, id }));
        dataState.dailyRevenueData = mem.get(MONEY[0]);
        dataState.monthlyRevenueData = mem.get(MONEY[1]);
        dataState.dailyPickupData = mem.get(MONEY[2]);
        dataState.dailyCollectedData = mem.get(MONEY[3]);
    };
    sync();
    ztoState.ztoTrashMode = { state: 'ok', palmAt: mode === 'palm' ? NOW : 0,
        cookieAt: mode === 'cookie' ? NOW : 0, shop: SCOPE } as any;
    ztoState.ztoStatusInFlight = false;
    ztoState.ztoStatusLastSweepAt = 0;
    ztoState.ztoStatusSweepCursor = 0;
    ztoState.ztoSignedSweepAt = 0;
    ztoState.ztoSignedSweepWaitMs = 2 * 60 * 1000;
    ztoState.ztoSignedOff = false;
    ztoState.ztoReturnedSweepAt = 0;
    ztoState.ztoAbandonHoldSince = 0;
    const requests: URL[] = [];
    let beforeResponse: (() => void) | undefined;
    vi.stubGlobal('fetch', async (input: any) => {
        const url = new URL(String(input));
        requests.push(url);
        beforeResponse?.();
        if (url.searchParams.has('status')) {
            // Cookie's ordinary status response does not attest Return. Its
            // actual returned-list client below must supply that evidence.
            return Response.json({ barcode: 'TERM123456', success: true, found: true, cached: false,
                ztoClosed: outcome === 'signed' || outcome === 'boolean-only',
                ...(outcome === 'signed' ? { ztoSignedAt: provider.signedDetailAt || STAMP_TEXT } : {}),
                ...(mode === 'palm' && outcome === 'returned' ? { ztoReturnedAt: returnedText } : {}) });
        }
        if (url.searchParams.has('list')) {
            const body: any = { success: true, list: true, enabled: true, maxPages: 100, rows: [], page: 1, pages: 1, pagesUnknown: false,
                total: 0, site: '881859', siteName: 'Fixture branch', otherScans: 0, signedScans: 0 };
            if (url.searchParams.has('signed')) Object.assign(body, { kind: 'signed', signedOk: true, signedMismatch: 0,
                signed: provider.signedListAt ? ['TERM123456'] : [], signedScans: provider.signedListAt ? 1 : 0,
                total: provider.signedListAt ? 1 : 0,
                signedRows: provider.signedListAt ? [{ barcode: 'TERM123456', at: provider.signedListAt }] : [] });
            else if (url.searchParams.has('returned')) Object.assign(body, { kind: 'returned', returnedOk: true,
                returnedScans: outcome === 'returned' ? 1 : 0, total: outcome === 'returned' ? 1 : 0,
                returned: outcome === 'returned' ? [{ barcode: 'TERM123456', at: returnedText }] : [] });
            else if (url.searchParams.has('sent')) Object.assign(body, { kind: 'sent', sentOk: true, sentScans: 0, sent: [] });
            else if (url.searchParams.has('problem')) Object.assign(body, { kind: 'problem', problemOk: true, problemScans: 0, problem: [] });
            else throw new Error('Unexpected list projection ' + url);
            return Response.json(body);
        }
        throw new Error('Unexpected provider request ' + url);
    });
    const financial = MONEY.map(path => mem.get(path));
    const groups = groupsView(dataState.deletedItems);
    const assertBusinessUntouched = () => {
        expect(businessView(mem.get(T + '/' + source.id))).toEqual(businessView(source));
        expect(MONEY.map(path => mem.get(path))).toEqual(financial);
        expect(mem.get(H)).toBeNull();
        expect(dataState.scanHistory).toEqual([]);
        expect(groupsView(dataState.deletedItems)).toEqual(groups);
        expect(writes.every(write => write.path === T + '/' + source.id)).toBe(true);
    };
    const sweep = async (force = true) => {
        await runZtoStatusSweep(force);
        await syncZtoFinalMarks();
        sync();
    };
    return { mem, requests, writes, sync, sweep, assertBusinessUntouched,
        beforeResponse: (callback: () => void) => { beforeResponse = callback; } };
}

for (const mode of ['cookie', 'palm'] as const) {
    for (const decision of ['signed', 'returned'] as const) {
        it(`${mode}: ${decision} enrichment preserves raw sparse barcode slot identity after listener normalization`, async () => {
            const arraySource = row(mode, 'remove', false, decision);
            const source = { ...arraySource, barcodes: { 3: arraySource.barcodes[0] } };
            const w = world(mode, source, decision);
            expect(Object.keys(w.mem.get(T + '/' + source.id).barcodes)).toEqual(['3']);
            expect(dataState.deletedItems[0].barcodes).toEqual([arraySource.barcodes[0]]);
            await w.sweep();
            const saved = w.mem.get(T + '/' + source.id);
            expect(Object.keys(saved.barcodes)).toEqual(['3']);
            expect(saved.barcodes[3][decision === 'signed' ? 'ztoSignedAt' : 'ztoReturnedAt']).toBe(STAMP);
            if (decision === 'signed') expect(saved.barcodes[3].ztoSignedExact).toBe(true);
            w.assertBusinessUntouched();
            const committed = w.writes.length;
            await w.sweep();
            expect(w.writes).toHaveLength(committed);
            expect(Object.keys(w.mem.get(T + '/' + source.id).barcodes)).toEqual(['3']);
            w.assertBusinessUntouched();
        });
    }
}

for (const closed of [false, true]) {
    it(`cookie signed-list exact time is authoritative when terminal trash closed=${closed} and detail is boolean-only`, async () => {
        const source = row('cookie', 'remove', closed, 'signed');
        const w = world('cookie', source, 'boolean-only', STAMP_TEXT, { signedListAt: STAMP_TEXT });
        await w.sweep();
        expect(w.requests.some(url => url.searchParams.has('signed') && url.searchParams.has('exact'))).toBe(true);
        expect(w.mem.get(T + '/' + source.id).barcodes[0].ztoSignedAt).toBe(STAMP);
        expect(w.mem.get(T + '/' + source.id).barcodes[0].ztoSignedExact).toBe(true);
        w.assertBusinessUntouched();
        const committed = w.writes.length;
        await w.sweep();
        expect(w.writes).toHaveLength(committed);
        w.assertBusinessUntouched();
    });
}

for (const mode of ['cookie', 'palm'] as const) {
    for (const basis of ['birth', 'restoredAt'] as const) {
        for (const via of mode === 'cookie' ? ['detail', 'list'] as const : ['detail'] as const) {
            it(`${mode} ${via}: exact Sign before barcode ${basis} cannot stamp the current terminal lifecycle`, async () => {
                const source: any = row(mode, 'remove', false, 'signed');
                source.barcodes[0][basis === 'birth' ? 'createdAt' : 'restoredAt'] = NOW - 30_000;
                const w = world(mode, source, via === 'list' ? 'boolean-only' : 'signed', STAMP_TEXT,
                    via === 'list' ? { signedListAt: STAMP_TEXT } : {});
                await w.sweep();
                expect(w.mem.get(T + '/' + source.id).barcodes[0].ztoSignedAt).toBeUndefined();
                w.assertBusinessUntouched();
            });
        }
    }
    for (const decision of ['signed', 'returned'] as const) {
        it(`${mode}: future provider ${decision} time cannot become an actual terminal timestamp`, async () => {
            const source = row(mode, 'remove', false, decision);
            const w = world(mode, source, decision, '2026-11-14 11:01:00', { signedDetailAt: '2026-11-14 11:01:00' });
            await w.sweep();
            expect(w.mem.get(T + '/' + source.id).barcodes[0].ztoSignedAt).toBeUndefined();
            expect(w.mem.get(T + '/' + source.id).barcodes[0].ztoReturnedAt).toBeUndefined();
            w.assertBusinessUntouched();
        });
    }
    it(`${mode}: a restore claim acquired while the provider answer is pending forbids all final source writes`, async () => {
        const source: any = row(mode, 'remove', false, 'signed'), w = world(mode, source, 'signed');
        w.beforeResponse(() => {
            if (source.restoreClaim) return;
            source.restoreClaim = { token: 'new-owned-operation', targetId: 'new-target', claimedAt: NOW };
            w.mem.put(T + '/' + source.id, source);
            w.sync();
        });
        await w.sweep();
        expect(w.requests.length).toBeGreaterThan(0);
        expect(w.mem.get(T + '/' + source.id).barcodes[0].ztoSignedAt).toBeUndefined();
        expect(ztoPickupStatus.get('TERM123456')).toBeUndefined();
        expect(w.writes).toHaveLength(0);
        w.assertBusinessUntouched();
    });
}

afterEach(() => {
    clearZtoPickupStatusStore();
    resetZtoFinalMarks();
    resetServerClock();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

it('control: existing closed pickup trash still persists an actual Sign time', async () => {
    const source = row('cookie', 'pickup', true), w = world('cookie', source, 'signed');
    await w.sweep();
    expect(w.requests.some(url => url.searchParams.has('status'))).toBe(true);
    expect(w.mem.get(T + '/' + source.id).barcodes[0].ztoSignedAt).toBe(STAMP);
    w.assertBusinessUntouched();
});

for (const mode of ['cookie', 'palm'] as const) {
    for (const reason of ['delete', 'remove', 'pickup'] as const) {
        for (const closed of [false, true]) {
            for (const decision of ['signed', 'returned'] as const) {
                it(`${mode} ${reason} closed=${closed}: released ${decision} decision catches up only fresh provider stamps`, async () => {
                    const source = row(mode, reason, closed, decision), w = world(mode, source, decision);
                    await w.sweep();
                    const saved = w.mem.get(T + '/' + source.id);
                    expect(saved.barcodes[0][decision === 'signed' ? 'ztoSignedAt' : 'ztoReturnedAt']).toBe(STAMP);
                    if (decision === 'signed') expect(saved.barcodes[0].ztoSignedExact).toBe(true);
                    else if (mode === 'cookie') {
                        expect(w.requests.some(url => url.searchParams.has('signed') && url.searchParams.has('exact'))).toBe(true);
                        expect(w.requests.some(url => url.searchParams.has('returned'))).toBe(true);
                        expect(w.requests.some(url => url.searchParams.has('sent'))).toBe(true);
                    }
                    w.assertBusinessUntouched();
                    const committed = w.writes.length;
                    const requested = w.requests.length;
                    await w.sweep(false);
                    expect(w.requests).toHaveLength(requested);
                    expect(w.writes).toHaveLength(committed);
                    await w.sweep();
                    expect(w.writes).toHaveLength(committed);
                    w.assertBusinessUntouched();
                });
            }
        }
    }
    it(`${mode}: terminal decision alone and boolean-only Sign never invent an event timestamp`, async () => {
        const source = row(mode, 'remove', false, 'signed'), w = world(mode, source, 'boolean-only');
        await w.sweep();
        expect(w.requests.some(url => url.searchParams.has('status'))).toBe(true);
        expect(w.mem.get(T + '/' + source.id).barcodes[0].ztoSignedAt).toBeUndefined();
        expect(w.mem.get(T + '/' + source.id).barcodes[0].ztoReturnedAt).toBeUndefined();
        w.assertBusinessUntouched();
    });
    it(`${mode}: no status answer does not turn a decision into a provider stamp`, async () => {
        const source = row(mode, 'delete', false, 'returned'), w = world(mode, source, 'unsigned');
        await w.sweep();
        expect(w.mem.get(T + '/' + source.id).barcodes[0].ztoSignedAt).toBeUndefined();
        expect(w.mem.get(T + '/' + source.id).barcodes[0].ztoReturnedAt).toBeUndefined();
        w.assertBusinessUntouched();
    });
    for (const reason of ['delete', 'remove', 'pickup'] as const) {
        it(`${mode} ${reason}: an owned restore claim holds all decision-row polling`, async () => {
            const source = { ...row(mode, reason, true, 'signed'), restoreClaim: { token: 'held-operation', targetId: 'target-row', claimedAt: NOW } };
            const w = world(mode, source, 'signed');
            await w.sweep();
            expect(w.requests).toHaveLength(0);
            expect(w.writes).toHaveLength(0);
            w.assertBusinessUntouched();
        });
    }
    it(`${mode}: ordinary open manual trash without a decision keeps its previous ineligibility`, async () => {
        const source = row(mode, 'remove', false), w = world(mode, source, 'signed');
        await w.sweep();
        expect(w.requests).toHaveLength(0);
        expect(w.writes).toHaveLength(0);
        w.assertBusinessUntouched();
    });
    it(`${mode}: an invalid decision does not admit ordinary manual trash into ZTO polling`, async () => {
        const source = { ...row(mode, 'remove', false), ztoTerminalDecision: 'SIGNED' }, w = world(mode, source, 'signed');
        await w.sweep();
        expect(w.requests).toHaveLength(0);
        expect(w.writes).toHaveLength(0);
        w.assertBusinessUntouched();
    });
    for (const deletedAt of [NOW + 60_000, NOW - 100 * 24 * 60 * 60 * 1000]) {
        it(`${mode}: decision does not bypass deletedAt bounds (${deletedAt > NOW ? 'future' : 'expired'})`, async () => {
            const source = { ...row(mode, 'remove', false, 'returned'), deletedAt }, w = world(mode, source, 'returned');
            await w.sweep();
            expect(w.requests).toHaveLength(0);
            expect(w.writes).toHaveLength(0);
            w.assertBusinessUntouched();
        });
    }
    it(`${mode}: a stale Return from a previous lifecycle cannot stamp the new trash lifecycle`, async () => {
        const source = row(mode, 'remove', false, 'returned');
        source.barcodes[0] = { ...source.barcodes[0], restoredAt: NOW - 30_000 } as any;
        const w = world(mode, source, 'returned', '2026-11-14 10:00:00');
        await w.sweep();
        expect(w.mem.get(T + '/' + source.id).barcodes[0].ztoReturnedAt).toBeUndefined();
        w.assertBusinessUntouched();
    });
    it(`${mode}: an answer after actor/session replacement cannot stamp terminal trash`, async () => {
        const source = row(mode, 'remove', false, 'signed'), w = world(mode, source, 'signed');
        w.beforeResponse(() => { firebaseState.authGeneration++; });
        await w.sweep();
        expect(w.mem.get(T + '/' + source.id).barcodes[0].ztoSignedAt).toBeUndefined();
        expect(w.writes).toHaveLength(0);
        w.assertBusinessUntouched();
    });
}

for (const mode of ['cookie','palm'] as const) for (const reason of ['delete','remove','pickup'] as const) for (const closed of [false,true]) {
    it(`existing Return without restore: ${mode} ${reason} closed=${closed} enriches status only`,async()=>{
        const source:any=row(mode,reason,closed);
        if(mode==='palm'&&reason==='pickup')source.restoreBlocked=true;
        const w=world(mode,source,'returned');
        removeReturnedZtoBarcodes([{barcode:'TERM123456',at:STAMP_TEXT}],[]);
        await syncZtoFinalMarks();w.sync();
        expect(w.mem.get(T+'/'+source.id).barcodes[0].ztoReturnedAt).toBe(STAMP);
        w.assertBusinessUntouched();
        const committed=w.writes.length;
        removeReturnedZtoBarcodes([{barcode:'TERM123456',at:STAMP_TEXT},{barcode:'TERM123456',at:STAMP_TEXT}],[]);
        await syncZtoFinalMarks();w.sync();
        expect(w.writes).toHaveLength(committed);w.assertBusinessUntouched();
    });
}
for(const mode of ['cookie','palm'] as const) {
    for(const bad of ['malformed','old','future','offline','claim','clear','local-mode','missing-mode','future-deleted','expired-deleted'] as const) {
        it(`existing Return without restore: ${mode} ${bad} cannot enrich`,async()=>{
            const source:any=row(mode,'remove',false);
            if(bad==='claim')source.restoreClaim={token:'held',targetId:'target',claimedAt:NOW};
            if(bad==='clear')source.clearClaim={token:'held'};
            if(bad==='local-mode')source.trashMode='local';
            if(bad==='missing-mode')delete source.trashMode;
            if(bad==='future-deleted')source.deletedAt=NOW+1000;
            if(bad==='expired-deleted')source.deletedAt=NOW-100*24*60*60*1000;
            const w=world(mode,source,'returned');
            if(bad==='offline')vi.spyOn(navigator,'onLine','get').mockReturnValue(false);
            const at=bad==='malformed'?'not-a-time':bad==='old'?'2026-11-10 10:59:00':bad==='future'?'2026-11-15 10:59:00':STAMP_TEXT;
            removeReturnedZtoBarcodes([{barcode:'TERM123456',at}],[]);
            await syncZtoFinalMarks();w.sync();
            expect(w.mem.get(T+'/'+source.id).barcodes[0].ztoReturnedAt).toBeUndefined();
            expect(w.writes).toHaveLength(0);w.assertBusinessUntouched();
            vi.restoreAllMocks();
        });
    }
}
it('existing Palm closed-trash status response enriches actual Return without a restore attempt',async()=>{
 const source=row('palm','pickup',true),w=world('palm',source,'returned');
 await w.sweep();
 expect(w.requests.some(url=>url.searchParams.has('status'))).toBe(true);
 expect(w.mem.get(T+'/'+source.id).barcodes[0].ztoReturnedAt).toBe(STAMP);w.assertBusinessUntouched();
});
it('existing Return enriches a sparse known-ZTO source without changing raw numeric slots',async()=>{
 const source:any=row('cookie','remove',true);source.barcodes={3:source.barcodes[0]};
 const w=world('cookie',source,'returned');
 removeReturnedZtoBarcodes([{barcode:'TERM123456',at:STAMP_TEXT}],[]);
 await syncZtoFinalMarks();w.sync();
 expect(Object.keys(w.mem.get(T+'/'+source.id).barcodes)).toEqual(['3']);
 expect(w.mem.get(T+'/'+source.id).barcodes[3].ztoReturnedAt).toBe(STAMP);w.assertBusinessUntouched();
});
