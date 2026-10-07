/**
 * ⛔ ម៉ឺនុយ (…) ↔ `scroll` (របាយការណ៍ម្ចាស់គម្រោង ៖ PWA «ពេល list កំពុងរមូរ ចុច (…) របស់ប្រអប់ប្រវត្តិអត់បាន»)
 *    មុននេះ `scroll` ណាមួយបិទម៉ឺនុយ ➜ momentum ដែលបន្តពីការអូសមុនបើក (គ្មាន input ថ្មី) បិទម៉ឺនុយភ្លាមក្រោយវាបើក។ ឥឡូវ
 *    `moreMenuScrollDismisses()` ៖ រមូរក្នុងម៉ឺនុយ ➜ មិនបិទ · ធាតុដែលរមូរផ្ទុកប៊ូតុង (…) (ប៊ូតុងរំកិល) ឬប៊ូតុងបាត់ពី DOM ➜ បិទ ·
 *    ធាតុផ្សេង ➜ បិទតែពេលមាន input (pointerdown · wheel · keydown) **ក្រោយ** ម៉ឺនុយបើក · បិទម៉ឺនុយ ➜ លែងចងប៊ូតុង (គ្មានសំណល់ DOM)។
 */
import { afterEach, describe, expect, it } from 'vitest';
import { MORE_MENU_WHEEL_GAP_MS, moreMenuScrollDismisses, noteMoreMenuInput } from '../src/app/lifecycle/layers';
import { refTo } from '../src/app/refs';
import { closeGlobalMoreMenu, moreMenuAnchor, showGlobalMoreMenu } from '../src/ui/more-menu';

function setup() {
    const card = document.createElement('div');
    const header = document.createElement('button');
    const table = document.createElement('div');
    const rowBtn = document.createElement('button');
    table.appendChild(rowBtn);
    card.append(header, table);
    document.body.appendChild(card);
    return { card, header, table, rowBtn };
}

describe('ម៉ឺនុយ (…) ↔ scroll', () => {
    afterEach(() => { closeGlobalMoreMenu(); document.body.innerHTML = ''; });

    it('momentum តារាងក្រោយបើក (គ្មាន input ថ្មី) ➜ ម៉ឺនុយក្បាលប្រអប់នៅបើក · input ថ្មី ➜ បិទ', () => {
        const { header, table } = setup();
        noteMoreMenuInput();
        showGlobalMoreMenu(header, null, []);
        expect(moreMenuScrollDismisses(table)).toBe(false);
        noteMoreMenuInput();
        expect(moreMenuScrollDismisses(table)).toBe(true);
    });

    it('ធាតុដែលរមូរផ្ទុកប៊ូតុង (…) ➜ បិទ · document ➜ បិទ · ប៊ូតុងបាត់ពី DOM ➜ បិទ', () => {
        const { card, header, table, rowBtn } = setup();
        showGlobalMoreMenu(rowBtn, null, []);
        expect(moreMenuScrollDismisses(table)).toBe(true);
        showGlobalMoreMenu(header, null, []);
        expect(moreMenuScrollDismisses(card)).toBe(true);
        expect(moreMenuScrollDismisses(document)).toBe(true);
        header.remove();
        expect(moreMenuScrollDismisses(table)).toBe(true);
    });

    it('ចុចក្នុងម៉ឺនុយ ឬលើប៊ូតុង (…) ពេល momentum នៅបន្ត ➜ មិនរាប់ជា input ថ្មី (ធាតុម៉ឺនុយដំណើរការ)', () => {
        const { header, table } = setup();
        const menu = document.createElement('div');
        const item = document.createElement('button');
        menu.appendChild(item);
        document.body.appendChild(menu);
        refTo('globalMoreMenu')(menu);
        showGlobalMoreMenu(header, null, []);
        noteMoreMenuInput({ type: 'pointerdown', target: item } as unknown as Event);
        noteMoreMenuInput({ type: 'pointerdown', target: header } as unknown as Event);
        expect(moreMenuScrollDismisses(table)).toBe(false);
        noteMoreMenuInput({ type: 'pointerdown', target: table } as unknown as Event);
        expect(moreMenuScrollDismisses(table)).toBe(true);
        refTo('globalMoreMenu')(null);
    });

    it('wheel inertia ដែលបន្តពីមុនបើក ➜ មិនរាប់ · wheel ថ្មី (ក្រោយគម្លាត) ➜ រាប់', async () => {
        const { header, table } = setup();
        const wheel = () => noteMoreMenuInput({ type: 'wheel', target: table } as unknown as Event);
        wheel();
        showGlobalMoreMenu(header, null, []);
        wheel();
        wheel();
        expect(moreMenuScrollDismisses(table)).toBe(false);
        await new Promise((r) => setTimeout(r, MORE_MENU_WHEEL_GAP_MS + 40));
        wheel();
        expect(moreMenuScrollDismisses(table)).toBe(true);
    });

    it('បិទម៉ឺនុយ ➜ លែងចងប៊ូតុង', () => {
        const { header } = setup();
        showGlobalMoreMenu(header, null, []);
        expect(moreMenuAnchor()).toBe(header);
        closeGlobalMoreMenu();
        expect(moreMenuAnchor()).toBe(null);
    });
});
