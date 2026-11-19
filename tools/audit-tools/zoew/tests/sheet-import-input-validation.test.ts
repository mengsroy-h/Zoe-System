import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { sheetImportState, uiState } from '../../../../ZoeW/src/core/state';
import { viewState } from '../../../../ZoeW/src/core/view-state';
import { emptySheetImportView } from '../../../../ZoeW/src/app/components/sheet/model';
import { clearSheetImportSession, sheetImportMappedRows, renderSheetImportPreview, runSheetImport, sheetImportToMoney, handleSheetImportFile } from '../../../../ZoeW/src/features/sheet-import';
import { sheetImportStrictMoney, validateDelimitedTextQuotes, validateSheetImportDelimitedBytes } from '../../../../ZoeW/src/features/sheet-import-validation';
vi.mock('../../../../ZoeW/src/features/export', async (original) => ({ ...await original<typeof import('../../../../ZoeW/src/features/export')>(), loadScriptOnce: vi.fn(async () => {}) }));
function rows(cells: any[][]) {
    sheetImportState.sheetImportSheetRows = [['Barcode', 'DOD', 'COD'], ...cells];
    uiState.sheetImportView = emptySheetImportView();
    for (const [field, index] of Object.entries({ Barcode: 0, Dod: 1, Cod: 2, Phone: -1 })) {
        uiState.sheetImportView.mapping['siMap' + field] = { options: [], value: String(index) };
    }
}
beforeEach(() => {
    clearSheetImportSession();
    rows([]);
    vi.stubGlobal('fetch', vi.fn());
    vi.stubGlobal('confirm', vi.fn(() => true));
});
afterEach(() => { clearSheetImportSession(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it.each(['abc', '5USDjunk', '៛5000', 'KHR5000', 'USD5$', '1,234', Infinity, {}, true])('ទឹកប្រាក់ខុស %s ៖ បិទ preview និងមិនផ្ញើសំណើ', async (value) => {
    rows([['A001', value, '2.50']]);
    // The ambiguous format case must have no decimal-style evidence.
    if (value === '1,234') rows([['A001', value, 2]]);
    uiState.sheetImportView.msgs.siMapMsg = { text: 'saved mapping', kind: 'ok' };
    renderSheetImportPreview();
    expect(viewState.siImportBtnDisabled).toBe(true);
    expect(uiState.sheetImportView.previewRows).toEqual([]);
    expect(uiState.sheetImportView.chips[0].kind).toBe('bad');
    expect(uiState.sheetImportView.msgs.siMapMsg?.text).toBe('saved mapping');
    await runSheetImport();
    expect(fetch).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
    expect(uiState.sheetImportView.msgs.siActionMsg?.kind).toBe('bad');
});
it('កែ mapping ឡើងវិញ ៖ preview បើកវិញ ហើយមិនប្តូរសារផ្គូផ្គង', () => {
    rows([['A001', 'bad', 5]]); renderSheetImportPreview();
    uiState.sheetImportView.mapping.siMapDod.value = '-1'; renderSheetImportPreview();
    expect(viewState.siImportBtnDisabled).toBe(false);
    expect(uiState.sheetImportView.previewRows).toEqual([['A001', '0.00', '5.00', '']]);
});
it('រើស decimal តែជួរមាន barcode និង Column បានផ្គូផ្គង', () => {
    rows([['A001', '1,234', 0], ['', '3.50', 0]]);
    expect(sheetImportMappedRows()[0][1]).toBeNull();
    rows([['A001', '1,234', '3.50']]);
    expect(sheetImportMappedRows()[0][1]).toBe(1234);
    uiState.sheetImportView.mapping.siMapCod.value = '-1';
    expect(sheetImportMappedRows()[0][1]).toBeNull();
});
it.each([['១២.៥០', 12.5], ['USD 2.50', 2.5], ['$-2.50', -2.5], ['1 234,50', 1234.5], ['="2.50"', 2.5], ['', 0], [null, 0]])('រក្សាទម្រង់ត្រឹមត្រូវ %s', (value, expected) => {
    expect(sheetImportStrictMoney(value, '.')).toBe(expected);
});
it('មិនប្តូរ legacy customer-table helper', () => { expect(sheetImportToMoney('abc')).toBe(0); expect(sheetImportToMoney('USD 5')).toBe(5); });
it.each([['a,b\nA,"2', ''], ['a\tb\nA\t"2', '\t'], ['sep=;\na;b\nA;"2', ''], ['a|b\nA|"2', '']])('CSV មិនបិទ quote ត្រូវបដិសេធ %s', (text, hint) => {
    expect(() => validateDelimitedTextQuotes(text, hint)).toThrow();
});
it('CSV ត្រឹមត្រូវ រួម newline និង escaped quotes', () => {
    expect(validateDelimitedTextQuotes('a,b\nA,"hello\n""world"""', '')).toBe(',');
});
it.each([';', '\t'])('preamble មាន comma មិនប្តូរ delimiter %s', (sep) => {
    const text = 'Report, daily\na' + sep + 'b' + sep + 'c\nA' + sep + '2' + sep + '3';
    expect(validateDelimitedTextQuotes(text, '')).toBe(sep);
    expect(() => validateDelimitedTextQuotes(text + '\nB' + sep + '"2', '')).toThrow();
});
it('រក្សា binary និង HTML ហើយពិនិត្យ UTF16 CSV', () => {
    expect(validateSheetImportDelimitedBytes(new Uint8Array([0x50, 0x4b]), 'a.csv')).toBeUndefined();
    expect(validateSheetImportDelimitedBytes(new TextEncoder().encode('<table>"</table>'), 'a.xls')).toBeUndefined();
    const text = 'a,b\nA,"2';
    const bytes = new Uint8Array([0xff, 0xfe, ...Array.from(text).flatMap(ch => [ch.charCodeAt(0), 0])]);
    expect(() => validateSheetImportDelimitedBytes(bytes, 'a.txt')).toThrow();
});
it('FileReader ពិត ៖ មិនហៅ SheetJS ឬ fetch ពេល CSV មិនបិទ quote', async () => {
    const read = vi.fn(); vi.stubGlobal('XLSX', { read });
    await handleSheetImportFile(new File(['a,b\nA,"2'], 'bad.txt', { type: 'text/plain' }));
    expect(read).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(sheetImportState.sheetImportWorkbook).toBeNull();
    expect(uiState.sheetImportView.msgs.siFileMsg?.text).toContain('CSV');
});
