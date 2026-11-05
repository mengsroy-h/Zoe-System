import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ prints: [] as any[] }));
vi.mock('../src/platform/file-output', async (original) => ({
    ...(await original<Record<string, unknown>>()),
    printCurrentView: () => { h.prints.push(JSON.parse(JSON.stringify(uiState.pdfExportView))); }
}));

import { dataState, firebaseState, uiState } from '../src/core/state';
import { DB_LISTENER_KEY_DAILY_PICKUP, DB_LISTENER_KEY_DAILY_REVENUE, DB_LISTENER_KEY_DELETED, DB_LISTENER_KEY_HISTORY, dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { buildMonthlyReport, monthlyReportRows, renderMonthlyReport } from '../src/features/monthly-report';
import { restoreAfterPdfExport } from '../src/features/export';
import { MonthlyReportModal } from '../src/app/components/modals/MonthlyReportModal';
import { mount, step, unmount } from './native/react-harness';

const DAY = '2026-10-30';

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.UTC(2026, 9, 30, 9));
    firebaseState.serverClockTrusted = true;
    firebaseState.serverTimeOffsetMs = 0;
    dbListenerFailedPaths.clear();
    dbListenerPendingPaths.clear();
    uiState.monthlyReportMonth = '2026-10';
    uiState.pdfExportOriginalTitle = null;
    uiState.pdfExportView = null;
    uiState.modalDisplay = {};
    uiState.modalStack = [];
    uiState.isModalOpen = false;
    dataState.scanHistory = [{ id: 'closed', phone: '012000001', scanDate: DAY, barcodes: [{ code: 'OUTPUT1', cod: 5, dod: 2, isClosed: true }] }];
    dataState.deletedItems = [];
    dataState.dailyRevenueData = { [DAY]: { codDollar: 5, dodDollar: 2, totalCount: 1 } };
    dataState.monthlyRevenueData = { '2026-10': { codDollar: 5, dodDollar: 2, totalCount: 1 } };
    dataState.dailyPickupData = { [DAY]: { packagesPickedUp: 1, pickedUpBarcodes: { OUTPUT1: '012000001' }, pickedUpPhones: { '012000001': 1 } } };
    dataState.exchangeRateRiel = 4100;
    h.prints.length = 0;
    mount(<MonthlyReportModal />);
    step(() => { uiState.modalDisplay.monthlyReportModal = 'flex'; });
});

afterEach(() => {
    step(() => restoreAfterPdfExport());
    unmount();
    vi.useRealTimers();
    dbListenerFailedPaths.clear();
    dbListenerPendingPaths.clear();
});

function clickPdf() {
    const button = Array.from(document.querySelectorAll<HTMLButtonElement>('#monthlyReportModal button')).find((b) => b.textContent?.includes('PDF'))!;
    expect(button.disabled).toBe(false);
    step(() => button.click());
    expect(h.prints).toHaveLength(1);
    return h.prints[0];
}

it('PDF · screen · Excel បង្ហាញចំនួន និងប្រាក់ដែលវាស់បានដូចគ្នា', () => {
    const report = buildMonthlyReport('2026-10');
    expect(report.totals.pickupMeasurable).toBe(true);
    expect(report.totals.collectedMeasurable).toBe(true);
    expect(monthlyReportRows(report)[0]).toEqual([DAY, 1, 5, 2, 7, 0, 7, 1, 1]);
    step(() => renderMonthlyReport());
    expect(uiState.monthlyReportView.rows[0].picked).toBe('1');
    const view = clickPdf();
    expect(view.rows[0]).toEqual([DAY, '1', '$5.00', '$2.00', '$7.00', '$0.00', '7.00', '1', '1']);
    expect(view.totalRow.cells.slice(1)).toEqual(view.rows[0].slice(1));
});

it.each(['pending', 'failed'])('pickup %s រក្សា — ក្នុង PDF រាល់ថ្ងៃ និងសរុប ដូច screen/Excel', (kind) => {
    (kind === 'pending' ? dbListenerPendingPaths : dbListenerFailedPaths).add(DB_LISTENER_KEY_DAILY_PICKUP);
    const report = buildMonthlyReport('2026-10');
    expect(report.totals.pickupMeasurable).toBe(false);
    expect(monthlyReportRows(report).map((r) => r.slice(-2))).toEqual([['—', '—'], ['—', '—']]);
    step(() => renderMonthlyReport());
    expect([uiState.monthlyReportView.rows[0].picked, uiState.monthlyReportView.rows[0].customers]).toEqual(['—', '—']);
    const view = clickPdf();
    expect.soft(view.rows[0].slice(-2)).toEqual(['—', '—']);
    expect.soft(view.totalRow.cells.slice(-2)).toEqual(['—', '—']);
    expect(view.rows[0].slice(2, 7)).toEqual(['$5.00', '$2.00', '$7.00', '$0.00', '7.00']);
});

it.each([DB_LISTENER_KEY_HISTORY, DB_LISTENER_KEY_DELETED, DB_LISTENER_KEY_DAILY_REVENUE].flatMap((path) => ['pending', 'failed'].map((kind) => ({ path, kind }))))('money $path $kind រក្សា — ដោយមិនបាត់ចំនួនដែលវាស់បាន', ({ path, kind }) => {
    (kind === 'pending' ? dbListenerPendingPaths : dbListenerFailedPaths).add(path);
    const report = buildMonthlyReport('2026-10');
    expect(report.totals.collectedMeasurable).toBe(false);
    expect(monthlyReportRows(report)[0].slice(2, 6)).toEqual(['—', '—', '—', '—']);
    const view = clickPdf();
    expect(view.rows[0].slice(2, 6)).toEqual(['—', '—', '—', '—']);
    expect(view.totalRow.cells.slice(2, 6)).toEqual(['—', '—', '—', '—']);
    expect(view.rows[0].slice(-3)).toEqual(['7.00', '1', '1']);
    expect(view.footer).toContain('ចំណូលសរុប (យករួច) —');
    expect(view.footer).toContain('តម្លៃកញ្ចប់ទាំងអស់ $7.00');
});
