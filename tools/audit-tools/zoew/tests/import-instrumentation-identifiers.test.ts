// @vitest-environment node
// Compile និងបម្លែងអត្ថបទប៉ុណ្ណោះ មិន import harness ឬ execute bundle ទេ.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Script } from 'node:vm';
import ts from 'typescript';
import { buildSync } from 'esbuild';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../../../..');
const source = readFileSync(resolve(root, 'tools/audit-tools/emu/import-paired-sdk-test.js'), 'utf8');
const parsed = ts.createSourceFile('harness.js', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
const names = ['transportClientIdentifier', 'instrumentSweep', 'instrumentTransport', 'instrumentSubscribe', 'instrumentAuth', 'instrumentRecovery'];
const declarations = names.map(name => {
    const found = parsed.statements.filter(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
    assert.equal(found.length, 1);
    return found[0].getText(parsed);
});
// រត់តែ helper បម្លែងអត្ថបទទាំងនេះ មិនរត់ setup ឬ main របស់ harness ទេ។
const transform = new Function('assert', declarations.join('\n') + '\nreturn { ' + names.join(',') + ' };')(assert);
const entry = source.match(/const exports=`([^`]+)`;/)?.[1];
assert(entry);
const raw = buildSync({ absWorkingDir: root, stdin: { contents: entry, resolveDir: root }, bundle: true,
    platform: 'node', format: 'cjs', write: false, logLevel: 'error', nodePaths: [resolve(root, 'ZoeW/node_modules')],
    define: { 'import.meta.env': '{}' } }).outputFiles[0].text;
const transportPattern = /^function createSupabaseTransport\(config, deps\) \{[\s\S]*?^\}/gm;
function all(code: string): string {
    return transform.instrumentRecovery(transform.instrumentAuth(transform.instrumentSubscribe(transform.instrumentTransport(transform.instrumentSweep(code)))));
}

describe('ឈ្មោះ binding ក្នុង import harness (compile និងអត្ថបទ)', () => {
    it('បំពាក់ការសង្កេតក្នុង bundle បច្ចុប្បន្នដោយមិន execute', () => {
        const result = all(raw);
        expect(result).toContain('__observeTransportCall(() => ' + transform.transportClientIdentifier(raw) + '.auth.getSession())');
        expect(result).toContain('__observeSweep(runZtoStatusSweep(false))');
        expect(() => new Script(result)).not.toThrow(); // Parse ប៉ុណ្ណោះ។
    });
    it('ទទួលឈ្មោះ binding ថ្មី ហើយរក្សា client កន្លែងផ្សេង', () => {
        const local = transform.transportClientIdentifier(raw);
        const unrelated = '\nfunction unrelatedClient() { return client.auth.getSession(); }\n';
        const renamed = raw.replace(transportPattern, block => block.replace(new RegExp('\\b' + local + '\\b', 'g'), 'transportFixtureClient')) + unrelated;
        const result = all(renamed);
        expect(result).toContain('__observeTransportCall(() => transportFixtureClient.auth.getSession())');
        expect(result).toContain(unrelated);
        expect(() => new Script(result)).not.toThrow();
    });
    it('ទាមទារ function, binding និងកន្លែងសង្កេតតែមួយ', () => {
        const block = raw.match(transportPattern)![0];
        expect(() => transform.transportClientIdentifier(raw + '\n' + block)).toThrow('exactly one transport function');
        expect(() => transform.transportClientIdentifier(raw.replace(/ = clientOwner\.value;/, ' = otherOwner.value;'))).toThrow('exactly one transport client binding');
        const client = transform.transportClientIdentifier(raw);
        const site = client + '.removeAllChannels().catch';
        expect(() => transform.instrumentTransport(raw.replace(site, client + '.removeAllChannels().then'))).toThrow('exactly one transport instrumentation site');
        expect(() => transform.instrumentTransport(raw + '\n' + site)).toThrow('exactly one transport instrumentation site');
    });
});
