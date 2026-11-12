import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { firebaseState, securityState, uiState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import * as license from '../src/features/license';
import { closeModal } from '../src/ui/modal';
import { handleNativeBack } from '../src/app/lifecycle/native-shell';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { mount, unmount } from './native/react-harness';
import { ActivationModal } from '../src/app/components/modals/ActivationModal';
let input = '';
vi.mock('../src/app/refs', () => ({ refTo: () => () => {}, fieldValue: () => input, setFieldValue: (_id: string, value: string) => { input = value; }, focusField: vi.fn() }));
vi.mock('../src/core/timezone', () => ({ safeFocusScanner: vi.fn() }));
const api = () => license as any;
beforeEach(() => {
    firebaseState.auth = { currentUser: { uid: 'enrollment-user' } } as any; firebaseState.authGeneration++;
    firebaseState.db = {} as any; firebaseState.isDatabaseInitialized = true;
    viewState.backendKind = 'firebase'; input = 'ZOEKEY-synthetic'; uiState.modalDisplay = {}; uiState.isModalOpen = false;
    api().clearSeatEnrollment?.();
});
afterEach(() => { unmount(); vi.unstubAllGlobals(); api().clearSeatEnrollment?.(); });
describe('ការរៀបចំសំណើចុះឈ្មោះឧបករណ៍', () => {
    it('បង្ហាញ JSON និង fingerprint ដោយមិនចម្លង clipboard ឬដាក់ Active', async () => {
        const enrollment = { payload: 'public-payload', signature: 'public-signature', fingerprint: 'a'.repeat(64) };
        const activate = vi.fn();
        vi.stubGlobal('ZoeLicense', { createSeatEnrollment: vi.fn(async () => ({ valid: true, enrollment })), activate });
        await api().prepareSeatEnrollment();
        expect(JSON.parse((viewState as any).seatEnrollmentJson)).toEqual(enrollment);
        expect((viewState as any).seatEnrollmentFingerprint).toBe(enrollment.fingerprint); expect(activate).not.toHaveBeenCalled();
    });
    it.each(['key', 'session', 'clear'])('លទ្ធផលចាស់មិនបង្ហាញក្រោយ %s ប្ដូរ', async reason => {
        let resolve!: (value: any) => void;
        vi.stubGlobal('ZoeLicense', { createSeatEnrollment: () => new Promise(r => { resolve = r; }) });
        const pending = api().prepareSeatEnrollment();
        if (reason === 'key') input = 'ZOEKEY-new';
        if (reason === 'session') firebaseState.authGeneration++;
        if (reason === 'clear') api().clearSeatEnrollment();
        resolve({ valid: true, enrollment: { payload: 'late', signature: 'late', fingerprint: 'b'.repeat(64) } }); await pending;
        expect((viewState as any).seatEnrollmentJson).toBe('');
    });
    it('អាចប្រើ Key ដែលបាន Activate ហើយ ដោយមិនបង្ខំឱ្យបញ្ចូលឡើងវិញ', async () => {
        input = ''; const createSeatEnrollment = vi.fn(async () => ({ valid: false, reason: 'identity-corrupt' }));
        vi.stubGlobal('ZoeLicense', { activationKeyString: () => 'ZOEKEY-saved', createSeatEnrollment });
        await api().prepareSeatEnrollment(); expect(createSeatEnrollment).toHaveBeenCalledWith('ZOEKEY-saved', 'ZOE');
        expect((viewState as any).seatEnrollmentJson).toBe('');
        expect((viewState as any).seatEnrollmentMessage).toContain('អ្នកលក់');
    });
    it('បង្ហាញ textarea ដែលអាចជ្រើសអត្ថបទ ដោយគ្មាន clipboard action', () => {
        (viewState as any).seatEnrollmentJson = '{"payload":"public"}';
        (viewState as any).seatEnrollmentFingerprint = 'a'.repeat(64);
        const html = renderToStaticMarkup(createElement(ActivationModal));
        expect(html).toContain('id="seatEnrollmentPrepareBtn"');
        expect(html).toContain('id="seatIdentityRepairBtn"');
        expect(html).toMatch(/id="seatEnrollmentJson"[^>]*readOnly=""/i);
        expect(html).toContain('id="seatEnrollmentFingerprint"');
    });
    it('ប្រអប់ចុះឈ្មោះសម្រាប់អ្នកកំពុងប្រើអាចបិទវិញ ដោយមិនបិទការទាមទារ Active', () => {
        api().openSeatEnrollment(); securityState.pinTargetAction();
        expect((viewState as any).seatEnrollmentOnly).toBe(true);
        api().closeSeatEnrollment(); expect((viewState as any).seatEnrollmentOnly).toBe(false);
        uiState.modalDisplay.activationModal = 'flex'; api().openSeatEnrollment();
        expect((viewState as any).seatEnrollmentOnly).toBe(false);
    });
});

describe('ការជួសជុលកូនសោឧបករណ៍ដោយមានការយល់ព្រម', () => {
    function setup() {
        uiState.modalDisplay.activationModal = 'flex';
        const repairToken = {};
        const inspectSeatIdentity = vi.fn(async () => ({ valid: true, repairToken, keyId: 'license-synthetic' }));
        const repairSeatIdentity = vi.fn(async (_token, isCurrent) => ({ valid: isCurrent() }));
        const activate = vi.fn();
        const createSeatEnrollment = vi.fn();
        vi.stubGlobal('ZoeLicense', { inspectSeatIdentity, repairSeatIdentity, activate, createSeatEnrollment });
        vi.stubGlobal('confirm', vi.fn(() => true));
        return { inspectSeatIdentity, repairSeatIdentity, activate, createSeatEnrollment };
    }
    it('បោះបង់ការយល់ព្រមមិនប្ដូរកូនសោ', async () => {
        const { repairSeatIdentity } = setup(); vi.stubGlobal('confirm', vi.fn(() => false));
        await api().repairSeatEnrollmentIdentity();
        expect(confirm).toHaveBeenCalledWith(expect.stringContaining('license-synthetic'));
        expect(repairSeatIdentity).not.toHaveBeenCalled();
        expect(viewState.seatEnrollmentBusy).toBe(false);
    });
    it.each(['healthy', 'missing', 'storage', 'unknown'])('មិនជួសជុលពេល %s', async reason => {
        const { inspectSeatIdentity, repairSeatIdentity } = setup();
        inspectSeatIdentity.mockResolvedValue({ valid: false, reason } as any);
        await api().repairSeatEnrollmentIdentity();
        expect(confirm).not.toHaveBeenCalled(); expect(repairSeatIdentity).not.toHaveBeenCalled();
    });
    it.each(['key', 'session', 'user', 'database', 'close', 'close-reopen', 'back', 'clear', 'backend'])('បដិសេធលទ្ធផលពិនិត្យចាស់ក្រោយ %s', async reason => {
        const { inspectSeatIdentity, repairSeatIdentity } = setup();
        if (reason === 'back') mount(createElement(ActivationModal));
        let resolve!: (value: any) => void;
        inspectSeatIdentity.mockImplementation(() => new Promise(r => { resolve = r; }));
        const pending = api().repairSeatEnrollmentIdentity();
        if (reason === 'key') input = 'ZOEKEY-other';
        if (reason === 'session') firebaseState.authGeneration++;
        if (reason === 'user') firebaseState.auth.currentUser = { uid: 'different-user' } as any;
        if (reason === 'close-reopen') { closeModal('activationModal'); uiState.modalDisplay.activationModal = 'flex'; }
        if (reason === 'back') handleNativeBack(vi.fn());
        if (reason === 'database') firebaseState.db = {} as any;
        if (reason === 'close') uiState.modalDisplay.activationModal = 'none';
        if (reason === 'clear') api().clearSeatEnrollment();
        if (reason === 'backend') viewState.backendKind = 'supabase';
        resolve({ valid: true, repairToken: {}, keyId: 'license-synthetic' }); await pending;
        expect(confirm).not.toHaveBeenCalled(); expect(repairSeatIdentity).not.toHaveBeenCalled();
    });
    it('ពិនិត្យម្ចាស់ម្តងទៀតក្រោយយល់ព្រម', async () => {
        const { repairSeatIdentity } = setup();
        vi.stubGlobal('confirm', vi.fn(() => { api().clearSeatEnrollment(); return true; }));
        await api().repairSeatEnrollmentIdentity(); expect(repairSeatIdentity).not.toHaveBeenCalled();
    });
    it('ជួសជុលហើយនៅតែត្រូវចុះឈ្មោះ និងសុំអ្នកលក់', async () => {
        const { repairSeatIdentity, activate, createSeatEnrollment } = setup();
        await api().repairSeatEnrollmentIdentity();
        expect(repairSeatIdentity).toHaveBeenCalledOnce();
        expect(activate).not.toHaveBeenCalled(); expect(createSeatEnrollment).not.toHaveBeenCalled();
        expect(viewState.seatEnrollmentMessage).toContain('អ្នកលក់');
        expect(viewState.seatEnrollmentMessage).toContain('ចុះឈ្មោះឧបករណ៍');
        expect(viewState.seatEnrollmentJson).toBe(''); expect(viewState.seatEnrollmentBusy).toBe(false);
    });
    it('ការជួសជុលកំពុងរង់ចាំទទួល guard ដែលបាត់សុពលភាពក្រោយបោះបង់', async () => {
        const { repairSeatIdentity } = setup();
        let guard!: () => boolean; let resolve!: (value: any) => void;
        repairSeatIdentity.mockImplementation((_token, current) => { guard = current; return new Promise(r => { resolve = r; }); });
        const pending = api().repairSeatEnrollmentIdentity();
        await vi.waitFor(() => expect(repairSeatIdentity).toHaveBeenCalled());
        expect(guard()).toBe(true); api().clearSeatEnrollment(); expect(guard()).toBe(false);
        resolve({ valid: true }); await pending;
        expect(viewState.seatEnrollmentMessage).toBe('');
    });
});

it('សំណើចាស់មិនបង្ហាញក្រោយបិទហើយបើកប្រអប់ឡើងវិញ', async () => {
    let resolve!: (value: any) => void;
    vi.stubGlobal('ZoeLicense', { createSeatEnrollment: () => new Promise(r => { resolve = r; }) });
    uiState.modalDisplay.activationModal = 'flex';
    const pending = api().prepareSeatEnrollment();
    closeModal('activationModal'); uiState.modalDisplay.activationModal = 'flex';
    resolve({ valid: true, enrollment: { payload: 'late', signature: 'late', fingerprint: 'c'.repeat(64) } }); await pending;
    expect(viewState.seatEnrollmentJson).toBe('');
});

it('ការផុតពេលជួសជុលធ្វើឱ្យ guard ចាស់បាត់សុពលភាព', async () => {
    vi.useFakeTimers();
    try {
        uiState.modalDisplay.activationModal = 'flex';
        let guard!: () => boolean;
        let resolve!: (value: any) => void;
        vi.stubGlobal('confirm', () => true);
        vi.stubGlobal('ZoeLicense', {
            inspectSeatIdentity: async () => ({ valid: true, repairToken: {}, keyId: 'license-timeout' }),
            repairSeatIdentity: (_token, current) => { guard = current; return new Promise(r => { resolve = r; }); }
        });
        const pending = api().repairSeatEnrollmentIdentity();
        await vi.advanceTimersByTimeAsync(1);
        expect(guard()).toBe(true);
        await vi.advanceTimersByTimeAsync(20000); await pending;
        expect(guard()).toBe(false);
        const message = viewState.seatEnrollmentMessage;
        expect(message).toContain('មិនអាចបញ្ជាក់');
        resolve({ valid: true }); await Promise.resolve();
        expect(viewState.seatEnrollmentMessage).toBe(message);
    } finally { vi.useRealTimers(); }
});

it('Key រក្សាទុកដែលប្ដូរពេលកំពុងពិនិត្យមិនអាចជួសជុលបាន', async () => {
    input = ''; uiState.modalDisplay.activationModal = 'flex';
    let savedKey = 'ZOEKEY-first'; let resolve!: (value: any) => void;
    const repairSeatIdentity = vi.fn(); vi.stubGlobal('confirm', vi.fn(() => true));
    vi.stubGlobal('ZoeLicense', { activationKeyString: () => savedKey,
        inspectSeatIdentity: () => new Promise(r => { resolve = r; }), repairSeatIdentity });
    const pending = api().repairSeatEnrollmentIdentity(); savedKey = 'ZOEKEY-second';
    resolve({ valid: true, repairToken: {}, keyId: 'first' }); await pending;
    expect(confirm).not.toHaveBeenCalled(); expect(repairSeatIdentity).not.toHaveBeenCalled();
});
