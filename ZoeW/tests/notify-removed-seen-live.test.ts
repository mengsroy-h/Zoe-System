// 📤 removed list: opening the group marks every live «ត្រឡប់» row as seen, however many rows live (seen ids of rows in
// the view are never dropped by the cap) · ids of rows the view hides for a while (a restore claim · another shop) stay
// seen while the cap has room, so a cancelled restore or a shop switched back never shows «ថ្មី» again.
import { beforeEach, describe, expect, it } from 'vitest';
import { dataState, firebaseState, uiState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import {
    NOTIFY_GROUP_REMOVED, NOTIFY_REMOVED_SEEN_MAX, markNotifyRemovedSeen, refreshNotifyRemovedView
} from '../src/features/notifications';

function trashItem(i: number) {
    return { id: 'T' + i, phone: '0972' + String(100000 + i), deletedAt: Date.now() - (i + 1) * 1000,
        barcodes: [{ code: 'R' + i }], trashReason: 'returned', isFromDeletion: false };
}

beforeEach(() => {
    dbListenerPendingPaths.clear();
    dbListenerFailedPaths.clear();
    try { localStorage.clear(); } catch {}
    firebaseState.isDatabaseInitialized = true;
    (uiState as any).notifyRemovedSeenIds = [];
    viewState.drawerGroupsOpen = [NOTIFY_GROUP_REMOVED];
});

describe('📤 seen cap', () => {
    it('control: with ≤ cap live rows, opening the group clears «ថ្មី»', () => {
        dataState.deletedItems = Array.from({ length: NOTIFY_REMOVED_SEEN_MAX }, (_, i) => trashItem(i));
        refreshNotifyRemovedView();
        expect(uiState.notifyRemovedView!.unseen).toBe(NOTIFY_REMOVED_SEEN_MAX);
        markNotifyRemovedSeen();
        expect(uiState.notifyRemovedView!.unseen).toBe(0);
    });

    it('cap + 1 live rows: after the user opened the 📤 group every row must be seen (badge cleared)', () => {
        dataState.deletedItems = Array.from({ length: NOTIFY_REMOVED_SEEN_MAX + 1 }, (_, i) => trashItem(i));
        refreshNotifyRemovedView();
        markNotifyRemovedSeen();
        const stillNew = uiState.notifyRemovedView!.rows.filter((r) => r.isNew).map((r) => r.key);
        expect(stillNew, 'rows still «ថ្មី» right after being viewed').toEqual([]);
        expect(uiState.notifyRemovedView!.unseen).toBe(0);
    });

    it('rows already seen stay seen when new rows arrive above them', () => {
        dataState.deletedItems = Array.from({ length: NOTIFY_REMOVED_SEEN_MAX }, (_, i) => trashItem(i + 50));
        refreshNotifyRemovedView();
        markNotifyRemovedSeen();
        expect(uiState.notifyRemovedView!.unseen).toBe(0);
        const fresh = Array.from({ length: 20 }, (_, i) => trashItem(i));
        dataState.deletedItems = fresh.concat(dataState.deletedItems);
        refreshNotifyRemovedView();
        expect(uiState.notifyRemovedView!.unseen).toBe(20);
        markNotifyRemovedSeen();
        expect(uiState.notifyRemovedView!.unseen, 'second open of the 📤 group').toBe(0);
    });

    it('a row hidden by a restore claim while new rows are marked stays seen once the restore is cancelled', () => {
        dataState.deletedItems = Array.from({ length: 5 }, (_, i) => trashItem(i + 10));
        refreshNotifyRemovedView();
        markNotifyRemovedSeen();
        expect(uiState.notifyRemovedView!.unseen).toBe(0);
        (dataState.deletedItems[2] as any).restoreClaim = { token: 'r', claimedAt: Date.now() };
        dataState.deletedItems = [trashItem(1)].concat(dataState.deletedItems);
        refreshNotifyRemovedView();
        markNotifyRemovedSeen();
        delete (dataState.deletedItems[3] as any).restoreClaim;
        refreshNotifyRemovedView();
        expect(uiState.notifyRemovedView!.rows.filter((r) => r.isNew).map((r) => r.key), 'restore cancelled').toEqual([]);
    });

    it('rows of a shop switched away and back stay seen', () => {
        const shopA = Array.from({ length: 4 }, (_, i) => trashItem(i + 20));
        dataState.deletedItems = shopA;
        refreshNotifyRemovedView();
        markNotifyRemovedSeen();
        dataState.deletedItems = Array.from({ length: 3 }, (_, i) => trashItem(i + 40));
        refreshNotifyRemovedView();
        markNotifyRemovedSeen();
        dataState.deletedItems = shopA;
        refreshNotifyRemovedView();
        expect(uiState.notifyRemovedView!.unseen, 'back on shop A').toBe(0);
    });
});
