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
const { execFile } = require('child_process');

const ROOT = process.env.MONEYGUARD_APP_DIR ? path.resolve(process.env.MONEYGUARD_APP_DIR) : path.join(__dirname, '..');
const APP = path.join(ROOT, 'ZoeW', 'app.js');
let pass = 0, fail = 0;
process.exitCode = 1;
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
    { file: 'revenue-rules-clamp-test.js', env: 'REVCLAMP_APP_DIR', needs: null },
    { file: 'ledger-failed-apply-revert-test.js', env: 'LEDGERFAIL_APP_DIR', needs: null },
    { file: 'pickup-barcode-identity-test.js', env: 'PICKUPID_APP_DIR', needs: null },
    { file: 'pickup-ledger-test.js', env: 'PICKUP_APP_DIR', needs: null },
    { file: 'tx-outcome-test.js', env: 'TXOUTCOME_APP_DIR', needs: null },
    { file: 'cleanup-interrupt-atomicity-test.js', env: 'CLEANUPATOMIC_APP_DIR', needs: null }
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
        from: '        return ledgerServerVerdict(serverPromise).then((d) => {',
        to: '        return Promise.resolve(memoryApplied).then((d) => {'
    },
    {
        needs: 'RTDB emulator',
        name: 'ការ clamp ត្រូវដកចេញ (rules នឹងបដិសេធការសរសេរ)',
        from: '        if (codDollar < 0) codDollar = 0;\n        if (dodDollar < 0) dodDollar = 0;\n        if (totalCount < 0) totalCount = 0;\n        return { codDollar, dodDollar, totalCount };',
        to: '        return { codDollar, dodDollar, totalCount };'
    },
    {
        // ⛔ ថ្នាក់ ៖ ការបើក «យក» ក្លាយជា no-op ➜ លេខឡើងហើយមិនចេះចុះ។
        name: 'ស្ថិតិយក ៖ ការបើកមិនដកកូនសោ barcode ចេញពីសំណុំ',
        from: '            } else delete set[mark.key];',
        to: '            }'
    },
    {
        // ⛔ ថ្នាក់ ៖ កញ្ចក់ `pickedUpPhones` លែងដេរីវេពីសំណុំ ➜ អថេរ
        // `sum(pickedUpPhones) === packagesPickedUp` បែក។
        name: 'ស្ថិតិយក ៖ ការរាប់អតិថិជនលែងដេរីវេពីសំណុំ barcode',
        from: '            phones[phone] = (phones[phone] || 0) + 1;',
        to: '            phones[phone] = 1;'
    },
    {
        // 🔴 ថ្នាក់ ៖ ការ seed ដោយគ្មានច្រកទ្វារស្មើភាព ➜ ការ **Reset**
        // ត្រូវដកវិញដោយប្រវត្តិដែលនៅសល់ ➜ លេខលោតត្រឡប់មកវិញ។
        name: 'ស្ថិតិយក ៖ ការ seed សំណុំដោយគ្មានច្រកទ្វារស្មើភាព (Reset ត្រូវរស់ឡើងវិញ)',
        from: '        if (seed && typeof seed === \'object\' && pickupSetSize(seed) === recorded) return { ...seed };',
        to: '        if (seed && typeof seed === \'object\') return { ...seed };'
    },
    {
        // 🔴 ថ្នាក់ ៖ ថ្ងៃចាស់ដែលរាប់មិនឡើងវិញបាន ត្រូវបាត់លេខទាំងស្រុង។
        name: 'ស្ថិតិយក ៖ ថ្ងៃចាស់ដែល seed មិនត្រូវ ➜ សំណុំទទេ (លេខបាត់)',
        from: '        return legacyPickupPlaceholders(record);',
        to: '        return {};'
    },
    {
        // 🔴 ថ្នាក់ដដែលនឹង 2.26.0–2.26.2 តាមទ្វារថ្មី ៖ transaction សរសេរ
        // ចេញពី **ទិដ្ឋភាពក្នុងសតិ** ជំនួសតម្លៃដែល server ផ្តល់ ➜ ទិដ្ឋភាព
        // ចាស់របស់ឧបករណ៍មួយ សរសេរជាន់ការពិតរបស់ server។
        name: 'ស្ថិតិយក ៖ transaction សរសេរចេញពីសតិ ជំនួសតម្លៃ server',
        from: '            const set = pickupSetFromRecord((current && typeof current === \'object\') ? current : null, seed);',
        to: '            const set = pickupSetFromRecord(dailyPickupData[scanDateStr] || null, seed);'
    },
    {
        // ⛔ ថ្នាក់ ៖ ការដកវិញលែងស្តារ **ស្ថានភាពដើម** ➜ ការដកវិញក្លាយជា no-op។
        name: 'ស្ថិតិយក ៖ ការដកវិញមិនស្តារស្ថានភាពដើម',
        from: '        const marks = applied.previous.map((p) => ({ key: p.key, phoneKey: p.phoneKey, closed: !!p.closed }));',
        to: '        const marks = applied.marks;'
    },
    {
        name: 'transaction ដែលបដិសេធ `disconnect` ចាត់ទុកជា «មិនបានអនុវត្ត» (wrapper បិទ ➜ ដកលុយ ២ ដង)',
        from: "        if (!transactionOutcomeUnknown(error) || !ran || sent === undefined) throw error;",
        to: "        throw error;"
    },
    {
        name: 'ការសម្អាតក្រោយ `disconnect` មិនពិនិត្យថាឧបករណ៍ផ្សេងដកលុយរួច',
        from: "        if (result.txOutcome === 'applied') {",
        to: "        if (false) {"
    },
    {
        name: 'អ្នកស្តារ journal បញ្ចប់ការសម្អាតដែល *នៅរស់* ក្នុង tab ដដែល (ដកលុយ ២ ដង)',
        from: '        if (cleanupJournalLive.has(trashId)) return Promise.resolve(false);',
        to: ''
    },
    {
        name: 'claim registry ជឿ «ស្មើតម្លៃដែលផ្ញើ» ក្រោយ `disconnect` (barcode ស្ទួន ➜ COD បូក ២ ដង)',
        from: "            return result.txOutcome === 'applied' ? 'unknown' : 'claimed';",
        to: "            return 'claimed';"
    },
    {
        name: 'ledger ថ្ងៃលែងផ្ទុក token `op` (wrapper ច្រឡំការសរសេរតម្លៃដូចគ្នារបស់ឧបករណ៍ផ្សេង ➜ ការដកបាត់)',
        from: '            return op ? { ...serverAfter, op } : serverAfter;',
        to: '            return serverAfter;'
    },
    {
        name: 'ការដកវិញត្រូវដកចេញទាំងស្រុង',
        from: '    function revertRevenueLedgerDelta(applied) {',
        to: '    function revertRevenueLedgerDelta(applied) { return applied; }\n    function revertRevenueLedgerDeltaDead(applied) {'
    }
];

// ⛔ `--part=k/n` ៖ mutation ទី i ជារបស់ផ្នែក (i mod n) + 1 ➜ ផ្នែកទាំង n រួមគ្នា = mutation ទាំងអស់ (តាមរចនាសម្ព័ន្ធ) ·
//    អ្នកយាមលើ tree ស្អាតរត់គ្រប់ផ្នែក (លក្ខខណ្ឌចាំបាច់)។ មូលហេតុ ៖ runner GitHub (CPU ២ + lane browser ស្របគ្នា) ចំណាយ > ៣០០ វិ.
//    លើការរត់ពេញ (run 480 ផ្នែក ២/៤ ៖ «ព្យួរ — លើសពិដាន 300s») ⛔ មិនមែនបង្កើន CHECKER_TIMEOUT
const PART = (() => {
    const arg = process.argv.slice(2).find((a) => a.startsWith('--part'));
    if (!arg) return { k: 1, n: 1 };
    const m = /^--part=(\d+)\/(\d+)$/.exec(arg);
    if (!m || +m[2] < 1 || +m[2] > MUTATIONS.length || +m[1] < 1 || +m[1] > +m[2]) return null;
    return { k: +m[1], n: +m[2] };
})();
const MINE = PART ? MUTATIONS.filter((_, i) => i % PART.n === PART.k - 1) : [];

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
    return new Promise((resolve) => {
        execFile(process.execPath, [path.join(__dirname, guard.file)],
            { env, encoding: 'utf8', timeout: 240000, maxBuffer: 64 * 1024 * 1024 },
            (err, stdout, stderr) => {
                if (!err) { resolve({ code: 0, out: stdout || '' }); return; }
                resolve({ code: typeof err.code === 'number' ? err.code : 1, out: (stdout || '') + (stderr || '') });
            });
    });
}

// ⛔ អ្នកយាមរត់ **ស្របគ្នា** (`MONEYGUARD_JOBS` · លំនាំដើម ≤ ៤) ៖ ៨ អ្នកយាម × (១ + mutation)
// ការរត់ជាលំដាប់លើសពិដាន ៣០០ វិ. របស់ `run-all.sh` ➜ «ព្យួរ» ក្លែងក្លាយ។ អ្នកយាមនីមួយៗ
// ឯករាជ្យ (emu namespace តាម pid · គ្មាន port ថេរ) ➜ លំដាប់លទ្ធផលនៅតាម mutation ដដែល។
const JOBS = Math.max(1, Math.min(8, parseInt(process.env.MONEYGUARD_JOBS || '', 10) || Math.min(4, os.cpus().length || 1)));
function runPool(tasks) {
    const results = new Array(tasks.length);
    let next = 0;
    const worker = async () => {
        while (next < tasks.length) {
            const i = next++;
            results[i] = await tasks[i]();
        }
    };
    const workers = [];
    for (let i = 0; i < Math.min(JOBS, tasks.length); i++) workers.push(worker());
    return Promise.all(workers).then(() => results);
}

function finish() {
    console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' (ok ' + pass + ')' : '✅ គ្មានបញ្ហា — ok ' + pass));
    process.exit(fail ? 1 : 0);
}

(async () => {
// ⛔ ក្នុងការរត់ជាកូន (ពុល) របស់ `exit-code-integrity` ការអះអាងទាំងអស់ធ្លាក់រួចហើយ ➜ អ្វីដែលត្រូវវាស់មានតែផ្លូវ
// «ធ្លាក់ ➜ exit ≠ 0» ដែល `finish()` ជាអ្នកកាន់។ ការរត់អ្នកយាម × mutation ពេញ (~១៥០ វិ.) មិនអាចចប់ក្នុងថវិកា ៦០ វិ.
// របស់កូន ➜ ជំនាន់មុនរបស់ `exit-code-integrity` រាប់ការផុតម៉ោងនោះជា «ត្រឹមត្រូវ» ហើយវាជាផ្នែកធំជាងគេនៃការរត់ ២៨០–៣៦៧ វិ.
// ⛔ របៀបនេះ **មិនដែលបៃតង** (ok(false)) ➜ បើ `EXITCODE_CHILD` លេចចូលការរត់ធម្មតា វាក្រហម មិនមែនរំលងដោយស្ងាត់។
if (process.env.EXITCODE_CHILD) {
    ok(false, '⛔ EXITCODE_CHILD ៖ រំលងអ្នកយាម និង mutation (វាស់តែផ្លូវ exit) — របៀបនេះមិនដែលបៃតង');
    finish();
}
if (!PART) {
    ok(false, '⛔ --part ត្រូវជា k/n (1 ≤ k ≤ n ≤ ' + MUTATIONS.length + ')', process.argv.slice(2).join(' '));
    finish();
}
if (PART.n > 1) {
    console.log('  ផ្នែក ' + PART.k + '/' + PART.n + ' ៖ mutation ' + MINE.length + ' ក្នុង ' + MUTATIONS.length);
    let runall = '';
    try { runall = fs.readFileSync(path.join(__dirname, 'run-all.sh'), 'utf8').replace(/^\s*#.*$/gm, ''); } catch (e) {}
    const listed = [];
    for (let k = 1; k <= PART.n; k++) {
        if (new RegExp('node\\s+audit-tools/money-guardian-test\\.js\\s+--part=' + k + '/' + PART.n + '(?=\\s|$)', 'm').test(runall)) listed.push(k);
    }
    ok(listed.length === PART.n, '⛔ run-all.sh រត់ផ្នែកទាំង ' + PART.n + ' (ផ្នែកដែលបាត់ = mutation ដែលគ្មាននរណាវាស់)', 'ឃើញ ' + listed.join(','));
}
// ⛔ ជាន់ចាំបាច់ ៖ អ្នកយាមត្រូវ **បៃតងលើ tree ស្អាត** បើមិនដូច្នេះ «ក្រហម
// លើ mutant» គ្មានន័យទេ (វាក្រហមជានិច្ច)។
const alive = [];
const absent = new Set();
const cleanRuns = await runPool(GUARDS.map((g) => () => runGuard(g, ROOT)));
GUARDS.forEach((g, i) => {
    const r = cleanRuns[i];
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

const mutants = MINE.map((m) => ({ m, dir: buildMutant(m) }));
const tasks = [];
mutants.forEach((entry, mi) => {
    if (!entry.dir) return;
    alive.forEach((g) => tasks.push({ mi, g, run: () => runGuard(g, entry.dir) }));
});
const verdicts = await runPool(tasks.map((t) => t.run));
const caughtBy = mutants.map(() => []);
tasks.forEach((t, i) => { if (verdicts[i].code !== 0) caughtBy[t.mi].push(t.g.file); });

let applicable = 0;
mutants.forEach(({ m, dir }, mi) => {
    if (!dir) {
        ok(false, '⛔ mutation មិនអាចចាក់បាន (កូដប្រែរូបរាង?): ' + m.name,
            'ខ្សែអក្សរយុថ្កាលែងមានក្នុង app.js ➜ ការវាស់នេះមិនបានវាស់អ្វីទេ');
        return;
    }
    applicable++;
    const caught = caughtBy[mi];
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
ok(MINE.length > 0 && applicable === MINE.length, '⛔ ជាន់អប្បបរមា៖ mutation ទាំង ' + MINE.length + ' (ផ្នែក ' + PART.k + '/' + PART.n + ') ចាក់បានពិត', 'ចាក់បាន ' + applicable);

// ⛔ រាល់កំហុសក្នុងផ្លូវលុយ ត្រូវ **ជូនដំណឹងបាន** ៖ Sentry alert rule ស្វែងរក
// បានតែលើ **tag** ➜ `ZoeErrors.capture()` ក្នុង function លុយត្រូវបញ្ជូន
// `zone: 'money'`។ បើគ្មានវា កំហុសលុយដេកក្នុង dashboard ដោយគ្មាននរណាដឹង —
// ដែលស្មើនឹងគ្មានការរាយការណ៍សោះសម្រាប់ប្រព័ន្ធដែលមានអ្នកប្រើតែម្នាក់។
if (PART.k === 1) {
    let acorn = null;
    try { acorn = require('acorn'); } catch (e) {}
    if (!acorn) {
        ok(false, '⛔ ការត្រួតពិនិត្យ zone ត្រូវការ acorn — វាស់មិនបាន ≠ ត្រឹមត្រូវ', 'npm i acorn');
    } else {
        const MONEY_FNS = new Set(['armLateCommit', 'claimAndCleanupItem', 'commitDailyRevenueDelta',
            'commitMonthlyRevenueDelta', 'alignMonthlyLedgerToDaily', 'executeRestoreItem', 'removeSingleBarcode', 'repairPickupLedgerOnce',
            'resetPickupStats', 'saveEditedBarcodePrice', 'toggleCloseStatus', 'toggleIndividualBarcodeClose']);
        const src = fs.readFileSync(APP, 'utf8');
        const ast = acorn.parse(src, { ecmaVersion: 2022, locations: true });
        const stack = [];
        const inMoney = [];
        const outside = [];
        (function walk(node) {
            if (!node || typeof node !== 'object') return;
            if (Array.isArray(node)) { node.forEach(walk); return; }
            let pushed = false;
            if ((node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression') && node.id) {
                stack.push(node.id.name); pushed = true;
            }
            if (node.type === 'CallExpression' && node.callee && node.callee.type === 'MemberExpression'
                && node.callee.object && node.callee.object.name === 'ZoeErrors'
                && node.callee.property && node.callee.property.name === 'capture') {
                let zone = null;
                const arg = node.arguments[1];
                if (arg && arg.type === 'ObjectExpression') {
                    for (const prop of arg.properties) {
                        const key = prop.key && (prop.key.name || prop.key.value);
                        if (key === 'zone' && prop.value && prop.value.type === 'Literal') zone = prop.value.value;
                    }
                }
                const fn = stack.length ? stack[stack.length - 1] : '(top)';
                const rec = { fn: fn, zone: zone, line: node.loc.start.line };
                if (MONEY_FNS.has(fn)) inMoney.push(rec); else outside.push(rec);
            }
            for (const k of Object.keys(node)) {
                if (k === 'loc' || k === 'start' || k === 'end') continue;
                const v = node[k];
                if (Array.isArray(v)) v.forEach(walk);
                else if (v && typeof v.type === 'string') walk(v);
            }
            if (pushed) stack.pop();
        })(ast);

        const MIN_MONEY_CAPTURES = 18;
        ok(inMoney.length >= MIN_MONEY_CAPTURES,
            '⛔ ជាន់អប្បបរមា៖ capture ក្នុង function លុយ >= ' + MIN_MONEY_CAPTURES,
            'រកឃើញ ' + inMoney.length + ' — ការប្តូរឈ្មោះ function ធ្វើឲ្យការត្រួតពិនិត្យនេះទទេ');
        const missing = inMoney.filter((r) => r.zone !== 'money');
        ok(missing.length === 0, '⛔ រាល់ capture ក្នុងផ្លូវលុយ ផ្ទុក `zone: \'money\'` (alert rule ស្វែងរកបាន)',
            missing.map((r) => r.fn + ':' + r.line + ' zone=' + JSON.stringify(r.zone)).join('\n        '));
        ok(outside.some((r) => r.zone !== 'money'),
            '⛔ ទិសផ្ទុយ៖ មិនត្រូវដាក់ `money` លើអ្វីៗទាំងអស់ (alert ដែលបន្លឺគ្រប់ពេល = គ្មាន alert)');
    }
}

finish();
})().catch((e) => { console.log('  FAIL  money-guardian បោះ: ' + (e && e.stack || e)); process.exit(1); });
