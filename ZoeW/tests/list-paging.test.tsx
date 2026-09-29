/**
 * ⛔ ការបើកប្រអប់បញ្ជីធំៗ ត្រូវគូរតែ **ទំព័រដំបូង** (២០) ហើយទាញបន្ថែមពេលរមូរជិតចុង (IntersectionObserver) ឬចុចប៊ូតុង។
 *
 * ហេតុអ្វី ៖ ម្ចាស់គម្រោងរាយការណ៍ «បើក modal បញ្ជី ZTO និងធុងសំរាម អាក់អាក់» (filter «ទាំងអស់»)។ វាស់បាន (Chromium · CPU ×4 ·
 * ធុងសំរាម ៣០០ · ប្រវត្តិ ៥០០) ៖ ការបើកធុងសំរាមគូរ ២០០ ក្រុមក្នុងមួយដង ➜ Layout ~៦៥០ ms (dirty 6481) · ស៊ុមកក ៨០០–៩៣០ ms
 * ➜ ទំព័រ ២០ ➜ ស៊ុមកក ២៦៧–៣០០ ms។ តំបន់មើលឃើញរបស់ប្រអប់មានតែ ~៦ ក្រុម។
 * ⛔ ទិសផ្ទុយ (សំខាន់ដូចគ្នា) ៖ ការគូរជាទំព័រ **មិនប្តូរទិន្នន័យ** — តួលេខសរុប និងការស្វែងរកគណនាលើធាតុ **ទាំងអស់** ·
 *    ពិដាន `DELETED_LIST_MAX_ROWS` (២០០) និងសារ «… ជួរទៀត» នៅដដែល · ការស្វែងរក/បើកម្តងទៀត ➜ ត្រឡប់ទៅទំព័រដំបូង ·
 *    បញ្ជី ZTO មិនបាត់ barcode ណា (ស្កេនចូល ZTO Palm បានគ្រប់លេខតាមការរមូរ)។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const actions = vi.hoisted(() => ({ table: {} as Record<string, any> }));

vi.mock('../src/core/action-registry', () => ({
    ACTION_REGISTRY: actions.table,
    ACTION_NAMES: [],
    lookupAction: (name: string) => actions.table[name] || null
}));

import { RecentlyDeletedModal } from '../src/app/components/modals/RecentlyDeletedModal';
import { ZtoSyncList, ZTO_SYNC_PAGE_ROWS } from '../src/app/components/zto/ZtoSyncList';
import { dataState, uiState, ztoState } from '../src/core/state';
import { DELETED_LIST_MAX_ROWS } from '../src/features/locker';
import { TRASH_PAGE_ROWS, filterRecentlyDeleted, openRecentlyDeletedModal, showMoreTrashRows } from '../src/features/trash';
import { mount, step, unmount } from './native/react-harness';

type IoCb = (entries: Array<{ isIntersecting: boolean }>) => void;
const observers: IoCb[] = [];
class FakeIo {
    cb: IoCb;
    constructor(cb: IoCb) { this.cb = cb; observers.push(cb); }
    observe() {}
    disconnect() { const i = observers.indexOf(this.cb); if (i !== -1) observers.splice(i, 1); }
}

function trashItems(n: number) {
    const out = [];
    for (let i = 0; i < n; i++) {
        out.push({ id: 'd' + i, phone: '0' + String(10000000 + i), cod: 2, dod: 1, count: 1, trashReason: i % 2 ? 'remove' : 'delete',
            isDeducted: i % 2 === 1, isFromDeletion: i % 2 === 0, deletedAt: 1000 + i, scanDate: '2026-09-29', time: '09:00:00 (2026-09-29)',
            barcodes: [{ code: 'TR' + i, cod: 2, dod: 1, isClosed: false, isDeducted: i % 2 === 1 }] });
    }
    return out;
}

actions.table.showMoreTrashRows = showMoreTrashRows;

const groupRows = () => document.querySelectorAll('#deletedTableBody .trash-group-row').length;

beforeEach(() => {
    observers.length = 0;
    vi.stubGlobal('IntersectionObserver', FakeIo);
    uiState.deletedSearchQuery = '';
});

afterEach(() => {
    unmount();
    vi.unstubAllGlobals();
    dataState.deletedItems = [];
    uiState.trashView = null;
    ztoState.ztoSyncListView = null;
});

describe('ធុងសំរាម ៖ គូរជាទំព័រ', () => {
    it('បើក ➜ ២០ ក្រុម + ជួរ «បង្ហាញទៀត» · ចុច ➜ +២០ · sentinel មើលឃើញ ➜ +២០', () => {
        dataState.deletedItems = trashItems(60);
        mount(<RecentlyDeletedModal />);
        step(() => { openRecentlyDeletedModal(); });
        expect(groupRows()).toBe(TRASH_PAGE_ROWS);
        expect(document.querySelector('.trash-more-btn')!.textContent).toContain(String(60 - TRASH_PAGE_ROWS));
        step(() => { (document.querySelector('.trash-more-btn') as HTMLButtonElement).click(); });
        expect(groupRows()).toBe(2 * TRASH_PAGE_ROWS);
        expect(observers.length).toBe(1);
        step(() => { observers[0]([{ isIntersecting: true }]); });
        expect(groupRows()).toBe(60);
        expect(document.querySelector('.trash-more-btn')).toBeNull();
    });

    it('ទិសផ្ទុយ ៖ តួលេខសរុបគណនាលើធាតុទាំងអស់ មិនមែនតែទំព័រដែលគូរ', () => {
        dataState.deletedItems = trashItems(60);
        mount(<RecentlyDeletedModal />);
        step(() => { openRecentlyDeletedModal(); });
        const text = document.getElementById('trashSummaryBox')!.textContent || '';
        expect(text).toContain('30');
        expect(text).toContain('90.00');
    });

    it('ស្វែងរក ឬបើកម្តងទៀត ➜ ត្រឡប់ទៅទំព័រដំបូង · ការស្វែងរករកឃើញធាតុក្រៅទំព័រ', () => {
        dataState.deletedItems = trashItems(60);
        mount(<RecentlyDeletedModal />);
        step(() => { openRecentlyDeletedModal(); showMoreTrashRows(); });
        expect(groupRows()).toBe(2 * TRASH_PAGE_ROWS);
        step(() => { openRecentlyDeletedModal(); });
        expect(groupRows()).toBe(TRASH_PAGE_ROWS);
        step(() => { showMoreTrashRows(); });
        expect(groupRows()).toBe(2 * TRASH_PAGE_ROWS);
        step(() => {
            (document.getElementById('deletedSearchInput') as HTMLInputElement).value = 'TR';
            filterRecentlyDeleted();
        });
        expect(groupRows()).toBe(TRASH_PAGE_ROWS);
        step(() => {
            (document.getElementById('deletedSearchInput') as HTMLInputElement).value = 'TR59';
            filterRecentlyDeleted();
        });
        expect(groupRows()).toBe(1);
        expect(document.getElementById('deletedTableBody')!.textContent).toContain('TR59');
    });

    it('ពិដាន ២០០ និងសារ «… ជួរទៀត» នៅដដែល ទោះចុចទាញបន្ថែមលើសពិដាន', () => {
        dataState.deletedItems = trashItems(DELETED_LIST_MAX_ROWS + 30);
        mount(<RecentlyDeletedModal />);
        step(() => { openRecentlyDeletedModal(); });
        for (let i = 0; i < 20; i++) step(() => { showMoreTrashRows(); });
        expect(groupRows()).toBe(DELETED_LIST_MAX_ROWS);
        expect(document.querySelector('.trash-more-btn')).toBeNull();
        expect(document.getElementById('deletedTableBody')!.textContent).toContain('និងមាន 30 ជួរទៀត');
    });
});

describe('បញ្ជី ZTO មិនទាន់បិទ ៖ គូរជាទំព័រ', () => {
    function entries(n: number) {
        return Array.from({ length: n }, (_, i) => ({ code: String(780000000000 + i), phone: '012' + String(i).padStart(6, '0'), locker: 'A' + (i % 5) }));
    }

    it('២០ ដំបូង · ចុច/sentinel ➜ បន្ថែម · គ្រប់ barcode ទៅដល់ (គ្មានបាត់)', () => {
        ztoState.ztoSyncListView = { empty: null, entries: entries(45) };
        mount(<div className="zto-sync-list" id="ztoSyncList"><ZtoSyncList /></div>);
        const items = () => Array.from(document.querySelectorAll('#ztoSyncList .zto-sync-item'));
        expect(items()).toHaveLength(ZTO_SYNC_PAGE_ROWS);
        expect(document.querySelectorAll('#ztoSyncList .zto-sync-bc').length).toBe(ZTO_SYNC_PAGE_ROWS);
        step(() => { (document.querySelector('.zto-sync-more-btn') as HTMLButtonElement).click(); });
        expect(items()).toHaveLength(2 * ZTO_SYNC_PAGE_ROWS);
        step(() => { observers[observers.length - 1]([{ isIntersecting: true }]); });
        expect(items()).toHaveLength(45);
        const codes = items().map((el) => el.querySelector('.zto-sync-code')!.textContent);
        expect(new Set(codes).size).toBe(45);
        expect(document.querySelector('.zto-sync-more-btn')).toBeNull();
    });

    it('បញ្ជីតូច ➜ គ្មានប៊ូតុង «បង្ហាញទៀត»', () => {
        ztoState.ztoSyncListView = { empty: null, entries: entries(5) };
        mount(<div className="zto-sync-list" id="ztoSyncList"><ZtoSyncList /></div>);
        expect(document.querySelectorAll('#ztoSyncList .zto-sync-item')).toHaveLength(5);
        expect(document.querySelector('.zto-sync-more-btn')).toBeNull();
    });
});
