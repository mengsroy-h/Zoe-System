import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { retryAsync } from '../src/services/network';
import { firebaseState } from '../src/core/state';

const root = path.resolve(import.meta.dirname, '..');
const source = (file: string) => ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
const network = source(path.join(root, 'src/services/network.ts'));
const keygen = source(path.join(root, '../ZoeKeyGen/app.js'));
function retryDeclaration(file: ts.SourceFile) {
    const node = file.statements.find((n) => ts.isFunctionDeclaration(n) && n.name?.text === 'retryAsync')!;
    return node.getText(file).replace(/^export /, '');
}
const keygenRetry = vm.runInNewContext('(' + retryDeclaration(keygen) + ')', { setTimeout: (...args: any[]) => (setTimeout as any)(...args) });

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

it('retry រួមមានកូដដូចគ្នាទាំងពីរ App', () => {
    expect(retryDeclaration(network)).toBe(retryDeclaration(keygen));
});

it('គ្រប់ caller ក្នុង ZoeW ចាប់ម្ចាស់វគ្គមុន retry', () => {
    const calls: string[] = [];
    function walkDir(dir: string) {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const file = path.join(dir, entry.name);
            if (entry.isDirectory()) { walkDir(file); continue; }
            if (!/\.tsx?$/.test(file)) continue;
            const ast = source(file);
            const names = new Set(['retryAsync']);
            for (const n of ast.statements) {
                if (ts.isImportDeclaration(n) && n.importClause?.namedBindings && ts.isNamedImports(n.importClause.namedBindings)) {
                    for (const item of n.importClause.namedBindings.elements) {
                        if ((item.propertyName || item.name).text === 'retryAsync') names.add(item.name.text);
                    }
                }
            }
            function visit(n: ts.Node) {
                if (ts.isCallExpression(n) && (ts.isIdentifier(n.expression) && names.has(n.expression.text)
                    || ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'retryAsync')) {
                    calls.push(path.relative(root, file));
                    expect(n.arguments.length, file).toBe(4);
                    expect(n.arguments[3]?.getText(ast), file).toBe('captureConnectionOperation()');
                    expect(ast.statements.some((row) => ts.isImportDeclaration(row)
                        && /connection-flow['"]$/.test(row.moduleSpecifier.getText(ast))
                        && row.importClause?.namedBindings?.getText(ast).includes('captureConnectionOperation')), file).toBe(true);
                }
                ts.forEachChild(n, visit);
            }
            visit(ast);
        }
    }
    walkDir(path.join(root, 'src'));
    expect(calls.length).toBeGreaterThanOrEqual(10);
    expect(new Set(calls).size).toBeGreaterThanOrEqual(6);
});

it('គ្រប់ caller ក្នុង ZoeKeyGen រក្សា API បីប៉ារ៉ាម៉ែត្រ', () => {
    let calls = 0;
    function visit(n: ts.Node) {
        if (ts.isFunctionDeclaration(n) && n.name?.text === 'retryAsync') return;
        if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'retryAsync') {
            calls++;
            expect(n.arguments.length).toBe(3);
        }
        ts.forEachChild(n, visit);
    }
    visit(keygen);
    expect(calls).toBeGreaterThanOrEqual(5);
});

for (const [app, retry] of [['ZoeW', retryAsync], ['ZoeKeyGen', keygenRetry]] as const) {
    it(app + '៖ API បីប៉ារ៉ាម៉ែត្ររក្សា retry ចាស់ និងចន្លោះពេលទ្វេ', async () => {
        const error = new Error('offline');
        const operation = vi.fn().mockRejectedValue(error);
        const result = retry(operation, 3, 100).catch((err: unknown) => err);
        await vi.advanceTimersByTimeAsync(0);
        firebaseState.authGeneration++;
        await vi.advanceTimersByTimeAsync(99);
        expect(operation).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(1);
        expect(operation).toHaveBeenCalledTimes(2);
        await vi.advanceTimersByTimeAsync(199);
        expect(operation).toHaveBeenCalledTimes(2);
        await vi.advanceTimersByTimeAsync(1);
        expect(operation).toHaveBeenCalledTimes(3);
        expect(await result).toBe(error);
    });
    it(app + '៖ noRetry បញ្ឈប់ភ្លាម', async () => {
        const error = Object.assign(new Error('stop'), { noRetry: true });
        const operation = vi.fn().mockRejectedValue(error);
        await expect(retry(operation, 3, 100)).rejects.toBe(error);
        expect(operation).toHaveBeenCalledTimes(1);
        expect(vi.getTimerCount()).toBe(0);
    });
    it(app + '៖ lease ផុតមុនចាប់ផ្តើម មិនបញ្ជូនសំណើ', async () => {
        const operation = vi.fn().mockResolvedValue('bad');
        await expect(retry(operation, 3, 100, { current: () => false })).rejects.toMatchObject({ code: 'CONNECTION_SCOPE_CHANGED', noRetry: true });
        expect(operation).not.toHaveBeenCalled();
    });
}
