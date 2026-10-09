/**
 * ⛔ សំណើម្ចាស់គម្រោង (វីដេអូ APK · PWA Android · PWA iPhone) ៖ «phone suggestion glitch អត់រលូនតាមប្រអប់ស្វែងរកសោះ · keyboard ដូច glitch
 *    បន្តិច · tab ស្កេន ពេល keyboard ឡើងពេញរួច ទើបប្រអប់កញ្ចប់ដែលបានបញ្ចូលថ្ងៃនេះ ឡើងមកឈរពីលើ keyboard តាមក្រោយ»។
 *    វាស់ពីវីដេអូ ៖ (១) ប្រអប់ suggestion នៅទីតាំងចាស់ ~១២០ms (រហូត timer 180ms) ទើបលោត · (២) iPhone ៖ ស៊ុមដំបូងដែលមើលឃើញក្រោយចុច
 *    នៅ ~៩០% នៃចលនា (ខ្សែកោង ease-out ខ្លាំង + ~៨០ms ដែល iOS មិនបង្ហាញស៊ុមពេលរៀបចំ keyboard ➜ មើលទៅដូចលោត) · (៣) tab ស្កេន ៖
 *    សារ «មិនទាន់មាន…» ឈរចុងកាត ➜ កាតខ្លីពេល WebView/Chrome បង្រួមក្រោយ keyboard ➜ សារលោតឡើងតាមក្រោយ។
 * ⛔ ច្បាប់ ៖ ចលនាស្វែងរក (`PANEL_SEARCH_GLIDE`) ចាប់ផ្តើមនៅទីតាំងចាស់ ហើយរង់ចាំស៊ុមហូរ (២ ស៊ុមជាប់គ្នា ≤ `PANEL_GLIDE_FLOW_FRAME_MS`
 *    · ពិដាន `PANEL_GLIDE_HOLD_MAX_MS`) ទើបរត់ · ប្រអប់ suggestion ធ្លាក់ចុះតែពេល glide ចប់ពិត (`settled()` ៖ សំណើបន្ថែម «អោយ suggestion ធ្លាក់មកពេលប្រអប់ស្វែងរកទៅដល់លើរួចរាល់»)
 *    · glide ថ្មីលើធាតុដដែល
 *    បោះបង់ glide ចាស់ · glide អូស/handle (គ្មាន motion) មិនប្រែ · tab ស្កេន ៖ ការស្វែងរកពេលផ្ទាំងបង្រួម ➜ `entrySearchActive`។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { uiState } from '../src/core/state';
import { refTo } from '../src/app/refs';
import {
    PANEL_GLIDE_EASING, PANEL_GLIDE_FLOW_FRAME_MS, PANEL_GLIDE_HOLD_MAX_MS, PANEL_GLIDE_MS, PANEL_SEARCH_GLIDE,
    endPanelGlideSnapPause, panelGlideFrom, stopPanelGlide
} from '../src/app/behaviors/panel-motion';
import * as entrySearch from '../src/app/behaviors/entry-search';

type FakeAnim = {
    keyframes: any[]; timing: any; playState: string; startTime: number | null; currentTime: number | null;
    paused: number; played: number; cancelled: number; finished: Promise<void>;
    pause(): void; play(): void; cancel(): void; end(): void;
};

let frames: Array<(t: number) => void>;
let pages: HTMLElement;
const realInnerWidth = window.innerWidth;

function element(top: number) {
    const el = document.createElement('div');
    const anims: FakeAnim[] = [];
    (el as any).getBoundingClientRect = () => ({ top, bottom: top + 40, left: 0, right: 100, width: 100, height: 40 });
    (el as any).animate = (keyframes: any[], timing: any) => {
        let done: () => void = () => {};
        let fail: (e: Error) => void = () => {};
        const a: FakeAnim = {
            keyframes, timing, playState: 'running', startTime: null, currentTime: 0, paused: 0, played: 0, cancelled: 0,
            finished: new Promise<void>((r, j) => { done = r; fail = j; }),
            pause() { a.paused++; a.playState = 'paused'; },
            play() { a.played++; a.playState = 'running'; a.startTime = 5000; },
            cancel() { a.cancelled++; a.playState = 'idle'; fail(new Error('AbortError')); },
            end() { a.playState = 'finished'; done(); }
        };
        anims.push(a);
        return a;
    };
    return { el, anims };
}

function runFrame(t: number) {
    const due = frames.splice(0);
    due.forEach((fn) => fn(t));
}

beforeEach(() => {
    frames = [];
    vi.stubGlobal('requestAnimationFrame', (fn: (t: number) => void) => { frames.push(fn); return frames.length; });
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 390 });
    pages = document.createElement('div');
    document.body.appendChild(pages);
    refTo('appPages')(pages);
});

afterEach(() => {
    endPanelGlideSnapPause();
    refTo('appPages')(null);
    pages.remove();
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: realInnerWidth });
    vi.unstubAllGlobals();
    vi.useRealTimers();
});

describe('ចលនាស្វែងរក ៖ រង់ចាំស៊ុមហូរ · settled() ពេលចប់ពិត', () => {
    it('⛔ ចាប់ផ្តើមនៅទីតាំងចាស់ (pause) ➜ ស៊ុមកក ១៣០ms មិនរាប់ ➜ រត់តែពេល ២ ស៊ុមជាប់គ្នា ≤ ពិដានស៊ុម', () => {
        const { el, anims } = element(60);
        const glide = panelGlideFrom(el, 360, PANEL_SEARCH_GLIDE);
        expect(glide).not.toBeNull();
        expect(anims).toHaveLength(1);
        expect(anims[0].keyframes[0].transform).toBe('translate3d(0,300px,0)');
        expect(anims[0].timing).toEqual({ duration: PANEL_SEARCH_GLIDE.duration, easing: PANEL_SEARCH_GLIDE.easing });
        expect(anims[0].playState).toBe('paused');
        runFrame(1000);
        runFrame(1130);
        expect(anims[0].played).toBe(0);
        runFrame(1130 + PANEL_GLIDE_FLOW_FRAME_MS + 1);
        expect(anims[0].played).toBe(0);
        runFrame(1130 + PANEL_GLIDE_FLOW_FRAME_MS + 17);
        expect(anims[0].played).toBe(1);
        expect(anims[0].playState).toBe('running');
        expect(uiState.panelGliding).toBe(true);
    });

    it('⛔ គ្មានស៊ុមសោះ (ទំព័រលាក់) ➜ ពិដាន PANEL_GLIDE_HOLD_MAX_MS ដាក់ឲ្យរត់ (មិនជាប់នៅទីតាំងចាស់)', () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        const { el, anims } = element(60);
        panelGlideFrom(el, 360, PANEL_SEARCH_GLIDE);
        vi.advanceTimersByTime(PANEL_GLIDE_HOLD_MAX_MS - 1);
        expect(anims[0].played).toBe(0);
        vi.advanceTimersByTime(1);
        expect(anims[0].played).toBe(1);
        runFrame(9000);
        runFrame(9016);
        expect(anims[0].played).toBe(1);
    });

    it('⛔ settled() ៖ true ពេល glide ចប់ពិត · false ពេលត្រូវ glide ថ្មីជំនួស (ប្រអប់ suggestion ធ្លាក់តែក្រោយទៅដល់)', async () => {
        const first = element(60);
        const glide = panelGlideFrom(first.el, 360, PANEL_SEARCH_GLIDE)!;
        expect(glide.running()).toBe(true);
        runFrame(1000);
        runFrame(1016);
        first.anims[0].end();
        expect(glide.running()).toBe(false);
        await expect(glide.settled()).resolves.toBe(true);
        const second = element(60);
        const old = panelGlideFrom(second.el, 360, PANEL_SEARCH_GLIDE)!;
        panelGlideFrom(second.el, 200, PANEL_SEARCH_GLIDE);
        await expect(old.settled()).resolves.toBe(false);
        expect(old.running()).toBe(false);
        const third = element(60);
        const stopped = panelGlideFrom(third.el, 360, PANEL_SEARCH_GLIDE)!;
        stopPanelGlide(third.el);
        await expect(stopped.settled()).resolves.toBe(false);
    });

    it('⛔ glide ថ្មីលើធាតុដដែល ➜ បោះបង់ glide ចាស់ (transform មិនជាន់គ្នា) · glide ចាស់ដែលរង់ចាំមិនរត់ឡើងវិញ', () => {
        const { el, anims } = element(60);
        panelGlideFrom(el, 360, PANEL_SEARCH_GLIDE);
        panelGlideFrom(el, 200, PANEL_SEARCH_GLIDE);
        expect(anims).toHaveLength(2);
        expect(anims[0].cancelled).toBe(1);
        runFrame(1000);
        runFrame(1016);
        expect(anims[0].played).toBe(0);
        expect(anims[1].played).toBe(1);
    });

    it('ទិសផ្ទុយ ៖ glide អូស/handle (គ្មាន motion) នៅដដែល ៖ មិន pause · រយៈពេល/ខ្សែកោងដើម', () => {
        const { el, anims } = element(60);
        panelGlideFrom(el, 360);
        expect(anims[0].paused).toBe(0);
        expect(anims[0].timing).toEqual({ duration: PANEL_GLIDE_MS, easing: PANEL_GLIDE_EASING });
        expect(frames).toHaveLength(0);
    });
});

describe('tab ស្កេន ៖ ការស្វែងរកពេលផ្ទាំងបង្រួម ➜ entrySearchActive (សារទទេនៅក្រោមក្បាលតារាង)', () => {
    let side: HTMLElement;
    let main: HTMLElement;
    let input: HTMLInputElement;
    const disposers: Array<() => void> = [];
    beforeEach(() => {
        side = document.createElement('div');
        main = document.createElement('div');
        input = document.createElement('input');
        main.appendChild(input);
        pages.append(side, main);
        refTo('entrySideSection')(side);
        refTo('entryMainSection')(main);
        refTo('entryListSearchInput')(input);
        uiState.currentAppPage = 'entry';
        uiState.entryPanelCollapsed = false;
        entrySearch.listenEntrySearchPanel({ onDispose: (fn: () => void) => disposers.push(fn) } as any);
    });
    afterEach(() => {
        disposers.splice(0).forEach((fn) => fn());
        ['entrySideSection', 'entryMainSection', 'entryListSearchInput'].forEach((n: any) => refTo(n)(null));
        uiState.entryPanelCollapsed = false;
        uiState.entrySearchActive = false;
        uiState.currentAppPage = 'data';
    });

    it('⛔ focus បង្រួម ➜ active ក្នុង commit ដូចការបង្រួម · ផ្ទាំងបើកតាមផ្លូវណាក៏ដោយ ➜ active ត្រឡប់ false', async () => {
        entrySearch.entrySearchFocused();
        expect(uiState.entryPanelCollapsed).toBe(true);
        expect(uiState.entrySearchActive).toBe(true);
        await Promise.resolve();
        expect(uiState.entrySearchActive).toBe(true);
        uiState.entryPanelCollapsed = false;
        await Promise.resolve();
        await Promise.resolve();
        expect(uiState.entrySearchActive).toBe(false);
    });

    it('⛔ ផ្ទាំងបង្រួមដោយដៃមុន ➜ focus ធ្វើឲ្យ active តែចាកចេញមិនបើកផ្ទាំងវិញ (ច្បាប់ដើម)', () => {
        vi.useFakeTimers();
        uiState.entryPanelCollapsed = true;
        entrySearch.entrySearchFocused();
        expect(uiState.entrySearchActive).toBe(true);
        entrySearch.entrySearchBlurred();
        vi.advanceTimersByTime(200);
        expect(uiState.entryPanelCollapsed).toBe(true);
        expect(uiState.entrySearchActive).toBe(true);
    });
});
