'use strict';

// ⛔ អ្នកយាមរបស់ `tools/firebase-provision/` (ឧបករណ៍បង្កើតអតិថិជនថ្មីលើ Firebase)។
//
// ឧបករណ៍នោះប៉ះ **Project ផលិតកម្មរបស់អតិថិជន** (Rules · sign-up · គណនី) ➜ កំហុសតែមួយ = ទិន្នន័យ
// អតិថិជនបើកចំហ។ ការវាស់ ៖
//   ក. កិច្ចសន្យាឆ្លងឯកសារ (គ្មាន dependency) ៖ អ៊ីមែល ↔ `siteCodeFromEmail()` ពិតរបស់ Function ZTO ·
//      Project ID ↔ `PROJECT_ID_RE` ពិត · Setup Link ↔ `decodeSetupPayload()` ពិតរបស់ ZoeW · DSN ↔ ZoeW ·
//      .cmd ASCII+CRLF · pin កំណែ · លេខក្នុង README ដេរីវេពីកូដ
//   ខ. ឥរិយាបថ ៖ CLI ពិត + `firebase-tools` ពិត (កំណែ pin) ទល់នឹង Google ក្លែងលើ **HTTPS** (CA ពី openssl ➜
//      `NODE_EXTRA_CA_CERTS`) ➜ ផ្លូវ token ពិតរបស់ firebase-tools (refresh ➜ Bearer) ត្រូវរត់ ⛔ មិនមែន
//      `Bearer owner` ដែល firebase-tools ផ្ញើលើ http:// ។ Google ក្លែងមាន **ស្ថានភាព** (sign-up · rules ·
//      updateMask · API បិទ/បើក) ➜ ការសរសេរដែលមិនចូលពិត លេចជាការវាស់ធ្លាក់
//   គ. mutation លើ tool ពិត ➜ សេណារីយ៉ូត្រូវក្រហម
// ⛔ គ្មាន dependency/openssl ➜ SKIP (ឬ PARTIAL) · `FBPROVISION_STRICT=1` ➜ FAIL (ដូច emu/*)។

process.exitCode = 1;

const cp = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const https = require('https');
const os = require('os');
const path = require('path');
const vm = require('vm');

const ROOT = process.env.FBPROVISION_APP_DIR ? path.resolve(process.env.FBPROVISION_APP_DIR) : path.resolve(__dirname, '..');
const REPO = process.env.ZOE_REPO_ROOT ? path.resolve(process.env.ZOE_REPO_ROOT) : path.resolve(__dirname, '..');
const STRICT = process.env.FBPROVISION_STRICT === '1';
const TOOL = path.join(ROOT, 'tools', 'firebase-provision');
const DEPS_DIRS = [process.env.FBPROVISION_DEPS_DIR, path.join(TOOL, 'node_modules'),
    path.join(REPO, 'tools', 'firebase-provision', 'node_modules')].filter(Boolean);
const RUN_TIMEOUT_MS = 90 * 1000;

let pass = 0;
let fail = 0;
function ok(label, condition, detail) {
    if (condition) {
        console.log('   ok    ' + label);
        pass += 1;
    } else {
        console.log('   FAIL  ' + label + (detail === undefined ? '' : '  ➜ ' + String(typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 400)));
        fail += 1;
    }
}

function read(rel) {
    try { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); } catch (e) { return ''; }
}

function sliceFn(src, name) {
    const start = src.indexOf('function ' + name + '(');
    if (start === -1) return '';
    let i = src.indexOf('{', start);
    let depth = 0;
    let inStr = null;
    let prev = '';
    for (; i < src.length; i += 1) {
        const c = src[i];
        if (inStr) {
            if (c === inStr && prev !== '\\') inStr = null;
        } else if (c === '"' || c === "'" || c === '`') inStr = c;
        else if (c === '{') depth += 1;
        else if (c === '}') {
            depth -= 1;
            if (depth === 0) return src.slice(start, i + 1).replace(/^export\s+/, '');
        }
        prev = prev === '\\' ? '' : c;
    }
    return '';
}

const KHMER_DIGITS = '០១២៣៤៥៦៧៨៩';
function khmerNumber(n) {
    return String(n).replace(/[0-9]/g, (d) => KHMER_DIGITS[Number(d)]);
}

function isAscii(text) {
    return /^[\x09\x0a\x0d\x20-\x7e]*$/.test(String(text));
}

// ── ក. កិច្ចសន្យាឆ្លងឯកសារ ─────────────────────────────────────────────────────────────

function staticContract() {
    console.log('\n── ក. កិច្ចសន្យាឆ្លងឯកសារ ──');
    const files = ['provision.js', 'firebase-api.js', 'package.json', 'package-lock.json', 'README-KH.md',
        'setup.cmd', 'new-customer.cmd', 'deploy-rules.cmd'];
    const missing = files.filter((f) => !fs.existsSync(path.join(TOOL, f)));
    ok('ឯកសាររបស់ឧបករណ៍មានគ្រប់ (' + files.length + ')', missing.length === 0, missing);
    if (missing.indexOf('provision.js') !== -1 || missing.indexOf('firebase-api.js') !== -1) return null;

    let pkg = null;
    let lock = null;
    try { pkg = JSON.parse(read('tools/firebase-provision/package.json')); } catch (e) { pkg = null; }
    try { lock = JSON.parse(read('tools/firebase-provision/package-lock.json')); } catch (e) { lock = null; }
    const pin = pkg && pkg.dependencies && pkg.dependencies['firebase-tools'];
    ok('firebase-tools ត្រូវ pin កំណែពិតប្រាកដ (គ្មាន ^/~) ➜ function ខាងក្នុងដែលឧបករណ៍ប្រើ មិនប្តូរស្ងាត់ៗ',
        typeof pin === 'string' && /^[0-9]+\.[0-9]+\.[0-9]+$/.test(pin), pin);
    ok('package-lock ៖ root ស្នើ pin ដដែល និងដំឡើងកំណែដដែល',
        !!lock && lock.packages && lock.packages[''] && lock.packages[''].dependencies
        && lock.packages[''].dependencies['firebase-tools'] === pin
        && lock.packages['node_modules/firebase-tools'] && lock.packages['node_modules/firebase-tools'].version === pin);
    ok('engines.node ត្រូវស្របនឹង firebase-tools (>=20)', !!pkg && pkg.engines && /^>=\s*2[0-9]/.test(String(pkg.engines.node)));

    ['setup.cmd', 'new-customer.cmd', 'deploy-rules.cmd'].forEach((name) => {
        const raw = fs.readFileSync(path.join(TOOL, name), 'latin1');
        const lines = raw.split('\n');
        const crlf = lines.slice(0, -1).every((l) => l.endsWith('\r')) && lines[lines.length - 1] === '';
        ok(name + ' ៖ ASCII សុទ្ធ + CRLF (cmd.exe)', isAscii(raw) && crlf);
        ok(name + ' ៖ រត់ពីថតរបស់ខ្លួន (cd /d "%~dp0")', raw.indexOf('cd /d "%~dp0"') !== -1);
    });
    const setupCmd = read('tools/firebase-provision/setup.cmd');
    ok('setup.cmd ដំឡើងតាម lock (npm ci) ហើយ Login តាម firebase-tools',
        /npm ci --ignore-scripts/.test(setupCmd) && /provision\.js login/.test(setupCmd));

    let tool;
    try {
        tool = require(path.join(TOOL, 'provision.js'));
    } catch (e) {
        ok('provision.js ផ្ទុកបានដោយគ្មាន firebase-tools (ការផ្ទុកយឺត)', false, e.message);
        return null;
    }
    ok('provision.js ផ្ទុកបានដោយគ្មាន firebase-tools (ការផ្ទុកយឺត)', true);

    const fnSrc = read('ZoeW/netlify/functions/zto-order-detail.js');
    const fnPrefix = (fnSrc.match(/const SITE_EMAIL_PREFIX_DEFAULT = '([a-z0-9-]+)';/) || [])[1];
    const fnProjectRe = (fnSrc.match(/const PROJECT_ID_RE = (\/[^\n]+\/);/) || [])[1];
    const fnProjectMax = Number((fnSrc.match(/const PROJECT_ID_MAX = ([0-9]+);/) || [])[1]);
    const siteFn = sliceFn(fnSrc, 'siteCodeFromEmail');
    ok('Function ZTO ៖ រកឃើញ prefix · PROJECT_ID_RE · PROJECT_ID_MAX · siteCodeFromEmail()',
        !!fnPrefix && !!fnProjectRe && fnProjectMax > 0 && !!siteFn);
    ok('prefix អ៊ីមែលលំនាំដើមរបស់ឧបករណ៍ = SITE_EMAIL_PREFIX_DEFAULT របស់ Function', tool.EMAIL_PREFIX_DEFAULT === fnPrefix,
        tool.EMAIL_PREFIX_DEFAULT + ' ≠ ' + fnPrefix);
    if (siteFn && fnProjectRe) {
        const ctx = vm.createContext({});
        vm.runInContext(siteFn + '; this.siteCodeFromEmail = siteCodeFromEmail; this.PROJECT_ID_RE = ' + fnProjectRe + ';', ctx);
        const branches = ['881859', '7700', '0', '12345678901234567890123456789012'];
        const derived = branches.map((b) => ctx.siteCodeFromEmail(tool.userEmail('sok', fnPrefix, b), fnPrefix));
        ok('អ៊ីមែលដែលឧបករណ៍បង្កើត ➜ Function ដេរីវេលេខសាខាដដែល (siteCodeFromEmail ពិត)',
            JSON.stringify(derived) === JSON.stringify(branches), derived);
        const custom = ctx.siteCodeFromEmail(tool.userEmail('chan', 'abc-9', '4242'), 'abc-9');
        ok('ទិសដដែលលើ prefix ផ្ទាល់ខ្លួន (ZTO_SITE_EMAIL_PREFIX)', custom === '4242', custom);
        const full = tool.userEmail('Dara@ZOEW7700.com', fnPrefix, '881859');
        ok('អ៊ីមែលពេញរក្សាសាខារបស់វា (មិនបង្ខំសាខា --branch)', ctx.siteCodeFromEmail(full, fnPrefix) === '7700', full);
        const ids = ['881859', '7700', '12345678901234567890123'].map((b) => tool.derivedProjectId(b))
            .concat([tool.suffixedProjectId('zoew-881859'), tool.suffixedProjectId('zoew-123456789012345678901234567')]);
        ok('Project ID ដែលឧបករណ៍បង្កើត ឆ្លង PROJECT_ID_RE របស់ឧបករណ៍ និងរបស់ Function (FIREBASE_PROJECT_IDS)',
            ids.every((id) => (tool.PROJECT_ID_RE.test(id) || id.length > 30) && (id.length > 30 || ctx.PROJECT_ID_RE.test(id)))
            && tool.PROJECT_ID_RE.test(ids[3]) && tool.PROJECT_ID_RE.test(ids[4]) && ctx.PROJECT_ID_RE.test(ids[4]), ids);
    }
    const GCP_NAME_RE = /^[A-Za-z0-9 '!-]{4,30}$/;
    const names = ['1', '881859', '12345678901234567890123456789012'].map((b) => tool.defaultDisplayName(b));
    ok('ឈ្មោះ Project លំនាំដើមឆ្លងច្បាប់ Google (អក្សរ · លេខ · ដកឃ្លា · - \' ! · ៤–៣០ តួ) សូម្បីសាខា ៣២ ខ្ទង់',
        names.every((n) => GCP_NAME_RE.test(n) && tool.displayNameIsValid(n)), names);
    ok('--name ដែល Google បដិសេធ (_ · . · វែងពេក) ➜ ឧបករណ៍បដិសេធមុនហៅ Google',
        ['Shop_1', 'Shop.1', 'x'.repeat(31), 'abc'].every((n) => !tool.displayNameIsValid(n)));
    let badName = false;
    try { tool.userEmail('bad name', 'zoew', '1'); } catch (e) { badName = true; }
    let noBranch = false;
    try { tool.userEmail('sok', 'zoew', ''); } catch (e) { noBranch = true; }
    ok('ឈ្មោះអ្នកប្រើខុសទម្រង់ ឬគ្មានសាខា ➜ បដិសេធ (មិនបង្កើតអ៊ីមែលចម្លែក)', badName && noBranch);

    const readme = read('tools/firebase-provision/README-KH.md');
    ok('README ៖ ពិដាន Project ID របស់ Function (' + fnProjectMax + ') ដេរីវេពីកូដពិត',
        fnProjectMax > 0 && readme.indexOf('**' + khmerNumber(fnProjectMax) + '** Project ID') !== -1);
    ok('README ៖ ប្រវែងពាក្យសម្ងាត់ (' + tool.PASSWORD_LENGTH + ') ដេរីវេពីកូដពិត',
        readme.indexOf('ចៃដន្យ ' + khmerNumber(tool.PASSWORD_LENGTH) + ' តួ') !== -1
        && readme.indexOf('(' + khmerNumber(tool.PASSWORD_LENGTH) + ' តួ ·') !== -1);
    const pw = Array.from({ length: 50 }, () => tool.generatePassword());
    ok('ពាក្យសម្ងាត់ ៖ ប្រវែង · តួអក្សរ · មិនស្ទួន',
        pw.every((p) => p.length === tool.PASSWORD_LENGTH && [...p].every((c) => tool.PASSWORD_ALPHABET.indexOf(c) !== -1))
        && new Set(pw).size === pw.length);

    ok('Rules លំនាំដើម = firebase-database.rules.json របស់ repo',
        path.resolve(tool.DEFAULT_RULES_FILE) === path.resolve(ROOT, 'firebase-database.rules.json')
        && fs.existsSync(tool.DEFAULT_RULES_FILE), tool.DEFAULT_RULES_FILE);
    let rules = null;
    try { rules = tool.readRulesFile(tool.DEFAULT_RULES_FILE); } catch (e) { rules = null; }
    const node = rules ? tool.signedInReadNode(rules) : '';
    ok('node សម្រាប់វាស់ «អានក្រោយ Login» ដេរីវេពី rules ពិត (.read មាន auth != null)',
        !!node && /auth != null/.test(String(rules.parsed.rules[node]['.read'])), node);

    const zoewSrc = read('ZoeW/app.js') || read('ZoeW/src/features/config.ts');
    const keysLine = (zoewSrc.match(/const FIREBASE_CONFIG_KEYS = (\[[^\]]+\]);/) || [])[1];
    const decodeFn = sliceFn(zoewSrc, 'decodeSetupPayload');
    const dsnFn = sliceFn(zoewSrc, 'setupLinkDsnIsValid');
    ok('ZoeW ៖ រកឃើញ FIREBASE_CONFIG_KEYS · decodeSetupPayload() · setupLinkDsnIsValid()', !!keysLine && !!decodeFn && !!dsnFn);
    if (keysLine && decodeFn && dsnFn) {
        const ctx = vm.createContext({ atob: (s) => Buffer.from(s, 'base64').toString('binary'), escape, URL });
        vm.runInContext(decodeFn + '\n' + dsnFn + '\nthis.decode = decodeSetupPayload; this.dsnOk = setupLinkDsnIsValid; this.KEYS = ' + keysLine + ';', ctx);
        ok('វាល config ដែលឧបករណ៍ចេញ = FIREBASE_CONFIG_KEYS របស់ ZoeW',
            JSON.stringify(Array.from(ctx.KEYS)) === JSON.stringify(tool.FIREBASE_CONFIG_KEYS));
        const cfg = tool.pickConfig({ apiKey: 'AIza+/=x', authDomain: 'zoew-881859.firebaseapp.com', projectId: 'zoew-881859',
            appId: '1:1:web:a', storageBucket: 'b', messagingSenderId: '1', locationId: 'asia', extra: 'x' },
        'https://zoew-881859-default-rtdb.asia-southeast1.firebasedatabase.app');
        ok('pickConfig ៖ ដកវាលក្រៅបញ្ជី ហើយដាក់ databaseURL ពី Database ពិត',
            !('locationId' in cfg) && !('extra' in cfg) && /firebasedatabase\.app$/.test(cfg.databaseURL));
        const dsn = 'https://abc@o1.ingest.sentry.io/9';
        const link = tool.buildSetupLink('https://zoew.example.app', cfg, dsn);
        let decoded = null;
        try { decoded = ctx.decode(new URL(link).searchParams.get('setup')); } catch (e) { decoded = { error: e.message }; }
        ok('Setup Link របស់ឧបករណ៍ ➜ decodeSetupPayload() ពិតរបស់ ZoeW ផ្តល់ config + DSN ដដែល',
            !!decoded && JSON.stringify(Object.assign({}, cfg, { dsn: dsn })) === JSON.stringify(decoded), decoded);
        ok('Setup Link ចាប់ផ្តើមដោយ URL របស់ App + /?setup=', link.indexOf('https://zoew.example.app/?setup=') === 0);
        const samples = ['https://a@o1.ingest.sentry.io/1', 'https://sentry.io/x', 'http://a@sentry.io/1',
            'https://a@sentry.io.evil.com/1', 'https://evilsentry.io/1', '', 'not a url', 'https://a@o1.ingest.us.sentry.io/2'];
        const mismatch = samples.filter((s) => !!ctx.dsnOk(s) !== !!tool.sentryDsnIsValid(s));
        ok('DSN ៖ សាលក្រមរបស់ឧបករណ៍ = setupLinkDsnIsValid() ពិតរបស់ ZoeW (' + samples.length + ' គំរូ)', mismatch.length === 0, mismatch);
        const noDsnLink = tool.buildSetupLink('https://zoew.example.app', cfg, 'http://bad');
        let noDsn = null;
        try { noDsn = ctx.decode(new URL(noDsnLink).searchParams.get('setup')); } catch (e) { noDsn = null; }
        ok('DSN មិនត្រឹមត្រូវ ➜ មិនចូល Setup Link', !!noDsn && !('dsn' in noDsn));
    }
    let badUrl = false;
    try { tool.normalizeAppUrl('http://insecure.example'); } catch (e) { badUrl = true; }
    ok('App URL ត្រូវជា https (Setup Link មិនដឹក config តាម http)', badUrl && tool.normalizeAppUrl('https://x.app///') === 'https://x.app');
    return { tool, rules };
}

// ── ខ. Google ក្លែង (HTTPS · មានស្ថានភាព) ─────────────────────────────────────────────────

function makeTls(dir) {
    const run = (args) => cp.spawnSync('openssl', args, { cwd: dir, encoding: 'utf8', timeout: 30000 });
    const steps = [
        ['req', '-x509', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:P-256', '-nodes', '-keyout', 'ca.key', '-out', 'ca.crt', '-days', '2', '-subj', '/CN=zoe-provision-test-ca'],
        ['req', '-newkey', 'ec', '-pkeyopt', 'ec_paramgen_curve:P-256', '-nodes', '-keyout', 'srv.key', '-out', 'srv.csr', '-subj', '/CN=127.0.0.1']
    ];
    for (const args of steps) {
        const r = run(args);
        if (r.error || r.status !== 0) return null;
    }
    fs.writeFileSync(path.join(dir, 'ext.cnf'), 'subjectAltName=IP:127.0.0.1,DNS:localhost\n');
    const r = run(['x509', '-req', '-in', 'srv.csr', '-CA', 'ca.crt', '-CAkey', 'ca.key', '-CAcreateserial', '-out', 'srv.crt', '-days', '2', '-extfile', 'ext.cnf']);
    if (r.error || r.status !== 0) return null;
    return {
        caFile: path.join(dir, 'ca.crt'),
        key: fs.readFileSync(path.join(dir, 'srv.key')),
        cert: fs.readFileSync(path.join(dir, 'srv.crt'))
    };
}

function getPath(obj, key) {
    return key.split('.').reduce((cur, p) => (cur && typeof cur === 'object' ? cur[p] : undefined), obj);
}
function setPath(obj, key, value) {
    const parts = key.split('.');
    let cur = obj;
    parts.slice(0, -1).forEach((p) => {
        if (!cur[p] || typeof cur[p] !== 'object') cur[p] = {};
        cur = cur[p];
    });
    cur[parts[parts.length - 1]] = value;
}

function defaultAuthConfig() {
    return {
        signIn: { email: { enabled: false, passwordRequired: true } },
        client: { permissions: { disabledUserSignup: false, disabledUserDeletion: false } },
        emailPrivacyConfig: { enableImprovedEmailPrivacy: false },
        authorizedDomains: ['localhost']
    };
}

function createFake(tls) {
    const F = {
        knobs: {
            pollsBeforeDone: 1, authInitOnCreate: true, ignoreMask: new Set(), rejectMask: new Set(), failOnce: [],
            neverFinishCreate: false, createConflictButCreates: false, signUpStatus: 0, servicesEnabledOnCreate: false
        },
        log: [], tokens: new Set(), tokenRequests: [], ops: {}, opSeq: 0, projects: {}, idTokens: new Map(),
        servers: [], sockets: new Set(), seq: 1000
    };

    function newProject(id, owner) {
        const n = String(++F.seq);
        F.projects[id] = {
            id: id, owner: owner, number: n, firebase: false,
            services: F.knobs.servicesEnabledOnCreate ? { 'firebasedatabase.googleapis.com': true, 'identitytoolkit.googleapis.com': true } : {},
            apps: [], instances: {}, defaultDb: '',
            auth: { initialized: F.knobs.authInitOnCreate, config: defaultAuthConfig() },
            users: {}, apiKey: 'AIzaFake' + crypto.randomBytes(8).toString('hex')
        };
        return F.projects[id];
    }

    function newOp(response, never) {
        const name = 'operations/op' + (++F.opSeq);
        F.ops[name] = { polls: 0, response: response, never: !!never };
        return { name: name };
    }

    function send(res, status, body, type) {
        const text = type === 'text' ? String(body) : JSON.stringify(body === undefined ? {} : body);
        res.writeHead(status, { 'content-type': type === 'text' ? 'application/json; charset=utf-8' : 'application/json' });
        res.end(text);
    }
    function err(res, status, message, extra) {
        send(res, status, { error: Object.assign({ code: status, message: message, status: extra || '' }) });
    }

    function authed(req) {
        const h = String(req.headers.authorization || '');
        return h.startsWith('Bearer ') && F.tokens.has(h.slice(7));
    }

    function takeFailOnce(method, pathname) {
        const i = F.knobs.failOnce.findIndex((f) => f.method === method && f.re.test(pathname));
        if (i === -1) return 0;
        const status = F.knobs.failOnce[i].status;
        F.knobs.failOnce.splice(i, 1);
        return status;
    }

    function projectByApiKey(key) {
        return Object.values(F.projects).find((p) => p.apiKey === key) || null;
    }

    function publicAuth(res, action, key, body) {
        const p = projectByApiKey(key);
        if (!p) return err(res, 400, 'API_KEY_INVALID');
        const cfg = p.auth.config;
        if (action === 'signUp' && F.knobs.signUpStatus) return err(res, F.knobs.signUpStatus, 'INTERNAL_ERROR');
        if (!p.auth.initialized || !cfg.signIn.email.enabled) return err(res, 400, 'OPERATION_NOT_ALLOWED');
        const email = String(body.email || '').toLowerCase();
        if (action === 'signUp') {
            if (cfg.client.permissions.disabledUserSignup) return err(res, 400, 'ADMIN_ONLY_OPERATION');
            if (p.users[email]) return err(res, 400, 'EMAIL_EXISTS');
            const localId = 'u' + (++F.seq);
            p.users[email] = { localId: localId, password: String(body.password || ''), viaPublicSignUp: true };
            const token = 'idt-' + p.id + '-' + localId + '-' + crypto.randomBytes(4).toString('hex');
            F.idTokens.set(token, p.id);
            return send(res, 200, { localId: localId, email: email, idToken: token });
        }
        const u = p.users[email];
        if (!u || u.password !== String(body.password || '')) return err(res, 400, 'INVALID_LOGIN_CREDENTIALS');
        const token = 'idt-' + p.id + '-' + u.localId + '-' + crypto.randomBytes(4).toString('hex');
        F.idTokens.set(token, p.id);
        return send(res, 200, { localId: u.localId, email: email, idToken: token, registered: true });
    }

    function evalRule(rule, authedUser) {
        if (rule === true) return true;
        if (typeof rule !== 'string') return false;
        if (rule.trim() === 'true') return true;
        return rule.indexOf('auth != null') !== -1 ? authedUser : false;
    }

    function startDb(p, name) {
        const db = { name: name, rules: '{"rules":{".read":false,".write":false}}', puts: [], reads: [] };
        const srv = https.createServer({ key: tls.key, cert: tls.cert }, (req, res) => {
            let body = '';
            req.on('data', (c) => { body += c; });
            req.on('end', () => {
                const u = new URL(req.url, 'https://x');
                F.log.push({ host: 'db:' + name, method: req.method, path: u.pathname + u.search, auth: String(req.headers.authorization || '') });
                if (u.pathname === '/.settings/rules.json') {
                    if (!authed(req)) return err(res, 401, 'Unauthorized request.');
                    if (req.method === 'GET') return send(res, 200, db.rules, 'text');
                    if (req.method === 'PUT') {
                        try { JSON.parse(body); } catch (e) { return send(res, 400, { error: 'Parse error' }); }
                        const dry = u.searchParams.get('dryRun') === 'true';
                        db.puts.push({ dry: dry, text: body });
                        if (!dry) db.rules = body;
                        return send(res, 200, { status: 'ok' });
                    }
                }
                if (req.method === 'GET' && /\.json$/.test(u.pathname)) {
                    const node = decodeURIComponent(u.pathname.slice(1, -5));
                    const token = u.searchParams.get('auth') || '';
                    const admin = authed(req);
                    const user = !!token && F.idTokens.get(token) === p.id;
                    db.reads.push({ node: node, admin: admin, user: user });
                    let parsed = null;
                    try { parsed = JSON.parse(db.rules); } catch (e) { parsed = null; }
                    const top = parsed && parsed.rules ? parsed.rules : {};
                    const allowed = admin || evalRule(top['.read'], user) || (!!node && top[node] && evalRule(top[node]['.read'], user));
                    return allowed ? send(res, 200, null) : send(res, 401, { error: 'Permission denied' });
                }
                return err(res, 404, 'not found');
            });
        });
        srv.on('connection', (s) => { F.sockets.add(s); s.on('close', () => F.sockets.delete(s)); });
        F.servers.push(srv);
        return new Promise((resolve) => srv.listen(0, '127.0.0.1', () => {
            db.url = 'https://127.0.0.1:' + srv.address().port;
            resolve(db);
        }));
    }

    async function route(req, res, body, u) {
        const m = req.method;
        const p = u.pathname;
        let hit;
        if (m === 'POST' && p === '/oauth2/v3/token') {
            const rt = (body.match(/name="refresh_token"\r\n\r\n([^\r\n]+)/) || [])[1] || '';
            F.tokenRequests.push(rt);
            if (rt !== 'RT-OWNER') return send(res, 400, { error: 'invalid_grant' });
            const at = 'AT-' + crypto.randomBytes(6).toString('hex');
            F.tokens.add(at);
            return send(res, 200, { access_token: at, expires_in: 3600, token_type: 'Bearer', scope: 'https://www.googleapis.com/auth/cloud-platform' });
        }
        let json = {};
        try { json = body ? JSON.parse(body) : {}; } catch (e) { json = {}; }
        if (m === 'POST' && (hit = p.match(/^\/v1\/accounts:(signUp|signInWithPassword)$/))) {
            return publicAuth(res, hit[1], u.searchParams.get('key') || '', json);
        }
        if (!authed(req)) return err(res, 401, 'Request had invalid authentication credentials.', 'UNAUTHENTICATED');
        const forced = takeFailOnce(m, p);
        if (forced) return err(res, forced, 'injected failure', 'UNAVAILABLE');

        if ((hit = p.match(/^\/v1(beta1)?\/(operations\/[^/]+)$/)) && m === 'GET') {
            const op = F.ops[hit[2]];
            if (!op) return err(res, 404, 'no op');
            op.polls += 1;
            if (op.never || op.polls < F.knobs.pollsBeforeDone) return send(res, 200, { name: hit[2], done: false });
            return send(res, 200, { name: hit[2], done: true, response: op.response });
        }
        if (m === 'POST' && p === '/v1/projects') {
            const id = json.projectId;
            if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(String(id || '')) || !/^[A-Za-z0-9 '!-]{4,30}$/.test(String(json.name || ''))) {
                return err(res, 400, 'Request contains an invalid argument.', 'INVALID_ARGUMENT');
            }
            if (F.projects[id]) return err(res, 409, 'Requested entity already exists', 'ALREADY_EXISTS');
            const proj = newProject(id, 'owner');
            proj.displayName = json.name;
            if (F.knobs.createConflictButCreates) {
                F.knobs.createConflictButCreates = false;
                return err(res, 409, 'Requested entity already exists', 'ALREADY_EXISTS');
            }
            return send(res, 200, newOp({ projectId: id, name: json.name, lifecycleState: 'ACTIVE' }, F.knobs.neverFinishCreate));
        }
        if (m === 'GET' && (hit = p.match(/^\/v1\/projects\/([^/:]+)$/))) {
            const proj = F.projects[hit[1]];
            if (!proj || proj.owner !== 'owner') return err(res, 403, 'The caller does not have permission', 'PERMISSION_DENIED');
            return send(res, 200, { projectId: proj.id, projectNumber: proj.number, lifecycleState: 'ACTIVE', name: proj.displayName || proj.id });
        }
        const pid = (p.match(/^\/v1(?:beta1)?\/projects\/([^/:]+)/) || [])[1]
            || (p.match(/^\/admin\/v2\/projects\/([^/]+)/) || [])[1]
            || (p.match(/^\/v1beta\/projects\/([^/]+)/) || [])[1];
        const proj = pid && pid !== '-' ? F.projects[pid] : null;
        if (pid && pid !== '-' && (!proj || proj.owner !== 'owner')) return err(res, 403, 'The caller does not have permission', 'PERMISSION_DENIED');

        if (m === 'GET' && /^\/v1beta1\/projects\/[^/:]+$/.test(p)) {
            if (!proj.firebase) return err(res, 404, 'Firebase project not found', 'NOT_FOUND');
            return send(res, 200, { projectId: proj.id, projectNumber: proj.number, displayName: proj.displayName,
                resources: proj.defaultDb ? { realtimeDatabaseInstance: proj.defaultDb } : {} });
        }
        if (m === 'POST' && /^\/v1beta1\/projects\/[^/:]+:addFirebase$/.test(p)) {
            if (proj.firebase) return err(res, 409, 'already exists', 'ALREADY_EXISTS');
            proj.firebase = true;
            return send(res, 200, newOp({ projectId: proj.id, projectNumber: proj.number }));
        }
        if ((hit = p.match(/^\/v1\/projects\/[^/]+\/services\/([^/:]+)(:enable)?$/))) {
            if (m === 'POST' && hit[2]) {
                proj.services[hit[1]] = true;
                return send(res, 200, { name: 'operations/noop', done: true });
            }
            if (m === 'GET' && !hit[2]) return send(res, 200, { name: hit[1], state: proj.services[hit[1]] ? 'ENABLED' : 'DISABLED' });
        }
        if (/^\/v1beta1\/projects\/[^/]+\/webApps$/.test(p)) {
            if (!proj.firebase) return err(res, 404, 'Firebase project not found', 'NOT_FOUND');
            if (m === 'GET') return send(res, 200, proj.apps.length ? { apps: proj.apps } : {});
            if (m === 'POST') {
                const app = { name: 'projects/' + proj.id + '/webApps/x', appId: '1:' + proj.number + ':web:' + crypto.randomBytes(6).toString('hex'),
                    displayName: json.displayName, projectId: proj.id, platform: 'WEB' };
                proj.apps.push(app);
                return send(res, 200, newOp(app));
            }
        }
        if (m === 'GET' && (hit = p.match(/^\/v1beta1\/projects\/-\/webApps\/([^/]+)\/config$/))) {
            const owner = Object.values(F.projects).find((x) => x.apps.some((a) => a.appId === hit[1]));
            if (!owner) return err(res, 404, 'app not found');
            const cfg = { projectId: owner.id, appId: hit[1], storageBucket: owner.id + '.firebasestorage.app', locationId: 'asia-southeast1',
                apiKey: owner.apiKey, authDomain: owner.id + '.firebaseapp.com', messagingSenderId: owner.number };
            if (owner.defaultDb) cfg.databaseURL = owner.instances[owner.defaultDb].url;
            return send(res, 200, cfg);
        }
        if (/^\/v1beta\//.test(p)) {
            if (!proj.services['firebasedatabase.googleapis.com']) return err(res, 403, 'Firebase Realtime Database Management API has not been used in project', 'PERMISSION_DENIED');
            if (m === 'POST' && (hit = p.match(/^\/v1beta\/projects\/[^/]+\/locations\/([^/]+)\/instances$/))) {
                const name = u.searchParams.get('databaseId');
                if (['us-central1', 'europe-west1', 'asia-southeast1'].indexOf(hit[1]) === -1) return err(res, 400, 'bad location');
                const isDefault = String(json.type || '').toUpperCase() === 'DEFAULT_DATABASE';
                const conflict = !!proj.instances[name] || (isDefault && !!proj.defaultDb);
                if (u.searchParams.get('validateOnly') === 'true') {
                    return conflict ? send(res, 400, { error: { code: 400, message: 'taken', details: [{ metadata: {} }] } }) : send(res, 200, {});
                }
                if (conflict) return err(res, 400, 'Instance already exists', 'FAILED_PRECONDITION');
                const db = await startDb(proj, name);
                proj.instances[name] = db;
                db.location = hit[1];
                if (isDefault) proj.defaultDb = name;
                return send(res, 200, { name: 'projects/' + proj.number + '/locations/' + hit[1] + '/instances/' + name,
                    project: 'projects/' + proj.number, databaseUrl: db.url, type: 'DEFAULT_DATABASE', state: 'ACTIVE' });
            }
            if (m === 'GET' && (hit = p.match(/^\/v1beta\/projects\/[^/]+\/locations\/-\/instances\/([^/]+)$/))) {
                const db = proj.instances[hit[1]];
                if (!db) return err(res, 404, 'not found', 'NOT_FOUND');
                return send(res, 200, { name: 'projects/' + proj.number + '/locations/' + db.location + '/instances/' + db.name,
                    project: 'projects/' + proj.number, databaseUrl: db.url, type: 'DEFAULT_DATABASE', state: 'ACTIVE' });
            }
        }
        if (/^\/admin\/v2\/projects\/[^/]+\/config$/.test(p)) {
            if (!proj.services['identitytoolkit.googleapis.com']) return err(res, 403, 'Identity Toolkit API has not been used in project', 'PERMISSION_DENIED');
            if (String(req.headers['x-goog-user-project'] || '') !== proj.id) return err(res, 403, 'quota project required', 'PERMISSION_DENIED');
            if (!proj.auth.initialized) return err(res, 404, 'CONFIGURATION_NOT_FOUND', 'NOT_FOUND');
            if (m === 'GET') return send(res, 200, proj.auth.config);
            if (m === 'PATCH') {
                const mask = String(u.searchParams.get('updateMask') || u.searchParams.get('update_mask') || '').split(',').filter(Boolean);
                if (mask.some((key) => F.knobs.rejectMask.has(key))) return err(res, 400, 'INVALID_CONFIG : field not supported', 'INVALID_ARGUMENT');
                mask.forEach((key) => {
                    if (F.knobs.ignoreMask.has(key)) return;
                    const v = getPath(json, key);
                    setPath(proj.auth.config, key, v === undefined ? false : v);
                });
                return send(res, 200, proj.auth.config);
            }
        }
        if (m === 'POST' && p === '/v1alpha/firebase:provisionFirebaseApp') {
            const target = F.projects[String(json.parent || '').replace(/^projects\//, '')];
            if (!target || target.owner !== 'owner') return err(res, 403, 'denied');
            target.auth.initialized = true;
            if (json.firebaseAuthInput && json.firebaseAuthInput.emailAuthProviderMode === 'PROVIDER_ENABLED') target.auth.config.signIn.email.enabled = true;
            F.provisionCalls = (F.provisionCalls || 0) + 1;
            return send(res, 200, newOp({ appId: json.appNamespace }));
        }
        if ((hit = p.match(/^\/v1\/projects\/[^/]+\/accounts(:query|:update|:delete)?$/)) && m === 'POST') {
            if (!proj.services['identitytoolkit.googleapis.com']) return err(res, 403, 'Identity Toolkit API disabled');
            const action = hit[1] || '';
            if (!action) {
                const email = String(json.email || '').toLowerCase();
                if (proj.users[email]) return err(res, 400, 'EMAIL_EXISTS');
                if (String(json.password || '').length < 6) return err(res, 400, 'WEAK_PASSWORD : Password should be at least 6 characters');
                const localId = 'u' + (++F.seq);
                proj.users[email] = { localId: localId, password: String(json.password) };
                return send(res, 200, { localId: localId, email: email });
            }
            const byId = (id) => Object.keys(proj.users).find((e) => proj.users[e].localId === id);
            if (action === ':query') {
                const want = String((json.expression && json.expression[0] && json.expression[0].email) || '').toLowerCase();
                const u2 = proj.users[want];
                return send(res, 200, u2 ? { recordsCount: '1', userInfo: [{ localId: u2.localId, email: want }] } : { recordsCount: '0' });
            }
            const email = byId(json.localId);
            if (!email) return err(res, 400, 'USER_NOT_FOUND');
            if (action === ':update') {
                proj.users[email].password = String(json.password);
                return send(res, 200, { localId: json.localId });
            }
            delete proj.users[email];
            return send(res, 200, {});
        }
        return err(res, 404, 'fake: no route for ' + m + ' ' + p);
    }

    const srv = https.createServer({ key: tls.key, cert: tls.cert }, (req, res) => {
        let body = '';
        req.setEncoding('latin1');
        req.on('data', (c) => { body += c; });
        req.on('end', () => {
            const u = new URL(req.url, 'https://x');
            F.log.push({ host: 'api', method: req.method, path: u.pathname + u.search, auth: String(req.headers.authorization || ''),
                userProject: String(req.headers['x-goog-user-project'] || '') });
            Promise.resolve(route(req, res, body, u)).catch((e) => err(res, 500, 'fake crashed: ' + e.message));
        });
    });
    srv.on('connection', (s) => { F.sockets.add(s); s.on('close', () => F.sockets.delete(s)); });
    F.servers.push(srv);
    F.start = () => new Promise((resolve) => srv.listen(0, '127.0.0.1', () => {
        F.base = 'https://127.0.0.1:' + srv.address().port;
        resolve(F);
    }));
    F.stop = () => {
        F.sockets.forEach((s) => s.destroy());
        return Promise.all(F.servers.map((s) => new Promise((r) => s.close(() => r()))));
    };
    F.count = (method, re) => F.log.filter((e) => e.method === method && re.test(e.path)).length;
    return F;
}

function tempDir(prefix) {
    return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function makeEnvironment(fake, deps, caFile, loggedIn) {
    const base = tempDir('zoe-provision-');
    const xdg = path.join(base, 'xdg');
    fs.mkdirSync(path.join(xdg, 'configstore'), { recursive: true });
    if (loggedIn !== false) {
        fs.writeFileSync(path.join(xdg, 'configstore', 'firebase-tools.json'), JSON.stringify({
            user: { email: 'owner@example.com' },
            tokens: { refresh_token: 'RT-OWNER', access_token: '', expires_at: 0 },
            usage: false
        }));
    }
    const cwd = path.join(base, 'cwd');
    fs.mkdirSync(cwd);
    return { base: base, xdg: xdg, cwd: cwd, stateDir: path.join(base, 'state'), deps: deps, caFile: caFile, fake: fake };
}

function runTool(toolDir, args, env, extra, timeoutMs) {
    return new Promise((resolve) => {
        const childEnv = {
            PATH: process.env.PATH || '',
            HOME: env.base,
            USERPROFILE: env.base,
            XDG_CONFIG_HOME: env.xdg,
            NODE_EXTRA_CA_CERTS: env.caFile,
            NODE_PATH: env.deps,
            ZOE_PROVISION_STATE_DIR: env.stateDir,
            ZOE_PROVISION_API_POLL_MS: '100',
            FIREBASE_API_URL: env.fake.base,
            FIREBASE_RESOURCEMANAGER_URL: env.fake.base,
            FIREBASE_IDENTITY_URL: env.fake.base,
            FIREBASE_RTDB_MANAGEMENT_URL: env.fake.base,
            FIREBASE_SERVICE_USAGE_URL: env.fake.base,
            FIREBASE_TOKEN_URL: env.fake.base
        };
        Object.assign(childEnv, extra || {});
        const started = Date.now();
        const child = cp.spawn(process.execPath, [path.join(toolDir, 'provision.js')].concat(args),
            { cwd: env.cwd, env: childEnv, stdio: ['ignore', 'pipe', 'pipe'] });
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (c) => { stdout += c; });
        child.stderr.on('data', (c) => { stderr += c; });
        let killed = false;
        const timer = setTimeout(() => { killed = true; child.kill('SIGKILL'); }, timeoutMs || RUN_TIMEOUT_MS);
        child.on('close', (code) => {
            clearTimeout(timer);
            resolve({ code: killed ? null : code, killed: killed, stdout: stdout, stderr: stderr, ms: Date.now() - started });
        });
    });
}

function passwordsFrom(stdout) {
    const out = {};
    String(stdout).split('\n').forEach((line) => {
        const m = line.match(/^\s+(\S+@\S+)\s+password: (\S+)/);
        if (m) out[m[1]] = m[2];
    });
    return out;
}

function stateOf(env, id) {
    try { return JSON.parse(fs.readFileSync(path.join(env.stateDir, id + '.json'), 'utf8')); } catch (e) { return null; }
}

function canonical(v) {
    if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}';
    return JSON.stringify(v);
}

function sameRules(text, rulesText) {
    try { return canonical(JSON.parse(text)) === canonical(JSON.parse(rulesText)); } catch (e) { return false; }
}

function securityLine(stdout, name) {
    const line = String(stdout).split('\n').find((l) => l.indexOf('] ' + name) !== -1) || '';
    return (line.match(/\[(OK  |FAIL|WARN|SKIP)\]/) || [])[1] || '';
}

// ── សេណារីយ៉ូ (t = អ្នកកត់ ៖ ok ធម្មតា ឬស្ងាត់ពេលវាស់ mutation) ─────────────────────────────

const NEW_ARGS = ['new', '--branch', '881859', '--user', 'sok,chan', '--app-url', 'https://zoew.example.app',
    '--sentry-dsn', 'https://abc@o1.ingest.sentry.io/9'];

async function scenarioCore(t, ctx, toolDir) {
    const fake = await createFake(ctx.tls).start();
    fake.knobs.pollsBeforeDone = 3;
    const env = makeEnvironment(fake, ctx.deps, ctx.tls.caFile);
    try {
        const r = await runTool(toolDir, NEW_ARGS, env);
        const all = r.stdout + r.stderr;
        t('ហ.១ new ៖ exit 0 (បង្កើត ➜ វាស់ឆ្លងទាំងអស់)', r.code === 0, r.code + '\n' + all.slice(-1500));
        t('ហ.១ output ទាំងអស់ជា ASCII (cmd.exe)', isAscii(all));
        const proj = fake.projects['zoew-881859'];
        t('ហ.១ Project zoew-881859 · Firebase បើក · បង្កើតតែម្តង', !!proj && proj.firebase && fake.count('POST', /^\/v1\/projects$/) === 1);
        t('ហ.១ API ដែលបិទពីដើម ត្រូវបានបើក (Database · Identity Toolkit)', !!proj
            && proj.services['firebasedatabase.googleapis.com'] === true && proj.services['identitytoolkit.googleapis.com'] === true);
        t('ហ.១ Web App «ZoeW» តែមួយ', !!proj && proj.apps.length === 1 && proj.apps[0].displayName === 'ZoeW');
        const db = proj && proj.defaultDb ? proj.instances[proj.defaultDb] : null;
        t('ហ.១ Database លំនាំដើមនៅ asia-southeast1', !!db && db.location === 'asia-southeast1' && db.name === 'zoew-881859-default-rtdb');
        t('ហ.១ Rules លើ Database = firebase-database.rules.json របស់ repo', !!db && sameRules(db.rules, ctx.rulesText));
        const cfg = proj ? proj.auth.config : {};
        t('ហ.១ Authentication ៖ Email/Password បើក · sign-up បិទ · delete បិទ · enumeration protection បើក',
            cfg.signIn && cfg.signIn.email.enabled === true && cfg.client.permissions.disabledUserSignup === true
            && cfg.client.permissions.disabledUserDeletion === true && cfg.emailPrivacyConfig.enableImprovedEmailPrivacy === true, cfg);
        const pw = passwordsFrom(r.stdout);
        const emails = Object.keys(pw).sort();
        t('ហ.១ គណនីបុគ្គលិក ២ បង្ហាញជាមួយពាក្យសម្ងាត់', JSON.stringify(emails) === JSON.stringify(['chan@zoew881859.com', 'sok@zoew881859.com']), emails);
        t('ហ.១ ពាក្យសម្ងាត់ដែលបង្ហាញ = ពាក្យសម្ងាត់ពិតលើ server', !!proj && emails.length === 2
            && emails.every((e) => proj.users[e] && proj.users[e].password === pw[e]));
        t('ហ.១ ការវាស់ sign-up សាធារណៈមិនបន្សល់គណនី probe', !!proj && !Object.keys(proj.users).some((e) => /^probe-/.test(e)));
        t('ហ.១ ការវាស់ ៖ sign-up ត្រូវបដិសេធ · rules ដូចគ្នា · អានគ្មាន Login បដិសេធ · Login · អានក្រោយ Login',
            securityLine(r.stdout, 'public sign-up blocked') === 'OK  ' && securityLine(r.stdout, 'database rules') === 'OK  '
            && securityLine(r.stdout, 'anonymous read denied') === 'OK  ' && securityLine(r.stdout, 'signed-in read allowed') === 'OK  '
            && securityLine(r.stdout, 'staff login sok@zoew881859.com') === 'OK  '
            && securityLine(r.stdout, 'auth settings') === 'OK  ' && securityLine(r.stdout, 'e-mail enumeration protection') === 'OK  ');
        const mgmt = fake.log.filter((e) => e.host === 'api' && !/^\/(oauth2|v1\/accounts:)/.test(e.path));
        t('ហ.១ ⛔ ផ្លូវ token ពិតរបស់ firebase-tools ៖ refresh ដោយ RT-OWNER ➜ រាល់ការហៅ management មាន Bearer ដែល token endpoint ចេញ',
            fake.tokenRequests.length >= 1 && fake.tokenRequests.every((rt) => rt === 'RT-OWNER')
            && mgmt.length > 10 && mgmt.every((e) => e.auth.startsWith('Bearer AT-')), mgmt.filter((e) => !e.auth.startsWith('Bearer AT-')).slice(0, 3));
        const adminCfg = fake.log.filter((e) => /^\/admin\/v2\//.test(e.path));
        t('ហ.១ ការហៅ Authentication settings មាន x-goog-user-project ត្រឹមត្រូវ', adminCfg.length >= 2 && adminCfg.every((e) => e.userProject === 'zoew-881859'));
        const st = stateOf(env, 'zoew-881859');
        const stText = st ? JSON.stringify(st) : '';
        t('ហ.១ state ៖ ជំហានទាំងអស់ · អ្នកប្រើ · complete', !!st && st.complete === true
            && ['project', 'firebase', 'apis', 'app', 'database', 'rules', 'auth', 'users'].every((s) => st.steps[s] === true)
            && st.users.length === 2);
        t('ហ.១ ⛔ state មិនផ្ទុកពាក្យសម្ងាត់ ឬ token', !!st && Object.values(pw).every((p) => stText.indexOf(p) === -1)
            && !/AT-|RT-OWNER|password/i.test(stText));
        if (process.platform !== 'win32') {
            const mode = st ? fs.statSync(path.join(env.stateDir, 'zoew-881859.json')).mode & 0o777 : 0;
            t('ហ.១ state mode 600', mode === 0o600, mode.toString(8));
        }
        const link = (r.stdout.match(/Setup Link: (https:\S+)/) || [])[1] || '';
        let decoded = null;
        try { decoded = ctx.decode ? ctx.decode(new URL(link).searchParams.get('setup')) : null; } catch (e) { decoded = null; }
        t('ហ.១ Setup Link ➜ ZoeW decode ៖ apiKey · databaseURL ពិត · DSN', !!decoded && !!proj && decoded.apiKey === proj.apiKey
            && !!db && decoded.databaseURL === db.url && decoded.projectId === 'zoew-881859' && decoded.dsn === 'https://abc@o1.ingest.sentry.io/9', decoded);
        const stray = ['firebase-debug.log', 'database-debug.log'].filter((f) => fs.existsSync(path.join(env.cwd, f)) || fs.existsSync(path.join(toolDir, f)));
        t('ហ.១ គ្មាន firebase-debug.log (អាចផ្ទុក token) ក្នុង cwd ឬថតឧបករណ៍', stray.length === 0, stray);

        if (!proj || !db) {
            t('ហ.២ ត្រូវការ Project + Database ពីជំហាន ហ.១', false);
            return;
        }
        if (ctx.quick) return;
        const again = await runTool(toolDir, NEW_ARGS, env);
        t('ហ.២ រត់ម្តងទៀត ៖ exit 0 គ្មានការបង្កើតស្ទួន (Project · App · Database · គណនី)', again.code === 0
            && fake.count('POST', /^\/v1\/projects$/) === 1 && proj.apps.length === 1 && Object.keys(proj.instances).length === 1
            && Object.keys(passwordsFrom(again.stdout)).length === 0, again.stdout.slice(-800));

    } finally {
        await fake.stop();
        fs.rmSync(env.base, { recursive: true, force: true });
    }
}

async function seeded(t, ctx, label, args) {
    const fake = await createFake(ctx.tls).start();
    const env = makeEnvironment(fake, ctx.deps, ctx.tls.caFile);
    const seed = await runTool(ctx.toolDir, args, env);
    const proj = fake.projects['zoew-881859'];
    const db = proj && proj.defaultDb ? proj.instances[proj.defaultDb] : null;
    if (seed.code !== 0 || !proj || !db) t(label + ' ត្រូវការ Project ដែលបង្កើតរួច (new exit 0)', false, seed.stderr + seed.stdout.slice(-500));
    return { fake, env, seed, proj, db, ok: seed.code === 0 && !!proj && !!db,
        done: async () => { await fake.stop(); fs.rmSync(env.base, { recursive: true, force: true }); } };
}

async function scenarioDrift(t, ctx, toolDir) {
    const w = await seeded(t, Object.assign({}, ctx, { toolDir }), 'ហ.៣', ['new', '--branch', '881859', '--user', 'sok']);
    try {
        if (!w.ok) return;
        const { env, db } = w;
        db.rules = '{"rules":{".read":true,".write":true}}';
        const drift = await runTool(toolDir, ['verify', '--project', 'zoew-881859'], env);
        t('ហ.៣ rules ឃ្លាត (.read true) ➜ verify exit 1 · rules FAIL · អានគ្មាន Login FAIL', drift.code === 1
            && securityLine(drift.stdout, 'database rules') === 'FAIL' && securityLine(drift.stdout, 'anonymous read denied') === 'FAIL', drift.stdout.slice(-900));
        const refused = await runTool(toolDir, ['rules', '--project', 'zoew-881859'], env);
        t('ហ.៣ rules ដោយគ្មាន --yes (non-TTY) ➜ បដិសេធ exit 2 មិនប៉ះ Database', refused.code === 2 && db.rules.indexOf('".read":true') !== -1);
        const dry = await runTool(toolDir, ['rules', '--all', '--dry-run'], env);
        t('ហ.៣ rules --dry-run ៖ exit 0 · ផ្ញើតែ dryRun · rules នៅដដែល', dry.code === 0 && db.puts[db.puts.length - 1].dry === true
            && db.rules.indexOf('".read":true') !== -1, dry.stdout.slice(-500));
        const fixed = await runTool(toolDir, ['rules', '--all', '--yes'], env);
        t('ហ.៣ rules --all --yes ➜ ដំឡើងឡើងវិញ ហើយអានត្រឡប់ស្មើ repo', fixed.code === 0 && sameRules(db.rules, ctx.rulesText), fixed.stdout.slice(-500));
        const clean = await runTool(toolDir, ['verify', '--all'], env);
        t('ហ.៣ verify ក្រោយជួសជុល ➜ exit 0', clean.code === 0, clean.stdout.slice(-900));
    } finally {
        await w.done();
    }
}

async function scenarioUsers(t, ctx, toolDir) {
    const w = await seeded(t, Object.assign({}, ctx, { toolDir }), 'ហ.៤', ['new', '--branch', '881859', '--user', 'sok,chan']);
    try {
        if (!w.ok) return;
        const { env, proj } = w;
        const pw = passwordsFrom(w.seed.stdout);
        const noReset = await runTool(toolDir, ['user', '--project', 'zoew-881859', '--user', 'sok'], env);
        t('ហ.៤ user មានរួច ដោយគ្មាន --reset ➜ មិនប្តូរពាក្យសម្ងាត់ (exit 2)', noReset.code === 2 && proj.users['sok@zoew881859.com'].password === pw['sok@zoew881859.com']);
        const reset = await runTool(toolDir, ['user', '--project', 'zoew-881859', '--user', 'sok', '--reset'], env);
        const newPw = passwordsFrom(reset.stdout)['sok@zoew881859.com'];
        t('ហ.៤ user --reset ➜ ពាក្យសម្ងាត់ថ្មីដើរ · ចាស់លែងដើរ', reset.code === 0 && !!newPw && newPw !== pw['sok@zoew881859.com']
            && proj.users['sok@zoew881859.com'].password === newPw, reset.stdout.slice(-600));
        const added = await runTool(toolDir, ['user', '--project', 'zoew-881859', '--user', 'dara'], env);
        t('ហ.៤ user ថ្មី ➜ បង្កើត · Login ដើរ · ចូល state', added.code === 0 && !!proj.users['dara@zoew881859.com']
            && (stateOf(env, 'zoew-881859') || { users: [] }).users.indexOf('dara@zoew881859.com') !== -1, added.stdout.slice(-400));
    } finally {
        await w.done();
    }
}

async function scenarioUnmeasured(t, ctx, toolDir) {
    const w = await seeded(t, Object.assign({}, ctx, { toolDir }), 'ហ.៥', ['new', '--branch', '881859', '--user', 'sok']);
    try {
        if (!w.ok) return;
        const { env, fake } = w;
        fake.knobs.signUpStatus = 500;
        const unmeasured = await runTool(toolDir, ['verify', '--project', 'zoew-881859'], env);
        t('ហ.៥ sign-up endpoint ធ្លាក់ 500 ➜ «វាស់មិនបាន» exit 3 (មិនមែន 0 ឬ 1)', unmeasured.code === 3
            && securityLine(unmeasured.stdout, 'public sign-up blocked') === 'WARN', unmeasured.stdout.slice(-600));
        fake.knobs.signUpStatus = 0;
    } finally {
        await w.done();
    }
}

async function scenarioNotLoggedIn(t, ctx, toolDir) {
    const fake = await createFake(ctx.tls).start();
    const env = makeEnvironment(fake, ctx.deps, ctx.tls.caFile, false);
    try {
        const r = await runTool(toolDir, ['new', '--branch', '881859', '--user', 'sok'], env);
        t('ច.១ មិនទាន់ Login ➜ exit 1 ប្រាប់ឲ្យ Login · គ្មានការហៅ Google', r.code === 1 && /Not logged in/.test(r.stderr) && fake.log.length === 0, r.stderr);
        const d = await runTool(toolDir, ['doctor'], env);
        t('ច.១ doctor ៖ ពិនិត្យ library ឆ្លង · រាយថាមិនទាន់ Login (exit 1)', d.code === 1 && /library check  : ok/.test(d.stdout) && /logged in      : NO/.test(d.stdout));
    } finally {
        await fake.stop();
        fs.rmSync(env.base, { recursive: true, force: true });
    }
}

async function scenarioResume(t, ctx, toolDir) {
    const fake = await createFake(ctx.tls).start();
    fake.knobs.failOnce.push({ method: 'POST', re: /\/webApps$/, status: 400 });
    const env = makeEnvironment(fake, ctx.deps, ctx.tls.caFile);
    try {
        const first = await runTool(toolDir, ['new', '--branch', '7700', '--user', 'sok'], env);
        const st = stateOf(env, 'zoew-7700');
        t('ឆ.១ ធ្លាក់ត្រង់ Web App ➜ exit 1 · state ចងចាំជំហានមុន (project · firebase · apis)', first.code === 1 && !!st
            && st.steps.project && st.steps.firebase && st.steps.apis && !st.steps.app, first.stderr + first.stdout.slice(-400));
        const second = await runTool(toolDir, ['new', '--branch', '7700', '--user', 'sok'], env);
        const proj = fake.projects['zoew-7700'];
        t('ឆ.១ រត់ម្តងទៀត ➜ បន្តរហូតចប់ · Project/App តែមួយ', second.code === 0 && fake.count('POST', /^\/v1\/projects$/) === 1
            && !!proj && proj.apps.length === 1, second.stdout.slice(-600));
    } finally {
        await fake.stop();
        fs.rmSync(env.base, { recursive: true, force: true });
    }
}

async function scenarioIds(t, ctx, toolDir) {
    const fake = await createFake(ctx.tls).start();
    fake.projects['zoew-4242'] = { id: 'zoew-4242', owner: 'other', apps: [], instances: {}, users: {}, auth: { config: defaultAuthConfig() } };
    fake.projects['shop-taken-1'] = { id: 'shop-taken-1', owner: 'other', apps: [], instances: {}, users: {}, auth: { config: defaultAuthConfig() } };
    const env = makeEnvironment(fake, ctx.deps, ctx.tls.caFile);
    try {
        const r = await runTool(toolDir, ['new', '--branch', '4242', '--user', 'sok'], env);
        const ids = Object.keys(fake.projects).filter((id) => fake.projects[id].owner === 'owner');
        t('ជ.១ ID ដេរីវេមានគេយក ➜ បច្ច័យ ៤ តួ · state ផ្លាស់ឈ្មោះ', r.code === 0 && ids.length === 1 && /^zoew-4242-[a-z0-9]{4}$/.test(ids[0])
            && !!stateOf(env, ids[0]) && !fs.existsSync(path.join(env.stateDir, 'zoew-4242.json')), ids.concat([r.stdout.slice(-400)]));
        const before = fake.log.length;
        const x = await runTool(toolDir, ['new', '--branch', '5555', '--project-id', 'shop-taken-1', '--user', 'sok'], env);
        const after = fake.log.slice(before);
        t('ជ.២ --project-id មានគេយក ➜ exit 2 · គ្មាន addFirebase/App', x.code === 2 && !after.some((e) => /addFirebase|webApps/.test(e.path)), x.stderr);
    } finally {
        await fake.stop();
        fs.rmSync(env.base, { recursive: true, force: true });
    }
}

async function scenarioAdopt(t, ctx, toolDir) {
    const fake = await createFake(ctx.tls).start();
    const env = makeEnvironment(fake, ctx.deps, ctx.tls.caFile);
    try {
        const seed = await runTool(toolDir, ['new', '--branch', '1234', '--user', 'sok'], env);
        fs.rmSync(env.stateDir, { recursive: true, force: true });
        const proj = fake.projects['zoew-1234'];
        const creates = fake.count('POST', /^\/v1\/projects$/);
        if (!proj || !proj.defaultDb) {
            t('ឈ.* ត្រូវការ Project + Database ពីការរត់ដំបូង', false, seed.stderr);
            return;
        }
        const putsBefore = proj.instances[proj.defaultDb].puts.length;
        const refused = await runTool(toolDir, ['new', '--branch', '1234', '--user', 'sok'], env);
        t('ឈ.១ Project មានស្រាប់ គ្មាន state គ្មាន --adopt ➜ exit 2 · មិនប៉ះ rules', seed.code === 0 && refused.code === 2
            && /--adopt/.test(refused.stderr) && proj.instances[proj.defaultDb].puts.length === putsBefore, refused.stderr);
        const adopted = await runTool(toolDir, ['new', '--branch', '1234', '--adopt'], env);
        t('ឈ.២ --adopt ➜ exit 0 · មិនបង្កើត Project ថ្មី · Database ដដែល · គណនីចាស់មិនប៉ះ', adopted.code === 0
            && fake.count('POST', /^\/v1\/projects$/) === creates && Object.keys(proj.instances).length === 1
            && Object.keys(passwordsFrom(adopted.stdout)).length === 0, adopted.stdout.slice(-700));
    } finally {
        await fake.stop();
        fs.rmSync(env.base, { recursive: true, force: true });
    }
}

async function scenarioLockdownIgnored(t, ctx, toolDir) {
    const fake = await createFake(ctx.tls).start();
    fake.knobs.ignoreMask.add('client.permissions.disabledUserSignup');
    const env = makeEnvironment(fake, ctx.deps, ctx.tls.caFile);
    try {
        const r = await runTool(toolDir, ['new', '--branch', '3030', '--user', 'sok'], env);
        const st = stateOf(env, 'zoew-3030');
        t('ញ.១ server មិនអនុវត្ត disabledUserSignup ➜ ជំហាន auth ធ្លាក់ (did not stick) · គណនីមិនទាន់បង្កើត',
            r.code === 1 && /did not stick/.test(r.stderr) && !!st && !st.steps.auth && !st.steps.users, r.stderr);
        const v = await runTool(toolDir, ['verify', '--project', 'zoew-3030'], env);
        const proj = fake.projects['zoew-3030'];
        t('ញ.២ verify ៖ sign-up សាធារណៈបើក ➜ FAIL · exit 1', v.code === 1 && securityLine(v.stdout, 'public sign-up blocked') === 'FAIL', v.stdout.slice(-700));
        t('ញ.២ គណនី probe ដែលចុះឈ្មោះបាន ត្រូវលុបចោលភ្លាម', !!proj && !Object.keys(proj.users).some((e) => /^probe-/.test(e))
            && fake.count('POST', /accounts:delete$/) >= 1);
    } finally {
        await fake.stop();
        fs.rmSync(env.base, { recursive: true, force: true });
    }
}

async function scenarioSlow(t, ctx, toolDir) {
    const fake = await createFake(ctx.tls).start();
    fake.knobs.neverFinishCreate = true;
    const env = makeEnvironment(fake, ctx.deps, ctx.tls.caFile);
    try {
        const r = await runTool(toolDir, ['new', '--branch', '6060', '--user', 'sok'], env, { ZOE_PROVISION_STEP_TIMEOUT_MS: '1500' }, 12000);
        const st = stateOf(env, 'zoew-6060');
        t('ដ.១ ការបង្កើត Project មិនចប់ ➜ tool ចេញក្នុងពិដាន (timed out) · state ចងចាំ pendingProject', r.code === 1 && !r.killed && r.ms < 15000
            && /timed out/.test(r.stderr) && !!st && st.pendingProject === 'zoew-6060', { code: r.code, ms: r.ms, err: r.stderr });
        fake.knobs.neverFinishCreate = false;
        const r2 = await runTool(toolDir, ['new', '--branch', '6060', '--user', 'sok'], env);
        t('ដ.២ ⛔ យឺតតែជោគជ័យ ➜ រត់ម្តងទៀតទទួលស្គាល់ Project ខ្លួនឯង ដោយគ្មាន --adopt · គ្មានការបង្កើតទី ២',
            r2.code === 0 && fake.count('POST', /^\/v1\/projects$/) === 1, r2.stderr + r2.stdout.slice(-500));

        fake.knobs.createConflictButCreates = true;
        const r3 = await runTool(toolDir, ['new', '--branch', '6161', '--user', 'sok'], env);
        const mine = Object.keys(fake.projects).filter((id) => /^zoew-6161/.test(id));
        t('ដ.៣ ⛔ 409 លើ Project ដែលការហៅរបស់យើងទើបបង្កើត ➜ មិនបោះបង់ហើយបង្កើតទី ២ (zoew-6161-xxxx)', r3.code === 0
            && JSON.stringify(mine) === JSON.stringify(['zoew-6161']), mine);
    } finally {
        await fake.stop();
        fs.rmSync(env.base, { recursive: true, force: true });
    }
}

async function scenarioAuthInit(t, ctx, toolDir) {
    const fake = await createFake(ctx.tls).start();
    fake.knobs.authInitOnCreate = false;
    fake.knobs.servicesEnabledOnCreate = true;
    const env = makeEnvironment(fake, ctx.deps, ctx.tls.caFile);
    try {
        const r = await runTool(toolDir, ['new', '--branch', '9090', '--user', 'sok'], env);
        const proj = fake.projects['zoew-9090'];
        t('ឋ.១ Authentication មិនទាន់ initialize (404) ➜ ផ្លូវ provisioning ផ្លូវការ ➜ PATCH ម្តងទៀត ➜ exit 0',
            r.code === 0 && fake.provisionCalls === 1 && !!proj && proj.auth.config.client.permissions.disabledUserSignup === true, r.stderr + r.stdout.slice(-600));
        fake.knobs.authInitOnCreate = true;
        fake.knobs.rejectMask.add('emailPrivacyConfig.enableImprovedEmailPrivacy');
        const r2 = await runTool(toolDir, ['new', '--branch', '9191', '--user', 'sok'], env);
        const p2 = fake.projects['zoew-9191'];
        t('ឋ.២ server បដិសេធវាលស្រេចចិត្ត (enumeration protection) ➜ PATCH វាលចាំបាច់ម្តងទៀត ➜ sign-up នៅតែបិទ · exit 0 · រាយ SKIP',
            r2.code === 0 && !!p2 && p2.auth.config.client.permissions.disabledUserSignup === true
            && securityLine(r2.stdout, 'e-mail enumeration protection') === 'SKIP' && securityLine(r2.stdout, 'public sign-up blocked') === 'OK  ',
            r2.stderr + r2.stdout.slice(-700));
    } finally {
        await fake.stop();
        fs.rmSync(env.base, { recursive: true, force: true });
    }
}

// ── គ. mutation ─────────────────────────────────────────────────────────────────────────

const MUTATIONS = [
    { name: 'ដក disabledUserSignup ចេញពី AUTH_LOCKDOWN', file: 'firebase-api.js', from: "    'client.permissions.disabledUserSignup': true,\n", to: '', scenario: 'core' },
    { name: 'sign-up ដែលបើក រាយ ok', file: 'provision.js', from: "add('public sign-up blocked', 'fail', 'ANYONE", to: "add('public sign-up blocked', 'ok', 'ANYONE", scenario: 'lockdown' },
    { name: 'state ផ្ទុកពាក្យសម្ងាត់', file: 'provision.js', from: '    state.complete = true;\n', to: '    state.complete = true;\n    state.lastPasswords = passwords;\n', scenario: 'core' },
    { name: 'មិនដំឡើង rules', file: 'provision.js', from: '            await api.deployRules(state.databaseURL, rules.text, false);\n', to: '', scenario: 'core' },
    { name: 'គ្មាន x-goog-user-project', file: 'firebase-api.js', from: "        headers: { 'x-goog-user-project': projectId },\n        body: nestedPatch", to: '        body: nestedPatch', scenario: 'core' },
    { name: 'យក Project មានស្រាប់ដោយគ្មាន --adopt', file: 'provision.js', from: "if (state.pendingProject !== id && opts.adopt !== true) {", to: 'if (false) {', scenario: 'adopt' },
    { name: 'មិនកត់ pendingProject មុនបង្កើត', file: 'provision.js', from: '        state.pendingProject = id;\n        saveState(state);\n', to: '', scenario: 'slow' },
    { name: 'មិនពិនិត្យ 409 លើ Project ខ្លួនឯង', file: 'provision.js', from: '        if ((await api.cloudProject(id)).accessible) return;\n', to: '', scenario: 'slow' },
    { name: 'អានគ្មាន Login ដែលបើក រាយ ok', file: 'provision.js', from: "else if (res.status === 200) add('anonymous read denied', 'fail'", to: "else if (res.status === 200) add('anonymous read denied', 'ok'", scenario: 'drift' },
    { name: 'គ្មាន requireAuth (token seam)', file: 'firebase-api.js', from: '    await m.requireAuth.requireAuth({ user: account.user, tokens: account.tokens });\n', to: '', scenario: 'core' },
    { name: 'គ្មានពិដានជំហាន', file: 'provision.js', from: "    return api.withDeadline(fn(), STEP_TIMEOUT_MS, 'step \"' + name + '\"');", to: '    return fn();', scenario: 'slow' },
    { name: 'user --reset មិនបាច់ ➜ ប្តូរពាក្យសម្ងាត់គណនីមានស្រាប់', file: 'provision.js', from: '    } else if (opts.reset === true) {', to: '    } else if (true) {', scenario: 'users' },
    { name: 'វាលស្រេចចិត្តត្រូវបដិសេធ ➜ មិន PATCH វាលចាំបាច់ម្តងទៀត', file: 'firebase-api.js', from: '    if (res.status === 400) res = await patchAuthConfig(projectId, AUTH_LOCKDOWN);\n', to: '', scenario: 'authinit' },
    { name: 'Authentication មិនទាន់ initialize ➜ មិនហៅ provisioning', file: 'firebase-api.js', from: '        await initAuth(projectId, appId);\n', to: '', scenario: 'authinit' }
];

const SCENARIOS = {
    core: scenarioCore, drift: scenarioDrift, users: scenarioUsers, lockdown: scenarioLockdownIgnored, adopt: scenarioAdopt,
    slow: scenarioSlow, authinit: scenarioAuthInit
};
const JOBS = (() => {
    const asked = parseInt(process.env.FBPROVISION_JOBS || '', 10);
    if (Number.isFinite(asked) && asked >= 1) return Math.min(asked, 16);
    return Math.min(6, Math.max(2, os.cpus().length || 2));
})();

// ⛔ រត់ស្របគ្នា (សេណារីយ៉ូនីមួយៗមាន Google ក្លែង · state · port ផ្ទាល់ខ្លួន) តែការអះអាង **ចាក់ចូល ok() តាមលំដាប់ថេរ**
//    ក្រោយចប់ ➜ output មិនប្រែតាមពេល ហើយការពុល ok() របស់ exit-code-integrity គ្របគ្រប់ការអះអាង។
async function pool(items, limit, fn) {
    const out = new Array(items.length);
    let next = 0;
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (next < items.length) {
            const k = next++;
            out[k] = await fn(items[k], k);
        }
    }));
    return out;
}

async function mutationRound(ctx) {
    console.log('\n── គ. mutation លើ tool ពិត ➜ សេណារីយ៉ូត្រូវក្រហម ──');
    const results = await pool(MUTATIONS, JOBS, async (mut) => {
        const dir = tempDir('zoe-provision-mut-');
        try {
            const toolDir = path.join(dir, 'tools', 'firebase-provision');
            fs.mkdirSync(toolDir, { recursive: true });
            ['provision.js', 'firebase-api.js'].forEach((f) => fs.copyFileSync(path.join(TOOL, f), path.join(toolDir, f)));
            fs.copyFileSync(path.join(ROOT, 'firebase-database.rules.json'), path.join(dir, 'firebase-database.rules.json'));
            const file = path.join(toolDir, mut.file);
            const src = fs.readFileSync(file, 'utf8');
            if (src.indexOf(mut.from) === -1) return { applied: false, red: 0 };
            fs.writeFileSync(file, src.replace(mut.from, mut.to));
            let red = 0;
            try {
                await SCENARIOS[mut.scenario]((label, cond) => { if (!cond) red += 1; }, Object.assign({}, ctx, { quick: true }), toolDir);
            } catch (e) {
                red += 1;
            }
            return { applied: true, red: red };
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
    MUTATIONS.forEach((mut, i) => {
        const r = results[i];
        if (!r.applied) ok('M ' + mut.name + ' ៖ mutation ចុះលើកូដពិត', false, 'រកមិនឃើញអត្ថបទគោលដៅ');
        else ok('M ' + mut.name + ' ➜ ក្រហម (' + r.red + ')', r.red > 0);
    });
}

function skip(reason) {
    if (STRICT) {
        ok('FBPROVISION_STRICT=1 ៖ ' + reason, false);
        return;
    }
    console.log('SKIP — ' + reason + ' (រត់ ៖ npm ci --prefix tools/firebase-provision)');
}

(async () => {
    const contract = staticContract();
    if (!contract) {
        console.log('\n' + pass + ' ok, ' + fail + ' FAIL');
        process.exit(1);
    }
    const pin = JSON.parse(read('tools/firebase-provision/package.json') || '{}').dependencies || {};
    const deps = DEPS_DIRS.find((d) => {
        try { return JSON.parse(fs.readFileSync(path.join(d, 'firebase-tools', 'package.json'), 'utf8')).version === pin['firebase-tools']; } catch (e) { return false; }
    });
    const tlsDir = tempDir('zoe-provision-tls-');
    try {
        if (!deps) {
            skip('firebase-tools ' + pin['firebase-tools'] + ' មិនទាន់ដំឡើង');
        } else {
            const tls = makeTls(tlsDir);
            if (!tls) {
                skip('openssl មិនមាន (ត្រូវការសម្រាប់ Google ក្លែងលើ HTTPS)');
            } else {
                const zoewSrc = read('ZoeW/app.js') || read('ZoeW/src/features/config.ts');
                const decodeFn = sliceFn(zoewSrc, 'decodeSetupPayload');
                const dctx = vm.createContext({ atob: (s) => Buffer.from(s, 'base64').toString('binary'), escape });
                if (decodeFn) vm.runInContext(decodeFn + '\nthis.decode = decodeSetupPayload;', dctx);
                const ctx = { tls: tls, deps: deps, rulesText: read('firebase-database.rules.json'), decode: decodeFn ? dctx.decode : null };
                console.log('\n── ខ. ឥរិយាបថ ៖ CLI ពិត + firebase-tools ' + pin['firebase-tools'] + ' ពិត ទល់ Google ក្លែង (HTTPS) ──');
                const fns = [scenarioCore, scenarioDrift, scenarioUsers, scenarioUnmeasured, scenarioNotLoggedIn, scenarioResume,
                    scenarioIds, scenarioAdopt, scenarioLockdownIgnored, scenarioSlow, scenarioAuthInit];
                const recorded = await pool(fns, JOBS, async (fn) => {
                    const rec = [];
                    try {
                        await fn((label, cond, detail) => rec.push([label, !!cond, detail]), ctx, TOOL);
                    } catch (e) {
                        rec.push([fn.name + ' ៖ រត់ចប់ដោយគ្មាន exception', false, e && e.stack ? e.stack : String(e)]);
                    }
                    return rec;
                });
                recorded.forEach((rec) => rec.forEach(([label, cond, detail]) => ok(label, cond, detail)));
                if (process.env.FBPROVISION_MUTATIONS !== '0') await mutationRound(ctx);
            }
        }
    } finally {
        fs.rmSync(tlsDir, { recursive: true, force: true });
    }
    console.log('\n' + pass + ' ok, ' + fail + ' FAIL');
    process.exit(fail ? 1 : 0);
})().catch((e) => {
    console.error(e && e.stack ? e.stack : e);
    process.exit(1);
});
