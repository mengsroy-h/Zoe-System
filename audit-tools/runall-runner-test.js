// ⛔ ថ្នាក់កំហុស ៖ **ម៉ាស៊ីនរត់ `run-all.sh` ខ្លួនវា**។
//
// `run-all.sh` ជា CI តែមួយគត់ដែលនៅសល់ (កូតា GitHub Actions អស់) ហើយវារត់ checker ១៨០+ ។
// វាស់បាន (2026-09-28 · 4 CPU) ៖ ការរត់ពេញជាជួរ ~១៤៤៥ វិ. (២៤ នាទី) ➜ session ដែលអស់កូតាកណ្តាលទី
// **បាត់លទ្ធផលទាំងមូល** ហើយម្ចាស់គម្រោងត្រូវផ្គុំ log មួយផ្នែកៗដោយដៃ។ ម៉ាស៊ីនរត់ថ្មីមានកិច្ចសន្យា ៖
//   ១. lane ស្របគ្នាមានព្រំដែន (RUNALL_JOBS) — emu/* ម្តងមួយ · checker meta ដែលសរសេរ/បោស `.tmp-poison-*`
//      រត់ម្នាក់ឯង · browser មានពិដានដាច់ (RUNALL_BROWSER_JOBS)
//   ២. output **តាមលំដាប់បញ្ជីជានិច្ច** ទោះ checker ចប់តាមលំដាប់ណាក៏ដោយ
//   ៣. ពេលវេលាក្នុងមួយ checker · សេចក្តីសង្ខេបរាយឈ្មោះ FAIL/PARTIAL/SKIPPED · ១០ យឺតជាងគេ
//   ៤. RUNALL_STATE (១ បន្ទាត់/checker ភ្លាមពេលចប់) · RUNALL_RESUME=1 (តែធ្លាក់/បាត់ · tree ដដែល) ·
//      RUNALL_ONLY (ឈ្មោះមិនស្គាល់ ➜ បដិសេធ មិនមែនបៃតងទទេ)
//   ៥. ការរំខាន (TERM) បញ្ឈប់ checker ដែលកំពុងរត់ — មិនបន្សល់ process កំព្រា
// ⛔ ការវាស់ជា **ឥរិយាបថ** ៖ ស្រង់ប្លុក `#@runner-begin`…`#@runner-end` ពិតពី `run-all.sh` ទៅរត់ជាមួយ
//    checker ក្លែង (ដេក · ធ្លាក់ · SKIP · ព្យួរ) ដែលកត់ start/end ចូល log ➜ ភាពស្របគ្នាវាស់ពី **ចន្លោះពេល
//    ជាន់គ្នាពិត** មិនមែនពីពាក្យក្នុង script។ tree ចាស់ (`run()` ជាជួរ) ➜ ស្រង់ `run()` ជំនួស ➜ ឯកសារនេះ
//    **ធ្លាក់ដោយឥរិយាបថ** (ស្របគ្នា ១ · គ្មាន state) មិនមែនត្រឹម «រកសញ្ញាមិនឃើញ»។
// ⛔ lane ដេរីវេពីប្រភព ៖ ផ្នែក ៦ ផ្ទៀងថា lane នៃបញ្ជី **ពិត** ត្រូវនឹងភស្តុតាងក្នុងប្រភព checker
//    (អ្នកសរសេរ/បោស `.tmp-poison-*` ➜ excl · អ្នកប្រើ emulator ➜ emu · `chromium.launch(` ➜ browser)
//    ទាំង ២ ទិស ➜ បញ្ជីលើកលែងក្នុង `runall_lane()` មិនអាចចាស់ស្ងាត់ៗបាន។
'use strict';
process.exitCode = 1;

const fs = require('fs');
const path = require('path');
const os = require('os');
const cp = require('child_process');

const ROOT = path.resolve(process.env.RUNALLRUNNER_APP_DIR || path.join(__dirname, '..'));
const RUNALL = path.join(ROOT, 'audit-tools', 'run-all.sh');
// ⛔ សញ្ញាទាំង ២ ផ្គុំពីបំណែក ៖ ឯកសារនេះមិនបើក browser និងមិនប្រើ emulator ➜ ផ្នែក ៦ មិនត្រូវចាត់វាខុស lane
const BROWSER_MARK = 'chromium' + '.launch(';
const EMU = 'audit-tools/' + 'emu/';

let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { pass++; console.log('  ok    ' + label); }
    else {
        fail++;
        console.log('  FAIL  ' + label + (detail !== undefined
            ? '\n        ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)).split('\n').join('\n        ')
            : ''));
    }
}

let runall = '';
try { runall = fs.readFileSync(RUNALL, 'utf8'); } catch (e) { runall = ''; }
ok('ជាន់អប្បបរមា ៖ អាន audit-tools/run-all.sh បាន', runall.length > 1000, RUNALL);

// ── ប្លុកម៉ាស៊ីនរត់ ─────────────────────────────────────────────────────────────────────────────
const blockAt = runall.search(/^#@runner-begin$/m);
const blockEnd = runall.search(/^#@runner-end$/m);
let block = '';
if (blockAt !== -1 && blockEnd > blockAt) block = runall.slice(blockAt, blockEnd) + '\n';
else if (/^run\(\) \{/m.test(runall)) {
    const runFn = runall.slice(runall.search(/^run\(\) \{/m));
    block = runFn.slice(0, runFn.indexOf('\n}\n') + 3);
}
ok('រកឃើញម៉ាស៊ីនរត់ចន្លោះ `#@runner-begin` / `#@runner-end`', blockAt !== -1 && blockEnd > blockAt);

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'zoe-runall-runner-'));
process.on('exit', () => { try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {} });
let caseNo = 0;

// checker ក្លែង ៖ កត់ «start/end <ឈ្មោះ> <ms> <pid>» ចូល FX_LOG · ដេក ms · បោះពុម្ព out · ចេញ code
function fixture(dir, rel, opts) {
    const o = Object.assign({ ms: 0, code: 0, out: ['   ok    ' + rel], hang: false, browser: false, envProbe: false }, opts || {});
    const name = JSON.stringify(rel);
    const lines = [
        "const fs = require('fs');",
        o.browser ? '// ' + BROWSER_MARK + ' — សញ្ញា lane browser (មិនបើក browser ពិតទេ)' : '',
        "const log = (w) => fs.appendFileSync(process.env.FX_LOG, w + ' ' + " + name + " + ' ' + Date.now() + ' ' + process.pid + '\\n');",
        "log('start');",
        o.ownedProbe ? "if(!process.env.FX_OWNED_SCOPE){console.log('FAIL missing owned fixture');process.exit(1);}fs.appendFileSync(process.env.FX_LOG+'.owners',JSON.stringify({owner:process.env.FX_OWNED_SCOPE})+'\\n');" : '',
        o.envProbe ? "fs.writeFileSync(process.env.FX_LOG + '.env', JSON.stringify(Object.keys(process.env).filter((k) => /^RUNALL_(SHARD|ONLY|RESUME)$/.test(k))));" : ''
    ];
    if (o.hang) lines.push('setInterval(() => {}, 1 << 30);');
    else {
        lines.push('setTimeout(() => {');
        for (const l of o.out) lines.push('    console.log(' + JSON.stringify(l) + ');');
        if (o.dependencyEnv) lines.push('    if (!process.env[' + JSON.stringify(o.dependencyEnv) + ']) console.log("SKIP dependency unavailable");' +
            (o.out.length === 0 ? ' else console.log("  ok    dependency available");' : ''));
        lines.push("    log('end');", '    process.exit(' + o.code + ');', '}, ' + o.ms + ');');
    }
    const file = path.join(dir, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, lines.join('\n') + '\n');
}

function newCase(fixtures) {
    const dir = path.join(TMP, 'c' + (++caseNo));
    fs.mkdirSync(path.join(dir, 'audit-tools', 'emu'), { recursive: true });
    for (const [rel, opts] of fixtures) fixture(dir, rel, opts);
    return dir;
}

// ⛔ env ស្អាត ៖ checker នេះរត់ជាកូនរបស់ run-all ពិត ➜ RUNALL_STATE/RUNALL_ONLY/RUNALL_RESUME ពិតមិនត្រូវ
//    លេចចូល harness (បើមិនដូច្នេះ fixture សរសេរចូល state ពិត ឬត្រូវត្រងចោល)
function harnessEnv(dir, extra) {
    const env = Object.assign({}, process.env);
    for (const k of Object.keys(env)) if (/^RUNALL_/.test(k)) delete env[k];
    return Object.assign(env, { FX_LOG: path.join(dir, 'fx.log'), RUNALL_STATE: '' }, extra || {});
}

function privateOwnedFixture(dir) {
    const file = path.join(dir, 'owned-fixture.cjs');
    fs.writeFileSync(file, "const fs=require('fs'),cp=require('child_process');const result=cp.spawnSync(process.argv[2],process.argv.slice(3),{stdio:'inherit',env:{...process.env,FX_OWNED_SCOPE:String(process.pid)}});process.exitCode=result.status===null?1:result.status;\n");
    return '\nrunall_prepare_command() { RUNALL_COMMAND=("$@"); if runall_needs_rtdb "$@"; then RUNALL_COMMAND=(node ' + JSON.stringify(file) + ' "$@"); fi; }\n';
}
function writeHarness(dir, body, timeoutSecs) {
    const h = path.join(dir, 'harness.sh');
    fs.writeFileSync(h,
        'pass=0; fail=0; skip=0; partial=0\n' +
        'CHECKER_TIMEOUT=' + (timeoutSecs || 30) + '\n' +
        'if command -v timeout >/dev/null 2>&1; then HAS_TIMEOUT=1; else HAS_TIMEOUT=0; fi\n' +
        block + '\n' + privateOwnedFixture(dir) + body + '\n' +
        'if declare -F runall_drain >/dev/null; then runall_drain || exit $?; fi\n' +
        'if declare -F runall_cleanup_owned >/dev/null; then runall_cleanup_owned; fi\n' +
        'if declare -F runall_summary >/dev/null; then runall_summary; fi\n' +
        'if declare -F runall_exit_status >/dev/null; then runall_exit_status; exit $?; fi\n' +
        'exit "$fail"\n');
    return h;
}

function runHarness(dir, body, extraEnv, timeoutSecs) {
    try { fs.rmSync(path.join(dir, 'fx.log'), { force: true }); } catch (e) {}
    const h = writeHarness(dir, body, timeoutSecs);
    const t0 = Date.now();
    const r = cp.spawnSync('bash', [h], { cwd: dir, env: harnessEnv(dir, extraEnv), encoding: 'utf8', timeout: 90000 });
    return { rc: r.status, out: String(r.stdout || '') + String(r.stderr || ''), ms: Date.now() - t0, events: readLog(dir) };
}

function readLog(dir) {
    let text = '';
    try { text = fs.readFileSync(path.join(dir, 'fx.log'), 'utf8'); } catch (e) { return []; }
    return text.split('\n').filter(Boolean).map((l) => {
        const [kind, name, at, pid] = l.split(' ');
        return { kind, name, at: Number(at), pid: Number(pid) };
    });
}

// ចន្លោះពេល [start,end] ក្នុងមួយ fixture ➜ ចំនួនជាន់គ្នាអតិបរមា (តាម predicate)
function intervals(events) {
    const map = new Map();
    for (const e of events) {
        const cur = map.get(e.name) || { name: e.name };
        if (e.kind === 'start') cur.start = e.at;
        if (e.kind === 'end') cur.end = e.at;
        map.set(e.name, cur);
    }
    return [...map.values()].filter((x) => x.start !== undefined);
}
function maxOverlap(events, pick) {
    const pts = [];
    for (const iv of intervals(events)) {
        if (pick && !pick(iv.name)) continue;
        pts.push([iv.start, 1], [iv.end === undefined ? Infinity : iv.end, -1]);
    }
    pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    let cur = 0, max = 0;
    for (const [, d] of pts) { cur += d; max = Math.max(max, cur); }
    return max;
}
function started(events) { return new Set(events.filter((e) => e.kind === 'start').map((e) => e.name)); }
function checkerLines(out) {
    return out.split('\n').filter((l) => /^ {2}\S/.test(l) && !/^ {2}(ok|FAIL) /.test(l));
}
function stripTime(line) { return line.replace(/\s+(?:\d+\.\ds|—)\s{2}/, '  ').replace(/\s+/g, ' ').trim(); }

// ═══ ១. ស្របគ្នាពិត · លំដាប់ output ស្ថិតស្ថេរ · ពេលវេលា · សេចក្តីសង្ខេប ═══
console.log('=== ១. lane ស្របគ្នា ➜ output តាមលំដាប់បញ្ជី · ពេលក្នុងមួយ checker · សេចក្តីសង្ខេប ===');
const SLEEPS = [1300, 900, 800, 700, 600, 500, 400, 300, 200, 100, 50, 0];
const c1 = newCase(SLEEPS.map((ms, i) => ['audit-tools/fx-' + String(i).padStart(2, '0') + '.js',
    i === 4 ? { ms, code: 1, out: ['  FAIL  ក្លែង'] }
        : i === 7 ? { ms, out: ['   ok    a', 'SKIP គ្មាន emulator'] }
            : i === 9 ? { ms, out: ['SKIP គ្មាន browser'] }
                : { ms, out: ['   ok    a', '   ok    b'] }]));
const body1 = 'section "== ក្រុម ក =="\n' +
    'for t in fx-00 fx-01 fx-02 fx-03 fx-04 fx-05; do run "$t" node "audit-tools/$t.js"; done\n' +
    'section "== ក្រុម ខ =="\n' +
    SLEEPS.slice(6).map((_, k) => { const t = 'fx-' + String(k + 6).padStart(2, '0'); return 'run "' + t + '" node audit-tools/' + t + '.js'; }).join('\n');
const par = runHarness(c1, body1, { RUNALL_JOBS: '4', RUNALL_BROWSER_JOBS: '2' });
const seq = runHarness(c1, body1, { RUNALL_JOBS: '1' });
const sumSleep = SLEEPS.reduce((a, b) => a + b, 0);
const parOverlap = maxOverlap(par.events);
ok('⛔ RUNALL_JOBS=4 ➜ checker រត់ជាន់គ្នាពិត ៤ (វាស់ពីចន្លោះ start/end · ឃើញ ' + parOverlap + ')',
    parOverlap === 4, { overlap: parOverlap, events: par.events.length });
ok('⛔ ពេលរត់ស្របគ្នា < ៦០% នៃផលបូកពេលដេក (' + par.ms + 'ms ធៀប ' + sumSleep + 'ms)',
    par.ms < sumSleep * 0.6, { par: par.ms, sum: sumSleep });
const seqOverlap = maxOverlap(seq.events);
ok('RUNALL_JOBS=1 ➜ ជាជួរពិត (ជាន់គ្នាអតិបរមា ១ · ឃើញ ' + seqOverlap + ')', seqOverlap === 1 && seq.events.length >= 24,
    { overlap: seqOverlap, events: seq.events.length });
const names = SLEEPS.map((_, i) => 'fx-' + String(i).padStart(2, '0'));
const parOrder = checkerLines(par.out).map((l) => l.trim().split(/\s+/)[0]).filter((n) => names.includes(n));
ok('⛔ output តាមលំដាប់បញ្ជី ទោះ checker ចប់ក្រោយគេនៅខាងមុខ', JSON.stringify(parOrder) === JSON.stringify(names), parOrder);
const endOrder = par.events.filter((e) => e.kind === 'end').map((e) => e.name);
ok('probe ៖ ការវាស់លំដាប់មានន័យ — fx-00 (ដំបូងក្នុងបញ្ជី) ពិតជាចប់ក្រោយ fx-01 · fx-02 · fx-03',
    endOrder.length >= 10 && ['audit-tools/fx-01.js', 'audit-tools/fx-02.js', 'audit-tools/fx-03.js']
        .every((n) => endOrder.indexOf(n) !== -1 && endOrder.indexOf(n) < endOrder.indexOf('audit-tools/fx-00.js')), endOrder);
const hdrA = par.out.indexOf('== ក្រុម ក =='), hdrB = par.out.indexOf('== ក្រុម ខ ==');
ok('ក្បាលផ្នែកឈរត្រូវកន្លែង (ក មុន fx-00 · ខ ចន្លោះ fx-05 និង fx-06)',
    hdrA !== -1 && hdrA < par.out.indexOf('  fx-00 ') && par.out.indexOf('  fx-05 ') < hdrB && hdrB < par.out.indexOf('  fx-06 '),
    { hdrA, hdrB });
const parLines = checkerLines(par.out).filter((l) => names.includes(l.trim().split(/\s+/)[0]));
const seqLines = checkerLines(seq.out).filter((l) => names.includes(l.trim().split(/\s+/)[0]));
ok('output ស្របគ្នា ≡ output ជាជួរ (លើកលែងជួរពេល)',
    parLines.length === 12 && JSON.stringify(parLines.map(stripTime)) === JSON.stringify(seqLines.map(stripTime)),
    { par: parLines.map(stripTime), seq: seqLines.map(stripTime) });
ok('ជួរ checker នីមួយៗមានពេលវេលា (ឧ. «1.8s»)', parLines.length === 12 && parLines.every((l) => /\s\d+\.\ds\s{2}/.test(l)),
    parLines.slice(0, 3));
const want = { 'fx-00': 'PASS  (2)', 'fx-04': '*** FAIL ***', 'fx-07': 'PARTIAL PASS (1; SKIP គ្មាន emulator)', 'fx-09': 'SKIPPED (គ្មាន browser)' };
const verdictOk = Object.entries(want).every(([n, v]) => parLines.some((l) => l.trim().startsWith(n) && l.includes(v)));
ok('សាលក្រមដូច run() ជំនាន់មុន (PASS (n) · PARTIAL PASS · SKIPPED · *** FAIL ***)', verdictOk, parLines);
ok('FAIL បង្ហាញ output របស់ checker (ចូលបន្ទាត់)', /\*\*\* FAIL \*\*\*\n {6}\s*FAIL {2}ក្លែង/.test(par.out),
    par.out.slice(0, 600));
ok('exit code = ចំនួន FAIL (១)', par.rc === 1 && seq.rc === 1, { par: par.rc, seq: seq.rc });
ok('សេចក្តីសង្ខេបរាយឈ្មោះ ❌/◐/⊘', /❌ ធ្លាក់ \(1\) ៖ fx-04/.test(par.out) && /◐ មួយផ្នែក \(1\) ៖ fx-07/.test(par.out)
    && /⊘ រំលង \(1\) ៖ fx-09/.test(par.out), par.out.split('===')[par.out.split('===').length - 1]);
const slowAt = par.out.indexOf('យឺតជាងគេ');
const slow = slowAt === -1 ? [] : par.out.slice(slowAt).split('\n').slice(1)
    .filter((l) => /^\s+\d+\.\ds\s{2}\S/.test(l)).map((l) => l.trim().split(/\s+/));
const slowMs = slow.map((p) => Math.round(parseFloat(p[0]) * 1000));
ok('១០ យឺតជាងគេ ៖ ១០ ជួរ · តម្រៀបចុះ · fx-00 នៅលើគេ', slow.length === 10 && slow[0][1] === 'fx-00'
    && slowMs.every((v, k) => k === 0 || slowMs[k - 1] >= v), slow);
ok('បន្ទាត់ចុងក្រោយរក្សាទម្រង់ដើម («❌ ធ្លាក់ N  (ជោគជ័យ …)»)',
    /\n❌ ធ្លាក់ 1 {2}\(ជោគជ័យ 9, មួយផ្នែក 1, រំលង 1\)\s*$/.test(par.out), par.out.slice(-200));

const incomplete = newCase([
    ['audit-tools/fx-pass.js', {}],
    ['audit-tools/fx-skip.js', { out: [], dependencyEnv: 'FX_DEPENDENCY_READY' }],
    ['audit-tools/fx-partial.js', { dependencyEnv: 'FX_DEPENDENCY_READY' }]
]);
const incompleteBody = ['pass', 'skip', 'partial'].map((name) => 'run "fx-' + name + '" node audit-tools/fx-' + name + '.js').join('\n');
const incompleteState = path.join(incomplete, 'state.tsv');
const unavailable = runHarness(incomplete, incompleteBody, { RUNALL_STATE: incompleteState, RUNALL_TREE_HASH: 'dependency-boundary' });
ok('⛔ SKIPPED/PARTIAL ដោយគ្មាន FAIL នៅតែមិនពេញលេញ — គ្មានស្លាកបៃតង «ទាំងអស់»',
    unavailable.rc === 0 && /◐ មួយផ្នែក \(1\)/.test(unavailable.out) && /⊘ រំលង \(1\)/.test(unavailable.out)
    && /⚠️[^\n]*មិនពេញលេញ/.test(unavailable.out) && !/✅|ជោគជ័យទាំងអស់/.test(unavailable.out), unavailable.out.slice(-600));
for (const name of ['skip', 'partial']) {
    const singleBody = 'run "fx-' + name + '" node audit-tools/fx-' + name + '.js';
    for (const selected of [false, true]) {
        const one = runHarness(incomplete, selected ? incompleteBody : singleBody, selected ? { RUNALL_ONLY: 'fx-' + name } : {});
        ok('⛔ ' + name + ' តែមួយ (' + (selected ? 'RUNALL_ONLY' : 'ពេញបញ្ជី') + ') ក៏ត្រូវរាយមិនពេញលេញ',
            one.rc === 0 && /⚠️[^\n]*មិនពេញលេញ/.test(one.out) && !/✅|ជោគជ័យទាំងអស់/.test(one.out), one.out.slice(-300));
    }
}
const available = runHarness(incomplete, incompleteBody, {
    RUNALL_STATE: incompleteState, RUNALL_TREE_HASH: 'dependency-boundary', RUNALL_RESUME: '1', FX_DEPENDENCY_READY: '1'
});
ok('⛔ dependency មកវិញ ៖ RESUME រត់ SKIPPED និង PARTIAL ឡើងវិញ ហើយរក្សាតែ PASS',
    JSON.stringify([...started(available.events)].sort()) === JSON.stringify(['audit-tools/fx-partial.js', 'audit-tools/fx-skip.js'])
    && /↺ យកពី state មុន 1 · រត់ក្នុងជុំនេះ 2/.test(available.out), available.out.slice(-600));
ok('ទិសផ្ទុយ ៖ checker គ្រប់វាស់ពេញលេញ ទើបប្រកាសជោគជ័យទាំងអស់',
    available.rc === 0 && /✅ ជោគជ័យទាំងអស់[^\n]*3 ពេញលេញ, 0 មួយផ្នែក, រំលង 0/.test(available.out), available.out.slice(-300));

// ⛔ ការចេញ 0 មិនអាចលាក់ FAIL · output ទទេ · SKIP មានចន្លោះបានទេ។
const falseGreen = newCase([
    ['audit-tools/fx-empty.js', { out: [] }],
    ['audit-tools/fx-cross.js', { out: ['  ❌ ក្លែង'] }],
    ['audit-tools/fx-mention.js', { out: ['  ok    រាយពាក្យ FAIL និង ❌ តែមិនមែនសាលក្រមធ្លាក់'] }],
    ['audit-tools/fx-false-green.js', { out: ['  FAIL  ក្លែង', '   ok    ក្លែង'] }],
    ['audit-tools/fx-indented-skip.js', { out: ['  SKIP គ្មាន dependency'] }]
]);
for (const name of ['empty', 'false-green', 'cross']) {
    const r = runHarness(falseGreen, 'run "fx-' + name + '" node audit-tools/fx-' + name + '.js');
    ok('⛔ exit 0 ប៉ុន្តែ ' + name + ' ត្រូវ FAIL', r.rc !== 0 && /FAIL/.test(r.out), r.out);
}
const mentionedFailure = runHarness(falseGreen, 'run \"fx-mention\" node audit-tools/fx-mention.js');
ok('ទិសផ្ទុយ ៖ ពាក្យ FAIL/❌ ក្នុងការអះអាងដែលជោគជ័យ មិនមែន FAIL', mentionedFailure.rc === 0 && /PASS/.test(mentionedFailure.out), mentionedFailure.out);
const indentedSkip = runHarness(falseGreen, 'run "fx-indented-skip" node audit-tools/fx-indented-skip.js');
ok('⛔ SKIP មានចន្លោះខាងមុខ មិនមែន PASS', /SKIPPED/.test(indentedSkip.out) && !/✅/.test(indentedSkip.out), indentedSkip.out);
const strictSkip = runHarness(falseGreen, 'run "fx-indented-skip" node audit-tools/fx-indented-skip.js', { RUNALL_STRICT: '1' });
ok('⛔ RUNALL_STRICT=1 ៖ dependency មិនបានវាស់ ត្រូវ exit មិនសូន្យ', strictSkip.rc !== 0, strictSkip.out);
const stablePlan = newCase([['audit-tools/fx-plan.js', {}]]);
const stableBody = 'if [ "$FX_SKIP" = 1 ]; then skipm "fx-plan"; else run "fx-plan" node audit-tools/fx-plan.js; fi\n' +
    'printf "IDENTITY=%s LANE=%s\\n" "${J_ID[0]}" "${J_LANE[0]}"';
const planReady = runHarness(stablePlan, stableBody);
const planMissing = runHarness(stablePlan, stableBody, { FX_SKIP: '1' });
ok('⛔ dependency បាត់មិនប្តូរអត្តសញ្ញាណ ឬ lane សម្រាប់ shard',
    /IDENTITY=fx-plan LANE=any/.test(planReady.out) && /IDENTITY=fx-plan LANE=any/.test(planMissing.out), { ready: planReady.out, missing: planMissing.out });

const hashFunction = runall.slice(runall.indexOf('runall_tree_hash() '), runall.indexOf('zoe_build_audit() {'));
ok('⛔ ស្រង់ hash function ពិតបាន', hashFunction.startsWith('runall_tree_hash() ') && hashFunction.includes('sha1sum'));
const hashRepo = fs.mkdtempSync(path.join(TMP, 'hash-'));
cp.spawnSync('git', ['init', '-q'], { cwd: hashRepo });
fs.writeFileSync(path.join(hashRepo, 'tracked'), 'guard');
cp.spawnSync('git', ['add', 'tracked'], { cwd: hashRepo });
const hashReady = cp.spawnSync('bash', ['-c', hashFunction + '\nrunall_tree_hash \"$1\"', '_', hashRepo], { encoding: 'utf8' });
ok('ទិសផ្ទុយ ៖ hash tree ដែលអានបាន ចេញ 0 និង hash', hashReady.status === 0 && /^[a-f0-9]{16}\s*$/.test(hashReady.stdout), hashReady);
fs.rmSync(path.join(hashRepo, 'tracked'));
const hashMissing = cp.spawnSync('bash', ['-c', hashFunction + '\nrunall_tree_hash "$1"', '_', hashRepo], { encoding: 'utf8' });
ok('⛔ hash អាន tracked file មិនបាន ត្រូវបដិសេធ មិនអាច RESUME លើភស្តុតាងខ្វះ', hashMissing.status === 1, hashMissing);
const copyFunction = runall.slice(runall.indexOf('zoe_measure_root() '), runall.indexOf('runall_tree_hash() '));
ok('⛔ ស្រង់ copy function ពិតបាន', copyFunction.startsWith('zoe_measure_root() ') && copyFunction.includes('tar -xf'));
const copyRepo = fs.mkdtempSync(path.join(TMP, 'copy-'));
fs.mkdirSync(path.join(copyRepo, 'ZoeW', 'dist-audit', 'ZoeW'), { recursive: true });
fs.writeFileSync(path.join(copyRepo, 'present'), 'guard');
const copyMissing = cp.spawnSync('bash', ['-c', copyFunction +
    '\ngit() { printf "present\\0missing\\0"; }; export ZOE_NODE_MODULES="$1/modules"; zoe_measure_root "$1" "$1/dest" git', '_', copyRepo], { encoding: 'utf8' });
ok('⛔ tar ប្រភពខ្វះ file ត្រូវបដិសេធ ទោះ tar ខាងទទួលចេញ 0', copyMissing.status === 1 && /missing/.test(copyMissing.stderr), copyMissing);

const copyReady = cp.spawnSync('bash', ['-c', copyFunction +
    '\ngit() { printf "present\\0"; }; export ZOE_NODE_MODULES="$1/modules"; zoe_measure_root "$1" "$1/dest" git', '_', copyRepo], { encoding: 'utf8' });
ok('ទិសផ្ទុយ ៖ copy tree ពេញ ចេញ 0 និងឯកសារពិត', copyReady.status === 0 && fs.readFileSync(path.join(copyRepo, 'dest', 'present'), 'utf8') === 'guard', copyReady);
for (const out of ['SKIP: dependency', 'SKIPPED dependency', 'PARTIAL PASS (1; SKIP dependency)']) {
    const dir = newCase([['audit-tools/fx-summary.js', { out: [out] }]]);
    const result = runHarness(dir, 'run "fx-summary" node audit-tools/fx-summary.js', { RUNALL_STRICT: '1' });
    ok('⛔ សេចក្តីសង្ខេបវាស់មិនពេញ ត្រូវ exit មិនសូន្យ ៖ ' + out, result.rc !== 0 && !/✅/.test(result.out), result.out);
}
const saturated = runHarness(newCase([]), 'fail=256');
ok('⛔ FAIL 256 មិនអាច wrap ទៅ exit 0', saturated.rc !== 0, saturated);

// ⛔ វាស់ command ខ្លីពីបញ្ជីពិត មិនមែនច្បាប់ចម្លងក្នុង fixture។
const inlineBlock = runall.slice(runall.indexOf('section "== ទម្លាប់គម្រោង =="'), runall.indexOf('\n# ⛔ ត្រង់នេះ ទើបបញ្ជី'));
ok('⛔ ស្រង់ command គម្រោងពិតបាន', inlineBlock.startsWith('section ') && (inlineBlock.match(/^run /gm) || []).length === 5);
function inlineCase(poison) {
    const dir = newCase([]);
    fs.mkdirSync(path.join(dir, 'audit-tools'), { recursive: true });
    fs.copyFileSync(path.join(ROOT, 'audit-tools', 'react-view.js'), path.join(dir, 'audit-tools', 'react-view.js'));
    for (const app of ['ZoeW', 'ZoeKeyGen']) {
        fs.mkdirSync(path.join(dir, app), { recursive: true });
        for (const name of ['app.js', 'license-verify.js', 'error-reporting.js']) fs.writeFileSync(path.join(dir, app, name), 'const valid = 1;\n');
    }
    fs.writeFileSync(path.join(dir, 'firebase-database.rules.json'), '{}');
    fs.writeFileSync(path.join(dir, 'ZoeKeyGen', 'firebase-database.rules.json'), '{}');
    if (poison) poison(dir);
    return runHarness(dir, inlineBlock, { RUNALL_JOBS: '2' });
}
const inlineClean = inlineCase();
ok('⛔ command គម្រោងទាំង ៥ មានភស្តុតាងជោគជ័យពេល input ត្រឹមត្រូវ',
    inlineClean.rc === 0 && /5 ពេញលេញ, 0 មួយផ្នែក, រំលង 0/.test(inlineClean.out), inlineClean.out);
const inlinePoisoned = inlineCase(dir => {
    fs.writeFileSync(path.join(dir, 'ZoeW', 'app.js'), 'const invalid = ;  \n');
    fs.writeFileSync(path.join(dir, 'firebase-database.rules.json'), '{');
    fs.writeFileSync(path.join(dir, 'ZoeW', 'license-verify.js'), 'const changed = 2;\n');
    fs.writeFileSync(path.join(dir, 'ZoeW', 'error-reporting.js'), 'const changed = 2;\n');
});
ok('⛔ command ពិត ៖ syntax/JSON/ឯកសារខុសគ្នា/whitespace ទាំង ៥ ត្រូវ FAIL',
    inlinePoisoned.rc === 5 && /ធ្លាក់ 5/.test(inlinePoisoned.out), inlinePoisoned.out);
const inlineMissing = inlineCase(dir => { fs.rmSync(path.join(dir, 'ZoeW'), { recursive: true }); });
ok('⛔ command ពិត ៖ input បាត់មិនអាចជោគជ័យតាមភាពស្ងាត់ ឬ hash តែមួយ',
    inlineMissing.rc === 4 && /rules JSON valid[^\n]*PASS/.test(inlineMissing.out), inlineMissing.out);

const inlineModules = inlineCase(dir => {
    const parts = { first: 'const text = 1;\n', second: 'const text = 2;\n' };
    fs.writeFileSync(path.join(dir, 'ZoeW', 'app.js'), Object.values(parts).join(''));
    fs.writeFileSync(path.join(dir, 'ZoeW', 'audit-module-views.json'), JSON.stringify(parts));
});
ok('⛔ syntax module ៖ private bindings ស្ទួនឆ្លង module ត្រឹមត្រូវ', inlineModules.rc === 0, inlineModules.out);
const inlineStaleModule = inlineCase(dir => {
    fs.writeFileSync(path.join(dir, 'ZoeW', 'audit-module-views.json'), JSON.stringify({ stale: 'const stale = 1;' }));
});
ok('⛔ syntax module ៖ manifest មិនត្រូវនឹង source ត្រូវធ្លាក់', inlineStaleModule.rc === 1, inlineStaleModule.out);

// ═══ ២. lane ៖ emu ម្តងមួយ · excl ម្នាក់ឯង · browser មានពិដាន ═══
console.log('\n=== ២. lane ៖ emu ម្តងមួយ · meta ម្នាក់ឯង · browser ≤ RUNALL_BROWSER_JOBS ===');
const laneFx = [
    [EMU + 'fx-e1.js', { ms: 400 }], [EMU + 'fx-e2.js', { ms: 400 }], [EMU + 'fx-e3.js', { ms: 400 }],
    ['audit-tools/fx-b1.js', { ms: 400, browser: true }], ['audit-tools/fx-b2.js', { ms: 400, browser: true }],
    ['audit-tools/fx-b3.js', { ms: 400, browser: true }], ['audit-tools/fx-b4.js', { ms: 400, browser: true }],
    ['audit-tools/checker-coverage.js', { ms: 400 }], ['audit-tools/exit-code-integrity.js', { ms: 400 }],
    ['audit-tools/fx-a1.js', { ms: 400 }], ['audit-tools/fx-a2.js', { ms: 400 }], ['audit-tools/fx-a3.js', { ms: 400 }]
];
const c2 = newCase(laneFx);
const body2 = laneFx.map(([rel]) => 'run "' + path.basename(rel, '.js') + '" node ' + rel).join('\n');
const lane = runHarness(c2, body2, { RUNALL_JOBS: '4', RUNALL_BROWSER_JOBS: '2' });
const isEmu = (n) => n.indexOf('/emu/') !== -1;
const isBrowser = (n) => /fx-b\d/.test(n);
const isExcl = (n) => /checker-coverage|exit-code-integrity/.test(n);
ok('⛔ emu/* មិនដែលជាន់គ្នា (emulator តែមួយ)', maxOverlap(lane.events, isEmu) === 1 && lane.events.length >= 24,
    { overlap: maxOverlap(lane.events, isEmu), events: lane.events.length });
ok('⛔ browser ≤ RUNALL_BROWSER_JOBS (២)', maxOverlap(lane.events, isBrowser) === 2, maxOverlap(lane.events, isBrowser));
const exclIv = intervals(lane.events).filter((iv) => isExcl(iv.name));
const others = intervals(lane.events).filter((iv) => !isExcl(iv.name));
const exclAlone = exclIv.length === 2 && exclIv.every((x) => others.every((o) => o.end <= x.start || o.start >= x.end))
    && !(exclIv[0].end > exclIv[1].start && exclIv[1].end > exclIv[0].start);
ok('⛔ checker meta (checker-coverage · exit-code-integrity) រត់ម្នាក់ឯង — គ្មានអ្វីជាន់', exclAlone, exclIv);
ok('ពិដានរួម ≤ RUNALL_JOBS (៤) ហើយនៅតែស្របគ្នា (≥ ៣)', maxOverlap(lane.events) <= 4 && maxOverlap(lane.events) >= 3,
    maxOverlap(lane.events));

// ═══ ៣. ការព្យួរ ➜ FAIL ដែលមានឈ្មោះ · checker ដទៃមិនរង ═══
console.log('\n=== ៣. checker ព្យួរ ➜ «ព្យួរ» FAIL ក្នុងពិដាន ខណៈ lane ផ្សេងបន្ត ===');
const c3 = newCase([['audit-tools/fx-hang.js', { hang: true }], ['audit-tools/fx-ok1.js', { ms: 300 }], ['audit-tools/fx-ok2.js', { ms: 300 }]]);
const hang = runHarness(c3, 'run "fx-hang" node audit-tools/fx-hang.js\nrun "fx-ok1" node audit-tools/fx-ok1.js\nrun "fx-ok2" node audit-tools/fx-ok2.js',
    { RUNALL_JOBS: '2' }, 2);
ok('⛔ checker ព្យួរ ➜ «*** FAIL *** (ព្យួរ …)» ក្រោម CHECKER_TIMEOUT', /fx-hang[^\n]*FAIL[^\n]*ព្យួរ/.test(hang.out) && hang.ms < 20000,
    { ms: hang.ms, out: hang.out.slice(0, 400) });
ok('checker ដទៃចប់ជា PASS ខណៈ fx-hang ព្យួរ', /fx-ok1[^\n]*PASS/.test(hang.out) && /fx-ok2[^\n]*PASS/.test(hang.out)
    && hang.rc === 1, hang.out.slice(0, 400));

// Run the complete script so its default/override initialization is measured too.
// The timeout shim records real arguments, then delegates to GNU timeout unchanged.
console.log('\n=== ៣ខ. scoped money matrix deadlines · explicit override · ordinary hang guard ===');
const deadlineScripts = [EMU + 'money-multidevice-emu-test.js',
    'audit-tools/supabase-money-multishop-test.js', 'audit-tools/rules-duplicate-keys.js'];
const realTimeout = String(cp.spawnSync('sh', ['-c', 'command -v timeout'], { encoding: 'utf8' }).stdout || '').trim();
function runDeadlineFixture(override, hanging) {
    const dir = newCase(deadlineScripts.map((rel) => [rel, { hang: hanging }]));
    fs.writeFileSync(path.join(dir, 'audit-tools', 'run-all.sh'), runall.replace(/^#@runner-end$/m, '\nrunall_prepare_command() { RUNALL_COMMAND=("$@"); }\n#@runner-end'));
    for (const app of ['ZoeW', 'ZoeKeyGen']) {
        fs.mkdirSync(path.join(dir, app), { recursive: true });
        fs.writeFileSync(path.join(dir, app, 'sw.js'), '');
    }
    const bin = path.join(dir, 'bin');
    fs.mkdirSync(bin);
    fs.writeFileSync(path.join(bin, 'timeout'), '#!/bin/sh\n' +
        'printf \'%s\\t%s\\n\' "$3" "$5" >> "$FX_TIMEOUT_LOG"\n' +
        'exec "$FX_REAL_TIMEOUT" "$@"\n', { mode: 0o755 });
    const env = harnessEnv(dir, { RUNALL_ONLY: deadlineScripts.join(','), RUNALL_JOBS: '3',
        PATH: bin + path.delimiter + process.env.PATH, FX_REAL_TIMEOUT: realTimeout,
        FX_TIMEOUT_LOG: path.join(dir, 'deadlines.tsv') });
    delete env.CHECKER_TIMEOUT;
    if (override !== undefined) env.CHECKER_TIMEOUT = override;
    const t0 = Date.now();
    const r = cp.spawnSync('bash', ['audit-tools/run-all.sh'], { cwd: dir, env, encoding: 'utf8', timeout: 30000 });
    let deadlines = [];
    try { deadlines = fs.readFileSync(env.FX_TIMEOUT_LOG, 'utf8').trim().split('\n').map((line) => line.split('\t')); } catch (e) {}
    return { rc: r.status, out: String(r.stdout || '') + String(r.stderr || ''),
        ms: Date.now() - t0, deadlines: Object.fromEntries(deadlines.map(([limit, file]) => [file, limit])), events: readLog(dir) };
}
const deadlineDefaults = runDeadlineFixture(undefined, false);
ok('money matrix defaults use 2400s RTDB / 3000s Supabase; ordinary checker keeps 300s',
    deadlineDefaults.rc === 0 && deadlineDefaults.deadlines[deadlineScripts[0]] === '2400'
    && deadlineDefaults.deadlines[deadlineScripts[1]] === '3000' && deadlineDefaults.deadlines[deadlineScripts[2]] === '300',
    deadlineDefaults);
ok('default deadlines execute all three fixtures to completion',
    deadlineDefaults.events.filter((event) => event.kind === 'end').length === 3, deadlineDefaults.events);
const deadlineOverride = runDeadlineFixture('1', true);
ok('explicit CHECKER_TIMEOUT overrides both money budgets and ordinary checker',
    deadlineScripts.every((file) => deadlineOverride.deadlines[file] === '1'), deadlineOverride.deadlines);
ok('all three hanging fixtures fail within the explicit budget, with named timeout failures',
    deadlineOverride.rc === 3 && deadlineOverride.ms < 20000
    && ['emu/money-multidevice', 'supabase-money-multishop', 'rules-duplicate-keys'].every((label) =>
        deadlineOverride.out.split('\n').some((line) => line.trim().startsWith(label) && /FAIL.*ព្យួរ.*1s/.test(line)))
    && deadlineOverride.events.filter((event) => event.kind === 'end').length === 0, deadlineOverride);
for (const override of ['', '0', '2m']) {
    const result = runDeadlineFixture(override, false);
    const expected = override ? [override, override, override] : ['2400', '3000', '300'];
    ok('CHECKER_TIMEOUT=' + JSON.stringify(override) + ' preserves empty/default, disabled and GNU duration semantics',
        result.rc === 0 && deadlineScripts.every((file, index) => result.deadlines[file] === expected[index]), result.deadlines);
}

// ═══ ៤. RUNALL_STATE · RUNALL_RESUME · RUNALL_ONLY ═══
console.log('\n=== ៤. RUNALL_STATE · RUNALL_RESUME=1 (tree ដដែលប៉ុណ្ណោះ) · RUNALL_ONLY ===');
const c4 = newCase([['audit-tools/fx-p1.js', { ms: 50 }], ['audit-tools/fx-p2.js', { ms: 50 }],
    ['audit-tools/fx-f1.js', { ms: 50, code: 1, out: ['  FAIL  x'] }], ['audit-tools/fx-p3.js', { ms: 50 }],
    [EMU + 'fx-s1.js', { ms: 50, out: ['SKIP គ្មាន emulator'] }]]);
const body4 = ['fx-p1', 'fx-p2', 'fx-f1', 'fx-p3'].map((t) => 'run "' + t + '" node audit-tools/' + t + '.js').join('\n')
    + '\nrun "emu/fx-s1" node ' + EMU + 'fx-s1.js';
const state = path.join(c4, 'state.tsv');
const st1 = runHarness(c4, body4, { RUNALL_JOBS: '3', RUNALL_STATE: state, RUNALL_TREE_HASH: 'aaaa1111' });
let rows = [];
try { rows = fs.readFileSync(state, 'utf8').split('\n').filter((l) => l && l[0] !== '#').map((l) => l.split('\t')); } catch (e) {}
ok('⛔ state ៖ ១ បន្ទាត់/checker (ស្លាក · សាលក្រម · វិនាទី · hash · អត្ថបទ)', rows.length === 5
    && rows.every((r) => r.length === 5 && /^\d+\.\d{3}$/.test(r[2]) && r[3] === 'aaaa1111'), rows);
ok('state ៖ សាលក្រមត្រូវ (fx-f1 FAIL · emu/fx-s1 SKIPPED · ផ្សេង PASS)',
    rows.some((r) => r[0] === 'fx-f1' && r[1] === 'FAIL') && rows.some((r) => r[0] === 'emu/fx-s1' && r[1] === 'SKIPPED')
    && rows.filter((r) => r[1] === 'PASS').length === 3, rows);
// «បាត់» ៖ លុបបន្ទាត់ fx-p3 (ដូច session ដែលងាប់មុន checker នោះចប់)
try {
    fs.writeFileSync(state, fs.readFileSync(state, 'utf8').split('\n').filter((l) => !/^fx-p3\t/.test(l)).join('\n'));
} catch (e) {}
const st2 = runHarness(c4, body4, { RUNALL_JOBS: '3', RUNALL_STATE: state, RUNALL_TREE_HASH: 'aaaa1111', RUNALL_RESUME: '1' });
const st2Started = [...started(st2.events)].sort();
ok('⛔ RESUME ៖ រត់ឡើងវិញ checker ធ្លាក់ + បាត់ + រំលង (fx-f1 · fx-p3 · emu/fx-s1)',
    JSON.stringify(st2Started) === JSON.stringify([EMU + 'fx-s1.js', 'audit-tools/fx-f1.js', 'audit-tools/fx-p3.js']), st2Started);
ok('RESUME ៖ លទ្ធផលមុនបង្ហាញជា ↺ ហើយរាប់ក្នុងសេចក្តីសង្ខេបពេញលេញ',
    /fx-p1[^\n]*PASS[^\n]*↺/.test(st2.out) && /↺ យកពី state មុន 2 · រត់ក្នុងជុំនេះ 3/.test(st2.out)
    && /❌ ធ្លាក់ 1 /.test(st2.out) && !/មិនពេញលេញ/.test(st2.out), st2.out.slice(-700));
const st3 = runHarness(c4, body4, { RUNALL_JOBS: '3', RUNALL_STATE: state, RUNALL_TREE_HASH: 'bbbb2222', RUNALL_RESUME: '1' });
ok('⛔ RESUME លើ tree ផ្សេង ➜ បដិសេធ (exit 2 · គ្មាន checker រត់)',
    st3.rc === 2 && st3.events.length === 0 && /បដិសេធ/.test(st3.out), { rc: st3.rc, events: st3.events.length, out: st3.out.slice(0, 300) });
const st4 = runHarness(c4, body4, { RUNALL_JOBS: '3', RUNALL_STATE: path.join(c4, 'nope.tsv'), RUNALL_TREE_HASH: 'aaaa1111', RUNALL_RESUME: '1' });
ok('RESUME គ្មាន state ➜ បដិសេធ (exit 2) មិនមែនរត់ពេញស្ងាត់ៗ', st4.rc === 2 && st4.events.length === 0, { rc: st4.rc, out: st4.out.slice(0, 200) });
const st5 = runHarness(c4, body4, { RUNALL_JOBS: '3', RUNALL_ONLY: 'fx-p2, emu/fx-s1' });
ok('⛔ RUNALL_ONLY ៖ រត់តែឈ្មោះដែលស្នើ (ស្លាក · id ឯកសារ)',
    JSON.stringify([...started(st5.events)].sort()) === JSON.stringify([EMU + 'fx-s1.js', 'audit-tools/fx-p2.js']),
    [...started(st5.events)]);
ok('RUNALL_ONLY ៖ សេចក្តីសង្ខេបប្រកាស «មិនពេញលេញ» មិនមែន «ជោគជ័យទាំងអស់»',
    /មិនពេញលេញ ៖ វាស់ 2\/5/.test(st5.out) && !/ជោគជ័យទាំងអស់/.test(st5.out), st5.out.slice(-400));
const st6 = runHarness(c4, body4, { RUNALL_JOBS: '3', RUNALL_ONLY: 'fx-p2,គ្មាន-ឈ្មោះ' });
ok('⛔ RUNALL_ONLY ឈ្មោះមិនស្គាល់ ➜ បដិសេធ (exit 2 · គ្មាន checker រត់) មិនមែនបៃតងទទេ',
    st6.rc === 2 && st6.events.length === 0 && /គ្មាន-ឈ្មោះ/.test(st6.out), { rc: st6.rc, out: st6.out.slice(0, 300) });

// ═══ ៧ក. RUNALL_SHARD=k/n ៖ ផ្នែកមិនជាន់ · មិនខ្វះ · ប្រកាស «មិនពេញលេញ» · តម្លៃខុស ➜ បដិសេធ ═══
console.log('\n=== ៧ក. RUNALL_SHARD ៖ ផ្នែកទាំង n រួមគ្នា = បញ្ជីពេញ · គ្មានការជាន់ · ផ្នែកមួយមិនមែនភស្តុតាងនៃ tree ===');
const shardNames = Array.from({ length: 11 }, (_, i) => 'fx-s' + String(i).padStart(2, '0'));
const c7 = newCase(shardNames.map((t, i) => ['audit-tools/' + t + '.js', i === 5 ? { ms: 20, code: 1, out: ['  FAIL  ក្លែង'] } : { ms: 20 }]));
const body7 = 'section "== ក ==" \n' + shardNames.map((t) => 'run "' + t + '" node audit-tools/' + t + '.js').join('\n');
const shardRuns = [1, 2, 3].map((k) => runHarness(c7, body7, { RUNALL_JOBS: '2', RUNALL_SHARD: k + '/3' }));
const shardSets = shardRuns.map((r) => [...started(r.events)].sort());
const shardAll = shardSets.flat();
ok('⛔ ផ្នែកទាំង ៣ រួមគ្នា = បញ្ជីពេញ ហើយមិនជាន់ (' + shardSets.map((x) => x.length).join('+') + ')',
    shardAll.length === shardNames.length && new Set(shardAll).size === shardNames.length && shardSets.every((x) => x.length > 0), shardSets);
const again = runHarness(c7, body7, { RUNALL_JOBS: '1', RUNALL_SHARD: '2/3' });
ok('ការបែងចែកមិនអាស្រ័យលើ RUNALL_JOBS (ផ្នែក 2/3 ដដែលពេល JOBS=1)',
    JSON.stringify([...started(again.events)].sort()) === JSON.stringify(shardSets[1]), [...started(again.events)]);
ok('⛔ ផ្នែកនីមួយៗប្រកាស «មិនពេញលេញ» + RUNALL_SHARD មិនមែន «ជោគជ័យទាំងអស់»',
    shardRuns.every((r) => /មិនពេញលេញ ៖ វាស់ \d+\/11 checker \(RUNALL_SHARD \d\/3/.test(r.out) && !/ជោគជ័យទាំងអស់/.test(r.out)),
    shardRuns.map((r) => r.out.slice(-300)));
const failShard = shardRuns.findIndex((r) => started(r.events).has('audit-tools/fx-s05.js'));
ok('FAIL ក្នុងផ្នែកមួយ ➜ តែផ្នែកនោះ exit ≠ 0', failShard !== -1
    && shardRuns.every((r, k) => (k === failShard ? r.rc === 1 : r.rc === 0)), shardRuns.map((r) => r.rc));
const badShard = ['0/3', '4/3', 'x/3', '1/0', '1/3 x', '2'].map((v) => [v, runHarness(c7, body7, { RUNALL_JOBS: '2', RUNALL_SHARD: v })]);
ok('⛔ RUNALL_SHARD ខុស (0/3 · 4/3 · x/3 · 1/0 · «1/3 x» · 2) ➜ បដិសេធ (exit 2 · គ្មាន checker រត់)',
    badShard.every(([, r]) => r.rc === 2 && r.events.length === 0 && /RUNALL_SHARD/.test(r.out)),
    badShard.map(([v, r]) => v + ' ➜ rc ' + r.rc + ' · ' + r.events.length));

// ═══ ៧ខ. checker កូនមិនទទួល RUNALL_SHARD/ONLY/RESUME ═══
// ⛔ ការជ្រើសជារបស់ run-all **ខាងក្រៅ** តែប៉ុណ្ណោះ ៖ checker ដែលរត់ម៉ាស៊ីននេះខាងក្នុង (hang-guard · runall-runner-test) ទទួល
//    RUNALL_SHARD របស់ CI ➜ fixture របស់វាត្រូវបែងចែកចោល ➜ «checker ដែលព្យួរ ➜ FAIL» ធ្លាក់តែលើ GitHub (វាស់បាន run 480 ផ្នែក ២/៤)
console.log('\n=== ៧ខ. env របស់ checker កូន ៖ គ្មាន RUNALL_SHARD/ONLY/RESUME ===');
const c7b = newCase([['audit-tools/fx-env.js', { envProbe: true }], ['audit-tools/fx-other.js', {}]]);
const body7b = 'run "fx-env" node audit-tools/fx-env.js\nrun "fx-other" node audit-tools/fx-other.js';
const envRun = runHarness(c7b, body7b, { RUNALL_JOBS: '1', RUNALL_SHARD: '1/1', RUNALL_ONLY: 'fx-env' });
let childEnv = null;
try { childEnv = JSON.parse(fs.readFileSync(path.join(c7b, 'fx.log.env'), 'utf8')); } catch (e) {}
ok('ការជ្រើសនៅដើរ ៖ RUNALL_ONLY=fx-env ➜ រត់តែ fx-env', started(envRun.events).has('audit-tools/fx-env.js')
    && !started(envRun.events).has('audit-tools/fx-other.js'), [...started(envRun.events)]);
ok('⛔ checker កូនមិនទទួល RUNALL_SHARD · RUNALL_ONLY · RUNALL_RESUME (env)', Array.isArray(childEnv) && childEnv.length === 0, childEnv);

// ═══ ៥. ការរំខាន ➜ បញ្ឈប់ checker ដែលកំពុងរត់ ═══
async function sectionFive() {
    console.log('\n=== ៥. TERM ➜ checker ដែលកំពុងរត់ត្រូវបញ្ឈប់ (គ្មាន process កំព្រា) ===');
    const c5 = newCase([['audit-tools/fx-long1.js', { ms: 30000 }], ['audit-tools/fx-long2.js', { ms: 30000 }]]);
    const h = writeHarness(c5, 'run "fx-long1" node audit-tools/fx-long1.js\nrun "fx-long2" node audit-tools/fx-long2.js', 60);
    const child = cp.spawn('bash', [h], { cwd: c5, env: harnessEnv(c5, { RUNALL_JOBS: '2' }), stdio: 'ignore' });
    let exitCode = null;
    const done = new Promise((resolve) => child.on('exit', (code, sig) => { exitCode = code === null ? sig : code; resolve(); }));
    const waitFor = (fn, ms) => new Promise((resolve) => {
        const end = Date.now() + ms;
        (function poll() { if (fn() || Date.now() > end) resolve(); else setTimeout(poll, 100); })();
    });
    await waitFor(() => readLog(c5).filter((e) => e.kind === 'start').length >= 2, 15000);
    const pids = readLog(c5).filter((e) => e.kind === 'start').map((e) => e.pid);
    const t0 = Date.now();
    child.kill('SIGTERM');
    let exitDeadline;
    try {
        await Promise.race([done, new Promise((r) => { exitDeadline = setTimeout(r, 20000); })]);
    } finally { clearTimeout(exitDeadline); }
    await new Promise((r) => setTimeout(r, 300));
    const alive = pids.filter((pid) => { try { process.kill(pid, 0); return true; } catch (e) { return false; } });
    for (const pid of alive) { try { process.kill(pid, 'SIGKILL'); } catch (e) {} }
    if (exitCode === null) { try { child.kill('SIGKILL'); } catch (e) {} }
    ok('⛔ TERM ➜ run-all ចេញ (130) ក្នុង < ១០ វិ.', exitCode === 130 && Date.now() - t0 < 10000, { exitCode, ms: Date.now() - t0 });
    ok('⛔ TERM ➜ checker ទាំង ២ ដែលកំពុងរត់ត្រូវបញ្ឈប់ (មិនបន្សល់ process កំព្រា)', pids.length === 2 && alive.length === 0,
        { pids, alive });
}

// ═══ ៦. lane នៃបញ្ជី **ពិត** ↔ ភស្តុតាងក្នុងប្រភព checker (ទាំង ២ ទិស) ═══
async function sectionSix() {
    console.log('\n=== ៦. lane នៃបញ្ជីពិត ↔ ភស្តុតាងក្នុងប្រភព · ស្លាកមិនស្ទួន · លំនាំដើម RUNALL_JOBS ===');
    const listAt = runall.search(/^#@runner-end$/m);
    const listEnd = runall.search(/^runall_drain \|\| exit/m);
    let plan = [];
    if (blockAt !== -1 && listAt !== -1 && listEnd > listAt) {
        const dir = path.join(TMP, 'plan');
        fs.mkdirSync(dir, { recursive: true });
        const h = path.join(dir, 'plan.sh');
        fs.writeFileSync(h, 'cd ' + JSON.stringify(ROOT) + ' || exit 1\n' + block + '\n'
            + runall.slice(listAt, listEnd).replace(/^#@runner-end$/m, '') + '\n'
            + 'for i in "${!J_KIND[@]}"; do eval "set -- ${J_CMD[$i]}"; owned=0; runall_needs_rtdb "$@" && owned=1; printf \'%s\\t%s\\t%s\\t%s\\t%s\\n\' "${J_KIND[$i]}" "${J_LABEL[$i]}" "${J_ID[$i]}" "${J_LANE[$i]}" "$owned"; done\n'
            + 'for h in $RUNALL_HINTS; do printf \'hint\\t%s\\t%s\\t-\\n\' "${h%%:*}" "${h##*:}"; done\n');
        const r = cp.spawnSync('bash', [h], { encoding: 'utf8', timeout: 60000, env: harnessEnv(dir) });
        plan = String(r.stdout || '').split('\n').filter(Boolean).map((l) => l.split('\t'))
            .filter((p) => p[0] !== 'hdr').map(([kind, label, id, laneName, owned]) => ({ kind, label, id, lane: laneName, owned }));
    }
    const hintRows = plan.filter((p) => p.kind === 'hint');
    plan = plan.filter((p) => p.kind !== 'hint');
    const jobs = plan.filter((p) => p.kind === 'job');
    ok('ជាន់អប្បបរមា ៖ ដេរីវេបញ្ជីពិតបាន >= 150 checker (ឃើញ ' + jobs.length + ')', jobs.length >= 150, jobs.length);
    // RUNALL_HINTS ប៉ះតែលំដាប់រត់ — តែឈ្មោះខ្មោច (checker ដែលលែងមាន/ប្តូរឈ្មោះ) = ការបញ្ជាក់ក្លែងថា «វានៅរត់មុនគេ»
    const planIds = new Set(jobs.map((j) => j.id));
    const ghostHints = hintRows.filter((h) => !planIds.has(h.label) || !/^\d+$/.test(h.id)).map((h) => h.label + ':' + h.id);
    ok('RUNALL_HINTS ៖ >= 5 ធាតុ · រាល់ឈ្មោះជា checker ក្នុងបញ្ជីពិត · វិនាទីជាលេខ (ឃើញ ' + hintRows.length + ')',
        hintRows.length >= 5 && ghostHints.length === 0, ghostHints);
    // ពេលវាស់ជាប់នឹងស្លាក sub-suite ពិត; state/CPU របស់ runner មិនប្ដូរម្ចាស់ checker។
    const shardProbe = (body, extra) => cp.spawnSync('bash', ['-c', block + '\n' + body], {
        cwd: ROOT, encoding: 'utf8', timeout: 30000, env: harnessEnv(TMP, extra)
    });
    const labelProbe = shardProbe('for label in "${!RUNALL_LABEL_HINTS[@]}"; do printf \'%s\\t%s\\n\' "$label" "${RUNALL_LABEL_HINTS[$label]}"; done');
    const labelHints = String(labelProbe.stdout || '').trim().split('\n').filter(Boolean).map(row => row.split('\t'));
    ok('ពេល sub-suite ៖ រាល់ស្លាកជាការរត់ពិត ហើយពេលជាចំនួនគត់វិជ្ជមាន',
        labelProbe.status === 0 && labelHints.length >= 2 && labelHints.every(([label, duration]) => jobs.some(job => job.label === label) && /^[1-9]\d*$/.test(duration))
        && jobs.filter(job => job.id && jobs.filter(other => other.id === job.id).length > 1).every(job => labelHints.some(([label]) => label === job.label)), labelHints);
    const synthetic = 'J_KIND=(job job job job job job job job); J_LABEL=(a b c d e f g h); J_ID=(a b c d e f g h); '
        + 'J_LANE=(browser browser emu emu any any excl any); RUNALL_HINTS="a:100 b:90 c:80 d:70 e:60 f:50 g:40 h:30"; '
        + 'for k in 1 2 3 4; do RUNALL_SHARD="$k/4"; runall_shard_pick || exit 7; '
        + 'for i in "${!RUNALL_MINE[@]}"; do printf \'%s\\t%s\\n\' "$i" "$k"; done; done';
    const shardA = shardProbe(synthetic);
    const shardB = shardProbe(synthetic, { RUNALL_JOBS: '32', RUNALL_BROWSER_JOBS: '17', RUNALL_TREE_HASH: 'another-tree', RUNALL_STATE: path.join(TMP, 'unrelated-state') });
    const assigned = String(shardA.stdout || '').trim().split('\n').map(row => row.split('\t')[0]).sort();
    ok('shard ៖ checker នីមួយៗមានម្ចាស់មួយ ហើយ JOBS/browser/state មិនប្ដូរការបែងចែក',
        shardA.status === 0 && shardB.status === 0 && shardA.stdout === shardB.stdout && assigned.join(',') === '0,1,2,3,4,5,6,7',
        { a: shardA.stdout, b: shardB.stdout, error: shardA.stderr || shardB.stderr });
    for (const [lane, expected] of [['browser', 190], ['emu', 190], ['any', 100], ['excl', 190]]) {
        const probe = shardProbe('J_KIND=(job job); J_LABEL=(a b); J_ID=(a b); J_LANE=(' + lane + ' ' + lane + '); '
            + 'RUNALL_HINTS="a:100 b:90"; RUNALL_SHARD=1/1; runall_shard_pick || exit 7; echo "$RUNALL_SHARD_LOAD"');
        ok('ពេល shard គោរព lane ' + lane + ' (100s + 90s ➜ ' + expected + 's)',
            probe.status === 0 && Number(String(probe.stdout || '').trim()) === expected, { out: probe.stdout, error: probe.stderr });
    }
    const balancedProbe = shardProbe('J_KIND=(job job job job job job job job job job job job); '
        + 'J_LABEL=(a b c d e f g h i j k l); J_ID=(a b c d e f g h i j k l); '
        + 'J_LANE=(any any emu any any any browser emu any emu browser emu); '
        + 'RUNALL_HINTS="a:120 b:50 c:10 d:170 e:30 f:180 g:130 h:150 i:60 j:80 k:40 l:170"; '
        + 'for k in 1 2 3 4; do RUNALL_SHARD="$k/4"; runall_shard_pick || exit 7; echo "$RUNALL_SHARD_LOAD"; done');
    const balancedLoads = String(balancedProbe.stdout || '').trim().split('\n').map(Number);
    ok('បែងចែកតាម lane ៖ fixture emulator ដែល LPT ផលបូកចំណាយ 250s ត្រូវបញ្ចប់ត្រឹម 180s ក្នុងគំរូ',
        balancedProbe.status === 0 && balancedLoads.length === 4 && Math.max(...balancedLoads) === 180, balancedLoads);
    const decimalShard = shardProbe('RUNALL_SHARD=01/04; runall_shard_pick');
    const badShards = ['0/4', '5/4', '1/0', '1/33', 'x/4', '999999999999999999999/4', '1/99999999999999999999'];
    ok('shard ៖ 01/04 ជាលេខគោលដប់; លេខខុស/លើសព្រំដែនបដិសេធមុនគណនា',
        decimalShard.status === 0 && badShards.every(value => shardProbe('RUNALL_SHARD=' + value + '; runall_shard_pick').status !== 0));
    const dup = plan.map((p) => p.label).filter((l, i, a) => a.indexOf(l) !== i);
    ok('⛔ ស្លាក checker មិនស្ទួន (ជាកូនសោរបស់ RUNALL_STATE · RUNALL_ONLY)', dup.length === 0, dup);

    let acorn = null;
    try { acorn = require('acorn'); } catch (e) { acorn = null; }
    ok('ត្រូវការ acorn (កាត់ comment មុនរកភស្តុតាង) — វាស់មិនបាន ≠ ត្រឹមត្រូវ', !!acorn);
    const code = (src) => {  // ប្រភពដែលកាត់ comment ចេញ (ខ្សែអក្សរនៅដដែល) · parse មិនបាន ➜ null (មិនមែនប្រភពឆៅ)
        if (!acorn) return null;
        for (const sourceType of ['script', 'module']) {
            const cuts = [];
            try {
                acorn.parse(src, { ecmaVersion: 'latest', sourceType, allowHashBang: true, allowReturnOutsideFunction: true,
                    allowAwaitOutsideFunction: true, onComment: (b, t, st, en) => cuts.push([st, en]) });
            } catch (e) { continue; }
            let out = '', at = 0;
            for (const [st, en] of cuts.sort((a, b) => a[0] - b[0])) { out += src.slice(at, st); at = en; }
            return out + src.slice(at);
        }
        return null;
    };
    const EMU_EVIDENCE = /emuNamespace\s*\(|['"`](?:\.{1,2}\/)?(?:audit-tools\/)?emu\/[A-Za-z0-9_-]+\.js['"`]|127\.0\.0\.1:9000/;
    const wrong = [], unjustified = [];
    let emuN = 0, exclN = 0, browserN = 0;
    for (const j of jobs) {
        if (!j.id) continue;
        let src = '';
        try { src = fs.readFileSync(path.join(ROOT, 'audit-tools', j.id + '.js'), 'utf8'); }
        catch (e) { try { src = fs.readFileSync(path.join(ROOT, j.id + '.js'), 'utf8'); } catch (e2) { continue; } }
        const c = code(src);
        if (c === null) { wrong.push(j.id + ' ៖ parse មិនបាន ➜ វាស់ភស្តុតាងមិនបាន'); continue; }
        const poison = c.indexOf('.tmp-poison-') !== -1 && /\bunlinkSync\s*\(/.test(c);
        const emu = j.id.indexOf('emu/') === 0 || EMU_EVIDENCE.test(c);
        const browser = src.indexOf(BROWSER_MARK) !== -1;
        if (j.lane === 'excl') exclN++;
        if (j.lane === 'emu') emuN++;
        if (j.lane === 'browser') browserN++;
        if (poison && j.lane !== 'excl') wrong.push(j.id + ' ៖ សរសេរ/បោស .tmp-poison-* តែ lane=' + j.lane + ' (ត្រូវ excl)');
        if (emu && j.lane !== 'emu' && j.lane !== 'excl') wrong.push(j.id + ' ៖ ប្រើ emulator តែ lane=' + j.lane + ' (ត្រូវ emu)');
        if (!poison && !emu && browser && j.lane !== 'browser') wrong.push(j.id + ' ៖ បើក browser តែ lane=' + j.lane);
        if (j.lane === 'excl' && !poison) unjustified.push(j.id + ' ៖ excl គ្មានភស្តុតាង .tmp-poison-*');
        if (j.lane === 'emu' && !emu) unjustified.push(j.id + ' ៖ emu គ្មានភស្តុតាង emulator');
        if (j.lane === 'browser' && !browser) unjustified.push(j.id + ' ៖ browser គ្មាន ' + BROWSER_MARK);
    }
    ok('ជាន់អប្បបរមា ៖ lane excl >= 2 · emu >= 6 · browser >= 25 (ឃើញ ' + [exclN, emuN, browserN].join(' · ') + ')',
        exclN >= 2 && emuN >= 6 && browserN >= 25, { exclN, emuN, browserN });
    ok('⛔ រាល់ checker ដែលប្រភពបង្ហាញភស្តុតាង (.tmp-poison-* · emulator · browser) ឈរ lane ត្រូវ', wrong.length === 0, wrong.join('\n'));
    ok('⛔ ទិសផ្ទុយ ៖ lane លើកលែងទាំងអស់មានភស្តុតាងក្នុងប្រភព (គ្មានធាតុចាស់)', unjustified.length === 0, unjustified.join('\n'));

    // ═══ ៧ខ. matrix ក្នុង audit.yml ↔ ការបែងចែកបញ្ជី **ពិត** ═══
    // ⛔ CI ពេញ = ផ្នែកទាំង N បៃតង ➜ matrix ដែលភ្លេចផ្នែកណាមួយ (ឧ. [1, 2, 3] ជាមួយ «/4») បោះបង់ checker មួយភាគបួនដោយស្ងាត់
    let wf = '';
    try { wf = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'audit.yml'), 'utf8'); } catch (e) { wf = ''; }
    const shardEnv = /RUNALL_SHARD:\s*\$\{\{\s*matrix\.shard\s*\}\}\/(\d+)/.exec(wf);
    const matrixRow = /^\s*shard:\s*\[([0-9,\s]+)\]\s*$/m.exec(wf);
    const N = shardEnv ? Number(shardEnv[1]) : 0;
    const matrix = matrixRow ? matrixRow[1].split(',').map((x) => Number(x.trim())) : [];
    ok('audit.yml ៖ matrix shard = 1..N ដែល N ស្មើ «/N» ក្នុង RUNALL_SHARD (ឃើញ [' + matrix.join(',') + '] · /' + N + ')',
        N >= 1 && JSON.stringify(matrix) === JSON.stringify(Array.from({ length: N }, (_, i) => i + 1)), { matrix, N });
    const runbook = (() => { try { return fs.readFileSync(path.join(ROOT, 'CLAUDE.md'), 'utf8'); } catch (e) { return ''; } })();
    const rbLine = (runbook.match(/^[A-Z_=1 ]*_STRICT=1[A-Z_=1 ]* bash audit-tools\/run-all\.sh/m) || [''])[0];
    const rbFlags = [...rbLine.matchAll(/([A-Z0-9_]+_STRICT)=1/g)].map((m) => m[1]);
    const shardStep = (wf.match(/^      - name: run-all\.sh \(ផ្នែក[^\n]*(?:\n(?!      -)[^\n]*)*/m) || [''])[0];
    ok('⛔ CI មិនប្រើ state របស់ runner ចាស់ ហើយ SKIP/PARTIAL មិនអាចបៃតង',
        /^\s*RUNALL_STATE: *'' *$/m.test(shardStep) && /^\s*RUNALL_STRICT: *'1' *$/m.test(shardStep), shardStep);
    const missingFlags = rbFlags.filter((f) => !new RegExp('\\b' + f + ":\\s*'1'").test(shardStep));
    ok('⛔ ជំហាន run-all ក្នុង CI មានទង់ STRICT ទាំងអស់របស់ Runbook (' + rbFlags.length + ') ➜ CI ស្មើការរត់ក្នុង session',
        rbFlags.length >= 4 && shardStep.includes('bash audit-tools/run-all.sh') && missingFlags.length === 0, { rbFlags, missingFlags });
    const ownerGuardSource = fs.readFileSync(path.join(ROOT, 'audit-tools/runall-runner-test.js'), 'utf8');
    const ownerGuardActive = source => {
        let ast; try { ast = acorn.parse(source, { ecmaVersion: 'latest' }); } catch (_) { return false; }
        const nodes = []; const visit = node => { if (!node || typeof node !== 'object') return; if (node.type) nodes.push(node); for (const value of Object.values(node)) { if (Array.isArray(value)) value.forEach(visit); else if (value && typeof value === 'object') visit(value); } }; visit(ast);
        return nodes.some(node => node.type === 'FunctionDeclaration' && node.id?.name === 'sectionOwnedRuntime')
            && nodes.some(node => node.type === 'CallExpression' && ['ArrowFunctionExpression', 'FunctionExpression'].includes(node.callee?.type)
                && node.callee.body?.body?.some(statement => statement.type === 'ExpressionStatement' && statement.expression.type === 'AwaitExpression'
                    && statement.expression.argument.type === 'CallExpression' && statement.expression.argument.callee.name === 'sectionOwnedRuntime'));
    };
    ok('owned helper ដែលមិនរាប់ជា checker មាន readiness/ownership guard សកម្ម; missing-guard mutant ត្រូវចាប់',
        ownerGuardActive(ownerGuardSource) && !ownerGuardActive(ownerGuardSource.replace(/^    await sectionOwnedRuntime\(\);$/m, '')));
    const expectedOwned = job => job.lane === 'emu' || ['checker-coverage', 'exit-code-integrity'].includes(job.id);
    ok('CI គ្មាន global JVM ហើយ normal tasks ដែលត្រូវការ RTDB ឆ្លង owned scope ពេញ',
        !/java -jar|zoe-emulator\.pid/.test(wf) && shardStep.length > 0 && wf.includes('real.rules.json')
        && jobs.length >= 150 && jobs.every(job => (job.owned === '1') === expectedOwned(job))
        && jobs.filter(job => job.owned === '1').length >= 26);
    const base = runall.slice(runall.search(/^if \[ -n "\$BASE" \]/m));
    const baseCommands = [...base.matchAll(/^\s*([A-Z0-9_]+_APP_DIR)="\$BASE" (runall_owned )?node (audit-tools\/[A-Za-z0-9_/-]+\.js)/gm)];
    const requiredBase = entry => entry[3].startsWith(EMU) || ['money-guardian-test.js', 'money-checker-truthfulness-test.js', 'exit-code-integrity.js', 'supabase-scan-rules-test.js'].some(name => entry[3] === 'audit-tools/' + name);
    const missingOwned = text => [...text.matchAll(/^\s*([A-Z0-9_]+_APP_DIR)="\$BASE" (runall_owned )?node (audit-tools\/[A-Za-z0-9_/-]+\.js)/gm)].filter(entry => requiredBase(entry) && !entry[2]);
    ok('BASE RTDB consumers ប្រើ owned API ដូច normal ដោយរក្សា source overrides ទាំងអស់',
        baseCommands.filter(requiredBase).length === 19 && missingOwned(base).length === 0
        && /runall_prepare_command "\$@"/.test(runall));
    const baseFixture = 'F03_APP_DIR="$BASE" runall_owned node ' + EMU + 'registry-purge-atomic-sdk-test.js';
    ok('BASE lost-wrapper mutant ត្រូវបានចាប់ មិនមែនជាការលុប startup guard',
        missingOwned(baseFixture).length === 0 && missingOwned(baseFixture.replace('runall_owned ', '')).length === 1);
    if (N >= 1 && blockAt !== -1 && listAt !== -1 && listEnd > listAt) {
        const dir2 = path.join(TMP, 'shards');
        fs.mkdirSync(dir2, { recursive: true });
        const h2 = path.join(dir2, 'shards.sh');
        fs.writeFileSync(h2, 'cd ' + JSON.stringify(ROOT) + ' || exit 1\npass=0; fail=0; skip=0; partial=0\n' + block + '\n'
            + runall.slice(listAt, listEnd).replace(/^#@runner-end$/m, '') + '\n'
            + 'for ((k = 1; k <= ' + N + '; k++)); do RUNALL_SHARD="$k/' + N + '"; runall_select >/dev/null || exit 3; '
            + 'for i in "${!J_KIND[@]}"; do [ "${J_ST[$i]}" = queue ] && printf \'%s\\t%s\\t%s\\n\' "$k" "${J_LABEL[$i]}" "$RUNALL_SHARD_LOAD"; done; done\nexit 0\n');
        const r2 = cp.spawnSync('bash', [h2], { encoding: 'utf8', timeout: 60000, env: harnessEnv(dir2) });
        const rowsS = String(r2.stdout || '').split('\n').filter(Boolean).map((l) => l.split('\t'));
        const labels = rowsS.map((x) => x[1]);
        const allJobs = plan.filter((p) => p.kind === 'job').map((p) => p.label);
        const loads = [...new Set(rowsS.map((x) => x[0] + ':' + x[2]))].map((x) => Number(x.split(':')[1]));
        ok('⛔ បញ្ជីពិត ៖ ផ្នែកទាំង ' + N + ' រួមគ្នា = checker ទាំង ' + allJobs.length + ' គ្មានការជាន់',
            r2.status === 0 && labels.length === allJobs.length && new Set(labels).size === labels.length
            && allJobs.every((l) => labels.includes(l)), { status: r2.status, got: labels.length, want: allJobs.length });
        ok('បញ្ជីពិត ៖ ទម្ងន់ផ្នែកស្មើគ្នាក្នុង ២០% (' + loads.join(' · ') + ')',
            loads.length === N && Math.max(...loads) <= Math.min(...loads) * 1.2, loads);
    }

    // លំនាំដើម RUNALL_JOBS = CPU ក្នុងព្រំដែន 2–6 (nproc ក្លែងក្នុង PATH)
    const dir = path.join(TMP, 'nproc');
    fs.mkdirSync(dir, { recursive: true });
    const jobsFor = (cpus, extra) => {
        fs.writeFileSync(path.join(dir, 'nproc'), '#!/bin/sh\necho ' + cpus + '\n', { mode: 0o755 });
        const h = path.join(dir, 'j.sh');
        fs.writeFileSync(h, block + '\necho "JOBS=$RUNALL_JOBS BROWSER=$RUNALL_BROWSER_JOBS"\n');
        const env = harnessEnv(dir, Object.assign({ PATH: dir + path.delimiter + process.env.PATH }, extra || {}));
        const r = cp.spawnSync('bash', [h], { encoding: 'utf8', timeout: 20000, env });
        const m = /JOBS=(\d+) BROWSER=(\d+)/.exec(String(r.stdout || ''));
        return m ? { jobs: Number(m[1]), browser: Number(m[2]), err: String(r.stderr || '') } : { jobs: -1, browser: -1, err: String(r.stderr || '') };
    };
    const j1 = jobsFor(1), j4 = jobsFor(4), j16 = jobsFor(16), jBad = jobsFor(4, { RUNALL_JOBS: 'abc' }), jOne = jobsFor(16, { RUNALL_JOBS: '1' });
    ok('លំនាំដើម RUNALL_JOBS = CPU ក្នុងព្រំដែន 2–6 (1➜2 · 4➜4 · 16➜6)', j1.jobs === 2 && j4.jobs === 4 && j16.jobs === 6,
        { j1, j4, j16 });
    ok('RUNALL_JOBS មិនមែនលេខ ➜ លំនាំដើម + ព្រមាន · RUNALL_JOBS=1 ➜ ជាជួរ · browser ≤ jobs',
        jBad.jobs === 4 && /abc/.test(jBad.err) && jOne.jobs === 1 && jOne.browser === 1 && j16.browser <= j16.jobs,
        { jBad, jOne, j16 });
}

// ═══ ៨. សោ root វាស់ ៖ build ទី ២ ខណៈ run-all កំពុងរត់ ➜ បដិសេធ (មិនលុប ZoeW/dist-audit ពីក្រោម checker) ═══
//    វាស់ `run-all.sh` ពិតលើ repo fixture (React ៖ `ZoeW/src/main.tsx` · គ្មាន `ZoeW/app.js`) ៖ សោកាន់ ➜ exit 2 + សារ · សោទំនេរ ➜ ឆ្លងច្រកទ្វារ
function sectionLock() {
    console.log('\n=== ៨. សោ root វាស់ (ការរត់ទី ២ ខណៈ run-all កំពុងរត់) ===');
    if (!fs.existsSync('/usr/bin/flock') && cp.spawnSync('sh', ['-c', 'command -v flock']).status !== 0) {
        ok('សោ root វាស់ ៖ គ្មាន flock លើម៉ាស៊ីននេះ ➜ run-all រំលងសោ (fail-open)', /command -v flock/.test(runall));
        return;
    }
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'zoe-runall-lock-'));
    try {
        fs.mkdirSync(path.join(repo, 'audit-tools'), { recursive: true });
        fs.mkdirSync(path.join(repo, 'ZoeW', 'src'), { recursive: true });
        ['vite', 'playwright-core'].forEach((m) => fs.mkdirSync(path.join(repo, 'ZoeW', 'node_modules', m), { recursive: true }));
        fs.writeFileSync(path.join(repo, 'ZoeW', 'src', 'main.tsx'), '');
        fs.copyFileSync(RUNALL, path.join(repo, 'audit-tools', 'run-all.sh'));
        cp.spawnSync('git', ['init', '-q'], { cwd: repo });
        const lock = path.join(repo, '.git', 'zoe-runall-measure.lock');
        const env = Object.assign({}, process.env, { ZOE_MEASURE_ONLY: '1' });
        Object.keys(env).forEach((k) => { if (/^(RUNALL_|ZOE_MEASURE_ROOT|ZOE_REPO_ROOT)/.test(k)) delete env[k]; });
        const holder = cp.spawn('bash', ['-c', 'exec 9>"$1"; flock 9; exec sleep 30', '_', lock], { stdio: 'ignore' });
        const until = Date.now() + 5000;
        while (Date.now() < until && cp.spawnSync('flock', ['-n', lock, 'true']).status === 0) cp.spawnSync('sleep', ['0.1']);
        const held = cp.spawnSync('bash', ['audit-tools/run-all.sh'], { cwd: repo, env, encoding: 'utf8', timeout: 30000 });
        holder.kill('SIGKILL');
        const freeUntil = Date.now() + 5000;
        while (Date.now() < freeUntil && cp.spawnSync('flock', ['-n', lock, 'true']).status !== 0) cp.spawnSync('sleep', ['0.1']);
        const free = cp.spawnSync('bash', ['audit-tools/run-all.sh'], { cwd: repo, env, encoding: 'utf8', timeout: 30000 });
        ok('សោកាន់ (run-all មួយទៀតកំពុងរត់) ➜ build ទី ២ បដិសេធ exit 2 មុនប៉ះ ZoeW/dist-audit',
            held.status === 2 && /កំពុងរត់លើ repo នេះរួចហើយ/.test(held.stdout || ''),
            JSON.stringify({ status: held.status, out: String(held.stdout || '').slice(0, 200) }));
        ok('ទិសផ្ទុយ ៖ សោទំនេរ ➜ ឆ្លងច្រកទ្វារទៅ build (មិនបដិសេធខុស)',
            !/កំពុងរត់លើ repo នេះរួចហើយ/.test(free.stdout || '') && /build វាស់ពីប្រភពពិត/.test(free.stdout || ''),
            JSON.stringify({ status: free.status, out: String(free.stdout || '').slice(0, 200) }));
    } finally {
        fs.rmSync(repo, { recursive: true, force: true });
    }
}

async function sectionProgress() {
    const dir = newCase([
        ['audit-tools/fx-first.js', { ms: 700 }],
        ['audit-tools/fx-early.js', { ms: 200 }],
        ['audit-tools/fx-fail.js', { ms: 900, code: 1, out: ['  FAIL  ក្លែង'] }]
    ]);
    const body = 'RUNALL_HINTS="fx-first:1 fx-early:20 fx-fail:30"\n' +
        ['first', 'early', 'fail'].map(name => 'run "fx-' + name + '" node audit-tools/fx-' + name + '.js').join('\n');
    const h = writeHarness(dir, body);
    const child = cp.spawn('bash', [h], { cwd: dir, env: harnessEnv(dir, { RUNALL_JOBS: '2' }), stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', data => { out += data; });
    child.stderr.on('data', data => { out += data; });
    const done = new Promise(resolve => child.on('close', resolve));
    const until = Date.now() + 10000;
    while (Date.now() < until && !readLog(dir).some(event => event.kind === 'end' && event.name.endsWith('fx-early.js'))) {
        await new Promise(resolve => setTimeout(resolve, 20));
    }
    await new Promise(resolve => setTimeout(resolve, 100));
    const early = out;
    ok('⛔ progress រាយ checker ដែលចប់ភ្លាម មុនលទ្ធផលលម្អិតដែលនៅរង់ចាំតាមលំដាប់',
        /▶ ចាប់ផ្តើម ៖ fx-early/.test(early) && /● ចប់ \[1\/3\] ៖ fx-early · PASS/.test(early)
        && !/^  fx-first\s+.*PASS/m.test(early), early);
    const status = await done;
    ok('progress រាយសាលក្រមពិត និងចំនួនពេញ ដោយរក្សាលទ្ធផលលម្អិតតាមលំដាប់',
        status === 1 && /● ចប់ \[3\/3\]/.test(out) && /● ចប់ [^\n]*fx-fail · FAIL/.test(out)
        && out.indexOf('  fx-first ') < out.indexOf('  fx-early ') && out.indexOf('  fx-early ') < out.indexOf('  fx-fail '), out);
    const silent = runHarness(dir, body, { RUNALL_JOBS: '2', RUNALL_PROGRESS: '0' });
    ok('RUNALL_PROGRESS=0 បិទតែ progress មិនលាក់ FAIL ឬលទ្ធផល checker',
        silent.rc === 1 && !/▶ ចាប់ផ្តើម|● ចប់/.test(silent.out) && /^  fx-first\s+.*PASS/m.test(silent.out)
        && /^  fx-fail\s+.*FAIL/m.test(silent.out), silent.out);
}

async function sectionOwnedRuntime() {
    const helper = require(path.join(ROOT, 'audit-tools/owned-rtdb-command.js'));
    const make = options => {
        let time = 0, count = 0, engine, changed = false; const calls = [];
        const handle = kind => { let finish; const value = { child: { pid: ++count }, spawned: Promise.resolve(), done: false };
            value.exit = new Promise(resolve => { finish = resolve; }); value.ended = () => value.done;
            value.finish = code => { value.done = true; finish({ code, signal: null, outputPresent: true, failureLine: false, skipLine: false }); }; value.kind = kind; return value; };
        const adapter = { validateSource() {}, now: () => time, delay: async ms => { time += ms; }, verifyJar: () => ({ jar: '/fake/jar', sha256: 'a'.repeat(64) }),
            portFree: async () => { if (options.foreign) throw new Error('foreign port'); },
            launch: () => { calls.push('launch'); engine = handle('engine'); return engine; },
            identity: pid => ({ pid, start: changed ? 'changed' : 'owned', exe: '/java', args: ['java', ...helper.javaArguments('/fake/jar')] }),
            ownsListener: () => true, readyRead: async () => { if (options.change) changed = true; return true; },
            command: () => { calls.push('command'); const child = handle('command'); queueMicrotask(() => child.finish(options.fail ? 17 : 0)); return child; },
            signal: child => { calls.push('signal'); if (!options.unsettled) child.finish(0); },
            within: async promise => { if (options.unsettled) throw new Error('cleanup deadline'); return promise; } };
        return { adapter, calls };
    };
    const run = async options => { const fake = make(options); const dir = fs.mkdtempSync(path.join(TMP, 'owned-')); return { fake, dir,
        value: await helper.runOwnedCommand({ stateDir: dir, args: ['node', 'synthetic.js'], env: { RUNALL_STRICT: '1' } }, fake.adapter) }; };
    const ownedDir = newCase([[EMU + 'owned-a.js', { ownedProbe: true }], [EMU + 'owned-b.js', { ownedProbe: true }]]);
    const ownedBody = 'run a node ' + EMU + 'owned-a.js\nrun b node ' + EMU + 'owned-b.js';
    const owned = runHarness(ownedDir, ownedBody, { RUNALL_JOBS: '2' });
    let owners = []; try { owners = fs.readFileSync(path.join(ownedDir, 'fx.log.owners'), 'utf8').trim().split('\n').map(line => JSON.parse(line)); } catch (_) {}
    ok('actual runner tasks require two successive private owner scopes', owned.rc === 0 && owners.length === 2 && new Set(owners.map(row => row.owner)).size === 2, owned.out);
    const lost = runHarness(ownedDir, 'runall_prepare_command() { RUNALL_COMMAND=("$@"); }\n' + ownedBody, { RUNALL_JOBS: '2' });
    ok('lost-wrapper behavior mutant cannot run green without owned readiness', lost.rc !== 0 && /missing owned fixture/.test(lost.out), lost.out);
    const healthy = await run({});
    ok('owned readiness មុន command ម្តង ហើយ cleanup ពេញ', healthy.value.code === 0 && healthy.value.report.cleanup && healthy.fake.calls.join(',') === 'launch,command,signal');
    const foreign = await run({ foreign: true });
    ok('foreign port មិន launch/adopt/signal ឬ dispatch', foreign.value.code !== 0 && foreign.fake.calls.length === 0);
    const changed = await run({ change: true });
    ok('foreign PID/start-time mutant មិន signal និងមិនអាច PASS', changed.value.code !== 0 && changed.value.report.cleanup === false && !changed.fake.calls.includes('signal'));
    const next = make({});
    const blocked = await helper.runOwnedCommand({ stateDir: changed.dir, args: ['node', 'synthetic.js'], env: { RUNALL_STRICT: '1' } }, next.adapter);
    ok('cleanup unknown blocks task បន្ទាប់ មិនដាក់ engine ទីពីរ', blocked.code !== 0 && next.calls.length === 0);
    const failed = await run({ fail: true });
    ok('original FAIL17 នៅ FAIL17 ទោះ owned cleanup ជោគជ័យ', failed.value.code === 17 && failed.value.report.cleanup === true && failed.value.report.childResult.code === 17);
}

(async () => {
    await sectionOwnedRuntime();
    await sectionProgress();
    await sectionFive();
    await sectionSix();
    sectionLock();
    console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')' : '✅ ជោគជ័យ ' + pass));
    process.exitCode = fail ? 1 : 0;
})().catch((error) => {
    console.log('  FAIL  runall-runner-test គាំង ➜ ' + (error && error.stack ? error.stack : error));
    process.exitCode = 1;
});
