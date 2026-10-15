/**
 * ⛔ សំណើម្ចាស់គម្រោង ៖ NIIMBOT B1 (Bluetooth តាម App NIIMBOT · មិនមែនម៉ាស៊ីនបោះពុម្ពរបស់ប្រព័ន្ធ) ➜ «🖼️ រក្សាទុកជារូបភាព» ៖ ស្លាកនីមួយៗជា PNG
 *    ទំហំពិត (៨ ចំណុច/mm) ➜ Share (iPhone · Android · APK) ឬទាញយក (កុំព្យូទ័រ)។ ការគូរពិត (ZXing អានវិញ) វាស់ក្នុង `layout-check` (browser ពិត) ·
 *    នៅទីនេះ ៖ ខ្លឹមសារដែលគូរតាមជម្រើស (លុយ · ថ្ងៃ · Locker) · ឈ្មោះឯកសារ · ផ្លូវ Share / បោះបង់ / ទាញយក · ពិដាន LABEL_IMAGE_MAX · គ្មាន canvas ➜ សារ។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ texts: [] as string[], rects: 0, downloads: [] as string[], canvas: true }));
vi.mock('../src/platform/document-io', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    downloadObjectUrl: (_url: string, name: string) => { h.downloads.push(name); },
    createScratchCanvas: () => {
        const canvas: any = { width: 0, height: 0 };
        canvas.getContext = () => (h.canvas ? {
            set font(_v: string) {}, fillStyle: '', textAlign: '', textBaseline: '',
            fillRect: () => { h.rects++; },
            fillText: (t: string) => { h.texts.push(t); },
            measureText: (t: string) => ({ width: t.length * 50 }),
            getImageData: (_x: number, _y: number, w: number, hh: number) => ({ data: new Uint8ClampedArray(w * hh * 4) }),
            putImageData: () => {}
        } : null);
        canvas.toDataURL = () => 'data:image/png;base64,iVBORw0KGgo=';
        return canvas;
    }
}));
import * as toastModule from '../src/ui/toast';
import { dataState, uiState } from '../src/core/state';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { LABEL_PRINT_OPTIONS_KEY } from '../src/core/storage-keys';
import { LABEL_IMAGE_MAX, buildLabelRows, labelImageFiles, normalizeLabelOptions, openLabelPrintModal, resetLabelPrint, saveLabelImagesFromModal } from '../src/features/label-print';
import { labelImageSizeMm } from '../src/features/label-image';
import { code128Bars } from '../src/features/zto-status';
import { shareImageFiles } from '../src/platform/file-output';
import { closeModal } from '../src/ui/modal';
import { LabelPrintModal } from '../src/app/components/modals/LabelPrintModal';
import { mount, step, unmount } from './native/react-harness';

const toasts: string[] = [];
const items = [
    { id: 'I1', phone: '0960001234', scanDate: '2026-10-15', locker: 'A1', barcodes: [{ code: '77100000308751', cod: 6.93, dod: 1, locker: 'B7' }, { code: '77100000841', cod: 0, dod: 0, locker: 'N/A' }] },
    { id: 'I2', phone: 'គ្មានលេខ', scanDate: '2026-10-09', locker: 'N/A', barcodes: [{ code: 'ZT-88/01', cod: 2.5, dod: 0 }] }
];
let shared: any[];

const UA = {
    iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1',
    android: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
    windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0',
    mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
    ipad: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15'
};
const realUA = window.navigator.userAgent;
function setDevice(ua: string, touchPoints = 0) {
    Object.defineProperty(window.navigator, 'userAgent', { configurable: true, value: ua });
    Object.defineProperty(window.navigator, 'maxTouchPoints', { configurable: true, value: touchPoints });
}

function stubShare(canShare: boolean, reject?: any) {
    shared = [];
    Object.defineProperty(window.navigator, 'canShare', { configurable: true, value: canShare ? () => true : undefined });
    Object.defineProperty(window.navigator, 'share', { configurable: true, value: canShare ? (d: any) => { shared.push(d); return reject ? Promise.reject(reject) : Promise.resolve(); } : undefined });
}

beforeEach(() => {
    h.texts = []; h.rects = 0; h.downloads = []; h.canvas = true;
    toasts.length = 0;
    vi.spyOn(toastModule, 'showToast').mockImplementation((t: any) => { toasts.push(String(t)); return 0; });
    try { localStorage.removeItem(LABEL_PRINT_OPTIONS_KEY); } catch {}
    dbListenerPendingPaths.clear();
    dbListenerFailedPaths.clear();
    uiState.currentFilterMode = 'all';
    uiState.isModalOpen = false;
    uiState.modalDisplay = {};
    uiState.modalStack = [];
    dataState.scanHistory = items as any;
    (globalThis as any).URL.createObjectURL = () => 'blob:x';
    (globalThis as any).URL.revokeObjectURL = () => {};
    mount(<LabelPrintModal />);
});

afterEach(() => {
    setDevice(realUA, 0);
    step(() => { closeModal('labelPrintModal'); resetLabelPrint(); });
    vi.restoreAllMocks();
    unmount();
    dataState.scanHistory = [];
});

describe('ស្លាកជារូបភាព (NIIMBOT)', () => {
    it('⛔ ទំហំ ៖ ស្លាក 50×30 · 40×30 · 60×40 ➜ ទំហំនោះ · ប្លង់ផ្សេង ➜ 50×30', () => {
        expect(labelImageSizeMm('50x30')).toEqual([50, 30]);
        expect(labelImageSizeMm('40x30')).toEqual([40, 30]);
        expect(labelImageSizeMm('60x40')).toEqual([60, 40]);
        expect(labelImageSizeMm('a4-3')).toEqual([50, 30]);
        expect(labelImageSizeMm('nope')).toEqual([50, 30]);
    });

    it('⛔ ខ្លឹមសារតាមជម្រើស ៖ លេខទូរស័ព្ទ · Barcode (បន្ទាត់ code128Bars) · លេខ · លុយ · ថ្ងៃ/Locker · បិទលុយ/ថ្ងៃ/Locker ➜ មិនគូរ · ឈ្មោះ ZoeW_label_<លេខ>.png', () => {
        const options = normalizeLabelOptions({ layout: '50x30', openOnly: false });
        const rows = buildLabelRows(items, options);
        const files = labelImageFiles(rows, options);
        expect(files.map((f) => f.name)).toEqual(['ZoeW_label_77100000308751.png', 'ZoeW_label_77100000841.png', 'ZoeW_label_ZT8801.png']);
        expect(files.every((f) => f.dataUrl.startsWith('data:image/png;base64,'))).toBe(true);
        expect(h.texts).toContain('0960001234');
        expect(h.texts).toContain('77100000308751');
        expect(h.texts).toContain('COD $6.93 · DOD $1.00');
        expect(h.texts.some((t) => t.includes('15/10') && t.includes('B7'))).toBe(true);
        expect(h.texts).toContain('—');
        const bars = ['77100000308751', '77100000841', 'ZT-88/01'].reduce((n, c) => n + code128Bars(c)!.bars.length, 0);
        expect(h.rects).toBe(3 + bars);
        h.texts = [];
        labelImageFiles(rows.slice(0, 1), normalizeLabelOptions({ layout: '50x30', money: false, date: false, locker: false }));
        expect(h.texts).toEqual(['0960001234', '77100000308751']);
    });

    it('ឈ្មោះស្ទួន ➜ បន្ថែម _2 · _3 (Barcode ដែលសល់តែអក្សរដូចគ្នាក៏ដូច្នេះ) · គ្មាន canvas ➜ គ្មានឯកសារ', () => {
        const options = normalizeLabelOptions({ layout: '40x30' });
        const row = buildLabelRows(items, { openOnly: false })[0];
        expect(labelImageFiles([row, row, row], options).map((f) => f.name)).toEqual(['ZoeW_label_77100000308751.png', 'ZoeW_label_77100000308751_2.png', 'ZoeW_label_77100000308751_3.png']);
        const names = labelImageFiles([{ ...row, barcode: 'ZT-88' }, { ...row, barcode: 'ZT88' }, { ...row, barcode: 'ZT8_8' }], options).map((f) => f.name);
        expect(names).toEqual(['ZoeW_label_ZT88.png', 'ZoeW_label_ZT88_2.png', 'ZoeW_label_ZT88_3.png']);
        expect(new Set(names).size).toBe(names.length);
        h.canvas = false;
        expect(labelImageFiles([row], options)).toEqual([]);
    });

    it('⛔ Share ៖ navigator.share({ files: PNG }) ➜ shared · បោះបង់ (AbortError) ➜ cancelled · គ្មាន Web Share (កុំព្យូទ័រ) ➜ ទាញយកមួយៗ ➜ saved', async () => {
        const files = [{ name: 'a.png', dataUrl: 'data:image/png;base64,iVBORw0KGgo=' }, { name: 'b.png', dataUrl: 'data:image/png;base64,iVBORw0KGgo=' }];
        setDevice(UA.iphone, 5);
        stubShare(true);
        expect(await shareImageFiles(files, 'T')).toBe('shared');
        expect(shared[0].files.map((f: File) => [f.name, f.type])).toEqual([['a.png', 'image/png'], ['b.png', 'image/png']]);
        stubShare(true, Object.assign(new Error('x'), { name: 'AbortError' }));
        expect(await shareImageFiles(files, 'T')).toBe('cancelled');
        expect(h.downloads).toEqual([]);
        stubShare(true, Object.assign(new Error('boom'), { name: 'NotAllowedError' }));
        expect(await shareImageFiles(files, 'T')).toBe('saved');
        expect(h.downloads).toEqual(['a.png', 'b.png']);
        h.downloads = [];
        stubShare(false);
        expect(await shareImageFiles(files, 'T')).toBe('saved');
        expect(h.downloads).toEqual(['a.png', 'b.png']);
    });

    it('⛔ ប៊ូតុងក្នុងផ្ទាំង ➜ Share ១ ដង + សារ ✅ · បោះបង់ ➜ គ្មានសារ · ច្រើនជាង LABEL_IMAGE_MAX ➜ សារណែនាំ គ្មាន Share · គ្មាន canvas ➜ ❌', async () => {
        setDevice(UA.android, 5);
        step(() => openLabelPrintModal({ kind: 'filter' }));
        stubShare(true);
        expect(await saveLabelImagesFromModal()).toBe(true);
        expect(shared.length).toBe(1);
        expect(shared[0].files.length).toBe(3);
        expect(toasts[toasts.length - 1]).toMatch(/^✅ រូបភាពស្លាក 3/);
        toasts.length = 0;
        stubShare(true, Object.assign(new Error('x'), { name: 'AbortError' }));
        expect(await saveLabelImagesFromModal()).toBe(true);
        expect(toasts).toEqual([]);
        dataState.scanHistory = [{ id: 'M', phone: '096', scanDate: '2026-10-15', barcodes: Array.from({ length: LABEL_IMAGE_MAX + 1 }, (_, i) => ({ code: 'C' + i })) }] as any;
        stubShare(true);
        expect(await saveLabelImagesFromModal()).toBe(false);
        expect(shared.length).toBe(0);
        expect(toasts[toasts.length - 1]).toContain('ច្រើនពេក');
        dataState.scanHistory = items as any;
        h.canvas = false;
        expect(await saveLabelImagesFromModal()).toBe(false);
        expect(toasts[toasts.length - 1]).toContain('❌');
    });
    it('⛔ កុំព្យូទ័រ (Windows · Mac ៖ Chrome/Edge មាន Web Share) ➜ ទាញយក PNG តែម្តង ⛔ មិនបើកផ្ទាំង Share · ទិសផ្ទុយ iPad (UA Mac + touch) ➜ Share', async () => {
        const files = [{ name: 'a.png', dataUrl: 'data:image/png;base64,iVBORw0KGgo=' }, { name: 'b.png', dataUrl: 'data:image/png;base64,iVBORw0KGgo=' }];
        for (const ua of [UA.windows, UA.mac]) {
            setDevice(ua, 0);
            stubShare(true);
            h.downloads = [];
            expect(await shareImageFiles(files, 'T')).toBe('saved');
            expect(shared.length).toBe(0);
            expect(h.downloads).toEqual(['a.png', 'b.png']);
        }
        setDevice(UA.ipad, 5);
        stubShare(true);
        h.downloads = [];
        expect(await shareImageFiles(files, 'T')).toBe('shared');
        expect(shared.length).toBe(1);
        expect(h.downloads).toEqual([]);
    });

    it('⛔ ប៊ូតុងក្នុងផ្ទាំង ៖ កុំព្យូទ័រ ➜ «✅ បានទាញយក» (គ្មាន ❌) · ទូរស័ព្ទ Share បដិសេធ (NotAllowedError ៖ ឯកសារច្រើនពេក · ផុតសកម្មភាពអ្នកប្រើ) ➜ ទាញយកជំនួស ✅', async () => {
        step(() => openLabelPrintModal({ kind: 'filter' }));
        setDevice(UA.windows, 0);
        stubShare(true, Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' }));
        expect(await saveLabelImagesFromModal()).toBe(true);
        expect(shared.length).toBe(0);
        expect(h.downloads.length).toBe(3);
        expect(toasts[toasts.length - 1]).toMatch(/^✅ បានទាញយករូបភាពស្លាក 3/);
        expect(toasts.some((t) => t.indexOf('❌') === 0)).toBe(false);
        toasts.length = 0; h.downloads = [];
        setDevice(UA.android, 5);
        stubShare(true, Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' }));
        expect(await saveLabelImagesFromModal()).toBe(true);
        expect(shared.length).toBe(1);
        expect(h.downloads.length).toBe(3);
        expect(toasts[toasts.length - 1]).toMatch(/^✅ បានទាញយករូបភាពស្លាក 3/);
        expect(toasts.some((t) => t.indexOf('❌') === 0)).toBe(false);
    });
});
