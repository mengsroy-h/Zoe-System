'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');

function deferred() {
    let resolve, reject;
    const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
    return { promise, resolve, reject };
}

async function until(predicate) {
    for (let i = 0; i < 1000 && !predicate(); i++) await Promise.resolve();
    assert.ok(predicate(), 'fixture មិនបានចូលដល់ស្ថានភាពដែលត្រូវវាស់');
}

async function run(root, ok) {
    const sourcePath = path.join(root, 'tools/firebase-provision/provision.js');
    const source = fs.readFileSync(sourcePath, 'utf8');
    const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'zoe-provision-lock-'));
    const projectId = 'fixture-project';
    const seed = { projectId, branch: '881859', emailPrefix: 'zoew', users: ['seed@zoew881859.com'], steps: { app: true }, databaseURL: 'https://fixture.invalid' };
    const account = name => name + '@zoew881859.com';
    const userArgs = name => ['user', '--project', projectId, '--user', name];
    const lockPath = stateDir => path.join(stateDir, '.provision.lock');
    function stateDir(name) {
        const dir = path.join(temp, name);
        fs.mkdirSync(dir);
        fs.writeFileSync(path.join(dir, projectId + '.json'), JSON.stringify(seed));
        return dir;
    }
    function invocation(dir, overrides = {}) {
        const calls = [], reads = [], output = [];
        const api = {
            login: async () => { calls.push('login'); return 'synthetic@example.invalid'; },
            createUser: async (_project, email) => { calls.push('create:' + email); return { created: true }; },
            webConfigOf: async () => { calls.push('config'); return { apiKey: 'synthetic-key' }; },
            publicSignIn: async () => { calls.push('sign-in'); return { idToken: 'synthetic-token' }; },
            withDeadline: promise => Promise.resolve(promise),
            messageOf: error => error.message,
            ...overrides
        };
        const disk = new Proxy(fs, { get(target, key) {
            if (key === 'readFileSync') return (file, ...args) => {
                if (path.dirname(String(file)) === dir && String(file).endsWith('.json')) reads.push(String(file));
                return target.readFileSync(file, ...args);
            };
            return target[key];
        } });
        const context = {
            module: { exports: {} }, __dirname: path.dirname(sourcePath),
            require(name) {
                if (name === './firebase-api') return api;
                if (name === 'fs') return disk;
                if (name === 'child_process') return { spawn() { throw new Error('fixture មិនអនុញ្ញាត child process'); } };
                return require(name);
            },
            process: { env: { ZOE_PROVISION_STATE_DIR: dir }, pid: process.pid, version: process.version,
                stdin: { isTTY: false }, stdout: { write: value => output.push(value) }, stderr: { write: value => output.push(value) } },
            setTimeout, clearTimeout, Buffer, URL
        };
        vm.runInNewContext(source, context, { filename: sourcePath });
        return { main: context.module.exports.main, calls, reads, output };
    }
    const scenario = async (name, test) => {
        try { await test(); } catch (error) { ok(name, false, error.message); }
    };
    try {
        await scenario('user ពីររត់ត្រួតគ្នា', async () => {
            const dir = stateDir('overlap');
            const hold = deferred();
            const accounts = new Set(seed.users);
            let entered = false;
            const create = async (_project, email) => {
                if (accounts.has(email)) return { created: false };
                accounts.add(email);
                return { created: true };
            };
            const first = invocation(dir, { createUser: async (...args) => { entered = true; await hold.promise; return create(...args); } });
            const running = first.main(userArgs('first'));
            try {
                await until(() => entered);
                const second = invocation(dir, { createUser: create });
                const code = await second.main(userArgs('second'));
                ok('contender បដិសេធមុនអាន state និងមុនហៅ API', code === 2 && second.calls.length === 0 && second.reads.length === 0, { code, calls: second.calls, reads: second.reads.length });
                ok('contender មិនបានបង្កើតគណនីក្លែង', !accounts.has(account('second')));
            } finally { hold.resolve(); }
            ok('ម្ចាស់ដំបូងបញ្ចប់បាន', await running === 0);
            const retry = invocation(dir, { createUser: create });
            ok('retry ក្រោយម្ចាស់បញ្ចប់អាចបង្កើតគណនីបាន', await retry.main(userArgs('second')) === 0);
            const saved = JSON.parse(fs.readFileSync(path.join(dir, projectId + '.json')));
            ok('state រក្សាបុគ្គលិកពីរថ្មី និងទិន្នន័យចាស់',
                JSON.stringify([...saved.users].sort()) === JSON.stringify([...seed.users, account('first'), account('second')].sort())
                && saved.steps.app === true && saved.branch === seed.branch, saved.users);
            ok('ម្ចាស់បញ្ចប់ដោះ lock របស់ខ្លួន', !fs.existsSync(lockPath(dir)));
        });

        await scenario('រក្សា lock រហូតដល់ការផ្ទៀងចុងក្រោយចប់', async () => {
            const dir = stateDir('verification');
            const hold = deferred();
            let entered = false;
            const first = invocation(dir, { webConfigOf: async () => { entered = true; await hold.promise; return { apiKey: 'synthetic-key' }; } });
            const running = first.main(userArgs('first'));
            try {
                await until(() => entered);
                const saved = JSON.parse(fs.readFileSync(path.join(dir, projectId + '.json')));
                ok('ចូលដល់ផ្លូវផ្ទៀងបន្ទាប់ពី state សរសេររួច', saved.users.includes(account('first')));
                const second = invocation(dir);
                ok('មិនដោះ lock មុនការផ្ទៀងចុងក្រោយ', await second.main(userArgs('second')) === 2 && second.calls.length === 0);
            } finally { hold.resolve(); }
            ok('ការផ្ទៀងបញ្ចប់ហើយដោះ lock', await running === 0 && !fs.existsSync(lockPath(dir)));
        });

        await scenario('lock ដែលនៅសល់មិនត្រូវលុបដោយស្វ័យប្រវត្តិ', async () => {
            const dir = stateDir('abandoned');
            const marker = JSON.stringify({ token: 'synthetic-existing-owner', pid: -1, startedAt: '2000-01-01T00:00:00.000Z' });
            fs.writeFileSync(lockPath(dir), marker);
            const commands = [
                ['new', '--branch', '881859', '--user', 'third', '--app-url', 'https://fixture.invalid'],
                ['rules', '--project', projectId, '--yes'],
                userArgs('third'),
                ['show', '--project', projectId, '--app-url', 'https://fixture.invalid'],
                ['show', '--project', projectId, '--email-prefix', 'fixture']
            ];
            for (const args of commands) {
                const job = invocation(dir, { login: async () => { throw new Error('unexpected synthetic API'); } });
                const code = await job.main(args);
                ok('lock បិទ local writer ' + args.join(' '), code === 2 && job.calls.length === 0 && job.reads.length === 0);
            }
            ok('មិន auto-reap lock ទោះ PID/ពេលវេលាចាស់', fs.readFileSync(lockPath(dir), 'utf8') === marker);
            ok('contender មិនសរសេរ settings', !fs.existsSync(path.join(dir, 'settings.json')));
            for (const args of [
                ['rules', '--project', projectId, '--dry-run'],
                ['show', '--project', projectId],
                ['verify', '--project', projectId]
            ]) {
                let reached = false;
                const job = invocation(dir, { login: async () => { reached = true; throw new Error('synthetic read boundary'); } });
                const code = await job.main(args);
                ok('ការអានមិនត្រូវ local lock បិទ ' + args.join(' '), code === 1 && reached && fs.readFileSync(lockPath(dir), 'utf8') === marker);
            }
        });

        await scenario('បរាជ័យ និង usage ដោះតែ lock របស់ខ្លួន', async () => {
            const dir = stateDir('failures');
            const failed = invocation(dir, { login: async () => { throw new Error('synthetic API failure'); } });
            ok('API failure ដោះ local lock', await failed.main(userArgs('first')) === 1 && !fs.existsSync(lockPath(dir)));
            const invalid = invocation(dir);
            ok('usage failure ដោះ local lock', await invalid.main(['user', '--project', 'bad']) === 2 && !fs.existsSync(lockPath(dir)));
            const retry = invocation(dir);
            ok('retry ក្រោយ failure អាចរត់បាន', await retry.main(userArgs('first')) === 0);
        });

        await scenario('new timeout មិនដោះ lock ពេល step នៅអាចសរសេរ state', async () => {
            const dir = stateDir('timed-out-step');
            const file = path.join(dir, projectId + '.json');
            fs.writeFileSync(file, JSON.stringify({ ...seed, steps: Object.fromEntries(
                ['project', 'firebase', 'apis', 'app', 'database', 'rules', 'auth'].map(name => [name, true])) }));
            const hold = deferred(), deadline = deferred();
            let entered = false;
            const job = invocation(dir, {
                createUser: async () => { entered = true; await hold.promise; return { created: true }; },
                withDeadline: (promise, _ms, label) => label === 'step "users"' ? Promise.race([promise, deadline.promise]) : promise
            });
            const running = job.main(['new', '--branch', seed.branch, '--project-id', projectId,
                '--user', 'late', '--app-url', 'https://fixture.invalid']);
            await until(() => entered);
            deadline.reject(Object.assign(new Error('synthetic deadline'), { code: 'TIMEOUT' }));
            ok('new timeout រាយ failure ហើយរក្សា lock', await running === 1 && fs.existsSync(lockPath(dir)));
            const contender = invocation(dir);
            ok('timeout មិនបើកផ្លូវឲ្យ contender', await contender.main(userArgs('second')) === 2 && contender.calls.length === 0);
            hold.resolve();
            await until(() => JSON.parse(fs.readFileSync(file)).users.includes(account('late')));
            const afterLate = invocation(dir);
            ok('step ចប់យឺតនៅតែមិន auto-release lock', fs.existsSync(lockPath(dir))
                && await afterLate.main(userArgs('third')) === 2 && afterLate.calls.length === 0);
            // នេះគ្រាន់តែសាកការសង្គ្រោះដោយដៃក្រោយ continuation ក្លែងបានចប់ និង state ត្រូវបានផ្ទៀង។
            if (fs.existsSync(lockPath(dir))) fs.unlinkSync(lockPath(dir));
            const retry = invocation(dir);
            ok('ការសង្គ្រោះដោយដៃក្រោយ step ចប់រក្សាទាំង row ចាស់/ថ្មី', await retry.main(userArgs('second')) === 0
                && ['seed', 'late', 'second'].every(name => JSON.parse(fs.readFileSync(file)).users.includes(account(name))));
        });

        await scenario('ការដោះ lock មិនប៉ះម្ចាស់ផ្សេង', async () => {
            const dir = stateDir('replacement');
            const hold = deferred();
            let entered = false;
            const job = invocation(dir, { createUser: async () => { entered = true; await hold.promise; return { created: true }; } });
            const running = job.main(userArgs('first'));
            await until(() => entered);
            const marker = JSON.stringify({ token: crypto.randomUUID(), pid: -1 });
            fs.writeFileSync(lockPath(dir), marker);
            hold.resolve();
            ok('lock ownership ប្រែ ➜ រាយ failure និងទុក lock នោះ', await running === 1 && fs.readFileSync(lockPath(dir), 'utf8') === marker);
        });
    } finally { fs.rmSync(temp, { recursive: true, force: true }); }
}

module.exports = { run };
if (require.main === module) {
    process.exitCode = 1;
    let passed = 0, failed = 0;
    run(path.resolve(process.env.FBPROVISION_APP_DIR || path.join(__dirname, '../..')), (label, condition, detail) => {
        if (condition) { passed++; console.log('ok ' + label); }
        else { failed++; console.log('FAIL ' + label + (detail === undefined ? '' : ': ' + JSON.stringify(detail))); }
    }).then(() => {
        console.log(`provision-state-lock: ${passed} ok, ${failed} FAIL`);
        process.exitCode = failed ? 1 : 0;
    }, error => { console.error(error); process.exitCode = 1; });
}
