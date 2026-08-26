// ថ្នាក់កំហុស៖ **animation ដែលបង្កើត layout ឬ paint ឡើងវិញរាល់ស៊ុម**។
//
// មានតែ `transform` និង `opacity` ប៉ុណ្ណោះដែល browser អាចធ្វើចលនាលើ
// compositor បាន។ អ្វីផ្សេងតម្រូវឲ្យ main thread ធ្វើការរាល់ស៊ុម៖
//
//   • property ខាង **layout** (`top`, `height`, `margin`…) ➜ គណនា layout
//     ឡើងវិញរាល់ស៊ុម **សម្រាប់ទំព័រទាំងមូល** ។ នេះជាថ្លៃបំផុត ហើយ
//     ការដាក់ layer មិនជួយអ្វីទេ ព្រោះ layout ជារបស់រួម។
//   • property ខាង **paint** (`background-color`, `box-shadow`…) ➜ គូរឡើងវិញ
//     រាល់ស៊ុម។ ការដាក់ធាតុនោះលើ layer ដោយឡែក (`transform: translateZ(0)`
//     ឬ `will-change`) កំណត់ការគូរឡើងវិញនោះឲ្យនៅត្រឹមធាតុនោះ ➜ ទទួលយកបាន។
//
// កំហុសពិតដែលរកឃើញដោយឧបករណ៍នេះ៖
//   `.scan-line` ធ្វើចលនាលើ `top` ➜ layout រាល់ស៊ុម **ចំពេល ZXing កំពុងឌិកូដ**
//   `.status-dot` ធ្វើចលនាលើ `box-shadow` ដោយ `infinite` ➜ របាខាងលើគូរឡើងវិញ
//   រាល់ស៊ុមជារៀងរហូត។
const fs = require('fs');
const path = require('path');

const ROOT = process.env.ANIM_APP_DIR || path.join(__dirname, '..');
const APPS = ['ZoeW', 'ZoeKeyGen'];

const COMPOSITED = new Set(['transform', 'opacity', '-webkit-transform', 'translate', 'rotate', 'scale']);
const LAYOUT = new Set([
    'top', 'left', 'right', 'bottom', 'inset', 'inset-block', 'inset-inline',
    'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
    'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
    'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
    'font-size', 'line-height', 'letter-spacing', 'border-width', 'flex', 'flex-basis',
    'flex-grow', 'flex-shrink', 'gap', 'row-gap', 'column-gap', 'grid-template-columns',
    'grid-template-rows', 'order', 'position', 'display', 'float', 'vertical-align'
]);

let scannedFiles = 0, scannedRules = 0;
let failed = 0;
function fail(app, msg) { console.log(`   ⚠️  ${msg}`); failed++; }

function stripComments(css) {
    return css.replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length));
}

function matchBrace(css, openIdx) {
    let depth = 0;
    for (let i = openIdx; i < css.length; i++) {
        if (css[i] === '{') depth++;
        else if (css[i] === '}') { depth--; if (depth === 0) return i; }
    }
    return -1;
}

// រាល់ @keyframes ➜ សំណុំ property ដែលវាធ្វើចលនា
function collectKeyframes(css) {
    const frames = new Map();
    const re = /@(?:-webkit-)?keyframes\s+([A-Za-z0-9_-]+)\s*\{/g;
    let m;
    while ((m = re.exec(css)) !== null) {
        const open = css.indexOf('{', m.index + m[0].length - 1);
        const close = matchBrace(css, open);
        if (close === -1) continue;
        const body = css.slice(open + 1, close);
        const props = new Set();
        body.replace(/([-a-zA-Z]+)\s*:/g, (all, prop) => {
            const p = prop.toLowerCase();
            if (p !== 'content') props.add(p);
            return all;
        });
        frames.set(m[1], props);
        re.lastIndex = close;
    }
    return frames;
}

// រាល់ប្លុកច្បាប់ (រួមទាំងក្នុង @media) ➜ { selector, decls }
function collectRules(css) {
    const rules = [];
    const walk = (text, offset) => {
        let i = 0;
        while (i < text.length) {
            const open = text.indexOf('{', i);
            if (open === -1) break;
            const close = matchBrace(text, open);
            if (close === -1) break;
            const selector = text.slice(i, open).trim().replace(/\s+/g, ' ');
            const body = text.slice(open + 1, close);
            if (/^@(?:-webkit-)?keyframes/.test(selector)) {
                // រំលង — ដោះស្រាយដោយ collectKeyframes រួចហើយ
            } else if (selector.startsWith('@')) {
                walk(body, offset + open + 1);
            } else if (selector) {
                rules.push({ selector: selector, decls: body });
            }
            i = close + 1;
        }
    };
    walk(css, 0);
    return rules;
}

function declValue(decls, prop) {
    const m = decls.match(new RegExp('(?:^|[;{\\s])' + prop + '\\s*:\\s*([^;}]+)', 'i'));
    return m ? m[1].trim() : null;
}

// ធាតុនេះមាន layer ផ្ទាល់ខ្លួនទេ? បើមាន ការគូរឡើងវិញនៅត្រឹមវា
function hasOwnLayer(decls) {
    const willChange = declValue(decls, 'will-change');
    if (willChange && /transform|opacity|filter/i.test(willChange)) return true;
    const transform = declValue(decls, 'transform');
    if (transform && /translate3d|translateZ|\bscale3d\b/i.test(transform)) return true;
    return false;
}

for (const app of APPS) {
    const file = path.join(ROOT, app, 'style.css');
    if (!fs.existsSync(file)) continue;
    const css = stripComments(fs.readFileSync(file, 'utf8'));
    const frames = collectKeyframes(css);
    const rules = collectRules(css);
    scannedFiles++;
    scannedRules += rules.length;

    let animCount = 0, checked = 0;
    console.log(`--- ${app} --- @keyframes: ${frames.size}   ច្បាប់៖ ${rules.length}`);

    for (const rule of rules) {
        // ១) `transition: all` ➜ browser ពិនិត្យគ្រប់ property ដែលអាចធ្វើចលនា
        const transition = declValue(rule.decls, 'transition');
        if (transition && /(^|[\s,])all([\s,]|$)/.test(transition)) {
            fail(app, `${rule.selector} { transition: ${transition} }  — \`all\` ធ្វើឲ្យ browser ពិនិត្យគ្រប់ property; សរសេរបញ្ជីច្បាស់លាស់`);
        }

        const animation = declValue(rule.decls, 'animation') || declValue(rule.decls, 'animation-name');
        if (!animation || /^none$/i.test(animation)) continue;
        animCount++;

        const infinite = /\binfinite\b/.test(animation);
        const name = animation.split(/[\s,]+/).find((tok) => frames.has(tok));
        if (!name) continue;
        checked++;

        const props = frames.get(name);
        const layoutProps = [...props].filter((p) => LAYOUT.has(p));
        const paintProps = [...props].filter((p) => !LAYOUT.has(p) && !COMPOSITED.has(p));

        if (layoutProps.length) {
            fail(app, `${rule.selector} ➜ @keyframes ${name} ធ្វើចលនាលើ layout property [${layoutProps.join(', ')}] — គណនា layout ឡើងវិញរាល់ស៊ុម; ប្រើ transform ជំនួស`);
        }
        if (paintProps.length && infinite && !hasOwnLayer(rule.decls)) {
            fail(app, `${rule.selector} ➜ @keyframes ${name} (infinite) ធ្វើចលនាលើ [${paintProps.join(', ')}] ដោយគ្មាន layer ផ្ទាល់ខ្លួន — គូរឡើងវិញរាល់ស៊ុមជារៀងរហូត; បន្ថែម \`will-change\` ឬ \`transform: translateZ(0)\` ឬប្តូរទៅ transform/opacity`);
        }
    }
    console.log(`    animation ដែលប្រើ៖ ${animCount}   ផ្គូផ្គងនឹង @keyframes៖ ${checked}`);
}

// ⛔ **ជាន់អប្បបរមា (positive floor)។** ការអះអាងបែប «គ្មានលំនាំអាក្រក់ទេ»
// ជាការអះអាង **អវត្តមាន** — វាពិតដោយស្វ័យប្រវត្តិលើ input ទទេ។ checker នេះ
// ត្រូវអះអាងជាមុនសិនថា **វាពិតជាបានឃើញកូដ**។ មើល `checker-coverage.js`។
const MIN_FILES = 2, MIN_RULES = 200;
if (scannedFiles < MIN_FILES || scannedRules < MIN_RULES) {
    console.log(`\n❌ ជាន់អប្បបរមា៖ រំពឹងឯកសារ >= ${MIN_FILES} និងច្បាប់ CSS >= ${MIN_RULES}`
        + ` តែឃើញ ${scannedFiles} / ${scannedRules} — checker នេះមិនបានឃើញ CSS ទេ`);
    process.exit(1);
}
console.log(`\nជាន់អប្បបរមា៖ ស្កេន stylesheet ${scannedFiles} · ច្បាប់ ${scannedRules}`);

if (failed) {
    console.log(`\n❌ ${failed} animation/transition ដែលបង្កើតការងាររាល់ស៊ុមដោយមិនចាំបាច់`);
    process.exit(1);
}
console.log('\n✅ គ្មាន animation ណាបង្កើត layout រាល់ស៊ុម ហើយការគូរឡើងវិញទាំងអស់មាន layer ផ្ទាល់ខ្លួន');
