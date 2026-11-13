import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { parse } from 'acorn';
import { fullAncestor } from 'acorn-walk';
import { buildSync } from 'esbuild';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ROOT = path.resolve(process.env.SDK_FIXTURE_ROOT || '..');
const require = createRequire(import.meta.url);
const files = ['scan-operation-sdk-test.js', 'scan-month-coordination-sdk-test.js'];
let elapsed: number;

beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.UTC(2026, 10, 9));
    elapsed = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => elapsed);
});
afterEach(() => vi.useRealTimers());

function loadFixture(file: string) {
    const filename = path.join(ROOT, 'audit-tools/emu', file);
    const source = readFileSync(filename, 'utf8');
    const ast: any = parse(source, { ecmaVersion: 'latest', sourceType: 'script' });
    let entry = '', setup = '';
    fullAncestor(ast, (node: any, _state: any, ancestors: any[]) => {
        if (node.type === 'Property' && node.key.name === 'contents' && node.value.type === 'TemplateLiteral') entry = node.value.quasis[0].value.cooked;
        if (node.type !== 'ExpressionStatement' || node.expression.type !== 'CallExpression') return;
        const call = node.expression;
        if (call.callee.object?.name !== 'Object' || call.callee.property?.name !== 'assign'
            || call.arguments[0]?.object?.name !== 'api' || call.arguments[0]?.property?.name !== 'firebaseState') return;
        const parent = ancestors[ancestors.length - 2];
        const next = parent.body[parent.body.indexOf(node) + 1];
        setup = source.slice(node.start, node.end);
        if (next?.type === 'ExpressionStatement' && next.expression.callee?.name === 'initializeSdkClock') setup += '\n' + source.slice(next.start, next.end);
    });
    expect(entry).toContain('scan-action');
    expect(setup).toContain('sessionExpiryCheck');
    const output = buildSync({ absWorkingDir: ROOT, stdin: { contents: entry + `\nexport * as fixtureClock from './ZoeW/src/core/clock';\nexport * as fixtureSession from './ZoeW/src/core/session-verification';`, resolveDir: ROOT }, nodePaths: [path.resolve('node_modules')], bundle: true, platform: 'node', format: 'cjs', write: false, logLevel: 'error', define: { 'import.meta.env': '{}' } });
    const module = { exports: {} as any };
    new Function('require', 'module', 'exports', output.outputFiles[0].text)(require, module, module.exports);
    const api = module.exports;
    let initializeSdkClock: any;
    if (setup.includes('initializeSdkClock')) initializeSdkClock = require(path.join(ROOT, 'audit-tools/emu/sdk-clock-fixture.cjs')).initializeSdkClock;
    const install = () => new Function('api', 'sdk', 'db', 'auth', 'app', 'initializeSdkClock', setup)(api, {}, {}, { currentUser: { uid: 'fixture' } }, { options: {} }, initializeSdkClock);
    install();
    return { api, install, initializeSdkClock };
}

for (const file of files) describe(file, () => {
    it('រៀបចំ clock ពិត និង session live មុន scan', () => {
        const { api } = loadFixture(file);
        expect(api.fixtureClock.serverClockIsTrustworthy()).toBe(true);
        expect(api.fixtureClock.getServerClockBounds()).not.toBeNull();
        expect(api.fixtureSession.sessionUserActionAllowed('scan')).toBe(true);
        const handle = api.fixtureClock.captureClockOperation();
        expect(handle.current()).toBe(true);
        elapsed += 500;
        vi.setSystemTime(Date.now() + 500);
        expect(handle.current()).toBe(true);
    });
    it('ភាពខុសគ្នារវាង wall និង monotonic បិទ operation ចាស់', () => {
        const { api } = loadFixture(file);
        const handle = api.fixtureClock.captureClockOperation();
        expect(handle.current()).toBe(true);
        vi.setSystemTime(Date.now() + 60000);
        expect(api.fixtureClock.serverClockIsTrustworthy()).toBe(false);
        expect(handle.current()).toBe(false);
        expect(api.fixtureSession.sessionUserActionAllowed('scan')).toBe(false);
    });
    it('ប្ដូរ database និង sample generation មិនអាចបន្ត operation ចាស់', () => {
        const { api, install } = loadFixture(file);
        const handle = api.fixtureClock.captureClockOperation();
        expect(handle.current()).toBe(true);
        install();
        expect(api.fixtureClock.captureClockOperation().current()).toBe(true);
        expect(handle.current()).toBe(false);
    });
    it('sample ថ្មីនៅ database ដដែលមិនធ្វើឱ្យ operation ចាស់នៅ live', () => {
        const { api, initializeSdkClock } = loadFixture(file);
        const handle = api.fixtureClock.captureClockOperation();
        expect(handle.current()).toBe(true);
        const db = api.firebaseState.db;
        initializeSdkClock(api);
        expect(api.firebaseState.db).toBe(db);
        expect(api.fixtureClock.captureClockOperation().current()).toBe(true);
        expect(handle.current()).toBe(false);
    });
    it('session pending និង clock ដែល reset មិនអនុញ្ញាត scan', () => {
        const { api } = loadFixture(file);
        expect(api.fixtureSession.sessionUserActionAllowed('scan')).toBe(true);
        api.firebaseState.sessionExpiryCheck = 'pending';
        expect(api.fixtureSession.sessionUserActionAllowed('scan')).toBe(false);
        api.firebaseState.sessionExpiryCheck = 'live';
        api.fixtureClock.resetServerClock();
        expect(api.fixtureSession.sessionUserActionAllowed('scan')).toBe(false);
        expect(api.fixtureClock.getServerClockBounds()).toBeNull();
    });
});
