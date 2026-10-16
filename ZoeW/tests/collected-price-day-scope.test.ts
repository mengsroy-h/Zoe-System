/**
 * ⛔ ការកែតម្លៃកញ្ចប់ដែលបិទរួច ➜ `syncCollectedValueForBarcode()` ប៉ះតែ **ថ្ងៃដែលពាក់ព័ន្ធ** ក្នុង `zoew_daily_collected_cod_dod`
 *    មិនមែន root ទាំងមូល (root ទុក `DAILY_COLLECTED_KEEP_DAYS` ថ្ងៃ ៖ ១០០០ កញ្ចប់/ថ្ងៃ ≈ ២៥៩ KB · ៤០០០ ≈ ១ MB)។
 *    វាស់លើ SDK Firebase ពិត + emulator (proxy រាប់បៃ) ៖ transaction លើ root ផ្ញើ root ទាំងមូលឡើង ទាញមកវិញ ២ ដង ហើយឧបករណ៍ផ្សេងដែលស្តាប់
 *    root ទាញ root ទាំងមូលម្តងទៀត · transaction លើ `<ថ្ងៃ>/<key>` ≈ ៤៥០ បៃ។ Supabase ៖ CAS root = op មួយដែល `x` និង `v` = root ទាំងមូល ✕ ២។
 *    អ្នកយាមនេះរត់ `reconcileCollectedHistory(…, true)` ពិត លើ (ក) SDK ក្លែងតាមន័យ Firebase (transaction រត់លើ cache · server សម្រេច)
 *    (ខ) adapter Supabase ពិត + server ក្លែង (CAS តាមជម្រៅណាក៏បាន) ហើយរាប់បៃដែលផ្ញើ។
 *    ន័យដដែល ៖ តម្លៃថ្មីក្នុងថ្ងៃថ្មីបំផុតដែលកាន់ key · ថ្ងៃចាស់ស្ទួន ➜ លុប · គ្មាន key ➜ មិនបង្កើត · server បើក ➜ លុប ·
 *    ទិដ្ឋភាពចាស់ (ថ្ងៃដែល memory មិនស្គាល់) ➜ server នៅតែសម្រេច · ⛔ មិនប៉ះ barcode ផ្សេង។
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { dataState, firebaseState, uiState } from '../src/core/state';
import { getServerNow } from '../src/core/clock';
import { getZoneDateKey } from '../src/core/timezone';
import { syncCollectedValueForBarcode } from '../src/domain/collected';
import { pickupBarcodeKey } from '../src/domain/pickup';
import { createSupabaseDatabase } from '../src/services/supabase-rtdb';

const COLLECTED = 'zoew_daily_collected_cod_dod';
const HISTORY = 'zoew_scan_history_cod_dod';
const CODE = 'ZTX0001';
const KEY = pickupBarcodeKey(CODE);
const PER_DAY = 1000;
const MAX_SENT_BYTES = 2048;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const clone = (v: any) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const savedFb = firebaseState.fb;

const days = () => Array.from({ length: 7 }, (_, i) => getZoneDateKey(getServerNow(), -i));

function bigRoot(holding: Record<string, any>) {
    const root: any = {};
    days().forEach((day) => {
        root[day] = {};
        for (let i = 0; i < PER_DAY; i++) root[day]['ZTXFILL' + day.slice(-2) + String(i).padStart(6, '0')] = { c: 12.5, d: 0.75 };
    });
    Object.keys(holding).forEach((day) => { root[day] = { ...(root[day] || {}), [KEY]: holding[day] }; });
    return root;
}

function item(cod: number, closed: boolean) {
    const at = Date.now();
    return { id: 'item1', phone: '012000111', scanDate: days()[0], barcodes: [{ code: CODE, cod, dod: 0.5, isClosed: closed, closedAt: closed ? at : null }] };
}

const getAt = (node: any, parts: string[]) => parts.reduce((n, p) => (n && typeof n === 'object' ? (n[p] === undefined ? null : n[p]) : null), node);
const setAt = (node: any, parts: string[], value: any) => {
    if (!parts.length) return value;
    const out = node && typeof node === 'object' ? { ...node } : {};
    const next = setAt(out[parts[0]], parts.slice(1), value);
    if (next === null || (typeof next === 'object' && !Object.keys(next).length)) delete out[parts[0]];
    else out[parts[0]] = next;
    return Object.keys(out).length ? out : null;
};
const same = (a: any, b: any): boolean => {
    if (a === b) return true;
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return (a ?? null) === (b ?? null);
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    return ka.length === kb.length && ka.every((k) => same(a[k], b[k]));
};

type Backend = { name: string; server: () => any; sentBytes: () => number; collectedPaths: () => string[]; setServer: (path: string, v: any) => void; beforeFirstCollectedWrite: (fn: () => void) => void };

/** (ក) ន័យ Firebase ៖ transaction រត់លើ cache (ឧបករណ៍ស្តាប់ root ➜ cache = server) រួច server សម្រេចតាម hash ៖ ខុស ➜ រត់ម្តងទៀតលើតម្លៃ server។ */
function firebaseLike(tree: any, cache: any): Backend {
    let server = clone(tree);
    let local = clone(cache);
    let bytes = 0;
    let hook: null | (() => void) = null;
    const paths: string[] = [];
    const parts = (p: string) => p.split('/').filter(Boolean);
    const touch = (p: string, size: number) => { if (p === COLLECTED || p.startsWith(COLLECTED + '/')) { paths.push(p); bytes += size; } };
    firebaseState.fb = {
        ref: (_db: any, path: string) => ({ path }),
        get: async (ref: any) => { const v = clone(getAt(server, parts(ref.path))); return { val: () => v, exists: () => v !== null }; },
        runTransaction: async (ref: any, fn: any) => {
            let base = clone(getAt(local, parts(ref.path)));
            for (let i = 0; i < 25; i++) {
                const proposed = fn(clone(base));
                if (proposed === undefined) return { committed: false, snapshot: { val: () => clone(base) } };
                touch(ref.path, JSON.stringify({ d: proposed, h: 'x'.repeat(28) }).length);
                if (hook && ref.path.startsWith(COLLECTED)) { const run = hook; hook = null; run(); }
                const current = getAt(server, parts(ref.path));
                if (same(current, base)) {
                    server = setAt(server, parts(ref.path), clone(proposed)) || {};
                    local = clone(server);
                    return { committed: true, snapshot: { val: () => clone(proposed) } };
                }
                base = clone(current);
                local = clone(server);
            }
            throw new Error('maxretry');
        },
        update: async (ref: any, values: any) => {
            Object.keys(values).forEach((k) => {
                const full = ref.path + '/' + k;
                touch(full, JSON.stringify(values[k]).length + full.length);
                server = setAt(server, parts(full), clone(values[k])) || {};
            });
            local = clone(server);
        }
    } as any;
    return {
        name: 'firebase',
        server: () => server,
        sentBytes: () => bytes,
        collectedPaths: () => paths,
        setServer: (path, v) => { server = setAt(server, parts(path), clone(v)) || {}; },
        beforeFirstCollectedWrite: (fn) => { hook = fn; }
    };
}

/** (ខ) adapter Supabase ពិត ៖ server ក្លែងទុកឯកសារ `<root>/<key>` · CAS ផ្ទៀង `x` តាមជម្រៅណាក៏បាន · រាប់បៃ `p_ops` ពិតដែល adapter ផ្ញើ។ */
async function supabaseReal(tree: any): Promise<Backend & { close: () => void }> {
    let seq = 1;
    const docs = new Map<string, any>();
    Object.keys(tree).forEach((root) => Object.keys(tree[root]).forEach((k) => docs.set(root + '/' + k, clone(tree[root][k]))));
    let bytes = 0;
    let hook: null | (() => void) = null;
    const paths: string[] = [];
    const rootOf = (root: string) => {
        const out: any = {};
        docs.forEach((v, k) => { if (k.startsWith(root + '/') && v !== null) out[k.slice(root.length + 1)] = v; });
        return Object.keys(out).length ? out : null;
    };
    const valueAt = (p: string[]) => (p.length === 1 ? rootOf(p[0]) : getAt(docs.get(p[0] + '/' + p[1]) ?? null, p.slice(2)));
    const writeAt = (p: string[], v: any, changed: any[]) => {
        if (p.length === 1) {
            const keys = new Set([...Object.keys(rootOf(p[0]) || {}), ...Object.keys(v || {})]);
            keys.forEach((k) => writeAt([p[0], k], v ? v[k] ?? null : null, changed));
            return;
        }
        const k = p[0] + '/' + p[1];
        const next = setAt(docs.get(k) ?? null, p.slice(2), clone(v));
        docs.set(k, next);
        changed.push({ r: p[0], k: p[1], v: next, s: seq });
    };
    const rows = () => Array.from(docs.entries()).filter(([, v]) => v !== null).map(([k, v]) => ({ r: k.split('/')[0], k: k.slice(k.indexOf('/') + 1), v, s: seq }));
    const transport = {
        rpc: async (fn: string, args: any) => {
            if (fn === 'zoe_pull') return { seq, more: false, reset: true, head: seq, tenant: 't1', now: Date.now(), rows: rows() };
            if (fn === 'zoe_read') {
                const out: any[] = [];
                docs.forEach((v, k) => {
                    const [r, key] = [k.split('/')[0], k.slice(k.indexOf('/') + 1)];
                    if (r === args.p_root && (args.p_key === null || args.p_key === key)) out.push({ r, k: key, v, s: seq });
                });
                return { docs: out };
            }
            if (fn !== 'zoe_write') throw new Error('unexpected ' + fn);
            const size = JSON.stringify(args.p_ops).length;
            const collectedOps = args.p_ops.filter((op: any) => op.p[0] === COLLECTED);
            if (collectedOps.length) { bytes += size; collectedOps.forEach((op: any) => paths.push(op.p.join('/'))); }
            if (collectedOps.length && hook) { const run = hook; hook = null; run(); }
            for (const op of args.p_ops) {
                if (op.k === 'cas' && !same(valueAt(op.p), op.x ?? null)) return { ok: false, conflict: true, now: Date.now(), value: valueAt(op.p) };
            }
            seq++;
            const changed: any[] = [];
            args.p_ops.forEach((op: any) => writeAt(op.p, op.v ?? null, changed));
            return { ok: true, seq, now: Date.now(), docs: changed };
        },
        ping: async () => true,
        subscribe: () => () => {}
    };
    const db = createSupabaseDatabase(transport, { onListenerError: () => {}, onSynced: () => {}, onForbidden: () => {}, onTxOutcomeUnknown: () => {} },
        { retryStepsMs: [5, 10, 600000], pollFallbackMs: 600000, rpcTimeoutMs: 1000 });
    db.setTenantTopic('zoe:t1');
    db.setAuthed(true, 'scope');
    let fired = false;
    db.onValue(db.ref(COLLECTED), () => { fired = true; });
    for (let i = 0; i < 400 && !fired; i++) await wait(5);
    expect(fired).toBe(true);
    firebaseState.fb = {
        ref: (d: any, path: string) => d.ref(path),
        get: (ref: any) => ref._db.get(ref),
        runTransaction: (ref: any, fn: any) => ref._db.runTransaction(ref, fn),
        update: (ref: any, values: any) => ref._db.update(ref, values)
    } as any;
    firebaseState.db = db as any;
    firebaseState.dbRefDailyCollected = db.ref(COLLECTED) as any;
    return {
        name: 'supabase',
        server: () => {
            const out: any = {};
            [COLLECTED, HISTORY].forEach((r) => { const v = rootOf(r); if (v) out[r] = v; });
            return out;
        },
        sentBytes: () => bytes,
        collectedPaths: () => paths,
        setServer: (path, v) => { seq++; const p = path.split('/'); writeAt(p, v, []); },
        beforeFirstCollectedWrite: (fn) => { hook = fn; },
        close: () => db.close && db.close()
    };
}

let opened: any[] = [];
beforeEach(() => {
    opened = [];
    uiState.toasts = [];
    firebaseState.authGeneration = 1;
    firebaseState.db = { name: 'db' } as any;
    firebaseState.dbRefDailyCollected = { path: COLLECTED } as any;
});
afterEach(() => {
    opened.forEach((b) => { try { b.close(); } catch { } });
    firebaseState.fb = savedFb;
});

async function backendFor(kind: string, tree: any, viewCollected: any) {
    dataState.dailyCollectedData = clone(viewCollected);
    if (kind === 'firebase') return firebaseLike(tree, tree);
    const b = await supabaseReal(tree);
    opened.push(b);
    return b;
}

const collectedOf = (b: Backend) => (b.server()[COLLECTED] || {});
const holders = (b: Backend) => Object.keys(collectedOf(b)).filter((d) => collectedOf(b)[d] && collectedOf(b)[d][KEY]);
const unrelatedCount = (b: Backend) => Object.values(collectedOf(b)).reduce((n: number, d: any) => n + Object.keys(d).filter((k) => k !== KEY).length, 0);

for (const kind of ['firebase', 'supabase']) {
    describe('ការកែតម្លៃកញ្ចប់បិទ ➜ ប៉ះតែថ្ងៃពាក់ព័ន្ធ — ' + kind, () => {
        it('root ៧ ថ្ងៃ × ១០០០ ➜ តម្លៃថ្មីក្នុងថ្ងៃដដែល · បៃដែលផ្ញើ ≤ ២ KB · គ្មាន transaction លើ root ឬថ្ងៃទាំងមូល', async () => {
            const day = days()[0];
            const tree = { [HISTORY]: { item1: item(8.25, true) }, [COLLECTED]: bigRoot({ [day]: { c: 5, d: 0 } }) };
            const b = await backendFor(kind, tree, tree[COLLECTED]);
            const rootBytes = JSON.stringify(tree[COLLECTED]).length;
            expect(rootBytes).toBeGreaterThan(200000);
            const result = await syncCollectedValueForBarcode('item1', CODE);
            expect(result).toBe(true);
            expect(collectedOf(b)[day][KEY]).toEqual({ c: 8.25, d: 0.5 });
            expect(unrelatedCount(b)).toBe(7 * PER_DAY);
            expect(b.collectedPaths().every((p) => p.split('/').length === 3)).toBe(true);
            expect(b.sentBytes()).toBeLessThanOrEqual(MAX_SENT_BYTES);
        });

        it('key ស្ទួនពីរថ្ងៃ ➜ ថ្ងៃថ្មីជាងឈ្នះ · ថ្ងៃចាស់លុប', async () => {
            const [newer, , older] = days();
            const tree = { [HISTORY]: { item1: item(9, true) }, [COLLECTED]: bigRoot({ [newer]: { c: 5, d: 0 }, [older]: { c: 5, d: 0 } }) };
            const b = await backendFor(kind, tree, tree[COLLECTED]);
            expect(await syncCollectedValueForBarcode('item1', CODE)).toBe(true);
            expect(holders(b)).toEqual([newer]);
            expect(collectedOf(b)[newer][KEY]).toEqual({ c: 9, d: 0.5 });
            expect(unrelatedCount(b)).toBe(7 * PER_DAY);
            expect(b.sentBytes()).toBeLessThanOrEqual(MAX_SENT_BYTES);
        });

        it('គ្មាន key ក្នុងថ្ងៃណា ➜ មិនបង្កើត (key សម្អាតរួច) · ជោគជ័យ', async () => {
            const tree = { [HISTORY]: { item1: item(9, true) }, [COLLECTED]: bigRoot({}) };
            const b = await backendFor(kind, tree, tree[COLLECTED]);
            expect(await syncCollectedValueForBarcode('item1', CODE)).toBe(true);
            expect(holders(b)).toEqual([]);
            expect(unrelatedCount(b)).toBe(7 * PER_DAY);
            expect(b.sentBytes()).toBeLessThanOrEqual(MAX_SENT_BYTES);
        });

        it('server បើក barcode វិញ ➜ ដកចេញពីថ្ងៃដែលកាន់', async () => {
            const day = days()[1];
            const tree = { [HISTORY]: { item1: item(9, false) }, [COLLECTED]: bigRoot({ [day]: { c: 5, d: 0 } }) };
            const b = await backendFor(kind, tree, tree[COLLECTED]);
            expect(await syncCollectedValueForBarcode('item1', CODE)).toBe(true);
            expect(holders(b)).toEqual([]);
            expect(unrelatedCount(b)).toBe(7 * PER_DAY);
        });

        it('ទិដ្ឋភាព memory មិនស្គាល់ថ្ងៃដែល server កាន់ key ➜ server នៅតែសម្រេច (តម្លៃថ្មី)', async () => {
            const day = days()[3];
            const tree = { [HISTORY]: { item1: item(7.5, true) }, [COLLECTED]: bigRoot({ [day]: { c: 5, d: 0 } }) };
            const view = clone(tree[COLLECTED]);
            delete view[day][KEY];
            const b = await backendFor(kind, tree, view);
            expect(await syncCollectedValueForBarcode('item1', CODE)).toBe(true);
            expect(collectedOf(b)[day][KEY]).toEqual({ c: 7.5, d: 0.5 });
            expect(holders(b)).toEqual([day]);
        });
        it('ឧបករណ៍ ២ ៖ បើក barcode វិញ (លុប key) មុន transaction យើងចុះ ➜ server សម្រេច ៖ មិនបង្កើតឡើងវិញ', async () => {
            const day = days()[0];
            const tree = { [HISTORY]: { item1: item(9, true) }, [COLLECTED]: bigRoot({ [day]: { c: 5, d: 0 } }) };
            const b = await backendFor(kind, tree, tree[COLLECTED]);
            b.beforeFirstCollectedWrite(() => b.setServer(COLLECTED + '/' + day + '/' + KEY, null));
            await syncCollectedValueForBarcode('item1', CODE);
            expect(holders(b)).toEqual([]);
            expect(unrelatedCount(b)).toBe(7 * PER_DAY);
        });

        it('ឧបករណ៍ ២ ៖ សរសេរតម្លៃចាស់ក្នុងថ្ងៃដដែល មុន transaction យើងចុះ ➜ តម្លៃ server របស់ item ឈ្នះ', async () => {
            const day = days()[0];
            const tree = { [HISTORY]: { item1: item(9, true) }, [COLLECTED]: bigRoot({ [day]: { c: 5, d: 0 } }) };
            const b = await backendFor(kind, tree, tree[COLLECTED]);
            b.beforeFirstCollectedWrite(() => b.setServer(COLLECTED + '/' + day + '/' + KEY, { c: 3, d: 0 }));
            expect(await syncCollectedValueForBarcode('item1', CODE)).toBe(true);
            expect(holders(b)).toEqual([day]);
            expect(collectedOf(b)[day][KEY]).toEqual({ c: 9, d: 0.5 });
        });

        it('ថ្ងៃប្តូរ ៖ ឧបករណ៍ ២ ផ្លាស់ key ពីថ្ងៃចាស់ទៅថ្ងៃថ្មី (ពហុផ្លូវ) ពេលយើងកំពុងសរសេរ ➜ នៅតែមួយថ្ងៃ · ថ្ងៃថ្មី · តម្លៃថ្មី', async () => {
            const [newer, , older] = days();
            const tree = { [HISTORY]: { item1: item(9, true) }, [COLLECTED]: bigRoot({ [older]: { c: 5, d: 0 } }) };
            const b = await backendFor(kind, tree, tree[COLLECTED]);
            b.beforeFirstCollectedWrite(() => {
                b.setServer(COLLECTED + '/' + older + '/' + KEY, null);
                b.setServer(COLLECTED + '/' + newer + '/' + KEY, { c: 5, d: 0 });
            });
            await syncCollectedValueForBarcode('item1', CODE);
            expect(holders(b)).toEqual([newer]);
            expect(collectedOf(b)[newer][KEY]).toEqual({ c: 9, d: 0.5 });
            expect(unrelatedCount(b)).toBe(7 * PER_DAY);
        });
    });
}
