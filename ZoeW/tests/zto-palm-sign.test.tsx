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
import { openZtoPalmSign, submitZtoPalmSign, recheckZtoPalmSign } from '../src/features/zto-palm-sign';
import { applyBarcodeCloseChange } from '../src/features/barcode-ops';
import { encryptLookupSecret } from '../src/services/crypto';
import { closeModal } from '../src/ui/modal';
import { mount, unmount } from './native/react-harness';

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
const signed = (code = CODE) => json({ success: true, barcode: code, ztoClosed: true });
const submit = (codes = [CODE]) => submitZtoPalmSign(codes, 'សុខា', PHOTO, REQUEST);
const closeCalls = () => vi.mocked(applyBarcodeCloseChange).mock.calls;
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
    vi.stubGlobal('fetch', vi.fn(async () => signed()));
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
    await act(async () => { await toggleCloseStatus('item1'); });
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
    openZtoPalmSign('item1', CODE);
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
    openZtoPalmSign('item1');
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => JSON.parse(String(init?.body)).barcode === CODE ? signed() : json({ code: 'ZTO_PALM_SIGN_REJECTED' }, 409)));
    await submit([CODE, SECOND]);
    expect(closeCalls().map((c) => c[1])).toEqual([CODE]);
    expect(palmSignState.results.map((r) => r.state)).toEqual(['signed', 'failed']);
    await submit([CODE, SECOND]);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(closeCalls()).toHaveLength(1);
});
it.each(['throw', 'wrong-barcode', 'invalid-json'])('ចម្លើយមិនច្បាស់ %s ➜ មិនបិទ ឬផ្ញើឡើងវិញ · ពិនិត្យ ZTO បញ្ជាក់មុនបិទ', async (kind) => {
    openZtoPalmSign('item1');
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
    openZtoPalmSign('item1');
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
    openZtoPalmSign('item1', CODE);
    vi.mocked(applyBarcodeCloseChange).mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    await submit();
    expect(palmSignState.results[0]).toMatchObject({ state: 'signed', saved: false });
    await recheckZtoPalmSign();
    expect(fetch).toHaveBeenCalledOnce();
    expect(closeCalls()).toHaveLength(2);
    expect(palmSignState.results[0].saved).toBe(true);
});
it('ប្រអប់ត្រូវការរូប និងឈ្មោះ មុនចុះឈ្មោះ', () => {
    mount(<ZtoPalmSignModal />);
    act(() => openZtoPalmSign('item1', CODE));
    expect((document.querySelector('.btn-confirm') as HTMLButtonElement).disabled).toBe(true);
    expect(document.querySelector('input[type=file]')?.getAttribute('capture')).toBe('environment');
});
it('ម៉ាស៊ីនស្កេន Enter/Tab ក្នុងផ្ទាំង Sign ជ្រើសកញ្ចប់ ដោយមិនផ្ញើទៅជួរបញ្ចូល', async () => {
    const { noteScannerKeyDown } = await import('../src/app/behaviors/scanner-input');
    openZtoPalmSign('item1');
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
