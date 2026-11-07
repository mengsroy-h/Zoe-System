import fs from 'node:fs';
import os from 'node:os';
import vm from 'node:vm';
import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import { expect, it } from 'vitest';

it('actual module runtime preserves private scopes and rejects invalid public bindings', () => {
    const output = execFileSync(process.execPath, [path.resolve('../audit-tools/module-runtime-scope-test.js')], {
        encoding: 'utf8', env: { ...process.env, NODE_PATH: path.resolve('node_modules') }
    });
    expect(output).toContain('PASS moduleRuntime explicit scopes');
});


it('module runtime checker ៖ override វាស់ helper ពិតក្នុង tree ដែលបានជ្រើស មិនអាន tree បច្ចុប្បន្នជំនួស', () => {
    const target = fs.mkdtempSync(path.join(os.tmpdir(), 'runtime-target-'));
    const script = path.resolve('../audit-tools/module-runtime-scope-test.js');
    const run = () => spawnSync(process.execPath, [script], { encoding: 'utf8', env: { ...process.env,
        NODE_PATH: path.resolve('node_modules'), MODULE_RUNTIME_SCOPE_APP_DIR: target } });
    try {
        const empty = run();
        expect(empty.status).not.toBe(0); expect(empty.stderr).toContain(target);
        fs.mkdirSync(path.join(target, 'audit-tools'));
        const helper = fs.readFileSync('../audit-tools/react-view.js', 'utf8');
        fs.writeFileSync(path.join(target, 'audit-tools/react-view.js'), helper);
        expect(run().status).toBe(0);
        const guard = "if (names.has(name)) throw new Error('moduleRuntime: duplicate module binding ' + name);";
        expect(helper).toContain(guard);
        fs.writeFileSync(path.join(target, 'audit-tools/react-view.js'), helper.replace(guard, ''));
        const mutant = run();
        expect(mutant.status).not.toBe(0); expect(mutant.stderr).toContain('Missing expected exception');
    } finally { fs.rmSync(target, { recursive: true, force: true }); }
});

it('coverage ៖ helper គ្មាន assertion មិនមែន checker ហើយ runtime checker ភ្ជាប់ពីរផ្លូវពិត', () => {
    const source = fs.readFileSync('../audit-tools/checker-coverage.js', 'utf8');
    const begin = source.indexOf('const NOT_CHECKERS =');
    const end = source.indexOf('const CLI_GUARDS =');
    const excluded = vm.runInNewContext(source.slice(begin, end) + '; NOT_CHECKERS');
    expect(excluded.has('audit-module-ast.js')).toBe(true);
    expect(excluded.has('module-runtime-scope-test.js')).toBe(false);
    const runner = fs.readFileSync('../audit-tools/run-all.sh', 'utf8');
    const baseline = runner.indexOf('if [ -n "$BASE" ]');
    expect(runner.slice(0, baseline)).toContain('run "module-runtime-scope" node audit-tools/module-runtime-scope-test.js');
    expect(runner.slice(baseline)).toContain('MODULE_RUNTIME_SCOPE_APP_DIR="$BASE" node audit-tools/module-runtime-scope-test.js');
});

it('runtime Lookup ប្រើ helper ពិត ហើយការប្តូរ config/key/session បិទវគ្គចាស់', () => {
    const script = `
        import { createRequire } from 'node:module';
        import fs from 'node:fs'; import vm from 'node:vm'; import assert from 'node:assert/strict';
        import { moduleView, aliasStateFields } from './scripts/checker-view.mjs';
        const require = createRequire(import.meta.url);
        const { reactRuntime, memoryStorage } = require('../audit-tools/react-view.js');
        const groups = JSON.parse(fs.readFileSync('src/_generated-state.json', 'utf8'));
        const source = ['src/core/store.ts', 'src/core/state.ts', 'src/core/storage.ts', 'src/services/connection-flow.ts', 'src/services/lookup-operation.ts']
            .map(file => aliasStateFields(moduleView(fs.readFileSync(file, 'utf8'), file), groups).text).join('\\n');
        for (const change of ['config', 'key', 'session']) {
            const storage = memoryStorage({ zoew_lookup_api_config: 'fixture-A' });
            const ctx = vm.createContext({ auth: { currentUser: { uid: 'fixture-user' } }, db: {}, fb: {}, authGeneration: 1,
                lookupSecretKey: null, localStorage: storage, window: { localStorage: storage } });
            vm.runInContext(reactRuntime(source, { context: ctx }), ctx);
            vm.runInContext('globalThis.operation = captureLookupOperation()', ctx);
            assert.equal(vm.runInContext('operation.current()', ctx), true);
            if (change === 'config') storage.setItem('zoew_lookup_api_config', 'fixture-B');
            if (change === 'key') ctx.lookupSecretKey = {};
            if (change === 'session') ctx.authGeneration++;
            assert.equal(vm.runInContext('operation.current()', ctx), false);
            assert.throws(() => vm.runInContext('operation.assertCurrent()', ctx), /Lookup session changed/);
        }
        console.log('PASS actual lookup ownership runtime');
    `;
    const output = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
        encoding: 'utf8', env: { ...process.env, NODE_PATH: path.resolve('node_modules') }
    });
    expect(output).toContain('PASS actual lookup ownership runtime');
});
