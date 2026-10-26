import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { HealthCheckModal } from '../src/app/components/modals/HealthCheckModal';
import { uiState } from '../src/core/state';
import { viewState } from '../src/core/view-state';

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
