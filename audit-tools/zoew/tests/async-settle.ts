import { expect } from 'vitest';
import { step } from './native/react-harness';

let pending = 0;
let subtleTracked = false;

export function beginAsync() {
    pending++;
    let open = true;
    return () => {
        if (!open) return;
        open = false;
        pending--;
    };
}

export function trackAsync<T>(work: Promise<T>): Promise<T> {
    const end = beginAsync();
    return work.finally(end);
}

export function trackCryptoSubtle() {
    if (subtleTracked) return;
    subtleTracked = true;
    const real = crypto.subtle;
    const counted = new Proxy(real, {
        get(target, prop) {
            const value = (target as any)[prop];
            return typeof value === 'function' ? (...args: unknown[]) => trackAsync(value.apply(target, args)) : value;
        }
    });
    Object.defineProperty(crypto, 'subtle', { configurable: true, get: () => counted });
}

export async function settleAsync(minTurns: number) {
    let quiet = 0;
    for (let i = 0; i < 2000 && (i < minTurns || quiet < 3); i++) {
        for (let j = 0; j < 8; j++) await Promise.resolve();
        await new Promise((r) => setTimeout(r, 0));
        quiet = pending === 0 ? quiet + 1 : 0;
    }
    expect(pending).toBe(0);
    step(() => {});
}
