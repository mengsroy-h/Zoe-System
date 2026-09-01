// ⛔ ចាក់សោ Windows helper ដែលកាន់ credential ២ ក្នុងសតិ៖ ZTO Cookie និង
// Netlify PAT។ វាផ្ទៀងផ្ទាត់ថាឧបករណ៍ចាប់ Request Header ពិត, អ៊ិនគ្រីប PAT
// ដោយ Windows DPAPI, update env មុន trigger deploy និង settle ពេលបណ្តាញព្យួរ។
'use strict';

const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

const ROOT = process.env.ZTO_SYNC_APP_DIR
    ? path.resolve(process.env.ZTO_SYNC_APP_DIR)
    : path.resolve(__dirname, '..');
const TOOL_DIR = path.join(ROOT, 'tools', 'zto-cookie-sync-windows');
const SOURCE_PATH = path.join(TOOL_DIR, 'sync-zto-cookie.js');
const PACKAGE_PATH = path.join(TOOL_DIR, 'package.json');
const SETUP_PATH = path.join(TOOL_DIR, 'setup.cmd');
const RUN_PATH = path.join(TOOL_DIR, 'sync-zto-cookie.cmd');
const CONFIGURE_PATH = path.join(TOOL_DIR, 'configure.ps1');
const TOKEN_READER_PATH = path.join(TOOL_DIR, 'read-token.ps1');
const README_PATH = path.join(TOOL_DIR, 'README-KH.md');

const COOKIE = 'BOS-MAN-SESSION=s3cr3t987; sidebarStatus=0';
const TOKEN = 'test-only-token-for-mocked-netlify-api-0123456789';
const SITE_ID = 'zoew-site-123';
const ACCOUNT_ID = 'account-456';
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
const configure = read(CONFIGURE_PATH);
const tokenReader = read(TOKEN_READER_PATH);
const readme = read(README_PATH);
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
    ok('ឃើញ configure.ps1', configure.length > 1300, configure.length);
    ok('ឃើញ read-token.ps1', tokenReader.length > 600, tokenReader.length);
    ok('ឃើញ README-KH.md', readme.length > 3000, readme.length);
    ok('export pure helpers សម្រាប់វាស់ឥរិយាបថ',
        api && typeof api.validateCookieHeader === 'function'
        && typeof api.syncNetlifyCookie === 'function'
        && typeof api.timedFetch === 'function');

    console.log('\n=== ២. ចាប់ request ពិត — មិនត្រឡប់ទៅ extension ===');
    ok('target ត្រូវជា HTTPS API host + Order Detail path',
        api && api.isTargetApiUrl('https://aargus-api.ztoglobal.com/scan/get/order/detail'));
    ok('បដិសេធ HTTP', api && !api.isTargetApiUrl('http://aargus-api.ztoglobal.com/scan/get/order/detail'));
    ok('បដិសេធ host បន្លំ', api && !api.isTargetApiUrl('https://aargus-api.ztoglobal.com.evil.test/scan/get/order/detail'));
    ok('បដិសេធ path ផ្សេង', api && !api.isTargetApiUrl('https://aargus-api.ztoglobal.com/other'));
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
            ['គ្មាន =', 'this-is-not-a-pair', 'COOKIE_PAIR_SHAPE'],
            ['ឈ្មោះខូច', 'bad name=value', 'COOKIE_NAME_SHAPE'],
            ['តម្លៃមានចន្លោះ', 'BOS-MAN-SESSION=has space', 'COOKIE_VALUE_SHAPE'],
            ['គ្មាន session credential', 'sidebarStatus=0', 'COOKIE_SESSION_MISSING']
        ]) {
            let got = '';
            try { api.validateCookieHeader(value); } catch (error) { got = error.code; }
            ok(label + ' ➜ បដិសេធដោយមាន code', got === code, got);
        }
        const many = Array.from({ length: 65 }, (_, i) => 'k' + i + '=v').join('; ');
        let manyCode = '';
        try { api.validateCookieHeader(many); } catch (error) { manyCode = error.code; }
        ok('គូច្រើនលើស ៦៤ ➜ បដិសេធ', manyCode === 'COOKIE_TOO_MANY_PAIRS', manyCode);
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
    ok('README ពន្យល់ DPAPI/PAT និងការមិនបង្ហាញ secret',
        /DPAPI/.test(readme) && /Personal Access Token/.test(readme)
        && /មិនត្រូវបានបង្ហាញ/.test(readme));

    console.log('\n=== ៥. Netlify API និង secret boundary ===');
    ok('ប្រើ Netlify API origin ថេរ HTTPS',
        /const NETLIFY_API_ORIGIN = 'https:\/\/api\.netlify\.com'/.test(source));
    ok('site lookup ទាញ account_id មិនទាមទារឲ្យអ្នកបញ្ចូល',
        /site\.account_id/.test(source) && !/NETLIFY_ACCOUNT_ID/.test(source));
    ok('PATCH env value សម្រាប់ production',
        /method:\s*'PATCH'/.test(source)
        && /JSON\.stringify\(\{ context: 'production', value: cleanCookie \}\)/.test(source));
    ok('POST builds ដើម្បី trigger deploy',
        /method:\s*'POST'/.test(source) && /encodeURIComponent\(cleanSiteId\) \+ '\/builds'/.test(source));
    ok('redirect ត្រូវបដិសេធ ដើម្បីកុំឲ្យ Authorization ហូរទៅ host ផ្សេង',
        /redirect:\s*'error'/.test(source));
    ok('timeout settle ដោយ timer ពិត បន្ថែមលើ AbortController',
        /new Promise\(\(resolve, reject\)/.test(source)
        && /new AbortController\(\)/.test(source)
        && /finish\(codedError\('NETLIFY_TIMEOUT'\)\)/.test(source));
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

    console.log('\n=== ៧. Netlify API behavior (mock មិនប៉ះ production) ===');
    if (api) {
        const calls = [];
        const fetchImpl = async (url, options) => {
            calls.push({ url, options });
            if (calls.length === 1) return fakeResponse(200, { account_id: ACCOUNT_ID });
            return fakeResponse(201, {});
        };
        await api.syncNetlifyCookie(COOKIE, {
            siteId: SITE_ID,
            token: TOKEN,
            fetchImpl,
            timeoutMs: 100
        });

        ok('ហៅ API ៣ ដងតាមលំដាប់ site ➜ env ➜ build', calls.length === 3, calls.length);
        ok('GET site ត្រឹមត្រូវ',
            calls[0] && calls[0].options.method === 'GET'
            && calls[0].url === 'https://api.netlify.com/api/v1/sites/' + SITE_ID);
        ok('PATCH ZTO_COOKIE ត្រឹម account + site',
            calls[1] && calls[1].options.method === 'PATCH'
            && calls[1].url === 'https://api.netlify.com/api/v1/accounts/' + ACCOUNT_ID
                + '/env/ZTO_COOKIE?site_id=' + SITE_ID);
        ok('PATCH body មាន production + Cookie ពេញ',
            calls[1] && calls[1].options.body === JSON.stringify({ context: 'production', value: COOKIE }));
        ok('POST build កើតក្រោយ PATCH ជោគជ័យ និងគ្មាន body ក្លែងជា JSON',
            calls[2] && calls[2].options.method === 'POST'
            && calls[2].url === 'https://api.netlify.com/api/v1/sites/' + SITE_ID + '/builds'
            && calls[2].options.body === undefined
            && calls[2].options.headers['Content-Type'] === undefined);
        ok('គ្រប់សំណើប្រើ Bearer token និង redirect:error',
            calls.every((call) => call.options.headers.Authorization === 'Bearer ' + TOKEN
                && call.options.redirect === 'error'));
        ok('Cookie មិនចូល URL/GET/POST body',
            calls.every((call, index) => !call.url.includes(COOKIE)
                && (index === 1 || !String(call.options.body || '').includes(COOKIE))));

        const envFailureCalls = [];
        let envFailureCode = '';
        const bodyStats = {};
        try {
            await api.syncNetlifyCookie(COOKIE, {
                siteId: SITE_ID,
                token: TOKEN,
                timeoutMs: 100,
                fetchImpl: async (url, options) => {
                    envFailureCalls.push({ url, options });
                    if (envFailureCalls.length === 1) return fakeResponse(200, { account_id: ACCOUNT_ID });
                    return fakeResponse(422, { secret: COOKIE }, bodyStats);
                }
            });
        } catch (error) {
            envFailureCode = error.code;
        }
        ok('env update ធ្លាក់ ➜ មិន trigger build',
            envFailureCode === 'NETLIFY_ENV_UPDATE_FAILED' && envFailureCalls.length === 2,
            envFailureCode + '/' + envFailureCalls.length);
        ok('env error response body មិនត្រូវបានអាន',
            !bodyStats.reads && bodyStats.cancels === 1,
            JSON.stringify(bodyStats));

        const buildFailureCalls = [];
        let buildFailureCode = '';
        try {
            await api.syncNetlifyCookie(COOKIE, {
                siteId: SITE_ID,
                token: TOKEN,
                timeoutMs: 100,
                fetchImpl: async () => {
                    buildFailureCalls.push(true);
                    if (buildFailureCalls.length === 1) return fakeResponse(200, { account_id: ACCOUNT_ID });
                    if (buildFailureCalls.length === 2) return fakeResponse(201, {});
                    return fakeResponse(500, { secret: COOKIE });
                }
            });
        } catch (error) {
            buildFailureCode = error.code;
        }
        ok('env ជោគជ័យ + build ធ្លាក់ ➜ សារមិនកុហក',
            buildFailureCode === 'NETLIFY_ENV_UPDATED_BUILD_FAILED' && buildFailureCalls.length === 3,
            buildFailureCode);

        const started = Date.now();
        let timeoutCode = '';
        try {
            await api.timedFetch('https://api.netlify.com/api/v1/sites/test', { method: 'GET' }, {
                fetchImpl: () => new Promise(() => {}),
                timeoutMs: 20
            });
        } catch (error) {
            timeoutCode = error.code;
        }
        const elapsed = Date.now() - started;
        ok('fetch មិន settle ក៏ timer បញ្ចប់បាន',
            timeoutCode === 'NETLIFY_TIMEOUT' && elapsed < 500,
            timeoutCode + '/' + elapsed + 'ms');

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

    console.log('\n' + (fail
        ? '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')'
        : '✅ ជោគជ័យ ' + pass));
    process.exitCode = fail ? 1 : 0;
}

run().catch((error) => {
    console.log('  FAIL   checker បោះកំហុស: ' + (error && error.code || 'unknown'));
    process.exitCode = 1;
});
