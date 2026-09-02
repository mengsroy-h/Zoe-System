// ⛔ ចាក់សោ Windows helper ដែលកាន់ credential ២ ក្នុងសតិ៖ ZTO Cookie និង
// Netlify PAT។ វាផ្ទៀងផ្ទាត់ថាឧបករណ៍ចាប់ Request Header ពិត, អ៊ិនគ្រីប PAT
// ដោយ Windows DPAPI, សរសេរ Cookie ចូល Netlify Blobs **ដោយគ្មាន redeploy**
// និង settle ពេលបណ្តាញព្យួរ។
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
const SCHEDULE_PATH = path.join(TOOL_DIR, 'schedule-zto-cookie.cmd');
const CONFIGURE_PATH = path.join(TOOL_DIR, 'configure.ps1');
const TOKEN_READER_PATH = path.join(TOOL_DIR, 'read-token.ps1');
const README_PATH = path.join(TOOL_DIR, 'README-KH.md');

const COOKIE = 'BOS-MAN-SESSION=s3cr3t987; sidebarStatus=0';
const TOKEN = 'test-only-token-for-mocked-netlify-api-0123456789';
const SITE_ID = 'zoew-site-123';
const SITE_URL = 'https://zoew.netlify.app';
const PROXY_KEY = 'proxy-key-for-tests-0123456789ab';
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
const schedule = read(SCHEDULE_PATH);
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
    ok('សរសេរ Cookie ចូល Netlify Blobs (ផ្លូវ /api/v1/blobs)',
        /'\/api\/v1\/blobs\/'/.test(source) && /BLOB_STORE_NAME = 'zto-auth'/.test(source));
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
            && diagCalls[0].url === SITE_URL + '/.netlify/functions/zto-order-detail?diag=1'
            && diagCalls[0].options.headers['X-Zoe-Proxy-Key'] === PROXY_KEY
            && diagCalls[0].options.method === 'GET',
            diagCalls[0] && diagCalls[0].url);
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
    ok('schedule-zto-cookie.cmd ប្រើ schtasks ជាមួយ --auto និងមានផ្លូវលុប',
        /schtasks/i.test(schedule) && /--auto/.test(schedule) && /\/Delete/i.test(schedule),
        schedule.length);
    ok('sync-zto-cookie.cmd បញ្ជូន argument ទៅ node',
        /node sync-zto-cookie\.js %\*/.test(runner), runner.length);
    ok('⛔ proxy key មិនត្រូវបោះពុម្ព',
        !/console\.(log|error)\([^\r\n]*(proxyKey|PROXY_KEY)/.test(source));
    ok('configure.ps1 អ៊ិនគ្រីប proxy key ដោយ DPAPI ដដែល',
        /proxy-key\.dpapi/.test(configure) && /AsSecureString/.test(configure)
        && (configure.match(/ConvertFrom-SecureString/g) || []).length >= 2,
        configure.length);

    console.log('\n=== ៧. Netlify API behavior (mock មិនប៉ះ production) ===');
    if (api) {
        const SIGNED_URL = 'https://blob-upload.netlify.test/signed-path?sig=abc123';
        const BLOB_URL = 'https://api.netlify.com/api/v1/blobs/' + SITE_ID + '/zto-auth/cookie';
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

        const uploadFailureCalls = [];
        let uploadFailureCode = '';
        try {
            await api.syncNetlifyCookie(COOKIE, {
                siteId: SITE_ID,
                token: TOKEN,
                timeoutMs: 100,
                fetchImpl: async (url, options) => {
                    uploadFailureCalls.push({ url, options });
                    if (uploadFailureCalls.length === 1) return fakeResponse(200, { url: SIGNED_URL });
                    return fakeResponse(500, { secret: COOKIE });
                }
            });
        } catch (error) {
            uploadFailureCode = error.code;
        }
        ok('upload ធ្លាក់ ➜ សារមិនកុហក',
            uploadFailureCode === 'NETLIFY_BLOB_UPLOAD_FAILED' && uploadFailureCalls.length === 2,
            uploadFailureCode);

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
