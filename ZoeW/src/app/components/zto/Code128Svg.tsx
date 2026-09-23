import { code128Bars, CODE128_HEIGHT } from '../../../features/zto-status';

/**
 * រូប Barcode Code 128 ជា SVG។
 *
 * ⛔ រូបដែលគូរខុសនាំឲ្យ **កញ្ចប់ខុសត្រូវបិទក្នុង ZTO** ➜ តារាងលំនាំ ·
 *    checksum · ការជ្រើស Set រស់នៅ `code128Bars()` ដដែល (គ្មានច្បាប់ចម្លង)។
 * ⛔ quiet zone ១០ module ក្នុងមួយចំហៀងមកពី `code128Bars()` ➜ ម៉ាស៊ីនស្កេនដៃ
 *    អានបាន។ កុំកាត់ `viewBox` ឲ្យតូចជាងទទឹងដែលវាត្រឡប់។
 */
export function Code128Svg({ code }: { code: string }) {
    const drawing = code128Bars(code);
    if (!drawing) return null;
    return (
        <svg className="zto-sync-bc" viewBox={`0 0 ${drawing.width} ${CODE128_HEIGHT}`}
            preserveAspectRatio="none" aria-hidden="true" focusable="false">
            {drawing.bars.map((bar: number[], i: number) => (
                <rect key={i} x={bar[0]} y="0" width={bar[1]} height={CODE128_HEIGHT} />
            ))}
        </svg>
    );
}
