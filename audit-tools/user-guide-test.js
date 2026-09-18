#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const appDir = process.env.USER_GUIDE_APP_DIR || path.join(__dirname, '..', 'ZoeW');
const read = (name) => {
    try { return fs.readFileSync(path.join(appDir, name), 'utf8'); } catch (e) { return ''; }
};
const guide = read('guide.html');
const index = read('index.html');
const css = read('style.css');
const sw = read('sw.js');
let failures = 0;

function check(label, condition) {
    if (condition) console.log('ok    ' + label);
    else {
        failures += 1;
        console.log('FAIL  ' + label);
    }
}

check('មាន ZoeW/guide.html', guide.length > 5000);
check('ឯកសារ HTML5 ជាភាសាខ្មែរ និង responsive',
    /<!doctype html>/i.test(guide) && /<html\s+lang="km"/i.test(guide) &&
    /name="viewport"/i.test(guide));
check('មាន landmark និង skip link សម្រាប់ accessibility',
    /class="skip-link"/.test(guide) && /<nav\b[^>]*aria-label=/i.test(guide) &&
    /<main\s+id="main-content"/.test(guide));
check('មានផ្នែកមាតិកាគ្រប់គ្រាន់', (guide.match(/<section\b/g) || []).length >= 14);
[
    'ចាប់ផ្ដើម', 'Firebase', 'ស្កេន', 'Locker', 'បិទ', 'បើក',
    'យករួច', 'មិនទាន់យក', 'តម្លៃកញ្ចប់ទាំងអស់', 'COD', 'DOD',
    'ស្ថិតិ', 'របាយការណ៍', 'Export', 'Google Sheet', 'សុវត្ថិភាព',
    'Offline', 'Backup', 'ដោះស្រាយបញ្ហា'
].forEach((term) => check('មានប្រធានបទ «' + term + '»', guide.includes(term)));

// ⛔ បញ្ជីពាក្យខាងលើជា **កាលបរិច្ឆេទផុតកំណត់** ៖ វាត្រូវសរសេរនៅជុំមួយ ហើយ
// មុខងារដែល ship *ក្រោយ* មិនចូលបញ្ជី ➜ សៀវភៅចាស់ស្ងាត់ៗ ខណៈ checker បៃតង។
// វាស់បាន (2026-09-11) ៖ កុងតាក់របា Slide **ទាំង ៤** អវត្តមានក្នុង
// `guide.html` — **អ្នកប្រើចាប់បាន មិនមែនឧបករណ៍ទេ**។ ដូច្នេះបញ្ជីត្រូវ
// **ដេរីវេចេញពី `index.html` ពិត** ៖ រាល់កុងតាក់ដែលអ្នកប្រើឃើញ ត្រូវមាន
// ការពន្យល់ក្នុងសៀវភៅ។
const drawerLabels = (index.match(/class="drawer-toggle-label">[^<]+</g) || [])
    .map((tag) => tag.replace(/^class="drawer-toggle-label">/, '').replace(/<$/, '').trim())
    .filter(Boolean);
check('ជាន់អប្បបរមា៖ អានស្លាកកុងតាក់របា Slide ចេញពី index.html បានយ៉ាងតិច ៣',
    drawerLabels.length >= 3);
drawerLabels.forEach((label) => check('សៀវភៅពន្យល់កុងតាក់ «' + label + '»',
    guide.includes(label)));
check('គ្មាន JavaScript ឬ inline event handler ក្នុងឯកសារអាន',
    !/<script\b/i.test(guide) && !/\son[a-z]+\s*=/i.test(guide) && !/javascript:/i.test(guide));
check('មានរចនាប័ទ្ម print និង focus ដែលអាចមើលឃើញ',
    /@media\s+print/.test(guide) && /:focus-visible/.test(guide));
check('តំណលេខកំណែទាំង ២ បើក guide.html',
    (index.match(/<a\b[^>]*class="app-version-line"[^>]*data-app-version[^>]*href="\.\/guide\.html"[^>]*>/g) || []).length === 2);
check('តំណលេខកំណែមាន aria-label និងការពារ opener',
    (index.match(/aria-label="បើកសៀវភៅណែនាំ ZoeW"/g) || []).length === 2 &&
    (index.match(/rel="noopener"/g) || []).length >= 2);
check('តំណលេខកំណែបើកក្នុងផ្ទាំង App ដដែល ដើម្បីគាំទ្រ PWA/WebView',
    (index.match(/<a\b[^>]*class="app-version-line"[^>]*data-app-version[^>]*>/g) || [])
        .every((tag) => /\btarget\s*=\s*["']_self["']/i.test(tag)));
check('CSS បង្ហាញថាលេខកំណែអាចចុចអានសៀវភៅណែនាំ',
    /\.app-version-line\[href\]::after\s*\{[^}]*content\s*:/s.test(css));
check('Service Worker cache ឯកសារណែនាំសម្រាប់ Offline',
    /CORE_SHELL\s*=\s*\[[\s\S]*['"]\.\/guide\.html['"]/.test(sw));
const routeStart = sw.indexOf('const GUIDE_PATH');
const routeEnd = sw.indexOf('function linkIsFrugal');
let guideNavigationIsDistinct = false;
if (routeStart !== -1 && routeEnd > routeStart) {
    const sandbox = { self: { location: { href: 'https://example.test/app/sw.js' } }, URL };
    vm.runInNewContext(sw.slice(routeStart, routeEnd) + `
        result = [
            cacheKeyFor({ mode: 'navigate', url: 'https://example.test/app/guide.html' }),
            cacheKeyFor({ mode: 'navigate', url: 'https://example.test/app/guide' }),
            cacheKeyFor({ mode: 'navigate', url: 'https://example.test/app/index.html' })
        ];
    `, sandbox);
    guideNavigationIsDistinct = sandbox.result[0] === './guide.html' &&
        sandbox.result[1] === './guide.html' && sandbox.result[2] === './index.html';
}
check('Service Worker មិនបង្វែរ guide.html ឬ Netlify /guide ទៅ index.html', guideNavigationIsDistinct);

// ⛔ **សៀវភៅណែនាំត្រូវពន្យល់ផ្ទៃអាជ្ញាប័ណ្ណដែល App *ពិតជា ship*។**
// វាស់បាន (2.37.3) ៖ ពិដានឧបករណ៍ក្នុង Key ១ (`maxDevices` · កៅអី `d1..d5`)
// ship តាំងពី 2.37.0 ហើយ README ទាំង ២ រៀបរាប់វា — តែ **សៀវភៅក្នុង App**
// (អ្វីដែល *អ្នកប្រើ* អាន) គ្មានពាក្យមួយម៉ាត់សោះ ➜ អតិថិជនដែលឃើញ
// «Key នេះប្រើគ្រប់ចំនួនឧបករណ៍…» គ្មានកន្លែងរកចម្លើយ ➜ គេសន្និដ្ឋានថា
// Key ខូច។ ⛔ ច្រកទ្វារជា **លក្ខខណ្ឌ** ៖ វាទាមទារតែពេលកូដពិត ship
// កៅអី ➜ ការដកមុខងារនោះចេញ ធ្វើឲ្យច្រកទ្វារធូរដោយខ្លួនឯង។
(function () {
    let licenseSrc = '';
    try { licenseSrc = fs.readFileSync(path.join(appDir, 'license-verify.js'), 'utf8'); } catch (e) { licenseSrc = ''; }
    const shipsSeats = /LICENSE_SEAT_SLOTS\s*=\s*\[/.test(licenseSrc);
    if (!shipsSeats) return;
    // ឃ្លាដែលអ្នកប្រើឃើញពិត ➜ ដេរីវេពី `licenseFailureMessage()` ក្នុង app.js
    let appSrc = '';
    try { appSrc = fs.readFileSync(path.join(appDir, 'app.js'), 'utf8'); } catch (e) { appSrc = ''; }
    const seatMsg = /case 'seat-taken': return '([^']+)'/.exec(appSrc);
    check('ជាន់អប្បបរមា ៖ ស្រង់សារ `seat-taken` ចេញពី `app.js` បាន', !!seatMsg);
    const needle = seatMsg ? seatMsg[1].split('!')[0].trim() : '';
    check('⛔ សៀវភៅពន្យល់ពិដានចំនួនឧបករណ៍ក្នុង Key ១', guide.includes('ចំនួនឧបករណ៍'));
    check('⛔ សៀវភៅដកស្រង់សារ `seat-taken` ដែលអ្នកប្រើឃើញពិត',
        !!needle && guide.includes(needle));
    check('⛔ សៀវភៅប្រាប់ផ្លូវដោះស្រាយ (ដោះឧបករណ៍)', guide.includes('ដោះឧបករណ៍'));
})();

if (failures) {
    console.error('\n❌ user guide test ធ្លាក់ ' + failures + ' ចំណុច');
    process.exit(1);
}
console.log('\n✅ user guide test ជោគជ័យ');
