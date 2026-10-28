/**
 * ⛔ Phase B ជុំ ៣ (ការសម្រេចម្ចាស់ ៖ គ្មាន compat មុន launch · «អនុញ្ញាតដក» Header Lookup ធម្មតាក្នុងតំបន់ ZTO ចាក់សោ) ៖
 *    Header Lookup រស់នៅតែអ៊ិនគ្រីបក្រោម PIN (`headerValueEnc`)។ `headerValue` ធម្មតា (ទម្រង់មុនការអ៊ិនគ្រីប) មិនត្រូវ App អាន ផ្ញើ
 *    ផ្លាស់ ឬរក្សាទុកទៀតទេ ៖ ស្កេន · `buildLookupRequestHeaders()` · តារាងអតិថិជន · 🧪 សាកល្បង · 🩺 · Login ZTO · ប្រអប់ (placeholder) · រក្សាទុក។ ករណីនីមួយៗវាស់ផ្លូវពិតដែលបានរត់ (សំណើចេញ ឬសារ) មុនពិនិត្យថាសោធម្មតាមិនចេញ។
 */
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { refTo, setFieldValue } from '../src/app/refs';
import { firebaseState, scanState, securityState, uiState } from '../src/core/state';
import { appLocalStore } from '../src/core/storage';
import { viewState } from '../src/core/view-state';
import { attemptAutoLookup, cancelPendingLookupUnlock } from '../src/features/auto-lookup';
import { clearCustomerDataTableCache, fetchCustomerDataTableRows } from '../src/features/customer-table';
import { buildLookupRequestHeaders } from '../src/features/lookup-api';
import { openLookupApiConfigModal, saveLookupApiConfig, testLookupApiConfig } from '../src/features/lookup-config';
import { healthLookupRow } from '../src/features/health-check';
import { cancelZtoPalmLogin, submitZtoPalmLogin } from '../src/features/zto-palm-login';
import { deriveLookupSecretKey } from '../src/services/crypto';
import { LookupApiConfigModal } from '../src/app/components/modals/LookupApiConfigModal';
import { mount, step, unmount } from './native/react-harness';

const PLAIN = 'plain-legacy-header-0123456789';
const API = 'https://api.example.com/lookup?code={barcode}';
const ZTO = window.location.origin + '/.netlify/functions/zto-order-detail?barcode={barcode}';
const SHOP = 'https://plain-shop.firebaseio.com';
const modalFields = ['modalPhoneInput', 'modalCodInput', 'modalDodInput'] as const;
const stored = () => JSON.parse(appLocalStore.getItem('zoew_lookup_api_config') || 'null');
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

function storePlain(url: string, headerName: string, extra: object = {}) {
    const raw = JSON.stringify({ enabled: true, url, headerName, headerValue: PLAIN, phoneField: 'phone', codField: 'cod', dodField: 'dod', shop: SHOP, ...extra });
    appLocalStore.setItem('zoew_lookup_api_config', raw);
    return raw;
}

function stubFetch() {
    const fetch = vi.fn(async (url: string, _init?: RequestInit) => (String(url).indexOf('list=1') !== -1
        ? json({ success: true, rows: [] })
        : json({ success: true, phone: '012345678', cod: 1, dod: 0 })));
    vi.stubGlobal('fetch', fetch);
    return fetch;
}

function sentPlain(fetch: ReturnType<typeof stubFetch>) {
    return fetch.mock.calls.filter(([url, init]) => (String(url) + JSON.stringify((init && init.headers) || {})).indexOf(PLAIN) !== -1);
}

beforeEach(async () => {
    appLocalStore.clear();
    appLocalStore.setItem('zoew_firebase_config', JSON.stringify({ databaseURL: SHOP }));
    firebaseState.authGeneration++;
    firebaseState.auth = null;
    firebaseState.fb = null;
    clearCustomerDataTableCache();
    securityState.lookupSecretKey = await deriveLookupSecretKey('654321');
    vi.stubGlobal('alert', vi.fn());
    viewState.lookupStatus = null as any;
    for (const name of modalFields) refTo(name)(document.createElement('input'));
    mount(<LookupApiConfigModal />);
});

afterEach(() => {
    act(() => { cancelZtoPalmLogin(); });
    cancelPendingLookupUnlock();
    unmount();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    clearCustomerDataTableCache();
    for (const name of modalFields) refTo(name)(null);
    scanState.pendingBarcode = '';
    uiState.isModalOpen = false;
    uiState.modalDisplay = {};
    securityState.lookupSecretKey = null;
    appLocalStore.clear();
});

describe('Header Lookup ធម្មតា (`headerValue`) ៖ គ្មានអ្នកអាន គ្មានអ្នកសរសេរ', () => {
    it('`buildLookupRequestHeaders()` ៖ API ផ្សេង · ZTO Cookie ➜ គ្មាន Header ពីសោធម្មតា', async () => {
        expect(await buildLookupRequestHeaders({ enabled: true, url: API, headerName: 'X-Api-Key', headerValue: PLAIN })).toEqual({});
        expect(await buildLookupRequestHeaders({ enabled: true, url: ZTO, headerName: 'X-Zoe-Proxy-Key', headerValue: PLAIN })).toEqual({});
    });

    it('ស្កេន ➜ សំណើចេញ តែគ្មានសោធម្មតា (ក្នុង Header ឬ URL)', async () => {
        const fetch = stubFetch();
        storePlain(API, 'X-Api-Key');
        scanState.pendingBarcode = 'B1';
        uiState.isModalOpen = true;
        await attemptAutoLookup('B1');
        expect(fetch.mock.calls.some((call) => String(call[0]).indexOf('code=B1') !== -1)).toBe(true);
        expect(sentPlain(fetch)).toEqual([]);
    });

    it('តារាងអតិថិជន ➜ សំណើ list ចេញ តែគ្មានសោធម្មតា', async () => {
        const fetch = stubFetch();
        storePlain(API, 'X-Api-Key');
        await fetchCustomerDataTableRows(true);
        expect(fetch.mock.calls.some((call) => String(call[0]).indexOf('list=1') !== -1)).toBe(true);
        expect(sentPlain(fetch)).toEqual([]);
    });

    it('🧪 សាកល្បង (ប្រអប់ Secret ទទេ) ➜ សំណើចេញ តែគ្មានសោធម្មតា', async () => {
        const fetch = stubFetch();
        storePlain(API, 'X-Api-Key');
        vi.stubGlobal('prompt', vi.fn(() => 'B3'));
        step(() => openLookupApiConfigModal());
        await testLookupApiConfig();
        expect(fetch.mock.calls.some((call) => String(call[0]).indexOf('code=B3') !== -1)).toBe(true);
        expect(sentPlain(fetch)).toEqual([]);
    });

    it('🩺 Lookup ZTO ➜ ⚠️ «កំណត់ Header ម្តងទៀត» · មិនផ្ញើសោធម្មតា', async () => {
        const fetch = stubFetch();
        storePlain(ZTO, 'X-Zoe-Proxy-Key');
        const row: any = await healthLookupRow();
        expect(row.state).toBe('warn');
        expect(String(row.detail || row.text || JSON.stringify(row))).toContain('កំណត់ Header ម្តងទៀត');
        expect(sentPlain(fetch)).toEqual([]);
    });

    it('Login ZTO (Secret ទទេ) ➜ សុំសោភ្ជាប់ · គ្មានសំណើ', async () => {
        const fetch = stubFetch();
        storePlain(ZTO, 'X-Zoe-Proxy-Key');
        act(() => openLookupApiConfigModal());
        setFieldValue('ztoPalmUsernameInput', 'palm-user');
        setFieldValue('ztoPalmPasswordInput', 'synthetic-login-password');
        await act(async () => { await submitZtoPalmLogin(); });
        expect(viewState.palmLoginStatus).toContain('សោភ្ជាប់ ZoeW');
        expect(fetch).not.toHaveBeenCalled();
    });

    it('ប្រអប់ ➜ placeholder មិនប្រាប់ថា «មានរួច»', () => {
        storePlain(API, 'X-Api-Key');
        step(() => openLookupApiConfigModal());
        expect(viewState.lookupHeaderValuePlaceholder).not.toContain('មានរួច');
    });

    it.each([true, false])('រក្សាទុក (PIN %s · Secret ទទេ) ➜ storage គ្មានសោធម្មតា ហើយមិនអ៊ិនគ្រីបវា', async (pin) => {
        stubFetch();
        storePlain(API, 'X-Api-Key');
        if (!pin) securityState.lookupSecretKey = null;
        step(() => openLookupApiConfigModal());
        await saveLookupApiConfig();
        const cfg = stored();
        expect(cfg.url).toBe(API);
        expect(cfg.headerValue).toBeUndefined();
        expect(cfg.headerValueEnc || null).toBe(null);
        expect(appLocalStore.getItem('zoew_lookup_api_config')).not.toContain(PLAIN);
    });
});
