const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ថត app អាច override បាន ដើម្បីឲ្យ `run-all.sh <baseline>` និង
// `checker-coverage.js` បញ្ជាក់បានថា checker នេះពិតជាអានកូដមែន។
const root = process.env.SHEETCACHE_APP_DIR ? path.resolve(process.env.SHEETCACHE_APP_DIR) : path.resolve(__dirname, '..');

// ⛔ `SCRIPT_VERSION` នៃកូដពិត — ការចាក់លេខនេះជា literal ក្នុង checker
// គឺជា **កាលបរិច្ឆេទផុតកំណត់** ៖ ជុំណាប៉ុន្មានដែលឡើង `SCRIPT_VERSION`
// ដោយ **ត្រឹមត្រូវ** នឹងធ្វើឲ្យ checker ធ្លាក់ — នោះជាទោស មិនមែនការការពារ។
const source = fs.readFileSync(path.join(root, 'zto-import', 'google-sheets-api', 'Code.gs'), 'utf8');
const SCRIPT_VERSION_REAL = (function () {
    const m = /var\s+SCRIPT_VERSION\s*=\s*(\d+)\s*;/.exec(source);
    if (!m) throw new Error('⛔ អាន SCRIPT_VERSION ចេញពី Code.gs មិនបាន');
    return Number(m[1]);
})();

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
        phone: '012345678',
        scriptVersion: SCRIPT_VERSION_REAL
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
    assert.strictEqual(list.scriptVersion, SCRIPT_VERSION_REAL);
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
        scriptVersion: SCRIPT_VERSION_REAL
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
        scriptVersion: SCRIPT_VERSION_REAL
    });
    assert.strictEqual(api.calls.put.length, 1);
    assert.strictEqual(api.calls.put[0].key, 'customer_rows_v2_3');
    assert.strictEqual(api.calls.put[0].ttl, 300);
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

// ⛔ ស្នាមភ្ជាប់ទី ២ ៖ `SCRIPT_VERSION` នៃ `Code.gs` និង
//    `SHEET_SCRIPT_VERSION_EXPECTED` នៃ `ZoeW/app.js` ជា **literal ២ ខាងឯករាជ្យ**
//    ➜ ការស៊ីគ្នារបស់ពួកវាជា **ការស៊ីគ្នាដោយចៃដន្យ**។
//
//    ⛔ មុននេះ checker នេះចាក់សោតែ **យន្តការ** (គ្រប់ចម្លើយផ្ទុកកំណែ)
//    ចំណែក `health-check-test` **ចាក់** តម្លៃនោះចូល sandbox ដោយផ្ទាល់ ➜
//    វា **stub ស្នាមភ្ជាប់ដែលវាកំពុងវាស់** ➜ drift កើតដោយគ្មានអ្នកដឹង។
//
//    ផលប៉ះពាល់មាន ២ ទិស ៖ ឡើង `Code.gs` ដោយភ្លេច `app.js` ➜ អ្នកប្រើអាន
//    «`Script` ថ្មីជាង App» ខណៈគ្មានអ្វីខុស ; ឡើង `app.js` ដោយភ្លេច `Code.gs`
//    ➜ អ្នកប្រើអាន «សូម Deploy ជាកំណែថ្មី» ខណៈពួកគេ Deploy រួចហើយ។
function testAppExpectationMatchesScript() {
    const declared = /var\s+SCRIPT_VERSION\s*=\s*(\d+)\s*;/.exec(source);
    assert.ok(declared, 'SCRIPT_VERSION ត្រូវប្រកាសក្នុង Code.gs');

    const appFile = path.join(root, 'ZoeW', 'app.js');
    const appSrc = fs.readFileSync(appFile, 'utf8');
    const expected = /SHEET_SCRIPT_VERSION_EXPECTED\s*=\s*(\d+)\s*;/.exec(appSrc);
    assert.ok(expected, 'ZoeW/app.js ត្រូវប្រកាស SHEET_SCRIPT_VERSION_EXPECTED');

    assert.strictEqual(Number(expected[1]), Number(declared[1]),
        'SHEET_SCRIPT_VERSION_EXPECTED (' + expected[1] + ') ត្រូវស្មើ '
        + 'SCRIPT_VERSION នៃ google-sheets-api/Code.gs (' + declared[1] + ')');
}

testAppExpectationMatchesScript();
console.log('google-sheets-cache-test: PASS');
