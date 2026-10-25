import { beforeEach, describe, expect, it } from 'vitest';
import { dataState, uiState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import { updateDailyScheduleStats } from '../src/features/daily-stats';

const mixed = () => ({ id: 'mixed', phone: '010000001', isClosed: false, barcodes: [
    { code: 'TEST000001', cod: 5, dod: 0, isClosed: true },
    { code: 'TEST000002', cod: 2, dod: 1, isClosed: false }
] });
const counts = () => [viewState.dataSummary.todayPackagesPickedUpCount, viewState.dataSummary.todayClosedCount];
beforeEach(() => {
    dataState.dailyPickupData = {};
    dataState.dailyRevenueData = {};
    dataState.exchangeRateRiel = 4100;
    uiState.currentFilterMode = 'custom';
    uiState.customFilterDate = '2026-10-24';
});

describe('ចំនួនយករួចក្នុងជួរដែលមានកញ្ចប់បិទ និងបើក', () => {
    it.each([true, false])('ស្វែងរក=%s៖ រាប់តាម barcode មិនមែនទង់ជួរ', (search) => {
        updateDailyScheduleStats([mixed()], search);
        expect(counts()).toEqual(['1', '1']);
        expect(viewState.dataSummary.grandTotalCount).toBe('1');
        expect(viewState.dataSummary.todayTotalCount).toBe('2');
        expect(viewState.dataSummary.summaryTotalDollar).toBe('$3.00');
    });
    it('លេខដូចគ្នារាប់ម្ចាស់តែម្តង ហើយគ្មានលេខរាប់ដាច់ដោយឡែក', () => {
        updateDailyScheduleStats([mixed(), { ...mixed(), id: 'other' },
            { ...mixed(), id: 'unnamed', phone: 'គ្មានលេខ' },
            { ...mixed(), id: 'unnamed2', phone: 'គ្មានលេខ' }], true);
        expect(counts()).toEqual(['4', '3']);
    });
    it('ជួរចាស់គ្មានបញ្ជី barcode រក្សាចំនួនដើម; បញ្ជីទទេមិនមានអ្នកយក', () => {
        updateDailyScheduleStats([
            { id: 'legacy', phone: '010000001', isClosed: true, count: 3 },
            { id: 'open', phone: '010000002', isClosed: false, count: 2 },
            { id: 'empty', phone: '010000003', isClosed: true, barcodes: [] }
        ], true);
        expect(counts()).toEqual(['3', '1']);
    });
    it('Reset ក្នុង ledger រក្សាសូន្យ ប៉ុន្តែការស្វែងរករាប់ barcode ដែលឃើញ', () => {
        dataState.dailyPickupData = { '2026-10-24': { packagesPickedUp: 0 } };
        updateDailyScheduleStats([mixed()], false);
        expect(counts()).toEqual(['0', '0']);
        updateDailyScheduleStats([mixed()], true);
        expect(counts()).toEqual(['1', '1']);
    });
    it('គ្រប់ថ្ងៃយកចំនួនពី ledger មិនគណនាឡើងវិញក្រោយ Reset', () => {
        uiState.currentFilterMode = 'all';
        dataState.dailyPickupData = { '2026-10-24': { packagesPickedUp: 0 } };
        updateDailyScheduleStats([mixed()], false);
        expect(counts()).toEqual(['0', '0']);
    });
});
