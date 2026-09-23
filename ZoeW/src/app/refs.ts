import { commitNow } from './flush';

/**
 * ធាតុដែល React ជាម្ចាស់ ➜ **ref** តាមឈ្មោះ។
 *
 * React គូរ UI ទាំងអស់ពីឃ្លាំង state (`viewState` · `uiState` …)។ ref ជា
 * «ច្រកចេញបន្ទាន់» (escape hatch) ដែល React ខ្លួនឯងណែនាំសម្រាប់ការងារដែល
 * state ធ្វើមិនបាន ៖ **focus · តម្លៃ input ដែលមិនគ្រប់គ្រង (uncontrolled) ·
 * ការវាស់ · ការរមូរ · វីដេអូ/កាមេរ៉ា**។ ⛔ គ្មាន operation សម្រាប់ class ·
 * style · អត្ថបទ · attribute នៅទីនេះទេ — ពួកវាជា state ដែល JSX គូរ។
 *
 * ```tsx
 * <input ref={refTo('securityPinInput')} … />        // component
 * const pin = fieldValue('securityPinInput');         // កូដមុខងារ
 * ```
 *
 * ⛔ Input ជា **uncontrolled** ដោយចេតនា ៖ DOM ជាប្រភពការពិតនៃតម្លៃដែលអ្នកប្រើ
 *    វាយ (ម៉ាស៊ីនស្កេន hardware វាយលឿនបំផុត · ឧបករណ៍វាស់សរសេរ `.value`
 *    ដោយផ្ទាល់) ➜ ការអានតាម ref ផ្តល់តម្លៃដូច App ដើមបេះបិទ។
 * ⛔ ឈ្មោះត្រូវស្ថិតក្នុង `REF_NAMES` (type ពិនិត្យពេល build) ហើយ
 *    `scripts/react-purity-check.mjs` ធ្លាក់ពេលឈ្មោះណាគ្មាន component ចង។
 */
export const REF_NAMES = [
    'activationKeyInput',
    'appLockPinInput',
    'appPages',
    'configQrVideo',
    'customDateInput',
    'customerDataTableSearchInput',
    'customLockerInput',
    'dataMainSection',
    'dataSideSection',
    'deletedSearchInput',
    'dragHandle',
    'editBcCodInput',
    'editBcDodInput',
    'editPhoneInput',
    'entryDragHandle',
    'entryListSearchInput',
    'entryMainSection',
    'entrySideSection',
    'entryTableResponsive',
    'exchangeRateInput',
    'fileInput',
    'firebaseConfigInput',
    'globalMoreMenu',
    'hwScannerInput',
    'lockerCountInput',
    'lockerListSearchInput',
    'lockerPrefixInput',
    'lockerTableResponsive',
    'loginEmailInput',
    'loginPasswordInput',
    'lookupApiAutoSubmitCheckbox',
    'lookupApiCodFieldInput',
    'lookupApiDodFieldInput',
    'lookupApiEnabledCheckbox',
    'lookupApiFastModeCheckbox',
    'lookupApiHeaderNameInput',
    'lookupApiHeaderValueInput',
    'lookupApiPhoneFieldInput',
    'lookupApiUrlInput',
    'manualCodChangeInput',
    'manualCountChangeInput',
    'manualDateInput',
    'manualDodChangeInput',
    'modalCodInput',
    'modalDodInput',
    'modalLockerInput',
    'modalPhoneInput',
    'navbar',
    'newSecurityPinInput',
    'pageData',
    'pageEntry',
    'pageTabBar',
    'phoneSuggestBox',
    'ptrIndicator',
    'rememberMeCheckbox',
    'searchPhoneInput',
    'securityPinInput',
    'sentryDsnInput',
    'siApiPasswordInput',
    'siApiUrlInput',
    'siDrop',
    'siFileInput',
    'siHeaderRowInput',
    'siModeSel',
    'tableResponsive',
    'video',
    'videoContainer',
    'zoomSlider',
    'ztoListSyncFrom',
    'ztoListSyncTo',
] as const;

export type RefName = (typeof REF_NAMES)[number];

const elements = new Map<string, HTMLElement>();
const binders = new Map<string, (el: HTMLElement | null) => void>();
const listeners = new Map<string, Set<(el: HTMLElement | null) => void>>();

/**
 * ref callback **ថេរ** សម្រាប់ឈ្មោះមួយ (callback ដដែលរាល់ការគូរ ➜ React មិន
 * ផ្តាច់/ភ្ជាប់ ref ឡើងវិញរាល់ render)។
 */
export function refTo(name: RefName): (el: HTMLElement | null) => void {
    let bind = binders.get(name);
    if (!bind) {
        bind = (el: HTMLElement | null) => {
            if (el) elements.set(name, el);
            else elements.delete(name);
            const subs = listeners.get(name);
            if (subs) for (const fn of [...subs]) fn(el);
        };
        binders.set(name, bind);
    }
    return bind;
}

const nativeBinders = new Map<string, (el: HTMLElement | null) => void>();

/**
 * ref ដែលចងធាតុ **និង** listener native មួយ (ឧ. `change` ពិតរបស់ browser)។
 *
 * ⛔ `onChange` របស់ React ស្តាប់ព្រឹត្តិការណ៍ `input` (រាល់ការវាយ) ខណៈ App ដើម
 *    ស្តាប់ `change` (ពេលចាកចេញពីប្រអប់/Enter) ➜ ប្រអប់លេខ «ជួរដេក header»
 *    នឹងហៅ API រាល់ការវាយ។ ប្រើ helper នេះពេលត្រូវការ `change` native ពិត។
 */
export function refWithNative(name: RefName, type: string, handler: (event: Event) => void): (el: HTMLElement | null) => void {
    const key = name + '|' + type;
    let bind = nativeBinders.get(key);
    if (!bind) {
        const base = refTo(name);
        let attached: HTMLElement | null = null;
        const listener = (event: Event) => handler(event);
        bind = (el: HTMLElement | null) => {
            if (attached && attached !== el) attached.removeEventListener(type, listener);
            if (el && attached !== el) el.addEventListener(type, listener);
            attached = el;
            base(el);
        };
        nativeBinders.set(key, bind);
    }
    return bind;
}

/** ធាតុដែល ref ចង (ឬ `null` មុន mount) — **សម្រាប់ `src/app/**` តែប៉ុណ្ណោះ** */
export function elementOf<T extends HTMLElement = HTMLElement>(name: RefName): T | null {
    return (elements.get(name) as T | undefined) ?? null;
}

/** ជូនដំណឹងពេល ref ចង/ផ្តាច់ (សម្រាប់ behavior hook ដែលត្រូវការធាតុ) */
export function onRefChange(name: RefName, fn: (el: HTMLElement | null) => void): () => void {
    let subs = listeners.get(name);
    if (!subs) { subs = new Set(); listeners.set(name, subs); }
    subs.add(fn);
    return () => { subs.delete(fn); };
}

/** ឈ្មោះ ref របស់ធាតុមួយ (ឬ `null`) */
export function refNameOf(el: unknown): RefName | null {
    if (!el) return null;
    for (const [name, node] of elements) if (node === el) return name as RefName;
    return null;
}

/* ── តម្លៃ input (uncontrolled) ───────────────────────────────────── */

type FieldEl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

function field(name: RefName): FieldEl | null {
    return elementOf<FieldEl>(name);
}

export function fieldValue(name: RefName): string {
    const el = field(name);
    return el ? el.value : '';
}

export function setFieldValue(name: RefName, value: string): void {
    const el = field(name);
    if (el) el.value = value;
}

export function fieldChecked(name: RefName): boolean {
    const el = field(name) as HTMLInputElement | null;
    return !!(el && el.checked);
}

export function setFieldChecked(name: RefName, checked: boolean): void {
    const el = field(name) as HTMLInputElement | null;
    if (el) el.checked = checked;
}

export function fieldFiles(name: RefName): FileList | null {
    const el = field(name) as HTMLInputElement | null;
    return el ? el.files : null;
}

/* ── focus ───────────────────────────────────────────────────────── */

/**
 * focus ធាតុមួយ។ ⛔ `commitNow()` មុន ៖ ប្រអប់ដែលទើបបើកក្នុង state មិនទាន់
 * ចុះ DOM ទេ (`display: none` ➜ focus ធ្លាក់ស្ងាត់) — App ដើមបើក DOM ភ្លាម។
 * ⛔ ក្នុង lifecycle របស់ React (`commitNow()` មិនអាចបង្ខំ) ➜ សាកម្តងទៀតក្រោយ
 *    ការគូរ ដើម្បីកុំឲ្យ focus បាត់។
 */
export function focusField(name: RefName, options?: FocusOptions): void {
    commitNow();
    const el = elementOf(name);
    if (!el) return;
    el.focus(options);
    if (document.activeElement !== el && el.offsetParent === null) {
        setTimeout(() => { if (el.isConnected) el.focus(options); }, 0);
    }
}

/**
 * focus ធាតុ **ដូចដែល DOM កំពុងឈរ** (គ្មាន `commitNow()` · គ្មានការសាកម្តងទៀត)
 * — សម្រាប់ផ្លូវក្តៅដែល App ដើម focus ដោយផ្ទាល់ (ម៉ាស៊ីនស្កេន hardware)។
 */
export function focusFieldAsIs(name: RefName): void {
    const el = elementOf(name);
    if (el) el.focus();
}

export function blurField(name: RefName): void {
    const el = elementOf(name);
    if (el) el.blur();
}

export function selectFieldText(name: RefName): void {
    const el = field(name) as HTMLInputElement | null;
    if (el && typeof el.select === 'function') el.select();
}

/** បើកផ្ទាំងជ្រើសឯកសាររបស់ `<input type="file">` */
export function openFilePicker(name: RefName): void {
    const el = elementOf(name);
    if (el) el.click();
}

export function isFieldFocused(name: RefName): boolean {
    const el = elementOf(name);
    return !!el && document.activeElement === el;
}

/** អ្នកប្រើកំពុងវាយក្នុងវាលអត្ថបទណាមួយ (input · textarea · select) */
export function activeElementIsTextField(): boolean {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

export function activeElementTag(): string {
    const el = document.activeElement as HTMLElement | null;
    return el ? el.tagName : '';
}

export function blurActiveElement(): void {
    const el = document.activeElement as HTMLElement | null;
    if (el && typeof el.blur === 'function') el.blur();
}

/* ── ការវាស់ · ការរមូរ ─────────────────────────────────────────────── */

export function elementRect(name: RefName): DOMRect | null {
    commitNow();
    const el = elementOf(name);
    return el ? el.getBoundingClientRect() : null;
}

/**
 * វាសធាតុដែល **ព្រឹត្តិការណ៍របស់ React** ផ្តល់ (`event.currentTarget` តាម
 * `onAct(…, { self: true })`) ឧ. ប៊ូតុង (...) ជាចំណុចភ្ជាប់ម៉ឺនុយ។
 */
export function rectOfElement(el: unknown): DOMRect | null {
    return el && typeof (el as HTMLElement).getBoundingClientRect === 'function'
        ? (el as HTMLElement).getBoundingClientRect() : null;
}

/** ទំហំធាតុ (`offsetWidth` · `offsetHeight`) ក្រោយ DOM ចុះភ្លាម */
export function elementSize(name: RefName): { width: number; height: number } {
    commitNow();
    const el = elementOf(name);
    return el ? { width: el.offsetWidth, height: el.offsetHeight } : { width: 0, height: 0 };
}

export function scrollTopOf(name: RefName): number {
    const el = elementOf(name);
    return el ? el.scrollTop : 0;
}

export function setScrollTop(name: RefName, top: number): void {
    commitNow();
    const el = elementOf(name);
    if (el) el.scrollTop = top;
}

/* ── វីដេអូ (កាមេរ៉ា · ម៉ាស៊ីនស្កេន) ────────────────────────────────── */

/**
 * ធាតុ `<video>` សម្រាប់ stream កាមេរ៉ា ឬ ZXing (React ណែនាំ ref សម្រាប់
 * «media playback» និង «third-party library»)។
 */
export function videoElement(name: 'video' | 'configQrVideo'): HTMLVideoElement | null {
    return elementOf<HTMLVideoElement>(name);
}
