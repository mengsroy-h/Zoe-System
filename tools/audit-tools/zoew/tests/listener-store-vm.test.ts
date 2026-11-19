// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { moduleRuntime, memoryStorage, sliceFunction } = require('../../react-view.js');
const { localAuthRuntime } = require('../../local-auth-runtime.cjs');

it.each(['connection-state-fuzz-test.js', 'registry-release-test.js'])('%s ៖ listener ប្រែតាម store ពិត', async (checker) => {
    const { moduleView, aliasStateFields } = await import(pathToFileURL(path.resolve('../tools/audit-tools/zoew/scripts/checker-view.mjs')).href);
    const groups = JSON.parse(fs.readFileSync('src/_generated-state.json', 'utf8'));
    const modules = ['src/core/store.ts', 'src/core/storage.ts', 'src/core/shop-scope.ts',
        'src/features/login-memory.ts', 'src/services/local-logout-intent.ts', 'src/services/connection-flow.ts',
        'src/services/pickup-reset.ts', 'src/domain/barcode-key.ts', 'src/domain/registry.ts',
        'src/services/network.ts', 'src/services/db-listeners.ts', 'src/features/notifications.ts'];
    const views = Object.fromEntries(modules.map(name => [name,
        aliasStateFields(moduleView(fs.readFileSync(name, 'utf8'), name), groups).text]));
    const SRC = Object.values(views).join('\n');
    const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'zoe-listener-store-vm-'));
    try {
        fs.mkdirSync(path.join(ROOT, 'ZoeW'));
        fs.writeFileSync(path.join(ROOT, 'ZoeW/audit-module-views.json'), JSON.stringify(views));
        const checkerSource = fs.readFileSync(path.resolve('../tools/audit-tools', checker), 'utf8');
        const fuzz = checker === 'connection-state-fuzz-test.js';
        const name = fuzz ? 'makeWorld' : 'makeCtx';
        const factorySource = sliceFunction(checkerSource, name);
        expect(factorySource).toBeTruthy();
        const names = vm.runInNewContext(checkerSource.match(new RegExp('const ' + (fuzz ? 'FNS' : 'REQUIRED') + ' = (\\[[\\s\\S]*?\\]);'))?.[1] || '[]') as string[];
        expect(names.length).toBeGreaterThan(5);
        const sliceFn = (fn: string) => {
            const body = sliceFunction(SRC, fn);
            expect(body, fn).toBeTruthy();
            return body;
        };
        const factory = vm.runInNewContext('(' + factorySource + ')', {
            SRC, ROOT, vm, moduleRuntime, memoryStorage, queueMicrotask, setTimeout, clearTimeout, console,
            FNS: names, sliceFn, fnSrc: Object.fromEntries(names.map(fn => [fn, sliceFn(fn)])),
            registryAuthRuntime: localAuthRuntime(ROOT, SRC)
        });
        const result = factory(() => Promise.resolve());
        const ctx = fuzz ? result.ctx : result;
        if (!fuzz) {
            vm.runInContext(`
                var dbListenerPendingPaths = new Set(['history']);
                var dbListenerFailedPaths = new Set();
                var dbListenerReportedFailures = new Set();
                var dbListenersFailed = false;
                var dbListenerProgressAt = 0;
                var dbListenerPendingSeen = 0;
                function refreshLiveToasts() {}
                function renderConnectionStatus() {}
                ${sliceFn('noteDbListenerAlive')}
            `, ctx);
        }
        vm.runInContext(`globalThis.notifications = 0;
            firebaseState.subscribe(() => { notifications++; });
            globalThis.before = firebaseState.version();`, ctx);
        if (fuzz) vm.runInContext("handleDbListenerError(new Error('fixture'), 'history');", ctx);
        else vm.runInContext("noteDbListenerAlive('history');", ctx);
        expect(vm.runInContext('firebaseState.version() > before', ctx)).toBe(true);
        await new Promise<void>(resolve => queueMicrotask(resolve));
        expect(ctx.notifications).toBe(1);
        if (fuzz) {
            expect(vm.runInContext('uiState.notifyView.measurable', ctx)).toBe(false);
            expect(vm.runInContext("dbListenerFailedPaths.has('history')", ctx)).toBe(true);
            fs.writeFileSync(path.join(ROOT, 'ZoeW/app.js'), SRC);
            const integrity = fs.readFileSync(path.resolve('../tools/audit-tools/exit-code-integrity.js'), 'utf8');
            const poison = vm.runInNewContext(integrity.slice(integrity.indexOf('const POISON ='), integrity.indexOf('function durationMs(')) + '\npoisonSource;');
            const verdict = vm.runInNewContext(integrity.slice(integrity.indexOf('function poisonVerdict('), integrity.indexOf('\n{\n    const cases', integrity.indexOf('function poisonVerdict('))) + '\npoisonVerdict;');
            const poisoned = poison(checkerSource);
            expect(poisoned).toBeTruthy();
            const shadow = path.resolve('../tools/audit-tools', '.tmp-poison-' + process.pid + '-' + path.basename(ROOT) + '.js');
            fs.writeFileSync(shadow, poisoned);
            try {
                const out = spawnSync(process.execPath, [shadow], {
                    encoding: 'utf8', timeout: 10000,
                    env: { ...process.env, CONNFUZZ_APP_DIR: ROOT, EXITCODE_CHILD: '1' }
                });
                expect(verdict({ code: out.status, signal: out.signal, timedOut: !!out.error, out: out.stdout + out.stderr }), out.stdout + out.stderr).toBe('failed');
            } finally { fs.rmSync(shadow, { force: true }); }
        } else expect(vm.runInContext("dbListenerPendingPaths.has('history')", ctx)).toBe(false);
    } finally { fs.rmSync(ROOT, { recursive: true, force: true }); }
});
