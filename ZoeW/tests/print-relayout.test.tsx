/**
 * ⛔ រាយការណ៍ម្ចាស់គម្រោង (វីដេអូ iPhone PWA · APK) ៖ «ពេលប្តូរ Paper size កន្លែង print បាត់ទិន្នន័យពី ZoeW ឃើញតែក្រដាស ស ទាំង iOS និង Android»។
 *    វីដេអូ ៖ ផ្ទាំងបោះពុម្ពបង្ហាញស្លាក (A4 · ៧ ទំព័រ / Letter · ៤៨ ទំព័រ) ➜ ប្តូរ A3 / ISO A5 ➜ «Page 1 of 1» ស។
 * មូលហេតុ ៖ WebKit (iOS) និង WebView (Android) គូរទំព័រសម្រាប់បោះពុម្ពម្តងទៀតរាល់ពេលប្តូរក្រដាស ហើយផ្ញើ `beforeprint`/`afterprint` រាល់ការគូរ ·
 *    `afterprint` ដំបូង (ក្រោយ preview ទីមួយ ខណៈផ្ទាំងបោះពុម្ពនៅបើក) សម្អាត `pdfExportView` ➜ ការគូរបន្ទាប់ឃើញ `#pdfExportPrintArea` ទទេ។
 * ⛔ ច្បាប់ ៖ `afterprint` មិនសម្អាតភ្លាម · ទិដ្ឋភាពបោះពុម្ពនៅរហូតដល់អ្នកប្រើប៉ះ App វិញ (`pointerdown` · `keydown` លើ document) ·
 *    ការបោះពុម្ពថ្មីចាប់ផ្តើមពីសូន្យ · logout (`restoreAfterPdfExport()`) សម្អាតភ្លាម។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';

const { printed, printResult } = vi.hoisted(() => ({ printed: [] as string[], printResult: vi.fn<() => Promise<void> | void>() }));
vi.mock('../src/platform/file-output', async (importOriginal) => ({ ...(await importOriginal<Record<string, unknown>>()), printCurrentView: (name: string) => { printed.push(name); return printResult(); } }));
import * as toastModule from '../src/ui/toast';

import { dataState, uiState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { LABEL_PRINT_OPTIONS_KEY } from '../src/core/storage-keys';
import { armPdfExportRestore, beginPdfPrint, exportDataAsPDF, restoreAfterPdfExport } from '../src/features/export';
import { PRINT_RETURNED_EVENT } from '../src/platform/file-output';
import { openLabelPrintModal, printLabelsFromModal, resetLabelPrint } from '../src/features/label-print';
import { closeModal } from '../src/ui/modal';
import { PdfExportPrintArea } from '../src/app/components/PdfExportPrintArea';
import { LabelPrintModal } from '../src/app/components/modals/LabelPrintModal';
import { mount, step, unmount } from './native/react-harness';

const item = (id: string, phone: string, codes: string[]) =>
    ({ id, phone, scanDate: '2026-10-15', time: '08:00:00 (2026-10-15)', locker: 'N/A', barcodes: codes.map((code) => ({ code, locker: 'N/A', cod: 2.5, dod: 0, isClosed: false })) });

const labels = () => document.querySelectorAll('#pdfExportPrintArea .label').length;
const tableRows = () => document.querySelectorAll('#pdfExportPrintArea tbody tr').length;
const relayout = () => step(() => { window.dispatchEvent(new Event('beforeprint')); window.dispatchEvent(new Event('afterprint')); });
const userTouch = () => step(() => document.dispatchEvent(new Event('pointerdown', { bubbles: true })));
const userKey = () => step(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));

beforeEach(() => {
    printed.length = 0;
    printResult.mockReset();
    vi.spyOn(toastModule, 'showToast').mockImplementation(() => 0);
    try { localStorage.removeItem(LABEL_PRINT_OPTIONS_KEY); } catch {}
    dbListenerPendingPaths.clear();
    dbListenerFailedPaths.clear();
    uiState.currentFilterMode = 'all';
    uiState.customFilterDate = '';
    uiState.pdfExportView = null;
    uiState.isModalOpen = false;
    uiState.modalDisplay = {};
    uiState.modalStack = [];
    dataState.scanHistory = [item('I1', '0960001234', ['77100000308751', '77100000841']), item('I2', '0960005678', ['77100000999'])];
    mount(<><LabelPrintModal /><PdfExportPrintArea /></>);
});

afterEach(() => {
    step(() => { closeModal('labelPrintModal'); resetLabelPrint(); restoreAfterPdfExport(); });
    window.removeEventListener('afterprint', armPdfExportRestore);
    window.removeEventListener(PRINT_RETURNED_EVENT, restoreAfterPdfExport);
    vi.restoreAllMocks();
    unmount();
    dataState.scanHistory = [];
});

describe('បោះពុម្ព ៖ ប្តូរក្រដាស (គូរម្តងទៀត) ➜ ទិន្នន័យនៅ', () => {
    it('⛔ ស្លាក ៖ afterprint ក្រោយ preview ➜ នៅ · ប្តូរក្រដាស ៣ ដង ➜ ស្លាកនៅគ្រប់ដង · ប៉ះ App វិញ ➜ សម្អាត + ចំណងជើងដើម', () => {
        step(() => openLabelPrintModal({ kind: 'filter' }));
        step(() => { expect(printLabelsFromModal()).toBe(true); });
        expect(printed.length).toBe(1);
        expect(labels()).toBe(3);
        expect(viewState.documentTitle).toMatch(/_labels$/);
        relayout();
        expect(labels()).toBe(3);
        relayout();
        relayout();
        expect(uiState.pdfExportView && uiState.pdfExportView.kind).toBe('labels');
        expect(labels()).toBe(3);
        userTouch();
        expect(uiState.pdfExportView).toBeNull();
        expect(labels()).toBe(0);
        expect(viewState.documentTitle).toBeNull();
        expect(uiState.pdfExportOriginalTitle).toBeNull();
    });

    it('⛔ PDF (តារាង) ៖ afterprint ➜ ជួរនៅ · ចុចគ្រាប់ចុច ➜ សម្អាត', () => {
        step(() => exportDataAsPDF());
        expect(printed.length).toBe(1);
        expect(tableRows()).toBe(4);
        relayout();
        relayout();
        expect(tableRows()).toBe(4);
        userKey();
        expect(uiState.pdfExportView).toBeNull();
        expect(tableRows()).toBe(0);
    });

    it('ការប៉ះមុន afterprint (ប៊ូតុងដែលចាប់ផ្តើមបោះពុម្ព) មិនសម្អាត · ការបោះពុម្ពថ្មី ➜ ការរង់ចាំចាស់មិនសម្អាតថ្មីមុន afterprint របស់វា', () => {
        step(() => openLabelPrintModal({ kind: 'filter' }));
        step(() => { printLabelsFromModal(); });
        userTouch();
        userKey();
        expect(labels()).toBe(3);
        relayout();
        expect(labels()).toBe(3);
        step(() => { uiState.pdfExportView = { kind: 'labels', title: 'B', labels: uiState.pdfExportView.labels.slice(0, 1), options: uiState.pdfExportView.options }; beginPdfPrint('B'); });
        expect(labels()).toBe(1);
        userTouch();
        expect(labels()).toBe(1);
        relayout();
        expect(labels()).toBe(1);
        userTouch();
        expect(labels()).toBe(0);
    });

    it('⛔ APK ៖ ត្រឡប់ពីផ្ទាំងបោះពុម្ព (resume ➜ PRINT_RETURNED_EVENT) ➜ សម្អាតភ្លាម + ចំណងជើងដើម · afterprint ពេលគូរ preview មិនសម្អាត', () => {
        step(() => openLabelPrintModal({ kind: 'filter' }));
        step(() => { printLabelsFromModal(); });
        relayout();
        relayout();
        expect(labels()).toBe(3);
        step(() => window.dispatchEvent(new Event(PRINT_RETURNED_EVENT)));
        expect(uiState.pdfExportView).toBeNull();
        expect(labels()).toBe(0);
        expect(viewState.documentTitle).toBeNull();
    });

    it('logout (restoreAfterPdfExport) ➜ សម្អាតភ្លាម · គ្មាន listener សល់', () => {
        step(() => openLabelPrintModal({ kind: 'filter' }));
        step(() => { printLabelsFromModal(); });
        relayout();
        step(() => restoreAfterPdfExport());
        expect(labels()).toBe(0);
        step(() => { uiState.pdfExportView = { kind: 'labels', title: 'C', labels: [], options: {} }; });
        userTouch();
        expect(uiState.pdfExportView && uiState.pdfExportView.title).toBe('C');
    });

    it('ផ្ទាំងបោះពុម្ពបើកមិនបាន (បោះភ្លាម) ➜ មិនបោះកំហុសចេញ · សម្អាតទិដ្ឋភាព និងចំណងជើង', () => {
        printResult.mockImplementation(() => { throw new Error('Print dialog unavailable'); });
        expect(() => step(() => exportDataAsPDF())).not.toThrow();
        expect(printed).toHaveLength(1);
        expect(uiState.pdfExportView).toBeNull();
        expect(uiState.pdfExportOriginalTitle).toBeNull();
        expect(viewState.documentTitle).toBeNull();
        expect(tableRows()).toBe(0);
        expect(toastModule.showToast).toHaveBeenCalledWith('❌ Export PDF បរាជ័យ!');
    });

    it('bridge បោះពុម្ពបដិសេធមុនបើកផ្ទាំង ➜ សម្អាតទិដ្ឋភាព និងចំណងជើងដោយមិនរង់ចាំ afterprint', async () => {
        printResult.mockRejectedValue(new Error('Printer plugin unavailable'));
        await act(async () => { exportDataAsPDF(); });
        expect(printed).toHaveLength(1);
        expect(uiState.pdfExportView).toBeNull();
        expect(uiState.pdfExportOriginalTitle).toBeNull();
        expect(viewState.documentTitle).toBeNull();
        expect(tableRows()).toBe(0);
        expect(toastModule.showToast).toHaveBeenCalledWith('❌ Export PDF បរាជ័យ!');
    });

    it('bridge សម្អាតតាម PRINT_RETURNED_EVENT មុនបដិសេធ ➜ សារបរាជ័យនៅតែបង្ហាញ', async () => {
        printResult.mockImplementation(() => Promise.resolve().then(() => {
            window.dispatchEvent(new Event(PRINT_RETURNED_EVENT));
            throw new Error('Native printer failed');
        }));
        await act(async () => { exportDataAsPDF(); });
        expect(uiState.pdfExportView).toBeNull();
        expect(viewState.documentTitle).toBeNull();
        expect(toastModule.showToast).toHaveBeenCalledExactlyOnceWith('❌ Export PDF បរាជ័យ!');
    });

    it('លទ្ធផលបរាជ័យមកក្រោយ logout (គ្មានការងារថ្មី) ➜ មិនបង្ហាញសារក្នុងសម័យថ្មី', async () => {
        let rejectOld: (e: Error) => void = () => {};
        printResult.mockImplementationOnce(() => new Promise<void>((_resolve, reject) => { rejectOld = reject; }));
        step(() => exportDataAsPDF());
        expect(tableRows()).toBe(4);
        step(() => restoreAfterPdfExport());
        vi.mocked(toastModule.showToast).mockClear();
        await act(async () => { rejectOld(new Error('Old print failed')); });
        expect(toastModule.showToast).not.toHaveBeenCalled();
        expect(uiState.pdfExportView).toBeNull();
    });

    it('លទ្ធផលបរាជ័យចាស់មកក្រោយ logout ឬការបោះពុម្ពថ្មី ➜ មិនសម្អាតការងារថ្មី និងមិនបង្ហាញសារចាស់', async () => {
        let rejectOld: (e: Error) => void = () => {};
        printResult.mockImplementationOnce(() => new Promise<void>((_resolve, reject) => { rejectOld = reject; }));
        step(() => exportDataAsPDF());
        const oldView = uiState.pdfExportView;
        expect(tableRows()).toBe(4);
        step(() => { restoreAfterPdfExport(); exportDataAsPDF(); });
        const newView = uiState.pdfExportView;
        const newTitle = viewState.documentTitle;
        expect(newView).not.toBe(oldView);
        vi.mocked(toastModule.showToast).mockClear();
        await act(async () => { rejectOld(new Error('Old print failed')); });
        expect(uiState.pdfExportView).toBe(newView);
        expect(viewState.documentTitle).toBe(newTitle);
        expect(tableRows()).toBe(4);
        expect(toastModule.showToast).not.toHaveBeenCalled();
    });
});
