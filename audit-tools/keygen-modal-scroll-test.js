const fs = require('fs');
const path = require('path');
const http = require('http');
let chromium;
try { chromium = require('playwright-core').chromium; } catch (error) {
    console.log('SKIP — ត្រូវការ playwright-core');
    process.exit(0);
}
const CHROME = process.env.KEYGEN_MODAL_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
if (!fs.existsSync(CHROME)) { console.log('SKIP — រកមិនឃើញ Chromium'); process.exit(0); }
const ROOT = path.resolve(process.env.KEYGEN_MODAL_APP_DIR || path.join(__dirname, '..'));
const APP = path.join(ROOT, 'ZoeKeyGen');
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
let pass = 0, fail = 0;
function check(label, condition, detail) {
    if (condition) { pass++; console.log('  ok    ' + label); }
    else { fail++; console.log('  FAIL  ' + label + (detail === undefined ? '' : ' ' + JSON.stringify(detail))); }
}
function serve() {
    return new Promise((resolve, reject) => {
        const server = http.createServer((req, res) => {
            const pathname = new URL(req.url, 'http://localhost').pathname;
            const file = path.join(APP, pathname === '/' ? 'index.html' : pathname);
            if (!file.startsWith(APP + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
            res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
            res.end(fs.readFileSync(file));
        });
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => resolve(server));
    });
}
async function settled(page) {
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function position(page) {
    return page.evaluate(() => ({ scroll: window.scrollY, left: document.getElementById('appContainer').getBoundingClientRect().left, top: document.getElementById('appContainer').getBoundingClientRect().top }));
}
async function backdropWheel(page) {
    await page.mouse.move(4, 4);
    await page.mouse.wheel(0, 180);
    await page.waitForTimeout(100);
}
async function backdropTouch(page) {
    const client = await page.context().newCDPSession(page);
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 4, y: 250 }] });
    for (let y = 230; y >= 90; y -= 20) {
        await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 4, y }] });
    }
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(150);
    await client.detach();
}
async function scenario(browser, origin, size, reducedMotion) {
    const label = size.name + ' · ' + reducedMotion;
    const context = await browser.newContext({ viewport: { width: size.w, height: size.h }, isMobile: size.touch, hasTouch: size.touch, reducedMotion, serviceWorkers: 'block' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(() => window.addEventListener('unhandledrejection', (event) => { throw event.reason; }));
    await page.route('**/*', (route) => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
    try {
        await page.goto(origin, { waitUntil: 'domcontentloaded', timeout: 15000 });
        const readiness = await page.evaluate(() => ({ open: typeof window.openModalHelper === 'function', close: typeof window.closeModal === 'function', count: document.querySelectorAll('.modal').length }));
        check(label + '៖ ប្រអប់ពិត និង helper មានគ្រប់', readiness.open && readiness.close && readiness.count >= 6, readiness);
        await page.evaluate(() => {
            if (typeof window.openModalHelper !== 'function') window.openModalHelper = () => {};
            if (typeof window.closeModal !== 'function') window.closeModal = () => {};
            document.querySelectorAll('.modal.active').forEach((modal) => window.closeModal(modal.id));
            document.getElementById('appContainer')?.classList.remove('hidden');
            document.getElementById('bootSplash')?.remove();
        });
        const ids = await page.locator('.modal').evaluateAll((modals) => modals.map((modal) => modal.id));
        await page.evaluate(() => window.scrollTo(0, 100));
        await settled(page);
        const baseline = await position(page);
        check(label + '៖ ទំព័រពិតអាចរំកិលបានមុនបើកប្រអប់', baseline.scroll >= 90, baseline);
        for (const id of ids) {
            await page.evaluate(() => window.scrollTo(0, 100));
            await settled(page);
            const before = await position(page);
            await page.evaluate((name) => window.openModalHelper(name), id);
            await settled(page);
            const visible = await page.locator('#' + id).evaluate((modal) => ({ active: modal.classList.contains('active'), width: modal.getBoundingClientRect().width, height: modal.getBoundingClientRect().height }));
            check(label + ' · ' + id + '៖ ប្រអប់បើកពិត', visible.active && visible.width > 100 && visible.height > 100, visible);
            const opened = await position(page);
            check(label + ' · ' + id + '៖ បើកមិនធ្វើឱ្យផ្ទៃក្រោយលោត', Math.abs(opened.top - before.top) < 1 && Math.abs(opened.left - before.left) < 1, { before, opened });
            await backdropWheel(page);
            const wheeled = await position(page);
            check(label + ' · ' + id + '៖ wheel លើ backdrop មិនរំកិលផ្ទៃក្រោយ', Math.abs(wheeled.top - opened.top) < 1, { opened, wheeled });
            if (size.touch) {
                await backdropTouch(page);
                const touched = await position(page);
                check(label + ' · ' + id + '៖ touch លើ backdrop មិនរំកិលផ្ទៃក្រោយ', Math.abs(touched.top - opened.top) < 1, { opened, touched });
            }
            await page.evaluate((name) => window.closeModal(name), id);
            await settled(page);
            const closed = await position(page);
            check(label + ' · ' + id + '៖ បិទត្រឡប់ទីតាំងដើម', Math.abs(closed.scroll - before.scroll) < 1 && Math.abs(closed.top - before.top) < 1, { before, closed });
        }
        await page.evaluate(() => { window.scrollTo(0, 100); window.openModalHelper('configModal'); window.openModalHelper('pinModal'); window.closeModal('pinModal'); });
        await settled(page);
        const stackBefore = await position(page);
        await backdropWheel(page);
        const stackAfter = await position(page);
        check(label + '៖ បិទប្រអប់ខាងលើ នៅរក្សាការចាក់សោរំកិល', Math.abs(stackBefore.top - stackAfter.top) < 1, { stackBefore, stackAfter });
        await page.evaluate(() => window.closeModal('configModal'));
        await settled(page);
        const unlocked = await position(page);
        await backdropWheel(page);
        const moved = await position(page);
        check(label + '៖ បិទប្រអប់ចុងក្រោយ ទំព័ររំកិលបានវិញ', moved.scroll > unlocked.scroll + 10, { unlocked, moved });
        await page.evaluate(() => window.scrollTo(0, 100));
        await settled(page);
        const resizeBefore = await position(page);
        await page.setViewportSize({ width: size.w, height: size.h - 60 });
        await settled(page);
        const resizeAfter = await position(page);
        check(label + '៖ ប្ដូរកម្ពស់ផ្ទៃមើលគ្មានប្រអប់ មិនទាញទៅកំពូល', Math.abs(resizeBefore.scroll - resizeAfter.scroll) < 1, { resizeBefore, resizeAfter });
        await page.setViewportSize({ width: size.w, height: size.h });
        await settled(page);
        await page.evaluate(() => { window.scrollTo(0, 100); window.openModalHelper('keypairModal'); document.querySelector('#keypairModal .modal-content').style.maxHeight = '140px'; });
        await settled(page);
        const card = page.locator('#keypairModal .modal-content');
        const innerBefore = await card.evaluate((el) => ({ scroll: el.scrollTop, max: el.scrollHeight - el.clientHeight }));
        check(label + '៖ ខ្លឹមសារប្រអប់មានផ្លូវរំកិល', innerBefore.max > 100, innerBefore);
        const box = await card.boundingBox();
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.wheel(0, 120);
        await page.waitForTimeout(100);
        const innerAfter = await card.evaluate((el) => el.scrollTop);
        check(label + '៖ ចាក់សោផ្ទៃក្រោយមិនបិទការរំកិលក្នុងប្រអប់', innerAfter > innerBefore.scroll + 10, { innerBefore, innerAfter });
        await card.evaluate((el) => { el.scrollTop = el.scrollHeight; });
        await settled(page);
        const edgeBefore = await position(page);
        await page.mouse.wheel(0, 200);
        await page.waitForTimeout(100);
        const edgeAfter = await position(page);
        check(label + '៖ ដល់បាតប្រអប់មិនបន្តរំកិលផ្ទៃក្រោយ', Math.abs(edgeBefore.top - edgeAfter.top) < 1, { edgeBefore, edgeAfter });
        await page.setViewportSize({ width: size.w, height: size.h - 60 });
        await settled(page);
        const modalResize = await card.evaluate((el) => { const r = el.getBoundingClientRect(); return { active: el.parentElement.classList.contains('active'), top: r.top, bottom: r.bottom, height: innerHeight }; });
        check(label + '៖ ប្ដូរកម្ពស់ខណៈប្រអប់បើក ខ្លឹមសារនៅមើលឃើញ', modalResize.active && modalResize.top >= 0 && modalResize.bottom <= modalResize.height, modalResize);
        await page.evaluate(() => document.querySelectorAll('.modal.active').forEach((modal) => window.closeModal(modal.id)));
        for (const id of ids) {
            const ends = await page.evaluate((name) => {
                window.openModalHelper(name);
                const layer = document.getElementById(name);
                const items = [...layer.querySelectorAll('input, textarea, select, button, a[href], [tabindex]')].filter((el) => !el.disabled && el.tabIndex >= 0 && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden');
                items.forEach((el, index) => el.setAttribute('data-focus-probe', name + '-' + index));
                items.at(-1)?.focus({ preventScroll: true });
                return { first: items[0]?.getAttribute('data-focus-probe'), last: items.at(-1)?.getAttribute('data-focus-probe'), count: items.length };
            }, id);
            check(label + ' · ' + id + '៖ មានប៊ូតុង/វាលដែល focus បាន', ends.count > 1, ends);
            await page.keyboard.press('Tab');
            let focused = await page.evaluate(() => document.activeElement?.getAttribute('data-focus-probe'));
            check(label + ' · ' + id + '៖ Tab ចុងក្រោយត្រឡប់ទៅវាលដំបូង', focused === ends.first, { focused, ends });
            await page.keyboard.press('Shift+Tab');
            focused = await page.evaluate(() => document.activeElement?.getAttribute('data-focus-probe'));
            check(label + ' · ' + id + '៖ Shift+Tab ត្រឡប់ទៅចុងក្រោយ', focused === ends.last, { focused, ends });
            await page.evaluate(() => document.getElementById('navAuthBtn')?.focus({ preventScroll: true }));
            focused = await page.evaluate(() => document.activeElement?.closest('.modal')?.id);
            check(label + ' · ' + id + '៖ focus មិនទៅប៊ូតុងនៅពីក្រោយ', focused === id, focused);
            await page.evaluate((name) => window.closeModal(name), id);
        }
        await page.evaluate(() => { window.openModalHelper('configModal'); window.openModalHelper('pinModal'); document.querySelector('#configModal button')?.focus({ preventScroll: true }); });
        let focusedLayer = await page.evaluate(() => document.activeElement?.closest('.modal')?.id);
        check(label + '៖ ប្រអប់ជាន់លើទទួល focus ពីប្រអប់ខាងក្រោម', focusedLayer === 'pinModal', focusedLayer);
        await page.evaluate(() => { window.closeModal('pinModal'); document.getElementById('navAuthBtn')?.focus({ preventScroll: true }); });
        focusedLayer = await page.evaluate(() => document.activeElement?.closest('.modal')?.id);
        check(label + '៖ បិទប្រអប់ខាងលើ ➜ focus នៅក្នុងប្រអប់ដែលនៅសល់', focusedLayer === 'configModal', focusedLayer);
        await page.evaluate(() => document.querySelectorAll('#configModal input, #configModal textarea, #configModal select, #configModal button').forEach((el) => { el.disabled = true; }));
        await page.keyboard.press('Tab');
        focusedLayer = await page.evaluate(() => document.activeElement?.id);
        check(label + '៖ ប្រអប់ដែលវាលទាំងអស់ជាប់ មិនបញ្ជូន Tab ទៅផ្ទៃក្រោយ', focusedLayer === 'configModal', focusedLayer);
        await page.evaluate(() => window.closeModal('configModal'));
        await page.evaluate(() => document.getElementById('navAuthBtn')?.focus({ preventScroll: true }));
        const outsideFocus = await page.evaluate(() => document.activeElement?.id === 'navAuthBtn');
        check(label + '៖ គ្មានប្រអប់ ➜ ប៊ូតុងទំព័រទទួល focus បានធម្មតា', outsideFocus);
        check(label + '៖ គ្មាន runtime error', errors.length === 0, errors);
    } catch (error) {
        check(label + '៖ រត់សេណារីយ៉ូបានចប់', false, error.stack);
    } finally { await context.close(); }
}
(async () => {
    let browser, server;
    try {
        server = await serve();
        browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
        const origin = 'http://127.0.0.1:' + server.address().port;
        const sizes = [{ name: 'ទូរស័ព្ទតូច', w: 320, h: 568, touch: true }, { name: 'ទូរស័ព្ទ', w: 390, h: 844, touch: true }, { name: 'ថេប្លេត', w: 768, h: 1024, touch: true }, { name: 'កុំព្យូទ័រ', w: 1440, h: 900, touch: false }];
        for (const size of sizes) for (const motion of ['no-preference', 'reduce']) await scenario(browser, origin, size, motion);
    } catch (error) { check('បើកបរិស្ថានវាស់', false, error.stack); }
    finally {
        if (browser) await browser.close();
        if (server) await new Promise((resolve) => server.close(resolve));
    }
    console.log('\n' + (fail ? '❌ ' : '✅ ') + pass + '/' + (pass + fail));
    process.exitCode = fail ? 1 : 0;
})();
