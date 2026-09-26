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
    observe(): void;
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
