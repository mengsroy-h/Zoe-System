/**
 * ការសម្រេចម្ចាស់គម្រោង ៖ ស្កេនកញ្ចប់ **គ្មានទីតាំងពីមុន** ចូលទីតាំង Locker ➜ **ចុះភ្លាម** ទោះទីតាំងនោះមានកញ្ចប់អតិថិជនផ្សេង
 *   (មិនទាន់យក) ក៏ដោយ («មិនបាច់ចាំមានសារប្រមាន … នាំតែយឺតការងារ») ➜ គ្មានប្រអប់ · គ្មាន `pendingLockerCode` · toast ✅ ភ្លាម។
 *   ប្រអប់សួរមានតែពេលកញ្ចប់ **មានទីតាំងស្រាប់** ហើយស្កេនចូលទីតាំងផ្សេង (ផ្លាស់ទី · មានចំណាំអ្នកកាន់) · ទីតាំងដដែល ➜ toast «រួចហើយ»។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocationWarningModal } from '../src/app/components/modals/LocationWarningModal';
import { dataState, firebaseState, uiState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { buildLockerBarcodeIndex } from '../src/features/locker';
import { cancelLocationChange, confirmLocationChange, handleLockerScan } from '../src/features/locker-assign';
import { byId, mount, step, unmount } from './native/react-harness';

vi.mock('../src/ui/entry-list', async (importOriginal) => ({ ...(await importOriginal<any>()), renderLockerList: () => {} }));
vi.mock('../src/ui/history-refresh', async (importOriginal) => ({ ...(await importOriginal<any>()), refreshCurrentHistoryView: () => {} }));

let transaction: ReturnType<typeof vi.fn>;
const savedFb = firebaseState.fb;
const warnOpen = () => uiState.modalDisplay.locationWarningModal === 'flex';
const toasts = () => uiState.toasts.map((t: any) => String(t.msg || ''));

function seed(history: any[]) {
    dataState.scanHistory = history;
    buildLockerBarcodeIndex();
}

beforeEach(() => {
    dbListenerPendingPaths.clear();
    dbListenerFailedPaths.clear();
    uiState.toasts = [];
    uiState.pendingLockerCode = null;
    uiState.activeLocker = 'L-02';
    viewState.locationWarningText = '';
    firebaseState.db = { name: 'db' } as any;
    transaction = vi.fn(async (_ref: any, fn: any) => {
        const current = dataState.scanHistory.find((i: any) => i.id === String(_ref.path).split('/').pop());
        const value = fn(current ? JSON.parse(JSON.stringify(current)) : null);
        return { committed: true, snapshot: { val: () => value } };
    });
    firebaseState.fb = { ref: (_db: any, path: string) => ({ path }), runTransaction: transaction } as any;
    mount(<LocationWarningModal />);
});

afterEach(() => {
    unmount();
    firebaseState.fb = savedFb;
    uiState.modalDisplay = {};
    uiState.modalStack = [];
});

describe('Locker ៖ ស្កេនដាក់ទីតាំង = ចុះភ្លាម · សួរតែពេលផ្លាស់ទី', () => {
    it('កញ្ចប់គ្មានទីតាំង ➜ ទីតាំងមានកញ្ចប់អតិថិជនផ្សេង (មិនទាន់យក) ➜ ចុះភ្លាម · គ្មានប្រអប់ · toast ✅', async () => {
        seed([
            { id: 'a', phone: '0961111111', barcodes: [{ code: 'ZTA001', locker: 'L-02', isClosed: false }] },
            { id: 'b', phone: '0962222222', barcodes: [{ code: 'ZTB001', isClosed: false }] }
        ]);
        step(() => { handleLockerScan('ZTB001'); });
        await new Promise((resolve) => setTimeout(resolve, 30));
        expect(warnOpen()).toBe(false);
        expect(uiState.pendingLockerCode).toBe(null);
        expect(viewState.locationWarningText).toBe('');
        expect(transaction).toHaveBeenCalledTimes(1);
        expect(toasts().some((m) => m.indexOf('✅ បានកំណត់ទីតាំង L-02') !== -1)).toBe(true);
    });

    it('ទិសផ្ទុយ ៖ ទីតាំងទទេ · កញ្ចប់ដដែល · អ្នកកាន់យករួច ➜ ចុះភ្លាមដូចគ្នា', () => {
        seed([
            { id: 'a', phone: '0961111111', barcodes: [{ code: 'ZTA001', locker: 'L-02', isClosed: false }, { code: 'ZTA002', isClosed: false }] },
            { id: 'b', phone: '0962222222', barcodes: [{ code: 'ZTB001', isClosed: false }] },
            { id: 'c', phone: '0963333333', barcodes: [{ code: 'ZTC001', locker: 'L-05', isClosed: true }] }
        ]);
        uiState.activeLocker = 'L-09';
        step(() => { handleLockerScan('ZTB001'); });
        expect(warnOpen()).toBe(false);
        expect(transaction).toHaveBeenCalledTimes(1);
        uiState.activeLocker = 'L-02';
        step(() => { handleLockerScan('ZTA002'); });
        expect(warnOpen()).toBe(false);
        expect(transaction).toHaveBeenCalledTimes(2);
        uiState.activeLocker = 'L-05';
        step(() => { handleLockerScan('ZTB001'); });
        expect(warnOpen()).toBe(false);
        expect(transaction).toHaveBeenCalledTimes(3);
    });

    it('កញ្ចប់មានទីតាំងស្រាប់ ➜ ស្កេនចូលទីតាំងផ្សេង ➜ ប្រអប់ «ផ្លាស់ទី» (ចំណាំអ្នកកាន់) · «យល់ព្រម» ទើបចុះ · «បោះបង់» មិនចុះ', () => {
        seed([
            { id: 'a', phone: '0961111111', barcodes: [{ code: 'ZTA001', locker: 'L-01', isClosed: false }] },
            { id: 'b', phone: '0962222222', barcodes: [{ code: 'ZTB001', locker: 'L-02', isClosed: false }] }
        ]);
        step(() => { handleLockerScan('ZTA001'); });
        expect(warnOpen()).toBe(true);
        expect(transaction).not.toHaveBeenCalled();
        expect(uiState.pendingLockerCode).toBe('ZTA001');
        expect(viewState.locationWarningText).toMatch(/ផ្លាស់ទី/);
        expect(viewState.locationWarningText).toMatch(/ZTB001/);
        expect(viewState.locationWarningText).toMatch(/0962222222/);
        expect(byId('locationWarningModal').textContent || '').toMatch(/កញ្ចប់នេះមានទីតាំងស្រាប់/);
        step(() => { cancelLocationChange(); });
        expect(warnOpen()).toBe(false);
        expect(transaction).not.toHaveBeenCalled();
        step(() => { handleLockerScan('ZTA001'); });
        expect(warnOpen()).toBe(true);
        step(() => { confirmLocationChange(); });
        expect(warnOpen()).toBe(false);
        expect(transaction).toHaveBeenCalledTimes(1);
        expect(uiState.pendingLockerCode).toBe(null);
    });

    it('ទីតាំងដដែល ➜ toast «រួចហើយ» · គ្មានប្រអប់ · មិនសរសេរ', () => {
        seed([{ id: 'a', phone: '0961111111', barcodes: [{ code: 'ZTA001', locker: 'L-02', isClosed: false }] }]);
        step(() => { handleLockerScan('ZTA001'); });
        expect(warnOpen()).toBe(false);
        expect(transaction).not.toHaveBeenCalled();
        expect(toasts().some((m) => m.indexOf('រួចហើយ') !== -1)).toBe(true);
    });
});
