/**
 * ⛔ ZTO-E14 លើផ្លូវ Palm (Deep audit ៦ · A215) ៖ គម្រោង Firebase មួយចងសាខាច្រើន (`FIREBASE_PROJECT_IDS=<project>:881859|770022` — `ZTO-SETUP-KH.md` ផ្នែក ៤គ)
 *    ➜ ប្រវត្តិ **តែមួយ** កាន់កញ្ចប់នៃសាខាទាំង ២។ ការអានបញ្ជី «ចុះហត្ថលេខា» Palm (`?palm=1&list=1&signed=1&exact=1`) ប្រើ session Palm
 *    របស់សាខាឧបករណ៍ ➜ ZTO ឆ្លើយតែសាខានោះ ➜ ឧបករណ៍សាខា 881859 កត់ «ពេញលេញ» (`ztoSignedCompleteAt` + សញ្ញាហាង `completeAt`) ➜
 *    `ztoAbandonCleanupIsHeld()` លែងរង់ចាំ ➜ ការសម្អាត ៨ ថ្ងៃដកលុយកញ្ចប់សាខា 770022 ដែល ZTO ចុះហត្ថលេខារួច (ជា «ត្រឡប់»)។
 *    ច្បាប់ (CLAUDE.md «7-day cleanup ↔ ZTO signed list») ៖ «⛔ never «complete» from the caller's branch alone»។
 *    សាខានីមួយៗមានគណនី ZTO Palm ផ្លូវការរបស់ខ្លួន (ម្ចាស់គម្រោង) ➜ Function អានបញ្ជីសាខាដែលចងផ្សេងទៀតតាម **session សាខានោះ** (Blobs
 *    `palm-session/<label>/<សាខា>`) · សាខាណាគ្មាន session ឬអានមិនបាន ➜ 503 (មិន «ពេញលេញ») ➜ ការរង់ចាំនៅការពារលុយ។
 *    App ពិត + Function ពិត (`zto-order-detail-core.cjs` ➜ `_shared/zto-palm.js`) + ZTO Palm ក្លែង (`zto-palm-harness.ts`) + ID token ចុះហត្ថលេខាពិត។
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataState, firebaseState, ztoState } from '../src/core/state';
import { getZoneDateKey } from '../src/core/timezone';
import { cleanupInFlight, runAutomaticCleanupRules } from '../src/domain/cleanup';
import { runZtoStatusSweep } from '../src/features/zto-status';
import { NOW, OTHER_SITE, SITE, fn, fx, identityToken, palmLogin, setupWorld, teardownWorld, useSharedBlobs, world } from './zto-palm-harness';

const h = vi.hoisted(() => ({ calls: [] as any[] }));
vi.mock('../src/features/barcode-ops', () => ({
    openViewListModal: () => {},
    removeSingleBarcode: async () => 'failed',
    toggleIndividualBarcodeClose: async () => false,
    openEditBarcodePriceModal: () => {},
    closeEditBarcodeModal: () => {},
    saveEditedBarcodePrice: () => {},
    applyBarcodeCloseChange: async (itemId: string, code: string, closed: boolean) => {
        h.calls.push({ itemId, code, closed });
        const item = dataState.scanHistory.find((i: any) => i && i.id === itemId);
        const b = item && item.barcodes.find((x: any) => x.code === code);
        if (b) {
            b.isClosed = closed;
            b.closedAt = Date.now();
            item.isClosed = item.barcodes.every((x: any) => x.isClosed);
            if (item.isClosed) item.closedAt = Date.now();
        }
        return true;
    }
}));

const DAY = 86400000;
let tx: string[] = [];

function openItem(id: string, code: string, ageMs: number) {
    return { id, phone: '0960007345', scanDate: getZoneDateKey(NOW - ageMs, 0), isClosed: false, createdAt: NOW - ageMs,
        cod: 3, dod: 0, count: 1, barcode: code, barcodes: [{ code, isClosed: false, cod: 3, dod: 0, createdAt: NOW - ageMs }] };
}

const abandoned = (id: string) => tx.includes('zoew_scan_history_cod_dod/' + id);

function cleanupNow() {
    cleanupInFlight.clear();
    runAutomaticCleanupRules();
}

async function branchWorld(projectBranches: string, siblingLogin = false) {
    await setupWorld('firebase', 'require');
    process.env.FIREBASE_PROJECT_IDS = fx.TEST_PROJECT + ':' + projectBranches;
    fn.resetCachesForTests();
    if (siblingLogin) {
        world.loginSites.set('palm-branch-770022', OTHER_SITE);
        await palmLogin('palm-branch-770022', identityToken('firebase', OTHER_SITE));
    }
    world.parcels = {
        KH7700000001: { tab: '5', isSign: 1, scans: [
            { action: '1', siteCode: 'ORIGIN', time: '2026-09-27 08:00:00' },
            { action: '3', siteCode: OTHER_SITE, time: '2026-09-28 09:00:00' },
            { action: '5', siteCode: OTHER_SITE, time: '2026-10-03 15:30:00' }] },
        KH8818590009: { tab: '4', isSign: 0, scans: [
            { action: '1', siteCode: 'ORIGIN', time: '2026-09-27 08:00:00' },
            { action: '3', siteCode: SITE, time: '2026-09-28 09:00:00' }] }
    };
    const fb: any = firebaseState.fb;
    fb.runTransaction = (ref: { path: string }) => {
        tx.push(ref.path);
        return Promise.reject(Object.assign(new Error('audit: not applied'), { txOutcome: 'not-applied' }));
    };
    firebaseState.serverTimeOffsetMs = 0;
    firebaseState.serverClockTrusted = true;
    firebaseState.isDatabaseConnected = true;
    for (const k of ['ztoSignedCompleteAt', 'ztoSignedCompleteServerAt', 'ztoSignedSweepAt', 'ztoSignedSweepOkAt', 'ztoSignedSweepWaitMs',
        'ztoAbandonHoldSince', 'ztoAbandonCheckedAt', 'ztoStatusLastSweepAt'] as const) (ztoState as any)[k] = 0;
    ztoState.ztoSignedOff = false;
}

beforeEach(() => {
    tx = [];
    h.calls.length = 0;
    cleanupInFlight.clear();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
    teardownWorld();
    firebaseState.db = null as any;
    firebaseState.fb = null as any;
    firebaseState.serverClockTrusted = false;
    firebaseState.isDatabaseConnected = false;
});

describe('ZTO-E14 (Palm) ៖ គម្រោងតែមួយ សាខាច្រើន ៖ បញ្ជីចុះហត្ថលេខា Palm របស់សាខាមួយ ≠ ពេញលេញទូទាំងហាង', () => {
    it('⛔ សាខា 770022 Login គណនីខ្លួន ➜ ឧបករណ៍សាខា 881859 អានបញ្ជីគ្រប់សាខាដែលចង ➜ កញ្ចប់ចុះហត្ថលេខានៅ 770022 បិទ «យករួច» (មិនដកលុយ)', async () => {
        useSharedBlobs();
        await branchWorld(SITE + '|' + OTHER_SITE, true);
        dataState.scanHistory = [openItem('p770', 'KH7700000001', 8 * DAY)];
        cleanupNow();
        expect(abandoned('p770'), 'មុនអានបញ្ជី ➜ រង់ចាំ').toBe(false);
        await runZtoStatusSweep(false);
        expect(world.zto.filter((k) => k.startsWith('list:5')).length, 'អានបញ្ជីចុះហត្ថលេខា ២ សាខា (session ផ្ទាល់ខ្លួនរៀងៗខ្លួន)').toBeGreaterThanOrEqual(2);
        expect(h.calls.map((c) => c.code), 'កញ្ចប់សាខា 770022 ក្នុងបញ្ជីចុះហត្ថលេខា ➜ បិទ «យករួច»').toEqual(['KH7700000001']);
        cleanupNow();
        expect(abandoned('p770'), 'កញ្ចប់ចុះហត្ថលេខានៅសាខា 770022 ➜ មិនត្រូវ abandon (ដកលុយ)').toBe(false);
    });

    it('⛔ សាខា 770022 មិនទាន់ Login Palm ➜ បញ្ជីមិនពេញលេញ ➜ នៅរង់ចាំ (មិនដកលុយកញ្ចប់ដែលអតិថិជនយករួច)', async () => {
        useSharedBlobs();
        await branchWorld(SITE + '|' + OTHER_SITE);
        dataState.scanHistory = [openItem('p770', 'KH7700000001', 8 * DAY)];
        await runZtoStatusSweep(false);
        cleanupNow();
        expect(abandoned('p770'), 'កញ្ចប់ចុះហត្ថលេខានៅសាខា 770022 ➜ មិនត្រូវ abandon (ដកលុយ)').toBe(false);
        expect(ztoState.ztoSignedCompleteAt, 'បញ្ជីសាខាតែមួយ ➜ មិនត្រូវកត់ «ពេញលេញ»').toBe(0);
    });

    it('ទិសផ្ទុយ ៖ គម្រោងសាខាច្រើន · គ្រប់សាខា Login · កញ្ចប់មិនចុះហត្ថលេខានៅសាខាណាទាំងអស់ ➜ «ត្រឡប់» ធម្មតា (ការរង់ចាំមិនជាប់)', async () => {
        useSharedBlobs();
        await branchWorld(SITE + '|' + OTHER_SITE, true);
        dataState.scanHistory = [openItem('s881', 'KH8818590009', 8 * DAY)];
        await runZtoStatusSweep(false);
        expect(ztoState.ztoSignedCompleteAt > 0, 'គ្រប់សាខាឆ្លើយ ➜ «ពេញលេញ»').toBe(true);
        cleanupNow();
        expect(abandoned('s881')).toBe(true);
    });

    it('ទិសផ្ទុយ ៖ គម្រោងសាខាតែមួយ ➜ បញ្ជី Palm ពេញលេញ ➜ កញ្ចប់មិនចុះហត្ថលេខា ➜ «ត្រឡប់» ធម្មតា (ការរង់ចាំមិនជាប់)', async () => {
        useSharedBlobs();
        await branchWorld(SITE);
        dataState.scanHistory = [openItem('s881', 'KH8818590009', 8 * DAY)];
        await runZtoStatusSweep(false);
        expect(ztoState.ztoSignedCompleteAt > 0, 'សាខាតែមួយ ➜ «ពេញលេញ»').toBe(true);
        expect(world.zto.filter((k) => k.startsWith('list:5')).length, 'សាខាតែមួយ ➜ គ្មានការអានសាខាផ្សេង').toBe(1);
        cleanupNow();
        expect(abandoned('s881')).toBe(true);
    });
});
