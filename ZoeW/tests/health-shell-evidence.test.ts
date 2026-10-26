import { afterEach, describe, expect, it, vi } from 'vitest';
import * as health from '../src/features/health-check';

function bridge(reply: unknown, mode = 'reply') {
    const close = vi.fn();
    const port = { onmessage: null as any, close };
    const controller = { postMessage: vi.fn(() => {
        if (mode === 'throw') throw new Error('unavailable');
        if (mode === 'reply') queueMicrotask(() => port.onmessage?.({ data: reply }));
    }) };
    vi.stubGlobal('navigator', { onLine: true, serviceWorker: { controller } });
    vi.stubGlobal('MessageChannel', class { port1 = port; port2 = { close }; });
    return { close, controller, port };
}

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe('សញ្ញាសុខភាពត្រូវនឹងភស្តុតាង', () => {
    it('Server ឆ្លើយក្នុងជុំនេះ ➜ បណ្ដាញបៃតង', () => {
        vi.stubGlobal('navigator', { onLine: true });
        expect(health.healthNetworkRow(true).state).toBe('ok');
    });
    it('ភស្តុតាងចាស់ ឬមិនច្បាស់ ➜ មិនបៃតង', () => {
        vi.stubGlobal('navigator', { onLine: true });
        expect(health.healthNetworkRow(false).state).toBe('info');
        expect(health.healthNetworkRow().state).toBe('info');
    });
    it('បណ្ដាញដាច់ក្រោយ Server ឆ្លើយ ➜ ក្រហម', () => {
        vi.stubGlobal('navigator', { onLine: false });
        expect(health.healthNetworkRow(true).state).toBe('bad');
    });
    it('សំបកក្នុង cache ត្រូវកំណែ និងគ្រប់ឯកសារ ➜ បៃតង', async () => {
        const b = bridge({ type: 'ZOEW_HEALTH_SHELL', version: 'test', ready: true });
        expect((await health.healthServiceWorkerLiveRow()).state).toBe('ok');
        expect(b.close).toHaveBeenCalledTimes(2);
    });
    it.each([
        { type: 'ZOEW_HEALTH_SHELL', version: 'old', ready: true },
        { type: 'ZOEW_HEALTH_SHELL', version: 'test', ready: 'true' },
        { type: 'other', version: 'test', ready: true }, null
    ])('ចម្លើយមិនអាចជាភស្តុតាង %j ➜ មិនបៃតង', async (reply) => {
        bridge(reply);
        expect((await health.healthServiceWorkerLiveRow()).state).not.toBe('ok');
    });
    it('ខ្វះឯកសារសំបក ➜ ព្រមាន', async () => {
        bridge({ type: 'ZOEW_HEALTH_SHELL', version: 'test', ready: false });
        expect((await health.healthServiceWorkerLiveRow()).state).toBe('warn');
    });
    it('controller ប្តូរខណៈរង់ចាំ ➜ មិនទទួលភស្តុតាងចាស់', async () => {
        bridge({ type: 'ZOEW_HEALTH_SHELL', version: 'test', ready: true });
        const pending = health.healthServiceWorkerLiveRow();
        (navigator.serviceWorker as any).controller = {};
        expect((await pending).state).not.toBe('ok');
    });
    it.each(['silent', 'throw'])('probe %s ➜ បញ្ចប់ និងបិទ port', async (mode) => {
        vi.useFakeTimers();
        const b = bridge(null, mode);
        const pending = health.healthServiceWorkerLiveRow();
        await vi.advanceTimersByTimeAsync(3000);
        expect((await pending).state).toBe('info');
        expect(b.close).toHaveBeenCalledTimes(2);
        expect(vi.getTimerCount()).toBe(0);
    });
});

describe('ផ្ទៀងបណ្ដាញដោយចម្លើយថ្មី មិនមែន cache ឬ navigator', () => {
    it('Server ឆ្លើយ challenge ត្រូវ ➜ បៃតង', async () => {
        vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(JSON.stringify({ nonce: new URL(url, 'https://example.invalid').searchParams.get('nonce') }))));
        expect((await health.healthNetworkLiveRow()).state).toBe('ok');
    });
    it.each(['stale', 'redirect', 'error', 'reject'])('ចម្លើយ %s ➜ មិនបៃតង', async (mode) => {
        vi.stubGlobal('fetch', vi.fn(async () => {
            if (mode === 'reject') throw new Error('offline');
            const res = new Response(JSON.stringify({ nonce: 'old' }), { status: mode === 'error' ? 503 : 200 });
            if (mode === 'redirect') Object.defineProperty(res, 'redirected', { value: true });
            return res;
        }));
        expect((await health.healthNetworkLiveRow()).state).not.toBe('ok');
    });
    it('headers ឬ body ព្យួរ ➜ បញ្ចប់ក្នុង 4 វិនាទី', async () => {
        vi.useFakeTimers();
        vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
        const pending = health.healthNetworkLiveRow();
        await vi.advanceTimersByTimeAsync(4001);
        expect((await pending).state).toBe('info');
        expect(vi.getTimerCount()).toBe(0);
    });
});

describe('ដែន APK និង browser', () => {
    it('APK ប្រើសំបកក្នុងកម្មវិធី មិនទាមទារ SW', async () => {
        (window as any).Capacitor = { isNativePlatform: () => true };
        try {
            vi.stubGlobal('navigator', { onLine: true });
            expect((await health.healthServiceWorkerLiveRow()).state).toBe('ok');
        } finally { delete (window as any).Capacitor; }
    });
    it('browser គ្មាន SW ➜ ព្រមាន', async () => {
        vi.stubGlobal('navigator', { onLine: true });
        expect((await health.healthServiceWorkerLiveRow()).state).toBe('warn');
    });
    it('browser មិនទាន់មាន controller ➜ ព្រមាន', async () => {
        vi.stubGlobal('navigator', { onLine: true, serviceWorker: { controller: null } });
        expect((await health.healthServiceWorkerLiveRow()).state).toBe('warn');
    });
    it('offline មិនបង្កើត network request', async () => {
        vi.stubGlobal('navigator', { onLine: false });
        const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
        expect((await health.healthNetworkLiveRow()).state).toBe('bad');
        expect(fetch).not.toHaveBeenCalled();
    });
    it('body ឆ្លើយយឺតលើសពិដាន ➜ មិនអះអាងជោគជ័យ', async () => {
        vi.useFakeTimers();
        vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, redirected: false, json: () => new Promise(() => {}) })));
        const pending = health.healthNetworkLiveRow();
        await vi.advanceTimersByTimeAsync(4001);
        expect((await pending).state).toBe('info');
        expect(vi.getTimerCount()).toBe(0);
    });
    it('APK ផ្ទៀងទៅ web origin មិនមែន localhost និងមិនផ្ញើ credentials', async () => {
        (window as any).Capacitor = { isNativePlatform: () => true };
        vi.stubEnv('VITE_NATIVE_WEB_ORIGIN', 'https://audit.invalid');
        const fetch = vi.fn(async (url: string) => new Response(JSON.stringify({ nonce: new URL(url).searchParams.get('nonce') })));
        vi.stubGlobal('fetch', fetch);
        try {
            expect((await health.healthNetworkLiveRow()).state).toBe('ok');
            expect(fetch.mock.calls[0][0]).toMatch(/^https:\/\/audit.invalid\/\.netlify\/functions\/health\?nonce=/);
            expect((fetch.mock.calls[0] as any)[1]).toMatchObject({ credentials: 'omit', cache: 'no-store', redirect: 'error', method: 'GET' });
        } finally { delete (window as any).Capacitor; vi.unstubAllEnvs(); }
    });
});
