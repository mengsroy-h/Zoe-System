const fs = require('fs');
const path = require('path');
const vm = require('vm');

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
    const searchInput = { value: '', getBoundingClientRect: () => ({ top: 200, bottom: 244, left: 10, width: 300 }) };
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
        applyCurrentFilter: () => { rendered.filterCalls++; rendered.rows = null; }
    };
    const ctx = vm.createContext(sandbox);
    const names = ['sanitizePhoneNumber', 'updateRecentPhonesList', 'searchByPhone'];
    const optional = ['normalizePhoneDigits', 'collectPhoneSuggestions', 'renderPhoneSuggestions', 'positionPhoneSuggestBox', 'showPhoneSuggestions', 'hidePhoneSuggestions'];
    const src = fs.readFileSync(path.join(appRoot, app + '/app.js'), 'utf8');
    const present = optional.filter((n) => src.indexOf('function ' + n + '(') !== -1);
    const consts = src.match(/const PHONE_SUGGEST_MAX = \d+;/);
    const consts2 = src.match(/const RECENT_PHONES_MAX = \d+;/);
    vm.runInContext((consts ? consts[0] : 'const PHONE_SUGGEST_MAX = 8;') + '\n' +
        (consts2 ? consts2[0] : 'const RECENT_PHONES_MAX = 30;') +
        '\nlet phoneSuggestItems = []; let phoneSuggestActiveIndex = -1;', ctx);
    vm.runInContext(slice(app + '/app.js', names.concat(present)), ctx);
    const maxRows = consts ? parseInt(consts[0].replace(/\D/g, ''), 10) : 8;
    return { ctx, searchInput, suggestBox, datalistOptions, rendered, maxRows, has: (n) => present.indexOf(n) !== -1 };
}

function itemsFixture() {
    const items = [];
    for (let i = 0; i < 40; i++) {
        items.push({ id: 'old' + i, phone: '011' + String(100000 + i), createdAt: 1000 + i, barcodes: [{ code: 'B' + i }] });
    }
    items.push({ id: 'x1', phone: '0968490421', createdAt: 9000, barcodes: [{ code: 'C1' }, { code: 'C2' }] });
    items.push({ id: 'x2', phone: '0968490421', createdAt: 9500, barcodes: [{ code: 'C3' }] });
    items.push({ id: 'x3', phone: '0421777888', createdAt: 9600, barcodes: [{ code: 'C4' }] });
    items.push({ id: 'x4', phone: '012-345 678', createdAt: 9700, barcodes: [{ code: 'C5' }] });
    items.push({ id: 'x5', phone: 'គ្មានលេខ', createdAt: 9800, barcodes: [{ code: 'C6' }] });
    return items;
}

['ZoeAdmin', 'ZoeW'].forEach((app) => {
    console.log('\n=== ' + app + ' ===');
    const h = makeContext(app);
    h.ctx.scanHistory = itemsFixture();

    console.log('-- ការស្នើលេខ (suggestions) តាមកន្ទុយលេខ --');
    ok('មាន collectPhoneSuggestions', h.has('collectPhoneSuggestions'));
    if (h.has('collectPhoneSuggestions')) {
        const tail = h.ctx.collectPhoneSuggestions('421');
        ok('វាយ "421" ➜ រកឃើញ 0968490421', tail.some((e) => e.phone === '0968490421'), tail.map((e) => e.phone));
        ok('លេខដែលបញ្ចប់ដោយ "421" ឡើងមុនគេ', tail.length && tail[0].phone === '0968490421', tail.map((e) => e.phone));
        ok('លេខដែលមាន "421" នៅកណ្តាល/ដើម ក៏ចេញដែរ', tail.some((e) => e.phone === '0421777888'), tail.map((e) => e.phone));
        ok('រាប់កញ្ចប់បូកបញ្ចូលគ្នាតាមលេខតែមួយ',
            (tail.find((e) => e.phone === '0968490421') || {}).packages === 3,
            (tail.find((e) => e.phone === '0968490421') || {}).packages);
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
        ok('បើកដុំស្នើលេខ', h.suggestBox.classList.contains('show'));
        ok('មានជួរក្នុងដុំ', h.suggestBox.children.length > 0, h.suggestBox.children.length);
        h.ctx.hidePhoneSuggestions();
        ok('បិទហើយ លុបទិន្នន័យចេញពី DOM',
            !h.suggestBox.classList.contains('show') && h.suggestBox.children.length === 0,
            h.suggestBox.children.length);
        h.searchInput.value = '999999';
        h.ctx.showPhoneSuggestions();
        ok('គ្មានលទ្ធផល ➜ មិនបើកដុំទទេ', !h.suggestBox.classList.contains('show'));
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

    console.log('-- ទំហំ ២០០-៣០០ លេខ --');
    if (h.has('collectPhoneSuggestions')) {
        const big = [];
        for (let i = 0; i < 350; i++) {
            big.push({ id: 'p' + i, phone: '011' + String(200000 + i), createdAt: 1000 + i, barcodes: [{ code: 'D' + i }] });
        }
        h.ctx.scanHistory = big;
        const last = h.ctx.collectPhoneSuggestions('200349');
        ok('លេខទី ៣៥០ (ចុងក្រោយ) នៅតែរកឃើញ', last.length === 1 && last[0].phone === '011200349', last.map((e) => e.phone));
        const first = h.ctx.collectPhoneSuggestions('200000');
        ok('លេខទី ១ (ចាស់ជាងគេ) ក៏នៅតែរកឃើញ', first.length === 1 && first[0].phone === '011200000', first.map((e) => e.phone));
        h.ctx.updateRecentPhonesList();
        ok('datalist ផ្ទុកបាន ៣០០ លេខ', h.datalistOptions.length === 300, h.datalistOptions.length);
        h.ctx.scanHistory = itemsFixture();
    }

    console.log('-- datalist សម្រាប់វាលបញ្ចូលលេខ --');
    h.ctx.updateRecentPhonesList();
    ok('លេខលើសពី ៣០ មិនត្រូវកាត់ចោល', h.datalistOptions.length === 43, h.datalistOptions.length);
    ok('លេខថ្មីជាងគេនៅដើមបញ្ជី', h.datalistOptions[0] === '012-345 678', h.datalistOptions[0]);
    ok('"គ្មានលេខ" មិនចូល datalist', h.datalistOptions.indexOf('គ្មានលេខ') === -1);
});

console.log('\n' + (fail === 0 ? '✅ ' : '❌ ') + pass + '/' + (pass + fail));
process.exit(fail === 0 ? 0 : 1);
