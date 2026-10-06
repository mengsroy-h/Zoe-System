import { useId } from 'react';

function useSvgId(prefix: string) {
    return prefix + useId().replace(/[^A-Za-z0-9_-]/g, '');
}

export function FirebaseMark() {
    const id = useSvgId('cfgFirebaseFlame');
    return (
        <svg className="cfg-mark" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <defs>
                <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#FFCA28" />
                    <stop offset="0.55" stopColor="#FFA000" />
                    <stop offset="1" stopColor="#F57C00" />
                </linearGradient>
            </defs>
            <path
                fill={'url(#' + id + ')'}
                d="M3.89 15.672L6.255.461A.542.542 0 017.27.288l2.543 4.771zm16.794 3.692l-2.25-14a.54.54 0 00-.919-.295L3.316 19.365l7.856 4.427a1.621 1.621 0 001.588 0zM14.3 7.147l-1.82-3.482a.542.542 0 00-.96 0L3.53 17.984z"
            />
        </svg>
    );
}

export function SupabaseMark() {
    const id = useSvgId('cfgSupabaseBolt');
    return (
        <svg className="cfg-mark" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <defs>
                <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#3ECF8E" />
                    <stop offset="1" stopColor="#249361" />
                </linearGradient>
            </defs>
            <path
                fill={'url(#' + id + ')'}
                d="M11.9 1.036c-.015-.986-1.26-1.41-1.874-.637L.764 12.05C-.33 13.427.65 15.455 2.409 15.455h9.579l.113 7.51c.014.985 1.259 1.408 1.873.636l9.262-11.653c1.093-1.375.113-3.403-1.645-3.403h-9.642z"
            />
        </svg>
    );
}
