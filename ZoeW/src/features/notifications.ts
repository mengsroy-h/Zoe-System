import { getServerNow } from '../core/clock';
import { dataState, firebaseState, uiState } from '../core/state';
import { appLocalStore, safeStoreGet, safeStoreSet } from '../core/storage';
import { DB_LISTENER_KEY_HISTORY, VIEW_NOT_MEASURABLE_NOTICE } from '../core/text';
import { APP_VERSION } from '../core/version';
import { elapsedSince } from '../core/elapsed';
import { barcodeAbandonIsRipe, itemHasRestoreMarkers, parseTimestampFromId } from '../domain/barcode';
import { isNativeApp, nativeWebOrigin } from '../platform/native';
import { dbListenerViewIsStale, emptyViewMessage } from '../services/db-listeners';
import { fetchWithTimeout, linkIsFrugal } from '../services/network';

export interface NotifyExpiryRow {
    key: string;
    phone: string;
    locker: string;
    count: number;
    hoursLeft: number;
}

export interface NotifyView {
    measurable: boolean;
    emptyText: string;
    packages: number;
    customers: number;
    rows: NotifyExpiryRow[];
    more: number;
}

export interface NotifyFeedItem {
    id: string;
    kind: string;
    title: string;
    body: string;
    points: string[];
    version: string;
    date: string;
}

export const NOTIFY_EXPIRY_HOURS_MAX = 24;
export const NOTIFY_HOUR_MS = 60 * 60 * 1000;
export const NOTIFY_EXPIRY_LIST_MAX = 60;
export const NOTIFY_FEED_PATH = '/announcements.json';
export const NOTIFY_FEED_TIMEOUT_MS = 8000;
export const NOTIFY_FEED_MIN_GAP_MS = 60 * 1000;
export const NOTIFY_FEED_INTERVAL_MS = 5 * 60 * 1000;
export const NOTIFY_FEED_MAX_ITEMS = 20;
export const NOTIFY_FEED_MAX_TEXT = 600;
export const NOTIFY_FEED_KINDS = ['update', 'maintenance', 'notice'];
export const NOTIFY_SEEN_KEY = 'zoew_notify_seen_v1';
export const NOTIFY_FEED_CACHE_KEY = 'zoew_notify_feed_v1';
export const NOTIFY_SEEN_MAX = 60;
export const NOTIFY_EMPTY_EXPIRY_TEXT = 'គ្មានកញ្ចប់ជិតផុតកំណត់ក្នុង ' + NOTIFY_EXPIRY_HOURS_MAX + ' ម៉ោងខាងមុខទេ';

export function hoursUntilAbandon(barcode, parentAt, now) {
    if (!barcode || barcode.isClosed) return -1;
    if (barcodeAbandonIsRipe(barcode, parentAt, now)) return 0;
    for (let h = 1; h <= NOTIFY_EXPIRY_HOURS_MAX; h++) {
        if (barcodeAbandonIsRipe(barcode, parentAt, now + h * NOTIFY_HOUR_MS)) return h;
    }
    return -1;
}

export function nearExpiryView(history, now, stale): NotifyView {
    const rows: NotifyExpiryRow[] = [];
    const phones = new Set();
    let packages = 0;
    const list = Array.isArray(history) ? history : [];
    for (let i = 0; i < list.length; i++) {
        const item = list[i];
        if (!item || typeof item !== 'object' || !item.id || item.isClosed) continue;
        if (item.clearClaim || itemHasRestoreMarkers(item)) continue;
        const parentAt = item.createdAt || parseTimestampFromId(item.id) || now;
        const barcodes = Array.isArray(item.barcodes) && item.barcodes.length
            ? item.barcodes
            : [{ code: item.barcode, isClosed: !!item.isClosed, locker: item.locker }];
        let count = 0;
        let soonest = Infinity;
        let locker = '';
        for (let j = 0; j < barcodes.length; j++) {
            const b = barcodes[j];
            if (!b || typeof b !== 'object') continue;
            const h = hoursUntilAbandon(b, parentAt, now);
            if (h < 0) continue;
            count++;
            if (h < soonest) soonest = h;
            if (!locker && b.locker && b.locker !== 'N/A') locker = String(b.locker);
        }
        if (!count) continue;
        packages += count;
        const phone = String(item.phone || '');
        phones.add(phone);
        rows.push({
            key: String(item.id),
            phone: phone,
            locker: locker || (item.locker && item.locker !== 'N/A' ? String(item.locker) : ''),
            count: count,
            hoursLeft: soonest
        });
    }
    rows.sort((a, b) => a.hoursLeft - b.hoursLeft || b.count - a.count);
    return {
        measurable: !stale,
        emptyText: stale ? VIEW_NOT_MEASURABLE_NOTICE : emptyViewMessage([DB_LISTENER_KEY_HISTORY], NOTIFY_EMPTY_EXPIRY_TEXT),
        packages: stale ? 0 : packages,
        customers: stale ? 0 : phones.size,
        rows: stale ? [] : rows.slice(0, NOTIFY_EXPIRY_LIST_MAX),
        more: stale ? 0 : Math.max(0, rows.length - NOTIFY_EXPIRY_LIST_MAX)
    };
}

export function refreshNotifyView() {
    const stale = !firebaseState.isDatabaseInitialized || dbListenerViewIsStale(DB_LISTENER_KEY_HISTORY);
    uiState.notifyView = nearExpiryView(dataState.scanHistory, getServerNow(), stale);
}

export function parseVersion(v) {
    const m = /^(\d{1,4})\.(\d{1,5})\.(\d{1,6})$/.exec(String(v || '').trim());
    return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

export function compareVersions(a, b) {
    const x = parseVersion(a);
    const y = parseVersion(b);
    if (!x || !y) return 0;
    for (let i = 0; i < 3; i++) {
        if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
    }
    return 0;
}

function cleanText(value) {
    if (typeof value !== 'string') return '';
    return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, NOTIFY_FEED_MAX_TEXT);
}

export function sanitizeFeed(raw): NotifyFeedItem[] | null {
    const items = raw && Array.isArray(raw.items) ? raw.items : null;
    if (!items) return null;
    const out: NotifyFeedItem[] = [];
    const ids = new Set();
    for (let i = 0; i < items.length && out.length < NOTIFY_FEED_MAX_ITEMS; i++) {
        const it = items[i];
        if (!it || typeof it !== 'object') continue;
        const id = cleanText(it.id).slice(0, 80);
        const kind = NOTIFY_FEED_KINDS.indexOf(it.kind) === -1 ? '' : it.kind;
        const title = cleanText(it.title);
        if (!id || !kind || !title || ids.has(id)) continue;
        ids.add(id);
        const version = parseVersion(it.version) ? String(it.version).trim() : '';
        const date = /^\d{4}-\d{2}-\d{2}$/.test(String(it.date || '')) ? String(it.date) : '';
        const points = Array.isArray(it.points) ? it.points.map(cleanText).filter(Boolean).slice(0, 12) : [];
        out.push({ id: id, kind: kind, title: title, body: cleanText(it.body), points: points, version: version, date: date });
    }
    return out;
}

export function latestFeedVersion(items) {
    let best = '';
    (Array.isArray(items) ? items : []).forEach((it) => {
        if (it && it.version && (!best || compareVersions(it.version, best) > 0)) best = it.version;
    });
    return best;
}

export function newerAppVersion(items) {
    const latest = latestFeedVersion(items);
    return latest && compareVersions(latest, APP_VERSION) > 0 ? latest : '';
}

function readJson(key) {
    try {
        const raw = safeStoreGet(appLocalStore, key);
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
}

export function loadNotifySeen() {
    const list = readJson(NOTIFY_SEEN_KEY);
    uiState.notifySeenIds = Array.isArray(list) ? list.filter((x) => typeof x === 'string').slice(-NOTIFY_SEEN_MAX) : [];
}

export function loadCachedNotifyFeed() {
    const cached = sanitizeFeed(readJson(NOTIFY_FEED_CACHE_KEY));
    if (cached && !uiState.notifyFeed.length) uiState.notifyFeed = cached;
}

export function unseenFeedCount(items, seen) {
    const seenSet = new Set(Array.isArray(seen) ? seen : []);
    return (Array.isArray(items) ? items : []).filter((it) => it && !seenSet.has(it.id)).length;
}

export function notifyBadgeCount(view, items, seen) {
    const expiring = view && view.measurable ? Number(view.packages) || 0 : 0;
    return expiring + unseenFeedCount(items, seen);
}

export function markNotifyFeedSeen() {
    const ids = uiState.notifyFeed.map((it) => it.id);
    if (!ids.length) return;
    const merged = uiState.notifySeenIds.filter((id) => ids.indexOf(id) === -1).concat(ids).slice(-NOTIFY_SEEN_MAX);
    const same = merged.length === uiState.notifySeenIds.length && merged.every((id, i) => id === uiState.notifySeenIds[i]);
    if (same) return;
    uiState.notifySeenIds = merged;
    safeStoreSet(appLocalStore, NOTIFY_SEEN_KEY, JSON.stringify(merged));
}

export function notifyFeedUrl() {
    if (!isNativeApp()) return '.' + NOTIFY_FEED_PATH;
    const origin = nativeWebOrigin();
    return origin ? origin + NOTIFY_FEED_PATH : '';
}

export function fetchNotifyFeed(userAsked?) {
    if (uiState.notifyFeedInFlight) return Promise.resolve(false);
    if (!userAsked) {
        if ((navigator.onLine as boolean) === false || linkIsFrugal()) return Promise.resolve(false);
        if (elapsedSince(uiState.notifyFeedFetchedAt) < NOTIFY_FEED_MIN_GAP_MS) return Promise.resolve(false);
    }
    const url = notifyFeedUrl();
    if (!url) return Promise.resolve(false);
    uiState.notifyFeedInFlight = true;
    uiState.notifyFeedFetchedAt = Date.now();
    return fetchWithTimeout(url, { cache: 'no-store' }, NOTIFY_FEED_TIMEOUT_MS, 'Notify feed timed out',
        (res) => (res && res.ok ? res.json() : null))
        .then((out) => {
            const items = sanitizeFeed(out && out.body);
            if (!items) return false;
            uiState.notifyFeed = items;
            safeStoreSet(appLocalStore, NOTIFY_FEED_CACHE_KEY, JSON.stringify({ items: items }));
            return true;
        }, () => false)
        .then((ok) => {
            uiState.notifyFeedInFlight = false;
            return ok;
        });
}

export function openNotifyDrawer() {
    uiState.drawerOpen = false;
    refreshNotifyView();
    uiState.notifyDrawerOpen = true;
    fetchNotifyFeed(true);
}

export function initNotifications() {
    loadNotifySeen();
    loadCachedNotifyFeed();
    refreshNotifyView();
    fetchNotifyFeed(false);
}

export function notifyPeriodicTick() {
    refreshNotifyView();
    fetchNotifyFeed(false);
}
