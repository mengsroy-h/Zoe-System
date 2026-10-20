import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createContext, runInContext } from 'node:vm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fieldValue, refTo, setFieldValue } from '../src/app/refs';
import { firebaseState, lookupState, scanState, sheetImportState, uiState } from '../src/core/state';
import { appLocalStore } from '../src/core/storage';
import { viewState } from '../src/core/view-state';
import { attemptAutoLookup, getFastLookupRow, setFastLookupRow } from '../src/features/auto-lookup';
import { clearCustomerDataTableCache, fetchCustomerDataTableRows, findCustomerDataTableRow, normalizeImportedCustomerRows, prefetchCustomerDataTableRowsIfConfigured, seedCustomerTableFromImport } from '../src/features/customer-table';
import { CUSTOMER_TABLE_CACHE_MS, CUSTOMER_TABLE_SOON_MS, CUSTOMER_TABLE_TICK_SLACK_MS, CUSTOMER_TABLE_TRUST_MS } from '../src/features/customer-table-prefetch';
import { loadedScriptPromises } from '../src/features/export';
import { getLookupApiConfig } from '../src/features/lookup-config';
import { applySheetImportHeaderRow, closeSheetImportModal, currentSheetImportMapping, handleSheetImportFile, runSheetImport, runSheetImportClear } from '../src/features/sheet-import';

const SHEET = 'https://script.google.com/macros/s/AKfy/exec?code={barcode}&key=k';
const ZTO = 'https://shop.example/.netlify/functions/zto-order-detail?barcode={barcode}';
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const T0 = Date.UTC(2026, 9, 20, 2, 0, 0);

function useLookup(url: string) {
    appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ enabled: true, url, phoneField: 'phone', codField: 'cod', dodField: 'dod' }));
}

function table(rows: any[], at = Date.now(), partial = false) {
    lookupState.customerDataTableRows = rows;
    lookupState.customerDataTableFetchedAt = at;
    lookupState.customerTableIsPartial = partial;
}

function fields() {
    for (const id of ['siModeSel', 'siHeaderRowInput', 'siFileInput'] as const) refTo(id)(document.createElement('input'));
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(T0));
    appLocalStore.clear();
    clearCustomerDataTableCache();
    useLookup(SHEET);
    fields();
    sheetImportState.sheetImportUrl = 'https://script.google.com/macros/s/WRITER/exec';
    sheetImportState.sheetImportPassword = 'pw';
    sheetImportState.sheetImportBusy = false;
    sheetImportState.sheetImportSheetRows = [];
    sheetImportState.sheetImportSignature = '';
    uiState.sheetImportView = null as any;
    uiState.isModalOpen = false;
    firebaseState.authGeneration++;
    vi.stubGlobal('confirm', vi.fn(() => true));
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    clearCustomerDataTableCache();
    appLocalStore.clear();
    for (const id of ['siModeSel', 'siHeaderRowInput', 'siFileInput'] as const) refTo(id)(null);
});

describe('តារាងអតិថិជន Sheet ៖ មិនឆ្លើយពីតារាងចាស់', () => {
    it('តារាងចាស់ជាងកម្រិតទុកចិត្ត ➜ មិនឆ្លើយ (ទៅ Lookup តាម barcode) · ក្រៅបណ្ដាញ ➜ នៅតែឆ្លើយ', () => {
        table([{ barcode: 'BC1', dod: 0, cod: 5, phone: '012000111' }], T0);
        expect(findCustomerDataTableRow('BC1')).toMatchObject({ cod: 5 });
        vi.setSystemTime(new Date(T0 + CUSTOMER_TABLE_TRUST_MS));
        expect(findCustomerDataTableRow('BC1')).toBeNull();
        vi.stubGlobal('navigator', { ...navigator, onLine: false });
        expect(findCustomerDataTableRow('BC1')).toMatchObject({ cod: 5 });
    });

    it('ចង្វាក់ទាញរៀងរាល់ ៥ នាទី ៖ ការទាញដែលចំណាយពេល មិនធ្វើឲ្យជុំបន្ទាប់រំលង (គ្មានរយៈ ១០ នាទី)', async () => {
        const fetch = vi.fn(async () => {
            vi.setSystemTime(new Date(Date.now() + 2000));
            return json({ rows: [{ barcode: 'BC1', dod: 0, cod: 5, phone: '012000111' }] });
        });
        vi.stubGlobal('fetch', fetch);
        await fetchCustomerDataTableRows();
        expect(fetch).toHaveBeenCalledTimes(1);
        vi.setSystemTime(new Date(T0 + CUSTOMER_TABLE_CACHE_MS));
        await fetchCustomerDataTableRows();
        expect(fetch).toHaveBeenCalledTimes(2);
    });
});

describe('នាំចូល Excel ➜ តារាងក្នុងឧបករណ៍', () => {
    it('Lookup ជា ZTO ➜ ជួរ Excel មិនចូលតារាង (មិនឈ្នះ ZTO)', () => {
        useLookup(ZTO);
        expect(seedCustomerTableFromImport([['ZT0001', 1, 9, '012000111']], 'replace', 1)).toBe(true);
        expect(lookupState.customerDataTableRows).toBeNull();
        expect(findCustomerDataTableRow('ZT0001')).toBeNull();
    });

    it('newOnly គ្មានតារាងពេញ ➜ barcode ពីឯកសារមិនត្រូវឆ្លើយ (Sheet អាចរក្សាជួរចាស់)', () => {
        expect(seedCustomerTableFromImport([['BC9', 0, 9, '099']], 'newOnly', 5)).toBe(true);
        expect(findCustomerDataTableRow('BC9')).toBeNull();
        expect(lookupState.customerTableIsPartial).toBe(true);
        table([{ barcode: 'BC1', dod: 0, cod: 5, phone: '012' }], T0, false);
        expect(seedCustomerTableFromImport([['BC1', 0, 7, '013'], ['BC2', 0, 8, '014']], 'newOnly', 3)).toBe(true);
        expect(findCustomerDataTableRow('BC2')).toBeNull();
        table([{ barcode: 'BC1', dod: 0, cod: 5, phone: '012' }], T0, false);
        expect(seedCustomerTableFromImport([['BC1', 0, 7, '013'], ['BC2', 0, 8, '014']], 'newOnly', 2, { added: 1 })).toBe(true);
        expect(findCustomerDataTableRow('BC1')).toMatchObject({ cod: 5 });
        expect(findCustomerDataTableRow('BC2')).toMatchObject({ cod: 8 });
    });

    it('upsert លើតារាងចាស់ ➜ អាយុតារាងមិនត្រូវបានធ្វើឲ្យថ្មី (ជួរដែលមិនបានទាញនៅតែចាស់)', () => {
        table([{ barcode: 'BC1', dod: 0, cod: 5, phone: '012' }], T0 - CUSTOMER_TABLE_CACHE_MS);
        expect(seedCustomerTableFromImport([['BC2', 0, 8, '014']], 'upsert', 2)).toBe(true);
        expect(lookupState.customerDataTableFetchedAt).toBe(T0 - CUSTOMER_TABLE_CACHE_MS);
    });
});

describe('នាំចូល Excel ទៅ Sheet ៖ ការពារទិន្នន័យក្នុង Sheet', () => {
    function file(rows: any[][]) {
        sheetImportState.sheetImportSheetRows = rows;
        setFieldValue('siHeaderRowInput', '1');
    }

    it('upsert ដែល Column DOD ជា «— មិនប្រើ —» ➜ បដិសេធមុនផ្ញើ (មិនលុប DOD ចាស់ក្នុង Sheet)', async () => {
        const fetch = vi.fn(async () => json({ ok: true, data: { signature: 'sig', mapping: { barcode: 0, dod: -1, cod: 1, phone: 2 }, source: 'auto' } }));
        vi.stubGlobal('fetch', fetch);
        file([['Waybill', 'COD', 'Phone'], ['BC1', 3, '012']]);
        await applySheetImportHeaderRow();
        fetch.mockClear();
        setFieldValue('siModeSel', 'upsert');
        await runSheetImport();
        expect(fetch).not.toHaveBeenCalled();
        expect(uiState.sheetImportView.messages?.siActionMsg?.text || JSON.stringify(uiState.sheetImportView)).toMatch(/DOD · COD · Phone/);
        setFieldValue('siModeSel', 'newOnly');
        fetch.mockImplementation(async () => json({ ok: true, data: { added: 1, updated: 0, unchanged: 0, rowsAfter: 1, sheetName: 'Customers' } }));
        await runSheetImport();
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('អស់ពេល/បណ្ដាញដាច់ពេលនាំចូល ➜ «មិនទាន់ដឹងលទ្ធផល» មិនមែន ❌ · តារាងក្នុងឧបករណ៍ត្រូវបោះចោល', async () => {
        file([['Waybill', 'DOD', 'COD', 'Phone'], ['BC1', 0, 3, '012']]);
        vi.stubGlobal('fetch', vi.fn(async () => json({ ok: true, data: { signature: 'sig', mapping: { barcode: 0, dod: 1, cod: 2, phone: 3 }, source: 'auto' } })));
        await applySheetImportHeaderRow();
        table([{ barcode: 'BC1', dod: 0, cod: 1, phone: '012' }], T0);
        vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
        setFieldValue('siModeSel', 'upsert');
        await runSheetImport();
        const view = JSON.stringify(uiState.sheetImportView);
        expect(view).toMatch(/មិនទាន់ដឹងលទ្ធផល/);
        expect(view).not.toMatch(/❌/);
        expect(lookupState.customerDataTableRows).toBeNull();
        table([{ barcode: 'BC1', dod: 0, cod: 1, phone: '012' }], T0);
        await runSheetImportClear();
        expect(JSON.stringify(uiState.sheetImportView)).toMatch(/មិនទាន់ដឹងលទ្ធផល/);
        expect(lookupState.customerDataTableRows).toBeNull();
    });

    it('prepare របស់ឯកសារថ្មីបរាជ័យ ➜ signature ចាស់មិននៅ (ការផ្គូផ្គងមិនទៅរក្សាក្រោម header ឯកសារមុន)', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => json({ ok: true, data: { signature: 'sigA', mapping: { barcode: 0, dod: 1, cod: 2, phone: 3 }, source: 'auto' } })));
        file([['Waybill', 'DOD', 'COD', 'Phone'], ['BC1', 0, 3, '012']]);
        await applySheetImportHeaderRow();
        expect(sheetImportState.sheetImportSignature).toBe('sigA');
        vi.stubGlobal('fetch', vi.fn(async () => json({ ok: false, error: 'busy' })));
        file([['Barcode', 'Tel', 'Cash', 'Freight'], ['BC2', '013', 4, 0]]);
        await applySheetImportHeaderRow();
        expect(sheetImportState.sheetImportSignature).toBe('');
    });

    it('ចម្លើយ prepare យឺតរបស់ header ចាស់ មិនជាន់ header ថ្មី', async () => {
        let release: (r: Response) => void = () => {};
        const slow = new Promise<Response>((resolve) => { release = resolve; });
        const fetch = vi.fn().mockReturnValueOnce(slow).mockResolvedValueOnce(json({ ok: true, data: { signature: 'sigB', mapping: { barcode: 0, dod: 1, cod: 2, phone: 3 }, source: 'auto' } }));
        vi.stubGlobal('fetch', fetch);
        file([['Waybill', 'DOD', 'COD', 'Phone'], ['BC1', 0, 3, '012']]);
        const first = applySheetImportHeaderRow();
        await applySheetImportHeaderRow();
        release(json({ ok: true, data: { signature: 'sigA', mapping: { barcode: 0, dod: 2, cod: 1, phone: 3 }, source: 'saved' } }));
        await first;
        expect(sheetImportState.sheetImportSignature).toBe('sigB');
    });

    it('ឯកសារទីពីរអានមិនបាន ➜ ជួរឯកសារមុនមិននៅសម្រាប់ «នាំចូល»', async () => {
        sheetImportState.sheetImportSheetRows = [['Waybill', 'DOD', 'COD', 'Phone'], ['OLD1', 0, 3, '012']];
        sheetImportState.sheetImportSignature = 'sigA';
        vi.stubGlobal('XLSX', { read: () => { throw new Error('corrupt'); } });
        (loadedScriptPromises as any).xlsx = Promise.resolve();
        const broken = new File([new Uint8Array(4)], 'b.xlsx');
        await handleSheetImportFile(broken);
        expect(sheetImportState.sheetImportSheetRows).toEqual([]);
        expect(sheetImportState.sheetImportSignature).toBe('');
    });
});

const PREPARED = (mapping: any, extra: any = {}) => json({ ok: true, data: { signature: 'sig', mapping, source: 'auto' }, ...extra });
const FULL_MAP = { barcode: 0, dod: 1, cod: 2, phone: 3 };
const importCalls = (fetch: any) => fetch.mock.calls.map((c: any[]) => JSON.parse(c[1].body)).filter((b: any) => b.action === 'import' || b.action === 'clear');

function sheetFile(rows: any[][]) {
    sheetImportState.sheetImportSheetRows = rows;
    setFieldValue('siHeaderRowInput', '1');
}

describe('ចង្វាក់តារាងអតិថិជន ៖ ការកែទាំងពីរត្រូវបានចាក់សោដាច់ពីគ្នា', () => {
    it('ការទាញចំណាយពេលលើស slack (៨ វិនាទី) ➜ ជុំ ៥ នាទីបន្ទាប់នៅតែទាញ (fetchedAt = ពេលចាប់ផ្ដើម)', async () => {
        const fetch = vi.fn(async () => {
            vi.setSystemTime(new Date(Date.now() + CUSTOMER_TABLE_TICK_SLACK_MS + 3000));
            return json({ rows: [{ barcode: 'BC1', dod: 0, cod: 5, phone: '012000111' }] });
        });
        vi.stubGlobal('fetch', fetch);
        await fetchCustomerDataTableRows();
        vi.setSystemTime(new Date(T0 + CUSTOMER_TABLE_CACHE_MS));
        await fetchCustomerDataTableRows();
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('ការទាញភ្លាម · ជុំមកដល់មុន ២០ ms ➜ នៅតែទាញ (slack របស់ setInterval)', async () => {
        const fetch = vi.fn(async () => json({ rows: [{ barcode: 'BC1', dod: 0, cod: 5, phone: '012000111' }] }));
        vi.stubGlobal('fetch', fetch);
        await fetchCustomerDataTableRows();
        vi.setSystemTime(new Date(T0 + CUSTOMER_TABLE_CACHE_MS - 20));
        await fetchCustomerDataTableRows();
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('ជុំមកដល់មុន ២០ ms ពេល App រវល់ (ប្រអប់បើក) ➜ កំណត់ការទាញឆាប់ៗ ហើយវាទាញពេលប្រអប់បិទ', async () => {
        vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
        vi.setSystemTime(new Date(T0));
        firebaseState.auth = { currentUser: { uid: 'u1' } } as any;
        try {
            const fetch = vi.fn(async () => json({ rows: [{ barcode: 'BC1', dod: 0, cod: 5, phone: '012000111' }] }));
            vi.stubGlobal('fetch', fetch);
            await fetchCustomerDataTableRows();
            vi.setSystemTime(new Date(T0 + CUSTOMER_TABLE_CACHE_MS - 20));
            uiState.isModalOpen = true;
            prefetchCustomerDataTableRowsIfConfigured();
            expect(lookupState.customerTableSoonTimer).toBeTruthy();
            uiState.isModalOpen = false;
            await vi.advanceTimersByTimeAsync(CUSTOMER_TABLE_SOON_MS + 10);
            expect(fetch).toHaveBeenCalledTimes(2);
        } finally {
            firebaseState.auth = null as any;
        }
    });
});

describe('នាំចូល Excel ៖ prepare ឯកសារថ្មីកំពុងរង់ចាំ', () => {
    it('ឯកសារ B កំពុងរង់ចាំ prepare ➜ ប៊ូតុងបិទ · Column របស់ឯកសារ A មិនត្រូវប្រើ · គ្មានសំណើនាំចូល', async () => {
        let release: (r: Response) => void = () => {};
        const fetch = vi.fn(async (_url: string, init: any) => {
            const body = JSON.parse(init.body);
            if (body.action === 'prepare' && body.headers[0] === 'Barcode') return new Promise<Response>((done) => { release = done; });
            if (body.action === 'prepare') return PREPARED(FULL_MAP);
            return json({ ok: true, data: { added: 1, updated: 0, unchanged: 0, rowsAfter: 1, sheetName: 'Customers' } });
        });
        vi.stubGlobal('fetch', fetch);
        sheetFile([['Waybill', 'DOD', 'COD', 'Phone'], ['BC1', 0, 3, '012']]);
        await applySheetImportHeaderRow();
        expect(viewState.siImportBtnDisabled).toBe(false);
        const rowsB = [['Barcode', 'Tel', 'Cash', 'Freight'], ['BC2', '012999888', 4, 1.5]];
        vi.stubGlobal('XLSX', { read: () => ({ SheetNames: ['S'], Sheets: { S: {} } }), utils: { sheet_to_json: () => rowsB } });
        (loadedScriptPromises as any).xlsx = Promise.resolve();
        const picking = handleSheetImportFile(new File([new Uint8Array(4)], 'b.xlsx'));
        await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
        expect(viewState.siImportBtnDisabled).toBe(true);
        expect(currentSheetImportMapping()).toEqual({ barcode: -1, dod: -1, cod: -1, phone: -1 });
        setFieldValue('siModeSel', 'replace');
        await runSheetImport();
        expect(importCalls(fetch)).toHaveLength(0);
        release(PREPARED({ barcode: 0, dod: 3, cod: 2, phone: 1 }));
        await picking;
        expect(viewState.siImportBtnDisabled).toBe(false);
        await runSheetImport();
        expect(importCalls(fetch).map((b: any) => b.payload.rows)).toEqual([[['BC2', 1.5, 4, '012999888']]]);
    });
});

describe('នាំចូល Excel ➜ តារាងក្នុងឧបករណ៍ត្រូវស្របនឹង Sheet', () => {
    it('នាំចូលជោគជ័យ ➜ cache Fast Mode របស់ barcode ក្នុងឯកសារត្រូវបោះចោល ➜ ស្កេនម្ដងទៀតឆ្លើយតម្លៃដែលនាំចូល', async () => {
        appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ enabled: true, url: SHEET, fastMode: true, phoneField: 'phone', codField: 'cod', dodField: 'dod' }));
        const cfg = getLookupApiConfig();
        table([{ barcode: 'BC1', dod: 0, cod: 10, phone: '012000111' }, { barcode: 'KEEP1', dod: 0, cod: 5, phone: '013000111' }], T0);
        setFastLookupRow('BC1', '012000111', 10, 0, cfg);
        setFastLookupRow('KEEP1', '013000111', 5, 0, cfg);
        expect(seedCustomerTableFromImport([['BC1', 0, 20, '012000111']], 'upsert', 2, { added: 0 })).toBe(true);
        expect(getFastLookupRow('BC1', cfg)).toBeNull();
        expect(getFastLookupRow('KEEP1', cfg)).toMatchObject({ cod: 5 });
        const fields = ['modalPhoneInput', 'modalCodInput', 'modalDodInput'] as const;
        for (const id of fields) refTo(id)(document.createElement('input'));
        const fetch = vi.fn(async () => json({ success: true, phone: '012000111', cod: 10, dod: 0 }));
        vi.stubGlobal('fetch', fetch);
        scanState.pendingBarcode = 'BC1';
        uiState.isModalOpen = true;
        try {
            await attemptAutoLookup('BC1');
            expect(fieldValue('modalCodInput')).toBe('20');
            expect(fetch).not.toHaveBeenCalled();
        } finally {
            scanState.pendingBarcode = '';
            uiState.isModalOpen = false;
            for (const id of fields) refTo(id)(null);
        }
        expect(seedCustomerTableFromImport([['NEW1', 0, 1, '014000111']], 'replace', 1)).toBe(true);
        expect(getFastLookupRow('KEEP1', cfg)).toBeNull();
    });

    it.each(['ok', 'unknown', 'clear'] as const)('បិទប្រអប់ពេល %s កំពុងរត់ ➜ លទ្ធផលនៅតែធ្វើឲ្យតារាងត្រឹមត្រូវ និងកំណត់ការទាញ fresh', async (outcome) => {
        vi.stubGlobal('fetch', vi.fn(async () => PREPARED(FULL_MAP)));
        sheetFile([['Waybill', 'DOD', 'COD', 'Phone'], ['BC1', 0, 20, '012']]);
        await applySheetImportHeaderRow();
        table([{ barcode: 'BC1', dod: 0, cod: 10, phone: '012' }], T0);
        let settle: (r: Response) => void = () => {};
        let fail: (e: Error) => void = () => {};
        vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((done, reject) => { settle = done; fail = reject; })));
        setFieldValue('siModeSel', 'upsert');
        const running = outcome === 'clear' ? runSheetImportClear() : runSheetImport();
        await Promise.resolve();
        closeSheetImportModal();
        if (outcome === 'ok') settle(json({ ok: true, data: { added: 0, updated: 1, unchanged: 0, rowsAfter: 1, sheetName: 'Customers' } }));
        else if (outcome === 'clear') settle(json({ ok: true, data: { removed: 1, rowsAfter: 0, sheetName: 'Customers' } }));
        else fail(new TypeError('Failed to fetch'));
        await running;
        const row = findCustomerDataTableRow('BC1');
        if (outcome === 'ok') expect(row).toMatchObject({ cod: 20 });
        else expect(row).toBeNull();
        expect(lookupState.customerTableSoonTimer).toBeTruthy();
    });

    it('newOnly ៖ barcode ដែលអ្នកសរសេរផ្សេងបន្ថែមក្រោយការទាញ (ចំនួនស្មើដោយចៃដន្យ) ➜ មិនត្រូវឆ្លើយតម្លៃឯកសារ', () => {
        table([{ barcode: 'A1', dod: 0, cod: 1, phone: '011' }], T0, false);
        expect(seedCustomerTableFromImport([['X1', 0, 20, '013'], ['Y1', 0, 8, '014']], 'newOnly', 3, { added: 1 })).toBe(true);
        expect(findCustomerDataTableRow('X1')).toBeNull();
        expect(lookupState.customerTableIsPartial).toBe(true);
        table([{ barcode: 'A1', dod: 0, cod: 1, phone: '011' }], T0, false);
        expect(seedCustomerTableFromImport([['X1', 0, 20, '013'], ['Y1', 0, 8, '014']], 'newOnly', 3, { added: 2 })).toBe(true);
        expect(findCustomerDataTableRow('X1')).toMatchObject({ cod: 20 });
        expect(lookupState.customerTableIsPartial).toBe(false);
        table([{ barcode: 'A1', dod: 0, cod: 1, phone: '011' }], T0, false);
        expect(seedCustomerTableFromImport([['X1', 0, 20, '013']], 'upsert', 2, { added: 0 })).toBe(true);
        expect(findCustomerDataTableRow('X1')).toMatchObject({ cod: 20 });
        expect(lookupState.customerTableIsPartial).toBe(true);
    });

    it('newOnly តាម runSheetImport ៖ ចំនួន added របស់អ្នកសរសេរចូលដល់ការបំពេញតារាង', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => PREPARED(FULL_MAP)));
        sheetFile([['Waybill', 'DOD', 'COD', 'Phone'], ['X1', 0, 20, '013'], ['Y1', 0, 8, '014']]);
        await applySheetImportHeaderRow();
        table([{ barcode: 'A1', dod: 0, cod: 1, phone: '011' }], T0, false);
        vi.stubGlobal('fetch', vi.fn(async () => json({ ok: true, data: { added: 1, updated: 0, unchanged: 1, rowsAfter: 3, sheetName: 'Customers' } })));
        setFieldValue('siModeSel', 'newOnly');
        await runSheetImport();
        expect(findCustomerDataTableRow('X1')).toBeNull();
    });

    it('លេខទូរស័ព្ទគ្មានខ្ទង់លេខ ➜ តារាងក្នុងឧបករណ៍ឆ្លើយដូចអ្នកអាន Sheet (ទទេ)', () => {
        const reader = createContext({});
        runInContext(readFileSync(resolve(__dirname, '../../zto-import/google-sheets-api/Code.gs'), 'utf8'), reader);
        const phones = ['N/A', '—', 'គ្មាន', '-', '012 345 678', 12345678, ''];
        const seeded = normalizeImportedCustomerRows(phones.map((phone, i) => ['P' + i, 0, 1, phone])).map((row: any) => row.phone);
        expect(seeded).toEqual(phones.map((phone) => runInContext('phoneText', reader)(phone)));
        expect(seeded[0]).toBe('');
    });
});

describe('នាំចូល Excel ៖ Column «— មិនប្រើ —» ជាមួយ «បន្ថែមថ្មី + កែអ្វីដែលប្រែ»', () => {
    it('Apps Script នាំចូលប្រាប់ថារក្សា Column (scriptVersion ≥ 3) ➜ ផ្ញើ · តារាងរក្សា DOD/Phone ចាស់', async () => {
        const fetch = vi.fn(async (_url: string, init: any) => (JSON.parse(init.body).action === 'prepare'
            ? PREPARED({ barcode: 0, dod: -1, cod: 1, phone: -1 }, { scriptVersion: 3 })
            : json({ ok: true, data: { added: 0, updated: 1, unchanged: 0, rowsAfter: 1, sheetName: 'Customers' }, scriptVersion: 3 })));
        vi.stubGlobal('fetch', fetch);
        sheetFile([['Waybill', 'COD'], ['BC1', 9]]);
        await applySheetImportHeaderRow();
        table([{ barcode: 'BC1', dod: 2.5, cod: 1, phone: '012000111' }], T0, false);
        setFieldValue('siModeSel', 'upsert');
        await runSheetImport();
        expect(importCalls(fetch)).toHaveLength(1);
        expect(findCustomerDataTableRow('BC1')).toMatchObject({ dod: 2.5, cod: 9, phone: '012000111' });
    });

    it('Apps Script មិនប្រាប់កំណែ ឬកំណែ 2 ➜ បដិសេធមុនផ្ញើ ហើយសារប្រាប់ពីការ Deploy', async () => {
        for (const extra of [{}, { scriptVersion: 2 }]) {
            const fetch = vi.fn(async () => PREPARED({ barcode: 0, dod: -1, cod: 1, phone: -1 }, extra));
            vi.stubGlobal('fetch', fetch);
            sheetFile([['Waybill', 'COD'], ['BC1', 9]]);
            await applySheetImportHeaderRow();
            setFieldValue('siModeSel', 'upsert');
            await runSheetImport();
            expect(importCalls(fetch)).toHaveLength(0);
            expect(JSON.stringify(uiState.sheetImportView)).toMatch(/Deploy Code\.gs/);
        }
    });
});

describe('នាំចូល Excel ៖ ចម្លើយបរាជ័យដែលអាចមកក្រោយការសរសេរ', () => {
    async function importWith(reply: () => Response, action: 'import' | 'clear' = 'import') {
        vi.stubGlobal('fetch', vi.fn(async () => PREPARED(FULL_MAP)));
        sheetFile([['Waybill', 'DOD', 'COD', 'Phone'], ['BC1', 0, 3, '012']]);
        await applySheetImportHeaderRow();
        table([{ barcode: 'BC1', dod: 0, cod: 1, phone: '012' }], T0);
        vi.stubGlobal('fetch', vi.fn(async () => reply()));
        setFieldValue('siModeSel', 'upsert');
        if (action === 'clear') await runSheetImportClear();
        else await runSheetImport();
        return JSON.stringify(uiState.sheetImportView);
    }

    it.each([
        ['ok:false គ្មាន written (Apps Script មិនប្រាប់)', () => json({ ok: false, error: 'This action would increase the number of cells' })],
        ['ok:false written:true', () => json({ ok: false, error: 'flush failed', written: true })],
        ['HTTP 502', () => new Response('bad gateway', { status: 502 })],
        ['HTML 200', () => new Response('<html>error</html>', { status: 200 })],
        ['ok:true គ្មាន data', () => json({ ok: true })]
    ])('%s ➜ «មិនទាន់ដឹងលទ្ធផល» · តារាងបោះចោល', async (_label, reply) => {
        for (const action of ['import', 'clear'] as const) {
            const view = await importWith(reply, action);
            expect(view).toMatch(/មិនទាន់ដឹងលទ្ធផល/);
            expect(view).not.toMatch(/❌/);
            expect(lookupState.customerDataTableRows).toBeNull();
        }
    });

    it('ok:false written:false (បដិសេធមុនសរសេរ) ➜ ❌ ច្បាស់ · តារាងនៅដដែល', async () => {
        const view = await importWith(() => json({ ok: false, error: 'ពាក្យសម្ងាត់មិនត្រឹមត្រូវ', written: false }));
        expect(view).toMatch(/ពាក្យសម្ងាត់មិនត្រឹមត្រូវ/);
        expect(view).not.toMatch(/មិនទាន់ដឹងលទ្ធផល/);
        expect(findCustomerDataTableRow('BC1')).toMatchObject({ cod: 1 });
    });
});
