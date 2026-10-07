/**
 * ⛔ បើក modal · ម៉ឺនុយ ☰ · ផ្ទាំង 🔔 មិនប្តូរស្ថានភាពរបា Tab (សំណើម្ចាស់គម្រោង ៖ «APK រមូរដល់ចុង កញ្ចប់ច្រើន ចុចបើកធុងសំរាម ឬបញ្ជី ZTO
 *    អាក់អាក់» · «កែម៉ឺនុយ ☰ ដែរ»)
 *    ការបង្ហាញ/លាក់របាប្តូរ `clip-path` និង `padding-bottom` របស់បញ្ជីប្រវត្តិ (ផ្លូវ Android) ➜ គូរបញ្ជីទាំងមូលឡើងវិញ (៦០០ ជួរ ≈ ១០០ms+
 *    ក្រោម CPU ថយ ៤ ដង)។ modal (z-index 1000) និង backdrop ម៉ឺនុយ (1200) គ្របរបា (900) ➜ របានៅដដែលពេលវាបើក ហើយការរមូរ **ក្នុង**
 *    modal/ម៉ឺនុយមិនបញ្ជារបា ·
 *    ការលាក់តាមទិសរមូរ (ចុះ ➜ លាក់ · ឡើង ➜ បង្ហាញ) មិនប្រែ។
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { uiState } from '../src/core/state';
import { refTo } from '../src/app/refs';
import { setupChromeAutoHide } from '../src/app/behaviors/chrome-autohide';
import { closeModal, openModalHelper } from '../src/ui/modal';
import { openModalIds } from '../src/core/modals';
import { closeSideDrawer, isSideDrawerOpen, openSideDrawer, switchAppPage } from '../src/ui/page-nav';

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function fakeScroller(parent: HTMLElement) {
    const el = document.createElement('div');
    el.style.overflowY = 'auto';
    let top = 0;
    Object.defineProperty(el, 'scrollHeight', { configurable: true, get: () => 5000 });
    Object.defineProperty(el, 'clientHeight', { configurable: true, get: () => 600 });
    Object.defineProperty(el, 'scrollTop', { configurable: true, get: () => top, set: (v) => { top = v; } });
    parent.appendChild(el);
    return el;
}

async function scrollTo(el: HTMLElement, top: number) {
    el.scrollTop = top;
    el.dispatchEvent(new Event('scroll'));
    await wait(40);
}

let pages: HTMLElement;
let list: HTMLElement;
let modalList: HTMLElement;
let drawerList: HTMLElement;

async function hideByScrolling() {
    await scrollTo(list, 100);
    await scrollTo(list, 200);
    await scrollTo(list, 400);
    expect(uiState.chromeHidden).toBe(true);
}

describe('modal ↔ របា Tab', () => {
    beforeAll(() => {
        Object.defineProperty(window, 'innerWidth', { configurable: true, value: 412 });
        pages = document.createElement('div');
        const navbar = document.createElement('nav');
        const tabbar = document.createElement('div');
        document.body.append(navbar, pages, tabbar);
        refTo('appPages')(pages);
        refTo('navbar')(navbar);
        refTo('pageTabBar')(tabbar);
        list = fakeScroller(pages);
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'recentlyDeletedModal';
        document.body.appendChild(modal);
        modalList = fakeScroller(modal);
        const drawer = document.createElement('aside');
        drawer.className = 'side-drawer side-drawer-right';
        document.body.appendChild(drawer);
        drawerList = fakeScroller(drawer);
        setupChromeAutoHide();
    });

    afterEach(async () => {
        closeModal('recentlyDeletedModal');
        expect(openModalIds()).toEqual([]);
        closeSideDrawer();
        expect(isSideDrawerOpen()).toBe(false);
        await scrollTo(list, 0);
        uiState.chromeHidden = false;
    });

    it('លក្ខខណ្ឌចាំបាច់ ៖ រមូរចុះ ➜ លាក់ · រមូរឡើង ➜ បង្ហាញ (ការលាក់តាមទិសរមូរនៅដដែល)', async () => {
        await hideByScrolling();
        await scrollTo(list, 300);
        expect(uiState.chromeHidden).toBe(false);
    });

    it('⛔ បើក modal ពេលរបាលាក់ ➜ របានៅលាក់ (គ្មានការគូរបញ្ជីឡើងវិញ)', async () => {
        await hideByScrolling();
        openModalHelper('recentlyDeletedModal');
        expect(uiState.isModalOpen).toBe(true);
        expect(uiState.chromeHidden).toBe(true);
    });

    it('⛔ រមូរក្នុង modal (ទាំងនៅកំពូល) មិនបង្ហាញ/លាក់របា', async () => {
        await hideByScrolling();
        openModalHelper('recentlyDeletedModal');
        await scrollTo(modalList, 300);
        await scrollTo(modalList, 0);
        expect(uiState.chromeHidden).toBe(true);
    });

    it('បិទ modal ➜ ស្ថានភាពដដែល · រមូរបញ្ជីឡើង ➜ បង្ហាញភ្លាម (ការរមូរក្នុង modal មិនផ្តាច់ការតាមដានបញ្ជី)', async () => {
        await hideByScrolling();
        openModalHelper('recentlyDeletedModal');
        await scrollTo(modalList, 500);
        closeModal('recentlyDeletedModal');
        expect(uiState.isModalOpen).toBe(false);
        expect(uiState.chromeHidden).toBe(true);
        await scrollTo(list, 300);
        expect(uiState.chromeHidden).toBe(false);
    });

    it('ផ្លូវចេញ ៖ បញ្ជីត្រឡប់ដល់កំពូលខណៈ modal បើក (ទិន្នន័យរួញ) ➜ បង្ហាញ', async () => {
        await hideByScrolling();
        openModalHelper('recentlyDeletedModal');
        await scrollTo(list, 0);
        expect(uiState.chromeHidden).toBe(false);
    });

    it('ទិសផ្ទុយ ៖ modal បើក ➜ ការរមូរបញ្ជីចុះមិនលាក់របា', async () => {
        openModalHelper('recentlyDeletedModal');
        await scrollTo(list, 100);
        await scrollTo(list, 200);
        await scrollTo(list, 400);
        expect(uiState.chromeHidden).toBe(false);
    });

    it('⛔ បើកម៉ឺនុយ ☰ ពេលរបាលាក់ ➜ របានៅលាក់ · រមូរក្នុងម៉ឺនុយមិនបញ្ជារបា · បិទ ➜ ដដែល', async () => {
        await hideByScrolling();
        openSideDrawer();
        expect(isSideDrawerOpen()).toBe(true);
        expect(uiState.chromeHidden).toBe(true);
        await scrollTo(drawerList, 300);
        await scrollTo(drawerList, 0);
        expect(uiState.chromeHidden).toBe(true);
        closeSideDrawer();
        expect(uiState.chromeHidden).toBe(true);
        await scrollTo(list, 300);
        expect(uiState.chromeHidden).toBe(false);
    });

    it('⛔ ផ្ទាំង 🔔 បើក ➜ រមូរក្នុងផ្ទាំងមិនបង្ហាញរបា', async () => {
        await hideByScrolling();
        uiState.notifyDrawerOpen = true;
        await scrollTo(drawerList, 300);
        await scrollTo(drawerList, 0);
        expect(uiState.chromeHidden).toBe(true);
    });

    it('ម៉ឺនុយបើក ៖ បញ្ជីត្រឡប់ដល់កំពូល ➜ បង្ហាញ (ផ្លូវចេញ) · ទិសផ្ទុយ ៖ រមូរបញ្ជីចុះមិនលាក់', async () => {
        await hideByScrolling();
        openSideDrawer();
        await scrollTo(list, 0);
        expect(uiState.chromeHidden).toBe(false);
        await scrollTo(list, 100);
        await scrollTo(list, 200);
        await scrollTo(list, 400);
        expect(uiState.chromeHidden).toBe(false);
    });

    it('ការប្តូរទំព័រនៅបង្ហាញរបា (មិនប្រែ)', async () => {
        await hideByScrolling();
        switchAppPage('entry');
        expect(uiState.chromeHidden).toBe(false);
        switchAppPage('data');
    });
});
