'use strict';

const { NATIVE_F03_CANONICAL_GUARD: GUARD } = require('./rtdb-canonical-key.cjs');

const RULES_PUBLISH_MAX_BYTES = 251904;
const RULE_KEYS = new Set(['.read', '.write', '.validate']);
const OPERATORS = ['===', '!==', '==', '!=', '<=', '>=', '&&', '||', '++', '--', '<', '>', '!', '+', '-', '*', '/', '%', '(', ')', '.', ',', '[', ']'];
const WORD = /[A-Za-z0-9_$]/;

function ruleTokens(src) {
    const out = [];
    let i = 0;
    while (i < src.length) {
        if (src.startsWith(GUARD, i)) { out.push({ guard: true, text: GUARD }); i += GUARD.length; continue; }
        const ch = src[i];
        if (/\s/.test(ch)) { i++; continue; }
        if (ch === "'" || ch === '"') {
            let j = i + 1;
            while (j < src.length && src[j] !== ch) { if (src[j] === '\\') j++; j++; }
            if (j >= src.length) throw new Error('unterminated string in rule');
            out.push({ text: src.slice(i, j + 1) });
            i = j + 1;
            continue;
        }
        const word = /^[A-Za-z0-9_$]+/.exec(src.slice(i));
        if (word) { out.push({ text: word[0] }); i += word[0].length; continue; }
        const op = OPERATORS.find((candidate) => src.startsWith(candidate, i));
        if (!op) throw new Error('unexpected character ' + JSON.stringify(ch) + ' in rule');
        out.push({ text: op });
        i += op.length;
    }
    return out;
}

function needsSpace(left, right) {
    const a = left[left.length - 1], b = right[0];
    return (WORD.test(a) && WORD.test(b)) || ((a === '+' || a === '-') && (b === '+' || b === '-')) || (/[=!<>&|]/.test(a) && /[=&|]/.test(b));
}

function minifyRule(src) {
    let out = '', previous = null;
    for (const token of ruleTokens(src)) {
        if (previous !== null && needsSpace(previous, token.text)) out += ' ';
        out += token.text;
        previous = token.text;
    }
    return out;
}

function mapRules(node, fn) {
    if (node === null || typeof node !== 'object' || Array.isArray(node)) return node;
    const out = {};
    for (const [key, value] of Object.entries(node)) out[key] = RULE_KEYS.has(key) && typeof value === 'string' ? fn(value) : mapRules(value, fn);
    return out;
}

function minifyRulesText(sourceText) {
    return JSON.stringify(mapRules(JSON.parse(sourceText), minifyRule));
}

function tokenKey(src) {
    return JSON.stringify(ruleTokens(src).map((token) => (token.guard ? '\u0000G' : token.text)));
}

function rulesArtifactProblems(sourceText, artifactText) {
    const problems = [];
    let expected = null;
    try { expected = minifyRulesText(sourceText); } catch (error) { problems.push('source does not minify: ' + error.message); }
    if (expected !== null && artifactText !== expected) problems.push('artifact differs from minifyRulesText(source)');
    if (Buffer.byteLength(artifactText, 'utf8') > RULES_PUBLISH_MAX_BYTES) problems.push('artifact exceeds ' + RULES_PUBLISH_MAX_BYTES + ' bytes');
    let source, artifact;
    try { source = JSON.parse(sourceText); artifact = JSON.parse(artifactText); } catch (error) { problems.push('not JSON: ' + error.message); return problems; }
    const compare = (left, right, where, rule) => {
        if (rule && typeof left === 'string') {
            if (typeof right !== 'string') { problems.push('rule type differs at ' + where); return; }
            try {
                if (tokenKey(left) !== tokenKey(right)) problems.push('rule tokens differ at ' + where);
                if (left.split(GUARD).length !== right.split(GUARD).length) problems.push('guard count differs at ' + where);
            } catch (error) { problems.push('rule does not tokenize at ' + where + ': ' + error.message); }
            return;
        }
        if (left === null || typeof left !== 'object' || Array.isArray(left)) {
            if (JSON.stringify(left) !== JSON.stringify(right)) problems.push('value differs at ' + where);
            return;
        }
        if (right === null || typeof right !== 'object' || Array.isArray(right) || JSON.stringify(Object.keys(left)) !== JSON.stringify(Object.keys(right))) {
            problems.push('keys differ at ' + where);
            return;
        }
        for (const key of Object.keys(left)) compare(left[key], right[key], where + '/' + key, RULE_KEYS.has(key));
    };
    compare(source, artifact, '', false);
    return problems;
}

module.exports = { RULES_PUBLISH_MAX_BYTES, ruleTokens, minifyRule, minifyRulesText, rulesArtifactProblems };
