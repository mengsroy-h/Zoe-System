import { commitNow } from './app/flush';
import { elementOf, onRefChange, type RefName } from './app/refs';
import { uiState } from './core/state';

/**
 * ⛔ សម្រាប់តែ build វាស់ (`VITE_EXPOSE_GLOBALS=1` ➜ `expose-globals.ts`) — **មិនដែលចូល
 *    ផលិតកម្ម**។
 *
 * checker ដើមខ្លះ «ដាក់ App ក្នុងស្ថានភាព» ដោយសរសេរ class លើ DOM ដោយផ្ទាល់ ឧ.
 * `side.classList.add('collapsed'); syncHistoryExpandedLock()` (gesture · panel-motion)។
 * ក្នុង App ដើម class **ជា** ស្ថានភាព; ក្នុង React វាជា **លទ្ធផល** ដែល JSX គូរពី state ➜
 * ការសរសេរ class ត្រង់ៗ (១) មិនត្រូវកូដដែលអាន state ឃើញ និង (២) ត្រូវ React លុបវិញ
 * ពេលគូរលើកក្រោយ ➜ checker វាស់ស្ថានភាពដែល App **មិនដែលនៅ**។
 *
 * ស្រទាប់នេះ **បកប្រែការបញ្ចូល** ៖ `classList.add/remove/toggle` នៃ class ដែលមានម្ចាស់ជា state
 * លើធាតុរបស់ React ➜ សរសេរ state ដដែល រួច `commitNow()` ➜ DOM ដែល checker **អាន**
 * គឺជាអ្វីដែល React គូរពិត។ ⛔ វាមិនក្លែង **លទ្ធផល** ណាមួយទេ ៖ `contains()` អាន DOM ពិត។
 * ⛔ class ផ្សេងទៀត (និងការសរសេរដែលស្មើ state រួចហើយ ឧ. `DocumentEffects`) ឆ្លងកាត់
 *    ត្រង់ៗទៅ `DOMTokenList` ពិត។
 */

interface Binding {
    cls: string;
    get: () => boolean;
    set: (on: boolean) => void;
}

const field = (name: 'dataPanelCollapsed' | 'entryPanelCollapsed' | 'dataPanelSearchFocus' | 'historyExpanded' | 'panelGliding'
    | 'phoneSuggestOpen' | 'moreMenuOpen' | 'chromeHidden', cls: string): Binding => ({
    cls,
    get: () => !!uiState[name],
    set: (on) => { uiState[name] = on; }
});

const REF_BINDINGS: Array<[RefName, Binding[]]> = [
    ['dataSideSection', [field('dataPanelCollapsed', 'collapsed'), field('dataPanelSearchFocus', 'search-focus')]],
    ['entrySideSection', [field('entryPanelCollapsed', 'collapsed')]],
    ['appPages', [field('historyExpanded', 'history-expanded'), field('panelGliding', 'panel-gliding')]],
    ['phoneSuggestBox', [field('phoneSuggestOpen', 'show')]],
    ['globalMoreMenu', [field('moreMenuOpen', 'show')]]
];
const BODY_BINDINGS: Binding[] = [field('chromeHidden', 'chrome-hidden')];

const nativeClassList = Object.getOwnPropertyDescriptor(Element.prototype, 'classList')!.get!;
const wrapped = new WeakSet<Element>();

function wrap(el: Element, bindings: Binding[], adopt: boolean): void {
    if (wrapped.has(el)) return;
    wrapped.add(el);
    const byCls = new Map(bindings.map((b) => [b.cls, b]));
    const real = () => nativeClassList.call(el) as DOMTokenList;
    const apply = (cls: string, on: boolean): boolean => {
        const b = byCls.get(cls);
        if (!b || b.get() === on) return false;
        b.set(on);
        return true;
    };
    // ⛔ class ដែល checker សរសេរ **មុន** ស្រទាប់នេះដំឡើង (chunk វាស់ផ្ទុកក្រោយ) ➜ ទទួលយកវា ។
    //    តែពេលដំឡើងប៉ុណ្ណោះ ហើយក្រោយ `commitNow()` (DOM = state) ➜ ភាពខុសគ្នាដែលនៅសល់
    //    មកពីការសរសេរខាងក្រៅពិត មិនមែនពីការគូរដែលមិនទាន់ចុះ។
    if (adopt) for (const b of bindings) {
        const has = real().contains(b.cls);
        if (has !== b.get()) b.set(has);
    }
    const proxy = new Proxy({}, {
        get(_t, prop) {
            const list = real();
            if (prop === 'add' || prop === 'remove') {
                return (...names: string[]) => {
                    let changed = false;
                    for (const n of names) changed = apply(n, prop === 'add') || changed;
                    if (changed) commitNow();
                    list[prop](...names);
                };
            }
            if (prop === 'toggle') {
                return (name: string, force?: boolean) => {
                    const on = force === undefined ? !list.contains(name) : !!force;
                    if (apply(name, on)) commitNow();
                    return list.toggle(name, on);
                };
            }
            const v = (list as any)[prop];
            return typeof v === 'function' ? v.bind(list) : v;
        }
    });
    Object.defineProperty(el, 'classList', { configurable: true, get: () => proxy });
}

export function installAuditClassAdapter(): void {
    commitNow();
    wrap(document.body, BODY_BINDINGS, true);
    for (const [name, bindings] of REF_BINDINGS) {
        const now = elementOf(name);
        if (now) wrap(now, bindings, true);
        onRefChange(name, (el) => { if (el) wrap(el, bindings, false); });
    }
    commitNow();
}
