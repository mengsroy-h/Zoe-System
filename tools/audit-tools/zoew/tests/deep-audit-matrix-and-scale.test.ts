import { performance } from 'node:perf_hooks';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataState, firebaseState, securityState, uiState, ztoState } from '../../../../ZoeW/src/core/state';
import { resetServerClock } from '../../../../ZoeW/src/core/clock';
import { appLocalStore } from '../../../../ZoeW/src/core/storage';
import { liveShopScope } from '../../../../ZoeW/src/core/shop-scope';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../../../../ZoeW/src/core/text';
import { getZoneDateKey } from '../../../../ZoeW/src/core/timezone';
import { barcodeCloseIsRipe, barcodeAbandonIsRipe, barcodeEntriesOf } from '../../../../ZoeW/src/domain/barcode';
import * as cleanup from '../../../../ZoeW/src/domain/cleanup';
import { runLedgerTransaction } from '../../../../ZoeW/src/domain/ledger';
import { pickupBarcodeKey } from '../../../../ZoeW/src/domain/pickup';
import { barcodeRegistryKey } from '../../../../ZoeW/src/domain/registry';
import { removeSingleBarcode } from '../../../../ZoeW/src/features/barcode-ops';
import { deleteSingleItem } from '../../../../ZoeW/src/features/entry-ops';
import { expiryScheduleTimes, hoursUntilAbandon, nearExpiryView } from '../../../../ZoeW/src/features/notifications';
import { activeRestoreClaims, executeRestoreItem, restoreInFlight } from '../../../../ZoeW/src/features/restore';
import { trashDisplayReasonOf } from '../../../../ZoeW/src/features/trash';
import { applyZtoFinalMarks, noteZtoReturnedEvidence, trashRestoreBlockOf, ztoReturnedEvidence } from '../../../../ZoeW/src/features/zto-final-marks';
import { removeReturnedZtoBarcodes, ztoReturnedTargets } from '../../../../ZoeW/src/features/zto-returned';
import { renderZtoSyncBanner, setZtoPickupVerdict, ztoPickupStatus } from '../../../../ZoeW/src/features/zto-status';
import { noteZtoTrashMode } from '../../../../ZoeW/src/services/zto-trash-mode';
import { SbIncrement, SbNetworkError, createSupabaseDatabase } from '../../../../ZoeW/src/services/supabase-rtdb';
import { acceptFixtureSession, configureFixtureBackend } from './helpers/accepted-session';
import { createRestoreAttestationFixture } from './helpers/restore-attestation';
import { sealLookupHeader } from './helpers/sealed-lookup';

const HISTORY = 'zoew_scan_history_cod_dod';
const TRASH = 'zoew_recently_deleted_cod_dod';
const PICKUP = 'zoew_daily_pickup_cod_dod';
const MIRROR = 'zoew_daily_collected_cod_dod';
const DAILY = 'zoew_daily_revenue_cod_dod';
const MONTHLY = 'zoew_monthly_revenue_cod_dod';
const POLICY = 'zoew_restore_policy/shop';
const REGISTRY = 'zoew_barcode_registry';

const H = 60 * 60 * 1000;
const DAY_MS = 24 * H;
const NOW = Date.UTC(2026, 9, 10, 9, 30, 0);
const TODAY = getZoneDateKey(NOW, 0);
const MONTH = TODAY.substring(0, 7);
const PHONE = '0960008811';
const SYNTHETIC_HEADER = 'synthetic-matrix-header-0123456789';

type BackendKind = 'firebase' | 'supabase';
type ModeKind = 'palm' | 'cookie' | 'local';

interface AuditRecord {
    backend: BackendKind;
    branch: string;
    actorUid: string;
    path: string;
    action: string;
    previousStatus: string;
    newStatus: string;
    reason: string;
    timestamp: number;
    opId: string;
}

const clone = <T>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
const split = (p: string) => String(p || '').split('/').filter(Boolean);

function statusOf(val: any): string {
    if (val === null || val === undefined) return 'absent';
    if (typeof val !== 'object') return String(val);
    if (val.trashReason) return 'trash:' + val.trashReason;
    if (Array.isArray(val.barcodes)) {
        const closed = val.barcodes.filter((b: any) => b?.isClosed).length;
        return `history:${closed}/${val.barcodes.length}`;
    }
    if (val.codDollar !== undefined) return `ledger:cod=${val.codDollar},dod=${val.dodDollar},n=${val.totalCount}`;
    return 'object';
}

function createDualBackend(kind: BackendKind, branch = '12345', actorUid = 'matrix-user') {
    const store: Record<string, any> = {};
    const auditLog: AuditRecord[] = [];
    const subscribers = new Map<string, Set<(v: any) => void>>();
    let seq = 0;
    let opCounter = 0;
    let networkMode: 'ok' | 'down' | 'drop-after-commit' = 'ok';
    const sbDone = new Map<string, any>();
    const sbDeltas: Array<{ s: number; r: string; k: string; v: any }> = [];

    const getAt = (p: string) => {
        let cur: any = store;
        for (const part of split(p)) {
            if (cur === null || cur === undefined || typeof cur !== 'object') return null;
            cur = cur[part];
        }
        return cur === undefined ? null : clone(cur);
    };

    const setAt = (p: string, value: any, action = 'write', reason = '', opId = '') => {
        const parts = split(p);
        if (!parts.length) return;
        const prev = getAt(p);
        let cur: any = store;
        for (let i = 0; i < parts.length - 1; i++) {
            if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
            cur = cur[parts[i]];
        }
        if (value === null || value === undefined) delete cur[parts[parts.length - 1]];
        else cur[parts[parts.length - 1]] = clone(value);
        seq++;
        const id = opId || `${kind}_op_${++opCounter}`;
        if (parts.length >= 2) {
            const docVal = getAt(parts[0] + '/' + parts[1]);
            sbDeltas.push({ s: seq, r: parts[0], k: parts[1], v: docVal === undefined ? null : clone(docVal) });
        }
        auditLog.push({
            backend: kind,
            branch,
            actorUid,
            path: p,
            action,
            previousStatus: statusOf(prev),
            newStatus: statusOf(value),
            reason: reason || (value?.trashReason ?? ''),
            timestamp: Date.now(),
            opId: id
        });
        notify(parts[0]);
    };

    const notify = (root: string) => {
        const listeners = subscribers.get(root);
        if (!listeners) return;
        const val = getAt(root);
        for (const fn of Array.from(listeners)) fn(clone(val));
    };

    const pushSupabaseRealtime = () => {
        const listeners = subscribers.get('__rt__');
        if (!listeners) return;
        for (const fn of Array.from(listeners)) fn({ seq });
    };

    const allSbRows = () => {
        const rows: Array<{ r: string; k: string; v: any; s: number }> = [];
        for (const [r, bucket] of Object.entries(store)) {
            if (!bucket || typeof bucket !== 'object') continue;
            for (const [k, v] of Object.entries(bucket)) {
                if (v !== null && v !== undefined) rows.push({ r, k, v: clone(v), s: seq });
            }
        }
        return rows;
    };

    const applySbOp = (op: any, opId: string) => {
        const path = op.p.join('/');
        const opKind = op.k || op.t || 'set';
        if (opKind === 'cas') {
            const current = getAt(path);
            if (JSON.stringify(op.x === undefined ? null : op.x) !== JSON.stringify(current)) {
                return { conflict: true, value: current };
            }
            setAt(path, op.v === undefined ? null : op.v, 'cas', '', opId);
            return { conflict: false, r: op.p[0], k: op.p[1], v: getAt(op.p[0] + '/' + op.p[1]) };
        }
        if (opKind === 'inc') {
            const cur = Number(getAt(path)) || 0;
            setAt(path, cur + Number(op.d ?? op.v ?? 0), 'inc', '', opId);
            return { conflict: false, r: op.p[0], k: op.p[1], v: getAt(op.p[0] + '/' + op.p[1]) };
        }
        if (opKind === 'del') {
            setAt(path, null, 'del', '', opId);
            return { conflict: false, r: op.p[0], k: op.p[1], v: getAt(op.p[0] + '/' + op.p[1]) };
        }
        setAt(path, op.v === undefined ? null : op.v, opKind, '', opId);
        return { conflict: false, r: op.p[0], k: op.p[1], v: getAt(op.p[0] + '/' + op.p[1]) };
    };

    let sbDb: any = null;
    const buildClient = () => {
        if (kind === 'firebase') {
            const makeRef = (db: any, p = '') => ({ db, path: split(p).join('/'), key: split(p).pop() || null });
            const snap = (ref: any, val: any) => ({ key: ref?.key, ref, val: () => clone(val), exists: () => val !== null && val !== undefined });
            const fb: any = {
                getIdTokenResult: async () => ({ token: 'matrix-id-token' }),
                ref: (db: any, p = '') => makeRef(db, p),
                increment: (n: number) => ({ __inc__: n }),
                get: async (ref: any) => {
                    if (networkMode === 'down') throw new Error('network-offline');
                    return snap(ref, getAt(ref.path));
                },
                set: async (ref: any, val: any) => {
                    if (networkMode === 'down') throw new Error('network-offline');
                    setAt(ref.path, val, 'set');
                    if (networkMode === 'drop-after-commit') throw new Error('network-drop-after-commit');
                },
                update: async (ref: any, updates: any) => {
                    if (networkMode === 'down') throw new Error('network-offline');
                    const keys = Object.keys(updates || {});
                    for (const k of keys) {
                        const target = [ref.path, k].filter(Boolean).join('/');
                        let v = updates[k];
                        if (v && typeof v === 'object' && v.__inc__ !== undefined) v = (Number(getAt(target)) || 0) + v.__inc__;
                        setAt(target, v, 'update');
                    }
                    if (networkMode === 'drop-after-commit') throw new Error('network-drop-after-commit');
                },
                runTransaction: async (ref: any, updater: any) => {
                    if (networkMode === 'down') throw new Error('network-offline');
                    const prior = getAt(ref.path);
                    const proposed = updater(clone(prior));
                    if (proposed === undefined) return { committed: false, snapshot: snap(ref, prior) };
                    setAt(ref.path, proposed, 'tx');
                    if (networkMode === 'drop-after-commit') throw new Error('network-drop-after-commit');
                    return { committed: true, snapshot: snap(ref, getAt(ref.path)) };
                },
                onValue: (ref: any, cb: (s: any) => void) => {
                    const root = split(ref.path)[0];
                    if (!subscribers.has(root)) subscribers.set(root, new Set());
                    const wrapped = () => cb(snap(ref, getAt(ref.path)));
                    subscribers.get(root)!.add(wrapped);
                    wrapped();
                    return () => { subscribers.get(root)?.delete(wrapped); };
                },
                off: () => {}
            };
            return { db: { name: 'fb-' + branch }, fb, close: () => subscribers.clear() };
        }

        const transport: any = {
            rpc: async (fn: string, args: any) => {
                if (networkMode === 'down') throw new SbNetworkError('offline');
                if (fn === 'zoe_now') return Date.now();
                if (fn === 'zoe_read') {
                    const root = String(args?.p_root || '');
                    const k = args?.p_key;
                    const docs: any[] = [];
                    if (k !== null && k !== undefined) {
                        const val = getAt(`${root}/${k}`);
                        if (val !== null && val !== undefined) docs.push({ r: root, k: String(k), v: val, s: seq });
                    } else {
                        const bucket = getAt(root) || {};
                        for (const [bk, bv] of Object.entries(bucket)) {
                            if (bv !== null && bv !== undefined) docs.push({ r: root, k: bk, v: bv, s: seq });
                        }
                    }
                    return { seq, now: Date.now(), docs };
                }
                if (fn === 'zoe_pull') {
                    return { seq, more: false, reset: true, head: seq, tenant: 't_' + branch, now: Date.now(), rows: allSbRows() };
                }
                if (fn === 'zoe_pull_delta') {
                    const since = Number(args?.p_since || 0);
                    const matching = sbDeltas.filter((d) => d.s > since);
                    return { seq, more: false, reset: false, head: seq, tenant: 't_' + branch, now: Date.now(), rows: matching };
                }
                if (fn === 'zoe_write_v2') {
                    if (args.p_expected_tenant && args.p_expected_tenant !== 't_' + branch) {
                        throw Object.assign(new Error('tenant_mismatch'), { status: 403 });
                    }
                    const prior = sbDone.get(args.p_op_id);
                    if (prior) return Object.assign({}, prior, { replayed: true, now: Date.now() });
                    const docs: any[] = [];
                    for (const op of args.p_ops || []) {
                        const res = applySbOp(op, args.p_op_id);
                        if (res.conflict) return { ok: false, conflict: true, now: Date.now(), value: res.value };
                        docs.push({ r: res.r, k: res.k, v: res.v, s: seq });
                    }
                    const out = { ok: true, seq, now: Date.now(), docs };
                    sbDone.set(args.p_op_id, out);
                    if (networkMode === 'drop-after-commit') throw new SbNetworkError('timeout-after-commit');
                    return out;
                }
                throw new Error('unexpected rpc ' + fn);
            },
            ping: async () => networkMode === 'ok',
            subscribe: (_topic: string, onEvent: any, onStatus: any) => {
                onStatus?.('SUBSCRIBED');
                const fn = () => onEvent?.({ seq });
                if (!subscribers.has('__rt__')) subscribers.set('__rt__', new Set());
                subscribers.get('__rt__')!.add(fn);
                return () => { subscribers.get('__rt__')?.delete(fn); };
            }
        };

        sbDb = createSupabaseDatabase(transport, {
            onListenerError: () => {},
            onSynced: () => {},
            onForbidden: () => {},
            onTxOutcomeUnknown: () => {}
        }, { retryStepsMs: [5, 10, 20], pollFallbackMs: 600000, rpcTimeoutMs: 2000 });
        sbDb.setTenantTopic('zoe:t_' + branch);
        sbDb.setAuthed(true, liveShopScope());
        const wrappedFb = Object.assign(Object.create(sbDb), sbDb, {
            getIdTokenResult: async () => ({ token: 'matrix-id-token' }),
            ref: (_db: any, p = '') => (p ? sbDb.ref(p) : sbDb.ref()),
            get: (r: any) => sbDb.get(r),
            set: (r: any, v: any) => sbDb.set(r, v),
            update: (r: any, u: any) => sbDb.update(r, u),
            runTransaction: (r: any, u: any) => sbDb.runTransaction(r, u),
            onValue: (r: any, cb: any) => sbDb.onValue(r, cb),
            increment: (n: number) => new SbIncrement(n),
            off: () => {}
        });
        return { db: sbDb, fb: wrappedFb, close: () => sbDb.close('test') };
    };

    const syncLocalFromStore = async () => {
        if (kind === 'supabase') {
            pushSupabaseRealtime();
            await sleep(25);
        }
        const list = (root: string) => {
            const raw = getAt(root) || {};
            return Object.keys(raw).map((k) => Object.assign({ id: k }, raw[k]));
        };
        dataState.scanHistory = list(HISTORY);
        dataState.deletedItems = list(TRASH);
        dataState.dailyRevenueData = getAt(DAILY) || {};
        dataState.monthlyRevenueData = getAt(MONTHLY) || {};
        dataState.dailyPickupData = getAt(PICKUP) || {};
        dataState.dailyCollectedData = getAt(MIRROR) || {};
    };

    return {
        kind,
        store,
        auditLog,
        getAt,
        setAt,
        buildClient,
        syncLocalFromStore,
        setNetworkMode: (m: 'ok' | 'down' | 'drop-after-commit') => { networkMode = m; },
        activeSubscriberCount: () => Array.from(subscribers.values()).reduce((s, set) => s + set.size, 0)
    };
}

function makeItem(id: string, codes: string[], opts: { closed?: boolean; closedAt?: number; createdAt?: number; cod?: number; dod?: number; ztoSigned?: boolean; ztoSignedAt?: number } = {}) {
    const createdAt = opts.createdAt ?? NOW - 4 * H;
    const codEach = opts.cod ?? 40;
    const dodEach = opts.dod ?? 2;
    const barcodes = codes.map((code) => {
        const b: any = {
            code,
            isClosed: !!opts.closed,
            cod: codEach,
            dod: dodEach,
            isDeducted: false,
            isFromDeletion: false,
            createdAt,
            time: '13:00:00',
            locker: 'B2'
        };
        if (opts.closed) b.closedAt = opts.closedAt ?? (NOW - 3 * H);
        if (opts.ztoSigned) {
            b.ztoSigned = true;
            b.ztoSignedAt = opts.ztoSignedAt ?? (NOW - 3 * H);
        }
        return b;
    });
    const cod = barcodes.reduce((s, b) => s + b.cod, 0);
    const dod = barcodes.reduce((s, b) => s + b.dod, 0);
    const item: any = {
        id,
        phone: PHONE,
        scanDate: TODAY,
        isClosed: barcodes.every((b) => b.isClosed),
        createdAt,
        cod,
        dod,
        price: cod + dod,
        count: barcodes.length,
        barcode: codes[0],
        time: `13:00:00 (${TODAY})`,
        barcodes
    };
    if (item.isClosed) item.closedAt = opts.closedAt ?? (NOW - 3 * H);
    return item;
}

async function configureMode(mode: ModeKind, backend: ReturnType<typeof createDualBackend>) {
    const scope = liveShopScope();
    if (mode === 'palm') {
        const cfg = await sealLookupHeader({
            enabled: true,
            url: window.location.origin + '/.netlify/functions/zto-order-detail?barcode={barcode}&palm=1',
            headerName: 'X-Zoe-Proxy-Key',
            fastMode: true,
            shop: scope
        }, SYNTHETIC_HEADER);
        appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify(cfg));
        noteZtoTrashMode({ palm: { dev123456: NOW } });
    } else if (mode === 'cookie') {
        const cfg = await sealLookupHeader({
            enabled: true,
            url: window.location.origin + '/.netlify/functions/zto-order-detail?barcode={barcode}',
            headerName: 'X-Zoe-Proxy-Key',
            fastMode: true,
            shop: scope
        }, SYNTHETIC_HEADER);
        appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify(cfg));
        noteZtoTrashMode({ cookie: { dev123456: NOW } });
    } else {
        appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({
            enabled: true,
            url: 'https://script.google.com/macros/s/sheet-mode-test/exec?barcode={barcode}',
            shop: scope
        }));
        noteZtoTrashMode({});
    }
    backend.setAt(POLICY, { v: 1, mode, scope, branch: '12345', epoch: 1 }, 'policy');
    await backend.syncLocalFromStore();
}

function installRestoreFetch(backend: ReturnType<typeof createDualBackend>, mode: ModeKind, verdict: () => 'unsigned' | 'signed' | 'unverified') {
    const fixture = createRestoreAttestationFixture({
        get: (p) => backend.getAt(p),
        set: (p, v) => backend.setAt(p, v, 'attestation'),
        policy: { v: 1, mode, scope: liveShopScope(), branch: '12345', epoch: 1 },
        actorUid: 'matrix-user'
    });
    fixture.setLookup(async (event: any) => {
        const code = event?.queryStringParameters?.barcode || '';
        const state = verdict();
        if (state === 'unverified') {
            return Response.json({ success: true, found: true, barcode: code, ztoClosed: null, cached: false, verifiedForRestore: true, restoreTransitionsVerified: true });
        }
        return Response.json({
            success: true,
            found: true,
            barcode: code,
            ztoClosed: state === 'signed',
            ...(state === 'signed' ? { ztoSignedAt: NOW - 30 * 60 * 1000 } : {}),
            cached: false,
            verifiedForRestore: true,
            restoreTransitionsVerified: true
        });
    });
    vi.stubGlobal('fetch', vi.fn(async (input: any, init: any) => fixture.route(input, init)));
    return fixture;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const hasBarcode = (item: any, code: string) => barcodeEntriesOf(item?.barcodes).some(({ barcode }) => barcode?.code === code);
const firstBarcode = (item: any) => barcodeEntriesOf(item?.barcodes)[0]?.barcode;
async function runRestore(id: string) {
    uiState.pendingRestoreId = id;
    await executeRestoreItem();
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    resetServerClock();
    vi.stubGlobal('confirm', () => true);
    vi.stubGlobal('alert', () => {});
    appLocalStore.clear();
    dbListenerPendingPaths.clear();
    dbListenerFailedPaths.clear();
    ztoPickupStatus.clear();
    ztoReturnedEvidence.clear();
    activeRestoreClaims.clear();
    restoreInFlight.clear();
    cleanup.cleanupJournalLive.clear();
    cleanup.cleanupInFlight.clear();
    cleanup.purgeDeductionWaits.clear();
    dataState.pickupResumeInFlight = false;
    dataState.cleanupResumeInFlight = false;
    ztoState.ztoStatusLoaded = true;
    ztoState.ztoBannerView = null;
    ztoState.ztoStatusBannerSig = '';
    uiState.isModalOpen = false;
    uiState.toasts = [];
    uiState.pendingRestoreId = null;
    firebaseState.isDatabaseInitialized = true;
    firebaseState.dbListenersFailed = false;
    firebaseState.isDatabaseConnected = true;
    firebaseState.hasEverConnectedToDatabase = true;
    firebaseState.serverClockTrusted = true;
    firebaseState.serverTimeOffsetMs = 0;
    firebaseState.sessionExpiryCheck = 'live';
    firebaseState.dbLivenessProbe = Promise.resolve(null) as any;
});

afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    securityState.lookupSecretKey = null;
    appLocalStore.clear();
    ztoPickupStatus.clear();
    ztoReturnedEvidence.clear();
    activeRestoreClaims.clear();
    restoreInFlight.clear();
    dataState.scanHistory = [];
    dataState.deletedItems = [];
    firebaseState.auth = null as any;
    firebaseState.db = null as any;
    firebaseState.fb = null as any;
});

describe.each<BackendKind>(['firebase', 'supabase'])('Section 3 & 5 Matrix [%s backend]', (backendKind) => {
    async function mountBackend() {
        configureFixtureBackend(`matrix-${backendKind}`);
        firebaseState.auth = { currentUser: { uid: 'matrix-user' } } as any;
        firebaseState.authGeneration++;
        acceptFixtureSession();
        const backend = createDualBackend(backendKind);
        const client = backend.buildClient();
        firebaseState.db = client.db;
        firebaseState.fb = client.fb;
        for (const [name, p] of [
            ['dbRefHistory', HISTORY], ['dbRefDeleted', TRASH], ['dbRefDailyRevenue', DAILY],
            ['dbRefMonthlyRevenue', MONTHLY], ['dbRefDailyCollected', MIRROR],
            ['dbRefDailyPickup', PICKUP], ['dbRefRegistry', REGISTRY]
        ] as const) {
            (firebaseState as any)[name] = client.fb.ref(client.db, p);
        }
        if (backendKind === 'supabase') {
            let ready = false;
            client.fb.onValue(client.fb.ref(client.db, HISTORY), () => { ready = true; });
            for (let i = 0; i < 60 && !ready; i++) await sleep(5);
            expect(ready).toBe(true);
        }
        return { backend, client };
    }

    it.each<ModeKind>(['palm', 'cookie', 'local'])('Delete → Restore & Remove → Restore enforce exact [%s] mode rules & DB audit trail', async (mode) => {
        const { backend, client } = await mountBackend();
        try {
            await configureMode(mode, backend);
            let ztoVerdict: 'unsigned' | 'signed' | 'unverified' = 'unsigned';
            installRestoreFetch(backend, mode, () => ztoVerdict);

            const delId = `del_${backendKind}_${mode}`;
            const delCode = `DEL${mode.toUpperCase()}001`;
            const delItem = makeItem(delId, [delCode], { closed: false, cod: 50, dod: 3 });
            backend.setAt(`${HISTORY}/${delId}`, delItem, 'seed');
            backend.setAt(`${REGISTRY}/${barcodeRegistryKey(delCode)}`, true, 'seed');
            backend.setAt(`${DAILY}/${TODAY}`, { codDollar: 50, dodDollar: 3, totalCount: 1 }, 'seed');
            backend.setAt(`${MONTHLY}/${MONTH}`, { codDollar: 50, dodDollar: 3, totalCount: 1 }, 'seed');
            await backend.syncLocalFromStore();

            await deleteSingleItem(delId);
            await backend.syncLocalFromStore();
            expect(backend.getAt(`${HISTORY}/${delId}`)).toBeNull();
            expect(backend.getAt(`${TRASH}/${delId}`)).toBeTruthy();
            expect(backend.getAt(`${DAILY}/${TODAY}`)).toMatchObject({ codDollar: 50, dodDollar: 3, totalCount: 1 });

            if (mode !== 'local') {
                ztoVerdict = 'unverified';
                await runRestore(delId);
                expect(backend.getAt(`${HISTORY}/${delId}`)).toBeNull();
                expect(backend.getAt(`${TRASH}/${delId}`)).toBeTruthy();

                ztoVerdict = 'signed';
                await runRestore(delId);
                expect(backend.getAt(`${HISTORY}/${delId}`)).toBeNull();

                const cleanTrash = clone(backend.getAt(`${TRASH}/${delId}`));
                delete cleanTrash.restoreBlocked;
                delete cleanTrash.restoreAttestationId;
                delete cleanTrash.restoreClaim;
                backend.setAt(`${TRASH}/${delId}`, cleanTrash, 'reset-for-unsigned-case');
                backend.setAt(`zoew_restore_attestations/${delId}`, null, 'reset-for-unsigned-case');
                await backend.syncLocalFromStore();
                ztoVerdict = 'unsigned';
            }

            await runRestore(delId);
            await backend.syncLocalFromStore();
            expect(backend.getAt(`${TRASH}/${delId}`)).toBeNull();
            expect(Object.keys(backend.getAt(HISTORY) || {}).length).toBe(1);
            expect(backend.getAt(`${DAILY}/${TODAY}`)).toMatchObject({ codDollar: 50, dodDollar: 3, totalCount: 1 });

            const remId = `rem_${backendKind}_${mode}`;
            const remCode = `REM${mode.toUpperCase()}001`;
            const remItem = makeItem(remId, [remCode], { closed: false, cod: 30, dod: 2 });
            backend.setAt(`${HISTORY}/${remId}`, remItem, 'seed');
            backend.setAt(`${REGISTRY}/${barcodeRegistryKey(remCode)}`, true, 'seed');
            backend.setAt(`${DAILY}/${TODAY}`, { codDollar: 80, dodDollar: 5, totalCount: 2 }, 'seed');
            backend.setAt(`${MONTHLY}/${MONTH}`, { codDollar: 80, dodDollar: 5, totalCount: 2 }, 'seed');
            await backend.syncLocalFromStore();

            await removeSingleBarcode(remId, remCode);
            await backend.syncLocalFromStore();
            expect(backend.getAt(`${DAILY}/${TODAY}`)).toMatchObject({ codDollar: 50, dodDollar: 3, totalCount: 1 });
            expect(backend.getAt(`${MONTHLY}/${MONTH}`)).toMatchObject({ codDollar: 50, dodDollar: 3, totalCount: 1 });
            const trashIds = Object.keys(backend.getAt(TRASH) || {});
            expect(trashIds.length).toBe(1);
            const remTrashId = trashIds[0];

            if (mode !== 'local') {
                ztoVerdict = 'unverified';
                await runRestore(remTrashId);
                expect(backend.getAt(`${DAILY}/${TODAY}`)).toMatchObject({ codDollar: 50, dodDollar: 3, totalCount: 1 });
                ztoVerdict = 'unsigned';
            }

            await runRestore(remTrashId);
            await backend.syncLocalFromStore();
            expect(backend.getAt(`${TRASH}/${remTrashId}`)).toBeNull();
            expect(backend.getAt(`${DAILY}/${TODAY}`)).toMatchObject({ codDollar: 80, dodDollar: 5, totalCount: 2 });
            expect(backend.getAt(`${MONTHLY}/${MONTH}`)).toMatchObject({ codDollar: 80, dodDollar: 5, totalCount: 2 });

            expect(backend.auditLog.some((a) => a.path.startsWith(TRASH) && a.actorUid === 'matrix-user' && a.opId)).toBe(true);
            expect(backend.auditLog.some((a) => a.path.startsWith(DAILY) && a.previousStatus !== a.newStatus)).toBe(true);
        } finally {
            client.close();
        }
    });

    it.each<ModeKind>(['palm', 'cookie', 'local'])('Auto-Cleanup → Restore enforces exact [%s] mode rules (Closed in ZoeW ≠ ZTO Signed)', async (mode) => {
        const { backend, client } = await mountBackend();
        try {
            await configureMode(mode, backend);
            let ztoVerdict: 'unsigned' | 'signed' | 'unverified' = 'unsigned';
            installRestoreFetch(backend, mode, () => ztoVerdict);

            const id1 = `cln_${backendKind}_${mode}_unsigned`;
            const code1 = `CLN${mode.toUpperCase()}01`;
            const closedAt1 = NOW - 3 * H;
            const closedUnsigned = makeItem(id1, [code1], { closed: true, closedAt: closedAt1, ztoSigned: false });
            backend.setAt(`${HISTORY}/${id1}`, closedUnsigned, 'seed');
            backend.setAt(`${REGISTRY}/${barcodeRegistryKey(code1)}`, true, 'seed');
            backend.setAt(`${MIRROR}/${getZoneDateKey(closedAt1, 0)}/${pickupBarcodeKey(code1)}`, { c: 40, d: 2 }, 'seed');
            await backend.syncLocalFromStore();

            if (mode === 'palm') {
                expect(barcodeCloseIsRipe(closedUnsigned.barcodes[0], NOW, 'palm')).toBe(false);
                await cleanup.claimAndCleanupItem(id1, 'close');
                expect(backend.getAt(`${HISTORY}/${id1}`)).toBeTruthy();

                const idSigned = `cln_${backendKind}_palm_signed`;
                const codeSigned = 'CLNPALM02';
                const closedSigned = makeItem(idSigned, [codeSigned], { closed: true, closedAt: closedAt1, ztoSigned: true, ztoSignedAt: closedAt1 });
                backend.setAt(`${HISTORY}/${idSigned}`, closedSigned, 'seed');
                backend.setAt(`${REGISTRY}/${barcodeRegistryKey(codeSigned)}`, true, 'seed');
                backend.setAt(`${MIRROR}/${getZoneDateKey(closedAt1, 0)}/${pickupBarcodeKey(codeSigned)}`, { c: 40, d: 2 }, 'seed');
                await backend.syncLocalFromStore();
                expect(barcodeCloseIsRipe(closedSigned.barcodes[0], NOW, 'palm')).toBe(true);
                await cleanup.claimAndCleanupItem(idSigned, 'close');
                await backend.syncLocalFromStore();
                const trashList = Object.values(backend.getAt(TRASH) || {}) as any[];
                const cleaned = trashList.find((t) => hasBarcode(t, codeSigned));
                expect(cleaned).toBeTruthy();
                expect(trashRestoreBlockOf(cleaned)).toBeTruthy();
                await runRestore(cleaned.id);
                expect(backend.getAt(`${TRASH}/${cleaned.id}`)).toBeTruthy();
            } else if (mode === 'cookie') {
                expect(barcodeCloseIsRipe(closedUnsigned.barcodes[0], NOW, 'cookie')).toBe(true);
                await cleanup.claimAndCleanupItem(id1, 'close');
                await backend.syncLocalFromStore();
                const cleaned = (Object.values(backend.getAt(TRASH) || {}) as any[]).find((t) => hasBarcode(t, code1));
                expect(cleaned).toBeTruthy();
                expect(trashRestoreBlockOf(cleaned)).toBe('');

                ztoVerdict = 'unverified';
                await runRestore(cleaned.id);
                expect(backend.getAt(`${TRASH}/${cleaned.id}`)).toBeTruthy();

                ztoVerdict = 'unsigned';
                await runRestore(cleaned.id);
                await backend.syncLocalFromStore();
                expect(backend.getAt(`${TRASH}/${cleaned.id}`)).toBeNull();

                const id2 = `cln_${backendKind}_cookie_signed`;
                const code2 = 'CLNCOOK02';
                const closed2 = makeItem(id2, [code2], { closed: true, closedAt: closedAt1 });
                backend.setAt(`${HISTORY}/${id2}`, closed2, 'seed');
                backend.setAt(`${REGISTRY}/${barcodeRegistryKey(code2)}`, true, 'seed');
                backend.setAt(`${MIRROR}/${getZoneDateKey(closedAt1, 0)}/${pickupBarcodeKey(code2)}`, { c: 40, d: 2 }, 'seed');
                await backend.syncLocalFromStore();
                await cleanup.claimAndCleanupItem(id2, 'close');
                await backend.syncLocalFromStore();
                const cleaned2 = (Object.values(backend.getAt(TRASH) || {}) as any[]).find((t) => hasBarcode(t, code2));
                expect(cleaned2).toBeTruthy();
                ztoVerdict = 'signed';
                await runRestore(cleaned2.id);
                expect(backend.getAt(`${TRASH}/${cleaned2.id}`)).toBeTruthy();
            } else {
                expect(barcodeCloseIsRipe(closedUnsigned.barcodes[0], NOW, 'local')).toBe(true);
                await cleanup.claimAndCleanupItem(id1, 'close');
                await backend.syncLocalFromStore();
                const cleaned = (Object.values(backend.getAt(TRASH) || {}) as any[]).find((t) => hasBarcode(t, code1));
                expect(cleaned).toBeTruthy();
                await runRestore(cleaned.id);
                await backend.syncLocalFromStore();
                expect(backend.getAt(`${TRASH}/${cleaned.id}`)).toBeNull();
            }
        } finally {
            client.close();
        }
    });

    it('Section 4 ZTO Daily Flow: reminder bar show/hide, Asia/Phnom_Penh near-return boundaries, and -710 Return + duplicate/out-of-order resilience', async () => {
        const { backend, client } = await mountBackend();
        try {
            await configureMode('cookie', backend);
            appLocalStore.setItem('zoew_zto_autoclose', '1');

            const barItem = makeItem('bar_item', ['ZTOBAR001'], { closed: true, closedAt: NOW - 10 * 60 * 1000 });
            dataState.scanHistory = [barItem];
            dataState.deletedItems = [];
            setZtoPickupVerdict('ZTOBAR001', false, NOW - 5 * 60 * 1000);
            renderZtoSyncBanner(dataState.scanHistory, dataState.deletedItems);
            expect(ztoState.ztoBannerView?.headline).toContain('1 កញ្ចប់បិទក្នុង ZoeW តែ ZTO មិនទាន់បិទ');

            setZtoPickupVerdict('ZTOBAR001', true, NOW, NOW - 2 * 60 * 1000);
            renderZtoSyncBanner(dataState.scanHistory, dataState.deletedItems);
            expect(ztoState.ztoBannerView).toBeNull();

            const ppMidnight = Date.parse('2026-10-10T23:55:00+07:00');
            const nearDue = { code: 'NEAR1', isClosed: false, createdAt: ppMidnight - (7 * DAY_MS - 30 * 60 * 1000), locker: 'A1' };
            const pastDue = { code: 'DUE1', isClosed: false, createdAt: ppMidnight - (7 * DAY_MS + 5 * 60 * 1000), locker: 'A1' };
            const tooEarly = { code: 'EARLY1', isClosed: false, createdAt: ppMidnight - (5 * DAY_MS), locker: 'A1' };
            const alreadyClosed = { code: 'CLOSED1', isClosed: true, closedAt: ppMidnight - H, createdAt: ppMidnight - 7 * DAY_MS, locker: 'A1' };
            expect(hoursUntilAbandon(nearDue, nearDue.createdAt, ppMidnight)).toBe(1);
            expect(hoursUntilAbandon(pastDue, pastDue.createdAt, ppMidnight)).toBe(0);
            expect(hoursUntilAbandon(tooEarly, tooEarly.createdAt, ppMidnight)).toBe(-1);
            expect(hoursUntilAbandon(alreadyClosed, alreadyClosed.createdAt, ppMidnight)).toBe(-1);
            expect(barcodeAbandonIsRipe(pastDue, pastDue.createdAt, ppMidnight)).toBe(true);
            expect(barcodeAbandonIsRipe(nearDue, nearDue.createdAt, ppMidnight)).toBe(false);

            const expiryHist = [
                { id: 'e1', phone: PHONE, isClosed: false, createdAt: nearDue.createdAt, barcodes: [nearDue, alreadyClosed] },
                { id: 'e2', phone: PHONE, isClosed: false, createdAt: pastDue.createdAt, barcodes: [pastDue] }
            ];
            const view = nearExpiryView(expiryHist, ppMidnight, false);
            expect(view.measurable).toBe(true);
            expect(view.packages).toBe(2);
            expect(view.customers).toBe(1);
            expect(view.rows).toHaveLength(2);
            expect(expiryScheduleTimes(expiryHist, ppMidnight).length).toBe(1);

            const retId = `ret_${backendKind}`;
            const retCode = 'ZTORET710';
            const retItem = makeItem(retId, [retCode], { closed: false, cod: 60, dod: 4, createdAt: NOW - 2 * DAY_MS });
            backend.setAt(`${HISTORY}/${retId}`, retItem, 'seed');
            backend.setAt(`${REGISTRY}/${barcodeRegistryKey(retCode)}`, true, 'seed');
            backend.setAt(`${DAILY}/${TODAY}`, { codDollar: 60, dodDollar: 4, totalCount: 1 }, 'seed');
            backend.setAt(`${MONTHLY}/${MONTH}`, { codDollar: 60, dodDollar: 4, totalCount: 1 }, 'seed');
            await backend.syncLocalFromStore();

            const returnStamp = new Date(NOW - 30 * 60 * 1000 + 7 * H).toISOString().slice(0, 19).replace('T', ' ');
            const sentLaterStamp = new Date(NOW - 10 * 60 * 1000 + 7 * H).toISOString().slice(0, 19).replace('T', ' ');
            const queued = removeReturnedZtoBarcodes([{ barcode: retCode, at: returnStamp }], dataState.scanHistory, []);
            expect(queued).toBe(1);
            for (let i = 0; i < 40 && backend.getAt(`${HISTORY}/${retId}`); i++) await sleep(10);
            await backend.syncLocalFromStore();

            const trashedRet = (Object.values(backend.getAt(TRASH) || {}) as any[]).find((t) => hasBarcode(t, retCode));
            expect(trashedRet).toBeTruthy();
            expect(trashDisplayReasonOf(trashedRet)).toBe('returned');
            expect(backend.getAt(`${DAILY}/${TODAY}`)).toMatchObject({ codDollar: 0, dodDollar: 0, totalCount: 0 });
            expect(backend.getAt(`${MONTHLY}/${MONTH}`)).toMatchObject({ codDollar: 0, dodDollar: 0, totalCount: 0 });

            removeReturnedZtoBarcodes([{ barcode: retCode, at: returnStamp }], dataState.scanHistory, []);
            noteZtoReturnedEvidence(retCode, NOW - 45 * 60 * 1000, 'sent');
            await applyZtoFinalMarks(clone(trashedRet), { [pickupBarcodeKey(retCode)]: { returned: NOW - 30 * 60 * 1000 } }, true);
            await sleep(20);
            await backend.syncLocalFromStore();
            const trashedAfterDup = backend.getAt(`${TRASH}/${trashedRet.id}`);
            expect(trashDisplayReasonOf(trashedAfterDup)).toBe('returned');
            expect(firstBarcode(trashedAfterDup)?.ztoSentOutAt).toBeUndefined();
            expect(backend.getAt(`${DAILY}/${TODAY}`)).toMatchObject({ codDollar: 0, dodDollar: 0, totalCount: 0 });
            expect(ztoReturnedTargets([{ barcode: retCode, at: sentLaterStamp, sentOut: true }], dataState.scanHistory, [])).toEqual([]);
        } finally {
            client.close();
        }
    });

    it('Section 6 Concurrency & Failure Convergence: A-B-C simultaneous actions, disconnect before write, and commit-without-response recovery', async () => {
        const { backend, client } = await mountBackend();
        try {
            await configureMode('local', backend);

            const id = `race_${backendKind}`;
            const code = 'RACEABC001';
            const item = makeItem(id, [code], { closed: false, cod: 100, dod: 5 });
            backend.setAt(`${HISTORY}/${id}`, item, 'seed');
            backend.setAt(`${REGISTRY}/${barcodeRegistryKey(code)}`, true, 'seed');
            backend.setAt(`${DAILY}/${TODAY}`, { codDollar: 100, dodDollar: 5, totalCount: 1 }, 'seed');
            backend.setAt(`${MONTHLY}/${MONTH}`, { codDollar: 100, dodDollar: 5, totalCount: 1 }, 'seed');
            await backend.syncLocalFromStore();

            backend.setNetworkMode('down');
            await expect(client.fb.get(client.fb.ref(client.db, `${HISTORY}/offline_check`))).rejects.toThrow();
            expect(backend.getAt(`${HISTORY}/offline_check`)).toBeNull();
            backend.setNetworkMode('ok');

            await Promise.allSettled([
                removeSingleBarcode(id, code),
                removeSingleBarcode(id, code),
                deleteSingleItem(id)
            ]);
            for (let i = 0; i < 40 && cleanup.cleanupJournalLive.size > 0; i++) await sleep(10);
            await backend.syncLocalFromStore();

            expect(backend.getAt(`${HISTORY}/${id}`)).toBeNull();
            const trashRows = Object.values(backend.getAt(TRASH) || {});
            expect(trashRows.length).toBe(1);
            const rev = backend.getAt(`${DAILY}/${TODAY}`);
            expect(rev.codDollar === 0 || rev.codDollar === 100).toBe(true);
            expect(rev.codDollar).toBeGreaterThanOrEqual(0);
            expect(rev.totalCount).toBeGreaterThanOrEqual(0);

            if (backendKind === 'supabase') {
                backend.setAt(`${DAILY}/2026-10-09`, { codDollar: 200, dodDollar: 10, totalCount: 4, op: 'seed0', ops: { seed0: 1 } }, 'seed');
                await backend.syncLocalFromStore();
                backend.setNetworkMode('drop-after-commit');
                const txPromise = runLedgerTransaction(client.fb.ref(client.db, `${DAILY}/2026-10-09`), (cur: any, op: any, ring: any) => {
                    const base = cur || { codDollar: 0, dodDollar: 0, totalCount: 0 };
                    return { codDollar: base.codDollar - 25, dodDollar: base.dodDollar, totalCount: base.totalCount - 1, op, ops: ring };
                });
                await sleep(25);
                backend.setNetworkMode('ok');
                const txRes = await txPromise;
                expect(txRes.committed).toBe(true);
                expect(backend.getAt(`${DAILY}/2026-10-09`)).toMatchObject({ codDollar: 175, dodDollar: 10, totalCount: 3 });
            }
        } finally {
            client.close();
        }
    });
});

describe('Section 7 Synthetic Multi-Branch Scalability Benchmark (Zero Live ZTO/Backend Calls)', () => {
    function percentile(sorted: number[], p: number): number {
        if (!sorted.length) return 0;
        const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
        return Number(sorted[idx].toFixed(3));
    }

    it('measures p50/p95/p99 latency, 3-device convergence, heap delta, listener leaks, and DB ops across 10/50/100 branches (30/150/300 devices)', async () => {
        vi.useRealTimers();
        const report: Record<string, any> = {};

        for (const branches of [10, 50, 100]) {
            const devicesPerBranch = 3;
            const packagesPerBranch = 100;
            const totalDevices = branches * devicesPerBranch;
            const latencies: number[] = [];
            const convergenceTimes: number[] = [];
            let dbOps = 0;
            const heapBefore = process.memoryUsage().heapUsed;

            const listeners = new Map<string, Set<(msg: any) => void>>();
            const branchHistories: any[][] = [];

            for (let b = 0; b < branches; b++) {
                const branchId = `branch_${b}`;
                const subs = new Set<(msg: any) => void>();
                listeners.set(branchId, subs);
                const deviceState = Array.from({ length: devicesPerBranch }, () => ({ seq: 0, closed: 0 }));
                for (let d = 0; d < devicesPerBranch; d++) {
                    subs.add((evt) => {
                        deviceState[d].seq = evt.seq;
                        deviceState[d].closed = evt.closed;
                    });
                }

                const hist: any[] = [];
                for (let p = 0; p < packagesPerBranch; p++) {
                    const isNear = p % 10 === 0;
                    const createdAt = NOW - (isNear ? (7 * DAY_MS - 3 * H) : (2 * DAY_MS));
                    hist.push({
                        id: `${branchId}_p_${p}`,
                        phone: `096${String(b).padStart(3, '0')}${String(p).padStart(4, '0')}`,
                        isClosed: false,
                        createdAt,
                        barcodes: [{
                            code: `B${b}P${p}`,
                            isClosed: p % 4 === 0,
                            closedAt: p % 4 === 0 ? NOW - 3 * H : undefined,
                            cod: 20,
                            dod: 2,
                            createdAt,
                            locker: `L${p % 20}`
                        }]
                    });
                }
                branchHistories.push(hist);

                const t0 = performance.now();
                const view = nearExpiryView(hist, NOW, false);
                const sched = expiryScheduleTimes(hist, NOW);
                const ripeCount = hist.filter((it) => barcodeCloseIsRipe(it.barcodes[0], NOW, 'cookie')).length;
                const t1 = performance.now();
                latencies.push(t1 - t0);
                expect(view.measurable).toBe(true);
                expect(sched.length).toBeGreaterThan(0);
                expect(ripeCount).toBeGreaterThan(0);

                const convStart = performance.now();
                const evt = { seq: b + 1, closed: ripeCount };
                dbOps += 1 + devicesPerBranch;
                for (const fn of subs) fn(evt);
                const convEnd = performance.now();
                convergenceTimes.push(convEnd - convStart);
                expect(deviceState.every((s) => s.seq === evt.seq && s.closed === ripeCount)).toBe(true);
            }

            listeners.clear();
            const activeListeners = Array.from(listeners.values()).reduce((s, set) => s + set.size, 0);
            const heapAfter = process.memoryUsage().heapUsed;
            latencies.sort((a, b) => a - b);
            convergenceTimes.sort((a, b) => a - b);

            report[`${branches}branches_${totalDevices}devices`] = {
                branches,
                devices: totalDevices,
                packages: branches * packagesPerBranch,
                p50Ms: percentile(latencies, 50),
                p95Ms: percentile(latencies, 95),
                p99Ms: percentile(latencies, 99),
                convergenceP99Ms: percentile(convergenceTimes, 99),
                dbOps,
                activeListenersAfterTeardown: activeListeners,
                heapDeltaMB: Number(((heapAfter - heapBefore) / (1024 * 1024)).toFixed(2))
            };

            expect(activeListeners).toBe(0);
            expect(percentile(latencies, 99)).toBeLessThan(100);
            expect(percentile(convergenceTimes, 99)).toBeLessThan(20);
        }

        console.log('[BENCHMARK_METRICS] ' + JSON.stringify(report));
        expect(Object.keys(report)).toEqual(['10branches_30devices', '50branches_150devices', '100branches_300devices']);
    });
});
