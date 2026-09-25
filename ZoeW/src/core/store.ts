/**
 * ឃ្លាំង state ដែល *ប្រកាសការប្រែ* ដោយខ្លួនឯង។
 *
 * ⛔ ហេតុផលនៃការរចនា ៖ តក្កវិជ្ជាអាជីវកម្មទាំងអស់ត្រូវផ្ទេរពី `app.js`
 * **ដោយមិនប្តូរតួ** ➜ វានៅតែសរសេរ `dataState.scanHistory = x` ត្រង់ៗ។
 * បើ store ជាវត្ថុធម្មតា React នឹង **មិនដឹង** ថាទិន្នន័យប្រែ។ Proxy
 * នេះចាប់ការសរសេរ ហើយជូនដំណឹងក្នុង microtask តែមួយ (batched) ➜ កូដដែល
 * ផ្ទេរមក មិនបាច់ដឹងអំពី React សោះ ហើយ React មិនបាច់ដឹងអំពីកូដដែលផ្ទេរមក។
 */

export type Listener = () => void;

export interface StoreMeta {
    readonly __name: string;
    subscribe(fn: Listener): () => void;
    /** បង្ខំការជូនដំណឹង ពេលកែ *ខាងក្នុង* វត្ថុ (ឧ. `map.set()`)។ */
    touch(): void;
    /** រូបភាពបច្ចុប្បន្នសម្រាប់ `useSyncExternalStore` (ប្តូរពេលមានការសរសេរ)។ */
    version(): number;
    /**
     * ជូនដំណឹង **ភ្លាមៗ** ជំនួសការរង់ចាំ microtask។
     * ⛔ ប្រើសម្រាប់ផ្លូវដែលត្រូវការ DOM ចុះមុនជំហានបន្ទាប់ — ឧ. ការ
     *    បោះពុម្ព PDF ដែលហៅ `window.print()` ភ្លាមក្រោយគូរ។
     */
    flush(): void;
    /**
     * វាលដែលការសរសេររបស់វា **ចុះ DOM ភ្លាម** (តាម hook ដែលស្រទាប់ React ចុះឈ្មោះ)។
     * ⛔ App ដើមកែ DOM ផ្ទាល់ ➜ ប្រអប់ · របា Slide · ម៉ឺនុយ · ផ្ទាំង **បើក/បិទក្នុង tick
     *    ដដែល**។ វាលរចនាសម្ព័ន្ធ UI ទាំងនោះត្រូវរក្សាលក្ខណៈនេះ — បើអត់ កូដ (ឬអ្នកវាស់)
     *    ដែលអាន DOM ភ្លាមក្រោយហៅ ឃើញស្ថានភាពចាស់ (វាស់បាន ៖ `duplicate-scan` ·
     *    `page-nav` · `history-menu` · `ios-panel-glide`)។ ⛔ កុំដាក់ view model ធំៗ
     *    (តារាង · បញ្ជី) ក្នុងបញ្ជីនេះ ៖ ពួកវាសរសេរញឹកញាប់ ហើយ microtask គ្រប់គ្រាន់។
     */
    markImmediate(fields: readonly string[]): void;
}

const registry: StoreMeta[] = [];

let immediateCommit: (() => void) | null = null;
let immediateDepth = 0;

/** ស្រទាប់ React ចុះឈ្មោះ `commitNow()` (មើល `src/app/flush.ts`) */
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
            try { fn(); } catch (e) { /* អ្នកស្តាប់ម្នាក់ធ្លាក់ មិនត្រូវបញ្ឈប់អ្នកដទៃ */ }
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
