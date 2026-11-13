import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parse } from 'acorn';
import { describe, expect, it } from 'vitest';

const root = path.resolve('..');
const source = readFileSync(path.join(root, 'ZoeKeyGen/app.js'), 'utf8');
const checker = path.join(root, 'tools/audit-tools/dom-hygiene.js');
function replaceFunction(text: string, name: string, transform: (body: string) => string) {
    const node = parse(text, { ecmaVersion: 'latest' }).body.find(node => node.type === 'FunctionDeclaration' && node.id?.name === name);
    if (!node) throw new Error(name);
    const old = text.slice(node.start, node.end);
    const changed = transform(old);
    expect(changed).not.toBe(old);
    return text.slice(0, node.start) + changed + text.slice(node.end);
}
function check(text: string) {
    const directory = mkdtempSync(path.join(tmpdir(), 'zoe-dom-cleanup-'));
    try {
        for (const app of ['ZoeW', 'ZoeKeyGen']) mkdirSync(path.join(directory, app));
        writeFileSync(path.join(directory, 'ZoeW/app.js'), '');
        writeFileSync(path.join(directory, 'ZoeKeyGen/app.js'), text);
        const result = spawnSync(process.execPath, [checker], {
            cwd: root, encoding: 'utf8', timeout: 10000,
            env: { ...process.env, DOMHYG_APP_DIR: directory, NODE_PATH: path.join(root, 'ZoeW/node_modules') }
        });
        expect(result.error).toBeUndefined();
        expect(result.signal).toBeNull();
        expect(result.stderr).toBe('');
        return { status: result.status, output: result.stdout };
    } finally {
        rmSync(directory, { recursive: true, force: true });
    }
}

const fixtureSource = replaceFunction(source, 'showLoginModalWithPrefill', body => body.replace('{', '{ fixtureInvalidateSession();')) + `
function fixtureInvalidateSession() { fixtureClearOutput(); }
function fixtureWriteOutput(value) {
    document.getElementById('fixtureKeyOutput').value = value;
    document.getElementById('fixtureFingerprint').textContent = value;
}
function fixtureClearOutput() {
    ['fixtureKeyOutput'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    ['fixtureFingerprint'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '';
    });
}
`;

describe('DOM checker៖ ផ្លូវសម្អាតតាម helper', () => {
    it.each([['កូដ ZoeKeyGen ពិត', source], ['វាលសាកល្បង និង helper សម្អាត', fixtureSource]])('ទទួល %s', (_label, input) => {
        const result = check(input);
        expect(result.output).toContain('ZoeKeyGen --- ids written with data but never blanked on logout: 0');
        expect(result.status).toBe(0);
    });
    for (const [name, call] of [['showLoginModalWithPrefill', 'fixtureInvalidateSession();'], ['fixtureInvalidateSession', 'fixtureClearOutput();']]) {
        for (const replacement of ['', `void '${call}';`, `if (false) ${call}`, `return; ${call}`]) {
            it(`${name}៖ មិនរាប់ការហៅដែលដកចេញ ឬមិនអាចដល់ (${replacement || 'ដក'})`, () => {
                const result = check(replaceFunction(fixtureSource, name, body => body.replace(call, replacement)));
                expect(result.status).toBe(1);
                expect(result.output).toContain('⚠ fixtureKeyOutput');
            });
        }
    }
    for (const [property, id] of [['value', 'fixtureKeyOutput'], ['textContent', 'fixtureFingerprint']]) {
        it(`${property}៖ ខ្វះការសម្អាតនៅតែធ្លាក់ ទោះ helper នៅត្រូវហៅ`, () => {
            const result = check(replaceFunction(fixtureSource, 'fixtureClearOutput', body => body.replace(`el.${property} = '';`, `el.${property} = 'នៅសល់';`)));
            expect(result.status).toBe(1);
            expect(result.output).toContain(`⚠ ${id}`);
        });
    }
    it('រាប់តែ id ក្នុងបញ្ជីសម្អាតពិត', () => {
        const result = check(replaceFunction(fixtureSource, 'fixtureClearOutput', body => body.replace("'fixtureKeyOutput'", "'fixtureOtherField'")));
        expect(result.status).toBe(1);
        expect(result.output).toContain('⚠ fixtureKeyOutput');
    });
    it('វាលថ្មីក្រៅ helper មិនត្រូវបានលើកលែង', () => {
        const result = check(fixtureSource + "\nfunction fixtureWrite(value) { document.getElementById('fixtureUncleared').textContent = value; }\n");
        expect(result.status).toBe(1);
        expect(result.output).toContain('⚠ fixtureUncleared');
    });
});
