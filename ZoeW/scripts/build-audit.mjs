/**
 * សាង *tree សម្រាប់ audit* ៖ រូបរាងដូច `ZoeW/` ដើមបេះបិទ តែមាតិកាមកពី
 * កូដថ្មី។ គោលដៅ ៖ ឲ្យ checker ទាំង ១៨០+ ក្នុង `audit-tools/` អាចចង្អុល
 * មករកវា (`*_APP_DIR`) ➜ ឥរិយាបថរបស់ App ថ្មីត្រូវវាស់ដោយ **ឧបករណ៍
 * ដែលសរសេរសម្រាប់ App ចាស់** មិនមែនដោយតេស្តដែលយើងសរសេរខ្លួនឯង។
 */
import { build } from 'esbuild';
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
import { runLegacyBootstrapStatements } from '../src/boot/bootstrap-statements';

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
runLegacyBootstrapStatements();
`);
await build({
    entryPoints: [entry],
    bundle: true,
    format: 'iife',
    target: 'es2020',
    minify: false,
    treeShaking: false,
    keepNames: true,
    legalComments: 'none',
    define: { __APP_VERSION__: JSON.stringify(version), __CACHE_VERSION__: JSON.stringify(cacheVersion) },
    outfile: path.join(APP, 'app.js')
});
rmSync(entry);

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

/* ៣. ឯកសារ repo ដែល checker អានជាអត្ថបទ — **ច្បាប់ចម្លងពី tree ថ្មី** */
cpSync(path.join(ROOT, 'src/styles/app.css'), path.join(APP, 'style.css'));
for (const f of ['netlify.toml', 'package.json', 'package-lock.json', 'README.md', 'ZTO-SETUP-KH.md']) {
    cpSync(path.join(ROOT, f), path.join(APP, f));
}
cpSync(path.join(ROOT, 'netlify', 'functions'), path.join(APP, 'netlify', 'functions'), { recursive: true });

console.log('dist-audit រួចរាល់ ៖', APP);
console.log('app.js:', (readFileSync(path.join(APP, 'app.js'), 'utf8').split('\n').length), 'បន្ទាត់');
