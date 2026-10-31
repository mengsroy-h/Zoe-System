import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
const require = createRequire(import.meta.url);
const { modulePrograms } = require('../../audit-tools/audit-module-ast.js');
const roots: string[] = [];
function fixture(views: Record<string, string>) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zoe-module-ast-'));
    roots.push(root);
    const source = '\n' + Object.values(views).join('\n');
    fs.writeFileSync(path.join(root, 'audit-module-views.json'), JSON.stringify(views));
    fs.writeFileSync(path.join(root, 'app.js'), source);
    return { root, source, file: path.join(root, 'app.js') };
}
afterEach(() => roots.splice(0).forEach(root => fs.rmSync(root, { recursive: true, force: true })));
describe('AST រក្សាព្រំដែនម៉ូឌុល និងទីតាំងកូដដើម', () => {
    it('private names ដូចគ្នានៅម៉ូឌុលពីរមិនច្រឡំ scope ហើយ slice នៅដដែល', () => {
        const f = fixture({ a: 'const text = 1; function one() { return text; }', b: 'const text = 2; function two() { return text; }' });
        const programs = modulePrograms(f.source, f.file, { ecmaVersion: 'latest', locations: true, ranges: true });
        const owners = programs.filter((p: any) => p.body.length);
        expect(owners).toHaveLength(2);
        expect(owners.map((p: any) => p.body[0].declarations[0].init.value)).toEqual([1, 2]);
        const two = owners[1].body[1];
        expect(f.source.slice(two.start, two.end)).toBe('function two() { return text; }');
        expect(two.range).toEqual([two.start, two.end]);
        expect(two.loc.start.line).toBe(3);
        expect(two.loc.start.column).toBe(16);
    });
    it('shared Acorn Position objects shift exactly once, including nested nodes and shorthand properties', () => {
        const f = fixture({ a: 'const first = 1;\n', b: 'const second = { value: first };\nfunction nested() { const { value } = second; return { value }; }' });
        const programs = modulePrograms(f.source, f.file, { ecmaVersion: 'latest', locations: true, ranges: true });
        const seen = new WeakSet<object>();
        const check = (node: any) => {
            if (!node || typeof node !== 'object' || seen.has(node)) return;
            seen.add(node);
            if (node.type) for (const edge of ['start', 'end']) {
                const prefix = f.source.slice(0, node[edge]);
                expect(node.loc[edge]).toEqual({ line: prefix.split('\n').length, column: prefix.length - prefix.lastIndexOf('\n') - 1 });
            }
            for (const [key, value] of Object.entries(node)) if (!['loc', 'range'].includes(key)) {
                if (Array.isArray(value)) value.forEach(check); else check(value);
            }
        };
        programs.forEach(check);
    });
    it('comment inventory retains original source offsets and locations across modules', () => {
        const f = fixture({ a: 'const first = 1;', b: '/* second module */ const second = 2;' });
        const comments: any[] = [];
        modulePrograms(f.source, f.file, { ecmaVersion: 'latest', locations: true, onComment: comments });
        expect(comments).toHaveLength(1);
        expect(f.source.slice(comments[0].start, comments[0].end)).toBe('/* second module */');
        expect(comments[0].loc.start).toEqual({ line: 3, column: 0 });
    });
    it('source-only mutation មិនអាចរាប់ជាតេស្តឆ្លង ឬជាបញ្ហាឥរិយាបថ', () => {
        const f = fixture({ a: 'const amount = 1;' });
        expect(() => modulePrograms(f.source.replace('= 1', '= 2'), f.file, { ecmaVersion: 'latest' })).toThrow(/mismatched module/);
    });
    it('mutation ដែលផ្លាស់ source និង view ដូចគ្នាត្រូវឃើញតម្លៃប្រែពិត', () => {
        const f = fixture({ a: 'const amount = 1;' });
        const changed = f.source.replace('= 1', '= 2');
        fs.writeFileSync(path.join(f.root, 'audit-module-views.json'), JSON.stringify({ a: 'const amount = 2;' }));
        const actual = modulePrograms(changed, f.file, { ecmaVersion: 'latest' }).find((p: any) => p.body.length);
        expect(actual.body[0].declarations[0].init.value).toBe(2);
    });
    it('syntax ខូចក្នុងម៉ូឌុល ឬកូដក្នុងចន្លោះមិនអាចរំលង', () => {
        const broken = fixture({ a: 'const text = ;' });
        expect(() => modulePrograms(broken.source, broken.file, { ecmaVersion: 'latest' })).toThrow();
        const f = fixture({ a: 'const okay = 1;' });
        expect(() => modulePrograms(f.source + '\nfunction {', f.file, { ecmaVersion: 'latest' })).toThrow();
    });
    it('ឯកសារធម្មតា និង probe ដាច់ដោយឡែកនៅវាស់ syntax ដើម', () => {
        const f = fixture({ a: 'const okay = 1;' });
        expect(modulePrograms('let a = 1;', path.join(f.root, 'probe.js'), { ecmaVersion: 'latest' })).toHaveLength(1);
        expect(() => modulePrograms('const a = 1; const a = 2;', path.join(f.root, 'probe.js'), { ecmaVersion: 'latest' })).toThrow();
    });
});
