import { chromium } from 'playwright-core';
import { serveDir } from './serve.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const { server, port } = await serveDir(path.join(ROOT, '..', 'dist'));

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const page = await browser.newPage();
/* ⛔ smoke វាស់ boot របស់ build ⛔ មិនមែនបណ្តាញ ៖ ការហៅទៅក្រៅ (Sentry · SDK Firebase · License · fonts) ត្រូវផ្តាច់ ➜ ក្នុងស្រុក និង CI វាស់រឿងដដែល។
 *    បើអត់ លទ្ធផលអាស្រ័យលើបរិស្ថាន ៖ proxy ក្នុងស្រុកទប់ (`ERR_…` ➜ តម្រង) ចំណែក GitHub ទៅដល់ License Project ➜ `syncServerTime()` អាន root
 *    (`/.json?shallow=true` · rules default-deny ➜ 401 ដោយចេតនា ៖ វាត្រូវការតែ header `Date`) ➜ Chrome កត់ «Failed to load resource 401» ➜ smoke ក្រហម */
await page.route((u) => !/^http:\/\/127\.0\.0\.1:/.test(u.href), (route) => route.abort('internetdisconnected'));
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

/* ⛔ «ស៊ុមកក» ក្នុងរបា Slide ត្រូវវាស់ពី build ផលិតកម្មពិត ៖ vitest វាស់ helper និង SideDrawer តែមិនឃើញថា boot ពិតជា
 *    ចាប់ផ្តើម observer ឬអត់ ➜ បង្កើតស៊ុមកក ១ ដែលដឹងថាយូរ ≥ 150ms រួចបើករបា Slide ➜ បន្ទាត់ `#jankLine` ត្រូវលេច ហើយ
 *    «យូរបំផុត» ត្រូវ ≥ រយៈពេលដែលបង្កើត។ Chromium គាំទ្រ `long-animation-frame` ➜ គ្មានបន្ទាត់ = boot មិនចាប់ផ្តើមការវាស់។ */
const JANK_BUSY_MS = 150;
await page.evaluate((busy) => new Promise((resolve) => requestAnimationFrame(() => {
    const end = performance.now() + busy;
    while (performance.now() < end) { /* ស៊ុមកកដោយចេតនា */ }
    requestAnimationFrame(() => setTimeout(resolve, 100));
})), JANK_BUSY_MS);
await page.evaluate(() => document.getElementById('navMenuBtn').click());
await page.waitForTimeout(300);
const jank = await page.evaluate(() => {
    const line = document.getElementById('jankLine');
    return { text: line ? line.textContent : null, supported: (window.PerformanceObserver && PerformanceObserver.supportedEntryTypes) || [] };
});
const jankMax = jank.text ? Number((jank.text.match(/(\d+)ms/) || [])[1]) : NaN;
const jankCount = jank.text ? Number((jank.text.match(/៖ (\d+) ដង/) || [])[1]) : NaN;
const jankOk = jank.supported.includes('long-animation-frame') && jankCount >= 1 && jankMax >= JANK_BUSY_MS;
if (jankOk) console.log(`✅ ស៊ុមកកត្រូវវាស់ពី boot ពិត ៖ «${jank.text}»`);
else console.log('⛔ បន្ទាត់ «ស៊ុមកក» មិនលេច ឬលេខខុស (boot មិនចាប់ផ្តើម observer?) ៖ ' + JSON.stringify(jank));

/* ⛔ «ពេលរមូរ NNfps» ត្រូវវាស់ពីព្រឹត្តិការណ៍ scroll ពិត ៖ អេក្រង់ LTPO (10–120Hz) ឲ្យស៊ុម ៦០ ពេលស្ងៀម តែ ១២០ ពេលរមូរ ➜ ការវាស់តែពេលបើក
 *    របា Slide រាយ «60» ខុស។ ព្រឹត្តិការណ៍ scroll លើកន្សោមណាមួយ (capture លើ window) ➜ វាស់ ➜ បើករបា ➜ បន្ទាត់ត្រូវមាន «ពេលរមូរ»។
 *    ការដកអ្នកស្តាប់ចេញពី boot ➜ គ្មាន «ពេលរមូរ» ➜ smoke ធ្លាក់។ */
await page.evaluate(() => {
    const close = document.querySelector('#sideDrawer .drawer-close');
    if (close) close.click();
});
await page.waitForTimeout(200);
await page.evaluate(() => {
    const target = document.getElementById('appPages') || document.body;
    target.dispatchEvent(new Event('scroll'));
});
await page.waitForTimeout(800);
await page.evaluate(() => document.getElementById('navMenuBtn').click());
await page.waitForTimeout(900);
const rateText = await page.evaluate(() => { const el = document.getElementById('displayRateLine'); return el ? el.textContent : null; });
const scrollRateOk = !!rateText && /ស៊ុម App \d+fps · ពេលរមូរ \d+fps/.test(rateText);
if (scrollRateOk) console.log(`✅ ស៊ុមពេលរមូរត្រូវវាស់ពី scroll ពិត ៖ «${rateText}»`);
else console.log('⛔ បន្ទាត់ស៊ុមមិនមាន «ពេលរមូរ» (boot មិនភ្ជាប់អ្នកស្តាប់ scroll?) ៖ ' + JSON.stringify(rateText));

await browser.close();
server.close();
process.exit(noisy.length || !bridgeOk || !syntaxOk || !tokenOk || !jankOk || !scrollRateOk ? 1 : 0);
