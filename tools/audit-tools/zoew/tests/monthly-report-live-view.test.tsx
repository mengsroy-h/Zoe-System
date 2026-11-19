import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { dataState, firebaseState, uiState } from '../../../../ZoeW/src/core/state';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../../../../ZoeW/src/core/text';
import { MonthlyReportBody } from '../../../../ZoeW/src/app/components/reports/MonthlyReportBody';
import { renderMonthlyReport } from '../../../../ZoeW/src/features/monthly-report';
import { clearDbListenerRecovery, handleDbListenerError, noteDbListenerAlive, initDatabaseListeners, detachDatabaseListeners, resetDbListenerHealthState } from '../../../../ZoeW/src/services/db-listeners';
import { mount, step, unmount } from './native/react-harness';

const day = '2026-11-18';
const body = () => document.body.textContent || '';
beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    dbListenerFailedPaths.clear(); dbListenerPendingPaths.clear();
    uiState.monthlyReportMonth = '2026-11';
    uiState.modalDisplay = { monthlyReportModal: 'flex' };
    dataState.dailyRevenueData = { [day]: { codDollar: 10, dodDollar: 2, totalCount: 1 } };
    dataState.monthlyRevenueData = { '2026-11': { codDollar: 10, dodDollar: 2, totalCount: 1 } };
    dataState.dailyPickupData = {};
    dataState.scanHistory = [];
    dataState.deletedItems = [];
    dataState.exchangeRateRiel = 4000;
    renderMonthlyReport();
    mount(<MonthlyReportBody />);
});
afterEach(() => { clearDbListenerRecovery(); vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); unmount(); dbListenerFailedPaths.clear(); dbListenerPendingPaths.clear(); });

it('ប្រាក់ប្រចាំថ្ងៃថ្មីបង្ហាញដោយមិនបើករបាយការណ៍ឡើងវិញ', () => {
    expect(body()).toContain('$12.00');
    step(() => { dataState.dailyRevenueData = { [day]: { codDollar: 25, dodDollar: 3, totalCount: 2 } }; });
    expect(body()).toContain('$28.00');
    expect(body()).not.toContain('$12.00');
});
it('ប្រវត្តិ និងធុងសំរាមផ្លាស់ប្ដូរប្រាក់មិនទាន់យក', () => {
    const row = { id: 'a', scanDate: day, barcodes: [{ code: 'A', cod: 4, dod: 1 }] };
    step(() => { dataState.scanHistory = [row]; });
    expect(body()).toContain('$7.00');
    step(() => { dataState.scanHistory = []; dataState.deletedItems = [row]; });
    expect(body()).toContain('$7.00');
    step(() => { dataState.deletedItems = []; });
    expect(body()).toContain('$12.00');
});
it('អត្រារៀល និង ledger ប្រចាំខែឆ្លុះបញ្ចាំងភ្លាម', () => {
    step(() => { dataState.exchangeRateRiel = 4100; dataState.monthlyRevenueData = { '2026-11': { codDollar: 50, dodDollar: 2, totalCount: 1 } }; });
    expect(body()).toContain('49,200');
    expect(body()).toContain('COD $50.00');
});
it('ខែដែលជ្រើសរើសថ្មីមិនបង្ហាញ projection របស់ខែចាស់', () => {
    step(() => { uiState.monthlyReportMonth = '2026-10'; });
    expect(body()).not.toContain('$12.00');
    expect(body()).toContain('គ្មានទិន្នន័យសម្រាប់ខែនេះទេ');
    step(() => { dataState.dailyRevenueData = { '2026-10-01': { codDollar: 8, dodDollar: 0, totalCount: 1 } }; });
    expect(body()).toContain('$8.00');
});
it('ទិន្នន័យអស់មិនរក្សាលេខចាស់', () => {
    step(() => { dataState.dailyRevenueData = {}; });
    expect(body()).not.toContain('$12.00');
    expect(body()).toContain('គ្មានទិន្នន័យសម្រាប់ខែនេះទេ');
});
it.each(['history', 'deleted', 'dailyRevenue'])('listener %s មិនវាស់បានលុបចំនួន collected ចាស់', (path) => {
    step(() => { dbListenerFailedPaths.add(path); firebaseState.touch(); });
    expect(document.querySelector('.money-collected b')?.textContent).toBe('—');
    step(() => { dbListenerFailedPaths.delete(path); firebaseState.touch(); });
    expect(document.querySelector('.money-collected b')?.textContent).toBe('$12.00');
});
it('pending listener រក្សា — រហូតទិន្នន័យមកវិញ', () => {
    step(() => { dbListenerPendingPaths.add('dailyRevenue'); firebaseState.touch(); });
    expect(document.querySelector('.money-collected b')?.textContent).toBe('—');
    step(() => { dbListenerPendingPaths.delete('dailyRevenue'); dataState.dailyRevenueData = { [day]: { codDollar: 20, dodDollar: 0, totalCount: 1 } }; });
    expect(document.querySelector('.money-collected b')?.textContent).toBe('$20.00');
});
it('បិទរបាយការណ៍មិនបង្ហាញទិន្នន័យ ហើយបើកវិញយកខែបច្ចុប្បន្ន', () => {
    step(() => { uiState.modalDisplay = { monthlyReportModal: 'none' }; });
    expect(body()).toBe('');
    step(() => { dataState.dailyRevenueData = { [day]: { codDollar: 30, dodDollar: 0, totalCount: 1 } }; });
    expect(body()).toBe('');
    step(() => { uiState.modalDisplay = { monthlyReportModal: 'flex' }; });
    expect(body()).toContain('$30.00');
});
it('ប្រតិបត្តិការមិនទាន់ច្បាស់រក្សា — តែក្នុងខែពាក់ព័ន្ធ', () => {
    step(() => { dataState.scanHistory = [{ id: 'pending', scanDate: day, scanPending: {} } as any]; });
    expect(document.querySelector('.money-collected b')?.textContent).toBe('—');
    step(() => { dataState.scanHistory = [{ id: 'pending', scanDate: '2026-10-01', scanPending: {} } as any]; });
    expect(document.querySelector('.money-collected b')?.textContent).toBe('$12.00');
});
it('ចំនួនយករួចថ្មី និងភាពមិនវាស់បានបង្ហាញភ្លាម', () => {
    step(() => { dataState.dailyPickupData = { [day]: { packagesPickedUp: 3, pickedUpBarcodes: { A: '012000001', B: '012000002', C: '012000002' }, pickedUpPhones: { '012000001': 1, '012000002': 2 } } }; });
    const cells = () => Array.from(document.querySelectorAll('tbody td')).map(el => el.textContent);
    expect(cells().slice(-2)).toEqual(['3', '2']);
    step(() => { dbListenerFailedPaths.add('dailyPickup'); firebaseState.touch(); });
    expect(cells().slice(-2)).toEqual(['—', '—']);
});
it('ការគូរឡើងវិញមិនកែប្រាក់ ប្រវត្តិ ឬ state projection', () => {
    const before = JSON.stringify([dataState.dailyRevenueData, dataState.monthlyRevenueData, dataState.dailyPickupData, dataState.scanHistory, dataState.deletedItems]);
    const versions = [dataState.version(), uiState.version(), firebaseState.version()];
    unmount(); mount(<MonthlyReportBody />);
    expect(JSON.stringify([dataState.dailyRevenueData, dataState.monthlyRevenueData, dataState.dailyPickupData, dataState.scanHistory, dataState.deletedItems])).toBe(before);
    expect([dataState.version(), uiState.version(), firebaseState.version()]).toEqual(versions);
});

it('listener បរាជ័យបន្តបន្ទាប់ និងសះស្បើយមួយផ្នែកបង្ហាញតាមភាពពិត', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    step(() => { handleDbListenerError(new Error('fixture'), 'dailyPickup'); });
    expect(document.querySelector('.money-collected b')?.textContent).toBe('$12.00');
    step(() => { uiState.toasts = []; uiState.notifyView = null; uiState.notifyRemovedView = null; });
    step(() => { handleDbListenerError(new Error('fixture'), 'history'); });
    expect(document.querySelector('.money-collected b')?.textContent).toBe('—');
    step(() => { noteDbListenerAlive('history'); });
    expect(document.querySelector('.money-collected b')?.textContent).toBe('$12.00');
    expect(dbListenerFailedPaths.has('dailyPickup')).toBe(true);
});

it('ចាប់ផ្ដើម listener ថ្មីបង្ហាញ — រហូត snapshot ថ្មី ហើយ reset មិនរក្សាតារាងចាស់', () => {
    const prior = { db: firebaseState.db, fb: firebaseState.fb, ref: firebaseState.dbRefDailyRevenue };
    let receive: (snapshot: { val: () => unknown }) => void = () => {};
    try {
        step(() => {
            firebaseState.db = {} as any;
            firebaseState.dbRefDailyRevenue = { key: 'dailyRevenue' } as any;
            firebaseState.fb = { off: () => {}, onValue: (_ref, callback) => { receive = callback; } } as any;
            initDatabaseListeners();
        });
        expect(document.querySelector('.money-collected b')?.textContent).toBe('—');
        step(() => { receive({ val: () => ({ [day]: { codDollar: 35, dodDollar: 0, totalCount: 1 } }) }); });
        expect(document.querySelector('.money-collected b')?.textContent).toBe('$35.00');
        step(() => {
            resetDbListenerHealthState(); detachDatabaseListeners();
            dataState.dailyRevenueData = {}; dataState.dailyPickupData = {}; dataState.scanHistory = []; dataState.deletedItems = [];
            uiState.monthlyReportMonth = '';
        });
        expect(body()).not.toContain('$35.00');
        expect(body()).toContain('គ្មានទិន្នន័យសម្រាប់ខែនេះទេ');
    } finally {
        step(() => { firebaseState.db = prior.db; firebaseState.fb = prior.fb; firebaseState.dbRefDailyRevenue = prior.ref; });
    }
});
