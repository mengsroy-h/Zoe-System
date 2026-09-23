import { CODE128_HEIGHT, code128Bars } from '../../src/features/zto-status';

/**
 * អ្នកសម្រេច (oracle) ៖ `code128SvgElement()` របស់ ZoeW ដើម **បេះបិទ** — វាត្រូវ
 * បានផ្ទៀងផ្ទាត់ដោយការឌិកូដ ZXing ពិត។ App React គូរ Barcode ដោយ `<Code128Svg>`
 * ➜ function នេះរស់នៅក្នុងតេស្តតែម្យ៉ាង ដើម្បីប្រៀបធៀប SVG attribute តាម attribute។
 */
export function code128SvgElement(text) {
    const drawing = code128Bars(text);
    if (!drawing) return null;
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'zto-sync-bc');
    svg.setAttribute('viewBox', '0 0 ' + drawing.width + ' ' + CODE128_HEIGHT);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    for (let i = 0; i < drawing.bars.length; i++) {
        const rect = document.createElementNS(NS, 'rect');
        rect.setAttribute('x', String(drawing.bars[i][0]));
        rect.setAttribute('y', '0');
        rect.setAttribute('width', String(drawing.bars[i][1]));
        rect.setAttribute('height', String(CODE128_HEIGHT));
        svg.appendChild(rect);
    }
    return svg;
}
