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

let problems = 0;
for (const app of APPS) {
    const cssPath = path.join(ROOT, app, 'style.css');
    const css = fs.readFileSync(cssPath, 'utf8');
    const defined = new Set();
    for (const m of css.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) defined.add(m[1]);

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
    console.log(`\n❌ ${problems} class(es) used with no CSS rule — check whether the element renders usably.`);
    process.exit(1);
}
console.log('\n✅ គ្រប់ class ដែលប្រើ មានច្បាប់ CSS');
