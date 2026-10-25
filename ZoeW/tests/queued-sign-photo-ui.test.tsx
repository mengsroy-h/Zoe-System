import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { PalmSignQueueButton, PalmSignQueueModal } from '../src/app/components/modals/PalmSignQueueModal';
import { palmSignOutboxState, refreshPalmSignQueue, runPalmSignOutbox, actOnQueuedSign } from '../src/features/palm-sign-outbox';
import { exportQueuedSignPhoto } from '../src/features/queued-sign-photo';
import { securityState } from '../src/core/state';
vi.mock('../src/features/palm-sign-outbox', async () => {
    const { createStore } = await import('../src/core/store');
    return { palmSignOutboxState: createStore('queue-test', { rows: [], recoveryRows: [], message: '' }), refreshPalmSignQueue: vi.fn(), runPalmSignOutbox: vi.fn(), actOnQueuedSign: vi.fn() };
});
vi.mock('../src/features/queued-sign-photo', () => ({ exportQueuedSignPhoto: vi.fn() }));
vi.mock('../src/ui/modal', () => ({ openModalHelper: vi.fn(), closeModal: vi.fn() }));
vi.mock('../src/app/components/modals/Modal', () => ({ Modal: ({ children }) => <div>{children}</div> }));
afterEach(() => vi.clearAllMocks());
it.each([false, true])('បើកជួរតែអាន (សង្គ្រោះ %s) ហើយប៊ូតុងរូបភ្ជាប់តាមលេខកញ្ចប់ មិនហៅ Sign', async recovery => {
    securityState.appIsLocked = false; securityState.appLockVeiled = false;
    const rows = [0, 1].map((n) => ({ id: 'id' + n, code: 'SYNTHETIC' + n, signMan: 'អ្នកទទួលសាកល្បង', message: '', phase: 'checking' as const, busy: true, recovery }));
    palmSignOutboxState.rows = recovery ? [] : rows;
    palmSignOutboxState.recoveryRows = recovery ? rows : [];
    const node = document.createElement('div'); const root = createRoot(node);
    try {
        await act(async () => root.render(<><PalmSignQueueButton /><PalmSignQueueModal /></>));
        await act(async () => (node.querySelector('.nav-bell-btn') as HTMLButtonElement).click());
        expect(refreshPalmSignQueue).toHaveBeenCalledTimes(1);
        if (recovery) {
            expect(node.querySelectorAll('section')).toHaveLength(0);
            const retained = [...node.querySelectorAll<HTMLButtonElement>('[aria-pressed]')].find(button => button.textContent?.includes('រក្សាទុក'));
            expect(retained).toBeDefined();
            await act(async () => retained!.click());
        }
        const buttons = [...node.querySelectorAll<HTMLButtonElement>('section button')].filter(button => button.textContent === '💾 រក្សាទុករូបដើម');
        expect(buttons).toHaveLength(2);
        await act(async () => buttons[1].click());
        expect(exportQueuedSignPhoto).toHaveBeenCalledWith('id1', 'SYNTHETIC1');
        expect(runPalmSignOutbox).not.toHaveBeenCalled(); expect(actOnQueuedSign).not.toHaveBeenCalled();
        await act(async () => { securityState.appIsLocked = true; });
        expect(node.querySelectorAll('section button')).toHaveLength(0);
    } finally { await act(async () => root.unmount()); securityState.appIsLocked = false; }
});

it('ការងាររក្សាទុក៖ ស្ថានភាពខ្លី និងព័ត៌មានលម្អិតបិទដំបូង · ពិនិត្យតែអាន', async () => {
    securityState.appIsLocked = false; securityState.appLockVeiled = false;
    palmSignOutboxState.rows = [];
    palmSignOutboxState.recoveryRows = [
        { id: 'signed', code: 'SYNTHETIC-SIGNED', phase: 'action', busy: false, recovery: true, signed: true, photoVerified: false, message: 'សេចក្តីពន្យល់វែងអំពីរូបដើមដែលត្រូវរក្សាទុក' },
        { id: 'legacy', code: 'SYNTHETIC-LEGACY', phase: 'action', busy: false, recovery: true, signed: false, message: 'ភស្តុតាងសំណើចាស់មិនគ្រប់' }
    ];
    const node = document.createElement('div'); const root = createRoot(node);
    try {
        await act(async () => root.render(<PalmSignQueueModal />));
        expect(node.querySelectorAll('section')).toHaveLength(0);
        await act(async () => [...node.querySelectorAll<HTMLButtonElement>('[aria-pressed]')].find(b => b.textContent?.includes('រក្សាទុក'))!.click());
        expect([...node.querySelectorAll('section [role="status"]')].map(p => p.textContent)).toEqual(['Sign រួច · រូបមិនទាន់ផ្ទៀង', 'ZTO មិនទាន់ Sign']);
        expect(node.querySelectorAll('details[open]')).toHaveLength(0);
        expect(node.querySelector('details')?.textContent).toContain('សេចក្តីពន្យល់វែង');
        await act(async () => [...node.querySelectorAll<HTMLButtonElement>('section button')].find(b => b.textContent?.includes('ពិនិត្យ'))!.click());
        expect(actOnQueuedSign).toHaveBeenCalledExactlyOnceWith('signed', 'recover');
        expect(runPalmSignOutbox).not.toHaveBeenCalled(); expect(exportQueuedSignPhoto).not.toHaveBeenCalled();
        vi.mocked(actOnQueuedSign).mockClear();
        const remove = [...node.querySelectorAll<HTMLButtonElement>('section button')].find(b => b.textContent === 'ដកពីបញ្ជីត្រូវពិនិត្យ')!;
        await act(async () => remove.click()); expect(actOnQueuedSign).not.toHaveBeenCalled();
        expect(node.textContent).toContain('មិនកត់ថា Sign រួច និងមិនលុបរូប');
        await act(async () => [...node.querySelectorAll<HTMLButtonElement>('section button')].find(b => b.textContent === 'បញ្ជាក់ដកពីបញ្ជី')!.click());
        expect(actOnQueuedSign).toHaveBeenCalledExactlyOnceWith('signed', 'dismiss');
        await act(async () => { palmSignOutboxState.recoveryRows = palmSignOutboxState.recoveryRows.map(row => ({ ...row, dismissed: true })); });
        expect(node.querySelectorAll('section')).toHaveLength(0);
        await act(async () => [...node.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent?.startsWith('បង្ហាញរូបដែលដកពីបញ្ជី'))!.click());
        expect(node.querySelectorAll('section')).toHaveLength(2);
        expect(node.textContent).toContain('ដាក់ក្នុងបញ្ជីពិនិត្យវិញ');
    } finally { await act(async () => root.unmount()); }
});
