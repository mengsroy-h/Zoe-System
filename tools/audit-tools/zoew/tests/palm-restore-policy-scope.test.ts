import { expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const root = path.resolve(__dirname, '../../../..');
const require = createRequire(import.meta.url);
const { palmRestorePolicyProjection } = require(root + '/tools/audit-tools/palm-restore-policy-scope.cjs');
const load = (file: string) => JSON.parse(fs.readFileSync(root + '/supabase/migrations/' + file, 'utf8').split('$zoe_rules_json$')[1]);
const legacy = load('20261109122019_zoe_rules.sql');
const current = load('20261114010845_zoe_rules.sql');

it('Palm projection អនុញ្ញាតតែ delta ដែលបានពិនិត្យ ហើយមិនប្ដូរ AST ដើម', () => {
    const before = JSON.stringify(current);
    expect(palmRestorePolicyProjection(current, legacy)).toEqual(legacy);
    expect(JSON.stringify(current)).toBe(before);
});
for (const [name, mutate] of [
    ['history write', (r: any) => { r.c.zoew_scan_history_cod_dod.x.r.w = { t: 'l', v: true }; }],
    ['trash block schema', (r: any) => { delete r.c.zoew_recently_deleted_cod_dod.x.r.c.restoreBlocked; }],
    ['pickup policy', (r: any) => { r.c.zoew_daily_pickup_cod_dod.x.r.w = { t: 'l', v: true }; }],
    ['finalization', (r: any) => { r.c.zoew_restore_finalizations.x.r.w = { t: 'l', v: true }; }]
] as const) {
    it('Palm projection ចាប់ការប្រែក្រៅ scope ៖ ' + name, () => {
        const changed = structuredClone(current);
        mutate(changed);
        expect(() => palmRestorePolicyProjection(changed, legacy)).toThrow(/Palm restore policy/);
    });
}
