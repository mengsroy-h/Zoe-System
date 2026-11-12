// @vitest-environment node
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { createPushService } from '../netlify/lib/push-core.mjs';

const base = 'https://session-test.supabase.co';
const key = 'sb_publishable_' + 'k'.repeat(30);
const token = [
    { alg: 'ES256', typ: 'JWT' },
    { iss: base + '/auth/v1', sub: '10000000-0000-4000-8000-000000000001', role: 'authenticated',
        session_id: '20000000-0000-4000-8000-000000000001', exp: Math.floor(Date.now() / 1000) + 3600 },
].map(x => Buffer.from(JSON.stringify(x)).toString('base64url')).join('.') + '.c2ln';

function harness(kind: string) {
    let status = 200;
    let calls = 0;
    const fetch = async () => {
        calls++;
        const rows = [{ tenant_id: '30000000-0000-4000-8000-000000000001', branch_code: '881859', status: 'active' }];
        return { status, ok: status === 200, json: async () => rows, text: async () => JSON.stringify(rows) };
    };
    let verify: () => Promise<any>;
    if (kind === 'push') {
        const service = createPushService({ env: { SUPABASE_URL: base, SUPABASE_PUBLISHABLE_KEY: key }, store: {}, fetch });
        verify = () => service.verifySupabase(token);
    } else {
        const filename = path.resolve(__dirname, '../netlify/functions/_shared/zto-order-detail-core.cjs');
        const context = { require: createRequire(filename), exports: {}, Buffer, URL, setTimeout, clearTimeout, fetch };
        vm.runInNewContext(readFileSync(filename, 'utf8') + '\nexports.verifySession = verifySupabaseToken;', context, { filename });
        verify = () => (context.exports as any).verifySession(token, { base, issuer: base + '/auth/v1', key }, 1000);
    }
    return { verify, revoke: () => { status = 401; }, outage: () => { status = 503; }, calls: () => calls };
}

describe.each(['zto', 'push'])('%s Supabase session authorization', kind => {
    it('បដិសេធ JWT ចាស់នៅពេល session ត្រូវដក មុនសំណើដំបូង', async () => {
        const h = harness(kind);
        h.revoke();
        expect(await h.verify()).toMatchObject({ ok: false });
        expect(h.calls()).toBe(1);
    });
    it('បដិសេធ JWT ដដែលភ្លាមក្រោយ session ត្រូវដក ទោះបានប្រើមុន', async () => {
        const h = harness(kind);
        expect(await h.verify()).toMatchObject({ ok: true });
        h.revoke();
        expect(await h.verify()).toMatchObject({ ok: false });
        expect(h.calls()).toBe(2);
    });
    it('មិនប្រើសាលក្រមចាស់ពេល Supabase ដាច់', async () => {
        const h = harness(kind);
        expect(await h.verify()).toMatchObject({ ok: true });
        h.outage();
        expect(await h.verify()).toMatchObject({ ok: false });
        expect(h.calls()).toBe(2);
    });
});
