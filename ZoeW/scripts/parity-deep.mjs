/**
 * parity **ជម្រៅ** ៖ ផ្លូវសរសេរលុយទាំងអស់ · ចាកចេញ/ចូលវិញ · ប្រអប់ដែល
 * `parity-live` មិនដែលបើក។
 *
 * ⛔ ហេតុអ្វីមានឧបករណ៍នេះ ៖ `parity-live` ប្រៀបធៀបអេក្រង់ និង `op + path`
 *    នៃការសរសេរ — វាមិនដែល **សរសេរលុយ** ទេ (គ្មានជំហានណាស្កេន · បិទ · ដក ·
 *    ស្តារ) ហើយមិនដែលប្រៀបធៀប **តម្លៃ** ដែលសរសេរ។ App ២ អាចសរសេរចំនួនលុយ
 *    ខុសគ្នាទៅ path ដដែល ហើយវានៅតែរាយ ✅។
 *
 * រាល់ជំហាន ប្រៀបធៀប **៤ ជាន់** ៖
 *   ១. អេក្រង់ទាំងមូល (DOM + តម្លៃ form control + toast)
 *   ២. ការសរសេរទៅ server ក្នុងជំហាននោះ (**តម្លៃពេញ**)
 *   ៣. ស្ថានភាព DB ទាំងមូលក្រោយជំហាន
 *   ៤. សារ `confirm()`/`alert()` ដែលលេច
 */
import { chromium } from 'playwright-core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveDir } from './serve.mjs';
import { FAKE_SDK, HARNESS_CLOCK_START, LICENSE_STUB, seedData } from './fake-firebase.mjs';
import { resolveOldRoot } from './old-app.mjs';
import { INTENTIONAL_UI, SNAPSHOT } from './snapshot.mjs';
import { SCROLL_PROBE, openMenuItem } from './menu-scroll.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OLD_DIR = resolveOldRoot(HERE);
// ZOEW_PARITY_DIST ៖ build ឯកជន (`npm run build:parity`) ➜ run-all មិនប្រណាំង `dist` ជាមួយ zoew-suite
const NEW_DIR = process.env.ZOEW_PARITY_DIST ? path.resolve(process.env.ZOEW_PARITY_DIST) : path.join(HERE, '..', 'dist');
const CONFIG = JSON.stringify({ apiKey: 'k', databaseURL: 'https://fake-default-rtdb.firebaseio.com', projectId: 'p' });
const seed = seedData();

/* ── ការធ្វើឲ្យស្ថានភាព server ប្រៀបធៀបបាន ────────────────────────────
 * App ២ រត់ក្នុង tab ដាច់ពីគ្នា ➜ ត្រា «ឥឡូវ» ខុសគ្នាប៉ុន្មាន ms ។
 * ⛔ ត្រាដែល **មកពីទិន្នន័យគំរូ** រក្សាតម្លៃពិត ៖ ការស្តារដែលភ្លេច reset
 *    `closedAt` នឹងទុកត្រាចាស់ ➜ ខុសពី «<t>» ➜ ក្រហម (មិនលាក់ទេ)។ */
const T_CUT = HARNESS_CLOCK_START - 60000;
const ID_RE = /\bid_(\d{12,14})_[a-z0-9]+\b/g;
/**
 * ⛔ id ដែលកើតក្នុងជំហានតែមួយមាន **ត្រាពេលដូចគ្នា** (នាឡិកាឈប់) ➜ លំដាប់របស់វា
 *    ធ្លាក់ទៅផ្នែកចៃដន្យ ដែលខុសគ្នារវាង App (ចំនួនការហៅ Math.random ខុសគ្នា)។
 *    ដូច្នេះលំដាប់ត្រូវសម្រេចតាម **មាតិកា** (barcode + លេខទូរស័ព្ទ) ដែល id នោះកាន់។
 */
function idSignatures(dump) {
    const sig = new Map();
    for (const node of ['zoew_scan_history_cod_dod', 'zoew_recently_deleted_cod_dod']) {
        const bucket = (dump && dump[node]) || {};
        for (const [id, item] of Object.entries(bucket)) {
            const codes = Array.isArray(item && item.barcodes) ? item.barcodes.map((b) => b && b.code).join(',') : String(item && item.barcode);
            sig.set(id, codes + '|' + (item && item.phone));
        }
    }
    return sig;
}

function normalize(value, sig = new Map()) {
    // ⛔ ledger ថ្ងៃ/ខែ ផ្ទុក token `op` (ZoeW 2.42.7 ៖ សម្គាល់ការសរសេររបស់ខ្លួនពេល `disconnect`) ➜ App ដើមគ្មានវា ➜ ប្រៀបដោយដកវាចេញ
    //    (តម្លៃលុយ/ចំនួនក្បែរវានៅប្រៀបដដែល · ការអះអាងរបស់ token ខ្លួនវា ៖ `tx-outcome-test` · `emu/tx-disconnect-emu-test`)
    let text = JSON.stringify(value, (k, v) => (k === 'op' && typeof v === 'string' && /^op_[a-z0-9]+$/.test(v) ? undefined
        : typeof v === 'number' && v >= T_CUT && v < T_CUT + 86400000 * 2 ? '<t>' : v));
    text = text.replace(/\b(1[3-9]|2[0-3]):\d\d:\d\d \(2026-09-22\)/g, '<time>');
    // ⛔ claim token (restore/clear) ជាតម្លៃចៃដន្យ **បណ្តោះអាសន្ន** ➜ ប្រៀបធៀបវត្តមាន មិនមែនតម្លៃ
    text = text.replace(/\b(restore|clear)_id_\d{12,14}_[a-z0-9]+_[a-z0-9]+\b/g, '$1_<token>');
    const ids = [...new Set([...text.matchAll(ID_RE)].map((m) => m[0]))]
        .sort((a, b) => Number(a.match(/id_(\d+)/)[1]) - Number(b.match(/id_(\d+)/)[1])
            || String(sig.get(a) || '').localeCompare(String(sig.get(b) || '')) || a.localeCompare(b));
    // ⛔ ផ្នែកចៃដន្យនៃ token មិនមែនស្ថានភាពអាជីវកម្ម ➜ ឈ្មោះដេរីវេពីលំដាប់
    ids.forEach((id, i) => { text = text.split(id).join(id.replace(/id_.*/, 'id') + '#' + (i + 1)); });
    const sortKeys = (x) => (Array.isArray(x) ? x.map(sortKeys) : x && typeof x === 'object'
        ? Object.keys(x).sort().reduce((o, k) => { o[k] = sortKeys(x[k]); return o; }, {}) : x);
    return JSON.stringify(sortKeys(JSON.parse(text)), null, 1);
}

/* ── ទិន្នន័យអតិថិជនដែលមិនត្រូវសល់ក្រោយចាកចេញ ──────────────────────── */
const CUSTOMER_MARKERS = ['012345678', '0977777777', '0888888', '011223344', '015999888', 'AA1', 'AA2', 'CC1', 'DD1', 'EE1', 'NEW1'];

/* ── បណ្តាញ ↔ នាឡិកាឈប់ ───────────────────────────────────────────────
 * ចម្លើយ ZTO/Apps Script (SW ➜ `ctx.route`/`page.route`) មកដល់តាម **ម៉ោងពិត** ខណៈនាឡិកា JS ឈប់ ➜
 * ការរង់ចាំម៉ោងពិតថេរ (~២១០ms ក្នុងមួយជំហាន) បាក់ពេល CI រវល់ ➜ App មួយឃើញ «✅ រកឃើញពី ZTO» ម្ខាងទៀត
 * «🔎 កំពុងស្វែងរក…» ➜ ជំហាន «ស្កេន ZL5» ធ្លាក់ «អេក្រង់» ដោយ App គ្មានកំហុស (វាស់បាន ៖ `DEEP_NET_DELAY_MS=800`
 * ធ្លាក់ ៧/១៣ ជំហាន ZTO មុនការកែ)។ ⛔ ការកែជា **រចនាសម្ព័ន្ធ** ៖ `advance()` រំកិលនាឡិកាជាដុំ `NET_STEP_MS`
 * ហើយរង់ចាំសំណើដែលកំពុងហោះ (`window.__netPending`) ស្ងប់ **មុន** ដុំនីមួយៗ ➜ ម៉ោងក្លែងសរុបដដែលទាំង ២ App
 * ហើយចម្លើយចុះលើម៉ោងក្លែងដដែល មិនអាស្រ័យលើល្បឿនម៉ាស៊ីន។ ⛔ កុំកែវាដោយបង្កើន `waitForTimeout` (ការសំណាង)។
 * `DEEP_NET_DELAY_MS` ៖ probe ពន្យារចម្លើយក្លែង · `DEEP_NET_DELAY_ONLY=old|new` ពន្យារតែ App មួយ (ពេលមិនស្មើគ្នា ៖
 * រូបរាងពិតនៃការធ្លាក់ CI ➜ ស្គ្រីបមុនការកែធ្លាក់ជួរទី 641 ដូច CI បេះបិទ)។ */
const NET_STEP_MS = 100;
const NET_SETTLE_MS = 20000;
const NET_DELAY_MS = Number(process.env.DEEP_NET_DELAY_MS) || 0;
const NET_DELAY_ONLY = process.env.DEEP_NET_DELAY_ONLY || '';
const netDelay = (port) => (NET_DELAY_MS > 0 && (!NET_DELAY_ONLY || (NET_DELAY_ONLY === 'new') === (port === newSrv.port))
    ? new Promise((res) => setTimeout(res, NET_DELAY_MS)) : Promise.resolve());
async function netQuiet(p) {
    const deadline = Date.now() + NET_SETTLE_MS;
    for (;;) {
        let n;
        try { n = await p.evaluate(() => window.__netPending || 0); } catch (e) {
            if (!/context was destroyed|navigat/i.test(String(e.message))) throw e;
            n = 'ទំព័រកំពុងផ្ទុក';
        }
        if (typeof n === 'number' && n <= 0) return;
        if (Date.now() > deadline) throw new Error('បណ្តាញមិនស្ងប់ក្នុង ' + NET_SETTLE_MS / 1000 + ' វិ. (សំណើកំពុងហោះ ' + n + ')');
        await p.waitForTimeout(20);
    }
}
async function advance(p, ms) {
    for (let left = ms; left > 0; left -= NET_STEP_MS) {
        await netQuiet(p);
        await p.clock.runFor(Math.min(NET_STEP_MS, left));
    }
    await netQuiet(p);
}
/* ── ការរមូរ ↔ ម៉ឺនុយ (...) ─────────────────────────────────────────────
 * App ទាំង ២ បិទម៉ឺនុយ (...) លើ **រាល់** ព្រឹត្តិការណ៍ `scroll` ➜ scroll-snap របស់ browser (ម៉ោងពិត) អាចបិទម៉ឺនុយដែល harness
 * ទើបបើក (វាស់បាន ៖ busy loop ៦ លើ ៤ CPU ➜ «ធុងសំរាមក្រោយចូលវិញ» ធ្លាក់ខាងដើម ដូច CI លើ main)។ ⛔ ច្បាប់ និងការវាស់រស់ក្នុង
 * `menu-scroll.mjs` **តែមួយកន្លែង** (ប្រើរួមជាមួយ `cleanup-rules-check.mjs`) ៖ រង់ចាំការរមូរស្ងប់មុនបើក · បើកម្តងទៀត **តែពេល**
 * វាស់ឃើញ scroll · ម៉ឺនុយបិទដោយគ្មាន scroll ➜ ធ្លាក់។ */

/* ── ម៉ោងនៃបង្អួចផ្ទុក ↔ ម៉ោងពិត ────────────────────────────────────────
 * `session()` ទុកនាឡិកា **ហូរតាមម៉ោងពិត** ពី `HARNESS_CLOCK_START` រហូតដល់ `pauseAt(+10 វិ.)` (ការផ្ទុកទំព័រត្រូវការ timer ពិត)
 * ➜ ត្រាដែល App បោះក្នុងបង្អួចនោះ (ឧ. «ទាញយកចុងក្រោយ» របស់ការទាញតារាងអតិថិជនពេលផ្ទុក) អាស្រ័យលើ **ល្បឿនម៉ាស៊ីន** មិនមែនលើ App
 * (វាស់បាន ៖ CI លើ main ធ្លាក់ ៦ ជំហាន ដោយ «13:00:01» ធៀប «13:00:00» តែប៉ុណ្ណោះ)។ ⛔ ក្រោយ `pauseAt` នាឡិកាឈប់ ➜ ម៉ោងនៅក្រៅបង្អួច
 * នៅប្រៀបពេញ។ បង្អួចដេរីវេពី `HARNESS_CLOCK_START` ពិត (ទម្រង់ `getFormattedClockTime()` · Asia/Phnom_Penh) មិនមែន literal។ */
const BOOT_WINDOW_MS = 10000;
const bootClockParts = (ms) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Phnom_Penh', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(ms);
const BOOT_WINDOW_TIMES = Array.from({ length: BOOT_WINDOW_MS / 1000 }, (_, i) => bootClockParts(HARNESS_CLOCK_START + i * 1000));
if (new Set(BOOT_WINDOW_TIMES).size !== BOOT_WINDOW_TIMES.length) throw new Error('បង្អួចផ្ទុក ៖ ម៉ោងស្ទួន ' + BOOT_WINDOW_TIMES.join(','));
const BOOT_WINDOW_RE = new RegExp('\\b(?:' + BOOT_WINDOW_TIMES.join('|') + ')\\b', 'g');
const stableTree = (tree) => String(tree).replace(BOOT_WINDOW_RE, '<ម៉ោងផ្ទុក>');

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const oldSrv = await serveDir(OLD_DIR);
const newSrv = await serveDir(NEW_DIR);

async function session(port, extraStorage = {}, zto = null) {
    const ctx = await browser.newContext({ viewport: { width: 414, height: 896 } });
    const page = await ctx.newPage();
    const errors = [];
    const dialogs = [];
    page.on('pageerror', (e) => errors.push(String(e.message) + (process.env.DEEP_STACK ? '\n' + String(e.stack) : '')));
    page.on('dialog', (d) => { dialogs.push(d.type() + ': ' + d.message()); d.accept().catch(() => {}); });
    await page.route('**', (r) => {
        const u = r.request().url();
        if (u.includes('/license-verify.js')) return r.fulfill({ status: 200, contentType: 'application/javascript', body: LICENSE_STUB });
        return u.includes('127.0.0.1') ? r.continue() : r.abort();
    });
    // ⛔ Apps Script ក្លែងក្លាយ ៖ ដូចគ្នាទាំង ២ App ➜ **តួសំណើ** (ជួរដេក · លុយ ·
    //    លេខទូរស័ព្ទ) ដែល App ផ្ញើ ត្រូវប្រៀបធៀបដូចការសរសេរ Firebase ដែរ។
    const appsScript = [];
    await page.route('https://script.google.com/**', async (r) => {
        await netDelay(port);
        if (r.request().method() === 'GET') {
            // ⛔ Lookup តាម Google Sheet ៖ `?list=1` (តារាងអតិថិជនទាំងមូល) ឬ `?code=` (មួយ barcode)
            const u = new URL(r.request().url());
            appsScript.push({ get: u.search });
            const all = SHEET_ROWS;
            const code = (u.searchParams.get('code') || '').toUpperCase();
            const out = u.searchParams.get('list') === '1' ? { rows: all }
                : (all.find((x) => x.barcode.toUpperCase() === code) || { error: 'not found' });
            await r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(out) });
            return;
        }
        let body;
        try { body = JSON.parse(r.request().postData() || '{}'); } catch (e) { body = { raw: r.request().postData() }; }
        appsScript.push(body);
        const rows = body.payload && Array.isArray(body.payload.rows) ? body.payload.rows.length : 0;
        const data = body.action === 'status' ? { spreadsheetName: 'ZoeSheet', sheetName: 'Customers', rowCount: 3 }
            : body.action === 'import' ? { added: rows, updated: 0, unchanged: 0, skippedNoBarcode: 0, duplicatesInFile: 0, rowsAfter: rows + 3, sheetName: 'Customers' }
            : body.action === 'clear' ? { removed: 5, rowsAfter: 0, sheetName: 'Customers' }
            : {};
        await r.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ ok: true, data }) });
    });
    // ⛔ Netlify Function ZTO ក្លែងក្លាយ ៖ ចម្លើយកំណត់ដោយ barcode ➜ ដូចគ្នាទាំង ២ App
    const ztoCalls = [];
    if (zto) {
        // ⛔ `ctx.route` មិនមែន `page.route` ៖ សំណើ same-origin ឆ្លងកាត់ Service Worker
        //    (`networkOnly()`) ហើយ `page.route` មើលមិនឃើញសំណើរបស់ SW ➜ 404 ពីម៉ាស៊ីន
        //    បម្រើឯកសារ ➜ «ពិនិត្យមិនបាន» ទាំង ២ App (ជំហានមិនវាស់អ្វីទេ)។
        await ctx.route('**/.netlify/functions/zto-order-detail**', async (r) => {
            const u = new URL(r.request().url());
            ztoCalls.push(u.search);
            await netDelay(port);
            const code = (u.searchParams.get('code') || '').toUpperCase();
            const body = u.searchParams.get('list') === '1'
                ? { enabled: true, rows: zto.listRows, pages: 1, total: zto.listRows.length }
                : (zto.detail[code] ? Object.assign({ found: true }, zto.detail[code]) : { found: false });
            await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
        });
    }
    for (const [k, v] of Object.entries(extraStorage)) {
        await page.addInitScript(`if (window.localStorage.getItem(${JSON.stringify(k)}) === null) window.localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(v)});`);
    }
    await page.addInitScript(`window.addEventListener('unhandledrejection', (e) => { (window.__rejections ||= []).push(String((e.reason && e.reason.message) || e.reason)); });`);
    await page.addInitScript(SCROLL_PROBE);
    // ⛔ សំណើបណ្តាញដែល **កំពុងហោះ** (fetch + ការអាន body) ➜ `advance()` រង់ចាំវាស្ងប់មុនរំកិលនាឡិកា
    //    (ដូចគ្នាទាំង ២ App ៖ App មិនពិនិត្យអត្តសញ្ញាណ `fetch` ហើយមិនប្រើ XHR)
    await page.addInitScript(`(() => {
        window.__netPending = 0;
        const track = (p) => { window.__netPending++; const done = () => { window.__netPending--; }; p.then(done, done); return p; };
        const origFetch = window.fetch;
        window.fetch = function () { return track(origFetch.apply(window, arguments)); };
        for (const m of ['json', 'text', 'arrayBuffer', 'blob', 'formData']) {
            const orig = Response.prototype[m];
            if (typeof orig === 'function') Response.prototype[m] = function () { return track(orig.apply(this, arguments)); };
        }
    })();`);
    // ⛔ Math.random ដូចគ្នាទាំង ២ ➜ ផ្នែកចៃដន្យនៃ id ស្មើគ្នា
    await page.addInitScript(`(() => { let a = 20260922; Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })();`);
    // ⛔ កំណត់ហេតុ toast ៖ រាល់សារដែល App បង្ហាញ (តាមលំដាប់) — មិនអាស្រ័យលើ
    //    ថាវានៅលេចឬអត់ ពេលវាស់
    await page.addInitScript(`(() => {
        window.__toastLog = [];
        const seen = new WeakMap();
        const scan = () => {
            document.querySelectorAll('#toastContainer .toast').forEach((t) => {
                const txt = t.textContent;
                if (seen.get(t) === txt) return;
                seen.set(t, txt);
                window.__toastLog.push(txt);
            });
        };
        new MutationObserver(scan).observe(document, { childList: true, subtree: true, characterData: true });
    })();`);
    // ⛔ `window.print()` ៖ ចាប់យក **អ្វីដែលនឹងត្រូវបោះពុម្ព** នៅខណៈហៅ រួចបាញ់ `afterprint`
    //    ➜ ផ្ទៃបោះពុម្ព PDF ត្រូវប្រៀបធៀបដូចអេក្រង់ ដោយមិនបើកប្រអប់ print ពិត។
    await page.addInitScript(`window.__printed = []; window.print = function () {
        const area = document.getElementById('pdfExportPrintArea');
        // ⛔ ប្រៀបធៀប **តាមក្រឡា** មិនមែន innerText ឆៅ ៖ ចន្លោះរវាង <td> (ពី template
        //    HTML ដើម) មិនលេចក្នុងការបោះពុម្ពពិត (table layout មិនអើពើវា) តែ innerText
        //    នៃធាតុដែលលាក់ រាប់វា ➜ ភាពខុសគ្នាក្លែងក្លាយ។ លេខ និងអក្សរនៅតែប្រៀបធៀបពេញ។
        const norm = (t) => String(t || '').replace(/\\s+/g, ' ').trim();
        const blocks = area ? Array.from(area.querySelectorAll('h1,h2,h3,h4,p,caption,tr')).map((el) => el.tagName === 'TR'
            ? Array.from(el.cells).map((c) => norm(c.textContent)).join(' | ')
            : el.tagName + ': ' + norm(el.textContent)) : null;
        window.__printed.push({ title: document.title, blocks: blocks, bodyClass: document.body.className });
        setTimeout(() => window.dispatchEvent(new Event('afterprint')), 0);
    };`);
    await page.addInitScript(`window.localStorage.setItem('zoew_firebase_config', ${JSON.stringify(CONFIG)});`);
    await page.addInitScript("if (!window.localStorage.getItem('zoe_active_locker')) window.localStorage.setItem('zoe_active_locker', 'A5');");
    await page.addInitScript('(' + FAKE_SDK.toString() + ')(' + JSON.stringify(seed) + ');');
    await page.clock.install({ time: HARNESS_CLOCK_START });
    await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
    await page.waitForTimeout(3000);
    // ⛔ នាឡិកាត្រូវ **ឈប់** ហើយរំកិលដោយចំនួនដូចគ្នាទាំង ២ App ➜ ត្រា «ឥឡូវ»
    //    ដែលលេចលើអេក្រង់ (ម៉ោងស្កេន) និងក្នុង DB ស្មើគ្នាបេះបិទ។ បើទុកឲ្យ
    //    ហូរ App ដែលរត់ជំហានក្រោយបន្តិច ឃើញម៉ោងខុស ២ វិនាទី ➜ ភាពខុសគ្នា
    //    ក្លែងក្លាយរាល់ជំហាន (វាស់បាន ៖ 13:00:14 ធៀប 13:00:12)។
    await page.clock.pauseAt(HARNESS_CLOCK_START + BOOT_WINDOW_MS);
    await advance(page, 2000);
    return { ctx, page, errors, dialogs, appsScript, ztoCalls, mark: 0, dialogMark: 0, errMark: 0, asMark: 0, toastMark: 0, ztoMark: 0 };
}

const T = 4000;
const named = (label, fn) => async (p) => { try { await fn(p); } catch (e) { const why = String(e.message).split('\n').filter((l) => /intercepts|not visible|not enabled|not stable|detached|outside/.test(l)).slice(-1)[0] || ''; throw new Error(label + ' ➜ ' + String(e.message).split('\n')[0] + (why ? ' · ' + why.trim() : ''), { cause: e }); } };
const click = (sel) => named('ចុច ' + sel, (p) => p.click(sel, { timeout: T }));
const fill = (sel, v) => named('វាយ ' + sel, (p) => p.fill(sel, v, { timeout: T }));
const seq = (...fns) => async (p) => { for (const f of fns) { await f(p); await advance(p, 300); await p.waitForTimeout(60); } };
const row = (text) => `#historyTableBody tr:has-text("${text}")`;
const menuTick = async (p) => { await advance(p, 300); await p.waitForTimeout(60); };
const openMenu = (sel, act) => named('ម៉ឺនុយ ' + sel + ' ➜ ' + act, (p) => openMenuItem(p, sel, `#menuContentContainer [data-act="${act}"]`, { tick: menuTick, timeout: T }));
const menu = (act) => seq(openMenu('.header-more-btn', act));
const rowMenu = (text, act) => seq(openMenu(`${row(text)} .more-btn`, act));
const scanCode = (code) => seq(fill('#hwScannerInput', code), click('.btn-submit-barcode'));
/** វាយ PIN **តែពេលវាសុំ** ៖ App ចងចាំការផ្ទៀងផ្ទាត់មួយរយៈ ➜ ប្រអប់ PIN មិនលេចរាល់ដង */
const pinIfAsked = async (p) => {
    await advance(p, 300);
    if (await p.isVisible('#pinModal')) {
        await p.fill('#securityPinInput', '123456', { timeout: T });
        await p.click('#pinConfirmBtn', { timeout: T });
        await advance(p, 400);
    }
};
/**
 * បើករបា Slide ➜ ពន្លា Category **តែពេលវាបត់** ➜ ចុចធាតុ។
 * ⛔ ស្ថានភាព Category អានពី class `is-open` **មិនមែន** ពីការមើលឃើញរបស់ធាតុ ៖
 *    ចលនារំកិលរបស់របា (CSS transition) រត់តាមម៉ោង **ពិត** ខណៈនាឡិកា JS ឈប់ ➜
 *    ធាតុ «មើលមិនឃើញ» មួយភ្លែត ➜ ការចុចក្បាល **បត់** Category ដែលបើករួច។
 */
const drawerItem = (text) => async (p) => {
    await named('ចុច #navMenuBtn', (q) => q.click('#navMenuBtn', { timeout: T }))(p);
    await advance(p, 300);
    await p.waitForSelector('#sideDrawer.open', { timeout: T });
    await p.waitForTimeout(450);
    const opened = await p.evaluate((t) => {
        const it = Array.from(document.querySelectorAll('#sideDrawer .drawer-item')).find((x) => x.textContent.includes(t));
        const g = it && it.closest('.drawer-group');
        if (!g) return 'no-group';
        if (g.classList.contains('is-open')) return 'open';
        g.querySelector('.drawer-group-head').click();
        return 'expanded';
    }, text);
    if (opened === 'no-group') throw new Error('រក Category នៃ «' + text + '» មិនឃើញ');
    await advance(p, 200);
    const item = `#sideDrawer .drawer-item:has-text("${text}")`;
    await named('ចុច ' + item, (q) => q.click(item, { timeout: T }))(p);
};
const CSV = ['Barcode,DOD,COD,Phone', 'AA1,2.5,10,012345678', 'ZZ9,0,7.25,0969999999', 'ZZ9,0,7.25,0969999999', ',1,1,011111111', 'QQ1,1.5,,'].join('\n');
const pickCsv = (p) => p.setInputFiles('#siFileInput', { name: 'customers.csv', mimeType: 'text/csv', buffer: Buffer.from(CSV) });

/**
 * ⛔ ជំហានត្រូវជា **ការចុច/វាយរបស់អ្នកប្រើ** ប៉ុណ្ណោះ (មិនមែនការហៅ
 *    `window.<fn>`) ➜ វាវាស់ App មិនមែនឧបករណ៍។
 */
const STEPS = [
    ['ទំព័រស្កេន', click('#pageTabEntry')],
    ['ស្កេន NEW1 ➜ ប្រអប់លេខទូរស័ព្ទ', scanCode('NEW1')],
    ['បំពេញ ➜ យល់ព្រម (សរសេរលុយ)', seq(fill('#modalPhoneInput', '015999888'), fill('#modalCodInput', '3.5'), fill('#modalDodInput', '1.25'), click('#phoneModalConfirmBtn'))],
    ['ស្កេន AA1 ស្ទួន', scanCode('AA1')],
    ['ត្រឡប់ទំព័រទិន្នន័យ', click('#pageTabData')],
    ['តម្រង «ទាំងអស់»', click('#btnFilterAll')],
    ['បិទកញ្ចប់ 012345678', click(`${row('012345678')} .close-btn`)],
    ['បើកវិញ 012345678', click(`${row('012345678')} .close-btn`)],
    ['បញ្ជី ➜ បិទ barcode ទី ២', seq(click(`${row('012345678')} .btn-view-list`), click('#barcodeListContainer .btn-toggle-bc-close >> nth=1'))],
    ['កែតម្លៃ barcode ទី ១', seq(click('#barcodeListContainer .btn-edit-item-price >> nth=0'), fill('#editBcCodInput', '11'), fill('#editBcDodInput', '2'), click('#editBarcodePriceModal .btn-confirm'))],
    ['បិទប្រអប់បញ្ជី', click('#viewListModal .btn-cancel')],
    ['សម្គាល់ការខល «អត់លើក»', seq(click(`${row('012345678')} .phone-clickable`), click('#callMarkModal .call-mark-no-answer'))],
    ['កែលេខទូរស័ព្ទ 0888888', seq(rowMenu('0888888', 'moreMenuEditPhone'), fill('#editPhoneInput', '0888889'), click('#editPhoneSaveBtn'))],
    ['លុបកញ្ចប់ 0888889', rowMenu('0888889', 'moreMenuDelete')],
    ['ធុងសំរាម', menu('moreMenuRecentlyDeleted')],
    ['ស្តារធាតុទី ១', seq(click('#deletedTableBody .trash-restore-btn >> nth=0'), click('#restoreConfirmBtn'))],
    ['លុបជាអចិន្ត្រៃយ៍ធាតុទី ១', seq(click('#deletedTableBody .trash-purge-btn >> nth=0'), click('#permanentDeleteConfirmBtn'))],
    ['បិទធុងសំរាម', click('#recentlyDeletedModal .btn-cancel')],
    ['របៀបដក ➜ ស្កេន CC1', seq(click('#pageTabEntry'), click('#modeRemoveBtn'), scanCode('CC1'))],
    ['បញ្ជាក់ការដក (ដកលុយ)', click('#scanRemoveConfirmBtn')],
    ['របៀប Locker ➜ ស្កេន NEW1', seq(click('#modeLockerBtn'), scanCode('NEW1'))],
    ['ត្រឡប់របៀបកញ្ចប់ ➜ ទំព័រទិន្នន័យ', seq(click('#modeParcelBtn'), click('#pageTabData'))],
    ['អត្រាប្រាក់ 4200', seq(menu('moreMenuExchangeRate'), fill('#exchangeRateInput', '4200'), click('#exchangeRateModal .btn-confirm'))],
    ['ស្ថិតិប្រចាំថ្ងៃ', click('.daily-stats-btn')],
    ['បិទស្ថិតិ', click('#dailyStatsModal .btn-cancel')],
    ['ចំណូលប្រចាំថ្ងៃ', click('.monthly-stats-btn')],
    ['បិទចំណូល', click('#collectedStatsModal .btn-cancel')],
    ['ស្វែងរក «015»', fill('#searchPhoneInput', '015')],
    ['សម្អាតការស្វែងរក', fill('#searchPhoneInput', '')],
    ['Reset ចំនួនយករួច ➜ កំណត់ PIN', seq(menu('moreMenuResetPickup'), fill('#newSecurityPinInput', '123456'), click('#pinSetupSaveBtn'))],
    ['របា Slide ➜ ពិនិត្យសុខភាព', drawerItem('ពិនិត្យសុខភាព')],
    ['បិទពិនិត្យសុខភាព', click('#healthCheckModal .btn-cancel')],
    ['នាំចូល Excel ➜ PIN', seq(drawerItem('នាំចូល Excel ទៅ Sheet'), pinIfAsked)],
    ['រក្សាទុកការតភ្ជាប់ Sheet', seq(fill('#siApiUrlInput', 'https://script.google.com/macros/s/FAKE/exec'), fill('#siApiPasswordInput', 'pw123'), click('#siConfigSaveBtn'))],
    ['ជ្រើសឯកសារ CSV', pickCsv],
    // ⛔ ក្បាលជួរឈរជាអង់គ្លេស ➜ ការរកស្វ័យប្រវត្តិមិនឃើញ (ដូចគ្នាទាំង ២) ➜ ជ្រើសដោយដៃ
    ['ផ្គូផ្គង Barcode · DOD · Phone', seq((p) => p.selectOption('#siMapBarcode', '0', { timeout: T }), (p) => p.selectOption('#siMapDod', '1', { timeout: T }), (p) => p.selectOption('#siMapPhone', '3', { timeout: T }))],
    ['ផ្គូផ្គង COD ➜ ជួរឈរ C', (p) => p.selectOption('#siMapCod', '2', { timeout: T })],
    ['ផ្គូផ្គង COD ➜ មិនប្រើ', (p) => p.selectOption('#siMapCod', '-1', { timeout: T })],
    ['ផ្គូផ្គង COD ➜ ជួរឈរ C វិញ', (p) => p.selectOption('#siMapCod', '2', { timeout: T })],
    ['របៀប «ថ្មីតែប៉ុណ្ណោះ»', (p) => p.selectOption('#siModeSel', 'newOnly', { timeout: T })],
    ['នាំចូលទៅ Sheet', click('#siImportBtn')],
    ['សម្អាតទិន្នន័យក្នុង Sheet', click('#siClearBtn')],
    ['បិទប្រអប់នាំចូល', click('#sheetImportModal .btn-cancel:has-text("បិទ")')],
    ['កែទឹកប្រាក់/កញ្ចប់ (PIN)', seq(menu('moreMenuManualAdjust'), pinIfAsked, fill('#manualDateInput', '2026-09-22'), fill('#manualCodChangeInput', '1.5'), fill('#manualDodChangeInput', '0.5'), fill('#manualCountChangeInput', '1'), click('#manualAdjustSubmitBtn'))],
    ['តម្រងថ្ងៃផ្ទាល់ខ្លួន 2026-09-21', fill('#customDateInput', '2026-09-21')],
    ['តម្រង «ទាំងអស់» វិញ', click('#btnFilterAll')],
    ['កំណត់ទូ Locker (PIN)', seq(drawerItem('កំណត់ទូ Locker'), pinIfAsked, fill('#lockerPrefixInput', 'B'), fill('#lockerCountInput', '12'), click('#lockerSettingsSaveBtn'))],
    ['ប្តូរទូ ➜ ក្រឡាទី ៣', seq(click('#pageTabEntry'), click('#modeLockerBtn'), click('button:has-text("ប្តូរទូ")'), click('#lockerGrid > :nth-child(3)'))],
    ['ត្រឡប់ទំព័រទិន្នន័យ (២)', seq(click('#modeParcelBtn'), click('#pageTabData'))],
    ['របាយការណ៍ខែ ➜ ជ្រើសខែ', seq(menu('moreMenuMonthlyReport'), (p) => p.selectOption('#monthlyReportMonthSel', { index: 0 }, { timeout: T }))],
    // ⛔ ការនាំចេញ PDF បិទប្រអប់ខែខ្លួនវា (ដូចគ្នាទាំង ២ App) ➜ គ្មានជំហានបិទបន្ទាប់
    ['របាយការណ៍ខែ ➜ PDF', click('#monthlyReportModal .btn-confirm:has-text("PDF")')],
    ['Export ➜ PDF (ប្រវត្តិ)', seq(menu('moreMenuExport'), click('#exportDataModal .btn-confirm:has-text("PDF")'))],
    ['ចាកចេញ', seq(click('#navMenuBtn'), click('#navAuthBtn'), click('#logoutConfirmBtn'))],
    ['ចូលវិញ', seq(fill('#loginEmailInput', 'a@b.c'), fill('#loginPasswordInput', 'secret1'), click('#loginBtn'))],
    ['ទំព័រស្កេនក្រោយចូលវិញ', click('#pageTabEntry')],
    ['បញ្ជី Locker ក្រោយចូលវិញ', click('#modeLockerBtn')],
    ['ធុងសំរាមក្រោយចូលវិញ', seq(click('#modeParcelBtn'), click('#pageTabData'), menu('moreMenuRecentlyDeleted'))],
    ['បិទធុងសំរាម (២)', click('#recentlyDeletedModal .btn-cancel')],
    // ⛔ ចុងក្រោយគេ ៖ វាលុបប្រវត្តិទាំងអស់ ➜ ជំហានក្រោយវានឹងវាស់តារាងទទេ
    ['លុបទាំងអស់ (PIN)', seq(menu('moreMenuClearHistory'), pinIfAsked)],
    ['ធុងសំរាមក្រោយលុបទាំងអស់', menu('moreMenuRecentlyDeleted')]
];



/* ── សេណារីយ៉ូ ZTO ────────────────────────────────────────────────────────
 * ⛔ ដាច់ពីសេណារីយ៉ូស្នូល ៖ ការកំណត់ Lookup ZTO ប្តូរផ្លូវស្កេន (ស្វែងរកស្វ័យ-
 *    ប្រវត្តិ) ➜ វាមិនត្រូវប៉ះជំហាន ៥៩ ដែលវាស់រួច។ */
const ZTO_STORAGE = {
    zoew_lookup_api_config: JSON.stringify({ enabled: true, url: '/.netlify/functions/zto-order-detail?code={barcode}', fastMode: true }),
    // BB1 បិទក្នុង ZoeW តែ ZTO រាយថា «មិនទាន់» ➜ របាត្រូវលេចពេលផ្ទុក
    zoew_zto_pickup_status_v1: JSON.stringify({ BB1: { closed: false, at: HARNESS_CLOCK_START } }),
    zoew_zto_listsync_v1: '1',
    // ⛔ សាខាដេរីវេពី email (`@zoew<លេខ>.com`) ➜ គណនីក្លែងក្លាយត្រូវជាគណនីសាខា
    __fake_email: 'shop@zoew123.com'
};
const ZTO_BACKEND = {
    detail: {
        BB1: { phone: '0977777777', cod: 30, dod: 0, ztoClosed: false },
        AA1: { phone: '012345678', cod: 10, dod: 2.5, ztoClosed: true },
        AA2: { phone: '012345678', cod: 2.5, dod: 0, ztoClosed: null },
        ZL9: { phone: '0975555555', cod: 1, dod: 0, ztoClosed: true },
        ZL5: { phone: '0976666666', cod: 2.25, dod: 0.75, ztoClosed: null }
    },
    listRows: [
        { barcode: 'ZL1', phone: '0971111111', cod: 4.5, dod: 1, at: '2026-09-22 09:30:00', ztoClosed: null, skip: '' },
        { barcode: 'AA1', phone: '012345678', cod: 10, dod: 2.5, at: '2026-09-22 09:00:00', ztoClosed: null, skip: '' },
        { barcode: 'ZL2', phone: '0972222222', cod: 3, dod: 0, at: '2026-09-22 10:00:00', ztoClosed: null, skip: '' },
        { barcode: 'ZL2', phone: '0972222222', cod: 3, dod: 0, at: '2026-09-22 10:05:00', ztoClosed: null, skip: '' },
        { barcode: 'ZL3', phone: '', cod: 5, dod: 0, at: '2026-09-22 10:10:00', ztoClosed: null, skip: '' },
        // ⛔ `ztoClosed: null` ៖ ជួរដេកក្មេងដែល ZTO បិទរួច កើតមកជា «យករួច» ក្នុង App ថ្មី (ZoeW 2.50.0 · សំណើម្ចាស់គម្រោង) ខណៈ App ដើមបញ្ចូលវាបើក
        //    ➜ parity វាស់ផ្លូវរួម · ផ្លូវថ្មី ៖ `zto-list-sync-test` ផ្នែក ១៦/២១ · `ZoeW/tests/zto-signed-sync.test.tsx` (`detail.ZL9` នៅ `true` សម្រាប់ការស្កេនស្ទួន)
        { barcode: 'ZL9', phone: '0975555555', cod: 1, dod: 0, at: '2026-09-18 08:00:00', ztoClosed: null, skip: '' },
        { barcode: 'ZL8', phone: '0978888888', cod: 2, dod: 0, at: '2026-09-18 08:00:00', ztoClosed: false, skip: '' },
        { barcode: 'ZL7', phone: '0977777770', cod: 6, dod: 0, at: '2026-09-22 11:00:00', ztoClosed: null, skip: 'scan-type' }
    ]
};
const ZTO_STEPS = [
    ['ទំព័រទិន្នន័យ (មានរបា ZTO)', click('#btnFilterAll')],
    ['ចុចរបា ➜ បញ្ជី ZTO មិនទាន់បិទ', click('#ztoSyncBanner')],
    ['ពិនិត្យម្តងទៀត', click('#ztoSyncRecheckBtn')],
    ['បិទបញ្ជី', click('#ztoSyncCloseBtn')],
    ['បើកទាញបញ្ជី ZTO ➜ កំណត់ PIN', seq(click('#ztoListSyncBtn'), async (p) => {
        await advance(p, 300);
        if (await p.isVisible('#pinSetupModal')) {
            await p.fill('#newSecurityPinInput', '123456', { timeout: T });
            await p.click('#pinSetupSaveBtn', { timeout: T });
        }
    }, pinIfAsked)],
    ['ជួរថ្ងៃ 2026-09-17 ➜ 2026-09-22', seq(fill('#ztoListSyncFrom', '2026-09-17'), fill('#ztoListSyncTo', '2026-09-22'))],
    ['ទាញបញ្ជី (មើលជាមុន)', click('#ztoListSyncRunBtn')],
    ['បញ្ចូល (សរសេរលុយ)', click('#ztoListSyncImportBtn')],
    ['បិទប្រអប់ទាញបញ្ជី', click('#ztoListSyncCloseBtn')],
    ['តារាង «ថ្ងៃនេះ» ក្រោយបញ្ចូល', click('#btnFilterToday')],
    ['ទំព័រស្កេន ➜ ស្កេន ZL9 ស្ទួន', seq(click('#pageTabEntry'), scanCode('ZL9'))],
    ['ស្កេន ZL5 ➜ ZTO បំពេញស្វ័យប្រវត្តិ', scanCode('ZL5')],
    ['យល់ព្រម (សរសេរលុយពី ZTO)', click('#phoneModalConfirmBtn')]
];
/* ── សេណារីយ៉ូ Google Sheet ៖ តារាងអតិថិជន + Lookup តាម Sheet ─────────── */
const SHEET_ROWS = [
    { barcode: 'SH1', phone: '0961111111', cod: 5.5, dod: 1.25 },
    { barcode: 'SH2', phone: '0962222222', cod: 0, dod: 3 },
    { barcode: 'NEW7', phone: '0967777777', cod: 8, dod: 0.5 },
    { barcode: '<b>x</b>', phone: '"q"&', cod: 1, dod: 0 }
];
const SHEET_STORAGE = {
    zoew_lookup_api_config: JSON.stringify({ enabled: true, url: 'https://script.google.com/macros/s/FAKE/exec?code={barcode}' })
};
const SHEET_STEPS = [
    ['តារាងអតិថិជន (PIN)', seq(drawerItem('តារាងអតិថិជន'), async (p) => {
        await advance(p, 300);
        if (await p.isVisible('#pinSetupModal')) {
            await p.fill('#newSecurityPinInput', '123456', { timeout: T });
            await p.click('#pinSetupSaveBtn', { timeout: T });
        }
    }, pinIfAsked)],
    ['ស្វែងរកក្នុងតារាង «096»', fill('#customerDataTableSearchInput', '096')],
    ['ស្វែងរក «<b>» (គេចអក្សរ)', fill('#customerDataTableSearchInput', '<b>')],
    ['បិទតារាង', click('#customerDataTableModal .btn-cancel:has-text("បិទ")')],
    ['ទំព័រស្កេន ➜ ស្កេន NEW7 (Lookup Sheet)', seq(click('#pageTabEntry'), scanCode('NEW7'))],
    ['យល់ព្រម (សរសេរលុយពី Sheet)', click('#phoneModalConfirmBtn')]
];

/* ── សេណារីយ៉ូ ─────────────────────────────────────────────────────────── */
let bad = 0;
let vacuous = 0;
let totalSteps = 0;
const allErrA = [];
const allErrB = [];
const firstDiff = (x, y) => {
    const la = x.split('\n'); const lb = y.split('\n');
    for (let i = 0; i < Math.max(la.length, lb.length); i++) {
        if (la[i] !== lb[i]) return `ជួរទី ${i}\n        ដើម : ${String(la[i]).slice(0, 240)}\n        ថ្មី : ${String(lb[i]).slice(0, 240)}`;
    }
    return '';
};

async function state(S) {
    const snap = await S.page.evaluate(SNAPSHOT, { skipToasts: true, ui: INTENTIONAL_UI });
    snap.tree = stableTree(snap.tree);
    const toastAll = await S.page.evaluate(() => window.__toastLog || []);
    const toasts = toastAll.slice(S.toastMark).join(' ‖ ');
    S.toastMark = toastAll.length;
    const writes = await S.page.evaluate((m) => (window.__writeLog || []).slice(m), S.mark);
    const total = await S.page.evaluate(() => (window.__writeLog || []).length);
    const dump = await S.page.evaluate(() => window.__fakeDump());
    const text = await S.page.evaluate(() => document.body.innerText);
    const dialogs = S.dialogs.slice(S.dialogMark);
    const rej = await S.page.evaluate(() => window.__rejections || []);
    const errs = S.errors.concat(rej).slice(S.errMark);
    const asReq = S.appsScript.slice(S.asMark);
    S.asMark = S.appsScript.length;
    // ⛔ ZoeW 2.50.0 (សំណើម្ចាស់គម្រោង) ៖ App ថ្មីសុំបញ្ជី «ចុះហត្ថលេខា» របស់ ZTO (`withSigned=1` លើទំព័របញ្ជី · `signed=1` ក្នុងជុំបិទតាម ZTO
    //    ស្វ័យប្រវត្តិ) ➜ App ដើមគ្មាន ➜ ប្រៀបដោយដកវាចេញ (Function ក្លែងមិនឆ្លើយ `signed` ➜ គ្មានការបិទ ➜ អេក្រង់ · ការសរសេរ · DB នៅប្រៀបពេញ ·
    //    ឥរិយាបថរបស់វា ៖ `zto-list-sync-test` ផ្នែក ២១ · `ZoeW/tests/zto-signed-sync.test.tsx`)
    const ztoReq = S.ztoCalls.slice(S.ztoMark).filter((q) => !/[?&]signed=1(?:&|$)/.test(q))
        .map((q) => q.replace(/&withSigned=1(?=&|$)/, '')).sort().join(' ‖ ');
    S.ztoMark = S.ztoCalls.length;
    S.mark = total;
    S.dialogMark = S.dialogs.length;
    S.errMark = S.errors.length + rej.length;
    const printedAll = await S.page.evaluate(() => window.__printed || []);
    const printed = JSON.stringify(printedAll.slice(S.printMark || 0));
    S.printMark = printedAll.length;
    const sig = idSignatures(dump);
    return { snap, writes: normalize(writes, sig), dump: normalize(dump, sig), text, dialogs: dialogs.join(' ‖ '), errs, appsScript: normalize(asReq), toasts, ztoReq, printed };
}

async function runScenario(title, steps, storage = {}, zto = null) {
    console.log(`\n── សេណារីយ៉ូ ៖ ${title} ──`);
    const A = await session(oldSrv.port, storage, zto);
    const B = await session(newSrv.port, storage, zto);
    await state(A); await state(B);   // មូលដ្ឋាន ៖ ការសរសេរពេលផ្ទុកត្រូវ parity-live វាស់រួច
    let prevTree = stableTree((await A.page.evaluate(SNAPSHOT, { skipToasts: true, ui: INTENTIONAL_UI })).tree);
    const DEBUG = () => ({
        modals: Array.from(document.querySelectorAll('.modal')).filter((m) => m.style.display === 'flex').map((m) => m.id),
        siFileMsg: (document.getElementById('siFileMsg') || {}).textContent,
        siMapMsg: (document.getElementById('siMapMsg') || {}).textContent,
        siChips: (document.getElementById('siChips') || {}).textContent,
        siImportDisabled: (document.getElementById('siImportBtn') || {}).disabled,
        toasts: Array.from(document.querySelectorAll('#toastContainer .toast')).map((t) => t.textContent)
    });

    for (const [label, fn] of steps) {
        let okA = true; let okB = true; let errA = ''; let errB = '';
        try { await fn(A.page); } catch (e) { okA = false; errA = String(e.message).split('\n')[0]; }
        try { await fn(B.page); } catch (e) { okB = false; errB = String(e.message).split('\n')[0]; }
        let netA = ''; let netB = '';
        for (const S of [A, B]) {
            try { await advance(S.page, 1500); await S.page.waitForTimeout(150); await advance(S.page, 100); } catch (e) { if (S === A) netA = String(e.message); else netB = String(e.message); }
        }
        const a = await state(A);
        const b = await state(B);
        const layers = {
            'អេក្រង់': [a.snap.tree, b.snap.tree],
            'ការសរសេរ': [a.writes, b.writes],
            'DB': [a.dump, b.dump],
            'ប្រអប់ native': [a.dialogs, b.dialogs],
            'Apps Script': [a.appsScript, b.appsScript],
            'សារ toast': [a.toasts, b.toasts],
            'សំណើ ZTO': [a.ztoReq, b.ztoReq],
        'ផ្ទៃបោះពុម្ព PDF': [a.printed, b.printed]
        };
        const diffs = Object.entries(layers).filter(([, [x, y]]) => x !== y).map(([k]) => k);
        const clickNote = okA === okB ? (okA ? '' : '  ⚠️ ការចុចមិនកើតទាំង ២ ខាង') : '  ⚠️ ការចុចធ្លាក់ម្ខាង';
        const writes = JSON.parse(a.writes).length;
        // ⛔ ជាន់អប្បបរមា ៖ ជំហានដែលមិនប្តូរអ្វីសោះ (អេក្រង់ · ការសរសេរ · ប្រអប់ · Apps Script)
        //    មិនបានវាស់អ្វីទេ ➜ «ដូចគ្នា» លើអេក្រង់ដែលមិនប្រែ ពិតដោយស្វ័យប្រវត្តិ។
        const changed = a.snap.tree !== prevTree || writes > 0 || a.dialogs || a.appsScript !== '[]' || a.toasts || a.printed !== '[]';
        prevTree = a.snap.tree;
        if (!changed) vacuous++;
        if (process.env.DEEP_DEBUG) console.log('      🔎 ' + JSON.stringify(await A.page.evaluate(DEBUG)) + (a.toasts ? '\n      🔔 ' + a.toasts : '') + (a.ztoReq ? '\n      🚚 ' + a.ztoReq : ''));
        const ok = !diffs.length && okA === okB && okA && changed && !netA && !netB;
        if (!ok) bad++;
        console.log(`${ok ? '✅' : '❌'} ${label.padEnd(34)} សរសេរ ${String(writes).padStart(2)}${a.toasts ? '  🔔' : ''}${a.dialogs ? '  💬' : ''}${a.appsScript !== '[]' ? '  📤' : ''}${changed ? '' : '  ⚠️ មិនប្តូរអ្វីសោះ'}${clickNote}${diffs.length ? '  ≠ ' + diffs.join(' · ') : ''}`);
        if (!okA || !okB) console.log(`      ចុច ៖ ដើម ${okA ? 'OK' : errA} · ថ្មី ${okB ? 'OK' : errB}`);
        if (netA || netB) console.log(`      ⏳ ${netA ? 'ដើម ៖ ' + netA : ''}${netA && netB ? ' · ' : ''}${netB ? 'ថ្មី ៖ ' + netB : ''}`);
        for (const e of b.errs) console.log(`      💥 ថ្មី ៖ ${String(e).slice(0, 200)}`);
        for (const e of a.errs) console.log(`      💥 ដើម ៖ ${String(e).slice(0, 200)}`);
        if (b.errs.length > a.errs.length) bad++;
        for (const k of diffs) console.log(`      [${k}] ${firstDiff(layers[k][0], layers[k][1])}`);
        if (process.env.DEEP_DUMP_DIR && diffs.length) {
            const fs = await import('node:fs');
            const slug = label.replace(/[^\p{L}\p{N}]+/gu, '_').slice(0, 40);
            for (const k of diffs) {
                fs.writeFileSync(`${process.env.DEEP_DUMP_DIR}/${slug}.${k === 'DB' ? 'db' : 'x'}.old.txt`, layers[k][0]);
                fs.writeFileSync(`${process.env.DEEP_DUMP_DIR}/${slug}.${k === 'DB' ? 'db' : 'x'}.new.txt`, layers[k][1]);
            }
        }

        if (label === 'ចាកចេញ') {
            const leakA = CUSTOMER_MARKERS.filter((m) => a.text.includes(m));
            const leakB = CUSTOMER_MARKERS.filter((m) => b.text.includes(m));
            const leakOk = leakB.length <= leakA.length && leakB.every((m) => leakA.includes(m));
            if (!leakOk) bad++;
            console.log(`${leakOk ? '✅' : '❌'} ${'ទិន្នន័យអតិថិជនក្រោយចាកចេញ'.padEnd(34)} ដើម [${leakA.join(' ')}] · ថ្មី [${leakB.join(' ')}]`);
        }
    }


    totalSteps += steps.length;
    const noisyErr = (list) => list.filter((e) => !/favicon|sentry|gstatic|fonts\.googleapis|ERR_|Failed to fetch/i.test(e));
    allErrA.push(...noisyErr(A.errors), ...(await A.page.evaluate(() => window.__rejections || [])));
    allErrB.push(...noisyErr(B.errors), ...(await B.page.evaluate(() => window.__rejections || [])));
    await A.ctx.close();
    await B.ctx.close();
}

console.log('╔══════════════════════════════════════════════════════════════════════╗');
console.log('║  parity ជម្រៅ ៖ ផ្លូវលុយ · ចាកចេញ/ចូលវិញ · ប្រអប់ (ZoeW ដើម ➜ Next)  ║');
console.log('╚══════════════════════════════════════════════════════════════════════╝');

if (!process.env.DEEP_ONLY || process.env.DEEP_ONLY === 'core') await runScenario('ស្នូល (ស្កេន · លុយ · ធុងសំរាម · PIN · នាំចូល · ចាកចេញ)', STEPS);
if (!process.env.DEEP_ONLY || process.env.DEEP_ONLY === 'zto') await runScenario('ZTO (របា · ប្រអប់ · ទាញបញ្ជី · បញ្ចូល)', ZTO_STEPS, ZTO_STORAGE, ZTO_BACKEND);
if (!process.env.DEEP_ONLY || process.env.DEEP_ONLY === 'sheet') await runScenario('Google Sheet (តារាងអតិថិជន · Lookup)', SHEET_STEPS, SHEET_STORAGE);

console.log(`\nកំហុស runtime ៖ ដើម ${allErrA.length} · ថ្មី ${allErrB.length}`);
allErrB.slice(0, 8).forEach((e) => console.log('   ថ្មី: ' + e));
allErrA.slice(0, 3).forEach((e) => console.log('   ដើម: ' + e));
const extraErr = Math.max(0, allErrB.length - allErrA.length);

await browser.close();
oldSrv.server.close();
newSrv.server.close();
console.log(`ជំហានដែលមិនប្តូរអ្វីសោះ ៖ ${vacuous}/${totalSteps}`);
const failed = bad + extraErr;
console.log(failed ? `\n❌ ជំហានខុស ${bad} · កំហុសបន្ថែម ${extraErr}` : `\n✅ ជំហានទាំង ${totalSteps} ដូចគ្នាបេះបិទ (អេក្រង់ · ការសរសេរ · DB · ប្រអប់ native · Apps Script · toast · ZTO)`);
process.exit(failed ? 1 : 0);
