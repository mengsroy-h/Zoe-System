/**
 * Deep audit ជុំ ៥ (Toast និយាយការពិត) ៖ ការផ្ទៀងផ្ទាត់ ledger (`correctRevenueLedgerToActual`) ដែលចប់ **ក្រោយ** ការប្តូរវគ្គ/គម្រោង
 *   (ចាកចេញ · Reconfig) ត្រឡប់ `{ ok: false, stale: true }` — វាមិនបានវាស់អ្វីទេ (ច្បាប់ ៖ callback ចាស់មិនសរសេរក្រោយការប្តូរ) ➜
 *   អ្នកហៅ (កែស្ថិតិដោយដៃ · ដក barcode · ការសម្អាត) មិនត្រូវបង្ហាញ «⚠️ … មិនទាន់ Sync … សូមប្រាប់ Admin» ដល់វគ្គថ្មី
 *   ហើយមិនផ្ញើ Sentry `zone: 'money'` (ការជូនដំណឹងលុយក្លែង)។ ទិសផ្ទុយ ៖ វគ្គដដែល ➜ ✅/⚠️ ដូចដើម។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act as reactAct } from 'react';
import { dataState, firebaseState, uiState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import { correctRevenueLedgerToActual } from '../src/domain/ledger';
import { submitManualAdjustment } from '../src/features/stats-modals';
import { refTo, setFieldValue } from '../src/app/refs';

const DAY = '2026-10-07';
const zero = { cod: 0, dod: 0, count: 0 };
type Pending = { ref: any; fn: any; resolve: (v: any) => void };
let pending: Pending[];
let capture: ReturnType<typeof vi.fn>;
let host: HTMLElement;
let root: any;
const texts = () => uiState.toasts.map((t: any) => t.msg);
const flush = () => vi.advanceTimersByTimeAsync(0);

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((yes) => { resolve = yes; });
    return { promise, resolve };
}

function commitAll() {
    const batch = pending.splice(0);
    batch.forEach((p) => {
        const value = p.fn(null);
        p.resolve({ committed: true, snapshot: { val: () => value } });
    });
    return batch.length;
}

function switchSession() {
    firebaseState.authGeneration++;
}

beforeEach(() => {
    vi.useFakeTimers();
    pending = [];
    uiState.toasts = [];
    capture = vi.fn();
    (window as any).ZoeErrors = { capture };
    firebaseState.authGeneration = 1;
    firebaseState.db = { name: 'db' } as any;
    firebaseState.dbRefDailyRevenue = { path: 'daily' } as any;
    firebaseState.dbRefMonthlyRevenue = { path: 'monthly' } as any;
    firebaseState.fb = {
        ref: (_db: any, path: string) => ({ path }),
        runTransaction: (ref: any, fn: any) => new Promise((resolve) => { pending.push({ ref, fn, resolve }); })
    } as any;
    dataState.dailyRevenueData = { [DAY]: { codDollar: 10, dodDollar: 0, totalCount: 1 } };
    dataState.monthlyRevenueData = { '2026-10': { codDollar: 10, dodDollar: 0, totalCount: 1 } };
    viewState.manualAdjustBusy = false;
    document.body.innerHTML = '';
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    reactAct(() => {
        root.render(<>
            <input ref={refTo('manualDateInput')} />
            <input ref={refTo('manualCodChangeInput')} />
            <input ref={refTo('manualDodChangeInput')} />
            <input ref={refTo('manualCountChangeInput')} />
        </>);
    });
    setFieldValue('manualDateInput', DAY);
    setFieldValue('manualCodChangeInput', '5');
    setFieldValue('manualDodChangeInput', '');
    setFieldValue('manualCountChangeInput', '1');
});

afterEach(() => {
    reactAct(() => { root.unmount(); });
    delete (window as any).ZoeErrors;
    vi.clearAllTimers();
    vi.useRealTimers();
});

describe('ledger ៖ ការផ្ទៀងផ្ទាត់ដែលចប់ក្រោយការប្តូរវគ្គ', () => {
    it('`correctRevenueLedgerToActual` ➜ `stale: true` (មុន និងក្រោយការជួសជុល)', async () => {
        const daily = deferred<any>();
        const early = correctRevenueLedgerToActual(DAY, { dailyServer: daily.promise, monthlyServer: Promise.resolve(zero) }, 5, 0, 1);
        switchSession();
        daily.resolve(zero);
        const earlyResult: any = await early;
        expect(earlyResult.ok).toBe(false);
        expect(earlyResult.stale).toBe(true);

        const applied = { dailyServer: Promise.resolve(zero), monthlyServer: Promise.resolve(zero) };
        const late = correctRevenueLedgerToActual(DAY, applied, 5, 0, 1);
        await flush();
        expect(pending.length).toBe(2);
        switchSession();
        commitAll();
        const lateResult: any = await late;
        expect(lateResult.ok).toBe(false);
        expect(lateResult.stale).toBe(true);

        const same = correctRevenueLedgerToActual(DAY, { dailyServer: Promise.resolve(zero), monthlyServer: Promise.resolve(zero) }, 5, 0, 1);
        await flush();
        commitAll();
        await flush();
        await flush();
        commitAll();
        const sameResult: any = await same;
        expect(sameResult.stale).toBe(false);
    });

    it('កែស្ថិតិដោយដៃ ➜ ចាកចេញមុនការផ្ទៀងផ្ទាត់ចប់ ➜ គ្មាន ⚠️ «សូមប្រាប់ Admin» · គ្មាន Sentry លុយ', async () => {
        submitManualAdjustment();
        expect(texts().some((m) => m.indexOf('⏳') === 0)).toBe(true);
        await flush();
        expect(pending.length).toBe(2);
        switchSession();
        commitAll();
        for (let i = 0; i < 6; i++) await flush();
        expect(texts().filter((m) => m.indexOf('⚠️') === 0)).toEqual([]);
        expect(texts().some((m) => m.indexOf('✅') === 0)).toBe(false);
        expect(capture).not.toHaveBeenCalled();
    });

    it('ទិសផ្ទុយ ៖ វគ្គដដែល ➜ ✅ ក្រោយ commit · ការបដិសេធ ➜ ⚠️ + Sentry', async () => {
        submitManualAdjustment();
        await flush();
        expect(commitAll()).toBe(2);
        for (let i = 0; i < 6; i++) await flush();
        expect(texts().some((m) => m.indexOf('✅') === 0 && /ស្ថិតិ/.test(m))).toBe(true);
        expect(capture).not.toHaveBeenCalled();

        uiState.toasts = [];
        viewState.manualAdjustBusy = false;
        setFieldValue('manualCodChangeInput', '7');
        submitManualAdjustment();
        await flush();
        const batch = pending.splice(0);
        batch.forEach((p) => { p.resolve({ committed: false }); });
        for (let i = 0; i < 8; i++) await flush();
        const rejected = pending.splice(0);
        rejected.forEach((p) => { p.resolve({ committed: false }); });
        for (let i = 0; i < 8; i++) await flush();
        expect(texts().some((m) => m.indexOf('⚠️') === 0)).toBe(true);
        expect(capture).toHaveBeenCalled();
    });
});
