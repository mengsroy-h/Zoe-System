// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { sliceFunction } = require('../../react-view.js');
const root = process.env.PROVISION_RUNTIME_SOURCE_ROOT || path.resolve(import.meta.dirname, '../../../..');
const source = fs.readFileSync(path.join(root, 'tools/firebase-provision/provision.js'), 'utf8');
const wrapper = fs.readFileSync(path.join(root, 'tools/firebase-provision/deploy-rules.cmd'), 'utf8');
const commands = [...wrapper.matchAll(/^node provision\.js ([^\r\n]+)$/gm)].map(match => match[1]);

function fixture(options: { cancelled?: boolean; deployFailure?: boolean; signupOpen?: boolean; unmeasured?: boolean } = {}) {
    const events: string[] = [];
    const states = [{ projectId: 'fixture-one' }, { projectId: 'fixture-two' }];
    const context = vm.createContext({
        events, path, STEP_TIMEOUT_MS: 1000, DEFAULT_RULES_FILE: 'fixture.rules.json',
        EXIT: { OK: 0, FAIL: 1, USAGE: 2, UNMEASURED: 3 },
        UsageError: Error, PROJECT_ID_RE: /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/,
        EMAIL_PREFIX_DEFAULT: 'zoew', PASSWORD_ALPHABET: 'fixture', PROBE_PASSWORD_LENGTH: 24,
        crypto: { randomBytes: () => Buffer.from('fixture'), createHash: () => ({ update: () => ({ digest: () => 'fixture-hash' }) }) },
        say() {}, warn() {}, saveState() {}, randomFrom: () => 'synthetic-password-only',
        allStates: () => states, loadState: (id: string) => states.find(state => state.projectId === id),
        readRulesFile: (file: string) => ({ file, text: '{}', canonical: '{}' }), rulesMatch: () => true,
        confirm: async () => !options.cancelled,
        databaseUrlOf: async (state: { projectId: string }) => state.projectId,
        signedInReadNode: () => '', pickConfig: (value: unknown) => value,
        api: {
            withDeadline: (promise: unknown) => promise,
            login: async () => { events.push('login'); },
            deployRules: async (id: string, _text: string, dry: boolean) => {
                events.push((dry ? 'dry:' : 'deploy:') + id);
                if (options.deployFailure) throw new Error('synthetic-deploy-failure');
            },
            readRules: async (id: string) => { events.push('read:' + id); return '{}'; },
            webConfigOf: async (id: string) => { events.push('verify:' + id); return { apiKey: 'synthetic-key' }; },
            findDatabase: async () => ({ databaseUrl: 'fixture-database' }),
            readAuthConfig: async () => ({}), lockdownGaps: () => [],
            publicSignUp: async () => {
                events.push('signup-probe');
                return options.signupOpen ? { status: 200, localId: 'synthetic-probe' }
                    : options.unmeasured ? { status: 503, code: 'UNAVAILABLE' }
                        : { status: 400, code: 'ADMIN_ONLY_OPERATION' };
            },
            deleteUser: async () => { events.push('delete-probe'); return true; },
            databaseRead: async () => ({ status: 401 }), messageOf: (error: Error) => error.message
        }
    });
    const names = ['parseArgs', 'flagText', 'targetStates', 'cmdRules', 'cmdVerify', 'verifyProject', 'reportVerify'];
    vm.runInContext(names.map(name => {
        const body = sliceFunction(source, name);
        if (!body) throw new Error('Missing production function: ' + name);
        return body;
    }).join('\n'), context);
    return {
        events,
        async run(args: string[], wrapped = true) {
            // Model only the observed Node invocations and existing nonzero-exit guard, not cmd.exe itself.
            let code = 0;
            for (const command of wrapped ? commands : ['rules --all %*']) {
                context.argv = command.split(/\s+/).flatMap(arg => arg === '%*' ? args : [arg]);
                const opts = vm.runInContext('parseArgs(argv)', context);
                if (opts._[0] !== 'rules' && opts._[0] !== 'verify') throw new Error('Unexpected wrapper command');
                code = await vm.runInContext(opts._[0] === 'rules' ? 'cmdRules(parseArgs(argv))' : 'cmdVerify(parseArgs(argv))', context);
                if (code !== 0) break;
            }
            return code;
        },
        async verify() { return await vm.runInContext('cmdVerify({ all: true })', context); }
    };
}

it('Rules wrapper ៖ argument parsing និង verification មាន owner តែមួយក្នុង Node', () => {
    expect(commands).toEqual(['rules --all --verify %*']);
    expect(wrapper).toMatch(/set "RESULT=%ERRORLEVEL%"[\s\S]*exit \/b %RESULT%/);
});

it.each([
    ['--dry-run'], ['--DRY-RUN'], ['--yes', '--dry-run'], ['--rules', 'custom.rules.json', '--dry-run']
])('Rules wrapper ៖ %j មិនរត់ sign-up/delete probe', async (...args: string[]) => {
    const test = fixture({ signupOpen: true });
    expect(await test.run(args)).toBe(0);
    expect(test.events).toEqual(['login', 'dry:fixture-one', 'dry:fixture-two']);
});

it('Rules wrapper ៖ deploy ជោគជ័យទាំងអស់ទើប verify ទាំងអស់', async () => {
    const test = fixture();
    expect(await test.run(['--yes'])).toBe(0);
    expect(test.events.filter(event => event.startsWith('deploy:'))).toHaveLength(2);
    expect(test.events.filter(event => event.startsWith('verify:'))).toHaveLength(2);
    expect(test.events.indexOf('verify:fixture-one')).toBeGreaterThan(test.events.indexOf('read:fixture-two'));
});

it.each([
    [{ cancelled: true }, 2], [{ deployFailure: true }, 1]
])('Rules wrapper ៖ cancel/deploy failure មិន verify (%j)', async (options, code) => {
    const test = fixture(options);
    expect(await test.run([])).toBe(code);
    expect(test.events.some(event => event.startsWith('verify:') || event === 'signup-probe')).toBe(false);
});

it.each([
    [{ signupOpen: true }, 1], [{ unmeasured: true }, 3]
])('Rules wrapper ៖ រក្សា verification exit status (%j)', async (options, code) => {
    const test = fixture(options);
    expect(await test.run(['--yes'])).toBe(code);
    expect(test.events).toContain('signup-probe');
});

it('Rules CLI ដោយផ្ទាល់ ៖ គ្មាន --verify មិនបន្ថែម probe', async () => {
    const test = fixture({ signupOpen: true });
    expect(await test.run(['--yes'], false)).toBe(0);
    expect(test.events.some(event => event.startsWith('verify:') || event === 'signup-probe')).toBe(false);
});

it('Negative control ៖ verify ពិតអាច create/delete probe បើ sign-up បើក', async () => {
    const test = fixture({ signupOpen: true });
    expect(await test.verify()).toBe(1);
    expect(test.events.filter(event => event === 'signup-probe')).toHaveLength(2);
    expect(test.events.filter(event => event === 'delete-probe')).toHaveLength(2);
});
