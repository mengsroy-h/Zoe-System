/**
 * ⛔ វីដេអូម្ចាស់គម្រោង (iPhone PWA · PR #317) ៖ ស្វែងរកលេខ ➜ បិទ keyboard ➜ ប្រអប់ស្វែងរករអិល **ឡើង** ទៅលាក់ក្រោម navbar ~១ វិ. ➜ លោតត្រឡប់ (ស៊ុម ៨.៩–៩.៩ វិ.)។
 *    មូលហេតុ (ប្រភព WebKit ពិត ៖ ScrollSnapAnimatorState::resnapAfterLayout · ScrollableArea::resnapAfterLayout · LocalFrameView::performPostLayoutTasks) ៖
 *    `.page-main` ជាគោលដៅ snap តែមួយ (`scroll-snap-align: start`) · ខណៈប្រអប់ទាញឡើង `#appPages` គ្មានចន្លោះរមូរ ➜ offset របស់ `.page-main` = ០ = ទីតាំងបច្ចុប្បន្ន
 *    ➜ WebKit កត់ `.page-main` ជាប្រអប់ដែល snap ➜ ទាញចុះ ➜ layout ថ្មី ➜ re-snap តាមប្រអប់ដែលកត់ ➜ `scrollTop` = offset ថ្មីរបស់ `.page-main` (ប្រអប់ស្វែងរកលាក់)
 *    ក្នុង layout ដំបូងក្រោយ commit (សមកាល) ➜ ការពិនិត្យ «microtask ដដែល» មុន commit ឃើញ ០ ➜ មិនធ្វើអ្វី ➜ ការរអិលទៅទីតាំង re-snap ➜ ការពិនិត្យយឺតលោត។
 * ⛔ ច្បាប់ ៖ ផ្អាក snap (`panel-gliding` ➜ `scroll-snap-type: none` ➜ WebKit លុប snap state) **មុន** React commit ការទាញចុះ ➜ គ្មាន re-snap ·
 *    ការរអិលពីទីតាំងចាស់ចុះទៅទីតាំងពិត · snap ត្រឡប់មកវិញនៅ ០ ➜ state ថ្មីជ្រើសគោលដៅជិតបំផុត (proximity ០.៣ snapport) ➜ គ្មាន ➜ នៅ ០។
 *    គំរូ WebKit ខាងក្រោមលើ DOM ដែល React ពិតគូរ (AppPages · PageData) · លំដាប់ commit ពិត (field immediate · មិនមែន act)។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { uiState } from '../src/core/state';
import { AppPages } from '../src/app/components/AppPages';
import '../src/app/flush';
import { elementOf } from '../src/app/refs';
import { endPanelGlideSnapPause, PANEL_GLIDE_HOLD_MAX_MS, PANEL_GLIDE_SNAP_GRACE_MS, PANEL_SEARCH_GLIDE_MS } from '../src/app/behaviors/panel-motion';
import { glidePhoneSearchPulledUp } from '../src/app/behaviors/phone-search';
import * as iosViewport from '../src/app/behaviors/ios-viewport';
import { byId, mount, unmount } from './native/react-harness';

const NAV_BOTTOM = 60;
const PADDING = 68;
const DAILY_CARD = 340;
const SEARCH_CARD = 110;
const SNAPPORT = 700;
const PROXIMITY = 0.3 * SNAPPORT;
const realInnerWidth = window.innerWidth;
const disposers: Array<() => void> = [];
const listeners: Array<[EventTarget, string, any, any]> = [];
let anims: Array<{ el: Element; keyframes: any[]; end: () => void; playState: string }>;

function scope() {
    return {
        disposed: false,
        listen(target: EventTarget | null | undefined, type: string, handler: any, options?: any) {
            if (!target) return;
            target.addEventListener(type, handler, options);
            listeners.push([target, type, handler, options]);
        },
        every() {}, onLoad() {}, onDispose(fn: () => void) { disposers.push(fn); }, dispose() {}
    } as any;
}

function setIOSStandalone(on: boolean) {
    Object.defineProperty(window.navigator, 'standalone', { configurable: true, value: on ? true : undefined });
    Object.defineProperty(window, 'CSS', { configurable: true, value: { supports: (p: string, v: string) => on && p === '-webkit-touch-callout' && v === 'none' } });
}

function rect(top: number, height: number) {
    return { top, bottom: top + height, left: 0, right: 390, width: 390, height, x: 0, y: top, toJSON() {} } as DOMRect;
}

function webkitSnapModel() {
    const pages = byId('appPages');
    const side = byId('dataSideSection');
    const card = elementOf<HTMLElement>('dataSearchCard')!;
    const main = byId('dataMainSection');
    const m = { st: 0, state: false, snapMain: false, resnaps: 0, appWrites: 0 };
    const pulled = () => side.classList.contains('search-focus');
    const snapOn = () => !pages.classList.contains('panel-gliding');
    const mainOffset = () => (pulled() ? 0 : DAILY_CARD + SEARCH_CARD);
    const maxScroll = () => (pulled() ? 0 : 600);
    const near = (st: number) => Math.abs(mainOffset() - st) <= PROXIMITY;
    const layout = () => {
        m.st = Math.min(Math.max(0, m.st), maxScroll());
        if (!snapOn()) { m.state = false; m.snapMain = false; return; }
        if (!m.state) { m.state = true; m.snapMain = near(m.st); }
        else if (!m.snapMain) m.snapMain = near(m.st);
        if (m.snapMain && m.st !== mainOffset()) { m.st = mainOffset(); m.resnaps++; }
    };
    Object.defineProperty(pages, 'scrollTop', {
        configurable: true,
        get() { layout(); return m.st; },
        set(v: number) {
            layout();
            m.appWrites++;
            m.st = Math.min(Math.max(0, Number(v) || 0), maxScroll());
            if (m.state) m.snapMain = near(m.st);
        }
    });
    const cardTop = () => PADDING + (pulled() ? 0 : DAILY_CARD) - m.st;
    card.getBoundingClientRect = () => { layout(); return rect(cardTop(), SEARCH_CARD); };
    main.getBoundingClientRect = () => { layout(); return rect(PADDING + (pulled() ? SEARCH_CARD : DAILY_CARD + SEARCH_CARD) - m.st, 600); };
    return { m, layout, card, cardTop: () => { layout(); return cardTop(); } };
}

async function finishGlides() {
    anims.splice(0).forEach((a) => a.end());
    for (let i = 0; i < 4; i++) await Promise.resolve();
    vi.advanceTimersByTime(PANEL_SEARCH_GLIDE_MS + PANEL_GLIDE_HOLD_MAX_MS + PANEL_GLIDE_SNAP_GRACE_MS + 10);
}

function glideDelta(el: Element) {
    const mine = anims.filter((a) => a.el === el);
    const last = mine[mine.length - 1];
    if (!last) return null;
    const match = /translate3d\(0,\s*(-?[\d.]+)px/.exec(last.keyframes[0].transform);
    return match ? Number(match[1]) : null;
}

async function pullUpAndSettle(model: ReturnType<typeof webkitSnapModel>) {
    glidePhoneSearchPulledUp(true);
    await finishGlides();
    model.layout();
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', () => 0);
    setIOSStandalone(true);
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 390 });
    anims = [];
    (Element.prototype as any).animate = function (keyframes: any[]) {
        let done: () => void = () => {};
        let fail: (e: Error) => void = () => {};
        const a = {
            el: this as Element, keyframes, playState: 'running',
            finished: new Promise<void>((r, j) => { done = r; fail = j; }),
            pause() { a.playState = 'paused'; },
            play() { a.playState = 'running'; },
            cancel() { a.playState = 'idle'; fail(new Error('AbortError')); },
            end() { if (a.playState === 'idle') return; a.playState = 'finished'; done(); }
        };
        a.finished.catch(() => {});
        anims.push(a);
        return a;
    };
    uiState.dataPanelSearchFocus = false;
    mount(<AppPages />);
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = false;
});

afterEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    disposers.splice(0).forEach((fn) => fn());
    listeners.splice(0).forEach(([t, type, h, o]) => t.removeEventListener(type, h, o));
    endPanelGlideSnapPause();
    uiState.dataPanelSearchFocus = false;
    unmount();
    delete (Element.prototype as any).animate;
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: realInnerWidth });
    setIOSStandalone(false);
    vi.unstubAllGlobals();
    vi.useRealTimers();
});

describe('iPhone PWA ៖ បិទ keyboard ក្រោយស្វែងរក ➜ WebKit មិន re-snap ទៅ .page-main (ប្រអប់ស្វែងរកនៅឃើញ)', () => {
    it('គំរូអាចធ្លាក់ ៖ គ្មានការផ្អាក snap មុន commit (ចាប់ ios-viewport ចេញ) ➜ re-snap ➜ ប្រអប់ស្វែងរករអិលឡើងលាក់ក្រោម navbar (ដូចវីដេអូ)', async () => {
        const model = webkitSnapModel();
        await pullUpAndSettle(model);
        expect(model.m.snapMain).toBe(true);
        glidePhoneSearchPulledUp(false);
        expect(model.m.resnaps).toBeGreaterThan(0);
        expect(model.cardTop()).toBeLessThan(NAV_BOTTOM);
        expect(glideDelta(model.card)).toBeGreaterThan(0);
    });

    it('⛔ ទាញចុះ ➜ snap ផ្អាកមុន commit ➜ គ្មាន re-snap · scrollTop ០ · ការរអិលពីលើចុះទៅទីតាំងពិត · ប្រអប់ស្វែងរកឃើញពេញ', async () => {
        const model = webkitSnapModel();
        iosViewport.listenIOSKeyboard(scope());
        await pullUpAndSettle(model);
        expect(model.m.snapMain).toBe(true);
        const before = model.cardTop();
        expect(before).toBeGreaterThanOrEqual(NAV_BOTTOM);
        glidePhoneSearchPulledUp(false);
        expect(byId('appPages').classList.contains('panel-gliding')).toBe(true);
        expect(model.m.resnaps).toBe(0);
        expect(byId('appPages').scrollTop).toBe(0);
        expect(model.cardTop()).toBe(PADDING + DAILY_CARD);
        expect(glideDelta(model.card)).toBe(before - (PADDING + DAILY_CARD));
        expect(glideDelta(model.card)!).toBeLessThan(0);
    });

    it('⛔ ក្រោយការរអិល · snap ត្រឡប់មកវិញ · ការពិនិត្យយឺត ➜ នៅ ០ ដដែល (គ្មានការលោត · App មិនសរសេរ scroll)', async () => {
        const model = webkitSnapModel();
        iosViewport.listenIOSKeyboard(scope());
        await pullUpAndSettle(model);
        glidePhoneSearchPulledUp(false);
        await finishGlides();
        expect(byId('appPages').classList.contains('panel-gliding')).toBe(false);
        model.layout();
        expect(model.m.state).toBe(true);
        expect(model.m.snapMain).toBe(false);
        vi.advanceTimersByTime(iosViewport.IOS_SEARCH_PULLDOWN_SETTLE_MS);
        model.layout();
        expect(model.m.st).toBe(0);
        expect(model.m.resnaps).toBe(0);
        expect(model.m.appWrites).toBe(0);
        expect(model.cardTop()).toBeGreaterThanOrEqual(NAV_BOTTOM);
    });

    it('ទិសផ្ទុយ ៖ ទាញឡើងម្តងទៀតក្រោយទាញចុះ ➜ ប្រអប់ស្វែងរកឡើងលើ (ការរអិលឡើង) · ទាញចុះម្តងទៀត ➜ គ្មាន re-snap', async () => {
        const model = webkitSnapModel();
        iosViewport.listenIOSKeyboard(scope());
        await pullUpAndSettle(model);
        glidePhoneSearchPulledUp(false);
        await finishGlides();
        glidePhoneSearchPulledUp(true);
        expect(glideDelta(model.card)!).toBeGreaterThan(0);
        expect(model.cardTop()).toBe(PADDING);
        await finishGlides();
        model.layout();
        glidePhoneSearchPulledUp(false);
        expect(model.m.resnaps).toBe(0);
        expect(model.cardTop()).toBe(PADDING + DAILY_CARD);
    });
});
