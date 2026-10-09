'use strict';
// អ្នកយាម security ៖ repo (public) + App ដែល ship ➜ ការកែ ឬមុខងារថ្មីដែលបើកការលេចធ្លាយ ត្រូវក្រហមភ្លាម។
//
// ⛔ repo `mengsroy-h/Zoe-System` ជា **public** ➜ អ្វីៗដែល commit (កូដ · តេស្ត · ឯកសារ) អ្នកណាក៏អានបាន ហើយនៅក្នុងប្រវត្តិ git រហូត។
//    checker ផ្សេងវាស់ឥរិយាបថពេលរត់ (`secret-hygiene` ៖ Sentry/DOM · `csp-enforced-test` ៖ គ្មានការរំលោភ CSP · `html-sink-escaping` ៖ XSS ·
//    `supabase-rls-test` ៖ RLS/definer · `dom-hygiene`/`state-hygiene` ៖ ក្រោយចាកចេញ)។ ឯកសារនេះគ្របចន្លោះដែលគ្មានអ្នកណាវាស់ ៖
//    ក. secret ក្នុងឯកសារ repo (git ls-files + ឯកសារថ្មីមិនទាន់ commit)
//    ខ. App ដែល ship ៖ env ដែល Vite បញ្ចូលក្នុង bundle · ឈ្មោះ secret របស់ server ក្នុងកូដ client · sourcemap · dist
//    គ. ទិន្នន័យអតិថិជន (លេខទូរស័ព្ទ · លេខ waybill ZTO) ក្នុង repo ➜ fixture ត្រូវជាលេខសំយោគ (`000` ក្នុងលេខអតិថិជន · waybill មាន `0000` · ឬលំនាំច្បាស់)
//    ឃ. CSP និង header security របស់ App ទាំង ២ ➜ ratchet (ប្រភព script/connect ថ្មី ត្រូវមានហេតុផល)
//    ង. GitHub Actions ៖ សិទ្ធិ · trigger ពី fork · runner self-hosted · action ខាងក្រៅ pin SHA · secret ក្នុង run · persist-credentials
//    ច. Firebase rules ទាំង ២ ៖ root default-deny · ផ្លូវដែលអានដោយគ្មាន auth ត្រូវមានហេតុផល · គ្មាន `.write` សាធារណៈ
//    ឆ. Supabase ៖ Edge Function ដែលបិទ verify_jwt · migration បើក RLS លើរាល់តារាង · គ្មាន grant ទៅ anon លើតារាង
//    ជ. bundle ផលិតកម្មពិត ៖ `vite build` ទៅថតបណ្តោះអាសន្ន (គ្មាន `VITE_EXPOSE_GLOBALS`) ➜ គ្មាន sourcemap · secret · ឈ្មោះ secret server ·
//       bridge របស់ build វាស់ · លេខអតិថិជន ក្នុងឯកសារដែល Netlify ship (build ផ្ទាល់រាល់ដង ➜ មិនពឹង dist ដែលនៅសល់ពីការ build ផ្សេង)
//    ឈ. Android (Capacitor) ៖ WebView debug បិទ · mixed content បិទ · គ្មាន server.url/cleartext · Manifest គ្មាន cleartext/debuggable ·
//       component exported តែ Launcher
// ⛔ បញ្ជីអនុញ្ញាតទាំងអស់ត្រូវមានហេតុផលម្តងមួយ ហើយធាតុដែលលែងត្រូវគ្នានឹងអ្វីសោះ = ធ្លាក់ (មិនមានធាតុងាប់)។
// ⛔ រាល់ផ្នែកមានការវាស់ទិសផ្ទុយ (ការលេចធ្លាយក្លែងក្នុងសតិ ➜ ត្រូវរកឃើញ) និងជាន់អប្បបរមា (ថតទទេ ➜ ធ្លាក់)។
process.exitCode = 1;

const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');

const ROOT = path.resolve(process.env.SECURITYGUARD_APP_DIR || path.join(__dirname, '..'));

let pass = 0;
let fail = 0;
function ok(cond, label, detail) {
    if (cond) { pass++; console.log('  ok    ' + label); return; }
    fail++;
    console.log('  FAIL  ' + label + (detail === undefined ? '' : '\n        ' + String(typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 1600)));
}
function rel(file) { return path.relative(ROOT, file).split(path.sep).join('/'); }
function readText(file) {
    try {
        const buf = fs.readFileSync(file);
        if (buf.length > 6 * 1024 * 1024 || buf.indexOf(0) !== -1) return null;
        return buf.toString('utf8');
    } catch (e) { return null; }
}

// ── ឯកសារដែលត្រូវវាស់ ─────────────────────────────────────────────────────────────
const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'dist-audit', 'build', '.gradle', 'coverage', '.idea', '.vscode']);
const BINARY_EXT = /\.(png|jpe?g|gif|webp|ico|wasm|jar|apk|aab|keystore|zip|gz|tgz|rar|pdf|woff2?|ttf|otf|mp4|mov|so|class)$/i;
function listFiles() {
    let names = null;
    if (fs.existsSync(path.join(ROOT, '.git'))) {
        const r = cp.spawnSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
        if (r.status === 0) names = r.stdout.split('\0').filter(Boolean);
    }
    if (!names) {
        names = [];
        const walk = (dir) => {
            let entries = [];
            try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
            for (const e of entries) {
                if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(path.join(dir, e.name)); }
                else if (e.isFile()) names.push(rel(path.join(dir, e.name)));
            }
        };
        walk(ROOT);
    }
    return names.filter((n) => !n.split('/').some((part) => SKIP_DIRS.has(part)) && fs.existsSync(path.join(ROOT, n)));
}
const FILES = listFiles();
const TEXT = new Map();
for (const name of FILES) {
    if (BINARY_EXT.test(name)) continue;
    const text = readText(path.join(ROOT, name));
    if (text !== null) TEXT.set(name, text);
}

console.log('security-guard — repo (public) + App ដែល ship\n');
console.log('== ០. ជាន់អប្បបរមា ==');
ok(FILES.length >= 300, 'ជាន់អប្បបរមា ៖ ឯកសារក្នុង repo ≥ ៣០០ (git ls-files ឬដើរថត)', FILES.length);
ok(TEXT.has('ZoeW/netlify.toml') && TEXT.has('ZoeKeyGen/netlify.toml') && TEXT.has('firebase-database.rules.json'),
    'ជាន់អប្បបរមា ៖ អានឯកសារ config ស្នូលបាន (netlify.toml ×២ · rules)');

// ── ក. secret ក្នុងឯកសារ repo ──────────────────────────────────────────────────────
function entropy(s) {
    const counts = {};
    for (const ch of s) counts[ch] = (counts[ch] || 0) + 1;
    let h = 0;
    for (const k of Object.keys(counts)) { const p = counts[k] / s.length; h -= p * Math.log2(p); }
    return h;
}
function jwtPayload(token) {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    try { return JSON.parse(Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')); } catch (e) { return null; }
}
const PLACEHOLDER = /(synthetic|example|placeholder|dummy|demo|fake|sample|test|probe|fixture|xxxx|your[-_]?|<[^>]*>|\$\{|redacted|changeme)/i;
const SECRET_KINDS = [
    { kind: 'pem-private-key', re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/g },
    { kind: 'google-api-key', re: /\bAIza[0-9A-Za-z_-]{35}\b/g },
    { kind: 'supabase-secret-key', re: /\bsb_secret_[0-9A-Za-z_-]{16,}/g },
    { kind: 'github-token', re: /\b(?:gh[pousr]_[0-9A-Za-z]{36,}|github_pat_[0-9A-Za-z_]{40,})\b/g },
    { kind: 'netlify-token', re: /\bnfp_[0-9A-Za-z]{30,}\b/g },
    { kind: 'npm-token', re: /\bnpm_[0-9A-Za-z]{36}\b/g },
    { kind: 'sentry-auth-token', re: /\bsntry[su]_[0-9A-Za-z_=]{30,}/g },
    { kind: 'slack-token', re: /\bxox[abprs]-[0-9A-Za-z-]{10,}/g },
    { kind: 'aws-access-key', re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },
    { kind: 'firebase-service-account', re: /"type"\s*:\s*"service_account"[\s\S]{0,400}"private_key"/g },
    { kind: 'private-jwk', re: /"d"\s*:\s*"[A-Za-z0-9_-]{40,}"/g, near: /"kty"\s*:/ },
    { kind: 'jwt', re: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
        keep: (m) => { const p = jwtPayload(m); return !(p && p.role === 'anon' && p.iss === 'supabase'); } },
    { kind: 'zto-session-cookie', re: /BOS-MAN-SESSION=([^;\s'"`]{20,})/g,
        keep: (m, g1) => !/-/.test(g1) && !PLACEHOLDER.test(g1) && entropy(g1) >= 3.5 },
    { kind: 'url-credentials', re: /\bhttps?:\/\/[A-Za-z0-9._%-]{1,64}:([^\s@/'"`]{6,})@[A-Za-z0-9.-]+/g,
        keep: (m, g1) => !PLACEHOLDER.test(g1) && !/^\$|^\*+$/.test(g1) },
    { kind: 'credential-assignment', re: /\b(?:password|passwd|secret|token|api[_-]?key|proxy[_-]?key|private[_-]?key)\b["']?\s*[:=]\s*["'`]([^"'`\s]{20,})["'`]/gi,
        keep: (m, g1) => !PLACEHOLDER.test(g1) && /[0-9]/.test(g1) && /[A-Za-z]/.test(g1) && entropy(g1) >= 4 }
];
// ⛔ ឈ្មោះឯកសារដែលជា credential ដោយខ្លួនវា (មិនត្រូវ commit ដាច់ខាត · .gitignore មួយផ្នែក)
const SECRET_FILE_NAMES = /(^|\/)(\.env(\.[A-Za-z0-9_-]+)?|google-services\.json|GoogleService-Info\.plist|service-account[^/]*\.json|[^/]*\.(jks|keystore|p12|pfx|pem|key))$/i;
// ⛔ ឯកសារ env ដែល commit ត្រូវមានតែឈ្មោះក្នុង `onlyKeys` (តម្លៃសាធារណៈ) ➜ env ថ្មីក្នុងឯកសារនោះ = ធ្លាក់
const SECRET_FILE_ALLOW = [
    { file: 'ZoeW/.env.android', onlyKeys: ['VITE_NATIVE_WEB_ORIGIN'], reason: 'origin សាធារណៈរបស់ ZoeW សម្រាប់ build APK (`vite build --mode android`) · គ្មាន secret' }
];
// ⛔ បញ្ជីអនុញ្ញាត ៖ ឯកសារ + ប្រភេទ + ហេតុផល ➜ ធាតុដែលលែងរកឃើញ = ធ្លាក់
const SECRET_ALLOW = [
    { file: 'audit-tools/idtoken-fixture.js', kind: 'pem-private-key',
        reason: 'កូនសោ RSA សម្រាប់តេស្តតែប៉ុណ្ណោះ ៖ ចុះហត្ថលេខា ID token ក្លែង ដែលអ្នកផ្ទៀងផ្ទាត់ទុកចិត្តតែតាម JWKS ដែលតេស្តចាក់ចូល (production ប្រើ JWKS របស់ Google)' },
    { file: 'audit-tools/secret-hygiene.js', kind: 'url-credentials',
        reason: 'វ៉ិចទ័រតេស្ត `https://user:…@host` ដែល `redactUrl()` ត្រូវលាក់ (ការវាស់ការលាក់ secret មុនផ្ញើ Sentry)' }
];
function scanSecrets(name, text) {
    const found = [];
    for (const k of SECRET_KINDS) {
        k.re.lastIndex = 0;
        let m;
        while ((m = k.re.exec(text)) !== null) {
            if (k.near && !k.near.test(text.slice(Math.max(0, m.index - 400), m.index + 400))) continue;
            if (k.keep && !k.keep(m[0], m[1])) continue;
            const line = text.slice(0, m.index).split('\n').length;
            found.push({ file: name, kind: k.kind, line, sample: m[0].slice(0, 12) + '…' });
        }
    }
    return found;
}
console.log('\n== ក. secret ក្នុងឯកសារ repo (public) ==');
{
    const all = [];
    for (const [name, text] of TEXT) {
        if (/(^|\/)package-lock\.json$/.test(name) || name === 'audit-tools/security-guard-test.js') continue;
        all.push(...scanSecrets(name, text));
    }
    const allowedHit = (f) => SECRET_ALLOW.some((a) => a.file === f.file && a.kind === f.kind);
    const leaks = all.filter((f) => !allowedHit(f));
    ok(leaks.length === 0, '⛔ គ្មាន secret (កូនសោឯកជន · API key · token · service_role · Cookie ZTO ពិត · credential ក្នុង URL) ក្នុងឯកសារ repo',
        leaks.slice(0, 20).map((f) => f.file + ':' + f.line + ' [' + f.kind + '] ' + f.sample).join('\n        '));
    const dead = SECRET_ALLOW.filter((a) => !all.some((f) => f.file === a.file && f.kind === a.kind));
    ok(dead.length === 0, 'បញ្ជីអនុញ្ញាត secret ៖ គ្មានធាតុងាប់ (ធាតុនីមួយៗនៅត្រូវគ្នានឹងអ្វីមួយ ហើយមានហេតុផល)',
        dead.map((a) => a.file + ' [' + a.kind + ']').join(' · '));
    ok(SECRET_ALLOW.every((a) => typeof a.reason === 'string' && a.reason.length >= 20), 'បញ្ជីអនុញ្ញាត secret ៖ ធាតុនីមួយៗមានហេតុផល');
    const secretFiles = FILES.filter((n) => SECRET_FILE_NAMES.test(n) && !SECRET_FILE_ALLOW.some((a) => a.file === n));
    ok(secretFiles.length === 0, '⛔ គ្មានឯកសារ credential (.env · keystore · google-services.json · service-account · .pem/.key) ក្នុង repo', secretFiles.join(' · '));
    const envDrift = [];
    for (const a of SECRET_FILE_ALLOW) {
        const t = TEXT.get(a.file);
        if (t === undefined) { envDrift.push(a.file + ' ៖ គ្មាន (ធាតុងាប់)'); continue; }
        t.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).forEach((l) => {
            const key = l.split('=')[0].trim();
            if (a.onlyKeys.indexOf(key) === -1) envDrift.push(a.file + ' ៖ ' + key);
        });
        if (scanSecrets(a.file, t).length) envDrift.push(a.file + ' ៖ មាន secret');
    }
    ok(envDrift.length === 0 && SECRET_FILE_ALLOW.every((a) => a.reason.length >= 20), 'ឯកសារ env ដែល commit ៖ តែឈ្មោះសាធារណៈក្នុងបញ្ជី · គ្មាន secret · គ្មានធាតុងាប់', envDrift.join(' · '));
    // ទិសផ្ទុយ ៖ ការលេចធ្លាយក្លែង (សាងពេលរត់ ➜ ឯកសារនេះមិនផ្ទុកវាផ្ទាល់) ត្រូវរកឃើញគ្រប់ប្រភេទ
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
    const fakeJwt = (payload) => 'eyJ' + b64({ alg: 'HS256', typ: 'JWT' }).slice(3) + '.' + b64(payload) + '.' + 'Q'.repeat(43);
    const rnd = (n, set) => { let s = ''; let x = 7; for (let i = 0; i < n; i++) { x = (x * 1103515245 + 12345) % 2147483648; s += set[x % set.length]; } return s; };
    const AN = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const probes = {
        'pem-private-key': '-----BEGIN ' + 'PRIVATE KEY-----\nMIIB',
        'google-api-key': 'AI' + 'za' + rnd(35, AN),
        'supabase-secret-key': 'sb_' + 'secret_' + rnd(32, AN),
        'github-token': 'gh' + 'p_' + rnd(36, AN),
        'netlify-token': 'nf' + 'p_' + rnd(40, AN),
        'npm-token': 'np' + 'm_' + rnd(36, AN),
        'sentry-auth-token': 'sntr' + 'ys_' + rnd(40, AN),
        'slack-token': 'xo' + 'xb-' + rnd(24, AN),
        'aws-access-key': 'AK' + 'IA' + rnd(16, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'),
        'firebase-service-account': '{"type": "service_' + 'account", "project_id": "p", "private_key": "x"}',
        'private-jwk': '{"kty":"EC","crv":"P-256","x":"a","y":"b","d":"' + rnd(43, AN) + '"}',
        'jwt': fakeJwt({ iss: 'supabase', role: 'service_' + 'role' }),
        'zto-session-cookie': 'BOS-MAN-' + 'SESSION=' + rnd(32, AN),
        'url-credentials': 'https://admin:' + rnd(16, AN) + '@db.example.org',
        'credential-assignment': 'pass' + 'word = "' + rnd(28, AN) + '"'
    };
    const missed = SECRET_KINDS.map((k) => k.kind).filter((kind) => !scanSecrets('probe', probes[kind] || '').some((f) => f.kind === kind));
    ok(missed.length === 0, 'ទិសផ្ទុយ ៖ ការលេចធ្លាយក្លែងគ្រប់ប្រភេទ (' + SECRET_KINDS.length + ') ត្រូវរកឃើញ', missed.join(' · '));
    const quiet = [
        'BOS-MAN-SESSION=synthetic-old-session', fakeJwt({ iss: 'supabase', role: 'anon' }), 'https://user:${PASS}@host',
        'password = "' + 'synthetic-password-for-tests-only' + '"', '{"kty":"EC","crv":"P-256","x":"' + rnd(43, AN) + '","y":"' + rnd(43, AN) + '"}'
    ].filter((s) => scanSecrets('quiet', s).length > 0);
    ok(quiet.length === 0, 'ទិសផ្ទុយ ៖ តម្លៃសំយោគ · anon key · placeholder · JWK សាធារណៈ មិនត្រូវចាត់ជា secret', quiet.join(' · '));
    ok(SECRET_FILE_NAMES.test('ZoeW/android/app/google-services.json') && SECRET_FILE_NAMES.test('release.jks') && SECRET_FILE_NAMES.test('tools/x/.env')
        && !SECRET_FILE_NAMES.test('ZoeW/.env.example.md'), 'ទិសផ្ទុយ ៖ ឈ្មោះឯកសារ credential ត្រូវរកឃើញ');
}

// ── ខ. App ដែល ship ───────────────────────────────────────────────────────────────
console.log('\n== ខ. App ដែល ship (bundle client) ==');
{
    const clientFiles = [...TEXT.keys()].filter((n) => (/^ZoeW\/src\//.test(n) && !/\.test\.tsx?$/.test(n)) || /^ZoeW\/public\/[^/]+\.(js|html|json)$/.test(n)
        || n === 'ZoeW/index.html' || /^ZoeKeyGen\/[^/]+\.(js|html)$/.test(n));
    ok(clientFiles.length >= 80, 'ជាន់អប្បបរមា ៖ ឯកសារកូដ client (ZoeW/src · public · ZoeKeyGen) ≥ ៨០', clientFiles.length);
    // ⛔ Vite បញ្ចូលតម្លៃ `import.meta.env.VITE_*` ទៅក្នុង bundle ដែលអ្នកណាក៏ទាញបាន ➜ ឈ្មោះ env ក្នុង client ត្រូវស្ថិតក្នុងបញ្ជី
    const ENV_ALLOW = {
        DEV: 'ទង់ build របស់ Vite (boolean)', PROD: 'ទង់ build របស់ Vite (boolean)', MODE: 'mode build របស់ Vite', BASE_URL: 'base path',
        VITE_EXPOSE_GLOBALS: 'audit build តែប៉ុណ្ណោះ (បើក function លើ window) ➜ មិនមែន secret',
        VITE_NATIVE_WEB_ORIGIN: 'origin ផ្ទុក web របស់ APK (URL សាធារណៈ)'
    };
    const envUse = [];
    for (const n of clientFiles) {
        const t = TEXT.get(n);
        const re = /\b(?:import\.meta\.env|process\.env)\.([A-Za-z_][A-Za-z0-9_]*)/g;
        let m;
        while ((m = re.exec(t)) !== null) envUse.push({ file: n, name: m[1] });
    }
    const badEnv = envUse.filter((u) => !Object.prototype.hasOwnProperty.call(ENV_ALLOW, u.name) || /(SECRET|TOKEN|PASSWORD|PASSWD|PRIVATE|SERVICE_ROLE|_KEY|_PAT)$/i.test(u.name));
    ok(badEnv.length === 0, '⛔ កូដ client អានតែ env ក្នុងបញ្ជី (Vite បញ្ចូលតម្លៃទៅក្នុង bundle សាធារណៈ)', badEnv.map((u) => u.file + ' ➜ ' + u.name).join(' · '));
    ok(envUse.length >= 2, 'ជាន់អប្បបរមា ៖ រកឃើញការប្រើ env ក្នុង client (ឧ. DEV) ➜ ការវាស់មិនទទេ', envUse.length);
    // ⛔ ឈ្មោះ secret របស់ server មិនត្រូវលេចក្នុងកូដ client (សញ្ញាថាកូដ server/secret ត្រូវបានលាយចូល bundle)
    const SERVER_ONLY = ['SUPABASE_SERVICE_ROLE_KEY', 'ZOE_SECRET_KEY', 'NETLIFY_AUTH_TOKEN', 'ZOE_BACKUP_PASSPHRASE', 'ZOEW_KEYSTORE_PASSWORD', 'ZOEW_KEY_PASSWORD',
        'VAPID_PRIVATE_KEY', 'FIREBASE_SERVICE_ACCOUNT', 'GOOGLE_APPLICATION_CREDENTIALS'];
    const serverNames = [];
    for (const n of clientFiles) for (const s of SERVER_ONLY) if (TEXT.get(n).indexOf(s) !== -1) serverNames.push(n + ' ➜ ' + s);
    ok(serverNames.length === 0, '⛔ ឈ្មោះ secret របស់ server មិនលេចក្នុងកូដ client', serverNames.join(' · '));
    // ⛔ vite.config ៖ sourcemap បិទ · define តែក្នុងបញ្ជី · គ្មាន envPrefix ពង្រីក (ការពារ env secret ធ្លាក់ចូល bundle)
    const vite = TEXT.get('ZoeW/vite.config.mts') || '';
    ok(/sourcemap:\s*false/.test(vite), 'vite.config ៖ `sourcemap: false` (bundle ផលិតកម្មគ្មាន .map)');
    ok(!/envPrefix\s*:/.test(vite) && !/loadEnv\s*\(/.test(vite), 'vite.config ៖ គ្មាន `envPrefix`/`loadEnv` (env ផ្សេងក្រៅ VITE_* មិនចូល bundle)');
    const DEFINE_ALLOW = ['__APP_VERSION__', '__CACHE_VERSION__', '__FCM_CONFIGURED__', '__CORE_SHELL__', '__OPTIONAL_SHELL__', '__BACKEND_SHELL__'];
    const defineKeys = [];
    const dre = /define:\s*\{([\s\S]*?)\}/g;
    let dm;
    while ((dm = dre.exec(vite)) !== null) { const kre = /(__[A-Z_]+__)\s*:/g; let km; while ((km = kre.exec(dm[1])) !== null) defineKeys.push(km[1]); }
    ok(defineKeys.length >= 3 && defineKeys.every((k) => DEFINE_ALLOW.indexOf(k) !== -1) && !/define:\s*\{[\s\S]*?process\.env\.(?!VITE_EXPOSE_GLOBALS)/.test(vite),
        'vite.config ៖ `define` តែក្នុងបញ្ជី ហើយមិនបញ្ចូល process.env ទៅក្នុង bundle', defineKeys.join(' · '));
}

// ── គ. ទិន្នន័យអតិថិជន (PII) ──────────────────────────────────────────────────────
// ⛔ លេខទូរស័ព្ទកម្ពុជា (0 ឬ 855 + លេខក្រុមហ៊ុន ២ ខ្ទង់ + ៦–៧ ខ្ទង់) និងលេខ waybill ZTO (១៤ ខ្ទង់ ៖ 7713… · 1160…) ក្នុង repo public ត្រូវជា
//    **លេខសំយោគ** ៖ លេខអតិថិជន (ក្រោយលេខក្រុមហ៊ុន) មាន `000` (ឧ. 096 000 1234) ឬលំនាំច្បាស់ (ខ្ទង់ដដែល · ជួរកើន/ថយ) · waybill មាន `0000`។
//    ទិន្នន័យពិតពីហាង (វីដេអូ · Console · dump) ចូល fixture ➜ ក្រហមភ្លាម ➜ ប្តូរជាលេខសំយោគមុន commit (ប្តូរ ៣ ខ្ទង់ក្រោយលេខក្រុមហ៊ុនជា `000`)។
const PHONE_RE = /(?<![0-9A-Za-z_+])(?:\+?855|0)(1[0-9]|[2-9][0-9])([0-9]{6,7})(?![0-9A-Za-z_])/g;
const WAYBILL_RE = /(?<![0-9A-Za-z_])((?:7713|1160)[0-9]{10})(?![0-9A-Za-z_])/g;
// ប្រវែងជួរកើន ឬថយជាប់គ្នាវែងបំផុត (123456 · 98765)
function longestStep(d) {
    let best = 1;
    let up = 1;
    let down = 1;
    for (let i = 1; i < d.length; i++) {
        const a = Number(d[i - 1]);
        const b = Number(d[i]);
        up = b === (a + 1) % 10 ? up + 1 : 1;
        down = b === (a + 9) % 10 ? down + 1 : 1;
        best = Math.max(best, up, down);
    }
    return best;
}
// លេខសំយោគ ៖ មាន `000` · ខ្ទង់ខុសគ្នា ≤ ២ · គូ ៣ ជាប់គ្នា (223344) · ខ្ទង់ដដែលជាប់ ≥ ៥ · ក្រុមខ្ទង់ដដែល (≥ ៣) ពីរ (111222) · ជួរ ≥ ៥ (123456) ·
// ក្រុមដដែល + ជួរ ≥ ៤ (5551234)
function syntheticDigits(d) {
    if (d.indexOf('000') !== -1) return true;
    if (new Set(d.split('')).size <= 2) return true;
    if (/(\d)\1(\d)\2(\d)\3/.test(d)) return true;
    const runs = d.match(/(\d)\1\1+/g) || [];
    if (runs.some((r) => r.length >= 5)) return true;
    const seq = longestStep(d);
    return runs.length >= 2 || seq >= 5 || (runs.length >= 1 && seq >= 4);
}
function scanPii(name, text) {
    const out = [];
    let m;
    PHONE_RE.lastIndex = 0;
    while ((m = PHONE_RE.exec(text)) !== null) if (!syntheticDigits(m[2])) out.push({ file: name, kind: 'phone', value: m[0], line: text.slice(0, m.index).split('\n').length });
    WAYBILL_RE.lastIndex = 0;
    while ((m = WAYBILL_RE.exec(text)) !== null) if (!syntheticDigits(m[1].slice(6)) && m[1].slice(4).indexOf('0000') === -1) out.push({ file: name, kind: 'waybill', value: m[1], line: text.slice(0, m.index).split('\n').length });
    return out;
}
console.log('\n== គ. ទិន្នន័យអតិថិជន (លេខទូរស័ព្ទ · waybill) ក្នុង repo public ==');
{
    const PII_SKIP = (n) => /(^|\/)package-lock\.json$/.test(n) || /(^|\/)vendor\//.test(n) || /\.min\.js$/.test(n) || /^(LICENSE|NOTICE)$|^LICENSES\//.test(n)
        || n === 'audit-tools/security-guard-test.js';
    const hits = [];
    let scanned = 0;
    for (const [name, text] of TEXT) { if (PII_SKIP(name)) continue; scanned++; hits.push(...scanPii(name, text)); }
    ok(scanned >= 250, 'ជាន់អប្បបរមា ៖ វាស់ឯកសារអត្ថបទ ≥ ២៥០', scanned);
    ok(hits.length === 0, '⛔ លេខទូរស័ព្ទ/waybill ក្នុង repo ជាលេខសំយោគទាំងអស់ (`000` ក្នុងលេខអតិថិជន ឬលំនាំច្បាស់ ៖ ខ្ទង់ដដែល · ជួរកើន/ថយ · waybill មាន `0000`)',
        hits.slice(0, 25).map((h) => h.file + ':' + h.line + ' ' + h.kind + ' ' + h.value).join('\n        ') + (hits.length > 25 ? '\n        … សរុប ' + hits.length : ''));
    // ទិសផ្ទុយ ៖ លេខ «ដូចពិត» សាងពេលរត់ពីខ្ទង់ចៃដន្យ (ឯកសារនេះមិនផ្ទុកលេខអតិថិជនពិតណាមួយ) ➜ ត្រូវរកឃើញគ្រប់ទម្រង់
    let seed = 20261009;
    const digits = (n) => { let out = ''; while (out.length < n) { seed = (seed * 1103515245 + 12345) % 2147483648; out += String(Math.floor(seed / 65536) % 10); } return out; };
    const randomSub = (n) => { for (let i = 0; i < 1000; i++) { const d = digits(n); if (!syntheticDigits(d)) return d; } return ''; };
    const s7 = randomSub(7);
    const s6 = randomSub(6);
    const w8 = randomSub(8);
    const real = ['096' + s7, '855' + '96' + s7, '+855' + '96' + s7, '060' + s6, '7713' + '05' + w8, '1160' + '01' + w8];
    ok(s7.length === 7 && s6.length === 6 && w8.length === 8 && real.every((v) => scanPii('probe', ' ' + v + ' ').length === 1),
        'ទិសផ្ទុយ ៖ លេខទូរស័ព្ទ/waybill ដូចពិត (ទម្រង់ 0 · 855 · +855 · waybill 7713/1160) ត្រូវរកឃើញ', real.join(' · '));
    const fakeOk = ['096' + '0001234', '855' + '960001234', '097' + '7777777', '012' + '345678', '011' + '222333', '011' + '223344', '096' + '5551234', '0912000001',
        '7713' + '0500000222', '1160' + '0100000415', '2026' + '1009', '1790902755000', 'a096' + s7 + 'b'];
    ok(fakeOk.every((v) => scanPii('probe', ' ' + v + ' ').length === 0), 'ទិសផ្ទុយ ៖ លេខសំយោគ · កាលបរិច្ឆេទ · ត្រាពេល · hex មិនត្រូវចាត់ជាទិន្នន័យអតិថិជន',
        fakeOk.filter((v) => scanPii('probe', ' ' + v + ' ').length !== 0).join(' · '));
}

// ── ឃ. CSP និង header security ────────────────────────────────────────────────────
console.log('\n== ឃ. CSP និង header security (App ទាំង ២) ==');
const SCRIPT_SRC_ALLOW = {
    "'self'": 'កូដរបស់ App ខ្លួនឯង',
    "'wasm-unsafe-eval'": 'ZoeW តែប៉ុណ្ណោះ ៖ ម៉ាស៊ីនស្កេន ZXing-WASM (មិនអនុញ្ញាត eval របស់ JS)',
    'https://www.gstatic.com/firebasejs/': 'Firebase JS SDK (`firebase-loader.js`) ➜ កំណត់ត្រឹមថត firebasejs (www.gstatic.com ទាំងមូលមានឧបករណ៍រំលង CSP)',
    'https://js.sentry-cdn.com': 'Sentry Loader (async)',
    'https://browser.sentry-cdn.com': 'bundle Sentry ដែល Loader ទាញ',
    'https://*.firebaseio.com': 'RTDB long-polling (JSONP) ពេល WebSocket ត្រូវបិទ',
    'https://*.firebasedatabase.app': 'RTDB long-polling (JSONP) តំបន់ក្រៅ US'
};
const CONNECT_SRC_ALLOW = {
    "'self'": 'Netlify Functions និង feed របស់ App',
    'https://www.gstatic.com': 'ការវាស់ថា host SDK ឆ្លើយ (`generate_204`)',
    'https://zoew.netlify.app': 'ZoeKeyGen ៖ ផ្ញើ Setup/សេវា ZoeW',
    'https://*.firebaseio.com': 'Firebase RTDB', 'wss://*.firebaseio.com': 'Firebase RTDB (WebSocket)',
    'https://*.firebasedatabase.app': 'Firebase RTDB តំបន់ក្រៅ US', 'wss://*.firebasedatabase.app': 'Firebase RTDB តំបន់ក្រៅ US (WebSocket)',
    'https://*.supabase.co': 'Supabase (PostgREST · Auth · Functions)', 'wss://*.supabase.co': 'Supabase Realtime',
    'https://*.googleapis.com': 'Firebase Auth (identitytoolkit · securetoken)',
    'https://script.google.com': 'Apps Script (តារាងអតិថិជន · នាំចូល Excel)', 'https://*.googleusercontent.com': 'Apps Script redirect ចម្លើយ',
    'https://*.ingest.sentry.io': 'Sentry', 'https://*.ingest.us.sentry.io': 'Sentry (US)', 'https://*.ingest.de.sentry.io': 'Sentry (EU)'
};
function cspOf(toml) {
    const m = /Content-Security-Policy\s*=\s*"([^"]+)"/.exec(toml || '');
    const out = {};
    if (!m) return null;
    m[1].split(';').map((s) => s.trim()).filter(Boolean).forEach((d) => { const parts = d.split(/\s+/); out[parts[0]] = parts.slice(1); });
    return out;
}
function cspProblems(app, toml, usedHosts) {
    const p = [];
    const csp = cspOf(toml);
    if (!csp) return ['គ្មាន Content-Security-Policy'];
    const req = { 'default-src': ["'self'"], 'object-src': ["'none'"], 'base-uri': ["'self'"], 'frame-ancestors': ["'none'"], 'form-action': ["'self'"] };
    Object.keys(req).filter((d) => JSON.stringify(csp[d] || []) !== JSON.stringify(req[d])).forEach((d) => p.push(d + ' មិនតឹងរ៉ឹង ៖ ' + (csp[d] || []).join(' ')));
    const script = csp['script-src'] || [];
    if (!script.length) p.push('គ្មាន script-src');
    script.filter((s) => /^'unsafe-(inline|eval|hashes)'$|^\*$|^https?:$|^data:$|^blob:$|^http:\/\//.test(s)).forEach((s) => p.push('script-src ហាម ៖ ' + s));
    script.filter((s) => !Object.prototype.hasOwnProperty.call(SCRIPT_SRC_ALLOW, s) || (s === "'wasm-unsafe-eval'" && app !== 'ZoeW'))
        .forEach((s) => p.push('script-src ក្រៅបញ្ជី ៖ ' + s));
    const connect = csp['connect-src'] || [];
    if (!connect.length) p.push('គ្មាន connect-src');
    connect.filter((s) => !Object.prototype.hasOwnProperty.call(CONNECT_SRC_ALLOW, s)).forEach((s) => p.push('connect-src ក្រៅបញ្ជី ៖ ' + s));
    if (usedHosts) script.concat(connect).forEach((s) => usedHosts.add(s));
    const headers = {
        'X-Frame-Options DENY': /X-Frame-Options\s*=\s*"DENY"/, 'X-Content-Type-Options nosniff': /X-Content-Type-Options\s*=\s*"nosniff"/,
        'Referrer-Policy': /Referrer-Policy\s*=\s*"(strict-origin-when-cross-origin|no-referrer|same-origin|strict-origin)"/,
        'Cross-Origin-Opener-Policy same-origin': /Cross-Origin-Opener-Policy\s*=\s*"same-origin"/,
        'Permissions-Policy (microphone · geolocation បិទ)': /Permissions-Policy\s*=\s*"[^"]*microphone=\(\)[^"]*geolocation=\(\)/
    };
    Object.keys(headers).filter((h) => !headers[h].test(toml)).forEach((h) => p.push('ខ្វះ header ' + h));
    const hsts = /Strict-Transport-Security\s*=\s*"max-age=(\d+)/.exec(toml);
    if (!hsts || Number(hsts[1]) < 31536000) p.push('HSTS ខ្វះ ឬ < ១ ឆ្នាំ');
    toml.split('[[headers]]').filter((b) => /Access-Control-Allow-Origin\s*=\s*"\*"/.test(b))
        .map((b) => (/for\s*=\s*"([^"]+)"/.exec(b) || [])[1]).filter((f) => f !== '/announcements.json')
        .forEach((f) => p.push('CORS * លើ ' + f));
    return p;
}
{
    const used = new Set();
    for (const app of ['ZoeW', 'ZoeKeyGen']) {
        const problems = cspProblems(app, TEXT.get(app + '/netlify.toml') || '', used);
        ok(problems.length === 0, '⛔ ' + app + ' ៖ CSP តឹងរ៉ឹង (គ្មាន unsafe-inline/eval · ប្រភព script/connect តែក្នុងបញ្ជីដែលមានហេតុផល) · header security គ្រប់ (XFO · nosniff · Referrer · HSTS ≥ ១ ឆ្នាំ · COOP · Permissions) · CORS * តែ feed សាធារណៈ',
            problems.join('\n        '));
    }
    const deadAllow = Object.keys(SCRIPT_SRC_ALLOW).concat(Object.keys(CONNECT_SRC_ALLOW)).filter((s) => !used.has(s));
    ok(deadAllow.length === 0, 'បញ្ជីអនុញ្ញាត CSP ៖ គ្មានធាតុងាប់', deadAllow.join(' · '));
    const weak = '[[headers]]\n  for = "/*"\n  [headers.values]\n    Content-Security-Policy = "default-src *; script-src \'self\' \'unsafe-inline\' https://evil.example; connect-src * https://exfil.example; object-src \'self\'"\n'
        + '[[headers]]\n  for = "/api/*"\n  [headers.values]\n    Access-Control-Allow-Origin = "*"\n';
    const found = cspProblems('probe', weak, null);
    const expect = ["default-src", "'unsafe-inline'", 'https://evil.example', 'https://exfil.example', 'object-src', 'X-Frame-Options', 'HSTS', '/api/*'];
    const missedProbe = expect.filter((e) => !found.some((f) => f.indexOf(e) !== -1));
    ok(missedProbe.length === 0, 'ទិសផ្ទុយ ៖ policy ខ្សោយ (default-src * · unsafe-inline · host ថ្មី · connect ចេញក្រៅ · object-src · header ខ្វះ · CORS *) ត្រូវរកឃើញ', missedProbe.join(' · '));
}

// ⛔ CORS របស់ Function (Netlify · Supabase Edge) ៖ `Access-Control-Allow-Origin: *` តែក្នុងបញ្ជីដែលមានហេតុផល · `Allow-Credentials` ហាម
const CORS_STAR_ALLOW = {
    'ZoeW/netlify/lib/push-core.mjs': 'Push ៖ ផ្ទៀងផ្ទាត់ដោយ Activation Key / session token ក្នុង body (គ្មាន Cookie) ➜ origin ផ្សេងគ្មាន credential ដែល browser ភ្ជាប់ឲ្យដោយស្វ័យប្រវត្តិ'
};
function corsProblems(name, text) {
    const p = [];
    if (/Access-Control-Allow-Origin['"]?\s*[:,=]\s*['"`]\*['"`]/.test(text) && !Object.prototype.hasOwnProperty.call(CORS_STAR_ALLOW, name)) p.push(name + ' ៖ Allow-Origin * ក្រៅបញ្ជី');
    if (/Access-Control-Allow-Credentials/i.test(text)) p.push(name + ' ៖ Allow-Credentials');
    return p;
}
{
    const fnFiles = [...TEXT.keys()].filter((n) => /^ZoeW\/netlify\/(functions|lib)\/[^/]+\.(m?js)$/.test(n) || /^supabase\/functions\/.+\.ts$/.test(n));
    ok(fnFiles.length >= 5, 'ជាន់អប្បបរមា ៖ ឯកសារ Function (Netlify · Supabase Edge) ≥ ៥', fnFiles.length);
    const problems = [];
    fnFiles.forEach((n) => problems.push(...corsProblems(n, TEXT.get(n))));
    ok(problems.length === 0, '⛔ Function ៖ CORS `*` តែក្នុងបញ្ជីដែលមានហេតុផល · គ្មាន Allow-Credentials', problems.join(' · '));
    const deadC = Object.keys(CORS_STAR_ALLOW).filter((n) => !TEXT.has(n) || !/Access-Control-Allow-Origin['"]?\s*[:,=]\s*['"`]\*['"`]/.test(TEXT.get(n)));
    ok(deadC.length === 0, 'បញ្ជីអនុញ្ញាត CORS ៖ គ្មានធាតុងាប់', deadC.join(' · '));
    const probe = corsProblems('probe.js', "headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Credentials': 'true' }");
    ok(probe.length === 2, 'ទិសផ្ទុយ ៖ CORS * ថ្មី និង Allow-Credentials ត្រូវរកឃើញ', probe);
}

// ── ង. GitHub Actions ─────────────────────────────────────────────────────────────
console.log('\n== ង. GitHub Actions (repo public ➜ PR ពី fork) ==');
const WORKFLOW_WRITE_ALLOW = { '.github/workflows/android-release.yml': 'បង្កើត GitHub Release (APK) ➜ `contents: write` · trigger តែ push main/workflow_dispatch' };
function jobsOf(text) {
    const lines = text.split('\n');
    const start = lines.findIndex((l) => /^jobs:\s*$/.test(l));
    const jobs = [];
    if (start === -1) return jobs;
    let cur = null;
    for (let i = start + 1; i < lines.length; i++) {
        const l = lines[i];
        if (/^\S/.test(l)) break;
        const m = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(l);
        if (m) { cur = { name: m[1], lines: [] }; jobs.push(cur); continue; }
        if (cur) cur.lines.push(l);
    }
    return jobs.map((j) => ({ name: j.name, text: j.lines.join('\n') }));
}
function workflowProblems(name, text) {
    const p = [];
    const on = (/^on:\s*\n([\s\S]*?)^\S/m.exec(text + '\nEND') || [])[1] || '';
    if (/pull_request_target|workflow_run/.test(on)) p.push('trigger pull_request_target/workflow_run (កូដ fork + secret)');
    const perm = /^permissions:\s*\n((?: {2}.*\n)+)/m.exec(text + '\n');
    if (!perm) p.push('គ្មាន `permissions:` កម្រិតឯកសារ (token លំនាំដើមអាចសរសេរបាន)');
    const writes = (text.match(/^\s+[a-z-]+:\s*write\s*$/gm) || []);
    if (writes.length && !Object.prototype.hasOwnProperty.call(WORKFLOW_WRITE_ALLOW, name)) p.push('សិទ្ធិ write ក្រៅបញ្ជី ៖ ' + writes.map((s) => s.trim()).join(', '));
    const usesRe = /uses:\s*([A-Za-z0-9_.-]+)\/([A-Za-z0-9_./-]+)@([^\s#]+)/g;
    let u;
    while ((u = usesRe.exec(text)) !== null) {
        if (u[1] !== 'actions' && u[1] !== 'github' && !/^[0-9a-f]{40}$/.test(u[3])) p.push('action ខាងក្រៅមិន pin SHA ៖ ' + u[1] + '/' + u[2] + '@' + u[3]);
    }
    text.split('\n').forEach((l, i) => {
        if (/\$\{\{\s*secrets\./.test(l) && !/^\s*[A-Za-z_][A-Za-z0-9_]*:\s*\$\{\{\s*secrets\.[A-Za-z0-9_]+\s*\}\}\s*$/.test(l)) p.push('secret ក្រៅទម្រង់ env (បន្ទាត់ ' + (i + 1) + ')');
        if (/\b(echo|printf|Write-Host|Write-Output)\b.*\$\{\{\s*secrets\./.test(l)) p.push('បោះពុម្ព secret (បន្ទាត់ ' + (i + 1) + ')');
    });
    const prTrigger = /\bpull_request\b/.test(on);
    for (const job of jobsOf(text)) {
        const runsOn = (/runs-on:\s*(.*)/.exec(job.text) || [])[1] || '';
        const iff = (/^\s{4}if:\s*(.*)$/m.exec(job.text) || [])[1] || '';
        if (/self-hosted/.test(runsOn)) {
            if (prTrigger && iff.indexOf('github.event.pull_request.head.repo.full_name == github.repository') === -1) p.push('job ' + job.name + ' ៖ runner self-hosted គ្មានការការពារ PR ពី fork');
            if (iff.indexOf('github.event.repository.private == true') === -1) p.push('job ' + job.name + ' ៖ runner self-hosted គ្មានលក្ខខណ្ឌ repo ឯកជន (repo public ➜ fork)');
        }
    }
    if (writes.length) {
        const re = /uses:\s*actions\/checkout@[^\n]*\n((?:\s{8,}.*\n){0,6})/g;
        let c;
        while ((c = re.exec(text + '\n')) !== null) if (!/persist-credentials:\s*false/.test(c[1])) p.push('checkout ក្នុង workflow ដែលមាន write ត្រូវ `persist-credentials: false`');
    }
    return p;
}
{
    const wf = [...TEXT.keys()].filter((n) => /^\.github\/workflows\/[^/]+\.ya?ml$/.test(n));
    ok(wf.length >= 3, 'ជាន់អប្បបរមា ៖ workflow ≥ ៣', wf.length);
    const problems = [];
    for (const n of wf) workflowProblems(n, TEXT.get(n)).forEach((x) => problems.push(n + ' ៖ ' + x));
    ok(problems.length === 0, '⛔ workflow ៖ គ្មាន trigger ពី fork ជាមួយ secret · សិទ្ធិតិចបំផុត · self-hosted មានការការពារ · action ខាងក្រៅ pin SHA · secret តាម env · write ➜ persist-credentials false',
        problems.join('\n        '));
    const deadW = Object.keys(WORKFLOW_WRITE_ALLOW).filter((n) => !wf.includes(n) || !/:\s*write\s*$/m.test(TEXT.get(n)));
    ok(deadW.length === 0, 'បញ្ជីអនុញ្ញាត write ៖ គ្មានធាតុងាប់', deadW.join(' · '));
    const evil = 'on:\n  pull_request_target:\njobs:\n  x:\n    runs-on: [self-hosted]\n    steps:\n      - uses: evil/act@v1\n      - run: echo ${{ secrets.TOKEN }}\n';
    const found = workflowProblems('.github/workflows/evil.yml', evil);
    ok(found.length >= 5, 'ទិសផ្ទុយ ៖ workflow គ្រោះថ្នាក់ (pull_request_target · គ្មាន permissions · self-hosted · action មិន pin · បោះពុម្ព secret) ត្រូវរកឃើញ', found.join(' · '));
}

// ── ច. Firebase rules ─────────────────────────────────────────────────────────────
console.log('\n== ច. Firebase rules (Business · License) ==');
const RULES_PUBLIC_ALLOW = [
    { file: 'ZoeKeyGen/firebase-database.rules.json', path: '/license_keys/$appCode/$keyId', op: '.read', reason: 'ZoeW ផ្ទៀងផ្ទាត់ Key មុន login (`expiresAt` · `revoked` តែប៉ុណ្ណោះ · គ្មាន listing)' },
    { file: 'ZoeKeyGen/firebase-database.rules.json', path: '/license_seats/$appCode/$keyId', op: '.read', reason: 'ពិនិត្យកៅអីឧបករណ៍ (ត្រូវស្គាល់ keyId · គ្មាន listing · serial = SHA-256)' },
    { file: 'ZoeKeyGen/firebase-database.rules.json', path: '/license_announcements/$appCode', op: '.read', reason: 'ដំណឹងអ្នកលក់ សាធារណៈដោយរចនា (គ្មាន secret)' }
];
function publicRules(rules) {
    const out = [];
    const walk = (n, p) => {
        if (!n || typeof n !== 'object') return;
        for (const [k, v] of Object.entries(n)) {
            if (k === '.read' || k === '.write') {
                const s = typeof v === 'string' ? v : JSON.stringify(v);
                if (s.trim() !== 'false' && s.indexOf('auth') === -1) out.push({ path: p || '/', op: k, value: s });
            } else if (v && typeof v === 'object') walk(v, p + '/' + k);
        }
    };
    walk(rules, '');
    return out;
}
{
    const all = [];
    for (const f of ['firebase-database.rules.json', 'ZoeKeyGen/firebase-database.rules.json']) {
        let rules = null;
        try { rules = JSON.parse(TEXT.get(f)).rules; } catch (e) { rules = null; }
        ok(!!rules, f + ' ៖ អាន rules បាន');
        if (!rules) continue;
        ok(rules['.read'] !== true && rules['.write'] !== true && String(rules['.read']) !== 'true' && String(rules['.write']) !== 'true', f + ' ៖ root default-deny');
        publicRules(rules).forEach((r) => all.push(Object.assign({ file: f }, r)));
    }
    const notAllowed = all.filter((r) => !RULES_PUBLIC_ALLOW.some((a) => a.file === r.file && a.path === r.path && a.op === r.op));
    ok(notAllowed.length === 0, '⛔ ផ្លូវដែលចូលបានដោយគ្មាន `auth` ត្រូវស្ថិតក្នុងបញ្ជីដែលមានហេតុផល', notAllowed.map((r) => r.file + ' ' + r.path + ' ' + r.op + '=' + r.value).join(' · '));
    ok(all.every((r) => r.op !== '.write'), '⛔ គ្មាន `.write` សាធារណៈ', all.filter((r) => r.op === '.write').map((r) => r.path).join(' · '));
    const deadR = RULES_PUBLIC_ALLOW.filter((a) => !all.some((r) => r.file === a.file && r.path === a.path && r.op === a.op));
    ok(deadR.length === 0, 'បញ្ជីអនុញ្ញាត rules ៖ គ្មានធាតុងាប់', deadR.map((a) => a.path).join(' · '));
    const probe = publicRules({ a: { '.read': 'auth != null' }, b: { $x: { '.write': true } }, c: { '.read': 'now > 0' } });
    ok(probe.length === 2 && probe.some((r) => r.path === '/b/$x' && r.op === '.write') && probe.some((r) => r.path === '/c'), 'ទិសផ្ទុយ ៖ `.write: true` និងលក្ខខណ្ឌគ្មាន auth ត្រូវរកឃើញ', probe);
}

// ── ឆ. Supabase ───────────────────────────────────────────────────────────────────
console.log('\n== ឆ. Supabase (Edge Functions · migration) ==');
const VERIFY_JWT_OFF_ALLOW = { register: 'ចុះឈ្មោះដោយលេខកូដអញ្ជើញ ១០០ bit (មិនទាន់មាន session)', 'reset-password': 'កំណត់ពាក្យសម្ងាត់ថ្មីដោយលេខកូដ ១០០ bit (មិនទាន់មាន session)' };
{
    const config = TEXT.get('supabase/config.toml') || '';
    ok(config.length > 0, 'ជាន់អប្បបរមា ៖ អាន supabase/config.toml បាន');
    const off = [];
    const fre = /\[functions\.([A-Za-z0-9_-]+)\]([^[]*)/g;
    let fm;
    while ((fm = fre.exec(config)) !== null) if (/verify_jwt\s*=\s*false/.test(fm[2])) off.push(fm[1]);
    const badOff = off.filter((f) => !Object.prototype.hasOwnProperty.call(VERIFY_JWT_OFF_ALLOW, f));
    ok(off.length >= 1 && badOff.length === 0, '⛔ Edge Function ដែលបិទ verify_jwt តែក្នុងបញ្ជីដែលមានហេតុផល', badOff.join(' · '));
    const deadF = Object.keys(VERIFY_JWT_OFF_ALLOW).filter((f) => off.indexOf(f) === -1);
    ok(deadF.length === 0, 'បញ្ជីអនុញ្ញាត verify_jwt ៖ គ្មានធាតុងាប់', deadF.join(' · '));
    const http = TEXT.get('supabase/functions/_shared/http.ts') || '';
    ok(/allowedOrigins\.includes\(origin\)/.test(http) && /origin-denied/.test(http) && /MAX_BODY_BYTES/.test(http),
        'Edge Function ៖ CORS តាមបញ្ជី origin ពិតប្រាកដ · បដិសេធ origin ផ្សេង · ពិដានទំហំ body');
    const migrations = [...TEXT.keys()].filter((n) => /^supabase\/migrations\/[^/]+\.sql$/.test(n)).sort();
    ok(migrations.length >= 5, 'ជាន់អប្បបរមា ៖ migration ≥ ៥', migrations.length);
    const sql = migrations.map((n) => TEXT.get(n)).join('\n').toLowerCase();
    const tables = new Set();
    const tre = /create\s+table\s+(?:if\s+not\s+exists\s+)?(public\.)?([a-z0-9_]+)\s*\(/g;
    let tm;
    while ((tm = tre.exec(sql)) !== null) tables.add(tm[2]);
    const noRls = [...tables].filter((t) => !new RegExp('alter\\s+table\\s+(?:public\\.)?' + t + '\\s+enable\\s+row\\s+level\\s+security').test(sql));
    ok(tables.size >= 3 && noRls.length === 0, '⛔ រាល់តារាងក្នុង migration បើក RLS (' + tables.size + ')', noRls.join(' · '));
    const anonGrants = (sql.match(/grant\s+[a-z, ]+\s+on\s+(?:table\s+)?(?!function)[a-z0-9_.]+\s+to\s+[a-z, ]*\banon\b/g) || []);
    ok(anonGrants.length === 0, '⛔ គ្មាន grant លើតារាងទៅ `anon`', anonGrants.slice(0, 5).join(' · '));
}

// ── ជ. bundle ផលិតកម្មពិត ────────────────────────────────────────────────────────
console.log('\n== ជ. bundle ផលិតកម្មពិត (vite build ➜ ថតបណ្តោះអាសន្ន) ==');
// ⛔ ការវាស់ប្រភពមិនឃើញអ្វីដែល build បញ្ចូល (define · env · plugin · vendor) ➜ build ពិតរាល់ដង (≈ ២ វិនាទី) មិនពឹង `ZoeW/dist` ដែលនៅសល់
const AUDIT_BRIDGE_MARKERS = ['__auditRebind', 'zoew-audit-rebind'];
const SERVER_ONLY_IN_BUNDLE = ['SUPABASE_SERVICE_ROLE_KEY', 'ZOE_SECRET_KEY', 'NETLIFY_AUTH_TOKEN', 'ZTO_PROXY_KEY', 'ZTO_PROXY_KEYS', 'ZTO_COOKIE',
    'VAPID_PRIVATE_KEY', 'ZOEW_KEYSTORE_PASSWORD', 'ZOE_BACKUP_PASSPHRASE'];
function bundleProblems(files) {
    const p = [];
    for (const f of files) {
        if (/\.map$/.test(f.name)) { p.push(f.name + ' ៖ sourcemap'); continue; }
        if (f.text === null) continue;
        if (/[#@]\s*sourceMappingURL=/.test(f.text)) p.push(f.name + ' ៖ sourceMappingURL');
        scanSecrets(f.name, f.text).forEach((x) => p.push(f.name + ' ៖ ' + x.kind));
        SERVER_ONLY_IN_BUNDLE.filter((n) => f.text.indexOf(n) !== -1).forEach((n) => p.push(f.name + ' ៖ ឈ្មោះ secret server ' + n));
        AUDIT_BRIDGE_MARKERS.filter((n) => f.text.indexOf(n) !== -1).forEach((n) => p.push(f.name + ' ៖ bridge build វាស់ ' + n));
        scanPii(f.name, f.text).forEach((x) => p.push(f.name + ' ៖ ' + x.kind + ' ' + x.value));
    }
    return p;
}
{
    const zoew = path.join(ROOT, 'ZoeW');
    const viteBin = path.join(zoew, 'node_modules', 'vite', 'bin', 'vite.js');
    let out = null;
    let built = { status: null, err: 'គ្មាន ' + rel(viteBin) + ' (npm ci --prefix ZoeW)' };
    if (fs.existsSync(viteBin)) {
        out = fs.mkdtempSync(path.join(os.tmpdir(), 'security-guard-dist-'));
        const env = Object.assign({}, process.env);
        delete env.VITE_EXPOSE_GLOBALS;
        const r = cp.spawnSync(process.execPath, [viteBin, 'build', '--outDir', out, '--emptyOutDir', '--logLevel', 'error'],
            { cwd: zoew, env, encoding: 'utf8', timeout: 150000, maxBuffer: 16 * 1024 * 1024 });
        built = { status: r.status, err: String(r.error || '') + (r.stderr || '').slice(-600) };
    }
    const files = [];
    if (out) {
        const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else files.push(f); } };
        try { walk(out); } catch (e) {}
    }
    const shipped = files.map((f) => ({ name: path.relative(out || '', f).split(path.sep).join('/'), text: BINARY_EXT.test(f) ? null : readText(f) }));
    const bytes = shipped.reduce((n, f) => n + (f.text ? f.text.length : 0), 0);
    ok(built.status === 0, 'build ផលិតកម្មពិតជោគជ័យ (`vite build` · គ្មាន `VITE_EXPOSE_GLOBALS`)', built.err);
    ok(shipped.length >= 15 && shipped.some((f) => f.name === 'index.html') && shipped.some((f) => f.name === 'sw.js')
        && shipped.some((f) => /^assets\/index-[^/]+\.js$/.test(f.name)) && bytes >= 500000,
        'ជាន់អប្បបរមា ៖ bundle មាន index.html · sw.js · assets/index-*.js · ≥ ១៥ ឯកសារ · ≥ ៥០០KB អត្ថបទ', { files: shipped.length, bytes });
    const problems = bundleProblems(shipped);
    ok(problems.length === 0, '⛔ bundle ផលិតកម្ម ៖ គ្មាន sourcemap · secret · ឈ្មោះ secret server · bridge build វាស់ · លេខអតិថិជនពិត',
        problems.slice(0, 15).join('\n        '));
    const fakeBundle = [
        { name: 'assets/x.js', text: 'var k="' + 'sb_' + 'secret_' + 'Q'.repeat(30) + '";\n//# sourceMappingURL=x.js.map' },
        { name: 'assets/x.js.map', text: '{}' },
        { name: 'assets/y.js', text: 'export function __auditRebind(){} var n="' + 'SUPABASE_' + 'SERVICE_ROLE_KEY' + '"' }
    ];
    const caught = bundleProblems(fakeBundle).join(' | ');
    ok(['sourcemap', 'sourceMappingURL', 'supabase-secret-key', 'SUPABASE_SERVICE_ROLE_KEY', '__auditRebind'].every((w) => caught.indexOf(w) !== -1),
        'ទិសផ្ទុយ ៖ bundle ក្លែង (sourcemap · secret · ឈ្មោះ server · bridge) ត្រូវរកឃើញ', caught);
    if (out) { try { fs.rmSync(out, { recursive: true, force: true }); } catch (e) {} }
}

// ── ឈ. Android (Capacitor) ────────────────────────────────────────────────────────
console.log('\n== ឈ. Android (Capacitor) ==');
function capacitorProblems(cfg) {
    const p = [];
    if (!/webContentsDebuggingEnabled:\s*false/.test(cfg)) p.push('webContentsDebuggingEnabled ត្រូវ false (Chrome DevTools អាន WebView ក្នុង APK release បាន)');
    if (!/allowMixedContent:\s*false/.test(cfg)) p.push('allowMixedContent ត្រូវ false');
    if (/\bserver\s*:\s*\{[\s\S]*?\burl\s*:/.test(cfg)) p.push('server.url (live reload ទៅ host ផ្សេង)');
    if (/cleartext\s*:\s*true/.test(cfg)) p.push('cleartext: true');
    return p;
}
function manifestProblems(xml) {
    const p = [];
    if (/usesCleartextTraffic="true"/.test(xml)) p.push('usesCleartextTraffic="true"');
    if (/android:debuggable="true"/.test(xml)) p.push('android:debuggable="true"');
    if (!/android:allowBackup="false"/.test(xml)) p.push('allowBackup មិនមែន false');
    const comps = xml.match(/<(activity|activity-alias|service|receiver|provider)\b[\s\S]*?>/g) || [];
    comps.filter((c) => /android:exported="true"/.test(c)).forEach((c) => {
        const name = (/android:name="([^"]+)"/.exec(c) || [])[1] || '?';
        if (name !== '.MainActivity') p.push('component exported ៖ ' + name);
    });
    comps.filter((c) => /^<provider\b/.test(c) && !/android:exported="false"/.test(c)).forEach((c) => p.push('provider មិនបិទ exported ៖ ' + ((/android:name="([^"]+)"/.exec(c) || [])[1] || '?')));
    return p;
}
{
    const cfg = TEXT.get('ZoeW/capacitor.config.ts') || '';
    const xml = TEXT.get('ZoeW/android/app/src/main/AndroidManifest.xml') || '';
    ok(cfg.length > 0 && xml.length > 0, 'ជាន់អប្បបរមា ៖ អាន capacitor.config.ts និង AndroidManifest.xml បាន');
    const problems = capacitorProblems(cfg).concat(manifestProblems(xml));
    ok(cfg.length > 0 && xml.length > 0 && problems.length === 0, '⛔ APK ៖ WebView debug · mixed content · cleartext បិទ · គ្មាន server.url · component exported តែ Launcher · provider មិន exported',
        problems.join(' · '));
    const badCfg = "android: { allowMixedContent: true, webContentsDebuggingEnabled: true }, server: { url: 'http://192.168.1.5:5173', cleartext: true }";
    const badXml = '<application android:usesCleartextTraffic="true" android:debuggable="true"><activity android:name=".MainActivity" android:exported="true"></activity>'
        + '<receiver android:name=".Leak" android:exported="true"></receiver><provider android:name="x.Files" android:authorities="a"></provider></application>';
    const caught = capacitorProblems(badCfg).length + manifestProblems(badXml).length;
    ok(caught === 9, 'ទិសផ្ទុយ ៖ config/Manifest គ្រោះថ្នាក់ (debug · mixed · server.url · cleartext ×២ · debuggable · backup · exported · provider) ត្រូវរកឃើញ', caught);
}

console.log('\n' + pass + ' ok, ' + fail + ' FAIL');
process.exitCode = fail ? 1 : 0;
