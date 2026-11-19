// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const ts: typeof import('typescript') = require('typescript');
const { sliceFunction } = require('../../react-view.js');
const checker = fs.readFileSync(path.resolve('../tools/audit-tools/lookup-freshness-test.js'), 'utf8');
const names = vm.runInNewContext(checker.match(/const FNS = (\[[\s\S]*?\]);/)?.[1] || '[]') as string[];
const typed = fs.readFileSync(path.resolve('src/features/sheet-import.ts'), 'utf8');
const source = ts.transpileModule(typed, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText.replace(/^export /gm, '');

it.each([
    ['ប្រាក់ត្រឹមត្រូវ', ['BC1', 1.5, 2.5, '012'], true],
    ['DOD ខុស', ['BC1', null, 2.5, '012'], false],
    ['COD ខុស', ['BC1', 1.5, null, '012'], false]
] as const)('lookup VM ប្រើ money guard ពិត៖ %s', async (_label, row, valid) => {
    const selected = ['runSheetImport', 'sheetImportMoneyError', 'sheetImportHeaderRowNumber'];
    const bodies = selected.filter(name => names.includes(name)).map(name => {
        const body = sliceFunction(source, name);
        expect(body, name).toBeTruthy();
        return body;
    }).join('\n');
    const write = vi.fn(async () => ({}));
    const message = vi.fn();
    const ctx = vm.createContext({
        sheetImportState: { sheetImportBusy: false }, sheetPreparePending: false, sheetConfigOwner: null,
        viewState: {}, sheetImportMappedRows: () => [row],
        fieldValue: (id: string) => id === 'siHeaderRowInput' ? '3' : 'newOnly',
        setSheetImportMsg: message, SHEET_IMPORT_MAX_ROWS: 100,
        currentSheetImportMapping: () => ({ barcode: 0, dod: 1, cod: 2, phone: 3 }),
        captureSheetImportOperation: () => () => true,
        captureSheetImportData: () => () => null,
        runPreparedAppWrite_: write
    });
    vm.runInContext(bodies, ctx);
    await vm.runInContext('runSheetImport()', ctx);
    expect(write).toHaveBeenCalledTimes(valid ? 1 : 0);
    if (!valid) {
        expect(message).toHaveBeenCalledWith('siActionMsg', expect.stringContaining('ជួរដេក 4'), 'bad');
        expect(ctx.viewState.siImportBtnDisabled).toBe(true);
    }
});
