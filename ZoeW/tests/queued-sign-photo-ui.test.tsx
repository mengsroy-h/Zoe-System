import { readFileSync } from 'node:fs';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, it, vi } from 'vitest';
import { PalmSignQueueButton, PalmSignQueueModal } from '../src/app/components/modals/PalmSignQueueModal';
import { palmSignOutboxState, refreshPalmSignQueue, runPalmSignOutbox, actOnQueuedSign } from '../src/features/palm-sign-outbox';
import { exportQueuedSignPhoto } from '../src/features/queued-sign-photo';
import { securityState, uiState } from '../src/core/state';
vi.mock('../src/features/palm-sign-outbox', async () => {
    const { createStore } = await import('../src/core/store');
    return { palmSignOutboxState: createStore('queue-test', { rows: [], recoveryRows: [], message: '' }), refreshPalmSignQueue: vi.fn(), runPalmSignOutbox: vi.fn(), actOnQueuedSign: vi.fn() };
});
vi.mock('../src/features/queued-sign-photo', () => ({ exportQueuedSignPhoto: vi.fn() }));
vi.mock('../src/ui/modal', () => ({ openModalHelper: vi.fn(), closeModal: vi.fn() }));
vi.mock('../src/app/components/modals/Modal', () => ({ Modal: ({ children }) => <div>{children}</div> }));
afterEach(() => vi.clearAllMocks());
it('ស្ថានភាពចាស់ និងការផ្ទៀងថ្មីមិនបាន បង្ហាញដាច់ពីមិនស្គាល់ និងរូប មិនលាក់ក្នុង Details', async () => {
    securityState.appIsLocked = false; securityState.appLockVeiled = false; palmSignOutboxState.rows = [];
    palmSignOutboxState.recoveryRows = [true, false, undefined].map((signed, n) => ({ id: String(n), code: 'SYNTHETIC' + n,
        phase: 'action', recovery: true, busy: false, signed, photoVerified: false, statusUnavailable: true, message: '' }));
    const node = document.createElement('div'); const root = createRoot(node);
    try {
        await act(async () => root.render(<PalmSignQueueModal />));
        await act(async () => [...node.querySelectorAll<HTMLButtonElement>('[aria-pressed]')].find(b => b.textContent?.includes('សង្គ្រោះ'))!.click());
        expect([...node.querySelectorAll('section [role="status"]')].map(p => p.textContent)).toEqual([
            'លើកមុន៖ Sign រួច · រូបមិនទាន់ផ្ទៀង', 'លើកមុន៖ ZTO មិនទាន់ Sign', 'ពិនិត្យស្ថានភាព ZTO មិនបាន'
        ]);
        expect([...node.querySelectorAll('section > p')].filter(p => p.textContent === 'ពិនិត្យ ZTO ថ្មីមិនបាន')).toHaveLength(2);
        expect(node.querySelectorAll('details[open]')).toHaveLength(0);
        expect(actOnQueuedSign).not.toHaveBeenCalled(); expect(runPalmSignOutbox).not.toHaveBeenCalled();
    } finally { await act(async () => root.unmount()); }
});
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
            expect(node.querySelectorAll('section')).toHaveLength(2);
            const retained = [...node.querySelectorAll<HTMLButtonElement>('[aria-pressed]')].find(button => button.textContent?.includes('សង្គ្រោះ'));
            expect(retained).toBeDefined();
            await act(async () => retained!.click());
        }
        expect(node.querySelectorAll('.sign-queue-actions button')).toHaveLength(0);
        await act(async () => node.querySelectorAll<HTMLButtonElement>('.sign-queue-menu-toggle')[1].click());
        const save = [...node.querySelectorAll<HTMLButtonElement>('.sign-queue-actions button')].find(button => button.textContent === '💾 រក្សាទុករូបដើម')!;
        await act(async () => save.click());
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
        expect(node.querySelectorAll('section')).toHaveLength(2);
        await act(async () => [...node.querySelectorAll<HTMLButtonElement>('[aria-pressed]')].find(b => b.textContent?.includes('សង្គ្រោះ'))!.click());
        expect([...node.querySelectorAll('section [role="status"]')].map(p => p.textContent)).toEqual(['Sign រួច · រូបមិនទាន់ផ្ទៀង', 'ZTO មិនទាន់ Sign']);
        expect(node.querySelectorAll('details[open]')).toHaveLength(0);
        expect(node.textContent).toContain('សេចក្តីពន្យល់វែង');
        await act(async () => node.querySelector<HTMLButtonElement>('.sign-queue-menu-toggle')!.click());
        await act(async () => [...node.querySelectorAll<HTMLButtonElement>('section button')].find(b => b.textContent?.includes('ពិនិត្យ'))!.click());
        expect(actOnQueuedSign).toHaveBeenCalledExactlyOnceWith('signed', 'recover');
        expect(runPalmSignOutbox).not.toHaveBeenCalled(); expect(exportQueuedSignPhoto).not.toHaveBeenCalled();
        vi.mocked(actOnQueuedSign).mockClear();
        await act(async () => node.querySelector<HTMLButtonElement>('.sign-queue-menu-toggle')!.click());
        const remove = [...node.querySelectorAll<HTMLButtonElement>('section button')].find(b => b.textContent === 'លុបអចិន្ត្រៃយ៍')!;
        expect(remove.closest('details')).toBeNull();
        await act(async () => remove.click());
        expect(actOnQueuedSign).toHaveBeenCalledExactlyOnceWith('signed', 'delete');
        await act(async () => { palmSignOutboxState.recoveryRows = []; });
        expect(node.querySelectorAll('section')).toHaveLength(0);
        expect(node.querySelectorAll('[aria-pressed]')).toHaveLength(0);
    } finally { await act(async () => root.unmount()); }
});

it('ម៉ឺនុយ ⋯៖ ប៊ូតុងលាក់ដំបូង បើកតែមួយជួរ និងបិទមុនធ្វើសកម្មភាព', async () => {
    securityState.appIsLocked = false; securityState.appLockVeiled = false;
    palmSignOutboxState.rows = [];
    palmSignOutboxState.recoveryRows = [0, 1].map(n => ({ id: 'menu' + n, code: 'SYNTHETIC' + n, phase: 'action', recovery: true, busy: false, signed: false, message: 'មូលហេតុសាកល្បង' }));
    const node = document.createElement('div'); const root = createRoot(node);
    try {
        await act(async () => root.render(<PalmSignQueueModal />));
        expect(node.querySelectorAll('.sign-queue-actions button')).toHaveLength(0);
        const toggles = [...node.querySelectorAll<HTMLButtonElement>('.sign-queue-menu-toggle')];
        expect(toggles).toHaveLength(2);
        await act(async () => toggles[0].click());
        expect(toggles[0].getAttribute('aria-expanded')).toBe('true');
        expect(node.querySelectorAll('.sign-queue-actions')).toHaveLength(1);
        await act(async () => toggles[1].click());
        expect(toggles[0].getAttribute('aria-expanded')).toBe('false');
        expect(toggles[1].getAttribute('aria-expanded')).toBe('true');
        await act(async () => [...node.querySelectorAll<HTMLButtonElement>('.sign-queue-actions button')].find(b => b.textContent === 'លុបអចិន្ត្រៃយ៍')!.click());
        expect(actOnQueuedSign).toHaveBeenCalledExactlyOnceWith('menu1', 'delete');
        expect(node.querySelectorAll('.sign-queue-actions')).toHaveLength(0);
        await act(async () => toggles[0].click());
        await act(async () => node.querySelector('h3')!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
        expect(node.querySelectorAll('.sign-queue-actions')).toHaveLength(0);
        await act(async () => toggles[0].click());
        await act(async () => toggles[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
        expect(node.querySelectorAll('.sign-queue-actions')).toHaveLength(0);
    } finally { await act(async () => root.unmount()); }
});

it.each([
    [{ recovery:true }, 'recover', 'ពិនិត្យ (មិនផ្ញើ Sign)'],
    [{ recovery:true, recoveryContinuation:true }, 'resume', 'បន្ត Sign តាមសំណើដើម'],
    [{ warning:'ត្រូវបញ្ជាក់' }, 'approve', 'បញ្ជាក់ និងបន្ត'],
    [{ warning:'ត្រូវបញ្ជាក់' }, 'cancel', 'បោះបង់ការងារមិនទាន់ផ្ញើ និងលុបរូបដើម'],
    [{}, 'retry', 'ពិនិត្យ (មិនផ្ញើ Sign)'],
    [{ continuationAllowed:true }, 'continue', 'បន្ត Sign តាមសំណើដើម']
] as const)('ម៉ឺនុយរក្សា action និងលេខការងារដើម %s %s', async (extra, action, label) => {
    securityState.appIsLocked = false; securityState.appLockVeiled = false;
    const row = { id:'action-row', code:'SYNTHETIC', phase:'action' as const, busy:false, recovery:false, message:'សាកល្បង', ...extra };
    palmSignOutboxState.rows = row.recovery ? [] : [row];
    palmSignOutboxState.recoveryRows = row.recovery ? [row] : [];
    const node = document.createElement('div'); const root = createRoot(node);
    try {
        await act(async () => root.render(<PalmSignQueueModal />));
        await act(async () => node.querySelector<HTMLButtonElement>('.sign-queue-menu-toggle')!.click());
        const button = [...node.querySelectorAll<HTMLButtonElement>('.sign-queue-actions button')].find(b => b.textContent === label)!;
        expect(button).toBeDefined(); expect(button.disabled).toBe(false);
        await act(async () => button.click());
        expect(actOnQueuedSign).toHaveBeenCalledExactlyOnceWith('action-row', action);
        expect(node.querySelectorAll('.sign-queue-actions')).toHaveLength(0);
    } finally { await act(async () => root.unmount()); }
});

it('ម៉ឺនុយបិទពេល lock និងមិនបើកវិញដោយស្វ័យប្រវត្តិ · busy មិនអនុញ្ញាតកែការងារ', async () => {
    securityState.appIsLocked = false; securityState.appLockVeiled = false;
    palmSignOutboxState.rows = [];
    palmSignOutboxState.recoveryRows = [{ id:'busy', code:'SYNTHETIC', phase:'checking', busy:true, recovery:true, message:'' }];
    const node = document.createElement('div'); const root = createRoot(node);
    try {
        await act(async () => root.render(<PalmSignQueueModal />));
        await act(async () => node.querySelector<HTMLButtonElement>('.sign-queue-menu-toggle')!.click());
        const buttons = [...node.querySelectorAll<HTMLButtonElement>('.sign-queue-actions button')];
        expect(buttons.map(b => b.disabled)).toEqual([false, true, true]);
        await act(async () => buttons[2].click()); expect(actOnQueuedSign).not.toHaveBeenCalled();
        await act(async () => { securityState.appIsLocked = true; });
        expect(node.querySelectorAll('.sign-queue-menu-toggle')).toHaveLength(0);
        await act(async () => { securityState.appIsLocked = false; });
        expect(node.querySelectorAll('.sign-queue-actions')).toHaveLength(0);
    } finally { await act(async () => root.unmount()); securityState.appIsLocked = false; }
});

it('បិទ/បើក modal និងប្ដូរបញ្ជីមិនរក្សាម៉ឺនុយចាស់ · verificationRequired មិនបើក Retry', async () => {
    securityState.appIsLocked = false; securityState.appLockVeiled = false;
    uiState.modalDisplay.palmSignQueueModal = 'flex';
    palmSignOutboxState.rows = [{ id:'terminal', code:'SYNTHETIC', phase:'action', busy:false, verificationRequired:true, message:'ត្រូវផ្ទៀងក្នុង ZTO' }];
    palmSignOutboxState.recoveryRows = [{ id:'recovery', code:'SYNTHETIC-2', phase:'action', busy:false, recovery:true, message:'' }];
    const node = document.createElement('div'); const root = createRoot(node);
    try {
        await act(async () => root.render(<PalmSignQueueModal />));
        await act(async () => node.querySelector<HTMLButtonElement>('.sign-queue-menu-toggle')!.click());
        expect([...node.querySelectorAll('.sign-queue-actions button')].map(b => b.textContent)).toEqual(['💾 រក្សាទុករូបដើម', 'លុបអចិន្ត្រៃយ៍']);
        await act(async () => { uiState.modalDisplay = { ...uiState.modalDisplay, palmSignQueueModal:'none' }; });
        await act(async () => { uiState.modalDisplay = { ...uiState.modalDisplay, palmSignQueueModal:'flex' }; });
        expect(node.querySelectorAll('.sign-queue-actions')).toHaveLength(0);
        await act(async () => node.querySelector<HTMLButtonElement>('.sign-queue-menu-toggle')!.click());
        await act(async () => [...node.querySelectorAll<HTMLButtonElement>('[aria-pressed]')].find(b => b.textContent?.includes('សង្គ្រោះ'))!.click());
        expect(node.querySelectorAll('.sign-queue-actions')).toHaveLength(0);
        expect(node.querySelector('h4')!.textContent).toBe('SYNTHETIC-2');
        expect(actOnQueuedSign).not.toHaveBeenCalled();
    } finally { await act(async () => root.unmount()); delete uiState.modalDisplay.palmSignQueueModal; }
});

it.each([false, true])('ប៊ូតុងរូបមានស៊ុម ផ្ទៃពណ៌ និងទំហំចុចច្បាស់ (ព្រមាន %s)', async warning => {
    securityState.appIsLocked = false; securityState.appLockVeiled = false;
    palmSignOutboxState.rows = [{ id:'photo-style', code:'SYNTHETIC', phase:'action', busy:false, message:'', warning:warning ? 'ត្រូវបញ្ជាក់' : undefined }];
    palmSignOutboxState.recoveryRows = [];
    const node = document.createElement('div'); node.id = 'palmSignQueueModal';
    const style = document.createElement('style');
    style.textContent = readFileSync('src/styles/app.css', 'utf8') + readFileSync('src/styles/react-root.css', 'utf8');
    document.head.append(style); document.body.append(node);
    const root = createRoot(node);
    try {
        await act(async () => root.render(<PalmSignQueueModal />));
        await act(async () => node.querySelector<HTMLButtonElement>('.sign-queue-menu-toggle')!.click());
        const save = [...node.querySelectorAll<HTMLButtonElement>('.sign-queue-actions button')].find(b => b.textContent === '💾 រក្សាទុករូបដើម')!;
        const css = getComputedStyle(save);
        expect(css.borderTopStyle).toBe('solid');
        expect(css.borderTopColor).not.toBe('transparent');
        expect(css.backgroundColor).not.toBe('transparent');
        expect(css.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
        expect(parseFloat(css.minHeight)).toBeGreaterThanOrEqual(46);
        expect(css.boxSizing).toBe('border-box');
        expect(css.width).toBe('100%');
        expect(css.whiteSpace).toBe('normal');
        expect(save.disabled).toBe(false);
        await act(async () => save.click());
        expect(exportQueuedSignPhoto).toHaveBeenCalledExactlyOnceWith('photo-style', 'SYNTHETIC');
        expect(node.querySelectorAll('.sign-queue-actions')).toHaveLength(0);
        expect(actOnQueuedSign).not.toHaveBeenCalled();
    } finally { await act(async () => root.unmount()); node.remove(); style.remove(); }
});

it.each([false, true])('ចាប់ផ្ដើមថ្មីតាមការចុចច្បាស់ និងបិទម៉ឺនុយ (កំពុងផ្ទៀង %s)', async restartPending => {
    securityState.appIsLocked = false; securityState.appLockVeiled = false;
    palmSignOutboxState.rows = [];
    palmSignOutboxState.recoveryRows = [{ id:'restart-row', code:'SYNTHETIC', phase:'action', busy:false, recovery:true, message:'', restartAllowed:!restartPending, restartPending }];
    const node = document.createElement('div'); const root = createRoot(node);
    try {
        await act(async () => root.render(<PalmSignQueueModal />));
        await act(async () => node.querySelector<HTMLButtonElement>('.sign-queue-menu-toggle')!.click());
        const label = restartPending ? 'ពិនិត្យការចាប់ផ្ដើមថ្មី' : 'ចាប់ផ្ដើម Sign ថ្មី…';
        const button = [...node.querySelectorAll<HTMLButtonElement>('.sign-queue-actions button')].find(b => b.textContent === label);
        expect(button).toBeDefined();
        expect(actOnQueuedSign).not.toHaveBeenCalled();
        await act(async () => { palmSignOutboxState.recoveryRows = palmSignOutboxState.recoveryRows.map(r => ({...r, busy:true})); });
        expect(button!.disabled).toBe(true);
        await act(async () => button!.click());
        expect(actOnQueuedSign).not.toHaveBeenCalled();
        await act(async () => { palmSignOutboxState.recoveryRows = palmSignOutboxState.recoveryRows.map(r => ({...r, busy:false})); });
        await act(async () => button!.click());
        expect(actOnQueuedSign).toHaveBeenCalledExactlyOnceWith('restart-row', 'restart');
        expect(node.querySelectorAll('.sign-queue-actions')).toHaveLength(0);
        expect(runPalmSignOutbox).not.toHaveBeenCalled();
    } finally { await act(async () => root.unmount()); }
});

it.each([[false, false], [false, true], [true, false], [true, true]])('សំណើថ្មី និងសំណើដើមមានស្លាកបន្តច្បាស់ (ថ្មី %s · សង្គ្រោះ %s)', async (restartReady, recovery) => {
    securityState.appIsLocked = false; securityState.appLockVeiled = false;
    const row = { id:'continue-row', code:'SYNTHETIC', phase:'action' as const, busy:false, recovery, recoveryContinuation:recovery, continuationAllowed:!recovery, restartReady, message:'' };
    palmSignOutboxState.rows = recovery ? [] : [row];
    palmSignOutboxState.recoveryRows = recovery ? [row] : [];
    const node = document.createElement('div'); const root = createRoot(node);
    try {
        await act(async () => root.render(<PalmSignQueueModal />));
        await act(async () => node.querySelector<HTMLButtonElement>('.sign-queue-menu-toggle')!.click());
        const expected = restartReady ? 'បន្ត Sign ថ្មី' : 'បន្ត Sign តាមសំណើដើម';
        const button = [...node.querySelectorAll<HTMLButtonElement>('.sign-queue-actions button')].find(b => b.textContent === expected);
        expect(button).toBeDefined();
        expect(actOnQueuedSign).not.toHaveBeenCalled();
        expect(runPalmSignOutbox).not.toHaveBeenCalled();
        await act(async () => button!.click());
        expect(actOnQueuedSign).toHaveBeenCalledExactlyOnceWith('continue-row', recovery ? 'resume' : 'continue');
        expect(node.querySelectorAll('.sign-queue-actions')).toHaveLength(0);
    } finally { await act(async () => root.unmount()); }
});
