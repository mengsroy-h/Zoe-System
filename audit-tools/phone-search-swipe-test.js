const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = process.env.SWIPE_APP_DIR || path.join(__dirname, '..');
let pass = 0, fail = 0;
function ok(cond, label, got) {
    if (cond) { pass++; console.log('   ok    ' + label); }
    else { fail++; console.log('   FAIL  ' + label + (got !== undefined ? '  ➜ ' + JSON.stringify(got) : '')); }
}

function sliceFn(src, name) {
    const start = src.indexOf('function ' + name + '(');
    if (start === -1) return '';
    let depth = 0, i = src.indexOf('{', start), started = false;
    for (; i < src.length; i++) {
        if (src[i] === '{') { depth++; started = true; }
        else if (src[i] === '}') { depth--; if (started && depth === 0) { i++; break; } }
    }
    return src.slice(start, i);
}

function makeClassList(initial) {
    const set = new Set(initial || []);
    return {
        add: (c) => set.add(c), remove: (c) => set.delete(c),
        contains: (c) => set.has(c),
        toggle: (c) => (set.has(c) ? (set.delete(c), false) : (set.add(c), true)),
        _set: set
    };
}

function buildEnv(src, { searchActive, suggestOpen }) {
    const handlers = {};
    const mkEl = (id, extra) => Object.assign({
        id,
        classList: makeClassList(),
        scrollTop: 0,
        value: '',
        addEventListener: (type, fn) => { (handlers[id] = handlers[id] || {})[type] = fn; }
    }, extra || {});

    const els = {
        sidebarSection: mkEl('sidebarSection'),
        mainSection: mkEl('mainSection'),
        tableResponsive: mkEl('tableResponsive'),
        appContainer: mkEl('appContainer'),
        dragHandle: mkEl('dragHandle'),
        phoneSuggestBox: mkEl('phoneSuggestBox', { classList: makeClassList(suggestOpen ? ['show'] : []) }),
        searchPhoneInput: mkEl('searchPhoneInput', { value: searchActive ? '012' : '' })
    };

    const ctx = {
        console,
        window: { innerWidth: 400 },
        hidePhoneSuggestions() { els.phoneSuggestBox.classList.remove('show'); },
        setPhoneSearchPulledUp(on) { els.sidebarSection.classList.toggle('search-focus', !!on); },
        document: {
            getElementById: (id) => els[id] || null,
            activeElement: searchActive ? els.searchPhoneInput : null
        }
    };
    ctx.window.document = ctx.document;
    vm.createContext(ctx);
    vm.runInContext(sliceFn(src, 'setupSwipeGestures'), ctx);
    ctx.setupSwipeGestures();
    return { ctx, els, handlers };
}

function swipe(handlers, el, fromY, toY) {
    handlers[el].touchstart({ touches: [{ clientY: fromY }] });
    handlers[el].touchmove({ touches: [{ clientY: toY }] });
}

for (const app of ['ZoeAdmin', 'ZoeW']) {
    const src = fs.readFileSync(path.join(ROOT, app, 'app.js'), 'utf8');

    console.log(`\n=== ${app} — the drag gesture the user asked us NOT to break ===`);
    {
        const { els, handlers } = buildEnv(src, { searchActive: false, suggestOpen: false });
        swipe(handlers, 'mainSection', 300, 200);
        ok(els.sidebarSection.classList.contains('collapsed'),
            'swipe UP still pulls the history panel up (sidebar collapses)');
        els.tableResponsive.scrollTop = 0;
        swipe(handlers, 'mainSection', 200, 300);
        ok(!els.sidebarSection.classList.contains('collapsed'),
            'swipe DOWN still brings the history panel back down (sidebar expands)');
    }

    console.log(`\n=== ${app} — while a phone search is in progress ===`);
    {
        const { els, handlers } = buildEnv(src, { searchActive: true, suggestOpen: true });
        swipe(handlers, 'mainSection', 300, 200);
        ok(!els.sidebarSection.classList.contains('collapsed'),
            'swipe UP no longer wipes out the search box the user is typing in');
        ok(els.phoneSuggestBox.classList.contains('show'),
            'the suggestion list stays on screen');
    }
    {
        const { els, handlers } = buildEnv(src, { searchActive: false, suggestOpen: true });
        swipe(handlers, 'mainSection', 300, 200);
        ok(!els.sidebarSection.classList.contains('collapsed'),
            'suggestions open but input blurred: still protected');
    }
    {
        const { els, handlers } = buildEnv(src, { searchActive: true, suggestOpen: false });
        swipe(handlers, 'mainSection', 300, 200);
        ok(!els.sidebarSection.classList.contains('collapsed'),
            'typing with no matches yet: still protected');
    }

    console.log(`\n=== ${app} — the drag handle stays an explicit escape hatch ===`);
    {
        const { els, handlers } = buildEnv(src, { searchActive: true, suggestOpen: true });
        handlers.dragHandle.click();
        ok(els.sidebarSection.classList.contains('collapsed'),
            'tapping the drag handle still collapses, even mid-search (explicit user intent)');
        ok(!els.phoneSuggestBox.classList.contains('show'),
            'and it closes the suggestion list first, so nothing is left floating');
    }

    console.log(`\n=== ${app} — tapping the search box pulls the history table up ===`);
    {
        const mkSidebar = () => ({ classList: makeClassList() });
        const build = (innerWidth) => {
            const sidebar = mkSidebar();
            const ctx = {
                console, window: { innerWidth },
                setTimeout: () => {}, positionPhoneSuggestBox() {},
                document: { getElementById: (id) => (id === 'sidebarSection' ? sidebar : null) }
            };
            vm.createContext(ctx);
            vm.runInContext(sliceFn(src, 'setPhoneSearchPulledUp'), ctx);
            return { ctx, sidebar };
        };

        if (!sliceFn(src, 'setPhoneSearchPulledUp')) {
            ok(false, 'setPhoneSearchPulledUp is defined (tapping the search box pulls the table up)');
        } else {
        const a = build(400);
        a.ctx.setPhoneSearchPulledUp(true);
        ok(a.sidebar.classList.contains('search-focus'),
            'focusing the search box hides everything above it, so the history table gets the screen');

        a.ctx.setPhoneSearchPulledUp(false);
        ok(!a.sidebar.classList.contains('search-focus'),
            'leaving an empty search box puts the cards back');

        const b = build(400);
        b.sidebar.classList.add('collapsed');
        b.ctx.setPhoneSearchPulledUp(true);
        ok(!b.sidebar.classList.contains('collapsed'),
            'pulling up clears a prior full collapse, so the search box can never end up hidden');

        const d = build(1200);
        d.ctx.setPhoneSearchPulledUp(true);
        ok(!d.sidebar.classList.contains('search-focus'),
            'on desktop the sidebar is a real column, so nothing is hidden');
        }
    }

    console.log(`\n=== ${app} — getting back out of search mode ===`);
    {
        const { els, handlers } = buildEnv(src, { searchActive: true, suggestOpen: true });
        els.sidebarSection.classList.add('search-focus');
        els.tableResponsive.scrollTop = 0;
        swipe(handlers, 'mainSection', 200, 300);
        ok(!els.sidebarSection.classList.contains('search-focus'),
            'swiping DOWN brings the cards back even while searching');
    }
    {
        const { els, handlers } = buildEnv(src, { searchActive: true, suggestOpen: true });
        els.sidebarSection.classList.add('search-focus');
        handlers.dragHandle.click();
        ok(!els.sidebarSection.classList.contains('search-focus'),
            'the drag handle also exits search mode');
    }

    console.log(`\n=== ${app} — positionPhoneSuggestBox hides on a zero-size (collapsed) input ===`);
    {
        const src2 = fs.readFileSync(path.join(ROOT, app, 'app.js'), 'utf8');
        ok(/rect\.width === 0 && rect\.height === 0/.test(sliceFn(src2, 'positionPhoneSuggestBox')),
            'a collapsed (0x0) search input no longer leaves the box floating at a stale spot');
    }
}

console.log('\n' + (fail ? '❌ ' : '✅ ') + pass + '/' + (pass + fail));
process.exit(fail ? 1 : 0);
