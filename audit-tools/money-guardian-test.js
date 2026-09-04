// ថ្នាក់៖ **«សំណុំបៃតង» មិនមែនភស្តុតាងទេ — ត្រូវបញ្ជាក់ថាវា *អាចក្រហម* បាន។**
//
// 🔴 សំណួររបស់ម្ចាស់គម្រោង (2026-09-03) ៖ *«ពេលកែហើយ ឃើញថាបៃតងទាំងអស់ តែពេល
// ខ្ញុំឲ្យពិនិត្យ checker ទៅជា checker ងងឹតវិញ»* — គាត់ត្រូវ។ checker បៃតង
// មានន័យ **២ យ៉ាងខុសគ្នាឆ្ងាយ** ៖ (ក) វាបានវាស់ ហើយត្រូវ · (ខ) វាមិនបានវាស់
// អ្វីសោះ។ **ពណ៌បៃតងមិនបែងចែកវាទេ។**
//
// ⛔ ការវាស់ (2026-09-03) ៖ mutation «ដកផ្លូវដកវិញនៃ ledger ចេញ» ➜ ក្នុងចំណោម
// checker **១៦** ដែលប៉ះ ledger មានតែ **៥** ដែលក្រហម · **១១ នៅបៃតង**។
// ការងងឹតនោះមិនមែនកំហុសរបស់ ១១ នោះទេ (សេណារីយ៉ូរបស់ពួកវាមិនធ្វើឲ្យការសរសេរ
// ធ្លាក់) — តែវាមានន័យថា **ថ្នាក់លុយនេះពឹងលើអ្នកយាមតិចជាងអ្វីដែលគេស្មាន**។
//
// ឧបករណ៍នេះចាក់សោការពិតនោះ ៖ សម្រាប់ **mutation លុយនីមួយៗ** ត្រូវមាន
// **អ្នកយាមយ៉ាងតិច ១** ដែលក្រហម។ បើថ្ងៃណាការ refactor ធ្វើឲ្យអ្នកយាមចុងក្រោយ
// ងងឹត នោះឧបករណ៍នេះធ្លាក់ **មុន** កំហុសលុយបន្ទាប់ ship។
//
// ⛔ អ្នកយាមដែលជ្រើស ត្រូវ **លឿន** (គ្មាន browser) ដើម្បីឲ្យវារត់រាល់ជុំបាន ៖
//   · `emu/ledger-revert-emu-test.js` — RTDB ពិត · rules ពិត (SKIP ពេលគ្មាន emulator)
//   · `price-edit-abort-test.js`      — `vm` លើកូដ ship ពិត
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = process.env.MONEYGUARD_APP_DIR ? path.resolve(process.env.MONEYGUARD_APP_DIR) : path.join(__dirname, '..');
const APP = path.join(ROOT, 'ZoeW', 'app.js');
let pass = 0, fail = 0;
const ok = (c, label, detail) => {
    if (c) { pass++; console.log('  ok    ' + label); }
    else { fail++; console.log('  FAIL  ' + label + (detail !== undefined ? '\n        ' + detail : '')); }
};

if (!fs.existsSync(APP)) { console.log('  FAIL  រកមិនឃើញ ' + APP); process.exit(1); }
const SRC = fs.readFileSync(APP, 'utf8');

// អ្នកយាម ៖ [ឈ្មោះឯកសារ, env override, តើវា SKIP បានទេ]
// `needs` ៖ dependency ខាងក្រៅដែលអ្នកយាមនោះទាមទារ។ ពេលវាបាត់ (ឧ.
// `run-all.sh` ដែលរត់គ្មាន emulator) នោះ mutation ដែល **មានតែវាទេដែលឃើញ**
// ត្រូវរាយជា `--` ព្រមទាំងមូលហេតុ — មិនមែនជាការធ្លាក់ដែលច្រឡំអ្នកអានទេ។
// ⛔ តែក្នុង CI ដែលមាន emulator ត្រូវដាក់ `MONEYGUARD_STRICT=1` ➜ `--`
// នោះក្លាយជាការធ្លាក់ (ថ្នាក់ «SKIP ធំពេក» — មេរៀន 2.25.8 §៣ង)។
const STRICT = process.env.MONEYGUARD_STRICT === '1';
const GUARDS = [
    { file: 'emu/ledger-revert-emu-test.js', env: 'LEDGEREMU_APP_DIR', needs: 'RTDB emulator' },
    { file: 'price-edit-abort-test.js', env: 'PRICEABORT_APP_DIR', needs: null },
    { file: 'revenue-rules-clamp-test.js', env: 'REVCLAMP_APP_DIR', needs: null }
];

// mutation នៃ **តក្កវិជ្ជាលុយ** — នីមួយៗជាថ្នាក់កំហុសពិតដែលធ្លាប់កើត ឬអាចកើត
const MUTATIONS = [
    {
        // 📌 **ធ្លាប់ជា equivalent mutant — លែងមែនទៀតហើយ (2026-09-03ខ).**
        // ការវិភាគចាស់ ៖ ការត្រឡប់ delta ដែល *ស្នើ* ធ្វើឲ្យ **សតិ** ខុស
        // បណ្តោះអាសន្ន តែ `onValue(dbRefDailyRevenue)` សរសេរជាន់វិញ ➜
        // អ្នកប្រើមិនឃើញភាពខុស។ ការវិភាគនោះពិត **រហូតដល់ថ្ងៃដែល
        // `revenue-rules-clamp-test` ចូលជាអ្នកយាម** — វាអះអាង «សតិ == server»
        // ដោយផ្ទាល់ ➜ mutation នេះក្លាយជា **ចាប់បាន**។
        // ⛔ មេរៀន ៖ «equivalent» ជាការវាស់នៃ *ថ្ងៃនោះ* មិនមែនលក្ខណៈអចិន្ត្រៃយ៍ទេ។
        // ការសរសេរវាជា **ព័ត៌មាន** (មិនមែន `ok(caught.length === 0)`) ជាមូលហេតុ
        // ដែលការដំឡើងនេះមិនធ្វើឲ្យ CI ធ្លាក់ក្លែងក្លាយ។
        name: 'ការដកវិញប្រើ delta ដែល *ស្នើ* ជំនួស delta ដែល *អនុវត្ត* (សតិតែម្យ៉ាង)',
        from: '        return ledgerAppliedDelta(before, bucket);',
        to: '        return { cod: Math.round(((parseFloat(codToAdd) || 0)) * 100) / 100, dod: Math.round(((parseFloat(dodToAdd) || 0)) * 100) / 100, count: (parseFloat(countToAdd) || 0) };'
    },
    {
        needs: 'RTDB emulator',
        name: 'ការដកវិញខាង server មិនគោរពសាលក្រម server',
        from: '            const d = serverApplied || memoryApplied;',
        to: '            const d = memoryApplied;'
    },
    {
        needs: 'RTDB emulator',
        name: 'ការ clamp ត្រូវដកចេញ (rules នឹងបដិសេធការសរសេរ)',
        from: '            if (codDollar < 0) codDollar = 0;\n            if (dodDollar < 0) dodDollar = 0;\n            if (totalCount < 0) totalCount = 0;\n            serverAfter = { codDollar, dodDollar, totalCount };\n            return serverAfter;',
        to: '            serverAfter = { codDollar, dodDollar, totalCount };\n            return serverAfter;'
    },
    {
        // ⛔ ថ្នាក់ដដែលនឹង 2.26.0 តែនៅ **ស្ថិតិយក** ៖ `commitDailyPickupDelta`
        // clamp ខាង server តែមិនត្រឡប់ delta ដែលអនុវត្តពិត ➜ ការដកវិញប្រើ
        // delta របស់សតិ ➜ server ទទួលកញ្ចប់ដែលវាមិនធ្លាប់មាន។
        name: 'ស្ថិតិយក ៖ ការដកវិញមិនគោរពសាលក្រម server',
        from: '            const d = serverApplied || { packages: applied.packages, customer: applied.customer };',
        to: '            const d = { packages: applied.packages, customer: applied.customer };'
    },
    {
        name: 'ស្ថិតិយក ៖ commit ត្រឡប់ delta សតិ ជំនួសសាលក្រម server',
        from: '            return pickupAppliedDelta(serverBefore, serverAfter, phoneKey);',
        to: '            return applied;'
    },
    {
        // 🔴 ថ្នាក់ដដែលជាលើកទី ៣ (2026-09-04) — ផ្លូវ **reconcile** មិនមែន revert។
        // `correctPickupLedgerToActual()` ធ្លាប់គណនាភាពខុសធៀបនឹង delta របស់
        // **សតិ** រួចសរសេរវាទៅ server ➜ ពេល ledger ខាង server ត្រូវ clamp
        // (ឧបករណ៍ផ្សេងយកវាទៅ 0 មុន) ការ «ជួសជុល» នោះបង្កើតកញ្ចប់ពីអាកាសធាតុ។
        // អ្នកប្រើវាស់បានលើឧបករណ៍ពិត ៖ កញ្ចប់យក 0 ➜ 1 ដោយបញ្ជីមានតែ ១ កញ្ចប់បើក។
        name: 'ស្ថិតិយក ៖ reconcile គណនាធៀបនឹង delta របស់សតិ ជំនួសសាលក្រម server',
        from: '            const customerDiff = actualCustomer - ledgerNumber(base.customer);\n            const packageDiff = actualPackages - ledgerNumber(base.packages);',
        to: '            const customerDiff = actualCustomer - ledgerNumber(applied.customer);\n            const packageDiff = actualPackages - ledgerNumber(applied.packages);'
    },
    {
        name: 'ការដកវិញត្រូវដកចេញទាំងស្រុង',
        from: '    function revertRevenueLedgerDelta(applied) {',
        to: '    function revertRevenueLedgerDelta(applied) { return applied; }\n    function revertRevenueLedgerDeltaDead(applied) {'
    }
];

function buildMutant(mutation) {
    if (SRC.indexOf(mutation.from) === -1) return null;
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zoe-moneyguard-'));
    fs.mkdirSync(path.join(dir, 'ZoeW'), { recursive: true });
    // ចម្លងតែអ្វីដែលអ្នកយាមត្រូវការ ៖ app.js និង rules
    fs.writeFileSync(path.join(dir, 'ZoeW', 'app.js'), SRC.replace(mutation.from, mutation.to));
    const rules = path.join(ROOT, 'firebase-database.rules.json');
    if (fs.existsSync(rules)) fs.copyFileSync(rules, path.join(dir, 'firebase-database.rules.json'));
    return dir;
}

function runGuard(guard, appDir) {
    const env = Object.assign({}, process.env);
    env[guard.env] = appDir;
    if (process.env.MONEYGUARD_NO_EMU === '1') env.LEDGEREMU_PORT = '9099';
    try {
        const out = execFileSync(process.execPath, [path.join(__dirname, guard.file)],
            { env, encoding: 'utf8', timeout: 240000, stdio: ['ignore', 'pipe', 'pipe'] });
        return { code: 0, out: out };
    } catch (e) {
        return { code: e.status === undefined ? 1 : e.status, out: (e.stdout || '') + (e.stderr || '') };
    }
}

// ⛔ ជាន់ចាំបាច់ ៖ អ្នកយាមត្រូវ **បៃតងលើ tree ស្អាត** បើមិនដូច្នេះ «ក្រហម
// លើ mutant» គ្មានន័យទេ (វាក្រហមជានិច្ច)។
const alive = [];
const absent = new Set();
GUARDS.forEach((g) => {
    const r = runGuard(g, ROOT);
    if (/^SKIP/m.test(r.out)) {
        if (g.needs) absent.add(g.needs);
        if (STRICT) { ok(false, '⛔ STRICT ៖ អ្នកយាម ' + g.file + ' SKIP (ត្រូវការ ' + (g.needs || 'dependency') + ')'); }
        else { console.log('  --    ' + g.file + ' — SKIP (ត្រូវការ ' + (g.needs || 'dependency') + ') ➜ មិនរាប់ជាអ្នកយាម'); }
        return;
    }
    ok(r.code === 0, 'អ្នកយាម ' + g.file + ' បៃតងលើ tree ស្អាត', r.out.split('\n').slice(-3).join(' | '));
    if (r.code === 0) alive.push(g);
});
ok(alive.length > 0, '⛔ ជាន់អប្បបរមា៖ មានអ្នកយាមយ៉ាងតិច ១ ដែលរត់បាន', 'alive=' + alive.length);
if (STRICT) ok(absent.size === 0, '⛔ STRICT ៖ អ្នកយាមទាំងអស់ត្រូវរត់បាន (គ្មាន SKIP)', Array.from(absent).join(', '));

let applicable = 0;
MUTATIONS.forEach((m) => {
    const dir = buildMutant(m);
    if (!dir) {
        ok(false, '⛔ mutation មិនអាចចាក់បាន (កូដប្រែរូបរាង?): ' + m.name,
            'ខ្សែអក្សរយុថ្កាលែងមានក្នុង app.js ➜ ការវាស់នេះមិនបានវាស់អ្វីទេ');
        return;
    }
    applicable++;
    const caught = [];
    alive.forEach((g) => { if (runGuard(g, dir).code !== 0) caught.push(g.file); });
    if (m.equivalent) {
        // ⛔⛔ **កុំអះអាងថាវានៅតែចាប់មិនបាន។** ការសរសេរ `ok(caught.length === 0)`
        // នឹងធ្វើឲ្យតេស្ត **ធ្លាក់ពេលនរណាម្នាក់ធ្វើឲ្យអ្នកយាមខ្លាំងជាងមុន** —
        // នោះជា **ការអះអាងដែលចាក់សោកំហុស** មិនមែនការការពារ (មេរៀន 2.20.6 ៖
        // «តើការអះអាងនេះការពារអ្វី ឬចាក់សោអ្វី?»)។ ត្រង់នេះជាកំណត់ត្រា
        // **ព័ត៌មាន** ៖ វាបានវាស់រួច ហើយលទ្ធផលបច្ចុប្បន្នត្រូវរាយឲ្យឃើញ។
        console.log('  --    equivalent (វាស់រួច — មិនទាមទារអ្នកយាម): ' + m.name);
        console.log('        ស្ថានភាពបច្ចុប្បន្ន: ' + (caught.length
            ? 'ក្លាយជាចាប់បានហើយដោយ ' + caught.join(', ') + ' ➜ ការវិភាគ equivalent លែងពិត (ជាដំណឹងល្អ)'
            : 'នៅតែចាប់មិនបាន — ស៊ីនឹងការវិភាគ (សតិខុសបណ្តោះអាសន្ន តែ listener សរសេរជាន់វិញ)'));
    } else if (caught.length === 0 && m.needs && absent.has(m.needs)) {
        // ⛔ គ្មានអ្នកយាមក្រហម **ព្រោះអ្នកយាមរបស់វាមិនបានរត់** — មិនមែនព្រោះ
        // កូដខូចទេ។ ការរាយវាជាការធ្លាក់ ជា «ការធ្លាក់ក្លែងក្លាយ» ដែលបញ្ជូន
        // ជុំក្រោយទៅដេញតាមខ្យល់ (មេរៀន 2026-08-29)។
        console.log('  --    mutation មិនបានវាស់ (ត្រូវការ ' + m.needs + '): ' + m.name);
    } else {
        ok(caught.length > 0, 'mutation ត្រូវចាប់បាន: ' + m.name,
            '🔴 គ្មានអ្នកយាមណាក្រហម ➜ ថ្នាក់លុយនេះលែងមានអ្នកយាម');
        if (caught.length) console.log('        ចាប់បានដោយ: ' + caught.join(', '));
    }
    fs.rmSync(dir, { recursive: true, force: true });
});
ok(applicable === MUTATIONS.length, '⛔ ជាន់អប្បបរមា៖ mutation ទាំង ' + MUTATIONS.length + ' ចាក់បានពិត', 'ចាក់បាន ' + applicable);

console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' (ok ' + pass + ')' : '✅ គ្មានបញ្ហា — ok ' + pass));
process.exit(fail ? 1 : 0);
