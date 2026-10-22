/**
 * ⛔ ជម្រើស ឃ (សំណើម្ចាស់គម្រោង «បើក PR ហើយធ្វើជម្រើស ឃ»)៖ ឧបករណ៍ក្នុងសាខាតែមួយ «ផ្លាស់វេនគ្នា» អានបញ្ជី «ចុះហត្ថលេខា» ZTO
 * ជំនួសឲ្យគ្រប់ឧបករណ៍អានព្រមគ្នា។
 *
 * មុនកែ ៖ ឧបករណ៍នីមួយៗអានដោយខ្លួនឯងរៀងរាល់ ZTO_SIGNED_SWEEP_ACTIVE_MS ➜ ឧបករណ៍ ៣ ដែលបើក App ជិតគ្នា អានបញ្ជីដដែល ៣ ដងក្នុងពីរបីវិនាទី
 * ហើយសាខារង់ចាំរហូតដល់ជុំក្រោយ (Sign ក្នុង ZTO ➜ ZoeW បិទ យឺតដល់ ~២០ វិ.)។
 *
 * ឥឡូវ ៖ ការអាននីមួយៗកក់វេនលើ `zoew_settings/zto_sweep_lead/<សាខា>` (CAS) ➜ គ្មានការអានពីរក្នុងសាខាជិតជាង ZTO_SWEEP_LANE_FLOOR_MS ·
 * ឧបករណ៍ N ដែលចង់អាន ➜ ចន្លោះ ZTO_SIGNED_SWEEP_ACTIVE_MS ÷ N ➜ សាខាឃើញ Sign លឿនជាង N ដង ·
 * ឧបករណ៍នីមួយៗមិនអានញឹកជាងមុនទេ (ការហៅ Function សរុបមិនលើសមុន) · ឧបករណ៍តែមួយ = ដូចមុនទាំងស្រុង ·
 * សាខាផ្សេង (Palm តាមលេខសាខា · Cookie តាមដែនអ៊ីមែលគណនី) មិនរំលងគ្នា · rules មិនទាន់ Publish · listener ខូច · CAS ជាប់ ➜ អានដូចមុន (fail-open)។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ devices: [] as any[], closes: [] as { code: string; at: number }[] }));

vi.mock('../src/features/barcode-ops', () => ({
    openViewListModal: () => {},
    removeSingleBarcode: async () => 'failed',
    toggleIndividualBarcodeClose: async () => false,
    openEditBarcodePriceModal: () => {},
    closeEditBarcodeModal: () => {},
    saveEditedBarcodePrice: () => {},
    applyBarcodeCloseChange: async (itemId: string, code: string, closed: boolean) => {
        if (!h.closes.some((c) => c.code === code)) h.closes.push({ code, at: Date.now() });
        for (const d of h.devices) {
            const item = d.state.dataState.scanHistory.find((i: any) => i.id === itemId);
            const b = item && item.barcodes.find((x: any) => x.code === code);
            if (b) { b.isClosed = closed; b.closedAt = Date.now(); item.isClosed = item.barcodes.every((x: any) => x.isClosed); }
        }
        return true;
    }
}));

const T0 = Date.UTC(2026, 9, 22, 3, 0, 0);
const SEC = 1000;
const MIN = 60 * SEC;
const LAG_MS = 50;
const SHOP = 'https://shop-lane.firebaseio.com';
const COOKIE_URL = '/.netlify/functions/zto-order-detail?barcode={barcode}';
const PALM_URL = '/.netlify/functions/zto-order-detail?palm=1&barcode={barcode}';
const LANES = 'zoew_settings/zto_sweep_lead';
const HISTORY = 'zoew_scan_history_cod_dod';
const LANE_MODULE = '../src/services/zto-sweep-lane';
const ACTIVE_MS = 20 * SEC;
const VISIBLE_MS = 60 * SEC;
const FLOOR_MS = 5 * SEC;

class Mem {
    m = new Map<string, string>();
    get length() { return this.m.size; }
    key(i: number) { return [...this.m.keys()][i] ?? null; }
    getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
    setItem(k: string, v: string) { this.m.set(k, String(v)); }
    removeItem(k: string) { this.m.delete(k); }
    clear() { this.m.clear(); }
}

const clone = <V>(v: V): V => v === undefined || v === null ? v : JSON.parse(JSON.stringify(v));
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

type Listener = { path: string; cb: (snap: any) => void; err?: (e: any) => void; dev: string };
let rtdb: Record<string, any>;
let listeners: Listener[];
let signedAt: Record<string, number>;
let signedCalls: { at: number; dev: string }[];
let lanePolicy: { deny?: boolean; hang?: boolean };

function getPath(path: string) {
    return clone(path.split('/').filter(Boolean).reduce((v: any, k) => (v == null ? undefined : v[k]), rtdb) ?? null);
}
function setPath(path: string, value: any) {
    const keys = path.split('/').filter(Boolean);
    let node = rtdb;
    for (const k of keys.slice(0, -1)) node = node[k] ||= {};
    if (value == null) delete node[keys[keys.length - 1]]; else node[keys[keys.length - 1]] = clone(value);
    for (const l of listeners) {
        if (path.startsWith(l.path) || l.path.startsWith(path)) setTimeout(() => l.cb(snap(getPath(l.path))), LAG_MS);
    }
    if (world.mirror && path.startsWith(HISTORY + '/')) {
        const id = path.split('/')[1];
        setTimeout(() => {
            for (const d of h.devices) {
                if (d.gone) continue;
                const list = d.state.dataState.scanHistory;
                const fresh = getPath(HISTORY + '/' + id);
                const at = list.findIndex((i: any) => i && i.id === id);
                if (fresh == null) { if (at >= 0) list.splice(at, 1); } else if (at >= 0) list[at] = fresh; else list.push(fresh);
            }
        }, LAG_MS);
    }
}
const snap = (v: any) => ({ val: () => clone(v), exists: () => v != null });
const denied = () => Object.assign(new Error('PERMISSION_DENIED: Permission denied'), { code: 'PERMISSION_DENIED' });

function fakeFb(dev: string) {
    return {
        ref: (_db: any, path = '') => ({ path }),
        onValue: (r: any, cb: any, err?: any) => {
            if (r.path.startsWith(LANES) && lanePolicy.deny) { setTimeout(() => err && err(denied()), LAG_MS); return () => {}; }
            listeners.push({ path: r.path, cb, err, dev });
            setTimeout(() => cb(snap(getPath(r.path))), LAG_MS);
            return () => {};
        },
        off: (r: any) => { listeners = listeners.filter((l) => !(l.dev === dev && l.path === r.path)); },
        runTransaction: async (r: any, update: any) => {
            if (r.path.startsWith(LANES) && lanePolicy.hang) return new Promise(() => {});
            await new Promise((res) => setTimeout(res, LAG_MS));
            if (r.path.startsWith(LANES) && lanePolicy.deny) throw denied();
            const cur = getPath(r.path);
            const next = update(clone(cur));
            if (next === undefined) return { committed: false, snapshot: snap(cur) };
            setPath(r.path, next);
            return { committed: true, snapshot: snap(next) };
        },
        update: async (r: any, patch: any) => {
            for (const [k, v] of Object.entries(patch)) setPath(r.path + '/' + k, v);
        },
        getIdTokenResult: async () => ({ token: 'tok-' + dev })
    };
}

function openItem(id: string, code: string) {
    return { id, phone: '0960007345', scanDate: '2026-10-22', isClosed: false, createdAt: T0 - 3600000,
        barcodes: [{ code, isClosed: false, cod: 1, dod: 0 }] };
}

const world = { history: [] as any[], mirror: false };

async function boot(name: string, opts: { email?: string; palmSite?: string; active?: boolean; supabase?: boolean } = {}) {
    vi.resetModules();
    const local = new Mem();
    vi.stubGlobal('localStorage', local);
    vi.stubGlobal('sessionStorage', new Mem());
    local.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: SHOP }));
    const cfg: any = { enabled: true, fastMode: true, url: window.location.origin + (opts.palmSite ? PALM_URL : COOKIE_URL), shop: SHOP };
    if (opts.palmSite) cfg.palmAccount = { siteCode: opts.palmSite };
    local.setItem('zoew_lookup_api_config', JSON.stringify(cfg));
    const state = await import('../src/core/state');
    const zto = await import('../src/features/zto-status');
    const marks = await import('../src/features/zto-final-marks');
    const lane: any = await import(/* @vite-ignore */ LANE_MODULE).catch(() => null);
    const fb: any = fakeFb(name);
    if (opts.supabase) fb.tenantScope = () => 'tenant-lane';
    const db = { name: 'shared' };
    const fs: any = state.firebaseState;
    fs.fb = fb; fs.db = db;
    fs.auth = { currentUser: { uid: 'u-' + name, email: opts.email || 'staff@zoew123.com' }, app: { options: { databaseURL: SHOP } } };
    fs.isDatabaseInitialized = true; fs.isDatabaseConnected = true; fs.hasEverConnectedToDatabase = true;
    fs.serverClockTrusted = true; fs.isInitializingFirebase = false; fs.firebaseSdkUnavailable = false;
    fs.dbRefZtoSweepLane = fb.ref(db, LANES);
    state.dataState.scanHistory = clone(world.history);
    state.dataState.deletedItems = [];
    if (lane && typeof lane.attachZtoSweepLaneListener === 'function') lane.attachZtoSweepLaneListener(fs.dbListenerGeneration);
    const device = { name, state, zto, marks, lane, local, active: opts.active !== false, bootAt: Date.now(), gone: false };
    h.devices.push(device);
    if (device.active) zto.noteZtoUserActivity();
    zto.scheduleZtoStatusSweep(1500);
    return device;
}

function leave(device: any) {
    device.gone = true;
    device.state.ztoState.ztoSessionGeneration++;
    clearTimeout(device.state.ztoState.ztoStatusSweepTimer);
    device.state.ztoState.ztoStatusSweepTimer = null;
    h.devices.splice(h.devices.indexOf(device), 1);
    listeners = listeners.filter((l) => l.dev !== device.name);
}

async function run(ms: number, tick?: (now: number) => void) {
    const start = Date.now();
    while (Date.now() - start < ms) {
        const now = Date.now();
        for (const d of [...h.devices]) {
            if (d.gone) continue;
            if (d.active && (now - d.bootAt) % (30 * SEC) === 0) d.zto.noteZtoUserActivity();
            if ((now - d.bootAt) % MIN === 0) {
                d.zto.scheduleZtoStatusSweep();
                if (world.mirror) d.marks.scheduleZtoFinalMarks();
            }
        }
        if (tick) tick(now);
        await vi.advanceTimersByTimeAsync(SEC);
    }
}

function signEvery(firstAt: number, everyMs: number, count: number) {
    const codes: string[] = [];
    world.history.push(openItem('never', 'ZTC9999999'));
    for (let k = 0; k < count; k++) {
        const code = 'ZTC' + String(7000001 + k);
        codes.push(code);
        world.history.push(openItem('it' + k, code));
        signedAt[code] = firstAt + k * everyMs;
    }
    return codes;
}

function latencies(codes: string[]) {
    return codes.filter((c) => signedAt[c] <= Date.now()).map((c) => {
        const close = h.closes.find((x) => x.code === c);
        return close ? close.at - signedAt[c] : Infinity;
    });
}

function gaps(times: number[]) {
    return times.slice(1).map((t, i) => t - times[i]);
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(T0));
    rtdb = { zoew_settings: {} };
    listeners = [];
    signedAt = {};
    signedCalls = [];
    lanePolicy = {};
    h.devices.length = 0;
    h.closes.length = 0;
    world.history = [];
    world.mirror = false;
    vi.stubGlobal('fetch', vi.fn(async (u: string, init?: any) => {
        const url = new URL(String(u));
        const dev = String((init && init.headers && init.headers['X-Zoe-Id-Token']) || '').replace(/^tok-/, '');
        if (url.searchParams.get('signed') === '1') {
            signedCalls.push({ at: Date.now(), dev });
            const codes = Object.keys(signedAt).filter((c) => signedAt[c] <= Date.now());
            return json({ success: true, list: true, enabled: true, kind: 'signed', page: 1, pages: 1, total: codes.length, rows: [], signed: codes, signedOk: true });
        }
        return json({ success: true, found: true, ztoClosed: null });
    }));
});

afterEach(() => {
    for (const d of [...h.devices]) leave(d);
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe('⛔ ជម្រើស ឃ ៖ ឧបករណ៍ក្នុងសាខាផ្លាស់វេនគ្នាអានបញ្ជីចុះហត្ថលេខា ZTO', () => {
    it('ឧបករណ៍ ៣ កំពុងប្រើ ➜ សាខាឃើញ Sign ក្នុង ≤ ZTO_SIGNED_SWEEP_ACTIVE_MS ÷ ៣ · គ្មានការអានពីរជិតជាង ៥ វិ. · ការហៅមិនលើសមុន (មុនកែ ៖ ~២០ វិ. · អានជាន់គ្នា)', async () => {
        const codes = signEvery(T0 + MIN, 37 * SEC, 14);
        await boot('a');
        await vi.advanceTimersByTimeAsync(SEC);
        await boot('b');
        await vi.advanceTimersByTimeAsync(SEC);
        await boot('c');
        await run(10 * MIN);
        const lat = latencies(codes);
        expect(lat.length).toBeGreaterThanOrEqual(12);
        expect(Math.max(...lat), 'Sign ➜ ZoeW បិទ (ms) ' + JSON.stringify(lat)).toBeLessThanOrEqual(ACTIVE_MS / 3 + 3 * SEC);
        const times = signedCalls.map((c) => c.at);
        expect(Math.min(...gaps(times)), 'ចន្លោះតូចបំផុតរវាងការអានពីរក្នុងសាខា').toBeGreaterThanOrEqual(FLOOR_MS);
        expect(signedCalls.length, 'ការហៅសរុបមិនលើសឧបករណ៍ ៣ ដែលអានរៀងៗខ្លួន').toBeLessThanOrEqual(3 * (Math.ceil(10 * MIN / ACTIVE_MS) + 1));
        for (const dev of ['a', 'b', 'c']) {
            const mine = signedCalls.filter((c) => c.dev === dev).map((c) => c.at);
            expect(mine.length, 'ឧបករណ៍ ' + dev + ' បានវេនអានដែរ').toBeGreaterThanOrEqual(10);
            expect(Math.min(...gaps(mine)), 'ឧបករណ៍ ' + dev + ' មិនអានញឹកជាងមុន').toBeGreaterThanOrEqual(ACTIVE_MS);
        }
    });

    it('ទិសផ្ទុយ ៖ ឧបករណ៍តែមួយ ➜ អានរៀងរាល់ ZTO_SIGNED_SWEEP_ACTIVE_MS ដូចមុនទាំងស្រុង (មិនបន្ថែមការហៅ)', async () => {
        signEvery(T0 + MIN, 37 * SEC, 6);
        await boot('solo');
        await run(6 * MIN);
        const times = signedCalls.map((c) => c.at);
        expect(times.length).toBeGreaterThanOrEqual(15);
        expect(times.length).toBeLessThanOrEqual(Math.ceil(6 * MIN / ACTIVE_MS) + 1);
        expect(Math.min(...gaps(times))).toBeGreaterThanOrEqual(ACTIVE_MS);
        expect(Math.max(...gaps(times))).toBeLessThanOrEqual(ACTIVE_MS + 2 * SEC);
    });

    it('ឧបករណ៍មួយចាកចេញ ➜ ឧបករណ៍ដែលនៅសល់បន្តវេន (ចន្លោះ ÷ ២) · មិនដែលទុកសាខាឲ្យគ្មានអ្នកអាន', async () => {
        const codes = signEvery(T0 + 5 * MIN, 37 * SEC, 8);
        const a = await boot('a');
        await vi.advanceTimersByTimeAsync(SEC);
        await boot('b');
        await vi.advanceTimersByTimeAsync(SEC);
        await boot('c');
        await run(4 * MIN);
        leave(a);
        await run(6 * MIN);
        const lat = latencies(codes);
        expect(lat.length).toBeGreaterThanOrEqual(7);
        expect(Math.max(...lat), JSON.stringify(lat)).toBeLessThanOrEqual(ACTIVE_MS / 2 + 3 * SEC);
        const late = signedCalls.filter((c) => c.at > T0 + 5 * MIN);
        expect(late.some((c) => c.dev === 'a')).toBe(false);
        expect(new Set(late.map((c) => c.dev))).toEqual(new Set(['b', 'c']));
    });

    it('សាខាផ្សេង (Cookie ៖ ដែនអ៊ីមែល · Palm ៖ លេខសាខា) ➜ មិនរំលងវេនគ្នា ៖ ឧបករណ៍នីមួយៗអានដូចមុន', async () => {
        signEvery(T0 + MIN, 37 * SEC, 6);
        await boot('x', { email: 'staff@zoew123.com' });
        await boot('y', { email: 'staff@zoew124.com' });
        await boot('p', { palmSite: '85501' });
        await boot('q', { palmSite: '85502' });
        await run(5 * MIN);
        for (const dev of ['x', 'y', 'p', 'q']) {
            const mine = signedCalls.filter((c) => c.dev === dev).map((c) => c.at);
            expect(mine.length, dev).toBeGreaterThanOrEqual(Math.floor(5 * MIN / (ACTIVE_MS + 2 * SEC)));
        }
    });

    it('fail-open ៖ rules មិនទាន់ Publish (listener បដិសេធ) ➜ ឧបករណ៍នីមួយៗអានដូចមុន មិនរង់ចាំអ្នកផ្សេង', async () => {
        lanePolicy.deny = true;
        signEvery(T0 + MIN, 37 * SEC, 6);
        await boot('a');
        await boot('b');
        await run(5 * MIN);
        for (const dev of ['a', 'b']) {
            const mine = signedCalls.filter((c) => c.dev === dev).map((c) => c.at);
            expect(mine.length, dev).toBeGreaterThanOrEqual(Math.floor(5 * MIN / (ACTIVE_MS + 2 * SEC)));
        }
    });

    it('fail-open ៖ ការកក់វេនជាប់ (DB មិនឆ្លើយ) ➜ អានដោយខ្លួនឯងក្រោយពិដាន មិនជាប់គាំង', async () => {
        signEvery(T0 + MIN, 37 * SEC, 6);
        await boot('a');
        await run(30 * SEC);
        lanePolicy.hang = true;
        const before = signedCalls.length;
        await run(5 * MIN);
        const after = signedCalls.slice(before).map((c) => c.at);
        expect(after.length).toBeGreaterThanOrEqual(10);
        expect(Math.max(...gaps(after.slice(1))), 'ក្រោយការកក់ជាប់ម្តង ផ្អាកការកក់ ➜ អានតាមល្បឿនធម្មតា (មិនរង់ចាំពិដានរាល់ជុំ)').toBeLessThanOrEqual(ACTIVE_MS + 2 * SEC);
    });

    it('ការពិនិត្យដែលអ្នកប្រើចុច (force) ➜ អានភ្លាម ទោះឧបករណ៍ផ្សេងទើបអាន', async () => {
        signEvery(T0 + MIN, 37 * SEC, 4);
        const a = await boot('a');
        await vi.advanceTimersByTimeAsync(SEC);
        const b = await boot('b');
        await run(2 * MIN);
        const last = signedCalls[signedCalls.length - 1];
        const other = last.dev === 'a' ? b : a;
        for (const d of [a, b]) { clearTimeout(d.state.ztoState.ztoStatusSweepTimer); d.state.ztoState.ztoStatusSweepTimer = null; }
        const before = signedCalls.length;
        const forced = other.zto.runZtoStatusSweep(true);
        await vi.advanceTimersByTimeAsync(SEC);
        await forced;
        expect(signedCalls.length).toBe(before + 1);
        expect(signedCalls[signedCalls.length - 1].dev).toBe(other.name);
    });
});

describe('⛔ ហាង Supabase ៖ មិនផ្លាស់វេន (ការសម្រេចម្ចាស់គម្រោង ៖ ការកក់នីមួយៗជាការសរសេរដែលធ្វើឲ្យគ្រប់ទូរស័ព្ទទទួលសារ Realtime និងទាញ)', () => {
    it('ទូរស័ព្ទ Supabase ពីរក្នុងសាខាតែមួយ ➜ មិនសរសេរការកក់វេនទាល់តែសោះ · នីមួយៗអានតាមល្បឿនខ្លួនដូចមុនជម្រើស ឃ', async () => {
        signEvery(T0 + MIN, 37 * SEC, 6);
        await boot('a', { supabase: true });
        await vi.advanceTimersByTimeAsync(SEC);
        await boot('b', { supabase: true });
        await run(5 * MIN);
        expect(getPath(LANES), 'គ្មានការកក់វេនលើ Supabase').toBeNull();
        for (const dev of ['a', 'b']) {
            const mine = signedCalls.filter((c) => c.dev === dev).map((c) => c.at);
            expect(mine.length, dev + ' អានតាមល្បឿនខ្លួន').toBeGreaterThanOrEqual(Math.floor(5 * MIN / (ACTIVE_MS + 2 * SEC)));
            expect(Math.min(...gaps(mine)), dev + ' មិនអានញឹកជាងមុន').toBeGreaterThanOrEqual(ACTIVE_MS);
        }
    });

    it('ទិសផ្ទុយ ៖ ហាង Firebase ដដែល ➜ ផ្លាស់វេន (មានការកក់ក្នុង DB)', async () => {
        signEvery(T0 + MIN, 37 * SEC, 6);
        await boot('a');
        await vi.advanceTimersByTimeAsync(SEC);
        await boot('b');
        await run(2 * MIN);
        expect(getPath(LANES), 'Firebase ៖ មានការកក់វេន').not.toBeNull();
    });
});

describe('សោវេន (lane) ៖ តាមសាខា · តម្លៃខុស · ពេលអនាគត', () => {
    it('lane ៖ Palm តាមលេខសាខា · Cookie តាមដែនអ៊ីមែលគណនី · គ្មានព័ត៌មាន ➜ គ្មាន lane (អានដូចមុន)', async () => {
        const d = await boot('a');
        expect(d.lane, 'module zto-sweep-lane').toBeTruthy();
        const of = d.lane.ztoSweepLaneOf;
        expect(of({ palmAccount: { siteCode: '85501' } }, true)).toBe('palm_85501');
        expect(of({ palmAccount: { siteCode: ' AB-12 ' } }, true)).toBe('palm_ab-12');
        expect(of({}, true)).toBe('');
        d.state.firebaseState.auth.currentUser.email = 'Staff@ZoeW123.com';
        expect(of({}, false)).toBe('cookie_zoew123_com');
        d.state.firebaseState.auth.currentUser.email = '';
        expect(of({}, false)).toBe('');
        d.state.firebaseState.auth.currentUser.email = 'staff@' + 'x'.repeat(60) + '.com';
        expect(of({}, false)).toBe('');
    });

    it('វេនរបស់ឧបករណ៍ផ្សេងដែលមានត្រាពេលអនាគតឆ្ងាយ ➜ មិនរារាំង (កក់ជាន់ CAS) · ត្រាខុសទ្រង់ទ្រាយ ➜ មិនរាប់', async () => {
        signEvery(T0 + MIN, 37 * SEC, 4);
        setPath(LANES + '/cookie_zoew123_com', { device: 'zzzzzzzzzzzzzzzz', at: T0 + 60 * MIN });
        await boot('a');
        await run(2 * MIN);
        const mine = signedCalls.filter((c) => c.dev === 'a');
        expect(mine.length).toBeGreaterThanOrEqual(5);
        const lane = getPath(LANES + '/cookie_zoew123_com');
        expect(lane.device).not.toBe('zzzzzzzzzzzzzzzz');
        expect(lane.at).toBeLessThanOrEqual(Date.now());
    });

    it('CAS ៖ ឧបករណ៍ពីរដល់វេនក្នុងពេលតែមួយ ➜ តែមួយអាន', async () => {
        signEvery(T0 + MIN, 37 * SEC, 4);
        const a = await boot('a');
        const b = await boot('b');
        await run(3 * MIN);
        for (const d of [a, b]) { clearTimeout(d.state.ztoState.ztoStatusSweepTimer); d.state.ztoState.ztoStatusSweepTimer = null; }
        await vi.advanceTimersByTimeAsync(10 * SEC);
        setPath(LANES + '/cookie_zoew123_com', null);
        await vi.advanceTimersByTimeAsync(LAG_MS * 2);
        const before = signedCalls.length;
        a.state.ztoState.ztoSignedSweepAt = 0;
        b.state.ztoState.ztoSignedSweepAt = 0;
        const both = Promise.all([a.zto.runZtoStatusSweep(false), b.zto.runZtoStatusSweep(false)]);
        await vi.advanceTimersByTimeAsync(2 * SEC);
        await both;
        expect(signedCalls.length - before).toBe(1);
    });
});

describe('⛔ ឧបករណ៍ដែលទុកវេនឲ្យឧបករណ៍ផ្សេង នៅរក្សាការការពាររបស់ខ្លួន', () => {
    it('⛔ ការរង់ចាំ ៧ ថ្ងៃ ៖ ឧបករណ៍ស្ងាត់ដែលទុកវេនឲ្យឧបករណ៍កំពុងប្រើ ដោះការរង់ចាំតែក្រោយការអាន Sign ផ្ទាល់ខ្លួនដែលគ្របពេលទុំ (មុនកែ ៖ ក្រោយ ៣០ នាទី វាដោះភ្លាម ➜ ដកកញ្ចប់ដែលទើប Sign)', async () => {
        world.history.push(openItem('never', 'ZTC9999999'));
        world.history.push(openItem('stuck', 'ZTC9999998'));
        world.history.push(openItem('p2', 'ZTC8000001'));
        await boot('a');
        await vi.advanceTimersByTimeAsync(SEC);
        const b = await boot('b', { active: false });
        const stuckRipe = T0 + MIN;
        const cleanup = (now: number) => { if (now >= stuckRipe && (now - T0) % MIN === 0) b.zto.ztoAbandonCleanupIsHeld(stuckRipe); };
        await run(40 * MIN, cleanup);
        expect(signedCalls.filter((c) => c.dev === 'b').length, 'ឧបករណ៍ស្ងាត់នៅទុកវេន (មិនអានរៀងរាល់នាទីដូចអានម្នាក់ឯង)')
            .toBeLessThanOrEqual(10);
        const before = signedCalls.length;
        for (let i = 0; i < 30 && !signedCalls.slice(before).some((c) => c.dev === 'a'); i++) await run(SEC, cleanup);
        expect(signedCalls.slice(before).some((c) => c.dev === 'a'), 'ឧបករណ៍ a អានតាមវេន').toBe(true);
        const code = 'ZTC8000001';
        signedAt[code] = Date.now() + SEC;
        const ripe = Date.now() + 2 * SEC;
        const p2 = () => b.state.dataState.scanHistory.find((i: any) => i.id === 'p2').barcodes[0];
        const bBefore = signedCalls.filter((c) => c.dev === 'b').length;
        let released = 0;
        await run(3 * MIN, (now) => {
            cleanup(now);
            if (now < ripe || b.zto.ztoAbandonCleanupIsHeld(ripe)) return;
            if (!released) released = now;
            expect(p2().isClosed, 'ឧបករណ៍ b ដោះការរង់ចាំ ' + (now - ripe) + ' ms ក្រោយទុំ ខណៈកញ្ចប់ដែល Sign ក្នុង ZTO នៅបើក ➜ វានឹងដកលុយ').toBe(true);
        });
        expect(released, 'ការរង់ចាំដោះក្រោយការអានដែលគ្រប (មិនជាប់ដល់ពិដាន ៣០ នាទី)').toBeGreaterThan(0);
        expect(released - ripe).toBeLessThanOrEqual(2 * MIN);
        expect(signedCalls.filter((c) => c.dev === 'b').length - bBefore, 'ឧបករណ៍ b អានដោយខ្លួនឯងពេលការរង់ចាំសកម្ម').toBeGreaterThanOrEqual(1);
    });

    it('⛔ របារ «ZTO មិនទាន់បិទ» លើឧបករណ៍ស្ងាត់ ៖ ឧបករណ៍ដែលអានសរសេរភស្តុតាង Sign ទៅ server ភ្លាម ➜ របារលើឧបករណ៍ផ្សេងបាត់ក្នុង ≤ ZTO_SIGNED_SWEEP_ACTIVE_MS + ៥ វិ. (មុនកែ ៖ រង់ចាំជុំ ៦០ វិ.)', async () => {
        world.mirror = true;
        world.history.push(openItem('never', 'ZTC9999999'));
        const code = 'ZTC6000001';
        world.history.push({ ...openItem('q1', code), isClosed: true, closedAt: T0 - 10 * MIN,
            barcodes: [{ code, isClosed: true, closedAt: T0 - 10 * MIN, cod: 1, dod: 0 }] });
        for (const item of world.history) setPath(HISTORY + '/' + item.id, item);
        const a = await boot('a');
        a.zto.setZtoPickupVerdict(code, false);
        await vi.advanceTimersByTimeAsync(SEC);
        const b = await boot('b', { active: false });
        b.zto.setZtoPickupVerdict(code, false);
        await run(3 * MIN);
        const pending = () => b.zto.ztoStatusPendingCodes(b.state.dataState.scanHistory, []);
        expect(pending(), 'មុន Sign ៖ របារលើ b បង្ហាញកញ្ចប់').toContain(code);
        while ((Date.now() - a.bootAt) % MIN !== SEC) await run(SEC);
        const signAt = Date.now();
        signedAt[code] = signAt;
        let cleared = 0;
        await run(3 * MIN, (now) => { if (!cleared && !pending().includes(code)) cleared = now; });
        expect(cleared, 'របារលើ b បាត់').toBeGreaterThan(0);
        expect(cleared - signAt, 'Sign ➜ របារលើឧបករណ៍ស្ងាត់បាត់ (ms)').toBeLessThanOrEqual(ACTIVE_MS + 5 * SEC);
        expect(signedCalls.filter((c) => c.dev === 'b' && c.at >= signAt).length, 'ឧបករណ៍ b នៅទុកវេន (ភស្តុតាងមកពី a)').toBe(0);
        expect(VISIBLE_MS).toBeGreaterThan(ACTIVE_MS);
    });
});
