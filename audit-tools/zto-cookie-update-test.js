// ⛔ ចាក់សោ Function `zto-cookie-update` — ផ្លូវ «ចុច ១ ដង» សម្រាប់ប្តូរ Cookie ZTO។
//
// មុខងារនេះកាន់ **credential ២ ដែលមានតម្លៃខ្ពស់** ៖ Cookie session របស់ Argus
// និង Netlify Personal Access Token។ ដូច្នេះការធ្លាក់ណាមួយក្នុងឯកសារនេះជា
// បញ្ហាសុវត្ថិភាព មិនមែនត្រឹមភាពរអាក់រអួលទេ។
//
// ថ្នាក់កំហុសដែលវាចាក់សោ៖
//   ១. **Header injection** — Cookie ដែលមាន CR/LF អាចចាក់ header បន្ថែមចូល
//      សំណើទៅ Argus។ នេះជាការអះអាងសំខាន់បំផុត។
//   ២. **ការលេច secret** — តម្លៃ Cookie មិនត្រូវលេចចេញក្នុង response ណាមួយ
//      (ច្បាប់ `secret-hygiene`)។ វាត្រូវឆ្លើយតែ **ឈ្មោះ** ប៉ុណ្ណោះ។
//   ៣. **ការព្យួរ** — Netlify API អាច «ភ្ជាប់តែស្លាប់» ➜ ការ settle ត្រូវធានា
//      ដោយរចនាសម្ព័ន្ធ (ច្បាប់ `stall-guard` 2.22.4 អនុវត្តខាង server)។
//   ៤. **ការអះអាងជោគជ័យក្លែងក្លាយ** — env សរសេរបរាជ័យ ➜ **មិនត្រូវ** trigger
//      deploy ហើយមិនត្រូវឆ្លើយ `ok: true` (ច្បាប់ `toast-truth`)។
//
// ⚠️ សេណារីយ៉ូត្រូវរត់ **តាមលំដាប់** — ពួកវាចែក `process.env` និង `global.fetch`។
// ការរត់ស្របគ្នាបង្កើត **ការធ្លាក់ក្លែងក្លាយ** (មេរៀន `zto-proxy-test.js` 2.25.0)។
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = process.env.ZTOCOOKIE_APP_DIR
    ? path.resolve(process.env.ZTOCOOKIE_APP_DIR)
    : path.resolve(__dirname, '..');

const FN_PATH = path.join(ROOT, 'ZoeW', 'netlify', 'functions', 'zto-cookie-update.js');
const LOOKUP_PATH = path.join(ROOT, 'ZoeW', 'netlify', 'functions', 'zto-order-detail.js');
const EXT_DIR = path.join(ROOT, 'tools', 'zto-cookie-grabber');

const SECRET_COOKIE = 'SESSIONID=s3cr3tVALUE9876; ZTO_INTL_BOS_MAN_TOKEN=1';
const SECRET_TOKEN = 'nfp_TOKENvalue12345';

let pass = 0;
let fail = 0;

function ok(label, cond, detail) {
    if (cond) {
        pass++;
        console.log('   ok    ' + label);
    } else {
        fail++;
        console.log('  FAIL   ' + label + (detail !== undefined ? '\n         ' + detail : ''));
    }
}

// ⛔ ជាន់អប្បបរមាត្រូវមកមុនគេ។ បើឯកសារមិនមាន (ថតទទេ ឬ `origin/main`) នោះ
// checker នេះត្រូវ **ធ្លាក់** មិនមែនចេញ exit 0 ដោយស្ងាត់ (មេរៀន `checker-coverage`)។
if (!fs.existsSync(FN_PATH)) {
    console.log('  FAIL   ជាន់អប្បបរមា៖ រកមិនឃើញ ZoeW/netlify/functions/zto-cookie-update.js');
    console.log('\n❌ ធ្លាក់ 1 (ជោគជ័យ 0) — checker នេះមិនបានឃើញកូដទេ');
    process.exit(1);
}

function loadHandler() {
    delete require.cache[require.resolve(FN_PATH)];
    return require(FN_PATH);
}

function baseEnv(extra) {
    return Object.assign({
        ZTO_COOKIE_UPDATE_KEY: 'update-me',
        NETLIFY_AUTH_TOKEN: SECRET_TOKEN,
        NETLIFY_ACCOUNT_ID: 'acct-123',
        NETLIFY_SITE_ID: 'site-abc',
        ZTO_COOKIE_API_TIMEOUT_MS: '2000',
        ZTO_COOKIE_BUDGET_MS: '8000'
    }, extra || {});
}

function withEnv(env, run) {
    const saved = {};
    const keys = Object.keys(env);
    keys.forEach((k) => { saved[k] = process.env[k]; process.env[k] = env[k]; });
    const restore = () => keys.forEach((k) => {
        if (saved[k] === undefined) delete process.env[k];
        else process.env[k] = saved[k];
    });
    return Promise.resolve().then(run).then(
        (v) => { restore(); return v; },
        (e) => { restore(); throw e; }
    );
}

function fakeResponse(status) {
    return { ok: status >= 200 && status < 300, status };
}

function stubFetch(plan) {
    const calls = [];
    global.fetch = function stubbed(url, init) {
        calls.push({ url: String(url), init: init || {} });
        return plan(String(url), init || {}, calls.length);
    };
    return calls;
}

function post(body, headers) {
    return {
        httpMethod: 'POST',
        headers: Object.assign({ origin: 'https://argus.ztoglobal.com' }, headers || {}),
        body: typeof body === 'string' ? body : JSON.stringify(body)
    };
}

function bodyOf(res) {
    try { return JSON.parse(res.body); } catch (_) { return {}; }
}

const scenarios = [];
function scenario(label, fn) {
    scenarios.push({ label, fn });
}

scenario('OPTIONS ➜ 204 ហើយឆ្លើយ CORS ដល់ Argus', async () => {
    const { handler } = loadHandler();
    const res = await handler({ httpMethod: 'OPTIONS', headers: { origin: 'https://argus.ztoglobal.com' } });
    ok('OPTIONS ➜ 204', res.statusCode === 204, 'បាន ' + res.statusCode);
    ok('OPTIONS ➜ Access-Control-Allow-Origin ជា Argus',
        res.headers['Access-Control-Allow-Origin'] === 'https://argus.ztoglobal.com');
});

scenario('origin ដែលមិនស្គាល់ ➜ គ្មាន CORS', async () => {
    const { handler } = loadHandler();
    const res = await handler({ httpMethod: 'OPTIONS', headers: { origin: 'https://evil.example.com' } });
    ok('origin ក្រៅបញ្ជី ➜ គ្មាន Access-Control-Allow-Origin',
        res.headers['Access-Control-Allow-Origin'] === undefined);
    ok('ឆ្លើយ Vary: Origin ជានិច្ច', res.headers.Vary === 'Origin');
});

scenario('GET ➜ 405', async () => {
    const { handler } = loadHandler();
    const res = await handler({ httpMethod: 'GET', headers: {} });
    ok('GET ➜ 405', res.statusCode === 405, 'បាន ' + res.statusCode);
});

scenario('គ្មាន ZTO_COOKIE_UPDATE_KEY ➜ 503', async () => {
    const saved = process.env.ZTO_COOKIE_UPDATE_KEY;
    delete process.env.ZTO_COOKIE_UPDATE_KEY;
    const { handler } = loadHandler();
    const res = await handler(post({ key: 'x', cookie: SECRET_COOKIE }));
    if (saved !== undefined) process.env.ZTO_COOKIE_UPDATE_KEY = saved;
    ok('គ្មានកូនសោ ➜ 503', res.statusCode === 503, 'បាន ' + res.statusCode);
    ok('គ្មានកូនសោ ➜ code ZTO_COOKIE_NOT_CONFIGURED',
        bodyOf(res).code === 'ZTO_COOKIE_NOT_CONFIGURED');
});

scenario('កូនសោខុស ➜ 401 ហើយមិនប៉ះ Netlify សោះ', async () => {
    await withEnv(baseEnv(), async () => {
        const calls = stubFetch(() => Promise.resolve(fakeResponse(200)));
        const { handler } = loadHandler();
        const res = await handler(post({ key: 'wrong-key-x', cookie: SECRET_COOKIE }));
        ok('កូនសោខុស ➜ 401', res.statusCode === 401, 'បាន ' + res.statusCode);
        ok('កូនសោខុស ➜ គ្មានការហៅ Netlify API', calls.length === 0, 'ហៅ ' + calls.length + ' ដង');
    });
});

scenario('⛔ Cookie ដែលមាន CR/LF ➜ បដិសេធ (header injection)', async () => {
    await withEnv(baseEnv(), async () => {
        const calls = stubFetch(() => Promise.resolve(fakeResponse(200)));
        const { handler } = loadHandler();
        const evil = 'SESSIONID=abc123\r\nX-Injected: yes';
        const res = await handler(post({ key: 'update-me', cookie: evil }));
        ok('CR/LF ➜ 400', res.statusCode === 400, 'បាន ' + res.statusCode);
        ok('CR/LF ➜ reason cookie:control-char',
            bodyOf(res).reason === 'cookie:control-char', JSON.stringify(bodyOf(res)));
        ok('CR/LF ➜ គ្មានការហៅ Netlify API', calls.length === 0);
    });
});

scenario('Cookie ខូចទម្រង់ ➜ បដិសេធដោយមានឈ្មោះ', async () => {
    await withEnv(baseEnv(), async () => {
        stubFetch(() => Promise.resolve(fakeResponse(200)));
        const { handler } = loadHandler();

        const short = await handler(post({ key: 'update-me', cookie: 'a=1' }));
        ok('ខ្លីពេក ➜ 400', short.statusCode === 400);

        const noPair = await handler(post({ key: 'update-me', cookie: 'justtextnoequals' }));
        ok('គ្មានសញ្ញា = ➜ 400 pair-shape',
            noPair.statusCode === 400 && bodyOf(noPair).reason === 'cookie:pair-shape',
            JSON.stringify(bodyOf(noPair)));

        const spaced = await handler(post({ key: 'update-me', cookie: 'SESSION=has space here' }));
        ok('តម្លៃមានចន្លោះ ➜ 400 value-shape',
            spaced.statusCode === 400 && bodyOf(spaced).reason === 'cookie:value-shape',
            JSON.stringify(bodyOf(spaced)));

        const many = 'a'.repeat(0) + Array.from({ length: 70 }, (_, i) => 'k' + i + '=v').join('; ');
        const tooMany = await handler(post({ key: 'update-me', cookie: many }));
        ok('គូច្រើនពេក ➜ 400 too-many-pairs',
            tooMany.statusCode === 400 && bodyOf(tooMany).reason === 'cookie:too-many-pairs',
            JSON.stringify(bodyOf(tooMany)));
    });
});

scenario('body មិនមែន JSON ➜ 400', async () => {
    await withEnv(baseEnv(), async () => {
        stubFetch(() => Promise.resolve(fakeResponse(200)));
        const { handler } = loadHandler();
        const res = await handler(post('not json at all'));
        ok('body ខូច ➜ 400', res.statusCode === 400, 'បាន ' + res.statusCode);
        ok('body ខូច ➜ code ZTO_COOKIE_BODY_INVALID',
            bodyOf(res).code === 'ZTO_COOKIE_BODY_INVALID');
    });
});

scenario('Netlify មិនទាន់កំណត់ ➜ 503 មិនមែនជោគជ័យ', async () => {
    await withEnv(baseEnv({ NETLIFY_AUTH_TOKEN: '' }), async () => {
        const calls = stubFetch(() => Promise.resolve(fakeResponse(200)));
        const { handler } = loadHandler();
        const res = await handler(post({ key: 'update-me', cookie: SECRET_COOKIE }));
        ok('គ្មាន token ➜ 503', res.statusCode === 503, 'បាន ' + res.statusCode);
        ok('គ្មាន token ➜ reason netlify:missing-token',
            bodyOf(res).reason === 'netlify:missing-token');
        ok('គ្មាន token ➜ គ្មានការហៅបណ្តាញ', calls.length === 0);
    });
});

scenario('✅ ផ្លូវជោគជ័យ ➜ PATCH env រួច POST builds', async () => {
    await withEnv(baseEnv(), async () => {
        const calls = stubFetch(() => Promise.resolve(fakeResponse(200)));
        const { handler } = loadHandler();
        const res = await handler(post({ key: 'update-me', cookie: SECRET_COOKIE }));
        const body = bodyOf(res);

        ok('ជោគជ័យ ➜ 200', res.statusCode === 200, 'បាន ' + res.statusCode);
        ok('ជោគជ័យ ➜ ok true ហើយ deployTriggered true',
            body.ok === true && body.deployTriggered === true, JSON.stringify(body));
        ok('ការហៅបណ្តាញ ២ ដងគត់', calls.length === 2, 'ហៅ ' + calls.length + ' ដង');

        const envCall = calls[0];
        ok('ការហៅទី ១ ជា PATCH', envCall.init.method === 'PATCH', envCall.init.method);
        ok('ការហៅទី ១ ទៅ accounts/{id}/env/ZTO_COOKIE?site_id=',
            envCall.url === 'https://api.netlify.com/api/v1/accounts/acct-123/env/ZTO_COOKIE?site_id=site-abc',
            envCall.url);
        ok('ការហៅទី ១ ផ្ទុក Bearer token',
            envCall.init.headers.Authorization === 'Bearer ' + SECRET_TOKEN);
        const sent = JSON.parse(envCall.init.body);
        ok('body ជា {context:"all", value:<cookie>}',
            sent.context === 'all' && sent.value === SECRET_COOKIE,
            JSON.stringify({ context: sent.context, valueMatches: sent.value === SECRET_COOKIE }));

        const buildCall = calls[1];
        ok('ការហៅទី ២ ជា POST sites/{id}/builds',
            buildCall.init.method === 'POST'
            && buildCall.url === 'https://api.netlify.com/api/v1/sites/site-abc/builds',
            buildCall.init.method + ' ' + buildCall.url);

        ok('ឆ្លើយ **ឈ្មោះ** cookie មិនមែនតម្លៃ',
            Array.isArray(body.cookieNames) && body.cookieNames.indexOf('SESSIONID') !== -1
            && body.pairs === 2, JSON.stringify(body.cookieNames));

        // ⛔ ច្បាប់ secret-hygiene ៖ តម្លៃ Cookie និង token មិនត្រូវលេចក្នុងចម្លើយ។
        ok('⛔ តម្លៃ Cookie មិនលេចក្នុង response',
            res.body.indexOf('s3cr3tVALUE9876') === -1, res.body.slice(0, 200));
        ok('⛔ Netlify token មិនលេចក្នុង response',
            res.body.indexOf(SECRET_TOKEN) === -1);
    });
});

scenario('⛔ env សរសេរបរាជ័យ ➜ មិន trigger deploy និងមិនអះអាងជោគជ័យ', async () => {
    await withEnv(baseEnv(), async () => {
        const calls = stubFetch(() => Promise.resolve(fakeResponse(403)));
        const { handler } = loadHandler();
        const res = await handler(post({ key: 'update-me', cookie: SECRET_COOKIE }));
        ok('env 403 ➜ 401', res.statusCode === 401, 'បាន ' + res.statusCode);
        ok('env បរាជ័យ ➜ គ្មាន ok:true', bodyOf(res).ok !== true);
        ok('⛔ env បរាជ័យ ➜ **មិន** trigger build', calls.length === 1, 'ហៅ ' + calls.length + ' ដង');
    });
});

scenario('build បរាជ័យ ➜ 502 តែប្រាប់ថា env សរសេររួច', async () => {
    await withEnv(baseEnv(), async () => {
        const calls = stubFetch((url) => Promise.resolve(fakeResponse(/\/builds$/.test(url) ? 500 : 200)));
        const { handler } = loadHandler();
        const res = await handler(post({ key: 'update-me', cookie: SECRET_COOKIE }));
        const body = bodyOf(res);
        ok('build បរាជ័យ ➜ 502', res.statusCode === 502, 'បាន ' + res.statusCode);
        ok('build បរាជ័យ ➜ envUpdated true (និយាយការពិត)', body.envUpdated === true);
        ok('build បរាជ័យ ➜ code ZTO_COOKIE_DEPLOY_REJECTED',
            body.code === 'ZTO_COOKIE_DEPLOY_REJECTED', body.code);
        ok('បានព្យាយាមហៅ ២ ដង', calls.length === 2);
    });
});

scenario('ZTO_COOKIE_TRIGGER_DEPLOY=0 ➜ សរសេរ env តែមិន deploy', async () => {
    await withEnv(baseEnv({ ZTO_COOKIE_TRIGGER_DEPLOY: '0' }), async () => {
        const calls = stubFetch(() => Promise.resolve(fakeResponse(200)));
        const { handler } = loadHandler();
        const res = await handler(post({ key: 'update-me', cookie: SECRET_COOKIE }));
        ok('បិទ deploy ➜ 200', res.statusCode === 200);
        ok('បិទ deploy ➜ deployTriggered false', bodyOf(res).deployTriggered === false);
        ok('បិទ deploy ➜ ហៅតែ ១ ដង', calls.length === 1, 'ហៅ ' + calls.length + ' ដង');
    });
});

// ⛔ ច្បាប់ `stall-guard` (2.22.4) ៖ បណ្តាញ «ភ្ជាប់តែស្លាប់» **មិនបោះកំហុសទេ វាព្យួរ**។
// គ្មាន checker ណាចាប់ថ្នាក់នេះបានទេ បើវាដាក់ dependency ក្នុងរបៀប «ឆ្លើយ ឬបដិសេធ»
// តែម្យ៉ាង (សំណួរទី ៩)។ ដូច្នេះសេណារីយ៉ូនេះដាក់ `fetch` ដែល **មិនដែល settle**។
scenario('⛔ Netlify API ព្យួរ ➜ ត្រូវ settle ជា 504 (មិនព្យួរអស់កល្ប)', async () => {
    await withEnv(baseEnv({ ZTO_COOKIE_API_TIMEOUT_MS: '2000' }), async () => {
        stubFetch(() => new Promise(() => {}));
        const { handler } = loadHandler();
        const startedAt = Date.now();
        const res = await Promise.race([
            handler(post({ key: 'update-me', cookie: SECRET_COOKIE })),
            new Promise((resolve) => setTimeout(() => resolve({ statusCode: 0, body: '{}' }), 6000))
        ]);
        const took = Date.now() - startedAt;
        ok('បណ្តាញព្យួរ ➜ settle ជា 504', res.statusCode === 504, 'បាន ' + res.statusCode);
        ok('បណ្តាញព្យួរ ➜ code ZTO_COOKIE_API_TIMEOUT',
            bodyOf(res).code === 'ZTO_COOKIE_API_TIMEOUT', bodyOf(res).code);
        ok('បណ្តាញព្យួរ ➜ settle ក្នុង < 5 វិនាទី', took < 5000, took + 'ms');
    });
});

// ⛔ សំណួរទី ៧ ៖ «តើមានឧបករណ៍ណាឃើញ *ស្នាមភ្ជាប់* រវាងឯកសារ ២ ទេ?»
// ការវាស់ `Set-Cookie` រស់នៅក្នុង `zto-order-detail.js` ចំណែកការប្តូរ Cookie
// រស់នៅក្នុងឯកសារនេះ — ស្នាមភ្ជាប់នោះត្រូវចាក់សោដែរ។
scenario('zto-order-detail ៖ ?diag=1 រាយការវាស់ Set-Cookie', async () => {
    ok('ជាន់អប្បបរមា៖ ឃើញ zto-order-detail.js', fs.existsSync(LOOKUP_PATH));
    if (!fs.existsSync(LOOKUP_PATH)) return;
    const src = fs.readFileSync(LOOKUP_PATH, 'utf8');
    ok('មាន noteUpstreamSetCookie()', /function noteUpstreamSetCookie/.test(src));
    ok('វាត្រូវហៅភ្លាមក្រោយ fetch()',
        /const response = await fetch\(target\.href, init\);\s*\n\s*noteUpstreamSetCookie\(response\);/.test(src));
    ok('diag រាយ sessionRenewal', /sessionRenewal:/.test(src));
    ok('⛔ diag រាយតែ **ឈ្មោះ** — គ្មានតម្លៃ cookie',
        /names: upstreamCookieSignal\.names/.test(src) && !/values: upstreamCookieSignal/.test(src));
});

// ⛔ ការដកមុខងារចេញត្រូវមានឧបករណ៍ចាក់សោដែរ (មេរៀន 2.25.0)។
// Auto-login មិនត្រូវវិលមកតាមទ្វារថ្មីនេះទេ។
scenario('⛔ គ្មានសំណល់ auto-login ក្នុងផ្លូវថ្មី', async () => {
    const src = fs.readFileSync(FN_PATH, 'utf8');
    ok('គ្មាន puppeteer/chromium', !/puppeteer|chromium/i.test(src));
    ok('គ្មាន @netlify/blobs ឬ connectLambda', !/@netlify\/blobs|connectLambda/.test(src));
    ok('គ្មាន ZTO_USERNAME/ZTO_PASSWORD', !/ZTO_USERNAME|ZTO_PASSWORD|ZTO_LOGIN_/.test(src));
    ok('គ្មាន require() ក្រៅពី crypto',
        (src.match(/require\(/g) || []).length === 1 && /require\('crypto'\)/.test(src));
});

scenario('Chrome extension ៖ សិទ្ធិតូចបំផុត និងគ្មាន secret ក្នុងកូដ', async () => {
    ok('ជាន់អប្បបរមា៖ ឃើញថត extension', fs.existsSync(EXT_DIR));
    if (!fs.existsSync(EXT_DIR)) return;
    const manifest = JSON.parse(fs.readFileSync(path.join(EXT_DIR, 'manifest.json'), 'utf8'));
    const bg = fs.readFileSync(path.join(EXT_DIR, 'background.js'), 'utf8');

    ok('manifest v3', manifest.manifest_version === 3);
    ok('សិទ្ធិត្រឹម cookies + storage',
        JSON.stringify(manifest.permissions.slice().sort()) === JSON.stringify(['cookies', 'storage']),
        JSON.stringify(manifest.permissions));
    ok('⛔ host_permissions មិនមែន <all_urls>',
        manifest.host_permissions.indexOf('<all_urls>') === -1
        && manifest.host_permissions.every((h) => /ztoglobal\.com/.test(h)),
        JSON.stringify(manifest.host_permissions));
    ok('អាន cookie ពី host API មុន host UI',
        bg.indexOf('aargus-api.ztoglobal.com') < bg.indexOf('https://argus.ztoglobal.com'));
    ok('⛔ គ្មានកូនសោសរសេរជាប់ក្នុងកូដ',
        !/ZTO_COOKIE_UPDATE_KEY\s*=\s*['"][^'"]+['"]/.test(bg) && /chrome\.storage\.local/.test(bg));
    ok('ប្រើ text/plain ➜ គ្មាន preflight',
        /text\/plain/.test(bg) && !/Authorization:/.test(bg));
});

(async () => {
    for (const s of scenarios) {
        console.log('\n▶ ' + s.label);
        try {
            await s.fn();
        } catch (error) {
            ok(s.label + ' — បោះកំហុស', false, error && error.stack ? error.stack.split('\n')[0] : String(error));
        }
    }

    const MIN_ASSERTS = 45;
    console.log('');
    ok('ជាន់អប្បបរមា៖ ការអះអាងសរុប >= ' + MIN_ASSERTS, pass + fail >= MIN_ASSERTS, 'បាន ' + (pass + fail));

    if (fail) {
        console.log('\n❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')');
        process.exit(1);
    }
    console.log('\n✅ ' + pass + ' ok');
    process.exit(0);
})().then(() => {}, (e) => {
    console.log('\n❌ checker បោះកំហុស៖ ' + (e && e.stack ? e.stack : e));
    process.exit(1);
});
