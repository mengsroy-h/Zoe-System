/**
 * ⛔ សំណើម្ចាស់គម្រោង ៖ «បន្ថែមមុខងារ print លេខទូរស័ព្ទនិង barcode ថ្ងៃទី/ខែ ឧ. (15/10) តែលេខទូរស័ព្ទសុំដាក់ធំៗងាយស្រួលមើល ដើម្បីយកទៅបិទជាប់កញ្ចប់អីវ៉ាន់»។
 * ⛔ ច្បាប់ ៖ ស្លាកមួយក្នុងមួយ Barcode (`buildLabelRows`) ៖ លេខទូរស័ព្ទ (គ្មានលេខ ➜ «—») · Code 128 (SVG ពី `code128Bars`) · លេខ Barcode · ថ្ងៃ/ខែ ពី `scanDate`
 *    (`labelDateOf('2026-10-15')` = «15/10») · Locker (N/A ➜ គ្មាន) · ធាតុចាស់គ្មាន `barcodes` ➜ ស្លាកមួយ។ ផ្លូវបោះពុម្ព = `pdfExportView` `{ kind: 'labels' }`
 *    ➜ `#pdfExportPrintArea` (`LabelSheet`) ➜ `beginPdfPrint()` (print dialog · APK printer) · ទំព័រទទេ ➜ toast តាម `emptyViewMessage` · គ្មាន print ·
 *    ម៉ឺនុយ (...) ខាងលើ «🖨️ បោះពុម្ពស្លាក (តម្រង)» · ម៉ឺនុយតាមជួរ «🖨️ បោះពុម្ពស្លាក» · CSS `.label-phone` ធំ (≥ 24pt)។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const { printed } = vi.hoisted(() => ({ printed: [] as string[] }));
vi.mock('../src/platform/file-output', async (importOriginal) => ({ ...(await importOriginal<Record<string, unknown>>()), printCurrentView: (name: string) => { printed.push(name); } }));
import * as toastModule from '../src/ui/toast';
const toasts: string[] = [];

import { dataState, uiState } from '../src/core/state';
import { DB_LISTENER_KEY_HISTORY, dbListenerFailedPaths, dbListenerPendingPaths, VIEW_NOT_MEASURABLE_NOTICE } from '../src/core/text';
import { restoreAfterPdfExport } from '../src/features/export';
import { buildLabelRows, labelDateOf, labelMoneyText, printLabelsForFilter, printLabelsForItem } from '../src/features/label-print';
import { ACTION_NAMES } from '../src/core/action-registry';
import { PdfExportPrintArea } from '../src/app/components/PdfExportPrintArea';
import { mount, step, unmount } from './native/react-harness';

const item = (id: string, phone: string, scanDate: string, codes: Array<{ code: string; locker?: string; cod?: number; dod?: number }>) =>
    ({ id, phone, scanDate, locker: 'N/A', barcodes: codes.map((c) => ({ code: c.code, locker: c.locker || 'N/A', cod: c.cod || 0, dod: c.dod || 0, isClosed: false })) });

beforeEach(() => {
    printed.length = 0;
    toasts.length = 0;
    vi.spyOn(toastModule, 'showToast').mockImplementation((t: any) => { toasts.push(String(t)); });
    dbListenerPendingPaths.clear();
    dbListenerFailedPaths.clear();
    uiState.currentFilterMode = 'all';
    uiState.customFilterDate = '';
    uiState.pdfExportView = null;
    dataState.scanHistory = [
        item('I1', '093385837', '2026-10-15', [{ code: '77105373308751', locker: 'A1', cod: 6.93 }, { code: '77105374841', dod: 2.5, cod: 1 }]),
        item('I2', 'គ្មានលេខ', '2026-10-14', [{ code: 'NOPHONE1' }]),
        { id: 'I3', phone: '0961234567', scanDate: '2026-10-09', barcode: 'LEGACY1', locker: 'B2', cod: '3.5', dod: -1 } as any
    ];
});

afterEach(() => {
    vi.restoreAllMocks();
    unmount();
    restoreAfterPdfExport();
    window.removeEventListener('afterprint', restoreAfterPdfExport);
    dataState.scanHistory = [];
});

describe('ស្លាកកញ្ចប់ ៖ ទិន្នន័យ', () => {
    it('labelDateOf ៖ 2026-10-15 ➜ 15/10 · មិនមែនកាលបរិច្ឆេទ ➜ «»', () => {
        expect(labelDateOf('2026-10-15')).toBe('15/10');
        expect(labelDateOf('2026-01-05')).toBe('05/01');
        expect(labelDateOf('')).toBe('');
        expect(labelDateOf(undefined)).toBe('');
        expect(labelMoneyText({ cod: 6.93, dod: 0 })).toBe('COD $6.93');
        expect(labelMoneyText({ cod: 0, dod: 0 })).toBe('');
    });

    it('⛔ buildLabelRows ៖ ស្លាកមួយក្នុងមួយ Barcode · គ្មានលេខ ➜ — · Locker N/A ➜ «» · ធាតុចាស់គ្មាន barcodes ➜ ១', () => {
        const rows = buildLabelRows(dataState.scanHistory);
        expect(rows).toEqual([
            { phone: '093385837', barcode: '77105373308751', date: '15/10', locker: 'A1', cod: 6.93, dod: 0 },
            { phone: '093385837', barcode: '77105374841', date: '15/10', locker: '', cod: 1, dod: 2.5 },
            { phone: '—', barcode: 'NOPHONE1', date: '14/10', locker: '', cod: 0, dod: 0 },
            { phone: '0961234567', barcode: 'LEGACY1', date: '09/10', locker: 'B2', cod: 3.5, dod: 0 }
        ]);
        expect(buildLabelRows(null)).toEqual([]);
        expect(buildLabelRows([null, {}, { barcodes: [{ code: '' }] }])).toEqual([]);
    });
});

describe('ស្លាកកញ្ចប់ ៖ បោះពុម្ព', () => {
    it('⛔ printLabelsForFilter ➜ pdfExportView.kind = labels (តាមតម្រង) ➜ beginPdfPrint ➜ print · #pdfExportPrintArea គូរស្លាក ៖ លេខធំ · SVG · Barcode · ថ្ងៃ/ខែ', () => {
        mount(<PdfExportPrintArea />);
        step(() => { expect(printLabelsForFilter()).toBe(true); });
        expect(printed[0]).toMatch(/^ZoeW_all_[\d-]+_labels$/);
        const view = uiState.pdfExportView;
        expect(view && view.kind).toBe('labels');
        expect(view.labels.length).toBe(4);
        const area = document.getElementById('pdfExportPrintArea')!;
        const labels = area.querySelectorAll('.label');
        expect(labels.length).toBe(4);
        expect(labels[0].querySelector('.label-phone')!.textContent).toBe('093385837');
        expect(labels[0].querySelector('.label-bc svg rect')).toBeTruthy();
        expect(labels[0].querySelector('.label-code')!.textContent).toBe('77105373308751');
        expect(labels[0].querySelector('.label-date')!.textContent).toBe('15/10');
        expect(labels[0].querySelector('.label-locker')!.textContent).toBe('A1');
        expect(labels[0].querySelector('.label-money')!.textContent).toBe('COD $6.93');
        expect(labels[1].querySelector('.label-money')!.textContent).toBe('COD $1.00 · DOD $2.50');
        expect(labels[1].querySelector('.label-locker')).toBeNull();
        expect(labels[2].querySelector('.label-money')).toBeNull();
        expect(labels[2].querySelector('.label-phone')!.textContent).toBe('—');
        step(() => window.dispatchEvent(new Event('afterprint')));
        expect(uiState.pdfExportView).toBeNull();
        expect(area.querySelectorAll('.label').length).toBe(0);
    });

    it('printLabelsForItem ៖ តែធាតុនោះ · id មិនស្គាល់ ➜ toast · គ្មាន print', () => {
        expect(printLabelsForItem('I1')).toBe(true);
        expect(uiState.pdfExportView.labels.map((l: any) => l.barcode)).toEqual(['77105373308751', '77105374841']);
        expect(printed.length).toBe(1);
        restoreAfterPdfExport();
        expect(printLabelsForItem('nope')).toBe(false);
        expect(printed.length).toBe(1);
        expect(toasts[toasts.length - 1]).toContain('គ្មានកញ្ចប់');
    });

    it('តម្រងថ្ងៃគ្មានកញ្ចប់ ➜ toast · view stale ➜ សារប្រាប់ថាវាស់មិនបាន · គ្មាន print', () => {
        uiState.currentFilterMode = 'custom';
        uiState.customFilterDate = '2020-01-01';
        expect(printLabelsForFilter()).toBe(false);
        expect(printed.length).toBe(0);
        expect(toasts[toasts.length - 1]).toContain('គ្មានកញ្ចប់');
        dbListenerPendingPaths.add(DB_LISTENER_KEY_HISTORY);
        expect(printLabelsForFilter()).toBe(false);
        expect(toasts[toasts.length - 1]).toBe(VIEW_NOT_MEASURABLE_NOTICE);
        expect(printed.length).toBe(0);
    });

    it('⛔ ខ្សែភ្ជាប់ ៖ ម៉ឺនុយ (...) ខាងលើ និងតាមជួរមាន «🖨️ បោះពុម្ពស្លាក» · សកម្មភាពចុះបញ្ជី · CSS .label-phone ≥ 24pt · AppShell គូរ PdfExportPrintArea', () => {
        const root = path.join(__dirname, '..', 'src');
        const menu = readFileSync(path.join(root, 'ui', 'more-menu.ts'), 'utf8');
        expect(menu).toMatch(/label: '🖨️ បោះពុម្ពស្លាក \(' \+ getCurrentFilterLabel\(\) \+ '\)', action: 'moreMenuPrintLabels'/);
        expect(menu).toMatch(/label: '🖨️ បោះពុម្ពស្លាក', action: 'moreMenuPrintItemLabels', args: \[id\]/);
        expect(ACTION_NAMES).toContain('moreMenuPrintLabels');
        expect(ACTION_NAMES).toContain('moreMenuPrintItemLabels');
        const css = readFileSync(path.join(root, 'styles', 'react-root.css'), 'utf8');
        const phone = /\.label-phone\s*\{([^}]*)\}/.exec(css);
        expect(phone).toBeTruthy();
        const pt = /font-size:\s*(\d+)pt/.exec(phone![1]);
        expect(pt && Number(pt[1]) >= 24).toBe(true);
        expect(/\.label\s*\{[^}]*break-inside:\s*avoid/.test(css)).toBe(true);
        expect(readFileSync(path.join(root, 'app', 'components', 'AppShell.tsx'), 'utf8')).toMatch(/<PdfExportPrintArea \/>/);
    });
});
