import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { expect, it } from 'vitest';

const entry = path.resolve('../tools/audit-tools/zoew/runtime/expose-globals.ts');
const directories = ['core', 'domain', 'features', 'services', 'ui', 'app/behaviors'];
const filesIn = (directory: string) => fs.globSync(`src/${directory}/**/*.ts`).sort();
const explicit = ['src/app/flush.ts', 'src/app/lifecycle/layers.ts', 'src/app/refs.ts'];
const expected = [...directories.flatMap(filesIn), ...explicit].sort();

function expandedGlob(directory?: string): string[] {
    const script = `
        import { build } from 'vite';
        import fs from 'node:fs';
        import path from 'node:path';
        const entry = ${JSON.stringify(entry)};
        const directory = ${JSON.stringify(directory ?? null)};
        let transformed = '';
        const result = await build({
            configFile: false, root: process.cwd(), logLevel: 'silent',
            plugins: [{
                name: 'audit-glob-fixture', enforce: 'pre',
                load(id) {
                    if (id !== entry || directory === null) return;
                    const source = fs.readFileSync(entry, 'utf8');
                    const glob = '../../../../ZoeW/src/' + directory + '/**/*.ts';
                    if (!source.includes(glob)) throw new Error('Missing glob fixture: ' + glob);
                    return source.replace(glob, '../../../ZoeW/src/' + directory + '/**/*.ts');
                }
            }, {
                name: 'capture-audit-glob', enforce: 'post',
                transform(code, id) { if (id === entry) transformed = code; }
            }],
            build: {
                write: false, emptyOutDir: false, minify: false,
                lib: { entry, formats: ['es'], fileName: 'audit-globs' },
                rolldownOptions: { external: (_id, importer) => Boolean(importer) }
            }
        });
        const outputs = (Array.isArray(result) ? result : [result]).flatMap((r) => r.output);
        const compiled = outputs.flatMap((chunk) => Object.keys(chunk.modules || {}));
        if (compiled.length !== 1 || compiled[0] !== entry) throw new Error('Unexpected app compilation');
        const files = [...transformed.matchAll(/import \\* as __import_glob__\\w+ from "([^"]+)"/g)]
            .map((match) => path.relative(process.cwd(), path.resolve(path.dirname(entry), match[1])).split(path.sep).join('/')).sort();
        console.log(JSON.stringify(files));
        process.exit(0);
    `;
    return JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', script], {
        encoding: 'utf8', timeout: 15000
    }));
}

it('audit bridge ៖ Vite ពង្រីក glob ពិតគ្រប់ module មិនត្រឹមតែ build ជោគជ័យ', () => {
    for (const directory of directories) expect(filesIn(directory).length).toBeGreaterThan(0);
    expect(expandedGlob()).toEqual(expected);
});

it.each(directories)('audit bridge ៖ ផ្លូវខុសមួយជាន់ក្នុង %s ត្រូវបាត់ module ពិត', (directory) => {
    const missing = filesIn(directory);
    const actual = expandedGlob(directory);
    expect(actual).toEqual(expected.filter((file) => !missing.includes(file)));
    expect(actual).not.toEqual(expected);
});
