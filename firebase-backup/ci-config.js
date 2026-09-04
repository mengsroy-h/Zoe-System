'use strict';

const fs = require('fs');
const path = require('path');
const backup = require('./backup.js');

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

function buildRunDirectory(outRoot, targets) {
    const secretsDir = path.join(outRoot, 'secrets');
    fs.mkdirSync(secretsDir, { recursive: true, mode: 0o700 });
    const businesses = [];
    const summary = [];
    for (const entry of targets) {
        if (!entry || typeof entry !== 'object') {
            throw new Error(`${TARGETS_ENV} contains an entry that is not an object.`);
        }
        const dir = backup.resolveBusinessDir(outRoot, entry.name);
        const name = path.basename(dir);
        const databaseURL = backup.normalizeDatabaseUrl(entry.databaseURL);
        const serviceAccount = backup.validateServiceAccount(serviceAccountObject(entry));
        const keyPath = path.join(secretsDir, `${name}.json`);
        fs.writeFileSync(keyPath, JSON.stringify({
            client_email: serviceAccount.clientEmail,
            private_key: serviceAccount.privateKey,
            token_uri: serviceAccount.tokenUri
        }), { mode: 0o600 });
        businesses.push({
            name,
            serviceAccountPath: path.join('secrets', `${name}.json`),
            databaseURL
        });
        summary.push(`${name} -> ${new URL(databaseURL).hostname}`);
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
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), { mode: 0o600 });
    backup.validateBusinesses(config, path.join(outRoot, 'backups'));
    return { configPath, summary, count: businesses.length };
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
    const result = buildRunDirectory(outRoot, parseTargets(process.env[TARGETS_ENV]));
    for (const line of result.summary) console.log(`[TARGET] ${line}`);
    console.log(`\nPrepared ${result.count} target(s) at ${result.configPath}`);
    return result;
}

if (require.main === module) {
    try {
        main();
    } catch (e) {
        console.error(e && e.message ? e.message : e);
        process.exitCode = 1;
    }
}

module.exports = { TARGETS_ENV, buildRunDirectory, main, parseTargets };
