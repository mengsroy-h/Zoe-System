/**
 * ⛔ ប៊ូតុង Back របស់ Android ៖ ស្រទាប់ខាងលើគេបិទមុន · App ជាប់សោ ➜ មិនប៉ះ
 *    អ្វីនៅពីក្រោយសោ · ទំព័រស្កេន ➜ ទំព័រទិន្នន័យ · ទំព័រទិន្នន័យ ➜ បង្រួម App។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { securityState, uiState } from '../../src/core/state';
import { handleNativeBack } from '../../src/app/lifecycle/native-shell';
import { createBackHistory, screenOf } from '../../src/app/lifecycle/back-history';

function el(html: string): HTMLElement {
    const box = document.createElement('div');
    box.innerHTML = html.trim();
    const node = box.firstElementChild as HTMLElement;
    document.body.appendChild(node);
    return node;
}

beforeEach(() => {
    document.body.innerHTML = '';
    securityState.appIsLocked = false;
    uiState.currentAppPage = 'data';
});

afterEach(() => { document.body.innerHTML = ''; });

describe('handleNativeBack', () => {
    it('ម៉ឺនុយ (...) បើក ➜ បិទម៉ឺនុយ មិនបង្រួម', () => {
        const menu = el('<div id="globalMoreMenu" class="more-menu show"></div>');
        const minimize = vi.fn();
        handleNativeBack(minimize);
        expect(menu.classList.contains('show')).toBe(false);
        expect(minimize).not.toHaveBeenCalled();
    });

    it('ប្រអប់ data-nodismiss ➜ ស្រទាប់ស៊ីការចុច (មិនបង្រួម · មិនប្តូរទំព័រ)', () => {
        const modal = el('<div id="pinModal" class="modal" data-nodismiss="1"></div>');
        modal.style.display = 'flex';
        uiState.currentAppPage = 'entry';
        const minimize = vi.fn();
        handleNativeBack(minimize);
        expect(modal.style.display).toBe('flex');
        expect(minimize).not.toHaveBeenCalled();
        expect(uiState.currentAppPage).toBe('entry');
    });

    it('របា Slide បើក ➜ បិទវា', () => {
        const drawer = el('<aside id="sideDrawer" class="open"></aside>');
        const backdrop = el('<div id="drawerBackdrop" class="open"></div>');
        const minimize = vi.fn();
        handleNativeBack(minimize);
        expect(drawer.classList.contains('open')).toBe(false);
        expect(backdrop.classList.contains('open')).toBe(false);
        expect(minimize).not.toHaveBeenCalled();
    });

    it('ទំព័រស្កេន ➜ ទំព័រទិន្នន័យ', () => {
        uiState.currentAppPage = 'entry';
        const minimize = vi.fn();
        handleNativeBack(minimize);
        expect(uiState.currentAppPage).toBe('data');
        expect(minimize).not.toHaveBeenCalled();
    });

    it('ទំព័រទិន្នន័យ គ្មានស្រទាប់ ➜ បង្រួម', () => {
        const minimize = vi.fn();
        handleNativeBack(minimize);
        expect(minimize).toHaveBeenCalledTimes(1);
    });

    it('ប្រវត្តិ ៖ Back ត្រឡប់ទៅអេក្រង់មុនពិត មុនការបង្រួម', () => {
        const history = createBackHistory(() => screenOf(uiState));
        uiState.currentAppPage = 'entry';
        history.observe();
        uiState.currentAppPage = 'data';
        history.observe();
        const minimize = vi.fn();
        handleNativeBack(minimize, history);
        expect(uiState.currentAppPage).toBe('entry');
        handleNativeBack(minimize, history);
        expect(uiState.currentAppPage).toBe('data');
        expect(minimize).not.toHaveBeenCalled();
        handleNativeBack(minimize, history);
        expect(minimize).toHaveBeenCalledTimes(1);
    });

    it('App ជាប់សោ ➜ បង្រួម ទោះមានប្រអប់ ឬទំព័រស្កេន', () => {
        securityState.appIsLocked = true;
        const modal = el('<div id="phoneModal" class="modal"></div>');
        modal.style.display = 'flex';
        uiState.currentAppPage = 'entry';
        const minimize = vi.fn();
        handleNativeBack(minimize);
        expect(minimize).toHaveBeenCalledTimes(1);
        expect(modal.style.display).toBe('flex');
        expect(uiState.currentAppPage).toBe('entry');
    });
});

describe('ពណ៌រូបតំណាងរបាស្ថានភាព', () => {
    it('WebView ពេញអេក្រង់ (inset > 0) ➜ រូបតំណាងស · padding (inset 0) ➜ រូបតំណាងខ្មៅ', async () => {
        const { statusBarStyleFor } = await import('../../src/app/lifecycle/native-shell');
        expect(statusBarStyleFor(24)).toBe('dark');
        expect(statusBarStyleFor(0)).toBe('light');
    });
});
