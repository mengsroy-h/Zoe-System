import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const sourceRoot = process.env.ZOE_TOOLS_SOURCE_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const html = fs.readFileSync(path.join(sourceRoot, 'zto-import/Index.html'), 'utf8');
const script = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map((m) => m[1]).filter((s) => s.trim()).join('\n');
const rowsA = [['Barcode', 'COD', 'Phone'], ['A0001', 11, '081111111']];
const rowsB = [['COD', 'Barcode', 'Phone'], [22, 'B0002', '082222222']];
const replyA = { signature: 'signature-A', source: 'saved', mode: 'upsert', mapping: { barcode: 0, cod: 1, dod: -1, phone: 2 } };
const replyB = { signature: 'signature-B', source: 'saved', mode: 'upsert', mapping: { barcode: 1, cod: 0, dod: -1, phone: 2 } };
const flush = async () => { for (let i = 0; i < 4; i++) await Promise.resolve(); };

function harness() {
    const elements = new Map<string, any>();
    const requests: any[] = [], imports: any[] = [], readers: any[] = [];
    const el = (id: string) => {
        if (!elements.has(id)) {
            const item: any = { value: id === 'headerRow' ? '1' : '', disabled: id === 'importBtn', textContent: '', children: [], listeners: {}, classList: { toggle() {}, add() {}, remove() {} }, appendChild(child: any) { this.children.push(child); if (child.value && !this.value) this.value = child.value; }, addEventListener(name: string, fn: any) { this.listeners[name] = fn; } };
            Object.defineProperty(item, 'innerHTML', { get: () => '', set: () => { item.children = []; } });
            elements.set(id, item);
        }
        return elements.get(id);
    };
    let success: any, failure: any;
    const gateway: any = new Proxy({ withSuccessHandler: (fn: any) => { success = fn; return gateway; }, withFailureHandler: (fn: any) => { failure = fn; return gateway; } }, {
        get(target: any, name: string) {
            if (name in target) return target[name];
            return (...args: any[]) => { if (name === 'prepare') requests.push({ args, resolve: success, reject: failure }); else if (name === 'importRows') imports.push(args[1]); };
        }
    });
    const books: Record<number, any> = { 1: { SheetNames: ['first'], Sheets: { first: rowsA } }, 2: { SheetNames: ['second'], Sheets: { second: rowsB } } };
    class Reader {
        onload: any; onerror: any; file: any;
        constructor() { readers.push(this); }
        readAsArrayBuffer(file: any) { this.file = file; }
        finish() { this.onload({ target: { result: new Uint8Array([this.file.book]).buffer } }); }
    }
    const context: any = vm.createContext({ console, Date, Promise, Uint8Array, FileReader: Reader, XLSX: { read: (bytes: Uint8Array) => books[bytes[0]], utils: { sheet_to_json: (sheet: any) => sheet } }, window: { confirm: () => true }, localStorage: { removeItem() {} }, document: { getElementById: el, createElement: () => ({ value: '', textContent: '', appendChild() {} }) }, google: { script: { run: gateway } } });
    vm.runInContext(script, context);
    context.state.password = 'synthetic-password';
    const prepare = (rows: any) => { context.state.rows = rows; el('headerRow').value = '1'; context.applyHeaderRow(); };
    return { context, el, requests, imports, readers, prepare };
}

describe('Apps Script UI ៖ prepare ត្រូវជារបស់ file/tab/header ដែលសកម្ម', () => {
    it('control ៖ prepare បច្ចុប្បន្នអនុញ្ញាត import payload ត្រឹមត្រូវ', async () => {
        const h = harness(); h.prepare(rowsB);
        h.requests[0].resolve(replyB); await flush(); h.context.runImport();
        expect(h.imports.length).toBe(1);
        expect(JSON.parse(JSON.stringify(h.imports[0]))).toMatchObject({ signature: 'signature-B', rows: [['B0002', 0, 22, '082222222']] });
    });
    for (const order of [[0, 1], [1, 0]]) {
        it('ចម្លើយសំណើចាស់មិនជំនួស mapping ថ្មី ៖ ' + order.join(','), async () => {
            const h = harness(); h.prepare(rowsA); h.prepare(rowsB);
            for (const index of order) { h.requests[index].resolve(index ? replyB : replyA); await flush(); }
            h.context.runImport();
            expect(h.imports.length).toBe(1);
            expect(JSON.parse(JSON.stringify(h.imports[0]))).toMatchObject({ signature: 'signature-B', rows: [['B0002', 0, 22, '082222222']] });
        });
    }
    it('pending prepare ទប់ import ទោះ mapping ដោយដៃនៅមាន usable rows', async () => {
        const h = harness(); h.prepare(rowsA); h.requests[0].resolve(replyA); await flush();
        h.prepare(rowsB); h.context.renderPreview(); h.context.runImport();
        expect(h.el('importBtn').disabled).toBe(true);
        expect(h.imports).toHaveLength(0);
    });
    it('stale failure មិនជំនួសសារ success បច្ចុប្បន្ន', async () => {
        const h = harness(); h.prepare(rowsA); h.prepare(rowsB);
        h.requests[1].resolve(replyB); await flush();
        const message = h.el('mapMsg').children[0].textContent;
        h.requests[0].reject(new Error('stale failure')); await flush();
        expect(h.el('mapMsg').children[0].textContent).toBe(message);
        expect(h.el('importBtn').disabled).toBe(false);
    });
    it('current failure មិនត្រូវ stale success ធ្វើឲ្យ import វិញ', async () => {
        const h = harness(); h.prepare(rowsA); h.prepare(rowsB);
        h.requests[1].reject(new Error('current failure')); await flush();
        h.requests[0].resolve(replyA); await flush(); h.context.runImport();
        expect(h.el('importBtn').disabled).toBe(true);
        expect(h.imports).toHaveLength(0);
    });
    it('reset បោះបង់ pending prepare និងការអាន file ចាស់', async () => {
        const h = harness(); h.prepare(rowsA); h.context.handleFile({ name: 'late.xlsx', book: 1 });
        h.context.resetAll(); h.requests[0].resolve(replyA); await flush(); h.readers[0].finish(); await flush();
        expect(h.context.state.workbook).toBe(null);
        expect(h.context.state.signature).toBe('');
        expect(h.context.state.prepared).toBe(null);
        expect(h.el('importBtn').disabled).toBe(true);
        expect(h.requests).toHaveLength(1);
    });
    it('file reader ចាស់មកយឺត មិនជំនួស file ថ្មី', async () => {
        const h = harness(); h.context.handleFile({ name: 'A.xlsx', book: 1 }); h.context.handleFile({ name: 'B.xlsx', book: 2 });
        h.readers[1].finish(); h.requests[0].resolve(replyB); await flush(); h.readers[0].finish(); await flush();
        expect(h.context.state.workbook.SheetNames[0]).toBe('second');
        expect(h.requests).toHaveLength(1);
        h.context.runImport(); expect(h.imports[0].rows[0][0]).toBe('B0002');
    });
    it('file reader failure ចាស់មិនជំនួសសាររបស់ file ថ្មី', async () => {
        const h = harness(); h.context.handleFile({ name: 'A.xlsx', book: 1 }); h.context.handleFile({ name: 'B.xlsx', book: 2 });
        h.readers[1].finish(); h.requests[0].resolve(replyB); await flush();
        const message = h.el('fileMsg').children[0].textContent;
        h.readers[0].onerror();
        expect(h.el('fileMsg').children[0].textContent).toBe(message);
        expect(h.el('importBtn').disabled).toBe(false);
    });
    it('tab និង header change បោះបង់ prepare ចាស់; input មិនទាន់ blur ក៏ទប់ import', async () => {
        const h = harness(); h.prepare(rowsA);
        h.context.state.workbook = { Sheets: { next: rowsB } }; h.el('sheetSel').value = 'next'; h.context.loadSheet();
        h.requests[1].resolve(replyB); await flush(); h.requests[0].resolve(replyA); await flush();
        expect(h.context.state.signature).toBe('signature-B');
        h.el('headerRow').value = '2'; h.el('headerRow').listeners.input?.(); h.context.runImport();
        expect(h.el('importBtn').disabled).toBe(true);
        expect(h.imports).toHaveLength(0);
        h.el('headerRow').value = '1'; h.el('headerRow').listeners.input?.();
        h.requests[h.requests.length - 1].resolve(replyB); await flush(); h.context.runImport();
        expect(h.imports[0].rows[0][0]).toBe('B0002');
    });
});
