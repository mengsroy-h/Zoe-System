// ថ្នាក់កំហុស៖ **timeout ដែលមិន abort សំណើពិត**។
//
// `withTimeout(fetch(url), 20000)` គ្រាន់តែ race នឹង timer — `fetch` ខ្លួនវា
// **នៅតែដំណើរការបន្ត**។ ផលពិត ២៖
//   ១. ជាមួយ `retryAsync(fn, 2)` រាល់ការព្យាយាមបង្កើតសំណើថ្មី **ដោយមិន
//      បោះបង់ការចាស់** ➜ លើបណ្តាញយឺត សំណើជាន់គ្នាស៊ី bandwidth ➜ Lookup
//      កាន់តែយឺត ➜ អ្នកប្រើឃើញ App «ជាប់»។
//   ២. timeout គ្របតែផ្នែក **header** ប៉ុណ្ណោះ។ បើ server ផ្ញើ header រួច
//      **ឈប់ផ្ញើ body** នោះ `res.json()` / `res.text()` ខាងក្រោយ **ព្យួររហូត**
//      ដោយគ្មាន timer ណាការពារ ➜ ប្រអប់ជាប់ជារៀងរហូត។
//
// ដំណោះស្រាយ៖ `fetchWithTimeout()` ដែលប្រើ `AbortController` ហើយ timer
// របស់វារស់រហូតដល់ **អានតួចប់**។
//
// `license-verify.js` ធ្លាប់មានកំហុសដដែលនេះ ៖ វា `clearTimeout` ក្នុង
// `finally` របស់ `fetch` ➜ timer ស្លាប់ភ្លាមពេល **header** មកដល់ ➜
// `res.json()` ខាងក្រោយអាចព្យួររហូត។ ព្រោះ `checkOnline()` ត្រូវហៅតាម
// កាលវិភាគ ការព្យួរនោះកកកុញសំណើរស់មួយក្នុងមួយជុំ រហូតដល់ Refresh។
// ឥឡូវទាំង ២ ឯកសារឆ្លងកាត់ helper ដែល abort ពិត។
const fs = require('fs'), http = require('http'), path = require('path');
const ROOT = process.env.NETTIMEOUT_APP_DIR || path.join(__dirname, '..');

let pass = 0, fail = 0;
function ok(label, cond, detail) {
    if (cond) { pass++; console.log('   ok    ' + label); }
    else { fail++; console.log('   FAIL  ' + label + (detail !== undefined ? '\n         ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : '')); }
}

// === ផ្នែកទី ១ — ស្តាទិច ===
const src = fs.readFileSync(path.join(ROOT, 'ZoeW', 'app.js'), 'utf8');

ok('app.js មាន fetchWithTimeout ដែលប្រើ AbortController',
    /function fetchWithTimeout\(/.test(src) && /new AbortController\(\)/.test(src));
ok('គ្មាន `withTimeout(fetch(` នៅសល់ (timeout ដែល abort មិនកើត)',
    !/withTimeout\(\s*fetch\(/.test(src),
    (src.match(/withTimeout\(\s*fetch\([^\n]*/g) || []).join('\n         '));
// ⛔ ZoeW (React) ៖ helper បញ្ជូន URL តាម `resolveNativeApiUrl()` / `nativeFunctionRequest()` (App Android ៖ ផ្លូវ
//    `/.netlify/` ➜ origin វែប · query ➜ header `X-Zoe-Query` ដើម្បី cache preflight · 400 ពី Function ចាស់ ➜ សាក URL ចាស់)
//    ➜ ច្បាប់វាស់ជា **រចនាសម្ព័ន្ធ** ៖ `fetch(` ទាំងអស់ត្រូវនៅ **ក្នុងតួ `fetchWithTimeout`** (ការផ្គូផ្គងអក្សរ `fetch(url, opts)`
//    នៃជំនាន់មុន បដិសេធការរៀបចំឡើងវិញដែលត្រឹមត្រូវ ហើយមិនដឹងថា fetch នៅក្នុង helper ណា)
const fwtAt = src.indexOf('function fetchWithTimeout(');
const fwtBody = (() => {
    if (fwtAt === -1) return '';
    let depth = 0, k = src.indexOf('{', fwtAt);
    const start = k;
    for (; k < src.length; k++) {
        if (src[k] === '{') depth++;
        else if (src[k] === '}') { depth--; if (!depth) break; }
    }
    return src.slice(start, k + 1);
})();
const rawFetch = (text) => (text.match(/(?<![\w.])fetch\(/g) || []).length;
const outsideFetch = src.slice(0, fwtAt === -1 ? src.length : fwtAt) + src.slice(fwtAt === -1 ? src.length : fwtAt + fwtBody.length + 'function fetchWithTimeout('.length);
ok('ជាន់អប្បបរមា ៖ មាន fetch( យ៉ាងតិច ១ ក្នុងតួ fetchWithTimeout', rawFetch(fwtBody) >= 1, 'inside=' + rawFetch(fwtBody));
ok('រាល់ការហៅ fetch() ទៅ endpoint ខាងក្រៅឆ្លងកាត់ fetchWithTimeout',
    fwtAt !== -1 && rawFetch(outsideFetch) === 0,
    'fetch ឆៅក្រៅ helper៖ ' + (outsideFetch.match(/^.*(?<![\w.])fetch\(.*$/gm) || []).join(' | '));
ok('timer ត្រូវរស់រហូតដល់អានតួចប់ (readBody ស្ថិតក្នុងបង្អួច timeout)',
    /readBody\(res\)/.test(src) && /clearTimeout\(timer\)/.test(src));
ok('ការ abort ប្រើ .then(ok, fail) ២ អាគុយម៉ង់ តាមច្បាប់គម្រោង',
    !/fetch\((?:resolveNativeApiUrl\()?url\)?, opts\)\s*\.then\([^)]*\)\s*\.catch\(/.test(src));

// === ផ្នែកទី ១ខ — license-verify.js ត្រូវគោរពច្បាប់ដដែល ===
const licSrc = fs.readFileSync(path.join(ROOT, 'ZoeW', 'license-verify.js'), 'utf8');

ok('license-verify.js មាន helper ដែល abort ពិត',
    /async function fetchWithBodyTimeout\(/.test(licSrc) && /new AbortController\(\)/.test(licSrc));
ok('license-verify.js គ្មាន fetch() ឆៅក្រៅ helper',
    (licSrc.match(/(?<!function )\bfetch\(/g) || []).length === 1,
    'fetch ឆៅ៖ ' + (licSrc.match(/^.*(?<!function )\bfetch\(.*$/gm) || []).join(' | '));
ok('license-verify.js អានតួ **ខាងក្នុង** បង្អួច timeout មិនមែនក្រោយវា',
    /await fetch\([\s\S]{0,200}?await readBody\(res\)[\s\S]{0,120}?finally\s*\{\s*clearTimeout\(timer\);/.test(licSrc));
ok('license-verify.js គ្មាន clearTimeout មុនអានតួ',
    !/finally\s*\{\s*clearTimeout\(timer\);\s*\}[\s\S]{0,1200}?await res\.(json|text)\(\)/.test(licSrc));

// === ផ្នែកទី ១គ — ZoeKeyGen ត្រូវគោរពច្បាប់ដដែល ===
// **ចន្លោះដែលធ្លាក់មុននេះ៖** តេស្តនេះស្កេនតែ `ZoeW/app.js` និង
// `ZoeW/license-verify.js` ➜ `readUserRoleViaRest()` របស់ ZoeKeyGen ប្រើ
// `fetch()` **ឆៅ គ្មាន AbortController គ្មាន timeout សោះ** ហើយអាន
// `await res.json()` ក្រៅបង្អួចការពារណាមួយ។ `readUserRole()` មាន timer
// ៤៥ វិ. តែវា reject **តែ promise ខាងក្រៅ** ប៉ុណ្ណោះ — សំណើនៅរស់។
// ព្រោះ `retryPendingRoleCheck()` ត្រូវហៅរាល់ `visibilitychange`, `online`
// និងរាល់ពេល `.info/connected` ត្រឡប់ជា true នោះការព្យួរនីមួយៗ **កកកុញ
// មួយក្នុងមួយជុំ** ព្រមទាំង **យក ID token ជាប់ក្នុង URL** ទៅជាមួយ។
const kgSrc = fs.readFileSync(path.join(ROOT, 'ZoeKeyGen', 'app.js'), 'utf8');

ok('ZoeKeyGen/app.js មាន fetchWithTimeout ដែលប្រើ AbortController',
    /function fetchWithTimeout\(/.test(kgSrc) && /new AbortController\(\)/.test(kgSrc));
ok('ZoeKeyGen គ្មាន fetch() ឆៅក្រៅ helper (រួមទាំងការពិនិត្យតួនាទីតាម REST)',
    (kgSrc.match(/(?<!function )\bfetch\(/g) || []).length ===
    (kgSrc.match(/fetch\(url, opts\)/g) || []).length,
    'fetch ឆៅ៖ ' + (kgSrc.match(/^.*(?<!function )\bfetch\(.*$/gm) || []).map((l) => l.trim()).join(' | '));
ok('ZoeKeyGen គ្មាន `withTimeout(fetch(` នៅសល់',
    !/withTimeout\(\s*fetch\(/.test(kgSrc));
ok('ZoeKeyGen អានតួឆ្លងកាត់ readBody ក្នុងបង្អួច timeout មិនមែន `await res.json()` ឆៅ',
    !/await res\.json\(\)/.test(kgSrc),
    (kgSrc.match(/^.*await res\.json\(\).*$/gm) || []).join(' | '));

// === ផ្នែកទី ២ — ឥរិយាបថពិតក្នុង Chromium ===
let chromium;
try { chromium = require('playwright-core').chromium; } catch (e) {
    console.log('\nSKIP ផ្នែក browser — ត្រូវការ playwright-core');
    console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')' : '✅ ជោគជ័យ ' + pass));
    process.exit(fail ? 1 : 0);
}
const CHROME = process.env.NETTIMEOUT_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
if (!fs.existsSync(CHROME)) {
    console.log('\nSKIP ផ្នែក browser — រកមិនឃើញ Chromium');
    console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')' : '✅ ជោគជ័យ ' + pass));
    process.exit(fail ? 1 : 0);
}

// ស្រង់ `fetchWithTimeout` ពិតចេញពី app.js មករត់ — កុំសរសេរតេស្តលើកូដចម្លង
function extractFn(name) {
    const at = src.indexOf('function ' + name + '(');
    if (at === -1) return null;
    let depth = 0, start = src.indexOf('{', at), end = start;
    for (let k = start; k < src.length; k++) {
        if (src[k] === '{') depth++;
        else if (src[k] === '}') { depth--; if (!depth) { end = k; break; } }
    }
    return src.slice(at, end + 1);
}
let summaryPrinted = false;
// ⛔ React ៖ helper អាស្រ័យលើ `resolveNativeApiUrl()` (`platform/native.ts`) ➜ ចាក់កូដពិតរបស់វាផង (web ៖ គ្មាន Capacitor)
const FN = extractFn('fetchWithTimeout') && ['bridge', 'isNativeApp', 'nativeWebOrigin', 'resolveNativeApiUrl', 'nativeFunctionRequest', 'moveQueryToHeader']
    .map((n) => extractFn(n) || '').join('\n') + '\nvar lookupState = { nativeQueryHeaderUnsupported: false };\n' + extractFn('fetchWithTimeout');
ok('ស្រង់ fetchWithTimeout ពិតចេញពី app.js បាន', !!FN);
if (!FN) {
    // គ្មាន helper ➜ ផ្នែក browser គ្មានអ្វីត្រូវរត់។ ចាកចេញយ៉ាងស្អាតជំនួស
    // ការគាំងដោយ ReferenceError ដែលមើលទៅដូចកំហុស harness។
    console.log('\n❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ') — រំលងផ្នែក browser ព្រោះគ្មាន fetchWithTimeout');
    summaryPrinted = true;
    process.exit(1);
}

// ម៉ាស៊ីនបម្រើដែលធ្វើត្រាប់តាមបណ្តាញឆ្កួត៖
//   /hang       — មិនឆ្លើយអ្វីទាំងអស់
//   /headers-only — ផ្ញើ header រួច **ឈប់** មិនផ្ញើ body និងមិនបិទ
let openSockets = 0, abortedSockets = 0, hangHits = 0;
function serve() {
    return new Promise((res) => {
        const s = http.createServer((req, rsp) => {
            const p = req.url.split('?')[0];
            openSockets++;
            req.on('aborted', () => { abortedSockets++; });
            rsp.on('close', () => {});
            if (p === '/hang') { hangHits++; return; }
            if (p === '/headers-only') {
                rsp.writeHead(200, { 'Content-Type': 'application/json', 'Transfer-Encoding': 'chunked',
                                     'Access-Control-Allow-Origin': '*' });
                rsp.write(' ');
                return;
            }
            rsp.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            rsp.end(JSON.stringify({ ok: true }));
        });
        s.listen(0, '127.0.0.1', () => res(s));
    });
}

(async () => {
    const server = await serve();
    const port = server.address().port;
    const base = 'http://127.0.0.1:' + port;

    const browser = await chromium.launch({ executablePath: CHROME });
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(base + '/ping', { waitUntil: 'domcontentloaded' });
    await page.evaluate('(function(){ ' + FN + '; window.fetchWithTimeout = fetchWithTimeout; })()');
    const wired = await page.evaluate(() => typeof window.fetchWithTimeout === 'function');
    ok('fetchWithTimeout ពិតត្រូវបានចាក់ចូល browser', wired === true, String(wired));

    // ១ — សំណើដែលមិនឆ្លើយ ត្រូវ reject **ក្នុងពេលកំណត់** មិនមែនរង់ចាំរហូត
    const hang = await page.evaluate(async (b) => {
        const t0 = Date.now();
        try {
            await fetchWithTimeout(b + '/hang', {}, 700, 'X timed out', (r) => r.json());
            return { rejected: false, ms: Date.now() - t0 };
        } catch (e) {
            return { rejected: true, ms: Date.now() - t0, msg: String(e && e.message) };
        }
    }, base);
    ok('សំណើដែលមិនឆ្លើយ ➜ reject ក្នុងពេលកំណត់',
        hang.rejected && hang.ms >= 600 && hang.ms < 2500, hang);
    ok('សំណើឈានដល់ server ពិត (មិនធ្លាក់មុនចេញដំណើរ)', hangHits >= 1, { hangHits });
    ok('សារ timeout ជាសាររបស់អ្នកហៅ (មិនត្រូវប្តូរជា AbortError)',
        hang.msg === 'X timed out', hang);

    // ២ — **ចំណុចសំខាន់**៖ សំណើត្រូវត្រូវបាន abort ពិត មិនមែនត្រឹមបោះបង់ promise
    await page.waitForTimeout(400);
    ok('សំណើត្រូវបាន abort ពិត (server ឃើញ connection ដាច់)',
        abortedSockets >= 1, { hangHits, abortedSockets });

    // ៣ — server ផ្ញើ header រួចឈប់ ➜ ការអានតួក៏ត្រូវឈប់ដែរ (កំហុសចាស់ព្យួររហូត)
    const partial = await page.evaluate(async (b) => {
        const t0 = Date.now();
        try {
            await fetchWithTimeout(b + '/headers-only', {}, 700, 'Y timed out', (r) => r.json());
            return { rejected: false, ms: Date.now() - t0 };
        } catch (e) {
            return { rejected: true, ms: Date.now() - t0, msg: String(e && e.message) };
        }
    }, base);
    ok('header មករួច តែតួមិនមក ➜ នៅតែ timeout (មិនព្យួររហូត)',
        partial.rejected && partial.ms < 2500, partial);

    // ៤ — ផ្លូវធម្មតាត្រូវនៅដំណើរការ ហើយ timer ត្រូវត្រូវបានសម្អាត
    const good = await page.evaluate(async (b) => {
        const out = await fetchWithTimeout(b + '/ok', {}, 5000, 'Z timed out', (r) => r.json());
        return { status: out.res.status, body: out.body };
    }, base);
    ok('សំណើធម្មតា ➜ ត្រឡប់ res និង body ត្រឹមត្រូវ',
        good.status === 200 && good.body && good.body.ok === true, good);

    // ៤ខ — helper ពិតរបស់ license-verify.js ក៏ត្រូវឈប់ដែរ ពេលតួមិនមក
    const licFn = (function () {
        const at = licSrc.indexOf('async function fetchWithBodyTimeout(');
        if (at === -1) return null;
        let depth = 0, start = licSrc.indexOf('{', at), end = start;
        for (let k = start; k < licSrc.length; k++) {
            if (licSrc[k] === '{') depth++;
            else if (licSrc[k] === '}') { depth--; if (!depth) { end = k; break; } }
        }
        return licSrc.slice(at, end + 1);
    })();
    ok('ស្រង់ fetchWithBodyTimeout ពិតចេញពី license-verify.js បាន', !!licFn);
    if (licFn) {
        await page.evaluate('(function(){ const NET_TIMEOUT_MS = 700; ' + licFn +
            '; window.fetchWithBodyTimeout = fetchWithBodyTimeout; })()');
        const licBefore = abortedSockets;
        const licPartial = await page.evaluate(async (b) => {
            const t0 = Date.now();
            try {
                await fetchWithBodyTimeout(b + '/headers-only', (r) => r.json());
                return { rejected: false, ms: Date.now() - t0 };
            } catch (e) {
                return { rejected: true, ms: Date.now() - t0, name: String(e && e.name) };
            }
        }, base);
        ok('checkOnline៖ header មករួច តែតួមិនមក ➜ ឈប់ក្នុងពេលកំណត់ (មិនព្យួររហូត)',
            licPartial.rejected && licPartial.ms < 2500, licPartial);
        await page.waitForTimeout(400);
        ok('checkOnline៖ សំណើដែលព្យួរត្រូវ abort ពិត (មិនកកកុញ)',
            abortedSockets - licBefore >= 1, { licBefore, after: abortedSockets });
    }

    // ៥ — ការហៅជាបន្តបន្ទាប់ (ដូច retryAsync) មិនត្រូវបន្សល់សំណើរស់
    const before = abortedSockets;
    await page.evaluate(async (b) => {
        for (let i = 0; i < 3; i++) {
            try { await fetchWithTimeout(b + '/hang', {}, 400, 'R timed out', (r) => r.json()); } catch (e) {}
        }
    }, base);
    await page.waitForTimeout(500);
    ok('retry ៣ ដង ➜ សំណើចាស់ត្រូវ abort ទាំងអស់ (មិនជាន់គ្នា)',
        abortedSockets - before >= 3, { before, after: abortedSockets });

    await browser.close();
    server.close();
    process.exit(fail ? 1 : 0);
})().then(() => {}, (e) => { ok('ផ្នែក browser រត់ចប់ដោយគ្មានកំហុស harness', false, String(e && e.message || e)); process.exit(1); });

process.on('exit', () => {
    if (summaryPrinted) return;
    summaryPrinted = true;
    console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')' : '✅ ជោគជ័យ ' + pass));
});
