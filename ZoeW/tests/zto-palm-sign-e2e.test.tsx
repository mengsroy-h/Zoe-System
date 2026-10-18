/**
 * ✍️ ZTO Palm Sign ពីដើមដល់ចប់ ៖ App ពិត (`zto-palm-sign.ts`) ➜ Function ពិត (`zto-order-detail.js` ➜ `_shared/zto-palm-sign.js`) ➜ ZTO Palm ក្លែង។
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
import { acceptPalmSignBarcode, cancelPalmSignConfirmation, confirmPalmSignWarning, openZtoPalmSign, palmSignProof, setPalmSignName, submitZtoPalmSign } from '../src/features/zto-palm-sign';
import { applyBarcodeCloseChange } from '../src/features/barcode-ops';
import { encryptLookupSecret } from '../src/services/crypto';
import { closeModal } from '../src/ui/modal';

vi.mock('../src/services/palm-sign-camera', () => ({ palmSignFramePhoto: vi.fn(() => ''), startPalmSignCamera: vi.fn(() => () => {}), startPalmSignLocation: vi.fn(() => () => {}) }));
vi.mock('../src/features/barcode-ops', () => ({
    openViewListModal: () => {}, removeSingleBarcode: async () => 'failed', toggleIndividualBarcodeClose: async () => false,
    openEditBarcodePriceModal: () => {}, closeEditBarcodeModal: () => {}, saveEditedBarcodePrice: () => {},
    applyBarcodeCloseChange: vi.fn(async () => true)
}));

const req = createRequire(import.meta.url);
const fn = req('../netlify/functions/zto-order-detail.js');
const KEY = 'sign-e2e-proxy-key-0123456789';
const CODE = '77130500000012';
const PHOTO = '/9j/AAECAwQF/9k=';
const SITE = 'KH001';
const PROBLEM = 'ទំនិញនេះគឺជាទំនិញដែលមានបញ្ហា សូមបញ្ជាក់ថាបានដោះស្រាយបញ្ហាហើយឬនៅ';
const reply = (result: unknown, status = true) => new Response(JSON.stringify({ status, result }));
let zto: Array<{ path: string; body: any }> = [];
let warnings: Record<string, string | null> = {};
const tracks = () => {
    const rows: any[] = [{ action: '3', siteCode: SITE, mailNo: CODE, time: '2026-10-18 13:25:26' }];
    if (zto.some((c) => c.path.endsWith('saveScanInfo') && c.body[0].scanTypeCode === '04')) rows.unshift({ action: '4', siteCode: SITE, mailNo: CODE, time: '2026-10-18 13:33:04', preOrNextID: '04' });
    return [{ mail: { mailNo: CODE, isSign: 0 }, tracks: rows }];
};
function fakeZto(url: string, init?: RequestInit) {
    const path = new URL(url).pathname;
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    zto.push({ path, body });
    if (path.endsWith('doLogin')) return reply({ token: 'palm-token', countryCode: 'KH', siteCode: SITE });
    if (path.endsWith('queryTrackInfo')) return reply(tracks());
    if (path.endsWith('newBusinessCheck')) {
        const message = warnings[String(body.scanType)];
        return reply(message ? { message, whetherForce: false } : null);
    }
    if (path.endsWith('queryPreOrderByBillCode')) return reply({ billCode: CODE });
    if (path.endsWith('/add')) return reply('log-id');
    if (path.endsWith('saveScanInfo')) return reply([]);
    return reply(null);
}
async function route(url: unknown, init?: RequestInit) {
    const target = String(url);
    if (!target.includes('/.netlify/functions/zto-order-detail')) return fakeZto(target, init);
    const parsed = new URL(target);
    const headers: Record<string, string> = {};
    new Headers(init?.headers as HeadersInit).forEach((value, key) => { headers[key.toLowerCase()] = value; });
    const res = await fn.handler({ httpMethod: init?.method || 'GET', headers, queryStringParameters: Object.fromEntries(parsed.searchParams), body: init?.body ? String(init.body) : null });
    return new Response(res.body, { status: res.statusCode, headers: res.headers });
}
const scans = (type: string) => zto.filter((c) => c.path.endsWith('saveScanInfo') && c.body[0].scanTypeCode === type).map((c) => c.body[0]);

beforeEach(async () => {
    for (const [key, value] of Object.entries({ ZTO_PROXY_KEY: KEY, ZTO_PROXY_KEYS_JSON: '', ZTO_PALM_SESSION_SECRET: 'synthetic-session-secret-at-least-32-characters', ZTO_PALM_SIGN_KEY: 'synthetic-sign-key', ZTO_PALM_PASSWORD_KEY: 'zoew-test-aes-16', ZTO_DETAIL_IDENTITY: 'off', ZTO_DETAIL_BRANCH_PATHS: '' })) vi.stubEnv(key, value);
    zto = [];
    warnings = {};
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
    firebaseState.fb = null;
    firebaseState.auth = null;
    securityState.lookupSecretKey = await webcrypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']) as any;
    appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ enabled: true, url: window.location.origin + '/.netlify/functions/zto-order-detail?palm=1&barcode={barcode}',
        headerName: 'X-Zoe-Proxy-Key', headerValue: KEY, palmTokenEnc: await encryptLookupSecret(session), shop: 'https://sign-shop.firebaseio.com' }));
    dataState.scanHistory = [{ id: 'item1', phone: '012000000', isClosed: false, barcodes: [{ code: CODE, isClosed: false }] }];
    registerModalMeta('ztoPalmSignModal', {});
    palmSignState.busy = false;
    vi.mocked(applyBarcodeCloseChange).mockReset().mockResolvedValue(true);
});
afterEach(() => {
    closeModal('ztoPalmSignModal');
    unregisterModalMeta('ztoPalmSignModal');
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    securityState.lookupSecretKey = null;
});

async function openAndScan() {
    openZtoPalmSign('item1', CODE);
    await vi.waitFor(() => expect(palmSignState.checking).toBe(false));
    expect(palmSignState.checked[CODE]).toBe(true);
    acceptPalmSignBarcode(CODE, PHOTO);
}

it('ចែកចាយកញ្ចប់មានបញ្ហា ៖ ZTO សួរ ➜ ផ្ទាំងបញ្ជាក់ ➜ «បញ្ជាក់ និងបន្ត» ➜ 04 តែម្តង (គ្មានរូប គ្មានឈ្មោះ) ➜ Sign 05 + រូប ➜ បិទក្នុង ZoeW', async () => {
    warnings = { 4: PROBLEM };
    await openAndScan();
    await vi.waitFor(() => expect(palmSignState.confirmation).toMatchObject({ code: CODE, stage: 'dispatch', message: PROBLEM }));
    expect(scans('04')).toEqual([]);
    await confirmPalmSignWarning();
    await vi.waitFor(() => expect(palmSignProof(CODE)).toMatch(/^.{8,}$/));
    expect(scans('04')).toHaveLength(1);
    expect(scans('04')[0]).toMatchObject({ billCode: CODE, dispatchOrSendManCode: 'test-operator' });
    expect(scans('04')[0].signMan).toBeUndefined();
    expect(zto.some((c) => c.path.endsWith('saveBillPic'))).toBe(false);
    setPalmSignName('សុខា');
    await submitZtoPalmSign();
    await vi.waitFor(() => expect(applyBarcodeCloseChange).toHaveBeenCalledOnce());
    expect(scans('05')).toHaveLength(1);
    expect(scans('05')[0]).toMatchObject({ billCode: CODE, signMan: 'សុខា' });
    expect(zto.filter((c) => c.path.endsWith('saveBillPic')).map((c) => c.body)).toEqual([{ fileName: PHOTO, picType: 1, billCode: CODE }]);
});

it('ចែកចាយកញ្ចប់មានបញ្ហា ៖ «បោះបង់» ➜ គ្មាន 04 · Sign មិនទាន់អាចផ្ញើ · ស្កេនម្តងទៀត ➜ សួរម្តងទៀត', async () => {
    warnings = { 4: PROBLEM };
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

it('Sign មិនប្រែ ៖ កញ្ចប់គ្មានបញ្ហា ➜ 04 ភ្លាម · កញ្ចប់មានបញ្ហាពេលទទួល ➜ សួរបញ្ជាក់ stage receipt ដូចមុន', async () => {
    warnings = { 5: PROBLEM };
    await openAndScan();
    await vi.waitFor(() => expect(palmSignProof(CODE)).toMatch(/^.{8,}$/));
    expect(palmSignState.confirmation).toBeNull();
    setPalmSignName('សុខា');
    await submitZtoPalmSign();
    await vi.waitFor(() => expect(palmSignState.confirmation).toMatchObject({ code: CODE, message: PROBLEM }));
    expect(palmSignState.confirmation?.stage).not.toBe('dispatch');
    expect(scans('05')).toEqual([]);
    await confirmPalmSignWarning();
    await vi.waitFor(() => expect(applyBarcodeCloseChange).toHaveBeenCalledOnce());
    expect(scans('04')).toHaveLength(1);
    expect(scans('05')).toHaveLength(1);
});
