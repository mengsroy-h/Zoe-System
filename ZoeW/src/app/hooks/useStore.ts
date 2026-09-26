import { useRef, useSyncExternalStore } from 'react';
import type { StoreMeta } from '../../core/store';

export function useStore(...stores: StoreMeta[]): number {
    return useSyncExternalStore(
        (onChange) => {
            const offs = stores.map((s) => s.subscribe(onChange));
            return () => offs.forEach((off) => off());
        },
        () => stores.reduce((sum, s) => sum + s.version(), 0),
        () => 0
    );
}

interface Snapshot<R> {
    version: number;
    value: R;
}

export function useStoreValue<S extends StoreMeta, R>(store: S, select: (state: S) => R): R {
    const cache = useRef<Snapshot<R> | null>(null);
    const snapshot = useSyncExternalStore(
        (onChange) => store.subscribe(onChange),
        () => {
            const version = store.version();
            const prev = cache.current;
            if (prev && prev.version === version) return prev;
            const value = select(store);
            if (prev && isPrimitive(value) && Object.is(prev.value, value)) {
                prev.version = version;
                return prev;
            }
            const next = { version, value };
            cache.current = next;
            return next;
        },
        () => ({ version: -1, value: select(store) })
    );
    return snapshot.value;
}

function isPrimitive(value: unknown): boolean {
    return value === null || (typeof value !== 'object' && typeof value !== 'function');
}

export function useStoreFields<S extends StoreMeta, K extends keyof S>(store: S, keys: readonly K[]): Pick<S, K> {
    const cache = useRef<Snapshot<Pick<S, K>> | null>(null);
    const snapshot = useSyncExternalStore(
        (onChange) => store.subscribe(onChange),
        () => {
            const version = store.version();
            const prev = cache.current;
            if (prev && prev.version === version) return prev;
            let same = !!prev;
            const value = {} as Pick<S, K>;
            for (const k of keys) {
                value[k] = store[k];
                if (same && !Object.is(prev!.value[k], store[k])) same = false;
            }
            if (same && prev) {
                prev.version = version;
                return prev;
            }
            const next = { version, value };
            cache.current = next;
            return next;
        },
        () => {
            const value = {} as Pick<S, K>;
            for (const k of keys) value[k] = store[k];
            return { version: -1, value };
        }
    );
    return snapshot.value;
}
