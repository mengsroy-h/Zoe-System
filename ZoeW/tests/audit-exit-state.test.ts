import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';

const require = createRequire(import.meta.url);
const guard = readFileSync('../audit-tools/exit-code-integrity.js', 'utf8');
const poison = runInNewContext(guard.slice(guard.indexOf('const POISON ='), guard.indexOf('function durationMs(')) + '\npoisonSource;', {});
const files = ['scan-operation-sdk', 'trash-generation-sdk', 'cleanup-consumed-sdk', 'empty-delete-sdk'];

describe('SDK checker៖ លទ្ធផលបរាជ័យពិតកំណត់ exit code', () => {
    it.each(files)('%s៖ success, assertion, cleanup និង poison មិនបង្កើត false green', async file => {
        const source = readFileSync('../audit-tools/emu/' + file + '-test.js', 'utf8');
        const tail = source.slice(source.lastIndexOf('})().catch('));
        expect(tail).toContain('.finally(() => process.exit(failed ? 1 : 0))');
        expect(source).not.toMatch(/process\.exit\(0\)/);
        const declaration = source.match(/^let failed = 0;$/m)?.[0];
        expect(declaration).toBeTruthy();
        for (const mode of ['success', 'assertion', 'cleanup', 'poisoned-success', 'assertion-cleanup']) {
            let exit: number | undefined;
            let cleanupCalls = 0;
            let script = declaration + '\n(async () => {\n'
                + (mode.includes('assertion') ? 'assert.equal(1, 2);\n' : '')
                + (mode === 'cleanup' ? 'await deleteApp(apps[0]);\n' : '')
                + tail;
            if (mode === 'poisoned-success') script = poison(script);
            expect(script).not.toBeNull();
            const result = runInNewContext(script, {
                assert: require('node:assert/strict'), apps: [{}],
                deleteApp: async () => { cleanupCalls++; if (mode.includes('cleanup')) throw new Error('cleanup failed'); },
                console: { error: () => {} }, process: { exit: (code: number) => { exit = code; } }
            });
            await result;
            expect(exit, mode).toBe(mode === 'success' ? 0 : 1);
            if (mode.includes('cleanup')) expect(cleanupCalls).toBeGreaterThan(0);
        }
    });
});


describe('poison queues៖ Postgres ធ្ងន់នៅដាច់ដោយឡែក បន្ទាប់មកគ្រប់ job នៅដដែល', () => {
    const selectors = guard.slice(guard.indexOf('const SERIAL_LANE ='), guard.indexOf('const OUT_CAP ='));
    const functions = guard.slice(guard.indexOf('async function runPool('), guard.indexOf('function checkerBrowserDependency('));
    const run = runInNewContext(selectors + functions + '\nrunPoisonQueues;', {});
    it('គ្មានការប្រជែងនឹង PG · គ្មាន job រំលង ឬស្ទួន · emu តាមជួរ', async () => {
        const jobs = ['normal-a', 'emu/first', 'supabase-datastore-test.js', 'normal-b', 'emu/second'];
        const events: string[] = [];
        await run(jobs, 3, async (job: string) => { events.push('start:' + job); await Promise.resolve(); events.push('end:' + job); });
        expect(events.slice(0, 2)).toEqual(['start:supabase-datastore-test.js', 'end:supabase-datastore-test.js']);
        expect(events).toHaveLength(jobs.length * 2);
        for (const job of jobs) {
            expect(events.filter(event => event === 'start:' + job)).toHaveLength(1);
            expect(events.filter(event => event === 'end:' + job)).toHaveLength(1);
        }
        expect(events.indexOf('end:emu/first')).toBeLessThan(events.indexOf('start:emu/second'));
        expect(events.indexOf('start:normal-b')).toBeLessThan(events.indexOf('end:normal-a'));
        expect(jobs).toEqual(['normal-a', 'emu/first', 'supabase-datastore-test.js', 'normal-b', 'emu/second']);
    });
    it.each([1, 2, 4])('width=%s៖ ប្រើកន្លែងទំនេរ និងគោរពពិដានពេល emu ចប់មុន', async width => {
        const jobs = ['emu/first', ...Array.from({ length: 6 }, (_, i) => 'normal-' + i), 'emu/second'];
        const active = new Map<string, () => void>();
        const seen: string[] = [];
        const pending = run(jobs, width, (job: string) => new Promise<void>(resolve => {
            active.set(job, () => { active.delete(job); resolve(); });
            seen.push(job);
        }));
        const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
        await flush();
        try {
            while (active.size) {
                expect(active.size).toBeLessThanOrEqual(width);
                expect([...active.keys()].filter(job => job.startsWith('emu/'))).toHaveLength(seen.includes('emu/second') && !active.has('emu/second') ? 0 : 1);
                const emu = [...active.keys()].find(job => job.startsWith('emu/'));
                const key = emu || [...active.keys()][0];
                active.get(key)!();
                await flush();
                const remaining = jobs.length - seen.length + active.size;
                expect(active.size).toBe(Math.min(width, remaining));
            }
            await pending;
            expect([...seen].sort()).toEqual([...jobs].sort());
        } finally {
            while (active.size) { for (const done of [...active.values()]) done(); await flush(); }
            await pending;
        }
    });
    it('គ្មាន PG ឬ job ទទេ នៅតែគោរព width និងមិនបង្កើត job ថ្មី', async () => {
        const events: string[] = [];
        await run([], 2, async (job: string) => { events.push(job); });
        expect(events).toEqual([]);
        await run(['only'], 1, async (job: string) => { events.push(job); });
        expect(events).toEqual(['only']);
        expect(guard).toContain("if (!r || r.timedOut || typeof r.code !== 'number') return 'unverified'");
    });
});

describe('poison budget៖ ថវិកាកូនតាម deadline ពិតរបស់ job មិនមែនលេខថេរ', () => {
    const helpers = guard.slice(guard.indexOf('function durationMs('), guard.indexOf('const DEADLINE_RESERVE_MS'))
        + guard.slice(guard.indexOf('function childBudgetMs('), guard.indexOf('\n{\n', guard.indexOf('function childBudgetMs(')));
    const budget = runInNewContext(helpers + '\n({ durationMs, runAllDefaultTimeout, childBudgetMs });', {});
    const runall = readFileSync('../audit-tools/run-all.sh', 'utf8');
    it('អាន DURATION ដូច timeout ហើយពិដានលំនាំដើមមកពី run-all.sh ពិត', () => {
        expect(guard).not.toMatch(/EXITCODE_TIMEOUT_MS \|\| '\d+'/);
        expect(budget.durationMs('300')).toBe(300000);
        expect(budget.durationMs('2m')).toBe(120000);
        expect(budget.durationMs('0')).toBeNull();
        expect(budget.durationMs('')).toBeNull();
        expect(budget.runAllDefaultTimeout(runall)).toBe(300000);
    });
    it('កូនយឺតទទួលពេលដែលនៅសល់រហូត deadline · ពិដានច្បាស់លាស់នៅគោរព', () => {
        expect(budget.childBudgetMs(0, 280000, null)).toBe(280000);
        expect(budget.childBudgetMs(66000, 280000, null)).toBeGreaterThan(84000);
        expect(budget.childBudgetMs(0, 280000, 4000)).toBe(4000);
        expect(budget.childBudgetMs(279000, 280000, 4000)).toBe(1000);
    });
    it('run-all ផ្តល់ deadline របស់ job ទៅ checker ហើយបំបែក meta-checker ជាផ្នែកដែលគ្រប់គ្នា', () => {
        const exec = runall.slice(runall.indexOf('runall_exec() {'), runall.indexOf('runall_judge() {'));
        expect(exec).toContain('export RUNALL_JOB_TIMEOUT="$CHECKER_TIMEOUT" RUNALL_JOB_STARTED_MS="$(runall_now_ms)"');
        for (let part = 1; part <= 4; part++) {
            expect(runall).toContain('run "exit-code-integrity ' + part + '/4 (meta)" node audit-tools/exit-code-integrity.js --part=' + part + '/4');
        }
    });
});


it('scan SDK cleanup៖ រំលងតែ app ដែល SDK បានលុបពិត មិនលាក់កំហុសថ្មី', async () => {
    const source = readFileSync('../audit-tools/emu/scan-operation-sdk-test.js', 'utf8');
    const end = source.indexOf('    await window.happyDOM.close();');
    const start = source.lastIndexOf('    for (const app of apps)', end);
    const code = source.slice(start, end);
    expect(code).toContain('getApps().includes(app)');
    const old = {}, live = {};
    const calls: object[] = [];
    const run = (reject: boolean) => runInNewContext('(async () => {' + code + '})()', {
        apps: [old, live], getApps: () => [live], deleteApp: async (app: object) => {
            calls.push(app); if (reject) throw new Error('real cleanup failure');
        }
    });
    await run(false); expect(calls).toEqual([live]);
    await expect(run(true)).rejects.toThrow('real cleanup failure');
    expect(calls).toEqual([live, live]);
});


describe('poison child៖ exit និង pipe មានពិដានដាច់ដោយឡែក', () => {
    function harness(spawnThrows = false, platform = 'darwin', procFs = {}) {
        const child = Object.assign(new EventEmitter(), {
            stdout: Object.assign(new EventEmitter(), { setEncoding: vi.fn(), destroy: vi.fn() }),
            stderr: Object.assign(new EventEmitter(), { setEncoding: vi.fn(), destroy: vi.fn() }),
            pid: 12345, kill: vi.fn(() => true)
        });
        const liveChildren = new Set();
        const source = guard.slice(guard.indexOf('function runPoisonedChild('), guard.indexOf('// ⛔⛔ **timeout'));
        const run = runInNewContext(source + '\nrunPoisonedChild;', {
            cp: { spawn: () => { if (spawnThrows) throw new Error('spawn ENOENT'); return child; } }, process: { execPath: 'node', env: {}, platform }, fs: procFs, Buffer, ROOT: '.',
            EXIT_GUARD_ARGS: [], OUT_CAP: 4096, EXIT_TO_CLOSE_GRACE_MS: 2000, HARD_GRACE_MS: 5000,
            liveChildren, Date, setTimeout, clearTimeout
        });
        const verdictSource = guard.slice(guard.indexOf('function poisonVerdict('), guard.indexOf('\n{\n', guard.indexOf('function poisonVerdict(')));
        const verdict = runInNewContext(verdictSource + '\npoisonVerdict;', {});
        return { child, liveChildren, run, verdict };
    }
    it.each([0, 1])('exit %s មុន deadline ហើយ pipe យឺត មិនក្លាយជា timeout', async code => {
        vi.useFakeTimers();
        try {
            const { child, liveChildren, run, verdict } = harness();
            const result = run('fixture', 100);
            child.emit('spawn');
            child.stdout.emit('data', 'ZOE_EXITCODE_POISON_REACHED\n');
            await vi.advanceTimersByTimeAsync(90);
            child.emit('exit', code, null);
            await vi.advanceTimersByTimeAsync(20);
            expect(child.kill).not.toHaveBeenCalled();
            child.emit('close', code, null);
            const completed = await result;
            expect(completed).toMatchObject({ code, timedOut: false, signal: null, lifecycle: { pid: 12345, spawnMs: 0, markerMs: 0, exitMs: 90, closeMs: 110, finishMs: 110, timeoutMs: null, exitCode: code, exitSignal: null } });
            expect(verdict(completed)).toBe(code === 0 ? 'fake-green' : 'failed');
            expect(liveChildren.size).toBe(0);
            expect(vi.getTimerCount()).toBe(0);
        } finally { vi.useRealTimers(); }
    });
    it('pipe មិន close ត្រូវបិទនៅពិដានខ្លួនឯង ហើយមិនទុក handle', async () => {
        vi.useFakeTimers();
        try {
            const { child, run } = harness();
            const result = run('fixture', 100);
            child.emit('exit', 1, null);
            await vi.advanceTimersByTimeAsync(2000);
            expect(await result).toMatchObject({ code: 1, timedOut: false });
            expect(child.stdout.destroy).toHaveBeenCalledOnce();
            expect(child.stderr.destroy).toHaveBeenCalledOnce();
            expect(vi.getTimerCount()).toBe(0);
        } finally { vi.useRealTimers(); }
    });
    it.each(['throw', 'error'])('spawn %s៖ មិនទុក timer និងមិនរាប់ crash ជាភស្តុតាង', async mode => {
        vi.useFakeTimers();
        try {
            const { child, liveChildren, run, verdict } = harness(mode === 'throw');
            const result = run('fixture', 100);
            if (mode === 'error') child.emit('error', new Error('spawn ENOENT'));
            expect(verdict(await result)).toBe('unverified');
            expect(liveChildren.size).toBe(0);
            expect(vi.getTimerCount()).toBe(0);
        } finally { vi.useRealTimers(); }
    });
    it.each([null, 'SIGTERM'])('exit មិនមាន marker ឬ signal=%s៖ នៅតែមិនបានវាស់', async signal => {
        vi.useFakeTimers();
        try {
            const { child, run, verdict } = harness();
            const result = run('fixture', 100);
            if (signal) child.stdout.emit('data', 'ZOE_EXITCODE_POISON_REACHED\n');
            child.emit('exit', 1, signal);
            child.emit('close', 1, signal);
            expect(verdict(await result)).toBe('unverified');
            expect(vi.getTimerCount()).toBe(0);
        } finally { vi.useRealTimers(); }
    });
    it('exit យឺតក្រោយ hard ceiling មិនបង្កើត timer ថ្មី ឬប្ដូរសាលក្រម', async () => {
        vi.useFakeTimers();
        try {
            const { child, run, verdict } = harness();
            const result = run('fixture', 100);
            await vi.advanceTimersByTimeAsync(5100);
            child.stdout.emit('data', 'ZOE_EXITCODE_POISON_REACHED\n');
            child.emit('exit', 1, null);
            expect(verdict(await result)).toBe('unverified');
            expect(vi.getTimerCount()).toBe(0);
        } finally { vi.useRealTimers(); }
    });
    it('គ្មាន exit ឬ close សោះ ត្រូវ settle នៅ hard ceiling និងមិនរាប់ជាភស្តុតាង', async () => {
        vi.useFakeTimers();
        try {
            const { child, liveChildren, run, verdict } = harness();
            const result = run('fixture', 100);
            child.emit('spawn');
            child.stdout.emit('data', 'ZOE_EXITCODE_POISON_REACHED\n');
            await vi.advanceTimersByTimeAsync(5100);
            const completed = await result;
            expect(completed).toMatchObject({ code: null, timedOut: true, signal: 'SIGKILL' });
            expect(verdict(completed)).toBe('unverified');
            expect(liveChildren.size).toBe(0);
            expect(vi.getTimerCount()).toBe(0);
        } finally { vi.useRealTimers(); }
    });
    it('ព្យួរពិត ឬ exit ក្រោយ deadline នៅតែ timeout', async () => {
        vi.useFakeTimers();
        try {
            const { child, run } = harness();
            const result = run('fixture', 100);
            await vi.advanceTimersByTimeAsync(100);
            expect(child.kill).toHaveBeenCalledWith('SIGKILL');
            child.emit('exit', 1, null);
            child.emit('close', 1, null);
            expect(await result).toMatchObject({ code: 1, timedOut: true, lifecycle: { timeoutMs: 100, exitCode: 1, exitSignal: null, kill: { signal: 'SIGKILL', requestedMs: 100, result: true }, proc: { status: 'non-linux' } } });
            expect(vi.getTimerCount()).toBe(0);
        } finally { vi.useRealTimers(); }
    });
    it('marker មុនព្យួរ និង signal ពិត នៅរក្សាភស្តុតាងដោយមិនប្ដូរសាលក្រម', async () => {
        vi.useFakeTimers();
        try {
            const { child, run, verdict } = harness();
            const pending = run('fixture', 100);
            child.stdout.emit('data', 'ZOE_EXITCODE_POISON_');
            child.stdout.emit('data', 'REACHED\n');
            await vi.advanceTimersByTimeAsync(100);
            child.emit('exit', null, 'SIGKILL');
            child.emit('close', null, 'SIGKILL');
            const result = await pending;
            expect(result.lifecycle).toMatchObject({ markerMs: 0, timeoutMs: 100, exitMs: 100, closeMs: 100, exitCode: null, exitSignal: 'SIGKILL' });
            expect(verdict(result)).toBe('unverified');
            const before = JSON.stringify(result);
            child.emit('exit', 1, null);
            child.emit('close', 1, null);
            child.stdout.emit('data', 'private payload');
            expect(JSON.stringify(result)).toBe(before);
        } finally { vi.useRealTimers(); }
    });
    it('proc lookup បរាជ័យ មិនបង្ហាញ path ឬទិន្នន័យឯកជន និងមិនពន្យារ deadline', async () => {
        vi.useFakeTimers();
        try {
            const open = vi.fn(() => { throw new Error('private path and payload'); });
            const { child, run } = harness(false, 'linux', { openSync: open });
            const pending = run('fixture', 100);
            await vi.advanceTimersByTimeAsync(5100);
            const result = await pending;
            expect(result.lifecycle.proc).toEqual({ status: 'unavailable' });
            expect(JSON.stringify(result.lifecycle)).not.toContain('private');
            expect(open).toHaveBeenCalledWith('/proc/12345/stat', 'r');
            expect(child.kill).toHaveBeenCalledOnce();
        } finally { vi.useRealTimers(); }
    });

    it('proc មុន kill៖ អានមានព្រំដែន និងរក្សាតែ state និង wchan', async () => {
        vi.useFakeTimers();
        try {
            const events: string[] = [];
            let entries = 0;
            const closed: string[] = [];
            const procFs = {
                openSync: (file: string) => { events.push('read'); return file; },
                readSync: (file: string, buffer: Buffer, offset: number, size: number) => {
                    const value = file.endsWith('/stat') ? '12345 (private command) S 1 2 3' : 'futex_wait_queue';
                    expect(size).toBe(file.endsWith('/stat') ? 1024 : 64);
                    return buffer.write(value, offset, size);
                },
                closeSync: (file: string) => { closed.push(file); },
                opendirSync: () => ({
                    readSync: () => ({ name: String(12345 + entries++) }),
                    closeSync: vi.fn()
                })
            };
            const { child, run } = harness(false, 'linux', procFs);
            child.kill.mockImplementation(() => { events.push('kill'); return true; });
            const pending = run('fixture', 100);
            await vi.advanceTimersByTimeAsync(5100);
            const result = await pending;
            expect(events.at(-1)).toBe('kill');
            expect(closed).toHaveLength(17);
            expect(result.lifecycle.proc).toMatchObject({ status: 'available', state: 'S', threadsStatus: 'bounded' });
            expect(result.lifecycle.proc.threads).toHaveLength(16);
            expect(result.lifecycle.proc.threads[0]).toEqual({ tid: 12345, wchan: 'futex_wait_queue' });
            expect(JSON.stringify(result.lifecycle)).not.toContain('private');
            expect(JSON.stringify(result.lifecycle).length).toBeLessThan(2048);
        } finally { vi.useRealTimers(); }
    });
    it.each([false, 'throw'])('kill=%s មិនបាត់ hard ceiling ឬបង្កើត exit ដែលមិនបានឃើញ', async mode => {
        vi.useFakeTimers();
        try {
            const { child, run } = harness();
            child.kill.mockImplementation(() => { if (mode === 'throw') throw new Error('private'); return false; });
            const pending = run('fixture', 100);
            await vi.advanceTimersByTimeAsync(5100);
            const result = await pending;
            expect(result.lifecycle).toMatchObject({ exitMs: null, closeMs: null, exitCode: null, exitSignal: null, finishMs: 5100, kill: { result: mode === 'throw' ? 'threw' : false } });
            expect(JSON.stringify(result.lifecycle)).not.toContain('private');
        } finally { vi.useRealTimers(); }
    });

});

it('កូន Node ពិត៖ marker · hang · stdout ដែលចៅកាន់ក្រោយ exit', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'exit-evidence-'));
    const liveChildren = new Set();
    const source = guard.slice(guard.indexOf('function runPoisonedChild('), guard.indexOf('// ⛔⛔ **timeout'));
    const run = runInNewContext(source + '\nrunPoisonedChild;', {
        cp: require('node:child_process'), process, fs: require('node:fs'), Buffer, ROOT: dir,
        EXIT_GUARD_ARGS: [], OUT_CAP: 4096, EXIT_TO_CLOSE_GRACE_MS: 2000, HARD_GRACE_MS: 5000,
        liveChildren, Date, setTimeout, clearTimeout
    });
    try {
        for (const mode of ['exit', 'hang', 'pipe']) {
            const file = join(dir, mode + '.cjs');
            writeFileSync(file, "console.log('ZOE_EXITCODE_POISON_REACHED');\n" + (mode === 'hang'
                ? 'setInterval(() => {}, 1000);'
                : mode === 'pipe'
                    ? "require('node:child_process').spawn(process.execPath, ['-e', 'setTimeout(() => {}, 3000)'], { stdio: ['ignore', 1, 2] }); process.exit(1);"
                    : 'process.exit(1);'));
            const result = await run(file, 5000);
            expect(result.lifecycle.pid).toBeGreaterThan(0);
            expect(result.lifecycle.spawnMs).toBeGreaterThanOrEqual(0);
            expect(result.lifecycle.markerMs).toBeGreaterThanOrEqual(0);
            expect(result.lifecycle.exitMs).not.toBeNull();
            if (mode === 'hang') {
                expect(result).toMatchObject({ code: null, signal: 'SIGKILL', timedOut: true });
                expect(result.lifecycle.kill.result).toBe(true);
                if (process.platform === 'linux') expect(result.lifecycle.proc.status).toBe('available');
            } else {
                expect(result).toMatchObject({ code: 1, signal: null, timedOut: false });
                expect(result.lifecycle.kill).toBeNull();
                if (mode === 'pipe') {
                    expect(result.lifecycle.closeMs).toBeNull();
                    expect(result.lifecycle.finishMs - result.lifecycle.exitMs).toBeGreaterThanOrEqual(2000);
                }
            }
        }
        expect(liveChildren.size).toBe(0);
    } finally { rmSync(dir, { recursive: true, force: true }); }
}, 20000);
