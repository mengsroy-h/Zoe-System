'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const MAGIC = Buffer.from('ZOEBAK1\n', 'utf8');
const SALT_BYTES = 16;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const HEADER_BYTES = MAGIC.length + SALT_BYTES + IV_BYTES + TAG_BYTES;
const KEY_BYTES = 32;
const SCRYPT_N = 32768;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_MAXMEM = 64 * 1024 * 1024;
const MIN_PASSPHRASE_LENGTH = 16;

function requirePassphrase(passphrase) {
    const value = typeof passphrase === 'string' ? passphrase : '';
    if (value.length < MIN_PASSPHRASE_LENGTH) {
        throw new Error(`Passphrase is too short: got ${value.length} characters, need at least ${MIN_PASSPHRASE_LENGTH}.`);
    }
    return value;
}

function deriveKey(passphrase, salt) {
    return crypto.scryptSync(requirePassphrase(passphrase), salt, KEY_BYTES, {
        N: SCRYPT_N,
        r: SCRYPT_R,
        p: SCRYPT_P,
        maxmem: SCRYPT_MAXMEM
    });
}

function encryptBuffer(plain, passphrase) {
    if (!Buffer.isBuffer(plain)) throw new Error('encryptBuffer expects a Buffer.');
    const salt = crypto.randomBytes(SALT_BYTES);
    const iv = crypto.randomBytes(IV_BYTES);
    const key = deriveKey(passphrase, salt);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const body = Buffer.concat([cipher.update(plain), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([MAGIC, salt, iv, tag, body]);
}

function decryptBuffer(sealed, passphrase) {
    if (!Buffer.isBuffer(sealed)) throw new Error('decryptBuffer expects a Buffer.');
    if (sealed.length < HEADER_BYTES) {
        throw new Error('Encrypted file is truncated (shorter than its header).');
    }
    if (!sealed.subarray(0, MAGIC.length).equals(MAGIC)) {
        throw new Error('Not a Zoe backup archive (bad magic header).');
    }
    let offset = MAGIC.length;
    const salt = sealed.subarray(offset, offset + SALT_BYTES);
    offset += SALT_BYTES;
    const iv = sealed.subarray(offset, offset + IV_BYTES);
    offset += IV_BYTES;
    const tag = sealed.subarray(offset, offset + TAG_BYTES);
    offset += TAG_BYTES;
    const body = sealed.subarray(offset);
    const key = deriveKey(passphrase, salt);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    try {
        return Buffer.concat([decipher.update(body), decipher.final()]);
    } catch (e) {
        throw new Error('Cannot decrypt: wrong passphrase, or the file was modified.');
    }
}

function writePrivateAtomicFile(outFile, contents) {
    const tmpFile = `${outFile}.${process.pid}.partial`;
    let owned;
    try {
        const fd = fs.openSync(tmpFile, 'wx', 0o600);
        try {
            owned = fs.fstatSync(fd);
            fs.writeFileSync(fd, contents);
        } finally {
            fs.closeSync(fd);
        }
        const current = fs.lstatSync(tmpFile);
        if (current.dev !== owned.dev || current.ino !== owned.ino) throw new Error('Temporary backup file ownership changed.');
        fs.renameSync(tmpFile, outFile);
    } catch (writeError) {
        if (owned) {
            try {
                const current = fs.lstatSync(tmpFile);
                if (current.dev === owned.dev && current.ino === owned.ino) fs.unlinkSync(tmpFile);
            } catch (cleanupError) {}
        }
        throw writeError;
    }
}

function encryptFile(inFile, outFile, passphrase) {
    const plain = fs.readFileSync(inFile);
    const sealed = encryptBuffer(plain, passphrase);
    const verified = decryptBuffer(sealed, passphrase);
    if (!verified.equals(plain)) {
        throw new Error(`Verification failed for ${inFile} — the encrypted copy did not decrypt back to the original.`);
    }
    writePrivateAtomicFile(outFile, sealed);
    return { bytesIn: plain.length, bytesOut: sealed.length };
}

function decryptFile(inFile, outFile, passphrase) {
    const plain = decryptBuffer(fs.readFileSync(inFile), passphrase);
    writePrivateAtomicFile(outFile, plain);
    return { bytesIn: fs.statSync(inFile).size, bytesOut: plain.length };
}

function collectBackupFiles(root) {
    const found = [];
    const stack = [root];
    while (stack.length) {
        const dir = stack.pop();
        let entries;
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch (e) {
            if (e && e.code === 'ENOENT') continue;
            throw e;
        }
        for (const entry of entries) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) stack.push(full);
            else if (entry.isFile() && entry.name.endsWith('.json.gz')) found.push(full);
        }
    }
    return found.sort();
}

function readPassphrase() {
    const passphrase = process.env.ZOE_BACKUP_PASSPHRASE;
    if (typeof passphrase !== 'string' || !passphrase) {
        throw new Error('Set ZOE_BACKUP_PASSPHRASE before running this command.');
    }
    return requirePassphrase(passphrase);
}

function usage() {
    return [
        'Usage:',
        '  ZOE_BACKUP_PASSPHRASE=... node crypt.js seal   <backupDir> [keepCount]  encrypt .json.gz; optional verified generation retention (omitted: no pruning)',
        '  ZOE_BACKUP_PASSPHRASE=... node crypt.js open   <file.enc> <out.gz>  decrypt one archive back to .json.gz',
        '',
        `The passphrase must be at least ${MIN_PASSPHRASE_LENGTH} characters. Keep it outside this repository.`
    ].join('\n');
}

function sealedRetentionPlan(dir, keepCount, passphrase) {
    const generations = new Map();
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const match = /^(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-[a-f0-9]{6})\.json\.gz(\.enc)?$/.exec(entry.name);
        if (!entry.isFile() || !match) continue;
        const files = generations.get(match[1]) || [];
        files.push(entry.name);
        generations.set(match[1], files);
    }
    const sealed = [...generations.keys()].filter(key => generations.get(key).some(file => file.endsWith('.enc'))).sort();
    const split = Math.max(0, sealed.length - keepCount);
    if (!split) return [];
    for (const key of sealed.slice(split)) {
        const file = path.join(dir, key + '.json.gz.enc');
        try { JSON.parse(zlib.gunzipSync(decryptBuffer(fs.readFileSync(file), passphrase)).toString('utf8')); }
        catch (e) { throw new Error('Cannot apply retention: retained archive failed verification ' + path.basename(file) + '.'); }
    }
    return sealed.slice(0, split).flatMap(key => generations.get(key).map(file => path.join(dir, file)));
}

function runSeal(dir, keepCount) {
    if (keepCount !== undefined && (!Number.isInteger(keepCount) || keepCount < 1 || keepCount > 10000)) throw new Error('keepCount must be a whole number from 1 to 10000.');
    const passphrase = readPassphrase();
    const files = collectBackupFiles(path.resolve(process.cwd(), dir));
    if (files.length === 0) {
        throw new Error(`No .json.gz backups found under ${dir} — refusing to report success with nothing sealed.`);
    }
    if (keepCount !== undefined) for (const file of files) {
        try { JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString('utf8')); }
        catch (e) { throw new Error('Cannot apply retention: invalid gzip JSON backup ' + path.basename(file) + '.'); }
    }
    for (const file of files) {
        const outFile = `${file}.enc`;
        const sizes = encryptFile(file, outFile, passphrase);
        fs.unlinkSync(file);
        console.log(`[SEAL] ${path.basename(outFile)} (${sizes.bytesIn} -> ${sizes.bytesOut} bytes)`);
    }
    if (keepCount !== undefined) {
        const plans = [...new Set(files.map(file => path.dirname(file)))].map(folder => sealedRetentionPlan(folder, keepCount, passphrase));
        for (const file of plans.flat()) fs.unlinkSync(file);
    }
    console.log(`\nSealed ${files.length} backup file(s).`);
    return files.length;
}

function runOpen(inFile, outFile) {
    const passphrase = readPassphrase();
    const sizes = decryptFile(path.resolve(process.cwd(), inFile), path.resolve(process.cwd(), outFile), passphrase);
    console.log(`[OPEN] ${outFile} (${sizes.bytesIn} -> ${sizes.bytesOut} bytes)`);
    return sizes;
}

function main(argv) {
    const args = (argv || process.argv).slice(2);
    const command = args[0];
    if (command === 'seal') {
        if (!args[1]) throw new Error(`Missing <backupDir>.\n\n${usage()}`);
        if (args.length > 3) throw new Error(usage());
        return runSeal(args[1], args[2] === undefined ? undefined : Number(args[2]));
    }
    if (command === 'open') {
        if (!args[1] || !args[2]) throw new Error(`Missing <file.enc> <out.gz>.\n\n${usage()}`);
        return runOpen(args[1], args[2]);
    }
    throw new Error(usage());
}

if (require.main === module) {
    try {
        main();
    } catch (e) {
        console.error(e && e.message ? e.message : e);
        process.exitCode = 1;
    }
}

module.exports = {
    HEADER_BYTES,
    MAGIC,
    MIN_PASSPHRASE_LENGTH,
    collectBackupFiles,
    decryptBuffer,
    decryptFile,
    encryptBuffer,
    encryptFile,
    main,
    requirePassphrase,
    runSeal,
    writePrivateAtomicFile
};
