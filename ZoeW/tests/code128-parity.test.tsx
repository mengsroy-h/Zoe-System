import { describe, expect, it } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act as reactAct } from 'react';
import { Code128Svg } from '../src/app/components/zto/Code128Svg';
import { code128SvgElement } from './fixtures/code128-oracle';

/**
 * ⛔ រូប Barcode ដែលគូរខុស ➜ **កញ្ចប់ខុសត្រូវបិទក្នុង ZTO** ។ កំណែដើម
 *    (`code128SvgElement`) ត្រូវផ្ទៀងផ្ទាត់ដោយការឌិកូដ ZXing ពិតរួចហើយ ➜
 *    វាជា **អ្នកសម្រេច** សម្រាប់កំណែ React មិនមែនកូដងាប់ទេ។
 *
 * ⛔ ការប្រៀបធៀបជា **attribute តាម attribute** មិនមែន `outerHTML` ៖ លំដាប់
 *    attribute របស់ React និង DOM API មិនធានាថាដូចគ្នា ➜ ការប្រៀបខ្សែអក្សរ
 *    នឹងក្រហមក្លែងក្លាយ។
 */
const SAMPLES = [
    '77130533910996',      // Waybill ១៤ ខ្ទង់ (ប្រវែងផលិតកម្មពិត)
    '1234567',             // ⛔ សេស ➜ Set C ត្រូវដោះជាគូ (អន្ទាក់ `12345607`)
    '12345678',            // គូ
    'ZTO-1234',            // លាយអក្សរ ➜ Set B
    '0',                   // ខ្លីបំផុត
    ''                     // ⛔ ទទេ ➜ ទាំង ២ ត្រូវត្រឡប់ «គ្មានរូប»
];

/** គូរ component ក្នុង container ដាច់ ➜ ត្រឡប់ `<svg>` (ឬ null) */
function renderSvg(code: string): SVGElement | null {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    reactAct(() => { root.render(<Code128Svg code={code} />); });
    const svg = host.querySelector('svg');
    return svg as SVGElement | null;
}

function attrsOf(el: Element) {
    const out: Record<string, string> = {};
    for (const a of Array.from(el.attributes)) out[a.name] = a.value;
    return out;
}

describe('Code128Svg ស្មើនឹងអ្នកសម្រេចដើម', () => {
    for (const code of SAMPLES) {
        it(`«${code || '(ទទេ)'}» ➜ SVG ដូចគ្នាបេះបិទ`, () => {
            const oracle = code128SvgElement(code) as SVGElement | null;
            const mine = renderSvg(code);

            if (!oracle) { expect(mine).toBeNull(); return; }
            expect(mine).not.toBeNull();

            expect(attrsOf(mine!)).toEqual(attrsOf(oracle));

            const oracleBars = Array.from(oracle.querySelectorAll('rect')).map(attrsOf);
            const myBars = Array.from(mine!.querySelectorAll('rect')).map(attrsOf);
            expect(myBars.length).toBeGreaterThan(0);
            expect(myBars).toEqual(oracleBars);
        });
    }

    it('quiet zone ១០ module នៅសងខាង (ម៉ាស៊ីនស្កេនដៃត្រូវការ)', () => {
        const svg = renderSvg('77130533910996')!;
        const bars = Array.from(svg.querySelectorAll('rect'));
        const width = Number(svg.getAttribute('viewBox')!.split(' ')[2]);
        const first = Number(bars[0].getAttribute('x'));
        const last = Number(bars[bars.length - 1].getAttribute('x')) + Number(bars[bars.length - 1].getAttribute('width'));
        expect(first).toBeGreaterThanOrEqual(10);
        expect(width - last).toBeGreaterThanOrEqual(10);
    });
});
