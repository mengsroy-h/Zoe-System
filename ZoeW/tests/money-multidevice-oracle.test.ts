import { createRequire } from 'node:module';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { acceptServerClockOffset, getServerNow, resetServerClock } from '../src/core/clock';
import { firebaseState } from '../src/core/state';
import { commitNow } from '../src/app/flush';
import { createStore, registerStore } from '../src/core/store';

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

// ស្រង់ wrapper ដែល compile ពីម្ចាស់ audit bridge ពិត; commitNow និង store មិនមែន stub។
const bridgeSource = readFileSync(require.resolve('../src/expose-globals.ts'), 'utf8');
const compiledBridge = require('esbuild').transformSync(bridgeSource, { loader: 'ts', format: 'esm' }).code;
const bridgeAst = require('acorn').parse(compiledBridge, { ecmaVersion: 'latest', sourceType: 'module' });
const bridgeOwner = bridgeAst.body.filter(node => node.type === 'FunctionDeclaration' && node.id.name === 'exposeGlobals');
expect(bridgeOwner).toHaveLength(1);
const wrapperParts = ['NO_WRAP', 'depth', 'settle', 'wrap'].map(name => {
    const statements = bridgeOwner[0].body.body.filter(node => node.type === 'VariableDeclaration'
        && node.declarations.some(declaration => declaration.id.name === name));
    expect(statements).toHaveLength(1); return statements[0];
});
const wrapStart = wrapperParts[0].start, wrapEnd = wrapperParts.at(-1).end;
expect(wrapStart).toBeGreaterThan(0); expect(wrapEnd).toBeGreaterThan(wrapStart);
const auditWrap = runInNewContext(compiledBridge.slice(wrapStart, wrapEnd) + '\nwrap;', { commitNow });

describe('clock witness មិនបង្ខំ React commit តាម audit bridge', () => {
    it('ស្ពាន audit ផ្តល់ម្ចាស់ clock ដើម និងបង្ខំ store flush ពេលហៅ wrapper', () => {
        const store = registerStore(createStore('money-clock-bridge-control', { value: 0 }));
        const notifications = vi.fn(); const unsubscribe = store.subscribe(notifications);
        const wrapped = auditWrap('getServerNow', getServerNow);
        expect(Object.getOwnPropertyDescriptor(wrapped, '__auditOrig')?.value).toBe(getServerNow);
        expect(wrapped.toString()).toBe(Function.prototype.toString.call(getServerNow));
        try {
            (store as any).value = 1;
            expect(notifications).not.toHaveBeenCalled();
            wrapped();
            expect(notifications).toHaveBeenCalledTimes(1);
        } finally { unsubscribe(); }
    });
    it.each([['witness', true], ['confirm', true], ['witness', false], ['confirm', false]])(
    '%s៖ Date.now មិនបញ្ជូន pending store មុន microtask · bridge=%s', async (method, bridged) => {
        const store = registerStore(createStore('money-clock-passive-' + method, { value: 0 }));
        const notifications = vi.fn(); const unsubscribe = store.subscribe(notifications);
        const originalNow = Date.now;
        vi.stubGlobal('window', { getServerNow: bridged ? auditWrap('getServerNow', getServerNow) : getServerNow,
            serverTimeOffsetMs: 0, confirmPhone: async () => {} });
        let pending: Promise<unknown> | undefined;
        try {
            (store as any).value = 1;
            originalNow(); expect(notifications).not.toHaveBeenCalled();
            if (method === 'witness') { require('../../audit-tools/money-cookie-blob.js').installMoneyClockWitness(); Date.now(); }
            else pending = confirmWithClockWindow();
            expect(notifications).not.toHaveBeenCalled();
        } finally { await pending; Date.now = originalNow; unsubscribe(); vi.unstubAllGlobals(); }
    });

    it.each(['witness', 'confirm'].flatMap(method => ['missing', 'undefined', 'null', 'object', 'inherited', 'accessor', 'self']
        .map(defect => [method, defect])))(
    '%s៖ marker %s មិនជំនួសដោយ wrapper ដែល flush ឬ marker ដែលមិនបានផ្ទៀង', async (method, defect) => {
        const epoch = Date.parse('2026-10-31T17:00:00Z');
        const originalNow = vi.spyOn(Date, 'now').mockReturnValue(epoch);
        const raw = vi.fn(() => epoch), markerRead = vi.fn(() => raw);
        const wrapped = auditWrap('getServerNow', raw);
        if (defect === 'missing') delete wrapped.__auditOrig;
        if (defect === 'undefined') wrapped.__auditOrig = undefined;
        if (defect === 'null') wrapped.__auditOrig = null;
        if (defect === 'object') wrapped.__auditOrig = {};
        if (defect === 'self') wrapped.__auditOrig = wrapped;
        if (defect === 'inherited') { delete wrapped.__auditOrig; Object.setPrototypeOf(wrapped, { __auditOrig: raw }); }
        if (defect === 'accessor') Object.defineProperty(wrapped, '__auditOrig', { get: markerRead });
        const win: any = { getServerNow: wrapped, serverTimeOffsetMs: 0, confirmPhone: async () => {} };
        vi.stubGlobal('window', win);
        try {
            let bounds;
            if (method === 'witness') {
                require('../../audit-tools/money-cookie-blob.js').installMoneyClockWitness(); Date.now();
                bounds = { before: win.__moneyClockWitness.min, after: win.__moneyClockWitness.max };
            } else bounds = await confirmWithClockWindow();
            expect(raw).not.toHaveBeenCalled(); expect(markerRead).not.toHaveBeenCalled();
            expect(() => scanDayForCheckpoint({ createdAt: epoch, scanDate: '2026-11-01' }, bounds)).toThrow();
        } finally { Date.now = originalNow; vi.unstubAllGlobals(); vi.restoreAllMocks(); }
    });

    it.each(['witness', 'confirm'].flatMap(method => ['missing', 'nonfinite', 'marker'].map(defect => [method, defect])))(
    '%s៖ clock %s ខូចកណ្ដាល operation មិនអាចយក envelope ចាស់ធ្វើភស្តុតាង', async (method, defect) => {
        const epoch = Date.parse('2026-10-31T17:00:00Z');
        const originalNow = vi.spyOn(Date, 'now').mockReturnValue(epoch);
        const good = auditWrap('getServerNow', () => epoch);
        const bad = defect === 'missing' ? undefined : defect === 'nonfinite' ? () => NaN : auditWrap('getServerNow', () => epoch);
        if (defect === 'marker') bad.__auditOrig = null;
        const win: any = { getServerNow: good, serverTimeOffsetMs: 0, confirmPhone: async () => {
            win.getServerNow = bad; Date.now(); win.getServerNow = good; Date.now();
        } };
        vi.stubGlobal('window', win);
        try {
            let bounds;
            if (method === 'witness') {
                require('../../audit-tools/money-cookie-blob.js').installMoneyClockWitness(); Date.now();
                expect(win.__moneyClockWitness).toEqual({ min: epoch, max: epoch });
                await win.confirmPhone();
                bounds = { before: win.__moneyClockWitness.min, after: win.__moneyClockWitness.max };
            } else bounds = await confirmWithClockWindow();
            expect(() => scanDayForCheckpoint({ createdAt: epoch, scanDate: '2026-11-01' }, bounds)).toThrow();
        } finally { Date.now = originalNow; vi.unstubAllGlobals(); vi.restoreAllMocks(); }
    });

    it.each(['witness', 'confirm', 'nested'].flatMap(method => ['raw', 'getter'].map(kind => [method, kind])))(
    '%s៖ App ចាប់ exception របស់ clock %s ក៏មិនស្ដារ envelope ចាស់', async (method, kind) => {
        const epoch = Date.parse('2026-10-31T17:00:00Z');
        const originalNow = vi.spyOn(Date, 'now').mockReturnValue(epoch);
        const error = new Error('clock owner failed');
        const good = auditWrap('getServerNow', () => epoch);
        const bad = auditWrap('getServerNow', () => { throw error; });
        let caught: unknown;
        const win: any = { getServerNow: good, serverTimeOffsetMs: 0, confirmPhone: async () => {
            if (kind === 'getter') Object.defineProperty(win, 'getServerNow', { configurable: true, get: () => { throw error; } });
            else win.getServerNow = bad;
            try { Date.now(); } catch (failure) { caught = failure; }
            Object.defineProperty(win, 'getServerNow', { configurable: true, writable: true, value: good }); Date.now();
        } };
        vi.stubGlobal('window', win);
        try {
            if (method !== 'confirm') require('../../audit-tools/money-cookie-blob.js').installMoneyClockWitness();
            const installedNow = Date.now;
            Date.now();
            if (method !== 'confirm') expect(win.__moneyClockWitness).toEqual({ min: epoch, max: epoch });
            let bounds;
            if (method === 'witness') {
                await win.confirmPhone();
                bounds = { before: win.__moneyClockWitness.min, after: win.__moneyClockWitness.max };
            } else bounds = await confirmWithClockWindow();
            expect(caught).toBe(error);
            expect(Date.now).toBe(installedNow);
            expect(() => scanDayForCheckpoint({ createdAt: epoch, scanDate: '2026-11-01' }, bounds)).toThrow();
        } finally { Date.now = originalNow; vi.unstubAllGlobals(); vi.restoreAllMocks(); }
    });

    it.each([false, true].flatMap(install => ['raw', 'getter'].map(kind => [install, kind])))(
    'confirm រក្សា exception ដើម និង Date.now ក្រោយ sampling បោះកំហុស · witness=%s · %s', async (install, kind) => {
        const originalNow = Date.now, error = new Error('clock sample rejected');
        const win: any = { getServerNow: auditWrap('getServerNow', () => { throw error; }), confirmPhone: vi.fn() };
        if (kind === 'getter') Object.defineProperty(win, 'getServerNow', { configurable: true, get: () => { throw error; } });
        vi.stubGlobal('window', win);
        try {
            if (install) require('../../audit-tools/money-cookie-blob.js').installMoneyClockWitness();
            const installedNow = Date.now;
            await expect(confirmWithClockWindow()).rejects.toBe(error);
            expect(Date.now).toBe(installedNow);
            expect(win.confirmPhone).not.toHaveBeenCalled();
        } finally { Date.now = originalNow; vi.unstubAllGlobals(); }
    });
});

describe('អ្នកវាស់លុយអាន clock owner ពិត', () => {
    it.each([[1, false], [1, true], [1000, false]])('បង្អួច confirm មិនប្រើ wall clock ជំនួស anchor៖ %s ms · witness=%s', async (wallAhead, install) => {
        const epoch = Date.parse('2026-10-31T17:00:00Z');
        let wall = epoch, mono = 1000, createdAt = 0;
        const date = vi.spyOn(Date, 'now').mockImplementation(() => wall);
        vi.spyOn(performance, 'now').mockImplementation(() => mono);
        resetServerClock();
        const db = firebaseState.db; firebaseState.db = {} as any;
        vi.stubGlobal('window', { getServerNow, get serverTimeOffsetMs() { return firebaseState.serverTimeOffsetMs; },
            confirmPhone: async () => { createdAt = getServerNow(); } });
        try {
            expect(acceptServerClockOffset(0, Object.freeze({ epochMs: epoch, wallMs: wall, monotonicMs: mono,
                uncertaintyMs: 0, source: 'nonce', generation: 0 }), true)).toBe(true);
            wall += Number(wallAhead); mono += 0.5;
            expect(getServerNow()).toBe(epoch);
            expect(Date.now() + firebaseState.serverTimeOffsetMs).toBe(epoch + Number(wallAhead));
            if (install) require('../../audit-tools/money-cookie-blob.js').installMoneyClockWitness();
            const wrapped = Date.now;
            const bounds = await confirmWithClockWindow();
            expect(Date.now).toBe(wrapped);
            expect(bounds).toEqual({ before: epoch, after: epoch });
            expect(scanDayForCheckpoint({ createdAt, scanDate: '2026-11-01' }, bounds)).toBe('2026-11-01');
            for (const stamp of [epoch - 1, epoch + 1, wall])
                expect(() => scanDayForCheckpoint({ createdAt: stamp, scanDate: '2026-11-01' }, bounds)).toThrow();
        } finally { Date.now = date; firebaseState.db = db; resetServerClock(); vi.unstubAllGlobals(); vi.restoreAllMocks(); }
    });

    it.each([-100, 500])('បង្អួចនៅតែឃើញ sample ផ្លាស់ប្ដូរបណ្ដោះអាសន្ន៖ %s ms', async offset => {
        const epoch = Date.parse('2026-10-31T17:00:00Z');
        let wall = epoch, mono = 1000, createdAt = 0;
        const date = vi.spyOn(Date, 'now').mockImplementation(() => wall);
        vi.spyOn(performance, 'now').mockImplementation(() => mono);
        resetServerClock(); const db = firebaseState.db; firebaseState.db = {} as any;
        const accept = (change: number) => expect(acceptServerClockOffset(change, Object.freeze({
            epochMs: wall + change, wallMs: wall, monotonicMs: mono, uncertaintyMs: 0, source: 'nonce', generation: 0
        }), true)).toBe(true);
        vi.stubGlobal('window', { getServerNow, get serverTimeOffsetMs() { return firebaseState.serverTimeOffsetMs; },
            confirmPhone: async () => {
                wall += 10; mono += 10; accept(offset); createdAt = getServerNow();
                await Promise.resolve(); wall += 10; mono += 10;
                expect(getServerNow()).toBe(epoch + 20 + offset); accept(0);
            } });
        try {
            accept(0);
            require('../../audit-tools/money-cookie-blob.js').installMoneyClockWitness();
            const wrapped = Date.now;
            const bounds = await confirmWithClockWindow();
            expect(Date.now).toBe(wrapped);
            expect(bounds).toEqual({ before: epoch + Math.min(0, 10 + offset), after: epoch + Math.max(20, 20 + offset) });
            expect(scanDayForCheckpoint({ createdAt, scanDate: offset < 0 ? '2026-10-31' : '2026-11-01' }, bounds))
                .toBe(offset < 0 ? '2026-10-31' : '2026-11-01');
            for (const stamp of [bounds.before - 1, bounds.after + 1])
                expect(() => scanDayForCheckpoint({ createdAt: stamp, scanDate: '2026-11-01' }, bounds)).toThrow();
        } finally { Date.now = date; firebaseState.db = db; resetServerClock(); vi.unstubAllGlobals(); vi.restoreAllMocks(); }
    });

    it.each([undefined, () => NaN])('clock input បាត់ឬខូច មិនយក wall clock ធ្វើភស្តុតាង', async getServerNow => {
        const originalNow = vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-31T17:00:00Z'));
        vi.stubGlobal('window', { getServerNow, serverTimeOffsetMs: 0, confirmPhone: async () => {} });
        try {
            const bounds = await confirmWithClockWindow();
            expect(Date.now).toBe(originalNow);
            expect(() => scanDayForCheckpoint({ createdAt: Date.now(), scanDate: '2026-11-01' }, bounds)).toThrow();
        } finally { vi.unstubAllGlobals(); vi.restoreAllMocks(); }
    });

    it('witness កត់ anchor ពិត មិនមែន offset ហើយដំឡើងម្តងប៉ុណ្ណោះ', () => {
        const { installMoneyClockWitness } = require('../../audit-tools/money-cookie-blob.js');
        const epoch = Date.parse('2026-10-31T17:00:00Z');
        let wall = epoch, mono = 1000;
        const date = vi.spyOn(Date, 'now').mockImplementation(() => wall);
        vi.spyOn(performance, 'now').mockImplementation(() => mono);
        resetServerClock();
        const db = firebaseState.db; firebaseState.db = {} as any;
        const win: any = { getServerNow, get serverTimeOffsetMs() { return firebaseState.serverTimeOffsetMs; } };
        vi.stubGlobal('window', win);
        try {
            expect(acceptServerClockOffset(0, Object.freeze({ epochMs: epoch, wallMs: wall, monotonicMs: mono,
                uncertaintyMs: 0, source: 'nonce', generation: 0 }), true)).toBe(true);
            wall++; mono += 0.5;
            installMoneyClockWitness();
            expect(Date.now()).toBe(epoch + 1);
            expect(win.__moneyClockWitness).toEqual({ min: epoch, max: epoch });
            const wrapped = Date.now; installMoneyClockWitness(); expect(Date.now).toBe(wrapped);
            wall += 10; mono += 10;
            expect(Date.now()).toBe(epoch + 11);
            expect(win.__moneyClockWitness).toEqual({ min: epoch, max: epoch + 10 });
        } finally { Date.now = date; firebaseState.db = db; resetServerClock(); vi.unstubAllGlobals(); vi.restoreAllMocks(); }
    });
});

describe('អ្នកវាស់ truthfulness រត់ module និង dependency ពិត', () => {
    const root = path.resolve(import.meta.dirname, '../..');
    const run = (target: string) => spawnSync(process.execPath, [path.join(root, 'audit-tools/money-checker-truthfulness-test.js')], {
        encoding: 'utf8', timeout: 15000, maxBuffer: 8 * 1024 * 1024,
        env: { ...process.env, MONEYTRUTH_APP_DIR: target, NODE_PATH: path.join(root, 'ZoeW/node_modules') }
    });
    it('អ្នកវាស់ពេញបញ្ចប់ behavioral assertions ដោយគ្មាន browser ឬ DB', () => {
        const result = run(root);
        expect(result.error).toBeUndefined();
        expect(result.status, result.stdout + result.stderr).toBe(0);
        expect(result.stdout).toMatch(/PASS ([1-9]\d*)\/\1\s*$/);
        expect(result.stdout).toContain('actual main bounded gateway: ACK-throws');
    });
    it.each(['settlement', 'dependency'])('root ជំនួសមិនអាចប្រើ cached helper ល្អលាក់ %s', defect => {
        const target = mkdtempSync(path.join(tmpdir(), 'zoew-money-owner-'));
        try {
            mkdirSync(path.join(target, 'audit-tools/emu'), { recursive: true });
            for (const file of ['money-multidevice-core.js', 'browser-clock-fixture.cjs', 'emu/money-multidevice-emu-test.js', 'supabase-money-multishop-test.js'])
                copyFileSync(path.join(root, 'audit-tools', file), path.join(target, 'audit-tools', file));
            const filename = path.join(target, 'audit-tools', defect === 'settlement' ? 'money-multidevice-core.js' : 'browser-clock-fixture.cjs');
            const source = readFileSync(filename, 'utf8');
            const poisoned = defect === 'settlement' ? source.replace('return states.length > 0', 'return true || states.length > 0')
                : source + '\nthrow new Error("money-clock-dependency-poison");\n';
            expect(poisoned).not.toBe(source); writeFileSync(filename, poisoned);
            const result = run(target);
            expect(result.error).toBeUndefined(); expect(result.status).toBe(1);
            if (defect === 'settlement') {
                expect(result.stdout).toMatch(/FAIL [1-9]\d* \/ ok [1-9]\d*\s*$/);
                expect(result.stdout).toContain('actual main bounded gateway: ACK-false');
                expect(result.stderr).not.toMatch(/ReferenceError|MODULE_NOT_FOUND/);
            } else expect(result.stdout + result.stderr).toContain('money-clock-dependency-poison');
        } finally { rmSync(target, { recursive: true, force: true }); }
    });
});

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

const MIRROR_NOW = Date.parse('2026-11-07T01:00:00+07:00');
function mirrorFixture() {
    const scanDay = '2026-11-01', closedAt = Date.parse('2026-11-07T00:30:00+07:00');
    return {
        zoew_scan_history_cod_dod: { row: { id: 'row', phone: '012000111', scanDate: scanDay,
            barcodes: [{ code: 'MIRROR', cod: 10, dod: 2, isClosed: true, isDeducted: false, closedAt }] } },
        zoew_recently_deleted_cod_dod: {}, zoew_barcode_registry: { MIRROR: true },
        zoew_daily_revenue_cod_dod: { [scanDay]: { codDollar: 10, dodDollar: 2, totalCount: 1 } },
        zoew_monthly_revenue_cod_dod: { '2026-11': { codDollar: 10, dodDollar: 2, totalCount: 1 } },
        zoew_daily_pickup_cod_dod: { [scanDay]: { packagesPickedUp: 1, pickedUpBarcodes: { MIRROR: '012000111' }, pickedUpPhones: { '012000111': 1 } } },
        zoew_daily_collected_cod_dod: { '2026-11-07': { MIRROR: { c: 10, d: 2 } } }
    } as any;
}
const mirrorVerdict = (tree: any, now = MIRROR_NOW) => invariantBroken(invariant(tree, '2026-11-01', '2026-11', ['MIRROR'], undefined, now));

describe('កញ្ចក់ collected ក្នុង browser matrix៖ scope សំយោគច្បាស់ មិនអាស្រ័យលើកូនសោកញ្ចក់ដែលសល់', () => {
    it('ថ្ងៃបិទ Cambodia ខុសថ្ងៃស្កេន និងថ្ងៃ UTC នៅតែត្រឹមត្រូវ', () => {
        expect(mirrorVerdict(mirrorFixture())).toBeNull();
    });
    it.each(['whole-root', 'whole-day', 'only-key', 'cod', 'dod', 'duplicate', 'wrong-day', 'open', 'invalid-stamp', 'invalid-value', 'extra-key'])('បដិសេធ %s ដោយគ្មាន surviving anchor', kind => {
        const tree = mirrorFixture(), mirror = tree.zoew_daily_collected_cod_dod;
        if (kind === 'whole-root') delete tree.zoew_daily_collected_cod_dod;
        if (kind === 'whole-day') delete mirror['2026-11-07'];
        if (kind === 'only-key') delete mirror['2026-11-07'].MIRROR;
        if (kind === 'cod') mirror['2026-11-07'].MIRROR.c = 999;
        if (kind === 'dod') mirror['2026-11-07'].MIRROR.d = 888;
        if (kind === 'duplicate') mirror['2026-11-06'] = { MIRROR: { c: 10, d: 2 } };
        if (kind === 'wrong-day') { mirror['2026-11-06'] = mirror['2026-11-07']; delete mirror['2026-11-07']; }
        if (kind === 'open') { tree.zoew_scan_history_cod_dod.row.barcodes[0].isClosed = false; tree.zoew_daily_pickup_cod_dod = {}; }
        if (kind === 'invalid-stamp') delete tree.zoew_scan_history_cod_dod.row.barcodes[0].closedAt;
        if (kind === 'invalid-value') mirror['2026-11-07'].MIRROR.c = '10';
        if (kind === 'extra-key') mirror['2026-11-07'].GHOST = { c: 10, d: 2 };
        expect(mirrorVerdict(tree)).not.toBeNull();
    });
    it('checkpoint expected ក៏បដិសេធ node កញ្ចក់បាត់ទាំងមូល', () => {
        const tree = mirrorFixture(), expected = createRevenueExpectation(tree);
        delete tree.zoew_daily_collected_cod_dod;
        expect(() => expected.verify(tree, ['MIRROR'], 'missing-first-close', MIRROR_NOW)).toThrow();
    });
    it.each(['kept', 'pickup'])('ធុងសំរាម %s រក្សា collected', reason => {
        const tree = mirrorFixture(); tree.zoew_recently_deleted_cod_dod.row = { ...tree.zoew_scan_history_cod_dod.row, trashReason: reason };
        delete tree.zoew_scan_history_cod_dod.row;
        expect(mirrorVerdict(tree)).toBeNull();
    });
    it.each(['remove', 'returned', 'misplaced', 'sent'])('ធុងសំរាម %s ដក collected ហើយមិនអនុញ្ញាតកូនសោសល់', reason => {
        const tree = mirrorFixture(); tree.zoew_recently_deleted_cod_dod.row = { ...tree.zoew_scan_history_cod_dod.row, trashReason: reason };
        delete tree.zoew_scan_history_cod_dod.row; tree.zoew_daily_pickup_cod_dod = {};
        tree.zoew_recently_deleted_cod_dod.row.barcodes[0].isDeducted = true;
        tree.zoew_daily_revenue_cod_dod['2026-11-01'] = { codDollar: 0, dodDollar: 0, totalCount: 0 };
        tree.zoew_monthly_revenue_cod_dod['2026-11'] = { codDollar: 0, dodDollar: 0, totalCount: 0 };
        expect(mirrorVerdict(tree)).not.toBeNull();
        tree.zoew_daily_collected_cod_dod = {};
        expect(mirrorVerdict(tree)).toBeNull();
    });
    it('closedAt មុន window ៧ថ្ងៃមិនត្រូវបានប្រកាសថាបាត់', () => {
        const tree = mirrorFixture(); tree.zoew_scan_history_cod_dod.row.barcodes[0].closedAt = Date.parse('2026-10-31T23:59:59+07:00');
        tree.zoew_daily_collected_cod_dod = {};
        expect(mirrorVerdict(tree)).toBeNull();
        tree.zoew_scan_history_cod_dod.row.barcodes[0].closedAt = Date.parse('2026-11-01T00:00:00+07:00');
        expect(mirrorVerdict(tree)).not.toBeNull();
    });
    it('fixture age ត្រូវ validate មុនផ្លាស់ថ្ងៃ collected ដោយ atomic ops', () => {
        const { collectedFixtureAgeOps } = require('../../audit-tools/money-multidevice-core.js');
        const tree = mirrorFixture(), before = tree.zoew_scan_history_cod_dod.row, aged = structuredClone(before);
        aged.barcodes[0].closedAt = MIRROR_NOW - 3 * 3600000;
        const ops = collectedFixtureAgeOps(tree, before, aged, MIRROR_NOW);
        expect(ops).toEqual([
            { k: 'set', p: ['zoew_daily_collected_cod_dod', '2026-11-07', 'MIRROR'], v: null },
            { k: 'set', p: ['zoew_daily_collected_cod_dod', '2026-11-06', 'MIRROR'], v: { c: 10, d: 2 } }
        ]);
        delete tree.zoew_daily_collected_cod_dod['2026-11-07'].MIRROR;
        expect(() => collectedFixtureAgeOps(tree, before, aged, MIRROR_NOW)).toThrow();
    });
});

it('collected COD/DOD ប្រែទិសទោះសរុបដដែល និងថ្ងៃឆ្លងខែត្រូវផ្ទៀងដាច់', () => {
    const tree = mirrorFixture(); tree.zoew_daily_collected_cod_dod['2026-11-07'].MIRROR = { c: 9, d: 3 };
    expect(mirrorVerdict(tree)).not.toBeNull();
    tree.zoew_scan_history_cod_dod.row.barcodes[0].closedAt = Date.parse('2026-10-31T23:30:00+07:00');
    tree.zoew_daily_collected_cod_dod = { '2026-10-31': { MIRROR: { c: 10, d: 2 } } };
    expect(mirrorVerdict(tree, Date.parse('2026-11-01T01:00:00+07:00'))).toBeNull();
});
it('encoded identity មិន encode % ពីរដង ហើយបដិសេធសំណុំ collected ខុស', () => {
    const tree = mirrorFixture(), key = 'MIRROR%2F01';
    tree.zoew_scan_history_cod_dod.row.barcodes[0].code = ' mirror/01 ';
    tree.zoew_barcode_registry = { [key]: true };
    tree.zoew_daily_pickup_cod_dod['2026-11-01'].pickedUpBarcodes = { [key]: '012000111' };
    tree.zoew_daily_collected_cod_dod['2026-11-07'] = { [key]: { c: 10, d: 2 } };
    const verdict = () => invariantBroken(invariant(tree, '2026-11-01', '2026-11', ['MIRROR/01'], undefined, MIRROR_NOW));
    expect(verdict()).toBeNull();
    tree.zoew_daily_collected_cod_dod['2026-11-07'] = { 'MIRROR%252F01': { c: 10, d: 2 } };
    expect(verdict()).not.toBeNull();
});
it.each(['["MIRROR"]', '["MIRROR","MIRROR"]', '[""]', '{bad'])('restore មិនស្ងប់ %s ត្រូវ unmeasured មិនមែន PASS ឬប្រកាសត្រាលុយខុស', provenance => {
    const tree = mirrorFixture(); Object.assign(tree.zoew_scan_history_cod_dod.row, { restoreClaimToken: 'pending', restoreAddedCodes: provenance });
    expect(mirrorVerdict(tree)).toContain('collected-restore-unsettled');
});
it('កូនសោកញ្ចក់មុន retention មិនមែន failure និងគ្មានថ្ងៃ ledger មិនរំលង ghost', () => {
    const tree = mirrorFixture(); tree.zoew_scan_history_cod_dod.row.barcodes[0].closedAt = Date.parse('2026-10-31T09:00:00+07:00');
    tree.zoew_daily_collected_cod_dod = { '2026-10-31': { MIRROR: { c: 10, d: 2 } } };
    expect(mirrorVerdict(tree)).toBeNull();
    tree.zoew_daily_collected_cod_dod = {};
    expect(mirrorVerdict(tree)).toBeNull();
    const ghost = { zoew_daily_collected_cod_dod: { '2026-11-07': { GHOST: { c: 10, d: 2 } } } };
    expect(() => createRevenueExpectation({}).verify(ghost, [], 'ghost-only', MIRROR_NOW)).toThrow();
    expect(() => createRevenueExpectation({}).verify({}, [], 'empty', MIRROR_NOW)).not.toThrow();
});
it.each(['value', 'duplicate'])('fixture aging មិនជួសជុលភស្តុតាងខូច %s', kind => {
    const { collectedFixtureAgeOps } = require('../../audit-tools/money-multidevice-core.js');
    const tree = mirrorFixture(), row = tree.zoew_scan_history_cod_dod.row, aged = structuredClone(row);
    aged.barcodes[0].closedAt = MIRROR_NOW - 3 * 3600000;
    if (kind === 'value') tree.zoew_daily_collected_cod_dod['2026-11-07'].MIRROR = { c: 9, d: 3 };
    else tree.zoew_daily_collected_cod_dod['2026-11-06'] = { MIRROR: { c: 10, d: 2 } };
    expect(() => collectedFixtureAgeOps(tree, row, aged, MIRROR_NOW)).toThrow();
});
it('browser checkpoints ទាំងពីរ backend និង matrix ទាមទារ clock scope ជាក់លាក់', () => {
    const { parse } = require('acorn'), { simple } = require('acorn-walk');
    for (const [file, count] of [['emu/money-multidevice-emu-test.js', 3], ['supabase-money-multishop-test.js', 2], ['money-cookie-blob.js', 2]] as const) {
        const source = readFileSync(require.resolve('../../audit-tools/' + file), 'utf8'), calls: any[] = [];
        simple(parse(source, { ecmaVersion: 'latest' }), { CallExpression(node: any) { if (node.callee.name === 'invariant') calls.push(node); } });
        expect(calls).toHaveLength(count);
        for (const call of calls) {
            expect(call.arguments).toHaveLength(6);
            expect(['Date.now()', 'now', 'clockNow']).toContain(source.slice(call.arguments[5].start, call.arguments[5].end));
        }
    }
});
it('retention លើកលែងតែ missing មិនលើកលែង barcode ស្ទួននៅថ្ងៃចាស់', () => {
    const tree = mirrorFixture(); tree.zoew_daily_collected_cod_dod['2026-10-31'] = { MIRROR: { c: 10, d: 2 } };
    expect(mirrorVerdict(tree)).not.toBeNull();
});
it.each([Number.MAX_VALUE, Date.parse('+010000-01-01T00:00:00Z'), NaN, Infinity, undefined])('timestamp ខូច %s ជា evidence failure មិនបោះ RangeError', stamp => {
    const tree = mirrorFixture(); tree.zoew_scan_history_cod_dod.row.barcodes[0].closedAt = stamp;
    expect(mirrorVerdict(tree)).toContain('collected-source-invalid');
});
it('fixture age មិនទទួល barcode បន្ថែម ឬការប្ដូរលុយលើ barcode បើក', () => {
    const { collectedFixtureAgeOps } = require('../../audit-tools/money-multidevice-core.js');
    const tree = mirrorFixture(), row = tree.zoew_scan_history_cod_dod.row, changed = structuredClone(row);
    changed.barcodes.push({ code: 'EXTRA', cod: 99, dod: 1, isClosed: false });
    expect(() => collectedFixtureAgeOps(tree, row, changed, MIRROR_NOW)).toThrow();
});
it.each(['wrong-money', 'malformed'])('កូនសោកញ្ចក់ចាស់ដែលនៅសល់ %s ត្រូវផ្ទៀងដដែល', kind => {
    const tree = mirrorFixture(); tree.zoew_scan_history_cod_dod.row.barcodes[0].closedAt = Date.parse('2026-10-31T09:00:00+07:00');
    tree.zoew_daily_collected_cod_dod = { '2026-10-31': { MIRROR: kind === 'wrong-money' ? { c: 9, d: 3 } : 'bad' } };
    expect(mirrorVerdict(tree)).not.toBeNull();
});
it('fixture age ត្រូវប្រើ source row ដូច dump ដែលបាន validate', () => {
    const { collectedFixtureAgeOps } = require('../../audit-tools/money-multidevice-core.js');
    const tree = mirrorFixture(), before = structuredClone(tree.zoew_scan_history_cod_dod.row), aged = structuredClone(before);
    before.barcodes[0].closedAt -= 1000; aged.barcodes[0].closedAt -= 3600000;
    expect(() => collectedFixtureAgeOps(tree, before, aged, MIRROR_NOW)).toThrow('snapshot');
});
it.each(['open-price', 'deleted', 'closed'])('fixture age បដិសេធប្ដូរ %s', kind => {
    const { collectedFixtureAgeOps } = require('../../audit-tools/money-multidevice-core.js');
    const tree = mirrorFixture(), row = tree.zoew_scan_history_cod_dod.row;
    row.barcodes.push({ code: 'OPEN', cod: 5, dod: 1, isClosed: false });
    const changed = structuredClone(row);
    if (kind === 'open-price') changed.barcodes[1].cod = 55;
    if (kind === 'deleted') changed.barcodes.pop();
    if (kind === 'closed') changed.barcodes[1].isClosed = true;
    expect(() => collectedFixtureAgeOps(tree, row, changed, MIRROR_NOW)).toThrow();
});

describe('parcel intent ឯករាជ្យ មិនឱ្យ source និង mirror ខុសជាមួយគ្នា', () => {
    const closedAt = Date.parse('2026-11-07T00:30:00+07:00');
    const expectedFor = (tree: any) => {
        const model = createRevenueExpectation(tree, { requireParcelIntents: true });
        model.expectParcel?.('MIRROR', { root: 'history', day: '2026-11-01', cod: 10, dod: 2,
            closed: true, deducted: false, phone: '012000111', closedAt: [closedAt - 100, closedAt + 100] });
        return model;
    };
    it('control ត្រឹមត្រូវ និង duplicate មិនទាមទារ timestamp ថ្មី', () => {
        const tree = mirrorFixture(), model = expectedFor(tree);
        expect(() => model.verify(tree, ['MIRROR'], 'control', MIRROR_NOW)).not.toThrow();
        expect(() => model.verify(tree, ['MIRROR'], 'repeat', MIRROR_NOW + 300000)).not.toThrow();
    });
    it.each(['yesterday', 'outside-retention', 'future', 'reopened', 'phone', 'swapped-value'])('បដិសេធ coherent %s', fault => {
        const tree = mirrorFixture(), model = expectedFor(tree), b = tree.zoew_scan_history_cod_dod.row.barcodes[0];
        if (fault === 'yesterday' || fault === 'outside-retention') {
            b.closedAt -= (fault === 'yesterday' ? 1 : 8) * 86400000;
            tree.zoew_daily_collected_cod_dod = fault === 'yesterday' ? { '2026-11-06': { MIRROR: { c: 10, d: 2 } } } : {};
        }
        if (fault === 'future') b.closedAt = MIRROR_NOW + 1000;
        if (fault === 'reopened') { b.isClosed = false; delete b.closedAt; tree.zoew_daily_collected_cod_dod = {}; tree.zoew_daily_pickup_cod_dod = {}; }
        if (fault === 'phone') {
            tree.zoew_scan_history_cod_dod.row.phone = '099000111';
            const p = tree.zoew_daily_pickup_cod_dod['2026-11-01']; p.pickedUpBarcodes.MIRROR = '099000111'; p.pickedUpPhones = { '099000111': 1 };
        }
        if (fault === 'swapped-value') {
            const other = structuredClone(tree.zoew_scan_history_cod_dod.row); other.id = 'other'; other.barcodes[0].code = 'OTHER';
            other.barcodes[0].cod = 20; other.barcodes[0].dod = 3; tree.zoew_scan_history_cod_dod.other = other;
            tree.zoew_barcode_registry.OTHER = true;
            tree.zoew_daily_revenue_cod_dod['2026-11-01'] = { codDollar: 30, dodDollar: 5, totalCount: 2 };
            tree.zoew_monthly_revenue_cod_dod['2026-11'] = { codDollar: 30, dodDollar: 5, totalCount: 2 };
            model.adjust('2026-11-01', 20, 3, 1);
            model.expectParcel?.('OTHER', { root: 'history', day: '2026-11-01', cod: 20, dod: 3, closed: true, deducted: false, closedAt: [closedAt - 100, closedAt + 100] });
            tree.zoew_daily_pickup_cod_dod['2026-11-01'] = { packagesPickedUp: 2, pickedUpBarcodes: { MIRROR: '012000111', OTHER: '012000111' }, pickedUpPhones: { '012000111': 2 } };
            [b.cod, other.barcodes[0].cod] = [20, 10]; [b.dod, other.barcodes[0].dod] = [3, 2];
            tree.zoew_daily_collected_cod_dod = { '2026-11-07': { MIRROR: { c: 20, d: 3 }, OTHER: { c: 10, d: 2 } } };
        }
        expect(() => model.verify(tree, fault === 'swapped-value' ? ['MIRROR', 'OTHER'] : ['MIRROR'], fault, MIRROR_NOW)).toThrow();
    });
    it('server trash claim នៅសល់មិនជា settled green', () => {
        const tree = mirrorFixture(); tree.zoew_recently_deleted_cod_dod.row = { ...tree.zoew_scan_history_cod_dod.row, trashReason: 'kept', restoreClaim: { token: 'lost-local' } };
        delete tree.zoew_scan_history_cod_dod.row;
        expect(mirrorVerdict(tree)).toContain('collected-restore-unsettled');
    });
    it('parcel ថ្មីដែលមិនបាន register intent ត្រូវ fail closed', () => {
        const tree = mirrorFixture(), model = createRevenueExpectation({}, { requireParcelIntents: true });
        model.adjust('2026-11-01', 10, 2, 1);
        expect(() => model.verify(tree, ['MIRROR'], 'untracked', MIRROR_NOW)).toThrow();
    });
});

it('parcel intent ទាមទារ barcode ថ្មីទោះ caller ភ្លេច knownCodes', () => {
    const tree = mirrorFixture(), model = createRevenueExpectation({}, { requireParcelIntents: true });
    model.adjust('2026-11-01', 10, 2, 1);
    expect(() => model.verify(tree, [], 'unlisted', MIRROR_NOW)).toThrow('intent');
});
it('parcel intent ពេលបិទឆ្លងអធ្រាត្រ និង duplicate រក្សាត្រាដើម', () => {
    const tree = mirrorFixture(), model = createRevenueExpectation(tree);
    const start = Date.parse('2026-11-06T23:59:59+07:00'), end = Date.parse('2026-11-07T00:00:01+07:00');
    tree.zoew_scan_history_cod_dod.row.barcodes[0].closedAt = end;
    model.expectParcel('MIRROR', { root: 'history', day: '2026-11-01', cod: 10, dod: 2, closed: true, deducted: false, closedAt: [start, end] });
    expect(() => model.verify(tree, ['MIRROR'], 'midnight', MIRROR_NOW)).not.toThrow();
    tree.zoew_scan_history_cod_dod.row.barcodes[0].closedAt = end + 5000;
    expect(() => model.verify(tree, ['MIRROR'], 'repeat-retimed', MIRROR_NOW)).toThrow('closedAt');
});
it('parcel intent ថ្មីត្រូវប្រើក្នុង restore matrix និងមិនយក actual តម្លៃជំនួស input', () => {
    const source = readFileSync(require.resolve('../../audit-tools/money-cookie-blob.js'), 'utf8');
    expect(source).toContain('createRevenueExpectation(initial, { requireParcelIntents: true })');
    const { parse } = require('acorn'), { simple } = require('acorn-walk');
    const calls: any[] = [];
    simple(parse(source, { ecmaVersion: 'latest' }), { CallExpression(node: any) {
        if (node.callee.type === 'MemberExpression' && node.callee.object.name === 'revenue' && node.callee.property.name === 'expectParcel') calls.push(node);
    } });
    expect(calls).toHaveLength(7);
    const seeds = calls.filter(node => node.arguments[1].properties.some((p: any) => p.key?.name === 'cod'));
    expect(seeds).toHaveLength(4);
    for (const node of seeds) for (const p of node.arguments[1].properties.filter((p: any) => ['cod', 'dod', 'closed'].includes(p.key.name))) expect(p.value.type).toBe('Literal');
});

it('clock witness កត់ supplied server clock ពេល offset ប្ដូរ ដោយមិនប្ដូរ Date.now', () => {
    const { installMoneyClockWitness } = require('../../audit-tools/money-cookie-blob.js');
    let raw = 10000;
    const date = { now: () => raw }, win: any = { serverTimeOffsetMs: -500 };
    win.getServerNow = () => date.now() + win.serverTimeOffsetMs;
    runInNewContext('(' + installMoneyClockWitness.toString() + ')()', { window: win, Date: date });
    expect(date.now()).toBe(10000);
    raw = 11000; win.serverTimeOffsetMs = 1500;
    expect(date.now()).toBe(11000);
    expect(win.__moneyClockWitness).toEqual({ min: 9500, max: 12500 });
    // Idempotent install សម្រាប់ context ដែលតេស្ត mode ច្រើន។
    const wrapped = date.now;
    runInNewContext('(' + installMoneyClockWitness.toString() + ')()', { window: win, Date: date });
    expect(date.now).toBe(wrapped);
});

it('clock evidence ឆ្លង devices និង reopen រក្សា envelope ចាស់ ហើយបាត់ witness ត្រូវ fail', async () => {
    const source = readFileSync(require.resolve('../../audit-tools/money-cookie-blob.js'), 'utf8');
    const { installMoneyClockWitness } = require('../../audit-tools/money-cookie-blob.js');
    const first = source.indexOf('    const clockSeen ='), last = source.indexOf('    let steps =', first);
    expect(first).toBeGreaterThan(0); expect(last).toBeGreaterThan(first);
    const devices = [10, -20].map(offset => {
        let script: any, raw = 1000, win: any = { serverTimeOffsetMs: offset }, date: any = { now: () => raw };
        const getServerNow = () => date.now() + win.serverTimeOffsetMs;
        win.getServerNow = getServerNow;
        const page = { evaluate: (fn: any) => runInNewContext('(' + fn.toString() + ')()', { window: win, Date: date }) };
        return { page, ctx: { addInitScript: (fn: any) => { script = fn; } },
            tick(value: number, nextOffset: number) { raw = value; win.serverTimeOffsetMs = nextOffset; date.now(); },
            reopen() { win = { serverTimeOffsetMs: -50, getServerNow }; date = { now: () => raw }; return page.evaluate(script); },
            loseWitness() { delete win.__moneyClockWitness; } };
    });
    const code = '(async () => {' + source.slice(first, last) + '; return { beginClock, captureClock, clockSeen }; })()';
    const lab = await runInNewContext(code, { devices, installMoneyClockWitness, expectation: undefined, assert: require('node:assert/strict') });
    const bounds = await lab.beginClock();
    devices[0].tick(1100, 100);
    await lab.captureClock(bounds, [devices[0]]); // មុន page.close ខណៈ write gate នៅចាំ។
    await devices[0].reopen(); devices[0].tick(1150, -50); devices[1].tick(1100, -100);
    expect(await lab.captureClock(bounds)).toEqual({ min: 980, max: 1200 });
    expect(lab.clockSeen.max).toBe(1200);
    devices[1].loseWitness();
    await expect(lab.captureClock()).rejects.toThrow('clock witness');
    expect(source).toContain('await captureClock(actionClock, [dev]);\n                    await dev.page.close().finally(() => gates[0].release(true))');
});

it('browser matrix close checkpoint បញ្ជូន clock witness ដែលចាប់បានពិត', async () => {
    const source = readFileSync(require.resolve('../../audit-tools/money-cookie-blob.js'), 'utf8');
    const first = source.indexOf("            if (movement === 'pickup2h' || signedTrash) {"), last = source.indexOf('\n            await Promise.all(devices.map', first);
    expect(first).toBeGreaterThan(0); expect(last).toBeGreaterThan(first);
    const clock = { min: 1000, max: 1001 }, calls: any[] = [], starts: any[] = [];
    const run = runInNewContext('(async () => {' + source.slice(first, last) + '})', {
        movement: 'pickup2h', signedTrash: false, flow: 'pickup2h', mode: 'duplicate', code: 'PARCEL', target: { code: 'PARCEL' },
        beginClock: async () => clock, window: { __startOp: (args: any) => starts.push(args) },
        devices: [{ page: { evaluate: (fn: any, args: any) => fn(args) } }], verify: async (...args: any[]) => calls.push(args)
    });
    await run();
    expect(starts).toEqual([{ wanted: 'closeOrder', pick: 0, target: { code: 'PARCEL' } }]);
    expect(calls).toEqual([['pickup2h/duplicate/closed', 'PARCEL', 'history', false, { closed: true, closedClock: clock }]]);
});
it('shared browser harness មិនមាន identifier ដែលមិនបានប្រកាស', () => {
    const source = readFileSync(require.resolve('../../audit-tools/money-cookie-blob.js'), 'utf8');
    const { parse } = require('acorn'), { analyze } = require('eslint-scope'), globals = require('globals');
    const allowed = new Set([...Object.keys({ ...globals.es2021, ...globals.node, ...globals.browser }),
        'fb', 'db', 'lookupSecretKey', 'deriveLookupSecretKey', 'rememberLookupSecretKey', 'openLookupApiConfigModal',
        'connectSharedZtoPalm', 'submitZtoPalmLogin', 'closeModal', 'encryptLookupSecret']);
    const unknown = (text: string) => [...new Set(analyze(parse(text, { ecmaVersion: 2022, ranges: true }), { ecmaVersion: 2022, sourceType: 'script' })
        .globalScope.through.map((ref: any) => ref.identifier.name).filter((name: string) => !allowed.has(name)))];
    expect(unknown(source)).toEqual([]);
    const poison = source.replace('closedClock: closeClock', 'closedClock: missingClock');
    expect(poison).not.toBe(source);
    expect(unknown(poison)).toEqual(['missingClock']);
});

it('failed browser operation រក្សា console cause និង connection state ដោយមិនប្ដូរលទ្ធផល', async () => {
    const { PAGE_OPS } = require('../../audit-tools/money-multidevice-core.js');
    const errorLog = vi.fn(), browserConsole = { error: errorLog };
    const win: any = { scanHistory: [{ id: 'row', barcodes: [{ code: 'PARCEL' }] }], deletedItems: [], navigator: { onLine: true },
        document: { querySelectorAll: () => [{ textContent: 'synthetic claim held' }] },
        isDatabaseConnected: false, serverClockTrusted: true, serverTimeOffsetMs: 7, connectionFlowSnapshot: () => ({ phase: 'warming' }) };
    win.removeSingleBarcode = async () => { browserConsole.error(new Error('synthetic admission refused')); return 'failed'; };
    runInNewContext('(' + PAGE_OPS.toString() + ')()', { window: win, console: browserConsole, setTimeout });
    expect(win.__startOp({ wanted: 'removeBarcode', target: { code: 'PARCEL' }, pick: 0 })).toBe('removeBarcode');
    await Promise.all(win.__ops);
    expect(errorLog).toHaveBeenCalledTimes(1);
    expect(win.__consoleErrors()[0]).toContain('synthetic admission refused');
    expect(win.__operationHistory()[0]).toMatchObject({ wanted: 'removeBarcode', r: 'failed', diagnostic: { online: true, connected: false, phase: 'warming', clockTrusted: true, offset: 7, toasts: ['synthetic claim held'] } });
});

it.each(['serializer', 'state'])('audit diagnostic %s បោះកំហុស មិនអាចប្ដូរលទ្ធផល operation ឬរារាំង console ដើម', async fault => {
    const { PAGE_OPS } = require('../../audit-tools/money-multidevice-core.js');
    const originalError = vi.fn(), browserConsole = { error: originalError };
    const win: any = { scanHistory: [{ id: 'row', barcodes: [{ code: 'PARCEL' }] }], deletedItems: [],
        connectionFlowSnapshot: () => { if (fault === 'state') throw new Error('diagnostic reader failed'); return { phase: 'ready' }; } };
    win.removeSingleBarcode = async () => {
        if (fault === 'serializer') browserConsole.error(Object.defineProperty({}, 'stack', { get() { throw new Error('diagnostic getter failed'); } }));
        return 'failed';
    };
    runInNewContext('(' + PAGE_OPS.toString() + ')()', { window: win, console: browserConsole, setTimeout });
    win.__startOp({ wanted: 'removeBarcode', target: { code: 'PARCEL' }, pick: 0 });
    await expect(Promise.all(win.__ops)).resolves.toBeDefined();
    expect(win.__operationHistory()).toHaveLength(1);
    expect(win.__operationHistory()[0]).toMatchObject({ wanted: 'removeBarcode', r: 'failed' });
    expect(originalError).toHaveBeenCalledTimes(fault === 'serializer' ? 1 : 0);
});
