/**
 * ⛔ «ស៊ុមកក» លើទូរស័ព្ទពិត ៖ APK និង PWA រត់ JavaScript ដដែល តែម្ចាស់គម្រោងឃើញ APK «អាក់» ខណៈ PWA រលូន។ ម៉ាស៊ីន audit វាស់ WebView
 *    លើទូរស័ព្ទមិនបាន ➜ App រាប់ស៊ុមដែលកក (`long-animation-frame` · ថយទៅ `longtask`) ក្នុង ៥ នាទីចុងក្រោយ ហើយបង្ហាញក្រោមលេខ Hz
 *    ក្នុងរបា Slide ➜ ប្រៀប APK ធៀប PWA លើទូរស័ព្ទដដែលដោយលេខ មិនមែនដោយអារម្មណ៍។
 * ⛔ ទិសផ្ទុយ ៖ browser ដែលវាស់មិនបាន (iPhone · គ្មាន PerformanceObserver · observe បោះ) ➜ គ្មានបន្ទាត់ (មិនរាយ «0 ដង» ក្លែង) ·
 *    buffer មានពិដាន · ស៊ុមចាស់ជាង ៥ នាទីមិនរាប់ · ការចាប់ផ្តើមម្តងគត់។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    JANK_BUFFER_MAX, JANK_WINDOW_MS, jankLabel, jankMonitor, jankSummary, noteJankEntries, pickJankEntryType,
    refreshJankText, startJankMonitor
} from '../../src/ui/perf';
import { closeSideDrawer, openSideDrawer } from '../../src/ui/page-nav';
import { viewState } from '../../src/core/view-state';
import { SideDrawer } from '../../src/app/components/SideDrawer';
import { mount, step, unmount } from './react-harness';

function resetMonitor() {
    jankMonitor.type = '';
    jankMonitor.started = false;
    jankMonitor.entries.length = 0;
}

function fakeObserver(supported: string[] | undefined, opts: { throwOnObserve?: boolean; throwOnNew?: boolean } = {}) {
    const made: Array<{ cb: (list: { getEntries(): unknown[] }) => void; observed: any }> = [];
    class FakeObserver {
        static supportedEntryTypes = supported;
        cb: (list: { getEntries(): unknown[] }) => void;
        constructor(cb: (list: { getEntries(): unknown[] }) => void) {
            if (opts.throwOnNew) throw new Error('no observer');
            this.cb = cb;
            made.push({ cb, observed: null });
        }
        observe(init: unknown) {
            if (opts.throwOnObserve) throw new Error('unsupported type');
            made[made.length - 1].observed = init;
        }
    }
    vi.stubGlobal('PerformanceObserver', FakeObserver);
    return {
        made,
        emit(entries: unknown[]) { made.forEach((m) => m.cb({ getEntries: () => entries })); }
    };
}

beforeEach(() => resetMonitor());

afterEach(() => {
    vi.unstubAllGlobals();
    resetMonitor();
    viewState.jankText = '';
    closeSideDrawer();
});

describe('pickJankEntryType', () => {
    it('ចូលចិត្ត long-animation-frame · ថយទៅ longtask · គ្មាន ➜ ទទេ', () => {
        expect(pickJankEntryType(['longtask', 'long-animation-frame', 'paint'])).toBe('long-animation-frame');
        expect(pickJankEntryType(['longtask', 'paint'])).toBe('longtask');
        expect(pickJankEntryType(['paint', 'resource'])).toBe('');
        expect(pickJankEntryType(undefined)).toBe('');
        expect(pickJankEntryType('long-animation-frame')).toBe('');
    });
});

describe('noteJankEntries ៖ buffer មានពិដាន · តម្លៃខូចមិនចូល', () => {
    it('រក្សាតែ JANK_BUFFER_MAX ចុងក្រោយ', () => {
        const many = Array.from({ length: JANK_BUFFER_MAX + 57 }, (_, i) => ({ startTime: i, duration: 60 + i }));
        noteJankEntries(many);
        expect(jankMonitor.entries.length).toBe(JANK_BUFFER_MAX);
        expect(jankMonitor.entries[0].at).toBe(57);
        expect(jankMonitor.entries[JANK_BUFFER_MAX - 1].ms).toBe(60 + JANK_BUFFER_MAX + 56);
    });

    it('duration ទទេ/អវិជ្ជមាន/NaN · startTime ខូច · មិនមែន array ➜ មិនចូល', () => {
        noteJankEntries([{ startTime: 1, duration: 0 }, { startTime: 2, duration: -5 }, { startTime: NaN, duration: 80 },
            { startTime: 3, duration: 'x' }, null, { startTime: 4, duration: 90 }]);
        expect(jankMonitor.entries).toEqual([{ at: 4, ms: 90 }]);
        noteJankEntries(null);
        noteJankEntries({ length: 3 });
        expect(jankMonitor.entries.length).toBe(1);
    });
});

describe('jankSummary ៖ តែ ៥ នាទីចុងក្រោយ', () => {
    it('រាប់ក្នុងបង្អួច · យូរបំផុត · ចាស់ជាងបង្អួច ឬអនាគត ➜ មិនរាប់', () => {
        const now = 1_000_000;
        const entries = [
            { at: now - JANK_WINDOW_MS - 1, ms: 900 },
            { at: now - JANK_WINDOW_MS, ms: 70 },
            { at: now - 1000, ms: 210 },
            { at: now, ms: 55 },
            { at: now + 5, ms: 800 }
        ];
        expect(jankSummary(entries, now, JANK_WINDOW_MS)).toEqual({ count: 3, maxMs: 210 });
        expect(jankSummary([], now, JANK_WINDOW_MS)).toEqual({ count: 0, maxMs: 0 });
        expect(jankSummary(undefined, now, JANK_WINDOW_MS)).toEqual({ count: 0, maxMs: 0 });
    });
});

describe('jankLabel', () => {
    it('វាស់មិនបាន ➜ ទទេ · 0 ដង ➜ គ្មាន «យូរបំផុត» · មាន ➜ បង្គត់ ms', () => {
        expect(jankLabel('', { count: 4, maxMs: 120 })).toBe('');
        expect(jankLabel('long-animation-frame', null)).toBe('');
        expect(jankLabel('long-animation-frame', { count: 0, maxMs: 0 })).toBe('ស៊ុមកក 5 នាទីចុងក្រោយ ៖ 0 ដង');
        expect(jankLabel('longtask', { count: 3, maxMs: 187.6 })).toBe('ស៊ុមកក 5 នាទីចុងក្រោយ ៖ 3 ដង · យូរបំផុត 188ms');
    });
});

describe('startJankMonitor ៖ fail-open', () => {
    it('គ្មាន PerformanceObserver (iPhone ចាស់) ➜ មិនបោះ · type ទទេ', () => {
        vi.stubGlobal('PerformanceObserver', undefined);
        expect(() => startJankMonitor()).not.toThrow();
        expect(jankMonitor.type).toBe('');
    });

    it('Safari (គ្មាន type ណាមួយ) ➜ មិនបង្កើត observer', () => {
        const fake = fakeObserver(['paint', 'navigation']);
        startJankMonitor();
        expect(fake.made.length).toBe(0);
        expect(jankMonitor.type).toBe('');
    });

    it('constructor ឬ observe បោះ ➜ មិនបោះ · type ទទេ', () => {
        fakeObserver(['long-animation-frame'], { throwOnNew: true });
        expect(() => startJankMonitor()).not.toThrow();
        expect(jankMonitor.type).toBe('');
        resetMonitor();
        fakeObserver(['long-animation-frame'], { throwOnObserve: true });
        expect(() => startJankMonitor()).not.toThrow();
        expect(jankMonitor.type).toBe('');
    });

    it('WebView ➜ observe long-animation-frame ដោយ buffered · ស៊ុមដែលមកដល់ចូល buffer · ហៅម្តងទៀតមិនបង្កើត observer ទី ២', () => {
        const fake = fakeObserver(['longtask', 'long-animation-frame']);
        startJankMonitor();
        startJankMonitor();
        expect(fake.made.length).toBe(1);
        expect(fake.made[0].observed).toEqual({ type: 'long-animation-frame', buffered: true });
        expect(jankMonitor.type).toBe('long-animation-frame');
        fake.emit([{ startTime: 10, duration: 95 }, { startTime: 20, duration: 140 }]);
        expect(jankMonitor.entries).toEqual([{ at: 10, ms: 95 }, { at: 20, ms: 140 }]);
    });

    it('callback ដែលទទួលបញ្ជីខូច ➜ មិនបោះចេញពី observer', () => {
        const fake = fakeObserver(['longtask']);
        startJankMonitor();
        expect(() => fake.made[0].cb({ getEntries: () => { throw new Error('gone'); } })).not.toThrow();
        expect(jankMonitor.entries.length).toBe(0);
    });
});

describe('refreshJankText ↔ SideDrawer ពិត', () => {
    it('បើករបា Slide ➜ រាប់ពី buffer ពិត ➜ បន្ទាត់ #jankLine លេចក្រោម Hz', () => {
        vi.stubGlobal('performance', { now: () => 50_000 });
        vi.stubGlobal('requestAnimationFrame', () => 1);
        const fake = fakeObserver(['long-animation-frame']);
        startJankMonitor();
        fake.emit([{ startTime: 40_000, duration: 64 }, { startTime: 45_000, duration: 233.4 }]);
        mount(<SideDrawer />);
        expect(document.getElementById('jankLine')).toBeNull();
        step(() => openSideDrawer());
        expect(document.getElementById('jankLine')!.textContent).toBe('ស៊ុមកក 5 នាទីចុងក្រោយ ៖ 2 ដង · យូរបំផុត 233ms');
        unmount();
    });

    it('iPhone (វាស់មិនបាន) ➜ គ្មានបន្ទាត់ ទោះបើករបា Slide', () => {
        vi.stubGlobal('performance', { now: () => 50_000 });
        vi.stubGlobal('requestAnimationFrame', () => 1);
        fakeObserver(['paint']);
        startJankMonitor();
        mount(<SideDrawer />);
        step(() => openSideDrawer());
        expect(viewState.jankText).toBe('');
        expect(document.getElementById('jankLine')).toBeNull();
        unmount();
    });

    it('performance.now បោះ ➜ មិនបង្ហាញលេខក្លែង', () => {
        vi.stubGlobal('performance', { now: () => { throw new Error('no clock'); } });
        jankMonitor.type = 'long-animation-frame';
        refreshJankText();
        expect(viewState.jankText).toBe('');
    });
});
