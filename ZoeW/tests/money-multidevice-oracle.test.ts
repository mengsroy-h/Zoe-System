import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const { invariant, invariantBroken } = require('../../audit-tools/money-multidevice-core.js');
const day = '2026-10-19';
const month = '2026-10';
const GATE_TENANT = '11111111-1111-4111-8111-111111111111';
const GATE_WRITE_URL = 'https://fixture.supabase.invalid/rest/v1/rpc/zoe_write_v2';

describe('ការរង់ចាំ Sign ក្នុង money matrix', () => {
    it.each([true, false])('រង់ចាំពេល Sign ពិតក្រោយ signed list បញ្ជាក់តែស្ថានភាព · exact=%s', async exact => {
        const source = readFileSync(require.resolve('../../audit-tools/money-cookie-blob.js'), 'utf8');
        const first = source.indexOf('const start = (d) => d.page.evaluate((args) => {');
        const last = source.indexOf('\n                await start(dev);', first);
        expect(first).toBeGreaterThan(0); expect(last).toBeGreaterThan(first);
        let attempts = 0, now = 0;
        const win: any = { __ops: [], __startOp: () => true, ztoPickupStatus: new Map(),
            runZtoStatusSweep: vi.fn(async () => {
                attempts++;
                win.ztoPickupStatus.set('TEST', attempts === 1 || !exact
                    ? { closed: true, signedAt: 100, signedAtExact: false }
                    : { closed: true, signedAt: 1, signedAtExact: true });
            }), syncZtoFinalMarks: vi.fn(async () => {}), runAutomaticCleanupRules: vi.fn() };
        const start = runInNewContext(source.slice(first, last) + '\nstart;', {
            window: win, Date: { now: () => (now += 100) }, setTimeout,
            wanted: 'sweep', stage: 'move', movement: 'pickup2h', authMode: 'palm', signedTrash: false,
            target: { code: 'TEST' }, expectedSignedAt: 1
        });
        await start({ page: { evaluate: (fn: any, args: any) => fn({ ...args, expectedSignedAt: 1 }) } });
        if (exact) {
            await Promise.all(win.__ops);
            expect(win.runZtoStatusSweep).toHaveBeenCalledTimes(2);
            expect(win.ztoPickupStatus.get('TEST')).toMatchObject({ signedAt: 1, signedAtExact: true });
            expect(win.runAutomaticCleanupRules).toHaveBeenCalledTimes(1);
        } else {
            await expect(Promise.all(win.__ops)).rejects.toThrow('Sign');
            expect(win.runAutomaticCleanupRules).not.toHaveBeenCalled();
        }
    });

    it.each([true, false])('ផ្ដល់ពេល reconnect និងបដិសេធបើគ្មាន Sign · reconnect=%s', async reconnect => {
        const source = readFileSync(require.resolve('../../audit-tools/money-cookie-blob.js'), 'utf8');
        const first = source.indexOf('const start = (d) => d.page.evaluate((args) => {');
        const last = source.indexOf('\n                await start(dev);', first);
        expect(first).toBeGreaterThan(0); expect(last).toBeGreaterThan(first);
        let online = false, now = 0;
        const win: any = { __ops: [], __startOp: () => true, ztoPickupStatus: new Map(),
            runZtoStatusSweep: async () => { if (online) win.ztoPickupStatus.set('TEST', { closed: true, signedAt: 1 }); },
            syncZtoFinalMarks: vi.fn(async () => {}), runAutomaticCleanupRules: vi.fn() };
        const start = runInNewContext(source.slice(first, last) + '\nstart;', {
            window: win, Date: { now: () => (now += 500) }, setTimeout,
            wanted: 'sweep', stage: 'move', movement: 'pickup2h', authMode: 'palm', signedTrash: false, target: { code: 'TEST' }, expectedSignedAt: 0
        });
        const reconnectTimer = setTimeout(() => { if (reconnect) online = true; }, 0);
        try {
            await start({ page: { evaluate: (fn: any, args: any) => fn(args) } });
            const pending = Promise.all(win.__ops);
            if (reconnect) {
                await pending;
                expect(win.ztoPickupStatus.get('TEST')?.closed).toBe(true);
                expect(win.runAutomaticCleanupRules).toHaveBeenCalledTimes(1);
            } else {
                await expect(pending).rejects.toThrow('Sign');
                expect(win.runAutomaticCleanupRules).not.toHaveBeenCalled();
            }
        } finally { clearTimeout(reconnectTimer); }
    });
});

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

const { networkGate } = require('../../audit-tools/money-cookie-blob.js');
const { PAGE_OPS } = require('../../audit-tools/money-multidevice-core.js');

describe('ភស្តុតាងព្រំដែននៃ matrix', () => {
    it.each(['claim', 'delete'])('កត់ payload ដែល server ACK ពិត ដាច់ពី label របស់សកម្មភាព · %s', async kind => {
        let clientMessage: any, serverMessage: any;
        const delivered: string[] = [];
        const server = { send: vi.fn(), onMessage: (fn: any) => { serverMessage = fn; } };
        const socket = { connectToServer: () => server, onMessage: (fn: any) => { clientMessage = fn; }, send: (message: string) => delivered.push(message) };
        const gate = await networkGate({ routeWebSocket: async (_url: any, fn: any) => fn(socket) }, 'firebase');
        gate.arm('after');
        const value = kind === 'claim' ? { barcodes: [{ code: 'BOUNDARY', trashClaim: 'tc_1', trashClaimAt: 1 }] } : null;
        await clientMessage(JSON.stringify({ d: { a: 'p', r: 7, b: { p: '/zoew_scan_history_cod_dod/item', d: value } } }));
        const ack = serverMessage(JSON.stringify({ d: { r: 7, b: { s: 'ok' } } }));
        await gate.hit();
        try {
            expect(delivered).toEqual([]);
            expect(gate.evidence()).toMatchObject({ backend: 'firebase', mode: 'after', hits: 1,
                boundaries: [{ stage: 'after', operations: [{ path: 'zoew_scan_history_cod_dod/item', value }] }] });
            const snapshot = gate.evidence(); snapshot.boundaries[0].operations[0].path = 'changed';
            expect(gate.evidence().boundaries[0].operations[0].path).toBe('zoew_scan_history_cod_dod/item');
        } finally { gate.release(); await ack; }
        expect(gate.evidence().boundaries).toHaveLength(1);
    });

    it('អាន state មិនលុបប្រវត្តិ operation ដែលត្រូវប្រើពេលពន្យល់ការធ្លាក់', async () => {
        const win: any = { scanHistory: [{ id: 'item', barcodes: [{ code: 'KEEP' }] }], deletedItems: [],
            deleteSingleItem: async () => 'blocked', connectionFlowSnapshot: () => ({ phase: 'ready' }) };
        const localStorage = { length: 0, getItem: () => null, key: () => null };
        runInNewContext('(' + PAGE_OPS.toString() + ')()', { window: win, localStorage, document: { getElementById: () => null }, Promise, setTimeout });
        expect(win.__startOp({ wanted: 'deleteItem', pick: 0 })).toBe('deleteItem');
        await Promise.all(win.__ops);
        expect(win.__state().results).toEqual([{ wanted: 'deleteItem', r: 'blocked' }]);
        expect(win.__state().results).toEqual([]);
        expect(win.__operationHistory()).toEqual([{ wanted: 'deleteItem', r: 'blocked' }]);
        win.__operationHistory().pop();
        expect(win.__operationHistory()).toHaveLength(1);
    });
});

it.each(['before', 'after'])('Supabase gate កត់ព្រំដែន %s មិនច្រឡំ request និង ACK', async mode => {
    let handle: any;
    const gate = await networkGate({ route: async (url: RegExp, fn: any) => {
        expect(url.test(GATE_WRITE_URL)).toBe(true);
        expect(url.test(GATE_WRITE_URL.replace('_v2', ''))).toBe(true);
        expect(url.test(GATE_WRITE_URL + '_other')).toBe(false);
        handle = fn;
    } }, 'supabase', GATE_TENANT);
    const value = { barcodes: [{ code: 'BOUNDARY', trashClaim: 'tc_1' }] };
    const response = { json: async () => ({ ok: true }) };
    const route = { request: () => ({ url: () => GATE_WRITE_URL, postDataJSON: () => ({ p_expected_tenant: GATE_TENANT, p_ops: [{ k: 'cas', p: ['zoew_scan_history_cod_dod', 'item'], v: value }] }) }),
        fetch: vi.fn(async () => response), fulfill: vi.fn(async () => {}), continue: vi.fn(async () => {}), abort: vi.fn(async () => {}) };
    gate.arm(mode);
    const writing = handle(route);
    await gate.hit();
    try {
        expect(gate.evidence()).toMatchObject({ backend: 'supabase', expectedTenant: GATE_TENANT, mode, hits: 1,
            boundaries: [{ stage: mode, operations: [{ path: 'zoew_scan_history_cod_dod/item', value }] }] });
        expect(route.fetch).toHaveBeenCalledTimes(mode === 'after' ? 1 : 0);
        expect(route.fulfill).not.toHaveBeenCalled(); expect(route.continue).not.toHaveBeenCalled();
    } finally { gate.release(); await writing; }
    expect(route.fulfill).toHaveBeenCalledTimes(mode === 'after' ? 1 : 0);
    expect(route.continue).toHaveBeenCalledTimes(mode === 'before' ? 1 : 0);
});

it('Supabase gate មិនរាប់ CAS conflict ថាជា commit', async () => {
    let handle: any;
    const gate = await networkGate({ route: async (_url: any, fn: any) => { handle = fn; } }, 'supabase', GATE_TENANT);
    const route = { request: () => ({ url: () => GATE_WRITE_URL, postDataJSON: () => ({ p_expected_tenant: GATE_TENANT, p_ops: [{ p: ['zoew_scan_history_cod_dod', 'item'], v: null }] }) }),
        fetch: async () => ({ json: async () => ({ ok: false, conflict: true }) }), fulfill: vi.fn(async () => {}) };
    gate.arm('after'); await handle(route);
    expect(gate.hits).toBe(0); expect(gate.evidence().boundaries).toEqual([]);
    expect(route.fulfill).toHaveBeenCalledTimes(1); gate.release();
});

it.each([undefined, '22222222-2222-4222-8222-222222222222'])('Supabase gate បដិសេធ missing/foreign tenant %s មុនសរសេរ', async tenant => {
    let handle: any;
    const gate = await networkGate({ route: async (_url: any, fn: any) => { handle = fn; } }, 'supabase', GATE_TENANT);
    const route = { request: () => ({ url: () => GATE_WRITE_URL, postDataJSON: () => ({ p_expected_tenant: tenant,
        p_ops: [{ k: 'set', p: ['zoew_scan_history_cod_dod', 'item'], v: null }] }) }),
        fetch: vi.fn(), continue: vi.fn(), fulfill: vi.fn(), abort: vi.fn() };
    gate.arm('before');
    await expect(handle(route)).rejects.toThrow('tenant ដើម');
    expect(gate.hits).toBe(0);
    expect(gate.evidence().boundaries).toEqual([]);
    expect(route.fetch).not.toHaveBeenCalled();
    expect(route.continue).not.toHaveBeenCalled();
    expect(route.fulfill).not.toHaveBeenCalled();
    gate.release();
});

it.each([0, 1, -1, undefined])('matrix មិនចាត់ claim journal %s ជាស្ងប់ដោយទាយ', count => {
    const { devicesSettled } = require('../../audit-tools/money-multidevice-core.js');
    const state = { phase: 'ready', pending: 0, rows: 0, blocked: 0, cleanupJournal: 0, pickupJournal: 0, trashClaims: count };
    expect(devicesSettled([state], [true])).toBe(count === 0);
    expect(devicesSettled([state], [false])).toBe(false);
    expect(devicesSettled([state], [])).toBe(false);
    expect(devicesSettled([], [])).toBe(false);
});

it.each(['empty', 'pending', 'malformed', 'omitted'])('claim journal ក្នុងទំព័រ៖ %s', kind => {
    const entry = { itemId: 'item', token: 'tc_1', scope: 'shop' };
    const raw = kind === 'empty' ? [] : kind === 'malformed' ? [null] : [entry];
    const win: any = { trashClaimPolicy: () => ({ storeKey: 'claims' }), liveShopScope: () => 'shop',
        pendingTrashClaims: () => kind === 'pending' ? [entry] : [] };
    const localStorage = { length: 0, getItem: () => JSON.stringify(raw), key: () => null };
    runInNewContext('(' + PAGE_OPS.toString() + ')()', { window: win, localStorage, document: { getElementById: () => null }, Promise, setTimeout });
    expect(win.__journals().claims.pending).toBe(kind === 'empty' ? 0 : kind === 'pending' ? 1 : -1);
});

it.each(['firebase', 'supabase'])('before-write %s៖ page close មិនអាចផ្ញើសំណើដែល gate ទប់ទុក ទោះ reset gate ភ្លាម', async backend => {
    let handle: any;
    const server = { send: vi.fn(), onMessage: () => {} };
    const socket = { connectToServer: () => server, onMessage: (fn: any) => { handle = fn; }, send: vi.fn() };
    const route = { request: () => ({ url: () => GATE_WRITE_URL, postDataJSON: () => ({ p_expected_tenant: GATE_TENANT, p_ops: [{ p: ['zoew_scan_history_cod_dod', 'item'], v: null }] }) }),
        fetch: vi.fn(), continue: vi.fn(async () => {}), abort: vi.fn(async () => {}) };
    const ctx = backend === 'firebase' ? { routeWebSocket: async (_url: any, fn: any) => fn(socket) }
        : { route: async (_url: any, fn: any) => { handle = fn; } };
    const gate = await networkGate(ctx, backend, backend === 'supabase' ? GATE_TENANT : undefined); gate.arm('before');
    const request = backend === 'firebase' ? JSON.stringify({ d: { a: 'p', r: 3, b: { p: '/zoew_scan_history_cod_dod/item', d: null } } }) : route;
    const pending = handle(request); await gate.hit();
    expect(server.send).not.toHaveBeenCalled(); expect(route.continue).not.toHaveBeenCalled();
    gate.release(true); gate.release(); await pending;
    expect(server.send).not.toHaveBeenCalled(); expect(route.continue).not.toHaveBeenCalled(); expect(route.fetch).not.toHaveBeenCalled();
    if (backend === 'supabase') expect(route.abort).toHaveBeenCalledOnce();
    expect(gate.evidence().boundaries).toEqual([{ stage: 'before', operations: [{ path: 'zoew_scan_history_cod_dod/item', value: null }] }]);
    gate.arm('before'); const resumed = handle(request); await gate.hit(); gate.release(); await resumed;
    expect(backend === 'firebase' ? server.send : route.continue).toHaveBeenCalledOnce();
});

function v2RegistryFixture() {
    const tree: any = fixture();
    const intent = 'scan_' + 'a'.repeat(32), birth = 1792382400000;
    const barcode = tree.zoew_scan_history_cod_dod.a.barcodes[0];
    Object.assign(barcode, { scanIntent: intent, createdAt: birth });
    tree.zoew_barcode_registry.AA = { v: 2, intent, actorUid: 'actor-a', birth };
    tree.zoew_scan_operations = { [intent]: { v: 2, id: intent, actorUid: 'actor-a', scope: 'shop-a', code: 'AA', registryKey: 'AA', birth,
        scanDate: day, month, cod: 1.25, dod: 0.5, count: 1, monthToken: 'op_m' + 'a'.repeat(32), phase: 'committed',
        targetId: 'a', payloadHash: 'b'.repeat(64), phone: '012345678', locker: 'N/A', closedAt: birth } };
    return tree;
}

describe('independent v2 registry ownership oracle', () => {
    it('accepts exact committed owner alongside legacy boolean claims', () => {
        expect(verdict(v2RegistryFixture())).toBeNull();
    });
    it.each(['truthy', 'array', 'extra-owner-field', 'missing-receipt', 'prepared', 'foreign-actor', 'foreign-code', 'foreign-intent', 'foreign-birth', 'live-intent', 'live-birth', 'malformed-receipt'])('rejects %s', kind => {
        const tree = v2RegistryFixture();
        const owner = tree.zoew_barcode_registry.AA, receipt = tree.zoew_scan_operations[owner.intent];
        if (kind === 'truthy') tree.zoew_barcode_registry.AA = 1;
        if (kind === 'array') tree.zoew_barcode_registry.AA = [owner];
        if (kind === 'extra-owner-field') owner.extra = true;
        if (kind === 'missing-receipt') tree.zoew_scan_operations = {};
        if (kind === 'prepared') receipt.phase = 'prepared';
        if (kind === 'foreign-actor') receipt.actorUid = 'other';
        if (kind === 'foreign-code') receipt.code = 'BB';
        if (kind === 'foreign-intent') receipt.id = 'scan_' + 'c'.repeat(32);
        if (kind === 'foreign-birth') receipt.birth++;
        if (kind === 'live-intent') tree.zoew_scan_history_cod_dod.a.barcodes[0].scanIntent = 'other';
        if (kind === 'live-birth') tree.zoew_scan_history_cod_dod.a.barcodes[0].createdAt++;
        if (kind === 'malformed-receipt') delete receipt.payloadHash;
        expect(invariant(tree, day, month, ['AA', 'BB', 'CC', 'DD']).registryMissing).toContain('AA');
    });
    it('checks externally supplied scope without pretending a four-argument dump proves tenant origin', () => {
        const tree = v2RegistryFixture();
        expect(invariantBroken(invariant(tree, day, month, ['AA', 'BB', 'CC', 'DD'], 'shop-a'))).toBeNull();
        expect(invariant(tree, day, month, ['AA', 'BB', 'CC', 'DD'], 'shop-b').registryMissing).toContain('AA');
        tree.zoew_scan_operations[tree.zoew_barcode_registry.AA.intent].scope = '';
        expect(verdict(tree)).not.toBeNull();
    });
    it('accepts a parcel moved to trash or a different restored row with the same immutable tuple', () => {
        const tree = v2RegistryFixture();
        const old = tree.zoew_scan_history_cod_dod.a;
        delete tree.zoew_scan_history_cod_dod.a;
        tree.zoew_recently_deleted_cod_dod.moved = { ...old, id: 'moved', trashReason: 'kept' };
        expect(verdict(tree)).toBeNull();
        tree.zoew_scan_history_cod_dod.restored = { ...old, id: 'restored' };
        delete tree.zoew_recently_deleted_cod_dod.moved;
        expect(verdict(tree)).toBeNull();
    });
    it('detects orphan owner object, even without a receipt', () => {
        const tree = v2RegistryFixture();
        tree.zoew_barcode_registry.GHOST = { ...tree.zoew_barcode_registry.AA };
        expect(invariant(tree, day, month, ['AA', 'BB', 'CC', 'DD']).orphans).toContain('GHOST');
    });
});
