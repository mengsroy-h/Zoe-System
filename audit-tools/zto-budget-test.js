// ⛔⛔ ថ្នាក់កំហុស៖ **ថវិកាពេលរបស់ ZTO Function មិនគ្របដណ្តប់ handler ទាំងមូល។**
//
// `CLAUDE.md` ចែងថា Function ត្រូវ «ឆ្លើយជា JSON ជានិច្ច មុន Netlify សម្លាប់វា»
// ហើយថវិកា ២ ជាន់ (`ZTO_UPSTREAM_TIMEOUT_MS` + `ZTO_REQUEST_BUDGET_MS`) ជា
// អ្នកធានារឿងនោះ។ ប៉ុន្តែនាឡិកាថវិកាចាប់ផ្តើមនៅ **`fetchOrder()`** មិនមែននៅ
// ច្រកចូល handler ទេ ➜ ការងារ ២ ស្ថិត **ក្រៅថវិកា**៖
//
//   ១. `resolveCookieCredential()` អាន Netlify Blobs (ពិដាន ៣ វិ.)
//   ២. `flushCookieRenewal()` សរសេរ Cookie ដែលបន្តអាយុ (ពិដាន ៣ វិ.)
//
// **វាស់បានលើ `origin/main` (2026-09-03)** ដោយ store យឺត និង upstream ព្យួរ៖
//
//   | សេណារីយ៉ូ (ថវិកា ១៤ វិ.) | ពេលពិតរបស់ handler |
//   |---|---|
//   | store អាន ៣ វិ. + upstream ព្យួរ ×២ + បន្តអាយុ ៣ វិ. | **១៦,៨១២ ms** |
//   | store លឿន + upstream ៥០ ms + បន្តអាយុ ៣ វិ.          | **៣,០៥៨ ms** |
//
// ជួរទី ១ = ការលើសថវិកា ២.៨ វិនាទី ➜ Netlify សម្លាប់ Function មុនវាឆ្លើយ ➜
// អ្នកប្រើឃើញ `Failed to fetch` ជំនួស JSON ដែលមានឈ្មោះ (ការវិលមកវិញនៃ
// មេរៀន 2.24.6 តាមទ្វារផ្សេង)។
//
// ជួរទី ២ = **ពន្ធល្បឿន ៣ វិនាទីលើការស្កេនដែលជោគជ័យ** ខណៈការងារពិតត្រឹម
// ៥០ ms។ ការបន្តអាយុ Cookie ជាការងារផ្ទៃខាងក្រោយ (មានពិដាន ១ ដង/៦០ វិ.)
// — វាមិនត្រូវធ្វើឲ្យអ្នកប្រើរង់ចាំទេ។
//
// ⛔ **មូលហេតុដែល checker ១២៤ បៃតងទាំងអស់** ៖ `zto-proxy-test.js` និង
// `zto-cookie-store-test.js` ដាក់ store ក្នុងរបៀប «លឿន» ឬ «ធ្លាក់» —
// **គ្មានមួយណាដាក់វាក្នុងរបៀប «យឺត តែជោគជ័យ» សោះ** ហើយក៏គ្មានមួយណា
// **វាស់ពេលវេលាពិតរបស់ handler** ធៀបនឹងថវិកាដែលវាប្រកាសដែរ។ នេះជា
// **សំណួរទី ៩** ក្នុងទម្រង់ថ្មី ៖ «យឺត» និង «ធ្លាក់» ជាស្ថានភាព ២ ផ្សេងគ្នា។
//
// ច្បាប់ដែលឯកសារនេះចាក់សោ៖
//   ១. ជាន់អប្បបរមា — Function ត្រូវមានស្រាប់ និងមានថេរថវិកា។
//   ២. ពេលពិតរបស់ handler ត្រូវ **≤ ថវិកា + slack** ក្នុងករណីអាក្រក់បំផុត។
//   ៣. ការបន្តអាយុ Cookie មិនត្រូវពន្យារការឆ្លើយតបជោគជ័យ។
//   ៤. ⛔ ទិសផ្ទុយ ៖ store លឿន ➜ ការបន្តអាយុ **នៅតែសរសេរពិត**។
//   ៥. ⛔ ទិសផ្ទុយ ៖ ផ្លូវធម្មតា (blob ➜ cookie ➜ ជោគជ័យ ➜ cache) មិនប្រែ។
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = process.env.ZTOBUDGET_APP_DIR ? path.resolve(process.env.ZTOBUDGET_APP_DIR) : path.join(__dirname, '..');
const FN_PATH = path.join(ROOT, 'ZoeW', 'netlify', 'functions', 'zto-order-detail.js');

let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { pass++; console.log('   ok    ' + label); }
    else { fail++; console.log('  FAIL   ' + label + (detail !== undefined ? '\n         ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : '')); }
}

// ═══ ១. ជាន់អប្បបរមា ═══════════════════════════════════════════════════
let SRC = '';
try {
    SRC = fs.readFileSync(FN_PATH, 'utf8');
} catch (e) {
    console.log('  FAIL   អាន ZoeW/netlify/functions/zto-order-detail.js មិនបាន ➜ ' + e.message);
    console.log('\n❌ ធ្លាក់ — Function ដែលតេស្តនេះការពារ បាត់ពី tree ដែលកំពុងពិនិត្យ');
    process.exit(1);
}
ok('ជាន់អប្បបរមា៖ Function មានថេរថវិកា ២ ជាន់',
    SRC.indexOf('ZTO_REQUEST_BUDGET_MS') !== -1 && SRC.indexOf('ZTO_UPSTREAM_TIMEOUT_MS') !== -1);
ok('ជាន់អប្បបរមា៖ Function មានផ្លូវ Cookie store', SRC.indexOf('COOKIE_STORE_TIMEOUT_MS') !== -1);

let mod = null;
try {
    mod = require(FN_PATH);
} catch (e) {
    ok('ផ្ទុក Function បាន', false, e.message);
}
if (!mod || typeof mod.handler !== 'function' || typeof mod.setBlobsModuleForTests !== 'function') {
    console.log('  FAIL   Function មិន export `handler` / `setBlobsModuleForTests`');
    console.log('\n❌ ធ្លាក់ ' + (fail + 1));
    process.exit(1);
}

const PROXY_KEY = 'k'.repeat(24);
const GOOD_COOKIE = 'BOS-MAN-SESSION=' + 'a'.repeat(48);
const RENEWED_COOKIE = 'BOS-MAN-SESSION=' + 'b'.repeat(48);

function fakeBlobs(opts) {
    const state = opts.state;
    return {
        connectLambda() {},
        getStore() {
            return {
                get() {
                    state.reads++;
                    return new Promise((resolve) => setTimeout(() => resolve(state.value), opts.readMs));
                },
                set(key, value) {
                    state.writeStartedAt = Date.now();
                    return new Promise((resolve) => setTimeout(() => {
                        state.writes++;
                        state.value = value;
                        resolve();
                    }, opts.writeMs));
                }
            };
        }
    };
}

function makeEvent(query) {
    return {
        httpMethod: 'GET',
        headers: { 'x-zoe-proxy-key': PROXY_KEY },
        queryStringParameters: query,
        blobs: 'test-context'
    };
}

function upstream(opts) {
    return async function fakeFetch(_url, init) {
        opts.state.upstreamCalls++;
        opts.state.sentCookies.push((init && init.headers && init.headers.Cookie) || '');
        if (opts.hang) return new Promise(() => {});
        await new Promise((resolve) => setTimeout(resolve, opts.upstreamMs || 0));
        // ⛔ Cookie ដែលបដិសេធ ➜ 401 (ការផុតកំណត់ពិតរបស់ ZTO)
        if (opts.rejectCookie && init && init.headers && init.headers.Cookie === opts.rejectCookie) {
            return {
                status: 401, ok: false,
                headers: { get: () => 'application/json', getSetCookie: () => [] },
                json: async () => ({ code: '401', message: 'not login' })
            };
        }
        const setCookie = opts.renew ? [RENEWED_COOKIE + '; Path=/; HttpOnly'] : [];
        return {
            status: 200,
            ok: true,
            headers: {
                get: (name) => (String(name).toLowerCase() === 'content-type' ? 'application/json' : null),
                getSetCookie: () => setCookie
            },
            json: async () => ({ code: '0', data: { consigneePhone: '012345678', agentAmount: 5, arrivalServiceCharge: 1.5 } })
        };
    };
}

let barcodeSeq = 0;
function nextBarcode() {
    barcodeSeq++;
    return 'ZTOBUDGET' + String(barcodeSeq).padStart(4, '0');
}

function applyEnv(env) {
    process.env.ZTO_PROXY_KEY = PROXY_KEY;
    process.env.ZTO_UPSTREAM_TIMEOUT_MS = String(env.upstreamTimeoutMs);
    process.env.ZTO_REQUEST_BUDGET_MS = String(env.budgetMs);
    process.env.ZTO_UPSTREAM_RETRIES = String(env.retries === undefined ? 1 : env.retries);
    process.env.ZTO_CACHE_TTL_MS = String(env.cacheTtlMs === undefined ? 60000 : env.cacheTtlMs);
    delete process.env.ZTO_AUTHORIZATION;
    delete process.env.ZTO_TOKEN;
    if (env.envCookie) process.env.ZTO_COOKIE = env.envCookie;
    else delete process.env.ZTO_COOKIE;
}

async function runHandler(opts) {
    mod.resetCachesForTests();
    const state = { reads: 0, writes: 0, upstreamCalls: 0, sentCookies: [], value: opts.storedCookie === undefined ? GOOD_COOKIE : opts.storedCookie, writeStartedAt: 0 };
    mod.setBlobsModuleForTests(fakeBlobs({ readMs: opts.readMs, writeMs: opts.writeMs, state }));
    applyEnv(opts);
    global.fetch = upstream({ state, hang: opts.hangUpstream, upstreamMs: opts.upstreamMs, renew: opts.renew, rejectCookie: opts.rejectCookie });
    const startedAt = Date.now();
    const res = await mod.handler(makeEvent({ barcode: opts.barcode || nextBarcode() }));
    return { ms: Date.now() - startedAt, res: res, state: state };
}

(async () => {
    // ═══ ២. ថវិកាត្រូវគ្របដណ្តប់ handler ទាំងមូល ═══════════════════════
    // ថវិកាតូច (៤ វិ.) ➜ តេស្តលឿន តែច្បាប់ដដែល៖ handler មិនត្រូវលើសថវិកា។
    console.log('\n=== ២. ថវិកាពេលត្រូវគ្របដណ្តប់ handler ទាំងមូល ===');
    const BUDGET = 6000;
    const SLACK = 900;
    const worst = await runHandler({
        budgetMs: BUDGET, upstreamTimeoutMs: 2000, retries: 1,
        readMs: 9000, writeMs: 9000, hangUpstream: true, renew: true,
        envCookie: GOOD_COOKIE
    });
    ok('store យឺត + upstream ព្យួរ ➜ handler ឆ្លើយក្នុងថវិកា ('
        + worst.ms + ' ms ≤ ' + (BUDGET + SLACK) + ' ms)',
        worst.ms <= BUDGET + SLACK,
        { measuredMs: worst.ms, budgetMs: BUDGET, slackMs: SLACK, status: worst.res.statusCode });
    ok('ការលើសថវិកានោះ ➜ នៅតែឆ្លើយជា JSON ដែលមានឈ្មោះ',
        worst.res.statusCode >= 400 && /"code":"ZTO_/.test(worst.res.body),
        worst.res.body);

    // ការអាន store ដែលយឺត តែ upstream លឿន — ថវិកានៅតែត្រូវគោរព
    // ⛔ ថវិកាតូច (៤ វិ. ជាឥដ្ឋដែល `boundedInteger` អនុញ្ញាត) ៖ ការអាន
    // store ដែលយឺត ត្រូវត្រូវបានកាត់ឲ្យខ្លីល្មម បើមិនដូច្នេះការស្កេនធ្លាក់ជា
    // `ZTO_TIMEOUT` ខណៈ ZTO ឆ្លើយក្នុង ២០ ms។
    const TIGHT_BUDGET = 4000;
    const slowRead = await runHandler({
        budgetMs: TIGHT_BUDGET, upstreamTimeoutMs: 2000, retries: 1,
        readMs: 9000, writeMs: 20, upstreamMs: 20,
        envCookie: GOOD_COOKIE
    });
    ok('store អានយឺត តែ upstream លឿន ➜ នៅតែក្នុងថវិកា (' + slowRead.ms + ' ms)',
        slowRead.ms <= TIGHT_BUDGET + SLACK,
        { measuredMs: slowRead.ms, budgetMs: TIGHT_BUDGET });
    // ⛔ store ដែលយឺត មិនត្រូវ **លេប** ថវិការបស់ការស្វែងរក ៖ ការអានត្រូវកក់
    // កន្លែងឲ្យការហៅ upstream យ៉ាងតិច ១ ដង បើមិនដូច្នេះការស្កេនត្រូវធ្លាក់
    // ជា `ZTO_TIMEOUT` ខណៈ ZTO ឆ្លើយក្នុង ២០ ms។
    ok('store យឺត ➜ ការស្កេននៅតែឈានដល់ ZTO ហើយជោគជ័យ',
        slowRead.res.statusCode === 200 && /"found":true/.test(slowRead.res.body),
        { status: slowRead.res.statusCode, body: slowRead.res.body });

    // ═══ ៣. ការបន្តអាយុ Cookie មិនត្រូវពន្យារការឆ្លើយតបជោគជ័យ ═════════
    console.log('\n=== ៣. ការបន្តអាយុ Cookie មិនត្រូវពន្យារការឆ្លើយតប ===');
    const RENEW_LATENCY_CAP_MS = 1500;
    const renewSlow = await runHandler({
        budgetMs: 14000, upstreamTimeoutMs: 8000, retries: 1,
        readMs: 5, writeMs: 5000, upstreamMs: 30, renew: true
    });
    ok('ការសរសេរបន្តអាយុដែលយឺត មិនទប់ការឆ្លើយតប (' + renewSlow.ms + ' ms ≤ ' + RENEW_LATENCY_CAP_MS + ' ms)',
        renewSlow.ms <= RENEW_LATENCY_CAP_MS,
        { measuredMs: renewSlow.ms, capMs: RENEW_LATENCY_CAP_MS, status: renewSlow.res.statusCode });
    ok('ការស្កេននោះនៅតែជោគជ័យ (HTTP 200 · found)',
        renewSlow.res.statusCode === 200 && /"found":true/.test(renewSlow.res.body),
        renewSlow.res.body);

    // ═══ ៤. ⛔ ទិសផ្ទុយ ៖ store លឿន ➜ ការបន្តអាយុនៅតែសរសេរពិត ═════════
    console.log('\n=== ៤. ទិសផ្ទុយ ៖ store លឿន ➜ ការបន្តអាយុនៅតែសរសេរ ===');
    const renewFast = await runHandler({
        budgetMs: 14000, upstreamTimeoutMs: 8000, retries: 1,
        readMs: 5, writeMs: 10, upstreamMs: 20, renew: true
    });
    ok('Cookie ថ្មីត្រូវសរសេរចូល store ពិត', renewFast.state.writes === 1,
        { writes: renewFast.state.writes });
    ok('តម្លៃក្នុង store ក្លាយជា Cookie ដែលបន្តអាយុ',
        renewFast.state.value === RENEWED_COOKIE, renewFast.state.value);
    ok('ការស្កេននោះនៅតែជោគជ័យ', renewFast.res.statusCode === 200);

    // ⛔ ការបន្តអាយុមិនត្រូវសរសេរពេលគ្មាន Set-Cookie
    const noRenew = await runHandler({
        budgetMs: 14000, upstreamTimeoutMs: 8000, retries: 1,
        readMs: 5, writeMs: 10, upstreamMs: 20, renew: false
    });
    ok('គ្មាន Set-Cookie ➜ គ្មានការសរសេរ', noRenew.state.writes === 0, { writes: noRenew.state.writes });

    // ═══ ៥. ⛔ ទិសផ្ទុយ ៖ ផ្លូវធម្មតាមិនប្រែ ═══════════════════════════
    console.log('\n=== ៥. ទិសផ្ទុយ ៖ ផ្លូវធម្មតាមិនប្រែ ===');
    const normal = await runHandler({
        budgetMs: 14000, upstreamTimeoutMs: 8000, retries: 1,
        readMs: 5, writeMs: 10, upstreamMs: 15
    });
    ok('ផ្លូវធម្មតា ➜ HTTP 200 ជាមួយលេខទូរស័ព្ទ',
        normal.res.statusCode === 200 && /"phone":"012345678"/.test(normal.res.body), normal.res.body);
    ok('ផ្លូវធម្មតាលឿន (' + normal.ms + ' ms < 600 ms)', normal.ms < 600, { measuredMs: normal.ms });
    ok('អាន Cookie ពី blob ១ ដង', normal.state.reads === 1, { reads: normal.state.reads });

    // cache ៖ ការហៅទី ២ លើ barcode ដដែល មិនប៉ះ upstream
    const sharedBarcode = nextBarcode();
    const first = await runHandler({
        budgetMs: 14000, upstreamTimeoutMs: 8000, retries: 1,
        readMs: 5, writeMs: 10, upstreamMs: 15, barcode: sharedBarcode
    });
    global.fetch = upstream({ state: first.state, upstreamMs: 15 });
    const secondRes = await mod.handler(makeEvent({ barcode: sharedBarcode }));
    ok('ការស្កេនដដែលក្នុង ៦០ វិ. ➜ ឆ្លើយពី cache',
        secondRes.statusCode === 200 && /"cached":true/.test(secondRes.body), secondRes.body);
    ok('cache hit មិនប៉ះ upstream', first.state.upstreamCalls === 1,
        { upstreamCalls: first.state.upstreamCalls });

    // ⛔ diag មិនត្រូវលេចតម្លៃ Cookie
    mod.resetCachesForTests();
    const diagState = { reads: 0, writes: 0, upstreamCalls: 0, sentCookies: [], value: GOOD_COOKIE, writeStartedAt: 0 };
    mod.setBlobsModuleForTests(fakeBlobs({ readMs: 5, writeMs: 10, state: diagState }));
    applyEnv({ budgetMs: 14000, upstreamTimeoutMs: 8000, retries: 1 });
    const diag = await mod.handler(makeEvent({ diag: '1' }));
    ok('?diag=1 ឆ្លើយ auth=cookie · source=blob',
        diag.statusCode === 200 && /"auth":"cookie"/.test(diag.body) && /"source":"blob"/.test(diag.body), diag.body);
    ok('⛔ ?diag=1 មិនលេចតម្លៃ Cookie', diag.body.indexOf('a'.repeat(48)) === -1);

    // ═══ ៦. Cookie ចាស់ក្នុង cache ➜ អានឡើងវិញ ១ ដង រួចសាកម្តងទៀត ═══════
    // ⛔ ថ្នាក់ ៖ helper ទើបសរសេរ Cookie ថ្មីចូល Blobs តែ instance នេះនៅ
    // កាន់ Cookie ចាស់ក្នុង cache ៦០ វិ. ➜ ការស្កេនធ្លាក់ជា 401 ដោយឥត
    // ប្រយោជន៍ ហើយអ្នកប្រើត្រូវរង់ចាំ cooldown ៣០ វិនាទី។
    console.log('\n=== ៦. 401 ដោយ Cookie ចាស់ក្នុង cache ➜ ស្កេនត្រូវជោគជ័យវិញ ===');
    {
        mod.resetCachesForTests();
        const state = { reads: 0, writes: 0, upstreamCalls: 0, sentCookies: [], value: GOOD_COOKIE, writeStartedAt: 0 };
        mod.setBlobsModuleForTests(fakeBlobs({ readMs: 5, writeMs: 10, state }));
        applyEnv({ budgetMs: 14000, upstreamTimeoutMs: 8000, retries: 1 });
        // ការហៅទី ១ ៖ ជោគជ័យ ➜ Cookie ចាស់ចូល cache ៦០ វិ.
        global.fetch = upstream({ state, upstreamMs: 10 });
        await mod.handler(makeEvent({ barcode: nextBarcode() }));
        // ក្រោយមក ៖ session ផុតកំណត់ពិត ហើយ helper សរសេរ Cookie ថ្មីចូល store
        state.value = RENEWED_COOKIE;
        global.fetch = upstream({ state, upstreamMs: 10, rejectCookie: GOOD_COOKIE });
        const before = state.upstreamCalls;
        const res = await mod.handler(makeEvent({ barcode: nextBarcode() }));
        ok('Cookie ចាស់ ➜ អានឡើងវិញ ➜ ការស្កេនជោគជ័យ (HTTP ' + res.statusCode + ')',
            res.statusCode === 200 && /"found":true/.test(res.body), res.body);
        ok('ការហៅ upstream ២ ដងគត់ (ចាស់ ➜ ថ្មី)', state.upstreamCalls - before === 2,
            { calls: state.upstreamCalls - before });
        ok('ការហៅទី ២ ប្រើ Cookie ថ្មី',
            state.sentCookies[state.sentCookies.length - 1] === RENEWED_COOKIE,
            state.sentCookies.slice(-2));
    }

    // ⛔ ទិសផ្ទុយ ៖ Cookie មិនប្រែ ➜ 401 ភ្លាម គ្មានការហៅ upstream ស្ទួន
    {
        mod.resetCachesForTests();
        const state = { reads: 0, writes: 0, upstreamCalls: 0, sentCookies: [], value: GOOD_COOKIE, writeStartedAt: 0 };
        mod.setBlobsModuleForTests(fakeBlobs({ readMs: 5, writeMs: 10, state }));
        applyEnv({ budgetMs: 14000, upstreamTimeoutMs: 8000, retries: 1 });
        global.fetch = upstream({ state, upstreamMs: 10, rejectCookie: GOOD_COOKIE });
        const res = await mod.handler(makeEvent({ barcode: nextBarcode() }));
        ok('⛔ Cookie មិនប្រែ ➜ 401 ZTO_AUTH_EXPIRED',
            res.statusCode === 401 && /ZTO_AUTH_EXPIRED/.test(res.body), res.body);
        ok('⛔ Cookie មិនប្រែ ➜ ហៅ upstream ១ ដងគត់ (គ្មានការសាកឥតប្រយោជន៍)',
            state.upstreamCalls === 1, { calls: state.upstreamCalls });
    }

    // ═══ cache លទ្ធផល ត្រូវរស់រានពីការបន្តអាយុ Cookie ═══════════════════════
    // ⛔ លទ្ធផលរបស់ barcode មួយ **មិនអាស្រ័យលើ session ណាដែលទៅយក** ➜ កូនសោ
    // cache មិនត្រូវផ្ទុក fingerprint នៃ Cookie ។ បើវាផ្ទុក នោះរាល់ការបន្តអាយុ
    // Cookie **បោះ cache ទាំងមូលចោល** ➜ ការស្កេនបន្ទាប់ត្រូវឆ្លងបណ្តាញម្តងទៀត។
    // ហើយ cache hit ត្រូវឆ្លើយ **ដោយមិនប៉ះ Netlify Blobs** — នោះជាល្បឿនពិត។
    {
        console.log('\n== cache ↔ ការបន្តអាយុ Cookie ==');
        mod.resetCachesForTests();
        const state = { reads: 0, writes: 0, upstreamCalls: 0, sentCookies: [], value: GOOD_COOKIE, writeStartedAt: 0 };
        mod.setBlobsModuleForTests(fakeBlobs({ readMs: 5, writeMs: 5, state }));
        applyEnv({ budgetMs: 9000, upstreamTimeoutMs: 6000, retries: 1 });
        global.fetch = upstream({ state, upstreamMs: 5, renew: true });

        const code = nextBarcode();
        const r1 = await mod.handler(makeEvent({ barcode: code }));
        ok('ការហៅទី ១ ➜ ទៅដល់ upstream', r1.statusCode === 200 && /"cached":false/.test(r1.body), r1.body);
        const readsAfterFirst = state.reads;
        const upstreamAfterFirst = state.upstreamCalls;
        ok('ការហៅទី ១ បានបន្តអាយុ Cookie ពិត (ជាន់អប្បបរមា)', state.writes >= 1, state.writes);

        const r2 = await mod.handler(makeEvent({ barcode: code }));
        ok('⛔ ការស្កេនដដែលក្រោយការបន្តអាយុ ➜ នៅតែ cache hit',
            r2.statusCode === 200 && /"cached":true/.test(r2.body), r2.body);
        ok('⛔ cache hit មិនហៅ upstream ម្តងទៀត',
            state.upstreamCalls === upstreamAfterFirst, { before: upstreamAfterFirst, after: state.upstreamCalls });
        ok('⛔ cache hit មិនប៉ះ Netlify Blobs សោះ (ល្បឿនពិត)',
            state.reads === readsAfterFirst, { before: readsAfterFirst, after: state.reads });

        // ⛔ ទិសផ្ទុយ ៖ barcode ផ្សេង នៅតែឆ្លងបណ្តាញដដែល
        const other = nextBarcode();
        const r3 = await mod.handler(makeEvent({ barcode: other }));
        ok('⛔ ទិសផ្ទុយ ៖ barcode ផ្សេង នៅតែហៅ upstream',
            r3.statusCode === 200 && /"cached":false/.test(r3.body) && state.upstreamCalls > upstreamAfterFirst,
            { body: r3.body, calls: state.upstreamCalls });
    }

    // ═══ ថវិកាលំនាំដើម ត្រូវសមក្នុងពិដានពិតរបស់ Netlify ══════════════════
    // ⛔ Netlify សម្លាប់ **synchronous function** នៅ **១០ វិនាទី** (លំនាំដើម
    // គ្រប់ plan)។ ថវិកាដែលធំជាងនោះមានន័យថា Function ត្រូវសម្លាប់ **មុន**
    // វាឆ្លើយ JSON ដែលមានឈ្មោះ ➜ អ្នកប្រើឃើញ `Failed to fetch` ជំនួស
    // «⏱️ ZTO ឆ្លើយតបយឺតពេក» — ការរំលោភផ្ទាល់លើមេរៀន 2.24.6។
    // ⚠️ ការវាស់ត្រូវអានលេខ **ចេញពី Function ពិត** មិនមែនចាក់ literal ក្នុង
    // checker (បើមិនដូច្នេះ វាចាក់សោការសន្មតចាស់ — មេរៀន 2.25.5)។
    {
        console.log('\n== ថវិកាលំនាំដើម ↔ ពិដាន Netlify ==');
        const NETLIFY_SYNC_LIMIT_MS = 10000;
        const budgetDefault = /ZTO_REQUEST_BUDGET_MS,\s*(\d+),/.exec(SRC);
        const upstreamDefault = /ZTO_UPSTREAM_TIMEOUT_MS,\s*(\d+),/.exec(SRC);
        ok('រកឃើញថវិកាលំនាំដើមក្នុង Function', !!(budgetDefault && upstreamDefault));
        if (budgetDefault && upstreamDefault) {
            const budget = Number(budgetDefault[1]);
            const upstream = Number(upstreamDefault[1]);
            ok('⛔ ថវិកាលំនាំដើមត្រូវសមក្នុងពិដាន ១០ វិ. របស់ Netlify',
                budget <= NETLIFY_SYNC_LIMIT_MS - 500, { budgetMs: budget, limitMs: NETLIFY_SYNC_LIMIT_MS });
            ok('⛔ ពិដានក្នុងមួយសំណើត្រូវតូចជាងថវិកា (ទុកកន្លែងឲ្យការឆ្លើយ)',
                upstream > 0 && upstream <= budget - 1500, { upstreamMs: upstream, budgetMs: budget });
            ok('ថវិកាមិនត្រូវតូចពេក (ការស្កេនពិតត្រូវការពេល)',
                budget >= 6000, budget);
        }
    }

    console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail : '✅ គ្មានបញ្ហា') + ' — ok ' + pass);
    process.exit(fail ? 1 : 0);
})().catch((e) => {
    console.log('  FAIL   តេស្តគាំង ➜ ' + (e && e.stack ? e.stack : e));
    process.exit(1);
});
