/**
 * សំណើម្ចាស់គម្រោង (Deep audit ជុំ ៦ ➜ អនុម័ត) ៖ ស្កេនកញ្ចប់ **គ្មានទីតាំងពីមុន** ចូលទីតាំង Locker ដែលមានកញ្ចប់ **អតិថិជនផ្សេង** (មិនទាន់យក)
 *   ➜ ប្រអប់សួរបញ្ជាក់ (ដូចការផ្លាស់ទីពីទីតាំងចាស់) មិនមែនចុះភ្លាមស្ងាត់ ➜ «យល់ព្រម» ទើបចុះ។
 *   ទិសផ្ទុយ ៖ ទីតាំងទទេ · កញ្ចប់ដដែល (barcode ផ្សេងរបស់អតិថិជនដដែល) · អ្នកកាន់បានយករួច (បិទ) ➜ ចុះភ្លាម គ្មានប្រអប់ ·
 *   ការផ្លាស់ទីពីទីតាំងចាស់នៅតែជាប្រអប់ «ផ្លាស់ទី» ដូចដើម។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LocationWarningModal } from '../src/app/components/modals/LocationWarningModal';
import { dataState, firebaseState, uiState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { buildLockerBarcodeIndex } from '../src/features/locker';
import { cancelLocationChange, confirmLocationChange, handleLockerScan } from '../src/features/locker-assign';
import { byId, mount, step, unmount } from './native/react-harness';

let transaction: ReturnType<typeof vi.fn>;
const savedFb = firebaseState.fb;
const warnOpen = () => uiState.modalDisplay.locationWarningModal === 'flex';

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

describe('Locker ៖ ទីតាំងមានកញ្ចប់អ្នកផ្សេង', () => {
    it('កញ្ចប់គ្មានទីតាំង ➜ ទីតាំងមានកញ្ចប់អតិថិជនផ្សេង ➜ ប្រអប់សួរ · មិនចុះ · «យល់ព្រម» ទើបចុះ', () => {
        seed([
            { id: 'a', phone: '0961111111', barcodes: [{ code: 'ZTA001', locker: 'L-02', isClosed: false }] },
            { id: 'b', phone: '0962222222', barcodes: [{ code: 'ZTB001', isClosed: false }] }
        ]);
        step(() => { handleLockerScan('ZTB001'); });
        expect(warnOpen()).toBe(true);
        expect(transaction).not.toHaveBeenCalled();
        expect(uiState.pendingLockerCode).toBe('ZTB001');
        expect(viewState.locationWarningText).toMatch(/ZTA001/);
        expect(viewState.locationWarningText).toMatch(/0961111111/);
        expect(viewState.locationWarningText).toMatch(/L-02/);
        const modalText = byId('locationWarningModal').textContent || '';
        expect(modalText).toMatch(/អ្នកផ្សេង/);
        expect(modalText).not.toMatch(/កញ្ចប់នេះមានទីតាំងស្រាប់/);
        step(() => { confirmLocationChange(); });
        expect(transaction).toHaveBeenCalledTimes(1);
        expect(uiState.pendingLockerCode).toBe(null);
    });

    it('«បោះបង់» ➜ មិនចុះ · ប្រអប់បិទ', () => {
        seed([
            { id: 'a', phone: '0961111111', barcodes: [{ code: 'ZTA001', locker: 'L-02', isClosed: false }] },
            { id: 'b', phone: '0962222222', barcodes: [{ code: 'ZTB001', isClosed: false }] }
        ]);
        step(() => { handleLockerScan('ZTB001'); });
        expect(warnOpen()).toBe(true);
        step(() => { cancelLocationChange(); });
        expect(warnOpen()).toBe(false);
        expect(transaction).not.toHaveBeenCalled();
    });

    it('ទិសផ្ទុយ ៖ ទីតាំងទទេ · កញ្ចប់ដដែល · អ្នកកាន់យករួច ➜ ចុះភ្លាម គ្មានប្រអប់', () => {
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

    it('ទិសផ្ទុយ ៖ ផ្លាស់ទីពីទីតាំងចាស់ ➜ ប្រអប់ «ផ្លាស់ទី» ដូចដើម (មានចំណាំអ្នកកាន់)', () => {
        seed([
            { id: 'a', phone: '0961111111', barcodes: [{ code: 'ZTA001', locker: 'L-01', isClosed: false }] },
            { id: 'b', phone: '0962222222', barcodes: [{ code: 'ZTB001', locker: 'L-02', isClosed: false }] }
        ]);
        step(() => { handleLockerScan('ZTA001'); });
        expect(warnOpen()).toBe(true);
        expect(transaction).not.toHaveBeenCalled();
        expect(viewState.locationWarningText).toMatch(/ផ្លាស់ទី/);
        expect(viewState.locationWarningText).toMatch(/ZTB001/);
        expect(byId('locationWarningModal').textContent || '').toMatch(/កញ្ចប់នេះមានទីតាំងស្រាប់/);
    });
});
