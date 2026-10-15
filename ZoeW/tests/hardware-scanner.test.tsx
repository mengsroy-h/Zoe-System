/**
 * ⛔ សំណើម្ចាស់គម្រោង ៖ «ពិនិត្យរបៀបស្កេនតាមឧបករណ៍ស្កេន Bluetooth ឬ USB» ➜ «ដោយស្វ័យប្រវត្តិ និយាយអោយចំ អោយគ្របយ៉ាងវាគណនាដោយស្វ័យប្រវត្តិ»។
 *    ឧបករណ៍ស្កេន = keyboard (HID) ៖ វាយលេខលឿនៗ ហើយបញ្ចប់ដោយ Enter (ឬ Tab)។ វាស់ (Chromium ពិត · App ពិត) ៖ ទូរស័ព្ទគ្មានអ្វី focus ➜ ការស្កេនបាត់ ·
 *    keyboard ខ្មែរ ➜ `key` = «១» (`code` = Digit1) ➜ Barcode ជាលេខខ្មែរ · Tab ➜ ចេញពីប្រអប់ ការស្កេនមិនបញ្ជូន។
 * ⛔ ច្បាប់ ៖ ទំព័រស្កេន · គ្មានប្រអប់/ផ្ទាំងចំហៀង · មិនចាក់សោ · គ្មានកន្លែងវាយអក្សរ focus ➜ គ្រាប់ចុចតួអក្សរ ➜ ប្រអប់ Barcode (focus មិនរំកិល) ·
 *    `key` មិនមែន ASCII ➜ តួអក្សរ US នៃគ្រាប់ (`code`) · លេខខ្មែរ ➜ លេខឡាតាំង (ការស្កេនទាំងអស់ · បញ្ចូលច្រើន) · ≥ SCANNER_MIN_CHARS គ្រាប់លឿន
 *    (≤ SCANNER_KEY_GAP_MS) + Tab ក្នុង SCANNER_SUFFIX_GAP_MS ➜ បញ្ជូនដូច Enter។ ទិសផ្ទុយ ៖ ប្រអប់ស្វែងរក focus · ប្រអប់បើក · ទំព័រទិន្នន័យ · ចាក់សោ ·
 *    វាយយឺត + Tab · Shift+Tab · Ctrl ➜ មិនប៉ះ។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as scanAction from '../src/features/scan-action';
import * as lockerAssign from '../src/features/locker-assign';
import { scanState, securityState, uiState } from '../src/core/state';
import { latinDigits } from '../src/core/text';
import { parseBatchBarcodes } from '../src/features/batch-scan';
import { SCANNER_KEY_GAP_MS, SCANNER_MIN_CHARS, SCANNER_SUFFIX_GAP_MS, noteScannerKeyDown, scannerKeyChar, usLayoutChar } from '../src/app/behaviors/scanner-input';
import { AppPages } from '../src/app/components/AppPages';
import { BatchScanModal } from '../src/app/components/modals/BatchScanModal';
import { PhoneModal } from '../src/app/components/modals/PhoneModal';
import { closeModal, openModalHelper } from '../src/ui/modal';
import { viewState } from '../src/core/view-state';
import '../src/app/flush';
import { byId, mount, step, unmount } from './native/react-harness';

let scanned: string[];
let focusOptions: any[];

function key(target: EventTarget, k: string, code: string, t: number, extra: Partial<KeyboardEventInit> = {}) {
    const ev = new KeyboardEvent('keydown', Object.assign({ key: k, code, bubbles: true, cancelable: true }, extra));
    Object.defineProperty(ev, 'timeStamp', { value: t });
    target.dispatchEvent(ev);
    const editable = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
    if (!ev.defaultPrevented && editable && (k.length === 1 || (k === 'Enter' && target instanceof HTMLTextAreaElement)) && !extra.ctrlKey) {
        (target as HTMLInputElement).value += k === 'Enter' ? '\n' : k;
        target.dispatchEvent(new Event('input', { bubbles: true }));
    }
    if (!ev.defaultPrevented && k === 'Enter' && target === byId('hwScannerInput')) {
        const press = new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', charCode: 13, keyCode: 13, bubbles: true, cancelable: true });
        target.dispatchEvent(press);
    }
    return ev;
}

function scan(code: string, start: number, gap = 12, suffix = 'Enter', layout?: Record<string, string>) {
    let t = start;
    for (const c of code) {
        const target = document.activeElement || document.body;
        const physical = /[0-9]/.test(c) ? 'Digit' + c : 'Key' + c.toUpperCase();
        key(target, layout && layout[c] ? layout[c] : c, physical, t, { shiftKey: /[A-Z]/.test(c) });
        t += gap;
    }
    return key(document.activeElement || document.body, suffix, suffix, t);
}

const KHMER_DIGITS: Record<string, string> = { 0: '០', 1: '១', 2: '២', 3: '៣', 4: '៤', 5: '៥', 6: '៦', 7: '៧', 8: '៨', 9: '៩' };

beforeEach(() => {
    scanned = [];
    vi.spyOn(scanAction, 'triggerScanAction').mockImplementation((code: string) => { scanned.push(code); });
    step(() => {
        uiState.modalDisplay = {};
        uiState.modalStack = [];
        uiState.isModalOpen = false;
        uiState.drawerOpen = false;
        uiState.notifyDrawerOpen = false;
        uiState.currentAppPage = 'entry';
        uiState.entryScanMode = 'parcel';
        securityState.appIsLocked = false;
    });
    mount(<><AppPages /><BatchScanModal /><PhoneModal /></>);
    document.addEventListener('keydown', noteScannerKeyDown, true);
    focusOptions = [];
    const field = byId('hwScannerInput') as HTMLInputElement;
    const realFocus = HTMLElement.prototype.focus;
    field.focus = function (this: HTMLInputElement, options?: any) { focusOptions.push(options); realFocus.call(this, options); } as any;
    (document.activeElement as HTMLElement | null)?.blur?.();
});

afterEach(() => {
    step(() => { closeModal('phoneModal'); closeModal('batchScanModal'); });
    document.removeEventListener('keydown', noteScannerKeyDown, true);
    vi.restoreAllMocks();
    unmount();
    document.body.innerHTML = '';
    step(() => { uiState.currentAppPage = 'data'; });
});

describe('ឧបករណ៍ស្កេន (Bluetooth/USB) ៖ គ្រាប់ចុច ➜ តួអក្សរ', () => {
    it('⛔ តួអក្សរ US នៃគ្រាប់ (code) ៖ អក្សរ · Shift · CapsLock · លេខ · Shift+លេខ · Numpad · សញ្ញា · មិនស្គាល់ ➜ ទទេ', () => {
        expect(usLayoutChar('KeyA', false)).toBe('a');
        expect(usLayoutChar('KeyA', true)).toBe('A');
        expect(usLayoutChar('KeyZ', false, true)).toBe('Z');
        expect(usLayoutChar('KeyZ', true, true)).toBe('z');
        expect(usLayoutChar('Digit7', false)).toBe('7');
        expect(usLayoutChar('Digit7', true)).toBe('&');
        expect(usLayoutChar('Digit0', true)).toBe(')');
        expect(usLayoutChar('Numpad5', false)).toBe('5');
        expect(usLayoutChar('Minus', false)).toBe('-');
        expect(usLayoutChar('Slash', false)).toBe('/');
        expect(usLayoutChar('Slash', true)).toBe('?');
        expect(usLayoutChar('Period', false)).toBe('.');
        for (const bad of ['', 'Enter', 'Tab', 'ShiftLeft', 'F1', 'toString', 'constructor', '__proto__']) expect(usLayoutChar(bad, false)).toBe('');
    });

    it('⛔ keyboard ខ្មែរ (key «១» · code Digit1) ➜ «1» · អក្សរខ្មែរលើ KeyA ➜ «a» · Shift ➜ «A» · ASCII ➜ ដដែល (ប្លង់ផ្សេងមិនប៉ះ) · លេខខ្មែរគ្មាន code ➜ លេខឡាតាំង', () => {
        const ev = (init: KeyboardEventInit) => new KeyboardEvent('keydown', init);
        expect(scannerKeyChar(ev({ key: '១', code: 'Digit1' }))).toBe('1');
        expect(scannerKeyChar(ev({ key: 'ា', code: 'KeyA' }))).toBe('a');
        expect(scannerKeyChar(ev({ key: 'ៈ', code: 'KeyA', shiftKey: true }))).toBe('A');
        expect(scannerKeyChar(ev({ key: '7', code: 'Digit7' }))).toBe('7');
        expect(scannerKeyChar(ev({ key: '&', code: 'Digit1' }))).toBe('&');
        expect(scannerKeyChar(ev({ key: '៩', code: '' }))).toBe('9');
        expect(scannerKeyChar(ev({ key: 'ក', code: '' }))).toBe('');
        expect(scannerKeyChar(ev({ key: 'ុះ', code: 'KeyH', shiftKey: true }))).toBe('H');
        expect(scannerKeyChar(ev({ key: 'ោះ', code: 'KeyO' }))).toBe('o');
        expect(scannerKeyChar(ev({ key: 'ុះ', code: '' }))).toBe('');
    });

    it('ទិសផ្ទុយ ៖ Ctrl/Meta/Alt · Space · Enter/Tab · Unidentified (keyboard លើអេក្រង់) · composing · តម្លៃខុស ➜ ទទេ មិនបោះ', () => {
        const ev = (init: KeyboardEventInit) => new KeyboardEvent('keydown', init);
        expect(scannerKeyChar(ev({ key: 'v', code: 'KeyV', ctrlKey: true }))).toBe('');
        expect(scannerKeyChar(ev({ key: 'v', code: 'KeyV', metaKey: true }))).toBe('');
        expect(scannerKeyChar(ev({ key: '1', code: 'Digit1', altKey: true }))).toBe('');
        expect(scannerKeyChar(ev({ key: ' ', code: 'Space' }))).toBe('');
        expect(scannerKeyChar(ev({ key: 'Enter', code: 'Enter' }))).toBe('');
        expect(scannerKeyChar(ev({ key: 'Unidentified', code: '' }))).toBe('');
        expect(scannerKeyChar(ev({ key: 'a', code: 'KeyA', isComposing: true }))).toBe('');
        expect(scannerKeyChar(null as any)).toBe('');
        expect(scannerKeyChar({ key: undefined, code: 5 } as any)).toBe('');
    });

    it('⛔ លេខខ្មែរ ➜ លេខឡាតាំង (latinDigits) · អក្សរផ្សេងដដែល · បញ្ចូលច្រើន ៖ «១២៣» និង «123» ជា Barcode តែមួយ', () => {
        expect(latinDigits('៧៧១០០០០០៣០៨៧៥១')).toBe('77100000308751');
        expect(latinDigits('ZT-៨៨/០១')).toBe('ZT-88/01');
        expect(latinDigits('abc')).toBe('abc');
        expect(parseBatchBarcodes('១២៣ 123\n៤៥៦')).toEqual(['123', '456']);
    });

    it('⛔ triggerScanAction() (ផ្លូវស្កេនតែមួយ) ៖ Barcode លេខខ្មែរ ➜ លេខឡាតាំង (របៀប Locker ឃើញ «12345»)', () => {
        vi.mocked(scanAction.triggerScanAction).mockRestore();
        const locker = vi.spyOn(lockerAssign, 'handleLockerScan').mockImplementation(() => {});
        step(() => { uiState.entryScanMode = 'locker'; });
        scanAction.triggerScanAction(' ១២៣៤៥ ');
        expect(locker).toHaveBeenCalledWith('12345');
    });
});

describe('ឧបករណ៍ស្កេន ៖ ការស្កេនមិនបាត់ (គ្មានកន្លែងវាយ focus)', () => {
    it('⛔ ទូរស័ព្ទ ៖ គ្មានអ្វី focus ➜ ស្កេន + Enter ➜ ប្រអប់ Barcode ទទួល (focus({ preventScroll })) ➜ បញ្ជូនម្តង · ប្រអប់ទទេវិញ', () => {
        expect(document.activeElement).toBe(document.body);
        const first = key(document.body, '7', 'Digit7', 0);
        expect(first.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(byId('hwScannerInput'));
        expect(focusOptions).toEqual([{ preventScroll: true }]);
        scan('7100000308751', 10);
        expect(scanned).toEqual(['77100000308751']);
        expect((byId('hwScannerInput') as HTMLInputElement).value).toBe('');
    });

    it('⛔ focus នៅលើប៊ូតុង/select (មិនមែនកន្លែងវាយ) ➜ ស្កេនទៅប្រអប់ Barcode · Enter មិនចុចប៊ូតុង', () => {
        const button = document.createElement('button');
        let clicks = 0;
        button.addEventListener('click', () => clicks++);
        const select = document.createElement('select');
        select.innerHTML = '<option>A1</option><option>B2</option>';
        document.body.append(button, select);
        button.focus();
        scan('88123', 0);
        expect(scanned).toEqual(['88123']);
        expect(clicks).toBe(0);
        (byId('hwScannerInput') as HTMLInputElement).blur();
        select.focus();
        scan('99456', 1000);
        expect(scanned).toEqual(['88123', '99456']);
        expect(select.value).toBe('A1');
    });

    it('⛔ keyboard ខ្មែរ ៖ ស្កេនផ្ញើ key «៧៧១…» (code Digit*) ➜ Barcode «771…» (ប្រអប់ focus រួច ឬមិនទាន់)', () => {
        scan('77100000308751', 0, 12, 'Enter', KHMER_DIGITS);
        expect(scanned).toEqual(['77100000308751']);
        scan('7710', 1000, 12, 'Enter', KHMER_DIGITS);
        expect(scanned).toEqual(['77100000308751', '7710']);
    });

    it('⛔ Tab (ឧបករណ៍ស្កេនកំណត់ suffix Tab) ៖ ≥ SCANNER_MIN_CHARS គ្រាប់លឿន + Tab ➜ បញ្ជូន · focus នៅប្រអប់ (Tab មិនចេញ)', () => {
        const tab = scan('77100000308751', 0, SCANNER_KEY_GAP_MS, 'Tab');
        expect(tab.defaultPrevented).toBe(true);
        expect(scanned).toEqual(['77100000308751']);
        expect(document.activeElement).toBe(byId('hwScannerInput'));
        expect(SCANNER_SUFFIX_GAP_MS).toBeGreaterThanOrEqual(SCANNER_KEY_GAP_MS);
    });

    it('ទិសផ្ទុយ ៖ វាយដោយដៃយឺត + Tab · តិចជាង SCANNER_MIN_CHARS · Shift+Tab · Tab យឺតពេក ➜ Tab ធម្មតា (មិនបញ្ជូន)', () => {
        const field = byId('hwScannerInput') as HTMLInputElement;
        expect(scan('77100', 0, 200, 'Tab').defaultPrevented).toBe(false);
        field.value = '';
        expect(scan('7'.repeat(SCANNER_MIN_CHARS - 1), 5000, 10, 'Tab').defaultPrevented).toBe(false);
        field.value = '';
        let t = 9000;
        for (const c of '77100') { key(document.activeElement || document.body, c, 'Digit' + c, t); t += 10; }
        expect(key(field, 'Tab', 'Tab', t, { shiftKey: true }).defaultPrevented).toBe(false);
        field.value = '';
        t = 12000;
        for (const c of '77100') { key(document.activeElement || document.body, c, 'Digit' + c, t); t += 10; }
        expect(key(field, 'Tab', 'Tab', t + SCANNER_SUFFIX_GAP_MS + 1).defaultPrevented).toBe(false);
        expect(scanned).toEqual([]);
    });

    it('⛔ «📋 បញ្ចូលច្រើន» ៖ គ្មានអ្វី focus ➜ ការស្កេនចូលប្រអប់បញ្ចូលច្រើន · keyboard ខ្មែរ ➜ ឡាតាំង · suffix Tab ➜ ជួរថ្មី (focus នៅ · ការស្កេនបន្ទាប់មិនបាត់) · Enter ➜ ជួរថ្មី · ចំនួនរាប់ឡើង · មិនបញ្ជូន', () => {
        step(() => openModalHelper('batchScanModal'));
        const batch = byId('batchBarcodeInput') as HTMLTextAreaElement;
        (document.activeElement as HTMLElement | null)?.blur?.();
        scan('77100000308751', 0, 12, 'Tab', KHMER_DIGITS);
        expect(document.activeElement).toBe(batch);
        expect(batch.value).toBe('77100000308751\n');
        const letters: Record<string, string> = { Z: 'ឋ', T: 'ទ' };
        scan('ZT88', 1000, 12, 'Tab', Object.assign({}, KHMER_DIGITS, letters));
        scan('9100', 2000, 12, 'Enter');
        expect(batch.value).toBe('77100000308751\nZT88\n9100\n');
        expect(parseBatchBarcodes(batch.value)).toEqual(['77100000308751', 'ZT88', '9100']);
        expect(viewState.batchScanCountText).toBe('3 Barcode');
        expect(scanned).toEqual([]);
    });

    it('ទិសផ្ទុយ ៖ «📋 បញ្ចូលច្រើន» មិននៅខាងលើ (ផ្ទាំងបញ្ជាក់លើវា) · វាយយឺត + Tab ក្នុងប្រអប់បញ្ចូលច្រើន ➜ Tab ធម្មតា', () => {
        step(() => { openModalHelper('batchScanModal'); openModalHelper('phoneModal'); });
        (document.activeElement as HTMLElement | null)?.blur?.();
        expect(key(document.body, '7', 'Digit7', 0).defaultPrevented).toBe(false);
        expect((byId('batchBarcodeInput') as HTMLTextAreaElement).value).toBe('');
        step(() => closeModal('phoneModal'));
        const batch = byId('batchBarcodeInput') as HTMLTextAreaElement;
        batch.focus();
        expect(scan('77100', 1000, 200, 'Tab').defaultPrevented).toBe(false);
        expect(batch.value).toBe('77100');
    });

    it('ទិសផ្ទុយ ៖ ប្រអប់ស្វែងរក focus · ប្រអប់ (modal) បើក · ទំព័រទិន្នន័យ · ចាក់សោ · ផ្ទាំងចំហៀង · Ctrl+V ➜ មិនលួច', () => {
        const search = byId('entryListSearchInput') as HTMLInputElement;
        search.focus();
        expect(key(search, '7', 'Digit7', 0).defaultPrevented).toBe(false);
        expect(document.activeElement).toBe(search);
        search.blur();
        const cases: Array<() => void> = [
            () => { uiState.isModalOpen = true; },
            () => { uiState.currentAppPage = 'data'; },
            () => { securityState.appIsLocked = true; },
            () => { uiState.drawerOpen = true; },
            () => { uiState.notifyDrawerOpen = true; }
        ];
        for (const set of cases) {
            step(set);
            expect(key(document.body, '7', 'Digit7', 100).defaultPrevented).toBe(false);
            expect(document.activeElement).toBe(document.body);
            step(() => {
                uiState.isModalOpen = false;
                uiState.currentAppPage = 'entry';
                securityState.appIsLocked = false;
                uiState.drawerOpen = false;
                uiState.notifyDrawerOpen = false;
            });
        }
        expect(key(document.body, 'v', 'KeyV', 200, { ctrlKey: true }).defaultPrevented).toBe(false);
        expect(document.activeElement).toBe(document.body);
        expect(focusOptions).toEqual([]);
        expect(scanState.pendingBarcode || '').toBe('');
    });
});
