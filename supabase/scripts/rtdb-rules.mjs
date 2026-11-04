import expression from './rtdb-expression.cjs';
const { parseExpression } = expression;
export { parseExpression };

const RULE_KEYS = new Set(['.read', '.write', '.validate', '.indexOn']);
const KEY_RE = /^[^[\].#$/\u0000-\u001F\u007F]+$/;
const VAR_RE = /^\$[A-Za-z_][A-Za-z0-9_]*$/;
const FOLD_BAD_RE = /[\]\[.#$/\u0000-\u001F\u007F]/;
const BASES = { root: 'r', data: 'd', newData: 'n' };

function foldKey(segment) {
    const bytes = Buffer.byteLength(segment, 'utf8');
    return bytes >= 1 && bytes <= 768 && !FOLD_BAD_RE.test(segment);
}

function foldOf(node) {
    if (!node || node.t !== 'm' || (node.n !== 'child' && node.n !== 'parent')) return null;
    const inner = BASES[node.o.t] ? { b: BASES[node.o.t], u: 0, s: [] } : foldOf(node.o);
    if (!inner) return null;
    if (node.n === 'parent') return inner.s.length ? null : { b: inner.b, u: inner.u + 1, s: [] };
    const arg = node.a[0];
    if (arg.t === 'v') return { b: inner.b, u: inner.u, s: inner.s.concat({ v: arg.n }) };
    if (arg.t !== 'l' || typeof arg.v !== 'string') return null;
    const segments = arg.v.split('/').filter((segment) => segment !== '');
    if (!segments.length || !segments.every(foldKey)) return null;
    return { b: inner.b, u: inner.u, s: inner.s.concat(segments) };
}

function annotate(node) {
    if (!node || typeof node !== 'object') return node;
    const fold = foldOf(node);
    if (fold) {
        node.f = { b: fold.b };
        if (fold.u) node.f.u = fold.u;
        if (fold.s.length) node.f[fold.s.every((segment) => typeof segment === 'string') ? 'l' : 's'] = fold.s;
        return node;
    }
    for (const key of ['o', 'l', 'r', 'e']) if (node[key]) annotate(node[key]);
    for (const key of ['a', 'items']) if (Array.isArray(node[key])) node[key].forEach(annotate);
    return node;
}


function compileNode(raw, scope, where) {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('rule node must be an object at ' + where);
    const node = {};
    let wildcard = null;
    for (const [key, value] of Object.entries(raw)) {
        if (key.startsWith('.')) {
            if (!RULE_KEYS.has(key)) throw new Error('unknown rule ' + key + ' at ' + where);
            if (key === '.write') node.w = annotate(parseExpression(value, scope));
            if (key === '.validate') node.v = annotate(parseExpression(value, scope));
            continue;
        }
        if (key.startsWith('$')) {
            if (!VAR_RE.test(key)) throw new Error('bad wildcard ' + key + ' at ' + where);
            if (wildcard) throw new Error('two wildcards at ' + where);
            if (scope.includes(key)) throw new Error('wildcard ' + key + ' shadows an outer one at ' + where);
            wildcard = { n: key, r: compileNode(value, scope.concat(key), where + '/' + key) };
            continue;
        }
        if (!KEY_RE.test(key)) throw new Error('bad key ' + key + ' at ' + where);
        node.c = node.c || {};
        node.c[key] = compileNode(value, scope, where + '/' + key);
    }
    if (wildcard) node.x = wildcard;
    return node;
}

export function compileRules(json) {
    if (!json || typeof json !== 'object' || !json.rules) throw new Error('rules file must contain "rules"');
    return compileNode(json.rules, [], '');
}

export function rulesSql(tree) {
    const text = JSON.stringify(tree);
    if (text.includes('$zoe_rules_json$')) throw new Error('rules text contains the SQL quote tag');
    let tag = 'zoe_rules';
    while (text.includes('$' + tag + '$')) tag += '_x';
    return 'create or replace function private.zoe_rules() returns jsonb\n'
        + "language sql immutable parallel safe set search_path = ''\n"
        + 'as $' + tag + '$\n    select $zoe_rules_json$' + text + '$zoe_rules_json$::jsonb\n$' + tag + '$;\n\n'
        + 'revoke all on function private.zoe_rules() from public;\n';
}
