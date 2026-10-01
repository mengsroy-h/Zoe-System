const METHODS = new Map([
    ['child', 1], ['parent', 0], ['val', 0], ['exists', 0], ['isString', 0], ['isNumber', 0], ['isBoolean', 0],
    ['hasChildren', -1], ['hasChild', 1]
]);
const PROPERTIES = new Set(['length']);
const BINARY = [['||'], ['&&'], ['===', '!==', '==', '!='], ['<=', '>=', '<', '>'], ['+', '-'], ['*', '/', '%']];
const PUNCT = ['===', '!==', '==', '!=', '<=', '>=', '&&', '||', '<', '>', '!', '+', '-', '*', '/', '%', '(', ')', '.', ',', '[', ']'];
const RULE_KEYS = new Set(['.read', '.write', '.validate', '.indexOn']);
const KEY_RE = /^[^[\].#$/\u0000-\u001F\u007F]+$/;
const VAR_RE = /^\$[A-Za-z_][A-Za-z0-9_]*$/;

function tokenize(src) {
    const out = [];
    let i = 0;
    while (i < src.length) {
        const ch = src[i];
        if (/\s/.test(ch)) { i++; continue; }
        if (ch === "'" || ch === '"') {
            let j = i + 1;
            let text = '';
            while (j < src.length && src[j] !== ch) {
                if (src[j] === '\\') {
                    const next = src[j + 1];
                    if (next === undefined) throw new Error('unterminated escape');
                    text += next === 'n' ? '\n' : next === 't' ? '\t' : next;
                    j += 2;
                    continue;
                }
                text += src[j];
                j++;
            }
            if (j >= src.length) throw new Error('unterminated string');
            out.push({ k: 'str', v: text });
            i = j + 1;
            continue;
        }
        const num = /^(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?/.exec(src.slice(i));
        if (num && /[0-9.]/.test(ch)) {
            out.push({ k: 'num', v: Number(num[0]) });
            i += num[0].length;
            continue;
        }
        const ident = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(src.slice(i));
        if (ident) {
            out.push({ k: 'id', v: ident[0] });
            i += ident[0].length;
            continue;
        }
        const p = PUNCT.find((x) => src.startsWith(x, i));
        if (!p) throw new Error('unexpected character ' + JSON.stringify(ch) + ' at ' + i);
        out.push({ k: 'p', v: p });
        i += p.length;
    }
    out.push({ k: 'end' });
    return out;
}

export function parseExpression(src, scope) {
    if (src === true || src === false) return { t: 'l', v: src };
    if (typeof src !== 'string') throw new Error('rule must be a string or boolean');
    const toks = tokenize(src);
    let pos = 0;
    const peek = () => toks[pos];
    const eat = (k, v) => {
        const t = toks[pos];
        if (t.k !== k || (v !== undefined && t.v !== v)) throw new Error('expected ' + (v || k) + ' at token ' + pos + ' in ' + src);
        pos++;
        return t;
    };
    const isP = (v) => peek().k === 'p' && peek().v === v;
    function level(n) {
        if (n === BINARY.length) return unary();
        let left = level(n + 1);
        while (peek().k === 'p' && BINARY[n].includes(peek().v)) {
            const op = eat('p').v;
            const right = level(n + 1);
            left = op === '&&' || op === '||' ? { t: op, l: left, r: right } : { t: 'b', o: op, l: left, r: right };
        }
        return left;
    }
    function unary() {
        if (isP('!')) { eat('p'); return { t: 'u', o: '!', e: unary() }; }
        if (isP('-')) { eat('p'); return { t: 'u', o: '-', e: unary() }; }
        return postfix();
    }
    function postfix() {
        let node = primary();
        for (;;) {
            if (!isP('.')) break;
            eat('p', '.');
            const name = eat('id').v;
            if (isP('(')) {
                eat('p', '(');
                const args = [];
                if (!isP(')')) {
                    args.push(level(0));
                    while (isP(',')) { eat('p'); args.push(level(0)); }
                }
                eat('p', ')');
                if (!METHODS.has(name)) throw new Error('unsupported method ' + name + ' in ' + src);
                const arity = METHODS.get(name);
                if (arity >= 0 && args.length !== arity) throw new Error(name + ' expects ' + arity + ' argument(s) in ' + src);
                if (arity < 0 && args.length > 1) throw new Error(name + ' expects at most 1 argument in ' + src);
                node = { t: 'm', n: name, o: node, a: args };
            } else {
                if (!PROPERTIES.has(name)) throw new Error('unsupported property ' + name + ' in ' + src);
                node = { t: 'p', n: name, o: node };
            }
        }
        return node;
    }
    function primary() {
        const t = peek();
        if (t.k === 'num') { pos++; return { t: 'l', v: t.v }; }
        if (t.k === 'str') { pos++; return { t: 'l', v: t.v }; }
        if (t.k === 'p' && t.v === '(') { pos++; const e = level(0); eat('p', ')'); return e; }
        if (t.k === 'p' && t.v === '[') {
            pos++;
            const items = [];
            if (!isP(']')) {
                items.push(level(0));
                while (isP(',')) { eat('p'); items.push(level(0)); }
            }
            eat('p', ']');
            return { t: 'arr', items };
        }
        if (t.k === 'id') {
            pos++;
            if (t.v === 'true' || t.v === 'false') return { t: 'l', v: t.v === 'true' };
            if (t.v === 'null') return { t: 'l', v: null };
            if (t.v === 'now') return { t: 'now' };
            if (t.v === 'auth') return { t: 'auth' };
            if (t.v === 'root' || t.v === 'data' || t.v === 'newData') return { t: t.v };
            if (t.v.startsWith('$')) {
                if (!scope.includes(t.v)) throw new Error('variable ' + t.v + ' not in scope in ' + src);
                return { t: 'v', n: t.v };
            }
            throw new Error('unknown identifier ' + t.v + ' in ' + src);
        }
        throw new Error('unexpected token in ' + src);
    }
    const ast = level(0);
    if (peek().k !== 'end') throw new Error('trailing tokens in ' + src);
    return ast;
}

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
