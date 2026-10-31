import expression from './rtdb-expression.cjs';
const { parseExpression } = expression;
export { parseExpression };

const RULE_KEYS = new Set(['.read', '.write', '.validate', '.indexOn']);
const KEY_RE = /^[^[\].#$/\u0000-\u001F\u007F]+$/;
const VAR_RE = /^\$[A-Za-z_][A-Za-z0-9_]*$/;


function compileNode(raw, scope, where) {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('rule node must be an object at ' + where);
    const node = {};
    let wildcard = null;
    for (const [key, value] of Object.entries(raw)) {
        if (key.startsWith('.')) {
            if (!RULE_KEYS.has(key)) throw new Error('unknown rule ' + key + ' at ' + where);
            if (key === '.write') node.w = parseExpression(value, scope);
            if (key === '.validate') node.v = parseExpression(value, scope);
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
