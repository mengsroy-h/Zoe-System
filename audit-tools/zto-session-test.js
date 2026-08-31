'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const appDir = process.env.ZTOSESSION_APP_DIR || path.join(__dirname, '..');
const sessionModulePath = path.join(appDir, 'ZoeW/netlify/lib/zto-session.js');
const sessionModule = require(sessionModulePath);

class FakeStore {
    constructor() {
        this.entries = new Map();
        this.etagCounter = 0;
    }

    async get(key) {
        const entry = this.entries.get(key);
        return entry ? entry.value : null;
    }

    async getWithMetadata(key) {
        const entry = this.entries.get(key);
        return entry ? { data: entry.value, metadata: entry.metadata || {}, etag: entry.etag } : null;
    }

    async set(key, value, options) {
        const opts = options || {};
        if (opts.onlyIfNew && this.entries.has(key)) return { modified: false };
        const existing = this.entries.get(key);
        if (opts.onlyIfMatch && (!existing || existing.etag !== opts.onlyIfMatch)) return { modified: false };
        const etag = 'etag-' + (++this.etagCounter);
        this.entries.set(key, { value: String(value), metadata: opts.metadata || {}, etag });
        return { modified: true, etag };
    }

    async delete(key) {
        this.entries.delete(key);
    }
}

function testEnv(overrides) {
    return Object.assign({
        ZTO_AUTO_LOGIN: 'true',
        ZTO_USERNAME: 'test-user@example.invalid',
        ZTO_PASSWORD: 'test-password-never-deploy',
        ZTO_SESSION_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64')
    }, overrides || {});
}

function loginSession(config, cookie, now) {
    return {
        cookie,
        createdAt: now,
        expiresAt: now + 60 * 60 * 1000,
        identityId: config.identityId
    };
}

async function assertRejectsCode(promise, code) {
    await assert.rejects(promise, (error) => error instanceof sessionModule.ZtoSessionError && error.code === code);
}

async function run() {
    const api = sessionModule._test;
    const packageJson = JSON.parse(fs.readFileSync(path.join(appDir, 'ZoeW/package.json'), 'utf8'));
    const packageLock = JSON.parse(fs.readFileSync(path.join(appDir, 'ZoeW/package-lock.json'), 'utf8'));
    const netlifyToml = fs.readFileSync(path.join(appDir, 'ZoeW/netlify.toml'), 'utf8');
    assert.deepStrictEqual(packageJson.dependencies, {
        '@netlify/blobs': '11.0.2',
        '@sparticuz/chromium': '149.0.0',
        'puppeteer-core': '25.1.0'
    });
    assert.deepStrictEqual(packageLock.packages[''].dependencies, packageJson.dependencies);
    assert.ok(netlifyToml.includes('external_node_modules = ["@netlify/blobs", "@sparticuz/chromium", "puppeteer-core"]'));
    assert.ok(netlifyToml.includes('[functions.zto-order-detail]'));
    assert.ok(netlifyToml.includes('memory = "2gb"'));

    const env = testEnv();
    const config = api.readConfig(env);
    const now = 1700000000000;

    const clearSession = loginSession(config, 'BOS-MAN-SESSION=plain-cookie-secret', now);
    const encrypted = api.encryptSession(clearSession, config.encryptionKey);
    assert.ok(!encrypted.includes(clearSession.cookie));
    assert.ok(!encrypted.includes(env.ZTO_USERNAME));
    assert.ok(!encrypted.includes(env.ZTO_PASSWORD));
    assert.deepStrictEqual(api.decryptSession(encrypted, config.encryptionKey), clearSession);
    assert.throws(() => api.decryptSession(encrypted, Buffer.alloc(32, 8)));
    assert.throws(() => api.decodeEncryptionKey('too-short'));

    const browserCookie = api.cookieHeaderFromBrowser([
        { name: 'BOS-MAN-SESSION', value: 'session-1', domain: '.ztoglobal.com', path: '/', expires: now / 1000 + 3600 },
        { name: 'locale', value: 'km', domain: 'aargus-api.ztoglobal.com', path: '/', expires: -1 },
        { name: 'foreign', value: 'must-not-leak', domain: '.example.com', path: '/', expires: -1 },
        { name: 'expired', value: 'must-not-leak', domain: '.ztoglobal.com', path: '/', expires: now / 1000 - 1 },
        { name: 'bad', value: 'line;break', domain: '.ztoglobal.com', path: '/', expires: -1 }
    ], 'BOS-MAN-SESSION', now);
    assert.strictEqual(browserCookie.cookie, 'BOS-MAN-SESSION=session-1; locale=km');
    assert.strictEqual(browserCookie.expiresAt, now + 3600 * 1000);
    assert.throws(() => api.cookieHeaderFromBrowser([], 'BOS-MAN-SESSION', now),
        (error) => error.code === 'ZTO_LOGIN_NO_SESSION');

    const store = new FakeStore();
    let loginCalls = 0;
    const dependencies = {
        now: () => now,
        openStore: async () => store,
        login: async (loginConfig) => {
            loginCalls += 1;
            await new Promise((resolve) => setTimeout(resolve, 10));
            return loginSession(loginConfig, 'BOS-MAN-SESSION=auto-1', now);
        }
    };

    api.resetStateForTests();
    const simultaneous = await Promise.all([
        sessionModule.getAutoSessionCookie({ env, dependencies }),
        sessionModule.getAutoSessionCookie({ env, dependencies }),
        sessionModule.getAutoSessionCookie({ env, dependencies })
    ]);
    assert.deepStrictEqual(simultaneous, [
        'BOS-MAN-SESSION=auto-1',
        'BOS-MAN-SESSION=auto-1',
        'BOS-MAN-SESSION=auto-1'
    ]);
    assert.strictEqual(loginCalls, 1, 'concurrent lookups must share one login');

    const storedSession = await store.get('argus-session');
    assert.ok(storedSession && storedSession.includes('A256GCM'));
    assert.ok(!storedSession.includes('auto-1'));
    assert.ok(!storedSession.includes(env.ZTO_USERNAME));
    assert.ok(!storedSession.includes(env.ZTO_PASSWORD));
    assert.strictEqual((await store.getWithMetadata('argus-login-lock')).metadata.expiresAt, 0);

    const processStore = new FakeStore();
    delete require.cache[require.resolve(sessionModulePath)];
    const processA = require(sessionModulePath);
    delete require.cache[require.resolve(sessionModulePath)];
    const processB = require(sessionModulePath);
    let crossProcessLoginCalls = 0;
    const processDependencies = {
        now: Date.now,
        openStore: async () => processStore,
        login: async (loginConfig) => {
            crossProcessLoginCalls += 1;
            await new Promise((resolve) => setTimeout(resolve, 20));
            const loginNow = Date.now();
            return loginSession(loginConfig, 'BOS-MAN-SESSION=cross-process', loginNow);
        }
    };
    const crossProcessCookies = await Promise.all([
        processA.getAutoSessionCookie({ env, dependencies: processDependencies }),
        processB.getAutoSessionCookie({ env, dependencies: processDependencies })
    ]);
    assert.deepStrictEqual(crossProcessCookies, [
        'BOS-MAN-SESSION=cross-process',
        'BOS-MAN-SESSION=cross-process'
    ]);
    assert.strictEqual(crossProcessLoginCalls, 1, 'blob lock must deduplicate logins across runtimes');

    api.resetStateForTests();
    const loaded = await sessionModule.getAutoSessionCookie({
        env,
        dependencies: Object.assign({}, dependencies, {
            login: async () => { throw new Error('stored session should be reused'); }
        })
    });
    assert.strictEqual(loaded, 'BOS-MAN-SESSION=auto-1');

    api.resetStateForTests();
    const refreshed = await sessionModule.getAutoSessionCookie({
        env,
        forceRefresh: true,
        rejectedCookie: 'BOS-MAN-SESSION=auto-1',
        dependencies: Object.assign({}, dependencies, {
            login: async (loginConfig) => {
                loginCalls += 1;
                return loginSession(loginConfig, 'BOS-MAN-SESSION=auto-2', now + 1);
            }
        })
    });
    assert.strictEqual(refreshed, 'BOS-MAN-SESSION=auto-2');
    assert.strictEqual(loginCalls, 2);

    api.resetStateForTests();
    const changedEnv = testEnv({ ZTO_PASSWORD: 'rotated-password' });
    let changedLoginCalls = 0;
    const changedCookie = await sessionModule.getAutoSessionCookie({
        env: changedEnv,
        dependencies: {
            now: () => now + 2,
            openStore: async () => store,
            login: async (loginConfig) => {
                changedLoginCalls += 1;
                return loginSession(loginConfig, 'BOS-MAN-SESSION=rotated-user-session', now + 2);
            }
        }
    });
    assert.strictEqual(changedCookie, 'BOS-MAN-SESSION=rotated-user-session');
    assert.strictEqual(changedLoginCalls, 1, 'credential changes must not reuse the old session');

    const failureStore = new FakeStore();
    let challengeLoginCalls = 0;
    const challengeDependencies = {
        now: () => now,
        openStore: async () => failureStore,
        login: async () => {
            challengeLoginCalls += 1;
            throw new sessionModule.ZtoSessionError('ZTO_LOGIN_CHALLENGE', 409);
        }
    };
    api.resetStateForTests();
    await assertRejectsCode(sessionModule.getAutoSessionCookie({ env, dependencies: challengeDependencies }),
        'ZTO_LOGIN_CHALLENGE');
    api.resetStateForTests();
    await assertRejectsCode(sessionModule.getAutoSessionCookie({ env, dependencies: challengeDependencies }),
        'ZTO_LOGIN_CHALLENGE');
    assert.strictEqual(challengeLoginCalls, 1, 'challenge must use backoff instead of login loops');

    const rotatedAfterFailure = testEnv({ ZTO_PASSWORD: 'new-password-after-challenge' });
    api.resetStateForTests();
    const afterRotation = await sessionModule.getAutoSessionCookie({
        env: rotatedAfterFailure,
        dependencies: {
            now: () => now,
            openStore: async () => failureStore,
            login: async (loginConfig) => loginSession(loginConfig, 'BOS-MAN-SESSION=after-rotation', now)
        }
    });
    assert.strictEqual(afterRotation, 'BOS-MAN-SESSION=after-rotation');

    console.log('zto-session-test: ok');
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
