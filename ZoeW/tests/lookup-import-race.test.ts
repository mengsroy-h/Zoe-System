import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fieldValue, refTo } from '../src/app/refs';
import { lookupState, scanState, uiState } from '../src/core/state';
import { appLocalStore } from '../src/core/storage';
import { viewState } from '../src/core/view-state';
import { attemptAutoLookup, autoLookupInFlight, getFastLookupRow } from '../src/features/auto-lookup';
import { getLookupApiConfig } from '../src/features/lookup-config';
import { clearCustomerDataTableCache, fetchCustomerDataTableRows, findCustomerDataTableRow, lookupsSupersededByImport, seedCustomerTableFromImport } from '../src/features/customer-table';

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((yes) => { resolve = yes; });
    return { promise, resolve };
}

const BARCODE = 'SCAN123456';
const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
const lookupBody = { success: true, phone: '012345678', cod: 7.5, dod: 1.25 };
const importRows = [['IMPORTED0001', 0, 3, '098765432'], ['IMPORTED0002', 0, 4, '097654321']];
const modalFields = ['modalPhoneInput', 'modalCodInput', 'modalDodInput'] as const;

function openScanModal(barcode: string) {
    scanState.pendingBarcode = barcode;
    uiState.isModalOpen = true;
}

function startLookupWithPendingFetch() {
    const pending = deferred<Response>();
    const fetch = vi.fn((url: string) => (String(url).indexOf('list=1') !== -1
        ? new Promise<Response>(() => {})
        : pending.promise));
    vi.stubGlobal('fetch', fetch);
    const running = attemptAutoLookup(BARCODE);
    return { pending, fetch, running };
}

beforeEach(() => {
    appLocalStore.clear();
    appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ enabled: true,
        url: 'https://lookup.example.invalid/api?code={barcode}', phoneField: 'phone', codField: 'cod', dodField: 'dod' }));
    clearCustomerDataTableCache();
    viewState.lookupStatus = null as any;
    for (const name of modalFields) refTo(name)(document.createElement('input'));
    openScanModal(BARCODE);
});

afterEach(() => {
    vi.unstubAllGlobals();
    clearCustomerDataTableCache();
    for (const name of modalFields) refTo(name)(null);
    scanState.pendingBarcode = '';
    uiState.isModalOpen = false;
    appLocalStore.clear();
});

describe('Lookup កំពុងរត់ ៖ នាំចូល Sheet បញ្ចប់ពីក្រោយ', () => {
    it('នាំចូលចូលមកពេល Lookup កំពុងរត់ ➜ ចម្លើយនៅតែបំពេញ ហើយស្ថានភាពមិនជាប់ «កំពុងស្វែងរក»', async () => {
        const { pending, fetch, running } = startLookupWithPendingFetch();
        await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
        expect(viewState.lookupStatus.kind).toBe('lookup-status-loading');
        expect(seedCustomerTableFromImport(importRows, 'upsert', 2)).toBe(true);
        pending.resolve(json(lookupBody));
        await running;
        expect(viewState.lookupStatus.kind).toBe('lookup-status-success');
        expect(fieldValue('modalPhoneInput')).toBe('012345678');
        expect(fieldValue('modalCodInput')).toBe('7.5');
        expect(fieldValue('modalDodInput')).toBe('1.25');
        expect(autoLookupInFlight.size).toBe(0);
    });

    it.each(['upsert', 'replace'] as const)('ព្រំដែនទទួលយក «អានមុននាំចូល» (%s) ៖ ផ្ទាំងស្កេនបង្ហាញតម្លៃដែល Sheet មានពេលសំណើ Lookup ចេញ · តារាង និង cache Fast Mode នៅតែជាតម្លៃនាំចូល', async (mode) => {
        appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ enabled: true, fastMode: true,
            url: 'https://lookup.example.invalid/api?code={barcode}', phoneField: 'phone', codField: 'cod', dodField: 'dod' }));
        const cfg = getLookupApiConfig();
        lookupState.customerDataTableRows = [{ barcode: 'OTHER0001', phone: '011000222', cod: 1, dod: 0 }];
        lookupState.customerDataTableFetchedAt = Date.now();
        const { pending, fetch, running } = startLookupWithPendingFetch();
        await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
        expect(seedCustomerTableFromImport([[BARCODE, 0, 20, '012345678'], ...importRows], mode, mode === 'replace' ? 3 : 4)).toBe(true);
        pending.resolve(json(lookupBody));
        await running;
        expect(viewState.lookupStatus.kind).toBe('lookup-status-success');
        // ព្រំដែនទទួលយក (មិនមែនកំហុស) ៖ សំណើបានអាន Sheet មុនការនាំចូលសរសេរ ➜ ផ្ទាំងបង្ហាញតម្លៃ COD ចាស់ 7.5 ហើយ autoSubmit
        // រក្សាទុកវា ដូចការស្កេនមុនការនាំចូលបន្តិច ឬនៅលើឧបករណ៍ផ្សេង · ចំណុចកែនៅក្នុង auto-lookup.ts (តំបន់ ZTO ចាក់សោ)
        expect(fieldValue('modalCodInput'), 'អានមុននាំចូល ៖ ផ្ទាំងបង្ហាញតម្លៃដែល Sheet មានពេលសំណើចេញ').toBe('7.5');
        expect(autoLookupInFlight.size).toBe(0);
        expect(findCustomerDataTableRow(BARCODE), 'តារាងនៅតែជាតម្លៃនាំចូល').toMatchObject({ cod: 20, phone: '012345678' });
        expect(getFastLookupRow(BARCODE, cfg), 'cache Fast Mode មិនដឹកតម្លៃដែលអានមុននាំចូល').toBeNull();
        for (const name of modalFields) refTo(name)(document.createElement('input'));
        const rescan = vi.fn(async () => json(lookupBody));
        vi.stubGlobal('fetch', rescan);
        await attemptAutoLookup(BARCODE);
        expect(rescan).not.toHaveBeenCalled();
        expect(fieldValue('modalCodInput')).toBe('20');
        lookupState.customerDataTableRows = [];
        lookupState.customerDataTableFetchedAt = Date.now();
        const later = deferred<Response>();
        vi.stubGlobal('fetch', vi.fn((url: string) => (String(url).indexOf('list=1') !== -1 ? new Promise<Response>(() => {}) : later.promise)));
        for (const name of modalFields) refTo(name)(document.createElement('input'));
        const fresh = attemptAutoLookup(BARCODE);
        later.resolve(json(lookupBody));
        await fresh;
        expect(findCustomerDataTableRow(BARCODE)).toMatchObject({ cod: 7.5 });
        expect(getFastLookupRow(BARCODE, cfg)).toMatchObject({ cod: 7.5 });
    });

    it('បញ្ច្រាស ៖ Lookup ដែលការនាំចូលគ្របពីលើ បញ្ចប់ដោយរកមិនឃើញ ➜ Lookup ថ្មីក្រោយមកនៅតែចូលតារាង និង cache Fast Mode', async () => {
        appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ enabled: true, fastMode: true,
            url: 'https://lookup.example.invalid/api?code={barcode}', phoneField: 'phone', codField: 'cod', dodField: 'dod' }));
        const cfg = getLookupApiConfig();
        lookupState.customerDataTableRows = [];
        lookupState.customerDataTableFetchedAt = Date.now();
        const { pending, fetch, running } = startLookupWithPendingFetch();
        await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
        expect(seedCustomerTableFromImport([[BARCODE, 0, 20, '012345678']], 'upsert', 1)).toBe(true);
        pending.resolve(json({ success: false }));
        await running;
        expect(viewState.lookupStatus.kind).toBe('lookup-status-warn');
        lookupState.customerDataTableRows = [];
        lookupState.customerDataTableFetchedAt = Date.now();
        const later = deferred<Response>();
        vi.stubGlobal('fetch', vi.fn((url: string) => (String(url).indexOf('list=1') !== -1 ? new Promise<Response>(() => {}) : later.promise)));
        const fresh = attemptAutoLookup(BARCODE);
        later.resolve(json(lookupBody));
        await fresh;
        expect(fieldValue('modalCodInput')).toBe('7.5');
        expect(findCustomerDataTableRow(BARCODE)).toMatchObject({ cod: 7.5 });
        expect(getFastLookupRow(BARCODE, cfg)).toMatchObject({ cod: 7.5 });
    });

    it('បញ្ច្រាស ៖ នាំចូល barcode ផ្សេង (upsert) ពេល Lookup កំពុងរត់ ➜ ចម្លើយនៅតែចូលតារាង និង cache Fast Mode', async () => {
        appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ enabled: true, fastMode: true,
            url: 'https://lookup.example.invalid/api?code={barcode}', phoneField: 'phone', codField: 'cod', dodField: 'dod' }));
        const cfg = getLookupApiConfig();
        lookupState.customerDataTableRows = [];
        lookupState.customerDataTableFetchedAt = Date.now();
        const { pending, fetch, running } = startLookupWithPendingFetch();
        await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
        expect(seedCustomerTableFromImport(importRows, 'upsert', 2)).toBe(true);
        pending.resolve(json(lookupBody));
        await running;
        expect(findCustomerDataTableRow(BARCODE)).toMatchObject({ cod: 7.5 });
        expect(getFastLookupRow(BARCODE, cfg)).toMatchObject({ cod: 7.5 });
    });

    it('នាំចូល replace ដែលឯកសារគ្មាន barcode កំពុង Lookup ➜ ចម្លើយយឺតមិនបន្ថែមជួរដែល Sheet លែងមាន ឬ cache Fast Mode វិញ', async () => {
        appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ enabled: true, fastMode: true,
            url: 'https://lookup.example.invalid/api?code={barcode}', phoneField: 'phone', codField: 'cod', dodField: 'dod' }));
        const cfg = getLookupApiConfig();
        lookupState.customerDataTableRows = [{ barcode: 'OTHER0001', phone: '011000222', cod: 1, dod: 0 }];
        lookupState.customerDataTableFetchedAt = Date.now();
        const { pending, fetch, running } = startLookupWithPendingFetch();
        await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
        expect(seedCustomerTableFromImport(importRows, 'replace', 2)).toBe(true);
        expect(findCustomerDataTableRow('OTHER0001')).toBeNull();
        expect(findCustomerDataTableRow(BARCODE)).toBeNull();
        pending.resolve(json(lookupBody));
        await running;
        expect(autoLookupInFlight.size).toBe(0);
        expect(findCustomerDataTableRow(BARCODE)).toBeNull();
        expect(getFastLookupRow(BARCODE, cfg)).toBeNull();
        expect(lookupState.customerDataTableRows).toHaveLength(2);
        expect(lookupsSupersededByImport.size).toBe(0);
    });

    it('សញ្ញា «នាំចូលគ្រប» ចាស់ (Lookup ចប់ដោយរកមិនឃើញ) ត្រូវសម្អាតនៅការនាំចូលបន្ទាប់ · សញ្ញារបស់ Lookup ដែលនៅរត់នៅដដែល', async () => {
        lookupState.customerDataTableRows = [];
        lookupState.customerDataTableFetchedAt = Date.now();
        const { pending, fetch, running } = startLookupWithPendingFetch();
        await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
        expect(seedCustomerTableFromImport([[BARCODE, 0, 20, '012345678']], 'upsert', 1)).toBe(true);
        expect(lookupsSupersededByImport.has(BARCODE)).toBe(true);
        expect(seedCustomerTableFromImport([[BARCODE, 0, 21, '012345678']], 'upsert', 1)).toBe(true);
        expect(lookupsSupersededByImport.get(BARCODE), 'Lookup នៅរត់ ➜ សញ្ញានៅ').toBe(autoLookupInFlight.get(BARCODE));
        pending.resolve(json({ success: false }));
        await running;
        expect(autoLookupInFlight.size).toBe(0);
        expect(lookupsSupersededByImport.size, 'Lookup ចប់ដោយមិនហៅ rememberCustomerTableRow ➜ សញ្ញានៅសល់រហូតដល់ការនាំចូលបន្ទាប់').toBe(1);
        expect(seedCustomerTableFromImport(importRows, 'upsert', 3)).toBe(true);
        expect(lookupsSupersededByImport.size, 'ការនាំចូលបន្ទាប់សម្អាតសញ្ញាដែល Lookup របស់វាលែងរត់').toBe(0);
        expect(findCustomerDataTableRow(BARCODE)).toMatchObject({ cod: 21 });
    });

    it('ចាកចេញ · ប្ដូរ Config ក្រោយការនាំចូលគ្រប Lookup ដែលកំពុងរត់ ➜ សញ្ញាត្រូវលុបទាំងអស់ · ចម្លើយរបស់វគ្គថ្មីចូលតារាង និង cache Fast Mode ធម្មតា', async () => {
        appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ enabled: true, fastMode: true,
            url: 'https://lookup.example.invalid/api?code={barcode}', phoneField: 'phone', codField: 'cod', dodField: 'dod' }));
        const cfg = getLookupApiConfig();
        lookupState.customerDataTableRows = [];
        lookupState.customerDataTableFetchedAt = Date.now();
        const old = startLookupWithPendingFetch();
        await vi.waitFor(() => expect(old.fetch).toHaveBeenCalled());
        expect(seedCustomerTableFromImport([[BARCODE, 0, 20, '012345678']], 'upsert', 1)).toBe(true);
        expect(lookupsSupersededByImport.size).toBe(1);
        clearCustomerDataTableCache();
        expect(lookupsSupersededByImport.size, 'clearCustomerDataTableCache() លុបសញ្ញា «នាំចូលគ្រប» ដូច autoLookupFailureAt').toBe(0);
        old.pending.resolve(json(lookupBody));
        await old.running;
        expect(findCustomerDataTableRow(BARCODE)).toBeNull();
        lookupState.customerDataTableRows = [];
        lookupState.customerDataTableFetchedAt = Date.now();
        for (const name of modalFields) refTo(name)(document.createElement('input'));
        const fresh = startLookupWithPendingFetch();
        await vi.waitFor(() => expect(fresh.fetch).toHaveBeenCalled());
        fresh.pending.resolve(json(lookupBody));
        await fresh.running;
        expect(fieldValue('modalCodInput')).toBe('7.5');
        expect(findCustomerDataTableRow(BARCODE)).toMatchObject({ cod: 7.5 });
        expect(getFastLookupRow(BARCODE, cfg)).toMatchObject({ cod: 7.5 });
        expect(lookupsSupersededByImport.size).toBe(0);
    });

    it('បញ្ច្រាស ៖ សម្អាតវគ្គ (ចាកចេញ · ប្ដូរ Config) ពេល Lookup កំពុងរត់ ➜ ចម្លើយចាស់ត្រូវបោះចោល', async () => {
        const { pending, fetch, running } = startLookupWithPendingFetch();
        await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
        clearCustomerDataTableCache();
        pending.resolve(json(lookupBody));
        await running;
        expect(fieldValue('modalPhoneInput')).toBe('');
        expect(fieldValue('modalCodInput')).toBe('');
        expect(fieldValue('modalDodInput')).toBe('');
        expect(findCustomerDataTableRow(BARCODE)).toBeNull();
    });

    it('បញ្ច្រាស ៖ ចម្លើយចាស់ត្រូវបោះចោល តែស្ថានភាពមិនជាប់ «កំពុងស្វែងរក» ជារៀងរហូតពេលផ្ទាំងនៅបើក', async () => {
        const { pending, fetch, running } = startLookupWithPendingFetch();
        await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
        clearCustomerDataTableCache();
        pending.resolve(json(lookupBody));
        await running;
        expect(viewState.lookupStatus.kind).not.toBe('lookup-status-loading');
        expect(viewState.lookupStatus.kind).not.toBe('lookup-status-success');
    });

    it('បញ្ច្រាស ៖ Lookup ចាស់ដែលបរាជ័យក្រោយសម្អាតវគ្គ ➜ ស្ថានភាពមិនជាប់ «កំពុងស្វែងរក»', async () => {
        const { pending, fetch, running } = startLookupWithPendingFetch();
        await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
        clearCustomerDataTableCache();
        pending.resolve(new Response('{}', { status: 404 }));
        await running;
        expect(viewState.lookupStatus.kind).toBe('lookup-status-warn');
        expect(fieldValue('modalPhoneInput')).toBe('');
    });

    it('បញ្ច្រាស ៖ ការបោះចោលចម្លើយចាស់មិនសរសេរពីលើស្ថានភាពរបស់ Lookup ថ្មីសម្រាប់ Barcode ដដែល', async () => {
        const first = deferred<Response>();
        const second = deferred<Response>();
        let calls = 0;
        const fetch = vi.fn((url: string) => {
            if (String(url).indexOf('list=1') !== -1) return new Promise<Response>(() => {});
            calls++;
            return calls === 1 ? first.promise : second.promise;
        });
        vi.stubGlobal('fetch', fetch);
        const runningOld = attemptAutoLookup(BARCODE);
        await vi.waitFor(() => expect(calls).toBe(1));
        clearCustomerDataTableCache();
        const runningNew = attemptAutoLookup(BARCODE);
        await vi.waitFor(() => expect(calls).toBe(2));
        first.resolve(json(lookupBody));
        await runningOld;
        expect(viewState.lookupStatus.kind).toBe('lookup-status-loading');
        second.resolve(json(lookupBody));
        await runningNew;
        expect(viewState.lookupStatus.kind).toBe('lookup-status-success');
        expect(fieldValue('modalPhoneInput')).toBe('012345678');
    });

    it('បញ្ច្រាស ២ ៖ ការទាញតារាងដែលកំពុងរត់ពេលនាំចូលចូលមក មិនសរសេរពីលើជួរដែលនាំចូល', async () => {
        const pendingList = deferred<Response>();
        const fetch = vi.fn(() => pendingList.promise);
        vi.stubGlobal('fetch', fetch);
        const fetching = fetchCustomerDataTableRows(true);
        await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
        expect(seedCustomerTableFromImport(importRows, 'upsert', 2)).toBe(true);
        pendingList.resolve(json({ rows: [{ barcode: 'OLDROW0001', phone: '011111111', cod: 1, dod: 0 }] }));
        await fetching;
        expect(findCustomerDataTableRow('IMPORTED0001')).toMatchObject({ phone: '098765432', cod: 3 });
        expect(findCustomerDataTableRow('IMPORTED0002')).toMatchObject({ phone: '097654321', cod: 4 });
        expect(findCustomerDataTableRow('OLDROW0001')).toBeNull();
        expect(lookupState.customerDataTableRows).toHaveLength(2);
    });

    it('បញ្ច្រាស ២ខ ៖ ការទាញតារាងដែលបរាជ័យក្រោយនាំចូល មិនសម្គាល់តារាងស្រស់ថាបរាជ័យ', async () => {
        const pendingList = deferred<Response>();
        const fetch = vi.fn(() => pendingList.promise);
        vi.stubGlobal('fetch', fetch);
        const fetching = fetchCustomerDataTableRows(true);
        await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
        expect(seedCustomerTableFromImport(importRows, 'upsert', 2)).toBe(true);
        const seededStatus = viewState.customerTableStatus;
        pendingList.resolve(new Response('{}', { status: 404 }));
        await fetching;
        expect(lookupState.customerDataTableLastFailedAt).toBe(0);
        expect(lookupState.customerTableRetryTimer).toBeNull();
        expect(viewState.customerTableStatus).toBe(seededStatus);
        expect(lookupState.customerDataTableRows).toHaveLength(2);
    });

    it('បញ្ច្រាស ៣ ៖ សម្អាតវគ្គពេលការទាញតារាងកំពុងរត់ ➜ ជួរចាស់មិនត្រឡប់មកវិញ', async () => {
        const pendingList = deferred<Response>();
        const fetch = vi.fn(() => pendingList.promise);
        vi.stubGlobal('fetch', fetch);
        const fetching = fetchCustomerDataTableRows(true);
        await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
        clearCustomerDataTableCache();
        pendingList.resolve(json({ rows: [{ barcode: 'OLDROW0001', phone: '011111111', cod: 1, dod: 0 }] }));
        await fetching;
        expect(lookupState.customerDataTableRows).toBeNull();
        expect(findCustomerDataTableRow('OLDROW0001')).toBeNull();
    });

    it('បញ្ច្រាស ៤ ៖ ការទាញចាស់ដែលបញ្ចប់ក្រោយនាំចូល មិនលុបការទាញថ្មីដែលកំពុងរត់', async () => {
        const oldList = deferred<Response>();
        const newList = deferred<Response>();
        let calls = 0;
        const fetch = vi.fn(() => (++calls === 1 ? oldList.promise : newList.promise));
        vi.stubGlobal('fetch', fetch);
        const oldFetch = fetchCustomerDataTableRows(true);
        await vi.waitFor(() => expect(calls).toBe(1));
        expect(seedCustomerTableFromImport(importRows, 'upsert', 2)).toBe(true);
        const newFetch = fetchCustomerDataTableRows(true);
        await vi.waitFor(() => expect(calls).toBe(2));
        const running = lookupState.customerDataTableFetchPromise;
        expect(running).toBeTruthy();
        oldList.resolve(json({ rows: [] }));
        await oldFetch;
        expect(lookupState.customerDataTableFetchPromise).toBe(running);
        newList.resolve(json({ rows: [{ barcode: 'IMPORTED0001', phone: '098765432', cod: 3, dod: 0 }] }));
        await newFetch;
        expect(lookupState.customerDataTableFetchPromise).toBeNull();
        expect(lookupState.customerDataTableRows).toHaveLength(1);
        expect(findCustomerDataTableRow('IMPORTED0002')).toBeNull();
    });
});
