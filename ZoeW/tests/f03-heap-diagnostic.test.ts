import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
import { expect, it } from 'vitest';

const root = path.resolve(import.meta.dirname, '../..');
const workflow = readFileSync(path.join(root, '.github/workflows/f03-native-diagnostic.yml'), 'utf8');
const checker = readFileSync(path.join(root, 'audit-tools/emu/registry-purge-atomic-sdk-test.js'), 'utf8');
const runner = readFileSync(path.join(root, 'audit-tools/owned-rtdb-command.js'), 'utf8');
const script = workflow.split("<<'NODE'\n")[1]?.split('\n          NODE')[0].replace(/^ {10}/gm, '');
if (!script || !script.includes('async function main()')) throw new Error('Owned JVM script not found');
const helpers = vm.runInNewContext(script.split('async function main()')[0]
    + '\n({ javaArguments, identityMatches, verifyConstruction })', { require: createRequire(import.meta.url) });
const owner = (maxHeapMiB: unknown) => ({ start: '100', jar: '/owned/emulator.jar', gcLog: '/owned/jvm-gc.log', port: 19001, maxHeapMiB });

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

it('matrix រក្សា JVM512 ទាំងពីរ order ហើយបន្ថែមតែ JVM1024', () => {
    expect(workflow).toContain("heap_mib: [512, 1024]");
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

it('រក្សា deadline និង ordinary runner ដដែល ដោយគ្មាន fallback', () => {
    expect(checker).toContain('const LIMIT = 4194304, WAIT_MS = 15000;');
    expect(checker).toContain('TIMING_PHASE_MS = 90000;');
    expect(workflow).toContain('CRUD_FLOW_STRICT: \'1\'');
    expect(workflow).toContain('timeout --signal=TERM --kill-after=5s 300s node audit-tools/emu/registry-purge-atomic-sdk-test.js');
    expect(workflow).toContain('env -u JAVA_TOOL_OPTIONS -u JDK_JAVA_OPTIONS -u _JAVA_OPTIONS');
    expect(runner).toContain("function javaArguments(jar) { return ['-Xmx512m', '-jar', jar, '--port', String(PORT), '--host', '127.0.0.1']; }");
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
