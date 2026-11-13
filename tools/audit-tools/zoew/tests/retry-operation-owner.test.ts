import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { firebaseState } from '../../../../ZoeW/src/core/state';
import { appLocalStore } from '../../../../ZoeW/src/core/storage';
import { captureConnectionOperation } from '../../../../ZoeW/src/services/connection-flow';
import { retryAsync } from '../../../../ZoeW/src/services/network';

beforeEach(() => {
    vi.useFakeTimers();
    firebaseState.auth = { currentUser: { uid: 'retry-owner' }, _account: { tenant_id: 'original' } } as any;
    firebaseState.authGeneration++;
    appLocalStore.removeItem('zoew_firebase_config');
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); appLocalStore.removeItem('zoew_firebase_config'); });

it.each(['generation', 'uid', 'logout', 'auth', 'db', 'sdk', 'tenant', 'config'])('retry រក្សាម្ចាស់ប្រតិបត្តិការដើម៖ %s ប្តូរ ➜ ឈប់', async (kind) => {
    const operation = vi.fn().mockRejectedValue(new Error('transient'));
    const result = retryAsync(operation, 3, 100, captureConnectionOperation()).catch((error) => error);
    await vi.advanceTimersByTimeAsync(0);
    if (kind === 'generation') firebaseState.authGeneration++;
    else if (kind === 'uid') firebaseState.auth.currentUser = { uid: 'other' } as any;
    else if (kind === 'logout') firebaseState.auth.currentUser = null;
    else if (kind === 'auth') firebaseState.auth = { currentUser: { uid: 'retry-owner' } } as any;
    else if (kind === 'db') firebaseState.db = {} as any;
    else if (kind === 'sdk') firebaseState.fb = {} as any;
    else if (kind === 'tenant') firebaseState.auth._account.tenant_id = 'other';
    else appLocalStore.setItem('zoew_firebase_config', '{"projectId":"other"}');
    await vi.advanceTimersByTimeAsync(1000);
    expect(operation).toHaveBeenCalledTimes(1);
    expect(await result).toMatchObject({ code: 'CONNECTION_SCOPE_CHANGED', noRetry: true });
});

it('វគ្គដដែល ➜ រក្សា retry និងចម្លើយជោគជ័យ', async () => {
    const operation = vi.fn().mockRejectedValueOnce(new Error('transient')).mockResolvedValue('committed');
    const result = retryAsync(operation, 3, 100, captureConnectionOperation());
    await vi.advanceTimersByTimeAsync(100);
    expect(await result).toBe('committed');
    expect(operation).toHaveBeenCalledTimes(2);
});

it('ការសរសេរកំពុងរត់បានសម្រេចក្រោយប្តូរវគ្គ ➜ មិនបាំងលទ្ធផល commit', async () => {
    let resolve!: (value: unknown) => void;
    const pending = new Promise((yes) => { resolve = yes; });
    const operation = vi.fn(() => pending);
    const result = retryAsync(operation, 3, 100, captureConnectionOperation());
    firebaseState.authGeneration++;
    resolve({ committed: true });
    expect(await result).toEqual({ committed: true });
    expect(operation).toHaveBeenCalledTimes(1);
});
