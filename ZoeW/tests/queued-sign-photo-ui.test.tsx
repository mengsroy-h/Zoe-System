import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { PalmSignQueueButton, PalmSignQueueModal } from '../src/app/components/modals/PalmSignQueueModal';
import { palmSignOutboxState, refreshPalmSignQueue, runPalmSignOutbox, actOnQueuedSign } from '../src/features/palm-sign-outbox';
import { exportQueuedSignPhoto } from '../src/features/queued-sign-photo';
import { securityState } from '../src/core/state';
vi.mock('../src/features/palm-sign-outbox', async () => {
    const { createStore } = await import('../src/core/store');
    return { palmSignOutboxState: createStore('queue-test', { rows: [], message: '' }), refreshPalmSignQueue: vi.fn(), runPalmSignOutbox: vi.fn(), actOnQueuedSign: vi.fn() };
});
vi.mock('../src/features/queued-sign-photo', () => ({ exportQueuedSignPhoto: vi.fn() }));
vi.mock('../src/ui/modal', () => ({ openModalHelper: vi.fn(), closeModal: vi.fn() }));
vi.mock('../src/app/components/modals/Modal', () => ({ Modal: ({ children }) => <div>{children}</div> }));
afterEach(() => vi.clearAllMocks());
it('បើកជួរតែអាន ហើយប៊ូតុងរូបភ្ជាប់តាមលេខកញ្ចប់ មិនហៅ Sign', async () => {
    securityState.appIsLocked = false; securityState.appLockVeiled = false;
    palmSignOutboxState.rows = [0, 1].map((n) => ({ id: 'id' + n, code: 'SYNTHETIC' + n, message: '', phase: 'checking' as const, busy: true }));
    const node = document.createElement('div'); const root = createRoot(node);
    try {
        await act(async () => root.render(<><PalmSignQueueButton /><PalmSignQueueModal /></>));
        await act(async () => (node.querySelector('.nav-bell-btn') as HTMLButtonElement).click());
        expect(refreshPalmSignQueue).toHaveBeenCalledTimes(1);
        const buttons = [...node.querySelectorAll('section button')] as HTMLButtonElement[];
        await act(async () => buttons[1].click());
        expect(exportQueuedSignPhoto).toHaveBeenCalledWith('id1', 'SYNTHETIC1');
        expect(runPalmSignOutbox).not.toHaveBeenCalled(); expect(actOnQueuedSign).not.toHaveBeenCalled();
        await act(async () => { securityState.appIsLocked = true; });
        expect(node.querySelectorAll('section button')).toHaveLength(0);
    } finally { await act(async () => root.unmount()); securityState.appIsLocked = false; }
});
