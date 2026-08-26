// ថ្នាក់កំហុស៖ វាលដែលអ្នកប្រើវាយ credential ចូល (PIN, ពាក្យសម្ងាត់, Secret, Activation Key)
// នៅសល់ក្នុង DOM ក្រោយចាកចេញ ➜ អ្នកដែលកាន់ឧបករណ៍តទៅអានវាបាន។
// PIN មិនត្រឹមតែជា gate ទេ — deriveLookupSecretKey(pin) យកវាធ្វើកូនសោ AES
// ដែលឌិគ្រីប Secret របស់ Lookup API ដូច្នេះ PIN ដែលនៅសល់ = Secret ដែលនៅសល់។
//
// ច្បាប់៖ រាល់ <input type="password"> ក្នុង index.html ត្រូវត្រូវបានសម្អាត
//        នៅផ្លូវចាកចេញ (showLoginModalWithPrefill ➜ clearSensitiveModalFields
//        ឬការកំណត់ .value = '' ដោយផ្ទាល់)។
const fs = require('fs');
const path = require('path');

const ROOT = process.env.SECRET_APP_DIR || path.join(__dirname, '..');
const APPS = ['ZoeW', 'ZoeKeyGen'];

// ធាតុនីមួយៗត្រូវមានហេតុផលសរសេរជាប់ — ធាតុគ្មានហេតុផលនឹងលាក់ការលេចធ្លាយបន្ទាប់។
const ACCEPTED = {
    ZoeW: {},
    ZoeKeyGen: {}
};

let pass = 0;
let fail = 0;
function ok(label, cond, detail) {
    if (cond) { console.log('  ok    ' + label); pass++; }
    else { console.log('  FAIL  ' + label + (detail ? '\n        ' + detail : '')); fail++; }
}

function logoutClearedIds(src) {
    const cleared = new Set();

    // ១) បញ្ជី fieldsToBlank ក្នុង clearSensitiveModalFields
    const listMatch = src.match(/const fieldsToBlank = \[([\s\S]*?)\]/);
    if (listMatch) {
        (listMatch[1].match(/'([^']+)'/g) || []).forEach((q) => cleared.add(q.slice(1, -1)));
    }

    // ២) ការសម្អាតដោយផ្ទាល់ក្នុង showLoginModalWithPrefill / clearSensitiveModalFields / clearSigningKey
    ['showLoginModalWithPrefill', 'clearSensitiveModalFields', 'clearSigningKey'].forEach((fnName) => {
        const start = src.indexOf('function ' + fnName + '(');
        if (start === -1) return;
        let depth = 0, started = false, i = src.indexOf('{', start);
        for (; i < src.length; i++) {
            if (src[i] === '{') { depth++; started = true; }
            else if (src[i] === '}') { depth--; if (started && depth === 0) { i++; break; } }
        }
        const body = src.slice(start, i);
        // getElementById('x') ... .value = ''
        (body.match(/getElementById\('([^']+)'\)/g) || []).forEach((m) => {
            const id = m.slice(m.indexOf("'") + 1, m.lastIndexOf("'"));
            if (/\.value = ''/.test(body) || /\.innerHTML = ''/.test(body) || /\.textContent = ''/.test(body)) cleared.add(id);
        });
        // បញ្ជីខ្លីៗ ['a', 'b'].forEach(...)
        (body.match(/\[([^\]]*)\]\.forEach\(\(id\)/g) || []).forEach((m) => {
            (m.match(/'([^']+)'/g) || []).forEach((q) => cleared.add(q.slice(1, -1)));
        });
    });

    return cleared;
}

for (const app of APPS) {
    const htmlPath = path.join(ROOT, app, 'index.html');
    const jsPath = path.join(ROOT, app, 'app.js');
    if (!fs.existsSync(htmlPath) || !fs.existsSync(jsPath)) continue;
    console.log('\n=== ' + app + ' ===');
    const html = fs.readFileSync(htmlPath, 'utf8');
    const src = fs.readFileSync(jsPath, 'utf8');
    const accepted = ACCEPTED[app] || {};

    const passwordIds = [];
    (html.match(/<(?:input|textarea)\b[^>]*>/g) || []).forEach((tag) => {
        if (!/type="password"/.test(tag)) return;
        const id = (tag.match(/id="([^"]+)"/) || [])[1];
        if (id) passwordIds.push(id);
    });

    ok('រកឃើញវាល credential ក្នុង index.html', passwordIds.length > 0, 'passwordIds=' + JSON.stringify(passwordIds));

    const cleared = logoutClearedIds(src);
    passwordIds.forEach((id) => {
        if (accepted[id]) { console.log('  ok    ' + id + ' — ទទួលយក: ' + accepted[id]); pass++; return; }
        ok(id + ' ត្រូវបានសម្អាតនៅផ្លូវចាកចេញ', cleared.has(id),
            'មិនឃើញ ' + id + ' ក្នុង clearSensitiveModalFields/showLoginModalWithPrefill/clearSigningKey');
    });

    // Secret មិនត្រូវចេញតាម console ឬ Sentry
    const leaky = [];
    const patterns = [
        /console\.\w+\([^)]*\b(pin|pinVal|enteredPin|password|privateKeyJwk|signingPrivateKeyJwk|lookupSecretKey|decrypted|headerValue)\b/gi,
        /ZoeErrors\.capture\([^)]*\b(pin|pinVal|enteredPin|password|privateKeyJwk|signingPrivateKeyJwk|lookupSecretKey|decrypted|headerValue)\b/gi
    ];
    patterns.forEach((re) => {
        let m;
        while ((m = re.exec(src)) !== null) {
            leaky.push(src.slice(m.index, m.index + 90).split('\n')[0]);
        }
    });
    ok('គ្មាន secret ចេញតាម console/Sentry', leaky.length === 0, leaky.join('\n        '));
}

// ការលាក់ secret មុនផ្ញើទៅ Sentry — រត់កូដពិតចេញពី error-reporting.js
console.log('\n=== ការលាក់ secret មុនផ្ញើទៅ Sentry ===');
(function () {
    const vm = require('vm');
    const file = path.join(ROOT, 'ZoeW', 'error-reporting.js');
    if (!fs.existsSync(file)) { ok('រកឃើញ error-reporting.js', false); return; }
    const src = fs.readFileSync(file, 'utf8');
    const sandbox = {
        document: { createElement: () => ({}), head: { appendChild() {} } },
        localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        console: { error() {} }
    };
    vm.createContext(sandbox);
    try {
        vm.runInContext(src.replace('})(window);', '})(this);'), sandbox);
    } catch (e) {
        ok('ផ្ទុក error-reporting.js បាន', false, String(e && e.message));
        return;
    }
    const api = sandbox.ZoeErrors;
    ok('ZoeErrors បង្ហាញ redactUrl សម្រាប់តេស្ត', !!(api && typeof api.redactUrl === 'function'));
    if (!api || typeof api.redactUrl !== 'function') return;
    const redact = api.redactUrl;

    const leaks = [
        ['https://zoew.app/?setup=eyJhcGlLZXkiOiJBSXphU3lCIn0', 'eyJhcGlLZXkiOiJBSXphU3lCIn0', 'Setup Link (Firebase Config ទាំងមូល)'],
        ['https://x.firebaseio.com/p.json?auth=eyJhbGciOiJSUzI1NiJ9', 'eyJhbGciOiJSUzI1NiJ9', 'Firebase auth token'],
        ['https://api.example.com/v1?api_key=SUPERSECRET&list=1', 'SUPERSECRET', 'api_key ក្នុង URL'],
        ['https://api.example.com/v1?secret=SHHH', 'SHHH', 'secret ក្នុង URL'],
        ['Failed to fetch https://x.app/?token=TOKVAL', 'TOKVAL', 'token ក្នុងសារ error'],
        ['https://zoew.app/#setup=eyJhcGlLZXkiOiJIQVNIIn0', 'eyJhcGlLZXkiOiJIQVNIIn0', 'Setup Link ក្នុង fragment'],
        ['password=hunter2 នៅក្នុង log', 'hunter2', 'password= ទទេៗក្នុង log']
    ];
    leaks.forEach(([input, secret, label]) => {
        const out = redact(input);
        ok('លាក់៖ ' + label, out.indexOf(secret) === -1, 'got: ' + out);
    });

    // ⚠️ ជុំ 2.17.5 ៖ ការផ្គូផ្គងឈ្មោះ param ធ្លាប់ជា **ការប្រៀបធៀបពិតប្រាកដ**
    // នៅព្រំដែន `?`/`&`/`#` ➜ ទម្រង់ camelCase និង hyphen រអិលកាត់ទាំងស្រុង។
    // វាស់បាន ៖ `sessionToken=` · `clientSecret=` · `X-Api-Key=` · `pin=`
    // **មិនត្រូវលាក់សោះ**។ ឥឡូវ `isSecretParamName()` បំបែកឈ្មោះនៅព្រំដែន
    // camelCase និង `_ - .` រួចប្រៀបធៀបជា **សមាសភាគដាច់ដោយឡែក** ➜ វាចាប់
    // ទម្រង់ទាំងនោះ ដោយ **មិនចាប់** `spinner=` (`s|pin|ner` — គ្មានព្រំដែន),
    // `design=` (`de|sig|n`), `keyboard=` (`key|board`) ។ល។
    const camelLeaks = [
        ['https://a/?sessionToken=SEC', 'SEC', 'sessionToken (camelCase)'],
        ['https://a/?clientSecret=SEC', 'SEC', 'clientSecret (camelCase)'],
        ['https://a/?X-Api-Key=SEC', 'SEC', 'X-Api-Key (hyphen)'],
        ['https://a/?authorization=SEC', 'SEC', 'authorization'],
        ['https://a/?pin=SEC', 'SEC', 'pin'],
        ['https://a/?jwt=SEC', 'SEC', 'jwt'],
        ['https://a/?bearer=SEC', 'SEC', 'bearer'],
        // Apps Script deployment ID ជា **capability URL** — អ្នកណាមានវា ហៅ API បាន
        ['https://script.google.com/macros/s/DEPLOY_ID_SECRET/exec', 'DEPLOY_ID_SECRET', 'Apps Script deployment ID']
    ];
    camelLeaks.forEach(([input, secret, label]) => {
        ok('លាក់៖ ' + label, redact(input).indexOf(secret) === -1, 'got: ' + redact(input));
    });

    // ⛔ ការពង្រីកខាងលើ **មិនត្រូវលាក់លើស** — ធាតុទាំងនេះត្រូវការសម្រាប់ debug
    const noOverRedact = ['https://a/?spinner=fast', 'https://a/?design=blue', 'https://a/?mapping=x',
        'https://a/?locker=A12', 'https://a/?phone=0974158508', 'https://a/?keyboard=on'];
    noOverRedact.forEach((input) => {
        ok('មិនលាក់លើស៖ ' + input.slice(input.indexOf('?')), redact(input) === input, 'got: ' + redact(input));
    });

    const keep = [
        ['https://zoew.app/?list=1&barcode=ZTO900', 'ZTO900', 'barcode មិនត្រូវលាក់ (ត្រូវការសម្រាប់ debug)'],
        ['zoew_scan_history_cod_dod/id_123_abc timed out', 'id_123_abc', 'លេខសម្គាល់ធាតុនៅដដែល']
    ];
    keep.forEach(([input, kept, label]) => {
        const out = redact(input);
        ok('រក្សាទុក៖ ' + label, out.indexOf(kept) !== -1, 'got: ' + out);
    });

    // ⛔ **ចន្លោះដែលធ្លាក់មុននេះ៖** ផ្នែកខាងលើសាកតែ `redactUrl()` ដែលជា
    // function លើ **ខ្សែអក្សរតែមួយ**។ អ្វីដែលសំខាន់ជាងគឺ **ការដើរលើ event**
    // — `redactEvent()` / `redactBreadcrumb()` ធ្លាប់ប៉ះតែវាលមួយចំនួន
    // ដែលដាក់ឈ្មោះទុកជាមុន (`request.url`, `data.url`, `message`, `extra` ថ្នាក់ទី ១)
    // ➜ វាលផ្សេងទៀតដែល Sentry SDK បំពេញ **រអិលកាត់ស្ងាត់ៗ**។ វាស់បាន ៥ ផ្លូវ៖
    //   ១. `crumb.data.arguments` — Sentry 7 រក្សា argument **ឆៅ** របស់
    //      `console.error(...)`។ App ហៅ `console.error("Lookup API error:", e)`
    //      ➜ URL ដែលមាន secret ចេញទៅក្រៅដោយមិនលាក់។
    //   ២. `request.headers.Referer` — integration `HttpContext` បំពេញវា
    //      ➜ **Setup Link (`?setup=<config អាជីវកម្ម>`) អាចចេញពីឧបករណ៍**។
    //   ៣–៥. `extra` ជាន់ជ្រៅ, array ក្នុង `extra`, និង `contexts`។
    // ដំណោះស្រាយ៖ ដើរ **គ្រប់ខ្សែអក្សរ** ជាមួយពិដានជម្រៅ/ចំនួន node និង
    // ការការពាររង្វិលជុំ — មិនមែនបញ្ជីវាលដែលដាក់ឈ្មោះទុកជាមុនទេ។
    (function deepRedaction() {
        let captured = null;
        const win = {
            localStorage: { _d: { zoe_sentry_dsn: 'https://k@o.ingest.sentry.io/1' },
                getItem(k) { return this._d[k] || null; }, setItem(k, v) { this._d[k] = v; }, removeItem(k) { delete this._d[k]; } },
            document: { createElement: () => ({ set onload(v) {}, set onerror(v) {} }), head: { appendChild() {} } },
            // `onLoad(cb)` ដែលហៅ cb ភ្លាម ➜ `tagApp()` ហៅ `Sentry.init(guardedOptions(…))`
            // **ដោយសមកាលកម្ម** ➜ យើងចាប់ `beforeSend`/`beforeBreadcrumb` ពិតបាន
            // ដោយមិនចាំបាច់រង់ចាំផ្លូវ async របស់ `init()` (ដែលធ្វើឲ្យតេស្តនេះ
            // ត្រូវក្លាយជា async ទាំងឯកសារ)។
            Sentry: { init: (o) => { captured = o; }, setTag() {}, captureException() {}, onLoad: (cb) => cb() },
            console: console, setTimeout: setTimeout, clearTimeout: clearTimeout, Set: Set
        };
        win.window = win;
        vm.createContext(win);
        try { vm.runInContext(src, win); } catch (e) { ok('ផ្ទុក error-reporting.js ក្នុង sandbox បាន', false, String(e && e.message)); return; }
        win.ZoeErrors.init('zoew', 'test');
        if (!captured) { ok('ចាប់ options របស់ Sentry.init() បាន', false); return; }
        ok('ចាប់ options របស់ Sentry.init() បាន', true);

        const SECRET = 'https://api.example.com/lookup?apikey=SUPERSECRET123&id=5';
        const SETUP = 'https://zoew.app/?setup=BASE64CONFIGPAYLOAD';
        const crumb = captured.beforeBreadcrumb({
            category: 'console', level: 'error', message: 'Lookup API error: ' + SECRET,
            data: { arguments: ['Lookup API error:', SECRET], logger: 'console' }
        });
        const ev = captured.beforeSend({
            request: { url: SETUP, headers: { Referer: SETUP, 'User-Agent': 'x' } },
            extra: { nested: { url: SECRET }, list: [SECRET] },
            contexts: { app: { detail: SECRET } },
            exception: { values: [{ value: 'boom ' + SECRET }] }
        });
        const clean = (label, val, secret) => ok('លាក់ជ្រៅ៖ ' + label,
            typeof val === 'string' && val.indexOf(secret) === -1, 'got: ' + val);

        clean('crumb.message', crumb.message, 'SUPERSECRET123');
        clean('crumb.data.arguments[] (console breadcrumb ឆៅ)', crumb.data.arguments[1], 'SUPERSECRET123');
        clean('request.url', ev.request.url, 'BASE64CONFIGPAYLOAD');
        clean('request.headers.Referer (Setup Link)', ev.request.headers.Referer, 'BASE64CONFIGPAYLOAD');
        clean('extra ជាន់ជ្រៅ', ev.extra.nested.url, 'SUPERSECRET123');
        clean('array ក្នុង extra', ev.extra.list[0], 'SUPERSECRET123');
        clean('contexts', ev.contexts.app.detail, 'SUPERSECRET123');
        clean('exception.values[].value', ev.exception.values[0].value, 'SUPERSECRET123');

        // រង្វិលជុំមិនត្រូវធ្វើឲ្យ beforeSend គាំង (event ពិតអាចមាន reference ជុំ)
        const cyc = { a: 'x?token=T1' };
        cyc.self = cyc;
        let survived = true;
        try { captured.beforeSend(cyc); } catch (e) { survived = false; }
        ok('event ដែលមាន reference ជុំ មិនធ្វើឲ្យ beforeSend គាំង', survived);
        ok('event ដែលមាន reference ជុំ នៅតែត្រូវលាក់', survived && cyc.a.indexOf('T1') === -1, cyc.a);

        // userinfo ក្នុង URL (https://user:pass@host)
        ok('លាក់៖ userinfo ក្នុង URL',
            win.ZoeErrors.redactUrl('https://user:hunter2@host/x').indexOf('hunter2') === -1);
        // ⚠️ ការដើរជ្រៅមិនត្រូវលាក់អ្វីដែលត្រូវការសម្រាប់ debug
        const keepEv = captured.beforeSend({ extra: { deep: { barcode: 'ZTO900', id: 'id_123_abc' } } });
        ok('រក្សាទុក៖ barcode/id ក្នុងវាលជ្រៅ',
            keepEv.extra.deep.barcode === 'ZTO900' && keepEv.extra.deep.id === 'id_123_abc');
    })();

    ok('beforeSend ត្រូវបានភ្ជាប់ (មិនត្រឹមតែ beforeBreadcrumb)', /beforeSend:\s*redactEvent/.test(src));
    ok('Sentry loader script ក៏ទទួលការលាក់ដែរ (Sentry.onLoad ➜ Sentry.init)',
        /onLoad\(\(\) => \{[\s\S]*Sentry\.init\(guardedOptions/.test(src));
    ok('sendDefaultPii បិទ', /sendDefaultPii:\s*false/.test(src));
})();

console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')' : '✅ ជោគជ័យ ' + pass));
process.exit(fail ? 1 : 0);
