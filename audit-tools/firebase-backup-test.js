'use strict';

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const ROOT = process.env.FBACKUP_APP_DIR
    ? path.resolve(process.env.FBACKUP_APP_DIR)
    : path.resolve(__dirname, '..');
const backup = require(path.join(ROOT, 'firebase-backup', 'backup.js'));

let pass = 0;
let fail = 0;
function ok(label, condition, detail) {
    if (condition) {
        console.log('   ok    ' + label);
        pass += 1;
    } else {
        console.log('   FAIL  ' + label + (detail === undefined ? '' : '  ➜ ' + JSON.stringify(detail)));
        fail += 1;
    }
}

function expectThrow(label, action, pattern) {
    try {
        action();
        ok(label, false, 'did not throw');
    } catch (e) {
        ok(label, pattern.test(String(e && e.message)), e && e.message);
    }
}

async function expectReject(label, action, pattern) {
    try {
        await action();
        ok(label, false, 'did not reject');
    } catch (e) {
        ok(label, pattern.test(String(e && e.message)), e && e.message);
    }
}

function response(status, value, jsonError) {
    return {
        ok: status >= 200 && status < 300,
        status,
        async json() {
            if (jsonError) throw jsonError;
            return value;
        }
    };
}

(async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zoe-backup-test-'));
    try {
        const keyPair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
        const privateKey = keyPair.privateKey.export({ type: 'pkcs8', format: 'pem' });
        const publicKey = keyPair.publicKey.export({ type: 'spki', format: 'pem' });
        const rawServiceAccount = {
            client_email: 'backup-test@example.iam.gserviceaccount.com',
            private_key: privateKey,
            token_uri: 'https://oauth2.googleapis.com/token'
        };
        const serviceAccount = backup.validateServiceAccount(rawServiceAccount);

        ok('Firebase URL ត្រូវបាន normalize ទៅ origin',
            backup.normalizeDatabaseUrl('https://sample-default-rtdb.asia-southeast1.firebasedatabase.app/')
                === 'https://sample-default-rtdb.asia-southeast1.firebasedatabase.app');
        expectThrow('⛔ databaseURL មិនអនុញ្ញាត host ក្លែងក្លាយ',
            () => backup.normalizeDatabaseUrl('https://sample.firebaseio.com.attacker.example/'), /Firebase/);
        expectThrow('⛔ databaseURL មិនអនុញ្ញាត HTTP',
            () => backup.normalizeDatabaseUrl('http://sample.firebaseio.com/'), /HTTPS/);
        expectThrow('⛔ databaseURL មិនអនុញ្ញាត path ក្រៅ root',
            () => backup.normalizeDatabaseUrl('https://sample.firebaseio.com/private'), /root URL/);
        expectThrow('⛔ token_uri មិនអាចបញ្ជូន JWT ទៅ host ក្រៅ Google',
            () => backup.normalizeTokenUri('https://attacker.example/token'), /official HTTPS Google/);

        const nowMs = 1770000000000;
        const jwt = backup.createServiceAccountJwt(serviceAccount, nowMs);
        const parts = jwt.split('.');
        const claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
        ok('OAuth JWT មាន 3 ផ្នែក និង scope Firebase ត្រឹមត្រូវ',
            parts.length === 3 && claims.scope.includes('firebase.database'), claims);
        ok('OAuth JWT មានអាយុត្រឹម 1 ម៉ោង', claims.exp - claims.iat === 3600, claims);
        ok('OAuth JWT ចុះហត្ថលេខា RSA បានផ្ទៀងផ្ទាត់',
            crypto.verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), publicKey,
                Buffer.from(parts[2], 'base64url')));

        let attempts = 0;
        const delays = [];
        const retryResult = await backup.requestJsonWithRetry('test request', 'https://example.invalid', {}, {
            timeoutMs: 1000,
            retryCount: 2,
            retryDelayMs: 100
        }, {
            fetchImpl: async () => {
                attempts += 1;
                return attempts === 1 ? response(503, {}) : response(200, { ok: true });
            },
            sleepImpl: async (delay) => { delays.push(delay); }
        });
        ok('Transient HTTP 503 ត្រូវ retry ហើយទទួលជោគជ័យ',
            attempts === 2 && retryResult.ok === true && delays[0] === 100, { attempts, delays });

        let authAttempts = 0;
        await expectReject('HTTP 401 មិន retry ដើម្បីជៀសវាងបាញ់ request ឥតប្រយោជន៍', async () => {
            await backup.requestJsonWithRetry('auth request', 'https://example.invalid', {}, {
                timeoutMs: 1000,
                retryCount: 3,
                retryDelayMs: 100
            }, {
                fetchImpl: async () => { authAttempts += 1; return response(401, { secret: privateKey }); },
                sleepImpl: async () => {}
            });
        }, /HTTP 401/);
        ok('401 ពិតជាបាញ់តែមួយដង', authAttempts === 1, authAttempts);

        let invalidJsonAttempts = 0;
        const recoveredJson = await backup.requestJsonWithRetry('json request', 'https://example.invalid', {}, {
            timeoutMs: 1000,
            retryCount: 1,
            retryDelayMs: 100
        }, {
            fetchImpl: async () => {
                invalidJsonAttempts += 1;
                return invalidJsonAttempts === 1
                    ? response(200, null, new Error('truncated'))
                    : response(200, { recovered: true });
            },
            sleepImpl: async () => {}
        });
        ok('JSON ខូចពី network ក៏ retry បាន', invalidJsonAttempts === 2 && recoveredJson.recovered === true);

        let tokenRequest;
        const accessToken = await backup.getAccessToken(serviceAccount, {
            timeoutMs: 1000,
            retryCount: 0,
            retryDelayMs: 100
        }, {
            nowMs,
            fetchImpl: async (url, init) => {
                tokenRequest = { url, init };
                return response(200, { access_token: 'short-lived-access-token' });
            }
        });
        const tokenBody = new URLSearchParams(tokenRequest.init.body);
        ok('OAuth token ប្រើ grant_type ផ្លូវការ និង signed assertion',
            accessToken === 'short-lived-access-token'
            && tokenBody.get('grant_type') === 'urn:ietf:params:oauth:grant-type:jwt-bearer'
            && tokenBody.get('assertion').split('.').length === 3);
        ok('⛔ Private key មិនត្រូវបានដាក់ plaintext ក្នុង HTTP body',
            !tokenRequest.init.body.includes('PRIVATE KEY'));

        let databaseRequest;
        const databaseData = await backup.readDatabase('https://sample.firebaseio.com', accessToken, {
            timeoutMs: 1000,
            retryCount: 0,
            retryDelayMs: 100
        }, {
            fetchImpl: async (url, init) => {
                databaseRequest = { url, init };
                return response(200, { parcels: { A: 1 } });
            }
        });
        ok('Database read ប្រើ Authorization Bearer មិនដាក់ token ក្នុង URL',
            databaseRequest.url === 'https://sample.firebaseio.com/.json'
            && databaseRequest.init.headers.Authorization === 'Bearer short-lived-access-token'
            && !databaseRequest.url.includes(accessToken));
        ok('Database JSON ត្រូវបានអានគ្រប់', databaseData.parcels.A === 1);

        const secretsDir = path.join(tempRoot, 'secrets');
        const backupRoot = path.join(tempRoot, 'backups');
        fs.mkdirSync(secretsDir, { recursive: true });
        fs.writeFileSync(path.join(secretsDir, 'service-account.json'), JSON.stringify(rawServiceAccount));
        const businessDir = path.join(backupRoot, 'business-a');
        fs.mkdirSync(businessDir, { recursive: true });
        fs.writeFileSync(path.join(businessDir, '2000-01-01T00-00-00-000Z-old.json.gz'), zlib.gzipSync('{}'));
        fs.writeFileSync(path.join(businessDir, '2001-01-01T00-00-00-000Z-old.json.gz'), zlib.gzipSync('{}'));

        let backupFetchCount = 0;
        const outFile = await backup.backupOne({
            name: 'business-a',
            serviceAccountPath: './secrets/service-account.json',
            databaseURL: 'https://business-a-default-rtdb.firebaseio.com'
        }, {
            backupRoot,
            configDir: tempRoot,
            keepCount: 2,
            network: { timeoutMs: 1000, retryCount: 0, retryDelayMs: 100 }
        }, {
            nowMs,
            fetchImpl: async (url) => {
                backupFetchCount += 1;
                return url.includes('oauth2.googleapis.com')
                    ? response(200, { access_token: 'backup-token' })
                    : response(200, { barcode: { ABC123: { status: 'open' } } });
            }
        });
        const restored = JSON.parse(zlib.gunzipSync(fs.readFileSync(outFile)).toString('utf8'));
        const retained = fs.readdirSync(businessDir).filter((file) => file.endsWith('.json.gz')).sort();
        ok('Backup end-to-end ស្នើ token + database ត្រឹម 2 requests', backupFetchCount === 2, backupFetchCount);
        ok('Backup gzip អាចបើកវិញ និងរក្សាទិន្នន័យត្រឹមត្រូវ', restored.barcode.ABC123.status === 'open');
        ok('keepCount លុបតែ backup ចាស់បំផុត និងរក្សាចំនួនត្រឹមត្រូវ',
            retained.length === 2 && !retained.some((file) => file.includes('2000-01-01')), retained);
        ok('Atomic write មិនបន្សល់ .partial',
            !fs.readdirSync(businessDir).some((file) => file.endsWith('.partial')));
        if (process.platform !== 'win32') {
            ok('⛔ Backup ថ្មីមាន file permission 0600', (fs.statSync(outFile).mode & 0o777) === 0o600,
                (fs.statSync(outFile).mode & 0o777).toString(8));
        }

        const release = backup.acquireRunLock(backupRoot, 60000);
        expectThrow('⛔ Lock រារាំង backup ពីររត់ជាន់គ្នា',
            () => backup.acquireRunLock(backupRoot, 60000), /Another backup run/);
        release();
        const releaseAgain = backup.acquireRunLock(backupRoot, 60000);
        releaseAgain();
        ok('Lock ត្រូវបានដោះចេញក្រោយ run ចប់', !fs.existsSync(path.join(backupRoot, '.zoe-backup.lock')));

        const lockPath = path.join(backupRoot, '.zoe-backup.lock');
        fs.writeFileSync(lockPath, 'stale-lock', { flag: 'wx' });
        const old = new Date(Date.now() - 120000);
        fs.utimesSync(lockPath, old, old);
        const releaseStale = backup.acquireRunLock(backupRoot, 60000);
        releaseStale();
        ok('Lock ដែល stale ត្រូវបានសង្គ្រោះដោយសុវត្ថិភាព', !fs.existsSync(lockPath));

        expectThrow('Business name ស្ទួនមិនអនុញ្ញាត (case-insensitive)', () => backup.validateBusinesses({
            businesses: [
                { name: 'Branch-A', serviceAccountPath: 'a.json', databaseURL: 'https://a.firebaseio.com' },
                { name: 'branch-a', serviceAccountPath: 'b.json', databaseURL: 'https://b.firebaseio.com' }
            ]
        }, backupRoot), /Duplicate business name/);

        const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'firebase-backup', 'package.json')));
        const packageLock = JSON.parse(fs.readFileSync(path.join(ROOT, 'firebase-backup', 'package-lock.json')));
        const source = fs.readFileSync(path.join(ROOT, 'firebase-backup', 'backup.js'), 'utf8');
        ok('⛔ Firebase backup គ្មាន third-party runtime dependency',
            !packageJson.dependencies && Object.keys(packageLock.packages || {}).length === 1,
            Object.keys(packageLock.packages || {}));
        ok('⛔ firebase-admin ចាស់ត្រូវបានដកចេញទាំង source និង lockfile',
            !source.includes("require('firebase-admin')") && !JSON.stringify(packageLock).includes('firebase-admin'));
        ok('Backup tool ប្រកាស Node >=18 សម្រាប់ native fetch/AbortController', packageJson.engines.node === '>=18');
    } finally {
        fs.rmSync(tempRoot, { recursive: true, force: true });
    }

    console.log(`\n${pass} ok, ${fail} FAIL`);
    process.exit(fail ? 1 : 0);
})().catch((e) => {
    console.error(e && e.stack ? e.stack : e);
    process.exit(1);
});
