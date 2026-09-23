/**
 * ⛔ App ដើមកែ DOM ផ្ទាល់ ➜ ប្រអប់ · របា Slide · ម៉ឺនុយ · ផ្ទាំង **ប្រែក្នុង tick ដដែល**
 *    នឹងការហៅ។ កូដ (និងអ្នកវាស់) ដែលអាន DOM ភ្លាមក្រោយហៅ ត្រូវឃើញស្ថានភាពថ្មី —
 *    វាលរចនាសម្ព័ន្ធ UI ជា `markImmediate` (`core/store.ts`)។ វាស់បាន ៖ បើអត់
 *    `duplicate-scan` មិនឃើញប្រអប់បើក · `page-nav` មិនឃើញរបា Slide · `history-menu`
 *    ម៉ឺនុយមិនបិទក្នុង tick ដដែល · `ios-panel-glide` snap មិនត្រឡប់។
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { uiState } from '../../src/core/state';
import { closeModal, openModalHelper } from '../../src/ui/modal';
import { closeSideDrawer, openSideDrawer } from '../../src/ui/page-nav';
import { closeGlobalMoreMenu } from '../../src/ui/more-menu';
import { endPanelGlideSnapPause } from '../../src/app/behaviors/panel-motion';
import { GlobalMoreMenu } from '../../src/app/components/GlobalMoreMenu';
import { SideDrawer } from '../../src/app/components/SideDrawer';
import { PhoneModal } from '../../src/app/components/modals/PhoneModal';
import { AppPages } from '../../src/app/components/AppPages';
import '../../src/app/flush';
import { byId, mount, step, unmount } from './react-harness';

beforeEach(() => {
    step(() => {
        uiState.modalDisplay = {};
        uiState.drawerOpen = false;
        uiState.moreMenuOpen = false;
        uiState.panelGliding = false;
    });
    mount(<><GlobalMoreMenu /><SideDrawer /><PhoneModal /><AppPages /></>);
});

afterEach(() => { unmount(); document.body.innerHTML = ''; });

/** រត់ `fn` រួចអាន DOM **ក្នុងការហៅដដែល** (មុន microtask ណាមួយ) */
function sameTick<T>(fn: () => void, read: () => T): T {
    let seen!: T;
    step(() => { fn(); seen = read(); });
    return seen;
}

describe('រចនាសម្ព័ន្ធ UI ចុះ DOM ក្នុង tick ដដែល', () => {
    it('ប្រអប់ ៖ បើក/បិទ', () => {
        expect(sameTick(() => openModalHelper('phoneModal'), () => byId('phoneModal').style.display)).toBe('flex');
        expect(sameTick(() => closeModal('phoneModal'), () => byId('phoneModal').style.display)).toBe('none');
    });

    it('របា Slide ៖ បើក/បិទ', () => {
        expect(sameTick(() => openSideDrawer(), () => byId('sideDrawer').classList.contains('open'))).toBe(true);
        expect(sameTick(() => closeSideDrawer(), () => byId('sideDrawer').classList.contains('open'))).toBe(false);
    });

    it('ម៉ឺនុយ (...) ៖ បិទ', () => {
        step(() => { uiState.moreMenuOpen = true; });
        expect(sameTick(() => closeGlobalMoreMenu(), () => byId('globalMoreMenu').classList.contains('show'))).toBe(false);
    });

    it('ចលនាផ្ទាំង ៖ ដក `panel-gliding`', () => {
        step(() => { uiState.panelGliding = true; });
        expect(byId('appPages').classList.contains('panel-gliding')).toBe(true);
        expect(sameTick(() => endPanelGlideSnapPause(), () => byId('appPages').classList.contains('panel-gliding'))).toBe(false);
    });
});
