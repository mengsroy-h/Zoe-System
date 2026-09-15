#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const appDir = process.env.SEMANTIC_UI_APP_DIR || path.join(__dirname, '..', 'ZoeW');
const css = fs.readFileSync(path.join(appDir, 'style.css'), 'utf8');
const app = fs.readFileSync(path.join(appDir, 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(appDir, 'index.html'), 'utf8');
let failures = 0;

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
check('ប៊ូតុងបិទ និងបើកមាន class តាមស្ថានភាព',
    /item\.isClosed\s*\?\s*['"]is-reopen-action['"]\s*:\s*['"]is-close-action['"]/.test(app));
check('ប៊ូតុង barcode បិទ និងបើកមាន class តាមស្ថានភាព',
    /isBcClosed\s*\?\s*['"]btn-toggle-bc-close is-reopen-action['"]\s*:\s*['"]btn-toggle-bc-close is-close-action['"]/.test(app));
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
check('ស្ថិតិទឹកប្រាក់បំបែក class យករួច មិនទាន់យក និងសរុប',
    app.includes('money-collected') && app.includes('money-pending') && app.includes('money-total') &&
    /COD: <strong class="money-collected">/.test(app) &&
    /bcMoneyClass\s*=\s*isBcClosed\s*\?\s*['"]money-collected['"]\s*:\s*['"]money-pending['"]/.test(app) &&
    /class="money-pending"[^>]*>COD: <strong>/.test(app) &&
    ['summaryCodDollar', 'summaryCodRiel', 'summaryDodDollar', 'summaryDodRiel',
        'summaryTotalDollar', 'summaryTotalRiel'].every((id) =>
        new RegExp('id="' + id + '" class="val-pending"').test(html)));
check('តារាងតូចរក្សាអក្សរខ្លី ហើយប្រើពណ៌ជំនួសពាក្យស្ថានភាពស្ទួន',
    !/COD \((?:យករួច|មិនទាន់យក)\):/.test(app) &&
    !/DOD \((?:យករួច|មិនទាន់យក)\):/.test(app) &&
    !/សរុប \((?:យករួច|មិនទាន់យក)\):/.test(app) &&
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
const moneyLines = app.split('\n').filter((l) =>
    /money-(collected|pending)|bcMoneyClass/.test(l) && /\b(COD|DOD):/.test(l));
const dodLines = moneyLines.filter((l) => /\bDOD:/.test(l));
const codOnlyLines = moneyLines.filter((l) => /\bCOD:/.test(l) && !/\bDOD:/.test(l));
check('ជាន់អប្បបរមា ៖ រកឃើញកន្លែងគូរ DOD យ៉ាងតិច ៤ និង COD យ៉ាងតិច ៣',
    dodLines.length >= 4 && codOnlyLines.length >= 3);
check('រាល់កន្លែងគូរ DOD មាន `kind-dod`',
    dodLines.length > 0 && dodLines.every((l) => l.includes('kind-dod')));
check('⛔ ទិសផ្ទុយ ៖ បន្ទាត់ COD សុទ្ធ គ្មាន `kind-dod`',
    codOnlyLines.length > 0 && codOnlyLines.every((l) => !l.includes('kind-dod')));

check('របាយការណ៍ខែបំបែក tone ទឹកប្រាក់ ៣ ប្រភេទ',
    /tone:\s*['"]money-collected['"]/.test(app) &&
    /mrep-money-pending/.test(app) &&
    /tone:\s*['"]money-total['"]/.test(app));

if (failures) {
    console.error('\n❌ semantic UI color test ធ្លាក់ ' + failures + ' ចំណុច');
    process.exit(1);
}
console.log('\n✅ semantic UI color test ជោគជ័យ');
