import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ rects: [] as number[][], shares: [] as any[] }));
vi.mock('../src/platform/document-io', async (original) => ({
    ...(await original<Record<string, unknown>>()),
    createScratchCanvas: () => {
        const canvas: any = { width: 0, height: 0, toDataURL: () => 'data:image/png;base64,iVBORw0KGgo=' };
        canvas.getContext = () => ({
            fillRect: (...rect: number[]) => { h.rects.push(rect); }, fillText: () => {},
            measureText: (text: string) => ({ width: text.length * 50 }),
            getImageData: (_x: number, _y: number, width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }),
            putImageData: () => {}
        });
        return canvas;
    }
}));
vi.mock('../src/platform/file-output', async (original) => ({
    ...(await original<Record<string, unknown>>()),
    shareImageFiles: async (files: any) => { h.shares.push(files); return 'saved'; }
}));

import { drawLabelImage } from '../src/features/label-image';
import { code128Bars } from '../src/features/zto-status';
import { dataState, uiState } from '../src/core/state';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../src/core/text';
import { labelImageFiles, normalizeLabelOptions, openLabelPrintModal, resetLabelPrint, saveLabelImagesFromModal } from '../src/features/label-print';
import { appLocalStore } from '../src/core/storage';
import { LabelPrintModal } from '../src/app/components/modals/LabelPrintModal';
import { mount, step, unmount } from './native/react-harness';

const text = (barcode: string) => ({ phone: '012000001', barcode, money: 'COD $5.00', date: '30/10', locker: 'A1' });
const row = (barcode: string) => ({ phone: '012000001', barcode, cod: 5, dod: 0, date: '30/10', locker: 'A1' });

beforeEach(() => {
    h.rects.length = 0; h.shares.length = 0;
    dbListenerFailedPaths.clear(); dbListenerPendingPaths.clear(); appLocalStore.clear();
    uiState.currentFilterMode = 'all'; uiState.modalDisplay = {}; uiState.modalStack = []; uiState.isModalOpen = false; uiState.toasts = [];
});

afterEach(() => {
    step(() => resetLabelPrint());
    unmount();
    appLocalStore.clear();
});

it.each(['40x30', '50x30', '60x40', 'single', 'a4-3', 'a4-2'])('លេខ 14/40 ខ្ទង់ ត្រូវគូរបន្ទាត់ទាំងអស់ក្នុង %s', (layout) => {
    for (const code of ['77100000308751', '1234567890123456789012345678901234567890']) {
        h.rects.length = 0;
        const encoded = code128Bars(code)!;
        const canvas = drawLabelImage(text(code), layout)!;
        expect(canvas).not.toBeNull();
        const ink = h.rects.slice(1);
        expect(ink).toHaveLength(encoded.bars.length);
        expect(ink.every(([x, y, width, height]) => x >= 0 && x + width <= canvas.width && y >= 0 && y + height <= canvas.height)).toBe(true);
        const module = ink[0][2] / encoded.bars[0][1];
        const left = ink[0][0] - encoded.bars[0][0] * module;
        expect(module).toBeGreaterThanOrEqual(1);
        expect(Number.isInteger(module)).toBe(true);
        expect(left).toBeGreaterThanOrEqual(12);
        expect(left + encoded.width * module).toBeLessThanOrEqual(canvas.width - 12);
    }
});

it.each([{ layout: '40x30', fit: 21 }, { layout: '50x30', fit: 29 }, { layout: '60x40', fit: 36 }])('$layout រក្សាព្រំដែន quiet zones និងបដិសេធស្លាកដែលលើស 1 module', ({ layout, fit }) => {
    expect(drawLabelImage(text('A'.repeat(fit)), layout)).not.toBeNull();
    h.rects.length = 0;
    expect(drawLabelImage(text('A'.repeat(fit + 1)), layout)).toBeNull();
    expect(h.rects).toEqual([]);
});

it.each(['40x30', '50x30', '60x40', 'single', 'a4-3', 'a4-2'])('ASCII 40 តួអក្សរ មិនបង្កើត PNG ដែល clip ក្នុង %s', (layout) => {
    const code = 'AUDITONLYABCDEFGHIJKLMN0123456789ABCDEFG';
    expect(code).toHaveLength(40);
    expect(code128Bars(code)).not.toBeNull();
    expect(drawLabelImage(text(code), layout)).toBeNull();
    expect(h.rects).toEqual([]);
});

it('batch ដែលមានស្លាកធំពេក បដិសេធទាំងអស់ និងផ្ដល់សារ មិន share ផ្នែកខ្លះ', async () => {
    const ordinary = row('77100000308751'), long = row('A'.repeat(35));
    const small = normalizeLabelOptions({ layout: '50x30' });
    expect.soft(labelImageFiles([ordinary, long], small)).toEqual([]);
    expect(labelImageFiles([ordinary, long], normalizeLabelOptions({ layout: '60x40' }))).toHaveLength(2);
    dataState.scanHistory = [{ id: 'row', phone: ordinary.phone, scanDate: '2026-10-30', barcodes: [ordinary, long].map((r) => ({ code: r.barcode, cod: r.cod, dod: r.dod })) }];
    mount(<LabelPrintModal />);
    step(() => { expect(openLabelPrintModal({ kind: 'filter' })).toBe(true); });
    const result = await saveLabelImagesFromModal();
    expect.soft(result).toBe(false);
    expect.soft(h.shares).toEqual([]);
    expect.soft(JSON.stringify(uiState.toasts)).toContain('ទំហំស្លាក');
    step(() => { (document.getElementById('labelLayoutSelect') as HTMLSelectElement).value = '60x40'; });
    expect(await saveLabelImagesFromModal()).toBe(true);
    expect(h.shares[0]).toHaveLength(2);
});
