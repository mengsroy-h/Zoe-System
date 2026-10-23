import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { uiState } from '../../src/core/state';
import { viewState } from '../../src/core/view-state';
import { armPdfExportRestore, beginPdfPrint, restoreAfterPdfExport } from '../../src/features/export';
import { PRINT_RETURNED_EVENT } from '../../src/platform/file-output';
import * as toastModule from '../../src/ui/toast';

const native = vi.hoisted(() => ({
    addListener: vi.fn(), printWebView: vi.fn(),
    listeners: [] as Array<{ callback: () => void; remove: ReturnType<typeof vi.fn> }>
}));
vi.mock('@capacitor/app', () => ({ App: { addListener: native.addListener } }));
vi.mock('@capgo/capacitor-printer', () => ({ Printer: { printWebView: native.printWebView } }));
vi.mock('../../src/platform/native', async (original) => ({ ...(await original<object>()), isNativeApp: () => true }));

const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
function startPrint(name: string) {
    const view = { title: name, headers: [], rows: [], footer: '' };
    uiState.pdfExportView = view;
    beginPdfPrint(name);
    return view;
}

beforeEach(() => {
    native.listeners.length = 0;
    native.addListener.mockReset().mockImplementation(async (_name: string, callback: () => void) => {
        const handle = { callback, remove: vi.fn(async () => {}) };
        native.listeners.push(handle);
        return handle;
    });
    native.printWebView.mockReset().mockResolvedValue(undefined);
    vi.spyOn(toastModule, 'showToast').mockImplementation(() => 0);
    restoreAfterPdfExport();
});

afterEach(() => {
    restoreAfterPdfExport();
    window.removeEventListener('afterprint', armPdfExportRestore);
    window.removeEventListener(PRINT_RETURNED_EVENT, restoreAfterPdfExport);
    vi.restoreAllMocks();
});

describe('បោះពុម្ព native ៖ ម្ចាស់ការងារឆ្លង bridge', () => {
    it('ការងារបច្ចុប្បន្នបរាជ័យ ➜ event ត្រឡប់សម្អាតទិដ្ឋភាព ហើយសារបរាជ័យនៅតែបង្ហាញ', async () => {
        native.printWebView.mockRejectedValue(new Error('Printer failed'));
        startPrint('បច្ចុប្បន្ន');
        await vi.waitFor(() => expect(toastModule.showToast).toHaveBeenCalledExactlyOnceWith('❌ Export PDF បរាជ័យ!'));
        expect(uiState.pdfExportView).toBeNull();
        expect(viewState.documentTitle).toBeNull();
        expect(native.listeners[0].remove).toHaveBeenCalledTimes(1);
    });

    it.each(['reject', 'resume'] as const)('ការងារចាស់ %s ក្រោយ logout និងការងារថ្មី ➜ event ចាស់មិនសម្អាតទិដ្ឋភាពថ្មី', async (result) => {
        let rejectOld: (error: Error) => void = () => {};
        let resolveOld: () => void = () => {};
        native.printWebView.mockImplementationOnce(() => new Promise<void>((resolve, reject) => { resolveOld = resolve; rejectOld = reject; }));
        startPrint('ចាស់');
        await vi.waitFor(() => expect(native.printWebView).toHaveBeenCalledTimes(1));
        restoreAfterPdfExport();
        const newView = startPrint('ថ្មី');
        await vi.waitFor(() => expect(native.printWebView).toHaveBeenCalledTimes(2));
        if (result === 'reject') rejectOld(new Error('Old print failed'));
        else { native.listeners[0].callback(); resolveOld(); }
        await flush();
        expect(uiState.pdfExportView).toBe(newView);
        expect(viewState.documentTitle).toBe('ថ្មី');
        expect(toastModule.showToast).not.toHaveBeenCalled();
    });

    it('handle របស់ listener មកយឺតក្រោយ logout ➜ ដក handle ចាស់ ហើយមិនបើកផ្ទាំងបោះពុម្ពចាស់', async () => {
        let release: (handle: { remove: ReturnType<typeof vi.fn> }) => void = () => {};
        const remove = vi.fn(async () => {});
        native.addListener.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
        startPrint('ចាស់');
        await vi.waitFor(() => expect(native.addListener).toHaveBeenCalledTimes(1));
        restoreAfterPdfExport();
        const newView = startPrint('ថ្មី');
        await vi.waitFor(() => expect(native.printWebView).toHaveBeenCalledExactlyOnceWith({ name: 'ថ្មី' }));
        release({ remove });
        await flush();
        expect(remove).toHaveBeenCalledTimes(1);
        expect(native.printWebView).toHaveBeenCalledTimes(1);
        expect(uiState.pdfExportView).toBe(newView);
    });

    it('resume មុន listener ចុះឈ្មោះចប់ ➜ មិនចាត់ទុកជាការត្រឡប់ពីផ្ទាំងបោះពុម្ព', async () => {
        native.addListener.mockImplementationOnce(async (_name: string, callback: () => void) => {
            callback();
            return { remove: vi.fn(async () => {}) };
        });
        const currentView = startPrint('បច្ចុប្បន្ន');
        await vi.waitFor(() => expect(native.printWebView).toHaveBeenCalledExactlyOnceWith({ name: 'បច្ចុប្បន្ន' }));
        expect(uiState.pdfExportView).toBe(currentView);
        expect(toastModule.showToast).not.toHaveBeenCalled();
    });

    it('ការងារបច្ចុប្បន្នត្រឡប់ពីផ្ទាំងបោះពុម្ព ➜ សម្អាតទិដ្ឋភាព និងដក listener', async () => {
        startPrint('បច្ចុប្បន្ន');
        await vi.waitFor(() => expect(native.printWebView).toHaveBeenCalledTimes(1));
        native.listeners[0].callback();
        expect(uiState.pdfExportView).toBeNull();
        expect(viewState.documentTitle).toBeNull();
        expect(native.listeners[0].remove).toHaveBeenCalledTimes(1);
        expect(toastModule.showToast).not.toHaveBeenCalled();
    });
});
