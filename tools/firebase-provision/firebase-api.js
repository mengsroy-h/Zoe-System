'use strict';

const REQUIRED_SURFACE = {
    auth: ['getGlobalDefaultAccount'],
    requireAuth: ['requireAuth'],
    apiv2: ['Client'],
    api: ['resourceManagerOrigin', 'firebaseApiOrigin', 'identityOrigin'],
    utils: ['streamToString'],
    'management/projects': ['createCloudProject', 'addFirebaseToCloudProject'],
    'management/apps': ['createWebApp', 'listFirebaseApps', 'getAppConfig', 'AppPlatform'],
    'management/database': ['getDatabaseInstanceDetails', 'checkInstanceNameAvailable', 'createInstance', 'DatabaseInstanceType'],
    'management/provisioning/provision': ['provisionFirebaseApp'],
    getDefaultDatabaseInstance: ['getDefaultDatabaseInstance'],
    ensureApiEnabled: ['ensure'],
    rtdb: ['updateRulesWithClient']
};

const REQUIRED_APIS = ['firebasedatabase.googleapis.com', 'identitytoolkit.googleapis.com'];
const WEB_APP_NAME = 'ZoeW';
const REQUEST_TIMEOUT_MS = 30 * 1000;
const PROBE_TIMEOUT_MS = 20 * 1000;

const AUTH_LOCKDOWN = {
    'signIn.email.enabled': true,
    'signIn.email.passwordRequired': true,
    'client.permissions.disabledUserSignup': true,
    'client.permissions.disabledUserDeletion': true
};
const AUTH_OPTIONAL = {
    'emailPrivacyConfig.enableImprovedEmailPrivacy': true
};

let modules = null;

function load() {
    if (modules) return modules;
    const out = {};
    const missing = [];
    Object.keys(REQUIRED_SURFACE).forEach((name) => {
        let mod = null;
        try {
            mod = require('firebase-tools/lib/' + name);
        } catch (e) {
            missing.push('firebase-tools/lib/' + name);
            return;
        }
        REQUIRED_SURFACE[name].forEach((fn) => {
            if (mod[fn] === undefined) missing.push('firebase-tools/lib/' + name + '#' + fn);
        });
        out[name] = mod;
    });
    if (missing.length) {
        const err = new Error('firebase-tools is missing or has an unexpected version. Run setup.cmd again. Missing: ' + missing.join(', '));
        err.code = 'SURFACE';
        throw err;
    }
    modules = out;
    return modules;
}

function toolsVersion() {
    try {
        return require('firebase-tools/package.json').version;
    } catch (e) {
        return '';
    }
}

function withDeadline(promise, ms, label) {
    let timer = null;
    const deadline = new Promise((resolve, reject) => {
        timer = setTimeout(() => {
            const err = new Error(label + ' timed out after ' + Math.round(ms / 1000) + ' s');
            err.code = 'TIMEOUT';
            reject(err);
        }, ms);
    });
    return Promise.race([Promise.resolve(promise), deadline]).finally(() => clearTimeout(timer));
}

function statusOf(err) {
    if (!err) return 0;
    if (typeof err.status === 'number') return err.status;
    if (err.context && err.context.response && typeof err.context.response.statusCode === 'number') {
        return err.context.response.statusCode;
    }
    if (err.original) return statusOf(err.original);
    return 0;
}

function messageOf(err) {
    const parts = [];
    let cur = err;
    let depth = 0;
    while (cur && depth < 4) {
        if (cur.message) parts.push(String(cur.message));
        const body = cur.context && cur.context.body;
        if (body && body.error && body.error.message) parts.push(String(body.error.message));
        cur = cur.original;
        depth += 1;
    }
    return parts.join(' | ');
}

async function login() {
    const m = load();
    const account = m.auth.getGlobalDefaultAccount();
    if (!account || !account.user || !account.tokens) {
        const err = new Error('Not logged in to Firebase. Run setup.cmd (or: node provision.js login) first.');
        err.code = 'LOGIN';
        throw err;
    }
    await m.requireAuth.requireAuth({ user: account.user, tokens: account.tokens });
    return account.user.email || '';
}

function client(origin, apiVersion) {
    const m = load();
    return new m.apiv2.Client({ urlPrefix: origin, apiVersion: apiVersion, auth: true });
}

async function cloudProject(projectId) {
    const m = load();
    const res = await client(m.api.resourceManagerOrigin(), 'v1').request({
        method: 'GET',
        path: '/projects/' + projectId,
        timeout: REQUEST_TIMEOUT_MS,
        resolveOnHTTPError: true
    });
    if (res.status === 200 && res.body && res.body.projectId === projectId) {
        return { accessible: true, state: String(res.body.lifecycleState || '') };
    }
    if (res.status === 403 || res.status === 404) return { accessible: false, state: '' };
    const err = new Error('Could not read project ' + projectId + ' (HTTP ' + res.status + ')');
    err.status = res.status;
    throw err;
}

async function createProject(projectId, displayName) {
    const m = load();
    try {
        await m['management/projects'].createCloudProject(projectId, { displayName: displayName });
        return { created: true };
    } catch (e) {
        if (statusOf(e.original) === 409 || statusOf(e) === 409) return { created: false, taken: true };
        throw e;
    }
}

async function firebaseEnabled(projectId) {
    const m = load();
    const res = await client(m.api.firebaseApiOrigin(), 'v1beta1').request({
        method: 'GET',
        path: '/projects/' + projectId,
        timeout: REQUEST_TIMEOUT_MS,
        resolveOnHTTPError: true
    });
    if (res.status === 200) return true;
    if (res.status === 404) return false;
    const err = new Error('Could not read Firebase status of ' + projectId + ' (HTTP ' + res.status + ')');
    err.status = res.status;
    throw err;
}

async function addFirebase(projectId) {
    const m = load();
    await m['management/projects'].addFirebaseToCloudProject(projectId);
}

async function ensureApis(projectId) {
    const m = load();
    for (const api of REQUIRED_APIS) {
        await m.ensureApiEnabled.ensure(projectId, api, 'provision', true);
    }
}

async function ensureWebApp(projectId, knownAppId) {
    const m = load();
    const appsMod = m['management/apps'];
    const list = await appsMod.listFirebaseApps(projectId, appsMod.AppPlatform.WEB);
    const hit = list.find((app) => knownAppId && app.appId === knownAppId)
        || list.find((app) => app.displayName === WEB_APP_NAME);
    if (hit) return { appId: hit.appId, created: false };
    const app = await appsMod.createWebApp(projectId, { displayName: WEB_APP_NAME });
    return { appId: app.appId, created: true };
}

async function webConfig(appId) {
    const m = load();
    const appsMod = m['management/apps'];
    return appsMod.getAppConfig(appId, appsMod.AppPlatform.WEB);
}

async function webConfigOf(projectId, knownAppId) {
    const m = load();
    const appsMod = m['management/apps'];
    const list = await appsMod.listFirebaseApps(projectId, appsMod.AppPlatform.WEB);
    const hit = list.find((app) => knownAppId && app.appId === knownAppId)
        || list.find((app) => app.displayName === WEB_APP_NAME)
        || list[0];
    return hit ? webConfig(hit.appId) : null;
}

async function instanceDetails(projectId, name) {
    const m = load();
    try {
        return await m['management/database'].getDatabaseInstanceDetails(projectId, name);
    } catch (e) {
        return null;
    }
}

async function findDatabase(projectId, knownName) {
    const m = load();
    let name = knownName || '';
    if (!name) {
        try {
            name = await m.getDefaultDatabaseInstance.getDefaultDatabaseInstance(projectId);
        } catch (e) {
            name = '';
        }
    }
    return instanceDetails(projectId, name || projectId + '-default-rtdb');
}

async function ensureDatabase(projectId, region, knownName) {
    const m = load();
    const db = m['management/database'];
    let name = knownName || '';
    if (!name) {
        try {
            name = await m.getDefaultDatabaseInstance.getDefaultDatabaseInstance(projectId);
        } catch (e) {
            name = '';
        }
    }
    if (name) {
        const found = await instanceDetails(projectId, name);
        if (found) return { instance: found, created: false };
    }
    name = projectId + '-default-rtdb';
    const existing = await instanceDetails(projectId, name);
    if (existing) return { instance: existing, created: false };
    const check = await db.checkInstanceNameAvailable(projectId, name, db.DatabaseInstanceType.DEFAULT_DATABASE, region);
    if (!check.available) {
        if (!check.suggestedIds || !check.suggestedIds.length) {
            throw new Error('Realtime Database name ' + name + ' is not available and no alternative was suggested');
        }
        name = check.suggestedIds[0];
    }
    try {
        const instance = await db.createInstance(projectId, name, region, db.DatabaseInstanceType.DEFAULT_DATABASE);
        return { instance: instance, created: true };
    } catch (e) {
        const late = await instanceDetails(projectId, name);
        if (late) return { instance: late, created: false };
        throw e;
    }
}

function databaseClient(databaseUrl) {
    const m = load();
    return new m.apiv2.Client({ urlPrefix: databaseUrl, auth: true });
}

async function deployRules(databaseUrl, rulesText, dryRun) {
    const m = load();
    await m.rtdb.updateRulesWithClient(databaseClient(databaseUrl), rulesText, { dryRun: !!dryRun });
}

async function readRules(databaseUrl) {
    const m = load();
    const res = await databaseClient(databaseUrl).request({
        method: 'GET',
        path: '/.settings/rules.json',
        responseType: 'stream',
        resolveOnHTTPError: true,
        timeout: REQUEST_TIMEOUT_MS
    });
    if (res.status !== 200) throw new Error('Could not read current rules (HTTP ' + res.status + ')');
    return m.utils.streamToString(res.body);
}

function identityAdmin() {
    const m = load();
    return client(m.api.identityOrigin());
}

async function readAuthConfig(projectId) {
    const res = await identityAdmin().request({
        method: 'GET',
        path: '/admin/v2/projects/' + projectId + '/config',
        headers: { 'x-goog-user-project': projectId },
        timeout: REQUEST_TIMEOUT_MS,
        resolveOnHTTPError: true
    });
    if (res.status === 200) return res.body || {};
    if (authNotInitialized(res)) return null;
    const err = new Error('Could not read Authentication settings (HTTP ' + res.status + ')');
    err.status = res.status;
    throw err;
}

function nestedPatch(fields) {
    const out = {};
    Object.keys(fields).forEach((key) => {
        const parts = key.split('.');
        let cur = out;
        parts.slice(0, -1).forEach((p) => {
            cur[p] = cur[p] || {};
            cur = cur[p];
        });
        cur[parts[parts.length - 1]] = fields[key];
    });
    return out;
}

function readPath(obj, key) {
    return key.split('.').reduce((cur, part) => (cur && typeof cur === 'object' ? cur[part] : undefined), obj);
}

function lockdownGaps(config, fields) {
    const want = fields || AUTH_LOCKDOWN;
    return Object.keys(want).filter((key) => readPath(config, key) !== want[key]);
}

function authNotInitialized(res) {
    return res.status === 404 || errorCodeOf(res) === 'CONFIGURATION_NOT_FOUND';
}

async function patchAuthConfig(projectId, fields) {
    return identityAdmin().request({
        method: 'PATCH',
        path: '/admin/v2/projects/' + projectId + '/config',
        queryParams: { updateMask: Object.keys(fields).join(',') },
        headers: { 'x-goog-user-project': projectId },
        body: nestedPatch(fields),
        timeout: REQUEST_TIMEOUT_MS,
        resolveOnHTTPError: true
    });
}

async function initAuth(projectId, appId) {
    const m = load();
    await m['management/provisioning/provision'].provisionFirebaseApp({
        project: { parent: { type: 'existing_project', projectId: projectId } },
        app: { platform: m['management/apps'].AppPlatform.WEB, appId: appId },
        features: { firebaseAuthInput: { emailAuthProviderMode: 'PROVIDER_ENABLED' } }
    });
}

async function lockDownAuth(projectId, appId) {
    const all = Object.assign({}, AUTH_LOCKDOWN, AUTH_OPTIONAL);
    let res = await patchAuthConfig(projectId, all);
    if (authNotInitialized(res)) {
        await initAuth(projectId, appId);
        res = await patchAuthConfig(projectId, all);
    }
    if (res.status === 400) res = await patchAuthConfig(projectId, AUTH_LOCKDOWN);
    if (res.status !== 200) {
        const detail = res.body && res.body.error && res.body.error.message ? ': ' + res.body.error.message : '';
        const err = new Error('Could not update Authentication settings (HTTP ' + res.status + detail + ')');
        err.status = res.status;
        throw err;
    }
    const config = await readAuthConfig(projectId);
    const gaps = lockdownGaps(config || {});
    if (gaps.length) {
        throw new Error('Authentication settings did not stick: ' + gaps.join(', '));
    }
}

function errorCodeOf(res) {
    const msg = res && res.body && res.body.error && res.body.error.message;
    return typeof msg === 'string' ? msg.split(' ')[0].split(':')[0] : '';
}

async function adminAccounts(projectId, action, body) {
    return identityAdmin().request({
        method: 'POST',
        path: '/v1/projects/' + projectId + '/accounts' + (action ? ':' + action : ''),
        body: body,
        timeout: REQUEST_TIMEOUT_MS,
        resolveOnHTTPError: true
    });
}

async function findUser(projectId, email) {
    const res = await adminAccounts(projectId, 'query', { expression: [{ email: email }], limit: '1' });
    if (res.status !== 200) throw new Error('Could not look up ' + email + ' (HTTP ' + res.status + ')');
    const info = res.body && Array.isArray(res.body.userInfo) ? res.body.userInfo : [];
    return info.length ? info[0].localId : '';
}

async function createUser(projectId, email, password) {
    const res = await adminAccounts(projectId, '', { email: email, password: password });
    if (res.status === 200) return { created: true, localId: res.body.localId };
    if (errorCodeOf(res) === 'EMAIL_EXISTS' || errorCodeOf(res) === 'DUPLICATE_EMAIL') {
        return { created: false, exists: true };
    }
    throw new Error('Could not create ' + email + ' (HTTP ' + res.status + ' ' + errorCodeOf(res) + ')');
}

async function setPassword(projectId, localId, password) {
    const res = await adminAccounts(projectId, 'update', { localId: localId, password: password });
    if (res.status !== 200) throw new Error('Could not set a new password (HTTP ' + res.status + ' ' + errorCodeOf(res) + ')');
}

async function deleteUser(projectId, localId) {
    const res = await adminAccounts(projectId, 'delete', { localId: localId });
    return res.status === 200;
}

async function probeFetch(url, options) {
    const controller = new AbortController();
    const res = await withDeadline(fetch(url, Object.assign({ signal: controller.signal }, options)), PROBE_TIMEOUT_MS, 'probe')
        .catch((e) => {
            controller.abort();
            throw e;
        });
    let body = null;
    const text = await withDeadline(res.text(), PROBE_TIMEOUT_MS, 'probe body').catch(() => '');
    try {
        body = text ? JSON.parse(text) : null;
    } catch (e) {
        body = null;
    }
    return { status: res.status, body: body };
}

function publicIdentityUrl(action, apiKey) {
    const m = load();
    return m.api.identityOrigin() + '/v1/accounts:' + action + '?key=' + encodeURIComponent(apiKey);
}

async function publicSignUp(apiKey, email, password) {
    const res = await probeFetch(publicIdentityUrl('signUp', apiKey), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email, password: password, returnSecureToken: true })
    });
    return { status: res.status, code: errorCodeOf(res), localId: res.body && res.body.localId ? res.body.localId : '' };
}

async function publicSignIn(apiKey, email, password) {
    const res = await probeFetch(publicIdentityUrl('signInWithPassword', apiKey), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email, password: password, returnSecureToken: true })
    });
    return { status: res.status, code: errorCodeOf(res), idToken: res.body && res.body.idToken ? res.body.idToken : '' };
}

async function databaseRead(databaseUrl, nodePath, idToken) {
    const base = String(databaseUrl).replace(/\/+$/, '');
    let url = base + '/' + (nodePath ? encodeURIComponent(nodePath) : '') + '.json?shallow=true';
    if (idToken) url += '&auth=' + encodeURIComponent(idToken);
    const res = await probeFetch(url, { method: 'GET' });
    return { status: res.status };
}

module.exports = {
    REQUIRED_SURFACE,
    REQUIRED_APIS,
    AUTH_LOCKDOWN,
    AUTH_OPTIONAL,
    WEB_APP_NAME,
    load,
    toolsVersion,
    withDeadline,
    messageOf,
    login,
    cloudProject,
    createProject,
    firebaseEnabled,
    addFirebase,
    ensureApis,
    ensureWebApp,
    webConfig,
    webConfigOf,
    ensureDatabase,
    findDatabase,
    instanceDetails,
    deployRules,
    readRules,
    readAuthConfig,
    lockdownGaps,
    lockDownAuth,
    findUser,
    createUser,
    setPassword,
    deleteUser,
    publicSignUp,
    publicSignIn,
    databaseRead
};
