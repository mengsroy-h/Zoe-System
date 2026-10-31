const fs = require('fs');
const path = require('path');

// ថត app អាច override បាន ដើម្បីឲ្យ `run-all.sh <baseline>` និង
// `checker-coverage.js` បញ្ជាក់បានថា checker នេះពិតជាអានកូដមែន។
const ROOT = process.env.CSSCLASS_APP_DIR ? path.resolve(process.env.CSSCLASS_APP_DIR) : path.resolve(__dirname, '..');
const APPS = ['ZoeW', 'ZoeKeyGen'];

const IGNORE = new Set([
    'hidden', 'active', 'open', 'visible', 'current', 'offline', 'show', 'selected',
    'disabled', 'modal', 'modal-content',
    'scanner-section'
]);

// ទិសបញ្ច្រាស ៖ class ដែលមានច្បាប់ CSS តែគ្មាន markup/កូដណាដាក់វា = CSS ស្លាប់ (សល់ក្រោយដកមុខងារ)។
// ⛔ ធាតុនីមួយៗត្រូវមានហេតុផល ៖ ច្បាប់ស្លាប់ក្នុង `src/styles/app.css` ជាប់សោ forbidden-zone (`forbidden-zone-lock.test.ts`) ➜ ដកបានតែតាមសំណើម្ចាស់ + ឧបករណ៍ពិត។
const DEAD_ALLOWED = {
    ZoeW: {
        'recently-deleted-btn': 'app.css ជាប់សោ forbidden-zone (ប៊ូតុងធុងសំរាមរចនាចាស់)',
        'manual-adjust-btn': 'app.css ជាប់សោ forbidden-zone (ប៊ូតុងកែទឹកប្រាក់រចនាចាស់)',
        'security-btn': 'app.css ជាប់សោ forbidden-zone (ប៊ូតុងសុវត្ថិភាពរចនាចាស់)',
        'btn-view-list': 'app.css ជាប់សោ forbidden-zone (ប៊ូតុងមើលបញ្ជីរចនាចាស់)'
    },
    ZoeKeyGen: {}
};

function definedClasses(css) {
    const text = css.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/url\([^)]*\)/g, ' ').replace(/"[^"\n]*"|'[^'\n]*'/g, ' ');
    const out = new Set();
    for (const m of text.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) out.add(m[1]);
    return out;
}

let problems = 0;
for (const app of APPS) {
    const cssPath = path.join(ROOT, app, 'style.css');
    const css = fs.readFileSync(cssPath, 'utf8');
    const defined = new Set();
    for (const m of css.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) defined.add(m[1]);

    const codeText = ['index.html', 'app.js', 'components.js', 'boot-flags.js', 'guide.html']
        .map((file) => path.join(ROOT, app, file)).filter((p) => fs.existsSync(p)).map((p) => fs.readFileSync(p, 'utf8')).join('\n');
    const declared = definedClasses(css);
    const allowed = DEAD_ALLOWED[app] || {};
    const unused = [...declared].filter((c) => !new RegExp('(?<![\\w-])' + c.replace(/-/g, '\\-') + '(?![\\w-])').test(codeText)).sort();
    const deadNew = unused.filter((c) => !Object.prototype.hasOwnProperty.call(allowed, c));
    const staleAllowed = Object.keys(allowed).filter((c) => !unused.includes(c));
    if (declared.size < (app === 'ZoeW' ? 300 : 80) || codeText.length < (app === 'ZoeW' ? 400000 : 80000)) {
        problems++;
        console.log(`   ⚠️  ${app}: ជាន់អប្បបរមា ៖ class ${declared.size} · កូដ ${codeText.length} តួ — អានមិនគ្រប់`);
    }
    console.log(`--- ${app} --- class ក្នុង CSS ${declared.size} · គ្មានអ្នកប្រើ ${unused.length} (អនុញ្ញាតដោយហេតុផល ${unused.length - deadNew.length})`);
    deadNew.forEach((c) => { problems++; console.log(`   ⚠️  .${c}   (មានច្បាប់ក្នុង ${app}/style.css តែគ្មាន markup/កូដណាប្រើ ➜ CSS ស្លាប់)`); });
    staleAllowed.forEach((c) => { problems++; console.log(`   ⚠️  DEAD_ALLOWED.${app}['${c}'] លែងត្រូវការ (class នេះមានអ្នកប្រើ ឬបាត់ពី CSS)`); });

    const used = new Map();
    // ⛔ App React ៖ `index.html` ជា markup **ដំបូង** ប៉ុណ្ណោះ ➜ class ក្នុង JSX ដែលមិនគូរពេលដំបូង (ផ្ទាំង crash · toast ·
    //    បញ្ជីថាមវន្ត) រស់តែក្នុង `components.js` (ទិដ្ឋភាពអត្ថបទនៃ `.tsx`) ➜ ត្រូវស្កេនវាដែរ ទាំង `className: "…"` និង
    //    ផ្នែកថេរនៃ template (`className: \`a b ${x}\`` ➜ `a` · `b`)។
    for (const file of ['index.html', 'app.js', 'components.js']) {
        const p = path.join(ROOT, app, file);
        if (!fs.existsSync(p)) continue;
        const src = fs.readFileSync(p, 'utf8');
        for (const m of src.matchAll(/class\s*=\s*["'`]([^"'`]*)["'`]/g)) {
            m[1].split(/\s+/).forEach((c) => {
                const name = c.trim();
                if (!name || name.includes('$') || name.includes('{')) return;
                if (!used.has(name)) used.set(name, file);
            });
        }
        for (const m of src.matchAll(/classList\.(?:add|remove|toggle)\(\s*['"]([\w-]+)['"]/g)) {
            if (!used.has(m[1])) used.set(m[1], file);
        }
        for (const m of src.matchAll(/className\s*=\s*['"]([^'"]+)['"]/g)) {
            m[1].split(/\s+/).forEach((c) => { if (c && !used.has(c)) used.set(c, file); });
        }
        for (const m of src.matchAll(/className:\s*(?:"([^"]*)"|`([^`]*)`)/g)) {
            const text = m[1] !== undefined ? m[1] : m[2].replace(/\$\{[^}]*\}/g, ' ');
            text.split(/\s+/).forEach((c) => {
                if (!c || !/^-?[_a-zA-Z][\w-]*$/.test(c)) return;
                if (!used.has(c)) used.set(c, file);
            });
        }
    }

    const missing = [...used.keys()].filter((c) => !defined.has(c) && !IGNORE.has(c)).sort();
    console.log(`--- ${app} --- classes used: ${used.size}   defined in style.css: ${defined.size}   undefined: ${missing.length}`);
    missing.forEach((c) => {
        problems++;
        console.log(`   ⚠️  .${c}   (used in ${used.get(c)}, no rule in ${app}/style.css)`);
    });
}

if (problems) {
    console.log(`\n❌ ${problems} បញ្ហា ៖ class ប្រើតែគ្មានច្បាប់ CSS · ឬច្បាប់ CSS ដែលគ្មានអ្នកប្រើ (CSS ស្លាប់) · ឬ allowlist ហួសសម័យ`);
    process.exit(1);
}
console.log('\n✅ គ្រប់ class ដែលប្រើ មានច្បាប់ CSS · គ្មាន CSS ស្លាប់ក្រៅ allowlist ដែលមានហេតុផល');
