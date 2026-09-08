const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { webcrypto } = require('crypto');

// រត់ម៉ូឌុលពិត និង ECDSA ពិត។ ជំនួសតែ public key ដោយគូសោតេស្ត
// និង REST ដោយសាលក្រមដែលអាចពន្យារបាន។ គ្មានសំណើទៅផលិតកម្ម។
const root = path.resolve(process.env.LICRACE_APP_DIR || path.join(__dirname, '..'));
const DAY = 86400000;
const NOW = Date.UTC(2026, 8, 8, 12);
const STORE_KEY = 'zoe_license_activation_ADM';
let pass = 0;
let fail = 0;

function ok(label, condition) {
    if (condition) { pass++; console.log('   ok    ' + label); }
    else { fail++; console.log('  FAIL   ' + label); }
}

function deferred() {
    let resolve;
    const promise = new Promise((done) => { resolve = done; });
    return { promise, resolve };
}

async function bounded(promise) {
    let timer;
    try {
        return await Promise.race([promise, new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error('តេស្តរង់ចាំលើសពិដាន')), 3000);
        })]);
    } finally { clearTimeout(timer); }
}

async function scenario(label, run) {
    try { await run(); }
    catch (error) { ok(label + ' ៖ ' + error.message, false); }
}

function readRecord(store) {
    try { return JSON.parse(store[STORE_KEY]); } catch (_) { return null; }
}

async function main() {
    const keys = await webcrypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const publicKey = await webcrypto.subtle.exportKey('jwk', keys.publicKey);
    async function signedKey(id, days) {
        const payload = { a: 'ADM', id, iat: NOW / 1000, exp: (NOW + days * DAY) / 1000, note: id };
        const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
        const signature = await webcrypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, keys.privateKey, Buffer.from(data));
        return 'ZOEKEY-' + data + '.' + Buffer.from(signature).toString('base64url');
    }
    const keyA = await signedKey('TEST_A', 10);
    const keyB = await signedKey('TEST_B', 30);
    const activeA = { revoked: false, expiresAt: NOW + 10 * DAY };
    const activeB = { revoked: false, expiresAt: NOW + 30 * DAY };

    for (const app of ['ZoeW', 'ZoeKeyGen']) {
        await scenario(app + ' ៖ ផ្ទុកម៉ូឌុល', async () => {
            const original = fs.readFileSync(path.join(root, app, 'license-verify.js'), 'utf8');
            const source = original.replace(/const PUBLIC_KEYS_JWK = \[[\s\S]*?\n    \];/, 'const PUBLIC_KEYS_JWK = ' + JSON.stringify([publicKey]) + ';');
            ok(app + ' ៖ ម៉ូឌុលពិតមាន public key សម្រាប់ប្ដូរក្នុងតេស្ត', source !== original && original.length > 2000);
            if (source === original || original.length <= 2000) return;

            function build(store = {}) {
                const requests = [];
                const state = { verifyGate: null, fetchGate: null, afterVerify: null, cryptoPending: 0, online: true, records: { TEST_A: activeA, TEST_B: activeB } };
                class Clock extends Date {
                    constructor(...args) { super(...(args.length ? args : [NOW])); }
                    static now() { return NOW; }
                }
                const context = vm.createContext({
                    window: {}, Date: Clock, TextEncoder, TextDecoder, AbortController, setTimeout, clearTimeout,
                    Uint8Array, atob: (value) => Buffer.from(value, 'base64').toString('binary'),
                    btoa: (value) => Buffer.from(value, 'binary').toString('base64'),
                    navigator: { get onLine() { return state.online; } },
                    localStorage: {
                        getItem: (key) => store[key] || null,
                        setItem: (key, value) => { store[key] = value; },
                        removeItem: (key) => { delete store[key]; }
                    },
                    crypto: {
                        getRandomValues: (value) => webcrypto.getRandomValues(value),
                        subtle: {
                            importKey: async (...args) => {
                                state.cryptoPending++;
                                try { return await webcrypto.subtle.importKey(...args); }
                                finally { state.cryptoPending--; }
                            },
                            verify: async (...args) => {
                                const gate = state.verifyGate;
                                if (gate) { state.verifyGate = null; gate.started.resolve(); await gate.done.promise; }
                                state.cryptoPending++;
                                try {
                                    const result = await webcrypto.subtle.verify(...args);
                                    if (state.afterVerify) await state.afterVerify();
                                    return result;
                                } finally { state.cryptoPending--; }
                            }
                        }
                    },
                    fetch: async (url) => {
                        const match = /\/license_keys\/ADM\/(TEST_[AB])\.json$/.exec(url);
                        if (!match) throw new Error('សំណើមិនស្ថិតក្នុងទិន្នន័យតេស្ត');
                        const id = match[1];
                        requests.push(id);
                        let body = state.records[id];
                        const gate = state.fetchGate;
                        if (gate && gate.id === id) {
                            state.fetchGate = null;
                            gate.started.resolve();
                            body = await gate.done.promise;
                        }
                        if (body === 'offline') throw new Error('បណ្តាញដាច់ក្នុងតេស្ត');
                        return { ok: true, headers: { get: () => new Date(NOW).toUTCString() }, json: async () => body };
                    }
                });
                vm.runInContext(source, context);
                return { L: context.window.ZoeLicense, state, store, requests };
            }

            // ផ្ទាំងទី ២ Activate ក្រោយផ្ទាំងទី ១ អាន snapshot តែមុន REST ឆ្លើយ។
            for (const [result, body] of [['active', activeA], ['revoked', { revoked: true }], ['missing', null], ['offline', 'offline']]) {
                await scenario(app + ' ៖ REST ចាស់ ' + result, async () => {
                    const h = build();
                    ok(app + ' ៖ ត្រៀម Key A សម្រាប់ ' + result, (await bounded(h.L.activate(keyA, 'ADM'))).valid === true);
                    const gate = { id: 'TEST_A', started: deferred(), done: deferred() };
                    h.state.fetchGate = gate;
                    const pending = h.L.getStatus('ADM');
                    await bounded(gate.started.promise);
                    const second = build(h.store);
                    ok(app + ' ៖ Key B រក្សាទុកមុន REST ចាស់ ' + result, (await bounded(second.L.activate(keyB, 'ADM'))).valid === true);
                    const freshStatus = await bounded(h.L.getStatus('ADM'));
                    ok(app + ' ៖ Key B មិនជាប់ក្រោយសំណើ Key A ចាស់ ' + result, freshStatus.state === 'active' && freshStatus.exp === activeB.expiresAt);
                    gate.done.resolve(body);
                    const status = await bounded(pending);
                    ok(app + ' ៖ REST ចាស់ ' + result + ' មិនលុប/សរសេរជាន់ Key B', readRecord(h.store)?.id === 'TEST_B');
                    ok(app + ' ៖ REST ចាស់ ' + result + ' ឆ្លើយស្ថានភាព Key B', status.state === 'active' && status.exp === activeB.expiresAt);
                });
            }

            await scenario(app + ' ៖ Activate Key ដដែលក្រោយ Extend', async () => {
                const h = build();
                await bounded(h.L.activate(keyA, 'ADM'));
                const gate = { id: 'TEST_A', started: deferred(), done: deferred() };
                h.state.fetchGate = gate;
                const pending = h.L.getStatus('ADM');
                await bounded(gate.started.promise);
                const second = build(h.store);
                second.state.records.TEST_A = activeB;
                ok(app + ' ៖ Activate Key ដដែលក្រោយ Extend ជោគជ័យ', (await bounded(second.L.activate(keyA, 'ADM'))).valid === true);
                h.state.records.TEST_A = activeB;
                gate.done.resolve({ revoked: true });
                const status = await bounded(pending);
                ok(app + ' ៖ សាលក្រមចាស់មិនលុប Key ដែល Extend ថ្មី', readRecord(h.store)?.onlineExp === activeB.expiresAt);
                ok(app + ' ៖ Key ដដែលត្រូវឆ្លើយពិដានថ្មីពី DB', status.state === 'active' && status.exp === activeB.expiresAt);
            });

            for (const invalid of [false, true]) {
                await scenario(app + ' ៖ ហត្ថលេខាចាស់ ' + invalid, async () => {
                    const h = build();
                    await bounded(h.L.activate(keyA, 'ADM'));
                    if (invalid) {
                        const record = readRecord(h.store);
                        record.keyString = record.keyString.slice(0, record.keyString.lastIndexOf('.') + 1) + 'AAAA';
                        h.store[STORE_KEY] = JSON.stringify(record);
                    }
                    const gate = { started: deferred(), done: deferred() };
                    h.state.verifyGate = gate;
                    const pending = h.L.getStatus('ADM');
                    await bounded(gate.started.promise);
                    await bounded(build(h.store).L.activate(keyB, 'ADM'));
                    gate.done.resolve();
                    const status = await bounded(pending);
                    ok(app + ' ៖ ហត្ថលេខាចាស់ ' + invalid + ' មិនបំផ្លាញ Key B', readRecord(h.store)?.id === 'TEST_B');
                    ok(app + ' ៖ ហត្ថលេខាចាស់ ' + invalid + ' មិនប្រគល់សាលក្រមចាស់', status.state === 'active' && status.exp === activeB.expiresAt);
                });
            }

            await scenario(app + ' ៖ បិទសិទ្ធិខណៈ REST កំពុងរង់ចាំ', async () => {
                const h = build();
                await bounded(h.L.activate(keyA, 'ADM'));
                const gate = { id: 'TEST_A', started: deferred(), done: deferred() };
                h.state.fetchGate = gate;
                const pending = h.L.getStatus('ADM');
                await bounded(gate.started.promise);
                build(h.store).L.deactivate('ADM');
                gate.done.resolve(activeA);
                const status = await bounded(pending);
                ok(app + ' ៖ REST ចាស់មិនស្ដារ Key ដែលបានបិទសិទ្ធិ', !readRecord(h.store));
                ok(app + ' ៖ ក្រោយបិទសិទ្ធិ ស្ថានភាពជា required', status.state === 'required');
            });

            await scenario(app + ' ៖ Activation ប្រែជាប់ៗមានច្រកចេញ', async () => {
                const h = build();
                const second = build(h.store);
                await bounded(h.L.activate(keyA, 'ADM'));
                let changes = 0;
                h.state.afterVerify = async () => {
                    changes++;
                    const result = await second.L.activate(changes % 2 ? keyB : keyA, 'ADM');
                    if (!result.valid) throw new Error('ការប្ដូរ Activation ក្នុងតេស្តមិនជោគជ័យ');
                };
                const status = await bounded(h.L.getStatus('ADM'));
                const recheckLimit = /const maxRechecks = (\d+)/.exec(original);
                ok(app + ' ៖ Activation ប្រែជាប់ៗ បញ្ឈប់ដោយពិដាន', !!recheckLimit && changes <= Number(recheckLimit[1]) + 1);
                ok(app + ' ៖ មិនផ្តល់សិទ្ធិថ្មីដោយគ្មានការផ្ទៀងផ្ទាត់', status.state !== 'active' && status.reason === 'verify-unavailable');
                ok(app + ' ៖ ពិដានមិនលុប/សរសេរជាន់ Activation ចុងក្រោយ', readRecord(h.store)?.id === (changes % 2 ? 'TEST_B' : 'TEST_A'));
            });

            await scenario(app + ' ៖ ទិសផ្ទុយធម្មតា', async () => {
                const h = build();
                const tampered = keyA.slice(0, keyA.lastIndexOf('.') + 1) + 'AAAA';
                ok(app + ' ៖ ECDSA ពិតបដិសេធហត្ថលេខាខុស', !(await bounded(h.L.activate(tampered, 'ADM'))).valid);
                ok(app + ' ៖ ECDSA ពិតទទួល Key ត្រឹមត្រូវ', (await bounded(h.L.activate(keyA, 'ADM'))).valid === true);
                h.state.online = false;
                ok(app + ' ៖ ក្នុងអនុគ្រោះក្រៅបណ្តាញ នៅ active', (await bounded(h.L.getStatus('ADM'))).state === 'active');
                h.state.online = true;
                h.state.records.TEST_A = { revoked: true };
                ok(app + ' ៖ Revoke ពិតនៅតែ required', (await bounded(h.L.getStatus('ADM'))).state === 'required' && !readRecord(h.store));
                await bounded(h.L.activate(keyB, 'ADM'));
                const older = readRecord(h.store);
                older.lastOnlineCheck -= DAY;
                h.store[STORE_KEY] = JSON.stringify(older);
                const gate = { id: 'TEST_B', started: deferred(), done: deferred() };
                h.state.fetchGate = gate;
                const pending = Promise.all(Array.from({ length: 8 }, () => h.L.getStatus('ADM')));
                await bounded(gate.started.promise);
                await bounded((async () => {
                    const started = Date.now();
                    while (h.state.cryptoPending) {
                        if (Date.now() - started > 2000) throw new Error('ការផ្ទៀងផ្ទាត់ហត្ថលេខាមិនចប់');
                        await new Promise((resolve) => setImmediate(resolve));
                    }
                    await new Promise((resolve) => setImmediate(resolve));
                })());
                gate.done.resolve(activeB);
                const statuses = await bounded(pending);
                ok(app + ' ៖ ការពិនិត្យ ៨ ស្របគ្នាចប់ត្រឹមត្រូវ', statuses.every((status) => status.state === 'active' && status.exp === activeB.expiresAt));
                ok(app + ' ៖ សំណើស្របគ្នារួមការទាញ REST', h.requests.filter((id) => id === 'TEST_B').length <= 3);
            });
        });
    }
    console.log('\n' + pass + ' ok, ' + fail + ' FAIL');
    process.exitCode = fail ? 1 : 0;
}

main().catch((error) => { console.error('FAIL ៖ ' + error.message); process.exitCode = 1; });
