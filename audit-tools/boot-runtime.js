let chromium;
try { chromium = require('playwright-core').chromium; } catch (e) {
    console.log('SKIP — ត្រូវការ playwright-core (npm i playwright-core)');
    process.exit(0);
}
const CHROME = process.env.BOOT_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
if (!require('fs').existsSync(CHROME)) {
    console.log('SKIP — រកមិនឃើញ Chromium នៅ ' + CHROME);
    process.exit(0);
}
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = process.env.BOOT_APP_DIR || '/home/user/Zoe-System';
const TYPES = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.json':'application/json' };

function serve(dir, port) {
    return new Promise((res) => {
        const s = http.createServer((req, rsp) => {
            let p = decodeURIComponent(req.url.split('?')[0]);
            if (p === '/') p = '/index.html';
            const f = path.join(dir, p);
            if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); return rsp.end(); }
            rsp.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'text/plain' });
            rsp.end(fs.readFileSync(f));
        });
        s.listen(port, () => res(s));
    });
}

(async () => {
    const browser = await chromium.launch({ executablePath: CHROME });
    let problems = 0;
    let port = 8410;
    for (const app of ['ZoeAdmin', 'ZoeW', 'Zoescan', 'ZoeKeyGen']) {
        const dir = path.join(ROOT, app);
        const server = await serve(dir, port);
        const ctx = await browser.newContext({ viewport: { width: 412, height: 780 } });
        const page = await ctx.newPage();
        const errors = [];
        page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
        page.on('console', (m) => { if (m.type() === 'error') errors.push('console.error: ' + m.text().slice(0, 200)); });
        // block outbound so gstatic/sentry can't hang the run; app must survive it
        await page.route('**', (route) => {
            const u = route.request().url();
            if (u.startsWith('http://127.0.0.1:' + port)) return route.continue();
            return route.abort();
        });
        try {
            await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'domcontentloaded', timeout: 20000 });
            await page.waitForTimeout(3500);
        } catch (e) { errors.push('goto: ' + e.message); }

        // what does the user actually see?
        const visible = await page.evaluate(() => {
            const openModals = [...document.querySelectorAll('.modal')]
                .filter((m) => getComputedStyle(m).display !== 'none')
                .map((m) => m.id);
            return { openModals, bodyText: (document.body.innerText || '').trim().slice(0, 120) };
        });

        const real = errors.filter((e) => !/net::ERR_FAILED|Failed to load resource|ERR_BLOCKED/i.test(e));
        console.log('\n=== ' + app + ' ===');
        console.log('   modal ដែលបើក: ' + JSON.stringify(visible.openModals));
        if (real.length) { real.forEach((e) => console.log('   FAIL  ' + e)); problems += real.length; }
        else console.log('   ok    គ្មានកំហុស runtime ពេល boot');

        const versionLabels = await page.evaluate(() =>
            [...document.querySelectorAll('[data-app-version]')].map((el) => el.textContent));
        const declaredVersion = (fs.readFileSync(path.join(dir, 'app.js'), 'utf8')
            .match(/const APP_VERSION = '([^']+)'/) || [])[1];
        const rendered = versionLabels.length === 1 && versionLabels[0] === 'កំណែប្រព័ន្ធ: ' + declaredVersion;
        if (rendered) console.log('   ok    កំណែបង្ហាញពិតក្នុងប្រអប់ login: ' + JSON.stringify(versionLabels));
        else { console.log('   FAIL  កំណែមិនបានបង្ហាញ: ' + JSON.stringify(versionLabels)); problems++; }

        await ctx.close();
        server.close();
        port++;
    }
    await browser.close();
    console.log('\n' + (problems ? 'FAIL ' + problems : 'PASS') + ' — boot runtime check');
    process.exit(problems ? 1 : 0);
})();
