/**
 * ⛔ E7 k10 ៖ ZTO ឆ្លើយលេខដាក់កន្លែង (`0` · `000` …) លើផ្លូវស្កេន (`/detail`) ➜ មុនកែ ៖ App បំពេញ `0` ក្នុងប្រអប់ ➜ រក្សាទុកស្វ័យប្រវត្តិ
 *    ➜ `addOrUpdateEntry()` បញ្ចូលកញ្ចប់អ្នកដទៃចូលជួរតែមួយ (phone `0` + ថ្ងៃដូចគ្នា) ➜ ប្រាក់ COD របស់អតិថិជន ២ នាក់ក្នុងជួរតែមួយ។
 *    ឥឡូវ Function ពិតទម្លាក់លេខដាក់កន្លែង (ដូចផ្លូវបញ្ជី) ➜ App បំពេញតែ COD/DOD · មិនរក្សាទុកស្វ័យប្រវត្តិ · «រំលង» រក្សាទុក «គ្មានលេខ»
 *    ដែលមិនដែលបញ្ចូលគ្នា។ ទិសផ្ទុយ ៖ លេខពិតដូចគ្នា ២ ដងក្នុងថ្ងៃតែមួយ នៅតែបញ្ចូលគ្នាជាជួរតែមួយ (ច្បាប់ phone + scanDate)។
 *
 *    តេស្តនេះដើរ **Function ពិត** (`handler`) តាម fetch ក្លែងរបស់ App ➜ `triggerScanAction()` · `attemptAutoLookup()` · `confirmPhone()` ·
 *    `addOrUpdateEntry()` ពិត។ ក្លែងតែ Firebase SDK (ឃ្លាំងក្នុងអង្គចងចាំ)។
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { refTo } from '../src/app/refs';
import { dataState, firebaseState, scanState, uiState } from '../src/core/state';
import { appLocalStore } from '../src/core/storage';
import { viewState } from '../src/core/view-state';
import { autoLookupFailureAt, lookupFastCache } from '../src/features/auto-lookup';
import { clearCustomerDataTableCache } from '../src/features/customer-table';
import { confirmPhone, triggerScanAction } from '../src/features/scan-action';

function fakeServer() {
    const store: Record<string, any> = {};
    const clone = (v: any) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
    const snap = (v: any) => ({ val: () => clone(v === undefined ? null : v), exists: () => v !== undefined && v !== null });
    return {
        store,
        ref: (_db: any, p?: string) => ({ path: String(p || '') }),
        runTransaction: async (ref: any, update: any) => {
            const next = update(clone(store[ref.path] === undefined ? null : store[ref.path]));
            if (next === undefined) return { committed: false, snapshot: snap(store[ref.path]) };
            store[ref.path] = clone(next);
            return { committed: true, snapshot: snap(store[ref.path]), txOutcome: 'committed' };
        },
        update: async (ref: any, patch: any) => {
            Object.keys(patch).forEach((k) => { store[ref.path + '/' + k] = clone(patch[k]); });
        },
        get: async (ref: any) => snap(store[ref.path]),
        increment: (n: number) => n,
        onValue: () => () => {},
        off: () => {}
    };
}

const nodeRequire = createRequire(import.meta.url);
const FUNCTION_JS = path.resolve(__dirname, '..', 'netlify', 'functions', 'zto-order-detail.js');
const fn = nodeRequire(FUNCTION_JS);
const KEY = 'placeholder-phone-key-0123456789';
const CLIENT_URL = 'https://example.invalid/.netlify/functions/zto-order-detail?barcode={barcode}';
const SKIP_PHONE = 'គ្មានលេខ';

let upstream: Record<string, any> = {};
let lastInputs: Record<string, HTMLInputElement> = {};
function refsValue(name: string): string {
    return lastInputs[name] ? lastInputs[name].value : '';
}
const savedEnv = { ZTO_PROXY_KEY: process.env.ZTO_PROXY_KEY, ZTO_AUTHORIZATION: process.env.ZTO_AUTHORIZATION };

function input(name: any): HTMLInputElement {
    const el = document.createElement('input');
    refTo(name)(el);
    return el;
}

async function functionResponse(href: string): Promise<Response> {
    const url = new URL(href);
    const query: Record<string, string> = {};
    url.searchParams.forEach((value, name) => { query[name] = value; });
    const out = await fn.handler({ httpMethod: 'GET', headers: { 'x-zoe-proxy-key': KEY }, queryStringParameters: query });
    return new Response(out.body, { status: out.statusCode, headers: { 'content-type': 'application/json' } });
}

function upstreamResponse(href: string, init: any) {
    const sent = href + ' ' + String(init && init.body || '');
    const code = Object.keys(upstream).find((c) => sent.includes(c)) || '';
    const data = upstream[code] || null;
    return {
        ok: true, status: 200,
        headers: { get: () => 'application/json' },
        json: async () => (data ? { success: true, data } : { success: true, data: null })
    };
}

beforeEach(() => {
    process.env.ZTO_PROXY_KEY = KEY;
    process.env.ZTO_AUTHORIZATION = 'Bearer placeholder-test';
    fn.resetCachesForTests();
    upstream = {};
    appLocalStore.clear();
    appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({
        enabled: true, autoSubmit: true, fastMode: true, url: CLIENT_URL,
        phoneField: 'phone', codField: 'cod', dodField: 'dod'
    }));
    clearCustomerDataTableCache();
    lookupFastCache.clear();
    autoLookupFailureAt.clear();
    dataState.scanHistory = [];
    dataState.deletedItems = [];
    uiState.isModalOpen = false;
    uiState.entryScanMode = 'parcel';
    scanState.pendingBarcode = '';
    firebaseState.db = { name: 'placeholder-test' } as any;
    firebaseState.fb = fakeServer() as any;
    firebaseState.dbRefHistory = { path: 'zoew_scan_history_cod_dod' } as any;
    firebaseState.authGeneration++;
    lastInputs = {};
    for (const name of ['modalPhoneInput', 'modalCodInput', 'modalDodInput', 'modalLockerInput']) lastInputs[name] = input(name);
    vi.stubGlobal('fetch', vi.fn(async (href: any, init: any) => {
        const text = String(href);
        if (text.startsWith('https://example.invalid/')) return functionResponse(text);
        return upstreamResponse(text, init);
    }));
});

afterEach(() => {
    vi.unstubAllGlobals();
    appLocalStore.clear();
    for (const name of ['modalPhoneInput', 'modalCodInput', 'modalDodInput', 'modalLockerInput']) refTo(name as any)(null);
    if (savedEnv.ZTO_PROXY_KEY === undefined) delete process.env.ZTO_PROXY_KEY; else process.env.ZTO_PROXY_KEY = savedEnv.ZTO_PROXY_KEY;
    if (savedEnv.ZTO_AUTHORIZATION === undefined) delete process.env.ZTO_AUTHORIZATION; else process.env.ZTO_AUTHORIZATION = savedEnv.ZTO_AUTHORIZATION;
    uiState.isModalOpen = false;
});

async function settle() {
    for (let i = 0; i < 40; i++) await new Promise((resolve) => setTimeout(resolve, 0));
}

async function scanThroughZto(barcode: string) {
    triggerScanAction(barcode);
    await settle();
    const phoneShown = refsValue('modalPhoneInput');
    const codShown = refsValue('modalCodInput');
    const autoSaved = !uiState.isModalOpen;
    if (uiState.isModalOpen) {
        await confirmPhone(true);
        await settle();
    }
    return { phoneShown, codShown, autoSaved };
}


describe('E7 k10 ៖ លេខដាក់កន្លែងពី ZTO មិនបញ្ចូលកញ្ចប់អ្នកដទៃចូលជួរតែមួយ', () => {
    for (const placeholder of ['0', '000', '0-0']) {
        it('⛔ ZTO ឆ្លើយ phone ' + JSON.stringify(placeholder) + ' សម្រាប់ ២ កញ្ចប់ ➜ ២ ជួរ «គ្មានលេខ» មិនបញ្ចូលគ្នា', async () => {
            upstream = {
                '77130500000021': { billCode: '77130500000021', consigneeMobile: placeholder, agentAmount: 1.5 },
                '77130500000022': { billCode: '77130500000022', consigneeMobile: placeholder, agentAmount: 2.25 }
            };
            const first = await scanThroughZto('77130500000021');
            const second = await scanThroughZto('77130500000022');

            const rows = dataState.scanHistory;
            expect(rows.length, 'កញ្ចប់ ២ របស់អតិថិជនផ្សេងគ្នា ➜ ២ ជួរ (មិនបញ្ចូលគ្នាក្រោម phone ' + JSON.stringify(placeholder) + ')').toBe(2);
            expect(rows.map((r: any) => r.phone)).toEqual([SKIP_PHONE, SKIP_PHONE]);
            expect(rows.map((r: any) => r.count)).toEqual([1, 1]);
            expect(rows.map((r: any) => r.cod)).toEqual([1.5, 2.25]);

            expect(first.autoSaved, 'លេខដាក់កន្លែងមិនត្រូវរក្សាទុកស្វ័យប្រវត្តិ').toBe(false);
            expect(second.autoSaved).toBe(false);
            expect(first.phoneShown).toBe('');
            expect(second.phoneShown).toBe('');
            expect(first.codShown).toBe('1.5');
            expect(second.codShown).toBe('2.25');
            expect(rows.some((r: any) => /^[0\s-]+$/.test(String(r.phone)))).toBe(false);
        });
    }

    it('⛔ ZTO ឆ្លើយ phone "0" គ្មាន COD/DOD ➜ «រកមិនឃើញ» · ប្រអប់ទទេ · មិនរក្សាទុកស្វ័យប្រវត្តិ', async () => {
        upstream = { '77130500000023': { billCode: '77130500000023', consigneeMobile: '0' } };
        triggerScanAction('77130500000023');
        await settle();
        expect(uiState.isModalOpen, 'មិនរក្សាទុកស្វ័យប្រវត្តិ').toBe(true);
        expect(refsValue('modalPhoneInput')).toBe('');
        expect(String(viewState.lookupStatus.text)).toContain('មិនឃើញទិន្នន័យ');
        expect(dataState.scanHistory.length).toBe(0);
    });

    it('ទិសផ្ទុយ ៖ លេខពិតដូចគ្នា ២ កញ្ចប់ក្នុងថ្ងៃតែមួយ ➜ រក្សាទុកស្វ័យប្រវត្តិ ហើយបញ្ចូលគ្នាជាជួរតែមួយ', async () => {
        upstream = {
            '77130500000024': { billCode: '77130500000024', consigneeMobile: '081684403', agentAmount: 0 },
            '77130500000025': { billCode: '77130500000025', consigneeMobile: '081684403', agentAmount: 3 }
        };
        const first = await scanThroughZto('77130500000024');
        const second = await scanThroughZto('77130500000025');
        expect(first.autoSaved).toBe(true);
        expect(second.autoSaved).toBe(true);
        const rows = dataState.scanHistory;
        expect(rows.length).toBe(1);
        expect(rows[0].phone).toBe('081684403');
        expect(rows[0].count).toBe(2);
        expect(rows[0].cod).toBe(3);
    });
});
