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

for (const mode of ['throw', 'absent', 'reject']) it('transport ' + mode + ' ៖ បញ្ចប់ភ្លាម និងដោះ timer/listener ទាំងអស់', async () => {
  const source = new AbortController();
  const added = vi.spyOn(window, 'addEventListener'); const removed = vi.spyOn(window, 'removeEventListener');
  const removeAbort = vi.spyOn(source.signal, 'removeEventListener');
  const error = new TypeError('synthetic transport unavailable');
  vi.stubGlobal('fetch', mode === 'absent' ? undefined : mode === 'throw' ? () => { throw error; } : () => Promise.reject(error));
  await expect(fetchWithTimeout('https://example.invalid/data', { signal: source.signal }, 20000, '')).rejects.toBeInstanceOf(TypeError);
  expect(vi.getTimerCount()).toBe(0);
  expect(removeAbort).toHaveBeenCalledWith('abort', expect.any(Function));
  expect(added.mock.calls.filter(x => String(x[0]) === 'storage').length).toBe(removed.mock.calls.filter(x => String(x[0]) === 'storage').length);
});

it('request ព្យួរ ➜ timeout ➜ request ថ្មីជោគជ័យ ហើយចម្លើយចាស់មិនត្រឡប់មកប្រើ', async () => {
  let late!: (value: Response) => void;
  const published = vi.fn();
  vi.stubGlobal('fetch', vi.fn().mockImplementationOnce(() => new Promise<Response>(resolve => { late = resolve; }))
    .mockResolvedValueOnce(new Response('{"value":2}')));
  const first = fetchWithTimeout('https://example.invalid/data', {}, 20000, 'ceiling', r => r.json());
  const rejected = expect(first).rejects.toThrow('ceiling');
  void first.then(published, () => {});
  await vi.advanceTimersByTimeAsync(20001); await rejected;
  expect((await fetchWithTimeout('https://example.invalid/data', {}, 20000, '', r => r.json())).body.value).toBe(2);
  late(new Response('{"value":1}')); await turn();
  expect(published).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});

it('body យឺតតែនៅក្នុងពិដាន ➜ ជោគជ័យ មិនកាត់ការភ្ជាប់', async () => {
  let body!: (value: unknown) => void; let signal!: AbortSignal;
  vi.stubGlobal('fetch', async (_url: unknown, options: RequestInit) => { signal = options.signal!; return new Response('{}'); });
  const pending = fetchWithTimeout('https://example.invalid/data', {}, 20000, '', () => new Promise(resolve => { body = resolve; }));
  await turn(); await vi.advanceTimersByTimeAsync(19999); body({ value: 3 });
  expect((await pending).body.value).toBe(3);
  expect(signal.aborted).toBe(false);
  expect(vi.getTimerCount()).toBe(0);
});

it('អ្នកហៅ cancel ➜ ដោះ lease ហើយ request បន្ទាប់នៅប្រើបាន', async () => {
  const source = new AbortController();
  vi.stubGlobal('fetch', vi.fn().mockImplementationOnce(() => new Promise(() => {})).mockResolvedValueOnce(new Response('{}')));
  const first = fetchWithTimeout('https://example.invalid/data', { signal: source.signal }, 20000, '');
  const rejected = expect(first).rejects.toMatchObject({ name: 'AbortError' });
  source.abort(); await rejected;
  await expect(fetchWithTimeout('https://example.invalid/data', {}, 20000, '')).resolves.toHaveProperty('res');
  expect(vi.getTimerCount()).toBe(0);
});
