import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

// ⛔ NOTICE ត្រូវស៊ីនឹង bundle ពិត ៖ build ZoeW ជាមួយ sourcemap ចូលថតបណ្តោះអាសន្ន ➜ រាយកញ្ចប់ npm ដែលពិតជាចូល dist/assets ➜
//    កញ្ចប់នីមួយៗត្រូវមាន `ឈ្មោះ@កំណែ` (កំណែដែលដំឡើងពិត) ក្នុង NOTICE ➜ កញ្ចប់ថ្មី ឬការឡើងកំណែ ដែលភ្លេចកែ NOTICE ➜ ក្រហម។

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NOTICE = process.env.NOTICE_FILE ? path.resolve(process.env.NOTICE_FILE) : path.resolve(APP, '..', 'NOTICE');
const MIN_PACKAGES = 10;
const VENDOR = [
    { name: 'xlsx', file: 'public/vendor/xlsx.full.min.js', re: /function make_xlsx_lib\(\w+\)\{\w+\.version="(\d+\.\d+\.\d+)"/ },
    { name: 'zxing-wasm', file: 'public/vendor/zxing-wasm.js', re: /var \w+=`(\d+\.\d+\.\d+)`,\w+=`[0-9a-f]{40}`/ }
];

function packageOf(source) {
    const at = source.lastIndexOf('node_modules/');
    if (at === -1) return '';
    const parts = source.slice(at + 'node_modules/'.length).split('/');
    return parts[0].startsWith('@') ? parts[0] + '/' + parts[1] : parts[0];
}

const out = mkdtempSync(path.join(tmpdir(), 'zoew-notice-'));
let failed = 0;
try {
    await build({ root: APP, logLevel: 'silent', build: { outDir: out, emptyOutDir: true, sourcemap: true } });
    const assets = path.join(out, 'assets');
    const packages = new Set();
    let maps = 0;
    for (const file of readdirSync(assets).filter((f) => f.endsWith('.js.map'))) {
        maps++;
        const map = JSON.parse(readFileSync(path.join(assets, file), 'utf8'));
        for (const source of map.sources || []) {
            const name = packageOf(source);
            if (name) packages.add(name);
        }
    }
    const notice = readFileSync(NOTICE, 'utf8');
    const listed = new Map();
    for (const m of notice.matchAll(/`((?:@[a-z0-9._-]+\/)?[a-z0-9._-]+)@(\d+\.\d+\.\d+[^`\s]*)`/g)) listed.set(m[1], m[2]);
    const problems = [];
    for (const name of Array.from(packages).sort()) {
        const version = JSON.parse(readFileSync(path.join(APP, 'node_modules', name, 'package.json'), 'utf8')).version;
        if (!listed.has(name)) problems.push(name + '@' + version + ' ៖ ship ក្នុង dist/assets តែគ្មានក្នុង NOTICE');
        else if (listed.get(name) !== version) problems.push(name + ' ៖ NOTICE សរសេរ ' + listed.get(name) + ' ≠ កំណែដែល ship ' + version);
    }
    for (const vendor of VENDOR) {
        const m = vendor.re.exec(readFileSync(path.join(APP, vendor.file), 'utf8'));
        if (!m) { problems.push(vendor.file + ' ៖ រកកំណែក្នុងឯកសារ vendor មិនឃើញ (វាស់មិនបាន)'); continue; }
        if (!listed.has(vendor.name)) problems.push(vendor.name + '@' + m[1] + ' ៖ ship (' + vendor.file + ') តែគ្មានក្នុង NOTICE');
        else if (listed.get(vendor.name) !== m[1]) problems.push(vendor.name + ' ៖ NOTICE សរសេរ ' + listed.get(vendor.name) + ' ≠ កំណែដែល ship ' + m[1]);
    }
    if (maps === 0 || packages.size < MIN_PACKAGES) {
        failed++;
        console.log('  FAIL  ជាន់អប្បបរមា ៖ sourcemap ' + maps + ' · កញ្ចប់ ' + packages.size + ' (< ' + MIN_PACKAGES + ') ➜ ការវាស់មិនឈានដល់ bundle');
    } else {
        console.log('  ok    ជាន់អប្បបរមា ៖ កញ្ចប់ npm ក្នុង bundle ' + packages.size + ' (sourcemap ' + maps + ')');
    }
    if (problems.length) {
        failed++;
        console.log('  FAIL  NOTICE មិនស៊ីនឹង bundle ៖\n        - ' + problems.join('\n        - '));
    } else {
        console.log('  ok    គ្រប់កញ្ចប់ npm និងឯកសារ vendor ដែល ship មាន `ឈ្មោះ@កំណែ` ត្រឹមត្រូវក្នុង NOTICE (' + (packages.size + VENDOR.length) + ')');
    }
} finally {
    rmSync(out, { recursive: true, force: true });
}
console.log(failed ? '\n❌ notice:check បរាជ័យ ' + failed : '\n✅ notice:check ជោគជ័យ');
process.exit(failed ? 1 : 0);
