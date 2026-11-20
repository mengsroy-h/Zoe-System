import crypto from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { dataState, firebaseState } from '../../../../ZoeW/src/core/state';
import { appLocalStore } from '../../../../ZoeW/src/core/storage';
import { addSignJob, sealSignJob, SIGN_OUTBOX_MAX } from '../../../../ZoeW/src/services/palm-sign-outbox-store';
import { acceptFixtureSession, configureFixtureBackend } from './helpers/accepted-session';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(__dirname, '../../../..');
const { withReservation } = require(path.join(ROOT, 'ZoeW/netlify/functions/_shared/zto-palm-sign-reservation.js'));
const { verifyReceiptPhoto } = require(path.join(ROOT, 'ZoeW/netlify/functions/_shared/zto-receipt-photo-readback.js'));
const { createPushService } = await import(pathToFileURL(path.join(ROOT, 'ZoeW/netlify/lib/push-core.mjs')).href);

function memoryStore() {
    const map = new Map<string, { value: any; etag: string }>();
    let ver = 0;
    return {
        map,
        async getWithMetadata(key: string) {
            const hit = map.get(key);
            return hit ? { data: JSON.parse(JSON.stringify(hit.value)), etag: hit.etag } : null;
        },
        async get(key: string) {
            const hit = map.get(key);
            return hit ? JSON.parse(JSON.stringify(hit.value)) : null;
        },
        async setJSON(key: string, value: any, opts?: any) {
            const hit = map.get(key);
            if (opts?.onlyIfNew && hit) return { modified: false };
            if (opts?.onlyIfMatch && (!hit || hit.etag !== opts.onlyIfMatch)) return { modified: false };
            const etag = 'e' + (++ver);
            map.set(key, { value: JSON.parse(JSON.stringify(value)), etag });
            return { modified: true, etag };
        },
        async list(opts?: any) {
            const prefix = opts?.prefix || '';
            return { blobs: [...map.keys()].filter(k => k.startsWith(prefix)).sort().map(key => ({ key })) };
        },
        async delete(key: string) { map.delete(key); }
    };
}

beforeEach(() => {
    appLocalStore.clear();
    configureFixtureBackend('wave4-fixture');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

it('M-05៖ zto-palm.js ត្រូវ fail-closed ពេល access.binding=mismatch ឬ access.site ទទេលើ bound project (both otherBranch និង palmList)', async () => {
    const palmPath = path.join(ROOT, 'ZoeW/netlify/functions/_shared/zto-palm.js');
    const ctx = vm.createContext({
        require: createRequire(palmPath), module: { exports: {} }, exports: {},
        Buffer, URL, URLSearchParams, AbortController, Date, setTimeout, clearTimeout, process: { env: {} },
        fetch: globalThis.fetch, crypto
    });
    vm.runInContext(fs.readFileSync(palmPath, 'utf8') + '\nmodule.exports._test = { otherBranch, palmList };', ctx);
    const { otherBranch, palmList } = ctx.module.exports._test;

    expect(otherBranch({ verified: true, site: '', binding: 'mismatch' }, '001')).toBe(true);
    expect(otherBranch({ verified: true, site: '', binding: 'bound' }, '001')).toBe(true);
    expect(otherBranch({ verified: true, site: '', binding: 'server' }, '001')).toBe(true);
    expect(otherBranch({ verified: true, site: '', binding: 'unbound' }, '001')).toBe(false);
    expect(otherBranch({ verified: true, site: '001', binding: 'bound' }, '001')).toBe(false);
    expect(otherBranch({ verified: true, site: '002', binding: 'bound' }, '001')).toBe(true);

    let upstreamCalled = false;
    const res = await palmList(
        { from: '2026-11-18', to: '2026-11-18', page: '1', signed: '1' },
        { token: 'tok', site: '001', siteName: 'B1', operator: 'op' },
        {},
        {
            listRange: (from: string, to: string) => ({ from, to }),
            listSignedRange: (r: any) => r,
            listMaxPages: 5,
            lookupAccess: async () => ({ verified: true, site: '', binding: 'mismatch' }),
            fetchFn: async () => { upstreamCalled = true; return new Response('{}', { status: 200 }); }
        }
    );
    const body = JSON.parse(res.body);
    expect(upstreamCalled).toBe(false);
    expect(body.success).toBe(false);
    expect(body.reason).toBe('site:palm-other-branch');
});

it('M-07៖ zto-order-detail-core.cjs៖ 1) -710 Return ឈ្នះ 02 Dispatch-Out ក្នុង cookieRestoreTransitions 2) retryAfterAuthRejected អាប់ដេត headers', async () => {
    const corePath = path.join(ROOT, 'ZoeW/netlify/functions/_shared/zto-order-detail-core.cjs');
    const coreSrc = fs.readFileSync(corePath, 'utf8');
    expect(coreSrc).toContain('headers = retried.headers;');

    const sentAt = Date.UTC(2026, 10, 18, 4, 0, 0);
    const returnedAt = Date.UTC(2026, 10, 18, 3, 0, 0);
    const arrivalAt = Date.UTC(2026, 10, 18, 1, 0, 0);
    const fmt = (ms: number) => new Date(ms + 7 * 3600 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    const fakeFetch = async (_raw: string, init: any) => {
        const body = JSON.parse(String(init?.body || '{}'));
        const scanType = String(body?.condition?.scanTypeCode || '');
        const mk = (at: number) => ({ total: 1, pages: 1, pageNum: 1, list: [{ billCode: 'M07TEST001', scanTypeCode: scanType, scanSiteCode: '001', scanDate: fmt(at) }] });
        const empty = { total: 0, pages: 0, pageNum: 1, list: [] };
        const map: Record<string, any> = { '03': mk(arrivalAt), '-710': mk(returnedAt), '02': mk(sentAt), '01': empty, '05': empty };
        return new Response(JSON.stringify({ status: true, result: map[scanType] || empty }), { status: 200 });
    };
    const realReq = createRequire(corePath);
    const wrappedReq = (id: string) => {
        const mod = realReq(id);
        if (id === './zto-palm') return Object.assign({}, mod, { ztoFetch: fakeFetch });
        return mod;
    };
    const ctx = vm.createContext({
        require: wrappedReq, module: { exports: {} }, exports: {},
        Buffer, URL, URLSearchParams, AbortController, Date, setTimeout, clearTimeout, process: { env: {} },
        fetch: fakeFetch, Response
    });
    vm.runInContext(coreSrc + '\nmodule.exports._test = { cookieRestoreTransitions };', ctx);
    const { cookieRestoreTransitions } = ctx.module.exports._test;

    const config = {
        timeoutMs: 5000,
        upstreamTimeoutMs: 3000,
        retries: 0,
        budgetMs: 10000,
        fingerprint: 'fp-m07',
        listCacheTtlMs: 0,
        trustedRestoreBasis: arrivalAt - 60000,
        trustedRestoreSite: '001',
        list: {
            enabled: true,
            fingerprint: 'lfp-m07',
            url: new URL('https://zto.test.invalid/list'),
            arrivalType: '03',
            signedType: '01',
            returnType: '-710',
            sendType: '02',
            problemType: '05',
            scanType: '03',
            scanDescs: [],
            signedDescs: [],
            returnDescs: [],
            sendDescs: [],
            misplacedReasons: [],
            pageSize: 50,
            maxPages: 3,
            countryCode: 'KH'
        }
    };
    const res = await cookieRestoreTransitions(config, { Cookie: 'SESSION=fresh-c2' }, 'M07TEST001', { cookie: 'SESSION=fresh-c2' }, Date.now());
    expect(res).toBeTruthy();
    expect(res.restoreTransitionsVerified).toBe(true);
    expect(res.ztoClosed).toBe(false);
    expect(res.ztoReturnedAt).toBe(returnedAt);
    expect(res.ztoSentOutAt).toBeUndefined();
});

it('M-15៖ push-core.mjs៖ 1) មិនបោះ notice ថ្មីជា stale ពេលនាឡិកា cross-server ខុស ២ វិនាទី 2) dispatchExpiry cursor មិនរំលងហាងដែលត្រូវ cut ដោយ budget', async () => {
    const store = memoryStore();
    const t0 = Date.UTC(2026, 10, 18, 1, 0, 0);
    await store.setJSON('state/notices', { lastId: 'n1700000000000aaaaaa', at: t0 - 60000 });
    const noticeId = 'n' + String(t0 + 2000) + 'bbbbbb';
    await store.setJSON('sub/s1', { kind: 'fcm', token: 'a'.repeat(40), keyId: '1234567890ABCDEF' });
    const sentFcmBodies: any[] = [];
    const svc = createPushService({
        store,
        now: () => t0,
        fcmTokenState: { token: 'synthetic-fcm-access', exp: t0 + 3600000, inFlight: null },
        fetch: async (url: string, init?: any) => {
            if (String(url).includes('license_announcements')) {
                return new Response(JSON.stringify({ [noticeId]: { at: t0 + 2000, title: 'សួស្តី', body: 'សេចក្តីជូនដំណឹងថ្មី' } }), { status: 200 });
            }
            if (String(url).includes('messages:send')) {
                sentFcmBodies.push(JSON.parse(init.body));
                return new Response(JSON.stringify({ name: 'projects/p/messages/1' }), { status: 200 });
            }
            return new Response(JSON.stringify({}), { status: 200 });
        },
        config: { licenseDbUrl: 'https://notices.test.invalid', fcm: { projectId: 'p' } }
    });
    const noticeRes = await svc.dispatchNotices(t0);
    expect(noticeRes.reason).toBe('sent');
    expect(sentFcmBodies.length).toBe(1);

    const store2 = memoryStore();
    const keyA = 'AAAAAAAAAAAAAAAA', keyB = 'BBBBBBBBBBBBBBBB', keyC = 'CCCCCCCCCCCCCCCC';
    for (const k of [keyA, keyB, keyC]) {
        await store2.setJSON('sched/' + k, { at: t0 - 1000, times: [t0 + 3600000] });
        await store2.setJSON('bykey/' + k, { subs: ['sub/' + k] });
        await store2.setJSON('sub/' + k, { kind: 'fcm', token: k.repeat(3), keyId: k });
    }
    let now2 = t0;
    let reads = 0;
    const slowStore: any = {
        ...store2,
        async getWithMetadata(key: string) {
            if (key === 'bykey/' + keyB) {
                reads++;
                now2 = t0 + 19500;
            }
            return store2.getWithMetadata(key);
        }
    };
    const svc2 = createPushService({
        store: slowStore,
        now: () => now2,
        fcmTokenState: { token: 'synthetic-fcm-access', exp: t0 + 3600000, inFlight: null },
        fetch: async () => new Response(JSON.stringify({ name: 'projects/p/messages/1' }), { status: 200 }),
        config: { licenseDbUrl: 'https://notices.test.invalid', fcm: { projectId: 'p' } }
    });
    const expRes = await svc2.dispatchExpiry(t0);
    expect(reads).toBe(1);
    expect(expRes.cut).toBeGreaterThan(0);
    const cursor = await store2.get('state/expiry-cursor');
    expect(cursor?.after).not.toBe('sched/' + keyB);
    expect(cursor?.after).not.toBe('sched/' + keyC);
});

it('M-16៖ Palm Sign Queue៖ 1) 401/5xx/RETRY_LATER មិន block ឬជាប់ lease 90s 2) expired lease មិនបិទ archive/dismiss 3) batch sign ពេញ retained signed jobs 4) readback barcode regex', async () => {
    const readbackBad = await verifyReceiptPhoto({
        authenticated: true,
        barcode: 'ZTO_abc-123456789012345678901234567890123456789012',
        expectedSha256: 'a'.repeat(64),
        receiptRefs: ['https://invalid.example.com/a.jpg']
    });
    expect(readbackBad.reason).toBe('invalid_reference');

    const photo = Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString('base64');
    const sha = crypto.createHash('sha256').update(Buffer.from(photo, 'base64')).digest('hex');
    const proofCodec = {
        seal: (obj: any) => Buffer.from(JSON.stringify(obj)).toString('base64url'),
        open: (tok: string) => { try { return JSON.parse(Buffer.from(String(tok || ''), 'base64url').toString('utf8')); } catch { return null; } }
    };
    const replies = {
        reply: (statusCode: number, body: any) => ({ statusCode, body: JSON.stringify(body) }),
        pending: () => ({ statusCode: 202, body: JSON.stringify({ code: 'PENDING' }) }),
        unavailable: () => ({ statusCode: 503, body: JSON.stringify({ code: 'UNAVAILABLE' }) }),
        success: () => ({ statusCode: 200, body: JSON.stringify({ success: true }) }),
        rejected: () => ({ statusCode: 409, body: JSON.stringify({ code: 'REJECTED' }) })
    };
    for (const [label, statusCode, errCode] of [['502', 502, 'ZTO_UNAVAILABLE'], ['401', 401, 'ZTO_AUTH_EXPIRED']] as const) {
        const reqId = 'req_' + label + '_' + crypto.randomUUID();
        const code = 'M16CODE' + label.slice(0, 3);
        const fingerprint = crypto.createHash('sha256').update(JSON.stringify([code, reqId, 'Test', photo])).digest('hex');
        let saved: any = {
            phase: 'reservation-v1:reserved', owner: 'owner1', attempt: 'att1',
            reservationProtocol: 'original-reservation-v1', photoProtocol: 'palm-receipt-v1',
            requestId: reqId, originalSHA256: sha, fingerprint, photoAccepted: false, leaseUntil: 0, leaseStartedAt: 0
        };
        const resToken = proofCodec.seal({
            kind: 'sign-reservation', scope: 'scope1', protocol: 'original-reservation-v1',
            owner: 'owner1', barcode: code, requestId: reqId, originalSHA256: sha, originalFingerprint: fingerprint,
            attempt: 'att1', expiresAt: Date.now() + 60000
        });
        const sendRes = await withReservation(
            { stage: 'receipt', barcode: code, requestId: reqId, signMan: 'Test', photo, photoProtocol: 'palm-receipt-v1',
                originalSHA256: sha, reservationProtocol: 'original-reservation-v1', originalFingerprint: fingerprint,
                reservationOwner: 'owner1', reservationToken: resToken },
            'scope1', proofCodec, () => saved, async (next: any) => { saved = next; },
            async () => ({ statusCode, body: JSON.stringify({ success: false, code: errCode }) }),
            async () => ({ statusCode: 200, body: JSON.stringify({ success: true, barcode: code, ztoClosed: false }) }), replies
        );
        expect(sendRes.statusCode).toBe(statusCode);
        expect(saved.phase).toBe('reservation-v1:blocked');
        expect(saved.leaseUntil).toBe(0);
    }

    const rowsMap = new Map<string, any>();
    const prevIndexedDB = (globalThis as any).indexedDB;
    (globalThis as any).indexedDB = {
        open: () => {
            const openReq: any = { onupgradeneeded: null, onsuccess: null, onerror: null, onblocked: null, result: null };
            const dbObj: any = {
                close: () => {},
                createObjectStore: () => ({ createIndex: () => {} }),
                transaction: () => {
                    let aborted = false;
                    let pending = 0;
                    const tx: any = {
                        oncomplete: null, onabort: null, onerror: null, error: null,
                        abort: () => { if (!aborted) { aborted = true; queueMicrotask(() => tx.onabort?.()); } }
                    };
                    const wrap = (fn: () => any) => {
                        pending++;
                        const req: any = { result: undefined, onsuccess: null, onerror: null };
                        queueMicrotask(() => {
                            if (aborted) return;
                            try { req.result = fn(); req.onsuccess?.(); } catch (e) { req.error = e; tx.error = e; req.onerror?.(); }
                            pending--;
                            if (pending === 0 && !aborted) queueMicrotask(() => { if (!aborted) tx.oncomplete?.(); });
                        });
                        return req;
                    };
                    const store: any = {
                        transaction: tx,
                        get: (id: string) => wrap(() => rowsMap.get(id)),
                        add: (row: any) => wrap(() => { rowsMap.set(row.id, row); return row.id; }),
                        index: () => ({
                            count: (o: string) => wrap(() => Array.from(rowsMap.values()).filter((r) => r.owner === o).length),
                            getAll: (o: string) => wrap(() => Array.from(rowsMap.values()).filter((r) => r.owner === o)),
                            getAllKeys: (o: string) => wrap(() => Array.from(rowsMap.values()).filter((r) => r.owner === o).map((r) => r.id))
                        })
                    };
                    tx.objectStore = () => store;
                    return tx;
                }
            };
            openReq.result = dbObj;
            queueMicrotask(() => { openReq.onsuccess?.(); });
            return openReq;
        }
    };
    try {
        const key = (await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])) as unknown as CryptoKey;
        const owner = 'wave4-batch-owner-' + Date.now();
        const baseJob = (i: number, signed: boolean) => ({
            code: 'BATCH' + i, itemId: 'item_' + i, signMan: 'A', photo: 'data:image/jpeg;base64,AA==', dispatchProof: '',
            requestId: 'r_' + i, reservationProtocol: 'original-reservation-v1',
            originalSHA256: 'a'.repeat(64), originalFingerprint: 'b'.repeat(64),
            signature: 'sig_' + i, parcelIdentity: 'pid_' + i, attempts: 0,
            phase: signed ? 'confirmed' : 'queued', signedCleanupConfirmed: signed, message: ''
        });
        for (let i = 0; i < SIGN_OUTBOX_MAX - 1; i++) {
            const env = await sealSignJob(owner, key, baseJob(i, true) as any);
            expect(await addSignJob(env, () => true, key)).toBe(true);
        }
        const [aEnv, bEnv] = await Promise.all([
            sealSignJob(owner, key, baseJob(100, false) as any),
            sealSignJob(owner, key, baseJob(101, false) as any)
        ]);
        const results = await Promise.all([
            addSignJob(aEnv, () => true, key),
            addSignJob(bEnv, () => true, key)
        ]);
        expect(results).toEqual([true, true]);
    } finally {
        (globalThis as any).indexedDB = prevIndexedDB;
    }

    firebaseState.auth = { currentUser: { uid: 'u-archive' } } as any;
    firebaseState.db = { name: 'wave4-db' } as any;
    firebaseState.isDatabaseConnected = true;
    acceptFixtureSession();
    const archiveSrc = fs.readFileSync(path.join(ROOT, 'ZoeW/src/features/palm-sign-outbox.ts'), 'utf8');
    expect(archiveSrc).not.toContain('if (value.row.leaseUntil > 0)');
    expect(archiveSrc).not.toContain('|| value.row.leaseUntil > 0)');
    void dataState;
});
