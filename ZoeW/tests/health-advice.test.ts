/**
 * ⛔ 🧠 ការណែនាំក្នុង 🩺 ពិនិត្យសុខភាព (សំណើម្ចាស់គម្រោង ៖ «បន្ថែមភាពឆ្លាតវៃ») ៖ ដេរីវេពី **ជួរដែលវាស់បាន** ប៉ុណ្ណោះ (គ្មានបណ្ដាញ · គ្មានការសរសេរ) ៖
 *    (១) មូលហេតុឫសគល់មុន ៖ ក្រៅបណ្ដាញ ➜ ជំហានទី ១ = ភ្ជាប់បណ្ដាញ · ជួរដែលជាផលវិបាក (Firebase/Supabase · នាឡិកា · Lookup · អាជ្ញាប័ណ្ណ) ត្រូវរាយជា «នឹងជាវិញដោយខ្លួនឯង» មិនមែនជាជំហាន
 *    (២) ❌ មុន ⚠️ · ≤ `HEALTH_ADVICE_MAX_STEPS` ជំហាន · ជំហានស្ទួនមិនរាយ ២ ដង
 *    (៣) ទាំងអស់ ✅/ℹ️ ➜ level `ok` · គ្មានជំហាន · (៤) ជួរ ℹ️ មិនដែលបង្កើតជំហាន · (៥) ការណែនាំតាមមូលហេតុក្នុង detail (Cookie បដិសេធ · Key ជិតផុត · ការសរសេរ blocked)
 *    (៦) `runHealthCheck()` សរសេរវាចូល `uiState.healthAdvice` ក្រោយជួរ ហើយការកំណត់ `healthCheckList` ឡើងវិញ (logout) លុបវាចោល។
 */
import { describe, expect, it } from 'vitest';
import { HEALTH_ADVICE_LABELS, HEALTH_ADVICE_MAX_STEPS, buildHealthAdvice } from '../src/features/health-advice';
import { healthRow } from '../src/app/components/health/model';
import { resetReactOwned } from '../src/app/slot-resets';
import { uiState } from '../src/core/state';

const L = HEALTH_ADVICE_LABELS;
const ok = (label) => healthRow('ok', label, 'ធម្មតា');

function healthy() {
    return [ok(L.network), ok('Firebase'), ok(L.clock), ok(L.license), ok(L.storage), ok(L.offline),
        healthRow('info', L.table, 'មិនទាន់ទាញមកទេ'), healthRow('info', L.script, 'មិនពាក់ព័ន្ធ'), healthRow('info', L.lookup, 'មិនទាន់បើក')];
}

describe('🧠 ការណែនាំសុខភាព', () => {
    it('ទាំងអស់ ✅/ℹ️ ➜ ok · គ្មានជំហាន · ℹ️ មិនបង្កើតជំហាន', () => {
        const advice = buildHealthAdvice(healthy());
        expect(advice.level).toBe('ok');
        expect(advice.steps).toEqual([]);
        expect(advice.healed).toEqual([]);
        expect(advice.title).toMatch(/ធម្មតា/);
    });

    it('ក្រៅបណ្ដាញ ➜ មូលហេតុចម្បង = អ៊ីនធឺណិត · ជំហានទី ១ ភ្ជាប់បណ្ដាញ · ជួរផលវិបាកនឹងជាវិញដោយខ្លួនឯង', () => {
        const rows = healthy();
        rows[0] = healthRow('bad', L.network, 'ក្រៅបណ្ដាញ — ការស្កេនចូលនៅដំណើរការ');
        rows[1] = healthRow('bad', 'Firebase', 'ដាច់ការតភ្ជាប់ — កំពុងព្យាយាមភ្ជាប់ឡើងវិញ');
        rows[2] = healthRow('warn', L.clock, 'មិនទាន់ sync — ការសម្អាតស្វ័យប្រវត្តិត្រូវបានផ្អាកដោយចេតនា');
        rows[8] = healthRow('warn', L.lookup + ' (ZTO)', 'បើករួច — ពិនិត្យមិនបានខណៈក្រៅបណ្ដាញ');
        const advice = buildHealthAdvice(rows);
        expect(advice.level).toBe('bad');
        expect(advice.title).toMatch(/មូលហេតុចម្បង ៖ អ៊ីនធឺណិត/);
        expect(advice.steps.length).toBe(1);
        expect(advice.steps[0]).toMatch(/WiFi/);
        expect(advice.healed).toEqual(['Firebase', L.clock, L.lookup + ' (ZTO)']);
    });

    it('បណ្ដាញល្អ តែ Server ដាច់ ➜ Firebase មុន · នាឡិកាជាវិញដោយខ្លួនឯង · Lookup នៅជាជំហានដាច់ដោយឡែក', () => {
        const rows = healthy();
        rows[1] = healthRow('bad', 'Supabase', 'មិនទាន់ភ្ជាប់ម្តងណាទេ — សូមពិនិត្យ Config');
        rows[2] = healthRow('warn', L.clock, 'មិនទាន់ sync — ការសម្អាតស្វ័យប្រវត្តិត្រូវបានផ្អាកដោយចេតនា');
        rows[8] = healthRow('bad', L.lookup + ' (ZTO)', 'ZTO បដិសេធ Cookie នេះ — សូមចូល Argus');
        const advice = buildHealthAdvice(rows);
        expect(advice.title).toMatch(/មូលហេតុចម្បង ៖ Supabase/);
        expect(advice.steps.length).toBe(2);
        expect(advice.steps[0]).toMatch(/Config/);
        expect(advice.steps[1]).toMatch(/sync-zto-cookie/);
        expect(advice.healed).toEqual([L.clock]);
    });

    it('❌ មុន ⚠️ · ពិដាន ' + HEALTH_ADVICE_MAX_STEPS + ' ជំហាន · ជំហានស្ទួនមិនរាយ ២ ដង', () => {
        const rows = healthy();
        rows[2] = healthRow('warn', L.clock, 'sync រួច · ការសម្អាតផ្អាកព្រោះការតភ្ជាប់មិនរស់');
        rows[3] = healthRow('warn', L.license, 'Key សកម្ម · ផុត 2030-01-01 (នៅសល់ 3 ថ្ងៃ) — ជិតផុតកំណត់ សូមទាក់ទងអ្នកលក់ដើម្បីពន្យារ');
        rows[5] = healthRow('warn', L.offline, 'មិនទាន់គ្រប់គ្រងទំព័រនេះ — សូមទាញចុះ ១ ដងទៀត');
        rows[6] = healthRow('warn', L.table, '12 ជួរដេក · មិនពេញលេញ');
        rows[7] = healthRow('bad', L.script, 'Script ដែល deploy ជាកំណែ 0 តែ App រំពឹង 1');
        rows[4] = healthRow('bad', L.storage, 'localStorage ត្រូវបានបិទ');
        const advice = buildHealthAdvice(rows);
        expect(advice.level).toBe('bad');
        expect(advice.steps.length).toBe(HEALTH_ADVICE_MAX_STEPS);
        expect(advice.steps[0]).toMatch(/Private/);
        expect(advice.steps[1]).toMatch(/Code\.gs/);
        expect(advice.steps[2]).toMatch(/ការសម្អាត/);
        expect(new Set(advice.steps).size).toBe(advice.steps.length);
        expect(advice.healed).toEqual([]);
    });

    it('ការសរសេរ blocked ➜ ជំហានប្រាប់ផ្លូវចេញ (☰ ឧបករណ៍ · PIN) · ⚠️ តែមួយ ➜ level warn', () => {
        const rows = healthy();
        rows[1] = healthRow('warn', 'Firebase', 'មានការសរសេរមិនទាន់ផ្ទៀងផ្ទាត់ — មិនទាន់អនុវត្តឡើងវិញ');
        const advice = buildHealthAdvice(rows);
        expect(advice.level).toBe('warn');
        expect(advice.title).toMatch(/មាន 1 ចំណុច/);
        expect(advice.steps).toEqual([expect.stringMatching(/លុបការសរសេររង់ចាំ/)]);
    });

    it('ទិន្នន័យខូច (មិនមែន array · ជួរ null) ➜ ok ដោយគ្មានកំហុស', () => {
        expect(buildHealthAdvice(undefined).level).toBe('ok');
        expect(buildHealthAdvice([null, 7, {}] as any).steps).toEqual([]);
    });

    it('logout កំណត់ healthCheckList ឡើងវិញ ➜ ការណែនាំបាត់ជាមួយជួរ', () => {
        uiState.healthRows = healthy();
        uiState.healthAdvice = buildHealthAdvice(uiState.healthRows);
        expect(uiState.healthAdvice).not.toBeNull();
        expect(resetReactOwned('healthCheckList')).toBe(true);
        expect(uiState.healthRows).toBeNull();
        expect(uiState.healthAdvice).toBeNull();
    });
});
