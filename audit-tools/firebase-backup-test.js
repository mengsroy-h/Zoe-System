'use strict';

process.exitCode = 1;

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const http = require('http');
const { spawnSync } = require('child_process');
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

// Windows មិនរក្សា POSIX permission bits ទេ។ វាស់ mode ដែលកូដស្នើពិត
// លើគ្រប់ OS ហើយវាស់ permission លើឯកសារពិតបន្ថែមលើ POSIX។
function captureWrites() {
    const original = fs.writeFileSync;
    const originalOpen = fs.openSync;
    const writes = [];
    let writing = 0;
    fs.writeFileSync = function(file, data, options) {
        if (typeof file !== 'number') writes.push({ file: path.resolve(String(file)), mode: options && options.mode });
        writing++;
        try { return original.apply(this, arguments); } finally { writing--; }
    };
    fs.openSync = function(file, flags, mode) {
        const fd = originalOpen.apply(this, arguments);
        if (!writing) writes.push({ file: path.resolve(String(file)), mode });
        return fd;
    };
    return { writes, restore() { fs.writeFileSync = original; fs.openSync = originalOpen; } };
}

function privateFile(label, file, writes, writtenPath) {
    const requested = writes.filter((write) => write.file === path.resolve(writtenPath || file));
    ok(label + ' ស្នើ mode 0600 ពេលសរសេរពិត',
        requested.length === 1 && requested[0].mode === 0o600, requested);
    if (process.platform !== 'win32') {
        const actual = fs.statSync(file).mode & 0o777;
        ok(label + ' មាន permission 0600 លើ POSIX', actual === 0o600, actual.toString(8));
    }
}

function atomicFileOwnershipScenarios(tempRoot, crypt, passphrase) {
    const savedPass = process.env.ZOE_BACKUP_PASSPHRASE;
    process.env.ZOE_BACKUP_PASSPHRASE = passphrase;
    try {
        for (const writer of ['backup', 'seal', 'open']) for (const stage of [
            'collision', 'write-failure', 'rename-failure', 'replaced-after-write', 'replaced-on-rename-failure'
        ]) {
            const dir = path.join(tempRoot, 'ownership-' + writer + '-' + stage);
            fs.mkdirSync(dir);
            const plain = zlib.gzipSync(JSON.stringify({ synthetic: true, amount: 7 }));
            const input = path.join(dir, writer === 'open' ? 'input.json.gz.enc' : 'input.json.gz');
            fs.writeFileSync(input, writer === 'open' ? crypt.encryptBuffer(plain, passphrase) : plain);
            const inputBefore = fs.readFileSync(input);
            const sibling = path.join(dir, 'unrelated.partial');
            const foreign = Buffer.from('SYNTHETIC_FOREIGN_PENDING_EVIDENCE');
            const finalBefore = Buffer.from('SYNTHETIC_EXISTING_FINAL');
            fs.writeFileSync(sibling, foreign);
            const original = { open: fs.openSync, write: fs.writeFileSync, rename: fs.renameSync };
            const descriptors = new Map();
            let partial, final, moved, writeReached = false, renameReached = false, replaced = false, error;
            const observe = file => {
                if (typeof file !== 'string' || !file.startsWith(dir) || !file.endsWith('.partial')) return false;
                if (!partial) {
                    partial = file;
                    final = file.slice(0, -('.' + process.pid + '.partial').length);
                    original.write(final, finalBefore);
                    if (stage === 'collision') original.write(partial, foreign, { flag: 'wx' });
                }
                return file === partial;
            };
            const replace = () => {
                moved = path.join(dir, 'owned-preserved.partial');
                original.rename(partial, moved);
                original.write(partial, foreign, { flag: 'wx' });
                replaced = true;
            };
            fs.openSync = function(file) {
                const target = observe(file);
                const fd = original.open.apply(this, arguments);
                if (target) descriptors.set(fd, file);
                return fd;
            };
            fs.writeFileSync = function(file, data, options) {
                const target = typeof file === 'number' ? descriptors.get(file) === partial : observe(file);
                if (target && stage === 'write-failure') {
                    original.write.call(this, file, Buffer.from('SYNTHETIC_OWNED_FRAGMENT'), options);
                    writeReached = true;
                    throw Object.assign(new Error('Synthetic partial write failure.'), { code: 'WRITE_PROBE' });
                }
                const result = original.write.apply(this, arguments);
                if (target) {
                    writeReached = true;
                    if (stage === 'replaced-after-write') replace();
                }
                return result;
            };
            fs.renameSync = function(from) {
                if (from === partial) {
                    renameReached = true;
                    if (stage === 'rename-failure' || stage === 'replaced-on-rename-failure') {
                        if (stage === 'replaced-on-rename-failure') replace();
                        throw Object.assign(new Error('Synthetic rename failure.'), { code: 'RENAME_PROBE' });
                    }
                }
                return original.rename.apply(this, arguments);
            };
            try {
                if (writer === 'backup') backup.writeBackup(path.join(dir, 'destination'), { synthetic: true }, 2);
                else if (writer === 'seal') crypt.runSeal(dir);
                else crypt.main(['node', 'crypt.js', 'open', input, path.join(dir, 'opened.json.gz')]);
            } catch (caught) { error = caught; }
            finally { fs.openSync = original.open; fs.writeFileSync = original.write; fs.renameSync = original.rename; }
            const label = writer + ' / ' + stage;
            const foreignPartial = stage === 'collision' || stage.startsWith('replaced-');
            const reached = !!partial && (stage === 'collision' ? error && error.code === 'EEXIST'
                : stage === 'write-failure' ? writeReached
                    : stage === 'replaced-after-write' ? replaced : renameReached);
            ok(label + ' ឈានដល់ failure នៅស្រទាប់ឯកសារពិត', reached);
            ok(label + ' បរាជ័យដោយរក្សាប្រភព លទ្ធផលចាស់ និង partial ដែលមិនមែនខ្លួន',
                !!error && fs.existsSync(input) && fs.readFileSync(input).equals(inputBefore)
                && !!final && fs.existsSync(final) && fs.readFileSync(final).equals(finalBefore)
                && fs.readFileSync(sibling).equals(foreign)
                && (foreignPartial ? fs.existsSync(partial) && fs.readFileSync(partial).equals(foreign) : !fs.existsSync(partial))
                && (!replaced || fs.existsSync(moved)), { code: error && error.code, partialExists: !!partial && fs.existsSync(partial) });
            ok(label + ' មិនបន្សល់ file descriptor បើកក្រោយ failure', [...descriptors.keys()].every(fd => {
                try { fs.fstatSync(fd); return false; } catch (closed) { return closed.code === 'EBADF'; }
            }));
        }
    } finally {
        if (savedPass === undefined) delete process.env.ZOE_BACKUP_PASSPHRASE;
        else process.env.ZOE_BACKUP_PASSPHRASE = savedPass;
    }
}

async function bodyDeadlineScenario(recover) {
    let requests = 0;
    let bodyStarted = 0;
    let escaped = false;
    // ⛔ fetch ដំបូងក្នុង process (undici ផ្ទុកខ្ជិល ~200 ms) + CPU រវល់លើ CI ➜ ពិដាន 100 ms ផុតមុនសំណើដល់ server
    //    (`requests: 0`) ➜ សេណារីយ៉ូមិនចូលស្ថានភាព «headers មក · body ព្យួរ» ដែលវាវាស់ ➜ កំដៅ fetch លើផ្លូវដាច់ដោយឡែក
    //    (មិនរាប់) និងពិដានដែលមានចន្លោះ
    const server = http.createServer((req, res) => {
        if (req.url === '/warm') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{}'); return; }
        requests++;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        if (recover && requests > 1) res.end('{"recovered":true}');
        else { bodyStarted++; res.write('{"held":'); }
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${server.address().port}/`;
    await fetch(base + 'warm').then((r) => r.json()).catch(() => null);
    const BODY_DEADLINE_MS = 1000;
    const watchdog = setTimeout(() => { escaped = true; server.closeAllConnections(); }, BODY_DEADLINE_MS * 3);
    let value;
    let error;
    try {
        value = await backup.requestJsonWithRetry('body deadline', base, {},
            { timeoutMs: BODY_DEADLINE_MS, retryCount: recover ? 1 : 0, retryDelayMs: 1 });
    } catch (e) { error = e; }
    finally {
        clearTimeout(watchdog);
        server.closeAllConnections();
        await new Promise((resolve) => server.close(resolve));
    }
    ok('ផ្លូវ body ព្យួរត្រូវបានឈានដល់ពិត', bodyStarted === 1, { bodyStarted, requests });
    ok(recover ? 'body ព្យួរត្រូវ retry ហើយទទួល JSON ពេញ' : 'headers មកដល់មិនបិទពិដាន body',
        !escaped && (recover ? requests === 2 && value && value.recovered === true
            : requests === 1 && error && /timed out/.test(error.message)),
        { escaped, requests, value, error: error && error.message });
}

async function uncooperativeDeadlineScenario(stage) {
    let reached = false;
    let signal;
    let lateTimer;
    let watchdog;
    const delayed = () => new Promise((resolve) => {
        if (stage === 'late') lateTimer = setTimeout(() => resolve({ late: true }), 150);
    });
    const attempt = backup.requestJsonWithRetry('dependency deadline', 'https://example.invalid', {},
        { timeoutMs: 40, retryCount: 0, retryDelayMs: 1 }, {
            fetchImpl: async (url, init) => {
                signal = init.signal;
                if (stage === 'headers') { reached = true; return delayed(); }
                return { status: 200, ok: true, json() { reached = true; return delayed(); } };
            }
        }).then((value) => ({ value }), (error) => ({ error: error.message }));
    const result = await Promise.race([attempt, new Promise((resolve) => {
        watchdog = setTimeout(() => resolve({ escaped: true }), 350);
    })]);
    clearTimeout(watchdog);
    if (lateTimer) clearTimeout(lateTimer);
    ok('dependency ' + stage + ' ត្រូវបានឈានដល់ពិត', reached);
    ok('dependency ' + stage + ' មិនអាចរក្សាសំណើលើសពិដាន',
        !!signal && signal.aborted && !result.escaped && /timed out/.test(result.error || ''), result);
}

async function rejectedBodyCleanupScenario(status) {
    let received = 0;
    let closed;
    let watchdog;
    const bodyClosed = new Promise((resolve) => { closed = resolve; });
    const server = http.createServer((req, res) => {
        received++;
        res.on('close', () => closed(true));
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.write('{"held":');
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    let error;
    try {
        await backup.requestJsonWithRetry('HTTP body', `http://127.0.0.1:${server.address().port}/`, {},
            { timeoutMs: 100, retryCount: 0, retryDelayMs: 1 });
    } catch (e) { error = e; }
    const released = await Promise.race([bodyClosed, new Promise((resolve) => {
        watchdog = setTimeout(() => resolve(false), 500);
    })]);
    clearTimeout(watchdog);
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    ok('HTTP ' + status + ' ពិតត្រូវបានបដិសេធ',
        received === 1 && error && error.message.includes('HTTP ' + status));
    ok('HTTP ' + status + ' មិនទុក body ដែលព្យួររក្សា process ឲ្យរស់', released);
}


async function credentialRedirectScenario(kind, status) {
    const supabase = require(path.join(ROOT, 'firebase-backup', 'supabase.js'));
    let redirected = 0;
    const destination = http.createServer((req, res) => {
        redirected++;
        req.resume(); res.setHeader('Content-Type', 'application/json'); res.end('{}');
    });
    await new Promise(resolve => destination.listen(0, '127.0.0.1', resolve));
    const source = http.createServer((req, res) => {
        req.resume();
        res.writeHead(status, { Location: 'http://127.0.0.1:' + destination.address().port + '/redirected' });
        res.end();
    });
    await new Promise(resolve => source.listen(0, '127.0.0.1', resolve));
    const url = 'http://127.0.0.1:' + source.address().port;
    let rejected = false;
    try {
        if (kind === 'supabase') {
            const client = supabase.createClient({ url, key: 'sb_secret_' + 'x'.repeat(32), timeoutMs: 3000, retryCount: 0, retryDelayMs: 0 });
            await client.rpc('qa_redirect', { synthetic: true });
        } else {
            await backup.requestJsonWithRetry('QA OAuth', url, { method: 'POST', body: 'synthetic-assertion', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
                { timeoutMs: 3000, retryCount: 0, retryDelayMs: 0 });
        }
    } catch { rejected = true; }
    finally {
        source.closeAllConnections(); destination.closeAllConnections();
        await Promise.all([new Promise(resolve => source.close(resolve)), new Promise(resolve => destination.close(resolve))]);
    }
    ok(kind + ' HTTP ' + status + ' ៖ មិនតាម redirect និងមិនផ្ញើ credential/body ទៅទីតាំងបន្ទាប់', rejected && redirected === 0, { rejected, redirected });
}

(async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'zoe-backup-test-'));
    try {
        for (const status of [301, 302, 303, 307, 308]) {
            await credentialRedirectScenario('supabase', status);
            await credentialRedirectScenario('firebase-oauth', status);
        }
        await bodyDeadlineScenario(false);
        await bodyDeadlineScenario(true);
        await uncooperativeDeadlineScenario('headers');
        await uncooperativeDeadlineScenario('body');
        await uncooperativeDeadlineScenario('late');
        await rejectedBodyCleanupScenario(403);
        await rejectedBodyCleanupScenario(503);
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
        const backupWrites = captureWrites();
        let outFile;
        try {
            outFile = await backup.backupOne({
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
        } finally { backupWrites.restore(); }
        const restored = JSON.parse(zlib.gunzipSync(fs.readFileSync(outFile)).toString('utf8'));
        const retained = fs.readdirSync(businessDir).filter((file) => file.endsWith('.json.gz')).sort();
        ok('Backup end-to-end ស្នើ token + database ត្រឹម 2 requests', backupFetchCount === 2, backupFetchCount);
        ok('Backup gzip អាចបើកវិញ និងរក្សាទិន្នន័យត្រឹមត្រូវ', restored.barcode.ABC123.status === 'open');
        ok('keepCount លុបតែ backup ចាស់បំផុត និងរក្សាចំនួនត្រឹមត្រូវ',
            retained.length === 2 && !retained.some((file) => file.includes('2000-01-01')), retained);
        ok('Atomic write មិនបន្សល់ .partial',
            !fs.readdirSync(businessDir).some((file) => file.endsWith('.partial')));
        privateFile('⛔ Backup ថ្មី', outFile, backupWrites.writes, `${outFile}.${process.pid}.partial`);

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

        const cryptPath = path.join(ROOT, 'firebase-backup', 'crypt.js');
        const ciConfigPath = path.join(ROOT, 'firebase-backup', 'ci-config.js');
        const workflowPath = path.join(ROOT, '.github', 'workflows', 'backup.yml');
        ok('ឧបករណ៍អ៊ិនគ្រីប firebase-backup/crypt.js មានពិត', fs.existsSync(cryptPath));
        ok('ឧបករណ៍ត្រៀម config firebase-backup/ci-config.js មានពិត', fs.existsSync(ciConfigPath));
        ok('Workflow .github/workflows/backup.yml មានពិត', fs.existsSync(workflowPath));

        if (fs.existsSync(cryptPath)) {
            const crypt = require(cryptPath);
            const PASS_A = 'zoe-backup-passphrase-A';
            const PASS_B = 'zoe-backup-passphrase-B';
            const plain = Buffer.from(JSON.stringify({
                zoew_scan_history_cod_dod: { i1: { phone: '012345678', cod: 12.5 } }
            }), 'utf8');

            const sealed = crypt.encryptBuffer(plain, PASS_A);
            ok('អ៊ិនគ្រីប ➜ ស្រាយ ត្រឡប់មកដដែលបេះបិទ',
                crypt.decryptBuffer(sealed, PASS_A).equals(plain));
            ok('⛔ អត្ថបទដើមមិនលេចក្នុងឯកសារអ៊ិនគ្រីប',
                sealed.indexOf(Buffer.from('012345678', 'utf8')) === -1
                && sealed.indexOf(Buffer.from('zoew_scan_history', 'utf8')) === -1);
            ok('⛔ salt ចៃដន្យ ➜ អត្ថបទដដែលអ៊ិនគ្រីប ២ ដងចេញផ្សេងគ្នា',
                !crypt.encryptBuffer(plain, PASS_A).equals(sealed));
            expectThrow('⛔ ពាក្យសម្ងាត់ខុស ស្រាយមិនបាន',
                () => crypt.decryptBuffer(sealed, PASS_B), /wrong passphrase|modified/);

            const tampered = Buffer.from(sealed);
            tampered[tampered.length - 1] ^= 0xff;
            expectThrow('⛔ ការកែ ១ byte ត្រូវចាប់បាន (GCM auth tag)',
                () => crypt.decryptBuffer(tampered, PASS_A), /wrong passphrase|modified/);
            const badMagic = Buffer.from(sealed);
            badMagic[0] ^= 0xff;
            expectThrow('⛔ ឯកសារដែលមិនមែនរបស់ Zoe ត្រូវបដិសេធតាម magic header',
                () => crypt.decryptBuffer(badMagic, PASS_A), /bad magic/);
            expectThrow('⛔ ឯកសារកាត់ខ្លីត្រូវបដិសេធ',
                () => crypt.decryptBuffer(sealed.subarray(0, crypt.HEADER_BYTES - 1), PASS_A), /truncated/);

            expectThrow('⛔ ពាក្យសម្ងាត់ខ្លីពេកត្រូវប្រាប់ចំនួនតួដែលវាយ និងចំនួនដែលត្រូវការ',
                () => crypt.requirePassphrase('short-key'), /got 9 characters, need at least 16/);
            ok('ពិដានប្រវែងពាក្យសម្ងាត់យ៉ាងតិច ១៦ តួ', crypt.MIN_PASSPHRASE_LENGTH >= 16);
            atomicFileOwnershipScenarios(tempRoot, crypt, PASS_A);

            const sealRoot = path.join(tempRoot, 'seal-run');
            const bizDir = path.join(sealRoot, 'biz-a');
            fs.mkdirSync(bizDir, { recursive: true });
            const gzPath = path.join(bizDir, '2026-09-04T00-00-00-000Z-aabbcc.json.gz');
            fs.writeFileSync(gzPath, zlib.gzipSync(plain));
            fs.writeFileSync(path.join(bizDir, 'notes.txt'), 'ignore me');
            ok('collectBackupFiles ដើរចូលថតកូន ហើយយកតែ .json.gz',
                crypt.collectBackupFiles(sealRoot).length === 1);

            const savedPass = process.env.ZOE_BACKUP_PASSPHRASE;
            process.env.ZOE_BACKUP_PASSPHRASE = PASS_A;
            try {
                const sealedCount = crypt.runSeal(sealRoot);
                ok('seal អ៊ិនគ្រីបគ្រប់ឯកសារ backup', sealedCount === 1 && fs.existsSync(gzPath + '.enc'));
                ok('⛔ seal លុប plaintext ចោល ➜ គ្មាន .json.gz សល់ឲ្យ upload',
                    !fs.existsSync(gzPath) && crypt.collectBackupFiles(sealRoot).length === 0);
                ok('⛔ គ្មានឯកសារ .partial សល់ (ការសរសេរជា atomic)',
                    fs.readdirSync(bizDir).every((f) => !f.endsWith('.partial')));
                const openedPath = path.join(sealRoot, 'opened.json.gz');
                crypt.decryptFile(gzPath + '.enc', openedPath, PASS_A);
                ok('ឯកសារដែល seal រួច ស្រាយត្រឡប់ជា gzip ដើមវិញបាន',
                    zlib.gunzipSync(fs.readFileSync(openedPath)).equals(plain));
                expectThrow('⛔ ថតដែលគ្មាន backup ត្រូវធ្លាក់ មិនមែនរាយថាជោគជ័យ',
                    () => crypt.runSeal(path.join(tempRoot, 'seal-empty')), /No .json.gz backups found/);
            } finally {
                if (savedPass === undefined) delete process.env.ZOE_BACKUP_PASSPHRASE;
                else process.env.ZOE_BACKUP_PASSPHRASE = savedPass;
            }
        }

        if (fs.existsSync(ciConfigPath)) {
            const ciConfig = require(ciConfigPath);
            const targets = [{
                name: 'biz-a',
                databaseURL: 'https://demo-a-default-rtdb.firebaseio.com',
                serviceAccount: rawServiceAccount
            }, {
                name: 'license',
                databaseURL: 'https://demo-lic-default-rtdb.asia-southeast1.firebasedatabase.app',
                serviceAccount: JSON.stringify(rawServiceAccount)
            }];
            const runRoot = path.join(tempRoot, 'ci-run');
            const configWrites = captureWrites();
            let built;
            try { built = ciConfig.buildRunDirectory(runRoot, targets); }
            finally { configWrites.restore(); }
            const builtConfig = JSON.parse(fs.readFileSync(built.configPath, 'utf8'));
            ok('ci-config សាង config សម្រាប់គ្រប់ target', builtConfig.businesses.length === 2);
            ok('config ដែលសាងចេញ ឆ្លងការផ្ទៀងផ្ទាត់របស់ backup.js ខ្លួនវា', (() => {
                try {
                    backup.validateBusinesses(builtConfig, path.join(runRoot, 'backups'));
                    return true;
                } catch (e) { return false; }
            })());
            builtConfig.businesses.forEach((business) => {
                const keyPath = path.join(runRoot, business.serviceAccountPath);
                privateFile('⛔ សោ service account ' + business.name,
                    keyPath, configWrites.writes, `${keyPath}.${process.pid}.partial`);
            });
            privateFile('⛔ Config ដែលសាងចេញ', built.configPath, configWrites.writes, `${built.configPath}.${process.pid}.partial`);
            ok('⛔ ការសង្ខេបមិនបញ្ចេញសម្ភារៈសោ',
                built.summary.join('\n').indexOf('PRIVATE KEY') === -1
                && built.summary.join('\n').indexOf(rawServiceAccount.client_email) === -1);

            expectThrow('⛔ បដិសេធការសរសេរសោចូល repo checkout',
                () => ciConfig.main(['node', 'ci-config.js', path.join(ROOT, 'firebase-backup', 'ci-tmp')]),
                /Refusing to write credentials/);
            expectThrow('⛔ ឈ្មោះ target ដែលឡើងថតមេត្រូវបដិសេធ',
                () => ciConfig.buildRunDirectory(path.join(tempRoot, 'ci-evil'),
                    [{ name: '../evil', databaseURL: 'https://a.firebaseio.com', serviceAccount: rawServiceAccount }]),
                /Unsafe business name/);
            expectThrow('⛔ databaseURL ក្លែងក្លាយត្រូវបដិសេធតាំងពីជំហានត្រៀម',
                () => ciConfig.buildRunDirectory(path.join(tempRoot, 'ci-host'),
                    [{ name: 'biz', databaseURL: 'https://a.firebaseio.com.attacker.example', serviceAccount: rawServiceAccount }]),
                /Firebase/);
            expectThrow('⛔ JSON ខូចត្រូវប្រាប់មូលហេតុច្បាស់',
                () => ciConfig.parseTargets('[{'), /not valid JSON/);
            expectThrow('⛔ បញ្ជីទទេត្រូវធ្លាក់ មិនមែន backup សូន្យដោយស្ងាត់',
                () => ciConfig.parseTargets('[]'), /at least one entry/);
            expectThrow('⛔ secret ដែលមិនទាន់កំណត់ត្រូវប្រាប់ឈ្មោះ env',
                () => ciConfig.parseTargets(''), /ZOE_BACKUP_TARGETS is empty/);

            // target ខូចមួយ (សោកាត់ខ្លី · publishable key · URL ក្លែង · ឈ្មោះស្ទួន) មិនត្រូវបញ្ឈប់ backup របស់អាជីវកម្មផ្សេង
            // តែជំហានត្រៀមនៅធ្លាក់ (exit ≠ 0) ដើម្បីឲ្យ job ក្រហមក្រោយ upload ➜ រត់ CLI ពិតជា child process
            const otherKeys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
            const otherServiceAccount = {
                client_email: 'backup-other@example.iam.gserviceaccount.com',
                private_key: otherKeys.privateKey.export({ type: 'pkcs8', format: 'pem' }),
                token_uri: 'https://oauth2.googleapis.com/token'
            };
            const goodSecret = 'sb_secret_' + 'q'.repeat(32);
            const publishable = 'sb_publishable_' + 'p'.repeat(32);
            const mixedTargets = [
                { name: 'biz-good', databaseURL: 'https://good-default-rtdb.firebaseio.com', serviceAccount: rawServiceAccount },
                { name: 'biz-cut', databaseURL: 'https://cut-default-rtdb.firebaseio.com', serviceAccount: JSON.stringify(rawServiceAccount).slice(0, 90) },
                { name: 'biz-nokey', databaseURL: 'https://nokey-default-rtdb.firebaseio.com',
                    serviceAccount: { client_email: 'nokey@example.iam.gserviceaccount.com', private_key: 'synthetic-not-a-key' } },
                { type: 'supabase', name: 'sb-pub', url: 'https://demo.supabase.co', secretKey: publishable },
                { name: 'biz-host', databaseURL: 'https://good-default-rtdb.firebaseio.com.attacker.example', serviceAccount: rawServiceAccount },
                'not-an-object',
                { name: 'BIZ-GOOD', databaseURL: 'https://dup-default-rtdb.firebaseio.com', serviceAccount: otherServiceAccount },
                { type: 'supabase', name: 'sb-good', url: 'https://demo.supabase.co', secretKey: goodSecret }
            ];
            const runCiConfig = (dir, list) => {
                const run = spawnSync(process.execPath, [ciConfigPath, dir], {
                    env: Object.assign({}, process.env, { ZOE_BACKUP_TARGETS: JSON.stringify(list) }), encoding: 'utf8', timeout: 30000
                });
                const all = String(run.stdout || '') + String(run.stderr || '');
                return { status: run.status, all, failLines: all.split('\n').filter((line) => line.startsWith('[FAIL] ')) };
            };
            const mixedRoot = path.join(tempRoot, 'ci-mixed');
            const mixed = runCiConfig(mixedRoot, mixedTargets);
            const mixedConfigPath = path.join(mixedRoot, 'config.json');
            const mixedConfig = fs.existsSync(mixedConfigPath) ? JSON.parse(fs.readFileSync(mixedConfigPath, 'utf8')) : null;
            const mixedNames = mixedConfig ? mixedConfig.businesses.map((business) => business.name) : [];
            ok('⛔ target ខូច ១ មិនបញ្ឈប់ target ផ្សេង ៖ config.json សម្រាប់ target ដែលល្អ (Firebase · Supabase)',
                JSON.stringify(mixedNames) === JSON.stringify(['biz-good', 'sb-good']), { names: mixedNames, out: mixed.all.slice(-700) });
            ok('⛔ target ខូច ➜ ជំហានត្រៀម exit ≠ 0 (job ក្រហមក្រោយ upload)', mixed.status !== 0 && mixed.status !== null, mixed.status);
            ok('target ខូចនីមួយៗ ➜ បន្ទាត់ [FAIL] មួយ ប្រាប់ឈ្មោះ (ឬលំដាប់) និងមូលហេតុ',
                mixed.failLines.length === 6 && ['biz-cut', 'biz-nokey', 'sb-pub', 'biz-host', '#6', 'BIZ-GOOD']
                    .every((label) => mixed.failLines.some((line) => line.startsWith('[FAIL] ' + label + ': '))), mixed.failLines);
            const mixedSecretsDir = path.join(mixedRoot, 'secrets');
            const mixedSecrets = fs.existsSync(mixedSecretsDir) ? fs.readdirSync(mixedSecretsDir).sort() : [];
            const goodKeyFile = path.join(mixedSecretsDir, 'biz-good.json');
            ok('⛔ គ្មានឯកសារសោរបស់ target ខូច · ឈ្មោះស្ទួនមិនសរសេរជាន់សោរបស់ target ដើម',
                JSON.stringify(mixedSecrets) === JSON.stringify(['biz-good.json', 'sb-good.key']) && fs.existsSync(goodKeyFile)
                && JSON.parse(fs.readFileSync(goodKeyFile, 'utf8')).client_email === rawServiceAccount.client_email, mixedSecrets);
            ok('config ដែលនៅសល់ឆ្លងការផ្ទៀងផ្ទាត់ពេញរបស់ backup.js', !!mixedConfig && (() => {
                try {
                    backup.validateBusinesses(mixedConfig, path.join(mixedRoot, 'backups'));
                    return true;
                } catch (e) { return false; }
            })());
            ok('⛔ សារ [FAIL] មិនបញ្ចេញសម្ភារៈសោ', ['PRIVATE KEY', publishable, goodSecret, 'synthetic-not-a-key',
                rawServiceAccount.client_email, otherServiceAccount.client_email].every((secret) => mixed.all.indexOf(secret) === -1));
            const deadRoot = path.join(tempRoot, 'ci-dead');
            const dead = runCiConfig(deadRoot, [mixedTargets[1], mixedTargets[3]]);
            ok('target ខូចទាំងអស់ ➜ exit ≠ 0 · គ្មាន config.json · [FAIL] គ្រប់ target',
                dead.status !== 0 && dead.status !== null && !fs.existsSync(path.join(deadRoot, 'config.json'))
                && ['biz-cut', 'sb-pub'].every((label) => dead.failLines.some((line) => line.startsWith('[FAIL] ' + label + ': '))), dead.all.slice(-500));
        }

        {
            // config.json ក្នុងស្រុក ៖ business ខូច (type មិនស្គាល់ · URL ក្លែង · ឈ្មោះស្ទួន · គ្មានឈ្មោះ) មិនបញ្ឈប់ business ដែលល្អ
            const localRoot = path.join(tempRoot, 'local-mixed');
            fs.mkdirSync(path.join(localRoot, 'secrets'), { recursive: true });
            fs.writeFileSync(path.join(localRoot, 'secrets', 'a.json'), JSON.stringify(rawServiceAccount));
            const localConfigPath = path.join(localRoot, 'config.json');
            fs.writeFileSync(localConfigPath, JSON.stringify({
                backupDir: './backups',
                retryCount: 0,
                requestTimeoutMs: 5000,
                businesses: [
                    { name: 'biz-mystery', type: 'mystery', serviceAccountPath: './secrets/a.json', databaseURL: 'https://mystery-default-rtdb.firebaseio.com' },
                    { name: 'biz-local', serviceAccountPath: './secrets/a.json', databaseURL: 'https://local-default-rtdb.firebaseio.com' },
                    { name: 'biz-badurl', serviceAccountPath: './secrets/a.json', databaseURL: 'https://local.example' },
                    { name: 'BIZ-LOCAL', serviceAccountPath: './secrets/a.json', databaseURL: 'https://dup-default-rtdb.firebaseio.com' },
                    { serviceAccountPath: './secrets/a.json', databaseURL: 'https://noname-default-rtdb.firebaseio.com' }
                ]
            }));
            const reads = [];
            const logged = [];
            const savedFetch = globalThis.fetch;
            const savedLog = console.log;
            const savedError = console.error;
            globalThis.fetch = async (url) => {
                if (String(url).indexOf('https://oauth2.googleapis.com/') === 0) return response(200, { access_token: 'local-token' });
                reads.push(String(url));
                return response(200, { zoew_settings: { exchange_rate: 4100 } });
            };
            console.log = (...parts) => { logged.push(parts.join(' ')); };
            console.error = (...parts) => { logged.push(parts.join(' ')); };
            let localError = null;
            try {
                await backup.main(['node', 'backup.js', localConfigPath]);
            } catch (e) {
                localError = e;
            } finally {
                globalThis.fetch = savedFetch;
                console.log = savedLog;
                console.error = savedError;
            }
            const localDir = path.join(localRoot, 'backups', 'biz-local');
            const localFiles = fs.existsSync(localDir) ? fs.readdirSync(localDir).filter((file) => file.endsWith('.json.gz')) : [];
            ok('⛔ business ខូចក្នុង config.json មិនបញ្ឈប់ business ផ្សេង (backup ក្នុងស្រុក)',
                localFiles.length === 1 && reads.length === 1 && reads[0] === 'https://local-default-rtdb.firebaseio.com/.json',
                { localFiles, reads, logged });
            ok('business ខូចនីមួយៗ ➜ [FAIL] · run ចប់ដោយកំហុស (exit ≠ 0 សម្រាប់ Task Scheduler)',
                !!localError && /4 of 5 backup\(s\) failed/.test(localError.message)
                && ['biz-mystery', 'biz-badurl', 'BIZ-LOCAL', '#5'].every((label) => logged.some((line) => line.startsWith('[FAIL] ' + label + ': '))),
                { error: localError && localError.message, logged });
        }

        if (fs.existsSync(workflowPath)) {
            const wf = fs.readFileSync(workflowPath, 'utf8');
            const stepCount = (wf.match(/^ {6}- (name|uses):/gm) || []).length;
            ok('Workflow មានជំហានគ្រប់គ្រាន់ (ជាន់អប្បបរមា)', stepCount >= 7, stepCount);
            ok('Backup រត់តាមកាលកំណត់ និងបញ្ជាដោយដៃបាន',
                /^\s+- cron:/m.test(wf) && wf.includes('workflow_dispatch'));
            ok('កាលកំណត់ត្រូវនឹងម៉ោងកម្ពុជា (UTC+7)', /cron: '0 19 \* \* \*'/.test(wf));
            ok('⛔ សិទ្ធិ token ត្រឹម contents: read', /permissions:\s*\n\s+contents: read\s*\n/.test(wf)
                && !/permissions:\s*\n\s+contents: write/.test(wf));

            const sealAt = wf.indexOf('crypt.js seal');
            const verifyAt = wf.search(/find "\$RUNNER_TEMP\/zoe-backup\/backups" -type f ! -name '\*\.enc'/);
            const uploadAt = wf.indexOf('actions/upload-artifact');
            ok('⛔ ការអ៊ិនគ្រីបឈរ *មុន* ការ upload', sealAt > 0 && uploadAt > 0 && sealAt < uploadAt);
            ok('⛔ ជំហានផ្ទៀងផ្ទាត់ «គ្មាន plaintext សល់» ឈរមុន upload',
                verifyAt > 0 && verifyAt < uploadAt);
            ok('⛔ artifact ទទួលតែឯកសារ .enc', /path: \$\{\{ runner\.temp \}\}\/zoe-backup\/backups\/\*\*\/\*\.enc/.test(wf));
            ok('⛔ artifact ទទេត្រូវធ្លាក់ មិនមែនជោគជ័យទទេ', /if-no-files-found: error/.test(wf));
            ok('⛔ គ្មានផ្លូវ upload ណាទទួល .json.gz',
                !/path:[^\n]*\.json\.gz/.test(wf) && !/path:[^\n]*backups\s*$/m.test(wf));

            const cleanupAt = wf.indexOf('rm -rf "$RUNNER_TEMP/zoe-backup/secrets"');
            ok('⛔ សោ service account ត្រូវលុប ហើយការលុបរត់ជានិច្ច (if: always())',
                cleanupAt > 0 && /if: always\(\)\s*\n\s+run: rm -rf "\$RUNNER_TEMP\/zoe-backup\/secrets"/.test(wf));
            ok('⛔ សោ និង backup សរសេរក្រៅ checkout ($RUNNER_TEMP)',
                wf.includes('"$RUNNER_TEMP/zoe-backup"') && !/node firebase-backup\/ci-config\.js \.?\//.test(wf));
            ok('⛔ គ្មានការបោះ secret ចេញទៅ log',
                !/echo[^\n]*\$\{?ZOE_BACKUP_(PASSPHRASE|TARGETS)/.test(wf.replace(/\$\{#ZOE_BACKUP_PASSPHRASE\}/g, ''))
                && !/cat[^\n]*ZOE_BACKUP_/.test(wf));
            ok('secret ដែលមិនទាន់កំណត់ ➜ ចេញដោយជោគជ័យ ព្រមទាំងសារណែនាំ',
                wf.includes('ready=no') && wf.includes('::notice::'));
            ok('⛔ ពាក្យសម្ងាត់ខ្លីពេកត្រូវធ្លាក់តាំងពី guard', /-lt 16/.test(wf));
            ok('រយៈពេលរក្សាទុក artifact កែបានតាម variable ដោយមានលំនាំដើម',
                /retention-days: \$\{\{ vars\.ZOE_BACKUP_RETENTION_DAYS \|\| 30 \}\}/.test(wf));
            ok('ជុំនីមួយៗរាយទំហំ ➜ អ្នកប្រើគណនាកូតា Actions បាន',
                wf.includes('GITHUB_STEP_SUMMARY') && /du -sk/.test(wf));

            const pullAt = wf.indexOf('node firebase-backup/backup.js');
            const redAt = wf.indexOf("steps.pull.outcome == 'failure'");
            ok('⛔ អាជីវកម្មមួយធ្លាក់ មិនត្រូវបំផ្លាញ backup របស់អាជីវកម្មផ្សេង',
                /id: pull\n\s+if: steps\.guard\.outputs\.ready == 'yes'\n\s+continue-on-error: true/.test(wf)
                && pullAt > 0);
            ok('⛔ តែ job ត្រូវក្លាយជាក្រហម ➜ អ្នកប្រើដឹង (ជំហានឈរក្រោយ upload)',
                redAt > uploadAt && uploadAt > 0);
            const prepareAt = wf.indexOf('node firebase-backup/ci-config.js');
            const prepareRedAt = wf.indexOf("steps.prepare.outcome == 'failure'");
            ok('⛔ target ខូចក្នុង ZOE_BACKUP_TARGETS មិនបញ្ឈប់ backup របស់ target ផ្សេង (ជំហានត្រៀម continue-on-error)',
                /id: prepare\n\s+if: steps\.guard\.outputs\.ready == 'yes'\n\s+continue-on-error: true/.test(wf)
                && prepareAt > 0 && prepareAt < pullAt);
            ok('⛔ ជំហានត្រៀមដែលធ្លាក់ធ្វើឲ្យ job ក្រហមក្រោយ upload ដូចការទាញធ្លាក់',
                prepareRedAt > uploadAt && uploadAt > 0 && Math.abs(prepareRedAt - redAt) < 200);
            ok('⛔ ការស្កេន plaintext មិនត្រូវកាត់ដោយ head (pipefail ➜ សារបាត់)',
                !/! -name '\*\.enc'[^\n]*\| head/.test(wf));
            const leakScan = (wf.match(/^\s+leaked=\$\(find [^\n]*$/m) || [''])[0];
            const exclusions = (leakScan.match(/! -name '([^']+)'/g) || []).map((m) => m.slice(9, -1));
            ok('⛔ ការលើកលែងក្នុងការស្កេន plaintext មានតែ .enc និង lock ប៉ុណ្ណោះ',
                exclusions.length === 2 && exclusions[0] === '*.enc'
                && exclusions[1] === '.zoe-backup.lock', exclusions);
        }

    } finally {
        fs.rmSync(tempRoot, { recursive: true, force: true });
    }

    console.log(`\n${pass} ok, ${fail} FAIL`);
    process.exit(fail ? 1 : 0);
})().catch((e) => {
    console.error(e && e.stack ? e.stack : e);
    process.exit(1);
});
