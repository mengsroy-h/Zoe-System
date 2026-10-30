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
    return body.split(/\r?\n/).filter((line) => !line.startsWith('ឯកសារ ៖ ') && !line.startsWith('កូដលុយ ៖ ')).join('\n');
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
        const badGzip = path.join(tempRoot, 'bad.json.gz');
        fs.writeFileSync(badGzip, 'not gzip');
        const emptyTree = path.join(tempRoot, 'empty-tree');
        fs.mkdirSync(emptyTree);
        const cases = [
            ['money គ្មានអាគុយម៉ង់', 'money-reality-check.js', [], 2],
            ['money គ្មាន dump', 'money-reality-check.js', [missing], 3],
            ['money JSON ខូច', 'money-reality-check.js', [invalid], 3],
            ['money gzip ខូច', 'money-reality-check.js', [badGzip], 3],
            ['redactor គ្មានអាគុយម៉ង់', 'redact-dump.js', [], 2],
            ['redactor គ្មាន dump', 'redact-dump.js', [missing], 1],
            ['redactor JSON ខូច', 'redact-dump.js', [invalid], 1]
        ];
        cases.forEach(([label, script, args, status]) => {
            const result = run(script, args);
            ok(label + ' ➜ exit ' + status, result.status === status && result.text.length > 0, result.status);
        });
        const missingApp = run('money-reality-check.js', [dump], { MONEYREAL_APP_DIR: emptyTree });
        ok('money គ្មានកូដលុយ ➜ exit 3 មិនមែនលុយខុស', missingApp.status === 3 && /money code not found/.test(missingApp.text));
    });

    scenario('barcode punctuation និង literal % រក្សាទំនាក់ទំនងមុន/ក្រោយសម្អាត', () => {
        const data = copy();
        withSecondClose(data);
        data.zoew_daily_revenue_cod_dod[day].totalCount = 5;
        data.zoew_daily_revenue_cod_dod[day].codDollar += 1.5;
        data.zoew_monthly_revenue_cod_dod['2026-09'].totalCount = 5;
        data.zoew_monthly_revenue_cod_dod['2026-09'].codDollar += 1.5;
        [[closedCode, 'AB.C', 'AB%2EC'], [secondCode, 'AB%2EC', 'AB%252EC']].forEach(([oldCode, rawCode, key]) => {
            Object.values(data.zoew_scan_history_cod_dod).forEach((item) => item.barcodes.forEach((b) => {
                if (String(b.code).toUpperCase() === oldCode) b.code = rawCode;
            }));
            [data.zoew_barcode_registry, data.zoew_daily_pickup_cod_dod[pickupDay].pickedUpBarcodes,
                data.zoew_daily_collected_cod_dod[pickupDay]].forEach((record) => {
                record[key] = record[oldCode];
                delete record[oldCode];
            });
        });
        const encodedDump = save('encoded-identities.json', data);
        const plain = report(encodedDump, 'encoded report.txt');
        ok('⛔ registry/collected keys encode រួច មិនត្រូវ encode ពីរដង',
            plain.status === 0 && /✅ \d+   ⚠️ 0   ❌ 0/.test(plain.body), plain.body);
        const redacted = path.join(tempRoot, 'encoded-redacted.json');
        const redaction = run('redact-dump.js', [encodedDump, redacted]);
        const after = report(redacted, 'encoded-redacted report.txt');
        ok('⛔ សម្អាត barcode សញ្ញាពិសេសដោយ encoder ពិត រក្សាការវាស់ទាំងអស់ដដែល',
            redaction.status === 0 && after.status === 0 && measured(plain.body) === measured(after.body), after.body);
        const text = fs.readFileSync(redacted, 'utf8');
        ok('⛔ barcode raw និង encoded key ពិតមិនលេចក្នុងឯកសារសម្អាត',
            !text.includes('AB.C') && !text.includes('AB%2EC') && !text.includes('AB%252EC'));
    });

    scenario('សម្អាត numeric identities និង unknown numeric secrets ដោយរក្សាលុយ', () => {
        const data = copy();
        const numericPhone = Number(phone.replace('+', ''));
        [data.zoew_scan_history_cod_dod, data.zoew_recently_deleted_cod_dod].forEach((items) => Object.values(items).forEach((item) => {
            item.phone = numericPhone;
            item.barcodes.forEach((b) => { if (/^[0-9]+$/.test(b.code)) b.code = Number(b.code); });
        }));
        data.zoew_daily_pickup_cod_dod[pickupDay].pickedUpPhones = { [numericPhone]: 1 };
        data.zoew_settings = { fixture: { password: 1234561234, customSecret: 3434343434, c: 9898989898 } };
        const numericDump = save('numeric-private.json', data);
        const plain = report(numericDump, 'numeric-private report.txt');
        const redacted = path.join(tempRoot, 'numeric-private-redacted.json');
        const redaction = run('redact-dump.js', [numericDump, redacted]);
        const text = fs.readFileSync(redacted, 'utf8');
        ok('⛔ numeric phone/barcode និង numeric secrets មិនលេចក្នុង output ដែលរាយ safe',
            redaction.status === 0 && [numericPhone, Number(openCode), Number(deletedCode), 1234561234, 3434343434, 9898989898].every((v) => !text.includes(String(v))));
        const clean = JSON.parse(text);
        const pickup = clean.zoew_daily_pickup_cod_dod[pickupDay];
        ok('⛔ ទឹកប្រាក់ shorthand c/d និង phone counters នៅតែជាលេខដដែល',
            Object.values(pickup.pickedUpPhones)[0] === 1
            && Object.values(clean.zoew_daily_collected_cod_dod[pickupDay])[0].c === 5.5
            && clean.zoew_daily_revenue_cod_dod[day].codDollar === 17.75);
        const after = report(redacted, 'numeric-private-redacted report.txt');
        ok('⛔ សម្អាត numeric identities រក្សាទំនាក់ទំនង និងការវាស់លុយដដែល',
            plain.status === 0 && after.status === 0 && measured(plain.body) === measured(after.body), after.body);
    });

    // ⛔ ZoeW React ៖ repo ដែលអ្នកប្រើទាញ (Download ZIP) គ្មាន `ZoeW/app.js` ទេ ➜ CLI អានកូដលុយពី `audit-tools/money-core.js`
    //    ដែលផលិតពី src ពិត។ វាស់ ២ ទិស ៖ (១) repo React (src/main.tsx + money-core) ➜ ការវាស់ **ដូច** ការអានពី app.js បេះបិទ;
    //    (២) money-core ចាស់ជាងកូដ ➜ ធ្លាក់ (បើអត់ អ្នកប្រើវាស់លុយដោយរូបមន្តចាស់ ខណៈ App ship រូបមន្តថ្មី)។
    scenario('ZoeW React ៖ money-core.js ស្រស់ និងផ្តល់ការវាស់ដូច app.js', () => {
        const coreFile = path.join(ROOT, 'audit-tools', 'money-core.js');
        const reactMeasure = fs.existsSync(path.join(ROOT, 'ZoeW', 'react-render.cjs'))
            || fs.existsSync(coreFile) && fs.existsSync(path.join(ROOT, 'ZoeW', 'app.js'));
        if (reactMeasure) {
            const { moneyCoreText } = require(path.join(ROOT, 'audit-tools', 'money-reality-check.js'));
            const fresh = moneyCoreText(fs.readFileSync(path.join(ROOT, 'ZoeW', 'app.js'), 'utf8'));
            ok('កូដលុយក្នុង app.js (build វាស់) ស្រង់បានគ្រប់', fresh.missing.length === 0, fresh.missing);
            ok('⛔ audit-tools/money-core.js ស្រស់ (ស្មើកូដលុយពិតរបស់ src) — ចាស់ ➜ រត់ `npm --prefix ZoeW run money:core`',
                fs.existsSync(coreFile) && fs.readFileSync(coreFile, 'utf8') === fresh.text);
        }
        if (!fs.existsSync(coreFile)) return;
        const reactTree = path.join(tempRoot, 'react-tree');
        fs.mkdirSync(path.join(reactTree, 'ZoeW', 'src'), { recursive: true });
        fs.mkdirSync(path.join(reactTree, 'audit-tools'), { recursive: true });
        fs.writeFileSync(path.join(reactTree, 'ZoeW', 'src', 'main.tsx'), '');
        fs.copyFileSync(coreFile, path.join(reactTree, 'audit-tools', 'money-core.js'));
        const viaCore = run('money-reality-check.js', [dump], { MONEYREAL_APP_DIR: reactTree });
        const viaApp = run('money-reality-check.js', [dump]);
        ok('repo React (គ្មាន app.js) ➜ CLI អាន money-core.js ហើយ exit ដូច app.js',
            viaCore.status === viaApp.status && /money-core\.js/.test(viaCore.text), [viaCore.status, viaApp.status]);
        ok('repo React ➜ ការវាស់ដូចការអានពី app.js បេះបិទ', measured(viaCore.text) === measured(viaApp.text));
        const staleTree = path.join(tempRoot, 'no-core-tree');
        fs.mkdirSync(path.join(staleTree, 'ZoeW', 'src'), { recursive: true });
        fs.writeFileSync(path.join(staleTree, 'ZoeW', 'src', 'main.tsx'), '');
        const noCore = run('money-reality-check.js', [dump], { MONEYREAL_APP_DIR: staleTree });
        ok('ទិសផ្ទុយ ៖ repo React គ្មាន money-core.js ➜ exit 3 (មិនវាស់ដោយគ្មានកូដ)', noCore.status === 3);
        // ⛔ record មិនមែន object (ខ្សែអក្សរ · លេខ · `null` ក្រោម `$itemId`) ជាករណីដែល `rawSnapshotToItemList()` រំលង + រាយការណ៍តាម
        //    `window.ZoeErrors` ➜ sandbox របស់ CLI (Node · គ្មាន `window`) ត្រូវវាស់ dump នោះបាន **ដូច dump ស្អាត** មិនមែនគាំង
        //    `ReferenceError` (វាស់បាន 2.45.4 ៖ money-core ថ្មី + sandbox គ្មាន `window` ➜ CLI ធ្លាក់ exit 1 គ្មានការវាស់)។
        const junk = copy();
        junk.zoew_scan_history_cod_dod['-junk-string'] = 'junk';
        junk.zoew_scan_history_cod_dod['-junk-number'] = 5;
        junk.zoew_recently_deleted_cod_dod['-junk-bool'] = true;
        const junkDump = save('fixture junk-records.json', junk);
        const junkCore = run('money-reality-check.js', [junkDump], { MONEYREAL_APP_DIR: reactTree });
        const junkApp = run('money-reality-check.js', [junkDump]);
        ok('⛔ dump មាន record មិនមែន object ➜ CLI (money-core.js) វាស់ដូច dump ស្អាត (មិនគាំង)',
            junkCore.status === viaCore.status && measured(junkCore.text).replace(/fixture junk-records\.json/g, 'fixture dump.json') === measured(viaCore.text),
            [junkCore.status, viaCore.status, junkCore.text.split('\n').filter((l) => /Error|at /.test(l)).slice(0, 2)]);
        ok('⛔ dump មាន record មិនមែន object ➜ CLI (app.js) វាស់ដូច dump ស្អាត (មិនគាំង)',
            junkApp.status === viaApp.status && measured(junkApp.text).replace(/fixture junk-records\.json/g, 'fixture dump.json') === measured(viaApp.text),
            [junkApp.status, viaApp.status]);
    });

    scenario('scan v2៖ ភស្តុតាង និង pending មិនមែនលុយខុស', () => {
        const data = copy();
        const id = 'scan_' + 'a'.repeat(32), birth = 1789000000000;
        const row = data.zoew_scan_history_cod_dod['-fixture-open-01'];
        row.barcodes[0].createdAt = birth; row.barcodes[0].scanIntent = id; row.barcodes[0].locker = 'fixture-locker-A';
        const operation = { v: 2, id, actorUid: 'fixture-actor', scope: 'fixture-shop', code: openCode,
            registryKey: openCode, birth, scanDate: day, month: day.slice(0, 7), cod: 10.25, dod: 0.75,
            count: 1, monthToken: 'op_m' + id.slice(5), phase: 'committed', targetId: 'fixture-open-01',
            payloadHash: 'b'.repeat(64), phone, locker: 'fixture-locker-A', closedAt: 0 };
        data.zoew_scan_operations = { [id]: operation };
        data.zoew_barcode_registry[openCode] = { v: 2, intent: id, actorUid: operation.actorUid, birth };
        const committed = report(save('v2-committed.json', data), 'v2-committed.txt');
        ok('v2 committed មានអត្តសញ្ញាណត្រឹមត្រូវ ➜ វាស់បាន និងមិនរាយកំព្រា', committed.status === 0 && !committed.body.includes('**កំព្រា**'), committed.text);
        const pending = JSON.parse(JSON.stringify(data));
        pending.zoew_scan_operations[id].phase = 'prepared';
        pending.zoew_scan_history_cod_dod['-fixture-open-01'].scanPending = { intent: id, actorUid: operation.actorUid,
            code: openCode, birth, slot: '0', payloadHash: operation.payloadHash };
        for (const bucket of [pending.zoew_daily_revenue_cod_dod[day], pending.zoew_monthly_revenue_cod_dod['2026-09']]) {
            bucket.codDollar -= 10.25; bucket.dodDollar -= 0.75; bucket.totalCount--;
        }
        const staged = report(save('v2-prepared.json', pending), 'v2-prepared.txt');
        ok('provisional មិនរាប់ក្នុងប្រាក់/ចំនួន confirmed ហើយមានព្រមាន pending', staged.status === 0 && staged.body.includes('scan pending')
            && !staged.body.includes('ledger តិចជាងកញ្ចប់') && staged.body.includes('ចំណូល(យករួច) $5.75'), staged.body);
        const ambiguous = JSON.parse(JSON.stringify(data));
        ambiguous.zoew_scan_history_cod_dod['-fixture-open-01'].scanPending = { broken: true };
        delete ambiguous.zoew_scan_operations[id];
        const held = report(save('v2-ambiguous.json', ambiguous), 'v2-ambiguous.txt');
        ok('pending ខូច/receipt បាត់ ➜ ព្រមានវាស់មិនបាន មិនអះអាងចំណូលត្រឹមត្រូវ', held.status === 0
            && held.body.includes('scan pending') && held.body.includes('ផ្ទៀងផ្ទាត់មិនបាន')
            && !held.body.includes('ចំណូល(យករួច) $16.75') && !held.body.includes('**កំព្រា**'), held.body);
        const malformed = JSON.parse(JSON.stringify(data));
        malformed.zoew_barcode_registry[openCode].birth++;
        const mismatch = report(save('v2-owner-mismatch.json', malformed), 'v2-owner-mismatch.txt');
        ok('owned registry tuple ខុស ➜ មិនបញ្ជាក់ថាមានម្ចាស់ត្រឹមត្រូវ', mismatch.status === 0 && mismatch.body.includes('registry v2')
            && mismatch.body.includes('ផ្ទៀងផ្ទាត់មិនបាន'), mismatch.body);
        for (const [name, mutate] of [
            ['extra-owner', d => { d.zoew_barcode_registry[openCode].extra = true; }],
            ['foreign-owner', d => { d.zoew_barcode_registry[openCode].actorUid = 'foreign'; }],
            ['cancelled', d => { d.zoew_scan_operations[id].phase = 'cancelled'; }],
            ['wrong-key', d => { d.zoew_scan_operations[id].registryKey = 'WRONG'; }],
            ['wrong-birth', d => { d.zoew_scan_history_cod_dod['-fixture-open-01'].barcodes[0].createdAt++; }],
            ['missing-receipt', d => { delete d.zoew_scan_operations[id]; }]
        ]) {
            const changed = JSON.parse(JSON.stringify(data)); mutate(changed);
            const result = report(save('v2-' + name + '.json', changed), 'v2-' + name + '.txt');
            ok('v2 ' + name + ' ➜ visible unknown មិនបញ្ជាក់កម្មសិទ្ធិក្លែង', result.status === 0
                && result.body.includes('registry v2') && result.body.includes('ផ្ទៀងផ្ទាត់មិនបាន'), result.status);
        }
        const restored = JSON.parse(JSON.stringify(data));
        restored.zoew_scan_history_cod_dod['-fixture-open-01'].id = 'restored-row';
        restored.zoew_scan_history_cod_dod['-fixture-open-01'].barcodes[0].restoredAt = birth + 100;
        const restoredResult = report(save('v2-restored.json', restored), 'v2-restored.txt');
        ok('Restore ប្តូរ row id តែរក្សា barcode birth/intent ➜ ownership នៅត្រឹមត្រូវ', restoredResult.status === 0
            && !restoredResult.body.includes('registry v2'), restoredResult.body);
        const sparse = JSON.parse(JSON.stringify(pending));
        sparse.zoew_scan_history_cod_dod['-fixture-open-01'].barcodes = { 0: sparse.zoew_scan_history_cod_dod['-fixture-open-01'].barcodes[0] };
        const sparseResult = report(save('v2-object-row.json', sparse), 'v2-object-row.txt');
        ok('object barcodes មិនត្រូវធ្វើជាប្រាក់ UI ដែលបានផ្ទៀងរួច', sparseResult.status === 0
            && sparseResult.body.includes('ទម្រង់ barcode មិនអាចវាស់បាន') && sparseResult.body.includes('ផ្ទៀងផ្ទាត់មិនបាន'), sparseResult.body);
        const edited = JSON.parse(JSON.stringify(data));
        const editedRow = edited.zoew_scan_history_cod_dod['-fixture-open-01'];
        editedRow.barcodes[0].cod++; editedRow.cod++; editedRow.price++;
        edited.zoew_daily_revenue_cod_dod[day].codDollar++;
        edited.zoew_monthly_revenue_cod_dod['2026-09'].codDollar++;
        const editedResult = report(save('v2-price-edited.json', edited), 'v2-price-edited.txt');
        ok('កែតម្លៃក្រោយ commit មិនប្តូរ registry birth/intent ➜ មិនរាយកម្មសិទ្ធិខុស', editedResult.status === 0 && !editedResult.body.includes('registry v2'), editedResult.status);
        const duplicateLife = JSON.parse(JSON.stringify(data));
        duplicateLife.zoew_recently_deleted_cod_dod['second-life'] = JSON.parse(JSON.stringify(duplicateLife.zoew_scan_history_cod_dod['-fixture-open-01']));
        duplicateLife.zoew_recently_deleted_cod_dod['second-life'].id = 'second-life';
        const duplicateResult = report(save('v2-duplicate-life.json', duplicateLife), 'v2-duplicate-life.txt');
        ok('holders lifecycle ស្ទួន ➜ ownership មិនអាចផ្ទៀងបាន', duplicateResult.body.includes('registry v2') && duplicateResult.body.includes('ផ្ទៀងផ្ទាត់មិនបាន'));
        const drift = JSON.parse(JSON.stringify(ambiguous));
        drift.zoew_monthly_revenue_cod_dod['2026-09'].codDollar++;
        const driftResult = report(save('v2-unknown-real-drift.json', drift), 'v2-unknown-real-drift.txt');
        ok('unknown pending មិនលាក់គម្លាត ledger ថ្ងៃ/ខែដែលវាស់បានពិត', driftResult.status === 1
            && driftResult.body.includes('ឃ្លាតពីផលបូកថ្ងៃ'), driftResult.status);
        ok('របាយការណ៍ v2 មិនបញ្ចេញ identity/operation/scope', [id, phone, openCode, operation.actorUid, operation.scope]
            .every(value => !staged.body.includes(value) && !held.body.includes(value) && !mismatch.body.includes(value)));
    });

    scenario('ទិន្នន័យខូចមិនបញ្ចេញតម្លៃ ឬកូនសោឯកជន', () => {
        const secret = 'PRIVATE_PHONE_012345678';
        for (const [name, value] of [['string', secret], ['object', { token: secret }], ['numeric-string', '012345678999']]) {
            const data = copy();
            data.zoew_daily_revenue_cod_dod[day].codDollar = value;
            const result = report(save('private-value-' + name + '.json', data), 'private-value-' + name + '.txt');
            ok(name + ' ledger ខូច ➜ exit1 និងលាក់តម្លៃ', result.status === 1
                && !result.text.includes(secret) && !result.body.includes(secret)
                && !result.text.includes('12345678999') && !result.body.includes('12345678999'), result.status);
        }
        const keys = copy();
        keys.zoew_daily_revenue_cod_dod[secret] = { codDollar: -1 };
        keys.zoew_monthly_revenue_cod_dod[secret] = { codDollar: -1 };
        keys.zoew_daily_pickup_cod_dod[secret] = { packagesPickedUp: 3, pickedUpPhones: {} };
        keys.zoew_scan_history_cod_dod['-fixture-open-01'].scanDate = secret;
        keys.zoew_scan_history_cod_dod['-fixture-open-01'].cod++;
        const result = report(save('private-keys.json', keys), 'private-keys.txt');
        ok('កូនសោថ្ងៃ ខែ និង scanDate ខូច ➜ exit1 និងលាក់កូនសោ', result.status === 1
            && !result.text.includes(secret) && !result.body.includes(secret)
                && !result.text.includes('12345678999') && !result.body.includes('12345678999'), result.status);
        const broken = path.join(tempRoot, 'private-invalid.json');
        fs.writeFileSync(broken, '{"token":"' + secret + '", BROKEN}');
        const parsed = report(broken, 'private-invalid.txt');
        ok('JSON ខូច ➜ exit3 និងលាក់ parse excerpt ក្នុង console/report', parsed.status === 3
            && !parsed.text.includes(secret) && !parsed.body.includes(secret));
    });

    scenario('កូដលុយខូច ➜ exit 3 មិនមែនរកឃើញលុយខុស', () => {
        const core = fs.readFileSync(path.join(ROOT, 'audit-tools/money-core.js'), 'utf8');
        for (const [name, source] of [
            ['missing', core.replace('function canonicalBarcodeRegistryKey(', 'function removedBarcodeRegistryKey(')],
            ['runtime', core.replace(/function statsMoney\([^)]*\)\s*\{/, '$& throw new Error("PRIVATE_RUNTIME_FIXTURE");')],
            ['syntax', core.replace(/function statsMoney\([^)]*\)\s*\{/, '$& const = ;')]
        ]) {
            const tree = path.join(tempRoot, 'broken-core-' + name);
            fs.mkdirSync(path.join(tree, 'ZoeW', 'src'), { recursive: true });
            fs.mkdirSync(path.join(tree, 'audit-tools'));
            fs.writeFileSync(path.join(tree, 'ZoeW', 'src', 'main.tsx'), '');
            fs.writeFileSync(path.join(tree, 'audit-tools', 'money-core.js'), source);
            const broken = run('money-reality-check.js', [dump], { MONEYREAL_APP_DIR: tree });
            ok(name + ' ➜ exit3 និងមិនបញ្ចេញ runtime payload', broken.status === 3 && !broken.text.includes('PRIVATE_RUNTIME_FIXTURE'), broken.status);
            const staleReport = path.join(tempRoot, 'stale-' + name + '.txt');
            fs.writeFileSync(staleReport, 'PRIOR SUCCESS');
            const failedReport = run('money-reality-check.js', [dump, '--report', staleReport], { MONEYREAL_APP_DIR: tree });
            const failedText = fs.readFileSync(staleReport, 'utf8');
            ok(name + ' failure ជំនួស report ជោគជ័យចាស់ដោយសេចក្តីជូនដំណឹង', failedReport.status === 3
                && failedText.startsWith('\ufeff') && !failedText.includes('PRIOR SUCCESS')
                && !failedText.includes('PRIVATE_RUNTIME_FIXTURE') && failedText.includes('មិនបានបញ្ចប់'));
            if (name === 'runtime') {
                const cannotWrite = run('money-reality-check.js', [dump, '--report', tree], { MONEYREAL_APP_DIR: tree });
                ok('report សរសេរមិនបាននៅតែ exit3 និងព្រមានមិនប្រើ report ចាស់', cannotWrite.status === 3 && cannotWrite.text.includes('report was not updated'));
            }

        }
    });

    scenario('report មិនសរសេរជាន់ dump ដើម', () => {
        const alias = save('report-is-input.json', copy());
        const original = fs.readFileSync(alias);
        const result = run('money-reality-check.js', [alias, '--report', alias]);
        ok('report ដូច input ➜ exit3 និង bytes input ដដែល', result.status === 3 && fs.readFileSync(alias).equals(original));
        const linked = path.join(tempRoot, 'report-hardlink.txt');
        fs.linkSync(alias, linked);
        const linkedResult = run('money-reality-check.js', [alias, '--report', linked]);
        ok('report hardlink ទៅ input ➜ exit3 និង bytes input ដដែល', linkedResult.status === 3
            && fs.readFileSync(alias).equals(original) && fs.readFileSync(linked).equals(original));
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
