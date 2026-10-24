import { webcrypto } from 'node:crypto';
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
import { openZtoPalmSign, submitZtoPalmSign, recheckZtoPalmSign, acceptPalmSignBarcode, setPalmSignName, confirmPalmSignWarning, cancelPalmSignConfirmation, removePalmSignScan, palmSignProof } from '../src/features/zto-palm-sign';
import { applyBarcodeCloseChange } from '../src/features/barcode-ops';
import { encryptLookupSecret } from '../src/services/crypto';
import { closeModal } from '../src/ui/modal';
import { mount, unmount } from './native/react-harness';

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
const signed = (code = CODE) => json({ success: true, barcode: code, ztoClosed: true, stage: 'receipt' });
const submit = (codes = [CODE]) => submitZtoPalmSign(codes);
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
    vi.mocked(capturePalmSignPhoto).mockReset().mockResolvedValue(PHOTO);
    vi.stubGlobal('crypto', webcrypto);
    vi.stubGlobal('confirm', vi.fn(() => false));
    appLocalStore.clear();
    appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: 'https://sign-shop.firebaseio.com' }));
    firebaseState.authGeneration++;
    firebaseState.db = {};
    firebaseState.fb = null;
    firebaseState.auth = null;
    securityState.lookupSecretKey = await webcrypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']) as any;
    config = { enabled: true, url: window.location.origin + '/.netlify/functions/zto-order-detail?palm=1&barcode={barcode}',
        headerName: 'X-Zoe-Proxy-Key', headerValue: 'synthetic-proxy', palmTokenEnc: await encryptLookupSecret('synthetic-session'), shop: 'https://sign-shop.firebaseio.com' };
    appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify(config));
    dataState.scanHistory = [{ id: 'item1', phone: '012345678', isClosed: false, barcodes: [{ code: CODE, isClosed: false }, { code: SECOND, isClosed: false }] }];
    registerModalMeta('ztoPalmSignModal', {});
    palmSignState.busy = false;
    vi.mocked(applyBarcodeCloseChange).mockReset().mockResolvedValue(true);
    act(() => refreshShopBoundUi());
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => { const body = JSON.parse(String(init?.body)); if (body.stage === 'status') return json({ success: true, barcode: body.barcode, stage: 'status', dispatched: false, ztoClosed: false }); return body.stage === 'dispatch'
        ? json({ success: true, barcode: body.barcode, stage: 'dispatch', ztoClosed: false, dispatchProof: 'proof-' + body.barcode }) : signed(body.barcode); }));
});
afterEach(() => {
    act(() => closeModal('ztoPalmSignModal'));
    unmount();
    unregisterModalMeta('ztoPalmSignModal');
    vi.unstubAllGlobals();
    securityState.lookupSecretKey = null;
    vi.restoreAllMocks();
});
it('Sign decrypt session តែម្តងក្នុងសំណើមួយ', async () => {
    await openReceipt([CODE]);
    const decrypt = vi.spyOn(webcrypto.subtle, 'decrypt');
    await submit();
    expect(decrypt).toHaveBeenCalledOnce();
});
it('អ្នកទទួលម្នាក់ ៤ កញ្ចប់ គ្មាន IndexedDB៖ បញ្ជាក់សារធម្មតាស្វ័យប្រវត្តិដោយ token និងរូបដាច់តាមកញ្ចប់', async () => {
    const codes = Array.from({ length: 4 }, (_, index) => String(77130500000012 + index));
    const photos = codes.map((_, index) => Buffer.from([255, 216, 255, index, 1, 2, 3, 255, 217]).toString('base64'));
    dataState.scanHistory[0].barcodes = codes.map((code) => ({ code, isClosed: false }));
    await openReceipt(codes);
    palmSignState.photos = Object.fromEntries(codes.map((code, index) => [code, photos[index]]));
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
        const body = JSON.parse(String(init?.body));
        return body.confirmationToken ? signed(body.barcode) : warning(body.barcode);
    }));
    await Promise.all([submit(codes), submit(codes)]);
    expect(closeCalls().map((call) => call[1]).sort()).toEqual(codes);
    expect(palmSignState.confirmation).toBeNull();
    expect(modalIsOpen('ztoPalmSignModal')).toBe(false);
    for (const [index, code] of codes.entries()) {
        expect(bodies().filter((body) => body.barcode === code)).toEqual([
            expect.objectContaining({ stage: 'receipt', barcode: code, photo: photos[index], signMan: 'សុខា', requestId: REQUEST, dispatchProof: 'proof-' + code }),
            expect.objectContaining({ stage: 'receipt', barcode: code, photo: photos[index], signMan: 'សុខា', requestId: REQUEST, dispatchProof: 'proof-' + code, confirmationToken: 'proof-' + code })
        ]);
    }
});
it('ស្កេន ៤ កញ្ចប់ បញ្ជាក់បញ្ហាចែកចាយស្វ័យប្រវត្តិ ដោយមិនផ្អាកស្កេន ឬផ្ញើរូបទៅ 04', async () => {
    const codes = Array.from({ length: 4 }, (_, index) => String(77130500000012 + index));
    dataState.scanHistory[0].barcodes = codes.map((code) => ({ code, isClosed: false }));
    await openDispatch(codes);
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
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
    for (const code of codes) expect(bodies().filter((body) => body.barcode === code).map((body) => body.confirmationToken)).toEqual([undefined, 'dispatch-' + code]);
    expect(closeCalls()).toEqual([]);
});
it('រៀបចំ Sign decrypt session តែម្តង និងយក ID token ព្រមគ្នា', async () => {
    await openReceipt([CODE]);
    const realDecrypt = webcrypto.subtle.decrypt.bind(webcrypto.subtle);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const decrypt = vi.spyOn(webcrypto.subtle, 'decrypt').mockImplementation(async (...args) => {
        await gate;
        return realDecrypt(...args);
    });
    const identity = vi.fn(async () => ({ token: 'synthetic-identity' }));
    firebaseState.auth = { currentUser: { uid: 'audit-user' } } as any;
    firebaseState.fb = { getIdTokenResult: identity } as any;
    const work = submit();
    try {
        await vi.waitFor(() => expect(decrypt).toHaveBeenCalledOnce());
        expect(identity).toHaveBeenCalledOnce();
        expect(fetch).not.toHaveBeenCalled();
    } finally {
        release();
        await work;
    }
    expect(decrypt).toHaveBeenCalledOnce();
    expect(vi.mocked(fetch).mock.calls[0][1]?.headers).toMatchObject({
        'X-Zoe-Palm-Token': 'synthetic-session', 'X-Zoe-Id-Token': 'synthetic-identity'
    });
});
it('ពិនិត្យ Sign ឡើងវិញអាន ៤ ព្រមគ្នា ប៉ុន្តែរក្សាលំដាប់ Save និងមិនផ្ញើ Sign ស្ទួន', async () => {
    const codes = Array.from({ length: 7 }, (_, i) => String(77130500000012 + i));
    dataState.scanHistory[0].barcodes = codes.map((code) => ({ code, isClosed: false }));
    await openDispatch(codes);
    palmSignState.results = codes.map((code) => ({ code, state: 'unknown', message: '' }));
    const gates = codes.map(() => deferred());
    let active = 0;
    let peak = 0;
    vi.stubGlobal('fetch', vi.fn(async (url, init) => {
        expect(init?.method).toBeUndefined();
        const code = new URL(String(url)).searchParams.get('barcode')!;
        active++;
        peak = Math.max(peak, active);
        try { return await gates[codes.indexOf(code)].promise; } finally { active--; }
    }));
    let writing = 0;
    let writePeak = 0;
    vi.mocked(applyBarcodeCloseChange).mockImplementation(async () => {
        writePeak = Math.max(writePeak, ++writing);
        await Promise.resolve();
        writing--;
        return true;
    });
    const work = recheckZtoPalmSign();
    try {
        await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(4), { timeout: 500 });
        expect(closeCalls()).toEqual([]);
        expect(palmSignState.busy).toBe(true);
        await recheckZtoPalmSign();
        expect(fetch).toHaveBeenCalledTimes(4);
        for (let i = 3; i >= 0; i--) gates[i].resolve(signed(codes[i]));
        await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(7));
    } finally {
        gates.forEach((gate, i) => gate.resolve(signed(codes[i])));
        await work;
    }
    expect(peak).toBe(4);
    expect(writePeak).toBe(1);
    expect(closeCalls().map((row) => row[1])).toEqual(codes);
    expect(modalIsOpen('ztoPalmSignModal')).toBe(false);
});
it('ពិនិត្យឡើងវិញបរាជ័យ៖ រង់ចាំសំណើកំពុងរត់ និងឈប់ចែកការងារថ្មី', async () => {
    const codes = Array.from({ length: 7 }, (_, i) => String(77130500000012 + i));
    dataState.scanHistory[0].barcodes = codes.map((code) => ({ code, isClosed: false }));
    await openDispatch(codes);
    palmSignState.results = codes.map((code) => ({ code, state: 'unknown', message: '' }));
    const gates = codes.map(() => deferred());
    vi.stubGlobal('fetch', vi.fn((url) => gates[codes.indexOf(new URL(String(url)).searchParams.get('barcode')!)].promise));
    const work = recheckZtoPalmSign();
    try {
        await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(4), { timeout: 500 });
        gates[0].resolve(new Response('invalid JSON'));
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(palmSignState.busy).toBe(true);
        expect(fetch).toHaveBeenCalledTimes(4);
        expect(closeCalls()).toEqual([]);
    } finally {
        gates.forEach((gate, i) => gate.resolve(signed(codes[i])));
        await work;
    }
    expect(fetch).toHaveBeenCalledTimes(4);
    expect(closeCalls().map((row) => row[1])).toEqual(codes.slice(1, 4));
    expect(palmSignState.results.filter((row) => row.state === 'unknown').map((row) => row.code)).toEqual([codes[0], ...codes.slice(4)]);
    expect(palmSignState.busy).toBe(false);
    expect(palmSignState.message).toContain('មិនបាន');
});
it('វាស់ពេលពិនិត្យឡើងវិញ ៨ កញ្ចប់ ជាមួយ status latency ២៥ ms', async () => {
    const codes = Array.from({ length: 8 }, (_, i) => String(77130500000012 + i));
    dataState.scanHistory[0].barcodes = codes.map((code) => ({ code, isClosed: false }));
    await openDispatch(codes);
    palmSignState.results = codes.map((code) => ({ code, state: 'unknown', message: '' }));
    vi.stubGlobal('fetch', vi.fn(async (url) => {
        await new Promise((resolve) => setTimeout(resolve, 25));
        return signed(new URL(String(url)).searchParams.get('barcode')!);
    }));
    const started = performance.now();
    await recheckZtoPalmSign();
    if (process.env.ZOE_PERF_BENCH === '1') process.stdout.write(JSON.stringify({ palmRecheckCodes: codes.length, simulatedStatusMs: 25, elapsedMs: Math.round(performance.now() - started) }) + '\n');
    expect(fetch).toHaveBeenCalledTimes(codes.length);
    expect(closeCalls().map((row) => row[1])).toEqual(codes);
});
it.each(['auth', 'database', 'config', 'close'])('ពិនិត្យឡើងវិញប្តូរ %s ៖ ចម្លើយយឺតមិនបិទ និងមិនបន្តសំណើ', async (kind) => {
    const codes = Array.from({ length: 6 }, (_, i) => String(77130500000012 + i));
    dataState.scanHistory[0].barcodes = codes.map((code) => ({ code, isClosed: false }));
    await openDispatch(codes);
    palmSignState.results = codes.map((code) => ({ code, state: 'unknown', message: '' }));
    const gates = codes.map(() => deferred());
    vi.stubGlobal('fetch', vi.fn((url) => gates[codes.indexOf(new URL(String(url)).searchParams.get('barcode')!)].promise));
    const work = recheckZtoPalmSign();
    try {
        await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(4), { timeout: 500 });
        if (kind === 'auth') firebaseState.authGeneration++;
        if (kind === 'database') firebaseState.db = {};
        if (kind === 'config') appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ ...config, enabled: false }));
        if (kind === 'close') closeModal('ztoPalmSignModal');
    } finally {
        gates.forEach((gate, i) => gate.resolve(signed(codes[i])));
        await work;
    }
    expect(fetch).toHaveBeenCalledTimes(4);
    expect(closeCalls()).toEqual([]);
    expect(palmSignState.busy).toBe(false);
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
    vi.stubGlobal('fetch', vi.fn(() => gate.promise));
    const work = submit();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    expect(closeCalls()).toEqual([]);
    await submit();
    expect(fetch).toHaveBeenCalledOnce();
    gate.resolve(signed());
    await work;
    expect(closeCalls()).toEqual([['item1', CODE, true, { silent: true, showModal: false }]]);
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toContain('?palm=sign');
    expect(JSON.parse(String(init?.body))).toMatchObject({ barcode: CODE, signMan: 'សុខា', photo: PHOTO, requestId: REQUEST });
    expect(init?.headers).toMatchObject({ 'X-Zoe-Palm-Token': 'synthetic-session' });
});
it('កញ្ចប់មួយជោគជ័យ មួយបរាជ័យ ➜ បិទតែមួយ · សាកតែកញ្ចប់បរាជ័យ', async () => {
    await openReceipt([CODE, SECOND]);
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => JSON.parse(String(init?.body)).barcode === CODE ? signed() : json({ code: 'ZTO_PALM_SIGN_REJECTED' }, 409)));
    await submit([CODE, SECOND]);
    expect(closeCalls().map((c) => c[1])).toEqual([CODE]);
    expect([CODE, SECOND].map((code) => palmSignState.results.find((r) => r.code === code)?.state)).toEqual(['signed', 'failed']);
    await submit([CODE, SECOND]);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(closeCalls()).toHaveLength(1);
});
it.each(['throw', 'wrong-barcode', 'invalid-json'])('ចម្លើយមិនច្បាស់ %s ➜ មិនបិទ ឬផ្ញើឡើងវិញ · ពិនិត្យ ZTO បញ្ជាក់មុនបិទ', async (kind) => {
    await openReceipt([CODE]);
    vi.stubGlobal('fetch', vi.fn(async () => {
        if (kind === 'throw') throw new Error('offline');
        if (kind === 'invalid-json') return new Response('bad', { status: 200 });
        return signed(SECOND);
    }));
    await submit([CODE]);
    expect(closeCalls()).toEqual([]);
    expect(palmSignState.results[0].state).toBe('unknown');
    expect(fetch).toHaveBeenCalledOnce();
    await submit();
    expect(fetch).toHaveBeenCalledOnce();
    vi.stubGlobal('fetch', vi.fn(async () => signed()));
    await recheckZtoPalmSign();
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain('status=1');
    expect(closeCalls().map((c) => c[1])).toEqual([CODE]);
});
it.each(['auth', 'shop', 'database', 'config', 'close'])('ប្តូរ %s ខណៈកំពុងផ្ញើ ➜ មិនបិទ ឬផ្ញើកញ្ចប់បន្ទាប់', async (kind) => {
    await openReceipt([CODE, SECOND]);
    const gate = deferred();
    vi.stubGlobal('fetch', vi.fn(() => gate.promise));
    const work = submit([CODE, SECOND]);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    if (kind === 'auth') firebaseState.authGeneration++;
    if (kind === 'shop') appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: 'https://other.firebaseio.com' }));
    if (kind === 'database') firebaseState.db = {};
    if (kind === 'config') appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ ...config, enabled: false }));
    if (kind === 'close') closeModal('ztoPalmSignModal');
    gate.resolve(signed());
    await work;
    expect(closeCalls()).toEqual([]);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(palmSignState.busy).toBe(false);
});
it('ZTO Sign រួចតែ ZoeW រក្សាទុកមិនទាន់បាន ➜ សាកការបិទ ZoeW ដោយមិន Sign ស្ទួន', async () => {
    await openReceipt([CODE]);
    vi.mocked(applyBarcodeCloseChange).mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    await submit();
    expect(palmSignState.results[0]).toMatchObject({ state: 'signed', saved: false });
    expect(modalIsOpen('ztoPalmSignModal')).toBe(true);
    await recheckZtoPalmSign();
    expect(fetch).toHaveBeenCalledOnce();
    expect(closeCalls()).toHaveLength(2);
    expect(modalIsOpen('ztoPalmSignModal')).toBe(false);
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
    expect(fetch).toHaveBeenCalledOnce();
    setPalmSignName('សុខា');
    await submit();
    expect(closeCalls()).toHaveLength(1);
    expect(bodies().map((body) => body.stage)).toEqual(['dispatch', 'receipt']);
    expect(bodies()[1].dispatchProof).toBe('proof-' + CODE);
});
it('ស្កេនខណៈកំពុងពិនិត្យស្ថានភាព ZTO ➜ ចែកចាយក្រោយពិនិត្យរួច (មិនផ្ញើ 04 មុនដឹងស្ថានភាព)', async () => {
    const gate = deferred();
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
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
    vi.stubGlobal('fetch', vi.fn(async () => kind === 'unknown' ? json({ uncertain: true }, 504) : json({ code: 'ZTO_PALM_SIGN_REJECTED' }, 409)));
    setPalmSignName('សុខា');
    acceptPalmSignBarcode(CODE, PHOTO);
    await vi.waitFor(() => expect(palmSignState.dispatchResults[0]?.state).toBe(kind === 'unknown' ? 'unknown' : 'failed'));
    await submit();
    expect(fetch).toHaveBeenCalledOnce();
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
    expect(bodies().map((body) => body.barcode)).toEqual([CODE]);
    expect(modalIsOpen('ztoPalmSignModal')).toBe(true);
});
it('ចែកចាយរួចក្នុង ZTO ➜ មិនផ្ញើ 04 ម្តងទៀត · Sign ប្រើភស្តុតាងដែលមាន', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
        const body = JSON.parse(String(init?.body));
        return json({ success: true, stage: 'status', barcode: body.barcode, dispatched: true, dispatchProof: 'known-' + body.barcode, ztoClosed: false });
    }));
    await openDispatch([CODE]);
    acceptPalmSignBarcode(CODE, PHOTO);
    setPalmSignName('សុខា');
    expect(fetch).not.toHaveBeenCalled();
    vi.stubGlobal('fetch', vi.fn(async () => signed()));
    await submit();
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0][1]?.body))).toMatchObject({ stage: 'receipt', signMan: 'សុខា', dispatchProof: 'known-' + CODE });
    expect(closeCalls()).toHaveLength(1);
});
it('កញ្ចប់ចែកចាយរួចខ្លះ ➜ ផ្ញើ 04 តែកញ្ចប់ដែលនៅសល់', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
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
    vi.stubGlobal('fetch', vi.fn(async () => json({ code: 'ZTO_PALM_STATUS_UNCONFIRMED' }, 409)));
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
    vi.stubGlobal('fetch', vi.fn(() => gate.promise));
    openZtoPalmSign('item1', CODE);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    firebaseState.authGeneration++;
    gate.resolve(json({ success: true, stage: 'status', barcode: CODE, dispatched: true, dispatchProof: 'old', ztoClosed: true }));
    await vi.waitFor(() => expect(palmSignState.checking).toBe(false));
    expect(palmSignState.dispatchResults).toEqual([]);
    expect(closeCalls()).toEqual([]);
});
it('⛔ ការផ្ញើមុននៅរង់ចាំ ZTO (បិទផ្ទាំងហើយ) ➜ ចុច «✍️ Sign» ម្តងទៀតប្រាប់ឲ្យរង់ចាំ (មិនស្ងាត់) · ចម្លើយមកដល់ ➜ បើកបាន', async () => {
    await openReceipt([CODE]);
    const gate = deferred();
    vi.stubGlobal('fetch', vi.fn(() => gate.promise));
    const sending = submit();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    act(() => closeModal('ztoPalmSignModal'));
    uiState.toasts = [];
    act(() => openZtoPalmSign('item1', CODE));
    expect(modalIsOpen('ztoPalmSignModal')).toBe(false);
    expect(uiState.toasts.map((t: any) => String(t.msg)).join(' ')).toContain('ការ Sign មុនកំពុងរង់ចាំចម្លើយ ZTO');
    gate.resolve(signed());
    await act(async () => { await sending; });
    expect(closeCalls(), 'ផ្ទាំងបិទរួច ➜ ចម្លើយមិនបិទកញ្ចប់ក្នុង ZoeW').toEqual([]);
    vi.stubGlobal('fetch', vi.fn(async () => json({ success: true, barcode: CODE, stage: 'status', dispatched: false, ztoClosed: false })));
    act(() => openZtoPalmSign('item1', CODE));
    expect(modalIsOpen('ztoPalmSignModal')).toBe(true);
});
it('shared mode គ្មាន palmTokenEnc ក៏អាចបើក Sign និងផ្ញើ header សាខា', async () => {
    appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ ...config, palmTokenEnc: undefined, palmShared: true, palmAccount: { siteCode: 'KH001' } }));
    act(() => refreshShopBoundUi());
    openZtoPalmSign('item1', CODE);
    await vi.waitFor(() => expect(palmSignState.checking).toBe(false));
    expect(modalIsOpen('ztoPalmSignModal')).toBe(true);
    expect(vi.mocked(fetch).mock.calls[0][1]?.headers).toMatchObject({ 'X-Zoe-Palm-Site': 'KH001' });
});
it('កញ្ចប់មានបញ្ហា៖ បញ្ជាក់សារធម្មតាស្វ័យប្រវត្តិ ហើយបិទក្រោយ ZTO យល់ព្រម', async () => {
    await openReceipt([CODE]);
    const message = 'សូមបញ្ជាក់ថាបានដោះស្រាយបញ្ហាហើយឬនៅ';
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => JSON.parse(String(init?.body)).confirmationToken
        ? signed() : json({ code: 'ZTO_PALM_SIGN_CONFIRM_REQUIRED', barcode: CODE, stage: 'receipt', message, confirmationToken: 'confirmation-proof' }, 409)));
    mount(<ZtoPalmSignModal />);
    await act(async () => { await submit(); });
    expect(closeCalls()).toHaveLength(1);
    expect(document.querySelector('[role="alertdialog"]')).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[1][1]?.body)).confirmationToken).toBe('confirmation-proof');
});

const warning = (code = CODE, message = 'សូមបញ្ជាក់ថាបានដោះស្រាយបញ្ហាហើយឬនៅ') => json({ code: 'ZTO_PALM_SIGN_CONFIRM_REQUIRED', barcode: code, stage: 'receipt', message, confirmationToken: 'proof-' + code }, 409);
it('សារស្ទួនក្រោយសាកស្វ័យប្រវត្តិម្តង៖ បោះបង់រក្សាសម្គាល់ ហើយមិនផ្ញើបន្ថែមឬបិទ', async () => {
    await openReceipt([CODE]);
    vi.stubGlobal('fetch', vi.fn(async () => warning()));
    mount(<ZtoPalmSignModal />);
    await act(async () => { await submit(); });
    expect(palmSignState.confirmation?.code).toBe(CODE);
    expect(document.querySelector('.palm-sign-note')?.textContent).toContain('សូមបញ្ជាក់');
    const name = palmSignState.signMan;
    setPalmSignName('Changed');
    removePalmSignScan(CODE);
    acceptPalmSignBarcode(CODE, 'changed');
    expect(palmSignState.signMan).toBe(name);
    expect(palmSignState.photos[CODE]).toBe(PHOTO);
    expect(palmSignState.selectedCodes).toEqual([CODE]);
    await submit();
    expect(fetch).toHaveBeenCalledTimes(2);
    act(() => cancelPalmSignConfirmation());
    expect(palmSignState.confirmation).toBeNull();
    expect(palmSignState.warnings[CODE]).toContain('សូមបញ្ជាក់');
    expect(closeCalls()).toEqual([]);
    expect(fetch).toHaveBeenCalledTimes(2);
});
it('បញ្ជាក់ស្វ័យប្រវត្តិប្រើ token របស់កញ្ចប់នីមួយៗ ហើយចុច Sign ស្ទួនមិនផ្ញើពីរដង', async () => {
    await openReceipt([CODE, SECOND]);
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
        const body = JSON.parse(String(init?.body));
        return body.confirmationToken ? signed(body.barcode) : warning(body.barcode);
    }));
    await Promise.all([submit([CODE, SECOND]), submit([CODE, SECOND])]);
    expect(closeCalls().map((c) => c[1])).toEqual([CODE, SECOND]);
    expect(palmSignState.confirmation).toBeNull();
    const tokens = (code: string) => bodies().filter((body) => body.barcode === code).map((body) => body.confirmationToken);
    expect(tokens(CODE)).toEqual([undefined, 'proof-' + CODE]);
    expect(tokens(SECOND)).toEqual([undefined, 'proof-' + SECOND]);
});
it.each(['close', 'shop', 'auth', 'config'])('ការបញ្ជាក់ចាស់ក្រោយ %s មិនបិទឬផ្ញើ', async (kind) => {
    await openReceipt([CODE]);
    vi.stubGlobal('fetch', vi.fn(async () => warning()));
    await submit();
    if (kind === 'close') closeModal('ztoPalmSignModal');
    if (kind === 'shop') appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: 'https://other.firebaseio.com' }));
    if (kind === 'auth') firebaseState.authGeneration++;
    if (kind === 'config') appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ ...config, headerValue: 'changed' }));
    await confirmPalmSignWarning();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(closeCalls()).toEqual([]);
});
it.each(['close', 'shop', 'auth', 'config'])('សារបញ្ជាក់មកក្រោយ %s មិនសាកបញ្ជាក់ស្វ័យប្រវត្តិទៅ session ថ្មី', async (kind) => {
    await openReceipt([CODE]);
    const pending = deferred();
    vi.stubGlobal('fetch', vi.fn(() => pending.promise));
    const running = submit();
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    if (kind === 'close') closeModal('ztoPalmSignModal');
    if (kind === 'shop') appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: 'https://other.firebaseio.com' }));
    if (kind === 'auth') firebaseState.authGeneration++;
    if (kind === 'config') appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ ...config, headerValue: 'changed' }));
    pending.resolve(warning());
    await running;
    expect(fetch).toHaveBeenCalledOnce();
    expect(closeCalls()).toEqual([]);
});
it.each(['dispatch', 'receipt'])('បញ្ហា %s មកក្រោយកញ្ចប់ត្រូវបានស្តារឡើងវិញ មិនបញ្ជាក់ស្វ័យប្រវត្តិដោយរូបចាស់', async (stage) => {
    if (stage === 'receipt') await openReceipt([CODE]);
    else await openDispatch([CODE]);
    const pending = deferred();
    vi.stubGlobal('fetch', vi.fn(() => pending.promise));
    const running = stage === 'receipt' ? submit() : Promise.resolve(acceptPalmSignBarcode(CODE, PHOTO));
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    dataState.scanHistory[0].barcodes = dataState.scanHistory[0].barcodes.map((barcode) => barcode.code === CODE
        ? { ...barcode, restoredAt: Date.now() } : barcode);
    pending.resolve(json({ code: 'ZTO_PALM_SIGN_CONFIRM_REQUIRED', barcode: CODE, stage, message: 'កញ្ចប់មានបញ្ហា', confirmationToken: 'old-parcel-token' }, 409));
    await running;
    await vi.waitFor(() => expect(palmSignState.dispatching).toEqual({}));
    expect(fetch).toHaveBeenCalledOnce();
    expect(closeCalls()).toEqual([]);
    expect(palmSignState.confirmation).toBeNull();
});
it('សារ ZTO ផ្លាស់ ត្រូវបង្ហាញបញ្ជាក់ថ្មី មិនបិទដោយស្វ័យប្រវត្តិ', async () => {
    await openReceipt([CODE]);
    vi.stubGlobal('fetch', vi.fn(async () => warning(CODE, 'សារដំបូង')));
    await submit();
    vi.stubGlobal('fetch', vi.fn(async () => warning(CODE, 'សារថ្មី')));
    await confirmPalmSignWarning();
    expect(palmSignState.confirmation?.message).toBe('សារថ្មី');
    expect(closeCalls()).toEqual([]);
});
it('ZTO ហាម៖ បង្ហាញមូលហេតុពិត ហើយគ្មានប៊ូតុងបញ្ជាក់ឆ្លង', async () => {
    await openReceipt([CODE]);
    vi.stubGlobal('fetch', vi.fn(async () => json({ code: 'ZTO_PALM_SIGN_CHECK_REJECTED', barcode: CODE, message: 'ZTO hard rejection' }, 409)));
    await submit();
    expect(palmSignState.warnings[CODE]).toBe('ZTO hard rejection');
    expect(palmSignState.results[0].message).toContain('ZTO មិនអនុញ្ញាត');
    expect(palmSignState.confirmation).toBeNull();
    expect(closeCalls()).toEqual([]);
    expect(fetch).toHaveBeenCalledOnce();
});
it('បើក Sign ស្គាល់ស្កេនបញ្ហាតាមស្ថានភាព ZTO ហើយមិនអនុម័តស្វ័យប្រវត្តិ', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ success: true, barcode: CODE, stage: 'status', ztoClosed: false, dispatched: true, dispatchProof: 'proof',
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
    vi.stubGlobal('fetch', vi.fn(async () => warning()));
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
    expect(closeCalls().map((row) => row[1])).toEqual(codes);
    expect(modalIsOpen('ztoPalmSignModal')).toBe(false);
    expect(palmSignState.photos).toEqual({});
});

it('លេខមួយ ៣ កញ្ចប់៖ បញ្ជាក់បញ្ហាធម្មតាស្វ័យប្រវត្តិ តែរង់ចាំចម្លើយកញ្ចប់ចុងក្រោយ មុនបិទ modal', async () => {
    const third = '77130500000014';
    const codes = [CODE, SECOND, third];
    dataState.scanHistory[0].barcodes = codes.map((code) => ({ code, isClosed: false }));
    await openReceipt(codes);
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
        if (!init?.body) return signed(third);
        const body = JSON.parse(String(init.body));
        if (body.barcode === SECOND && !body.confirmationToken) return warning(SECOND);
        return body.barcode === third ? json({ code: 'ZTO_PALM_SIGN_UNCONFIRMED', uncertain: true }, 504) : signed(body.barcode);
    }));
    await submit(codes);
    expect(closeCalls().map((row) => row[1])).toEqual([CODE, SECOND]);
    expect(modalIsOpen('ztoPalmSignModal')).toBe(true);
    await recheckZtoPalmSign();
    expect(closeCalls().map((row) => row[1])).toEqual(codes);
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
        vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
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

it('Session Palm ប្តូរ (refresh) ពេលកំពុងផ្ញើ ➜ ចម្លើយ ZTO នៅតែកត់ក្នុង ZoeW · ប្តូរសាខា Palm ➜ បោះចោល', async () => {
    for (const sameBranch of [true, false]) {
        vi.mocked(applyBarcodeCloseChange).mockClear();
        await openReceipt([CODE]);
        const gate = deferred();
        vi.stubGlobal('fetch', vi.fn(() => gate.promise));
        const work = submit();
        await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
        const renewed = sameBranch
            ? { ...config, palmTokenEnc: await encryptLookupSecret('renewed-session'), palmRefreshTokenEnc: await encryptLookupSecret('renewed-refresh'), palmExpiresAt: Date.now() + 28800000, palmLoginAt: Date.now() }
            : { ...config, palmAccount: { siteCode: 'KH999', siteName: '' } };
        appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify(renewed));
        gate.resolve(signed());
        await work;
        expect(closeCalls()).toEqual(sameBranch ? [['item1', CODE, true, { silent: true, showModal: false }]] : []);
        act(() => closeModal('ztoPalmSignModal'));
        appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify(config));
        vi.stubGlobal('fetch', vi.fn(async (_url, init) => { const body = JSON.parse(String(init?.body)); if (body.stage === 'status') return json({ success: true, barcode: body.barcode, stage: 'status', dispatched: false, ztoClosed: false }); return body.stage === 'dispatch'
            ? json({ success: true, barcode: body.barcode, stage: 'dispatch', ztoClosed: false, dispatchProof: 'proof-' + body.barcode }) : signed(body.barcode); }));
    }
});
it('ភស្តុតាងចែកចាយចាស់ (Login Palm ប្តូរ) ➜ ពិនិត្យ ZTO ឡើងវិញស្វ័យប្រវត្តិ ហើយផ្ញើម្ដងទៀតបានដោយមិនបិទផ្ទាំង', async () => {
    await openReceipt([CODE]);
    const proofs: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
        const body = JSON.parse(String(init?.body));
        if (body.stage === 'status') return json({ success: true, barcode: CODE, stage: 'status', ztoClosed: false, dispatched: true, dispatchProof: 'fresh-proof' });
        proofs.push(body.dispatchProof);
        return body.dispatchProof === 'fresh-proof' ? signed() : json({ code: 'ZTO_PALM_DISPATCH_REQUIRED', barcode: CODE }, 409);
    }));
    await submit();
    await vi.waitFor(() => expect(palmSignState.dispatchResults.find((row) => row.code === CODE)?.proof).toBe('fresh-proof'));
    await vi.waitFor(() => expect(palmSignState.checking).toBe(false));
    expect(palmSignState.checked[CODE]).toBe(true);
    expect(palmSignState.photos[CODE]).toBe(PHOTO);
    expect(modalIsOpen('ztoPalmSignModal')).toBe(true);
    expect(closeCalls()).toEqual([]);
    await submit();
    expect(proofs).toEqual(['proof-' + CODE, 'fresh-proof']);
    expect(closeCalls()).toHaveLength(1);
    expect(modalIsOpen('ztoPalmSignModal')).toBe(false);
});
it('ពិនិត្យ ZTO ឡើងវិញ ឃើញទទួលរួច ➜ ជួរកញ្ចប់មានលទ្ធផលតែមួយ (មិនស្ទួនជាមួយលទ្ធផលបរាជ័យចាស់)', async () => {
    await openReceipt([CODE]);
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => JSON.parse(String(init?.body)).stage === 'status'
        ? json({ success: true, barcode: CODE, stage: 'status', ztoClosed: true, dispatched: true })
        : json({ code: 'ZTO_PALM_DISPATCH_REQUIRED', barcode: CODE }, 409)));
    vi.mocked(applyBarcodeCloseChange).mockResolvedValue(false);
    await submit();
    await vi.waitFor(() => expect(palmSignState.results.some((row) => row.state === 'signed')).toBe(true));
    await vi.waitFor(() => expect(palmSignState.checking).toBe(false));
    expect(palmSignState.results.filter((row) => row.code === CODE)).toEqual([expect.objectContaining({ state: 'signed', saved: false })]);
    expect(modalIsOpen('ztoPalmSignModal')).toBe(true);
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
    expect(bodies()[0]).toMatchObject({ stage: 'receipt', photo: PHOTO });
});
it('ចែកចាយនៅតែបដិសេធក្រោយសាកស្វ័យប្រវត្តិម្តង៖ អាចបោះបង់ ឬបញ្ជាក់ដោយដៃ ដោយមិនបញ្ជូន 04 ស្ទួន', async () => {
    const message = 'ទំនិញនេះគឺជាទំនិញដែលមានបញ្ហា សូមបញ្ជាក់ថាបានដោះស្រាយបញ្ហាហើយឬនៅ';
    mount(<ZtoPalmSignModal />);
    await act(async () => { await openDispatch([CODE]); });
    let allow = false;
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
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
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
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
    expect(palmSignState.results.map((r) => r.state)).toEqual(['unknown']);
    await act(async () => { await recheckZtoPalmSign(); });
    const caches = vi.mocked(fetch).mock.calls.map((call) => (call[1] as RequestInit | undefined)?.cache);
    expect(caches).toHaveLength(4);
    expect(caches.every((c) => c === undefined)).toBe(true);
});
