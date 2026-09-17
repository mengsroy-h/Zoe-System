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

// ⛔ កូដ App និងឈ្មោះ slot ត្រូវដេរីវេពីកូដ ship មិនមែនចាក់ជា literal។
const APP = (fs.readFileSync(path.join(ROOT, 'ZoeKeyGen/app.js'), 'utf8')
    .match(/^const LICENSE_APP_CODE = '([A-Z]{2,8})';$/m) || [])[1] || 'ZOE';
const SLOTS = ((fs.readFileSync(path.join(ROOT, 'ZoeKeyGen/app.js'), 'utf8')
    .match(/const LICENSE_SEAT_SLOT_NAMES = \[([^\]]*)\]/) || [])[1] || "'d1'")
    .split(',').map((x) => x.trim().replace(/^'|'$/g, '')).filter(Boolean);

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

const seatPath = (keyId, slot) => '/license_seats/' + APP + '/' + keyId
    + (slot ? '/' + slot : '') + '.json';
const keyPath = (keyId) => '/license_keys/' + APP + '/' + keyId + '.json';

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
    await owner('PUT', keyPath(KEY1), { expiresAt: 4102444800000, revoked: false });

    // ── ០. លក្ខខណ្ឌចាំបាច់ ៖ rules ពិតជា load ហើយពិតជាការពារ ─────────
    const seedCheck = await anon('PUT', keyPath(KEY1), { expiresAt: 1, revoked: true });
    check(denied(seedCheck), '⛔ លក្ខខណ្ឌចាំបាច់ ៖ គ្មាន auth សរសេរ license_keys មិនបាន', seedCheck.status);

    // ── ១. ឧបករណ៍ទី ១ កក់កៅអី ➜ អនុញ្ញាត ───────────────────────────
    const a1 = await anon('PUT', seatPath(KEY1, SLOTS[0]), { device: DEV_A, at: 1700000000000 });
    check(allowed(a1), 'ឧបករណ៍ទី ១ កក់កៅអី ➜ អនុញ្ញាត', a1.status + ' ' + a1.body.slice(0, 80));

    // ── ២. ⛔ ស្នូល ៖ ឧបករណ៍ទី ២ ដោយ Key ដដែល ➜ បដិសេធ ──────────────
    const b1 = await anon('PUT', seatPath(KEY1, SLOTS[0]), { device: DEV_B, at: 1700000001000 });
    check(denied(b1), '⛔ ឧបករណ៍ទី ២ ដោយ Key ដដែល ➜ **បដិសេធ**', b1.status + ' ' + b1.body.slice(0, 80));
    const afterB = await anon('GET', seatPath(KEY1, SLOTS[0]));
    check(JSON.parse(afterB.body || 'null') && JSON.parse(afterB.body).device === DEV_A,
        'ហើយកៅអីនៅជារបស់ឧបករណ៍ទី ១ ដដែល', afterB.body);

    // ── ៣. ⛔ ទិសផ្ទុយ ៖ ឧបករណ៍ដដែលសរសេរម្តងទៀត ➜ អនុញ្ញាត ──────────
    const a2 = await anon('PUT', seatPath(KEY1, SLOTS[0]), { device: DEV_A, at: 1700000002000 });
    check(allowed(a2), '⛔ ទិសផ្ទុយ ៖ ឧបករណ៍ **ដដែល** សរសេរម្តងទៀត ➜ អនុញ្ញាត', a2.status);

    // ── ៤. ការលុបដោយ client ➜ បដិសេធ (បើអត់ ➜ ដោះកៅអីខ្លួនឯងបាន) ────
    const del = await anon('DELETE', seatPath(KEY1, SLOTS[0]));
    check(denied(del), 'client លុបកៅអី ➜ **បដិសេធ**', del.status);
    const patchNull = await anon('PATCH', seatPath(KEY1, SLOTS[0]), { device: null });
    check(denied(patchNull), 'client លុប `device` ដោយ PATCH ➜ **បដិសេធ**', patchNull.status);

    // ── ៥. រូបរាង payload ត្រូវចាក់សោ ($other / ប្រភេទ / ជួរ) ───────
    const KEY2 = 'ZZZZZZZZ87654321WXYZ';
    await owner('PUT', keyPath(KEY2), { expiresAt: 4102444800000, revoked: false });
    const extra = await anon('PUT', seatPath(KEY2, SLOTS[0]), { device: DEV_B, at: 1700000000000, seats: 99 });
    check(denied(extra) || extra.status === 400, 'វាលបន្ថែម ➜ បដិសេធ (`$other: false`)', extra.status);
    const zeroAt = await anon('PUT', seatPath(KEY2, SLOTS[0]), { device: DEV_B, at: 0 });
    check(denied(zeroAt) || zeroAt.status === 400, '`at: 0` ➜ បដិសេធ', zeroAt.status);
    const shortDev = await anon('PUT', seatPath(KEY2, SLOTS[0]), { device: 'ab', at: 1700000000000 });
    check(denied(shortDev) || shortDev.status === 400, '`device` ខ្លីពេក ➜ បដិសេធ', shortDev.status);
    const noAt = await anon('PUT', seatPath(KEY2, SLOTS[0]), { device: DEV_B });
    check(denied(noAt) || noAt.status === 400, 'ខ្វះ `at` ➜ បដិសេធ', noAt.status);

    // ── ៦. កៅអីសម្រាប់ Key ដែល **មិនមាន** ➜ បដិសេធ (ការពារការបំពេញសំរាម) ─
    const ghost = await anon('PUT', seatPath('QQQQQQQQQQQQQQQQQQQQ', SLOTS[0]), { device: DEV_B, at: 1700000000000 });
    check(denied(ghost), 'កក់កៅអីសម្រាប់ Key ដែលមិនមាន ➜ **បដិសេធ**', ghost.status);

    // ── ៧. អានបាន តែរាយបញ្ជីមិនបាន ──────────────────────────────────
    const readOne = await anon('GET', seatPath(KEY1));
    check(allowed(readOne), 'អានកៅអីតែមួយដោយគ្មាន auth ➜ អនុញ្ញាត (client ត្រូវការវា)', readOne.status);
    const listAll = await anon('GET', '/license_seats.json');
    check(denied(listAll), 'រាយបញ្ជីកៅអីទាំងអស់ ➜ **បដិសេធ** (គ្មានការរាប់អតិថិជន)', listAll.status);
    const listApp = await anon('GET', '/license_seats/' + APP + '.json');
    check(denied(listApp), 'រាយបញ្ជីតាម appCode ➜ **បដិសេធ**', listApp.status);

    // ── ៨. ការដោះឧបករណ៍ ៖ admin តែម្នាក់ ────────────────────────────
    const plainDel = await asUser('DELETE', seatPath(KEY1), undefined, PLAIN);
    check(denied(plainDel), 'អ្នកប្រើដែលមិនមែន admin ដោះកៅអី ➜ បដិសេធ', plainDel.status);
    const adminDel = await asUser('DELETE', seatPath(KEY1), undefined, ADMIN);
    check(allowed(adminDel), 'admin ដោះកៅអី ➜ អនុញ្ញាត (ប្តូរទូរស័ព្ទ)', adminDel.status);

    // ── ៩. ក្រោយដោះ ➜ ឧបករណ៍ថ្មីកក់បាន ──────────────────────────────
    const b2 = await anon('PUT', seatPath(KEY1, SLOTS[0]), { device: DEV_B, at: 1700000003000 });
    check(allowed(b2), 'ក្រោយដោះ ➜ ឧបករណ៍ថ្មីកក់បាន', b2.status);
    const finalSeat = await anon('GET', seatPath(KEY1, SLOTS[0]));
    check(JSON.parse(finalSeat.body || 'null') && JSON.parse(finalSeat.body).device === DEV_B,
        'ហើយកៅអីជារបស់ឧបករណ៍ថ្មី', finalSeat.body);
    const aBack = await anon('PUT', seatPath(KEY1, SLOTS[0]), { device: DEV_A, at: 1700000004000 });
    check(denied(aBack), '⛔ ឧបករណ៍ចាស់ត្រឡប់មកវិញ ➜ បដិសេធ', aBack.status);

    // ── ១០. ⛔ ពិដានច្រើនឧបករណ៍ ៖ អ្នកសម្រេចឈរនៅ rules ─────────────
    // អតិថិជនខ្លះមានទូរស័ព្ទច្រើន ➜ តែចំនួននោះត្រូវ **អ្នកលក់កំណត់**
    // មិនមែន client ➜ វារស់ក្នុង `maxDevices` ដែលមានតែ admin សរសេរបាន។
    check(SLOTS.length >= 3, '⛔ លក្ខខណ្ឌចាំបាច់ ៖ មាន slot យ៉ាងតិច ៣ ដើម្បីវាស់ពិដាន', SLOTS);
    const KEY3 = 'MULTIDEV12345678WXYZ';
    await owner('PUT', keyPath(KEY3), { expiresAt: 4102444800000, revoked: false, maxDevices: 2 });

    const m1 = await anon('PUT', seatPath(KEY3, SLOTS[0]), { device: DEV_A, at: 1700000000000 });
    check(allowed(m1), 'ពិដាន ២ ៖ ឧបករណ៍ទី ១ ➜ អនុញ្ញាត', m1.status);
    const m2 = await anon('PUT', seatPath(KEY3, SLOTS[1]), { device: DEV_B, at: 1700000001000 });
    check(allowed(m2), 'ពិដាន ២ ៖ ឧបករណ៍ទី ២ ➜ **អនុញ្ញាត**', m2.status);
    const m3 = await anon('PUT', seatPath(KEY3, SLOTS[2]), { device: 'DEVICECCCCCCCCCCCCCC', at: 1700000002000 });
    check(denied(m3), '⛔ ពិដាន ២ ៖ ឧបករណ៍ទី ៣ ➜ **បដិសេធ** (ពិដានឈរនៅ server)', m3.status);

    // ⛔ ទិសផ្ទុយ ៖ slot ទី ២ លើ Key ដែល **គ្មាន** `maxDevices` ➜ បដិសេធ
    //    (អវត្តមាន = ១ ➜ ការភ្លេចដាក់វា មិនត្រូវបើកចំហ)
    const KEY4 = 'SINGLEDEV1234567WXYZ';
    await owner('PUT', keyPath(KEY4), { expiresAt: 4102444800000, revoked: false });
    const s4a = await anon('PUT', seatPath(KEY4, SLOTS[0]), { device: DEV_A, at: 1700000000000 });
    check(allowed(s4a), 'គ្មាន `maxDevices` ៖ slot ទី ១ ➜ អនុញ្ញាត', s4a.status);
    const s4b = await anon('PUT', seatPath(KEY4, SLOTS[1]), { device: DEV_B, at: 1700000001000 });
    check(denied(s4b), '⛔ គ្មាន `maxDevices` ៖ slot ទី ២ ➜ **បដិសេធ** (លំនាំដើម ១)', s4b.status);

    // ⛔ client មិនត្រូវលើកពិដានដោយខ្លួនឯង
    const raise = await anon('PATCH', keyPath(KEY4), { maxDevices: 5 });
    check(denied(raise), '⛔ client លើក `maxDevices` ➜ **បដិសេធ**', raise.status);
    const raisePut = await anon('PUT', keyPath(KEY4), { expiresAt: 4102444800000, revoked: false, maxDevices: 5 });
    check(denied(raisePut), '⛔ client សរសេរ Key ជាន់ដើម្បីលើកពិដាន ➜ **បដិសេធ**', raisePut.status);

    // ⛔ ពិដានក្រៅជួរ ➜ admin ក៏សរសេរមិនបានដែរ (schema ចាក់សោ)
    // ⛔ ត្រូវប្រើ `asUser(..., ADMIN)` ៖ `owner()` ជាម្ចាស់ project ➜ **រំលង
    //    rules** ➜ ការវាស់នឹងបៃតងក្លែងក្លាយ។
    const tooBig = await asUser('PATCH', keyPath(KEY4), { maxDevices: SLOTS.length + 1 }, ADMIN);
    check(!allowed(tooBig), '⛔ `maxDevices` លើសចំនួន slot ➜ បដិសេធ', tooBig.status);
    const zeroMax = await asUser('PATCH', keyPath(KEY4), { maxDevices: 0 }, ADMIN);
    check(!allowed(zeroMax), '⛔ `maxDevices: 0` ➜ បដិសេធ', zeroMax.status);
    const textMax = await asUser('PATCH', keyPath(KEY4), { maxDevices: '2' }, ADMIN);
    check(!allowed(textMax), '⛔ `maxDevices` ជាអក្សរ ➜ បដិសេធ', textMax.status);
    // ⛔ ទិសផ្ទុយ ៖ admin ត្រូវលើកពិដានក្នុងជួរបាន (បើអត់ ➜ មុខងារងាប់)
    const okMax = await asUser('PATCH', keyPath(KEY4), { maxDevices: SLOTS.length }, ADMIN);
    check(allowed(okMax), '⛔ ទិសផ្ទុយ ៖ admin លើកពិដានក្នុងជួរ ➜ អនុញ្ញាត', okMax.status);
    const afterRaise = await anon('PUT', seatPath(KEY4, SLOTS[1]), { device: DEV_B, at: 1700000005000 });
    check(allowed(afterRaise), 'ហើយក្រោយលើកពិដាន ➜ ឧបករណ៍ទី ២ កក់បាន', afterRaise.status);

    // ⛔ client មិនត្រូវសរសេរនៅកម្រិត node មេ (វានឹងរំលងច្រកទ្វារ slot)
    const flat = await anon('PUT', seatPath(KEY3), { device: DEV_A, at: 1700000000000 });
    check(denied(flat), '⛔ client សរសេរកៅអីនៅកម្រិត Key ➜ **បដិសេធ**', flat.status);

    // ⛔ ឈ្មោះ slot ក្រៅបញ្ជី ➜ បដិសេធ (បើអត់ ➜ កៅអីគ្មានព្រំដែន)
    const oddSlot = await anon('PUT', seatPath(KEY3, 'd99'), { device: 'DEVICECCCCCCCCCCCCCC', at: 1700000003000 });
    check(denied(oddSlot), '⛔ slot ឈ្មោះក្រៅបញ្ជី ➜ **បដិសេធ**', oddSlot.status);

    // ── ១១. ⛔ ស្នាមភ្ជាប់ ៖ payload ដែល ZoeKeyGen សរសេរពិត ត្រូវឆ្លង rules ─
    // ⛔ ការ seed ខាងលើប្រើ `owner()` ដែល **រំលង rules** ➜ វាមិនបញ្ជាក់ថា
    //    ការបង្កើត Key ពិតដំណើរការទេ។ វាលថ្មីណាមួយដែលភ្លេចដាក់ក្នុង schema
    //    ធ្វើឲ្យ **ការបង្កើត Key ធ្លាក់ទាំងស្រុងលើផលិតកម្ម** ខណៈតេស្តបៃតង។
    const KEY5 = 'GENSHAPE123456789WXY';
    const genPublic = await asUser('PUT', keyPath(KEY5),
        { expiresAt: 4102444800000, revoked: false, maxDevices: 2 }, ADMIN);
    check(allowed(genPublic), '⛔ payload សាធារណៈរបស់ការបង្កើត Key ➜ អនុញ្ញាត', genPublic.status + ' ' + genPublic.body.slice(0, 80));
    const genMeta = await asUser('PUT', '/license_keys_meta/' + APP + '/' + KEY5 + '.json',
        { issuedAt: 1700000000000, scope: APP, note: 'ហាងតេស្ត', createdBy: 'a@x.com' }, ADMIN);
    check(allowed(genMeta), '⛔ payload meta របស់ការបង្កើត Key ➜ អនុញ្ញាត', genMeta.status + ' ' + genMeta.body.slice(0, 80));
    const legacyScope = await asUser('PATCH', '/license_keys_meta/' + APP + '/' + KEY5 + '.json',
        { scope: 'ALL' }, ADMIN);
    check(allowed(legacyScope), '⛔ `scope: ALL` របស់ Key ចាស់ ➜ នៅតែទទួល', legacyScope.status);
    const deadScope = await asUser('PATCH', '/license_keys_meta/' + APP + '/' + KEY5 + '.json',
        { scope: 'ZOW' }, ADMIN);
    check(!allowed(deadScope), '⛔ `scope` របស់ App ដែលលុបចោលរួច ➜ បដិសេធ', deadScope.status);
    const deadApp = await asUser('PUT', '/license_keys/ZOW/' + KEY5 + '.json',
        { expiresAt: 4102444800000, revoked: false }, ADMIN);
    check(!allowed(deadApp), '⛔ សរសេរទៅ App ដែលលុបចោលរួច ➜ បដិសេធ', deadApp.status);

    // ⛔ admin ដោះឧបករណ៍ទាំងអស់ក្នុងជំហានតែមួយ
    const relAll = await asUser('DELETE', seatPath(KEY3), undefined, ADMIN);
    check(allowed(relAll), 'admin ដោះឧបករណ៍ទាំងអស់ ➜ អនុញ្ញាត', relAll.status);
    const afterRel = await anon('GET', seatPath(KEY3));
    check((afterRel.body || '').trim() === 'null', 'ហើយកៅអីទាំងអស់ត្រូវទំនេរ', afterRel.body);

    console.log('\n' + pass + ' ok, ' + fail + ' FAIL');
    process.exitCode = fail === 0 ? 0 : 1;
})();
