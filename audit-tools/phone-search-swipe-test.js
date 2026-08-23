const fs = require('fs');
const path = require('path');
const vm = require('vm');

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

function buildEnv(src, opts) {
    const o = opts || {};
    const handlers = {};
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
        addEventListener: (type, fn) => { (handlers[id] = handlers[id] || {})[type] = fn; }
    }, extra || {});

    const els = {
        dataSideSection: mkEl('dataSideSection', { classList: makeClassList(o.sideClasses || []) }),
        dataMainSection: mkEl('dataMainSection'),
        tableResponsive: mkEl('tableResponsive'),
        appPages: mkEl('appPages'),
        pageData: mkEl('pageData', { classList: makeClassList(o.dataPageActive === false ? [] : ['active']) }),
        pageEntry: mkEl('pageEntry', { classList: makeClassList(o.entryPageActive ? ['active'] : []) }),
        entrySideSection: mkEl('entrySideSection', { classList: makeClassList(o.entrySideClasses || []) }),
        entryMainSection: mkEl('entryMainSection'),
        entryDragHandle: mkEl('entryDragHandle'),
        entryTableResponsive: mkEl('entryTableResponsive'),
        lockerTableResponsive: mkEl('lockerTableResponsive'),
        lockerPanel: mkEl('lockerPanel', { classList: makeClassList(['hidden']) }),
        dragHandle: mkEl('dragHandle'),
        phoneSuggestBox: mkEl('phoneSuggestBox', { classList: makeClassList(o.suggestOpen ? ['show'] : []) }),
        searchPhoneInput: mkEl('searchPhoneInput', { value: o.searchActive ? '012' : '' })
    };

    const calls = { hideSuggest: 0, position: 0 };
    const ctx = {
        console,
        setTimeout: () => 0,
        window: { innerWidth: o.innerWidth || 400 },
        scheduleChromeLayoutSettle() {},
        hidePhoneSuggestions() { calls.hideSuggest++; els.phoneSuggestBox.classList.remove('show'); },
        positionPhoneSuggestBox() { calls.position++; },
        document: {
            getElementById: (id) => els[id] || null,
            activeElement: o.searchActive ? els.searchPhoneInput : null,
            body: { style: {}, classList: { add() {}, remove() {}, contains: () => false } }
        }
    };
    ctx.window.document = ctx.document;
    vm.createContext(ctx);
    vm.runInContext((src.match(/^ *let chromeHidden = .*$/m) || ['let chromeHidden = false;'])[0], ctx);
    vm.runInContext(sliceFn(src, 'showAppChrome'), ctx);
    vm.runInContext(sliceFn(src, 'entryScrollerInView'), ctx);
    vm.runInContext(sliceFn(src, 'activePanelSections'), ctx);
    vm.runInContext(sliceFn(src, 'syncHistoryExpandedLock'), ctx);
    vm.runInContext(sliceFn(src, 'setPhoneSearchPulledUp'), ctx);
    vm.runInContext(sliceFn(src, 'phoneSearchIsActive'), ctx);
    vm.runInContext((src.match(/^ *const iosTouchArbiter = .*$/m) || ["const iosTouchArbiter = { id: null, phase: 'idle', blockPanel: false };"])[0], ctx);
    vm.runInContext(sliceFn(src, 'touchByIdentifier'), ctx);
    vm.runInContext(sliceFn(src, 'panelBlockedForTouch'), ctx);
    vm.runInContext(sliceFn(src, 'panelMayYieldToPTR'), ctx);
    vm.runInContext(sliceFn(src, 'bindPanelSwipe'), ctx);
    vm.runInContext(sliceFn(src, 'setupSwipeGestures'), ctx);
    ctx.setupSwipeGestures();
    return { ctx, els, handlers, calls };
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
    ok(src.indexOf('setupSwipeGestures();') !== -1, 'app.js ហៅ setupSwipeGestures() ពេលចាប់ផ្តើម');
    ok(/phoneInput\.addEventListener\('focus'[\s\S]{0,120}setPhoneSearchPulledUp\(true\)/.test(src),
        'focus លើប្រអប់ស្វែងរក ➜ ហៅ setPhoneSearchPulledUp(true)');
    ok(/clearSensitiveModalFields\(\)\s*\{[\s\S]{0,200}setPhoneSearchPulledUp\(false\)/.test(src),
        'ចាកចេញ ➜ ដោះការហូតឡើងវិញ');
}

console.log('\n' + (fail === 0 ? '✅ ជោគជ័យ ' + pass : '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')'));
process.exit(fail === 0 ? 0 : 1);
