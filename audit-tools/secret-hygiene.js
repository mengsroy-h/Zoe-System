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
// ⚠️ App `ZoeImport` ត្រូវលុបចេញពី repo ក្នុងកំណែ 2.21.0 — មុខងារនាំចូល
// របស់វាផ្លាស់ចូល **ZoeW ផ្ទាល់**។ ដូច្នេះ **ពាក្យសម្ងាត់នាំចូល**
// (`sheetImportPassword`) និង **កូនសោ AES** (`sheetImportKey`) ព្រមទាំងវាល
// `siApiPasswordInput` ក្នុង DOM ឥឡូវរស់នៅក្នុង `ZoeW/app.js` ➜ ការស្កេន
// ZoeW គ្របពួកវារួចហើយ។ ⛔ កុំបន្ថយវិសាលភាពនៃឯកសារដែលស្កេន — នោះជាថ្នាក់
// «checker ស្កេនឯកសារណាខ្លះ» ដដែលនឹង 2.12.1 · 2.16.0 · 2.19.1។
const APPS = ['ZoeW', 'ZoeKeyGen'];

// ធាតុនីមួយៗត្រូវមានហេតុផលសរសេរជាប់ — ធាតុគ្មានហេតុផលនឹងលាក់ការលេចធ្លាយបន្ទាប់។
const ACCEPTED = {
    ZoeW: {},
    ZoeKeyGen: {}
};

function readRepoFile(rel) {
    try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch (e) { return ''; }
}

function readApp(appName) {
    return readRepoFile(path.join(appName, 'app.js'));
}

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
    //    ⛔ helper សម្អាតរបស់មុខងារមួយ (`sbAdminReset()` ៖ ផ្ទាំង Supabase ក្នុង ZoeKeyGen) រាប់ **តែពេល** showLoginModalWithPrefill ហៅវាពិត
    const fns = ['showLoginModalWithPrefill', 'clearSensitiveModalFields', 'clearSigningKey',
        'lockApp', 'resetSessionState', 'clearSensitiveFields'];
    const logoutAt = src.indexOf('function showLoginModalWithPrefill(');
    const logoutEnd = logoutAt === -1 ? -1 : src.indexOf('\n}', logoutAt);
    const logoutBody = logoutAt === -1 ? '' : src.slice(logoutAt, logoutEnd === -1 ? src.length : logoutEnd);
    ['sbAdminReset'].forEach((fn) => { if (new RegExp('\\b' + fn + '\\(').test(logoutBody)) fns.push(fn); });
    fns.forEach((fnName) => {
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

    // ⛔ **ការលាក់តាមឈ្មោះកូនសោវត្ថុ។** `redactDeep()` ធ្លាប់លាក់តែលំនាំ
    // `name=value` **ខាងក្នុងខ្សែអក្សរ** ➜ តម្លៃដែលអង្គុយក្រោមកូនសោសម្ងាត់
    // (`{ pin: '1234' }`, `{ apiKey: '…' }`) **រអិលកាត់ទាំងស្រុង**។ វាស់បាន៖
    // `redactUrl('1234')` ➜ `'1234'`។ ⚠️ អះអាង **២ ខាង** — ការលាក់ទូលាយពេក
    // នឹងលុប `keyId` · `barcode` · `itemId` ដែល **ត្រូវការសម្រាប់ debug**
    // (ច្បាប់ «keep case» ក្នុង CLAUDE.md)។
    if (typeof api.redactEvent === 'function') {
        const ev = {
            extra: { pin: '1234', apiKey: 'sk-live-abc', sessionToken: 'ST', password: 'p',
                     note: 'ok', keyId: 'K1', barcode: 'ABC123', itemId: 'id_123_abc' },
            contexts: { nested: { clientSecret: 'CS' } }
        };
        api.redactEvent(ev);
        [['pin', ev.extra.pin], ['apiKey', ev.extra.apiKey], ['sessionToken', ev.extra.sessionToken],
         ['password', ev.extra.password], ['clientSecret (ជាន់ជ្រៅ)', ev.contexts.nested.clientSecret]
        ].forEach(([label, val]) => {
            ok('តម្លៃក្រោមកូនសោ `' + label + '` ត្រូវលាក់', val === '[redacted]', String(val));
        });
        [['note', ev.extra.note, 'ok'], ['keyId', ev.extra.keyId, 'K1'],
         ['barcode', ev.extra.barcode, 'ABC123'], ['itemId', ev.extra.itemId, 'id_123_abc']
        ].forEach(([label, val, want]) => {
            ok('⛔ `' + label + '` ត្រូវ **រក្សាទុក** (ត្រូវការសម្រាប់ debug)', val === want, String(val));
        });

        // ⛔ **ចន្លោះទី ១ខ ៖ បញ្ជីកូនសោសម្ងាត់ ត្រូវគ្រប secret ដែល *ប្រព័ន្ធនេះ
        // ពិតជាកាន់* — មិនមែនត្រឹមឈ្មោះទូទៅ។** `SECRET_KEY_PATTERN` ជាបញ្ជី
        // ពាក្យទូទៅ (`password` · `token` · `apikey` …) ដែលសរសេរដោយមិនមើល
        // កូដរបស់ App ➜ វាល secret ដែល **ឈ្មោះផ្ទាល់ខ្លួន** របស់គម្រោងនេះ
        // រអិលកាត់ទាំងស្រុង។ ⛔ ការវាស់ត្រូវ **ដេរីវេពីកូដពិត** មិនមែនបញ្ជីរឹង
        // (បញ្ជីរឹង = កាលបរិច្ឆេទផុតកំណត់ ៖ secret ថ្មីនៅជុំក្រោយរអិលកាត់)។
        //
        // ការដេរីវេ ៖ អ្វីដែល App **អ៊ិនគ្រីប ឬឌិគ្រីប** គឺជា secret តាម
        // និយមន័យ ➜ ឈ្មោះ property ដែលឆ្លងកាត់ `encryptLookupSecret()` /
        // `decryptLookupSecret()` ត្រូវតែជាឈ្មោះដែល redactor លាក់។ ដូចគ្នាដែរ
        // សម្រាប់ **header ដែលកាន់សោ** (`PROXY_KEY_HEADER` ក្នុងឧបករណ៍ Sync)
        // និង **env ដែល Function ប្រៀបធៀបនឹងវា** (`ZTO_PROXY_KEY`)។
        //
        // ⛔ ហេតុអ្វីវាសំខាន់ ៖ Sentry ចាប់ breadcrumb របស់ `console` **ដោយ
        // ស្វ័យប្រវត្តិ** ➜ redactor ជា **ជាន់ចុងក្រោយ** សម្រាប់ផ្លូវដែលគ្មាន
        // នរណាគ្រោងទុក។ ជាន់នោះមិនត្រូវពឹងលើការសន្មតថា «គ្មាននរណា log config»។
        let derivedSecretNames = [];
        (function () {
            const appSrc = readApp('ZoeW');
            const toolSrc = readRepoFile('tools/zto-cookie-sync-windows/sync-zto-cookie.js');
            const fnSrc = readRepoFile('ZoeW/netlify/functions/zto-order-detail.js');

            const derived = new Set();
            // ១) property ដែលឆ្លងកាត់ការអ៊ិនគ្រីប/ឌិគ្រីបរបស់ Lookup API
            let m;
            const cryptoRe = /(?:encrypt|decrypt)LookupSecret\(\s*[A-Za-z_$][\w$]*\.([A-Za-z_$][\w$]*)/g;
            while ((m = cryptoRe.exec(appSrc)) !== null) derived.add(m[1]);
            // ២) header ដែលកាន់សោ (ឈ្មោះអានចេញពីថេររបស់ឧបករណ៍ពិត)
            const hdr = /PROXY_KEY_HEADER\s*=\s*'([^']+)'/.exec(toolSrc);
            if (hdr) derived.add(hdr[1]);
            // ៣) env ដែល Function ប្រៀបធៀបនឹង header នោះ
            const envRe = /process\.env\.(ZTO_[A-Z0-9_]*KEY)/.exec(fnSrc);
            if (envRe) derived.add(envRe[1]);
            // ៤) ឈ្មោះ cookie នៃ session របស់ ZTO — secret ដ៏មានតម្លៃបំផុត
            // ក្នុងប្រព័ន្ធ។ ផ្លូវ **ខ្សែអក្សរ** (`Cookie: …`) មានការលាក់រួចហើយ
            // តែផ្លូវ **កូនសោវត្ថុ** (`{ 'BOS-MAN-SESSION': … }` — ទម្រង់
            // ធម្មជាតិរបស់ cookie jar) មិនទាន់មាន។
            const ckRe = /SESSION_COOKIE_NAME\s*=\s*'([^']+)'/.exec(fnSrc);
            if (ckRe) derived.add(ckRe[1]);

            const names = Array.from(derived);
            derivedSecretNames = names.slice();
            // ⛔ ជាន់អប្បបរមា ៖ ការដេរីវេដែលធ្លាក់ ធ្វើឲ្យការអះអាងខាងក្រោម
            // ពិតដោយស្វ័យប្រវត្តិ ➜ ត្រូវរាយជា FAIL មិនមែនរំលង។
            ok('ជាន់អប្បបរមា ៖ ដេរីវេឈ្មោះវាល secret ពិតបានយ៉ាងតិច ៣',
                names.length >= 3, 'ដេរីវេបាន ៖ ' + names.join(', '));

            names.forEach((name) => {
                const probe = { extra: {} };
                probe.extra[name] = 'DERIVED_SECRET_PROBE_VALUE';
                api.redactEvent(probe);
                ok('⛔ តម្លៃក្រោមកូនសោ `' + name + '` (ដេរីវេពីកូដពិត) ត្រូវលាក់',
                    probe.extra[name] === '[redacted]', String(probe.extra[name]));
            });

            // ⛔ ទិសផ្ទុយ ៖ ការពង្រីកបញ្ជីមិនត្រូវលេប **ឈ្មោះដែលមិនមែន secret**
            // ដែលមើលទៅស្រដៀង (`path` · `patch` · `dispatch` · `headerName` …)។
            // គ្មានការអះអាងនេះ ➜ «លាក់គ្រប់យ៉ាង» នឹងបៃតង ហើយ Sentry លែងមានតម្លៃ។
            const keepEv = { extra: {
                path: 'a/b', pathKey: 'history', patch: 'p1', dispatch: 'd1',
                headerName: 'Authorization', value: 'v', header: 'h', compat: 'c',
                pattern: 'x', barcode: 'ZTO900', keyId: 'K9', count: 2
            } };
            api.redactEvent(keepEv);
            const overRedacted = Object.keys(keepEv.extra)
                .filter((k) => keepEv.extra[k] === '[redacted]');
            ok('⛔ ទិសផ្ទុយ ៖ ឈ្មោះមិនមែន secret ដែលមើលទៅស្រដៀង មិនត្រូវលាក់',
                overRedacted.length === 0, 'ត្រូវលាក់ខុស ៖ ' + overRedacted.join(', '));
        })();

        // ⛔ **ចន្លោះទី ១ឃ ៖ secret ក្នុងវត្ថុ Push និង biometric (SECURITY-2)** — Web Push subscription (`keys.p256dh` ·
        // `keys.auth` ៖ អ្នកណាមានវា + endpoint ផ្ញើ push ទៅឧបករណ៍បាន) និង record biometric (`wrapKey` ក្បែរ `wrapped` ៖
        // PIN ទទួលបានវិញដោយគ្មាន WebAuthn) ធ្លាប់រអិលទៅ Sentry ពេលភ្ជាប់ជាវត្ថុ (breadcrumb `console` · extra)។
        // ⛔ ឈ្មោះដេរីវេពីកូដពិត ៖ វាលក្នុង `keys: { … }` ដែល App ផ្ញើទៅ Function push · វាល `rec.*` ដែលចូល `unwrapPinWithRawKey()`។
        (function () {
            const appSrc = readApp('ZoeW');
            const derived = new Set();
            let m;
            const keysRe = /keys:\s*\{([^{}]*)\}/g;
            while ((m = keysRe.exec(appSrc)) !== null) {
                (m[1].match(/([A-Za-z_$][\w$]*)\s*:/g) || []).forEach((k) => derived.add(k.replace(/\s*:$/, '')));
            }
            const unwrapRe = /unwrapPinWithRawKey\(([^;]*)\);/g;
            while ((m = unwrapRe.exec(appSrc)) !== null) {
                (m[1].match(/\brec\.([A-Za-z_$][\w$]*)/g) || []).forEach((k) => derived.add(k.slice(4)));
            }
            const names = Array.from(derived);
            // ⛔ `wrapKey` លែងមានក្នុងកូដ (SECURITY-1 ៖ PRF-only) តែ record `device` ចាស់នៅក្នុង storage រហូត `purgeLegacyBiometricRecord()` ➜ ការវាស់វត្ថុខាងក្រោមនៅវាស់វា
            ok('ជាន់អប្បបរមា ៖ ដេរីវេវាល secret របស់ Push និង biometric បានយ៉ាងតិច ៣ (p256dh · auth · wrapped)',
                names.length >= 3 && ['p256dh', 'auth', 'wrapped'].every((n) => names.indexOf(n) !== -1), 'ដេរីវេបាន ៖ ' + names.join(', '));
            derivedSecretNames = derivedSecretNames.concat(names.filter((n) => derivedSecretNames.indexOf(n) === -1));
            names.forEach((name) => {
                const probe = { extra: {} };
                probe.extra[name] = 'PUSH_BIO_SECRET_PROBE';
                api.redactEvent(probe);
                ok('⛔ តម្លៃក្រោមកូនសោ `' + name + '` (ដេរីវេពីកូដពិត) ត្រូវលាក់', probe.extra[name] === '[redacted]', String(probe.extra[name]));
            });
            const ev = { extra: {
                sub: { kind: 'web', endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: 'BPUSHKEY_PROBE', auth: 'AUTHSECRET_PROBE' } },
                rec: { mode: 'device', wrapKey: 'WRAPKEY_PROBE', wrapped: { iv: 'IV_PROBE', data: 'DATA_PROBE' } },
                author: 'Zoe', mode: 'device', keyId: 'K7'
            } };
            api.redactEvent(ev);
            const flat = JSON.stringify(ev);
            ok('⛔ subscription Push ជាវត្ថុ ➜ `keys.p256dh` · `keys.auth` លាក់',
                ev.extra.sub.keys.p256dh === '[redacted]' && ev.extra.sub.keys.auth === '[redacted]', JSON.stringify(ev.extra.sub));
            ok('⛔ record biometric ជាវត្ថុ ➜ `wrapKey` · `wrapped` លាក់', ev.extra.rec.wrapKey === '[redacted]' && ev.extra.rec.wrapped === '[redacted]', JSON.stringify(ev.extra.rec));
            ok('⛔ គ្មានតម្លៃ probe ណាលេចក្នុង event', !/(BPUSHKEY|AUTHSECRET|WRAPKEY|IV|DATA)_PROBE/.test(flat), flat);
            ok('⛔ ទិសផ្ទុយ ៖ `author` · `mode` · `keyId` · `kind` នៅមើលឃើញ (debug)',
                ev.extra.author === 'Zoe' && ev.extra.mode === 'device' && ev.extra.keyId === 'K7' && ev.extra.sub.kind === 'web' && ev.extra.rec.mode === 'device',
                JSON.stringify({ author: ev.extra.author, mode: ev.extra.mode, keyId: ev.extra.keyId, kind: ev.extra.sub.kind }));
        })();

        // ⛔ **ចន្លោះទី ១គ ៖ បញ្ជីពាក្យ ២ មិនស៊ីគ្នា — secret ដដែល លាក់
        // ម្ខាង លេចម្ខាង។** redactor មានបញ្ជីពាក្យ **ពីរ** ដែលដាច់ពីគ្នា ៖
        //   · `SECRET_KEY_PATTERN`   ➜ ប្រើពេលឈ្មោះជា **កូនសោវត្ថុ** (`{headerValue: …}`)
        //   · `SECRET_PARAM_PATTERN` ➜ ប្រើពេលឈ្មោះលេចក្នុង **ខ្សែអក្សរ** (`headerValue=…`)
        // ការបន្ថែមទៅបញ្ជីមួយ ដោយភ្លេចមួយទៀត ធ្វើឲ្យ secret ដដែល **លាក់
        // ម្ខាង លេចម្ខាង** ➜ ហើយ **ផ្លូវខ្សែអក្សរទើបជាផ្លូវធំបំផុត** ព្រោះ
        // Sentry ចាប់ breadcrumb របស់ `console` ដោយស្វ័យប្រវត្តិ (`console.log('cfg',
        // 'headerValue=' + v)` ជាទម្រង់ធម្មតា)។ វាស់បាន ៖ `headerValue` និង
        // `BOS-MAN-SESSION` លាក់ជាកូនសោ តែ **លេចជាខ្សែអក្សរ**; `activationKey`
        // លាក់ជាខ្សែអក្សរ តែ **លេចជាកូនសោ** — ខណៈ checker ១៨១ បៃតងទាំងអស់។
        //
        // ⛔ បញ្ជីត្រូវ **ដេរីវេពីកូដពិត** ៖ វាលដែល App ខ្លួនឯងចាត់ថាជា
        // credential គឺវាលដែល `clearSensitiveModalFields()` លុបចេញ ➜ id ណា
        // ដែលបញ្ចប់ដោយ `PinInput` · `PasswordInput` · `KeyInput` · `SecretInput`
        // · `TokenInput` គឺជា secret តាមនិយមន័យរបស់ App ផ្ទាល់។ ការប្តូរឈ្មោះ
        // វាល ឬការបន្ថែមវាល credential ថ្មី ➜ បញ្ជីដើរតាមដោយខ្លួនឯង។
        (function () {
            const appSrc = readApp('ZoeW');
            const listMatch = /const fieldsToBlank = \[([\s\S]*?)\];/.exec(appSrc);
            const ids = listMatch ? (listMatch[1].match(/'([^']+)'/g) || []).map((q) => q.slice(1, -1)) : [];
            // ⛔ កូដអញ្ជើញ (ចុះឈ្មោះចូលហាង) · កូដប្តូរពាក្យសម្ងាត់ · Setup Link (ផ្ទុក invite) ក៏ជា credential ដែរ —
            //    ចុងឈ្មោះ ៥ ដើមរំលងពួកវា ➜ `invite` មិនស្ថិតក្នុងបញ្ជីលាក់ ខណៈ checker នេះបៃតង (វាស់បាន ZoeW 2.47.0)
            const credentialIds = ids.filter((id) => /(Pin|Password|Key|Secret|Token|Invite|resetCode|setupLink)Input$/.test(id));
            const credentialNames = credentialIds.map((id) => id.replace(/Input$/, ''));

            ok('ជាន់អប្បបរមា ៖ ដេរីវេវាល credential ពី `fieldsToBlank` បានយ៉ាងតិច ៤',
                credentialNames.length >= 4, 'ដេរីវេបាន ៖ ' + credentialNames.join(', '));

            credentialNames.forEach((name) => {
                const probe = { extra: {} };
                probe.extra[name] = 'CREDENTIAL_PROBE_VALUE';
                api.redactEvent(probe);
                ok('⛔ កូនសោ `' + name + '` (ដេរីវេពី `fieldsToBlank`) ត្រូវលាក់',
                    probe.extra[name] === '[redacted]', String(probe.extra[name]));
            });

            // ⛔ **ទិសទី ២ ៖ ឈ្មោះដដែលក្នុង *ខ្សែអក្សរ*** — ៣ ទម្រង់ដែល
            // breadcrumb ពិតបញ្ចេញ (`a=b` · `"a":"b"` · `a: b`)។
            const stringNames = credentialNames.concat(derivedSecretNames);
            ok('ជាន់អប្បបរមា ៖ មានឈ្មោះ secret យ៉ាងតិច ៦ សម្រាប់វាស់ផ្លូវខ្សែអក្សរ',
                stringNames.length >= 6, 'ឃើញ ' + stringNames.length);
            stringNames.forEach((name) => {
                const forms = [
                    name + '=STRING_PROBE_VALUE',
                    '"' + name + '":"STRING_PROBE_VALUE"',
                    name + ': STRING_PROBE_VALUE'
                ];
                forms.forEach((form) => {
                    const out = api.redactEvent({ message: 'cfg ' + form }).message;
                    ok('⛔ ខ្សែអក្សរ `' + form.slice(0, 44) + '` ត្រូវលាក់',
                        out.indexOf('STRING_PROBE_VALUE') === -1, out);
                });
            });

            // ⛔ **ទិសផ្ទុយ** ៖ ការពង្រីកបញ្ជី *ខ្សែអក្សរ* មិនត្រូវលេបឈ្មោះ
            // ដែលមើលទៅស្រដៀង។ ⚠️ បញ្ជី param ធំជាងបញ្ជីកូនសោដោយចេតនា
            // (`keyId=` លាក់ ខណៈ `{keyId}` នៅមើលឃើញ) ➜ ការវាស់ទិសផ្ទុយ
            // ត្រូវប្រើតែឈ្មោះដែល **មិនស្ថិតក្នុងបញ្ជីណាមួយសោះ** (បញ្ជី param
            // ផ្ទុកពាក្យ `key` ទទេ ➜ `keyId=` និង `pathKey=` លាក់ដោយចេតនា)។
            ['headerName', 'path', 'patch', 'dispatch', 'compat'].forEach((name) => {
                const out = api.redactEvent({ message: 'cfg ' + name + '=KEEP_PROBE_VALUE' }).message;
                ok('⛔ ទិសផ្ទុយ ៖ `' + name + '=…` មិនត្រូវលាក់',
                    out.indexOf('KEEP_PROBE_VALUE') !== -1, out);
            });
        })();

        // ⛔ ចន្លោះទី ២ ៖ ការលាក់ធ្វើតែពេលតម្លៃជា **string**
        // (`typeof value[k] === 'string'`) ➜ secret ដែលមិនមែនជាខ្សែអក្សរ
        // រអិលកាត់ទាំងស្រុង៖
        //   `{ pin: 1234 }`            ➜ PIN ជា **លេខ** — ទម្រង់ធម្មជាតិបំផុត
        //   `{ credentials: [u, p] }`  ➜ array
        //   `{ auth: { password: … } }`➜ ត្រូវដើរជ្រៅ មិនមែនរក្សាទុកទាំងស្រុង
        // Sentry ចាប់ breadcrumb ដោយស្វ័យប្រវត្តិ (console · fetch) ដូច្នេះ
        // តម្លៃទាំងនោះអាចមកពីកូដដែលអ្នកសរសេរមិនបានគ្រោងទុក។
        const ev2 = {
            extra: {
                pin: 1234,
                passcode: 987654,
                apiKey: ['sk-live-1', 'sk-live-2'],
                credential: { user: 'u', password: 'p' },
                keyId: 42,
                count: 7,
                closedAt: 1756200000000
            }
        };
        api.redactEvent(ev2);
        ok('⛔ PIN ជា **លេខ** ក្រោមកូនសោ `pin` ត្រូវលាក់',
            ev2.extra.pin === '[redacted]', JSON.stringify(ev2.extra.pin));
        ok('⛔ លេខក្រោមកូនសោ `passcode` ត្រូវលាក់',
            ev2.extra.passcode === '[redacted]', JSON.stringify(ev2.extra.passcode));
        ok('⛔ array ក្រោមកូនសោ `apiKey` ត្រូវលាក់',
            ev2.extra.apiKey === '[redacted]', JSON.stringify(ev2.extra.apiKey));
        ok('⛔ វត្ថុក្រោមកូនសោ `credential` ត្រូវលាក់',
            ev2.extra.credential === '[redacted]', JSON.stringify(ev2.extra.credential));
        // ២ ខាង ៖ លេខដែល **មិនមែន** secret ត្រូវរក្សាទុកសម្រាប់ debug
        ok('⛔ `keyId` ជាលេខ ត្រូវ **រក្សាទុក**', ev2.extra.keyId === 42, JSON.stringify(ev2.extra.keyId));
        ok('⛔ `count` ត្រូវ **រក្សាទុក**', ev2.extra.count === 7, JSON.stringify(ev2.extra.count));
        ok('⛔ `closedAt` ត្រូវ **រក្សាទុក**', ev2.extra.closedAt === 1756200000000, JSON.stringify(ev2.extra.closedAt));

        const privateKeys = {
            privateKeyJwk: { kty: 'EC', crv: 'P-256', d: 'EC_PRIVATE_VALUE', x: 'PUBLIC_X', y: 'PUBLIC_Y' },
            signingKey: 'SIGNING_PRIVATE_VALUE',
            payload: { kty: 'RSA', n: 'PUBLIC_N', e: 'AQAB', p: 'RSA_PRIVATE_VALUE' },
            imported: { kty: 'oct', k: 'SYMMETRIC_PRIVATE_VALUE' },
            encoded: JSON.stringify({ kty: 'OKP', crv: 'Ed25519', d: 'OKP_PRIVATE_VALUE', x: 'PUBLIC_X' }),
            publicKey: { kty: 'EC', crv: 'P-256', x: 'PUBLIC_X', y: 'PUBLIC_Y' },
            d: 7, k: 'business-key', keyId: 'K1'
        };
        const safeKeys = api.redactEvent({ extra: privateKeys }).extra;
        ok('Sentry លាក់ private/signing key តាមឈ្មោះ',
            safeKeys.privateKeyJwk === '[redacted]' && safeKeys.signingKey === '[redacted]', safeKeys);
        ok('Sentry លាក់ JWK ឯកជន/សម្ងាត់ ទោះនៅក្រោមឈ្មោះធម្មតា',
            safeKeys.payload === '[redacted]' && safeKeys.imported === '[redacted]', safeKeys);
        ok('JWK ឯកជនក្នុង JSON string មិនអាចរអិលកាត់', !String(safeKeys.encoded).includes('OKP_PRIVATE_VALUE'), safeKeys.encoded);
        ok('Public JWK និងវាលអាជីវកម្ម d/k/keyId នៅតែអាច debug បាន',
            safeKeys.publicKey.x === 'PUBLIC_X' && safeKeys.d === 7 && safeKeys.k === 'business-key' && safeKeys.keyId === 'K1', safeKeys);

        const embeddedSecret = 'SYNTHETIC_EMBEDDED_PRIVATE_VALUE';
        const embeddedJwk = { kty: 'EC', crv: 'P-256', x: 'PUBLIC_X', y: 'PUBLIC_Y', d: embeddedSecret };
        for (const text of [
            'import JWK: ' + JSON.stringify(embeddedJwk),
            'result: ' + JSON.stringify({ key: embeddedJwk, d: 7 }) + ' done',
            'keys: [' + JSON.stringify(embeddedJwk) + ',{"kty":"RSA","p":"' + embeddedSecret + '"}]',
            'key: ' + JSON.stringify({ note: 'braces { } and quote " inside a value', d: embeddedSecret, kty: 'EC' }),
            'key: {"\\u006bty":"OKP","d":"' + embeddedSecret + '"}'
        ]) {
            const clean = api.redactEvent({ message: text }).message;
            ok('JWK ឯកជនក្នុងសារដែលមានបុព្វបទ ត្រូវលាក់ដោយសម្គាល់ JSON ពិត',
                !String(clean).includes(embeddedSecret) && String(clean).includes('[redacted]'), clean);
        }
        for (const text of ['debug: {"kty":"EC","x":"PUBLIC_X","y":"PUBLIC_Y"}',
            'debug: {"d":7,"k":"business-key"}', 'status: ready { business note']) {
            ok('សារធម្មតា/Public JWK មិនត្រូវលាក់តាម d/k ឥតបរិបទ', redact(text) === text, redact(text));
        }
        const hugeText = 'log: ' + 'x'.repeat(70 * 1024) + JSON.stringify(embeddedJwk);
        const hugeOut = redact(hugeText);
        ok('សារ JSON ធំពេក៖ កាត់ផ្នែកមិនទាន់វាស់ មិនប្រគល់ secret ឆៅ',
            !hugeOut.includes(embeddedSecret) && hugeOut.includes('[truncated]') && hugeOut.length < 66000, hugeOut.length);
        const deepText = 'log: ' + '{"nested":'.repeat(20) + JSON.stringify(embeddedJwk) + '}'.repeat(20);
        const deepOut = redact(deepText);
        ok('JSON ដែលមានបុព្វបទ និងជ្រៅលើសពិដាន ត្រូវកាត់',
            !deepOut.includes(embeddedSecret) && deepOut.includes('[truncated]'), deepOut);
        const manyOut = redact('log: [' + '{},'.repeat(5100) + JSON.stringify(embeddedJwk) + ']');
        ok('ចំនួន JSON fragments លើសពិដាន ត្រូវកាត់ដោយមិនស្កេនគ្មានដែន',
            !manyOut.includes(embeddedSecret) && manyOut.includes('[truncated]') && manyOut.length < 15500, manyOut.length);
        const repeatedParse = 'log: ' + '{"nested":'.repeat(10) + JSON.stringify({ note: 'x'.repeat(8192) })
            + '}'.repeat(10) + ' next: ' + JSON.stringify(embeddedJwk);
        const repeatedOut = redact(repeatedParse);
        ok('ការស្រាយ JSON សរុបមានពិដាន ទោះ string ទាំងមូលខ្លីជាងពិដានក៏ដោយ',
            !repeatedOut.includes(embeddedSecret) && repeatedOut.includes('[truncated]'), repeatedOut.length);

        // ⛔⛔ ចន្លោះទី ៣ ៖ **វត្ថុដែលសរសេរជាន់មិនបាន** (កំណែ 2.20.8)
        //
        // 🔴 វាស់បានលើកូដពិត ៖ `redactDeep()` កែ **នៅនឹងកន្លែង**
        // (`value[k] = '[redacted]'`)។ ក្នុង `'use strict'` ការសរសេរទៅលើ
        // property ដែល frozen · `writable: false` · ឬមាន getter តែម្យ៉ាង
        // **បោះ TypeError** ➜ `try/catch` ដែលរុំវា **លេបកំហុសនោះ** ➜
        // **តម្លៃដើមរស់រានចូល payload របស់ Sentry**។
        //
        // វាធ្ងន់ជាងការបាត់កូនសោមួយ ៖ ពេលវត្ថុមួយ frozen នោះ **រាល់ខ្សែអក្សរ
        // ខាងក្នុងវា** ក៏សរសេរជាន់មិនបានដែរ ➜ URL ដែលមាន `token=` ·
        // header `Bearer` · JWT · deployment ID របស់ Apps Script
        // **ឆ្លងកាត់ដោយមិនត្រូវលាក់សោះ** ➜ ស្រទាប់ការពារទាំងមូល **រំលង
        // ដោយស្ងាត់** សម្រាប់ subtree នោះ។ (ថ្នាក់ «ការការពារដែលងាប់»។)
        //
        // ⛔ ការអះអាងត្រូវអាន **តម្លៃដែលត្រឡប់មកវិញ** មិនមែនវត្ថុដើម —
        // ការកែត្រូវអនុញ្ញាតឲ្យ redactor ត្រឡប់ **ច្បាប់ចម្លងដែលលាក់រួច**
        // ពេលការកែនៅនឹងកន្លែងធ្វើមិនបាន។
        {
            const frozen = { extra: Object.freeze({ pin: '1234', barcode: 'B1' }) };
            const outF = api.redactEvent(frozen);
            ok('⛔ វត្ថុ frozen ៖ `pin` ត្រូវលាក់',
                outF && outF.extra && outF.extra.pin === '[redacted]', JSON.stringify(outF && outF.extra));
            ok('⛔ វត្ថុ frozen ៖ `barcode` នៅតែរក្សាទុក (២ ខាង)',
                outF && outF.extra && outF.extra.barcode === 'B1', JSON.stringify(outF && outF.extra));

            const frozenUrl = Object.freeze({ url: 'https://x/y?token=SECRET123' });
            const outU = api.redactEvent(frozenUrl);
            ok('⛔ វត្ថុ frozen ៖ ខ្សែអក្សរខាងក្នុងក៏ត្រូវលាក់ដែរ',
                outU && typeof outU.url === 'string' && outU.url.indexOf('SECRET123') === -1,
                JSON.stringify(outU));

            const ro = { extra: {} };
            Object.defineProperty(ro.extra, 'password',
                { value: 'p@ss', enumerable: true, writable: false, configurable: false });
            const outR = api.redactEvent(ro);
            ok('⛔ property `writable: false` ៖ `password` ត្រូវលាក់',
                outR && outR.extra && outR.extra.password === '[redacted]', JSON.stringify(outR && outR.extra));

            const getterOnly = { extra: {} };
            Object.defineProperty(getterOnly.extra, 'secret',
                { get: () => 'S3CRET', enumerable: true, configurable: true });
            const outG = api.redactEvent(getterOnly);
            ok('⛔ property ដែលមាន getter តែម្យ៉ាង ៖ `secret` ត្រូវលាក់',
                outG && outG.extra && outG.extra.secret === '[redacted]', JSON.stringify(outG && outG.extra));

            // ⛔ ការសរសេរដែល **បរាជ័យស្ងាត់ៗ** (setter ដែលមិនធ្វើអ្វី) — វា
            // **មិនបោះកំហុសទេ** ➜ `try/catch` តែម្យ៉ាងចាប់មិនបាន។ ត្រូវ
            // **ផ្ទៀងផ្ទាត់ថាការសរសេរជាប់ពិត** មុនជឿថាការលាក់សម្រេច។
            const noopSetter = { extra: {} };
            Object.defineProperty(noopSetter.extra, 'token',
                { get: () => 'T0KEN', set: () => {}, enumerable: true, configurable: true });
            const outN = api.redactEvent(noopSetter);
            ok('⛔ setter ដែលមិនធ្វើអ្វី ៖ `token` ត្រូវលាក់ពិត (មិនត្រឹមតែសរសេរចោល)',
                outN && outN.extra && outN.extra.token === '[redacted]', JSON.stringify(outN && outN.extra));

            const frozenArr = { extra: Object.freeze([{ pin: '99' }]) };
            const outA = api.redactEvent(frozenArr);
            ok('⛔ array ដែល frozen ៖ ធាតុខាងក្នុងក៏ត្រូវលាក់ដែរ',
                outA && outA.extra && outA.extra[0] && outA.extra[0].pin === '[redacted]',
                JSON.stringify(outA && outA.extra));

            // ⛔ ២ ខាង ៖ វត្ថុធម្មតាត្រូវ **កែនៅនឹងកន្លែងដដែល** — ការត្រឡប់
            // ច្បាប់ចម្លងជានិច្ចនឹងបំបែកអ្នកហៅដែលពឹងលើអត្តសញ្ញាណវត្ថុ។
            const plain = { extra: { pin: 'x', note: 'keep' } };
            const outP = api.redactEvent(plain);
            ok('⛔ ២ ខាង ៖ វត្ថុធម្មតានៅតែត្រូវកែនៅនឹងកន្លែង (មិនចម្លងឥតប្រយោជន៍)',
                outP === plain && plain.extra.pin === '[redacted]' && plain.extra.note === 'keep',
                JSON.stringify(plain));
        }
    } else {
        ok('ZoeErrors បង្ហាញ `redactEvent` ➜ ការលាក់តាមឈ្មោះកូនសោវត្ថុត្រូវវាស់បាន',
            false, 'គ្មាន `redactEvent` ➜ តម្លៃក្រោមកូនសោដូច `{ pin: … }` `{ apiKey: … }` '
                + 'មិនត្រូវបានលាក់ ហើយ checker នេះក៏វាស់វាមិនបានដែរ');
    }

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
        'https://a/?locker=A12', 'https://a/?phone=0970008508', 'https://a/?keyboard=on'];
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

    // ⛔ **ចន្លោះទម្រង់ ៖ អ្នកបំបែកមានតែ `=`។** អ្នកបំបែកពិតប្រាកដក្នុង
    // breadcrumb និងសារ error ជាញឹកញាប់គឺ **`:`** មិនមែន `=` ទេ៖
    //   `console.log('pin:', v)`      ➜ `"pin: 1234"`
    //   `JSON.stringify(cfg)`         ➜ `{"apiKey":"AIza…"}`
    //   header dump ក្នុងសារ error    ➜ `X-Api-Key: sk_live_…`
    //   `Authorization: Bearer eyJ…`  ➜ token ទាំងមូល
    // Sentry ចាប់ breadcrumb របស់ console **ដោយស្វ័យប្រវត្តិ** ដូច្នេះអត្ថបទ
    // ដែលអ្នកមិនបានគ្រោងទុកឆ្លងកាត់ redaction។ វាស់បានមុនកែ ៖ ទម្រង់ទាំង ៤
    // នេះ **មិនលាក់សោះ**។
    const JWT_SAMPLE = 'eyJhbGciOiJSUzI1NiIsImtpZCI6ImFiYyJ9'
        + '.eyJpc3MiOiJodHRwczovL3NlY3VyZXRva2VuIiwidWlkIjoieDEifQ'
        + '.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    const colonLeaks = [
        ['lookup failed pin: 4321', '4321', '`pin: …` (អ្នកបំបែក `:`)'],
        ['pin:1234', '1234', '`pin:…` គ្មានចន្លោះ'],
        ['{"pin":"4321","barcode":"ZTO1"}', '4321', 'JSON ក្នុងខ្សែអក្សរ'],
        ['{"cfg":{"apiKey":"AIzaSyZZ","projectId":"biz-a"}}', 'AIzaSyZZ', 'JSON ជាន់ជ្រៅក្នុងខ្សែអក្សរ'],
        ['X-Api-Key: sk_live_abc123', 'sk_live_abc123', 'header dump (hyphen + `:`)'],
        ['Authorization: Bearer ' + JWT_SAMPLE, JWT_SAMPLE, '`Bearer <token>`'],
        ['request failed with token ' + JWT_SAMPLE, JWT_SAMPLE, 'JWT ឆៅក្នុងអត្ថបទសេរី'],
        ['apiKey: "AIzaSyD-XYZ", projectId: "biz-a"', 'AIzaSyD-XYZ', 'Firebase config ជាអត្ថបទ']
    ];
    colonLeaks.forEach(([input, secret, label]) => {
        const out = redact(input);
        ok('លាក់៖ ' + label, out.indexOf(secret) === -1, 'got: ' + out);
    });

    // តេស្តទម្រង់ដែលលាក់តែផ្នែកដើម ហើយទុក credential ខាងក្រោយ។
    // ទាំងអស់ជាទិន្នន័យសាកល្បង; កុំបោះតម្លៃពេញទៅ output ពេលធ្លាក់។
    const completeSecretCases = [
        ['Authorization: Bearer opaque_test_credential_123', 'opaque_test_credential_123', 'Bearer ដែលមិនមែន JWT'],
        ['Authorization: Basic dGVzdDp0ZXN0MTIzNA==', 'dGVzdDp0ZXN0MTIzNA==', 'Basic ក្នុង header'],
        ['{"password":"first SECOND_TEST_PART","barcode":"SAFE"}', 'SECOND_TEST_PART', 'JSON password មានចន្លោះ'],
        ["password: 'first SECOND_TEST_PART', barcode: SAFE", 'SECOND_TEST_PART', 'password ប្រើ quote តែមួយ'],
        ['{"password":"first \\"SECOND_TEST_PART\\" last","barcode":"SAFE"}', 'SECOND_TEST_PART', 'JSON password មាន quote ដែល escape'],
        ['password="first SECOND_TEST_PART" barcode=SAFE', 'SECOND_TEST_PART', 'password ជាគូស្មើដែលមាន quote'],
        ['{"credential":["ARRAY_TEST_SECRET"],"barcode":"SAFE"}', 'ARRAY_TEST_SECRET', 'JSON credential ជា array'],
        ['{"token":{"value":"OBJECT_TEST_SECRET"},"barcode":"SAFE"}', 'OBJECT_TEST_SECRET', 'JSON token ជា object'],
        ['{"key":"GENERIC_KEY_TEST","barcode":"SAFE"}', 'GENERIC_KEY_TEST', 'JSON key ដែលច្បាប់អត្ថបទធ្លាប់លាក់'],
        ['{"auth":"AUTH_TEST_VALUE","barcode":"SAFE"}', 'AUTH_TEST_VALUE', 'JSON auth ដែលច្បាប់អត្ថបទធ្លាប់លាក់'],
        ['https://example.test/?api%5Fkey=ENCODED_TEST_VALUE&barcode=SAFE', 'ENCODED_TEST_VALUE', 'URL parameter ដែល encode ឈ្មោះ'],
        ['Cookie: BOS-MAN-SESSION=COOKIE_TEST_VALUE; other=SECOND_COOKIE_VALUE\nbarcode: SAFE', 'COOKIE_TEST_VALUE', 'Cookie header ទាំងមូល'],
        ['Cookie: BOS-MAN-SESSION=COOKIE_TEST_VALUE; other=SECOND_COOKIE_VALUE\nbarcode: SAFE', 'SECOND_COOKIE_VALUE', 'Cookie ទីពីរក្នុង header']
    ];
    completeSecretCases.forEach(([input, secret, label]) => {
        const out = redact(input);
        ok('លាក់ពេញ៖ ' + label, out.indexOf(secret) === -1);
        if (input.indexOf('SAFE') !== -1) ok('រក្សា Barcode ក្រោយ៖ ' + label, out.indexOf('SAFE') !== -1);
    });
    if (typeof api.redactEvent === 'function') {
        const out = api.redactEvent({ request: { headers: {
            Cookie: 'COOKIE_TEST_VALUE', 'Set-Cookie': ['COOKIE_ONE', 'COOKIE_TWO'], 'Content-Type': 'application/json'
        } } });
        ok('Cookie ក្នុង object ត្រូវលាក់', out.request.headers.Cookie === '[redacted]');
        ok('Set-Cookie ក្នុង object ត្រូវលាក់ទាំង array', out.request.headers['Set-Cookie'] === '[redacted]');
        ok('Content-Type នៅតែរក្សា', out.request.headers['Content-Type'] === 'application/json');
        const frozenCycle = {};
        frozenCycle.self = frozenCycle;
        frozenCycle.barcode = 'SAFE';
        frozenCycle.password = 'CYCLE_TEST_VALUE';
        Object.freeze(frozenCycle);
        const cleanCycle = api.redactEvent({ extra: frozenCycle, again: frozenCycle });
        const visited = new Set();
        const includesSecret = (value) => {
            if (typeof value === 'string') return value.indexOf('CYCLE_TEST_VALUE') !== -1;
            if (!value || typeof value !== 'object' || visited.has(value)) return false;
            visited.add(value);
            return Object.keys(value).some((key) => includesSecret(value[key]));
        };
        ok('frozen cycle គ្មាន reference ទៅ secret ដើម', !includesSecret(cleanCycle));
        ok('frozen cycle រក្សា Barcode និង reference ដែលសម្អាតរួច',
            cleanCycle.extra.barcode === 'SAFE' && cleanCycle.again.password === '[redacted]');
    }

    // ⛔ ២ ខាង ៖ អ្នកបំបែក `:` **មិនត្រូវលាក់លើស** — ម៉ោង · ID · URL ·
    //    សារ error ត្រូវការសម្រាប់ debug ហើយពួកវាសុទ្ធតែមាន `:`។
    const colonKeep = [
        ['scan time: 14:30:05 barcode: ZTO9', 'ZTO9', 'barcode ក្រោយ `:`'],
        ['item id: id_1780000000_abc', 'id_1780000000_abc', 'លេខសម្គាល់ធាតុក្រោយ `:`'],
        ['locker: A12 count: 2', 'A12', 'ឈ្មោះទូ Locker'],
        ['GET https://a.firebaseio.com/zoew_scan_history_cod_dod.json', 'a.firebaseio.com', 'host ក្នុង URL'],
        ['TypeError: Failed to fetch', 'Failed to fetch', 'សារ error ធម្មតា'],
        ['created 2026-08-28T10:00:00Z count: 3', '2026-08-28T10:00:00Z', 'ត្រាពេលវេលា ISO']
    ];
    colonKeep.forEach(([input, kept, label]) => {
        const out = redact(input);
        ok('មិនលាក់លើស៖ ' + label, out.indexOf(kept) !== -1, 'got: ' + out);
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

        // ⛔ ចន្លោះពិត ៣ ដែលវាស់បានក្នុងជុំ 2.20.3 (កូដមុនកែលេច secret ពិត)៖
        //
        // ១. **អ្នកបំបែកក្រៅពី `?&#` និងចន្លោះ។** លំនាំ `name=value` ដែលមក
        //    ក្រោយ `,` ឬ `;` ឬ `{` **មិនត្រូវលាក់** — ហើយ breadcrumb របស់
        //    console (ដែល Sentry ចាប់ដោយស្វ័យប្រវត្តិ) ជាទម្រង់នោះជាញឹកញាប់។
        // ២. **គូដែលមិនសម្ងាត់លេបគូដែលសម្ងាត់។** តម្លៃរបស់ `a=` ធ្លាប់អាច
        //    ត្រួតលើ `;` ➜ `a=1;secret=X` ផ្គូផ្គងជា name=`a`
        //    value=`1;secret=X` ➜ `isSecretParamName('a')` មិនពិត ➜ **រក្សា
        //    ទាំងមូល** ➜ `secret=X` មិនដែលត្រូវពិនិត្យសោះ។
        // ៣. **ការឈានដល់ពិដានជម្រៅ ត្រឡប់ subtree ឆៅ។** `REDACT_MAX_DEPTH`
        //    ធ្លាប់ជា ៦ ហើយពេលដល់ពិដាន វា `return value` ➜ អ្វីៗខាងក្រោម
        //    **មិនដែលត្រូវស្កេន**។ event ពិតរបស់ Sentry ជ្រៅជាង ៦ ជាធម្មតា
        //    (`exception.values[].stacktrace.frames[].vars.…`)។
        const sepEv = captured.beforeSend({ extra: {
            comma: 'config loaded,pin=4321,done',
            semi: 'a=1;secret=SUPERSECRET123',
            brace: '{token=SUPERSECRET123}',
            pipe: 'x|password=SUPERSECRET123'
        } });
        ok('⛔ លាក់៖ គូដែលមកក្រោយ `,` (breadcrumb របស់ console)',
            sepEv.extra.comma.indexOf('4321') === -1, sepEv.extra.comma);
        ok('⛔ លាក់៖ គូសម្ងាត់ដែលឈរក្រោយគូមិនសម្ងាត់ (`a=1;secret=…`)',
            sepEv.extra.semi.indexOf('SUPERSECRET123') === -1, sepEv.extra.semi);
        ok('⛔ លាក់៖ គូក្នុងវង់ក្រចក `{token=…}`',
            sepEv.extra.brace.indexOf('SUPERSECRET123') === -1, sepEv.extra.brace);
        ok('⛔ លាក់៖ គូក្រោយ `|`',
            sepEv.extra.pipe.indexOf('SUPERSECRET123') === -1, sepEv.extra.pipe);
        ok('ការលាក់មិនលេបអត្ថបទដែលនៅសល់ (`,done` ត្រូវនៅ)',
            sepEv.extra.comma.indexOf('done') !== -1, sepEv.extra.comma);

        // ជម្រៅ ៖ secret ដែលអង្គុយជ្រៅជាងពិដានចាស់ (៦) ត្រូវលាក់ដដែល
        let deep = { pin: 'SUPERSECRET123' };
        for (let i = 0; i < 9; i++) deep = { nest: deep };
        const deepEv = captured.beforeSend({ extra: { deep: deep } });
        ok('⛔ លាក់៖ secret ដែលជ្រៅជាងពិដានចាស់ (៦ ជាន់)',
            JSON.stringify(deepEv).indexOf('SUPERSECRET123') === -1,
            JSON.stringify(deepEv).slice(0, 120));

        // ហើយអ្វីដែលហួសពិដានពិត ត្រូវ **កាត់** មិនមែនប្រគល់ subtree ឆៅ
        //
        // ⛔ ពិដានត្រូវអានចេញពីកូដពិត មិនមែនសរសេរជាលេខថេរទេ (មេរៀនកំណែ 2.20.3
        // ចំណុច ៦)៖ លេខថេរដែល **តូចជាងពិដាន** ជាការអះអាងដែលមិនអះអាងអ្វីសោះ —
        // វានឹងបៃតងលើ tree ដែលដកការកាត់ចេញទាំងស្រុង។
        const maxDepth = parseInt((src.match(/REDACT_MAX_DEPTH\s*=\s*(\d+)/) || [])[1], 10);
        const maxNodes = parseInt((src.match(/REDACT_MAX_NODES\s*=\s*(\d+)/) || [])[1], 10);
        ok('ជាន់អប្បបរមា ៖ អានពិដាន redaction ចេញពីកូដពិតបាន',
            maxDepth > 0 && maxNodes > 0, { maxDepth: maxDepth, maxNodes: maxNodes });

        let tooDeep = { pin: 'SUPERSECRET123' };
        for (let i = 0; i < maxDepth + 8; i++) tooDeep = { nest: tooDeep };
        const cutEv = captured.beforeSend({ extra: { deep: tooDeep } });
        ok('⛔ ហួសពិដានជម្រៅ ➜ កាត់ចោល (មិនប្រគល់ subtree ដែលមិនទាន់ស្កេន)',
            JSON.stringify(cutEv).indexOf('SUPERSECRET123') === -1,
            JSON.stringify(cutEv).slice(0, 120));

        // ⛔ **ពិដានចំនួន node ជាទ្វារដដែល ដែលធ្លាប់ត្រូវបានភ្លេច។** ជម្រៅត្រូវ
        // បិទក្នុង 2.20.3 តែរង្វិលជុំខាងក្នុងនៅ `break` ➜ កូនសោដែលនៅសល់
        // **រក្សាតម្លៃឆៅ** ➜ secret ដែលអង្គុយហួស node ទី N ហោះទៅ Sentry ដោយ
        // មិនត្រូវពិនិត្យសោះ។ ត្រូវសាកដោយ event ធំជាង `REDACT_MAX_NODES` ពិត។
        const wide = {};
        for (let i = 0; i < maxNodes; i++) wide['pad' + i] = { a: { b: 1 } };
        wide.zzTail = { password: 'SUPERSECRET123', url: 'https://x/y?token=SUPERSECRET123' };
        const wideEv = captured.beforeSend({ extra: wide });
        ok('⛔ ហួសពិដានចំនួន node ➜ secret ដែលនៅសល់ក៏ត្រូវកាត់ដែរ',
            JSON.stringify(wideEv).indexOf('SUPERSECRET123') === -1,
            JSON.stringify(wideEv.extra.zzTail).slice(0, 160));

        const wideArr = [];
        for (let i = 0; i < maxNodes; i++) wideArr.push({ a: { b: 1 } });
        wideArr.push({ pin: 4321 });
        const arrEv = captured.beforeSend({ extra: { list: wideArr } });
        ok('⛔ ហួសពិដានចំនួន node ក្នុង array ➜ ក៏ត្រូវកាត់ដែរ',
            JSON.stringify(arrEv.extra.list[arrEv.extra.list.length - 1]).indexOf('4321') === -1,
            arrEv.extra.list[arrEv.extra.list.length - 1]);

        // ទិសផ្ទុយ ៖ event ធម្មតា (តូចជាងពិដាន) មិនត្រូវត្រូវកាត់ចោលឡើយ —
        // បើអត់ការអះអាងនេះ ការ «កាត់គ្រប់ពេល» នឹងបៃតង ហើយ Sentry លែងមានតម្លៃ
        const smallEv = captured.beforeSend({ extra: { barcode: 'ZTO900', count: 3, note: 'ok' } });
        ok('⛔ ទិសផ្ទុយ ៖ event ធម្មតាមិនត្រូវកាត់ (barcode/count នៅមើលឃើញ)',
            smallEv.extra.barcode === 'ZTO900' && smallEv.extra.count === 3, smallEv.extra);
    })();

    ok('beforeSend ត្រូវបានភ្ជាប់ (មិនត្រឹមតែ beforeBreadcrumb)', /beforeSend:\s*redactEvent/.test(src));
    ok('Sentry loader script ក៏ទទួលការលាក់ដែរ (Sentry.onLoad ➜ Sentry.init)',
        /onLoad\(\(\) => \{[\s\S]*Sentry\.init\(guardedOptions/.test(src));
    ok('sendDefaultPii បិទ', /sendDefaultPii:\s*false/.test(src));
})();

console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')' : '✅ ជោគជ័យ ' + pass));
process.exit(fail ? 1 : 0);
