import { code128Bars, CODE128_HEIGHT } from '../../../features/zto-status';

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
