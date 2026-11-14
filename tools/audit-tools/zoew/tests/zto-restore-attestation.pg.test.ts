import { afterAll, beforeAll, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const REPO = path.resolve(__dirname, '../../../..');
const SOURCE = path.resolve(process.env.ZTOATTEST_APP_DIR || REPO);
const { createPgHarness } = require(REPO + '/tools/audit-tools/supabase-pg.js');
const { legacyRestoreVector } = require(REPO + '/tools/audit-tools/zto-restore-attestation-cases.cjs');
const PG = createPgHarness({ depsDirs: [REPO + '/supabase/node_modules'],
    shimDir: SOURCE + '/tools/audit-tools/supabase-shim', wantMajor: 17 });
const TRASH = 'zoew_recently_deleted_cod_dod', HISTORY = 'zoew_scan_history_cod_dod';
const DAILY = 'zoew_daily_revenue_cod_dod', MONTHLY = 'zoew_monthly_revenue_cod_dod';
let c: any, tenant: string, who: any, sequence = 0;
const observations: any[] = [];
const operations = (updates: any) => Object.entries(updates).map(([key, value]) => ({ k: 'set', p: key.split('/'), v: value }));

beforeAll(async () => {
    if (PG.unavailableReason()) throw new Error(PG.unavailableReason());
    await PG.start();
    c = (await PG.freshDb('no-default-grants')).c;
    for (const file of fs.readdirSync(SOURCE + '/supabase/migrations').filter(n => n.endsWith('.sql')).sort()) {
        await c.query(fs.readFileSync(SOURCE + '/supabase/migrations/' + file, 'utf8'));
    }
}, 30000);

afterAll(async () => {
    if (process.env.ZTOATTEST_RESULT) fs.writeFileSync(process.env.ZTOATTEST_RESULT,
        JSON.stringify({ source: SOURCE, observations }, null, 2) + '\n');
    if (c) await c.end();
    await PG.stop();
});

const read = async (root: string, key: string) => (await c.query(
    'select value from public.zoe_docs where tenant_id=$1 and root=$2 and key=$3', [tenant, root, key])).rows[0]?.value ?? null;
const write = (updates: any, operation = 'attestation_client_' + String(++sequence).padStart(12, '0')) =>
    PG.as(c, who, 'select public.zoe_write_v2($1,$2,$3::jsonb) as r', [tenant, operation, JSON.stringify(operations(updates))]);
const seed = async (updates: any) => {
    const result = await PG.as(c, { role: 'service_role' }, 'select public.zoe_admin_write($1,$2,$3::jsonb) as r',
        [tenant, 'attestation_seed_' + String(++sequence).padStart(12, '0'), JSON.stringify(operations(updates))]);
    expect(result.error).toBeUndefined();
};

for (const mode of ['palm', 'cookie', 'local']) {
    it(mode + ': direct authenticated financial restore requires trusted upstream authorization except explicit Sheet policy', async () => {
        const branch = String(['palm', 'cookie', 'local'].indexOf(mode) + 1).padStart(6, '0');
        tenant = (await c.query("insert into public.tenants(name,branch_code,expires_at) values($1,$2,now()+interval '1 day') returning id", ['attestation-' + mode, branch])).rows[0].id;
        const uid = await PG.makeAuthUser(c, 'attestation-' + mode + '@users.zoew.invalid');
        await c.query("insert into public.tenant_members(user_id,tenant_id,username) values($1,$2,$3)", [uid, tenant, 'attestation_' + mode]);
        who = await PG.sessionClaims(c, { role: 'authenticated', sub: uid });
        const vector = legacyRestoreVector(mode, 'missing_proof_' + mode, who.sub);
        const zero = { codDollar: 0, dodDollar: 0, totalCount: 0 };
        await seed({ ['zoew_restore_policy/shop']: { v: 1, mode, scope: 'qa_restore_attestation', branch, epoch: 1 },
            [TRASH + '/' + vector.source.id]: vector.source, [DAILY + '/' + vector.day]: zero,
            [MONTHLY + '/' + vector.month]: zero });
        const beforeSource = await read(TRASH, vector.source.id);
        // No app verifier or proxy is invoked: this is the real authenticated RPC boundary.
        const claimed = await write({ [TRASH + '/' + vector.source.id + '/restoreClaim']: vector.claim });
        const prepared = await write({ [HISTORY + '/' + vector.claim.targetId]: vector.prepared });
        const operation = 'attestation_finalize_' + mode + '_0000000000';
        const finalized = await write(vector.finalPacket, operation);
        const auditBeforeReplay = Number((await c.query(
            'select count(*)::int n from public.zoe_business_audit where tenant_id=$1 and operation_id=$2', [tenant, operation])).rows[0].n);
        const replay = await write(vector.finalPacket, operation);
        const auditAfterReplay = Number((await c.query(
            'select count(*)::int n from public.zoe_business_audit where tenant_id=$1 and operation_id=$2', [tenant, operation])).rows[0].n);
        const state = { trash: await read(TRASH, vector.source.id), history: await read(HISTORY, vector.claim.targetId),
            daily: await read(DAILY, vector.day), monthly: await read(MONTHLY, vector.month),
            consumption: await read('zoew_trash_consumptions', vector.source.id),
            finalization: await read('zoew_restore_finalizations', vector.source.id) };
        observations.push({ mode, invokedUpstreamVerifier: false, claimError: claimed.error?.code ?? null,
            prepareError: prepared.error?.code ?? null, finalizeError: finalized.error?.code ?? null,
            replayError: replay.error?.code ?? null, auditBeforeReplay, auditAfterReplay, state });
        expect(auditAfterReplay).toBe(auditBeforeReplay);
        if (mode === 'local') {
            expect(claimed.error).toBeUndefined();
            expect(prepared.error).toBeUndefined();
            expect(finalized.rows?.[0]?.r?.ok).toBe(true);
            expect(replay.rows?.[0]?.r?.ok).toBe(true);
            expect(state.daily).toEqual(vector.money);
            expect(state.monthly).toEqual(vector.money);
            expect(state.trash).toBeNull();
            expect(state.consumption).toMatchObject(vector.consumption);
            expect(auditAfterReplay).toBeGreaterThan(0);
        } else {
            expect(claimed.error?.code).toBe('42501');
            expect(prepared.error?.code).toBe('42501');
            expect(finalized.error?.code).toBe('42501');
            expect(state.trash).toEqual(beforeSource);
            expect(state.history).toBeNull();
            expect(state.daily).toEqual(zero);
            expect(state.monthly).toEqual(zero);
            expect(state.consumption).toBeNull();
            expect(state.finalization).toBeNull();
            expect(auditAfterReplay).toBe(0);
        }
    });
}
