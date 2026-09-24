/**
 * ⛔ ប៊ូតុង Back របស់ Android ៖ ស្រទាប់ខាងលើគេបិទមុន · App ជាប់សោ ➜ មិនប៉ះ
 *    អ្វីនៅពីក្រោយសោ · ទំព័រស្កេន ➜ ទំព័រទិន្នន័យ · ទំព័រទិន្នន័យ ➜ បង្រួម App។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { securityState, uiState } from '../../src/core/state';
import { handleNativeBack } from '../../src/app/lifecycle/native-shell';
import { createBackHistory, screenOf } from '../../src/app/lifecycle/back-history';
import { openModalHelper } from '../../src/ui/modal';
import { openSideDrawer } from '../../src/ui/page-nav';
import { GlobalMoreMenu } from '../../src/app/components/GlobalMoreMenu';
import { SideDrawer } from '../../src/app/components/SideDrawer';
import { DrawerBackdrop } from '../../src/app/components/DrawerBackdrop';
import { PhoneModal } from '../../src/app/components/modals/PhoneModal';
import { byId, mount, step, unmount } from './react-harness';

/**
 * ⛔ ការវាស់ឆ្លងកាត់ **component React ពិត** ៖ ស្ថានភាពបើក/បិទជា state
 *    (`uiState.moreMenuOpen` · `drawerOpen` · `modalDisplay`) ហើយ class/`display`
 *    ដែលអ្នកប្រើឃើញ ជាអ្វីដែល React គូរពីវា។
 */
beforeEach(() => {
    step(() => {
        securityState.appIsLocked = false;
        uiState.currentAppPage = 'data';
        uiState.moreMenuOpen = false;
        uiState.drawerOpen = false;
        uiState.modalDisplay = {};
    });
    mount(<><GlobalMoreMenu /><SideDrawer /><DrawerBackdrop /><PhoneModal /></>);
});

afterEach(() => { unmount(); document.body.innerHTML = ''; });

describe('handleNativeBack', () => {
    it('ម៉ឺនុយ (...) បើក ➜ បិទម៉ឺនុយ មិនបង្រួម', () => {
        step(() => { uiState.moreMenuOpen = true; });
        expect(byId('globalMoreMenu').classList.contains('show')).toBe(true);
        const minimize = vi.fn();
        step(() => handleNativeBack(minimize));
        expect(byId('globalMoreMenu').classList.contains('show')).toBe(false);
        expect(minimize).not.toHaveBeenCalled();
    });

    it('ប្រអប់ data-nodismiss ➜ ស្រទាប់ស៊ីការចុច (មិនបង្រួម · មិនប្តូរទំព័រ)', () => {
        step(() => { openModalHelper('phoneModal'); uiState.currentAppPage = 'entry'; });
        expect(byId('phoneModal').getAttribute('data-nodismiss')).toBe('true');
        expect(byId('phoneModal').style.display).toBe('flex');
        const minimize = vi.fn();
        step(() => handleNativeBack(minimize));
        expect(byId('phoneModal').style.display).toBe('flex');
        expect(minimize).not.toHaveBeenCalled();
        expect(uiState.currentAppPage).toBe('entry');
    });

    it('របា Slide បើក ➜ បិទវា', () => {
        step(() => openSideDrawer());
        expect(byId('sideDrawer').classList.contains('open')).toBe(true);
        expect(byId('drawerBackdrop').classList.contains('open')).toBe(true);
        const minimize = vi.fn();
        step(() => handleNativeBack(minimize));
        expect(byId('sideDrawer').classList.contains('open')).toBe(false);
        expect(byId('sideDrawer').getAttribute('aria-hidden')).toBe('true');
        expect(byId('drawerBackdrop').classList.contains('open')).toBe(false);
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
        step(() => { openModalHelper('phoneModal'); uiState.currentAppPage = 'entry'; securityState.appIsLocked = true; });
        const minimize = vi.fn();
        step(() => handleNativeBack(minimize));
        expect(minimize).toHaveBeenCalledTimes(1);
        expect(byId('phoneModal').style.display).toBe('flex');
        expect(uiState.currentAppPage).toBe('entry');
    });
});
