// M4 (deep audit 8): «កញ្ចប់យករួច» · «អតិថិជនយក» · the pickup rate come from the daily pickup listener. While that listener is
// pending or failed (offline boot · rules refused) the screens showed the stale view as a measured number (often 0), and
// «Reset ចំនួនយករួច» picked its days from that view ➜ «nothing to reset», or only some of the days. An unmeasurable pickup
// view shows «—» on the data page and the monthly report, and Reset waits until it is fresh.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataState, firebaseState, uiState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { getZoneDateKey } from '../src/core/timezone';
import { resetPickupStats } from '../src/domain/collected';
import { updateDailyScheduleStats } from '../src/features/daily-stats';
import { buildMonthlyReport, monthlyReportRows, renderMonthlyReport } from '../src/features/monthly-report';

const NOW = Date.UTC(2026, 9, 20, 5, 0, 0);
const TODAY = getZoneDateKey(NOW, 0);
const toasts: string[] = [];

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(NOW));
    firebaseState.serverClockTrusted = true;
    firebaseState.serverTimeOffsetMs = 0;
    dbListenerPendingPaths.clear();
    dbListenerFailedPaths.clear();
    dataState.scanHistory = [];
    dataState.deletedItems = [];
    dataState.dailyRevenueData = { [TODAY]: { codDollar: 10, dodDollar: 0, totalCount: 4 } } as any;
    dataState.monthlyRevenueData = {};
    dataState.dailyPickupData = { [TODAY]: { packagesPickedUp: 3, pickedUpPhones: { '012': 2, '015': 1 }, pickedUpBarcodes: { A1: '012', A2: '012', A3: '015' } } } as any;
    uiState.currentFilterMode = 'today';
    uiState.monthlyReportMonth = TODAY.slice(0, 7);
    toasts.length = 0;
    uiState.toasts = [];
    vi.stubGlobal('confirm', vi.fn(() => false));
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    dbListenerPendingPaths.clear();
    dbListenerFailedPaths.clear();
});

const toastText = () => JSON.stringify(uiState.toasts);

describe('M4 ៖ ចំនួនយករួច វាស់បានតែពេលទិដ្ឋភាព pickup ស្រស់', () => {
    it('data page summary ៖ stale pickup view ➜ «—» · fresh ➜ the numbers', () => {
        dbListenerPendingPaths.add('dailyPickup');
        updateDailyScheduleStats([], false);
        expect([viewState.dataSummary.todayClosedCount, viewState.dataSummary.todayPackagesPickedUpCount]).toEqual(['—', '—']);
        dbListenerPendingPaths.clear();
        updateDailyScheduleStats([], false);
        expect([viewState.dataSummary.todayClosedCount, viewState.dataSummary.todayPackagesPickedUpCount]).toEqual(['2', '3']);
    });

    it('monthly report ៖ stale pickup view ➜ picked · customers · rate «—» (screen and export) · fresh ➜ the numbers', () => {
        dbListenerFailedPaths.add('dailyPickup');
        renderMonthlyReport();
        const view: any = uiState.monthlyReportView;
        const tile = (label: string) => view.tiles.find((t: any) => t.label === label);
        expect([tile('កញ្ចប់យករួច').value, tile('កញ្ចប់យករួច').sub, tile('អតិថិជនយក').value]).toEqual(['—', 'អត្រាយក —', '—']);
        expect([view.rows[0].picked, view.rows[0].customers]).toEqual(['—', '—']);
        const rows = monthlyReportRows(buildMonthlyReport(TODAY.slice(0, 7)));
        expect(rows.map((r: any[]) => [r[7], r[8]])).toEqual([['—', '—'], ['—', '—']]);
        dbListenerFailedPaths.clear();
        renderMonthlyReport();
        const fresh: any = uiState.monthlyReportView;
        expect([fresh.rows[0].picked, fresh.rows[0].customers]).toEqual(['3', '2']);
    });

    it('Reset ៖ stale pickup view ➜ waits (no confirm · no write) · fresh ➜ asks', async () => {
        dbListenerPendingPaths.add('dailyPickup');
        await resetPickupStats();
        expect(confirm).not.toHaveBeenCalled();
        expect(toastText()).toContain('មិនទាន់ Sync');
        dbListenerPendingPaths.clear();
        await resetPickupStats();
        expect(confirm).toHaveBeenCalledTimes(1);
    });
});
