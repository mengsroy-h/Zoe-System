import { useRef, useSyncExternalStore } from 'react';
import type { StoreMeta } from '../../core/store';

/**
 * ជាវឃ្លាំង state មួយ ឬច្រើន ➜ component គូរឡើងវិញរាល់ការសរសេរ។
 *
 * ⛔ កូដដែលផ្ទេរពី `app.js` សរសេរ `dataState.scanHistory = x` ត្រង់ៗ ➜
 *    Proxy របស់ឃ្លាំងចាប់ការសរសេរ ហើយ hook នេះបម្លែងវាទៅជាការគូរឡើងវិញ
 *    របស់ React។ កូដដែលផ្ទេរមក **មិនបាច់ដឹងអំពី React សោះ**។
 * ➜ សម្រាប់ component ថ្មី សូមប្រើ `useStoreValue()` ខាងក្រោម (គូរឡើងវិញតែពេល
 *   *តម្លៃដែលខ្លួនអាន* ប្រែ)។
 */
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

/**
 * អានតម្លៃ **មួយ** ពីឃ្លាំង ហើយគូរឡើងវិញ **តែពេលតម្លៃនោះប្រែ**។
 *
 * ```tsx
 * const open = useStoreValue(uiState, (s) => s.updateBannerOpen);
 * ```
 *
 * ⛔ តម្លៃ **primitive** (string · number · boolean · null) ប្រៀបធៀបតាម
 *    `Object.is` ➜ ការសរសេរវាលផ្សេងក្នុងឃ្លាំងដដែល មិនគូរ component ឡើងវិញ។
 * ⛔ តម្លៃ **object/array** ត្រូវចាត់ទុកថា «ប្រែ» រាល់ពេល version របស់ឃ្លាំង
 *    ឡើង ៖ កូដដែលផ្ទេរមក *កែខាងក្នុង* វត្ថុ (`map.set()` + `touch()`) ដោយ
 *    reference ដដែល ➜ ការប្រៀបធៀបតាម reference នឹង **បាត់ការប្រែ**។
 */
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

/**
 * អាន **វាលច្រើន** ពីឃ្លាំងក្នុងពេលតែមួយ ហើយគូរឡើងវិញ **តែពេលវាលណាមួយក្នុង
 * ចំណោមនោះប្រែ** (ប្រៀបធៀបរាក់ៗ តាម `Object.is` លើតម្លៃនីមួយៗ)។
 *
 * ```tsx
 * const v = useStoreFields(viewState, ['appLockOpen', 'appLockMessage']);
 * ```
 *
 * ⛔ សម្រាប់វាលដែលជា primitive ឬ array/object ដែល **ជំនួសទាំងមូល** ពេលប្រែ
 *    (ដូចរាល់វាលក្នុង `viewState`) — វត្ថុដែលកែនៅនឹងកន្លែង ប្រើ `useStore()`។
 */
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
