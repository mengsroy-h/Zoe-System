/**
 * ⛔ សំណើម្ចាស់គម្រោង ៖ «print លេខទូរស័ព្ទនិង barcode ថ្ងៃទី/ខែ ឧ. (15/10) តែលេខទូរស័ព្ទសុំដាក់ធំៗ … យកទៅបិទជាប់កញ្ចប់អីវ៉ាន់» · «ដាក់តម្លៃផងជា $» ·
 *    «បន្ថែម modal print … Screenshot អោយខ្ញុំមើលផង»។ លើបុងពិត ម្ចាស់គម្រោងសរសេរដោយដៃ ៖ ថ្ងៃ/ខែ · លេខទូរស័ព្ទ · COD ជាដុល្លារ។
 * ⛔ ច្បាប់ ៖ ស្លាកមួយក្នុងមួយ Barcode (`buildLabelRows`) ៖ លេខទូរស័ព្ទ (គ្មានលេខ ➜ «—») · Code 128 (SVG ពី `code128Bars`) · លេខ Barcode · «COD $x · DOD $y» (តែ > 0) ·
 *    ថ្ងៃ/ខែ ពី `scanDate` · Locker (N/A ➜ គ្មាន) · ធាតុចាស់គ្មាន `barcodes` ➜ ១ · `openOnly` ➜ រំលង Barcode `isClosed`។ ម៉ឺនុយ (...) ➜ `openLabelPrintModal(scope)` ➜
 *    `labelPrintModal` (ប្លង់ `a4-3`/`a4-2`/`single` · កុងតាក់ តម្លៃ/ថ្ងៃ/Locker/តែមិនទាន់យក · រក្សាទុកក្នុង `zoew_label_print_v1` · preview ≤ `LABEL_PREVIEW_MAX`) ➜
 *    «🖨️ បោះពុម្ព» ➜ `pdfExportView { kind: 'labels', options }` ➜ `#pdfExportPrintArea` ➜ `beginPdfPrint()` · ទទេ ➜ toast តាម `emptyViewMessage` · logout ➜ `resetLabelPrint()`។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const { printed } = vi.hoisted(() => ({ printed: [] as string[] }));
vi.mock('../src/platform/file-output', async (importOriginal) => ({ ...(await importOriginal<Record<string, unknown>>()), printCurrentView: (name: string) => { printed.push(name); } }));
import * as toastModule from '../src/ui/toast';
const toasts: string[] = [];

import { dataState, uiState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import { DB_LISTENER_KEY_HISTORY, dbListenerFailedPaths, dbListenerPendingPaths, VIEW_NOT_MEASURABLE_NOTICE } from '../src/core/text';
import { LABEL_PRINT_OPTIONS_KEY } from '../src/core/storage-keys';
import { MODAL_IDS, modalIsOpen } from '../src/core/modals';
import { armPdfExportRestore, restoreAfterPdfExport } from '../src/features/export';
import { buildLabelRows, DEFAULT_LABEL_OPTIONS, LABEL_LAYOUTS, LABEL_PREVIEW_MAX, labelDateOf, labelMoneyText, loadLabelOptions, openLabelPrintModal, printLabelsFromModal, resetLabelPrint, updateLabelPrintPreview } from '../src/features/label-print';
import { ACTION_NAMES } from '../src/core/action-registry';
import { moreMenuPrintItemLabels, moreMenuPrintLabels } from '../src/ui/more-menu';
import { closeModal } from '../src/ui/modal';
import { PdfExportPrintArea } from '../src/app/components/PdfExportPrintArea';
import { LabelPrintModal } from '../src/app/components/modals/LabelPrintModal';
import { mount, step, unmount } from './native/react-harness';

const item = (id: string, phone: string, scanDate: string, codes: Array<{ code: string; locker?: string; cod?: number; dod?: number; isClosed?: boolean }>) =>
    ({ id, phone, scanDate, locker: 'N/A', barcodes: codes.map((c) => ({ code: c.code, locker: c.locker || 'N/A', cod: c.cod || 0, dod: c.dod || 0, isClosed: !!c.isClosed })) });

const field = (id: string) => document.getElementById(id) as HTMLInputElement;
const labelsIn = (sel: string) => document.querySelectorAll(sel + ' .label');

beforeEach(() => {
    printed.length = 0;
    toasts.length = 0;
    vi.spyOn(toastModule, 'showToast').mockImplementation((t: any) => { toasts.push(String(t)); return 0; });
    try { localStorage.removeItem(LABEL_PRINT_OPTIONS_KEY); } catch {}
    dbListenerPendingPaths.clear();
    dbListenerFailedPaths.clear();
    uiState.currentFilterMode = 'all';
    uiState.customFilterDate = '';
    uiState.pdfExportView = null;
    uiState.isModalOpen = false;
    uiState.modalDisplay = {};
    uiState.modalStack = [];
    dataState.scanHistory = [
        item('I1', '0960001234', '2026-10-15', [{ code: '77100000308751', locker: 'A1', cod: 6.93 }, { code: '77100000841', dod: 2.5, cod: 1, isClosed: true }]),
        item('I2', 'គ្មានលេខ', '2026-10-14', [{ code: 'NOPHONE1' }]),
        { id: 'I3', phone: '0961234567', scanDate: '2026-10-09', barcode: 'LEGACY1', locker: 'B2', cod: '3.5', dod: -1 } as any
    ];
    mount(<><LabelPrintModal /><PdfExportPrintArea /></>);
});

afterEach(() => {
    step(() => { closeModal('labelPrintModal'); resetLabelPrint(); restoreAfterPdfExport(); });
    window.removeEventListener('afterprint', armPdfExportRestore);
    vi.restoreAllMocks();
    unmount();
    dataState.scanHistory = [];
});

describe('ស្លាកកញ្ចប់ ៖ ទិន្នន័យ', () => {
    it('labelDateOf · labelMoneyText', () => {
        expect(labelDateOf('2026-10-15')).toBe('15/10');
        expect(labelDateOf('2026-01-05')).toBe('05/01');
        expect(labelDateOf('')).toBe('');
        expect(labelDateOf(undefined)).toBe('');
        expect(labelMoneyText({ cod: 6.93, dod: 0 })).toBe('COD $6.93');
        expect(labelMoneyText({ cod: 1, dod: 2.5 })).toBe('COD $1.00 · DOD $2.50');
        expect(labelMoneyText({ cod: 0, dod: 0 })).toBe('');
    });

    it('⛔ buildLabelRows ៖ ស្លាកមួយក្នុងមួយ Barcode · — · Locker N/A ➜ «» · ធាតុចាស់ ➜ ១ · openOnly ➜ រំលង isClosed', () => {
        expect(buildLabelRows(dataState.scanHistory)).toEqual([
            { phone: '0960001234', barcode: '77100000308751', date: '15/10', locker: 'A1', cod: 6.93, dod: 0 },
            { phone: '0960001234', barcode: '77100000841', date: '15/10', locker: '', cod: 1, dod: 2.5 },
            { phone: '—', barcode: 'NOPHONE1', date: '14/10', locker: '', cod: 0, dod: 0 },
            { phone: '0961234567', barcode: 'LEGACY1', date: '09/10', locker: 'B2', cod: 3.5, dod: 0 }
        ]);
        expect(buildLabelRows(dataState.scanHistory, { openOnly: true }).map((r) => r.barcode)).toEqual(['77100000308751', 'NOPHONE1', 'LEGACY1']);
        expect(buildLabelRows(null)).toEqual([]);
        expect(buildLabelRows([null, {}, { barcodes: [{ code: '' }] }])).toEqual([]);
    });

    it('ជម្រើស ៖ លំនាំដើម · រក្សាទុក/ផ្ទុកពី localStorage · តម្លៃខូច ➜ លំនាំដើម', () => {
        expect(loadLabelOptions()).toEqual(DEFAULT_LABEL_OPTIONS);
        localStorage.setItem(LABEL_PRINT_OPTIONS_KEY, JSON.stringify({ layout: '50x30', money: false, date: 'x', openOnly: false }));
        expect(loadLabelOptions()).toEqual({ layout: '50x30', money: false, locker: true, date: true, openOnly: false });
        localStorage.setItem(LABEL_PRINT_OPTIONS_KEY, JSON.stringify({ layout: 'nope' }));
        expect(loadLabelOptions().layout).toBe('50x30');
        localStorage.setItem(LABEL_PRINT_OPTIONS_KEY, '{bad');
        expect(loadLabelOptions()).toEqual(DEFAULT_LABEL_OPTIONS);
    });
});

describe('ស្លាកកញ្ចប់ ៖ modal ➜ preview ➜ បោះពុម្ព', () => {
    it('⛔ ម៉ឺនុយ (...) ខាងលើ ➜ modal បើក · វិសាលភាពតម្រង · ជម្រើសលំនាំដើមចូលវាល · preview ៣ ស្លាក (openOnly) · សង្ខេប', () => {
        step(() => moreMenuPrintLabels());
        expect(modalIsOpen('labelPrintModal')).toBe(true);
        expect(viewState.labelPrintTitle).toContain('ទាំងអស់');
        expect(field('labelLayoutSelect').value).toBe('50x30');
        expect(field('labelShowMoney').checked).toBe(true);
        expect(field('labelOpenOnly').checked).toBe(true);
        expect(labelsIn('#labelPrintPreview').length).toBe(3);
        expect(viewState.labelPrintSummary).toContain('ស្លាក 3');
        expect(viewState.labelPrintSummary).toContain('អតិថិជន 3');
        const first = labelsIn('#labelPrintPreview')[0];
        expect(first.querySelector('.label-phone')!.textContent).toBe('0960001234');
        expect(first.querySelector('.label-bc svg rect')).toBeTruthy();
        expect(first.querySelector('.label-code')!.textContent).toBe('77100000308751');
        expect(first.querySelector('.label-money')!.textContent).toBe('COD $6.93');
        expect(first.querySelector('.label-date')!.textContent).toBe('15/10');
        expect(first.querySelector('.label-locker')!.textContent).toBe('A1');
        expect(document.querySelector('#labelPrintPreview .label-sheet')!.className).toBe('label-sheet layout-50x30');
    });

    it('⛔ ប្តូរជម្រើស ➜ preview ប្រែ (ប្លង់ · បិទតម្លៃ/ថ្ងៃ/Locker · openOnly បិទ ➜ ៤) · រក្សាទុកក្នុង localStorage', () => {
        step(() => openLabelPrintModal({ kind: 'filter' }));
        step(() => {
            field('labelLayoutSelect').value = 'a4-2';
            expect((field('labelLayoutSelect') as unknown as HTMLSelectElement).options.length).toBe(6);
            field('labelShowMoney').checked = false;
            field('labelShowDate').checked = false;
            field('labelShowLocker').checked = false;
            field('labelOpenOnly').checked = false;
            updateLabelPrintPreview();
        });
        expect(labelsIn('#labelPrintPreview').length).toBe(4);
        expect(document.querySelector('#labelPrintPreview .label-sheet')!.className).toBe('label-sheet layout-a4-2');
        expect(document.querySelector('#labelPrintPreview .label-money')).toBeNull();
        expect(document.querySelector('#labelPrintPreview .label-meta')).toBeNull();
        expect(JSON.parse(localStorage.getItem(LABEL_PRINT_OPTIONS_KEY)!)).toEqual({ layout: 'a4-2', money: false, locker: false, date: false, openOnly: false });
        step(() => { closeModal('labelPrintModal'); });
        step(() => openLabelPrintModal({ kind: 'filter' }));
        expect(field('labelLayoutSelect').value).toBe('a4-2');
        expect(field('labelOpenOnly').checked).toBe(false);
    });

    it('⛔ «បោះពុម្ព» ➜ modal បិទ · pdfExportView { kind: labels, options } · #pdfExportPrintArea គូរគ្រប់ស្លាក · print · afterprint ➜ នៅ (ប្តូរក្រដាស) · ប៉ះ App វិញ ➜ សម្អាត', () => {
        step(() => openLabelPrintModal({ kind: 'filter' }));
        step(() => { expect(printLabelsFromModal()).toBe(true); });
        expect(modalIsOpen('labelPrintModal')).toBe(false);
        expect(printed[0]).toMatch(/^ZoeW_all_[\d-]+_labels$/);
        const view = uiState.pdfExportView;
        expect(view.kind).toBe('labels');
        expect(view.options).toEqual(DEFAULT_LABEL_OPTIONS);
        expect(view.labels.length).toBe(3);
        const labels = labelsIn('#pdfExportPrintArea');
        expect(labels.length).toBe(3);
        expect(labels[1].querySelector('.label-phone')!.textContent).toBe('—');
        expect(labels[1].querySelector('.label-money')).toBeNull();
        step(() => window.dispatchEvent(new Event('afterprint')));
        expect(labelsIn('#pdfExportPrintArea').length).toBe(3);
        step(() => document.dispatchEvent(new Event('pointerdown', { bubbles: true })));
        expect(uiState.pdfExportView).toBeNull();
        expect(labelsIn('#pdfExportPrintArea').length).toBe(0);
    });

    it('ម៉ឺនុយតាមជួរ ➜ តែអតិថិជននោះ · preview ≤ LABEL_PREVIEW_MAX ខណៈបោះពុម្ពទាំងអស់ · id មិនស្គាល់ ➜ toast គ្មាន modal', () => {
        step(() => moreMenuPrintItemLabels('I1'));
        expect(viewState.labelPrintTitle).toBe('អតិថិជន 0960001234');
        expect(labelsIn('#labelPrintPreview').length).toBe(1);
        step(() => { field('labelOpenOnly').checked = false; updateLabelPrintPreview(); });
        expect(labelsIn('#labelPrintPreview').length).toBe(2);
        step(() => { printLabelsFromModal(); });
        expect(uiState.pdfExportView.labels.map((l: any) => l.barcode)).toEqual(['77100000308751', '77100000841']);
        expect(printed[0]).toBe('ZoeW_label_I1');
        step(() => restoreAfterPdfExport());
        dataState.scanHistory = Array.from({ length: 10 }, (_, i) => item('M' + i, '09600000' + i, '2026-10-15', [{ code: 'MANY' + i }]));
        step(() => openLabelPrintModal({ kind: 'filter' }));
        expect(labelsIn('#labelPrintPreview').length).toBe(LABEL_PREVIEW_MAX);
        expect(viewState.labelPrintSummary).toContain('ស្លាក 10');
        step(() => { printLabelsFromModal(); });
        expect(uiState.pdfExportView.labels.length).toBe(10);
        step(() => restoreAfterPdfExport());
        expect(openLabelPrintModal({ kind: 'item', id: 'nope' })).toBe(false);
        expect(modalIsOpen('labelPrintModal')).toBe(false);
        expect(toasts[toasts.length - 1]).toContain('គ្មានកញ្ចប់');
    });

    it('តម្រងទទេ ➜ toast គ្មាន modal · view stale ➜ សារវាស់មិនបាន · ក្នុង modal openOnly ទាំងអស់យករួច ➜ សង្ខេបណែនាំ · ប៊ូតុងបិទ · logout ➜ resetLabelPrint', () => {
        uiState.currentFilterMode = 'custom';
        uiState.customFilterDate = '2020-01-01';
        expect(openLabelPrintModal({ kind: 'filter' })).toBe(false);
        expect(printed.length).toBe(0);
        expect(toasts[toasts.length - 1]).toContain('គ្មានកញ្ចប់');
        dbListenerPendingPaths.add(DB_LISTENER_KEY_HISTORY);
        expect(openLabelPrintModal({ kind: 'filter' })).toBe(false);
        expect(toasts[toasts.length - 1]).toBe(VIEW_NOT_MEASURABLE_NOTICE);
        dbListenerPendingPaths.clear();
        uiState.currentFilterMode = 'all';
        dataState.scanHistory = [item('C1', '0961111111', '2026-10-15', [{ code: 'CLOSED1', isClosed: true }])];
        step(() => openLabelPrintModal({ kind: 'filter' }));
        expect(modalIsOpen('labelPrintModal')).toBe(true);
        expect(labelsIn('#labelPrintPreview').length).toBe(0);
        expect(viewState.labelPrintSummary).toContain('បង្ហាញតែកញ្ចប់មិនទាន់យក');
        expect((document.querySelector('#labelPrintModal .btn-confirm') as HTMLButtonElement).disabled).toBe(true);
        expect(printLabelsFromModal()).toBe(false);
        step(() => resetLabelPrint());
        expect(viewState.labelPrintPreview).toBeNull();
        expect(viewState.labelPrintTitle).toBe('');
    });

    it('⛔ ខ្សែភ្ជាប់ ៖ MODAL_IDS · AppShell · សកម្មភាព · ម៉ឺនុយ · logout · CSS (.label-phone ≥ 24pt · break-inside · layout-single break-after · ស្លាកនៅក្រោម .label-sheet តែប៉ុណ្ណោះ · ក្រដាសតាមផ្ទាំងបោះពុម្ព ៖ គ្មានទំហំបង្ខំ · ក្រដាសស្លាក ➜ ១/ទំព័រ)', () => {
        const root = path.join(__dirname, '..', 'src');
        expect(MODAL_IDS).toContain('labelPrintModal');
        expect(readFileSync(path.join(root, 'app', 'components', 'AppShell.tsx'), 'utf8')).toMatch(/<LabelPrintModal \/>/);
        ['moreMenuPrintLabels', 'moreMenuPrintItemLabels', 'updateLabelPrintPreview', 'printLabelsFromModal', 'saveLabelImagesFromModal'].forEach((a) => expect(ACTION_NAMES).toContain(a));
        const menu = readFileSync(path.join(root, 'ui', 'more-menu.ts'), 'utf8');
        expect(menu).toMatch(/label: '🖨️ បោះពុម្ពស្លាក \(' \+ getCurrentFilterLabel\(\) \+ '\)', action: 'moreMenuPrintLabels'/);
        expect(menu).toMatch(/label: '🖨️ បោះពុម្ពស្លាក', action: 'moreMenuPrintItemLabels', args: \[id\]/);
        expect(readFileSync(path.join(root, 'features', 'session.ts'), 'utf8')).toMatch(/resetLabelPrint\(\);/);
        const css = readFileSync(path.join(root, 'styles', 'react-root.css'), 'utf8');
        const pt = /\n\.label-sheet\s*\{[^}]*--label-phone-max:\s*(\d+)pt/.exec(css);
        expect(pt && Number(pt[1]) >= 24).toBe(true);
        expect(/\.label-sheet \.label-phone\s*\{[^}]*font-size:\s*min\(var\(--label-phone-max\)/.test(css)).toBe(true);
        expect(/\.label-sheet \.label\s*\{[^}]*break-inside:\s*avoid/.test(css)).toBe(true);
        expect(/(^|\n)\.label(-(phone|bc|code|meta|money|date|locker))?(?![\w-])/.test(css)).toBe(false);
        expect(/\.label-sheet\.layout-single \.label\s*\{[^}]*break-after:\s*page/.test(css)).toBe(true);
        expect(/@page\s+zoeLabel|size:\s*\d+mm \d+mm/.test(css)).toBe(false);
        const roll = /@media print and \(max-width: 75mm\), print and \(max-height: 50mm\) \{([\s\S]*?)\n\}/.exec(css);
        expect(!!roll && /@page \{ margin: 1\.5mm; \}/.test(roll[1]) && /#pdfExportPrintArea \.label-sheet \.label \{[^}]*break-after: page/.test(roll[1])).toBe(true);
        expect(/@media print and \(min-width: 75\.1mm\) and \(min-height: 50\.1mm\)/.test(css)).toBe(true);
        expect(/\.label-sheet\.layout-50x30 \.label\s*\{[^}]*width:\s*47mm[^}]*height:\s*27mm/.test(css)).toBe(true);
        expect(LABEL_LAYOUTS).toEqual(['50x30', '40x30', '60x40', 'single', 'a4-3', 'a4-2']);
        expect(DEFAULT_LABEL_OPTIONS.layout).toBe('50x30');
        expect(readFileSync(path.join(root, 'app', 'components', 'modals', 'LabelPrintModal.tsx'), 'utf8')).toMatch(/<option value="50x30">/);
        expect(/\.label-print-modal-content\s*\{[^}]*max-width:\s*clamp\(340px/.test(css)).toBe(true);
    });
});
