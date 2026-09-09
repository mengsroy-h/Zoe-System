// ⛔ អ្នកយាមរបស់ `registry-orphan-list.js` — ឧបករណ៍ដែលបញ្ចេញ **payload លុប**
// សម្រាប់ `zoew_barcode_registry`។
//
// ហេតុអ្វីវាត្រូវមានអ្នកយាម ៖ កូនសោ registry ជា **ជាន់ការពារទី ៤** និងជា
// ជាន់ **ខាង server តែមួយគត់** ប្រឆាំង barcode ស្ទួន (ជាន់ ១–៣ អានសតិរបស់
// ទូរស័ព្ទនោះ)។ បើឧបករណ៍ដាក់កូនសោ **ដែលមានម្ចាស់** ចូលបញ្ជីលុប ➜ មនុស្ស
// paste ចូល `curl` ➜ barcode នោះស្កេនចូលបានម្តងទៀត ➜ **លុយបូកស្ទួន**
// ហើយ **គ្មានផ្លូវសាង registry ឡើងវិញក្នុងកូដទេ**។
//
// ⛔ តេស្តនេះរត់ **ឧបករណ៍ពិត** ជា process ដាច់ដោយឡែក លើ dump ក្លែង រួច
// **អានឯកសារលទ្ធផលពិត** — មិនមែនអះអាងលើកូដទេ។
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { execFileSync } = require('child_process');

const ROOT = process.env.REGORPHANTEST_APP_DIR ? path.resolve(process.env.REGORPHANTEST_APP_DIR) : path.join(__dirname, '..');
const TOOL = path.join(ROOT, 'audit-tools', 'registry-orphan-list.js');

let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { console.log('  ok    ' + label); pass++; }
    else { console.log('  FAIL  ' + label + (detail !== undefined ? '\n        ' + String(detail).slice(0, 400) : '')); fail++; }
}

if (!fs.existsSync(TOOL)) {
    console.log('  FAIL  រកមិនឃើញ ' + TOOL);
    console.log('\n❌ ធ្លាក់ 1');
    process.exit(1);
}

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'regorph-'));
function writeDump(name, obj, gz) {
    const file = path.join(TMP, name);
    const text = JSON.stringify(obj);
    if (gz) fs.writeFileSync(file, zlib.gzipSync(Buffer.from(text, 'utf8')));
    else fs.writeFileSync(file, text, 'utf8');
    return file;
}
// រត់ឧបករណ៍ពិត ➜ { code, out, payload }
function run(dumpFile, outFile) {
    const args = [TOOL, dumpFile];
    if (outFile) args.push(outFile);
    let out = '', code = 0;
    try { out = execFileSync(process.execPath, args, { encoding: 'utf8', env: process.env }); }
    catch (e) { code = e.status === undefined ? 1 : e.status; out = String(e.stdout || '') + String(e.stderr || ''); }
    let payload = null;
    if (outFile && fs.existsSync(outFile)) payload = JSON.parse(fs.readFileSync(outFile, 'utf8'));
    return { code, out, payload };
}

// ── សេណារីយ៉ូ ១ ៖ dump ធម្មតា ➜ លុបតែកូនសោកំព្រា ─────────────────────────
console.log('\n=== ១. dump ធម្មតា ៖ ម្ចាស់មិនត្រូវចូលបញ្ជីលុប ===');
{
    const dump = writeDump('normal.json', {
        zoew_scan_history_cod_dod: {
            i1: { id: 'i1', barcodes: [{ code: 'OWN0000001' }, { code: 'OWN0000002' }] },
            i2: { id: 'i2', barcode: 'OWN0000003' }
        },
        zoew_recently_deleted_cod_dod: {
            t1: { id: 't1', trashReason: 'remove', barcodes: [{ code: 'OWN0000004', isDeducted: true }] }
        },
        zoew_barcode_registry: {
            OWN0000001: true, OWN0000002: true, OWN0000003: true, OWN0000004: true,
            ORPHAN0001: true, ORPHAN0002: true
        }
    });
    const outFile = path.join(TMP, 'out1.json');
    const r = run(dump, outFile);
    ok('ចេញ exit 0', r.code === 0, r.out);
    ok('បញ្ចេញឯកសារ payload', !!r.payload, r.out);
    const keys = r.payload ? Object.keys(r.payload) : [];
    ok('លុបតែ ២ កូនសោកំព្រា', keys.length === 2, keys);
    ok('⛔ កូនសោកំព្រាទាំង ២ មានក្នុងបញ្ជី',
        keys.indexOf('ORPHAN0001') !== -1 && keys.indexOf('ORPHAN0002') !== -1, keys);
    // ⛔ នេះជាការអះអាងសំខាន់បំផុតនៃឯកសារនេះ
    ['OWN0000001', 'OWN0000002', 'OWN0000003', 'OWN0000004'].forEach((owned) => {
        ok('⛔ ម្ចាស់ ' + owned + ' មិនត្រូវចូលបញ្ជីលុប', keys.indexOf(owned) === -1, keys);
    });
    ok('⛔ តម្លៃត្រូវជា null (semantics លុបរបស់ PATCH)',
        keys.length > 0 && keys.every((k) => r.payload[k] === null), r.payload);
    ok('⛔ អេក្រង់មិនបោះពុម្ព barcode ណាមួយ (ច្បាប់ឯកជនភាព)',
        r.out.indexOf('ORPHAN0001') === -1 && r.out.indexOf('OWN0000001') === -1, r.out.slice(0, 200));
}

// ── សេណារីយ៉ូ ២ ៖ ម្ចាស់ក្នុង *ធុងសំរាម* តែម្យ៉ាង ក៏ជាម្ចាស់ដែរ ──────────
// ⛔ ថ្នាក់ពិត ៖ អ្នកប្រើលុបចេញពីប្រវត្តិ តែធាតុនៅក្នុងធុងសំរាម ➜ barcode
// នោះនៅមានម្ចាស់ ហើយ **អាចស្តារបាន** ➜ លុបកូនសោ = បំផ្លាញការការពារ
console.log('\n=== ២. ម្ចាស់ក្នុងធុងសំរាមតែម្យ៉ាង ➜ មិនមែនកំព្រា ===');
{
    const dump = writeDump('trashonly.json', {
        zoew_scan_history_cod_dod: { i1: { id: 'i1', barcodes: [{ code: 'LIVE000001' }] } },
        zoew_recently_deleted_cod_dod: { t1: { id: 't1', barcodes: [{ code: 'INTRASH001' }] } },
        zoew_barcode_registry: { LIVE000001: true, INTRASH001: true, ORPHANX: true }
    });
    const outFile = path.join(TMP, 'out2.json');
    const r = run(dump, outFile);
    const keys = r.payload ? Object.keys(r.payload) : [];
    ok('⛔ barcode ក្នុងធុងសំរាម មិនត្រូវចាត់ជាកំព្រា',
        keys.indexOf('INTRASH001') === -1, keys);
    ok('កូនសោកំព្រាពិតនៅតែចាប់បាន', keys.length === 1 && keys[0] === 'ORPHANX', keys);
}

// ── សេណារីយ៉ូ ៣ ៖ រូបរាងឆៅ (barcodes ជា object · អក្សរតូច) ───────────────
console.log('\n=== ៣. រូបរាងឆៅពី Firebase ៖ barcodes ជា object · អក្សរតូច ===');
{
    const dump = writeDump('rawshape.json.gz', {
        zoew_scan_history_cod_dod: { i1: { id: 'i1', barcodes: { 0: { code: 'lower001' }, 1: { code: 'AB%2F12' } } } },
        zoew_recently_deleted_cod_dod: {},
        zoew_barcode_registry: { LOWER001: true, 'AB%2F12': true, DEADKEY: true }
    }, true);
    const outFile = path.join(TMP, 'out3.json');
    const r = run(dump, outFile);
    const keys = r.payload ? Object.keys(r.payload) : [];
    ok('អាន .gz បាន', r.code === 0, r.out);
    ok('⛔ barcodes ជា object ➜ ម្ចាស់នៅតែស្គាល់', keys.indexOf('LOWER001') === -1, keys);
    ok('⛔ អក្សរតូច ➜ អក្សរធំ ត្រូវផ្គូផ្គងបាន (រូបមន្តកូនសោពិត)',
        keys.indexOf('LOWER001') === -1, keys);
    ok('⛔ កូនសោដែលមានសញ្ញាដែល encode រួច មិនត្រូវចាត់ជាកំព្រា',
        keys.indexOf('AB%2F12') === -1, keys);
    ok('កូនសោកំព្រាពិតនៅតែចាប់បាន', keys.length === 1 && keys[0] === 'DEADKEY', keys);
}

// ── សេណារីយ៉ូ ៣ខ ៖ កូនសោ registry ដែលមិនមែនទម្រង់ស្តង់ដារ ────────────────
// ⛔ `claimBarcodeInRegistry()` សរសេរតែទម្រង់ស្តង់ដារ តែកូនសោចាស់ ឬកូនសោ
// ដែលកែដោយដៃក្នុង Console អាចជាអក្សរតូច។ បើឧបករណ៍ **មិន normalize កូនសោ
// ក្នុង dump** មុនប្រៀបធៀប ➜ កូនសោដែល **មានម្ចាស់** ចូលបញ្ជីលុប ➜ លុយស្ទួន។
console.log('\n=== ៣ខ. កូនសោ registry មិនមែនទម្រង់ស្តង់ដារ ➜ នៅតែស្គាល់ម្ចាស់ ===');
{
    const dump = writeDump('legacykey.json', {
        zoew_scan_history_cod_dod: { i1: { id: 'i1', barcodes: [{ code: 'legacy001' }] } },
        zoew_recently_deleted_cod_dod: {},
        zoew_barcode_registry: { legacy001: true, DEADKEY2: true }
    });
    const outFile = path.join(TMP, 'out3b.json');
    const r = run(dump, outFile);
    const keys = r.payload ? Object.keys(r.payload) : [];
    ok('⛔ កូនសោអក្សរតូចដែលមានម្ចាស់ មិនត្រូវចូលបញ្ជីលុប',
        keys.indexOf('legacy001') === -1, keys);
    ok('កូនសោកំព្រាពិតនៅតែចាប់បាន', keys.length === 1 && keys[0] === 'DEADKEY2', keys);
}

// ── សេណារីយ៉ូ ៤ ៖ ច្រកទ្វារសុវត្ថិភាព ៣ ត្រូវ **បដិសេធ** ─────────────────
console.log('\n=== ៤. ច្រកទ្វារសុវត្ថិភាព ៖ ការបដិសេធជាលទ្ធផលត្រឹមត្រូវ ===');
{
    const noReg = writeDump('noreg.json', {
        zoew_scan_history_cod_dod: { i1: { id: 'i1', barcodes: [{ code: 'A1' }] } }
    });
    const r1 = run(noReg, path.join(TMP, 'o4a.json'));
    ok('⛔ គ្មាន node registry ➜ បដិសេធ (exit != 0)', r1.code !== 0, r1.code);
    ok('⛔ គ្មាន node registry ➜ មិនបញ្ចេញឯកសារ', r1.payload === null);

    const nodeOnly = writeDump('nodeonly.json', { zoew_barcode_registry: { A: true, B: true } });
    const r2 = run(nodeOnly, path.join(TMP, 'o4b.json'));
    ok('⛔ dump គ្មានប្រវត្តិ និងធុងសំរាម ➜ បដិសេធ', r2.code !== 0, r2.code);
    ok('⛔ dump មិនពេញ ➜ មិនបញ្ចេញឯកសារ (បើអត់ ➜ លុប registry ទាំងមូល)',
        r2.payload === null);
    // ⛔ ច្រកទ្វារ ២ និង ៣ បដិសេធដូចគ្នា តែ **ការណែនាំខុសគ្នា** ៖ dump មិនពេញ
    //   ត្រូវប្រាប់ឲ្យ Export ទាំងមូល មិនមែនប្រាប់ថាទម្រង់កូនសោមិនត្រូវគ្នាទេ
    ok('⛔ dump មិនពេញ ➜ សារត្រូវប្រាប់ឲ្យ Export ទាំងមូល (មិនមែនសារទម្រង់កូនសោ)',
        /Export the WHOLE database/.test(r2.out) && !/KEY-FORMAT MISMATCH/.test(r2.out),
        r2.out.slice(-260));

    const allOrphan = writeDump('allorphan.json', {
        zoew_scan_history_cod_dod: { i1: { id: 'i1', barcodes: [{ code: 'ZZZ1' }] } },
        zoew_recently_deleted_cod_dod: {},
        zoew_barcode_registry: { QQQ1: true, QQQ2: true }
    });
    const r3 = run(allOrphan, path.join(TMP, 'o4c.json'));
    ok('⛔ កំព្រា ១០០% ➜ បដិសេធ (ស្នាមនៃទម្រង់កូនសោមិនត្រូវគ្នា)', r3.code !== 0, r3.code);
    ok('⛔ កំព្រា ១០០% ➜ មិនបញ្ចេញឯកសារ', r3.payload === null);
}

// ── សេណារីយ៉ូ ៤ខ ៖ dump ដែល `redact-dump.js` សម្អាតរួច ────────────────────
// 🔴 អ្នកប្រើរាយការណ៍ពិត (2026-09-09) ៖ រត់លើ dump សម្អាតរួច ➜ ទទួលបាន hash
// ៤១៥។ ការសម្អាតរក្សា **ទំនាក់ទំនងម្ចាស់** (namespace តែមួយ · ការកែ b6cc107)
// ➜ ច្រកទ្វារ «កំព្រា ១០០%» **មិនបាញ់** ➜ ឧបករណ៍បញ្ចេញ payload ឥតប្រយោជន៍
// (កូនសោពិតជាអក្សរធំជានិច្ច ➜ hash អក្សរតូចមិនអាចមានក្នុង registry ពិត)។
console.log('\n=== ៤ខ. dump ដែលសម្អាតរួច ➜ ត្រូវបដិសេធ ===');
{
    // ⛔ បច្ច័យត្រូវអានចេញពី redact-dump.js ពិត — កុំចាក់ literal ក្នុងតេស្ត
    let prefix = 'id_';
    try {
        const rd = fs.readFileSync(path.join(ROOT, 'audit-tools', 'redact-dump.js'), 'utf8');
        const m = /const\s+r\s*=\s*'([A-Za-z0-9_]{1,12})'\s*\+\s*d\s*;/.exec(rd);
        if (m) prefix = m[1];
    } catch (e) {}
    const hashKey = (n) => prefix + ('0123abcd' .slice(0, 4) + String(n).padStart(4, '0'));
    const registry = {};
    for (let i = 0; i < 20; i++) registry[hashKey(i)] = true;
    registry[prefix + 'deadbeef'] = true;
    const dump = writeDump('redacted.json', {
        // ⛔ ម្ចាស់ ១ ត្រូវផ្គូផ្គង ➜ កំព្រា **មិនមែន ១០០%** ➜ ច្រកទ្វារ ៣ មិនបាញ់
        zoew_scan_history_cod_dod: { i1: { id: 'i1', barcodes: [{ code: prefix + 'deadbeef' }] } },
        zoew_recently_deleted_cod_dod: {},
        zoew_barcode_registry: registry
    });
    const outFile = path.join(TMP, 'out4b.json');
    const r = run(dump, outFile);
    ok('⛔ dump សម្អាតរួច ➜ បដិសេធ (exit != 0)', r.code !== 0, r.code);
    ok('⛔ dump សម្អាតរួច ➜ **មិនបញ្ចេញឯកសារ**', r.payload === null, r.payload);
    ok('⛔ សារត្រូវប្រាប់ថាជា dump សម្អាតរួច (មិនមែនសារកំព្រា ១០០%)',
        /REDACTED/.test(r.out) && !/KEY-FORMAT MISMATCH/.test(r.out), r.out.slice(-300));
    ok('⛔ ជាន់អប្បបរមា ៖ ករណីនេះកំព្រា **មិនមែន ១០០%** (ច្រកទ្វារ ៣ មិនបាញ់)',
        /orphan keys   : 20\b/.test(r.out) || /orphan keys/.test(r.out), r.out.slice(0, 400));
}

// ── សេណារីយ៉ូ ៤គ ៖ ⛔ ទិសផ្ទុយ — barcode ពិតដែល *មើលទៅដូច* hash ─────────
// ⛔ `barcodeRegistryKey()` ធ្វើ `.toUpperCase()` ជានិច្ច ➜ កូនសោពិត
// **មិនអាចមានបច្ច័យអក្សរតូច** បានឡើយ។ ដូច្នេះការរាវរក «សម្អាតរួច» ត្រូវ
// ចាក់លើ **បច្ច័យអក្សរតូច** ប៉ុណ្ណោះ។ បើនរណាម្នាក់ធ្វើឲ្យវាមិនប្រកាន់
// អក្សរតូចធំ ➜ អ្នកប្រើដែលស្កេន barcode ឈ្មោះបែបនោះ **លែងអាចសម្អាត
// registry បានជារៀងរហូត** (ការបដិសេធក្លែងក្លាយ)។
console.log('\n=== ៤គ. ⛔ ទិសផ្ទុយ ៖ barcode ពិតដែលមើលទៅដូច hash ➜ មិនត្រូវបដិសេធ ===');
{
    let prefix = 'id_';
    try {
        const rd = fs.readFileSync(path.join(ROOT, 'audit-tools', 'redact-dump.js'), 'utf8');
        const m = /const\s+r\s*=\s*'([A-Za-z0-9_]{1,12})'\s*\+\s*d\s*;/.exec(rd);
        if (m) prefix = m[1];
    } catch (e) {}
    const upper = prefix.toUpperCase();          // កូនសោពិតតែងតែជាអក្សរធំ
    const dump = writeDump('lookalike.json', {
        zoew_scan_history_cod_dod: { i1: { id: 'i1', barcodes: [{ code: upper + 'ABCDEF' }] } },
        zoew_recently_deleted_cod_dod: {},
        zoew_barcode_registry: { [upper + 'ABCDEF']: true, [upper + 'DEADBEEF']: true }
    });
    const outFile = path.join(TMP, 'out4c.json');
    const r = run(dump, outFile);
    ok('⛔ កូនសោពិត (អក្សរធំ) មិនត្រូវរាយជា «សម្អាតរួច»',
        !/REDACTED/.test(r.out), r.out.slice(-260));
    ok('⛔ វានៅតែបញ្ចេញ payload ធម្មតា', !!r.payload, r.out.slice(-260));
    const keys = r.payload ? Object.keys(r.payload) : [];
    ok('កូនសោកំព្រាពិតនៅតែចាប់បាន', keys.length === 1 && keys[0] === upper + 'DEADBEEF', keys);
}

// ── សេណារីយ៉ូ ៥ ៖ ⛔ ទិសផ្ទុយ — គ្មានកំព្រា ➜ មិនត្រូវបញ្ចេញឯកសារ ────────
console.log('\n=== ៥. ⛔ ទិសផ្ទុយ ៖ registry ស្អាត ➜ គ្មានអ្វីត្រូវលុប ===');
{
    const clean = writeDump('clean.json', {
        zoew_scan_history_cod_dod: { i1: { id: 'i1', barcodes: [{ code: 'A1' }, { code: 'A2' }] } },
        zoew_recently_deleted_cod_dod: {},
        zoew_barcode_registry: { A1: true, A2: true }
    });
    const outFile = path.join(TMP, 'out5.json');
    const r = run(clean, outFile);
    ok('registry ស្អាត ➜ exit 0', r.code === 0, r.out);
    ok('⛔ registry ស្អាត ➜ **មិនបញ្ចេញឯកសារលុប**', r.payload === null, r.payload);
}

// ── សេណារីយ៉ូ ៦ ៖ ការបំបែកជាកញ្ចប់ (សំណើធំពេក) ──────────────────────────
console.log('\n=== ៦. ការបំបែកជាកញ្ចប់ ៖ កូនសោច្រើន ➜ ឯកសារច្រើន ===');
{
    const registry = { OWNEDBIG: true };
    for (let i = 0; i < 5200; i++) registry['ORPH' + String(i).padStart(5, '0')] = true;
    const dump = writeDump('big.json', {
        zoew_scan_history_cod_dod: { i1: { id: 'i1', barcodes: [{ code: 'OWNEDBIG' }] } },
        zoew_recently_deleted_cod_dod: {},
        zoew_barcode_registry: registry
    });
    const outFile = path.join(TMP, 'out6.json');
    const r = run(dump, outFile);
    ok('ចេញ exit 0 លើទិន្នន័យធំ', r.code === 0, r.out.slice(0, 200));
    const parts = fs.readdirSync(TMP).filter((f) => /^out6\.\d+\.json$/.test(f)).sort();
    ok('⛔ បំបែកជាឯកសារ ២ (ពិដាន 5000 ក្នុងមួយសំណើ)', parts.length === 2, parts);
    let total = 0;
    let ownedLeaked = false;
    parts.forEach((f) => {
        const obj = JSON.parse(fs.readFileSync(path.join(TMP, f), 'utf8'));
        total += Object.keys(obj).length;
        if (Object.prototype.hasOwnProperty.call(obj, 'OWNEDBIG')) ownedLeaked = true;
    });
    ok('កូនសោកំព្រាទាំង 5200 មានគ្រប់ក្នុងឯកសារទាំង ២', total === 5200, total);
    ok('⛔ ម្ចាស់មិនលេចក្នុងកញ្ចប់ណាមួយ', !ownedLeaked);
}

try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}

console.log('');
if (fail) { console.log('❌ ធ្លាក់ ' + fail + ' / ok ' + pass); process.exit(1); }
console.log('✅ ជោគជ័យ ' + pass);
