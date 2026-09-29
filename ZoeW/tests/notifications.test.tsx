/**
 * ⛔ ផ្ទាំងជូនដំណឹង 🔔 (សំណើម្ចាស់គម្រោង) ៖ កញ្ចប់ជិតផុតកំណត់ · ព័ត៌មានកំណែ · សារថែទាំ · «Powered By ZoeW»។
 * ⛔ «ជិតផុតកំណត់» ត្រូវសួរ **អ្នកសម្រេចដដែល** នឹងការសម្អាត ៧ ថ្ងៃ (`barcodeAbandonIsRipe`) ➜ គ្មានរូបមន្តព្រំដែនទី ២
 *    ដែលនិយាយផ្ទុយនឹងអ្វីដែលប្រព័ន្ធដកចេញពិត ៖ ការវាស់ចុះលើ **ព្រំដែនពិត** (៧ ថ្ងៃ ± ១ ms) មិនមែនលេខងាយ។
 * ⛔ «គ្មាន» ជាការអះអាងអំពីអាជីវកម្ម ➜ ទិដ្ឋភាពប្រវត្តិមិនស្រស់ = «វាស់មិនបាន» មិនមែន «គ្មានកញ្ចប់» (ច្បាប់ «បញ្ជីទទេ ↔ សិទ្ធិវាស់»)។
 * ⛔ សារថែទាំទៅដល់ App តាម `public/announcements.json` ដែល deploy ជាមួយ App ➜ **រាល់ PR ដែលឡើងកំណែត្រូវបន្ថែមធាតុ
 *    សម្រាប់កំណែនោះ** (ធាតុ `update` ថ្មីបំផុត = `APP_VERSION`) ➜ PR ដែលកែ App ដោយគ្មានសារ ➜ ធ្លាក់។ សារ `maintenance`
 *    ឈរលើគេបានដោយមិនឡើងកំណែ (`version-bump-scope` មិនរាប់ `announcements.json` ជាកូដ ship)។
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataState, firebaseState, uiState } from '../src/core/state';
import { dbListenerFailedPaths, dbListenerPendingPaths, DB_LISTENER_KEY_HISTORY, VIEW_NOT_MEASURABLE_NOTICE } from '../src/core/text';
import { APP_VERSION } from '../src/core/version';
import { barcodeAbandonIsRipe } from '../src/domain/barcode';
import { ABANDON_AGE_MS } from '../src/features/session';
import { clearSensitiveModalFields } from '../src/features/session';
import {
    NOTIFY_EMPTY_EXPIRY_TEXT, NOTIFY_FEED_CACHE_KEY, NOTIFY_HOUR_MS, NOTIFY_EXPIRY_HOURS_MAX, NOTIFY_SEEN_KEY,
    compareVersions, fetchNotifyFeed, hoursUntilAbandon, nearExpiryView, newerAppVersion, notifyBadgeCount,
    openNotifyDrawer, refreshNotifyView, sanitizeFeed
} from '../src/features/notifications';
import { closeSideDrawer, isSideDrawerOpen, openSideDrawer } from '../src/ui/page-nav';
import { showUpdateAvailableBanner } from '../src/ui/boot-splash';
import { AppNavbar } from '../src/app/components/AppNavbar';
import { NotifyDrawer } from '../src/app/components/NotifyDrawer';
import { DrawerBackdrop } from '../src/app/components/DrawerBackdrop';
import { SideDrawer } from '../src/app/components/SideDrawer';
import { mount, step, unmount } from './native/react-harness';

const NOW = Date.UTC(2026, 8, 29, 5, 0, 0);
const DAY = 24 * NOTIFY_HOUR_MS;
const FEED_FILE = path.resolve(__dirname, '..', 'public', 'announcements.json');

function item(id: string, createdAt: number, barcodes: any[], extra: any = {}) {
    return { id, phone: '0' + id.replace(/\D/g, '').padStart(8, '1'), createdAt, barcodes, ...extra };
}

beforeEach(() => {
    dbListenerPendingPaths.clear();
    dbListenerFailedPaths.clear();
    try { localStorage.clear(); } catch {}
    uiState.notifyFeed = [];
    uiState.notifySeenIds = [];
    uiState.notifyView = null;
    uiState.updateReady = false;
    uiState.notifyFeedFetchedAt = 0;
    uiState.notifyFeedInFlight = false;
    dataState.scanHistory = [];
    firebaseState.isDatabaseInitialized = true;
});

afterEach(() => {
    unmount();
    closeSideDrawer();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('ជិតផុតកំណត់ ៖ ព្រំដែនដដែលនឹងការសម្អាត ៧ ថ្ងៃ', () => {
    it('ព្រំដែន ២៤ ម៉ោង និងព្រំដែនផុតកំណត់ ចុះលើ barcodeAbandonIsRipe ពិត (± ១ ms)', () => {
        const open = { code: 'B1', isClosed: false };
        expect(hoursUntilAbandon(open, NOW - ABANDON_AGE_MS, NOW)).toBe(1);
        expect(hoursUntilAbandon(open, NOW - ABANDON_AGE_MS - 1, NOW)).toBe(0);
        expect(barcodeAbandonIsRipe(open, NOW - ABANDON_AGE_MS - 1, NOW)).toBe(true);
        expect(hoursUntilAbandon(open, NOW - ABANDON_AGE_MS + DAY, NOW)).toBe(-1);
        expect(hoursUntilAbandon(open, NOW - ABANDON_AGE_MS + DAY - 1, NOW)).toBe(NOTIFY_EXPIRY_HOURS_MAX);
        expect(hoursUntilAbandon({ code: 'B2', isClosed: true }, NOW - ABANDON_AGE_MS - DAY, NOW)).toBe(-1);
        const restored = { code: 'B3', isClosed: false, restoredAt: NOW - 3 * DAY };
        expect(hoursUntilAbandon(restored, NOW - ABANDON_AGE_MS - DAY, NOW)).toBe(-1);
    });

    it('រាប់តែ barcode បើក · ជួរដេកបិទ/កំពុង Clear/កំពុងស្តារ មិនរាប់ · តម្រៀបតាមពេលនៅសល់', () => {
        const old = NOW - ABANDON_AGE_MS + 2 * NOTIFY_HOUR_MS;
        const history = [
            item('A1', old, [{ code: 'A', isClosed: false, locker: 'L-2' }, { code: 'B', isClosed: true }]),
            item('A2', NOW - ABANDON_AGE_MS - 5, [{ code: 'C', isClosed: false }, { code: 'D', isClosed: false }]),
            item('A3', old, [{ code: 'E', isClosed: false }], { isClosed: true }),
            item('A4', old, [{ code: 'F', isClosed: false }], { clearClaim: { token: 't' } }),
            item('A5', old, [{ code: 'G', isClosed: false }], { restoreClaimId: 'x', restoreClaimToken: 'y' }),
            item('A6', NOW - DAY, [{ code: 'H', isClosed: false }]),
            { id: 'A7', phone: '0777', createdAt: old, barcode: 'LEGACY' }
        ];
        const view = nearExpiryView(history, NOW, false);
        expect(view.measurable).toBe(true);
        expect(view.packages).toBe(4);
        expect(view.customers).toBe(3);
        expect(view.rows.map((r) => r.key)).toEqual(['A2', 'A1', 'A7']);
        expect(view.rows[0]).toMatchObject({ count: 2, hoursLeft: 0 });
        expect(view.rows[1]).toMatchObject({ count: 1, hoursLeft: 3, locker: 'L-2' });
    });

    it('ទិដ្ឋភាពប្រវត្តិមិនស្រស់ ➜ «វាស់មិនបាន» មិនមែន «គ្មាន» ហើយមិនរាប់ចូល badge', () => {
        const history = [item('S1', NOW - ABANDON_AGE_MS, [{ code: 'S', isClosed: false }])];
        dbListenerPendingPaths.add(DB_LISTENER_KEY_HISTORY);
        const stale = nearExpiryView(history, NOW, true);
        expect(stale.measurable).toBe(false);
        expect(stale.packages).toBe(0);
        expect(stale.rows).toEqual([]);
        expect(stale.emptyText).toBe(VIEW_NOT_MEASURABLE_NOTICE);
        expect(notifyBadgeCount(stale, [], [])).toBe(0);
        dbListenerPendingPaths.clear();
        const fresh = nearExpiryView([], NOW, false);
        expect(fresh.emptyText).toBe(NOTIFY_EMPTY_EXPIRY_TEXT);
    });

    it('មិនទាន់ចូលប្រព័ន្ធ (Database មិនទាន់ភ្ជាប់) ➜ «វាស់មិនបាន» មិនមែន «គ្មានកញ្ចប់»', () => {
        firebaseState.isDatabaseInitialized = false;
        refreshNotifyView();
        expect(uiState.notifyView!.measurable).toBe(false);
        expect(uiState.notifyView!.emptyText).toBe(VIEW_NOT_MEASURABLE_NOTICE);
        firebaseState.isDatabaseInitialized = true;
        refreshNotifyView();
        expect(uiState.notifyView!.emptyText).toBe(NOTIFY_EMPTY_EXPIRY_TEXT);
    });
});

describe('សារថែទាំ/កំណែ ៖ announcements.json', () => {
    const raw = JSON.parse(readFileSync(FEED_FILE, 'utf8'));

    it('⛔ ធាតុ update ថ្មីបំផុតជាកំណែបច្ចុប្បន្ន (APP_VERSION) ➜ រាល់ការឡើងកំណែត្រូវមានសារ', () => {
        const firstUpdate = raw.items.find((it: any) => it && it.kind === 'update');
        expect(firstUpdate && firstUpdate.version).toBe(APP_VERSION);
    });

    it('គ្រប់ធាតុឆ្លងការត្រង (គ្មានធាតុបាត់ស្ងាត់) · id មិនស្ទួន · អត្ថបទខ្មែរ · គ្មានកំណែលើស App', () => {
        const clean = sanitizeFeed(raw)!;
        expect(clean).toHaveLength(raw.items.length);
        expect(new Set(clean.map((i) => i.id)).size).toBe(clean.length);
        for (const it of clean) {
            expect(/[ក-៿]/.test(it.title + it.body), it.id).toBe(true);
            if (it.version) expect(compareVersions(it.version, APP_VERSION), it.id).toBeLessThanOrEqual(0);
        }
        const versions = clean.filter((i) => i.version).map((i) => i.version);
        const sorted = versions.slice().sort((a, b) => compareVersions(b, a));
        expect(versions).toEqual(sorted);
    });

    it('ការត្រងបដិសេធរូបរាងខុស ដោយមិនបោះ', () => {
        expect(sanitizeFeed(null)).toBeNull();
        expect(sanitizeFeed({ items: 'x' })).toBeNull();
        expect(sanitizeFeed({ items: [null, 5, { id: 'a', kind: 'bad', title: 't' }, { id: 'b', kind: 'notice', title: '' }] })).toEqual([]);
        const one = sanitizeFeed({ items: [{ id: 'm1', kind: 'maintenance', title: 'ថែទាំ', version: '1.2', points: ['ក', 5] }] })!;
        expect(one[0]).toMatchObject({ id: 'm1', version: '', points: ['ក'] });
    });

    it('កំណែថ្មីជាង App ➜ ប្រាប់ · ស្មើ ឬចាស់ជាង ➜ មិនប្រាប់', () => {
        const [a, b, c] = APP_VERSION.split('.').map(Number);
        expect(newerAppVersion([{ version: a + '.' + b + '.' + (c + 1) } as any])).toBe(a + '.' + b + '.' + (c + 1));
        expect(newerAppVersion([{ version: APP_VERSION } as any])).toBe('');
        expect(compareVersions('2.10.0', '2.9.9')).toBe(1);
    });
});

describe('ការទាញសារ ៖ network-only តាម fetch ពិតរបស់ App', () => {
    it('ជោគជ័យ ➜ ផ្ទុក + cache ក្នុង localStorage · ក្រៅបណ្តាញ ➜ មិនហៅ (លើកលែងអ្នកប្រើបើក)', async () => {
        const calls: string[] = [];
        vi.stubGlobal('fetch', vi.fn((url: string, opts: any) => {
            calls.push(url + '|' + (opts && opts.cache));
            return Promise.resolve(new Response(JSON.stringify({ items: [{ id: 'n1', kind: 'notice', title: 'សារ' }] }), { status: 200 }));
        }));
        expect(await fetchNotifyFeed(true)).toBe(true);
        expect(calls[0]).toBe('./announcements.json|no-store');
        expect(uiState.notifyFeed.map((i) => i.id)).toEqual(['n1']);
        expect(JSON.parse(localStorage.getItem(NOTIFY_FEED_CACHE_KEY)!).items[0].id).toBe('n1');
        expect(await fetchNotifyFeed(false)).toBe(false);
        expect(calls).toHaveLength(1);
    });

    it('server ឆ្លើយខូច/ធ្លាក់ ➜ រក្សាសារចាស់ មិនបោះ', async () => {
        uiState.notifyFeed = [{ id: 'keep', kind: 'notice', title: 'ចាស់', body: '', points: [], version: '', date: '' }];
        vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('not json', { status: 200 }))));
        expect(await fetchNotifyFeed(true)).toBe(false);
        vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));
        expect(await fetchNotifyFeed(true)).toBe(false);
        expect(uiState.notifyFeed.map((i) => i.id)).toEqual(['keep']);
        expect(uiState.notifyFeedInFlight).toBe(false);
    });
});

describe('ផ្ទាំង 🔔 ក្នុង UI ពិត', () => {
    function stubFeed() {
        vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({ items: [] }), { status: 200 }))));
    }

    it('ប៊ូតុង 🔔 ជំនួស «Powered By ZoeW» ក្នុង navbar ➜ ស្លាកនោះរស់នៅក្នុងផ្ទាំងជូនដំណឹង', () => {
        mount(<><AppNavbar /><DrawerBackdrop /><SideDrawer /><NotifyDrawer /></>);
        const navbar = document.querySelector('.app-navbar')!;
        expect(navbar.textContent).not.toContain('Powered By ZoeW');
        expect(document.getElementById('navNotifyBtn')).toBeTruthy();
        expect(document.getElementById('notifyDrawer')!.querySelector('.drawer-foot')!.textContent).toContain('Powered By ZoeW');
    });

    it('badge = កញ្ចប់ជិតផុតកំណត់ + សារមិនទាន់អាន + កំណែថ្មី · បិទផ្ទាំង ➜ សារបានអាន', () => {
        stubFeed();
        dataState.scanHistory = [item('U1', Date.now() - ABANDON_AGE_MS + NOTIFY_HOUR_MS, [{ code: 'U', isClosed: false }, { code: 'V', isClosed: false }])];
        uiState.notifyFeed = [{ id: 'n1', kind: 'maintenance', title: 'ថែទាំ', body: '', points: [], version: '', date: '' }];
        mount(<><AppNavbar /><DrawerBackdrop /><SideDrawer /><NotifyDrawer /></>);
        step(() => { openNotifyDrawer(); });
        expect(document.getElementById('notifyDrawer')!.className).toContain('open');
        expect(document.getElementById('drawerBackdrop')!.className).toContain('open');
        expect(isSideDrawerOpen()).toBe(true);
        expect(document.getElementById('notifyExpiryList')!.children).toHaveLength(1);
        expect(document.getElementById('navNotifyBadge')!.textContent).toBe('3');
        expect(document.querySelector('.notify-new-tag')).toBeTruthy();
        step(() => { showUpdateAvailableBanner(); });
        expect(document.getElementById('navNotifyBadge')!.textContent).toBe('4');
        step(() => { closeSideDrawer(); });
        expect(isSideDrawerOpen()).toBe(false);
        expect(JSON.parse(localStorage.getItem(NOTIFY_SEEN_KEY)!)).toEqual(['n1']);
        expect(document.getElementById('navNotifyBadge')!.textContent).toBe('3');
    });

    it('ផ្ទាំង ២ មិនបើកជាន់គ្នា (ផ្ទៃខាងក្រោយតែមួយ · Back/PTR ឃើញស្រទាប់តែមួយ)', () => {
        stubFeed();
        mount(<><DrawerBackdrop /><SideDrawer /><NotifyDrawer /></>);
        step(() => { openNotifyDrawer(); });
        step(() => { openSideDrawer(); });
        expect(uiState.notifyDrawerOpen).toBe(false);
        expect(uiState.drawerOpen).toBe(true);
        step(() => { openNotifyDrawer(); });
        expect(uiState.drawerOpen).toBe(false);
        expect(uiState.notifyDrawerOpen).toBe(true);
    });

    it('⛔ ចាកចេញ ➜ លេខទូរស័ព្ទក្នុងបញ្ជីជិតផុតកំណត់មិនសល់ក្នុង DOM', () => {
        stubFeed();
        dataState.scanHistory = [item('P1', Date.now() - ABANDON_AGE_MS + NOTIFY_HOUR_MS, [{ code: 'P', isClosed: false }])];
        mount(<><DrawerBackdrop /><NotifyDrawer /></>);
        step(() => { openNotifyDrawer(); });
        const phone = dataState.scanHistory[0].phone;
        expect(document.getElementById('notifyDrawer')!.textContent).toContain(phone);
        step(() => { dataState.scanHistory = []; clearSensitiveModalFields(); });
        expect(document.getElementById('notifyDrawer')!.textContent).not.toContain(phone);
        expect(uiState.notifyDrawerOpen).toBe(false);
    });
});
