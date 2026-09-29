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
const vm = require('vm');
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

// ⛔ ដំណឹង ៖ payload · id · URL អាន ត្រូវមកពីកូដ ship ពិត (ZoeKeyGen សរសេរ ·
//    license-verify.js ដែល ZoeW ប្រើដើម្បីអាន) មិនមែនសរសេរដោយដៃ ➜ ស្នាមភ្ជាប់
//    ZoeKeyGen ➜ rules ➜ ZoeW ត្រូវវាស់ពិត។
function sliceFn(source, name) {
    const start = source.indexOf('function ' + name + '(');
    if (start === -1) return null;
    let depth = 0;
    let i = source.indexOf('{', start);
    for (; i < source.length; i++) {
        if (source[i] === '{') depth++;
        else if (source[i] === '}') { depth--; if (depth === 0) { i++; break; } }
    }
    return source.slice(start, i);
}
function loadNoticeWriter() {
    const src = fs.readFileSync(path.join(ROOT, 'ZoeKeyGen/app.js'), 'utf8');
    const decls = ['NOTICE_TITLE_MAX', 'NOTICE_BODY_MAX', 'NOTICE_KEEP_MAX', 'NOTICE_KIND_LABELS', 'NOTICE_ID_ALPHABET']
        .map((name) => (src.match(new RegExp('^const ' + name + ' = .*;$', 'm')) || [])[0]);
    const fns = ['cleanNoticeText', 'buildNoticePayload', 'newNoticeId'].map((name) => sliceFn(src, name));
    if (decls.some((d) => !d) || fns.some((f) => !f)) return null;
    const ctx = { crypto: require('crypto').webcrypto, Uint8Array, String, Math, Object, isFinite };
    vm.createContext(ctx);
    vm.runInContext(decls.join('\n') + '\n' + fns.join('\n\n')
        + '\nthis.api = { buildNoticePayload, newNoticeId, NOTICE_TITLE_MAX, NOTICE_BODY_MAX, NOTICE_KIND_LABELS };', ctx);
    return ctx.api;
}
function loadAnnouncementsUrl() {
    const win = {};
    const ctx = { window: win, navigator: { onLine: true }, console, setTimeout, clearTimeout, TextEncoder, crypto: require('crypto').webcrypto };
    vm.createContext(ctx);
    try {
        const file = ['ZoeW/public/license-verify.js', 'ZoeW/license-verify.js'].map((rel) => path.join(ROOT, rel)).find((f) => fs.existsSync(f));
        vm.runInContext(fs.readFileSync(file, 'utf8'), ctx);
    } catch (e) {
        return null;
    }
    const api = win.ZoeLicense || ctx.ZoeLicense;
    return api && typeof api.announcementsUrl === 'function' ? api.announcementsUrl : null;
}

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

    // ── ១២. ⛔ ដំណឹង ZoeKeyGen ➜ ZoeW ៖ admin សរសេរ · អ្នកណាក៏អាន · schema ចាក់សោ ─
    const notice = loadNoticeWriter();
    check(!!notice, '⛔ លក្ខខណ្ឌចាំបាច់ ៖ ស្រង់ buildNoticePayload/newNoticeId ពី ZoeKeyGen/app.js បាន');
    const annUrl = loadAnnouncementsUrl();
    check(!!annUrl, '⛔ លក្ខខណ្ឌចាំបាច់ ៖ license-verify.js បើក announcementsUrl()');
    if (notice && annUrl) {
        const bucket = '/license_announcements/' + APP;
        const annPath = (id) => bucket + '/' + id + '.json';
        const kinds = Object.keys(notice.NOTICE_KIND_LABELS);
        check(kinds.length >= 2, '⛔ លក្ខខណ្ឌចាំបាច់ ៖ ប្រភេទដំណឹងយ៉ាងតិច ២', kinds);
        const ids = [];
        for (let i = 0; i < kinds.length; i++) {
            const at = 1700000000000 + i * 1000;
            const built = notice.buildNoticePayload(kinds[i], 'ចំណងជើង ' + i, i ? 'ខ្លឹមសារ\nបន្ទាត់ ២' : '', at);
            const id = notice.newNoticeId(at);
            ids.push(id);
            const w = await asUser('PUT', annPath(id), built.payload, ADMIN);
            check(allowed(w), '⛔ payload ពិតរបស់ ZoeKeyGen (' + kinds[i] + ') ➜ admin សរសេរបាន', w.status + ' ' + w.body.slice(0, 80));
        }
        const at3 = 1700000009000;
        const third = notice.buildNoticePayload(kinds[0], 'ចុងក្រោយ', '', at3);
        const id3 = notice.newNoticeId(at3);
        ids.push(id3);
        const trimNew = {};
        trimNew[bucket.slice(1) + '/' + id3] = third.payload;
        const multi = await asUser('PATCH', '/.json', trimNew, ADMIN);
        check(allowed(multi), '⛔ ការសរសេរ multi-path ពី root (ដូច sendNotice) ➜ អនុញ្ញាត', multi.status + ' ' + multi.body.slice(0, 80));

        const anonWrite = await anon('PUT', annPath(notice.newNoticeId(1700000100000)), third.payload);
        check(denied(anonWrite), '⛔ គ្មាន auth សរសេរដំណឹង ➜ **បដិសេធ**', anonWrite.status);
        const plainWrite = await asUser('PUT', annPath(notice.newNoticeId(1700000100000)), third.payload, PLAIN);
        check(denied(plainWrite), '⛔ អ្នកប្រើមិនមែន admin សរសេរដំណឹង ➜ **បដិសេធ**', plainWrite.status);
        const anonEdit = await anon('PATCH', annPath(ids[0]), { title: 'ក្លែង' });
        check(denied(anonEdit), '⛔ គ្មាន auth កែដំណឹងដែលមានស្រាប់ ➜ **បដិសេធ**', anonEdit.status);

        // ⛔ ZoeW អានតាម URL ពិតរបស់ license-verify.js (គ្មាន auth · orderBy $key · limitToLast)
        const toEmu = (url) => url.replace(/^https?:\/\/[^/]+/, '');
        const readAll = await anon('GET', toEmu(annUrl(APP, 20)));
        const all = JSON.parse(readAll.body || 'null') || {};
        check(allowed(readAll) && ids.every((id) => all[id]), 'ZoeW អានបញ្ជីដំណឹងដោយគ្មាន auth ➜ អនុញ្ញាត ហើយឃើញគ្រប់ដំណឹង', readAll.status + ' ' + readAll.body.slice(0, 80));
        const readTwo = await anon('GET', toEmu(annUrl(APP, 2)));
        const two = Object.keys(JSON.parse(readTwo.body || 'null') || {}).sort();
        check(allowed(readTwo) && two.length === 2 && two.join() === ids.slice().sort().slice(-2).join(),
            '⛔ limitToLast ២ ➜ បានតែ ២ ដំណឹងថ្មីជាងគេ (id តម្រៀបតាមពេល)', two);
        const listRoot = await anon('GET', '/license_announcements.json');
        check(denied(listRoot), 'រាយបញ្ជីគ្រប់ appCode ➜ បដិសេធ (អានបានតែ bucket របស់ App)', listRoot.status);

        const bad = async (label, id, payload) => {
            const r = await asUser('PUT', annPath(id), payload, ADMIN);
            check(!allowed(r), '⛔ ' + label + ' ➜ បដិសេធ (សូម្បី admin)', r.status);
        };
        const okId = notice.newNoticeId(1700000200000);
        await bad('ប្រភេទ `update` (ក្លែងកំណែ App)', okId, { kind: 'update', title: 'x', at: 1700000200000 });
        await bad('ចំណងជើងលើស ' + notice.NOTICE_TITLE_MAX + ' តួ', okId, { kind: kinds[0], title: 'ក'.repeat(notice.NOTICE_TITLE_MAX + 1), at: 1700000200000 });
        await bad('ខ្លឹមសារលើស ' + notice.NOTICE_BODY_MAX + ' តួ', okId, { kind: kinds[0], title: 'x', body: 'ក'.repeat(notice.NOTICE_BODY_MAX + 1), at: 1700000200000 });
        await bad('ចំណងជើងទទេ', okId, { kind: kinds[0], title: '', at: 1700000200000 });
        await bad('វាលបន្ថែម', okId, { kind: kinds[0], title: 'x', at: 1700000200000, by: 'a@x.com' });
        await bad('ខ្វះ `at`', okId, { kind: kinds[0], title: 'x' });
        await bad('id ក្រៅទម្រង់', 'x1700000200000', { kind: kinds[0], title: 'x', at: 1700000200000 });
        const deadApp = await asUser('PUT', '/license_announcements/ZOW/' + okId + '.json', { kind: kinds[0], title: 'x', at: 1700000200000 }, ADMIN);
        check(!allowed(deadApp), '⛔ ដំណឹងទៅ App ដែលលុបចោលរួច ➜ បដិសេធ', deadApp.status);
        // ⛔ ទិសផ្ទុយ ៖ ព្រំដែនពិតត្រូវទទួល (បើអត់ ZoeKeyGen អនុញ្ញាតអ្វីដែល rules បដិសេធ)
        const edge = notice.buildNoticePayload(kinds[0], 'ក'.repeat(notice.NOTICE_TITLE_MAX), 'ក'.repeat(notice.NOTICE_BODY_MAX), 1700000300000);
        check(!!edge.payload, '⛔ ទិសផ្ទុយ ៖ ZoeKeyGen ទទួលចំណងជើង/ខ្លឹមសារត្រឹមព្រំដែន', edge);
        if (edge.payload) {
            const edgeW = await asUser('PUT', annPath(notice.newNoticeId(1700000300000)), edge.payload, ADMIN);
            check(allowed(edgeW), '⛔ ទិសផ្ទុយ ៖ rules ទទួលចំណងជើង/ខ្លឹមសារត្រឹមព្រំដែនដដែល', edgeW.status + ' ' + edgeW.body.slice(0, 80));
        }
        const over = notice.buildNoticePayload(kinds[0], 'ក'.repeat(notice.NOTICE_TITLE_MAX + 1), '', 1700000300000);
        check(!over.payload, '⛔ ZoeKeyGen បដិសេធចំណងជើងលើសព្រំដែន មុនផ្ញើ', over);

        const anonDel = await anon('DELETE', annPath(ids[0]));
        check(denied(anonDel), '⛔ គ្មាន auth លុបដំណឹង ➜ **បដិសេធ**', anonDel.status);
        const adminDel = await asUser('DELETE', annPath(ids[0]), undefined, ADMIN);
        check(allowed(adminDel), 'admin លុបដំណឹង ➜ អនុញ្ញាត', adminDel.status);
        const afterDel = await anon('GET', toEmu(annUrl(APP, 20)));
        check(!(JSON.parse(afterDel.body || 'null') || {})[ids[0]], 'ហើយ ZoeW លែងឃើញដំណឹងដែលលុប', afterDel.body.slice(0, 80));
    }

    // ── ១៣. ⛔ node ដែលរំពឹង object ➜ primitive ត្រូវបដិសេធ (ដេរីវេពី rules ពិតក្នុង `rules-shape.js`) ─
    //    primitive គ្មានកូន ➜ ការពិនិត្យវាលកូនមិនរត់ ➜ rules ចាស់ទទួល ➜ `checkOnline()` · បញ្ជី Key របស់ ZoeKeyGen អានតម្លៃខូច (2.45.4)។
    //    វាស់ដោយ admin (អ្នកតែម្នាក់ដែល `.write` អនុញ្ញាត) · control ដក guard របស់ node ➜ ត្រូវទទួល (probe ទៅដល់)។ រត់ចុងក្រោយ (reset លុបផ្លូវ probe)។
    {
        const { probeObjectShapes } = require('../rules-shape.js');
        const shapes = await probeObjectShapes({
            rules: JSON.parse(fs.readFileSync(rulesFile, 'utf8')), file: 'ZoeKeyGen/firebase-database.rules.json',
            samples: { $appCode: APP, $keyId: KEY1, $slot: SLOTS[0], $msgId: 'n1700000000000abc123', $idx: '0' },
            loadRules: (r) => req('PUT', '/.settings/rules.json?' + NS, r, OWNER).then((x) => x.status === 200),
            reset: (p) => owner('PUT', p + '.json', null),
            write: (p, v) => asUser('PUT', p + '.json', v, ADMIN),
            denied: (r) => !allowed(r)
        });
        check(shapes.length >= 1, 'ជាន់អប្បបរមា ៖ node ដែលរំពឹង object ដេរីវេពី rules ពិត (' + shapes.length + ')');
        for (const r of shapes) {
            check(r.reachable, 'probe ទៅដល់ ' + r.rulePath + ' (control ដក guard របស់ node ➜ primitive ត្រូវទទួល)', r.detail.join(' · '));
            check(r.rejected, '⛔ rules ពិត ៖ ' + r.rulePath + ' ➜ primitive (ខ្សែអក្សរ · លេខ · bool) ត្រូវបដិសេធ', r.detail.join(' · '));
        }
        const keyOk = await asUser('PUT', keyPath(KEY1), { expiresAt: 4102444800000, revoked: false }, ADMIN);
        const metaOk = await asUser('PUT', '/license_keys_meta/' + APP + '/' + KEY1 + '.json', { issuedAt: 1700000000000, scope: 'ZOE', appPaths: ['a'] }, ADMIN);
        check(allowed(keyOk) && allowed(metaOk), '⛔ ទិសផ្ទុយ ៖ admin សរសេរ Key និង meta ធម្មតា ➜ នៅតែទទួល', keyOk.status + ' · ' + metaOk.status + ' ' + metaOk.body.slice(0, 80));
    }

    console.log('\n' + pass + ' ok, ' + fail + ' FAIL');
    process.exitCode = fail === 0 ? 0 : 1;
})();
