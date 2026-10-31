import { beforeEach, expect, it } from 'vitest';
import { dataState, uiState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { buildExportRows, collectedValueIsMeasurable, uncollectedItemValue, uncollectedValueByDate } from '../src/features/export';
import { updateDailyScheduleStats } from '../src/features/daily-stats';
import { MONTHLY_REPORT_UNKNOWN } from '../src/features/monthly-report';

function item() {
    return { id: 'row1', scanDate: '2026-10-24', phone: '012345678', cod: 15, dod: 0, price: 15, count: 2,
        barcodes: [{ code: 'COMMITTED', createdAt: 100, cod: 10, dod: 0, isClosed: true, closedAt: 110 },
            { code: 'PENDING', scanIntent: 'scan_' + 'a'.repeat(32), createdAt: 200, cod: 5, dod: 0, isClosed: false }],
        scanPending: { intent: 'scan_' + 'a'.repeat(32), actorUid: 'user', code: 'PENDING', birth: 200, slot: '1', payloadHash: 'b'.repeat(64) } };
}

beforeEach(() => {
    dataState.scanHistory = [item()]; dataState.deletedItems = [];
    uiState.currentFilterMode = 'all'; dbListenerFailedPaths.clear(); dbListenerPendingPaths.clear();
});

it('export រក្សាតែ barcode committed នៅ row merge មិនបង្ហាញ provisional ជាប្រាក់រួចរាល់', () => {
    const original = JSON.stringify(dataState.scanHistory);
    expect(buildExportRows().map(row => [row.barcode, row.cod])).toEqual([['COMMITTED', 10]]);
    expect(JSON.stringify(dataState.scanHistory)).toBe(original);
});

it('uncollected មិនដក provisional ពី ledger ដែលមិនទាន់បូក', () => {
    expect(uncollectedItemValue(dataState.scanHistory[0])).toEqual({ cod: 0, dod: 0 });
    expect(uncollectedValueByDate()).toEqual({});
    expect(collectedValueIsMeasurable()).toBe(true);
});

it('pending marker ខូច ត្រូវមិនអាចវាស់បាន និងបដិសេធ export មិនបម្លែងទៅសូន្យ', () => {
    dataState.scanHistory[0].scanPending.slot = '9';
    expect(collectedValueIsMeasurable()).toBe(false);
    expect(() => buildExportRows()).toThrow();
});

it('គ្មាន marker មិនដក barcode committed ចេញពី export ឬប្រាក់នៅសល់', () => {
    delete dataState.scanHistory[0].scanPending;
    expect(buildExportRows().map(row => row.barcode)).toEqual(['COMMITTED', 'PENDING']);
    expect(uncollectedItemValue(dataState.scanHistory[0])).toEqual({ cod: 5, dod: 0 });
    expect(collectedValueIsMeasurable()).toBe(true);
});

it('ស្ថិតិ search គិតតែ committed barcode នៅ row merge', () => {
    updateDailyScheduleStats(dataState.scanHistory, true);
    expect(viewState.dataSummary.todayTotalCount).toBe('1');
    expect(viewState.dataSummary.grandTotalCount).toBe('0');
    expect(viewState.dataSummary.summaryCodDollar).toBe('$0.00');
});

it('ស្ថិតិ search មាន marker ខូច បង្ហាញមិនអាចវាស់ មិនមែនសូន្យ', () => {
    dataState.scanHistory[0].scanPending.slot = '9';
    updateDailyScheduleStats(dataState.scanHistory, true);
    expect(viewState.dataSummary.todayTotalCount).toBe(MONTHLY_REPORT_UNKNOWN);
    expect(viewState.dataSummary.summaryCodDollar).toBe(MONTHLY_REPORT_UNKNOWN);
});
