export const APP_ICON_PLATE = { rx: 112, from: '#e31837', to: '#c3122d' };

export const APP_ICON_FACES = [
    { d: 'M256 162 L363 217 L256 272 L149 217 Z', fill: '#fffcfc' },
    { d: 'M149 217 L256 272 L256 388 L149 333 Z', fill: 'left', from: '#fdebec', to: '#fce4e6' },
    { d: 'M256 272 L363 217 L363 333 L256 388 Z', fill: '#fce0e2' }
];

export const APP_ICON_SEAM = { d: 'M256 269 L256 392', stroke: '#e31837', width: 10 };

export function AppIconMark({ idPrefix }: { idPrefix: string }) {
    const bgId = idPrefix + 'Bg';
    const leftId = idPrefix + 'Left';
    return (
        <svg className="app-icon-mark" viewBox="0 0 512 512" aria-hidden="true" focusable="false">
            <defs>
                <linearGradient id={bgId} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor={APP_ICON_PLATE.from} />
                    <stop offset="1" stopColor={APP_ICON_PLATE.to} />
                </linearGradient>
                <linearGradient id={leftId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor={APP_ICON_FACES[1].from} />
                    <stop offset="1" stopColor={APP_ICON_FACES[1].to} />
                </linearGradient>
            </defs>
            <rect width="512" height="512" rx={APP_ICON_PLATE.rx} fill={'url(#' + bgId + ')'} />
            <g strokeWidth="8" strokeLinejoin="round">
                {APP_ICON_FACES.map((face) => {
                    const paint = face.fill === 'left' ? 'url(#' + leftId + ')' : face.fill;
                    return <path key={face.d} d={face.d} fill={paint} stroke={paint} />;
                })}
                <path
                    d={APP_ICON_SEAM.d}
                    stroke={APP_ICON_SEAM.stroke}
                    strokeWidth={APP_ICON_SEAM.width}
                    strokeLinecap="round"
                    fill="none"
                />
            </g>
        </svg>
    );
}
