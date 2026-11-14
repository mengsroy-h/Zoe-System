'use strict';

const assert = require('node:assert/strict');
const { parseExpression } = require('../../../../../supabase/scripts/rtdb-expression.cjs');
const { ruleTokens, minifyRule } = require('../../../../../supabase/scripts/rtdb-rules-artifact.cjs');
const { NATIVE_F03_CANONICAL_GUARD: GUARD } = require('../../../../../supabase/scripts/rtdb-canonical-key.cjs');
const LEVEL = { '||': 1, '&&': 2, '===': 3, '!==': 3, '==': 3, '!=': 3, '<': 4, '>': 4, '<=': 4, '>=': 4, '+': 5, '-': 5, '*': 6, '/': 6, '%': 6 };

// This migration helper changes grouping only. The Publish token minifier is
// untouched. Ordered Boolean operands, every other AST node, literal spelling
// and the opaque F03 guard must remain identical or the operation throws.
function flatten(node) {
    if (!node || typeof node !== 'object') return node;
    if (Array.isArray(node)) return node.map(flatten);
    if (node.t === '&&' || node.t === '||') {
        const ordered = value => value.t === node.t ? [...ordered(value.l), ...ordered(value.r)] : [flatten(value)];
        return { t: node.t, ordered: ordered(node) };
    }
    return Object.fromEntries(Object.entries(node).map(([key, value]) => [key, flatten(value)]));
}
function nonGroupingTokens(source) {
    return ruleTokens(source).filter(token => token.guard || !['(', ')'].includes(token.text)).map(token => token.text);
}
function assertBooleanGroupingEquivalent(before, after, scope) {
    assert.deepEqual(nonGroupingTokens(after), nonGroupingTokens(before), 'non-grouping tokens differ');
    assert.deepEqual(flatten(parseExpression(after, scope)), flatten(parseExpression(before, scope)), 'ordered Boolean AST differs');
}
function normalizeBooleanGroups(source, scope) {
    const ast = parseExpression(source, scope), tokens = ruleTokens(source), atoms = [];
    for (let index = 0; index < tokens.length; index++) {
        const token = tokens[index];
        if (token.guard) continue;
        if (/^['"0-9]/.test(token.text) || ['true', 'false', 'null'].includes(token.text)) {
            let text = token.text;
            if (/^[0-9]/.test(text) && tokens[index + 1]?.text === '.' && /^[0-9]/.test(tokens[index + 2]?.text || '')) {
                text += '.' + tokens[index + 2].text; index += 2;
            }
            atoms.push(text);
        }
    }
    let cursor = 0;
    const precedence = node => node.t === 'b' ? LEVEL[node.o] : LEVEL[node.t] || (node.t === 'u' ? 7 : 9);
    const emit = node => {
        if (node.t === 'l') return atoms[cursor++];
        if (node.t === 'f03_registry_key') return GUARD;
        if (['root', 'data', 'newData', 'auth', 'now'].includes(node.t)) return node.t;
        if (node.t === 'auth_uid') return 'auth.uid';
        if (node.t === 'auth_claim') return 'auth.token.' + node.n;
        if (node.t === 'v') return node.n;
        if (node.t === 'arr') return '[' + node.items.map(emit).join(',') + ']';
        if (node.t === 'p') return emit(node.o) + '.' + node.n;
        if (node.t === 'm') return emit(node.o) + '.' + node.n + '(' + node.a.map(emit).join(',') + ')';
        if (node.t === 'u') {
            const inner = emit(node.e);
            return node.o + (precedence(node.e) < 7 ? '(' + inner + ')' : node.o === '-' && inner.startsWith('-') ? ' ' + inner : inner);
        }
        if (!['b', '&&', '||'].includes(node.t)) throw new Error('unsupported grouping node ' + node.t);
        const op = node.t === 'b' ? node.o : node.t, left = emit(node.l), right = emit(node.r), level = precedence(node);
        const rightGrouped = precedence(node.r) < level || precedence(node.r) === level
            && !(op === '&&' && node.r.t === '&&' || op === '||' && node.r.t === '||');
        return (precedence(node.l) < level ? '(' + left + ')' : left) + op + (rightGrouped ? '(' + right + ')' : right);
    };
    const result = minifyRule(emit(ast));
    assert.equal(cursor, atoms.length, 'literal consumption differs');
    assertBooleanGroupingEquivalent(source, result, scope);
    return result;
}
module.exports = { normalizeBooleanGroups, assertBooleanGroupingEquivalent, nonGroupingTokens };

function expandChildPaths(node) {
    if (!node || typeof node !== 'object') return node;
    if (Array.isArray(node)) return node.map(expandChildPaths);
    if (node.t === 'm' && node.n === 'child') {
        const parts = value => value.t === 'l' && typeof value.v === 'string' ? [value.v]
            : value.t === 'v' ? [{ variable: value.n }]
                : value.t === 'b' && value.o === '+' && parts(value.l) && parts(value.r) ? [...parts(value.l), ...parts(value.r)] : null;
        const list = parts(node.a[0]);
        if (list) {
            const segments = list.map(part => typeof part === 'string' ? part : '\u0001' + part.variable + '\u0001').join('').split('/').filter(Boolean);
            if (segments.every(segment => !segment.includes('\u0001') || /^\u0001\$[A-Za-z0-9_]+\u0001$/.test(segment))) {
                let out = expandChildPaths(node.o);
                for (const segment of segments) out = { t: 'm', n: 'child', o: out,
                    a: [segment.startsWith('\u0001') ? { t: 'v', n: segment.slice(1, -1) } : { t: 'l', v: segment }] };
                return out;
            }
        }
    }
    return Object.fromEntries(Object.entries(node).map(([key, value]) => [key, expandChildPaths(value)]));
}
function assertWildcardChildPathsEquivalent(before, after, scope) {
    assert.deepEqual(expandChildPaths(parseExpression(after, scope)), expandChildPaths(parseExpression(before, scope)), 'expanded child paths differ');
}
function shortenWildcardChildPaths(source, scope) {
    const protectedGuard = source.replaceAll(GUARD, '__OPAQUE_F03_GUARD__');
    const result = protectedGuard.replace(/\.child\('([A-Za-z0-9_/-]+)'\)\.child\((\$[A-Za-z0-9_]+)\)\.child\('([A-Za-z0-9_/-]+)'\)/g,
        (_match, first, variable, last) => ".child('" + first + "/'+" + variable + "+'/" + last + "')").replaceAll('__OPAQUE_F03_GUARD__', GUARD);
    assertWildcardChildPathsEquivalent(source, result, scope);
    return result;
}
module.exports.shortenWildcardChildPaths = shortenWildcardChildPaths;
module.exports.assertWildcardChildPathsEquivalent = assertWildcardChildPathsEquivalent;
