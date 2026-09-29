/**
 * ⛔ ដំណឹងពីអ្នកលក់ (ZoeKeyGen) ➜ ផ្ទាំង 🔔 របស់ ZoeW ៖ ZoeKeyGen សរសេរចូល `license_announcements/<App>` ក្នុង License Project
 *    ហើយ ZoeW អានវាតាម REST (គ្មាន auth) តាម URL ដែល `license-verify.js` សាង។
 * ⛔ ស្នាមភ្ជាប់ត្រូវវាស់ពិត ៖ payload ពី `buildNoticePayload()` **ពិត** របស់ ZoeKeyGen · URL ពី `announcementsUrl()` **ពិត** ·
 *    ពិដានចំនួន/ប្រវែង/ប្រភេទ ដេរីវេពីកូដទាំង ២ ខាង (មិនមែន literal)។ rules ពិតលើ emulator ៖ `emu/license-seat-rules-test.js`។
 * ⛔ ដំណឹងពីអ្នកលក់ **មិនអាចក្លែងកំណែ App** ៖ ប្រភេទ `update`/`version` ត្រូវបោះចោល ហើយផ្នែក «📱 កំណែ App» អានតែ
 *    `announcements.json` (ដំណឹងមួយមិនត្រូវធ្វើឲ្យវារាយ «✅ កំណែចុងក្រោយ» ពេលឯកសារនោះទាញមិនបាន)។
 * ⛔ «ទាញមិនបាន» ≠ «គ្មានដំណឹង» ៖ ការធ្លាក់រក្សាដំណឹងចាស់ · `null` ពី server (bucket ទទេ) ជាសាលក្រម «គ្មាន» ពិត។
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { uiState } from '../src/core/state';
import { getZoneDateKey } from '../src/core/timezone';
import {
    NOTIFY_SEEN_KEY, NOTIFY_SELLER_CACHE_KEY, NOTIFY_SELLER_ID_PREFIX, NOTIFY_SELLER_KINDS, NOTIFY_SELLER_MAX_ITEMS,
    NOTIFY_SELLER_TITLE_MAX, combinedNotifyFeed, fetchNotifyFeed, loadCachedSellerNotices, notifyBadgeCount,
    openNotifyDrawer, sanitizeSellerNotices, sellerNoticesUrl
} from '../src/features/notifications';
import { LICENSE_APP_CODE } from '../src/features/license';
import { closeSideDrawer } from '../src/ui/page-nav';
import { AppNavbar } from '../src/app/components/AppNavbar';
import { NotifyDrawer } from '../src/app/components/NotifyDrawer';
import { DrawerBackdrop } from '../src/app/components/DrawerBackdrop';
import { mount, step, unmount } from './native/react-harness';

const REPO = path.resolve(__dirname, '..', '..');
const KEYGEN_SRC = readFileSync(path.join(REPO, 'ZoeKeyGen', 'app.js'), 'utf8');
const LICENSE_SRC = readFileSync(path.join(REPO, 'ZoeW', 'public', 'license-verify.js'), 'utf8');

function sliceFn(name: string): string {
    const start = KEYGEN_SRC.indexOf('\nfunction ' + name + '(');
    if (start === -1) throw new Error('រកមិនឃើញ function ' + name + ' ក្នុង ZoeKeyGen/app.js');
    let depth = 0;
    let i = KEYGEN_SRC.indexOf('{', start);
    for (; i < KEYGEN_SRC.length; i++) {
        if (KEYGEN_SRC[i] === '{') depth++;
        else if (KEYGEN_SRC[i] === '}') { depth--; if (depth === 0) { i++; break; } }
    }
    return KEYGEN_SRC.slice(start + 1, i);
}

function keygen() {
    const decls = ['LICENSE_APP_CODE', 'NOTICE_TITLE_MAX', 'NOTICE_BODY_MAX', 'NOTICE_KEEP_MAX', 'NOTICE_KIND_LABELS', 'NOTICE_ID_ALPHABET'].map((name) => {
        const m = KEYGEN_SRC.match(new RegExp('^const ' + name + ' = .*;$', 'm'));
        if (!m) throw new Error('រកមិនឃើញ const ' + name);
        return m[0].replace(/^const /, 'var ');
    });
    const ctx: any = { crypto: webcrypto, Uint8Array, String, Math, Object, isFinite };
    vm.createContext(ctx);
    vm.runInContext(decls.join('\n') + '\n' + ['cleanNoticeText', 'buildNoticePayload', 'newNoticeId'].map(sliceFn).join('\n\n'), ctx);
    return ctx;
}

function installRealLicenseModule() {
    new Function('window', 'navigator', LICENSE_SRC)(window, navigator);
}

function jsonResponse(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), { status });
}

const FEED_ITEM = { id: '9.9.8', kind: 'update', version: '0.0.1', date: '2026-09-01', title: 'កំណែចាស់', body: '' };

beforeEach(() => {
    try { localStorage.clear(); } catch {}
    uiState.notifyFeed = [];
    uiState.notifySellerFeed = [];
    uiState.notifySeenIds = [];
    uiState.notifyView = null;
    uiState.updateReady = false;
    uiState.notifyFeedFetchedAt = 0;
    uiState.notifyFeedInFlight = false;
});

afterEach(() => {
    unmount();
    closeSideDrawer();
    delete (window as any).ZoeLicense;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('ស្នាមភ្ជាប់ ZoeKeyGen ↔ ZoeW', () => {
    it('ប្រភេទ · ពិដានចំនួន · ពិដានចំណងជើង ដេរីវេពី ZoeKeyGen ពិត · កូដ App ដូចគ្នា', () => {
        const kg = keygen();
        expect(Object.keys(kg.NOTICE_KIND_LABELS).sort()).toEqual(NOTIFY_SELLER_KINDS.slice().sort());
        expect(NOTIFY_SELLER_MAX_ITEMS).toBe(kg.NOTICE_KEEP_MAX);
        expect(NOTIFY_SELLER_TITLE_MAX).toBe(kg.NOTICE_TITLE_MAX);
        expect(kg.LICENSE_APP_CODE).toBe(LICENSE_APP_CODE);
    });

    it('payload ពិតរបស់ ZoeKeyGen គ្រប់ប្រភេទ ➜ ZoeW ទទួលទាំងអស់ (គ្មានដំណឹងបាត់ស្ងាត់) · ចំណងជើង/ខ្លឹមសារដដែល', () => {
        const kg = keygen();
        const raw: Record<string, unknown> = {};
        const kinds = Object.keys(kg.NOTICE_KIND_LABELS);
        kinds.forEach((kind, i) => {
            const at = Date.UTC(2026, 8, 28, 20, 0, 0) + i * 1000;
            const built = kg.buildNoticePayload(kind, 'ចំណងជើង ' + i, i ? 'បន្ទាត់ ១\nបន្ទាត់ ២' : '', at);
            raw[kg.newNoticeId(at)] = JSON.parse(JSON.stringify(built.payload));
        });
        const edge = kg.buildNoticePayload(kinds[0], 'ក'.repeat(kg.NOTICE_TITLE_MAX), 'ខ'.repeat(kg.NOTICE_BODY_MAX), Date.UTC(2026, 8, 29));
        raw[kg.newNoticeId(Date.UTC(2026, 8, 29))] = JSON.parse(JSON.stringify(edge.payload));
        const out = sanitizeSellerNotices(raw)!;
        expect(out).toHaveLength(kinds.length + 1);
        expect(out[0].title).toBe('ក'.repeat(kg.NOTICE_TITLE_MAX));
        expect(out[0].body).toBe('ខ'.repeat(kg.NOTICE_BODY_MAX));
        expect(out.find((it) => it.body === 'បន្ទាត់ ១\nបន្ទាត់ ២')).toBeTruthy();
        expect(out.every((it) => it.id.startsWith(NOTIFY_SELLER_ID_PREFIX) && it.version === '' && it.points.length === 0)).toBe(true);
        expect(out[out.length - 1].date).toBe('2026-09-29');
    });

    it('URL អានមកពី announcementsUrl() ពិតរបស់ license-verify.js (orderBy $key · limitToLast = ពិដាន)', () => {
        expect(sellerNoticesUrl()).toBe('');
        installRealLicenseModule();
        const url = sellerNoticesUrl();
        expect(url).toMatch(/^https:\/\/[a-z0-9-]+\.firebaseio\.com\/license_announcements\/ZOE\.json\?/);
        expect(url).toContain('orderBy=%22%24key%22');
        expect(url).toContain('limitToLast=' + NOTIFY_SELLER_MAX_ITEMS);
        (window as any).ZoeLicense.announcementsUrl = () => { throw new Error('boom'); };
        expect(sellerNoticesUrl()).toBe('');
    });
});

describe('sanitizeSellerNotices ៖ សាលក្រម ៣', () => {
    it('`null` = bucket ទទេ (សាលក្រម «គ្មាន») · រូបរាងខុស = មិនមែនសាលក្រម (null)', () => {
        expect(sanitizeSellerNotices(null)).toEqual([]);
        expect(sanitizeSellerNotices(undefined)).toBeNull();
        expect(sanitizeSellerNotices('x')).toBeNull();
        expect(sanitizeSellerNotices([{ kind: 'notice', title: 't', at: 1 }])).toBeNull();
    });

    it('⛔ ប្រភេទ `update` · `version` មិនអាចក្លែងកំណែ App · ធាតុខូចរំលង · ថ្មីមុន · ពិដានចំនួន', () => {
        const raw: Record<string, unknown> = {
            n1700000000000aaaaaa: { kind: 'update', title: 'ក្លែង', version: '99.0.0', at: 1700000000000 },
            n1700000001000aaaaaa: { kind: 'notice', title: '', at: 1700000001000 },
            n1700000002000aaaaaa: 'x',
            n1700000003000aaaaaa: { kind: 'maintenance', title: 'ថែទាំ\u0007', version: '99.0.0', at: 1700000003000 }
        };
        const out = sanitizeSellerNotices(raw)!;
        expect(out.map((it) => it.title)).toEqual(['ថែទាំ']);
        expect(out[0].version).toBe('');
        const many: Record<string, unknown> = {};
        for (let i = 0; i < NOTIFY_SELLER_MAX_ITEMS + 5; i++) {
            many['n' + String(1700000000000 + i * 1000) + 'bbbbbb'] = { kind: 'notice', title: 'ដំណឹង ' + i, at: 1700000000000 + i * 1000 };
        }
        const capped = sanitizeSellerNotices(many)!;
        expect(capped).toHaveLength(NOTIFY_SELLER_MAX_ITEMS);
        expect(capped[0].title).toBe('ដំណឹង ' + (NOTIFY_SELLER_MAX_ITEMS + 4));
    });

    it('កាលបរិច្ឆេទតាម Asia/Phnom_Penh (មិនមែនតំបន់ម៉ោងឧបករណ៍)', () => {
        const at = Date.UTC(2026, 8, 28, 18, 30, 0);
        const out = sanitizeSellerNotices({ n1790000000000cccccc: { kind: 'notice', title: 'x', at } })!;
        expect(out[0].date).toBe(getZoneDateKey(at, 0));
        expect(out[0].date).toBe('2026-09-29');
    });
});

describe('ការទាញ ៖ ប្រភព ២ ឯករាជ្យ', () => {
    function stubBoth(seller: () => Response | Promise<Response>, file?: () => Response | Promise<Response>) {
        const calls: string[] = [];
        vi.stubGlobal('fetch', vi.fn((url: string) => {
            calls.push(url);
            if (url.includes('license_announcements')) return Promise.resolve().then(seller);
            return Promise.resolve().then(file || (() => jsonResponse({ items: [FEED_ITEM] })));
        }));
        return calls;
    }

    it('ទាញទាំង ២ ស្របគ្នា · cache ដាច់ដោយឡែក · បញ្ជីរួមថ្មីមុន', async () => {
        installRealLicenseModule();
        const calls = stubBoth(() => jsonResponse({ n1790000000000dddddd: { kind: 'maintenance', title: 'ថែទាំយប់នេះ', body: 'ម៉ោង ៩', at: 1790000000000 } }));
        expect(await fetchNotifyFeed(true)).toBe(true);
        expect(calls).toHaveLength(2);
        expect(uiState.notifySellerFeed.map((it) => it.title)).toEqual(['ថែទាំយប់នេះ']);
        expect(uiState.notifyFeed.map((it) => it.id)).toEqual(['9.9.8']);
        expect(JSON.parse(localStorage.getItem(NOTIFY_SELLER_CACHE_KEY)!).items[0].title).toBe('ថែទាំយប់នេះ');
        expect(combinedNotifyFeed(uiState.notifyFeed, uiState.notifySellerFeed).map((it) => it.title)).toEqual(['ថែទាំយប់នេះ', 'កំណែចាស់']);
    });

    it('⛔ ទាញមិនបាន (HTTP 401 មុន Publish rules · បណ្តាញធ្លាក់ · JSON ខូច) ➜ រក្សាដំណឹងចាស់', async () => {
        installRealLicenseModule();
        const keep = sanitizeSellerNotices({ n1790000000000eeeeee: { kind: 'notice', title: 'ចាស់', at: 1790000000000 } })!;
        uiState.notifySellerFeed = keep;
        stubBoth(() => jsonResponse({ error: 'Permission denied' }, 401));
        await fetchNotifyFeed(true);
        expect(uiState.notifySellerFeed).toEqual(keep);
        stubBoth(() => Promise.reject(new TypeError('Failed to fetch')));
        await fetchNotifyFeed(true);
        expect(uiState.notifySellerFeed).toEqual(keep);
        stubBoth(() => new Response('not json', { status: 200 }));
        await fetchNotifyFeed(true);
        expect(uiState.notifySellerFeed).toEqual(keep);
        expect(uiState.notifyFeedInFlight).toBe(false);
    });

    it('⛔ ទិសផ្ទុយ ៖ server ឆ្លើយ `null` (អ្នកលក់លុបដំណឹងទាំងអស់) ➜ ដំណឹងបាត់ពិត', async () => {
        installRealLicenseModule();
        uiState.notifySellerFeed = sanitizeSellerNotices({ n1790000000000ffffff: { kind: 'notice', title: 'ត្រូវលុប', at: 1790000000000 } })!;
        stubBoth(() => jsonResponse(null));
        expect(await fetchNotifyFeed(true)).toBe(true);
        expect(uiState.notifySellerFeed).toEqual([]);
    });

    it('ប្រភពមួយធ្លាក់ មិនបំផ្លាញប្រភពមួយទៀត · គ្មាន ZoeLicense ➜ ទាញតែ announcements.json', async () => {
        installRealLicenseModule();
        stubBoth(() => jsonResponse({ n1790000000000gggggg: { kind: 'notice', title: 'ល្អ', at: 1790000000000 } }), () => Promise.reject(new TypeError('x')));
        expect(await fetchNotifyFeed(true)).toBe(true);
        expect(uiState.notifySellerFeed.map((it) => it.title)).toEqual(['ល្អ']);
        delete (window as any).ZoeLicense;
        uiState.notifySellerFeed = [];
        const calls = stubBoth(() => jsonResponse({}));
        expect(await fetchNotifyFeed(true)).toBe(true);
        expect(calls).toEqual(['./announcements.json']);
    });

    it('cache ៖ ស្តារពេលបើក App · ⛔ ធាតុ cache ដែលក្លែងជាកំណែ/ប្រភេទ update ត្រូវបោះចោល', () => {
        localStorage.setItem(NOTIFY_SELLER_CACHE_KEY, JSON.stringify({ items: [
            { id: NOTIFY_SELLER_ID_PREFIX + 'n1', kind: 'notice', title: 'ពី cache', date: '2026-09-29' },
            { id: NOTIFY_SELLER_ID_PREFIX + 'n2', kind: 'update', title: 'ក្លែង', version: '99.0.0' },
            { id: NOTIFY_SELLER_ID_PREFIX + 'n3', kind: 'notice', title: 'ក្លែងកំណែ', version: '99.0.0' },
            { id: 'plain', kind: 'notice', title: 'មិនមែនពីអ្នកលក់' }
        ] }));
        loadCachedSellerNotices();
        expect(uiState.notifySellerFeed.map((it) => it.title)).toEqual(['ពី cache']);
    });
});

describe('ផ្ទាំង 🔔 ក្នុង UI ពិត', () => {
    it('ដំណឹងពីអ្នកលក់លេចក្នុងបញ្ជី · រាប់ក្នុង badge · បើកផ្ទាំង ➜ បានអាន', () => {
        vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(jsonResponse({ items: [] }))));
        uiState.notifySellerFeed = sanitizeSellerNotices({ n1790000000000hhhhhh: { kind: 'maintenance', title: 'ថែទាំ', body: 'បន្ទាត់ ១\nបន្ទាត់ ២', at: 1790000000000 } })!;
        mount(<><AppNavbar /><DrawerBackdrop /><NotifyDrawer /></>);
        expect(document.getElementById('navNotifyBadge')!.textContent).toBe('1');
        step(() => { openNotifyDrawer(); });
        const list = document.getElementById('notifyFeedList')!;
        expect(list.textContent).toContain('ថែទាំ');
        expect(list.querySelector('.notify-feed-body')!.textContent).toBe('បន្ទាត់ ១\nបន្ទាត់ ២');
        expect(list.querySelector('.notify-kind-maintenance')).toBeTruthy();
        step(() => { closeSideDrawer(); });
        expect(JSON.parse(localStorage.getItem(NOTIFY_SEEN_KEY)!)).toEqual([uiState.notifySellerFeed[0].id]);
        expect(document.getElementById('navNotifyBadge')).toBeNull();
        expect(notifyBadgeCount(null, combinedNotifyFeed([], uiState.notifySellerFeed), uiState.notifySeenIds)).toBe(0);
    });

    it('⛔ ដំណឹងពីអ្នកលក់មិនធ្វើឲ្យ «📱 កំណែ App» រាយ ✅ ពេល announcements.json ទាញមិនបាន', () => {
        vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('offline'))));
        uiState.notifySellerFeed = sanitizeSellerNotices({ n1790000000000iiiiii: { kind: 'notice', title: 'សួស្តី', at: 1790000000000 } })!;
        mount(<><DrawerBackdrop /><NotifyDrawer /></>);
        step(() => { openNotifyDrawer(); });
        const version = document.getElementById('notifyVersionSection')!.textContent!;
        expect(version).toContain('⚠️');
        expect(version).not.toContain('✅');
        expect(document.getElementById('notifyFeedList')!.textContent).toContain('សួស្តី');
    });
});
