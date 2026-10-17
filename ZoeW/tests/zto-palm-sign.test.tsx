import { webcrypto } from 'node:crypto';
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
import { openZtoPalmSign, submitZtoPalmSign, recheckZtoPalmSign, acceptPalmSignBarcode, advancePalmSignStage, setPalmSignName, confirmPalmSignWarning, cancelPalmSignConfirmation, setPalmSignSelected } from '../src/features/zto-palm-sign';
import { applyBarcodeCloseChange } from '../src/features/barcode-ops';
import { encryptLookupSecret } from '../src/services/crypto';
import { closeModal } from '../src/ui/modal';
import { mount, unmount } from './native/react-harness';

vi.mock('../src/services/palm-sign-camera', () => ({ palmSignFramePhoto: vi.fn(() => PHOTO), startPalmSignCamera: vi.fn(() => () => {}) }));

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
    for (const code of codes) acceptPalmSignBarcode(code, PHOTO);
    await submit(codes);
    expect(closeCalls()).toEqual([]);
    advancePalmSignStage();
    expect(palmSignState.photos).toEqual({});
    setPalmSignName('សុខា');
    for (const code of codes) acceptPalmSignBarcode(code, PHOTO);
    vi.mocked(fetch).mockClear();
}
function deferred() {
    let resolve!: (value: Response) => void;
    const promise = new Promise<Response>((yes) => { resolve = yes; });
    return { promise, resolve };
}
beforeEach(async () => {
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
    expect(palmSignState.results.map((r) => r.state)).toEqual(['signed', 'failed']);
    await submit([CODE, SECOND]);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(closeCalls()).toHaveLength(1);
});
it.each(['throw', 'wrong-barcode', 'invalid-json'])('ចម្លើយមិនច្បាស់ %s ➜ មិនបិទ ឬផ្ញើឡើងវិញ · ពិនិត្យ ZTO បញ្ជាក់មុនបិទ', async (kind) => {
    await openReceipt([CODE, SECOND]);
    vi.stubGlobal('fetch', vi.fn(async () => {
        if (kind === 'throw') throw new Error('offline');
        if (kind === 'invalid-json') return new Response('bad', { status: 200 });
        return signed(SECOND);
    }));
    await submit([CODE, SECOND]);
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
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    if (kind === 'auth') firebaseState.authGeneration++;
    if (kind === 'shop') appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: 'https://other.firebaseio.com' }));
    if (kind === 'database') firebaseState.db = {};
    if (kind === 'config') appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ ...config, enabled: false }));
    if (kind === 'close') closeModal('ztoPalmSignModal');
    gate.resolve(signed());
    await work;
    expect(closeCalls()).toEqual([]);
    expect(fetch).toHaveBeenCalledOnce();
    expect(palmSignState.busy).toBe(false);
});
it('ZTO Sign រួចតែ ZoeW រក្សាទុកមិនទាន់បាន ➜ សាកការបិទ ZoeW ដោយមិន Sign ស្ទួន', async () => {
    await openReceipt([CODE]);
    vi.mocked(applyBarcodeCloseChange).mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    await submit();
    expect(palmSignState.results[0]).toMatchObject({ state: 'signed', saved: false });
    await recheckZtoPalmSign();
    expect(fetch).toHaveBeenCalledOnce();
    expect(closeCalls()).toHaveLength(2);
    expect(palmSignState.results[0].saved).toBe(true);
});
it('ប្រអប់ត្រូវការស្កេន និងរូប មុនផ្ញើបញ្ជី', () => {
    mount(<ZtoPalmSignModal />);
    act(() => openZtoPalmSign('item1', CODE));
    expect((document.querySelector('.btn-confirm') as HTMLButtonElement).disabled).toBe(true);
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
    expect(palmSignState.selectedCodes).toEqual([CODE]);
    expect(palmSignState.message).toContain(CODE);
    expect(fetch).not.toHaveBeenCalled();
});

it('ចែកចាយ 04 ជោគជ័យមិនបិទ ➜ ស្កេនរូបថ្មី ➜ ទទួល 05 ជោគជ័យទើបបិទ', async () => {
    await openDispatch([CODE]);
    await submit();
    expect(fetch).not.toHaveBeenCalled();
    acceptPalmSignBarcode(CODE, PHOTO);
    await submit();
    expect(closeCalls()).toEqual([]);
    expect(palmSignState.dispatchResults[0]).toMatchObject({ state: 'dispatched', proof: 'proof-' + CODE });
    advancePalmSignStage();
    expect(palmSignState.stage).toBe('receipt');
    expect(palmSignState.selectedCodes).toEqual([]);
    expect(palmSignState.photos).toEqual({});
    await submit();
    expect(fetch).toHaveBeenCalledOnce();
    setPalmSignName('សុខា');
    acceptPalmSignBarcode(CODE, PHOTO);
    await submit();
    expect(closeCalls()).toHaveLength(1);
    const requests = vi.mocked(fetch).mock.calls.map(([, init]) => JSON.parse(String(init?.body)));
    expect(requests.map((body) => body.stage)).toEqual(['dispatch', 'receipt']);
    expect(requests[1].dispatchProof).toBe('proof-' + CODE);
});
it.each(['rejected', 'unknown'])('ចែកចាយ %s ➜ មិនចូលទទួល និងមិនបិទ', async (kind) => {
    await openDispatch([CODE]);
    acceptPalmSignBarcode(CODE, PHOTO);
    vi.stubGlobal('fetch', vi.fn(async () => kind === 'unknown' ? json({ uncertain: true }, 504) : json({ code: 'ZTO_PALM_SIGN_REJECTED' }, 409)));
    await submit();
    advancePalmSignStage();
    expect(palmSignState.stage).toBe('dispatch');
    expect(closeCalls()).toEqual([]);
});
it('camera ស្កេនបានចាប់រូប និងចង Barcode ដោយមិនផ្ញើស្វ័យប្រវត្តិ', async () => {
    const { startPalmSignCamera } = await import('../src/services/palm-sign-camera');
    mount(<ZtoPalmSignModal />);
    await act(async () => { await openDispatch([CODE]); });
    const callback = vi.mocked(startPalmSignCamera).mock.calls.at(-1)![0];
    await act(async () => callback(CODE, PHOTO));
    expect(palmSignState.photos[CODE]).toBe(PHOTO);
    expect(document.querySelector('.palm-sign-thumbnail')?.getAttribute('src')).toBe('data:image/jpeg;base64,' + PHOTO);
    expect((document.querySelector('.btn-confirm') as HTMLButtonElement).disabled).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
});
it('ចែកចាយរួចក្នុង ZTO ➜ ទៅទទួលភ្លាម ហើយត្រូវវាយឈ្មោះមុនស្កេន', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
        const body = JSON.parse(String(init?.body));
        return json({ success: true, stage: 'status', barcode: body.barcode, dispatched: true, dispatchProof: 'known-' + body.barcode, ztoClosed: false });
    }));
    await openDispatch([CODE]);
    expect(palmSignState.stage).toBe('receipt');
    acceptPalmSignBarcode(CODE, PHOTO);
    expect(palmSignState.photos).toEqual({});
    expect(palmSignState.message).toContain('ឈ្មោះ');
    setPalmSignName('សុខា');
    acceptPalmSignBarcode(CODE, PHOTO);
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
    await submit([CODE, SECOND]);
    expect(vi.mocked(fetch).mock.calls.map(([, init]) => JSON.parse(String(init?.body)).barcode)).toEqual([SECOND]);
    advancePalmSignStage();
    expect(palmSignState.stage).toBe('receipt');
});
it('tracking បរាជ័យ ➜ មិនសន្មតចែកចាយ ឬផ្ញើ scan', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ code: 'ZTO_PALM_STATUS_UNCONFIRMED' }, 409)));
    await openDispatch([CODE]);
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
it('shared mode គ្មាន palmTokenEnc ក៏អាចបើក Sign និងផ្ញើ header សាខា', async () => {
    appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ ...config, palmTokenEnc: undefined, palmShared: true, palmAccount: { siteCode: 'KH001' } }));
    act(() => refreshShopBoundUi());
    openZtoPalmSign('item1', CODE);
    await vi.waitFor(() => expect(palmSignState.checking).toBe(false));
    expect(modalIsOpen('ztoPalmSignModal')).toBe(true);
    expect(vi.mocked(fetch).mock.calls[0][1]?.headers).toMatchObject({ 'X-Zoe-Palm-Site': 'KH001' });
});
it('កញ្ចប់មានបញ្ហា៖ បង្ហាញសារ ZTO ហើយរង់ចាំបញ្ជាក់ មុនបិទ', async () => {
    await openReceipt([CODE]);
    const message = 'សូមបញ្ជាក់ថាបានដោះស្រាយបញ្ហាហើយឬនៅ';
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => JSON.parse(String(init?.body)).confirmationToken
        ? signed() : json({ code: 'ZTO_PALM_SIGN_CONFIRM_REQUIRED', barcode: CODE, stage: 'receipt', message, confirmationToken: 'confirmation-proof' }, 409)));
    mount(<ZtoPalmSignModal />);
    await act(async () => { await submit(); });
    expect(closeCalls()).toEqual([]);
    const dialog = document.querySelector('[role="alertdialog"]');
    expect(dialog?.textContent).toContain(message);
    expect(dialog?.textContent).toContain(CODE);
    const button = [...dialog!.querySelectorAll('button')].find((el) => el.textContent?.includes('បញ្ជាក់ និងបន្ត'))!;
    await act(async () => { button.click(); });
    await vi.waitFor(() => expect(closeCalls()).toHaveLength(1));
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[1][1]?.body)).confirmationToken).toBe('confirmation-proof');
});

const warning = (code = CODE, message = 'សូមបញ្ជាក់ថាបានដោះស្រាយបញ្ហាហើយឬនៅ') => json({ code: 'ZTO_PALM_SIGN_CONFIRM_REQUIRED', barcode: code, stage: 'receipt', message, confirmationToken: 'proof-' + code }, 409);
it('បោះបង់រក្សាសម្គាល់កញ្ចប់មានបញ្ហា ហើយមិនផ្ញើបញ្ជាក់ឬបិទ', async () => {
    await openReceipt([CODE]);
    vi.stubGlobal('fetch', vi.fn(async () => warning()));
    mount(<ZtoPalmSignModal />);
    await act(async () => { await submit(); });
    expect(palmSignState.confirmation?.code).toBe(CODE);
    expect(document.querySelector('.palm-sign-warning')?.textContent).toContain('សូមបញ្ជាក់');
    const name = palmSignState.signMan;
    setPalmSignName('Changed');
    setPalmSignSelected(CODE, false);
    acceptPalmSignBarcode(CODE, 'changed');
    expect(palmSignState.signMan).toBe(name);
    expect(palmSignState.photos[CODE]).toBe(PHOTO);
    expect(palmSignState.selectedCodes).toEqual([CODE]);
    await submit();
    expect(fetch).toHaveBeenCalledOnce();
    act(() => cancelPalmSignConfirmation());
    expect(palmSignState.confirmation).toBeNull();
    expect(palmSignState.warnings[CODE]).toContain('សូមបញ្ជាក់');
    expect(closeCalls()).toEqual([]);
    expect(fetch).toHaveBeenCalledOnce();
});
it('បញ្ជាក់តាមកញ្ចប់ មិនអនុម័ត Barcode បន្ទាប់ ហើយចុចស្ទួនមិនផ្ញើពីរដង', async () => {
    await openReceipt([CODE, SECOND]);
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
        const body = JSON.parse(String(init?.body));
        return body.confirmationToken ? signed(body.barcode) : warning(body.barcode);
    }));
    await submit([CODE, SECOND]);
    expect(fetch).toHaveBeenCalledOnce();
    const a = confirmPalmSignWarning();
    const b = confirmPalmSignWarning();
    await Promise.all([a, b]);
    expect(closeCalls().map((c) => c[1])).toEqual([CODE]);
    expect(palmSignState.confirmation?.code).toBe(SECOND);
    expect(vi.mocked(fetch).mock.calls.map(([, init]) => JSON.parse(String(init?.body)).confirmationToken)).toEqual([undefined, 'proof-' + CODE, undefined]);
    await confirmPalmSignWarning();
    expect(closeCalls().map((c) => c[1])).toEqual([CODE, SECOND]);
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
    expect(fetch).toHaveBeenCalledOnce();
    expect(closeCalls()).toEqual([]);
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
    expect(palmSignState.results[0].message).toBe('ZTO hard rejection');
    expect(palmSignState.confirmation).toBeNull();
    expect(closeCalls()).toEqual([]);
});
it('បើក Sign ស្គាល់ស្កេនបញ្ហាតាមស្ថានភាព ZTO ហើយមិនអនុម័តស្វ័យប្រវត្តិ', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ success: true, barcode: CODE, stage: 'status', ztoClosed: false, dispatched: true, dispatchProof: 'proof',
        problemScan: { action: '-579', message: 'ទាក់ទងអតិថិជនមិនបាន', time: '2026-10-17 10:00:00' } })));
    mount(<ZtoPalmSignModal />);
    await act(async () => { await openDispatch([CODE]); });
    expect(document.querySelector('.palm-sign-problem')?.textContent).toContain('ទាក់ទងអតិថិជនមិនបាន');
    expect(palmSignState.confirmation).toBeNull();
    expect(closeCalls()).toEqual([]);
});
