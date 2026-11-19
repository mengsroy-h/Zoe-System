import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import * as acorn from 'acorn';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../../../..');
const checkerRoot = process.env.SETUP_CHECKER_SOURCE_ROOT || root;
function checker(name: string) {
    const file = resolve(checkerRoot, 'tools/audit-tools', name);
    const source = readFileSync(file, 'utf8');
    const log: string[] = [];
    const context: any = {
        require: (name: string) => name === 'acorn' ? acorn : createRequire(file)(name), __dirname: resolve(root, 'tools/audit-tools'),
        process: { env: { SETUPRT_APP_DIR: root, KEYGEN_SBADMIN_APP_DIR: root, ZOE_REPO_ROOT: root } },
        console: { log: (...items: unknown[]) => log.push(items.join(' ')) },
        Buffer, URL, URLSearchParams, AbortController, atob, btoa, escape, unescape,
        encodeURIComponent, decodeURIComponent, setTimeout, clearTimeout, setImmediate,
        fetch: () => { throw new Error('តេស្តនេះមិនប្រើបណ្ដាញ'); }
    };
    return { source, context, log };
}

const cfg = { apiKey: 'synthetic-key', databaseURL: 'https://synthetic-shop.firebaseio.com', projectId: 'ហាងសាកល្បង' };
const inputs = [
    ['https://zoew.example', 'https://zoew.example/'],
    ['https://zoew.example/app/?view=settings#settings', 'https://zoew.example/app/'],
    ['https://zoew.example/app/index.html#settings', 'https://zoew.example/app/index.html']
];

describe('អ្នកយាម Setup Link ប្រើ producer និង dependency ពិត', () => {
    it.each(inputs)('round-trip harness សាង Link តាមការបង្កើតពិត %s', (input, base) => {
        const h = checker('setup-link-roundtrip-test.js');
        const ast: any = acorn.parse(h.source, { ecmaVersion: 'latest' });
        const end = ast.body.find((n: any) => n.type === 'VariableDeclaration' && n.declarations.some((d: any) => d.id.name === 'APPS'));
        expect(end).toBeTruthy();
        const producer = ast.body.filter((n: any) => n.end <= end.start && !h.source.slice(n.start, n.end).includes('APP_DSN_KEY'));
        runInNewContext(producer.map((n: any) => h.source.slice(n.start, n.end)).join('\n') + '\nglobalThis.fixture = { ctx, pass, fail };', h.context);
        expect(h.context.fixture.fail, h.log.join('\n')).toBe(0);
        const link = h.context.fixture.ctx.buildLink(input, btoa(unescape(encodeURIComponent(JSON.stringify(cfg)))));
        expect(link.startsWith(base + '#setup=')).toBe(true);
        expect(new URL(link).search).toBe('');
        const payload = JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(new URL(link).hash.slice('#setup='.length))))));
        expect(payload).toEqual(cfg);
    });

    it.each(inputs)('Supabase harness ភ្ជាប់ URL helper ពិត %s', (input, base) => {
        const h = checker('keygen-supabase-admin-test.js');
        const ast: any = acorn.parse(h.source, { ecmaVersion: 'latest' });
        const declarations = ast.body.filter((n: any) => n.type === 'VariableDeclaration' || n.type === 'FunctionDeclaration');
        runInNewContext(declarations.map((n: any) => h.source.slice(n.start, n.end)).join('\n') + '\nglobalThis.fixture = buildKeygen();', h.context);
        const k = h.context.fixture;
        k.store.setItem(k.ctx.SETUP_LINK_URL_KEY, input);
        const session = { url: 'https://synthetic-shop.supabase.co', key: 'sb_publishable_synthetic' };
        const link = k.ctx.sbInviteSetupLink(session, 'SYNTHETIC-INVITE');
        expect(link.startsWith(base + '#setup=')).toBe(true);
        const payload = JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(new URL(link).hash.slice('#setup='.length))))));
        expect(payload).toEqual({ supabaseUrl: session.url, supabaseKey: session.key, invite: 'SYNTHETIC-INVITE' });
        expect(k.log.fetches).toEqual([]);
        expect(k.log.errors).toEqual([]);
    });
});
