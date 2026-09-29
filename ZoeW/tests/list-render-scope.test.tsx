/**
 * ⛔ បញ្ជីធំៗ ត្រូវគូរឡើងវិញ **តែពេលទិន្នន័យរបស់វាប្រែ** — មិនមែនរាល់ពេល `uiState` ណាមួយប្រែ ឬពេលឪពុកគូរឡើងវិញ។
 *
 * ហេតុអ្វីតេស្តនេះមាន ៖ តារាងប្រវត្តិ **គ្មានពិដាន** (filter «ទាំងអស់» = ជួរដេករាប់ពាន់)។ `uiState` ប្រែរាល់
 * ការហូតប្រអប់ប្រវត្តិ · ការបើកម៉ឺនុយ (...) · ការបើកប្រអប់ (ធុងសំរាម) · ការលាក់របា Tab ខណៈរមូរ — ហើយវាលទាំងនោះ
 * commit **ភ្លាម** (`markImmediate`) ➜ បើតារាង subscribe `uiState` ទាំងមូល ឬគូរតាមឪពុក (`PageData` ប្រែរាល់ការហូត)
 * ជួរដេកទាំងអស់ត្រូវគូរឡើងវិញ **ខាងក្នុងផ្លូវចលនាផ្ទាល់**។ ម្ចាស់គម្រោងវាស់លើទូរស័ព្ទ ៖ «ឈរលើ filter ទាំងអស់
 * មានបញ្ជីជួរដេកច្រើន ចលនាហូតប្រអប់ប្រវត្តិ អាក់ៗ និងបើកធុងសំរាមក៏ដូច glitch»។
 * ⛔ ការរាប់ ៖ ធាតុទិន្នន័យមាន getter លើ `phone` ➜ រាល់ការគូរ body អាន `phone` ➜ ការរាប់មិនពឹងលើ Profiler/React
 *    internals ហើយ mount **ឪពុកពិត** (`PageData` · `PageEntry` · `RecentlyDeletedModal`) ➜ ការគូរតាមឪពុកក៏ត្រូវរាប់។
 * ⛔ `memo` លើ `HistoryRow` ត្រូវដើរពិត ៖ Firebase ផ្តល់ object ថ្មីរាល់ snapshot ➜ ការប្រៀបត្រូវជា **តម្លៃ** មិនមែនអត្តសញ្ញាណ។
 * ⛔ ទិសផ្ទុយ (សំខាន់ដូចគ្នា) ៖ ការប្រែពិតត្រូវលេចលើអេក្រង់ ៖ ធាតុកែនៅនឹងកន្លែង + `renderHistory()` · ធាតុថ្មី ·
 *    អត្រាប្តូរ · listener ធ្លាក់ពេលបញ្ជីទទេ · បញ្ជីស្កេន/Locker/ធុងសំរាមថ្មី។
 */
import { memo } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const rowRenders = vi.hoisted(() => ({ n: 0 }));

vi.mock('../src/core/action-registry', () => ({
    ACTION_REGISTRY: {},
    ACTION_NAMES: [],
    lookupAction: () => () => {}
}));

vi.mock('../src/app/components/history/HistoryRow', async (importOriginal) => {
    const mod: any = await importOriginal();
    const original = mod.HistoryRow;
    const counted = memo(function CountedHistoryRow(props: any) {
        rowRenders.n++;
        return original.type(props);
    }, original.compare);
    return { ...mod, HistoryRow: counted };
});

import { PageData } from '../src/app/components/PageData';
import { PageEntry } from '../src/app/components/PageEntry';
import { RecentlyDeletedModal } from '../src/app/components/modals/RecentlyDeletedModal';
import { dataState, firebaseState, uiState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import { DB_LISTENER_KEY_HISTORY, VIEW_NOT_MEASURABLE_NOTICE, dbListenerFailedPaths } from '../src/core/text';
import { renderHistory } from '../src/ui/history-render';
import { mount, step, unmount } from './native/react-harness';

type ListId = 'history' | 'entry' | 'locker' | 'trash';
const BODY_ID: Record<ListId, string> = {
    history: 'historyTableBody',
    entry: 'entryListTableBody',
    locker: 'lockerListTableBody',
    trash: 'deletedTableBody'
};
const reads: Record<ListId, number> = { history: 0, entry: 0, locker: 0, trash: 0 };

function counted<T extends object>(list: ListId, row: T, phone: string): T {
    Object.defineProperty(row, 'phone', { enumerable: true, configurable: true, get() { reads[list]++; return phone; } });
    return row;
}

const N = 60;

function makeRows(n: number) {
    return Array.from({ length: n }, (_, i) => counted('history', {
        id: 'row-' + i,
        cod: 5, dod: 1, count: 2, isClosed: false, isCalled: false,
        createdAt: Date.now() - 3600000,
        time: '09:00:0' + (i % 10) + ' (2026-09-2' + (i % 10) + ')',
        barcodes: [
            { code: 'ZT' + (100000 + i * 10), cod: 3, dod: 1, locker: 'A' + (i % 9), isClosed: false, isDeducted: false },
            { code: 'ZT' + (100001 + i * 10), cod: 2, dod: 0, locker: 'A' + (i % 9), isClosed: false, isDeducted: false }
        ]
    } as any, '0' + String(10000000 + i * 7919).slice(0, 9)));
}

function entryView(phone = '012000111') {
    return [counted('entry', { n: 1, time: 't', codeText: 'ZT9', total: '5.00' } as any, phone)];
}

function lockerView(locker = 'B7') {
    return { rows: [counted('locker', { n: 1, lockerText: locker } as any, '012000222')], overflow: 0 };
}

function trashView(label: string) {
    return {
        empty: null,
        overflow: 0,
        rows: [counted('trash', {
            key: 'k1', metaLabel: label, metaCls: 'trash-tag-delete', whenText: 'ឥឡូវ',
            codes: ['TR1'], moreCodes: 0, count: 1, total: 5, riel: 20500, singleId: 't1', expanded: false,
            itemCount: 1, subRows: []
        } as any, '012345678')]
    };
}

function mountPages() {
    dataState.exchangeRateRiel = 4100;
    mount(<><PageData /><PageEntry /><RecentlyDeletedModal /></>);
}

function snapshot() {
    return { rows: rowRenders.n, ...reads };
}

function text(id: ListId): string {
    const el = document.getElementById(BODY_ID[id]);
    if (!el) throw new Error('#' + BODY_ID[id] + ' មិនត្រូវ React គូរ');
    return el.textContent || '';
}

afterEach(() => {
    unmount();
    dbListenerFailedPaths.clear();
    firebaseState.dbListenersFailed = false;
    uiState.historyView = null;
    uiState.entryListView = null;
    uiState.lockerListView = null;
    uiState.trashView = null;
    uiState.dataPanelCollapsed = false;
    uiState.entryPanelCollapsed = false;
    uiState.historyExpanded = false;
    uiState.currentAppPage = 'data';
});

describe('បញ្ជីធំៗ ៖ ការប្រែ uiState / ឪពុកគូរឡើងវិញ មិនគូរជួរដេកឡើងវិញ', () => {
    it('ហូតប្រអប់ · ម៉ឺនុយ (...) · ប្រអប់ · របា Tab · ប្តូរទំព័រ · ចំណងជើងឪពុក ➜ ០ ការគូរលើបញ្ជីទាំង ៤', () => {
        mountPages();
        step(() => {
            renderHistory(makeRows(N));
            uiState.entryListView = entryView();
            uiState.lockerListView = lockerView();
            uiState.trashView = trashView('លុប');
        });
        expect(document.querySelectorAll('#historyTableBody tr').length).toBe(N);
        expect(rowRenders.n).toBeGreaterThanOrEqual(N);
        expect(reads.history).toBeGreaterThanOrEqual(N);
        expect(reads.entry).toBeGreaterThan(0);
        expect(reads.locker).toBeGreaterThan(0);
        expect(reads.trash).toBeGreaterThan(0);

        const unrelated: Array<[string, () => void]> = [
            ['chromeHidden ✓', () => { uiState.chromeHidden = true; }],
            ['chromeHidden ✗', () => { uiState.chromeHidden = false; }],
            ['panelGliding ✓', () => { uiState.panelGliding = true; }],
            ['dataPanelCollapsed ✓ (PageData គូរឡើងវិញ)', () => { uiState.dataPanelCollapsed = true; }],
            ['historyExpanded ✓', () => { uiState.historyExpanded = true; }],
            ['panelGliding ✗', () => { uiState.panelGliding = false; }],
            ['dataPanelCollapsed ✗', () => { uiState.dataPanelCollapsed = false; uiState.historyExpanded = false; }],
            ['dataPanelSearchFocus ✓', () => { uiState.dataPanelSearchFocus = true; }],
            ['entryPanelCollapsed ✓ (PageEntry គូរឡើងវិញ)', () => { uiState.entryPanelCollapsed = true; }],
            ['moreMenuOpen ✓ + touch()', () => { uiState.moreMenuOpen = true; uiState.touch(); }],
            ['moreMenuOpen ✗', () => { uiState.moreMenuOpen = false; }],
            ['ប្រអប់បើក', () => { uiState.isModalOpen = true; uiState.modalDisplay = { recentlyDeletedModal: 'flex' }; }],
            ['ប្រអប់បិទ', () => { uiState.isModalOpen = false; uiState.modalDisplay = { recentlyDeletedModal: 'none' }; }],
            ['ចំណងជើង/ចំនួនក្នុងឪពុក', () => { viewState.selectedFilterTitle = 'ទាំងអស់'; viewState.entryListCountText = '9'; }],
            ['ប្តូរទំព័រ', () => { uiState.currentAppPage = 'entry'; }],
            ['ត្រឡប់ទំព័រ', () => { uiState.currentAppPage = 'data'; }]
        ];
        for (const [label, change] of unrelated) {
            const before = snapshot();
            step(change);
            expect({ label, ...snapshot() }).toEqual({ label, ...before });
        }
    });

    it('បើកធុងសំរាម (trashView ថ្មី + ប្រអប់បើក) ➜ តែធុងសំរាមគូរ · តារាងប្រវត្តិ ០', () => {
        mountPages();
        step(() => { renderHistory(makeRows(N)); });
        const before = snapshot();
        step(() => {
            uiState.trashView = trashView('ដក');
            uiState.isModalOpen = true;
            uiState.modalDisplay = { recentlyDeletedModal: 'flex' };
        });
        const after = snapshot();
        expect(after.rows).toBe(before.rows);
        expect(after.history).toBe(before.history);
        expect(after.trash).toBeGreaterThan(before.trash);
        expect(text('trash')).toContain('ដក');
    });
});

describe('ទិសផ្ទុយ ៖ ការប្រែពិតត្រូវលេចលើអេក្រង់', () => {
    it('Firebase snapshot ថ្មី (object ថ្មី តម្លៃដដែល) ➜ ០ ជួរដេកគូរឡើងវិញ', () => {
        mountPages();
        const rows = makeRows(N);
        step(() => { renderHistory(rows); });
        const before = rowRenders.n;
        step(() => { renderHistory(JSON.parse(JSON.stringify(rows))); });
        expect(rowRenders.n - before).toBe(0);
        expect(document.querySelectorAll('#historyTableBody tr').length).toBe(N);
    });

    it('ធាតុមួយប្រែ (object ថ្មី) ➜ គូរតែជួរដេកនោះ ហើយអេក្រង់បង្ហាញលេខថ្មី', () => {
        mountPages();
        const rows = makeRows(N);
        step(() => { renderHistory(rows); });
        const before = rowRenders.n;
        const next = rows.slice();
        next[7] = { ...rows[7], phone: '099111222' };
        step(() => { renderHistory(next); });
        expect(rowRenders.n - before).toBe(1);
        expect(text('history')).toContain('099111222');
    });

    it('ធាតុកែនៅនឹងកន្លែង (array ដដែល) + renderHistory() ➜ អេក្រង់ប្រែ', () => {
        mountPages();
        const rows = makeRows(N);
        step(() => { renderHistory(rows); });
        const before = rowRenders.n;
        step(() => {
            counted('history', rows[3], '088333444');
            rows[3].barcodes[0].isClosed = true;
            renderHistory(rows);
        });
        expect(rowRenders.n - before).toBe(1);
        expect(text('history')).toContain('088333444');
    });

    it('អត្រាប្តូរប្រែ ➜ គ្រប់ជួរដេកគូរឡើងវិញ ហើយលេខរៀលថ្មីលេច', () => {
        mountPages();
        step(() => { renderHistory(makeRows(N)); });
        const before = rowRenders.n;
        step(() => { dataState.exchangeRateRiel = 4200; });
        expect(rowRenders.n - before).toBe(N);
        expect(text('history')).toContain((5 * 4200).toLocaleString());
    });

    it('បញ្ជីទទេ ➜ listener ប្រវត្តិធ្លាក់ ➜ សារប្តូរទៅ «វាស់មិនបាន» (មិនមែន «គ្មានទិន្នន័យ»)', () => {
        mountPages();
        step(() => { renderHistory([]); });
        expect(text('history')).toContain('គ្មានទិន្នន័យ');
        step(() => {
            dbListenerFailedPaths.add(DB_LISTENER_KEY_HISTORY);
            firebaseState.dbListenersFailed = true;
        });
        expect(text('history')).toContain(VIEW_NOT_MEASURABLE_NOTICE);
    });

    it('បញ្ជីស្កេន · Locker · ធុងសំរាមថ្មី ➜ លេចលើអេក្រង់', () => {
        mountPages();
        step(() => {
            uiState.entryListView = entryView('012000111');
            uiState.lockerListView = lockerView('B7');
            uiState.trashView = trashView('ផុតកំណត់');
        });
        expect(text('entry')).toContain('012000111');
        expect(text('locker')).toContain('B7');
        expect(text('trash')).toContain('ផុតកំណត់');
        step(() => {
            uiState.entryListView = entryView('012000999');
            uiState.lockerListView = lockerView('C3');
        });
        expect(text('entry')).toContain('012000999');
        expect(text('locker')).toContain('C3');
    });
});
