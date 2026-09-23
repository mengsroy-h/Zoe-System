import { useSyncExternalStore } from 'react';
import type { StoreMeta } from '../../core/store';

/**
 * ជាវឃ្លាំង state មួយ ឬច្រើន។
 *
 * ⛔ កូដដែលផ្ទេរពី `app.js` សរសេរ `dataState.scanHistory = x` ត្រង់ៗ ➜
 *    Proxy របស់ឃ្លាំងចាប់ការសរសេរ ហើយ hook នេះបម្លែងវាទៅជាការគូរឡើងវិញ
 *    របស់ React។ កូដដែលផ្ទេរមក **មិនបាច់ដឹងអំពី React សោះ**។
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
