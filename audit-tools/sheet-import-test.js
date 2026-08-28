// ថ្នាក់កំហុសដែលឯកសារនេះចាក់សោ — មុខងារ «នាំចូល Excel ទៅ Sheet» ក្នុង ZoeW
// (កំណែ 2.21.0) ដែលផ្លាស់ចេញពី App `ZoeImport` មកជាប្រអប់ក្នុងរបា Slide។
//
// ១. **ច្រកទ្វារ PIN**៖ ផ្លូវ *តែមួយ* ទៅ `openSheetImportModal()` ត្រូវឆ្លងកាត់
//    `requestPinBeforeConfig(..., 'sheetImport')`។ `data-act` ដែលបើកប្រអប់
//    ដោយផ្ទាល់ = ការសរសេរចូល Google Sheet របស់អាជីវកម្ម ដោយគ្មាន PIN។
//
// ២. **សំណើត្រូវជា *simple request* ជានិច្ច** — មេរៀន CORS ក្នុង `CLAUDE.md`៖
//    Apps Script **មិនឆ្លើយ `OPTIONS`** ➜ header ផ្ទាល់ខ្លួន ឬ
//    `application/json` ធ្វើឲ្យ browser ផ្ញើ preflight ➜ **ការនាំចូលស្លាប់
//    ទាំងស្រុងលើផលិតកម្ម ខណៈតេស្តដែល stub `fetch` ជោគជ័យទាំងអស់**។
//    ដូច្នេះឯកសារនេះវាស់ **header ពិតដែល browser ពិតផ្ញើ**។
//
// ៣. **ការលាក់ secret**៖ URL និងពាក្យសម្ងាត់នាំចូលត្រូវអ៊ិនគ្រីបដោយកូនសោ
//    ដែល derive ពី Security PIN — ⛔ មិនត្រូវនៅជាអក្សរធម្មតាក្នុង
//    localStorage ឡើយ។ ការអះអាងមាន **២ ខាង**៖ PIN ត្រូវ ➜ ស្រាយបាន;
//    PIN ខុស ➜ ស្រាយមិនបាន **ហើយ record មិនត្រូវលុប** (មេរៀន 2.17.4៖
//    «មិនអាចផ្ទៀងផ្ទាត់» ≠ «ខុស»)។
//
// ៤. **Toast និយាយការពិត** (មេរៀន 2.19.0)៖ server ត្រឡប់ `{ok:false}` ឬ
//    ឧបករណ៍ក្រៅបណ្ដាញ ➜ សារបរាជ័យ **មិនមែន ✅** ហើយក្រៅបណ្ដាញ
//    **មិនត្រូវបាញ់សំណើសោះ**។
let chromium;
try { chromium = require('playwright-core').chromium; } catch (e) {
    console.log('SKIP — ត្រូវការ playwright-core (npm i playwright-core)');
    process.exit(0);
}
const fs = require('fs');
const http = require('http');
const path = require('path');
const vm = require('vm');

const CHROME = process.env.SHEETIMPORT_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const ROOT = process.env.SHEETIMPORT_APP_DIR ? path.resolve(process.env.SHEETIMPORT_APP_DIR) : path.resolve(__dirname, '..');
const APP = path.join(ROOT, 'ZoeW');
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.png': 'image/png' };

let pass = 0, fail = 0;
function ok(label) { pass++; console.log('   ok    ' + label); }
function bad(label, detail) {
    fail++;
    console.log('  FAIL   ' + label + (detail !== undefined ? '\n         ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : ''));
}
function check(cond, label, detail) { cond ? ok(label) : bad(label, detail); }

function readOr(file, label) {
    try {
        return fs.readFileSync(file, 'utf8');
    } catch (e) {
        bad('អានឯកសារ ' + label + ' បាន', String(e.message));
        return '';
    }
}

function matchBrace(src, from, open, close) {
    let depth = 0, i = from, quote = '';
    for (; i < src.length; i++) {
        const c = src[i];
        if (quote) {
            if (c === '\\') { i++; continue; }
            if (c === quote) quote = '';
            continue;
        }
        if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
        if (c === open) depth++;
        else if (c === close) { depth--; if (depth === 0) return i; }
    }
    return -1;
}

function sliceFn(src, name) {
    let start = src.indexOf('function ' + name + '(');
    if (start === -1) return '';
    if (src.slice(Math.max(0, start - 6), start) === 'async ') start -= 6;
    const end = matchBrace(src, src.indexOf('{', src.indexOf(')', start)), '{', '}');
    if (end === -1) return '';
    return src.slice(start, end + 1);
}

const appJs = readOr(path.join(APP, 'app.js'), 'ZoeW/app.js');
const html = readOr(path.join(APP, 'index.html'), 'ZoeW/index.html');
const swJs = readOr(path.join(APP, 'sw.js'), 'ZoeW/sw.js');
const netlify = readOr(path.join(APP, 'netlify.toml'), 'ZoeW/netlify.toml');

console.log('\n=== ១. ច្រកទ្វារ PIN ៖ ផ្លូវតែមួយទៅប្រអប់នាំចូល ===');

check(/data-act="drawerSheetImportFlow"/.test(html),
    'របា Slide មានធាតុ «នាំចូល Excel ទៅ Sheet»');
check(html.indexOf('id="sheetImportModal"') !== -1, 'index.html មានប្រអប់ sheetImportModal');

const drawerFlow = sliceFn(appJs, 'drawerSheetImportFlow');
check(drawerFlow !== '', 'មាន drawerSheetImportFlow() ក្នុង app.js');
check(/requestPinBeforeConfig\(\s*openSheetImportModal\s*,\s*'sheetImport'\s*\)/.test(drawerFlow),
    'drawerSheetImportFlow ➜ requestPinBeforeConfig(openSheetImportModal, "sheetImport")', drawerFlow);

check(html.indexOf('data-act="openSheetImportModal"') === -1,
    '⛔ គ្មាន data-act ណាបើកប្រអប់នាំចូលដោយរំលង PIN');
const allowBlock = (/const ACTION_ALLOWLIST = \[([\s\S]*?)\];/.exec(appJs) || [])[1] || '';
check(allowBlock.indexOf('"openSheetImportModal"') === -1,
    '⛔ openSheetImportModal មិនស្ថិតក្នុង ACTION_ALLOWLIST');

const pinMsgBlock = (/const PIN_PROMPT_MESSAGES = \{([\s\S]*?)\n    \};/.exec(appJs) || [])[1] || '';
check(/\bsheetImport:\s*\{/.test(pinMsgBlock), 'PIN_PROMPT_MESSAGES មានធាតុ sheetImport');

const clearFields = sliceFn(appJs, 'clearSensitiveModalFields');
check(/clearSheetImportSession\(\)/.test(clearFields),
    'clearSensitiveModalFields() លុបសម័យនាំចូល (ចាកចេញ ➜ គ្មានពាក្យសម្ងាត់សល់)');
check(/'siApiPasswordInput'/.test(clearFields),
    'clearSensitiveModalFields() លុបវាលពាក្យសម្ងាត់នាំចូល');

console.log('\n=== ២. សំណើត្រូវជា simple request (Apps Script មិនឆ្លើយ OPTIONS) ===');

const apiFn = sliceFn(appJs, 'callSheetImportApi');
check(apiFn !== '', 'មាន callSheetImportApi() ក្នុង app.js');
check(/text\/plain/.test(apiFn), 'callSheetImportApi ប្រើ Content-Type: text/plain', apiFn.slice(0, 400));
check(!/application\/json/.test(apiFn), '⛔ គ្មាន application/json (វានឹងកេះ preflight)');
check(!/Authorization|X-Api|X-API|'X-/.test(apiFn), '⛔ គ្មាន header ផ្ទាល់ខ្លួន (វានឹងកេះ preflight)');
check(/fetchWithTimeout\(/.test(apiFn), 'callSheetImportApi ឆ្លងកាត់ fetchWithTimeout (មានពិដាន abort ពិត)');
check(!/[^h]\bfetch\(/.test(apiFn.replace(/fetchWithTimeout\(/g, 'X(')),
    '⛔ គ្មាន fetch() ឆៅដែលរំលងពិដាន', apiFn);
check(/navigator\.onLine === false/.test(apiFn), 'callSheetImportApi ទប់ពេលក្រៅបណ្ដាញ');

console.log('\n=== ៣. ការតភ្ជាប់ត្រូវរក្សាទុកជាអក្សរសម្ងាត់ ===');

const saveFn = sliceFn(appJs, 'saveSheetImportConfig');
check(saveFn !== '', 'មាន saveSheetImportConfig() ក្នុង app.js');
check(/encryptSheetImportSecret\(url\)/.test(saveFn) && /encryptSheetImportSecret\(password\)/.test(saveFn),
    'URL និងពាក្យសម្ងាត់ត្រូវអ៊ិនគ្រីបទាំង ២ មុនរក្សាទុក', saveFn);
check(/safeStoreSet\(appLocalStore, SHEET_IMPORT_STORE_KEY, JSON\.stringify\(stored\)\)/.test(saveFn),
    'ការសរសេរទៅ localStorage ឆ្លងកាត់ safeStoreSet (Private Mode មិនបំបែក App)');

const openFn = sliceFn(appJs, 'openSheetImportModal');
check(!/removeItem|safeStoreRemove/.test(openFn),
    '⛔ ស្រាយមិនបាន ត្រូវ **មិនលុប** record ដែលរក្សាទុក (មេរៀន «មិនអាចផ្ទៀងផ្ទាត់» ≠ «ខុស»)', openFn);

console.log('\n=== ៤. សំបក និង CSP ===');
check(/vendor\/xlsx\.full\.min\.js/.test(swJs), 'sw.js មាន vendor/xlsx.full.min.js ក្នុងសំបក');
check(/connect-src[^"]*https:\/\/script\.google\.com/.test(netlify),
    'CSP connect-src អនុញ្ញាត https://script.google.com');

console.log('\n=== ៥. helper បម្លែងតម្លៃ (រត់កូដពិតក្នុង vm) ===');
{
    const ctx = vm.createContext({ console });
    ['sheetImportCellToText', 'sheetImportToMoney', 'sheetImportColumnLetter'].forEach((n) => {
        const body = sliceFn(appJs, n);
        if (body) vm.runInContext(body, ctx);
        else { vm.runInContext('function ' + n + '() { return undefined; }', ctx); bad('រកឃើញ ' + n + '() ក្នុង app.js'); }
    });
    const toText = vm.runInContext('sheetImportCellToText', ctx);
    const toMoney = vm.runInContext('sheetImportToMoney', ctx);
    const letter = vm.runInContext('sheetImportColumnLetter', ctx);
    check(toText('  ZTO01 ') === 'ZTO01', 'cellToText កាត់ចន្លោះ');
    check(toText(12345678901) === '12345678901', 'cellToText រក្សា barcode ជាលេខឲ្យគ្រប់ខ្ទង់');
    check(toText(null) === '' && toText(undefined) === '', 'cellToText ៖ null/undefined ➜ ទទេ');
    check(vm.runInContext('sheetImportCellToText(new Date())', ctx) === '', 'cellToText ៖ Date ➜ ទទេ (មិនអាចជា barcode)');
    check(toMoney('$12.345') === 12.35 && toMoney(0) === 0 && toMoney('') === 0, 'toMoney បង្គត់ ២ ខ្ទង់');
    check(toMoney('abc') === 0 && toMoney(Infinity) === 0, 'toMoney ៖ តម្លៃមិនមែនលេខ ➜ 0');
    check(letter(0) === 'A' && letter(25) === 'Z' && letter(26) === 'AA', 'columnLetter ត្រឹមត្រូវ');
}

function serve(dir) {
    return new Promise((res) => {
        const s = http.createServer((req, rsp) => {
            let p = decodeURIComponent(req.url.split('?')[0]);
            if (p === '/') p = '/index.html';
            const f = path.join(dir, p);
            if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); return rsp.end(); }
            rsp.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'text/plain' });
            rsp.end(fs.readFileSync(f));
        });
        s.listen(0, '127.0.0.1', () => res(s));
    });
}

const LICENSE_STUB = `window.ZoeLicense = {
    getStatus: function () { return Promise.resolve({ state: 'active' }); },
    setServerTimeOffset: function () {},
    syncServerTime: function () { return Promise.resolve(); },
    activate: function () { return Promise.resolve({ ok: true }); },
    verifyKeyString: function () { return Promise.resolve({ ok: true }); },
    clearActivation: function () {}
};`;

const FAKE_SDK = function () {
    const noop = () => {};
    window.firebaseSDK = {
        initializeApp: () => ({}),
        getApps: () => [],
        deleteApp: () => Promise.resolve(),
        getAuth: () => ({ currentUser: { uid: 'u1', email: 'a@b.c' } }),
        onAuthStateChanged: (a, cb) => { setTimeout(() => cb({ uid: 'u1', email: 'a@b.c' }), 10); return noop; },
        signInWithEmailAndPassword: () => Promise.resolve({ user: { uid: 'u1' } }),
        signOut: () => Promise.resolve(),
        setPersistence: () => Promise.resolve(),
        browserLocalPersistence: {}, browserSessionPersistence: {},
        getDatabase: () => ({}),
        ref: (db, p) => ({ path: p }),
        onValue: (r, cb) => { setTimeout(() => cb({ val: () => (String(r.path) === '.info/connected' ? true : null), exists: () => false }), 20); return noop; },
        off: noop,
        set: () => Promise.resolve(),
        update: () => Promise.resolve(),
        remove: () => Promise.resolve(),
        get: () => Promise.resolve({ val: () => null, exists: () => false }),
        runTransaction: (r, fn) => Promise.resolve({ committed: true, snapshot: { val: () => fn(null) } }),
        increment: (n) => ({ __inc: n }),
        goOffline: noop, goOnline: noop, serverTimestamp: () => Date.now()
    };
    window.dispatchEvent(new Event('firebasesdkready'));
};

const FAKE_URL = 'https://script.google.com/macros/s/AKfycbxSHEETIMPORTTEST00000/exec';
const FAKE_PASSWORD = 'zoe-import-pw-secret';
const SAMPLE = [
    ['Barcode', 'DOD', 'COD', 'Phone'],
    ['ZTO0001', 1.5, 12, '0974158508'],
    ['ZTO0002', 0, 7.25, '0965551234'],
    ['ZTO0003', 2, 30, '0888123456'],
    ['ZTO0003', 2, 30, '0888123456'],
    ['', 0, 0, '']
];

function writeSample(dir) {
    let XLSX = null;
    try { XLSX = require('xlsx'); } catch (e) { XLSX = null; }
    if (XLSX) {
        const file = path.join(dir, 'zoe-sheet-import-sample.xlsx');
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(SAMPLE), 'Data');
        XLSX.writeFile(wb, file);
        return file;
    }
    const file = path.join(dir, 'zoe-sheet-import-sample.csv');
    fs.writeFileSync(file, SAMPLE.map((r) => r.join(',')).join('\n'), 'utf8');
    return file;
}

async function withTimeout(promise, ms, label) {
    let timer = null;
    const guard = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('អស់ពេល: ' + label)), ms); });
    try {
        return await Promise.race([promise, guard]);
    } finally {
        clearTimeout(timer);
    }
}

(async () => {
    if (!fs.existsSync(CHROME)) {
        console.log('SKIP — រកមិនឃើញ Chromium នៅ ' + CHROME);
        console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail : '✅ ជោគជ័យ ' + pass) + ' (ផ្នែក browser មិនបានរត់)');
        process.exit(fail ? 1 : 0);
    }
    if (!appJs || !html) {
        console.log('\n❌ ធ្លាក់ ' + (fail || 1) + ' — ផ្នែក browser រំលង ព្រោះអានឯកសារ App មិនបាន');
        process.exit(1);
    }

    const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'zoe-si-'));
    const samplePath = writeSample(tmpDir);
    const server = await serve(APP);
    const port = server.address().port;
    const browser = await chromium.launch({ executablePath: CHROME });
    const ctx = await browser.newContext({ viewport: { width: 412, height: 880 } });
    const page = await ctx.newPage();

    const sent = [];
    let reply = { ok: true, data: { spreadsheetName: 'ZTO', sheetName: 'Data', rowCount: 128 } };
    let replyFor = null;
    page.on('dialog', (d) => d.accept().catch(() => {}));
    await page.route('**', (route) => {
        const req = route.request();
        const u = req.url();
        if (u.indexOf('/license-verify.js') !== -1) return route.fulfill({ status: 200, contentType: 'application/javascript', body: LICENSE_STUB });
        if (u.indexOf('script.google.com') !== -1) {
            let body = {};
            try { body = JSON.parse(req.postData() || '{}'); } catch (e) { body = {}; }
            sent.push({ action: body.action, method: req.method(), headers: req.headers(), password: body.password, rows: body.payload && body.payload.rows });
            const out = (replyFor && replyFor[body.action]) || reply;
            return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(out) });
        }
        if (u.startsWith('http://127.0.0.1:' + port)) return route.continue();
        return route.abort();
    });
    await page.addInitScript(`window.localStorage.setItem('zoew_firebase_config', ${JSON.stringify(JSON.stringify({ apiKey: 'k', databaseURL: 'https://fake-default-rtdb.firebaseio.com', projectId: 'p' }))});`);
    await page.addInitScript('(' + FAKE_SDK.toString() + ')();');

    async function boot() {
        await page.goto('http://127.0.0.1:' + port + '/', { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForTimeout(2200);
        await page.evaluate(() => document.querySelectorAll('.modal').forEach((m) => { if (m.id !== 'sheetImportModal') m.style.display = 'none'; }));
    }
    const shown = (id) => page.evaluate((i) => {
        const el = document.getElementById(i);
        return !!el && getComputedStyle(el).display !== 'none';
    }, id);
    const text = (id) => page.evaluate((i) => {
        const el = document.getElementById(i);
        return el ? el.textContent : null;
    }, id);

    async function group(title, fn) {
        console.log('\n=== ' + title + ' ===');
        try {
            await fn();
        } catch (e) {
            bad(title + ' ➜ ជំហានបោះកំហុស', String(e && e.message ? e.message : e).split('\n')[0]);
        }
    }

    await group('៦. ចុចធាតុរបា Slide ➜ សុំ PIN មុន (មិនបើកប្រអប់ភ្លាម)', async () => {
            await withTimeout(boot(), 30000, 'boot');
            await page.evaluate(() => window.openSideDrawer());
            await page.waitForTimeout(300);
            await page.click('[data-act="drawerSheetImportFlow"]', { timeout: 6000 });
            await page.waitForTimeout(500);
            check(await shown('pinSetupModal'), 'ចុចធាតុ ➜ ប្រអប់កំណត់ PIN លេចឡើង');
            check(!(await shown('sheetImportModal')), '⛔ ប្រអប់នាំចូល **មិនបើក** មុនវាយ PIN');

            await page.fill('#newSecurityPinInput', '123456', { timeout: 6000 });
            await page.click('[data-act="saveNewSecurityPin"]', { timeout: 6000 });
            await page.waitForTimeout(1200);
            check(await shown('sheetImportModal'), 'PIN ត្រឹមត្រូវ ➜ ប្រអប់នាំចូលបើក');
            check(await shown('siConfigForm'), 'មិនទាន់មានការតភ្ជាប់ ➜ បង្ហាញទម្រង់ជំហាន ១');
            check(!(await shown('siFileCard')), '⛔ មិនទាន់ភ្ជាប់ ➜ ជំហានជ្រើសឯកសារនៅលាក់');
    });

    await group('៧. រក្សាទុកការតភ្ជាប់ ➜ អក្សរសម្ងាត់ក្នុង localStorage', async () => {
            await page.fill('#siApiUrlInput', FAKE_URL);
            await page.fill('#siApiPasswordInput', FAKE_PASSWORD);
            await page.click('[data-act="saveSheetImportConfig"]', { timeout: 6000 });
            await page.waitForTimeout(1200);
            const stored = await page.evaluate(() => localStorage.getItem('zoew_sheet_import_config'));
            check(!!stored, 'ការតភ្ជាប់ត្រូវបានរក្សាទុក');
            check(!!stored && stored.indexOf('AKfycbxSHEETIMPORTTEST') === -1, '⛔ URL មិននៅជាអក្សរធម្មតាក្នុង localStorage');
            check(!!stored && stored.indexOf(FAKE_PASSWORD) === -1, '⛔ ពាក្យសម្ងាត់មិននៅជាអក្សរធម្មតាក្នុង localStorage');
            check(await shown('siConfigSummary'), 'ភ្ជាប់រួច ➜ បង្ហាញសង្ខេបការតភ្ជាប់');
            check(await shown('siFileCard'), 'ភ្ជាប់រួច ➜ បើកជំហានជ្រើសឯកសារ');
            const foot1 = await text('siStatusFoot');
            check(!!foot1 && foot1.indexOf('128') !== -1, 'បង្ហាញគោលដៅ Sheet ពិត', foot1);
            const statusReq = sent.filter((s) => s.action === 'status');
            check(statusReq.length >= 1, 'បានបាញ់សំណើ status ទៅ Apps Script');
            const h = statusReq.length ? statusReq[0].headers : {};
            check((h['content-type'] || '') === 'text/plain;charset=utf-8',
                '⛔ Content-Type ជា text/plain (គ្មាន preflight)', h['content-type']);
            const custom = Object.keys(h).filter((k) => /^x-/.test(k) || k === 'authorization');
            check(custom.length === 0, '⛔ គ្មាន header ផ្ទាល់ខ្លួន (គ្មាន preflight)', custom);
            check(statusReq[0].password === FAKE_PASSWORD, 'ពាក្យសម្ងាត់ធ្វើដំណើរក្នុងតួសំណើ មិនមែនក្នុង URL/header');
    });

    await group('៨. PIN ខុស ➜ ស្រាយមិនបាន តែ **មិនលុប** record', async () => {
            await withTimeout(boot(), 30000, 'reboot');
            await page.evaluate(() => window.requestPinBeforeConfig(window.openSheetImportModal, 'sheetImport'));
            await page.waitForTimeout(300);
            await page.fill('#securityPinInput', '999999', { timeout: 6000 });
            await page.click('[data-act="verifySecurityPin"]', { timeout: 6000 });
            await page.waitForTimeout(900);
            check(!(await shown('sheetImportModal')), 'PIN ខុស ➜ ប្រអប់នាំចូលមិនបើក');
            check(!!(await page.evaluate(() => localStorage.getItem('zoew_sheet_import_config'))),
                '⛔ PIN ខុស ➜ ការតភ្ជាប់ដែលរក្សាទុក **នៅដដែល** (មិនលុប)');

            await page.evaluate(() => { localStorage.removeItem('zoew_pin_fail_count'); localStorage.removeItem('zoew_pin_lockout_until'); });
            await page.evaluate(() => window.openSheetImportModal('654321'));
            await page.waitForTimeout(900);
            check(await shown('siConfigForm'), 'PIN ខុស (កូនសោខុស) ➜ ត្រឡប់ទៅទម្រង់កំណត់ការតភ្ជាប់');
            const msgWrong = await text('siConfigMsg');
            check(!!msgWrong && msgWrong.indexOf('✅') === -1, '⛔ PIN ខុស ➜ សារមិនអះអាងជោគជ័យ', msgWrong);
            check(!(await shown('siFileCard')), '⛔ PIN ខុស ➜ មិនបើកជំហានបន្ទាប់');
    });

    await group('៩. PIN ត្រូវ ➜ ការតភ្ជាប់ត្រឡប់មកវិញ', async () => {
            await withTimeout(boot(), 30000, 'reboot2');
            await page.evaluate(() => window.openSheetImportModal('123456'));
            await page.waitForTimeout(1200);
            check(await shown('siConfigSummary'), 'PIN ត្រូវ ➜ ការតភ្ជាប់ត្រូវស្រាយវិញដោយស្វ័យប្រវត្តិ');
            const summary = await text('siConfigSummary');
            check(!!summary && summary.indexOf('script.google.com') !== -1 && summary.indexOf('AKfycbxSHEETIMPORTTEST00000') === -1,
                'សង្ខេបបិទបាំង URL ពេញ (បង្ហាញតែសញ្ញាសម្គាល់ខ្លី)', summary);
    });

    await group('១០. អានឯកសារ ➜ ផ្គូផ្គង ➜ មើលជាមុន', async () => {
            replyFor = {
                status: reply,
                prepare: { ok: true, data: { signature: 'sig-1', source: 'auto', mapping: { barcode: 0, dod: 1, cod: 2, phone: 3 } } },
                import: { ok: true, data: { added: 3, updated: 1, unchanged: 0, skippedNoBarcode: 1, duplicatesInFile: 1, rowsAfter: 131, sheetName: 'Data' } }
            };
            await page.setInputFiles('#siFileInput', samplePath, { timeout: 6000 });
            await page.waitForTimeout(2000);
            check(await shown('siMapCard'), 'អានឯកសាររួច ➜ បើកជំហានផ្គូផ្គង');
            const mapping = await page.evaluate(() => ['siMapBarcode', 'siMapDod', 'siMapCod', 'siMapPhone'].map((i) => document.getElementById(i).value));
            check(JSON.stringify(mapping) === JSON.stringify(['0', '1', '2', '3']), 'ការផ្គូផ្គងពី server ត្រូវអនុវត្តលើ select ពិត', mapping);
            const chips = await page.evaluate(() => [...document.querySelectorAll('#siChips .si-chip')].map((c) => c.textContent));
            check(chips.some((c) => /5$/.test(c)), 'ចំណាំ ៖ ជួរដេកក្នុងឯកសារ ៥ (ក្រោម header)', chips);
            check(chips.some((c) => /Barcode 4$/.test(c)), 'ចំណាំ ៖ មាន Barcode ៤', chips);
            check(chips.some((c) => /ស្ទួន/.test(c)), 'ចំណាំ ៖ រកឃើញជួរស្ទួនក្នុងឯកសារ', chips);
            const preview = await page.evaluate(() => [...document.querySelectorAll('#siPreviewBody tr')].map((tr) => [...tr.children].map((td) => td.textContent).join('|')));
            check(preview[0] === 'ZTO0001|1.50|12.00|0974158508', 'ជួរមើលជាមុនទី ១ ត្រឹមត្រូវ', preview[0]);
            check(preview.length === 4, 'មើលជាមុនបង្ហាញតែជួរដែលមាន Barcode', preview.length);
    });

    await group('១១. ជួរដេក header ខុស ➜ ចំនួនជួរប្រែតាម (កុំចាក់លេខថេរ)', async () => {
            await page.fill('#siHeaderRowInput', '2', { timeout: 6000 });
            await page.dispatchEvent('#siHeaderRowInput', 'change', undefined, { timeout: 6000 });
            await page.waitForTimeout(1200);
            const chips2 = await page.evaluate(() => [...document.querySelectorAll('#siChips .si-chip')].map((c) => c.textContent));
            check(chips2.some((c) => /4$/.test(c)), 'header ជួរទី ២ ➜ ជួរដេកក្នុងឯកសារធ្លាក់មក ៤', chips2);
            await page.fill('#siHeaderRowInput', '1', { timeout: 6000 });
            await page.dispatchEvent('#siHeaderRowInput', 'change', undefined, { timeout: 6000 });
            await page.waitForTimeout(1200);
    });

    await group('១២. នាំចូល ➜ សំណើត្រឹមត្រូវ និងលទ្ធផលពិត', async () => {
            const before = sent.length;
            await page.click('#siImportBtn', { timeout: 6000 });
            await page.waitForTimeout(1500);
            const imp = sent.slice(before).filter((s) => s.action === 'import');
            check(imp.length === 1, 'បាញ់សំណើ import តែម្តង', imp.length);
            check(imp.length === 1 && Array.isArray(imp[0].rows) && imp[0].rows.length === 4,
                'ផ្ញើតែជួរដែលមាន Barcode (៤ ជួរ)', imp.length ? (imp[0].rows || []).length : null);
            check(imp.length === 1 && imp[0].rows[0][0] === 'ZTO0001' && imp[0].rows[0][1] === 1.5 && imp[0].rows[0][2] === 12,
                'ជួរដំបូងផ្ញើតម្លៃត្រឹមត្រូវ (barcode · dod · cod)', imp.length ? imp[0].rows[0] : null);
            const done = await text('siActionMsg');
            check(!!done && done.indexOf('✅') === 0 && done.indexOf('131') !== -1, 'សារជោគជ័យរាយលទ្ធផលពី server', done);
            const foot2 = await text('siStatusFoot');
            check(!!foot2 && foot2.indexOf('131') !== -1, 'ជើងទំព័រធ្វើបច្ចុប្បន្នភាពតាមលទ្ធផលពិត', foot2);
    });

    await group('១៣. server បដិសេធ ➜ សារបរាជ័យ មិនមែន ✅', async () => {
            replyFor.import = { ok: false, error: 'ពាក្យសម្ងាត់មិនត្រឹមត្រូវ' };
            await page.click('#siImportBtn', { timeout: 6000 });
            await page.waitForTimeout(1500);
            const failMsg = await text('siActionMsg');
            check(!!failMsg && failMsg.indexOf('✅') === -1, '⛔ server បដិសេធ ➜ សារមិនអះអាងជោគជ័យ', failMsg);
            check(!!failMsg && failMsg.indexOf('ពាក្យសម្ងាត់មិនត្រឹមត្រូវ') !== -1, 'សារបង្ហាញមូលហេតុពិតពី server', failMsg);
            const btnState = await page.evaluate(() => {
                const b = document.getElementById('siImportBtn');
                return { disabled: b.disabled, label: b.textContent };
            });
            check(btnState.disabled === false && btnState.label.indexOf('កំពុង') === -1,
                'ក្រោយបរាជ័យ ➜ ប៊ូតុងត្រឡប់ជាធម្មតាវិញ (មិនជាប់ «កំពុងនាំចូល»)', btnState);
    });

    await group('១៤. ក្រៅបណ្ដាញ ➜ បដិសេធ ហើយ **មិនបាញ់សំណើ**', async () => {
            replyFor.import = { ok: true, data: { added: 0, updated: 0, unchanged: 0, rowsAfter: 9, sheetName: 'Data' } };
            await page.evaluate(() => Object.defineProperty(navigator, 'onLine', { get: () => false, configurable: true }));
            const beforeOffline = sent.length;
            await page.click('#siImportBtn', { timeout: 6000 });
            await page.waitForTimeout(1200);
            check(sent.length === beforeOffline, '⛔ ក្រៅបណ្ដាញ ➜ គ្មានសំណើចេញសោះ', sent.length - beforeOffline);
            const offMsg = await text('siActionMsg');
            check(!!offMsg && offMsg.indexOf('✅') === -1 && offMsg.indexOf('ក្រៅបណ្ដាញ') !== -1,
                'ក្រៅបណ្ដាញ ➜ សារប្រាប់ការពិត', offMsg);
            await page.evaluate(() => Object.defineProperty(navigator, 'onLine', { get: () => true, configurable: true }));
    });

    await group('១៥. ចាកចេញ ➜ គ្មានពាក្យសម្ងាត់ ឬទិន្នន័យសល់', async () => {
            await page.evaluate(() => window.clearSensitiveModalFields());
            await page.waitForTimeout(300);
            const leftovers = await page.evaluate(() => ({
                pw: document.getElementById('siApiPasswordInput').value,
                url: document.getElementById('siApiUrlInput').value,
                foot: document.getElementById('siStatusFoot').textContent,
                preview: document.getElementById('siPreviewBody').textContent,
                chips: document.getElementById('siChips').textContent,
                summary: document.getElementById('siConfigSummary').textContent,
                mapCard: document.getElementById('siMapCard').classList.contains('hidden'),
                fileCard: document.getElementById('siFileCard').classList.contains('hidden')
            }));
            check(leftovers.pw === '' && leftovers.url === '', 'ចាកចេញ ➜ វាល URL និងពាក្យសម្ងាត់ទទេ', leftovers);
            check(leftovers.foot === '' && leftovers.preview === '' && leftovers.chips === '' && leftovers.summary === '',
                'ចាកចេញ ➜ គោលដៅ Sheet និងទិន្នន័យមើលជាមុនបាត់អស់', leftovers);
            check(leftovers.mapCard === true && leftovers.fileCard === true, 'ចាកចេញ ➜ ជំហានទាំងអស់បិទវិញ', leftovers);
            check(!!(await page.evaluate(() => localStorage.getItem('zoew_sheet_import_config'))),
                'ចាកចេញ ➜ ការតភ្ជាប់ដែលអ៊ិនគ្រីបនៅដដែល (ចូលវិញមិនបាច់កំណត់ថ្មី)');
    });

    await browser.close();
    server.close();
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) { /* ok */ }

    console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')' : '✅ ជោគជ័យ ' + pass));
    process.exit(fail ? 1 : 0);
})().then(() => {}, (e) => {
    console.log('  FAIL   ' + (e && e.message ? e.message : e));
    console.log('\n❌ ធ្លាក់ ' + (fail + 1));
    process.exit(1);
});
