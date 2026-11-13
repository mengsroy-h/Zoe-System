import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
import { expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '../../..');
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
    expect(success.gcProbe).toMatchObject({ outcome: 'OBSERVED' });
    for (const [probe, outcome] of [
        [{ status: null, signal: 'SIGTERM', error: { code: 'ETIMEDOUT' } }, 'TIMEOUT'],
        [{ status: null, error: { code: 'ENOENT', message: 'PRIVATE' } }, 'SPAWN_ERROR'],
        [{ status: 1, stderr: 'PRIVATE' }, 'NONZERO_EXIT'],
        [{ status: 0, stdout: 'PRIVATE\n123\n' }, 'INVALID_COUNTERS'],
    ]) {
        const result = helpers.probeCounters(probe);
        expect(result.gc).toBeNull();
        expect(result.gcProbe).toMatchObject({ outcome });
        expect(JSON.stringify(result)).not.toContain('PRIVATE');
    }
});


it('sampler រក្សា GC_COUNTERS_UNAVAILABLE និង failure ពេល probe ខ្វះ', () => {
    const probeStart = script!.indexOf('const probeStartedMs');
    const probeBlock = script!.slice(probeStart < 0 ? script!.indexOf('const probe = cp.spawnSync') : probeStart, script!.indexOf('samples++;'));
    expect(probeBlock).toContain('fs.appendFileSync');
    for (const probe of [
        { status: null, error: { code: 'ETIMEDOUT' } },
        { status: 0, stdout: 'Timestamp YGC\n1.5 2\n' },
    ]) {
        let sample = '';
        const realRequire = createRequire(import.meta.url);
        const result = vm.runInNewContext(script!.split('async function main()')[0] + `
            let unavailable = false; const nextSample = 200;
            const owner = { pid: 123, start: '100', jstat: '/owned/jstat' };
            const observed = { stat: { state: 'S' } }, output = '/owned/samples';
            ${probeBlock}
            unavailable;
        `, { process: { env: {}, hrtime: process.hrtime }, require: (name: string) => name === 'fs' ? { appendFileSync: (_file: string, data: string) => { sample = data; } }
            : name === 'child_process' ? { spawnSync: () => probe } : realRequire(name) });
        const row = JSON.parse(sample);
        expect(result).toBe(probe.status !== 0);
        expect(row.status).toBe(probe.status === 0 ? 'OBSERVED' : 'GC_COUNTERS_UNAVAILABLE');
        expect(row.gcProbe).toMatchObject({ outcome: probe.status === 0 ? 'OBSERVED' : 'TIMEOUT' });
    }
    expect(script).toContain("if (!result.samples || result.unavailable) throw new Error('Passive JVM measurements incomplete');");
    expect(script).toContain('if (!samples || unavailable) process.exitCode = 1;');
});

it.each(['ETIMEDOUT', 'ENOBUFS'])('probe %s មាន exit0 និង row ពេញ នៅមិនមែនជោគជ័យ', code => {
    const result = helpers.probeCounters({ status: 0, signal: null, error: { code }, stdout: 'Timestamp YGC\n1.5 2\n' });
    expect(result.gc).toBeNull();
    expect(result.gcProbe.outcome).toBe(code === 'ETIMEDOUT' ? 'TIMEOUT' : 'SPAWN_ERROR');
});

it('probe រាប់តែ bytes និងលេខដែលបានផ្ទៀង ទោះ timeout មាន counter row ពេញ', () => {
    const stdout = 'Timestamp YGC\n1.5 2\n';
    for (const status of [null, 0]) {
        const result = helpers.probeCounters({ status, signal: 'SIGTERM', error: { code: 'ETIMEDOUT', message: 'PRIVATE' }, stdout, stderr: 'ខ' });
        expect(result.gc).toBeNull();
        expect(result.gcProbe).toEqual({ outcome: 'TIMEOUT', exitStatus: status, errorCode: 'ETIMEDOUT', signal: 'SIGTERM',
            stdoutBytes: Buffer.byteLength(stdout), stderrBytes: 3, counterRowPresent: true });
        expect(JSON.stringify(result)).not.toContain('PRIVATE');
    }
    const success = helpers.probeCounters({ status: 0, stdout, stderr: '' });
    expect(success.gc).toEqual({ Timestamp: 1.5, YGC: 2 });
    expect(success.gcProbe).toEqual({ outcome: 'OBSERVED', exitStatus: 0, errorCode: null, signal: null,
        stdoutBytes: Buffer.byteLength(stdout), stderrBytes: 0, counterRowPresent: true });
});

it.each(['ENOBUFS', 'ENOENT', 'EACCES', 'EAGAIN', 'ENOMEM', 'PRIVATE'])('probe error %s មិនបង្ហាញអត្ថបទ ឬក្លាយជាជោគជ័យ', code => {
    const result = helpers.probeCounters({ status: 0, signal: 'PRIVATE', error: { code, message: 'PRIVATE' },
        stdout: Buffer.from('Timestamp YGC\n1.5 2\n'), stderr: Buffer.from('ខ') });
    expect(result.gc).toBeNull();
    expect(result.gcProbe).toEqual({ outcome: 'SPAWN_ERROR', exitStatus: 0, errorCode: code === 'PRIVATE' ? 'OTHER' : code,
        signal: 'OTHER', stdoutBytes: 20, stderrBytes: 3, counterRowPresent: true });
    expect(JSON.stringify(result)).not.toContain('PRIVATE');
});

it.each([null, undefined, {}, [], 'PRIVATE\n123\n', 'Timestamp YGC\n1 2\nPRIVATE', 'YGC YGC\n1 2\n', `YGC\n${'9'.repeat(400)}\n`])(
    'probe បដិសេធ stdout ដែលមិនមែនជួរ counters ត្រឹមត្រូវ៖ %s', stdout => {
        const result = helpers.probeCounters({ status: 0, stdout, stderr: { toString() { throw new Error('PRIVATE'); } } });
        expect(result.gc).toBeNull();
        expect(result.gcProbe).toMatchObject({ outcome: 'INVALID_COUNTERS', counterRowPresent: false, stderrBytes: 0 });
        expect(JSON.stringify(result)).not.toContain('PRIVATE');
    });

it('sampler កត់ពេលចាប់ផ្ដើម ចប់ និងយឺតតាមកាលវិភាគ ដោយរក្សា probe តែមួយ', () => {
    const probeStart = script!.indexOf('const probeStartedMs');
    const probeBlock = script!.slice(probeStart < 0 ? script!.indexOf('const probe = cp.spawnSync') : probeStart, script!.indexOf('samples++;'));
    let now = 1250, sample = '';
    const calls: unknown[][] = [];
    const realRequire = createRequire(import.meta.url);
    vm.runInNewContext(script!.split('async function main()')[0] + `
        let unavailable = false; const nextSample = 1000;
        const owner = { pid: 123, start: '100', jstat: '/owned/jstat' }, observed = { stat: { state: 'S' } }, output = '/owned/samples';
        ${probeBlock}
    `, { process: { env: {}, hrtime: { bigint: () => BigInt(now) * 1000000n } }, require: (name: string) => name === 'fs'
        ? { appendFileSync: (_file: string, data: string) => { sample = data; } } : name === 'child_process'
            ? { spawnSync: (...args: unknown[]) => { calls.push(args); now += 1100; return { status: null, error: { code: 'ETIMEDOUT' }, stdout: 'Timestamp YGC\n1.5 2\n' }; } }
            : realRequire(name) });
    expect(calls).toEqual([['/owned/jstat', ['-gc', '-t', '123'], { encoding: 'utf8', timeout: 750, maxBuffer: 16384 }]]);
    const row = JSON.parse(sample);
    expect(row.gc).toBeNull();
    expect(row.gcProbe).toMatchObject({ elapsedMs: 1100, scheduleLatenessMs: 250, counterRowPresent: true, outcome: 'TIMEOUT' });
    expect(row.gcProbe.startedUtc).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
    expect(row.gcProbe.endedUtc).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
    expect(Date.parse(row.gcProbe.endedUtc)).toBeGreaterThanOrEqual(Date.parse(row.gcProbe.startedUtc));
    expect(script).toContain('samples++; nextSample += 1000; await delay(Math.max(0, nextSample - Number(process.hrtime.bigint()) / 1e6));');
});

async function stopFixture(failure = '', artifactDenied = false) {
    const realRequire = createRequire(import.meta.url), events: string[] = [], writes = new Map<string, string>();
    const binding = { ...owner(1024), pid: 123 };
    let stopped = false, killed = false;
    const fault = (code: string) => Object.assign(new Error('PRIVATE'), { code });
    const stat = (start: string) => { const fields = Array<string>(22).fill('0'); fields[0] = killed && failure === 'zombie' ? 'Z' : 'S'; fields[19] = start; return '123 (java) ' + fields.join(' '); };
    const fakeFs = {
        readFileSync(file: string) {
            if (file === '/owned/owner.json') { if (failure === 'owner') throw fault('EACCES'); return JSON.stringify(binding); }
            if (file === '/owned/sampler-owner.json') { if (failure === 'observer') throw fault('ENOENT'); return JSON.stringify({ pid: 456, start: '200' }); }
            if (file === '/owned/sampler-result.json') { if (failure === 'result') throw fault('ENOENT'); return JSON.stringify({ samples: 2, unavailable: failure === 'metrics' }); }
            if (file.startsWith('/proc/456/')) {
                if (stopped && failure !== 'sampler') throw fault('ENOENT');
                return file.endsWith('/stat') ? stat('200') : 'node\0/owned/owned-jvm.cjs\0sample\0/owned\0';
            }
            if (file.startsWith('/proc/123/')) {
                if (killed && !['jvm', 'argv', 'start', 'zombie'].includes(failure)) throw fault(failure === 'proc' ? 'EACCES' : 'ENOENT');
                return file.endsWith('/stat') ? stat(failure === 'identity' || (killed && failure === 'start') ? '101' : '100')
                    : killed && failure === 'argv' ? 'PRIVATE\0' : killed && failure === 'zombie' ? '' : ['java', ...helpers.javaArguments(binding)].join('\0') + '\0';
            }
            throw new Error('Unexpected fixture path');
        },
        writeFileSync(file: string, value: string) {
            events.push(path.basename(file));
            if (file === '/owned/STOP') { if (failure === 'stop') throw fault('EACCES'); stopped = true; }
            if (file === '/owned/cleanup-result.json' && (failure === 'artifact' || artifactDenied)) throw fault('EACCES');
            writes.set(path.basename(file), value);
        },
    };
    const fakeNet = { createServer() {
        let onError: (error: Error) => void;
        return {
            once(_name: string, listener: (error: Error) => void) { onError = listener; },
            listen(port: number, host: string, done: () => void) {
                expect([port, host]).toEqual([19001, '127.0.0.1']); events.push('port');
                if (failure === 'port' || failure === 'bind') onError(fault(failure === 'port' ? 'EADDRINUSE' : 'EACCES')); else done();
            },
            close(done: () => void) { done(); },
        };
    } };
    const context = { require: (name: string) => name === 'fs' ? fakeFs : name === 'net' ? fakeNet : realRequire(name),
        process: { argv: ['node', '/owned/owned-jvm.cjs', 'stop', '/owned'], kill(pid: number, signal: string) {
            expect([pid, signal]).toEqual([123, 'SIGTERM']); events.push('kill'); if (failure === 'kill') throw fault('EPERM'); killed = true;
        } }, setTimeout: (done: () => void) => { done(); return 0; }, console: { log() {}, error() {} } };
    let error: unknown = null;
    try { await vm.runInNewContext(script!.slice(0, script!.lastIndexOf('\nmain().catch')) + '\nmain()', context); } catch (caught) { error = caught; }
    return { error, events, cleanup: writes.has('cleanup-result.json') ? JSON.parse(writes.get('cleanup-result.json')!) : null };
}

it.each([
    ['', true, true, true, true, true],
    ['metrics', true, true, true, true, false],
    ['owner', null, null, null, null, null],
    ['identity', true, true, null, null, null],
    ['kill', true, true, false, null, null],
    ['jvm', true, true, false, null, null],
    ['port', true, true, true, false, null],
    ['bind', true, true, true, null, null],
    ['sampler', true, false, true, true, null],
    ['observer', null, null, true, true, null],
    ['stop', false, false, true, true, null],
    ['result', true, true, true, true, null],
] as const)('cleanup %s រក្សាលទ្ធផលគ្រប់ដំណាក់កាលដែលបានវាស់ ទោះបរាជ័យ', async (failure, stopRequested, samplerStopped, ownedProcessTerminated, ownedPortClosed, metricsComplete) => {
    const result = await stopFixture(failure);
    expect(Boolean(result.error)).toBe(Boolean(failure));
    expect(result.cleanup).toMatchObject({ stopRequested, samplerStopped, ownedProcessTerminated, ownedPortClosed, metricsComplete, gatePassed: !failure });
    expect(JSON.stringify(result.cleanup)).not.toContain('PRIVATE');
    expect(result.events.at(-1)).toBe('cleanup-result.json');
    if (failure === 'owner' || failure === 'identity') expect(result.events).not.toContain('kill');
    if (failure === 'owner' || failure === 'identity' || failure === 'kill' || failure === 'jvm') expect(result.events).not.toContain('port');
});

it('cleanup មិនអះអាង process បិទពេលអាន proc មិនបាន ហើយ artifact សរសេរមិនបាននៅបរាជ័យ', async () => {
    const unreadable = await stopFixture('proc');
    expect(unreadable.cleanup).toMatchObject({ ownedProcessTerminated: null });
    const denied = await stopFixture('artifact');
    expect(denied.error).not.toBeNull();
    expect(denied.cleanup).toBeNull();
    expect(denied.events.at(-1)).toBe('cleanup-result.json');
    const primary = await stopFixture('metrics', true);
    expect((primary.error as Error).message).toBe('Passive JVM measurements incomplete');
});

it.each([['proc', null], ['argv', false], ['start', true], ['zombie', true]] as const)('cleanup %s បំបែកលទ្ធផល gate ពីភស្តុតាង JVM បិទ', async (failure, terminated) => {
    const result = await stopFixture(failure);
    expect(result.error).toBeNull();
    expect(result.cleanup).toMatchObject({ gatePassed: true, ownedProcessTerminated: terminated, ownedPortClosed: true, metricsComplete: true });
});

type SamplerProbe = { status: number | null; stdout?: string; stderr?: string; error?: { code: string } };
const hostedObserverEnv = { GITHUB_ACTIONS: 'true', RUNNER_ENVIRONMENT: 'github-hosted' };
const observerFlag = '-J-XX:TieredStopAtLevel=1';
const completeProbe = { status: 0, stdout: 'Timestamp YGC\n1.5 2\n' };

async function sampleFixture(env: unknown, firstProbe: SamplerProbe = { ...completeProbe, error: { code: 'ETIMEDOUT' } }, observationMs = 0) {
    const realRequire = createRequire(import.meta.url), rows: string[] = [], waits: number[] = [], probes: unknown[][] = [], clocks: number[] = [];
    const files = new Map<string, string>();
    const binding = { ...owner(1024), pid: 123, jstat: '/owned/jstat' };
    const targetArgs = ['-Xmx1024m', '-Xlog:gc*:file=/owned/jvm-gc.log:utctime,uptimemillis,level,tags:filecount=1,filesize=8M',
        '-jar', '/owned/emulator.jar', '--port', '19001', '--host', '127.0.0.1'];
    let now = 1000;
    const fakeProcess = { argv: ['node', '/owned/owned-jvm.cjs', 'sample', '/owned'], pid: 456, exitCode: 0, env,
        hrtime: { bigint: () => { clocks.push(now); return BigInt(now) * 1000000n; } } };
    const fakeFs = {
        readFileSync(file: string) {
            if (file === '/owned/owner.json') return JSON.stringify(binding);
            if (file.endsWith('/stat')) {
                if (file === '/proc/123/stat') now += observationMs;
                const fields = Array<string>(22).fill('0'); fields[0] = 'S'; fields[19] = '100'; return '123 (java) ' + fields.join(' ');
            }
            if (file === '/proc/123/cmdline') return ['java', ...targetArgs].join('\0') + '\0';
            if (file === '/proc/456/cmdline') return fakeProcess.argv.join('\0') + '\0';
            throw new Error('Unexpected fixture path');
        },
        writeFileSync(file: string, value: string) { files.set(path.basename(file), value); },
        appendFileSync(_file: string, value: string) { rows.push(value); },
        existsSync(file: string) { expect(file).toBe('/owned/STOP'); return probes.length === 3; },
    };
    await vm.runInNewContext(script!.slice(0, script!.lastIndexOf('\nmain().catch')) + '\nmain()', {
        process: fakeProcess, setTimeout: (done: () => void, ms: number) => { waits.push(ms); now += ms; done(); return 0; },
        require: (name: string) => name === 'fs' ? fakeFs : name === 'child_process' ? {
            spawnSync(...args: unknown[]) { probes.push(args); now += [1100, 50, 20][probes.length - 1];
                return probes.length === 1 ? firstProbe : completeProbe; },
        } : realRequire(name),
    });
    expect(helpers.javaArguments(binding)).toEqual(targetArgs);
    return { probes, waits, rows: rows.map(row => JSON.parse(row)), result: JSON.parse(files.get('sampler-result.json')!), exitCode: fakeProcess.exitCode, clocks };
}

it('sampler ពិតរក្សា cadence មួយវិនាទី និង failure ទោះ probe យូរជាង cadence', async () => {
    const { probes, waits, rows, result, exitCode } = await sampleFixture({});
    expect(probes).toEqual(Array.from({ length: 3 }, () => ['/owned/jstat', ['-gc', '-t', '123'], { encoding: 'utf8', timeout: 750, maxBuffer: 16384 }]));
    expect(waits).toEqual([0, 850, 980]);
    expect(rows.map(value => [value.status, value.gcProbe.elapsedMs, value.gcProbe.scheduleLatenessMs]))
        .toEqual([['GC_COUNTERS_UNAVAILABLE', 1100, 0], ['OBSERVED', 50, 100], ['OBSERVED', 20, 0]]);
    expect(rows[0].gc).toBeNull();
    expect(result).toEqual({ samples: 3, unavailable: true, passiveObservationHasOverhead: true });
    expect(exitCode).toBe(1);
});

it.each([
    ['github-hosted', hostedObserverEnv, true],
    ['self-hosted', { GITHUB_ACTIONS: 'true', RUNNER_ENVIRONMENT: 'self-hosted' }, false],
    ['local', {}, false],
    ['undefined', undefined, false],
    ['null', null, false],
    ['array', [], false],
    ['string', 'PRIVATE', false],
    ['number', 1, false],
    ['NaN', NaN, false],
    ['missing-actions', { RUNNER_ENVIRONMENT: 'github-hosted' }, false],
    ['missing-runner', { GITHUB_ACTIONS: 'true' }, false],
    ['false-actions', { ...hostedObserverEnv, GITHUB_ACTIONS: 'false' }, false],
    ['boolean-actions', { ...hostedObserverEnv, GITHUB_ACTIONS: true }, false],
    ['uppercase-actions', { ...hostedObserverEnv, GITHUB_ACTIONS: 'TRUE' }, false],
    ['spaced-actions', { ...hostedObserverEnv, GITHUB_ACTIONS: 'true ' }, false],
    ['uppercase-runner', { ...hostedObserverEnv, RUNNER_ENVIRONMENT: 'GITHUB-HOSTED' }, false],
    ['spaced-runner', { ...hostedObserverEnv, RUNNER_ENVIRONMENT: 'github-hosted ' }, false],
    ['unknown-runner', { ...hostedObserverEnv, RUNNER_ENVIRONMENT: 'PRIVATE' }, false],
    ['extra-env', { ...hostedObserverEnv, JSTAT_ARGS: 'PRIVATE', OBSERVER_PROFILE: 'PRIVATE' }, true],
] as const)('sampler %s ជ្រើស observer តាម environment ពិត ហើយភស្តុតាងត្រូវនឹង args', async (_label, env, tier1) => {
    const { probes, rows, result, exitCode } = await sampleFixture(env, completeProbe);
    const args = [...(tier1 ? [observerFlag] : []), '-gc', '-t', '123'];
    expect(probes).toEqual(Array.from({ length: 3 }, () => ['/owned/jstat', args, { encoding: 'utf8', timeout: 750, maxBuffer: 16384 }]));
    expect(rows).toHaveLength(3);
    expect(rows.map(row => row.gcProbe.observerProfile)).toEqual(Array(3).fill(tier1 ? 'github-hosted-tier1' : 'default'));
    expect(rows.every(row => row.status === 'OBSERVED')).toBe(true);
    expect(result).toEqual({ samples: 3, unavailable: false, passiveObservationHasOverhead: true });
    expect(exitCode).toBe(0);
    expect(JSON.stringify({ rows, result, probes })).not.toContain('PRIVATE');
});

it.each([
    ['timeout-exit0', { ...completeProbe, error: { code: 'ETIMEDOUT' } }, 'TIMEOUT'],
    ['unsupported-flag', { status: 1, stderr: 'PRIVATE unsupported option' }, 'NONZERO_EXIT'],
] as const)('GitHub observer %s រក្សា failure និង epoch ដំបូង ដោយគ្មាន retry ឬ fallback', async (_label, probe, outcome) => {
    const { probes, waits, rows, result, exitCode, clocks } = await sampleFixture(hostedObserverEnv, probe, 25);
    expect(probes).toEqual(Array.from({ length: 3 }, () => ['/owned/jstat', [observerFlag, '-gc', '-t', '123'], { encoding: 'utf8', timeout: 750, maxBuffer: 16384 }]));
    expect(clocks[0]).toBe(1000);
    expect(waits).toEqual([0, 800, 955]);
    expect(rows.map(row => row.gcProbe.scheduleLatenessMs)).toEqual([25, 150, 25]);
    expect(rows[0]).toMatchObject({ status: 'GC_COUNTERS_UNAVAILABLE', gc: null,
        gcProbe: { outcome, observerProfile: 'github-hosted-tier1', exitStatus: probe.status, elapsedMs: 1100 } });
    expect(rows.slice(1).map(row => row.status)).toEqual(['OBSERVED', 'OBSERVED']);
    expect(result).toEqual({ samples: 3, unavailable: true, passiveObservationHasOverhead: true });
    expect(exitCode).toBe(1);
    expect(JSON.stringify({ rows, result })).not.toContain('PRIVATE');
});

it('cleanup artifact នៅក្នុងបញ្ជីរក្សាភស្តុតាងពេលជំហានមុនបរាជ័យ', () => {
    const upload = workflow.slice(workflow.indexOf('uses: actions/upload-artifact@'));
    expect(upload).toContain('${{ env.F03_DIAG_DIR }}/cleanup-result.json');
    expect(upload).toContain('if: always()');
    expect(upload).not.toMatch(/emulator\.log|\*\*/);
});
