import { barcodeSignIdentity } from '../src/domain/barcode';
import { createHash, webcrypto } from 'node:crypto';
import { capturePalmSignPhoto } from '../src/services/palm-sign-camera';
import { act } from 'react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { HistoryRow } from '../src/app/components/history/HistoryRow';
import { buildHistoryRowModel } from '../src/app/components/history/rowModel';
import { BarcodeListContainer } from '../src/app/components/barcode/BarcodeListContainer';
import { ZtoPalmSignModal } from '../src/app/components/modals/ZtoPalmSignModal';
import { dataState, firebaseState, securityState, uiState } from '../src/core/state';
import { palmSignState } from '../src/core/palm-sign-state';
import { appLocalStore } from '../src/core/storage';
import { modalIsOpen, registerModalMeta, unregisterModalMeta } from '../src/core/modals';
import { toggleCloseStatus } from '../src/features/entry-ops';
import { refreshShopBoundUi } from '../src/features/lookup-config';
import { openZtoPalmSign, cancelZtoPalmSign, dispatchPalmSignCode, submitZtoPalmSign, recheckZtoPalmSign, acceptPalmSignBarcode, setPalmSignName, confirmPalmSignWarning, cancelPalmSignConfirmation, removePalmSignScan, palmSignProof } from '../src/features/zto-palm-sign';
import { applyBarcodeCloseChange } from '../src/features/barcode-ops';
import { encryptLookupSecret } from '../src/services/crypto';
import { closeModal } from '../src/ui/modal';
import { runPalmSignOutbox, refreshPalmSignQueue, palmSignOutboxState, persistPalmSignJob } from '../src/features/palm-sign-outbox';
import { openSignJob } from '../src/services/palm-sign-outbox-store';
import { mount, unmount } from './native/react-harness';

const disk = vi.hoisted(() => ({ rows: new Map<string, any>() }));
vi.mock('../src/services/palm-sign-outbox-store', async original => ({ ...await original<any>(),
    listSignJobs: vi.fn(async owner => [...disk.rows.values()].filter(row => row.owner === owner).map(row => ({ ...row }))),
    addSignJob: vi.fn(async (row, current) => { if (!current() || disk.rows.has(row.id)) return false; disk.rows.set(row.id, { ...row }); return true; }),
    replaceSignJob: vi.fn(async (previous, next, current) => { const row = disk.rows.get(previous.id); if (!current() || !row || row.revision !== previous.revision) return false; if (next) disk.rows.set(next.id, { ...next }); else disk.rows.delete(previous.id); return true; })
}));

const stopLocation = vi.fn();
vi.mock('../src/services/palm-sign-camera', () => ({ palmSignLocation: { status: 'ready' }, subscribePalmSignLocation: vi.fn(() => () => {}), capturePalmSignPhoto: vi.fn(async () => PHOTO), palmSignFramePhoto: vi.fn(() => PHOTO), startPalmSignCamera: vi.fn(() => () => {}),
    startPalmSignLocation: vi.fn(() => stopLocation) }));

vi.mock('../src/features/barcode-ops', () => ({
    openViewListModal: () => {}, removeSingleBarcode: async () => 'failed', toggleIndividualBarcodeClose: async () => false,
    openEditBarcodePriceModal: () => {}, closeEditBarcodeModal: () => {}, saveEditedBarcodePrice: () => {},
    applyBarcodeCloseChange: vi.fn(async () => true)
}));
const CODE = '77130500000012';
const SECOND = '77130500000013';
const PHOTO = '/9j/AAECAwQF/9k=';
const REQUEST = '12345678-1234-4234-8234-123456789012';
let config: any;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
let reservationRequests = new WeakSet<object>();
const nonReservationCalls = () => vi.mocked(fetch).mock.calls.filter(([, init]) => !reservationRequests.has(init as object));
const sentReceipts = new Set<string>();
const warningReceipts = new Set<string>();
function installFetch(mock: ReturnType<typeof vi.fn>) {
    const network = mock.getMockImplementation() as (...args: any[]) => unknown;
    mock.mockImplementation(async (url, init) => {
        const body = JSON.parse(String(init?.body));
        const identity = body.barcode + '|' + body.requestId;
        if (body.stage === 'receipt-status' && body.reservationProtocol === 'original-reservation-v1'
            && (!sentReceipts.has(identity) || body.confirmationToken && warningReceipts.has(identity))) {
            reservationRequests.add(init);
            return json({ code: 'ZTO_PALM_SIGN_RESUME_READY', stage: 'receipt', barcode: body.barcode, requestId: body.requestId,
                photoProtocol: body.photoProtocol, originalSHA256: body.originalSHA256, originalFingerprint: body.originalFingerprint,
                reservationProtocol: body.reservationProtocol, reservationOwner: body.reservationOwner || 'owner-' + identity,
                reservationToken: 'reservation-' + identity }, 409);
        }
        if (body.stage === 'receipt') { sentReceipts.add(identity); warningReceipts.delete(identity); }
        const response = await network(url, init);
        if (body.stage === 'receipt' && response instanceof Response
            && (await response.clone().json().catch(() => null))?.code === 'ZTO_PALM_SIGN_CONFIRM_REQUIRED') warningReceipts.add(identity);
        return response;
    });
    vi.stubGlobal('fetch', mock);
}

const signed = (code = CODE) => {
    const sent = vi.mocked(fetch).mock.calls.map(([, init]) => { try { return JSON.parse(String(init?.body)); } catch { return {}; } }).reverse().find(body => body.barcode === code) || {};
    const requestId = sent.requestId || palmSignState.requestId;
    return json({ success: true, barcode: code, ztoClosed: true, stage: 'receipt', requestId, photoAccepted: true,
        photoProof: { protocol: 'original-sha256-v1', barcode: code, requestId, originalSHA256: createHash('sha256').update(Buffer.from(sent.photo || PHOTO, 'base64')).digest('hex'), verified: true } });
};
async function queuedJobs() { return Promise.all([...disk.rows.values()].map(row => openSignJob(row, securityState.lookupSecretKey!))); }
function settledRow(row: any, job: any) {
    const item = dataState.scanHistory.find(value => value.id === job.itemId);
    const barcode = item?.barcodes?.find(value => value.code === job.code);
    const changed = !barcode || barcodeSignIdentity(item, barcode) !== job.parcelIdentity;
    return !row.leaseUntil && (job.phase !== 'queued' || row.due > 0) || changed && job.phase === 'confirmed';
}
async function pollQueue() {
    await vi.waitFor(() => { for (const row of disk.rows.values()) expect(row.leaseUntil).toBe(0); });
    for (const row of disk.rows.values()) row.due = 0;
    await runPalmSignOutbox();
    await vi.waitFor(async () => { const rows = [...disk.rows.values()]; const jobs = await queuedJobs(); expect(jobs.every((job, i) => settledRow(rows[i], job))).toBe(true); });
    await refreshPalmSignQueue();
}
const submit = async (codes = [CODE]) => {
    const alreadyQueued = !modalIsOpen('ztoPalmSignModal') || codes.every(code => palmSignState.results.some(row => row.code === code && row.state === 'queued'));
    const generation = firebaseState.authGeneration;
    const db = firebaseState.db;
    const key = securityState.lookupSecretKey;
    const shop = appLocalStore.getItem('zoew_firebase_config');
    const cfg = appLocalStore.getItem('zoew_lookup_api_config');
    await submitZtoPalmSign(codes);
    if (alreadyQueued || !disk.rows.size) return;
    await vi.waitFor(async () => {
        if (generation !== firebaseState.authGeneration || db !== firebaseState.db || key !== securityState.lookupSecretKey || shop !== appLocalStore.getItem('zoew_firebase_config') || cfg !== appLocalStore.getItem('zoew_lookup_api_config')) return;
        const rows = [...disk.rows.values()];
        const jobs = await Promise.all(rows.map(row => openSignJob(row, key!)));
        expect(jobs.every((job, index) => settledRow(rows[index], job))).toBe(true);
    });
    await refreshPalmSignQueue();
};
const closeCalls = () => vi.mocked(applyBarcodeCloseChange).mock.calls;
async function openDispatch(codes = [CODE, SECOND]) {
    openZtoPalmSign('item1', codes.length === 1 ? codes[0] : undefined);
    await vi.waitFor(() => expect(palmSignState.checking).toBe(false));
    vi.mocked(fetch).mockClear();
}
async function openReceipt(codes: string[]) {
    await openDispatch(codes);
    palmSignState.requestId = REQUEST;
    setPalmSignName('សុខា');
    for (const code of codes) acceptPalmSignBarcode(code, PHOTO);
    await vi.waitFor(() => expect(codes.every((code) => palmSignState.dispatchResults.some((r) => r.code === code && r.proof))).toBe(true));
    expect(closeCalls()).toEqual([]);
    vi.mocked(fetch).mockClear();
}
const bodies = () => vi.mocked(fetch).mock.calls.map(([, init]) => JSON.parse(String(init?.body)));
function deferred() {
    let resolve!: (value: Response) => void;
    const promise = new Promise<Response>((yes) => { resolve = yes; });
    return { promise, resolve };
}
beforeEach(async () => {
    disk.rows.clear(); sentReceipts.clear(); warningReceipts.clear(); reservationRequests = new WeakSet<object>();
    vi.stubGlobal('indexedDB', {});
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    vi.mocked(capturePalmSignPhoto).mockReset().mockResolvedValue(PHOTO);
    vi.stubGlobal('crypto', webcrypto);
    vi.stubGlobal('confirm', vi.fn(() => false));
    appLocalStore.clear();
    appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: 'https://sign-shop.firebaseio.com' }));
    firebaseState.authGeneration++;
    firebaseState.db = {};
    firebaseState.fb = { getIdTokenResult: async () => ({ token: 'synthetic-identity' }) };
    firebaseState.auth = { currentUser: { uid: 'audit-user' } };
    securityState.appIsLocked = false; securityState.appLockVeiled = false;
    securityState.lookupSecretKey = await webcrypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']) as any;
    config = { enabled: true, url: window.location.origin + '/.netlify/functions/zto-order-detail?palm=1&barcode={barcode}',
        headerName: 'X-Zoe-Proxy-Key', headerValueEnc: await encryptLookupSecret('synthetic-proxy'), palmTokenEnc: await encryptLookupSecret('synthetic-session'), shop: 'https://sign-shop.firebaseio.com' };
    appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify(config));
    dataState.scanHistory = [{ id: 'item1', phone: '012345678', isClosed: false, barcodes: [{ code: CODE, isClosed: false }, { code: SECOND, isClosed: false }] }];
    registerModalMeta('ztoPalmSignModal', {});
    palmSignState.busy = false;
    vi.mocked(applyBarcodeCloseChange).mockReset().mockResolvedValue(true);
    act(() => refreshShopBoundUi());
    installFetch(vi.fn(async (_url, init) => { const body = JSON.parse(String(init?.body)); if (body.stage === 'status') return json({ success: true, barcode: body.barcode, stage: 'status', dispatched: false, ztoClosed: false }); return body.stage === 'dispatch'
        ? json({ success: true, barcode: body.barcode, stage: 'dispatch', ztoClosed: false, dispatchProof: 'proof-' + body.barcode }) : signed(body.barcode); }));
});
afterEach(async () => {
    firebaseState.authGeneration++; securityState.lookupSecretKey = null;
    await runPalmSignOutbox();
    act(() => closeModal('ztoPalmSignModal'));
    unmount();
    unregisterModalMeta('ztoPalmSignModal');
    vi.unstubAllGlobals();
    securityState.lookupSecretKey = null;
    vi.restoreAllMocks();
});
it('គ្មាន IndexedDB៖ មិន decrypt session ឬសរសេរ receipt ហើយរក្សារូប', async () => {
    await openReceipt([CODE]); vi.stubGlobal('indexedDB', undefined); const decrypt=vi.spyOn(webcrypto.subtle,'decrypt'); await submit(); expect(decrypt).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled();expect(palmSignState.photos[CODE]).toBe(PHOTO);expect(modalIsOpen('ztoPalmSignModal')).toBe(true);
});
it('អ្នកទទួលម្នាក់ ៤ កញ្ចប់ ក្នុងជួររក្សាទុក៖ បញ្ជាក់សារធម្មតាស្វ័យប្រវត្តិដោយ token និងរូបដាច់តាមកញ្ចប់', async () => {
    const codes = Array.from({ length: 4 }, (_, index) => String(77130500000012 + index));
    const photos = codes.map((_, index) => Buffer.from([255, 216, 255, index, 1, 2, 3, 255, 217]).toString('base64'));
    dataState.scanHistory[0].barcodes = codes.map((code) => ({ code, isClosed: false }));
    await openReceipt(codes);
    palmSignState.photos = Object.fromEntries(codes.map((code, index) => [code, photos[index]]));
    installFetch(vi.fn(async (_url, init) => {
        const body = JSON.parse(String(init?.body));
        return body.confirmationToken ? signed(body.barcode) : warning(body.barcode);
    }));
    await Promise.all([submit(codes), submit(codes)]);
    expect(closeCalls().map((call) => call[1]).sort()).toEqual(codes);
    expect(palmSignState.confirmation).toBeNull();
    expect(modalIsOpen('ztoPalmSignModal')).toBe(false);
    expect(bodies().filter(body => body.stage === 'receipt-status')).toHaveLength(4);
    expect(bodies()).toHaveLength(12);
    for (const [index, code] of codes.entries()) {
        expect(bodies().filter((body) => body.barcode === code && body.stage === 'receipt')).toEqual([
            expect.objectContaining({ stage: 'receipt', barcode: code, photo: photos[index], signMan: 'សុខា', requestId: REQUEST, dispatchProof: 'proof-' + code }),
            expect.objectContaining({ stage: 'receipt', barcode: code, photo: photos[index], signMan: 'សុខា', requestId: REQUEST, dispatchProof: 'proof-' + code, confirmationToken: 'proof-' + code })
        ]);
    }
});
it('ស្កេន ៤ កញ្ចប់ បញ្ជាក់បញ្ហាចែកចាយស្វ័យប្រវត្តិ ដោយមិនផ្អាកស្កេន ឬផ្ញើរូបទៅ 04', async () => {
    const codes = Array.from({ length: 4 }, (_, index) => String(77130500000012 + index));
    dataState.scanHistory[0].barcodes = codes.map((code) => ({ code, isClosed: false }));
    await openDispatch(codes);
    installFetch(vi.fn(async (_url, init) => {
        const body = JSON.parse(String(init?.body));
        return body.confirmationToken
            ? json({ success: true, barcode: body.barcode, stage: 'dispatch', ztoClosed: false, dispatchProof: 'proof-' + body.barcode })
            : json({ code: 'ZTO_PALM_SIGN_CONFIRM_REQUIRED', barcode: body.barcode, stage: 'dispatch', message: 'កញ្ចប់មានបញ្ហា', confirmationToken: 'dispatch-' + body.barcode }, 409);
    }));
    codes.forEach((code) => acceptPalmSignBarcode(code, PHOTO));
    await vi.waitFor(() => expect(codes.every((code) => !!palmSignProof(code))).toBe(true));
    expect(palmSignState.confirmation).toBeNull();
    expect(palmSignState.selectedCodes).toEqual(codes);
    expect(bodies()).toHaveLength(8);
    expect(bodies().every((body) => body.stage === 'dispatch' && body.photo === undefined && body.signMan === '')).toBe(true);
    for (const code of codes) expect(bodies().filter((body) => body.barcode === code && body.stage === 'dispatch').map((body) => body.confirmationToken)).toEqual([undefined, 'dispatch-' + code]);
    expect(closeCalls()).toEqual([]);
});
it('ពិនិត្យស្ថានភាព ZTO អាន status ព្រមគ្នាមិនលើស ៤ ហើយមិនផ្ញើ Sign', async () => {
    const codes = Array.from({ length: 7 }, (_, i) => String(77130500000012 + i));
    dataState.scanHistory[0].barcodes = codes.map((code) => ({ code, isClosed: false }));
    const gates = codes.map(() => deferred());
    let active = 0;
    let peak = 0;
    installFetch(vi.fn(async (_url, init) => {
        const body = JSON.parse(String(init?.body));
        expect(body.stage).toBe('status');
        active++;
        peak = Math.max(peak, active);
        try { return await gates[codes.indexOf(body.barcode)].promise; } finally { active--; }
    }));
    openZtoPalmSign('item1');
    try {
        await vi.waitFor(() => expect(nonReservationCalls()).toHaveLength(4), { timeout: 500 });
        for (let i = 3; i >= 0; i--) gates[i].resolve(json({ success: true, barcode: codes[i], stage: 'status', dispatched: false, ztoClosed: false }));
        await vi.waitFor(() => expect(nonReservationCalls()).toHaveLength(7));
    } finally {
        gates.forEach((gate, i) => gate.resolve(json({ success: true, barcode: codes[i], stage: 'status', dispatched: false, ztoClosed: false })));
        await vi.waitFor(() => expect(palmSignState.checking).toBe(false));
    }
    expect(peak).toBe(4);
    expect(codes.every((code) => palmSignState.checked[code])).toBe(true);
    expect(bodies().every((body) => body.stage === 'status')).toBe(true);
    expect(closeCalls()).toEqual([]);
});
it('🔄 ពិនិត្យ ZTO ៖ គ្មានសំណើ receipt-status · Sign រួចគ្មានរូប ➜ រក្សាទុកក្នុង ZoeW · រូបដើមមិនបានផ្ទៀង ➜ រក្សារូប', async () => {
    await openDispatch([CODE, SECOND]);
    palmSignState.photos = { [SECOND]: PHOTO };
    palmSignState.results = [{ code: CODE, state: 'signed', saved: false, message: '' }, { code: SECOND, state: 'unknown', message: '' }];
    installFetch(vi.fn(async (_url, init) => {
        const body = JSON.parse(String(init?.body));
        return json({ success: true, barcode: body.barcode, stage: 'status', dispatched: true, ztoClosed: true });
    }));
    await recheckZtoPalmSign();
    expect(bodies().filter((body) => String(body.stage).startsWith('receipt'))).toEqual([]);
    expect(closeCalls().map((row) => row[1])).toEqual([CODE]);
    expect(palmSignState.results.find((row) => row.code === CODE)).toMatchObject({ state: 'signed', saved: true });
    expect(palmSignState.results.find((row) => row.code === SECOND)).toMatchObject({ state: 'unknown' });
    expect(palmSignState.photos[SECOND]).toBe(PHOTO);
    expect(palmSignState.message).toContain('បានពិនិត្យ ZTO');
});
it('ការងារ durable ផ្ញើ session និង ID token តាម reservation និង receipt', async () => {
    await openReceipt([CODE]);
    const identity = vi.fn(async () => ({ token: 'synthetic-identity' }));
    firebaseState.fb = { getIdTokenResult: identity } as any;
    await submit();
    expect(nonReservationCalls()).toHaveLength(1);
    expect(identity).toHaveBeenCalledTimes(2);
    expect(bodies().map(value => value.stage)).toEqual(['receipt-status', 'receipt']);
    expect(nonReservationCalls()[0][1]?.headers).toMatchObject({ 'X-Zoe-Palm-Token': 'synthetic-session', 'X-Zoe-Id-Token': 'synthetic-identity' });
    expect(await queuedJobs()).toEqual([expect.objectContaining({ signedCleanupConfirmed: true, photo: PHOTO })]);
});
it('Palm បង្ហាញ Sign លើប្រវត្តិ និង Barcode · Cookie ត្រឡប់ជា បិទ', async () => {
    uiState.viewListView = [{ itemId: 'item1', code: CODE, index: 1, locker: '', time: null, origin: '', moneyClass: '', money: [], sum: null, closed: false }];
    mount(<><table><tbody><tr><HistoryRow row={buildHistoryRowModel(dataState.scanHistory[0], 1, false, false)} /></tr></tbody></table><BarcodeListContainer /></>);
    expect(document.querySelector('.close-btn')?.textContent).toContain('Sign');
    expect(document.querySelector('.btn-toggle-bc-close')?.textContent).toContain('Sign');
    act(() => { (document.querySelector('.close-btn') as HTMLButtonElement).click(); });
    expect(modalIsOpen('ztoPalmSignModal')).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(palmSignState.codes).toEqual([CODE, SECOND]);
    act(() => {
        appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ ...config, url: config.url.replace('palm=1&', '') }));
        refreshShopBoundUi();
    });
    expect(document.querySelector('.close-btn')?.textContent).toContain('បិទ');
    expect(document.querySelector('.btn-toggle-bc-close')?.textContent).toContain('បិទ');
    expect(modalIsOpen('ztoPalmSignModal')).toBe(false);
    await toggleCloseStatus('item1');
    expect(confirm).toHaveBeenCalledOnce();
});
it('មិនបិទមុន ZTO ឆ្លើយ · ចុចពីរដងផ្ញើតែមួយ', async () => {
    await openReceipt([CODE]);
    const gate = deferred();
    installFetch(vi.fn(() => gate.promise));
    const work = submit();
    await vi.waitFor(() => expect(nonReservationCalls()).toHaveLength(1));
    expect(closeCalls()).toEqual([]);
    await submit();
    expect(nonReservationCalls()).toHaveLength(1);
    expect(bodies().map(body => body.stage)).toEqual(['receipt-status', 'receipt']);
    gate.resolve(signed());
    await work;
    expect(closeCalls()).toEqual([['item1', CODE, true, { silent: true, showModal: false, expectedSignIdentity: barcodeSignIdentity(dataState.scanHistory[0], dataState.scanHistory[0].barcodes[0]) }]]);
    const [url, init] = nonReservationCalls()[0];
    expect(String(url)).toContain('?palm=sign');
    expect(JSON.parse(String(init?.body))).toMatchObject({ barcode: CODE, signMan: 'សុខា', photo: PHOTO, requestId: REQUEST });
    expect(init?.headers).toMatchObject({ 'X-Zoe-Palm-Token': 'synthetic-session' });
});
it('កញ្ចប់មួយជោគជ័យ មួយបរាជ័យ ➜ បិទតែមួយ · សាកតែកញ្ចប់បរាជ័យ', async () => {
    await openReceipt([CODE, SECOND]);
    installFetch(vi.fn(async (_url, init) => JSON.parse(String(init?.body)).barcode === CODE ? signed(CODE) : json({ code: 'ZTO_PALM_SIGN_REJECTED' }, 409)));
    await submit([CODE, SECOND]);
    expect(closeCalls().map(c => c[1])).toEqual([CODE]);
    expect((await queuedJobs()).filter(job => !job.signedCleanupConfirmed)).toEqual([expect.objectContaining({ code: SECOND, phase: 'action', photo: PHOTO })]);
    expect((await queuedJobs()).filter(job => job.signedCleanupConfirmed)).toHaveLength(1);
    await submit([CODE, SECOND]);
    expect(nonReservationCalls()).toHaveLength(2);
    expect(closeCalls()).toHaveLength(1);
});
it.each(['throw', 'wrong-barcode', 'invalid-json'])('ចម្លើយមិនច្បាស់ %s ➜ មិនបិទ ឬផ្ញើឡើងវិញ · ពិនិត្យ ZTO បញ្ជាក់មុនបិទ', async (kind) => {
    await openReceipt([CODE]);
    installFetch(vi.fn(async () => { if (kind === 'throw')
        throw Error('offline'); if (kind === 'invalid-json')
        return new Response('bad'); return signed(SECOND); }));
    await submit();
    expect(closeCalls()).toEqual([]);
    expect(await queuedJobs()).toEqual([expect.objectContaining({ phase: 'checking', photo: PHOTO })]);
    expect(nonReservationCalls()).toHaveLength(1);
    await submit();
    expect(nonReservationCalls()).toHaveLength(1);
    installFetch(vi.fn(async () => signed()));
    await pollQueue();
    expect(bodies()[0]).toMatchObject({ stage: 'receipt-status', barcode: CODE, requestId: REQUEST, photoProtocol: 'original-sha256-v1' });
    expect(bodies()[0].photo).toBeUndefined();
    expect(closeCalls().map(c => c[1])).toEqual([CODE]);
    expect(await queuedJobs()).toEqual([expect.objectContaining({ signedCleanupConfirmed: true, photo: PHOTO })]);
});
it.each(['auth', 'shop', 'database', 'config', 'close'])('ប្តូរ %s ខណៈកំពុងផ្ញើ៖ ម្ចាស់ប្តូរឈប់បិទ តែបិទ modal មិនបញ្ឈប់ការងាររក្សាទុក', async (kind) => {
    await openReceipt([CODE, SECOND]);
    const gate = deferred();
    let secondConsumed!: () => void;
    const secondBody = new Promise<void>(resolve => { secondConsumed = resolve; });
    installFetch(vi.fn(async (_url, init) => {
        const response = (await gate.promise).clone();
        if (kind === 'close') {
            if (JSON.parse(String(init?.body)).barcode === CODE) await secondBody;
            else {
                const read = response.json.bind(response);
                response.json = async () => { try { return await read(); } finally { secondConsumed(); } };
            }
        }
        return response;
    }));
    const work = submit([CODE, SECOND]);
    await vi.waitFor(() => expect(nonReservationCalls()).toHaveLength(2));
    if (kind === 'auth') firebaseState.authGeneration++;
    if (kind === 'shop') appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: 'https://other.firebaseio.com' }));
    if (kind === 'database') firebaseState.db = {};
    if (kind === 'config') appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ ...config, enabled: false }));
    if (kind === 'close') closeModal('ztoPalmSignModal');
    gate.resolve(signed());
    await work;
    if (kind === 'close') await vi.waitFor(() => expect(closeCalls().map(row => row[1])).toEqual([CODE]));
    else expect(closeCalls()).toEqual([]);
    expect(nonReservationCalls()).toHaveLength(2);
    expect(palmSignState.busy).toBe(false);
});
it('ZTO Sign រួចតែ ZoeW រក្សាទុកមិនទាន់បាន ➜ សាកការបិទ ZoeW ដោយមិន Sign ស្ទួន', async () => {
    await openReceipt([CODE]);
    vi.mocked(applyBarcodeCloseChange).mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    await submit();
    expect(await queuedJobs()).toEqual([expect.objectContaining({ phase: 'confirmed', photoVerified: true, photo: PHOTO })]);
    expect(modalIsOpen('ztoPalmSignModal')).toBe(false);
    await pollQueue();
    expect(nonReservationCalls()).toHaveLength(1);
    expect(closeCalls()).toHaveLength(2);
    expect(await queuedJobs()).toEqual([expect.objectContaining({ signedCleanupConfirmed: true, photo: PHOTO })]);
});
it('ប្រអប់ត្រូវការស្កេន និងរូប មុន Sign', () => {
    mount(<ZtoPalmSignModal />);
    act(() => openZtoPalmSign('item1', CODE));
    expect((document.querySelector('.palm-sign-submit') as HTMLButtonElement).disabled).toBe(true);
    expect(document.querySelector('input[type=file]')?.getAttribute('capture')).toBe('environment');
});
it('ម៉ាស៊ីនស្កេន Enter/Tab ក្នុងផ្ទាំង Sign ជ្រើសកញ្ចប់ ដោយមិនផ្ញើទៅជួរបញ្ចូល', async () => {
    const { noteScannerKeyDown } = await import('../src/app/behaviors/scanner-input');
    await openDispatch();
    palmSignState.selectedCodes = [];
    let stamp = 10000;
    for (const suffix of ['Enter', 'Tab']) {
        for (const key of [...CODE, suffix]) {
            const event = new KeyboardEvent('keydown', { key, code: /^[0-9]$/.test(key) ? 'Digit' + key : key, cancelable: true });
            Object.defineProperty(event, 'timeStamp', { value: stamp += 8 });
            noteScannerKeyDown(event);
        }
    }
    await vi.waitFor(() => expect(palmSignState.selectedCodes).toEqual([CODE]));
    expect(palmSignState.message).toContain(CODE);
    await vi.waitFor(() => expect(palmSignState.dispatching).toEqual({}));
    expect(bodies().map((body) => [body.stage, body.barcode])).toEqual([['dispatch', CODE]]);
});

it('⚡ ស្កេនម្តង ➜ ចែកចាយ 04 ស្វ័យប្រវត្តិ (មិនបិទ) ➜ វាយឈ្មោះ ➜ Sign 05 ទើបបិទ', async () => {
    await openDispatch([CODE]);
    await submit();
    expect(fetch).not.toHaveBeenCalled();
    acceptPalmSignBarcode(CODE, PHOTO);
    await vi.waitFor(() => expect(palmSignState.dispatchResults[0]).toMatchObject({ state: 'dispatched', proof: 'proof-' + CODE }));
    expect(closeCalls()).toEqual([]);
    await submit();
    expect(palmSignState.message).toContain('ឈ្មោះ');
    expect(nonReservationCalls()).toHaveLength(1);
    setPalmSignName('សុខា');
    await submit();
    expect(closeCalls()).toHaveLength(1);
    expect(bodies().map((body) => body.stage)).toEqual(['dispatch', 'receipt-status', 'receipt']);
    expect(bodies()[2].dispatchProof).toBe('proof-' + CODE);
});
it('ស្កេនខណៈកំពុងពិនិត្យស្ថានភាព ZTO ➜ ចែកចាយក្រោយពិនិត្យរួច (មិនផ្ញើ 04 មុនដឹងស្ថានភាព)', async () => {
    const gate = deferred();
    installFetch(vi.fn(async (_url, init) => {
        const body = JSON.parse(String(init?.body));
        if (body.stage === 'status') { await gate.promise; return json({ success: true, barcode: body.barcode, stage: 'status', dispatched: false, ztoClosed: false }); }
        return json({ success: true, barcode: body.barcode, stage: 'dispatch', ztoClosed: false, dispatchProof: 'late-proof' });
    }));
    openZtoPalmSign('item1', CODE);
    acceptPalmSignBarcode(CODE, PHOTO);
    await vi.waitFor(() => expect(bodies().map((body) => body.stage)).toEqual(['status']));
    await new Promise((done) => setTimeout(done, 20));
    expect(bodies().map((body) => body.stage)).toEqual(['status']);
    gate.resolve(json({}));
    await vi.waitFor(() => expect(palmSignState.dispatchResults[0]?.proof).toBe('late-proof'));
    expect(bodies().map((body) => body.stage)).toEqual(['status', 'dispatch']);
});
it.each(['rejected', 'unknown'])('ចែកចាយ %s ➜ មិន Sign និងមិនបិទ', async (kind) => {
    await openDispatch([CODE]);
    installFetch(vi.fn(async () => kind === 'unknown' ? json({ uncertain: true }, 504) : json({ code: 'ZTO_PALM_SIGN_REJECTED' }, 409)));
    setPalmSignName('សុខា');
    acceptPalmSignBarcode(CODE, PHOTO);
    await vi.waitFor(() => expect(palmSignState.dispatchResults[0]?.state).toBe(kind === 'unknown' ? 'unknown' : 'failed'));
    await submit();
    expect(nonReservationCalls()).toHaveLength(1);
    expect(closeCalls()).toEqual([]);
    expect(palmSignState.checked[CODE]).toBe(kind !== 'unknown');
});
it('camera ស្កេនបាន ➜ ចាប់រូប · សម្លេង និងញ័រ · ចែកចាយភ្លាម · ប៊ូតុង Sign ប្រាប់ឲ្យវាយឈ្មោះ', async () => {
    const { startPalmSignCamera, startPalmSignLocation } = await import('../src/services/palm-sign-camera');
    vi.mocked(startPalmSignLocation).mockClear();
    stopLocation.mockClear();
    const vibrate = vi.fn(() => true);
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
    mount(<ZtoPalmSignModal />);
    await act(async () => { await openDispatch([CODE]); });
    expect(startPalmSignLocation).toHaveBeenCalledOnce();
    expect(stopLocation).not.toHaveBeenCalled();
    const callback = vi.mocked(startPalmSignCamera).mock.calls.at(-1)![0];
    await act(async () => callback(CODE, PHOTO));
    expect(palmSignState.photos[CODE]).toBe(PHOTO);
    expect(vibrate).toHaveBeenCalledOnce();
    expect(document.querySelector('.palm-sign-thumbnail')?.getAttribute('src')).toBe('data:image/jpeg;base64,' + PHOTO);
    await act(async () => { await vi.waitFor(() => expect(palmSignState.dispatchResults[0]?.proof).toBe('proof-' + CODE)); });
    const button = document.querySelector('.palm-sign-submit') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain('ឈ្មោះ');
    await act(async () => setPalmSignName('សុខា'));
    expect(button.disabled).toBe(false);
    expect(button.textContent).toContain('Sign (1)');
    delete (navigator as any).vibrate;
});
it('✕ ដករូបកញ្ចប់ ➜ មិន Sign កញ្ចប់នោះ', async () => {
    await openReceipt([CODE, SECOND]);
    removePalmSignScan(SECOND);
    await submit();
    expect(bodies().map((body) => body.barcode)).toEqual([CODE, CODE]);
    expect(modalIsOpen('ztoPalmSignModal')).toBe(true);
});
it('ចែកចាយរួចក្នុង ZTO ➜ មិនផ្ញើ 04 ម្តងទៀត · Sign ប្រើភស្តុតាងដែលមាន', async () => {
    installFetch(vi.fn(async (_url, init) => {
        const body = JSON.parse(String(init?.body));
        return json({ success: true, stage: 'status', barcode: body.barcode, dispatched: true, dispatchProof: 'known-' + body.barcode, ztoClosed: false });
    }));
    await openDispatch([CODE]);
    acceptPalmSignBarcode(CODE, PHOTO);
    setPalmSignName('សុខា');
    expect(fetch).not.toHaveBeenCalled();
    installFetch(vi.fn(async () => signed()));
    await submit();
    expect(JSON.parse(String(nonReservationCalls()[0][1]?.body))).toMatchObject({ stage: 'receipt', signMan: 'សុខា', dispatchProof: 'known-' + CODE });
    expect(closeCalls()).toHaveLength(1);
});
it('កញ្ចប់ចែកចាយរួចខ្លះ ➜ ផ្ញើ 04 តែកញ្ចប់ដែលនៅសល់', async () => {
    installFetch(vi.fn(async (_url, init) => {
        const body = JSON.parse(String(init?.body));
        return body.stage === 'status' ? json({ success: true, stage: 'status', barcode: body.barcode, dispatched: body.barcode === CODE, dispatchProof: body.barcode === CODE ? 'known' : undefined, ztoClosed: false })
            : json({ success: true, stage: 'dispatch', barcode: body.barcode, dispatchProof: 'new', ztoClosed: false });
    }));
    await openDispatch();
    acceptPalmSignBarcode(CODE, PHOTO);
    acceptPalmSignBarcode(SECOND, PHOTO);
    await vi.waitFor(() => expect(palmSignState.dispatchResults.length).toBe(2));
    expect(bodies().map((body) => body.barcode)).toEqual([SECOND]);
});
it('tracking បរាជ័យ ➜ មិនសន្មតចែកចាយ ឬផ្ញើ scan', async () => {
    installFetch(vi.fn(async () => json({ code: 'ZTO_PALM_STATUS_UNCONFIRMED' }, 409)));
    await openDispatch([CODE]);
    setPalmSignName('សុខា');
    acceptPalmSignBarcode(CODE, PHOTO);
    await submit();
    expect(palmSignState.checked[CODE]).not.toBe(true);
    expect(fetch).not.toHaveBeenCalled();
    expect(closeCalls()).toEqual([]);
});
it('status ចម្លើយពីហាងចាស់មិនអាចរំលងជំហាន ឬបិទកញ្ចប់', async () => {
    const gate = deferred();
    installFetch(vi.fn(() => gate.promise));
    openZtoPalmSign('item1', CODE);
    await vi.waitFor(() => expect(nonReservationCalls()).toHaveLength(1));
    firebaseState.authGeneration++;
    gate.resolve(json({ success: true, stage: 'status', barcode: CODE, dispatched: true, dispatchProof: 'old', ztoClosed: true }));
    await vi.waitFor(() => expect(palmSignState.checking).toBe(false));
    expect(palmSignState.dispatchResults).toEqual([]);
    expect(closeCalls()).toEqual([]);
});
it('⛔ ការផ្ញើមុននៅរង់ចាំ ZTO (បិទផ្ទាំងហើយ) ➜ ចុច «✍️ Sign» ម្តងទៀតប្រាប់ឲ្យរង់ចាំ (មិនស្ងាត់) · ចម្លើយមកដល់ ➜ បើកបាន', async () => {
    await openReceipt([CODE]);
    const gate = deferred();
    installFetch(vi.fn(() => gate.promise));
    const sending = submit();
    try {
        await vi.waitFor(() => expect(nonReservationCalls()).toHaveLength(1));
        expect(modalIsOpen('ztoPalmSignModal')).toBe(false);
        expect((await queuedJobs())[0]).toMatchObject({ photo: PHOTO, requestId: REQUEST });
        await submit();
        expect(nonReservationCalls()).toHaveLength(1);
    }
    finally {
        gate.resolve(signed());
        await sending;
    }
    expect(closeCalls()).toHaveLength(1);
    expect(await queuedJobs()).toEqual([expect.objectContaining({ signedCleanupConfirmed: true, photo: PHOTO })]);
});
it('shared mode គ្មាន palmTokenEnc ក៏អាចបើក Sign និងផ្ញើ header សាខា', async () => {
    appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ ...config, palmTokenEnc: undefined, palmShared: true, palmAccount: { siteCode: 'KH001' } }));
    act(() => refreshShopBoundUi());
    openZtoPalmSign('item1', CODE);
    await vi.waitFor(() => expect(palmSignState.checking).toBe(false));
    expect(modalIsOpen('ztoPalmSignModal')).toBe(true);
    expect(nonReservationCalls()[0][1]?.headers).toMatchObject({ 'X-Zoe-Palm-Site': 'KH001' });
});
it('កញ្ចប់មានបញ្ហា៖ បញ្ជាក់សារធម្មតាស្វ័យប្រវត្តិ ហើយបិទក្រោយ ZTO យល់ព្រម', async () => {
    await openReceipt([CODE]);
    const message = 'សូមបញ្ជាក់ថាបានដោះស្រាយបញ្ហាហើយឬនៅ';
    installFetch(vi.fn(async (_url, init) => JSON.parse(String(init?.body)).confirmationToken
        ? signed() : json({ code: 'ZTO_PALM_SIGN_CONFIRM_REQUIRED', barcode: CODE, stage: 'receipt', message, confirmationToken: 'confirmation-proof' }, 409)));
    mount(<ZtoPalmSignModal />);
    await act(async () => { await submit(); });
    expect(closeCalls()).toHaveLength(1);
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    expect(nonReservationCalls()).toHaveLength(2);
    expect(JSON.parse(String(nonReservationCalls()[1][1]?.body)).confirmationToken).toBe('confirmation-proof');
});

const warning = (code = CODE, message = 'សូមបញ្ជាក់ថាបានដោះស្រាយបញ្ហាហើយឬនៅ') => json({ code: 'ZTO_PALM_SIGN_CONFIRM_REQUIRED', barcode: code, stage: 'receipt', message, confirmationToken: 'proof-' + code }, 409);
it('សារស្ទួនក្រោយសាកស្វ័យប្រវត្តិម្តង៖ បោះបង់រក្សាសម្គាល់ ហើយមិនផ្ញើបន្ថែមឬបិទ', async () => {
    await openReceipt([CODE]);
    installFetch(vi.fn(async () => warning()));
    await submit();
    expect((await queuedJobs())[0]).toMatchObject({ phase: 'action', photo: PHOTO, signMan: 'សុខា', warningToken: 'proof-' + CODE });
    expect(palmSignOutboxState.rows[0].warning).toContain('សូមបញ្ជាក់');
    await submit();
    expect(nonReservationCalls()).toHaveLength(2);
    await runPalmSignOutbox();
    expect(nonReservationCalls()).toHaveLength(2);
    expect(closeCalls()).toEqual([]);
});
it('បញ្ជាក់ស្វ័យប្រវត្តិប្រើ token របស់កញ្ចប់នីមួយៗ ហើយចុច Sign ស្ទួនមិនផ្ញើពីរដង', async () => {
    await openReceipt([CODE, SECOND]);
    installFetch(vi.fn(async (_url, init) => {
        const body = JSON.parse(String(init?.body));
        return body.confirmationToken ? signed(body.barcode) : warning(body.barcode);
    }));
    await Promise.all([submit([CODE, SECOND]), submit([CODE, SECOND])]);
    expect(closeCalls().map((c) => c[1]).sort()).toEqual([CODE, SECOND].sort());
    expect(palmSignState.confirmation).toBeNull();
    const tokens = (code: string) => bodies().filter((body) => body.barcode === code && body.stage === 'receipt').map((body) => body.confirmationToken);
    expect(tokens(CODE)).toEqual([undefined, 'proof-' + CODE]);
    expect(tokens(SECOND)).toEqual([undefined, 'proof-' + SECOND]);
});
it.each(['close', 'shop', 'auth', 'config'])('ការបញ្ជាក់ចាស់ក្រោយ %s មិនបិទឬផ្ញើ', async (kind) => {
    await openReceipt([CODE]);
    installFetch(vi.fn(async () => warning()));
    await submit();
    if (kind === 'close') closeModal('ztoPalmSignModal');
    if (kind === 'shop') appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: 'https://other.firebaseio.com' }));
    if (kind === 'auth') firebaseState.authGeneration++;
    if (kind === 'config') appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ ...config, headerValueEnc: await encryptLookupSecret('changed') }));
    await confirmPalmSignWarning();
    expect(nonReservationCalls()).toHaveLength(2);
    expect(closeCalls()).toEqual([]);
});
it.each(['close', 'shop', 'auth', 'config'])('សារបញ្ជាក់មកក្រោយ %s៖ ការងាររក្សាទុកបន្តតែក្នុងម្ចាស់ដើម', async (kind) => {
    await openReceipt([CODE]);
    const pending = deferred();
    installFetch(vi.fn(() => pending.promise));
    const running = submit();
    await vi.waitFor(() => expect(nonReservationCalls()).toHaveLength(1));
    if (kind === 'close') closeModal('ztoPalmSignModal');
    if (kind === 'shop') appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: 'https://other.firebaseio.com' }));
    if (kind === 'auth') firebaseState.authGeneration++;
    if (kind === 'config') appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ ...config, headerValueEnc: await encryptLookupSecret('changed') }));
    pending.resolve(warning());
    await running;
    expect(nonReservationCalls()).toHaveLength(kind === 'close' ? 2 : 1);
    expect(closeCalls()).toEqual([]);
});
it.each(['dispatch', 'receipt'])('បញ្ហា %s មកក្រោយកញ្ចប់ត្រូវបានស្តារឡើងវិញ មិនបញ្ជាក់ស្វ័យប្រវត្តិដោយរូបចាស់', async (stage) => {
    if (stage === 'receipt') await openReceipt([CODE]);
    else await openDispatch([CODE]);
    const pending = deferred();
    installFetch(vi.fn(() => pending.promise));
    const running = stage === 'receipt' ? submit() : Promise.resolve(acceptPalmSignBarcode(CODE, PHOTO));
    await vi.waitFor(() => expect(nonReservationCalls()).toHaveLength(1));
    dataState.scanHistory[0].barcodes = dataState.scanHistory[0].barcodes.map((barcode) => barcode.code === CODE
        ? { ...barcode, restoredAt: Date.now() } : barcode);
    pending.resolve(json({ code: 'ZTO_PALM_SIGN_CONFIRM_REQUIRED', barcode: CODE, stage, message: 'កញ្ចប់មានបញ្ហា', confirmationToken: 'old-parcel-token' }, 409));
    await running;
    await vi.waitFor(() => expect(palmSignState.dispatching).toEqual({}));
    expect(nonReservationCalls()).toHaveLength(1);
    expect(closeCalls()).toEqual([]);
    expect(palmSignState.confirmation).toBeNull();
});
it('សារ ZTO ផ្លាស់ ត្រូវបង្ហាញបញ្ជាក់ថ្មី មិនបិទដោយស្វ័យប្រវត្តិ', async () => {
    await openReceipt([CODE]);
    let n = 0;
    installFetch(vi.fn(async () => warning(CODE, ++n === 1 ? 'សារដំបូង' : 'សារថ្មី')));
    await submit();
    expect((await queuedJobs())[0]).toMatchObject({ phase: 'action', message: 'សារថ្មី', photo: PHOTO });
    expect(nonReservationCalls()).toHaveLength(2);
    await runPalmSignOutbox();
    expect(nonReservationCalls()).toHaveLength(2);
    expect(closeCalls()).toEqual([]);
});
it('ZTO ហាម៖ បង្ហាញមូលហេតុពិត ហើយគ្មានប៊ូតុងបញ្ជាក់ឆ្លង', async () => {
    await openReceipt([CODE]);
    installFetch(vi.fn(async () => json({ code: 'ZTO_PALM_SIGN_CHECK_REJECTED', barcode: CODE, message: 'ZTO hard rejection' }, 409)));
    await submit();
    expect((await queuedJobs())[0]).toMatchObject({ phase: 'action', message: 'ZTO hard rejection', warningToken: '', photo: PHOTO });
    expect(palmSignOutboxState.rows[0].warning).toBe('');
    expect(closeCalls()).toEqual([]);
    expect(nonReservationCalls()).toHaveLength(1);
});
it('បើក Sign ស្គាល់ស្កេនបញ្ហាតាមស្ថានភាព ZTO ហើយមិនអនុម័តស្វ័យប្រវត្តិ', async () => {
    installFetch(vi.fn(async () => json({ success: true, barcode: CODE, stage: 'status', ztoClosed: false, dispatched: true, dispatchProof: 'proof',
        problemScan: { action: '-579', message: 'ទាក់ទងអតិថិជនមិនបាន', time: '2026-10-17 10:00:00' } })));
    mount(<ZtoPalmSignModal />);
    await act(async () => { await openDispatch([CODE]); });
    expect(document.querySelector('.palm-sign-note')?.textContent).toContain('ទាក់ទងអតិថិជនមិនបាន');
    expect(document.querySelector('.palm-sign-note')?.hasAttribute('open')).toBe(false);
    expect(palmSignState.confirmation).toBeNull();
    expect(closeCalls()).toEqual([]);
});
it('រូបជ្រើសដោយដៃអាចជំនួសរូប auto capture តែ scanner មិនជំនួសរូបដដែល', async () => {
    await openReceipt([CODE]);
    acceptPalmSignBarcode(CODE, 'new-photo');
    expect(palmSignState.photos[CODE]).toBe(PHOTO);
    acceptPalmSignBarcode(CODE, 'gallery-photo', true);
    expect(palmSignState.photos[CODE]).toBe('gallery-photo');
});

it('Gallery បើក picker រូបដោយគ្មាន capture ហើយផ្អាកពេលសួរបញ្ជាក់', async () => {
    await openReceipt([CODE]);
    mount(<ZtoPalmSignModal />);
    const input = document.querySelector('#palmSignGalleryInput') as HTMLInputElement;
    expect(input.accept).toBe('image/*');
    expect(input.hasAttribute('capture')).toBe(false);
    const click = vi.spyOn(input, 'click').mockImplementation(() => {});
    const button = [...document.querySelectorAll('button')].find((el) => el.textContent?.includes('ជ្រើសរូបពី Gallery'))!;
    act(() => button.click());
    expect(click).toHaveBeenCalledOnce();
    installFetch(vi.fn(async () => warning()));
    await act(async () => { await submit(); });
    expect(input.disabled).toBe(true);
    act(() => button.click());
    expect(click).toHaveBeenCalledOnce();
});
it.each([2, 3])('លេខទូរស័ព្ទមួយមាន %s កញ្ចប់៖ Sign គ្រប់រួចបិទ modal ស្វ័យប្រវត្តិ', async (count) => {
    const codes = [CODE, SECOND, '77130500000014'].slice(0, count);
    dataState.scanHistory[0].barcodes = codes.map((code) => ({ code, isClosed: false }));
    await openReceipt(codes);
    expect(palmSignState.codes).toEqual(codes);
    await submit(codes);
    expect(closeCalls().map((row) => row[1]).sort()).toEqual([...codes].sort());
    expect(modalIsOpen('ztoPalmSignModal')).toBe(false);
    expect(palmSignState.photos).toEqual({});
});

it('លេខមួយ ៣ កញ្ចប់៖ បិទ modal ក្រោយរក្សាទុក ហើយរក្សារូបកញ្ចប់មិនទាន់បញ្ជាក់', async () => {
    const third = '77130500000014';
    const codes = [CODE, SECOND, third];
    dataState.scanHistory[0].barcodes = codes.map((code) => ({ code, isClosed: false }));
    await openReceipt(codes);
    installFetch(vi.fn(async (_url, init) => {
        if (JSON.parse(String(init?.body)).stage === 'receipt-status') return signed(third);
        const body = JSON.parse(String(init.body));
        if (body.barcode === SECOND && !body.confirmationToken) return warning(SECOND);
        return body.barcode === third ? json({ code: 'ZTO_PALM_SIGN_UNCONFIRMED', uncertain: true }, 504) : signed(body.barcode);
    }));
    await submit(codes);
    expect(closeCalls().map((row) => row[1]).sort()).toEqual([CODE, SECOND].sort());
    expect(modalIsOpen('ztoPalmSignModal')).toBe(false);
    expect((await queuedJobs()).filter(job => !job.signedCleanupConfirmed)).toEqual([expect.objectContaining({ code: third, photo: PHOTO, phase: 'checking' })]);
    expect((await queuedJobs()).filter(job => job.signedCleanupConfirmed)).toHaveLength(2);
    await pollQueue();
    expect(closeCalls().map((row) => row[1]).sort()).toEqual([...codes].sort());
    expect(modalIsOpen('ztoPalmSignModal')).toBe(false);
});
it('ជ្រើសទទួលតែមួយក្នុងពីរ មិនបិទផ្ទាំងដែលនៅមានកញ្ចប់ត្រូវបន្ត', async () => {
    await openReceipt([CODE, SECOND]);
    await submit([CODE]);
    expect(modalIsOpen('ztoPalmSignModal')).toBe(true);
    expect(closeCalls().map((row) => row[1])).toEqual([CODE]);
    await submit([SECOND]);
    expect(modalIsOpen('ztoPalmSignModal')).toBe(false);
});
it.each([2, 3])('ផ្លូវបិទពិត៖ លេខមួយ %s កញ្ចប់ រក្សាអត្តសញ្ញាណ Barcode និងចំនួនអតិថិជន', async (count) => {
    const real = await vi.importActual<typeof import('../src/features/barcode-ops')>('../src/features/barcode-ops');
    const codes = [CODE, SECOND, '77130500000014'].slice(0, count);
    const day = (await import('../src/core/timezone')).getFormattedDate();
    const clone = (value: any) => value == null ? null : JSON.parse(JSON.stringify(value));
    const store: any = { zoew_scan_history_cod_dod: { item1: { id: 'item1', phone: '012345678', scanDate: day, isClosed: false,
        barcodes: codes.map((code, i) => ({ code, cod: i + 1, dod: 0.5, isClosed: false })) } } };
    const read = (path: string) => clone(path.split('/').filter(Boolean).reduce((value: any, part) => value?.[part], store));
    const write = (path: string, value: any) => {
        const parts = path.split('/').filter(Boolean); const leaf = parts.pop()!;
        let target = store; for (const part of parts) target = target[part] ||= {};
        if (value == null) delete target[leaf]; else target[leaf] = clone(value);
    };
    dataState.scanHistory = [clone(store.zoew_scan_history_cod_dod.item1)];
    dataState.deletedItems = []; dataState.dailyCollectedData = {}; dataState.dailyPickupData = {};
    firebaseState.serverClockTrusted = true; firebaseState.serverTimeOffsetMs = 0;
    firebaseState.fb = {
        ref: (_db: unknown, path: string) => ({ path }),
        get: async (ref: any) => ({ val: () => read(ref.path), exists: () => read(ref.path) !== null }),
        runTransaction: async (ref: any, change: (value: any) => any) => {
            const next = change(read(ref.path)); if (next === undefined) return { committed: false };
            write(ref.path, next); return { committed: true, snapshot: { val: () => read(ref.path) } };
        },
        update: async (ref: any, updates: any) => { for (const [key, value] of Object.entries(updates)) write(ref.path + '/' + key, value); }
    } as any;
    firebaseState.dbRefDailyPickup = { path: 'zoew_daily_pickup_cod_dod' } as any;
    firebaseState.dbRefDailyCollected = { path: 'zoew_daily_collected_cod_dod' } as any;
    vi.mocked(applyBarcodeCloseChange).mockImplementation(real.applyBarcodeCloseChange);
    try {
        await openReceipt(codes);
        const outcomes: boolean[] = [];
        installFetch(vi.fn(async (_url, init) => {
            outcomes.push(read('zoew_scan_history_cod_dod/item1').isClosed);
            return signed(JSON.parse(String(init?.body)).barcode);
        }));
        await submit(codes);
        expect(outcomes).toEqual(codes.map(() => false));
        expect(read('zoew_scan_history_cod_dod/item1').isClosed).toBe(true);
        expect(read('zoew_scan_history_cod_dod/item1').barcodes.map((row: any) => [row.code, row.isClosed])).toEqual(codes.map((code) => [code, true]));
        await vi.waitFor(() => expect(read('zoew_daily_pickup_cod_dod/' + day)?.packagesPickedUp).toBe(count));
        expect(Object.keys(read('zoew_daily_pickup_cod_dod/' + day).pickedUpPhones)).toHaveLength(1);
        const revenue = Object.values(read('zoew_daily_collected_cod_dod/' + day)) as { c: number; d: number }[];
        expect(revenue.reduce((sum, row) => sum + row.c, 0)).toBe(count * (count + 1) / 2);
        expect(revenue.reduce((sum, row) => sum + row.d, 0)).toBe(count * 0.5);
        expect(modalIsOpen('ztoPalmSignModal')).toBe(false);
    } finally {
        firebaseState.serverClockTrusted = false;
        firebaseState.dbRefDailyPickup = null; firebaseState.dbRefDailyCollected = null;
    }
});

it.each([true, false])('Session Palm ប្តូរ (refresh) ពេលកំពុងផ្ញើ ➜ ចម្លើយ ZTO នៅតែកត់ក្នុង ZoeW · សាខាដដែល %s', async sameBranch => {
        vi.mocked(applyBarcodeCloseChange).mockClear();
        await openReceipt([CODE]);
        const gate = deferred();
        installFetch(vi.fn(() => gate.promise));
        const work = submit();
        await vi.waitFor(() => expect(nonReservationCalls()).toHaveLength(1));
        const renewed = sameBranch
            ? { ...config, palmTokenEnc: await encryptLookupSecret('renewed-session'), palmRefreshTokenEnc: await encryptLookupSecret('renewed-refresh'), palmExpiresAt: Date.now() + 28800000, palmLoginAt: Date.now() }
            : { ...config, palmAccount: { siteCode: 'KH999', siteName: '' } };
        appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify(renewed));
        gate.resolve(signed());
        await work;
        if (sameBranch) await vi.waitFor(async () => expect(await queuedJobs()).toEqual([expect.objectContaining({ signedCleanupConfirmed: true, photo: PHOTO })]));
        expect(closeCalls()).toEqual(sameBranch ? [['item1', CODE, true, { silent: true, showModal: false, expectedSignIdentity: barcodeSignIdentity(dataState.scanHistory[0], dataState.scanHistory[0].barcodes[0]) }]] : []);
        act(() => closeModal('ztoPalmSignModal'));
        appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify(config));
        installFetch(vi.fn(async (_url, init) => { const body = JSON.parse(String(init?.body)); if (body.stage === 'status') return json({ success: true, barcode: body.barcode, stage: 'status', dispatched: false, ztoClosed: false }); return body.stage === 'dispatch'
            ? json({ success: true, barcode: body.barcode, stage: 'dispatch', ztoClosed: false, dispatchProof: 'proof-' + body.barcode }) : signed(body.barcode); }));
});
it('ភស្តុតាងចែកចាយចាស់៖ រក្សារូប និងផ្ទៀងតែ status មិន replay receipt', async () => {
    await openReceipt([CODE]);
    installFetch(vi.fn(async () => json({ code: 'ZTO_PALM_DISPATCH_REQUIRED', barcode: CODE }, 409)));
    await submit();
    expect((await queuedJobs())[0]).toMatchObject({ phase: 'checking', photo: PHOTO });
    installFetch(vi.fn(async () => json({ code: 'ZTO_PALM_SIGN_UNCONFIRMED', barcode: CODE, stage: 'receipt', uncertain: true }, 409)));
    await pollQueue();
    expect(bodies().map(b => b.stage)).toEqual(['receipt-status']);
    expect((await queuedJobs())[0]).toMatchObject({ phase: 'checking', photo: PHOTO });
    expect(closeCalls()).toEqual([]);
});
it('status signed ក្រោយ receipt បដិសេធ មិនជំនួសភស្តុតាងរូបរបស់សំណើនេះ', async () => {
    await openReceipt([CODE]);
    installFetch(vi.fn(async () => json({ code: 'ZTO_PALM_DISPATCH_REQUIRED', barcode: CODE }, 409)));
    await submit();
    installFetch(vi.fn(async () => json({ success: true, barcode: CODE, stage: 'status', ztoClosed: true, dispatched: true })));
    await pollQueue();
    expect((await queuedJobs())[0]).toMatchObject({ photo: PHOTO });
    expect(closeCalls()).toEqual([]);
    expect(disk.rows.size).toBe(1);
});
it('ជំហានចែកចាយមិនផ្ញើរូបទៅ Server (APK មិនភ្ជាប់រូប) · ជំហានទទួលផ្ញើរូប', async () => {
    await openDispatch([CODE]);
    palmSignState.requestId = REQUEST;
    acceptPalmSignBarcode(CODE, PHOTO);
    await vi.waitFor(() => expect(palmSignState.dispatchResults[0]).toMatchObject({ code: CODE, state: 'dispatched' }));
    const dispatchBody = bodies().at(-1);
    expect(dispatchBody).toMatchObject({ barcode: CODE, stage: 'dispatch', requestId: REQUEST });
    expect('photo' in dispatchBody).toBe(false);
    setPalmSignName('សុខា');
    vi.mocked(fetch).mockClear();
    await submit();
    expect(bodies()[1]).toMatchObject({ stage: 'receipt', photo: PHOTO });
});
it('ចែកចាយនៅតែបដិសេធក្រោយសាកស្វ័យប្រវត្តិម្តង៖ អាចបោះបង់ ឬបញ្ជាក់ដោយដៃ ដោយមិនបញ្ជូន 04 ស្ទួន', async () => {
    const message = 'ទំនិញនេះគឺជាទំនិញដែលមានបញ្ហា សូមបញ្ជាក់ថាបានដោះស្រាយបញ្ហាហើយឬនៅ';
    mount(<ZtoPalmSignModal />);
    await act(async () => { await openDispatch([CODE]); });
    let allow = false;
    installFetch(vi.fn(async (_url, init) => {
        const body = JSON.parse(String(init?.body));
        if (!allow) return json({ code: 'ZTO_PALM_SIGN_CONFIRM_REQUIRED', barcode: body.barcode, stage: 'dispatch', message, confirmationToken: 'tok-' + body.barcode }, 409);
        return json({ success: true, barcode: body.barcode, stage: 'dispatch', ztoClosed: false, dispatchProof: 'proof-' + body.barcode });
    }));
    await act(async () => { acceptPalmSignBarcode(CODE, PHOTO); });
    await vi.waitFor(() => expect(palmSignState.confirmation).toMatchObject({ code: CODE, stage: 'dispatch', message }));
    expect(bodies()).toEqual([expect.objectContaining({ barcode: CODE, stage: 'dispatch', signMan: '' }),
        expect.objectContaining({ barcode: CODE, stage: 'dispatch', signMan: '', confirmationToken: 'tok-' + CODE })]);
    expect(bodies()[0].photo).toBeUndefined();
    expect(document.querySelector('.palm-sign-confirmation')?.textContent).toContain(message);
    await act(async () => cancelPalmSignConfirmation());
    expect(palmSignState.confirmation).toBeNull();
    expect(palmSignState.message).toContain('មិនទាន់បានចែកចាយ');
    expect(palmSignProof(CODE)).toBeFalsy();
    await act(async () => { acceptPalmSignBarcode(CODE, PHOTO); });
    await vi.waitFor(() => expect(palmSignState.confirmation?.stage).toBe('dispatch'));
    allow = true;
    await act(async () => { await confirmPalmSignWarning(); });
    await vi.waitFor(() => expect(palmSignProof(CODE)).toBe('proof-' + CODE));
    expect(bodies().at(-1)).toMatchObject({ barcode: CODE, stage: 'dispatch', confirmationToken: 'tok-' + CODE, signMan: '' });
    expect(bodies().filter((b) => b.stage === 'receipt')).toEqual([]);
    expect(closeCalls()).toEqual([]);
});

it('📍 hardware scan រង់ចាំរូប GPS មុនទទួល និងចុចស្ទួនចាប់ frame តែមួយ', async () => {
    await openDispatch([CODE]);
    let done!: (photo: string) => void;
    vi.mocked(capturePalmSignPhoto).mockClear().mockImplementationOnce(() => new Promise((resolve) => { done = resolve; }));
    expect(acceptPalmSignBarcode(CODE)).toBe(true);
    expect(acceptPalmSignBarcode(CODE)).toBe(true);
    expect(palmSignState.photos[CODE]).toBeUndefined();
    expect(capturePalmSignPhoto).toHaveBeenCalledOnce();
    done(PHOTO);
    await vi.waitFor(() => expect(palmSignState.photos[CODE]).toBe(PHOTO));
    await vi.waitFor(() => expect(palmSignState.dispatching).toEqual({}));
    expect(bodies().map((b) => b.stage)).toEqual(['dispatch']);
});
it('📍 បិទផ្ទាំងពេល hardware scan រង់ចាំ GPS ➜ ចម្លើយរូបចាស់មិន Sign ឬបំពេញ session ថ្មី', async () => {
    await openDispatch([CODE]);
    let done!: (photo: string) => void;
    vi.mocked(capturePalmSignPhoto).mockImplementationOnce(() => new Promise((resolve) => { done = resolve; }));
    acceptPalmSignBarcode(CODE);
    expect(capturePalmSignPhoto).toHaveBeenCalledOnce();
    closeModal('ztoPalmSignModal');
    await openDispatch([CODE]);
    done(PHOTO);
    await Promise.resolve(); await Promise.resolve();
    expect(palmSignState.photos[CODE]).toBeUndefined();
    expect(fetch).not.toHaveBeenCalled();
});

it('⚡ Sign ពិនិត្យស្ថានភាព · ចែកចាយ · Sign · ផ្ទៀងឡើងវិញ មិនបង្ខំ cache: no-store (ឲ្យ WebView APK ចងចាំ CORS preflight ដូច Lookup)', async () => {
    installFetch(vi.fn(async (url: string, init?: RequestInit) => {
        if (!init?.method) {
            const code = new URL(String(url)).searchParams.get('barcode')!;
            return signed(code);
        }
        const body = JSON.parse(String(init?.body || '{}'));
        if (body.stage === 'status') return json({ success: true, barcode: body.barcode, stage: 'status', ztoClosed: false, dispatched: false });
        if (body.stage === 'dispatch') return json({ success: true, barcode: body.barcode, stage: 'dispatch', ztoClosed: false, dispatchProof: 'proof-' + body.barcode });
        return json({ code: 'ZTO_TIMEOUT', uncertain: true }, 504);
    }));
    await act(async () => openZtoPalmSign('item1', CODE));
    await vi.waitFor(() => expect(palmSignState.checking).toBe(false));
    palmSignState.requestId = REQUEST;
    setPalmSignName('សុខា');
    await act(async () => { acceptPalmSignBarcode(CODE, PHOTO); });
    await vi.waitFor(() => expect(palmSignProof(CODE)).toBe('proof-' + CODE));
    await act(async () => { await submit([CODE]); });
    expect((await queuedJobs())[0]).toMatchObject({ phase: 'checking', photo: PHOTO });
    await act(async () => { await pollQueue(); });
    const caches = vi.mocked(fetch).mock.calls.map((call) => (call[1] as RequestInit | undefined)?.cache);
    expect(caches).toHaveLength(5);
    expect(caches.every((c) => c === undefined)).toBe(true);
});

it('Sign កញ្ចប់ដែលពិនិត្យរួច មិនចាំ status កញ្ចប់មិនបានជ្រើស ហើយចុចស្ទួនមិនផ្ញើពីរដង', async () => {
    const slowStatus = deferred();
    const receiptReply = deferred();
    let receipts = 0;
    installFetch(vi.fn(async (_url, init) => {
        const body = JSON.parse(String(init?.body));
        if (body.stage === 'status') return body.barcode === SECOND ? slowStatus.promise
            : json({ success: true, barcode: CODE, stage: 'status', dispatched: true, ztoClosed: false, dispatchProof: 'ready-proof' });
        receipts++;
        return receiptReply.promise;
    }));
    mount(<ZtoPalmSignModal />);
    act(() => openZtoPalmSign('item1'));
    try {
        await act(async () => { await vi.waitFor(() => expect(palmSignState.checked[CODE]).toBe(true)); });
        act(() => { setPalmSignName('សុខា'); acceptPalmSignBarcode(CODE, PHOTO); });
        expect(palmSignState.checking).toBe(true);
        await act(async () => { await vi.waitFor(() => expect((document.querySelector('.palm-sign-submit') as HTMLButtonElement).disabled).toBe(false)); });
        const sending = submit([CODE]);
        await vi.waitFor(() => expect(receipts).toBe(1));
        await submit([CODE]);
        expect(receipts).toBe(1);
        receiptReply.resolve(signed(CODE));
        await sending;
        expect(closeCalls().map((row) => row[1])).toEqual([CODE]);
        expect(palmSignState.results.find((row) => row.code === CODE)?.state).toBe('queued');
        expect(await queuedJobs()).toEqual([expect.objectContaining({ signedCleanupConfirmed: true, photo: PHOTO })]);
    } finally {
        receiptReply.resolve(signed(CODE));
        slowStatus.resolve(json({ success: true, barcode: SECOND, stage: 'status', dispatched: false, ztoClosed: false }));
        await vi.waitFor(() => expect(palmSignState.checking).toBe(false));
    }
});

it('status និង receipt ដែលឆ្លើយព្រមគ្នា សរសេរបិទកញ្ចប់តាមលំដាប់ មិនជាន់គ្នា', async () => {
    const slowStatus = deferred();
    const receiptReply = deferred();
    const closeReply = deferred();
    let receipts = 0;
    let active = 0;
    let maximum = 0;
    vi.mocked(applyBarcodeCloseChange).mockImplementation(async (_item, code) => {
        active++;
        maximum = Math.max(maximum, active);
        if (code === SECOND) await closeReply.promise;
        active--;
        return true;
    });
    installFetch(vi.fn(async (_url, init) => {
        const body = JSON.parse(String(init?.body));
        if (body.stage === 'status') return body.barcode === SECOND ? slowStatus.promise
            : json({ success: true, barcode: CODE, stage: 'status', dispatched: true, ztoClosed: false, dispatchProof: 'ready-proof' });
        receipts++;
        return receiptReply.promise;
    }));
    openZtoPalmSign('item1');
    let sending: Promise<void> | undefined;
    try {
        await vi.waitFor(() => expect(palmSignState.checked[CODE]).toBe(true));
        setPalmSignName('សុខា'); acceptPalmSignBarcode(CODE, PHOTO);
        sending = submit([CODE]);
        await vi.waitFor(() => expect(receipts).toBe(1));
        slowStatus.resolve(json({ success: true, barcode: SECOND, stage: 'status', dispatched: true, ztoClosed: true }));
        await vi.waitFor(() => expect(closeCalls().map((row) => row[1])).toEqual([SECOND]));
        receiptReply.resolve(signed(CODE));
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(closeCalls().map((row) => row[1])).toEqual([SECOND]);
        closeReply.resolve(json({}));
        await sending;
        expect(closeCalls().map((row) => row[1])).toEqual([SECOND, CODE]);
        expect(maximum).toBe(1);
    } finally {
        closeReply.resolve(json({})); receiptReply.resolve(signed(CODE));
        slowStatus.resolve(json({ success: true, barcode: SECOND, stage: 'status', dispatched: false, ztoClosed: false }));
        await sending;
        await vi.waitFor(() => expect(palmSignState.checking).toBe(false));
    }
});

it('proof និងរូបដែលមាន តែ fresh status មិនទាន់បានពិនិត្យ មិនអនុញ្ញាត receipt', async () => {
    await openReceipt([CODE]);
    palmSignState.checked = { ...palmSignState.checked, [CODE]: false };
    palmSignState.checking = true;
    mount(<ZtoPalmSignModal />);
    try {
        await submit([CODE]);
        expect(fetch).not.toHaveBeenCalled();
        expect((document.querySelector('.palm-sign-submit') as HTMLButtonElement).disabled).toBe(true);
    } finally { palmSignState.checking = false; }
});

it('រូបថតមុន status ឆ្លើយ ចែកចាយភ្លាមពេលកញ្ចប់ខ្លួនបានពិនិត្យ មិនចាំកញ្ចប់ផ្សេង', async () => {
    const firstStatus = deferred();
    const slowStatus = deferred();
    installFetch(vi.fn(async (_url, init) => {
        const body = JSON.parse(String(init?.body));
        if (body.stage === 'status') return body.barcode === CODE ? firstStatus.promise : slowStatus.promise;
        return json({ success: true, barcode: CODE, stage: 'dispatch', ztoClosed: false, dispatchProof: 'early-proof' });
    }));
    openZtoPalmSign('item1');
    acceptPalmSignBarcode(CODE, PHOTO);
    try {
        await vi.waitFor(() => expect(nonReservationCalls()).toHaveLength(2));
        expect(palmSignState.dispatchResults).toEqual([]);
        firstStatus.resolve(json({ success: true, barcode: CODE, stage: 'status', dispatched: false, ztoClosed: false }));
        await vi.waitFor(() => expect(palmSignProof(CODE)).toBe('early-proof'));
        expect(palmSignState.checking).toBe(true);
        expect(bodies().filter((body) => body.stage === 'dispatch')).toHaveLength(1);
    } finally {
        slowStatus.resolve(json({ success: true, barcode: SECOND, stage: 'status', dispatched: false, ztoClosed: false }));
        await vi.waitFor(() => expect(palmSignState.checking).toBe(false));
    }
});

it.each(['restored', 'unknown', 'queued', 'failed'] as const)('status ចាស់ឆ្លើយ signed មិនជាន់ %s និងមិនលុបរូប', async (kind) => {
    const status = deferred();
    installFetch(vi.fn((_url, init) => JSON.parse(String(init?.body)).barcode === SECOND
        ? Promise.resolve(json({ success: true, barcode: SECOND, stage: 'status', dispatched: false, ztoClosed: false })) : status.promise));
    openZtoPalmSign('item1', kind === 'queued' ? undefined : CODE);
    await vi.waitFor(() => expect(nonReservationCalls()).toHaveLength(kind === 'queued' ? 2 : 1));
    palmSignState.photos = { [CODE]: PHOTO };
    if (kind === 'restored') dataState.scanHistory[0].barcodes[0].restoredAt = 12345;
    else palmSignState.results = [{ code: CODE, state: kind, message: 'រក្សាភស្តុតាងរូប' }];
    status.resolve(json({ success: true, barcode: CODE, stage: 'status', dispatched: true, ztoClosed: true }));
    await vi.waitFor(() => expect(palmSignState.checking).toBe(false));
    expect(closeCalls()).toEqual([]);
    expect(palmSignState.checked[CODE]).not.toBe(true);
    expect(palmSignState.photos[CODE]).toBe(PHOTO);
    if (kind !== 'restored') expect(palmSignState.results[0].state).toBe(kind);
});

it.each(['busy', 'confirmation'] as const)('status កញ្ចប់ផ្សេងចប់ មិនជាន់សារ receipt ពេល %s', async (kind) => {
    const slowStatus = deferred();
    const receiptReply = deferred();
    installFetch(vi.fn(async (_url, init) => {
        const body = JSON.parse(String(init?.body));
        if (body.stage === 'status') return body.barcode === SECOND ? slowStatus.promise
            : json({ success: true, barcode: CODE, stage: 'status', dispatched: true, ztoClosed: false, dispatchProof: 'ready-proof' });
        if (kind === 'confirmation') return json({ code: 'ZTO_PALM_SIGN_CONFIRM_REQUIRED', barcode: CODE, stage: 'receipt', message: 'ត្រូវបញ្ជាក់', confirmationToken: 'token' }, 409);
        return receiptReply.promise;
    }));
    openZtoPalmSign('item1');
    await vi.waitFor(() => expect(palmSignState.checked[CODE]).toBe(true));
    setPalmSignName('សុខា'); acceptPalmSignBarcode(CODE, PHOTO);
    const sending = submit([CODE]);
    try {
        await vi.waitFor(() => expect(bodies().some((body) => body.stage === 'receipt')).toBe(true));
        if (kind === 'confirmation') await sending;
        const message = (await queuedJobs())[0].message;
        expect(message).not.toBe('');
        slowStatus.resolve(json({ success: true, barcode: SECOND, stage: 'status', dispatched: false, ztoClosed: false }));
        await vi.waitFor(() => expect(palmSignState.checking).toBe(false));
        expect((await queuedJobs())[0].message).toBe(message);
        expect(modalIsOpen('ztoPalmSignModal')).toBe(true);
        if (kind === 'confirmation') expect((await queuedJobs())[0]).toMatchObject({ phase: 'action', warningToken: 'token' });
    } finally {
        receiptReply.resolve(signed(CODE));
        slowStatus.resolve(json({ success: true, barcode: SECOND, stage: 'status', dispatched: false, ztoClosed: false }));
        await sending;
        if (palmSignState.confirmation) cancelPalmSignConfirmation();
        await vi.waitFor(() => expect(palmSignState.checking).toBe(false));
    }
});

it.each(['auth', 'database'] as const)('ការសរសេរហាងចាស់ព្យួរ មិនរារាំង %s ថ្មី និងមិនដោះ queue ថ្មី', async (kind) => {
    const oldWrite = deferred();
    const newWrite = deferred();
    const third = '77130500000014';
    vi.mocked(applyBarcodeCloseChange).mockImplementation(async (_item, code) => {
        if (code === CODE) await oldWrite.promise;
        if (code === SECOND) await newWrite.promise;
        return true;
    });
    installFetch(vi.fn(async (_url, init) => {
        const body = JSON.parse(String(init?.body));
        return json({ success: true, barcode: body.barcode, stage: 'status', dispatched: true, ztoClosed: true });
    }));
    openZtoPalmSign('item1', CODE);
    try {
        await vi.waitFor(() => expect(closeCalls().map((row) => row[1])).toEqual([CODE]));
        cancelZtoPalmSign(); closeModal('ztoPalmSignModal');
        if (kind === 'auth') firebaseState.authGeneration++;
        else firebaseState.db = { next: true };
        dataState.scanHistory[0].barcodes = [{ code: SECOND, isClosed: false }, { code: third, isClosed: false }];
        openZtoPalmSign('item1');
        await vi.waitFor(() => expect(closeCalls().map((row) => row[1])).toEqual([CODE, SECOND]));
        oldWrite.resolve(json({}));
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(closeCalls().map((row) => row[1])).toEqual([CODE, SECOND]);
        newWrite.resolve(json({}));
        await vi.waitFor(() => expect(closeCalls().map((row) => row[1])).toEqual([CODE, SECOND, third]));
    } finally {
        oldWrite.resolve(json({})); newWrite.resolve(json({}));
        await vi.waitFor(() => expect(palmSignState.checking).toBe(false));
    }
});

it('ការពារ៖ គ្មាន IndexedDB មិនផ្ញើ receipt ហើយរក្សារូបក្នុង modal', async () => {
    vi.stubGlobal('indexedDB', undefined);
    await openReceipt([CODE]);
    installFetch(vi.fn(async () => { throw Error('must not fetch'); }));
    await submit();
    expect(fetch).not.toHaveBeenCalled();
    expect(closeCalls()).toHaveLength(0);
    expect(palmSignState.photos[CODE]).toBe(PHOTO);
    expect(modalIsOpen('ztoPalmSignModal')).toBe(true);
    expect(disk.rows.size).toBe(0);
});

it.each([{ photoAccepted: undefined }, { requestId: 'other-request' }])('ការពារ៖ receipt ខ្វះភស្តុតាងរូប %j មិនលុបរូបដើម', async (patch) => {
    await openReceipt([CODE]);
    installFetch(vi.fn(async () => json({ success: true, barcode: CODE, ztoClosed: true, stage: 'receipt', requestId: REQUEST, photoAccepted: true, ...patch })));
    await submit();
    expect(disk.rows.size).toBe(1);
    expect((await queuedJobs())[0].photo).toBe(PHOTO);
    expect((await queuedJobs())[0].photoVerified).not.toBe(true);
    expect(closeCalls()).toHaveLength(patch.requestId ? 0 : 1);
});

it('ការពារ៖ recheck រក្សាអត្តសញ្ញាណកញ្ចប់មុន await មិនបិទកញ្ចប់ស្តារថ្មី', async () => {
    await openReceipt([CODE]);
    installFetch(vi.fn(async () => { throw Error('lost'); }));
    await submit();
    const gate = deferred();
    installFetch(vi.fn(() => gate.promise));
    const work = pollQueue();
    try {
        await vi.waitFor(() => expect(nonReservationCalls()).toHaveLength(1));
        dataState.scanHistory[0].barcodes[0] = { ...dataState.scanHistory[0].barcodes[0], createdAt: Date.now() + 1000 };
    }
    finally {
        gate.resolve(signed());
        await work;
    }
    expect(closeCalls()).toHaveLength(0);
    expect((await queuedJobs())[0].photo).toBe(PHOTO);
});

it('ការពារ៖ terminal rejection រក្សារូបក្នុងជួរ មិនអនុញ្ញាត submit ស្ទួន', async () => {
    await openReceipt([CODE]);
    installFetch(vi.fn(async () => json({ code: 'ZTO_PALM_SIGN_REPORTED_REJECTED', barcode: CODE, requestId: REQUEST, stage: 'receipt', verificationRequired: true }, 409)));
    await submit();
    expect((await queuedJobs())[0]).toMatchObject({ phase: 'action', verificationRequired: true, photo: PHOTO });
    await submit();
    await pollQueue();
    expect(nonReservationCalls()).toHaveLength(1);
    expect(closeCalls()).toHaveLength(0);
});

it.each(['busy', 'unknown'])('ការពារ៖ រូបសំណើ %s មិនអាចជំនួស ឬលុបមុនផ្ទៀង ACK', async (phase) => {
    await openReceipt([CODE]);
    const gate = deferred();
    installFetch(vi.fn(() => gate.promise));
    const work = submit();
    try {
        await vi.waitFor(() => expect(nonReservationCalls()).toHaveLength(1));
        if (phase === 'unknown') {
            gate.resolve(json({ uncertain: true }, 504));
            await work;
        }
        acceptPalmSignBarcode(CODE, '/9j/AAECAwQG/9k=', true);
        removePalmSignScan(CODE);
        expect((await queuedJobs())[0].photo).toBe(PHOTO);
    }
    finally {
        gate.resolve(json({ uncertain: true }, 504));
        await work;
    }
    installFetch(vi.fn(async () => signed()));
    await pollQueue();
    expect(closeCalls().map(c => c[1])).toEqual([CODE]);
    expect(await queuedJobs()).toEqual([expect.objectContaining({ signedCleanupConfirmed: true, photo: PHOTO })]);
});

it('ការពារ៖ ឈ្មោះសំណើ unknown មិនប្រែ ខណៈកំពុងរង់ចាំភស្តុតាង', async () => {
    await openReceipt([CODE]);installFetch(vi.fn(async()=>{throw Error('lost');}));await submit();setPalmSignName('អ្នកទទួលថ្មី');expect((await queuedJobs())[0].signMan).toBe('សុខា');expect((await queuedJobs())[0].photo).toBe(PHOTO);
});

it.each(['receipt', 'recheck'])('ការពារ៖ %s ផ្ញើអត្តសញ្ញាណទៅ transaction បិទ មិនត្រឹមតែ local closure', async (stage) => {
    await openReceipt([CODE]);
    const identity = barcodeSignIdentity(dataState.scanHistory[0], dataState.scanHistory[0].barcodes[0]);
    if (stage === 'recheck') {
        installFetch(vi.fn(async () => { throw Error('lost'); }));
        await submit();
        installFetch(vi.fn(async () => signed()));
        await pollQueue();
    }
    else
        await submit();
    expect(closeCalls()).toHaveLength(1);
    expect(closeCalls()[0][3]).toMatchObject({ expectedSignIdentity: identity });
});

it('ការពារ៖ recheck ចាប់អត្តសញ្ញាណមុន decrypt headers មិនទទួលកញ្ចប់ស្តារជំនួស', async () => {
    await openReceipt([CODE]);
    installFetch(vi.fn(async () => { throw Error('lost'); }));
    await submit();
    const original = webcrypto.subtle.decrypt.bind(webcrypto.subtle);
    const gate = deferred();
    const decrypt = vi.spyOn(webcrypto.subtle, 'decrypt').mockImplementation(async (...args) => { await gate.promise; return original(...args); });
    installFetch(vi.fn(async () => signed()));
    const work = pollQueue();
    try {
        await vi.waitFor(() => expect(decrypt).toHaveBeenCalled());
        dataState.scanHistory[0].barcodes[0] = { ...dataState.scanHistory[0].barcodes[0], createdAt: Date.now() + 1000 };
    }
    finally {
        gate.resolve(signed());
        await work;
        decrypt.mockRestore();
    }
    expect(closeCalls()).toHaveLength(0);
    expect((await queuedJobs())[0].photo).toBe(PHOTO);
});

it.each(['unknown', 'signed-unsaved'])('ការពារ៖ recheck %s ប្រើអត្តសញ្ញាណសំណើដើម បើស្តារកញ្ចប់មុនចុចផ្ទៀង មិនបិទវគ្គថ្មី', async (phase) => {
    await openReceipt([CODE]);
    if (phase === 'unknown')
        installFetch(vi.fn(async () => { throw Error('lost'); }));
    else
        vi.mocked(applyBarcodeCloseChange).mockResolvedValueOnce(false);
    await submit();
    expect((await queuedJobs())[0].phase).toBe(phase === 'unknown' ? 'checking' : 'confirmed');
    vi.mocked(applyBarcodeCloseChange).mockClear();
    dataState.scanHistory[0].barcodes[0] = { ...dataState.scanHistory[0].barcodes[0], createdAt: Date.now() + 1000 };
    installFetch(vi.fn(async () => signed()));
    await pollQueue();
    expect(closeCalls()).toHaveLength(0);
    expect((await queuedJobs())[0].photo).toBe(PHOTO);
});

it('ការពារ៖ external signed-unsaved រក្សា statusIdentity មិនបិទកញ្ចប់ស្តារក្រោយ status', async () => {
    vi.mocked(applyBarcodeCloseChange).mockResolvedValueOnce(false);
    installFetch(vi.fn(async (_url, init) => {
        const body = JSON.parse(String(init?.body));
        return json({ success: true, barcode: body.barcode, stage: 'status', dispatched: true, ztoClosed: true });
    }));
    await openDispatch([CODE]);
    expect(palmSignState.results[0]).toMatchObject({ code: CODE, state: 'signed', saved: false });
    vi.mocked(applyBarcodeCloseChange).mockClear();
    dataState.scanHistory[0].barcodes[0] = { ...dataState.scanHistory[0].barcodes[0], createdAt: Date.now() + 1000 };
    await recheckZtoPalmSign();
    expect(closeCalls()).toHaveLength(0);
});

it.each([true, false])('ការពារ៖ local close ACK %s មកក្រោយស្តារកញ្ចប់ មិនបង្ហាញ signed ចាស់ ឬលុបរូប', async (saved) => {
    await openReceipt([CODE]);
    const gate = deferred();
    vi.mocked(applyBarcodeCloseChange).mockImplementationOnce(async () => { await gate.promise; return saved; });
    const work = submit();
    try {
        await vi.waitFor(() => expect(closeCalls()).toHaveLength(1));
        dataState.scanHistory[0].barcodes[0] = { ...dataState.scanHistory[0].barcodes[0], createdAt: Date.now() + 1000 };
    }
    finally {
        gate.resolve(signed());
        await work;
    }
    expect((await queuedJobs())[0].photo).toBe(PHOTO);
    expect(disk.rows.size).toBe(1);
    await pollQueue();
    expect(closeCalls()).toHaveLength(1);
});

it.each(['receipt', 'local-true', 'local-false'])('ការពារ៖ %s ក្រោយស្តារ មិនឲ្យចុច Sign ទីពីរយក ACK cached បិទវគ្គថ្មី', async (point) => {
    await openReceipt([CODE]);
    const originalIdentity = barcodeSignIdentity(dataState.scanHistory[0], dataState.scanHistory[0].barcodes[0]);
    const gate = deferred();
    const persistence = deferred();
    let persistenceWaiting = false;
    const encrypt = webcrypto.subtle.encrypt.bind(webcrypto.subtle);
    if (point === 'receipt')
        installFetch(vi.fn(() => gate.promise));
    else
        vi.mocked(applyBarcodeCloseChange).mockImplementationOnce(async () => { await gate.promise; return point === 'local-true'; });
    const work = submit();
    try {
        await vi.waitFor(() => expect(point === 'receipt' ? nonReservationCalls() : closeCalls()).toHaveLength(1));
        dataState.scanHistory[0].barcodes[0] = { ...dataState.scanHistory[0].barcodes[0], createdAt: Date.now() + 1000 };
        if (point === 'local-true') vi.spyOn(webcrypto.subtle, 'encrypt').mockImplementationOnce(async (...args) => { persistenceWaiting = true; await persistence.promise; return encrypt(...args); });
    }
    finally {
        gate.resolve(signed());
        await work;
    }
    const writes = closeCalls().length;
    installFetch(vi.fn(async () => signed()));
    await submit();
    if (point === 'local-true') {
        await vi.waitFor(() => expect(persistenceWaiting).toBe(true));
        expect([...disk.rows.values()][0].leaseUntil).toBeGreaterThan(Date.now());
    }
    const poll = pollQueue();
    persistence.resolve(signed());
    await poll;
    expect(closeCalls()).toHaveLength(writes);
    expect(fetch).not.toHaveBeenCalled();
    expect((await queuedJobs())[0]).toMatchObject({ photo: PHOTO, parcelIdentity: originalIdentity });
});

it.each(['restore', 'remove'])('ការពារ៖ headers រង់ចាំ %s មិនផ្ញើរូប/Sign ពីជម្រើសកញ្ចប់ចាស់', async (change) => {
    await openReceipt([CODE]);
    const originalBarcode = { ...dataState.scanHistory[0].barcodes[0] };
    const identity = barcodeSignIdentity(dataState.scanHistory[0], originalBarcode);
    const original = webcrypto.subtle.decrypt.bind(webcrypto.subtle);
    const gate = deferred();
    const decrypt = vi.spyOn(webcrypto.subtle, 'decrypt').mockImplementation(async (...args) => { await gate.promise; return original(...args); });
    installFetch(vi.fn(async () => signed()));
    const work = submit();
    try {
        await vi.waitFor(() => expect(decrypt).toHaveBeenCalled());
        if (change === 'remove')
            dataState.scanHistory[0].barcodes = [];
        else
            dataState.scanHistory[0].barcodes[0] = { ...originalBarcode, createdAt: Date.now() + 1000 };
    }
    finally {
        gate.resolve(signed());
        await work;
        decrypt.mockRestore();
    }
    expect(fetch).not.toHaveBeenCalled();
    expect(closeCalls()).toHaveLength(0);
    expect((await queuedJobs())[0]).toMatchObject({ photo: PHOTO, parcelIdentity: identity });
});

it('status មកក្រោយចាប់រូបដើម មិនបិទ modal ឬលុបរូបតាម signed ទូទៅ', async () => {
    const status = deferred();
    installFetch(vi.fn(async (_url, init) => {
        const body = JSON.parse(String(init?.body));
        expect(body.stage).toBe('status');
        return status.promise;
    }));
    openZtoPalmSign('item1', CODE);
    await vi.waitFor(() => expect(nonReservationCalls()).toHaveLength(1));
    acceptPalmSignBarcode(CODE, PHOTO);
    expect(palmSignState.photos[CODE]).toBe(PHOTO);
    status.resolve(json({ success: true, stage: 'status', barcode: CODE, dispatched: true, ztoClosed: true }));
    await vi.waitFor(() => expect(palmSignState.checking).toBe(false));
    expect(closeCalls()).toHaveLength(1);
    expect(modalIsOpen('ztoPalmSignModal')).toBe(true);
    expect(palmSignState.photos[CODE]).toBe(PHOTO);
    expect(palmSignState.results[0].state).toBe('unknown');
    expect(bodies().every(body => body.stage === 'status')).toBe(true);
});


it('status បញ្ជាក់រួច តែចាប់រូបខណៈ local close រង់ចាំ ក៏រក្សារូបដើម', async () => {
    const close = deferred();
    vi.mocked(applyBarcodeCloseChange).mockImplementationOnce(async () => { await close.promise; return true; });
    installFetch(vi.fn(async () => json({ success: true, stage: 'status', barcode: CODE, dispatched: true, ztoClosed: true })));
    openZtoPalmSign('item1', CODE);
    await vi.waitFor(() => expect(closeCalls()).toHaveLength(1));
    acceptPalmSignBarcode(CODE, PHOTO); expect(palmSignState.photos[CODE]).toBe(PHOTO);
    close.resolve(json({}));
    await vi.waitFor(() => expect(palmSignState.checking).toBe(false));
    expect(modalIsOpen('ztoPalmSignModal')).toBe(true); expect(palmSignState.photos[CODE]).toBe(PHOTO);
    expect(palmSignState.results[0].state).toBe('unknown');
    expect(bodies().every(body => body.stage === 'status')).toBe(true);
});


it('pending row ៖ provisional scan barcode មិនអាច dispatch 04 មុនភស្តុតាងប្រាក់', async () => {
    const item = dataState.scanHistory[0];
    item.barcodes[0].createdAt = 1793358000000;
    item.scanPending = { intent: 'scan_' + 'a'.repeat(32), actorUid: 'audit-user', code: CODE, birth: item.barcodes[0].createdAt, slot: '0', payloadHash: 'b'.repeat(64) };
    await openDispatch([CODE]);
    palmSignState.checked = { ...palmSignState.checked, [CODE]: true };
    palmSignState.photos = { ...palmSignState.photos, [CODE]: PHOTO };
    await dispatchPalmSignCode(CODE);
    expect(bodies().filter(body => ['dispatch', 'receipt'].includes(body.stage))).toEqual([]);
    expect(closeCalls()).toEqual([]);
});

it('pending row ៖ provisional scan barcode មិនអាចចូល durable Sign queue', async () => {
    const item = dataState.scanHistory[0];
    item.barcodes[0].createdAt = 1793358000000;
    item.scanPending = { intent: 'scan_' + 'a'.repeat(32), actorUid: 'audit-user', code: CODE, birth: item.barcodes[0].createdAt, slot: '0', payloadHash: 'b'.repeat(64) };
    await expect(persistPalmSignJob({ code: CODE, itemId: 'item1', requestId: REQUEST, signMan: 'សុខា', photo: PHOTO, dispatchProof: 'proof-' + CODE, autoConfirm: true }, () => true))
        .rejects.toThrow('outbox:parcel');
    expect(disk.rows.size).toBe(0);
    expect(bodies().filter(body => ['dispatch', 'receipt'].includes(body.stage))).toEqual([]);
});

it.each(['scan', 'price'])('pending row ៖ marker %s មិនពេញលេញរារាំងការចូល Sign', async (kind) => {
    dataState.scanHistory[0][kind === 'scan' ? 'scanPending' : 'pricePending'] = { phase: 'settled' };
    openZtoPalmSign('item1', CODE);
    expect(modalIsOpen('ztoPalmSignModal')).toBe(false);
    await expect(persistPalmSignJob({ code: CODE, itemId: 'item1', requestId: REQUEST, signMan: 'សុខា', photo: PHOTO, dispatchProof: 'proof-' + CODE }, () => true)).rejects.toThrow('outbox:parcel');
    expect(disk.rows.size).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
});

it.each(['price', 'scan'])('pending row ៖ %s បញ្ចប់ត្រឹមត្រូវអនុញ្ញាត Sign ដដែល', async (kind) => {
    if (kind === 'price') dataState.scanHistory[0].pricePending = { token: 'price_' + 'a'.repeat(32), actorUid: 'audit-user', code: CODE, slot: '0', birth: 0, rowBirth: 0,
        scanDate: '2026-10-30', priorCod: 0, priorDod: 0, wantCod: 0, wantDod: 0, phase: 'settled', outcome: 'committed' };
    else { dataState.scanHistory[0].scanPending = {}; delete dataState.scanHistory[0].scanPending; }
    await openReceipt([CODE]);
    await submit();
    expect(nonReservationCalls()).toHaveLength(1);
    expect(await queuedJobs()).toEqual([expect.objectContaining({ signedCleanupConfirmed: true, photo: PHOTO })]);
});

it('pending row ៖ ការងារដើមដែលនៅ queue រង់ចាំ marker ដោយរក្សារូប និងអត្តសញ្ញាណ', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    await persistPalmSignJob({ code: CODE, itemId: 'item1', requestId: REQUEST, signMan: 'សុខា', photo: PHOTO, dispatchProof: 'proof-' + CODE }, () => true);
    await runPalmSignOutbox();
    const original = (await queuedJobs())[0];
    dataState.scanHistory[0].scanPending = {};
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    await pollQueue();
    expect(fetch).not.toHaveBeenCalled();
    expect((await queuedJobs())[0]).toMatchObject({ phase: 'queued', photo: PHOTO, parcelIdentity: original.parcelIdentity });
});

it('pending row ៖ signed response ចេញមុន marker ថ្មីនៅតែរក្សាភស្តុតាង និងរូបដើម', async () => {
    await openReceipt([CODE]);
    const receipt = deferred();
    installFetch(vi.fn(() => receipt.promise));
    vi.mocked(applyBarcodeCloseChange).mockResolvedValue(false);
    const work = submit();
    await vi.waitFor(() => expect(nonReservationCalls()).toHaveLength(1));
    dataState.scanHistory[0].scanPending = {};
    receipt.resolve(signed());
    await work;
    expect((await queuedJobs())[0]).toMatchObject({ phase: 'confirmed', scanCompleted: true, photoVerified: true, photo: PHOTO });
    expect((await queuedJobs())[0].signedCleanupConfirmed).not.toBe(true);
    expect(nonReservationCalls()).toHaveLength(1);
});

it.each(['dispatch', 'receipt'])('pending row ៖ marker មកខណៈ headers %s រង់ចាំ មិនចាប់ផ្តើម upstream write', async (stage) => {
    if (stage === 'receipt') await openReceipt([CODE]);
    else { await openDispatch([CODE]); palmSignState.photos = { [CODE]: PHOTO }; }
    const headers = deferred();
    let waiting = false;
    let calls = 0;
    firebaseState.fb.getIdTokenResult = vi.fn(async () => {
        calls++;
        if (stage === 'dispatch' || calls === 2) { waiting = true; await headers.promise; }
        return { token: 'synthetic-identity' };
    });
    const work = stage === 'dispatch' ? dispatchPalmSignCode(CODE) : submit();
    await vi.waitFor(() => expect(waiting).toBe(true));
    dataState.scanHistory[0].scanPending = {};
    headers.resolve(json({}));
    await work;
    expect(bodies().filter(body => ['dispatch', 'receipt'].includes(body.stage))).toEqual([]);
    expect(closeCalls()).toEqual([]);
    if (stage === 'receipt') expect((await queuedJobs())[0]).toMatchObject({ photo: PHOTO, phase: 'checking' });
});
