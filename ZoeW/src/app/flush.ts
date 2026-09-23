import { flushSync } from 'react-dom';
import type { StoreMeta } from '../core/store';

/**
 * បង្ខំ React ឲ្យគូរ **ភ្លាមៗ** ពីឃ្លាំងដែលបានប្តូរ។
 *
 * ⛔ ការគូរធម្មតាកើតក្នុង microtask ➜ ផ្លូវដែលអាន DOM ឬហៅ
 *    `window.print()` ភ្លាមក្រោយសរសេរ state នឹងឃើញ DOM **ចាស់**។
 */
export function renderNow(store: StoreMeta): void {
    flushSync(() => { store.flush(); });
}
