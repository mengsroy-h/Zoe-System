/**
 * ⛔ សំណើម្ចាស់គម្រោង ៖ «អោយ palm ដំណើរការពេញលេញដូច cookie គ្រប់ backend តេស្ត race ផង»។
 *    ការប្រជែងពេលទាញបញ្ជី Palm (App ពិត + Function ពិត + ZTO Palm ក្លែង) លើ backend ទាំង ២ ៖ ចាកចេញ · ប្តូរហាង · Login Palm ម្តងទៀត
 *    កណ្តាលដំណាក់កាលបេក្ខភាព ឬ track ➜ ចម្លើយយឺតមិនបង្ហាញ មិនសរសេរសាលក្រម មិនផ្ញើសំណើថ្មី · ចុចពីរដង ➜ ការទាញតែមួយ ·
 *    ការបរាជ័យយឺតរបស់វគ្គចាស់មិនដោះសោការទាញថ្មី · ចម្លើយ «ចុះហត្ថលេខា» Palm ដែលមកក្រោយចាកចេញ មិនបិទកញ្ចប់ (ដូចរបៀប Cookie)។
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { dataState, securityState, ztoState } from '../src/core/state';
import { getLookupApiConfig, storeLookupApiConfig } from '../src/features/lookup-config';
import { clearSensitiveModalFields } from '../src/features/session';
import { runZtoListSyncPreview } from '../src/features/zto-list-sync';
import { closeZtoSignedBarcodes, ztoPickupStatus } from '../src/features/zto-status';
import { encryptLookupSecret } from '../src/services/crypto';
import { applyBarcodeCloseChange } from '../src/features/barcode-ops';
import {
    palmTokenFor, ARRIVED, RANGE, deferred, identityToken, noteText, palmLogin, pulledRows, setRangeFields, setupWorld, signIn, storePalmConfig,
    teardownWorld, world, type Backend
} from './zto-palm-harness';

vi.mock('../src/features/barcode-ops', () => ({
    openViewListModal: () => {},
    removeSingleBarcode: async () => 'failed',
    toggleIndividualBarcodeClose: async () => false,
    openEditBarcodePriceModal: () => {},
    closeEditBarcodeModal: () => {},
    saveEditedBarcodePrice: () => {},
    applyBarcodeCloseChange: vi.fn(async () => true)
}));

const BACKENDS: Backend[] = ['firebase', 'supabase'];
const OTHER: Record<Backend, Backend> = { firebase: 'supabase', supabase: 'firebase' };

afterEach(() => teardownWorld());

function holdFirst(kind: string, match: (key: string) => boolean) {
    const reached = deferred();
    const release = deferred();
    let held = false;
    world.gate = async (k, key) => {
        if (held || k !== kind || !match(key)) return;
        held = true;
        reached.resolve();
        await release.promise;
    };
    return { reached: reached.promise, release: () => release.resolve() };
}

const trackCalls = () => world.functionQueries.filter((q) => q.list === '1' && q.tracks).length;
const listCalls = () => world.functionQueries.filter((q) => q.list === '1' && q.candidates === '1').length;

describe.each(BACKENDS)('ZTO Palm race លើ backend %s', (backend) => {
    it('ចាកចេញពេលទំព័របេក្ខភាពទី ១ កំពុងមក ➜ គ្មានលទ្ធផល · គ្មាន track · ដោះសោ', async () => {
        await setupWorld(backend, 'off');
        const hold = holdFirst('list', (key) => key === 'list:3:1');
        const pull = runZtoListSyncPreview();
        await hold.reached;
        clearSensitiveModalFields();
        const noteAtLogout = noteText();
        hold.release();
        await pull;
        expect(ztoState.ztoListSyncResult).toBeNull();
        expect(trackCalls()).toBe(0);
        expect(world.zto.filter((k) => k.startsWith('track:'))).toEqual([]);
        expect(noteText()).toBe(noteAtLogout);
        expect(ztoState.ztoListSyncInFlight).toBe(false);
    });

    it('ចាកចេញពេល track កំពុងរត់ ➜ គ្មានលទ្ធផល · គ្មានសំណើ track ថ្មីក្រោយចាកចេញ', async () => {
        await setupWorld(backend, 'off', { bulk: 120 });
        const hold = holdFirst('track', () => true);
        const pull = runZtoListSyncPreview();
        await hold.reached;
        const before = trackCalls();
        clearSensitiveModalFields();
        hold.release();
        await pull;
        expect(ztoState.ztoListSyncResult).toBeNull();
        expect(trackCalls(), 'មិនចាប់ផ្តើមក្រុម track ថ្មីក្រោយចាកចេញ').toBe(before);
        expect(ztoState.ztoListSyncInFlight).toBe(false);
    });

    it('ប្តូរហាង (backend ផ្សេង) ពេល track កំពុងរត់ ➜ បញ្ជីហាងចាស់មិនលេចក្នុងហាងថ្មី', async () => {
        await setupWorld(backend, 'off', { bulk: 120 });
        const hold = holdFirst('track', () => true);
        const pull = runZtoListSyncPreview();
        await hold.reached;
        const before = trackCalls();
        signIn(OTHER[backend], identityToken(OTHER[backend]));
        hold.release();
        await pull;
        expect(ztoState.ztoListSyncResult).toBeNull();
        expect(trackCalls()).toBe(before);
        expect(noteText()).not.toContain('⏱ Palm');
    });

    it('Login ZTO Palm ម្តងទៀត (session ថ្មី) ពេលកំពុងទាញ ➜ ចម្លើយរបស់ session ចាស់ត្រូវបោះចោល', async () => {
        await setupWorld(backend, 'off');
        const hold = holdFirst('list', (key) => key === 'list:3:1');
        const pull = runZtoListSyncPreview();
        await hold.reached;
        const fresh = await palmLogin('palm-user-2');
        const cfg: any = getLookupApiConfig();
        expect(storeLookupApiConfig(Object.assign({}, cfg, { palmTokenEnc: await encryptLookupSecret(fresh) }))).toBe(true);
        hold.release();
        await pull;
        expect(ztoState.ztoListSyncResult).toBeNull();
        expect(trackCalls()).toBe(0);
        expect(ztoState.ztoListSyncInFlight).toBe(false);
        await runZtoListSyncPreview();
        expect([...pulledRows().keys()].sort(), 'ការទាញថ្មីប្រើ session ថ្មី ហើយដំណើរការធម្មតា').toEqual(ARRIVED.slice().sort());
    });

    it('ចុច «ទាញ» ពីរដងជាប់គ្នា ➜ ការទាញតែមួយ (ទំព័របេក្ខភាពទី ១ ម្តង)', async () => {
        await setupWorld(backend, 'off');
        await Promise.all([runZtoListSyncPreview(), runZtoListSyncPreview()]);
        expect(world.zto.filter((k) => k === 'list:3:1')).toHaveLength(1);
        expect(listCalls()).toBe(1);
        expect([...pulledRows().keys()].sort()).toEqual(ARRIVED.slice().sort());
    });

    it('ការបរាជ័យយឺតរបស់វគ្គចាស់ មិនដោះសោ ហើយមិនសរសេរលើការទាញថ្មី (ចាកចេញ ➜ ចូលវិញ ➜ ទាញថ្មី)', async () => {
        const { token } = await setupWorld(backend, 'off');
        const oldPalm = palmTokenFor('synthetic-palm-token-palm-user');
        const reachedOld = deferred();
        const releaseOld = deferred();
        let oldReleased = false;
        const reachedNew = deferred();
        const releaseNew = deferred();
        let newHeld = false;
        world.gate = async (kind, key, palmToken) => {
            if (palmToken === palmTokenFor('synthetic-palm-token-palm-user-2') && !newHeld && kind === 'list' && key === 'list:3:1') {
                newHeld = true;
                reachedNew.resolve();
                await releaseNew.promise;
            }
            if (palmToken !== oldPalm) return;
            if (!oldReleased && kind === 'list' && key === 'list:3:1') {
                reachedOld.resolve();
                await releaseOld.promise;
            }
            if (oldReleased) throw new TypeError('old network failure');
        };
        const oldPull = runZtoListSyncPreview();
        await reachedOld.promise;
        const pinKey = securityState.lookupSecretKey;
        clearSensitiveModalFields();
        securityState.lookupSecretKey = pinKey;
        signIn(backend, token);
        await storePalmConfig(backend, await palmLogin('palm-user-2'));
        setRangeFields();
        const newPull = runZtoListSyncPreview();
        await reachedNew.promise;
        expect(ztoState.ztoListSyncInFlight).toBe(true);
        oldReleased = true;
        releaseOld.resolve();
        await oldPull;
        expect(ztoState.ztoListSyncInFlight, 'វគ្គចាស់មិនដោះសោការទាញថ្មី').toBe(true);
        expect(ztoState.ztoListSyncResult).toBeNull();
        releaseNew.resolve();
        await newPull;
        expect([...pulledRows().keys()].sort()).toEqual(ARRIVED.slice().sort());
        expect(ztoState.ztoListSyncInFlight).toBe(false);
    });

    it('បញ្ជី «ចុះហត្ថលេខា» Palm មកក្រោយចាកចេញ ➜ មិនបិទកញ្ចប់ · មិនសរសេរសាលក្រម', async () => {
        await setupWorld(backend, 'off');
        (applyBarcodeCloseChange as any).mockClear();
        dataState.scanHistory = [{ id: 'row-1', phone: '0960007345', scanDate: RANGE.to, createdAt: Date.now() - 3600000,
            barcodes: [{ code: 'KH7000000001', isClosed: false, cod: 3.5, dod: 0 }] }] as any;
        const hold = holdFirst('list', (key) => key.startsWith('list:5:'));
        const cfg = getLookupApiConfig();
        const sweep = closeZtoSignedBarcodes(cfg, [{ itemId: 'row-1', code: 'KH7000000001', key: 'KH7000000001' }], dataState.scanHistory);
        await hold.reached;
        clearSensitiveModalFields();
        hold.release();
        const out = await sweep;
        expect(out.closed).toBe(0);
        expect(applyBarcodeCloseChange).not.toHaveBeenCalled();
        expect(ztoPickupStatus.size).toBe(0);
    });
});
