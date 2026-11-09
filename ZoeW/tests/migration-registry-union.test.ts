import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { afterEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const { validateTree, run } = require('../../tools/supabase-migrate/migrate.js');
const { buildArchive } = require('../../firebase-backup/supabase.js');
const { writeBackup } = require('../../firebase-backup/backup.js');
const rules = JSON.parse(fs.readFileSync(path.resolve('../firebase-database.rules.json'), 'utf8')).rules;
const registry = 'zoew_barcode_registry';
const errors = (value: unknown, selected = rules, root = registry) => validateTree({ [root]: { PARCEL_A: value } }, selected).problems.filter((p: any) => p.level === 'error');
const custom = (expression: string) => ({ [registry]: { $barcodeKey: { '.validate': expression, v: { '.validate': 'newData.val() === 2' } } } });

describe('ការផ្ទេរ registry៖ legacy true និង owned object មិនច្រឡំគ្នា', () => {
    it('ទទួល legacy true តាម union ក្នុង rules ពិត និងរក្សា owned object', () => {
        expect(errors(true)).toEqual([]);
        expect(errors({ v: 2, intent: 'scan_' + 'a'.repeat(32), actorUid: 'actor', birth: 17 })).toEqual([]);
    });
    it.each([false, 'true', 'item-id', 1, 0])('មិនបើក primitive ផ្សេង %s', (value) => expect(errors(value).length).toBeGreaterThan(0));
    it('មិនបើក root ផ្សេង និង root scalar', () => {
        expect(errors(true, rules, 'zoew_scan_history_cod_dod').length).toBeGreaterThan(0);
        expect(validateTree({ [registry]: true }, rules).problems.some((p: any) => p.level === 'error')).toBe(true);
    });
    it.each([
        'newData.val() === true || newData.hasChildren([\'v\'])',
        '(true === newData.val()) || (auth.uid === \'quoted || ( )\')',
        '((newData.val() === true) && true) || newData.hasChildren([\'v\'])',
        'newData.hasChildren([\'escaped \\\' || )\']) || newData.val() === true',
    ])('ទទួលតែ proof ជាក់លាក់ %s', (expression) => expect(errors(true, custom(expression))).toEqual([]));
    it.each([
        '(newData.val() === true || newData.hasChildren([\'v\'])) && false',
        '(newData.val() === true) && auth != null',
        '!(auth == null)',
        '(auth == null) === false',
        'auth.uid === \'newData.val() === true ||\'',
        'newData.val() === false',
        '(newData.val() === true) ||',
        '(newData.val() === true',
        'newData.val() === true || bogus()',
        'newData.val() === true; false',
        'true || auth.uid === \'unterminated',
    ])('ខ្វះ proof ឬ syntax ខូច ត្រូវបដិសេធ %s', (expression) => expect(errors(true, custom(expression)).length).toBeGreaterThan(0));
    it('cache រូបរាង rules មិនអនុញ្ញាតបន្តពេល expression ប្រែ', () => {
        const selected = custom('newData.val() === true || newData.hasChildren([\'v\'])');
        expect(errors(true, selected)).toEqual([]);
        selected[registry].$barcodeKey['.validate'] = 'false && newData.hasChildren([\'v\'])';
        expect(errors(true, selected).length).toBeGreaterThan(0);
    });
    it('កំណត់ទំហំ និងជម្រៅ expression', () => {
        expect(errors(true, custom('true || ' + '('.repeat(80) + 'auth != null' + ')'.repeat(80))).length).toBeGreaterThan(0);
        expect(errors(true, custom('true || ' + 'false || '.repeat(5000) + 'false')).length).toBeGreaterThan(0);
    });
});

const temporaryInputs: string[] = [];
afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    for (const dir of temporaryInputs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

function migrationFixture() {
    const syntheticSecret = 'sb_secret_' + randomBytes(24).toString('base64url');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zoe-migration-empty-'));
    temporaryInputs.push(dir);
    const tenant = '00000000-0000-4000-8000-0000000000aa';
    const initial = { [registry]: { EXISTING: true, BAD: true } };
    let seq = 1;
    const rows: Array<{ r: string; k: string; v: unknown; s: number }> = Object.entries(initial[registry])
        .map(([key, value]) => ({ r: registry, k: key, v: value, s: seq }));
    const writes: unknown[] = [];
    const logs: string[] = [];
    const fetch = vi.fn(async (url: string, init: RequestInit) => {
        expect(new URL(url).origin).toBe('https://synthetic-migration.invalid');
        const args = JSON.parse(String(init.body));
        let reply: unknown;
        if (url.endsWith('/zoe_admin_tenants')) {
            reply = { tenants: [{ id: tenant, name: 'Synthetic', branch_code: 'TEST', seq, docs: rows.filter(row => row.v !== null).length }], more: false, next: null };
        } else if (url.endsWith('/zoe_admin_export')) {
            reply = { rows: structuredClone(rows.filter(row => row.s > args.p_after_seq)), more: false,
                tombstones_after: args.p_tombstones_after === null ? 0 : args.p_tombstones_after, head: seq, purged: 0 };
        } else if (url.endsWith('/zoe_admin_write')) {
            writes.push(structuredClone(args)); seq++;
            for (const op of args.p_ops) {
                expect(op.p).toHaveLength(2);
                const [root, key] = op.p;
                const next = { r: root, k: key, v: structuredClone(op.v), s: seq };
                const index = rows.findIndex(row => row.r === root && row.k === key);
                if (index < 0) rows.push(next); else rows[index] = next;
            }
            reply = { ok: true, seq };
        } else throw new Error('unexpected synthetic RPC');
        return new Response(JSON.stringify(reply), { status: 200, headers: { 'content-type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetch);
    vi.spyOn(process.stdout, 'write').mockImplementation(chunk => { logs.push(String(chunk)); return true; });
    const tree = () => {
        const result: Record<string, Record<string, unknown>> = {};
        for (const row of rows) if (row.v !== null) (result[row.r] ||= {})[row.k] = structuredClone(row.v);
        return result;
    };
    const execute = async (value: unknown, apply: boolean, skipInvalid: boolean, fromBackup = false, replace = true) => {
        const file = fromBackup ? writeBackup(path.join(dir, 'backup'), null, 3) : path.join(dir, 'input.json');
        if (!fromBackup) fs.writeFileSync(file, JSON.stringify(value));
        const args = [file, '--tenant', tenant, '--retries', '0'];
        if (replace) args.push('--replace');
        if (apply) args.push('--apply');
        if (skipInvalid) args.push('--skip-invalid');
        return run(args, { ZOE_SUPABASE_URL: 'https://synthetic-migration.invalid', ZOE_SUPABASE_SECRET_KEY: syntheticSecret });
    };
    return { execute, tree, initial, fetch, writes, logs, dir };
}

const emptyInputs = [
    ['object', {}], ['root-object', { [registry]: {} }], ['root-null', { [registry]: null }], ['root-array', { [registry]: [] }],
    ['archive-v1', buildArchive({ id: '00000000-0000-4000-8000-0000000000bb', name: 'Synthetic', branch_code: 'SRC' }, { data: {}, seq: 0 }, 'synthetic.invalid')],
    ['firebase-backup-null', null]
] as const;

describe('ការផ្ទេរ៖ input គ្មាន record មិនក្លាយជាពាក្យបញ្ជាលុបហាង', () => {
    for (const apply of [false, true]) it(`គ្មាន --replace · apply=${apply} នៅបដិសេធ input ទទេមុន RPC`, async () => {
        const f = migrationFixture();
        expect(await f.execute({}, apply, false, false, false)).toBe(1);
        expect(f.fetch).not.toHaveBeenCalled();
        expect(f.writes).toEqual([]);
        expect(f.tree()).toEqual(f.initial);
    });
    for (const [name, value] of emptyInputs) for (const apply of [false, true]) for (const skipInvalid of [false, true]) {
        it(`${name} · apply=${apply} · skipInvalid=${skipInvalid} បដិសេធមុន RPC និងរក្សាហាង`, async () => {
            const f = migrationFixture();
            if (name === 'firebase-backup-null') {
                const file = writeBackup(path.join(f.dir, 'source'), null, 3);
                expect(JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString('utf8'))).toEqual({});
            }
            const code = await f.execute(value, apply, skipInvalid, name === 'firebase-backup-null');
            expect(code).toBe(1);
            expect(f.fetch).not.toHaveBeenCalled();
            expect(f.writes).toEqual([]);
            expect(f.tree()).toEqual(f.initial);
            expect(f.logs.join('')).toContain('REFUSED');
            expect(f.logs.join('')).not.toContain('VERIFIED');
        });
    }

    it('input ល្អនៅសរសេរ ផ្ទៀង persisted records ហើយការរត់ដដែលមិនសរសេរថ្មី', async () => {
        const f = migrationFixture();
        const input = { [registry]: { NEW: true, OWNED: { v: 2, intent: 'scan_' + 'a'.repeat(32), actorUid: 'synthetic-actor', birth: 17 } } };
        expect(await f.execute(input, true, false)).toBe(0);
        expect(f.tree()).toEqual(input);
        expect(f.writes).toHaveLength(1);
        expect(f.logs.join('')).toContain('VERIFIED');
        expect(await f.execute(input, true, false)).toBe(0);
        expect(f.tree()).toEqual(input);
        expect(f.writes).toHaveLength(1);
    });

    it('skip-invalid នៅទទួល record ល្អ និងរក្សាច្បាប់ដើមនៃ record ខូច', async () => {
        const f = migrationFixture();
        expect(await f.execute({ [registry]: { NEW: true, BAD: false } }, true, true)).toBe(0);
        expect(f.tree()).toEqual({ [registry]: { NEW: true, BAD: true } });
        expect(f.writes).toHaveLength(1);
        expect(f.logs.join('')).toContain('VERIFIED');
    });
});
