'use strict';

process.exitCode = 1;
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { spawnSync } = require('child_process');
const ROOT = path.resolve(process.env.MONEYREALTEST_APP_DIR || path.join(__dirname, '..'));
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zoe-money-cli-test-'));
let pass = 0, fail = 0;

function ok(label, condition, detail) {
    if (condition) { pass++; console.log('   ok    ' + label); }
    else { fail++; console.log('   FAIL  ' + label + (detail === undefined ? '' : '  ➜ ' + JSON.stringify(detail))); }
}
function scenario(label, action) {
    try { action(); }
    catch (error) { ok(label, false, error.message); }
}
function run(script, args, env) {
    const result = spawnSync(process.execPath, [path.join(ROOT, 'audit-tools', script), ...args], {
        cwd: tempRoot, encoding: 'utf8', timeout: 10000, windowsHide: true,
        env: { ...process.env, MONEYREAL_APP_DIR: ROOT, ...env }
    });
    return { ...result, text: (result.stdout || '') + (result.stderr || '') };
}
function save(name, data) {
    const file = path.join(tempRoot, name);
    fs.writeFileSync(file, JSON.stringify(data));
    return file;
}
function report(file, name) {
    const reportPath = path.join(tempRoot, name);
    const result = run('money-reality-check.js', [file, '--report', reportPath]);
    const bytes = fs.existsSync(reportPath) ? fs.readFileSync(reportPath) : Buffer.alloc(0);
    return { ...result, bytes, body: bytes.toString('utf8') };
}
function measured(body) {
    return body.split(/\r?\n/).filter((line) => !line.startsWith('ឯកសារ ៖ ')).join('\n');
}

// ទិន្នន័យប្រឌិតទាំងអស់៖ រួមមានលុយបើក/បិទ/ធុងសំរាម និងអត្តសញ្ញាណភ្ជាប់ឆ្លង node។
const phone = '+855000000001';
const openCode = '86000000000001';
const closedCode = 'ZTOFIXTURE2';
const deletedCode = '86000000000003';
const secondCode = 'ZTOFIXTURE4';
const trashedCode = 'ZTOFIXTURE5';
const day = '2026-09-10';
const pickupDay = '2026-09-11';
// ត្រាបិទពិត ៖ `1789100000000` = 2026-09-11 11:13 ក្នុង `Asia/Phnom_Penh`
const closedStamp = 1789100000000;
const laterStamp = closedStamp + 20000000;
const earlierStamp = closedStamp - 20000000;
const fixture = {
    zoew_scan_history_cod_dod: {
        '-fixture-open-01': {
            id: 'fixture-open-01', phone, scanDate: day, cod: 10.25, dod: 0.75, price: 11, count: 1,
            locker: 'fixture-locker-A', customerName: 'Fixture Customer', address: 'Fixture Street',
            note: 'fixture-private-note', customSecret: 'fixture-unknown-secret',
            barcodes: [{ code: openCode, cod: 10.25, dod: 0.75, isClosed: false, isDeducted: false }]
        },
        '-fixture-closed-02': {
            id: 'fixture-closed-02', phone, scanDate: day, cod: 5.5, dod: 0.25, price: 5.75, count: 1,
            email: 'fixture@example.invalid', token: 'fixture-private-token',
            barcodes: [{ code: closedCode.toLowerCase(), cod: 5.5, dod: 0.25, isClosed: true, closedAt: closedStamp }]
        }
    },
    zoew_recently_deleted_cod_dod: {
        '-fixture-deleted-03': {
            id: 'fixture-deleted-03', phone, scanDate: day, cod: 2, dod: 0.5, price: 2.5, count: 1,
            isFromDeletion: true, trashReason: 'delete', restoreClaimToken: 'fixture-claim-token',
            barcodes: [{ code: deletedCode, cod: 2, dod: 0.5, isClosed: false, isDeducted: false }]
        }
    },
    zoew_daily_revenue_cod_dod: { [day]: { codDollar: 17.75, dodDollar: 1.5, totalCount: 3 } },
    zoew_monthly_revenue_cod_dod: { '2026-09': { codDollar: 17.75, dodDollar: 1.5, totalCount: 3 } },
    zoew_daily_pickup_cod_dod: {
        [pickupDay]: { packagesPickedUp: 1, pickedUpPhones: { [phone]: 1 }, pickedUpBarcodes: { [closedCode]: true } }
    },
    zoew_daily_collected_cod_dod: { [pickupDay]: { [closedCode]: { c: 5.5, d: 0.25 } } },
    zoew_barcode_registry: { [openCode]: true, [closedCode]: true, [deletedCode]: true }
};
// ⛔ ការវាស់ «កញ្ចក់ ↔ ប្រវត្តិ» ដេរីវេព្រំដែនរបស់វាពី **កូនសោដំបូងដែលមានពិត**
// ➜ fixture ដែលមាន barcode បិទ **តែមួយ** មិនអាចបញ្ជាក់ការធ្លាក់បានទេ (ដកកូនសោ
// នោះចេញ ➜ គ្មានយុថ្កា ➜ «ប្រៀបមិនបាន»)។ ដូច្នេះ mutation ទាំងអស់ឈរលើ barcode
// បិទ **ទី ២** ដែលស៊ីគ្នាគ្រប់ node — រួច mutation នីមួយៗបំបែកតែអ័ក្សមួយ។
function withSecondClose(data, stamp) {
    const at = stamp || laterStamp;
    data.zoew_scan_history_cod_dod['-fixture-closed-04'] = {
        id: 'fixture-closed-04', phone, scanDate: day, cod: 3, dod: 0, price: 3, count: 1,
        barcodes: [{ code: secondCode, cod: 3, dod: 0, isClosed: true, closedAt: at }]
    };
    data.zoew_daily_revenue_cod_dod[day].codDollar = 20.75;
    data.zoew_daily_revenue_cod_dod[day].totalCount = 4;
    data.zoew_monthly_revenue_cod_dod['2026-09'].codDollar = 20.75;
    data.zoew_monthly_revenue_cod_dod['2026-09'].totalCount = 4;
    data.zoew_daily_pickup_cod_dod[pickupDay] = {
        packagesPickedUp: 2, pickedUpPhones: { [phone]: 2 },
        pickedUpBarcodes: { [closedCode]: true, [secondCode]: true }
    };
    data.zoew_daily_collected_cod_dod[pickupDay][secondCode] = { c: 3, d: 0 };
    data.zoew_barcode_registry[secondCode] = true;
    // ⛔ barcode បិទដែលច្បាប់ ២ ម៉ោងផ្លាស់ចូល **ធុងសំរាម** ៖ កូនសោកញ្ចក់
    // របស់វា **នៅដដែល** («Delete/pickup មិនលុប collected») ➜ ការស្កេនតែ
    // `scanHistory` ធ្វើឲ្យវាក្លាយជាកូនសោ «គ្មានម្ចាស់» ដោយខុស។
    data.zoew_recently_deleted_cod_dod['-fixture-trashed-05'] = {
        id: 'fixture-trashed-05', phone, scanDate: day, cod: 1.5, dod: 0, price: 1.5, count: 1,
        isFromDeletion: true, trashReason: 'pickup', isClosed: true,
        barcodes: [{ code: trashedCode, cod: 1.5, dod: 0, isClosed: true, closedAt: closedStamp + 10000000 }]
    };
    data.zoew_daily_collected_cod_dod[pickupDay][trashedCode] = { c: 1.5, d: 0 };
    data.zoew_daily_pickup_cod_dod[pickupDay].packagesPickedUp = 3;
    data.zoew_daily_pickup_cod_dod[pickupDay].pickedUpPhones[phone] = 3;
    data.zoew_daily_pickup_cod_dod[pickupDay].pickedUpBarcodes[trashedCode] = true;
    data.zoew_barcode_registry[trashedCode] = true;
    return data;
}
function copy() { return JSON.parse(JSON.stringify(fixture)); }

const dump = save('fixture dump.json', fixture);
const gzip = path.join(tempRoot, 'fixture dump.json.gz');
fs.writeFileSync(gzip, zlib.gzipSync(fs.readFileSync(dump)));
const before = fs.readFileSync(dump);

try {
    scenario('របាយការណ៍លុយពិតលើ fixture', () => {
        const plain = report(dump, 'plain report.txt');
        const zipped = report(gzip, 'gzip report.txt');
        ok('JSON និង gzip រត់បានពេញដោយ exit 0', plain.status === 0 && zipped.status === 0, [plain.status, zipped.status]);
        ok('របាយការណ៍ខ្មែរមាន UTF-8 BOM សម្រាប់ Notepad', plain.bytes.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])));
        ok('--report ទុក console ជា ASCII', plain.text.length > 0 && /^[\x00-\x7f]+$/.test(plain.text));
        ok('លុយបិទ $5.75 + លុយបើក/ធុងសំរាម $13.50 = ledger $19.25',
            /សរុប ៖ ចំណូល\(យករួច\) \$5\.75 · មិនទាន់យក \$13\.50 · ledger ឆៅ \$19\.25/.test(plain.body));
        ok('របាយការណ៍វាស់ node ថ្ងៃយកដោយមានទឹកប្រាក់ពិត',
            plain.body.includes(pickupDay + ' ៖ 1 កញ្ចប់ · COD $5.50 · DOD $0.25 · សរុប $5.75'));
        ok('fixture មានលទ្ធផលពេញ គ្មានព្រមាន និងគ្មានបញ្ហា', /✅ \d+   ⚠️ 0   ❌ 0/.test(plain.body));
        ok('gzip និង JSON ផ្តល់ការវាស់ដូចគ្នា', measured(plain.body) === measured(zipped.body));
        ok('របាយការណ៍មិនបង្ហាញអត្តសញ្ញាណដើម',
            [phone, openCode, closedCode, deletedCode, 'Fixture Customer'].every((value) => !plain.body.includes(value)));
    });

    scenario('ការសម្អាត និងទំនាក់ទំនងមុន/ក្រោយ', () => {
        const out = path.join(tempRoot, 'redacted copy.json');
        const second = path.join(tempRoot, 'redacted second.json');
        const firstRun = run('redact-dump.js', [gzip, out]);
        const secondRun = run('redact-dump.js', [dump, second]);
        ok('redactor អាន gzip និង JSON បានដោយ exit 0', firstRun.status === 0 && secondRun.status === 0, [firstRun.status, secondRun.status]);
        const text = fs.readFileSync(out, 'utf8');
        const clean = JSON.parse(text);
        const secrets = [phone, openCode, closedCode, closedCode.toLowerCase(), deletedCode,
            'fixture-open-01', 'fixture-closed-02', 'fixture-deleted-03', 'fixture-locker-A',
            'Fixture Customer', 'Fixture Street', 'fixture-private-note', 'fixture-unknown-secret',
            'fixture@example.invalid', 'fixture-private-token', 'fixture-claim-token'];
        ok('អត្តសញ្ញាណ និងវាលសម្ងាត់ប្រឌិតទាំងអស់បាត់ពី output', secrets.every((value) => !text.includes(value)));
        ok('វាល locker/name/address/note/token ត្រូវបានដកពិត',
            !/"(?:locker|customerName|address|note|email|token|restoreClaimToken)":/.test(text));
        const rows = Object.values(clean.zoew_scan_history_cod_dod);
        const closed = rows.find((row) => row.barcodes[0].isClosed);
        const code = closed.barcodes[0].code;
        const cleanPhone = closed.phone;
        ok('លេខទូរស័ព្ទដដែលភ្ជាប់គ្នានៅ history និង pickup ដោយ hash',
            /^id_[0-9a-f]{8}$/.test(cleanPhone) && rows.every((row) => row.phone === cleanPhone)
            && clean.zoew_daily_pickup_cod_dod[pickupDay].pickedUpPhones[cleanPhone] === 1);
        ok('barcode តូច/ធំភ្ជាប់គ្នានៅ history/registry/pickup/collected',
            /^id_[0-9a-f]{8}$/.test(code) && clean.zoew_barcode_registry[code] === true
            && clean.zoew_daily_pickup_cod_dod[pickupDay].pickedUpBarcodes[code] === true
            && clean.zoew_daily_collected_cod_dod[pickupDay][code].c === 5.5);
        ok('salt ថ្មីធ្វើឲ្យការសម្អាតទិន្នន័យដដែលខុសគ្នារវាងការរត់', text !== fs.readFileSync(second, 'utf8'));
        const rawReport = report(dump, 'before.txt');
        const cleanReport = report(out, 'after.txt');
        ok('ការវាស់លុយពេញមុន/ក្រោយសម្អាតដូចគ្នាបេះបិទ',
            rawReport.status === 0 && cleanReport.status === 0 && measured(rawReport.body) === measured(cleanReport.body));
        const defaultRun = run('redact-dump.js', [dump]);
        ok('មិនដាក់ output path ➜ សាងឯកសារថ្មី -redacted.json',
            defaultRun.status === 0 && fs.existsSync(dump.replace(/\.json$/, '-redacted.json')));
    });

    const changes = [
        ['ledger ខែឃ្លាត ១ សេន', (data) => { data.zoew_monthly_revenue_cod_dod['2026-09'].codDollar += 0.01; }, 'គម្លាត ៖ COD $0.01'],
        ['លុយជួរដេកឃ្លាតពី barcode', (data) => { data.zoew_scan_history_cod_dod['-fixture-open-01'].price += 1; }, 'មិនស៊ីនឹងផលបូក barcodes'],
        ['counter ស្ថិតិយកមិនស្មើអត្តសញ្ញាណ', (data) => { data.zoew_daily_pickup_cod_dod[pickupDay].packagesPickedUp = 2; }, 'packagesPickedUp 2'],
        ['barcode ស្ទួនខុសអក្សរតូច/ធំ', (data) => {
            data.zoew_scan_history_cod_dod['-fixture-open-01'].barcodes[0].code = closedCode;
        }, '1 barcode ស្ទួនក្នុងប្រវត្តិ'],
        ['registry មានកូនសោកំព្រាពិត', (data) => { data.zoew_barcode_registry['ORPHAN-FIXTURE-4'] = true; }, '1/4 កូនសោ registry **កំព្រា**'],
        // ⛔ ៥ អ័ក្ស ❌ នៃ «កញ្ចក់ ↔ ប្រវត្តិ» ៖ កូនសោបាត់ · ថ្ងៃទាំងមូលបាត់ ·
        // រាប់ស្ទួន · ទឹកប្រាក់ខុស · កូនសោនៅសល់ក្រោយបើកវិញ។ ទាំង ៥ បង្ហាញលើកាត
        // «💵 ចំណូលប្រចាំថ្ងៃ» ខណៈ ledger និង `isDeducted` ត្រឹមត្រូវទាំងស្រុង។
        ['កញ្ចក់ខ្វះកូនសោ (App បិទកណ្តាលទី)', (data) => {
            delete withSecondClose(data).zoew_daily_collected_cod_dod[pickupDay][secondCode];
        }, '1 barcode បិទ គ្មានកូនសោ ខណៈថ្ងៃនោះ**មាន**ក្នុងកញ្ចក់ ➜ កាតខ្វះ $3.00'],
        ['ថ្ងៃទាំងមូលបាត់ពីកញ្ចក់', (data) => {
            // បិទនៅថ្ងៃបន្ទាប់ ➜ ថ្ងៃនោះគ្មាន node សោះ (ការសរសេរធ្លាក់ទាំងថ្ងៃ)
            withSecondClose(data, laterStamp + 86400000);
            delete data.zoew_daily_collected_cod_dod[pickupDay][secondCode];
        }, '1 barcode បិទ គ្មានកូនសោ ហើយ**ថ្ងៃនោះក៏គ្មាន**ក្នុងកញ្ចក់ ➜ កាតខ្វះ $3.00'],
        ['កូនសោតែមួយឈរលើ ២ ថ្ងៃ ➜ រាប់ស្ទួន', (data) => {
            const node = withSecondClose(data).zoew_daily_collected_cod_dod;
            node['2026-09-12'] = { [secondCode]: { c: 3, d: 0 } };
        }, '1 កូនសោឈរលើ ២ ថ្ងៃ ➜ **រាប់ស្ទួន** $3.00'],
        ['ទឹកប្រាក់ក្នុងកញ្ចក់ឃ្លាតពី barcode', (data) => {
            withSecondClose(data).zoew_daily_collected_cod_dod[pickupDay][secondCode] = { c: 2.5, d: 0 };
        }, '1 កូនសោមានទឹកប្រាក់ខុស ➜ គម្លាតសរុប $0.50'],
        ['កូនសោនៅសល់ក្រោយបើកវិញ', (data) => {
            withSecondClose(data).zoew_scan_history_cod_dod['-fixture-closed-04'].barcodes[0].isClosed = false;
        }, '1 កូនសោនៅសល់ ខណៈ barcode **មិនបិទ** ➜ កាតរាយលើស $3.00'],
        // ⛔ ជាន់អប្បបរមា ៖ ពេលយុថ្កាតែមួយត្រូវរាប់ស្ទួន គ្មាន barcode ណាចូល
        // វិសាលភាពទេ ➜ ការអះអាង «គ្មានបាត់» នឹងបៃតង **ដោយគ្មានការវាស់អ្វី** ➜
        // ឧបករណ៍ត្រូវប្រាប់ថាវាមិនបានវាស់ មិនមែនបោះពុម្ព ✅ ស្ងាត់ៗ។
        ['វិសាលភាពទទេ ➜ ត្រូវប្រាប់ថាមិនបានវាស់', (data) => {
            data.zoew_daily_collected_cod_dod['2026-09-12'] = { [closedCode]: { c: 5.5, d: 0.25 } };
        }, 'គ្មាន barcode បិទណាចូលវិសាលភាព — ការប្រៀបខាងប្រវត្តិ **មិនបានវាស់អ្វីទេ**']
    ];
    changes.forEach(([label, mutate, expected], index) => scenario(label, () => {
        const data = JSON.parse(JSON.stringify(fixture));
        mutate(data);
        const result = report(save('invalid-' + index + '.json', data), 'invalid-' + index + '.txt');
        ok(label + ' ➜ exit 1 និងរាយបញ្ហាត្រឹមត្រូវ', result.status === 1 && result.body.includes(expected), result.status);
    }));

    // ⛔ ទិសផ្ទុយ ៖ ការធ្លាក់ដែលកើតពី **សំណល់នៃការវាស់** អាក្រក់ជាងការមិនវាស់។
    // ៤ សេណារីយ៉ូនេះត្រូវ **នៅបៃតង** ៖ (១) កញ្ចក់ស៊ីគ្នាលើ barcode បិទ ២ ·
    // (២) កូនសោរកម្ចាស់មិនឃើញ = ⚠️ (purge ធុងសំរាមជាការពន្យល់ស្របច្បាប់) ·
    // (៣) កូនសោឈរខុសថ្ងៃ = ⚠️ (ការស្តារ reset `closedAt` ដោយមិនប៉ះកញ្ចក់) ·
    // (៤) barcode ដែលបិទ **មុនកញ្ចក់ចាប់ផ្តើម** ត្រូវរំលង មិនមែនរាយថាបាត់។
    scenario('កញ្ចក់ ↔ ប្រវត្តិ ៖ អ្វីដែលមិនត្រូវធ្លាក់', () => {
        const clean = report(save('mirror-clean.json', withSecondClose(copy())), 'mirror-clean.txt');
        ok('barcode បិទ ២ ដែលស៊ីគ្នា ➜ exit 0 និងសាលក្រម ១:១',
            clean.status === 0 && clean.body.includes('កញ្ចក់ស៊ីនឹងប្រវត្តិ ១:១ លើ barcode បិទ 3'), clean.status);
        ok('ការវាស់រាយវិសាលភាពពិត មិនមែនត្រឹមលទ្ធផល',
            /វិសាលភាព ៖ វាស់ 3 barcode បិទ \(តាំងពី 2026-09-11\)/.test(clean.body));
        // ⛔ barcode បិទក្នុងធុងសំរាម ត្រូវរាប់ជាម្ចាស់ ➜ គ្មានកូនសោ «គ្មានម្ចាស់»
        ok('កូនសោរបស់ barcode បិទក្នុងធុងសំរាម មានម្ចាស់',
            !clean.body.includes('រកម្ចាស់មិនឃើញ'));
        const ghostData = withSecondClose(copy());
        ghostData.zoew_daily_collected_cod_dod[pickupDay]['ZTOGHOST9'] = { c: 1.25, d: 0 };
        const ghost = report(save('mirror-ghost.json', ghostData), 'mirror-ghost.txt');
        ok('កូនសោរកម្ចាស់មិនឃើញ ➜ ⚠️ រក្សា exit 0 («មិនអាចផ្ទៀងផ្ទាត់ ≠ ខុស»)',
            ghost.status === 0 && ghost.body.includes('1 កូនសោក្នុងកញ្ចក់ រកម្ចាស់មិនឃើញ')
            && ghost.body.includes('ទឹកប្រាក់ $1.25'), ghost.status);
        const movedData = withSecondClose(copy());
        const movedNode = movedData.zoew_daily_collected_cod_dod;
        movedNode['2026-09-12'] = { [secondCode]: movedNode[pickupDay][secondCode] };
        delete movedNode[pickupDay][secondCode];
        const moved = report(save('mirror-moved.json', movedData), 'mirror-moved.txt');
        ok('កូនសោឈរលើថ្ងៃមិនមែនថ្ងៃ `closedAt` ➜ ⚠️ រក្សា exit 0 (ការស្តារផលិតរូបរាងដដែល)',
            moved.status === 0 && moved.body.includes('1 កូនសោឈរលើថ្ងៃមិនមែនថ្ងៃរបស់ `closedAt`')
            && moved.body.includes('ទឹកប្រាក់ $3.00'), moved.status);
        // ⛔ កូនសោកញ្ចក់ **ជា barcode** ➜ ផ្លូវកូដថ្មីនេះជា sink ថ្មីនៃអត្តសញ្ញាណ។
        // ត្រូវវាស់ទាំងផ្លូវបៃតង និងផ្លូវធ្លាក់ (សារធ្លាក់ជាកន្លែងដែលងាយបំពាន)។
        const leakData = withSecondClose(copy());
        delete leakData.zoew_daily_collected_cod_dod[pickupDay][secondCode];
        const leak = report(save('mirror-leak.json', leakData), 'mirror-leak.txt');
        ok('របាយការណ៍កញ្ចក់មិនបោះពុម្ព barcode ឬលេខទូរស័ព្ទ ទាំងបៃតង ទាំងធ្លាក់',
            leak.status === 1 && [phone, closedCode, secondCode, trashedCode]
                .every((value) => !leak.body.includes(value) && !clean.body.includes(value)));
        const earlyData = withSecondClose(copy(), earlierStamp);
        delete earlyData.zoew_daily_collected_cod_dod[pickupDay][secondCode];
        const early = report(save('mirror-early.json', earlyData), 'mirror-early.txt');
        ok('barcode បិទមុនកូនសោដំបូង ➜ រំលង មិនរាយថាបាត់',
            early.status === 0 && early.body.includes('រំលង 1 មុនកញ្ចក់ចាប់ផ្តើម'), early.status);
    });

    scenario('CLI បដិសេធ input ខុសដោយ exit code', () => {
        const invalid = path.join(tempRoot, 'invalid json.json');
        fs.writeFileSync(invalid, '{bad-json');
        const missing = path.join(tempRoot, 'missing.json');
        const emptyTree = path.join(tempRoot, 'empty-tree');
        fs.mkdirSync(emptyTree);
        const cases = [
            ['money គ្មានអាគុយម៉ង់', 'money-reality-check.js', [], 2],
            ['money គ្មាន dump', 'money-reality-check.js', [missing], 3],
            ['money JSON ខូច', 'money-reality-check.js', [invalid], 3],
            ['redactor គ្មានអាគុយម៉ង់', 'redact-dump.js', [], 2],
            ['redactor គ្មាន dump', 'redact-dump.js', [missing], 1],
            ['redactor JSON ខូច', 'redact-dump.js', [invalid], 1]
        ];
        cases.forEach(([label, script, args, status]) => {
            const result = run(script, args);
            ok(label + ' ➜ exit ' + status, result.status === status && result.text.length > 0, result.status);
        });
        const missingApp = run('money-reality-check.js', [dump], { MONEYREAL_APP_DIR: emptyTree });
        ok('money គ្មាន app.js ➜ exit 3 មិនមែនលុយខុស', missingApp.status === 3 && /app\.js not found/.test(missingApp.text));
    });

    scenario('Windows launcher មានកិច្ចសន្យាការហៅ CLI ពេញលេញ', () => {
        const source = fs.readFileSync(path.join(ROOT, 'tools', 'money-check-windows', 'check-money.cmd'), 'utf8');
        const moneyAt = source.indexOf('node "!REPO!\\audit-tools\\money-reality-check.js" "!DUMP!" --report "%REPORT%"');
        const redactAt = source.indexOf('node "!REPO!\\audit-tools\\redact-dump.js" "!DUMP!" "%SAFE%"');
        const announceAt = source.indexOf('echo SAFE TO SEND');
        const moneyGuard = source.slice(moneyAt, redactAt);
        const redactionGuard = source.slice(redactAt, announceAt);
        ok('cmd ដាក់ quote លើផ្លូវ dump/report និងហៅ money មុន redactor', moneyAt >= 0 && redactAt > moneyAt && announceAt > redactAt);
        ok('cmd ចាប់ exit លុយភ្លាម ហើយ exit >=2 បិទផ្លូវ redactor',
            /set "CODE=!ERRORLEVEL!"\s+if !CODE! GEQ 2 \(/.test(moneyGuard) && moneyGuard.includes('exit /b !CODE!'));
        ok('cmd លុប output ចាស់មុនសម្អាត ហើយពិនិត្យការលុបពិត',
            /if exist "%SAFE%" del \/q "%SAFE%"[^\r\n]*\r?\nif exist "%SAFE%" \([\s\S]*?exit \/b 3/.test(moneyGuard));
        ok('cmd ស្នើទាំង exit 0 និង output ថ្មីមុនប្រកាសសុវត្ថិភាព',
            /set "REDACT_CODE=!ERRORLEVEL!"\s+if not exist "%SAFE%" set "REDACT_CODE=1"/.test(redactionGuard)
            && /if not "!REDACT_CODE!"=="0" \([\s\S]*?exit \/b 3/.test(redactionGuard));
        ok('cmd រក្សា exit លុយពេលសម្អាតជោគជ័យ', /exit \/b !CODE!\s*$/.test(source));
    });

    if (process.platform === 'win32') scenario('Windows launcher រត់ cmd ពិត', () => {
        // ជំនួសតែ CLI dependency ដើម្បីបង្ខំ exit code នីមួយៗ។ Launcher រត់ដើម
        // ហើយរបាយការណ៍មិនត្រូវបានសាង ដូច្នេះមិនបើក Notepad ក្នុងតេស្ត។
        const launcherRoot = path.join(tempRoot, 'launcher project');
        const launcherDir = path.join(launcherRoot, 'tools', 'money-check-windows');
        fs.mkdirSync(launcherDir, { recursive: true });
        fs.mkdirSync(path.join(launcherRoot, 'audit-tools'));
        fs.mkdirSync(path.join(launcherRoot, 'ZoeW'));
        fs.writeFileSync(path.join(launcherRoot, 'ZoeW', 'app.js'), '');
        const launcher = path.join(launcherDir, 'check-money.cmd');
        fs.copyFileSync(path.join(ROOT, 'tools', 'money-check-windows', 'check-money.cmd'), launcher);
        fs.writeFileSync(path.join(launcherRoot, 'audit-tools', 'money-reality-check.js'),
            "const fs = require('fs'); const data = JSON.parse(fs.readFileSync(process.argv[2])); process.exit(data.moneyCode);\n");
        fs.writeFileSync(path.join(launcherRoot, 'audit-tools', 'redact-dump.js'),
            "const fs = require('fs'); const data = JSON.parse(fs.readFileSync(process.argv[2])); console.log('REDACTOR_CALLED'); if (!data.noOutput) fs.writeFileSync(process.argv[3], data.redactCode ? 'UNSAFE_FIXTURE' : '{}'); process.exit(data.redactCode);\n");
        [[0, 0], [1, 0], [3, 0], [0, 1], [1, 1], [0, 0, true], [0, 0, true, true], [0, 0, false, true]]
            .forEach(([moneyCode, redactCode, noOutput, staleOutput], index) => {
            const profile = path.join(tempRoot, 'profile ' + index);
            fs.mkdirSync(path.join(profile, 'Desktop'), { recursive: true });
            const safePath = path.join(profile, 'Desktop', 'zoe-dump-SAFE-TO-SHARE.json');
            if (staleOutput) fs.writeFileSync(safePath, 'STALE_FIXTURE');
            const input = save('launcher input ' + index + '.json', { moneyCode, redactCode, noOutput });
            const runner = path.join(tempRoot, 'runner-' + index + '.cmd');
            fs.writeFileSync(runner, '@echo off\r\ncall "' + launcher + '" "' + input + '"\r\nexit /b %ERRORLEVEL%\r\n');
            const result = spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/c', runner], {
                cwd: tempRoot, encoding: 'utf8', input: '\r\n', timeout: 10000, windowsHide: true,
                env: { ...process.env, USERPROFILE: profile, LOCALAPPDATA: path.join(profile, 'AppData', 'Local'),
                    PATH: path.dirname(process.execPath) + path.delimiter + process.env.PATH }
            });
            const text = (result.stdout || '') + (result.stderr || '');
            const expectCode = moneyCode >= 2 ? moneyCode : redactCode || noOutput ? 3 : moneyCode;
            const failedRedaction = moneyCode < 2 && (redactCode !== 0 || noOutput);
            ok('cmd ជុំ ' + index + ' money=' + moneyCode + ', redact=' + redactCode + ' ➜ exit ' + expectCode,
                result.status === expectCode, { status: result.status, text });
            ok('cmd ផ្សព្វផ្សាយ SAFE TO SEND តែពេលសម្អាតជោគជ័យ ' + index,
                text.includes('SAFE TO SEND') === (moneyCode < 2 && redactCode === 0 && !noOutput), text);
            ok('cmd ហៅ redactor តែពេលការវាស់លុយរត់ពេញ ' + index,
                text.includes('REDACTOR_CALLED') === (moneyCode < 2));
            if (failedRedaction) ok('cmd មិនបន្សល់ output ដែលមានស្លាក SAFE ក្រោយសម្អាតធ្លាក់ ' + index,
                !fs.existsSync(safePath));
            if (moneyCode < 2 && !failedRedaction) ok('cmd output ថ្មីជំនួស output ចាស់ពិត ' + index,
                fs.existsSync(safePath) && fs.readFileSync(safePath, 'utf8') === '{}');
        });
    });

    ok('ឧបករណ៍ទាំងពីរមិនកែ dump ដើម', fs.readFileSync(dump).equals(before));
} finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
}

console.log(`\nmoney-reality-test: ${pass} ok, ${fail} FAIL`);
process.exitCode = fail ? 1 : 0;
