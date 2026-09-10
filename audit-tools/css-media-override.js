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

// ⛔ ថ្នាក់ទី ២ (2.31.10) ៖ **class variant ដែលឈរ *មុន* base របស់វា**។
// `@media` មិនពាក់ព័ន្ធទេ — វាកើតក្នុងកូដកម្រិតកំពូលធម្មតា ៖ selector
// class ១ ដូចគ្នាទាំង ២ ➜ specificity **ស្មើ** ➜ **លំដាប់សម្រេច** ➜ ជួរ
// base ដែលឈរក្រោយឈ្នះ ➜ ការប្រកាសរបស់ variant **ស្លាប់ស្ងាត់ៗ**។
// វាស់បាន (2.31.10) ៖ `.zto-sync-modal-content` នៅបន្ទាត់ ៤៣៤ ខណៈ
// `.modal-content` នៅ ៩៨៤ ➜ `max-width` និង `text-align` របស់ប្រអប់ ZTO
// **មិនដែលអនុវត្តសោះ** (600px/center ជំនួស 520px/left) ➜ mutation លើ
// តម្លៃទាំងនោះ **រស់រានដោយគ្មានផលប៉ះពាល់**។
// ⛔ **ការសរសេរជាន់តាមលំដាប់ជា idiom ត្រឹមត្រូវ** (`.btn-danger` សរសេរជាន់
// `.btn-confirm` · `.hidden` សរសេរជាន់ `display: flex`) ➜ ការរាយគូទាំងអស់
// នឹងផ្តល់ **សំឡេងរំខាន ២១** លើ tree ស្អាត។ ដូច្នេះច្រកទ្វារតឹង ៖ រាយ
// **តែពេលឈ្មោះមួយ *ពង្រីក* មួយទៀត** (`X-<base>` ឬ `<base>-X`) — នោះជា
// ការប្រកាសចេតនាថា «ខ្ញុំជា variant របស់វា» ➜ វាត្រូវឈរ **ក្រោយ**។
// វាស់បាន ៖ ០ លើ tree ក្រោយកែ · ចាប់បានលើ tree មុនកែ។
function classPairsFromHtml(html) {
    const pairs = new Set();
    const re = /class\s*=\s*"([^"]+)"/g;
    let m;
    while ((m = re.exec(html))) {
        const cls = m[1].trim().split(/\s+/).filter(Boolean);
        for (let i = 0; i < cls.length; i++) {
            for (let j = 0; j < cls.length; j++) if (i !== j) pairs.add(cls[i] + '|' + cls[j]);
        }
    }
    return pairs;
}

function variantExtendsBase(variant, base) {
    return variant !== base && (variant.endsWith('-' + base) || variant.startsWith(base + '-'));
}

let problems = 0;
let scannedFiles = 0, scannedMediaRules = 0, scannedClassPairs = 0;
for (const app of APPS) {
    const file = path.join(ROOT, app, 'style.css');
    if (!fs.existsSync(file)) continue;
    const rules = collectRules(stripComments(fs.readFileSync(file, 'utf8')));
    const inMedia = rules.filter((r) => r.media);
    scannedFiles++;
    scannedMediaRules += inMedia.length;
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

    const htmlFile = path.join(ROOT, app, 'index.html');
    const pairs = fs.existsSync(htmlFile) ? classPairsFromHtml(fs.readFileSync(htmlFile, 'utf8')) : new Set();
    scannedClassPairs += pairs.size;
    const single = bare.filter((r) => /^\.[A-Za-z0-9_-]+$/.test(r.selector));
    const norm = (v) => v.replace(/\s+/g, ' ').trim().toLowerCase();
    const deadSeen = new Set();
    const deadHits = [];
    for (const v of single) {
        const vc = v.selector.slice(1);
        if (/!important/i.test(v.value)) continue;
        for (const b of single) {
            const bc = b.selector.slice(1);
            if (b.order <= v.order) continue;
            if (!variantExtendsBase(vc, bc)) continue;
            if (!pairs.has(vc + '|' + bc)) continue;
            if (v.prop !== b.prop || norm(v.value) === norm(b.value)) continue;
            const key = app + '|' + v.selector + '|' + v.prop;
            if (ACCEPTED.has(key) || deadSeen.has(key)) continue;
            deadSeen.add(key);
            deadHits.push({ v, b });
        }
    }
    console.log('    ច្បាប់ class តែមួយ: ' + single.length + ' · គូ class រួមក្នុង HTML: ' + pairs.size
        + ' · variant ស្លាប់ដោយ base ក្រោយវា: ' + deadHits.length);
    deadHits.forEach((h) => {
        problems++;
        console.log('   ⚠️  ' + h.v.selector + ' { ' + h.v.prop + ': ' + h.v.value + ' }  ស្លាប់ស្ងាត់ៗ');
        console.log('       base ដែលឈរក្រោយវា (specificity ស្មើ ➜ លំដាប់ឈ្នះ)៖ '
            + h.b.selector + ' { ' + h.b.prop + ': ' + h.b.value + ' }');
        console.log('       ➜ ផ្លាស់ជួរ variant ទៅក្រោយ base ឬបង្កើន specificity (ឧ. ' + h.b.selector + h.v.selector + ')');
    });
}

// ⛔ **ជាន់អប្បបរមា (positive floor)។** ការអះអាងបែប «គ្មានលំនាំអាក្រក់ទេ»
// ជាការអះអាង **អវត្តមាន** — វាពិតដោយស្វ័យប្រវត្តិលើ input ទទេ។ checker នេះ
// ត្រូវអះអាងជាមុនសិនថា **វាពិតជាបានឃើញកូដ**។ មើល `checker-coverage.js`។
const MIN_FILES = 2, MIN_MEDIA_RULES = 20, MIN_CLASS_PAIRS = 8;
if (scannedFiles < MIN_FILES || scannedMediaRules < MIN_MEDIA_RULES || scannedClassPairs < MIN_CLASS_PAIRS) {
    console.log('\n❌ ជាន់អប្បបរមា៖ រំពឹងឯកសារ >= ' + MIN_FILES + ' · ច្បាប់ក្នុង @media >= ' + MIN_MEDIA_RULES
        + ' · គូ class ក្នុង HTML >= ' + MIN_CLASS_PAIRS
        + ' តែឃើញ ' + scannedFiles + ' / ' + scannedMediaRules + ' / ' + scannedClassPairs
        + ' — checker នេះមិនបានឃើញ CSS ឬ HTML ទេ');
    process.exit(1);
}
console.log('\nជាន់អប្បបរមា៖ ស្កេន stylesheet ' + scannedFiles + ' · ច្បាប់ក្នុង @media ' + scannedMediaRules
    + ' · គូ class ក្នុង HTML ' + scannedClassPairs);

if (problems) {
    console.log('\n❌ ' + problems + ' ច្បាប់គ្មានប្រសិទ្ធភាព — specificity ស្មើ ➜ ច្បាប់ដែលមកក្រោយឈ្នះ។ ' +
        'ផ្លាស់ច្បាប់មូលដ្ឋានទៅមុន ដាក់វាចូល @media ផ្ទុយ ឬបង្កើន specificity របស់ variant។');
    process.exit(1);
}
console.log('\n✅ គ្មានច្បាប់ @media និងគ្មាន class variant ណាត្រូវស្លាប់ដោយច្បាប់ក្រោយវាទេ');
