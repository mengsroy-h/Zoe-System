const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { reactRuntime } = require('./react-view.js');

const root = path.resolve(__dirname, '..');
const appRoot = process.env.PHONE_APP_DIR ? path.resolve(process.env.PHONE_APP_DIR) : root;

function slice(file, names) {
    const src = fs.readFileSync(path.join(appRoot, file), 'utf8');
    return names.map((name) => {
        const start = src.indexOf('function ' + name + '(');
        if (start === -1) throw new Error('not found: ' + name + ' in ' + file);
        let depth = 0, i = src.indexOf('{', start), started = false;
        for (; i < src.length; i++) {
            if (src[i] === '{') { depth++; started = true; }
            else if (src[i] === '}') { depth--; if (started && depth === 0) { i++; break; } }
        }
        return src.slice(start, i);
    }).join('\n\n');
}

let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { console.log('   ok    ' + label); pass++; }
    else { console.log('  FAIL   ' + label + (detail !== undefined ? '  got: ' + JSON.stringify(detail) : '')); fail++; }
}

function makeContext(app) {
    const datalistOptions = [];
    const listeners = {};
    const searchInput = {
        value: '',
        getBoundingClientRect: () => ({ top: 200, bottom: 244, left: 10, width: 300 }),
        addEventListener: (type, fn) => { listeners[type] = fn; }
    };
    const suggestBox = {
        children: [],
        classes: {},
        style: {},
        textContent: '',
        classList: {
            add: (c) => { suggestBox.classes[c] = true; },
            remove: (c) => { delete suggestBox.classes[c]; },
            contains: (c) => !!suggestBox.classes[c]
        },
        appendChild: (el) => { suggestBox.children.push(el); },
        querySelectorAll: () => suggestBox.children,
        addEventListener: () => {},
        offsetHeight: 100
    };
    Object.defineProperty(suggestBox, 'textContent', {
        get: () => '',
        set: () => { suggestBox.children.length = 0; }
    });
    const datalist = {
        appendChild: (el) => { datalistOptions.push(el.value); }
    };
    Object.defineProperty(datalist, 'innerHTML', {
        get: () => '',
        set: () => { datalistOptions.length = 0; }
    });

    const rendered = { rows: null, filterCalls: 0 };
    const sandbox = {
        console,
        setTimeout,
        clearTimeout,
        scanHistory: [],
        window: { innerHeight: 800, addEventListener: () => {} },
        document: {
            activeElement: searchInput,
            getElementById: (id) => {
                if (id === 'searchPhoneInput') return searchInput;
                if (id === 'phoneSuggestBox') return suggestBox;
                if (id === 'recentPhonesList') return datalist;
                return null;
            },
            body: { style: {}, classList: { add() {}, remove() {}, contains: () => false } },
            createElement: () => ({
                className: '',
                textContent: '',
                value: '',
                classes: {},
                attrs: {},
                setAttribute(k, v) { this.attrs[k] = v; },
                getAttribute(k) { return this.attrs[k]; },
                appendChild(el) { (this.children = this.children || []).push(el); },
                classList: {
                    add() {},
                    remove() {}
                },
                scrollIntoView() {}
            })
        },
        parseTimestampFromId: () => 0,
        renderHistory: (rows) => { rendered.rows = rows; },
        updateDailyScheduleStats: () => {},
        applyCurrentFilter: () => { rendered.filterCalls++; rendered.rows = null; },
        scheduleChromeLayoutSettle: () => {},
        queueMicrotask,
        requestAnimationFrame: (fn) => setTimeout(fn, 0)
    };
    const ctx = vm.createContext(sandbox);
    // ⛔ ការហូតប្រអប់ឡើង (ផ្ទាល់ ឬរអិល FLIP) ជារបស់ `phone-search-swipe-test` · `history-window-check` ➜ ត្រង់នេះជា stub
    vm.runInContext('function setPhoneSearchPulledUp() {}\nfunction glidePhoneSearchPulledUp() {}', ctx);
    const names = ['sanitizePhoneNumber', 'updateRecentPhonesList', 'searchByPhone', 'openModalHelper', 'showAppChrome'];
    // ⛔ `phoneSearchFocused`/`phoneSearchBlurred` ៖ handler `onFocus`/`onBlur` ពិតរបស់ប្រអប់ស្វែងរក (JSX)
    //    — App React មិនចាក់ listener តាម `addEventListener` ទៀតទេ
    const optional = ['cssPx', 'normalizePhoneDigits', 'collectPhoneSuggestions', 'renderPhoneSuggestions', 'positionPhoneSuggestBox', 'showPhoneSuggestions', 'hidePhoneSuggestions', 'setupPhoneSuggestions',
        'phoneSearchGlideRunning',
        'phoneSearchFocused', 'phoneSearchBlurred'];
    const src = fs.readFileSync(path.join(appRoot, app + '/app.js'), 'utf8');
    // ⛔ ស្រទាប់ React (ឃ្លាំង · `fieldValue` · `isFieldFocused` · ប្រអប់) — កូដពិតពីទិដ្ឋភាពដដែល (`react-view.js`)
    vm.runInContext(reactRuntime(src, { exclude: names.concat(optional), context: sandbox }), ctx);
    const present = optional.filter((n) => src.indexOf('function ' + n + '(') !== -1);
    const consts = src.match(/const PHONE_SUGGEST_MAX = \d+;/);
    const consts2 = src.match(/const RECENT_PHONES_MAX = \d+;/);
    const stateDecls = (src.match(/^ *let phoneSuggest\w+ = .*$/gm) || []).join('\n');
    const recentSigDecl = (src.match(/^ *let recentPhonesSignature = .*$/m) || ['let recentPhonesSignature = null;'])[0];
    const chromeDecl = (src.match(/^ *let chromeHidden = .*$/m) || ['let chromeHidden = false;'])[0]
        + '\n' + (src.match(/^ *let phoneSearchGlide = .*$/m) || ['let phoneSearchGlide = null;'])[0];
    vm.runInContext((consts ? consts[0] : 'const PHONE_SUGGEST_MAX = 8;') + '\n' +
        (consts2 ? consts2[0] : 'const RECENT_PHONES_MAX = 30;') + '\n' +
        (stateDecls || 'let phoneSuggestItems = []; let phoneSuggestActiveIndex = -1;') + '\n' +
        recentSigDecl + '\n' + chromeDecl +
        '\nlet isModalOpen = false;', ctx);
    vm.runInContext(slice(app + '/app.js', names.concat(present)), ctx);
    const maxRows = consts ? parseInt(consts[0].replace(/\D/g, ''), 10) : 8;
    // ⛔ App React ៖ ប្រអប់ណែនាំគូរពី `uiState.phoneSuggestOpen` (class `show`) និង `phoneSuggestItems` (ជួរ) ·
    //    datalist គូរពី `dataState.recentPhonesOptions` ➜ ការវាស់អានប្រភពដែល component គូរពិត
    //    (ការគូរខ្លួនឯងវាស់ដោយ parity/browser)។ ការ focus/blur ហៅ handler JSX ពិត។
    const view = {
        open: () => vm.runInContext('uiState.phoneSuggestOpen === true', ctx),
        rows: () => vm.runInContext('phoneSuggestItems.length', ctx),
        datalist: () => vm.runInContext('dataState.recentPhonesOptions', ctx)
    };
    listeners.focus = () => vm.runInContext('phoneSearchFocused()', ctx);
    listeners.blur = () => vm.runInContext('phoneSearchBlurred()', ctx);
    return { ctx, searchInput, suggestBox, datalistOptions, rendered, maxRows, listeners, view, has: (n) => present.indexOf(n) !== -1 };
}

// ⛔ លេខទូរស័ព្ទដែលរក្សាទុក ជា **អត្តសញ្ញាណអតិថិជន** ៖ វាជាកូនសោ merge
// (`phone` + `scanDate`) និងជាមូលដ្ឋាននៃ `getPickupPhoneKey()` ➜ តួអក្សរ
// កាកសំណល់តែមួយបំបែកអតិថិជនម្នាក់ជា **ពីរ** ➜ ស្ថិតិយករាប់ស្ទួន។
// 🔴 វាស់បាន (2.31.8) ៖ `normalizeOneStoredPhone()` លុប `="` **ខាងមុខ**
// (ទម្រង់របស់ Google Sheets / Excel) តែ **ទុកសញ្ញា `"` ខាងចុង** ➜
// ការ paste `="012345678"` រក្សាទុកជា `012345678"`។ ការលុបត្រូវ **ស៊ីមេទ្រី**។
function storedPhoneCheck() {
    const app = slice('ZoeW/app.js', ['normalizeOneStoredPhone', 'normalizeStoredPhone']);
    const ctx = { String };
    vm.createContext(ctx);
    vm.runInContext(app, ctx);
    // [input, expected] — តម្លៃដែលអ្នកប្រើពិតជា paste ចូលវាលលេខទូរស័ព្ទ
    const cases = [
        ['012345678', '012345678'],
        ['="012345678"', '012345678'],
        ["'012345678", '012345678'],
        ['"012345678"', '012345678'],
        ['+85512345678', '012345678'],
        ['85512345678', '012345678'],
        ['12345678', '012345678'],
        ['  012345678  ', '012345678'],
        ['012345678/098765432', '012345678/098765432'],
        ['="012345678"/="098765432"', '012345678/098765432'],
        ['', '']
    ];
    cases.forEach(([input, want]) => {
        ok('normalizeStoredPhone(' + JSON.stringify(input) + ') = ' + JSON.stringify(want),
            ctx.normalizeStoredPhone(input) === want, ctx.normalizeStoredPhone(input));
    });
    // ⛔ ទិសផ្ទុយ ១ ៖ សញ្ញាបំបែក **ខាងក្នុង** ត្រូវនៅដដែល (កុំប្តូរទម្រង់
    //   ដែលរក្សាទុករួច ➜ វានឹងបំបែកការ merge ជាមួយទិន្នន័យចាស់)
    ok('⛔ ទិសផ្ទុយ ៖ សញ្ញាបំបែកខាងក្នុងមិនត្រូវលុប',
        ctx.normalizeStoredPhone('012-345 678') === '012-345 678',
        ctx.normalizeStoredPhone('012-345 678'));
    // ⛔ ទិសផ្ទុយ ២ ៖ អត្ថបទដែលមិនមែនលេខ (ស្កេនរំលង) ត្រូវនៅដដែល
    ok('⛔ ទិសផ្ទុយ ៖ «គ្មានលេខ» មិនត្រូវប្រែ',
        ctx.normalizeStoredPhone('គ្មានលេខ') === 'គ្មានលេខ',
        ctx.normalizeStoredPhone('គ្មានលេខ'));
    // ⛔ ជាន់អប្បបរមា ៖ បញ្ជាក់ថា helper ពិតជាធ្វើការងារ (មិនមែន identity)
    ok('⛔ ជាន់អប្បបរមា ៖ helper ពិតជាធ្វើការធម្មតា (មិនមែន identity)',
        ctx.normalizeStoredPhone('85512345678') !== '85512345678');
}

function itemsFixture() {
    const items = [];
    for (let i = 0; i < 40; i++) {
        items.push({ id: 'old' + i, phone: '011' + String(100000 + i), createdAt: 1000 + i, barcodes: [{ code: 'B' + i }] });
    }
    items.push({ id: 'x1', phone: '0960000421', createdAt: 9000, barcodes: [{ code: 'C1' }, { code: 'C2' }] });
    items.push({ id: 'x2', phone: '0960000421', createdAt: 9500, barcodes: [{ code: 'C3' }] });
    items.push({ id: 'x3', phone: '0421777888', createdAt: 9600, barcodes: [{ code: 'C4' }] });
    items.push({ id: 'x4', phone: '012-345 678', createdAt: 9700, barcodes: [{ code: 'C5' }] });
    items.push({ id: 'x5', phone: 'គ្មានលេខ', createdAt: 9800, barcodes: [{ code: 'C6' }] });
    return items;
}

['ZoeW'].forEach((app) => {
    console.log('\n=== ' + app + ' ===');
    const h = makeContext(app);
    h.ctx.scanHistory = itemsFixture();

    console.log('-- ការស្នើលេខ (suggestions) តាមកន្ទុយលេខ --');
    ok('មាន collectPhoneSuggestions', h.has('collectPhoneSuggestions'));
    if (h.has('collectPhoneSuggestions')) {
        const tail = h.ctx.collectPhoneSuggestions('421');
        ok('វាយ "421" ➜ រកឃើញ 0960000421', tail.some((e) => e.phone === '0960000421'), tail.map((e) => e.phone));
        ok('លេខដែលបញ្ចប់ដោយ "421" ឡើងមុនគេ', tail.length && tail[0].phone === '0960000421', tail.map((e) => e.phone));
        ok('លេខដែលមាន "421" នៅកណ្តាល/ដើម ក៏ចេញដែរ', tail.some((e) => e.phone === '0421777888'), tail.map((e) => e.phone));
        ok('រាប់កញ្ចប់បូកបញ្ចូលគ្នាតាមលេខតែមួយ',
            (tail.find((e) => e.phone === '0960000421') || {}).packages === 3,
            (tail.find((e) => e.phone === '0960000421') || {}).packages);
        ok('លេខមិនស្ទួន', new Set(tail.map((e) => e.phone)).size === tail.length, tail.map((e) => e.phone));
        ok('"គ្មានលេខ" មិនចូលក្នុងបញ្ជី', !h.ctx.collectPhoneSuggestions('').some((e) => e.phone === 'គ្មានលេខ'));
        ok('សញ្ញា - និងចន្លោះមិនរារាំង៖ "345678" រក 012-345 678',
            h.ctx.collectPhoneSuggestions('345678').some((e) => e.phone === '012-345 678'),
            h.ctx.collectPhoneSuggestions('345678').map((e) => e.phone));
        ok('លទ្ធផលមិនលើស PHONE_SUGGEST_MAX', h.ctx.collectPhoneSuggestions('').length === h.maxRows,
            h.ctx.collectPhoneSuggestions('').length);
        ok('ពេលទទេ ➜ លេខថ្មីជាងគេឡើងមុន', h.ctx.collectPhoneSuggestions('')[0].phone === '012-345 678',
            h.ctx.collectPhoneSuggestions('')[0].phone);
        ok('លេខដែលមិនត្រូវគ្នា មិនចេញសោះ', h.ctx.collectPhoneSuggestions('999999').length === 0);
    }

    console.log('-- ដុំស្នើលេខលើអេក្រង់ --');
    if (h.has('showPhoneSuggestions')) {
        h.searchInput.value = '421';
        h.ctx.showPhoneSuggestions();
        ok('បើកដុំស្នើលេខ', h.view.open());
        ok('មានជួរក្នុងដុំ', h.view.rows() > 0, h.view.rows());
        h.ctx.hidePhoneSuggestions();
        ok('បិទហើយ លុបទិន្នន័យចេញពីដុំ',
            !h.view.open() && h.view.rows() === 0,
            h.view.rows());
        h.searchInput.value = '999999';
        h.ctx.showPhoneSuggestions();
        ok('គ្មានលទ្ធផល ➜ មិនបើកដុំទទេ', !h.view.open());
    }

    console.log('-- តារាងស្វែងរក --');
    h.searchInput.value = '421';
    h.ctx.searchByPhone();
    ok('វាយ "421" ➜ តារាងបង្ហាញជួរដែលត្រូវគ្នា',
        h.rendered.rows && h.rendered.rows.length === 3, h.rendered.rows && h.rendered.rows.length);
    h.searchInput.value = '345678';
    h.ctx.searchByPhone();
    ok('វាយ "345678" ➜ រកឃើញលេខដែលមានសញ្ញា - ក្នុងនោះ',
        h.rendered.rows && h.rendered.rows.length === 1 && h.rendered.rows[0].id === 'x4',
        h.rendered.rows && h.rendered.rows.map((r) => r.id));
    h.searchInput.value = '';
    h.ctx.searchByPhone();
    ok('ទទេ ➜ ត្រឡប់ទៅតម្រងធម្មតា', h.rendered.filterCalls === 1, h.rendered.filterCalls);

    console.log('-- ដុំស្នើលេខមិនត្រូវអណ្តែតលើ modal --');
    if (h.has('showPhoneSuggestions')) {
        h.searchInput.value = '421';
        h.ctx.showPhoneSuggestions();
        ok('ដុំបើករួច មុនបើក modal', h.view.open());
        h.ctx.openModalHelper('phoneModal');
        ok('បើក modal ➜ ដុំបិទដោយស្វ័យប្រវត្តិ', !h.view.open());
    }

    console.log('-- ទំហំ ២០០-៣០០ លេខ --');
    if (h.has('collectPhoneSuggestions')) {
        const big = [];
        for (let i = 0; i < 350; i++) {
            big.push({ id: 'p' + i, phone: '011' + String(200000 + i), createdAt: 1000 + i, barcodes: [{ code: 'D' + i }] });
        }
        h.ctx.scanHistory = big;
        const last = h.ctx.collectPhoneSuggestions('200349');
        ok('លេខទី ៣៥០ (ចុងក្រោយ) នៅតែរកឃើញ', last.length === 1 && last[0].phone === '011000349', last.map((e) => e.phone));
        const first = h.ctx.collectPhoneSuggestions('200000');
        ok('លេខទី ១ (ចាស់ជាងគេ) ក៏នៅតែរកឃើញ', first.length === 1 && first[0].phone === '011200000', first.map((e) => e.phone));
        h.ctx.updateRecentPhonesList();
        ok('datalist ផ្ទុកបាន ៣០០ លេខ', h.view.datalist().length === 300, h.view.datalist().length);
        h.ctx.scanHistory = itemsFixture();
    }

    console.log('-- datalist សម្រាប់វាលបញ្ចូលលេខ --');
    h.ctx.updateRecentPhonesList();
    ok('លេខលើសពី ៣០ មិនត្រូវកាត់ចោល', h.view.datalist().length === 43, h.view.datalist().length);
    ok('លេខថ្មីជាងគេនៅដើមបញ្ជី', h.view.datalist()[0] === '012-345 678', h.view.datalist()[0]);

    // ⛔ «មិនសាង DOM ឡើងវិញ» ក្នុង React = **មិនសរសេរ state ថ្មី** (អត្តសញ្ញាណ array ដដែល ➜ React មិនគូរ)
    const sameList = h.view.datalist();
    h.ctx.updateRecentPhonesList();
    ok('ហៅម្ដងទៀតដោយទិន្នន័យដដែល ➜ មិនសាងបញ្ជីឡើងវិញ', h.view.datalist() === sameList);
    h.ctx.scanHistory = h.ctx.scanHistory.concat([{ id: 'z9', phone: '0777000111', createdAt: 9900, barcodes: [{ code: 'Z9' }] }]);
    h.ctx.updateRecentPhonesList();
    ok('លេខថ្មីមកដល់ ➜ សាងបញ្ជីឡើងវិញ', h.view.datalist() !== sameList && h.view.datalist().length === 44 && h.view.datalist()[0] === '0777000111', h.view.datalist().length);
    h.ctx.scanHistory = itemsFixture();
    h.ctx.updateRecentPhonesList();
    ok('"គ្មានលេខ" មិនចូល datalist', h.view.datalist().indexOf('គ្មានលេខ') === -1);
});

function blurRaceCheck() {
    return new Promise((resolve) => {
        console.log('\n=== blur ➜ focus ក្នុង ១៥០ms ===');
        const h = makeContext('ZoeW');
        h.ctx.scanHistory = itemsFixture();
        if (!h.has('setupPhoneSuggestions')) { ok('មាន setupPhoneSuggestions', false); return resolve(); }
        h.ctx.setupPhoneSuggestions();
        h.searchInput.value = '421';
        h.listeners.focus();
        ok('focus ➜ ដុំបើក', h.view.open());
        h.listeners.blur();
        h.listeners.focus();
        setTimeout(() => {
            ok('focus ឡើងវិញក្នុង ១៥០ms ➜ ដុំនៅតែបើក', h.view.open());
            h.listeners.blur();
            setTimeout(() => {
                ok('blur ហើយទុកចោល ➜ ដុំបិទ', !h.view.open());
                resolve();
            }, 260);
        }, 260);
    });
}

storedPhoneCheck();

blurRaceCheck().then(() => {
    console.log('\n' + (fail === 0 ? '✅ ' : '❌ ') + pass + '/' + (pass + fail));
    process.exit(fail === 0 ? 0 : 1);
});
