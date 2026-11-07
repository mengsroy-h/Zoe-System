import * as fs from 'node:fs';
import * as path from 'node:path';
import { tmpdir } from 'node:os';
import { execFile, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const root = path.resolve('..');
const tools = path.join(root, 'audit-tools');
const coverage = fs.readFileSync(path.join(tools, 'checker-coverage.js'), 'utf8');
const integrity = fs.readFileSync(path.join(tools, 'exit-code-integrity.js'), 'utf8');
const runall = fs.readFileSync(path.join(tools, 'run-all.sh'), 'utf8');
const moduleName = 'server-time-function-test.mjs';
const modulePath = path.join(tools, moduleName);
const moduleSource = fs.readFileSync(modulePath, 'utf8');
const runnableNames = runInNewContext(coverage.slice(coverage.indexOf('function runnableNames('), coverage.indexOf('const baselineAt =')) + '\nrunnableNames;', {});
const discover = (source: string) => runInNewContext(integrity.slice(integrity.indexOf('function checkersFromRunAll('), integrity.indexOf('const checkers =')) + '\ncheckersFromRunAll();', {
    fs: { existsSync: fs.existsSync, readFileSync: () => source }, path,
    RUNALL: path.join(tools, 'run-all.sh'), TOOLS: tools, ZTO_IMPORT_TEST: '../zto-import/test.js'
});
const poison = runInNewContext(integrity.slice(integrity.indexOf('const POISON ='), integrity.indexOf('function durationMs(')) + '\npoisonSource;', { acorn: require('acorn') });
const execute = (file: string, appRoot = root) => {
    const result = spawnSync(process.execPath, ['--test-reporter=tap', file], {
        cwd: root, env: { ...process.env, LICENSETIME_APP_DIR: appRoot }, encoding: 'utf8', timeout: 15000
    });
    expect(result.error).toBeUndefined();
    expect(result.signal).toBeNull();
    expect(result.status).not.toBeNull();
    return { code: result.status, output: result.stdout + '\n' + result.stderr };
};

describe('meta-checker៖ ម៉ូឌុល .mjs មិនរអិលចេញពីការវាស់', () => {
    it('រត់ឈ្មោះពិត .js និង .mjs ដោយមិនរាប់ .bak', () => {
        const source = runall + '\nrun "backup" node audit-tools/server-time-function-test.mjs.bak\nrun "backup" node audit-tools/exit-code-integrity.js.bak\n';
        const names = runnableNames(source);
        expect(names.has('server-time-function-test')).toBe(true);
        expect(names.has('exit-code-integrity')).toBe(true);
        expect([...names].some(name => String(name).endsWith('.bak'))).toBe(false);
        const backups = 'run "backup" node audit-tools/server-time-function-test.mjs.bak\nrun "backup" node audit-tools/exit-code-integrity.js.bak\n';
        expect([...runnableNames(backups)]).toEqual([]);
        expect(discover(backups)).toEqual([]);
    });

    it('exit-code-integrity រកឃើញ checker .mjs ដែល run-all រត់ពិត', () => {
        expect(discover(runall)).toContain(moduleName);
        expect(discover(runall)).toContain('checker-coverage.js');
    });

    it('រង្វិលជុំ .mjs រកឃើញឯកសារពិត និងរក្សា extension', () => {
        const loop = 'for t in server-time-function-test; do\nrun "$t" node "audit-tools/$t.mjs"\ndone';
        expect([...runnableNames(loop)]).toEqual(['server-time-function-test']);
        expect([...runnableNames(loop, true)]).toEqual([moduleName]);
        expect(discover(loop)).toEqual([moduleName]);
    });

    it('រង្វិលជុំ .js នៅតែរកឃើញឯកសារពិត និងមិនបម្លែងទៅ .mjs', () => {
        const loop = 'for t in checker-coverage; do\nrun "$t" node "audit-tools/$t.js"\ndone';
        expect([...runnableNames(loop)]).toEqual(['checker-coverage']);
        expect([...runnableNames(loop, true)]).toEqual(['checker-coverage.js']);
        expect(discover(loop)).toEqual(['checker-coverage.js']);
    });

    it('រង្វិលជុំដែលមិនរត់ checker មិនត្រូវរាប់ក្នុង discovery', () => {
        for (const body of ['echo "$t"', '# run "$t" node "audit-tools/$t.js"', 'echo "audit-tools/$t.js"']) {
            const loop = 'for t in checker-coverage server-time-function-test; do\n' + body + '\ndone';
            expect([...runnableNames(loop)]).toEqual([]);
            expect(discover(loop)).toEqual([]);
        }
    });

    it('ការភ្ជាប់ normal មិនទទួល .js ជំនួស .mjs ឬផ្ទុយមកវិញ', () => {
        const wiring = runInNewContext(coverage.slice(coverage.indexOf('function wiringFailures('), coverage.indexOf('const topCheckers =')) + '\nwiringFailures;', { runnableNames });
        for (const extension of ['js', 'mjs']) {
            const file = 'fixture-test.' + extension;
            const other = 'fixture-test.' + (extension === 'js' ? 'mjs' : 'js');
            const entries = new Map([[file, 'FIXTURE_APP_DIR']]);
            const baseline = 'FIXTURE_APP_DIR="$BASE" node audit-tools/' + file;
            expect(wiring(entries, 'run "fixture" node audit-tools/' + file, baseline)).toEqual([]);
            expect(wiring(entries, 'run "fixture" node audit-tools/' + other, baseline)).toEqual([file + ' (normal)']);
        }
    });

    it('ស្កេនថតពិតរួមបញ្ចូល .mjs និងមិនរាប់ឯកសារស្រមោល', () => {
        const declaration = coverage.slice(coverage.indexOf('const topCheckers ='), coverage.indexOf('.sort();', coverage.indexOf('const topCheckers =')) + '.sort();'.length);
        const found = runInNewContext(declaration + '\ntopCheckers;', {
            fs: { readdirSync: () => [moduleName, 'control-test.js', moduleName + '.bak', 'control-test.js.bak', '.tmp-poison-control.mjs'] },
            TOOLS: tools, NOT_CHECKERS: new Set()
        });
        expect([...found]).toEqual(['control-test.js', moduleName]);
    });

    it('checker .mjs ពិតបដិសេធថតទទេ មិនរាយការណ៍ជោគជ័យ ឬ SKIP', async () => {
        const empty = fs.mkdtempSync(path.join(tmpdir(), 'zoe-meta-empty-'));
        try {
            const probe = runInNewContext(coverage.slice(coverage.indexOf('const SKIP_LINE ='), coverage.indexOf('const EMU_PORT =')) + '\nprobeCheckerOnEmpty;', {
                execFile, path, TOOLS: tools, SLOW: new Set(), process
            });
            expect(await probe(moduleName, 'LICENSETIME_APP_DIR', empty, false)).toEqual({
                f: moduleName, green: false, unmeasured: false, timedOut: false
            });
            const result = execute(modulePath, empty);
            expect(result.code).not.toBe(0);
            expect(result.output).toContain('ERR_MODULE_NOT_FOUND');
        } finally { fs.rmSync(empty, { recursive: true, force: true }); }
    });

    it('ពុល .mjs ក្រោយការអះអាងពិត៖ 34 តេស្តបញ្ចប់ ហើយ exit មិនសូន្យ', () => {
        const baseline = execute(modulePath);
        expect(baseline.code).toBe(0);
        expect(baseline.output).toMatch(/^# tests 34$/m);
        expect(baseline.output).toMatch(/^# pass 34$/m);
        expect(baseline.output).toMatch(/^# fail 0$/m);
        const poisoned = poison(moduleSource);
        expect(poisoned).not.toBeNull();
        const shadow = path.join(tools, '.tmp-poison-' + randomUUID() + '-server-time-function-test.mjs');
        try {
            fs.writeFileSync(shadow, poisoned, { flag: 'wx' });
            const result = execute(shadow);
            expect(result.code).toBe(1);
            expect(result.output).toContain('ZOE_EXITCODE_POISON_REACHED');
            expect(result.output).toMatch(/^# tests 34$/m);
            expect(result.output).toMatch(/^# pass 0$/m);
            expect(result.output).toMatch(/^# fail 34$/m);
            expect(result.output).toMatch(/^# cancelled 0$/m);
            expect(result.output).not.toMatch(/SyntaxError|ReferenceError|ERR_MODULE_NOT_FOUND/);
        } finally {
            fs.rmSync(shadow, { force: true });
            expect(fs.readFileSync(modulePath, 'utf8')).toBe(moduleSource);
        }
    });

    it('ការពុល .js នៅតែបង្កើតការធ្លាក់ដោយ assertion មិនមែន startup', () => {
        const source = 'let fail = 0; function ok(label, cond, detail) { if (!cond) fail++; }\nok("control", true); process.exit(fail ? 1 : 0);';
        const input = source.replace(' function ok', '\nfunction ok');
        let code: number | undefined;
        const context = { process: { exit: (value: number) => { code = value; } } };
        runInNewContext(input, context);
        expect(code).toBe(0);
        const poisoned = poison(input);
        expect(poisoned).not.toBeNull();
        runInNewContext(poisoned, { ...context });
        expect(code).toBe(1);
    });
});
