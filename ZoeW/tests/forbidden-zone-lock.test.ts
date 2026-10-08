/**
 * ⛔ សោតំបន់ហាម (CLAUDE.md «Forbidden zone — PTR · history-panel motion · scrolling» · ច្បាប់ ១១)។
 *
 * ឯកសារខាងក្រោមផ្ទៀងផ្ទាត់លើ iPhone និង Android ពិតរួច ៖ PTR · ចលនាផ្ទាំង · ការរមូរ · ការលាក់របា Tab · តារាង ៥ ចំណុច
 * (`src/styles/app.css`)។ អ្នកយាមឥរិយាបថ (gesture-test · panel-motion-test · ios-panel-glide-test · panel-snap-ownership-test ·
 * phone-search-swipe-test) វាស់តែសេណារីយ៉ូដែលវារត់ ➜ តេស្តនេះចាក់សោ **អត្ថបទពិត** ៖ ការកែមួយតួអក្សរ ➜ ធ្លាក់ ➜ session
 * ដែលកែដោយមិនដឹង (refactor · «កែលម្អ» តាមការសង្ស័យ · ទ្រឹស្តី WebKit) ត្រូវឈប់ ហើយសួរម្ចាស់គម្រោងជាមុន។
 *
 * ⛔ ផ្លូវកែត្រឹមត្រូវ ៖
 *   ១. មានសំណើ **ផ្ទាល់** ពីម្ចាស់គម្រោង ឬរបាយការណ៍ពិត (វីដេអូ · ការពិពណ៌នាច្បាស់) — ⛔ មិនមែនការសង្ស័យ ឬការអានកូដ
 *   ២. វាស់ iOS ទល់ Android ➜ អ្នកយាមឥរិយាបថខាងលើត្រូវបៃតង ➜ សាកលើឧបករណ៍ពិតទាំងពីរមុន merge
 *   ៣. ធ្វើបច្ចុប្បន្នភាព `LOCK` (sha256 ដែលតេស្តបង្ហាញពេលធ្លាក់) + `docs/HISTORY.md` ៖ សំណើ · ហេតុផល
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const APP = path.resolve(__dirname, '..');

const LOCK: Record<string, string> = {
    'src/app/behaviors/pull-to-refresh.ts': '08b362228b442ba4323446c54926886696422bdfbe4c91f397f9fc0aafad15d3',
    'src/app/behaviors/panel-motion.ts': '94b2d14fc1d4b21942b6f9fd47a27a7b6a864dc7352057b1ea9c56128f16d961',
    'src/app/behaviors/panels.ts': 'd63700ee43e3ce68f10ab31104b269d97d9db5676807f2a79e93fb231da56271',
    'src/app/behaviors/chrome-autohide.ts': '05afdce20767ec10babb70283a3cc7429ebaaf856c1addfe5c8d6f9f2f02b664',
    'src/app/behaviors/phone-search.ts': 'ffe1209ece38a0cf369891b4019e0a2867f8eb7d386dc2fea4a21f58c2e29307',
    'src/ui/chrome-autohide.ts': '54de996080789c214a5e20725cff58a491557198e04def6f8cd1c7e823960ca9',
    'src/ui/page-nav.ts': 'cc25e1a946db5e759b2e5666b893324bd7b069e85bc6deb4ed7206072a4cd6e5',
    'src/styles/app.css': 'dc8a48ec4294dcbc9545c5d933d644a82737fa99032ad3348369b9dc55e6e9d4'
};

const ZONE_FUNCTIONS = ['setupIOSPullToRefresh', 'panelGlideFrom', 'beginPanelGlideSnapPause', 'endPanelGlideSnapPause', 'bindPanelSwipe',
    'setupSwipeGestures', 'syncHistoryExpandedLock', 'activePanelSections', 'setupChromeAutoHide', 'measureAppChromeSize',
    'setPhoneSearchPulledUp', 'positionPhoneSuggestBox', 'switchAppPage'];

function normalised(rel: string): string {
    return readFileSync(path.join(APP, rel), 'utf8').replace(/\r\n?/g, '\n');
}

function fingerprint(text: string): string {
    return createHash('sha256').update(text).digest('hex');
}

describe('⛔ សោតំបន់ហាម ៖ PTR · ចលនាផ្ទាំង · ការរមូរ មិនត្រូវប្រែដោយគ្មានសំណើម្ចាស់គម្រោង', () => {
    it('ជាន់អប្បបរមា ៖ បញ្ជីសោមានឯកសារតំបន់ហាមពិត ហើយ function តំបន់ហាមនីមួយៗរស់ក្នុងឯកសារដែលចាក់សោ', () => {
        const files = Object.keys(LOCK);
        expect(files.length).toBeGreaterThanOrEqual(8);
        expect(files.filter((rel) => !existsSync(path.join(APP, rel)))).toEqual([]);
        expect(files.every((rel) => /^[0-9a-f]{64}$/.test(LOCK[rel]))).toBe(true);
        const code = files.filter((rel) => rel.endsWith('.ts')).map(normalised).join('\n');
        expect(ZONE_FUNCTIONS.filter((name) => !new RegExp('function ' + name + '\\b').test(code))).toEqual([]);
    });

    for (const rel of Object.keys(LOCK)) {
        it('⛔ ' + rel + ' ដូចកំណែដែលចាក់សោ', () => {
            const actual = existsSync(path.join(APP, rel)) ? fingerprint(normalised(rel)) : 'missing';
            expect(actual, '⛔ តំបន់ហាម (CLAUDE.md «Forbidden zone») ៖ កែតែពេលម្ចាស់គម្រោងស្នើផ្ទាល់ ឬមានរបាយការណ៍ពិត ➜ '
                + 'វាស់ iOS/Android + អ្នកយាមឥរិយាបថបៃតង ➜ ដាក់ sha256 ថ្មីនេះក្នុង LOCK + កត់សំណើ/ហេតុផលក្នុង docs/HISTORY.md').toBe(LOCK[rel]);
        });
    }

    it('ទិសផ្ទុយ ៖ ការកែមួយតួអក្សរ (ព្រំដែន PTR · scroll-padding-top) ប្តូរស្នាមម្រាមដៃ', () => {
        const ptr = normalised('src/app/behaviors/pull-to-refresh.ts');
        expect(ptr).toContain('PTR_START_ZONE_RATIO = 0.4;');
        expect(fingerprint(ptr.replace('PTR_START_ZONE_RATIO = 0.4;', 'PTR_START_ZONE_RATIO = 0.5;'))).not.toBe(LOCK['src/app/behaviors/pull-to-refresh.ts']);
        const css = normalised('src/styles/app.css');
        expect(css).toContain('scroll-padding-top');
        expect(fingerprint(css.replace('scroll-padding-top', 'scroll-margin-top'))).not.toBe(LOCK['src/styles/app.css']);
    });

    it('ទិសផ្ទុយ ៖ CRLF (checkout លើ Windows) មិនបំបែកសោ', () => {
        const rel = 'src/app/behaviors/panels.ts';
        const crlf = normalised(rel).replace(/\n/g, '\r\n').replace(/\r\n?/g, '\n');
        expect(fingerprint(crlf)).toBe(LOCK[rel]);
    });
});
