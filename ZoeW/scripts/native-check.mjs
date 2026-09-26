/**
 * សាក App Android (Capacitor) **ក្នុង Chromium** ជាមួយ bridge native ក្លែង ៖
 * គ្មាន Android SDK/emulator នៅទីនេះ ➜ តេស្តនេះចាក់ `window.Capacitor` +
 * `window.androidBridge` ដូច `native-bridge.js` ពិតរបស់ Capacitor (ទម្រង់
 * `PluginHeaders` · `nativePromise` · `nativeCallback`) ➜ `@capacitor/core` និង
 * plugin ពិតដើរផ្លូវ native ដដែល ហើយតេស្តអាន **ការហៅ native** ដែល App ផ្ញើ។
 *
 * ⛔ អ្វីដែលវាវាស់ ៖ ផ្លូវ JS ទាំងអស់ដល់ព្រំដែន bridge (ការហៅ · អាគុយម៉ង់ ·
 *    ការឆ្លើយតបនៃ App)។ ⛔ អ្វីដែលវា **មិនវាស់** ៖ កូដ Java របស់ plugin ·
 *    WebView ពិតរបស់ Android · Keystore ➜ ត្រូវសាកលើទូរស័ព្ទពិត (`docs/ANDROID.md`)។
 *
 *   node scripts/native-check.mjs
 */
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveDir } from './serve.mjs';
import { FAKE_SDK, HARNESS_CLOCK_START, LICENSE_STUB, seedData } from './fake-firebase.mjs';
import { FAKE_BRIDGE, RESPOND_DEFAULT } from './fake-capacitor.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, '.native-check-dist');
const CONFIG = JSON.stringify({ apiKey: 'k', databaseURL: 'https://fake-default-rtdb.firebaseio.com', projectId: 'p' });
const PIN = '2468';
const PIN_HASH = createHash('sha256').update(PIN).digest('hex');
const NATIVE_RECORD = JSON.stringify({ mode: 'native', credentialId: 'zoew.biometric.pin.v1', wrapped: { iv: '', data: '' } });

execFileSync(process.execPath, [path.join(ROOT, 'node_modules/vite/bin/vite.js'), 'build', '--mode', 'android', '--outDir', OUT, '--logLevel', 'error'], { cwd: ROOT, stdio: 'inherit' });

const fails = [];
let passes = 0;
const ok = (label, cond, got) => {
    if (cond) { passes++; console.log('   ✅ ' + label); }
    else { fails.push(label); console.log('   ❌ ' + label + (got !== undefined ? '  ➜ ' + JSON.stringify(got) : '')); }
};

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const srv = await serveDir(OUT);
const seed = seedData();

async function session({ native = true, storage = {}, session: sess = {}, respond = RESPOND_DEFAULT, safeAreaTop = 0, data = seed } = {}) {
    const ctx = await browser.newContext({ viewport: { width: 414, height: 896 }, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    const errors = [];
    const requests = [];
    page.on('pageerror', (e) => errors.push(String(e.message)));
    page.on('request', (r) => requests.push(r.url()));
    await page.route('**', (r) => {
        const u = r.request().url();
        if (u.includes('/license-verify.js')) return r.fulfill({ status: 200, contentType: 'application/javascript', body: LICENSE_STUB });
        return u.includes('127.0.0.1') ? r.continue() : r.abort();
    });
    await page.addInitScript(`window.addEventListener('unhandledrejection', (e) => { (window.__rejections ||= []).push(String((e.reason && e.reason.message) || e.reason)); });`);
    if (native) {
        await page.addInitScript('(' + FAKE_BRIDGE.toString() + ')();');
        await page.addInitScript('(' + respond.toString() + ')();');
    }
    const store = Object.assign({ zoew_firebase_config: CONFIG, zoe_active_locker: 'A5' }, storage);
    await page.addInitScript(`(() => { const s = ${JSON.stringify(store)}; for (const k in s) window.localStorage.setItem(k, s[k]);
        const t = ${JSON.stringify(sess)}; for (const k in t) window.sessionStorage.setItem(k, t[k]); })();`);
    await page.addInitScript('(' + FAKE_SDK.toString() + ')(' + JSON.stringify(data) + ');');
    await page.clock.install({ time: HARNESS_CLOCK_START });
    /* ⛔ WebView ពេញអេក្រង់ ៖ `env(safe-area-inset-top)` ពិតតាម CDP (មិនមែន CSS ក្លែង) ➜ navbar ·
       ធាតុវាស់ ទទួល padding ដូចលើទូរស័ព្ទ។ session CDP ត្រូវរស់ពេញសេណារីយ៉ូ (ការ override ជារបស់វា)។ */
    if (safeAreaTop) {
        const cdp = await ctx.newCDPSession(page);
        await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: safeAreaTop } });
    }
    await page.goto(`http://127.0.0.1:${srv.port}/index.html`, { waitUntil: 'load' });
    await page.waitForTimeout(2500);
    return { ctx, page, errors, requests };
}

async function scenario(title, fn) {
    console.log('\n' + title);
    try {
        await fn();
    } catch (e) {
        ok(`${title} ៖ សេណារីយ៉ូរត់ចប់ (គ្មានការគាំង)`, false, String(e && e.message || e).split('\n')[0]);
    }
}

const calls = (page, plugin, method) => page.evaluate(([p, m]) => (window.__nativeCalls || []).filter((c) => c.plugin === p && (!m || c.method === m)), [plugin, method]);
const fire = (page, plugin, event, data) => page.evaluate(([p, e, d]) => window.__fireNative(p, e, d), [plugin, event, data || {}]);

async function pull(page, distance, fromY) {
    const point = await page.evaluate((fromY) => {
        const pages = document.getElementById('appPages');
        const r = pages.getBoundingClientRect();
        const y0 = typeof fromY === 'number' ? fromY : r.top + 40;
        for (let y = y0; y < y0 + 220; y += 12) {
            for (let x = 40; x < r.right - 40; x += 30) {
                const el = document.elementFromPoint(x, y);
                if (el && pages.contains(el) && !el.closest('input, textarea, select, button, a, .app-navbar, .page-tabbar')) return { x, y };
            }
        }
        return null;
    }, fromY);
    if (!point) return false;
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: point.x, y: point.y }] });
    for (let d = 6; d <= distance; d += 6) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: point.x, y: point.y + d }] });
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
    return true;
}

/**
 * ⛔ គំរូនៃច្បាប់ latch របស់ Chromium (WebView របស់ Android) ៖ `touchmove`
 *    ដំបូងដែល **មិនត្រូវ preventDefault** ចាប់ផ្តើមការរមូរ (overscroll នៅកំពូល)
 *    ➜ `touchmove` បន្ទាប់ទាំងអស់ `cancelable: false`។ touch ក្លែងរបស់ CDP ក្នុង
 *    Chromium desktop មិនអនុវត្តច្បាប់នេះនៅកំពូលទេ (វាស់រួច ៖ mutation «ដកការ
 *    ចាប់មុន slop» រស់រាន `pull()`) ➜ សេណារីយ៉ូនេះបញ្ជូន TouchEvent ដោយផ្ទាល់
 *    តាមច្បាប់នោះ។ move ដំបូងឈរត្រឹម 12px (ក្រោយ slop របស់ Chromium)។
 */
async function pullWithChromiumLatch(page, distance) {
    return page.evaluate((distance) => {
        const pages = document.getElementById('appPages');
        const r = pages.getBoundingClientRect();
        let point = null;
        for (let y = r.top + 40; y < r.top + 260 && !point; y += 12) {
            for (let x = 40; x < r.right - 40; x += 30) {
                const el = document.elementFromPoint(x, y);
                if (el && pages.contains(el) && !el.closest('input, textarea, select, button, a, .app-navbar, .page-tabbar')) { point = { x, y, el }; break; }
            }
        }
        if (!point) return { found: false };
        const make = (type, y, cancelable) => {
            const t = new Touch({ identifier: 7, target: point.el, clientX: point.x, clientY: y, pageX: point.x, pageY: y });
            const live = type === 'touchend' ? [] : [t];
            return new TouchEvent(type, { bubbles: true, cancelable, composed: true, touches: live, targetTouches: live, changedTouches: [t] });
        };
        point.el.dispatchEvent(make('touchstart', point.y, true));
        let latched = false;
        let latchedAt = null;
        for (let d = 12; d <= distance; d += 6) {
            const ev = make('touchmove', point.y + d, !latched);
            point.el.dispatchEvent(ev);
            if (!latched && !ev.defaultPrevented) { latched = true; latchedAt = d; }
        }
        point.el.dispatchEvent(make('touchend', point.y + distance, !latched));
        return { found: true, latchedAt };
    }, distance);
}

async function closeSession(s, label) {
    const rejections = await s.page.evaluate(() => window.__rejections || []).catch(() => []);
    ok(`${label} ៖ គ្មានកំហុស runtime`, s.errors.length === 0 && rejections.length === 0, [...s.errors, ...rejections]);
    await s.ctx.close();
}

/* ── ១. boot លើ native ─────────────────────────────────────────────── */
await scenario('១. boot លើ Android native', async () => {
    const s = await session();
    const { page } = s;
    const info = await page.evaluate(async () => ({
        nativeClass: document.documentElement.classList.contains('native-android'),
        ptr: !!document.querySelector('.ptr-indicator'),
        swRegs: navigator.serviceWorker ? (await navigator.serviceWorker.getRegistrations()).length : -1,
        overscroll: getComputedStyle(document.body).overscrollBehaviorY,
        bioUnsupported: (document.getElementById('biometricToggleBtn') || { classList: { contains: () => null } }).classList.contains('is-unsupported'),
        rows: document.querySelectorAll('#historyTableBody tr').length
    }));
    ok('html.native-android (boot-flags មុន stylesheet)', info.nativeClass);
    ok('overscroll របស់ WebView បិទ (native.css)', info.overscroll === 'none', info.overscroll);
    ok('សញ្ញា PTR មានលើ native', info.ptr);
    ok('Service Worker មិនចុះឈ្មោះលើ native', info.swRegs === 0, info.swRegs);
    ok('ទិន្នន័យគូរ (Firebase ក្លែង)', info.rows > 0, info.rows);
    ok('chunk native ត្រូវផ្ទុក', s.requests.some((u) => /native-plugins-.*\.js/.test(u)));
    const app = await calls(page, 'App', 'addListener');
    const events = app.map((c) => c.options.eventName).sort();
    ok('App ៖ ចុះឈ្មោះ backButton · pause · resume', ['backButton', 'pause', 'resume'].every((e) => events.includes(e)), events);
    const bars = await calls(page, 'SystemBars', 'setStyle');
    ok('SystemBars ៖ របាខាងក្រោម LIGHT', bars.some((c) => c.options.bar === 'NavigationBar' && c.options.style === 'LIGHT'), bars);
    ok('SystemBars ៖ របាខាងលើ មិនពេញអេក្រង់ (inset 0) ➜ LIGHT', bars.some((c) => c.options.bar === 'StatusBar' && c.options.style === 'LIGHT'), bars);
    ok('ជីវមាត្រ native ៖ isAvailable ➜ កុងតាក់មិន «មិនគាំទ្រ»', info.bioUnsupported === false && (await calls(page, 'NativeBiometric', 'isAvailable')).length > 0);

    /* ប៊ូតុង Back — ⛔ ម៉ឺនុយ (...) សាកមុនការប្តូរទំព័រ ៖ ក្នុង harness ក្រោយ
       ការប្តូរទំព័រ ការចុច (...) មិនបើកម៉ឺនុយ **ទាំង ZoeW ដើម ទាំង React** (វាស់រួច)
       ➜ វាជាលំដាប់របស់តេស្ត មិនមែនឥរិយាបថ native។ */
    await page.click('.header-more-btn');
    await page.waitForTimeout(150);
    ok('(Back) ម៉ឺនុយ (...) បើក', await page.evaluate(() => document.getElementById('globalMoreMenu').classList.contains('show')));
    await fire(page, 'App', 'backButton', { canGoBack: false });
    await page.waitForTimeout(150);
    ok('(Back) ➜ ម៉ឺនុយ (...) បិទ', !(await page.evaluate(() => document.getElementById('globalMoreMenu').classList.contains('show'))));
    await page.click('#navMenuBtn');
    await page.waitForTimeout(200);
    ok('(Back) របា Slide បើក', await page.evaluate(() => document.getElementById('sideDrawer').classList.contains('open')));
    await fire(page, 'App', 'backButton', { canGoBack: false });
    await page.waitForTimeout(150);
    ok('(Back) ➜ របា Slide បិទ', !(await page.evaluate(() => document.getElementById('sideDrawer').classList.contains('open'))));
    await page.click('#pageTabEntry');
    await page.waitForTimeout(150);
    await fire(page, 'App', 'backButton', { canGoBack: false });
    await page.waitForTimeout(150);
    ok('(Back) ទំព័រស្កេន ➜ ទំព័រទិន្នន័យ', await page.evaluate(() => document.getElementById('pageData').classList.contains('active')));
    ok('(Back) មិនទាន់បង្រួម App ដរាបណាមានអ្វីត្រូវបិទ', (await calls(page, 'App', 'minimizeApp')).length === 0);
    await fire(page, 'App', 'backButton', { canGoBack: false });
    await page.waitForTimeout(150);
    ok('(Back) ទំព័រទិន្នន័យ គ្មានស្រទាប់ ➜ បង្រួម App', (await calls(page, 'App', 'minimizeApp')).length === 1);
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(2500);

    /* Export Excel ➜ Filesystem + Share */
    await page.click('#btnFilterAll');
    await page.click('.header-more-btn');
    await page.click('[data-act="moreMenuExport"]');
    await page.waitForTimeout(200);
    await page.click('#exportDataModal button:has-text("Excel")');
    await page.waitForTimeout(2500);
    const writes = await calls(page, 'Filesystem', 'writeFile');
    const xlsx = writes.find((c) => /^exports\/.*\.xlsx$/.test(c.options.path));
    ok('Export Excel ៖ សរសេរចូល cache (exports/*.xlsx)', !!xlsx, writes.map((c) => c.options.path));
    ok('Export Excel ៖ ទិន្នន័យ base64 មិនទទេ · directory CACHE', !!xlsx && xlsx.options.data.length > 1000 && xlsx.options.directory === 'CACHE', xlsx && [xlsx.options.data.length, xlsx.options.directory]);
    ok('Export Excel ៖ ឯកសារជា ZIP ពិត (xlsx)', !!xlsx && Buffer.from(xlsx.options.data, 'base64').subarray(0, 2).toString() === 'PK');
    const shares = await calls(page, 'Share', 'share');
    ok('Export Excel ៖ បើកផ្ទាំង Share ជាមួយឯកសារ', shares.length === 1 && Array.isArray(shares[0].options.files) && shares[0].options.files[0].startsWith('file://'), shares);

    /* Export CSV */
    await page.click('.header-more-btn');
    await page.click('[data-act="moreMenuExport"]');
    await page.waitForTimeout(200);
    await page.click('#exportDataModal button:has-text("Google Sheet")');
    await page.waitForTimeout(800);
    const csv = (await calls(page, 'Filesystem', 'writeFile')).find((c) => /\.csv$/.test(c.options.path));
    const csvText = csv ? Buffer.from(csv.options.data, 'base64').toString('utf8') : '';
    ok('Export CSV ៖ សរសេរ .csv (UTF-8 អក្សរខ្មែររក្សាដដែល)', !!csv && /[ក-៿]/.test(csvText), csvText.slice(0, 80));

    /* Export PDF ➜ Printer + afterprint ពេល resume */
    const titleBefore = await page.title();
    await page.click('.header-more-btn');
    await page.click('[data-act="moreMenuExport"]');
    await page.waitForTimeout(200);
    await page.click('#exportDataModal button:has-text("PDF")');
    await page.waitForTimeout(800);
    const prints = await calls(page, 'Printer', 'printWebView');
    ok('Export PDF ៖ ហៅ PrintManager (printWebView)', prints.length === 1, prints);
    ok('Export PDF ៖ ចំណងជើងឯកសារ = ឈ្មោះ Export ខណៈបោះពុម្ព', (await page.title()) !== titleBefore, await page.title());
    const locked0 = await page.evaluate(() => document.body.classList.contains('app-locked'));
    await fire(page, 'App', 'resume');
    await page.waitForTimeout(300);
    ok('Export PDF ៖ ត្រឡប់ពីផ្ទាំងបោះពុម្ព ➜ afterprint ➜ ចំណងជើងវិញ', (await page.title()) === titleBefore, await page.title());
    ok('Export PDF ៖ គ្មានសោ App ក្លែង (គ្មាន PIN)', locked0 === false);

    /* PTR ៖ តំបន់កេះ · ស្រទាប់បើក · ញ័រ (សំណើម្ចាស់គម្រោង) */
    const noReload = () => page.waitForEvent('framenavigated', { timeout: 3000 }).then(() => false, () => true);
    await page.evaluate(() => { document.getElementById('appPages').scrollTop = 0; });
    // ⛔ ចំណុចចាប់ផ្តើមត្រូវជាកន្លែងដែល PTR **នឹងកេះពិត** បើគ្មានច្បាប់តំបន់ ៖ តារាងប្រវត្តិ
    //    (នៅកំពូល) ក្រោមតំបន់ ៤០% — មិនមែនប្រអប់ស្វែងរក (ដែល PTR មិនចាប់ទោះយ៉ាងណា)
    const zone = await page.evaluate(() => {
        const tr = document.getElementById('tableResponsive').getBoundingClientRect();
        const bottom = Math.round(window.innerHeight * 0.4);
        return { h: window.innerHeight, bottom, fromY: Math.max(bottom + 20, Math.round(tr.top) + 12) };
    });
    let stayed = noReload();
    ok('PTR ៖ ចាប់ផ្តើមលើតារាងក្រោមតំបន់ខាងលើ (' + zone.fromY + 'px / ' + zone.h + ') ➜ រកចំណុចទាញបាន', await pull(page, 300, zone.fromY));
    ok('PTR ៖ ចាប់ផ្តើមក្រោមតំបន់ខាងលើ ➜ មិនផ្ទុកឡើងវិញ', await stayed);
    ok('PTR ៖ ចាប់ផ្តើមក្រោមតំបន់ខាងលើ ➜ មិនញ័រ', (await calls(page, 'Haptics', 'impact')).length === 0);
    // ⛔ ស្រទាប់បើកដោយ **ការចុចពិត** (build ផលិតកម្មគ្មាន `window.*`)
    await page.click('.header-more-btn');
    await page.click('[data-act="moreMenuExchangeRate"]');
    ok('PTR ៖ ប្រអប់បើកពិត (លក្ខខណ្ឌចាំបាច់)', await page.evaluate(() => document.getElementById('exchangeRateModal').style.display === 'flex'));
    stayed = noReload();
    await pull(page, 300);
    ok('PTR ៖ ប្រអប់បើក ➜ មិនផ្ទុកឡើងវិញ', await stayed);
    await page.keyboard.press('Escape');
    await page.click('.header-more-btn');
    ok('PTR ៖ ម៉ឺនុយ (...) បើកពិត (លក្ខខណ្ឌចាំបាច់)', await page.evaluate(() => document.getElementById('globalMoreMenu').classList.contains('show')));
    stayed = noReload();
    await pull(page, 300);
    ok('PTR ៖ ការប៉ះដែលបិទម៉ឺនុយ (...) ➜ មិនផ្ទុកឡើងវិញ', await stayed);
    ok('PTR ៖ ការប៉ះនោះបិទម៉ឺនុយពិត', await page.evaluate(() => !document.getElementById('globalMoreMenu').classList.contains('show')));
    ok('PTR ៖ ស្រទាប់បើក ➜ មិនញ័រ', (await calls(page, 'Haptics', 'impact')).length === 0);

    /* PTR លើ native ➜ reload */
    await page.evaluate(() => { document.getElementById('appPages').scrollTop = 0; });
    // ⛔ សញ្ញា PTR គូរដោយ React ពី `ptrState` ➜ វាស់ថាវា **ផ្លាស់ទីពិត** និង **ចុះ DOM ក្នុងការ dispatch
    //    ដដែល** ៖ touch ដែល script បញ្ជូន **គ្មាន microtask checkpoint** រវាង listener ➜ ការអាន
    //    `style.transform` ភ្លាមក្រោយ `dispatchEvent()` ឃើញតម្លៃចាស់ បើ React គូរពន្យារ (វាស់រួច ៖
    //    touch របស់ CDP រត់ microtask រវាង listener ➜ mutation «ដក `renderNow`» រស់រាន)។
    //    ចប់ដោយ `touchcancel` ➜ មិនផ្ទុកឡើងវិញ។
    const ptrSync = await page.evaluate(async () => {
        const pages = document.getElementById('appPages');
        const ind = document.querySelector('.ptr-indicator');
        const r = pages.getBoundingClientRect();
        let point = null;
        for (let y = r.top + 40; y < r.top + 260 && !point; y += 12) {
            for (let x = 40; x < r.right - 40; x += 30) {
                const el = document.elementFromPoint(x, y);
                if (el && pages.contains(el) && !el.closest('input, textarea, select, button, a, .app-navbar, .page-tabbar')) { point = { x, y, el }; break; }
            }
        }
        if (!point || !ind) return { found: false };
        const make = (type, y) => {
            const t = new Touch({ identifier: 9, target: point.el, clientX: point.x, clientY: y, pageX: point.x, pageY: y });
            const live = type === 'touchmove' || type === 'touchstart' ? [t] : [];
            return new TouchEvent(type, { bubbles: true, cancelable: true, composed: true, touches: live, targetTouches: live, changedTouches: [t] });
        };
        const frames = [];
        let deferred = 0;
        let ready = false;
        point.el.dispatchEvent(make('touchstart', point.y));
        for (let d = 6; d <= 300; d += 6) {
            point.el.dispatchEvent(make('touchmove', point.y + d));
            const now = ind.style.transform;
            frames.push(now);
            if (/\bready\b/.test(ind.className)) ready = true;
            await new Promise((res) => setTimeout(res, 0));
            if (ind.style.transform !== now) deferred++;
        }
        point.el.dispatchEvent(make('touchcancel', point.y + 300));
        return { found: true, distinct: new Set(frames.filter(Boolean)).size, deferred, ready,
            parkedClass: ind.className, parkedOpacity: ind.style.opacity };
    });
    ok('PTR ៖ សញ្ញា (React · `ptrState`) ផ្លាស់ទីតាមម្រាមដៃ (transform ≥ 10 ស៊ុមខុសគ្នា)', ptrSync.found && ptrSync.distinct >= 10, ptrSync);
    ok('PTR ៖ សញ្ញាចុះ DOM **ក្នុងការ dispatch ដដែល** នៃ `touchmove` (គ្មានការគូរពន្យារ)', ptrSync.found && ptrSync.deferred === 0, ptrSync);
    ok('PTR ៖ ឆ្លងព្រំដែន ➜ class `ready` (ភ្លាម)', ptrSync.ready === true, ptrSync);
    ok('PTR ៖ `touchcancel` ➜ ត្រឡប់ទីតាំងដើម (`snapping` · opacity 0) ភ្លាម', /\bsnapping\b/.test(ptrSync.parkedClass || '') && ptrSync.parkedOpacity === '0', ptrSync);
    const ticksBefore = (await calls(page, 'Haptics', 'impact').catch(() => [])).length;
    await page.evaluate(() => {
        const ind = document.querySelector('.ptr-indicator');
        const log = window.__ptrLog = { classes: [] };
        new MutationObserver(() => { log.classes.push(ind.className); }).observe(ind, { attributes: true, attributeFilter: ['class'] });
    });
    const reloaded = page.waitForEvent('framenavigated', { timeout: 6000 }).then(() => true, () => false);
    const pulled = await pull(page, 300);
    ok('PTR ៖ រកចំណុចទាញបាន', pulled);
    const ptrEnd = await page.evaluate(() => {
        const ind = document.querySelector('.ptr-indicator');
        return { finalClass: ind.className, finalOpacity: ind.style.opacity, finalTransform: ind.style.transform };
    }).catch((e) => ({ error: String(e) }));
    ok('PTR ៖ លែងដៃ ➜ `spinning` · opacity 1 · ឈរនៅ translateY(50px)', /\bspinning\b/.test(ptrEnd.finalClass || '') &&
        ptrEnd.finalOpacity === '1' && ptrEnd.finalTransform === 'translateY(50px)', ptrEnd);
    const ticks = (await calls(page, 'Haptics', 'impact').catch(() => [])).slice(ticksBefore);
    ok('PTR ៖ ឆ្លងព្រំដែន ➜ ញ័រ **ម្តង** (Haptics.impact · LIGHT)', ticks.length === 1 && ticks[0].options.style === 'LIGHT', ticks);
    ok('PTR លើ native ៖ ទាញចុះ ➜ ផ្ទុកឡើងវិញ', await reloaded);
    await page.waitForTimeout(2500);
    ok('PTR ៖ ក្រោយផ្ទុកឡើងវិញ App ចាប់ផ្តើមម្តងទៀត', await page.evaluate(() => document.querySelectorAll('#historyTableBody tr').length > 0));
    await closeSession(s, 'native boot');
});

/* ── ២. ជីវមាត្រ native ៖ ដោះសោ ───────────────────────────────────────── */
await scenario('២. ជីវមាត្រ native ៖ ដោះសោ App', async () => {
    const respond = function () {
        window.__nativeRespond = (plugin, method) => {
            if (plugin === 'NativeBiometric' && method === 'isAvailable') return { isAvailable: true };
            if (plugin === 'NativeBiometric' && method === 'getSecureCredentials') return { username: 'zoew', password: '2468' };
            return undefined;
        };
    };
    const s = await session({ storage: { zoew_security_pin_hash: PIN_HASH, zoew_biometric_unlock_v1: NATIVE_RECORD }, respond });
    const got = await calls(s.page, 'NativeBiometric', 'getSecureCredentials');
    ok('សោពេលបើក ➜ ហៅ BiometricPrompt (server ត្រឹមត្រូវ · ចំណងជើងខ្មែរ)', got.length === 1 && got[0].options.server === 'zoew.biometric.pin.v1' && /ក្រយៅដៃ/.test(got[0].options.reason), got);
    ok('PIN ពី Keystore ត្រឹមត្រូវ ➜ សោដោះ', await s.page.evaluate(() => !document.body.classList.contains('app-locked')));
    await closeSession(s, 'ជីវមាត្រ ok');
});

/* ── ៣. ជីវមាត្រ native ៖ ក្រយៅដៃត្រូវប្តូរ ─────────────────────────────── */
await scenario('៣. ជីវមាត្រ native ៖ ក្រយៅដៃក្នុងទូរស័ព្ទត្រូវប្តូរ', async () => {
    const respond = function () {
        window.__nativeRespond = (plugin, method) => {
            if (plugin === 'NativeBiometric' && method === 'isAvailable') return { isAvailable: true };
            if (plugin === 'NativeBiometric' && method === 'getSecureCredentials') return { __reject: true, code: '0', message: 'Biometric crypto object unavailable' };
            return undefined;
        };
    };
    const s = await session({ storage: { zoew_security_pin_hash: PIN_HASH, zoew_biometric_unlock_v1: NATIVE_RECORD }, respond });
    const state = await s.page.evaluate(() => ({
        locked: document.body.classList.contains('app-locked'),
        record: window.localStorage.getItem('zoew_biometric_unlock_v1'),
        toast: Array.from(document.querySelectorAll('.toast')).map((t) => t.textContent).join(' | ')
    }));
    ok('App នៅជាប់សោ (មិនដោះដោយគ្មាន PIN)', state.locked);
    ok('ការចងចាស់ត្រូវលុប', state.record === null, state.record);
    ok('ប្រាប់អ្នកប្រើថាត្រូវបើកវាឡើងវិញ', /ត្រូវបានប្តូរ/.test(state.toast), state.toast);
    ok('លុប credential ក្នុង Keystore ដែរ', (await calls(s.page, 'NativeBiometric', 'deleteCredentials')).length >= 1);
    await closeSession(s, 'ជីវមាត្រ invalidated');
});

/* ── ៤. pause/resume ➜ សោ App ───────────────────────────────────────── */
await scenario('៤. សោ App ពេលចាកចេញ (pause) និងត្រឡប់មក (resume)', async () => {
    const s = await session({ storage: { zoew_security_pin_hash: PIN_HASH }, session: { zoew_app_unlocked: '1' } });
    const { page } = s;
    ok('ចាប់ផ្តើមដោយមិនជាប់សោ (វគ្គដោះរួច)', await page.evaluate(() => !document.body.classList.contains('app-locked')));
    await fire(page, 'App', 'pause');
    await page.waitForTimeout(100);
    ok('pause ➜ គ្រប (task switcher មិនឃើញទិន្នន័យ)', await page.evaluate(() => document.body.classList.contains('app-locked')));
    await fire(page, 'App', 'resume');
    await page.waitForTimeout(150);
    ok('resume ➜ សោពិត (អេក្រង់ PIN បើក)', await page.evaluate(() => document.getElementById('appLockScreen').classList.contains('is-open')));
    await fire(page, 'App', 'backButton', { canGoBack: false });
    await page.waitForTimeout(150);
    ok('(Back) ពេលជាប់សោ ➜ បង្រួម App', (await calls(page, 'App', 'minimizeApp')).length === 1);
    await closeSession(s, 'pause/resume');
});

/* ── ៤ឃ. របាស្ថានភាពលើ WebView ពេញអេក្រង់ ─────────────────────────── */
/*
 * ⛔ របាស្ថានភាពជាស្រទាប់ថ្លាលើទំព័រ ➜ ពណ៌រូបតំណាងត្រូវផ្ទុយពន្លឺនឹង **ផ្ទៃពិត** នៅក្រោមវា។
 *    ការសន្មត «inset > 0 ➜ navbar ក្រហម ➜ DARK» ធ្វើឲ្យរូបតំណាង **ស លើ navbar ស** (មើលមិនឃើញ ៖
 *    របាយការណ៍អ្នកប្រើលើទូរស័ព្ទពិត)។ សេណារីយ៉ូនេះបើក safe-area ពិតតាម CDP រួចវាស់ **ការហៅ
 *    plugin** ក្រោយការប្តូរ state (ប្រអប់បើក/បិទ) — ⛔ មិនមែនការហៅ function ដោយផ្ទាល់។
 */
await scenario('៤ឃ. ពណ៌រូបតំណាងរបាស្ថានភាព (WebView ពេញអេក្រង់ · safe-area 24px)', async () => {
    const s = await session({ safeAreaTop: 24 });
    const { page } = s;
    const lastStatus = async () => {
        const c = (await calls(page, 'SystemBars', 'setStyle')).filter((x) => x.options.bar === 'StatusBar');
        return c.length ? c[c.length - 1].options.style : null;
    };
    const nav = await page.evaluate(() => {
        const cs = getComputedStyle(document.querySelector('.app-navbar'));
        const top = document.elementsFromPoint(200, 12)[0];
        return { padTop: parseFloat(cs.paddingTop), bg: cs.backgroundColor, topIsNavbar: !!(top && top.closest('.app-navbar')) };
    });
    ok('(លក្ខខណ្ឌចាំបាច់) safe-area ពិត ៖ navbar ទទួល padding ពី env() ហើយឈរក្រោមរបា', nav.padTop >= 24 + 8 && nav.topIsNavbar, nav);
    ok('navbar ស ក្រោមរបា ➜ រូបតំណាងខ្មៅ (LIGHT)', (await lastStatus()) === 'LIGHT', { style: await lastStatus(), bg: nav.bg });
    await page.click('.daily-stats-btn');
    await page.waitForTimeout(700);
    ok('(លក្ខខណ្ឌចាំបាច់) ប្រអប់បើក', await page.evaluate(() => getComputedStyle(document.getElementById('dailyStatsModal')).display !== 'none'));
    ok('ប្រអប់បើក (ផ្ទៃងងឹតថ្លាៗ) ➜ រូបតំណាងស (DARK)', (await lastStatus()) === 'DARK', await lastStatus());
    await fire(page, 'App', 'backButton', { canGoBack: false });
    await page.waitForTimeout(700);
    ok('(លក្ខខណ្ឌចាំបាច់) Back ➜ ប្រអប់បិទ', await page.evaluate(() => getComputedStyle(document.getElementById('dailyStatsModal')).display === 'none'));
    ok('បិទប្រអប់ ➜ រូបតំណាងខ្មៅវិញ (LIGHT)', (await lastStatus()) === 'LIGHT', await lastStatus());
    await closeSession(s, 'របាស្ថានភាព');
});

/* ── ៤ង. ការប្តូររបាស្ថានភាព ↔ ចលនាប្រអប់ ─────────────────────────── */
/*
 * ⛔ `SystemBars.setStyle` ប្តូរពណ៌រូបតំណាង **និងគូរផ្ទៃបង្អួចឡើងវិញ** លើ thread របស់ Android ➜ WebView (ដែលគូរតាម
 *    thread នោះ) គាំងមួយភ្លែត។ វាស់បានលើទូរស័ព្ទពិត (វីដេអូអ្នកប្រើ ៩០fps) ៖ ប្រអប់ធុងសំរាម (៣៥៤ ធាតុ ➜ គូរលើកដំបូងយឺត ➜
 *    ចលនាចាប់ផ្តើមយឺត) ➜ ការវាស់ពណ៌ ៣២០ms ក្រោយការប្តូរ state ធ្លាក់ **កណ្តាលចលនា** ➜ គាំង ៧ ស៊ុម ➜ ផ្ទៃខាងក្រោយលោត ➜
 *    រូបតំណាងប្តូរពណ៌ ៖ «កន្ត្រាក់» (PWA គ្មានការហៅនេះ ➜ រលូន)។ ប្រអប់តូចៗគូរលឿន ➜ ចលនាចប់មុន ➜ ការគាំងលើរូបស្ងៀម។
 *    សេណារីយ៉ូនេះធ្វើត្រាប់ «ចលនានៅរត់ពេលការវាស់មកដល់» ដោយពន្យារចលនាប្រអប់ ហើយអះអាងថា setStyle មិនកើតក្នុងចលនា
 *    តែកើតក្រោយវាចប់ (ពណ៌នៅត្រឹមត្រូវ)។
 */
for (const [dur, css, why] of [
    [800, '.modal-content { animation-duration: 800ms !important; }', 'ផ្ទៃងងឹតពេញរួច តែប្រអប់នៅរំកិល (វីដេអូ)'],
    [1500, '.modal, .modal-content { animation-duration: 1500ms !important; }', 'ផ្ទៃមិនទាន់ងងឹតនៅ ៣២០ms']
]) {
    await scenario(`៤ង. ពណ៌របាស្ថានភាពប្តូរក្រោយចលនាប្រអប់ ${dur}ms — ${why}`, async () => {
        const s = await session({ safeAreaTop: 24 });
        const { page } = s;
        await page.addStyleTag({ content: css });
        const res = await page.evaluate(() => new Promise((resolve) => {
            const statusCalls = () => (window.__nativeCalls || []).filter((c) => c.plugin === 'SystemBars' && c.method === 'setStyle' && c.options && c.options.bar === 'StatusBar');
            const running = () => document.getAnimations().filter((a) => {
                const t = a.effect && a.effect.getComputedTiming ? a.effect.getComputedTiming() : null;
                const target = a.effect && a.effect.target;
                return a.playState === 'running' && t && Number.isFinite(t.endTime) && !!(target && target.closest && target.closest('.modal'));
            }).length;
            const c0 = statusCalls().length;
            document.querySelector('.daily-stats-btn').click();
            const t0 = performance.now();
            let seen = c0;
            let sawAnimation = false;
            const duringAnimation = [];
            const after = [];
            (function tick() {
                const n = statusCalls().length;
                const anim = running();
                if (anim) sawAnimation = true;
                if (n > seen) {
                    const style = statusCalls()[n - 1].options.style;
                    (anim ? duringAnimation : after).push({ t: Math.round(performance.now() - t0), style });
                    seen = n;
                }
                if (performance.now() - t0 < 3200) requestAnimationFrame(tick);
                else resolve({ sawAnimation, duringAnimation, after, last: (statusCalls().slice(-1)[0] || {}).options });
            })();
        }));
        ok(`${dur}ms ៖ (លក្ខខណ្ឌចាំបាច់) ចលនាប្រអប់រត់ពិតពេលការវាស់មកដល់`, res.sawAnimation, res);
        ok(`${dur}ms ៖ ⛔ setStyle មិនកើតក្នុងពេលចលនាប្រអប់កំពុងរត់ (WebView មិនគាំងកណ្តាលចលនា · រាប់តែចលនាក្នុង .modal)`, res.duringAnimation.length === 0, res.duringAnimation);
        ok(`${dur}ms ៖ ក្រោយចលនាចប់ ➜ រូបតំណាងស (DARK) ត្រូវអនុវត្ត (មិនជាប់ខ្មៅលើផ្ទៃងងឹត)`, res.after.some((c) => c.style === 'DARK') && !!res.last && res.last.style === 'DARK', res);
        await closeSession(s, `របាស្ថានភាព ↔ ចលនា ${dur}ms`);
    });
}

/* ── ៤ច. ការវាស់ពេលបើកធុងសំរាម (build វាស់ · APK តែមួយ) ─────────────────── */
/*
 * ⛔ វីដេអូ APK 2.42.8 និង 2.42.9 ៖ ការគាំង ៥៥–៦៧ms កណ្តាលចលនាបើកធុងសំរាម នៅដដែល ទោះពន្យារ setStyle ហើយទោះលែងពង្រីក
 *    លើសទំហំ ➜ សម្មតិកម្មទាំង ២ ខុស។ build នេះវាស់លើទូរស័ព្ទពិត ៖ ការបើកលើកសេស បង្ហាញតែ ៣០ ជួរ · លើកគូ ពេញ · រាល់ការបើកចេញសារ
 *    🔬 (ចលនា · ស៊ុមឃ្លាតធំបំផុត · thread មេរវល់ធំបំផុត · longtask)។ សេណារីយ៉ូនេះបញ្ជាក់ថាការវាស់ដំណើរការ មុនអ្នកប្រើចំណាយពេល build ៖
 *    APK ៖ លើកទី ១ = ៣០ ជួរ · លើកទី ២ = ពេញ · សារ 🔬 រាយចំនួនជួរពិត និងពេលចលនា ➜ web ៖ ពេញ ហើយគ្មានសារ 🔬 (ទិសផ្ទុយ)។
 */
const trashSeed = JSON.parse(JSON.stringify(seed));
for (let i = 0; i < 60; i++) {
    const d = trashSeed.zoew_recently_deleted_cod_dod.d1;
    trashSeed.zoew_recently_deleted_cod_dod['p' + i] = Object.assign({}, d, { id: 'p' + i, phone: '09' + String(1000000 + i),
        barcodes: d.barcodes.map((b) => Object.assign({}, b, { code: 'PR' + i })) });
}
async function openTrashAndRead(page) {
    await page.evaluate(() => document.querySelector('.header-more-btn').click());
    await page.waitForTimeout(300);
    await page.evaluate(() => document.querySelector('[data-act="moreMenuRecentlyDeleted"]').click());
    await page.waitForTimeout(1600);
    const out = await page.evaluate(() => ({
        rows: document.querySelectorAll('#recentlyDeletedModal .trash-group-row').length,
        probe: Array.from(document.querySelectorAll('.toast')).map((t) => t.textContent).filter((t) => t.includes('🔬')).join(' | ')
    }));
    await page.evaluate(() => document.querySelector('#recentlyDeletedModal .btn-cancel').click());
    await page.waitForTimeout(3600);
    return out;
}
await scenario('៤ច. ការវាស់ពេលបើកធុងសំរាម (APK ៖ ៣០ ជួរ / ពេញ ឆ្លាស់គ្នា · សារ 🔬)', async () => {
    const w = await session({ native: false, data: trashSeed });
    const web = await openTrashAndRead(w.page);
    await closeSession(w, 'ការវាស់ធុងសំរាម web');
    const full = web.rows;
    ok('(លក្ខខណ្ឌចាំបាច់) web ៖ ធុងសំរាមពេញមានច្រើនជាង ៣០ ជួរ', full > 30, web);
    ok('web ៖ គ្មានសារ 🔬 (ការវាស់ជារបស់ APK តែមួយ)', !web.probe, web);
    const s = await session({ data: trashSeed });
    const first = await openTrashAndRead(s.page);
    const second = await openTrashAndRead(s.page);
    ok('APK លើកទី ១ ៖ បង្ហាញតែ ៣០ ជួរ', first.rows === 30, first);
    ok('APK លើកទី ២ ៖ បង្ហាញពេញដូច web', second.rows === full, { second, full });
    ok('សារ 🔬 រាយចំនួនជួរពិត', first.probe.includes('ជួរ 30 ') && second.probe.includes('ជួរ ' + full + ' '), { first: first.probe, second: second.probe });
    ok('សារ 🔬 វាស់ចលនាប្រអប់ពិត', /ចលនា \d+–\d+ms/.test(first.probe), first.probe);
    ok('សារ 🔬 រាយស៊ុម · thread មេ · longtask', /ស៊ុមឃ្លាតធំបំផុត \d+ms@\d+/.test(first.probe) && /thread មេរវល់ធំបំផុត \d+ms@\d+/.test(first.probe) && /longtask /.test(first.probe), first.probe);
    await closeSession(s, 'ការវាស់ធុងសំរាម APK');
});

/* ── ៥. web (គ្មាន bridge) ───────────────────────────────────────────── */
await scenario('៤គ. ប្រវត្តិថយក្រោយ (Back ម្តងមួយជំហាន)', async () => {
    const s = await session();
    const { page } = s;
    const screen = () => page.evaluate(() => ({
        page: document.getElementById('pageEntry').classList.contains('active') ? 'entry' : 'data',
        mode: ['parcel', 'locker', 'remove'].find((m) => {
            const id = { parcel: 'modeParcelBtn', locker: 'modeLockerBtn', remove: 'modeRemoveBtn' }[m];
            const el = document.getElementById(id);
            return el && el.classList.contains('active');
        })
    }));
    const back = async () => { await fire(page, 'App', 'backButton', { canGoBack: false }); await page.waitForTimeout(200); return screen(); };
    await page.click('#pageTabEntry'); await page.waitForTimeout(150);
    await page.click('#modeLockerBtn'); await page.waitForTimeout(150);
    await page.click('#modeRemoveBtn'); await page.waitForTimeout(150);
    await page.click('#pageTabData'); await page.waitForTimeout(150);
    let now = await back();
    ok('Back ១ ៖ ទិន្នន័យ ➜ ស្កេន (⛔ របៀប «ដក» ត្រឡប់ជា «កញ្ចប់»)', now.page === 'entry' && now.mode === 'parcel', now);
    now = await back();
    ok('Back ២ ៖ ➜ ស្កេន/Locker', now.page === 'entry' && now.mode === 'locker', now);
    now = await back();
    ok('Back ៣ ៖ ➜ ស្កេន/កញ្ចប់', now.page === 'entry' && now.mode === 'parcel', now);
    now = await back();
    ok('Back ៤ ៖ ➜ ទំព័រទិន្នន័យ', now.page === 'data', now);
    ok('មិនទាន់បង្រួម App ដរាបណាប្រវត្តិនៅសល់', (await calls(page, 'App', 'minimizeApp')).length === 0);
    await back();
    ok('Back ៥ ៖ ប្រវត្តិអស់ ➜ បង្រួម App', (await calls(page, 'App', 'minimizeApp')).length === 1);
    await closeSession(s, 'ប្រវត្តិថយក្រោយ');
});

await scenario('៤ខ. PTR លើ WebView របស់ Android (ច្បាប់ latch របស់ Chromium)', async () => {
    const s = await session();
    const { page } = s;
    await page.evaluate(() => { document.getElementById('appPages').scrollTop = 0; });
    const reloaded = page.waitForEvent('framenavigated', { timeout: 6000 }).then(() => true, () => false);
    const res = await pullWithChromiumLatch(page, 300);
    ok('រកចំណុចទាញបាន', res.found);
    ok('App ចាប់ gesture មុន Chromium ចាប់ផ្តើមរមូរ (គ្មាន latch)', res.latchedAt === null, res.latchedAt);
    ok('ទាញចុះ ➜ ផ្ទុកឡើងវិញ', await reloaded);
    await closeSession(s, 'PTR latch');
});

await scenario('៥. web ធម្មតា (គ្មាន bridge) ៖ មិនប៉ះ', async () => {
    const s = await session({ native: false });
    const { page } = s;
    const info = await page.evaluate(() => ({
        nativeClass: document.documentElement.classList.contains('native-android'),
        ptr: !!document.querySelector('.ptr-indicator'),
        overscroll: getComputedStyle(document.body).overscrollBehaviorY
    }));
    ok('គ្មាន class native-android', !info.nativeClass);
    ok('គ្មានសញ្ញា PTR (Chrome មាន PTR ផ្ទាល់)', !info.ptr);
    ok('overscroll ដូច ZoeW ដើម (auto)', info.overscroll === 'auto', info.overscroll);
    ok('chunk native មិនត្រូវផ្ទុកលើ web', !s.requests.some((u) => /native-plugins-.*\.js/.test(u)));
    await page.evaluate(() => { document.getElementById('appPages').scrollTop = 0; });
    const reloaded = page.waitForEvent('framenavigated', { timeout: 1500 }).then(() => true, () => false);
    await pull(page, 300);
    ok('PTR របស់ App មិនដើរលើ web', !(await reloaded));
    await closeSession(s, 'web');
});

await browser.close();
srv.server.close();
fs.rmSync(OUT, { recursive: true, force: true });
console.log(`\n${fails.length ? '❌' : '✅'} native-check — ${passes} ok, ${fails.length} FAIL`);
process.exitCode = fails.length ? 1 : 0;
