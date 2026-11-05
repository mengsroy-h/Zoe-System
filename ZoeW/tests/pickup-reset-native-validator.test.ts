import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { compileRules } from '../../supabase/scripts/rtdb-rules.mjs';

const repo = path.resolve(__dirname, '../..');
const rules = JSON.parse(readFileSync(path.join(repo, 'firebase-database.rules.json'), 'utf8'));
const node = rules.rules.zoew_daily_pickup_cod_dod.$date;
const day = '2026-11-01', key = 'pickupResetApplied', MAX = 9007199254740990;
const baseline = () => ({ packagesPickedUp: 2, pickedUpBarcodes: { SYNTHETIC_A: 'p1', SYNTHETIC_B: 'p2' }, pickedUpPhones: { p1: 1, p2: 1 }, pickupRevision: 5, pickupResetEpoch: 2 });
const receipt = (beforeRevision = 5, beforeEpoch = 2, attemptId = 'a'.repeat(64)) => ({ v: 1, outcome: 'applied', proof: 'native-day', tenant: 'demo-native-project', actorUid: 'actor-A', scope: 'https://demo-native-project.firebaseio.com', batchId: 'synthetic-batch', batchHash: 'b'.repeat(64), dayId: 'synthetic-batch:' + day, day, nonce: 'synthetic-nonce', attemptId, intentHash: attemptId, beforeRevision, beforeEpoch, afterRevision: beforeRevision + 1, afterEpoch: beforeEpoch + 1 });
const reset = (beforeRevision = 5, beforeEpoch = 2, proof = receipt(beforeRevision, beforeEpoch)) => ({ pickupRevision: beforeRevision + 1, pickupResetEpoch: beforeEpoch + 1, packagesPickedUp: 0, [key]: proof });
const OBJECT_SENTINEL = Symbol('RuleDataSnapshot child-data sentinel');
function canonical(value: any): any {
    if (value == null) return null;
    if (typeof value !== 'object') return value;
    const pairs = Object.entries(value).map(([k, v]) => [k, canonical(v)]).filter(([, v]) => v !== null);
    return pairs.length ? Object.fromEntries(pairs) : null;
}
function at(tree: any, parts: string[]): any { return parts.reduce((v, k) => v?.[k], tree) ?? null; }
function snap(tree: any, parts: string[]): any {
    const value = at(tree, parts);
    return { val: () => value && typeof value === 'object' ? OBJECT_SENTINEL : value,
        exists: () => value !== null, isString: () => typeof value === 'string', isBoolean: () => typeof value === 'boolean',
        isNumber: () => typeof value === 'number' && Number.isFinite(value),
        hasChildren: (names?: string[]) => value !== null && typeof value === 'object' && (names ? names.every(n => value[n] != null) : Object.keys(value).length > 0),
        child: (name: string) => snap(tree, [...parts, ...name.split('/')]), parent: () => snap(tree, parts.slice(0, -1)) };
}
function allowed(previous: any, proposed: any, uid: string | null = 'actor-A') {
    const pre = canonical({ zoew_daily_pickup_cod_dod: { [day]: previous } }), post = canonical({ zoew_daily_pickup_cod_dod: { [day]: proposed } });
    const location = ['zoew_daily_pickup_cod_dod', day];
    const test = (expression: any, parts: string[]) => typeof expression === 'boolean' ? expression
        : new Function('data', 'newData', 'root', 'auth', '$date', 'now', 'return (' + expression + ');')(snap(pre, parts), snap(post, parts), snap(pre, []), uid ? { uid } : null, day, 1700000000000);
    if (!test(node['.write'], location)) return false;
    const walk = (rule: any, parts: string[]): boolean => {
        const value = at(post, parts); if (value === null) return true;
        if (rule['.validate'] !== undefined && !test(rule['.validate'], parts)) return false;
        return typeof value !== 'object' || Object.keys(value).every(name => { const child = rule[name] || rule.$other; return !child || walk(child, [...parts, name]); });
    };
    return walk(node, location);
}

describe('F09 native same-commit expressions (model; actual engine separate)', () => {
    it('accepts exact Reset and APPLIED proof in the same day transition', () => expect(allowed(baseline(), reset())).toBe(true));
    it('accepts original legacy basis with before revision/epoch zero', () => expect(allowed({ packagesPickedUp: 2 }, reset(0, 0))).toBe(true));
    it('accepts an absent original day without inventing a date limit', () => expect(allowed(null, reset(0, 0))).toBe(true));
    it('preserves the latest proof under another ordinary operator pickup', () => {
        const previous = reset(); const next = { ...previous, pickupRevision: 7, packagesPickedUp: 1, pickedUpPhones: { newer: 1 }, pickedUpBarcodes: { SYNTHETIC_NEW: 'newer' } };
        expect(allowed(previous, next, 'actor-B')).toBe(true);
    });
    it('rejects an old writer dropping proof during an ordinary pickup', () => {
        const previous = reset(), next: any = { ...previous, pickupRevision: 7 }; delete next[key]; expect(allowed(previous, next)).toBe(false);
    });
    it('rejects an old Reset dropping proof even if its counters advance', () => expect(allowed(reset(), { packagesPickedUp: 0, pickupRevision: 7, pickupResetEpoch: 4 })).toBe(false));
    it('allows the next proven Reset to replace the single latest proof', () => expect(allowed(reset(), reset(6, 3, { ...receipt(6, 3, 'c'.repeat(64)), nonce: 'next-nonce' }))).toBe(true));
    it('rejects reusing the current attempt ID for another Reset', () => expect(allowed(reset(), reset(6, 3, receipt(6, 3)))).toBe(false));
    it('rejects receipt-only success without the Reset effects', () => expect(allowed(baseline(), { ...baseline(), [key]: receipt() })).toBe(false));
    it('rejects creating proof during an ordinary revision-only update', () => expect(allowed(baseline(), { ...baseline(), pickupRevision: 6, [key]: receipt() })).toBe(false));
    it('rejects a receipt with another authenticated actor', () => expect(allowed(baseline(), reset(5, 2, { ...receipt(), actorUid: 'actor-B' }))).toBe(false));
    it.each(['beforeRevision', 'beforeEpoch', 'afterRevision', 'afterEpoch'])('rejects mismatched %s basis/effect identity', field => {
        expect(allowed(baseline(), reset(5, 2, { ...receipt(), [field]: (receipt() as any)[field] + 1 }))).toBe(false);
    });
    it.each(Object.keys(receipt()))('rejects removing required %s', field => {
        const proof: any = receipt(); delete proof[field]; expect(allowed(baseline(), reset(5, 2, proof))).toBe(false);
    });
    it.each(Object.keys(receipt()))('rejects modifying original %s during ordinary pickup', field => {
        const previous = reset(), proof: any = { ...receipt() }; proof[field] = typeof proof[field] === 'number' ? proof[field] + 1 : proof[field] + '-changed';
        expect(allowed(previous, { ...previous, pickupRevision: 7, [key]: proof })).toBe(false);
    });
    it.each(['day', 'dayId', 'intentHash', 'proof', 'outcome'])('rejects wrong %s receipt semantics', field => {
        expect(allowed(baseline(), reset(5, 2, { ...receipt(), [field]: 'wrong-value' }))).toBe(false);
    });
    it('rejects unknown receipt fields and nonprimitive identity fields', () => {
        expect(allowed(baseline(), reset(5, 2, { ...receipt(), extra: true } as any))).toBe(false);
        expect(allowed(baseline(), reset(5, 2, { ...receipt(), nonce: { unexpected: true } } as any))).toBe(false);
    });
    it('retains legacy ordinary writes with no proof metadata', () => expect(allowed({ packagesPickedUp: 1 }, { packagesPickedUp: 2 })).toBe(true));
    it('does not newly deny legacy Reset before any proof exists', () => expect(allowed(baseline(), { pickupRevision: 6, pickupResetEpoch: 3, packagesPickedUp: 0 })).toBe(true));
    it('uses the existing integer boundary without an arbitrary new Reset budget', () => {
        expect(allowed({ ...baseline(), pickupRevision: MAX - 1, pickupResetEpoch: MAX - 1 }, reset(MAX - 1, MAX - 1))).toBe(true);
        expect(allowed({ ...baseline(), pickupRevision: MAX, pickupResetEpoch: MAX }, reset(MAX, MAX))).toBe(false);
    });
    it('keeps signed-out actors refused', () => expect(allowed(baseline(), reset(), null)).toBe(false));
    it('compiles through the unchanged shared expression parser', () => expect(() => compileRules(rules)).not.toThrow());
});
