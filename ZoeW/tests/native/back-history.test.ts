/**
 * ⛔ ប្រវត្តិថយក្រោយរបស់ Android ៖ Back ត្រឡប់ម្តងមួយជំហាន · មិនត្រឡប់ចូល
 *    របៀប «ដក» (ដកលុយ) · ទំហំមានពិដាន · ការត្រឡប់ខ្លួនវាមិនបង្កើតធាតុថ្មី។
 */
import { describe, expect, it } from 'vitest';
import { BACK_HISTORY_LIMIT, createBackHistory, screenOf, type Screen } from '../../src/app/lifecycle/back-history';

function harness() {
    const state = { currentAppPage: 'data', entryScanMode: 'parcel' };
    const history = createBackHistory(() => screenOf(state));
    const go = (page: string, mode?: string) => {
        state.currentAppPage = page;
        if (mode) state.entryScanMode = mode;
        history.observe();
    };
    const back = (): Screen | null => {
        const t = history.popTarget();
        if (t) { state.currentAppPage = t.page; if (t.mode) state.entryScanMode = t.mode; history.observe(); }
        return t;
    };
    return { state, history, go, back };
}

describe('back-history', () => {
    it('ត្រឡប់ម្តងមួយជំហាន ៖ data ➜ entry/parcel ➜ entry/locker ➜ data', () => {
        const h = harness();
        h.go('entry');
        h.go('entry', 'locker');
        h.go('data');
        expect(h.back()).toEqual({ page: 'entry', mode: 'locker' });
        expect(h.back()).toEqual({ page: 'entry', mode: 'parcel' });
        expect(h.back()).toEqual({ page: 'data', mode: null });
        expect(h.back()).toBeNull();
    });

    it('⛔ មិនត្រឡប់ចូលរបៀប «ដក» ➜ «កញ្ចប់» · ធាតុស្ទួនរំលង', () => {
        const h = harness();
        h.go('entry');
        h.go('entry', 'remove');
        h.go('data');
        expect(h.back()).toEqual({ page: 'entry', mode: 'parcel' });
        expect(h.back()).toEqual({ page: 'data', mode: null });
    });

    it('ការសង្កេតដែលគ្មានការប្រែ មិនបង្កើតធាតុ (របៀបលើទំព័រទិន្នន័យមិនរាប់)', () => {
        const h = harness();
        h.history.observe();
        h.state.entryScanMode = 'locker';
        h.history.observe();
        expect(h.history.size()).toBe(0);
    });

    it('ការសង្កេតដែលខកខាន (microtask មិនទាន់រត់) ត្រូវចាប់នៅ popTarget', () => {
        const h = harness();
        h.state.currentAppPage = 'entry';
        expect(h.history.popTarget()).toEqual({ page: 'data', mode: null });
    });

    it('ទំហំមានពិដាន', () => {
        const h = harness();
        for (let i = 0; i < BACK_HISTORY_LIMIT * 3; i++) h.go(i % 2 ? 'data' : 'entry');
        expect(h.history.size()).toBe(BACK_HISTORY_LIMIT);
    });
});
