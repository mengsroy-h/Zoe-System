// Toasts and status labels must report what is TRUE RIGHT NOW.
//
// The class of bug this locks down was reported from production with a
// screenshot: the app had booted offline from a cached auth session, every
// figure on screen was 0 — and it announced «ចូលប្រព័ន្ធជោគជ័យ!» while the
// navbar label read «ក្រៅបណ្ដាញ» painted in the connected green. Three
// separate lies in one frame:
//
//   1. the label's colour was hard-coded `var(--success)` in `.brand-info span`,
//      so «ក្រៅបណ្ដាញ» rendered green — a CSS-only bug that no JS test could see;
//   2. every toast shared one dark pill, so a ⚠️ warning and a ✅ success were
//      visually identical;
//   3. the sign-in toast was a frozen literal fired from `onAuthStateChanged`,
//      which restores a cached user with no network at all.
//
// So this checker asserts TWO SIDES everywhere. "The success toast is green"
// alone stays green if every toast is green; "the sign-in toast is honest when
// offline" alone passes if it is honest and then never corrects itself. Each
// claim below is paired with the claim that would be false if the fix were
// only cosmetic.
//
// The browser half runs the REAL sliced functions against the REAL stylesheet:
// module-level `let`s never reach `window` in this project, so the state is
// injected around the real code rather than poked at through globals.

const fs = require('fs');
const path = require('path');

let chromium;
try { chromium = require('playwright-core').chromium; } catch (e) { chromium = null; }
const CHROME = process.env.TOAST_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const ROOT = path.resolve(process.env.TOAST_APP_DIR || path.join(__dirname, '..'));

let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { console.log('   ok    ' + label); pass++; }
    else { console.log('  FAIL   ' + label + (detail !== undefined ? '  got: ' + JSON.stringify(detail) : '')); fail++; }
}

function read(rel) {
    return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function sliceFn(src, name) {
    let start = src.indexOf('function ' + name + '(');
    if (start === -1) return null;
    if (src.slice(Math.max(0, start - 6), start) === 'async ') start -= 6;
    let depth = 0, i = src.indexOf('{', start), started = false;
    for (; i < src.length; i++) {
        if (src[i] === '{') { depth++; started = true; }
        else if (src[i] === '}') { depth--; if (started && depth === 0) { i++; break; } }
    }
    return src.slice(start, i);
}

// ការដាក់ទង់ «មិនទាន់ដឹង» អាចរស់នៅ **ក្នុង helper** មិនមែនក្នុងតួអ្នកហៅ
// (កំណែ 2.33.2 ៖ `armSessionExpiryCheck()` ជាចំណុចច្របាច់តែមួយ ព្រោះផ្លូវ
// Activate ក៏ត្រូវ arm ដែរ)។ ⛔ ដូច្នេះការស្កេនរក **អក្សរ** នៃការដាក់ទង់
// ក្នុងតួអ្នកហៅ ជា **កាលបរិច្ឆេទផុតកំណត់** — វាធ្លាក់ពេលកូដត្រូវរៀបចំឡើងវិញ
// ដោយត្រឹមត្រូវ។ អ្នកយាមត្រូវ **ដេរីវេ** ឈ្មោះអ្នកដាក់ទង់ចេញពីកូដពិត ៖
// ឈ្មោះ function ណាដែលតួរបស់វាដាក់ទង់ = ការហៅវាក៏ជាការដាក់ទង់ដែរ។
// ⛔ វានៅតែធ្លាក់បាន ៖ បើគ្មានអ្នកណាដាក់ទង់ ឬបើ helper ឈប់ដាក់ទង់
// បញ្ជីនឹងសល់តែអក្សរដើម ➜ រកមិនឃើញក្នុងតួអ្នកហៅ ➜ FAIL។
function armingTokens(src, literal) {
    const tokens = [literal];
    const re = /function\s+([A-Za-z0-9_$]+)\s*\(/g;
    const decls = [];
    let m;
    while ((m = re.exec(src)) !== null) decls.push({ name: m[1], at: m.index });
    let from = src.indexOf(literal);
    while (from !== -1) {
        let best = null;
        for (let i = 0; i < decls.length; i++) {
            if (decls[i].at >= from) break;
            const body = sliceFn(src, decls[i].name);
            if (!body) continue;
            if (decls[i].at + body.length <= from) continue;
            if (!best || decls[i].at > best.at) best = decls[i];
        }
        if (best && tokens.indexOf(best.name + '(') === -1) tokens.push(best.name + '(');
        from = src.indexOf(literal, from + literal.length);
    }
    return tokens;
}

function earliestOf(hay, tokens) {
    let best = -1;
    for (let i = 0; i < tokens.length; i++) {
        const at = hay.indexOf(tokens[i]);
        if (at !== -1 && (best === -1 || at < best)) best = at;
    }
    return best;
}

function sliceConst(src, name) {
    const start = src.indexOf('const ' + name + ' =');
    if (start === -1) return null;
    let i = start, depth = 0;
    for (; i < src.length; i++) {
        const c = src[i];
        if (c === '[' || c === '{' || c === '(') depth++;
        else if (c === ']' || c === '}' || c === ')') depth--;
        else if (c === ';' && depth === 0) return src.slice(start, i + 1);
    }
    return null;
}

const APPS = ['ZoeW', 'ZoeKeyGen'];
const KINDS = ['info', 'success', 'warn', 'error'];

// ── ១. ការចាត់ថ្នាក់ toast — ២ ខាង ───────────────────────────────────
// មិនគ្រប់គ្រាន់ទេ បើគ្រាន់តែ «មានថ្នាក់ success»។ ថ្នាក់នីមួយៗត្រូវ
// **មើលទៅខុសគ្នា** បើមិនដូច្នេះ ⚠️ និង ✅ នៅតែដូចគ្នាបេះបិទ។
console.log('-- ១. ថ្នាក់ toast មានក្នុងកូដ និងមានពណ៌ដាច់ដោយឡែកក្នុង CSS --');
for (const app of APPS) {
    const js = read(app + '/app.js');
    const css = read(app + '/style.css');

    ok(app + ' ៖ showToast ទទួល kind', /function showToast\(msg, kind\)/.test(js));
    ok(app + ' ៖ មាន toastKindOf អានសញ្ញាចេញពីសារ', /function toastKindOf\(/.test(js));
    ok(app + ' ៖ paintToast សរសេរឈ្មោះ class ពេញ (មិនផ្គុំតាម string)',
        KINDS.every((kind) => js.indexOf("'toast-" + kind + "'") !== -1));

    const backgrounds = {};
    KINDS.forEach((kind) => {
        const rule = new RegExp('\\.toast-' + kind + '\\s*\\{([^}]*)\\}').exec(css);
        const decl = rule ? /background(?:-color)?:\s*([^;]+);/.exec(rule[1]) : null;
        backgrounds[kind] = decl ? decl[1].trim() : null;
    });
    const named = KINDS.filter((k) => backgrounds[k]);
    ok(app + ' ៖ CSS មានផ្ទៃខាងក្រោយសម្រាប់ថ្នាក់ទាំង ' + KINDS.length,
        named.length === KINDS.length, backgrounds);
    ok(app + ' ៖ ហើយពណ៌ទាំងនោះមិនដូចគ្នា (បើដូច = គ្មានសញ្ញាអ្វីទាល់តែសោះ)',
        named.length === KINDS.length &&
        new Set(named.map((k) => backgrounds[k])).size === KINDS.length, backgrounds);
}

// ── ២. ស្លាកស្ថានភាព — ពណ៌ត្រូវប្តូរតាមស្ថានភាព ─────────────────────
// នេះជាកំហុសក្នុងរូបថតដោយផ្ទាល់៖ `.brand-info span { color: var(--success) }`
// ធ្វើឲ្យអក្សរ «ក្រៅបណ្ដាញ» ចេញជាពណ៌បៃតងនៃការភ្ជាប់។
console.log('\n-- ២. ស្លាកស្ថានភាពក្នុងរបាខាងលើ ត្រូវប្តូរពណ៌តាមស្ថានភាព --');
for (const app of APPS) {
    const js = read(app + '/app.js');
    const css = read(app + '/style.css');
    const render = sliceFn(js, 'renderConnectionStatus') || '';

    // App React ៖ `renderConnectionStatus()` សរសេរ `viewState.connectionStatus` ('online'·'connecting'·'offline')
    // ហើយ `AppNavbar` (JSX) គូរ class `is-<ស្ថានភាព>` លើ `#firebaseStatusText` ➜ ពណ៌ពិតវាស់ក្នុង browser (ផ្នែក ៦)
    let reactStatus = false;
    if (fs.existsSync(path.join(ROOT, app, 'react-render.cjs'))) {
        const { renderComponent, elementById } = require('./react-view');
        reactStatus = /connectionStatus\s*=/.test(render) && ['online', 'connecting', 'offline'].every((k) =>
            render.indexOf("'" + k + "'") !== -1 && new RegExp('\\bis-' + k + '\\b').test((elementById(renderComponent(ROOT,
                'src/app/components/AppNavbar.tsx', 'AppNavbar', { viewState: { connectionStatus: k } }), 'firebaseStatusText') || {}).className || ''));
    }
    ok(app + ' ៖ renderConnectionStatus ដាក់ class តាមស្ថានភាព',
        (/is-online/.test(render) && /is-connecting/.test(render) && /is-offline/.test(render)) || reactStatus);
    ok(app + ' ៖ CSS ផ្តល់ពណ៌ដាច់ដោយឡែកឲ្យ is-online និង is-offline',
        /#firebaseStatusText\.is-online\s*\{/.test(css) && /#firebaseStatusText\.is-offline\s*\{/.test(css));
    ok(app + ' ៖ ស្លាកនោះលែងចាក់ពណ៌តែមួយថេរ',
        !/\.brand-info span \{[^}]*color: var\(--success\)/.test(css));
    ok(app + ' ៖ renderConnectionStatus ផ្សាយបន្តទៅ toast ដែលរស់',
        /refreshLiveToasts\(\);/.test(render));
}

// ── ៣. ការប្រកាសចូលប្រព័ន្ធ មិនត្រូវជាអក្សរកកទៀតទេ ──────────────────
// `onAuthStateChanged` បាញ់ចេញពី session ដែល cache ទុក **ដោយគ្មានបណ្តាញ**
// សោះ — ដូច្នេះការសរសេរ «ជោគជ័យ» ត្រង់នោះ គឺជាការអះអាងដែលកូដមិនអាចដឹង។
console.log('\n-- ៣. ការប្រកាសចូលប្រព័ន្ធ ត្រូវអានស្ថានភាពពិត --');
for (const app of APPS) {
    const js = read(app + '/app.js');
    ok(app + ' ៖ គ្មាន showToast("ចូលប្រព័ន្ធជោគជ័យ!") ជាអក្សរកក',
        js.indexOf('showToast("ចូលប្រព័ន្ធជោគជ័យ!")') === -1);
    ok(app + ' ៖ ប្រកាសតាម showLiveToast(\'signin\')', /showLiveToast\('signin'\)/.test(js));
    const state = sliceFn(js, 'liveToastState') || '';
    ok(app + ' ៖ liveToastState ពិនិត្យ navigator.onLine', /navigator\.onLine === false/.test(state));
    ok(app + ' ៖ ហើយបញ្ជាក់ថាស្ថានភាពណាទើប «ចប់»', /settled: true/.test(state) && /settled: false/.test(state));
    const live = sliceFn(js, 'showLiveToast') || '';
    ok(app + ' ៖ toast ដែលរស់ តែងតែមានពេលកំណត់ (មិនស្ថិតជាប់អេក្រង់)',
        /armToastDismiss\((?:toast|id), TOAST_LIVE_LIMIT_MS\)/.test(live));
}

// ── ៤. ZoeW ៖ ការទាញទិន្នន័យរួច ជាផ្នែកនៃសេចក្តីពិត ──────────────────
console.log('\n-- ៤. ZoeW ៖ «ភ្ជាប់រួច» មិនដូច «ទិន្នន័យមកដល់ហើយ» --');
{
    const js = read('ZoeW/app.js');
    const state = sliceFn(js, 'liveToastState') || '';
    ok('ZoeW ៖ liveToastState មើល dbListenerPendingPaths', /dbListenerPendingPaths\.size/.test(state));
    ok('ZoeW ៖ និងមើល dbListenersFailed', /dbListenersFailed/.test(state));
    const alive = sliceFn(js, 'noteDbListenerAlive') || '';
    ok('ZoeW ៖ snapshot ចុងក្រោយមកដល់ ➜ ធ្វើឲ្យ toast ស្រស់ភ្លាម',
        /refreshLiveToasts\(\)/.test(alive));
    const proceed = sliceFn(js, 'proceedAfterLogin') || '';
    const toastAt = proceed.indexOf("showLiveToast('signin')");
    const listenersAt = proceed.indexOf('initDatabaseListeners()');
    ok('ZoeW ៖ ប្រកាសក្រោយភ្ជាប់ listener (បើមុន វានឹងឃើញ pending ទទេ ➜ កុហក)',
        toastAt !== -1 && listenersAt !== -1 && toastAt > listenersAt, { toastAt, listenersAt });
}

// ── ៤ខ. វគ្គដែលបានបញ្ចប់ មិនត្រូវនៅតែប្រកាសជោគជ័យ ─────────────────
// កំហុសផលិតកម្មពិត (2026-08-26)៖ ក្រោយពិដាន ៤ ម៉ោង App បើកប្រអប់ login
// ឡើងវិញ **ខណៈ toast ដដែលនោះនៅ «រស់»** ➜ ការគូរស្ថានភាពការតភ្ជាប់បន្ទាប់
// សរសេរជាន់វាទៅជា «✅ ចូលប្រព័ន្ធជោគជ័យ — ទិន្នន័យទាន់សម័យ» ចំពេលអ្នកប្រើ
// ត្រូវបានស្នើឲ្យវាយពាក្យសម្ងាត់ម្ដងទៀត។
//
// មូលហេតុ៖ `liveToastState()` អានតែស្ថានភាព **បណ្តាញ** — វាមិនដែលសួរថា
// «តើគេនៅចូលប្រព័ន្ធទេ?» សោះ។ ដូច្នេះការអះអាងទាំងពីរខាងត្រូវការ៖ វាត្រូវ
// បដិសេធការប្រកាសពេលវគ្គស្លាប់ **ហើយនៅតែប្រកាសពេលវគ្គរស់** — បើមិនដូច្នេះ
// «កុំប្រកាសសោះ» ក៏ជាប់តេស្តដែរ។
console.log('\n-- ៤ខ. វគ្គដែលបានបញ្ចប់ ➜ toast ត្រូវនិយាយការពិត --');
{
    const js = read('ZoeW/app.js');
    const state = sliceFn(js, 'liveToastState') || '';
    const proceed = sliceFn(js, 'proceedAfterLogin') || '';
    const expire = sliceFn(js, 'forceExpireSession') || '';
    const prefill = sliceFn(js, 'showLoginModalWithPrefill') || '';
    const refresh = sliceFn(js, 'refreshLiveToasts') || '';

    ok('ZoeW ៖ liveToastState សួររកអ្នកប្រើដែលនៅចូលប្រព័ន្ធពិត',
        /auth\.currentUser/.test(state));
    ok('ZoeW ៖ និងដឹងថាពិដាន ៤ ម៉ោងបានផុតកំណត់',
        /sessionExpiryCheck === 'expired'/.test(state));
    ok('ZoeW ៖ មិនអះអាងជោគជ័យខណៈការផ្ទៀងផ្ទាត់វគ្គមិនទាន់ចប់',
        /sessionExpiryCheck === 'pending'/.test(state));

    const ARM_LITERAL = "sessionExpiryCheck = 'pending'";
    const armTokens = armingTokens(js, ARM_LITERAL);
    const armSites = js.split(ARM_LITERAL).length - 1;
    ok('ZoeW ៖ មានអ្នកដាក់ទង់ «មិនទាន់ដឹង» ពិតក្នុងកូដ ship (ដេរីវេ មិនមែន literal)',
        armSites >= 2 && armTokens.length >= 1, { armSites, armTokens });
    const armAt = earliestOf(proceed, armTokens);
    const announceAt = proceed.indexOf("showLiveToast('signin')");
    ok('ZoeW ៖ proceedAfterLogin ដាក់ទង់ «មិនទាន់ដឹង» មុនប្រកាស',
        armAt !== -1 && announceAt !== -1 && armAt < announceAt, { armAt, announceAt, armTokens });

    const markAt = expire.indexOf("sessionExpiryCheck = 'expired'");
    const signOutAt = expire.indexOf('fb.signOut');
    ok('ZoeW ៖ forceExpireSession សម្គាល់វគ្គថាស្លាប់ **មុន** ការចាកចេញ async',
        markAt !== -1 && signOutAt !== -1 && markAt < signOutAt, { markAt, signOutAt });
    ok('ZoeW ៖ ហើយកែ toast ដែលរស់ភ្លាម (មិនរង់ចាំព្រឹត្តិការណ៍បណ្តាញបន្ទាប់)',
        /refreshLiveToasts\(\)/.test(expire));
    ok('ZoeW ៖ សារផុតកំណត់ជាថេរតែមួយ ចែករំលែករវាង toast រស់ និង toast ថ្មី',
        /SESSION_EXPIRED_TOAST/.test(expire) && /SESSION_EXPIRED_TOAST/.test(state));
    ok('ZoeW ៖ សារផុតកំណត់លេចជាក់ស្តែងតែ **១** (មិនប្រកាសស្ទួន មិនបាត់)',
        /reannounceOrShowToast\(SESSION_EXPIRED_TOAST\)/.test(expire));
    const reannounce = sliceFn(js, 'reannounceOrShowToast') || '';
    // App React ៖ toast ជាធាតុក្នុង `uiState.toasts` (`.show = true` ជំនួស `classList.add('show')`)
    ok('ZoeW ៖ បើ toast នោះនៅលើអេក្រង់ ➜ រស់វិញពេញ ៣ វិ. ជំនួសការបន្ថែមថ្មី',
        (/classList\.add\('show'\)/.test(reannounce) || /list\[i\]\.show = true/.test(reannounce)) &&
        /armToastDismiss\((?:items\[i\]|list\[i\]\.id), TOAST_LIFETIME_MS\)/.test(reannounce) &&
        /return showToast\(msg\);/.test(reannounce));
    ok('ZoeW ៖ ប្រអប់ login បើក ➜ អានសេចក្តីពិតឡើងវិញ',
        /refreshLiveToasts\(\)/.test(prefill));
    // App React ៖ `refreshLiveToasts()` អានតែ `uiState.toasts` (គ្មាន DOM សោះ) ➜ vm គ្មាន document ក៏មិនបោះ
    ok('ZoeW ៖ refreshLiveToasts នៅត្រឡប់ចេញភ្លាមពេលគ្មាន toastContainer (តេស្ត vm)',
        (/return;/.test(refresh) && refresh.indexOf('return;') < refresh.indexOf('querySelectorAll('))
        || (refresh.length > 0 && !/\bdocument\b|querySelector/.test(refresh) && /uiState\.toasts/.test(refresh)));
    const expireRefreshAt = expire.indexOf('refreshLiveToasts()');
    ok('ZoeW ៖ ហើយការកែនោះកើតមុន fb.signOut (async) មិនមែនក្រោយ',
        expireRefreshAt !== -1 && signOutAt !== -1 && expireRefreshAt < signOutAt,
        { expireRefreshAt, signOutAt });
}
{
    const js = read('ZoeKeyGen/app.js');
    const state = sliceFn(js, 'liveToastState') || '';
    const proceed = sliceFn(js, 'verifyAdminRoleThenProceed') || '';
    const prefill = sliceFn(js, 'showLoginModalWithPrefill') || '';

    ok('ZoeKeyGen ៖ liveToastState សួររកអ្នកប្រើដែលនៅចូលប្រព័ន្ធពិត',
        /auth\.currentUser/.test(state) && /isSignedInUiActive/.test(state));
    const flagAt = proceed.indexOf('isSignedInUiActive = true');
    const announceAt = proceed.indexOf("showLiveToast('signin')");
    ok('ZoeKeyGen ៖ លើកទង់ចូលប្រព័ន្ធ **មុន** ប្រកាស (បើក្រោយ ➜ វាប្រកាសការចាកចេញរបស់ខ្លួន)',
        flagAt !== -1 && announceAt !== -1 && flagAt < announceAt, { flagAt, announceAt });
    const clearAt = prefill.indexOf('isSignedInUiActive = false');
    const refreshAt = prefill.indexOf('refreshLiveToasts()');
    ok('ZoeKeyGen ៖ ប្រអប់ login បើក ➜ អានសេចក្តីពិតឡើងវិញក្រោយបន្ទាបទង់',
        clearAt !== -1 && refreshAt !== -1 && clearAt < refreshAt, { clearAt, refreshAt });
}

// ── ៦. ក្នុង browser ពិត ៖ CSS ពិត + កូដពិត ─────────────────────────
const PROBE_FNS = ['toastKindOf', 'paintToast', 'armToastDismiss', 'showToast', 'settleLiveToast',
    'showLiveToast', 'refreshLiveToasts', 'liveToastState', 'connectionLooksOnline',
    'connectionIsSettlingIn', 'renderConnectionStatus'];
const PROBE_CONSTS = ['TOAST_LIFETIME_MS', 'TOAST_LIVE_LIMIT_MS', 'TOAST_CLASSES', 'TOAST_KIND_MARKS'];
// ថេររបស់វគ្គចូលប្រព័ន្ធ៖ ZoeW មានពិដាន ៤ ម៉ោង ដូច្នេះវាមានសារផុតកំណត់
// ដាច់ដោយឡែក; ZoeKeyGen គ្មានពិដាននោះទេ — វាមានតែស្ថានភាព «ចាកចេញ»។
const PROBE_CONSTS_EXTRA = {
    ZoeW: ['SESSION_EXPIRED_TOAST', 'SESSION_SIGNED_OUT_TOAST'],
    ZoeKeyGen: ['SESSION_SIGNED_OUT_TOAST']
};

// App React ៖ toast ជា state (`uiState.toasts`) ដែល `ToastList` គូរ ➜ function ចម្លងដែលចាក់ចូលទំព័រ **មិនគូរអ្វីទេ** ➜
// probe ប្រើ **function និង state ពិត** របស់ App (build វាស់ដាក់វាលើ `window` — `expose-globals.ts`) បូក `commitNow()`
function buildReactProbe() {
    return 'window.__toastProbe = (function () {\n' +
        'const w = window;\n' +
        'const flush = () => { if (typeof w.commitNow === "function") w.commitNow(); };\n' +
        'return {\n' +
        '  set(s) {\n' +
        '    w.isDatabaseConnected = !!s.connected;\n' +
        '    w.dbListenersFailed = !!s.listenersFailed;\n' +
        '    w.isDatabaseInitialized = true;\n' +
        '    w.firebaseSdkUnavailable = false;\n' +
        '    w.reconnectWatchdogAttempt = s.watchdog || 0;\n' +
        '    w.dbListenerPendingPaths.clear();\n' +
        '    (s.pending || []).forEach((p) => w.dbListenerPendingPaths.add(p));\n' +
        '    const session = s.session || "live";\n' +
        '    w.sessionExpiryCheck = session;\n' +
        '    w.auth = { currentUser: session === "out" ? null : { uid: "probe" } };\n' +
        '  },\n' +
        '  render: () => { w.renderConnectionStatus(); flush(); },\n' +
        '  signin: () => { w.showLiveToast("signin"); flush(); },\n' +
        '  clear: () => { w.uiState.toasts = []; flush(); },\n' +
        '  flood: (n) => { for (let i = 0; i < n; i++) w.showToast("ស្កេនរួច " + i); flush(); },\n' +
        '  count: () => document.querySelectorAll("#toastContainer .toast").length,\n' +
        '  liveCount: () => document.querySelectorAll("#toastContainer [data-live-toast]").length\n' +
        '};\n' +
        '})();';
}

function buildProbe(app) {
    const js = read(app + '/app.js');
    if (fs.existsSync(path.join(ROOT, app, 'react-render.cjs'))) {
        const missing = ['renderConnectionStatus', 'showLiveToast', 'showToast', 'liveToastState', 'commitNow']
            .filter((name) => !sliceFn(js, name));
        return missing.length ? null : buildReactProbe();
    }
    const parts = [];
    for (const name of PROBE_CONSTS.concat(PROBE_CONSTS_EXTRA[app] || [])) {
        const c = sliceConst(js, name);
        if (!c) return null;
        parts.push(c);
    }
    for (const name of PROBE_FNS) {
        const f = sliceFn(js, name);
        if (!f) return null;
        parts.push(f);
    }
    return 'window.__toastProbe = (function () {\n' +
        'let isDatabaseConnected = false;\n' +
        'let dbListenersFailed = false;\n' +
        'let isDatabaseInitialized = true;\n' +
        'let firebaseSdkUnavailable = false;\n' +
        'let reconnectWatchdogAttempt = 0;\n' +
        'let sessionExpiryCheck = \'live\';\n' +
        'let isSignedInUiActive = true;\n' +
        'let auth = { currentUser: { uid: \'probe\' } };\n' +
        'const CONNECTING_GRACE_ATTEMPTS = 3;\n' +
        'const dbListenerPendingPaths = new Set();\n' +
        parts.join('\n') + '\n' +
        'return {\n' +
        '  set(s) {\n' +
        '    isDatabaseConnected = !!s.connected;\n' +
        '    dbListenersFailed = !!s.listenersFailed;\n' +
        '    reconnectWatchdogAttempt = s.watchdog || 0;\n' +
        '    dbListenerPendingPaths.clear();\n' +
        '    (s.pending || []).forEach((p) => dbListenerPendingPaths.add(p));\n' +
        '    const session = s.session || \'live\';\n' +
        '    sessionExpiryCheck = session;\n' +
        '    isSignedInUiActive = session !== \'out\';\n' +
        '    auth = { currentUser: session === \'out\' ? null : { uid: \'probe\' } };\n' +
        '  },\n' +
        '  render: renderConnectionStatus,\n' +
        '  signin: () => showLiveToast(\'signin\'),\n' +
        '  clear: () => { document.getElementById(\'toastContainer\').innerHTML = \'\'; },\n' +
        '  flood: (n) => { for (let i = 0; i < n; i++) showToast(\'ស្កេនរួច \' + i); },\n' +
        '  count: () => document.querySelectorAll(\'#toastContainer .toast\').length,\n' +
        '  liveCount: () => document.querySelectorAll(\'#toastContainer [data-live-toast]\').length\n' +
        '};\n' +
        '})();';
}

const http = require('http');
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.png': 'image/png' };
function serve(dir) {
    return new Promise((res) => {
        const s = http.createServer((req, rsp) => {
            let p = decodeURIComponent(req.url.split('?')[0]);
            if (p === '/') p = '/index.html';
            const f = path.join(dir, p);
            if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); return rsp.end(); }
            rsp.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'text/plain' });
            rsp.end(fs.readFileSync(f));
        });
        s.listen(0, '127.0.0.1', () => res(s));
    });
}

function readToast(page) {
    return page.evaluate(() => {
        const el = document.querySelector('#toastContainer .toast');
        if (!el) return null;
        const cs = getComputedStyle(el);
        return { text: el.textContent, bg: cs.backgroundColor, live: el.dataset.liveToast || null, stamp: el.__probeStamp || null };
    });
}

(async () => {
    if (!chromium || !fs.existsSync(CHROME)) {
        console.log('\n-- ៦. browser ពិត — SKIP (គ្មាន playwright-core ឬ Chromium) --');
        console.log('\nសរុប: ' + pass + ' ok, ' + fail + ' FAIL');
        process.exit(fail ? 1 : 0);
    }
    console.log('\n-- ៦. browser ពិត ៖ CSS ពិត + កូដពិត --');
    const browser = await chromium.launch({ executablePath: CHROME });
    for (const app of APPS) {
        const probe = buildProbe(app);
        const dir = path.join(ROOT, app);
        const server = await serve(dir);
        const port = server.address().port;
        const ctx = await browser.newContext({ viewport: { width: 412, height: 780 } });
        const page = await ctx.newPage();
        await page.route('**', (route) => {
            const u = route.request().url();
            if (u.startsWith('http://127.0.0.1:' + port)) return route.continue();
            return route.abort();
        });
        try {
            await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'domcontentloaded', timeout: 20000 });
            await page.waitForTimeout(1200);

            const labelColours = await page.evaluate(() => {
                const el = document.getElementById('firebaseStatusText');
                const out = {};
                ['is-online', 'is-connecting', 'is-offline'].forEach((cls) => {
                    el.classList.remove('is-online', 'is-connecting', 'is-offline');
                    el.classList.add(cls);
                    out[cls] = getComputedStyle(el).color;
                });
                el.classList.remove('is-online', 'is-connecting', 'is-offline');
                out.bare = getComputedStyle(el).color;
                return out;
            });
            ok(app + ' ៖ (CSS សុទ្ធ) ស្លាកភ្ជាប់រួច និងក្រៅបណ្ដាញ មិនចេញពណ៌ដដែល',
                labelColours['is-online'] !== labelColours['is-offline'], labelColours);
            ok(app + ' ៖ (CSS សុទ្ធ) ស្លាកទទេ មិនត្រូវចេញជាពណ៌នៃការភ្ជាប់',
                labelColours.bare !== labelColours['is-online'], labelColours);

            if (!probe) {
                ok(app + ' ៖ ស្រង់កូដ toast ពិតចេញបាន', false, 'មុខងារ ឬថេររបស់ toast បាត់');
            } else {
                await page.evaluate(probe);

                // ស្លាកស្ថានភាព ៖ ពណ៌ត្រូវខុសគ្នាពិតៗ នៅក្នុង CSS ដែល ship
                const colours = await page.evaluate(() => {
                    const el = document.getElementById('firebaseStatusText');
                    const out = {};
                    [['online', { connected: true }],
                     ['connecting', { connected: false, watchdog: 0 }],
                     ['offline', { connected: false, watchdog: 9 }]].forEach(([name, state]) => {
                        window.__toastProbe.set(state);
                        window.__toastProbe.render();
                        out[name] = { colour: getComputedStyle(el).color, text: el.innerText || el.textContent };
                    });
                    return out;
                });
                ok(app + ' ៖ ស្លាក «ក្រៅបណ្ដាញ» មិនប្រើពណ៌ដដែលនឹង «ភ្ជាប់រួច»',
                    colours.offline.colour !== colours.online.colour, colours);
                ok(app + ' ៖ ស្លាក «កំពុងភ្ជាប់» ក៏មានពណ៌ផ្ទាល់ខ្លួនដែរ',
                    colours.connecting.colour !== colours.online.colour &&
                    colours.connecting.colour !== colours.offline.colour, colours);
                ok(app + ' ៖ អត្ថបទស្លាកនៅតែផ្លាស់តាមស្ថានភាពដដែល',
                    colours.online.text !== colours.offline.text, colours);

                // toast ដែលរស់ ៖ សេចក្តីពិតត្រូវផ្លាស់ **ក្នុងធាតុដដែល**
                await page.evaluate(() => {
                    window.__toastProbe.set({ connected: false });
                    window.__toastProbe.signin();
                    const el = document.querySelector('#toastContainer .toast');
                    if (el) el.__probeStamp = 'first';
                });
                const pending = await readToast(page);
                ok(app + ' ៖ ចូលប្រព័ន្ធខណៈ socket មិនទាន់ឡើង ➜ មិនអះអាងថាជោគជ័យ',
                    !!pending && pending.text.indexOf('ជោគជ័យ') === -1, pending);
                ok(app + ' ៖ ហើយ toast នោះនៅ «រស់» (រង់ចាំសេចក្តីពិតបន្ទាប់)',
                    !!pending && pending.live === 'signin', pending);
                const successBg = await page.evaluate(() => {
                    const probe = document.createElement('div');
                    probe.className = 'toast toast-success';
                    document.getElementById('toastContainer').appendChild(probe);
                    const bg = getComputedStyle(probe).backgroundColor;
                    probe.remove();
                    return bg;
                });
                ok(app + ' ៖ ហើយវាមិនប្រើពណ៌បៃតងនៃជោគជ័យ',
                    !!pending && pending.bg !== successBg, { toast: pending && pending.bg, success: successBg });

                await page.evaluate(() => {
                    window.__toastProbe.set({ connected: true, pending: ['history', 'deleted'] });
                    window.__toastProbe.render();
                });
                const loading = await readToast(page);
                if (app === 'ZoeW') {
                    ok(app + ' ៖ socket ឡើង តែ snapshot មិនទាន់មក ➜ នៅមិនអះអាងជោគជ័យ',
                        !!loading && loading.text.indexOf('ជោគជ័យ') === -1, loading);
                }
                ok(app + ' ៖ ការធ្វើឲ្យស្រស់ប្រើ **ធាតុដដែល** (realtime មិនមែន toast ថ្មី)',
                    !!loading && loading.stamp === 'first' &&
                    (await page.evaluate(() => document.querySelectorAll('#toastContainer .toast').length)) === 1,
                    loading);

                await page.evaluate(() => {
                    window.__toastProbe.set({ connected: true, pending: [] });
                    window.__toastProbe.render();
                });
                const settled = await readToast(page);
                ok(app + ' ៖ ភ្ជាប់រួច ហើយទិន្នន័យមកដល់ ➜ ទើបប្រកាសជោគជ័យ',
                    !!settled && settled.text.indexOf('ជោគជ័យ') !== -1, settled);
                ok(app + ' ៖ ជាមួយពណ៌ជោគជ័យពិត',
                    !!settled && settled.bg === successBg, { toast: settled && settled.bg, success: successBg });
                ok(app + ' ៖ ហើយវាឈប់ «រស់» ទៀត (លែងសរសេរជាន់)',
                    !!settled && settled.live === null &&
                    (await page.evaluate(() => window.__toastProbe.liveCount())) === 0, settled);

                // ⛔ toast ដែល «រស់» មិនត្រូវត្រូវបានច្រានចេញដោយសារសារធម្មតា។
                // `showToast()` កាត់ប្រអប់ត្រឹម ៤ ដោយ `removeChild(firstChild)` —
                // ហើយ toast ដែលរស់ជាធាតុ **ចាស់ជាងគេ** ជានិច្ច (វាកើតពេលចូល
                // ប្រព័ន្ធ) ➜ ការស្កេនត្រឹម ៤ ដង **លុបវាចោល** ➜ អ្នកប្រើលែងឃើញ
                // ការប្តូរទៅ «ជោគជ័យ» ឬ «ដាច់ការទាញទិន្នន័យ» ទៀត។ ស្ថានភាព
                // នៅជាប់នឹងអ្វីដែលគេឃើញចុងក្រោយ ➜ **បង្ហាញស្ថានភាពខុស**
                // ដែលជាថ្នាក់ដដែលនឹងកំណែ 2.19.0។
                await page.evaluate(() => {
                    window.__toastProbe.clear();
                    window.__toastProbe.set({ connected: false, session: 'live' });
                    window.__toastProbe.signin();
                    const el = document.querySelector('#toastContainer [data-live-toast]');
                    if (el) el.__floodStamp = 'live';
                    window.__toastProbe.flood(6);
                });
                const survived = await page.evaluate(() => ({
                    live: window.__toastProbe.liveCount(),
                    total: window.__toastProbe.count()
                }));
                ok(app + ' ៖ ⛔ សារធម្មតា ៦ ដង មិនត្រូវច្រាន toast ស្ថានភាពដែលរស់ចេញ',
                    survived.live === 1, survived);
                ok(app + ' ៖ ហើយប្រអប់នៅតែមានពិដាន (មិនកកកុញ)',
                    survived.total <= 4, survived);
                // ២ ខាង ៖ សេចក្តីពិតបន្ទាប់ត្រូវទៅដល់ធាតុដែលរស់នោះពិត
                await page.evaluate(() => {
                    window.__toastProbe.set({ connected: true, pending: [] });
                    window.__toastProbe.render();
                });
                const afterFlood = await page.evaluate(() => {
                    const all = document.querySelectorAll('#toastContainer .toast');
                    for (let i = 0; i < all.length; i++) {
                        if (all[i].__floodStamp === 'live') return all[i].textContent;
                    }
                    return null;
                });
                ok(app + ' ៖ ហើយសេចក្តីពិតបន្ទាប់ទៅដល់វា (ប្រកាសជោគជ័យ)',
                    !!afterFlood && afterFlood.indexOf('ជោគជ័យ') !== -1, afterFlood);

                // វគ្គដែលបានបញ្ចប់ ៖ ២ ខាង — បដិសេធពេលស្លាប់ ហើយនៅតែប្រកាសពេលរស់
                const warnBg = await page.evaluate(() => {
                    const probe = document.createElement('div');
                    probe.className = 'toast toast-warn';
                    document.getElementById('toastContainer').appendChild(probe);
                    const bg = getComputedStyle(probe).backgroundColor;
                    probe.remove();
                    return bg;
                });
                const deadSession = app === 'ZoeW' ? 'expired' : 'out';
                await page.evaluate((session) => {
                    window.__toastProbe.clear();
                    window.__toastProbe.set({ connected: false, session: 'live' });
                    window.__toastProbe.signin();
                    window.__toastProbe.set({ connected: true, pending: [], session: session });
                    window.__toastProbe.render();
                }, deadSession);
                const dead = await readToast(page);
                ok(app + ' ៖ វគ្គបានបញ្ចប់ ➜ toast ដដែលឈប់អះអាងជោគជ័យ',
                    !!dead && dead.text.indexOf('ជោគជ័យ') === -1, dead);
                ok(app + ' ៖ ហើយវាប្រាប់ថាត្រូវចូលប្រព័ន្ធម្ដងទៀត',
                    !!dead && dead.text.indexOf('ចូលប្រព័ន្ធម្ដងទៀត') !== -1, dead);
                ok(app + ' ៖ ជាមួយពណ៌ព្រមាន មិនមែនពណ៌ជោគជ័យ',
                    !!dead && dead.bg === warnBg && dead.bg !== successBg,
                    { toast: dead && dead.bg, warn: warnBg, success: successBg });
                ok(app + ' ៖ ហើយវាឈប់ «រស់» (មិនអាចត្រូវសរសេរជាន់ជាជោគជ័យទៀតទេ)',
                    !!dead && dead.live === null &&
                    (await page.evaluate(() => window.__toastProbe.liveCount())) === 0, dead);

                await page.evaluate(() => {
                    window.__toastProbe.clear();
                    window.__toastProbe.set({ connected: false, session: 'live' });
                    window.__toastProbe.signin();
                    window.__toastProbe.set({ connected: true, pending: [], session: 'live' });
                    window.__toastProbe.render();
                });
                const alive = await readToast(page);
                ok(app + ' ៖ ខាងទីពីរ ៖ វគ្គនៅរស់ ➜ វានៅតែប្រកាសជោគជ័យដដែល',
                    !!alive && alive.text.indexOf('ជោគជ័យ') !== -1 && alive.bg === successBg, alive);
            }
        } catch (e) {
            ok(app + ' ៖ ការវាស់ក្នុង browser រត់បាន', false, String(e && e.message));
        }
        await ctx.close();
        server.close();
    }

    await browser.close();
    console.log('\nសរុប: ' + pass + ' ok, ' + fail + ' FAIL');
    process.exit(fail ? 1 : 0);
})();
