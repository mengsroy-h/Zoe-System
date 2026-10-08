// ថ្នាក់ ៖ **chunk `supabase-backend` (~២៤០ KB) ត្រូវទាញតែលើឧបករណ៍ដែលប្រើ Supabase** (សេចក្តីសម្រេចម្ចាស់គម្រោង)
//
//   node audit-tools/sw-backend-chunk-test.js
//
// ⛔ មុនកែ ៖ chunk ស្ថិតក្នុង `CORE_SHELL` ➜ SW ទាញវាពេល install លើ **គ្រប់** ឧបករណ៍ (ហាង Firebase ក៏ទាញ) រាល់ `CACHE_VERSION`។
// ⛔ ទិសផ្ទុយដែលត្រូវរក្សា ៖ ហាង Supabase បើក **ក្រៅបណ្តាញ** បាន ➜ ពេលប្រើលើកដំបូង chunk ចូល cache · កំណែក្រោយ install វា
//    **ក្នុងក្រុម install តែមួយ** (មិនរង់ចាំការបើក App លើកក្រោយ) · cache ចាស់មុនកែ (គ្មានសញ្ញាគ្រោងថ្មី) ដែលមាន chunk ➜ រក្សាវា ១ ដង ។
// វាស់លើ Chromium ពិត + `sw.js` ពិត (build) ៖ ទំព័រតេស្តទទេ (មិនមែន App) ចុះឈ្មោះ SW ➜ ការ update ធ្វើត្រាប់ដោយប្តូរ `CACHE_VERSION`
// ក្នុង `sw.js` ដែល server ផ្តល់ · «ក្រៅបណ្តាញ» = server បិទ socket ។
'use strict';

process.exitCode = 1;

const fs = require('fs');
const http = require('http');
const path = require('path');

const ROOT = process.env.SWBACKEND_APP_DIR ? path.resolve(process.env.SWBACKEND_APP_DIR) : path.join(__dirname, '..');
const DIR = path.join(ROOT, 'ZoeW');
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.png': 'image/png', '.svg': 'image/svg+xml' };
const WAIT_MS = 20000;

let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { pass++; console.log('  ok    ' + label); }
    else { fail++; console.log('  FAIL  ' + label + (detail !== undefined ? '\n        ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : '')); }
}
function finish() {
    console.log('\n' + (fail === 0 ? '✅ ជោគជ័យ ' + pass : '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')'));
    process.exitCode = fail === 0 ? 0 : 1;
}

const watchdog = setTimeout(() => {
    ok('checker បញ្ចប់ក្នុងពិដាន ២៤០ វិ.', false);
    finish();
    process.exit(1);
}, 240000);
watchdog.unref();

console.log('=== sw-backend-chunk ៖ chunk Supabase តែលើឧបករណ៍ដែលប្រើ · ហាង Supabase ក្រៅបណ្តាញ ===');

const assetsDir = path.join(DIR, 'assets');
const chunks = fs.existsSync(assetsDir) ? fs.readdirSync(assetsDir).filter((f) => /^supabase-backend-[^/]+\.js$/.test(f)) : [];
ok('build មាន chunk supabase-backend តែ ១ (ឃើញ ' + chunks.length + ')', chunks.length === 1, chunks);
const swPath = path.join(DIR, 'sw.js');
const swShipped = fs.existsSync(swPath) ? fs.readFileSync(swPath, 'utf8') : '';
const versionMatch = swShipped.match(/zoew-v\d+/);
ok('sw.js មាន CACHE_VERSION', !!versionMatch);
// ⛔ build វាស់ ៖ `expose-globals` import chunk ដោយផ្ទាល់ ➜ plugin ដាក់វាក្នុង CORE_SHELL (boot ត្រូវការវា) ➜ រៀបបញ្ជីតាមរូបរាង
//    ផលិតកម្ម (chunk ផ្ទុកតែតាម `import()` ➜ `__BACKEND_SHELL__`) មុនវាស់ logic របស់ `sw.ts` ។ ការបែងចែកផលិតកម្មពិត ➜ `npm run smoke`។
function productionShape(src, rel) {
    const listRe = (name) => new RegExp('const ' + name + ' = \\[([\\s\\S]*?)\\];');
    const coreM = src.match(listRe('CORE_SHELL'));
    const backM = src.match(listRe('BACKEND_SHELL'));
    if (!coreM || !backM) return null;
    const entries = (body) => [...body.matchAll(/'([^']+)'/g)].map((m) => m[1]);
    const lit = (list) => '[\n' + list.map((u) => "    '" + u + "'").join(',\n') + '\n]';
    const core = entries(coreM[1]).filter((u) => u !== rel);
    const back = entries(backM[1]).filter((u) => u !== rel).concat([rel]);
    return src.replace(listRe('CORE_SHELL'), () => 'const CORE_SHELL = ' + lit(core) + ';')
        .replace(listRe('BACKEND_SHELL'), () => 'const BACKEND_SHELL = ' + lit(back) + ';');
}
const swSource = chunks.length ? productionShape(swShipped, './assets/' + chunks[0]) : null;
ok('sw.js មានក្រុម install backend (`BACKEND_SHELL`) ដាច់ពី `CORE_SHELL`', !!swSource);

let chromium = null;
try { chromium = require('playwright-core').chromium; } catch (e) { chromium = null; }
const CHROME = process.env.SWBACKEND_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

if (!chunks.length || !versionMatch || !swSource) {
    finish();
} else if (!chromium || !fs.existsSync(CHROME)) {
    console.log('SKIP — ត្រូវការ playwright-core + Chromium');
    finish();
} else {
    main().catch((e) => ok('ការវាស់មិនគាំង', false, String(e && e.stack || e))).finally(finish);
}

function startServer(state) {
    return new Promise((resolve) => {
        const sockets = new Set();
        const server = http.createServer((req, res) => {
            let p = decodeURIComponent(req.url.split('?')[0]);
            state.hits[p] = (state.hits[p] || 0) + 1;
            if (state.offline) { req.socket.destroy(); return; }
            if (p === '/__swtest.html') {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end('<!doctype html><meta charset="utf-8"><title>sw</title>');
                return;
            }
            if (p === '/') p = '/index.html';
            if (state.gone && state.gone.has(p)) p = '/index.html';
            const f = path.join(DIR, p);
            if (!f.startsWith(DIR) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
            let body = fs.readFileSync(f);
            if (p === '/sw.js') body = Buffer.from(swSource.split(versionMatch[0]).join(state.version));
            res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
            res.end(body);
        });
        server.on('connection', (s) => { sockets.add(s); s.on('close', () => sockets.delete(s)); });
        server.listen(0, '127.0.0.1', () => resolve({ server, sockets, origin: 'http://127.0.0.1:' + server.address().port }));
    });
}

const PAGE_HELPERS = `
window.__sw = {
    async settle(version, ms) {
        const until = Date.now() + ms;
        while (Date.now() < until) {
            const reg = await navigator.serviceWorker.getRegistration('./');
            const keys = await caches.keys();
            const zoew = keys.filter((k) => k.startsWith('zoew-'));
            if (reg && reg.active && reg.active.state === 'activated' && !reg.installing && !reg.waiting
                && navigator.serviceWorker.controller && zoew.length === 1 && zoew[0] === version) return { ok: true, keys };
            await new Promise((r) => setTimeout(r, 100));
        }
        const reg = await navigator.serviceWorker.getRegistration('./');
        return { ok: false, keys: await caches.keys(), state: reg && reg.active ? reg.active.state : null, installing: !!(reg && reg.installing),
            waiting: !!(reg && reg.waiting), controlled: !!navigator.serviceWorker.controller };
    },
    async has(version, url) {
        const c = await caches.open(version);
        return !!(await c.match(url));
    },
    async get(url) {
        try {
            const r = await fetch(url);
            return { status: r.status, size: (await r.arrayBuffer()).byteLength };
        } catch (e) {
            return { status: 0, error: String(e) };
        }
    }
};`;

async function main() {
    const chunkUrl = './assets/' + chunks[0];
    const chunkPath = '/assets/' + chunks[0];
    const chunkSize = fs.statSync(path.join(assetsDir, chunks[0])).size;
    const browser = await chromium.launch({ executablePath: CHROME });
    try {
        async function device(label, prepare) {
            const state = { version: 'zoew-v900001', offline: false, hits: {} };
            const srv = await startServer(state);
            const ctx = await browser.newContext();
            await ctx.route('**', (r) => (r.request().url().startsWith(srv.origin) ? r.continue() : r.abort()));
            const page = await ctx.newPage();
            await page.goto(srv.origin + '/__swtest.html', { waitUntil: 'load', timeout: WAIT_MS });
            await page.evaluate(PAGE_HELPERS);
            if (prepare) await page.evaluate(prepare, chunkUrl);
            await page.evaluate(() => navigator.serviceWorker.register('./sw.js', { scope: './' }));
            const first = await page.evaluate((v) => window.__sw.settle(v, 20000), state.version);
            ok(label + ' ៖ SW install + activate + គ្រប់គ្រងទំព័រ', first.ok, first);
            const api = {
                state, page,
                has: (v) => page.evaluate(([vv, u]) => window.__sw.has(vv, u), [v || state.version, chunkUrl]),
                load: () => page.evaluate((u) => window.__sw.get(u), chunkUrl),
                async update(next) {
                    state.version = next;
                    await page.evaluate(() => navigator.serviceWorker.getRegistration('./').then((reg) => reg && reg.update()).catch(() => null));
                    const r = await page.evaluate((v) => window.__sw.settle(v, 20000), next);
                    ok(label + ' ៖ update ➜ ' + next + ' activate · cache ចាស់លុប', r.ok, r);
                    return r.ok;
                },
                async close() {
                    await ctx.close();
                    for (const s of srv.sockets) s.destroy();
                    srv.server.close();
                }
            };
            return api;
        }

        console.log('\n── ១. ឧបករណ៍ហាង Firebase (មិនដែលប្រើ Supabase) ──');
        const fb = await device('Firebase');
        ok('Firebase ៖ install មិនទាញ chunk Supabase (server មិនឃើញសំណើ · មិននៅក្នុង cache)',
            !(await fb.has()) && !fb.state.hits[chunkPath], { cached: await fb.has(), hits: fb.state.hits[chunkPath] || 0 });
        ok('ការវាស់ពិត ៖ install ទាញ index.html ពិតមែន (មិនមែន SW ទទេ)', (fb.state.hits['/index.html'] || 0) >= 1, fb.state.hits);
        await fb.update('zoew-v900002');
        ok('Firebase ៖ កំណែក្រោយក៏មិនទាញ chunk Supabase', !(await fb.has()) && !fb.state.hits[chunkPath], fb.state.hits[chunkPath] || 0);
        await fb.close();

        console.log('\n── ២. ឧបករណ៍ហាង Supabase ──');
        const sb = await device('Supabase');
        const firstLoad = await sb.load();
        ok('Supabase ៖ ការផ្ទុក chunk លើកដំបូងតាម SW ➜ 200', firstLoad.status === 200 && firstLoad.size === chunkSize, firstLoad);
        ok('Supabase ៖ chunk ចូល cache ក្រោយការប្រើលើកដំបូង', await sb.has());
        sb.state.offline = true;
        const offlineLoad = await sb.load();
        ok('Supabase ៖ ក្រៅបណ្តាញ ➜ chunk ពី cache (App បើកបាន)', offlineLoad.status === 200 && offlineLoad.size === chunkSize, offlineLoad);
        sb.state.offline = false;
        const hitsBefore = sb.state.hits[chunkPath] || 0;
        await sb.update('zoew-v900002');
        ok('Supabase ៖ កំណែក្រោយ install chunk ក្នុងក្រុម install (មុនការបើក App)', await sb.has() && (sb.state.hits[chunkPath] || 0) === hitsBefore + 1,
            { hitsBefore, hitsAfter: sb.state.hits[chunkPath] });
        await sb.update('zoew-v900003');
        ok('Supabase ៖ ទំព័របើកជាប់ ២ កំណែ (មិនផ្ទុក chunk ក្រោមកំណែកណ្តាល) ➜ នៅ install chunk', await sb.has());
        sb.state.offline = true;
        const afterUpdate = await sb.load();
        ok('Supabase ៖ ក្រោយ update ក្រៅបណ្តាញភ្លាម ➜ chunk នៅ', afterUpdate.status === 200 && afterUpdate.size === chunkSize, afterUpdate);
        sb.state.offline = false;
        await sb.close();

        console.log('\n── ៣. ការផ្លាស់ពី SW មុនកែ (cache ចាស់មាន chunk សម្រាប់គ្រប់ឧបករណ៍) ──');
        const legacyPrepare = async (u) => {
            const c = await caches.open('zoew-v100');
            await c.put(new URL(u, location.href).pathname, new Response('legacy'));
            await c.put('./index.html', new Response('legacy'));
        };
        const legacy = await device('ការផ្លាស់', legacyPrepare);
        ok('ការផ្លាស់ ៖ cache ចាស់មុនកែមាន chunk ➜ រក្សាវា ១ ដង (ហាង Supabase មិនបាត់ក្រៅបណ្តាញ)', await legacy.has());
        await legacy.update('zoew-v900002');
        ok('ការផ្លាស់ ៖ មិនប្រើ chunk ក្រោម SW ថ្មី (ហាង Firebase) ➜ កំណែបន្ទាប់ឈប់ទាញ', !(await legacy.has()));
        await legacy.close();

        console.log('\n── ៤. Deploy ថ្មីខណៈ SW ចាស់គ្រប់គ្រង ៖ chunk ឈ្មោះចាស់លែងមាន ➜ Netlify ឆ្លើយ index.html (200 · text/html) ──');
        // ⛔ ថ្នាក់ ៖ ទ្វារ miss របស់ SW ដាក់ចម្លើយបណ្តាញចូល cache ក្រោម key របស់ asset ➜ HTML (SPA fallback) ក្លាយជា «chunk»
        //    ➜ import() បរាជ័យ (MIME) រហូតដល់ SW ថ្មី · ហាង Firebase ដែលប្តូរ Config ទៅ Supabase ចំពេល deploy ជាប់ «Supabase មិនទាន់រួចរាល់»
        const swap = await device('Deploy ថ្មី');
        swap.state.gone = new Set([chunkPath]);
        const htmlLoad = await swap.load();
        const indexSize = fs.statSync(path.join(DIR, 'index.html')).size;
        ok('ការវាស់ពិត ៖ server ឆ្លើយ index.html ជំនួស chunk ដែលលែងមាន (200 · ទំហំ index.html)', htmlLoad.status === 200 && htmlLoad.size === indexSize, htmlLoad);
        ok('⛔ SW មិនដាក់ HTML ចូល cache ក្រោម key របស់ chunk', !(await swap.has()));
        swap.state.gone = null;
        const realLoad = await swap.load();
        ok('ក្រោយ chunk មានវិញ ➜ ទទួល chunk ពិត (មិនមែន HTML ពី cache)', realLoad.status === 200 && realLoad.size === chunkSize, realLoad);
        ok('ទិសផ្ទុយ ៖ chunk ពិតចូល cache ធម្មតា', await swap.has());
        await swap.close();
    } finally {
        await browser.close();
    }
}
