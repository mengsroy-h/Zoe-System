import { expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const root = path.resolve(__dirname, '../../../..');
const require = createRequire(import.meta.url);
const { restoreAttestationRulesProjection, restorePublicationRulesProjection, restoreTerminalDecisionRulesProjection, restorePurgeAllowRulesProjection } = require(root + '/tools/audit-tools/restore-attestation-rules-scope.cjs');
const load = (version: string) => JSON.parse(fs.readFileSync(root + '/supabase/migrations/' + version + '_zoe_rules.sql', 'utf8').split('$zoe_rules_json$')[1]);
const before = load('20261114010845'), after = load('20261114161533');
const publication = load('20261114181432');
const terminal = load('20261114192006');
const purgeAllow = load('20261120075734');
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
it('projects only the exact publication fence and preserves the committed attestation tree', () => {
    const saved = JSON.stringify(publication);
    expect(restorePublicationRulesProjection(publication)).toEqual(after);
    expect(restoreAttestationRulesProjection(publication, before)).toEqual(before);
    expect(JSON.stringify(publication)).toBe(saved);
});
for (const [name, mutate] of [
    ['publication preservation removed', (r: any) => { r.c.zoew_recently_deleted_cod_dod.x.r.v = r.c.zoew_recently_deleted_cod_dod.x.r.v.l; }],
    ['publication field made writable', (r: any) => { r.c.zoew_recently_deleted_cod_dod.x.r.c.restorePublication.w = { t: 'l', v: true }; }],
    ['publication numeric guard removed', (r: any) => { r.c.zoew_recently_deleted_cod_dod.x.r.c.restorePublication.v = { t: 'l', v: true }; }],
    ['unrelated financial validator changed', (r: any) => { r.c.zoew_daily_revenue_cod_dod.x.r.v = { t: 'l', v: true }; }],
    ['publication optimization hint poisoned', (r: any) => { r.c.zoew_recently_deleted_cod_dod.x.r.v.r.l.o.f = { b: 'r', l: ['foreign'] }; }]
] as const) it('rejects a controlled publication mutation: ' + name, () => {
    const changed = structuredClone(publication); mutate(changed);
    expect(() => restorePublicationRulesProjection(changed)).toThrow();
    expect(() => restoreAttestationRulesProjection(changed, before)).toThrow();
});
it('projects only the terminal enum, preservation and four local-path vetoes, preserving both full historical projections', () => {
    const saved = JSON.stringify(terminal);
    expect(restoreTerminalDecisionRulesProjection(terminal)).toEqual(publication);
    expect(restoreAttestationRulesProjection(terminal, before)).toEqual(before);
    expect(JSON.stringify(terminal)).toBe(saved);
});
for (const [name, mutate] of [
    ['terminal enum made client-writable', (r: any) => { r.c.zoew_recently_deleted_cod_dod.x.r.c.ztoTerminalDecision.w = { t: 'l', v: true }; }],
    ['terminal preservation removed', (r: any) => { r.c.zoew_recently_deleted_cod_dod.x.r.v = r.c.zoew_recently_deleted_cod_dod.x.r.v.l; }],
    ['terminal final-delete veto removed', (r: any) => { r.c.zoew_recently_deleted_cod_dod.x.r.w = r.c.zoew_recently_deleted_cod_dod.x.r.w.l; }],
    ['local claim veto removed', (r: any) => { r.c.zoew_recently_deleted_cod_dod.x.r.c.restoreClaim.v = r.c.zoew_recently_deleted_cod_dod.x.r.c.restoreClaim.v.l; }],
    ['unrelated money permission changed', (r: any) => { r.c.zoew_daily_revenue_cod_dod.x.r.w = { t: 'l', v: true }; }]
] as const) it('rejects a controlled terminal decision mutation: ' + name, () => {
    const changed = structuredClone(terminal); mutate(changed);
    expect(() => restoreTerminalDecisionRulesProjection(changed)).toThrow();
    expect(() => restoreAttestationRulesProjection(changed, before)).toThrow();
});
it('projects only the exact whole-row purge write allowance on restorePublication and ztoTerminalDecision', () => {
    const saved = JSON.stringify(purgeAllow);
    expect(restorePurgeAllowRulesProjection(purgeAllow)).toEqual(terminal);
    expect(restoreAttestationRulesProjection(purgeAllow, before)).toEqual(before);
    expect(JSON.stringify(purgeAllow)).toBe(saved);
});
for (const [name, mutate] of [
    ['restorePublication made freely writable', (r: any) => { r.c.zoew_recently_deleted_cod_dod.x.r.c.restorePublication.w = { t: 'l', v: true }; }],
    ['ztoTerminalDecision made freely writable', (r: any) => { r.c.zoew_recently_deleted_cod_dod.x.r.c.ztoTerminalDecision.w = { t: 'l', v: true }; }],
    ['restoreAttestationId made purge-writable', (r: any) => { r.c.zoew_recently_deleted_cod_dod.x.r.c.restoreAttestationId.w = r.c.zoew_recently_deleted_cod_dod.x.r.c.restorePublication.w; }]
] as const) it('rejects a controlled purge-allow mutation: ' + name, () => {
    const changed = structuredClone(purgeAllow); mutate(changed);
    expect(() => restorePurgeAllowRulesProjection(changed)).toThrow();
    expect(() => restoreAttestationRulesProjection(changed, before)).toThrow();
});
