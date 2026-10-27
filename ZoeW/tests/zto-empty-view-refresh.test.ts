// A history snapshot refreshes the not-closed bar and schedules the Sign-stamp batch even when the current filtered view
// is empty (default filter «today» before the first scan · a quiet day): the bar and the stamps follow history and trash,
// never the rows a filter happens to show.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { dataState, firebaseState, uiState, ztoState } from '../src/core/state';
import { appLocalStore } from '../src/core/storage';
import { getServerNow } from '../src/core/clock';
import { getZoneDateKey } from '../src/core/timezone';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { clearZtoPickupStatusStore, renderZtoSyncViews, setZtoPickupVerdict } from '../src/features/zto-status';
import { refreshCurrentHistoryView } from '../src/ui/history-refresh';

function closedItem(id: string, code: string, dayOffset: number) {
    const at = getServerNow() + dayOffset * 86400000;
    return { id, phone: '0960007345', scanDate: getZoneDateKey(at, 0), createdAt: at, isClosed: true, closedAt: at, cod: 1, dod: 0, count: 1,
        barcode: code, barcodes: [{ code, isClosed: true, closedAt: at, cod: 1, dod: 0 }] };
}

beforeEach(() => {
    dbListenerPendingPaths.clear();
    dbListenerFailedPaths.clear();
    appLocalStore.clear();
    appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ enabled: true, fastMode: true,
        url: window.location.origin + '/.netlify/functions/zto-order-detail?barcode={barcode}' }));
    appLocalStore.setItem('zoew_zto_autoclose_v1', '0');
    clearZtoPickupStatusStore();
    uiState.currentFilterMode = 'today';
    clearTimeout(ztoState.ztoFinalTimer);
    ztoState.ztoFinalTimer = null;
    clearTimeout(ztoState.ztoStatusSweepTimer);
    ztoState.ztoStatusSweepTimer = null;
    firebaseState.isDatabaseInitialized = true;
    dataState.deletedItems = [];
});

afterEach(() => {
    clearTimeout(ztoState.ztoFinalTimer);
    ztoState.ztoFinalTimer = null;
    clearTimeout(ztoState.ztoStatusSweepTimer);
    ztoState.ztoStatusSweepTimer = null;
    appLocalStore.clear();
});

function scenario(dayOffset: number) {
    const item = closedItem('b1', 'ZTBAR00001', dayOffset);
    dataState.scanHistory = [item];
    setZtoPickupVerdict('ZTBAR00001', false);
    renderZtoSyncViews();
    expect(ztoState.ztoBannerView?.headline, 'bar shows the closed-but-not-signed parcel').toMatch(/^1 /);
    const reopened = JSON.parse(JSON.stringify(item));
    reopened.isClosed = false;
    delete reopened.closedAt;
    reopened.barcodes[0].isClosed = false;
    delete reopened.barcodes[0].closedAt;
    dataState.scanHistory = [reopened];
    refreshCurrentHistoryView();
    return { bar: ztoState.ztoBannerView ? ztoState.ztoBannerView.headline : null, finalMarksScheduled: !!ztoState.ztoFinalTimer };
}

describe('not-closed bar + stamp scheduling on a history snapshot', () => {
    it('control: parcel scanned today (filtered view non-empty) ➜ reopen elsewhere clears the bar, stamps scheduled', () => {
        expect(scenario(0)).toEqual({ bar: null, finalMarksScheduled: true });
    });
    it('parcel scanned yesterday, view = today (empty) ➜ snapshot must still refresh the bar and schedule stamps', () => {
        expect(scenario(-1)).toEqual({ bar: null, finalMarksScheduled: true });
    });
});
