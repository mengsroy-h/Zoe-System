'use strict';

const fs = require('fs');
const path = require('path');
const backup = require('./backup.js');
const supabase = require('./supabase.js');
const { writePrivateAtomicFile } = require('./crypt.js');

const TARGETS_ENV = 'ZOE_BACKUP_TARGETS';

function parseTargets(raw) {
    if (typeof raw !== 'string' || !raw.trim()) {
        throw new Error(`${TARGETS_ENV} is empty — nothing to back up.`);
    }
    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch (e) {
        throw new Error(`${TARGETS_ENV} is not valid JSON. Paste the whole array, including the [ ] brackets.`);
    }
    if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error(`${TARGETS_ENV} must be a JSON array with at least one entry.`);
    }
    return parsed;
}

function serviceAccountObject(entry) {
    const raw = entry.serviceAccount;
    if (typeof raw === 'string') {
        try {
            return JSON.parse(raw);
        } catch (e) {
            throw new Error(`Entry "${entry.name}" has a serviceAccount string that is not valid JSON.`);
        }
    }
    if (!raw || typeof raw !== 'object') {
        throw new Error(`Entry "${entry.name}" is missing serviceAccount.`);
    }
    return raw;
}

function targetLabel(entry, index) {
    const name = entry && typeof entry === 'object' ? entry.name : undefined;
    return typeof name === 'string' && /^[A-Za-z0-9._-]+$/.test(name) ? name : `#${index + 1}`;
}

function addTarget(entry, outRoot, secretsDir, names) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        throw new Error('This entry is not an object.');
    }
    const dir = backup.resolveBusinessDir(outRoot, entry.name);
    const name = path.basename(dir);
    const claimName = () => {
        if (names.has(name.toLowerCase())) throw new Error(`Duplicate business name "${name}" in ${TARGETS_ENV}.`);
        names.add(name.toLowerCase());
    };
    if (entry.type === 'supabase') {
        const url = supabase.normalizeSupabaseUrl(entry.url);
        const key = supabase.validateSecretKey(entry.secretKey);
        claimName();
        const keyPath = path.join(secretsDir, `${name}.key`);
        writePrivateAtomicFile(keyPath, key + '\n');
        return {
            business: { name, type: 'supabase', url, secretKeyPath: path.join('secrets', `${name}.key`) },
            summary: `${name} -> ${new URL(url).host} (supabase)`
        };
    }
    if (entry.type !== undefined && entry.type !== 'firebase') {
        throw new Error(`Entry "${entry.name}" has an unknown type (use "firebase" or "supabase").`);
    }
    const databaseURL = backup.normalizeDatabaseUrl(entry.databaseURL);
    const serviceAccount = backup.validateServiceAccount(serviceAccountObject(entry));
    claimName();
    const keyPath = path.join(secretsDir, `${name}.json`);
    writePrivateAtomicFile(keyPath, JSON.stringify({
        client_email: serviceAccount.clientEmail,
        private_key: serviceAccount.privateKey,
        token_uri: serviceAccount.tokenUri
    }));
    return {
        business: { name, serviceAccountPath: path.join('secrets', `${name}.json`), databaseURL },
        summary: `${name} -> ${new URL(databaseURL).hostname}`
    };
}

function buildRunDirectory(outRoot, targets) {
    const secretsDir = path.join(outRoot, 'secrets');
    fs.mkdirSync(secretsDir, { recursive: true, mode: 0o700 });
    if (!fs.lstatSync(secretsDir).isDirectory()) throw new Error('Secrets directory must not be a symbolic link.');
    const businesses = [];
    const summary = [];
    const failed = [];
    const names = new Set();
    targets.forEach((entry, index) => {
        try {
            const added = addTarget(entry, outRoot, secretsDir, names);
            businesses.push(added.business);
            summary.push(added.summary);
        } catch (e) {
            failed.push(`${targetLabel(entry, index)}: ${e && e.message ? e.message : 'Unknown error'}`);
        }
    });
    if (!businesses.length) {
        throw new Error([`No valid target in ${TARGETS_ENV} — nothing to back up.`]
            .concat(failed.map((line) => `[FAIL] ${line}`)).join('\n'));
    }
    const config = {
        backupDir: './backups',
        keepCount: 30,
        requestTimeoutMs: 120000,
        retryCount: 2,
        retryDelayMs: 1000,
        businesses
    };
    const configPath = path.join(outRoot, 'config.json');
    writePrivateAtomicFile(configPath, JSON.stringify(config, null, 2));
    backup.validateBusinesses(config, path.join(outRoot, 'backups'));
    return { configPath, summary, failed, count: businesses.length, total: targets.length };
}

function main(argv) {
    const args = (argv || process.argv).slice(2);
    if (!args[0]) {
        throw new Error(`Usage: ${TARGETS_ENV}=... node ci-config.js <runDirectory>`);
    }
    const outRoot = path.resolve(process.cwd(), args[0]);
    if (outRoot === path.resolve(__dirname, '..') || outRoot.startsWith(path.resolve(__dirname, '..') + path.sep)) {
        throw new Error('Refusing to write credentials or backups inside the repository checkout — pass a path outside it (for example $RUNNER_TEMP/zoe-backup).');
    }
    fs.mkdirSync(outRoot, { recursive: true, mode: 0o700 });
    const realRoot = fs.realpathSync(outRoot);
    const repoRoot = fs.realpathSync(path.resolve(__dirname, '..'));
    if (realRoot === repoRoot || realRoot.startsWith(repoRoot + path.sep)) {
        throw new Error('Refusing to write credentials or backups inside the repository checkout through a symbolic link.');
    }
    const result = buildRunDirectory(realRoot, parseTargets(process.env[TARGETS_ENV]));
    for (const line of result.summary) console.log(`[TARGET] ${line}`);
    for (const line of result.failed) console.error(`[FAIL] ${line}`);
    console.log(`\nPrepared ${result.count} of ${result.total} target(s) at ${result.configPath}`);
    if (result.failed.length) {
        console.error(`${result.failed.length} target(s) in ${TARGETS_ENV} are left out of this backup. Fix them; the job turns red after the other backups are uploaded.`);
    }
    return result;
}

if (require.main === module) {
    try {
        if (main().failed.length) process.exitCode = 1;
    } catch (e) {
        console.error(e && e.message ? e.message : e);
        process.exitCode = 1;
    }
}

module.exports = { TARGETS_ENV, buildRunDirectory, main, parseTargets };
