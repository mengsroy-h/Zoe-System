/**
 * ⛔ «App ជាប់» ៖ ការផ្ទៀងផ្ទាត់ License ក្រោយចូលប្រព័ន្ធ (ឬស្តារវគ្គក្រោយ reload) អាចលើស ២០ វិ. លើបណ្តាញយឺត
 *    (`checkOnline()` = Key + កៅអី · សំណើនីមួយៗរហូតដល់ ១០ វិ.) ➜ ជំនាន់មុនចេញ toast «សូមសាកល្បងចូលម្តងទៀត» ហើយឈប់ ៖
 *    គ្មានប្រអប់ចូល (វគ្គនៅរស់) · គ្មាន listener ➜ App ទទេ រហូតដល់ reload។
 *    ⛔ ឥឡូវ ៖ សាកម្តងទៀតដោយស្វ័យប្រវត្តិតាមជណ្តើរមានព្រំដែន · toast តែម្តង · ការប្តូរវគ្គ (ចាកចេញ/អ្នកប្រើផ្សេង) បោះបង់ · ផុតជណ្តើរ ➜ សារណែនាំបិទបើក។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { firebaseState, uiState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import {
    ACTIVATION_GIVE_UP_TOAST, ACTIVATION_RETRY_STEPS_MS, ACTIVATION_RETRY_TOAST, cancelActivationRetry, proceedAfterLogin
} from '../src/features/license';

const texts = () => uiState.toasts.map((t: any) => t.msg);
const user = { uid: 'u1' };

async function flush() {
    for (let i = 0; i < 10; i++) await Promise.resolve();
}

beforeEach(() => {
    vi.useFakeTimers();
    uiState.toasts = [];
    viewState.backendKind = 'firebase';
    firebaseState.auth = { currentUser: user } as any;
    firebaseState.authGeneration = 7;
    (window as any).ZoeErrors = { capture: vi.fn() };
});

afterEach(() => {
    cancelActivationRetry();
    vi.useRealTimers();
    delete (window as any).ZoeLicense;
    firebaseState.auth = null;
    uiState.toasts = [];
});

describe('ការផ្ទៀងផ្ទាត់ License ធ្លាក់ក្រោយចូលប្រព័ន្ធ', () => {
    it('ធ្លាក់ ➜ សាកម្តងទៀតដោយស្វ័យប្រវត្តិ (toast តែម្តង) ➜ ជោគជ័យ ➜ ឈប់សាក', async () => {
        const getStatus = vi.fn(async (): Promise<any> => { throw new Error('network stalled'); });
        (window as any).ZoeLicense = { getStatus };
        await proceedAfterLogin(user, 7);
        await flush();
        expect(getStatus).toHaveBeenCalledTimes(1);
        expect(texts()).toEqual([ACTIVATION_RETRY_TOAST]);
        getStatus.mockImplementation(async () => { throw new Error('still down'); });
        vi.advanceTimersByTime(ACTIVATION_RETRY_STEPS_MS[0]);
        await flush();
        expect(getStatus).toHaveBeenCalledTimes(2);
        expect(texts().filter((t) => t === ACTIVATION_RETRY_TOAST).length).toBe(0);
        getStatus.mockImplementation(async () => ({ state: 'required' }));
        vi.advanceTimersByTime(ACTIVATION_RETRY_STEPS_MS[1]);
        await flush();
        expect(getStatus).toHaveBeenCalledTimes(3);
        vi.advanceTimersByTime(ACTIVATION_RETRY_STEPS_MS[3] * 4);
        await flush();
        expect(getStatus).toHaveBeenCalledTimes(3);
    });

    it('⛔ ចាកចេញ/ប្តូរវគ្គខណៈរង់ចាំ ➜ មិនសាកលើវគ្គចាស់', async () => {
        const getStatus = vi.fn(async () => { throw new Error('down'); });
        (window as any).ZoeLicense = { getStatus };
        await proceedAfterLogin(user, 7);
        await flush();
        firebaseState.authGeneration = 8;
        vi.advanceTimersByTime(ACTIVATION_RETRY_STEPS_MS[0] + 10);
        await flush();
        expect(getStatus).toHaveBeenCalledTimes(1);
    });

    it('ជណ្តើរអស់ ➜ សារណែនាំបិទបើក App (មិនសាកជារៀងរហូត)', async () => {
        const getStatus = vi.fn(async () => { throw new Error('down'); });
        (window as any).ZoeLicense = { getStatus };
        await proceedAfterLogin(user, 7);
        for (const step of ACTIVATION_RETRY_STEPS_MS) {
            await flush();
            vi.advanceTimersByTime(step);
            await flush();
        }
        await flush();
        expect(getStatus).toHaveBeenCalledTimes(ACTIVATION_RETRY_STEPS_MS.length + 1);
        expect(texts()).toContain(ACTIVATION_GIVE_UP_TOAST);
        vi.advanceTimersByTime(600000);
        await flush();
        expect(getStatus).toHaveBeenCalledTimes(ACTIVATION_RETRY_STEPS_MS.length + 1);
    });
});
