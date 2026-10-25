/**
 * ⛔ សោ ZTO (សំណើម្ចាស់គម្រោង ៖ «ZTO សំខាន់ · បើវាលែងមានបញ្ហា ចាក់សោវា ដើម្បីកុំឲ្យ session ក្រោយកែវាទៀត»)។
 *
 * ឯកសារខាងក្រោមឆ្លងការផ្ទៀងផ្ទាត់ ២ ជុំ (race · ចន្លោះ · ស្ទួន) ហើយមានអ្នកយាមឥរិយាបថរួច ៖ `zto-list-sync-test` ·
 * `zto-sync-banner-test` · `tests/zto-signed-sync.test.tsx`។ តេស្តនេះចាក់សោ **អត្ថបទពិត** របស់វា ៖
 * ការកែមួយតួអក្សរ ➜ ធ្លាក់ ➜ session ដែលកែដោយមិនដឹង (refactor · «កែលម្អ» តាមការសង្ស័យ) ត្រូវឈប់ ហើយសួរម្ចាស់គម្រោងជាមុន។
 *
 * ⛔ ផ្លូវកែត្រឹមត្រូវ (CLAUDE.md «Locked zone — ZTO») ៖
 *   ១. មានសំណើ **ផ្ទាល់** ពីម្ចាស់គម្រោងឲ្យកែ ZTO (ឬរបាយការណ៍កំហុសពិតពីគាត់) — ⛔ មិនមែនការសង្ស័យ ឬការអានកូដ
 *   ២. សរសេរអ្នកយាមដែលធ្លាក់លើកូដមុនកែ ➜ កែ ➜ អ្នកយាម ZTO ទាំងអស់ខាងលើត្រូវបៃតង
 *   ៣. ធ្វើបច្ចុប្បន្នភាព `LOCK` ខាងក្រោម (sha256 ដែលតេស្តបង្ហាញពេលធ្លាក់) + `docs/HISTORY.md` ៖ សំណើរបស់ម្ចាស់គម្រោង · ហេតុផល
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const APP = path.resolve(__dirname, '..');

const LOCK: Record<string, string> = {
    'src/features/zto-palm-login.ts': '8fd497a84a1b8863982b3b6f038930781f305e6661a4851f720e8725b311bd28',
    'netlify/functions/_shared/zto-palm.js': '77ab040fc568ee6b52b71a1fe784858289f7c21ee3d3536208ddf4d2e1d43f01',
    'netlify/functions/_shared/zto-order-detail-core.cjs': '443f7a269129b48d3d346414e1657ce6ee327386b37ab974c97b52dcc382eef1',
    'netlify/functions/zto-order-detail.mjs': '03b8bdc2ad2fa38c60880c3014e85c2de98238dc81439521941846c943833dd1',
    'src/features/zto-list-sync.ts': '4800d7e8bce2165e756f6d2d7ab3d7e9b7cf521330d224e144661b78ba6590cb',
    'src/features/zto-status.ts': '7c988173ccfd9bd5121b7a66a8c72b513e0faaff2c398ca8497f6faff7d7015f',
    'src/services/zto-shop-sweep.ts': '67591d931e8e64e4aa7af2dc10b5e80cd260dad0dab5523fc4e326f63a3349f8',
    'src/services/zto-sweep-lane.ts': '61eaed0acc2227da242be7d6a5bb40a838be377f087cdd579b22813834e518cf',
    'src/features/auto-lookup.ts': '0ed5c4c6d658a04b07062a108ea182fb315bed89749d5bd34546ef7e6c741212',
    'src/features/lookup-api.ts': 'cc50997115b218fc118cf69e7f9d4fd6f0f5594fe501498f93c262701b57c570',
    'src/app/components/zto/model.ts': 'ed245dd8ce348942528f243c89df45121c794c663d29644ed7762d510425cad9',
    'src/app/components/zto/ZtoListSyncBody.tsx': 'aedfa43f7fce10a5ecc1f30ba73abb7bd9b8c02cd8ca67af70e67bb23611fe4c',
    'src/app/components/modals/ZtoListSyncModal.tsx': 'c9d3c9bc49ac2d133ffefed161039040563994d4c0190a634e7bdb44cb2eb08e'
};

function lockedFingerprint(rel: string): string {
    const text = readFileSync(path.join(APP, rel), 'utf8').replace(/\r\n?/g, '\n');
    return createHash('sha256').update(text).digest('hex');
}

describe('⛔ សោ ZTO ៖ ឯកសារដែលផ្ទៀងផ្ទាត់រួច មិនត្រូវប្រែដោយគ្មានសំណើម្ចាស់គម្រោង', () => {
    it('ជាន់អប្បបរមា ៖ បញ្ជីសោមានឯកសារ ZTO ពិត (Function · ទាញបញ្ជី · ស្ថានភាព/បិទតាម ZTO · ប្រអប់)', () => {
        const files = Object.keys(LOCK);
        expect(files.length).toBeGreaterThanOrEqual(6);
        expect(files).toContain('netlify/functions/_shared/zto-order-detail-core.cjs');
        expect(files).toContain('netlify/functions/zto-order-detail.mjs');
        expect(files.filter((rel) => !existsSync(path.join(APP, rel)))).toEqual([]);
        expect(files.every((rel) => /^[0-9a-f]{64}$/.test(LOCK[rel]))).toBe(true);
    });

    for (const rel of Object.keys(LOCK)) {
        it('⛔ ' + rel + ' ដូចកំណែដែលចាក់សោ', () => {
            const actual = existsSync(path.join(APP, rel)) ? lockedFingerprint(rel) : 'missing';
            expect(actual, '⛔ តំបន់ ZTO ចាក់សោ (CLAUDE.md «Locked zone — ZTO») ៖ កែតែពេលម្ចាស់គម្រោងស្នើផ្ទាល់ ➜ អ្នកយាម ZTO បៃតង ➜ '
                + 'ដាក់ sha256 ថ្មីនេះក្នុង LOCK + កត់សំណើ/ហេតុផលក្នុង docs/HISTORY.md').toBe(LOCK[rel]);
        });
    }

    it('ទិសផ្ទុយ ៖ ការកែមួយតួអក្សរប្តូរស្នាមម្រាមដៃ (សោវាស់ការប្រែពិត)', () => {
        const rel = 'src/features/zto-status.ts';
        const text = readFileSync(path.join(APP, rel), 'utf8').replace(/\r\n?/g, '\n');
        const mutated = createHash('sha256').update(text.replace('ZTO_STATUS_SWEEP_BATCH = 10', 'ZTO_STATUS_SWEEP_BATCH = 11')).digest('hex');
        expect(text).toContain('ZTO_STATUS_SWEEP_BATCH = 10');
        expect(mutated).not.toBe(LOCK[rel]);
    });

    it('ទិសផ្ទុយ ៖ CRLF (checkout លើ Windows) មិនបំបែកសោ', () => {
        const rel = 'src/app/components/zto/model.ts';
        const text = readFileSync(path.join(APP, rel), 'utf8').replace(/\r\n?/g, '\n');
        const crlf = text.replace(/\n/g, '\r\n').replace(/\r\n?/g, '\n');
        expect(createHash('sha256').update(crlf).digest('hex')).toBe(LOCK[rel]);
    });
});
