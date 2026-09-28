// ជំនួយរួម ៖ រក និងលុប comment ក្នុង TypeScript/TSX · JavaScript (ES module) · CSS របស់ ZoeW React
// ដោយ **ផ្ទៀងផ្ទាត់ថាការលុបមិនប្តូរកូដ** ៖ esbuild compile មុន/ក្រោយ ➜ លទ្ធផលត្រូវស្មើគ្នាបេះបិទ
// (TSX compile ជា `jsx: 'automatic'` ➜ ចន្លោះ JSX ដែលប្រែ ត្រូវចាប់បាន)។ ខុសមួយ byte ➜ មិនប៉ះឯកសារនោះ។
//
// អ្នកប្រើ ៖ `strip-comments.js` (សម្អាត) · `comments.js` (អ្នកយាម)។
// ⛔ `/// <reference …>` ជា directive របស់ TypeScript មិនមែន comment ពិពណ៌នាទេ ➜ រក្សា។
'use strict';

const fs = require('fs');
const path = require('path');

function loadDep(name) {
    const tries = [name];
    const repoRoot = process.env.ZOE_REPO_ROOT;
    if (repoRoot) tries.push(path.join(repoRoot, 'ZoeW', 'node_modules', name));
    tries.push(path.join(__dirname, '..', 'ZoeW', 'node_modules', name));
    for (const t of tries) {
        try { return require(t); } catch (e) {}
    }
    return null;
}

const ts = loadDep('typescript');
const esbuild = loadDep('esbuild');

const DIRECTIVE_RE = /^\/\/\/\s*<(?:reference|amd-module|amd-dependency)\b/;

function available() { return !!(ts && esbuild); }

function scriptKindOf(file) {
    if (/\.tsx$/.test(file)) return ts.ScriptKind.TSX;
    if (/\.(mjs|js|cjs)$/.test(file)) return ts.ScriptKind.JS;
    return ts.ScriptKind.TS;
}

function commentRanges(src, file) {
    const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, scriptKindOf(file));
    const found = new Map();
    const jsxEmpty = [];
    const add = (list) => {
        if (!list) return;
        for (const c of list) {
            const text = src.slice(c.pos, c.end);
            if (DIRECTIVE_RE.test(text)) continue;
            found.set(c.pos, { pos: c.pos, end: c.end, text });
        }
    };
    const visit = (node) => {
        add(ts.getLeadingCommentRanges(src, node.getFullStart()));
        if (node.kind === ts.SyntaxKind.JsxExpression && !node.expression) jsxEmpty.push({ pos: node.getStart(sf), end: node.getEnd() });
        const kids = node.getChildren(sf);
        if (!kids.length) add(ts.getTrailingCommentRanges(src, node.getEnd()));
        for (const k of kids) visit(k);
    };
    visit(sf);
    return { comments: [...found.values()].sort((a, b) => a.pos - b.pos), jsxEmpty };
}

function cssCommentRanges(src) {
    const out = [];
    let i = 0, quote = null;
    while (i < src.length) {
        const ch = src[i];
        if (quote) {
            if (ch === '\\') { i += 2; continue; }
            if (ch === quote) quote = null;
            i++;
            continue;
        }
        if (ch === '"' || ch === "'") { quote = ch; i++; continue; }
        if (ch === '/' && src[i + 1] === '*') {
            const end = src.indexOf('*/', i + 2);
            const stop = end === -1 ? src.length : end + 2;
            out.push({ pos: i, end: stop, text: src.slice(i, stop) });
            i = stop;
            continue;
        }
        i++;
    }
    return out;
}

function countComments(src, file) {
    if (/\.css$/.test(file)) return cssCommentRanges(src).length;
    const r = commentRanges(src, file);
    return r.comments.length;
}

function removeRanges(src, ranges) {
    const sorted = ranges.slice().sort((a, b) => a.pos - b.pos);
    const merged = [];
    for (const r of sorted) {
        const last = merged[merged.length - 1];
        if (last && r.pos <= last.end) last.end = Math.max(last.end, r.end);
        else merged.push({ pos: r.pos, end: r.end });
    }
    let out = '';
    let at = 0;
    for (const r of merged) {
        let start = r.pos;
        let end = r.end;
        const lineStart = src.lastIndexOf('\n', start - 1) + 1;
        const before = src.slice(lineStart, start);
        let lineEnd = src.indexOf('\n', end);
        if (lineEnd === -1) lineEnd = src.length;
        const after = src.slice(end, lineEnd);
        if (/^[ \t]*$/.test(before) && /^[ \t]*$/.test(after)) {
            start = Math.max(lineStart, at);
            end = lineEnd < src.length ? lineEnd + 1 : lineEnd;
        } else if (/^[ \t]*$/.test(after)) {
            let s = start;
            while (s > at && (src[s - 1] === ' ' || src[s - 1] === '\t')) s--;
            start = s;
        }
        if (start < at) start = at;
        out += src.slice(at, start);
        at = end;
    }
    out += src.slice(at);
    return out;
}

function collapseBlankRuns(src) {
    return src.replace(/\n[ \t]*\n(?:[ \t]*\n)+/g, '\n\n').replace(/^\s*\n/, '');
}

function compileFingerprint(src, file) {
    if (/\.css$/.test(file)) {
        return esbuild.transformSync(src, { loader: 'css', minify: true, legalComments: 'none' }).code;
    }
    const loader = /\.tsx$/.test(file) ? 'tsx' : (/\.(mjs|js|cjs)$/.test(file) ? 'js' : 'ts');
    return esbuild.transformSync(src, {
        loader, jsx: 'automatic', format: 'esm', target: 'esnext', legalComments: 'none',
        minifyWhitespace: true, minifySyntax: false, minifyIdentifiers: false, sourcefile: file
    }).code;
}

function stripSource(src, file) {
    let ranges;
    if (/\.css$/.test(file)) {
        ranges = cssCommentRanges(src);
    } else {
        const r = commentRanges(src, file);
        ranges = r.comments.concat(r.jsxEmpty);
    }
    if (!ranges.length) return { changed: false, text: src, count: 0 };
    const reference = compileFingerprint(src, file);
    const candidates = [collapseBlankRuns(removeRanges(src, ranges)), removeRanges(src, ranges)];
    for (const text of candidates) {
        let fp;
        try { fp = compileFingerprint(text, file); } catch (e) { continue; }
        if (fp !== reference) continue;
        if (countComments(text, file) !== 0) continue;
        return { changed: true, text: text.replace(/[ \t]+$/gm, ''), count: ranges.length };
    }
    return { changed: false, text: src, count: ranges.length, unsafe: true };
}

// Gradle (Groovy DSL) ៖ lexer តូច ៖ string '…' "…" '''…''' """…""" · slashy `/…/` (ពេល `/` ឈរក្រោយ operator ឬវង់ក្រចក ដូច regex
// literal របស់ JS) · comment `//` និង `/* */`។ ⛔ `/` ក្រោយតម្លៃ (ឈ្មោះ · លេខ · `)` · `]`) = ការចែក មិនមែន slashy។
const GROOVY_VALUE_END = /[\w$)\]}'"]/;
function groovyScan(src) {
    const comments = [];
    const tokens = [];
    let i = 0;
    let last = '';
    const push = (t) => { tokens.push(t); last = t; };
    while (i < src.length) {
        const ch = src[i];
        const next = src[i + 1];
        if (/\s/.test(ch)) { i++; continue; }
        if (ch === '/' && next === '/') {
            let end = src.indexOf('\n', i);
            if (end === -1) end = src.length;
            comments.push({ pos: i, end, text: src.slice(i, end) });
            i = end;
            continue;
        }
        if (ch === '/' && next === '*') {
            const close = src.indexOf('*/', i + 2);
            const end = close === -1 ? src.length : close + 2;
            comments.push({ pos: i, end, text: src.slice(i, end) });
            i = end;
            continue;
        }
        if (ch === "'" || ch === '"') {
            const triple = src.startsWith(ch.repeat(3), i);
            const q = triple ? ch.repeat(3) : ch;
            let j = i + q.length;
            while (j < src.length) {
                if (src[j] === '\\') { j += 2; continue; }
                if (src.startsWith(q, j)) { j += q.length; break; }
                if (!triple && src[j] === '\n') break;
                j++;
            }
            push(src.slice(i, j));
            i = j;
            continue;
        }
        if (ch === '/' && !GROOVY_VALUE_END.test(last.slice(-1))) {
            let j = i + 1;
            while (j < src.length && src[j] !== '/' && src[j] !== '\n') { if (src[j] === '\\') j++; j++; }
            push(src.slice(i, j + 1));
            i = j + 1;
            continue;
        }
        const m = /^[\w$.]+|^./.exec(src.slice(i, i + 200));
        push(m[0]);
        i += m[0].length;
    }
    return { comments, tokens };
}

// gradle.properties ៖ ជួរដែលតួអក្សរដំបូង (ក្រោយ whitespace) ជា `#` ឬ `!` = comment · ⛔ ក្រោយជួរដែលបញ្ចប់ដោយ `\`
// (continuation) ជួរបន្ទាប់ជាតម្លៃ មិនមែន comment
function propertiesScan(src) {
    const comments = [];
    const tokens = [];
    let pos = 0;
    let continued = false;
    for (const line of src.split('\n')) {
        const end = pos + line.length;
        const body = line.trim();
        if (!continued && /^[#!]/.test(body)) comments.push({ pos, end, text: line });
        else if (body) tokens.push(body);
        continued = !continued || body ? /\\$/.test(line) && !/^[#!]/.test(body) : false;
        pos = end + 1;
    }
    return { comments, tokens };
}

// ⛔ ឯកសារដែល Capacitor **សាងឡើងវិញ** រាល់ `cap sync` (header «DO NOT EDIT THIS FILE! IT IS GENERATED») ➜ ការសម្អាតវាត្រូវ
// សរសេរជាន់វិញភ្លាម ➜ លើកលែងតាម header; ថត Cordova ដែល .gitignore រំលងក៏បង្កើតដោយ `cap sync` ដែរ។
const GENERATED_HEADER = /^\s*\/\/\s*DO NOT EDIT THIS FILE! IT IS GENERATED/;
function isGeneratedGradle(src) { return GENERATED_HEADER.test(src); }

function gradleShippedFiles(zoewDir) {
    const out = [];
    const root = path.join(zoewDir, 'android');
    const walk = (dir) => {
        if (!fs.existsSync(dir)) return;
        for (const name of fs.readdirSync(dir).sort()) {
            if (name === 'build' || name === '.gradle' || name === 'node_modules') continue;
            if (dir === root && name === 'capacitor-cordova-android-plugins') continue;
            const full = path.join(dir, name);
            const st = fs.statSync(full);
            if (st.isDirectory()) walk(full);
            else if (/\.gradle$/.test(name) || name === 'gradle.properties') out.push(full);
        }
    };
    walk(root);
    return out.filter((f) => !isGeneratedGradle(fs.readFileSync(f, 'utf8')));
}

function gradleScan(src, file) { return /gradle\.properties$/.test(file) ? propertiesScan(src) : groovyScan(src); }

function stripGradle(src, file) {
    const before = gradleScan(src, file);
    if (!before.comments.length) return { changed: false, text: src, count: 0 };
    const candidates = [collapseBlankRuns(removeRanges(src, before.comments)), removeRanges(src, before.comments)];
    for (const cand of candidates) {
        const text = cand.replace(/[ \t]+$/gm, '');
        const after = gradleScan(text, file);
        if (after.comments.length) continue;
        if (after.tokens.length !== before.tokens.length || after.tokens.some((t, k) => t !== before.tokens[k])) continue;
        return { changed: true, text, count: before.comments.length };
    }
    return { changed: false, text: src, count: before.comments.length, unsafe: true };
}

const SRC_EXT = /\.(ts|tsx|css)$/;
const CONFIG_FILES = ['vite.config.mts', 'vitest.config.mts', 'capacitor.config.ts', 'eslint.config.mjs'];

function reactShippedFiles(zoewDir) {
    const out = [];
    const src = path.join(zoewDir, 'src');
    const walk = (dir) => {
        if (!fs.existsSync(dir)) return;
        for (const name of fs.readdirSync(dir).sort()) {
            const full = path.join(dir, name);
            const st = fs.statSync(full);
            if (st.isDirectory()) walk(full);
            else if (SRC_EXT.test(name) && !/\.d\.ts$/.test(name)) out.push(full);
        }
    };
    walk(src);
    const fnDir = path.join(zoewDir, 'netlify', 'functions');
    if (fs.existsSync(fnDir)) {
        for (const name of fs.readdirSync(fnDir).sort()) if (/\.(js|mjs|cjs)$/.test(name)) out.push(path.join(fnDir, name));
    }
    if (fs.existsSync(src)) {
        for (const name of CONFIG_FILES) {
            const full = path.join(zoewDir, name);
            if (fs.existsSync(full)) out.push(full);
        }
    }
    return out;
}

module.exports = { available, commentRanges, cssCommentRanges, countComments, stripSource, reactShippedFiles, compileFingerprint,
    gradleScan, stripGradle, gradleShippedFiles, isGeneratedGradle };
