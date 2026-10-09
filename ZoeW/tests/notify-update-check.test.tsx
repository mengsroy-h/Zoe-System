/**
 * ⛔ សំណើម្ចាស់គម្រោង ៖ «ថែមប៊ូតុង check for update នៅកន្លែងទាញយកក្នុងជូនដំណឹង»។ មុននេះ App ពិនិត្យកំណែថ្មីតែពេលបើក 🔔 ហើយ APK ដែល
 *    Release មិនទាន់មាន («⏳ មិនទាន់មានលើ GitHub Release») ពិនិត្យម្តងទៀតតែក្រោយ `APK_RELEASE_RECHECK_MS` ➜ អ្នកប្រើគ្មានវិធីសួរភ្លាម។
 * ⛔ ច្បាប់ ៖ ប៊ូតុង «🔄 ពិនិត្យកំណែថ្មី» ក្នុង «📱 កំណែ App» ➜ ទាញ feed កំណែភ្លាម (userAsked) · APK ៖ សួរ GitHub Release ម្តងទៀតមិនរង់ចាំគម្លាត
 *    (`checkApkRelease(…, true)`) · PWA ៖ `registration.update()` (Service Worker ថ្មីចូល ➜ «Refresh ឥឡូវនេះ») · កំពុងពិនិត្យ ➜ ប៊ូតុងបិទ ·
 *    ពិនិត្យមិនបាន ➜ សារ ⚠️ · មានកំណែថ្មីទាញរួច (updateReady) ➜ គ្មានប៊ូតុង (Refresh ជំនួស)។
 */
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => {
    const state = { calls: [] as Array<[string, any]>, probe: null as null | ((v: string) => Promise<any>) };
    const api: any = {
        probe: async (opts: any) => { state.calls.push(['probe', opts]); return state.probe ? state.probe(opts.version) : { available: false }; },
        addListener: async () => ({ remove: async () => {} }),
        download: () => new Promise(() => {}),
        install: async () => ({ status: 'opened' }),
        cancel: async () => {}
    };
    return { state, api };
});

vi.mock('@capacitor/core', async (orig) => ({
    ...(await orig<any>()),
    registerPlugin: (name: string) => new Proxy(h.api, {
        get(target, prop) {
            if (prop === '$$typeof') return undefined;
            if (prop === 'toJSON') return () => ({});
            if (typeof prop === 'string' && prop in target) return target[prop];
            return () => Promise.reject(new Error('"' + name + '.' + String(prop) + '()" is not implemented on android'));
        }
    })
}));

import { uiState } from '../src/core/state';
import { APP_VERSION } from '../src/core/version';
import { ACTION_REGISTRY } from '../src/core/action-registry';
import { ACTION_ALLOWLIST } from '../src/core/runtime';
import { checkForAppUpdate } from '../src/features/notifications';
import { NotifyDrawer } from '../src/app/components/NotifyDrawer';
import { mount, step, unmount } from './native/react-harness';

const [a, b, c] = APP_VERSION.split('.').map(Number);
const NEWER = a + '.' + b + '.' + (c + 1);
const feedBody = (version: string) => JSON.stringify({ items: [{ id: 'u-' + version, kind: 'update', version, title: 't', body: 'b', date: '2026-10-08', points: [] }] });
const btn = () => document.getElementById('notifyCheckUpdateBtn') as HTMLButtonElement | null;
const calls = (name: string) => h.state.calls.filter(([n]) => n === name);
const flush = async () => {
    for (let round = 0; round < 4; round++) {
        await vi.dynamicImportSettled();
        for (let i = 0; i < 10; i++) await Promise.resolve();
    }
    step(() => {});
};

function asApk() {
    vi.stubEnv('VITE_NATIVE_WEB_ORIGIN', 'https://zoew.netlify.app');
    (window as any).androidBridge = { postMessage() {} };
    (window as any).Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android' };
}

let feed: string | null = null;

beforeEach(() => {
    h.state.calls.length = 0;
    h.state.probe = null;
    feed = feedBody(APP_VERSION);
    vi.stubGlobal('fetch', vi.fn(async (url: any) => {
        if (String(url).includes('announcements.json') && feed !== null) return new Response(feed, { status: 200, headers: { 'Content-Type': 'application/json' } });
        if (String(url).includes('announcements.json')) throw new TypeError('Failed to fetch');
        return new Response('null', { status: 200 });
    }));
    step(() => {
        uiState.notifyFeed = [];
        uiState.notifySellerFeed = [];
        uiState.notifyFeedInFlight = false;
        uiState.notifyFeedFetchedAt = 0;
        uiState.updateReady = false;
        (uiState as any).appUpdateCheck = { phase: 'idle', at: 0 };
        (uiState as any).apkRelease = { version: '', state: 'idle', checkedAt: 0 };
        (uiState as any).apkUpdate = { phase: 'idle', version: '', received: 0, total: 0, error: '' };
    });
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    unmount();
    document.body.innerHTML = '';
    delete (window as any).Capacitor;
    delete (window as any).androidBridge;
    delete (navigator as any).serviceWorker;
});

describe('🔔 «🔄 ពិនិត្យកំណែថ្មី»', () => {
    it('⛔ ខ្សែភ្ជាប់ ៖ ប៊ូតុងក្នុង «📱 កំណែ App» · សកម្មភាពក្នុង ACTION_REGISTRY និង ACTION_ALLOWLIST', () => {
        mount(<NotifyDrawer />);
        expect(document.querySelector('#notifyVersionSection #notifyCheckUpdateBtn')).not.toBe(null);
        expect(typeof ACTION_REGISTRY.checkForAppUpdate).toBe('function');
        expect(ACTION_ALLOWLIST).toContain('checkForAppUpdate');
    });

    it('⛔ APK ៖ Release «មិនទាន់មាន» ទើបពិនិត្យ ➜ ចុច ➜ សួរ GitHub ម្តងទៀតភ្លាម (មិនរង់ចាំគម្លាត) ➜ មាន ➜ ប៊ូតុងទាញយក', async () => {
        asApk();
        feed = feedBody(NEWER);
        step(() => { (uiState as any).apkRelease = { version: NEWER, state: 'absent', checkedAt: Date.now() }; });
        h.state.probe = async () => ({ available: true });
        mount(<NotifyDrawer />);
        expect(document.getElementById('notifyApkBtn')).toBe(null);
        step(() => { btn()!.click(); });
        await vi.waitFor(() => { expect(calls('probe').length).toBe(1); }, { timeout: 5000 });
        await vi.waitFor(() => { expect((uiState as any).appUpdateCheck.phase).toBe('done'); }, { timeout: 5000 });
        await flush();
        expect(calls('probe')).toEqual([['probe', { version: NEWER }]]);
        expect(document.getElementById('notifyApkBtn')).not.toBe(null);
    });

    it('⛔ PWA ៖ ចុច ➜ registration.update() + ទាញ feed · ចប់ ➜ ប៊ូតុងបើកវិញ', async () => {
        const update = vi.fn(async () => undefined);
        const getRegistration = vi.fn(async () => ({ update }));
        Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { getRegistration } });
        mount(<NotifyDrawer />);
        step(() => { btn()!.click(); });
        await flush();
        await vi.waitFor(() => { expect((uiState as any).appUpdateCheck.phase).toBe('done'); }, { timeout: 5000 });
        await flush();
        expect(getRegistration).toHaveBeenCalledWith('./');
        expect(update).toHaveBeenCalledTimes(1);
        expect((fetch as any).mock.calls.some(([u]: any[]) => String(u).includes('announcements.json'))).toBe(true);
        expect(btn()!.disabled).toBe(false);
        expect(document.getElementById('notifyVersionSection')!.textContent).toContain('កំណែចុងក្រោយ');
    });

    it('កំពុងពិនិត្យ ➜ ប៊ូតុងបិទ · ចុចម្តងទៀតមិនចាប់ផ្តើមជុំទីពីរ', async () => {
        let release: () => void = () => {};
        vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => { release = () => resolve(new Response(feedBody(APP_VERSION), { status: 200 })); })));
        mount(<NotifyDrawer />);
        step(() => { btn()!.click(); });
        await flush();
        expect(btn()!.disabled).toBe(true);
        expect(btn()!.textContent).toContain('កំពុងពិនិត្យ');
        const again = checkForAppUpdate();
        release();
        await again;
        await vi.waitFor(() => { expect((uiState as any).appUpdateCheck.phase).toBe('done'); }, { timeout: 5000 });
        expect((fetch as any).mock.calls.filter(([u]: any[]) => String(u).includes('announcements.json')).length).toBe(1);
    });

    it('ពិនិត្យមិនបាន (បណ្តាញ) ➜ សារ ⚠️ · ប៊ូតុងនៅប្រើបាន', async () => {
        feed = null;
        mount(<NotifyDrawer />);
        step(() => { btn()!.click(); });
        await vi.waitFor(() => { expect((uiState as any).appUpdateCheck.phase).toBe('failed'); }, { timeout: 5000 });
        await flush();
        expect(document.getElementById('notifyUpdateCheckStatus')).not.toBe(null);
        expect(btn()!.disabled).toBe(false);
    });

    it('⛔ feed កំណែទាញមិនបាន តែដំណឹងអ្នកលក់ឆ្លើយ ➜ ⚠️ (✅ ចាស់ពី cache មិនមែនការវាស់ក្នុងការពិនិត្យនេះ)', async () => {
        feed = null;
        (window as any).ZoeLicense = { announcementsUrl: () => 'https://license.invalid/license_announcements/ZOE.json' };
        try {
            mount(<NotifyDrawer />);
            step(() => { btn()!.click(); });
            await vi.waitFor(() => { expect((uiState as any).appUpdateCheck.phase).not.toBe('checking'); }, { timeout: 5000 });
            await flush();
            expect((fetch as any).mock.calls.some(([u]: any[]) => String(u).includes('license_announcements'))).toBe(true);
            expect((uiState as any).appUpdateCheck.phase).toBe('failed');
            expect(document.getElementById('notifyUpdateCheckStatus')).not.toBe(null);
        } finally {
            delete (window as any).ZoeLicense;
        }
    });

    it('⚠️ ពិនិត្យមិនបាន ➜ feed កំណែទាញបានពេលក្រោយ (បើក 🔔) ➜ ⚠️ បាត់', async () => {
        feed = null;
        mount(<NotifyDrawer />);
        step(() => { btn()!.click(); });
        await vi.waitFor(() => { expect((uiState as any).appUpdateCheck.phase).toBe('failed'); }, { timeout: 5000 });
        await flush();
        expect(document.getElementById('notifyUpdateCheckStatus')).not.toBe(null);
        feed = feedBody(APP_VERSION);
        const { fetchNotifyFeed } = await import('../src/features/notifications');
        await fetchNotifyFeed(true);
        await flush();
        expect(document.getElementById('notifyUpdateCheckStatus')).toBe(null);
        expect(document.getElementById('notifyVersionSection')!.textContent).toContain('កំណែចុងក្រោយ');
    });

    it('ទិសផ្ទុយ ៖ កំណែថ្មីទាញរួច (updateReady) ➜ គ្មានប៊ូតុង (Refresh ឥឡូវនេះជំនួស)', () => {
        step(() => { uiState.updateReady = true; });
        mount(<NotifyDrawer />);
        expect(btn()).toBe(null);
    });

    it('⛔ CSS ៖ ប៊ូតុងមាន style ផ្ទាល់ (មិនមែនប៊ូតុងទាញយកពណ៌ដដែល)', () => {
        const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'styles', 'react-root.css'), 'utf8');
        expect(css).toMatch(/\.notify-check-btn \{[^}]*width: 100%/);
    });
});
