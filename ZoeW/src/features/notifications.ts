import { refreshDrawerGroups, toggleDrawerGroup } from '../core/actions';
import { getServerNow } from '../core/clock';
import { getZoneDateKey } from '../core/timezone';
import { dataState, firebaseState, uiState } from '../core/state';
import { viewState } from '../core/view-state';
import { appLocalStore, safeStoreGet, safeStoreSet } from '../core/storage';
import { DB_LISTENER_KEY_DELETED, DB_LISTENER_KEY_HISTORY, VIEW_NOT_MEASURABLE_NOTICE } from '../core/text';
import { APP_VERSION } from '../core/version';
import { elapsedSince } from '../core/elapsed';
import { barcodeAbandonIsRipe, barcodeEntriesOf, itemHasRestoreMarkers, parseTimestampFromId } from '../domain/barcode';
import { checkApkRelease } from './apk-update';
import { LICENSE_APP_CODE } from './license';
import { trashReasonOf } from './trash';
import { isNativeApp, nativeWebOrigin } from '../platform/native';
import { dbListenerViewIsStale, emptyViewMessage } from '../services/db-listeners';
import { fetchWithTimeout, linkIsFrugal, withTimeout } from '../services/network';

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
}

export interface NotifyRemovedRow {
    key: string;
    phone: string;
    locker: string;
    count: number;
    hoursAgo: number;
    isNew: boolean;
}

export interface NotifyRemovedView {
    measurable: boolean;
    emptyText: string;
    packages: number;
    customers: number;
    unseen: number;
    rows: NotifyRemovedRow[];
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
export const NOTIFY_DISMISSED_KEY = 'zoew_notify_dismissed_v1';
export const NOTIFY_DISMISSED_MAX = 200;
export const NOTIFY_SELLER_MAX_ITEMS = 20;
export const NOTIFY_SELLER_KINDS = ['notice', 'maintenance'];
export const NOTIFY_SELLER_CACHE_KEY = 'zoew_notify_seller_v1';
export const NOTIFY_SELLER_ID_PREFIX = 'kg:';
export const NOTIFY_SELLER_TITLE_MAX = 120;
export const NOTIFY_EMPTY_EXPIRY_TEXT = 'គ្មានកញ្ចប់ជិតផុតកំណត់ក្នុង ' + NOTIFY_EXPIRY_HOURS_MAX + ' ម៉ោងខាងមុខទេ';
export const NOTIFY_REMOVED_REASON = 'expired';
export const NOTIFY_REMOVED_SEEN_KEY = 'zoew_notify_removed_seen_v1';
export const NOTIFY_REMOVED_SEEN_MAX = 300;
export const NOTIFY_EMPTY_REMOVED_TEXT = 'គ្មានកញ្ចប់ដែលប្រព័ន្ធដកចេញព្រោះផុតកំណត់ក្នុងធុងសំរាមទេ';
export const NOTIFY_GROUP_EXPIRY = 'notifyGroupExpiry';
export const NOTIFY_GROUP_REMOVED = 'notifyGroupRemoved';

export function hoursUntilAbandon(barcode, parentAt, now) {
    if (!barcode || barcode.isClosed) return -1;
    if (barcodeAbandonIsRipe(barcode, parentAt, now)) return 0;
    for (let h = 1; h <= NOTIFY_EXPIRY_HOURS_MAX; h++) {
        if (barcodeAbandonIsRipe(barcode, parentAt, now + h * NOTIFY_HOUR_MS)) return h;
    }
    return -1;
}

export const NOTIFY_SCHEDULE_HORIZON_MS = 8 * 24 * NOTIFY_HOUR_MS;
export const NOTIFY_SCHEDULE_STEP_MS = 60 * 1000;
export const NOTIFY_SCHEDULE_MAX = 2000;

export const NOTIFY_SCHEDULE_SEARCH_MAX = 64;

export function abandonAtOf(barcode, parentAt, now, horizonMs) {
    if (!barcode || barcode.isClosed) return -1;
    if (!isFinite(now) || !isFinite(horizonMs) || horizonMs <= 0) return -1;
    if (barcodeAbandonIsRipe(barcode, parentAt, now)) return -1;
    let hi = now + horizonMs;
    if (!barcodeAbandonIsRipe(barcode, parentAt, hi)) return -1;
    let lo = now;
    for (let step = 0; step < NOTIFY_SCHEDULE_SEARCH_MAX && hi - lo > NOTIFY_SCHEDULE_STEP_MS; step++) {
        const mid = Math.floor((lo + hi) / 2);
        if (barcodeAbandonIsRipe(barcode, parentAt, mid)) hi = mid;
        else lo = mid;
    }
    return hi;
}

function eachOpenParcel(history, now, visit) {
    const list = Array.isArray(history) ? history : [];
    for (let i = 0; i < list.length; i++) {
        const item = list[i];
        if (!item || typeof item !== 'object' || !item.id || item.isClosed) continue;
        if (item.clearClaim || itemHasRestoreMarkers(item)) continue;
        const parentAt = item.createdAt || parseTimestampFromId(item.id) || now;
        const barcodes = Array.isArray(item.barcodes) && item.barcodes.length
            ? item.barcodes
            : [{ code: item.barcode, isClosed: !!item.isClosed, locker: item.locker }];
        visit(item, parentAt, barcodes);
    }
}

export function expiryScheduleTimes(history, now): number[] {
    const times: number[] = [];
    eachOpenParcel(history, now, (item, parentAt, barcodes) => {
        for (let j = 0; j < barcodes.length && times.length < NOTIFY_SCHEDULE_MAX; j++) {
            const b = barcodes[j];
            if (!b || typeof b !== 'object') continue;
            const at = abandonAtOf(b, parentAt, now, NOTIFY_SCHEDULE_HORIZON_MS);
            if (at > 0) times.push(at);
        }
    });
    return times.sort((a, b) => a - b);
}

export function nearExpiryView(history, now, stale): NotifyView {
    const rows: NotifyExpiryRow[] = [];
    const phones = new Set();
    let packages = 0;
    eachOpenParcel(history, now, (item, parentAt, barcodes) => {
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
        if (!count) return;
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
    });
    rows.sort((a, b) => a.hoursLeft - b.hoursLeft || b.count - a.count);
    return {
        measurable: !stale,
        emptyText: stale ? VIEW_NOT_MEASURABLE_NOTICE : emptyViewMessage([DB_LISTENER_KEY_HISTORY], NOTIFY_EMPTY_EXPIRY_TEXT),
        packages: stale ? 0 : packages,
        customers: stale ? 0 : phones.size,
        rows: stale ? [] : rows
    };
}

export function refreshNotifyView() {
    const stale = !firebaseState.isDatabaseInitialized || dbListenerViewIsStale(DB_LISTENER_KEY_HISTORY);
    uiState.notifyView = nearExpiryView(dataState.scanHistory, getServerNow(), stale);
    refreshNotifyRemovedView();
}

export function removedParcelsView(deleted, now, stale, seen): NotifyRemovedView {
    const list = Array.isArray(deleted) ? deleted : [];
    const seenSet = new Set(Array.isArray(seen) ? seen : []);
    const rows: (NotifyRemovedRow & { at: number })[] = [];
    const phones = new Set();
    let packages = 0;
    let unseen = 0;
    for (let i = 0; i < list.length; i++) {
        const item = list[i];
        if (!item || typeof item !== 'object' || !item.id) continue;
        if (trashReasonOf(item) !== NOTIFY_REMOVED_REASON || item.restoreClaim) continue;
        const entries = barcodeEntriesOf(item.barcodes);
        const count = entries.length || 1;
        let locker = '';
        for (let j = 0; j < entries.length && !locker; j++) {
            const b = entries[j].barcode;
            if (b && b.locker && b.locker !== 'N/A') locker = String(b.locker);
        }
        if (!locker && item.locker && item.locker !== 'N/A') locker = String(item.locker);
        const at = parseFloat(item.deletedAt) || 0;
        const key = String(item.id);
        const isNew = !seenSet.has(key);
        const phone = String(item.phone || '');
        packages += count;
        if (isNew) unseen += count;
        phones.add(phone);
        rows.push({ key, phone, locker, count, at, isNew, hoursAgo: at > 0 ? Math.max(0, Math.floor((now - at) / NOTIFY_HOUR_MS)) : -1 });
    }
    rows.sort((a, b) => b.at - a.at || b.count - a.count);
    return {
        measurable: !stale,
        emptyText: stale ? VIEW_NOT_MEASURABLE_NOTICE : emptyViewMessage([DB_LISTENER_KEY_DELETED], NOTIFY_EMPTY_REMOVED_TEXT),
        packages: stale ? 0 : packages,
        customers: stale ? 0 : phones.size,
        unseen: stale ? 0 : unseen,
        rows: stale ? [] : rows.map(({ at, ...row }) => row)
    };
}

export function refreshNotifyRemovedView() {
    const stale = !firebaseState.isDatabaseInitialized || dbListenerViewIsStale(DB_LISTENER_KEY_DELETED);
    uiState.notifyRemovedView = removedParcelsView(dataState.deletedItems, getServerNow(), stale, uiState.notifyRemovedSeenIds);
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

export function sanitizeSellerNotices(raw): NotifyFeedItem[] | null {
    if (raw === null) return [];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const out: NotifyFeedItem[] = [];
    const keys = Object.keys(raw).sort().reverse();
    for (let i = 0; i < keys.length && out.length < NOTIFY_SELLER_MAX_ITEMS; i++) {
        const key = keys[i];
        const it = raw[key];
        if (!it || typeof it !== 'object') continue;
        const id = cleanText(key).slice(0, 80);
        const kind = NOTIFY_SELLER_KINDS.indexOf(it.kind) === -1 ? '' : it.kind;
        const title = cleanText(it.title).slice(0, NOTIFY_SELLER_TITLE_MAX);
        const at = typeof it.at === 'number' && isFinite(it.at) && it.at > 0 ? it.at : 0;
        if (!id || !kind || !title) continue;
        out.push({
            id: NOTIFY_SELLER_ID_PREFIX + id,
            kind: kind,
            title: title,
            body: cleanText(it.body),
            points: [],
            version: '',
            date: at ? getZoneDateKey(at, 0) : ''
        });
    }
    return out;
}

export function combinedNotifyFeed(fileFeed, sellerFeed): NotifyFeedItem[] {
    const all = (Array.isArray(sellerFeed) ? sellerFeed : []).concat(Array.isArray(fileFeed) ? fileFeed : []);
    return all
        .map((it, i) => ({ it: it, i: i }))
        .sort((a, b) => String(b.it.date || '').localeCompare(String(a.it.date || '')) || a.i - b.i)
        .map((x) => x.it);
}

export function sellerNoticesUrl() {
    const lic = typeof window !== 'undefined' ? window.ZoeLicense : undefined;
    if (!lic || typeof lic.announcementsUrl !== 'function') return '';
    try {
        return String(lic.announcementsUrl(LICENSE_APP_CODE, NOTIFY_SELLER_MAX_ITEMS) || '');
    } catch (e) {
        return '';
    }
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

export function loadNotifyDismissed() {
    const list = readJson(NOTIFY_DISMISSED_KEY);
    uiState.notifyDismissedIds = Array.isArray(list) ? list.filter((x) => typeof x === 'string').slice(-NOTIFY_DISMISSED_MAX) : [];
}

export function visibleNotifyFeed(fileFeed, sellerFeed, dismissed): NotifyFeedItem[] {
    const hidden = new Set(Array.isArray(dismissed) ? dismissed : []);
    return combinedNotifyFeed(fileFeed, sellerFeed).filter((it) => it && !hidden.has(it.id));
}

export function dismissNotifyFeed(): number {
    const ids = visibleNotifyFeed(uiState.notifyFeed, uiState.notifySellerFeed, uiState.notifyDismissedIds).map((it) => it.id);
    markNotifyFeedSeen();
    clearAppBadge();
    if (!ids.length) return 0;
    const merged = uiState.notifyDismissedIds.filter((id) => ids.indexOf(id) === -1).concat(ids).slice(-NOTIFY_DISMISSED_MAX);
    uiState.notifyDismissedIds = merged;
    safeStoreSet(appLocalStore, NOTIFY_DISMISSED_KEY, JSON.stringify(merged));
    return ids.length;
}

export function loadNotifyRemovedSeen() {
    const raw = readJson(NOTIFY_REMOVED_SEEN_KEY);
    uiState.notifyRemovedSeenIds = Array.isArray(raw) ? raw.filter((id) => typeof id === 'string').slice(-NOTIFY_REMOVED_SEEN_MAX) : [];
}

export function notifyGroupIsOpen(group) {
    return viewState.drawerGroupsOpen.indexOf(group) !== -1;
}

export function toggleNotifyGroup(group?) {
    if (group === NOTIFY_GROUP_REMOVED && uiState.notifyDrawerOpen && notifyGroupIsOpen(group)) markNotifyRemovedSeen();
    toggleDrawerGroup(group);
}

export function markNotifyRemovedSeen() {
    const view = uiState.notifyRemovedView;
    if (!view || !view.measurable || !notifyGroupIsOpen(NOTIFY_GROUP_REMOVED)) return;
    const fresh = view.rows.filter((row) => row.isNew).map((row) => row.key);
    if (!fresh.length) return;
    const merged = uiState.notifyRemovedSeenIds.filter((id) => fresh.indexOf(id) === -1).concat(fresh).slice(-NOTIFY_REMOVED_SEEN_MAX);
    uiState.notifyRemovedSeenIds = merged;
    safeStoreSet(appLocalStore, NOTIFY_REMOVED_SEEN_KEY, JSON.stringify(merged));
    refreshNotifyRemovedView();
}

export function loadNotifySeen() {
    const list = readJson(NOTIFY_SEEN_KEY);
    uiState.notifySeenIds = Array.isArray(list) ? list.filter((x) => typeof x === 'string').slice(-NOTIFY_SEEN_MAX) : [];
}

export function loadCachedNotifyFeed() {
    const cached = sanitizeFeed(readJson(NOTIFY_FEED_CACHE_KEY));
    if (cached && !uiState.notifyFeed.length) uiState.notifyFeed = cached;
}

export function loadCachedSellerNotices() {
    const cached = readJson(NOTIFY_SELLER_CACHE_KEY);
    const items = cached && Array.isArray(cached.items) ? sanitizeFeed(cached) : null;
    if (items && !uiState.notifySellerFeed.length) {
        uiState.notifySellerFeed = items.filter((it) => it.id.indexOf(NOTIFY_SELLER_ID_PREFIX) === 0 && !it.version
            && NOTIFY_SELLER_KINDS.indexOf(it.kind) !== -1);
    }
}

export function unseenFeedCount(items, seen) {
    const seenSet = new Set(Array.isArray(seen) ? seen : []);
    return (Array.isArray(items) ? items : []).filter((it) => it && !seenSet.has(it.id)).length;
}

export function notifyBadgeCount(view, items, seen, removed?) {
    const expiring = view && view.measurable ? Number(view.packages) || 0 : 0;
    const removedNew = removed && removed.measurable ? Number(removed.unseen) || 0 : 0;
    return expiring + removedNew + unseenFeedCount(items, seen);
}

export function markNotifyFeedSeen() {
    const ids = combinedNotifyFeed(uiState.notifyFeed, uiState.notifySellerFeed).map((it) => it.id);
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

function fetchFileFeed(url) {
    if (!url) return Promise.resolve(false);
    return fetchWithTimeout(url, { cache: 'no-store' }, NOTIFY_FEED_TIMEOUT_MS, 'Notify feed timed out',
        (res) => (res && res.ok ? res.json() : null))
        .then((out) => {
            const items = sanitizeFeed(out && out.body);
            if (!items) return false;
            uiState.notifyFeed = items;
            safeStoreSet(appLocalStore, NOTIFY_FEED_CACHE_KEY, JSON.stringify({ items: items }));
            if (uiState.appUpdateCheck.phase === 'failed') uiState.appUpdateCheck = { phase: 'idle', at: 0 };
            return true;
        }, () => false);
}

function fetchSellerNotices(url) {
    if (!url) return Promise.resolve(false);
    return fetchWithTimeout(url, { cache: 'no-store' }, NOTIFY_FEED_TIMEOUT_MS, 'Seller notices timed out',
        (res) => (res && res.ok ? res.json().then((data) => ({ data: data })) : null))
        .then((out) => {
            const items = out && out.body ? sanitizeSellerNotices(out.body.data) : null;
            if (!items) return false;
            uiState.notifySellerFeed = items;
            safeStoreSet(appLocalStore, NOTIFY_SELLER_CACHE_KEY, JSON.stringify({ items: items }));
            return true;
        }, () => false);
}

export function fetchNotifyFeed(userAsked?, versionFeedOnly?) {
    if (uiState.notifyFeedInFlight) return Promise.resolve(false);
    if (!userAsked) {
        if ((navigator.onLine as boolean) === false || linkIsFrugal()) return Promise.resolve(false);
        if (elapsedSince(uiState.notifyFeedFetchedAt) < NOTIFY_FEED_MIN_GAP_MS) return Promise.resolve(false);
    }
    const url = notifyFeedUrl();
    const sellerUrl = sellerNoticesUrl();
    if (!url && !sellerUrl) return Promise.resolve(false);
    uiState.notifyFeedInFlight = true;
    uiState.notifyFeedFetchedAt = Date.now();
    return Promise.all([fetchFileFeed(url), fetchSellerNotices(sellerUrl)])
        .then((results) => (versionFeedOnly ? results[0] : results[0] || results[1]), () => false)
        .then((ok) => {
            uiState.notifyFeedInFlight = false;
            return ok;
        });
}

export function clearAppBadge() {
    try {
        const nav: any = navigator;
        if (nav && typeof nav.clearAppBadge === 'function') Promise.resolve(nav.clearAppBadge()).catch(() => {});
    } catch (e) {}
}

export function openNotifyDrawer() {
    uiState.drawerOpen = false;
    refreshDrawerGroups();
    refreshNotifyView();
    uiState.notifyDrawerOpen = true;
    clearAppBadge();
    checkApkRelease(newerAppVersion(uiState.notifyFeed));
    fetchNotifyFeed(true).then(() => checkApkRelease(newerAppVersion(uiState.notifyFeed)));
}

export const APP_UPDATE_CHECK_WAIT_MS = 100;
export const APP_UPDATE_CHECK_WAIT_MAX = Math.ceil(NOTIFY_FEED_TIMEOUT_MS / APP_UPDATE_CHECK_WAIT_MS);

export function requestServiceWorkerUpdate(): Promise<boolean> {
    if (isNativeApp()) return Promise.resolve(false);
    try {
        const sw: any = typeof navigator !== 'undefined' ? navigator.serviceWorker : null;
        if (!sw || typeof sw.getRegistration !== 'function') return Promise.resolve(false);
        return Promise.resolve(sw.getRegistration('./'))
            .then((reg: any) => (reg && typeof reg.update === 'function' ? Promise.resolve(reg.update()).then(() => true) : false))
            .catch(() => false);
    } catch (e) {
        return Promise.resolve(false);
    }
}

export async function checkForAppUpdate(): Promise<void> {
    if (uiState.appUpdateCheck.phase === 'checking') return;
    uiState.appUpdateCheck = { phase: 'checking', at: Date.now() };
    const sw = withTimeout(requestServiceWorkerUpdate(), NOTIFY_FEED_TIMEOUT_MS, 'Service worker update timed out').catch(() => false);
    for (let waited = 0; uiState.notifyFeedInFlight && waited < APP_UPDATE_CHECK_WAIT_MAX; waited++) {
        await new Promise((resolve) => setTimeout(resolve, APP_UPDATE_CHECK_WAIT_MS));
    }
    const fetched = await fetchNotifyFeed(true, true);
    const newer = newerAppVersion(uiState.notifyFeed);
    if (newer) await checkApkRelease(newer, true);
    await sw;
    uiState.appUpdateCheck = { phase: fetched ? 'done' : 'failed', at: Date.now() };
}

export function initNotifications() {
    loadNotifySeen();
    loadNotifyRemovedSeen();
    loadNotifyDismissed();
    loadCachedNotifyFeed();
    loadCachedSellerNotices();
    refreshNotifyView();
    fetchNotifyFeed(false);
}

export function notifyPeriodicTick() {
    refreshNotifyView();
    fetchNotifyFeed(false);
}
