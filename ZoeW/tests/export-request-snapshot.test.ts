import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { saves, toasts } = vi.hoisted(() => ({ saves: vi.fn(), toasts: vi.fn() }));
vi.mock('../src/platform/file-output', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()), saveWorkbook: saves
}));
vi.mock('../src/ui/toast', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()), showToast: toasts
}));

import { dataState, uiState } from '../src/core/state';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { exportDataAsExcel, getExportFilenameBase, loadedScriptPromises } from '../src/features/export';
import { exportMonthlyReportAsExcel, monthlyReportFilenameBase } from '../src/features/monthly-report';

const xlsx = createRequire(import.meta.url)('../public/vendor/xlsx.full.min.js');
const scriptPromises = loadedScriptPromises as Record<string, Promise<void>>;
const months = ['2026-08', '2026-09'];
const dates = months.map((month) => month + '-15');
const deferred = () => {
    let resolve!: () => void;
    let reject!: (reason: Error) => void;
    const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
};

const flows = [
    {
        name: 'ប្រវត្តិកញ្ចប់',
        select: (index: number) => { uiState.currentFilterMode = 'custom'; uiState.customFilterDate = dates[index]; },
        run: exportDataAsExcel,
        filename: () => getExportFilenameBase() + '.xlsx',
        identity: (workbook: any) => workbook.Sheets[workbook.SheetNames[0]].C2.v,
        expected: (index: number) => 'PARCEL-' + index,
        clear: () => { dataState.scanHistory = []; }
    },
    {
        name: 'របាយការណ៍ប្រចាំខែ',
        select: (index: number) => { uiState.monthlyReportMonth = months[index]; },
        run: exportMonthlyReportAsExcel,
        filename: () => monthlyReportFilenameBase() + '.xlsx',
        identity: (workbook: any) => workbook.Sheets[workbook.SheetNames[0]].A2.v,
        expected: (index: number) => dates[index],
        clear: () => { dataState.dailyRevenueData = {}; dataState.dailyPickupData = {}; dataState.monthlyRevenueData = {}; }
    }
];

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-23T03:00:00Z'));
    vi.stubGlobal('XLSX', xlsx);
    saves.mockReset();
    toasts.mockReset();
    delete scriptPromises.xlsx;
    dbListenerPendingPaths.clear();
    dbListenerFailedPaths.clear();
    dataState.scanHistory = dates.map((scanDate, index) => ({
        id: 'parcel-' + index, phone: '012345678', scanDate, isClosed: true,
        barcodes: [{ code: 'PARCEL-' + index, cod: 10 + index, dod: 2, isClosed: true }]
    }));
    dataState.deletedItems = [];
    dataState.dailyRevenueData = Object.fromEntries(dates.map((date, index) => [date, { codDollar: 10 + index, dodDollar: 2, totalCount: 1 }]));
    dataState.dailyPickupData = {};
    dataState.monthlyRevenueData = {};
    uiState.modalDisplay = {};
    uiState.modalStack = [];
    uiState.isModalOpen = false;
});

afterEach(() => {
    delete scriptPromises.xlsx;
    dataState.scanHistory = [];
    dataState.dailyRevenueData = {};
    uiState.monthlyReportMonth = '';
    uiState.currentFilterMode = 'today';
    uiState.customFilterDate = '';
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

for (const flow of flows) {
    describe('Excel ' + flow.name + ' ៖ ឈ្មោះឯកសារតាមសំណើដែលបានចុច', () => {
        it('ផ្ទុកភ្លាម ➜ ឈ្មោះ និងទិន្នន័យត្រូវគ្នា', async () => {
            scriptPromises.xlsx = Promise.resolve();
            flow.select(0);
            const filename = flow.filename();
            await flow.run();
            expect(saves).toHaveBeenCalledTimes(1);
            expect(saves.mock.calls[0][1]).toBe(filename);
            expect(flow.identity(saves.mock.calls[0][0])).toBe(flow.expected(0));
        });

        it('ផ្ទុកយឺត ហើយប្តូរតម្រង ➜ ឈ្មោះនៅជាមួយទិន្នន័យដើម', async () => {
            const pending = deferred();
            scriptPromises.xlsx = pending.promise;
            flow.select(0);
            const filename = flow.filename();
            const saving = flow.run();
            expect(saves).not.toHaveBeenCalled();
            flow.select(1);
            expect(flow.filename()).not.toBe(filename);
            pending.resolve();
            await saving;
            expect(saves).toHaveBeenCalledTimes(1);
            expect(flow.identity(saves.mock.calls[0][0])).toBe(flow.expected(0));
            expect(saves.mock.calls[0][1]).toBe(filename);
        });

        it('សំណើពីរចាំឯកសារតែមួយ ➜ ទិន្នន័យ និងឈ្មោះមិនឆ្លងគ្នា', async () => {
            const pending = deferred();
            scriptPromises.xlsx = pending.promise;
            flow.select(0);
            const firstName = flow.filename();
            const first = flow.run();
            flow.select(1);
            const secondName = flow.filename();
            const second = flow.run();
            expect(saves).not.toHaveBeenCalled();
            pending.resolve();
            await Promise.all([first, second]);
            expect(saves).toHaveBeenCalledTimes(2);
            expect(saves.mock.calls.map(([workbook, filename]) => [flow.identity(workbook), filename])).toEqual([
                [flow.expected(0), firstName], [flow.expected(1), secondName]
            ]);
        });

        it('ផ្ទុកបរាជ័យ ➜ មិនបង្កើតឯកសារ ហើយប្រាប់កំហុស', async () => {
            const pending = deferred();
            scriptPromises.xlsx = pending.promise;
            flow.select(0);
            const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
            const saving = flow.run();
            pending.reject(Object.assign(new Error('timeout'), { code: 'SCRIPT_LOAD_TIMEOUT' }));
            await saving;
            expect(saves).not.toHaveBeenCalled();
            expect(toasts.mock.calls.some(([message]) => String(message).startsWith('❌'))).toBe(true);
            expect(errors).toHaveBeenCalledTimes(1);
        });

        it('ទិន្នន័យទទេ ➜ មិនផ្ទុក Excel និងមិនបង្កើតឯកសារ', async () => {
            flow.select(0);
            flow.clear();
            await flow.run();
            expect(scriptPromises.xlsx).toBeUndefined();
            expect(saves).not.toHaveBeenCalled();
            expect(toasts).toHaveBeenCalledTimes(1);
        });
    });
}
