const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const configPath = process.argv[2] || path.join(__dirname, 'config.json');

if (!fs.existsSync(configPath)) {
    console.error(`Config file not found: ${configPath}`);
    console.error('Copy config.example.json to config.json and fill in your businesses first.');
    process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const backupRoot = path.resolve(__dirname, config.backupDir || './backups');

const rawKeepCount = config.keepCount === undefined ? 30 : config.keepCount;
if (!Number.isInteger(rawKeepCount) || rawKeepCount < 1) {
    console.error(`Invalid "keepCount" in config: ${JSON.stringify(config.keepCount)} — must be a whole number >= 1.`);
    process.exit(1);
}
const keepCount = rawKeepCount;

function resolveBusinessDir(name) {
    if (typeof name !== 'string' || !name.trim()) {
        throw new Error('Business entry is missing a "name".');
    }
    if (!/^[A-Za-z0-9._-]+$/.test(name) || name === '.' || name === '..') {
        throw new Error(`Unsafe business name "${name}" — use only letters, digits, dot, dash, underscore.`);
    }
    return path.join(backupRoot, name);
}

function pruneOldBackups(dir) {
    const files = fs.readdirSync(dir)
        .filter((f) => f.endsWith('.json.gz'))
        .sort();
    while (files.length > keepCount) {
        const oldest = files.shift();
        fs.unlinkSync(path.join(dir, oldest));
    }
}

async function backupOne(business, index) {
    const outDir = resolveBusinessDir(business.name);
    const serviceAccountPath = path.resolve(__dirname, business.serviceAccountPath);
    if (!fs.existsSync(serviceAccountPath)) {
        throw new Error(`Service account file not found: ${serviceAccountPath}`);
    }
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

    const app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: business.databaseURL
    }, `backup-app-${index}`);

    try {
        const snapshot = await app.database().ref('/').once('value');
        const data = snapshot.val() || {};

        fs.mkdirSync(outDir, { recursive: true });

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const outFile = path.join(outDir, `${timestamp}.json.gz`);
        const tmpFile = outFile + '.partial';
        try {
            fs.writeFileSync(tmpFile, zlib.gzipSync(JSON.stringify(data)));
            fs.renameSync(tmpFile, outFile);
        } catch (writeErr) {
            if (fs.existsSync(tmpFile)) { try { fs.unlinkSync(tmpFile); } catch (e) {} }
            throw writeErr;
        }

        pruneOldBackups(outDir);

        return outFile;
    } finally {
        await app.delete();
    }
}

async function main() {
    if (!Array.isArray(config.businesses) || config.businesses.length === 0) {
        console.error('config.json has no "businesses" entries.');
        process.exit(1);
    }

    let failures = 0;
    for (let i = 0; i < config.businesses.length; i += 1) {
        const business = config.businesses[i];
        const label = (business && typeof business.name === 'string' && business.name.trim()) ? business.name : `#${i + 1}`;
        try {
            const outFile = await backupOne(business, i);
            const sizeKb = (fs.statSync(outFile).size / 1024).toFixed(1);
            console.log(`[OK]   ${label} -> ${outFile} (${sizeKb} KB)`);
        } catch (e) {
            failures += 1;
            console.error(`[FAIL] ${label}: ${e.message}`);
        }
    }

    if (failures > 0) {
        console.error(`\n${failures} of ${config.businesses.length} backup(s) failed.`);
        process.exit(1);
    }
    console.log(`\nAll ${config.businesses.length} backup(s) completed.`);
}

main().catch((e) => {
    console.error('Backup run failed unexpectedly:', e && e.message ? e.message : e);
    process.exit(1);
});
