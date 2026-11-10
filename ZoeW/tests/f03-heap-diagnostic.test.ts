import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
import { expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '../..');
const workflow = readFileSync(path.join(root, '.github/workflows/f03-native-diagnostic.yml'), 'utf8');
const checker = readFileSync(path.join(root, 'audit-tools/emu/registry-purge-atomic-sdk-test.js'), 'utf8');
const runner = createRequire(import.meta.url)(path.join(root, 'audit-tools/owned-rtdb-command.js'));
const script = workflow.split("<<'NODE'\n")[1]?.split('\n          NODE')[0].replace(/^ {10}/gm, '');
if (!script || !script.includes('async function main()')) throw new Error('Owned JVM script not found');
const helpers = vm.runInNewContext(script.split('async function main()')[0]
    + '\n({ javaArguments, identityMatches, verifyConstruction, probeCounters: typeof probeCounters === "function" ? probeCounters : null })', { require: createRequire(import.meta.url) });
const owner = (maxHeapMiB: unknown) => ({ start: '100', jar: '/owned/emulator.jar', gcLog: '/owned/jvm-gc.log', port: 19001, maxHeapMiB });

it.each(['audit-tools/run-all.sh', 'audit-tools/owned-rtdb-command.js'])('ការប្ដូរ runner %s បើក diagnostic ដែលរក្សា gate ដើម', file => {
    const paths = workflow.split('\nconcurrency:')[0].match(/^ {6}- '([^']+)'$/gm) || [];
    expect(paths).toContain(`      - '${file}'`);
});

it.each([512, 1024])('JVM %s៖ ទំហំ heap និង ownership ត្រូវដូចគ្នា', (heap) => {
    const binding = owner(heap), args = ['java', ...helpers.javaArguments(binding)];
    expect(args[1]).toBe('-Xmx' + heap + 'm');
    expect(helpers.identityMatches(binding, { start: '100' }, args)).toBe(true);
    expect(helpers.identityMatches(binding, { start: '101' }, args)).toBe(false);
    expect(helpers.identityMatches(owner(heap === 512 ? 1024 : 512), { start: '100' }, args)).toBe(false);
    expect(helpers.identityMatches(binding, { start: '100' }, [...args, '-Xmx2g'])).toBe(false);
});

it.each([undefined, null, 0, 513, 2048, '512m', '512 -Xmx2g', NaN])('បដិសេធ heap ខុស whitelist៖ %s', (heap) => {
    expect(() => helpers.javaArguments(owner(heap))).toThrow();
});

it('construction guard នៅវាស់ process និង listener ពិត', () => {
    expect(() => helpers.verifyConstruction()).not.toThrow();
});

it('matrix GitHub ប្រើ JVM1024 ទាំងពីរ order ហើយ self-hosted នៅដដែល', () => {
    expect(workflow).toContain("heap_mib: ${{ fromJSON(vars.ZOE_RUNNER_MODE == 'github' && '[1024]' || '[512, 1024]') }}");
    expect(workflow).toContain("order: ['249,250,251', '251,249,250']");
    expect(workflow).toContain('name: F03 JVM${{ matrix.heap_mib }} ${{ matrix.order }}');
    expect(workflow).toContain('max-parallel: 1');
    expect(workflow).toContain('fail-fast: false');
    expect(workflow).not.toMatch(/continue-on-error\s*:/);
    expect(workflow).toContain('F03_DIAGNOSTIC_HEAP_MIB: ${{ matrix.heap_mib }}');
    expect(workflow).toContain('launch "$F03_DIAG_DIR" "$PORT" "$JAR" "$F03_DIAGNOSTIC_HEAP_MIB"');
    expect(script).toContain('const maxHeapMiB = diagnosticHeap(jarArg);');
    expect(script).toContain('javaArguments({ jar, port, gcLog, maxHeapMiB })');
    expect(script).toContain('jarSHA256: sha(fs.readFileSync(jar)), maxHeapMiB,');
});

it('រក្សា deadline និង self-hosted heap ដដែល ដោយគ្មាន fallback', () => {
    expect(checker).toContain('const LIMIT = 4194304, WAIT_MS = 15000;');
    expect(checker).toContain('TIMING_PHASE_MS = 90000;');
    expect(workflow).toContain('CRUD_FLOW_STRICT: \'1\'');
    expect(workflow).toContain('timeout --signal=TERM --kill-after=5s 300s node audit-tools/emu/registry-purge-atomic-sdk-test.js');
    expect(workflow).toContain('env -u JAVA_TOOL_OPTIONS -u JDK_JAVA_OPTIONS -u _JAVA_OPTIONS');
    expect(runner.javaArguments('/owned/emulator.jar')[0]).toBe('-Xmx512m');
    const command = ['node', 'audit-tools/emu/registry-purge-atomic-sdk-test.js'];
    expect(runner.heapForCommand(command, { GITHUB_ACTIONS: 'true', RUNNER_ENVIRONMENT: 'self-hosted' }, root)).toBe(512);
    expect(runner.heapForCommand(command, { GITHUB_ACTIONS: 'true', RUNNER_ENVIRONMENT: 'github-hosted' }, root)).toBe(1024);
    expect(runner.heapForCommand(['node', 'audit-tools/emu/other-test.js'], { GITHUB_ACTIONS: 'true', RUNNER_ENVIRONMENT: 'github-hosted' }, root)).toBe(512);
    expect(workflow).not.toMatch(/System\.gc|GC\.run|--fixtures-only/);
});

it('រក្សាភស្តុតាងពេញតាមបញ្ជីជាក់លាក់ ទោះ checker បរាជ័យ', () => {
    const upload = workflow.slice(workflow.indexOf('uses: actions/upload-artifact@'));
    expect(upload).toContain('if: always()');
    expect(upload).toContain('${{ matrix.heap_mib }}');
    expect(upload).toContain('${{ matrix.order }}');
    expect(upload).toContain('if-no-files-found: error');
    expect(upload).toContain('${{ env.F03_DIAG_DIR }}/jvm-gc.log');
    expect(upload).toContain('${{ env.F03_DIAG_DIR }}/jvm-gc.log.0');
    expect(upload).toContain('${{ env.F03_DIAG_DIR }}/jvm-samples.jsonl');
    expect(upload).toContain('${{ env.F03_DIAG_DIR }}/parity.json');
    expect(upload).not.toMatch(/emulator\.log|\*\*/);
});


it('វាស់មូលហេតុ jstat បាត់ ដោយមិនបោះចោល failure ឬបង្ហាញ payload', () => {
    expect(helpers.probeCounters, 'jstat បាត់មិនមានមូលហេតុដែលអាចផ្ទៀងបាន').toBeTypeOf('function');
    const success = helpers.probeCounters({ status: 0, stdout: 'Timestamp YGC\n1.5 2\n' });
    expect(success.gc.YGC).toBe(2);
    expect(success.gcProbe).toEqual({ outcome: 'OBSERVED' });
    for (const [probe, outcome] of [
        [{ status: null, signal: 'SIGTERM', error: { code: 'ETIMEDOUT' } }, 'TIMEOUT'],
        [{ status: null, error: { code: 'ENOENT', message: 'PRIVATE' } }, 'SPAWN_ERROR'],
        [{ status: 1, stderr: 'PRIVATE' }, 'NONZERO_EXIT'],
        [{ status: 0, stdout: 'PRIVATE\n123\n' }, 'INVALID_COUNTERS'],
    ]) {
        const result = helpers.probeCounters(probe);
        expect(result.gc).toBeNull();
        expect(result.gcProbe).toEqual({ outcome });
        expect(JSON.stringify(result)).not.toContain('PRIVATE');
    }
});


it('sampler រក្សា GC_COUNTERS_UNAVAILABLE និង failure ពេល probe ខ្វះ', () => {
    const probeBlock = script!.slice(script!.indexOf('const probe = cp.spawnSync'), script!.indexOf('samples++;'));
    expect(probeBlock).toContain('fs.appendFileSync');
    for (const probe of [
        { status: null, error: { code: 'ETIMEDOUT' } },
        { status: 0, stdout: 'Timestamp YGC\n1.5 2\n' },
    ]) {
        let sample = '';
        const realRequire = createRequire(import.meta.url);
        const result = vm.runInNewContext(script!.split('async function main()')[0] + `
            let unavailable = false;
            const owner = { pid: 123, start: '100', jstat: '/owned/jstat' };
            const observed = { stat: { state: 'S' } }, output = '/owned/samples';
            ${probeBlock}
            unavailable;
        `, { require: (name: string) => name === 'fs' ? { appendFileSync: (_file: string, data: string) => { sample = data; } }
            : name === 'child_process' ? { spawnSync: () => probe } : realRequire(name) });
        const row = JSON.parse(sample);
        expect(result).toBe(probe.status !== 0);
        expect(row.status).toBe(probe.status === 0 ? 'OBSERVED' : 'GC_COUNTERS_UNAVAILABLE');
        expect(row.gcProbe).toEqual({ outcome: probe.status === 0 ? 'OBSERVED' : 'TIMEOUT' });
    }
    expect(script).toContain("if (!result.samples || result.unavailable) throw new Error('Passive JVM measurements incomplete');");
    expect(script).toContain('if (!samples || unavailable) process.exitCode = 1;');
});
