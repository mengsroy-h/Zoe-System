import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { firebaseState, uiState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import * as license from '../src/features/license';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
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
afterEach(() => { vi.unstubAllGlobals(); api().clearSeatEnrollment?.(); });
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
        expect(html).toMatch(/id="seatEnrollmentJson"[^>]*readOnly=""/i);
        expect(html).toContain('id="seatEnrollmentFingerprint"');
    });
    it('ប្រអប់ចុះឈ្មោះសម្រាប់អ្នកកំពុងប្រើអាចបិទវិញ ដោយមិនបិទការទាមទារ Active', () => {
        api().openSeatEnrollment(); expect((viewState as any).seatEnrollmentOnly).toBe(true);
        api().closeSeatEnrollment(); expect((viewState as any).seatEnrollmentOnly).toBe(false);
        uiState.modalDisplay.activationModal = 'flex'; api().openSeatEnrollment();
        expect((viewState as any).seatEnrollmentOnly).toBe(false);
    });
});
