import { commitNow } from './flush';

export const REF_NAMES = [
    'activationKeyInput',
    'appLockPinInput',
    'appPages',
    'batchBarcodeInput',
    'configQrImageInput',
    'configQrVideo',
    'customDateInput',
    'customerDataTableSearchInput',
    'customLockerInput',
    'dataMainSection',
    'dataSearchCard',
    'dataSideSection',
    'deletedSearchInput',
    'editBcCodInput',
    'editBcDodInput',
    'editPhoneInput',
    'entryListSearchInput',
    'entryMainSection',
    'entrySideSection',
    'entryTableResponsive',
    'exchangeRateInput',
    'fileInput',
    'palmSignPhotoInput',
    'palmSignVideo',
    'firebaseConfigInput',
    'globalMoreMenu',
    'hwScannerInput',
    'labelLayoutSelect',
    'labelOpenOnly',
    'labelShowDate',
    'labelShowLocker',
    'labelShowMoney',
    'lockerCountInput',
    'lockerListFilter',
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
    'ztoPalmUsernameInput',
    'ztoPalmPasswordInput',
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
    'registerInviteInput',
    'registerPasswordConfirmInput',
    'registerPasswordInput',
    'registerUsernameInput',
    'rememberMeCheckbox',
    'rememberPasswordCheckbox',
    'resetCodeInput',
    'resetPasswordConfirmInput',
    'resetPasswordInput',
    'resetUsernameInput',
    'safeAreaProbe',
    'sbDomainInput',
    'sbKeyInput',
    'sbUrlInput',
    'searchPhoneInput',
    'securityPinInput',
    'sentryDsnInput',
    'setupLinkInput',
    'siApiPasswordInput',
    'siApiUrlInput',
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

export function refTo(name: RefName): (el: HTMLElement | null) => void {
    let bind = binders.get(name);
    if (!bind) {
        bind = (el: HTMLElement | null) => {
            if (el) elements.set(name, el);
            else elements.delete(name);
        };
        binders.set(name, bind);
    }
    return bind;
}

const nativeBinders = new Map<string, (el: HTMLElement | null) => void>();

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

export function elementOf<T extends HTMLElement = HTMLElement>(name: RefName): T | null {
    return (elements.get(name) as T | undefined) ?? null;
}

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

export function typeIntoElement(target: Element | null, text: string): boolean {
    const el = target as HTMLInputElement | null;
    if (!el || !text || !el.isConnected || !fieldTakesText(el)) return false;
    if (document.activeElement === el) {
        let typed: boolean;
        try { typed = document.execCommand('insertText', false, text); } catch { typed = false; }
        if (typed) return true;
    }
    let ranged = false;
    try {
        const end = el.value.length;
        const from = typeof el.selectionStart === 'number' ? el.selectionStart : end;
        const to = typeof el.selectionEnd === 'number' ? el.selectionEnd : from;
        el.setRangeText(text, from, to, 'end');
        ranged = true;
    } catch {}
    if (!ranged) {
        try { el.value += text; } catch { return false; }
    }
    try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch {}
    return true;
}

export function insertFieldText(name: RefName, text: string): boolean {
    return typeIntoElement(elementOf(name), text);
}

export function fieldChecked(name: RefName): boolean {
    const el = field(name) as HTMLInputElement | null;
    return !!(el && el.checked);
}

export function setFieldChecked(name: RefName, checked: boolean): void {
    const el = field(name) as HTMLInputElement | null;
    if (el) el.checked = checked;
}

export function focusField(name: RefName, options?: FocusOptions): void {
    commitNow();
    const el = elementOf(name);
    if (!el) return;
    const opts = typeof el.closest === 'function' && el.closest('.modal') ? Object.assign({}, options, { preventScroll: true }) : options;
    el.focus(opts);
    if (document.activeElement !== el && el.offsetParent === null) {
        setTimeout(() => { if (el.isConnected) el.focus(opts); }, 0);
    }
}

export function focusElementWithoutScroll(el: HTMLElement): boolean {
    const field = el as HTMLInputElement;
    if (document.activeElement !== el && typeof field.setSelectionRange === 'function' && typeof field.value === 'string') {
        try { field.setSelectionRange(field.value.length, field.value.length); } catch {}
    }
    el.focus({ preventScroll: true });
    return document.activeElement === el;
}

export function visualViewportKeyboardInset(): number {
    const vv = window.visualViewport;
    if (!vv) return 0;
    const scale = vv.scale > 1 ? vv.scale : 1;
    const height = Math.round(vv.height * scale);
    const layout = window.innerHeight;
    if (!Number.isFinite(layout) || !Number.isFinite(height) || height <= 0) return 0;
    return layout - height;
}

export function resetVisualViewportPan(): boolean {
    const vv = window.visualViewport;
    const root = document.documentElement;
    if (!vv || !(vv.offsetTop > 0) || !root || typeof root.scrollIntoView !== 'function') return false;
    try { root.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'instant' }); } catch { return false; }
    return true;
}

export function focusFieldAsIs(name: RefName): void {
    const el = elementOf(name);
    if (el) el.focus();
}

export function openFilePicker(name: RefName): void {
    const el = elementOf(name);
    if (el) el.click();
}

export function isFieldFocused(name: RefName): boolean {
    const el = elementOf(name);
    return !!el && document.activeElement === el;
}

export function activeElementIsTextField(): boolean {
    const el = document.activeElement as HTMLElement | null;
    if (!el) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

const TEXT_ENTRY_TYPES = new Set(['', 'text', 'search', 'tel', 'number', 'email', 'url', 'password']);

function fieldTakesText(el: HTMLInputElement): boolean {
    if (el.disabled || el.readOnly) return false;
    if (el.tagName === 'TEXTAREA') return true;
    return el.tagName === 'INPUT' && TEXT_ENTRY_TYPES.has(String(el.type || '').toLowerCase());
}

export function activeElementTakesText(): boolean {
    const el = document.activeElement as HTMLInputElement | null;
    if (!el || el.disabled || el.readOnly) return false;
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') return fieldTakesText(el);
    return !!el.isContentEditable;
}

export function activeElementIsInModal(): boolean {
    const el = document.activeElement as HTMLElement | null;
    return !!el && typeof el.closest === 'function' && !!el.closest('.modal');
}

export function blurActiveElement(): void {
    const el = document.activeElement as HTMLElement | null;
    if (el && typeof el.blur === 'function') el.blur();
}

export function rectOfElement(el: unknown): DOMRect | null {
    return el && typeof (el as HTMLElement).getBoundingClientRect === 'function'
        ? (el as HTMLElement).getBoundingClientRect() : null;
}

export function elementSize(name: RefName): { width: number; height: number } {
    commitNow();
    const el = elementOf(name);
    return el ? { width: el.offsetWidth, height: el.offsetHeight } : { width: 0, height: 0 };
}

export function setScrollTop(name: RefName, top: number): void {
    commitNow();
    const el = elementOf(name);
    if (el) el.scrollTop = top;
}

export function setElementScrollTop(el: Element | null | undefined, top: number): void {
    if (el) (el as HTMLElement).scrollTop = top;
}

export function scrollChildIntoView(name: RefName, index: number): void {
    commitNow();
    const el = elementOf(name);
    const child = el ? el.children[index] : null;
    if (child) child.scrollIntoView({ block: 'nearest' });
}

export function animateElement(el: Element | null | undefined, keyframes: Keyframe[], options: KeyframeAnimationOptions): Animation | null {
    if (!el || typeof (el as HTMLElement).animate !== 'function') return null;
    return (el as HTMLElement).animate(keyframes, options);
}

export function videoElement(name: 'video' | 'configQrVideo' | 'palmSignVideo'): HTMLVideoElement | null {
    return elementOf<HTMLVideoElement>(name);
}

export async function attachPalmSignStream(stream: MediaStream | null): Promise<void> {
    const video = videoElement('palmSignVideo');
    if (!video) return;
    video.srcObject = stream;
    if (stream) await video.play();
}
