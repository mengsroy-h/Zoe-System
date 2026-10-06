// ការសរសេរពិតរបស់ App ↔ Firebase rules ពិត (RTDB emulator)
//
// ⛔ ហេតុអ្វី (2.45.4) ៖ fake SDK របស់ checker browser ទទួលការសរសេរ **ណាក៏ដោយ** ➜ «server ពិតបដិសេធការសរសេរធម្មតារបស់ App»
//    ជារបៀបបរាជ័យដែលគ្មាននរណាវាស់ ក្រៅពី ៤ ផ្លូវក្នុង `emu/crud-rules-flow` (បិទ/បើក · ដក · លុប · លុបជាអចិន្ត្រៃយ៍)។ ការប្តូរ rules
//    (ឧ. `.validate: "newData.hasChildren()"` លើ node ដែលរំពឹង object) ត្រូវការភស្តុតាងថា **រាល់ផ្លូវសរសេរ** របស់ App នៅតែទទួល។
//
// វិធី ៖ រត់ `revenue-fuzz-test.js` (App ពិតក្នុង Chromium · ស្កេន · បិទ/បើក · ដក · លុប · ស្តារ · កែតម្លៃ · សម្អាត ២ម៉ោង/៧ថ្ងៃ ·
//    «ឧបករណ៍ផ្សេង») ជាមួយ `FUZZ_CAPTURE` ➜ ចាក់ការសរសេរតាមលំដាប់ពិតទៅ emulator ជាមួយ `firebase-database.rules.json` ពិត ៖
//    ការសរសេររបស់ App ➜ user (`auth != null`) · ការប្តូររបស់ harness ➜ owner (រំលង rules ដូច Console)។ ការបដិសេធណាមួយ = FAIL។
//    ការសរសេរដែលត្រូវបដិសេធ ត្រូវចាក់ជា owner បន្ត ➜ ស្ថានភាព server នៅដូច fake (ការបដិសេធមួយមិនបង្កការបដិសេធតៗគ្នាក្លែងក្លាយ)។
//
// ⛔ probe ទិសផ្ទុយ (ការវាស់រសើប) ៖ rules ពិតដែល record ប្រវត្តិ `.validate` = `false` ➜ ការសរសេរប្រវត្តិទាំងអស់ត្រូវបដិសេធ។
// ⛔ ជាន់អប្បបរមា ៖ ការសរសេរ user ≥ ១៥០ · ត្រូវគ្រប root ដែលផ្លូវអាជីវកម្មសរសេរ (ប្រវត្តិ · ធុងសំរាម · multipath root · ledger ថ្ងៃ/ខែ ·
//    ស្ថិតិយក · កញ្ចក់ចំណូល · registry · finalization ស្តារ)។
//
//   java -jar ~/.cache/firebase/emulators/firebase-database-emulator-*.jar --port 9000 --host 127.0.0.1
//   node audit-tools/emu/app-writes-rules-test.js
'use strict';
process.exitCode = 1;
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { execFile } = require('child_process');
const { emuNamespace } = require('./ns.js');

const ROOT = process.env.APPWRITES_APP_DIR ? path.resolve(process.env.APPWRITES_APP_DIR) : path.join(__dirname, '..', '..');
const STRICT = process.env.APPWRITES_STRICT === '1' || process.env.CRUD_FLOW_STRICT === '1';
const RUNS = parseInt(process.env.APPWRITES_RUNS || '6', 10);
const OPS = parseInt(process.env.APPWRITES_OPS || '40', 10);
const MIN_USER_WRITES = 150;
const REQUIRED_ROOTS = ['zoew_scan_history_cod_dod', 'zoew_recently_deleted_cod_dod', '(root)', 'zoew_daily_revenue_cod_dod',
    'zoew_monthly_revenue_cod_dod', 'zoew_daily_pickup_cod_dod', 'zoew_daily_collected_cod_dod', 'zoew_barcode_registry',
    'zoew_restore_finalizations'];
const AUTH = 'auth_variable_override=' + encodeURIComponent(JSON.stringify({ uid: 'admin-uid' }));

let pass = 0, fail = 0;
const check = (c, label, detail) => {
    if (c) { pass++; console.log('  ok    ' + label); } else { fail++; console.log('  FAIL  ' + label + (detail ? '\n        ' + detail : '')); }
};

function req(method, urlPath, body) {
    return new Promise((resolve, reject) => {
        const payload = body === undefined ? null : JSON.stringify(body);
        const r = http.request({ host: '127.0.0.1', port: 9000, method, path: urlPath, timeout: 15000,
            headers: Object.assign({ Authorization: 'Bearer owner' }, payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}) },
        (res) => { let d = ''; res.on('data', (c) => { d += c; }); res.on('end', () => resolve({ status: res.statusCode, body: d })); });
        r.on('timeout', () => r.destroy(new Error('emulator timed out')));
        r.on('error', reject);
        if (payload) r.write(payload);
        r.end();
    });
}
const denied = (r) => r.status >= 400 || /Permission denied/i.test(r.body);
const withServerValues = (v) => {
    if (Array.isArray(v)) return v.map(withServerValues);
    if (v && typeof v === 'object') {
        if (typeof v.__increment === 'number') return { '.sv': { increment: v.__increment } };
        const out = {};
        for (const k of Object.keys(v)) out[k] = withServerValues(v[k]);
        return out;
    }
    return v;
};
const dataOf = (s) => { const c = JSON.parse(JSON.stringify(s || {})); delete c._dateKey; return c; };
const rootOf = (p) => String(p || '').split('/').filter(Boolean)[0] || '(root)';

function capture() {
    const file = path.join(os.tmpdir(), 'app-writes-' + process.pid + '.json');
    return new Promise((resolve) => {
        execFile(process.execPath, [path.join(__dirname, '..', 'revenue-fuzz-test.js')], {
            cwd: ROOT,
            env: Object.assign({}, process.env, { FUZZ_APP_DIR: ROOT, FUZZ_CAPTURE: file, FUZZ_RUNS: String(RUNS), FUZZ_OPS: String(OPS), FUZZ_RUN0: '0' }),
            encoding: 'utf8', timeout: 240000, maxBuffer: 8 * 1024 * 1024
        }, (error, stdout) => {
            let data = null;
            try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { data = null; }
            try { fs.unlinkSync(file); } catch (e) {}
            resolve({ ok: !error, tail: String(stdout || '').trim().split('\n').slice(-3).join(' | '), data });
        });
    });
}

async function replay(cap, rules, tag) {
    const out = { user: 0, owner: 0, denied: [], roots: new Set() };
    for (const run of cap) {
        const ns = 'ns=' + emuNamespace('app-writes-' + tag);
        const at = (p, asUser) => p + (p.includes('?') ? '&' : '?') + ns + (asUser ? '&' + AUTH : '');
        const load = await req('PUT', at('/.settings/rules.json'), rules);
        if (load.status !== 200) throw new Error('load rules មិនបាន ៖ ' + load.status + ' ' + load.body.slice(0, 120));
        await req('PUT', at('/.json'), dataOf(run.seed));
        const live = await req('PUT', at('/zoew_daily_revenue_cod_dod/2000-01-01/codDollar.json', true), -1);
        if (!denied(live)) throw new Error('rules មិនរស់ ៖ ledger អវិជ្ជមានត្រូវទទួល');
        for (let i = 0; i < run.log.length; i++) {
            const entry = run.log[i];
            if (!entry || entry.bad) throw new Error('capture ខូច ៖ ' + JSON.stringify(entry));
            if (entry.owner) {
                out.owner++;
                if (entry.m === 'SNAP') await req('PUT', at('/.json'), dataOf(entry.v));
                else await req('PUT', at('/' + entry.p + '.json'), withServerValues(entry.v));
                continue;
            }
            out.user++;
            out.roots.add(rootOf(entry.p));
            const method = entry.m === 'PATCH' ? 'PATCH' : 'PUT';
            const body = withServerValues(entry.v);
            const res = await req(method, at('/' + (entry.p || '') + '.json', true), body);
            if (denied(res)) {
                out.denied.push({ run: run.run, i, method, path: entry.p || '/', tx: !!entry.tx, why: res.body.slice(0, 120), value: JSON.stringify(entry.v).slice(0, 160) });
                await req(method, at('/' + (entry.p || '') + '.json'), body);
            }
        }
        await req('PUT', at('/.json'), null);
    }
    return out;
}

(async () => {
    console.log('app-writes-rules — ការសរសេរពិតរបស់ App (revenue-fuzz) ធៀបនឹង firebase rules ពិត (RTDB emulator)\n');
    const reach = await req('GET', '/.json?ns=' + emuNamespace('app-writes-probe')).catch(() => null);
    if (!reach || reach.status >= 500) {
        if (STRICT) {
            console.log('  FAIL  តភ្ជាប់ RTDB emulator (127.0.0.1:9000) មិនបាន — STRICT ➜ ការ SKIP រាប់ជាការធ្លាក់');
            process.exit(1);
        }
        console.log('SKIP — គ្មាន RTDB emulator នៅ 127.0.0.1:9000');
        process.exitCode = 0;
        return;
    }
    let rules = null;
    try { rules = JSON.parse(fs.readFileSync(path.join(ROOT, 'firebase-database.rules.json'), 'utf8')); } catch (e) { rules = null; }
    check(!!(rules && rules.rules && rules.rules.zoew_scan_history_cod_dod && rules.rules.zoew_scan_history_cod_dod.$itemId),
        'អាន firebase-database.rules.json ពិត (មាន node record ប្រវត្តិ)');
    if (!rules || !rules.rules || !rules.rules.zoew_scan_history_cod_dod || !rules.rules.zoew_scan_history_cod_dod.$itemId) {
        console.log('\n' + pass + ' ok, ' + fail + ' FAIL');
        process.exit(1);
    }

    const cap = await capture();
    const writes = cap.data ? cap.data.reduce((sum, run) => sum + run.log.length, 0) : 0;
    check(cap.ok && Array.isArray(cap.data) && cap.data.length === RUNS,
        'revenue-fuzz (App ពិត) រត់ជោគជ័យ ហើយ capture ' + RUNS + ' លំដាប់', cap.tail);
    if (!cap.ok || !Array.isArray(cap.data) || !cap.data.length) {
        console.log('\n' + pass + ' ok, ' + fail + ' FAIL');
        process.exit(1);
    }

    const real = await replay(cap.data, rules, 'real');
    console.log('    rules ពិត ៖ user ' + real.user + ' · owner ' + real.owner + ' · បដិសេធ ' + real.denied.length + ' · root ' + JSON.stringify([...real.roots].sort()));
    check(real.user >= MIN_USER_WRITES, 'ជាន់អប្បបរមា ៖ ការសរសេររបស់ App ≥ ' + MIN_USER_WRITES + ' (សរុប ' + writes + ')', 'user=' + real.user);
    const missing = REQUIRED_ROOTS.filter((r) => !real.roots.has(r));
    check(missing.length === 0, 'គ្រប root ដែលផ្លូវអាជីវកម្មសរសេរ (' + REQUIRED_ROOTS.length + ')', 'ខ្វះ ' + missing.join(' · '));
    check(real.denied.length === 0, '⛔ rules ពិតទទួលរាល់ការសរសេររបស់ App (' + real.user + ')',
        real.denied.slice(0, 6).map((d) => JSON.stringify(d)).join('\n        '));

    const probeRules = JSON.parse(JSON.stringify(rules));
    probeRules.rules.zoew_scan_history_cod_dod.$itemId['.validate'] = 'false';
    const probe = await replay(cap.data, probeRules, 'probe');
    // `.validate` មិនរត់លើការលុប (`null`) ➜ រាប់តែការសរសេរប្រវត្តិដែលមានតម្លៃ
    const historyWrites = cap.data.reduce((sum, run) => sum + run.log.filter((e) => !e.owner && rootOf(e.p) === 'zoew_scan_history_cod_dod' && e.v !== null).length, 0);
    console.log('    probe (record ប្រវត្តិ `.validate: false`) ៖ បដិសេធ ' + probe.denied.length + ' / ការសរសេរប្រវត្តិដែលមានតម្លៃ ' + historyWrites);
    check(historyWrites >= 30 && probe.denied.length >= historyWrites,
        'probe ទិសផ្ទុយ ៖ rules ដែលបដិសេធ record ប្រវត្តិ ➜ ការ replay ឃើញការបដិសេធ (ការវាស់រសើប)',
        'denied=' + probe.denied.length + ' historyWrites=' + historyWrites);

    // ⛔ ប្រភពកញ្ចប់ (`origins`) ៖ ផ្លូវសរសេរថ្មី ➜ ការ replay ត្រូវមានការសរសេរប្រភពពិត និងការចម្លងកញ្ចប់ដែលមានប្រភពទៅធុងសំរាម
    //    (លុប/ដក/សម្អាត) ឬត្រឡប់ (ស្តារ) — rules ពិតទទួលទាំងអស់ (ខាងលើ) · probe ៖ rules ដែលគ្មាន `origins` (ដូច rules ចាស់) ➜ បដិសេធ។
    const carriesOrigins = (v) => !!v && typeof v === 'object' && JSON.stringify(v).indexOf('"origins"') !== -1;
    const originPaths = cap.data.reduce((sum, run) => sum + run.log.filter((e) => !e.owner && rootOf(e.p) === 'zoew_scan_history_cod_dod'
        && carriesOrigins(e.v)).length, 0);
    const trashWithOrigins = cap.data.reduce((sum, run) => sum + run.log.filter((e) => !e.owner
        && (rootOf(e.p) === 'zoew_recently_deleted_cod_dod' || (e.m === 'PATCH' && e.v && Object.keys(e.v).some((k) => k.indexOf('zoew_recently_deleted_cod_dod') === 0 && carriesOrigins(e.v[k]))))
        && carriesOrigins(e.v)).length, 0);
    console.log('    ប្រភព ៖ ការសរសេរ origins ' + originPaths + ' · ការចម្លងទៅធុងសំរាមដែលមាន origins ' + trashWithOrigins);
    check(originPaths >= 3, 'ជាន់អប្បបរមា ៖ ការ replay មានការសរសេរប្រវត្តិដែលមាន `origins` (transaction ប្រភព · កែកញ្ចប់ក្រោយ) ≥ ៣', 'originPaths=' + originPaths);
    check(trashWithOrigins >= 1, 'ជាន់អប្បបរមា ៖ ការ replay ចម្លងកញ្ចប់ដែលមានប្រភពទៅធុងសំរាម ≥ ១ (rules ធុងសំរាមត្រូវទទួល)', 'trashWithOrigins=' + trashWithOrigins);
    const oldRules = JSON.parse(JSON.stringify(rules));
    delete oldRules.rules.zoew_scan_history_cod_dod.$itemId.origins;
    delete oldRules.rules.zoew_recently_deleted_cod_dod.$itemId.origins;
    const old = await replay(cap.data, oldRules, 'old-rules');
    check(old.denied.length >= originPaths,
        'probe ទិសផ្ទុយ ៖ rules ចាស់ (គ្មាន `origins`) បដិសេធការសរសេរប្រភព ➜ App ត្រូវសរសេរវាដាច់ពីការរក្សាទុកកញ្ចប់ (`saveBarcodeOrigins`)',
        'denied=' + old.denied.length + ' originPaths=' + originPaths);

    console.log('\n' + pass + ' ok, ' + fail + ' FAIL');
    process.exitCode = fail ? 1 : 0;
})().catch((e) => { console.log('  FAIL  ' + (e && e.stack || e)); process.exit(1); });
