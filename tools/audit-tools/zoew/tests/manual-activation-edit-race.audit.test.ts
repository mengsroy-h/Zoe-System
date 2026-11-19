import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { firebaseState, uiState } from '../../../../ZoeW/src/core/state';
import { viewState } from '../../../../ZoeW/src/core/view-state';
import { clearSeatEnrollment, submitActivationKey } from '../../../../ZoeW/src/features/license';
import { acceptFixtureSession, configureFixtureBackend } from './helpers/accepted-session';
import { setPartialBackendFixtureValue } from './helpers/backend-fixture';

const fields = vi.hoisted(() => ({ activationKeyInput: '' }));
vi.mock('../../../../ZoeW/src/app/refs', () => ({
    fieldValue: () => fields.activationKeyInput,
    setFieldValue: (_id: string, value: string) => { fields.activationKeyInput = value; }, focusField: vi.fn()
}));
vi.mock('../../../../ZoeW/src/core/timezone', () => ({ safeFocusScanner: vi.fn() }));

beforeEach(() => {
    configureFixtureBackend('manual-activation-edit-race');
    firebaseState.auth = { currentUser: { uid: 'synthetic-user' } } as any;
    firebaseState.authGeneration++;
    firebaseState.db = {} as any;
    setPartialBackendFixtureValue(firebaseState, 'fb', {});
    firebaseState.isDatabaseInitialized = true;
    firebaseState.serverClockTrusted = true; firebaseState.sessionExpiryCheck = 'live';
    acceptFixtureSession();
    viewState.backendKind = 'firebase'; viewState.activationBusy = false;
    uiState.modalDisplay = { activationModal: 'flex' }; uiState.toasts = [];
    clearSeatEnrollment(); fields.activationKeyInput = 'ZOEKEY-synthetic-first';
});
afterEach(() => { clearSeatEnrollment(); vi.unstubAllGlobals(); });

for (const outcome of ['failure', 'success', 'error']) for (const change of ['input', 'input-restored', 'session', 'none']) {
    it('ចម្លើយ Active ' + outcome + ' យឺតជាមួយ ' + change + ' មិនលុប Key ដែលកំពុងកែថ្មី', async () => {
        let resolve!: (value: any) => void;
        let reject!: (error: Error) => void;
        const activate = vi.fn((_key: string, _app: string, _current?: () => boolean) => new Promise((yes, no) => { resolve = yes; reject = no; }));
        const getStatus = vi.fn(async () => ({ state: 'inactive', reason: 'network' }));
        vi.stubGlobal('ZoeLicense', { activate, getStatus });
        const pending = submitActivationKey();
        expect(activate).toHaveBeenCalledOnce(); expect(viewState.activationBusy).toBe(true);
        const current = activate.mock.calls[0][2];
        expect(typeof current).toBe('function');
        expect(current!()).toBe(true);
        if (change !== 'none') {
            fields.activationKeyInput = 'ZOEKEY-synthetic-second';
            clearSeatEnrollment();
        }
        if (change === 'input-restored') fields.activationKeyInput = 'ZOEKEY-synthetic-first';
        if (change === 'session') firebaseState.authGeneration++;
        const expectedInput = change === 'input-restored' ? 'ZOEKEY-synthetic-first' : 'ZOEKEY-synthetic-second';
        expect(current!()).toBe(change === 'none');
        if (outcome === 'error') reject(new Error('synthetic verification unavailable'));
        else resolve({ valid: outcome === 'success', reason: 'network' });
        await pending;
        expect(fields.activationKeyInput).toBe(change === 'none' ? (outcome === 'error' ? 'ZOEKEY-synthetic-first' : '') : expectedInput);
        expect(viewState.activationBusy).toBe(false);
        expect(getStatus).toHaveBeenCalledTimes(change === 'none' && outcome === 'success' ? 1 : 0);
        if (change !== 'none') expect(uiState.toasts).toEqual([]);
    });
}
