import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { firebaseState } from '../src/core/state';
import { TX_OUTCOME_MAX_WAIT_MS, TX_OUTCOME_READ_TIMEOUT_MS, txReadServerValue, txResolveOutcome } from '../src/services/tx-outcome';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('សាលក្រម transaction ៖ ពិដានត្រូវគ្រប ID token និង body', () => {
    it('getIdToken ព្យួរ ➜ ការអានត្រូវបញ្ចប់ក្នុងពិដាន', async () => {
        firebaseState.auth = { currentUser: { getIdToken: () => new Promise(() => {}) } } as any;
        const fetch = vi.fn();
        vi.stubGlobal('fetch', fetch);
        let settled = false;
        void txReadServerValue('https://example.firebaseio.com/a.json').then(() => { settled = true; }, () => { settled = true; });
        await vi.advanceTimersByTimeAsync(TX_OUTCOME_READ_TIMEOUT_MS + 1);
        expect(settled).toBe(true);
        expect(fetch).not.toHaveBeenCalled();
    });

    it('getIdToken ព្យួរ ➜ សាលក្រមសរុបមិនរង់ចាំលើសពិដាន', async () => {
        firebaseState.auth = { currentUser: { getIdToken: () => new Promise(() => {}) } } as any;
        let outcome = '';
        void txResolveOutcome('https://example.firebaseio.com/a.json', 7, 10).then((result) => { outcome = result.outcome; });
        await vi.advanceTimersByTimeAsync(TX_OUTCOME_MAX_WAIT_MS + 1);
        expect(outcome).toBe('unknown');
    });

    it('token មកក្រោយពិដាន ➜ មិនបង្កើតសំណើដែលគ្មានអ្នករង់ចាំ', async () => {
        let resolve!: (value: string) => void;
        firebaseState.auth = { currentUser: { getIdToken: () => new Promise<string>((yes) => { resolve = yes; }) } } as any;
        const fetch = vi.fn(async () => new Response('7'));
        vi.stubGlobal('fetch', fetch);
        void txReadServerValue('https://example.firebaseio.com/a.json').catch(() => {});
        await vi.advanceTimersByTimeAsync(TX_OUTCOME_READ_TIMEOUT_MS + 1);
        resolve('audit-token');
        await vi.advanceTimersByTimeAsync(0);
        expect(fetch).not.toHaveBeenCalled();
    });

    it('token និង REST ឆ្លើយទាន់ពេល ➜ រកឃើញការសរសេរដដែល', async () => {
        firebaseState.auth = { currentUser: { getIdToken: async () => 'audit-token' } } as any;
        vi.stubGlobal('fetch', vi.fn(async () => new Response('7')));
        expect(await txResolveOutcome('https://example.firebaseio.com/a.json', 7, 10)).toEqual({ outcome: 'applied', server: 7 });
    });
});
