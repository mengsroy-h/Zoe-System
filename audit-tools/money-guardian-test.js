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
const GUARDS = [
    { file: 'emu/ledger-revert-emu-test.js', env: 'LEDGEREMU_APP_DIR', skippable: true },
    { file: 'price-edit-abort-test.js', env: 'PRICEABORT_APP_DIR', skippable: false }
];

// mutation នៃ **តក្កវិជ្ជាលុយ** — នីមួយៗជាថ្នាក់កំហុសពិតដែលធ្លាប់កើត ឬអាចកើត
const MUTATIONS = [
    {
        // ⚠️ **equivalent mutant ដែលវាស់រួច — កុំទាមទារអ្នកយាម។** ការត្រឡប់
        // delta ដែល *ស្នើ* ធ្វើឲ្យ **សតិ** ខុសបណ្តោះអាសន្ន តែ
        // `onValue(dbRefDailyRevenue)` សរសេរជាន់សតិពី server វិញក្នុងរយៈពេល
        // មិល្លីវិនាទី ➜ **លទ្ធផលដែលអ្នកប្រើឃើញមិនប្រែ**។ វានៅក្នុងបញ្ជីនេះ
        // ដើម្បីឲ្យ session ក្រោយដឹងថាវា **ត្រូវបានវាស់** មិនមែនត្រូវភ្លេច។
        equivalent: true,
        name: 'ការដកវិញប្រើ delta ដែល *ស្នើ* ជំនួស delta ដែល *អនុវត្ត* (សតិតែម្យ៉ាង)',
        from: '        return ledgerAppliedDelta(before, bucket);',
        to: '        return { cod: Math.round(((parseFloat(codToAdd) || 0)) * 100) / 100, dod: Math.round(((parseFloat(dodToAdd) || 0)) * 100) / 100, count: (parseFloat(countToAdd) || 0) };'
    },
    {
        name: 'ការដកវិញខាង server មិនគោរពសាលក្រម server',
        from: '            const d = serverApplied || memoryApplied;',
        to: '            const d = memoryApplied;'
    },
    {
        name: 'ការ clamp ត្រូវដកចេញ (rules នឹងបដិសេធការសរសេរ)',
        from: '            if (codDollar < 0) codDollar = 0;\n            if (dodDollar < 0) dodDollar = 0;\n            if (totalCount < 0) totalCount = 0;\n            serverAfter = { codDollar, dodDollar, totalCount };\n            return serverAfter;',
        to: '            serverAfter = { codDollar, dodDollar, totalCount };\n            return serverAfter;'
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
GUARDS.forEach((g) => {
    const r = runGuard(g, ROOT);
    const skipped = /^SKIP/m.test(r.out);
    if (skipped) { console.log('  --    ' + g.file + ' — SKIP (dependency មិនមាន) ➜ មិនរាប់ជាអ្នកយាម'); return; }
    ok(r.code === 0, 'អ្នកយាម ' + g.file + ' បៃតងលើ tree ស្អាត', r.out.split('\n').slice(-3).join(' | '));
    if (r.code === 0) alive.push(g);
});
ok(alive.length > 0, '⛔ ជាន់អប្បបរមា៖ មានអ្នកយាមយ៉ាងតិច ១ ដែលរត់បាន', 'alive=' + alive.length);

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
        // ⛔ equivalent mutant ៖ អ្វីដែលត្រូវអះអាងគឺ **វានៅតែ equivalent** —
        // បើថ្ងៃណាវាក្លាយជាមើលឃើញ នោះការវិភាគចាស់លែងពិត ➜ ត្រូវពិនិត្យឡើងវិញ។
        ok(caught.length === 0, '⚠️ equivalent (វាស់រួច — មិនទាមទារអ្នកយាម): ' + m.name,
            'វាក្លាយជាមើលឃើញហើយ ➜ ការវិភាគចាស់លែងពិត: ' + caught.join(', '));
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
