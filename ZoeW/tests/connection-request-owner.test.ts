import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { firebaseState } from '../src/core/state';
import { fetchWithTimeout } from '../src/services/network';

const turn = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
beforeEach(() => { vi.useFakeTimers(); Object.assign(firebaseState, { db: {}, fb: {}, auth: { currentUser: { uid: 'A' }, _account: { tenant_id: 'A' } } }); firebaseState.authGeneration++; });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('logout aborts a hanging request immediately instead of waiting for its timeout', async () => {
  let signal!: AbortSignal; let result = 'pending';
  vi.stubGlobal('fetch', (_url: any, options: any) => { signal = options.signal; return new Promise(() => {}); });
  const pending = fetchWithTimeout('https://example.com/data', {}, 20000, '').then(() => { result = 'published'; }, (error) => { result = error.code === 'CONNECTION_SCOPE_CHANGED' ? 'ended' : 'timeout'; });
  firebaseState.authGeneration++; await turn();
  const observed = result; const aborted = signal.aborted;
  await vi.advanceTimersByTimeAsync(20000); await pending;
  expect(observed).toBe('ended'); expect(aborted).toBe(true);
});
it('a delayed response body from A cannot publish after the same UID changes tenant', async () => {
  let resolve!: (value: any) => void; let result = 'pending';
  vi.stubGlobal('fetch', async () => new Response('{}', { status: 200 }));
  const pending = fetchWithTimeout('https://example.com/data', {}, 20000, '', () => new Promise(r => { resolve = r; })).then(() => { result = 'published'; }, () => { result = 'ended'; });
  await turn(); (firebaseState.auth as any)._account = { tenant_id: 'B' }; firebaseState.touch(); await turn(); resolve({ private: 'A' }); await pending;
  expect(result).toBe('ended');
});
it('control: healthy requests release every storage observer after reading the body', async () => {
  const added = vi.spyOn(window, 'addEventListener'); const removed = vi.spyOn(window, 'removeEventListener');
  vi.stubGlobal('fetch', async () => new Response('{"value":1}', { status: 200 }));
  for (let i = 0; i < 20; i++) expect((await fetchWithTimeout('https://example.com/data', {}, 20000, '', r => r.json())).body.value).toBe(1);
  expect(added.mock.calls.filter(x => String(x[0]) === 'storage').length).toBe(removed.mock.calls.filter(x => String(x[0]) === 'storage').length);
});
