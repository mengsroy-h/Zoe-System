/** តេស្តសំយោគ៖ App + Function ពិត, ZTO និង backend identity ក្លែង។
 * វាស់ memory persistence និង notification DOM; មិនវាស់ RLS/rules ឬ push ទៅឧបករណ៍ពិតទេ។ */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { appLocalStore } from '../../../../ZoeW/src/core/storage';
import { dataState, firebaseState, uiState, ztoState } from '../../../../ZoeW/src/core/state';
import { runZtoListSyncPreview } from '../../../../ZoeW/src/features/zto-list-sync';
import { ztoReturnedTargets } from '../../../../ZoeW/src/features/zto-returned';
import { nearExpiryView, openNotifyDrawer } from '../../../../ZoeW/src/features/notifications';
import { NotifyDrawer } from '../../../../ZoeW/src/app/components/NotifyDrawer';
import { mount, step, unmount } from './native/react-harness';
import { closeSideDrawer } from '../../../../ZoeW/src/ui/page-nav';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../../../../ZoeW/src/core/text';
import { cleanupInFlight, cleanupJournalLive } from '../../../../ZoeW/src/domain/cleanup';
import { returnMemoryBackend } from './helpers/return-memory-backend';
import { ABANDON_AGE_MS } from '../../../../ZoeW/src/features/session';
import { KEY, NOW, SITE, fn, setupWorld, teardownWorld, world } from './zto-palm-harness';

const CODE = 'KH5000000001';
let memory: Awaited<ReturnType<typeof returnMemoryBackend>> | null = null;
const authz = process.env.ZTO_AUTHORIZATION;
afterEach(() => {
    step(() => closeSideDrawer()); unmount(); memory?.close(); memory = null;
    teardownWorld();
    if (authz === undefined) delete process.env.ZTO_AUTHORIZATION; else process.env.ZTO_AUTHORIZATION = authz;
});

describe('Cookie/Palm × Firebase/Supabase៖ ភស្តុតាងត្រឡប់ និងការរំលឹក (សំយោគ)', () => {
    for (const backend of ['firebase', 'supabase'] as const) {
        for (const mode of ['cookie', 'palm'] as const) {
            it(`${mode} × ${backend}`, async () => {
                expect(process.env.ZTO_AUTHORIZATION).toBe(authz);
                await setupWorld(backend, 'require');
                cleanupInFlight.clear(); cleanupJournalLive.clear();
                dbListenerFailedPaths.clear(); dbListenerPendingPaths.clear();
                world.parcels = { [CODE]: { tab: '4', isSign: 0, scans: [
                    { action: '3', siteCode: SITE, time: '2026-10-04 09:00:00' },
                    { action: '-710', siteCode: SITE, time: '2026-10-05 09:00:00' }
                ] } };
                if (mode === 'cookie') {
                    process.env.ZTO_AUTHORIZATION = 'Bearer synthetic-matrix-only';
                    process.env.ZTO_PROXY_KEY = KEY;
                    const cfg = JSON.parse(appLocalStore.getItem('zoew_lookup_api_config')!);
                    cfg.url = cfg.url.replace('palm=1&', '');
                    delete cfg.palmTokenEnc;
                    delete cfg.palmAccount;
                    appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify(cfg));
                    const previousFetch = globalThis.fetch;
                    vi.stubGlobal('fetch', vi.fn(async (url: any, init: any) => {
                        if (new URL(String(url)).hostname !== 'aargus-api.ztoglobal.com') return previousFetch(url, init);
                        const body = JSON.parse(String(init.body));
                        const kind = body.condition.scanTypeCode;
                        const result = kind === '03' || kind === '-710' ? [{ scanBillCode: CODE,
                            consigneeMobile: '0960007345', agentAmount: 3.5, fcAmount: 0,
                            scanTypeCode: kind, scanSiteCode: SITE,
                            scanTime: kind === '03' ? '2026-10-04 09:00:00' : '2026-10-05 09:00:00' }] : [];
                        return Response.json({ success: true, data: { pageNum: 1, pages: result.length ? 1 : 0, total: result.length, result } });
                    }));
                }
                const createdAt = NOW - ABANDON_AGE_MS + 5 * 3600000 - 1;
                const item = { id: 'synthetic-row', phone: '0960007345', scanDate: '2026-09-29', createdAt,
                    barcode: CODE, count: 1, cod: 3.5, dod: 1, price: 4.5, isClosed: false,
                    barcodes: [{ code: CODE, createdAt, cod: 3.5, dod: 1, isClosed: false, isDeducted: false }] };
                const H = 'zoew_scan_history_cod_dod', T = 'zoew_recently_deleted_cod_dod';
                const D = 'zoew_daily_revenue_cod_dod', M = 'zoew_monthly_revenue_cod_dod';
                memory = await returnMemoryBackend(backend, { [H]: { [item.id]: item }, [T]: {},
                    [D]: { '2026-09-29': { codDollar: 3.5, dodDollar: 1, totalCount: 1 } },
                    [M]: { '2026-09': { codDollar: 3.5, dodDollar: 1, totalCount: 1 } } });
                firebaseState.isDatabaseInitialized = true; firebaseState.isDatabaseConnected = true;
                firebaseState.isInitializingFirebase = false; firebaseState.serverClockTrusted = true;
                firebaseState.serverTimeOffsetMs = 0; firebaseState.hasEverConnectedToDatabase = true;
                for (const [key, root] of [['dbRefHistory', H], ['dbRefDeleted', T], ['dbRefDailyRevenue', D], ['dbRefMonthlyRevenue', M],
                    ['dbRefDailyPickup', 'zoew_daily_pickup_cod_dod'], ['dbRefDailyCollected', 'zoew_daily_collected_cod_dod']]) {
                    (firebaseState as any)[key] = memory.sdk.ref(memory.db, root);
                }
                for (const [key, root] of [['scanHistory', H], ['deletedItems', T], ['dailyRevenueData', D], ['monthlyRevenueData', M]]) {
                    memory.sdk.onValue(memory.sdk.ref(memory.db, root), (snapshot: any) => {
                        const value = snapshot.val() || {};
                        (dataState as any)[key] = key === 'scanHistory' || key === 'deletedItems'
                            ? Object.entries(value).map(([id, row]: any) => ({ ...row, id })) : value;
                    });
                }
                for (let i = 0; i < 100 && dataState.scanHistory.length !== 1; i++) await new Promise(resolve => setTimeout(resolve, 1));
                expect(dataState.scanHistory).toHaveLength(1);
                uiState.notifyFeed = []; uiState.notifySellerFeed = []; uiState.notifySeenIds = []; uiState.notifyView = null;
                uiState.notifyFeedFetchedAt = NOW;
                mount(<NotifyDrawer />);
                step(() => openNotifyDrawer());
                step(() => (document.getElementById('notifyExpiryHead') as HTMLButtonElement).click());
                expect(document.querySelectorAll('#notifyExpiryList .notify-expiry-row')).toHaveLength(1);
                expect(document.getElementById('notifyExpiryList')!.textContent).toContain('0960007345');
                expect(document.getElementById('notifyExpirySummary')!.textContent).toContain('ស្កេនត្រឡប់');
                step(() => closeSideDrawer());
                fn.resetCachesForTests();
                const accountCallsBeforePreview = world.sbCalls;
                await runZtoListSyncPreview();
                const result: any = ztoState.ztoListSyncResult;
                expect(result?.returnedState).toBe('ok');
                expect(result.returned.map((row: any) => row.barcode)).toContain(CODE);
                if (backend === 'supabase') expect(world.sbCalls - accountCallsBeforePreview).toBeGreaterThan(0);
                expect(ztoReturnedTargets(result.returned, [item]).map(row => row.codes)).toEqual([[CODE]]);
                expect(ztoReturnedTargets(result.returned, [item], [CODE])).toEqual([]);
                for (let i = 0; i < 200 && (!memory.get(T + '/' + item.id)?.barcodes?.[0]?.isDeducted || cleanupInFlight.size); i++) await new Promise(resolve => setTimeout(resolve, 2));
                expect(memory.errors).toEqual([]);
                expect(memory.writes.length).toBeGreaterThan(0);
                expect(memory.get(H + '/' + item.id)).toBeNull();
                const trash = memory.get(T + '/' + item.id);
                expect(trash).toMatchObject({ trashReason: 'returned', count: 1, cod: 3.5, dod: 1 });
                expect(Object.values(trash.barcodes)).toMatchObject([{ code: CODE, cod: 3.5, dod: 1, isDeducted: true }]);
                expect(memory.get(D + '/2026-09-29')).toMatchObject({ codDollar: 0, dodDollar: 0, totalCount: 0 });
                expect(memory.get(M + '/2026-09')).toMatchObject({ codDollar: 0, dodDollar: 0, totalCount: 0 });
                step(() => openNotifyDrawer());
                step(() => (document.getElementById('notifyRemovedHead') as HTMLButtonElement).click());
                expect(document.querySelectorAll('#notifyRemovedList .notify-expiry-row')).toHaveLength(1);
                expect(document.getElementById('notifyRemovedList')!.textContent).toContain('0960007345');
                expect(uiState.notifyView!.packages).toBe(0);
                const near = { ...item, createdAt: NOW - ABANDON_AGE_MS + 5 * 3600000 - 1,
                    barcodes: [{ ...item.barcodes[0], createdAt: NOW - ABANDON_AGE_MS + 5 * 3600000 - 1 }] };
                dataState.scanHistory = [near];
                const notice = nearExpiryView(dataState.scanHistory, NOW, false);
                expect(notice.packages).toBe(1);
                expect(notice.rows[0].hoursLeft).toBe(5);
                expect(nearExpiryView([{ ...near, barcodes: [{ ...near.barcodes[0], isClosed: true }] }], NOW, false).packages).toBe(0);
                expect(nearExpiryView([near], NOW, true).measurable).toBe(false);
            });
        }
    }
});
