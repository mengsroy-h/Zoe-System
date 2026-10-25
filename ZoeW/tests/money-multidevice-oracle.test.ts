import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const { invariant, invariantBroken } = require('../../audit-tools/money-multidevice-core.js');
const day = '2026-10-19';
const month = '2026-10';

function fixture() {
    const item = (id: string, phone: string, codes: string[], closed: boolean) => ({
        id, phone, scanDate: day,
        barcodes: codes.map((code) => ({ code, cod: 1.25, dod: 0.5, isClosed: closed, isDeducted: false }))
    });
    return {
        zoew_scan_history_cod_dod: {
            a: item('a', '012345678', ['AA', 'BB'], true),
            b: item('b', '098765432', ['CC'], true),
            c: item('c', '011223344', ['DD'], false)
        },
        zoew_recently_deleted_cod_dod: {},
        zoew_barcode_registry: { AA: true, BB: true, CC: true, DD: true } as Record<string, boolean>,
        zoew_daily_revenue_cod_dod: { [day]: { codDollar: 5, dodDollar: 2, totalCount: 4 } },
        zoew_monthly_revenue_cod_dod: { [month]: { codDollar: 5, dodDollar: 2, totalCount: 4 } },
        zoew_daily_pickup_cod_dod: { [day]: {
            packagesPickedUp: 3,
            pickedUpBarcodes: { AA: '012345678', BB: '012345678', CC: '098765432' } as Record<string, string>,
            pickedUpPhones: { '012345678': 2, '098765432': 1 } as Record<string, number>
        } }
    };
}

function verdict(tree: ReturnType<typeof fixture>) {
    return invariantBroken(invariant(tree, day, month, ['AA', 'BB', 'CC', 'DD']));
}

describe('អ្នកយាមលុយផ្ទៀងអត្តសញ្ញាណ server ទាំងមូល', () => {
    it('ទទួលកញ្ចប់បិទច្រើនលេខទូរស័ព្ទតែមួយ និងកញ្ចប់បើក', () => {
        expect(verdict(fixture())).toBeNull();
    });

    it('បដិសេធ pickup key ខុស ទោះចំនួនកញ្ចប់និងលុយនៅដដែល', () => {
        const tree = fixture();
        const pick = tree.zoew_daily_pickup_cod_dod[day];
        delete pick.pickedUpBarcodes.AA;
        pick.pickedUpBarcodes.DD = '012345678';
        expect(verdict(tree)).not.toBeNull();
    });

    it('បដិសេធលេខទូរស័ព្ទខុសក្នុង pickup set ទោះកញ្ចក់ចំនួនត្រឹមត្រូវ', () => {
        const tree = fixture();
        tree.zoew_daily_pickup_cod_dod[day].pickedUpBarcodes.AA = '099999999';
        expect(verdict(tree)).not.toBeNull();
    });

    it('បដិសេធចំនួនអតិថិជនខុស ទោះផលបូក pickedUpPhones ដដែល', () => {
        const tree = fixture();
        tree.zoew_daily_pickup_cod_dod[day].pickedUpPhones = { '012345678': 1, '098765432': 2 };
        expect(verdict(tree)).not.toBeNull();
    });

    it('បដិសេធ set និងកញ្ចក់ប្តូរទូរស័ព្ទខុសជាមួយគ្នា', () => {
        const tree = fixture();
        const pick = tree.zoew_daily_pickup_cod_dod[day];
        pick.pickedUpBarcodes.AA = '098765432';
        pick.pickedUpPhones = { '012345678': 1, '098765432': 2 };
        expect(verdict(tree)).not.toBeNull();
    });

    it('បដិសេធ registry ខ្វះកញ្ចប់ដែលនៅ server', () => {
        const tree = fixture();
        delete tree.zoew_barcode_registry.AA;
        expect(verdict(tree)).not.toBeNull();
    });

    it('បដិសេធ registry កំព្រា', () => {
        const tree = fixture();
        tree.zoew_barcode_registry.GHOST = true;
        expect(verdict(tree)).not.toBeNull();
    });

    it('គោរព registry encoding ពិតសម្រាប់ barcode មានសញ្ញា', () => {
        const tree = fixture();
        tree.zoew_scan_history_cod_dod.c.barcodes[0].code = ' dd/01 ';
        delete tree.zoew_barcode_registry.DD;
        tree.zoew_barcode_registry['DD%2F01'] = true;
        expect(invariantBroken(invariant(tree, day, month, ['AA', 'BB', 'CC', 'DD/01']))).toBeNull();
    });

    it('បដិសេធអត្តសញ្ញាណ barcode ស្ទួនទោះអក្សរតូចធំខុសគ្នា', () => {
        const tree = fixture();
        tree.zoew_scan_history_cod_dod.c.barcodes[0].code = ' aa ';
        delete tree.zoew_barcode_registry.DD;
        expect(invariantBroken(invariant(tree, day, month, ['AA', 'BB', 'CC']))).not.toBeNull();
    });
});

const { createRevenueExpectation, scanDayForCheckpoint, confirmWithClockWindow } = require('../../audit-tools/money-cookie-blob.js');

function calendarFixture(scanDay = '2026-10-31') {
    return {
        zoew_scan_history_cod_dod: { base: { id: 'base', scanDate: scanDay, barcodes: [{ code: 'BASE', cod: 10, dod: 2, isClosed: false, isDeducted: false }] } },
        zoew_recently_deleted_cod_dod: {}, zoew_barcode_registry: { BASE: true },
        zoew_daily_revenue_cod_dod: { [scanDay]: { codDollar: 10, dodDollar: 2, totalCount: 1 } },
        zoew_monthly_revenue_cod_dod: { [scanDay.slice(0, 7)]: { codDollar: 10, dodDollar: 2, totalCount: 1 } }
    } as any;
}
function addCalendarScan(tree: any, scanDay: string, cod = 10, dod = 2) {
    tree.zoew_scan_history_cod_dod.new = { id: 'new', scanDate: scanDay, barcodes: [{ code: 'NEW', cod, dod, isClosed: false, isDeducted: false }] };
    tree.zoew_barcode_registry.NEW = true;
    for (const [root, key] of [['zoew_daily_revenue_cod_dod', scanDay], ['zoew_monthly_revenue_cod_dod', scanDay.slice(0, 7)]]) {
        const row = tree[root][key] ||= { codDollar: 0, dodDollar: 0, totalCount: 0 };
        row.codDollar += cod; row.dodDollar += dod; row.totalCount++;
    }
}

describe('អ្នកយាមលុយ៖ ថ្ងៃស្កេន និងខែដាច់ពីថ្ងៃចាប់ផ្តើម checker', () => {
    it.each(['2026-10-30', '2026-10-31', '2026-11-01'])('ថ្ងៃដដែល/អធ្រាត្រ/ឆ្លងខែ %s រក្សា expected ឯករាជ្យ', scanDay => {
        const initial = calendarFixture('2026-10-30'), expected = createRevenueExpectation(initial);
        expected.adjust(scanDay, 10, 2, 1);
        const tree = structuredClone(initial); addCalendarScan(tree, scanDay);
        expect(() => expected.verify(tree, ['BASE', 'NEW'], 'scan')).not.toThrow();
        expect(expected.day('2026-10-30').codDollar).toBe(scanDay === '2026-10-30' ? 20 : 10);
        expect(expected.month('2026-10').codDollar).toBe(scanDay.startsWith('2026-10') ? 20 : 10);
        expect(expected.month('2026-11').codDollar).toBe(scanDay.startsWith('2026-11') ? 10 : 0);
    });
    it.each(['money', 'dod', 'count', 'old-day', 'month', 'extra-day', 'missing-code', 'duplicate-code'])('មិនលាក់កំហុស %s ដោយគណនា expected ពី actual', kind => {
        const initial = calendarFixture(), expected = createRevenueExpectation(initial); expected.adjust('2026-11-01', 10, 2, 1);
        const tree = structuredClone(initial); addCalendarScan(tree, '2026-11-01', kind === 'money' ? 0 : 10, kind === 'dod' ? 0 : 2);
        if (kind === 'count') { tree.zoew_scan_history_cod_dod.new.barcodes.push({ code: 'EXTRA', cod: 0, dod: 0, isClosed: false, isDeducted: false }); tree.zoew_barcode_registry.EXTRA = true; tree.zoew_daily_revenue_cod_dod['2026-11-01'].totalCount++; tree.zoew_monthly_revenue_cod_dod['2026-11'].totalCount++; }
        if (kind === 'old-day') { tree.zoew_scan_history_cod_dod.base.barcodes[0].cod = 0; tree.zoew_daily_revenue_cod_dod['2026-10-31'].codDollar = 0; tree.zoew_monthly_revenue_cod_dod['2026-10'].codDollar = 0; }
        if (kind === 'month') tree.zoew_monthly_revenue_cod_dod['2026-11'].codDollar = 0;
        if (kind === 'extra-day') { tree.zoew_daily_revenue_cod_dod['2026-12-01'] = { codDollar: 10, dodDollar: 2, totalCount: 1 }; tree.zoew_monthly_revenue_cod_dod['2026-12'] = { codDollar: 10, dodDollar: 2, totalCount: 1 }; }
        if (kind === 'missing-code') delete tree.zoew_scan_history_cod_dod.new;
        if (kind === 'duplicate-code') tree.zoew_recently_deleted_cod_dod.copy = structuredClone(tree.zoew_scan_history_cod_dod.new);
        expect(() => expected.verify(tree, ['BASE', 'NEW'], kind)).toThrow();
    });
    it('seed ថ្ងៃចាស់មិនជាន់ប្រាក់ថ្ងៃថ្មីក្នុងខែដូចគ្នា', () => {
        const expected = createRevenueExpectation(calendarFixture('2026-10-30'));
        expected.adjust('2026-10-31', 10, 2, 1); expected.adjust('2026-10-30', 13, 3, 2);
        expect(expected.day('2026-10-30')).toEqual({ codDollar: 23, dodDollar: 5, totalCount: 3 });
        expect(expected.month('2026-10')).toEqual({ codDollar: 33, dodDollar: 7, totalCount: 4 });
        expected.adjust('2026-10-31', -10, -2, -1);
        expect(expected.day('2026-10-31')).toEqual({ codDollar: 0, dodDollar: 0, totalCount: 0 });
        expect(expected.month('2026-10').codDollar).toBe(23);
    });
    it.each([
        ['2026-10-31T16:59:58Z', '2026-10-31T16:59:59Z', '2026-10-31T16:59:58.500Z', '2026-10-31'],
        ['2026-10-30T16:59:59Z', '2026-10-30T17:00:01Z', '2026-10-30T17:00:00Z', '2026-10-31'],
        ['2026-10-31T16:59:59Z', '2026-10-31T17:00:01Z', '2026-10-31T17:00:00Z', '2026-11-01']
    ])('កាលបរិច្ឆេទ Cambodia ផ្ទៀងនឹងពេល scan %s', (before, after, createdAt, scanDate) => {
        expect(scanDayForCheckpoint({ scanDate, createdAt: Date.parse(createdAt) }, { before: Date.parse(before), after: Date.parse(after) })).toBe(scanDate);
    });
    it.each(['wrong-day', 'outside-window', 'missing-stamp'])('បដិសេធកាលបរិច្ឆេទក្លែង %s', kind => {
        const before = Date.parse('2026-10-31T16:59:59Z'), after = before + 2000;
        const item = { scanDate: kind === 'wrong-day' ? '2026-10-31' : '2026-11-01', createdAt: kind === 'missing-stamp' ? undefined : kind === 'outside-window' ? after + 1 : before + 1000 };
        expect(() => scanDayForCheckpoint(item, { before, after })).toThrow();
    });
});

describe('បង្អួចពេល confirm ជាមួយការកែ server offset', () => {
    it.each([-100, 500, 0])('រក្សាពេល scan ពិតទោះ offset ប្ដូរ %s ms កណ្ដាលសំណើ', async offset => {
        const start = Date.parse('2026-10-31T17:00:00Z');
        let wall = start, currentOffset = 0, createdAt = 0;
        const originalNow = Date.now;
        const clock = vi.spyOn(Date, 'now').mockImplementation(() => wall);
        vi.stubGlobal('window', {
            get serverTimeOffsetMs() { return currentOffset; },
            getServerNow: () => Date.now() + currentOffset,
            confirmPhone: async () => { wall += 10; currentOffset = offset; createdAt = Date.now() + currentOffset; wall += 10; currentOffset = 0; }
        });
        try {
            const bounds = await confirmWithClockWindow();
            expect(Date.now).toBe(clock);
            const expectedDay = offset < 0 ? '2026-10-31' : '2026-11-01';
            expect(scanDayForCheckpoint({ createdAt, scanDate: expectedDay }, bounds)).toBe(expectedDay);
            expect(bounds).toEqual({ before: start + Math.min(0, 10 + offset), after: start + Math.max(20, 10 + offset) });
            expect(() => scanDayForCheckpoint({ createdAt: bounds.before - 1, scanDate: expectedDay }, bounds)).toThrow();
            expect(() => scanDayForCheckpoint({ createdAt: bounds.after + 1, scanDate: expectedDay }, bounds)).toThrow();
        } finally { vi.unstubAllGlobals(); vi.restoreAllMocks(); }
        expect(Date.now).toBe(originalNow);
    });
    it('ស្ដារនាឡិកាដដែលក្រោយ confirm បដិសេធ និងមិនលាក់ error', async () => {
        const originalNow = Date.now;
        vi.stubGlobal('window', { serverTimeOffsetMs: 0, getServerNow: () => Date.now(), confirmPhone: async () => { throw new Error('synthetic confirm failure'); } });
        try { await expect(confirmWithClockWindow()).rejects.toThrow('synthetic confirm failure'); expect(Date.now).toBe(originalNow); }
        finally { vi.unstubAllGlobals(); }
    });
});
