import { createScratchCanvas } from '../platform/document-io';
import { code128Bars } from './zto-status';

export const LABEL_IMAGE_DOTS_PER_MM = 8;
export const LABEL_IMAGE_INK_THRESHOLD = 160;

const STICKER_MM: Record<string, [number, number]> = { '50x30': [50, 30], '40x30': [40, 30], '60x40': [60, 40] };

export interface LabelImageText {
    phone: string;
    barcode: string;
    money: string;
    date: string;
    locker: string;
}

export function labelImageSizeMm(layout: string): [number, number] {
    return STICKER_MM[layout] || STICKER_MM['50x30'];
}

function fitFont(g: CanvasRenderingContext2D, text: string, font: (px: number) => string, width: number, max: number): number {
    if (!text) return 0;
    g.font = font(100);
    const w = g.measureText(text).width;
    if (!(w > 0)) return max;
    return Math.max(1, Math.min(max, Math.floor((100 * width) / w)));
}

function inkOnly(g: CanvasRenderingContext2D, width: number, height: number): void {
    const image = g.getImageData(0, 0, width, height);
    const d = image.data;
    for (let i = 0; i < d.length; i += 4) {
        const v = (d[i] + d[i + 1] + d[i + 2]) / 3 < LABEL_IMAGE_INK_THRESHOLD ? 0 : 255;
        d[i] = v; d[i + 1] = v; d[i + 2] = v; d[i + 3] = 255;
    }
    g.putImageData(image, 0, 0);
}

export function drawLabelImage(text: LabelImageText, layout: string): HTMLCanvasElement | null {
    const [wmm, hmm] = labelImageSizeMm(layout);
    const W = wmm * LABEL_IMAGE_DOTS_PER_MM;
    const H = hmm * LABEL_IMAGE_DOTS_PER_MM;
    const canvas = createScratchCanvas();
    canvas.width = W;
    canvas.height = H;
    const g = canvas.getContext('2d', { willReadFrequently: true });
    if (!g) return null;
    g.fillStyle = '#fff';
    g.fillRect(0, 0, W, H);
    const pad = Math.round(LABEL_IMAGE_DOTS_PER_MM * 1.5);
    const inner = W - 2 * pad;
    const bold = (px: number) => '800 ' + px + 'px sans-serif';
    const mono = (px: number) => '600 ' + px + 'px ui-monospace, Menlo, Consolas, monospace';
    const meta = [text.date, text.locker].filter(Boolean).join('  ·  ');
    const bars = text.barcode ? code128Bars(text.barcode) : null;
    const gap = Math.round(H * 0.025);
    const rows = [
        { kind: 'phone', size: fitFont(g, text.phone, bold, inner, Math.round(H * 0.2)) },
        { kind: 'bars', size: bars ? Math.round(H * 0.27) : 0 },
        { kind: 'code', size: fitFont(g, text.barcode, mono, inner, Math.round(H * 0.075)) },
        { kind: 'money', size: fitFont(g, text.money, bold, inner, Math.round(H * 0.11)) },
        { kind: 'meta', size: fitFont(g, meta, bold, inner, Math.round(H * 0.09)) }
    ].filter((r) => r.size > 0);
    const lineOf = (r: { kind: string; size: number }) => (r.kind === 'bars' ? r.size : Math.ceil(r.size * 1.15));
    const total = rows.reduce((sum, r) => sum + lineOf(r), 0) + gap * Math.max(0, rows.length - 1);
    const room = H - 2 * pad;
    const scale = total > room ? room / total : 1;
    let y = pad + Math.max(0, (room - total * scale) / 2);
    g.fillStyle = '#000';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const r of rows) {
        const line = lineOf(r) * scale;
        if (r.kind === 'bars' && bars) {
            const module = Math.max(1, Math.floor(inner / bars.width));
            const left = Math.round((W - module * bars.width) / 2);
            const top = Math.round(y);
            const height = Math.max(1, Math.round(line));
            bars.bars.forEach(([x, w]) => g.fillRect(left + x * module, top, w * module, height));
        } else {
            const size = Math.max(1, Math.floor(r.size * scale));
            g.font = r.kind === 'code' ? mono(size) : bold(size);
            const value = r.kind === 'phone' ? text.phone : r.kind === 'code' ? text.barcode : r.kind === 'money' ? text.money : meta;
            g.fillText(value, W / 2, Math.round(y + line / 2), inner);
        }
        y += line + gap * scale;
    }
    inkOnly(g, W, H);
    return canvas;
}
