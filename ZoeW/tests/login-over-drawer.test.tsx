/**
 * ⛔ UI-2 ៖ ☰ របា Slide បើក ➜ session ផុត/ចាកចេញ (`showLoginModalWithPrefill()` ➜ `clearSensitiveModalFields()`) ➜ ប្រអប់ចូលបើក
 *    តែរបា Slide នៅបើកពីលើវា (របា Slide នៅស្រទាប់ខ្ពស់ជាងប្រអប់) ➜ អ្នកប្រើឃើញម៉ឺនុយ មិនឃើញប្រអប់ចូល។
 * ⛔ ការសម្អាត session បិទរបា Slide តាម state (`uiState.drawerOpen = false`) ⛔ មិនមែន `closeSideDrawer()` (វាសម្គាល់ 🔔 ថា «បានឃើញ») ·
 *    ⛔ មិនប្តូរលំដាប់ស្រទាប់។
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { uiState } from '../src/core/state';
import { showLoginModalWithPrefill } from '../src/features/session';
import { closeSideDrawer as closeSideDrawerProbe, openSideDrawer } from '../src/ui/page-nav';
import { SideDrawer } from '../src/app/components/SideDrawer';
import { LoginModal } from '../src/app/components/modals/LoginModal';
import '../src/app/flush';
import { byId, mount, step, unmount } from './native/react-harness';

beforeEach(() => {
    step(() => {
        uiState.modalDisplay = {};
        uiState.modalStack = [];
        uiState.isModalOpen = false;
        uiState.drawerOpen = false;
        uiState.notifyDrawerOpen = false;
    });
    mount(<><SideDrawer /><LoginModal /></>);
});

afterEach(() => { unmount(); document.body.innerHTML = ''; });

describe('UI-2 ៖ ប្រអប់ចូលមិនត្រូវរបា Slide គ្រប', () => {
    it('ជាន់អប្បបរមា ៖ របា Slide បើកពិត', () => {
        step(() => openSideDrawer());
        expect(byId('sideDrawer').classList.contains('open')).toBe(true);
    });

    it('⛔ ☰ បើក ➜ showLoginModalWithPrefill() ➜ របា Slide បិទ · ប្រអប់ចូលបើក', () => {
        step(() => openSideDrawer());
        step(() => showLoginModalWithPrefill());
        expect(byId('sideDrawer').classList.contains('open')).toBe(false);
        expect(byId('loginModal').style.display).toBe('flex');
    });

    it('ទិសផ្ទុយ ៖ 🔔 មិនត្រូវសម្គាល់ថា «បានឃើញ» ដោយការសម្អាត session (មិនហៅ closeSideDrawer)', () => {
        step(() => {
            uiState.notifyFeed = [{ id: 'n-unseen', kind: 'notice', title: 't', body: 'b', date: '2026-10-08' }] as any;
            uiState.notifySeenIds = [];
            uiState.notifyDrawerOpen = true;
        });
        step(() => closeSideDrawerProbe());
        expect(uiState.notifySeenIds).toEqual(['n-unseen']);
        step(() => { uiState.notifySeenIds = []; uiState.notifyDrawerOpen = true; uiState.drawerOpen = true; });
        step(() => showLoginModalWithPrefill());
        expect(uiState.notifyDrawerOpen).toBe(false);
        expect(uiState.drawerOpen).toBe(false);
        expect(uiState.notifySeenIds).toEqual([]);
    });
});
