import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

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
        expect(runall).toMatch(/^run "exit-code-integrity 1\/2 \(meta\)" node audit-tools\/exit-code-integrity\.js --part=1\/2$/m);
        expect(runall).toMatch(/^run "exit-code-integrity 2\/2 \(meta\)" node audit-tools\/exit-code-integrity\.js --part=2\/2$/m);
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
