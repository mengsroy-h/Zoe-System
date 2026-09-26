export function documentIsHidden(): boolean {
    return document.hidden;
}

export function onDocumentVisibilityChange(fn: () => void): void {
    document.addEventListener('visibilitychange', fn);
}

export function resetDocumentScroll(inner?: () => void): void {
    const root = document.scrollingElement || document.documentElement;
    if (root) root.scrollTop = 0;
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    if (inner) inner();
    scrollWindowToTop();
}

export function scrollWindowToTop(): void {
    window.scrollTo(0, 0);
}

export function createScratchCanvas(): HTMLCanvasElement {
    return document.createElement('canvas');
}

export function loadScratchImage(url: string, onLoad: (img: HTMLImageElement) => void, onError: () => void): HTMLImageElement {
    const img = new Image();
    img.onload = () => onLoad(img);
    img.onerror = () => onError();
    img.src = url;
    return img;
}

export function addPreconnectHint(origin: string): void {
    const already = Array.from(document.querySelectorAll('link[rel="preconnect"], link[rel="dns-prefetch"]'))
        .some((l: any) => l.href.replace(/\/$/, '') === origin);
    if (already) return;
    const preconnect = document.createElement('link');
    preconnect.rel = 'preconnect';
    preconnect.href = origin;
    preconnect.crossOrigin = 'anonymous';
    document.head.appendChild(preconnect);
}

export interface ScriptSpec {
    url: string;
    integrity?: string;
    onLoad: () => void;
    onError: () => void;
}

export function injectScript(spec: ScriptSpec): HTMLScriptElement {
    const script = document.createElement('script');
    script.src = spec.url;
    if (spec.integrity) {
        script.integrity = spec.integrity;
        script.crossOrigin = 'anonymous';
    }
    script.onload = spec.onLoad;
    script.onerror = spec.onError;
    document.head.appendChild(script);
    return script;
}

export function downloadObjectUrl(url: string, filename: string): void {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}
