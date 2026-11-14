// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const semver = require('semver');
const root = process.env.PROVISION_RUNTIME_SOURCE_ROOT || path.resolve(import.meta.dirname, '../../../..');
const tool = path.join(root, 'tools/firebase-provision');
const source = fs.readFileSync(path.join(tool, 'setup.cmd'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(tool, 'package.json'), 'utf8'));
const lock = JSON.parse(fs.readFileSync(path.join(tool, 'package-lock.json'), 'utf8'));
const check = source.match(/^node -e "([^"\r\n]+)"\r?$/m)?.[1];
if (!check) throw new Error('Missing production Node.js admission command');
const engines = Object.entries(lock.packages)
    .filter(([name]) => name !== '')
    .map(([, item]: [string, any]) => item.engines?.node)
    .filter((value): value is string => typeof value === 'string');

for (const version of [
    '18.20.8', '20.0.0', '20.19.0', '22.17.0', '22.22.1', '22.22.2', '22.23.0',
    '23.0.0', '24.14.9', '24.15.0', '24.22.1', '25.0.0', '26.0.0', '28.0.0'
]) {
    it('Firebase provision៖ bootstrap និង package engine ស្រប lock នៅ Node ' + version, () => {
        const supported = engines.every(range => semver.satisfies(version, range));
        const exitCodes: number[] = [];
        vm.runInNewContext(check, { process: {
            versions: { node: version }, exit: (code: number) => exitCodes.push(code)
        } });
        expect(exitCodes).toEqual([supported ? 0 : 1]);
        expect(semver.satisfies(version, manifest.engines.node)).toBe(supported);
        expect(lock.packages[''].engines.node).toBe(manifest.engines.node);
    });
}

it('Firebase provision៖ ពិនិត្យ runtime មុន npm ci ហើយរក្សា cmd ASCII/CRLF', () => {
    expect(source.indexOf('node -e')).toBeLessThan(source.indexOf('call npm ci'));
    expect(Array.from(source).every(char => {
        const code = char.charCodeAt(0);
        return code === 9 || code === 10 || code === 13 || code >= 32 && code <= 126;
    })).toBe(true);
    expect(source.split('\n').slice(0, -1).every(line => line.endsWith('\r'))).toBe(true);
    expect(source.slice(source.indexOf('node -e'), source.indexOf('call npm ci'))).toMatch(/if errorlevel 1[\s\S]+exit \/b 1/);
});


const PATCHED_PROVISION_DEPENDENCIES = {
    hono: '>=4.13.16',
    '@hono/node-server': '>=2.1.6',
    'basic-ftp': '>=6.2.4'
};

function vulnerableLockedDependencies(name: string, safeRange: string) {
    return Object.entries(lock.packages)
        .filter(([key]) => key === 'node_modules/' + name || key.endsWith('/node_modules/' + name))
        .filter(([, item]: [string, any]) => typeof item.version !== 'string' || !semver.satisfies(item.version, safeRange))
        .map(([key, item]: [string, any]) => ({ key, version: item.version }));
}

for (const [name, safeRange] of Object.entries(PATCHED_PROVISION_DEPENDENCIES)) {
    it('Firebase provision៖ locked graph គ្មាន advisory range ចាស់របស់ ' + name, () => {
        expect(vulnerableLockedDependencies(name, safeRange)).toEqual([]);
    });
}
