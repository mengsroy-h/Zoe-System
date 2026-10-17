/**
 * ⛔ សំណើម្ចាស់គម្រោង ៖ «អោយ palm ដំណើរការពេញលេញដូច cookie គ្រប់ backend តេស្ត race ផង»។
 *    App ពិត + Function ពិត + ZTO Palm ក្លែង លើ backend ទាំង ២ (Firebase ID token · Supabase `my_account()`) × `ZTO_DETAIL_IDENTITY`
 *    (`off` · `optional` · `require`) ៖ ការទាញបញ្ជីមកដល់ផ្តល់ជួរដូចគ្នាគ្រប់ករណី · ពេល Server បដិសេធគណនី ZoeW ប្រអប់និយាយមូលហេតុពិត
 *    ដូចរបៀប Cookie (សាខា · ហាង · សាកម្តងទៀត) ⛔ មិនមែន «Session ZTO Palm ផុតកំណត់ — Login ZTO Palm» ទេ។
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { dataState, ztoState } from '../src/core/state';
import { getLookupApiConfig } from '../src/features/lookup-config';
import { runZtoListSyncPreview } from '../src/features/zto-list-sync';
import { closeZtoSignedBarcodes } from '../src/features/zto-status';
import {
    ARRIVED, OTHER_SITE, SIGNED_ONLY, SITE, fn, fx, identityToken, noteText, pulledRows, setupWorld, signIn, storePalmConfig,
    supabaseToken, teardownWorld, toastTexts, world, type Backend, type IdentityMode
} from './zto-palm-harness';

vi.mock('../src/features/barcode-ops', () => ({
    openViewListModal: () => {},
    removeSingleBarcode: async () => 'failed',
    toggleIndividualBarcodeClose: async () => false,
    openEditBarcodePriceModal: () => {},
    closeEditBarcodeModal: () => {},
    saveEditedBarcodePrice: () => {},
    applyBarcodeCloseChange: async () => true
}));

const BACKENDS: Backend[] = ['firebase', 'supabase'];
const MODES: IdentityMode[] = ['off', 'optional', 'require'];
const SESSION_EXPIRED = 'Session ZTO Palm ផុតកំណត់';

afterEach(() => teardownWorld());

describe.each(BACKENDS)('ZTO Palm ៖ ទាញបញ្ជីលើ backend %s', (backend) => {
    it.each(MODES)('ZTO_DETAIL_IDENTITY=%s ៖ ជួរ · ម៉ោងមកដល់ · ប្រភព · បិទរួច/មិនទាន់ ដូចគ្នាគ្រប់ backend', async (mode) => {
        await setupWorld(backend, mode);
        await runZtoListSyncPreview();
        expect(noteText(), noteText()).not.toContain('មិនបាន');
        const rows = pulledRows();
        expect([...rows.keys()].sort()).toEqual(ARRIVED.slice().sort());
        expect(rows.get('KH1000000001')).toMatchObject({ phone: '0960007345', cod: 3.5, at: '2026-10-04 09:00:00', ztoClosed: false, from: 'Shopee SHPE' });
        expect(rows.get('KH7000000001')).toMatchObject({ at: '2026-10-03 09:00:00', ztoClosed: true });
        expect((ztoState.ztoListSyncResult.signedRows as any[]).map((r) => r.barcode)).toEqual(expect.arrayContaining(SIGNED_ONLY));
        expect(ztoState.ztoListSyncResult.site).toBe(SITE);
        expect(ztoState.ztoListSyncResult.unverified).toEqual([]);
        if (mode === 'require' && backend === 'supabase') expect(world.sbCalls, 'Function ផ្ទៀងគណនីជាមួយ Supabase').toBeGreaterThan(0);
    });

    it('require ៖ គណនី ZoeW សាខាផ្សេងពីគណនី Palm ➜ ប្រាប់ឲ្យ Login Palm សាខានេះ · មិនអាន ZTO', async () => {
        await setupWorld(backend, 'require', { site: OTHER_SITE });
        await runZtoListSyncPreview();
        expect(ztoState.ztoListSyncResult).toBeNull();
        expect(noteText()).toContain('សាខាផ្សេង');
        expect(noteText()).toContain('Login ZTO Palm');
        expect(noteText()).not.toContain('គ្មានលេខសាខា');
        expect(world.zto.filter((k) => k.startsWith('list:') || k.startsWith('track:'))).toEqual([]);
    });

    it('require ៖ token គណនី ZoeW ផុតកំណត់ ➜ «ផ្ទៀងផ្ទាត់គណនី… សាកម្ដងទៀត» ដូច Cookie · មិនមែន Session Palm', async () => {
        await setupWorld(backend, 'require');
        const now = Math.floor(Date.now() / 1000);
        const stale = backend === 'firebase'
            ? fx.tokenFor('u@zoew' + SITE + '.com', { claims: { iat: now - 7200, exp: now - 3600 } })
            : supabaseToken('stale', { exp: now - 3600 });
        signIn(backend, stale);
        await runZtoListSyncPreview();
        expect(ztoState.ztoListSyncResult).toBeNull();
        expect(noteText()).toContain('ផ្ទៀងផ្ទាត់គណនីជាមួយ Server មិនបាន (idtoken:expired)');
        expect(noteText()).not.toContain(SESSION_EXPIRED);
        expect(toastTexts().join(' ')).not.toContain(SESSION_EXPIRED);
    });

    it('require ៖ Server ផ្ទៀងគណនីមិនបាន (Supabase · វិញ្ញាបនបត្រ Google មិនឆ្លើយ) ➜ សាកម្ដងទៀត · មិនមែន Session Palm', async () => {
        await setupWorld(backend, 'require');
        fn.resetCachesForTests();
        if (backend === 'supabase') world.sbDown = true;
        else world.certsDown = true;
        await runZtoListSyncPreview();
        expect(ztoState.ztoListSyncResult).toBeNull();
        expect(noteText()).toContain(backend === 'supabase' ? 'ផ្ទៀងផ្ទាត់ហាងជាមួយ Server មិនបាន' : 'ផ្ទៀងផ្ទាត់គណនីជាមួយ Server មិនបាន');
        expect(noteText()).toContain('សាកម្ដងទៀត');
        expect(noteText()).not.toContain(SESSION_EXPIRED);
        world.sbDown = false;
        world.certsDown = false;
        await runZtoListSyncPreview();
        expect([...pulledRows().keys()].sort(), 'Server មកវិញ ➜ ទាញបានភ្លាម').toEqual(ARRIVED.slice().sort());
    });
});

describe('ZTO Palm ៖ ហាង Supabase ដែលគណនីមិនអាចទាញបញ្ជី (require) ➜ សារដូចរបៀប Cookie', () => {
    it.each([
        ['គណនីគ្មានហាង', '', 'active', 'គ្មានលេខសាខា'],
        ['ហាងផុតកំណត់', SITE, 'expired', 'ហាងនេះផុតកំណត់'],
        ['ហាងត្រូវបិទ', SITE, 'revoked', 'ហាងនេះត្រូវបានបិទ']
    ])('%s ➜ «%s»', async (_label, site, status, text) => {
        await setupWorld('supabase', 'require');
        signIn('supabase', identityToken('supabase', site, status), site || SITE);
        await storePalmConfig('supabase', world.palmSessions[0], site || SITE);
        await runZtoListSyncPreview();
        expect(ztoState.ztoListSyncResult).toBeNull();
        expect(noteText()).toContain(text);
        expect(noteText()).not.toContain(SESSION_EXPIRED);
        expect(world.zto.filter((k) => k.startsWith('list:'))).toEqual([]);
    });
});

describe.each(BACKENDS)('ZTO Palm ៖ បញ្ជី «ចុះហត្ថលេខា» (បិទតាម ZTO · ការរង់ចាំ ៨ ថ្ងៃ) ពេល Server បដិសេធគណនី (%s · require)', (backend) => {
    const sweep = async () => {
        dataState.scanHistory = [{ id: 'row-1', phone: '0960007345', scanDate: '2026-10-05', createdAt: Date.now() - 3600000,
            barcodes: [{ code: 'KH7000000001', isClosed: false, cod: 3.5, dod: 0 }] }] as any;
        ztoState.ztoSignedOff = false;
        return closeZtoSignedBarcodes(getLookupApiConfig(), [{ itemId: 'row-1', code: 'KH7000000001', key: 'KH7000000001' }], dataState.scanHistory);
    };

    it('Server ផ្ទៀងគណនីមិនបានបណ្តោះអាសន្ន ➜ មិនបិទមុខងារ · ការរង់ចាំ ៨ ថ្ងៃនៅបន្ត (ដូច Cookie)', async () => {
        await setupWorld(backend, 'require');
        fn.resetCachesForTests();
        if (backend === 'supabase') world.sbDown = true;
        else world.certsDown = true;
        const out = await sweep();
        expect(out.closed).toBe(0);
        expect(ztoState.ztoSignedOff).toBe(false);
    });

    it('គណនីសាខាផ្សេង (សាលក្រមស្ថាពរ) ➜ បិទមុខងារ ដូច Cookie ពេលគណនីគ្មានសាខា', async () => {
        await setupWorld(backend, 'require', { site: OTHER_SITE });
        const out = await sweep();
        expect(out.closed).toBe(0);
        expect(ztoState.ztoSignedOff).toBe(true);
    });

    it('គណនីសាខាត្រូវ ➜ បិទកញ្ចប់ដែល ZTO ចុះហត្ថលេខា', async () => {
        await setupWorld(backend, 'require');
        const out = await sweep();
        expect(out.closed).toBe(1);
        expect(ztoState.ztoSignedOff).toBe(false);
    });
});
