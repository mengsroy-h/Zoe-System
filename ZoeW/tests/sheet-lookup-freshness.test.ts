import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { refTo, setFieldValue } from '../src/app/refs';
import { firebaseState, lookupState, sheetImportState, uiState } from '../src/core/state';
import { appLocalStore } from '../src/core/storage';
import { clearCustomerDataTableCache, fetchCustomerDataTableRows, findCustomerDataTableRow, seedCustomerTableFromImport } from '../src/features/customer-table';
import { CUSTOMER_TABLE_CACHE_MS, CUSTOMER_TABLE_TRUST_MS } from '../src/features/customer-table-prefetch';
import { loadedScriptPromises } from '../src/features/export';
import { applySheetImportHeaderRow, handleSheetImportFile, runSheetImport, runSheetImportClear } from '../src/features/sheet-import';

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
    for (const id of ['siModeSel', 'siHeaderRowInput', 'siFileInput']) refTo(id)(document.createElement('input'));
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
    for (const id of ['siModeSel', 'siHeaderRowInput', 'siFileInput']) refTo(id)(null);
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
        expect(seedCustomerTableFromImport([['BC1', 0, 7, '013'], ['BC2', 0, 8, '014']], 'newOnly', 2)).toBe(true);
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
