export type Listener = () => void;

export interface StoreMeta {
    readonly __name: string;
    subscribe(fn: Listener): () => void;
    touch(): void;
    version(): number;
    flush(): void;
    markImmediate(fields: readonly string[]): void;
}

const registry: StoreMeta[] = [];

let immediateCommit: (() => void) | null = null;
let immediateDepth = 0;

export function setImmediateCommit(fn: (() => void) | null): void {
    immediateCommit = fn;
}

function commitImmediately(): void {
    if (!immediateCommit || immediateDepth > 0) return;
    immediateDepth++;
    try { immediateCommit(); } finally { immediateDepth--; }
}

export function createStore<T extends object>(name: string, initial: T): T & StoreMeta {
    const listeners = new Set<Listener>();
    let version = 0;
    let queued = false;
    let immediate: Set<PropertyKey> | null = null;

    const notify = () => {
        queued = false;
        for (const fn of [...listeners]) {
            try { fn(); } catch (e) { }
        }
    };
    const bump = () => {
        version++;
        if (queued) return;
        queued = true;
        queueMicrotask(notify);
    };

    const meta: StoreMeta = {
        __name: name,
        subscribe(fn: Listener) { listeners.add(fn); return () => { listeners.delete(fn); }; },
        touch: bump,
        version: () => version,
        flush: () => { if (queued) notify(); },
        markImmediate: (fields: readonly string[]) => { immediate = new Set(fields); }
    };

    const target = Object.assign(Object.create(null) as object, initial, meta) as T & StoreMeta;

    return new Proxy(target, {
        set(obj, prop, value) {
            const prev = (obj as never as Record<PropertyKey, unknown>)[prop];
            (obj as never as Record<PropertyKey, unknown>)[prop] = value;
            if (!Object.is(prev, value)) {
                bump();
                if (immediate && immediate.has(prop)) commitImmediately();
            }
            return true;
        },
        deleteProperty(obj, prop) {
            const had = prop in (obj as object);
            delete (obj as never as Record<PropertyKey, unknown>)[prop];
            if (had) bump();
            return true;
        }
    }) as T & StoreMeta;
}

export function registerStore(store: StoreMeta): StoreMeta {
    registry.push(store);
    return store;
}

export function allStores(): readonly StoreMeta[] { return registry; }
