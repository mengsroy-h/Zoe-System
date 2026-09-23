/**
 * វាស់ parity នៃ **DOM និង layout ពិត** ៖ បើក ZoeW ដើម និង ZoeW React
 * ក្នុង Chromium តែមួយ រួចប្រៀបធៀបដើមឈើធាតុ និងធរណីមាត្រដែលគណនាបាន។
 *
 * ⛔ ហេតុអ្វីត្រូវវាស់ក្នុង browser ៖ ការអានកូដមិនឆ្លើយថា «អ្នកប្រើឃើញ
 *    ដូចគ្នាឬអត់» ទេ។ ការវាស់ទើបជាភស្តុតាង។
 */
import { chromium } from 'playwright-core';
import { serveDir } from './serve.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveOldRoot } from './old-app.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OLD_DIR = resolveOldRoot(HERE);
const NEW_DIR = path.join(HERE, '..', 'dist');

const VIEWPORTS = [
    { name: 'ទូរស័ព្ទ  390×844', width: 390, height: 844 },
    { name: 'ថេប្លេត  800×1000', width: 800, height: 1000 },
    { name: 'Desktop 1440×900', width: 1440, height: 900 }
];

/** attribute ដែលរំពឹងថាខុស ៖ សកម្មភាពប្តូរពី delegation ➜ handler របស់ React */
const IGNORED_ATTRS = new Set(['data-act', 'data-args', 'data-a1', 'data-a2', 'data-evt', 'data-self', 'data-on']);

const FINGERPRINT = (ignored) => {
    const skip = new Set(ignored);
    const out = [];
    const walk = (el, depth) => {
        if (el.id === 'root' && el.tagName === 'DIV') { // ធាតុរុំរបស់ React
            for (const c of el.children) walk(c, depth);
            return;
        }
        if (el.tagName === 'SCRIPT' || el.tagName === 'LINK' || el.tagName === 'STYLE') return;
        // ⛔ React សរសេរ `style` ឡើងវិញពីវត្ថុ (`margin: 0px 2px`) ខណៈ HTML
        //    ដើមសរសេរ `margin:0 2px`។ តម្លៃ *ដូចគ្នា* ➜ ធ្វើទម្រង់ឲ្យដូចគ្នា
        //    មុនប្រៀបធៀប ដើម្បីកុំឲ្យភាពខុសគ្នាក្លែងក្លាយបាំងភាពខុសគ្នាពិត។
        // ⛔ ឲ្យ **browser ខ្លួនឯង** ធ្វើទម្រង់ ៖ `#ef4444` ➜ `rgb(239, 68, 68)`,
        //    `flex:1` ➜ `flex: 1 1 0%` ។ ទាំង ២ ខាងឆ្លងកាត់ CSSOM ដដែល ➜
        //    ភាពខុសគ្នាដែលនៅសល់ គឺ **ពិត** មិនមែនទម្រង់ការសរសេរ។
        const probe = document.createElement('div');
        const normStyle = (v) => {
            probe.style.cssText = '';
            probe.style.cssText = v;
            return Array.from(probe.style).map((prop) => prop + ':' + probe.style.getPropertyValue(prop)).sort().join(';');
        };
        const attrs = Array.from(el.attributes)
            .filter((a) => !skip.has(a.name))
            .map((a) => a.name + '=' + (a.name === 'style' ? normStyle(a.value) : a.value))
            .sort()
            .join('|');
        // អត្ថបទដែល *អ្នកប្រើឃើញ* ៖ ភ្ជាប់ text node ជាប់គ្នាមុនច្របាច់ចន្លោះ
        // (ចំនួន node មិនសំខាន់ — React អាចបំបែកវាជាច្រើន)។
        const ownText = Array.from(el.childNodes)
            .filter((n) => n.nodeType === 3)
            .map((n) => n.data)
            .join('')
            .replace(/\s+/g, ' ')
            .trim()
            // ⛔ ស្លាកកំណែខុសគ្នាដោយចេតនា (App ថ្មីមានកំណែថ្មី) ➜ ធ្វើឲ្យស្មើតែស្លាកនោះ
            .replace(/^(កំណែប្រព័ន្ធ: )\d+\.\d+\.\d+$/, '$1<កំណែ>');
        out.push(`${'  '.repeat(Math.min(depth, 12))}${el.tagName}[${attrs}]${ownText ? '::' + ownText : ''}`);
        for (const c of el.children) walk(c, depth + 1);
    };
    for (const c of document.body.children) walk(c, 0);
    return out;
};

const GEOMETRY = () => {
    const ids = ['appPages', 'pageData', 'pageEntry', 'pageTabBar', 'dataSideSection', 'dataMainSection',
        'entrySideSection', 'entryMainSection', 'tableResponsive', 'sideDrawer', 'bootSplash'];
    const sel = ['.app-navbar', '.page-main', '.page-side', '.app-card', '.stats-grid'];
    const read = (el, key) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return {
            key,
            rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
            display: cs.display, position: cs.position, order: cs.order,
            overflowY: cs.overflowY, flex: cs.flex, zIndex: cs.zIndex,
            fontSize: cs.fontSize, backgroundColor: cs.backgroundColor
        };
    };
    const out = [];
    for (const id of ids) out.push(read(document.getElementById(id), '#' + id));
    for (const s of sel) out.push(read(document.querySelector(s), s));
    out.push({ key: ':root --fs-unit', value: getComputedStyle(document.documentElement).getPropertyValue('--fs-unit').trim() });
    out.push({ key: 'body', ...read(document.body, 'body') });
    return out;
};

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const oldSrv = await serveDir(OLD_DIR);
const newSrv = await serveDir(NEW_DIR);

async function snapshot(port, viewport) {
    const ctx = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    // ⛔ ទប់ធនធានខាងក្រៅ ➜ ការវាស់មិនអាស្រ័យលើបណ្តាញ
    await page.route('**://*', (route) => {
        const u = route.request().url();
        return u.includes('127.0.0.1') || u.includes('localhost') ? route.continue() : route.abort();
    });
    await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' }).catch(() => {});
    await page.waitForTimeout(2200);
    const fingerprint = await page.evaluate(FINGERPRINT, [...IGNORED_ATTRS]);
    const geometry = await page.evaluate(GEOMETRY);
    await ctx.close();
    return { fingerprint, geometry };
}

let failures = 0;
console.log('╔══════════════════════════════════════════════════════════════════════╗');
console.log('║  parity នៃ DOM និង layout ៖ ZoeW ដើម ធៀបនឹង ZoeW React              ║');
console.log('╚══════════════════════════════════════════════════════════════════════╝\n');

for (const vp of VIEWPORTS) {
    const a = await snapshot(oldSrv.port, vp);
    const b = await snapshot(newSrv.port, vp);

    const diffs = [];
    const max = Math.max(a.fingerprint.length, b.fingerprint.length);
    for (let i = 0; i < max; i++) {
        if (a.fingerprint[i] !== b.fingerprint[i]) {
            diffs.push({ i, old: a.fingerprint[i], now: b.fingerprint[i] });
            if (diffs.length > 12) break;
        }
    }

    // ⛔ CSS minifier របស់ build សរសេរ `0.5px` ជា `.5px` — តម្លៃដដែល
    //    តាមស្តង់ដារ CSS ➜ ធ្វើឲ្យទម្រង់ដូចគ្នាមុនប្រៀបធៀប។
    const normalize = (s) => s.replace(/([\s(,+*\/-])0\.(\d)/g, '$1.$2');
    const geoDiffs = [];
    for (let i = 0; i < a.geometry.length; i++) {
        const x = normalize(JSON.stringify(a.geometry[i]));
        const y = normalize(JSON.stringify(b.geometry[i]));
        if (x !== y) geoDiffs.push({ key: (a.geometry[i] || {}).key, old: x, now: y });
    }

    const ok = diffs.length === 0 && geoDiffs.length === 0;
    if (!ok) failures++;
    console.log(`${ok ? '✅' : '❌'} ${vp.name}   ធាតុ ${b.fingerprint.length}/${a.fingerprint.length}  ·  layout ${a.geometry.length - geoDiffs.length}/${a.geometry.length}`);
    for (const d of diffs.slice(0, 8)) {
        console.log(`      ធាតុទី ${d.i}`);
        console.log(`        ដើម : ${String(d.old).slice(0, 150)}`);
        console.log(`        ថ្មី : ${String(d.now).slice(0, 150)}`);
    }
    for (const g of geoDiffs.slice(0, 8)) {
        console.log(`      layout ${g.key}`);
        console.log(`        ដើម : ${g.old.slice(0, 150)}`);
        console.log(`        ថ្មី : ${g.now.slice(0, 150)}`);
    }
}

await browser.close();
oldSrv.server.close();
newSrv.server.close();
console.log(failures ? `\n❌ មិនស៊ីគ្នា ${failures}/${VIEWPORTS.length} ទំហំអេក្រង់` : '\n✅ DOM និង layout ដូចគ្នាគ្រប់ទំហំអេក្រង់');
process.exit(failures ? 1 : 0);
