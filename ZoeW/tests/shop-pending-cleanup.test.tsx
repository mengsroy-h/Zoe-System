/**
 * ⛔ ហាង Supabase «មិនទាន់ស្គាល់» (session ស្តារពី storage តែគណនីមិនទាន់មកដល់ ៖ គ្មាន cache គណនី · `my_account()` មិនទាន់ឆ្លើយ ឬក្រៅបណ្តាញ)។
 *    ការកំណត់ដែលចងហាង (ជុំ ៤) ➜ API ZTO មិនប្រើក្នុងចន្លោះនោះ ➜ ការរង់ចាំបញ្ជី «ចុះហត្ថលេខា» មុនការសម្អាត ៨ ថ្ងៃ (`ztoAbandonCleanupIsHeld`)
 *    បាត់ ➜ កញ្ចប់ដែល ZTO ចុះហត្ថលេខារួចអាចត្រូវដកលុយជា «ផុតកំណត់»។ journal ការសម្អាតរបស់ហាង A ក៏បន្តបានខណៈហាងមិនទាន់ស្គាល់ (អាចជាហាង B)។
 *    ច្បាប់ ៖ ការសម្អាតស្វ័យប្រវត្តិ និងការបន្ត journal រង់ចាំរហូតហាងស្គាល់ (`shopScopePending()`) · Firebase (`databaseURL`) ស្គាល់ជានិច្ច។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataState, firebaseState, uiState, ztoState } from '../src/core/state';
import { appLocalStore } from '../src/core/storage';
import { getZoneDateKey } from '../src/core/timezone';
import { cleanupInFlight, noteCleanupJournalEntry, readCleanupJournal, resumeInterruptedCleanups, runAutomaticCleanupRules } from '../src/domain/cleanup';
import { clearCustomerDataTableCache } from '../src/features/customer-table';
import { clearZtoPickupStatusStore } from '../src/features/zto-status';

vi.mock('../src/features/barcode-ops', () => ({
    openViewListModal: () => {},
    removeSingleBarcode: async () => 'failed',
    toggleIndividualBarcodeClose: async () => false,
    openEditBarcodePriceModal: () => {},
    closeEditBarcodeModal: () => {},
    saveEditedBarcodePrice: () => {},
    applyBarcodeCloseChange: async () => false
}));

const NOW = Date.UTC(2026, 9, 10, 3, 0, 0);
const DAY = 24 * 60 * 60 * 1000;
const SB_URL = 'https://abcd.supabase.co';
const ZTO = { enabled: true, fastMode: true, url: 'https://example.invalid/.netlify/functions/zto-order-detail?barcode={barcode}' };

let calls: string[] = [];

function openItem(id: string, code: string, ageMs: number) {
    return { id, phone: '0960007345', scanDate: getZoneDateKey(NOW - ageMs, 0), isClosed: false, createdAt: NOW - ageMs,
        cod: 1, dod: 0, count: 1, barcode: code, barcodes: [{ code, isClosed: false, cod: 1, dod: 0 }] };
}
function supabaseTenant(tenant: string) {
    appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ supabaseUrl: SB_URL, supabaseKey: 'sb_publishable_x' }));
    firebaseState.auth = { currentUser: { uid: 'u1' }, _account: tenant ? { tenant_id: tenant } : null } as any;
}
function firebaseShop(url: string) {
    appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: url, apiKey: 'k', projectId: 'p' }));
    firebaseState.auth = { currentUser: { uid: 'u1' } } as any;
}
function abandoned(id: string) {
    return calls.includes('tx:zoew_scan_history_cod_dod/' + id);
}
function cleanupNow() {
    cleanupInFlight.clear();
    runAutomaticCleanupRules();
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(NOW));
    appLocalStore.clear();
    clearCustomerDataTableCache();
    clearZtoPickupStatusStore();
    calls = [];
    cleanupInFlight.clear();
    ztoState.ztoStatusInFlight = false;
    dataState.scanHistory = [];
    dataState.deletedItems = [];
    dataState.cleanupResumeInFlight = false;
    uiState.isModalOpen = false;
    uiState.toasts = [];
    firebaseState.authGeneration++;
    firebaseState.serverTimeOffsetMs = 0;
    firebaseState.serverClockTrusted = true;
    firebaseState.isDatabaseConnected = true;
    firebaseState.db = { name: 'audit-db' } as any;
    firebaseState.dbRefDeleted = { path: 'zoew_recently_deleted_cod_dod' } as any;
    firebaseState.fb = {
        tenantScope: (auth: any) => (auth && auth._account && auth._account.tenant_id ? String(auth._account.tenant_id) : ''),
        ref: (_db: unknown, path: string) => ({ path }),
        get: async (ref: { path: string }) => {
            calls.push('get:' + ref.path);
            return { val: () => null, exists: () => false };
        },
        runTransaction: (ref: { path: string }) => {
            calls.push('tx:' + ref.path);
            return Promise.reject(Object.assign(new Error('audit: not applied'), { txOutcome: 'not-applied' }));
        },
        update: async (ref: { path: string }) => { calls.push('update:' + ref.path); },
        set: async (ref: { path: string }) => { calls.push('set:' + ref.path); },
        getIdTokenResult: async () => ({ token: 'audit-token' })
    } as any;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    appLocalStore.clear();
    firebaseState.db = null as any;
    firebaseState.fb = null as any;
    firebaseState.auth = null as any;
    firebaseState.dbRefDeleted = null as any;
    firebaseState.serverClockTrusted = false;
    firebaseState.isDatabaseConnected = false;
});

describe('ហាងមិនទាន់ស្គាល់ ➜ ការសម្អាតរង់ចាំ', () => {
    it('⛔ ហាង Supabase ZTO ៖ គណនីមិនទាន់មកដល់ ➜ កញ្ចប់ ៨ ថ្ងៃមិនដកលុយ (ការរង់ចាំ ZTO មិនបាត់) · ហាងស្គាល់ ➜ ZTO រង់ចាំបញ្ជីចុះហត្ថលេខា', () => {
        appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify(Object.assign({ shop: SB_URL + '#tenant-a' }, ZTO)));
        supabaseTenant('');
        dataState.scanHistory = [openItem('sig1', 'ZTE1000001', 8 * DAY)];
        cleanupNow();
        expect(abandoned('sig1'), 'ហាងមិនទាន់ស្គាល់ ➜ មិនដកលុយ').toBe(false);
        supabaseTenant('tenant-a');
        cleanupNow();
        expect(abandoned('sig1'), 'ហាង A ស្គាល់ ➜ API ZTO របស់ A ➜ រង់ចាំបញ្ជីចុះហត្ថលេខា').toBe(false);
    });

    it('⛔ journal ការសម្អាតរបស់ហាង A មិនបន្តខណៈហាងមិនទាន់ស្គាល់', async () => {
        supabaseTenant('tenant-a');
        noteCleanupJournalEntry({ id: 'j1', reason: 'abandon', journalAt: NOW - 1000, stage: 'slot',
            trashItem: { id: 'j1', deletedAt: NOW - 1000, barcodes: [{ code: 'ZTE2000001', cod: 1, dod: 0, isDeducted: false }] } });
        expect(readCleanupJournal().length).toBe(1);
        supabaseTenant('');
        await resumeInterruptedCleanups();
        expect(calls, 'គ្មានការអាន/សរសេរណាមួយក្នុងហាងដែលមិនទាន់ស្គាល់').toEqual([]);
        expect(readCleanupJournal().length, 'journal នៅសម្រាប់ហាង A').toBe(1);
    });

    it('ទិសផ្ទុយ ៖ Firebase (ហាងស្គាល់ពី databaseURL) · គ្មាន ZTO ➜ កញ្ចប់ ៨ ថ្ងៃផុតកំណត់ធម្មតា', () => {
        firebaseShop('https://shop-a.firebaseio.com');
        dataState.scanHistory = [openItem('old1', 'ZTE3000001', 8 * DAY)];
        cleanupNow();
        expect(abandoned('old1')).toBe(true);
    });

    it('ទិសផ្ទុយ ៖ Supabase ហាងស្គាល់ · គ្មាន ZTO ➜ កញ្ចប់ ៨ ថ្ងៃផុតកំណត់ធម្មតា', () => {
        supabaseTenant('tenant-b');
        dataState.scanHistory = [openItem('old2', 'ZTE4000001', 8 * DAY)];
        cleanupNow();
        expect(abandoned('old2')).toBe(true);
    });
});
