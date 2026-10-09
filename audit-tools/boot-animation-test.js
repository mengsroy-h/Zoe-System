// មុខងារ៖ **ចលនាពេលបើក App។** សំបកដែល cache ទុកបង្ហាញភ្លាម ➜ អ្នកប្រើឃើញ
// UI ទទេលោតចេញមកដោយគ្មានការត្រៀម (អ្នកប្រើរាយការណ៍ថា «ពិបាកភ្នែក»)។
// ផ្ទាំង boot គ្របការលោតនោះ រួចរលាយចេញពេល App រៀបចំរួច។
//
// តេស្តនេះចាក់សោលក្ខខណ្ឌដែលធ្វើឲ្យផ្ទាំងនេះ **មិនអាចក្លាយជាកំហុស**៖
//
//   ១. វា **រលាយចេញពិត** — App មិនត្រូវជាប់ក្រោមផ្ទាំងសដែលមិនចេះបាត់។
//   ២. វា `pointer-events: none` **ជានិច្ច** — ផ្ទាំងតុបតែងមិនត្រូវលេបការចុច
//      របស់អ្នកប្រើ (ថ្នាក់កំហុសបុរាណរបស់ splash screen)។
//   ៣. មាន **សំណាញ់សុវត្ថិភាពក្នុង `boot-flags.js`** — បើ `app.js` បោះ
//      exception មុនហៅ `revealAppAfterBoot()` នោះផ្ទាំងនៅតែត្រូវដកចេញ
//      មិនមែនជាប់ជារៀងរហូតទេ។
//   ៤. class `boot-reveal` ត្រូវ **ដកចេញវិញ** ក្រោយចលនាចប់ ➜ គ្មាន
//      stacking context ឬ animation សល់លើ chrome របស់ App។
//   ៥. ចលនាទាំងអស់ជា `transform`/`opacity` ➜ គ្មាន layout រាល់ស៊ុម។
//   ៦. **គ្មាន `transform` លើ `.app-navbar`/`.app-pages`/`.page-tabbar`** —
//      `transform` បង្កើត containing block សម្រាប់កូន `position: fixed`
//      ហើយរបា Tab ពឹងលើ `translate3d` របស់ `setupChromeAutoHide()` រួចហើយ។
//      នេះជាព្រំដែនរវាងចលនា boot និង **តំបន់ហាមចូល** (PTR · ចលនាផ្ទាំង · រមូរ)។
//   ៧. ការបើកឡើងវិញតាម PTR **រំលងផ្ទាំង** — PTR ត្រូវនៅតែមានអារម្មណ៍ភ្លាមៗ។
const fs = require('fs');
const http = require('http');
const path = require('path');

const ROOT = process.env.BOOTANIM_APP_DIR || path.join(__dirname, '..');
let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { pass++; console.log('  ok    ' + label); }
    else { fail++; console.log('  FAIL  ' + label + (detail !== undefined ? '\n        ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : '')); }
}

function sliceKeyframes(css, name) {
    const start = css.indexOf('@keyframes ' + name);
    if (start === -1) return '';
    let depth = 0, started = false, i = css.indexOf('{', start);
    if (i === -1) return '';
    for (; i < css.length; i++) {
        if (css[i] === '{') { depth++; started = true; }
        else if (css[i] === '}') { depth--; if (started && depth === 0) { i++; break; } }
    }
    return css.slice(start, i);
}

const APPS = ['ZoeW', 'ZoeKeyGen'];
const CHROME_SELECTORS = ['.app-navbar', '.app-pages', '.page-tabbar', '.app-container', '.app-body'];

// === ផ្នែកទី ១ — រចនាសម្ព័ន្ធ ===
for (const app of APPS) {
    const html = fs.readFileSync(path.join(ROOT, app, 'index.html'), 'utf8');
    const css = fs.readFileSync(path.join(ROOT, app, 'style.css'), 'utf8');
    const js = fs.readFileSync(path.join(ROOT, app, 'app.js'), 'utf8');
    const flags = fs.readFileSync(path.join(ROOT, app, 'boot-flags.js'), 'utf8');
    const sw = fs.readFileSync(path.join(ROOT, app, 'sw.js'), 'utf8');

    ok(app + ': ផ្ទាំង boot ស្ថិតក្នុង index.html', /id="bootSplash"/.test(html));
    // App React ៖ `<body>` មាន mount តែមួយ (`#root`) ➜ ផ្ទាំងត្រូវជាធាតុដំបូងរបស់វា (markup ដែល React គូរពិត)
    const isReact = fs.existsSync(path.join(ROOT, app, 'react-render.cjs'));
    const comp = isReact ? fs.readFileSync(path.join(ROOT, app, 'components.js'), 'utf8') : '';
    ok(app + ': ផ្ទាំង boot ជាធាតុដំបូងក្នុង <body> (គ្របមុនអ្វីៗទាំងអស់)',
        /<body>\s*<div class="boot-splash"/.test(html)
        || (isReact && /<body>\s*<div id="root">\s*<div class="boot-splash"/.test(html)));
    ok(app + ': ផ្ទាំង boot មាន aria-hidden (screen reader រំលង)',
        /id="bootSplash"[^>]*aria-hidden="true"|aria-hidden="true"[^>]*id="bootSplash"/.test(html));

    ok(app + ': **`pointer-events: none` ជានិច្ច** (មិនលេបការចុច)',
        /\.boot-splash \{[^}]*pointer-events:\s*none/.test(css), 'រកមិនឃើញ pointer-events: none លើ .boot-splash');
    ok(app + ': ផ្ទាំងបាត់ទាំងស្រុងក្រោយចប់ (display: none)',
        /\.boot-splash\.boot-splash-gone \{[^}]*display:\s*none/.test(css));

    ok(app + ': app.js មាន revealAppAfterBoot និង hideBootSplash',
        /function revealAppAfterBoot\(/.test(js) && /function hideBootSplash\(/.test(js));
    ok(app + ': app.js ហៅ revealAppAfterBoot ពេល boot',
        /\n\s*revealAppAfterBoot\(\);/.test(js));
    // App React ៖ `hideBootSplash()` បន្ទាប `bootRevealing` ក្នុង setTimeout ហើយ `DocumentEffects` (JSX) ចង class ពី state នោះ
    const hide = (js.match(/function hideBootSplash\(\) \{[\s\S]*?\n    \}/) || [''])[0];
    ok(app + ': class boot-reveal ត្រូវ **ដកចេញវិញ** ក្រោយចលនាចប់',
        /classList\.remove\('boot-reveal'\)/.test(js)
        || (isReact && /setTimeout\([\s\S]*?bootRevealing = false/.test(hide) && /useBodyClass\("boot-reveal", bootRevealing\)/.test(comp)),
        'boot-reveal នៅជាប់ ➜ animation/stacking context សល់');

    // App React ៖ ផ្ទាំងជារបស់ React (`BootSplash` · `id: "bootSplash"`) ➜ bundle ដួល = **គ្មានផ្ទាំង** (មិនមែនផ្ទាំងជាប់)
    //    ហើយ boot យឺត ➜ `armBootSplashFallback()` (setTimeout) រសាត់ផ្ទាំងចេញពេល mount (browser វាស់ផ្លូវ bundle ដួលពិត)
    const fallback = (js.match(/function armBootSplashFallback\(\) \{[\s\S]*?\n    \}/) || [''])[0];
    ok(app + ': **សំណាញ់សុវត្ថិភាព** ក្នុង boot-flags.js (app.js ដួល ➜ ផ្ទាំងនៅតែបាត់)',
        (/bootSplash/.test(flags) && /boot-splash-out/.test(flags) && /setTimeout/.test(flags))
        || (isReact && /id: "bootSplash"/.test(comp) && /armBootSplashFallback\(\)/.test(comp) && /setTimeout/.test(fallback)),
        'boot-flags.js គ្មានសំណាញ់ ➜ exception ក្នុង app.js = App ជាប់ក្រោមផ្ទាំងស');
    ok(app + ': boot-flags.js ស្ថិតក្នុង CORE_SHELL របស់ sw.js',
        /'\.\/boot-flags\.js'/.test(sw));

    // ⛔ ព្រំដែនជាមួយតំបន់ហាមចូល
    const revealRules = css.match(/body\.boot-reveal [^{]*\{[^}]*\}/g) || [];
    ok(app + ': មានច្បាប់លេចមុខសម្រាប់ chrome របស់ App', revealRules.length > 0, revealRules.length);
    const chromeTransform = revealRules.filter((r) =>
        CHROME_SELECTORS.some((sel) => r.indexOf(sel) !== -1) && /transform/.test(r));
    ok(app + ': ⛔ **គ្មាន `transform` លើ chrome របស់ App** (containing block របស់ `position: fixed`)',
        chromeTransform.length === 0, chromeTransform);

    const revealKeyframeNames = [];
    revealRules.forEach((r) => {
        const m = r.match(/animation:\s*([\w-]+)/);
        if (m && m[1] !== 'none' && revealKeyframeNames.indexOf(m[1]) === -1) revealKeyframeNames.push(m[1]);
    });
    ['bootRise', 'bootSweep'].forEach((n) => { if (revealKeyframeNames.indexOf(n) === -1) revealKeyframeNames.push(n); });
    revealKeyframeNames.forEach((name) => {
        const body = sliceKeyframes(css, name);
        const props = (body.match(/([a-z-]+)\s*:/g) || []).map((x) => x.replace(/[^a-z-]/g, ''));
        const bad = props.filter((prop) => prop !== 'opacity' && prop !== 'transform');
        ok(app + ': @keyframes ' + name + ' ធ្វើចលនាតែលើ opacity/transform', body !== '' && bad.length === 0, { body: body.slice(0, 120), bad: bad });
    });

    ok(app + ': គោរព prefers-reduced-motion',
        /@media \(prefers-reduced-motion: reduce\)[\s\S]{0,600}boot-splash/.test(css));
}

// ⛔ **ធនធានឆ្លង origin ក្នុង `<head>` មិនត្រូវទប់ការគូរ App ឡើយ។**
// `sw.js` បោះបង់សំណើឆ្លង origin ដោយចេតនា ➜ ធនធានទាំងនោះ **មិនដែលចូល cache**
// ➜ លើបណ្តាញ «ភ្ជាប់តែស្លាប់» វាព្យួររហូតដល់ timeout។ វាស់លើ Chromium ពិត
// (host ខាងក្រៅព្យួរ ២០ វិ.)៖
//
//   | ស្ថានភាព                  | មុនកែ        | ក្រោយកែ |
//   |---------------------------|--------------|---------|
//   | បណ្តាញធម្មតា               | ១៨៦ ms       | ១៨៦ ms  |
//   | js.sentry-cdn.com ព្យួរ    | **២០២៥១ ms** | ២៤៩ ms  |
//   | fonts.googleapis.com ព្យួរ | **២០១៦៨ ms** | ២០០ ms  |
//   | ព្យួរទាំង ២                | **២០១៥៨ ms** | ១៩៥ ms  |
//
// អេក្រង់ស ២០ វិនាទី ខណៈគ្រប់ឯកសាររបស់ App នៅក្នុង cache រួចស្រេច។
for (const app of APPS) {
    const html = fs.readFileSync(path.join(ROOT, app, 'index.html'), 'utf8');
    const flagsSrc = fs.readFileSync(path.join(ROOT, app, 'boot-flags.js'), 'utf8');

    // App ដែលគ្មាន host ខាងក្រៅសោះ ➜ គ្មានអ្វីត្រូវធ្វើឲ្យ async
    if (!/sentry-cdn\.com|fonts\.googleapis\.com/.test(html)) {
        ok(app + ': គ្មានធនធានឆ្លង origin ក្នុង <head> សោះ (ល្អជាងគេ)', true);
        ok(app + ': សំណាញ់សុវត្ថិភាពត្រូវ **រៀបចំពេល DOM រួចរាល់**',
            /DOMContentLoaded/.test(flagsSrc));
        continue;
    }

    const sentryTags = html.match(/<script[^>]*sentry-cdn\.com[^>]*>/g) || [];
    ok(app + ': ⛔ script របស់ Sentry មិនទប់ parser (`async`)',
        sentryTags.length > 0 && sentryTags.every((t) => /\basync\b/.test(t) || /\bdefer\b/.test(t)), sentryTags);

    // `<noscript>` មិនត្រូវរាប់ទេ — browser ដែលបើក JS មិន parse វាជា stylesheet
    const htmlNoNoscript = html.replace(/<noscript>[\s\S]*?<\/noscript>/g, '');
    const fontTags = (htmlNoNoscript.match(/<link[^>]*fonts\.googleapis\.com[^>]*>/g) || [])
        .filter((t) => /rel="stylesheet"/.test(t));
    const blocking = fontTags.filter((t) => !/media="print"/.test(t));
    ok(app + ': ⛔ stylesheet របស់ពុម្ពអក្សរមិនទប់ការគូរ (`media="print"`)',
        fontTags.length > 0 && blocking.length === 0, blocking);

    ok(app + ': boot-flags.js ប្តូរពុម្ពអក្សរទៅ media="all" ពេល DOM រួចរាល់',
        /webFontCss/.test(flagsSrc) && /media = 'all'/.test(flagsSrc));
    ok(app + ': សំណាញ់សុវត្ថិភាពត្រូវ **រៀបចំពេល DOM រួចរាល់** (មិនមែនពេល parse ក្បាល)',
        /DOMContentLoaded/.test(flagsSrc),
        'បើរៀបចំពេល parse ក្បាល នោះ #bootSplash មិនទាន់មាន ➜ សំណាញ់គ្មានប្រសិទ្ធភាព');
}

// PTR ត្រូវរំលងផ្ទាំង — ZoeW ប៉ុណ្ណោះ (ZoeKeyGen គ្មាន PTR)
{
    const flags = fs.readFileSync(path.join(ROOT, 'ZoeW', 'boot-flags.js'), 'utf8');
    const css = fs.readFileSync(path.join(ROOT, 'ZoeW', 'style.css'), 'utf8');
    ok('ZoeW: ការបើកឡើងវិញតាម PTR រំលងផ្ទាំង (PTR នៅតែភ្លាមៗ)',
        /zoew_ptr_reload_pending/.test(flags) && /boot-instant/.test(flags) &&
        /html\.boot-instant \.boot-splash \{[^}]*display:\s*none/.test(css));
}

// === ផ្នែកទី ២ — វាស់លើ Chromium ពិត ===
let chromium;
try { chromium = require('playwright-core').chromium; } catch (e) {
    console.log('\nSKIP ផ្នែក browser — ត្រូវការ playwright-core');
    console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')' : '✅ ជោគជ័យ ' + pass));
    process.exit(fail ? 1 : 0);
}
const CHROME = process.env.BOOTANIM_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
if (!fs.existsSync(CHROME)) {
    console.log('\nSKIP ផ្នែក browser — រកមិនឃើញ Chromium');
    console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')' : '✅ ជោគជ័យ ' + pass));
    process.exit(fail ? 1 : 0);
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.png': 'image/png' };
function serve(dir) {
    return new Promise((res) => {
        const s = http.createServer((req, rsp) => {
            let p = decodeURIComponent(req.url.split('?')[0]);
            if (p === '/') p = '/index.html';
            const file = path.join(dir, p);
            if (!file.startsWith(dir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { rsp.writeHead(404); rsp.end('nf'); return; }
            rsp.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
            rsp.end(fs.readFileSync(file));
        });
        s.listen(0, '127.0.0.1', () => res(s));
    });
}

async function isolateBootContext(context, base) {
    await context.route('**', (route) => {
        return new URL(route.request().url()).origin === base ? route.continue() : route.abort();
    });
}

(async () => {
    const server = await serve(path.join(ROOT, 'ZoeW'));
    const base = 'http://127.0.0.1:' + server.address().port;
    const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
    try {
        for (const app of APPS) {
            const motionPage = await browser.newPage();
            await motionPage.setContent('<div class="toast-container"><div class="toast show">សាកល្បង</div></div><button>សាកល្បង</button>');
            await motionPage.addStyleTag({ content: fs.readFileSync(path.join(ROOT, app, 'style.css'), 'utf8') });
            for (const reduced of [false, true]) {
                await motionPage.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
                const transitions = await motionPage.evaluate(() => ['toast', 'button'].map((name) => {
                    const el = document.querySelector(name === 'toast' ? '.toast' : name);
                    const css = getComputedStyle(el);
                    return { name, duration: Math.max(...css.transitionDuration.split(',').map(parseFloat)), opacity: Number(css.opacity) };
                }));
                ok(app + ' ៖ toast និងប៊ូតុងគោរព Reduce Motion = ' + reduced,
                    transitions.length === 2 && transitions.every((t) => reduced ? t.duration === 0 : t.duration > 0), transitions);
            }
            await motionPage.close();
        }
        const ctx = await browser.newContext({ viewport: { width: 412, height: 780 }, serviceWorkers: 'block' });
        await isolateBootContext(ctx, base);
        const page = await ctx.newPage();
        page.on('pageerror', () => {});
        await page.addInitScript(`window.addEventListener('unhandledrejection', function (ev) {
                    var m; try { m = String((ev.reason && (ev.reason.message || ev.reason)) || 'unknown'); } catch (x) { m = 'unknown'; }
                    setTimeout(function () { throw new Error('unhandledrejection: ' + m); }, 0);
                });`);
        await page.goto(base + '/', { waitUntil: 'domcontentloaded' });

        // ផ្ទាំងត្រូវគ្របពេញអេក្រង់ភ្លាមៗ — ការលោតរបស់ UI ទទេត្រូវលាក់
        const atStart = await page.evaluate(() => {
            const el = document.getElementById('bootSplash');
            if (!el) return null;
            const cs = getComputedStyle(el);
            const r = el.getBoundingClientRect();
            return {
                visible: cs.display !== 'none' && Number(cs.opacity) > 0.5,
                pointerEvents: cs.pointerEvents,
                coversViewport: Math.round(r.width) >= window.innerWidth && Math.round(r.height) >= window.innerHeight,
                zIndex: cs.zIndex
            };
        });
        ok('ផ្ទាំងគ្របពេញអេក្រង់ភ្លាមៗពេល boot', !!atStart && atStart.visible && atStart.coversViewport, atStart);
        ok('ផ្ទាំងមិនលេបការចុច (pointer-events: none)', !!atStart && atStart.pointerEvents === 'none', atStart);

        // ធាតុពិតខាងក្រោមផ្ទាំងត្រូវនៅតែចុចបាន (ផ្ទាំងមិនបាំង hit-test)
        const hitThrough = await page.evaluate(() => {
            const splash = document.getElementById('bootSplash');
            const pts = [[10, 10], [window.innerWidth / 2, window.innerHeight / 2], [window.innerWidth - 10, window.innerHeight - 10]];
            const hits = pts.map(([x, y]) => {
                const el = document.elementFromPoint(x, y);
                return el && (el === splash || splash.contains(el)) ? 'splash' : 'app';
            });
            return hits;
        });
        ok('ផ្ទាំងមិនដែលជាគោលដៅ hit-test (ការចុចទៅដល់ App ពិត)',
            Array.isArray(hitThrough) && hitThrough.every((h) => h === 'app'), hitThrough);

        // ផ្ទាំងត្រូវ **រលាយចេញពិត** — App មិនត្រូវជាប់ក្រោមផ្ទាំងស
        await page.waitForFunction(() => {
            const el = document.getElementById('bootSplash');
            return !el || getComputedStyle(el).display === 'none';
        }, null, { timeout: 12000 }).then(() => ok('ផ្ទាំងរលាយចេញ ហើយបាត់ទាំងស្រុង', true),
                                          () => ok('ផ្ទាំងរលាយចេញ ហើយបាត់ទាំងស្រុង', false, 'នៅតែឃើញក្រោយ ១២ វិ.'));

        const after = await page.evaluate(() => {
            const nav = document.querySelector('.app-navbar');
            const pages = document.getElementById('appPages');
            const tab = document.getElementById('pageTabBar');
            const cs = (el) => (el ? getComputedStyle(el) : null);
            return {
                bodyHasReveal: document.body.classList.contains('boot-reveal'),
                navOpacity: cs(nav) && cs(nav).opacity,
                pagesOpacity: cs(pages) && cs(pages).opacity,
                tabOpacity: cs(tab) && cs(tab).opacity,
                navTransform: cs(nav) && cs(nav).transform,
                pagesTransform: cs(pages) && cs(pages).transform,
                tabFixed: cs(tab) && cs(tab).position,
                scrollTop: document.getElementById('appPages').scrollTop,
                rootScroll: document.documentElement.scrollTop || document.body.scrollTop
            };
        });
        ok('class boot-reveal ត្រូវដកចេញវិញ (គ្មានអ្វីសល់លើ chrome)', after.bodyHasReveal === false, after);
        ok('chrome របស់ App ត្រឡប់មក opacity ពេញ',
            after.navOpacity === '1' && after.pagesOpacity === '1' && after.tabOpacity === '1', after);
        ok('⛔ គ្មាន transform សល់លើ navbar/pages (containing block របស់ fixed)',
            (after.navTransform === 'none' || !after.navTransform) &&
            (after.pagesTransform === 'none' || !after.pagesTransform), after);
        ok('របា Tab នៅតែជា position: fixed', after.tabFixed === 'fixed', after.tabFixed);
        ok('ចលនា boot មិនបន្សល់ការរមូរ (PTR ត្រូវការ scrollTop <= 1)',
            after.scrollTop <= 1 && after.rootScroll <= 1, after);

        // សំណាញ់សុវត្ថិភាព៖ app.js ដួល ➜ boot-flags.js ត្រូវដកផ្ទាំងចេញដដែល
        const ctx2 = await browser.newContext({ viewport: { width: 412, height: 780 }, serviceWorkers: 'block' });
        await isolateBootContext(ctx2, base);
        const page2 = await ctx2.newPage();
        page2.on('pageerror', () => {});
        // App React ៖ index.html មិនផ្ទុក `app.js` (ទិដ្ឋភាពសម្រាប់ checker) ➜ ដួល **bundle ចូលពិត** (`<script type="module" src>`)
        const entryHtml = fs.readFileSync(path.join(ROOT, 'ZoeW', 'index.html'), 'utf8');
        const entry = (/<script type="module"[^>]*\bsrc="\.?\/?([^"]+)"/.exec(entryHtml) || [])[1];
        const crashPattern = entry ? '**/' + entry.replace(/^.*\//, '') : '**/app.js';
        ok('⛔ ជាន់អប្បបរមា ៖ ដេរីវេ script ចូលរបស់ App ពី index.html', !!entry || /<script[^>]*src="app\.js"/.test(entryHtml), crashPattern);
        await page2.route(crashPattern, (route) => route.fulfill({ status: 200, contentType: 'text/javascript', body: 'throw new Error("boot failure simulated");' }));
        // App React ៖ `index.html` របស់ tree វាស់មាន markup prerender (សម្រាប់ checker អត្ថបទ) ដែលផលិតកម្ម **មិនមាន** ➜ ផ្លូវ
        //    ដួលត្រូវបម្រើ `index.html` ដែល ship ពិត (`index.shipped.html` — build-audit) បើមិនដូច្នេះវាវាស់ផ្ទាំងក្លែង
        const shippedPath = path.join(ROOT, 'ZoeW', 'index.shipped.html');
        if (fs.existsSync(shippedPath)) {
            const shipped = fs.readFileSync(shippedPath, 'utf8');
            await page2.route(base + '/', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: shipped }));
        }
        await page2.goto(base + '/', { waitUntil: 'domcontentloaded' });
        const rescued = await page2.waitForFunction(() => {
            const el = document.getElementById('bootSplash');
            return !el || el.classList.contains('boot-splash-out');
        }, null, { timeout: 15000 }).then(() => true, () => false);
        ok('**app.js ដួល ➜ ផ្ទាំងនៅតែត្រូវដកចេញ** (App មិនជាប់ក្រោមផ្ទាំងស)', rescued === true);


        // ⛔ **ការវាស់សំខាន់បំផុត៖ host ខាងក្រៅព្យួរ ➜ App ត្រូវតែនៅគូរបានដដែល។**
        const HANG_MS = 12000;
        const PAINT_BUDGET_MS = 4000;
        const ctx4 = await browser.newContext({ viewport: { width: 412, height: 780 }, serviceWorkers: 'block' });
        const page4 = await ctx4.newPage();
        page4.on('pageerror', () => {});
        await page4.route('**', async (route) => {
            const u = route.request().url();
            const isThirdParty = u.indexOf('sentry-cdn.com') !== -1 ||
                u.indexOf('fonts.googleapis.com') !== -1 || u.indexOf('fonts.gstatic.com') !== -1;
            if (isThirdParty) { await new Promise((r) => setTimeout(r, HANG_MS)); return route.abort(); }
            if (u.indexOf('127.0.0.1') === -1) return route.abort();
            return route.continue();
        });
        const t0 = Date.now();
        await page4.goto(base + '/', { waitUntil: 'commit' });
        const paintedMs = await page4.waitForFunction(() => {
            const el = document.getElementById('bootSplash');
            if (!el) return false;
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0;
        }, null, { timeout: HANG_MS + 6000 }).then(() => Date.now() - t0, () => -1);
        ok('⛔ **host ខាងក្រៅព្យួរ ➜ App នៅតែគូរបានក្នុងរយៈពេលខ្លី** (មិនមែនអេក្រង់ស)',
            paintedMs !== -1 && paintedMs < PAINT_BUDGET_MS,
            { paintedMs: paintedMs, hangMs: HANG_MS, budgetMs: PAINT_BUDGET_MS });
        console.log('\n  ↳ ពេល host ខាងក្រៅព្យួរ ' + HANG_MS + ' ms ៖ App គូរបាននៅ ' +
            (paintedMs === -1 ? 'មិនដែលគូរ' : paintedMs + ' ms'));
        await ctx4.close();

        // ការបើកឡើងវិញតាម PTR ត្រូវរំលងផ្ទាំង
        const ctx3 = await browser.newContext({ viewport: { width: 412, height: 780 }, serviceWorkers: 'block' });
        await isolateBootContext(ctx3, base);
        const page3 = await ctx3.newPage();
        page3.on('pageerror', () => {});
        await page3.addInitScript(() => { try { sessionStorage.setItem('zoew_ptr_reload_pending', '1'); } catch (e) {} });
        await page3.goto(base + '/', { waitUntil: 'domcontentloaded' });
        const ptrSkip = await page3.evaluate(() => {
            const el = document.getElementById('bootSplash');
            return { rootClass: document.documentElement.className, display: el ? getComputedStyle(el).display : 'missing' };
        });
        ok('ការបើកឡើងវិញតាម PTR រំលងផ្ទាំង (PTR នៅតែភ្លាមៗ)',
            ptrSkip.display === 'none', ptrSkip);
    } finally {
        await browser.close();
        server.close();
    }

    console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')' : '✅ ជោគជ័យ ' + pass));
    process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
