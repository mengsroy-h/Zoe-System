/**
 * 🗑️ ម្ចាស់គម្រោង ៖ «ក្នុងធុងសំរាមពេលចុច កន្លែង ដក+ត្រឡប់ អោយlistបង្ហាញតែកញ្ចប់ ដកនិងត្រឡប់»។
 *
 * ⛔ ការធានា ៖ ចុចកាត «➖ ដក + ត្រឡប់» ➜ បញ្ជីគូរតែក្រុម `remove` និង `returned` (`TRASH_REASON_META[r].deducted`) ·
 *    ចុចម្តងទៀត ➜ ទាំងអស់ · កាត «✅ យករួច + លុប» ធ្វើដូចគ្នាសម្រាប់ប្រភេទរបស់វា · កាតទាំង ២ នៅបង្ហាញតួលេខពេញ (មិនប្តូរតាមតម្រង) ·
 *    បន្ទាត់ «សរុប» = តែក្រុមដែលបង្ហាញ · ការស្វែងរកនៅធ្វើការជាមួយតម្រង · បិទប្រអប់ ឬចាកចេញ ➜ តម្រងបាត់ ·
 *    តម្រងជាការបង្ហាញតែប៉ុណ្ណោះ ➜ ប៊ូតុងស្តារ/លុបនៅសំដៅ id ពិត និងគ្មានការសរសេរ Firebase។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const actions = vi.hoisted(() => ({ table: {} as Record<string, any> }));

vi.mock('../src/core/action-registry', () => ({
    ACTION_REGISTRY: actions.table,
    ACTION_NAMES: [],
    lookupAction: (name: string) => actions.table[name] || null
}));

import { RecentlyDeletedModal } from '../src/app/components/modals/RecentlyDeletedModal';
import { dataState, uiState } from '../src/core/state';
import { setFieldValue } from '../src/app/refs';
import { TRASH_REASON_META, closeRecentlyDeletedModal, filterRecentlyDeleted, openRecentlyDeletedModal, showMoreTrashRows,
    toggleTrashReasonFilter } from '../src/features/trash';
import { ACTION_ALLOWLIST } from '../src/core/runtime';
import { mount, step, unmount } from './native/react-harness';

class FakeIo { observe() {} disconnect() {} }

const REASONS = ['remove', 'returned', 'pickup', 'delete'];

function trashItems(n: number) {
    const out = [];
    for (let i = 0; i < n; i++) {
        const reason = REASONS[i % REASONS.length];
        const removed = reason === 'remove' || reason === 'returned';
        out.push({ id: 'd' + i, phone: '0' + String(10000000 + i), cod: 2, dod: 1, count: 1, trashReason: reason,
            isFromDeletion: !removed, isClosed: reason === 'pickup', deletedAt: 1000 + i, scanDate: '2026-09-29', time: '09:00:00 (2026-09-29)',
            barcodes: [{ code: 'TR' + i, cod: 2, dod: 1.25, isClosed: reason === 'pickup', isDeducted: removed }] });
    }
    return out;
}

actions.table.toggleTrashReasonFilter = toggleTrashReasonFilter;
actions.table.showMoreTrashRows = showMoreTrashRows;

const card = (cls: string) => document.querySelector('#trashSummaryBox .' + cls) as HTMLButtonElement;
const tags = () => Array.from(document.querySelectorAll('#deletedTableBody .trash-group-row .trash-tag')).map((el) => el.textContent);
const totalLine = () => (document.querySelector('#trashSummaryBox .trash-sum-total') as HTMLElement).textContent || '';
const cardMoney = (cls: string) => (card(cls).querySelector('.trash-sum-money') as HTMLElement).textContent;

beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', FakeIo);
    uiState.deletedSearchQuery = '';
    uiState.trashReasonFilter = '';
    dataState.exchangeRateRiel = 4000;
});

afterEach(() => {
    unmount();
    vi.unstubAllGlobals();
    dataState.deletedItems = [];
    uiState.trashView = null;
    uiState.trashSummary = null;
    uiState.trashReasonFilter = '';
});

describe('🗑️ ធុងសំរាម ៖ ចុចកាតប្រភេទ ➜ បញ្ជីតែប្រភេទនោះ', () => {
    it('ចុច «➖ ដក + ត្រឡប់» ➜ តែ «ដក» និង «ត្រឡប់» · ចុចម្តងទៀត ➜ ទាំងអស់', () => {
        dataState.deletedItems = trashItems(8);
        mount(<RecentlyDeletedModal />);
        step(() => { openRecentlyDeletedModal(); });
        expect(new Set(tags()), 'លក្ខខណ្ឌ ៖ មុនចុច បញ្ជីមានគ្រប់ប្រភេទ').toEqual(new Set(['ដក', 'ត្រឡប់', 'យករួច', 'លុប']));
        const deducted = card('trash-sum-deducted');
        expect(deducted.tagName).toBe('BUTTON');
        expect(deducted.getAttribute('aria-pressed')).toBe('false');
        const before = { ded: cardMoney('trash-sum-deducted'), kept: cardMoney('trash-sum-kept') };

        step(() => { deducted.click(); });
        expect(uiState.trashReasonFilter).toBe('deducted');
        const shown = tags();
        expect(shown.length).toBe(4);
        expect(new Set(shown)).toEqual(new Set(['ដក', 'ត្រឡប់']));
        const labels = Object.values(TRASH_REASON_META).filter((m: any) => m.deducted).map((m: any) => m.label);
        expect(shown.every((t) => labels.indexOf(t as string) !== -1), 'ប្រភេទមកពី `TRASH_REASON_META[r].deducted`').toBe(true);
        expect(card('trash-sum-deducted').getAttribute('aria-pressed')).toBe('true');
        expect(card('trash-sum-deducted').className).toContain('trash-sum-active');
        expect({ ded: cardMoney('trash-sum-deducted'), kept: cardMoney('trash-sum-kept') }, 'កាតទាំង ២ នៅតួលេខពេញ').toEqual(before);
        expect(totalLine()).toContain('បង្ហាញតែ ➖ ដក + ត្រឡប់');
        expect(totalLine()).toContain('សរុប ' + before.ded);
        expect(totalLine()).toContain('📦 4 កញ្ចប់ · 4 ជួរ');

        step(() => { card('trash-sum-deducted').click(); });
        expect(uiState.trashReasonFilter).toBe('');
        expect(tags().length).toBe(8);
        expect(card('trash-sum-deducted').getAttribute('aria-pressed')).toBe('false');
        expect(totalLine()).toContain('ធុងសំរាមទាំងមូល');
    });

    it('កាត «✅ យករួច + លុប» ➜ តែ «យករួច» និង «លុប» · ចុចកាតមួយទៀត ➜ ប្តូរប្រភេទ', () => {
        dataState.deletedItems = trashItems(8);
        mount(<RecentlyDeletedModal />);
        step(() => { openRecentlyDeletedModal(); });
        step(() => { card('trash-sum-kept').click(); });
        expect(new Set(tags())).toEqual(new Set(['យករួច', 'លុប']));
        step(() => { card('trash-sum-deducted').click(); });
        expect(new Set(tags())).toEqual(new Set(['ដក', 'ត្រឡប់']));
    });

    it('ការស្វែងរក + តម្រង ៖ ទាំង ២ អនុវត្ត · រកឃើញតែប្រភេទផ្សេង ➜ សារប្រាប់តម្រង', () => {
        dataState.deletedItems = trashItems(8);
        mount(<RecentlyDeletedModal />);
        step(() => { openRecentlyDeletedModal(); });
        step(() => { card('trash-sum-deducted').click(); });
        step(() => { setFieldValue('deletedSearchInput', 'TR0'); filterRecentlyDeleted(); });
        expect(tags()).toEqual(['ដក']);
        expect(uiState.trashReasonFilter, 'ការស្វែងរករក្សាតម្រង').toBe('deducted');
        step(() => { setFieldValue('deletedSearchInput', 'TR3'); filterRecentlyDeleted(); });
        expect(tags()).toEqual([]);
        expect(document.querySelector('#deletedTableBody')!.textContent).toContain('រកមិនឃើញ');
        step(() => { setFieldValue('deletedSearchInput', 'TR1'); filterRecentlyDeleted(); });
        expect(tags()).toEqual(['ត្រឡប់']);
    });

    it('គ្មានកញ្ចប់ប្រភេទនោះ ➜ សារ «គ្មានកញ្ចប់ «ដក» ឬ «ត្រឡប់»» · បិទប្រអប់ ➜ តម្រងបាត់', () => {
        dataState.deletedItems = trashItems(8).filter((item) => item.trashReason === 'pickup' || item.trashReason === 'delete');
        mount(<RecentlyDeletedModal />);
        step(() => { openRecentlyDeletedModal(); });
        step(() => { card('trash-sum-deducted').click(); });
        expect(tags()).toEqual([]);
        expect(document.querySelector('#deletedTableBody')!.textContent).toContain('គ្មានកញ្ចប់ «ដក» ឬ «ត្រឡប់»');
        step(() => { closeRecentlyDeletedModal(); });
        expect(uiState.trashReasonFilter).toBe('');
        step(() => { openRecentlyDeletedModal(); });
        expect(tags().length).toBe(4);
    });

    it('តម្រងជាការបង្ហាញ ៖ ប៊ូតុងស្តារ/លុបនៅសំដៅ id ពិត · ការប្តូរតម្រងត្រឡប់ទៅទំព័រដំបូង · តម្លៃមិនស្គាល់ ➜ ទាំងអស់', () => {
        dataState.deletedItems = trashItems(120);
        mount(<RecentlyDeletedModal />);
        step(() => { openRecentlyDeletedModal(); });
        step(() => { showMoreTrashRows(); });
        expect(uiState.trashRenderLimit).toBe(40);
        step(() => { card('trash-sum-deducted').click(); });
        expect(uiState.trashRenderLimit).toBe(20);
        expect(tags().length).toBe(20);
        const ids = (uiState.trashView.rows as any[]).map((row) => row.singleId);
        expect(ids.every((id) => dataState.deletedItems.some((item: any) => item.id === id && (item.trashReason === 'remove' || item.trashReason === 'returned')))).toBe(true);
        step(() => { toggleTrashReasonFilter('nonsense'); });
        expect(uiState.trashReasonFilter).toBe('');
        expect(new Set(tags()).size).toBe(4);
    });

    it('សកម្មភាពស្គាល់ក្នុង ACTION_ALLOWLIST (CSP)', () => {
        expect(ACTION_ALLOWLIST).toContain('toggleTrashReasonFilter');
    });
});
