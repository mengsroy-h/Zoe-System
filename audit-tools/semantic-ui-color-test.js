#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const appDir = process.env.SEMANTIC_UI_APP_DIR || path.join(__dirname, '..', 'ZoeW');
const css = fs.readFileSync(path.join(appDir, 'style.css'), 'utf8');
const app = fs.readFileSync(path.join(appDir, 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(appDir, 'index.html'), 'utf8');
let failures = 0;

// App React ៖ markup រស់ក្នុង JSX (ច្រើនបន្ទាត់ ➜ ការស្កេនតាមបន្ទាត់មើលមិនឃើញ) ➜ **គូរ component ពិត** (`react-render.cjs`)
// ពីទិន្នន័យពិត ដោយ function ពិតរបស់ App (`openViewListModal` · `openDailyStatsModal` · …) រួចវាស់ class លើ HTML ដែលចេញ
const reactBundlePath = path.join(path.resolve(appDir), 'react-render.cjs');
const react = fs.existsSync(reactBundlePath) ? renderReactSurfaces(require(reactBundlePath)) : null;

function renderReactSurfaces(m) {
    const fn = (name) => {
        for (let i = 0; i < m.STATE_MODULES.length; i++) if (typeof m['s' + i][name] === 'function') return m['s' + i][name];
        throw new Error('semantic-ui-color ៖ រក function ' + name + ' មិនឃើញ');
    };
    const render = (rel, name) => {
        const i = m.FILES.indexOf(rel);
        if (i === -1 || typeof m['c' + i][name] !== 'function') throw new Error('semantic-ui-color ៖ រក component ' + name + ' មិនឃើញ');
        return m.renderToStaticMarkup(m.createElement(m['c' + i][name]));
    };
    const { dataState, uiState } = m.stores;
    const day = '2026-09-25';
    const items = [
        { id: 'open1', phone: '011222333', scanDate: day, time: '09:00:00 (' + day + ')', createdAt: Date.now(), cod: 8, dod: 1, count: 2, isClosed: false,
            barcodes: [{ code: 'BCOPEN1', cod: 5, dod: 1, isClosed: false }, { code: 'BCSHUT2', cod: 3, dod: 0, isClosed: true }] },
        { id: 'closed1', phone: '012333444', scanDate: day, time: '09:05:00 (' + day + ')', createdAt: Date.now(), cod: 4, dod: 2, count: 1, isClosed: true,
            barcodes: [{ code: 'BCSHUT3', cod: 4, dod: 2, isClosed: true }] }
    ];
    dataState.scanHistory = items;
    dataState.exchangeRateRiel = 4100;
    dataState.dailyRevenueData = { [day]: { codDollar: 12, dodDollar: 3, totalCount: 3 } };
    dataState.dailyCollectedData = { [day]: { BCSHUT3: { c: 4, d: 2 } } };
    uiState.historyView = items;
    const out = { history: render('src/app/components/history/HistoryTableBody.tsx', 'HistoryTableBody') };
    fn('openViewListModal')('open1');
    out.viewList = render('src/app/components/barcode/BarcodeListContainer.tsx', 'BarcodeListContainer');
    fn('openDailyStatsModal')();
    out.daily = render('src/app/components/stats/StatsCards.tsx', 'DailyStatsCards');
    fn('openCollectedStatsModal')();
    out.collected = render('src/app/components/stats/StatsCards.tsx', 'CollectedStatsCards');
    uiState.monthlyReportMonth = day.slice(0, 7);
    fn('renderMonthlyReport')();
    out.monthly = render('src/app/components/reports/MonthlyReportBody.tsx', 'MonthlyReportBody');
    return out;
}

// ធាតុកម្រិតកំពូលដែលមាន `marker` (ជួរដេក `<tr data-id>` ឬកាត `barcode-list-item`) ➜ អត្ថបទ HTML របស់វា
function chunkWith(html, splitRe, marker) {
    return html.split(splitRe).find((part) => part.includes(marker)) || '';
}
// គូ (ស្លាក COD/DOD ➜ class របស់ធាតុទឹកប្រាក់) ដេរីវេពី markup ៖ ស្លាកខាងក្នុងធាតុ (`<div class="…">DOD: …`)
// ឬស្លាកមុនធាតុ (`DOD: <strong class="…">`)
function moneyLabelPairs(html) {
    const pairs = [];
    for (const mm of html.matchAll(/<\w+ class="([^"]*\bmoney-(?:collected|pending)\b[^"]*)"[^>]*>\s*(COD|DOD):/g)) pairs.push({ label: mm[2], cls: mm[1] });
    for (const mm of html.matchAll(/\b(COD|DOD):\s*<\w+ class="([^"]*\bmoney-(?:collected|pending)\b[^"]*)"/g)) pairs.push({ label: mm[1], cls: mm[2] });
    return pairs;
}

function check(label, condition) {
    if (condition) {
        console.log('ok    ' + label);
    } else {
        failures += 1;
        console.log('FAIL  ' + label);
    }
}

function hasVar(name, value) {
    return new RegExp('--' + name + '\\s*:\\s*' + value.replace('#', '#') + '\\b', 'i').test(css);
}

check('បិទប្រើពណ៌ #0066FF', hasVar('action-primary', '#0066FF'));
check('បើក/រំលង/លុបប្រើពណ៌ #E61F26', hasVar('action-danger', '#E61F26'));
check('យករួចប្រើពណ៌បៃតង', hasVar('money-collected', '#15803D'));
check('មិនទាន់យកប្រើពណ៌លឿងទុំ', hasVar('money-pending', '#B45309'));
check('ទឹកប្រាក់សរុបទាំងអស់ប្រើពណ៌ស្វាយ', hasVar('money-total', '#6D28D9'));
if (react) {
    const openRow = chunkWith(react.history, /(?=<tr )/, 'data-id="open1"');
    const closedRow = chunkWith(react.history, /(?=<tr )/, 'data-id="closed1"');
    check('ប៊ូតុងបិទ និងបើកមាន class តាមស្ថានភាព (JSX ពិត ៖ ជួរបើក ➜ is-close-action · ជួរបិទ ➜ is-reopen-action)',
        /is-close-action/.test(openRow) && !/is-reopen-action/.test(openRow) &&
        /is-reopen-action/.test(closedRow) && !/is-close-action/.test(closedRow));
    const openBc = chunkWith(react.viewList, /(?=<div class="barcode-list-item")/, 'BCOPEN1');
    const shutBc = chunkWith(react.viewList, /(?=<div class="barcode-list-item")/, 'BCSHUT2');
    check('ប៊ូតុង barcode បិទ និងបើកមាន class តាមស្ថានភាព (JSX ពិត)',
        /class="btn-toggle-bc-close is-close-action"/.test(openBc) && /class="btn-toggle-bc-close is-reopen-action"/.test(shutBc));
} else {
    check('ប៊ូតុងបិទ និងបើកមាន class តាមស្ថានភាព',
        /item\.isClosed\s*\?\s*['"]is-reopen-action['"]\s*:\s*['"]is-close-action['"]/.test(app));
    check('ប៊ូតុង barcode បិទ និងបើកមាន class តាមស្ថានភាព',
        /isBcClosed\s*\?\s*['"]btn-toggle-bc-close is-reopen-action['"]\s*:\s*['"]btn-toggle-bc-close is-close-action['"]/.test(app));
}
check('ប៊ូតុងបិទប្រើ token ខៀវ',
    /\.is-close-action\s*\{[^}]*background(?:-color)?\s*:\s*var\(--action-primary\)/s.test(css));
check('ប៊ូតុងបើកប្រើ token ក្រហម',
    /\.is-reopen-action\s*\{[^}]*background(?:-color)?\s*:\s*var\(--action-danger\)/s.test(css));
check('រំលងប្រើ token ក្រហម',
    /\.btn-skip\s*\{[^}]*background-color\s*:\s*var\(--action-danger\)/s.test(css));
check('ស្កេន QR និងសាកល្បងប្រើប៊ូតុងព័ត៌មាន មិនមែនរំលង',
    (html.match(/class="btn-info"/g) || []).length >= 2 &&
    !/class="btn-skip"[^>]*>[^<]*(?:ស្កេន QR|សាកល្បង)/.test(html));
check('បញ្ជាក់/រក្សាទុកប្រើពណ៌ខៀវ',
    /\.btn-confirm\s*\{[^}]*background-color\s*:\s*var\(--action-primary\)/s.test(css));
check('ប៊ូតុងគ្រោះថ្នាក់ប្រើពណ៌ក្រហម',
    /\.btn-danger\s*\{[^}]*background-color\s*:\s*var\(--action-danger\)/s.test(css));
const summaryPending = ['summaryCodDollar', 'summaryCodRiel', 'summaryDodDollar', 'summaryDodRiel',
    'summaryTotalDollar', 'summaryTotalRiel'].every((id) => {
    const tag = new RegExp('<[a-z]+\\b[^>]*\\bid="' + id + '"[^>]*>').exec(html);
    return !!tag && /\bclass="val-pending"/.test(tag[0]);
});
if (react) {
    const openBc = chunkWith(react.viewList, /(?=<div class="barcode-list-item")/, 'BCOPEN1');
    const shutBc = chunkWith(react.viewList, /(?=<div class="barcode-list-item")/, 'BCSHUT2');
    check('ស្ថិតិទឹកប្រាក់បំបែក class យករួច មិនទាន់យក និងសរុប (JSX ពិត ៖ barcode បើក ➜ money-pending · បិទ ➜ money-collected · ស្ថិតិ ៣ tone · សរុបលើទំព័រ val-pending)',
        /class="bc-money-line money-pending/.test(openBc) && !/money-collected/.test(openBc) &&
        /class="bc-money-line money-collected/.test(shutBc) && !/money-pending/.test(shutBc) &&
        ['money-collected', 'money-pending', 'money-total'].every((c) => new RegExp('class="[^"]*\\b' + c + '\\b').test(react.daily)) &&
        summaryPending);
} else check('ស្ថិតិទឹកប្រាក់បំបែក class យករួច មិនទាន់យក និងសរុប',
    app.includes('money-collected') && app.includes('money-pending') && app.includes('money-total') &&
    /COD: <strong class="money-collected">/.test(app) &&
    /bcMoneyClass\s*=\s*isBcClosed\s*\?\s*['"]money-collected['"]\s*:\s*['"]money-pending['"]/.test(app) &&
    /class="money-pending"[^>]*>COD: <strong>/.test(app) &&
    ['summaryCodDollar', 'summaryCodRiel', 'summaryDodDollar', 'summaryDodRiel',
        'summaryTotalDollar', 'summaryTotalRiel'].every((id) =>
        new RegExp('id="' + id + '" class="val-pending"').test(html)));
const shownText = app + (react ? '\n' + Object.values(react).join('\n') : '');
check('តារាងតូចរក្សាអក្សរខ្លី ហើយប្រើពណ៌ជំនួសពាក្យស្ថានភាពស្ទួន',
    !/COD \((?:យករួច|មិនទាន់យក)\):/.test(shownText) &&
    !/DOD \((?:យករួច|មិនទាន់យក)\):/.test(shownText) &&
    !/សរុប \((?:យករួច|មិនទាន់យក)\):/.test(shownText) &&
    !/\bbcMoneyStatus\b/.test(app));
check('DOD មាន token ពណ៌ដាច់ដោយឡែកពី COD', hasVar('money-dod-collected', '#0E7490') &&
    hasVar('money-dod-pending', '#A21CAF'));
check('ច្បាប់ CSS របស់ DOD ឈ្នះលើ base (specificity ២ class + !important)',
    /\.money-collected\.kind-dod\s*\{[^}]*color\s*:\s*var\(--money-dod-collected\)\s*!important/s.test(css) &&
    /\.money-pending\.kind-dod\s*\{[^}]*color\s*:\s*var\(--money-dod-pending\)\s*!important/s.test(css));

// ⛔ បញ្ជីរឹង = កាលបរិច្ឆេទផុតកំណត់ ➜ **ដេរីវេ** កន្លែងគូរទាំងអស់ចេញពី
// `app.js` ពិត ៖ រាល់បន្ទាត់ដែលគូរ `DOD:` ជាមួយ class ទឹកប្រាក់ ត្រូវមាន
// `kind-dod`; ⛔ **ទិសផ្ទុយ** ៖ បន្ទាត់ `COD:` មិនត្រូវមានវា (បើមាន ពណ៌
// ត្រឡប់ទៅដូចគ្នាវិញ ហើយការអះអាងខាងលើនៅតែបៃតង)។
let dodLines, codOnlyLines;
if (react) {
    // App React ៖ កន្លែងគូរដេរីវេពី **markup ដែល JSX គូរពិត** លើផ្ទៃទឹកប្រាក់ទាំង ៤ (ប្រវត្តិ · បញ្ជី Barcode · ស្ថិតិ ២)
    const pairs = [react.history, react.viewList, react.daily, react.collected].flatMap(moneyLabelPairs);
    dodLines = pairs.filter((p) => p.label === 'DOD').map((p) => p.cls);
    codOnlyLines = pairs.filter((p) => p.label === 'COD').map((p) => p.cls);
} else {
    const moneyLines = app.split('\n').filter((l) =>
        /money-(collected|pending)|bcMoneyClass/.test(l) && /\b(COD|DOD):/.test(l));
    dodLines = moneyLines.filter((l) => /\bDOD:/.test(l));
    codOnlyLines = moneyLines.filter((l) => /\bCOD:/.test(l) && !/\bDOD:/.test(l));
}
check('ជាន់អប្បបរមា ៖ រកឃើញកន្លែងគូរ DOD យ៉ាងតិច ៤ និង COD យ៉ាងតិច ៣',
    dodLines.length >= 4 && codOnlyLines.length >= 3);
check('រាល់កន្លែងគូរ DOD មាន `kind-dod`',
    dodLines.length > 0 && dodLines.every((l) => l.includes('kind-dod')));
check('⛔ ទិសផ្ទុយ ៖ បន្ទាត់ COD សុទ្ធ គ្មាន `kind-dod`',
    codOnlyLines.length > 0 && codOnlyLines.every((l) => !l.includes('kind-dod')));

if (react) check('របាយការណ៍ខែបំបែក tone ទឹកប្រាក់ ៣ ប្រភេទ (JSX ពិត)',
    /class="mrep-tile money-collected"/.test(react.monthly) &&
    /class="[^"]*\bmrep-money-pending\b/.test(react.monthly) &&
    /class="mrep-tile money-total"/.test(react.monthly));
else check('របាយការណ៍ខែបំបែក tone ទឹកប្រាក់ ៣ ប្រភេទ',
    /tone:\s*['"]money-collected['"]/.test(app) &&
    /mrep-money-pending/.test(app) &&
    /tone:\s*['"]money-total['"]/.test(app));

if (failures) {
    console.error('\n❌ semantic UI color test ធ្លាក់ ' + failures + ' ចំណុច');
    process.exit(1);
}
console.log('\n✅ semantic UI color test ជោគជ័យ');
