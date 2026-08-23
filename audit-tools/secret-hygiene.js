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

    const keep = [
        ['https://zoew.app/?list=1&barcode=ZTO900', 'ZTO900', 'barcode មិនត្រូវលាក់ (ត្រូវការសម្រាប់ debug)'],
        ['zoew_scan_history_cod_dod/id_123_abc timed out', 'id_123_abc', 'លេខសម្គាល់ធាតុនៅដដែល']
    ];
    keep.forEach(([input, kept, label]) => {
        const out = redact(input);
        ok('រក្សាទុក៖ ' + label, out.indexOf(kept) !== -1, 'got: ' + out);
    });

    ok('beforeSend ត្រូវបានភ្ជាប់ (មិនត្រឹមតែ beforeBreadcrumb)', /beforeSend:\s*redactEvent/.test(src));
    ok('Sentry loader script ក៏ទទួលការលាក់ដែរ (Sentry.onLoad ➜ Sentry.init)',
        /onLoad\(\(\) => \{[\s\S]*Sentry\.init\(guardedOptions/.test(src));
    ok('sendDefaultPii បិទ', /sendDefaultPii:\s*false/.test(src));
})();

console.log('\n' + (fail ? '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')' : '✅ ជោគជ័យ ' + pass));
process.exit(fail ? 1 : 0);
