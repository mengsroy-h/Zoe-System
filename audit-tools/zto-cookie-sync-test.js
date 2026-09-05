// ⛔ ចាក់សោ Windows helper ដែលកាន់ credential ២ ក្នុងសតិ៖ ZTO Cookie និង
// Netlify PAT។ វាផ្ទៀងផ្ទាត់ថាឧបករណ៍ចាប់ Request Header ពិត, អ៊ិនគ្រីប PAT
// ដោយ Windows DPAPI, សរសេរ Cookie ចូល Netlify Blobs **ដោយគ្មាន redeploy**
// និង settle ពេលបណ្តាញព្យួរ។
'use strict';

const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
let acorn = null;
try { acorn = require('acorn'); } catch (_) { acorn = null; }

const ROOT = process.env.ZTO_SYNC_APP_DIR
    ? path.resolve(process.env.ZTO_SYNC_APP_DIR)
    : path.resolve(__dirname, '..');
const TOOL_DIR = path.join(ROOT, 'tools', 'zto-cookie-sync-windows');
const SOURCE_PATH = path.join(TOOL_DIR, 'sync-zto-cookie.js');
const PACKAGE_PATH = path.join(TOOL_DIR, 'package.json');
const SETUP_PATH = path.join(TOOL_DIR, 'setup.cmd');
const RUN_PATH = path.join(TOOL_DIR, 'sync-zto-cookie.cmd');
const SCHEDULE_PATH = path.join(TOOL_DIR, 'schedule-zto-cookie.cmd');
const SCHEDULE_PS_PATH = path.join(TOOL_DIR, 'schedule.ps1');
const CONFIGURE_PATH = path.join(TOOL_DIR, 'configure.ps1');
const TOKEN_READER_PATH = path.join(TOOL_DIR, 'read-token.ps1');
const README_PATH = path.join(TOOL_DIR, 'README-KH.md');
const FUNCTION_PATH = path.join(ROOT, 'ZoeW', 'netlify', 'functions', 'zto-order-detail.js');

const COOKIE = 'BOS-MAN-SESSION=s3cr3t987; sidebarStatus=0';
const TOKEN = 'test-only-token-for-mocked-netlify-api-0123456789';
const SITE_ID = 'zoew-site-123';
const SITE_URL = 'https://zoew.netlify.app';
const PROXY_KEY = 'proxy-key-for-tests-0123456789ab';
const ACCOUNT_ID = 'account-456';
const SITE_STORE_PREFIX = 'site:';

function constOf(src, name) {
    const match = new RegExp('const ' + name + " = '([^']*)'").exec(src);
    return match ? match[1] : '';
}
let pass = 0;
let fail = 0;

function ok(label, condition, detail) {
    if (condition) {
        pass++;
        console.log('   ok    ' + label);
    } else {
        fail++;
        console.log('  FAIL   ' + label + (detail === undefined ? '' : '\n         ' + detail));
    }
}

function read(file) {
    try { return fs.readFileSync(file, 'utf8'); } catch (_) { return ''; }
}

function isWindowsCmdSafe(text) {
    return /^[\x00-\x7f]*$/.test(text)
        && text.includes('\r\n')
        && !text.replace(/\r\n/g, '').includes('\n');
}

function fakeResponse(status, data, counters) {
    const stats = counters || {};
    return {
        ok: status >= 200 && status < 300,
        status,
        text: async () => {
            stats.reads = (stats.reads || 0) + 1;
            return JSON.stringify(data === undefined ? {} : data);
        },
        body: {
            cancel: async () => {
                stats.cancels = (stats.cancels || 0) + 1;
            }
        }
    };
}

const source = read(SOURCE_PATH);
const setup = read(SETUP_PATH);
const runner = read(RUN_PATH);
const schedule = read(SCHEDULE_PATH);
const schedulePs = read(SCHEDULE_PS_PATH);
const configure = read(CONFIGURE_PATH);
const tokenReader = read(TOKEN_READER_PATH);
const readme = read(README_PATH);
const functionSource = read(FUNCTION_PATH);
const FN_STORE_NAME = constOf(functionSource, 'COOKIE_STORE_NAME');
const FN_STORE_KEY = constOf(functionSource, 'COOKIE_STORE_KEY');
let pkg = {};
try { pkg = JSON.parse(read(PACKAGE_PATH)); } catch (_) {}

let api = null;
if (source) {
    try {
        delete require.cache[require.resolve(SOURCE_PATH)];
        api = require(SOURCE_PATH);
    } catch (error) {
        ok('source អាច require បានដោយគ្មាន runtime side effect', false, error && error.code);
    }
}

async function run() {
    console.log('=== ១. ជាន់អប្បបរមា និងរចនាសម្ព័ន្ធ ===');
    ok('ឃើញ sync-zto-cookie.js', source.length > 14000, source.length);
    ok('ឃើញ package.json', Object.keys(pkg).length > 0);
    ok('ឃើញ setup.cmd ជា ASCII + CRLF សម្រាប់ cmd.exe',
        setup.length > 700 && isWindowsCmdSafe(setup), setup.length);
    ok('ឃើញ sync-zto-cookie.cmd ជា ASCII + CRLF សម្រាប់ cmd.exe',
        runner.length > 500 && isWindowsCmdSafe(runner), runner.length);
    ok('ឃើញ schedule-zto-cookie.cmd ជា ASCII + CRLF សម្រាប់ cmd.exe',
        schedule.length > 400 && isWindowsCmdSafe(schedule), schedule.length);
    ok('ឃើញ configure.ps1', configure.length > 1300, configure.length);
    ok('ឃើញ read-token.ps1', tokenReader.length > 600, tokenReader.length);
    ok('ឃើញ README-KH.md', readme.length > 3000, readme.length);
    ok('export pure helpers សម្រាប់វាស់ឥរិយាបថ',
        api && typeof api.validateCookieHeader === 'function'
        && typeof api.syncNetlifyCookie === 'function'
        && typeof api.timedFetch === 'function');

    console.log('\n=== ២. ចាប់ request ពិត — មិនត្រឡប់ទៅ extension ===');
    ok('target ត្រូវជា HTTPS API host',
        api && api.isTargetApiUrl('https://aargus-api.ztoglobal.com/scan/get/order/detail'));
    ok('បដិសេធ HTTP', api && !api.isTargetApiUrl('http://aargus-api.ztoglobal.com/scan/get/order/detail'));
    ok('បដិសេធ host បន្លំ', api && !api.isTargetApiUrl('https://aargus-api.ztoglobal.com.evil.test/scan/get/order/detail'));
    // ⛔ Cookie ជារបស់ **domain** មិនមែន path ➜ សំណើណាមួយទៅ host នោះក៏ផ្ទុក
    // BOS-MAN-SESSION ដដែល ➜ អ្នកប្រើលែងត្រូវចុចបើកកញ្ចប់រាល់ដង។
    // ការការពារពិតគឺ validateCookieHeader() ដែលទាមទារ session ពិត។
    ok('ទទួល path ណាមួយលើ host ដដែល (លែងត្រូវចុចបើកកញ្ចប់)',
        api && api.isTargetApiUrl('https://aargus-api.ztoglobal.com/other'));
    ok('បដិសេធ host ផ្សេងទាំងស្រុង',
        api && !api.isTargetApiUrl('https://argus.ztoglobal.com/scan/get/order/detail'));
    ok('ប្រើ request.allHeaders() ពិត', /await request\.allHeaders\(\)/.test(source));
    ok('មិនប្រើ chrome.cookies/context.cookies/document.cookie',
        !/chrome\.cookies|context\.cookies|document\.cookie/.test(source));

    console.log('\n=== ៣. Cookie validation និង header injection ===');
    if (api) {
        ok('ទម្រង់ធម្មតាត្រូវ normalize', api.validateCookieHeader('  ' + COOKIE + '  ') === COOKIE);
        for (const [label, value, code] of [
            ['CR/LF', 'SESSION=abc\r\nX-Evil=yes', 'COOKIE_CONTROL_CHAR'],
            ['CR/LF នៅគែម', '\r\nSESSION=abc', 'COOKIE_CONTROL_CHAR'],
            ['NUL', 'SESSION=abc\0evil', 'COOKIE_CONTROL_CHAR'],
            // ⛔ តាំងពី 2026-09-02 គូខូចត្រូវ **រំលង** ជំនួសការបោះ ដូច្នេះ jar
            // ដែលគ្មាន session ត្រឹមត្រូវសល់ ធ្លាក់ចូល COOKIE_SESSION_MISSING។
            // អ្វីដែលការអះអាងនេះការពារនៅដដែល ៖ **គ្មាន jar ណាមួយឡើងដល់ upload**។
            ['គ្មាន =', 'this-is-not-a-pair', 'COOKIE_SESSION_MISSING'],
            ['ឈ្មោះខូច', 'bad name=value', 'COOKIE_SESSION_MISSING'],
            ['session តម្លៃមានចន្លោះ', 'BOS-MAN-SESSION=has space', 'COOKIE_SESSION_MISSING'],
            ['គ្មាន session credential', 'sidebarStatus=0', 'COOKIE_SESSION_MISSING']
        ]) {
            let got = '';
            try { api.validateCookieHeader(value); } catch (error) { got = error.code; }
            ok(label + ' ➜ បដិសេធដោយមាន code', got === code, got);
            ok(label + ' ➜ ⛔ មិនត្រឡប់តម្លៃណាមួយសោះ', got !== '', got);
        }
        const many = Array.from({ length: 65 }, (_, i) => 'k' + i + '=v').join('; ');
        let manyCode = '';
        try { api.validateCookieHeader(many); } catch (error) { manyCode = error.code; }
        ok('គូច្រើនលើស ៦៤ គ្មាន session ➜ បដិសេធ',
            manyCode === 'COOKIE_SESSION_MISSING', manyCode);
    } else {
        for (let i = 0; i < 9; i++) ok('Cookie validation #' + (i + 1), false);
    }

    console.log('\n=== ៤. Windows DPAPI និង dependency ===');
    ok('dependency pin តែ Playwright (គ្មាន Netlify CLI)',
        pkg.private === true && pkg.dependencies
        && pkg.dependencies['playwright-core'] === '1.62.1'
        && !pkg.dependencies['netlify-cli']
        && Object.keys(pkg.dependencies).length === 1);
    ok('setup ដំឡើង dependency ដែល pin ក្នុង package.json',
        /call npm install --ignore-scripts --no-audit --no-fund/.test(setup));
    ok('setup ទទួល token ដោយ prompt លាក់អក្សរ',
        /Read-Host[^\r\n]+-AsSecureString/.test(configure));
    ok('setup អ៊ិនគ្រីបតាម DPAPI CurrentUser (គ្មាន custom key)',
        /ConvertFrom-SecureString\s+-SecureString/.test(configure)
        && !/ConvertFrom-SecureString[^\r\n]+-(Key|SecureKey)/.test(configure));
    ok('token reader ដោះសោ និងសម្អាត BSTR',
        /ConvertTo-SecureString/.test(tokenReader)
        && /SecureStringToBSTR/.test(tokenReader)
        && /ZeroFreeBSTR/.test(tokenReader));
    ok('token មិនដាក់ក្នុង command line ឬ environment',
        /-File', scriptPath, '-TokenPath', tokenPath/.test(source)
        && !/process\.env\.[A-Z_]*TOKEN\s*=|NETLIFY_AUTH_TOKEN/.test(source));
    ok('PowerShell child មិនឆ្លង shell និងមិន inherit output',
        /shell:\s*false/.test(source)
        && /stdio:\s*\['ignore', 'pipe', 'ignore'\]/.test(source));
    ok('setup ផ្ទៀងផ្ទាត់ credential មុនអះអាងជោគជ័យ',
        /--verify-setup/.test(setup) && /await verifyNetlifySetup\(\)/.test(source));
    ok('runner ទាមទារ config + encrypted token ក្រៅ repo',
        /%LOCALAPPDATA%\\Zoe-System\\ZTO-Cookie-Sync\\config\.json/.test(runner)
        && /netlify-token\.dpapi/.test(runner));
    ok('profile និង credential នៅ LOCALAPPDATA មិនមែនក្នុង repo',
        /process\.env\.LOCALAPPDATA/.test(source)
        && /ZTO-Cookie-Sync/.test(source)
        && /LOCALAPPDATA/.test(configure));
    ok('support Edge មុន Chrome និងអាច override',
        /\['msedge', 'chrome'\]/.test(source) && /ZTO_SYNC_BROWSER/.test(source));
    // ⛔ កំហុស៖ ជំនាន់មុនអៈអាងលើ **ឆ្លាក់ពាក្យណាមួយ** (`មិនត្រូវបានបង្ហាញ`) ➔ ការរៀបចំឯកសារឡើងវិញ
    // នៃជុំ 2026-09-02 (ពាក្យដដែលប្ដូរទៅ «មិនបង្ហាញដាច់ខាត») ធ្វើឲ្យ checker ធ្លាក់
    // ខណៈវិធានសុវត្ថិភាពពិត **មិនប្រែសោះ** ➔ **ការធ្លាក់ក្លែងក្លាយ** (សំណួរទី ១១)។
    // ច្បាប់ត្រឹមត្រូវ ៖ អៈអាងលើ **ការពិត** (ហេតុអ្វី secret មិនលេច)
    // ដោយយកឡើងមកពីការអានឯកសារពិត — មិនមែនលើប្រយោគតែមួយទេ។
    const readmeSecretRule = /(?:\u200b|[^\n])*(?:មិនបង្ហាញ|មិនត្រូវបានបង្ហាញ|មិនបោះពុម្ព)/;
    const readmeMentionsPatSecrecy = readme
        .split('\n')
        .some((line) => /PAT|Personal Access Token|ZTO_PROXY_KEY/.test(line) && readmeSecretRule.test(line));
    ok('README ពន្យល់ DPAPI/PAT និងការមិនបង្ហាញ secret',
        /DPAPI/.test(readme) && /Personal Access Token/.test(readme) && readmeMentionsPatSecrecy,
        { dpapi: /DPAPI/.test(readme), pat: /Personal Access Token/.test(readme), secrecy: readmeMentionsPatSecrecy });

    console.log('\n=== ៥. Netlify API និង secret boundary ===');
    ok('ប្រើ Netlify API origin ថេរ HTTPS',
        /const NETLIFY_API_ORIGIN = 'https:\/\/api\.netlify\.com'/.test(source));
    ok('site lookup ទាញ account_id មិនទាមទារឲ្យអ្នកបញ្ចូល',
        /site\.account_id/.test(source) && !/NETLIFY_ACCOUNT_ID/.test(source));
    ok('សរសេរ Cookie ចូល Netlify Blobs (ផ្លូវ /api/v1/blobs)',
        /'\/api\/v1\/blobs\/'/.test(source) && !!constOf(source, 'BLOB_STORE_NAME'));
    // ⛔ **ស្នាមភ្ជាប់ (សំណួរទី ៧)** ៖ helper សរសេរតាម Netlify API ចំណែក
    // Function អានតាម edge របស់ `@netlify/blobs`។ SDK v11 ដាក់បច្ច័យ
    // `site:` ចូលឈ្មោះ store ខាងក្នុង (`getStore('x')` ➜ `site:x`) ដូច្នេះ
    // ការសរសេរទៅឈ្មោះ **ឥតបច្ច័យ** ធ្លាក់ចូល legacy namespace ➜ ការសរសេរ
    // ជោគជ័យ តែ Function អានមិនឃើញជារៀងរហូត (វាស់បាន 2026-09-02)។
    ok('ជាន់អប្បបរមា ៖ អាន Function ដែលអាន store បាន',
        functionSource.length > 8000 && !!FN_STORE_NAME && !!FN_STORE_KEY,
        functionSource.length + '/' + FN_STORE_NAME + '/' + FN_STORE_KEY);
    ok('helper និង Function ចែកឈ្មោះ store និងកូនសោដដែល',
        constOf(source, 'BLOB_STORE_NAME') === FN_STORE_NAME
        && constOf(source, 'BLOB_KEY') === FN_STORE_KEY,
        constOf(source, 'BLOB_STORE_NAME') + '/' + constOf(source, 'BLOB_KEY'));
    ok('⛔ ផ្លូវ API ប្រើឈ្មោះខាងក្នុង site:<store> ដូច SDK',
        /BLOB_STORE_PATH = SITE_STORE_PREFIX \+ BLOB_STORE_NAME/.test(source)
        && /const SITE_STORE_PREFIX = 'site:'/.test(source)
        && /\+ BLOB_STORE_PATH \+/.test(source),
        constOf(source, 'SITE_STORE_PREFIX'));
    ok('ស្នើ signed URL ដោយ accept header ផ្លូវការ',
        /application\/json;type=signed-url/.test(source));
    ok('⛔ លែងសរសេរ env និងលែង trigger deploy ទៀត (គ្មានការរង់ចាំ)',
        !/\/builds/.test(source) && !/env\/ZTO_COOKIE|NETLIFY_ENV_KEY/.test(source));
    ok('⛔ signed URL ត្រូវជា HTTPS មុនផ្ញើ Cookie',
        /signed\.protocol !== 'https:'/.test(source));
    ok('redirect ត្រូវបដិសេធ ដើម្បីកុំឲ្យ Authorization ហូរទៅ host ផ្សេង',
        /redirect:\s*'error'/.test(source));
    ok('timeout settle ដោយ timer ពិត បន្ថែមលើ AbortController',
        /new Promise\(\(resolve, reject\)/.test(source)
        && /new AbortController\(\)/.test(source)
        && /finish\(codedError\('NETLIFY_TIMEOUT'[^)]*\)\)/.test(source));
    ok('response ដែលអាចមាន secret ត្រូវ discard មិន print body',
        /await discardResponse\(response\)/.test(source)
        && !/console\.(log|error)\([^\r\n]*(response|cleanCookie|credentials\.token)/.test(source));
    ok('គ្មាន server-side token/update endpoint ឬ Netlify CLI login',
        !/ZTO_COOKIE_UPDATE_KEY|NETLIFY_AUTH_TOKEN|netlify-cli|\['login'\]|\['link'\]/.test(source + setup + configure));
    ok('Cookie មិនសរសេរចូល file/env',
        !/writeFile[^\r\n]*(cookie|cleanCookie)|process\.env\s*\[[^\]]+\]\s*=\s*(cookie|cleanCookie)|process\.env\.[A-Z_]+\s*=\s*(cookie|cleanCookie)/i.test(source));
    ok('សារ failure ជ្រើសតែ error code មិនភ្ជាប់ message/body',
        /safeFailureMessage\(error && error\.code\)/.test(source)
        && !/safeFailureMessage\([^)]*\.message/.test(source));

    console.log('\n=== ៦. Request Header behavior ===');
    if (api) {
        const exact = await api.cookieHeaderFromRequest({
            url: () => 'https://aargus-api.ztoglobal.com/scan/get/order/detail',
            allHeaders: async () => ({ Accept: 'application/json', Cookie: COOKIE })
        });
        ok('exact request ➜ យក Cookie header ដដែល', exact === COOKIE);
        let called = 0;
        const other = await api.cookieHeaderFromRequest({
            url: () => 'https://evil.test/scan/get/order/detail',
            allHeaders: async () => { called++; return { cookie: COOKIE }; }
        });
        ok('request ផ្សេង ➜ ទទេ និងមិនអាន header', other === '' && called === 0, called);

        const context = new EventEmitter();
        const waiting = api.waitForOrderCookie(context, 200);
        context.emit('request', {
            url: () => 'https://aargus-api.ztoglobal.com/scan/get/order/detail',
            allHeaders: async () => ({ cookie: 'sidebarStatus=0' })
        });
        setTimeout(() => context.emit('request', {
            url: () => 'https://aargus-api.ztoglobal.com/scan/get/order/detail',
            allHeaders: async () => ({ cookie: COOKIE })
        }), 5);
        ok('request មុន Login គ្មាន session ➜ រង់ចាំ request ត្រឹមត្រូវបន្ទាប់',
            await waiting === COOKIE);
    } else {
        ok('exact request ➜ Cookie', false);
        ok('request ផ្សេង ➜ ទទេ', false);
        ok('request គ្មាន session ➜ រង់ចាំ', false);
    }

    console.log('\n=== ៦ខ. ការផ្ទៀងផ្ទាត់ចុងក្រោយ និងរបៀបសុខភាព ===');
    ok('statePaths មានផ្លូវ proxy key ក្រៅ repo',
        api && /Zoe-System/.test(api.statePaths().proxyKey)
        && /\.dpapi$/.test(api.statePaths().proxyKey),
        api && api.statePaths().proxyKey);
    // ⛔ កុំបញ្ឈប់ checker ពេលរក function មិនឃើញ — រាយវាជាការធ្លាក់ដែលមានឈ្មោះ
    // រួច stub ជំនួស (ច្បាប់ផ្នែក ៣ របស់ `checker-coverage.js`)។
    const hasVerifyApi = !!(api
        && typeof api.validateSiteUrl === 'function'
        && typeof api.cookieFingerprint === 'function'
        && typeof api.verifyCookieLive === 'function'
        && typeof api.checkCookieHealth === 'function');
    ok('export ផ្លូវផ្ទៀងផ្ទាត់ និងសុខភាព', hasVerifyApi);
    ok('validateSiteUrl ទទួល HTTPS origin',
        hasVerifyApi && api.validateSiteUrl('https://zoew.netlify.app/') === SITE_URL);
    ok('⛔ validateSiteUrl បដិសេធ HTTP',
        hasVerifyApi && (() => { try { api.validateSiteUrl('http://zoew.netlify.app'); return false; } catch (e) { return e.code === 'SITE_URL_INVALID'; } })());
    ok('validateSiteUrl ទទេ ➜ ទទេ (ស្រេចចិត្ត)', hasVerifyApi && api.validateSiteUrl('') === '');
    ok('cookieFingerprint ជា ៨ តួ hex និងមិនមែន Cookie',
        hasVerifyApi && /^[0-9a-f]{8}$/.test(api.cookieFingerprint(COOKIE))
        && api.cookieFingerprint(COOKIE).indexOf('s3cr3t') === -1,
        hasVerifyApi && api.cookieFingerprint(COOKIE));

    if (hasVerifyApi) {
        const diagCalls = [];
        const diagResponder = (body) => async (url, options) => {
            diagCalls.push({ url, options });
            return fakeResponse(200, body);
        };
        const goodFingerprint = api.cookieFingerprint(COOKIE);

        const verified = await api.verifyCookieLive(COOKIE, {
            siteUrl: SITE_URL,
            proxyKey: PROXY_KEY,
            timeoutMs: 100,
            gapMs: 1,
            deadlineMs: 5000,
            sleepImpl: async () => {},
            fetchImpl: diagResponder({ cookie: { source: 'blob', fingerprint: goodFingerprint } })
        });
        ok('ការផ្ទៀងផ្ទាត់ ➜ ត្រូវគ្នាភ្លាម',
            verified.status === 'match' && verified.attempts === 1 && verified.source === 'blob',
            JSON.stringify(verified));
        ok('diag ហៅ path ត្រឹមត្រូវជាមួយ header សោ',
            diagCalls[0]
            && diagCalls[0].url.indexOf(SITE_URL + '/.netlify/functions/zto-order-detail?diag=1') === 0
            && diagCalls[0].options.headers['X-Zoe-Proxy-Key'] === PROXY_KEY
            && diagCalls[0].options.method === 'GET',
            diagCalls[0] && diagCalls[0].url);
        // ⛔ ការផ្ទៀងផ្ទាត់ត្រូវរំលង cache ៦០ វិ. របស់ Function បើមិនដូច្នេះ
        // អ្នកប្រើរង់ចាំរហូតដល់ ៧៥ វិនាទីក្រោយយក Cookie ថ្មីរាល់ដង (វាស់រួច)។
        ok('⛔ diag ផ្ទុក `fresh=1` ➜ អាន blob ពិត មិនរង់ចាំ cache ផុតកំណត់',
            /[?&]fresh=1(?:&|$)/.test(diagCalls[0] ? diagCalls[0].url : ''),
            diagCalls[0] && diagCalls[0].url);
        ok('⛔ ទិសផ្ទុយ ៖ `fresh=1` ភ្ជាប់ជាមួយ `diag=1` ជានិច្ច (មិនមែនផ្លូវ lookup)',
            !diagCalls.some((c) => /fresh=1/.test(c.url) && !/[?&]diag=1(?:&|$)/.test(c.url)),
            diagCalls.map((c) => c.url));
        ok('⛔ សោមិនចូល URL សោះ', diagCalls.every((call) => call.url.indexOf(PROXY_KEY) === -1));

        let polls = 0;
        const slowVerified = await api.verifyCookieLive(COOKIE, {
            siteUrl: SITE_URL,
            proxyKey: PROXY_KEY,
            timeoutMs: 100,
            gapMs: 1,
            deadlineMs: 5000,
            sleepImpl: async () => {},
            fetchImpl: async () => {
                polls++;
                return fakeResponse(200, {
                    cookie: {
                        source: 'blob',
                        fingerprint: polls >= 3 ? goodFingerprint : 'deadbeef'
                    }
                });
            }
        });
        ok('Cookie ចាស់នៅក្នុង cache ➜ ព្យាយាមវិញរហូតត្រូវគ្នា',
            slowVerified.status === 'match' && slowVerified.attempts === 3,
            JSON.stringify(slowVerified));

        const stale = await api.verifyCookieLive(COOKIE, {
            siteUrl: SITE_URL,
            proxyKey: PROXY_KEY,
            timeoutMs: 100,
            gapMs: 1,
            deadlineMs: 30,
            sleepImpl: async () => {},
            fetchImpl: diagResponder({ cookie: { source: 'env', fingerprint: 'deadbeef' } })
        });
        ok('មិនត្រូវគ្នារហូតដល់ផុតកំណត់ ➜ mismatch (មិនបោះ)',
            stale.status === 'mismatch' && stale.attempts >= 1, JSON.stringify(stale));

        const unreachable = await api.verifyCookieLive(COOKIE, {
            siteUrl: SITE_URL,
            proxyKey: PROXY_KEY,
            timeoutMs: 10,
            gapMs: 1,
            deadlineMs: 30,
            sleepImpl: async () => {},
            fetchImpl: async () => { throw new Error('boom'); }
        });
        ok('Function មិនឆ្លើយ ➜ unreachable (មិនបោះ មិនអះអាងជោគជ័យ)',
            unreachable.status === 'unreachable', JSON.stringify(unreachable));

        let threw = false;
        let badCookie = null;
        try {
            badCookie = await api.verifyCookieLive('not-a-cookie', {
                siteUrl: SITE_URL,
                proxyKey: PROXY_KEY,
                timeoutMs: 10,
                gapMs: 1,
                deadlineMs: 10,
                sleepImpl: async () => {},
                fetchImpl: async () => { throw new Error('must not run'); }
            });
        } catch (_) {
            threw = true;
        }
        ok('⛔ ការផ្ទៀងផ្ទាត់មិនប្រែការសរសេរជោគជ័យទៅជាការធ្លាក់',
            !threw && badCookie && badCookie.status === 'unverifiable',
            threw ? 'threw' : JSON.stringify(badCookie));

        const unconfigured = await api.verifyCookieLive(COOKIE, {
            siteUrl: '',
            proxyKey: '',
            fetchImpl: async () => { throw new Error('must not run'); }
        });
        ok('⛔ មិនទាន់កំណត់ ➜ unconfigured ដោយមិនហៅបណ្តាញ',
            unconfigured.status === 'unconfigured', JSON.stringify(unconfigured));

        const healthy = await api.checkCookieHealth({
            siteUrl: SITE_URL,
            proxyKey: PROXY_KEY,
            timeoutMs: 100,
            fetchImpl: diagResponder({
                cookie: { source: 'blob', fingerprint: goodFingerprint, ageMs: 10, renewals: 2, authRejectedAgeMs: null }
            })
        });
        ok('សុខភាព ៖ គ្មានការបដិសេធ ➜ healthy',
            healthy.status === 'ok' && healthy.healthy === true && healthy.renewals === 2,
            JSON.stringify(healthy));

        const rejected = await api.checkCookieHealth({
            siteUrl: SITE_URL,
            proxyKey: PROXY_KEY,
            timeoutMs: 100,
            fetchImpl: diagResponder({
                cookie: { source: 'blob', fingerprint: goodFingerprint, authRejectedAgeMs: 5000 }
            })
        });
        ok('សុខភាព ៖ ZTO ទើបបដិសេធ ➜ មិន healthy (ត្រូវយក Cookie ថ្មី)',
            rejected.status === 'ok' && rejected.healthy === false, JSON.stringify(rejected));

        const noAuth = await api.checkCookieHealth({
            siteUrl: SITE_URL,
            proxyKey: PROXY_KEY,
            timeoutMs: 100,
            fetchImpl: diagResponder({ cookie: { source: 'none', fingerprint: null, authRejectedAgeMs: null } })
        });
        ok('សុខភាព ៖ គ្មាន Cookie សោះ ➜ មិន healthy',
            noAuth.healthy === false, JSON.stringify(noAuth));
    } else {
        for (let i = 0; i < 13; i++) ok('verify/health behavior #' + (i + 1), false);
    }

    ok('របៀប --check និង --auto មានក្នុងកូដ',
        /--check/.test(source) && /--auto/.test(source));
    // ⛔ --auto រត់ដោយគ្មានមនុស្ស ➜ វាមិនត្រូវបើក browser ដោយមិនដឹងស្ថានភាព
    const autoCases = api && typeof api.shouldRefreshInAuto === 'function';
    ok('export ការសម្រេចរបស់ --auto', autoCases);
    ok('--auto ៖ Cookie ស្លាប់ ➜ យកថ្មី',
        autoCases && api.shouldRefreshInAuto({ status: 'ok', healthy: false }) === true);
    ok('--auto ៖ Cookie នៅដំណើរការ ➜ មិនបើក browser',
        autoCases && api.shouldRefreshInAuto({ status: 'ok', healthy: true }) === false);
    ok('⛔ --auto ៖ មិនទាន់កំណត់ ➜ មិនបើក browser រាល់ការចូល Windows',
        autoCases && api.shouldRefreshInAuto({ status: 'unconfigured', healthy: false }) === false);
    ok('⛔ --auto ៖ ភ្ជាប់ Function មិនបាន ➜ មិនបើក browser (ការសរសេរក៏ធ្លាក់ដែរ)',
        autoCases && api.shouldRefreshInAuto({ status: 'unreachable', healthy: false }) === false);
    // ⛔ **ការអះអាងវាស់ការពិត មិនមែនការជ្រើសពាក្យ** ៖ អ្វីដែលសំខាន់គឺ «មាន
    // Task ដែលរត់ --auto ហើយលុបវិញបាន» — មិនមែនថាវាសរសេរដោយ `schtasks` ឬ
    // PowerShell ទេ។ ការចាក់ឈ្មោះឧបករណ៍ជាប់ ធ្វើឲ្យការកែឫសគល់ «Access is
    // denied» (2026-09-05) ធ្លាក់ដោយខុស។
    const scheduleAll = schedule + '\n' + schedulePs;
    ok('មានផ្លូវចុះឈ្មោះ Task ដែលរត់ --auto និងមានផ្លូវលុបវិញ',
        /--auto/.test(scheduleAll)
        && /(schtasks|Register-ScheduledTask)/i.test(scheduleAll)
        && /(\/Delete|Unregister-ScheduledTask)/i.test(scheduleAll),
        scheduleAll.length);
    ok('sync-zto-cookie.cmd បញ្ជូន argument ទៅ node',
        /node sync-zto-cookie\.js %\*/.test(runner), runner.length);
    // ⛔ ជំនាន់ regex ចាប់ **ឈ្មោះ** ➜ វារាយការណ៍ខុសលើសារដែលបង្ហាញ *ឈ្មោះ*
    // env var (ដែលអ្នកប្រើត្រូវការដើម្បីដឹងថាត្រូវកំណត់អ្វី) ហើយ **មិនចាប់**
    // `console.log(x)` ដែល x ជា alias នៃសោ។ AST សួរសំណួរពិត ៖ តើ **តម្លៃ**
    // អាចឡើងដល់ output ទេ? ខ្សែអក្សរដែលមានឈ្មោះ env var មិនមែនតម្លៃទេ។
    // ⛔ **សំណើអ្នកប្រើ (2026-09-02)** ៖ *«សូមអោយបង្ហាញ cookie ដែលយកបានពី
    // argus ក្នុង cmd ផង»* ➜ `cookieHeader` ត្រូវដកចេញពីបញ្ជីនេះដោយចេតនា។
    // ⛔ **Netlify PAT និង ZTO_PROXY_KEY នៅតែហាមដាច់ខាត** — ពួកវាជាសិទ្ធិលើ
    // គណនី Netlify ចំណែក Cookie ជា session ZTO ដែលអ្នកប្រើកាន់ស្រាប់។
    const SECRET_IDS = ['proxyKey', 'PROXY_KEY', 'token', 'secureProxyKey',
        'botToken', 'telegramToken', 'secureTelegramToken'];
    let secretPrints = [];
    if (acorn) {
        const tree = acorn.parse(source, { ecmaVersion: 2022, locations: true });
        const consoleCalls = [];
        (function walk(node) {
            if (!node || typeof node !== 'object') return;
            if (Array.isArray(node)) { node.forEach(walk); return; }
            if (node.type === 'CallExpression'
                && node.callee && node.callee.type === 'MemberExpression'
                && node.callee.object && node.callee.object.name === 'console') {
                consoleCalls.push(node);
            }
            for (const key of Object.keys(node)) {
                if (key === 'type' || key === 'loc' || key === 'start' || key === 'end') continue;
                walk(node[key]);
            }
        })(tree);
        consoleCalls.forEach((call) => {
            (function scan(node) {
                if (!node || typeof node !== 'object') return;
                if (Array.isArray(node)) { node.forEach(scan); return; }
                if (node.type === 'Identifier' && SECRET_IDS.indexOf(node.name) !== -1) {
                    secretPrints.push(node.name + '@' + node.loc.start.line);
                }
                for (const key of Object.keys(node)) {
                    if (key === 'type' || key === 'loc' || key === 'start' || key === 'end') continue;
                    scan(node[key]);
                }
            })(call.arguments);
        });
        ok('ជាន់អប្បបរមា ៖ ឃើញការហៅ console ពិត (កុំឲ្យការស្កេនទទេជាបៃតង)',
            consoleCalls.length >= 15, consoleCalls.length);

        // ⛔ **សំណើអ្នកប្រើ (2026-09-02)** ៖ *«កែ cmd អោយទៅជាអក្សរអង់គ្លេស
        // ព្រោះអក្សរខ្មែរក្នុង cmd ពិបាកអាន»*។ រូបភាពពី Windows ពិតបញ្ជាក់វា ៖
        // `cmd.exe` បំបែក UTF-8 Khmer កណ្តាលពាក្យ។ ច្បាប់ `.cmd` ASCII មាន
        // ស្រាប់ តែ **ខ្សែអក្សរក្នុង Node** រអិលកាត់ ➜ ចាក់សោវាត្រង់នេះ ៖
        // រាល់ខ្សែអក្សរក្នុង helper ត្រូវជា ASCII (comment ខ្មែរនៅដដែល)។
        const nonAsciiStrings = [];
        let stringLiterals = 0;
        (function scanText(node) {
            if (!node || typeof node !== 'object') return;
            if (Array.isArray(node)) { node.forEach(scanText); return; }
            if (node.type === 'Literal' && typeof node.value === 'string') {
                stringLiterals++;
                if (!/^[\x00-\x7f]*$/.test(node.value)) {
                    nonAsciiStrings.push('L' + node.loc.start.line);
                }
            }
            if (node.type === 'TemplateElement' && node.value && typeof node.value.raw === 'string') {
                stringLiterals++;
                if (!/^[\x00-\x7f]*$/.test(node.value.raw)) {
                    nonAsciiStrings.push('L' + node.loc.start.line);
                }
            }
            for (const key of Object.keys(node)) {
                if (key === 'type' || key === 'loc' || key === 'start' || key === 'end') continue;
                scanText(node[key]);
            }
        })(tree);
        ok('ជាន់អប្បបរមា ៖ ឃើញខ្សែអក្សរពិត', stringLiterals >= 80, stringLiterals);
        ok('⛔ គ្រប់ខ្សែអក្សរក្នុង helper ជា ASCII (cmd.exe អានខ្មែរមិនកើត)',
            nonAsciiStrings.length === 0,
            nonAsciiStrings.slice(0, 8).join(','));
    } else {
        ok('ជាន់អប្បបរមា ៖ ឃើញការហៅ console ពិត (កុំឲ្យការស្កេនទទេជាបៃតង)',
            false, 'គ្មាន acorn');
    }
    ok('⛔ តម្លៃសោ/token មិនត្រូវឡើងដល់ console (AST មិនមែនឈ្មោះ)',
        acorn && secretPrints.length === 0, secretPrints.join(', '));
    // ⛔ ការបង្ហាញ Cookie ជា **សំណើអ្នកប្រើ** — ចាក់សោវាទុក ដើម្បីកុំឲ្យជុំ
    // ក្រោយ «រឹង» វាវិញដោយផ្អែកលើច្បាប់ចាស់ «Cookie មិនត្រូវបង្ហាញ»។
    ok('បង្ហាញ Cookie ដែលចាប់បានក្នុង cmd (សំណើអ្នកប្រើ)',
        !!(api && typeof api.describeCapturedCookie === 'function')
        && api.describeCapturedCookie(COOKIE).indexOf(COOKIE) !== -1
        && /console\.log\(describeCapturedCookie\(/.test(source),
        api && typeof api.describeCapturedCookie);
    ok('⛔ configure.ps1 និង read-token.ps1 ជា ASCII (បង្ហាញក្នុង cmd បាន)',
        /^[\x00-\x7f]*$/.test(configure) && /^[\x00-\x7f]*$/.test(tokenReader)
        && configure.length > 2000,
        configure.length + '/' + tokenReader.length);
    ok('configure.ps1 អ៊ិនគ្រីប proxy key ដោយ DPAPI ដដែល',
        /proxy-key\.dpapi/.test(configure) && /AsSecureString/.test(configure)
        && (configure.match(/ConvertFrom-SecureString/g) || []).length >= 2,
        configure.length);

    console.log('\n=== ៧. Netlify API behavior (mock មិនប៉ះ production) ===');
    if (api) {
        const SIGNED_URL = 'https://blob-upload.netlify.test/signed-path?sig=abc123';
        const BLOB_URL = 'https://api.netlify.com/api/v1/blobs/' + SITE_ID
            + '/' + SITE_STORE_PREFIX + FN_STORE_NAME + '/' + FN_STORE_KEY;
        const LEGACY_URL = 'https://api.netlify.com/api/v1/blobs/' + SITE_ID
            + '/' + FN_STORE_NAME + '/' + FN_STORE_KEY;
        const calls = [];
        const fetchImpl = async (url, options) => {
            calls.push({ url, options });
            if (calls.length === 1) return fakeResponse(200, { url: SIGNED_URL });
            return fakeResponse(200, {});
        };
        await api.syncNetlifyCookie(COOKIE, {
            siteId: SITE_ID,
            token: TOKEN,
            fetchImpl,
            timeoutMs: 100
        });

        ok('ហៅ API ២ ដងតែប៉ុណ្ណោះ ៖ signed URL ➜ upload (គ្មាន build)',
            calls.length === 2, calls.length);
        ok('ស្នើ signed URL តាមផ្លូវ blob ត្រឹមត្រូវ',
            calls[0] && calls[0].options.method === 'PUT' && calls[0].url === BLOB_URL,
            calls[0] && calls[0].url);
        ok('⛔ មិនសរសេរចូល legacy namespace (Function អានមិនឃើញ)',
            calls[0] && calls[0].url !== LEGACY_URL,
            calls[0] && calls[0].url);
        ok('សំណើ signed URL មាន accept header ផ្លូវការ និងគ្មាន body',
            calls[0] && calls[0].options.headers.accept === 'application/json;type=signed-url'
            && calls[0].options.body === undefined,
            calls[0] && JSON.stringify(calls[0].options.headers));
        ok('upload ផ្ញើ Cookie ទៅ signed URL ដដែល',
            calls[1] && calls[1].options.method === 'PUT'
            && calls[1].url === SIGNED_URL
            && calls[1].options.body === COOKIE,
            calls[1] && calls[1].url);
        ok('⛔ PAT មិនហូរទៅ host របស់ signed URL សោះ',
            calls[1] && calls[1].options.headers.Authorization === undefined
            && JSON.stringify(calls[1].options.headers).indexOf(TOKEN) === -1,
            calls[1] && JSON.stringify(calls[1].options.headers));
        ok('សំណើ Netlify API ប្រើ Bearer token',
            calls[0].options.headers.Authorization === 'Bearer ' + TOKEN);
        ok('⛔ គ្មានសំណើណាដើរតាម redirect (error ឬ manual)',
            calls.every((call) => call.options.redirect === 'error' || call.options.redirect === 'manual'),
            calls.map((call) => call.options.redirect).join(','));
        ok('Cookie មិនចូល URL សោះ',
            calls.every((call) => !call.url.includes(COOKIE)));

        const urlFailureCalls = [];
        let urlFailureCode = '';
        const bodyStats = {};
        try {
            await api.syncNetlifyCookie(COOKIE, {
                siteId: SITE_ID,
                token: TOKEN,
                timeoutMs: 100,
                fetchImpl: async (url, options) => {
                    urlFailureCalls.push({ url, options });
                    return fakeResponse(422, { secret: COOKIE }, bodyStats);
                }
            });
        } catch (error) {
            urlFailureCode = error.code;
        }
        ok('signed URL ធ្លាក់ ➜ មិន upload Cookie',
            urlFailureCode === 'NETLIFY_BLOB_URL_FAILED' && urlFailureCalls.length === 1,
            urlFailureCode + '/' + urlFailureCalls.length);
        ok('error response body មិនត្រូវបានអាន',
            !bodyStats.reads && bodyStats.cancels === 1,
            JSON.stringify(bodyStats));

        const insecureCalls = [];
        let insecureCode = '';
        try {
            await api.syncNetlifyCookie(COOKIE, {
                siteId: SITE_ID,
                token: TOKEN,
                timeoutMs: 100,
                fetchImpl: async (url, options) => {
                    insecureCalls.push({ url, options });
                    return fakeResponse(200, { url: 'http://blob-upload.netlify.test/signed' });
                }
            });
        } catch (error) {
            insecureCode = error.code;
        }
        ok('⛔ signed URL មិនមែន HTTPS ➜ បដិសេធមុនផ្ញើ Cookie',
            insecureCode === 'NETLIFY_BLOB_URL_INVALID' && insecureCalls.length === 1,
            insecureCode + '/' + insecureCalls.length);

        const redirectCalls = [];
        let redirectCode = '';
        try {
            await api.syncNetlifyCookie(COOKIE, {
                siteId: SITE_ID,
                token: TOKEN,
                timeoutMs: 100,
                fetchImpl: async (url, options) => {
                    redirectCalls.push({ url, options });
                    if (redirectCalls.length === 1) return fakeResponse(200, { url: SIGNED_URL });
                    return fakeResponse(307, {});
                }
            });
        } catch (error) {
            redirectCode = error.code;
        }
        ok('⛔ upload ត្រូវ redirect ➜ បដិសេធដោយឈ្មោះ មិនមែនសារបណ្តាញ',
            redirectCode === 'NETLIFY_BLOB_REDIRECT' && redirectCalls.length === 2,
            redirectCode + '/' + redirectCalls.length);

        // ⛔ ការចាប់ Cookie ជាជំហាន **ដោយដៃ** ដែលថ្លៃជាងគេ (បើក browser ➜ Login
        //   ➜ Arrival Scan)។ ដូច្នេះការធ្លាក់ **បណ្តោះអាសន្ន** នៃ Netlify API
        //   (timeout · 429 · 5xx) មិនត្រូវបង្ខំអ្នកប្រើធ្វើជំហាននោះឡើងវិញទេ —
        //   វាត្រូវព្យាយាមឡើងវិញដោយស្វ័យប្រវត្តិ **ក្នុងពិដាន**។
        const uploadFailureCalls = [];
        const uploadFailureSleeps = [];
        let uploadFailureCode = '';
        try {
            await api.syncNetlifyCookie(COOKIE, {
                siteId: SITE_ID,
                token: TOKEN,
                timeoutMs: 100,
                sleepImpl: async (ms) => { uploadFailureSleeps.push(ms); },
                fetchImpl: async (url, options) => {
                    uploadFailureCalls.push({ url, options });
                    return uploadFailureCalls.length % 2 === 1
                        ? fakeResponse(200, { url: SIGNED_URL })
                        : fakeResponse(500, { secret: COOKIE });
                }
            });
        } catch (error) {
            uploadFailureCode = error.code;
        }
        const retryAttempts = api.NETLIFY_RETRY_ATTEMPTS;
        ok('upload ធ្លាក់ ➜ សារមិនកុហក',
            uploadFailureCode === 'NETLIFY_BLOB_UPLOAD_FAILED', uploadFailureCode);
        ok('⛔ ការព្យាយាមឡើងវិញមានពិដានពិត (មិនរង្វិលជុំគ្មានទីបញ្ចប់)',
            typeof retryAttempts === 'number' && retryAttempts >= 2 && retryAttempts <= 4
            && uploadFailureCalls.length === 2 * retryAttempts
            && uploadFailureSleeps.length === retryAttempts - 1,
            uploadFailureCalls.length + '/' + retryAttempts + '/' + uploadFailureSleeps.length);

        // ⛔ ការធ្លាក់ត្រូវរាយ **ជាឈ្មោះ** មិនត្រូវបញ្ឈប់ checker ទាំងមូល
        //   (បើអត់ tree មុនកែបង្ហាញ «checker បោះកំហុស» ជំនួសការធ្លាក់ដែលមានឈ្មោះ)។
        const flakyCalls = [];
        const flakySleeps = [];
        let flakyCode = '';
        try {
            await api.syncNetlifyCookie(COOKIE, {
                siteId: SITE_ID,
                token: TOKEN,
                timeoutMs: 100,
                sleepImpl: async (ms) => { flakySleeps.push(ms); },
                fetchImpl: async (url, options) => {
                    flakyCalls.push({ url, options });
                    if (flakyCalls.length === 1) return fakeResponse(503, {});
                    if (flakyCalls.length === 2) return fakeResponse(200, { url: SIGNED_URL });
                    return fakeResponse(200, {});
                }
            });
        } catch (error) {
            flakyCode = error && error.code;
        }
        ok('⛔ Netlify ឆ្លើយ 503 មួយភ្លែត ➜ ព្យាយាមឡើងវិញ ហើយ upload ជោគជ័យ',
            !flakyCode && flakyCalls.length === 3 && flakySleeps.length === 1,
            (flakyCode || 'ok') + '/' + flakyCalls.length + '/' + flakySleeps.length);
        ok('⛔ ការព្យាយាមឡើងវិញត្រូវស្នើ signed URL **ថ្មី** (URL ចាស់អាចផុត)',
            !!(flakyCalls[1] && flakyCalls[1].url === BLOB_URL
                && flakyCalls[2] && flakyCalls[2].url === SIGNED_URL),
            flakyCalls.map((call) => call.url).join(' | '));

        const authFailCalls = [];
        let authFailCode = '';
        try {
            await api.syncNetlifyCookie(COOKIE, {
                siteId: SITE_ID,
                token: TOKEN,
                timeoutMs: 100,
                sleepImpl: async () => {},
                fetchImpl: async (url, options) => {
                    authFailCalls.push({ url, options });
                    return fakeResponse(401, {});
                }
            });
        } catch (error) {
            authFailCode = error.code;
        }
        ok('⛔ ទិសផ្ទុយ ៖ 401 (PAT ខុស/ផុត) ➜ **មិនព្យាយាមឡើងវិញ**',
            authFailCode === 'NETLIFY_BLOB_URL_FAILED' && authFailCalls.length === 1,
            authFailCode + '/' + authFailCalls.length);

        const started = Date.now();
        let timeoutCode = '';
        let timeoutError = null;
        try {
            await api.timedFetch('https://api.netlify.com/api/v1/sites/test', { method: 'GET' }, {
                fetchImpl: () => new Promise(() => {}),
                timeoutMs: 20
            });
        } catch (error) {
            timeoutCode = error.code;
            timeoutError = error;
        }
        const elapsed = Date.now() - started;
        ok('fetch មិន settle ក៏ timer បញ្ចប់បាន',
            timeoutCode === 'NETLIFY_TIMEOUT' && elapsed < 500,
            timeoutCode + '/' + elapsed + 'ms');
        ok('⛔ timeout ត្រូវសម្គាល់ជា **បណ្តោះអាសន្ន** ➜ ការព្យាយាមឡើងវិញចាប់វាបាន',
            timeoutError && timeoutError.transient === true, timeoutError && timeoutError.transient);

        let networkCode = '';
        try {
            await api.timedFetch('https://api.netlify.com/api/v1/sites/test', {}, {
                fetchImpl: async () => { throw new Error(TOKEN + COOKIE); },
                timeoutMs: 100
            });
        } catch (error) {
            networkCode = error.code + ':' + error.message;
        }
        ok('network error ត្រូវ generic មិនយក secret ពី Error',
            networkCode === 'NETLIFY_NETWORK:NETLIFY_NETWORK', networkCode);
    } else {
        for (let i = 0; i < 12; i++) ok('Netlify API behavior #' + (i + 1), false);
    }

    console.log('\n=== ៦គ. ការផ្ទៀងផ្ទាត់ត្រូវប្រាប់មូលហេតុពិត (វាស់ 2026-09-02) ===');
    // 🔴 របាយការណ៍អ្នកប្រើ ៖ «⚠️ Function នៅមិនទាន់ឃើញ Cookie ថ្មី (រង់ចាំ ១៥ ដង)»
    // ក្រោយការសរសេរ **ជោគជ័យ**។ `resolveCookieCredential()` ចេញភ្លាមពេលមាន
    // ZTO_AUTHORIZATION/ZTO_TOKEN ➜ **មិនប៉ះ store សោះ** ➜ ការរង់ចាំ ៧៥ វិ.
    // គឺជាការរង់ចាំរឿងដែល **មិនអាចកើតឡើងបាន**។ ហើយ `diagnosticsCookie()`
    // បោះចោល `storeReason` និង `auth` — ២ វាលដែលពន្យល់មូលហេតុ។
    if (api) {
        // ⛔ កុំបញ្ឈប់ checker ពេលរកឈ្មោះមិនឃើញ — stub រួចរាយជាការធ្លាក់ដែលមានឈ្មោះ
        const hasDiag = typeof api.diagnosticsCookie === 'function';
        const diagInfo = hasDiag ? api.diagnosticsCookie({
            auth: 'token',
            cookie: { source: 'none', fingerprint: null, storeReason: 'unavailable' }
        }) : {};
        ok('export `diagnosticsCookie` ដើម្បីវាស់បាន', hasDiag);
        ok('diagnosticsCookie រក្សាវាល `storeReason`',
            diagInfo.storeReason === 'unavailable', JSON.stringify(diagInfo));
        ok('diagnosticsCookie រក្សាវាល `auth`',
            diagInfo.auth === 'token', JSON.stringify(diagInfo));

        const call = (payload, opts) => api.verifyCookieLive(COOKIE, Object.assign({
            siteUrl: SITE_URL,
            proxyKey: PROXY_KEY,
            gapMs: 1,
            deadlineMs: 200,
            sleepImpl: () => Promise.resolve(),
            fetchImpl: async () => fakeResponse(200, payload)
        }, opts || {}));

        // ⛔ ផ្លូវ token/authorization ➜ store មិនដែលត្រូវអាន ➜ ឈប់ភ្លាម
        const overridden = await call({
            ok: true, auth: 'token',
            cookie: { source: 'none', fingerprint: null, storeReason: null }
        });
        ok('⛔ ZTO_TOKEN/AUTHORIZATION ➜ ឈប់ភ្លាម មិនរង់ចាំ ១៥ ដង',
            overridden.status === 'auth-override' && overridden.attempts === 1,
            JSON.stringify(overridden));

        // ⛔ ទិសផ្ទុយ ៖ ការផ្សព្វផ្សាយពិត ➜ នៅតែព្យាយាមឡើងវិញដដែល
        const propagating = await call({
            ok: true, auth: 'cookie',
            cookie: { source: 'blob', fingerprint: 'deadbeef', storeReason: null }
        });
        ok('⛔ blob ដែលកំពុងផ្សព្វផ្សាយ ➜ នៅតែព្យាយាមឡើងវិញ',
            propagating.status === 'mismatch' && propagating.attempts > 1,
            JSON.stringify(propagating));

        // ការត្រូវគ្នាពិតនៅតែជោគជ័យដដែល
        const wanted = api.cookieFingerprint(api.validateCookieHeader(COOKIE));
        const matched = await call({
            ok: true, auth: 'cookie',
            cookie: { source: 'blob', fingerprint: wanted, storeReason: null }
        });
        ok('⛔ ទិសផ្ទុយ ៖ fingerprint ត្រូវគ្នា ➜ match ដដែល',
            matched.status === 'match' && matched.source === 'blob',
            JSON.stringify(matched));

        // លទ្ធផលត្រូវផ្ទុកអ្វីដែលឃើញ ដើម្បីឲ្យសារប្រាប់ការពិតបាន
        const envSeen = await call({
            ok: true, auth: 'cookie',
            cookie: { source: 'env', fingerprint: 'aabbccdd', storeReason: 'unavailable' }
        });
        ok('លទ្ធផលផ្ទុក source ដែលឃើញពិត',
            envSeen.source === 'env', JSON.stringify(envSeen));
        ok('លទ្ធផលផ្ទុក storeReason ដែលឃើញពិត',
            envSeen.storeReason === 'unavailable', JSON.stringify(envSeen));
    } else {
        for (let i = 0; i < 8; i++) ok('ការផ្ទៀងផ្ទាត់ #' + (i + 1), false, 'គ្មាន api');
    }

    console.log('\n=== ៧ខ. jar ពិតរបស់ Argus មិនត្រូវសម្លាប់ការចាប់ (វាស់ 2026-09-02) ===');
    // 🔴 វាស់បាន ៖ cookie **តែមួយ** ដែលមិនពាក់ព័ន្ធ (analytics តម្លៃមានចន្លោះ ·
    // flag គ្មាន `=` · jar លើស ៦៤ គូ) ធ្វើឲ្យ `validateCookieHeader()` បោះ ➜
    // `waitForOrderCookie()` **finish(error)** ➜ helper ស្លាប់ទាំងស្រុង ខណៈ
    // `BOS-MAN-SESSION` នៅទីនោះត្រឹមត្រូវ។ អ្នកប្រើឃើញ «Cookie ខូចទម្រង់»
    // ដែល **គាត់កែមិនបាន** ព្រោះ cookie នោះមិនមែនរបស់គាត់។
    const SESSION = 'BOS-MAN-SESSION=abcdef1234567890';
    if (api) {
        const keepsSession = (jar) => {
            try { return api.validateCookieHeader(jar); } catch (e) { return 'THROW:' + e.code; }
        };
        const spaced = keepsSession(SESSION + '; _ga_ref=Mozilla 5.0');
        ok('cookie តម្លៃមានចន្លោះ ➜ រំលងគូនោះ តែរក្សា session',
            spaced.indexOf(SESSION) === 0 && spaced.indexOf('_ga_ref') === -1, spaced);
        const flag = keepsSession(SESSION + '; justaflag');
        ok('cookie គ្មាន `=` ➜ រំលងគូនោះ តែរក្សា session',
            flag.indexOf(SESSION) === 0 && flag.indexOf('justaflag') === -1, flag);
        const big = keepsSession(SESSION + '; ' + Array.from({ length: 80 },
            (_, i) => 'c' + i + '=v').join('; '));
        ok('jar លើសពិដានគូ ➜ កាត់ត្រឹមពិដាន តែរក្សា session',
            typeof big === 'string' && big.indexOf(SESSION) === 0
            && big.split(';').length <= 64, String(big).slice(0, 60));

        // ⛔ ទិសផ្ទុយ ៖ ការការពារពិតត្រូវនៅដដែល
        ok('⛔ CR/LF ➜ បដិសេធទាំងស្រុង (header injection)',
            keepsSession(SESSION + '; x=a\r\nSet-Cookie: evil=1') === 'THROW:COOKIE_CONTROL_CHAR');
        ok('⛔ គ្មាន BOS-MAN-SESSION ➜ បដិសេធដដែល',
            keepsSession('sidebarStatus=0; other=1') === 'THROW:COOKIE_SESSION_MISSING');
        ok('⛔ BOS-MAN-SESSION ខ្លីពេក ➜ បដិសេធដដែល',
            keepsSession('BOS-MAN-SESSION=abc; sidebarStatus=0') === 'THROW:COOKIE_SESSION_MISSING');
        ok('⛔ session ខ្លួនវាតម្លៃខូច ➜ បដិសេធ មិនមែនរំលង',
            keepsSession('BOS-MAN-SESSION=has space here; sidebarStatus=0')
            === 'THROW:COOKIE_SESSION_MISSING');

        // ⛔ ទម្រង់ពិតរបស់ Argus (បញ្ជាក់ដោយអ្នកប្រើ 2026-09-02) ៖ តម្លៃជា
        // **base64 នៃ UUID** ➜ ៤៨ តួ អក្សរ+លេខ (និងអាចមាន `=` ជា padding)។
        // ⛔ តម្លៃខាងក្រោមជាតម្លៃ **ក្លែង** ដែលមានរចនាសម្ព័ន្ធដូចគ្នា។
        const REAL_SHAPE = 'BOS-MAN-SESSION='
            + Buffer.from('11111111-2222-4333-8444-555555555555').toString('base64');
        const realJar = keepsSession(REAL_SHAPE + '; sidebarStatus=0; lang=en_US');
        ok('ទម្រង់ពិត (base64 UUID) ➜ ទទួល និងរក្សា byte ដដែល',
            realJar.indexOf(REAL_SHAPE) === 0, realJar);
        const padded = 'BOS-MAN-SESSION=' + Buffer.from('abcdefgh').toString('base64');
        ok('⛔ base64 padding `=` ក្នុងតម្លៃ ➜ ទទួល (កុំកាត់ចោល)',
            keepsSession(padded + '; x=1').indexOf(padded) === 0, keepsSession(padded + '; x=1'));

        const ctx2 = new EventEmitter();
        const waiting2 = api.waitForOrderCookie(ctx2, 400);
        ctx2.emit('request', {
            url: () => 'https://aargus-api.ztoglobal.com/scan/get/order/detail',
            allHeaders: async () => ({ cookie: SESSION + '; _ga_ref=Mozilla 5.0' })
        });
        let captured;
        try { captured = await waiting2; } catch (e) { captured = 'THROW:' + e.code; }
        ok('⛔ jar ចម្លែក ➜ capture នៅតែជោគជ័យ មិនស្លាប់',
            captured === SESSION, captured);
    } else {
        for (let i = 0; i < 8; i++) ok('jar behavior #' + (i + 1), false, 'គ្មាន api');
    }

    console.log('\n=== ៨. ផ្លូវ setup ត្រូវរត់ឡើងវិញបាន (កំហុស --auto 2026-09-02) ===');
    // 🔴 អ្នកប្រើដាក់ Site ID + PAT រួច តែ schedule-zto-cookie.cmd នៅតែធ្លាក់
    // ដោយ «--auto needs the ZoeW Site URL and ZTO_PROXY_KEY»។ មូលហេតុ ៣ ៖
    //   ក. prompt សោ Proxy លាក់ក្រោយ Site URL ➜ អ្នកដែលចុច Enter រំលង Site URL
    //      មិនដែលឃើញ prompt ទី ២ សោះ តែសារកំហុសនិយាយថា «both optional prompts»។
    //   ខ. សោដែលខ្លីជាងពិដាន ត្រូវទម្លាក់ **ស្ងាត់** ➜ អ្នកប្រើវាយរួច តែនៅតែធ្លាក់។
    //   គ. ការបំពេញ ២ តម្លៃនោះទាមទាររត់ setup.cmd ទាំងមូល ➜ ត្រូវវាយ PAT ថ្មី
    //      ខណៈ Netlify បង្ហាញ PAT **តែម្តងគត់** ➜ ផ្លូវងាប់ពិត។
    const cfgHasReuse = /existingSiteId|\$existing/.test(configure);
    ok('configure.ps1 អាចរត់ឡើងវិញដោយរក្សា Site ID ចាស់ (Enter ➜ រក្សា)',
        cfgHasReuse && /keepToken|KeepExisting|existingToken/i.test(configure),
        configure.length);
    ok('⛔ configure.ps1 មិនបង្ខំវាយ PAT ថ្មីពេលមាន token រួច',
        /netlify-token\.dpapi/.test(configure)
        && /Test-Path[^\r\n]*tokenPath|\$hasToken/.test(configure),
        'PAT ត្រូវរក្សាបាន — Netlify បង្ហាញវាតែម្តងគត់');
    ok('⛔ សោ Proxy ខ្លីពេក ត្រូវប្រាប់អ្នកប្រើ មិនមែនទម្លាក់ស្ងាត់',
        /PROXY_KEY_MIN|សោ Proxy ខ្លីពេក|ខ្លីជាង/.test(configure), configure.length);
    ok('⛔ Site URL ទទេ ➜ លុប proxy-key.dpapi ចាស់ចោល (កុំទុកសោកំព្រា)',
        /Remove-Item[^\r\n]*proxyKeyPath|Remove-Item[^\r\n]*\$proxyKeyPath/.test(configure),
        'សោកំព្រា ➜ schedule ជោគជ័យ តែ --auto ងាប់ស្ងាត់រាល់ការចូល Windows');

    if (api && typeof api.autoReadiness === 'function') {
        const ready = api.autoReadiness({ siteUrl: SITE_URL, proxyKey: PROXY_KEY });
        ok('autoReadiness ៖ គ្រប់គ្រាន់ ➜ ready', ready && ready.ready === true, JSON.stringify(ready));
        const noUrl = api.autoReadiness({ siteUrl: '', proxyKey: PROXY_KEY });
        ok('⛔ autoReadiness ដាក់ឈ្មោះអ្វីដែលខ្វះ ៖ Site URL',
            noUrl && noUrl.ready === false && noUrl.missing.indexOf('siteUrl') !== -1,
            JSON.stringify(noUrl));
        const noKey = api.autoReadiness({ siteUrl: SITE_URL, proxyKey: '' });
        ok('⛔ autoReadiness ដាក់ឈ្មោះអ្វីដែលខ្វះ ៖ ZTO_PROXY_KEY',
            noKey && noKey.ready === false && noKey.missing.indexOf('proxyKey') !== -1,
            JSON.stringify(noKey));
        const neither = api.autoReadiness({ siteUrl: '', proxyKey: '' });
        ok('⛔ ខ្វះទាំង ២ ➜ រាយទាំង ២ (សារកុំកុហកថាខ្វះតែមួយ)',
            neither && neither.missing.length === 2, JSON.stringify(neither));
    } else {
        for (let i = 0; i < 4; i++) ok('autoReadiness #' + (i + 1), false, 'មិន export');
    }

    ok('schedule-zto-cookie.cmd ពិនិត្យតាម --auto-ready មិនមែនតាមវត្តមានឯកសារ',
        /--auto-ready/.test(schedule), schedule.length);
    ok('⛔ sync-zto-cookie.js គាំទ្រ --auto-ready',
        /--auto-ready/.test(source), 'ច្រកទ្វារត្រូវវាស់តម្លៃពិត មិនមែនវត្តមានឯកសារ');


    console.log('\n=== ៩. ការចុះឈ្មោះ Task ៖ per-user មិនមែនសកល (Access is denied 2026-09-05) ===');
    // 🔴 **របាយការណ៍អ្នកប្រើពិត (2026-09-05, រូបថតអេក្រង់)** ៖ `--auto-ready`
    // ចេញ OK រួច តែ `schtasks /Create` ធ្លាក់ភ្លាមដោយ «ERROR: Access is denied».
    // មូលហេតុ ៖ `/SC ONLOGON` **គ្មាន `/RU`** ចុះឈ្មោះ trigger សម្រាប់អ្នកប្រើ
    // **គ្រប់រូប** ➜ Windows ទាមទារ Administrator។ ⛔ ឧបករណ៍នេះរត់ជា **អ្នកប្រើ
    // ធម្មតា** ដោយចេតនា (DPAPI/CurrentUser + profile របស់ browser ជារបស់គាត់)
    // ➜ ការចុះឈ្មោះត្រូវជា **per-user** ជានិច្ច។
    ok('⛔ ការចុះឈ្មោះ Task ដាក់ឈ្មោះម្ចាស់ជាក់លាក់ (per-user)',
        /-UserId/.test(schedulePs) && /New-ScheduledTaskPrincipal/.test(schedulePs),
        'គ្មាន principal ➜ logon សកល ➜ Access is denied លើ Windows ធម្មតា');
    ok('⛔ ប្រើ InteractiveToken ➜ គ្មានការសុំពាក្យសម្ងាត់ និងគ្មាន credential ស្តុក',
        /Interactive/.test(schedulePs),
        'LogonType ផ្សេង ➜ schtasks/PowerShell សុំ password ➜ ផ្លូវងាប់');
    ok('⛔ សិទ្ធិត្រូវនៅ Limited (កុំសុំ elevation ដែលមិនចាំបាច់)',
        /Limited/.test(schedulePs), schedulePs.length);

    // ⛔ ចំណុចស្នូលនៃសំណើ ៖ ONLOGON តែម្យ៉ាង មានន័យថា Cookie ដែលស្លាប់ម៉ោង
    // ១០ ព្រឹក រង់ចាំដល់ការ restart បន្ទាប់។ ត្រូវមាន trigger ដដែលៗក្នុងថ្ងៃ។
    ok('⛔ មាន trigger ដដែលៗ បន្ថែមលើ logon (ONLOGON តែម្យ៉ាង ➜ រង់ចាំ restart)',
        /RepetitionInterval/.test(schedulePs) && /AtLogOn/.test(schedulePs),
        'ខ្វះមួយណាក៏ដោយ ➜ ការជួសជុលខ្លួនឯងមិនកើតឡើងក្នុងម៉ោងធ្វើការ');
    ok('⛔ បង្អួចដដែលៗមានទាំង ចន្លោះពេល និង រយៈពេល (កុំរត់ ២៤ ម៉ោង)',
        /RepetitionDuration/.test(schedulePs), schedulePs.length);
    // ⛔ ការអះអាងដើមខ្សោយ ៖ `/--auto/` ឆ្លងបានទោះជា `--auto-ready` ក៏ដោយ។
    // អ្វីដែលត្រូវវាស់គឺ **អាគុយម៉ង់របស់ Action** ៖ Task ត្រូវរត់ `--auto`
    // លើ `sync-zto-cookie.cmd` — ផ្លូវធម្មតាបើក browser រាល់ជុំស្ទង់។
    const actionArg = /ArgumentList[^\r\n]*'--auto'/.test(schedulePs)
        || /-Argument[^\r\n]*--auto(?!-ready)/.test(schedulePs);
    ok('⛔ Action របស់ Task រត់ --auto លើ sync-zto-cookie.cmd',
        actionArg && /sync-zto-cookie\.cmd/.test(schedulePs),
        'ផ្លូវធម្មតា ➜ browser លោតឡើងរាល់ជុំស្ទង់');
    // ⛔ ការចាប់ Cookie ថ្មីអាចយូរដល់ ១០ នាទី ខណៈនាឡិកា ៣០ នាទីនៅតែដើរ ➜
    // គ្មានច្រកទ្វារ ➜ browser ជាន់គ្នាច្រើនផ្ទាំង។
    ok('⛔ ការរត់ជាន់គ្នាត្រូវទប់ (browser មិនត្រូវបើកជាន់គ្នា)',
        /MultipleInstances/.test(schedulePs) && /IgnoreNew/.test(schedulePs),
        schedulePs.length);
    ok('⛔ មានផ្លូវលុប Task វិញ', /Unregister-ScheduledTask/.test(schedulePs), schedulePs.length);
    // ⛔ ការចុះឈ្មោះម៉ោង ១៥:០០ ខណៈបង្អួចចាប់ផ្តើម ០៦:០០ ➜ trigger ប្រចាំថ្ងៃ
    // បន្ទាប់គឺ **ថ្ងៃស្អែក** ➜ ការស្ទង់មិនចាប់ផ្តើមសោះក្នុងថ្ងៃដំឡើង។
    // ការចាប់ផ្តើម Task ១ ដងភ្លាម បិទចន្លោះនោះ **និង** បញ្ជាក់ថា Task ដើរពិត។
    ok('⛔ ចាប់ផ្តើម Task ១ ដងភ្លាមក្រោយចុះឈ្មោះ (កុំរង់ចាំដល់ថ្ងៃស្អែក)',
        /Start-ScheduledTask/.test(schedulePs),
        'ដំឡើងរសៀល ➜ បង្អួចថ្ងៃនេះកន្លងផុត ➜ គ្មានការស្ទង់រហូតដល់ស្អែក');

    // ⛔ **សំណើអ្នកប្រើ (2026-09-05)** ៖ *«ធ្វើអោយដឹងថា cookie អស់សុពលភាព
    // ភ្លាម វា sync ភ្លាមហ្មងទៅ»*។ សាលក្រម «ស្លាប់» កើតឡើងភ្លាមនៅខាង
    // Function (`noteCookieRejected()`) — ការពន្យារទាំងអស់គឺ **ចន្លោះពេល
    // ស្ទង់** ។ ៣០ នាទី ➜ ការស្កេនធ្លាក់រហូតដល់ ៣០ នាទី; ១ នាទី ➜ បាត់តែ
    // ការស្កេនដំបូង។ ⛔ លេខត្រូវអានចេញពីកូដពិត មិនមែនចាក់ literal ក្នុង checker។
    const intervalDefault = (/\[int\]\$IntervalMinutes\s*=\s*(\d+)/.exec(schedulePs) || [])[1];
    const windowDefault = (/\[int\]\$WindowHours\s*=\s*(\d+)/.exec(schedulePs) || [])[1];
    ok('⛔ ចន្លោះស្ទង់លំនាំដើម <= ១ នាទី (ដឹងភ្លាម ➜ sync ភ្លាម)',
        !!intervalDefault && Number(intervalDefault) <= 1, String(intervalDefault));
    ok('⛔ បង្អួចលំនាំដើមគ្របម៉ោងធ្វើការ (>= ១២ ម៉ោង)',
        !!windowDefault && Number(windowDefault) >= 12, String(windowDefault));
    // ⛔ ការស្ទង់រាល់នាទីមិនត្រូវបង្ខំអាន Blobs រាល់ជុំ ៖ សាលក្រម «ស្លាប់»
    // មកពី `authRejectedAgeMs` ដែលជាស្ថានភាព **ក្នុងសតិ** របស់ Function ➜
    // `fresh=1` មិនធ្វើឲ្យវាឆាប់ដឹងជាងទេ តែវាបន្ថែមការអាន Blobs ១,៤៤០ ដង/ថ្ងៃ។
    // ⛔ **ការស្កេនតាមអក្សរធ្លាក់មិនបាន** ៖ ជំនាន់ដំបូងសរសេរ
    // `/fresh:\s*false/.test(source)` ➜ mutation ដែល **ដកកូដពិតចេញ** នៅតែ
    // ឆ្លង ព្រោះខ្សែអក្សរនោះមានក្នុង **comment** ខាងលើវា (វាស់បាន ៖
    // mutation ១៤ រស់រាន)។ detector ត្រូវជា **រចនាសម្ព័ន្ធ** — AST គ្មាន comment។
    let freshWired = false;
    let healthCalls = 0;
    if (acorn) {
        const tree = acorn.parse(source, { ecmaVersion: 2022, locations: true });
        (function walk(node) {
            if (!node || typeof node !== 'object') return;
            if (Array.isArray(node)) { node.forEach(walk); return; }
            if (node.type === 'CallExpression' && node.callee
                && node.callee.type === 'Identifier' && node.callee.name === 'checkCookieHealth') {
                healthCalls++;
                (function findFresh(inner) {
                    if (!inner || typeof inner !== 'object') return;
                    if (Array.isArray(inner)) { inner.forEach(findFresh); return; }
                    if (inner.type === 'Property' && inner.key
                        && (inner.key.name === 'fresh' || inner.key.value === 'fresh')
                        && inner.value && inner.value.value === false) {
                        freshWired = true;
                    }
                    for (const key of Object.keys(inner)) {
                        if (key === 'type' || key === 'loc' || key === 'start' || key === 'end') continue;
                        findFresh(inner[key]);
                    }
                })(node.arguments);
            }
            for (const key of Object.keys(node)) {
                if (key === 'type' || key === 'loc' || key === 'start' || key === 'end') continue;
                walk(node[key]);
            }
        })(tree);
    }
    ok('ជាន់អប្បបរមា ៖ ឃើញការហៅ checkCookieHealth ពិត', healthCalls >= 2, healthCalls);
    ok('⛔ ការស្ទង់ --auto មិនបង្ខំអាន Blobs (`fresh: false` ក្នុង AST មិនមែន comment)',
        acorn && freshWired, 'ការស្ទង់រាល់នាទីដោយ fresh=1 = ការអាន Blobs ១,៤៤០ ដង/ថ្ងៃ');
    if (api && typeof api.checkCookieHealth === 'function') {
        const freshCalls = [];
        await api.checkCookieHealth({
            siteUrl: SITE_URL, proxyKey: PROXY_KEY, fresh: false,
            fetchImpl: async (url) => {
                freshCalls.push(url);
                return fakeResponse(200, { ok: true, auth: 'cookie', cookie: { source: 'blob', fingerprint: 'aaaabbbb', renewals: 0, authRejectedAgeMs: null } });
            }
        });
        ok('⛔ `fresh: false` ➜ URL គ្មាន fresh=1 ពិត (មិនមែនត្រឹមអក្សរក្នុងកូដ)',
            freshCalls.length === 1 && freshCalls[0].indexOf('fresh=1') === -1,
            freshCalls[0]);
    } else {
        ok('⛔ `fresh: false` ➜ URL គ្មាន fresh=1 ពិត', false, 'មិន export');
    }

    // ⛔ ការធ្លាក់ត្រូវ **ដាក់ឈ្មោះដំណោះស្រាយ** — «could not be created» ទទេ
    // ជាអ្វីដែលអ្នកប្រើកែមិនបាន (វាស់រួច ៖ រូបថតអេក្រង់ 2026-09-05)។
    ok('⛔ ការធ្លាក់ប្រាប់មូលហេតុពិត មិនមែន «could not be created» ទទេ',
        /Administrator/i.test(schedulePs) && /already exists|existing/i.test(schedulePs),
        'អ្នកប្រើត្រូវដឹងថា ៖ Task ចាស់របស់ admin ជាប់ ឬត្រូវលុបវាចោល');
    ok('schedule-zto-cookie.cmd នៅជា ASCII + CRLF ហើយហៅ --auto-ready មុនចុះឈ្មោះ',
        isWindowsCmdSafe(schedule) && /--auto-ready/.test(schedule), schedule.length);

    console.log('\n=== ១០. ការជូនដំណឹង Telegram ៖ outbound · fail-open · មិនលេចសម្ងាត់ ===');
    // ⛔ ការជូនដំណឹងជា **ការរាយការណ៍** មិនមែនផ្លូវអាជីវកម្ម ➜ ការធ្លាក់របស់វា
    // មិនត្រូវធ្វើឲ្យការ sync ធ្លាក់ឡើយ (fail-open ពេញលេញ)។ ហើយវាត្រូវ
    // **outbound ប៉ុណ្ណោះ** — គ្មានការទទួលពាក្យបញ្ជា ➜ គ្មានផ្លូវ RCE ចូល
    // ម៉ាស៊ីនដែលកាន់ Netlify PAT។
    const notifyApi = api && typeof api.autoNotifyKind === 'function'
        && typeof api.notifyThrottleAllows === 'function'
        && typeof api.telegramMessage === 'function'
        && typeof api.sendTelegram === 'function'
        && typeof api.validateChatId === 'function';
    ok('export helper ជូនដំណឹងសម្រាប់វាស់ឥរិយាបថ', notifyApi);

    if (notifyApi) {
        // ⛔ ជាន់សំខាន់បំផុត ៖ សុខភាពល្អ ➜ **ស្ងាត់**។ ការរត់រាល់ ១ នាទី
        // ក្នុង ១៦ ម៉ោង = ៩៦០ ជុំ/ថ្ងៃ ➜ សារ «គ្រប់យ៉ាងល្អ» រាប់រយដង ធ្វើឲ្យ
        // អ្នកប្រើបិទការជូនដំណឹង ➜ សារពិតលេចបាត់។
        ok('⛔ Cookie ដំណើរការល្អ ➜ មិនផ្ញើសារសោះ',
            api.autoNotifyKind({ status: 'ok', healthy: true }, { ok: true }) === '',
            api.autoNotifyKind({ status: 'ok', healthy: true }, { ok: true }));
        ok('Cookie ស្លាប់ ➜ យកថ្មីមិនបាន ➜ ត្រូវការមនុស្ស',
            api.autoNotifyKind({ status: 'ok', healthy: false },
                { ok: false, code: 'CAPTURE_TIMEOUT' }) === 'needs-human');
        ok('Cookie ស្លាប់ ➜ យកថ្មីបានដោយខ្លួនឯង ➜ រាយការណ៍ថាជួសជុលរួច',
            api.autoNotifyKind({ status: 'ok', healthy: false }, { ok: true }) === 'repaired');
        ok('⛔ ភ្ជាប់ Function មិនបាន ➜ រាយការណ៍ (បើអត់ ➜ ងាប់ស្ងាត់ជាច្រើនថ្ងៃ)',
            api.autoNotifyKind({ status: 'unreachable', healthy: false }, null) === 'blocked');
        ok('⛔ មិនទាន់កំណត់ ➜ រាយការណ៍ដែរ',
            api.autoNotifyKind({ status: 'unconfigured', healthy: false }, null) === 'blocked');

        // ⛔ សារមិនត្រូវផ្ទុក Cookie ៖ Telegram ជា server របស់អ្នកដទៃ ហើយ
        // ប្រវត្តិ chat រស់នៅជារៀងរហូត។ Cookie បង្ហាញលើ cmd បាន (សំណើអ្នកប្រើ)
        // តែ **មិនត្រូវចេញក្រៅម៉ាស៊ីន**។
        const messages = ['needs-human', 'repaired', 'blocked']
            .map((kind) => api.telegramMessage(kind, { cookie: COOKIE, proxyKey: PROXY_KEY }));
        ok('⛔ សារ Telegram មិនផ្ទុក Cookie ដាច់ខាត',
            messages.every((text) => text.indexOf('BOS-MAN-SESSION') === -1
                && text.indexOf('s3cr3t987') === -1),
            messages.join(' | ').slice(0, 160));
        ok('⛔ សារ Telegram មិនផ្ទុកសោណាមួយ',
            messages.every((text) => text.indexOf(PROXY_KEY) === -1
                && text.indexOf(TOKEN) === -1));
        ok('សារនីមួយៗមានអត្ថន័យខុសគ្នា និងមិនទទេ',
            new Set(messages).size === 3 && messages.every((text) => text.length > 12));

        ok('chat id ត្រឹមត្រូវ ➜ ទទួល', api.validateChatId('123456789') === '123456789');
        ok('chat id ក្រុម (អវិជ្ជមាន) ➜ ទទួល', api.validateChatId('-1001234567890') === '-1001234567890');
        ok('⛔ chat id ខូច ➜ បដិសេធ', (() => {
            try { api.validateChatId('abc; rm -rf'); return false; } catch (e) { return e.code === 'TELEGRAM_CHAT_INVALID'; }
        })());

        // ⛔ ពិដានល្បឿន ៖ Netlify ដាច់ពេញថ្ងៃ ➜ ២៦ សារដដែល។ តែពិដានដែល
        // **ខូចហើយស្ងាត់** អាក្រក់ជាង ➜ state អានមិនបាន ត្រូវ **ផ្ញើ**។
        const now = 1000000000000;
        ok('ជុំដំបូង ➜ ផ្ញើ', api.notifyThrottleAllows({}, 'needs-human', now, 3600000) === true);
        ok('⛔ ជុំទី ២ ក្នុងចន្លោះពេល ➜ មិនផ្ញើ',
            api.notifyThrottleAllows({ 'needs-human': now - 60000 }, 'needs-human', now, 3600000) === false);
        ok('ផុតចន្លោះពេល ➜ ផ្ញើឡើងវិញ',
            api.notifyThrottleAllows({ 'needs-human': now - 7200000 }, 'needs-human', now, 3600000) === true);
        ok('⛔ ប្រភេទសារផ្សេង ➜ ពិដានឯករាជ្យ',
            api.notifyThrottleAllows({ blocked: now - 60000 }, 'needs-human', now, 3600000) === true);
        ok('⛔ state ខូច/អានមិនបាន ➜ នៅតែផ្ញើ (ពិដានដែលងាប់ = គ្មានការជូនដំណឹង)',
            api.notifyThrottleAllows(null, 'needs-human', now, 3600000) === true
            && api.notifyThrottleAllows('not-an-object', 'needs-human', now, 3600000) === true);
        ok('⛔ ត្រាពេលអនាគត (នាឡិកាថយក្រោយ) ➜ ផ្ញើ មិនស្ងាត់ជារៀងរហូត',
            api.notifyThrottleAllows({ 'needs-human': now + 99999999 }, 'needs-human', now, 3600000) === true);

        // ⛔ fail-open ៖ Telegram ធ្លាក់ · ព្យួរ · គ្មានបណ្តាញ ➜ helper ត្រឡប់
        // សាលក្រម មិនដែល reject ➜ ការ sync នៅតែបន្ត។
        // ⛔ helper នេះសន្យាថា **មិនដែល reject** ➜ ការហៅវាទទេធ្វើឲ្យ mutation
        // «បោះជំនួសការត្រឡប់សាលក្រម» **សម្លាប់ checker ទាំងមូល** ជំនួសការ
        // ធ្លាក់ដែលមានឈ្មោះ (វាស់រួច ៖ mutation ៧ ➜ «checker បោះកំហុស»
        // ហើយការអះអាង ៨ ខាងក្រោមមិនដែលរត់)។ ការបោះត្រូវក្លាយជា **សាលក្រម**។
        const settle = async (promise) => {
            try { return await promise; } catch (error) { return 'THREW:' + (error && error.code || 'unknown'); }
        };
        const sendCalls = [];
        const sent = await settle(api.sendTelegram('hello', {
            chatId: '123456789',
            botToken: 'bot-token-value-should-never-leak',
            fetchImpl: async (url, options) => {
                sendCalls.push({ url, options });
                return fakeResponse(200, { ok: true });
            }
        }));
        ok('ផ្ញើបានជោគជ័យ ➜ សាលក្រម sent', sent === 'sent', sent);
        ok('⛔ ផ្ញើតាម POST ហើយសារនៅក្នុង body មិនមែនក្នុង URL',
            sendCalls.length === 1 && sendCalls[0].options.method === 'POST'
            && sendCalls[0].url.indexOf('hello') === -1
            && String(sendCalls[0].options.body).indexOf('hello') !== -1,
            JSON.stringify(sendCalls[0] && sendCalls[0].url).slice(0, 120));
        const failed = await settle(api.sendTelegram('hello', {
            chatId: '123456789',
            botToken: 'bot-token-value-should-never-leak',
            fetchImpl: async () => { throw new Error('network down'); }
        }));
        ok('⛔ បណ្តាញធ្លាក់ ➜ ត្រឡប់សាលក្រម មិន reject (ការ sync មិនត្រូវធ្លាក់តាម)',
            failed === 'failed', failed);
        const skipped = await settle(api.sendTelegram('hello', {
            chatId: '', botToken: '', fetchImpl: async () => { throw new Error('must not be called'); }
        }));
        ok('⛔ មិនទាន់កំណត់ Telegram ➜ រំលងស្ងាត់ មិនធ្លាក់', skipped === 'skipped', skipped);
    } else {
        for (let i = 0; i < 20; i++) ok('notify #' + (i + 1), false, 'មិន export');
    }

    // ⛔ Bot token ជា credential ថ្នាក់ដដែលនឹង PAT ➜ DPAPI ដដែល និងមិនបង្ហាញ។
    ok('⛔ bot token អ៊ិនគ្រីបដោយ DPAPI ដូច PAT (មិនមែន plaintext)',
        /telegram-token\.dpapi/.test(source) && /telegram-token\.dpapi/.test(configure),
        'token ជាអក្សរធម្មតា ➜ អ្នកដែលអានឯកសារបាន បញ្ជា bot បាន');
    ok('⛔ chat id ទទេ ➜ លុប telegram token កំព្រាចោល',
        /Remove-Item[^\r\n]*telegramTokenPath/.test(configure),
        'token កំព្រា ➜ ការជូនដំណឹងងាប់ស្ងាត់ ខណៈមើលទៅដូចកំណត់រួច');
    ok('⛔ មានផ្លូវសាកការជូនដំណឹងដោយមិនរង់ចាំកំហុសពិត',
        /--test-telegram/.test(source) && /--test-telegram/.test(readme),
        'ការកំណត់ដែលផ្ទៀងផ្ទាត់មិនបាន ជាការកំណត់ដែលមិនទាន់ផ្ទៀងផ្ទាត់');

    console.log('\n' + (fail
        ? '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')'
        : '✅ ជោគជ័យ ' + pass));
    process.exitCode = fail ? 1 : 0;
}

run().catch((error) => {
    console.log('  FAIL   checker បោះកំហុស: ' + (error && error.code || 'unknown'));
    process.exitCode = 1;
});
