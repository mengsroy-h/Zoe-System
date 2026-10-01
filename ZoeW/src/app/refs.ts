import { commitNow } from './flush';

export const REF_NAMES = [
    'activationKeyInput',
    'appLockPinInput',
    'appPages',
    'configQrImageInput',
    'configQrVideo',
    'customDateInput',
    'customerDataTableSearchInput',
    'customLockerInput',
    'dataMainSection',
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
    'registerInviteInput',
    'registerPasswordConfirmInput',
    'registerPasswordInput',
    'registerUsernameInput',
    'rememberMeCheckbox',
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
    el.focus(options);
    if (document.activeElement !== el && el.offsetParent === null) {
        setTimeout(() => { if (el.isConnected) el.focus(options); }, 0);
    }
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

export function videoElement(name: 'video' | 'configQrVideo'): HTMLVideoElement | null {
    return elementOf<HTMLVideoElement>(name);
}
