// root ភស្តុតាង (`zoew_scan_operations` · `zoew_registry_releases` · `zoew_trash_consumptions`) ធ្លាប់កើនរហូត (rules ទទួលតែការសរសេរ
// ដែលមានតម្លៃ) ➜ ការបោស `runEvidenceRetentionSweep()` លុបតែកំណត់ត្រាចាស់ជាង EVIDENCE_RETENTION_MS ដែលគ្មានទិន្នន័យរស់ណាយោង
// (registry · scan_pending · ធុងសំរាម · history · restore finalization) តាម query REST មានព្រំដែន ហើយមិនសរសេរក្រោយ session ប្តូរ។
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { acceptFixtureSession } from './helpers/accepted-session';
import { dataState, firebaseState } from '../../../../ZoeW/src/core/state';
import { acceptServerClockOffset, resetServerClock } from '../../../../ZoeW/src/core/clock';
import * as storage from '../../../../ZoeW/src/core/storage';
import * as evidenceRetention from '../../../../ZoeW/src/services/evidence-retention';
import { dbListenerFailedPaths, dbListenerPendingPaths, DB_LISTENER_KEY_DELETED } from '../../../../ZoeW/src/core/text';
import { EVIDENCE_RETENTION_MS, EVIDENCE_SWEEP_BATCH, EVIDENCE_SWEEP_GAP_MS, evidenceSweep, runEvidenceRetentionSweep } from '../../../../ZoeW/src/services/evidence-retention';

const HOST = 'https://audit-evidence.firebaseio.com';
const NOW = Date.UTC(2026, 10, 5, 2);
const OLD = NOW - EVIDENCE_RETENTION_MS - 2 * 86400000, YOUNG = NOW - EVIDENCE_RETENTION_MS + 86400000;
type Page = { at: string; backend: 'native' | 'supabase'; order: string; after: string | null; limit: number; keys: string[] };
const lab = { store: {} as any, deletes: [] as string[], pages: [] as Page[], writes: [] as string[][], unknownDelete: null as null | 'landed' | 'unsent',
    beforeWrite: null as null | ((paths: string[]) => void), unordered: false, nativeArrays: false, failListing: false, tenant: 'shop-a',
    afterRead: null as null | ((p: string) => void), afterDelete: null as null | (() => void) };

// Execute only the comparator and its literal dependencies from the installed SDK.
// This oracle is independent of the retention service's cursor comparator.
const firebaseSource = fs.readFileSync(createRequire(import.meta.url).resolve('@firebase/database'), 'utf8');
const firebaseNames = ['MIN_NAME', 'MAX_NAME', 'INTEGER_REGEXP_', 'INTEGER_32_MIN', 'INTEGER_32_MAX', 'tryParseInt', 'nameCompare'];
const firebaseComparatorSource = firebaseNames.map(name => {
    const pattern = name === 'tryParseInt' || name === 'nameCompare'
        ? new RegExp('const ' + name + ' = function \\([^]*?\\n};')
        : new RegExp('const ' + name + ' = [^\\n]+;');
    const match = firebaseSource.match(pattern);
    if (!match) throw new Error('Installed Firebase comparator changed: ' + name);
    return match[0];
}).join('\n');
const firebaseKeyCompare: (a: string, b: string) => number = vm.runInNewContext(firebaseComparatorSource + '\nnameCompare;');
const lexicalCompare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const clone = <V,>(v: V): V => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
const parts = (p: string) => p.split('/').filter(Boolean);
const getAt = (p: string) => clone(parts(p).reduce((n: any, k) => n?.[k], lab.store) ?? null);
function setAt(p: string, v: any) {
    const segs = parts(p); const leaf = segs.pop()!; let node = lab.store;
    for (const s of segs) node = node[s] ||= {};
    if (v === null || v === undefined) delete node[leaf]; else node[leaf] = clone(v);
}
const ref = (p = '') => ({ path: p, key: parts(p).at(-1) || null, toString: () => HOST + '/' + p });
const snap = (r: any, v: any) => ({ ref: r, key: r.key, val: () => clone(v), exists: () => v !== null && v !== undefined });
const scanId = (c: string) => 'scan_' + c.repeat(32);
const op = (id: string, phase: string, birth: number, registryKey = 'ZT' + id.slice(5, 9)) => ({ v: 2, id, actorUid: 'u', phase, birth, registryKey, code: registryKey });
const release = (id: string, deletedAt: number, trashId: string, registryKey: string) => ({ v: 1, id, kind: 'scan', deletedAt, trashId, registryKey, releasedBy: 'u' });
const consumption = (sourceId: string, deletedAt: number) => ({ v: 1, sourceId, generation: 1, kind: 'purge', actorUid: 'u', scope: 's', deletedAt, rowBirth: 1 });

// កំណែ JS នៃលក្ខខណ្ឌលុបក្នុង rules ពិត ៖ ការលុបដែល rules បដិសេធ ➜ បោះកំហុស (App មិនត្រូវព្យាយាម)
function rulesAllowDelete(p: string) {
    const [root, key] = parts(p), value = getAt(p), now = NOW, cutoff = now - EVIDENCE_RETENTION_MS;
    if (!value) return true;
    const intent = (k: string) => getAt('zoew_barcode_registry/' + k)?.intent;
    if (root === 'zoew_scan_operations') return ['committed', 'cancelled'].includes(value.phase) && value.birth < cutoff
        && getAt('zoew_scan_pending/' + key) === null && intent(value.registryKey) !== key;
    if (root === 'zoew_registry_releases') return value.deletedAt < cutoff && getAt('zoew_recently_deleted_cod_dod/' + value.trashId) === null && intent(value.registryKey) !== key;
    if (root === 'zoew_trash_consumptions') return value.deletedAt < cutoff && getAt('zoew_recently_deleted_cod_dod/' + key) === null
        && getAt('zoew_scan_history_cod_dod/' + key) === null && getAt('zoew_restore_finalizations/' + key) === null;
    return false;
}
function sdk(supabase = false) {
    return {
        __supabase: supabase,
        tenantScope: () => lab.tenant,
        evidenceCandidates: vi.fn(async (_auth: any, root: string, before: number, limit: number, after?: string) => {
            const field = root === 'zoew_scan_operations' ? 'birth' : 'deletedAt';
            const picked = Object.entries(getAt(root) || {}).filter(([key, value]: any) => Number.isFinite(value?.[field])
                && value[field] < before && (!after || lexicalCompare(key, after) > 0))
                .sort(([a], [b]) => lexicalCompare(a, b)).slice(0, limit);
            lab.pages.push({ at: root, backend: 'supabase', order: 'key', after: after || null, limit, keys: picked.map(([key]) => key) });
            if (lab.failListing) { lab.failListing = false; throw new Error('temporary listing failure'); }
            lab.afterRead?.(root);
            return picked.map(([k, v]) => ({ r: root, k, v }));
        }),
        ref: (_db: any, p = '') => supabase ? { ...ref(p), toString: () => 'supabase://audit/' + p } : ref(p),
        get: async (r: any) => { const value = getAt(r.path); lab.afterRead?.(r.path); return snap(r, value); },
        update: async (r: any, ups: any) => {
            const paths = Object.keys(ups).map((k) => [r.path, k].filter(Boolean).join('/'));
            lab.writes.push(paths); lab.beforeWrite?.(paths);
            const unknown = lab.unknownDelete; lab.unknownDelete = null;
            if (unknown === 'unsent') throw Object.assign(new Error('lost delete acknowledgement'), { code: 'disconnect', txOutcome: 'unknown' });
            if (paths.some((p) => ups[p.slice(r.path ? r.path.length + 1 : 0)] !== null || !rulesAllowDelete(p))) throw Object.assign(new Error('permission_denied'), { code: 'PERMISSION_DENIED' });
            for (const p of paths) { lab.deletes.push(p); setAt(p, null); }
            lab.afterDelete?.();
            if (unknown === 'landed') throw Object.assign(new Error('lost delete acknowledgement'), { code: 'disconnect', txOutcome: 'unknown' });
        },
        onValue: () => () => {}, off: () => {}
    };
}
function serverRead(input: string | URL | Request) {
    const url = new URL(String(input));
    if (url.hostname !== new URL(HOST).hostname || !url.pathname.endsWith('.json')) throw new Error('Unexpected request: ' + input);
    expect(url.searchParams.get('auth')).toBe('synthetic-id');
    const at = decodeURIComponent(url.pathname.slice(1, -5));
    let value = getAt(at);
    const orderBy = url.searchParams.get('orderBy');
    if (orderBy !== null) {
        const order = JSON.parse(orderBy), limit = Number(url.searchParams.get('limitToFirst'));
        const after = url.searchParams.has('startAt') ? JSON.parse(url.searchParams.get('startAt')!) : null;
        const picked = Object.entries(value && typeof value === 'object' ? value : {})
            .filter(([, v]) => v !== null && v !== undefined)
            .filter(([key, v]: any) => order === '$key' ? after === null || firebaseKeyCompare(key, after) >= 0
                : typeof v?.[order] === 'number' && v[order] <= Number(url.searchParams.get('endAt')))
            .sort(([a, x]: any, [b, y]: any) => order === '$key' ? firebaseKeyCompare(a, b) : x[order] - y[order] || lexicalCompare(a, b))
            .slice(0, limit);
        expect(limit).toBe(EVIDENCE_SWEEP_BATCH + (order === '$key' && after !== null ? 1 : 0));
        lab.pages.push({ at, backend: 'native', order, after, limit, keys: picked.map(([key]) => key) });
        if (lab.failListing) { lab.failListing = false; return Promise.reject(new Error('temporary listing failure')); }
        value = picked.length ? Object.fromEntries(lab.unordered ? picked.reverse() : picked) : null;
        if (lab.nativeArrays && picked.length && picked.every(([key]) => /^\d+$/.test(key))) {
            value = [];
            for (const [key, child] of picked) value[Number(key)] = child;
        }
    }
    lab.afterRead?.(at);
    return Promise.resolve(new Response(JSON.stringify(value), { status: 200, headers: { 'Content-Type': 'application/json' } }));
}
function seed() {
    const a = scanId('a'), b = scanId('b'), c = scanId('c'), d = scanId('d'), e = scanId('e'), f = scanId('f'), g = scanId('g'), h = scanId('h');
    lab.store = {
        zoew_scan_operations: {
            [a]: op(a, 'committed', OLD), [b]: op(b, 'committed', OLD, 'ZTLIVE'), [c]: op(c, 'committed', YOUNG),
            [d]: op(d, 'prepared', OLD), [e]: op(e, 'cancelled', OLD), [f]: op(f, 'cancelled', OLD)
        },
        zoew_barcode_registry: { ZTLIVE: { v: 2, intent: b, actorUid: 'u', birth: OLD }, ZTREL2: { v: 2, intent: h, actorUid: 'u', birth: OLD } },
        zoew_scan_pending: { [f]: 'u' },
        zoew_registry_releases: {
            [g]: release(g, OLD, 'trash_gone', 'ZTREL1'), [h]: release(h, OLD, 'trash_gone', 'ZTREL2'),
            [a]: release(a, OLD, 'trash_live', 'ZTREL3'), [e]: release(e, YOUNG, 'trash_gone', 'ZTREL4')
        },
        zoew_recently_deleted_cod_dod: { trash_live: { id: 'trash_live', deletedAt: OLD, barcodes: [] } },
        zoew_scan_history_cod_dod: { row_live: { id: 'row_live', phone: '012', barcodes: [] } },
        zoew_restore_finalizations: { row_final: { targetId: 'row_final' } },
        zoew_trash_consumptions: {
            row_gone: consumption('row_gone', OLD), row_live: consumption('row_live', OLD), trash_live: consumption('trash_live', OLD),
            row_final: consumption('row_final', OLD), row_young: consumption('row_young', YOUNG)
        }
    };
    dataState.scanHistory = Object.values(getAt('zoew_scan_history_cod_dod') || {});
    dataState.deletedItems = Object.values(getAt('zoew_recently_deleted_cod_dod') || {});
    return { a, b, c, d, e, f, g, h };
}
const keys = (root: string) => Object.keys(getAt(root) || {}).sort();

beforeEach(() => {
    vi.useFakeTimers(); vi.setSystemTime(NOW);
    lab.store = {}; lab.deletes = []; lab.pages = []; lab.writes = []; lab.unknownDelete = null; lab.beforeWrite = null; lab.afterRead = null; lab.afterDelete = null; lab.unordered = false; lab.nativeArrays = false; lab.failListing = false; lab.tenant = 'shop-a';
    evidenceSweep.at = 0; evidenceSweep.running = false;
    (evidenceSweep as any).owner = null; (evidenceSweep as any).cursors = {};
    dbListenerPendingPaths.clear(); dbListenerFailedPaths.clear();
    firebaseState.authGeneration++; firebaseState.db = { name: 'audit-evidence-db' } as any; firebaseState.fb = sdk() as any;
    firebaseState.isInitializingFirebase = false;
    firebaseState.auth = { currentUser: { uid: 'audit-user', getIdToken: async () => 'synthetic-id' } } as any;
    firebaseState.firebaseConfig = { databaseURL: HOST } as any;
    localStorage.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: HOST }));
    acceptFixtureSession();
    firebaseState.isDatabaseInitialized = true; firebaseState.isDatabaseConnected = true; firebaseState.hasEverConnectedToDatabase = true;
    firebaseState.sessionExpiryCheck = 'live';
    firebaseState.dbListenersFailed = false; firebaseState.serverClockTrusted = true; firebaseState.serverTimeOffsetMs = 0;
    vi.stubGlobal('fetch', vi.fn(serverRead));
});
afterEach(() => { firebaseState.authGeneration++; vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); localStorage.clear(); });

it.each([false, true])('ព្រំអាយុអប្បបរមារក្សាភស្តុតាងជិតកំណត់ backend=%s', async supabase => {
    firebaseState.fb = sdk(supabase) as any;
    vi.spyOn(performance, 'now').mockReturnValue(1000); resetServerClock();
    expect(acceptServerClockOffset(0, Object.freeze({ epochMs: NOW - 1000, estimateEpochMs: NOW,
        uncertaintyMs: 2000, wallMs: NOW, monotonicMs: 1000 }), false)).toBe(true);
    firebaseState.sessionExpiryCheck = 'live';
    const uncertain = scanId('a'), old = scanId('b');
    const cutoff = NOW - EVIDENCE_RETENTION_MS - evidenceRetention.EVIDENCE_RETENTION_MARGIN_MS;
    lab.store = { zoew_scan_operations: { [uncertain]: op(uncertain, 'committed', cutoff - 500), [old]: op(old, 'committed', cutoff - 1500) } };
    await runEvidenceRetentionSweep();
    expect(keys('zoew_scan_operations')).toEqual([uncertain]);
    expect(lab.deletes).toEqual(['zoew_scan_operations/' + old]);
});

it('លុបតែភស្តុតាងចាស់ដែលគ្មានអ្វីយោង ហើយទុកអ្វីៗផ្សេងទាំងអស់ (rules ពិតមិនបដិសេធការលុបណាមួយ)', async () => {
    const id = seed();
    expect(await runEvidenceRetentionSweep()).toBe(4);
    expect(keys('zoew_scan_operations')).toEqual([id.b, id.c, id.d, id.f].sort());
    expect(keys('zoew_registry_releases')).toEqual([id.a, id.e, id.h].sort());
    expect(keys('zoew_trash_consumptions')).toEqual(['row_final', 'row_live', 'row_young', 'trash_live']);
    expect(lab.deletes.sort()).toEqual(['zoew_registry_releases/' + id.g, 'zoew_scan_operations/' + id.a, 'zoew_scan_operations/' + id.e, 'zoew_trash_consumptions/row_gone'].sort());
    expect(getAt('zoew_barcode_registry')).toEqual(seedRegistry(id));
});
function seedRegistry(id: Record<string, string>) {
    return { ZTLIVE: { v: 2, intent: id.b, actorUid: 'u', birth: OLD }, ZTREL2: { v: 2, intent: id.h, actorUid: 'u', birth: OLD } };
}

it('ច្រកទ្វារ ៖ នាឡិកា server មិនទុកចិត្ត · ទិដ្ឋភាពធុងសំរាមចាស់ · ចន្លោះពេល ➜ មិនលុប', async () => {
    seed();
    firebaseState.serverClockTrusted = false;
    expect(await runEvidenceRetentionSweep()).toBe(0);
    firebaseState.serverClockTrusted = true;
    dbListenerPendingPaths.add(DB_LISTENER_KEY_DELETED);
    expect(await runEvidenceRetentionSweep()).toBe(0);
    dbListenerPendingPaths.clear();
    expect(lab.deletes).toEqual([]);
    expect(await runEvidenceRetentionSweep()).toBe(4);
    seed();
    expect(await runEvidenceRetentionSweep()).toBe(0);
    vi.setSystemTime(NOW + EVIDENCE_SWEEP_GAP_MS);
    expect(await runEvidenceRetentionSweep()).toBe(4);
});

it('ច្រកទ្វារ ៖ ការសរសេរកំពុងស្ដារ · ស្ដារមិនបាន · រង់ចាំ (phase មិនទាន់ ready ឬ pendingWrites) ➜ មិនបោស និងមិនអានអ្វី', async () => {
    seed();
    const recovery = { blocked: 0, recovering: true, pending: 0 };
    (firebaseState.db as any).recoveryState = () => ({ ...recovery });
    expect(await runEvidenceRetentionSweep()).toBe(0);
    recovery.recovering = false; recovery.blocked = 1;
    expect(await runEvidenceRetentionSweep()).toBe(0);
    recovery.blocked = 0; recovery.pending = 2;
    expect(await runEvidenceRetentionSweep()).toBe(0);
    expect({ deletes: lab.deletes, reads: (fetch as any).mock.calls.length }).toEqual({ deletes: [], reads: 0 });
    recovery.pending = 0;
    expect(await runEvidenceRetentionSweep()).toBe(4);
});

it('session ប្តូរកណ្តាលការបោស ➜ គ្មានការលុបតាមក្រោយ', async () => {
    seed();
    lab.afterRead = (at) => { if (at === 'zoew_scan_operations') firebaseState.authGeneration++; };
    expect(await runEvidenceRetentionSweep()).toBe(0);
    expect(lab.deletes).toEqual([]);
});

it('query មានព្រំដែន ៖ កំណត់ត្រាចាស់ច្រើនជាងមួយជុំ ➜ ជុំនីមួយៗលុបមិនលើស EVIDENCE_SWEEP_BATCH ក្នុងមួយ root', async () => {
    lab.store = { zoew_scan_operations: {} };
    for (let i = 0; i < EVIDENCE_SWEEP_BATCH + 7; i++) {
        const id = 'scan_' + i.toString(16).padStart(32, '0');
        lab.store.zoew_scan_operations[id] = op(id, 'committed', OLD - i, 'ZK' + i);
    }
    dataState.scanHistory = []; dataState.deletedItems = [];
    expect(await runEvidenceRetentionSweep()).toBe(EVIDENCE_SWEEP_BATCH);
    expect(keys('zoew_scan_operations')).toHaveLength(7);
});

it('rules ពិតមានលក្ខខណ្ឌលុបដូចគ្នា ៖ អាយុ EVIDENCE_RETENTION_MS · scan_pending · registry · ធុងសំរាម · history · restore finalization · index', () => {
    const rules = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../../firebase-database.rules.json'), 'utf8')).rules;
    const age = 'now - ' + EVIDENCE_RETENTION_MS;
    const scan = rules.zoew_scan_operations, rel = rules.zoew_registry_releases, con = rules.zoew_trash_consumptions;
    expect(scan['.indexOn']).toEqual(['birth']); expect(rel['.indexOn']).toEqual(['deletedAt']); expect(con['.indexOn']).toEqual(['deletedAt']);
    expect(scan.$scanId['.write']).toContain("data.child('birth').val() < " + age);
    expect(scan.$scanId['.write']).toContain("root.child('zoew_scan_pending').child($scanId).exists()");
    expect(rel.$releaseId['.write']).toContain("data.child('deletedAt').val() < " + age);
    expect(con.$sourceId['.write']).toContain("data.child('deletedAt').val() < " + age);
    expect(con.$sourceId['.write']).toContain("root.child('zoew_restore_finalizations').child($sourceId).exists()");
});


function heldHead(equalBirth = false) {
    const root = 'zoew_scan_operations', held = [];
    lab.store = { [root]: {}, zoew_scan_pending: {} };
    for (let i = 0; i < EVIDENCE_SWEEP_BATCH + 1; i++) {
        const id = 'scan_' + i.toString(16).padStart(32, '0');
        lab.store[root][id] = op(id, 'committed', equalBirth ? OLD : OLD + i, 'ZH' + i);
        if (i < EVIDENCE_SWEEP_BATCH) { lab.store.zoew_scan_pending[id] = 'u'; held.push(id); }
    }
    dataState.scanHistory = []; dataState.deletedItems = [];
    return { root, held, tail: 'scan_' + EVIDENCE_SWEEP_BATCH.toString(16).padStart(32, '0') };
}
const nextSweep = async () => { vi.setSystemTime(Date.now() + EVIDENCE_SWEEP_GAP_MS); return runEvidenceRetentionSweep(); };

it.each([false, true])('held evidence head never starves safe tail (equal birth: %s)', async (equalBirth) => {
    const { root, held, tail } = heldHead(equalBirth);
    expect(await runEvidenceRetentionSweep()).toBe(0);
    expect(await nextSweep()).toBe(1);
    expect(getAt(root + '/' + tail)).toBeNull();
    expect(keys(root)).toEqual(held);
});


function useSupabase() {
    firebaseState.fb = sdk(true) as any;
    firebaseState.db = { name: 'audit-supabase-db', app: { options: { supabaseUrl: 'https://audit.supabase.co' } } } as any;
    (firebaseState.auth as any).app = { options: { supabaseUrl: 'https://audit.supabase.co' } };
    firebaseState.firebaseConfig = { supabaseUrl: 'https://audit.supabase.co' };
    localStorage.setItem('zoew_firebase_config', JSON.stringify({ supabaseUrl: 'https://audit.supabase.co' }));
    acceptFixtureSession();
}
const rootPages = (root: string) => lab.pages.filter(page => page.at === root);
const savedCursors = () => Object.fromEntries(Object.keys(localStorage).filter(key => key !== 'zoew_firebase_config').map(key => [key, localStorage.getItem(key)]));

it('native query oracle follows installed Firebase integer-key ordering', () => {
    const input = ['a', '2147483648', '10', '02', '2', '-1', '0', '00', '-2147483648', '_', 'z', '00000000001', '1'];
    expect([...input].sort(firebaseKeyCompare)).toEqual(['-2147483648', '-1', '0', '00', '1', '00000000001', '2', '02', '10', '2147483648', '_', 'a', 'z']);
    expect([...input].sort(lexicalCompare)).not.toEqual([...input].sort(firebaseKeyCompare));
});

it.each(['native', 'supabase'])('%s progresses independently through held pages of all three evidence roots', async backend => {
    const { root, held, tail } = heldHead(true);
    const releases: Record<string, any> = {}, consumptions: Record<string, any> = {};
    for (const [i, key] of [...held, tail].entries()) {
        releases[key] = release(key, OLD, key, 'ZR' + i);
        consumptions[key] = consumption(key, OLD);
        if (i < EVIDENCE_SWEEP_BATCH) setAt('zoew_recently_deleted_cod_dod/' + key, { id: key });
    }
    lab.store.zoew_registry_releases = releases;
    lab.store.zoew_trash_consumptions = consumptions;
    if (backend === 'supabase') useSupabase();
    expect(await runEvidenceRetentionSweep()).toBe(0);
    expect(await nextSweep()).toBe(3);
    for (const at of [root, 'zoew_registry_releases', 'zoew_trash_consumptions']) {
        expect(getAt(at + '/' + tail)).toBeNull();
        expect(rootPages(at)).toHaveLength(2);
        expect(rootPages(at)[1].after).toBe(held.at(-1));
        expect(lab.deletes.filter(p => p.startsWith(at + '/'))).toHaveLength(1);
    }
    if (backend === 'supabase') expect(fetch).not.toHaveBeenCalled();
});

it.each(['young', 'malformed'])('native raw %s head advances before age/schema filtering', async kind => {
    const { root, held, tail } = heldHead(true);
    lab.store.zoew_scan_pending = {};
    for (const key of held) lab.store[root][key] = kind === 'young' ? op(key, 'committed', YOUNG, 'ZY') : 'invalid receipt';
    expect(await runEvidenceRetentionSweep()).toBe(0);
    expect(rootPages(root)[0]).toMatchObject({ order: '$key', limit: EVIDENCE_SWEEP_BATCH });
    expect(await nextSweep()).toBe(1);
    expect(rootPages(root)[1]).toMatchObject({ after: held.at(-1), limit: EVIDENCE_SWEEP_BATCH + 1 });
    expect(getAt(root + '/' + tail)).toBeNull();
    expect(keys(root)).toEqual(held);
});

it.each(['native', 'supabase'])('%s continues if another device deletes the cursor key', async backend => {
    const { root, held, tail } = heldHead(true);
    if (backend === 'supabase') useSupabase();
    expect(await runEvidenceRetentionSweep()).toBe(0);
    setAt(root + '/' + held.at(-1), null);
    expect(await nextSweep()).toBe(1);
    expect(getAt(root + '/' + tail)).toBeNull();
    expect(rootPages(root)[1].after).toBe(held.at(-1));
});

it.each(['native', 'supabase'])('%s wraps after the tail and revisits a newly eligible held head', async backend => {
    const { root, held, tail } = heldHead(true);
    if (backend === 'supabase') useSupabase();
    expect(await runEvidenceRetentionSweep()).toBe(0);
    expect(await nextSweep()).toBe(1);
    expect(getAt(root + '/' + tail)).toBeNull();
    setAt('zoew_scan_pending/' + held[0], null);
    // A full final page may need one empty request to establish the end of a lap.
    let removed = await nextSweep();
    if (!removed) removed += await nextSweep();
    expect(removed).toBe(1);
    expect(getAt(root + '/' + held[0])).toBeNull();
    expect(rootPages(root).at(-1)?.after).toBeNull();
});

it('native paging sorts unordered response objects with Firebase key semantics', async () => {
    const root = 'zoew_trash_consumptions';
    const all = ['-2147483648', '-1', '0', '00', '1', '00000000001', '2', '02', '10', '2147483648', ...Array.from({ length: EVIDENCE_SWEEP_BATCH + 7 }, (_, i) => 'row_' + String(i).padStart(3, '0'))];
    const ordered = [...all].sort(firebaseKeyCompare), held = ordered.slice(0, EVIDENCE_SWEEP_BATCH), tail = ordered.slice(EVIDENCE_SWEEP_BATCH);
    lab.store = { [root]: Object.fromEntries([...all].reverse().map(key => [key, consumption(key, OLD)])),
        zoew_scan_history_cod_dod: Object.fromEntries(held.map(key => [key, { id: key }])) };
    dataState.scanHistory = []; dataState.deletedItems = []; lab.unordered = true;
    expect(await runEvidenceRetentionSweep()).toBe(0);
    expect(await nextSweep()).toBe(tail.length);
    expect(rootPages(root)[0].keys).toEqual(held);
    expect(rootPages(root)[1].after).toBe(held.at(-1));
    expect(lab.deletes.map(p => parts(p).at(-1)).sort()).toEqual(tail.sort());
});

it.each(['native', 'supabase'])('%s retries the same cursor after a transient listing failure', async backend => {
    const { root, held, tail } = heldHead(true);
    if (backend === 'supabase') useSupabase();
    expect(await runEvidenceRetentionSweep()).toBe(0);
    const beforeFailure = savedCursors();
    lab.failListing = true;
    expect(await nextSweep()).toBe(0);
    expect(savedCursors()).toEqual(beforeFailure);
    expect(await nextSweep()).toBe(1);
    expect(getAt(root + '/' + tail)).toBeNull();
    expect(rootPages(root).slice(1).map(p => p.after)).toEqual([held.at(-1), held.at(-1)]);
});

it('native raw-page deletion remains bounded when the overlap cursor disappeared', async () => {
    const { root, held } = heldHead(true);
    for (let i = EVIDENCE_SWEEP_BATCH + 1; i < EVIDENCE_SWEEP_BATCH * 2 + 9; i++) {
        const key = 'scan_' + i.toString(16).padStart(32, '0');
        lab.store[root][key] = op(key, 'committed', OLD, 'ZB' + i);
    }
    expect(await runEvidenceRetentionSweep()).toBe(0);
    setAt(root + '/' + held.at(-1), null);
    expect(await nextSweep()).toBe(EVIDENCE_SWEEP_BATCH);
    expect(lab.deletes).toHaveLength(EVIDENCE_SWEEP_BATCH);
    expect(await nextSweep()).toBe(9);
});

it('localStorage refusal preserves live cursor progress in memory', async () => {
    const { root, tail } = heldHead(true);
    // Keep the already resolved shop readable while only advisory cursor storage fails.
    const get = storage.safeStoreGet;
    vi.spyOn(storage, 'safeStoreGet').mockImplementation((store, key) => key === 'zoew_firebase_config' ? get(store, key) : null);
    vi.spyOn(storage, 'safeStoreSet').mockReturnValue(false);
    expect(await runEvidenceRetentionSweep()).toBe(0);
    expect(await nextSweep()).toBe(1);
    expect(getAt(root + '/' + tail)).toBeNull();
});

const ownerChanges = ['db', 'sdk', 'auth', 'generation', 'uid', 'scope'] as const;
function switchOwner(change: typeof ownerChanges[number]) {
    const saved = { db: firebaseState.db, fb: firebaseState.fb, auth: firebaseState.auth, generation: firebaseState.authGeneration,
        uid: firebaseState.auth.currentUser.uid, config: localStorage.getItem('zoew_firebase_config')! };
    if (change === 'db') firebaseState.db = { name: 'new-db' } as any;
    if (change === 'sdk') firebaseState.fb = sdk() as any;
    if (change === 'auth') firebaseState.auth = { currentUser: { uid: 'audit-user', getIdToken: async () => 'synthetic-id' } } as any;
    if (change === 'generation') firebaseState.authGeneration++;
    if (change === 'uid') firebaseState.auth.currentUser.uid = 'other-user';
    if (change === 'scope') localStorage.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: HOST + '/other' }));
    return () => {
        firebaseState.db = saved.db; firebaseState.fb = saved.fb; firebaseState.auth = saved.auth;
        firebaseState.authGeneration = saved.generation; firebaseState.auth.currentUser.uid = saved.uid;
        localStorage.setItem('zoew_firebase_config', saved.config);
    };
}

it.each(ownerChanges.flatMap(change => ['token', 'listing', 'holder'].map(stage => [change, stage] as const)))('%s switch at %s await cannot publish a cursor or start a delete', async (change, stage) => {
    const { root, held, tail } = heldHead(true);
    expect(await runEvidenceRetentionSweep()).toBe(0);
    const beforeSwitch = savedCursors();
    let restore: (() => void) | undefined;
    const flip = () => { if (!restore) restore = switchOwner(change); };
    if (stage === 'token') {
        firebaseState.auth.currentUser.getIdToken = async () => { flip(); return 'synthetic-id'; };
    } else {
        lab.afterRead = at => {
            if (at === (stage === 'listing' ? root : 'zoew_scan_pending/' + tail)) flip();
        };
    }
    expect(await nextSweep()).toBe(0);
    expect(restore).toBeTypeOf('function');
    expect(lab.deletes).toEqual([]);
    expect(savedCursors()).toEqual(beforeSwitch);
    restore!();
    firebaseState.auth.currentUser.getIdToken = async () => 'synthetic-id'; lab.afterRead = null;
    expect(await nextSweep()).toBe(1);
    expect(getAt(root + '/' + tail)).toBeNull();
    expect(rootPages(root).at(-1)?.after).toBe(held.at(-1));
});

it('server clock controls retention after an initially wrong device clock', async () => {
    seed();
    const wrongDeviceNow = NOW + EVIDENCE_RETENTION_MS * 3;
    vi.setSystemTime(wrongDeviceNow);
    firebaseState.serverClockTrusted = false;
    expect(await runEvidenceRetentionSweep()).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
    firebaseState.serverTimeOffsetMs = NOW - wrongDeviceNow;
    firebaseState.serverClockTrusted = true;
    expect(await runEvidenceRetentionSweep()).toBe(4);
    expect(getAt('zoew_scan_operations/' + scanId('c'))).not.toBeNull();
});


it.each(['native', 'supabase'])('%s boot reload resumes the persisted held-head cursor', async backend => {
    const { root, held, tail } = heldHead(true);
    if (backend === 'supabase') useSupabase();
    expect(await runEvidenceRetentionSweep()).toBe(0);
    const cursorKey = evidenceRetention.evidenceCursorKey(backend === 'supabase' ? 'https://audit.supabase.co#shop-a' : HOST, 'audit-user');
    const persisted = JSON.parse(localStorage.getItem(cursorKey)!);
    expect(persisted).toMatchObject({ v: 1, uid: 'audit-user', roots: { [root]: held.at(-1) } });
    // Reset all exported process state while retaining only storage, like a reboot.
    (evidenceSweep as any).owner = null; (evidenceSweep as any).cursors = {}; evidenceSweep.at = 0; evidenceSweep.running = false;
    firebaseState.authGeneration++;
    firebaseState.db = { ...firebaseState.db } as any;
    firebaseState.fb = sdk(backend === 'supabase') as any;
    expect(await runEvidenceRetentionSweep()).toBe(1);
    expect(getAt(root + '/' + tail)).toBeNull();
    expect(rootPages(root)[1].after).toBe(held.at(-1));
});

it.each(['uid', 'scope'])('a persisted cursor never crosses another %s', async identity => {
    const { root } = heldHead(true);
    expect(await runEvidenceRetentionSweep()).toBe(0);
    (evidenceSweep as any).owner = null; (evidenceSweep as any).cursors = {};
    if (identity === 'uid') firebaseState.auth.currentUser.uid = 'other-user';
    else localStorage.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: HOST + '/other' }));
    expect(await nextSweep()).toBe(0);
    expect(rootPages(root).at(-1)?.after).toBeNull();
    expect(lab.deletes).toEqual([]);
});

it.each(['bad JSON', 'wrong version', 'forbidden key', 'too long key'])('invalid advisory cursor fails safely (%s)', async problem => {
    const { root } = heldHead(true);
    const cursorKey = evidenceRetention.evidenceCursorKey(HOST, 'audit-user');
    const payload = { v: 1, scope: HOST, uid: 'audit-user', roots: { [root]: 'scan_' + '0'.repeat(32) } };
    if (problem === 'wrong version') payload.v = 999;
    if (problem === 'forbidden key') payload.roots[root] = 'unsafe/key';
    if (problem === 'too long key') payload.roots[root] = 'x'.repeat(769);
    localStorage.setItem(cursorKey, problem === 'bad JSON' ? '{broken' : JSON.stringify(payload));
    expect(await runEvidenceRetentionSweep()).toBe(0);
    expect(rootPages(root)[0].after).toBeNull();
    expect(lab.deletes).toEqual([]);
});

it.each(['unicode', 'long'])('native malformed %s receipt keys advance and survive cursor reload', async shape => {
    const root = 'zoew_scan_operations', tail = scanId('z');
    const rawKeys = Array.from({ length: EVIDENCE_SWEEP_BATCH }, (_, i) => 'a' + String(i).padStart(3, '0') + (shape === 'unicode' ? '\u1780' : 'x'.repeat(140)));
    lab.store = { [root]: Object.fromEntries(rawKeys.map(key => [key, 'malformed'])), zoew_scan_pending: {} };
    lab.store[root][tail] = op(tail, 'committed', OLD, 'ZTAIL');
    dataState.scanHistory = []; dataState.deletedItems = [];
    expect(await runEvidenceRetentionSweep()).toBe(0);
    (evidenceSweep as any).owner = null; (evidenceSweep as any).cursors = {};
    expect(await nextSweep()).toBe(1);
    expect(rootPages(root)[1].after).toBe(rawKeys.at(-1));
    expect(getAt(root + '/' + tail)).toBeNull();
    expect(keys(root)).toEqual(rawKeys);
});

it.each(['native', 'supabase'])('%s session switch after delete ACK cannot publish a cursor or write another root', async backend => {
    const { root, tail } = heldHead(true);
    const other = scanId('z');
    lab.store.zoew_registry_releases = { [other]: release(other, OLD, 'gone', 'ZOTHER') };
    if (backend === 'supabase') useSupabase();
    // Advance only the scan root on the first pass; introduce another-root candidate later.
    delete lab.store.zoew_registry_releases;
    expect(await runEvidenceRetentionSweep()).toBe(0);
    lab.store.zoew_registry_releases = { [other]: release(other, OLD, 'gone', 'ZOTHER') };
    const persisted = savedCursors();
    const pagesBefore = lab.pages.length;
    lab.afterDelete = () => { firebaseState.authGeneration++; };
    await nextSweep();
    expect(lab.deletes).toEqual([root + '/' + tail]);
    expect(getAt('zoew_registry_releases/' + other)).not.toBeNull();
    expect(lab.pages.slice(pagesBefore).map(page => page.at)).toEqual([root]);
    expect(savedCursors()).toEqual(persisted);
});


it('native array-shaped pages ignore null holes and advance through numeric keys', async () => {
    const root = 'zoew_trash_consumptions', held = Array.from({ length: EVIDENCE_SWEEP_BATCH }, (_, i) => String(i + 1));
    const tail = String(EVIDENCE_SWEEP_BATCH + 1);
    lab.store = { [root]: [null, ...[...held, tail].map(key => consumption(key, OLD))],
        zoew_scan_history_cod_dod: Object.fromEntries(held.map(key => [key, { id: key }])) };
    dataState.scanHistory = []; dataState.deletedItems = []; lab.nativeArrays = true;
    expect(await runEvidenceRetentionSweep()).toBe(0);
    expect(await nextSweep()).toBe(1);
    expect(rootPages(root)[1].after).toBe(held.at(-1));
    expect(lab.deletes).toEqual([root + '/' + tail]);
});

it('an unavailable Supabase paging capability never falls back to full-tree reads', async () => {
    heldHead(true); useSupabase();
    delete (firebaseState.fb as any).evidenceCandidates;
    const get = vi.spyOn(firebaseState.fb as any, 'get');
    expect(await runEvidenceRetentionSweep()).toBe(0);
    expect(get).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(lab.deletes).toEqual([]);
});


it.each(['unsent', 'landed'] as const)('unknown delete outcome (%s) preserves its cursor and never starts individual retries', async outcome => {
    const { root, held } = heldHead(true);
    for (let i = EVIDENCE_SWEEP_BATCH + 1; i < EVIDENCE_SWEEP_BATCH * 2 + 7; i++) {
        const key = 'scan_' + i.toString(16).padStart(32, '0');
        lab.store[root][key] = op(key, 'committed', OLD, 'ZU' + i);
    }
    expect(await runEvidenceRetentionSweep()).toBe(0);
    const checkpoint = savedCursors();
    lab.unknownDelete = outcome;
    expect(await nextSweep()).toBe(0);
    expect(lab.writes).toHaveLength(1);
    expect(lab.writes[0]).toHaveLength(EVIDENCE_SWEEP_BATCH);
    expect(savedCursors()).toEqual(checkpoint);
    expect(lab.deletes).toHaveLength(outcome === 'landed' ? EVIDENCE_SWEEP_BATCH : 0);
    expect(await nextSweep()).toBe(outcome === 'landed' ? 7 : EVIDENCE_SWEEP_BATCH);
    expect(rootPages(root).slice(1).map(page => page.after)).toEqual([held.at(-1), held.at(-1)]);
    expect(lab.writes).toHaveLength(2);
    if (outcome === 'unsent') expect(await nextSweep()).toBe(7);
});

it.each(['native', 'supabase'])('%s definitive batch refusal retries records and retains a newly held receipt', async backend => {
    const root = 'zoew_scan_operations', ids = Array.from({ length: 3 }, (_, i) => scanId(String(i)));
    lab.store = { [root]: Object.fromEntries(ids.map((id, i) => [id, op(id, 'committed', OLD, 'ZRACE' + i)])) };
    dataState.scanHistory = []; dataState.deletedItems = [];
    if (backend === 'supabase') useSupabase();
    lab.beforeWrite = () => {
        lab.beforeWrite = null;
        setAt('zoew_scan_pending/' + ids[0], 'u');
    };
    expect(await runEvidenceRetentionSweep()).toBe(2);
    expect(lab.writes.map(paths => paths.length)).toEqual([3, 1, 1, 1]);
    expect(keys(root)).toEqual([ids[0]]);
    expect(lab.deletes).toEqual(ids.slice(1).map(id => root + '/' + id));
});

it.each(['native', 'supabase'])('%s listing failure in one root leaves the other roots live', async backend => {
    const id = seed();
    if (backend === 'supabase') useSupabase();
    lab.failListing = true;
    expect(await runEvidenceRetentionSweep()).toBe(2);
    expect(getAt('zoew_scan_operations/' + id.a)).not.toBeNull();
    expect(getAt('zoew_scan_operations/' + id.e)).not.toBeNull();
    expect(getAt('zoew_registry_releases/' + id.g)).toBeNull();
    expect(getAt('zoew_trash_consumptions/row_gone')).toBeNull();
    expect(await nextSweep()).toBe(2);
    expect(getAt('zoew_scan_operations/' + id.a)).toBeNull();
    expect(getAt('zoew_scan_operations/' + id.e)).toBeNull();
    expect(rootPages('zoew_scan_operations').map(page => page.after)).toEqual([null, null]);
});

it.each(['listing', 'holder'])('Supabase tenant change after %s read fences the old cursor and writes', async stage => {
    const { root, tail } = heldHead(true); useSupabase();
    expect(await runEvidenceRetentionSweep()).toBe(0);
    const checkpoint = savedCursors();
    lab.afterRead = at => { if (at === (stage === 'listing' ? root : 'zoew_scan_pending/' + tail)) lab.tenant = 'shop-b'; };
    expect(await nextSweep()).toBe(0);
    expect(lab.deletes).toEqual([]);
    expect(savedCursors()).toEqual(checkpoint);
    lab.tenant = 'shop-a'; lab.afterRead = null;
    expect(await nextSweep()).toBe(1);
    expect(getAt(root + '/' + tail)).toBeNull();
});

it.each([NaN, Infinity, -Infinity])('invalid server-clock offset %s starts no evidence effects', async offset => {
    seed();
    firebaseState.serverTimeOffsetMs = offset;
    expect(await runEvidenceRetentionSweep()).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
    expect(lab.writes).toEqual([]);
    expect(savedCursors()).toEqual({});
    firebaseState.serverTimeOffsetMs = 0; firebaseState.serverClockTrusted = true;
    expect(await runEvidenceRetentionSweep()).toBe(4);
    expect(lab.deletes).toHaveLength(4);
});

it.each([NaN, Infinity, -Infinity])('clock becoming %s during a holder read cannot delete or checkpoint', async offset => {
    const { root, tail } = heldHead(true);
    expect(await runEvidenceRetentionSweep()).toBe(0);
    const checkpoint = savedCursors();
    lab.afterRead = at => { if (at === 'zoew_scan_pending/' + tail) firebaseState.serverTimeOffsetMs = offset; };
    expect(await nextSweep()).toBe(0);
    expect(lab.writes).toEqual([]);
    expect(savedCursors()).toEqual(checkpoint);
    firebaseState.serverTimeOffsetMs = 0; firebaseState.serverClockTrusted = true; lab.afterRead = null;
    expect(await nextSweep()).toBe(1);
    expect(getAt(root + '/' + tail)).toBeNull();
});

it('alternating owners preserve their independent cursor progress', async () => {
    const { root, held, tail } = heldHead(true);
    expect(await runEvidenceRetentionSweep()).toBe(0);
    firebaseState.auth.currentUser.uid = 'other-user';
    acceptFixtureSession();
    expect(await runEvidenceRetentionSweep()).toBe(0);
    expect(rootPages(root).at(-1)?.after).toBeNull();
    firebaseState.auth.currentUser.uid = 'audit-user';
    acceptFixtureSession();
    expect(await runEvidenceRetentionSweep()).toBe(1);
    expect(rootPages(root).at(-1)?.after).toBe(held.at(-1));
    expect(getAt(root + '/' + tail)).toBeNull();
});

it('សម័យមិនទាន់ផ្ទៀងផ្ទាត់ទុកភស្តុតាងចាស់ រួចបន្តក្រោយផ្ទៀងផ្ទាត់', async () => {
    seed();
    firebaseState.sessionExpiryCheck = 'unverified';
    expect(await runEvidenceRetentionSweep()).toBe(0);
    expect(lab.deletes).toEqual([]);
    firebaseState.sessionExpiryCheck = 'live';
    expect(await runEvidenceRetentionSweep()).toBe(4);
});

it('សម័យបាត់ការផ្ទៀងផ្ទាត់ពេលអានមិនត្រូវលុបភស្តុតាង', async () => {
    seed();
    lab.afterRead = () => { firebaseState.sessionExpiryCheck = 'unverified'; };
    expect(await runEvidenceRetentionSweep()).toBe(0);
    expect(lab.deletes).toEqual([]);
});

it('អាចអានភស្តុតាងដែលគ្មានអ្នកកាន់ ទោះសម័យមិនទាន់ផ្ទៀងផ្ទាត់', async () => {
    const ids = seed();
    await runEvidenceRetentionSweep();
    seed();
    firebaseState.sessionExpiryCheck = 'unverified';
    expect(await evidenceRetention.evidenceRetirable(evidenceSweep.owner!, 'zoew_scan_operations', ids.a,
        getAt('zoew_scan_operations/' + ids.a), NOW - EVIDENCE_RETENTION_MS)).toBe(true);
});


it('ឯករាជ្យ៖ ពិនិត្យព្រំពេលអប្បបរមាថ្មីក្រោយរង់ចាំអានភស្តុតាង', async () => {
    firebaseState.fb = sdk(true) as any;
    vi.spyOn(performance, 'now').mockReturnValue(1000);
    resetServerClock();
    expect(acceptServerClockOffset(0, Object.freeze({ epochMs: NOW, uncertaintyMs: 0, wallMs: Date.now(), monotonicMs: 1000 }), true)).toBe(true);
    firebaseState.sessionExpiryCheck = 'live';
    const id = scanId('a');
    lab.store = { zoew_scan_operations: { [id]: op(id, 'committed', NOW - EVIDENCE_RETENTION_MS - 3600000 - 500) } };
    dataState.scanHistory = []; dataState.deletedItems = [];
    lab.afterRead = p => {
        if (p === 'zoew_scan_pending/' + id) {
            expect(acceptServerClockOffset(0, Object.freeze({ epochMs: NOW - 1500, uncertaintyMs: 0, wallMs: Date.now(), monotonicMs: 1000 }), false)).toBe(true);
        }
    };
    await runEvidenceRetentionSweep();
    expect(lab.deletes).toEqual([]);
});

it.each(['fallback', 'reset-resample', 'older-control'])('ឯករាជ្យ៖ ពិនិត្យពេលមុនលុបភស្តុតាងរាល់ជំហានក្រោយ %s', async mode => {
    firebaseState.fb = sdk(true) as any;
    vi.spyOn(performance, 'now').mockReturnValue(1000);
    resetServerClock();
    const sample = (at: number) => acceptServerClockOffset(0, Object.freeze({ epochMs: at, uncertaintyMs: 0, wallMs: Date.now(), monotonicMs: 1000 }), false);
    expect(sample(NOW)).toBe(true); firebaseState.sessionExpiryCheck = 'live';
    const id = scanId('a');
    lab.store = { zoew_scan_operations: { [id]: op(id, 'committed', NOW - EVIDENCE_RETENTION_MS - 3600000 - (mode === 'older-control' ? 5000 : 500)) } };
    dataState.scanHistory = []; dataState.deletedItems = [];
    if (mode === 'fallback') {
        lab.beforeWrite = () => {
            lab.beforeWrite = null;
            expect(sample(NOW - 1500)).toBe(true);
            throw Object.assign(new Error('permission_denied'), { code: 'PERMISSION_DENIED' });
        };
    } else {
        lab.afterRead = p => {
            if (p !== 'zoew_scan_pending/' + id) return;
            if (mode === 'reset-resample') resetServerClock();
            expect(sample(NOW - 1500)).toBe(true); firebaseState.sessionExpiryCheck = 'live';
        };
    }
    await runEvidenceRetentionSweep();
    expect(lab.deletes).toEqual(mode === 'older-control' ? ['zoew_scan_operations/' + id] : []);
});
