const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'ZoeAdmin', 'google-sheets-api', 'Code.gs'), 'utf8');

function createApi(options) {
    const rows = options.rows.map((row) => row.slice(0, 4));
    const calls = { get: [], put: [], remove: [], ranges: 0 };
    const cache = {
        get(key) {
            calls.get.push(key);
            return options.cached || null;
        },
        put(key, value, ttl) {
            calls.put.push({ key, value, ttl });
            if (options.putError) throw options.putError;
        },
        remove(key) {
            calls.remove.push(key);
            if (options.removeError) throw options.removeError;
        }
    };
    const sheet = {
        getLastRow() {
            return rows.length + 1;
        },
        getRange(startRow, startColumn, rowCount, columnCount) {
            calls.ranges++;
            assert.deepStrictEqual([startRow, startColumn, rowCount, columnCount], [2, 1, rows.length, 4]);
            return { getValues: () => rows.map((row) => row.slice()) };
        }
    };
    const context = {
        PropertiesService: { getScriptProperties: () => ({ getProperty: () => 'test-secret' }) },
        SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: () => sheet }) },
        CacheService: { getScriptCache: () => cache },
        Utilities: {
            newBlob(value) {
                return { getBytes: () => Array.from(Buffer.from(String(value), 'utf8')) };
            }
        },
        ContentService: {
            MimeType: { JSON: 'application/json' },
            createTextOutput(value) {
                return {
                    value,
                    mimeType: null,
                    setMimeType(mimeType) {
                        this.mimeType = mimeType;
                        return this;
                    }
                };
            }
        }
    };
    vm.createContext(context);
    vm.runInContext(source, context, { filename: 'Code.gs' });
    return {
        calls,
        request(parameters) {
            const output = context.doGet({ parameter: { key: 'test-secret', ...parameters } });
            assert.strictEqual(output.mimeType, 'application/json');
            return JSON.parse(output.value);
        }
    };
}

function testMalformedCachedRowsRefreshes() {
    const api = createApi({
        cached: '{not-valid-json',
        rows: [['abc-1', 12, 34, ' 012345678 ']]
    });
    const result = api.request({ code: ' abc-1 ' });
    assert.deepStrictEqual(result, {
        found: true,
        barcode: 'abc-1',
        dod: 12,
        cod: 34,
        phone: '012345678'
    });
    assert.deepStrictEqual(api.calls.remove, ['customer_rows']);
    assert.strictEqual(api.calls.ranges, 1);
    assert.strictEqual(api.calls.put.length, 1);
}

function testOversizeRowsSkipCacheAndRespond() {
    const oversizedPhone = '9'.repeat(110000);
    const api = createApi({ rows: [['BIG-1', 45, 67, oversizedPhone]] });
    const lookup = api.request({ code: 'big-1' });
    const list = api.request({ list: 'true' });
    assert.strictEqual(lookup.found, true);
    assert.strictEqual(lookup.barcode, 'BIG-1');
    assert.strictEqual(lookup.phone, oversizedPhone);
    assert.deepStrictEqual(list.rows, [{ barcode: 'BIG-1', dod: 45, cod: 67, phone: oversizedPhone }]);
    assert.strictEqual(api.calls.put.length, 0);
    assert.strictEqual(api.calls.ranges, 2);
}

function testCachePutFailureDoesNotBreakLookup() {
    const api = createApi({
        putError: new Error('cache unavailable'),
        rows: [['SAFE-1', 5, 6, '010101']]
    });
    const result = api.request({ code: 'safe-1' });
    assert.deepStrictEqual(result, {
        found: true,
        barcode: 'SAFE-1',
        dod: 5,
        cod: 6,
        phone: '010101'
    });
    assert.strictEqual(api.calls.put.length, 1);
    assert.strictEqual(api.calls.ranges, 1);
}

function testSmallRowsAreCached() {
    const rows = [['CACHE-1', 1, 2, '0123'], ['CACHE-2', 3, 4, '0456']];
    const api = createApi({ rows });
    const result = api.request({ list: '1' });
    assert.deepStrictEqual(result, {
        rows: [
            { barcode: 'CACHE-1', dod: 1, cod: 2, phone: '0123' },
            { barcode: 'CACHE-2', dod: 3, cod: 4, phone: '0456' }
        ]
    });
    assert.strictEqual(api.calls.put.length, 1);
    assert.strictEqual(api.calls.put[0].key, 'customer_rows');
    assert.strictEqual(api.calls.put[0].ttl, 300);
    assert.deepStrictEqual(JSON.parse(api.calls.put[0].value), rows);
}

testMalformedCachedRowsRefreshes();
testOversizeRowsSkipCacheAndRespond();
testCachePutFailureDoesNotBreakLookup();
testSmallRowsAreCached();
console.log('google-sheets-cache-test: PASS');
