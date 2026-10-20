const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ថត app អាច override បាន ដើម្បីឲ្យ `run-all.sh <baseline>` និង
// `checker-coverage.js` បញ្ជាក់បានថា checker នេះពិតជាអានកូដមែន។
const root = process.env.SHEETCACHE_APP_DIR ? path.resolve(process.env.SHEETCACHE_APP_DIR) : path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'zto-import', 'google-sheets-api', 'Code.gs'), 'utf8');
const VERSION = Number((/var\s+SCRIPT_VERSION\s*=\s*(\d+)\s*;/.exec(source) || [])[1]);

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
        PropertiesService: { getScriptProperties: () => ({ getProperty: () => (options.secret === undefined ? 'test-secret' : options.secret) }) },
        SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: () => (options.noTab ? null : sheet) }) },
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
        phone: '012345678',
        scriptVersion: VERSION
    });
    assert.deepStrictEqual(api.calls.remove, ['customer_rows_v2_2']);
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
    assert.strictEqual(list.scriptVersion, VERSION);
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
        phone: '010101',
        scriptVersion: VERSION
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
        ],
        scriptVersion: VERSION
    });
    assert.strictEqual(api.calls.put.length, 1);
    assert.strictEqual(api.calls.put[0].key, 'customer_rows_v2_3');
    const declaredTtl = /var\s+CACHE_TTL_SECONDS\s*=\s*(\d+)\s*;/.exec(source);
    assert.ok(declaredTtl, 'CACHE_TTL_SECONDS ត្រូវប្រកាសជាចំនួនគត់');
    assert.ok(Number(declaredTtl[1]) >= 10 && Number(declaredTtl[1]) <= 60,
        '⛔ cache អ្នកអាន ≤ ៦០ វិ. (ការសម្រេចម្ចាស់គម្រោង ៖ ការនាំចូលក្រៅ ZoeW ត្រូវឃើញលើឧបករណ៍ផ្សេងក្នុង ១ នាទី) · ≥ ១០ វិ. (quota) — បាន ' + declaredTtl[1]);
    assert.strictEqual(api.calls.put[0].ttl, Number(declaredTtl[1]));
    assert.deepStrictEqual(JSON.parse(api.calls.put[0].value), rows);
}

testMalformedCachedRowsRefreshes();
testOversizeRowsSkipCacheAndRespond();
testCachePutFailureDoesNotBreakLookup();
testSmallRowsAreCached();

// ⛔ កំណែ Script ត្រូវឡើងលើ **រាល់** ចម្លើយ — ការដាក់វាក្នុង `jsonResponse()`
//    (ចំណុចរួមតែមួយ) ជាអ្វីដែលធានាថាគ្មានផ្លូវណាភ្លេចវា។ បើថ្ងៃណានរណាម្នាក់
//    សរសេរ `ContentService.createTextOutput(...)` ដោយផ្ទាល់ ការអះអាងនេះធ្លាក់។
function testEveryResponseCarriesScriptVersion() {
    const src = source;
    const declared = /var\s+SCRIPT_VERSION\s*=\s*(\d+)\s*;/.exec(src);
    assert.ok(declared, 'SCRIPT_VERSION ត្រូវប្រកាសជាចំនួនគត់');
    const version = Number(declared[1]);

    const api = createApi({ rows: [['V-1', 1, 2, '0123']] });
    const responses = [
        api.request({ code: 'V-1' }),
        api.request({ code: 'NOT-THERE' }),
        api.request({ list: '1' }),
        api.request({ key: 'wrong-key' })
    ];
    for (const res of responses) {
        assert.strictEqual(res.scriptVersion, version);
    }

    const outputs = (src.match(/ContentService\.createTextOutput/g) || []).length;
    assert.strictEqual(outputs, 1, 'ត្រូវមានចំណុចចេញតែ ១ (jsonResponse) ➜ គ្មានផ្លូវណារំលងកំណែបាន');
}

testEveryResponseCarriesScriptVersion();

// ⛔ ចម្លើយអ្នកអានត្រូវប្រាប់ការពិត ៖ tab បាត់ ≠ «គ្មានទិន្នន័យ» · លុយជាអក្សរ ≠ 0 · លេខទូរស័ព្ទជាសញ្ញា («-») ≠ លេខ
//    (ZoeW រក្សាទុកស្វ័យប្រវត្តិពេលមានលេខទូរស័ព្ទ) · API_KEY មានបន្ទាត់ថ្មីក្រោយ ≠ key ខុស
function testReaderTellsTheTruth() {
    assert.ok(VERSION >= 2, 'SCRIPT_VERSION ត្រូវឡើងពេលអ្នកអានប្រែ — បាន ' + VERSION);
    const missing = createApi({ rows: [], noTab: true });
    for (const res of [missing.request({ list: '1' }), missing.request({ code: 'X' })]) {
        assert.ok(res.error && /sheet-missing/.test(res.error), 'tab Customers បាត់ ➜ error មិនមែន found:false — ' + JSON.stringify(res));
        assert.strictEqual(res.rows, undefined);
    }
    const api = createApi({ secret: 'test-secret\n', rows: [['M-1', '$1,250.50', ' 15.5 ', '-'], ['M-2', 'abc', 2, "'"], ['M-3', 0, 3, '012 345']] });
    const list = api.request({ list: '1' });
    assert.deepStrictEqual(list.rows, [
        { barcode: 'M-1', dod: 1250.5, cod: 15.5, phone: '' },
        { barcode: 'M-2', dod: 0, cod: 2, phone: '' },
        { barcode: 'M-3', dod: 0, cod: 3, phone: '012 345' }
    ]);
    const one = api.request({ code: 'm-1' });
    assert.deepStrictEqual([one.found, one.dod, one.cod, one.phone], [true, 1250.5, 15.5, '']);
    assert.strictEqual(createApi({ secret: '  ', rows: [] }).request({ list: '1' }).error.indexOf('API_KEY'), 0);
}

testReaderTellsTheTruth();
console.log('google-sheets-cache-test: PASS');
