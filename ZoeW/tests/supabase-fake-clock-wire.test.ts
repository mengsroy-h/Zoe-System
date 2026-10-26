// @vitest-environment node
import { createRequire } from 'node:module';
import { expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { startFakeSupabase } = require('../../audit-tools/supabase-fake-server.js');

it.each(['bigint', 'text', 'jsonb'])('HTTP scalar %s preserves the PostgREST JSON type', async (type) => {
    const clock = '1793000000123';
    const client = {
        release() {},
        async query(query: string | { text: string }) {
            const text = typeof query === 'string' ? query : query.text;
            if (text.includes('from pg_proc')) return { rows: [{ names: [], types: [], setof: false, ret: type, rettype: 'b' }] };
            if (text.startsWith('select public.zoe_now()')) return { rows: [{ r: clock }] };
            return { rows: [] };
        }
    };
    const server = await startFakeSupabase({ pool: { connect: async () => client } });
    try {
        const response = await fetch(server.url + '/rest/v1/rpc/zoe_now', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
        expect(response.status).toBe(200);
        expect(await response.json()).toBe(type === 'bigint' ? Number(clock) : clock);
    } finally { await server.close(); }
});
