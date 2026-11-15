import { expect, it } from 'vitest';
import { callPartialBackendFixtureMethod, setPartialBackendFixtureValue } from './helpers/backend-fixture';

it('partial fixture assignment រក្សាតម្លៃដើម identity និង chained result', () => {
    const first = {}, second = {}, fixture = { currentUser: { uid: 'partial-user' } };
    const value = setPartialBackendFixtureValue(first, 'auth', setPartialBackendFixtureValue(second, 'auth', fixture));
    expect(value).toBe(fixture);
    expect(Reflect.get(first, 'auth')).toBe(fixture);
    expect(Reflect.get(second, 'auth')).toBe(fixture);
});

it('partial fixture assignment ឆ្លង setter ដដែលម្ដង ហើយ readonly failure នៅបរាជ័យ', () => {
    const seen: unknown[] = [];
    const target = { set auth(value: unknown) { seen.push(value); } };
    const fixture = { uid: 'partial-user' };
    expect(setPartialBackendFixtureValue(target, 'auth', fixture)).toBe(fixture);
    expect(seen).toEqual([fixture]);
    expect(() => setPartialBackendFixtureValue(Object.freeze({ auth: null }), 'auth', fixture)).toThrow(TypeError);
});

it('partial fixture invocation រក្សា receiver arguments និង return identity', () => {
    const value = { committed: false };
    const target = { invoke(this: object, input: unknown) { expect(this).toBe(target); expect(input).toBe(value); return value; } };
    expect(callPartialBackendFixtureMethod(target, 'invoke', [value])).toBe(value);
    expect(() => callPartialBackendFixtureMethod({}, 'missing', [])).toThrow(TypeError);
});
