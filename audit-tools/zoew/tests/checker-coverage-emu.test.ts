import { afterEach, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const tools = path.join(repo, 'audit-tools');
const temporaryPaths: string[] = [];
afterEach(() => { for (const dir of temporaryPaths.splice(0)) fs.rmSync(dir, { recursive: true, force: true }); });
function temporary(prefix: string) { const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix)); temporaryPaths.push(dir); return dir; }
function write(file: string, text: string) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); }

function childEnv(extra: Record<string, string> = {}) {
    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
        if (value === undefined || /_STRICT$/.test(key) || /_APP_DIR$/.test(key)) continue;
        if (['EXITCODE_CHILD', 'NODE_OPTIONS', 'VITEST', 'VITEST_POOL_ID', 'VITEST_WORKER_ID'].includes(key)) continue;
        env[key] = value;
    }
    env.NODE_PATH = path.join(repo, 'ZoeW/node_modules');
    return Object.assign(env, extra);
}
function run(script: string, env: Record<string, string>) {
    const result = spawnSync(process.execPath, [script], { env, encoding: 'utf8', timeout: 120000, maxBuffer: 16 * 1024 * 1024 });
    return { status: result.status, out: String(result.stdout || '') + '\n' + String(result.stderr || '') };
}
function failBlocks(out: string) {
    const lines = out.split('\n'), blocks: string[] = [];
    for (let i = 0; i < lines.length; i++) {
        if (!/^\s*FAIL\b/.test(lines[i])) continue;
        let block = lines[i];
        for (let j = i + 1; j < lines.length && /^ {6,}\S/.test(lines[j]) && !/^\s*(ok|FAIL)\b/.test(lines[j]); j++) block += '\n' + lines[j];
        blocks.push(block);
    }
    return blocks;
}
const failsNaming = (out: string, name: string) => failBlocks(out).filter((block) => block.includes(name));
const skipLinesNaming = (out: string, name: string) => out.split('\n').filter((line) => /^\s*SKIP\b/.test(line) && line.includes(name));

function markingChecker(env: string, marker: string, body: string) {
    return "const fs = require('fs');\nconst path = require('path');\n"
        + 'const dir = process.env.' + env + " || path.join(__dirname, '../..');\n"
        + 'if (process.env.' + marker + ') fs.appendFileSync(process.env.' + marker + ", dir + '\\n');\n" + body;
}
const failingOnEmpty = "if (!fs.existsSync(path.join(dir, 'app.js'))) { console.log('  FAIL  app.js'); process.exit(1); }\nconsole.log('  ok    app.js');\n";

function copyCoverage(at: string) {
    for (const file of ['checker-coverage.js', 'owned-rtdb-command.js']) fs.copyFileSync(path.join(tools, file), path.join(at, file));
}

function poisonedCoverageTree() {
    const root = temporary('zoe-cc-emu-');
    const at = path.join(root, 'audit-tools');
    fs.mkdirSync(path.join(at, 'emu'), { recursive: true });
    copyCoverage(at);
    write(path.join(at, 'emu', 'good-test.js'), markingChecker('GOOD_APP_DIR', 'ZOE_FIXTURE_MARK', failingOnEmpty));
    write(path.join(at, 'emu', 'green-test.js'), markingChecker('GREEN_APP_DIR', 'ZOE_FIXTURE_MARK', "console.log('  ok    always');\n"));
    write(path.join(at, 'emu', 'skip-test.js'), markingChecker('SKIPPY_APP_DIR', 'ZOE_FIXTURE_MARK', "console.log('SKIP — no RTDB emulator');\n"));
    write(path.join(at, 'emu', 'noenv-test.js'), "if (!require('fs').existsSync('app.js')) process.exit(1);\nconsole.log('  ok    cwd');\n");
    write(path.join(at, 'emu', 'nobase-test.js'), markingChecker('NOBASE_APP_DIR', 'ZOE_FIXTURE_MARK', failingOnEmpty));
    write(path.join(at, 'emu', 'midline-test.js'), markingChecker('MIDLINE_APP_DIR', 'ZOE_FIXTURE_MARK',
        failingOnEmpty + "console.log('  ok    rules — SKIP emulator part');\n"));
    write(path.join(at, 'emu', 'hardexit-test.js'), markingChecker('HARDEXIT_APP_DIR', 'ZOE_FIXTURE_MARK',
        "if (!fs.existsSync(path.join(dir, 'app.js'))) { console.log('FAIL — fn មិនមានក្នុង app.js'); process.exit(1); }\n"));
    write(path.join(at, 'emu', 'pageerror-test.js'), markingChecker('PAGEERR_APP_DIR', 'ZOE_FIXTURE_MARK',
        failingOnEmpty + "function attach(page) { page.on('pageerror', () => {}); return page.goto('about:blank'); }\nvoid attach;\n"));
    write(path.join(at, 'emu', 'orphan-test.js'), markingChecker('ORPHAN_APP_DIR', 'ZOE_FIXTURE_MARK', failingOnEmpty));
    const names = ['good', 'green', 'skip', 'noenv', 'nobase', 'midline', 'hardexit', 'pageerror'];
    const envs: Record<string, string> = { good: 'GOOD', green: 'GREEN', skip: 'SKIPPY', midline: 'MIDLINE', hardexit: 'HARDEXIT', pageerror: 'PAGEERR' };
    write(path.join(at, 'run-all.sh'), '#!/bin/bash\n'
        + names.map((n) => 'run "emu/' + n + '" node audit-tools/emu/' + n + '-test.js').join('\n')
        + '\nif [ -n "$BASE" ]; then\n'
        + Object.keys(envs).map((n) => '    ' + envs[n] + '_APP_DIR="$BASE" runall_owned node audit-tools/emu/' + n + '-test.js').join('\n')
        + '\nfi\n');
    return { root, at };
}

it('checker-coverage applies its *_APP_DIR, wiring, empty-tree, hard-exit and SKIP rules to emu/ checkers run by run-all', () => {
    const { root, at } = poisonedCoverageTree();
    const mark = path.join(root, 'probed.txt');
    const plain = run(path.join(at, 'checker-coverage.js'), childEnv({ ZOE_FIXTURE_MARK: mark }));
    expect(plain.status).not.toBe(0);
    expect(failsNaming(plain.out, 'emu/noenv-test.js').length, plain.out).toBeGreaterThan(0);
    expect(failsNaming(plain.out, 'emu/nobase-test.js (baseline)').length, plain.out).toBeGreaterThan(0);
    expect(failsNaming(plain.out, 'emu/green-test.js').length, plain.out).toBeGreaterThan(0);
    expect(failsNaming(plain.out, 'emu/hardexit-test.js').length, plain.out).toBeGreaterThan(0);
    expect(failsNaming(plain.out, 'emu/midline-test.js').length, plain.out).toBeGreaterThan(0);
    expect(failsNaming(plain.out, 'emu/pageerror-test.js').length, plain.out).toBeGreaterThan(0);
    expect(failsNaming(plain.out, 'emu/orphan-test.js').length, plain.out).toBeGreaterThan(0);
    expect(skipLinesNaming(plain.out, 'emu/skip-test.js').length, plain.out).toBe(1);
    expect(failsNaming(plain.out, 'emu/skip-test.js')).toEqual([]);
    expect(failsNaming(plain.out, 'emu/good-test.js'), plain.out).toEqual([]);
    const probed = fs.existsSync(mark) ? fs.readFileSync(mark, 'utf8').split('\n').filter(Boolean) : [];
    expect(probed.length, plain.out).toBeGreaterThanOrEqual(5);
    for (const dir of probed) expect(dir, plain.out).not.toBe(root);

    const strict = run(path.join(at, 'checker-coverage.js'), childEnv({ RUNALL_STRICT: '1' }));
    expect(strict.status).not.toBe(0);
    expect(failsNaming(strict.out, 'emu/skip-test.js').length, strict.out).toBeGreaterThan(0);
    expect(failsNaming(strict.out, 'emu/good-test.js'), strict.out).toEqual([]);
}, 120000);

it('a clean emu/ checker passes every extended checker-coverage rule while it is really probed on an empty tree', () => {
    const root = temporary('zoe-cc-emu-clean-');
    const at = path.join(root, 'audit-tools');
    fs.mkdirSync(path.join(at, 'emu'), { recursive: true });
    copyCoverage(at);
    write(path.join(at, 'emu', 'good-test.js'), markingChecker('GOOD_APP_DIR', 'ZOE_FIXTURE_MARK', failingOnEmpty));
    write(path.join(at, 'run-all.sh'), '#!/bin/bash\nrun "emu/good" node audit-tools/emu/good-test.js\n'
        + 'if [ -n "$BASE" ]; then\n    GOOD_APP_DIR="$BASE" runall_owned node audit-tools/emu/good-test.js\nfi\n');
    const mark = path.join(root, 'probed.txt');
    const result = run(path.join(at, 'checker-coverage.js'), childEnv({ ZOE_FIXTURE_MARK: mark, RUNALL_STRICT: '1' }));
    expect(failsNaming(result.out, 'good-test'), result.out).toEqual([]);
    expect(result.out.split('\n').filter((line) => /^\s*SKIP\b/.test(line)), result.out).toEqual([]);
    const probed = fs.existsSync(mark) ? fs.readFileSync(mark, 'utf8').split('\n').filter(Boolean) : [];
    expect(probed.length, result.out).toBe(1);
    expect(probed[0]).not.toBe(root);
}, 120000);

it('restore-deadlock reports an empty tree as a failure, never as an unreachable emulator SKIP', () => {
    const empty = temporary('zoe-deadlock-empty-');
    const result = spawnSync(process.execPath, [path.join(tools, 'emu', 'restore-deadlock-test.js')], {
        env: childEnv({ DEADLOCK_APP_DIR: empty }), encoding: 'utf8', timeout: 60000 });
    const out = String(result.stdout || '') + String(result.stderr || '');
    expect(result.status, out).not.toBe(0);
    expect(out.split('\n').filter((line) => /^\s*SKIP\b/.test(line)), out).toEqual([]);
}, 60000);

it('hang-guard scans emu/ checkers for unbounded waits and requires every emu checker run-all names', () => {
    const root = temporary('zoe-hg-emu-');
    const at = path.join(root, 'audit-tools');
    write(path.join(at, 'emu', 'clean-test.js'), "const server = { close(cb) { cb(); }, closeAllConnections() {} };\n"
        + 'async function stop() { server.closeAllConnections(); await new Promise((r) => { server.close(r); }); }\nvoid stop;\n');
    write(path.join(at, 'emu', 'hangy-test.js'), 'async function wait(navigator, server) {\n    await navigator.serviceWorker.ready;\n'
        + '    await new Promise((r) => { server.close(r); });\n}\nvoid wait;\n');
    write(path.join(at, 'run-all.sh'), '#!/bin/bash\nrun "emu/clean" node audit-tools/emu/clean-test.js\n'
        + 'run "emu/hangy" node audit-tools/emu/hangy-test.js\nrun "emu/ghost" node audit-tools/emu/ghost-test.js\n');
    const result = run(path.join(tools, 'hang-guard.js'), childEnv({ HANGGUARD_APP_DIR: root }));
    expect(result.status).not.toBe(0);
    const hangy = failsNaming(result.out, 'emu/hangy-test.js');
    expect(hangy.some((block) => /serviceWorker\.ready/.test(block)), result.out).toBe(true);
    expect(hangy.some((block) => /closeAllConnections/.test(block)), result.out).toBe(true);
    expect(failsNaming(result.out, 'emu/ghost-test.js').length, result.out).toBeGreaterThan(0);
    expect(failsNaming(result.out, 'emu/clean-test.js'), result.out).toEqual([]);
}, 120000);
