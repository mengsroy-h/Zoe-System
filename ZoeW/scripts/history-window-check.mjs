import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';
import { serveDir } from './serve.mjs';
import { FAKE_SDK, HARNESS_CLOCK_START, LICENSE_STUB, seedData } from './fake-firebase.mjs';
import { FAKE_BRIDGE, RESPOND_DEFAULT } from './fake-capacitor.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const supplied = process.env.ZOEW_HISTORY_TEST_DIST;
const OUT = supplied ? path.resolve(supplied) : path.join(ROOT, '.history-window-check-dist');
if (!supplied) execFileSync(process.execPath, [path.join(ROOT, 'node_modules/vite/bin/vite.js'), 'build', '--mode', 'android', '--outDir', OUT, '--logLevel', 'error'], {
    cwd: ROOT, stdio: 'inherit', env: { ...process.env, VITE_EXPOSE_GLOBALS: '1' }
});

const browser = await chromium.launch({ executablePath: process.env.ZOEW_TEST_BROWSER || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const srv = await serveDir(OUT);
const data = seedData();
const history = {};
for (let i = 0; i < 600; i++) history['window-' + i] = {
    id: 'window-' + i, phone: '099' + String(i).padStart(7, '0'), cod: i % 5 ? 5 : 0, dod: i % 3 ? 1 : 0, count: 1, isClosed: false,
    createdAt: HARNESS_CLOCK_START - 600000, scanDate: '2026-09-22', time: '10:00:00 (2026-09-22)',
    barcodes: [{ code: 'WINDOW' + i, cod: i % 5 ? 5 : 0, dod: i % 3 ? 1 : 0, isClosed: false, isDeducted: false }]
};
data.zoew_scan_history_cod_dod = history;
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 16; 24030PN60G) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Mobile Safari/537.36';
const IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const MODES = [
    { label: 'APK', native: true, ua: ANDROID_UA, windowed: true },
    { label: 'PWA Android', native: false, ua: ANDROID_UA, windowed: true },
    { label: 'PWA iPhone', native: false, ua: IOS_UA, windowed: false }
];
const failures = [];
const check = (label, value, detail) => {
    console.log((value ? '✅ ' : '❌ ') + label + (value ? '' : ' ' + JSON.stringify(detail)));
    if (!value) failures.push(label);
};
const frames = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const scrollToEnd = async (page) => {
    let last = '';
    for (let i = 0; i < 30; i++) {
        const mark = await page.evaluate(() => { const e = document.getElementById('tableResponsive'); e.scrollTop = e.scrollHeight;
            const ids = document.querySelectorAll('#historyTableBody tr[data-id]'); return e.scrollTop + ':' + e.scrollHeight + ':' + (ids.length ? ids[ids.length - 1].dataset.id : ''); });
        await frames(page);
        await page.waitForTimeout(80);
        if (mark === last) return;
        last = mark;
    }
};
const state = (page) => page.evaluate(() => {
    const scroller = document.getElementById('tableResponsive');
    const ids = Array.from(document.querySelectorAll('#historyTableBody tr[data-id]'), (r) => r.dataset.id);
    return { count: ids.length, first: ids[0], last: ids[ids.length - 1], top: scroller.scrollTop,
        loaded: Math.min(window.uiState.historyView.length, window.uiState.historyRenderLimit), total: window.uiState.historyView.length,
        more: !!document.querySelector('.history-more-btn') };
});

try {
    for (const mode of MODES) {
        const native = mode.native;
        const ctx = await browser.newContext({ viewport: { width: 414, height: 896 }, isMobile: true, hasTouch: true, userAgent: mode.ua });
        const page = await ctx.newPage();
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        await page.route('**', (r) => {
            if (r.request().url().includes('/license-verify.js')) return r.fulfill({ status: 200, contentType: 'application/javascript', body: LICENSE_STUB });
            return r.request().url().includes('127.0.0.1') ? r.continue() : r.abort();
        });
        if (native) {
            await page.addInitScript('(' + FAKE_BRIDGE.toString() + ')();');
            await page.addInitScript('(' + RESPOND_DEFAULT.toString() + ')();');
        }
        await page.addInitScript(() => {
            localStorage.setItem('zoew_firebase_config', JSON.stringify({ apiKey: 'k', databaseURL: 'https://fake-default-rtdb.firebaseio.com', projectId: 'p' }));
            localStorage.setItem('zoe_active_locker', 'A5');
        });
        await page.addInitScript('(' + FAKE_SDK.toString() + ')(' + JSON.stringify(data) + ');');
        await page.clock.setFixedTime(HARNESS_CLOCK_START);
        await page.goto('http://127.0.0.1:' + srv.port + '/index.html');
        await page.waitForFunction(() => window.uiState?.historyView?.length === 600 && document.querySelector('#historyTableBody tr[data-id]'));
        await page.waitForTimeout(700);
        await page.getByRole('button', { name: 'ទាំងអស់', exact: true }).click();
        await page.waitForTimeout(200);
        const initial = await state(page);
        check(mode.label + ' ៖ ផ្ទុក ៥០ ដំបូង និងរាប់ទិន្នន័យទាំង ៦០០', initial.loaded === 50 && initial.total === 600, initial);
        check('ជួរថ្មីបំផុតនៅកំពូល', initial.first === 'window-599', initial);
        for (let i = 0; i < 40 && (await state(page)).loaded < 600; i++) {
            await page.evaluate(() => { const e = document.getElementById('tableResponsive'); e.scrollTop = e.scrollHeight; });
            await page.waitForTimeout(100);
        }
        await scrollToEnd(page);
        let full = await state(page);
        check('រមូរជិតចុង ➜ ផ្ទុកគ្រប់ ៦០០ · ជួរចាស់បំផុតអាចមើលបាន · គ្មានប៊ូតុងបន្ថែម', full.loaded === 600 && full.last === 'window-0' && !full.more, full);
        check(mode.label + (mode.windowed ? ' ៖ DOM នៅតូចក្រោយរមូរដល់ចុង' : ' ៖ របៀបបន្ថែមជួរដើមនៅដដែល'), mode.windowed ? full.count <= 50 : full.count === 600, full);
        const gaps = [];
        for (const at of [0.3, 0.6, 0.9]) {
            await page.evaluate((f) => { const e = document.getElementById('tableResponsive'); e.scrollTop = Math.round((e.scrollHeight - e.clientHeight) * f); }, at);
            await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
            await page.waitForTimeout(60);
            gaps.push(await page.evaluate(() => {
                const e = document.getElementById('tableResponsive');
                const box = e.getBoundingClientRect();
                const head = e.querySelector('thead');
                const top = Math.max(box.top, head ? head.getBoundingClientRect().bottom : box.top);
                const rows = Array.from(document.querySelectorAll('#historyTableBody tr[data-id]'), (r) => r.getBoundingClientRect());
                if (!rows.length) return { blank: true };
                return { blank: rows[0].top > top + 1 || rows[rows.length - 1].bottom < box.bottom - 1, firstTop: Math.round(rows[0].top - top), lastBottom: Math.round(box.bottom - rows[rows.length - 1].bottom) };
            }));
        }
        check(mode.label + ' ៖ លោតទៅ ៣០% · ៦០% · ៩០% ➜ ជួរគ្របពេញផ្ទៃមើលឃើញ (គ្មានចន្លោះទទេ)', gaps.every((g) => !g.blank), gaps);
        await scrollToEnd(page);
        full = await state(page);
        const heights = await page.locator('#historyTableBody tr[data-id]').evaluateAll((rows) => Array.from(new Set(rows.map((r) => Math.round(r.getBoundingClientRect().height)))));
        check('ជួរដែលកម្ពស់ខុសគ្នាអាចរមូរដល់ចុង', heights.length > 1, heights);
        await page.evaluate(() => window.renderHistory([...window.uiState.historyView], window.uiState.historyViewKey));
        await page.waitForTimeout(250);
        const synced = await state(page);
        check('sync នៅចុងបញ្ជី ➜ ចំនួន និងទីតាំងនៅដដែល', synced.loaded === 600 && Math.abs(synced.top - full.top) < 2 && synced.last === full.last, { full, synced });
        await page.locator('#historyTableBody tr[data-id="window-0"] .count-badge-btn').click();
        await page.waitForTimeout(300);
        check('ចុចកញ្ចប់ចាស់បំផុត ➜ បញ្ជី barcode របស់ជួរត្រឹមត្រូវ', await page.evaluate(() => window.uiState.activeParentItemId === 'window-0' && document.getElementById('viewListModal').innerText.includes('WINDOW0')));
        await page.evaluate(() => window.closeModal('viewListModal'));
        await page.waitForTimeout(300);
        const beforeModal = await state(page);
        await page.evaluate(() => window.openRecentlyDeletedModal());
        await page.waitForTimeout(400);
        await page.evaluate(() => window.closeModal('recentlyDeletedModal'));
        await page.waitForTimeout(400);
        const afterModal = await state(page);
        check('បើក/បិទធុងសំរាម ➜ ទីតាំង និងជួរដដែល', Math.abs(afterModal.top - beforeModal.top) < 2 && afterModal.first === beforeModal.first && afterModal.last === beforeModal.last, { beforeModal, afterModal });
        await page.evaluate(() => window.openModalHelper('ztoListSyncModal'));
        await page.waitForTimeout(400);
        await page.evaluate(() => window.closeModal('ztoListSyncModal'));
        await page.waitForTimeout(400);
        const afterZto = await state(page);
        check('បើក/បិទបញ្ជី ZTO ➜ ទីតាំង និងជួរដដែល', Math.abs(afterZto.top - beforeModal.top) < 2 && afterZto.first === beforeModal.first && afterZto.last === beforeModal.last, { beforeModal, afterZto });
        await page.evaluate(() => { document.getElementById('tableResponsive').scrollTop = 0; });
        await page.waitForTimeout(250);
        const top = await state(page);
        check('រមូរត្រឡប់ទៅកំពូល ➜ ជួរថ្មីបំផុតត្រឡប់មក · ទិន្នន័យនៅគ្រប់ ៦០០', top.first === 'window-599' && top.loaded === 600, top);
        await page.evaluate(() => window.renderHistory(window.uiState.historyView, window.uiState.historyViewKey));
        await page.waitForTimeout(200);
        check('sync filter ដដែល ➜ មិនកាត់ចំនួនដែលផ្ទុករួច', (await state(page)).loaded === 600);
        await page.evaluate(() => {
            window.uiState.historyView[window.uiState.historyView.length - 1].phone = '0998888888';
            window.renderHistory(window.uiState.historyView, window.uiState.historyViewKey);
        });
        await page.waitForTimeout(250);
        check('កែទិន្នន័យក្នុងជួរដដែល ➜ React បង្ហាញលេខថ្មី', await page.locator('#historyTableBody tr[data-id="window-599"] .phone-title').innerText() === '0998888888');
        await scrollToEnd(page);
        await page.waitForTimeout(250);
        await page.evaluate(() => window.renderHistory(window.uiState.historyView, 'window-new-filter'));
        await page.waitForTimeout(250);
        const reset = await state(page);
        check(mode.label + ' ៖ filter ថ្មីពេលរមូរជ្រៅ ➜ ត្រឡប់ទៅ ៥០ជួរ នៅកំពូល (មិនផ្ទុកបន្ត)', reset.loaded === 50 && reset.top < 2 && reset.first === 'window-599', reset);
        await page.evaluate(() => document.activeElement && document.activeElement.blur());
        await page.waitForFunction(() => !window.uiState.dataPanelSearchFocus && !window.uiState.dataPanelCollapsed, null, { timeout: 3000 }).catch(() => null);
        await page.evaluate(() => { document.getElementById('appPages').scrollTop = 0; });
        await page.waitForTimeout(400);
        const glide = await page.evaluate(async () => {
            const glides = (el) => el.getAnimations().filter((a) => !(typeof CSSAnimation === 'function' && a instanceof CSSAnimation)
                && !(typeof CSSTransition === 'function' && a instanceof CSSTransition) && a.playState !== 'finished').length;
            const shift = (el) => { const m = new DOMMatrixReadOnly(getComputedStyle(el).transform === 'none' ? undefined : getComputedStyle(el).transform); return Math.round(Math.abs(m.m41) + Math.abs(m.m42)); };
            const main = document.getElementById('dataMainSection');
            const input = document.getElementById('searchPhoneInput');
            const card = input.closest('.app-card');
            const box = card.getBoundingClientRect();
            const before = { main: main.getBoundingClientRect().top, card: box.top, pulled: window.uiState.dataPanelSearchFocus,
                visible: box.top >= 0 && box.bottom <= window.innerHeight };
            input.focus();
            const during = { main: glides(main), card: glides(card), mainTop: main.getBoundingClientRect().top, cardTop: card.getBoundingClientRect().top };
            await new Promise((r) => setTimeout(r, 700));
            const after = { main: main.getBoundingClientRect().top, card: card.getBoundingClientRect().top, pulled: window.uiState.dataPanelSearchFocus,
                anims: glides(main) + glides(card), shift: shift(main) + shift(card) };
            input.blur();
            await new Promise((r) => setTimeout(r, 200));
            const down = { main: glides(main), card: glides(card), pulled: window.uiState.dataPanelSearchFocus };
            await new Promise((r) => setTimeout(r, 700));
            const rest = { main: main.getBoundingClientRect().top, anims: glides(main) + glides(card), shift: shift(main) + shift(card) };
            return { before, during, after, down, rest };
        });
        check(mode.label + ' ៖ ចុចស្វែងរកលេខ ➜ ផ្ទាំងហូតឡើងដោយរអិល (FLIP ពីទីតាំងចាស់ · មិនលោត) · ចប់ ➜ គ្មាន transform សល់',
            glide.before.visible && !glide.before.pulled && glide.after.pulled && Math.abs(glide.after.main - glide.before.main) > 20
                && glide.during.main > 0 && glide.during.card > 0 && Math.abs(glide.during.mainTop - glide.before.main) < 2 && Math.abs(glide.during.cardTop - glide.before.card) < 2
                && glide.after.anims === 0 && glide.after.shift === 0, glide);
        check(mode.label + ' ៖ ចាកចេញពីប្រអប់ស្វែងរកទទេ ➜ ផ្ទាំងចុះវិញដោយរអិល · ចប់ ➜ គ្មាន transform សល់',
            !glide.down.pulled && glide.down.main > 0 && glide.rest.anims === 0 && glide.rest.shift === 0, glide);
        const follow = await page.evaluate(async () => {
            const input = document.getElementById('searchPhoneInput');
            const card = input.closest('.app-card');
            const before = card.getBoundingClientRect().top;
            const samples = [];
            input.focus();
            const t0 = performance.now();
            await new Promise((done) => {
                const step = (now) => {
                    const box = document.getElementById('phoneSuggestBox');
                    const br = box ? box.getBoundingClientRect() : null;
                    const ir = input.getBoundingClientRect();
                    const pending = card.getAnimations().some((a) => a.pending);
                    samples.push({ t: now, pending, card: card.getBoundingClientRect().top, inputBottom: ir.bottom,
                        open: !!window.uiState.phoneSuggestOpen && !!br && br.height > 0, boxTop: br ? br.top : null,
                        opacity: box ? Number(getComputedStyle(box).opacity) : 1 });
                    if (now - t0 < 700) requestAnimationFrame(step); else done();
                };
                requestAnimationFrame(step);
            });
            const after = card.getBoundingClientRect().top;
            input.blur();
            await new Promise((r) => setTimeout(r, 1000));
            return { before, after, samples };
        });
        const dist = Math.abs(follow.before - follow.after);
        const open = follow.samples.filter((s) => s.open);
        const settledAt = follow.samples.find((s) => Math.abs(s.card - follow.after) <= 1);
        const openWhileMoving = open.filter((s) => Math.abs(s.card - follow.after) > 1).length;
        const firstOpen = open[0];
        const lastOpen = open[open.length - 1];
        const drop = firstOpen && lastOpen ? { first: Math.round(firstOpen.boxTop - firstOpen.inputBottom), last: Math.round(lastOpen.boxTop - lastOpen.inputBottom),
            opacity: firstOpen.opacity, wait: Math.round(firstOpen.t - settledAt.t) } : null;
        check(mode.label + ' ៖ ប្រអប់ phone suggestion ធ្លាក់ចុះតែក្រោយប្រអប់ស្វែងរកទៅដល់លើរួច (មិនបង្ហាញពេលកំពុងរអិល · ធ្លាក់ពីលើមកក្រោមប្រអប់)',
            dist > 20 && open.length >= 5 && openWhileMoving === 0 && !!drop && drop.wait <= 150 && Math.abs(drop.last - 4) <= 1
                && (drop.first < drop.last - 2 || drop.opacity < 0.95), { dist, openWhileMoving, drop });
        const steps = [];
        for (let i = 1; i < follow.samples.length; i++) {
            const a = follow.samples[i - 1], b = follow.samples[i];
            if (b.t - a.t <= 20 && !a.pending) steps.push(Math.round(Math.abs(b.card - a.card) / Math.max(1, dist) * 1000) / 1000);
        }
        const started = follow.samples.filter((s) => s.pending).length;
        check(mode.label + ' ៖ ចលនាស្វែងរកមិនលោត ៖ ស៊ុមនីមួយៗ (≤ 20ms · ចលនាចាប់ផ្តើមរួច) ផ្លាស់ទី ≤ ២០% នៃចម្ងាយ',
            dist > 20 && started >= 1 && steps.length >= 8 && Math.max(...steps) <= 0.2, { dist, started, steps });
        const stall = await page.evaluate(async () => {
            const input = document.getElementById('searchPhoneInput');
            const card = input.closest('.app-card');
            const before = card.getBoundingClientRect().top;
            input.focus();
            await new Promise((r) => requestAnimationFrame(r));
            const spin = performance.now();
            let spins = 0;
            while (performance.now() - spin < 120) spins++;
            const first = await new Promise((r) => requestAnimationFrame(() => r(card.getBoundingClientRect().top)));
            await new Promise((r) => setTimeout(r, 900));
            const rest = card.getBoundingClientRect().top;
            input.blur();
            await new Promise((r) => setTimeout(r, 1000));
            return { before, first, rest, spins: spins > 0, progress: Math.round((before - first) / Math.max(1, before - rest) * 100) / 100 };
        });
        check(mode.label + ' ៖ ស៊ុមកក ១២០ms ក្រោយចុច (iOS បើក keyboard) ➜ ចលនាមិនទាន់ចាប់ផ្តើម ➜ មើលឃើញពេញ (មិនលោតទៅចុង)',
            stall.before - stall.rest > 20 && stall.progress <= 0.2, stall);
        await page.evaluate(() => {
            window.__kb = [];
            window.addEventListener('resize', () => {
                const bar = document.getElementById('pageTabBar');
                const cs = getComputedStyle(bar);
                window.__kb.push({ h: window.innerHeight, hidden: document.body.classList.contains('chrome-hidden'), keyboard: document.body.classList.contains('keyboard-open'),
                    visibility: cs.visibility, transition: cs.transitionProperty });
            });
        });
        await page.evaluate(() => window.showAppChrome());
        await frames(page);
        await page.locator('#searchPhoneInput').focus();
        await page.setViewportSize({ width: 414, height: 896 - 330 });
        await page.waitForFunction(() => window.__kb.some((k) => k.h < 896), null, { timeout: 5000 }).catch(() => null);
        await frames(page);
        await page.setViewportSize({ width: 414, height: 896 });
        await page.waitForFunction(() => window.__kb.length && window.__kb[window.__kb.length - 1].h === 896, null, { timeout: 5000 }).catch(() => null);
        await frames(page);
        await page.evaluate(() => document.activeElement && document.activeElement.blur());
        const kb = await page.evaluate(() => window.__kb);
        const opened = kb.find((k) => k.h < 896) || {};
        const closed = kb.filter((k) => k.h === 896).pop() || {};
        if (native) check(mode.label + ' ៖ keyboard បើក ➜ របាលាក់ក្នុង resize ដដែល (មុនស៊ុមថ្មី · គ្មាន transition) · បិទ ➜ របាត្រឡប់',
            opened.keyboard && opened.hidden && opened.visibility === 'hidden' && opened.transition === 'none'
                && !closed.keyboard && !closed.hidden && closed.visibility === 'visible', kb);
        else check(mode.label + ' ៖ keyboard (គ្របពីលើ មិនប្តូរប្លង់) ➜ របាមិនប្រែ', kb.length >= 2 && kb.every((k) => !k.keyboard && !k.hidden && k.visibility === 'visible'), kb);
        for (const field of ['entryListSearchInput', 'lockerListSearchInput']) {
            await page.evaluate((f) => {
                document.activeElement && document.activeElement.blur();
                window.switchAppPage('entry');
                window.setEntryScanMode(f === 'lockerListSearchInput' ? 'locker' : 'parcel');
            }, field);
            await page.waitForTimeout(500);
            await page.evaluate(() => { document.getElementById('appPages').scrollTop = 0; });
            await page.waitForTimeout(300);
            const entry = await page.evaluate(async (f) => {
                const glides = (el) => el.getAnimations().filter((a) => !(typeof CSSAnimation === 'function' && a instanceof CSSAnimation)
                    && !(typeof CSSTransition === 'function' && a instanceof CSSTransition) && a.playState !== 'finished').length;
                const main = document.getElementById('entryMainSection');
                const input = document.getElementById(f);
                const before = { input: input.getBoundingClientRect().top, main: main.getBoundingClientRect().top, collapsed: window.uiState.entryPanelCollapsed };
                input.focus({ preventScroll: true });
                const during = { main: glides(main), mainTop: main.getBoundingClientRect().top };
                await new Promise((r) => setTimeout(r, 700));
                const after = { input: input.getBoundingClientRect().top, collapsed: window.uiState.entryPanelCollapsed, anims: glides(main) };
                input.blur();
                await new Promise((r) => setTimeout(r, 900));
                const rest = { collapsed: window.uiState.entryPanelCollapsed, anims: glides(main), main: main.getBoundingClientRect().top };
                return { before, during, after, rest, keyboardTop: window.innerHeight - 330 };
            }, field);
            check(mode.label + ' ៖ tab ស្កេន ៖ ចុចស្វែងរក (' + field + ') ➜ ផ្ទាំងស្កេនបង្រួមដោយរអិល · ប្រអប់ឡើងលើ (លទ្ធផលមិននៅក្រោម keyboard) · ចាកចេញទទេ ➜ បើកវិញ',
                !entry.before.collapsed && entry.after.collapsed && entry.during.main > 0
                    && Math.abs(entry.during.mainTop - entry.before.main) < 2 && entry.after.input < entry.before.input - 100 && entry.after.input < entry.keyboardTop - 300 && entry.after.anims === 0
                    && !entry.rest.collapsed && entry.rest.anims === 0 && Math.abs(entry.rest.main - entry.before.main) < 2, entry);
        }
        for (const field of ['entryListSearchInput', 'lockerListSearchInput']) {
            await page.evaluate((f) => {
                document.activeElement && document.activeElement.blur();
                window.switchAppPage('entry');
                window.setEntryScanMode(f === 'lockerListSearchInput' ? 'locker' : 'parcel');
            }, field);
            await page.waitForTimeout(500);
            await page.evaluate(() => { document.getElementById('appPages').scrollTop = 0; });
            await page.waitForTimeout(300);
            const emptyIcon = field === 'lockerListSearchInput' ? '#lockerListEmptyState .emoji' : '#entryListEmptyState .emoji';
            const opened = await page.evaluate(async ({ f, icon }) => {
                const input = document.getElementById(f);
                input.focus({ preventScroll: true });
                input.value = 'zz-no-such-row';
                input.dispatchEvent(new Event('input', { bubbles: true }));
                await new Promise((r) => setTimeout(r, 800));
                const el = document.querySelector(icon);
                const r = el ? el.getBoundingClientRect() : null;
                return { shown: !!r && r.height > 0, top: r ? Math.round(r.top) : null, collapsed: window.uiState.entryPanelCollapsed };
            }, { f: field, icon: emptyIcon });
            await page.setViewportSize({ width: 414, height: 896 - 330 });
            await page.waitForFunction(() => window.innerHeight === 896 - 330, null, { timeout: 5000 }).catch(() => null);
            await frames(page);
            await page.waitForTimeout(300);
            const shrunk = await page.evaluate((icon) => {
                const el = document.querySelector(icon);
                const r = el ? el.getBoundingClientRect() : null;
                return { top: r ? Math.round(r.top) : null, h: window.innerHeight };
            }, emptyIcon);
            await page.setViewportSize({ width: 414, height: 896 });
            await page.waitForFunction(() => window.innerHeight === 896, null, { timeout: 5000 }).catch(() => null);
            await page.evaluate((f) => {
                const input = document.getElementById(f);
                input.value = '';
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.blur();
            }, field);
            await page.waitForTimeout(1000);
            check(mode.label + ' ៖ tab ស្កេន ៖ ស្វែងរក (' + field + ') ឃើញសារទទេ ➜ keyboard បង្រួមផ្ទៃ ➜ សារនៅដដែលពីលើ keyboard (មិនលោតឡើងតាមក្រោយ)',
                opened.shown && opened.collapsed && shrunk.top !== null && Math.abs(shrunk.top - opened.top) <= 2 && shrunk.top < shrunk.h - 40, { opened, shrunk });
        }
        check('គ្មានកំហុស JavaScript', errors.length === 0, errors);
        await ctx.close();
    }
} finally {
    await browser.close();
    srv.server.close();
    if (!supplied) fs.rmSync(OUT, { recursive: true, force: true });
}
console.log('history-window-check ៖ ' + failures.length + ' FAIL');
process.exitCode = failures.length ? 1 : 0;
