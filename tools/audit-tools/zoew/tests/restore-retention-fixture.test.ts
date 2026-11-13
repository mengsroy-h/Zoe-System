// @vitest-environment node
import fs, { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { beforeAll, afterAll, expect, it } from 'vitest';
import { parse } from 'acorn';

// ការវាស់ source + transport ក្នុងសតិ។ មិនវាស់ Firebase rules ឬ emulator។
const sourceRoot = path.resolve(process.env.RESTORE_FIXTURE_ROOT || '..');
let appRoot = process.env.RESTORE_FIXTURE_APP_DIR ? path.resolve(process.env.RESTORE_FIXTURE_APP_DIR) : '';
let temporary = false;
beforeAll(() => {
    if (appRoot) return;
    const root = path.resolve('..');
    appRoot = fs.mkdtempSync(path.resolve('.tmp-restore-clock-')); temporary = true;
    const build = fs.readFileSync('../tools/audit-tools/zoew/scripts/build-audit.mjs', 'utf8');
    const stop = build.indexOf('/* ២. សំបកពិត');
    expect(stop).toBeGreaterThan(0);
    const prefix = build.slice(0, stop).replace("const OUT = path.join(ROOT, 'dist-audit');", () => 'const OUT = ' + JSON.stringify(appRoot) + ';');
    const script = path.resolve('../tools/audit-tools/zoew/scripts', path.basename(appRoot) + '.mjs');
    try {
        fs.writeFileSync(script, prefix);
        const result = spawnSync(process.execPath, [script], { cwd: path.join(root, 'ZoeW'), encoding: 'utf8', timeout: 30000 });
        expect(result.status, result.stdout + result.stderr).toBe(0);
        expect(fs.existsSync(path.join(appRoot, 'ZoeW/index.html'))).toBe(false);
    } finally { fs.rmSync(script, { force: true }); }
}, 40000);
afterAll(() => { if (temporary) fs.rmSync(appRoot, { recursive: true, force: true }); });
const filename = path.join(sourceRoot, 'tools/audit-tools/emu/restore-mutation-emu-test.js');
const source = readFileSync(filename, 'utf8');
const parsed: any = parse(source, { ecmaVersion: 'latest', sourceType: 'script' });
const main = parsed.body.find((node: any) => {
    let expression = node.expression;
    while (expression?.callee?.type === 'MemberExpression') expression = expression.callee.object;
    return expression?.callee?.type === 'ArrowFunctionExpression';
});
expect(main).toBeDefined();
const clone = (value: any) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
function lab() {
    let store: any = {};
    const checks: any[] = [];
    function get(node: string) { let v = store; for (const key of node.split('/').filter(Boolean)) v = v?.[key]; return v ?? null; }
    function put(node: string, val: any) {
        const keys = node.split('/').filter(Boolean); if (!keys.length) { store = clone(val); return; }
        let cur = store; for (const key of keys.slice(0, -1)) cur = cur[key] ??= {};
        if (val === null) delete cur[keys.at(-1)!]; else cur[keys.at(-1)!] = clone(val);
    }
    const localRequire = createRequire(filename), depRequire = createRequire(path.resolve('package.json'));
    const helpers = new Map();
    const loadHelper = (id: string) => {
        if (helpers.has(id)) return helpers.get(id);
        const file = path.join(sourceRoot, 'tools/audit-tools', id + '.js');
        const helperRequire: any = (target: string) => target === './react-view' ? loadHelper('react-view') : depRequire(target);
        helperRequire.resolve = (target: string) => depRequire.resolve(target);
        const exports = new Function('require', 'module', '__dirname', readFileSync(file, 'utf8') + '\nreturn module.exports;')(
            helperRequire, { exports: {} }, path.dirname(file));
        helpers.set(id, exports); return exports;
    };
    const context: any = vm.createContext({ console, setTimeout, clearTimeout, queueMicrotask, Buffer, __dirname: path.dirname(filename),
        require: (id: string) => { if (id === '../react-view' || id === '../audit-module-ast') return loadHelper(id.slice(3)); try { return localRequire(id); } catch (error: any) { if (error.code !== 'MODULE_NOT_FOUND' || id.startsWith('.')) throw error; return depRequire(id); } },
        process: { env: { RESTOREMUTATION_APP_DIR: appRoot }, pid: process.pid, exitCode: 0 } });
    vm.runInContext(source.slice(0, main.start), context, { filename });
    context.check = (pass: boolean, label: string, detail: any) => checks.push({ pass, label, detail });
    context.request = async (method: string, node: string, body: any) => {
        if (method === 'PUT') put(node, body);
        else if (method === 'PATCH') for (const [key, value] of Object.entries(body)) {
            const loc = node + '/' + key, inc = (value as any)?.['.sv']?.increment;
            put(loc, typeof inc === 'number' ? Number(get(loc) || 0) + inc : value);
        }
        else if (method !== 'GET') throw new Error('Unexpected transport method: ' + method);
        return { status: 200, value: clone(get(node)), etag: 'memory' };
    };
    return { context, checks, get: () => clone(store) };
}
it.each(['closed', 'open', 'occupied', 'occupied closed', 'fresh'])('%s៖ scenario ពិត រក្សា៧ថ្ងៃគត់ រួចដកតែម្តងពេលលើស', async mode => {
    const { context, checks } = lab(); await context.retentionScenario(mode);
    expect(checks.length).toBe(9); expect(checks.filter(c => !c.pass)).toEqual([]);
}, 20000);
it.each(['untrusted', 'pending', 'getter-only'])('clock/session %s មិនអាចដកកញ្ចប់ ឬប្រាក់', async defect => {
    const { context, get } = lab();
    const row = context.seedItem(); delete row.deletedAt; delete row.trashReason;
    row.barcodes[0].isDeducted = false; row.barcodes[0].restoredAt = vm.runInContext('NOW', context);
    row.createdAt -= 9 * 86400000;
    await context.request('PUT', '/', { zoew_scan_history_cod_dod: { [row.id]: row }, zoew_recently_deleted_cod_dod: {},
        zoew_daily_revenue_cod_dod: { '2026-09-08': { codDollar: 10, dodDollar: 2, totalCount: 1 } },
        zoew_monthly_revenue_cod_dod: { '2026-09': { codDollar: 10, dodDollar: 2, totalCount: 1 } } });
    const client = context.tab('negative', undefined, true); await client.sync(); const before = get();
    const next = vm.runInContext('NOW + 7 * 86400000 + 1', context);
    if (defect === 'getter-only') client.context.getServerNow = () => next;
    else {
        client.setTime(next);
        if (defect === 'untrusted') client.context.resetServerClock();
        else client.context.sessionExpiryCheck = 'pending';
    }
    await client.context.claimAndCleanupItem(row.id, 'abandon'); await client.settle();
    expect(get()).toEqual(before);
}, 20000);
