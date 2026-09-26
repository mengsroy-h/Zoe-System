import { commitNow } from './app/flush';
import { elementOf, type RefName } from './app/refs';
import { uiState } from './core/state';
import { annotateActions } from './audit-annotate';
import { REACT_OWNED_IDS, resetReactOwned } from './app/slot-resets';

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

const nativeInnerHTML = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML')!;
const nativeStyle = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'style')!;
const slotWrapped = new WeakSet<Element>();

function wrapOwnedSlot(el: Element, id: string): void {
    if (slotWrapped.has(el)) return;
    slotWrapped.add(el);
    Object.defineProperty(el, 'innerHTML', {
        configurable: true,
        get: () => nativeInnerHTML.get!.call(el),
        set: (v: string) => {
            if (v === '' && resetReactOwned(id)) { commitNow(); return; }
            nativeInnerHTML.set!.call(el, v);
        }
    });
}

function wrapModalStyle(el: HTMLElement): void {
    if (slotWrapped.has(el)) return;
    slotWrapped.add(el);
    const id = el.id;
    const real = () => nativeStyle.get!.call(el) as CSSStyleDeclaration;
    const proxy = new Proxy({}, {
        get(_t, prop) {
            const st = real();
            const v = (st as any)[prop];
            return typeof v === 'function' ? v.bind(st) : v;
        },
        set(_t, prop, value) {
            const st = real();
            if (prop === 'display') {
                const want = value ? String(value) : '';
                if ((uiState.modalDisplay[id] || '') !== want) {
                    const next: Record<string, any> = Object.assign({}, uiState.modalDisplay);
                    if (want) next[id] = want; else delete next[id];
                    uiState.modalDisplay = next;
                    commitNow();
                }
            }
            (st as any)[prop] = value;
            return true;
        }
    });
    Object.defineProperty(el, 'style', { configurable: true, get: () => proxy });
}

function wrapOwnedElements(): void {
    for (const id of REACT_OWNED_IDS) {
        const el = document.getElementById(id);
        if (el) wrapOwnedSlot(el, id);
    }
    document.querySelectorAll<HTMLElement>('.modal[id]').forEach(wrapModalStyle);
}

function wrapMountedRefs(adopt: boolean): void {
    for (const [name, bindings] of REF_BINDINGS) {
        const el = elementOf(name);
        if (el) wrap(el, bindings, adopt);
    }
}

export function installAuditClassAdapter(): void {
    commitNow();
    wrap(document.body, BODY_BINDINGS, true);
    wrapMountedRefs(true);
    wrapOwnedElements();
    new MutationObserver(() => { wrapMountedRefs(false); wrapOwnedElements(); }).observe(document.body, { childList: true, subtree: true });
    commitNow();
}

export function installAuditActionAnnotations(): void {
    annotateActions(document.body);
    new MutationObserver((records) => {
        for (const r of records) {
            for (const n of Array.from(r.addedNodes)) if (n.nodeType === 1) annotateActions(n as Element);
        }
    }).observe(document.body, { childList: true, subtree: true });
}
