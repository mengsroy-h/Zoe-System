import { acceptPalmSignBarcode } from '../../features/zto-palm-sign';
import { scanState, securityState, uiState } from '../../core/state';
import { latinDigits } from '../../core/text';
import { isMobileDevice } from '../../core/timezone';
import { queueScannedCode } from '../../features/batch-scan';
import { closeConfigQrScanner } from '../../features/config-qr';
import { showCameraClosedBox, stopCurrentStream, submitManualBarcode } from '../../features/daily-stats';
import { showToast } from '../../ui/toast';
import { activeElementTakesText, elementOf, focusElementWithoutScroll, focusFieldAsIs, insertFieldText, setFieldValue, typeIntoElement, untypeFromElement, type RefName } from '../refs';
import { isAndroidDevice } from '../../platform/native';
import { softKeyboardShown } from './modal-keyboard';

export const SCANNER_KEY_GAP_MS = 60;
export const SCANNER_SUFFIX_GAP_MS = 150;
export const SCANNER_MIN_CHARS = 4;

const US_SHIFTED_DIGITS = ')!@#$%^&*(';
const US_PUNCTUATION: Record<string, string> = {
    Minus: '-_', Equal: '=+', BracketLeft: '[{', BracketRight: ']}', Backslash: '\\|', Semicolon: ';:', Quote: '\'"',
    Backquote: '`~', Comma: ',<', Period: '.>', Slash: '/?', NumpadDecimal: '..', NumpadDivide: '//', NumpadMultiply: '**',
    NumpadSubtract: '--', NumpadAdd: '++'
};
const BURST_KEEP_KEYS = new Set(['Shift', 'CapsLock', 'NumLock']);
const SCANNER_FIELDS: readonly RefName[] = ['hwScannerInput', 'batchBarcodeInput'];
const MODAL_HOLD_FIELDS: readonly RefName[] = ['hwScannerInput', 'modalPhoneInput', 'modalLockerInput', 'modalCodInput', 'modalDodInput'];

interface HeldPiece {
    el: Element | null;
    text: string;
    owner: string;
}

interface HeldBreak {
    lastKeyAt: number;
    pieces: HeldPiece[];
    typed: { el: Element | null; value: string; before: string } | null;
    interrupted: boolean;
}

interface HeldKeys {
    scan: string;
    text: string;
    el: Element | null;
    broken: RefName | null | false;
    timer: ReturnType<typeof setTimeout> | null;
    owner: string;
    tailOf: HeldBreak | null;
}

let scanBurst: { count: number; at: number; field: RefName | null } = { count: 0, at: -Infinity, field: null };
let heldKeys: HeldKeys | null = null;
let heldBreak: HeldBreak | null = null;

function heldOwner(): string {
    const stack = Array.isArray(uiState.modalStack) ? uiState.modalStack : [];
    return String(stack[stack.length - 1] || '') + '\n' + String(scanState.pendingBarcode || '');
}

function interruptedScan(held: HeldKeys): void {
    const typed = held.tailOf && held.tailOf.typed;
    if (typed) untypeFromElement(typed.el, typed.value, typed.before);
    if (held.broken) setFieldValue(held.broken, '');
    showToast('⚠️ ការស្កេនត្រូវបានកាត់ដោយការផ្អាករបស់ម៉ាស៊ីនស្កេន — មិនបានបញ្ចូល Barcode ទេ។ សូមស្កេនម្ដងទៀត។');
}

function typeHeldPieces(pieces: HeldPiece[], lastKeyAt: number): void {
    let typed: HeldBreak['typed'] = null;
    const owner = heldOwner();
    for (const piece of pieces) {
        if (piece.owner !== owner) continue;
        const el = piece.el as HTMLInputElement | null;
        const before = typed && typed.el === piece.el ? typed.before : (el && typeof el.value === 'string' ? el.value : '');
        if (typeIntoElement(piece.el, piece.text)) typed = { el: piece.el, value: el ? el.value : '', before };
    }
    heldBreak = { lastKeyAt, pieces: [], typed, interrupted: false };
}

export function usLayoutChar(code: string, shift: boolean, caps = false): string {
    const letter = /^Key([A-Z])$/.exec(code);
    if (letter) return shift !== caps ? letter[1] : letter[1].toLowerCase();
    const digit = /^Digit([0-9])$/.exec(code);
    if (digit) return shift ? US_SHIFTED_DIGITS.charAt(Number(digit[1])) : digit[1];
    const pad = /^Numpad([0-9])$/.exec(code);
    if (pad) return pad[1];
    const pair = Object.prototype.hasOwnProperty.call(US_PUNCTUATION, code) ? US_PUNCTUATION[code] : '';
    return pair ? pair.charAt(shift ? 1 : 0) : '';
}

export function scannerKeyChar(e: KeyboardEvent): string {
    if (!e || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return '';
    const key = typeof e.key === 'string' ? e.key : '';
    if (/^[!-~]$/.test(key)) return key;
    if (!key || /\s/.test(key) || Array.from(key).every((c) => c.charCodeAt(0) < 128)) return '';
    const caps = typeof e.getModifierState === 'function' && e.getModifierState('CapsLock');
    const us = usLayoutChar(typeof e.code === 'string' ? e.code : '', !!e.shiftKey, !!caps);
    if (us) return us;
    const digit = latinDigits(key);
    return /^[0-9]$/.test(digit) ? digit : '';
}

function scannerCaptureField(): RefName | null {
    if (uiState.drawerOpen || uiState.notifyDrawerOpen || securityState.appIsLocked || activeElementTakesText()) return null;
    if (!uiState.isModalOpen) return uiState.currentAppPage === 'entry' ? 'hwScannerInput' : null;
    const stack = Array.isArray(uiState.modalStack) ? uiState.modalStack : [];
    return stack[stack.length - 1] === 'batchScanModal' ? 'batchBarcodeInput' : null;
}

function scannerFieldOf(target: EventTarget | null): RefName | null {
    for (const name of SCANNER_FIELDS) {
        if (target && elementOf(name) === target) return name;
    }
    return null;
}

function forgetScanBurst(): void {
    scanBurst = { count: 0, at: -Infinity, field: null };
}

function scannerHoldScope(): boolean {
    if (!uiState.isModalOpen || securityState.appIsLocked || (softKeyboardShown() && !isAndroidDevice())) return false;
    const stack = Array.isArray(uiState.modalStack) ? uiState.modalStack : [];
    if (stack[stack.length - 1] === 'batchScanModal') return false;
    if (stack[stack.length - 1] === 'ztoPalmSignModal') return true;
    const active = document.activeElement;
    if (active && MODAL_HOLD_FIELDS.some((name) => elementOf(name) === active)) return true;
    return !activeElementTakesText() && !(active instanceof HTMLSelectElement);
}

function dropHeldKeys(): void {
    if (heldKeys && heldKeys.timer !== null) clearTimeout(heldKeys.timer);
    heldKeys = null;
}

function releaseHeldKeys(nextKeyAt?: number): void {
    const held = heldKeys;
    if (!held) return;
    const scanned = scanBurst.count >= SCANNER_MIN_CHARS;
    const lastKeyAt = scanBurst.at;
    const paused = typeof nextKeyAt === 'number' && nextKeyAt - lastKeyAt >= 0 && nextKeyAt - lastKeyAt <= SCANNER_SUFFIX_GAP_MS;
    const head = held.tailOf;
    const interrupted = scanned || !!(head && head.interrupted);
    dropHeldKeys();
    forgetScanBurst();
    heldBreak = null;
    if (paused) {
        if (held.broken) setFieldValue(held.broken, '');
        heldBreak = { lastKeyAt, pieces: interrupted ? [] : (head ? head.pieces : []).concat([{ el: held.el, text: held.text, owner: held.owner }]),
            typed: head ? head.typed : null, interrupted };
        return;
    }
    if (interrupted && (head || !scanned)) {
        interruptedScan(held);
        return;
    }
    if (!scanned) {
        typeHeldPieces((head ? head.pieces : []).concat([{ el: held.el, text: held.text, owner: held.owner }]), lastKeyAt);
        return;
    }
    if (held.broken) setFieldValue(held.broken, '');
    showToast(`⚠️ ការស្កេន (${held.scan}) គ្មាន Enter/Tab ពីម៉ាស៊ីនស្កេន ➜ មិនបានបញ្ចូលក្នុងផ្ទាំងទេ។ សូមកំណត់ម៉ាស៊ីនស្កេនឲ្យបញ្ចប់ដោយ Enter ឬ Tab រួចស្កេនម្ដងទៀត។`);
}

function continuesHeldBurst(e: KeyboardEvent, at: number): boolean {
    const gap = at - scanBurst.at;
    if (e.repeat || !(gap >= 0)) return false;
    if (e.key === 'Enter' || e.key === 'Tab') return !(e.key === 'Tab' && e.shiftKey) && scanBurst.count >= SCANNER_MIN_CHARS && gap <= SCANNER_SUFFIX_GAP_MS;
    if (BURST_KEEP_KEYS.has(e.key)) return true;
    return gap <= SCANNER_KEY_GAP_MS && !!scannerKeyChar(e);
}

function holdScannerKey(e: KeyboardEvent, at: number): void {
    if (e.key === 'Enter' || e.key === 'Tab') {
        const held = heldKeys;
        forgetScanBurst();
        if (!held) return;
        dropHeldKeys();
        heldBreak = null;
        e.preventDefault();
        e.stopPropagation();
        if (held.tailOf) {
            interruptedScan(held);
            return;
        }
        if (held.broken === false) {
            if (!acceptPalmSignBarcode(held.scan)) queueScannedCode(held.scan);
            return;
        }
        if (held.broken) setFieldValue(held.broken, '');
        showToast('⚠️ ការស្កេនត្រូវបានកាត់ដោយផ្ទាំងដែលទើបបើក — សូមស្កេនម្ដងទៀត។');
        return;
    }
    const ch = scannerKeyChar(e);
    if (!ch) {
        if (!BURST_KEEP_KEYS.has(e.key)) forgetScanBurst();
        return;
    }
    const gap = at - scanBurst.at;
    const fast = gap >= 0 && gap <= SCANNER_KEY_GAP_MS;
    e.preventDefault();
    if (!heldKeys) {
        const head = heldBreak && at - heldBreak.lastKeyAt >= 0 && at - heldBreak.lastKeyAt <= SCANNER_SUFFIX_GAP_MS ? heldBreak : null;
        if (heldBreak && !head && heldBreak.pieces.length) typeHeldPieces(heldBreak.pieces, heldBreak.lastKeyAt);
        heldBreak = null;
        heldKeys = { scan: '', text: '', el: document.activeElement, broken: fast && scanBurst.count > 0 ? scanBurst.field : false, timer: null,
            owner: heldOwner(), tailOf: head };
    }
    const held = heldKeys;
    scanBurst = { count: fast ? scanBurst.count + 1 : 1, at, field: null };
    held.scan += ch;
    held.text += e.key;
    if (held.timer !== null) clearTimeout(held.timer);
    held.timer = setTimeout(() => releaseHeldKeys(), scanBurst.count >= 2 || held.tailOf ? SCANNER_SUFFIX_GAP_MS : SCANNER_KEY_GAP_MS);
}

export function noteScannerKeyDown(e: KeyboardEvent): void {
    if (!e || e.defaultPrevented) return;
    const at = Number(e.timeStamp);
    if (heldKeys && !continuesHeldBurst(e, at)) releaseHeldKeys(scannerKeyChar(e) ? at : undefined);
    if (e.repeat) return;
    if (heldKeys || scannerHoldScope()) {
        holdScannerKey(e, at);
        return;
    }
    const inField = scannerFieldOf(e.target);
    if (e.key === 'Tab' || e.key === 'Enter') {
        const gap = at - scanBurst.at;
        const ended = scanBurst.count >= SCANNER_MIN_CHARS && gap >= 0 && gap <= SCANNER_SUFFIX_GAP_MS;
        forgetScanBurst();
        const field = inField ? elementOf<HTMLInputElement>(inField) : null;
        if (!field || e.key !== 'Tab' || !ended || e.shiftKey || !field.value.trim()) return;
        if (inField !== 'hwScannerInput') {
            if (insertFieldText(inField, '\n')) e.preventDefault();
            return;
        }
        e.preventDefault();
        submitManualBarcode();
        return;
    }
    const target = inField || scannerCaptureField();
    const field = target ? elementOf<HTMLInputElement>(target) : null;
    if (!target || !field) {
        forgetScanBurst();
        return;
    }
    const ch = scannerKeyChar(e);
    if (!ch) {
        if (!BURST_KEEP_KEYS.has(e.key)) forgetScanBurst();
        return;
    }
    const gap = at - scanBurst.at;
    scanBurst = gap >= 0 && gap <= SCANNER_KEY_GAP_MS ? { count: scanBurst.count + 1, at, field: target } : { count: 1, at, field: target };
    if (inField) {
        if (ch !== e.key && insertFieldText(target, ch)) e.preventDefault();
        return;
    }
    if (focusElementWithoutScroll(field) && insertFieldText(target, ch)) e.preventDefault();
}

export function setupHardwareScanner() {
    dropHeldKeys();
    forgetScanBurst();
    heldBreak = null;
    document.addEventListener('keydown', noteScannerKeyDown, true);
    document.addEventListener('click', (e) => {
        const clickTarget = e.target as any;
        if (!uiState.isModalOpen && clickTarget.tagName !== 'INPUT' && clickTarget.tagName !== 'TEXTAREA' && clickTarget.tagName !== 'SELECT' && clickTarget.tagName !== 'BUTTON' && clickTarget.tagName !== 'A' && !isMobileDevice()) {
            focusFieldAsIs('hwScannerInput');
        }
    });
}

export function hardwareScannerKeyPress(e: { key: string; preventDefault(): void }) {
    if (e.key === 'Enter') {
        e.preventDefault();
        submitManualBarcode();
    }
}

export function setupVisibilityHandling() {
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && securityState.configQrScanActive) closeConfigQrScanner();
        if (document.hidden && scanState.isCameraScanning) {
            stopCurrentStream();
            showCameraClosedBox();
        }
    });
}
