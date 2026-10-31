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
// ⛔ ៨ × ៤៥ (មិនមែន ៦ × ៤០) ៖ op `heldCancel` (ការលុបចោលការស្តារដែលជាប់) និងច្បាប់សម្អាតដែលរត់ពិត (ម៉ោង Server ក្លែងពិត) ផ្លាស់កញ្ចប់ចេញពីប្រវត្តិលឿនជាងមុន
//    ➜ ៦ × ៤០ វាស់បានការសរសេរប្រវត្តិ ២៤ (< ជាន់ ៣០ របស់ probe ខាងក្រោម) និង `ztoSentOutAt` ០ · ៨ × ៤៥ ➜ ៤២ និង ១
const RUNS = parseInt(process.env.APPWRITES_RUNS || '8', 10);
const OPS = parseInt(process.env.APPWRITES_OPS || '45', 10);
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
// រាយតែ schema និងស្ថានភាព៖ មិនបង្ហាញលេខទូរស័ព្ទ អ៊ីមែល token ឬទិន្នន័យកញ្ចប់។
function structuralWrite(value, depth = 0, barcodeSlots = false) {
    if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
    if (typeof value === 'string') return { type: 'string', length: value.length };
    if (!value || typeof value !== 'object') return { type: typeof value };
    const keys = Object.keys(value);
    if (depth >= 5) return { type: Array.isArray(value) ? 'array' : 'object', count: keys.length };
    const safe = new Set(['createdAt','deletedAt','trashGeneration','restoreClaim','restoreClaimId','restoreClaimToken','restoreAddedCodes',
        'clearClaim','scanPending','pricePending','pickupPending','pickupTransition','trashClaim','trashClaimAt','barcodes',
        'isClosed','isDeducted','isFromDeletion','restoreBlocked','phase','kind','token','claimedAt','birth','rowBirth','generation','sourceCount']);
    const known = new Set([...safe, 'id','phone','email','code','barcode','locker','time','scanDate','cod','dod','price','count','origins','isCalled','trashReason','trashMode']);
    const numericSlot = key => (Array.isArray(value) || barcodeSlots) && /^(0|[1-9][0-9]{0,3})$/.test(key);
    const out = { type: Array.isArray(value) ? 'array' : 'object', fields: keys.filter(key => known.has(key)).slice(0, 40), unknownFieldCount: keys.filter(key => !known.has(key) && !numericSlot(key)).length, state: {} };
    for (const key of keys.slice(0, 40)) if (safe.has(key) || numericSlot(key)) out.state[key] = structuralWrite(value[key], depth + 1, key === 'barcodes');
    return out;
}


function capture() {
    const file = path.join(os.tmpdir(), 'app-writes-' + process.pid + '.json');
    return new Promise((resolve) => {
        execFile(process.execPath, [path.join(__dirname, '..', 'revenue-fuzz-test.js')], {
            cwd: ROOT,
            env: Object.assign({}, process.env, { FUZZ_APP_DIR: ROOT, FUZZ_CAPTURE: file, FUZZ_RUNS: String(RUNS), FUZZ_OPS: String(OPS), FUZZ_RUN0: '0' }),
            encoding: 'utf8', timeout: 240000, maxBuffer: 8 * 1024 * 1024
        }, (error, stdout, stderr) => {
            let data = null;
            try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { data = null; }
            try { fs.unlinkSync(file); } catch (e) {}
            const detail = error ? JSON.stringify({ code: error.code, signal: error.signal, killed: error.killed,
                message: String(error.message || '').slice(0, 600) }) : '';
            const tail = [String(stdout || '').trim().split('\n').slice(-3).join(' | '), detail,
                String(stderr || '').trim().slice(-2500)].filter(Boolean).join('\n');
            resolve({ ok: !error, tail, data });
        });
    });
}

async function replay(cap, rules, tag) {
    const out = { user: 0, owner: 0, denied: [], roots: new Set() };
    // namespace ដាច់សម្រាប់ probe នីមួយៗ៖ compile rules ម្តង ប៉ុន្តែ reset និងផ្ទៀង empty មុនរាល់លំដាប់។
    const ns = 'ns=' + emuNamespace('app-writes-' + tag);
    const at = (p, asUser) => p + (p.includes('?') ? '&' : '?') + ns + (asUser ? '&' + AUTH : '');
    const load = await req('PUT', at('/.settings/rules.json'), rules);
    if (load.status !== 200) throw new Error('load rules មិនបាន ៖ ' + load.status + ' ' + load.body.slice(0, 120));
    for (const run of cap) {
        const cleared = await req('PUT', at('/.json'), null);
        const empty = await req('GET', at('/.json'));
        if (cleared.status !== 200 || empty.status !== 200 || JSON.parse(empty.body) !== null) throw new Error('replay reset មិនស្អាត');
        const seeded = await req('PUT', at('/.json'), dataOf(run.seed));
        if (seeded.status !== 200) throw new Error('replay seed មិនបាន');
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
                const paths = entry.m === 'PATCH' && entry.v && typeof entry.v === 'object'
                    ? Object.keys(entry.v).map(key => (entry.p ? entry.p + '/' : '') + key) : [entry.p || '/'];
                out.denied.push({ run: run.run, i, method, path: entry.p || '/', paths, tx: !!entry.tx, why: res.body.slice(0, 120), structure: structuralWrite(entry.v) });
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

    // ⛔ ភស្តុតាង ZTO លើ barcode (`ztoSignedAt` · `ztoReturnedAt`) ៖ ផ្លូវសរសេរថ្មី (`syncZtoFinalMarks`) ➜ ការ replay ត្រូវមានការសរសេរពិត
    //    ក្នុងប្រវត្តិ ឬធុងសំរាម — rules ពិតទទួល (ខាងលើ) · probe ៖ rules ចាស់ (គ្មានវាលទាំង ២) ➜ បដិសេធ ➜ App ត្រូវសរសេរវាដាច់ពីការរក្សាទុកកញ្ចប់។
    const carriesZtoFinal = (v) => !!v && typeof v === 'object' && /"zto(Signed|Returned|Misplaced|SentOut)At"/.test(JSON.stringify(v));
    const ztoFinalWrites = cap.data.reduce((sum, run) => sum + run.log.filter((e) => !e.owner
        && (rootOf(e.p) === 'zoew_scan_history_cod_dod' || rootOf(e.p) === 'zoew_recently_deleted_cod_dod') && carriesZtoFinal(e.v)).length, 0);
    console.log('    ភស្តុតាង ZTO ៖ ការសរសេរ ' + ztoFinalWrites);
    check(ztoFinalWrites >= 1, 'ជាន់អប្បបរមា ៖ ការ replay មានការសរសេរ `ztoSignedAt`/`ztoReturnedAt` ≥ ១ (op `ztoFinal`)', 'ztoFinalWrites=' + ztoFinalWrites);
    const oldFinalRules = JSON.parse(JSON.stringify(rules));
    ['zoew_scan_history_cod_dod', 'zoew_recently_deleted_cod_dod'].forEach((root) => {
        const idx = oldFinalRules.rules[root].$itemId.barcodes.$idx;
        delete idx.ztoSignedAt;
        delete idx.ztoReturnedAt;
        delete idx.ztoMisplacedAt;
        delete idx.ztoSentOutAt;
    });
    const oldFinal = await replay(cap.data, oldFinalRules, 'old-final-rules');
    check(oldFinal.denied.length >= 1,
        'probe ទិសផ្ទុយ ៖ rules ចាស់ (គ្មាន `ztoSignedAt`/`ztoReturnedAt`) បដិសេធការកត់ភស្តុតាង ZTO ➜ App ត្រូវសរសេរវាដាច់ពីការរក្សាទុកកញ្ចប់ (`syncZtoFinalMarks`)',
        'denied=' + oldFinal.denied.length);

    // ⛔ ខុសទីតាំង (`ztoMisplacedAt` ៖ ZTO ស្កេនបញ្ជូនចេញក្រោយមកដល់ ➜ ធុងសំរាម «ត្រឡប់» ស្លាក «ខុសទីតាំង») ៖ ការ replay ត្រូវមានការសរសេរពិត ·
    //    probe ៖ rules ដែលគ្មាន `ztoMisplacedAt` (មានតែ `ztoSignedAt`/`ztoReturnedAt`) ➜ បដិសេធ ➜ ត្រូវ Publish rules ថ្មី។
    const misplacedWrites = cap.data.reduce((sum, run) => sum + run.log.filter((e) => !e.owner && rootOf(e.p) === 'zoew_recently_deleted_cod_dod'
        && !!e.v && typeof e.v === 'object' && /"ztoMisplacedAt"/.test(JSON.stringify(e.v))).length, 0);
    console.log('    ខុសទីតាំង ៖ ការសរសេរ ' + misplacedWrites);
    check(misplacedWrites >= 1, 'ជាន់អប្បបរមា ៖ ការ replay មានការសរសេរ `ztoMisplacedAt` ≥ ១ (op `ztoFinal` ឆ្លាស់)', 'misplacedWrites=' + misplacedWrites);
    const noMisplacedRules = JSON.parse(JSON.stringify(rules));
    ['zoew_scan_history_cod_dod', 'zoew_recently_deleted_cod_dod'].forEach((root) => {
        delete noMisplacedRules.rules[root].$itemId.barcodes.$idx.ztoMisplacedAt;
    });
    const noMisplaced = await replay(cap.data, noMisplacedRules, 'no-misplaced-rules');
    check(noMisplaced.denied.length >= 1,
        'probe ទិសផ្ទុយ ៖ rules គ្មាន `ztoMisplacedAt` បដិសេធការកត់ខុសទីតាំង ➜ ត្រូវ Publish rules ថ្មី',
        'denied=' + noMisplaced.denied.length);

    // ⛔ បញ្ជូនចេញ (`ztoSentOutAt` ៖ ZTO ស្កេនបញ្ជូនចេញក្រោយមកដល់ គ្មានស្កេនបញ្ហា «ទីតាំងមិនត្រឹមត្រូវ» ➜ ធុងសំរាម «ត្រឡប់» ស្លាក «បញ្ជូនចេញ» ·
    //    គ្មាន `ztoReturnedAt` ➜ ស្តារបាន) ៖ ការ replay ត្រូវមានការសរសេរពិត · probe ៖ rules គ្មាន `ztoSentOutAt` ➜ បដិសេធ ➜ ត្រូវ Publish rules ថ្មី។
    const sentOutWrites = cap.data.reduce((sum, run) => sum + run.log.filter((e) => !e.owner && rootOf(e.p) === 'zoew_recently_deleted_cod_dod'
        && !!e.v && typeof e.v === 'object' && /"ztoSentOutAt"/.test(JSON.stringify(e.v))).length, 0);
    console.log('    បញ្ជូនចេញ ៖ ការសរសេរ ' + sentOutWrites);
    check(sentOutWrites >= 1, 'ជាន់អប្បបរមា ៖ ការ replay មានការសរសេរ `ztoSentOutAt` ≥ ១ (op `ztoFinal` ឆ្លាស់)', 'sentOutWrites=' + sentOutWrites);
    const noSentOutRules = JSON.parse(JSON.stringify(rules));
    ['zoew_scan_history_cod_dod', 'zoew_recently_deleted_cod_dod'].forEach((root) => {
        delete noSentOutRules.rules[root].$itemId.barcodes.$idx.ztoSentOutAt;
    });
    const noSentOut = await replay(cap.data, noSentOutRules, 'no-sent-out-rules');
    check(noSentOut.denied.length >= 1,
        'probe ទិសផ្ទុយ ៖ rules គ្មាន `ztoSentOutAt` បដិសេធការកត់បញ្ជូនចេញ ➜ ត្រូវ Publish rules ថ្មី',
        'denied=' + noSentOut.denied.length);

    // ⛔ ធុងសំរាម «ត្រឡប់» (`trashReason: 'returned'` ៖ ច្បាប់ ៨ ថ្ងៃ និង ZTO ស្កេនត្រឡប់ ➜ ថ្នាក់តែមួយ) ៖ តម្លៃថ្មីលើផ្លូវធុងសំរាម ➜
    //    ការ replay ត្រូវមានការសរសេរពិត · rules ពិតទទួល (ខាងលើ) · probe ៖ rules ចាស់ (`expired` ជំនួស `returned`) ➜ បដិសេធ។
    const isReturnedTrash = (v) => !!v && typeof v === 'object' && v.trashReason === 'returned';
    const returnedTrash = cap.data.reduce((sum, run) => sum + run.log.filter((e) => !e.owner && rootOf(e.p) === 'zoew_recently_deleted_cod_dod'
        && isReturnedTrash(e.v)).length, 0);
    console.log('    ធុងសំរាម «ត្រឡប់» ៖ ការសរសេរ ' + returnedTrash);
    check(returnedTrash >= 1, 'ជាន់អប្បបរមា ៖ ការ replay មានការសរសេរធុងសំរាម «ត្រឡប់» ≥ ១ (sweep · op `returned`)', 'returnedTrash=' + returnedTrash);
    const oldReasonRules = JSON.parse(JSON.stringify(rules));
    const reasonRule = oldReasonRules.rules.zoew_recently_deleted_cod_dod.$itemId.trashReason;
    reasonRule['.validate'] = String(reasonRule['.validate']).replace("newData.val() === 'returned'", "newData.val() === 'expired'");
    const oldReason = await replay(cap.data, oldReasonRules, 'old-reason-rules');
    check(reasonRule['.validate'].indexOf("'returned'") === -1 && oldReason.denied.length >= returnedTrash,
        'probe ទិសផ្ទុយ ៖ rules ចាស់ (`expired` · គ្មាន `returned`) បដិសេធធុងសំរាម «ត្រឡប់» ➜ ត្រូវ Publish rules ថ្មី (ការវាស់រសើប)',
        'denied=' + oldReason.denied.length + ' returnedTrash=' + returnedTrash);

    // ⛔ សញ្ញាហាង ZTO (`zoew_settings/zto_signed_sweep`) ៖ ផ្លូវសរសេរថ្មី ➜ ការ replay ត្រូវមានការសរសេរពិតរបស់ `markZtoShopSweep()` ·
    //    rules ពិតទទួល (ខាងលើ) · probe ៖ rules ដែលគ្មាន node នេះ (ដូច rules ចាស់) ➜ បដិសេធ។
    const markerPath = p => p === 'zoew_settings/zto_signed_sweep' || p.startsWith('zoew_settings/zto_signed_sweep/');
    const sweepMarks = cap.data.reduce((sum, run) => sum + run.log.filter((e) => !e.owner && (markerPath(String(e.p || ''))
        || e.m === 'PATCH' && e.v && Object.keys(e.v).some(key => markerPath((e.p ? e.p + '/' : '') + key)))).length, 0);
    console.log('    សញ្ញាហាង ZTO ៖ ការសរសេរ ' + sweepMarks);
    check(sweepMarks >= 1, 'ជាន់អប្បបរមា ៖ ការ replay មានការសរសេរសញ្ញាហាង ZTO ≥ ១', 'sweepMarks=' + sweepMarks);
    const noMarkRules = JSON.parse(JSON.stringify(rules));
    delete noMarkRules.rules.zoew_settings.zto_signed_sweep;
    const noMark = await replay(cap.data, noMarkRules, 'no-mark-rules');
    check(noMark.denied.filter((d) => d.paths.some(markerPath)).length >= sweepMarks,
        'probe ទិសផ្ទុយ ៖ rules ចាស់ (គ្មាន `zto_signed_sweep`) បដិសេធសញ្ញាហាង (ការវាស់រសើប)',
        'denied=' + noMark.denied.length + ' sweepMarks=' + sweepMarks);

    // ⛔ ត្រាពេលអនាគត (ម៉ោង Server ខុស) មិនត្រូវកកសញ្ញាហាងទាំងហាង ➜ rules បដិសេធ > now + ១០ នាទី · ត្រាបច្ចុប្បន្ន ➜ ទទួល
    const markProbe = (stamp) => [{ run: 'mark-probe', seed: {}, log: [{ p: 'zoew_settings/zto_signed_sweep', m: 'PATCH', v: { activeAt: stamp, completeAt: stamp } }] }];
    const future = await replay(markProbe(Date.now() + 30 * 24 * 3600 * 1000), rules, 'mark-future');
    const current = await replay(markProbe(Date.now()), rules, 'mark-now');
    check(future.denied.length === 1 && current.denied.length === 0,
        'rules ពិត ៖ សញ្ញាហាងត្រាអនាគត (+៣០ ថ្ងៃ) ➜ បដិសេធ · ត្រាបច្ចុប្បន្ន ➜ ទទួល',
        'future=' + future.denied.length + ' current=' + current.denied.length);

    // ⛔ របៀបធុងសំរាមរបស់ហាង (`zoew_settings/zto_trash_mode`) ៖ ត្រាតាមឧបករណ៍ (FIXSHOP-3 ៖ `palm/<សោឧបករណ៍>` · `cookie/<សោឧបករណ៍>`) ៖
    //    `markZtoTrashMode()` សរសេរតែសោខ្លួនឯង (transaction ➜ `PUT` · App ចាស់ ➜ `PATCH`) · `withdrawZtoTrashMode()` ដកតែសោខ្លួនឯង ·
    //    `pruneZtoTrashMode()` សម្អាតត្រាចាស់របស់ឧបករណ៍ផ្សេង ➜
    //    ការ replay ត្រូវមានផ្លូវទាំង ៣ ពិត · rules ពិតទទួល (ខាងលើ) · probe ៖ rules គ្មាន node នេះ ➜ បដិសេធ · ត្រាអនាគត · សោឧបករណ៍ខុសទម្រង់ ·
    //    កូនសោក្រៅ palm/cookie · primitive ជំនួស object ➜ បដិសេធ · ត្រាបច្ចុប្បន្ន និងការលុបសោ ➜ ទទួល ·
    //    ⛔ រាងចាស់ `palmAt`/`cookieAt` (Phase B ៖ គ្មាន compat មុន launch) ➜ បដិសេធ គ្រប់តម្លៃ · palmAt ដែលនៅសល់ក្នុង DB មិនរារាំងត្រាថ្មី ហើយលុបបាន
    const modePath = p => p === 'zoew_settings/zto_trash_mode' || p.startsWith('zoew_settings/zto_trash_mode/');
    const modeDevicePath = /^zoew_settings\/zto_trash_mode\/(palm|cookie)\/([^/]+)$/;
    const modeMarks = cap.data.reduce((sum, run) => sum + run.log.filter((e) => !e.owner && (e.m === 'PUT' && modeDevicePath.test(String(e.p || '')) && typeof e.v === 'number'
        || e.m === 'PATCH' && e.v && Object.keys(e.v).some(key => modeDevicePath.test((e.p ? e.p + '/' : '') + key) && typeof e.v[key] === 'number'))).length, 0);
    const modeOps = cap.data.reduce((sum, run) => sum + run.log.filter((e) => !e.owner && (modePath(String(e.p || ''))
        || e.m === 'PATCH' && e.v && Object.keys(e.v).some(key => modePath((e.p ? e.p + '/' : '') + key)))).length, 0);
    const modeDeletes = (pick) => cap.data.reduce((sum, run) => sum + run.log.filter((e) => {
        const hit = !e.owner && e.v === null && modeDevicePath.exec(String(e.p || ''));
        return !!hit && pick(hit[2]);
    }).length, 0);
    const modeWithdraws = modeDeletes((device) => device !== 'fuzzolddevice01');
    const modePrunes = modeDeletes((device) => device === 'fuzzolddevice01');
    console.log('    របៀបធុងសំរាមហាង ៖ ត្រា ' + modeMarks + ' · ដកត្រាខ្លួនឯង ' + modeWithdraws + ' · សម្អាតត្រាចាស់ ' + modePrunes + ' · សរុប ' + modeOps);
    check(modeMarks >= 1, 'ជាន់អប្បបរមា ៖ ការ replay មានការសរសេរត្រារបៀបធុងសំរាមហាងលើសោឧបករណ៍ (`palm|cookie/<សោ>`) ≥ ១', 'modeMarks=' + modeMarks);
    check(modeWithdraws >= 1, 'ជាន់អប្បបរមា ៖ ការ replay មានការដកត្រារបៀបហាងរបស់ខ្លួន (`withdrawZtoTrashMode()` ៖ សោខ្លួនឯង) ≥ ១', 'modeWithdraws=' + modeWithdraws);
    check(modePrunes >= 1, 'ជាន់អប្បបរមា ៖ ការ replay មានការសម្អាតត្រាចាស់របស់ឧបករណ៍ផ្សេង (`pruneZtoTrashMode()`) ≥ ១', 'modePrunes=' + modePrunes);
    const noModeRules = JSON.parse(JSON.stringify(rules));
    delete noModeRules.rules.zoew_settings.zto_trash_mode;
    const noMode = await replay(cap.data, noModeRules, 'no-mode-rules');
    check(noMode.denied.filter((d) => d.paths.some(modePath)).length >= modeOps,
        'probe ទិសផ្ទុយ ៖ rules ចាស់ (គ្មាន `zto_trash_mode`) បដិសេធរបៀបធុងសំរាមហាង (ការវាស់រសើប)',
        'denied=' + noMode.denied.length + ' modeOps=' + modeOps);
    const modeProbe = (v) => [{ run: 'mode-probe', seed: {}, log: [{ p: 'zoew_settings/zto_trash_mode', m: 'PATCH', v }] }];
    const probeNow = Date.now();
    const modeDenied = {
        future: { 'palm/probedevice1': probeNow + 30 * 24 * 3600 * 1000 },
        'short-key': { 'palm/short': probeNow },
        'long-key': { ['cookie/' + 'k'.repeat(33)]: probeNow },
        text: { 'palm/probedevice1': String(probeNow) },
        other: { localAt: probeNow },
        'old-palm-future': { palmAt: probeNow + 30 * 24 * 3600 * 1000 },
        'old-cookie-text': { cookieAt: String(probeNow) },
        'old-palm-zero': { palmAt: 0 },
        'legacy-palm': { palmAt: probeNow },
        'legacy-cookie': { cookieAt: probeNow },
        primitive: { palm: probeNow }
    };
    const modeDeniedSeen = {};
    for (const [tag, v] of Object.entries(modeDenied)) modeDeniedSeen[tag] = (await replay(modeProbe(v), rules, 'mode-' + tag)).denied.length;
    const modeNow = await replay(modeProbe({ 'palm/probedevice1': probeNow, 'cookie/probedevice2': probeNow }), rules, 'mode-now');
    const modeDrop = await replay([{ run: 'mode-drop', seed: { zoew_settings: { zto_trash_mode: { palm: { probedevice1: probeNow, probedevice3: probeNow } } } },
        log: [{ p: 'zoew_settings/zto_trash_mode/palm/probedevice1', m: 'PUT', v: null }] }], rules, 'mode-drop');
    const modeBesideLegacy = await replay([{ run: 'mode-legacy', seed: { zoew_settings: { zto_trash_mode: { palmAt: probeNow - 3600 * 1000 } } },
        log: [{ p: 'zoew_settings/zto_trash_mode', m: 'PATCH', v: { 'palm/probedevice1': probeNow } },
            { p: 'zoew_settings/zto_trash_mode/palmAt', m: 'PUT', v: null }] }], rules, 'mode-legacy');
    const modeLegacyApp = await replay([{ run: 'mode-legacy-app', seed: { zoew_settings: { zto_trash_mode: { palm: { probedevice1: probeNow } } } },
        log: [{ p: 'zoew_settings/zto_trash_mode', m: 'PATCH', v: { palmAt: probeNow } },
            { p: 'zoew_settings/zto_trash_mode', m: 'PATCH', v: { cookieAt: probeNow } },
            { p: 'zoew_settings/zto_trash_mode/cookieAt', m: 'PUT', v: null }] }], rules, 'mode-legacy-app');
    check(Object.values(modeDeniedSeen).every((n) => n === 1) && modeNow.denied.length === 0 && modeDrop.denied.length === 0
        && modeBesideLegacy.denied.length === 0 && modeLegacyApp.denied.length === 2,
        'rules ពិត ៖ របៀបធុងសំរាមហាង ត្រាអនាគត · សោឧបករណ៍ខុសទម្រង់ · អក្សរ · កូនសោផ្សេង · ⛔ palmAt/cookieAt គ្រប់តម្លៃ · primitive ➜ បដិសេធ · ត្រាបច្ចុប្បន្នលើសោឧបករណ៍ · ការលុបសោ · ត្រាថ្មីក្បែរ palmAt ចាស់ដែលនៅសល់ និងការលុបវា ➜ ទទួល · APK ចាស់សរសេរ palmAt/cookieAt ➜ បដិសេធ ២ (ការលុប cookieAt ទទួល)',
        JSON.stringify(modeDeniedSeen) + ' now=' + modeNow.denied.length + ' drop=' + modeDrop.denied.length + ' legacy=' + modeBesideLegacy.denied.length
        + ' legacyApp=' + modeLegacyApp.denied.length);

    // ⛔ ជម្រើស ឃ ៖ វេនអានបញ្ជី Sign របស់សាខា (`zoew_settings/zto_sweep_lead/<lane>`) ៖ `claimZtoSweepLane()` (transaction ➜ `PUT { device, at }`) ➜
    //    ការ replay ត្រូវមានការកក់ពិត (បង្កើត + ជាន់វេនចាស់របស់ឧបករណ៍ផ្សេង) · rules ពិតទទួល (ខាងលើ) · probe ៖ rules គ្មាន node នេះ ➜ បដិសេធ ·
    //    ត្រាអនាគត · ត្រា 0 ឬអក្សរ · device ខុសទម្រង់ ឬគ្មាន · កូនសោផ្សេង · primitive · lane ខ្លី/វែងពេក ➜ បដិសេធ · ការកក់បច្ចុប្បន្ន និងការលុប lane ➜ ទទួល
    const lanePath = p => p === 'zoew_settings/zto_sweep_lead' || p.startsWith('zoew_settings/zto_sweep_lead/');
    const laneClaims = cap.data.reduce((sum, run) => sum + run.log.filter((e) => !e.owner && (lanePath(String(e.p || ''))
        || e.m === 'PATCH' && e.v && Object.keys(e.v).some(key => lanePath((e.p ? e.p + '/' : '') + key)))).length, 0);
    console.log('    វេនអានសាខា ៖ ការកក់ ' + laneClaims);
    check(laneClaims >= 2, 'ជាន់អប្បបរមា ៖ ការ replay មានការកក់វេនអានសាខា (`claimZtoSweepLane()` ៖ បង្កើត + ជាន់វេនចាស់) ≥ ២', 'laneClaims=' + laneClaims);
    const noLaneRules = JSON.parse(JSON.stringify(rules));
    delete noLaneRules.rules.zoew_settings.zto_sweep_lead;
    const noLane = await replay(cap.data, noLaneRules, 'no-lane-rules');
    check(noLane.denied.filter((d) => d.paths.some(lanePath)).length >= laneClaims,
        'probe ទិសផ្ទុយ ៖ rules ចាស់ (គ្មាន `zto_sweep_lead`) បដិសេធការកក់វេនអានសាខា (ការវាស់រសើប)',
        'denied=' + noLane.denied.length + ' laneClaims=' + laneClaims);
    const laneProbe = (lane, v) => [{ run: 'lane-probe', seed: {}, log: [{ p: 'zoew_settings/zto_sweep_lead/' + lane, m: 'PUT', v }] }];
    const laneOk = { device: 'probedevice1', at: probeNow };
    const laneDenied = {
        future: ['cookie_zoew123_com', { device: 'probedevice1', at: probeNow + 30 * 24 * 3600 * 1000 }],
        zero: ['cookie_zoew123_com', { device: 'probedevice1', at: 0 }],
        text: ['cookie_zoew123_com', { device: 'probedevice1', at: String(probeNow) }],
        'short-device': ['cookie_zoew123_com', { device: 'short', at: probeNow }],
        'long-device': ['cookie_zoew123_com', { device: 'd'.repeat(33), at: probeNow }],
        'no-device': ['cookie_zoew123_com', { at: probeNow }],
        other: ['cookie_zoew123_com', { device: 'probedevice1', at: probeNow, extra: 1 }],
        primitive: ['cookie_zoew123_com', probeNow],
        'short-lane': ['palm_', laneOk],
        'long-lane': ['palm_' + '9'.repeat(43), laneOk]
    };
    const laneDeniedSeen = {};
    for (const [tag, [lane, v]] of Object.entries(laneDenied)) laneDeniedSeen[tag] = (await replay(laneProbe(lane, v), rules, 'lane-' + tag)).denied.length;
    const laneNow = await replay(laneProbe('palm_85501', laneOk), rules, 'lane-now');
    const laneDrop = await replay([{ run: 'lane-drop', seed: { zoew_settings: { zto_sweep_lead: { palm_85501: laneOk, cookie_zoew123_com: laneOk } } },
        log: [{ p: 'zoew_settings/zto_sweep_lead/palm_85501', m: 'PUT', v: null }] }], rules, 'lane-drop');
    check(Object.values(laneDeniedSeen).every((n) => n === 1) && laneNow.denied.length === 0 && laneDrop.denied.length === 0,
        'rules ពិត ៖ វេនអានសាខា ត្រាអនាគត · 0 · អក្សរ · device ខុសទម្រង់ ឬគ្មាន · កូនសោផ្សេង · primitive · lane ខ្លី/វែងពេក ➜ បដិសេធ · ការកក់បច្ចុប្បន្ន · ការលុប lane ➜ ទទួល',
        JSON.stringify(laneDeniedSeen) + ' now=' + laneNow.denied.length + ' drop=' + laneDrop.denied.length);

    console.log('\n' + pass + ' ok, ' + fail + ' FAIL');
    process.exitCode = fail ? 1 : 0;
})().catch((e) => { console.log('  FAIL  ' + (e && e.stack || e)); process.exit(1); });
