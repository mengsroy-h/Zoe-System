/**
 * ⛔ ZTO-E4 ៖ ជួរ «ចុះហត្ថលេខា» ដែលអត្ថបទប្រភេទស្កេនផ្ទុយ មិនត្រូវបាត់ស្ងាត់។
 *
 * Function បដិសេធជួរដែលមានកូដ «ចុះហត្ថលេខា» (`05`) តែ `scanTypeDesc` ខុសពី `ZTO_LIST_SIGNED_SCAN_DESC` (ឧ. ZTO ផ្ញើ «Delivered»)
 * ➜ ជួរនោះមិនមែនភស្តុតាងបិទ (ច្បាប់ «ភស្តុតាងវិជ្ជមាន» នៅដដែល) ➜ កញ្ចប់ដែលអតិថិជនយករួចនៅបើក ហើយក្រោយ ៧ ថ្ងៃត្រូវដកលុយជា «ផុតកំណត់»។
 * មុនកែ ៖ Function រាប់វាក្នុង `otherScans` ស្ងាត់ៗ ហើយ App មិននិយាយអ្វីសោះ។
 *
 * ១. ប្រអប់បញ្ជី ZTO ៖ ទំព័រដែលទាញបានរាយ `signedMismatch` (ជួររបស់ទំព័រ) + `signedListMismatch` (សំណើ «ចុះហត្ថលេខា» ដែលភ្ជាប់)
 *    ➜ សារបង្ហាញបន្ទាត់ ⚠️ ជាមួយចំនួនសរុបពីគ្រប់ទំព័រ។ ទិសផ្ទុយ ៖ ០ ➜ គ្មានបន្ទាត់។
 * ២. ជុំបិទតាម ZTO (`signed=1`) ៖ `fetchZtoSignedCodes()` ផ្ទុកចំនួនសរុប (មិនមែន toast)។
 * ៣. 🩺 ជួរ ZTO ៖ `?diag=1` រាយ `list.signedMismatch.observed` ➜ ⚠️ + ព័ត៌មាន · ⛔ មិនប្តូរសាលក្រម Cookie ទៅ ❌ ·
 *    Cookie ដែល ZTO បដិសេធ នៅ ❌ ដដែល · ទិសផ្ទុយ ៖ មិនទាន់ឃើញ ➜ ✅ ដដែល។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { refTo } from '../src/app/refs';
import { dataState, firebaseState, uiState, ztoState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import { appLocalStore } from '../src/core/storage';
import { clearCustomerDataTableCache } from '../src/features/customer-table';
import { fetchZtoSignedCodes, runZtoListSyncPreview, ztoListPositiveCount } from '../src/features/zto-list-sync';
import { clearZtoPickupStatusStore } from '../src/features/zto-status';
import { healthLookupRow, ztoSignedMismatchText } from '../src/features/health-check';

vi.mock('../src/features/barcode-ops', () => ({
    openViewListModal: () => {},
    removeSingleBarcode: async () => 'failed',
    toggleIndividualBarcodeClose: async () => false,
    openEditBarcodePriceModal: () => {},
    closeEditBarcodeModal: () => {},
    saveEditedBarcodePrice: () => {},
    applyBarcodeCloseChange: async () => true
}));

const NOW = Date.UTC(2026, 9, 6, 3, 0, 0);
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const CFG = { enabled: true, fastMode: true, url: 'https://example.invalid/.netlify/functions/zto-order-detail?barcode={barcode}' };

function row(barcode: string) {
    return { barcode, phone: '0963897345', cod: 2.5, dod: 0, at: '2026-10-05 09:00:00', ztoClosed: null, skip: '' };
}

function listBody(extra: any) {
    return Object.assign({ success: true, list: true, enabled: true, rows: [], pages: 1, total: 0, otherScans: 0, signedScans: 0, signed: [], signedOk: true }, extra);
}

function mismatchNote() {
    return String(viewState.ztoListSyncNote || '').split(' · ').filter((part) => part.indexOf('ZTO_LIST_SIGNED_SCAN_DESC') !== -1);
}

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(NOW));
    appLocalStore.clear();
    appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify(CFG));
    appLocalStore.setItem('zoew_zto_listsync_v1', '1');
    clearCustomerDataTableCache();
    clearZtoPickupStatusStore();
    ztoState.ztoListSyncInFlight = false;
    ztoState.ztoListSyncResult = null;
    dataState.scanHistory = [];
    dataState.deletedItems = [];
    uiState.isModalOpen = false;
    uiState.toasts = [];
    viewState.ztoListSyncNote = '';
    firebaseState.authGeneration++;
    firebaseState.auth = { currentUser: { uid: 'audit-user' } } as any;
    firebaseState.db = { audit: true } as any;
    firebaseState.fb = { getIdTokenResult: async () => ({ token: 'audit-token' }) } as any;
    for (const name of ['ztoListSyncFrom', 'ztoListSyncTo'] as const) {
        const input = document.createElement('input');
        input.value = name === 'ztoListSyncFrom' ? '2026-10-03' : '2026-10-06';
        refTo(name)(input);
    }
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    appLocalStore.clear();
    refTo('ztoListSyncFrom')(null);
    refTo('ztoListSyncTo')(null);
});

describe('ប្រអប់បញ្ជី ZTO ៖ ជួរ «ចុះហត្ថលេខា» ដែលអត្ថបទផ្ទុយ ➜ ⚠️', () => {
    it('ចំនួនសរុបពីគ្រប់ទំព័រ (ទំព័រ ១ · ទំព័រ ២ `withSigned` · ទំព័រ ៣ `signed=1`) ➜ បន្ទាត់ ⚠️ ១ ជាមួយលេខ', async () => {
        const fetch = vi.fn(async (url: string) => {
            const u = new URL(url);
            const page = Number(u.searchParams.get('page'));
            if (u.searchParams.get('signed') === '1') {
                return json(listBody({ kind: 'signed', page, pages: 3, signedMismatch: 4 }));
            }
            return json(listBody({ page, pages: 2, total: 2, rows: [row('ZT000000000' + page)], signedPages: 3,
                signedMismatch: page === 1 ? 1 : 0, signedListMismatch: page === 1 ? 2 : 3 }));
        });
        vi.stubGlobal('fetch', fetch);
        await runZtoListSyncPreview();
        expect(fetch).toHaveBeenCalledTimes(3);
        expect(ztoState.ztoListSyncResult.signedMismatch).toBe(10);
        const lines = mismatchNote();
        expect(lines).toHaveLength(1);
        expect(lines[0]).toContain('⚠️');
        expect(lines[0]).toContain('10');
        expect(lines[0]).toContain('«ចុះហត្ថលេខា»');
    });

    it('⛔ E9 ៖ បន្ទាត់ ⚠️ បង្ហាញអត្ថបទដែល Function ទទួលពី ZTO និងអត្ថបទដែល Server រំពឹង ជាមួយកូដតួអក្សរ (តួអក្សរមើលមិនឃើញក៏ឃើញ)', async () => {
        const fetch = vi.fn(async (url: string) => {
            const u = new URL(url);
            const page = Number(u.searchParams.get('page'));
            if (u.searchParams.get('signed') === '1') {
                return json(listBody({ kind: 'signed', page, pages: 2, signedMismatch: 1, signedMismatchTexts: ['Delivered', 42, null, 'x'.repeat(90)],
                    signedDescExpected: ['ចុះហត្ថលេខា', '签收', 'Signed'] }));
            }
            return json(listBody({ page, pages: 1, total: 1, rows: [row('ZT0000000001')], signedPages: 2,
                signedMismatch: 1, signedMismatchTexts: ['Delivered'], signedListMismatch: 1, signedListMismatchTexts: ['Deliv\u200Bery'],
                signedDescExpected: ['ចុះហត្ថលេខា', '签收', 7, 'Signed'] }));
        });
        vi.stubGlobal('fetch', fetch);
        await runZtoListSyncPreview();
        expect(ztoState.ztoListSyncResult.signedMismatchTexts).toEqual(['Delivered', 'Deliv\u200Bery', 'x'.repeat(64)]);
        expect(ztoState.ztoListSyncResult.signedDescExpected).toEqual(['ចុះហត្ថលេខា', '签收', 'Signed']);
        const lines = mismatchNote();
        expect(lines).toHaveLength(1);
        expect(lines[0]).toContain('«Delivered» (U+0044 0065 006C 0069 0076 0065 0072 0065 0064)');
        expect(lines[0]).toContain('200B');
        expect(lines[0]).toContain('«Signed» (U+0053 0069 0067 006E 0065 0064)');
        expect(lines[0]).toContain('«ចុះហត្ថលេខា» (U+1785 17BB 17C7 17A0 178F 17D2 1790 179B 17C1 1781 17B6)');
        expect(lines[0]).toContain('«签收» (U+7B7E 6536)');
        expect(lines[0]).toContain('ZTO_LIST_SIGNED_SCAN_DESC');
    });

    it('⛔ E10 ៖ Function ចាស់ផ្ញើអត្ថបទរំពឹងជា string មួយ ➜ App ទទួលជាបញ្ជីមួយធាតុ · តម្លៃខូច ➜ បញ្ជីទទេ (មិនបោះ)', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => json(listBody({ total: 1, rows: [row('ZT0000000001')], signedPages: 1,
            signedMismatch: 1, signedMismatchTexts: ['Delivered'], signedDescExpected: 'ចុះហត្ថលេខា' }))));
        await runZtoListSyncPreview();
        expect(ztoState.ztoListSyncResult.signedDescExpected).toEqual(['ចុះហត្ថលេខា']);
        expect(mismatchNote()[0]).toContain('≠ Server រំពឹង «ចុះហត្ថលេខា»');
        for (const junk of [undefined, null, 5, {}, '', [null, 3]]) {
            vi.stubGlobal('fetch', vi.fn(async () => json(listBody({ total: 1, rows: [row('ZT0000000001')], signedPages: 1,
                signedMismatch: 1, signedMismatchTexts: ['Delivered'], signedDescExpected: junk }))));
            await runZtoListSyncPreview();
            expect(ztoState.ztoListSyncResult.signedDescExpected, JSON.stringify(junk)).toEqual([]);
            expect(mismatchNote()[0], JSON.stringify(junk)).not.toContain('≠');
        }
    });

    it('ទិសផ្ទុយ ៖ គ្មានអត្ថបទផ្ទុយ (`0` ឬគ្មានវាល — Function ចាស់) ➜ គ្មានបន្ទាត់ ⚠️ នោះ', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => json(listBody({ total: 1, rows: [row('ZT0000000001')], signedPages: 1, signedMismatch: 0, signedListMismatch: 0 }))));
        await runZtoListSyncPreview();
        expect(ztoState.ztoListSyncResult.signedMismatch).toBe(0);
        expect(mismatchNote()).toEqual([]);
        vi.stubGlobal('fetch', vi.fn(async () => json(listBody({ total: 1, rows: [row('ZT0000000001')], signedPages: 1 }))));
        await runZtoListSyncPreview();
        expect(mismatchNote()).toEqual([]);
        expect(String(viewState.ztoListSyncNote)).not.toContain('NaN');
    });

    it('ជួរ «ចុះហត្ថលេខា» ផ្ទុយក្នុងបញ្ជីមកដល់តែម្យ៉ាង (`signedMismatch` របស់ទំព័រ) ក៏បង្ហាញដែរ', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => json(listBody({ total: 1, rows: [row('ZT0000000001')], signedPages: 1, signedMismatch: 1, signedListMismatch: 0 }))));
        await runZtoListSyncPreview();
        const lines = mismatchNote();
        expect(lines).toHaveLength(1);
        expect(lines[0]).toContain('1');
    });
});

describe('ជុំបិទតាម ZTO (`signed=1`) ៖ ផ្ទុកចំនួន (គ្មាន toast)', () => {
    it('`fetchZtoSignedCodes()` បូក `signedMismatch` ពីគ្រប់ទំព័រ', async () => {
        vi.stubGlobal('fetch', vi.fn(async (url: string) => {
            const page = Number(new URL(url).searchParams.get('page'));
            return json(listBody({ kind: 'signed', page, pages: 2, signed: ['ZT00000001' + page + '0'], signedMismatch: page === 1 ? 2 : 5 }));
        }));
        const out: any = await fetchZtoSignedCodes(CFG, '2026-10-03', '2026-10-06');
        expect(out.measured).toBe(true);
        expect(out.codes).toEqual(['ZT0000000110', 'ZT0000000120']);
        expect(out.signedMismatch).toBe(7);
        expect(uiState.toasts).toEqual([]);
    });

    it('ទិសផ្ទុយ ៖ គ្មានវាល (Function ចាស់) ➜ `0`', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => json(listBody({ kind: 'signed', signed: ['ZT0000000110'] }))));
        const out: any = await fetchZtoSignedCodes(CFG, '2026-10-03', '2026-10-06');
        expect(out.signedMismatch).toBe(0);
    });

    it('⛔ តម្លៃខូច (`1e999` ➜ Infinity · អវិជ្ជមាន · អក្សរ · null) មិនក្លាយជាចំនួន · មិនបោះ', async () => {
        for (const junk of [undefined, null, NaN, Infinity, -Infinity, -3, 0, 'x', {}, []]) {
            expect(ztoListPositiveCount(junk), String(junk)).toBe(0);
        }
        expect(ztoListPositiveCount(2)).toBe(2);
        expect(ztoListPositiveCount('2')).toBe(2);
        vi.stubGlobal('fetch', vi.fn(async () => new Response('{"success":true,"list":true,"enabled":true,"kind":"signed","rows":[],"pages":1,'
            + '"signed":["ZT0000000110"],"signedOk":true,"signedMismatch":1e999}', { status: 200 })));
        const out: any = await fetchZtoSignedCodes(CFG, '2026-10-03', '2026-10-06');
        expect(out.signedMismatch).toBe(0);
    });
});

describe('🩺 ជួរ ZTO ៖ `?diag=1` រាយជួរ «ចុះហត្ថលេខា» ផ្ទុយ ➜ ⚠️ (មិនមែន ❌)', () => {
    const diag = (cookie: any, signedMismatch?: any) => vi.fn(async () => json({
        ok: true, code: 'ZTO_DIAG',
        cookie: Object.assign({ source: 'blob', fingerprint: 'a1b2c3d4', ageMs: 60000 }, cookie),
        list: signedMismatch === undefined ? { enabled: true } : { enabled: true, signedMismatch }
    }));

    it('Cookie ទទួលយក + ឃើញអត្ថបទផ្ទុយ ➜ ⚠️ · ព័ត៌មានមានចំនួន · Cookie នៅ «ZTO ទទួលយក»', async () => {
        vi.stubGlobal('fetch', diag({ authAcceptedAgeMs: 3000 }, { observed: true, count: 3, ageMs: 120000 }));
        const out = await healthLookupRow();
        expect(out.state).toBe('warn');
        expect(out.detail).toContain('ZTO ទទួលយក');
        expect(out.detail).toContain('ZTO_LIST_SIGNED_SCAN_DESC');
        expect(out.detail).toContain('3');
        expect(out.detail).toContain('2 នាទី');
    });

    it('ទិសផ្ទុយ ៖ មិនទាន់ឃើញ (`observed:false` · គ្មានវាល · តម្លៃខូច) ➜ ✅ ដដែល · គ្មានព័ត៌មាននោះ', async () => {
        for (const signal of [{ observed: false, count: 0, ageMs: null }, undefined, null, 'x', { observed: 'yes', count: 3 }, { observed: true, count: 0 }]) {
            vi.stubGlobal('fetch', diag({ authAcceptedAgeMs: 3000 }, signal));
            const out = await healthLookupRow();
            expect(out.state, JSON.stringify(signal)).toBe('ok');
            expect(out.detail, JSON.stringify(signal)).not.toContain('ZTO_LIST_SIGNED_SCAN_DESC');
        }
    });

    it('⛔ Cookie ដែល ZTO បដិសេធ នៅ ❌ ដដែល (ព័ត៌មានបន្ថែមមិនបន្ទន់សាលក្រម)', async () => {
        vi.stubGlobal('fetch', diag({ authRejectedAgeMs: 4000 }, { observed: true, count: 3, ageMs: 1000 }));
        const out = await healthLookupRow();
        expect(out.state).toBe('bad');
        expect(out.detail).toContain('ZTO_LIST_SIGNED_SCAN_DESC');
    });

    it('Cookie មិនទាន់ប្រើ + ឃើញអត្ថបទផ្ទុយ ➜ ⚠️ ដដែល ព្រមទាំងព័ត៌មាន · `ageMs` មិនស្គាល់ ➜ គ្មាន «ចុងក្រោយ»', async () => {
        vi.stubGlobal('fetch', diag({}, { observed: true, count: 2, ageMs: null }));
        const out = await healthLookupRow();
        expect(out.state).toBe('warn');
        expect(out.detail).toContain('ZTO_LIST_SIGNED_SCAN_DESC');
        expect(out.detail).not.toContain('(ចុងក្រោយ');
    });

    it('⛔ `ztoSignedMismatchText()` ៖ តម្លៃខូចគ្រប់រូបរាង ➜ `\'\'` (មិនបោះ · គ្មាន NaN/Infinity)', () => {
        const junk = [undefined, null, NaN, 'x', 42, [], {}, { list: null }, { list: 'x' }, { list: [] }, { list: { signedMismatch: null } },
            { list: { signedMismatch: 'x' } }, { list: { signedMismatch: [] } }, { list: { signedMismatch: { observed: true } } },
            { list: { signedMismatch: { observed: true, count: 'x' } } }, { list: { signedMismatch: { observed: true, count: -2 } } },
            { list: { signedMismatch: { observed: true, count: NaN } } }, { list: { signedMismatch: { observed: true, count: Infinity } } }];
        for (const body of junk) expect(ztoSignedMismatchText(body), JSON.stringify(body)).toBe('');
        const text = ztoSignedMismatchText({ list: { signedMismatch: { observed: true, count: 4, ageMs: 3 * 3600000 } } });
        expect(text).toContain('4');
        expect(text).toContain('3 ម៉ោង');
    });

    it('⛔ E9 ៖ 🩺 បង្ហាញអត្ថបទដែល Function ទទួលពី ZTO (`texts`) និងអត្ថបទដែល Server រំពឹង (`expected`) ជាមួយកូដតួអក្សរ · តម្លៃខូចមិនបោះ', () => {
        const text = ztoSignedMismatchText({ list: { signedMismatch: { observed: true, count: 66, ageMs: 60000,
            texts: ['Delivered', 7, null, 'Deliv\u200Bery'], expected: ['ចុះហត្ថលេខា', '签收', 'Signed'] } } });
        expect(text).toContain('«Delivered» (U+0044 0065 006C 0069 0076 0065 0072 0065 0064)');
        expect(text).toContain('«Signed» (U+0053 0069 0067 006E 0065 0064)');
        expect(text).toContain('200B');
        expect(text).toContain('«ចុះហត្ថលេខា» (U+1785 17BB 17C7 17A0 178F 17D2 1790 179B 17C1 1781 17B6)');
        expect(text).toContain('«签收» (U+7B7E 6536)');
        expect(ztoSignedMismatchText({ list: { signedMismatch: { observed: true, count: 1, ageMs: null, texts: ['Delivered'], expected: 'ចុះហត្ថលេខា' } } }))
            .toContain('≠ Server រំពឹង «ចុះហត្ថលេខា»');
        for (const texts of [undefined, null, 'x', 42, {}, [null, 3]]) {
            const plain = ztoSignedMismatchText({ list: { signedMismatch: { observed: true, count: 2, ageMs: null, texts, expected: 5 } } });
            expect(plain, JSON.stringify(texts)).toContain('ZTO_LIST_SIGNED_SCAN_DESC');
            expect(plain).not.toContain('(U+');
        }
    });
});
