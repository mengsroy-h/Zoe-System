/**
 * ⛔ `toast.ts` ត្រូវសរសេរឡើងវិញទាំង ៨ function ៖ ការចុះឈ្មោះផ្លាស់ពី
 *    **DOM** ទៅ **បញ្ជីក្នុង store**។ ច្បាប់ដើមដែលត្រូវរស់រាន ៖
 *      ១. ពិដាន ៤ ក្នុងពេលតែមួយ
 *      ២. អ្នកបោះរំលង toast ដែល **កំពុងរស់** (`data-live-toast`)
 *      ៣. class ដេរីវេពីសញ្ញាដើមសារ (❌ ⚠️ ✅)
 *      ៤. ធាតុចុះ **គ្មាន `.show`** ជាមុន ➜ ទទួលវានៅស៊ុមបន្ទាប់
 *      ៥. សារដដែល ➜ ប្រកាសឡើងវិញ មិនស្ទួន
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act as reactAct } from 'react';
import { ToastList } from '../src/app/components/toast/ToastList';
import { uiState } from '../src/core/state';
import {
    dropOldestToast, reannounceOrShowToast, showToast, toastKindOf
} from '../src/ui/toast';

let host: HTMLElement;
let root: any;

function mount() {
    host = document.createElement('div');
    host.className = 'toast-container';
    document.body.appendChild(host);
    root = createRoot(host);
    reactAct(() => { root.render(<ToastList />); });
    reactAct(() => { uiState.flush(); });
}

/** រត់ការកែ រួចគូរ — ទាំង ២ ក្នុង `act()` ដដែល (React ទាមទារ) */
function step(fn: () => void) {
    reactAct(() => { fn(); uiState.flush(); });
}

function toasts() {
    return Array.from(host.querySelectorAll('.toast'));
}

beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '';
    mount();
    reactAct(() => { uiState.toasts = []; uiState.flush(); });
});

afterEach(() => {
    // ⛔ timer ដែលនៅសល់ បាញ់ក្រោយ test ចប់ ➜ ការគូរក្រៅ `act()`
    reactAct(() => { vi.runOnlyPendingTimers(); uiState.flush(); });
    vi.useRealTimers();
});

describe('toast ៖ ច្បាប់ដើមរស់រានការសរសេរឡើងវិញ', () => {
    it('class ដេរីវេពីសញ្ញាដើមសារ ដូច `toastKindOf()`', () => {
        const cases: [string, string][] = [
            ['❌ បរាជ័យ', 'toast-error'],
            ['⚠️ ប្រយ័ត្ន', 'toast-warn'],
            ['✅ ជោគជ័យ', 'toast-success'],
            ['កំពុងដំណើរការ', 'toast-info']
        ];
        for (const [msg, cls] of cases) {
            uiState.toasts = [];
            step(() => { showToast(msg); });
            expect(toasts()[0].className).toContain(cls);
            // ⛔ ទិសផ្ទុយ ៖ អ្នកសម្រេច class ត្រូវជា `toastKindOf()` ដដែល
            expect((toastKindOf as any)(msg)).toBe(cls.replace('toast-', ''));
        }
    });

    it('ធាតុចុះគ្មាន `.show` ជាមុន ➜ ទទួលវានៅស៊ុមបន្ទាប់', () => {
        const frames: any[] = [];
        const raf = vi.spyOn(window, 'requestAnimationFrame')
            .mockImplementation((fn: any) => { frames.push(fn); return 0 as any; });
        step(() => { showToast('ℹ️ សាកល្បង'); });
        expect(toasts()[0].className).not.toContain('show');
        step(() => { frames.forEach((f) => f(0)); });
        expect(toasts()[0].className).toContain('show');
        raf.mockRestore();
    });

    it('ពិដាន ៤ ៖ ទី ៥ រុញទី ១ ចេញ', () => {
        step(() => { for (let i = 1; i <= 5; i++) showToast('សារ ' + i); });
        expect(toasts().length).toBe(4);
        expect(toasts().map((t) => t.textContent)).toEqual(['សារ 2', 'សារ 3', 'សារ 4', 'សារ 5']);
    });

    it('អ្នកបោះរំលង toast ដែលកំពុងរស់', () => {
        const a = showToast('សារ ក');
        showToast('សារ ខ');
        // សម្គាល់ «ក» ជា toast រស់ (ដូច `showLiveToast()` ធ្វើ)
        uiState.toasts[0].live = 'signin';
        step(() => { uiState.touch(); });
        expect(toasts()[0].getAttribute('data-live-toast')).toBe('signin');

        step(() => { dropOldestToast(); });
        // ⛔ «ក» ត្រូវនៅ — អ្នកបោះត្រូវយក «ខ» ដែលមិនរស់
        expect(toasts().map((t) => t.textContent)).toEqual(['សារ ក']);
        expect(a).not.toBeNull();
    });

    it('អ្នកបោះធ្លាក់ចុះទៅធាតុទី ១ ពេលទាំងអស់រស់', () => {
        showToast('ក'); showToast('ខ');
        uiState.toasts.forEach((t: any) => { t.live = 'signin'; });
        uiState.touch();
        step(() => { dropOldestToast(); });
        expect(toasts().map((t) => t.textContent)).toEqual(['ខ']);
    });

    it('សារដដែល ➜ ប្រកាសឡើងវិញ មិនស្ទួន', () => {
        step(() => { showToast('⚠️ វគ្គផុតកំណត់'); });
        step(() => { reannounceOrShowToast('⚠️ វគ្គផុតកំណត់'); });
        expect(toasts().length).toBe(1);
        // សារថ្មីទើបបង្កើតធាតុទី ២
        step(() => { reannounceOrShowToast('⚠️ សារផ្សេង'); });
        expect(toasts().length).toBe(2);
    });

    it('អស់ម៉ោង ➜ ដក `.show` រួចលុបចេញក្រោយ ៣០០ ms', () => {
        step(() => { showToast('ℹ️ បណ្ដោះអាសន្ន'); });
        expect(toasts().length).toBe(1);

        step(() => { vi.advanceTimersByTime(3000); });
        expect(toasts()[0].className).not.toContain('show');
        expect(toasts().length).toBe(1);   // ⛔ នៅមាន ➜ ចលនាលេចមិនត្រូវកាត់

        step(() => { vi.advanceTimersByTime(300); });
        expect(toasts().length).toBe(0);
    });
});
