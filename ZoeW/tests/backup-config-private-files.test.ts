// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { afterEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const sourceRoot = process.env.BACKUP_CONFIG_APP_DIR || path.resolve(import.meta.dirname, '../..');
const configSource = path.join(sourceRoot, 'firebase-backup/ci-config.js');
const { buildRunDirectory, main } = require(configSource);
const roots: string[] = [];
const targets = [
    { name: 'firebase', databaseURL: 'https://synthetic.firebaseio.com', serviceAccount: {
        client_email: 'synthetic@example.iam.gserviceaccount.com',
        private_key: '-----BEGIN ' + 'PRIVATE KEY-----\nSYNTHETIC_ONLY\n-----END PRIVATE KEY-----'
    } },
    { type: 'supabase', name: 'supabase', url: 'https://synthetic.supabase.co', secretKey: 'sb_secret_SYNTHETIC_ONLY' }
];

afterEach(() => {
    for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

function fixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zoe-config-private-'));
    roots.push(root);
    const output = path.join(root, 'run');
    fs.mkdirSync(path.join(output, 'secrets'), { recursive: true });
    return { root, output };
}

describe('សោ backup រក្សាឯកជនពេលប្រើថតដែលមានស្រាប់', () => {
    it('ថត secrets ជា symlink មិនអនុញ្ញាតឱ្យសោចុះក្រៅថតប្រតិបត្តិការ', () => {
        const { root, output } = fixture();
        const external = path.join(root, 'external');
        fs.mkdirSync(external);
        fs.rmdirSync(path.join(output, 'secrets'));
        fs.symlinkSync(external, path.join(output, 'secrets'), 'dir');
        expect(() => buildRunDirectory(output, targets)).toThrow(/directory|symbolic/i);
        expect(fs.readdirSync(external)).toEqual([]);
    });

    it('ផ្លូវនៅក្រៅ repo ដែល link ចូល repo ត្រូវបដិសេធមុនសរសេរសោ', () => {
        const { root } = fixture();
        const inRepo = fs.mkdtempSync(path.join(path.dirname(configSource), '.tmp-private-config-'));
        roots.push(inRepo);
        const link = path.join(root, 'checkout-link');
        fs.symlinkSync(inRepo, link, 'dir');
        const before = process.env.ZOE_BACKUP_TARGETS;
        process.env.ZOE_BACKUP_TARGETS = JSON.stringify(targets);
        try {
            expect(() => main(['node', 'ci-config.js', path.join(link, 'nested')])).toThrow(/Refusing to write credentials/);
            expect(fs.existsSync(path.join(inRepo, 'nested', 'secrets', 'firebase.json'))).toBe(false);
            expect(fs.existsSync(path.join(inRepo, 'nested', 'secrets', 'supabase.key'))).toBe(false);
        } finally {
            if (before === undefined) delete process.env.ZOE_BACKUP_TARGETS;
            else process.env.ZOE_BACKUP_TARGETS = before;
        }
    });

    for (const name of ['secrets/firebase.json', 'secrets/supabase.key', 'config.json']) {
        it(name + ' ៖ ជំនួសឯកសារដែលធ្លាប់អានបានជាសាធារណៈដោយ mode 0600', () => {
            const { output } = fixture();
            const file = path.join(output, name);
            fs.writeFileSync(file, 'SYNTHETIC_OLD');
            fs.chmodSync(file, 0o644);
            buildRunDirectory(output, targets);
            expect(fs.readFileSync(file, 'utf8')).not.toBe('SYNTHETIC_OLD');
            if (process.platform !== 'win32') expect(fs.statSync(file).mode & 0o777).toBe(0o600);
        });

        it(name + ' ៖ hard link មិនប្ដូរឯកសារខាងក្រៅ ឬផ្ដល់សោថ្មី', () => {
            const { root, output } = fixture();
            const external = path.join(root, 'external');
            fs.writeFileSync(external, 'SYNTHETIC_UNRELATED');
            const file = path.join(output, name);
            fs.linkSync(external, file);
            buildRunDirectory(output, targets);
            expect(fs.readFileSync(external, 'utf8')).toBe('SYNTHETIC_UNRELATED');
            expect(fs.readFileSync(file, 'utf8')).not.toBe('SYNTHETIC_UNRELATED');
        });

        it(name + ' ៖ symlink មិនប្ដូរឯកសារខាងក្រៅ ឬផ្ដល់សោថ្មី', () => {
            const { root, output } = fixture();
            const external = path.join(root, 'external');
            fs.writeFileSync(external, 'SYNTHETIC_UNRELATED');
            const file = path.join(output, name);
            fs.symlinkSync(external, file);
            buildRunDirectory(output, targets);
            expect(fs.readFileSync(external, 'utf8')).toBe('SYNTHETIC_UNRELATED');
            expect(fs.lstatSync(file).isSymbolicLink()).toBe(false);
            expect(fs.readFileSync(file, 'utf8')).not.toBe('SYNTHETIC_UNRELATED');
        });
    }
});
