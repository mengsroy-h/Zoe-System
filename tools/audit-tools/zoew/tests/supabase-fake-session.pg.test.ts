// @vitest-environment node
import { createRequire } from 'node:module';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '../../../..');
const { createPgHarness } = require('../../supabase-pg.js');
const harness = createPgHarness({ depsDirs: [path.join(root, 'supabase/node_modules')], shimDir: path.join(root, 'tools/audit-tools/supabase-shim'), wantMajor: 17 });
let connection: any, authAdmin: any, pool: any;
let user: string, foreign: string;

beforeAll(async () => {
    expect(harness.unavailableReason()).toBeNull();
    await harness.start();
    const fresh = await harness.freshDb('default-grants'); connection = fresh.c;
    authAdmin = await harness.connect('supabase_auth_admin', fresh.name);
    await authAdmin.query('alter table auth.sessions add column not_after timestamptz');
    user = await harness.makeAuthUser(connection, 'fake-session@example.invalid');
    foreign = await harness.makeAuthUser(connection, 'foreign-session@example.invalid');
    pool = new harness.PG.Pool({ host: '127.0.0.1', port: connection.connectionParameters.port, user: 'postgres', database: fresh.name });
}, 30000);

afterAll(async () => {
    if (pool) await pool.end();
    if (authAdmin) await authAdmin.end();
    if (connection) await connection.end();
    harness.stop();
});

for (const fixture of ['../../supabase-fake-server.js', '../../emu/supabase-fake-server.js']) describe(path.basename(path.dirname(fixture)) + ' fake GoTrue session ពិត', () => {
    const { startFakeSupabase } = require(fixture);
    it.each(['revoked', 'foreign', 'expired'])('%s មិនអនុញ្ញាត auth/user ឬ refresh', async state => {
        const server = await startFakeSupabase({ pool });
        server.addUser('fake-session@example.invalid', 'synthetic-only', user);
        try {
            const login = await fetch(server.url + '/auth/v1/token?grant_type=password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'fake-session@example.invalid', password: 'synthetic-only' }) });
            expect(login.status).toBe(200);
            const token = await login.json();
            const claims = JSON.parse(Buffer.from(token.access_token.split('.')[1], 'base64url').toString());
            expect((await authAdmin.query('select user_id from auth.sessions where id=$1', [claims.session_id])).rows[0].user_id).toBe(user);
            const requestUser = () => fetch(server.url + '/auth/v1/user', { headers: { Authorization: 'Bearer ' + token.access_token } });
            expect((await requestUser()).status).toBe(200);
            if (state === 'revoked') await authAdmin.query('delete from auth.sessions where id=$1', [claims.session_id]);
            if (state === 'foreign') await authAdmin.query('update auth.sessions set user_id=$1 where id=$2', [foreign, claims.session_id]);
            if (state === 'expired') await authAdmin.query("update auth.sessions set not_after=now()-interval '1 second' where id=$1", [claims.session_id]);
            expect((await requestUser()).status).toBe(401);
            const refresh = await fetch(server.url + '/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: token.refresh_token }) });
            expect(refresh.status).toBe(400);
        } finally { await server.close(); }
    });

    it('control៖ valid session refresh រក្សា SID ដដែល ហើយមិនបង្កើត auth.sessions ស្ទួន', async () => {
        const server = await startFakeSupabase({ pool });
        server.addUser('fake-session@example.invalid', 'synthetic-only', user);
        try {
            const login = await fetch(server.url + '/auth/v1/token?grant_type=password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'fake-session@example.invalid', password: 'synthetic-only' }) });
            const token = await login.json();
            const sid = JSON.parse(Buffer.from(token.access_token.split('.')[1], 'base64url').toString()).session_id;
            await authAdmin.query("update auth.sessions set not_after=now()+interval '1 day' where id=$1", [sid]);
            const refresh = await fetch(server.url + '/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: token.refresh_token }) });
            expect(refresh.status).toBe(200);
            const renewed = await refresh.json();
            expect(JSON.parse(Buffer.from(renewed.access_token.split('.')[1], 'base64url').toString()).session_id).toBe(sid);
            expect((await authAdmin.query('select count(*)::int as n from auth.sessions where id=$1', [sid])).rows[0].n).toBe(1);
        } finally { await server.close(); }
    });
});
