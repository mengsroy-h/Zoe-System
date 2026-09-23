/**
 * សាង *tree សម្រាប់ audit* ៖ រូបរាងដូច `ZoeW/` ដើមបេះបិទ តែមាតិកាមកពី
 * កូដថ្មី។ គោលដៅ ៖ ឲ្យ checker ទាំង ១៨០+ ក្នុង `audit-tools/` អាចចង្អុល
 * មករកវា (`*_APP_DIR`) ➜ ឥរិយាបថរបស់ App ថ្មីត្រូវវាស់ដោយ **ឧបករណ៍
 * ដែលសរសេរសម្រាប់ App ចាស់** មិនមែនដោយតេស្តដែលយើងសរសេរខ្លួនឯង។
 */
import { build } from 'esbuild';
import { aliasStateFields, eraseTypes, moduleView, overrideFunction, refSelectorsFromJsx } from './checker-view.mjs';
import { mkdirSync, cpSync, writeFileSync, readFileSync, rmSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url)) + '/..';
const OUT = path.join(ROOT, 'dist-audit');
const APP = path.join(OUT, 'ZoeW');

rmSync(OUT, { recursive: true, force: true });
mkdirSync(APP, { recursive: true });

const version = (readFileSync(path.join(ROOT, 'src/core/version.ts'), 'utf8').match(/APP_VERSION\s*=\s*'([^']+)'/) || [])[1];
const cacheVersion = (readFileSync(path.join(ROOT, 'src/sw/cache-version.ts'), 'utf8').match(/CACHE_VERSION\s*=\s*'([^']+)'/) || [])[1];

/* ១. app.js ៖ bundle IIFE ដែល **មិន minify** ➜ ឈ្មោះ function នៅដដែល
 *
 * ⛔ បូក **ស្រទាប់ភាពត្រូវគ្នា** ៖ checker ឥរិយាបថរបស់ ZoeW ដើមហៅ
 *    `window.<function>` និងអាន `window.<stateVar>` ព្រោះ `app.js` ចាស់
 *    ជា script សកល។ ស្រទាប់នេះបង្ហាញផ្ទៃដដែល ដោយ *មិនប្តូរកូដផលិតកម្ម*
 *    សោះ — វាកើតតែក្នុង build សម្រាប់ audit ប៉ុណ្ណោះ។ */
function listModules(dir, out = []) {
    for (const name of readdirSync(dir)) {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) { if (name !== 'app' && name !== 'sw' && name !== 'types' && name !== 'styles') listModules(full, out); }
        else if (full.endsWith('.ts') && !full.endsWith('.d.ts')) out.push(full);
    }
    return out;
}
const modules = listModules(path.join(ROOT, 'src'))
    .map((f) => './' + path.relative(OUT, f).split(path.sep).join('/').replace(/\.ts$/, ''))
    .sort();
const stateGroups = JSON.parse(readFileSync(path.join(ROOT, 'src/_generated-state.json'), 'utf8'));

const entry = path.join(OUT, '_entry.ts');
writeFileSync(entry, `
${modules.map((m, i) => `import * as m${i} from '${m}';`).join('\n')}
import { firebaseState, dataState, scanState, uiState, securityState, lookupState, sheetImportState, ztoState } from '../src/core/state';
import { bootApplication } from '../src/app/lifecycle/boot';
import { createLifecycleScope } from '../src/app/lifecycle/scope';

const STORES: Record<string, any> = { firebaseState, dataState, scanState, uiState, securityState, lookupState, sheetImportState, ztoState };
const STATE_MAP: Record<string, string> = ${JSON.stringify(Object.fromEntries(Object.entries(stateGroups).flatMap(([store, fields]) => fields.map((f) => [f.name, store]))))};

const w = window as any;
for (const mod of [${modules.map((_, i) => `m${i}`).join(', ')}]) {
    for (const [key, value] of Object.entries(mod)) {
        if (!(key in w)) w[key] = value;
    }
}
for (const [field, store] of Object.entries(STATE_MAP)) {
    Object.defineProperty(w, field, {
        configurable: true,
        get: () => STORES[store][field],
        set: (v) => { STORES[store][field] = v; }
    });
}
bootApplication(createLifecycleScope());
`);
await build({
    entryPoints: [entry],
    bundle: true,
    format: 'iife',
    target: 'es2020',
    minify: false,
    treeShaking: false,
    // ⛔ `keepNames` ចាក់ `__name(fn, "…")` ក្នុងតួ function ទាំងអស់ ➜ checker ដែលស្រង់ function ចូល `vm`
    //    ធ្លាក់ `ReferenceError: __name is not defined` (វាស់បាន ៖ ២២ ដង) · ឈ្មោះ function នៅដដែលដោយគ្មានវា
    //    (`minify: false`)
    keepNames: false,
    legalComments: 'none',
    define: { __APP_VERSION__: JSON.stringify(version), __CACHE_VERSION__: JSON.stringify(cacheVersion) },
    outfile: path.join(APP, 'app.js')
});
rmSync(entry);

/*
 * ⛔ **ទិដ្ឋភាពអត្ថបទសម្រាប់ checker** (`app.js` នេះ **មិនដែលរត់** — `index.html` ផ្ទុក build របស់ Vite)។
 *    bundle របស់ esbuild ខាងលើផ្តល់តែ **លំដាប់ module** (dependency) ៖ អត្ថបទរបស់វាប្តូរទម្រង់ (quote ·
 *    `b =>` ➜ `(b) =>` · indent ២ · `const` ➜ `var`) ➜ marker របស់ checker រកមិនឃើញ។ ទិដ្ឋភាពសាងពី
 *    **ប្រភព TypeScript ផ្ទាល់** តាម `scripts/checker-view.mjs` (លុបតែ syntax របស់ type · ផ្ទៀងផ្ទាត់
 *    token ទល់ token ជាមួយ `stripTypeScriptTypes()` របស់ Node)។ `audit-compat.ts`/`expose-globals.ts`/`sw/`
 *    មិនចូល (វាស់តែ/ផ្សេង)។
 */
{
    const appPath = path.join(APP, 'app.js');
    const bundle = readFileSync(appPath, 'utf8');
    const skip = (rel) => /(^|\/)(audit-compat|audit-annotate|expose-globals)\.ts$/.test(rel) || rel.startsWith('src/sw/');
    const order = [...new Set([...bundle.matchAll(/^ {2}\/\/ (src\/[^\n]+?\.ts)$/gm)].map((m) => m[1]))].filter((rel) => !skip(rel));
    if (order.length < 90) throw new Error('build-audit ៖ រក module ក្នុង bundle បាន ' + order.length + ' (ជាន់អប្បបរមា 90)');
    // ⛔ module `.ts` ដែល bundle មិននាំចូល (ប្រើតែដោយ component) ➜ បន្ថែមចុងក្រោយ (ទិដ្ឋភាពត្រូវពេញលេញ)
    const allTs = [];
    const walkTs = (dir) => {
        for (const name of readdirSync(dir)) {
            const full = path.join(dir, name);
            if (statSync(full).isDirectory()) walkTs(full);
            else if (name.endsWith('.ts') && !name.endsWith('.d.ts')) allTs.push(path.relative(ROOT, full).split(path.sep).join('/'));
        }
    };
    walkTs(path.join(ROOT, 'src'));
    for (const rel of allTs.sort()) if (!skip(rel) && !order.includes(rel)) order.push(rel);
    // ⛔ ស្រទាប់ចូល DOM របស់ React ➜ សមមូលដើម (មើល `checker-view.mjs` ចំណុច ៦)
    const refsSrc = readFileSync(path.join(ROOT, 'src/app/refs.ts'), 'utf8');
    const refNames = [...refsSrc.slice(refsSrc.indexOf('REF_NAMES = ['), refsSrc.indexOf('] as const')).matchAll(/'([A-Za-z0-9_]+)'/g)].map((m) => m[1]);
    const tsxSources = [];
    const walkTsx = (dir) => {
        for (const name of readdirSync(dir)) {
            const full = path.join(dir, name);
            if (statSync(full).isDirectory()) walkTsx(full);
            else if (name.endsWith('.tsx')) tsxSources.push(readFileSync(full, 'utf8'));
        }
    };
    walkTsx(path.join(ROOT, 'src/app'));
    const refSelectors = refSelectorsFromJsx(refNames, tsxSources);
    const VIEW_OVERRIDES = {
        'src/app/refs.ts': {
            elementOf: 'function elementOf(name) {\n        const sel = ' + JSON.stringify(refSelectors) + '[name];\n' +
                '        return sel === undefined ? document.getElementById(name) : (sel ? document.querySelector(sel) : null);\n    }'
        },
        'src/app/flush.ts': {
            commitNow: 'function commitNow() {}',
            renderNow: 'function renderNow(store) {}'
        }
    };
    let text = '';
    for (const rel of order) {
        const file = path.join(ROOT, rel);
        let view = moduleView(readFileSync(file, 'utf8'), file);
        for (const [name, replacement] of Object.entries(VIEW_OVERRIDES[rel] || {})) view = overrideFunction(view, name, replacement);
        text += view;
    }
    text = text.replace(/__APP_VERSION__/g, JSON.stringify(version)).replace(/__CACHE_VERSION__/g, JSON.stringify(cacheVersion));
    const aliased = aliasStateFields(text, stateGroups);
    text = aliased.text;
    if (aliased.count < 500) throw new Error('build-audit ៖ ការប្តូរ `<ឃ្លាំង>.<វាល>` តិចពេក ៖ ' + aliased.count);
    writeFileSync(appPath, text);
    console.log('ទិដ្ឋភាព checker ៖ module ' + order.length + ' · <ឃ្លាំង>.<វាល> ➜ <វាល> ' + aliased.count);
}

/* ២. សំបកពិត ៖ build របស់ Vite ដដែលនឹងផលិតកម្ម បូក `VITE_EXPOSE_GLOBALS=1`
 *    ➜ checker browser បើក **App React ពិត** (`index.html` · `assets/` ·
 *    `sw.js`) មិនមែនសំបកចាស់ទេ។ `app.js` ខាងលើ **មិនត្រូវ index.html ផ្ទុក**
 *    ទេ ៖ វាមានសម្រាប់តែ checker ដែលស្រង់អត្ថបទ function ចូល `vm` ប៉ុណ្ណោះ។
 *
 * ⛔ កុំប្រើ `index.html` ឬ `netlify.toml` របស់ ZoeW ដើមនៅទីនេះ — នោះជាការវាស់
 *    ឯកសារចាស់ ហើយរាយការណ៍ថាបៃតងលើអ្វីដែលមិន ship។ */
const appJs = readFileSync(path.join(APP, 'app.js'));
execFileSync(process.execPath, [path.join(ROOT, 'node_modules/vite/bin/vite.js'), 'build', '--outDir', APP, '--emptyOutDir'], {
    cwd: ROOT,
    env: { ...process.env, VITE_EXPOSE_GLOBALS: '1' },
    stdio: ['ignore', 'ignore', 'inherit']
});
writeFileSync(path.join(APP, 'app.js'), appJs);

/*
 * ២ខ. **markup ដំបូងរបស់ React ក្នុង `index.html`** ៖ checker ដើមអាន `index.html` ជា **អត្ថបទ** (id · អត្ថបទ ·
 *     ប្រអប់ · ជាន់អប្បបរមានៃទំហំ) ខណៈ `index.html` របស់ App React មានតែ `<div id="root">`។ ការគូរ
 *     **ដំបូង** របស់ React (មុន boot) ជាសមមូលពិតនៃ markup ថេរក្នុង `index.html` ដើម ៖
 *     Chromium ពិតផ្ទុក build វាស់ ➜ `MutationObserver` ថតមាតិកា `#root` **ភ្លាមក្រោយ commit ដំបូង** (microtask
 *     របស់វាឈរមុន microtask boot ដែល `useLayoutEffect` ចាក់) ➜ សរសេរចូល `#root` នៃ `index.html` វាស់។
 *     ⛔ checker browser នៅតែឃើញ App រស់ ៖ `createRoot()` **សម្អាត** កូនរបស់ container នៅ commit ដំបូង។
 */
{
    const { serveDir } = await import('./serve.mjs');
    const { chromium } = await import('playwright-core');
    const { server, port } = await serveDir(APP);
    const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
    try {
        const page = await browser.newPage();
        // ⛔ attribute ផ្ទេរសកម្មភាព (`data-act` …) ពី prop ពិតរបស់ React — ប្រភពតែមួយ `src/audit-annotate.ts`
        const annotateJs = eraseTypes(readFileSync(path.join(ROOT, 'src/audit-annotate.ts'), 'utf8'), 'audit-annotate.ts').replace(/^export /gm, '');
        await page.addInitScript({ content: annotateJs + '\nwindow.__zoeAnnotate = annotateActions;' });
        await page.addInitScript(() => {
            const w = window;
            w.__zoePrerender = null;
            const mo = new MutationObserver(() => {
                const root = document.getElementById('root');
                if (w.__zoePrerender === null && root && root.children.length) {
                    w.__zoeAnnotated = w.__zoeAnnotate(root);
                    w.__zoePrerender = root.innerHTML;
                    mo.disconnect();
                }
            });
            mo.observe(document, { childList: true, subtree: true });
        });
        await page.goto('http://127.0.0.1:' + port + '/index.html', { waitUntil: 'load' });
        await page.waitForFunction(() => window.__zoePrerender !== null, null, { timeout: 20000 });
        // ⛔ ធាតុម្តងមួយជួរ (indent ៤) ដូច `index.html` ដើម — checker ខ្លះរាប់ជួរ ឬស្វែងរកតាមជួរ
        const markup = await page.evaluate(() => {
            const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
            const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const attr = (v) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
            const lines = [];
            const walk = (node, depth) => {
                const pad = '    '.repeat(depth);
                if (node.nodeType === 3) { const t = node.data.replace(/\s+/g, ' ').trim(); if (t) lines.push(pad + esc(t)); return; }
                if (node.nodeType !== 1) return;
                const tag = node.tagName.toLowerCase();
                const attrs = Array.from(node.attributes).map((a) => ' ' + a.name + (a.value === '' ? '' : '="' + attr(a.value) + '"')).join('');
                if (VOID.has(tag)) { lines.push(pad + '<' + tag + attrs + '>'); return; }
                const kids = Array.from(node.childNodes);
                const onlyText = kids.every((k) => k.nodeType === 3);
                if (onlyText) { lines.push(pad + '<' + tag + attrs + '>' + esc(node.textContent || '') + '</' + tag + '>'); return; }
                lines.push(pad + '<' + tag + attrs + '>');
                for (const k of kids) walk(k, depth + 1);
                lines.push(pad + '</' + tag + '>');
            };
            const host = document.createElement('template');
            host.innerHTML = window.__zoePrerender;
            for (const k of Array.from(host.content.childNodes)) walk(k, 1);
            return '\n' + lines.join('\n') + '\n';
        });
        const htmlPath = path.join(APP, 'index.html');
        const html = readFileSync(htmlPath, 'utf8');
        if (!html.includes('<div id="root"></div>')) throw new Error('build-audit ៖ រក `<div id="root"></div>` ក្នុង index.html មិនឃើញ');
        const annotated = await page.evaluate(() => window.__zoeAnnotated);
        if (annotated < 80) throw new Error('build-audit ៖ ធាតុដែលមាន `data-act` តិចពេក ៖ ' + annotated);
        if (markup.length < 30000 || markup.split('\n').length < 400) throw new Error('build-audit ៖ markup ដំបូងតូចពេក ៖ ' + markup.length + ' តួ · ' + markup.split('\n').length + ' ជួរ');
        writeFileSync(htmlPath, html.replace('<div id="root"></div>', '<div id="root">' + markup + '</div>'));
        console.log('index.html ៖ markup ដំបូងរបស់ React ' + markup.length + ' តួ · ' + markup.split('\n').length + ' ជួរ · data-act ' + annotated);
    } finally {
        await browser.close();
        server.close();
    }
}

/* ៣. ឯកសារ repo ដែល checker អានជាអត្ថបទ — **ច្បាប់ចម្លងពី tree ថ្មី** */
cpSync(path.join(ROOT, 'src/styles/app.css'), path.join(APP, 'style.css'));
for (const f of ['netlify.toml', 'package.json', 'package-lock.json', 'README.md', 'ZTO-SETUP-KH.md']) {
    cpSync(path.join(ROOT, f), path.join(APP, f));
}
cpSync(path.join(ROOT, 'netlify', 'functions'), path.join(APP, 'netlify', 'functions'), { recursive: true });

console.log('dist-audit រួចរាល់ ៖', APP);
console.log('app.js:', (readFileSync(path.join(APP, 'app.js'), 'utf8').split('\n').length), 'បន្ទាត់');
