const fs = require('fs');
const path = require('path');

const ROOT = process.env.CSSMEDIA_APP_DIR || path.join(__dirname, '..');
const APPS = ['ZoeW', 'ZoeKeyGen'];

// ច្បាប់ក្នុង @media មាន specificity ដូចច្បាប់ធម្មតា — @media មិនបន្ថែម specificity ទេ។
// ដូច្នេះច្បាប់ដូចគ្នាដែលមកក្រោយ ក្រៅ @media នឹងឈ្នះ ហើយច្បាប់ក្នុង @media ស្លាប់ស្ងាត់ៗ។
// ថ្នាក់កំហុសនេះធ្លាប់ធ្វើឲ្យ `.table-responsive { max-height: none }` ក្នុង min-width:992px
// គ្មានប្រសិទ្ធភាព ➜ តារាងប្រវត្តិលើកុំព្យូទ័រកាត់ត្រឹម 62vh ជំនួសពេញកម្ពស់ជួរ។
// ការសរសេរជាន់ដោយ *តម្លៃដដែល* មិនរាប់ទេ — វាជាការសរសេរស្ទួន មិនប្តូរឥរិយាបថ។
// ធាតុនីមួយៗត្រូវមានហេតុផលសរសេរជាប់ — ធាតុគ្មានហេតុផលនឹងលាក់កំហុសបន្ទាប់។
const ACCEPTED = new Set([]);

function stripComments(css) {
    return css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
}

function collectRules(css) {
    const rules = [];
    const stack = [];
    let i = 0, buf = '', order = 0;
    while (i < css.length) {
        const c = css[i];
        if (c === '{') {
            const head = buf.trim();
            buf = '';
            if (head.startsWith('@')) {
                stack.push({ at: head });
                i++;
                continue;
            }
            const end = matchBlock(css, i);
            const body = css.slice(i + 1, end);
            const media = stack.filter((s) => /^@media/i.test(s.at)).map((s) => s.at).join(' and ');
            const inKeyframes = stack.some((s) => /^@(-\w+-)?keyframes/i.test(s.at));
            if (!inKeyframes) {
                head.split(',').forEach((sel) => {
                    const selector = sel.trim().replace(/\s+/g, ' ');
                    if (!selector) return;
                    declsOf(body).forEach(([prop, value]) => {
                        rules.push({ selector, prop, value, media, order: order++ });
                    });
                });
            }
            i = end + 1;
            continue;
        }
        if (c === '}') { stack.pop(); buf = ''; i++; continue; }
        buf += c;
        i++;
    }
    return rules;
}

function matchBlock(css, openIdx) {
    let depth = 0;
    for (let i = openIdx; i < css.length; i++) {
        if (css[i] === '{') depth++;
        else if (css[i] === '}') { depth--; if (depth === 0) return i; }
    }
    return css.length - 1;
}

function declsOf(body) {
    const out = [];
    body.split(';').forEach((part) => {
        const at = part.indexOf(':');
        if (at === -1) return;
        const prop = part.slice(0, at).trim().toLowerCase();
        const value = part.slice(at + 1).trim();
        if (!prop || !value || prop.startsWith('@') || prop.includes('{')) return;
        out.push([prop, value]);
    });
    return out;
}

let problems = 0;
for (const app of APPS) {
    const file = path.join(ROOT, app, 'style.css');
    if (!fs.existsSync(file)) continue;
    const rules = collectRules(stripComments(fs.readFileSync(file, 'utf8')));
    const inMedia = rules.filter((r) => r.media);
    const bare = rules.filter((r) => !r.media);
    const hits = [];
    for (const r of inMedia) {
        const norm = (v) => v.replace(/\s+/g, ' ').trim().toLowerCase();
        const killer = bare.find((b) => b.order > r.order && b.selector === r.selector && b.prop === r.prop &&
            norm(b.value) !== norm(r.value) && !/!important/i.test(r.value));
        if (!killer) continue;
        const key = app + '|' + r.selector + '|' + r.prop;
        if (ACCEPTED.has(key)) continue;
        hits.push({ r, killer, key });
    }
    console.log('--- ' + app + ' --- ច្បាប់ក្នុង @media: ' + inMedia.length + '   ស្លាប់ដោយច្បាប់ក្រោយ: ' + hits.length);
    hits.forEach((h) => {
        problems++;
        console.log('   ⚠️  ' + h.r.selector + ' { ' + h.r.prop + ': ' + h.r.value + ' }  ក្នុង ' + h.r.media);
        console.log('       ត្រូវសរសេរជាន់ដោយច្បាប់ក្រៅ @media ដែលមកក្រោយ៖ ' + h.killer.prop + ': ' + h.killer.value);
    });
}

if (problems) {
    console.log('\n❌ ' + problems + ' ច្បាប់ក្នុង @media គ្មានប្រសិទ្ធភាព — @media មិនបន្ថែម specificity ទេ ' +
        'ដូច្នេះច្បាប់ដូចគ្នាដែលមកក្រោយឈ្នះ។ ផ្លាស់ច្បាប់មូលដ្ឋានទៅមុន ឬដាក់វាចូល @media ផ្ទុយ។');
    process.exit(1);
}
console.log('\n✅ គ្មានច្បាប់ @media ណាត្រូវសរសេរជាន់ដោយច្បាប់មូលដ្ឋានក្រោយវាទេ');
