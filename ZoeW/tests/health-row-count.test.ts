import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { transformSync } from 'esbuild';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const guard = readFileSync(resolve('../audit-tools/doc-scope-test.js'), 'utf8');
const start = guard.indexOf('// --- គ. ជួរ');
const end = guard.indexOf('// --- ឃ.', start);
function count(uiApp: string | string[]) {
    return runInNewContext(guard.slice(start, end) + '\nhealthRowCount;', { uiApp, require }, { timeout: 2000 });
}
function fixture(mutation = 'rows.push(lookupRow);', wrapper = true) {
    return `${wrapper ? 'function runHealthCheck(force = false) { return runHealthCheckRound({force}).finally(() => {}); }' : ''}
    async function ${wrapper ? 'runHealthCheckRound(task)' : 'runHealthCheck(force = false)'} {
        uiState.healthRows = [healthPendingRow()];
        try {
            const [databaseRow, licenseRow, lookupRow, offlineRow] = await Promise.all([healthDatabaseLiveRow(), healthLicenseRow(), healthLookupRow(), healthServiceWorkerLiveRow()]);
            const rows = [healthNetworkRow(true), healthClockRow(), healthStorageRow(), healthServiceWorkerRow(), healthCustomerTableRow(), healthSheetScriptRow()];
            rows[3] = worker ? offlineRow : healthServiceWorkerRow();
            const currentDatabase = healthDatabaseRow();
            rows.splice(1, 0, healthDatabaseWriteRow() || databaseRow);
            rows.splice(3, 0, licenseRow);
            ${mutation}
            if (stale) return;
            uiState.healthRows = rows;
        } catch (error) { uiState.healthRows = [healthRow('warn', 'failed', error)]; }
    }`;
}

describe('ចំនួនជួរសុខភាពពី checker ពិត', () => {
    it('wrapper និង async entrypoint រាប់ជួរដែលគូរ មិនមែនឈ្មោះ helper', () => {
        expect(count(fixture())).toBe(9);
        expect(count(fixture(undefined, false))).toBe(9);
    });
    it('ចំនួនតាម push និង splice ពិត', () => {
        expect(count(fixture('rows.push(lookupRow, lookupRow);'))).toBe(10);
        expect(count(fixture('rows.splice(0, 2, lookupRow);'))).toBe(7);
        expect(count(fixture(''))).toBe(8);
    });
    it('regular និង arrow entrypoint ហៅ helper មាន arguments', () => {
        const source = 'const runHealthCheck = (force) => round(force); function round(force) { uiState.healthRows = [row(force), row(false), row(true)]; }';
        expect(count(source)).toBe(3);
        expect(count(source.replace('const runHealthCheck = (force) => round(force);', 'function runHealthCheck(force) { return round(force); }'))).toBe(3);
    });
    it('splice ប្រើ index អវិជ្ជមាន និងកាត់តាមចំនួនពិត', () => {
        expect(count(fixture('rows.splice(-1, 50, lookupRow);'))).toBe(8);
        expect(count(fixture('rows.splice(50, 2, lookupRow);'))).toBe(9);
    });
    it('ឈ្មោះ helper ក្នុង scope ផ្សេងមិនប៉ះ inventory', () => {
        expect(count(fixture() + ' function other() { function current() {} } function another() { function current() {} }')).toBe(9);
    });
    it('arguments និង helper ដដែលមិនបន្ថយចំនួនជួរ', () => {
        expect(count(fixture().replace('healthClockRow()', 'healthNetworkRow(false)'))).toBe(9);
    });
    it('អត្ថបទ និងការហៅ helper ដែលមិនមែនជួរមិនបន្ថែមចំនួន', () => {
        expect(count(fixture('healthUnrelatedRow(); const text = "rows.push(fake); healthExtraRow()"; /* rows.push(fake); */ rows.push(lookupRow);'))).toBe(9);
    });
    it('វាស់ source ពិតក្រោយបម្លែង TypeScript', () => {
        const source = readFileSync(resolve('src/features/health-check.ts'), 'utf8');
        expect(count(transformSync(source, { loader: 'ts', format: 'esm' }).code)).toBe(9);
    });
    it.each([
        '', 'function runHealthCheck( {', 'function other() { uiState.healthRows = [row()]; }',
        fixture('rows.push(...dynamicRows);'), fixture('rows.splice(position, amount, lookupRow);'),
        fixture('if (enabled) rows.push(lookupRow);'), fixture('for (const row of dynamicRows) rows.push(row);'),
        fixture('mutate(rows);'), fixture('const alias = rows; alias.push(lookupRow);'), fixture('rows = externalRows;'),
        fixture('rows.pop();'), fixture('rows.splice(0);'), fixture('rows[99] = lookupRow;'),
        fixture().replace('uiState.healthRows = rows;', 'uiState.healthRows = dynamicRows;'),
        fixture().replace('uiState.healthRows = rows;', 'uiState.healthRows = rows; uiState.healthRows = [row()];'), fixture('rows.length = external;'), fixture('rows[index] = lookupRow;'),
        fixture().replace('const rows = [healthNetworkRow(true),', 'const rows = [...dynamicRows, healthNetworkRow(true),'),
    ])('រាងបាត់ ខូច ឬចំនួនមិនច្បាស់ត្រូវបរាជ័យ %#', (source) => {
        expect(count(source)).toBeNull();
    });
});


describe('ព្រំដែន module ពិតរបស់ audit inventory', () => {
    const helperModule = { exports: {} as any };
    runInNewContext(readFileSync(resolve('../audit-tools/react-view.js'), 'utf8'), { require, module: helperModule });
    const helpers = helperModule.exports;
    function withView(run: (dir: string) => void) {
        const dir = mkdtempSync(resolve(tmpdir(), 'zoe-inventory-modules-'));
        try { run(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
    }
    const components = 'onAct("openMenu"); const row = { "data-act": item.action };';
    it('ឈ្មោះ private ស្ទួនឆ្លង module មិនលុប health និង action inventory', () => withView(dir => {
        const parts = ['const text = value => value;\n' + fixture(), 'const text = value => value;\nconst menu = [{label:"Close",action:"closeMenu"}];'];
        writeFileSync(resolve(dir, 'audit-module-views.json'), JSON.stringify({ health: parts[0], menu: parts[1] }));
        writeFileSync(resolve(dir, 'components.js'), components);
        const flat = parts.join('\n');
        expect(count(flat)).toBeNull();
        expect(count(helpers.auditModuleSources(dir, flat))).toBe(9);
        const ranges = helpers.auditModuleSourceRanges(dir, flat);
        expect(ranges.map((part: any) => part.source).join('')).toBe(flat);
        expect(ranges.every((part: any, i: number) => flat.slice(part.start, part.end) === part.source && (i === 0 ? part.start === 0 : part.start === ranges[i - 1].end))).toBe(true);
        expect([...helpers.actionUsages(dir, flat)].sort()).toEqual(['closeMenu', 'openMenu']);
    }));
    it('សកម្មភាពបន្ថែមក្រៅ manifest នៅតែត្រូវរាប់ មិនលាក់សិទ្ធិលើស', () => withView(dir => {
        const part = 'const menu = [{label:"Close",action:"closeMenu"}];';
        writeFileSync(resolve(dir, 'audit-module-views.json'), JSON.stringify({ menu: part }));
        writeFileSync(resolve(dir, 'components.js'), components);
        const flat = part + '\nconst added = [{label:"Extra",action:"unexpectedAction"}];';
        expect([...helpers.actionUsages(dir, flat)].sort()).toEqual(['closeMenu', 'openMenu', 'unexpectedAction']);
    }));
    it.each(['missing', 'stale', 'malformed', 'empty', 'invalid-source'])('manifest ឬ source ខូចត្រូវធ្លាក់ %s', mode => withView(dir => {
        const part = 'const menu = [{label:"Close",action:"closeMenu"}];';
        const view = mode === 'missing' ? { menu: part, missing: 'function absent() {}' }
            : mode === 'stale' ? { menu: part.replace('closeMenu', 'oldMenu') }
            : mode === 'empty' ? {} : { menu: part };
        writeFileSync(resolve(dir, 'audit-module-views.json'), mode === 'malformed' ? '{' : JSON.stringify(view));
        writeFileSync(resolve(dir, 'components.js'), components);
        expect(() => helpers.actionUsages(dir, part + (mode === 'invalid-source' ? '\nfunction broken( {' : ''))).toThrow();
    }));
    it('vanilla ដែលគ្មាន manifest រក្សា parser តឹងដដែល', () => withView(dir => {
        expect(helpers.auditModuleSources(dir, fixture())).toEqual([fixture()]);
        writeFileSync(resolve(dir, 'components.js'), components);
        expect(() => helpers.actionUsages(dir, 'function bad( {')).toThrow();
    }));
});


describe('ឯកសារពិតរបស់ emu runner', () => {
    const from = guard.indexOf('function emuRunnerTargets(');
    const to = guard.indexOf('\n(function ()', from);
    const targets = (text: string) => runInNewContext(guard.slice(from, to) + '\nemuRunnerTargets(input);', { input: text });
    it('label ខុសពី filename រក្សាគ្រប់ invocation និង target ពិត', () => {
        const out = targets('run "emu/scan-operation-sdk" node audit-tools/emu/scan-operation-sdk-test.js\nrun "emu/scan-month-delay-sdk" node audit-tools/emu/scan-operation-sdk-test.js --month-wire=delay');
        expect([...out.keys()]).toEqual(['emu/scan-operation-sdk', 'emu/scan-month-delay-sdk']);
        expect(out.get('emu/scan-month-delay-sdk')).toEqual(['audit-tools/emu/scan-operation-sdk-test.js']);
    });
    it('target បាត់ ឬ command មិនស្គាល់ មិនក្លាយជាឯកសារដែលមាន', () => {
        const out = targets('run "emu/missing" node audit-tools/emu/not-present.js\nrun "emu/unknown" bash something.sh\n# run "emu/comment" node audit-tools/emu/hidden.js');
        expect(out.get('emu/missing')).toEqual(['audit-tools/emu/not-present.js']);
        expect(out.has('emu/unknown')).toBe(false);
        expect(out.has('emu/comment')).toBe(false);
    });
});

describe('PIN sweep៖ ព្រំដែន module និង offset mutation ពិត', () => {
    const banner = readFileSync('../audit-tools/zto-sync-banner-test.js', 'utf8');
    const a = banner.indexOf('function scopedFunctionCalls(');
    const b = banner.indexOf('\nconst APP_MODULE_SOURCES', a);
    const find = runInNewContext(banner.slice(a, b) + '\nscopedFunctionCalls;', { acorn: require('acorn') });
    const first = 'const text = 1; function other() { scheduleZtoStatusSweep(); }\n';
    const second = 'const text = 2; async function completePinUnlock() { scheduleZtoStatusSweep(); scheduleZtoStatusSweep(5); function nested() { scheduleZtoStatusSweep(); } }';
    it('private ស្ទួន៖ តែការ call ផ្ទាល់ដែលគ្មាន arguments នៅក្នុង PIN មាន offset ត្រឹមត្រូវ', () => {
        const parts = [first, second];
        expect(find(parts.join(''), 'completePinUnlock', 'scheduleZtoStatusSweep').error).toBeTruthy();
        const hit = find(parts, 'completePinUnlock', 'scheduleZtoStatusSweep');
        expect(hit.definitions).toBe(1); expect(hit.calls).toHaveLength(1);
        const call = hit.calls[0];
        expect(parts.join('').slice(call.start, call.end)).toBe('scheduleZtoStatusSweep()');
        expect(call.start).toBeGreaterThan(first.length);
        const edited = second.slice(0, call.start - first.length) + 'void 0' + second.slice(call.end - first.length);
        expect(find([first, edited], 'completePinUnlock', 'scheduleZtoStatusSweep').calls).toHaveLength(0);
        expect(edited).toContain('scheduleZtoStatusSweep(5)');
        expect(edited).toContain('function nested() { scheduleZtoStatusSweep(); }');
    });
    it('function គោលដៅស្ទួន ឬ syntax ខូច មិនត្រូវអនុញ្ញាត mutation', () => {
        expect(find([second, second], 'completePinUnlock', 'scheduleZtoStatusSweep').calls).toHaveLength(0);
        expect(find([first, 'function broken( {'], 'completePinUnlock', 'scheduleZtoStatusSweep').error).toBeTruthy();
    });
});

describe('Postgres scan rules៖ dependency មកពី repo ពិត មិនមែន measure-root តែមួយ', () => {
    it('អាន config ពី measure-root តែរក package ក្នុង repo និង override ដើម', async () => {
        const file = readFileSync('../audit-tools/emu/scan-operation-rules-test.js', 'utf8');
        const from = file.indexOf('async function setupPostgres()');
        const to = file.indexOf('\nasync function ', from + 1);
        expect(to).toBeGreaterThan(from);
        let options: any;
        const stop = new Error('setup captured before PostgreSQL starts');
        const setup = runInNewContext(file.slice(from, to) + '\nsetupPostgres;', {
            ROOT: '/measure', REPO: '/real-repository', __dirname: '/checker/emu',
            process: { env: { SUPABASE_DEPS_DIR: '/explicit' } },
            fs: { readFileSync: () => 'major_version = 17\n' }, path: require('node:path'), assert: require('node:assert/strict'),
            require: (name: string) => name === '../supabase-pg.js' ? { createPgHarness: (got: any) => {
                options = got; return { unavailableReason: () => null, start: async () => { throw stop; } };
            } } : require(name)
        });
        await expect(setup()).rejects.toBe(stop);
        expect(options.depsDirs).toEqual(['/explicit', '/measure/supabase/node_modules', '/real-repository/supabase/node_modules']);
        expect(options.wantMajor).toBe(17);
    });
});


describe('Postgres scan rules៖ អត្តសញ្ញាណ fixture ត្រូវនឹង schema ពិត', () => {
    const file = readFileSync('../audit-tools/emu/scan-operation-rules-test.js', 'utf8');
    const migration = readFileSync('../supabase/migrations/20260930120000_zoe_tenancy.sql', 'utf8');
    const pattern = migration.match(/username text not null unique check \(username ~ '([^']+)'\)/)?.[1];
    it('seed actor ទាំងពីរឆ្លង username constraint និងរក្សា actor ដាច់ពីគ្នា', async () => {
        expect(pattern).toBeTruthy();
        const valid = new RegExp(pattern!);
        const members: unknown[][] = [], emails: string[] = [];
        const start = file.indexOf('    const tenant = (await pgConnection.query(');
        const end = file.indexOf('    let sequence = 0;', start);
        expect(start).toBeGreaterThan(0); expect(end).toBeGreaterThan(start);
        const seed = runInNewContext('(async () => {\n' + file.slice(start, end) + '\nreturn { user, foreignUser }; })', {
            pgConnection: { query: async (sql: string, args?: unknown[]) => {
                if (sql.startsWith('insert into public.tenants ')) return { rows: [{ id: 'tenant-test' }] };
                expect(sql).toContain('insert into public.tenant_members');
                expect(args).toHaveLength(3); expect(valid.test(String(args![2]))).toBe(true);
                members.push(args!); return { rows: [] };
            } },
            pgHarness: { makeAuthUser: async (_connection: unknown, email: string) => {
                emails.push(email); return 'user-' + emails.length;
            } }
        });
        const identities = await seed();
        expect(identities.user).not.toBe(identities.foreignUser);
        expect(members.map(row => row[0])).toEqual([identities.user, identities.foreignUser]);
        expect(members.map(row => row[1])).toEqual(['tenant-test', 'tenant-test']);
        expect(new Set(members.map(row => row[2])).size).toBe(2);
        expect(emails.map(email => email.split('@')[0])).toEqual(members.map(row => row[2]));
    });
    it('ទិសផ្ទុយ៖ ឈ្មោះចាស់មានសហសញ្ញា និងតម្លៃក្រៅព្រំដែននៅតែបដិសេធ', () => {
        expect(pattern).toBeTruthy();
        const valid = new RegExp(pattern!);
        for (const invalid of ['scan-rules', 'scan-foreign', 'ab', 'a'.repeat(33), 'Upper', 'with space']) expect(valid.test(invalid)).toBe(false);
        for (const accepted of ['scan_rules', 'scan_foreign', 'a'.repeat(32)]) expect(valid.test(accepted)).toBe(true);
    });
});


describe('Postgres scan bridge៖ rules denial ខុសពី infrastructure', () => {
    it('ទទួលតែ code/message ជាក់លាក់ពី canonical RPC ហើយរក្សា oracle unchanged-state', () => {
        const file = readFileSync('../audit-tools/emu/scan-operation-rules-test.js', 'utf8');
        const from = file.indexOf('function isPostgresRulesDenial('), to = file.indexOf('async function setupPostgres()', from);
        const classify = runInNewContext(file.slice(from, to) + '\nisPostgresRulesDenial;');
        expect(classify({ error: { code: '42501', message: 'permission_denied', detail: 'zoew_scan_operations/fixture' } })).toBe(true);
        for (const result of [null, {}, { error: null }, ...[
            ['42501', 'permission denied for table zoe_docs'], ['42501', 'forbidden'], ['42501', 'shop-inactive'],
            ['42501', 'permission_denied extra'], ['P0001', 'permission_denied'], ['ECONNREFUSED', 'permission_denied'],
            ['08006', 'connection failure'], ['57014', 'canceling statement due to timeout']
        ].map(([code, message]) => ({ error: { code, message } }))]) expect(classify(result)).toBe(false);
        const migration = readFileSync('../supabase/migrations/20261025025905_zoe_quota_cleanup.sql', 'utf8');
        expect(migration).toContain("raise exception 'permission_denied' using errcode = '42501', detail = array_to_string(loc_path, '/')");
        expect(file).toContain("if (!isPostgresRulesDenial(result)) throw new Error('Postgres មិនមែន rules denial:");
        expect(file).toContain("if (!allow) assert.deepEqual(after, before,");
        expect(file).toContain("assert.equal(result.status === 200, allow,");
    });
});
