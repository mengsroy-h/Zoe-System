/**
 * ⛔ សំណើម្ចាស់គម្រោង ៖ App Android (APK) មិនទាញកំណែថ្មីដោយខ្លួនឯងទេ (web bundle នៅក្នុង APK) ➜ ពេល feed ប្រាប់កំណែថ្មីជាង `APP_VERSION`
 *    ផ្ទាំង 🔔 «📱 កំណែ App» ទាញយក APK កំណែនោះពី GitHub Release **ក្នុង App** (plugin native `ZoeApkUpdate`) ហើយបើកផ្ទាំងដំឡើងរបស់ Android។
 *    link ចាស់ (`<a target=_blank>`) បើក browser ក្រៅ ➜ ទាញចប់ តែគ្មានអ្វីលោតឲ្យដំឡើង (រាយការណ៍ម្ចាស់គម្រោង)។
 * ⛔ ប៊ូតុងទាញយកបង្ហាញ **តែពេល Release ពិតមាន APK** (`probe` ➜ GitHub ឆ្លើយ redirect ទៅឯកសារ) ៖ feed អាចប្រាប់កំណែដែល Release
 *    មិនទាន់ចេញ · build ធ្លាក់ · ឬម្ចាស់គម្រោងលុបចោល (`zoew-android-v2.50.41` ➜ 404)។ កំពុងពិនិត្យ · គ្មាន · ពិនិត្យមិនបាន ➜ គ្មានប៊ូតុង។
 * ⛔ URL ដេរីវេពី workflow ពិត (`.github/workflows/android-release.yml` ៖ ស្លាក `zoew-android-v<កំណែ>` · ឯកសារ `ZoeW-<កំណែ>.apk` លើ `main`)
 *    ហើយ plugin Java សាងវាពីកំណែតែមួយ ➜ ការប្តូរឈ្មោះមួយខាងធ្វើឲ្យតេស្តនេះក្រហម (ថ្នេររវាង ២ ឯកសារ)។
 * ⛔ plugin របស់ Capacitor ជា Proxy thenable ➜ mock ចម្លងឥរិយាបថនោះ (promise ដែល resolve ទៅ plugin ផ្ទាល់មិនដែល settle)។
 * ⛔ រាល់ពេលចេញពី App (Settings «ដំឡើង App មិនស្គាល់» · ផ្ទាំងដំឡើង) ត្រូវមាន `noteAppLockExcuse()` មុន ➜ ត្រឡប់មកមិនសុំ PIN។
 * ⛔ ការទាញយកដែលឈប់រីក (គ្មាន progress `APK_DOWNLOAD_STALL_MS`) ➜ បោះបង់ + សារ ➜ ប៊ូតុងមិនជាប់ «កំពុងទាញ» ជារៀងរហូត។
 */
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => {
    const state = {
        order: [] as string[],
        registered: [] as string[],
        listeners: {} as Record<string, (e: any) => void>,
        probe: null as null | ((v: string) => Promise<any>),
        download: null as null | { resolve: (v: any) => void; reject: (e: any) => void },
        installAnswers: [] as any[],
        calls: [] as Array<[string, any]>
    };
    const api: any = {
        probe: async (opts: any) => { state.calls.push(['probe', opts]); return state.probe ? state.probe(opts.version) : { available: false }; },
        addListener: async (name: string, fn: (e: any) => void) => {
            state.calls.push(['addListener', name]);
            state.listeners[name] = fn;
            return { remove: async () => { if (state.listeners[name] === fn) delete state.listeners[name]; } };
        },
        download: (opts: any) => {
            state.calls.push(['download', opts]);
            return new Promise((resolve, reject) => { state.download = { resolve, reject }; });
        },
        install: async (opts: any) => {
            state.calls.push(['install', opts]);
            state.order.push('install');
            const a = state.installAnswers.shift();
            if (a instanceof Error) throw a;
            return a || { status: 'opened' };
        },
        cancel: async () => {
            state.calls.push(['cancel', {}]);
            if (state.download) state.download.reject(Object.assign(new Error('cancelled'), { code: 'cancelled' }));
        }
    };
    return { state, api };
});

vi.mock('@capacitor/core', async (orig) => ({
    ...(await orig<any>()),
    registerPlugin: (name: string) => {
        h.state.registered.push(name);
        return new Proxy(h.api, {
            get(target, prop) {
                if (prop === '$$typeof') return undefined;
                if (prop === 'toJSON') return () => ({});
                if (typeof prop === 'string' && prop in target) return target[prop];
                return () => Promise.reject(new Error('"' + name + '.' + String(prop) + '()" is not implemented on android'));
            }
        });
    }
}));

vi.mock('../src/features/app-lock', async (orig) => ({ ...(await orig<any>()), noteAppLockExcuse: () => { h.state.order.push('excuse'); } }));

import { uiState } from '../src/core/state';
import { APP_VERSION } from '../src/core/version';
import * as apkUpdate from '../src/features/apk-update';
import { openNotifyDrawer } from '../src/features/notifications';
import { NotifyDrawer } from '../src/app/components/NotifyDrawer';
import { mount, step, unmount } from './native/react-harness';

const ROOT = path.join(__dirname, '..', '..');
const WORKFLOW = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'android-release.yml'), 'utf8');
const JAVA_FILE = path.join(ROOT, 'ZoeW', 'android', 'app', 'src', 'main', 'java', 'com', 'zoesystem', 'zoew', 'ApkUpdatePlugin.java');
const JAVA = fs.existsSync(JAVA_FILE) ? fs.readFileSync(JAVA_FILE, 'utf8') : '';
const STALL_MS: number = (apkUpdate as any).APK_DOWNLOAD_STALL_MS || 45000;
const RECHECK_MS: number = (apkUpdate as any).APK_RELEASE_RECHECK_MS || 300000;

function releaseUrlFromWorkflow(version: string) {
    const main = WORKFLOW.slice(WORKFLOW.indexOf('refs/heads/main'), WORKFLOW.indexOf('else', WORKFLOW.indexOf('refs/heads/main')));
    const tag = (/TAG="([^"]+)"/.exec(main) || [])[1];
    const file = (/FILE="([^"]+)"/.exec(main) || [])[1];
    expect(tag && file).toBeTruthy();
    const sub = (t: string) => t.replace(/\$\{VERSION\}/g, version);
    return 'https://github.com/mengsroy-h/Zoe-System/releases/download/' + sub(tag!) + '/' + sub(file!);
}

function javaConst(name: string) {
    return (new RegExp('static final String ' + name + ' = "([^"]*)";').exec(JAVA) || [])[1];
}

function javaReleaseUrl(version: string) {
    const body = (/static String releaseUrl\(String version\) \{\s*return ([^;]+);/.exec(JAVA) || [])[1] || '';
    const piece = (part: string) => {
        const literal = /^"([^"]*)"$/.exec(part);
        if (literal) return literal[1];
        return part === 'version' ? version : javaConst(part) ?? '\u0000' + part;
    };
    return body.split('+').map((part) => piece(part.trim())).join('');
}

const [a, b, c] = APP_VERSION.split('.').map(Number);
const NEWER = a + '.' + b + '.' + (c + 1);
const flush = async () => {
    for (let round = 0; round < 3; round++) {
        await vi.dynamicImportSettled();
        for (let i = 0; i < 8; i++) await Promise.resolve();
    }
    step(() => {});
};
const btn = () => document.getElementById('notifyApkBtn') as HTMLButtonElement | null;
const oldLink = () => document.querySelector('#notifyVersionSection a.notify-apk-link');
const versionText = () => (document.getElementById('notifyVersionSection')?.textContent || '');
const calls = (name: string) => h.state.calls.filter(([n]) => n === name);
const deferred = () => {
    let resolve: (v: any) => void = () => {};
    const p = new Promise((r) => { resolve = r; });
    return { p, resolve };
};

function asApk() {
    (window as any).androidBridge = { postMessage() {} };
    (window as any).Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android' };
}

function feedWith(version: string) {
    step(() => { uiState.notifyFeed = [{ id: version, kind: 'update', version: version, title: 't', body: 'b', date: '2026-10-08', points: [] }] as any; });
}

async function openWithRelease(available: boolean | 'fail') {
    h.state.probe = async () => {
        if (available === 'fail') throw Object.assign(new Error('network'), { code: 'network' });
        return { available };
    };
    asApk();
    feedWith(NEWER);
    mount(<NotifyDrawer />);
    step(() => { openNotifyDrawer(); });
    await vi.waitFor(() => { expect(calls('probe').length).toBeGreaterThan(0); }, { timeout: 5000 });
    await flush();
}

async function startDownload() {
    await openWithRelease(true);
    expect(btn()).not.toBe(null);
    step(() => { btn()!.click(); });
    await flush();
    expect(calls('download')).toEqual([['download', { version: NEWER }]]);
}

beforeEach(() => {
    h.state.order.length = 0;
    h.state.calls.length = 0;
    h.state.listeners = {};
    h.state.probe = null;
    h.state.download = null;
    h.state.installAnswers = [];
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 })));
    step(() => {
        uiState.notifyFeed = [];
        uiState.notifySellerFeed = [];
        uiState.updateReady = false;
        uiState.notifyDrawerOpen = false;
        (uiState as any).apkRelease = { version: '', state: 'idle', checkedAt: 0 };
        (uiState as any).apkUpdate = { phase: 'idle', version: '', received: 0, total: 0, error: '' };
    });
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    unmount();
    document.body.innerHTML = '';
    delete (window as any).Capacitor;
    delete (window as any).androidBridge;
});

describe('🔔 កំណែ App ៖ ទាញយក APK ក្នុង App · តែពេល Release ពិតមាន', () => {
    it('⛔ URL ដែល plugin Java សាង = ស្លាក + ឈ្មោះឯកសារដែល workflow Release ពិតបង្កើត · plugin ឈ្មោះ ZoeApkUpdate', () => {
        expect(JAVA.length).toBeGreaterThan(500);
        expect(javaReleaseUrl('2.50.99')).toBe(releaseUrlFromWorkflow('2.50.99'));
        expect(JAVA).toMatch(/@CapacitorPlugin\(name = "ZoeApkUpdate"\)/);
        expect((apkUpdate as any).APK_PLUGIN_NAME).toBe('ZoeApkUpdate');
    });

    it('⛔ JS ហៅតែ method ដែល Java មាន `@PluginMethod` ពិត', () => {
        const javaMethods = new Set([...JAVA.matchAll(/@PluginMethod\s+public void (\w+)\(PluginCall call\)/g)].map((m) => m[1]));
        const src = fs.readFileSync(path.join(ROOT, 'ZoeW', 'src', 'features', 'apk-update.ts'), 'utf8');
        const used = new Set([...src.matchAll(/\bAU\.(\w+)\(/g)].map((m) => m[1]).filter((m) => m !== 'addListener'));
        expect(used.size).toBeGreaterThanOrEqual(4);
        for (const m of used) expect(javaMethods.has(m), 'Java @PluginMethod ' + m).toBe(true);
    });

    it('⛔ Release មិនមាន APK (លុបចោល · មិនទាន់ចេញ) ➜ គ្មានប៊ូតុងទាញយក · ប្រាប់ថាមិនទាន់មាន', async () => {
        await openWithRelease(false);
        expect(calls('probe')).toEqual([['probe', { version: NEWER }]]);
        expect(btn()).toBe(null);
        expect(oldLink()).toBe(null);
        expect(versionText()).toContain('មិនទាន់មានលើ GitHub Release');
    });

    it('⛔ កំពុងពិនិត្យ Release ➜ គ្មានប៊ូតុង', async () => {
        const gate = deferred();
        h.state.probe = () => gate.p.then(() => ({ available: true }));
        asApk();
        feedWith(NEWER);
        mount(<NotifyDrawer />);
        step(() => { openNotifyDrawer(); });
        await vi.waitFor(() => { expect(calls('probe').length).toBeGreaterThan(0); }, { timeout: 5000 });
        await flush();
        expect(btn()).toBe(null);
        expect(oldLink()).toBe(null);
        expect(versionText()).toContain('កំពុងពិនិត្យ');
        gate.resolve(null);
        await flush();
        expect(btn()).not.toBe(null);
    });

    it('⛔ ពិនិត្យ Release មិនបាន (បណ្តាញ) ➜ គ្មានប៊ូតុង · ⚠️', async () => {
        await openWithRelease('fail');
        expect(btn()).toBe(null);
        expect(oldLink()).toBe(null);
        expect(versionText()).toContain('⚠️');
    });

    it('⛔ Release មាន ➜ ប៊ូតុង (មិនមែន link ក្រៅ App) ➜ ទាញយកក្នុង App ➜ progress ➜ excuse ➜ បើកផ្ទាំងដំឡើង', async () => {
        await startDownload();
        expect(oldLink()).toBe(null);
        expect(h.state.registered).toEqual(['ZoeApkUpdate']);
        expect(typeof h.state.listeners.progress).toBe('function');
        step(() => { h.state.listeners.progress({ version: NEWER, received: 4294967, total: 8589934 }); });
        const bar = document.getElementById('notifyApkProgress') as HTMLProgressElement | null;
        expect(bar).not.toBe(null);
        expect(Number(bar!.getAttribute('value'))).toBe(4294967);
        expect(Number(bar!.getAttribute('max'))).toBe(8589934);
        expect(versionText()).toContain('50%');
        expect(btn()).toBe(null);
        h.state.download!.resolve({ size: 8589934 });
        await flush();
        expect(h.state.order).toEqual(['excuse', 'install']);
        expect(calls('install')).toEqual([['install', { version: NEWER }]]);
        expect(versionText()).toContain('ដំឡើង');
        expect(h.state.listeners.progress).toBe(undefined);
    });

    it('⛔ មិនទាន់អនុញ្ញាត «ដំឡើង App មិនស្គាល់» ៖ Settings ➜ អនុញ្ញាត ➜ excuse ថ្មី ➜ ផ្ទាំងដំឡើង · បដិសេធ ➜ ណែនាំ + ចុចម្តងទៀតបាន', async () => {
        h.state.installAnswers = [{ status: 'permission-granted' }, { status: 'opened' }];
        await startDownload();
        h.state.download!.resolve({ size: 1 });
        await flush();
        expect(h.state.order).toEqual(['excuse', 'install', 'excuse', 'install']);
        expect(calls('install').length).toBe(2);
        unmount();
        document.body.innerHTML = '';
        h.state.order.length = 0;
        h.state.calls.length = 0;
        h.state.installAnswers = [{ status: 'permission-denied' }];
        step(() => { (uiState as any).apkUpdate = { phase: 'idle', version: '', received: 0, total: 0, error: '' }; });
        mount(<NotifyDrawer />);
        step(() => { btn()!.click(); });
        await flush();
        h.state.download!.resolve({ size: 1 });
        await flush();
        expect(h.state.order).toEqual(['excuse', 'install']);
        expect(versionText()).toContain('អនុញ្ញាត');
        expect(btn()).not.toBe(null);
    });

    it('⛔ ទាញយកបរាជ័យ ➜ សារ · ចុចម្តងទៀតបាន · មិនបើកផ្ទាំងដំឡើង · 404 ➜ Release មិនមាន ➜ គ្មានប៊ូតុង', async () => {
        await startDownload();
        h.state.download!.reject(Object.assign(new Error('network'), { code: 'network' }));
        await flush();
        expect(calls('install')).toEqual([]);
        expect(versionText()).toContain('⚠️');
        expect(btn()).not.toBe(null);
        step(() => { btn()!.click(); });
        await flush();
        h.state.download!.reject(Object.assign(new Error('HTTP 404'), { code: 'not-found' }));
        await flush();
        expect(calls('install')).toEqual([]);
        expect(btn()).toBe(null);
        expect(versionText()).toContain('មិនទាន់មានលើ GitHub Release');
    });

    it('⛔ App នៅខាងក្រោយ (ប្តូរទៅ App ផ្សេង) ពេលកំពុងទាញ ➜ មិនរាប់ថាឈប់រីក (native ទាញបន្ត)', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
        await startDownload();
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
        try {
            await vi.advanceTimersByTimeAsync(STALL_MS * 3);
            await flush();
            expect(calls('cancel')).toEqual([]);
        } finally {
            delete (document as any).visibilityState;
            delete (document as any).hidden;
        }
        step(() => { h.state.listeners.progress({ version: NEWER, received: 500, total: 1000 }); });
        expect(versionText()).toContain('50%');
        h.state.download!.resolve({ size: 1000 });
        await flush();
        expect(calls('install').length).toBe(1);
    });

    it('⛔ ការទាញយកឈប់រីក ➜ បោះបង់ក្រោយ APK_DOWNLOAD_STALL_MS · សារ · ចុចម្តងទៀតបាន', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] });
        await startDownload();
        step(() => { h.state.listeners.progress({ version: NEWER, received: 100, total: 1000 }); });
        await vi.advanceTimersByTimeAsync(STALL_MS - 2000);
        await flush();
        expect(calls('cancel')).toEqual([]);
        await vi.advanceTimersByTimeAsync(4000);
        await flush();
        expect(calls('cancel').length).toBe(1);
        expect(calls('install')).toEqual([]);
        expect(versionText()).toContain('⚠️');
        expect(btn()).not.toBe(null);
    });

    it('ប៊ូតុងបោះបង់ ➜ cancel ➜ ត្រឡប់ទៅប៊ូតុងទាញយក (គ្មានសារកំហុស)', async () => {
        await startDownload();
        const cancel = document.getElementById('notifyApkCancelBtn') as HTMLButtonElement | null;
        expect(cancel).not.toBe(null);
        step(() => { cancel!.click(); });
        await flush();
        expect(calls('cancel').length).toBe(1);
        expect(btn()).not.toBe(null);
        expect(versionText()).not.toContain('⚠️');
    });

    it('Release គ្មាន ➜ បើក 🔔 ម្តងទៀតក្នុង APK_RELEASE_RECHECK_MS មិនសួរម្តងទៀត · ហួសពីនោះ ➜ សួរម្តងទៀត', async () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        await openWithRelease(false);
        step(() => { openNotifyDrawer(); });
        await flush();
        expect(calls('probe').length).toBe(1);
        vi.setSystemTime(Date.now() + RECHECK_MS + 1000);
        step(() => { openNotifyDrawer(); });
        await flush();
        expect(calls('probe').length).toBe(2);
    });

    it('ទិសផ្ទុយ ៖ web/PWA (ទាញកំណែថ្មីដោយខ្លួនឯង) ➜ មិនសួរ GitHub · គ្មានប៊ូតុង', async () => {
        h.state.probe = async () => ({ available: true });
        feedWith(NEWER);
        mount(<NotifyDrawer />);
        step(() => { openNotifyDrawer(); });
        await flush();
        expect(calls('probe')).toEqual([]);
        expect(btn()).toBe(null);
        expect(oldLink()).toBe(null);
    });

    it('ទិសផ្ទុយ ៖ APK ប្រើកំណែចុងក្រោយរួច ➜ មិនសួរ GitHub · គ្មានប៊ូតុង', async () => {
        h.state.probe = async () => ({ available: true });
        asApk();
        feedWith(APP_VERSION);
        mount(<NotifyDrawer />);
        step(() => { openNotifyDrawer(); });
        await flush();
        expect(calls('probe')).toEqual([]);
        expect(btn()).toBe(null);
    });
});
