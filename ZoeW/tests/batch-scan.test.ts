/**
 * ⛔ សំណើម្ចាស់គម្រោង ៖ «បន្ថែមកន្លែងបញ្ចូល barcode ដោយវាយបញ្ចូល ឬឧបករណ៍ស្កេន barcode បានច្រើន 10-20 barcode ទើបចុចបញ្ចូលម្តង ហើយអោយ auto lookup ដូចគ្នាបេះបិទ»។
 * ⛔ ច្បាប់ ៖ `startBatchScan()` ញែកអត្ថបទ (ជួរ · ចន្លោះ · , ;) ➜ Barcode តែមួយៗ (dedupe · ≤ `BATCH_SCAN_MAX`) ➜ បញ្ចូល **ម្តងមួយៗ** តាម `triggerScanAction()`
 *    ដដែល (ផ្លូវស្កេនធម្មតា ៖ lookup · ផ្ទាំងបញ្ជាក់ · Fast Mode) ➜ រង់ចាំផ្ទាំង `phoneModal` បិទ (រក្សាទុក ឬបោះបង់) ទើបបន្ត · Barcode មានរួច ➜ រំលង ·
 *    ផ្ទាំងផ្សេងបើក ➜ រង់ចាំ · ប្តូររបៀបស្កេន ➜ ឈប់ · ប្តូរ session (auth/db) ➜ ឈប់ស្ងាត់ · «បញ្ឈប់» ➜ ចប់ក្រោយកញ្ចប់បច្ចុប្បន្ន · logout ➜ `resetBatchScan()`។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import * as scanAction from '../src/features/scan-action';
import * as toastModule from '../src/ui/toast';
const toasts: string[] = [];
let trigger: ReturnType<typeof vi.spyOn>;

import { dataState, firebaseState, scanState, uiState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import { MODAL_IDS, modalIsOpen, registerModalMeta, unregisterModalMeta } from '../src/core/modals';
import { ACTION_NAMES } from '../src/core/action-registry';
import { ACTION_ALLOWLIST } from '../src/core/runtime';
import { refTo } from '../src/app/refs';
import { closeModal, openModalHelper } from '../src/ui/modal';
import { BATCH_SCAN_MAX, batchScanIsRunning, openBatchScanModal, parseBatchBarcodes, resetBatchScan, startBatchScan, stopBatchScan, updateBatchScanCount } from '../src/features/batch-scan';

let input: HTMLTextAreaElement;
let opensModal: Set<string>;

function saved(code: string) {
    dataState.scanHistory.push({ id: 'I' + code, phone: '0961000000', barcodes: [{ code }] });
}

function flush() { uiState.flush(); viewState.flush(); }

function finishModal(save: boolean) {
    const code = scanState.pendingBarcode;
    if (save) saved(code);
    closeModal('phoneModal');
    flush();
}

beforeEach(() => {
    toasts.length = 0;
    vi.spyOn(toastModule, 'showToast').mockImplementation((t: any) => { toasts.push(String(t)); });
    opensModal = new Set();
    trigger = vi.spyOn(scanAction, 'triggerScanAction').mockImplementation((code: string) => {
        if (!opensModal.has(code)) return;
        scanState.pendingBarcode = code;
        openModalHelper('phoneModal');
    });
    dataState.scanHistory = [];
    dataState.deletedItems = [];
    uiState.entryScanMode = 'parcel';
    uiState.isModalOpen = false;
    uiState.modalDisplay = {};
    uiState.modalStack = [];
    firebaseState.authGeneration = 1;
    registerModalMeta('phoneModal', {});
    registerModalMeta('batchScanModal', {});
    input = document.createElement('textarea');
    document.body.appendChild(input);
    refTo('batchBarcodeInput')(input);
});

afterEach(() => {
    resetBatchScan();
    vi.restoreAllMocks();
    refTo('batchBarcodeInput')(null);
    input.remove();
    unregisterModalMeta('phoneModal');
    unregisterModalMeta('batchScanModal');
    uiState.isModalOpen = false;
    uiState.modalDisplay = {};
    uiState.modalStack = [];
});

describe('បញ្ចូល Barcode ច្រើន ៖ ញែក', () => {
    it('ជួរ · ចន្លោះ · , ; ➜ Barcode តែមួយៗ (dedupe មិនខ្វល់អក្សរតូចធំ · trim · ទទេរំលង)', () => {
        expect(parseBatchBarcodes(' A1\nB2\r\n\n b2 , C3;D4\tE5 ')).toEqual(['A1', 'B2', 'C3', 'D4', 'E5']);
        expect(parseBatchBarcodes('')).toEqual([]);
        expect(parseBatchBarcodes(null)).toEqual([]);
    });

    it('ចំនួនក្នុងផ្ទាំង ៖ updateBatchScanCount ➜ «N Barcode» · ទទេ ➜ «»', () => {
        input.value = 'A1\nA1\nB2';
        updateBatchScanCount();
        expect(viewState.batchScanCountText).toBe('2 Barcode');
        input.value = '';
        updateBatchScanCount();
        expect(viewState.batchScanCountText).toBe('');
    });
});

describe('បញ្ចូល Barcode ច្រើន ៖ ម្តងមួយៗតាម triggerScanAction · រង់ចាំផ្ទាំង', () => {
    it('⛔ ៣ Barcode ៖ ផ្ទាំងបើកម្តងមួយ ➜ បិទ (រក្សាទុក) ➜ បន្ទាប់ · ចប់ ➜ toast សរុប · ស្ថានភាពសម្អាត', () => {
        opensModal = new Set(['A1', 'B2', 'C3']);
        input.value = 'A1\nB2\nC3';
        startBatchScan();
        expect(trigger.mock.calls.map((c) => c[0])).toEqual(['A1']);
        expect(modalIsOpen('phoneModal')).toBe(true);
        expect(modalIsOpen('batchScanModal')).toBe(false);
        expect(input.value).toBe('');
        expect(viewState.batchScanStatus).toContain('1/3');
        expect(viewState.batchScanStatus).toContain('A1');
        finishModal(true);
        expect(trigger.mock.calls.map((c) => c[0])).toEqual(['A1', 'B2']);
        expect(viewState.batchScanStatus).toContain('2/3');
        finishModal(false);
        expect(trigger.mock.calls.map((c) => c[0])).toEqual(['A1', 'B2', 'C3']);
        finishModal(true);
        expect(batchScanIsRunning()).toBe(false);
        expect(viewState.batchScanStatus).toBe('');
        expect(toasts[toasts.length - 1]).toBe('✅ បញ្ចូលច្រើនចប់ ៖ បញ្ចូល 2 · រំលង 1');
    });

    it('⛔ Barcode មានរួច ➜ រំលងមុន triggerScanAction · Barcode ដែល trigger មិនបើកផ្ទាំង (toast) ➜ បន្តភ្លាម', () => {
        saved('OLD');
        opensModal = new Set(['N2']);
        input.value = 'OLD N1 N2';
        startBatchScan();
        expect(trigger.mock.calls.map((c) => c[0])).toEqual(['N1', 'N2']);
        expect(viewState.batchScanStatus).toContain('3/3');
        finishModal(true);
        expect(batchScanIsRunning()).toBe(false);
        expect(toasts[toasts.length - 1]).toBe('✅ បញ្ចូលច្រើនចប់ ៖ បញ្ចូល 1 · មានរួច 1 · រំលង 1');
    });

    it('ផ្ទាំងផ្សេងបើកខណៈរង់ចាំ ➜ មិន trigger · បិទ ➜ បន្ត', () => {
        registerModalMeta('callMarkModal', {});
        opensModal = new Set(['A1', 'B2']);
        input.value = 'A1\nB2';
        startBatchScan();
        openModalHelper('callMarkModal');
        closeModal('phoneModal');
        flush();
        expect(trigger.mock.calls.length).toBe(1);
        closeModal('callMarkModal');
        flush();
        expect(trigger.mock.calls.map((c) => c[0])).toEqual(['A1', 'B2']);
        unregisterModalMeta('callMarkModal');
    });

    it('⛔ «បញ្ឈប់» ខណៈផ្ទាំងបើក ➜ ចប់ក្រោយកញ្ចប់នេះ (សល់ រាយ «មិនទាន់បញ្ចូល») · បញ្ឈប់ពេលទំនេរ ➜ ចប់ភ្លាម', () => {
        opensModal = new Set(['A1', 'B2', 'C3']);
        input.value = 'A1 B2 C3';
        startBatchScan();
        stopBatchScan();
        expect(batchScanIsRunning()).toBe(true);
        finishModal(true);
        expect(batchScanIsRunning()).toBe(false);
        expect(trigger.mock.calls.length).toBe(1);
        expect(toasts[toasts.length - 1]).toContain('បញ្ចូល 1');
        expect(toasts[toasts.length - 1]).not.toContain('មិនទាន់បញ្ចូល');
    });

    it('ប្តូររបៀបស្កេន ➜ ឈប់ (toast ប្រាប់ · សល់) · ប្តូរ session ➜ ឈប់ស្ងាត់ · logout (resetBatchScan) ➜ សម្អាតទាំងអស់', () => {
        opensModal = new Set(['A1', 'B2']);
        input.value = 'A1 B2';
        startBatchScan();
        uiState.entryScanMode = 'locker';
        finishModal(true);
        expect(batchScanIsRunning()).toBe(false);
        expect(toasts[toasts.length - 1]).toContain('ប្តូររបៀបស្កេន');
        expect(toasts[toasts.length - 1]).toContain('មិនទាន់បញ្ចូល 1');
        uiState.entryScanMode = 'parcel';
        toasts.length = 0;
        input.value = 'X1 X2';
        opensModal = new Set(['X1', 'X2']);
        startBatchScan();
        firebaseState.authGeneration++;
        finishModal(true);
        expect(batchScanIsRunning()).toBe(false);
        expect(trigger.mock.calls.filter((c) => c[0] === 'X2').length).toBe(0);
        expect(toasts.length).toBe(0);
        input.value = 'Y1 Y2';
        opensModal = new Set(['Y1']);
        startBatchScan();
        resetBatchScan();
        expect(batchScanIsRunning()).toBe(false);
        expect(viewState.batchScanStatus).toBe('');
        expect(input.value).toBe('');
        closeModal('phoneModal');
        flush();
        expect(trigger.mock.calls.filter((c) => c[0] === 'Y2').length).toBe(0);
    });

    it('ទទេ ➜ toast · លើស BATCH_SCAN_MAX ➜ toast មិនចាប់ផ្តើម · openBatchScanModal តែរបៀប parcel និងគ្មានផ្ទាំង', () => {
        input.value = '  \n ';
        startBatchScan();
        expect(batchScanIsRunning()).toBe(false);
        expect(toasts[toasts.length - 1]).toContain('យ៉ាងតិចមួយ');
        input.value = Array.from({ length: BATCH_SCAN_MAX + 1 }, (_, i) => 'Z' + i).join('\n');
        startBatchScan();
        expect(batchScanIsRunning()).toBe(false);
        expect(toasts[toasts.length - 1]).toContain(String(BATCH_SCAN_MAX));
        uiState.entryScanMode = 'locker';
        openBatchScanModal();
        expect(modalIsOpen('batchScanModal')).toBe(false);
        uiState.entryScanMode = 'parcel';
        openBatchScanModal();
        expect(modalIsOpen('batchScanModal')).toBe(true);
    });

    it('⛔ ខ្សែភ្ជាប់ ៖ modal ក្នុង MODAL_IDS + AppShell · សកម្មភាពក្នុង ACTION_ALLOWLIST = ACTION_NAMES · ប៊ូតុងក្នុង PageEntry · logout ហៅ resetBatchScan', () => {
        const root = path.join(__dirname, '..', 'src');
        expect(MODAL_IDS).toContain('batchScanModal');
        expect(readFileSync(path.join(root, 'app', 'components', 'AppShell.tsx'), 'utf8')).toMatch(/<BatchScanModal \/>/);
        ['openBatchScanModal', 'startBatchScan', 'stopBatchScan', 'updateBatchScanCount'].forEach((a) => {
            expect(ACTION_NAMES).toContain(a);
            expect(ACTION_ALLOWLIST).toContain(a);
        });
        expect([...ACTION_ALLOWLIST].sort()).toEqual([...ACTION_NAMES].sort());
        const entry = readFileSync(path.join(root, 'app', 'components', 'PageEntry.tsx'), 'utf8');
        expect(entry).toMatch(/onAct\("openBatchScanModal"\)/);
        expect(entry).toMatch(/onAct\("stopBatchScan"\)/);
        expect(readFileSync(path.join(root, 'features', 'session.ts'), 'utf8')).toMatch(/resetBatchScan\(\);/);
    });
});
