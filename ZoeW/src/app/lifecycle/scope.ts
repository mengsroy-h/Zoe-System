export interface LifecycleScope {
    readonly disposed: boolean;
    listen(target: EventTarget | null | undefined, type: string, handler: any, options?: boolean | AddEventListenerOptions): void;
    every(ms: number, fn: () => void): void;
    onLoad(fn: () => void): void;
    onDispose(fn: () => void): void;
    dispose(): void;
}

export function createLifecycleScope(): LifecycleScope {
    const cleanups: Array<() => void> = [];
    let disposed = false;

    const scope: LifecycleScope = {
        get disposed() { return disposed; },
        listen(target, type, handler, options) {
            if (disposed || !target) return;
            target.addEventListener(type, handler, options);
            const capture = typeof options === 'boolean' ? options : !!(options && options.capture);
            cleanups.push(() => target.removeEventListener(type, handler, capture));
        },
        every(ms, fn) {
            if (disposed) return;
            const id = setInterval(fn, ms);
            cleanups.push(() => clearInterval(id));
        },
        onLoad(fn) {
            if (disposed) return;
            if (document.readyState === 'complete') { fn(); return; }
            const once = () => {
                window.removeEventListener('load', once);
                if (!disposed) fn();
            };
            window.addEventListener('load', once);
            cleanups.push(() => window.removeEventListener('load', once));
        },
        onDispose(fn) {
            if (disposed) { fn(); return; }
            cleanups.push(fn);
        },
        dispose() {
            if (disposed) return;
            disposed = true;
            while (cleanups.length) {
                const fn = cleanups.pop();
                try { fn(); } catch { }
            }
        }
    };
    return scope;
}

const ranThisPage = new Set<string>();

export function oncePerPage(key: string, fn: () => void): void {
    if (ranThisPage.has(key)) return;
    ranThisPage.add(key);
    fn();
}
