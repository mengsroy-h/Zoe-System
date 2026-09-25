/**
 * ⛔ **ឯកសារដែលចាស់ គឺជាឯកសារខុស** (ច្បាប់ ៩ របស់ `CLAUDE.md`)។
 *
 * អ្វីដែលឧបករណ៍នេះវាស់ ៖ ការអះអាងក្នុងឯកសារដែល **ដេរីវេបាន** ត្រូវស្មើ
 * នឹងកូដពិត។ បញ្ជីរឹងក្នុងឯកសារគឺជា **កាលបរិច្ឆេទផុតកំណត់** ៖ slot ថ្មី
 * ជុំក្រោយនឹងរអិលកាត់ស្ងាត់ៗ។
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const fails = [];
const oks = [];

/* ── ១. បញ្ជី slot ក្នុង ARCHITECTURE.md ត្រូវស្មើនឹង scripts/slot-registry.cjs ── */
const REGISTRY = createRequire(import.meta.url)(path.join(ROOT, 'scripts/slot-registry.cjs'));
function slotMap(name) {
    if (!REGISTRY[name]) throw new Error(`រក ${name} មិនឃើញ`);
    return Object.entries(REGISTRY[name]).map(([id, e]) => [id, e.component]);
}
const slots = slotMap('SLOTS');
const elementSlots = slotMap('ELEMENT_SLOTS');
const arch = read('docs/ARCHITECTURE.md');

for (const [id, comp] of slots) {
    const row = `| \`${id}\` | \`${comp}\` | slot |`;
    if (arch.includes(row)) continue;
    fails.push(`ARCHITECTURE.md ខ្វះជួរ slot ៖ ${id} ➜ ${comp}`);
}
for (const [id, comp] of elementSlots) {
    const row = `| \`${id}\` | \`${comp}\` | element slot |`;
    if (arch.includes(row)) continue;
    fails.push(`ARCHITECTURE.md ខ្វះជួរ element slot ៖ ${id} ➜ ${comp}`);
}
// ⛔ ទិសផ្ទុយ ៖ ជួរក្នុងឯកសារដែល **លែងមាន** ក្នុងកូដ ក៏ខុសដែរ
for (const m of arch.matchAll(/^\| `(\w+)` \| `(\w+)` \| (element slot|slot) \|$/gm)) {
    const [, id, comp, kind] = m;
    const list = kind === 'slot' ? slots : elementSlots;
    if (list.some(([i, c]) => i === id && c === comp)) continue;
    fails.push(`ARCHITECTURE.md រាយ slot ដែលលែងមាន ៖ ${id} ➜ ${comp}`);
}
const headed = arch.match(/### បញ្ជីពេញលេញ \((\d+) slot · (\d+) element slot\)/);
if (!headed) fails.push('ARCHITECTURE.md ខ្វះក្បាលបញ្ជី slot');
else if (Number(headed[1]) !== slots.length || Number(headed[2]) !== elementSlots.length) {
    fails.push(`ចំនួន slot ក្នុងក្បាល (${headed[1]}/${headed[2]}) ខុសពីកូដ (${slots.length}/${elementSlots.length})`);
} else oks.push(`បញ្ជី slot ៖ ${slots.length} + ${elementSlots.length} ដូចកូដ`);

/* ── ២. កំណែក្នុង README ត្រូវស្មើនឹង APP_VERSION ពិត ── */
const version = (read('src/core/version.ts').match(/APP_VERSION\s*=\s*['"]([\d.]+)['"]/) || [])[1];
const pkgVersion = JSON.parse(read('package.json')).version;
if (!version) fails.push('រក APP_VERSION មិនឃើញ');
else {
    if (pkgVersion !== version) fails.push(`package.json (${pkgVersion}) ខុសពី APP_VERSION (${version})`);
    else oks.push(`កំណែ ${version} ៖ package.json ដូច APP_VERSION`);
    if (!read('README.md').includes(version)) fails.push(`README.md មិនរាយកំណែ ${version}`);
    else oks.push(`README.md រាយកំណែ ${version}`);
}

/* ── ៣. ឧបករណ៍ក្នុង package.json ត្រូវមានឈ្មោះក្នុង docs/DEVELOPMENT.md ──
 *    (README ជាឯកសារ «របៀបប្រើ» តាមច្បាប់ ៩ ➜ ពាក្យបញ្ជាអ្នកអភិវឌ្ឍរស់នៅ docs/) */
const scripts = Object.keys(JSON.parse(read('package.json')).scripts);
const devDoc = read('docs/DEVELOPMENT.md');
const missingScripts = scripts.filter((s) => !devDoc.includes('npm run ' + s) && s !== 'dev' && s !== 'test');
if (missingScripts.length) fails.push('docs/DEVELOPMENT.md ខ្វះពាក្យបញ្ជា ៖ ' + missingScripts.join(' · '));
else oks.push(`ពាក្យបញ្ជា ${scripts.length} មានឈ្មោះក្នុង docs/DEVELOPMENT.md`);

/* ── ៣ខ. README ត្រូវរាយកំណែជា «កំណែបច្ចុប្បន្ន» (ទម្រង់ដែល doc-scope-test អាន) ── */
const claimed = (read('README.md').match(/កំណែបច្ចុប្បន្ន[^0-9]*`([0-9]+\.[0-9]+\.[0-9]+)`/) || [])[1];
if (claimed !== version) fails.push(`README.md «កំណែបច្ចុប្បន្ន» (${claimed}) ខុសពី APP_VERSION (${version})`);
else oks.push(`README.md «កំណែបច្ចុប្បន្ន» ${claimed}`);

/* ── ៤. គ្មានឯកសារណាក្រៅ docs/ រាយប្រវត្តិកំហុសចងនឹងកំណែ ── */
const mdFiles = fs.readdirSync(path.join(ROOT, 'docs')).map((f) => 'docs/' + f).concat(['README.md']);
for (const f of mdFiles) {
    if (f.startsWith('docs/')) continue;
    const hit = read(f).match(/កំណែ \d+\.\d+\.\d+ (កែ|ដក|បន្ថែម)/);
    if (hit) fails.push(`${f} មានកំណត់ត្រាតាមកំណែ ៖ «${hit[0]}» ➜ វាទៅ docs/`);
}
oks.push('គ្មានកំណត់ត្រាតាមកំណែក្រៅ docs/');

console.log('╔══════════════════════════════════════════════════════════════════════╗');
console.log('║  ភាពស្រស់នៃឯកសារ ៖ ការអះអាងដែលដេរីវេបាន                             ║');
console.log('╚══════════════════════════════════════════════════════════════════════╝\n');
for (const o of oks) console.log('✅ ' + o);
for (const f of fails) console.log('❌ ' + f);
console.log('');
if (fails.length) { console.log(`❌ ${fails.length} ការអះអាងក្នុងឯកសារ ខុសពីកូដ`); process.exit(1); }
console.log('✅ ឯកសារស៊ីនឹងកូដ');
