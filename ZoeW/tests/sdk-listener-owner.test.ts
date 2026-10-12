import { it, expect, vi } from 'vitest';
import { createWithWindowListenerOwner } from '../src/platform/sdk-listener-owner';

it('removes owned capture listeners, preserves existing listeners, and restores the window method', () => {
    const add = window.addEventListener;
    const unrelated = vi.fn(), owned = vi.fn();
    window.addEventListener('pagehide', unrelated);
    const owner = createWithWindowListenerOwner(() => {
        window.addEventListener('pagehide', owned, { capture: true });
        return 42;
    });
    try {
        expect(owner.value).toBe(42);
        expect(window.addEventListener).toBe(add);
        window.dispatchEvent(new Event('pagehide'));
        expect(owned).toHaveBeenCalledOnce();
        owner.release();
        owner.release();
        window.dispatchEvent(new Event('pagehide'));
        expect(owned).toHaveBeenCalledOnce();
        expect(unrelated).toHaveBeenCalledTimes(2);
    } finally {
        owner.release();
        window.removeEventListener('pagehide', unrelated);
    }
});

it('a failing SDK constructor removes its listeners and restores the exact original descriptor', () => {
    const descriptor = Object.getOwnPropertyDescriptor(window, 'addEventListener');
    const owned = vi.fn();
    expect(() => createWithWindowListenerOwner(() => {
        window.addEventListener('pagehide', owned);
        throw new Error('construction failed');
    })).toThrow('construction failed');
    expect(Object.getOwnPropertyDescriptor(window, 'addEventListener')).toEqual(descriptor);
    window.dispatchEvent(new Event('pagehide'));
    expect(owned).not.toHaveBeenCalled();
});
