/**
 * ⛔ ZTO-G2 ៖ ទាញបញ្ជីពី ZTO ៖ ការផ្ទៀងអត្តសញ្ញាណ **បរាជ័យបណ្តោះអាសន្ន** ≠ «គណនីគ្មានសាខា»។ Function ឆ្លើយ `enabled:false` + `reason`
 *    `idtoken:certs` (ទាញ certs Google មិនបាន) · `idtoken:expired`/`idtoken:future` (token ផុត · នាឡិកា) · `idtoken:kid-unknown` · ហើយ App ខ្លួនឯង
 *    យក ID token មិនបានក្នុង ៨ វិ. (`idtoken:missing` ពេលកំពុងចូលប្រព័ន្ធ) ➜ មុនកែ ៖ «🏢 គណនីនេះគ្មានលេខសាខា ZTO — សូមទាក់ទងអ្នកគ្រប់គ្រងប្រព័ន្ធ»
 *    (អ្នកប្រើទាក់ទងអ្នកលក់ ខណៈគ្រាន់តែត្រូវសាកម្តងទៀត)។ ឥឡូវ ៖ «⚠️ ផ្ទៀងផ្ទាត់គណនីជាមួយ Server មិនបាន — សូមសាកម្ដងទៀត»។ ការកំណត់ Server ខុស
 *    (`idtoken:aud` · `idtoken:iss` · `idtoken:project-unset`) ➜ «មុខងារបញ្ជីមិនទាន់កំណត់នៅ Netlify (reason)»។
 *    ទិសផ្ទុយ ៖ `site:no-account` · `site:missing` · `site:invalid` ➜ «គ្មានលេខសាខា» ដដែល។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { refTo } from '../src/app/refs';
import { dataState, firebaseState, uiState, ztoState } from '../src/core/state';
import { viewState } from '../src/core/view-state';
import { appLocalStore } from '../src/core/storage';
import { clearCustomerDataTableCache } from '../src/features/customer-table';
import { runZtoListSyncPreview } from '../src/features/zto-list-sync';

const NO_BRANCH = 'គ្មានលេខសាខា';
const RETRY = 'សាកម្ដងទៀត';

beforeEach(() => {
    appLocalStore.clear();
    appLocalStore.setItem('zoew_lookup_api_config', JSON.stringify({ enabled: true, fastMode: true,
        url: 'https://example.invalid/.netlify/functions/zto-order-detail?barcode={barcode}' }));
    appLocalStore.setItem('zoew_zto_listsync_v1', '1');
    clearCustomerDataTableCache();
    ztoState.ztoListSyncInFlight = false;
    ztoState.ztoListSyncResult = null;
    dataState.scanHistory = [];
    dataState.deletedItems = [];
    uiState.isModalOpen = false;
    uiState.toasts = [];
    viewState.ztoListSyncNote = '';
    firebaseState.authGeneration++;
    firebaseState.auth = { currentUser: { uid: 'audit-user' } } as any;
    firebaseState.fb = { getIdTokenResult: async () => ({ token: 'audit-token' }) } as any;
    for (const name of ['ztoListSyncFrom', 'ztoListSyncTo'] as const) {
        const input = document.createElement('input');
        input.value = '2026-09-27';
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

async function pullWithReason(reason: string) {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
        success: false, list: true, enabled: false, code: 'ZTO_LIST_NOT_CONFIGURED', reason
    }), { status: 200 })));
    await runZtoListSyncPreview();
    return { note: String(viewState.ztoListSyncNote || ''), toasts: uiState.toasts.map((t: any) => String(t.msg)) };
}

describe('ZTO-G2 ៖ ការផ្ទៀងអត្តសញ្ញាណបរាជ័យបណ្តោះអាសន្ន ≠ គ្មានសាខា', () => {
    for (const reason of ['idtoken:certs', 'idtoken:expired', 'idtoken:future', 'idtoken:kid-unknown', 'idtoken:supabase-unreachable']) {
        it('⛔ ' + reason + ' ➜ «សាកម្ដងទៀត» មិនមែន «គ្មានលេខសាខា»', async () => {
            const out = await pullWithReason(reason);
            expect(out.note).not.toContain(NO_BRANCH);
            expect(out.note).toContain(RETRY);
        });
    }

    it('⛔ App យក ID token មិនបាន (ព្យួរ ៨ វិ.) ខណៈកំពុងចូលប្រព័ន្ធ ➜ «សាកម្ដងទៀត» មិនមែន «គ្មានលេខសាខា»', async () => {
        vi.useFakeTimers();
        const fetch = vi.fn(async () => new Response('{}', { status: 200 }));
        vi.stubGlobal('fetch', fetch);
        firebaseState.fb = { getIdTokenResult: () => new Promise(() => {}) } as any;
        const run = runZtoListSyncPreview();
        await vi.advanceTimersByTimeAsync(9000);
        await run;
        expect(fetch).not.toHaveBeenCalled();
        expect(String(viewState.ztoListSyncNote)).not.toContain(NO_BRANCH);
        expect(String(viewState.ztoListSyncNote)).toContain(RETRY);
    });

    for (const reason of ['idtoken:aud', 'idtoken:iss', 'idtoken:project-unset']) {
        it('⛔ ' + reason + ' (Server កំណត់ខុស) ➜ «មិនទាន់កំណត់នៅ Netlify» មិនមែន «គ្មានលេខសាខា»', async () => {
            const out = await pullWithReason(reason);
            expect(out.note).not.toContain(NO_BRANCH);
            expect(out.note).toContain('Netlify');
            expect(out.note).toContain(reason);
        });
    }

    for (const reason of ['site:no-account', 'site:missing', 'site:invalid']) {
        it('ទិសផ្ទុយ ៖ ' + reason + ' ➜ «គ្មានលេខសាខា» ដដែល', async () => {
            const out = await pullWithReason(reason);
            expect(out.note).toContain(NO_BRANCH);
        });
    }
});
