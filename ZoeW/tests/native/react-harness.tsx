import { act as reactAct, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { allStores } from '../../src/core/store';

/**
 * គូរ component **React ពិត** ក្នុង jsdom ➜ តេស្តវាស់ DOM ដែល React គូរពី state
 * (React ១០០% ៖ កូដមុខងារសរសេរ state មិនមែន DOM ➜ DOM ដែលសាងដោយដៃក្នុងតេស្ត
 * មិនមែនអ្វីដែល App គូរទេ)។
 */
let host: HTMLElement | null = null;
let root: Root | null = null;

function flushStores() {
    for (const s of allStores()) s.flush();
}

export function mount(node: ReactNode): void {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    reactAct(() => { root!.render(node); });
    reactAct(() => { flushStores(); });
}

/** រត់ការកែ រួចគូរ — ទាំង ២ ក្នុង `act()` ដដែល */
export function step(fn: () => void): void {
    reactAct(() => { fn(); flushStores(); });
}

export function unmount(): void {
    if (root) reactAct(() => { root!.unmount(); });
    if (host) host.remove();
    root = null;
    host = null;
}

export function byId(id: string): HTMLElement {
    const el = document.getElementById(id);
    if (!el) throw new Error('#' + id + ' មិនត្រូវ React គូរ');
    return el;
}
