/**
 * ប្រវត្តិថយក្រោយរបស់ប៊ូតុង/កាយវិការ Back លើ Android ៖ «អេក្រង់» ដែលអ្នកប្រើ
 * បានឆ្លងកាត់ (ទំព័រ · របៀបស្កេន) ➜ Back ត្រឡប់ម្តងមួយជំហាន ដូចប្រវត្តិរបស់
 * browser។
 *
 * ⛔ ប្រភពការពិតគឺ **ឃ្លាំង state** (`uiState.currentAppPage` ·
 *    `uiState.entryScanMode`) ៖ ប្រវត្តិ *សង្កេត* ឃ្លាំង មិនមែនពឹងលើអ្នកហៅ
 *    `switchAppPage()` នីមួយៗឲ្យចាំកត់ត្រា ➜ ផ្លូវប្តូរទំព័រថ្មីនាពេលអនាគត
 *    ចូលប្រវត្តិដោយស្វ័យប្រវត្តិ។
 * ⛔ **Back មិនត្រឡប់ចូលរបៀប «ដក» វិញទេ** ៖ របៀបនោះដកលុយ ហើយ App មិន persist
 *    វាដោយចេតនា (reload ➜ «កញ្ចប់») ➜ ការត្រឡប់ចូលវាតាម Back = ការស្កេនបន្ទាប់
 *    អាច **ដកដោយចៃដន្យ**។ ធាតុ «ដក» ក្នុងប្រវត្តិត្រូវបម្លែងជា «កញ្ចប់»។
 * ⛔ ទំហំមានពិដាន (`BACK_HISTORY_LIMIT`) ➜ ការរកចុះក្នុង `popTarget()`
 *    មានព្រំដែនតាមរចនាសម្ព័ន្ធ។
 */
export type AppPage = 'data' | 'entry';
export type ScanMode = 'parcel' | 'locker' | 'remove';

export interface Screen {
    page: AppPage;
    mode: ScanMode | null;
}

export const BACK_HISTORY_LIMIT = 20;

export function screenOf(state: { currentAppPage?: unknown; entryScanMode?: unknown }): Screen {
    const page: AppPage = state.currentAppPage === 'entry' ? 'entry' : 'data';
    if (page === 'data') return { page, mode: null };
    const mode: ScanMode = state.entryScanMode === 'locker' ? 'locker' : (state.entryScanMode === 'remove' ? 'remove' : 'parcel');
    return { page, mode };
}

export function sameScreen(a: Screen, b: Screen): boolean {
    return a.page === b.page && a.mode === b.mode;
}

export function safeScreen(screen: Screen): Screen {
    return screen.mode === 'remove' ? { page: screen.page, mode: 'parcel' } : screen;
}

export interface BackHistory {
    /** ហៅពេលឃ្លាំងប្រែ ➜ អេក្រង់ចាស់ចូលប្រវត្តិ បើអេក្រង់ប្រែពិត */
    observe(): void;
    /** អេក្រង់ដែល Back ត្រូវត្រឡប់ទៅ (ឬ `null` ពេលប្រវត្តិអស់) */
    popTarget(): Screen | null;
    size(): number;
}

export function createBackHistory(read: () => Screen, limit = BACK_HISTORY_LIMIT): BackHistory {
    const stack: Screen[] = [];
    let current = read();
    const observe = () => {
        const next = read();
        if (sameScreen(next, current)) return;
        stack.push(current);
        if (stack.length > limit) stack.shift();
        current = next;
    };
    return {
        observe,
        popTarget() {
            observe();
            while (stack.length) {
                const prev = safeScreen(stack.pop() as Screen);
                if (sameScreen(prev, current)) continue;
                current = prev;
                return prev;
            }
            return null;
        },
        size: () => stack.length
    };
}
