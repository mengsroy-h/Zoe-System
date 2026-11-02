/**
 * ✍️ ZTO Palm Sign ពីដើមដល់ចប់ ៖ App ពិត (`zto-palm-sign.ts`) ➜ Function ពិត (`zto-order-detail-core.cjs` ➜ `_shared/zto-palm-sign.js`) ➜ ZTO Palm ក្លែង។
 * សំណើម្ចាស់គម្រោង ៖ «ZTO Palm ពេលស្កេន ចែកចាយមិនផ្ទុករូបភាពទេនិងឈ្មោះទេ តែមានសារលោតបញ្ជាក់ បញ្ហាដូចពេល Sign ដែរ … ការ Sign ដំណើរការត្រឹមត្រូវ100%ហើយ»។
 * ⛔ តេស្តនេះចាប់ការមិនស្របគ្នារវាង App និង Function (ឈ្មោះវាល `stage` · `confirmationToken` · `dispatchProof`) ដែលតេស្តដាច់ពីគ្នាមើលមិនឃើញ។
 * Barcode · លេខ ជាលេខក្លែង។
 */
import { webcrypto } from 'node:crypto';
import { createRequire } from 'node:module';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { dataState, firebaseState, securityState } from '../src/core/state';
import { palmSignState } from '../src/core/palm-sign-state';
import { appLocalStore } from '../src/core/storage';
import { registerModalMeta, unregisterModalMeta } from '../src/core/modals';
import { acceptPalmSignBarcode, cancelPalmSignConfirmation, openZtoPalmSign, palmSignProof, setPalmSignName, submitZtoPalmSign } from '../src/features/zto-palm-sign';
import { applyBarcodeCloseChange } from '../src/features/barcode-ops';
import { encryptLookupSecret } from '../src/services/crypto';
import { closeModal } from '../src/ui/modal';
import { actOnQueuedSign, runPalmSignOutbox } from '../src/features/palm-sign-outbox';
import { openSignJob } from '../src/services/palm-sign-outbox-store';

const disk = vi.hoisted(() => ({ rows: new Map<string, any>() }));
vi.mock('../src/services/palm-sign-outbox-store', async original => ({ ...await original<any>(),
    listSignJobs: vi.fn(async owner => [...disk.rows.values()].filter(row => row.owner === owner).map(row => ({ ...row }))),
    addSignJob: vi.fn(async (row, current) => { if (!current() || disk.rows.has(row.id)) return false; disk.rows.set(row.id, { ...row }); return true; }),
    replaceSignJob: vi.fn(async (previous, next, current) => { const row = disk.rows.get(previous.id); if (!current() || !row || row.revision !== previous.revision) return false; if (next) disk.rows.set(next.id, { ...next }); else disk.rows.delete(previous.id); return true; })
}));
vi.mock('../src/services/palm-sign-camera', () => ({ palmSignLocation: { status: 'ready' }, subscribePalmSignLocation: vi.fn(() => () => {}), capturePalmSignPhoto: vi.fn(async () => ''), palmSignFramePhoto: vi.fn(() => ''), startPalmSignCamera: vi.fn(() => () => {}), startPalmSignLocation: vi.fn(() => () => {}) }));
vi.mock('../src/features/barcode-ops', () => ({
    openViewListModal: () => {}, removeSingleBarcode: async () => 'failed', toggleIndividualBarcodeClose: async () => false,
    openEditBarcodePriceModal: () => {}, closeEditBarcodeModal: () => {}, saveEditedBarcodePrice: () => {},
    applyBarcodeCloseChange: vi.fn(async () => true)
}));

const req = createRequire(import.meta.url);
const fn = req('../netlify/functions/_shared/zto-order-detail-core.cjs');
const KEY = 'sign-e2e-proxy-key-0123456789';
const CODE = '77130500000012';
const PHOTO = '/9j/AAECAwQF/9k=';
const READBACK = Buffer.from([255,216,255,192,0,11,8,0,1,0,1,1,1,17,0,255,218,0,8,1,1,0,0,63,0,1,255,217]);
const PHOTO_URL = 'https://zto-haiwai2025.oss-cn-hongkong.aliyuncs.com/track/shortterm/bill/1/202610/' + CODE + '_123.jpg';
let readback: 'none' | 'exact' | 'wrong' = 'none';
let remoteSigned = false;
const SITE = 'KH001';
const PROBLEM = 'ទំនិញនេះគឺជាទំនិញដែលមានបញ្ហា សូមបញ្ជាក់ថាបានដោះស្រាយបញ្ហាហើយឬនៅ';
const reply = (result: unknown, status = true) => new Response(JSON.stringify({ status, result }));
let zto: Array<{ path: string; body: any }> = [];
let warnings: Record<string, string | null> = {};
let changingWarning = false;
let journalEdgeLagMs = 0;
let interruption: 'none' | 'before-reservation' | 'reservation-ack' | 'scan-ack' = 'none';
const tracks = () => {
    const rows: any[] = [{ action: '3', siteCode: SITE, mailNo: CODE, time: '2026-10-18 13:25:26' }];
    if (zto.some((c) => c.path.endsWith('saveScanInfo') && c.body[0].scanTypeCode === '04')) rows.unshift({ action: '4', siteCode: SITE, mailNo: CODE, time: '2026-10-18 13:33:04', preOrNextID: '04' });
    if (remoteSigned) rows.unshift({ action: '5', siteCode: SITE, mailNo: CODE, time: '2026-10-18 13:34:04' });
    return [{ mail: { mailNo: CODE, isSign: remoteSigned ? 1 : 0 }, tracks: rows }];
};
function fakeZto(url: string, init?: RequestInit) {
    const path = new URL(url).pathname;
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    zto.push({ path, body });
    if (path.endsWith('doLogin')) return reply({ token: 'palm-token', countryCode: 'KH', siteCode: SITE });
    if (path.endsWith('queryTrackInfo')) return reply(tracks());
    if (path.endsWith('newBusinessCheck')) {
        const message = warnings[String(body.scanType)];
        return reply(message ? { message: changingWarning ? message + ' ' + zto.length : message, whetherForce: false } : null);
    }
    if (path.endsWith('querySignPic')) return reply(readback === 'none' ? [] : [{ billCode: CODE, savePos: PHOTO_URL }]);
    if (path.endsWith('queryPreOrderByBillCode')) return reply({ billCode: CODE });
    if (path.endsWith('/add')) return reply('log-id');
    if (path.endsWith('saveScanInfo')) {
        if (body[0].scanTypeCode === '05' && interruption === 'scan-ack') { interruption = 'none'; throw new Error('synthetic-lost-ack'); }
        return reply([]);
    }
    return reply(null);
}
async function route(url: unknown, init?: RequestInit) {
    const target = String(url);
    if (target === PHOTO_URL) {
        const bytes = Buffer.from(READBACK); if (readback === 'wrong') bytes[25] ^= 1;
        expect(new Headers(init?.headers).has('Authorization')).toBe(false);
        expect(init?.credentials).toBe('omit'); expect(init?.redirect).toBe('error');
        return new Response(bytes, { headers: { 'Content-Type': 'image/jpeg' } });
    }
    if (!target.includes('/.netlify/functions/zto-order-detail')) return fakeZto(target, init);
    const parsed = new URL(target);
    const headers: Record<string, string> = {};
    new Headers(init?.headers as HeadersInit).forEach((value, key) => { headers[key.toLowerCase()] = value; });
    const stage = init?.body ? JSON.parse(String(init.body)).stage : '';
    if (stage === 'receipt-status' && interruption === 'before-reservation') { interruption = 'none'; throw new Error('synthetic-before-server'); }
    const res = await fn.handler({ httpMethod: init?.method || 'GET', headers, queryStringParameters: Object.fromEntries(parsed.searchParams), blobs: 'synthetic-context', body: init?.body ? String(init.body) : null });
    if (stage === 'receipt-status' && interruption === 'reservation-ack') { interruption = 'none'; throw new Error('synthetic-lost-reservation'); }
    return new Response(res.body, { status: res.statusCode, headers: res.headers });
}
const scans = (type: string) => zto.filter((c) => c.path.endsWith('saveScanInfo') && c.body[0].scanTypeCode === type).map((c) => c.body[0]);

async function expectQueueCompleted() {
    await vi.waitFor(async () => {
        const jobs = await Promise.all([...disk.rows.values()].map(row => openSignJob(row, securityState.lookupSecretKey!)));
        expect(jobs.every(job => job.recoveryCheck?.signedStatusVerified === true)).toBe(true);
    });
    const offset = firebaseState.serverTimeOffsetMs;
    const connected = firebaseState.isDatabaseConnected, trusted = firebaseState.serverClockTrusted;
    try {
        firebaseState.isDatabaseConnected = true; firebaseState.serverClockTrusted = true;
        await vi.waitFor(async () => {
            await runPalmSignOutbox();
            expect(((await Promise.all([...disk.rows.values()].map(async row => ({ row, job: await openSignJob(row, securityState.lookupSecretKey!) }))))).every(value => Number.isFinite(value.job.signedCleanupAt))).toBe(true);
        });
        firebaseState.serverTimeOffsetMs = offset + 86400001;
        await runPalmSignOutbox(); await vi.waitFor(() => expect(disk.rows.size).toBe(0));
    } finally {
        firebaseState.serverTimeOffsetMs = offset; firebaseState.isDatabaseConnected = connected; firebaseState.serverClockTrusted = trusted;
    }
}
beforeEach(async () => {
    const rows = new Map<string, { data: string; etag: string }>();
    let revision = 0;
    const edge = new Map<string, { value: { data: string; etag: string }; staleUntil: number }>();
    journalEdgeLagMs = 0;
    const store = {
        getWithMetadata: async (key: string, options?: { consistency?: string }) => {
            const authoritative = rows.get(key);
            if (!journalEdgeLagMs || !key.startsWith('palm-sign-v1/')) return authoritative || null;
            if (options?.consistency === 'strong') return authoritative || null;
            const cached = edge.get(key);
            if (cached && cached.staleUntil > Date.now()) return { ...cached.value };
            if (authoritative) edge.set(key, { value: { ...authoritative }, staleUntil: Infinity });
            return authoritative || null;
        },
        set: async (key: string, data: string, options: any) => {
            const previous = rows.get(key);
            if (options?.onlyIfNew && previous || options?.onlyIfMatch && previous?.etag !== options.onlyIfMatch) return { modified: false };
            const etag = String(++revision);
            rows.set(key, { data, etag });
            if (journalEdgeLagMs && key.startsWith('palm-sign-v1/')) {
                if (!previous) edge.set(key, { value: { data, etag }, staleUntil: Infinity });
                else {
                    const cached = edge.get(key);
                    if (cached && cached.staleUntil === Infinity) cached.staleUntil = Date.now() + journalEdgeLagMs;
                }
            }
            return { modified: true, etag };
        }
    };
    fn.setBlobsModuleForTests({ connectLambda() {}, getStore: () => store });
    for (const [key, value] of Object.entries({ ZTO_PROXY_KEY: KEY, ZTO_PROXY_KEYS_JSON: '', ZTO_PALM_SESSION_SECRET: 'synthetic-session-secret-at-least-32-characters', ZTO_PALM_SIGN_KEY: 'synthetic-sign-key', ZTO_PALM_PASSWORD_KEY: 'zoew-test-aes-16', ZTO_DETAIL_IDENTITY: 'off', ZTO_DETAIL_BRANCH_PATHS: '' })) vi.stubEnv(key, value);
    disk.rows.clear(); readback = 'none'; remoteSigned = false;
    vi.stubGlobal('indexedDB', {});
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    zto = [];
    warnings = {};
    changingWarning = false; interruption = 'none';
    vi.stubGlobal('fetch', vi.fn(route));
    const login = await fn.handler({ httpMethod: 'POST', headers: { 'x-zoe-proxy-key': KEY }, queryStringParameters: { palm: 'login' }, body: JSON.stringify({ username: 'test-operator', password: 'test', deviceSn: 'zoew-sign-e2e' }) });
    const session = JSON.parse(login.body).sessionToken;
    expect(session).toEqual(expect.any(String));
    zto = [];
    vi.stubGlobal('crypto', webcrypto);
    appLocalStore.clear();
    appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: 'https://sign-shop.firebaseio.com' }));
    firebaseState.authGeneration++;
    firebaseState.db = {};
    firebaseState.fb = { getIdTokenResult: async () => ({ token: 'synthetic-identity' }) };
    firebaseState.auth = { currentUser: { uid: 'audit-user' } };
    securityState.appIsLocked = false; securityState.appLockVeiled = false;
    securityState.lookupSecretKey = await webcrypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']) as any;
    appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ enabled: true, url: window.location.origin + '/.netlify/functions/zto-order-detail?palm=1&barcode={barcode}',
        headerName: 'X-Zoe-Proxy-Key', headerValueEnc: await encryptLookupSecret(KEY), palmTokenEnc: await encryptLookupSecret(session), shop: 'https://sign-shop.firebaseio.com' }));
    dataState.scanHistory = [{ id: 'item1', phone: '012000000', isClosed: false, barcodes: [{ code: CODE, isClosed: false }] }];
    registerModalMeta('ztoPalmSignModal', {});
    palmSignState.busy = false;
    vi.mocked(applyBarcodeCloseChange).mockReset().mockResolvedValue(true);
});
afterEach(async () => {
    firebaseState.authGeneration++; securityState.lookupSecretKey = null;
    await runPalmSignOutbox();
    fn.setBlobsModuleForTests(null);
    closeModal('ztoPalmSignModal');
    unregisterModalMeta('ztoPalmSignModal');
    vi.unstubAllGlobals();
    vi.unstubAllEnvs(); vi.restoreAllMocks();
    securityState.lookupSecretKey = null;
});

async function openAndScan(photo = PHOTO) {
    openZtoPalmSign('item1', CODE);
    await vi.waitFor(() => expect(palmSignState.checking).toBe(false));
    expect(palmSignState.checked[CODE]).toBe(true);
    acceptPalmSignBarcode(CODE, photo);
}

it('ចែកចាយកញ្ចប់មានបញ្ហា ៖ បញ្ជាក់ស្វ័យប្រវត្តិ ➜ 04 តែម្តង (គ្មានរូប គ្មានឈ្មោះ) ➜ Sign 05 + រូប ➜ បិទក្នុង ZoeW', async () => {
    warnings = { 4: PROBLEM };
    await openAndScan();
    await vi.waitFor(() => expect(palmSignProof(CODE)).toMatch(/^.{8,}$/));
    expect(palmSignState.confirmation).toBeNull();
    expect(scans('04')).toHaveLength(1);
    expect(scans('04')[0]).toMatchObject({ billCode: CODE, dispatchOrSendManCode: 'test-operator' });
    expect(scans('04')[0].signMan).toBeUndefined();
    expect(zto.some((c) => c.path.endsWith('saveBillPic'))).toBe(false);
    setPalmSignName('សុខា');
    await submitZtoPalmSign();
    await vi.waitFor(() => expect(applyBarcodeCloseChange).toHaveBeenCalledOnce());
    expect(scans('05')).toHaveLength(1);
    await vi.waitFor(async () => { const jobs = await Promise.all([...disk.rows.values()].map(row => openSignJob(row, securityState.lookupSecretKey!))); expect(jobs).toHaveLength(1); expect(jobs[0]).toMatchObject({ photo: PHOTO, scanCompleted: true, phase: 'checking' }); });
    expect(scans('05')[0]).toMatchObject({ billCode: CODE, signMan: 'សុខា' });
    expect(zto.filter((c) => c.path.endsWith('saveBillPic')).map((c) => c.body)).toEqual([{ fileName: PHOTO, picType: 1, billCode: CODE }]);
});

it('សារចែកចាយផ្លាស់ក្រោយសាកស្វ័យប្រវត្តិ ៖ «បោះបង់» ➜ គ្មាន 04 · ស្កេនម្តងទៀតនៅតែទាមទារបញ្ជាក់', async () => {
    warnings = { 4: PROBLEM };
    changingWarning = true;
    await openAndScan();
    await vi.waitFor(() => expect(palmSignState.confirmation?.stage).toBe('dispatch'));
    cancelPalmSignConfirmation();
    expect(palmSignState.confirmation).toBeNull();
    setPalmSignName('សុខា');
    await submitZtoPalmSign();
    expect(scans('04')).toEqual([]);
    expect(scans('05')).toEqual([]);
    expect(applyBarcodeCloseChange).not.toHaveBeenCalled();
    acceptPalmSignBarcode(CODE, PHOTO);
    await vi.waitFor(() => expect(palmSignState.confirmation?.stage).toBe('dispatch'));
    expect(scans('04')).toEqual([]);
});

it('កញ្ចប់គ្មានបញ្ហា ➜ 04 ភ្លាម · បញ្ហាធម្មតាពេលទទួល ➜ បញ្ជាក់ receipt ស្វ័យប្រវត្តិ ហើយផ្ញើរូប និង 05 តែម្តង', async () => {
    warnings = { 5: PROBLEM };
    await openAndScan();
    await vi.waitFor(() => expect(palmSignProof(CODE)).toMatch(/^.{8,}$/));
    expect(palmSignState.confirmation).toBeNull();
    setPalmSignName('សុខា');
    await submitZtoPalmSign();
    await vi.waitFor(() => expect(applyBarcodeCloseChange).toHaveBeenCalledOnce());
    expect(palmSignState.confirmation).toBeNull();
    expect(scans('04')).toHaveLength(1);
    expect(scans('05')).toHaveLength(1);
    await vi.waitFor(async () => { const jobs = await Promise.all([...disk.rows.values()].map(row => openSignJob(row, securityState.lookupSecretKey!))); expect(jobs).toHaveLength(1); expect(jobs[0]).toMatchObject({ photo: PHOTO, scanCompleted: true, phase: 'checking' }); });
});


it.each(['exact', 'wrong'] as const)('UI → handler → Palm → រូប %s៖ លុបតែរូបដើមដែលផ្ទៀង SHA រួច និងបិទក្នុង ZoeW រួច', async (kind) => {
    readback = kind;
    const original = READBACK.toString('base64');
    await openAndScan(original);
    await vi.waitFor(() => expect(palmSignProof(CODE)).toMatch(/^.{8,}$/));
    setPalmSignName('សុខា');
    await submitZtoPalmSign();
    await vi.waitFor(() => expect(scans('05')).toHaveLength(1));
    await vi.waitFor(() => expect(applyBarcodeCloseChange).toHaveBeenCalled());
    if (kind === 'exact') await expectQueueCompleted();
    else await vi.waitFor(async () => {
        expect(disk.rows.size).toBe(1);
        const job = await openSignJob([...disk.rows.values()][0], securityState.lookupSecretKey!);
        expect(job).toMatchObject({ photo: original, scanCompleted: true, phase: 'checking' });
        expect(job.photoVerified).not.toBe(true);
    });
    expect(scans('05')).toHaveLength(1);
    expect(zto.filter(call => call.path.endsWith('querySignPic'))).toHaveLength(1);
});


it.each(['before-reservation', 'reservation-ack', 'scan-ack'] as const)('UI → handler៖ បាត់ចម្លើយ %s ស្តារតែការងារមុនសរសេរ និងមិន replay05', async (failure) => {
    readback = 'exact';
    await openAndScan(READBACK.toString('base64'));
    await vi.waitFor(() => expect(palmSignProof(CODE)).toMatch(/^.{8,}$/));
    interruption = failure;
    setPalmSignName('សុខា');
    await submitZtoPalmSign();
    await vi.waitFor(async () => {
        expect(disk.rows.size).toBe(1);
        const row = [...disk.rows.values()][0];
        expect(row.leaseUntil).toBe(0);
        const job = await openSignJob(row, securityState.lookupSecretKey!);
        expect(job.photo).toBe(READBACK.toString('base64'));
        expect(job.phase).toBe('checking');
    });
    const row = [...disk.rows.values()][0];
    disk.rows.set(row.id, { ...row, due: 0 });
    await runPalmSignOutbox();
    if (failure === 'scan-ack') {
        await vi.waitFor(() => expect([...disk.rows.values()][0]?.leaseUntil).toBe(0));
        expect(disk.rows.size).toBe(1);
        expect(applyBarcodeCloseChange).not.toHaveBeenCalled();
        remoteSigned = true;
        const retained = [...disk.rows.values()][0];
        disk.rows.set(retained.id, { ...retained, due: 0 });
        await runPalmSignOutbox();
        await expectQueueCompleted();
        expect(applyBarcodeCloseChange).toHaveBeenCalledOnce();
    } else await expectQueueCompleted();
    expect(scans('05')).toHaveLength(1);
    expect(zto.filter(call => call.path.endsWith('saveBillPic'))).toHaveLength(1);
});


it.each([['during-grace', false], ['after-manual', false], ['fresh-status', true]] as const)('UI → handler៖ signed មុន receipt រូបមក %s · status ថ្មីអាចអាន %s មិនផ្ញើរូបឬ05ស្ទួន', async (visibility, statusAvailable) => {
    const original = READBACK.toString('base64');
    await openAndScan(original);
    await vi.waitFor(() => expect(palmSignProof(CODE)).toMatch(/^.{8,}$/));
    const fixtureFetch = fetch;
    vi.stubGlobal('fetch', vi.fn(async (url: unknown, init?: RequestInit) => {
        const body = String(url).includes('/.netlify/functions/zto-order-detail') && init?.body ? JSON.parse(String(init.body)) : null;
        if (!statusAvailable && body?.stage === 'status') return new Response(JSON.stringify({ code: 'ZTO_PALM_STATUS_UNCONFIRMED' }), { status: 503 });
        return fixtureFetch(url as any, init);
    }));
    let now = Date.now();
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    remoteSigned = true; readback = 'none';
    setPalmSignName('សុខា');
    await submitZtoPalmSign();
    if (statusAvailable) {
        await vi.waitFor(async () => {
            expect(disk.rows.size).toBe(1);
            const retained = [...disk.rows.values()][0];
            expect(retained.leaseUntil).toBe(0);
            expect(await openSignJob(retained, securityState.lookupSecretKey!)).toMatchObject({ photo: original, signedCleanupConfirmed: true,
                phase: 'action', readOnlyProbe: true, recovery: { dismissed: true }, recoveryCheck: { signed: true, signedStatusVerified: true, photoVerified: false } });
        });
        expect(applyBarcodeCloseChange).not.toHaveBeenCalled();
        expect(scans('04')).toHaveLength(1);
        expect(scans('05')).toHaveLength(0);
        expect(zto.filter(call => call.path.endsWith('saveBillPic'))).toHaveLength(0);
        const before = zto.length;
        now += 60000;
        await runPalmSignOutbox();
        expect(zto).toHaveLength(before);
        expect(disk.rows.size).toBe(1);
        return;
    }
    const settled = async () => {
        await vi.waitFor(async () => {
            expect(disk.rows.size).toBe(1);
            const row = [...disk.rows.values()][0];
            expect(row.leaseUntil).toBe(0);
            expect(await openSignJob(row, securityState.lookupSecretKey!)).toMatchObject({ photo: original, scanCompleted: true });
        });
        const row = [...disk.rows.values()][0];
        return { row, job: await openSignJob(row, securityState.lookupSecretKey!) };
    };
    let value = await settled();
    if (visibility === 'after-manual') {
        for (let attempt = 0; attempt < 5 && value.job.phase !== 'action'; attempt++) {
            now = value.row.due;
            await runPalmSignOutbox();
            value = await settled();
        }
        expect(value.job).toMatchObject({ phase: 'action', manualReviewReason: 'photo_unverified', photoGraceChecks: 5, continuationAllowed: false });
        expect(value.job.message).toContain('ZTO បង្ហាញថា Sign រួច');
        const reads = zto.length; now += 600000; await runPalmSignOutbox();
        expect(zto).toHaveLength(reads); expect(disk.rows.size).toBe(1);
        await actOnQueuedSign(value.row.id, 'retry');
        await vi.waitFor(async () => expect((await openSignJob([...disk.rows.values()][0], securityState.lookupSecretKey!)).phase).toBe('action'));
        value = await settled();
        expect(value.job).toMatchObject({ photo: original, photoGraceChecks: 5 });
        readback = 'exact';
        await actOnQueuedSign(value.row.id, 'retry');
    } else {
        expect(value.job.phase).toBe('checking');
        readback = 'exact'; now = value.row.due; await runPalmSignOutbox();
    }
    await expectQueueCompleted();
    expect(applyBarcodeCloseChange).toHaveBeenCalledTimes(visibility === 'after-manual' ? 6 : 2);
    for (const args of vi.mocked(applyBarcodeCloseChange).mock.calls) expect(args).toEqual(['item1', CODE, true, { silent: true, showModal: false, expectedSignIdentity: expect.any(String) }]);
    expect(scans('04')).toHaveLength(1); expect(scans('05')).toHaveLength(0);
    expect(zto.filter(call => call.path.endsWith('saveBillPic'))).toHaveLength(0);
    const bodies = vi.mocked(fetch).mock.calls.filter(([url]) => String(url).includes('/.netlify/functions/zto-order-detail'))
        .map(([, init]) => JSON.parse(String(init?.body)));
    expect(bodies.filter(body => body.stage === 'receipt')).toHaveLength(0);
    expect(bodies.filter(body => body.stage === 'receipt-status' && body.photo === original)).toHaveLength(1);
});

it.each(['29', '-579'])('UI → handler៖ មកដល់ និងចែកចាយរួច ➜ សាខាសម្គាល់បញ្ហា %s ➜ បញ្ជាក់ទទួល ដោយមិនផ្ញើ04ស្ទួន', async (action) => {
    warnings = { 5: PROBLEM };
    vi.stubGlobal('fetch', vi.fn(async (url: unknown, init?: RequestInit) => {
        if (String(url).endsWith('/zto/locus/v1/queryTrackInfo')) {
            zto.push({ path: '/zto/locus/v1/queryTrackInfo', body: JSON.parse(String(init?.body)) });
            return reply([{ mail: { mailNo: CODE, isSign: 0 }, tracks: [
                { action, siteCode: SITE, mailNo: CODE, time: '2026-10-18 13:33:30', msgLoc: 'សាខាទាក់ទងអតិថិជនមិនបាន' },
                { action: '4', siteCode: SITE, mailNo: CODE, time: '2026-10-18 13:33:04', preOrNextID: '04' },
                { action: '3', siteCode: SITE, mailNo: CODE, time: '2026-10-18 13:25:26' }
            ] }]);
        }
        return route(url, init);
    }));
    await openAndScan();
    await vi.waitFor(() => expect(palmSignProof(CODE)).toMatch(/^.{8,}$/));
    expect(palmSignState.problemScans[CODE].action).toBe(action);
    expect(scans('04')).toHaveLength(0);
    setPalmSignName('សុខា');
    await submitZtoPalmSign();
    await vi.waitFor(() => expect(scans('05')).toHaveLength(1));
    await vi.waitFor(() => expect(applyBarcodeCloseChange).toHaveBeenCalledOnce());
    expect(scans('04')).toHaveLength(0);
    expect(zto.filter(call => call.path.endsWith('newBusinessCheck')).map(call => call.body.scanType)).toEqual([5, 5]);
    expect(zto.filter(call => call.path.endsWith('saveBillPic'))).toHaveLength(1);
    expect(palmSignState.confirmation).toBeNull();
});


it.each([false, true])('UI → handler៖ edge cache យឺត60វិនាទី · បញ្ហា %s · journal អានថ្មីមុនបញ្ជាក់ ដោយរូបនិង05តែម្តង', async (warning) => {
    // New blobs are immediately visible. Overwrites may retain the prior edge
    // version for 60s; conditional writes still compare authoritative ETags.
    // Only a journal read requesting strong consistency bypasses that cache.
    journalEdgeLagMs = 60000;
    warnings = warning ? { 5: PROBLEM } : {};
    await openAndScan();
    await vi.waitFor(() => expect(palmSignProof(CODE)).toMatch(/^.{8,}$/));
    setPalmSignName('សុខា');
    await submitZtoPalmSign();
    await vi.waitFor(() => expect(applyBarcodeCloseChange).toHaveBeenCalledOnce());
    expect(scans('04')).toHaveLength(1);
    expect(scans('05')).toHaveLength(1);
    expect(zto.filter(call => call.path.endsWith('saveBillPic'))).toHaveLength(1);
    expect(zto.filter(call => call.path.endsWith('newBusinessCheck') && call.body.scanType === 5)).toHaveLength(warning ? 2 : 1);
    expect(palmSignState.confirmation).toBeNull();
});
