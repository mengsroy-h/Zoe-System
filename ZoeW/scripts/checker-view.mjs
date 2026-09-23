/**
 * **ទិដ្ឋភាពអត្ថបទសម្រាប់ checker** ៖ សាង `app.js` ដែលមានរូបរាងដូច `app.js` ដើម ពីប្រភព TypeScript
 * ពិត — សម្រាប់ checker ក្នុង `audit-tools/` ដែលស្រង់ function · ថេរ · ប្លុកកូដ **តាមអត្ថបទ** ចូល `vm`។
 *
 * ⛔ ឯកសារនេះ **មិនដែលរត់** (`index.html` ផ្ទុក build របស់ Vite) — វាជាអត្ថបទសម្រាប់វាស់ប៉ុណ្ណោះ។
 *
 * ការប្តូរទាំងអស់ **ជាមេកានិច** ហើយ **មិនបន្ថែម/ដកតក្កវិជ្ជា** ៖
 *
 *   ១. **លុបតែ syntax របស់ type** ពីអត្ថបទដើម (`: T` · `as T` · `!` · `<T>` · `interface` · `type` ·
 *      `import type`) — តួអក្សរផ្សេងទៀត **ដដែលបេះបិទ** (quote · ជួរ · `if (x) return y;` មួយជួរ)។
 *      ⛔ ផ្ទៀងផ្ទាត់ **token ទល់ token** ជាមួយ `stripTypeScriptTypes()` របស់ Node (អ្នកលុប type ឯករាជ្យ)
 *      ➜ ខុសមួយ token ➜ បោះកំហុស (មិនមែនទិដ្ឋភាពខុសដោយស្ងាត់)។
 *   ២. `import.meta.env.*` ➜ តម្លៃដែល Vite ជំនួសពេល build ផលិតកម្ម (`PROD` · `DEV` · `MODE` · `VITE_*`)។
 *   ៣. ដក comment (`app.js` ដើមគ្មាន comment — ច្បាប់ ៣) · ដក `import`/`export` (ពាក្យ `export ` តែប៉ុណ្ណោះ)។
 *   ៤. `<ឃ្លាំង>.<វាល>` ➜ `<វាល>` សម្រាប់តែ state ដើម (`src/_generated-state.json`) — ឃ្លាំងជា Proxy ដែល
 *      សរសេរ/អានវាលដដែល (`logic-identity.mjs` ធ្វើការធ្វើឲ្យស្មើដដែលនេះ)។
 *   ៥. indent +៤ (App ដើមជា script កម្រិតកំពូល indent ៤) — លើកលែងជួរក្នុង template literal។
 *   ៦. **ស្រទាប់ចូល DOM របស់ React ➜ សមមូលដើម** (`VIEW_OVERRIDES`) ៖ `elementOf(name)` ➜
 *      `document.getElementById(name)` (ឈ្មោះ ref = id របស់ធាតុ — `refSelectorsFromJsx()` ផ្ទៀងផ្ទាត់ពី JSX
 *      ពិត ហើយធាតុដែលគ្មាន id ប្រើ selector ពិតរបស់វា) · `commitNow()`/`renderNow()` ➜ ទទេ (App ដើមកែ
 *      DOM ផ្ទាល់ ➜ គ្មានអ្វីត្រូវ «ចុះ»)។ ⛔ មានតែ function ទាំងនេះ — តក្កវិជ្ជាអាជីវកម្មមិនប៉ះ។
 */
import ts from 'typescript';
import * as acorn from 'acorn';
import { stripTypeScriptTypes } from 'node:module';

function colonBefore(src, at) {
    let i = at - 1;
    while (i >= 0 && /\s/.test(src[i])) i--;
    if (src[i] === ':') return i;
    if (src[i] === '?' ) return i;
    return -1;
}

/** ជួរអក្សរ (start · end) ដែលត្រូវលុប — syntax របស់ type តែប៉ុណ្ណោះ */
function typeRanges(sf, src) {
    const ranges = [];
    const add = (a, b) => { if (b > a) ranges.push([a, b]); };
    const wholeStatement = (node) => {
        let end = node.getEnd();
        if (src[end] === '\n') end++;
        let start = node.getStart(sf);
        while (start > 0 && (src[start - 1] === ' ' || src[start - 1] === '\t')) start--;
        add(start, end);
    };
    const annotation = (typeNode, extraStartNode) => {
        const c = colonBefore(src, typeNode.getStart(sf));
        if (c < 0) throw new Error('រក `:` មុន type មិនឃើញ ៖ ' + sf.fileName + ':' + sf.getLineAndCharacterOfPosition(typeNode.getStart(sf)).line);
        let start = c;
        if (extraStartNode) start = Math.min(start, extraStartNode.getStart(sf));
        add(start, typeNode.getEnd());
    };
    const typeParams = (list) => {
        if (!list || !list.length) return;
        let a = list.pos - 1;
        while (src[a] !== '<') a--;
        let b = list.end;
        while (src[b] !== '>') b++;
        add(a, b + 1);
    };
    const visit = (node) => {
        if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) { wholeStatement(node); return; }
        if (ts.isImportDeclaration(node) && node.importClause && node.importClause.isTypeOnly) { wholeStatement(node); return; }
        if (ts.isExportDeclaration(node) && node.isTypeOnly) { wholeStatement(node); return; }
        if (ts.isImportSpecifier(node) && node.isTypeOnly) {
            let a = node.getStart(sf);
            let b = node.getEnd();
            while (src[b] === ' ') b++;
            if (src[b] === ',') { b++; while (src[b] === ' ') b++; }
            else { while (a > 0 && src[a - 1] === ' ') a--; if (src[a - 1] === ',') a--; }
            add(a, b);
            return;
        }
        if (ts.isFunctionDeclaration(node) && !node.body) { wholeStatement(node); return; }
        if (node.modifiers) {
            for (const m of node.modifiers) {
                if (m.kind === ts.SyntaxKind.DeclareKeyword) { wholeStatement(node); return; }
                if ([ts.SyntaxKind.PrivateKeyword, ts.SyntaxKind.PublicKeyword, ts.SyntaxKind.ProtectedKeyword,
                    ts.SyntaxKind.ReadonlyKeyword, ts.SyntaxKind.AbstractKeyword, ts.SyntaxKind.OverrideKeyword].includes(m.kind)) {
                    let b = m.getEnd();
                    while (src[b] === ' ') b++;
                    add(m.getStart(sf), b);
                }
            }
        }
        if (ts.isEnumDeclaration(node) || ts.isModuleDeclaration(node)) {
            throw new Error('syntax TypeScript ដែលលុបមិនបាន (enum/namespace) ៖ ' + sf.fileName);
        }
        if (ts.isParameter(node) && ts.isIdentifier(node.name) && node.name.text === 'this') {
            // parameter `this: T` មានតែក្នុង TypeScript ➜ លុបទាំងមូល (បូក comma ខាងក្រោយ)
            let b = node.getEnd();
            while (src[b] === ' ') b++;
            if (src[b] === ',') { b++; while (src[b] === ' ') b++; }
            add(node.getStart(sf), b);
            return;
        }
        if ((ts.isParameter(node) || ts.isVariableDeclaration(node) || ts.isPropertyDeclaration(node)) && node.type) {
            annotation(node.type, ts.isParameter(node) ? node.questionToken : undefined);
        } else if (ts.isParameter(node) && node.questionToken) {
            add(node.questionToken.getStart(sf), node.questionToken.getEnd());
        }
        if ((ts.isVariableDeclaration(node) || ts.isPropertyDeclaration(node)) && node.exclamationToken) {
            add(node.exclamationToken.getStart(sf), node.exclamationToken.getEnd());
        }
        if ((ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node) ||
            ts.isMethodDeclaration(node) || ts.isGetAccessor(node) || ts.isSetAccessor(node))) {
            if (node.type) annotation(node.type);
            typeParams(node.typeParameters);
        }
        if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
            typeParams(node.typeParameters);
            for (const h of node.heritageClauses || []) {
                if (h.token === ts.SyntaxKind.ImplementsKeyword) {
                    let a = h.getStart(sf);
                    while (src[a - 1] === ' ') a--;
                    add(a, h.getEnd());
                }
            }
        }
        if ((ts.isCallExpression(node) || ts.isNewExpression(node) || ts.isTaggedTemplateExpression(node) ||
            ts.isExpressionWithTypeArguments(node)) && node.typeArguments) typeParams(node.typeArguments);
        if (ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) {
            add(node.expression.getEnd(), node.getEnd());
        }
        if (ts.isNonNullExpression(node)) add(node.getEnd() - 1, node.getEnd());
        if (ts.isTypeAssertionExpression(node)) add(node.getStart(sf), node.expression.getStart(sf));
        ts.forEachChild(node, visit);
    };
    visit(sf);
    return ranges;
}

function applyRemovals(src, ranges) {
    ranges.sort((a, b) => a[0] - b[0] || b[1] - a[1]);
    let out = '';
    let at = 0;
    for (const [a, b] of ranges) {
        if (b <= at) continue;
        out += src.slice(at, Math.max(a, at));
        at = b;
    }
    return out + src.slice(at);
}

function tokens(code) {
    const out = [];
    for (const t of acorn.tokenizer(code, { ecmaVersion: 'latest', sourceType: 'module', allowHashBang: true })) {
        out.push(t.type.label + ':' + String(t.value && t.value.pattern !== undefined ? '/' + t.value.pattern + '/' + t.value.flags : t.value));
    }
    // ⛔ comma ខាងចុងមុន `}` `)` `]` គ្មានន័យ (ឧ. `import { a, type B }` ➜ Node ទុក `a, }`) ➜ ធ្វើឲ្យស្មើ
    return out.filter((t, i) => !(t === ',:undefined' && /^[})\]]:/.test(out[i + 1] || '')));
}

/** លុប syntax របស់ type ដោយរក្សាអត្ថបទផ្សេងទៀតដដែល — ផ្ទៀងផ្ទាត់ token ទល់ token ជាមួយ Node */
export function eraseTypes(tsSource, fileName) {
    const sf = ts.createSourceFile(fileName, tsSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const js = applyRemovals(tsSource, typeRanges(sf, tsSource));
    const mine = tokens(js);
    const node = tokens(stripTypeScriptTypes(tsSource, { mode: 'strip' }));
    const n = Math.max(mine.length, node.length);
    for (let i = 0; i < n; i++) {
        if (mine[i] !== node[i]) {
            throw new Error('eraseTypes ៖ token ខុសពី stripTypeScriptTypes ក្នុង ' + fileName + ' (token ' + i + ' ៖ ' + mine[i] + ' ≠ ' + node[i] + ')');
        }
    }
    return js;
}

const VITE_ENV = { PROD: 'true', DEV: 'false', SSR: 'false', MODE: '"production"', BASE_URL: '"./"' };

function replaceImportMetaEnv(js) {
    const out = js.replace(/import\.meta\.env\.([A-Za-z_$][\w$]*)/g, (m, key) => (key in VITE_ENV ? VITE_ENV[key] : 'undefined'));
    if (/import\.meta/.test(out)) throw new Error('checker-view ៖ `import.meta` ដែលមិនស្គាល់នៅសល់');
    return out;
}

function removeComments(js) {
    const ranges = [];
    acorn.parse(js, { ecmaVersion: 'latest', sourceType: 'module', onComment: (block, text, start, end) => ranges.push([start, end]) });
    let out = applyRemovals(js, ranges);
    // ជួរដែលនៅសល់តែ whitespace ក្រោយដក comment ➜ ដក · whitespace ខាងចុងជួរ ➜ ដក
    out = out.split('\n').map((l) => l.replace(/[ \t]+$/, '')).join('\n');
    return out.replace(/\n{3,}/g, '\n\n');
}

function stripModuleSyntax(js, fileName) {
    const sf = ts.createSourceFile(fileName, js, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const ranges = [];
    for (const st of sf.statements) {
        if (ts.isImportDeclaration(st) || ts.isExportDeclaration(st) || ts.isExportAssignment(st)) {
            let end = st.getEnd();
            if (js[end] === '\n') end++;
            ranges.push([st.getStart(sf), end]);
            continue;
        }
        const mods = ts.canHaveModifiers(st) ? ts.getModifiers(st) : undefined;
        for (const m of mods || []) {
            if (m.kind === ts.SyntaxKind.ExportKeyword || m.kind === ts.SyntaxKind.DefaultKeyword) {
                let end = m.getEnd();
                while (js[end] === ' ') end++;
                ranges.push([m.getStart(sf), end]);
            }
        }
    }
    return applyRemovals(js, ranges);
}

function indentOutsideTemplates(js, fileName) {
    const sf = ts.createSourceFile(fileName, js, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const spans = [];
    const visit = (n) => {
        if (ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateExpression(n)) spans.push([n.getStart(sf), n.getEnd()]);
        ts.forEachChild(n, visit);
    };
    visit(sf);
    const inside = (at) => spans.some(([a, b]) => at > a && at < b);
    let out = '';
    let at = 0;
    for (const line of js.split('\n')) {
        out += (line.length && !inside(at) ? '    ' : '') + line + '\n';
        at += line.length + 1;
    }
    return out;
}

/** module មួយ ➜ អត្ថបទក្នុងទិដ្ឋភាព */
export function moduleView(tsSource, fileName) {
    let js = eraseTypes(tsSource, fileName);
    js = replaceImportMetaEnv(js);
    js = removeComments(js);
    js = stripModuleSyntax(js, fileName);
    return indentOutsideTemplates(js.replace(/^\n+/, ''), fileName);
}

/** `<ឃ្លាំង>.<វាល>` ➜ `<វាល>` សម្រាប់តែ state ដើម */
export function aliasStateFields(text, stateGroups) {
    const storeOf = Object.fromEntries(Object.entries(stateGroups).flatMap(([store, fields]) => fields.map((f) => [f.name, store])));
    const stores = [...new Set(Object.values(storeOf))];
    const aliasRe = new RegExp('(?<![\\w$.])(' + stores.join('|') + ')\\.([A-Za-z_$][\\w$]*)\\b', 'g');
    let count = 0;
    const out = text.replace(aliasRe, (m, store, field) => {
        if (storeOf[field] !== store) return m;
        count++;
        return field;
    });
    const left = [...out.matchAll(aliasRe)].filter((m) => storeOf[m[2]] === m[1]);
    if (left.length) throw new Error('checker-view ៖ `<ឃ្លាំង>.<វាល>` នៅសល់ ' + left.length);
    return { text: out, count };
}

/** ជំនួសតួ function កម្រិតកំពូល `name` ក្នុងអត្ថបទ module (ត្រូវមានពិតម្តងគត់) */
export function overrideFunction(text, name, replacement) {
    const re = new RegExp('^(    )(async )?function ' + name + '\\s*\\(', 'm');
    const m = re.exec(text);
    if (!m) throw new Error('checker-view ៖ រក function ' + name + ' មិនឃើញ (override)');
    const open = text.indexOf('{', text.indexOf(')', m.index));
    let depth = 0;
    let end = -1;
    for (let i = open; i < text.length; i++) {
        if (text[i] === '{') depth++;
        else if (text[i] === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
    }
    if (end < 0) throw new Error('checker-view ៖ តួ function ' + name + ' មិនបិទ');
    if (re.exec(text.slice(end))) throw new Error('checker-view ៖ function ' + name + ' មាន ២ ដង');
    return text.slice(0, m.index) + '    ' + replacement + text.slice(end);
}

/**
 * ឈ្មោះ ref ➜ selector ពិត ពី JSX ៖ ធាតុដែលមាន `id="<ឈ្មោះ>"` ➜ `getElementById` (លំនាំដើម) ·
 * ផ្សេងពីនេះ ➜ `#<id>` ឬ `.<class>` ពិតរបស់ធាតុដែលចង ref · រកមិនឃើញ ➜ បោះកំហុស (មិនទាយ)។
 */
export function refSelectorsFromJsx(refNames, tsxSources) {
    const all = tsxSources.join('\n');
    const selectors = {};
    for (const name of refNames) {
        if (new RegExp('id="' + name + '"').test(all)) continue;
        const bind = new RegExp('<([a-z]+)\\b([^>]*?)ref=\\{refTo\\(\'' + name + '\'\\)\\}', 's').exec(all);
        if (!bind) throw new Error('checker-view ៖ ref `' + name + '` គ្មាន id ហើយរកធាតុដែលចងមិនឃើញ');
        const attrs = bind[2];
        const id = /\bid="([^"]+)"/.exec(attrs);
        const cls = /\bclassName="([^" ]+)/.exec(attrs) || /\bclassName=\{[^}]*?'([a-z-]+)/.exec(attrs);
        selectors[name] = id ? '#' + id[1] : cls ? '.' + cls[1] : null;
    }
    return selectors;
}
