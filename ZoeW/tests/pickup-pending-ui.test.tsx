import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataState, firebaseState, securityState } from '../src/core/state';
import { CLEANUP_JOURNAL_KEY, PICKUP_JOURNAL_KEY } from '../src/core/storage-keys';
import { cleanupJournalEntryKey, writeCleanupJournal } from '../src/domain/cleanup';
import { AppNavbar } from '../src/app/components/AppNavbar';
import { setupConnectionRecovery } from '../src/services/connection';
import { mount, step, unmount } from './native/react-harness';

const lab = vi.hoisted(() => ({ summary: { total: 0, held: 0, reasons: [] as string[] }, reads: 0, realSummary: false }));
vi.mock('../src/domain/pickup', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../src/domain/pickup')>();
    return { ...actual, pickupPendingSummary: () => {
        lab.reads++;
        return lab.realSummary ? actual.pickupPendingSummary() : lab.summary;
    } };
});

function pending() { return document.getElementById('pickupPendingIndicator'); }
function publish(total: number, held = 0, reasons: string[] = []) {
    step(() => {
        lab.summary = { total, held, reasons };
        dataState.pickupPendingVersion++;
    });
}

beforeEach(() => {
    lab.summary = { total: 0, held: 0, reasons: [] };
    lab.reads = 0;
    lab.realSummary = false;
    localStorage.clear();
    dataState.pickupPendingVersion = 0;
    firebaseState.auth = { currentUser: { uid: 'account-a' } };
    firebaseState.authGeneration = 1;
    firebaseState.db = {};
    firebaseState.isInitializingFirebase = false;
    securityState.appIsLocked = false;
    securityState.appLockVeiled = false;
});
afterEach(() => { unmount(); });

describe('ស្ថានភាព pickup រង់ចាំនៅក្បាល App', () => {
    it('គ្មាន intent មិនបន្ថែមសារថាបានបញ្ចប់', () => {
        mount(<AppNavbar />);
        expect(pending()).toBeNull();
    });

    it('បង្ហាញការងារមិនទាន់ផ្ទៀងផ្ទាត់ ហើយឆ្លើយតប journal version ដោយមិន reload', () => {
        mount(<AppNavbar />);
        publish(3, 1, ['version-conflict']);
        expect(pending()).not.toBeNull();
        expect(pending()!.textContent).toContain('3 រង់ចាំ');
        expect(pending()!.textContent).toContain('1 ត្រូវពិនិត្យ');
        expect(pending()!.getAttribute('role')).toBe('status');
        expect(pending()!.getAttribute('aria-live')).toBe('polite');
        expect(pending()!.textContent).not.toContain('បានបញ្ចប់');
        expect(pending()!.querySelector('button')).toBeNull();
        publish(0);
        expect(pending()).toBeNull();
    });

    it.each([
        ['legacy-proof', 'ភស្តុតាង'],
        ['reset-conflict', 'Reset'],
        ['version-conflict', 'ទិន្នន័យ'],
        ['recovery-pending', 'ផ្ទៀងផ្ទាត់'],
        ['capacity', 'កំណត់ត្រា']
    ])('ការងារជាប់ %s បង្ហាញហេតុផលអាចអានបាន និងរក្សាសារ ពេល remount', (reason, text) => {
        lab.summary = { total: 2, held: 2, reasons: [reason] };
        mount(<AppNavbar />);
        const message = pending()!.getAttribute('aria-label');
        expect(message).toContain(text);
        unmount();
        mount(<AppNavbar />);
        expect(pending()!.textContent).toContain('2 រង់ចាំ');
        expect(pending()!.getAttribute('aria-label')).toBe(message);
    });

    it('storage មិនអាចអាន មិនចាត់ទុកថាគ្មានការងារ ទោះចំនួនមិនអាចគណនា', () => {
        lab.summary = { total: 0, held: 0, reasons: ['storage-unavailable'] };
        mount(<AppNavbar />);
        expect(pending()).not.toBeNull();
        expect(pending()!.textContent).toContain('មិនទាន់ផ្ទៀងផ្ទាត់');
        expect(pending()!.textContent).not.toContain('0 រង់ចាំ');
        expect(pending()!.getAttribute('aria-label')).toContain('រក្សាទុក');
    });

    it('ប្ដូរគណនី/DB អាន summary ថ្មី និងមិនទុកចំនួនពី session ចាស់', () => {
        lab.summary = { total: 4, held: 4, reasons: ['legacy-proof'] };
        mount(<AppNavbar />);
        expect(pending()!.textContent).toContain('4 រង់ចាំ');
        const reads = lab.reads;
        step(() => {
            lab.summary = { total: 0, held: 0, reasons: [] };
            firebaseState.auth = { currentUser: { uid: 'account-b' } };
            firebaseState.authGeneration++;
            firebaseState.db = {};
        });
        expect(lab.reads).toBeGreaterThan(reads);
        expect(pending()).toBeNull();
        step(() => {
            lab.summary = { total: 1, held: 0, reasons: [] };
            firebaseState.authGeneration++;
        });
        expect(pending()!.textContent).toContain('1 រង់ចាំ');
    });

    it.each(['appIsLocked', 'appLockVeiled'] as const)('ចាក់សោ %s លាក់សារ ទោះ summary នៅក្នុង memory', (field) => {
        lab.summary = { total: 1, held: 1, reasons: ['reset-conflict'] };
        mount(<AppNavbar />);
        expect(pending()).not.toBeNull();
        step(() => { securityState[field] = true; });
        expect(pending()).toBeNull();
        step(() => { securityState[field] = false; });
        expect(pending()).not.toBeNull();
    });

    it('logout និង backend កំពុងប្ដូរ មិនបង្ហាញ summary ដែលនៅក្នុង memory', () => {
        lab.summary = { total: 7, held: 7, reasons: ['legacy-proof'] };
        mount(<AppNavbar />);
        expect(pending()).not.toBeNull();
        step(() => { firebaseState.auth = null; firebaseState.authGeneration++; });
        expect(pending()).toBeNull();
        step(() => {
            firebaseState.auth = { currentUser: { uid: 'account-b' } };
            firebaseState.isInitializingFirebase = true;
        });
        expect(pending()).toBeNull();
    });

    it('អាន journal ពិតក្រោយ remount និងបំបែក uid/សាខា ដោយមិនកែ intent', () => {
        const scope = 'https://pickup-ui-a.invalid';
        localStorage.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: scope }));
        const entries = [
            { id: 'a', scope, uid: 'account-a', hold: 'reset-conflict' },
            { id: 'b', scope, uid: 'account-b', hold: 'version-conflict' },
            { id: 'c', scope: 'https://pickup-ui-b.invalid', uid: 'account-a', hold: 'legacy-proof' }
        ].map(entry => ({ protocol: 2, date: '2026-10-29', keys: ['one'], at: 1, pickupResetEpoch: 0, ...entry }));
        for (const entry of entries) localStorage.setItem('zoew_pickup_journal_v2:' + entry.id, JSON.stringify(entry));
        lab.realSummary = true;
        mount(<AppNavbar />);
        expect(pending()!.textContent).toContain('1 រង់ចាំ');
        expect(pending()!.getAttribute('aria-label')).toContain('Reset');
        unmount();
        mount(<AppNavbar />);
        expect(pending()!.textContent).toContain('1 ត្រូវពិនិត្យ');
        step(() => {
            firebaseState.auth = { currentUser: { uid: 'account-b' } };
            firebaseState.authGeneration++;
        });
        expect(pending()!.textContent).toContain('1 រង់ចាំ');
        expect(pending()!.getAttribute('aria-label')).not.toContain('Reset');
        step(() => {
            localStorage.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: 'https://pickup-ui-b.invalid' }));
            firebaseState.db = {};
            firebaseState.authGeneration++;
        });
        expect(pending()).toBeNull();
        for (const entry of entries) expect(JSON.parse(localStorage.getItem('zoew_pickup_journal_v2:' + entry.id)!)).toEqual(entry);
    });

    it('legacy ដែលគ្មាន uid បង្ហាញ HOLD របស់សាខា និងមិនលុប bytes ក្រោយ remount', () => {
        const scope = 'https://pickup-ui-legacy.invalid';
        localStorage.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: scope }));
        const raw = JSON.stringify([{ id: 'old', scope, date: '2026-10-29', keys: ['one'], at: 1 }]);
        localStorage.setItem(PICKUP_JOURNAL_KEY, raw);
        lab.realSummary = true;
        mount(<AppNavbar />);
        expect(pending()!.textContent).toContain('1 ត្រូវពិនិត្យ');
        expect(pending()!.getAttribute('aria-label')).toContain('ភស្តុតាង');
        unmount();
        mount(<AppNavbar />);
        expect(pending()!.textContent).toContain('1 រង់ចាំ');
        expect(localStorage.getItem(PICKUP_JOURNAL_KEY)).toBe(raw);
    });

    it('journal ពិតខូច បង្ហាញមិនទាន់ផ្ទៀងផ្ទាត់ ជំនួស count សូន្យ', () => {
        localStorage.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: 'https://pickup-ui-corrupt.invalid' }));
        localStorage.setItem('zoew_pickup_journal_v2:broken', '{');
        lab.realSummary = true;
        mount(<AppNavbar />);
        expect(pending()!.textContent).toContain('មិនទាន់ផ្ទៀងផ្ទាត់');
        expect(pending()!.getAttribute('aria-label')).toContain('រក្សាទុក');
        expect(localStorage.getItem('zoew_pickup_journal_v2:broken')).toBe('{');
    });

    it('legacy cleanup ប្រាក់ដែលនៅមិនទាន់បញ្ចប់ បង្ហាញ HOLD តាមសាខា និងរក្សា bytes', () => {
        const scope = 'https://cleanup-ui-legacy.invalid';
        localStorage.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: scope }));
        const raw = JSON.stringify([{ id: 'old-cleanup', scope, stage: 'ledger', reason: 'remove', trashItem: { id: 'trash-old' } }]);
        localStorage.setItem('zoew_cleanup_journal_v1', raw);
        lab.realSummary = true;
        mount(<AppNavbar />);
        expect(pending()!.textContent).toContain('ការផ្ទៀងទិន្នន័យ');
        expect(pending()!.textContent).toContain('1 ត្រូវពិនិត្យ');
        expect(pending()!.getAttribute('aria-label')).toContain('ភស្តុតាង');
        unmount();
        mount(<AppNavbar />);
        expect(pending()!.textContent).toContain('1 រង់ចាំ');
        expect(localStorage.getItem('zoew_cleanup_journal_v1')).toBe(raw);
    });

    it('cleanup v2 ពិតជូនដំណឹងក្នុង tab ដដែល ហើយគណនីផ្សេងមិនឃើញ intent', () => {
        const scope = 'https://cleanup-ui-owned.invalid';
        localStorage.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: scope }));
        lab.realSummary = true;
        mount(<AppNavbar />);
        expect(pending()).toBeNull();
        const entry = { id: 'history-cleanup', scope, actorUid: 'account-a', stage: 'collected', reason: 'remove', pickupResetEpoch: 0,
            trashItem: { id: 'trash-cleanup', deletedAt: 1, barcodes: [{ code: 'CLEANUP' }] } };
        step(() => { expect(writeCleanupJournal([entry])).toBe(true); });
        expect(pending()!.textContent).toContain('1 រង់ចាំ');
        const key = cleanupJournalEntryKey(entry);
        const stored = localStorage.getItem(key);
        step(() => { firebaseState.auth = { currentUser: { uid: 'account-b' } }; firebaseState.authGeneration++; });
        expect(pending()).toBeNull();
        expect(localStorage.getItem(key)).toBe(stored);
    });

    it('cleanup v2 ខូចតាម prefix សាខា បង្ហាញ unknown ដោយមិនលុបភស្តុតាង', () => {
        const scope = 'https://cleanup-ui-corrupt.invalid';
        localStorage.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: scope }));
        const key = CLEANUP_JOURNAL_KEY + encodeURIComponent(scope) + ':broken';
        localStorage.setItem(key, '{');
        lab.realSummary = true;
        mount(<AppNavbar />);
        expect(pending()!.textContent).toContain('មិនទាន់ផ្ទៀងផ្ទាត់');
        expect(pending()!.getAttribute('aria-label')).toContain('រក្សាទុក');
        expect(localStorage.getItem(key)).toBe('{');
    });

    it.each(['v2', 'legacy', 'clear', 'legacy-cleanup', 'cleanup-v2'])('StorageEvent %s បង្ហាញ/ដក pending ពិត ហើយ listener មិនស្ទួន', (mode) => {
        const scope = 'https://pickup-ui-event-' + mode + '.invalid';
        localStorage.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: scope }));
        const entry = { id: 'event', scope, uid: 'account-a', actorUid: 'account-a', protocol: 2, date: '2026-10-29', keys: ['one'], at: 1, pickupResetEpoch: 0, hold: 'version-conflict',
            stage: 'collected', reason: 'remove', trashItem: { id: 'trash-event', deletedAt: 1, barcodes: [{ code: 'CLEANUP' }] } };
        const key = mode === 'legacy' ? PICKUP_JOURNAL_KEY : mode === 'legacy-cleanup' ? 'zoew_cleanup_journal_v1'
            : mode === 'cleanup-v2' ? cleanupJournalEntryKey(entry) : 'zoew_pickup_journal_v2:event';
        const raw = JSON.stringify(mode === 'legacy' || mode === 'legacy-cleanup' ? [entry] : entry);
        lab.realSummary = true;
        const old = setupConnectionRecovery();
        const stop = setupConnectionRecovery();
        old();
        try {
            mount(<AppNavbar />);
            expect(pending()).toBeNull();
            const before = dataState.pickupPendingVersion;
            step(() => {
                localStorage.setItem(key, raw);
                window.dispatchEvent(new StorageEvent('storage', { key, newValue: raw }));
            });
            expect(dataState.pickupPendingVersion).toBe(before + 1);
            expect(pending()!.textContent).toContain('1 រង់ចាំ');
            step(() => {
                localStorage.removeItem(key);
                window.dispatchEvent(new StorageEvent('storage', { key: mode === 'clear' ? null : key, oldValue: raw }));
            });
            expect(dataState.pickupPendingVersion).toBe(before + 2);
            expect(pending()).toBeNull();
            stop();
            step(() => { window.dispatchEvent(new StorageEvent('storage', { key, newValue: raw })); });
            expect(dataState.pickupPendingVersion).toBe(before + 2);
        } finally { stop(); }
    });
});
