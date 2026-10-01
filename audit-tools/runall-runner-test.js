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
    const o = Object.assign({ ms: 0, code: 0, out: ['   ok    ' + rel], hang: false, browser: false }, opts || {});
    const name = JSON.stringify(rel);
    const lines = [
        "const fs = require('fs');",
        o.browser ? '// ' + BROWSER_MARK + ' — សញ្ញា lane browser (មិនបើក browser ពិតទេ)' : '',
        "const log = (w) => fs.appendFileSync(process.env.FX_LOG, w + ' ' + " + name + " + ' ' + Date.now() + ' ' + process.pid + '\\n');",
        "log('start');"
    ];
    if (o.hang) lines.push('setInterval(() => {}, 1 << 30);');
    else {
        lines.push('setTimeout(() => {');
        for (const l of o.out) lines.push('    console.log(' + JSON.stringify(l) + ');');
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

function writeHarness(dir, body, timeoutSecs) {
    const h = path.join(dir, 'harness.sh');
    fs.writeFileSync(h,
        'pass=0; fail=0; skip=0; partial=0\n' +
        'CHECKER_TIMEOUT=' + (timeoutSecs || 30) + '\n' +
        'if command -v timeout >/dev/null 2>&1; then HAS_TIMEOUT=1; else HAS_TIMEOUT=0; fi\n' +
        block + '\n' + body + '\n' +
        'if declare -F runall_drain >/dev/null; then runall_drain || exit $?; fi\n' +
        'if declare -F runall_summary >/dev/null; then runall_summary; fi\n' +
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
    hdrA !== -1 && hdrA < par.out.indexOf('fx-00') && par.out.indexOf('fx-05') < hdrB && hdrB < par.out.indexOf('fx-06'),
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
ok('⛔ RESUME ៖ រត់ឡើងវិញតែ checker ធ្លាក់ + បាត់ (fx-f1 · fx-p3)',
    JSON.stringify(st2Started) === JSON.stringify(['audit-tools/fx-f1.js', 'audit-tools/fx-p3.js']), st2Started);
ok('RESUME ៖ លទ្ធផលមុនបង្ហាញជា ↺ ហើយរាប់ក្នុងសេចក្តីសង្ខេបពេញលេញ',
    /fx-p1[^\n]*PASS[^\n]*↺/.test(st2.out) && /↺ យកពី state មុន 3 · រត់ក្នុងជុំនេះ 2/.test(st2.out)
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
    await Promise.race([done, new Promise((r) => setTimeout(r, 20000))]);
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
            + 'for i in "${!J_KIND[@]}"; do printf \'%s\\t%s\\t%s\\t%s\\n\' "${J_KIND[$i]}" "${J_LABEL[$i]}" "${J_ID[$i]}" "${J_LANE[$i]}"; done\n'
            + 'for h in $RUNALL_HINTS; do printf \'hint\\t%s\\t%s\\t-\\n\' "${h%%:*}" "${h##*:}"; done\n');
        const r = cp.spawnSync('bash', [h], { encoding: 'utf8', timeout: 60000, env: harnessEnv(dir) });
        plan = String(r.stdout || '').split('\n').filter(Boolean).map((l) => l.split('\t'))
            .filter((p) => p[0] !== 'hdr').map(([kind, label, id, laneName]) => ({ kind, label, id, lane: laneName }));
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
    const shardStep = (wf.match(/- name: run-all\.sh \(ផ្នែក[\s\S]*?run: bash audit-tools\/run-all\.sh/) || [''])[0];
    const missingFlags = rbFlags.filter((f) => !new RegExp('\\b' + f + ":\\s*'1'").test(shardStep));
    ok('⛔ ជំហាន run-all ក្នុង CI មានទង់ STRICT ទាំងអស់របស់ Runbook (' + rbFlags.length + ') ➜ CI ស្មើការរត់ក្នុង session',
        rbFlags.length >= 4 && shardStep.length > 0 && missingFlags.length === 0, { rbFlags, missingFlags });
    ok('CI បើក RTDB emulator មុន run-all (emu/* · money-guardian ពេញ មិនមែន SKIP)',
        wf.indexOf('java -jar') !== -1 && shardStep.length > 0 && wf.indexOf('java -jar') < wf.indexOf(shardStep));
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

(async () => {
    await sectionFive();
    await sectionSix();
    sectionLock();
    console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')' : '✅ ជោគជ័យ ' + pass));
    process.exitCode = fail ? 1 : 0;
})().catch((error) => {
    console.log('  FAIL  runall-runner-test គាំង ➜ ' + (error && error.stack ? error.stack : error));
    process.exitCode = 1;
});
