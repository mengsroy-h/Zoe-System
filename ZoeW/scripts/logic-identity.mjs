/**
 * ភាពដូចគ្នានៃ **តក្កវិជ្ជា** ៖ function នីមួយៗក្នុង App ថ្មី ធៀបនឹង `app.js` ដើម
 * **តាម token** (មិនមែនតាមឈ្មោះ)។
 *
 * ⛔ ហេតុអ្វី ៖ parity ស្តាទិចរាប់ថា function **មានឈ្មោះ** ១០០% — វាមិនប្រាប់ថា
 *    **តួ** នៅដដែលឬអត់ទេ។ ឧបករណ៍នេះ ៖
 *    ១. បញ្ជូនទាំង ២ ខាងតាម esbuild ដូចគ្នា (printer តែមួយ ➜ វង់ក្រចក · សញ្ញាសម្រង់)
 *    ២. ធ្វើឲ្យស្មើតែការប្តូររបស់ codemod ដែល **មេកានិច** ៖ `uiState.x` ➜ `x` ·
 *       `byId(` ➜ `document.getElementById(` · `qs(` ➜ `document.querySelector(` · `runOnWindowLoad(` ➜ `window.addEventListener('load', `
 *    ៣. ប្រៀប token ➜ រាល់ function ដែលខុស = ការកែ **ដោយចេតនា** ដែលត្រូវពន្យល់បាន
 *
 * ⛔ តំបន់ហាមចូល (PTR · ចលនាផ្ទាំង · ការរមូរ) ត្រូវ **ដូចដើមបេះបិទ** លើកលែងការកែ
 *    ដែលរាយក្នុង `ZONE_ALLOWED` ជាមួយហេតុផល ➜ ការកែថ្មីណាមួយ ធ្វើឲ្យឧបករណ៍ធ្លាក់។
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as acorn from 'acorn';
import esbuild from 'esbuild';
import { resolveOldRoot } from './old-app.mjs';
import { REMOVED } from './intentional-removals.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const OLD = fs.readFileSync(path.join(resolveOldRoot(HERE), 'app.js'), 'utf8');
const STORES = new Set(['firebaseState', 'dataState', 'scanState', 'uiState', 'securityState', 'lookupState', 'sheetImportState', 'ztoState']);

/** function តំបន់ហាមចូល (`CLAUDE.md` ៖ PTR · ចលនាផ្ទាំង · ការរមូរ · ការលាក់របា) */
const ZONE_FILES = ['app/behaviors/pull-to-refresh.ts', 'app/behaviors/panel-motion.ts', 'app/behaviors/panels.ts', 'app/behaviors/chrome-autohide.ts',
    'app/behaviors/phone-search.ts', 'ui/chrome-autohide.ts', 'ui/page-nav.ts'];
const ZONE_EXTRA = ['setPhoneSearchPulledUp', 'positionPhoneSuggestBox', 'syncHistoryExpandedLock', 'activePanelSections', 'measureAppChromeSize'];
/**
 * ⛔ «React ១០០%» (សំណើម្ចាស់គម្រោង) ៖ class · attribute · ការស្វែងរកតាម id ក្នុងតំបន់ហាមចូល
 *    ក្លាយជា **state ដែល JSX គូរ** ឬ **ref** ➜ token ខុស ខណៈ **លំដាប់ · លក្ខខណ្ឌ · លេខ
 *    (slop · ratio · ពិដាន) មិនប្រែ**។ រាល់ការវាស់ (`getBoundingClientRect` · `scrollTop`)
 *    ឈរ **ក្រោយ** `commitNow()` ➜ DOM ដូច App ដើមពេលវាស់។ អ្នកយាមឥរិយាបថ ៖
 *    gesture-test · panel-motion-test · ios-panel-glide-test · panel-snap-ownership-test ·
 *    phone-search-swipe-test (ត្រូវបៃតងលើ tree ថ្មី)។
 */
const REACT_STATE = 'React ១០០% ៖ ';
/** ការកែក្នុងតំបន់ហាមចូលដែល **ទទួលយក** — រាល់ធាតុត្រូវមានហេតុផល */
const ZONE_ALLOWED = {
    setupIOSPullToRefresh: 'សញ្ញា PTR ៖ React គូរធាតុ (`PtrIndicator`) ➜ កាយវិការ **រក** វា ជំនួស `createElement` · ចលនា (`style.transform`) មិនប្រែ ។ វាស់បាន ៖ gesture-test 107 · ios-panel-glide 38 · panel-motion 47 ដូចដើម' +
        ' ⊕ App Android (សំណើម្ចាស់គម្រោង) ៖ ច្រកទ្វារ `pullToRefreshSupported()` (iOS standalone **ឬ** Android native) · ការចាប់មុន slop **តែលើ Android native** (`claimBeforeSlop`) ➜ ផ្លូវ iOS និង browser មិនប្រែ ។ វាស់បាន ៖ native-check (ច្បាប់ latch របស់ Chromium ៖ ដកការចាប់មុន slop ➜ ធ្លាក់) · web គ្មាន PTR ដូចដើម' +
        ' ⊕ សំណើម្ចាស់គម្រោង (ស្តង់ដា App) ៖ ចាប់ផ្តើមតែ **៤០% ខាងលើ** · **ស្រទាប់បើក ➜ គ្មាន PTR** (ចងចាំនៅ `pointerdown`) · **ញ័រម្តង** ពេលឆ្លងព្រំដែន ។ វាស់បាន ៖ native-check mutation ៣/៣ ចាប់ · gesture-test ត្រូវបៃតង' +
        ' ⊕ React ១០០% (សំណើម្ចាស់គម្រោង) ៖ transform · opacity · class ចលនារបស់សញ្ញា ជា **`ptrState`** ដែល `PtrIndicator` គូរ (`renderNow()` ➜ ស៊ុមដដែល) · `MutationObserver` លើ class ➜ `uiState.subscribe` (ប្រភពនៃ class ទាំងនោះ) · ការរមូរ document តាម `resetDocumentScroll()` (លំដាប់ដដែល)',
    switchAppPage: REACT_STATE + '`.active` របស់ទំព័រ/Tab ដេរីវេពី `currentAppPage` ក្នុង JSX · `scrollTop = 0` តាម `setScrollTop()` (commit មុន) — លំដាប់ hide ➜ pull-up ➜ chrome ➜ lock ➜ scroll ដដែល',
    openSideDrawer: REACT_STATE + '`.open` · `aria-hidden` របស់របា Slide និង backdrop ដេរីវេពី `drawerOpen` ➜ ការហៅ refresh ទាំង ៥ ដដែល',
    closeSideDrawer: REACT_STATE + '`drawerOpen = false` ជំនួស `.open`/`aria-hidden`',
    isSideDrawerOpen: REACT_STATE + 'អាន `drawerOpen` (ប្រភពរបស់ `.open`) ជំនួស classList',
    activePanelSections: REACT_STATE + 'ទំព័រសកម្មអានពី `currentAppPage` (ប្រភពរបស់ `.active`) · ធាតុតាម ref · បន្ថែម `panel` (កូនសោ state របស់ផ្ទាំង)',
    entryScrollerInView: REACT_STATE + '`#lockerPanel` លាក់ ⇔ `entryModeShown !== \'locker\'` (JSX `PageEntry`) ➜ អានប្រភពដដែល',
    syncHistoryExpandedLock: REACT_STATE + '`history-expanded` ជា `historyExpanded` + `commitNow()` ➜ `scrollTop = 0` មុន/ក្រោយ និង rAF ២ ជាន់ ដដែល (តាម `setElementScrollTop()` — គ្មាន commit បន្ថែម)',
    panelGlideFrom: REACT_STATE + '`el.animate()` តាម `animateElement()` (ច្រកចេញ ref តែមួយក្នុង `refs.ts`) — keyframe · រយៈពេល · easing · ផ្លូវដោះ snap ២ ដដែល',
    measureAppChromeSize: REACT_STATE + 'អថេរ CSS លើ `<html>` ជា state (`uiState.*Var`) ➜ `DocumentEffects` សរសេរ · `commitNow()` ចុងក្រោយ ➜ ចុះក្នុង tick ដដែល · ច្បាប់ «តម្លៃ ០ មិនសរសេរ» ដដែល',
    beginPanelGlideSnapPause: REACT_STATE + '`panel-gliding` ជា `panelGliding` + `commitNow()` ➜ snap ផ្អាក **មុន** `animate()` ដូចដើម · token/ownership ដដែល',
    endPanelGlideSnapPause: REACT_STATE + '`panelGliding = false` ជំនួស `classList.remove` — វាល `markImmediate` ➜ ចុះ DOM ក្នុង tick ដដែល (ios-panel-glide «cleanup»)',
    setupSwipeGestures: REACT_STATE + 'បន្ថែមកូនសោ `panel` ក្នុង config · scroller តាម ref',
    phoneSearchIsActive: REACT_STATE + '`.show` ជា `phoneSuggestOpen` · focus/តម្លៃតាម ref (`isFieldFocused` · `fieldValue`)',
    bindPanelSwipe: REACT_STATE + '`.collapsed`/`.search-focus` អាន/សរសេរតាម `panelIsCollapsed()`/`setPanelCollapsed()`/`panelHasSearchFocus()` · `commitNow()` មុនវាស់ `beforeTop` · ការប្តូរនៅ `touchend` ដដែល (ថ្ងៃ slop 8/30 · ratio ដដែល) · ការចុចដងអូស ➜ `onClick` របស់ JSX (`togglePanelFromHandle()` — តួដដែល) · listener `touch*` នៅ native (React ចាក់វាជា passive)',
    appChromeElements: REACT_STATE + 'navbar · tabbar តាម ref',
    showAppChrome: REACT_STATE + '`chrome-hidden` លើ `<body>` ដេរីវេពី `chromeHidden` (`DocumentEffects`)',
    hideAppChrome: REACT_STATE + '`chrome-hidden` លើ `<body>` ដេរីវេពី `chromeHidden` (`DocumentEffects`)',
    setupChromeAutoHide: REACT_STATE + '`#appPages` តាម ref · ពិដាន SHOW_AFTER/HIDE_AFTER · rAF coalesce ដដែល' +
        ' ⊕ សំណើម្ចាស់គម្រោង (APK ៖ រមូរដល់ចុង ចុចបើកធុងសំរាម/បញ្ជី ZTO អាក់) ៖ modal គ្របរបា ➜ ការរមូរ **ក្នុង** `.modal` មិនបញ្ជារបា ·' +
        ' ការរមូរបញ្ជីខណៈ modal បើក ធ្វើតាមច្បាប់ធម្មតា (លាក់ត្រូវ `hideAppChrome()` បដិសេធ · ត្រឡប់ដល់កំពូល ➜ បង្ហាញ) · `openModalHelper()` មិនបង្ហាញរបា ➜' +
        ' ការបើក modal មិនប្តូរ clip-path/padding របស់បញ្ជី ។ វាស់បាន ៖ ៦០០ ជួរ CPU ÷4 PrePaint+Paint ២១៦ ➜ ៧៦ms (ដូចពេលរបាបង្ហាញ) ·' +
        ' អ្នកយាម `tests/modal-chrome-state.test.tsx` · gesture-test · perf-check (tree មុនកែ ➜ ក្រហម) · drawer ដដែល',
    positionPhoneSuggestBox: REACT_STATE + '`commitNow()` មុនវាស់ · `.show` ជា `phoneSuggestOpen` · ធាតុតាម ref · `style.width/left/top` ជា state (`phoneSuggest*`) ➜ `PhoneSuggestBox` គូរ · ទទឹងចុះ DOM មុនវាស់កម្ពស់ ដូចដើម',
    setPhoneSearchPulledUp: REACT_STATE + '`.search-focus` ជា `dataPanelSearchFocus` · `.collapsed` ជា `dataPanelCollapsed`',
    setupPhoneSuggestions: REACT_STATE + 'listener របស់ប្រអប់ស្វែងរក/ប្រអប់ណែនាំ ➜ prop របស់ JSX (`onInput` · `onFocus` · `onBlur` · `onKeyDown` · `onMouseDown` · `onClick` លើជួរ) តួដដែល · សល់តែ `scroll`/`resize` របស់ `window`',
};


function printed(code, loader) {
    return esbuild.transformSync(code, { loader, format: 'esm', target: 'es2022', minifyWhitespace: false, keepNames: false }).code;
}

function tokens(code) {
    const out = [];
    for (const t of acorn.tokenizer(code, { ecmaVersion: 'latest', sourceType: 'module' })) {
        const label = t.type.label;
        out.push(label === 'string' || label === 'template' || label === 'num' || label === 'name' || label === 'regexp'
            ? label + ':' + String(t.value && t.value.pattern !== undefined ? '/' + t.value.pattern + '/' + t.value.flags : t.value)
            : label);
    }
    // ⛔ ការប្តូរមេកានិចរបស់ codemod ➜ ធ្វើឲ្យស្មើ
    const norm = [];
    for (let i = 0; i < out.length; i++) {
        const a = out[i];
        if (a.startsWith('name:') && STORES.has(a.slice(5)) && out[i + 1] === '.' && (out[i + 2] || '').startsWith('name:')) {
            norm.push(out[i + 2]); i += 2; continue;
        }
        if (a === 'name:byId') { norm.push('name:document', '.', 'name:getElementById'); continue; }
        // `qs(sel)` = `document.querySelector(sel)` (`src/core/dom.ts`) — អាគុយម៉ង់នៅប្រៀបធៀបដដែល
        // ⛔ `qsa` **មិន** ធ្វើឲ្យស្មើ ៖ វាត្រឡប់ Array មិនមែន NodeList
        if (a === 'name:qs') { norm.push('name:document', '.', 'name:querySelector'); continue; }
        if (a === 'name:runOnWindowLoad') { norm.push('name:window', '.', 'name:addEventListener', '(', 'string:load', ','); i += 1; continue; }
        norm.push(a);
    }
    return norm;
}

function functionsOf(code, sourceType) {
    const ast = acorn.parse(code, { ecmaVersion: 'latest', sourceType });
    const map = new Map();
    for (const n of ast.body) {
        const fn = n.type === 'FunctionDeclaration' ? n
            : (n.type === 'ExportNamedDeclaration' && n.declaration && n.declaration.type === 'FunctionDeclaration' ? n.declaration : null);
        if (fn) map.set(fn.id.name, code.slice(fn.start, fn.end));
    }
    return map;
}

// ── ដើម ──
const oldFns = functionsOf(OLD, 'script');
const oldTok = new Map([...oldFns].map(([k, v]) => [k, tokens(printed(v, 'js'))]));

// ── ថ្មី ──
const newTok = new Map();
const where = new Map();
function walkDir(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) { if (!['sw', 'types', 'styles', 'components'].includes(e.name)) walkDir(full); continue; }
        if (!e.name.endsWith('.ts') || e.name.endsWith('.d.ts')) continue;
        const js = printed(fs.readFileSync(full, 'utf8'), 'ts');
        for (const [name, src] of functionsOf(js, 'module')) {
            newTok.set(name, tokens(printed(src.replace(/^export\s+/, ''), 'js')));
            where.set(name, path.relative(path.join(ROOT, 'src'), full));
        }
    }
}
walkDir(path.join(ROOT, 'src'));

let same = 0;
const differ = [];
const missing = [];
const removed = [];
for (const [name, t] of oldTok) {
    const n = newTok.get(name);
    if (!n) { (REMOVED[name] ? removed : missing).push(name); continue; }
    if (n.length === t.length && n.every((x, i) => x === t[i])) same++;
    else differ.push(name);
}

const zoneNames = new Set([...where].filter(([_n, f]) => ZONE_FILES.includes(f)).map(([n]) => n).concat(ZONE_EXTRA));
const zoneDiff = differ.filter((n) => zoneNames.has(n));
const zoneUnexplained = zoneDiff.filter((n) => !ZONE_ALLOWED[n]);
const zoneTotal = [...zoneNames].filter((n) => oldTok.has(n)).length;

console.log('╔══════════════════════════════════════════════════════════════════════╗');
console.log('║  ភាពដូចគ្នានៃតក្កវិជ្ជា ៖ function នីមួយៗ ធៀបនឹង app.js ដើម តាម token ║');
console.log('╚══════════════════════════════════════════════════════════════════════╝\n');
console.log(`function ដើម ៖ ${oldTok.size}`);
console.log(`✅ ដូចដើមបេះបិទ (តាម token)   ៖ ${same}`);
console.log(`✏️  ខុស (ការកែដោយចេតនា)       ៖ ${differ.length}`);
console.log(`${missing.length ? '❌' : '✅'} បាត់                       ៖ ${missing.length}${missing.length ? ' — ' + missing.join(' · ') : ''}`);
console.log(`🗑️  ដកចេញដោយចេតនា            ៖ ${removed.length}`);
for (const n of removed) console.log(`   ${n} — ${REMOVED[n]}`);
const deadRemoved = Object.keys(REMOVED).filter((n) => !removed.includes(n));
if (deadRemoved.length) console.log(`❌ REMOVED ងាប់ (function នៅមាន ឬមិនមែនរបស់ដើម) ៖ ${deadRemoved.join(' · ')}`);
const deadZone = Object.keys(ZONE_ALLOWED).filter((n) => !differ.includes(n));
console.log(`\n── តំបន់ហាមចូល (PTR · ចលនាផ្ទាំង · ការរមូរ · ការលាក់របា) ៖ ${zoneTotal} function ──`);
console.log(`✅ ដូចដើមបេះបិទ ៖ ${zoneTotal - zoneDiff.length}/${zoneTotal}`);
for (const n of zoneDiff) console.log(`${ZONE_ALLOWED[n] ? '✏️ ' : '❌'} ${n} (${where.get(n)})${ZONE_ALLOWED[n] ? ' — ' + ZONE_ALLOWED[n] : ' — ⛔ ការកែដែលគ្មានហេតុផល'}`);
if (process.env.LOGIC_DIFF) {
    for (const name of process.env.LOGIC_DIFF.split(',')) {
        const a = oldTok.get(name) || []; const b = newTok.get(name) || [];
        let i = 0; while (i < a.length && a[i] === b[i]) i++;
        let ja = a.length - 1; let jb = b.length - 1;
        while (ja >= i && jb >= i && a[ja] === b[jb]) { ja--; jb--; }
        console.log(`\n── ${name} ── ខុសពី token ${i} ៖`);
        console.log('   ដើម : ' + a.slice(Math.max(0, i - 6), ja + 2).join(' ').slice(0, 900));
        console.log('   ថ្មី : ' + b.slice(Math.max(0, i - 6), jb + 2).join(' ').slice(0, 900));
    }
}
if (process.env.LOGIC_DUMP) {
    const dir = process.env.LOGIC_DUMP;
    fs.mkdirSync(dir, { recursive: true });
    for (const name of differ) {
        fs.writeFileSync(path.join(dir, name + '.old'), (oldTok.get(name) || []).join('\n') + '\n');
        fs.writeFileSync(path.join(dir, name + '.new'), (newTok.get(name) || []).join('\n') + '\n');
    }
}
if (process.env.LOGIC_LIST) { console.log('\nfunction ដែលខុស ៖'); differ.forEach((n) => console.log('   ' + n + ' (' + where.get(n) + ')')); }

// ⛔ ជាន់អប្បបរមា ៖ ការស្កេនដែលរកមិនឃើញ function ដើម ឬរកតំបន់មិនឃើញ = វាស់មិនបាន
if (oldTok.size < 700 || zoneTotal < 30) { console.error(`\n⛔ ការស្កេនតូចពេក (${oldTok.size} function · តំបន់ ${zoneTotal}) — វាស់មិនបាន`); process.exit(2); }
if (deadZone.length) console.log(`❌ ZONE_ALLOWED ងាប់ (function ដូចដើមវិញ ឬលែងមាន) ៖ ${deadZone.join(' · ')}`);
const failed = missing.length + zoneUnexplained.length + deadRemoved.length + deadZone.length;
console.log(failed ? `\n❌ ${failed} បញ្ហា` : `\n✅ គ្មាន function បាត់ · តំបន់ហាមចូលដូចដើម (លើកលែងការកែដែលមានហេតុផល)`);
process.exit(failed ? 1 : 0);
