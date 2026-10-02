// ថ្នាក់ ៖ **ផ្ទាំងអ្នកលក់ «🏪 ហាង Supabase» ក្នុង ZoeKeyGen** — Admin បង្កើតហាង · ចេញកូដអញ្ជើញ/Setup Link · ពន្យារ/បិទហាង ·
// ចេញកូដប្តូរពាក្យសម្ងាត់។ កំហុសតែមួយ = អតិថិជនចុះឈ្មោះមិនបាន (Link ដែល ZoeW បដិសេធ) · ហាងចងសាខាខុស · Secret key លេចចូល Link ·
// ឬកូដអញ្ជើញ/ពាក្យសម្ងាត់នៅសល់លើអេក្រង់ក្រោយចាកចេញ។
//
//   npm ci --prefix supabase
//   M=$(ZOE_MEASURE_ONLY=1 bash audit-tools/run-all.sh | tail -1); (cd "$M" && node audit-tools/keygen-supabase-admin-test.js)
//
// វាស់ ២ ជាន់ ៖
//   ១. ស្នាមភ្ជាប់ (គ្មាន Postgres) ៖ `ZoeKeyGen/app.js` ↔ `ZoeKeyGen/index.html` ↔ migration ពិត (regex សាខា · ប្រវែងឈ្មោះ · ថ្ងៃ ·
//      ម៉ោងកូដ · ឈ្មោះគណនី · កូដកំហុសដែល RPC បោះ ទាំង ២ ទិស) និង ↔ ZoeW (`supabaseKeyIsSecret` · `supabaseUrlIsAllowed` ពី build វាស់)
//      ➜ ZoeKeyGen មិនត្រូវទទួល URL/key ដែល ZoeW បដិសេធ (ឬផ្ទុយមកវិញ)។
//   ២. ឥរិយាបថ ៖ function `sb*` ពិតក្នុង `vm` + DOM ក្លែងដែលដេរីវេពី index.html ពិត ទល់នឹង `supabase-fake-server.js` (JWT ពិត · RPC លើ
//      **Postgres ពិត + migration ពិត**) ៖ Secret key · គណនីមិនមែន Admin · បង្កើតហាង (XSS) ➜ កូដអញ្ជើញក្នុង DB ប្រើចុះឈ្មោះបាន ·
//      Setup Link ដែល **ZoeW ពិត** decode/normalize បាន · សាខាស្ទួន · ពន្យារ · បិទ/បើក · កូដប្តូរពាក្យសម្ងាត់ · JWT ផុត · ចាកចេញពី
//      ZoeKeyGen (**`showLoginModalWithPrefill()` ពិត**) កណ្តាលការងារ ➜ គ្មាន toast/DOM ក្រោយ · `sbAdminReset()` លុបរាល់តម្លៃរសើប។
// ⛔ គ្មាន `supabase/node_modules` (pg · Postgres) ➜ ផ្នែក ២ SKIP (PARTIAL) · `SUPABASE_STRICT=1` ➜ FAIL។
'use strict';

process.exitCode = 1;

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const acorn = require('acorn');

const ROOT = process.env.KEYGEN_SBADMIN_APP_DIR ? path.resolve(process.env.KEYGEN_SBADMIN_APP_DIR) : path.join(__dirname, '..');
const REPO = process.env.ZOE_REPO_ROOT ? path.resolve(process.env.ZOE_REPO_ROOT) : path.join(__dirname, '..');
const STRICT = process.env.SUPABASE_STRICT === '1';
const DEPS_DIRS = [process.env.SUPABASE_DEPS_DIR, path.join(ROOT, 'supabase', 'node_modules'), path.join(REPO, 'supabase', 'node_modules')].filter(Boolean);

let pass = 0;
let fail = 0;
const skipped = [];
function ok(label, condition, detail) {
    if (condition) { console.log('   ok    ' + label); pass++; }
    else { console.log('  FAIL   ' + label + (detail === undefined ? '' : '\n         ' + JSON.stringify(detail).slice(0, 900))); fail++; }
}
function finish() {
    if (skipped.length) console.log('SKIP ' + skipped.join(' · ') + ' (រត់ ៖ npm ci --prefix supabase)');
    console.log('\n' + (fail === 0 ? (skipped.length ? 'PARTIAL PASS (' + pass + '; SKIP ' + skipped.length + ')' : '✅ ជោគជ័យទាំងអស់ ' + pass)
        : '❌ ធ្លាក់ ' + fail + ' (ជោគជ័យ ' + pass + ')'));
    process.exitCode = fail === 0 ? 0 : 1;
}
process.on('unhandledRejection', (e) => { ok('គ្មាន promise ដែលបដិសេធដោយគ្មានអ្នកចាប់', false, String(e && e.stack || e)); });

function readOr(rel) {
    try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch (e) { return ''; }
}
const src = readOr('ZoeKeyGen/app.js');
const html = readOr('ZoeKeyGen/index.html');
const zoewView = readOr('ZoeW/app.js');
const migDir = path.join(ROOT, 'supabase', 'migrations');
const migrationFiles = fs.existsSync(migDir) ? fs.readdirSync(migDir).filter((f) => /^\d{14}_[a-z0-9_]+\.sql$/.test(f)).sort() : [];
const migrationSql = migrationFiles.map((f) => fs.readFileSync(path.join(migDir, f), 'utf8')).join('\n;\n');
const configToml = readOr('supabase/config.toml');

function topLevel(source) {
    const out = new Map();
    let ast;
    try { ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'script' }); } catch (e) { return out; }
    for (const node of ast.body) {
        if (node.type === 'FunctionDeclaration' && node.id) out.set(node.id.name, { kind: 'function', text: source.slice(node.start, node.end) });
        if (node.type === 'VariableDeclaration' && node.declarations.length === 1 && node.declarations[0].id.type === 'Identifier') {
            const text = source.slice(node.start, node.end).replace(/^(const|let)\s/, 'var ');
            out.set(node.declarations[0].id.name, { kind: node.kind, text });
        }
    }
    return out;
}
function sliceNested(source, name) {
    const re = new RegExp('(^|\\n)[ \\t]*(?:async\\s+)?function\\s+' + name + '\\s*\\(');
    const m = re.exec(source);
    if (!m) return null;
    const start = m.index + m[1].length;
    let depth = 0;
    let seen = false;
    try {
        for (const t of acorn.tokenizer(source.slice(start), { ecmaVersion: 'latest' })) {
            if (t.type.label === '{' || t.type.label === '${') { depth++; seen = true; }
            else if (t.type.label === '}') { depth--; if (seen && depth === 0) return source.slice(start, start + t.end).trim(); }
        }
    } catch (e) { return null; }
    return null;
}

const decls = topLevel(src);
const SB_FN_NAMES = [...decls.keys()].filter((n) => decls.get(n).kind === 'function' && /^sb[A-Z]|Sb[A-Z]/.test(n));
const SB_VAR_NAMES = [...decls.keys()].filter((n) => decls.get(n).kind !== 'function' && /^(SB_|sb[A-Z])/.test(n));
const HELPER_FNS = ['fetchWithTimeout', 'captureSensitiveSession', 'isSensitiveSessionCurrent', 'invalidateSensitiveSession', 'safeStoreGet',
    'safeStoreSet', 'escapeHtml', 'copySensitiveText', 'setupLinkDsnIsValid', 'showLoginModalWithPrefill', 'makeQrCode', 'renderQrInto',
    'downloadQrPng', 'saveQrImage'];
const HELPER_VARS = ['SETUP_LINK_URL_KEY', 'SETUP_LINK_DSN_KEY', 'QR_MAX_MODULES'];
const REQUIRED_SB = ['sbAdminConfigProblem', 'sbAdminLogin', 'sbAdminLogout', 'sbAdminReset', 'sbAdminRefresh', 'renderSbTenantList', 'sbCreateTenant',
    'sbTenantAction', 'sbIssueInvite', 'sbIssueResetCode', 'copySbInviteLink', 'copySbInviteCode', 'copySbResetCode', 'restoreSbAdminConfig'];
const missing = REQUIRED_SB.filter((n) => SB_FN_NAMES.indexOf(n) === -1)
    .concat(HELPER_FNS.filter((n) => !decls.has(n))).concat(HELPER_VARS.filter((n) => !decls.has(n)))
    .concat(['SB_ADMIN_ERROR_TEXT', 'SB_BRANCH_CODE_RE', 'SB_TENANT_DAYS_MAX', 'SB_INVITE_VALID_HOURS', 'SB_RESET_VALID_HOURS'].filter((n) => !decls.has(n)));

const ZOEW_FNS = ['jwtRole', 'supabaseKeyIsSecret', 'supabaseUrlIsAllowed', 'normalizeSupabaseConfig', 'decodeSetupPayload'];
const zoewSources = ZOEW_FNS.map((n) => [n, sliceNested(zoewView, n)]);
const zoewConfigKeys = (zoewView.match(/^[ \t]*const SB_CONFIG_KEYS = (\[[^\]\n]*\]);/m) || [])[1] || null;
const zoewMissing = zoewSources.filter((x) => !x[1]).map((x) => x[0]).concat(zoewConfigKeys ? [] : ['SB_CONFIG_KEYS']);

function htmlElements(text) {
    const out = new Map();
    for (const m of text.matchAll(/<([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g)) {
        const attrs = m[2];
        const id = (attrs.match(/\bid="([^"]+)"/) || [])[1];
        if (!id) continue;
        const attr = (name) => { const a = attrs.match(new RegExp('\\b' + name + '="([^"]*)"')); return a ? a[1] : null; };
        out.set(id, { tag: m[1].toLowerCase(), cls: String(attr('class') || '').split(/\s+/).filter(Boolean), value: attr('value'), attr });
    }
    return out;
}
const HTML_EL = htmlElements(html);

function zoewApi() {
    const ctx = vm.createContext({ URL, atob, escape, decodeURIComponent, JSON, Error, Object, String, Array });
    vm.runInContext('var SB_CONFIG_KEYS = ' + zoewConfigKeys + ';\n' + zoewSources.map((x) => x[1]).join('\n\n'), ctx);
    return ctx;
}

console.log('=== keygen-supabase-admin ៖ ផ្ទាំងអ្នកលក់ ZoeKeyGen ↔ index.html ↔ migration ↔ ZoeW · Postgres ពិត ===');
console.log('-- ០. លក្ខខណ្ឌចាំបាច់ --');
ok('⛔ ស្រង់ function/ថេរ sb* និង helper ពី ZoeKeyGen/app.js បានគ្រប់ (parse ដោយ acorn)', missing.length === 0 && SB_FN_NAMES.length >= REQUIRED_SB.length, missing);
ok('⛔ ស្រង់ helper Config Supabase ពិតរបស់ ZoeW ពី build វាស់ (ZoeW/app.js) បានគ្រប់', zoewMissing.length === 0, zoewMissing);
ok('⛔ migration Supabase មាន (tenants · admin_create_tenant · admin_issue_invite · admin_issue_reset_code)',
    /create table public\.tenants/.test(migrationSql) && /create function public\.admin_create_tenant\(/.test(migrationSql)
    && /create function public\.admin_issue_invite\(/.test(migrationSql) && /create function public\.admin_issue_reset_code\(/.test(migrationSql));
const SB_IDS = [...HTML_EL.keys()].filter((id) => /^sb[A-Z]/.test(id));
ok('⛔ index.html មានកាត «ហាង Supabase» (ធាតុ id sb* ≥ 15)', SB_IDS.length >= 15, SB_IDS.length);

function sqlFunctionBody(name) {
    const start = migrationSql.indexOf('create function public.' + name + '(');
    if (start === -1) return '';
    const open = migrationSql.indexOf('$$', start);
    const close = migrationSql.indexOf('$$', open + 2);
    return open === -1 || close === -1 ? '' : migrationSql.slice(start, close + 2);
}

function staticSeams() {
    console.log('-- ១. ស្នាមភ្ជាប់ ZoeKeyGen ↔ index.html ↔ migration ↔ ZoeW --');
    const C = vm.createContext({ URL, atob, JSON, Object, String, Number, RegExp });
    vm.runInContext(SB_VAR_NAMES.filter((n) => /^SB_/.test(n)).map((n) => decls.get(n).text).join('\n')
        + '\n' + decls.get('sbAdminJwtRole').text + '\n' + decls.get('sbAdminConfigProblem').text, C);

    const sqlBranch = (migrationSql.match(/branch_code text not null unique check \(branch_code ~ '([^']+)'\)/) || [])[1];
    ok('⛔ លក្ខខណ្ឌចាំបាច់ ៖ migration ចាក់សោទម្រង់ branch_code', !!sqlBranch);
    ok('SB_BRANCH_CODE_RE = check របស់ tenants.branch_code (អក្សរដដែល)', !!sqlBranch && C.SB_BRANCH_CODE_RE.source === sqlBranch,
        { app: C.SB_BRANCH_CODE_RE.source, sql: sqlBranch });
    const branchMax = Number(((sqlBranch || '').match(/\{1,(\d+)\}/) || [])[1]);
    const maxAttr = (id) => Number((HTML_EL.get(id) || { attr: () => null }).attr('maxlength'));
    ok('#sbTenantBranchInput maxlength = ព្រំដែនក្នុង regex សាខា', branchMax > 0 && maxAttr('sbTenantBranchInput') === branchMax, maxAttr('sbTenantBranchInput'));
    const nameMax = Number((migrationSql.match(/check \(char_length\(btrim\(name\)\) between 1 and (\d+)\)/) || [])[1]);
    ok('#sbTenantNameInput maxlength = char_length(name) ក្នុង tenants', nameMax > 0 && maxAttr('sbTenantNameInput') === nameMax, { html: maxAttr('sbTenantNameInput'), sql: nameMax });
    ok('sbCreateTenant() ពិនិត្យប្រវែងឈ្មោះដោយព្រំដែនដដែល', decls.get('sbCreateTenant').text.indexOf('name.length > ' + nameMax) !== -1);
    const daysEl = HTML_EL.get('sbTenantDaysInput');
    ok('#sbTenantDaysInput max = SB_TENANT_DAYS_MAX · min = 1', !!daysEl && Number(daysEl.attr('max')) === C.SB_TENANT_DAYS_MAX && Number(daysEl.attr('min')) === 1,
        daysEl && { max: daysEl.attr('max'), min: daysEl.attr('min') });
    const inviteBody = sqlFunctionBody('admin_issue_invite');
    const inviteHours = inviteBody.match(/p_valid_hours not between (\d+) and (\d+)/);
    ok('SB_INVITE_VALID_HOURS ក្នុងព្រំដែនរបស់ admin_issue_invite', !!inviteHours && C.SB_INVITE_VALID_HOURS >= Number(inviteHours[1])
        && C.SB_INVITE_VALID_HOURS <= Number(inviteHours[2]), { app: C.SB_INVITE_VALID_HOURS, sql: inviteHours && inviteHours.slice(1) });
    const resetBody = sqlFunctionBody('admin_issue_reset_code');
    const resetHours = resetBody.match(/p_valid_hours not between (\d+) and (\d+)/);
    ok('SB_RESET_VALID_HOURS ក្នុងព្រំដែនរបស់ admin_issue_reset_code', !!resetHours && C.SB_RESET_VALID_HOURS >= Number(resetHours[1])
        && C.SB_RESET_VALID_HOURS <= Number(resetHours[2]), { app: C.SB_RESET_VALID_HOURS, sql: resetHours && resetHours.slice(1) });
    const sqlUser = (migrationSql.match(/username text not null unique check \(username ~ '([^']+)'\)/) || [])[1];
    const appUser = (decls.get('sbIssueResetCode').text.match(/if \(!\/(.+?)\/\.test\(username\)\)/) || [])[1];
    ok('regex ឈ្មោះគណនីក្នុង sbIssueResetCode() = check របស់ tenant_members.username', !!sqlUser && appUser === sqlUser, { app: appUser, sql: sqlUser });
    const resetInput = HTML_EL.get('sbResetUsernameInput');
    ok('#sbResetUsernameInput maxlength = ព្រំដែនឈ្មោះគណនី', !!resetInput && Number(resetInput.attr('maxlength')) === Number(((sqlUser || '').match(/\{\d+,(\d+)\}/) || [])[1]));

    const called = ['admin_create_tenant', 'admin_update_tenant', 'admin_issue_invite', 'admin_issue_reset_code'];
    const usedInApp = called.filter((fn) => src.indexOf("'" + fn + "'") !== -1);
    ok('⛔ លក្ខខណ្ឌចាំបាច់ ៖ ZoeKeyGen ហៅ RPC admin_* ទាំង ' + called.length, usedInApp.length === called.length, usedInApp);
    // ⛔ លើកលែងតែមួយ ៖ `*-collision` បោះតែក្រោយកូដ ~១០០ bit ប៉ះគ្នា ៥ ដងជាប់ (មិនកើតក្នុងការអនុវត្ត) ➜ សារទូទៅ «Supabase បដិសេធ (…)» គ្រប់គ្រាន់
    const COLLISION_RE = /^[a-z]+-collision$/;
    const raised = new Set();
    for (const fn of called) for (const m of sqlFunctionBody(fn).matchAll(/raise exception '([a-z-]+)'/g)) raised.add(m[1]);
    const texts = Object.keys(C.SB_ADMIN_ERROR_TEXT);
    const noText = [...raised].filter((code) => texts.indexOf(code) === -1 && !COLLISION_RE.test(code));
    ok('រាល់កូដដែល RPC admin_* បោះ មានអត្ថបទខ្មែរក្នុង SB_ADMIN_ERROR_TEXT (មិនរាយកូដឆៅដល់អ្នកលក់)', raised.size >= 8 && noText.length === 0,
        { raised: [...raised], noText });
    const deadText = texts.filter((code) => !raised.has(code));
    ok('ទិសផ្ទុយ ៖ SB_ADMIN_ERROR_TEXT គ្មានកូដងាប់ (កូដដែល RPC មិនដែលបោះ)', deadText.length === 0, deadText);

    const Z = zoewMissing.length ? null : zoewApi();
    const jwt = (claims) => 'eyJhbGciOiJIUzI1NiJ9.' + Buffer.from(JSON.stringify(claims)).toString('base64url') + '.sig';
    const PUB = 'sb_publishable_' + 'a'.repeat(30);
    const samples = [
        ['https://abc.supabase.co', PUB], ['https://abc.supabase.co/', PUB], ['http://127.0.0.1:54321', PUB], ['http://localhost:54321', PUB],
        ['https://abc.supabase.co', 'sb_secret_' + 'b'.repeat(30)], ['https://abc.supabase.co', 'SB_SECRET_' + 'b'.repeat(30)],
        ['https://abc.supabase.co', jwt({ role: 'service_role' })], ['https://abc.supabase.co', jwt({ role: 'anon' })],
        ['http://abc.supabase.co', PUB], ['https://abc.supabase.co/rest/v1', PUB], ['https://abc.supabase.co/?x=1', PUB], ['https://abc.supabase.co/#x', PUB],
        ['https://user@abc.supabase.co', PUB], ['https://:pw@abc.supabase.co', PUB], ['https://user:pw@abc.supabase.co', PUB], ['ftp://abc.supabase.co', PUB],
        ['not a url', PUB], ['http://10.0.0.1', PUB]
    ];
    const verdicts = samples.map(([url, key]) => {
        const keygen = C.sbAdminConfigProblem(url, key) === '';
        const zoew = Z ? (Z.supabaseUrlIsAllowed(url) && !Z.supabaseKeyIsSecret(key)) : null;
        return { url, key: key.slice(0, 18), keygen, zoew };
    });
    const mismatch = verdicts.filter((v) => v.keygen !== v.zoew);
    ok('sbAdminConfigProblem() ស្របនឹង ZoeW (supabaseUrlIsAllowed · supabaseKeyIsSecret) លើគំរូ ' + samples.length + ' ➜ គ្មាន Link ដែល ZoeW បដិសេធ',
        !!Z && mismatch.length === 0, mismatch);
    ok('ទិសផ្ទុយ ៖ គំរូមានទាំង «ទទួល» និង «បដិសេធ» (≥ ៣ ម្ខាង)', verdicts.filter((v) => v.keygen).length >= 3 && verdicts.filter((v) => !v.keygen).length >= 3);
    const secretText = C.sbAdminConfigProblem('https://abc.supabase.co', 'sb_secret_' + 'b'.repeat(30));
    ok('Secret key ➜ សារប្រាប់ឲ្យ Rotate (មិនមែនសារ URL)', /Secret key/.test(secretText) && /Rotate/.test(secretText), secretText);
}

function deferred() {
    let resolve;
    const promise = new Promise((r) => { resolve = r; });
    return { promise, resolve };
}
const flush = () => new Promise((resolve) => setImmediate(resolve));
async function drain(n) { for (let i = 0; i < (n || 6); i++) await flush(); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function memStorage() {
    const m = new Map();
    return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); }, _map: m };
}

function makeDom() {
    const elements = new Map();
    function element(id) {
        if (elements.has(id)) return elements.get(id);
        const spec = HTML_EL.get(id);
        if (!spec) return null;
        const classes = new Set(spec.cls);
        const el = {
            id, tagName: spec.tag.toUpperCase(), value: spec.value || '', textContent: '', innerHTML: '', disabled: false,
            classList: {
                add: (c) => classes.add(c), remove: (c) => classes.delete(c), contains: (c) => classes.has(c),
                toggle: (c, on) => { const want = on === undefined ? !classes.has(c) : !!on; if (want) classes.add(c); else classes.delete(c); return want; }
            },
            hidden: () => classes.has('hidden')
        };
        elements.set(id, el);
        return el;
    }
    return {
        document: {
            getElementById: element,
            querySelectorAll: () => [],
            createElement: () => ({ value: '', setAttribute() {}, style: {}, select() {}, remove() {} }),
            execCommand: () => false,
            body: { appendChild() {} }
        },
        el: element,
        texts: () => [...elements.values()].map((e) => ({ id: e.id, s: [e.value, e.textContent, e.innerHTML].join(' ') }))
    };
}

function buildKeygen(env) {
    const dom = makeDom();
    const log = { alerts: [], toasts: [], confirms: [], prompts: [], fetches: [], clipboard: [], errors: [] };
    const answers = { confirm: [], prompt: [] };
    let gate = null;
    const store = memStorage();
    const user = { uid: 'keygen-admin' };
    const sandbox = {
        console: { log() {}, warn() {}, error: (e) => log.errors.push(String(e && e.message || e)) },
        Promise, Error, JSON, String, Number, Object, Array, Math, Date, RegExp, Set, Map, isFinite, setTimeout, clearTimeout, AbortController, URL,
        atob, btoa, escape, unescape, encodeURIComponent, decodeURIComponent,
        fetch: (url, init) => {
            log.fetches.push({ url: String(url), method: init && init.method, body: init && init.body ? JSON.parse(init.body) : null, auth: init && init.headers && init.headers.Authorization });
            const go = () => fetch(url, init);
            return gate ? gate.promise.then(go) : go();
        },
        alert: (m) => log.alerts.push(String(m)),
        confirm: (m) => { log.confirms.push(String(m)); return answers.confirm.length ? answers.confirm.shift() : true; },
        prompt: (m, d) => { log.prompts.push(String(m)); return answers.prompt.length ? answers.prompt.shift() : d; },
        showToast: (m) => log.toasts.push(String(m)),
        getServerNow: () => Date.now(),
        document: dom.document,
        navigator: { clipboard: { writeText: (t) => { log.clipboard.push(String(t)); return Promise.resolve(); } }, onLine: true },
        auth: { currentUser: user },
        appLocalStore: store,
        hasUncopiedKeypair: () => false,
        isPinFlowPending: () => false,
        refreshLiveToasts() {}, closeModal() {}, clearGeneratedKeyResult() {}, clearSigningKey() {}, openModalHelper() {}
    };
    sandbox.window = sandbox;
    sandbox.qrcode = (type, level) => {
        const q = { data: '', addData(d) { q.data = d; }, make() {}, createSvgTag() { return '<svg data-qr-len="' + q.data.length + '"></svg>'; } };
        log.qr = q;
        return q;
    };
    const ctx = vm.createContext(sandbox);
    vm.runInContext(`
        var sensitiveSessionGeneration = 0, authGeneration = 1, isSignedInUiActive = true;
        var keypairPrivateCopied = false, isGeneratingKey = false, pinTargetAction = null, keyListSessionGeneration = 0, keyListCache = [];
        var noticeListCache = [], noticeReadFailed = false, noticeSendOwner = null, isSendingNotice = false, NOTICE_SEND_LABEL = 'send';
        var lastGeneratedSetupLink = '';
    `, ctx);
    vm.runInContext(HELPER_VARS.concat(SB_VAR_NAMES).map((n) => decls.get(n).text).join('\n'), ctx);
    vm.runInContext(HELPER_FNS.concat(SB_FN_NAMES).map((n) => decls.get(n).text).join('\n\n'), ctx);
    return {
        ctx, log, dom, store, answers, user,
        gate() { gate = deferred(); return gate; },
        open() { const g = gate; gate = null; if (g) g.resolve(); },
        set(id, v) { const e = dom.el(id); if (e) e.value = v; },
        relogin() { vm.runInContext('authGeneration++; isSignedInUiActive = true;', ctx); },
        rpcCalls(fn) { return log.fetches.filter((f) => f.url.endsWith('/rest/v1/rpc/' + fn)).length; }
    };
}

function decodeEntities(s) {
    return String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}
function rowButtons(innerHTML) {
    return [...String(innerHTML).matchAll(/<button class="btn-mini" data-tenant-id="([^"]*)" data-action="([^"]*)">([^<]*)<\/button>/g)]
        .map((m) => ({ id: decodeEntities(m[1]), action: m[2], text: m[3] }));
}

async function behavior() {
    console.log('-- ២. ឥរិយាបថលើ Postgres ពិត + migration ពិត (supabase-fake-server) --');
    const wantMajor = parseInt((configToml.match(/^major_version\s*=\s*(\d+)\s*$/m) || [])[1] || '0', 10);
    const { createPgHarness } = require('./supabase-pg.js');
    const { startFakeSupabase } = require('./supabase-fake-server.js');
    const H = createPgHarness({ depsDirs: DEPS_DIRS, shimDir: path.join(__dirname, 'supabase-shim'), wantMajor });
    const reason = H.unavailableReason();
    if (reason) {
        if (STRICT) ok('SUPABASE_STRICT=1 ៖ ' + reason, false);
        else skipped.push(reason);
        return;
    }
    let client = null;
    let pool = null;
    let fake = null;
    try {
        await H.start();
        const { c, name } = await H.freshDb('default-grants');
        client = c;
        c.on('error', () => {});
        await c.query(migrationSql);
        const adminId = await H.makeAuthUser(c, 'boss@admin.zoe.test');
        await c.query('insert into public.platform_admins (user_id) values ($1)', [adminId]);
        const clerkId = await H.makeAuthUser(c, 'clerk@admin.zoe.test');
        pool = new H.PG.Pool({ host: '127.0.0.1', port: c.connectionParameters.port, user: 'postgres', database: name, max: 8 });
        pool.on('error', () => {});
        fake = await startFakeSupabase({ pool });
        fake.addUser('boss@admin.zoe.test', 'boss-pass-123', adminId);
        fake.addUser('clerk@admin.zoe.test', 'clerk-pass-123', clerkId);
        const PUB = 'sb_publishable_' + 'k'.repeat(32);
        const SERVICE = { role: 'service_role' };

        const K = buildKeygen();
        const C = K.ctx;
        const el = K.dom.el;
        const fill = (url, key, email, pw) => { K.set('sbAdminUrlInput', url); K.set('sbAdminKeyInput', key); K.set('sbAdminEmailInput', email); K.set('sbAdminPasswordInput', pw); };
        const panelOpen = () => !el('sbAdminPanel').hidden();
        const alertsSince = (n) => K.log.alerts.slice(n);

        console.log('   · Secret key / config ខុស');
        ok('⛔ លក្ខខណ្ឌចាំបាច់ ៖ ផ្ទាំង Admin លាក់ពេលចាប់ផ្តើម (class hidden ក្នុង index.html)', !panelOpen() && el('sbAdminLogoutBtn').hidden());
        const service = 'eyJhbGciOiJIUzI1NiJ9.' + Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url') + '.x';
        for (const [label, key] of [['sb_secret_…', 'sb_secret_' + 's'.repeat(30)], ['JWT service_role', service]]) {
            fill(fake.url, key, 'boss@admin.zoe.test', 'boss-pass-123');
            const a = K.log.alerts.length;
            const f = K.log.fetches.length;
            await C.sbAdminLogin();
            ok('Secret key (' + label + ') ➜ បដិសេធ មុនបណ្តាញ · មិនរក្សាទុក · ផ្ទាំងនៅលាក់',
                K.log.fetches.length === f && /Secret key/.test(alertsSince(a).join()) && !panelOpen()
                && String(K.store.getItem(C.SB_ADMIN_CONFIG_KEY) || '').indexOf(key) === -1, { alerts: alertsSince(a), fetches: K.log.fetches.length - f });
        }

        console.log('   · ពាក្យសម្ងាត់ខុស · គណនីមិនមែន Admin');
        fill(fake.url + '/', PUB, 'Boss@Admin.Zoe.Test', 'wrong-pass');
        let a = K.log.alerts.length;
        await C.sbAdminLogin();
        ok('ពាក្យសម្ងាត់ខុស ➜ «មិនត្រឹមត្រូវ» · ផ្ទាំងលាក់ · វាលពាក្យសម្ងាត់ទទេ', /មិនត្រឹមត្រូវ/.test(alertsSince(a).join()) && !panelOpen()
            && el('sbAdminPasswordInput').value === '', alertsSince(a));
        fill(fake.url, PUB, 'clerk@admin.zoe.test', 'clerk-pass-123');
        a = K.log.alerts.length;
        await C.sbAdminLogin();
        ok('គណនីមិនមែន Admin (គ្មានក្នុង platform_admins) ➜ សារ forbidden · ផ្ទាំងលាក់ · គ្មាន session',
            alertsSince(a).join() === C.SB_ADMIN_ERROR_TEXT.forbidden && !panelOpen() && C.sbAdminSession === null, alertsSince(a));
        ok('ពាក្យសម្ងាត់មិនសល់ក្នុងវាល · ក្នុង storage', el('sbAdminPasswordInput').value === '' && [...K.store._map.values()].join().indexOf('clerk-pass-123') === -1);

        console.log('   · Admin ចូល ➜ បញ្ជីហាង');
        fill(fake.url + '/', PUB, 'Boss@Admin.Zoe.Test', 'boss-pass-123');
        a = K.log.alerts.length;
        await C.sbAdminLogin();
        await drain();
        ok('Admin ➜ ផ្ទាំងបើក · ប៊ូតុងចាកចេញបង្ហាញ · ប៊ូតុងចូលលាក់ · toast ✅ · គ្មាន alert', panelOpen() && !el('sbAdminLogoutBtn').hidden()
            && el('sbAdminLoginBtn').hidden()
            && K.log.toasts.some((t) => /Admin/.test(t)) && alertsSince(a).length === 0, alertsSince(a));
        ok('បញ្ជីហាងទទេ ➜ «មិនទាន់មានហាង» (មិនមែន «អានមិនបាន»)', /មិនទាន់មានហាង/.test(el('sbTenantListBody').innerHTML), el('sbTenantListBody').innerHTML);
        const saved = JSON.parse(K.store.getItem(C.SB_ADMIN_CONFIG_KEY) || 'null');
        ok('Config ដែលរក្សាទុក = URL (គ្មាន / ចុង) · key · អ៊ីមែលអក្សរតូច — គ្មានពាក្យសម្ងាត់', !!saved && saved.url === fake.url && saved.key === PUB
            && saved.email === 'boss@admin.zoe.test' && Object.keys(saved).sort().join() === 'email,key,url', saved);
        const K2 = buildKeygen();
        K2.store.setItem(K2.ctx.SB_ADMIN_CONFIG_KEY, K.store.getItem(C.SB_ADMIN_CONFIG_KEY));
        K2.ctx.restoreSbAdminConfig();
        ok('restoreSbAdminConfig() បំពេញ URL/key/អ៊ីមែល ក្នុង tab ថ្មី (មិនមែនពាក្យសម្ងាត់)', K2.dom.el('sbAdminUrlInput').value === fake.url
            && K2.dom.el('sbAdminKeyInput').value === PUB && K2.dom.el('sbAdminPasswordInput').value === '');

        console.log('   · បង្កើតហាង (XSS) ➜ កូដអញ្ជើញម្ចាស់ហាង');
        const XSS = 'ហាង <img src=x onerror=alert(1)> "សុខា"';
        K.set('sbTenantNameInput', XSS);
        K.set('sbTenantBranchInput', '881859');
        K.set('sbTenantDaysInput', '30');
        a = K.log.alerts.length;
        const t0 = Date.now();
        await C.sbCreateTenant();
        await drain();
        const tRow = (await c.query("select * from public.tenants where branch_code = '881859'")).rows[0];
        ok('ហាងចុះក្នុង DB ៖ ឈ្មោះ · សាខា · ផុតកំណត់ ≈ ឥឡូវ + ៣០ ថ្ងៃ', !!tRow && tRow.name === XSS && !tRow.revoked
            && Math.abs(tRow.expires_at.getTime() - (t0 + 30 * 86400000)) < 60000, tRow);
        ok('toast ✅ · គ្មាន alert · វាលឈ្មោះ/សាខាសម្អាត', K.log.toasts.some((t) => /បានបង្កើតហាង/.test(t)) && alertsSince(a).length === 0
            && el('sbTenantNameInput').value === '' && el('sbTenantBranchInput').value === '', alertsSince(a));
        const firstCode = el('sbInviteCodeText').textContent;
        const inv1 = (await c.query('select i.*, private.invite_code_hash($1) = i.code_hash as match from public.tenant_invites i where i.tenant_id = $2', [firstCode, tRow && tRow.id])).rows;
        ok('កូដអញ្ជើញម្ចាស់ហាង ៖ ក្នុង DB (hash ត្រូវ) · role owner · ប្រើ ១ ដង · ផុត ≈ ' + C.SB_INVITE_VALID_HOURS + ' ម៉ោង',
            inv1.length === 1 && inv1[0].match && inv1[0].role === 'owner' && inv1[0].max_uses === 1
            && Math.abs(inv1[0].expires_at.getTime() - (t0 + C.SB_INVITE_VALID_HOURS * 3600000)) < 60000, inv1);
        ok('ប្រអប់កូដបង្ហាញ · ស្លាក «ម្ចាស់ហាង»', !el('sbInviteResultBox').hidden() && /ម្ចាស់ហាង/.test(el('sbInviteResultLabel').textContent));
        ok('គ្មាន Base URL ➜ Link ទទេ + សារណែនាំ ⚠️ · គ្មាន QR', C.sbLastInvite && C.sbLastInvite.link === '' && /⚠️/.test(el('sbInviteLinkText').textContent)
            && el('sbInviteQrContainer').innerHTML === '');
        const listHtml = el('sbTenantListBody').innerHTML;
        ok('⛔ XSS ៖ ឈ្មោះហាងក្នុងបញ្ជី escape (គ្មាន <img ឆៅ)', listHtml.indexOf('<img') === -1 && listHtml.indexOf('&lt;img src=x onerror=alert(1)&gt;') !== -1);
        const label1 = el('sbInviteResultLabel').textContent;
        ok('ស្លាកកូដប្រើ textContent (ឈ្មោះហាងឆៅ ➜ មិនមែន HTML)', label1.indexOf(XSS) !== -1);
        let btns = rowButtons(listHtml);
        ok('⛔ លក្ខខណ្ឌចាំបាច់ ៖ ជួរដេកមានប៊ូតុង ៣ (sb-invite · sb-extend · sb-revoke) ចង id ហាងពិត',
            btns.length === 3 && btns.every((b) => b.id === tRow.id) && btns.map((b) => b.action).sort().join() === 'sb-extend,sb-invite,sb-revoke', btns);
        ok('ការចុចប៊ូតុងក្នុងបញ្ជីឆ្លង sbTenantAction(dataset.tenantId, dataset.action)',
            /getElementById\('sbTenantListBody'\)[\s\S]{0,400}sbTenantAction\(btn\.dataset\.tenantId, btn\.dataset\.action\)/.test(src));

        console.log('   · Setup Link ➜ ZoeW ពិត');
        K.store.setItem(C.SETUP_LINK_URL_KEY, 'https://zoew.example.app/');
        K.store.setItem(C.SETUP_LINK_DSN_KEY, 'https://abc@o1.ingest.sentry.io/123');
        K.answers.confirm.push(true);
        await C.sbTenantAction(btns.find((b) => b.action === 'sb-invite').id, 'sb-invite');
        await drain();
        const ownerCode = el('sbInviteCodeText').textContent;
        const link = el('sbInviteLinkText').textContent;
        ok('ហាងគ្មានម្ចាស់ ➜ sb-invite ចេញកូដ «ម្ចាស់ហាង» ម្តងទៀត', /ម្ចាស់ហាង/.test(K.log.confirms[K.log.confirms.length - 1]) && ownerCode && ownerCode !== firstCode);
        const setupParam = (link.match(/^https:\/\/zoew\.example\.app\/\?setup=([^&#]+)$/) || [])[1];
        ok('Link = <Base URL>/?setup=… (គ្មាន / ស្ទួន)', !!setupParam, link);
        let decoded = null;
        let normalized = null;
        if (setupParam && !zoewMissing.length) {
            const Z = zoewApi();
            try { decoded = Z.decodeSetupPayload(decodeURIComponent(setupParam)); } catch (e) { decoded = { error: e.message }; }
            try {
                const linkConfig = Object.assign({}, decoded);
                delete linkConfig.dsn;
                delete linkConfig.invite;
                normalized = Z.normalizeSupabaseConfig(linkConfig);
            } catch (e) { normalized = { error: e.message }; }
        }
        ok('decodeSetupPayload() ពិតរបស់ ZoeW ➜ {supabaseUrl, supabaseKey, invite, dsn}', !!decoded && decoded.supabaseUrl === fake.url
            && decoded.supabaseKey === PUB && decoded.invite === ownerCode && decoded.dsn === 'https://abc@o1.ingest.sentry.io/123'
            && Object.keys(decoded).sort().join() === 'dsn,invite,supabaseKey,supabaseUrl', decoded);
        ok('normalizeSupabaseConfig() ពិតរបស់ ZoeW ទទួល Config ពី Link (គ្មាន extras)', !!normalized && normalized.config
            && normalized.config.supabaseUrl === fake.url && normalized.extras.length === 0, normalized);
        ok('⛔ Link គ្មានពាក្យសម្ងាត់ Admin · token · អ៊ីមែល Admin', link.indexOf('boss') === -1
            && Buffer.from(decodeURIComponent(setupParam || ''), 'base64').toString('utf8').search(/boss|access_token|eyJ/) === -1);
        ok('QR = Link ពេញ', !!K.log.qr && K.log.qr.data === link && /data-qr-len/.test(el('sbInviteQrContainer').innerHTML));
        const firstState = (await c.query('select revoked from public.tenant_invites where code_hash = private.invite_code_hash($1)', [firstCode])).rows[0];
        ok('កូដទី ១ នៅប្រើបាន (ការចេញថ្មីមិនបិទវា — ទាំង ២ ប្រើបាន ១ ដង)', !!firstState && firstState.revoked === false);

        console.log('   · កូដអញ្ជើញ ➜ ចុះឈ្មោះ (finish_registration ពិត)');
        const ownerUid = await H.makeAuthUser(c, 'sokha@users.zoew.invalid');
        const ownerHash = (await c.query('select private.invite_code_hash($1) as h', [ownerCode])).rows[0].h;
        const reg = await H.as(c, SERVICE, 'select * from public.finish_registration($1, $2, $3)', [ownerUid, ownerHash, 'sokha']);
        ok('កូដពីអេក្រង់ ➜ finish_registration ➜ ម្ចាស់ហាងរបស់ហាងដដែល', !!reg.rows && reg.rows[0].tenant_id === tRow.id && reg.rows[0].role === 'owner', reg);
        await C.sbAdminRefresh();
        ok('បញ្ជីបង្ហាញ 👑 sokha', /👑 sokha/.test(el('sbTenantListBody').innerHTML));
        K.answers.confirm.push(true);
        await C.sbTenantAction(tRow.id, 'sb-invite');
        await drain();
        const memberCode = el('sbInviteCodeText').textContent;
        const memberInv = (await c.query('select role, tenant_id from public.tenant_invites where code_hash = private.invite_code_hash($1)', [memberCode])).rows[0];
        ok('ហាងមានម្ចាស់ ➜ sb-invite ចេញកូដ «បុគ្គលិក» (role member ក្នុង DB)', /បុគ្គលិក/.test(K.log.confirms[K.log.confirms.length - 1])
            && !!memberInv && memberInv.role === 'member' && memberInv.tenant_id === tRow.id && /បុគ្គលិក/.test(el('sbInviteResultLabel').textContent), memberInv);
        const confirmsBefore = K.log.confirms.length;
        K.answers.confirm.push(false);
        const invCalls = K.rpcCalls('admin_issue_invite');
        await C.sbTenantAction(tRow.id, 'sb-invite');
        ok('បដិសេធ confirm ➜ គ្មាន RPC', K.rpcCalls('admin_issue_invite') === invCalls && K.log.confirms.length === confirmsBefore + 1);

        console.log('   · ការផ្ទៀងផ្ទាត់ · សាខាស្ទួន · ចុចពីរដង');
        const createCalls = () => K.rpcCalls('admin_create_tenant');
        for (const [label, nm, br, days] of [['សាខាមានដកឃ្លា', 'X', '88 18', '30'], ['ឈ្មោះ ១២១ តួ', 'ក'.repeat(121), '990001', '30'],
            ['ថ្ងៃ 0', 'X', '990001', '0'], ['ថ្ងៃ ' + (C.SB_TENANT_DAYS_MAX + 1), 'X', '990001', String(C.SB_TENANT_DAYS_MAX + 1)], ['ថ្ងៃ 1.5', 'X', '990001', '1.5']]) {
            K.set('sbTenantNameInput', nm); K.set('sbTenantBranchInput', br); K.set('sbTenantDaysInput', days);
            const before = createCalls();
            a = K.log.alerts.length;
            await C.sbCreateTenant();
            ok('បដិសេធក្នុង App (' + label + ') ➜ alert · គ្មាន RPC', createCalls() === before && alertsSince(a).length === 1, alertsSince(a));
        }
        K.set('sbTenantNameInput', 'ហាងទី ២'); K.set('sbTenantBranchInput', '881859'); K.set('sbTenantDaysInput', '30');
        a = K.log.alerts.length;
        const toastsBefore = K.log.toasts.length;
        await C.sbCreateTenant();
        ok('សាខាស្ទួន ➜ សារ branch-taken (409 ពី Postgres ពិត) · គ្មាន toast · វាលមិនសម្អាត', alertsSince(a).length === 1
            && alertsSince(a)[0].indexOf(C.SB_ADMIN_ERROR_TEXT['branch-taken']) !== -1 && K.log.toasts.length === toastsBefore
            && el('sbTenantBranchInput').value === '881859', alertsSince(a));
        K.set('sbTenantBranchInput', '770001');
        const before2 = createCalls();
        await Promise.all([C.sbCreateTenant(), C.sbCreateTenant()]);
        await drain();
        const n770 = (await c.query("select count(*)::int as n from public.tenants where branch_code = '770001'")).rows[0].n;
        ok('ចុចពីរដងជាប់គ្នា ➜ RPC ១ · ហាង ១', createCalls() === before2 + 1 && n770 === 1, { calls: createCalls() - before2, n770 });
        ok('ប៊ូតុងដោះក្រោយការងារចប់', el('sbCreateTenantBtn').disabled === false && el('sbAdminLoginBtn').disabled === false && C.sbAdminBusy === false);

        console.log('   · ពន្យារ · បិទ/បើក');
        const tid770 = (await c.query("select id from public.tenants where branch_code = '770001'")).rows[0].id;
        const exp0 = (await c.query('select expires_at from public.tenants where id = $1', [tid770])).rows[0].expires_at.getTime();
        K.answers.prompt.push('10');
        await C.sbTenantAction(tid770, 'sb-extend');
        const exp1 = (await c.query('select expires_at from public.tenants where id = $1', [tid770])).rows[0].expires_at.getTime();
        ok('ពន្យារ ១០ ថ្ងៃលើហាងសកម្ម ➜ ចាស់ + ១០ ថ្ងៃ (មិនមែនឥឡូវ + ១០)', Math.abs(exp1 - (exp0 + 10 * 86400000)) < 2000, { exp0, exp1 });
        await c.query("update public.tenants set expires_at = now() - interval '3 days' where id = $1", [tid770]);
        await C.sbAdminRefresh();
        btns = rowButtons(el('sbTenantListBody').innerHTML);
        ok('ហាងផុតកំណត់ ➜ ស្លាក «ផុតកំណត់»', /badge-expired">ផុតកំណត់/.test(el('sbTenantListBody').innerHTML));
        const t5 = Date.now();
        K.answers.prompt.push(' 5 ');
        await C.sbTenantAction(tid770, 'sb-extend');
        const exp2 = (await c.query('select expires_at from public.tenants where id = $1', [tid770])).rows[0].expires_at.getTime();
        ok('ពន្យារ ៥ ថ្ងៃលើហាងផុតកំណត់ ➜ ឥឡូវ + ៥ ថ្ងៃ', Math.abs(exp2 - (t5 + 5 * 86400000)) < 60000, { exp2, want: t5 + 5 * 86400000 });
        const updCalls = () => K.rpcCalls('admin_update_tenant');
        let u0 = updCalls();
        K.answers.prompt.push(null);
        await C.sbTenantAction(tid770, 'sb-extend');
        a = K.log.alerts.length;
        for (const raw of ['abc', '5abc', '2.5', '0']) {
            K.answers.prompt.push(raw);
            await C.sbTenantAction(tid770, 'sb-extend');
        }
        ok('prompt បោះបង់ · មិនមែនចំនួនគត់ពេញ («abc» · «5abc» · «2.5» · «0») ➜ alert · គ្មាន RPC', updCalls() === u0 && alertsSince(a).length === 4, alertsSince(a));
        K.answers.confirm.push(true);
        await C.sbTenantAction(tid770, 'sb-revoke');
        const rev1 = (await c.query('select revoked from public.tenants where id = $1', [tid770])).rows[0].revoked;
        btns = rowButtons(el('sbTenantListBody').innerHTML);
        const revBtn = btns.find((b) => b.id === tid770 && b.action === 'sb-revoke');
        ok('បិទហាង ➜ revoked = true · ស្លាក «បិទ» · ប៊ូតុង «បើកវិញ»', rev1 === true && !!revBtn && /បើកវិញ/.test(revBtn.text), revBtn);
        a = K.log.alerts.length;
        K.answers.confirm.push(true);
        await C.sbTenantAction(tid770, 'sb-invite');
        ok('ហាងបិទ ➜ ចេញកូដអញ្ជើញមិនបាន (សារ tenant-inactive ពី RPC ពិត)', alertsSince(a).join().indexOf(C.SB_ADMIN_ERROR_TEXT['tenant-inactive']) !== -1, alertsSince(a));
        K.answers.confirm.push(true);
        await C.sbTenantAction(tid770, 'sb-revoke');
        ok('បើកវិញ ➜ revoked = false', (await c.query('select revoked from public.tenants where id = $1', [tid770])).rows[0].revoked === false);
        u0 = updCalls();
        await C.sbTenantAction('00000000-0000-0000-0000-000000000000', 'sb-extend');
        await C.sbTenantAction(tid770, 'sb-unknown');
        ok('id ហាងមិនស្គាល់ · action មិនស្គាល់ ➜ គ្មាន RPC', updCalls() === u0);

        console.log('   · កូដប្តូរពាក្យសម្ងាត់');
        const resetCalls = () => K.rpcCalls('admin_issue_reset_code');
        let r0 = resetCalls();
        K.set('sbResetUsernameInput', 'A!');
        a = K.log.alerts.length;
        await C.sbIssueResetCode();
        ok('ឈ្មោះខុសទម្រង់ ➜ alert · គ្មាន RPC', resetCalls() === r0 && alertsSince(a).length === 1);
        K.set('sbResetUsernameInput', 'nobody');
        a = K.log.alerts.length;
        await C.sbIssueResetCode();
        ok('ឈ្មោះមិនស្គាល់ ➜ សារ member-not-found (RPC ពិត)', alertsSince(a).join().indexOf(C.SB_ADMIN_ERROR_TEXT['member-not-found']) !== -1
            && el('sbResetResultBox').hidden(), alertsSince(a));
        K.set('sbResetUsernameInput', ' SoKha ');
        await C.sbIssueResetCode();
        const resetCode1 = C.sbLastResetCode;
        const rc1 = (await c.query('select used, user_id from public.member_reset_codes where code_hash = private.reset_code_hash($1)', [resetCode1])).rows[0];
        ok('កូដប្តូរពាក្យសម្ងាត់ ៖ ក្នុង DB សម្រាប់ sokha · មិនទាន់ប្រើ · បង្ហាញ «sokha ➜ កូដ»', !!rc1 && rc1.user_id === ownerUid && rc1.used === false
            && el('sbResetCodeText').textContent === 'sokha ➜ ' + resetCode1 && !el('sbResetResultBox').hidden(), rc1);
        await C.sbIssueResetCode();
        const rcOld = (await c.query('select used from public.member_reset_codes where code_hash = private.reset_code_hash($1)', [resetCode1])).rows[0];
        ok('ចេញកូដថ្មី ➜ កូដចាស់លែងប្រើបាន', !!rcOld && rcOld.used === true && C.sbLastResetCode !== resetCode1);

        console.log('   · ចម្លង');
        const clip0 = K.log.clipboard.length;
        await C.copySbInviteLink();
        await C.copySbInviteCode();
        await C.copySbResetCode();
        ok('ចម្លង Link · កូដអញ្ជើញ · កូដប្តូរពាក្យសម្ងាត់ ➜ តម្លៃដែលបង្ហាញ', JSON.stringify(K.log.clipboard.slice(clip0))
            === JSON.stringify([C.sbLastInvite.link, C.sbLastInvite.code, C.sbLastResetCode]), K.log.clipboard.slice(clip0));

        console.log('   · ចាកចេញពី Supabase ➜ DOM ស្អាត');
        const secrets = [C.sbLastInvite.code, C.sbLastInvite.link, C.sbLastResetCode, 'sokha', 'ហាងទី ២', XSS, '881859', '770001'];
        const holding = (t) => secrets.filter((s) => t.s.toLowerCase().indexOf(s.toLowerCase()) !== -1);
        const holders = K.dom.texts().filter((t) => holding(t).length).map((t) => t.id);
        ok('⛔ លក្ខខណ្ឌចាំបាច់ ៖ មុនចាកចេញ តម្លៃរសើបនៅលើអេក្រង់ពិត', holders.length >= 4, holders);
        const f0 = K.log.fetches.length;
        C.sbAdminLogout();
        await drain();
        const left = K.dom.texts().filter((t) => holding(t).length).map((t) => t.id + ' ⊃ ' + holding(t).join('|'));
        ok('sbAdminLogout() ➜ គ្មានកូដ · Link · ឈ្មោះហាង · ឈ្មោះគណនី · សាខា នៅក្នុង DOM', left.length === 0, left);
        ok('ផ្ទាំង · ប្រអប់លទ្ធផល លាក់ · ប៊ូតុងចូលបង្ហាញវិញ · session null · cache ទទេ', !panelOpen() && el('sbInviteResultBox').hidden() && el('sbResetResultBox').hidden()
            && el('sbAdminLogoutBtn').hidden() && !el('sbAdminLoginBtn').hidden() && C.sbAdminSession === null && C.sbTenantCache.length === 0 && C.sbMemberCache.length === 0
            && C.sbLastInvite === null && C.sbLastResetCode === '');
        ok('POST /auth/v1/logout ជាមួយ token ចាស់', K.log.fetches.slice(f0).some((f) => /\/auth\/v1\/logout$/.test(f.url) && /^Bearer /.test(f.auth || '')));
        const clip1 = K.log.clipboard.length;
        await C.copySbInviteLink(); await C.copySbInviteCode(); await C.copySbResetCode();
        ok('ក្រោយចាកចេញ ➜ ចម្លងមិនបានអ្វីសោះ', K.log.clipboard.length === clip1);

        console.log('   · ចាកចេញពី ZoeKeyGen កណ្តាលការងារ (showLoginModalWithPrefill ពិត)');
        fill(fake.url, PUB, 'boss@admin.zoe.test', 'boss-pass-123');
        await C.sbAdminLogin();
        await drain();
        ok('⛔ លក្ខខណ្ឌចាំបាច់ ៖ ចូលម្តងទៀតបាន', panelOpen() && !!C.sbAdminSession);
        K.set('sbTenantNameInput', 'ហាងកណ្តាលទី'); K.set('sbTenantBranchInput', '660001'); K.set('sbTenantDaysInput', '30');
        const invBeforeMid = K.rpcCalls('admin_issue_invite');
        K.gate();
        a = K.log.alerts.length;
        let t1 = K.log.toasts.length;
        const midCreate = C.sbCreateTenant();
        await drain();
        C.showLoginModalWithPrefill();
        const fMid = K.log.fetches.length;
        K.open();
        await midCreate;
        await drain(12);
        ok('⛔ លក្ខខណ្ឌចាំបាច់ ៖ RPC បង្កើតហាងកំពុងហោះពេលចាកចេញ', K.log.fetches[fMid - 1] && /admin_create_tenant$/.test(K.log.fetches[fMid - 1].url));
        ok('ក្រោយចាកចេញ ➜ គ្មានសំណើបន្ថែម (ចេញកូដ · អានបញ្ជី)', K.log.fetches.length === fMid, K.log.fetches.slice(fMid).map((f) => f.url));
        ok('ចាកចេញកណ្តាលការបង្កើតហាង ➜ គ្មាន toast · alert · កូដ · បញ្ជី', K.log.toasts.length === t1 && alertsSince(a).length === 0
            && el('sbInviteResultBox').hidden() && el('sbInviteCodeText').textContent === '' && el('sbTenantListBody').innerHTML === ''
            && !panelOpen() && C.sbAdminSession === null, { toasts: K.log.toasts.slice(t1), alerts: alertsSince(a) });
        ok('ការចាកចេញកណ្តាលទីមិនបន្ត RPC ចេញកូដអញ្ជើញ (ការងារក្រោយ await ឈប់)', K.rpcCalls('admin_issue_invite') === invBeforeMid
            && (await c.query("select count(*)::int as n from public.tenant_invites i join public.tenants t on t.id = i.tenant_id where t.branch_code = '660001'")).rows[0].n === 0);
        K.relogin();
        fill(fake.url, PUB, 'boss@admin.zoe.test', 'boss-pass-123');
        K.gate();
        t1 = K.log.toasts.length;
        const midLogin = C.sbAdminLogin();
        await drain();
        C.showLoginModalWithPrefill();
        const fLogin = K.log.fetches.length;
        K.open();
        await midLogin;
        await drain(12);
        ok('ចាកចេញកណ្តាលការចូល ➜ មិនប្រើ token ថ្មីទៀត (គ្មានសំណើក្រោយ /token)', /\/auth\/v1\/token/.test(K.log.fetches[fLogin - 1].url)
            && K.log.fetches.length === fLogin, K.log.fetches.slice(fLogin).map((f) => f.url));
        ok('ចាកចេញកណ្តាលការចូល Supabase ➜ ផ្ទាំងនៅលាក់ · គ្មាន session · គ្មាន toast · ពាក្យសម្ងាត់ទទេ', !panelOpen() && C.sbAdminSession === null
            && K.log.toasts.length === t1 && el('sbAdminPasswordInput').value === '' && C.sbAdminBusy === false && el('sbAdminLoginBtn').disabled === false);
        K.relogin();
        const r1 = resetCalls();
        const c1 = createCalls();
        await C.sbIssueResetCode();
        await C.sbCreateTenant();
        await C.sbAdminRefresh();
        ok('គ្មាន session Supabase ➜ ប៊ូតុងផ្សេងមិនហៅ RPC/អានបញ្ជី', resetCalls() === r1 && createCalls() === c1 && el('sbTenantListBody').innerHTML === '');

        console.log('   · JWT ផុត');
        fill(fake.url, PUB, 'boss@admin.zoe.test', 'boss-pass-123');
        await C.sbAdminLogin();
        await drain();
        fake.expireTokens();
        a = K.log.alerts.length;
        await C.sbAdminRefresh();
        await drain();
        ok('JWT ផុត (អានបញ្ជី 401) ➜ sbAdminReset(true) ៖ សារ «ផុតកំណត់» · ផ្ទាំងលាក់ · ប៊ូតុងចូលបង្ហាញវិញ · session null', /ផុតកំណត់/.test(alertsSince(a).join()) && !panelOpen()
            && !el('sbAdminLoginBtn').hidden() && C.sbAdminSession === null, alertsSince(a));
        await sleep(1200);
        fill(fake.url, PUB, 'boss@admin.zoe.test', 'boss-pass-123');
        await C.sbAdminLogin();
        await drain();
        ok('⛔ លក្ខខណ្ឌចាំបាច់ ៖ ចូលវិញក្រោយ token ផុត', panelOpen() && !!C.sbAdminSession);
        fake.expireTokens();
        K.set('sbResetUsernameInput', 'sokha');
        a = K.log.alerts.length;
        await C.sbIssueResetCode();
        await drain();
        ok('JWT ផុត (RPC 401) ➜ reset + សារ «ផុតកំណត់» តែមួយ (មិនមែន «ចេញកូដមិនបាន» ទៀត)', alertsSince(a).length === 1 && /ផុតកំណត់/.test(alertsSince(a)[0])
            && !panelOpen() && C.sbAdminSession === null && el('sbResetResultBox').hidden(), alertsSince(a));
        ok('⛔ គ្មាន console.error ពីផ្លូវខាងលើ', K.log.errors.length === 0, K.log.errors);
    } catch (e) {
        ok('ការវាស់មិនគាំង', false, String(e && e.stack || e));
    } finally {
        if (fake) await fake.close();
        if (pool) await pool.end().catch(() => {});
        if (client) await client.end().catch(() => {});
        H.stop();
    }
}

(async () => {
    if (!missing.length && SB_IDS.length) {
        try { staticSeams(); } catch (e) { ok('ផ្នែក ១ មិនគាំង', false, String(e && e.stack || e)); }
        await behavior();
    }
    finish();
    setTimeout(() => process.exit(process.exitCode), 300).unref();
})();
