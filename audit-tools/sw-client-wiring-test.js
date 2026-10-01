// ថ្នាក់៖ **ខ្សែភ្ជាប់រវាង Service Worker និងទំព័រ ដែលគ្មាននរណារត់**។
//
// ចុងទាំង ២ មានតេស្តរៀងៗខ្លួន ៖ SW ផ្ញើសារ (`ZoeW/tests/push-client.test.tsx` ៖ `client.postMessage`) ·
// អ្នកដោះសារ (`handleServiceWorkerMessage()`) · ផ្ទាំងកំណែថ្មី (`showUpdateAvailableBanner()`)។ តែ **listener**
// ដែលភ្ជាប់វាក្នុង `registerServiceWorker()` (`src/app/lifecycle/boot.ts`) គ្មានអ្នកណារត់ទេ ៖ mutation ដែលដក
// `navigator.serviceWorker` ➜ `'message'` ចេញ **រស់រានលើ checker ទាំងអស់** (វាស់បាន 2.45.4 ៖ N28)។ ផលពិត ៖
//   - ចុចការជូនដំណឹងពេល App កំពុងបើក ➜ SW ផ្ញើ `zoew-open-notify` ទៅ tab ដែលមានស្រាប់ ➜ ផ្ទាំង 🔔 មិនបើក
//   - push មកដល់ពេល App បើក ➜ `zoew-push` ➜ បញ្ជីដំណឹងមិនស្រស់
//   - `controllerchange` (deploy ថ្មីចាប់យកទំព័រ) ➜ ផ្ទាំង «មានកំណែថ្មី» មិនលេច ➜ អ្នកប្រើនៅកំណែចាស់
//   - `visibilitychange` · `focus` · `online` ➜ `reg.update()` មិនរត់ ➜ កំណែថ្មីមកយឺតរហូតដល់ ៣០ នាទី
//
// ⛔ ការវាស់ត្រូវរត់ **App ពិត · SW ពិត · browser ពិត** ៖ សារត្រូវផ្ញើពី **បរិបទ SW** (`clients.matchAll()` ➜
//    `postMessage`) មិនមែន `dispatchEvent` ក្នុងទំព័រ (នោះរំលងផ្លូវ browser ពិត)។ ប្រភេទសារដេរីវេពី `sw.js` ពិត ➜
//    ប្រភេទថ្មីដែល SW ផ្ញើ តែគ្មានការអះអាងក្នុងឯកសារនេះ ➜ ធ្លាក់ (ទិសទាំង ២)។
// ⛔ ទិសផ្ទុយ ៖ សារប្រភេទមិនស្គាល់មិនបើកផ្ទាំង · controllerchange លើការដំឡើងដំបូង (គ្មាន controller ពេលផ្ទុក)
//    មិនបង្ហាញផ្ទាំងកំណែថ្មី · ពិដាន ១៥ នាទីរបស់ `throttledSwUpdate()` នៅដដែល (ព្រឹត្តិការណ៍មុនពិដាន ➜ គ្មានការហៅ)។
process.exitCode = 1;
const fs = require('fs');
const http = require('http');
const path = require('path');

const ROOT = process.env.SWWIRE_APP_DIR || path.join(__dirname, '..');
const DIR = path.join(ROOT, 'ZoeW');
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json',
    '.png': 'image/png', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.webmanifest': 'application/manifest+json' };
const HANDLED = ['zoew-open-notify', 'zoew-push'];

let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { pass++; console.log('  ok    ' + label); }
    else { fail++; console.log('  FAIL  ' + label + (detail !== undefined ? '\n        ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : '')); }
}
function finish() {
    console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')' : '✅ ជោគជ័យ ' + pass));
    process.exitCode = fail ? 1 : 0;
}

// === ផ្នែកទី ១ — ស្តាទិច ៖ ប្រភេទសារដែល SW ពិតផ្ញើ ===
const swPath = path.join(DIR, 'sw.js');
const swSrc = fs.existsSync(swPath) ? fs.readFileSync(swPath, 'utf8') : '';
const posted = Array.from(new Set((swSrc.match(/postMessage\(\s*\{\s*type:\s*['"][^'"]+['"]/g) || [])
    .map((m) => /['"]([^'"]+)['"]/.exec(m)[1]))).sort();
const cvMatch = /zoew-v\d+/.exec(swSrc);
ok('រក sw.js ពិត និង CACHE_VERSION ឃើញ', !!swSrc && !!cvMatch);
ok('ប្រភេទសារដែល SW ផ្ញើ ស្មើបញ្ជីដែលឯកសារនេះវាស់ (ប្រភេទថ្មី ➜ បន្ថែមការអះអាងឥរិយាបថ)',
    JSON.stringify(posted) === JSON.stringify(HANDLED.slice().sort()), posted);

let chromium;
try { chromium = require('playwright-core').chromium; } catch (e) { chromium = null; }
const CHROME = process.env.SWWIRE_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
if (!chromium || !fs.existsSync(CHROME) || !fs.existsSync(path.join(DIR, 'index.html'))) {
    ok('ផ្នែក browser ៖ មាន playwright-core · Chromium · index.html', false, { chromium: !!chromium, chrome: fs.existsSync(CHROME) });
    finish();
    return;
}

(async () => {
    const state = { swTag: 'a', swHits: 0, feedHits: 0 };
    const server = await new Promise((res) => {
        const s = http.createServer((req, rsp) => {
            let p = decodeURIComponent(req.url.split('?')[0]);
            if (p === '/') p = '/index.html';
            if (p === '/sw.js' && cvMatch) {
                state.swHits++;
                rsp.writeHead(200, { 'Content-Type': 'application/javascript', 'Cache-Control': 'no-cache' });
                return rsp.end(swSrc.split(cvMatch[0]).join(cvMatch[0] + '-' + state.swTag));
            }
            if (p === '/announcements.json') state.feedHits++;
            let f = path.join(DIR, p);
            if (!f.startsWith(DIR) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIR, 'index.html');
            rsp.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'text/plain', 'Cache-Control': 'no-cache' });
            rsp.end(fs.readFileSync(f));
        });
        s.listen(0, '127.0.0.1', () => res(s));
    });
    const origin = 'http://127.0.0.1:' + server.address().port;
    const browser = await chromium.launch({ executablePath: CHROME, args: ['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'] });
    const ctx = await browser.newContext({ viewport: { width: 412, height: 780 } });
    // នាឡិកាក្នុងទំព័រដែលរំកិលបាន ➜ ឆ្លងពិដាន ១៥ នាទីរបស់ `throttledSwUpdate()` ដោយមិនរង់ចាំពិត
    await ctx.addInitScript(() => {
        const realNow = Date.now.bind(Date);
        let skew = 0;
        Date.now = () => realNow() + skew;
        window.__zoeSkew = (ms) => { skew += ms; };
    });
    // ⛔ `pageerror` ចាប់តែការបោះ synchronous ➜ promise ដែលបដិសេធគ្មានអ្នកចាប់ ត្រូវបម្លែងជាការបោះ (មុន `goto`)
    await ctx.addInitScript(`window.addEventListener('unhandledrejection', function (ev) {
            var m; try { m = String((ev.reason && (ev.reason.message || ev.reason)) || 'unknown'); } catch (x) { m = 'unknown'; }
            setTimeout(function () { throw new Error('unhandledrejection: ' + m); }, 0);
        });`);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e && e.message)));

    const waitFor = async (fn, arg, ms) => {
        const t0 = Date.now();
        while (Date.now() - t0 < ms) {
            if (await page.evaluate(fn, arg).catch(() => false)) return true;
            await new Promise((r) => setTimeout(r, 100));
        }
        return false;
    };
    const until = async (fn, ms) => {
        const t0 = Date.now();
        while (Date.now() - t0 < ms) {
            if (fn()) return true;
            await new Promise((r) => setTimeout(r, 100));
        }
        return fn();
    };
    const view = () => page.evaluate(() => ({
        drawerOpen: !!document.querySelector('#notifyDrawer.open'),
        banner: !!document.getElementById('zoeUpdateBanner'),
        controller: navigator.serviceWorker.controller ? navigator.serviceWorker.controller.scriptURL.split('/').pop() : null
    }));
    const swWorker = () => ctx.serviceWorkers().find((w) => w.url().startsWith(origin));
    const postFromSw = async (type) => {
        const w = swWorker();
        if (!w) return -1;
        return w.evaluate((t) => self.clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((list) => { list.forEach((c) => c.postMessage({ type: t })); return list.length; }), type).catch(() => -1);
    };
    const closeDrawer = async () => {
        await page.evaluate(() => { if (typeof window.closeSideDrawer === 'function') window.closeSideDrawer(); });
        return waitFor(() => !document.querySelector('#notifyDrawer.open'), null, 3000);
    };
    // ⛔ `notifyFeedInFlight` ទប់ការទាញថ្មីខណៈការទាញមុននៅហោះ ➜ រង់ចាំឲ្យការហៅទៅ server ស្ងប់ (១ វិ. គ្មានការហៅថ្មី)
    const settleFeed = async () => {
        const t0 = Date.now();
        let last = state.feedHits, stableAt = Date.now();
        while (Date.now() - t0 < 8000) {
            await new Promise((r) => setTimeout(r, 100));
            if (state.feedHits !== last) { last = state.feedHits; stableAt = Date.now(); }
            if (Date.now() - stableAt >= 1000) return true;
        }
        return false;
    };

    // === ផ្នែកទី ២ — ការដំឡើងដំបូង ៖ App ចុះឈ្មោះ SW ខ្លួនឯង · claim ➜ controllerchange តែ **គ្មាន** ផ្ទាំងកំណែថ្មី ===
    await page.goto(origin + '/', { waitUntil: 'load', timeout: 30000 });
    await require('./react-view').waitAuditBridge(page);
    const controlled = await waitFor(() => !!navigator.serviceWorker.controller, null, 25000);
    ok('លក្ខខណ្ឌចាំបាច់ ៖ App ចុះឈ្មោះ SW ខ្លួនឯង ហើយ SW ចាប់យកទំព័រ', controlled, await view());
    await new Promise((r) => setTimeout(r, 400));
    ok('ទិសផ្ទុយ ៖ ការដំឡើងដំបូង (គ្មាន controller ពេលផ្ទុក) ➜ មិនបង្ហាញ «មានកំណែថ្មី»', !(await view()).banner, await view());

    // ផ្ទុកឡើងវិញ ➜ ទំព័រមាន controller តាំងពីផ្ទុក (ស្ថានភាពធម្មតារបស់អ្នកប្រើ)
    await page.reload({ waitUntil: 'load', timeout: 30000 });
    await require('./react-view').waitAuditBridge(page);
    await waitFor(() => !!navigator.serviceWorker.controller, null, 15000);
    await waitFor(() => !!navigator.serviceWorker && !!window.__zoeSkew, null, 5000);
    await settleFeed();
    await new Promise((r) => setTimeout(r, 1500));

    // === ផ្នែកទី ៣ — សារពី SW ពិត ➜ listener ក្នុង boot.ts ===
    {
        ok('លក្ខខណ្ឌចាំបាច់ ៖ ផ្ទាំង 🔔 បិទបានតាម `closeSideDrawer()` ពិត', await closeDrawer(), await view());
        await settleFeed();
        const before = state.feedHits;
        const n = await postFromSw('zoew-unknown-probe');
        await new Promise((r) => setTimeout(r, 600));
        const v = await view();
        ok('លក្ខខណ្ឌចាំបាច់ ៖ SW ពិតឃើញ client ≥ ១', n >= 1, n);
        ok('ទិសផ្ទុយ ៖ សារប្រភេទមិនស្គាល់ ➜ មិនបើកផ្ទាំង 🔔 · មិនទាញដំណឹង', !v.drawerOpen && state.feedHits === before,
            Object.assign({ feedHits: state.feedHits - before }, v));
    }
    {
        await closeDrawer();
        await settleFeed();
        await postFromSw('zoew-open-notify');
        const opened = await waitFor(() => !!document.querySelector('#notifyDrawer.open'), null, 5000);
        ok('⛔ SW ផ្ញើ `zoew-open-notify` (ចុចការជូនដំណឹងពេល App បើក) ➜ ផ្ទាំង 🔔 បើក', opened, await view());
    }
    {
        await closeDrawer();
        await settleFeed();
        await new Promise((r) => setTimeout(r, 300));
        const before = state.feedHits;
        await postFromSw('zoew-push');
        const fetched = await until(() => state.feedHits > before, 6000);
        const v = await view();
        ok('⛔ SW ផ្ញើ `zoew-push` (push មកដល់ពេល App បើក) ➜ ទាញបញ្ជីដំណឹងពី server (មិនបើកផ្ទាំង)', fetched && !v.drawerOpen,
            Object.assign({ feedHits: state.feedHits - before }, v));
    }

    // === ផ្នែកទី ៤ — ព្រឹត្តិការណ៍ដែលពិនិត្យកំណែថ្មី ➜ `reg.update()` (ពិដាន ១៥ នាទី) ===
    // ⛔ job ពិនិត្យកំណែមុនដែលនៅដំណើរការ (CI រវល់ ៖ lane browser ៤) ➜ `reg.update()` ថ្មីត្រូវបញ្ចូលក្នុង job ដដែល (spec ៖ job ស្មើគ្នា
    //    ត្រូវរួម) ➜ គ្មានការទាញ `sw.js` ថ្មី ➜ ការអះអាងវិជ្ជមានក្រហមតាមល្បឿនម៉ាស៊ីន (វាស់បាន ៖ `focus` ធ្លាក់ក្នុង CI ពេញ · ឆ្លងពេលរត់ម្នាក់ឯង)។
    //    ការកែជា **រចនាសម្ព័ន្ធ** ៖ រង់ចាំ job មុនចប់ (`reg.update()` ផ្ទាល់ resolve ពេល job ចប់) **មុន** ថតចំនួន ➜ មិនមែនពង្រីកពិដានតែម្យ៉ាង
    const settleUpdates = () => page.evaluate(() => navigator.serviceWorker.getRegistration()
        .then((r) => (r ? r.update() : null)).then(() => true, () => false));
    const probeUpdate = async (fire, waitMs = 8000) => {
        const before = state.swHits;
        await page.evaluate(fire);
        await until(() => state.swHits > before, waitMs);
        return state.swHits - before;
    };
    const fireVisible = () => document.dispatchEvent(new Event('visibilitychange'));
    const fireFocus = () => window.dispatchEvent(new Event('focus'));
    const fireOnline = () => window.dispatchEvent(new Event('online'));
    await settleUpdates();
    ok('ទិសផ្ទុយ ៖ ព្រឹត្តិការណ៍មុនពិដាន ១៥ នាទី ➜ មិនហៅ `reg.update()`', (await probeUpdate(fireVisible, 3000)) === 0);
    await page.evaluate(() => window.__zoeSkew(16 * 60 * 1000));
    await settleUpdates();
    ok('⛔ `visibilitychange` (ត្រឡប់មក App) ក្រោយពិដាន ➜ ពិនិត្យកំណែថ្មី (`sw.js` ពី server)', (await probeUpdate(fireVisible)) >= 1);
    await page.evaluate(() => window.__zoeSkew(16 * 60 * 1000));
    await settleUpdates();
    ok('⛔ `focus` ក្រោយពិដាន ➜ ពិនិត្យកំណែថ្មី', (await probeUpdate(fireFocus)) >= 1);
    await settleUpdates();

    // === ផ្នែកទី ៥ — deploy ថ្មី ➜ SW ថ្មីចាប់យកទំព័រ ➜ `controllerchange` ➜ ផ្ទាំង «មានកំណែថ្មី» ===
    {
        ok('លក្ខខណ្ឌចាំបាច់ ៖ មុន deploy ថ្មី គ្មានផ្ទាំងកំណែថ្មី', !(await view()).banner);
        state.swTag = 'b';
        await page.evaluate(() => window.__zoeSkew(16 * 60 * 1000));
        const hits = await probeUpdate(fireOnline);
        ok('⛔ `online` ក្រោយពិដាន ➜ ពិនិត្យកំណែថ្មី', hits >= 1);
        const shown = await waitFor(() => !!document.getElementById('zoeUpdateBanner'), null, 25000);
        const ctl = await page.evaluate(() => navigator.serviceWorker.controller && navigator.serviceWorker.controller.scriptURL);
        ok('⛔ SW ថ្មីចាប់យកទំព័រ (`controllerchange`) ➜ ផ្ទាំង «មានកំណែថ្មី» លេច', shown, { ctl, view: await view() });
    }

    ok('គ្មាន pageerror', errors.length === 0, errors.slice(0, 3));
    await ctx.close();
    await browser.close();
    await new Promise((r) => {
        server.close(r);
        if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
    });
    finish();
})().catch((e) => { console.log('  FAIL  ' + (e && e.stack || e)); process.exitCode = 1; });
