const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const appRoot = process.env.ZOESCAN_APP_DIR ? path.resolve(process.env.ZOESCAN_APP_DIR) : root;

function slice(file, names) {
    const src = fs.readFileSync(path.join(appRoot, file), 'utf8');
    return names.map((name) => {
        const start = src.indexOf('function ' + name + '(');
        if (start === -1) return '';
        let depth = 0, i = src.indexOf('{', start), started = false;
        for (; i < src.length; i++) {
            if (src[i] === '{') { depth++; started = true; }
            else if (src[i] === '}') { depth--; if (started && depth === 0) { i++; break; } }
        }
        return src.slice(start, i);
    }).filter(Boolean).join('\n\n');
}

let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { console.log('   ok    ' + label); pass++; }
    else { console.log('  FAIL   ' + label + (detail !== undefined ? '  got: ' + JSON.stringify(detail) : '')); fail++; }
}

function makeSelect() {
    let html = '';
    let value = '';
    const sel = {
        get innerHTML() { return html; },
        set innerHTML(v) {
            html = v;
            const opts = Array.from(v.matchAll(/value="([^"]*)"/g)).map((m) => m[1]);
            if (opts.indexOf(value) === -1) value = '';
        },
        get value() { return value; },
        set value(v) {
            const opts = Array.from(html.matchAll(/value="([^"]*)"/g)).map((m) => m[1]);
            value = opts.indexOf(v) === -1 ? '' : v;
        },
        addEventListener() {}
    };
    return sel;
}

function build() {
    const searchInput = { value: '' };
    const lockerSelect = makeSelect();
    const tbody = { innerHTML: '' };
    const emptyState = { hidden: false, classList: { add: () => { emptyState.hidden = true; }, remove: () => { emptyState.hidden = false; } } };
    const sandbox = {
        console, String, Array, Object, Set, Math, JSON, Date, isNaN, parseInt,
        historyData: {},
        currentTab: 'list',
        document: {
            getElementById: (id) => {
                if (id === 'listSearchInput') return searchInput;
                if (id === 'listLockerFilter') return lockerSelect;
                if (id === 'listTableBody') return tbody;
                if (id === 'listEmptyState') return emptyState;
                return null;
            }
        }
    };
    const ctx = vm.createContext(sandbox);
    vm.runInContext(slice('Zoescan/app.js', ['normalizePhoneDigits', 'sanitizePhoneNumber', 'escapeHtml',
        'getItemLockerSummary', 'getItemLatestLockerTs', 'renderList']), ctx);
    return { ctx, searchInput, lockerSelect, tbody, emptyState };
}

const withT5 = { a1: { phone: '0968490421', locker: 'ទូ5', lockerUpdatedAt: 100 } };
const withoutT5 = { a2: { phone: '012-345 678', locker: 'ទូ9', lockerUpdatedAt: 200 } };

console.log('-- តម្រងទីតាំងមិនត្រូវខុសពីអ្វីដែលបង្ហាញ --');
let h = build();
h.ctx.historyData = Object.assign({}, withT5, withoutT5);
h.ctx.renderList();
h.lockerSelect.value = 'ទូ5';
h.ctx.renderList();
ok('ជ្រើស ទូ5 ➜ ឃើញ ១ ជួរ', h.tbody.innerHTML.indexOf('0968490421') !== -1 && h.emptyState.hidden === true, h.tbody.innerHTML.length);

h.ctx.historyData = Object.assign({}, withoutT5);
h.ctx.renderList();
ok('កញ្ចប់ក្នុង ទូ5 ត្រូវបានយក ➜ ជម្រើសនោះបាត់ពី dropdown',
    h.lockerSelect.innerHTML.indexOf('ទូ5') === -1, h.lockerSelect.innerHTML);
ok('dropdown ត្រឡប់ទៅ "ទីតាំងទាំងអស់"', h.lockerSelect.value === '', h.lockerSelect.value);
ok('តារាងក៏ត្រូវបង្ហាញទាំងអស់ដែរ (មិនមែនទទេ)',
    h.emptyState.hidden === true && h.tbody.innerHTML.indexOf('012-345 678') !== -1, h.tbody.innerHTML);

console.log('-- ស្វែងរកតាមកន្ទុយលេខ / លេខមានសញ្ញា --');
h = build();
h.ctx.historyData = Object.assign({}, withT5, withoutT5);
h.searchInput.value = '421';
h.ctx.renderList();
ok('វាយ "421" ➜ រកឃើញ 0968490421',
    h.tbody.innerHTML.indexOf('0968490421') !== -1 && h.tbody.innerHTML.indexOf('012-345 678') === -1, h.tbody.innerHTML);
h.searchInput.value = '345678';
h.ctx.renderList();
ok('វាយ "345678" ➜ រកឃើញ 012-345 678 (សញ្ញា - និងចន្លោះមិនរារាំង)',
    h.tbody.innerHTML.indexOf('012-345 678') !== -1, h.tbody.innerHTML);
h.searchInput.value = '999';
h.ctx.renderList();
ok('លេខមិនត្រូវគ្នា ➜ ទទេ', h.emptyState.hidden === false, h.emptyState.hidden);

console.log('\n' + (fail === 0 ? '✅ ' : '❌ ') + pass + '/' + (pass + fail));
process.exit(fail === 0 ? 0 : 1);
