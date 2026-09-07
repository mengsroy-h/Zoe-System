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
    /COD \(យករួច\): <strong class="money-collected">/.test(app) &&
    /bcMoneyClass\s*=\s*isBcClosed\s*\?\s*['"]money-collected['"]\s*:\s*['"]money-pending['"]/.test(app) &&
    /COD \(មិនទាន់យក\): <strong>/.test(app) &&
    ['summaryCodDollar', 'summaryCodRiel', 'summaryDodDollar', 'summaryDodRiel',
        'summaryTotalDollar', 'summaryTotalRiel'].every((id) =>
        new RegExp('id="' + id + '" class="val-pending"').test(html)));
check('របាយការណ៍ខែបំបែក tone ទឹកប្រាក់ ៣ ប្រភេទ',
    /tone:\s*['"]money-collected['"]/.test(app) &&
    /mrep-money-pending/.test(app) &&
    /tone:\s*['"]money-total['"]/.test(app));

if (failures) {
    console.error('\n❌ semantic UI color test ធ្លាក់ ' + failures + ' ចំណុច');
    process.exit(1);
}
console.log('\n✅ semantic UI color test ជោគជ័យ');
