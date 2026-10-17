/**
 * ⛔ ប្រអប់ ⚙️ ភ្ជាប់ប្រព័ន្ធ (Config/Reconfig) · 🔌 API ស្វែងរកអតិថិជន · 📥 នាំចូល Excel ទៅ Sheet ៖ ប៉ះផ្ទៃងងឹតខាងក្រៅ **មិនបិទ**
 *    (សំណើម្ចាស់គម្រោង ៖ «សូមកុំអោយប៉ះកន្លែងទំនេរទៅវាបិទ») — ប្រអប់ទាំង ៣ មានវាលវាយបញ្ចូលវែង (Config · URL · Header · Password)
 *    ➜ ប៉ះខុសបន្តិចបាត់អ្វីដែលវាយ។ ប៊ូតុងបិទ · ប៊ូតុង Back (APK) · Escape នៅបិទដដែល · ប្រអប់ផ្សេងនៅបិទពេលប៉ះផ្ទៃងងឹតដដែល។
 * ⛔ 🗑️ ផ្ទៀងផ្ទាត់មុនដកកញ្ចប់ · 📋 បញ្ចូលច្រើន ៖ ដូចគ្នា (សំណើម្ចាស់គម្រោង ៖ «កុំអោយប៉ះផ្ទៃទទេបិទ modal») — ប៉ះខុសពេលកំពុងពិនិត្យកញ្ចប់
 *    ឬកំពុងស្កេនជាបន្តបន្ទាប់ មិនបោះបង់ការងារ។
 * ⛔ 📥 បញ្ជីកញ្ចប់ពី ZTO ៖ ដូចគ្នា (សំណើម្ចាស់គម្រោង ៖ «modal បញ្ជី ZTO ប៉ះផ្ទៃទទេមិនបិទ · ការពារពេលកំពុងទាញបញ្ជីប៉ះចៃដន្យ») —
 *    `closeZtoListSyncModal()` លុបបញ្ជីដែលទាញរួច ➜ ប៉ះខុសមួយបាត់បញ្ជីដែលរង់ចាំពិនិត្យ/បញ្ចូល។
 * ⛔ ✍️ Sign · ZTO Palm ៖ ដូចគ្នា — `closeModal()` លុបរូប ឈ្មោះអតិថិជន និងជំហាន Sign ➜ ប៉ះខុសមួយបាត់ការស្កេនពេលចែកចាយ/ទទួលដែលកំពុងធ្វើ។
 *    ផ្លូវពិត ៖ `boot.ts` ស្តាប់ `click` លើ document ➜ `modalBackdropTarget(e.target)` ➜ `dismissModal(id)` (តេស្តហៅលំដាប់ដដែល)។
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ConfigModal } from '../src/app/components/modals/ConfigModal';
import { LookupApiConfigModal } from '../src/app/components/modals/LookupApiConfigModal';
import { SheetImportModal } from '../src/app/components/modals/SheetImportModal';
import { ExchangeRateModal } from '../src/app/components/modals/ExchangeRateModal';
import { ScanRemoveModal } from '../src/app/components/modals/ScanRemoveModal';
import { BatchScanModal } from '../src/app/components/modals/BatchScanModal';
import { ZtoListSyncModal } from '../src/app/components/modals/ZtoListSyncModal';
import { ZtoPalmSignModal } from '../src/app/components/modals/ZtoPalmSignModal';
import { closeTopmostLayer, modalBackdropTarget } from '../src/app/lifecycle/layers';
import { dismissModal } from '../src/ui/modal-stack';
import { closeModal, openModalHelper } from '../src/ui/modal';
import { modalIsOpen } from '../src/core/modals';
import { byId, mount, step, unmount } from './native/react-harness';

const KEEP = ['configModal', 'lookupApiConfigModal', 'sheetImportModal', 'scanRemoveModal', 'batchScanModal', 'ztoListSyncModal', 'ztoPalmSignModal'] as const;

function tapBackdrop(target: Element) {
    step(() => {
        const id = modalBackdropTarget(target);
        if (id) dismissModal(id);
    });
}

describe('ប៉ះផ្ទៃងងឹតខាងក្រៅប្រអប់', () => {
    beforeAll(() => {
        mount(<><ConfigModal /><LookupApiConfigModal /><SheetImportModal /><ExchangeRateModal /><ScanRemoveModal /><BatchScanModal /><ZtoListSyncModal /><ZtoPalmSignModal /></>);
    });
    afterAll(() => unmount());

    for (const id of KEEP) {
        it(`⛔ ${id} ៖ ប៉ះផ្ទៃងងឹត ➜ នៅបើក · Back/Escape ➜ បិទ`, () => {
            step(() => openModalHelper(id));
            expect(modalIsOpen(id)).toBe(true);
            tapBackdrop(byId(id));
            expect(modalIsOpen(id)).toBe(true);
            tapBackdrop(byId(id).querySelector('.modal-content')!);
            expect(modalIsOpen(id)).toBe(true);
            step(() => { closeTopmostLayer({ includeMoreMenu: true }); });
            expect(modalIsOpen(id)).toBe(false);
        });
    }

    it('ប្រអប់ផ្សេង (អត្រាប្រាក់) ៖ ប៉ះផ្ទៃងងឹត ➜ បិទដដែល · ប៉ះក្នុងប្រអប់ ➜ នៅបើក', () => {
        step(() => openModalHelper('exchangeRateModal'));
        tapBackdrop(byId('exchangeRateModal').querySelector('.modal-content')!);
        expect(modalIsOpen('exchangeRateModal')).toBe(true);
        tapBackdrop(byId('exchangeRateModal'));
        expect(modalIsOpen('exchangeRateModal')).toBe(false);
    });

    it('ប្រអប់ដែលនៅបើកពីក្រោម ៖ ប៉ះផ្ទៃងងឹតរបស់ប្រអប់ផ្សេងពីលើ ➜ បិទតែប្រអប់លើ', () => {
        step(() => openModalHelper('configModal'));
        step(() => openModalHelper('exchangeRateModal'));
        tapBackdrop(byId('exchangeRateModal'));
        expect(modalIsOpen('exchangeRateModal')).toBe(false);
        expect(modalIsOpen('configModal')).toBe(true);
        step(() => closeModal('configModal'));
    });
});
