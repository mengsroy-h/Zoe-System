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
    vm.runInContext((src.match(/^ *const HANDLE_DRAG_THRESHOLD = .*$/m) || [''])[0], ctx);
    vm.runInContext(sliceFn(src, 'showAppChrome'), ctx);
    vm.runInContext(sliceFn(src, 'entryScrollerInView'), ctx);
    vm.runInContext(sliceFn(src, 'activePanelSections'), ctx);
    vm.runInContext(sliceFn(src, 'syncHistoryExpandedLock'), ctx);
    vm.runInContext(sliceFn(src, 'setPhoneSearchPulledUp'), ctx);
    vm.runInContext(sliceFn(src, 'bindPanelSwipe'), ctx);
    vm.runInContext(sliceFn(src, 'setupSwipeGestures'), ctx);
    ctx.setupSwipeGestures();
    return { ctx, els, handlers, calls };
}

// អូសលើ **ដងអូស** — ផ្លូវតែមួយដែលបិទ/បើកផ្ទាំង
function dragHandle(handlers, el, fromY, toY) {
    handlers[el].touchstart({ touches: [{ clientY: fromY }] });
    handlers[el].touchmove({ touches: [{ clientY: toY }] });
    if (handlers[el].touchend) handlers[el].touchend();
}

function swipe(handlers, el, fromY, toY) {
    handlers[el].touchstart({ touches: [{ clientY: fromY }] });
    handlers[el].touchmove({ touches: [{ clientY: toY }] });
    if (handlers[el].touchend) handlers[el].touchend();
}

// អូសដោយ **មិនទាន់លើកម្រាមដៃ** — ប្រើដើម្បីវាស់ថាសោមិនអនុវត្តចំពេលកំពុងអូស
function swipeHold(handlers, el, fromY, toY) {
    handlers[el].touchstart({ touches: [{ clientY: fromY }] });
    handlers[el].touchmove({ touches: [{ clientY: toY }] });
}

const src = fs.readFileSync(path.join(ROOT, 'ZoeW', 'app.js'), 'utf8');

console.log('\n=== សោប្រវត្តិពេញអេក្រង់ជាប់តែទំព័រទិន្នន័យ ===');
{
    const onData = buildEnv(src, {});
    onData.els.dataSideSection.classList.add('collapsed');
    onData.ctx.syncHistoryExpandedLock();
    ok(onData.els.appPages.classList.contains('history-expanded'),
        'ទំព័រទិន្នន័យសកម្ម + ផ្ទាំងបង្រួម ➜ ដាក់ history-expanded');

    const onEntry = buildEnv(src, { dataPageActive: false });
    onEntry.els.dataSideSection.classList.add('collapsed');
    onEntry.ctx.syncHistoryExpandedLock();
    ok(!onEntry.els.appPages.classList.contains('history-expanded'),
        'ទំព័រទិន្នន័យមិនសកម្ម ➜ មិនដាក់ history-expanded (ទំព័រ ២ រមូរបាន)');
}

console.log('\n=== ការអូសលើបញ្ជីជាការរមូរសុទ្ធ (មិនប្តូរ layout) ===');
{
    // ឫសគល់នៃការ «បង្អាក់ scroll» ដែលវាស់បាន៖ ការបង្រួមផ្ទាំងខាងលើធ្វើឲ្យ
    // កន្សោមរមូរខាងក្រៅ **រលាយបាត់** (រមូរបានទៀត 305px ➜ 0px) ➜ បើ browser
    // កំពុងរមូរវា កាយវិការនោះស្លាប់ភ្លាម។ ដូច្នេះការអូសលើបញ្ជី **មិនត្រូវ
    // ប្តូរ layout ឡើយ** — ការបិទ/បើកផ្លាស់ទៅដងអូសទាំងស្រុង។
    const { els, handlers } = buildEnv(src, {});
    swipe(handlers, 'dataMainSection', 300, 200);
    ok(!els.dataSideSection.classList.contains('collapsed'),
        'អូសឡើងលើបញ្ជី ➜ **មិនបង្រួម**ផ្ទាំង (ការរមូរមិនត្រូវកាត់ផ្តាច់)');
    ok(!els.appPages.classList.contains('history-expanded'),
        'ហើយមិនប្តូរកន្សោមរមូរដែរ');

    const collapsed = buildEnv(src, { sideClasses: ['collapsed'] });
    swipe(collapsed.handlers, 'dataMainSection', 200, 300);
    ok(collapsed.els.dataSideSection.classList.contains('collapsed'),
        'អូសចុះលើបញ្ជី ➜ ក៏មិនបើកផ្ទាំងវិញដែរ (ការរមូរនៅសុទ្ធ)');

    // ភស្តុតាងខ្លាំងជាងគេ៖ **គ្មាន touch listener ណាមួយ**ចងលើកន្សោមរមូរទេ
    // ➜ គ្មានកូដណាអាចប្តូរ layout ចំពេលអ្នកប្រើកំពុងរមូរបានឡើយ
    const onTable = buildEnv(src, { sideClasses: ['collapsed'] });
    ok(onTable.handlers.tableResponsive === undefined,
        'គ្មាន touch listener ចងលើ #tableResponsive ទេ (ការរមូរមិនអាចត្រូវរំខាន)',
        Object.keys(onTable.handlers));
    ok(onTable.handlers.entryTableResponsive === undefined &&
       onTable.handlers.lockerTableResponsive === undefined,
        'គ្មាន touch listener លើកន្សោមរមូរទំព័រ ២ ដែរ');
}

console.log('\n=== ដងអូស ជាផ្លូវតែមួយ (ចុច ឬអូស) ===');
{
    const tap = buildEnv(src, {});
    tap.handlers.dragHandle.click();
    ok(tap.els.dataSideSection.classList.contains('collapsed'), 'ចុចដងអូស ➜ បង្រួម');
    ok(tap.els.appPages.classList.contains('history-expanded'), 'ហើយចាក់សោភ្លាម');
    tap.handlers.dragHandle.click();
    ok(!tap.els.dataSideSection.classList.contains('collapsed'), 'ចុចម្តងទៀត ➜ បើកវិញ');

    const up = buildEnv(src, {});
    dragHandle(up.handlers, 'dragHandle', 300, 250);
    ok(up.els.dataSideSection.classList.contains('collapsed'), 'អូសដងអូសឡើង ➜ បង្រួម');
    dragHandle(up.handlers, 'dragHandle', 250, 300);
    ok(!up.els.dataSideSection.classList.contains('collapsed'), 'អូសដងអូសចុះ ➜ បើកវិញ');

    const tiny = buildEnv(src, {});
    dragHandle(tiny.handlers, 'dragHandle', 300, 290);
    ok(!tiny.els.dataSideSection.classList.contains('collapsed'),
        'អូសខ្លីជាងកម្រិត ➜ មិនប្តូរ (ជៀសការកេះដោយចៃដន្យ)');
}

console.log('\n=== ទំព័រ ២ (បញ្ចូលទិន្នន័យ) ដើរដូចគ្នា ===');
{
    const entry = buildEnv(src, { dataPageActive: false, entryPageActive: true });
    entry.handlers.entryDragHandle.click();
    ok(entry.els.entrySideSection.classList.contains('collapsed'),
        'ចុចដងអូសទំព័រ ២ ➜ ផ្ទាំងកាមេរ៉ាបង្រួម');
    ok(entry.els.appPages.classList.contains('history-expanded'),
        'ហើយបញ្ជីកញ្ចប់ថ្ងៃនេះហូតឡើងពេញអេក្រង់');
    ok(!entry.els.dataSideSection.classList.contains('collapsed'),
        'ការអូសលើទំព័រ ២ មិនប៉ះផ្ទាំងទំព័រ ១');

    const entryDrag = buildEnv(src, { dataPageActive: false, entryPageActive: true });
    dragHandle(entryDrag.handlers, 'entryDragHandle', 300, 250);
    ok(entryDrag.els.entrySideSection.classList.contains('collapsed'),
        'អូសដងអូសទំព័រ ២ ឡើង ➜ បង្រួម');

    const entrySwipe = buildEnv(src, { dataPageActive: false, entryPageActive: true });
    swipe(entrySwipe.handlers, 'entryMainSection', 300, 200);
    ok(!entrySwipe.els.entrySideSection.classList.contains('collapsed'),
        'អូសលើបញ្ជីទំព័រ ២ ➜ មិនប្តូរ layout (ការរមូរសុទ្ធ)');
}

console.log('\n=== ដងអូស ➜ ប្រវត្តិហូតឡើងចុះ + សោ overscroll ===');
{
    const { els, handlers } = buildEnv(src, {});
    dragHandle(handlers, 'dragHandle', 300, 250);
    ok(els.dataSideSection.classList.contains('collapsed'),
        'អូសដងអូសឡើង ➜ ផ្ទាំងខាងលើបង្រួម ហើយប្រវត្តិឡើងពេញ');
    ok(els.appPages.classList.contains('history-expanded'),
        'ពេលពង្រីកប្រវត្តិ ➜ ចាក់សោ overscroll លើ #appPages');
    dragHandle(handlers, 'dragHandle', 250, 300);
    ok(!els.dataSideSection.classList.contains('collapsed'),
        'អូសដងអូសចុះ ➜ ផ្ទាំងខាងលើត្រឡប់មកវិញ');
    ok(!els.appPages.classList.contains('history-expanded'),
        'ដោះសោ overscroll វិញ');
}

console.log('\n=== ដងអូសនៅដើរពេលប្រវត្តិពេញអេក្រង់ ===');
{
    const { els, handlers } = buildEnv(src, { sideClasses: ['collapsed'] });
    els.tableResponsive.scrollTop = 400;
    dragHandle(handlers, 'dragHandle', 200, 300);
    ok(!els.dataSideSection.classList.contains('collapsed'),
        'អូសដងអូសចុះ ➜ ផ្ទាំងខាងលើត្រឡប់មកវិញ ទោះតារាងរមូរនៅកណ្តាល');
    ok(els.tableResponsive.scrollTop === 400,
        'ទីតាំងរមូររបស់តារាងមិនត្រូវប៉ះ');
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

console.log('\n=== ភស្តុតាងលើ source ៖ គ្មានការចង listener លើកន្សោមរមូរ ===');
{
    const bind = sliceFn(src, 'bindPanelSwipe');
    ok(bind.indexOf('tableResponsive') === -1,
        'bindPanelSwipe() មិនយោងកន្សោមរមូរណាមួយឡើយ (គ្មានផ្លូវប្តូរ layout ពេលរមូរ)');
    ok(bind.indexOf('lockerTableResponsive') === -1 && bind.indexOf('entryTableResponsive') === -1,
        'ហើយមិនយោងកន្សោមរមូរទំព័រ ២ ដែរ');
    const listenerTargets = (bind.match(/(\w+)\.addEventListener\(/g) || [])
        .map((m) => m.replace('.addEventListener(', ''));
    ok(listenerTargets.every((t) => t === 'mainSection' || t === 'dragHandle'),
        'listener ចងតែលើ mainSection និង dragHandle ប៉ុណ្ណោះ', listenerTargets);
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
