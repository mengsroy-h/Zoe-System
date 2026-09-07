#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

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
check('គ្មាន JavaScript ឬ inline event handler ក្នុងឯកសារអាន',
    !/<script\b/i.test(guide) && !/\son[a-z]+\s*=/i.test(guide) && !/javascript:/i.test(guide));
check('មានរចនាប័ទ្ម print និង focus ដែលអាចមើលឃើញ',
    /@media\s+print/.test(guide) && /:focus-visible/.test(guide));
check('តំណលេខកំណែទាំង ២ បើក guide.html',
    (index.match(/<a\b[^>]*class="app-version-line"[^>]*data-app-version[^>]*href="\.\/guide\.html"[^>]*>/g) || []).length === 2);
check('តំណលេខកំណែមាន aria-label និងការពារ opener',
    (index.match(/aria-label="បើកសៀវភៅណែនាំ ZoeW"/g) || []).length === 2 &&
    (index.match(/rel="noopener"/g) || []).length >= 2);
check('CSS បង្ហាញថាលេខកំណែអាចចុចអានសៀវភៅណែនាំ',
    /\.app-version-line\[href\]::after\s*\{[^}]*content\s*:/s.test(css));
check('Service Worker cache ឯកសារណែនាំសម្រាប់ Offline',
    /CORE_SHELL\s*=\s*\[[\s\S]*['"]\.\/guide\.html['"]/.test(sw));

if (failures) {
    console.error('\n❌ user guide test ធ្លាក់ ' + failures + ' ចំណុច');
    process.exit(1);
}
console.log('\n✅ user guide test ជោគជ័យ');
