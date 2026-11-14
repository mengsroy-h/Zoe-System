'use strict';
const assert = require('node:assert/strict');
const { isDeepStrictEqual } = require('node:util');
const clone = value => JSON.parse(JSON.stringify(value));
const OMIT = Symbol('palm-mode-predicate');

const palmPredicate = node => node?.t === 'b' && node.o === '!==' && node.r?.t === 'l' && node.r.v === 'palm'
    && node.l?.t === 'm' && node.l.n === 'val' && node.l.o?.t === 'm' && node.l.o.n === 'child'
    && node.l.o.a?.length === 1 && node.l.o.a[0]?.v === 'trashMode';

function rewrite(node, remove, newDataOnly, seen) {
    if (!node || typeof node !== 'object') return node;
    if (palmPredicate(node) && (!newDataOnly || node.l.o.o?.t === 'newData')) {
        seen.count++;
        if (remove) return OMIT;
        const reason = JSON.parse(JSON.stringify(node).replaceAll('"trashMode"', '"trashReason"'));
        reason.r.v = 'pickup';
        return { t: '||', l: clone(node), r: reason };
    }
    const next = Array.isArray(node) ? node.map(value => rewrite(value, remove, newDataOnly, seen))
        : Object.fromEntries(Object.entries(node).map(([key, value]) => [key, rewrite(value, remove, newDataOnly, seen)]));
    if (next.t === '&&') {
        if (next.l === OMIT) return next.r;
        if (next.r === OMIT) return next.l;
    }
    assert(!Object.values(next).includes(OMIT), 'Palm predicate ចេញក្រៅ AND ដែលបានពិនិត្យ');
    return next;
}

function palmRestorePolicyProjection(current, legacy) {
    const expected = clone(legacy);
    const paths = [
        [['c', 'zoew_scan_history_cod_dod', 'x', 'r', 'w'], true, false, 1],
        [['c', 'zoew_scan_history_cod_dod', 'x', 'r', 'c', 'restoreClaimId', 'v'], true, false, 2],
        [['c', 'zoew_scan_history_cod_dod', 'x', 'r', 'c', 'restoreClaimToken', 'v'], true, false, 2],
        [['c', 'zoew_recently_deleted_cod_dod', 'x', 'r', 'v'], false, true, 1],
        [['c', 'zoew_recently_deleted_cod_dod', 'x', 'r', 'c', 'restoreClaim', 'v'], false, false, 1],
        [['c', 'zoew_restore_finalizations', 'x', 'r', 'w'], false, false, 1],
        [['c', 'zoew_trash_consumptions', 'x', 'r', 'w'], false, false, 1]
    ];
    for (const [parts, remove, newDataOnly, count] of paths) {
        const parent = parts.slice(0, -1).reduce((node, key) => node[key], expected), key = parts.at(-1), seen = { count: 0 };
        parent[key] = rewrite(parent[key], remove, newDataOnly, seen);
        assert.equal(seen.count, count, 'ចំនួន Palm predicates ប្រែ៖ ' + parts.join('/'));
    }
    assert(isDeepStrictEqual(current, expected), 'rules ប្រែក្រៅ Palm restore policy ដែលបានពិនិត្យ');
    return clone(legacy);
}

module.exports = { palmRestorePolicyProjection };
