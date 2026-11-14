import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';

const req = createRequire(import.meta.url);
const { normalizeBooleanGroups, assertBooleanGroupingEquivalent, nonGroupingTokens } = req('./helpers/rules-boolean-grouping.cjs');
const { NATIVE_F03_CANONICAL_GUARD: guard } = req('../../../../supabase/scripts/rtdb-canonical-key.cjs');

it.each([
    "auth != null && (data.exists() && (newData.exists() && !newData.hasChild('x')))",
    "data.exists() || (newData.exists() || !data.hasChild('x'))",
    "(data.exists() || newData.exists()) && (auth != null || data.child('x').val() === 0)",
    "newData.child('x').val() - (data.child('x').val() - 0.01) > 1 && (true && false)",
    "newData.child('x').val() / (data.child('x').val() * 2) > 1 || (true || false)",
    "auth.token.auth_time * 1000 === data.child('authTime').val() && (auth.token.session_id === data.child('sessionId').val() && auth != null)"
])('ការបង្រួម grouping រក្សា token លំដាប់ និង semantics ៖ %s', expression => {
    const normalized = normalizeBooleanGroups(expression, []);
    expect(() => assertBooleanGroupingEquivalent(expression, normalized, [])).not.toThrow();
    expect(nonGroupingTokens(normalized)).toEqual(nonGroupingTokens(expression));
    expect(normalizeBooleanGroups(normalized, [])).toBe(normalized);
});

it('មិនប៉ះ opaque F03 guard ឬ literal នៅខាងក្នុង', () => {
    const expression = `${guard} && (true && (false || true))`;
    const normalized = normalizeBooleanGroups(expression, ['$releaseId']);
    expect(normalized).toContain(guard);
    expect(nonGroupingTokens(normalized)).toEqual(nonGroupingTokens(expression));
});

it.each([
    ['data.exists() && newData.exists()', 'data.exists() || newData.exists()'],
    ["data.child('x').val() === 7", "data.child('x').val() === 8"],
    ['data.exists() && newData.exists()', 'newData.exists() && data.exists()'],
    ['data.exists() && (newData.exists() || auth != null)', '(data.exists() && newData.exists()) || auth != null']
])('controlled mutation ត្រូវបរាជ័យ (%s)', (before, after) => {
    expect(() => assertBooleanGroupingEquivalent(before, after, [])).toThrow();
});

it('canonical rules គ្រប់ expression មាន grouping equivalence និង fixed point ពិត', () => {
    const rules = JSON.parse(readFileSync(resolve(import.meta.dirname, '../../../../firebase-database.rules.json'), 'utf8'));
    let checked = 0;
    const visit = (node: any, scope: string[] = []) => {
        for (const [key, value] of Object.entries(node)) {
            if (['.read', '.write', '.validate'].includes(key) && typeof value === 'string') {
                const normalized = normalizeBooleanGroups(value, scope);
                expect(() => assertBooleanGroupingEquivalent(value, normalized, scope)).not.toThrow();
                expect(normalizeBooleanGroups(normalized, scope)).toBe(normalized);
                checked++;
            } else if (value && typeof value === 'object' && !Array.isArray(value)) visit(value, key.startsWith('$') ? [...scope, key] : scope);
        }
    };
    visit(rules);
    expect(checked).toBe(392);
});
