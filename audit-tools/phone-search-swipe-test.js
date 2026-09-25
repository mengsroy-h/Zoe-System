const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { reactRuntime, renderFromContext, elementById, jsxHandler, sliceConst } = require('./react-view');

const ROOT = process.env.SWIPE_APP_DIR || path.join(__dirname, '..');
let pass = 0, fail = 0;
function ok(cond, label, got) {
    if (cond) { pass++; console.log('   ok    ' + label); }
    else { fail++; console.log('   FAIL  ' + label + (got !== undefined ? '  ➜ ' + JSON.stringify(got) : '')); }
}

process.on('uncaughtException', (e) => {
    console.log('   FAIL  ' + e.message);
    console.log('\n❌ ធ្លាក់ — កូដដែលតេស្តនេះការពារ បាត់ពី tree ដែលកំពុងពិនិត្យ');
    process.exit(1);
});

function sliceFn(src, name) {
    const start = src.indexOf('function ' + name + '(');
    if (start === -1) throw new Error('not found: function ' + name + ' — មុខងារនេះបាត់ពី app.js');
    let depth = 0, i = src.indexOf('{', src.indexOf(')', start)), started = false;
    for (; i < src.length; i++) {
        if (src[i] === '{') { depth++; started = true; }
        else if (src[i] === '}') { depth--; if (started && depth === 0) { i++; break; } }
    }
    return src.slice(start, i);
}

function makeClassList(initial) {
    const set = new Set(initial || []);
    return {
        add: (c) => set.add(c),
        remove: (c) => set.delete(c),
        contains: (c) => set.has(c),
        toggle: (c, force) => {
            if (force === undefined) return set.has(c) ? (set.delete(c), false) : (set.add(c), true);
            if (force) { set.add(c); return true; }
            set.delete(c); return false;
        },
        _set: set
    };
}

// ⛔ ZoeW ជា React ៖ class របស់ផ្ទាំង (`collapsed` · `search-focus` · `history-expanded` · `show` · `hidden` · `active`)
//    ជា **JSX ពិត** ដែលគូរពី state (`uiState.dataPanelCollapsed` …) ➜ `classList.contains()` អានពីការគូរពិតរបស់
//    component (`AppPages.tsx` គូរ `PageData` · `PageEntry` ផង) មិនមែន Set ក្លែង។
const APP_PAGES = ['src/app/components/AppPages.tsx', 'AppPages'];
const RENDERED_IN = { phoneSuggestBox: ['src/app/components/PhoneSuggestBox.tsx', 'PhoneSuggestBox'] };
// ⛔ **សម្រាប់ការរៀបចំសេណារីយ៉ូតែប៉ុណ្ណោះ** ៖ class ➜ state ដែល JSX អាន។ ការសរសេរនីមួយៗ **ផ្ទៀងផ្ទាត់** ថា JSX
//    ពិតគូរ class នោះមែន (បើការផ្គូផ្គងខុស ➜ បោះ) ➜ តារាងនេះមិនអាចកុហកដោយស្ងាត់ទេ។
const CLASS_STATE = {
    dataSideSection: { collapsed: 'uiState.dataPanelCollapsed', 'search-focus': 'uiState.dataPanelSearchFocus' },
    entrySideSection: { collapsed: 'uiState.entryPanelCollapsed' },
    phoneSuggestBox: { show: 'uiState.phoneSuggestOpen' }
};
function renderedClassList(ctx, id) {
    const [rel, name] = RENDERED_IN[id] || APP_PAGES;
    const classes = () => {
        const el = elementById(renderFromContext(ROOT, ctx, rel, name), id);
        if (!el) throw new Error('JSX មិនគូរ #' + id);
        return new Set(el.className.split(/\s+/).filter(Boolean));
    };
    const write = (c, on) => {
        const target = (CLASS_STATE[id] || {})[c];
        if (!target) throw new Error('គ្មាន state សម្រាប់ .' + c + ' លើ #' + id);
        vm.runInContext(target + ' = ' + (on ? 'true' : 'false'), ctx);
        if (classes().has(c) !== on) throw new Error('class ↔ state មិនស៊ីនឹង JSX ពិត ៖ #' + id + '.' + c);
    };
    return { contains: (c) => classes().has(c), add: (c) => write(c, true), remove: (c) => write(c, false) };
}
function declOf(src, name, fallback) {
    return (src.match(new RegExp('^ *(?:let|const) ' + name + ' = .*$', 'm')) || [fallback])[0];
}

function buildEnv(src, opts) {
    const o = opts || {};
    const handlers = {};
    const listenerOptions = {};
    const OWNED = {
        dataMainSection: ['tableResponsive'],
        entryMainSection: ['entryTableResponsive', 'lockerTableResponsive']
    };
    const mkEl = (id, extra) => Object.assign({
        id,
        classList: makeClassList(),
        scrollTop: 0,
        value: '',
        contains: (el) => !!el && (OWNED[id] || []).indexOf(el.id) !== -1,
        // ធាតុ DOM ពិតតែងតែមាន — `panelGlideFrom()` អានវាដើម្បីគណនាចម្ងាយ FLIP
        getBoundingClientRect: () => ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 }),
        animate: undefined,
        addEventListener: (type, fn, options) => {
            (handlers[id] = handlers[id] || {})[type] = fn;
            (listenerOptions[id] = listenerOptions[id] || {})[type] = options;
        }
    }, extra || {});

    const els = {
        dataSideSection: mkEl('dataSideSection'),
        dataMainSection: mkEl('dataMainSection'),
        tableResponsive: mkEl('tableResponsive'),
        appPages: mkEl('appPages'),
        pageData: mkEl('pageData'),
        pageEntry: mkEl('pageEntry'),
        entrySideSection: mkEl('entrySideSection'),
        entryMainSection: mkEl('entryMainSection'),
        entryDragHandle: mkEl('entryDragHandle'),
        entryTableResponsive: mkEl('entryTableResponsive'),
        lockerTableResponsive: mkEl('lockerTableResponsive'),
        lockerPanel: mkEl('lockerPanel'),
        dragHandle: mkEl('dragHandle'),
        phoneSuggestBox: mkEl('phoneSuggestBox'),
        searchPhoneInput: mkEl('searchPhoneInput', { value: o.searchActive ? '012' : '' })
    };

    const calls = { hideSuggest: 0, position: 0, frames: [], prevented: 0 };
    const ctx = {
        console, queueMicrotask,
        clearTimeout: () => {},
        setTimeout: () => 0,
        requestAnimationFrame(fn) { calls.frames.push(fn); return calls.frames.length; },
        window: {
            innerWidth: o.innerWidth || 400,
            navigator: { standalone: !!o.iosWebKit },
            CSS: { supports: (property, value) => !!o.iosWebKit && property === '-webkit-touch-callout' && value === 'none' }
        },
        scheduleChromeLayoutSettle() {},
        clearZtoPickupStatusStore() {},
        positionPhoneSuggestBox() { calls.position++; },
        document: {
            getElementById: (id) => els[id] || null,
            activeElement: o.searchActive ? els.searchPhoneInput : null,
            body: { style: {}, classList: { add() {}, remove() {}, contains: () => false } }
        }
    };
    ctx.window.document = ctx.document;
    ctx.CSS = ctx.window.CSS;
    vm.createContext(ctx);
    vm.runInContext(reactRuntime(src, { context: ctx }), ctx);
    // ទំព័រសកម្ម = `currentAppPage` (App ដើម ៖ class `.page.active`)
    const page = o.entryPageActive ? 'entry' : (o.dataPageActive === false ? 'none' : 'data');
    vm.runInContext('let currentAppPage = ' + JSON.stringify(page) + ';', ctx);
    ['phoneSuggestHideTimer', 'phoneSuggestItems', 'phoneSuggestActiveIndex'].forEach((n, i) => {
        vm.runInContext(declOf(src, n, ['let phoneSuggestHideTimer = null;', 'let phoneSuggestItems = [];', 'let phoneSuggestActiveIndex = -1;'][i]), ctx);
    });
    vm.runInContext(sliceConst(src, 'PANEL_SECTIONS') || 'const PANEL_SECTIONS = {};', ctx);
    vm.runInContext((src.match(/^ *let chromeHidden = .*$/m) || ['let chromeHidden = false;'])[0], ctx);
    vm.runInContext(sliceFn(src, 'showAppChrome'), ctx);
    vm.runInContext(sliceFn(src, 'entryScrollerInView'), ctx);
    vm.runInContext(sliceFn(src, 'activePanelSections'), ctx);
    vm.runInContext(sliceFn(src, 'usesIOSPanelHandoff'), ctx);
    vm.runInContext(sliceFn(src, 'syncHistoryExpandedLock'), ctx);
    vm.runInContext(sliceFn(src, 'setPhoneSearchPulledUp'), ctx);
    vm.runInContext(sliceFn(src, 'phoneSearchIsActive'), ctx);
    vm.runInContext((src.match(/^ *const iosTouchArbiter = .*$/m) || ["const iosTouchArbiter = { id: null, phase: 'idle', blockPanel: false };"])[0], ctx);
    vm.runInContext(sliceFn(src, 'touchByIdentifier'), ctx);
    vm.runInContext(sliceFn(src, 'panelBlockedForTouch'), ctx);
    vm.runInContext(sliceFn(src, 'panelMayYieldToPTR'), ctx);
    vm.runInContext(sliceFn(src, 'panelMotionAllowed'), ctx);
    vm.runInContext(sliceFn(src, 'panelGlideFrom'), ctx);
    // ⛔ React ៖ ស្ថានភាពផ្ទាំងជា state (`setPanelCollapsed()` · `panelIsCollapsed()`) · ដងអូសជា `onClick` ក្នុង JSX
    //    (`togglePanelFromHandle()`) · បញ្ជីស្នើបិទតាម `hidePhoneSuggestions()` ពិត (រាប់ការហៅ)
    ['blockPanelForIOSTouch', 'setPanelCollapsed', 'panelIsCollapsed', 'panelHasSearchFocus', 'togglePanelFromHandle',
        'hidePhoneSuggestions'].forEach((n) => vm.runInContext(sliceFn(src, n), ctx));
    ctx.__calls = calls;
    vm.runInContext('const __realHidePhoneSuggestions = hidePhoneSuggestions;'
        + ' hidePhoneSuggestions = function () { __calls.hideSuggest++; return __realHidePhoneSuggestions(); };', ctx);
    vm.runInContext(sliceFn(src, 'bindPanelSwipe'), ctx);
    vm.runInContext(sliceFn(src, 'setupSwipeGestures'), ctx);
    ['dataSideSection', 'entrySideSection', 'appPages', 'phoneSuggestBox', 'lockerPanel', 'pageData', 'pageEntry']
        .forEach((id) => { els[id].classList = renderedClassList(ctx, id); });
    (o.sideClasses || []).forEach((c) => els.dataSideSection.classList.add(c));
    (o.entrySideClasses || []).forEach((c) => els.entrySideSection.classList.add(c));
    if (o.suggestOpen) els.phoneSuggestBox.classList.add('show');
    ctx.setupSwipeGestures();
    // ⛔ handler របស់ដងអូស ដេរីវេពី `onClick` ក្នុង JSX ពិត (`react-render.cjs`) មិនមែនការសន្មត
    ['dragHandle', 'entryDragHandle'].forEach((id) => {
        const h = jsxHandler(ROOT, id, 'onClick');
        if (!h || typeof ctx[h.name] !== 'function') throw new Error('JSX ៖ រក onClick របស់ #' + id + ' មិនឃើញ');
        (handlers[id] = handlers[id] || {}).click = () => ctx[h.name].apply(null, h.args || []);
    });
    return { ctx, els, handlers, listenerOptions, calls };
}

function swipe(handlers, el, fromY, toY) {
    handlers[el].touchstart({ touches: [{ identifier: 1, clientX: 0, clientY: fromY }] });
    handlers[el].touchmove({ touches: [{ identifier: 1, clientX: 0, clientY: toY }] });
    if (handlers[el].touchend) handlers[el].touchend(touchEndEvent(toY));
}

// អូសដោយ **មិនទាន់លើកម្រាមដៃ** — ប្រើដើម្បីវាស់ថាសោមិនអនុវត្តចំពេលកំពុងអូស
function swipeHold(handlers, el, fromY, toY) {
    handlers[el].touchstart({ touches: [{ identifier: 1, clientX: 0, clientY: fromY }] });
    handlers[el].touchmove({ touches: [{ identifier: 1, clientX: 0, clientY: toY }] });
}

function touchEndEvent(clientY, clientX) {
    return { touches: [], changedTouches: [{ identifier: 1, clientX: clientX || 0, clientY }] };
}

const src = fs.readFileSync(path.join(ROOT, 'ZoeW', 'app.js'), 'utf8');

console.log('\n=== សោប្រវត្តិពេញអេក្រង់ជាប់តែទំព័រទិន្នន័យ ===');
{
    const onData = buildEnv(src, {});
    onData.els.dataSideSection.classList.add('collapsed');
    onData.els.appPages.scrollTop = 34;
    onData.ctx.syncHistoryExpandedLock();
    ok(onData.els.appPages.classList.contains('history-expanded'),
        'ទំព័រទិន្នន័យសកម្ម + ផ្ទាំងបង្រួម ➜ ដាក់ history-expanded');
    ok(onData.els.appPages.scrollTop === 0,
        'មុនចាក់សោ outer scroller ➜ លុប scrollTop ចាស់ (កាតមិនឡើងក្រោម navbar)');

    const onEntry = buildEnv(src, { dataPageActive: false });
    onEntry.els.dataSideSection.classList.add('collapsed');
    onEntry.ctx.syncHistoryExpandedLock();
    ok(!onEntry.els.appPages.classList.contains('history-expanded'),
        'ទំព័រទិន្នន័យមិនសកម្ម ➜ មិនដាក់ history-expanded (ទំព័រ ២ រមូរបាន)');
}

console.log('\n=== ទំព័រ ២ (បញ្ចូលទិន្នន័យ) ហូតឡើងចុះដូចប្រវត្តិដែរ ===');
{
    const { els, handlers } = buildEnv(src, { dataPageActive: false, entryPageActive: true });
    ok(!!handlers.entryMainSection, 'ដងអូស/ការអូសត្រូវបានចង លើ #entryMainSection');
    swipe(handlers, 'entryMainSection', 300, 200);
    ok(els.entrySideSection.classList.contains('collapsed'),
        'អូសឡើងលើទំព័រ ២ ➜ ផ្ទាំងកាមេរ៉ាបង្រួម');
    ok(els.appPages.classList.contains('history-expanded'),
        'ហើយបញ្ជីកញ្ចប់ថ្ងៃនេះហូតឡើងពេញអេក្រង់ (សោដូចប្រវត្តិ)');
    swipe(handlers, 'entryMainSection', 200, 300);
    ok(!els.entrySideSection.classList.contains('collapsed'),
        'អូសចុះវិញ ➜ ផ្ទាំងកាមេរ៉ាត្រឡប់មក');
    ok(!els.appPages.classList.contains('history-expanded'), 'ហើយសោត្រូវដោះ');

    const byHandle = buildEnv(src, { dataPageActive: false, entryPageActive: true });
    byHandle.handlers.entryDragHandle.click();
    ok(byHandle.els.entrySideSection.classList.contains('collapsed'),
        'ចុចដងអូសទំព័រ ២ ➜ បង្រួម');
    ok(byHandle.els.appPages.classList.contains('history-expanded'), 'ហើយចាក់សោភ្លាម');

    // ទំព័រ ២ មិនត្រូវប៉ះផ្ទាំងទំព័រ ១ ទេ
    ok(!byHandle.els.dataSideSection.classList.contains('collapsed'),
        'ការអូសលើទំព័រ ២ មិនប៉ះផ្ទាំងទំព័រ ១');
}

console.log('\n=== layout មិនប្តូរចំពេលម្រាមដៃនៅលើអេក្រង់ ===');
{
    // iOS រក្សា scroll owner រហូតដល់ម្រាមដៃលែងពីអេក្រង់។ បើ class `collapsed`
    // ឬ `history-expanded` ប្តូរនៅកណ្ដាល touch នោះកន្សោមរមូរប្តូរភ្លាម ហើយ offset
    // អាចជាប់ក្រោម navbar។ ដូច្នេះ queue ចេតនា រួចអនុវត្តតែពេល touchend។
    const { els, handlers } = buildEnv(src, {});
    swipeHold(handlers, 'dataMainSection', 300, 200);
    ok(!els.dataSideSection.classList.contains('collapsed'),
        'កំពុងអូស ➜ ផ្ទាំងមិនទាន់ប្តូរ (scroll owner នៅដដែល)');
    ok(!els.appPages.classList.contains('history-expanded'),
        'កំពុងអូស ➜ **មិនទាន់** ចាក់សោកន្សោមរមូរ (ការរមូរមិនត្រូវកាត់ផ្តាច់)');
    handlers.dataMainSection.touchend(touchEndEvent(200));
    ok(els.dataSideSection.classList.contains('collapsed'),
        'លើកម្រាមដៃ ➜ ទើបបង្រួមផ្ទាំង');
    ok(els.appPages.classList.contains('history-expanded'),
        'លើកម្រាមដៃ ➜ ទើបចាក់សោ ហើយបញ្ជីហូតឡើងពេញអេក្រង់');

    const cancelled = buildEnv(src, {});
    swipeHold(cancelled.handlers, 'dataMainSection', 300, 200);
    cancelled.handlers.dataMainSection.touchcancel(touchEndEvent(200));
    ok(!cancelled.els.dataSideSection.classList.contains('collapsed') &&
       !cancelled.els.appPages.classList.contains('history-expanded'),
        'touchcancel ➜ បោះបង់ការប្តូរ layout ទាំងមូល');
}

console.log('\n=== អូសឡើង/ចុះ ➜ ប្រវត្តិហូតឡើងចុះ ===');
{
    const { els, handlers } = buildEnv(src, {});
    swipe(handlers, 'dataMainSection', 300, 200);
    ok(els.dataSideSection.classList.contains('collapsed'),
        'អូសឡើង ➜ ផ្ទាំងខាងលើបង្រួម ហើយប្រវត្តិឡើងពេញ');
    ok(els.appPages.classList.contains('history-expanded'),
        'ពេលពង្រីកប្រវត្តិ ➜ ចាក់សោ overscroll លើ #appPages');
    els.tableResponsive.scrollTop = 0;
    swipe(handlers, 'dataMainSection', 200, 300);
    ok(!els.dataSideSection.classList.contains('collapsed'),
        'អូសចុះ ➜ ផ្ទាំងខាងលើត្រឡប់មកវិញ');
    ok(!els.appPages.classList.contains('history-expanded'),
        'ដោះសោ overscroll វិញ');
}

console.log('\n=== អូសចុះលើតារាងផ្ទាល់ (ពេលប្រវត្តិពេញអេក្រង់) ===');
{
    const { els, handlers } = buildEnv(src, { sideClasses: ['collapsed'] });
    els.tableResponsive.scrollTop = 40;
    swipe(handlers, 'tableResponsive', 200, 300);
    ok(els.dataSideSection.classList.contains('collapsed'),
        'តារាងកំពុង scroll នៅកណ្តាល ➜ មិនទាន់បើកវិញទេ');
    els.tableResponsive.scrollTop = 0;
    swipe(handlers, 'tableResponsive', 200, 300);
    ok(!els.dataSideSection.classList.contains('collapsed'),
        'ដល់កំពូលតារាង រួចអូសចុះ ➜ ផ្ទាំងខាងលើត្រឡប់មកវិញ');
}

console.log('\n=== iOS ប្រគល់ gesture ពីតារាងទៅផ្ទាំង ដោយមិន rubber-band ===');
{
    const android = buildEnv(src, { sideClasses: ['collapsed'] });
    ok(android.listenerOptions.tableResponsive.touchmove.passive === true,
        'Android ➜ touchmove របស់តារាងនៅ passive ដដែល');
    let androidPrevented = 0;
    android.handlers.tableResponsive.touchstart({ touches: [{ identifier: 1, clientX: 0, clientY: 200 }] });
    android.handlers.tableResponsive.touchmove({
        touches: [{ identifier: 1, clientX: 0, clientY: 260 }], cancelable: true,
        preventDefault() { androidPrevented++; }
    });
    ok(androidPrevented === 0, 'Android ➜ មិនមាន iOS preventDefault ឆ្លងមកប៉ះ');

    const iosNormal = buildEnv(src, { iosWebKit: true });
    iosNormal.calls.frames.length = 0;
    iosNormal.els.appPages.scrollTop = 44;
    iosNormal.ctx.syncHistoryExpandedLock();
    ok(iosNormal.els.appPages.scrollTop === 44 && iosNormal.calls.frames.length === 0,
        'iOS ស្ថានភាពធម្មតា ➜ no-op sync មិន reset outer scroll');

    const jitter = buildEnv(src, { iosWebKit: true, sideClasses: ['collapsed'] });
    jitter.els.tableResponsive.scrollTop = 0;
    jitter.handlers.tableResponsive.touchstart({ touches: [{ identifier: 1, clientX: 0, clientY: 200 }] });
    const jitterMove = {
        touches: [{ identifier: 1, clientX: 0, clientY: 204 }], cancelable: true, defaultPrevented: false,
        preventDefault() { this.defaultPrevented = true; }
    };
    jitter.handlers.tableResponsive.touchmove(jitterMove);
    jitter.handlers.tableResponsive.touchcancel(touchEndEvent(204));
    ok(!jitterMove.defaultPrevented && jitter.els.dataSideSection.classList.contains('collapsed'),
        'iOS jitter 4px លើជួរទីមួយ ➜ មិនទប់ tap និងមិនប្តូរផ្ទាំង');

    const crossing = buildEnv(src, { iosWebKit: true, sideClasses: ['collapsed'] });
    crossing.els.tableResponsive.scrollTop = 18;
    crossing.handlers.tableResponsive.touchstart({ touches: [{ identifier: 1, clientX: 0, clientY: 200 }] });
    crossing.handlers.tableResponsive.touchmove({
        touches: [{ identifier: 1, clientX: 0, clientY: 270 }], cancelable: true, preventDefault() {}
    });
    crossing.els.tableResponsive.scrollTop = 0;
    crossing.handlers.tableResponsive.scroll({});
    crossing.els.tableResponsive.scrollTop = 2;
    crossing.handlers.tableResponsive.touchend(touchEndEvent(270));
    ok(!crossing.els.dataSideSection.classList.contains('collapsed'),
        'iOS move ចុងក្រោយឆ្លងពី 18px ដល់កំពូល ហើយ touchend stale 2px ➜ បើកផ្ទាំងបាន');

    const ios = buildEnv(src, { iosWebKit: true, sideClasses: ['collapsed'] });
    ios.calls.frames.length = 0;
    ios.els.tableResponsive.scrollTop = 0.5;
    ok(ios.listenerOptions.tableResponsive.touchmove.passive === false,
        'iOS ➜ touchmove របស់តារាងត្រៀម non-passive តាំងពី touchstart');
    ios.handlers.tableResponsive.touchstart({ touches: [{ identifier: 1, clientX: 0, clientY: 200 }] });
    const move = {
        touches: [{ identifier: 1, clientX: 0, clientY: 270 }], cancelable: true, defaultPrevented: false,
        preventDefault() { this.defaultPrevented = true; ios.calls.prevented++; }
    };
    ios.handlers.tableResponsive.touchmove(move);
    ok(move.defaultPrevented && ios.calls.prevented === 1,
        'iOS + តារាងនៅកំពូល ➜ ទប់ rubber-band មុន Safari ដណ្ដើម scroll owner');
    ios.els.tableResponsive.scrollTop = 2;
    ios.handlers.tableResponsive.touchend(touchEndEvent(270));
    ok(!ios.els.dataSideSection.classList.contains('collapsed'),
        'iOS ឈានដល់ 0.5px ហើយ touchend អាន 2px ➜ intent នៅតែបើកផ្ទាំងបាន');
    ok(!ios.els.appPages.classList.contains('history-expanded'),
        'iOS handoff ➜ ដោះសោ outer scroller តែម្តង');
    ios.els.appPages.scrollTop = 72;
    const firstPin = ios.calls.frames.shift();
    if (firstPin) firstPin();
    ok(ios.els.appPages.scrollTop === 0,
        'iOS frame ទី១ ➜ scroll anchoring មិនអាចរុញកាតឡើងវិញ');
    ios.els.appPages.scrollTop = 91;
    const secondPin = ios.calls.frames.shift();
    if (secondPin) secondPin();
    ok(ios.els.appPages.scrollTop === 0,
        'iOS frame ទី២ ➜ momentum/snap យឺតមិនអាចរុញកាតឡើងវិញ');

    const reversed = buildEnv(src, { iosWebKit: true, sideClasses: ['collapsed'] });
    reversed.els.tableResponsive.scrollTop = 0;
    reversed.handlers.tableResponsive.touchstart({ touches: [{ identifier: 1, clientX: 0, clientY: 200 }] });
    reversed.handlers.tableResponsive.touchmove({
        touches: [{ identifier: 1, clientX: 0, clientY: 280 }], cancelable: true, preventDefault() {}
    });
    reversed.els.tableResponsive.scrollTop = 2;
    reversed.handlers.tableResponsive.touchend(touchEndEvent(215));
    ok(reversed.els.dataSideSection.classList.contains('collapsed'),
        'iOS បញ្ច្រាសម្រាមដៃមុន touchend ➜ បោះបង់ intent ចាស់ មិនបើកផ្ទាំង');

    const cancelled = buildEnv(src, { iosWebKit: true, sideClasses: ['collapsed'] });
    cancelled.handlers.tableResponsive.touchstart({ touches: [{ identifier: 1, clientX: 0, clientY: 200 }] });
    cancelled.handlers.tableResponsive.touchmove({
        touches: [{ identifier: 1, clientX: 0, clientY: 280 }], cancelable: true, preventDefault() {}
    });
    cancelled.handlers.tableResponsive.touchcancel(touchEndEvent(280));
    ok(cancelled.els.dataSideSection.classList.contains('collapsed'),
        'iOS touchcancel ➜ នៅតែបោះបង់ gesture ទាំងមូល');

    const bubbled = buildEnv(src, { iosWebKit: true, sideClasses: ['collapsed'] });
    const start = { touches: [{ identifier: 1, clientX: 0, clientY: 200 }] };
    const drag = {
        touches: [{ identifier: 1, clientX: 0, clientY: 280 }], cancelable: true, preventDefault() {}
    };
    const end = touchEndEvent(280);
    bubbled.handlers.tableResponsive.touchstart(start);
    bubbled.handlers.dataMainSection.touchstart(start);
    bubbled.handlers.tableResponsive.touchmove(drag);
    bubbled.handlers.dataMainSection.touchmove(drag);
    bubbled.handlers.tableResponsive.touchend(end);
    bubbled.handlers.dataMainSection.touchend(end);
    ok(!bubbled.els.dataSideSection.classList.contains('collapsed') &&
       !bubbled.els.appPages.classList.contains('history-expanded'),
        'iOS event ហូរពីតារាងទៅ parent ➜ ប្តូរស្ថានភាពតែម្តង មិនលោតត្រឡប់');
    // កំណែ 2.11.4៖ ការលើកលែង iOS ត្រូវ **ដកចេញ** — មុននេះ `expand` លើ iOS
    // មិន animate សោះ ➜ ផ្ទាំងលោតភ្លាម ខណៈ Android រអិល ➜ អ្នកប្រើឃើញ
    // «ដូច App ២ ផ្សេងគ្នា»។ ជំនួសវិញ `panelGlideFrom()` ផ្អាក snap
    // បណ្តោះអាសន្នដើម្បីកុំឲ្យ WebKit snap ជាន់ចលនា។
    ok(!/iosPanelHandoff \|\| action !== 'expand'/.test(src),
        'ការលើកលែង iOS លើ expand ត្រូវដកចេញ (ផ្ទាំងលែងលោតលើ iPhone)');
    ok(!/iosPanelHandoff \|\| sidebar\.classList\.contains\('collapsed'\)/.test(src),
        'ការលើកលែង iOS លើ drag handle ត្រូវដកចេញដែរ');
    ok((src.match(/panelGlideFrom\(mainSection, beforeTop\);/g) || []).length === 2 &&
       !/\|\|[^\n]*panelGlideFrom\(mainSection, beforeTop\)/.test(src),
        'panelGlideFrom ត្រូវហៅគ្មានលក្ខខណ្ឌទាំង ២ កន្លែង (iOS = Android)');
    // **ចំណុចស្លាប់រស់**៖ បើ `panel-gliding` ជាប់ នោះចំណុច snap «បើក» ធ្លាក់
    // ត្រឹម scrollTop 71 ➜ PTR លែងកេះបានទាំងស្រុង។ ត្រូវមានផ្លូវដកចេញទាំង
    // ពេលចលនាចប់ (`finished`) និង timer សុវត្ថិភាព។
    // ⛔ React ៖ ការផ្អាក = `uiState.panelGliding` ➜ `AppPages.tsx` គូរ `.panel-gliding` (វាស់លើ JSX ពិត)
    const glideEnv = buildEnv(src, {});
    ok(/uiState\.panelGliding = true/.test(sliceFn(src, 'beginPanelGlideSnapPause'))
        && /uiState\.panelGliding = false/.test(sliceFn(src, 'endPanelGlideSnapPause')),
        'panelGlideFrom ផ្អាក snap ហើយមានផ្លូវដកចេញវិញ');
    vm.runInContext('uiState.panelGliding = true;', glideEnv.ctx);
    const glidingShown = glideEnv.els.appPages.classList.contains('panel-gliding');
    vm.runInContext('uiState.panelGliding = false;', glideEnv.ctx);
    ok(glidingShown && !glideEnv.els.appPages.classList.contains('panel-gliding'),
        'JSX ពិតគូរ/ដក `.panel-gliding` តាមស្ថានភាពផ្អាក (snap ផ្អាក ➜ ត្រឡប់វិញ)');
    ok(/anim\.finished\.then\(release, release\)/.test(src),
        'ការដក snap pause ប្រើ .then(ok, fail) ២ អាគុយម៉ង់ តាមច្បាប់គម្រោង');
    ok(/setTimeout\(endPanelGlideSnapPause, PANEL_GLIDE_MS \+ PANEL_GLIDE_SNAP_GRACE_MS\)/.test(src),
        'មាន timer សុវត្ថិភាព ➜ snap ត្រឡប់មកវិញទោះចលនាត្រូវកាត់ផ្តាច់');
}

console.log('\n=== កំពុងស្វែងរកលេខទូរស័ព្ទ — កុំលុបអ្វីដែលអ្នកប្រើកំពុងវាយ ===');
{
    const { els, handlers } = buildEnv(src, { searchActive: true, suggestOpen: true });
    swipe(handlers, 'dataMainSection', 300, 200);
    ok(!els.dataSideSection.classList.contains('collapsed'),
        'អូសឡើង ➜ មិនបិទប្រអប់ស្វែងរកដែលកំពុងវាយទេ');
    ok(els.phoneSuggestBox.classList.contains('show'),
        'បញ្ជីស្នើលេខនៅតែបង្ហាញ');
}
{
    const { els, handlers } = buildEnv(src, { searchActive: false, suggestOpen: true });
    swipe(handlers, 'dataMainSection', 300, 200);
    ok(!els.dataSideSection.classList.contains('collapsed'),
        'បញ្ជីស្នើបើក តែ input មិន focus ➜ នៅតែការពារ');
}
{
    const { els, handlers } = buildEnv(src, { searchActive: true, suggestOpen: false });
    swipe(handlers, 'dataMainSection', 300, 200);
    ok(!els.dataSideSection.classList.contains('collapsed'),
        'វាយហើយ តែមិនទាន់មានលទ្ធផល ➜ នៅតែការពារ');
}

console.log('\n=== ចុចដងអូស (drag handle) ជាផ្លូវច្បាស់លាស់របស់អ្នកប្រើ ===');
{
    const { els, handlers } = buildEnv(src, { searchActive: true, suggestOpen: true });
    handlers.dragHandle.click();
    ok(els.dataSideSection.classList.contains('collapsed'),
        'ចុចដងអូស ➜ បង្រួម ទោះកំពុងស្វែងរក (ចេតនាច្បាស់លាស់)');
    ok(!els.phoneSuggestBox.classList.contains('show'),
        'ហើយបិទបញ្ជីស្នើមុន មិនទុកឲ្យអណ្តែត');
    handlers.dragHandle.click();
    ok(!els.dataSideSection.classList.contains('collapsed'), 'ចុចម្តងទៀត ➜ បើកវិញ');
}

console.log('\n=== auto pull up ពេលចុចប្រអប់ស្វែងរកលេខទូរស័ព្ទ ===');
{
    const { ctx, els, calls } = buildEnv(src, {});
    ctx.setPhoneSearchPulledUp(true);
    ok(els.dataSideSection.classList.contains('search-focus'),
        'focus ➜ ប្រអប់ស្វែងរកហូតឡើងលើ (search-focus)');
    ok(calls.position > 0, 'ហើយកំណត់ទីតាំងបញ្ជីស្នើឡើងវិញ');
    ctx.setPhoneSearchPulledUp(false);
    ok(!els.dataSideSection.classList.contains('search-focus'), 'blur ទទេ ➜ ត្រឡប់មកធម្មតាវិញ');
}
{
    const { ctx, els } = buildEnv(src, { sideClasses: ['collapsed'] });
    ctx.setPhoneSearchPulledUp(true);
    ok(!els.dataSideSection.classList.contains('collapsed'),
        'ចុចប្រអប់ស្វែងរកពេលប្រវត្តិពេញអេក្រង់ ➜ បើកផ្ទាំងវិញដើម្បីឲ្យឃើញប្រអប់');
    ok(!els.appPages.classList.contains('history-expanded'),
        'ហើយដោះសោ overscroll តាមស្ថានភាពថ្មី');
}
{
    const { ctx, els } = buildEnv(src, { innerWidth: 1280 });
    ctx.setPhoneSearchPulledUp(true);
    ok(!els.dataSideSection.classList.contains('search-focus'),
        'លើអេក្រង់ធំ (≥992px) ➜ មិនហូតឡើងទេ ព្រោះ layout ២ ជួរឃើញគ្រប់យ៉ាងស្រាប់');
}
{
    const { els, handlers } = buildEnv(src, { sideClasses: ['search-focus'] });
    els.tableResponsive.scrollTop = 0;
    swipe(handlers, 'dataMainSection', 200, 300);
    ok(!els.dataSideSection.classList.contains('search-focus'),
        'អូសចុះពេលកំពុងហូតឡើង ➜ ត្រឡប់មកធម្មតាវិញ');
}

console.log('\n=== លើអេក្រង់ធំ ការអូសមិនប៉ះ layout ២ ជួរ ===');
{
    const { els, handlers } = buildEnv(src, { innerWidth: 1280 });
    swipe(handlers, 'dataMainSection', 300, 200);
    ok(!els.dataSideSection.classList.contains('collapsed'),
        'អូសឡើងលើកុំព្យូទ័រ ➜ គ្មានផលប៉ះពាល់');
}

console.log('\n=== ការតភ្ជាប់ក្នុង index.html និង style.css ===');
{
    const html = fs.readFileSync(path.join(ROOT, 'ZoeW', 'index.html'), 'utf8');
    const css = fs.readFileSync(path.join(ROOT, 'ZoeW', 'style.css'), 'utf8');
    ok(html.indexOf('id="dataSideSection"') !== -1, 'index.html មាន id="dataSideSection"');
    ok(html.indexOf('id="dataMainSection"') !== -1, 'index.html មាន id="dataMainSection"');
    ok(html.indexOf('id="dragHandle"') !== -1, 'index.html មានដងអូស id="dragHandle"');
    ok(/\.page-side\.collapsed\s*\{/.test(css), 'style.css មានច្បាប់ .page-side.collapsed');
    ok(/\.page-side\.search-focus\s*\{/.test(css), 'style.css មានច្បាប់ .page-side.search-focus');
    ok(/\.drag-handle-bar\s*\{/.test(css), 'style.css មានច្បាប់ .drag-handle-bar');
    ok(/@supports \(-webkit-touch-callout: none\)[\s\S]*?\.app-pages\.history-expanded \.table-responsive\s*\{[\s\S]*?overscroll-behavior-y:\s*none/.test(css),
        'iOS full-screen list បិទ rubber-band ខាងក្នុង; Android CSS នៅក្រៅប្លុកនេះ');
    ok(src.indexOf('setupSwipeGestures();') !== -1, 'app.js ហៅ setupSwipeGestures() ពេលចាប់ផ្តើម');
    // ⛔ React ៖ `onFocus` ក្នុង JSX ពិត ➜ handler ដែលហៅ `setPhoneSearchPulledUp(true)`
    const onFocus = jsxHandler(ROOT, 'searchPhoneInput', 'onFocus');
    ok(!!onFocus && /setPhoneSearchPulledUp\(true\)/.test(sliceFn(src, onFocus.name)),
        'focus លើប្រអប់ស្វែងរក ➜ ហៅ setPhoneSearchPulledUp(true)', onFocus);
    ok(/clearSensitiveModalFields\(\)\s*\{[\s\S]{0,200}setPhoneSearchPulledUp\(false\)/.test(src),
        'ចាកចេញ ➜ ដោះការហូតឡើងវិញ');
}

console.log('\n' + (fail === 0 ? '✅ ជោគជ័យ ' + pass : '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')'));
process.exit(fail === 0 ? 0 : 1);
