/**
 * ⛔ Push ខាង App ៖ `src/features/push.ts` · SW `push`/`notificationclick` · ផ្ទាំង 🔔។
 * ⛔ iPhone ទាមទារ `Notification.requestPermission()` ក្នុង **gesture ដដែល** ➜ វាត្រូវហៅ **មុន** `await` ណាមួយ (មុនទាញ config)។
 * ⛔ ស្ថានភាពត្រូវនិយាយការពិត ៖ Server គ្មាន VAPID = «server-off» (មិនមែន «បើករួច») · Key ត្រូវ Revoke = «no-license» ·
 *    APK គ្មាន google-services.json = «native-unconfigured» ហើយ **មិនផ្ទុក plugin** (FirebaseMessaging នឹងគាំង App)។
 * ⛔ កាលវិភាគផុតកំណត់ ៖ ពេលដែល `barcodeAbandonIsRipe()` ពិតប្រែជា `true` (± ១ នាទី) — គ្មានរូបមន្តព្រំដែនទី ២ ·
 *    ផ្ញើតែម៉ោង (គ្មានលេខទូរស័ព្ទ/barcode) · ទិដ្ឋភាពមិនស្រស់ ➜ មិនផ្ញើ (កុំអះអាង «០ កញ្ចប់»)។
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const pn = vi.hoisted(() => {
    const listeners: Record<string, (x: any) => void> = {};
    const api = {
        listeners,
        checkPermissions: vi.fn(async () => ({ receive: 'prompt' })),
        requestPermissions: vi.fn(async () => ({ receive: 'granted' })),
        createChannel: vi.fn(async () => {}),
        register: vi.fn(async () => {}),
        unregister: vi.fn(async () => {}),
        addListener: vi.fn(async (name: string, fn: (x: any) => void) => { listeners[name] = fn; return { remove: async () => {} }; })
    };
    return api;
});
vi.mock('@capacitor/push-notifications', () => ({ PushNotifications: pn }));

import { dataState, firebaseState, uiState } from '../src/core/state';
import { dbListenerPendingPaths, DB_LISTENER_KEY_HISTORY } from '../src/core/text';
import { barcodeAbandonIsRipe } from '../src/domain/barcode';
import { ABANDON_AGE_MS } from '../src/features/session';
import { abandonAtOf, expiryScheduleTimes, NOTIFY_SCHEDULE_HORIZON_MS } from '../src/features/notifications';
import {
    FCM_CHANNEL_ID, PUSH_STATE_KEY, PUSH_STATUS_TEXT, consumePushOpenRequest, disablePush, enablePush, handleServiceWorkerMessage,
    pushNativeBuild, pushRuntime, pushSupport, refreshPushStatus, syncExpirySchedule, ensureNativePushListeners
} from '../src/features/push';
import { closeSideDrawer } from '../src/ui/page-nav';
import { NotifyDrawer } from '../src/app/components/NotifyDrawer';
import { DrawerBackdrop } from '../src/app/components/DrawerBackdrop';
import { mount, step, unmount } from './native/react-harness';

const LICENSE = 'ZOEKEY-payload.signature';
const VAPID = 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4';
const order: string[] = [];
const posts: { op: string; body: any }[] = [];

function jsonResponse(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), { status });
}

function stubServer(opts: { config?: any; subscribe?: any; configStatus?: number } = {}) {
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: any = {}) => {
        const op = new URL(url, 'https://x.invalid/').searchParams.get('op') || '';
        order.push('fetch:' + op);
        if (op === 'config') return jsonResponse(opts.config || { vapidPublicKey: VAPID, web: true, fcm: true }, opts.configStatus || 200);
        const body = init.body ? JSON.parse(init.body) : null;
        posts.push({ op, body });
        if (op === 'subscribe' && opts.subscribe) return jsonResponse(opts.subscribe.body, opts.subscribe.status);
        return jsonResponse({ ok: true });
    }));
}

function stubWebPush(permission: string = 'granted', existing: any = null) {
    const sub = existing || {
        endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
        options: { applicationServerKey: null },
        toJSON() { return { endpoint: this.endpoint, keys: { p256dh: 'p256', auth: 'auth' } }; },
        unsubscribe: vi.fn(async () => true)
    };
    const pushManager = {
        current: existing,
        getSubscription: vi.fn(async () => pushManager.current),
        subscribe: vi.fn(async () => { pushManager.current = sub; return sub; })
    };
    const Notification: any = function () {};
    Notification.permission = 'default';
    Notification.requestPermission = vi.fn(() => { order.push('requestPermission'); Notification.permission = permission; return Promise.resolve(permission); });
    vi.stubGlobal('Notification', Notification);
    vi.stubGlobal('PushManager', function () {});
    Object.defineProperty(window.navigator, 'serviceWorker', { configurable: true, value: { ready: Promise.resolve({ pushManager }) } });
    return { sub, pushManager, Notification };
}

function setLicense(key: string | null) {
    (window as any).ZoeLicense = { activationKeyString: () => key || '' };
}

beforeEach(() => {
    order.length = 0;
    posts.length = 0;
    try { localStorage.clear(); } catch {}
    uiState.pushStatus = 'unknown';
    Object.assign(pushRuntime, { nativeListeners: false, nativeEnabling: false, scheduleAttemptAt: 0, scheduleInFlight: false });
    pushNativeBuild.fcm = true;
    setLicense(LICENSE);
    delete (window as any).Capacitor;
    Object.keys(pn.listeners).forEach((k) => delete pn.listeners[k]);
    firebaseState.isDatabaseInitialized = true;
    dbListenerPendingPaths.clear();
    dataState.scanHistory = [];
});

afterEach(() => {
    unmount();
    closeSideDrawer();
    delete (window as any).ZoeLicense;
    delete (window as any).Capacitor;
    delete (window.navigator as any).serviceWorker;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe('ការគាំទ្រ', () => {
    it('web ៖ មាន PushManager ➜ web · iPhone ក្នុង Safari (standalone=false · គ្មាន PushManager) ➜ ត្រូវដំឡើង · APK គ្មាន FCM ➜ native-unconfigured', () => {
        stubWebPush();
        expect(pushSupport()).toBe('web');
        vi.unstubAllGlobals();
        Object.defineProperty(window.navigator, 'standalone', { configurable: true, value: false });
        delete (window as any).PushManager;
        expect(pushSupport()).toBe('needs-install');
        delete (window.navigator as any).standalone;
        (window as any).Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android' };
        expect(pushSupport()).toBe('native');
        pushNativeBuild.fcm = false;
        expect(pushSupport()).toBe('native-unconfigured');
    });
});

describe('បើក/បិទ លើ web', () => {
    it('⛔ requestPermission មុន await ណាមួយ · subscribe ជាមួយ VAPID ពិត · ផ្ញើ license + endpoint + keys · ស្ថានភាព on', async () => {
        const w = stubWebPush('granted');
        stubServer();
        const p = enablePush();
        expect(order[0]).toBe('requestPermission');
        expect(await p).toBe(true);
        expect(uiState.pushStatus).toBe('on');
        const key = ((w.pushManager.subscribe.mock.calls[0] as any[])[0] as any).applicationServerKey as Uint8Array;
        expect(key.length).toBe(65);
        expect(key[0]).toBe(4);
        const sub = posts.find((x) => x.op === 'subscribe')!;
        expect(sub.body).toMatchObject({ license: LICENSE, sub: { kind: 'web', endpoint: w.sub.endpoint, keys: { p256dh: 'p256', auth: 'auth' } } });
        expect(JSON.parse(localStorage.getItem(PUSH_STATE_KEY)!).on).toBe(true);
    });

    it('គ្មាន Activation Key ➜ no-license មុនសុំសិទ្ធិ · បដិសេធ ➜ denied · server គ្មាន VAPID ➜ server-off', async () => {
        const w = stubWebPush('denied');
        stubServer();
        setLicense(null);
        expect(await enablePush()).toBe(false);
        expect(uiState.pushStatus).toBe('no-license');
        expect(w.Notification.requestPermission).not.toHaveBeenCalled();
        setLicense(LICENSE);
        expect(await enablePush()).toBe(false);
        expect(uiState.pushStatus).toBe('denied');
        stubWebPush('granted');
        stubServer({ config: { vapidPublicKey: '', web: false, fcm: false } });
        expect(await enablePush()).toBe(false);
        expect(uiState.pushStatus).toBe('server-off');
    });

    it('server បដិសេធ Key (Revoke) ➜ no-license · VAPID មិនទាន់កំណត់ពេល subscribe ➜ server-off · បណ្តាញដាច់ ➜ error', async () => {
        stubWebPush('granted');
        stubServer({ subscribe: { status: 403, body: { ok: false, reason: 'license:revoked' } } });
        await enablePush();
        expect(uiState.pushStatus).toBe('no-license');
        stubWebPush('granted');
        stubServer({ subscribe: { status: 503, body: { ok: false, reason: 'vapid:unset' } } });
        await enablePush();
        expect(uiState.pushStatus).toBe('server-off');
        stubWebPush('granted');
        vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
        await enablePush();
        expect(uiState.pushStatus).toBe('server-off');
        expect(JSON.parse(localStorage.getItem(PUSH_STATE_KEY) || '{"on":false}').on).toBe(false);
    });

    it('បិទ ➜ unsubscribe ទាំង browser និង server · ស្ថានភាព off', async () => {
        const w = stubWebPush('granted');
        stubServer();
        await enablePush();
        await disablePush();
        expect(w.sub.unsubscribe).toHaveBeenCalled();
        expect(posts.some((x) => x.op === 'unsubscribe' && x.body.sub.endpoint === w.sub.endpoint)).toBe(true);
        expect(uiState.pushStatus).toBe('off');
        expect(JSON.parse(localStorage.getItem(PUSH_STATE_KEY)!).on).toBe(false);
    });

    it('refreshPushStatus ៖ សិទ្ធិ denied ➜ denied · បើកពីមុន + granted ➜ on', () => {
        const w = stubWebPush('granted');
        w.Notification.permission = 'denied';
        refreshPushStatus();
        expect(uiState.pushStatus).toBe('denied');
        w.Notification.permission = 'granted';
        localStorage.setItem(PUSH_STATE_KEY, JSON.stringify({ on: true }));
        refreshPushStatus();
        expect(uiState.pushStatus).toBe('on');
    });
});

describe('APK (FCM)', () => {
    beforeEach(() => {
        (window as any).Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android' };
        pn.checkPermissions.mockClear();
        pn.requestPermissions.mockClear();
        pn.createChannel.mockClear();
        pn.register.mockClear();
    });

    it('សុំសិទ្ធិ ➜ channel (importance ខ្ពស់ = លោតលើអេក្រង់) ➜ register ➜ token ➜ subscribe fcm ➜ on', async () => {
        stubServer();
        expect(await enablePush()).toBe(true);
        expect(pn.requestPermissions).toHaveBeenCalled();
        expect((pn.createChannel.mock.calls[0] as any[])[0]).toMatchObject({ id: FCM_CHANNEL_ID, importance: 5 });
        expect(pn.register).toHaveBeenCalled();
        expect(uiState.pushStatus).toBe('busy');
        await pn.listeners.registration({ value: 'fcmToken:' + 'x'.repeat(40) });
        await vi.waitFor(() => expect(uiState.pushStatus).toBe('on'));
        expect(posts.find((x) => x.op === 'subscribe')!.body).toMatchObject({ platform: 'android', sub: { kind: 'fcm', token: 'fcmToken:' + 'x'.repeat(40) } });
    });

    it('ចុចលើការជូនដំណឹង ➜ បើកផ្ទាំង 🔔 · push ពេល App បើក ➜ ទាញដំណឹងភ្លាម', async () => {
        stubServer();
        (window as any).ZoeLicense.announcementsUrl = () => 'https://zoew-z1-default-rtdb.firebaseio.com/license_announcements/ZOE.json';
        await ensureNativePushListeners();
        pn.listeners.pushNotificationActionPerformed({});
        expect(uiState.notifyDrawerOpen).toBe(true);
        const before = (globalThis.fetch as any).mock.calls.length;
        uiState.notifyFeedInFlight = false;
        pn.listeners.pushNotificationReceived({});
        expect((globalThis.fetch as any).mock.calls.length).toBeGreaterThan(before);
    });

    it('⛔ APK គ្មាន google-services.json ➜ មិនផ្ទុក/មិន register plugin (បើអត់ App គាំង)', async () => {
        pushNativeBuild.fcm = false;
        stubServer();
        expect(await enablePush()).toBe(false);
        expect(uiState.pushStatus).toBe('native-unconfigured');
        expect(pn.register).not.toHaveBeenCalled();
        await ensureNativePushListeners();
        expect(pn.addListener).not.toHaveBeenCalledWith('registration', expect.anything());
    });

    it('បដិសេធសិទ្ធិ ➜ denied មិន register', async () => {
        pn.requestPermissions.mockResolvedValueOnce({ receive: 'denied' });
        stubServer();
        expect(await enablePush()).toBe(false);
        expect(uiState.pushStatus).toBe('denied');
        expect(pn.register).not.toHaveBeenCalled();
    });
});

describe('កាលវិភាគផុតកំណត់ (ផ្ញើទៅ server)', () => {
    const NOW = Date.UTC(2026, 8, 29, 1, 0, 0);

    it('⛔ abandonAtOf = នាទីដំបូងដែល barcodeAbandonIsRipe() ពិត (± ១ នាទី) · barcode បិទ/ហួស/ឆ្ងាយ ➜ -1', () => {
        const b = { code: 'B', isClosed: false };
        const parentAt = NOW - ABANDON_AGE_MS + 5 * 3600e3 + 123;
        const at = abandonAtOf(b, parentAt, NOW, NOTIFY_SCHEDULE_HORIZON_MS);
        expect(barcodeAbandonIsRipe(b, parentAt, at)).toBe(true);
        expect(barcodeAbandonIsRipe(b, parentAt, at - 60000)).toBe(false);
        const restored = { code: 'R', isClosed: false, restoredAt: NOW - 3600e3 };
        const rAt = abandonAtOf(restored, NOW - ABANDON_AGE_MS * 2, NOW, NOTIFY_SCHEDULE_HORIZON_MS);
        expect(barcodeAbandonIsRipe(restored, NOW - ABANDON_AGE_MS * 2, rAt)).toBe(true);
        expect(barcodeAbandonIsRipe(restored, NOW - ABANDON_AGE_MS * 2, rAt - 60000)).toBe(false);
        expect(abandonAtOf({ code: 'C', isClosed: true }, parentAt, NOW, NOTIFY_SCHEDULE_HORIZON_MS)).toBe(-1);
        expect(abandonAtOf(b, NOW - ABANDON_AGE_MS - 1, NOW, NOTIFY_SCHEDULE_HORIZON_MS)).toBe(-1);
        expect(abandonAtOf(b, NOW + NOTIFY_SCHEDULE_HORIZON_MS, NOW, NOTIFY_SCHEDULE_HORIZON_MS)).toBe(-1);
        expect(abandonAtOf(b, parentAt, NOW, Infinity)).toBe(-1);
        expect(abandonAtOf(b, parentAt, NaN, NOTIFY_SCHEDULE_HORIZON_MS)).toBe(-1);
        expect(abandonAtOf(b, parentAt, NOW, -1)).toBe(-1);
    });

    it('ផ្ញើតែម៉ោង (គ្មានលេខទូរស័ព្ទ/barcode) · រំលងជួរដេកបិទ/កំពុង Clear · ទិដ្ឋភាពមិនស្រស់ ➜ មិនផ្ញើ · មិនប្រែ ➜ មិនផ្ញើម្តងទៀត', async () => {
        const now = Date.now();
        dataState.scanHistory = [
            { id: 'A', phone: '012345678', createdAt: now - ABANDON_AGE_MS + 3600e3, barcodes: [{ code: 'SECRETCODE1', isClosed: false }, { code: 'X', isClosed: true }] },
            { id: 'B', phone: '099', createdAt: now - ABANDON_AGE_MS + 7200e3, barcodes: [{ code: 'Y', isClosed: false }], clearClaim: { token: 't' } },
            { id: 'C', phone: '088', createdAt: now - ABANDON_AGE_MS + 7200e3, isClosed: true, barcodes: [{ code: 'Z', isClosed: false }] }
        ] as any;
        localStorage.setItem(PUSH_STATE_KEY, JSON.stringify({ on: true }));
        stubServer();
        dbListenerPendingPaths.add(DB_LISTENER_KEY_HISTORY);
        expect(await syncExpirySchedule(true)).toBe(false);
        dbListenerPendingPaths.clear();
        expect(await syncExpirySchedule(true)).toBe(true);
        const sent = posts.find((x) => x.op === 'schedule')!;
        expect(sent.body.times).toHaveLength(1);
        const t = sent.body.times[0];
        const parentA = (dataState.scanHistory[0] as any).createdAt;
        expect(barcodeAbandonIsRipe({ code: 'x', isClosed: false }, parentA, t)).toBe(true);
        expect(barcodeAbandonIsRipe({ code: 'x', isClosed: false }, parentA, t - 60000)).toBe(false);
        expect(Math.abs(expiryScheduleTimes(dataState.scanHistory, now)[0] - t)).toBeLessThanOrEqual(60000);
        const raw = JSON.stringify(sent.body);
        expect(raw).not.toContain('012345678');
        expect(raw).not.toContain('SECRETCODE1');
        expect(await syncExpirySchedule(true)).toBe(true);
        posts.length = 0;
        expect(await syncExpirySchedule()).toBe(false);
        expect(posts).toHaveLength(0);
    });

    it('push បិទ ➜ មិនផ្ញើកាលវិភាគ', async () => {
        stubServer();
        expect(await syncExpirySchedule(true)).toBe(false);
        expect(posts).toHaveLength(0);
    });
});

describe('ការបើកពីការជូនដំណឹង', () => {
    it('?notify=1 ➜ បើកផ្ទាំង 🔔 ហើយលុប param តែមួយនោះ (param ផ្សេងនៅដដែល)', () => {
        vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ items: [] })));
        history.replaceState(null, '', '/app/?notify=1&keep=1#h');
        expect(consumePushOpenRequest()).toBe(true);
        expect(uiState.notifyDrawerOpen).toBe(true);
        expect(window.location.search).toBe('?keep=1');
        expect(window.location.hash).toBe('#h');
        closeSideDrawer();
        expect(consumePushOpenRequest()).toBe(false);
        expect(uiState.notifyDrawerOpen).toBe(false);
    });

    it('សារពី SW ៖ zoew-open-notify ➜ បើកផ្ទាំង · zoew-push ➜ ទាញដំណឹង · សារផ្សេង ➜ មិនធ្វើអ្វី', () => {
        const fetch = vi.fn(async () => jsonResponse({ items: [] }));
        vi.stubGlobal('fetch', fetch);
        handleServiceWorkerMessage({ type: 'nope' });
        handleServiceWorkerMessage(null);
        expect(uiState.notifyDrawerOpen).toBe(false);
        handleServiceWorkerMessage({ type: 'zoew-open-notify' });
        expect(uiState.notifyDrawerOpen).toBe(true);
        closeSideDrawer();
        uiState.notifyFeedInFlight = false;
        const before = fetch.mock.calls.length;
        handleServiceWorkerMessage({ type: 'zoew-push' });
        expect(fetch.mock.calls.length).toBeGreaterThan(before);
    });
});

describe('ផ្ទាំង 🔔 ៖ ផ្នែក «ជូនដំណឹងលើទូរស័ព្ទ»', () => {
    it('off ➜ ប៊ូតុងបើក · on ➜ ប៊ូតុងបិទ · needs-install ➜ ការណែនាំ iPhone គ្មានប៊ូតុង', () => {
        vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ items: [] })));
        uiState.pushStatus = 'off';
        mount(<><DrawerBackdrop /><NotifyDrawer /></>);
        expect(document.getElementById('notifyPushBtn')!.textContent).toContain('បើក');
        step(() => { uiState.pushStatus = 'on'; });
        expect(document.getElementById('notifyPushBtn')!.textContent).toContain('បិទ');
        expect(document.getElementById('notifyPushStatus')!.textContent).toBe(PUSH_STATUS_TEXT.on);
        step(() => { uiState.pushStatus = 'needs-install'; });
        expect(document.getElementById('notifyPushBtn')).toBeNull();
        expect(document.getElementById('notifyPushStatus')!.textContent).toContain('Add to Home Screen');
        const icon = (document.querySelector('#notifyPushSection .notify-section-title')!.textContent || '').trim().split(' ')[0];
        for (const text of Object.values(PUSH_STATUS_TEXT)) expect(text.startsWith(icon), text).toBe(false);
    });
});

describe('Service Worker ៖ push · notificationclick', () => {
    function sw() {
        const source = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'sw', 'sw.ts'), 'utf8');
        const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.None } }).outputText;
        const handlers: Record<string, (e: any) => void> = {};
        const shown: any[] = [];
        const clients: any[] = [];
        const opened: string[] = [];
        let badge = 0;
        const worker: any = {
            location: new URL('https://zoew.netlify.app/sw.js'),
            registration: { scope: 'https://zoew.netlify.app/', showNotification: async (t: string, o: any) => { shown.push({ title: t, options: o }); } },
            clients: { matchAll: async () => clients, openWindow: async (u: string) => { opened.push(u); return null; } },
            navigator: { setAppBadge: async () => { badge++; } },
            addEventListener: (name: string, fn: (e: any) => void) => { handlers[name] = fn; }
        };
        const context = vm.createContext({
            __CACHE_VERSION__: 'zoew-probe-v1', __CORE_SHELL__: ['./index.html'], __OPTIONAL_SHELL__: [],
            self: worker, navigator: { onLine: true }, URL, Request, Response, AbortController, fetch: () => Promise.reject(new Error('x')), setTimeout, clearTimeout, Date, Promise
        });
        vm.runInContext(js, context);
        return { handlers, shown, clients, opened, badge: () => badge };
    }

    async function fire(h: any, name: string, event: any) {
        let waited: Promise<unknown> = Promise.resolve();
        h.handlers[name](Object.assign({ waitUntil: (p: Promise<unknown>) => { waited = p; } }, event));
        await waited;
    }

    it('push ➜ បង្ហាញជានិច្ច (userVisibleOnly) ជាមួយ icon · tag · URL ក្នុង origin · badge · ប្រាប់ App ដែលបើក', async () => {
        const h = sw();
        const client = { url: 'https://zoew.netlify.app/', postMessage: vi.fn(), focus: vi.fn(async () => client) };
        h.clients.push(client);
        await fire(h, 'push', { data: { json: () => ({ title: '📢 សួស្តី', body: 'ខ្លឹមសារ', tag: 'notice-n1', url: './?notify=1' }) } });
        expect(h.shown[0].title).toBe('📢 សួស្តី');
        expect(h.shown[0].options).toMatchObject({ body: 'ខ្លឹមសារ', tag: 'notice-n1', icon: './icon-192.png', renotify: true });
        expect(h.shown[0].options.data.url).toBe('https://zoew.netlify.app/?notify=1');
        expect(h.badge()).toBe(1);
        expect(client.postMessage).toHaveBeenCalledWith({ type: 'zoew-push' });
        await fire(h, 'push', { data: { json: () => { throw new Error('bad'); } } });
        expect(h.shown[1].title).toBe('ZoeW');
        await fire(h, 'push', { data: { json: () => ({ title: 'x', url: 'https://evil.com/phish' }) } });
        expect(h.shown[2].options.data.url).toBe('https://zoew.netlify.app/?notify=1');
    });

    it('notificationclick ➜ មាន App បើក ➜ focus + បើកផ្ទាំង · គ្មាន ➜ openWindow ?notify=1', async () => {
        const h = sw();
        const close = vi.fn();
        await fire(h, 'notificationclick', { notification: { close, data: { url: 'https://zoew.netlify.app/?notify=1' } } });
        expect(close).toHaveBeenCalled();
        expect(h.opened).toEqual(['https://zoew.netlify.app/?notify=1']);
        const client = { url: 'https://zoew.netlify.app/index.html', postMessage: vi.fn(), focus: vi.fn(async () => client) };
        h.clients.push(client);
        await fire(h, 'notificationclick', { notification: { close, data: {} } });
        expect(client.postMessage).toHaveBeenCalledWith({ type: 'zoew-open-notify' });
        expect(client.focus).toHaveBeenCalled();
        expect(h.opened).toHaveLength(1);
    });
});
