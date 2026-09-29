/**
 * ⛔ តារាងប្រវត្តិគូរតែ **៥០ ជួរដំបូង** (ថ្មីបំផុតនៅលើ) ហើយទាញ ៥០ ទៀតពេលរមូរជិតចុង (IntersectionObserver លើ `.table-responsive`
 *    ជាមួយ rootMargin ទាញមុន) ឬចុចប៊ូតុង។
 *
 * ហេតុអ្វី ៖ ម្ចាស់គម្រោងរាយការណ៍ «APK នៅតែអាក់ពេលឈរលើ filter ទាំងអស់» ហើយស្នើ ៖ «អោយបង្ហាញ ៥០ ជួរ ហើយពេលរមូរជិតដល់ចុងក្រោយ
 * ចាំបន្ថែមចូលទៀត»។ filter «ទាំងអស់» = ជួរដេករាប់ពាន់ ➜ ការគូរ/ការវាស់ layout លើ DOM ទាំងមូល។
 * ⛔ ទិសផ្ទុយ (សំខាន់ដូចគ្នា) ៖ ការគូរជាទំព័រ **មិនប្តូរទិន្នន័យ** — ចំនួនសរុបលើក្បាលតារាងរាប់ធាតុ **ទាំងអស់** · ការ sync ពី
 *    Firebase (filter ដដែល) **មិនរុញអ្នកប្រើត្រឡប់ទៅ ៥០** ពេលគេរមូរចុះរួច · ការប្តូរ filter/ការស្វែងរក ➜ ត្រឡប់ទៅទំព័រដំបូង ·
 *    បញ្ជី ≤ ៥០ ➜ គ្មានជួរ «បង្ហាញទៀត» · ការទាញបន្ថែមនៅចុងបញ្ជីមិនកើនពិដានឥតឈប់។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const actions = vi.hoisted(() => ({ table: {} as Record<string, any> }));

vi.mock('../src/core/action-registry', () => ({
    ACTION_REGISTRY: actions.table,
    ACTION_NAMES: [],
    lookupAction: (name: string) => actions.table[name] || null
}));

import { MemoHistoryTableBody } from '../src/app/components/history/HistoryTableBody';
import { dataState, uiState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import { HISTORY_PAGE_ROWS, historyRenderCap, renderHistory, showMoreHistoryRows } from '../src/ui/history-render';
import { applyCurrentFilter } from '../src/features/monthly-report';
import { mount, step, unmount } from './native/react-harness';

type IoCb = (entries: Array<{ isIntersecting: boolean }>) => void;
const observers: Array<{ cb: IoCb; opts: any }> = [];
class FakeIo {
    cb: IoCb;
    constructor(cb: IoCb, opts: any) { this.cb = cb; observers.push({ cb, opts }); }
    observe() {}
    disconnect() { const i = observers.findIndex((o) => o.cb === this.cb); if (i !== -1) observers.splice(i, 1); }
}

actions.table.showMoreHistoryRows = showMoreHistoryRows;

function makeRows(n: number) {
    return Array.from({ length: n }, (_, i) => ({
        id: 'row-' + i,
        phone: '0' + String(10000000 + i),
        cod: 5, dod: 1, count: 1, isClosed: false, isCalled: false,
        createdAt: Date.now() - 3600000,
        time: '09:00:00 (2026-09-29)',
        barcodes: [{ code: 'ZT' + (100000 + i), cod: 5, dod: 1, isClosed: false, isDeducted: false }]
    }));
}

const dataRows = () => [...document.querySelectorAll('#historyTableBody tr[data-id]')].map((tr) => (tr as HTMLElement).dataset.id);
const moreBtn = () => document.querySelector('#historyTableBody .history-more-btn') as HTMLButtonElement | null;

function mountTable() {
    dataState.exchangeRateRiel = 4100;
    mount(
        <div className="table-responsive" id="tableResponsive">
            <table><tbody id="historyTableBody"><MemoHistoryTableBody /></tbody></table>
        </div>
    );
}

beforeEach(() => {
    observers.length = 0;
    vi.stubGlobal('IntersectionObserver', FakeIo);
    uiState.historyViewKey = '';
    uiState.historyRenderLimit = HISTORY_PAGE_ROWS;
});

afterEach(() => {
    unmount();
    vi.unstubAllGlobals();
    uiState.historyView = null;
    uiState.historyViewKey = '';
    uiState.historyRenderLimit = HISTORY_PAGE_ROWS;
});

describe('តារាងប្រវត្តិ ៖ ៥០ ជួរដំបូង រួចទាញបន្ថែម', () => {
    it('១៣០ ធាតុ ➜ ៥០ ជួរថ្មីបំផុត + ជួរ «បង្ហាញទៀត» · ចុច ➜ ១០០ · sentinel មើលឃើញ ➜ ១៣០ · គ្មានជួរ «បង្ហាញទៀត» ទៀត', () => {
        const rows = makeRows(130);
        mountTable();
        step(() => { renderHistory(rows, 'filter|all|'); });
        const first = dataRows();
        expect(first.length).toBe(HISTORY_PAGE_ROWS);
        expect(first[0]).toBe('row-129');
        expect(first[HISTORY_PAGE_ROWS - 1]).toBe('row-80');
        expect(moreBtn()!.textContent).toContain('នៅសល់ 80');
        step(() => { moreBtn()!.click(); });
        expect(dataRows().length).toBe(2 * HISTORY_PAGE_ROWS);
        expect(observers.length).toBe(1);
        step(() => { observers[0].cb([{ isIntersecting: true }]); });
        expect(dataRows().length).toBe(130);
        expect(dataRows()[129]).toBe('row-0');
        expect(moreBtn()).toBeNull();
    });

    it('sentinel ទាញមុនពេលដល់ចុង ៖ root = កន្សោមរមូរ `.table-responsive` · rootMargin ខាងក្រោម > 0', () => {
        mountTable();
        step(() => { renderHistory(makeRows(120), 'filter|all|'); });
        expect(observers.length).toBe(1);
        expect(observers[0].opts.root).toBe(document.getElementById('tableResponsive'));
        expect(Number(String(observers[0].opts.rootMargin).split(' ')[2].replace('px', ''))).toBeGreaterThan(0);
        step(() => { observers[0].cb([{ isIntersecting: false }]); });
        expect(dataRows().length).toBe(HISTORY_PAGE_ROWS);
    });

    it('≤ ៥០ ធាតុ ➜ គូរទាំងអស់ · គ្មានជួរ «បង្ហាញទៀត» · គ្មាន observer', () => {
        mountTable();
        step(() => { renderHistory(makeRows(HISTORY_PAGE_ROWS), 'filter|today|'); });
        expect(dataRows().length).toBe(HISTORY_PAGE_ROWS);
        expect(moreBtn()).toBeNull();
        expect(observers.length).toBe(0);
    });
});

describe('ទិសផ្ទុយ ៖ ការគូរជាទំព័រមិនប្តូរទិន្នន័យ ឬរុញអ្នកប្រើត្រឡប់ក្រោយ', () => {
    it('ចំនួនសរុបលើក្បាលតារាង = ធាតុទាំងអស់ មិនមែន ៥០', () => {
        mountTable();
        step(() => { renderHistory(makeRows(130), 'filter|all|'); });
        expect(viewState.historyCountText).toBe('130');
    });

    it('sync ពី Firebase (filter ដដែល · ធាតុថ្មីមកដល់) ➜ មិនត្រឡប់ទៅ ៥០ វិញ', () => {
        mountTable();
        step(() => { renderHistory(makeRows(130), 'filter|all|'); });
        step(() => { moreBtn()!.click(); });
        expect(dataRows().length).toBe(100);
        step(() => { renderHistory(makeRows(131), 'filter|all|'); });
        expect(dataRows().length).toBe(100);
        expect(dataRows()[0]).toBe('row-130');
    });

    it('ប្តូរ filter ឬស្វែងរក ➜ ត្រឡប់ទៅទំព័រដំបូង', () => {
        mountTable();
        step(() => { renderHistory(makeRows(130), 'filter|all|'); });
        step(() => { moreBtn()!.click(); });
        step(() => { renderHistory(makeRows(130), 'filter|yesterday|'); });
        expect(dataRows().length).toBe(HISTORY_PAGE_ROWS);
        step(() => { moreBtn()!.click(); });
        step(() => { renderHistory(makeRows(130), 'search|0101'); });
        expect(dataRows().length).toBe(HISTORY_PAGE_ROWS);
    });

    it('ទាញបន្ថែមនៅចុងបញ្ជី ➜ ពិដានមិនកើនឥតឈប់ · តម្លៃខូច ➜ ៥០', () => {
        mountTable();
        step(() => { renderHistory(makeRows(70), 'filter|all|'); });
        step(() => { showMoreHistoryRows(); });
        const cap = historyRenderCap();
        step(() => { showMoreHistoryRows(); showMoreHistoryRows(); });
        expect(historyRenderCap()).toBe(cap);
        expect(dataRows().length).toBe(70);
        uiState.historyRenderLimit = NaN;
        expect(historyRenderCap()).toBe(HISTORY_PAGE_ROWS);
        uiState.historyRenderLimit = -5;
        expect(historyRenderCap()).toBe(HISTORY_PAGE_ROWS);
    });
});

describe('applyCurrentFilter ពិត ៖ កូនសោ view ដេរីវេពី filter', () => {
    it('filter ដដែលអនុវត្តម្តងទៀត (sync) ➜ រក្សាទំព័រ · ប្តូរ filter ➜ ត្រឡប់ទៅ ៥០', () => {
        dataState.scanHistory = makeRows(130) as any;
        mountTable();
        uiState.currentFilterMode = 'all';
        step(() => { applyCurrentFilter(); });
        expect(dataRows().length).toBe(HISTORY_PAGE_ROWS);
        step(() => { moreBtn()!.click(); });
        step(() => { applyCurrentFilter(); });
        expect(dataRows().length).toBe(2 * HISTORY_PAGE_ROWS);
        uiState.currentFilterMode = 'yesterday';
        step(() => { applyCurrentFilter(); });
        expect(historyRenderCap()).toBe(HISTORY_PAGE_ROWS);
        uiState.currentFilterMode = 'all';
        step(() => { applyCurrentFilter(); });
        expect(dataRows().length).toBe(HISTORY_PAGE_ROWS);
        dataState.scanHistory = [];
        uiState.currentFilterMode = 'today';
    });
});
