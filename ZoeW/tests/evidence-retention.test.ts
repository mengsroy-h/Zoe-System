// root ភស្តុតាង (`zoew_scan_operations` · `zoew_registry_releases` · `zoew_trash_consumptions`) ធ្លាប់កើនរហូត (rules ទទួលតែការសរសេរ
// ដែលមានតម្លៃ) ➜ ការបោស `runEvidenceRetentionSweep()` លុបតែកំណត់ត្រាចាស់ជាង EVIDENCE_RETENTION_MS ដែលគ្មានទិន្នន័យរស់ណាយោង
// (registry · scan_pending · ធុងសំរាម · history · restore finalization) តាម query REST មានព្រំដែន ហើយមិនសរសេរក្រោយ session ប្តូរ។
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { dataState, firebaseState } from '../src/core/state';
import { dbListenerFailedPaths, dbListenerPendingPaths, DB_LISTENER_KEY_DELETED } from '../src/core/text';
import { EVIDENCE_RETENTION_MS, EVIDENCE_SWEEP_BATCH, EVIDENCE_SWEEP_GAP_MS, evidenceSweep, runEvidenceRetentionSweep } from '../src/services/evidence-retention';

const HOST = 'https://audit-evidence.firebaseio.com';
const NOW = Date.UTC(2026, 10, 5, 2);
const OLD = NOW - EVIDENCE_RETENTION_MS - 2 * 86400000, YOUNG = NOW - EVIDENCE_RETENTION_MS + 86400000;
const lab = { store: {} as any, deletes: [] as string[], afterRead: null as null | ((p: string) => void) };
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
function sdk() {
    return {
        ref: (_db: any, p = '') => ref(p),
        get: async (r: any) => snap(r, getAt(r.path)),
        update: async (r: any, ups: any) => {
            const paths = Object.keys(ups).map((k) => [r.path, k].filter(Boolean).join('/'));
            if (paths.some((p) => ups[p.slice(r.path ? r.path.length + 1 : 0)] !== null || !rulesAllowDelete(p))) throw Object.assign(new Error('permission_denied'), { code: 'PERMISSION_DENIED' });
            for (const p of paths) { lab.deletes.push(p); setAt(p, null); }
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
        const field = JSON.parse(orderBy), endAt = Number(url.searchParams.get('endAt')), limit = Number(url.searchParams.get('limitToFirst'));
        expect(limit).toBe(EVIDENCE_SWEEP_BATCH);
        const picked = Object.entries(value && typeof value === 'object' ? value : {})
            .filter(([, v]: any) => typeof v?.[field] === 'number' && v[field] <= endAt)
            .sort(([a, x]: any, [b, y]: any) => x[field] - y[field] || (a < b ? -1 : 1)).slice(0, limit);
        value = picked.length ? Object.fromEntries(picked) : null;
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
    lab.store = {}; lab.deletes = []; lab.afterRead = null;
    evidenceSweep.at = 0; evidenceSweep.running = false;
    dbListenerPendingPaths.clear(); dbListenerFailedPaths.clear();
    firebaseState.authGeneration++; firebaseState.db = { name: 'audit-evidence-db' } as any; firebaseState.fb = sdk() as any;
    firebaseState.auth = { currentUser: { uid: 'audit-user', getIdToken: async () => 'synthetic-id' } } as any;
    firebaseState.firebaseConfig = { databaseURL: HOST } as any;
    localStorage.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: HOST }));
    firebaseState.isDatabaseInitialized = true; firebaseState.isDatabaseConnected = true; firebaseState.hasEverConnectedToDatabase = true;
    firebaseState.dbListenersFailed = false; firebaseState.serverClockTrusted = true; firebaseState.serverTimeOffsetMs = 0;
    vi.stubGlobal('fetch', vi.fn(serverRead));
});
afterEach(() => { firebaseState.authGeneration++; vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); localStorage.clear(); });

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
    const rules = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../firebase-database.rules.json'), 'utf8')).rules;
    const age = 'now - ' + EVIDENCE_RETENTION_MS;
    const scan = rules.zoew_scan_operations, rel = rules.zoew_registry_releases, con = rules.zoew_trash_consumptions;
    expect(scan['.indexOn']).toEqual(['birth']); expect(rel['.indexOn']).toEqual(['deletedAt']); expect(con['.indexOn']).toEqual(['deletedAt']);
    expect(scan.$scanId['.write']).toContain("data.child('birth').val() < " + age);
    expect(scan.$scanId['.write']).toContain("root.child('zoew_scan_pending').child($scanId).exists()");
    expect(rel.$releaseId['.write']).toContain("data.child('deletedAt').val() < " + age);
    expect(con.$sourceId['.write']).toContain("data.child('deletedAt').val() < " + age);
    expect(con.$sourceId['.write']).toContain("root.child('zoew_restore_finalizations').child($sourceId).exists()");
});
