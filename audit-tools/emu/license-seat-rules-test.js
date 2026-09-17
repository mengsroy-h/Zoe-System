// ថ្នាក់៖ **«Key ១ ➜ ឧបករណ៍ ១» ត្រូវអនុវត្តដោយ *rules* មិនមែនដោយ client។**
//
//   java -jar ~/.cache/firebase/emulators/firebase-database-emulator-*.jar --port 9000 --host 127.0.0.1
//   node audit-tools/emu/license-seat-rules-test.js
//
// ⛔ ហេតុអ្វីតេស្តនេះចាំបាច់ ៖ `license-seat-test.js` វាស់ថា **client គោរព
// សាលក្រម** ដោយប្រើ `fetch` ក្លែងដែលអនុវត្តច្បាប់នោះ។ តែកូដ client ទាំងអស់
// មើលឃើញដោយអ្នកប្រើ ➜ អ្នកដែលចង់ចែករំលែក Key អាចកែវា ឬហៅ REST ដោយផ្ទាល់។
// ដូច្នេះ «Key ១ ➜ ឧបករណ៍ ១» ជា **ការអះអាងអំពី Firebase rules** ៖ បើ rules
// អនុញ្ញាតការសរសេរទី ២ នោះមុខងារនេះជាការតុបតែង មិនមែនការការពារទេ។
//
// វាផ្ទុក `ZoeKeyGen/firebase-database.rules.json` **ពិត** (License Project)
// ចូល emulator រួចវាយសាកតាម REST ដូចឧបករណ៍អតិថិជនធ្វើ — **គ្មាន auth**។
'use strict';

process.exitCode = 1;

const fs = require('fs');
const path = require('path');
const http = require('http');
const { emuNamespace } = require('./ns.js');

const ROOT = process.env.LICSEATEMU_APP_DIR ? path.resolve(process.env.LICSEATEMU_APP_DIR) : path.join(__dirname, '..', '..');
const BASE = { host: '127.0.0.1', port: parseInt(process.env.LICSEATEMU_PORT || '9000', 10) };
const NS = 'ns=' + emuNamespace('demo-zoe-licseat');
const ADMIN = 'auth_variable_override=' + encodeURIComponent(JSON.stringify({ uid: 'adminUid' }));
const PLAIN = 'auth_variable_override=' + encodeURIComponent(JSON.stringify({ uid: 'someoneElse' }));

const KEY1 = 'ABCDEFGH12345678JKLM';
const DEV_A = 'DEVICEAAAAAAAAAAAAAA';
const DEV_B = 'DEVICEBBBBBBBBBBBBBB';

let pass = 0, fail = 0;
const check = (c, label, detail) => {
    if (c) { pass++; console.log('  ok    ' + label); }
    else { fail++; console.log('  FAIL  ' + label + (detail !== undefined ? '  got: ' + JSON.stringify(detail) : '')); }
};

function req(method, urlPath, body, headers) {
    return new Promise((resolve, reject) => {
        const payload = body === undefined ? null : JSON.stringify(body);
        const h = Object.assign({}, payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}, headers || {});
        const r = http.request({ ...BASE, method, path: urlPath, headers: h }, (res) => {
            let d = '';
            res.on('data', (c) => d += c);
            res.on('end', () => resolve({ status: res.statusCode, body: d }));
        });
        r.on('error', reject);
        if (payload) r.write(payload);
        r.end();
    });
}
const OWNER = { Authorization: 'Bearer owner' };
// ⛔ អតិថិជនពិតគ្មាន auth សោះ ➜ **មិនផ្ញើ header នេះ** (បើផ្ញើ ➜ ម្ចាស់
//    project ➜ រំលង rules ➜ អ្វីៗជោគជ័យទាំងអស់ = ការវាស់ក្លែងក្លាយ)។
const anon = (m, p, b) => req(m, p + (p.includes('?') ? '&' : '?') + NS, b);
const owner = (m, p, b) => req(m, p + (p.includes('?') ? '&' : '?') + NS, b, OWNER);
const asUser = (m, p, b, who) => req(m, p + (p.includes('?') ? '&' : '?') + NS + '&' + who, b, OWNER);
const allowed = (r) => r.status >= 200 && r.status < 300;
const denied = (r) => r.status === 401 || r.status === 403;

const seatPath = (keyId) => '/license_seats/ADM/' + keyId + '.json';

(async () => {
    const probe = await owner('GET', '/.json').catch(() => null);
    if (!probe || probe.status >= 500) {
        console.log('SKIP — គ្មាន RTDB emulator នៅ 127.0.0.1:' + BASE.port);
        process.exitCode = 0;
        return;
    }
    const rulesFile = path.join(ROOT, 'ZoeKeyGen/firebase-database.rules.json');
    if (!fs.existsSync(rulesFile)) {
        console.log('  FAIL  រកមិនឃើញ ' + rulesFile);
        console.log('\n0 ok, 1 FAIL');
        return;
    }
    const put = await req('PUT', '/.settings/rules.json?' + NS, JSON.parse(fs.readFileSync(rulesFile, 'utf8')), OWNER);
    if (put.status !== 200) {
        console.log('  FAIL  upload rules មិនបាន: ' + put.status + ' ' + put.body.slice(0, 120));
        console.log('\n0 ok, 1 FAIL');
        return;
    }

    await owner('PUT', '/.json', {});
    await owner('PUT', '/user_roles/adminUid.json', 'admin');
    await owner('PUT', '/license_keys/ADM/' + KEY1 + '.json', { expiresAt: 4102444800000, revoked: false });

    // ── ០. លក្ខខណ្ឌចាំបាច់ ៖ rules ពិតជា load ហើយពិតជាការពារ ─────────
    const seedCheck = await anon('PUT', '/license_keys/ADM/' + KEY1 + '.json', { expiresAt: 1, revoked: true });
    check(denied(seedCheck), '⛔ លក្ខខណ្ឌចាំបាច់ ៖ គ្មាន auth សរសេរ license_keys មិនបាន', seedCheck.status);

    // ── ១. ឧបករណ៍ទី ១ កក់កៅអី ➜ អនុញ្ញាត ───────────────────────────
    const a1 = await anon('PUT', seatPath(KEY1), { device: DEV_A, at: 1700000000000 });
    check(allowed(a1), 'ឧបករណ៍ទី ១ កក់កៅអី ➜ អនុញ្ញាត', a1.status + ' ' + a1.body.slice(0, 80));

    // ── ២. ⛔ ស្នូល ៖ ឧបករណ៍ទី ២ ដោយ Key ដដែល ➜ បដិសេធ ──────────────
    const b1 = await anon('PUT', seatPath(KEY1), { device: DEV_B, at: 1700000001000 });
    check(denied(b1), '⛔ ឧបករណ៍ទី ២ ដោយ Key ដដែល ➜ **បដិសេធ**', b1.status + ' ' + b1.body.slice(0, 80));
    const afterB = await anon('GET', seatPath(KEY1));
    check(JSON.parse(afterB.body || 'null') && JSON.parse(afterB.body).device === DEV_A,
        'ហើយកៅអីនៅជារបស់ឧបករណ៍ទី ១ ដដែល', afterB.body);

    // ── ៣. ⛔ ទិសផ្ទុយ ៖ ឧបករណ៍ដដែលសរសេរម្តងទៀត ➜ អនុញ្ញាត ──────────
    const a2 = await anon('PUT', seatPath(KEY1), { device: DEV_A, at: 1700000002000 });
    check(allowed(a2), '⛔ ទិសផ្ទុយ ៖ ឧបករណ៍ **ដដែល** សរសេរម្តងទៀត ➜ អនុញ្ញាត', a2.status);

    // ── ៤. ការលុបដោយ client ➜ បដិសេធ (បើអត់ ➜ ដោះកៅអីខ្លួនឯងបាន) ────
    const del = await anon('DELETE', seatPath(KEY1));
    check(denied(del), 'client លុបកៅអី ➜ **បដិសេធ**', del.status);
    const patchNull = await anon('PATCH', seatPath(KEY1), { device: null });
    check(denied(patchNull), 'client លុប `device` ដោយ PATCH ➜ **បដិសេធ**', patchNull.status);

    // ── ៥. រូបរាង payload ត្រូវចាក់សោ ($other / ប្រភេទ / ជួរ) ───────
    const KEY2 = 'ZZZZZZZZ87654321WXYZ';
    await owner('PUT', '/license_keys/ADM/' + KEY2 + '.json', { expiresAt: 4102444800000, revoked: false });
    const extra = await anon('PUT', seatPath(KEY2), { device: DEV_B, at: 1700000000000, seats: 99 });
    check(denied(extra) || extra.status === 400, 'វាលបន្ថែម ➜ បដិសេធ (`$other: false`)', extra.status);
    const zeroAt = await anon('PUT', seatPath(KEY2), { device: DEV_B, at: 0 });
    check(denied(zeroAt) || zeroAt.status === 400, '`at: 0` ➜ បដិសេធ', zeroAt.status);
    const shortDev = await anon('PUT', seatPath(KEY2), { device: 'ab', at: 1700000000000 });
    check(denied(shortDev) || shortDev.status === 400, '`device` ខ្លីពេក ➜ បដិសេធ', shortDev.status);
    const noAt = await anon('PUT', seatPath(KEY2), { device: DEV_B });
    check(denied(noAt) || noAt.status === 400, 'ខ្វះ `at` ➜ បដិសេធ', noAt.status);

    // ── ៦. កៅអីសម្រាប់ Key ដែល **មិនមាន** ➜ បដិសេធ (ការពារការបំពេញសំរាម) ─
    const ghost = await anon('PUT', seatPath('QQQQQQQQQQQQQQQQQQQQ'), { device: DEV_B, at: 1700000000000 });
    check(denied(ghost), 'កក់កៅអីសម្រាប់ Key ដែលមិនមាន ➜ **បដិសេធ**', ghost.status);

    // ── ៧. អានបាន តែរាយបញ្ជីមិនបាន ──────────────────────────────────
    const readOne = await anon('GET', seatPath(KEY1));
    check(allowed(readOne), 'អានកៅអីតែមួយដោយគ្មាន auth ➜ អនុញ្ញាត (client ត្រូវការវា)', readOne.status);
    const listAll = await anon('GET', '/license_seats.json');
    check(denied(listAll), 'រាយបញ្ជីកៅអីទាំងអស់ ➜ **បដិសេធ** (គ្មានការរាប់អតិថិជន)', listAll.status);
    const listApp = await anon('GET', '/license_seats/ADM.json');
    check(denied(listApp), 'រាយបញ្ជីតាម appCode ➜ **បដិសេធ**', listApp.status);

    // ── ៨. ការដោះឧបករណ៍ ៖ admin តែម្នាក់ ────────────────────────────
    const plainDel = await asUser('DELETE', seatPath(KEY1), undefined, PLAIN);
    check(denied(plainDel), 'អ្នកប្រើដែលមិនមែន admin ដោះកៅអី ➜ បដិសេធ', plainDel.status);
    const adminDel = await asUser('DELETE', seatPath(KEY1), undefined, ADMIN);
    check(allowed(adminDel), 'admin ដោះកៅអី ➜ អនុញ្ញាត (ប្តូរទូរស័ព្ទ)', adminDel.status);

    // ── ៩. ក្រោយដោះ ➜ ឧបករណ៍ថ្មីកក់បាន ──────────────────────────────
    const b2 = await anon('PUT', seatPath(KEY1), { device: DEV_B, at: 1700000003000 });
    check(allowed(b2), 'ក្រោយដោះ ➜ ឧបករណ៍ថ្មីកក់បាន', b2.status);
    const finalSeat = await anon('GET', seatPath(KEY1));
    check(JSON.parse(finalSeat.body || 'null') && JSON.parse(finalSeat.body).device === DEV_B,
        'ហើយកៅអីជារបស់ឧបករណ៍ថ្មី', finalSeat.body);
    const aBack = await anon('PUT', seatPath(KEY1), { device: DEV_A, at: 1700000004000 });
    check(denied(aBack), '⛔ ឧបករណ៍ចាស់ត្រឡប់មកវិញ ➜ បដិសេធ', aBack.status);

    console.log('\n' + pass + ' ok, ' + fail + ' FAIL');
    process.exitCode = fail === 0 ? 0 : 1;
})();
