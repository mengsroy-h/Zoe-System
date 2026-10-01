'use strict';

process.noDeprecation = true;

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { spawn } = require('child_process');
const api = require('./firebase-api');

const TOOL_DIR = __dirname;
const REPO_ROOT = path.resolve(TOOL_DIR, '..', '..');
const DEFAULT_RULES_FILE = path.join(REPO_ROOT, 'firebase-database.rules.json');
const STATE_DIR = process.env.ZOE_PROVISION_STATE_DIR
    ? path.resolve(process.env.ZOE_PROVISION_STATE_DIR)
    : path.join(TOOL_DIR, 'state');
const SETTINGS_FILE = 'settings.json';

const EMAIL_PREFIX_DEFAULT = 'zoew';
const EMAIL_PREFIX_RE = /^[a-z0-9-]{1,32}$/;
const BRANCH_RE = /^[0-9]{1,32}$/;
const PROJECT_ID_RE = /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/;
const USER_NAME_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const EMAIL_RE = /^[a-z0-9][a-z0-9._+-]{0,63}@[a-z0-9-]+(\.[a-z0-9-]+)+$/;
const DISPLAY_NAME_RE = /^[A-Za-z0-9 '!-]{4,30}$/;
const REGIONS = ['asia-southeast1', 'us-central1', 'europe-west1'];
const DEFAULT_REGION = 'asia-southeast1';
const FIREBASE_CONFIG_KEYS = ['apiKey', 'authDomain', 'databaseURL', 'projectId', 'storageBucket', 'messagingSenderId', 'appId', 'measurementId'];
const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const PASSWORD_LENGTH = 14;
const PROBE_PASSWORD_LENGTH = 24;
const ID_SUFFIX_TRIES = 3;
const STEPS = ['project', 'firebase', 'apis', 'app', 'database', 'rules', 'auth', 'users'];
const EXIT = { OK: 0, FAIL: 1, USAGE: 2, UNMEASURED: 3 };

function envMs(name, fallback, min, max) {
    const n = Number(process.env[name]);
    if (!Number.isFinite(n) || n <= 0) return fallback;
    return Math.min(max, Math.max(min, Math.floor(n)));
}
const STEP_TIMEOUT_MS = envMs('ZOE_PROVISION_STEP_TIMEOUT_MS', 5 * 60 * 1000, 1000, 30 * 60 * 1000);
const API_POLL_MS = envMs('ZOE_PROVISION_API_POLL_MS', 0, 100, 10000);

function ascii(text) {
    return String(text).replace(/[^\x09\x0a\x0d\x20-\x7e]/g, '?');
}
function say(line) {
    process.stdout.write(ascii(line === undefined ? '' : line) + '\n');
}
function warn(line) {
    process.stderr.write(ascii(line) + '\n');
}

class UsageError extends Error {}

function parseArgs(argv) {
    const out = { _: [] };
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg.startsWith('--')) {
            const eq = arg.indexOf('=');
            const key = (eq === -1 ? arg.slice(2) : arg.slice(2, eq)).toLowerCase();
            if (eq !== -1) {
                out[key] = arg.slice(eq + 1);
            } else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
                out[key] = argv[i + 1];
                i += 1;
            } else {
                out[key] = true;
            }
        } else {
            out._.push(arg);
        }
    }
    return out;
}

function flagText(opts, key) {
    const v = opts[key];
    return typeof v === 'string' ? v.trim() : '';
}

function ensureStateDir() {
    fs.mkdirSync(STATE_DIR, { recursive: true, mode: 0o700 });
}

function writeJsonPrivate(file, value) {
    ensureStateDir();
    const tmp = file + '.tmp-' + process.pid;
    fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
    fs.renameSync(tmp, file);
}

function readJson(file) {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
        return null;
    }
}

function stateFile(projectId) {
    return path.join(STATE_DIR, projectId + '.json');
}

function loadState(projectId) {
    const s = readJson(stateFile(projectId));
    return s && s.projectId === projectId ? s : null;
}

function allStates() {
    let names = [];
    try {
        names = fs.readdirSync(STATE_DIR);
    } catch (e) {
        return [];
    }
    return names
        .filter((n) => n.endsWith('.json') && n !== SETTINGS_FILE)
        .map((n) => readJson(path.join(STATE_DIR, n)))
        .filter((s) => s && typeof s.projectId === 'string' && PROJECT_ID_RE.test(s.projectId))
        .sort((a, b) => a.projectId.localeCompare(b.projectId));
}

function saveState(state, previousId) {
    state.updatedAt = new Date().toISOString();
    writeJsonPrivate(stateFile(state.projectId), state);
    if (previousId && previousId !== state.projectId) {
        try { fs.unlinkSync(stateFile(previousId)); } catch (e) { }
    }
}

function loadSettings() {
    return readJson(path.join(STATE_DIR, SETTINGS_FILE)) || {};
}

function saveSettings(settings) {
    writeJsonPrivate(path.join(STATE_DIR, SETTINGS_FILE), settings);
}

function randomFrom(alphabet, length) {
    let out = '';
    for (let i = 0; i < length; i += 1) out += alphabet[crypto.randomInt(alphabet.length)];
    return out;
}

function generatePassword() {
    return randomFrom(PASSWORD_ALPHABET, PASSWORD_LENGTH);
}

function defaultDisplayName(branch) {
    return ('ZoeW ' + branch).slice(0, 30);
}

function displayNameIsValid(name) {
    return DISPLAY_NAME_RE.test(String(name || ''));
}

function derivedProjectId(branch) {
    return 'zoew-' + branch;
}

function suffixedProjectId(base) {
    const suffix = '-' + randomFrom('abcdefghijklmnopqrstuvwxyz0123456789', 4);
    return base.slice(0, 30 - suffix.length).replace(/-+$/, '') + suffix;
}

function branchDomain(prefix, branch) {
    return prefix + branch + '.com';
}

function userEmail(entry, prefix, branch) {
    const raw = String(entry || '').trim().toLowerCase();
    if (raw.indexOf('@') !== -1) {
        if (!EMAIL_RE.test(raw)) throw new UsageError('Invalid e-mail: ' + raw);
        return raw;
    }
    if (!USER_NAME_RE.test(raw)) {
        throw new UsageError('Invalid user name "' + raw + '" (use a-z, 0-9, dot, dash, underscore)');
    }
    if (!branch) throw new UsageError('User "' + raw + '" needs --branch (or give a full e-mail)');
    return raw + '@' + branchDomain(prefix, branch);
}

function parseUsers(text, prefix, branch) {
    const list = String(text || '').split(/[,\s]+/).map((u) => u.trim()).filter(Boolean);
    const emails = list.map((u) => userEmail(u, prefix, branch));
    return emails.filter((e, i) => emails.indexOf(e) === i);
}

function normalizeAppUrl(text) {
    const url = String(text || '').trim().replace(/\/+$/, '');
    if (!url) return '';
    if (!/^https:\/\/[^\s/?#]+(\/[^\s?#]*)?$/.test(url)) {
        throw new UsageError('App URL must look like https://your-site.netlify.app');
    }
    return url;
}

function sentryDsnIsValid(dsn) {
    if (typeof dsn !== 'string' || !dsn) return false;
    let parsed;
    try { parsed = new URL(dsn); } catch (e) { return false; }
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    return host === 'sentry.io' || host.endsWith('.sentry.io');
}

function pickConfig(raw, databaseURL) {
    const out = {};
    FIREBASE_CONFIG_KEYS.forEach((key) => {
        const value = key === 'databaseURL' ? (databaseURL || (raw && raw[key])) : raw && raw[key];
        if (value !== undefined && value !== null && value !== '') out[key] = String(value);
    });
    return out;
}

function buildSetupLink(appUrl, config, dsn) {
    const payload = Object.assign({}, config);
    if (sentryDsnIsValid(dsn)) payload.dsn = dsn;
    const b64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
    return appUrl + '/?setup=' + encodeURIComponent(b64);
}

function canonicalJson(value) {
    if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
    if (value && typeof value === 'object') {
        return '{' + Object.keys(value).sort().map((k) => JSON.stringify(k) + ':' + canonicalJson(value[k])).join(',') + '}';
    }
    return JSON.stringify(value);
}

function readRulesFile(file) {
    let text;
    try {
        text = fs.readFileSync(file, 'utf8');
    } catch (e) {
        throw new UsageError('Cannot read rules file: ' + file);
    }
    let parsed;
    try {
        parsed = JSON.parse(text);
    } catch (e) {
        throw new UsageError('Rules file is not valid JSON: ' + file);
    }
    if (!parsed || typeof parsed.rules !== 'object' || parsed.rules === null) {
        throw new UsageError('Rules file has no "rules" object: ' + file);
    }
    return { file: file, text: text, parsed: parsed, canonical: canonicalJson(parsed) };
}

function rulesMatch(remoteText, rules) {
    try {
        return canonicalJson(JSON.parse(remoteText)) === rules.canonical;
    } catch (e) {
        return String(remoteText).trim() === rules.text.trim();
    }
}

function signedInReadNode(rules) {
    const top = rules.parsed.rules;
    return Object.keys(top).find((key) => !key.startsWith('.') && !key.startsWith('$')
        && top[key] && typeof top[key]['.read'] === 'string' && top[key]['.read'].indexOf('auth != null') !== -1) || '';
}

async function ask(question) {
    if (!process.stdin.isTTY) return '';
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
        return await new Promise((resolve) => rl.question(ascii(question), (a) => resolve(String(a || '').trim())));
    } finally {
        rl.close();
    }
}

async function confirm(question, opts) {
    if (opts.yes === true) return true;
    if (!process.stdin.isTTY) throw new UsageError('Refusing without confirmation: add --yes');
    return (await ask(question + ' Type YES to continue: ')) === 'YES';
}

async function step(name, fn) {
    say('  ... ' + name);
    return api.withDeadline(fn(), STEP_TIMEOUT_MS, 'step "' + name + '"');
}

function consoleUrl(projectId) {
    return 'https://console.firebase.google.com/project/' + projectId + '/overview';
}

async function stepProject(state, opts) {
    const base = state.projectId;
    for (let attempt = 0; attempt <= ID_SUFFIX_TRIES; attempt += 1) {
        const id = state.projectId;
        const info = await api.cloudProject(id);
        if (info.accessible) {
            if (info.state && info.state !== 'ACTIVE') {
                throw new Error('Project ' + id + ' is ' + info.state + ' (not ACTIVE)');
            }
            if (state.pendingProject !== id && opts.adopt !== true) {
                throw new UsageError('Project ' + id + ' already exists in your account. Re-run with --adopt to set it up for this customer, or pass another --project-id.');
            }
            return;
        }
        state.pendingProject = id;
        saveState(state);
        const res = await api.createProject(id, state.displayName);
        if (res.created) return;
        if ((await api.cloudProject(id)).accessible) return;
        if (state.idExplicit) throw new UsageError('Project ID ' + id + ' is already taken on Google Cloud. Pick another --project-id.');
        const previous = state.projectId;
        state.projectId = suffixedProjectId(base);
        delete state.pendingProject;
        saveState(state, previous);
        say('      project ID ' + previous + ' is taken, trying ' + state.projectId);
    }
    throw new Error('Could not find a free project ID after ' + ID_SUFFIX_TRIES + ' tries; pass --project-id');
}

async function stepUsers(state, emails, passwords, notes) {
    state.users = Array.isArray(state.users) ? state.users : [];
    state.pendingUsers = state.pendingUsers || {};
    for (const email of emails) {
        const wasPending = !!state.pendingUsers[email];
        if (state.users.indexOf(email) !== -1 && !wasPending) continue;
        state.pendingUsers[email] = true;
        saveState(state);
        const password = generatePassword();
        const res = await api.createUser(state.projectId, email, password);
        if (res.created) {
            passwords[email] = password;
        } else {
            notes.push(email + ' already exists; its password was NOT changed.'
                + (wasPending ? ' An earlier run may have created it without finishing.' : '')
                + ' To give it a new password run: node provision.js user --project ' + state.projectId + ' --user ' + email + ' --reset');
        }
        if (state.users.indexOf(email) === -1) state.users.push(email);
        delete state.pendingUsers[email];
        saveState(state);
    }
}

async function runSteps(state, opts, emails, rules) {
    const passwords = {};
    const notes = [];
    const done = state.steps;
    const runners = {
        project: () => stepProject(state, opts),
        firebase: async () => {
            if (!(await api.firebaseEnabled(state.projectId))) await api.addFirebase(state.projectId);
        },
        apis: () => api.ensureApis(state.projectId),
        app: async () => {
            const res = await api.ensureWebApp(state.projectId, state.appId);
            state.appId = res.appId;
        },
        database: async () => {
            const res = await api.ensureDatabase(state.projectId, state.region, state.instance);
            state.instance = res.instance.name;
            state.databaseURL = res.instance.databaseUrl;
            if (res.instance.location && res.instance.location !== '-') state.region = res.instance.location;
        },
        rules: async () => {
            await api.deployRules(state.databaseURL, rules.text, false);
            const remote = await api.readRules(state.databaseURL);
            if (!rulesMatch(remote, rules)) throw new Error('Rules read back from the database differ from ' + path.basename(rules.file));
            state.rulesSha256 = crypto.createHash('sha256').update(rules.canonical).digest('hex');
        },
        auth: () => api.lockDownAuth(state.projectId, state.appId),
        users: () => stepUsers(state, emails, passwords, notes)
    };
    for (const name of STEPS) {
        if (done[name] && name !== 'users') {
            say('  ok  ' + name + ' (done earlier)');
            continue;
        }
        await step(name, runners[name]);
        if (name === 'project') delete state.pendingProject;
        done[name] = true;
        saveState(state);
        say('  ok  ' + name);
    }
    return { passwords, notes };
}

function newState(projectId, branch, prefix, region, idExplicit) {
    return {
        projectId: projectId,
        idExplicit: !!idExplicit,
        displayName: defaultDisplayName(branch),
        branch: branch,
        emailPrefix: prefix,
        region: region,
        steps: {},
        users: [],
        createdAt: new Date().toISOString()
    };
}

function findStateByBranch(branch) {
    const hits = allStates().filter((s) => s.branch === branch);
    if (hits.length > 1) {
        throw new UsageError('Several projects exist for branch ' + branch + ': ' + hits.map((s) => s.projectId).join(', ') + '. Pass --project-id.');
    }
    return hits[0] || null;
}

async function verifyProject(state, rules, passwords) {
    const results = [];
    const add = (name, status, detail) => results.push({ name: name, status: status, detail: detail || '' });
    const id = state.projectId;
    let config = null;
    try {
        config = await api.webConfigOf(id, state.appId);
    } catch (e) {
        config = null;
    }
    let databaseURL = state.databaseURL || '';
    if (!databaseURL) {
        try {
            const inst = await api.findDatabase(id, state.instance);
            databaseURL = inst ? inst.databaseUrl : '';
        } catch (e) {
            databaseURL = '';
        }
    }

    try {
        const cfg = await api.readAuthConfig(id);
        if (!cfg) add('auth settings', 'fail', 'Authentication is not initialized');
        else {
            const gaps = api.lockdownGaps(cfg);
            add('auth settings', gaps.length ? 'fail' : 'ok', gaps.length ? 'not set: ' + gaps.join(', ') : 'sign-up and delete disabled');
            const extra = api.lockdownGaps(cfg, api.AUTH_OPTIONAL);
            add('e-mail enumeration protection', extra.length ? 'skip' : 'ok', extra.length ? 'off (optional; turn it on in the Console if you can)' : '');
        }
    } catch (e) {
        add('auth settings', 'unmeasured', api.messageOf(e));
    }

    if (!config || !config.apiKey) {
        add('public sign-up blocked', 'unmeasured', 'no web app / apiKey');
    } else {
        const domain = state.branch ? branchDomain(state.emailPrefix || EMAIL_PREFIX_DEFAULT, state.branch) : 'zoew.invalid';
        const probeEmail = 'probe-' + crypto.randomBytes(5).toString('hex') + '@' + domain;
        try {
            const res = await api.publicSignUp(config.apiKey, probeEmail, randomFrom(PASSWORD_ALPHABET, PROBE_PASSWORD_LENGTH));
            if (res.code === 'ADMIN_ONLY_OPERATION') add('public sign-up blocked', 'ok', 'ADMIN_ONLY_OPERATION');
            else if (res.status === 200 || res.localId) {
                let removed = false;
                try {
                    const localId = res.localId || await api.findUser(id, probeEmail);
                    removed = localId ? await api.deleteUser(id, localId) : false;
                } catch (e) {
                    removed = false;
                }
                add('public sign-up blocked', 'fail', 'ANYONE CAN CREATE AN ACCOUNT. Probe account ' + probeEmail + (removed ? ' was deleted.' : ' could NOT be deleted - delete it in the Console.'));
            } else if (res.code === 'OPERATION_NOT_ALLOWED') {
                add('public sign-up blocked', 'fail', 'e-mail/password sign-in is disabled, so staff cannot log in');
            } else {
                add('public sign-up blocked', 'unmeasured', 'HTTP ' + res.status + ' ' + res.code);
            }
        } catch (e) {
            add('public sign-up blocked', 'unmeasured', api.messageOf(e));
        }
    }

    if (!databaseURL) {
        add('database rules', 'unmeasured', 'no database found');
        add('anonymous read denied', 'unmeasured', 'no database found');
    } else {
        try {
            const remote = await api.readRules(databaseURL);
            add('database rules', rulesMatch(remote, rules) ? 'ok' : 'fail',
                rulesMatch(remote, rules) ? 'same as ' + path.basename(rules.file) : 'different from ' + path.basename(rules.file) + ' (run: rules --project ' + id + ')');
        } catch (e) {
            add('database rules', 'unmeasured', api.messageOf(e));
        }
        try {
            const res = await api.databaseRead(databaseURL, '', '');
            if (res.status === 401 || res.status === 403) add('anonymous read denied', 'ok', 'HTTP ' + res.status);
            else if (res.status === 200) add('anonymous read denied', 'fail', 'THE DATABASE IS READABLE WITHOUT LOGIN');
            else add('anonymous read denied', 'unmeasured', 'HTTP ' + res.status);
        } catch (e) {
            add('anonymous read denied', 'unmeasured', api.messageOf(e));
        }
    }

    const known = Object.keys(passwords || {});
    let idToken = '';
    if (!known.length) {
        add('staff login', 'skip', 'no password was set in this run');
    } else if (!config || !config.apiKey) {
        add('staff login', 'unmeasured', 'no web app / apiKey');
    } else {
        for (const email of known) {
            try {
                const res = await api.publicSignIn(config.apiKey, email, passwords[email]);
                if (res.idToken) {
                    idToken = idToken || res.idToken;
                    add('staff login ' + email, 'ok');
                } else if (res.status >= 400 && res.status < 500) {
                    add('staff login ' + email, 'fail', res.code || ('HTTP ' + res.status));
                } else {
                    add('staff login ' + email, 'unmeasured', 'HTTP ' + res.status);
                }
            } catch (e) {
                add('staff login ' + email, 'unmeasured', api.messageOf(e));
            }
        }
    }

    const node = signedInReadNode(rules);
    if (!idToken || !databaseURL || !node) {
        add('signed-in read allowed', 'skip', !node ? 'no auth-readable node in rules' : 'needs a staff login from this run');
    } else {
        try {
            const res = await api.databaseRead(databaseURL, node, idToken);
            if (res.status === 200) add('signed-in read allowed', 'ok', node);
            else if (res.status === 401 || res.status === 403) add('signed-in read allowed', 'fail', 'staff cannot read ' + node + ' (HTTP ' + res.status + ')');
            else add('signed-in read allowed', 'unmeasured', 'HTTP ' + res.status);
        } catch (e) {
            add('signed-in read allowed', 'unmeasured', api.messageOf(e));
        }
    }
    return { results: results, config: config ? pickConfig(config, databaseURL) : null };
}

function reportVerify(results) {
    say('');
    say('Security check:');
    results.forEach((r) => {
        const tag = r.status === 'ok' ? 'OK  ' : r.status === 'fail' ? 'FAIL' : r.status === 'skip' ? 'SKIP' : 'WARN';
        say('  [' + tag + '] ' + r.name + (r.detail ? ' - ' + r.detail : ''));
    });
    if (results.some((r) => r.status === 'fail')) return EXIT.FAIL;
    if (results.some((r) => r.status === 'unmeasured')) {
        say('  Some checks could not be measured (network?). Run: node provision.js verify --project <id>');
        return EXIT.UNMEASURED;
    }
    return EXIT.OK;
}

function printCard(state, config, settings, passwords, notes) {
    say('');
    say('==================== ' + state.projectId + ' ====================');
    say('Console : ' + consoleUrl(state.projectId));
    say('Branch  : ' + (state.branch || '-'));
    if (config) {
        say('Firebase config (paste into ZoeKeyGen > Setup Link if you need a QR):');
        say(JSON.stringify(config, null, 2));
        if (settings.appUrl) say('Setup Link: ' + buildSetupLink(settings.appUrl, config, settings.sentryDsn));
        else say('Setup Link: (not built - pass --app-url https://<your ZoeW site> once)');
    }
    const shown = Object.keys(passwords || {});
    if (shown.length) {
        say('');
        say('Staff accounts - passwords are shown ONLY NOW, copy them:');
        shown.forEach((email) => say('  ' + email + '   password: ' + passwords[email]));
    }
    (notes || []).forEach((n) => say('  note: ' + n));
    say('');
    say('Still manual:');
    say('  1. ZoeKeyGen: create an Activation Key for this customer.');
    say('  2. Only for "ZTO list": add ' + state.projectId + ' to Netlify env FIREBASE_PROJECT_IDS (site zoew), then Trigger deploy.');
}

async function cmdNew(opts) {
    const settings = loadSettings();
    const branch = flagText(opts, 'branch') || await ask('ZTO branch code (digits): ');
    if (!BRANCH_RE.test(branch)) throw new UsageError('--branch must be digits (the ZTO branch code)');
    const prefix = (flagText(opts, 'email-prefix') || settings.emailPrefix || EMAIL_PREFIX_DEFAULT).toLowerCase();
    if (!EMAIL_PREFIX_RE.test(prefix)) throw new UsageError('--email-prefix must be a-z, 0-9 or dash');
    let usersText = flagText(opts, 'user') || flagText(opts, 'users');
    if (!usersText && opts.adopt !== true) usersText = await ask('Staff user names (comma separated, e.g. sok,chan): ');
    const emails = parseUsers(usersText, prefix, branch);
    if (!emails.length && opts.adopt !== true) throw new UsageError('Give at least one --user');
    const region = flagText(opts, 'region') || DEFAULT_REGION;
    if (REGIONS.indexOf(region) === -1) throw new UsageError('--region must be one of: ' + REGIONS.join(', '));
    const displayName = flagText(opts, 'name') || defaultDisplayName(branch);
    if (!DISPLAY_NAME_RE.test(displayName)) throw new UsageError('--name must be 4-30 characters: letters, digits, space, dash');
    if (typeof opts['app-url'] !== 'string' && !settings.appUrl) {
        const typed = await ask('ZoeW site URL for the Setup Link (Enter to skip): ');
        if (typed) opts['app-url'] = typed;
    }
    rememberSettings(opts, settings);
    const rules = readRulesFile(flagText(opts, 'rules') || DEFAULT_RULES_FILE);

    const explicitId = flagText(opts, 'project-id').toLowerCase();
    if (explicitId && !PROJECT_ID_RE.test(explicitId)) throw new UsageError('--project-id must be 6-30 chars: a-z, 0-9, dash, start with a letter');
    let state = explicitId ? loadState(explicitId) : findStateByBranch(branch);
    if (!state) {
        const id = explicitId || derivedProjectId(branch);
        if (!PROJECT_ID_RE.test(id)) throw new UsageError('Cannot build a project ID from branch ' + branch + '; pass --project-id');
        state = newState(id, branch, prefix, region, !!explicitId);
        state.displayName = displayName;
    } else if (state.branch !== branch) {
        throw new UsageError('Project ' + state.projectId + ' belongs to branch ' + state.branch + ', not ' + branch);
    }
    state.emailPrefix = state.emailPrefix || prefix;

    const who = await api.login();
    say('Logged in as ' + who);
    say('Setting up ' + state.projectId + ' for branch ' + branch + ' ...');
    const { passwords, notes } = await runSteps(state, opts, emails, rules);
    state.complete = true;
    saveState(state);
    const check = await verifyProject(state, rules, passwords);
    printCard(state, check.config, loadSettings(), passwords, notes);
    return reportVerify(check.results);
}

function rememberSettings(opts, settings) {
    let changed = false;
    if (typeof opts['app-url'] === 'string') {
        settings.appUrl = normalizeAppUrl(opts['app-url']);
        changed = true;
    }
    if (typeof opts['sentry-dsn'] === 'string') {
        const dsn = opts['sentry-dsn'].trim();
        if (dsn && !sentryDsnIsValid(dsn)) throw new UsageError('--sentry-dsn must be https://...sentry.io/...');
        settings.sentryDsn = dsn;
        changed = true;
    }
    if (typeof opts['email-prefix'] === 'string') {
        settings.emailPrefix = opts['email-prefix'].trim().toLowerCase();
        changed = true;
    }
    if (changed) saveSettings(settings);
}

function targetStates(opts) {
    if (opts.all === true) {
        const list = allStates();
        if (!list.length) throw new UsageError('No projects in ' + STATE_DIR + ' yet');
        return list;
    }
    const ids = flagText(opts, 'project').split(/[,\s]+/).map((s) => s.toLowerCase()).filter(Boolean);
    if (!ids.length) throw new UsageError('Pass --project <id>[,<id>...] or --all');
    return ids.map((id) => {
        if (!PROJECT_ID_RE.test(id)) throw new UsageError('Invalid project ID: ' + id);
        return loadState(id) || { projectId: id, steps: {}, users: [] };
    });
}

async function databaseUrlOf(state) {
    if (state.databaseURL) return state.databaseURL;
    const found = await api.findDatabase(state.projectId, state.instance);
    if (!found) throw new Error('No Realtime Database in ' + state.projectId);
    state.instance = found.name;
    state.databaseURL = found.databaseUrl;
    return state.databaseURL;
}

async function cmdRules(opts) {
    const targets = targetStates(opts);
    const custom = flagText(opts, 'rules');
    const rules = readRulesFile(custom || DEFAULT_RULES_FILE);
    const dryRun = opts['dry-run'] === true;
    if (custom) warn('WARNING: using custom rules file ' + custom);
    say('Rules file: ' + rules.file);
    say('Projects  : ' + targets.map((s) => s.projectId).join(', '));
    if (!dryRun && !(await confirm('Deploy these rules to ' + targets.length + ' project(s)?', opts))) {
        say('Cancelled.');
        return EXIT.USAGE;
    }
    await api.login();
    let failed = 0;
    for (const state of targets) {
        try {
            const url = await api.withDeadline(databaseUrlOf(state), STEP_TIMEOUT_MS, 'find database');
            await api.withDeadline(api.deployRules(url, rules.text, dryRun), STEP_TIMEOUT_MS, 'deploy rules');
            if (dryRun) {
                say('  [OK  ] ' + state.projectId + ' - rules are valid (dry run, nothing changed)');
                continue;
            }
            const remote = await api.withDeadline(api.readRules(url), STEP_TIMEOUT_MS, 'read rules');
            if (!rulesMatch(remote, rules)) throw new Error('read-back differs');
            if (loadState(state.projectId)) {
                state.rulesSha256 = crypto.createHash('sha256').update(rules.canonical).digest('hex');
                saveState(state);
            }
            say('  [OK  ] ' + state.projectId + ' - deployed and read back');
        } catch (e) {
            failed += 1;
            say('  [FAIL] ' + state.projectId + ' - ' + api.messageOf(e));
        }
    }
    return failed ? EXIT.FAIL : EXIT.OK;
}

async function cmdUser(opts) {
    const id = flagText(opts, 'project').toLowerCase();
    if (!PROJECT_ID_RE.test(id)) throw new UsageError('Pass --project <id>');
    const state = loadState(id) || { projectId: id, steps: {}, users: [] };
    const settings = loadSettings();
    const branch = flagText(opts, 'branch') || state.branch || '';
    const prefix = state.emailPrefix || settings.emailPrefix || EMAIL_PREFIX_DEFAULT;
    const emails = parseUsers(flagText(opts, 'user'), prefix, branch);
    if (emails.length !== 1) throw new UsageError('Pass exactly one --user');
    const email = emails[0];
    await api.login();
    const password = generatePassword();
    const passwords = {};
    const created = await api.withDeadline(api.createUser(id, email, password), STEP_TIMEOUT_MS, 'create user');
    if (created.created) {
        passwords[email] = password;
        say('Created ' + email);
    } else if (opts.reset === true) {
        const localId = await api.findUser(id, email);
        if (!localId) throw new Error('User ' + email + ' not found');
        await api.withDeadline(api.setPassword(id, localId, password), STEP_TIMEOUT_MS, 'set password');
        passwords[email] = password;
        say('New password set for ' + email);
    } else {
        say(email + ' already exists. Add --reset to give it a new password.');
        return EXIT.USAGE;
    }
    if (loadState(id)) {
        state.users = Array.isArray(state.users) ? state.users : [];
        if (state.users.indexOf(email) === -1) state.users.push(email);
        saveState(state);
    }
    say('  ' + email + '   password: ' + passwords[email] + '   (shown only now)');
    const config = await api.withDeadline(api.webConfigOf(id, state.appId), STEP_TIMEOUT_MS, 'read web app');
    if (!config || !config.apiKey) {
        say('  [WARN] login not measured (no web app)');
        return EXIT.UNMEASURED;
    }
    const res = await api.publicSignIn(config.apiKey, email, password);
    if (res.idToken) {
        say('  [OK  ] login works');
        return EXIT.OK;
    }
    say('  [FAIL] login with the new password failed: ' + (res.code || 'HTTP ' + res.status));
    return EXIT.FAIL;
}

async function cmdVerify(opts) {
    const targets = targetStates(opts);
    const rules = readRulesFile(flagText(opts, 'rules') || DEFAULT_RULES_FILE);
    await api.login();
    let worst = EXIT.OK;
    for (const state of targets) {
        say('');
        say('== ' + state.projectId + ' ==');
        const check = await api.withDeadline(verifyProject(state, rules, {}), STEP_TIMEOUT_MS, 'verify');
        const code = reportVerify(check.results);
        if (code === EXIT.FAIL || (code === EXIT.UNMEASURED && worst === EXIT.OK)) worst = code;
    }
    return worst;
}

async function cmdShow(opts) {
    const id = flagText(opts, 'project').toLowerCase();
    if (!PROJECT_ID_RE.test(id)) throw new UsageError('Pass --project <id>');
    const state = loadState(id) || { projectId: id, steps: {}, users: [] };
    rememberSettings(opts, loadSettings());
    await api.login();
    const raw = await api.withDeadline(api.webConfigOf(id, state.appId), STEP_TIMEOUT_MS, 'read web app');
    if (!raw) throw new Error('No web app in ' + id);
    const url = await api.withDeadline(databaseUrlOf(state), STEP_TIMEOUT_MS, 'find database');
    printCard(state, pickConfig(raw, url), loadSettings(), {}, []);
    return EXIT.OK;
}

function cmdDoctor() {
    say('node           : ' + process.version);
    say('firebase-tools : ' + (api.toolsVersion() || 'NOT INSTALLED (run setup.cmd)'));
    api.load();
    say('library check  : ok');
    const account = api.load().auth.getGlobalDefaultAccount();
    say('logged in      : ' + (account && account.user ? account.user.email : 'NO (run setup.cmd)'));
    say('state folder   : ' + STATE_DIR);
    say('rules file     : ' + DEFAULT_RULES_FILE + (fs.existsSync(DEFAULT_RULES_FILE) ? '' : '  (MISSING)'));
    return account && account.user ? EXIT.OK : EXIT.FAIL;
}

function cmdLogin(opts) {
    let bin;
    try {
        bin = require.resolve('firebase-tools/lib/bin/firebase.js');
    } catch (e) {
        throw new UsageError('firebase-tools is not installed. Run setup.cmd first.');
    }
    const args = [bin, 'login'];
    if (opts.reauth === true) args.push('--reauth');
    if (opts['no-localhost'] === true) args.push('--no-localhost');
    return new Promise((resolve) => {
        const child = spawn(process.execPath, args, { stdio: 'inherit' });
        child.on('exit', (code) => resolve(code === 0 ? EXIT.OK : EXIT.FAIL));
        child.on('error', () => resolve(EXIT.FAIL));
    });
}

function help() {
    [
        'ZoeW customer setup (Firebase, one project per customer)',
        '',
        '  node provision.js login                       sign in to Google (once)',
        '  node provision.js doctor                      check the tool',
        '  node provision.js new --branch 881859 --user sok,chan [--app-url https://...]',
        '        [--project-id id] [--region asia-southeast1] [--adopt] [--sentry-dsn url]',
        '  node provision.js rules --all | --project id[,id] [--yes] [--dry-run]',
        '  node provision.js user --project id --user name [--reset]',
        '  node provision.js verify --all | --project id[,id]',
        '  node provision.js show --project id',
        '',
        'Exit codes: 0 ok, 1 failure, 2 usage/cancelled, 3 some checks could not be measured'
    ].forEach((l) => say(l));
    return EXIT.USAGE;
}

async function main(argv) {
    const opts = parseArgs(argv);
    const cmd = opts._[0] || '';
    if (API_POLL_MS) {
        try { api.load().ensureApiEnabled.POLL_SETTINGS.pollInterval = API_POLL_MS; } catch (e) { }
    }
    try {
        if (cmd === 'new') return await cmdNew(opts);
        if (cmd === 'rules') return await cmdRules(opts);
        if (cmd === 'user') return await cmdUser(opts);
        if (cmd === 'verify') return await cmdVerify(opts);
        if (cmd === 'show') return await cmdShow(opts);
        if (cmd === 'doctor') return cmdDoctor();
        if (cmd === 'login') return await cmdLogin(opts);
        return help();
    } catch (e) {
        if (e instanceof UsageError) {
            warn('ERROR: ' + e.message);
            return EXIT.USAGE;
        }
        warn('ERROR: ' + api.messageOf(e));
        if (e && e.code === 'TIMEOUT') warn('The change may still finish on Google\'s side. Re-run the same command to continue.');
        else if (cmd === 'new') warn('Fix the problem and re-run the same command; finished steps are skipped.');
        return EXIT.FAIL;
    }
}

if (require.main === module) {
    main(process.argv.slice(2)).then((code) => process.exit(code), (e) => {
        warn('ERROR: ' + (e && e.message ? e.message : e));
        process.exit(EXIT.FAIL);
    });
}

module.exports = {
    DEFAULT_RULES_FILE,
    PASSWORD_LENGTH,
    PASSWORD_ALPHABET,
    EMAIL_PREFIX_DEFAULT,
    PROJECT_ID_RE,
    BRANCH_RE,
    FIREBASE_CONFIG_KEYS,
    defaultDisplayName,
    displayNameIsValid,
    derivedProjectId,
    suffixedProjectId,
    userEmail,
    parseUsers,
    sentryDsnIsValid,
    normalizeAppUrl,
    pickConfig,
    buildSetupLink,
    canonicalJson,
    readRulesFile,
    signedInReadNode,
    generatePassword,
    main
};
