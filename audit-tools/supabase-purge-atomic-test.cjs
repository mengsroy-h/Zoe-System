'use strict';

process.exitCode = 1;
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { isDeepStrictEqual } = require('util');
const ROOT = process.env.SUPABASE_PURGE_APP_DIR ? path.resolve(process.env.SUPABASE_PURGE_APP_DIR) : path.join(__dirname, '..');
const REPO = process.env.ZOE_REPO_ROOT ? path.resolve(process.env.ZOE_REPO_ROOT) : path.join(__dirname, '..');
const { createPgHarness } = require('./supabase-pg.js');
const config = fs.readFileSync(path.join(ROOT, 'supabase/config.toml'), 'utf8');
const H = createPgHarness({ depsDirs: [process.env.SUPABASE_DEPS_DIR, path.join(REPO, 'supabase/node_modules')].filter(Boolean),
    shimDir: path.join(__dirname, 'supabase-shim'), wantMajor: Number((config.match(/^major_version\s*=\s*(\d+)/m) || [])[1]) });
const BINDING_VECTORS = [{"name":"mixed-ascii-receipt-order","ops":[{"k":"set","p":["zoew_recently_deleted_cod_dod","source"],"v":null},{"k":"set","p":["zoew_trash_consumptions","source"],"v":{"v":1,"sourceId":"source","generation":3,"kind":"purge","actorUid":"purge-user","scope":"shop","deletedAt":456,"rowBirth":100}},{"k":"set","p":["zoew_barcode_registry","AA"],"v":null},{"k":"set","p":["zoew_registry_releases","scan_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],"v":{"v":2,"generation":3,"id":"scan_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","kind":"scan","actorUid":"scan-actor","releasedBy":"purge-user","scope":"shop","code":"aa","registryKey":"AA","birth":123,"trashId":"source","slot":"0","deletedAt":456,"rowBirth":100,"rowCount":2}},{"k":"set","p":["zoew_barcode_registry","B%2F%5B%5D"],"v":null},{"k":"set","p":["zoew_registry_releases","release_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"],"v":{"v":2,"generation":3,"id":"release_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","kind":"legacy","actorUid":"purge-user","releasedBy":"purge-user","scope":"shop","code":"b/[]","registryKey":"B%2F%5B%5D","birth":0,"trashId":"source","slot":"1","deletedAt":456,"rowBirth":100,"rowCount":2}}],"preimage":"[\"zoew-registry-purge-v1\",2,\"source\",3,\"purge-user\",\"shop\",456,100,2,[[\"release_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\",\"legacy\",\"purge-user\",\"b/[]\",\"B%2F%5B%5D\",0,\"1\"],[\"scan_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"scan\",\"scan-actor\",\"aa\",\"AA\",123,\"0\"]]]","hash":"9b3a9965c4cc5fb2c5656d4284432f0384d4f351bed62c903b0f688fb80b4457"},{"name":"unicode-uppercase-astral-and-space","ops":[{"k":"set","p":["zoew_recently_deleted_cod_dod","source"],"v":null},{"k":"set","p":["zoew_trash_consumptions","source"],"v":{"v":1,"sourceId":"source","generation":3,"kind":"purge","actorUid":"user \"quote\" \\ tab\tline\n","scope":"https://\u4f8b\u3048.test/\u5e97 \"Q\" \\ tab\tline\n","deletedAt":456,"rowBirth":100}},{"k":"set","p":["zoew_barcode_registry","STRASSE\ud83d\ude00%2F\u00c9"],"v":null},{"k":"set","p":["zoew_registry_releases","release_cccccccccccccccccccccccccccccccc"],"v":{"v":2,"generation":3,"id":"release_cccccccccccccccccccccccccccccccc","kind":"legacy","actorUid":"user \"quote\" \\ tab\tline\n","releasedBy":"user \"quote\" \\ tab\tline\n","scope":"https://\u4f8b\u3048.test/\u5e97 \"Q\" \\ tab\tline\n","code":" stra\u00dfe\ud83d\ude00/\u00e9 ","registryKey":"STRASSE\ud83d\ude00%2F\u00c9","birth":123,"trashId":"source","slot":"0","deletedAt":456,"rowBirth":100,"rowCount":1}}],"preimage":"[\"zoew-registry-purge-v1\",2,\"source\",3,\"user \\\"quote\\\" \\\\ tab\\tline\\n\",\"https://\u4f8b\u3048.test/\u5e97 \\\"Q\\\" \\\\ tab\\tline\\n\",456,100,1,[[\"release_cccccccccccccccccccccccccccccccc\",\"legacy\",\"user \\\"quote\\\" \\\\ tab\\tline\\n\",\" stra\u00dfe\ud83d\ude00/\u00e9 \",\"STRASSE\ud83d\ude00%2F\u00c9\",123,\"0\"]]]","hash":"d742db7f178eb2b2180c5dc0a6be7af395c7e86ba1bf264483bb7cc5f71bebbf"},{"name":"unicode-I-and-max-safe-protocol-integer","ops":[{"k":"set","p":["zoew_recently_deleted_cod_dod","source"],"v":null},{"k":"set","p":["zoew_trash_consumptions","source"],"v":{"v":1,"sourceId":"source","generation":9007199254740990,"kind":"purge","actorUid":"purge-user","scope":"shop","deletedAt":9007199254740990,"rowBirth":9007199254740989}},{"k":"set","p":["zoew_barcode_registry","II\u0130SS%2E%25%24%5B%5D%2F"],"v":null},{"k":"set","p":["zoew_registry_releases","release_dddddddddddddddddddddddddddddddd"],"v":{"v":2,"generation":9007199254740990,"id":"release_dddddddddddddddddddddddddddddddd","kind":"legacy","actorUid":"purge-user","releasedBy":"purge-user","scope":"shop","code":"i\u0131\u0130\u00df.%$[]/","registryKey":"II\u0130SS%2E%25%24%5B%5D%2F","birth":9007199254740990,"trashId":"source","slot":"7","deletedAt":9007199254740990,"rowBirth":9007199254740989,"rowCount":1}}],"preimage":"[\"zoew-registry-purge-v1\",2,\"source\",9007199254740990,\"purge-user\",\"shop\",9007199254740990,9007199254740989,1,[[\"release_dddddddddddddddddddddddddddddddd\",\"legacy\",\"purge-user\",\"i\u0131\u0130\u00df.%$[]/\",\"II\u0130SS%2E%25%24%5B%5D%2F\",9007199254740990,\"7\"]]]","hash":"2d49e29071b02c670fc1486cfb3f07e065d8e3daa3324087ce9685caf07f0201"},{"name":"escaped-quote-backslash-control","ops":[{"k":"set","p":["zoew_recently_deleted_cod_dod","source"],"v":null},{"k":"set","p":["zoew_trash_consumptions","source"],"v":{"v":1,"sourceId":"source","generation":3,"kind":"purge","actorUid":"uid\\x","scope":"s\"\t\n\\\ud83d\ude00","deletedAt":456,"rowBirth":100}},{"k":"set","p":["zoew_barcode_registry","A\"%09B%0AC\\D"],"v":null},{"k":"set","p":["zoew_registry_releases","release_eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"],"v":{"v":2,"generation":3,"id":"release_eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee","kind":"legacy","actorUid":"uid\\x","releasedBy":"uid\\x","scope":"s\"\t\n\\\ud83d\ude00","code":"a\"\tb\nc\\d","registryKey":"A\"%09B%0AC\\D","birth":123,"trashId":"source","slot":"0","deletedAt":456,"rowBirth":100,"rowCount":1}}],"preimage":"[\"zoew-registry-purge-v1\",2,\"source\",3,\"uid\\\\x\",\"s\\\"\\t\\n\\\\\ud83d\ude00\",456,100,1,[[\"release_eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee\",\"legacy\",\"uid\\\\x\",\"a\\\"\\tb\\nc\\\\d\",\"A\\\"%09B%0AC\\\\D\",123,\"0\"]]]","hash":"193e2bc583910e1cdcade321bd66bc11a832fe611b51e234073286224ba04cb4"},{"name":"json-number-normalization","ops":[{"k":"set","p":["zoew_recently_deleted_cod_dod","source"],"v":null},{"k":"set","p":["zoew_trash_consumptions","source"],"v":{"v":1,"sourceId":"source","generation":1,"kind":"purge","actorUid":"purge-user","scope":"shop","deletedAt":1,"rowBirth":0}},{"k":"set","p":["zoew_barcode_registry","N"],"v":null},{"k":"set","p":["zoew_registry_releases","release_ffffffffffffffffffffffffffffffff"],"v":{"v":2,"generation":1,"id":"release_ffffffffffffffffffffffffffffffff","kind":"legacy","actorUid":"purge-user","releasedBy":"purge-user","scope":"shop","code":"N","registryKey":"N","birth":1,"trashId":"source","slot":"0","deletedAt":1,"rowBirth":0,"rowCount":1}}],"preimage":"[\"zoew-registry-purge-v1\",2,\"source\",1,\"purge-user\",\"shop\",1,0,1,[[\"release_ffffffffffffffffffffffffffffffff\",\"legacy\",\"purge-user\",\"N\",\"N\",1,\"0\"]]]","hash":"c943d281a1ceabfc71d253f6599211b3483a486edda1ffec52682c453485997a","rawOpsJson":"[{\"k\":\"set\",\"p\":[\"zoew_recently_deleted_cod_dod\",\"source\"],\"v\":null},{\"k\":\"set\",\"p\":[\"zoew_trash_consumptions\",\"source\"],\"v\":{\"v\":1,\"sourceId\":\"source\",\"generation\":1.0,\"kind\":\"purge\",\"actorUid\":\"purge-user\",\"scope\":\"shop\",\"deletedAt\":1.0,\"rowBirth\":0.0}},{\"k\":\"set\",\"p\":[\"zoew_barcode_registry\",\"N\"],\"v\":null},{\"k\":\"set\",\"p\":[\"zoew_registry_releases\",\"release_ffffffffffffffffffffffffffffffff\"],\"v\":{\"v\":2,\"generation\":1.0,\"id\":\"release_ffffffffffffffffffffffffffffffff\",\"kind\":\"legacy\",\"actorUid\":\"purge-user\",\"releasedBy\":\"purge-user\",\"scope\":\"shop\",\"code\":\"N\",\"registryKey\":\"N\",\"birth\":1.0,\"trashId\":\"source\",\"slot\":\"0\",\"deletedAt\":1.0,\"rowBirth\":0.0,\"rowCount\":1}}]"}];
const T = 'zoew_recently_deleted_cod_dod', R = 'zoew_barcode_registry', L = 'zoew_registry_releases', G = 'zoew_trash_consumptions';
let pass = 0, fail = 0, serial = 0;
const cases = [];
function ok(label, cond, detail) {
    cases.push({ label, pass: !!cond, kind: 'behavior' });
    if (cond) { pass++; console.log('  ok    ' + label); }
    else { fail++; console.log('  FAIL  ' + label + (detail === undefined ? '' : '\n        ' + JSON.stringify(detail).slice(0, 1100))); }
}
const opId = () => 'purge_op_' + (++serial).toString().padStart(20, '0');
const copy = value => JSON.parse(JSON.stringify(value));
const canonicalKey = code => String(code || '').trim().toUpperCase().replace(/[%.#$\[\]\/\x00-\x1F\x7F]/g, character => '%' + character.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0'));
const validHolder = (name, actorUid) => ({ v: 2, intent: 'scan_' + hash(name).slice(0, 32), actorUid, birth: 1700000001000 });
const hash = value => crypto.createHash('sha256').update(value, 'utf8').digest('hex');
function expectedHash(ops) {
    const rows = ops.filter(op => op.p[0] === L).map(op => op.v).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    const first = rows[0];
    return hash(JSON.stringify(['zoew-registry-purge-v1', 2, first.trashId, first.generation, first.releasedBy, first.scope,
        first.deletedAt, first.rowBirth, first.rowCount, rows.map(row => [row.id, row.kind, row.actorUid, row.code, row.registryKey, row.birth, row.slot])]));
}
function fixture(tenant, uid, name, count, overrides) {
    const createdAt = 1700000000000, deletedAt = 1790000000000;
    const scope = 'https://purge.invalid/database#' + tenant;
    const barcodes = {}, receipts = [];
    for (let i = 0; i < count; i++) {
        const code = 'F03_' + name.toUpperCase() + '_' + i;
        barcodes[i] = { code, cod: 1, dod: 0, isClosed: false, createdAt: createdAt + i };
        receipts.push({ v: 2, generation: 1, id: 'release_' + hash(name + ':' + i).slice(0, 32), kind: 'legacy', actorUid: uid,
            releasedBy: uid, scope, code, registryKey: code, birth: createdAt + i, trashId: name, slot: String(i), deletedAt,
            rowBirth: createdAt, rowCount: count });
    }
    const source = { id: name, phone: '012345678', cod: count, dod: 0, price: count, count, isClosed: false, createdAt,
        scanDate: '2026-10-01', time: '09:00:00 (2026-10-01)', barcodes, deletedAt, trashReason: 'removed', trashGeneration: 1 };
    const consumption = { v: 1, sourceId: name, generation: 1, kind: 'purge', actorUid: uid, scope, deletedAt, rowBirth: createdAt };
    const ops = [{ k: 'set', p: [T, name], v: null }, { k: 'set', p: [G, name], v: consumption }];
    for (const receipt of receipts) ops.push({ k: 'set', p: [R, receipt.registryKey], v: null }, { k: 'set', p: [L, receipt.id], v: receipt });
    return Object.assign({ name, source, receipts, ops, tenant, uid }, overrides || {});
}
async function main() {
    if (H.unavailableReason()) throw new Error(H.unavailableReason());
    await H.start();
    const { c, name } = await H.freshDb('no-default-grants');
    try {
        const dir = path.join(ROOT, 'supabase/migrations');
        const files = fs.readdirSync(dir).filter(file => /^\d{14}_[a-z0-9_]+\.sql$/.test(file)).sort();
        for (const file of files) await c.query(fs.readFileSync(path.join(dir, file), 'utf8'));
        console.log('PostgreSQL ' + H.pgBin.version + ' · migrations ' + files.length);
        const uid = await H.makeAuthUser(c, 'purge-a@u.zoe.test');
        const otherUid = await H.makeAuthUser(c, 'purge-b@u.zoe.test');
        const tenants = (await c.query("insert into public.tenants(name,branch_code,expires_at) values ('purge A','purge_a',now()+interval '30 days'),('purge B','purge_b',now()+interval '30 days') returning id")).rows;
        const A = tenants[0].id, B = tenants[1].id;
        await c.query("insert into public.tenant_members(user_id,tenant_id,username) values ($1,$2,'purge_a'),($3,$4,'purge_b')", [uid, A, otherUid, B]);
        const who = { role: 'authenticated', sub: uid };
        const call = async (kind, f, id, actor, expected) => {
            const result = await H.as(c, actor || who, 'select public.zoe_purge_' + kind + '_v1($1,$2,$3::jsonb) as r', [expected || f.tenant, id, JSON.stringify(f.ops)]);
            return result.rows ? result.rows[0].r : result;
        };
        const seed = async f => {
            const rows = [[T, f.name, f.source], ...f.receipts.map(receipt => [R, receipt.registryKey, true])];
            await c.query("insert into public.zoe_docs(tenant_id,root,key,value,seq) select $1,e->>0,e->>1,e->2,1 from jsonb_array_elements($2::jsonb) e", [f.tenant, JSON.stringify(rows)]);
        };
        const snapshot = async (tenant, connection = c) => (await connection.query(`select jsonb_build_object('state',(select to_jsonb(s) from public.zoe_tenant_state s where tenant_id=$1),
            'docs',(select coalesce(jsonb_agg(to_jsonb(d) order by root,key),'[]') from public.zoe_docs d where tenant_id=$1),
            'ops',(select coalesce(jsonb_agg(to_jsonb(o) order by op_id),'[]') from public.zoe_ops o where tenant_id=$1)) as s`, [tenant])).rows[0].s;
        const sourceValue = async f => (await c.query('select value from public.zoe_docs where tenant_id=$1 and root=$2 and key=$3', [f.tenant, T, f.name])).rows[0]?.value;
        for (const count of [1, 2, 249, 250, 251]) {
            const f = fixture(A, uid, 'matched_' + count, count); await seed(f);
            const beforeHead = Number((await c.query('select seq from public.zoe_tenant_state where tenant_id=$1', [A])).rows[0].seq);
            const id = opId(), result = await call('execute', f, id);
            ok('N=' + count + ' ៖ full packet execute applied + exact binding', result.ok === true && result.purge?.outcome === 'applied'
                && result.purge.proof === 'operation' && result.purge.hash === expectedHash(f.ops) && result.purge.tenant === A
                && result.purge.actorUid === uid && result.purge.opId === id && result.purge.rowCount === count, result);
            const actualRows = (await c.query('select root,key,value,seq from public.zoe_docs where tenant_id=$1', [A])).rows;
            const persisted = (await c.query('select result from public.zoe_ops where tenant_id=$1 and op_id=$2', [A, id])).rows[0]?.result;
            const accounting = (await c.query(`select s.seq::text,s.bytes::text,
                (coalesce((select sum(private.zoe_doc_bytes(d.root,d.key,d.value)) from public.zoe_docs d where d.tenant_id=s.tenant_id),0)
                +coalesce((select sum(private.zoe_op_bytes(o.op_id,o.result)) from public.zoe_ops o where o.tenant_id=s.tenant_id),0))::text as real
                from public.zoe_tenant_state s where s.tenant_id=$1`, [A])).rows[0];
            ok('N=' + count + ' ៖ ALL source/registry/release/consumption values + one seq + typed receipt/quota exact', result.ok === true
                && f.ops.every(op => { const row = actualRows.find(row => row.root === op.p[0] && row.key === op.p[1]);
                    return row && isDeepStrictEqual(row.value, op.v) && Number(row.seq) === result.seq; })
                && result.seq === beforeHead + 1 && persisted?.ok === true && isDeepStrictEqual(persisted.purge, result.purge)
                && persisted.docs?.length === f.ops.length && Number(accounting.seq) === result.seq && accounting.bytes === accounting.real,
                { result, accounting });
            const replayBefore = await snapshot(A), replay = await call('execute', f, id);
            ok('N=' + count + ' ៖ same intent replay one commit · empty docs', replay.ok === true && replay.purge?.hash === expectedHash(f.ops)
                && replay.purge.outcome === 'applied' && replay.replayed === true && replay.docs?.length === 0
                && JSON.stringify(await snapshot(A)) === JSON.stringify(replayBefore), replay);
        }
        for (const vector of BINDING_VECTORS) {
            let result;
            try { result = (await c.query('select private.zoe_purge_packet_v1($1::jsonb) as r', [vector.rawOpsJson || JSON.stringify(vector.ops)])).rows[0].r; }
            catch (error) { result = { error: { code: error.code, message: error.message } }; }
            ok('shared immutable binding vector ' + vector.name + ' SQL hash exact', result.hash === vector.hash, result);
        }
        const unicodeCodes = [' straße😀/é ', 'iıİß.%$[]/', 'ﬃ', 'ὀδυσσεύς', 'A' + String.fromCharCode(34,9) + 'B' + String.fromCharCode(10) + 'C' + String.fromCharCode(92) + 'D', ...[0xfeff,0x85,0x180e,0x200b].map(point => String.fromCodePoint(point) + 'a' + String.fromCodePoint(point)), 'A/B', 'A%2FB'];
        for (let i = 0; i < unicodeCodes.length; i++) {
            const f = fixture(A, uid, 'unicode_' + i, 1), code = unicodeCodes[i], key = canonicalKey(code);
            f.source.barcodes['0'].code = code; f.receipts[0].code = code; f.receipts[0].registryKey = key; f.ops[2].p[1] = key;
            await seed(f); const id = opId(), result = await call('execute', f, id);
            const actual = (await c.query('select private.zoe_purge_registry_key_v1($1) as key', [code])).rows[0].key;
            ok('Unicode complete packet ' + i + ' exact existing key/hash + source null', actual === key && result.ok === true
                && result.purge?.hash === expectedHash(f.ops) && await sourceValue(f) === null, { key, actual, result });
        }
        for (const pair of [['ß','SS'], [' A ','a'], ['ﬃ','FFI']]) {
            const f = fixture(A, uid, 'case_collision_' + serial++, 2); await seed(f);
            for (let i = 0; i < 2; i++) { f.ops[3 + 2 * i].v.code = pair[i]; f.ops[3 + 2 * i].v.registryKey = canonicalKey(pair[i]); f.ops[2 + 2 * i].p[1] = canonicalKey(pair[i]); }
            const before = await snapshot(A), result = await call('execute', f, opId());
            ok('canonical duplicate-key collision rejected with zero effects ' + JSON.stringify(pair), !!result.error
                && isDeepStrictEqual(await snapshot(A), before), result);
        }
        for (const bad of [0,0xd800,0xdc00].map(point => String.fromCharCode(point))) {
            const f = fixture(A, uid, 'invalid_scalar_' + serial++, 1); await seed(f);
            f.ops[3].v.code = 'A' + bad; f.ops[3].v.registryKey = canonicalKey(f.ops[3].v.code); f.ops[2].p[1] = f.ops[3].v.registryKey;
            const before = await snapshot(A), result = await call('execute', f, opId());
            ok('NUL/lone surrogate cannot reach effects ' + JSON.stringify(bad), !!result.error && isDeepStrictEqual(await snapshot(A), before), result);
        }
        for (const shape of ['sparse-object', 'array-null-holes']) {
            const f = fixture(A, uid, 'slots_' + shape.replace(/-/g, '_'), 2);
            if (shape === 'sparse-object') {
                f.source.barcodes = { '2': f.source.barcodes['0'], '8': f.source.barcodes['1'], '5': null };
                f.receipts[0].slot = '2'; f.receipts[1].slot = '8';
            } else { f.source.barcodes = [f.source.barcodes['0'], null, f.source.barcodes['1']]; f.receipts[1].slot = '2'; }
            await seed(f); const result = await call('execute', f, opId());
            ok('complete source ' + shape + ' preserves supported numeric slots/null holes', result.ok === true
                && result.purge?.hash === expectedHash(f.ops) && await sourceValue(f) === null, result);
        }
        const nullRegistry = fixture(A, uid, 'already_null_registry', 1); await seed(nullRegistry);
        await c.query('update public.zoe_docs set value=null where tenant_id=$1 and root=$2 and key=$3', [A, R, nullRegistry.receipts[0].registryKey]);
        const nullResult = await call('execute', nullRegistry, opId());
        ok('valid legacy already-null registry retains existing per-doc s0 semantics', nullResult.ok === true
            && nullResult.docs?.some(doc => doc.r === R && doc.k === nullRegistry.receipts[0].registryKey && doc.v === null && doc.s === 0), nullResult);
        const generic = fixture(A, uid, 'generic_limit', 250); await seed(generic);
        const genericBefore = await snapshot(A);
        const capped = await H.as(c, who, 'select public.zoe_write_v2($1,$2,$3::jsonb) as r', [A, opId(), JSON.stringify(generic.ops)]);
        ok('generic >500 នៅតែបដិសេធ និងមិនមាន effects', capped.error?.code === '22023' && JSON.stringify(await snapshot(A)) === JSON.stringify(genericBefore), capped);
        const small = fixture(A, uid, 'generic_healthy', 1); await seed(small);
        const old = await H.as(c, who, 'select public.zoe_write_v2($1,$2,$3::jsonb) as r', [A, opId(), JSON.stringify(small.ops)]);
        ok('generic <=500 neighboring valid purge នៅតែជោគជ័យ', old.rows?.[0]?.r?.ok === true, old);
        const collision = fixture(A, uid, 'collision', 2); await seed(collision);
        const collisionId = opId();
        await c.query("insert into public.zoe_ops(tenant_id,op_id,result) values($1,$2,'{\"ok\":true,\"seq\":1,\"docs\":[]}'::jsonb)", [A, collisionId]);
        const collisionBefore = await snapshot(A), collisionResult = await call('execute', collision, collisionId);
        ok('untyped same opID cannot be successful purge or mutate effects', collisionResult.error?.code === 'PT409'
            && JSON.stringify(await snapshot(A)) === JSON.stringify(collisionBefore), collisionResult);
        const conflict = fixture(A, uid, 'hash_conflict', 2); await seed(conflict);
        const conflictId = opId(), applied = await call('execute', conflict, conflictId);
        const changed = copy(conflict); changed.ops.filter(op => op.p[0] === L).forEach(op => { op.v.scope += '/changed'; }); changed.ops.find(op => op.p[0] === G).v.scope += '/changed';
        const changedBefore = await snapshot(A), changedResult = await call('execute', changed, conflictId);
        ok('same opID changed intent hash rejected before generic receipt replay', applied.ok === true && changedResult.error?.code === 'PT409'
            && JSON.stringify(await snapshot(A)) === JSON.stringify(changedBefore), changedResult);
        const badActor = fixture(A, otherUid, 'wrong_actor', 1); await seed(badActor);
        const actorBefore = await snapshot(A), actorResult = await call('execute', badActor, opId());
        ok('authenticated actor derived · foreign releasedBy rejected atomically', actorResult.error?.code === '42501'
            && JSON.stringify(await snapshot(A)) === JSON.stringify(actorBefore), actorResult);
        const wrongTenant = fixture(A, uid, 'wrong_tenant', 1); await seed(wrongTenant);
        const tenantBefore = await snapshot(A), tenantResult = await call('execute', wrongTenant, opId(), who, B);
        ok('expected original tenant mismatch cannot redirect operation', tenantResult.error?.code === 'PT409'
            && JSON.stringify(await snapshot(A)) === JSON.stringify(tenantBefore), tenantResult);
        const malformed = [
            ['missing registry', f => f.ops.splice(2, 1)],
            ['missing release', f => f.ops.splice(3, 1)],
            ['duplicate effect', f => f.ops.push(copy(f.ops[0]))],
            ['extra effect', f => f.ops.push({ k: 'set', p: ['zoew_daily_revenue_cod_dod','2026-10-01'], v: null })],
            ['wrong consumption', f => { f.ops[1].v.generation++; }],
            ['receipt extra field', f => { f.ops[3].v.extra = true; }],
            ['receipt wrong type', f => { f.ops[3].v.birth = String(f.ops[3].v.birth); }],
            ['receipt non-v2', f => { f.ops[3].v.v = 1; delete f.ops[3].v.generation; }],
            ['receipt null kind', f => { f.ops[3].v.kind = null; }]
        ];
        for (const [label, mutate] of malformed) {
            const f = fixture(A, uid, 'invalid_' + serial++, 2); await seed(f); mutate(f);
            const before = await snapshot(A), result = await call('execute', f, opId());
            ok('strict packet ' + label + ' denied without any writes', !!result.error && JSON.stringify(await snapshot(A)) === JSON.stringify(before), result);
        }
        const wrongKey = fixture(A, uid, 'wrong_key', 1); await seed(wrongKey);
        wrongKey.ops[2].p[1] = 'UNRELATED_KEY'; wrongKey.ops[3].v.registryKey = 'UNRELATED_KEY';
        const keyBefore = await snapshot(A), keyResult = await call('execute', wrongKey, opId());
        ok('server source/member authority rejects wrong registry key pair', !!keyResult.error && JSON.stringify(await snapshot(A)) === JSON.stringify(keyBefore), keyResult);
        for (const [label, mutate] of [
            ['stale source', value => { value.deletedAt++; }],
            ['Restore claim', value => { value.restoreClaim = 'restore_active'; }],
            ['same-count changed source member', value => { value.barcodes['0'].code = 'NEW_MEMBER'; }]
        ]) {
            const f = fixture(A, uid, 'race_' + serial++, 2); await seed(f);
            const changedSource = copy(f.source); mutate(changedSource);
            await c.query('update public.zoe_docs set value=$1 where tenant_id=$2 and root=$3 and key=$4', [changedSource, A, T, f.name]);
            const before = await snapshot(A), result = await call('execute', f, opId());
            ok(label + ' after captured packet rejected with no partial changes', !!result.error
                && JSON.stringify(await snapshot(A)) === JSON.stringify(before), result);
        }
        const holder = fixture(A, uid, 'new_holder', 2); await seed(holder);
        await c.query('update public.zoe_docs set value=$1 where tenant_id=$2 and root=$3 and key=$4', [validHolder('new_holder', otherUid), A, R, holder.receipts[0].registryKey]);
        const holderBefore = await snapshot(A), holderResult = await call('execute', holder, opId());
        ok('new registry holder retained · all other effects rolled back', !!holderResult.error
            && JSON.stringify(await snapshot(A)) === JSON.stringify(holderBefore), holderResult);
        const quota = fixture(A, uid, 'quota_rollback', 2); await seed(quota);
        await c.query('update public.zoe_tenant_state set quota_bytes=1 where tenant_id=$1', [A]);
        const quotaBefore = await snapshot(A), quotaResult = await call('execute', quota, opId());
        ok('quota failure rolls back effects, typed receipt, seq and accounting', quotaResult.error?.message === 'quota_exceeded'
            && JSON.stringify(await snapshot(A)) === JSON.stringify(quotaBefore), quotaResult);
        await c.query('update public.zoe_tenant_state set quota_bytes=1073741824 where tenant_id=$1', [A]);
        const gc = fixture(A, uid, 'gc_three_days', 2); await seed(gc);
        const gcId = opId(), gcApplied = await call('execute', gc, gcId);
        await c.query("update public.zoe_ops set created_at=now()-interval '3 days' where tenant_id=$1 and op_id=$2", [A, gcId]);
        await c.query('select private.zoe_housekeeping($1)', [A]);
        const reused = copy(gc.source); reused.trashGeneration = 2; reused.deletedAt += 10; reused.barcodes['0'].code = 'NEW_GENERATION';
        await c.query('update public.zoe_docs set value=$1 where tenant_id=$2 and root=$3 and key=$4', [reused, A, T, gc.name]);
        await c.query('update public.zoe_docs set value=$1 where tenant_id=$2 and root=$3 and key=$4', [validHolder('gc_new_holder', otherUid), A, R, gc.receipts[0].registryKey]);
        await c.query('update public.zoe_docs set value=jsonb_set(value,\'{generation}\',\'2\') where tenant_id=$1 and root=$2 and key=$3', [A, G, gc.name]);
        const gcBefore = await snapshot(A), gcStatus = await call('status', gc, gcId);
        ok('3-day post-opGC full original release proof APPLIED · docs empty', gcApplied.ok === true && gcStatus.ok === true
            && gcStatus.purge?.outcome === 'applied' && gcStatus.purge.proof === 'release-set' && gcStatus.purge.hash === expectedHash(gc.ops)
            && gcStatus.docs?.length === 0, gcStatus);
        ok('read-only release proof leaves reused source/new consumption/new holder untouched', JSON.stringify(await snapshot(A)) === JSON.stringify(gcBefore));
        const gcExecute = await call('execute', gc, gcId);
        ok('post-GC original execute cannot delete reused generation/new holder', !!gcExecute.error
            && isDeepStrictEqual(await snapshot(A), gcBefore), gcExecute);
        await c.query('update public.zoe_docs set value=null where tenant_id=$1 and root=$2 and key=$3', [A, L, gc.receipts[0].id]);
        const missingBefore = await snapshot(A), missing = await call('status', gc, gcId);
        ok('missing one original release afterGC => UNKNOWN with no replay', missing.ok === true && missing.purge?.outcome === 'unknown'
            && missing.purge.proof === 'none' && missing.docs?.length === 0 && JSON.stringify(await snapshot(A)) === JSON.stringify(missingBefore), missing);
        const forgedReceipt = copy(gc.receipts[0]); forgedReceipt.rowCount = String(forgedReceipt.rowCount);
        await c.query('update public.zoe_docs set value=$1 where tenant_id=$2 and root=$3 and key=$4', [forgedReceipt, A, L, gc.receipts[0].id]);
        const typeStatus = await call('status', gc, gcId);
        ok('changed actual release field type cannot satisfy full old proof', typeStatus.purge?.outcome === 'unknown', typeStatus);
        for (const receipt of gc.receipts) await c.query('update public.zoe_docs set value=null where tenant_id=$1 and root=$2 and key=$3', [A, L, receipt.id]);
        const noneBefore = await snapshot(A), none = await call('status', gc, gcId);
        ok('all original releases absent after GC stays UNKNOWN without fresh delete', none.purge?.outcome === 'unknown'
            && none.purge.proof === 'none' && isDeepStrictEqual(await snapshot(A), noneBefore), none);
        const incomplete = fixture(A, uid, 'privileged_source_count_mirror', 2); await seed(incomplete);
        const incompleteSource = copy(incomplete.source);
        incompleteSource.barcodes['2'] = { code: 'EXTRA_ACTUAL_SOURCE_MEMBER', cod: 1, dod: 0, isClosed: false, createdAt: 1700000000002 };
        await c.query('update public.zoe_docs set value=$1 where tenant_id=$2 and root=$3 and key=$4', [incompleteSource, A, T, incomplete.name]);
        await c.query('insert into public.zoe_docs(tenant_id,root,key,value,seq) values($1,$2,$3,$4,1)', [A, R, 'EXTRA_ACTUAL_SOURCE_MEMBER', true]);
        const incompleteBefore = await snapshot(A), incompleteResult = await call('execute', incomplete, opId());
        const extraRegistry = (await c.query('select value from public.zoe_docs where tenant_id=$1 and root=$2 and key=$3', [A, R, 'EXTRA_ACTUAL_SOURCE_MEMBER'])).rows[0].value;
        ok('full locked source membership cannot trust privileged source.count mirror', !!incompleteResult.error
            && isDeepStrictEqual(await snapshot(A), incompleteBefore), { sourceAfter: await sourceValue(incomplete), extraRegistry, result: incompleteResult });
        const waitForLock = async (connection, pid) => {
            for (let i = 0; i < 100; i++) {
                await connection.query('select pg_stat_clear_snapshot()');
                const row = (await connection.query('select wait_event_type from pg_stat_activity where pid=$1', [pid])).rows[0];
                if (row?.wait_event_type === 'Lock') return true;
                await new Promise(resolve => setTimeout(resolve, 10));
            }
            return false;
        };
        for (const kind of ['source', 'restore', 'holder']) {
            const f = fixture(A, uid, 'locked_' + kind, 2); await seed(f);
            const controller = await H.connect('postgres', name);
            const pid = (await c.query('select pg_backend_pid() as pid')).rows[0].pid;
            const id = opId(); let pending;
            try {
                await controller.query('begin');
                await controller.query('select seq from public.zoe_tenant_state where tenant_id=$1 for update', [A]);
                pending = call('execute', f, id);
                const blocked = await waitForLock(controller, pid);
                ok('concurrent ' + kind + ' ៖ execute waits for actual tenant-state lock', blocked);
                if (kind === 'holder') {
                    await controller.query('update public.zoe_docs set value=$1 where tenant_id=$2 and root=$3 and key=$4',
                        [validHolder('locked_new_holder', otherUid), A, R, f.receipts[0].registryKey]);
                } else {
                    const value = copy(f.source);
                    if (kind === 'source') value.deletedAt++;
                    else value.restoreClaim = { token: 'restore_fixture_token', claimedAt: 1790000000010, targetId: 'restore_target' };
                    await controller.query('update public.zoe_docs set value=$1 where tenant_id=$2 and root=$3 and key=$4', [value, A, T, f.name]);
                }
                const interleaved = await snapshot(A, controller);
                await controller.query('commit');
                const result = await pending;
                ok('concurrent ' + kind + ' ៖ committed intervening state retained; purge has zero effects', blocked && !!result.error
                    && isDeepStrictEqual(await snapshot(A), interleaved), result);
            } finally {
                try { await controller.query('rollback'); } catch (e) {}
                if (pending) await pending;
                await controller.end();
            }
        }
        const moved = fixture(A, uid, 'member_move_first', 2); await seed(moved);
        const mover = await H.connect('postgres', name);
        const movingPid = (await c.query('select pg_backend_pid() as pid')).rows[0].pid;
        let moving;
        try {
            await mover.query('begin');
            await mover.query('update public.tenant_members set tenant_id=$1 where user_id=$2', [B, uid]);
            const before = await snapshot(A, mover), beforeB = await snapshot(B, mover);
            moving = call('execute', moved, opId());
            const blocked = await waitForLock(mover, movingPid);
            ok('privileged member move holds original execute at membership FOR SHARE', blocked);
            await mover.query('commit');
            const result = await moving;
            ok('committed A→B move rejects old A intent with no effects in either tenant', blocked && result.error?.code === 'PT409'
                && isDeepStrictEqual(await snapshot(A), before) && isDeepStrictEqual(await snapshot(B), beforeB), result);
        } finally {
            try { await mover.query('rollback'); } catch (e) {}
            if (moving) await moving;
            await mover.end();
            await c.query('update public.tenant_members set tenant_id=$1 where user_id=$2', [A, uid]);
        }
        const serialF = fixture(A, uid, 'execute_before_member_status', 2); await seed(serialF);
        const committing = await H.connect('postgres', name), laterMove = await H.connect('postgres', name);
        let waitingStatus, memberUpdate;
        try {
            await committing.query('begin');
            await committing.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ role: 'authenticated', sub: uid })]);
            await committing.query('set local role authenticated');
            const id = opId();
            const applied = (await committing.query('select public.zoe_purge_execute_v1($1,$2,$3::jsonb) as r', [A, id, JSON.stringify(serialF.ops)])).rows[0].r;
            await committing.query('reset role');
            const statusPid = (await c.query('select pg_backend_pid() as pid')).rows[0].pid;
            waitingStatus = call('status', serialF, id);
            const statusBlocked = await waitForLock(committing, statusPid);
            const movePid = (await laterMove.query('select pg_backend_pid() as pid')).rows[0].pid;
            memberUpdate = laterMove.query('update public.tenant_members set tenant_id=$1 where user_id=$2', [B, uid]);
            const moveBlocked = await waitForLock(committing, movePid);
            ok('uncommitted execute holds state and membership; status+privileged move really block', applied.ok === true && statusBlocked && moveBlocked);
            await committing.query('commit');
            const status = await waitingStatus; await memberUpdate;
            ok('late status sees committed original operation and never projects old docs', status.purge?.outcome === 'applied'
                && status.purge.proof === 'operation' && status.purge.hash === expectedHash(serialF.ops) && status.docs?.length === 0, status);
            const before = await snapshot(A), deniedStatus = await call('status', serialF, id);
            ok('after later member move old status fails tenant fence without effects', deniedStatus.error?.code === 'PT409'
                && isDeepStrictEqual(await snapshot(A), before), deniedStatus);
        } finally {
            try { await committing.query('rollback'); } catch (e) {}
            if (waitingStatus) await waitingStatus;
            if (memberUpdate) await memberUpdate;
            await committing.end(); await laterMove.end();
            await c.query('update public.tenant_members set tenant_id=$1 where user_id=$2', [A, uid]);
        }
        const mixedFixture = name => {
            const f = fixture(A, uid, name, 2), receipt = f.receipts[0];
            const id = 'scan_' + hash(name).slice(0, 32);
            receipt.kind = 'scan'; receipt.id = id; receipt.actorUid = otherUid;
            f.source.barcodes['0'].scanIntent = id; f.ops[3].p[1] = id;
            const operation = { v: 2, id, actorUid: otherUid, scope: receipt.scope, code: receipt.code, registryKey: receipt.registryKey,
                birth: receipt.birth, scanDate: '2026-10-01', month: '2026-10', cod: 1, dod: 0, count: 1,
                monthToken: 'op_m' + id.slice(5), phase: 'committed', targetId: name, payloadHash: hash('completed:' + name),
                phone: '012345678', locker: 'N/A', closedAt: 0 };
            return { f, operation };
        };
        for (const fault of ['valid', 'wrong-operation-code', 'wrong-original-actor']) {
            const { f, operation } = mixedFixture('mixed_' + fault.replace(/-/g, '_')); await seed(f);
            await c.query('update public.zoe_docs set value=$1 where tenant_id=$2 and root=$3 and key=$4',
                [{ v: 2, intent: operation.id, actorUid: otherUid, birth: operation.birth }, A, R, operation.registryKey]);
            if (fault === 'wrong-operation-code') operation.code = 'DIFFERENT_OPERATION_CODE';
            await c.query("insert into public.zoe_docs(tenant_id,root,key,value,seq) values($1,'zoew_scan_operations',$2,$3,1)", [A, operation.id, operation]);
            if (fault === 'wrong-original-actor') f.receipts[0].actorUid = uid;
            const before = await snapshot(A), result = await call('execute', f, opId());
            ok('known completed scan+legacy purge fixture ' + fault, fault === 'valid'
                ? result.ok === true && result.purge?.hash === expectedHash(f.ops) && await sourceValue(f) === null
                : !!result.error && isDeepStrictEqual(await snapshot(A), before), result);
        }
        const typedStatus = fixture(A, uid, 'typed_status_conflict', 1); await seed(typedStatus);
        const typedId = opId(), typedApplied = await call('execute', typedStatus, typedId);
        await c.query("update public.zoe_ops set result=jsonb_set(result,'{purge,hash}',to_jsonb(repeat('0',64))) where tenant_id=$1 and op_id=$2", [A, typedId]);
        const typedBefore = await snapshot(A), typedResult = await call('status', typedStatus, typedId);
        ok('mismatched typed operation proof cannot fall through to successful release-set', typedApplied.ok === true
            && typedResult.error?.code === 'PT409' && isDeepStrictEqual(await snapshot(A), typedBefore), typedResult);
        const newDoc = fixture(A, uid, 'new_doc_over_1MiB', 1).source; newDoc.phone = 'x'.repeat(1048576);
        const newDocBefore = await snapshot(A);
        const newDocResult = await H.as(c, who, 'select public.zoe_write_v2($1,$2,$3::jsonb) as r',
            [A, opId(), JSON.stringify([{ k: 'set', p: [T, newDoc.id], v: newDoc }])]);
        ok('inherited NEWdocument >1MiB guard remains before rules and rolls back', newDocResult.error?.message === 'invalid_data'
            && newDocResult.error.detail === 'size' && isDeepStrictEqual(await snapshot(A), newDocBefore), newDocResult);
        const preContext = fixture(A, uid, 'privileged_pre_context_over_8MiB', 1); await seed(preContext);
        preContext.source.phone = 'x'.repeat(8388608);
        await c.query('update public.zoe_docs set value=$1 where tenant_id=$2 and root=$3 and key=$4', [preContext.source, A, T, preContext.name]);
        const preBefore = await snapshot(A), preResult = await call('execute', preContext, opId());
        ok('privileged oversized old source hits inherited8MiB pre-context guard with zero effects', preResult.error?.message === 'invalid_data'
            && preResult.error.detail === 'size' && isDeepStrictEqual(await snapshot(A), preBefore), preResult);
        const expandedBytes = value => {
            if (Array.isArray(value)) return 2 + Math.max(0, value.length - 1) * 2 + value.reduce((sum, child) => sum + expandedBytes(child), 0);
            if (value && typeof value === 'object') { const keys = Object.keys(value); return 2 + Math.max(0, keys.length - 1) * 2
                + keys.reduce((sum, key) => sum + Buffer.byteLength(JSON.stringify(key), 'utf8') + 2 + expandedBytes(value[key]), 0); }
            return Buffer.byteLength(JSON.stringify(value), 'utf8');
        };
        const boundary = fixture(A, uid, 'exact_packet_boundary', 1800), targetBytes = 4194304;
        const scopes = [boundary.ops[1].v, ...boundary.receipts];
        scopes.forEach(row => { row.scope = 's'; });
        const scopeLength = 1 + Math.floor((targetBytes - expandedBytes(boundary.ops)) / scopes.length);
        if (scopeLength < 1 || scopeLength > 2048) throw new Error('boundary construction out of scope range');
        scopes.forEach(row => { row.scope = 's'.repeat(scopeLength); });
        let remaining = targetBytes - expandedBytes(boundary.ops);
        for (let i = 0; i < boundary.receipts.length && remaining >= 3; i++) {
            const row = boundary.receipts[i], extra = Math.min(256 - row.code.length, Math.floor(remaining / 3));
            row.code += 'X'.repeat(extra); row.registryKey = row.code; boundary.ops[2 + 2 * i].p[1] = row.code; remaining -= 3 * extra;
        }
        if (remaining) boundary.receipts.at(-1).slot = '9'.repeat(boundary.receipts.at(-1).slot.length + remaining);
        const atText = JSON.stringify(boundary.ops);
        const at = (await c.query('select octet_length($1::jsonb::text) as bytes,private.zoe_purge_packet_v1($1::jsonb)->>\'hash\' as hash', [atText])).rows[0];
        ok('exact4MiB SQL-expanded valid packet reaches codec gate without invented N ceiling', expandedBytes(boundary.ops) === targetBytes
            && at.bytes === targetBytes && at.hash === expectedHash(boundary.ops), at);
        const boundaryBefore = await snapshot(A), boundaryStatus = await call('status', boundary, opId());
        ok('at4MiB status is read-only UNKNOWN without source/proof; no execution benchmark claim', boundaryStatus.ok === true
            && boundaryStatus.purge?.outcome === 'unknown' && boundaryStatus.docs?.length === 0 && isDeepStrictEqual(await snapshot(A), boundaryBefore), boundaryStatus);
        const over = copy(boundary); over.receipts = over.ops.filter(op => op.p[0] === L).map(op => op.v);
        over.receipts.at(-1).slot += '9';
        const overBytes = (await c.query('select octet_length($1::jsonb::text) as bytes', [JSON.stringify(over.ops)])).rows[0].bytes;
        const overResult = await call('status', over, opId());
        ok('exact4MiB+1 SQL-expanded packet rejected with zero persistence', overBytes === targetBytes + 1 && overResult.error?.code === '22023'
            && isDeepStrictEqual(await snapshot(A), boundaryBefore), { overBytes, result: overResult });
        const oversized = fixture(A, uid, 'oversized', 1800);
        oversized.ops.filter(op => op.p[0] === L).forEach(op => { op.v.scope = 'x'.repeat(2048); }); oversized.ops[1].v.scope = 'x'.repeat(2048);
        const sizeBefore = await snapshot(A), sizeResult = await call('execute', oversized, opId());
        ok('actual SQL expanded packet >4MiB rejected without persistence', Buffer.byteLength(JSON.stringify(oversized.ops), 'utf8') > 4194304
            && sizeResult.error?.code === '22023' && JSON.stringify(await snapshot(A)) === JSON.stringify(sizeBefore), sizeResult);
        const anon = await H.as(c, { role: 'anon' }, 'select public.zoe_purge_status_v1($1,$2,$3::jsonb)', [A, opId(), JSON.stringify(gc.ops)]);
        ok('anonymous cannot execute status', H.denied(anon), anon);
        const service = await H.as(c, { role: 'service_role' }, 'select public.zoe_purge_execute_v1($1,$2,$3::jsonb)', [A, opId(), JSON.stringify(gc.ops)]);
        ok('service_role has no new public privileged purge grant', H.denied(service), service);
        const helper = await H.as(c, who, 'select private.zoe_apply_engine_v1($1,$2,$3::jsonb,true,false,\'{}\'::jsonb)', [A, opId(), JSON.stringify(gc.ops)]);
        ok('authenticated cannot call trusted private apply engine', H.denied(helper), helper);
        const noTables = (await c.query("select count(*)::int as n from pg_tables where schemaname in ('public','private') and tablename like '%purge%' ")).rows[0].n;
        ok('no new purge persistence table', noTables === 0, noTables);
    } finally { await c.end(); await H.stop(); }
}
function report(infrastructureFailures) {
    const migration = '20261101123154_zoe_atomic_registry_purge.sql';
    const file = path.join(ROOT, 'supabase/migrations', migration);
    const summary = { pass, fail, skipped: 0, infrastructureFailures, cases, migration,
        sourceHash: fs.existsSync(file) ? hash(fs.readFileSync(file)) : null,
        driverHash: hash(fs.readFileSync(__filename)) };
    console.log('\n' + pass + ' PASS · ' + fail + ' FAIL · infrastructure ' + infrastructureFailures);
    if (process.env.SUPABASE_PURGE_RESULT) fs.writeFileSync(path.resolve(process.env.SUPABASE_PURGE_RESULT), JSON.stringify(summary, null, 2) + '\n');
    console.log(JSON.stringify(summary));
}
main().then(() => { report(0); process.exitCode = fail ? 1 : 0; })
    .catch(async error => { console.error(error.stack || error); try { await H.stop(); } catch (e) {} report(1); process.exitCode = 1; });
