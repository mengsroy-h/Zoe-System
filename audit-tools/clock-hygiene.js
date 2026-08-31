// ថ្នាក់កំហុស៖ **ការសម្រេចលើ retention/revenue ធ្វើតាមនាឡិកា *ឧបករណ៍* ជំនួសនាឡិកា server។**
//
// បង្អួច ២ ម៉ោង · ៨ ថ្ងៃ · ១៥ ថ្ងៃ សុទ្ធតែប្រៀបធៀប timestamp ធៀបនឹង «ឥឡូវ»។ បើ
// «ឥឡូវ» នោះជា `Date.now()` ឆៅ នោះឧបករណ៍ដែលនាឡិកាខុស (ដែលកើតឡើងពិតលើទូរស័ព្ទ
// ដែលបិទ «កាលបរិច្ឆេទស្វ័យប្រវត្តិ») នឹង៖
//   · ផ្លាស់កញ្ចប់ចូលធុងសំរាម **មុនពេល** ឬ **យឺតជាង** ការពិត
//   · ដកលុយចេញពីស្ថិតិដោយផ្អែកលើបង្អួចដែលមិនទាន់ដល់
// ហើយ **គ្មានអ្វីក្នុង rules ចាប់វាបានទេ** ព្រោះ payload នៅត្រឹមត្រូវតាម schema។
//
// ច្បាប់គម្រោង (CLAUDE.md ➜ «នាឡិកា»)៖ រាល់ timestamp ដែលចូលរួមក្នុងការសម្រេច
// retention/revenue ត្រូវមកពី `getServerNow()`; timer ដែលជា **cosmetic/local
// សុទ្ធសាធ** (PIN lockout · scan debounce · TTL cache · deadline ផ្ទុក script ·
// ចង្វាក់ស៊ុម) នៅតែប្រើ `Date.now()` ឆៅ **ដោយចេតនា**។
//
// ⚠️ មេរៀនដែលកត់ទុកក្នុង CLAUDE.md៖ **ការស្វែងរកតែ `Date.now()` ខកខានចំណុចពិត**
// — `new Date()` (គ្មាន argument) ក៏ជានាឡិកាឧបករណ៍ដែរ (`processScannedCode`
// ធ្លាប់ប្រើវា)។ ដូច្នេះ checker នេះចាប់ **ទាំង ២ ទម្រង់** តាម AST មិនមែន regex។
//
// មេរៀនទី ២ (`network-timeout-test.js` 2.12.1 · `fluid-type-focus-test.js` 2.16.0 ·
// `payload-schema.js` 2.17.3)៖ **ពេលសរសេរ checker ត្រូវសួរថា វាស្កេនឯកសារណាខ្លះ។**
// ដូច្នេះវាស្កេន App ទាំង ២ បូក `license-verify.js` — មិនមែនតែ ZoeW ទេ។
let acorn;
try { acorn = require('acorn'); } catch (e) { console.log('SKIP — ត្រូវការ acorn (npm i acorn)'); process.exit(0); }
const fs = require('fs');
const path = require('path');

const ROOT = process.env.CLOCK_APP_DIR || path.join(__dirname, '..');

// វាលដែល rules ទទួល ហើយដែលការសម្រេច retention/revenue ពឹងលើ
const SERVER_TIME_FIELDS = new Set([
    'createdAt', 'closedAt', 'deletedAt', 'lockerUpdatedAt',
    'claimedAt', 'finalizedAt', 'issuedAt', 'expiresAt'
]);

// function ដែលអនុញ្ញាតឲ្យប្រើនាឡិកាឧបករណ៍ឆៅ — **រាល់ធាតុមានហេតុផលសរសេរជាប់**។
// កុំបន្ថែមធាតុដោយគ្មានហេតុផលពិត — ធាតុគ្មានហេតុផលនឹងលាក់កំហុសបន្ទាប់។
const LOCAL_CLOCK_OK = {
    'ZoeW/app.js': {
        '<top>': 'ថេរពេល boot splash និង throttle `reg.update()` — cosmetic/local',
        elapsedSince: 'ជាមូលដ្ឋាននៃពិដានល្បឿនទាំងអស់ — អានក្លាក់ឆៅ **ដើម្បីធ្វើឲ្យវាមានសុវត្ថិភាព** (ថយក្រោយ ➜ Infinity); ចាក់សោដោយ `monotonic-gate-test.js`',
        getServerNow: 'និយមន័យរបស់នាឡិកា server ខ្លួនឯង',
        verifySecurityPin: 'ការជាប់សោ PIN — local ដោយចេតនា (server មិនស្គាល់វា)',
        appLockLockoutSecondsLeft: 'ការអានវិនាទីដែលនៅសល់នៃការជាប់សោ PIN — local ដោយចេតនា (ការប្រៀបធៀបថ្ងៃឈប់ មិនស្ថិតក្នុងច្បាប់ `elapsedSince`)',
        registerAppLockFailure: 'ការជាប់សោ PIN នៃអេក្រង់ចាក់សោ App — local ដោយចេតនា ដូច `verifySecurityPin`; ការថយក្រោយធ្វើឲ្យ lockout **យូរជាង** ដែលជាទិសសុវត្ថិភាព',
        noteAppLockExcuse: 'ត្រាពេលនៃសកម្មភាពដែលនាំអ្នកប្រើចេញពី App ដោយចេតនា (ខល · រើសឯកសារ · ស្កេនជីវមាត្រ) — local សុទ្ធសាធ ហើយអ្នកអានវា (`noteAppLockAway`) ឆ្លងកាត់ `elapsedSince()` ➜ នាឡិកាថយក្រោយ ➜ Infinity ➜ **ចាក់សោ** ដែលជាទិសសុវត្ថិភាព',
        runBiometricUnlock: 'ការជាប់សោ PIN ដដែល',
        fetchCustomerDataTableRows: 'TTL cache និង cooldown ក្រោយបរាជ័យ — local',
        seedCustomerTableFromImport: 'ត្រាថា cache តារាងអតិថិជនស្រស់ពេលណា — TTL local ដដែល គ្មានទំនាក់ទំនងនឹង retention ឬលុយ',
        setFastLookupRow: 'ត្រាពេល cache Lookup ក្នុងសតិ — TTL local សុទ្ធសាធ គ្មានទំនាក់ទំនងនឹង retention ឬលុយ',
        scheduleCustomerTableSoonRefresh: 'ត្រាពេលតាំងម៉ោងទាញឡើងវិញ — វាស់តាម elapsedSince() ដែល fail-open ពេលនាឡិកាថយក្រោយ',
        warmZtoLookupProxyIfConfigured: 'ត្រាពេល warm-up ZTO ក្នុង cooldown ១០ នាទី — local សុទ្ធសាធ និងមិនប៉ះ retention/revenue',
        attemptAutoLookup: 'cooldown ក្រោយ Lookup បរាជ័យ — local',
        attemptDbListenerRecovery: 'ពិដានល្បឿននៃការស្តារ listener — local',
        noteDbListenerAlive: 'ត្រាពេលនៃវឌ្ឍនភាព resync — វាស់ចន្លោះពេលក្នុងវគ្គដដែល មិនមែនការសម្រេច retention/revenue',
        scheduleFirebaseSdkRetry: 'កត់ត្រាពេលព្យាយាមផ្ទុក SDK — ចូលរួមក្នុងពិដានល្បឿន local',
        retryFirebaseSdkNow: 'ពិដានល្បឿននៃការផ្ទុក SDK ឡើងវិញ — local (ដូច attemptDbListenerRecovery)',
        reloadForFirebaseSdk: 'គម្លាតអប្បបរមារវាងការផ្ទុកទំព័រឡើងវិញ — local សុទ្ធសាធ (server មិនស្គាល់វា ហើយវាមិនប៉ះ retention/revenue សោះ)',
        forceDatabaseReconnect: 'គម្លាតអប្បបរមារវាងវដ្តភ្ជាប់ឡើងវិញ — local',
        generateUniqueId: 'salt នៃ id — មិនមែនការសម្រេច retention',
        waitForZXingThenInitScanEngine: 'deadline ផ្ទុក script — local',
        confirmLiveScan: 'បង្អួច «២ ស៊ុមជាប់គ្នា» — local',
        processScannedCode: 'debounce ការស្កេនស្ទួន ២.៥ វិ. — local',
        renderLoop: 'ចង្វាក់ស៊ុម (fallback ពី performance.now)',
        loop: 'ចង្វាក់ស៊ុមនៃការស្កេន (fallback ពី performance.now)'
    },
    'ZoeKeyGen/app.js': {
        '<top>': 'ថេរពេល boot splash និង throttle `reg.update()` — cosmetic/local',
        elapsedSince: 'ជាមូលដ្ឋាននៃពិដានល្បឿនទាំងអស់ — អានក្លាក់ឆៅ **ដើម្បីធ្វើឲ្យវាមានសុវត្ថិភាព** (ថយក្រោយ ➜ Infinity); ចាក់សោដោយ `monotonic-gate-test.js`',
        getServerNow: 'និយមន័យរបស់នាឡិកា server ខ្លួនឯង',
        verifySecurityPin: 'ការជាប់សោ PIN — local ដោយចេតនា',
        forceDatabaseReconnect: 'គម្លាតអប្បបរមារវាងវដ្តភ្ជាប់ឡើងវិញ — local',
        scheduleFirebaseSdkRetry: 'កត់ត្រាពេលព្យាយាមផ្ទុក SDK — ចូលរួមក្នុងពិដានល្បឿន local',
        retryFirebaseSdkNow: 'ពិដានល្បឿននៃការផ្ទុក SDK ឡើងវិញ — local',
        reloadForFirebaseSdk: 'គម្លាតអប្បបរមារវាងការផ្ទុកទំព័រឡើងវិញ — local សុទ្ធសាធ (server មិនស្គាល់វា ហើយវាមិនប៉ះ retention/revenue សោះ)'
    },
    'ZoeW/license-verify.js': {
        getServerNow: 'និយមន័យរបស់នាឡិកា server ខ្លួនឯង',
        checkOnline: 'គណនា offset ពី header HTTP `Date` — ត្រូវការនាឡិកាឧបករណ៍ជាមូលដ្ឋាន',
        syncServerTime: 'ដដែល — គណនា offset'
    },
};

// ឯកសារដែលមាននាឡិកា server ផ្ទាល់ខ្លួន ➜ ត្រូវមាន getServerNow() និងផ្លូវធ្វើឲ្យ offset ស្រស់
const CLOCK_OWNERS = {
    'ZoeW/app.js': /\.info\/serverTimeOffset/,
    'ZoeKeyGen/app.js': /\.info\/serverTimeOffset/,
    'ZoeW/license-verify.js': /headers\.get\(\s*['"]date['"]\s*\)/i
};

const FILES = Object.keys(LOCAL_CLOCK_OK);

let pass = 0, fail = 0;
function ok(label) { pass++; console.log('   ok    ' + label); }
function bad(label, detail) {
    fail++;
    console.log('  FAIL   ' + label + (detail !== undefined ? '\n         ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : ''));
}
function check(cond, label, detail) { cond ? ok(label) : bad(label, detail); }

function isRawClock(node) {
    if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression' && !node.callee.computed &&
        node.callee.object.type === 'Identifier' && node.callee.object.name === 'Date' &&
        node.callee.property.name === 'now') return true;
    return node.type === 'NewExpression' && node.callee.type === 'Identifier' &&
        node.callee.name === 'Date' && node.arguments.length === 0;
}

function containsRawClock(node) {
    let found = false;
    (function scan(n) {
        if (!n || typeof n.type !== 'string' || found) return;
        if (isRawClock(n)) { found = true; return; }
        for (const k of Object.keys(n)) {
            if (k === 'loc' || k === 'start' || k === 'end') continue;
            const v = n[k];
            if (Array.isArray(v)) v.forEach(scan);
            else if (v && typeof v.type === 'string') scan(v);
        }
    })(node);
    return found;
}

function fieldNameOf(node) {
    if (node.type === 'Property') {
        if (node.computed) return null;
        return node.key.type === 'Identifier' ? node.key.name : (node.key.type === 'Literal' ? String(node.key.value) : null);
    }
    if (node.type === 'AssignmentExpression' && node.left.type === 'MemberExpression' && !node.left.computed) {
        return node.left.property.type === 'Identifier' ? node.left.property.name : null;
    }
    return null;
}

function memberFieldOf(node) {
    if (node.type === 'MemberExpression' && !node.computed && node.property.type === 'Identifier') return node.property.name;
    return null;
}

for (const rel of FILES) {
    const file = path.join(ROOT, rel);
    if (!fs.existsSync(file)) { bad(rel + ': រកឯកសារមិនឃើញ'); continue; }
    const code = fs.readFileSync(file, 'utf8');
    let ast;
    try { ast = acorn.parse(code, { ecmaVersion: 2022, locations: true }); }
    catch (e) { bad(rel + ': parse មិនបាន', e.message); continue; }

    const allow = LOCAL_CLOCK_OK[rel];
    const stack = [];
    const offenders = [];
    const seenFns = new Set();
    const fieldViolations = [];
    const compareViolations = [];

    (function walk(node) {
        if (!node || typeof node.type !== 'string') return;
        let pushed = false;
        if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') {
            stack.push((node.id && node.id.name) || '<anon>');
            pushed = true;
        }

        if (isRawClock(node)) {
            const named = stack.filter((n) => n !== '<anon>');
            const fn = named.length ? named[named.length - 1] : '<top>';
            seenFns.add(fn);
            if (!Object.prototype.hasOwnProperty.call(allow, fn)) {
                offenders.push(rel + ':' + node.loc.start.line + '  ក្នុង `' + fn + '()`');
            }
        }

        // វាល timestamp ដែលចូល Firebase ត្រូវមកពី getServerNow() — មិនមែននាឡិកាឧបករណ៍
        const fieldName = fieldNameOf(node);
        if (fieldName && SERVER_TIME_FIELDS.has(fieldName)) {
            const value = node.type === 'Property' ? node.value : node.right;
            if (value && containsRawClock(value)) {
                fieldViolations.push(rel + ':' + node.loc.start.line + '  `' + fieldName + '` សរសេរពីនាឡិកាឧបករណ៍');
            }
        }

        // ការប្រៀបធៀបបង្អួច (`now - item.closedAt > TWO_HOURS_MS`) ត្រូវប្រើនាឡិកា server
        if (node.type === 'BinaryExpression') {
            const leftField = memberFieldOf(node.left);
            const rightField = memberFieldOf(node.right);
            if (leftField && SERVER_TIME_FIELDS.has(leftField) && containsRawClock(node.right)) {
                compareViolations.push(rel + ':' + node.loc.start.line + '  `' + leftField + '` ធៀបនឹងនាឡិកាឧបករណ៍');
            }
            if (rightField && SERVER_TIME_FIELDS.has(rightField) && containsRawClock(node.left)) {
                compareViolations.push(rel + ':' + node.loc.start.line + '  `' + rightField + '` ធៀបនឹងនាឡិកាឧបករណ៍');
            }
        }

        for (const k of Object.keys(node)) {
            if (k === 'loc' || k === 'start' || k === 'end') continue;
            const v = node[k];
            if (Array.isArray(v)) v.forEach(walk);
            else if (v && typeof v.type === 'string') walk(v);
        }
        if (pushed) stack.pop();
    })(ast);

    check(offenders.length === 0,
        rel + ': នាឡិកាឧបករណ៍ឆៅ ស្ថិតតែក្នុង function ដែលមានហេតុផលសរសេរជាប់',
        offenders.join('\n         '));

    check(fieldViolations.length === 0,
        rel + ': គ្មានវាល timestamp ណាសរសេរពី `Date.now()`/`new Date()`',
        fieldViolations.join('\n         '));

    check(compareViolations.length === 0,
        rel + ': គ្មានការប្រៀបធៀបបង្អួច retention នឹងនាឡិកាឧបករណ៍',
        compareViolations.join('\n         '));

    // ២ ខាង៖ ធាតុ allowlist ដែលលែងប្រើ ត្រូវដកចេញ បើមិនដូច្នេះវាលាក់កំហុសបន្ទាប់
    const dead = Object.keys(allow).filter((fn) => !seenFns.has(fn));
    check(dead.length === 0, rel + ': បញ្ជីអនុញ្ញាតគ្មានធាតុងាប់ (សិទ្ធិតូចបំផុត)', dead);

    if (CLOCK_OWNERS[rel]) {
        check(/function getServerNow\(\)\s*\{[\s\S]{0,120}?Date\.now\(\)\s*\+\s*serverTimeOffsetMs/.test(code),
            rel + ': មាន `getServerNow()` = `Date.now() + serverTimeOffsetMs`');
        check(CLOCK_OWNERS[rel].test(code),
            rel + ': offset នៃនាឡិកា server ត្រូវធ្វើឲ្យស្រស់ពីប្រភពពិត');
    }
}

// ការសម្រេចរបស់ការសម្អាតស្វ័យប្រវត្តិ ត្រូវឈរលើនាឡិកា server ទាំងស្រុង
const zoew = fs.existsSync(path.join(ROOT, 'ZoeW/app.js')) ? fs.readFileSync(path.join(ROOT, 'ZoeW/app.js'), 'utf8') : '';
if (zoew) {
    for (const fn of ['runAutomaticCleanupRules', 'claimAndCleanupItem', 'barcodeCloseIsRipe', 'normalizeBarcodeCloseStamps']) {
        const m = new RegExp('function ' + fn + '\\s*\\([^)]*\\)\\s*\\{').exec(zoew);
        if (!m) { bad('ZoeW/app.js: រក `' + fn + '()` មិនឃើញ'); continue; }
        let i = zoew.indexOf('{', m.index), depth = 0, end = i;
        for (; end < zoew.length; end++) {
            if (zoew[end] === '{') depth++;
            else if (zoew[end] === '}') { depth--; if (!depth) break; }
        }
        const body = zoew.slice(i, end + 1);
        check(!/\bDate\.now\(\)/.test(body) && !/new Date\(\s*\)/.test(body),
            'ZoeW/app.js: `' + fn + '()` មិនប៉ះនាឡិកាឧបករណ៍សោះ');
    }
}

console.log('\n' + (fail ? 'FAIL ' + fail + ' / ជោគជ័យ ' + pass : 'PASS ' + pass + '/' + pass));
process.exit(fail ? 1 : 0);
