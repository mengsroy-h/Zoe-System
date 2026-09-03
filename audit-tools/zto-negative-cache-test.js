// ⛔⛔ ថ្នាក់កំហុស៖ **សាលក្រម «រកមិនឃើញ» មិនចូល cache ➜ ការស្កេនដដែល
// បង់ថ្លៃបណ្តាញពេញម្តងទៀត។**
//
// `zto-order-detail.js` cache តែលទ្ធផល `ok` ប៉ុណ្ណោះ។ សាលក្រម `notFound`
// ត្រឡប់ចេញ **ដោយមិនចាក់ចូល `resultCache` សោះ** ➜ រាល់ការស្កេន barcode
// ដដែលដែល ZTO មិនស្គាល់ បាញ់សំណើ upstream ថ្មីរាល់ដង។
//
// ⛔ **វាជាផ្លូវយឺតបំផុត មិនមែនផ្លូវកម្រទេ** ៖ កញ្ចប់ដែល ZTO មិនទាន់
// បញ្ចូល (មិនទាន់ធ្វើ Arrival Scan) ជា **ករណីធម្មតាបំផុត** នៅកម្ពុជា ហើយ
// អ្នកប្រើតែងតែស្កេនម្តងទៀត ព្រោះលទ្ធផលទទេមើលទៅដូចកំហុស។ ខាង client
// **គ្មាន cooldown សម្រាប់ `found:false`** ដោយចេតនា (មេរៀន 2.25.0 ៖
// «រកមិនឃើញ» ≠ កំហុស) ➜ គ្មានអ្វីទប់ការស្កេនម្តងទៀតភ្លាមៗឡើយ។
//
// **វាស់បានលើ `origin/main` (2026-09-03)** ដោយ upstream យឺត ៤០០ ms៖
//
//   | លំដាប់ស្កេន | ការហៅ upstream | ពេលសរុប |
//   |---|---|---|
//   | ៥ ស្កេន / barcode មិនស្គាល់ ២ | **៥** | **២,០១១ ms** |
//   | ដដែល ជាមួយ negative cache | ២ | ~៨០០ ms |
//
// ⛔ **មូលហេតុដែល checker ១២៩ បៃតងទាំងអស់** ៖ `zto-proxy-test.js` វាស់
// *អត្តសញ្ញាណ* នៃសាលក្រម (កូដត្រឹមត្រូវឬអត់) ហើយ `zto-budget-test.js`
// វាស់ *ថវិកាពេល* — **គ្មានមួយណាស្កេន barcode ដដែល ២ ដងហើយរាប់ការហៅ
// upstream សម្រាប់ផ្លូវ `notFound` សោះ**។ ផ្លូវ `ok` ត្រូវបានវាស់រួច
// (`cached: true`) ➜ ការគ្របនោះ **បិទបាំង** ថាបងប្អូនរបស់វាមិនត្រូវបាន
// គ្រប។ នេះជា **សំណួរទី ៨** ក្នុងទម្រង់ថ្មី ៖ checker ដាក់ប្រព័ន្ធក្នុង
// ស្ថានភាព «រកឃើញ» ជានិច្ច ➜ ស្ថានភាព «រកមិនឃើញ» គ្មានអ្នកវាស់។
//
// ច្បាប់ដែលឯកសារនេះចាក់សោ៖
//   ១. ជាន់អប្បបរមា — Function មានស្រាប់ ហើយ export អ្វីដែលតេស្តត្រូវការ។
//   ២. `notFound` ដដែល ➜ ការហៅ upstream **១ ដងគត់** ក្នុងបង្អួច TTL។
//   ៣. ⛔ ទិសផ្ទុយ ៖ TTL អវិជ្ជមានផុត ➜ ត្រូវសួរ upstream ម្តងទៀត
//      (cache មិនត្រូវក្លាយជាការបដិសេធជាអចិន្ត្រៃយ៍)។
//   ៤. ⛔ ទិសផ្ទុយ ៖ `ZTO_NOT_FOUND_CACHE_TTL_MS=0` ➜ បិទទាំងស្រុង។
//   ៥. ⛔ ទិសផ្ទុយ ៖ `ZTO_CACHE_TTL_MS=0` ➜ បិទ **ទាំង ២** ផ្លូវ។
//   ៦. ⛔ barcode ផ្សេង នៅតែឆ្លងបណ្តាញដដែល (cache មិនឆ្លើយជំនួសគ្នា)។
//   ៧. ⛔ សាលក្រម `notFound` ដែល cache ត្រូវរក្សា **រូបរាងដដែល**
//      (`found:false` · គ្មានវាល `error` — បើមិនដូច្នេះ client បោះ
//      «Lookup rejected» ➜ cooldown ៣០ វិ. — មេរៀន 2.25.0)។
//   ៨. ⛔ ការបរាជ័យបណ្តោះអាសន្ន (timeout · 5xx · 401) **មិនត្រូវចូល cache**
//      — បើចូល នោះ Cookie ថ្មីដែល helper ទើបសរសេរ ត្រូវរង់ចាំ TTL។
//   ៩. `?diag=1` ត្រូវរាយ TTL អវិជ្ជមាន ដើម្បីឲ្យម្ចាស់ផ្ទៀងផ្ទាត់បាន។
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = process.env.ZTONEG_APP_DIR ? path.resolve(process.env.ZTONEG_APP_DIR) : path.join(__dirname, '..');
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
ok('ជាន់អប្បបរមា៖ Function មានផ្លូវ cache', SRC.indexOf('resultCache') !== -1 && SRC.indexOf('ZTO_CACHE_TTL_MS') !== -1);
ok('ជាន់អប្បបរមា៖ Function មានសាលក្រម notFound', SRC.indexOf('ZTO_NOT_FOUND') !== -1);

let mod = null;
try {
    mod = require(FN_PATH);
} catch (e) {
    ok('ផ្ទុក Function បាន', false, e.message);
}
if (!mod || typeof mod.handler !== 'function' || typeof mod.resetCachesForTests !== 'function' || typeof mod.setBlobsModuleForTests !== 'function') {
    console.log('  FAIL   Function មិន export `handler` / `resetCachesForTests` / `setBlobsModuleForTests`');
    console.log('\n❌ ធ្លាក់ ' + (fail + 1));
    process.exit(1);
}

const PROXY_KEY = 'n'.repeat(24);
const GOOD_COOKIE = 'BOS-MAN-SESSION=' + 'c'.repeat(48);

function fakeBlobs() {
    return {
        connectLambda() {},
        getStore() { return { get: async () => '', set: async () => {} }; }
    };
}

let barcodeSeq = 0;
function nextBarcode() {
    barcodeSeq++;
    return 'ZTONEG' + String(barcodeSeq).padStart(5, '0');
}

function makeEvent(query) {
    return {
        httpMethod: 'GET',
        headers: { 'x-zoe-proxy-key': PROXY_KEY },
        queryStringParameters: query,
        blobs: 'test-context'
    };
}

// ⛔ `mode` ជាវត្ថុរស់ ➜ សេណារីយ៉ូអាចប្តូរឥរិយាបថ upstream **កណ្តាលផ្លូវ**
// ដើម្បីវាស់ថា cache ពិតជាឆ្លើយ (មិនមែន upstream ឆ្លើយដដែល)។
function installUpstream(state, mode) {
    global.fetch = async function fakeFetch() {
        state.calls++;
        if (mode.kind === 'hang') return new Promise(() => {});
        if (mode.kind === 'http') {
            return {
                status: mode.status, ok: mode.status >= 200 && mode.status < 300,
                headers: { get: () => 'application/json', getSetCookie: () => [] },
                json: async () => (mode.body || {})
            };
        }
        return {
            status: 200, ok: true,
            headers: {
                get: (name) => (String(name).toLowerCase() === 'content-type' ? 'application/json' : null),
                getSetCookie: () => []
            },
            // `data: null` ជា envelope ជោគជ័យដែលគ្មានការបញ្ជាទិញ ➜ notFound
            json: async () => (mode.kind === 'found'
                ? { code: '0', data: { consigneePhone: '012345678', agentAmount: 5, arrivalServiceCharge: 1.5 } }
                : { code: '0', data: null })
        };
    };
}

function resetEnv(extra) {
    process.env.ZTO_PROXY_KEY = PROXY_KEY;
    process.env.ZTO_COOKIE = GOOD_COOKIE;
    delete process.env.ZTO_AUTHORIZATION;
    delete process.env.ZTO_TOKEN;
    delete process.env.ZTO_CACHE_TTL_MS;
    delete process.env.ZTO_NOT_FOUND_CACHE_TTL_MS;
    Object.keys(extra || {}).forEach((k) => { process.env[k] = String(extra[k]); });
    mod.resetCachesForTests();
    mod.setBlobsModuleForTests(fakeBlobs());
}

function body(res) {
    try { return JSON.parse(res.body); } catch (_) { return null; }
}

(async () => {
    // ═══ ២. notFound ដដែល ➜ upstream ១ ដងគត់ ══════════════════════════
    {
        resetEnv();
        const state = { calls: 0 };
        installUpstream(state, { kind: 'notFound' });
        const bc = nextBarcode();
        const r1 = body(await mod.handler(makeEvent({ barcode: bc })));
        const r2 = body(await mod.handler(makeEvent({ barcode: bc })));
        const r3 = body(await mod.handler(makeEvent({ barcode: bc })));
        ok('notFound ដដែល ៣ ដង ➜ upstream ១ ដងគត់', state.calls === 1, { calls: state.calls });
        ok('notFound ទី ១ រូបរាងត្រឹមត្រូវ',
            !!(r1 && r1.found === false && r1.code === 'ZTO_NOT_FOUND' && r1.error === undefined), r1);
        // ⛔ ច្បាប់ទី ៧ ៖ ចម្លើយពី cache ត្រូវរក្សារូបរាងដដែល បើមិនដូច្នេះ
        // client បោះ «Lookup rejected» ➜ cooldown ៣០ វិ.
        ok('notFound ពី cache រក្សារូបរាងដដែល (គ្មាន `error`)',
            !!(r2 && r2.found === false && r2.code === 'ZTO_NOT_FOUND' && r2.error === undefined), r2);
        ok('notFound ពី cache សម្គាល់ខ្លួនថា cached', !!(r2 && r2.cached === true), r2);
        ok('notFound ទី ៣ ក៏មកពី cache ដែរ', !!(r3 && r3.cached === true), r3);
    }

    // ═══ ៦. barcode ផ្សេង នៅតែឆ្លងបណ្តាញ ═══════════════════════════════
    {
        resetEnv();
        const state = { calls: 0 };
        installUpstream(state, { kind: 'notFound' });
        const a = nextBarcode(), b = nextBarcode();
        await mod.handler(makeEvent({ barcode: a }));
        await mod.handler(makeEvent({ barcode: b }));
        await mod.handler(makeEvent({ barcode: a }));
        ok('barcode ២ ផ្សេងគ្នា ➜ upstream ២ ដង (cache មិនឆ្លើយជំនួសគ្នា)',
            state.calls === 2, { calls: state.calls });
    }

    // ═══ ៣. ⛔ ទិសផ្ទុយ ៖ TTL ផុត ➜ សួរ upstream ម្តងទៀត ════════════════
    {
        resetEnv({ ZTO_NOT_FOUND_CACHE_TTL_MS: 60 });
        const state = { calls: 0 };
        installUpstream(state, { kind: 'notFound' });
        const bc = nextBarcode();
        await mod.handler(makeEvent({ barcode: bc }));
        await mod.handler(makeEvent({ barcode: bc }));
        const beforeExpiry = state.calls;
        await new Promise((r) => setTimeout(r, 130));
        // ⛔ ការវាស់ដ៏សំខាន់ ៖ ក្រោយ TTL ផុត កញ្ចប់ដដែលដែល ZTO **ទើប
        // បញ្ចូល** ត្រូវរកឃើញ — cache មិនត្រូវជាការបដិសេធជាអចិន្ត្រៃយ៍។
        installUpstream(state, { kind: 'found' });
        const after = body(await mod.handler(makeEvent({ barcode: bc })));
        ok('ក្នុង TTL ➜ upstream ១ ដងគត់', beforeExpiry === 1, { calls: beforeExpiry });
        ok('ក្រោយ TTL ផុត ➜ សួរ upstream ម្តងទៀត', state.calls === 2, { calls: state.calls });
        ok('ក្រោយ TTL ផុត ➜ កញ្ចប់ដែល ZTO ទើបបញ្ចូល ត្រូវរកឃើញ',
            !!(after && after.found === true && after.phone === '012345678'), after);
    }

    // ═══ ៤. ⛔ ទិសផ្ទុយ ៖ ZTO_NOT_FOUND_CACHE_TTL_MS=0 ➜ បិទទាំងស្រុង ═══
    {
        resetEnv({ ZTO_NOT_FOUND_CACHE_TTL_MS: 0 });
        const state = { calls: 0 };
        installUpstream(state, { kind: 'notFound' });
        const bc = nextBarcode();
        await mod.handler(makeEvent({ barcode: bc }));
        const r2 = body(await mod.handler(makeEvent({ barcode: bc })));
        ok('TTL អវិជ្ជមាន = 0 ➜ បិទ (upstream ២ ដង)', state.calls === 2, { calls: state.calls });
        ok('TTL អវិជ្ជមាន = 0 ➜ ចម្លើយមិនមែនពី cache', !!(r2 && r2.cached !== true), r2);
    }

    // ═══ ៥. ⛔ ទិសផ្ទុយ ៖ ZTO_CACHE_TTL_MS=0 ➜ បិទ **ទាំង ២** ផ្លូវ ═════
    {
        resetEnv({ ZTO_CACHE_TTL_MS: 0 });
        const state = { calls: 0 };
        installUpstream(state, { kind: 'notFound' });
        const bc = nextBarcode();
        await mod.handler(makeEvent({ barcode: bc }));
        await mod.handler(makeEvent({ barcode: bc }));
        ok('cache សរុប = 0 ➜ notFound ក៏មិន cache ដែរ', state.calls === 2, { calls: state.calls });

        const state2 = { calls: 0 };
        installUpstream(state2, { kind: 'found' });
        const bc2 = nextBarcode();
        await mod.handler(makeEvent({ barcode: bc2 }));
        await mod.handler(makeEvent({ barcode: bc2 }));
        ok('cache សរុប = 0 ➜ ផ្លូវ ok ក៏មិន cache ដែរ (ទិសផ្ទុយចាស់នៅដដែល)',
            state2.calls === 2, { calls: state2.calls });
    }

    // ═══ ទិសផ្ទុយ ៖ ផ្លូវ `ok` នៅតែ cache ដដែល ═════════════════════════
    {
        resetEnv();
        const state = { calls: 0 };
        installUpstream(state, { kind: 'found' });
        const bc = nextBarcode();
        const r1 = body(await mod.handler(makeEvent({ barcode: bc })));
        const r2 = body(await mod.handler(makeEvent({ barcode: bc })));
        ok('ផ្លូវ ok នៅតែ cache ដដែល (upstream ១ ដង)', state.calls === 1, { calls: state.calls });
        ok('ផ្លូវ ok ៖ ចម្លើយទី ១ មិនមែន cache', !!(r1 && r1.cached === false), r1);
        ok('ផ្លូវ ok ៖ ចម្លើយទី ២ មកពី cache', !!(r2 && r2.cached === true && r2.phone === '012345678'), r2);
    }

    // ═══ ៨. ⛔ ការបរាជ័យបណ្តោះអាសន្ន មិនត្រូវចូល cache ═══════════════════
    // បើវាចូល នោះ Cookie ថ្មីដែល helper ទើបសរសេរ ត្រូវរង់ចាំ TTL មុនដើរ។
    {
        const cases = [
            { label: '401 (Cookie ផុតកំណត់)', mode: { kind: 'http', status: 401, body: { code: '401', message: 'not login' } } },
            { label: '500 (upstream ដួល)', mode: { kind: 'http', status: 500, body: {} } },
            { label: '429 (កំណត់ល្បឿន)', mode: { kind: 'http', status: 429, body: {} } }
        ];
        for (const c of cases) {
            resetEnv();
            const state = { calls: 0 };
            installUpstream(state, c.mode);
            const bc = nextBarcode();
            await mod.handler(makeEvent({ barcode: bc }));
            const before = state.calls;
            // ⛔ ស្ថានភាពជាសះស្បើយ ៖ Cookie ថ្មី / upstream ត្រឡប់មកវិញ
            installUpstream(state, { kind: 'found' });
            const r = body(await mod.handler(makeEvent({ barcode: bc })));
            ok('ការបរាជ័យ ' + c.label + ' មិនចូល cache ➜ ការសាកបន្ទាប់ជោគជ័យ',
                state.calls > before && !!(r && r.found === true), { calls: state.calls, before, r });
        }
    }

    // ═══ ៩. `?diag=1` រាយ TTL អវិជ្ជមាន ════════════════════════════════
    {
        resetEnv();
        const state = { calls: 0 };
        installUpstream(state, { kind: 'notFound' });
        const d = body(await mod.handler(makeEvent({ diag: '1' })));
        ok('?diag=1 រាយ notFoundCacheTtlMs',
            !!(d && d.timing && typeof d.timing.notFoundCacheTtlMs === 'number'), d && d.timing);
        ok('?diag=1 មិនបញ្ចេញតម្លៃ Cookie',
            JSON.stringify(d || {}).indexOf('c'.repeat(48)) === -1);
    }

    // ═══ ១០. ស្នាមភ្ជាប់ ៖ ឯកសារកែសម្រួល ↔ លេខលំនាំដើមពិត ═════════════
    // 🔴 **រកឃើញពិត (2026-09-03)** ៖ `ZTO-SETUP-KH.md` នៅរាយ
    // `ZTO_UPSTREAM_TIMEOUT_MS = 8000` និង `ZTO_REQUEST_BUDGET_MS = 14000`
    // ខណៈកំណែ 2.25.8 បានបន្ថយវាទៅ ៦០០០/៩០០០ **ដើម្បីកុំឲ្យលើសពិដាន
    // ១០ វិនាទីរបស់ Netlify**។ ម្ចាស់ដែលអានតារាងនោះ រួចដាក់ `14000` ចូល env
    // ដោយជឿថាជាលំនាំដើម នឹង **បង្កើតកំហុស 2.24.6 ឡើងវិញ** ➜ `Failed to fetch`។
    // ⛔ នេះជា **សំណួរទី ៧ (ស្នាមភ្ជាប់)** ៖ Function ត្រូវបានចាក់សោ,
    // ឯកសារត្រូវបានសរសេរ — តែ **គ្មានឧបករណ៍ណាសួរថាទាំង ២ និយាយរឿងដដែលទេ**។
    {
        const DOC_PATH = path.join(ROOT, 'ZoeW', 'ZTO-SETUP-KH.md');
        let doc = '';
        try { doc = fs.readFileSync(DOC_PATH, 'utf8'); } catch (_) { doc = ''; }
        ok('ជាន់អប្បបរមា៖ អាន ZTO-SETUP-KH.md បាន និងមានតារាងកែសម្រួល',
            doc.length > 2000 && doc.indexOf('ZTO_CACHE_TTL_MS') !== -1);

        // អានលំនាំដើម **ចេញពី Function ពិត** មិនមែនចាក់ literal ក្នុង checker
        // (មេរៀន 2.25.5 ៖ literal ក្នុង checker ចាក់សោការសន្មតចាស់)។
        const KNOBS = ['ZTO_UPSTREAM_TIMEOUT_MS', 'ZTO_REQUEST_BUDGET_MS', 'ZTO_UPSTREAM_RETRIES', 'ZTO_CACHE_TTL_MS', 'ZTO_NOT_FOUND_CACHE_TTL_MS'];
        let checked = 0;
        KNOBS.forEach((knob) => {
            const code = SRC.match(new RegExp('boundedInteger\\(\\s*env\\.' + knob + '\\s*,\\s*([A-Za-z0-9_]+)'));
            if (!code) { ok('ស្នាមភ្ជាប់៖ រកលំនាំដើមរបស់ ' + knob + ' ក្នុង Function', false); return; }
            let codeDefault = code[1];
            if (!/^\d+$/.test(codeDefault)) {
                const named = SRC.match(new RegExp('const\\s+' + codeDefault + '\\s*=\\s*(\\d+)'));
                if (!named) { ok('ស្នាមភ្ជាប់៖ ដោះស្រាយថេរ ' + codeDefault, false); return; }
                codeDefault = named[1];
            }
            const row = doc.match(new RegExp('\\|\\s*`' + knob + '`\\s*\\|\\s*`(\\d+)`'));
            if (!row) { ok('ស្នាមភ្ជាប់៖ ឯកសាររាយ ' + knob, false, 'បាត់ជួរក្នុងតារាង'); return; }
            checked++;
            ok('ស្នាមភ្ជាប់៖ ' + knob + ' ឯកសារ = កូដ (' + codeDefault + ')',
                row[1] === codeDefault, { doc: row[1], code: codeDefault });
        });
        ok('ជាន់អប្បបរមា៖ ផ្គូផ្គងលេខលំនាំដើមយ៉ាងតិច ' + KNOBS.length + ' ធាតុ', checked === KNOBS.length, { checked });

        // ⛔ ថវិកាលំនាំដើមត្រូវសមក្នុងពិដាន Netlify (មេរៀន 2.25.8) — ការអះអាង
        // នេះវាស់ **កូដ** មិនមែនឯកសារ ➜ វាធ្លាក់ទោះឯកសារត្រូវសរសេរឡើងវិញ។
        const budget = SRC.match(/budgetMs:\s*boundedInteger\(env\.ZTO_REQUEST_BUDGET_MS,\s*(\d+)/);
        ok('ថវិកាលំនាំដើមសមក្នុងពិដាន Netlify ១០ វិ.',
            !!budget && Number(budget[1]) <= 10000, budget && budget[1]);

        // ⛔ ឯកសារក៏អះអាងអំពី **ពិដានខាង client** ដែរ ➜ លេខនោះត្រូវអាន
        // ចេញពី `ZoeW/app.js` ពិត។ វាឃ្លាតរួចម្តងក្នុងជុំ 2.25.8 (ឯកសារ
        // នៅរាយ ២០ វិ./១៨ វិ. ខណៈកូដជា ១៣/១១)។
        let APP = '';
        try { APP = fs.readFileSync(path.join(ROOT, 'ZoeW', 'app.js'), 'utf8'); } catch (_) { APP = ''; }
        ok('ជាន់អប្បបរមា៖ អាន ZoeW/app.js បាន', APP.length > 100000);
        [
            ['ZTO_AUTO_LOOKUP_TIMEOUT_MS', 'ស្កេន'],
            ['ZTO_TEST_TIMEOUT_MS', 'ប៊ូតុងសាកល្បង']
        ].forEach((pair) => {
            const m = APP.match(new RegExp('const\\s+' + pair[0] + '\\s*=\\s*(\\d+)'));
            if (!m) { ok('ស្នាមភ្ជាប់៖ រក ' + pair[0] + ' ក្នុង app.js', false); return; }
            const seconds = Number(m[1]) / 1000;
            // ឯកសារសរសេរជាលេខខ្មែរ ➜ បម្លែងមុនផ្គូផ្គង។ ⛔ ការផ្គូផ្គង
            // វាស់ **លេខ** មិនមែន **ការជ្រើសពាក្យ ឬសញ្ញា bold** ទេ (មេរៀន
            // 2026-09-02 ៖ ការអះអាងលើពាក្យ = ការធ្លាក់ក្លែងក្លាយរង់ចាំកើត)។
            const khmer = String(seconds).replace(/\d/g, (d) => '០១២៣៤៥៦៧៨៩'[Number(d)]);
            const re = new RegExp('(?:^|[^០-៩])' + khmer + '\\s*(?:\\*\\*)?\\s*វិនាទី');
            ok('ស្នាមភ្ជាប់៖ ឯកសាររាយពិដាន ' + pair[1] + ' = ' + seconds + ' វិនាទី',
                re.test(doc), { khmer });
        });

        // ⛔ ច្បាប់ដែល `zto-proxy-test` ចាក់សោ ៖ client >= server + ៣ វិ.
        const clientMs = APP.match(/const\s+ZTO_AUTO_LOOKUP_TIMEOUT_MS\s*=\s*(\d+)/);
        ok('ពិដាន client >= ថវិកា server + ៣ វិនាទី',
            !!(clientMs && budget) && Number(clientMs[1]) >= Number(budget[1]) + 3000,
            { client: clientMs && clientMs[1], budget: budget && budget[1] });
    }

    console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' (ok ' + pass + ')' : '✅ ' + pass + ' ok, 0 fail'));
    process.exit(fail ? 1 : 0);
})().catch((e) => {
    console.log('  FAIL   តេស្តខ្លួនឯងបោះកំហុស ➜ ' + (e && e.stack || e));
    process.exit(1);
});
