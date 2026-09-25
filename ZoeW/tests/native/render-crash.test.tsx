/**
 * ⛔ App React ៖ កំហុសក្នុង render មួយ unmount ដើមឈើទាំងមូល ➜ អេក្រង់ស។ តេស្តនេះវាស់ ២ ទិស ៖
 *    ១. component ដែលបោះ ➜ អ្នកប្រើឃើញផ្ទាំង `appCrashFallback` (សារ + ប៊ូតុងផ្ទុកឡើងវិញ) មិនមែនទំព័រទទេ
 *    ២. កំហុសនោះត្រូវ **រាយការណ៍** ទៅ window (`reportError` ➜ `error` event ➜ Sentry GlobalHandlers) —
 *       ព្រំដែនមិនត្រូវលេបវាស្ងាត់ៗ (React ចាត់វាជា «caught» ➜ លំនាំដើមត្រឹម console.error)
 *    ៣. ទិសផ្ទុយ ៖ គ្មានកំហុស ➜ កូនគូរធម្មតា គ្មានផ្ទាំង និងគ្មានការរាយការណ៍
 */
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { AppErrorBoundary } from '../../src/app/components/shell/AppErrorBoundary';
import { ROOT_ERROR_OPTIONS } from '../../src/app/root-errors';

function Thrower(): never {
    throw new Error('probe: render failed');
}

let host: HTMLElement | null = null;
afterEach(() => { if (host) host.remove(); host = null; });

function render(node: React.ReactNode): { reported: unknown[] } {
    const reported: unknown[] = [];
    const onError = (ev: ErrorEvent) => { reported.push(ev.error); ev.preventDefault(); };
    const realReport = window.reportError;
    window.reportError = (e: unknown) => { reported.push(e); };
    window.addEventListener('error', onError);
    host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host, ROOT_ERROR_OPTIONS);
    const realConsole = console.error;
    console.error = () => {};
    try {
        act(() => { root.render(node); });
    } finally {
        console.error = realConsole;
        window.removeEventListener('error', onError);
        window.reportError = realReport;
    }
    return { reported };
}

describe('render crash ➜ ផ្ទាំងជំនួស និងការរាយការណ៍', () => {
    it('component បោះ ➜ ផ្ទាំងលេច និងកំហុសទៅដល់ reportError', () => {
        const { reported } = render(<AppErrorBoundary><Thrower /></AppErrorBoundary>);
        const fallback = host!.querySelector('#appCrashFallback');
        expect(fallback).not.toBeNull();
        expect(fallback!.getAttribute('role')).toBe('alert');
        expect(host!.querySelector('.app-crash-reload')).not.toBeNull();
        expect(reported.some((e) => e instanceof Error && e.message === 'probe: render failed')).toBe(true);
    });

    it('ទិសផ្ទុយ ៖ គ្មានកំហុស ➜ កូនគូរធម្មតា គ្មានផ្ទាំង គ្មានការរាយការណ៍', () => {
        const { reported } = render(<AppErrorBoundary><p id="okChild">ok</p></AppErrorBoundary>);
        expect(host!.querySelector('#okChild')).not.toBeNull();
        expect(host!.querySelector('#appCrashFallback')).toBeNull();
        expect(reported.length).toBe(0);
    });
});
