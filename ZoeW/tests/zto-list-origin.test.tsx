/**
 * ⛔ ប្រភពកញ្ចប់ក្នុងប្រអប់បញ្ជី ZTO (សំណើម្ចាស់គម្រោង ៖ «ដឹងថាកញ្ចប់មកពីចិន វៀតណាម»)។
 * ZTO គ្មានវាលប្រទេស (`countryCode: null` គ្រប់ payload ពិត) ➜ Function ផ្ញើ `from` = `recSite` (ZTO ឃ្លាំងក្វាងចូវអន្តរជាតិ · Shopee SHPE · សាខាក្នុងស្រុក)
 * ➜ ជួរដេកបង្ហាញ «📍 …» លើបន្ទាត់ដាច់ ដូច ZTO សរសេរ (មិនទាយប្រទេស) · មិនរក្សាទុកក្នុងកញ្ចប់ (`addOrUpdateEntry` ទទួលវាលច្បាស់លាស់)។
 */
import { describe, expect, it } from 'vitest';
import { ztoListGroupModel } from '../src/app/components/zto/model';
import { classifyZtoListRows } from '../src/features/zto-list-sync';
import { getZoneDateKey } from '../src/core/timezone';

const today = () => getZoneDateKey(Date.now(), 0) + ' 08:00:00';

function rowOf(barcode: string, from: unknown) {
    return { barcode, phone: '081000001', cod: 1, dod: 0, at: today(), ztoClosed: null, skip: '', from };
}

describe('ប្រភពកញ្ចប់ ៖ Function `from` ➜ ជួរដេកប្រអប់បញ្ជី', () => {
    it('`from` ឆ្លងការចាត់ថ្នាក់ ➜ «🇨🇳 ចិន · …» លើបន្ទាត់ដាច់ក្នុងជួរដេក', () => {
        const out = classifyZtoListRows([rowOf('ZTF0000001', 'ZTO ឃ្លាំងក្វាងចូវអន្តរជាតិ'), rowOf('ZTF0000002', 'Shopee SHPE')], [], []);
        expect(out.fresh.map((r: any) => r.from)).toEqual(['ZTO ឃ្លាំងក្វាងចូវអន្តរជាតិ', 'Shopee SHPE']);
        const model = ztoListGroupModel('ថ្មី', out.fresh, 'zto-list-fresh');
        expect(model.rows[0].origin).toBe('🇨🇳 ចិន · ZTO ឃ្លាំងក្វាងចូវអន្តរជាតិ');
        expect(model.rows[1].origin).toBe('🇻🇳 វៀតណាម · Shopee SHPE');
        expect(model.rows[0].primary, 'ប្រភពនៅបន្ទាត់ដាច់ (មិនលាយជាមួយលេខទូរស័ព្ទ/លុយ)').not.toContain('📍');
    });

    it('ទិសផ្ទុយ ៖ គ្មាន/មិនមែនអត្ថបទ ➜ គ្មាន «📍» (Function ចាស់ · ZTO មិនផ្ញើ)', () => {
        const out = classifyZtoListRows([rowOf('ZTF0000003', undefined), rowOf('ZTF0000004', ''), rowOf('ZTF0000005', { x: 1 }),
            rowOf('ZTF0000006', 42)], [], []);
        expect(out.fresh.map((r: any) => r.from)).toEqual(['', '', '', '']);
        const model = ztoListGroupModel('ថ្មី', out.fresh, 'zto-list-fresh');
        expect(model.rows.every((r) => r.origin === '')).toBe(true);
    });

    it('⛔ ពិដាន ៦៤ តួ (Function ក្លែង/ចាស់មិនពង្រីកជួរដេក)', () => {
        const out = classifyZtoListRows([rowOf('ZTF0000007', 'ក'.repeat(300))], [], []);
        expect(out.fresh[0].from.length).toBe(64);
    });

    it('ជួរដេករំលង និងស្ទួន ក៏បង្ហាញប្រភពដែរ', () => {
        const old = { ...rowOf('ZTF0000008', 'Shopee SHPE'), skip: 'scan-type' };
        const out = classifyZtoListRows([old], [], []);
        const skipped = ztoListGroupModel('រំលង', out.skipped, 'zto-list-skip').rows[0];
        expect(skipped.origin).toBe('🇻🇳 វៀតណាម · Shopee SHPE');
        expect(skipped.notes.length, 'មូលហេតុរំលងនៅបន្ទាត់ចំណាំដាច់').toBe(1);
    });
});
