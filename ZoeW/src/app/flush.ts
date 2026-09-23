import { flushSync } from 'react-dom';
import { allStores, setImmediateCommit, type StoreMeta } from '../core/store';

/**
 * បង្ខំ React ឲ្យគូរ **ភ្លាមៗ** ពីឃ្លាំងមួយដែលបានប្តូរ។
 *
 * ⛔ ការគូរធម្មតាកើតក្នុង microtask ➜ ផ្លូវដែលអាន DOM ឬហៅ
 *    `window.print()` ភ្លាមក្រោយសរសេរ state នឹងឃើញ DOM **ចាស់**។
 */
export function renderNow(store: StoreMeta): void {
    flushSync(() => { store.flush(); });
}

/**
 * គូររាល់ឃ្លាំងដែលមានការប្រែ **ភ្លាមៗ** ➜ DOM ស៊ីនឹង state មុនជំហានបន្ទាប់
 * (focus · ការវាស់ · ការរមូរ · `print()` · ចលនា FLIP)។ App ដើមកែ DOM ផ្ទាល់ ➜
 * វាតែងតែ «ចុះភ្លាម»; នេះរក្សាលក្ខណៈនោះ ដោយ React នៅតែជាអ្នកគូរ។
 *
 * ⛔ កុំហៅក្នុង render ឬ effect របស់ component (React ហាម `flushSync` ទីនោះ)
 *    — ដំណាក់ boot រត់ក្នុង microtask ក្រោយ mount ដោយហេតុនេះ (`App.tsx`)។
 */
export function commitNow(): void {
    flushSync(() => {
        for (const s of allStores()) s.flush();
    });
}

// ⛔ វាលរចនាសម្ព័ន្ធ UI (`markImmediate`) ចុះ DOM ភ្លាមពេលសរសេរ ដូច App ដើមកែ DOM ផ្ទាល់
setImmediateCommit(commitNow);
