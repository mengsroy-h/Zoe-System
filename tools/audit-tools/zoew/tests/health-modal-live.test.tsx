import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { HealthCheckModal } from '../../../../ZoeW/src/app/components/modals/HealthCheckModal';
import { uiState } from '../../../../ZoeW/src/core/state';
import { viewState } from '../../../../ZoeW/src/core/view-state';
import { openHealthCheck, runHealthCheck } from '../../../../ZoeW/src/features/health-check';
import { closeModal } from '../../../../ZoeW/src/ui/modal';
import { getLookupApiConfig } from '../../../../ZoeW/src/features/lookup-config';

it('React modal ពិត៖ offline ដកបៃតងភ្លាម ហើយបិទ modal ដក listeners/timer', async () => {
    vi.useFakeTimers();
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    uiState.modalDisplay = {};
    viewState.healthRecheckBusy = false;
    const host = document.createElement('div'); document.body.append(host);
    const root = createRoot(host);
    try {
        await act(async () => { root.render(<HealthCheckModal />); });
        await act(async () => {
            uiState.modalDisplay = { healthCheckModal: 'flex' };
            uiState.healthRows = [{ state: 'ok', icon: '✅', cls: 'health-row health-ok', label: 'អ៊ីនធឺណិត', detail: 'ចាស់' }];
        });
        expect(host.querySelector('.health-ok')).not.toBeNull();
        await act(async () => { window.dispatchEvent(new Event('offline')); });
        expect(host.querySelector('.health-bad')).not.toBeNull();
        expect(host.querySelector('.health-ok')).toBeNull();
        await act(async () => { uiState.modalDisplay = {}; });
        const seq = uiState.healthRunSeq;
        window.dispatchEvent(new Event('online'));
        expect(uiState.healthRunSeq).toBe(seq);
        expect(vi.getTimerCount()).toBe(0);
    } finally {
        await act(async () => root.unmount()); host.remove();
        uiState.modalDisplay = {}; uiState.healthRows = null;
        vi.restoreAllMocks(); vi.useRealTimers();
    }
});

it('Palm ៖ ប៊ូតុងពិតអនុញ្ញាតឱ្យ manual ជំនួស passive ប៉ុន្តែបិទពេល manual កំពុងរត់', async () => {
    vi.useFakeTimers();
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    localStorage.clear();
    localStorage.setItem('zoew_lookup_api_config', JSON.stringify({ enabled: true,
        url: window.location.origin + '/.netlify/functions/zto-order-detail?palm=1&barcode={barcode}',
        palmAccount: { siteCode: 'KH001' } }));
    const requests: Array<{ url: string; signal: AbortSignal }> = [];
    vi.stubGlobal('fetch', vi.fn((url: string, init: RequestInit) => {
        requests.push({ url, signal: init.signal! });
        return new Promise<Response>(() => {});
    }));
    uiState.modalDisplay = {};
    const host = document.createElement('div'); document.body.append(host);
    const root = createRoot(host);
    try {
        await act(async () => { root.render(<HealthCheckModal />); });
        await act(async () => { openHealthCheck(); });
        const button = host.querySelector<HTMLButtonElement>('#healthRecheckBtn')!;
        expect(requests).toHaveLength(1);
        expect(button.disabled).toBe(false);
        await act(async () => { button.click(); await vi.advanceTimersByTimeAsync(1); });
        expect(requests[0].signal.aborted).toBe(true);
        expect(requests.filter(({ url }) => url.includes('verify=1'))).toHaveLength(1);
        expect(button.disabled).toBe(true);
        await act(async () => { button.click(); });
        expect(requests.filter(({ url }) => url.includes('verify=1'))).toHaveLength(1);
        await act(async () => { closeModal('healthCheckModal'); openHealthCheck(); });
        expect(requests.every(({ signal }, i) => i === requests.length - 1 || signal.aborted)).toBe(true);
        expect(button.disabled).toBe(false);
        await act(async () => { closeModal('healthCheckModal'); });
        expect(requests.every(({ signal }) => signal.aborted)).toBe(true);
        expect(vi.getTimerCount()).toBe(0);
    } finally {
        await act(async () => root.unmount()); host.remove();
        uiState.modalDisplay = {}; uiState.healthRows = null;
        localStorage.clear(); vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers();
    }
});

it('Health Check អាន config Lookup ចាស់ ដោយមិនសរសេរ shop tag ជាន់ snapshot របស់ខ្លួន', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    vi.stubGlobal('fetch', vi.fn(async (url: string) => new Response(JSON.stringify({
        nonce: new URL(url, window.location.origin).searchParams.get('nonce')
    }))));
    const lookup = JSON.stringify({ enabled: true, url: 'https://script.google.com/macros/s/test/exec' });
    localStorage.clear();
    localStorage.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: 'https://health-tests.firebaseio.com' }));
    localStorage.setItem('zoew_lookup_api_config', lookup);
    uiState.modalDisplay = { healthCheckModal: 'flex' };
    try {
        await runHealthCheck(false, false);
        expect(localStorage.getItem('zoew_lookup_api_config')).toBe(lookup);
        expect(uiState.healthRows?.[0]?.state).toBe('ok');
        expect(getLookupApiConfig(false)).toBeNull();
        expect(getLookupApiConfig()?.shop).toBe('https://health-tests.firebaseio.com');
        expect(getLookupApiConfig(false)?.url).toBe('https://script.google.com/macros/s/test/exec');
    } finally {
        uiState.modalDisplay = {}; uiState.healthRows = null;
        localStorage.clear(); vi.unstubAllGlobals(); vi.restoreAllMocks();
    }
});
