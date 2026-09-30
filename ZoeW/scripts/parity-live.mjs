/**
 * parity **ជាមួយទិន្នន័យពិត** ៖ បើក ZoeW ដើម និង ZoeW React ដោយ RTDB
 * ក្លែងក្លាយដដែល រួចប្រៀបធៀបអ្វីដែល *អ្នកប្រើឃើញលើអេក្រង់*។
 *
 * ⛔ នេះជាការវាស់ដែលសំខាន់ជាងគេ ៖ `parity-dom.mjs` ប្រៀបធៀបសំបកទទេ។
 *    តេស្តនេះប្រៀបធៀប **តារាងប្រវត្តិ · ស្ថិតិ · លុយ** ដែលគូរចេញពី
 *    ទិន្នន័យដូចគ្នា ➜ វាចាប់ការឃ្លាតក្នុង *តក្កវិជ្ជា* មិនត្រឹម markup។
 */
import { chromium } from 'playwright-core';
import { serveDir } from './serve.mjs';
import { FAKE_SDK, HARNESS_CLOCK_START, LICENSE_STUB, seedData } from './fake-firebase.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveOldRoot } from './old-app.mjs';
import { INTENTIONAL_UI, SNAPSHOT } from './snapshot.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OLD_DIR = resolveOldRoot(HERE);
// ZOEW_PARITY_DIST ៖ build ឯកជន (`npm run build:parity`) ➜ run-all មិនប្រណាំង `dist` ជាមួយ zoew-suite
const NEW_DIR = process.env.ZOEW_PARITY_DIST ? path.resolve(process.env.ZOEW_PARITY_DIST) : path.join(HERE, '..', 'dist');

const CONFIG = JSON.stringify({ apiKey: 'k', databaseURL: 'https://fake-default-rtdb.firebaseio.com', projectId: 'p' });
const seed = seedData();

const READ = () => {
    const txt = (id) => { const el = document.getElementById(id); return el ? el.textContent.replace(/\s+/g, ' ').trim() : null; };
    const probe = document.createElement('div');
    const normStyle = (v) => { probe.style.cssText = ''; probe.style.cssText = v; return Array.from(probe.style).map((p) => p + ':' + probe.style.getPropertyValue(p)).sort().join(';'); };
    const SKIP = ['data-act', 'data-args', 'data-a1', 'data-a2', 'data-evt', 'data-self', 'data-on', 'data-sig', 'data-id'];
    const canon = (root) => {
        if (!root) return null;
        const visit = (el) => {
            const attrs = Array.from(el.attributes)
                .filter((a) => !SKIP.includes(a.name))
                .map((a) => a.name + '=' + (a.name === 'style' ? normStyle(a.value) : a.value))
                .filter((s) => s !== 'class=')
                .sort().join('|');
            const text = Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.data).join('').replace(/\s+/g, ' ').trim();
            return `<${el.tagName}[${attrs}]${text ? '::' + text : ''}>${Array.from(el.children).map(visit).join('')}`;
        };
        return Array.from(root.children).map(visit).join('\n');
    };
    return {
        historyRows: document.querySelectorAll('#historyTableBody tr').length,
        historyTable: canon(document.getElementById('historyTableBody')),
        entryList: canon(document.getElementById('entryListTableBody')),
        lockerList: canon(document.getElementById('lockerListTableBody')),
        trashList: canon(document.getElementById('deletedTableBody')),
        count: txt('count'),
        grandTotalCount: txt('grandTotalCount'),
        todayTotalCount: txt('todayTotalCount'),
        todayClosedCount: txt('todayClosedCount'),
        todayPackagesPickedUpCount: txt('todayPackagesPickedUpCount'),
        summaryCodDollar: txt('summaryCodDollar'), summaryCodRiel: txt('summaryCodRiel'),
        summaryDodDollar: txt('summaryDodDollar'), summaryDodRiel: txt('summaryDodRiel'),
        summaryTotalDollar: txt('summaryTotalDollar'), summaryTotalRiel: txt('summaryTotalRiel'),
        statusText: txt('firebaseStatusText'),
        writeLog: (window.__writeLog || []).map((w) => w.op + ' ' + w.path).sort(),
        listenerThrew: window.__listenerThrew || null,
        rejections: window.__rejections || []
    };
};

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const oldSrv = await serveDir(OLD_DIR);
const newSrv = await serveDir(NEW_DIR);

/**
 * ជំហានអន្តរកម្ម ៖ រត់ដូចគ្នាបេះបិទលើ App ទាំង ២ រួចប្រៀបធៀបអេក្រង់
 * ក្រោយជំហាននីមួយៗ។ ⛔ ផ្ទៃទាំងអស់ឥឡូវជា React ➜ ជំហានទាំងនេះជា
 * **អ្នកវាស់តែមួយ** ដែលឃើញលំដាប់ «ផ្សាយចូលឃ្លាំង ➜ គូរ ➜ វាស់» ៖ វាស់បាន
 * ២ ករណីដែលការអានកូដមិនឃើញ — ម៉ឺនុយ (...) ត្រូវវាស់ទំហំមុន React គូរ
 * ធាតុរបស់វា ហើយប៊ូតុងម៉ឺនុយបាត់ `data-act` ➜ ម៉ឺនុយទាំងមូលស្លាប់។
 */
const STEPS = [
    ['ផ្ទុកដំបូង (តម្រង «ថ្ងៃនេះ»)', null],
    ['តម្រង «ទាំងអស់»', (p) => p.click('#btnFilterAll')],
    ['ប្រអប់បញ្ជីកញ្ចប់', (p) => p.click('#historyTableBody .btn-view-list')],
    ['បិទប្រអប់បញ្ជី', (p) => p.click('#viewListModal .btn-cancel')],
    ['ទំព័រស្កេន', (p) => p.click('#pageTabEntry')],
    ['របៀប Locker', (p) => p.click('#modeLockerBtn')],
    ['របៀបដក', (p) => p.click('#modeRemoveBtn')],
    ['ត្រឡប់របៀបកញ្ចប់', (p) => p.click('#modeParcelBtn')],
    ['ត្រឡប់ទំព័រទិន្នន័យ', (p) => p.click('#pageTabData')],
    ['ម៉ឺនុយ (...) ខាងលើ', (p) => p.click('.header-more-btn')],
    ['ធុងសំរាម', (p) => p.click('[data-act="moreMenuRecentlyDeleted"]')],
    ['បិទធុងសំរាម', (p) => p.click('#recentlyDeletedModal .btn-cancel')],
    ['របាយការណ៍ខែ', async (p) => { await p.click('.header-more-btn'); await p.click('[data-act="moreMenuMonthlyReport"]'); }],
    ['បិទរបាយការណ៍ខែ', (p) => p.click('#monthlyReportModal .btn-cancel')],
    ['បើករបា Slide', (p) => p.click('#navMenuBtn')],
    // ⛔ Category «ZTO» លាក់ដោយចេតនាពេល Fast Mode មិនបើក ➜ ប្រើ Category
    //    ដែលមើលឃើញជានិច្ច បើមិនដូច្នេះជំហាននេះមិនវាស់អ្វីទេ។
    ['ពន្លា Category «ការតភ្ជាប់»', (p) => p.click('#drawerGroupHeadConnect')],
    ['ពន្លា Category «ឧបករណ៍»', (p) => p.click('#drawerGroupTools .drawer-group-head')],
    ['បិទរបា Slide', (p) => p.click('#sideDrawer .drawer-close')],
    ['តម្រង «ថ្ងៃនេះ» វិញ', (p) => p.click('#btnFilterToday')]
];

async function session(port) {
    const ctx = await browser.newContext({ viewport: { width: 414, height: 896 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e.message)));
    await page.route('**', (r) => {
        const u = r.request().url();
        if (u.includes('/license-verify.js')) return r.fulfill({ status: 200, contentType: 'application/javascript', body: LICENSE_STUB });
        return u.includes('127.0.0.1') ? r.continue() : r.abort();
    });
    await page.addInitScript(`window.addEventListener('unhandledrejection', (e) => { (window.__rejections ||= []).push(String((e.reason && e.reason.message) || e.reason)); });`);
    await page.addInitScript(`window.localStorage.setItem('zoew_firebase_config', ${JSON.stringify(CONFIG)});`);
    await page.addInitScript("window.localStorage.setItem('zoe_active_locker', 'A5');");
    await page.addInitScript('(' + FAKE_SDK.toString() + ')(' + JSON.stringify(seed) + ');');
    // ⛔ នាឡិកាថេរ ➜ លទ្ធផលមិនអាស្រ័យលើម៉ោងដែលរត់ (មើល `HARNESS_CLOCK_START`)
    await page.clock.install({ time: HARNESS_CLOCK_START });
    await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
    await page.waitForTimeout(3000);
    return { ctx, page, errors };
}

const A = await session(oldSrv.port);
const B = await session(newSrv.port);

const a = { state: await A.page.evaluate(READ), errors: A.errors };
const b = { state: await B.page.evaluate(READ), errors: B.errors };

console.log('╔══════════════════════════════════════════════════════════════════════╗');
console.log('║  parity ជាមួយទិន្នន័យ ៖ ZoeW ដើម ធៀបនឹង ZoeW React                   ║');
console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

let bad = 0;
const keys = Object.keys(a.state);
for (const k of keys) {
    const x = JSON.stringify(a.state[k]);
    const y = JSON.stringify(b.state[k]);
    const ok = x === y;
    if (!ok) bad++;
    const shown = k === 'historyTable' || k === 'entryList' || k === 'lockerList'
        ? (ok ? `ដូចគ្នា (${String(a.state[k] || '').length} តួ)` : 'ខុសគ្នា')
        : String(a.state[k]);
    console.log(`${ok ? '✅' : '❌'} ${k.padEnd(28)} ${shown}`);
    if (!ok && (x || '').length < 400) {
        console.log(`      ដើម : ${x}`);
        console.log(`      ថ្មី : ${y}`);
    } else if (!ok) {
        const la = String(a.state[k] || '').split('\n');
        const lb = String(b.state[k] || '').split('\n');
        for (let i = 0; i < Math.max(la.length, lb.length); i++) {
            if (la[i] !== lb[i]) {
                console.log(`      ជួរទី ${i}\n        ដើម : ${String(la[i]).slice(0, 220)}\n        ថ្មី : ${String(lb[i]).slice(0, 220)}`);
                break;
            }
        }
    }
}

const noisy = (list) => list.filter((e) => !/favicon|sentry|gstatic|fonts\.googleapis|ERR_|Failed to fetch/i.test(e));
console.log(`\nកំហុស runtime ៖ ដើម ${noisy(a.errors).length} · ថ្មី ${noisy(b.errors).length}`);
noisy(b.errors).slice(0, 5).forEach((e) => console.log('   ថ្មី: ' + e));

/* ── ជំហានអន្តរកម្ម ─────────────────────────────────────────────────── */
console.log('\n── អន្តរកម្មជាបន្តបន្ទាប់ ──');
let stepBad = 0;
let vacuous = 0;
// ⛔ ជាន់អប្បបរមា ៖ ជំហានដែល **មិនប្តូរអេក្រង់សោះ** មិនបានវាស់អ្វីទេ។
//    ការអះអាង «ដូចគ្នា» លើអេក្រង់ដែលមិនប្រែ ពិតដោយស្វ័យប្រវត្តិ។
let prev = JSON.stringify(await A.page.evaluate(SNAPSHOT, { ui: INTENTIONAL_UI }));
for (const [label, fn] of STEPS.slice(1)) {
    // ⛔ ជំហានត្រូវជា **ការចុចរបស់អ្នកប្រើ** ប៉ុណ្ណោះ ៖ ការហៅ function
    //    តាម `window.<name>` ដើរតែលើ App ចាស់ (script សកល) ➜ វានឹងវាស់
    //    ភាពខុសគ្នារបស់ *ឧបករណ៍* មិនមែនរបស់ App។
    let okA = true;
    let okB = true;
    try { await fn(A.page, { timeout: 4000 }); } catch (e) { okA = false; }
    try { await fn(B.page, { timeout: 4000 }); } catch (e) { okB = false; }
    await A.page.waitForTimeout(1100);
    await B.page.waitForTimeout(1100);
    const sa = await A.page.evaluate(SNAPSHOT, { ui: INTENTIONAL_UI });
    const sb = await B.page.evaluate(SNAPSHOT, { ui: INTENTIONAL_UI });
    const keyA = JSON.stringify(sa);
    const same = keyA === JSON.stringify(sb);
    const changed = keyA !== prev;
    prev = keyA;
    // ⛔ ការចុចដែលធ្លាក់ **ទាំង ២ ខាង** មិនមែនជា parity ទេ — វាជាជំហានទទេ
    //    ដែលអះអាង «ដូចគ្នា» លើអេក្រង់ដែលមិនប្រែ ➜ រាយវាជាការធ្លាក់។
    const bothFailed = !okA && !okB;
    if (!changed) vacuous++;
    const stepOk = same && okA === okB && !bothFailed && changed;
    if (!stepOk) stepBad++;
    const note = bothFailed ? '⚠️ ការចុចមិនកើតទាំង ២ ខាង'
        : okA !== okB ? '⚠️ ការចុងធ្លាក់ម្ខាង'
        : changed ? 'អេក្រង់ប្រែ' : '⚠️ អេក្រង់មិនប្រែ';
    console.log(`${stepOk ? '✅' : '❌'} ${label.padEnd(30)} ធាតុ ${sb.elements}/${sa.elements}  ${note}`);
    if (!same) {
        const la = sa.tree.split('\n');
        const lb = sb.tree.split('\n');
        for (let i = 0; i < Math.max(la.length, lb.length); i++) {
            if (la[i] !== lb[i]) { console.log(`      ជួរទី ${i}\n        ដើម : ${String(la[i]).slice(0, 200)}\n        ថ្មី : ${String(lb[i]).slice(0, 200)}`); break; }
        }
    }
}

/* ── ការផ្ទៀងផ្ទាត់តារាងជាមួយទិន្នន័យ (ទំព័រស្កេន) ──────────────────── */
console.log('\n── តារាងទំព័រស្កេន (មានទិន្នន័យ) ──');
let tableBad = 0;
for (const [label, selector, field] of [
    ['បញ្ជីកញ្ចប់ថ្ងៃនេះ', '#pageTabEntry', 'entryList'],
    ['បញ្ជីតាម Locker', '#modeLockerBtn', 'lockerList']
]) {
    await A.page.click(selector);
    await B.page.click(selector);
    await A.page.waitForTimeout(900);
    await B.page.waitForTimeout(900);
    const ra = await A.page.evaluate(READ);
    const rb = await B.page.evaluate(READ);
    const same = JSON.stringify(ra[field]) === JSON.stringify(rb[field]);
    const size = String(ra[field] || '').length;
    // ⛔ ជាន់អប្បបរមា ៖ តារាងទទេ មិនបានវាស់អ្វីទេ
    const nonEmpty = size > 0;
    if (!same || !nonEmpty) tableBad++;
    console.log(`${same && nonEmpty ? '✅' : '❌'} ${label.padEnd(26)} ${nonEmpty ? size + ' តួ' : '⚠️ តារាងទទេ'}${same ? '' : '  ខុសគ្នា'}`);
    if (!same) {
        const la = String(ra[field] || '').split('\n');
        const lb = String(rb[field] || '').split('\n');
        for (let i = 0; i < Math.max(la.length, lb.length); i++) {
            if (la[i] !== lb[i]) { console.log(`      ជួរទី ${i}\n        ដើម : ${String(la[i]).slice(0, 220)}\n        ថ្មី : ${String(lb[i]).slice(0, 220)}`); break; }
        }
    }
}

const errA = noisy(A.errors);
const errB = noisy(B.errors);
console.log(`\nកំហុស runtime សរុប ៖ ដើម ${errA.length} · ថ្មី ${errB.length}`);
errB.slice(0, 5).forEach((e) => console.log('   ថ្មី: ' + e));

await browser.close();
oldSrv.server.close();
newSrv.server.close();
const failed = bad + stepBad + tableBad + errB.length;
console.log(`ជំហានដែលមិនប្តូរអេក្រង់ ៖ ${vacuous}/${STEPS.length - 1}`);
console.log(failed
    ? `\n❌ ភាពខុសគ្នា ៖ វាល ${bad} · ជំហាន ${stepBad} · តារាង ${tableBad} · កំហុស ${errB.length}`
    : `\n✅ គ្រប់វាល ${keys.length} · គ្រប់ជំហាន ${STEPS.length - 1} · គ្រប់តារាង ដូចគ្នាបេះបិទ`);
process.exit(failed ? 1 : 0);
