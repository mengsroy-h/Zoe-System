import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import * as barcodes from '../src/domain/barcode';

const NOW = Date.UTC(2026, 9, 29, 4);
const PATH = 'zoew_scan_history_cod_dod/parcel';
const SOURCE = ts.transpileModule(readFileSync(path.join(__dirname, '../src/domain/trash-claim.ts'), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
}).outputText;
const copy = (value: any) => value === undefined ? value : JSON.parse(JSON.stringify(value));
let server: any;
let storage: Map<string, string>;
let writes: number;
let denyStorage: boolean;

function lockManager() {
    const held = new Set<string>();
    const releases = new Map<string, () => void>();
    return {
        held,
        request: vi.fn((name: string, options: any, callback?: any) => {
            const cb = callback || options;
            if (held.has(name)) return Promise.resolve(cb(null));
            held.add(name);
            const crashed = new Promise<void>(resolve => releases.set(name, resolve));
            const work = Promise.resolve().then(() => cb({ name }));
            return Promise.race([work, crashed]).finally(() => { held.delete(name); releases.delete(name); });
        }),
        crash: async () => { releases.forEach(release => release()); await Promise.resolve(); await Promise.resolve(); }
    };
}

function tab(locks?: ReturnType<typeof lockManager>) {
    const state = { db: { test: true }, fb: null as any, authGeneration: 1 };
    const scope = () => 'firebase:https://tab-claim.firebaseio.com|user';
    const store = {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => { if (denyStorage) throw new Error('quota'); storage.set(key, value); },
        removeItem: (key: string) => storage.delete(key)
    };
    const modules: Record<string, any> = {
        '../core/state': { firebaseState: state },
        '../core/clock': { getServerNow: () => Date.now() },
        '../core/shop-scope': { liveShopScope: scope },
        '../core/storage': {
            appLocalStore: store,
            safeStoreGet: (s: typeof store, key: string) => s.getItem(key),
            safeStoreSet: (s: typeof store, key: string, value: string) => { try { s.setItem(key, value); return true; } catch { return false; } },
            safeStoreRemove: (s: typeof store, key: string) => s.removeItem(key)
        },
        './barcode': barcodes,
        '../services/network': { dbOp: (p: Promise<any>) => p, dbOpStalled: () => false },
        '../services/db-listeners': { dbListenerViewIsStale: () => false },
        '../core/text': { DB_LISTENER_KEY_HISTORY: 'history' }
    };
    state.fb = {
        ref: (_db: any, path: string) => ({ path }),
        runTransaction: async (ref: { path: string }, update: (v: any) => any) => {
            expect(ref.path).toBe(PATH);
            const next = update(copy(server));
            if (next !== undefined) { server = copy(next); writes++; }
            return { committed: next !== undefined, snapshot: { val: () => copy(server) } };
        }
    };
    const exports: any = {};
    vm.runInNewContext(SOURCE, { exports, require: (name: string) => {
        if (!modules[name]) throw new Error('Unexpected import: ' + name);
        return modules[name];
    }, navigator: locks ? { locks } : {}, Date, Math, Map, Set, Promise, console, setTimeout, clearTimeout });
    return { api: exports, scope, state };
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(NOW);
    server = { id: 'parcel', barcodes: [{ code: 'TAB001', cod: 12.5, dod: 1, isClosed: false }] };
    storage = new Map(); writes = 0; denyStorage = false;
});
afterEach(() => vi.useRealTimers());

it('tab B មិនចាត់ទុក journal របស់ tab A ថាជា claim ស្លាប់', async () => {
    const locks = lockManager(); const a = tab(locks); const b = tab(locks);
    const claim = a.api.beginTrashClaim('parcel');
    await claim.start(); await a.api.claimTrashBarcodes('parcel', claim.token, () => ['TAB001']);
    expect(b.api.trashClaimHeldByOther(server.barcodes[0], 'new_token_b', NOW)).toBe(true);
    await claim.settle(false);
});

it('tab B មិនលួច claim របស់ tab A ដែលកំពុងរង់ចាំចម្លើយ', async () => {
    const locks = lockManager(); const a = tab(locks); const b = tab(locks);
    const claim = a.api.beginTrashClaim('parcel');
    await claim.start(); await a.api.claimTrashBarcodes('parcel', claim.token, () => ['TAB001']);
    const before = copy(server);
    const result = await b.api.claimTrashBarcodes('parcel', 'new_token_b', () => ['TAB001']);
    expect(result.state).toBe('busy');
    expect(server).toEqual(before);
    await claim.settle(false);
});

it('ការសង្គ្រោះ tab B មិនដោះ claim រស់របស់ tab A', async () => {
    const locks = lockManager(); const a = tab(locks); const b = tab(locks);
    const claim = a.api.beginTrashClaim('parcel');
    await claim.start(); await a.api.claimTrashBarcodes('parcel', claim.token, () => ['TAB001']);
    const before = copy(server); const priorWrites = writes;
    await b.api.releaseLeftoverTrashClaims(b.scope(), () => true);
    expect(server).toEqual(before); expect(writes).toBe(priorWrites);
    expect(b.api.pendingTrashClaims(b.scope())).toHaveLength(1);
    await claim.settle(false);
});

it('ក្រោយ tab A ស្លាប់ សោ browser រលត់ ➜ tab B ដោះ claim រួចស្កេនបន្តបាន', async () => {
    const locks = lockManager(); const a = tab(locks); const b = tab(locks);
    const claim = a.api.beginTrashClaim('parcel');
    await claim.start(); await a.api.claimTrashBarcodes('parcel', claim.token, () => ['TAB001']);
    await locks.crash();
    await b.api.releaseLeftoverTrashClaims(b.scope(), () => true);
    expect(server.barcodes[0].trashClaim).toBeUndefined();
    expect(b.api.pendingTrashClaims(b.scope())).toEqual([]);
    expect((await b.api.claimTrashBarcodes('parcel', 'new_token_b', () => ['TAB001'])).state).toBe('claimed');
});

it('គ្មាន Web Locks ៖ tab B មិនសន្មត claim ថ្មីជាស្លាប់ · ផុត lease ទើបដោះ', async () => {
    const a = tab(); const b = tab(); const claim = a.api.beginTrashClaim('parcel');
    await claim.start(); await a.api.claimTrashBarcodes('parcel', claim.token, () => ['TAB001']);
    const before = copy(server);
    await b.api.releaseLeftoverTrashClaims(b.scope(), () => true);
    expect(server).toEqual(before);
    vi.setSystemTime(NOW + a.api.trashClaimPolicy().staleMs + 1);
    await b.api.releaseLeftoverTrashClaims(b.scope(), () => true);
    expect(server.barcodes[0].trashClaim).toBeUndefined();
});

it('journal សរសេរមិនបាន ➜ start បដិសេធ មុនប៉ះ server', async () => {
    const a = tab(lockManager()); const claim = a.api.beginTrashClaim('parcel');
    denyStorage = true;
    await expect(Promise.resolve().then(() => claim.start())).rejects.toThrow('write_journal_unavailable');
    expect(writes).toBe(0);
    await claim.settle(false);
});

it('claim ស្លាប់ក្នុង document ដដែលនៅតែអាចសង្គ្រោះភ្លាម', async () => {
    const a = tab(); const dead = 'dead_token_123';
    a.api.noteTrashClaim('parcel', dead);
    await a.api.claimTrashBarcodes('parcel', dead, () => ['TAB001']);
    expect(a.api.trashClaimHeldByOther(server.barcodes[0], 'next_token_123', NOW)).toBe(false);
    expect((await a.api.claimTrashBarcodes('parcel', 'next_token_123', () => ['TAB001'])).state).toBe('claimed');
});

it('tab កំណែចាស់មិនឃើញ token ថ្មីក្នុង journal v1 ហើយ v1 មិនត្រូវផ្លាស់ដោយទាយ', async () => {
    const prior = JSON.stringify([{ itemId: 'parcel', token: 'old_token_123', scope: 'old-shop' }]);
    storage.set('zoew_trash_claims_v1', prior);
    const a = tab(lockManager()); const claim = a.api.beginTrashClaim('parcel');
    await claim.start(); await a.api.claimTrashBarcodes('parcel', claim.token, () => ['TAB001']);
    expect(a.api.trashClaimPolicy().storeKey).not.toBe('zoew_trash_claims_v1');
    expect(storage.get('zoew_trash_claims_v1')).toBe(prior);
    expect(a.api.pendingTrashClaims(a.scope()).map((row: any) => row.token)).toEqual([claim.token]);
    await claim.settle(false);
    expect(storage.get('zoew_trash_claims_v1')).toBe(prior);
});

it('សោនៅរស់រហូតដល់ការដោះ claim លើ server ចប់', async () => {
    const locks = lockManager(); const a = tab(locks); const b = tab(locks);
    const claim = a.api.beginTrashClaim('parcel');
    await claim.start(); await a.api.claimTrashBarcodes('parcel', claim.token, () => ['TAB001']);
    const execute = a.state.fb.runTransaction;
    let continueRelease!: () => void;
    const barrier = new Promise<void>(resolve => { continueRelease = resolve; });
    a.state.fb.runTransaction = async (...args: any[]) => { await barrier; return execute(...args); };
    const settling = claim.settle(false);
    expect(locks.held.has('zoew-trash-claim:' + claim.token)).toBe(true);
    await b.api.releaseLeftoverTrashClaims(b.scope(), () => true);
    expect(server.barcodes[0].trashClaim).toBe(claim.token);
    continueRelease(); await settling;
    await Promise.resolve(); await Promise.resolve();
    expect(locks.held.has('zoew-trash-claim:' + claim.token)).toBe(false);
});

it('ប្ដូរ session ខណៈរង់ចាំសោ ➜ មិនបោះពុម្ព journal ឬសរសេរទៅ session ថ្មី', async () => {
    const locks = lockManager();
    const request = locks.request;
    let continueStart!: () => void;
    const barrier = new Promise<void>(resolve => { continueStart = resolve; });
    locks.request = vi.fn(async (...args: Parameters<typeof request>) => { await barrier; return request(...args); });
    const a = tab(locks); const claim = a.api.beginTrashClaim('parcel');
    const starting = Promise.resolve(claim.start());
    a.state.authGeneration++;
    continueStart();
    await expect(starting).rejects.toThrow('TRASH_CLAIM_SESSION_SWITCHED');
    expect(a.api.pendingTrashClaims(a.scope())).toEqual([]);
    expect(writes).toBe(0);
    await claim.settle(false);
    await Promise.resolve(); await Promise.resolve();
    expect(locks.held.size).toBe(0);
});

it('browser បដិសេធសោ ➜ មិនធ្វើសកម្មភាពដោយគ្មានម្ចាស់', async () => {
    const locks = lockManager();
    locks.request = vi.fn(async () => { throw new Error('locks unavailable'); });
    const a = tab(locks); const claim = a.api.beginTrashClaim('parcel');
    await expect(Promise.resolve(claim.start())).rejects.toThrow('locks unavailable');
    expect(a.api.pendingTrashClaims(a.scope())).toEqual([]);
    expect(writes).toBe(0);
    await claim.settle(false);
});
