import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { invariant, invariantBroken } = require('../../audit-tools/money-multidevice-core.js');
const day = '2026-10-19';
const month = '2026-10';

function fixture() {
    const item = (id: string, phone: string, codes: string[], closed: boolean) => ({
        id, phone, scanDate: day,
        barcodes: codes.map((code) => ({ code, cod: 1.25, dod: 0.5, isClosed: closed, isDeducted: false }))
    });
    return {
        zoew_scan_history_cod_dod: {
            a: item('a', '012345678', ['AA', 'BB'], true),
            b: item('b', '098765432', ['CC'], true),
            c: item('c', '011223344', ['DD'], false)
        },
        zoew_recently_deleted_cod_dod: {},
        zoew_barcode_registry: { AA: true, BB: true, CC: true, DD: true } as Record<string, boolean>,
        zoew_daily_revenue_cod_dod: { [day]: { codDollar: 5, dodDollar: 2, totalCount: 4 } },
        zoew_monthly_revenue_cod_dod: { [month]: { codDollar: 5, dodDollar: 2, totalCount: 4 } },
        zoew_daily_pickup_cod_dod: { [day]: {
            packagesPickedUp: 3,
            pickedUpBarcodes: { AA: '012345678', BB: '012345678', CC: '098765432' } as Record<string, string>,
            pickedUpPhones: { '012345678': 2, '098765432': 1 } as Record<string, number>
        } }
    };
}

function verdict(tree: ReturnType<typeof fixture>) {
    return invariantBroken(invariant(tree, day, month, ['AA', 'BB', 'CC', 'DD']));
}

describe('អ្នកយាមលុយផ្ទៀងអត្តសញ្ញាណ server ទាំងមូល', () => {
    it('ទទួលកញ្ចប់បិទច្រើនលេខទូរស័ព្ទតែមួយ និងកញ្ចប់បើក', () => {
        expect(verdict(fixture())).toBeNull();
    });

    it('បដិសេធ pickup key ខុស ទោះចំនួនកញ្ចប់និងលុយនៅដដែល', () => {
        const tree = fixture();
        const pick = tree.zoew_daily_pickup_cod_dod[day];
        delete pick.pickedUpBarcodes.AA;
        pick.pickedUpBarcodes.DD = '012345678';
        expect(verdict(tree)).not.toBeNull();
    });

    it('បដិសេធលេខទូរស័ព្ទខុសក្នុង pickup set ទោះកញ្ចក់ចំនួនត្រឹមត្រូវ', () => {
        const tree = fixture();
        tree.zoew_daily_pickup_cod_dod[day].pickedUpBarcodes.AA = '099999999';
        expect(verdict(tree)).not.toBeNull();
    });

    it('បដិសេធចំនួនអតិថិជនខុស ទោះផលបូក pickedUpPhones ដដែល', () => {
        const tree = fixture();
        tree.zoew_daily_pickup_cod_dod[day].pickedUpPhones = { '012345678': 1, '098765432': 2 };
        expect(verdict(tree)).not.toBeNull();
    });

    it('បដិសេធ set និងកញ្ចក់ប្តូរទូរស័ព្ទខុសជាមួយគ្នា', () => {
        const tree = fixture();
        const pick = tree.zoew_daily_pickup_cod_dod[day];
        pick.pickedUpBarcodes.AA = '098765432';
        pick.pickedUpPhones = { '012345678': 1, '098765432': 2 };
        expect(verdict(tree)).not.toBeNull();
    });

    it('បដិសេធ registry ខ្វះកញ្ចប់ដែលនៅ server', () => {
        const tree = fixture();
        delete tree.zoew_barcode_registry.AA;
        expect(verdict(tree)).not.toBeNull();
    });

    it('បដិសេធ registry កំព្រា', () => {
        const tree = fixture();
        tree.zoew_barcode_registry.GHOST = true;
        expect(verdict(tree)).not.toBeNull();
    });

    it('គោរព registry encoding ពិតសម្រាប់ barcode មានសញ្ញា', () => {
        const tree = fixture();
        tree.zoew_scan_history_cod_dod.c.barcodes[0].code = ' dd/01 ';
        delete tree.zoew_barcode_registry.DD;
        tree.zoew_barcode_registry['DD%2F01'] = true;
        expect(invariantBroken(invariant(tree, day, month, ['AA', 'BB', 'CC', 'DD/01']))).toBeNull();
    });

    it('បដិសេធអត្តសញ្ញាណ barcode ស្ទួនទោះអក្សរតូចធំខុសគ្នា', () => {
        const tree = fixture();
        tree.zoew_scan_history_cod_dod.c.barcodes[0].code = ' aa ';
        delete tree.zoew_barcode_registry.DD;
        expect(invariantBroken(invariant(tree, day, month, ['AA', 'BB', 'CC']))).not.toBeNull();
    });
});
