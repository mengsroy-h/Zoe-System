import { afterAll, beforeAll, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const ROOT = path.resolve(__dirname, '../../../..');
const require = createRequire(import.meta.url);
const { createPgHarness } = require(ROOT + '/tools/audit-tools/supabase-pg.js');
const PG = createPgHarness({ depsDirs: [ROOT + '/supabase/node_modules'], shimDir: ROOT + '/tools/audit-tools/supabase-shim', wantMajor: 17 });
const HIST = 'zoew_scan_history_cod_dod', TRASH = 'zoew_recently_deleted_cod_dod', DAILY = 'zoew_daily_revenue_cod_dod';
const FINAL = 'zoew_restore_finalizations', CONSUMED = 'zoew_trash_consumptions';
const AT = 1790000000000, DATE = '2026-09-21';
let c: any, who: any, tenant: string, op = 0;

beforeAll(async () => {
    if (PG.unavailableReason()) throw new Error(PG.unavailableReason());
    await PG.start();
    c = (await PG.freshDb('no-default-grants')).c;
    for (const file of fs.readdirSync(ROOT + '/supabase/migrations').filter(n => n.endsWith('.sql')).sort()) {
        await c.query(fs.readFileSync(ROOT + '/supabase/migrations/' + file, 'utf8'));
    }
    tenant = (await c.query("insert into public.tenants(name,branch_code,expires_at) values('palm-policy','000001',now()+interval '1 day') returning id")).rows[0].id;
    const uid = await PG.makeAuthUser(c, 'palm-policy@users.zoew.invalid');
    await c.query("insert into public.tenant_members(user_id,tenant_id,username) values($1,$2,'palm_policy')", [uid, tenant]);
    const sid = (await c.query('insert into auth.sessions(id,user_id,created_at) values(gen_random_uuid(),$1,now()) returning id', [uid])).rows[0].id;
    who = { role: 'authenticated', sub: uid, extra: { session_id: sid } };
}, 30000);

afterAll(async () => { if (c) await c.end(); PG.stop(); });

const row = (id: string, reason = 'remove', extra: any = {}) => ({
    id, phone: '012000000', createdAt: AT, deletedAt: AT + 1000, scanDate: DATE,
    cod: 3, dod: 1, price: 4, count: 1, isClosed: false, trashReason: reason,
    isFromDeletion: reason === 'delete' || reason === 'pickup', trashMode: 'palm',
    barcodes: [{ code: 'PALM_POLICY_' + id, cod: 3, dod: 1, createdAt: AT, isClosed: false, isDeducted: reason !== 'delete' && reason !== 'pickup' }],
    ...extra
});
const changes = (updates: any) => Object.entries(updates).map(([p, v]) => ({ k: 'set', p: p.split('/'), v }));
const write = async (updates: any, opId = 'palm_policy_' + String(++op).padStart(12, '0')) => PG.as(c, who,
    'select public.zoe_write_v2($1,$2,$3::jsonb) as r', [tenant, opId, JSON.stringify(changes(updates))]);
const seed = async (updates: any) => {
    const result = await PG.as(c, { role: 'service_role' }, 'select public.zoe_admin_write($1,$2,$3::jsonb) as r',
        [tenant, 'palm_seed_' + String(++op).padStart(12, '0'), JSON.stringify(changes(updates))]);
    expect(result.error).toBeUndefined();
};
const stored = async (root: string, id: string) => (await c.query('select value from public.zoe_docs where tenant_id=$1 and root=$2 and key=$3', [tenant, root, id])).rows[0]?.value ?? null;
const claimFor = (id: string) => ({ token: 'token_' + id, targetId: 'target_' + id, claimedAt: AT + 2000 });
const preparedFor = (source: any, claim: any) => ({ id: claim.targetId, phone: source.phone, createdAt: AT, scanDate: DATE,
    cod: 3, dod: 1, price: 4, count: 1, isClosed: false,
    barcodes: [{ ...source.barcodes[0], isDeducted: false }], restoreClaimId: source.id, restoreClaimToken: claim.token });
const finalPacket = (source: any, claim: any) => {
    const prepared = preparedFor(source, claim);
    const live: any = { ...prepared };
    delete live.restoreClaimId;
    delete live.restoreClaimToken;
    return { [TRASH + '/' + source.id]: null, [HIST + '/' + claim.targetId]: live,
        [FINAL + '/' + source.id]: { token: claim.token, targetId: claim.targetId, finalizedAt: AT + 3000 },
        [CONSUMED + '/' + source.id]: { v: 1, sourceId: source.id, generation: 0, kind: 'restore', actorUid: who.sub,
            scope: 'palm-policy-synthetic', deletedAt: source.deletedAt, rowBirth: source.createdAt, token: claim.token, targetId: claim.targetId },
        [DAILY + '/' + DATE]: { codDollar: 3, dodDollar: 1, totalCount: 1 } };
};

for (const reason of ['delete', 'remove', 'returned']) {
    it('Palm មិនទាន់ Sign ៖ ' + reason + ' ស្តារបានម្តង ដោយរក្សា barcode ប្រាក់ ចំនួន និង receipt', async () => {
        const source = row(reason, reason), claim = claimFor(reason);
        await seed({ [DAILY + '/' + DATE]: { codDollar: reason === 'delete' ? 3 : 0, dodDollar: reason === 'delete' ? 1 : 0, totalCount: reason === 'delete' ? 1 : 0 } });
        expect((await write({ [TRASH + '/' + source.id]: source })).error).toBeUndefined();
        expect((await write({ [TRASH + '/' + source.id + '/restoreClaim']: claim })).error).toBeUndefined();
        expect((await write({ [HIST + '/' + claim.targetId]: preparedFor(source, claim) })).error).toBeUndefined();
        const packet = finalPacket(source, claim), operation = 'palm_finalize_' + reason;
        expect((await write(packet, operation)).rows?.[0]?.r?.ok).toBe(true);
        expect((await write(packet, operation)).rows?.[0]?.r?.ok).toBe(true);
        expect((await write(packet)).error?.code).toBe('42501');
        expect(await stored(TRASH, source.id)).toBeNull();
        const live = await stored(HIST, claim.targetId);
        expect(Object.values(live.barcodes).map((b: any) => b.code)).toEqual([source.barcodes[0].code]);
        expect(live.restoreClaimId).toBeUndefined();
        expect(live.count).toBe(1);
        expect(await stored(DAILY, DATE)).toEqual({ codDollar: 3, dodDollar: 1, totalCount: 1 });
        expect(await stored(CONSUMED, source.id)).toMatchObject({ kind: 'restore', actorUid: who.sub, sourceId: source.id, token: claim.token });
    });
}

it('Palm pickup cleanup ត្រូវមាន block ហើយមិនអាចចាប់ផ្តើម restore', async () => {
    const source = row('pickup', 'pickup'), claim = claimFor(source.id);
    expect((await write({ [TRASH + '/' + source.id]: source })).error?.code).toBe('42501');
    await seed({ [TRASH + '/' + source.id]: source });
    expect((await write({ [TRASH + '/' + source.id + '/restoreClaim']: claim })).error?.code).toBe('42501');
    await seed({ [TRASH + '/' + source.id]: { ...source, restoreClaim: claim },
        [HIST + '/' + claim.targetId]: preparedFor(source, claim),
        [DAILY + '/' + DATE]: { codDollar: 0, dodDollar: 0, totalCount: 0 } });
    const packet = finalPacket(source, claim);
    expect((await write(packet)).error?.code).toBe('42501');
    expect((await write({ [CONSUMED + '/' + source.id]: packet[CONSUMED + '/' + source.id] })).error?.code).toBe('42501');
    expect((await stored(TRASH, source.id)).restoreClaim).toMatchObject(claim);
    expect((await stored(HIST, claim.targetId)).restoreClaimId).toBe(source.id);
    expect(await stored(DAILY, DATE)).toEqual({ codDollar: 0, dodDollar: 0, totalCount: 0 });
    expect(await stored(CONSUMED, source.id)).toBeNull();
    expect(await stored(FINAL, source.id)).toBeNull();
});

for (const mode of ['palm', 'cookie', 'local']) {
    it(mode + ' ៖ Sign និង permanent block មិនអាចត្រូវដោះ ឬ finalize ហើយប្រាក់នៅដដែល', async () => {
        const source = row('signed_' + mode, 'remove', { trashMode: mode, restoreBlocked: true }), claim = claimFor(source.id);
        source.barcodes[0] = { ...source.barcodes[0], ztoSignedAt: AT + 100 } as any;
        expect((await write({ [TRASH + '/' + source.id]: { ...source, restoreBlocked: false } })).error?.code).toBe('42501');
        expect((await write({ [TRASH + '/' + source.id]: source })).error).toBeUndefined();
        expect((await write({ [TRASH + '/' + source.id + '/restoreClaim']: claim })).error?.code).toBe('42501');
        expect((await write({ [TRASH + '/' + source.id + '/restoreBlocked']: null })).error?.code).toBe('42501');
        await seed({ [TRASH + '/' + source.id]: { ...source, restoreClaim: claim }, [HIST + '/' + claim.targetId]: preparedFor(source, claim),
            [DAILY + '/' + DATE]: { codDollar: 0, dodDollar: 0, totalCount: 0 } });
        expect((await write(finalPacket(source, claim))).error?.code).toBe('42501');
        expect((await stored(TRASH, source.id)).restoreBlocked).toBe(true);
        expect(await stored(DAILY, DATE)).toEqual({ codDollar: 0, dodDollar: 0, totalCount: 0 });
        expect(await stored(CONSUMED, source.id)).toBeNull();
    });
}

it('Palm ដែលបានបិទ restore ពីមុន មិនអាចបិទ flag ដើម្បីស្តារឡើងវិញ', async () => {
    const source = row('historical', 'delete', { restoreBlocked: true });
    expect((await write({ [TRASH + '/' + source.id]: source })).error).toBeUndefined();
    expect((await write({ [TRASH + '/' + source.id + '/restoreBlocked']: false })).error?.code).toBe('42501');
    expect((await write({ [TRASH + '/' + source.id + '/restoreClaim']: claimFor(source.id) })).error?.code).toBe('42501');
});
