// ⛔ ថ្នាក់កំហុស៖ **ឧបករណ៍វិនិច្ឆ័យដែលនិយាយមិនពិត។**
//
// ការពិនិត្យសុខភាពត្រូវជា **ការអានសុទ្ធសាធ** ៖ អ្នកប្រើបើកវាពេល App មាន
// បញ្ហារួចទៅហើយ ➜ វា **មិនត្រូវសរសេរអ្វី** · មិនត្រូវបង្ខំ PIN · និងមិនត្រូវ
// អះអាងលើសអ្វីដែលវាវាស់បាន។ ថ្នាក់ដែលឯកសារនេះបិទ ៖
//
//   ១. **«ពិនិត្យមិនបាន» ត្រូវរាយជា ⚠️ មិនមែន ❌។** ច្បាប់ដដែលនឹង
//      `license-verify.js` ៖ «មិនអាចផ្ទៀងផ្ទាត់» ≠ «ខុស»។ បើ getStatus()
//      បដិសេធ ឬក្រៅបណ្ដាញ ការរាយជា ❌ ធ្វើឲ្យអ្នកប្រើដេញតាមកំហុសដែលមិនមាន។
//   ២. **secret មិនត្រូវឡើងដល់ DOM។** តម្លៃ header របស់ ZTO ជា credential —
//      វាត្រូវទៅតែក្នុង request header មិនមែនក្នុងអត្ថបទដែលបង្ហាញ។
//   ៣. **Apps Script មិនត្រូវទទួល header ផ្ទាល់ខ្លួន** (preflight ➜ ស្លាប់) ➜
//      ផ្លូវនោះមិនត្រូវហៅបណ្ដាញសោះ។
//   ៤. **មិនបង្ខំ PIN** — សោដែលបិទ ➜ រាយមូលហេតុ មិនមែនបើកប្រអប់ PIN។
//   ៥. **គ្មានការសរសេរ** — ការវិនិច្ឆ័យមិនត្រូវប៉ះ Firebase ឬលុយ។
//
// ⛔ ការអះអាងមាន **២ ខាង** ៖ ករណីល្អត្រូវរាយ ✅ ពិត (បើអត់ «រាយ ⚠️ គ្រប់ពេល»
//    ក៏បៃតងដែរ ដែលជាឧបករណ៍ឥតប្រយោជន៍)។
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = process.env.HEALTH_APP_DIR ? path.resolve(process.env.HEALTH_APP_DIR) : path.resolve(__dirname, '..');
const APP_JS = path.join(ROOT, 'ZoeW', 'app.js');

let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { console.log('   ok    ' + label); pass++; }
    else { console.log('   FAIL  ' + label + (detail !== undefined ? '  ➜ ' + JSON.stringify(detail) : '')); fail++; }
}

let SRC = '';
try { SRC = fs.readFileSync(APP_JS, 'utf8'); } catch (e) { SRC = ''; }
ok('អាន ZoeW/app.js បាន (ជាន់អប្បបរមា)', SRC.length > 100000, SRC.length);

function sliceFn(name) {
    let start = SRC.indexOf('function ' + name + '(');
    if (start === -1) return null;
    if (SRC.slice(Math.max(0, start - 6), start) === 'async ') start -= 6;
    let depth = 0, i = SRC.indexOf('{', start), started = false;
    for (; i < SRC.length; i++) {
        if (SRC[i] === '{') { depth++; started = true; }
        else if (SRC[i] === '}') { depth--; if (started && depth === 0) { i++; break; } }
    }
    return SRC.slice(start, i);
}

const NEEDED = ['healthRowHtml', 'healthAgeText', 'healthNetworkRow', 'healthDatabaseRow',
    'healthClockRow', 'healthLicenseRow', 'healthCustomerTableRow', 'healthStorageRow',
    'healthServiceWorkerRow', 'healthLookupRow', 'healthSheetScriptRow', 'clearCustomerDataTableCache', 'ztoDiagnosticsUrl', 'runHealthCheck',
    'openHealthCheck', 'safeLookupReason', 'lookupApiIsZto', 'lookupApiIsAppsScript',
    'sanitizeInput', 'elapsedSince', 'fetchWithTimeout'];
const src = {};
NEEDED.forEach((n) => {
    src[n] = sliceFn(n);
    ok('រកឃើញ function ' + n + '()', !!src[n]);
});

const SECRET = 'super-secret-proxy-key-9911';

function buildRuntime(over) {
    const o = over || {};
    const fetches = [];
    const pinPrompts = [];
    const listEl = { innerHTML: '' };
    const btnEl = { disabled: false };
    const modalEl = { style: { display: 'flex' } };
    const ctx = {
        console: { error: () => {}, log: () => {} },
        Object, Array, Promise, JSON, String, Number, Math, Date, Error, Set, Map,
        isFinite, parseFloat, isNaN, URL, setTimeout, clearTimeout,
        navigator: { onLine: o.online !== false, serviceWorker: o.sw === false ? {} : { controller: {} } },
        window: { ZoeLicense: o.license === null ? null : { getStatus: o.license || (() => Promise.resolve({ state: 'active' })) } },
        ZoeLicense: o.license === null ? null : { getStatus: o.license || (() => Promise.resolve({ state: 'active' })) },
        LICENSE_APP_CODE: 'ADM',
        ZTO_TEST_TIMEOUT_MS: 11000,
        DB_LISTENER_KEYS: ['exchangeRate', 'dailyRevenue', 'monthlyRevenue', 'dailyPickup', 'history', 'deleted'],
        isDatabaseConnected: o.dbConnected !== false,
        hasEverConnectedToDatabase: true,
        serverClockTrusted: o.clockTrusted !== false,
        serverTimeOffsetMs: o.offset === undefined ? 0 : o.offset,
        appLocalStore: o.localStore === null ? null : {},
        appSessionStore: {},
        customerDataTableRows: o.rows === undefined ? null : o.rows,
        customerDataTableFetchedAt: 1,
        customerTableIsPartial: !!o.partial,
        lookupSecretKey: o.unlocked === false ? null : {},
        SHEET_SCRIPT_VERSION_EXPECTED: 1,
        sheetScriptVersionSeen: o.scriptSeen === undefined ? null : o.scriptSeen,
        dbListenerViewIsStale: () => !!o.stale,
        cleanupClockIsTrustworthy: () => o.cleanupOk !== false,
        getServerNow: () => 1770000000000,
        getLookupApiConfig: () => (o.cfg === undefined ? null : o.cfg),
        decryptLookupSecret: () => Promise.resolve(o.secretPlain === undefined ? SECRET : o.secretPlain),
        withTimeout: (p) => p,
        AbortController: typeof AbortController === 'function' ? AbortController : undefined,
        // ⛔ `fetchWithTimeout` ត្រូវជា **កូដពិត** ដែលស្រង់ចេញពី app.js ៖ វាដោះ
        //    ជា `{ res, body }` មិនមែន `Response` ទេ។ ជំនាន់មុននៃឯកសារនេះ
        //    **stub វា** ➜ ការហៅដែលអានវាជា `Response` (`res.ok` = undefined)
        //    ឆ្លងកាត់ការវាស់ ➜ ផលិតកម្មរាយ «HTTP undefined» ជា ❌ លើ Cookie
        //    ដែលដំណើរការធម្មតា។ **ការ stub ស្នាមភ្ជាប់ដែលកំពុងវាស់ = ការវាស់
        //    អ្វីផ្សេង។** ដូច្នេះឥឡូវ stub តែ `fetch` ប៉ុណ្ណោះ។
        fetch: (url, init) => {
            fetches.push({ url, headers: (init && init.headers) || {} });
            if (o.fetchImpl) return o.fetchImpl(url, init);
            const status = o.httpStatus || 200;
            const okRes = status >= 200 && status < 300;
            return Promise.resolve({
                ok: okRes,
                status: status,
                json: () => Promise.resolve(o.diagBody || {
                    ok: true, cookie: { source: 'blob', fingerprint: 'a1b2c3d4', ageMs: 600000, storeReason: 'env-fallback' }
                })
            });
        },
        closeSideDrawer: () => {},
        openModalHelper: () => {},
        requestPinBeforeConfig: (fn, key) => { pinPrompts.push(key); },
        document: { getElementById: (id) => (id === 'healthCheckList' ? listEl : id === 'healthRecheckBtn' ? btnEl : id === 'healthCheckModal' ? modalEl : null) }
    };
    ctx.globalThis = ctx;
    vm.createContext(ctx);
    const code = NEEDED.map((n) => src[n]).filter(Boolean).join('\n')
        + "\nconst HEALTH_ICONS = { ok: '\\u2705', warn: '\\u26a0\\ufe0f', bad: '\\u274c', info: '\\u2139\\ufe0f' };"
        + '\nglobalThis.api = { runHealthCheck, healthLookupRow, healthLicenseRow, healthClockRow, healthDatabaseRow, healthStorageRow, healthCustomerTableRow, healthNetworkRow, healthServiceWorkerRow, healthSheetScriptRow, ztoDiagnosticsUrl };';
    vm.runInContext(code, ctx);
    return { api: ctx.api, fetches, pinPrompts, listEl, btnEl };
}

const ZTO_CFG = { enabled: true, url: 'https://x.netlify.app/.netlify/functions/zto-order-detail?barcode={barcode}', headerName: 'X-Zoe-Proxy-Key', headerValueEnc: { data: [1], iv: [2] } };
const SHEET_CFG = { enabled: true, url: 'https://script.google.com/macros/s/AAA/exec', headerName: 'X-Key', headerValueEnc: { data: [1], iv: [2] } };

const state = (html) => (/health-bad/.test(html) ? 'bad' : /health-warn/.test(html) ? 'warn' : /health-ok/.test(html) ? 'ok' : 'info');

(async () => {
    {
        const rt = buildRuntime({ cfg: ZTO_CFG });
        const html = await rt.api.healthLookupRow();
        ok('ZTO ដែលមាន Cookie ➜ រាយ ✅ (ទិសវិជ្ជមាន)', state(html) === 'ok', state(html));
        ok('ZTO ៖ ហៅ diagnostics ពិត ១ ដង', rt.fetches.length === 1, rt.fetches.length);
        ok('ZTO ៖ URL បញ្ចប់ដោយ ?diag=1 លើផ្លូវ Function', /\/\.netlify\/functions\/zto-order-detail\?diag=1$/.test(rt.fetches[0].url), rt.fetches[0].url);
        ok('ZTO ៖ header សម្ងាត់ត្រូវផ្ញើក្នុង request', rt.fetches[0].headers['X-Zoe-Proxy-Key'] === SECRET);
        ok('⛔ ZTO ៖ តម្លៃសម្ងាត់មិនឡើងដល់អត្ថបទដែលបង្ហាញ', html.indexOf(SECRET) === -1);
        ok('ZTO ៖ បង្ហាញលេខសម្គាល់ Cookie ៨ តួ', html.indexOf('a1b2c3d4') !== -1);
        // 🔴 ការថយក្រោយពិត (រាយការណ៍ដោយអ្នកប្រើលើឧបករណ៍ពិត) ៖ កូដអាន
        //    លទ្ធផលរបស់ `fetchWithTimeout` ជា `Response` ➜ `res.ok` undefined
        //    ➜ **រាយ ❌ «HTTP undefined» លើ Cookie ដែលដំណើរការ**។
        ok('⛔ Cookie ដំណើរការ ➜ មិនត្រូវរាយ ❌ ដាច់ខាត', html.indexOf('health-bad') === -1, html.slice(0, 120));
        ok('⛔ គ្មានពាក្យ «undefined» ក្នុងអត្ថបទដែលអ្នកប្រើអាន', html.indexOf('undefined') === -1);
    }
    {
        const rt = buildRuntime({ cfg: ZTO_CFG, httpStatus: 500 });
        const html = await rt.api.healthLookupRow();
        ok('⛔ HTTP 500 ➜ ❌ ព្រមទាំង **លេខពិត** មិនមែន undefined',
            state(html) === 'bad' && /500/.test(html) && html.indexOf('undefined') === -1, html.slice(0, 140));
    }
    {
        const rt = buildRuntime({ cfg: ZTO_CFG, diagBody: { ok: true, cookie: { source: 'none', fingerprint: null } } });
        const html = await rt.api.healthLookupRow();
        ok('⛔ ZTO គ្មាន Cookie ➜ រាយ ❌ ព្រមទាំងវិធីដោះស្រាយ', state(html) === 'bad' && /sync-zto-cookie/.test(html), state(html));
    }
    {
        const rt = buildRuntime({ cfg: ZTO_CFG, online: false });
        const html = await rt.api.healthLookupRow();
        ok('⛔ ក្រៅបណ្ដាញ ➜ ⚠️ មិនមែន ❌ (មិនអះអាងលើអ្វីដែលមិនបានវាស់)', state(html) === 'warn', state(html));
        ok('⛔ ក្រៅបណ្ដាញ ➜ គ្មានការហៅបណ្ដាញសោះ', rt.fetches.length === 0, rt.fetches.length);
    }
    {
        const rt = buildRuntime({ cfg: ZTO_CFG, unlocked: false });
        const html = await rt.api.healthLookupRow();
        ok('⛔ សោមិនទាន់ដោះ ➜ ប្រាប់មូលហេតុ (ℹ️) មិនមែន ❌', state(html) === 'info', state(html));
        ok('⛔ សោមិនទាន់ដោះ ➜ **មិនបង្ខំប្រអប់ PIN**', rt.pinPrompts.length === 0, rt.pinPrompts);
        ok('⛔ សោមិនទាន់ដោះ ➜ គ្មានការហៅបណ្ដាញ', rt.fetches.length === 0, rt.fetches.length);
    }
    {
        const rt = buildRuntime({ cfg: SHEET_CFG });
        const html = await rt.api.healthLookupRow();
        ok('⛔ Apps Script ➜ គ្មានការហៅបណ្ដាញ (preflight នឹងសម្លាប់វា)', rt.fetches.length === 0, rt.fetches.length);
        ok('Apps Script ➜ រាយ ✅ ព្រមទាំងបញ្ជាក់ថាមិនផ្ញើ Header', state(html) === 'ok' && /Header/.test(html), state(html));
        ok('⛔ Apps Script ៖ សម្ងាត់មិនឡើងដល់អត្ថបទ', html.indexOf(SECRET) === -1);
    }
    {
        const rt = buildRuntime({ cfg: undefined });
        const html = await rt.api.healthLookupRow();
        ok('Lookup មិនទាន់បើក ➜ ℹ️ មិនមែនការធ្លាក់', state(html) === 'info', state(html));
    }
    {
        const rt = buildRuntime({ license: () => Promise.reject(new Error('boom')) });
        const html = await rt.api.healthLicenseRow();
        ok('⛔ អាជ្ញាប័ណ្ណពិនិត្យមិនបាន ➜ ⚠️ មិនមែន ❌ («មិនអាចផ្ទៀងផ្ទាត់» ≠ «ខុស»)', state(html) === 'warn', state(html));
        ok('⛔ សារត្រូវប្រាប់ថាវាមិនមែនមានន័យថា Key ខុស', /មិនមែនមានន័យថា/.test(html));
    }
    {
        const rt = buildRuntime({});
        const html = await rt.api.healthLicenseRow();
        ok('អាជ្ញាប័ណ្ណសកម្ម ➜ ✅ (ទិសវិជ្ជមាន)', state(html) === 'ok', state(html));
    }
    {
        const rt = buildRuntime({ dbConnected: false });
        ok('⛔ Firebase ដាច់ ➜ ❌', state(rt.api.healthDatabaseRow()) === 'bad');
        const rt2 = buildRuntime({ stale: true });
        ok('⛔ ភ្ជាប់រួច តែទិន្នន័យមិនមកដល់ ➜ ⚠️ («ភ្ជាប់រួច» ≠ «ទិន្នន័យមកដល់»)', state(rt2.api.healthDatabaseRow()) === 'warn');
        const rt3 = buildRuntime({});
        ok('Firebase ធម្មតា ➜ ✅ (ទិសវិជ្ជមាន)', state(rt3.api.healthDatabaseRow()) === 'ok');
    }
    {
        ok('⛔ នាឡិកាមិនទាន់ sync ➜ ⚠️', state(buildRuntime({ clockTrusted: false }).api.healthClockRow()) === 'warn');
        ok('⛔ ការសម្អាតផ្អាក ➜ ⚠️ ព្រមទាំងមូលហេតុ', state(buildRuntime({ cleanupOk: false }).api.healthClockRow()) === 'warn');
        const okHtml = buildRuntime({ offset: 4200 }).api.healthClockRow();
        ok('នាឡិកាធម្មតា ➜ ✅ ព្រមទាំងគម្លាតជាវិនាទី', state(okHtml) === 'ok' && /4 វិនាទី/.test(okHtml), okHtml);
    }
    {
        ok('⛔ storage ត្រូវបិទ ➜ ❌', state(buildRuntime({ localStore: null }).api.healthStorageRow()) === 'bad');
        ok('storage ធម្មតា ➜ ✅', state(buildRuntime({}).api.healthStorageRow()) === 'ok');
        ok('⛔ Service Worker មិនគ្រប់គ្រង ➜ ⚠️', state(buildRuntime({ sw: false }).api.healthServiceWorkerRow()) === 'warn');
        ok('⛔ តារាងមិនពេញលេញ ➜ ⚠️', state(buildRuntime({ rows: [1, 2], partial: true }).api.healthCustomerTableRow()) === 'warn');
        ok('តារាងពេញលេញ ➜ ✅', state(buildRuntime({ rows: [1, 2] }).api.healthCustomerTableRow()) === 'ok');
        ok('⛔ ក្រៅបណ្ដាញ ➜ ជួរអ៊ីនធឺណិតជា ❌', state(buildRuntime({ online: false }).api.healthNetworkRow()) === 'bad');
    }
    {
        const rt = buildRuntime({ cfg: ZTO_CFG });
        await rt.api.runHealthCheck();
        const html = rt.listEl.innerHTML;
        const rows = (html.match(/class="health-row/g) || []).length;
        ok('runHealthCheck() បង្ហាញជួរគ្រប់ ៩', rows === 9, rows);
        ok('⛔ លទ្ធផលទាំងមូលមិនផ្ទុកតម្លៃសម្ងាត់', html.indexOf(SECRET) === -1);
        ok('ប៊ូតុងពិនិត្យម្តងទៀតត្រូវដោះវិញក្រោយចប់', rt.btnEl.disabled === false);
    }
    {
        ok('⛔ Lookup មិនប្រើ Sheet ➜ ជួរកំណែ Script ជា ℹ️ (មិនពាក់ព័ន្ធ)',
            state(buildRuntime({ cfg: ZTO_CFG, scriptSeen: 1 }).api.healthSheetScriptRow()) === 'info');
        ok('⛔ មិនទាន់ឃើញកំណែសោះ ➜ ℹ️ ព្រមទាំងវិធីដឹង (មិនមែន ❌)',
            state(buildRuntime({ cfg: SHEET_CFG }).api.healthSheetScriptRow()) === 'info');
        const same = buildRuntime({ cfg: SHEET_CFG, scriptSeen: 1 }).api.healthSheetScriptRow();
        ok('កំណែត្រូវគ្នា ➜ ✅ (ទិសវិជ្ជមាន)', state(same) === 'ok', state(same));
        const older = buildRuntime({ cfg: SHEET_CFG, scriptSeen: 0 }).api.healthSheetScriptRow();
        ok('⛔ Script ដែល deploy ចាស់ជាង App ➜ ⚠️ ព្រមទាំងវិធីដោះស្រាយ',
            state(older) === 'warn' && /Deploy/.test(older), state(older));
        const newer = buildRuntime({ cfg: SHEET_CFG, scriptSeen: 9 }).api.healthSheetScriptRow();
        ok('⛔ ទិសផ្ទុយ ៖ Script ថ្មីជាង App ➜ ⚠️ ព្រមទាំងណែនាំទាញ App',
            state(newer) === 'warn' && /ទាញ App/.test(newer), state(newer));
        // ⛔ ប្តូរ config Lookup ➜ កំណែដែលឃើញត្រូវបាត់ បើមិនដូច្នេះជួរនេះបង្ហាញ
        //    កំណែរបស់ deployment **ចាស់** លើ URL ថ្មី ➜ ការវិនិច្ឆ័យកុហក។
        const srcAll = NEEDED.map((n) => src[n] || '').join('\n');
        ok('⛔ `clearCustomerDataTableCache()` លុបកំណែដែលឃើញចោល',
            /function clearCustomerDataTableCache\(\)\s*\{\s*sheetScriptVersionSeen = null;/.test(srcAll));
        ok('ស្លាកប្រាប់ច្បាស់ថាវាគ្របផ្លូវ Lookup (គម្រោងសរសេរចូលជាគម្រោងផ្សេង)',
            /កំណែ Apps Script \(Lookup\)/.test(same), same.slice(0, 90));
    }
    {
        const rt = buildRuntime({ cfg: ZTO_CFG });
        ok('ztoDiagnosticsUrl() សាងផ្លូវពី URL ដែលកំណត់',
            rt.api.ztoDiagnosticsUrl(ZTO_CFG) === 'https://x.netlify.app/.netlify/functions/zto-order-detail?diag=1',
            rt.api.ztoDiagnosticsUrl(ZTO_CFG));
    }

    // ⛔ ការវិនិច្ឆ័យត្រូវជាការអានសុទ្ធសាធ — គ្មានផ្លូវសរសេរណាមួយ។
    const writeNames = ['dbOp(', 'runTransaction(', 'fb.set(', 'fb.update(', 'fb.remove(', 'commitDailyRevenueDelta', 'claimBarcodeInRegistry'];
    const healthSrc = NEEDED.filter((n) => n.indexOf('health') === 0 || n === 'runHealthCheck' || n === 'openHealthCheck')
        .map((n) => src[n] || '').join('\n');
    const writes = writeNames.filter((w) => healthSrc.indexOf(w) !== -1);
    ok('⛔ ការពិនិត្យសុខភាពគ្មានផ្លូវសរសេរណាមួយ', writes.length === 0, writes);
    ok('⛔ ការពិនិត្យសុខភាពមិនហៅ requestPinBeforeConfig()', healthSrc.indexOf('requestPinBeforeConfig') === -1);
    ok('ជាន់អប្បបរមា៖ កូដដែលស្កេនមិនទទេ', healthSrc.length > 2000, healthSrc.length);

    console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' (ok ' + pass + ')' : '✅ គ្មានបញ្ហា — ok ' + pass));
    process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('  FAIL  ' + (e && e.stack || e)); process.exit(1); });
