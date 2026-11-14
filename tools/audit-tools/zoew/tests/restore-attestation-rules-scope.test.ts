import { expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const root = path.resolve(__dirname, '../../../..');
const require = createRequire(import.meta.url);
const { restoreAttestationRulesProjection } = require(root + '/tools/audit-tools/restore-attestation-rules-scope.cjs');
const load = (version: string) => JSON.parse(fs.readFileSync(root + '/supabase/migrations/' + version + '_zoe_rules.sql', 'utf8').split('$zoe_rules_json$')[1]);
const before = load('20261114010845'), after = load('20261114161533');
it('projects only the reviewed ten attestation deltas and preserves both input trees', () => {
    const saved = JSON.stringify(after);
    expect(restoreAttestationRulesProjection(after, before)).toEqual(before);
    expect(JSON.stringify(after)).toBe(saved);
});
for (const [name, mutate] of [
    ['unrelated revenue rule', (r: any) => { r.c.zoew_daily_revenue_cod_dod.x.r.v = { t: 'l', v: true }; }],
    ['approved proof gate removed', (r: any) => { r.c.zoew_recently_deleted_cod_dod.x.r.w = { t: 'l', v: true }; }],
    ['private namespace made writable', (r: any) => { r.c.zoew_restore_attestations.w = { t: 'l', v: true }; }],
    ['optimization hint poisoned', (r: any) => { r.c.zoew_scan_history_cod_dod.x.r.w.f = { b: 'r', l: ['foreign'] }; }]
] as const) it('rejects a controlled mutation: ' + name, () => {
    const changed = structuredClone(after); mutate(changed);
    expect(() => restoreAttestationRulesProjection(changed, before)).toThrow();
});
