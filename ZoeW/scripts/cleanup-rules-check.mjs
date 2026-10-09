/**
 * វាស់ **ច្បាប់លុយ** ដោយការរត់ពិត ៖ «លុប» ទល់នឹង «ដក» និងការសម្អាតស្វ័យប្រវត្តិ
 * **២ ម៉ោង · ៧ ថ្ងៃ · ២ ថ្ងៃ · ៣០ ថ្ងៃ** (`CLAUDE.md` ៖ «តារាងសេណារីយ៉ូពេញលេញ» និង
 * «ការសម្អាតស្វ័យប្រវត្តិ»)។
 *
 * App ២ ត្រូវរត់លើទិន្នន័យ និងនាឡិកាដូចគ្នាបេះបិទ ៖
 *   ក. ZoeW React (web)
 *   ខ. ZoeW React (Android — build `--mode android` + bridge Capacitor ក្លែង)
 *
 * ការអះអាង ២ ជាន់ ៖
 *   ១. **ច្បាប់ដាច់ខាត** លើ App នីមួយៗ ៖ ទិន្នន័យឈរ **សងខាងព្រំដែន** (±១ នាទី) ➜ ខាងក្នុងនៅ ·
 *      ខាងក្រៅចេញ · `trashReason` · `isDeducted` · ledger (តារាងសេណារីយ៉ូ `CLAUDE.md`)
 *   ២. **parity** ៖ DB ចុងក្រោយរបស់ Android = web (ត្រាពេលវេលាថ្មីត្រូវធ្វើឲ្យស្មើ — ការប្រៀបធៀបគឺ
 *      *អ្វីផ្លាស់ទីទៅណា* និង *លុយ*) ➜ ផ្លូវ native មិនបង្កើតច្បាប់លុយទី ២
 *
 * ⛔ ព្រំដែន «> មិនមែន >=» (៧×២៤ ម៉ោងគត់ ➜ នៅក្នុងបញ្ជី) វាស់មិនបាននៅទីនេះ
 *    (នាឡិការំកិលពេល boot) ➜ `audit-tools/trash-modal-test.js` ចាក់សោវាតាមកូដ។
 *
 *   node scripts/cleanup-rules-check.mjs
 */
import { chromium } from 'playwright-core';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveDir } from './serve.mjs';
import { FAKE_SDK, HARNESS_CLOCK_START, LICENSE_STUB } from './fake-firebase.mjs';
import { FAKE_BRIDGE, RESPOND_DEFAULT } from './fake-capacitor.mjs';
import { SCROLL_PROBE, openMenuItem } from './menu-scroll.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const OUT = path.join(ROOT, '.rules-check-dist');
const CONFIG = JSON.stringify({ apiKey: 'k', databaseURL: 'https://fake-default-rtdb.firebaseio.com', projectId: 'p' });

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const NOW = HARNESS_CLOCK_START;
const TODAY = '2026-09-22';
const D15 = '2026-09-15';
const D14 = '2026-09-14';

/* ⛔ ព្រំដែនអានចេញពីកូដពិត — មិនមែនលេខថេរទី ២ */
const sessionSrc = fs.readFileSync(path.join(ROOT, 'src/features/session.ts'), 'utf8');
const readMs = (name) => {
    const m = sessionSrc.match(new RegExp('export const ' + name + ' = ([0-9 *]+);'));
    if (!m) throw new Error('រក ' + name + ' មិនឃើញ');
    return m[1].split('*').reduce((a, b) => a * Number(b.trim()), 1);
};
const TWO_HOURS = readMs('TWO_HOURS_MS');
const ABANDON = readMs('ABANDON_AGE_MS');
const EXPIRED_RETENTION = readMs('EXPIRED_TRASH_RETENTION_MS');
const TRASH_RETENTION = readMs('TRASH_RETENTION_MS');

function bc(code, cod, dod, { closed = false, closedAt, createdAt, day = TODAY } = {}) {
    return {
        code, cod, dod, locker: '', isClosed: closed, isDeducted: false, isFromDeletion: false,
        createdAt: createdAt || NOW - HOUR, time: `09:00:00 (${day})`, ...(closed ? { closedAt } : {})
    };
}
function item(id, phone, barcodes, { day = TODAY, createdAt = NOW - HOUR } = {}) {
    const cod = Math.round(barcodes.reduce((s, b) => s + b.cod, 0) * 100) / 100;
    const dod = Math.round(barcodes.reduce((s, b) => s + b.dod, 0) * 100) / 100;
    return {
        id, phone, cod, dod, price: Math.round((cod + dod) * 100) / 100, count: barcodes.length,
        isClosed: barcodes.every((b) => b.isClosed), isCalled: false, barcodes,
        time: `08:00:00 (${day})`, scanDate: day, createdAt
    };
}
function trash(id, phone, reason, deletedAt, code, cod) {
    const it = item(id, phone, [bc(code, cod, 0, { closed: reason === 'pickup', closedAt: deletedAt - HOUR })], { createdAt: deletedAt - DAY });
    if (reason === 'remove' || reason === 'expired') it.barcodes.forEach((b) => { b.isDeducted = true; });
    return Object.assign(it, { trashReason: reason, deletedAt, isFromDeletion: reason === 'delete' || reason === 'pickup' });
}

function seed() {
    const history = {
        hPickOut: item('hPickOut', '0101', [bc('PO1', 10, 1, { closed: true, closedAt: NOW - TWO_HOURS - MIN })], { createdAt: NOW - 3 * HOUR }),
        hPickIn: item('hPickIn', '0102', [bc('PI1', 11, 0, { closed: true, closedAt: NOW - TWO_HOURS + MIN })], { createdAt: NOW - 3 * HOUR }),
        hExpOut: item('hExpOut', '0103', [bc('EO1', 20, 2, { createdAt: NOW - ABANDON - MIN, day: D15 })], { day: D15, createdAt: NOW - ABANDON - MIN }),
        hExpIn: item('hExpIn', '0104', [bc('EI1', 13, 0, { createdAt: NOW - ABANDON + MIN, day: D15 })], { day: D15, createdAt: NOW - ABANDON + MIN }),
        hMixed: item('hMixed', '0105', [
            bc('M1', 5, 0, { closed: true, closedAt: NOW - 3 * HOUR, createdAt: NOW - 8 * DAY, day: D14 }),
            bc('M2', 7, 1, { createdAt: NOW - 8 * DAY, day: D14 })
        ], { day: D14, createdAt: NOW - 8 * DAY }),
        hDel: item('hDel', '0106', [bc('MD1', 3, 0)]),
        hRem: item('hRem', '0107', [bc('MR1', 4, 0.5), bc('MR2', 6, 0)])
    };
    const deleted = {
        tExpOut: trash('tExpOut', '0201', 'expired', NOW - EXPIRED_RETENTION - MIN, 'TEO', 1),
        tExpIn: trash('tExpIn', '0202', 'expired', NOW - EXPIRED_RETENTION + MIN, 'TEI', 1),
        tDelOut: trash('tDelOut', '0203', 'delete', NOW - TRASH_RETENTION - MIN, 'TDO', 1),
        tDelIn: trash('tDelIn', '0204', 'delete', NOW - TRASH_RETENTION + MIN, 'TDI', 1),
        tRemOut: trash('tRemOut', '0205', 'remove', NOW - TRASH_RETENTION - MIN, 'TRO', 1),
        tRemMid: trash('tRemMid', '0206', 'remove', NOW - 3 * DAY, 'TRM', 1),
        tPickOut: trash('tPickOut', '0207', 'pickup', NOW - TRASH_RETENTION - MIN, 'TPO', 1),
        tPickMid: trash('tPickMid', '0208', 'pickup', NOW - 3 * DAY, 'TPM', 1)
    };
    const registry = {};
    for (const it of [...Object.values(history), ...Object.values(deleted)]) for (const b of it.barcodes) registry[b.code] = it.id;
    return {
        zoew_scan_history_cod_dod: history,
        zoew_recently_deleted_cod_dod: deleted,
        zoew_daily_revenue_cod_dod: {
            [TODAY]: { codDollar: 100, dodDollar: 10, totalCount: 20 },
            [D15]: { codDollar: 50, dodDollar: 5, totalCount: 5 },
            [D14]: { codDollar: 40, dodDollar: 4, totalCount: 4 }
        },
        zoew_monthly_revenue_cod_dod: { '2026-09': { codDollar: 190, dodDollar: 19, totalCount: 29 } },
        zoew_daily_pickup_cod_dod: { [TODAY]: { packagesPickedUp: 2, pickedUpPhones: { '0101': 1, '0102': 1 }, pickedUpBarcodes: { PO1: '0101', PI1: '0102' } } },
        zoew_settings: { exchange_rate: 4100 },
        zoew_barcode_registry: registry
    };
}

/* ── build React (web · Android) ─────────────────────────────────────── */
const vite = path.join(ROOT, 'node_modules/vite/bin/vite.js');
fs.rmSync(OUT, { recursive: true, force: true });
execFileSync(process.execPath, [vite, 'build', '--outDir', path.join(OUT, 'web'), '--logLevel', 'error'], { cwd: ROOT, stdio: 'inherit' });
execFileSync(process.execPath, [vite, 'build', '--mode', 'android', '--outDir', path.join(OUT, 'android'), '--logLevel', 'error'], { cwd: ROOT, stdio: 'inherit' });

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const T = 5000;
const tick = async (p, ms = 400) => { await p.clock.runFor(ms); await p.waitForTimeout(60); };
const click = async (p, sel) => { await p.click(sel, { timeout: T }); await tick(p); };
const row = (text) => `#historyTableBody tr:has-text("${text}")`;
/** ⛔ ម៉ឺនុយ (...) ឆ្លង `openMenuItem()` ៖ scroll-snap របស់ browser បិទវាតាមម៉ោងពិត (`menu-scroll.mjs`) */
const menuReopens = [];
const menuItem = async (p, label, opener, item) => {
    const attempts = await openMenuItem(p, opener, item, { tick, timeout: T });
    if (attempts > 1) menuReopens.push(label + ' ×' + attempts);
    await tick(p);
};

async function run(label, dir, native) {
    const srv = await serveDir(dir);
    const ctx = await browser.newContext({ viewport: { width: 414, height: 896 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e.message)));
    page.on('dialog', (d) => d.accept());
    await page.route('**', (r) => {
        const u = r.request().url();
        if (u.includes('/license-verify.js')) return r.fulfill({ status: 200, contentType: 'application/javascript', body: LICENSE_STUB });
        return u.includes('127.0.0.1') ? r.continue() : r.abort();
    });
    await page.addInitScript(`window.addEventListener('unhandledrejection', (e) => { (window.__rejections ||= []).push(String((e.reason && e.reason.message) || e.reason)); });`);
    await page.addInitScript(SCROLL_PROBE);
    if (native) {
        await page.addInitScript('(' + FAKE_BRIDGE.toString() + ')();');
        await page.addInitScript('(' + RESPOND_DEFAULT.toString() + ')();');
    }
    await page.addInitScript(`window.localStorage.setItem('zoew_firebase_config', ${JSON.stringify(CONFIG)});`);
    await page.addInitScript("window.localStorage.setItem('zoe_active_locker', 'A5');");
    await page.addInitScript('(' + FAKE_SDK.toString() + ')(' + JSON.stringify(seed()) + ');');
    await page.clock.install({ time: NOW });
    await page.goto(`http://127.0.0.1:${srv.port}/index.html`, { waitUntil: 'load' });
    await page.waitForTimeout(3500);
    await page.clock.pauseAt(NOW + 20000);
    await tick(page, 3000);
    const afterBoot = await page.evaluate(() => window.__fakeDump());

    /* ដោយដៃ ៖ លុប 0106 · ដក MR1 · ស្តារ MR1 · ស្តារ 0106 */
    const steps = [];
    const step = async (name, fn) => {
        try { await fn(); steps.push({ name, db: await page.evaluate(() => window.__fakeDump()) }); }
        catch (e) { steps.push({ name, error: String(e.message).split('\n')[0] }); }
    };
    await click(page, '#btnFilterAll');
    await step('លុប 0106', async () => {
        await menuItem(page, label + ' ៖ លុប 0106', `${row('0106')} .more-btn`, '#menuContentContainer [data-act="moreMenuDelete"]');
        await tick(page, 800);
    });
    await step('ដក MR1', async () => {
        await click(page, '#pageTabEntry');
        await click(page, '#modeRemoveBtn');
        await page.fill('#hwScannerInput', 'MR1', { timeout: T });
        await click(page, '.btn-submit-barcode');
        await click(page, '#scanRemoveConfirmBtn');
        await tick(page, 800);
        await click(page, '#modeParcelBtn');
        await click(page, '#pageTabData');
    });
    const restore = (phone) => async () => {
        await menuItem(page, label + ' ៖ ស្តារ ' + phone, '.header-more-btn', '#menuContentContainer [data-act="moreMenuRecentlyDeleted"]');
        await click(page, `#deletedTableBody tr:has-text("${phone}") .trash-restore-btn`);
        await click(page, '#restoreConfirmBtn');
        await tick(page, 800);
        await click(page, '#recentlyDeletedModal .btn-cancel');
    };
    await step('ស្តារ MR1 (0107)', restore('0107'));
    await step('ស្តារ 0106', restore('0106'));

    const rejections = await page.evaluate(() => window.__rejections || []);
    await ctx.close();
    srv.server.close();
    return { label, afterBoot, steps, errors: [...errors, ...rejections] };
}

/* ── ជំនួយអាន DB ─────────────────────────────────────────────────────── */
const trashOf = (db) => Object.values(db.zoew_recently_deleted_cod_dod || {});
const histOf = (db) => db.zoew_scan_history_cod_dod || {};
const trashWith = (db, code) => trashOf(db).find((t) => (t.barcodes || []).some((b) => b && b.code === code));
const ledger = (db, day) => (db.zoew_daily_revenue_cod_dod || {})[day] || {};
const month = (db) => (db.zoew_monthly_revenue_cod_dod || {})['2026-09'] || {};
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
/** ⛔ `isDeducted` ឈរលើ **barcode** (វាលតែមួយដែលកំណត់លុយ) មិនមែនលើធាតុធុងសំរាម */
const deducted = (t) => !!t && (t.barcodes || []).length > 0 && t.barcodes.every((b) => b && b.isDeducted === true);
const notDeducted = (t) => !!t && (t.barcodes || []).every((b) => b && !b.isDeducted);
const histHas = (db, code) => Object.values(histOf(db)).some((it) => (it.barcodes || []).some((b) => b && b.code === code));

let passes = 0;
const fails = [];
const ok = (label, cond, got) => {
    if (cond) passes++;
    else fails.push(label + (got !== undefined ? '  ➜ ' + JSON.stringify(got) : ''));
    console.log(`   ${cond ? '✅' : '❌'} ${label}${cond || got === undefined ? '' : '  ➜ ' + JSON.stringify(got)}`);
};

function assertRules(res) {
    const S = seed();
    const db = res.afterBoot;
    console.log(`\n── ${res.label} ──`);
    // ២ ម៉ោង
    const po = trashWith(db, 'PO1');
    ok('២ ម៉ោង ៖ barcode បិទ ២ម៉ោង+១នាទី ➜ ធុងសំរាម «យករួច» (pickup)', !histHas(db, 'PO1') && po && po.trashReason === 'pickup', po && po.trashReason);
    ok('២ ម៉ោង ៖ «យករួច» មិនដកលុយ (isDeducted មិនពិត · isFromDeletion ពិត)', notDeducted(po) && po.isFromDeletion === true, po && [po.barcodes.map((b) => b.isDeducted), po.isFromDeletion]);
    ok('២ ម៉ោង ៖ barcode បិទ ២ម៉ោង−១នាទី ➜ នៅក្នុងបញ្ជី', histHas(db, 'PI1') && !trashWith(db, 'PI1'));
    // ៧ ថ្ងៃ
    const eo = trashWith(db, 'EO1');
    ok('៧ ថ្ងៃ ៖ មិនទាន់យក ៧×២៤ម៉ោង+១នាទី ➜ ធុងសំរាម «ផុតកំណត់» (expired)', !histHas(db, 'EO1') && eo && eo.trashReason === 'expired', eo && eo.trashReason);
    ok('៧ ថ្ងៃ ៖ «ផុតកំណត់» ដកលុយ (isDeducted ពិត · isFromDeletion មិនពិត)', deducted(eo) && !eo.isFromDeletion, eo && [eo.barcodes.map((b) => b.isDeducted), eo.isFromDeletion]);
    ok('៧ ថ្ងៃ ៖ ៧×២៤ម៉ោង−១នាទី ➜ នៅក្នុងបញ្ជី (ថ្ងៃទី ៨ ទើបចេញ)', histHas(db, 'EI1') && !trashWith(db, 'EI1'));
    // កញ្ចប់លាយ
    const m1 = trashWith(db, 'M1');
    const m2 = trashWith(db, 'M2');
    ok('កញ្ចប់លាយ ៖ A (បិទ) ➜ «យករួច» តែឯង · មិនដកលុយ', m1 && m1.trashReason === 'pickup' && notDeducted(m1) && m1.barcodes.length === 1, m1 && [m1.trashReason, m1.barcodes.map((b) => b.isDeducted), m1.barcodes.length]);
    ok('កញ្ចប់លាយ ៖ B (បើក) ➜ «ផុតកំណត់» តែឯង · ដកលុយ', m2 && m2.trashReason === 'expired' && deducted(m2) && m2.barcodes.length === 1, m2 && [m2.trashReason, m2.barcodes.map((b) => b.isDeducted), m2.barcodes.length]);
    // ledger
    const l15a = ledger(S, D15), l15b = ledger(db, D15);
    ok(`ledger ${D15} ៖ ដកតែ EO1 (COD −20 · DOD −2 · កញ្ចប់ −1)`,
        r2(l15a.codDollar - l15b.codDollar) === 20 && r2(l15a.dodDollar - l15b.dodDollar) === 2 && (l15a.totalCount - l15b.totalCount) === 1,
        [r2(l15a.codDollar - l15b.codDollar), r2(l15a.dodDollar - l15b.dodDollar), l15a.totalCount - l15b.totalCount]);
    const l14a = ledger(S, D14), l14b = ledger(db, D14);
    ok(`ledger ${D14} ៖ ដកតែ M2 (COD −7 · DOD −1 · កញ្ចប់ −1) — M1 មិនប៉ះ`,
        r2(l14a.codDollar - l14b.codDollar) === 7 && r2(l14a.dodDollar - l14b.dodDollar) === 1 && (l14a.totalCount - l14b.totalCount) === 1,
        [r2(l14a.codDollar - l14b.codDollar), r2(l14a.dodDollar - l14b.dodDollar), l14a.totalCount - l14b.totalCount]);
    const lt = ledger(db, TODAY);
    ok(`ledger ${TODAY} ៖ ការសម្អាត ២ ម៉ោង មិនប៉ះ`, r2(lt.codDollar) === 100 && r2(lt.dodDollar) === 10 && lt.totalCount === 20, lt);
    const mo = month(db);
    ok('ledger ខែ ៖ ដក EO1 + M2 (COD −27 · DOD −3 · កញ្ចប់ −2)', r2(190 - mo.codDollar) === 27 && r2(19 - mo.dodDollar) === 3 && (29 - mo.totalCount) === 2, mo);
    // ២ ថ្ងៃ · ៣០ ថ្ងៃ
    const present = (id) => !!(db.zoew_recently_deleted_cod_dod || {})[id];
    ok('២ ថ្ងៃ ៖ «ផុតកំណត់» ក្នុងធុងសំរាម ២ថ្ងៃ+១នាទី ➜ លុបអចិន្ត្រៃយ៍', !present('tExpOut'));
    ok('២ ថ្ងៃ ៖ «ផុតកំណត់» ២ថ្ងៃ−១នាទី ➜ នៅ', present('tExpIn'));
    ok('៣០ ថ្ងៃ ៖ «លុប» ៣០ថ្ងៃ+១នាទី ➜ លុបអចិន្ត្រៃយ៍', !present('tDelOut'));
    ok('៣០ ថ្ងៃ ៖ «លុប» ៣០ថ្ងៃ−១នាទី ➜ នៅ', present('tDelIn'));
    ok('៣០ ថ្ងៃ ៖ «ដក» ៣០ថ្ងៃ+១នាទី ➜ លុបអចិន្ត្រៃយ៍ · «ដក» ៣ ថ្ងៃ ➜ នៅ (មិនមែនច្បាប់ ២ ថ្ងៃ)', !present('tRemOut') && present('tRemMid'));
    ok('៣០ ថ្ងៃ ៖ «យករួច» ៣០ថ្ងៃ+១នាទី ➜ លុបអចិន្ត្រៃយ៍ · «យករួច» ៣ ថ្ងៃ ➜ នៅ', !present('tPickOut') && present('tPickMid'));
    const reg = db.zoew_barcode_registry || {};
    ok('ការលុបអចិន្ត្រៃយ៍ ៖ ដោះកូនសោ registry (TEO · TDO · TRO · TPO) · ធាតុដែលនៅ រក្សា (TEI · TDI)', !reg.TEO && !reg.TDO && !reg.TRO && !reg.TPO && !!reg.TEI && !!reg.TDI,
        { TEO: reg.TEO, TDO: reg.TDO, TRO: reg.TRO, TPO: reg.TPO, TEI: reg.TEI, TDI: reg.TDI });
    ok('ការលុបអចិន្ត្រៃយ៍ មិនប៉ះ ledger', r2(ledger(db, TODAY).codDollar) === 100);

    // ដោយដៃ
    const st = Object.fromEntries(res.steps.map((s) => [s.name, s]));
    for (const s of res.steps) ok(`ជំហាន «${s.name}» រត់ចប់`, !s.error, s.error);
    const d1 = st['លុប 0106'] && st['លុប 0106'].db;
    if (d1) {
        const md = trashWith(d1, 'MD1');
        ok('លុប ៖ ធុងសំរាម «លុប» · isFromDeletion ពិត · មិនដកលុយ', md && md.trashReason === 'delete' && md.isFromDeletion === true && notDeducted(md), md && [md.trashReason, md.isFromDeletion, md.barcodes.map((b) => b.isDeducted)]);
        ok('លុប ៖ ledger ថ្ងៃនេះមិនប៉ះ', r2(ledger(d1, TODAY).codDollar) === 100 && r2(ledger(d1, TODAY).dodDollar) === 10 && ledger(d1, TODAY).totalCount === 20, ledger(d1, TODAY));
    }
    const d2 = st['ដក MR1'] && st['ដក MR1'].db;
    if (d2) {
        const mr = trashWith(d2, 'MR1');
        ok('ដក ៖ ធុងសំរាម «ដក» មានតែ MR1 · isDeducted ពិត · isFromDeletion មិនពិត', mr && mr.trashReason === 'remove' && deducted(mr) && !mr.isFromDeletion && mr.barcodes.length === 1, mr && [mr.trashReason, mr.barcodes.map((b) => b.isDeducted), mr.isFromDeletion, mr.barcodes.length]);
        const lt2 = ledger(d2, TODAY);
        ok('ដក ៖ ledger ថ្ងៃនេះ COD −4 · DOD −0.5 · កញ្ចប់ −1', r2(100 - lt2.codDollar) === 4 && r2(10 - lt2.dodDollar) === 0.5 && 20 - lt2.totalCount === 1, lt2);
        const rest = Object.values(histOf(d2)).find((it) => it.phone === '0107');
        ok('ដក ៖ MR2 នៅក្នុងប្រវត្តិ · លុយសរុបរបស់ជួរដេក = MR2 (6)', rest && rest.barcodes.length === 1 && rest.barcodes[0].code === 'MR2' && r2(rest.cod) === 6, rest && [rest.barcodes.map((b) => b.code), rest.cod]);
    }
    const d3 = st['ស្តារ MR1 (0107)'] && st['ស្តារ MR1 (0107)'].db;
    if (d3) {
        const lt3 = ledger(d3, TODAY);
        ok('ស្តារ «ដក» ៖ បូកលុយត្រឡប់ (COD 100 · DOD 10 · កញ្ចប់ 20)', r2(lt3.codDollar) === 100 && r2(lt3.dodDollar) === 10 && lt3.totalCount === 20, lt3);
        ok('ស្តារ «ដក» ៖ MR1 ត្រឡប់ចូលប្រវត្តិ · ចេញពីធុងសំរាម', histHas(d3, 'MR1') && !trashWith(d3, 'MR1'));
        const mr1 = Object.values(histOf(d3)).flatMap((it) => it.barcodes || []).find((b) => b && b.code === 'MR1');
        ok('ស្តារ «ដក» ៖ isDeducted របស់ MR1 ត្រូវ reset', mr1 && !mr1.isDeducted, mr1 && mr1.isDeducted);
    }
    const d4 = st['ស្តារ 0106'] && st['ស្តារ 0106'].db;
    if (d4) {
        const lt4 = ledger(d4, TODAY);
        ok('ស្តារ «លុប» ៖ មិនប៉ះលុយ (COD 100 · DOD 10 · កញ្ចប់ 20)', r2(lt4.codDollar) === 100 && r2(lt4.dodDollar) === 10 && lt4.totalCount === 20, lt4);
        ok('ស្តារ «លុប» ៖ MD1 ត្រឡប់ចូលប្រវត្តិ', histHas(d4, 'MD1') && !trashWith(d4, 'MD1'));
    }
    ok('គ្មានកំហុស runtime', res.errors.length === 0, res.errors);
}

/** ធ្វើឲ្យត្រាពេលវេលាដែល App បោះ **ថ្មី** ស្មើ ➜ ប្រៀបធៀប *អ្វីផ្លាស់ទីទៅណា* និង *លុយ* */
function normalize(db) {
    const trashIn = db.zoew_recently_deleted_cod_dod || {};
    const rekey = {};
    const trashLabel = {};
    for (const [k, t] of Object.entries(trashIn)) {
        if (!/^id_/.test(k)) { rekey[k] = t; continue; }
        const codes = (t.barcodes || []).map((b) => b && b.code).join(',');
        trashLabel[k] = '<ថ្មី:' + t.trashReason + ':' + codes + '>';
        rekey[trashLabel[k]] = Object.assign({}, t, { id: '<id>' });
    }
    db = Object.assign({}, db, { zoew_recently_deleted_cod_dod: rekey });
    const seededDedStamps = new Set();
    JSON.stringify(seed(), (k, v) => { if (typeof v === 'number' && /At$/.test(k)) seededDedStamps.add(v); return v; });
    // សោដក `ded/<trashId>` (2.50.49) ៖ id ធុងសំរាមថ្មី និង `at` (= `deletedAt`) ថ្មីរាល់ដង ➜ ប្តូរឈ្មោះតាមធុងសំរាមដែលវាចង្អុល · ⛔ cod · dod · count · back · undo ប្រៀបធៀបដដែល
    const normalizeDed = (ded) => {
        if (!ded || typeof ded !== 'object') return ded;
        const out = {};
        for (const [trashId, entry] of Object.entries(ded)) {
            const key = /^id_/.test(trashId) ? (trashLabel[trashId] || '<ded:គ្មានធុងសំរាម>') : trashId;
            out[key] = entry && typeof entry === 'object' && typeof entry.at === 'number' && !seededDedStamps.has(entry.at)
                ? Object.assign({}, entry, { at: '<ថ្មី>' })
                : entry;
        }
        return out;
    };
    // token `op` និង ring `ops` របស់ runLedgerTransaction() ជាអត្តសញ្ញាណការសរសេរ (ថ្មីរាល់ដង) មិនមែនលុយ ➜ ដកតែលើ record ledger ដែលមានរូបរាង token ពិត
    for (const node of ['zoew_daily_revenue_cod_dod', 'zoew_monthly_revenue_cod_dod']) {
        const map = db[node];
        if (!map || typeof map !== 'object') continue;
        const clean = {};
        for (const [k, rec] of Object.entries(map)) {
            if (rec && typeof rec === 'object' && typeof rec.op === 'string' && /^op_[a-z0-9]{8,}$/.test(rec.op)) {
                const rest = Object.assign({}, rec);
                delete rest.op;
                if (rest.ops && typeof rest.ops === 'object' && Object.keys(rest.ops).every((key) => /^op_[a-z0-9]{8,}$/.test(key))) delete rest.ops;
                if (rest.ded) rest.ded = normalizeDed(rest.ded);
                clean[k] = rest;
            } else clean[k] = rec && typeof rec === 'object' && rec.ded ? Object.assign({}, rec, { ded: normalizeDed(rec.ded) }) : rec;
        }
        db = Object.assign({}, db, { [node]: clean });
    }
    const seededStamps = new Set();
    JSON.stringify(seed(), (k, v) => { if (typeof v === 'number' && /At$/.test(k)) seededStamps.add(v); return v; });
    return JSON.parse(JSON.stringify(db, (k, v) => {
        if (typeof v === 'number' && /At$/.test(k) && !seededStamps.has(v)) return '<ថ្មី>';
        if ((k === 'time' || k === 'deletedTime') && typeof v === 'string' && !/^0[89]:00:00/.test(v)) return '<ថ្មី>';
        if (typeof v === 'string' && /^id_\d+_[a-z0-9]+$/.test(v)) return '<id>';
        if (k === 'restoreClaim' || k === 'restoreClaimId' || k === 'restoreClaimToken' || k === 'clearClaim') return '<claim>';
        return v;
    }));
}
function diffPaths(a, b, p = '') {
    if (JSON.stringify(a) === JSON.stringify(b)) return [];
    if (a && b && typeof a === 'object' && typeof b === 'object') {
        const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
        return keys.flatMap((k) => diffPaths(a[k], b[k], p ? p + '/' + k : k));
    }
    return [p + ' ៖ ' + JSON.stringify(a) + ' ≠ ' + JSON.stringify(b)];
}

const results = [];
results.push(await run('ក. ZoeW React — web', path.join(OUT, 'web'), false));
results.push(await run('ខ. ZoeW React — Android (bridge Capacitor ក្លែង)', path.join(OUT, 'android'), true));
await browser.close();
fs.rmSync(OUT, { recursive: true, force: true });

console.log(`ព្រំដែនដែលអានពីកូដ ៖ ២ម៉ោង=${TWO_HOURS / HOUR}h · ផុតកំណត់=${ABANDON / DAY}d · ធុងសំរាម expired=${EXPIRED_RETENTION / DAY}d · ផ្សេង=${TRASH_RETENTION / DAY}d`);
for (const res of results) assertRules(res);

console.log('\n── parity ៖ DB ចុងក្រោយ Android ធៀបនឹង web ──');
const web = results[0];
for (const res of results.slice(1)) {
    const phases = [['ក្រោយការសម្អាតពេលផ្ទុក', web.afterBoot, res.afterBoot],
        ...web.steps.map((s, i) => ['ក្រោយ «' + s.name + '»', s.db, res.steps[i] && res.steps[i].db])];
    for (const [name, a, b] of phases) {
        const d = a && b ? diffPaths(normalize(a), normalize(b)) : ['ខ្វះ DB'];
        ok(`${res.label} ៖ ${name} = web`, d.length === 0, d.slice(0, 4));
    }
}

if (menuReopens.length) console.log(`\nℹ️  ម៉ឺនុយ (...) ត្រូវ scroll-snap របស់ browser បិទ ➜ បើកម្តងទៀត ៖ ${menuReopens.join(' · ')}`);
console.log(`\n${fails.length ? '❌' : '✅'} cleanup-rules-check — ${passes} ok, ${fails.length} FAIL`);
process.exitCode = fails.length ? 1 : 0;
