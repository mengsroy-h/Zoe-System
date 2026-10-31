'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('assert/strict');
const { emuNamespace } = require('./ns.js');
const ROOT = process.env.SCANRULES_APP_DIR ? path.resolve(process.env.SCANRULES_APP_DIR) : path.join(__dirname, '..', '..');
const REPO = process.env.ZOE_REPO_ROOT ? path.resolve(process.env.ZOE_REPO_ROOT) : path.join(__dirname, '..', '..');
const RULES = process.env.SCANRULES_RULES_FILE || path.join(ROOT, 'firebase-database.rules.json');
const ns = emuNamespace('scan-operation-rules');
const H = 'zoew_scan_history_cod_dod', O = 'zoew_scan_operations', I = 'zoew_scan_pending', R = 'zoew_barcode_registry';
const D = 'zoew_daily_revenue_cod_dod', M = 'zoew_monthly_revenue_cod_dod';
const T = 'zoew_recently_deleted_cod_dod', L = 'zoew_registry_releases', G = 'zoew_trash_consumptions';
const F = 'zoew_restore_finalizations', CF = 'zoew_clear_history_finalizations';
const id = 'scan_' + 'a'.repeat(32), uid = 'scan-user', day = '2026-10-30', month = day.slice(0, 7), target = 'itemA';
const base = { v: 2, id, actorUid: uid, scope: 'firebase|local', code: 'AA-1', registryKey: 'AA-1', birth: 1000, scanDate: day,
    month, cod: 5.29, dod: 0, count: 1, monthToken: 'op_m' + 'a'.repeat(32), phase: 'admitted' };
const prepared = { ...base, phase: 'prepared', targetId: target, payloadHash: 'b'.repeat(64), phone: '012', locker: 'L1', closedAt: 0 };
const owner = { v: 2, intent: id, actorUid: uid, birth: base.birth };
const marker = { intent: id, actorUid: uid, code: base.code, birth: base.birth, slot: '0', payloadHash: prepared.payloadHash };
const row = { id: target, phone: prepared.phone, scanDate: day, createdAt: base.birth, time: 't', barcode: base.code, count: 1,
    cod: base.cod, dod: base.dod, price: base.cod, isCalled: false, isClosed: false,
    barcodes: { 0: { code: base.code, scanIntent: id, createdAt: base.birth, time: 't', cod: base.cod, dod: base.dod, locker: prepared.locker,
        isClosed: false, isDeducted: false, isFromDeletion: false } }, scanPending: marker };
const copy = value => JSON.parse(JSON.stringify(value));
const inc = n => ({ '.sv': { increment: n } });
let pass = 0, fail = 0;
let pgBridge = null, pgHarness = null, pgConnection = null;
const backend = process.env.SCANRULES_BACKEND === 'pg' ? 'Postgres' : 'RTDB';
function req(method, location, body, actor) {
    if (pgBridge) return pgBridge(method, location, body, actor);
    return new Promise((resolve, reject) => {
        const data = body === undefined ? null : JSON.stringify(body);
        const auth = actor === undefined ? '' : '&auth_variable_override=' + encodeURIComponent(JSON.stringify({ uid: actor }));
        const request = http.request({ host: '127.0.0.1', port: Number(process.env.SCANRULES_EMU_PORT || 9000), method,
            path: location + '?ns=' + ns + auth, timeout: 15000,
            headers: { Authorization: 'Bearer owner', ...(data === null ? {} : { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }) } }, response => {
            let text = ''; response.on('data', part => text += part); response.on('end', () => resolve({ status: response.statusCode, text }));
        });
        request.on('timeout', () => request.destroy(new Error('emulator មិនឆ្លើយ'))); request.on('error', reject);
        if (data !== null) request.write(data); request.end();
    });
}
const at = p => '/' + p + '.json';
const rootTree = async () => { const result = await req('GET', '/.json'); assert.equal(result.status, 200); return JSON.parse(result.text); };
async function seed(tree) { const result = await req('PUT', '/.json', tree); assert.equal(result.status, 200, result.text); }
function staged() { return { [O]: { [id]: copy(prepared) }, [I]: { [id]: uid }, [R]: { [base.registryKey]: copy(owner) }, [H]: { [target]: copy(row) },
    [D]: { [day]: { codDollar: 4, dodDollar: 1, totalCount: 2 } },
    [M]: { [month]: { codDollar: 10, dodDollar: 2, totalCount: 3, op: base.monthToken, ops: { [base.monthToken]: 1 } } } }; }
function finalPatch() {
    const patch = { [O + '/' + id]: { ...prepared, phase: 'committed' }, [I + '/' + id]: null,
        [H + '/' + target + '/scanPending']: null, [R + '/' + base.registryKey]: copy(owner) };
    for (const bucket of [D + '/' + day, M + '/' + month]) {
        patch[bucket + '/codDollar'] = inc(base.cod); patch[bucket + '/dodDollar'] = inc(base.dod); patch[bucket + '/totalCount'] = inc(1);
    }
    return patch;
}
async function check(label, tree, location, body, allow, method = 'PATCH', actor = uid, interleave = null) {
    try {
        await seed(tree);
        let before = await rootTree();
        if (interleave) { await interleave(before); before = await rootTree(); }
        const result = await req(method, location, body, actor);
        if (!allow) assert.equal(result.status, 401, 'ត្រូវជាការបដិសេធ rules មិនមែន infrastructure៖ ' + result.text);
        assert.equal(result.status === 200, allow, 'status=' + result.status + ' ' + result.text.slice(0, 500));
        const after = await rootTree();
        if (!allow) assert.deepEqual(after, before, 'ការបដិសេធត្រូវទុកទិន្នន័យដដែល');
        pass++; console.log('  ok    ' + label);
        return after;
    } catch (error) { fail++; console.log('  FAIL  ' + label + '\n        ' + error.message.slice(0, 1000)); return null; }
}
function isPostgresRulesDenial(result) {
    return result?.error?.code === '42501' && result.error.message === 'permission_denied';
}
async function setupPostgres() {
    const { createPgHarness } = require('../supabase-pg.js');
    const { pathToFileURL } = require('url');
    const major = Number(fs.readFileSync(path.join(ROOT, 'supabase', 'config.toml'), 'utf8').match(/^major_version\s*=\s*(\d+)\s*$/m)?.[1]);
    pgHarness = createPgHarness({ depsDirs: [process.env.SUPABASE_DEPS_DIR, path.join(ROOT, 'supabase', 'node_modules'), path.join(REPO, 'supabase', 'node_modules')].filter(Boolean),
        shimDir: path.join(__dirname, '..', 'supabase-shim'), wantMajor: major });
    assert.equal(pgHarness.unavailableReason(), null, 'តម្រូវការ Postgres មិនគ្រប់');
    await pgHarness.start();
    const fresh = await pgHarness.freshDb('default-grants'); pgConnection = fresh.c;
    const migrations = fs.readdirSync(path.join(ROOT, 'supabase', 'migrations')).filter(name => /^\d{14}_[a-z0-9_]+\.sql$/.test(name)).sort();
    for (const migration of migrations) await pgConnection.query(fs.readFileSync(path.join(ROOT, 'supabase', 'migrations', migration), 'utf8'));
    const { compileRules, rulesSql } = await import(pathToFileURL(path.join(ROOT, 'supabase', 'scripts', 'rtdb-rules.mjs')).href);
    const canonical = JSON.parse(fs.readFileSync(path.join(ROOT, 'firebase-database.rules.json'), 'utf8'));
    const newest = migrations.filter(name => name.endsWith('_zoe_rules.sql')).at(-1);
    assert.equal(fs.readFileSync(path.join(ROOT, 'supabase', 'migrations', newest), 'utf8'), rulesSql(compileRules(canonical)), 'migration ត្រូវ byte-exact canonical');
    const tenant = (await pgConnection.query("insert into public.tenants (name, branch_code, expires_at) values ('scan-rules', '100001', now() + interval '30 days') returning id")).rows[0].id;
    const user = await pgHarness.makeAuthUser(pgConnection, 'scan_rules@u.zoe.test');
    const foreignUser = await pgHarness.makeAuthUser(pgConnection, 'scan_foreign@u.zoe.test');
    for (const [who, name] of [[user, 'scan_rules'], [foreignUser, 'scan_foreign']]) await pgConnection.query("insert into public.tenant_members (user_id, tenant_id, username, role) values ($1, $2, $3, 'owner')", [who, tenant, name]);
    let sequence = 0;
    const operationId = () => 'scanrules_' + (++sequence).toString(36).padStart(16, '0');
    const mapped = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value, (_key, v) => v === uid ? user : v === 'foreign' ? foreignUser : v));
    const parts = value => value.split('/').filter(Boolean);
    const operation = (location, value) => value && typeof value === 'object' && value['.sv'] && typeof value['.sv'].increment === 'number'
        ? { k: 'inc', p: location, d: value['.sv'].increment } : { k: 'set', p: location, v: value };
    pgBridge = async (method, location, body, actor) => {
        if (location === '/.settings/rules.json') { await pgConnection.query(rulesSql(compileRules(body))); return { status: 200, text: '{"status":"ok"}' }; }
        if (method === 'GET' && location === '/.json') {
            const values = (await pgConnection.query('select root, key, value from public.zoe_docs where tenant_id = $1 and value is not null', [tenant])).rows;
            const tree = {}; for (const value of values) (tree[value.root] ||= {})[value.key] = value.value;
            return { status: 200, text: JSON.stringify(Object.keys(tree).length ? tree : null) };
        }
        const value = mapped(body);
        if (actor === undefined && method === 'PUT' && location === '/.json') {
            const operations = [];
            for (const [root, entries] of Object.entries(value || {})) for (const [key, entry] of Object.entries(entries || {})) operations.push(operation([root, key], entry));
            const seeded = await pgHarness.as(pgConnection, { role: 'service_role' }, 'select public.zoe_admin_write($1, $2, $3::jsonb, true) as r',
                [tenant, operationId(), JSON.stringify(operations.length ? operations : [{ k: 'set', p: [R, '__scan_noop__'], v: null }])]);
            if (seeded.error) throw new Error('seed Postgres: ' + JSON.stringify(seeded.error));
            return { status: 200, text: JSON.stringify(value) };
        }
        assert.notEqual(actor, undefined, 'សំណើ fixture មិនស្គាល់');
        const basePath = parts(location.replace(/\.json$/, ''));
        const operations = method === 'PATCH' ? Object.entries(value).map(([key, entry]) => operation([...basePath, ...parts(key)], entry)) : [operation(basePath, value)];
        const result = await pgHarness.as(pgConnection, { role: 'authenticated', sub: actor === uid ? user : foreignUser }, 'select public.zoe_write($1, $2::jsonb) as r', [operationId(), JSON.stringify(operations)]);
        if (result.error) {
            if (!isPostgresRulesDenial(result)) throw new Error('Postgres មិនមែន rules denial: ' + JSON.stringify(result.error));
            return { status: 401, text: 'Permission denied: ' + result.error.message };
        }
        return { status: 200, text: JSON.stringify(result.rows) };
    };
}
async function run() {
    if (backend === 'Postgres') await setupPostgres();
    const uploaded = await req('PUT', '/.settings/rules.json', JSON.parse(fs.readFileSync(RULES, 'utf8')));
    assert.equal(uploaded.status, 200, 'rules មិនបាន load: ' + uploaded.text);
    await check('control៖ actor ផ្សេងមិនអាចបង្កើត receipt ជំនួសម្ចាស់', {}, '/.json', { [O + '/' + id]: base, [I + '/' + id]: uid }, false, 'PATCH', 'foreign');
    await check('admitted និង pending index បង្កើតព្រមគ្នា', {}, '/.json', { [O + '/' + id]: base, [I + '/' + id]: uid }, true);
    await check('admitted ខ្វះ pending index ត្រូវបដិសេធ', {}, at(O + '/' + id), base, false, 'PUT');
    await check('ព្រំដែន trusted owner៖ opaque key នៅ server ទទួលតែ client ទើប canonical', {}, '/.json', { [O + '/' + id]: { ...base, registryKey: 'OTHER' }, [I + '/' + id]: uid }, true);
    await check('scan id មិនត្រឹមត្រូវត្រូវបដិសេធ', {}, '/.json', { [O + '/' + id]: { ...base, id: 'scan_bad' }, [I + '/' + id]: uid }, false);
    await check('field មិនស្គាល់ត្រូវបដិសេធ', {}, '/.json', { [O + '/' + id]: { ...base, extra: true }, [I + '/' + id]: uid }, false);
    const admitted = { [O]: { [id]: base }, [I]: { [id]: uid } };
    await check('កក់ registry ជាមួយម្ចាស់ operation', admitted, at(R + '/' + base.registryKey), owner, true, 'PUT');
    await check('key ដែល bind រួចមិនអាចប្តូរ', admitted, at(O + '/' + id), { ...base, registryKey: 'OTHER' }, false, 'PUT');
    const claimed = { ...copy(admitted), [R]: { [base.registryKey]: owner } };
    await check('queued release ចាស់មិនលុប owned registry', claimed, at(R + '/' + base.registryKey), null, false, 'PUT');
    await check('bind prepared ម្តងជាមួយ fields គ្រប់', claimed, at(O + '/' + id), prepared, true, 'PUT');
    const partial = { ...prepared }; delete partial.phone;
    await check('prepared ខ្វះ phone ត្រូវបដិសេធ', claimed, at(O + '/' + id), partial, false, 'PUT');
    const unstaged = staged(); delete unstaged[H];
    await check('stage barcode ពិតចូល history', unstaged, at(H + '/' + target), row, true, 'PUT');
    for (const [field, value] of [['phone', '099'], ['scanDate', '2026-10-29']]) {
        await check('stage មិនអាចប្តូរ ' + field, unstaged, at(H + '/' + target), { ...row, [field]: value }, false, 'PUT');
    }
    for (const [field, value] of [['code', 'OTHER'], ['createdAt', 1001], ['cod', 6], ['locker', 'L2'], ['isClosed', true], ['closedAt', 1001]]) {
        const changed = copy(row); changed.barcodes[0][field] = value;
        await check('stage tuple មិនអាចប្តូរ ' + field, unstaged, at(H + '/' + target), changed, false, 'PUT');
    }
    const cancel = { [O + '/' + id]: { ...prepared, phase: 'cancelled' }, [I + '/' + id]: null, [R + '/' + base.registryKey]: null };
    await check('cancel unstaged ដោយលុប owned claim ព្រមគ្នា', unstaged, '/.json', cancel, true);
    await check('cancel ក្រោយ stage ត្រូវបដិសេធ', staged(), '/.json', cancel, false);
    const cancelled = { [O]: { [id]: { ...prepared, phase: 'cancelled' } } };
    await check('cancel tombstone រារាំង late registry claim', cancelled, at(R + '/' + base.registryKey), owner, false, 'PUT');
    await check('cancel tombstone រារាំង late stage', cancelled, at(H + '/' + target), row, false, 'PUT');
    await check('cancel tombstone មិនអាចលុប', cancelled, at(O + '/' + id), null, false, 'PUT');
    await check('writer ចាស់មិនលុប row active scan', staged(), at(H + '/' + target), null, false, 'PUT');
    await check('writer ចាស់មិនកែ child ខណៈ active scan', staged(), at(H + '/' + target + '/phone'), '099', false, 'PUT');
    await check('writer ចាស់មិនជំនួស row ទោះរក្សា marker', staged(), at(H + '/' + target), { ...row, isCalled: true }, false, 'PUT');
    await check('marker មិនអាចលុបតែមួយ', staged(), at(H + '/' + target + '/scanPending'), null, false, 'PUT');
    await check('ព្រំដែន trusted owner៖ ordinary ledger write នៅតែអនុញ្ញាត', staged(), at(D + '/' + day + '/totalCount'), inc(1), true, 'PUT');
    const completed = await check('final atomic៦ledger + receipt + registry + marker', staged(), '/.json', finalPatch(), true);
    if (completed) {
        assert.equal(completed[O][id].phase, 'committed'); assert.equal(completed[R][base.registryKey].intent, owner.intent);
        assert.equal(completed[R][base.registryKey].birth, owner.birth); assert.equal(completed[R][base.registryKey].v, 2);
        assert.equal(completed[H][target].scanPending, undefined); assert.equal(completed[I]?.[id], undefined);
        assert.equal(completed[D][day].codDollar, 4 + base.cod); assert.equal(completed[M][month].totalCount, 4);
    }
    for (const firstEver of [false, true]) {
        const tree = staged(); tree[O][id].cod = 0; tree[O][id].dod = 0;
        tree[H][target].cod = 0; tree[H][target].dod = 0; tree[H][target].price = 0;
        tree[H][target].barcodes[0].cod = 0; tree[H][target].barcodes[0].dod = 0;
        if (firstEver) {
            delete tree[D];
            tree[M][month].codDollar = 0; tree[M][month].dodDollar = 0; tree[M][month].totalCount = 0;
        }
        const patch = finalPatch(); patch[O + '/' + id] = { ...tree[O][id], phase: 'committed' };
        for (const bucket of [D + '/' + day, M + '/' + month]) {
            patch[bucket + '/codDollar'] = inc(0); patch[bucket + '/dodDollar'] = inc(0);
        }
        const after = await check('final COD=DOD=0៖ ' + (firstEver ? 'parcel ដំបូង daily មិនទាន់មាន' : 'bucket មានស្រាប់'), tree, '/.json', patch, true);
        if (after) {
            assert.equal(after[O][id].phase, 'committed'); assert.equal(after[O][id].count, 1);
            assert.equal(after[R][base.registryKey].intent, owner.intent); assert.equal(after[I]?.[id], undefined);
            assert.equal(after[H][target].scanPending, undefined); assert.equal(after[H][target].count, 1);
            assert.equal(after[H][target].barcodes[0].cod, 0); assert.equal(after[H][target].barcodes[0].dod, 0);
            for (const [root, key] of [[D, day], [M, month]]) {
                assert.equal(after[root][key].codDollar, tree[root]?.[key].codDollar ?? 0);
                assert.equal(after[root][key].dodDollar, tree[root]?.[key].dodDollar ?? 0);
                assert.equal(after[root][key].totalCount, (tree[root]?.[key].totalCount ?? 0) + 1);
            }
        }
        if (firstEver) {
            const terminal = copy(tree); terminal[O][id].phase = 'committed'; delete terminal[I]; delete terminal[H][target].scanPending;
            terminal[D] = { [day]: { codDollar: 0, dodDollar: 0, totalCount: 1 } }; terminal[M][month].totalCount = 1;
            await check('final COD=DOD=0 ដំបូងមិនអាច replay បូក count ម្តងទៀត', terminal, '/.json', patch, false);
            const missingCount = { ...patch }; delete missingCount[D + '/' + day + '/totalCount'];
            await check('final COD=DOD=0 daily ថ្មីត្រូវមាន count=1', tree, '/.json', missingCount, false);
        }
    }
    const committed = staged(); committed[O][id].phase = 'committed';
    delete committed[I]; delete committed[H][target].scanPending;
    committed[D][day].codDollar += base.cod; committed[D][day].totalCount++; committed[M][month].codDollar += base.cod; committed[M][month].totalCount++;
    await check('final លើកទី២មិនអាចបូកឡើងវិញ', committed, '/.json', finalPatch(), false);
    await check('committed receipt មិនអាចលុប', committed, at(O + '/' + id), null, false, 'PUT');
    const retainedOwner = finalPatch(); delete retainedOwner[R + '/' + base.registryKey];
    const retained = await check('final រក្សា owner ដដែលទោះមិនសរសេរ leaf មិនប្រែតម្លៃ', staged(), '/.json', retainedOwner, true);
    if (retained) {
        assert.equal(retained[R][base.registryKey].intent, id); assert.equal(retained[R][base.registryKey].birth, base.birth);
        assert.equal(retained[R][base.registryKey].actorUid, retained[O][id].actorUid); assert.equal(retained[R][base.registryKey].v, 2);
    }
    for (const removed of [I + '/' + id, H + '/' + target + '/scanPending', D + '/' + day + '/totalCount', M + '/' + month + '/totalCount']) {
        const patch = finalPatch(); delete patch[removed];
        await check('final ខ្វះ leaf '+ removed + ' ត្រូវបដិសេធ', staged(), '/.json', patch, false);
    }
    for (const [label, beforeMoney, amount, allow] of [
        ['floating dust ធម្មតា', 0.1, 0.2, true], ['មុន ceiling មួយសេន', 2 ** 28 - 0.01, 0.01, true],
        ['លើ ceiling មួយសេន', 2 ** 28, 0.01, false], ['ទំហំ 2^46 មិនអាចបូក .01', 2 ** 46, 0.01, false]
    ]) {
        const tree = staged(); tree[O][id].cod = amount; tree[H][target].cod = amount; tree[H][target].price = amount; tree[H][target].barcodes[0].cod = amount;
        tree[D][day].codDollar = beforeMoney; tree[M][month].codDollar = beforeMoney;
        const patch = finalPatch(); patch[O + '/' + id] = { ...tree[O][id], phase: 'committed' };
        patch[D + '/' + day + '/codDollar'] = inc(amount); patch[M + '/' + month + '/codDollar'] = inc(amount);
        const after = await check('final numeric៖ ' + label, tree, '/.json', patch, allow);
        if (allow && after) assert.equal(after[D][day].codDollar, backend === 'Postgres' && beforeMoney === 0.1 && amount === 0.2 ? 0.3 : beforeMoney + amount);
    }
    for (const [beforeCount, allow] of [[9007199254740989, true], [9007199254740990, false]]) {
        const tree = staged(); tree[D][day].totalCount = beforeCount; tree[M][month].totalCount = beforeCount;
        const after = await check('final totalCount upper bound៖ ' + beforeCount, tree, '/.json', finalPatch(), allow);
        if (allow && after) assert.equal(after[D][day].totalCount, beforeCount + 1);
    }
    const racing = staged(); racing[O][id].cod = 0.01; racing[H][target].cod = 0.01; racing[H][target].price = 0.01; racing[H][target].barcodes[0].cod = 0.01;
    racing[D][day].codDollar = 2 ** 28 - 0.01; racing[M][month].codDollar = 2 ** 28 - 0.01;
    const racingPatch = finalPatch(); racingPatch[O + '/' + id] = { ...racing[O][id], phase: 'committed' };
    racingPatch[D + '/' + day + '/codDollar'] = inc(0.01); racingPatch[M + '/' + month + '/codDollar'] = inc(0.01);
    await check('final rule បដិសេធ racing bucket ដែលឆ្លង ceiling ក្រោយ snapshot', racing, '/.json', racingPatch, false, 'PATCH', uid, async snapshot => {
        assert.equal(snapshot[D][day].codDollar, 2 ** 28 - 0.01);
        const changed = await req('PUT', at(D + '/' + day + '/codDollar'), 2 ** 28, uid); assert.equal(changed.status, 200);
    });
    const wrongDelta = finalPatch(); wrongDelta[D + '/' + day + '/codDollar'] = inc(1);
    await check('final delta ខុសត្រូវបដិសេធ', staged(), '/.json', wrongDelta, false);
    const goneMonth = staged(); delete goneMonth[M];
    await check('final មិនបង្កើត month ដែល prune រួច', goneMonth, '/.json', finalPatch(), false);
    const goneToken = staged(); delete goneToken[M][month].ops;
    await check('final ខ្វះ original month token ត្រូវបដិសេធ', goneToken, '/.json', finalPatch(), false);
    const foreign = staged(); foreign[R][base.registryKey] = { ...owner, intent: 'scan_' + 'c'.repeat(32) };
    await check('final មិនយក registry ម្ចាស់ផ្សេង', foreign, '/.json', finalPatch(), false);
    for (const [label, extras] of [['លុប barcode', { [H + '/' + target + '/barcodes/0']: null }], ['កែ barcode', { [H + '/' + target + '/barcodes/0/cod']: 8 }],
        ['លុប row', { [H + '/' + target]: null }], ['ជំនួស row', { [H + '/' + target]: { ...row, scanPending: null } }]]) {
        const patch = finalPatch(); if (extras[H + '/' + target] !== undefined) delete patch[H + '/' + target + '/scanPending'];
        await check('final batch មិនអាច ' + label, staged(), '/.json', { ...patch, ...extras }, false);
    }
    const ordinary = copy(row); delete ordinary.scanPending;
    const price = { token: 'price_' + 'd'.repeat(32), actorUid: uid, code: base.code, slot: '0', birth: base.birth,
        rowBirth: base.birth, scanDate: day, priorCod: base.cod, priorDod: 0, wantCod: 6.29, wantDod: 0, phase: 'admitted' };
    const priceRow = { ...copy(ordinary), pricePending: copy(price) };
    const priceTree = value => ({ [H]: { [target]: copy(value) } });
    await check('price admission ចាប់ row មុនសរសេរប្រាក់', priceTree(ordinary), at(H + '/' + target), priceRow, true, 'PUT');
    const historyPriceRow = copy(priceRow); historyPriceRow.pricePending.phase = 'history';
    historyPriceRow.barcodes[0].cod = price.wantCod; historyPriceRow.cod = price.wantCod; historyPriceRow.price = price.wantCod;
    await check('price admitted→history តម្លៃ target ត្រឹមត្រូវ', priceTree(priceRow), at(H + '/' + target), historyPriceRow, true, 'PUT');
    const cancelPriceRow = copy(priceRow); cancelPriceRow.pricePending.phase = 'cancelling';
    await check('price admitted→cancelling ទុកតម្លៃដើម', priceTree(priceRow), at(H + '/' + target), cancelPriceRow, true, 'PUT');
    const settledPriceRow = copy(historyPriceRow); settledPriceRow.pricePending.phase = 'settled'; settledPriceRow.pricePending.outcome = 'committed';
    await check('price history→settled committed', priceTree(historyPriceRow), at(H + '/' + target), settledPriceRow, true, 'PUT');
    const compensatedPriceRow = copy(cancelPriceRow); compensatedPriceRow.pricePending.phase = 'settled'; compensatedPriceRow.pricePending.outcome = 'compensated';
    await check('price cancelling→settled compensated', priceTree(cancelPriceRow), at(H + '/' + target), compensatedPriceRow, true, 'PUT');
    for (const [label, location, body, method] of [
        ['លុប row', at(H + '/' + target), null, 'PUT'], ['លុប marker', at(H + '/' + target + '/pricePending'), null, 'PUT'],
        ['កែ child', at(H + '/' + target + '/phone'), '099', 'PUT'], ['ជំនួស row phase ដដែល', at(H + '/' + target), { ...priceRow, isCalled: true }, 'PUT']
    ]) await check('price active រារាំង writer ចាស់៖ ' + label, priceTree(priceRow), location, body, false, method);
    for (const [field, value] of [['actorUid', 'foreign'], ['token', 'price_' + 'e'.repeat(32)], ['slot', '1'], ['birth', 1001], ['rowBirth', 1001], ['priorCod', 4], ['wantCod', 7]]) {
        const changed = copy(historyPriceRow); changed.pricePending[field] = value;
        await check('price immutable ' + field, priceTree(priceRow), at(H + '/' + target), changed, false, 'PUT');
    }
    const wrongPrice = copy(historyPriceRow); wrongPrice.barcodes[0].cod = 8;
    await check('price transition មិនអនុញ្ញាត target តម្លៃខុស', priceTree(priceRow), at(H + '/' + target), wrongPrice, false, 'PUT');
    const wrongClose = copy(historyPriceRow); wrongClose.barcodes[0].isClosed = true;
    await check('price transition មិនអនុញ្ញាត target lifecycle ខុស', priceTree(priceRow), at(H + '/' + target), wrongClose, false, 'PUT');
    await check('price active មិនអនុញ្ញាត settled ឆ្លងphase', priceTree(priceRow), at(H + '/' + target), settledPriceRow, false, 'PUT');
    await check('price settled មិនរារាំង normal row delete', priceTree(settledPriceRow), at(H + '/' + target), null, true, 'PUT');
    for (const phase of ['history', 'cancelling', 'settled']) {
        const malformed = copy(settledPriceRow); malformed.pricePending = { phase };
        await check('price ' + phase + ' ខ្វះshape ត្រូវ HOLD ទោះពេលលុប row', priceTree(malformed), at(H + '/' + target), null, false, 'PUT');
        await check('price ' + phase + ' ខ្វះshape មិនអនុញ្ញាត admission ជំនួស', priceTree(malformed), at(H + '/' + target), priceRow, false, 'PUT');
    }
    const oldMerge = copy(settledPriceRow); oldMerge.barcodes[0].code = 'OLD'; oldMerge.pricePending.code = 'OLD';
    const merged = copy(oldMerge); merged.barcodes[1] = copy(row.barcodes[0]); merged.scanPending = { ...marker, slot: '1' };
    merged.count = 2; merged.cod = 11.58; merged.price = 11.58;
    const withSettled = { ...copy(unstaged), [H]: { [target]: oldMerge } };
    const withClear = copy(withSettled); withClear[H][target].clearClaim = { token: 'clear-claim', claimedAt: 1 };
    await check('stage មិនអាចដក old clearClaim ហើយបញ្ចូល barcode', withClear, at(H + '/' + target), merged, false, 'PUT');
    const withTrash = copy(withSettled); withTrash[H][target].barcodes[0].trashClaim = 'trash-token'; withTrash[H][target].barcodes[0].trashClaimAt = 1;
    await check('stage មិនអាចដក old barcode trashClaim', withTrash, at(H + '/' + target), merged, false, 'PUT');
    const priceTrash = copy(ordinary); priceTrash.barcodes[0].trashClaim = 'trash-token'; priceTrash.barcodes[0].trashClaimAt = 1;
    await check('price admission មិនឆ្លង barcode trashClaim', priceTree(priceTrash), at(H + '/' + target), priceRow, false, 'PUT');
    await check('scan ក្រោយ price settled រក្សា terminal marker', withSettled, at(H + '/' + target), merged, true, 'PUT');
    const activeMerge = copy(withSettled); activeMerge[H][target].pricePending.phase = 'history'; delete activeMerge[H][target].pricePending.outcome;
    await check('scan មិនឆ្លង price active', activeMerge, at(H + '/' + target), merged, false, 'PUT');
    const siblingOld = copy(priceRow); siblingOld.barcodes[1] = { ...copy(row.barcodes[0]), code: 'BBB', cod: 1 }; siblingOld.count = 2; siblingOld.cod += 1; siblingOld.price += 1;
    const siblingNew = copy(siblingOld); siblingNew.pricePending.phase = 'history'; siblingNew.barcodes[0].cod = price.wantCod;
    siblingNew.cod += 1; siblingNew.price += 1; delete siblingNew.barcodes[1];
    await check('ព្រំដែន trusted owner៖ legal price phase អាចលុប sibling ដោយចេតនា', priceTree(siblingOld), at(H + '/' + target), siblingNew, true, 'PUT');
    const staleSibling = copy(siblingOld); delete staleSibling.barcodes[1];
    await check('writer ចាស់ phase ដដែលមិនអាចលុប sibling', priceTree(siblingOld), at(H + '/' + target), staleSibling, false, 'PUT');
    const missingIntent = copy(row); delete missingIntent.barcodes[0].scanIntent;
    await check('stage ត្រូវ bind barcode.scanIntent', unstaged, at(H + '/' + target), missingIntent, false, 'PUT');
    const wrongIntent = copy(row); wrongIntent.barcodes[0].scanIntent = 'scan_' + 'f'.repeat(32);
    await check('stage មិនទទួល scanIntent ម្ចាស់ផ្សេង', unstaged, at(H + '/' + target), wrongIntent, false, 'PUT');
    const toLegacy = finalPatch(); toLegacy[R + '/' + base.registryKey] = true;
    await check('final មិនអាចបំលែង owned registry ទៅ legacy true', staged(), '/.json', toLegacy, false);
    for (const [label, value] of [['null', null], ['owner ផ្សេង', { ...owner, actorUid: 'foreign' }]]) {
        const patch = finalPatch(); patch[R + '/' + base.registryKey] = value;
        await check('final មិនអាចប្តូរ registry ទៅ ' + label, staged(), '/.json', patch, false);
    }
    await check('committed owned registry មិនទទួល queued null ចាស់', committed, at(R + '/' + base.registryKey), null, false, 'PUT');
    await check('committed owned registry មិនទទួល true ចាស់', committed, at(R + '/' + base.registryKey), true, false, 'PUT');
    const trashId = 'trashA', releaseId = 'release_' + 'e'.repeat(32);
    const source = copy(row); delete source.scanPending; source.deletedAt = 2000; source.trashGeneration = 1;
    const receipt = { v: 2, generation: 1, id, kind: 'scan', actorUid: uid, releasedBy: uid, scope: base.scope, code: base.code,
        registryKey: base.registryKey, birth: base.birth, trashId, slot: '0', deletedAt: 2000, rowBirth: base.birth, rowCount: 1 };
    const purgeTree = () => ({ [O]: { [id]: { ...prepared, phase: 'committed' } }, [R]: { [base.registryKey]: copy(owner) }, [T]: { [trashId]: copy(source) } });
    const consumption = value => ({ v: 1, sourceId: value.trashId, generation: value.generation, kind: 'purge', actorUid: value.releasedBy,
        scope: value.scope, deletedAt: value.deletedAt, rowBirth: value.rowBirth });
    const purgePatch = value => ({ [T + '/' + value.trashId]: null, [R + '/' + value.registryKey]: null, [L + '/' + value.id]: copy(value), [G + '/' + value.trashId]: consumption(value) });
    const purged = await check('purge scan៖ source + registry + receipt atomic', purgeTree(), '/.json', purgePatch(receipt), true);
    if (purged) {
        assert.equal(purged[T]?.[trashId], undefined); assert.equal(purged[R]?.[base.registryKey], undefined);
        for (const field of ['id', 'kind', 'scope', 'code', 'registryKey', 'birth', 'trashId', 'slot', 'deletedAt', 'rowBirth', 'rowCount']) assert.equal(purged[L][id][field], receipt[field]);
        assert.equal(purged[L][id].actorUid, purged[O][id].actorUid); assert.equal(purged[L][id].releasedBy, purged[O][id].actorUid);
    }
    const purgeTerminal = { [O]: { [id]: { ...prepared, phase: 'committed' } }, [L]: { [id]: copy(receipt) }, [G]: { [trashId]: consumption(receipt) } };
    await check('purge lost ACK៖ receipt read បានតែ full replay ត្រូវបដិសេធ', purgeTerminal, '/.json', purgePatch(receipt), false);
    await check('release receipt មិនអាចសរសេរដដែល', purgeTerminal, at(L + '/' + id), receipt, false, 'PUT');
    await check('release receipt មិនអាចលុប', purgeTerminal, at(L + '/' + id), null, false, 'PUT');
    await check('committed operation ក្រោយ purge មិនអាច late claim registry ឡើងវិញ', purgeTerminal, at(R + '/' + base.registryKey), owner, false, 'PUT');
    const nextId = 'scan_' + 'f'.repeat(32), nextBase = { ...base, id: nextId, monthToken: 'op_m' + 'f'.repeat(32) };
    const nextClaim = copy(purgeTerminal); nextClaim[O][nextId] = nextBase; nextClaim[I] = { [nextId]: uid };
    await check('scan operation ថ្មីអាចកក់ registry ក្រោយ purge', nextClaim, at(R + '/' + base.registryKey), { ...owner, intent: nextId }, true, 'PUT');
    const reclaimed = copy(purgeTerminal); reclaimed[O][nextId] = { ...prepared, ...nextBase, phase: 'committed' };
    reclaimed[R] = { [base.registryKey]: { ...owner, intent: nextId } }; reclaimed[T] = { [trashId]: copy(source) };
    await check('receipt ចាស់មានរួចមិនអាចលុប scan owner ថ្មី', reclaimed, '/.json', purgePatch(receipt), false);
    await check('purge scan អនុញ្ញាតអ្នកប្រើផ្សេងដោយរក្សា original actor', purgeTree(), '/.json', purgePatch({ ...receipt, releasedBy: 'foreign' }), true, 'PATCH', 'foreign');
    for (const missing of [T + '/' + trashId, R + '/' + base.registryKey, L + '/' + id, G + '/' + trashId]) {
        const patch = purgePatch(receipt); delete patch[missing];
        await check('purge scan ខ្វះ atomic leaf៖ ' + missing, purgeTree(), '/.json', patch, false);
    }
    for (const [field, value] of [['actorUid', 'foreign'], ['releasedBy', 'foreign'], ['scope', 'other'], ['code', 'OTHER'], ['registryKey', 'OTHER'], ['generation', 2],
        ['birth', 1001], ['trashId', 'other'], ['slot', '1'], ['deletedAt', 2001], ['rowBirth', 1001], ['rowCount', 2], ['extra', true]]) {
        await check('release receipt selector ខុស៖ ' + field, purgeTree(), '/.json', purgePatch({ ...receipt, [field]: value }), false);
    }
    for (const phase of ['admitted', 'prepared', 'cancelled']) {
        const tree = purgeTree(); tree[O][id].phase = phase;
        await check('release scan មិនយក operation ' + phase, tree, '/.json', purgePatch(receipt), false);
    }
    for (const [field, value] of [['scanIntent', 'scan_' + 'f'.repeat(32)], ['createdAt', 1001], ['code', 'OTHER']]) {
        const tree = purgeTree(); tree[T][trashId].barcodes[0][field] = value;
        await check('release source barcode ជំនួស៖ ' + field, tree, '/.json', purgePatch(receipt), false);
    }
    for (const [field, value] of [['restoreClaim', { token: 'restore', targetId: target, claimedAt: 2000 }], ['scanPending', marker],
        ['pricePending', { ...price, phase: 'history' }], ['pricePending', { phase: 'settled' }]]) {
        const tree = purgeTree(); tree[T][trashId][field] = value;
        await check('release source មាន lock៖ ' + field + ':' + (value.phase || ''), tree, '/.json', purgePatch(receipt), false);
    }
    const restored = purgeTree(); delete restored[T]; restored[H] = { [target]: copy(ordinary) };
    await check('release ក្រោយ source Restore ទៅ history មិនលុប registry', restored, '/.json', purgePatch(receipt), false);
    await check('release source ត្រូវបានជំនួសក្រោយ snapshot', purgeTree(), '/.json', purgePatch(receipt), false, 'PATCH', uid, async snapshot => {
        assert.equal(snapshot[T][trashId].deletedAt, receipt.deletedAt);
        const changed = await req('PUT', at(T + '/' + trashId + '/deletedAt'), receipt.deletedAt + 1, uid); assert.equal(changed.status, 200);
    });
    const legacyReceipt = { ...receipt, id: releaseId, kind: 'legacy', birth: 0, rowBirth: 0, rowCount: 0 };
    const legacyTree = () => {
        const tree = purgeTree(); delete tree[O]; tree[R][base.registryKey] = true;
        delete tree[T][trashId].barcodes[0].scanIntent; tree[T][trashId].barcodes[0].createdAt = 0;
        tree[T][trashId].createdAt = 0; tree[T][trashId].count = 0;
        return tree;
    };
    await check('purge legacy birth0 + true registry', legacyTree(), '/.json', purgePatch(legacyReceipt), true);
    const absentLegacy = legacyTree(); delete absentLegacy[R]; delete absentLegacy[T][trashId].createdAt;
    delete absentLegacy[T][trashId].count; delete absentLegacy[T][trashId].barcodes[0].createdAt;
    await check('purge legacy registry/birth/count មិនមានប្រើ0', absentLegacy, '/.json', purgePatch(legacyReceipt), true);
    const legacyPurged = { [L]: { [releaseId]: copy(legacyReceipt) }, [R]: { [base.registryKey]: true } };
    await check('legacy full replay មិនលុប claim true ថ្មីក្រោយ lost ACK', legacyPurged, '/.json', purgePatch(legacyReceipt), false);
    const ownedLegacy = legacyTree(); ownedLegacy[R][base.registryKey] = copy(owner); ownedLegacy[O] = { [id]: { ...prepared, phase: 'committed' } };
    await check('legacy receipt មិនអាចលុប owned scan registry', ownedLegacy, '/.json', purgePatch(legacyReceipt), false);
    const intentLegacy = legacyTree(); intentLegacy[T][trashId].barcodes[0].scanIntent = id;
    await check('legacy receipt មិនអាចយក barcode មាន scanIntent', intentLegacy, '/.json', purgePatch(legacyReceipt), false);
    for (const malformed of ['', 'scan_bad']) {
        const tree = legacyTree(); tree[T][trashId].barcodes[0].scanIntent = malformed;
        await check('scanIntent ខូចមិនអាចធ្លាក់ទៅ legacy៖ ' + malformed, tree, '/.json', purgePatch(legacyReceipt), false);
    }
    const mixed = purgeTree(); mixed[T][trashId].barcodes[1] = { ...copy(source.barcodes[0]), code: 'LEGACY', createdAt: 0 };
    delete mixed[T][trashId].barcodes[1].scanIntent; mixed[T][trashId].count = 2; mixed[R].LEGACY = true;
    const scanMixed = { ...receipt, rowCount: 2 }, legacyMixed = { ...legacyReceipt, code: 'LEGACY', registryKey: 'LEGACY', slot: '1', rowBirth: base.birth, rowCount: 2 };
    const mixedPatch = { ...purgePatch(scanMixed), ...purgePatch(legacyMixed) };
    await check('purge mixed scan/legacy មាន receipt តាម slot នីមួយៗ', mixed, '/.json', mixedPatch, true);
    const wrongMixed = copy(mixedPatch); wrongMixed[L + '/' + releaseId].slot = '0';
    await check('purge mixed មិនអាចដាក់ receipt legacy លើ scan slot', mixed, '/.json', wrongMixed, false);
    const v1 = { ...receipt, v: 1 }; delete v1.generation;
    const oldRelease = { [L]: { [id]: v1 } };
    await check('release v1 ចាស់អានបាន តែមិនសរសេរដដែល', oldRelease, at(L + '/' + id), v1, false, 'PUT');
    const v1Patch = purgePatch(receipt); v1Patch[L + '/' + id] = v1;
    await check('release v1 ថ្មីមិនអាចបង្កើតក្រោយ generation fence', purgeTree(), '/.json', v1Patch, false);
    const sourceOnly = value => ({ [T]: { [trashId]: value } });
    for (const value of [undefined, 0, 1, 2, -1, 1.5, false, '1', 9007199254740991]) {
        const fresh = copy(source); if (value === undefined) delete fresh.trashGeneration; else fresh.trashGeneration = value;
        await check('trash ថ្មី generation៖ ' + String(value), {}, at(T + '/' + trashId), fresh, value === undefined || value === 0 || value === 1, 'PUT');
    }
    const normalizedNull = copy(source); normalizedNull.trashGeneration = null;
    await check('ព្រំដែន RTDB៖ null លើ source ថ្មីក្លាយជា legacy absent', {}, at(T + '/' + trashId), normalizedNull, true, 'PUT');
    for (const value of [undefined, 0, 1]) {
        const previous = copy(source); if (value === undefined) delete previous.trashGeneration; else previous.trashGeneration = value;
        await check('trash metadata ស្របច្បាប់រក្សា generation៖ ' + String(value), sourceOnly(previous), at(T + '/' + trashId), { ...previous, phone: '099' }, true, 'PUT');
        const changed = { ...previous, trashGeneration: value === undefined ? 0 : null };
        await check('trash generation presence មិនអាចប្តូរ៖ ' + String(value), sourceOnly(previous), at(T + '/' + trashId), changed, false, 'PUT');
    }
    await check('trash generation មិនអាចដំឡើងលើ source កំពុងមាន', sourceOnly(source), at(T + '/' + trashId + '/trashGeneration'), 2, false, 'PUT');
    await check('trash source មិនអាចលុបគ្មាន consumption', sourceOnly(source), at(T + '/' + trashId), null, false, 'PUT');
    await check('trash source មិនមាន null ជា no-op', {}, at(T + '/' + trashId), null, true, 'PUT');
    const consumed = { [G]: { [trashId]: consumption(receipt) } };
    for (const value of [undefined, 0, 1, 2, 3]) {
        const next = copy(source); if (value === undefined) delete next.trashGeneration; else next.trashGeneration = value;
        await check('ក្រោយ consume1 source ថ្មីត្រូវជា2៖ ' + String(value), consumed, at(T + '/' + trashId), next, value === 2, 'PUT');
    }
    await check('consumption tuple ដដែលជាការសរសេរមិនប្រែតម្លៃ', consumed, at(G + '/' + trashId), consumption(receipt), true, 'PUT');
    await check('consumption មិនអាចលុប', consumed, at(G + '/' + trashId), null, false, 'PUT');
    for (const [field, value] of [['actorUid', 'foreign'], ['scope', 'OTHER'], ['deletedAt', 2001], ['rowBirth', 1001], ['generation', 0], ['token', 'extra']]) {
        await check('consumption generation ដដែលមិនអាចកែ៖ ' + field, consumed, at(G + '/' + trashId), { ...consumption(receipt), [field]: value }, false, 'PUT');
    }
    const staleConsumed = purgeTree(); staleConsumed[G] = copy(consumed[G]);
    await check('equal consumption មិនអនុញ្ញាតលុប stale source generation ដដែល', staleConsumed, '/.json', purgePatch(receipt), false);
    await check('stale source ដែល consume រួចមិនអាច metadata write', staleConsumed, at(T + '/' + trashId + '/phone'), '099', false, 'PUT');
    const nextTree = purgeTree(); nextTree[T][trashId].trashGeneration = 2; nextTree[G] = copy(consumed[G]);
    const nextReceipt = { ...receipt, generation: 2 };
    await check('purge advance generation1→2 ត្រូវ source2 និង receipt2', nextTree, '/.json', purgePatch(nextReceipt), true);
    const jumped = copy(nextTree); jumped[T][trashId].trashGeneration = 3;
    await check('purge មិនអាចរំលង generation1→3', jumped, '/.json', purgePatch({ ...receipt, generation: 3 }), false);
    const maxReceipt = { ...receipt, generation: 9007199254740990 };
    const maxTree = purgeTree(); maxTree[T][trashId].trashGeneration = maxReceipt.generation;
    maxTree[G] = { [trashId]: { ...consumption(maxReceipt), generation: maxReceipt.generation - 1 } };
    await check('purge generation MAX-1→MAX អនុញ្ញាត', maxTree, '/.json', purgePatch(maxReceipt), true);
    const maxConsumed = { [G]: { [trashId]: consumption(maxReceipt) } };
    await check('generation MAX មិនអាច overflow បង្កើត source ថ្មី', maxConsumed, at(T + '/' + trashId), { ...source, trashGeneration: maxReceipt.generation + 1 }, false, 'PUT');
    for (const missing of [true, false]) {
        const tree = purgeTree(); if (missing) delete tree[T][trashId].trashGeneration; else tree[T][trashId].trashGeneration = 0;
        await check('legacy generation0 អាច consume ម្តង៖ ' + (missing ? 'absent' : 'explicit0'), tree, '/.json', purgePatch({ ...receipt, generation: 0 }), true);
    }
    for (const value of [false, '1', -1, 0.5, 9007199254740991]) {
        const tree = purgeTree(); tree[T][trashId].trashGeneration = value;
        await check('purge source generation ខូចត្រូវ HOLD៖ ' + String(value), tree, '/.json', purgePatch(receipt), false);
    }
    for (const value of [{ generation: 1 }, { ...consumption(receipt), generation: '1' }, { ...consumption(receipt), sourceId: 'OTHER' }]) {
        const tree = sourceOnly({ ...source, trashGeneration: 2 }); tree[G] = { [trashId]: value };
        await check('consumption ចាស់ខូចមិនអនុញ្ញាត metadata source', tree, at(T + '/' + trashId + '/phone'), '099', false, 'PUT');
    }
    const restoreToken = 'restore-token';
    const restoreSource = { ...copy(source), restoreClaim: { token: restoreToken, targetId: target, claimedAt: 2001 } };
    const restoreTarget = { ...copy(ordinary), restoreClaimId: trashId, restoreClaimToken: restoreToken, restoreAddedCodes: JSON.stringify([base.code]) };
    const restoreConsumption = { ...consumption(receipt), kind: 'restore', token: restoreToken, targetId: target };
    const restoreTree = () => ({ [T]: { [trashId]: copy(restoreSource) }, [H]: { [target]: copy(restoreTarget) } });
    const restorePatch = () => ({ [T + '/' + trashId]: null, [G + '/' + trashId]: copy(restoreConsumption),
        [F + '/' + trashId]: { token: restoreToken, targetId: target, finalizedAt: 2002 },
        [H + '/' + target + '/restoreClaimId']: null, [H + '/' + target + '/restoreClaimToken']: null, [H + '/' + target + '/restoreAddedCodes']: null });
    await check('Restore source+consumption+finalization+target markers atomic', restoreTree(), '/.json', restorePatch(), true);
    for (const missing of [true, false]) {
        const tree = restoreTree(); if (missing) delete tree[T][trashId].trashGeneration; else tree[T][trashId].trashGeneration = 0;
        const patch = restorePatch(); patch[G + '/' + trashId].generation = 0;
        await check('Restore legacy generation0៖ ' + (missing ? 'absent' : 'explicit0'), tree, '/.json', patch, true);
    }
    const partialTarget = restoreTree(); partialTarget[H][target].barcodes[1] = { ...copy(row.barcodes[0]), code: 'BBB' };
    partialTarget[H][target].count = 2;
    const partialAfter = await check('Restore បញ្ចប់លើ target រួមរក្សា barcode ផ្សេង', partialTarget, '/.json', restorePatch(), true);
    if (partialAfter) {
        assert.equal(partialAfter[H][target].barcodes[0].code, base.code);
        assert.equal(partialAfter[H][target].barcodes[1].code, 'BBB'); assert.equal(partialAfter[H][target].count, 2);
    }
    for (const removed of [T + '/' + trashId, G + '/' + trashId, F + '/' + trashId, H + '/' + target + '/restoreClaimToken']) {
        const patch = restorePatch(); delete patch[removed];
        await check('Restore ខ្វះ atomic leaf៖ ' + removed, restoreTree(), '/.json', patch, false);
    }
    for (const [field, value] of [['token', 'OTHER'], ['targetId', 'OTHER'], ['generation', 2], ['deletedAt', 2001], ['rowBirth', 1001], ['actorUid', 'foreign']]) {
        const patch = restorePatch(); patch[G + '/' + trashId][field] = value;
        await check('Restore consumption tuple ខុស៖ ' + field, restoreTree(), '/.json', patch, false);
    }
    const dropEmpty = restoreTree(); delete dropEmpty[H][target].barcodes;
    const dropPatch = restorePatch(); for (const key of Object.keys(dropPatch)) if (key.startsWith(H + '/')) delete dropPatch[key];
    dropPatch[H + '/' + target] = null;
    await check('Restore អនុញ្ញាត drop prepared target ដែលគ្មាន barcode', dropEmpty, '/.json', dropPatch, true);
    await check('Restore មិនអាច drop prepared target ដែលនៅមាន barcode', restoreTree(), '/.json', dropPatch, false);
    const blockedRestore = restoreTree(); blockedRestore[T][trashId].restoreBlocked = true;
    await check('generation fence មិនបន្ធូរ Restore blocked', blockedRestore, '/.json', restorePatch(), false);
    const palmRestore = restoreTree(); palmRestore[T][trashId].trashMode = 'palm'; palmRestore[T][trashId].restoreBlocked = true;
    await check('generation fence មិនបន្ធូរ Palm Restore', palmRestore, '/.json', restorePatch(), false);
    const noStamp = restoreTree(); delete noStamp[T][trashId].deletedAt;
    await check('Restore គ្មាន deletedAt ត្រូវ HOLD', noStamp, '/.json', restorePatch(), false);
    const restoreTerminal = { [G]: { [trashId]: copy(restoreConsumption) }, [H]: { [target]: copy(ordinary) } };
    await check('journal ចាស់មិនអាចបង្កើត source1 ក្រោយ Restore1', restoreTerminal, at(T + '/' + trashId), source, false, 'PUT');
    const clearClaim = { token: 'clear-token', claimedAt: 2001, trashGeneration: 1, deletedAt: 2002 };
    const clearRow = { ...copy(ordinary), clearClaim };
    await check('ClearHistory claim ចាប់ generation និង deletedAt ម្តង', priceTree(ordinary), at(H + '/' + target), clearRow, true, 'PUT');
    await check('ClearHistory same-token retry រក្សា tuple', priceTree(clearRow), at(H + '/' + target), copy(clearRow), true, 'PUT');
    const clearNextTree = priceTree(ordinary); clearNextTree[G] = { [target]: { ...consumption(receipt), sourceId: target } };
    const clearNextRow = copy(clearRow); clearNextRow.clearClaim.trashGeneration = 2;
    await check('ClearHistory fresh claim ក្រោយconsume1 ទទួលgeneration2', clearNextTree, at(H + '/' + target), clearNextRow, true, 'PUT');
    await check('ClearHistory fresh claim មិនយកgeneration1ដែលconsumeរួច', clearNextTree, at(H + '/' + target), clearRow, false, 'PUT');
    for (const field of ['claimedAt', 'trashGeneration', 'deletedAt']) {
        const changed = copy(clearRow); changed.clearClaim[field]++;
        await check('ClearHistory same-token មិនអាចrefresh៖ ' + field, priceTree(clearRow), at(H + '/' + target), changed, false, 'PUT');
    }
    const oldClear = copy(clearRow); delete oldClear.clearClaim.trashGeneration; delete oldClear.clearClaim.deletedAt;
    await check('ClearHistory claim ចាស់មិនពេញត្រូវ HOLD', priceTree(oldClear), at(H + '/' + target), clearRow, false, 'PUT');
    const clearTrash = { ...copy(source), id: target, deletedAt: clearClaim.deletedAt, trashGeneration: clearClaim.trashGeneration, isFromDeletion: true };
    const clearPatch = { [H + '/' + target]: null, [T + '/' + target]: clearTrash, [CF + '/' + target]: { token: clearClaim.token, finalizedAt: 2003 } };
    await check('ClearHistory final source generation/deletedAt bind claim', priceTree(clearRow), '/.json', clearPatch, true);
    for (const field of ['trashGeneration', 'deletedAt']) {
        const changed = copy(clearPatch); changed[T + '/' + target][field]++;
        await check('ClearHistory final tuple ខុស៖ ' + field, priceTree(clearRow), '/.json', changed, false);
    }
    console.log('\n' + backend + ' scan rules: ' + pass + ' PASS, ' + fail + ' FAIL; វាស់តែ backend ដែលបង្ហាញនេះ។');
    process.exitCode = fail ? 1 : 0;
}
run().catch(error => { console.error('FAIL: ' + error.stack); process.exitCode = 1; }).finally(async () => {
    if (pgConnection) await pgConnection.end();
    if (pgHarness) pgHarness.stop();
});
