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

    const seamProblems = [];
    async function seamCheck(label, body) {
        try { await body(); } catch (error) {
            seamProblems.push(label + ' — ' + String((error && error.message) || error).split('\n')[0]);
        }
    }
    if (typeof api.defaultOpenStore !== 'function') {
        seamProblems.push('defaultOpenStore មិនត្រូវបាន export — ស្នាមភ្ជាប់ទៅ @netlify/blobs គ្មានតេស្ត');
        api.defaultOpenStore = async () => { throw new Error('defaultOpenStore is missing'); };
    }
    if (typeof api.connectLambdaBlobs !== 'function') {
        seamProblems.push('connectLambdaBlobs មិនត្រូវបាន export — Lambda blobs context មិនត្រូវបានភ្ជាប់');
        api.connectLambdaBlobs = () => false;
    }

    const blobsCalls = [];
    const fakeBlobs = {
        connectLambda: (event) => {
            blobsCalls.push('connectLambda:' + String(event.headers['x-nf-site-id']));
        },
        getStore: (options) => {
            blobsCalls.push('getStore:' + options.name + ':' + options.consistency);
            return new FakeStore();
        }
    };
    const lambdaEvent = {
        blobs: Buffer.from(JSON.stringify({ url: 'https://blobs.invalid', token: 'edge-token' })).toString('base64'),
        headers: { 'x-nf-site-id': 'site-1', 'x-nf-deploy-id': 'deploy-1' }
    };
    const importFake = async () => fakeBlobs;
    const OPEN_STORE_CALL = 'getStore:zoew-zto-private-session-v1:strong';

    await seamCheck('connectLambda ត្រូវរត់មុន getStore', async () => {
        blobsCalls.length = 0;
        const seamStore = await api.defaultOpenStore({ importBlobs: importFake, lambdaEvent });
        assert.ok(seamStore, 'defaultOpenStore must return a store');
        assert.deepStrictEqual(blobsCalls, ['connectLambda:site-1', OPEN_STORE_CALL],
            'Lambda-signature functions carry the Blobs context on the event — connectLambda must run before getStore');
    });

    await seamCheck('គ្មាន blobs payload ➜ រំលង connectLambda', async () => {
        blobsCalls.length = 0;
        await api.defaultOpenStore({ importBlobs: importFake });
        assert.deepStrictEqual(blobsCalls, [OPEN_STORE_CALL],
            'without a blobs payload the environment context is the only source — connectLambda must be skipped');
        blobsCalls.length = 0;
        await api.defaultOpenStore({ importBlobs: importFake, lambdaEvent: { headers: {} } });
        assert.deepStrictEqual(blobsCalls, [OPEN_STORE_CALL]);
    });

    await seamCheck('payload ខូច ➜ មិនត្រូវគាំង', async () => {
        assert.strictEqual(api.connectLambdaBlobs(fakeBlobs, { blobs: 'x', headers: null }), false);
        assert.strictEqual(api.connectLambdaBlobs({}, lambdaEvent), false);
        assert.strictEqual(api.connectLambdaBlobs({
            connectLambda: () => { throw new Error('bad payload'); }
        }, lambdaEvent), false, 'a broken blobs payload must not crash the store open');
        assert.strictEqual(api.connectLambdaBlobs(fakeBlobs, lambdaEvent), true);
    });

    const missingEnvironment = new Error('The environment has not been configured to use Netlify Blobs');
    missingEnvironment.name = 'MissingBlobsEnvironmentError';

    await seamCheck('ការធ្លាក់ត្រូវប្រាប់ដំណាក់កាល និងមូលហេតុពិត', async () => {
        const seamLogs = [];
        const seamCases = [
            [async () => { throw Object.assign(new Error('gone'), { code: 'ERR_MODULE_NOT_FOUND' }); }, 'import:ERR_MODULE_NOT_FOUND'],
            [async () => ({}), 'export:Error'],
            [async () => ({ getStore: () => { throw missingEnvironment; } }), 'getstore:MissingBlobsEnvironmentError']
        ];
        const seen = [];
        for (const [importBlobs, expected] of seamCases) {
            try {
                await api.defaultOpenStore({ importBlobs, logger: (line) => seamLogs.push(String(line)) });
                seen.push('no-throw');
            } catch (error) {
                assert.ok(error instanceof sessionModule.ZtoSessionError, 'store failures must stay typed');
                assert.strictEqual(error.code, 'ZTO_SESSION_STORE_UNAVAILABLE');
                seen.push(error.reason);
            }
            void expected;
        }
        assert.deepStrictEqual(seen, seamCases.map((entry) => entry[1]),
            'a 503 must name the stage and the real error, not collapse into one opaque code');
        assert.strictEqual(seamLogs.length, 3, 'every store failure must reach the function log');
        assert.ok(seamLogs.every((line) => line.startsWith('[zto-session] ')));
        assert.ok(!seamLogs.join(' ').includes(env.ZTO_PASSWORD), 'logs must not carry the password');

        const tokenLogs = [];
        const leaky = new Error('fetch failed https://blobs.invalid/s?token=SUPERSECRETVALUE1234567890');
        leaky.name = 'FetchError';
        try {
            await api.defaultOpenStore({
                importBlobs: async () => ({ getStore: () => { throw leaky; } }),
                logger: (line) => tokenLogs.push(String(line))
            });
        } catch (error) {
            assert.strictEqual(error.reason, 'getstore:FetchError');
        }
        assert.ok(!tokenLogs.join(' ').includes('SUPERSECRETVALUE1234567890'),
            'the function log must redact query strings and token-shaped runs');
    });

    await seamCheck('ការដាច់ store ➜ memory-only មិនត្រូវរាំង lookup', async () => {
        api.resetStateForTests();
        let degradedLogins = 0;
        const degradedLogs = [];
        const degradedDependencies = {
            now: () => now,
            logger: (line) => degradedLogs.push(String(line)),
            openStore: async () => { throw missingEnvironment; },
            login: async (loginConfig) => {
                degradedLogins += 1;
                return loginSession(loginConfig, 'BOS-MAN-SESSION=memory-' + degradedLogins, now);
            }
        };
        assert.strictEqual(await sessionModule.getAutoSessionCookie({ env, dependencies: degradedDependencies }),
            'BOS-MAN-SESSION=memory-1', 'a broken blob store must not take the whole lookup down');
        assert.strictEqual(await sessionModule.getAutoSessionCookie({ env, dependencies: degradedDependencies }),
            'BOS-MAN-SESSION=memory-1');
        assert.strictEqual(degradedLogins, 1, 'memory-only mode must not relogin on every lookup');
        assert.strictEqual(await sessionModule.getAutoSessionCookie({
            env,
            forceRefresh: true,
            rejectedCookie: 'BOS-MAN-SESSION=memory-1',
            dependencies: degradedDependencies
        }), 'BOS-MAN-SESSION=memory-2', 'memory-only mode must still refresh a rejected cookie');
        assert.strictEqual(degradedLogins, 2);
        assert.ok(degradedLogs.some((line) => line.includes('memory only')),
            'degrading to memory must stay visible in the function log');
    });

    await seamCheck('memory-only ត្រូវរក្សា backoff', async () => {
        api.resetStateForTests();
        let degradedChallengeLogins = 0;
        const degradedChallengeDependencies = {
            now: () => now,
            logger: () => {},
            openStore: async () => { throw missingEnvironment; },
            login: async () => {
                degradedChallengeLogins += 1;
                throw new sessionModule.ZtoSessionError('ZTO_LOGIN_CHALLENGE', 409);
            }
        };
        await assertRejectsCode(sessionModule.getAutoSessionCookie({ env, dependencies: degradedChallengeDependencies }),
            'ZTO_LOGIN_CHALLENGE');
        await assertRejectsCode(sessionModule.getAutoSessionCookie({ env, dependencies: degradedChallengeDependencies }),
            'ZTO_LOGIN_CHALLENGE');
        assert.strictEqual(degradedChallengeLogins, 1,
            'memory-only mode must keep the failure backoff — no Chromium login loop');
    });

    await seamCheck('ការសរសេរចូល blob ធ្លាក់ ➜ session ដែល login រួច មិនត្រូវបោះចោល', async () => {
        api.resetStateForTests();
        const writeOnlyStore = new FakeStore();
        writeOnlyStore.set = async function blockedSet(key, value, options) {
            if (key === 'argus-session') throw new Error('write rejected');
            return FakeStore.prototype.set.call(this, key, value, options);
        };
        let persistFailureLogins = 0;
        const persistFailureCookie = await sessionModule.getAutoSessionCookie({
            env,
            dependencies: {
                now: () => now,
                logger: () => {},
                openStore: async () => writeOnlyStore,
                login: async (loginConfig) => {
                    persistFailureLogins += 1;
                    return loginSession(loginConfig, 'BOS-MAN-SESSION=unpersisted', now);
                }
            }
        });
        assert.strictEqual(persistFailureCookie, 'BOS-MAN-SESSION=unpersisted');
        assert.strictEqual(persistFailureLogins, 1,
            'a session that logged in successfully must not be thrown away because the blob write failed');
    });

    await seamCheck('ការធ្លាក់នៃ login ត្រូវប្រាប់ថាជាប់ត្រង់ណា', async () => {
        function fakePage(url) {
            return {
                setUserAgent: async () => {},
                setDefaultTimeout: () => {},
                setDefaultNavigationTimeout: () => {},
                goto: async () => {},
                url: () => url,
                waitForSelector: async () => {},
                $$: async () => [],
                evaluate: async () => ({ challenge: false, rejected: false }),
                browserContext: () => ({ cookies: async () => [] }),
                keyboard: { press: async () => {} },
                close: async () => {}
            };
        }
        function fakeBrowser(url) {
            const page = fakePage(url);
            return { newPage: async () => page, pages: async () => [page], close: async () => {} };
        }
        const loginReasons = [];
        for (const url of ['https://sso.zto.com/oauth2/authorize?region=km', 'http://argus.ztoglobal.com/', 'not-a-url']) {
            try {
                await api.performArgusLogin(config, {
                    now: Date.now,
                    sleep: async () => {},
                    launchBrowser: async () => fakeBrowser(url)
                });
                loginReasons.push('no-throw');
            } catch (error) {
                assert.strictEqual(error.code, 'ZTO_LOGIN_UNAVAILABLE');
                loginReasons.push(error.reason);
            }
        }
        assert.deepStrictEqual(loginReasons, ['host:sso.zto.com', 'scheme:http', 'url:unparsable'],
            'a blocked IDaaS redirect must name the host so it can be reviewed and allow-listed');

        try {
            await api.performArgusLogin(config, {
                now: Date.now,
                sleep: async () => {},
                launchBrowser: async () => fakeBrowser('https://iam-web.zto.com/oauth2/authorize?region=km')
            });
            assert.fail('an empty login form must not pass');
        } catch (error) {
            assert.strictEqual(error.code, 'ZTO_LOGIN_UNAVAILABLE');
            assert.strictEqual(error.reason, 'form:username-0',
                'a changed ZTO login form must say which control went missing');
        }
    });

    api.resetStateForTests();
    assert.deepStrictEqual(seamProblems, [],
        'ស្នាមភ្ជាប់ @netlify/blobs ៖\n  - ' + seamProblems.join('\n  - '));

    console.log('zto-session-test: ok');
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
