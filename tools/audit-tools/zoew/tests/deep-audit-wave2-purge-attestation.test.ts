import { generateKeyPairSync, sign } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { dataState, firebaseState, uiState } from '../../../../ZoeW/src/core/state';
import { appLocalStore } from '../../../../ZoeW/src/core/storage';
import { dbListenerFailedPaths, dbListenerPendingPaths } from '../../../../ZoeW/src/core/text';
import { getZoneDateKey } from '../../../../ZoeW/src/core/timezone';
import { barcodeRegistryKey } from '../../../../ZoeW/src/domain/registry';
import { activeRestoreClaims, executeRestoreItem, releaseStaleRestoreClaimForPurge, restoreCancellationInFlight, restoreInFlight } from '../../../../ZoeW/src/features/restore';
import { ztoReturnedEvidence } from '../../../../ZoeW/src/features/zto-final-marks';
import { requestRestoreAuthorization } from '../../../../ZoeW/src/features/zto-restore-status';
import { testLookupApiConfig } from '../../../../ZoeW/src/features/lookup-config';
import { refTo } from '../../../../ZoeW/src/app/refs';
import { acceptFixtureSession } from './helpers/accepted-session';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(__dirname, '../../../..');
const { createRestoreProofHandler } = require(path.join(ROOT, 'ZoeW/netlify/functions/_shared/zto-restore-proof.cjs'));
const { createFirebaseBackend } = require(path.join(ROOT, 'ZoeW/netlify/functions/_shared/zto-restore-firebase.cjs'));
const { deadlineBudget } = require(path.join(ROOT, 'ZoeW/netlify/functions/_shared/zto-restore-http.cjs'));
const core = require(path.join(ROOT, 'ZoeW/netlify/functions/_shared/zto-order-detail-core.cjs'));

const HISTORY = 'zoew_scan_history_cod_dod';
const TRASH = 'zoew_recently_deleted_cod_dod';
const POLICY = 'zoew_restore_policy/shop';
const H = 60 * 60 * 1000;
const NOW = Date.UTC(2026, 10, 18, 9, 0, 0);
const DAY = getZoneDateKey(NOW - 2 * H, 0);
const PHONE = '0960007345';
const DB = { name: 'wave2-shop' };
const SCOPE = 'https://wave2-shop-default-rtdb.firebaseio.com';
const SHOP_CONFIG = JSON.stringify({ apiKey: 'k', databaseURL: SCOPE, projectId: 'p' });
const clone = <T>(value: T): T => (value === undefined ? value : JSON.parse(JSON.stringify(value)));
const split = (p: string) => String(p || '').split('/').filter(Boolean);

let store: Record<string, any> = {};
function getAt(p: string) {
    let cur: any = store;
    for (const part of split(p)) {
        if (cur === null || cur === undefined || typeof cur !== 'object') return null;
        cur = cur[part];
    }
    return cur === undefined ? null : clone(cur);
}
function setAt(p: string, value: any) {
    const parts = split(p);
    let cur: any = store;
    for (let i = 0; i < parts.length - 1; i++) {
        if (cur[parts[i]] === null || cur[parts[i]] === undefined || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
        cur = cur[parts[i]];
    }
    if (value === null || value === undefined) delete cur[parts[parts.length - 1]];
    else cur[parts[parts.length - 1]] = clone(value);
}
const makeRef = (db: any, p = '') => ({ db, path: split(p).join('/'), key: split(p).pop() || null });
const snap = (ref: any, value: any) => ({ key: ref?.key, ref, val: () => clone(value), exists: () => value !== null && value !== undefined });

function makeFb(txCalls: string[]) {
    return {
        ref: (db: any, p = '') => makeRef(db, p),
        get: async (ref: any) => snap(ref, getAt(ref.path)),
        set: async (ref: any, value: any) => setAt(ref.path, value),
        update: async (ref: any, updates: any) => {
            Object.entries(updates || {}).forEach(([k, v]) => setAt([ref.path, k].filter(Boolean).join('/'), v));
        },
        runTransaction: async (ref: any, updater: any) => {
            txCalls.push(ref.path);
            const prior = getAt(ref.path);
            const proposed = updater(clone(prior));
            if (proposed === undefined) return { committed: false, snapshot: snap(ref, prior) };
            setAt(ref.path, proposed);
            return { committed: true, snapshot: snap(ref, getAt(ref.path)) };
        },
        onValue: () => () => {},
        off: () => {}
    };
}

let txCalls: string[] = [];

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(NOW));
    store = {};
    txCalls = [];
    appLocalStore.clear();
    appLocalStore.setItem('zoew_firebase_config', SHOP_CONFIG);
    dbListenerPendingPaths.clear();
    dbListenerFailedPaths.clear();
    dataState.scanHistory = [];
    dataState.deletedItems = [];
    dataState.dailyRevenueData = {};
    dataState.monthlyRevenueData = {};
    dataState.dailyCollectedData = {};
    dataState.dailyPickupData = {};
    uiState.toasts = [];
    uiState.pendingRestoreId = null;
    activeRestoreClaims.clear();
    restoreInFlight.clear();
    restoreCancellationInFlight.clear();
    ztoReturnedEvidence.clear();
    firebaseState.authGeneration++;
    firebaseState.auth = { currentUser: { uid: 'wave2-user', getIdToken: async () => 'synthetic-id-token' } } as any;
    firebaseState.db = DB as any;
    firebaseState.firebaseConfig = { databaseURL: SCOPE } as any;
    firebaseState.isDatabaseInitialized = true;
    firebaseState.dbListenersFailed = false;
    firebaseState.isDatabaseConnected = true;
    firebaseState.hasEverConnectedToDatabase = true;
    firebaseState.serverClockTrusted = true;
    firebaseState.serverTimeOffsetMs = 0;
    firebaseState.fb = makeFb(txCalls) as any;
    acceptFixtureSession();
    firebaseState.dbRefHistory = makeRef(DB, HISTORY) as any;
    firebaseState.dbRefDeleted = makeRef(DB, TRASH) as any;
    (firebaseState as any).dbRefRegistry = makeRef(DB, 'zoew_barcode_registry');
    vi.stubGlobal('alert', vi.fn());
    vi.stubGlobal('confirm', () => true);
    vi.stubGlobal('prompt', () => 'M06TEST01');
    (window as any).ZoeErrors = { capture: vi.fn() };
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete (window as any).Capacitor;
    delete (window as any).ZoeErrors;
    firebaseState.serverClockTrusted = false;
    firebaseState.isDatabaseConnected = false;
});

it('M-02៖ firebase-database.rules.json ត្រូវអនុញ្ញាតឱ្យ purge កញ្ចប់ធុងសំរាមដែលមាន restorePublication និង ztoTerminalDecision ដោយនៅតែហាមកែពេលជួរនៅរស់', () => {
    const rules = JSON.parse(fs.readFileSync(path.join(ROOT, 'firebase-database.rules.json'), 'utf8'));
    const trashItem = rules.rules.zoew_recently_deleted_cod_dod.$itemId;
    const expectedPurgeWrite = "auth!=null&&!newData.parent().exists()&&data.parent().hasChild('barcodes')";
    expect(trashItem.restorePublication['.write']).toBe(expectedPurgeWrite);
    expect(trashItem.ztoTerminalDecision['.write']).toBe(expectedPurgeWrite);
    expect(trashItem.restoreAttestationId['.write']).toBe(false);
    expect(trashItem['.validate']).toContain("newData.child('restorePublication').val()===data.child('restorePublication').val()");
    expect(trashItem['.validate']).toContain("newData.child('ztoTerminalDecision').val()===data.child('ztoTerminalDecision').val()");

    const minText = fs.readFileSync(path.join(ROOT, 'firebase-database.rules.min.json'), 'utf8');
    expect(Buffer.byteLength(minText, 'utf8')).toBeLessThanOrEqual(251904);
    const latestRulesMigration = fs.readdirSync(path.join(ROOT, 'supabase/migrations')).filter(f => f.endsWith('_zoe_rules.sql')).sort().pop()!;
    const compiled = JSON.parse(fs.readFileSync(path.join(ROOT, 'supabase/migrations', latestRulesMigration), 'utf8').split('$zoe_rules_json$')[1]);
    expect(compiled.c.zoew_recently_deleted_cod_dod.x.r.c.restorePublication.w).not.toEqual({ t: 'l', v: false });
    expect(compiled.c.zoew_recently_deleted_cod_dod.x.r.c.ztoTerminalDecision.w).not.toEqual({ t: 'l', v: false });
});

it('M-06៖ CORS OPTIONS លើ zto-restore-proof ត្រូវអនុញ្ញាត x-zoe-palm-site ពី Android APK និង client ត្រូវប្រើ resolveNativeApiUrl', async () => {
    const handler = createRestoreProofHandler({ env: {} });
    const reqHeaders = new Map<string, string>([
        ['origin', 'https://localhost'],
        ['access-control-request-method', 'POST'],
        ['access-control-request-headers', 'content-type, x-zoe-id-token, x-zoe-palm-token, x-zoe-palm-site']
    ]);
    const req = {
        method: 'OPTIONS',
        url: 'https://zoe-w.netlify.app/.netlify/functions/zto-restore-proof',
        headers: { get: (k: string) => reqHeaders.get(k.toLowerCase()) ?? null }
    };
    const res = await handler(req);
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('https://localhost');
    expect(res.headers.get('access-control-allow-headers')).toContain('x-zoe-palm-site');

    const statusSrc = fs.readFileSync(path.join(ROOT, 'ZoeW/src/features/zto-restore-status.ts'), 'utf8');
    const configSrc = fs.readFileSync(path.join(ROOT, 'ZoeW/src/features/lookup-config.ts'), 'utf8');
    expect(statusSrc).toContain('resolveNativeApiUrl(');
    expect(configSrc).toContain('resolveNativeApiUrl(');

    (window as any).Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android' };
    vi.stubEnv('VITE_NATIVE_WEB_ORIGIN', 'https://zoe-w.netlify.app');
    const fetchedUrls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
        fetchedUrls.push(String(url));
        return new Response(JSON.stringify({ v: 1, success: true, kind: 'already_applied', source: null }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }));
    setAt(POLICY, { v: 1, mode: 'cookie', scope: SCOPE, branch: '001', epoch: 1 });
    appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ enabled: true, scope: SCOPE, url: '/.netlify/functions/zto-order-detail?barcode={barcode}', headerName: '', headerValue: '' }));
    const authRes = await requestRestoreAuthorization(
        { id: 'm06_src', trashGeneration: 0, trashMode: 'cookie', barcodes: [{ code: 'M06A001' }] },
        { token: 'tok_m06', targetId: 'm06_src', current: () => true }
    );
    expect(authRes.kind).toBe('already_applied');
    expect(fetchedUrls[0]).toBe('https://zoe-w.netlify.app/.netlify/functions/zto-restore-proof');

    const urlIn = document.createElement('input'); urlIn.value = '/.netlify/functions/zto-order-detail?palm=1&barcode={barcode}';
    const nameIn = document.createElement('input'); nameIn.value = '';
    const valIn = document.createElement('input'); valIn.value = '';
    refTo('lookupApiUrlInput')(urlIn);
    refTo('lookupApiHeaderNameInput')(nameIn);
    refTo('lookupApiHeaderValueInput')(valIn);
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
        fetchedUrls.push(String(url));
        return new Response(JSON.stringify({ success: true }), { status: 200 });
    }));
    try {
        await testLookupApiConfig();
    } finally {
        refTo('lookupApiUrlInput')(null);
        refTo('lookupApiHeaderNameInput')(null);
        refTo('lookupApiHeaderValueInput')(null);
    }
    expect(fetchedUrls.some(u => u.startsWith('https://zoe-w.netlify.app/.netlify/functions/zto-order-detail'))).toBe(true);
});

it('M-08៖ Firebase restore backend ពេល verdict=unconfirmed លើធុងសំរាមគ្មាន claim មិនត្រូវ stamp restoreAttestationId/restoreClaim និងត្រូវត្រឡប់ kind=hold', async () => {
    const pair = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const pem = pair.publicKey.export({ type: 'spki', format: 'pem' });
    const encode = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');
    const authTime = Math.floor(NOW / 1000) - 60;
    const claims = { aud: 'wave2-proj', iss: 'https://securetoken.google.com/wave2-proj', sub: 'u1', email: 'u1@zoew001.com',
        exp: Math.floor(NOW / 1000) + 3600, iat: Math.floor(NOW / 1000), auth_time: authTime };
    const payload = encode({ alg: 'RS256', kid: 'k1' }) + '.' + encode(claims);
    const idToken = payload + '.' + sign('RSA-SHA256', Buffer.from(payload), pair.privateKey).toString('base64url');
    const dbUrl = 'https://wave2-proj-default-rtdb.asia-southeast1.firebasedatabase.app';
    const srcPath = 'zoew_recently_deleted_cod_dod/m08_src';
    const nodes = new Map<string, any>([
        ['zoew_restore_policy/shop', { v: 1, mode: 'palm', scope: dbUrl, branch: '001', epoch: 1 }],
        [srcPath, { id: 'm08_src', phone: PHONE, scanDate: DAY, createdAt: NOW - 3 * H, deletedAt: NOW - H, trashMode: 'palm', barcodes: [{ code: 'M08A001', cod: 10, dod: 1 }] }]
    ]);
    const versions = new Map<string, number>();
    const etag = (p: string) => '"' + (versions.get(p) || 0) + '"';
    const fetchImpl = async (raw: string, init: any) => {
        const u = new URL(raw);
        if (u.hostname === 'www.googleapis.com') return Response.json({ k1: pem });
        if (u.hostname === 'oauth2.googleapis.com') return Response.json({ access_token: 'acc', expires_in: 300 });
        if (u.hostname === 'identitytoolkit.googleapis.com') return Response.json({ users: [{ localId: 'u1', email: claims.email, disabled: false, validSince: '0' }] });
        const p = u.pathname.slice(1, -5);
        if (init.method === 'GET') return Response.json(nodes.get(p) ?? null, { headers: { ETag: etag(p) } });
        if (init.headers['if-match'] !== etag(p)) return Response.json({ error: 'conflict' }, { status: 412 });
        versions.set(p, (versions.get(p) || 0) + 1);
        const val = JSON.parse(init.body);
        nodes.set(p, val);
        return Response.json(val);
    };
    const env = {
        FIREBASE_PROJECT_IDS: 'wave2-proj:001',
        ZOE_ZTO_RESTORE_FIREBASE_DATABASE_URL: dbUrl,
        FCM_SERVICE_ACCOUNT: JSON.stringify({ project_id: 'wave2-proj', client_email: 'sa@wave2-proj.iam.gserviceaccount.com', private_key: pair.privateKey.export({ type: 'pkcs8', format: 'pem' }) })
    };
    const backend = await createFirebaseBackend({ verifyActor: core.verifyRestoreFirebaseActor })({ env, token: idToken, claims, budget: deadlineBudget(), fetchImpl, now: () => NOW });
    const input = { v: 1, action: 'authorize', sourceId: 'm08_src', token: 'tok_m08', targetId: 'm08_src', expectedGeneration: 0 };
    const ctx = await backend.context(input);
    const res = await backend.apply(input, ctx, 'unconfirmed', 'att_m08_1');
    expect(res.kind).toBe('hold');
    expect(nodes.get(srcPath)).not.toHaveProperty('restoreAttestationId');
    expect(nodes.get(srcPath)).not.toHaveProperty('restoreClaim');
    expect(nodes.get(srcPath)).not.toHaveProperty('restorePublication');

    const retryInput = { ...input, token: 'tok_m08_retry' };
    const retryCtx = await backend.context(retryInput);
    const retryRes = await backend.apply(retryInput, retryCtx, 'allow', 'att_m08_2');
    expect(retryRes.kind).toBe('allow');
    expect(nodes.get(srcPath).restoreAttestationId).toBe('att_m08_2');
});

it('M-10a/b៖ releaseStaleRestoreClaimForPurge ប្រើ action=release និង cross-user expired takeover បង្កើត token ថ្មី', async () => {
    setAt(POLICY, { v: 1, mode: 'cookie', scope: SCOPE, branch: '001', epoch: 1 });
    appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ enabled: true, scope: SCOPE, url: window.location.origin + '/.netlify/functions/zto-order-detail?barcode={barcode}', headerName: '', headerValue: '' }));

    const expiredTrash: any = {
        id: 'm10a_src', phone: PHONE, scanDate: DAY, createdAt: NOW - 4 * 24 * H, deletedAt: NOW - 4 * 24 * H,
        trashGeneration: 1, trashReason: 'remove', trashMode: 'cookie', restoreAttestationId: 'att_old',
        restoreClaim: { token: 'old_tok_a', targetId: 'm10a_src', claimedAt: NOW - 10 * 60 * 1000 },
        cod: 20, dod: 1, price: 21, count: 1, barcodes: [{ code: 'M10A001', cod: 20, dod: 1, isClosed: false, isDeducted: true, createdAt: NOW - 4 * 24 * H }]
    };
    setAt(TRASH + '/m10a_src', expiredTrash);
    const proofBodies: any[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: any) => {
        const body = JSON.parse(init.body);
        proofBodies.push(body);
        if (body.action === 'release') {
            const cur = getAt(TRASH + '/' + body.sourceId);
            delete cur.restoreAttestationId;
            delete cur.restoreClaim;
            setAt(TRASH + '/' + body.sourceId, cur);
            return new Response(JSON.stringify({ v: 1, success: true, kind: 'released', source: cur }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        return new Response(JSON.stringify({ v: 1, success: true, kind: 'already_applied', source: null }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }));

    const released = await releaseStaleRestoreClaimForPurge('m10a_src');
    expect(released).toBe(true);
    expect(proofBodies.some(b => b.action === 'release' && b.sourceId === 'm10a_src' && b.token === 'old_tok_a')).toBe(true);
    expect(txCalls.filter(p => p === TRASH + '/m10a_src')).toEqual([]);

    const foreignExpired: any = {
        id: 'm10b_src', phone: PHONE, scanDate: DAY, createdAt: NOW - 3 * H, deletedAt: NOW - H,
        trashGeneration: 0, trashReason: 'remove', trashMode: 'cookie', restoreAttestationId: 'att_foreign',
        restoreClaim: { token: 'foreign_user_token', targetId: 'm10b_src', claimedAt: NOW - 10 * 60 * 1000 },
        cod: 25, dod: 2, price: 27, count: 1, barcodes: [{ code: 'M10B001', cod: 25, dod: 2, isClosed: false, isDeducted: true, createdAt: NOW - 3 * H }]
    };
    const month = DAY.substring(0, 7);
    setAt('zoew_daily_revenue_cod_dod/' + DAY, { codDollar: 100, dodDollar: 10, totalCount: 5, ded: { m10b_src: { at: NOW - H, cod: 25, dod: 2, count: 1 } } });
    setAt('zoew_monthly_revenue_cod_dod/' + month, { codDollar: 100, dodDollar: 10, totalCount: 5, ded: { m10b_src: { at: NOW - H, cod: 25, dod: 2, count: 1 } } });
    setAt(TRASH + '/m10b_src', foreignExpired);
    setAt('zoew_barcode_registry/' + barcodeRegistryKey('M10B001'), true);
    dataState.deletedItems = [clone(foreignExpired)];
    proofBodies.length = 0;
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: any) => {
        const body = JSON.parse(init.body);
        proofBodies.push(body);
        return new Response(JSON.stringify({ v: 1, success: false, code: 'ZTO_RESTORE_UNCONFIRMED' }), { status: 503, headers: { 'Content-Type': 'application/json' } });
    }));
    uiState.pendingRestoreId = 'm10b_src';
    await executeRestoreItem();
    const authCall = proofBodies.find(b => b.action === 'authorize' && b.sourceId === 'm10b_src');
    expect(authCall).toBeTruthy();
    expect(authCall.token).not.toBe('foreign_user_token');
});

it('M-21៖ Supabase migrations ចុងក្រោយត្រូវជួសជុល zoe_restore_first_commit_v1, zoe_restore_attest_v1 attribution, zoe_pull_delta O(N) និង ztoReturnedAt upgrade តែម្ដង', () => {
    const dir = path.join(ROOT, 'supabase/migrations');
    const allSql = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort().map(f => ({ file: f, text: fs.readFileSync(path.join(dir, f), 'utf8') }));
    const latestFirstCommit = [...allSql].reverse().find(m => /create\s+(?:or\s+replace\s+)?function\s+private\.zoe_restore_first_commit_v1\b/i.test(m.text))!;
    expect(latestFirstCommit.text).toMatch(/zoe\.internal_write.*admin_engine/i);
    const latestAttest = [...allSql].reverse().find(m => /create\s+(?:or\s+replace\s+)?function\s+private\.zoe_restore_attest_v1\b/i.test(m.text))!;
    const attestSlice = latestAttest.text.slice(latestAttest.text.search(/function\s+private\.zoe_restore_attest_v1/i));
    expect(attestSlice).toContain("'origin','app_engine'");
    expect(attestSlice).not.toContain("'origin','admin_engine'");
    const latestPullDelta = [...allSql].reverse().find(m => /create\s+(?:or\s+replace\s+)?function\s+public\.zoe_pull_delta\b/i.test(m.text))!;
    const pullSlice = latestPullDelta.text.slice(latestPullDelta.text.search(/function\s+public\.zoe_pull_delta/i));
    expect(pullSlice).not.toContain('rows_out := rows_out ||');

    const latestTerminal = [...allSql].reverse().find(m => /create\s+(?:or\s+replace\s+)?function\s+private\.zoe_restore_terminal_business_v1\b/i.test(m.text))!;
    expect(latestTerminal.text).toContain('prior_non_return');
    expect(latestTerminal.text).toContain("field='ztoReturnedAt'");

    const fbPath = path.join(ROOT, 'ZoeW/netlify/functions/_shared/zto-restore-firebase.cjs');
    const fbSrc = fs.readFileSync(fbPath, 'utf8');
    const fnStart = fbSrc.indexOf('function sameTerminalBarcodes(');
    const fnEnd = fbSrc.indexOf('function sameTerminalBusiness(');
    const helperFactory = new Function('integer', 'plain', 'canonical', fbSrc.slice(fnStart, fnEnd) + '\nreturn sameTerminalBarcodes;');
    const helper = helperFactory((v: any) => Number.isSafeInteger(v) && v >= 0 && v <= 9007199254740990, (v: any) => !!v && typeof v === 'object' && !Array.isArray(v), (v: any) => JSON.stringify(v));
    expect(helper([{ code: 'R1', ztoMisplacedAt: 1000, ztoReturnedAt: 1000 }], [{ code: 'R1', ztoMisplacedAt: 1000, ztoReturnedAt: 2000 }])).toBe(true);
    expect(helper([{ code: 'R1', ztoSentOutAt: 1000, ztoReturnedAt: 1000 }], [{ code: 'R1', ztoSentOutAt: 1000, ztoReturnedAt: 2000 }])).toBe(true);
    expect(helper([{ code: 'R1', ztoMisplacedAt: 1000, ztoReturnedAt: 2000 }], [{ code: 'R1', ztoMisplacedAt: 1000, ztoReturnedAt: 3000 }])).toBe(false);
    expect(helper([{ code: 'R1', ztoReturnedAt: 1000 }], [{ code: 'R1', ztoReturnedAt: 2000 }])).toBe(false);
    expect(helper([{ code: 'R1', ztoMisplacedAt: 1000, ztoReturnedAt: 1000 }], [{ code: 'R1', ztoMisplacedAt: 1000, ztoReturnedAt: 999 }])).toBe(false);
});
