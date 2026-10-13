import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { rememberLoginPassword, forgetLoginPassword, rememberedPasswordFor } from '../src/features/password-memory';

const lab = vi.hoisted(() => ({ rows: new Map<string, any>(), hold: null as null | { mode: string; release: () => void }, pause: false }));
vi.mock('../src/services/crypto', () => ({
  lookupKeyDbRun: (mode: string, action: any) => {
    const execute = () => action({ put: (v: any, k: string) => { lab.rows.set(k, v); return true; },
      delete: (k: string) => { lab.rows.delete(k); return true; }, get: (k: string) => lab.rows.get(k) });
    if (!lab.pause) return Promise.resolve(execute());
    lab.pause = false;
    return new Promise(resolve => { lab.hold = { mode, release: () => resolve(execute()) }; });
  }
}));
vi.mock('../src/app/refs', () => ({ fieldValue: vi.fn(), setFieldChecked: vi.fn(), setFieldValue: vi.fn() }));
const deferred = <T>() => { let resolve!: (v: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; };
const until = async (predicate: () => boolean) => { for (let i = 0; i < 100; i++) { if (predicate()) return; await new Promise(r => setTimeout(r, 2)); } throw new Error('race not entered'); };
beforeEach(() => { lab.rows.clear(); lab.pause = false; lab.hold = null; vi.stubGlobal('crypto', webcrypto); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe('remembered password ownership with real AES-GCM', () => {
  it('control: encrypted B record decrypts only for B and its scope', async () => {
    expect(await rememberLoginPassword('B', 'test-B-secret', 'fb:B')).toBe(true);
    expect(await rememberedPasswordFor('B', 'fb:B')).toBe('test-B-secret');
    expect(await rememberedPasswordFor('A', 'fb:A')).toBe('');
  });
  it('slow encryption A cannot overwrite or delete a completed B save', async () => {
    const gate = deferred<ArrayBuffer>();
    const encrypt = webcrypto.subtle.encrypt.bind(webcrypto.subtle);
    let first = true, entered = false;
    vi.spyOn(webcrypto.subtle, 'encrypt').mockImplementation(async (...args: any[]) => {
      const result = await (encrypt as any)(...args);
      if (!first) return result;
      first = false; entered = true; await gate.promise; return result;
    });
    const old = rememberLoginPassword('A', 'test-A-secret', 'fb:A');
    await until(() => entered);
    expect(await rememberLoginPassword('B', 'test-B-secret', 'fb:B')).toBe(true);
    gate.resolve(new ArrayBuffer(0)); await old;
    expect(await rememberedPasswordFor('B', 'fb:B')).toBe('test-B-secret');
  });
  it('slow IndexedDB opening for save A cannot overwrite a completed B save', async () => {
    lab.pause = true;
    const old = rememberLoginPassword('A', 'test-A-secret', 'fb:A');
    await until(() => lab.hold !== null);
    expect(await rememberLoginPassword('B', 'test-B-secret', 'fb:B')).toBe(true);
    lab.hold!.release(); await old;
    expect(await rememberedPasswordFor('B', 'fb:B')).toBe('test-B-secret');
  });
  it('slow IndexedDB opening for old forget cannot delete a newer B save', async () => {
    lab.pause = true;
    const old = forgetLoginPassword();
    expect(lab.hold).not.toBeNull();
    expect(await rememberLoginPassword('B', 'test-B-secret', 'fb:B')).toBe(true);
    lab.hold!.release(); await old;
    expect(await rememberedPasswordFor('B', 'fb:B')).toBe('test-B-secret');
  });
});
