import { chromium } from 'playwright-core';
import { serveDir } from './serve.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const { server, port } = await serveDir(path.join(ROOT, '..', 'dist'));

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });
await page.addInitScript(() => {
    window.addEventListener('unhandledrejection', (e) => {
        (window.__rejections ||= []).push(String((e.reason && e.reason.message) || e.reason));
    });
});
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
await page.waitForTimeout(2500);

const info = await page.evaluate(() => ({
    ids: document.querySelectorAll('[id]').length,
    root: !!document.getElementById('root'),
    navbar: !!document.querySelector('.app-navbar'),
    pages: !!document.getElementById('appPages'),
    modals: document.querySelectorAll('.modal').length,
    drawerGroups: document.querySelectorAll('.drawer-group').length,
    rejections: window.__rejections || [],
    versionLabel: (document.getElementById('appVersionLabel') || {}).textContent || null,
    bodyChildren: document.body.children.length
}));

console.log(JSON.stringify(info, null, 2));
const noisy = errors.filter((e) => !/favicon|sentry|gstatic|fonts\.googleapis|ERR_/i.test(e));
if (noisy.length) { console.log('\n⛔ កំហុស runtime ៖'); noisy.forEach((e) => console.log('   ' + e)); }
else console.log('\n✅ គ្មានកំហុស runtime');

/* ⛔ bridge របស់ build វាស់ (`src/expose-globals.ts` · `src/audit-compat.ts` · plugin `zoew-audit-rebind`)
 *    មិនត្រូវចូល build ផលិតកម្មឡើយ ៖ បើ `VITE_EXPOSE_GLOBALS=1` ធ្លាក់ចូល env របស់ Netlify ➜ function ទាំងអស់
 *    លេចលើ `window` ហើយ `innerHTML`/`style.display` របស់ធាតុ React ប្រែឥរិយាបថ។ ការវាស់ ២ ជាន់ ៖
 *    (ក) ឥរិយាបថ ៖ export ពិតរបស់ module (ដេរីវេពីប្រភព) មិនលេចលើ `window`
 *    (ខ) ស្តាទិច ៖ គ្មានសញ្ញាសម្គាល់ bridge ក្នុង `dist/assets/*.js` (សញ្ញាដេរីវេពីប្រភពពិត) */
const SRC = path.join(ROOT, '..', 'src');
const bridgeMarkers = [];
const exposeSrc = fs.readFileSync(path.join(SRC, 'expose-globals.ts'), 'utf8');
const viteSrc = fs.readFileSync(path.join(ROOT, '..', 'vite.config.mts'), 'utf8');
for (const m of ['__auditOrig']) if (exposeSrc.includes(m)) bridgeMarkers.push(m);
for (const m of ['__auditRebind']) if (viteSrc.includes(m)) bridgeMarkers.push(m);
const probeNames = ['features/scan-action.ts', 'core/actions.ts'].map((rel) => {
    const hit = fs.readFileSync(path.join(SRC, rel), 'utf8').match(/^export (?:async )?function (\w+)/m);
    return hit && hit[1];
}).filter(Boolean);
const leakedOnWindow = await page.evaluate((names) => names.filter((n) => typeof window[n] !== 'undefined'), probeNames);
const ASSETS = path.join(ROOT, '..', 'dist', 'assets');
const bundleHits = fs.readdirSync(ASSETS).filter((f) => f.endsWith('.js')).flatMap((f) => {
    const text = fs.readFileSync(path.join(ASSETS, f), 'utf8');
    return bridgeMarkers.filter((m) => text.includes(m)).map((m) => f + ' ⊃ ' + m)
        .concat(/expose-globals|audit-compat/.test(f) ? [f] : []);
});
const bridgeOk = bridgeMarkers.length === 2 && probeNames.length === 2 && !leakedOnWindow.length && !bundleHits.length;
if (bridgeOk) console.log(`✅ build ផលិតកម្មគ្មាន bridge វាស់ (សញ្ញា ${bridgeMarkers.length} · probe ${probeNames.join('/')})`);
else console.log('⛔ bridge វាស់ចូល build ផលិតកម្ម ឬវាស់មិនបាន ៖ ' + JSON.stringify({ bridgeMarkers, probeNames, leakedOnWindow, bundleHits }));

/* ⛔ syntax ដែល toolchain ចេញ ត្រូវស្ថិតក្នុង `build.target` ៖ ការឡើង Vite/minifier អាចបញ្ចេញ syntax ថ្មីជាង
 *    ដែល browser ចាស់ (iPhone ចាស់) parse មិនបាន ➜ អេក្រង់ស ខណៈ Chromium ក្នុង checker ដើរធម្មតា។
 *    កម្រិតដេរីវេពី `target` ពិតក្នុង `vite.config.mts` (App · Service Worker) មិនមែនលេខថេរ។ */
const { parse } = await import('acorn');
const targetYears = [...viteSrc.matchAll(/\btarget:\s*'es(\d{4})'/g)].map((m) => Number(m[1]));
const ecmaVersion = targetYears.length ? Math.min(...targetYears) : 0;
const DIST = path.join(ROOT, '..', 'dist');
const syntaxFiles = fs.readdirSync(ASSETS).filter((f) => f.endsWith('.js')).map((f) => ['assets/' + f, 'module'])
    .concat(fs.existsSync(path.join(DIST, 'sw.js')) ? [['sw.js', 'script']] : []);
const syntaxBad = syntaxFiles.flatMap(([rel, sourceType]) => {
    try { parse(fs.readFileSync(path.join(DIST, rel), 'utf8'), { ecmaVersion, sourceType }); return []; }
    catch (e) { return [rel + ' ៖ ' + e.message]; }
});
const syntaxOk = targetYears.length >= 2 && ecmaVersion >= 2015 && syntaxFiles.length >= 4 && !syntaxBad.length;
if (syntaxOk) console.log(`✅ syntax ក្នុង build ស្ថិតក្នុង ES${ecmaVersion} (${syntaxFiles.length} ឯកសារ)`);
else console.log('⛔ syntax ក្នុង build លើស target ឬវាស់មិនបាន ៖ ' + JSON.stringify({ targetYears, syntaxFiles: syntaxFiles.length, syntaxBad }));

/* ⛔ design token CSS (`--x: value`) ត្រូវទៅដល់ browser ដូចដែលសរសេរ ៖ minifier ខ្លះ (Lightning CSS ដែលជា
 *    លំនាំដើមរបស់ Vite) សរសេរតម្លៃឡើងវិញ (`#0066FF` ➜ `#06f` · `rgba(…)` ➜ `#0000000d`) និងរៀបលំដាប់
 *    declaration — ក្នុង CSS ដែលគ្រប PTR · ចលនាផ្ទាំង ខណៈ checker CSS វាស់ CSS **ប្រភព** មិនមែន CSS ដែល ship។
 *    ការប្រៀបធៀបលុបតែចន្លោះ និង `0` មុខចំណុចទសភាគ (អ្វីដែល minify ដោយមិនប្តូរតម្លៃ)។ */
const cssImports = [...fs.readFileSync(path.join(SRC, 'main.tsx'), 'utf8').matchAll(/^import\s+['"](\.[^'"]+\.css)['"]/gm)].map((m) => m[1]);
const cssSource = cssImports.map((rel) => fs.readFileSync(path.join(SRC, rel), 'utf8')).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
const shippedCss = fs.readdirSync(ASSETS).filter((f) => f.endsWith('.css')).map((f) => fs.readFileSync(path.join(ASSETS, f), 'utf8')).join('\n');
const tokenNorm = (v) => v.replace(/\s+/g, '').replace(/(^|[^\d.])0+\.(\d)/g, '$1.$2');
const authoredTokens = [...cssSource.matchAll(/(--[\w-]+)\s*:\s*([^;{}]+);/g)].map((m) => [m[1], tokenNorm(m[2])]);
const shippedTokens = new Set([...shippedCss.matchAll(/(--[\w-]+)\s*:\s*([^;{}]+)[;}]/g)].map((m) => m[1] + ':' + tokenNorm(m[2])));
const tokenLost = authoredTokens.filter(([n, v]) => !shippedTokens.has(n + ':' + v)).map(([n, v]) => n + ':' + v);
const tokenOk = cssImports.length >= 1 && authoredTokens.length >= 20 && !tokenLost.length;
if (tokenOk) console.log(`✅ design token CSS ទៅដល់ build ដូចដែលសរសេរ (${authoredTokens.length} token · ${cssImports.length} ឯកសារ)`);
else console.log('⛔ minifier CSS សរសេរ design token ឡើងវិញ ឬវាស់មិនបាន ៖ ' + JSON.stringify({ files: cssImports.length, tokens: authoredTokens.length, lost: tokenLost.slice(0, 8), lostCount: tokenLost.length }));

await browser.close();
server.close();
process.exit(noisy.length || !bridgeOk || !syntaxOk || !tokenOk ? 1 : 0);
