const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');

const APP_DIR = __dirname;
const REPO_ROOT = path.join(APP_DIR, '..');

function requireOptional(name) {
    try {
        return require(path.join(REPO_ROOT, 'node_modules', name));
    } catch (err) {
        try {
            return require(name);
        } catch (err2) {
            return null;
        }
    }
}

const playwright = requireOptional('playwright-core');
const XLSX = requireOptional('xlsx');

if (!playwright) {
    console.log('SKIPPED — ត្រូវការ playwright-core (npm i playwright-core)');
    process.exit(0);
}
if (!XLSX) {
    console.log('SKIPPED — ត្រូវការ xlsx (npm i xlsx)');
    process.exit(0);
}

let passed = 0;
const failures = [];

function check(name, condition, detail) {
    if (condition) {
        passed++;
    } else {
        failures.push(name + (detail ? ' — ' + detail : ''));
    }
}

function equal(name, actual, expected) {
    const a = JSON.stringify(actual);
    const b = JSON.stringify(expected);
    check(name, a === b, 'បាន ' + a + ' រំពឹង ' + b);
}

function resolveChromium() {
    if (process.env.ZOEIMPORT_CHROME) return process.env.ZOEIMPORT_CHROME;
    const root = '/opt/pw-browsers';
    if (fs.existsSync(root)) {
        const dirs = fs.readdirSync(root).filter((name) => name.startsWith('chromium-')).sort().reverse();
        for (const dir of dirs) {
            const candidate = path.join(root, dir, 'chrome-linux', 'chrome');
            if (fs.existsSync(candidate)) return candidate;
        }
    }
    return undefined;
}

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png'
};

function startServer() {
    return new Promise((resolve) => {
        const server = http.createServer((req, res) => {
            let rel = decodeURIComponent(req.url.split('?')[0]);
            if (rel === '/') rel = '/index.html';
            const file = path.join(APP_DIR, rel);
            if (!file.startsWith(APP_DIR) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
                res.writeHead(404);
                res.end('not found');
                return;
            }
            res.writeHead(200, {
                'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
                'Service-Worker-Allowed': '/'
            });
            res.end(fs.readFileSync(file));
        });
        server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
    });
}

const FAKE_URL = 'https://script.google.com/macros/s/AKfycbxTESTKEY1234567890/exec';
const REAL_ZTO_HEADERS = [
    'ស្កេនលេខបុងបញ្ញើ',
    'ទឹកប្រាក់ដែលទូទាត់នៅពេលទំនិញដល់គោលដៅ',
    'ប្រាក់ប្រមូលជំនួស',
    'លេខទូរស័ព្ទអ្នកទទួលទំនិញ'
];
const PASSWORD = 'sup3r-secret-import-pw';
const PIN = '246813';

function buildFixture() {
    const rows = [REAL_ZTO_HEADERS];
    rows.push(['77130526882395', 0, 2.59, '85510852996']);
    rows.push(['77130526588457', 0, 2.26, '85590949280']);
    rows.push(['77130526594410', 0, 4.13, '855968949321']);
    rows.push(['', 0, 9.99, '855000000000']);
    rows.push(['77130526882395', 0, 7.77, '855111111111']);
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const file = path.join(os.tmpdir(), 'zoeimport-fixture-' + process.pid + '.xlsx');
    XLSX.writeFile(wb, file, { bookSST: true });
    return file;
}

const FETCH_STUB = `
window.__apiCalls = [];
window.fetch = async function (url, options) {
    const body = JSON.parse((options && options.body) || '{}');
    window.__apiCalls.push({ url: String(url), body: body });
    if (body.password !== ${JSON.stringify(PASSWORD)}) {
        return new Response(JSON.stringify({ ok: false, error: 'ពាក្យសម្ងាត់មិនត្រឹមត្រូវ' }), { status: 200 });
    }
    let data = {};
    if (body.action === 'status') {
        data = { spreadsheetName: 'ZoeAdmin', sheetName: 'Customers', rowCount: 74, watchEnabled: false, savedMappings: 0 };
    } else if (body.action === 'prepare') {
        data = { signature: 'sig-test', mapping: { barcode: 0, dod: 1, cod: 2, phone: 3 }, source: 'auto', mode: 'upsert' };
    } else if (body.action === 'import') {
        data = { ok: true, mode: body.payload.mode, sheetName: 'Customers', fileRows: body.payload.rows.length,
                 usableRows: body.payload.rows.length, added: body.payload.rows.length, updated: 0, unchanged: 0,
                 skippedNoBarcode: 0, duplicatesInFile: 0, rowsAfter: body.payload.rows.length };
    } else if (body.action === 'clear') {
        data = { ok: true, sheetName: 'Customers', removed: 74, rowsAfter: 0 };
    }
    return new Response(JSON.stringify({ ok: true, data: data }), { status: 200 });
};
`;

async function run() {
    const { server, port } = await startServer();
    const base = 'http://127.0.0.1:' + port + '/index.html';
    const fixture = buildFixture();
    const browser = await playwright.chromium.launch({
        executablePath: resolveChromium(),
        args: ['--no-sandbox']
    });
    try {
        const context = await browser.newContext();
        await context.addInitScript(FETCH_STUB);
        const page = await context.newPage();
        const pageErrors = [];
        page.on('pageerror', (err) => pageErrors.push(err.message));
        await page.goto(base, { waitUntil: 'load' });

        equal('គ្មានកំហុស runtime ពេល boot', pageErrors, []);

        const idsInJs = [...fs.readFileSync(path.join(APP_DIR, 'app.js'), 'utf8').matchAll(/\$\('([^']+)'\)/g)].map((m) => m[1]);
        const missing = [];
        for (const id of [...new Set(idsInJs)]) {
            const found = await page.evaluate((v) => !!document.getElementById(v), id);
            if (!found) missing.push(id);
        }
        equal('គ្រប់ id ដែល app.js ហៅ មានក្នុង index.html', missing, []);

        check('ទំព័រដំបូងបង្ហាញការកំណត់ PIN', await page.isVisible('#pinSetupBox'));
        check('មិនទាន់បង្ហាញ App មុនដាក់ PIN', !(await page.isVisible('#appMain')));

        await page.fill('#pinNewInput', '12');
        await page.fill('#pinConfirmInput', '12');
        await page.click('#pinSetupBtn');
        await page.waitForSelector('#pinMsg .msg.bad');
        check('PIN ខ្លីជាង ៤ ខ្ទង់ត្រូវបដិសេធ',
            (await page.textContent('#pinMsg')).includes('យ៉ាងតិច 4 ខ្ទង់'),
            await page.textContent('#pinMsg'));

        await page.fill('#pinNewInput', PIN);
        await page.fill('#pinConfirmInput', '999999');
        await page.click('#pinSetupBtn');
        await page.waitForSelector('#pinMsg .msg.bad');
        check('PIN ២ ដងមិនដូចគ្នាត្រូវបដិសេធ', (await page.textContent('#pinMsg')).includes('មិនដូចគ្នា'));
        check('នៅមិនទាន់ចូល App', !(await page.isVisible('#appMain')));

        await page.fill('#pinNewInput', PIN);
        await page.fill('#pinConfirmInput', PIN);
        await page.click('#pinSetupBtn');
        await page.waitForSelector('#appMain:not(.hidden)');
        check('PIN ត្រឹមត្រូវ ➜ ចូល App', await page.isVisible('#configCard'));
        check('ប្រអប់ PIN បាត់ក្រោយចូល', !(await page.isVisible('#pinGate')));

        await page.fill('#apiUrlInput', 'https://example.com/hook');
        await page.fill('#apiPasswordInput', PASSWORD);
        await page.click('#configSaveBtn');
        await page.waitForSelector('#configMsg .msg.bad');
        check('URL ក្រៅ script.google.com ត្រូវបដិសេធ', (await page.textContent('#configMsg')).includes('/exec'));
        equal('URL ខុសមិនត្រូវផ្ញើសំណើទេ', await page.evaluate(() => window.__apiCalls.length), 0);

        await page.fill('#apiUrlInput', FAKE_URL);
        await page.fill('#apiPasswordInput', 'ពាក្យសម្ងាត់ខុស');
        await page.click('#configSaveBtn');
        await page.waitForSelector('#configMsg .msg.bad');
        check('ពាក្យសម្ងាត់ខុសត្រូវបង្ហាញកំហុសពី server',
            (await page.textContent('#configMsg')).includes('មិនត្រឹមត្រូវ'));
        check('ពាក្យសម្ងាត់ខុសមិនត្រូវរក្សាទុក',
            await page.evaluate(() => !localStorage.getItem('zoeimport_config')));

        await page.fill('#apiUrlInput', FAKE_URL);
        await page.fill('#apiPasswordInput', PASSWORD);
        await page.click('#configSaveBtn');
        await page.waitForSelector('#configSummary:not(.hidden)');
        check('ការតភ្ជាប់ត្រឹមត្រូវ ➜ បង្ហាញសង្ខេប', (await page.textContent('#configSummary')).includes('script.google.com'));
        equal('ប្រអប់ URL ត្រូវសម្អាតក្រោយរក្សាទុក', await page.inputValue('#apiUrlInput'), '');
        equal('ប្រអប់ពាក្យសម្ងាត់ត្រូវសម្អាតក្រោយរក្សាទុក', await page.inputValue('#apiPasswordInput'), '');
        check('សង្ខេបបង្ហាញ URL ជាទម្រង់បិទបាំង', !(await page.textContent('#configSummary')).includes('AKfycbxTESTKEY1234567890'));

        const stored = await page.evaluate(() => localStorage.getItem('zoeimport_config'));
        check('ពាក្យសម្ងាត់មិនស្ថិតជាអក្សរធម្មតាក្នុង localStorage', !stored.includes(PASSWORD), stored.slice(0, 80));
        check('URL មិនស្ថិតជាអក្សរធម្មតាក្នុង localStorage', !stored.includes('AKfycbxTESTKEY1234567890'));
        check('config ដែលរក្សាទុកមាន iv និង ciphertext', /"iv":\[/.test(stored) && /"data":\[/.test(stored));
        const pinHash = await page.evaluate(() => localStorage.getItem('zoeimport_pin_hash'));
        check('PIN រក្សាទុកជា PBKDF2 មិនមែនជាអក្សរធម្មតា', pinHash.startsWith('pbkdf2:') && !pinHash.includes(PIN));

        const domHasSecret = await page.evaluate((pw) => document.documentElement.innerHTML.includes(pw), PASSWORD);
        check('ពាក្យសម្ងាត់មិនសល់ក្នុង DOM', !domHasSecret);

        await page.setInputFiles('#fileInput', fixture);
        await page.waitForSelector('#mapCard:not(.hidden)');
        await page.waitForSelector('#mapMsg .msg.ok');
        equal('រក Column ស្វ័យប្រវត្តិ — Barcode', await page.inputValue('#mapBarcode'), '0');
        equal('រក Column ស្វ័យប្រវត្តិ — DOD', await page.inputValue('#mapDod'), '1');
        equal('រក Column ស្វ័យប្រវត្តិ — COD', await page.inputValue('#mapCod'), '2');
        equal('រក Column ស្វ័យប្រវត្តិ — Phone', await page.inputValue('#mapPhone'), '3');

        const chipText = await page.textContent('#chips');
        check('រាប់ជួរដេកគ្មាន Barcode', chipText.includes('រំលង 1'), chipText);
        check('រាប់ជួរដេកស្ទួនក្នុងឯកសារ', chipText.includes('ស្ទួនក្នុងឯកសារ 1'), chipText);
        equal('preview បង្ហាញជួរដេកដែលមាន Barcode', await page.evaluate(() => document.querySelectorAll('#previewBody tr').length), 4);
        equal('ជួរដេកទី ១ នៃ preview', await page.evaluate(() =>
            [...document.querySelectorAll('#previewBody tr')[0].children].map((td) => td.textContent)),
            ['77130526882395', '0.00', '2.59', '85510852996']);

        equal('របៀបលំនាំដើមជា replace សម្រាប់ការប្រើប្រចាំថ្ងៃ', await page.inputValue('#modeSel'), 'replace');

        await page.evaluate(() => { window.__apiCalls.length = 0; });
        await page.click('#importBtn');
        await page.waitForSelector('#confirmModal:not(.hidden)');
        check('របៀប replace ត្រូវសួរបញ្ជាក់មុន', (await page.textContent('#confirmText')).includes('លុប'));
        await page.click('#confirmNo');
        await page.waitForSelector('#confirmModal', { state: 'hidden' });
        equal('បោះបង់ ➜ មិនផ្ញើសំណើទេ', await page.evaluate(() => window.__apiCalls.length), 0);

        await page.click('#importBtn');
        await page.waitForSelector('#confirmModal:not(.hidden)');
        await page.click('#confirmYes');
        await page.waitForSelector('#actionMsg .msg.ok');
        const importCall = await page.evaluate(() => window.__apiCalls.find((c) => c.body.action === 'import'));
        equal('សំណើនាំចូលប្រើ mode ដែលជ្រើស', importCall.body.payload.mode, 'replace');
        equal('សំណើនាំចូលផ្ញើតែជួរដេកដែលមាន Barcode', importCall.body.payload.rows.length, 4);
        equal('សំណើនាំចូលផ្ញើ signature', importCall.body.payload.signature, 'sig-test');
        check('សំណើផ្ញើទៅ URL ដែលកំណត់', importCall.url === FAKE_URL, importCall.url);

        await page.evaluate(() => { window.__apiCalls.length = 0; });
        await page.click('#clearBtn');
        await page.waitForSelector('#confirmModal:not(.hidden)');
        await page.click('#confirmYes');
        await page.waitForSelector('#clearMsg .msg.ok');
        const clearCall = await page.evaluate(() => window.__apiCalls.find((c) => c.body.action === 'clear'));
        equal('សម្អាតត្រូវផ្ញើ token បញ្ជាក់', clearCall.body.confirm, 'CLEAR');
        check('សម្អាតរាយចំនួនជួរដេកដែលលុប', (await page.textContent('#clearMsg')).includes('74'));

        await page.click('#lockBtn');
        await page.waitForSelector('#pinGate:not(.hidden)');
        check('ចាក់សោ ➜ ត្រឡប់ទៅប្រអប់ PIN', await page.isVisible('#pinVerifyBox'));
        check('ចាក់សោ ➜ លាក់ App', !(await page.isVisible('#appMain')));
        check('ចាក់សោ ➜ សង្ខេបការតភ្ជាប់ត្រូវលុបចេញពី DOM',
            (await page.evaluate(() => document.getElementById('configSummary').textContent)) === '');
        check('ចាក់សោ ➜ ពាក្យសម្ងាត់លែងមានក្នុង DOM',
            !(await page.evaluate((pw) => document.documentElement.innerHTML.includes(pw), PASSWORD)));

        await page.reload({ waitUntil: 'load' });
        check('បើកឡើងវិញ ➜ ទាមទារ PIN', await page.isVisible('#pinVerifyBox'));
        check('បើកឡើងវិញ ➜ មិនបង្ហាញ App', !(await page.isVisible('#appMain')));

        for (let i = 1; i <= 4; i++) {
            await page.fill('#pinInput', '000000');
            await page.click('#pinVerifyBtn');
            await page.waitForFunction((left) => {
                const el = document.querySelector('#pinMsg .msg.bad');
                return !!el && el.textContent.indexOf('សល់ ' + left) !== -1;
            }, 5 - i);
        }
        check('PIN ខុសរាប់ចំនួនដងដែលនៅសល់ត្រឹមត្រូវ', (await page.textContent('#pinMsg')).includes('សល់ 1'),
            await page.textContent('#pinMsg'));
        await page.fill('#pinInput', '000000');
        await page.click('#pinVerifyBtn');
        await page.waitForFunction(() => document.querySelector('#pinMsg .msg.bad').textContent.includes('១ នាទី'));
        check('ខុស ៥ ដង ➜ ចាក់សោ ១ នាទី', true);
        await page.fill('#pinInput', PIN);
        await page.click('#pinVerifyBtn');
        await page.waitForFunction(() => document.querySelector('#pinMsg .msg.bad').textContent.includes('រង់ចាំ'));
        check('អំឡុងចាក់សោ ➜ សូម្បី PIN ត្រឹមត្រូវក៏មិនចូលបាន', !(await page.isVisible('#appMain')));

        await page.evaluate(() => localStorage.removeItem('zoeimport_pin_lockout_until'));
        await page.fill('#pinInput', PIN);
        await page.click('#pinVerifyBtn');
        await page.waitForSelector('#appMain:not(.hidden)');
        check('PIN ត្រឹមត្រូវ ➜ ស្រាយការតភ្ជាប់វិញបាន', (await page.textContent('#configSummary')).includes('script.google.com'));
        await page.waitForFunction(() => document.getElementById('statusFoot').textContent.includes('Customers'));
        check('ស្ថានភាព Sheet ត្រូវទាញឡើងវិញ', (await page.textContent('#statusFoot')).includes('74'));
        equal('ប្រអប់ PIN ត្រូវសម្អាតក្រោយដោះសោ', await page.inputValue('#pinInput'), '');

        const tampered = await page.evaluate(async () => {
            const raw = JSON.parse(localStorage.getItem('zoeimport_config'));
            raw.p.data[0] = (raw.p.data[0] + 1) % 256;
            localStorage.setItem('zoeimport_config', JSON.stringify(raw));
            return true;
        });
        check('អាចកែ ciphertext សម្រាប់តេស្ត', tampered);
        await page.reload({ waitUntil: 'load' });
        await page.fill('#pinInput', PIN);
        await page.click('#pinVerifyBtn');
        await page.waitForSelector('#configMsg .msg.bad');
        check('ciphertext ដែលត្រូវកែ ➜ បដិសេធ មិនប្រើតម្លៃខូច',
            (await page.textContent('#configMsg')).includes('ស្រាយការតភ្ជាប់មិនបាន'));
        check('ciphertext ខូច ➜ ត្រឡប់ទៅទម្រង់កំណត់ការតភ្ជាប់', await page.isVisible('#configForm'));

        equal('គ្មានកំហុស runtime ពេញលំហូរទាំងមូល', pageErrors, []);

        await context.close();
    } finally {
        await browser.close();
        server.close();
        try {
            fs.unlinkSync(fixture);
        } catch (err) {
        }
    }
}

run().then(() => {
    console.log('');
    console.log('ZoeImport — ' + passed + ' assertions passed, ' + failures.length + ' failed');
    if (failures.length) {
        failures.forEach((f) => console.log('  ✗ ' + f));
        process.exit(1);
    }
}, (err) => {
    console.log('ZoeImport — តេស្តធ្លាក់៖ ' + (err && err.stack ? err.stack : err));
    process.exit(1);
});
