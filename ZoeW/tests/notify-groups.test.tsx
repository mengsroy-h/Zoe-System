/**
 * ⛔ សំណើម្ចាស់គម្រោង ៖ ផ្ទាំង 🔔 «📦 កញ្ចប់ជិតផុតកំណត់» និង «📤 កញ្ចប់ដែលដករួច» ជាក្រុមពន្លាដូច category ក្នុង ☰ ៖
 *    បិទជាលំនាំដើម · ក្បាលជាប៊ូតុង (`aria-expanded`) បង្ហាញចំនួនកញ្ចប់ · ចុចពន្លា ➜ បញ្ជីជាទំព័រ ២០ ហើយមើលបានគ្រប់ជួរ (គ្មានពិដាន ៦០) ·
 *    ចងចាំក្នុង `zoew_drawer_groups_v1` ដូច ☰ (ក្រុមនីមួយៗឯករាជ្យ · ☰ មិនប្រែ)។
 * ⛔ «ថ្មី» ក្នុង 📤 = អ្នកប្រើបានឃើញជួរពិត ៖ ក្រុមបិទ ➜ បិទផ្ទាំងមិនរាប់ថាបានមើល (badge នៅ) · ក្រុមពន្លា ➜ បិទផ្ទាំង ឬបិទក្រុម ➜ បានមើលគ្រប់ជួរ។
 * ⛔ «គ្មាន» ≠ «វាស់មិនបាន» ៖ ទិដ្ឋភាពមិនស្រស់ ➜ ក្បាលបង្ហាញ «—» មិនមែន «0»។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataState, firebaseState, uiState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import { DRAWER_GROUP_KEY } from '../src/core/storage-keys';
import { dbListenerFailedPaths, dbListenerPendingPaths, DB_LISTENER_KEY_HISTORY, VIEW_NOT_MEASURABLE_NOTICE } from '../src/core/text';
import { ABANDON_AGE_MS } from '../src/features/session';
import * as notifications from '../src/features/notifications';
import { NOTIFY_REMOVED_SEEN_KEY, openNotifyDrawer } from '../src/features/notifications';
import { closeSideDrawer, openSideDrawer } from '../src/ui/page-nav';
import { AppNavbar } from '../src/app/components/AppNavbar';
import { DrawerBackdrop } from '../src/app/components/DrawerBackdrop';
import { NotifyDrawer } from '../src/app/components/NotifyDrawer';
import { SideDrawer } from '../src/app/components/SideDrawer';
import { mount, step, unmount } from './native/react-harness';

const PAGE = 20;
const N_EXPIRY = 75;
const N_REMOVED = 70;

function openItem(i: number) {
    return { id: 'H' + i, phone: '0961' + String(100000 + i), createdAt: Date.now() - ABANDON_AGE_MS + (i + 1) * 60 * 1000, barcodes: [{ code: 'E' + i, isClosed: false }] };
}

function trashItem(i: number) {
    return { id: 'T' + i, phone: '0972' + String(100000 + i), deletedAt: Date.now() - (i + 1) * 60 * 1000, barcodes: [{ code: 'R' + i, locker: 'A-' + i }], trashReason: 'expired', isFromDeletion: false };
}

const head = (id: string) => document.getElementById(id) as HTMLButtonElement | null;
const list = (id: string) => document.getElementById(id);
const rowsOf = (id: string) => (list(id) ? list(id)!.querySelectorAll('.notify-expiry-row').length : 0);
const moreBtn = (sectionId: string) => document.querySelector('#' + sectionId + ' .notify-page-more-btn') as HTMLButtonElement | null;
const seenStored = () => JSON.parse(localStorage.getItem(NOTIFY_REMOVED_SEEN_KEY) || 'null');

function readAll(sectionId: string, listId: string) {
    for (let guard = 0; guard < 20 && moreBtn(sectionId); guard++) step(() => moreBtn(sectionId)!.click());
    return rowsOf(listId);
}

beforeEach(() => {
    dbListenerPendingPaths.clear();
    dbListenerFailedPaths.clear();
    try { localStorage.clear(); } catch {}
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({ items: [] }), { status: 200 }))));
    step(() => {
        uiState.notifyFeed = [];
        uiState.notifySellerFeed = [];
        uiState.notifySeenIds = [];
        uiState.notifyView = null;
        (uiState as any).notifyRemovedView = null;
        (uiState as any).notifyRemovedSeenIds = [];
        uiState.updateReady = false;
        uiState.notifyFeedFetchedAt = 0;
        uiState.notifyFeedInFlight = false;
        viewState.drawerGroupsOpen = [];
        dataState.scanHistory = Array.from({ length: N_EXPIRY }, (_, i) => openItem(i));
        dataState.deletedItems = Array.from({ length: N_REMOVED }, (_, i) => trashItem(i));
        firebaseState.isDatabaseInitialized = true;
    });
    mount(<><AppNavbar /><DrawerBackdrop /><SideDrawer /><NotifyDrawer /></>);
});

afterEach(() => {
    step(() => closeSideDrawer());
    unmount();
    document.body.innerHTML = '';
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('🔔 ក្រុមពន្លា ៖ កញ្ចប់ជិតផុតកំណត់ · កញ្ចប់ដែលដករួច', () => {
    it('ជាន់អប្បបរមា ៖ ទិន្នន័យពិតត្រូវវាស់ (៧៥ កញ្ចប់ជិតផុតកំណត់ · ៧០ កញ្ចប់ដករួច)', () => {
        step(() => openNotifyDrawer());
        expect(uiState.notifyView!.measurable).toBe(true);
        expect(uiState.notifyView!.packages).toBe(N_EXPIRY);
        expect((uiState as any).notifyRemovedView.packages).toBe(N_REMOVED);
        expect((uiState as any).notifyRemovedView.unseen).toBe(N_REMOVED);
    });

    it('⛔ លំនាំដើមបិទ ៖ ក្បាលជាប៊ូតុង aria-expanded=false បង្ហាញចំនួន · គ្មានជួរក្នុង DOM', () => {
        step(() => openNotifyDrawer());
        for (const [id, n, listId] of [['notifyExpiryHead', N_EXPIRY, 'notifyExpiryList'], ['notifyRemovedHead', N_REMOVED, 'notifyRemovedList']] as const) {
            const h = head(id);
            expect(h, id).not.toBe(null);
            expect(h!.tagName).toBe('BUTTON');
            expect(h!.getAttribute('aria-expanded')).toBe('false');
            expect(h!.querySelector('.notify-group-count')!.textContent).toBe(String(n));
            expect(list(listId)).toBe(null);
        }
        expect(head('notifyRemovedHead')!.querySelector('.notify-new-tag')).not.toBe(null);
    });

    it('⛔ ចុចពន្លា ➜ ២០ ជួរដំបូង · «បង្ហាញ … ទៀត» ➜ មើលបានគ្រប់ជួរ (គ្មានពិដាន ៦០ · គ្មាន «… និង N ជួរទៀត»)', () => {
        step(() => openNotifyDrawer());
        step(() => head('notifyExpiryHead')!.click());
        expect(head('notifyExpiryHead')!.getAttribute('aria-expanded')).toBe('true');
        expect(rowsOf('notifyExpiryList')).toBe(PAGE);
        expect(moreBtn('notifyExpirySection')!.textContent).toContain(String(N_EXPIRY - PAGE));
        expect(readAll('notifyExpirySection', 'notifyExpiryList')).toBe(N_EXPIRY);
        expect(document.querySelector('#notifyExpirySection .notify-more')).toBe(null);
        expect(list('notifyRemovedList')).toBe(null);
        step(() => head('notifyRemovedHead')!.click());
        expect(rowsOf('notifyRemovedList')).toBe(PAGE);
        expect(readAll('notifyRemovedSection', 'notifyRemovedList')).toBe(N_REMOVED);
        expect(list('notifyRemovedList')!.textContent).toContain('0972100069');
        expect(list('notifyExpiryList')!.textContent).toContain('0961100074');
    });

    it('⛔ ចងចាំដូច ☰ ៖ zoew_drawer_groups_v1 · ក្រុមនីមួយៗឯករាជ្យ · បើកផ្ទាំងម្តងទៀត (ក្រោយ reload) នៅពន្លា · ☰ មិនប្រែ', () => {
        localStorage.setItem(DRAWER_GROUP_KEY, 'drawerGroupLock');
        step(() => openNotifyDrawer());
        step(() => head('notifyExpiryHead')!.click());
        const keys = () => String(localStorage.getItem(DRAWER_GROUP_KEY) || '').split(',').filter(Boolean);
        expect(keys().sort()).toEqual(['drawerGroupLock', 'notifyGroupExpiry']);
        expect(head('notifyRemovedHead')!.getAttribute('aria-expanded')).toBe('false');
        step(() => closeSideDrawer());
        step(() => { viewState.drawerGroupsOpen = []; });
        step(() => openNotifyDrawer());
        expect(head('notifyExpiryHead')!.getAttribute('aria-expanded')).toBe('true');
        expect(rowsOf('notifyExpiryList')).toBe(PAGE);
        step(() => openSideDrawer());
        expect(document.getElementById('drawerGroupLock')!.className).toContain('is-open');
        step(() => openNotifyDrawer());
        step(() => head('notifyExpiryHead')!.click());
        expect(keys()).toEqual(['drawerGroupLock']);
        expect(list('notifyExpiryList')).toBe(null);
    });

    it('⛔ «ថ្មី» ក្នុង 📤 ៖ ក្រុមបិទ ➜ បិទផ្ទាំងមិនរាប់ថាបានមើល · ពន្លា ➜ បិទផ្ទាំង ➜ បានមើលគ្រប់ជួរ (លើស ៦០)', () => {
        step(() => { dataState.scanHistory = []; });
        step(() => openNotifyDrawer());
        step(() => closeSideDrawer());
        expect(seenStored()).toBe(null);
        expect((uiState as any).notifyRemovedView.unseen).toBe(N_REMOVED);
        expect(document.getElementById('navNotifyBadge')!.textContent).toBe(String(N_REMOVED));
        step(() => openNotifyDrawer());
        step(() => head('notifyRemovedHead')!.click());
        expect(list('notifyRemovedList')!.querySelector('.notify-new-tag')).not.toBe(null);
        step(() => closeSideDrawer());
        expect(seenStored()).toHaveLength(N_REMOVED);
        expect((uiState as any).notifyRemovedView.unseen).toBe(0);
        expect(document.getElementById('navNotifyBadge')).toBe(null);
    });

    it('⛔ បិទក្រុម 📤 ខណៈកំពុងមើល ➜ បានមើល · ☰ បើកពីលើ 🔔 ពេលក្រុមពន្លា ➜ បានមើល', () => {
        step(() => openNotifyDrawer());
        step(() => head('notifyRemovedHead')!.click());
        step(() => head('notifyRemovedHead')!.click());
        expect(seenStored()).toHaveLength(N_REMOVED);
        expect((uiState as any).notifyRemovedView.unseen).toBe(0);
        step(() => { dataState.deletedItems = dataState.deletedItems.concat([trashItem(500)]); });
        step(() => head('notifyRemovedHead')!.click());
        step(() => notifications.refreshNotifyRemovedView());
        expect((uiState as any).notifyRemovedView.unseen).toBe(1);
        step(() => openSideDrawer());
        expect(seenStored()).toContain('T500');
        expect((uiState as any).notifyRemovedView.unseen).toBe(0);
    });

    it('ទិសផ្ទុយ ៖ ទិដ្ឋភាពប្រវត្តិមិនស្រស់ ➜ ក្បាល «—» មិនមែន «0» · ពន្លា ➜ «វាស់មិនបាន»', () => {
        dbListenerPendingPaths.add(DB_LISTENER_KEY_HISTORY);
        step(() => openNotifyDrawer());
        expect(head('notifyExpiryHead')!.querySelector('.notify-group-count')!.textContent).toBe('—');
        step(() => head('notifyExpiryHead')!.click());
        expect(document.getElementById('notifyExpirySummary')!.textContent).toBe(VIEW_NOT_MEASURABLE_NOTICE);
        expect(list('notifyExpiryList')).toBe(null);
    });

    it('ទិសផ្ទុយ ៖ គ្មានកញ្ចប់ ➜ ក្បាល «0» · ពន្លា ➜ «គ្មាន…» · ក្បាល 📤 គ្មានស្លាក «ថ្មី»', () => {
        step(() => { dataState.scanHistory = []; dataState.deletedItems = []; });
        step(() => openNotifyDrawer());
        expect(head('notifyExpiryHead')!.querySelector('.notify-group-count')!.textContent).toBe('0');
        expect(head('notifyRemovedHead')!.querySelector('.notify-group-count')!.textContent).toBe('0');
        expect(head('notifyRemovedHead')!.querySelector('.notify-new-tag')).toBe(null);
        step(() => head('notifyRemovedHead')!.click());
        expect(document.getElementById('notifyRemovedSummary')!.textContent).toBe(notifications.NOTIFY_EMPTY_REMOVED_TEXT);
    });
});
