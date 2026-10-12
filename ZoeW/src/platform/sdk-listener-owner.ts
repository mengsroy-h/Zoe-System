export function createWithWindowListenerOwner<T>(factory: () => T) {
    const target = typeof window === 'undefined' ? null : window;
    const owned = [];
    const add = target && target.addEventListener;
    const remove = target && target.removeEventListener;
    const release = () => {
        owned.splice(0).forEach(({ type, listener, capture }) => {
            try { remove.call(target, type, listener, capture); } catch {}
        });
    };
    if (!target || !add || !remove) return { value: factory(), release };
    const descriptor = Object.getOwnPropertyDescriptor(target, 'addEventListener');
    const tracked: typeof target.addEventListener = function (this: Window, type, listener, options) {
        add.call(this, type, listener, options);
        if (this === target) owned.push({ type, listener, capture: typeof options === 'boolean' ? options : !!(options && options.capture) });
    };
    Object.defineProperty(target, 'addEventListener', { configurable: true, writable: true, value: tracked });
    try {
        return { value: factory(), release };
    } catch (e) {
        release();
        throw e;
    } finally {
        if (descriptor) Object.defineProperty(target, 'addEventListener', descriptor);
        else delete target.addEventListener;
    }
}
