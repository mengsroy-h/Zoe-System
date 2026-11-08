// វាស់ `syncServerTime()` ពិតក្នុង App ទាំងពីរ ដោយគ្មានបណ្តាញ និងគ្មាន dependency។
// ផ្លូវសាធារណៈតូចមួយត្រូវជំនួសការអាន root ដែល rules បដិសេធ។
// Nonce-bound JSON is readable cross-origin; Date is intentionally absent from fixtures.
'use strict';

process.exitCode = 1;

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert/strict');

const ROOT = process.env.LICENSETIME_APP_DIR
    ? path.resolve(process.env.LICENSETIME_APP_DIR)
    : path.resolve(__dirname, '..');
const NOW = Date.parse('2026-11-06T10:00:00Z');
const SERVER_DATE = 'Fri, 06 Nov 2026 10:00:42 GMT';
const OFFSET = Date.parse(SERVER_DATE) - NOW;
const EXPECTED_PATH = '/.netlify/functions/server-time';
let pass = 0;
let fail = 0;

const watchdog = setTimeout(() => {
    console.error('FAIL — checker ព្យួរ មិនទាន់បញ្ចប់សេណារីយ៉ូ');
    process.exit(1);
}, 8000);

function ok(label, cond, detail) {
    if (cond) {
        pass++;
        console.log('  ok    ' + label);
    } else {
        fail++;
        console.error('  FAIL  ' + label + (detail === undefined ? '' : '\n        ' + detail));
    }
}

async function scenario(label, run) {
    try { await run(); ok(label, true); }
    catch (error) { ok(label, false, error.message); }
}

class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : [NOW])); }
    static now() { return NOW; }
}

function response(status = 200, date = SERVER_DATE) {
    return {
        ok: status >= 200 && status < 300, status, redirected: false,
        headers: { get: name => String(name).toLowerCase() === 'content-type' ? 'application/json' : null },
        json: async () => ({ now: date === null || date === '' ? null : Date.parse(date) })
    };
}

function timerClock() {
    let now = 0;
    let next = 0;
    const timers = new Map();
    return {
        setTimeout: (callback, delay) => {
            const id = ++next;
            timers.set(id, { callback, at: now + Math.max(0, Number(delay) || 0) });
            return id;
        },
        clearTimeout: (id) => timers.delete(id),
        pending: () => timers.size,
        advance: (ms) => {
            const end = now + ms;
            let steps = 0;
            while (true) {
                const due = [...timers].filter(([, timer]) => timer.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
                if (!due) break;
                assert.ok(++steps < 100, 'timer វិលជុំមិនចប់');
                now = due[1].at;
                timers.delete(due[0]);
                due[1].callback();
            }
            now = end;
        },
        dispose: () => timers.clear()
    };
}

async function drainPromises() {
    for (let turn = 0; turn < 30; turn++) await Promise.resolve();
}

function observe(promise) {
    const result = { settled: false, rejected: false, value: undefined };
    promise.then((value) => { result.settled = true; result.value = value; },
        (error) => { result.settled = true; result.rejected = true; result.value = error; });
    return result;
}

function rejectOnAbort(signal) {
    assert.ok(signal instanceof AbortSignal, 'សំណើត្រូវភ្ជាប់ AbortSignal ពិត');
    return new Promise((resolve, reject) => {
        const abort = () => {
            const error = new Error('aborted');
            error.name = 'AbortError';
            reject(error);
        };
        if (signal.aborted) abort();
        else signal.addEventListener('abort', abort, { once: true });
    });
}

function build(source, options = {}) {
    const calls = [];
    const timers = new Set();
    const context = {
        window: {},
        navigator: { onLine: options.online !== false },
        Date: FixedDate,
        performance: { now: () => 0 },
        AbortController,
        crypto: require("node:crypto").webcrypto,
        console,
        setTimeout: options.clock ? options.clock.setTimeout : (callback, delay) => {
            const timer = setTimeout(callback, delay);
            timers.add(timer);
            return timer;
        },
        clearTimeout: options.clock ? options.clock.clearTimeout : (timer) => { timers.delete(timer); clearTimeout(timer); },
        fetch: async (url, init) => {
            calls.push({ url: String(url), init });
            const res = await (options.fetch ? options.fetch(url, init) : response());
            const read = res.json;
            return { ...res, json: async () => ({ ...await read(), nonce: new URL(url).searchParams.get('nonce') }) };
        }
    };
    vm.runInNewContext(source, context, { timeout: 1000 });
    const api = context.window.ZoeLicense;
    assert.equal(typeof api?.syncServerTime, 'function');
    assert.equal(typeof api?.getServerTimeOffset, 'function');
    return { api, calls, context, dispose: () => {
        for (const timer of timers) clearTimeout(timer);
        if (options.clock) options.clock.dispose();
    } };
}

async function withEnv(source, options, run) {
    const env = build(source, options);
    try { await run(env); } finally { env.dispose(); }
}

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}

async function testCopy(name, source) {
    await scenario(name + ' ៖ អានតែផ្លូវសាធារណៈតូច ដោយគ្មាន auth ឬ cache', () =>
        withEnv(source, {}, async ({ api, calls }) => {
            assert.equal(await api.syncServerTime(), true);
            assert.equal(calls.length, 1);
            const request = calls[0];
            const url = new URL(request.url);
            assert.equal(url.pathname, EXPECTED_PATH);
            assert.match(url.searchParams.get("nonce"), /^[a-f0-9]{32}$/);
            assert.equal(url.origin, 'https://zoew.netlify.app');
            assert.equal(request.init.credentials, 'omit');
            assert.equal(request.init.redirect, 'error');
            assert.equal(request.init.method || 'GET', 'GET');
            assert.equal(request.init.cache, 'no-store');
            assert.ok(request.init.signal instanceof AbortSignal);
            assert.equal(request.init.body, undefined);
            assert.equal(request.init.credentials === 'include', false);
            assert.equal(Object.keys(request.init.headers || {}).some((key) => key.toLowerCase() === 'authorization'), false);
        }));

    await scenario(name + ' ៖ HTTP 200 + JSON ពិត កែម៉ោង និងទុកចិត្តបាន', () =>
        withEnv(source, {}, async ({ api }) => {
            assert.equal(api.getServerTimeOffset(), null);
            assert.equal(await api.syncServerTime(), true);
            assert.equal(api.getServerTimeOffset(), OFFSET);
            assert.equal(api.getServerNow(), NOW + OFFSET);
        }));

    for (const offset of [0, -42000]) {
        await scenario(name + ' ៖ offset ' + offset + ' ពី server ត្រូវទទួលយក', () =>
            withEnv(source, { fetch: async () => response(200, new Date(NOW + offset).toUTCString()) }, async ({ api }) => {
                assert.equal(await api.syncServerTime(), true);
                assert.equal(api.getServerTimeOffset(), offset);
                assert.equal(api.getServerNow(), NOW + offset);
            }));
    }

    await scenario(name + ' ៖ sync ជោគជ័យម្តងទៀតជំនួស offset ចាស់ ទោះទៅអវិជ្ជមាន ឬសូន្យ', async () => {
        const offsets = [42000, -30000, 0];
        let attempt = 0;
        await withEnv(source, { fetch: async () => response(200, new Date(NOW + offsets[attempt++]).toUTCString()) }, async ({ api, calls }) => {
            for (const offset of offsets) {
                assert.equal(await api.syncServerTime(), true);
                assert.equal(api.getServerTimeOffset(), offset);
                assert.equal(api.getServerNow(), NOW + offset);
            }
            assert.equal(calls.length, offsets.length);
        });
    });

    for (const date of [null, '', 'not-a-date']) {
        await scenario(name + ' ៖ JSON now ' + JSON.stringify(date) + ' មិនបង្កើតភាពទុកចិត្ត', () =>
            withEnv(source, { fetch: async () => response(200, date) }, async ({ api }) => {
                assert.equal(await api.syncServerTime(), false);
                assert.equal(api.getServerTimeOffset(), null);
            }));
    }

    for (const status of [401, 403, 404, 500]) {
        await scenario(name + ' ៖ HTTP ' + status + ' មាន JSON ក៏មិនបង្កើតភាពទុកចិត្ត', () =>
            withEnv(source, { fetch: async () => response(status) }, async ({ api }) => {
                assert.equal(await api.syncServerTime(), false);
                assert.equal(api.getServerTimeOffset(), null);
            }));
    }

    const failedRefreshes = [
        ['HTTP 403', async () => response(403)],
        ['JSON now អវត្តមាន', async () => response(200, null)],
        ['JSON now មិនត្រឹមត្រូវ', async () => response(200, 'invalid')],
        ['fetch បដិសេធ', async () => { throw new Error('network unavailable'); }],
        ['JSON បដិសេធ', async () => ({ ...response(), json: async () => { throw new Error('body unavailable'); } })]
    ];
    for (const [failureName, failed] of failedRefreshes) {
        await scenario(name + ' ៖ refresh ' + failureName + ' រក្សា offset ពី sync ពិត និងអាចសាកឡើងវិញ', async () => {
            let attempt = 0;
            await withEnv(source, { fetch: async () => ++attempt === 2 ? failed() : response() }, async ({ api, calls }) => {
                assert.equal(api.getServerTimeOffset(), null);
                assert.equal(await api.syncServerTime(), true);
                assert.equal(api.getServerTimeOffset(), OFFSET);
                assert.equal(await api.syncServerTime(), false);
                assert.equal(api.getServerTimeOffset(), OFFSET);
                assert.equal(api.getServerNow(), NOW + OFFSET);
                assert.equal(await api.syncServerTime(), true);
                assert.equal(calls.length, 3);
                assert.equal(api.getServerTimeOffset(), OFFSET);
            });
        });
    }

    await scenario(name + ' ៖ text បដិសេធមិនបង្កើតភាពទុកចិត្ត ហើយដោះ timer និងសោសម្រាប់សាកឡើងវិញ', async () => {
        const clock = timerClock();
        let attempt = 0;
        let bodyRead = false;
        await withEnv(source, { clock, fetch: async () => ++attempt === 1 ? {
            ...response(), json: async () => { bodyRead = true; throw new Error('body unavailable'); }
        } : response() }, async ({ api, calls }) => {
            assert.equal(await api.syncServerTime(), false);
            assert.equal(bodyRead, true);
            assert.equal(api.getServerTimeOffset(), null);
            assert.equal(clock.pending(), 0);
            assert.equal(await api.syncServerTime(), true);
            assert.equal(calls.length, 2);
            assert.equal(api.getServerTimeOffset(), OFFSET);
            assert.equal(clock.pending(), 0);
        });
    });

    for (const stage of ['fetch', 'body']) {
        for (const previouslySynced of [false, true]) {
            await scenario(name + ' ៖ ' + stage + ' ព្យួរ ' + (previouslySynced ? 'ក្រោយ sync ពិត' : 'មុន sync') + ' abort តាមពិដាន ហើយដោះសោសម្រាប់សាកឡើងវិញ', async () => {
                const timeout = Number((source.match(/const NET_TIMEOUT_MS = (\d+);/) || [])[1]);
                assert.ok(Number.isFinite(timeout) && timeout > 0, 'រកមិនឃើញពិដានពេលពីកូដ ship');
                const clock = timerClock();
                const hangingAttempt = previouslySynced ? 2 : 1;
                let attempt = 0;
                let fetchEntered = false;
                let bodyEntered = false;
                let requestSignal;
                await withEnv(source, { clock, fetch: async (url, init) => {
                    if (++attempt !== hangingAttempt) return response();
                    requestSignal = init.signal;
                    fetchEntered = true;
                    if (stage === 'fetch') return rejectOnAbort(init.signal);
                    return { ...response(), json: () => { bodyEntered = true; return rejectOnAbort(init.signal); } };
                } }, async ({ api, calls }) => {
                    if (previouslySynced) {
                        assert.equal(await api.syncServerTime(), true);
                        assert.equal(api.getServerTimeOffset(), OFFSET);
                    }
                    const pending = observe(api.syncServerTime());
                    await drainPromises();
                    assert.equal(fetchEntered, true);
                    assert.equal(bodyEntered, stage === 'body');
                    assert.equal(pending.settled, false);
                    assert.equal(requestSignal.aborted, false);
                    assert.equal(clock.pending(), 1);
                    clock.advance(timeout - 1);
                    await drainPromises();
                    assert.equal(requestSignal.aborted, false);
                    assert.equal(pending.settled, false);
                    clock.advance(1);
                    await drainPromises();
                    assert.equal(requestSignal.aborted, true);
                    assert.equal(pending.settled, true);
                    assert.equal(pending.rejected, false);
                    assert.equal(pending.value, false);
                    assert.equal(api.getServerTimeOffset(), previouslySynced ? OFFSET : null);
                    assert.equal(clock.pending(), 0);
                    assert.equal(await api.syncServerTime(), true);
                    assert.equal(calls.length, hangingAttempt + 1);
                    assert.equal(api.getServerTimeOffset(), OFFSET);
                    assert.equal(clock.pending(), 0);
                });
            });
        }
    }

    await scenario(name + ' ៖ ក្រៅបណ្ដាញមិនផ្ញើសំណើ និងមិនបង្កើតភាពទុកចិត្ត', () =>
        withEnv(source, { online: false }, async ({ api, calls }) => {
            assert.equal(await api.syncServerTime(), false);
            assert.equal(calls.length, 0);
            assert.equal(api.getServerTimeOffset(), null);
        }));

    await scenario(name + ' ៖ សំណើអាទិភាពនៅតែអាចសាកពេល navigator រាយថាក្រៅបណ្ដាញ', () =>
        withEnv(source, { online: false }, async ({ api, calls }) => {
            assert.equal(await api.syncServerTime({ priority: true }), true);
            assert.equal(calls.length, 1);
            assert.equal(api.getServerTimeOffset(), OFFSET);
        }));

    await scenario(name + ' ៖ ការហៅស្របគ្នា ១០ ដងផ្ញើសំណើតែមួយ ហើយអាច sync ម្ដងទៀត', async () => {
        const gate = deferred();
        await withEnv(source, { fetch: () => gate.promise }, async ({ api, calls }) => {
            const pending = Array.from({ length: 10 }, () => api.syncServerTime());
            await Promise.resolve();
            assert.equal(calls.length, 1);
            gate.resolve(response());
            assert.deepEqual(await Promise.all(pending), Array(10).fill(true));
            assert.equal(api.getServerTimeOffset(), OFFSET);
            assert.equal(await api.syncServerTime(), true);
            assert.equal(calls.length, 2);
        });
    });

    await scenario(name + ' ៖ សំណើរួមបរាជ័យមិនទុកចិត្ត និងដោះសោឱ្យសាកឡើងវិញ', async () => {
        const gate = deferred();
        let attempt = 0;
        await withEnv(source, { fetch: () => ++attempt === 1 ? gate.promise : Promise.resolve(response()) }, async ({ api, calls }) => {
            const pending = Array.from({ length: 10 }, () => api.syncServerTime());
            await Promise.resolve();
            assert.equal(calls.length, 1);
            gate.reject(new Error('network unavailable'));
            assert.deepEqual(await Promise.all(pending), Array(10).fill(false));
            assert.equal(api.getServerTimeOffset(), null);
            assert.equal(await api.syncServerTime(), true);
            assert.equal(calls.length, 2);
            assert.equal(api.getServerTimeOffset(), OFFSET);
        });
    });
}

(async () => {
    const copies = [
        ['ZoeW', fs.existsSync(path.join(ROOT, 'ZoeW/public/license-verify.js')) ? 'ZoeW/public/license-verify.js' : 'ZoeW/license-verify.js'],
        ['ZoeKeyGen', 'ZoeKeyGen/license-verify.js']
    ];
    const sources = [];
    for (const [name, relative] of copies) {
        let source = '';
        await scenario(name + ' ៖ អានកូដ ship ពិតបាន', () => {
            source = fs.readFileSync(path.join(ROOT, relative), 'utf8');
            assert.ok(source.length > 0);
        });
        sources.push(source);
        await testCopy(name, source);
    }
    await scenario('កូដ license-verify.js ទាំងពីរដូចគ្នាបេះបិទ', () => {
        assert.ok(sources.every((source) => source.length > 0));
        assert.equal(sources[0], sources[1]);
    });
    clearTimeout(watchdog);
    console.log('\n' + (fail ? 'FAIL' : 'PASS') + ' — ' + pass + ' ok, ' + fail + ' fail');
    process.exitCode = fail ? 1 : 0;
})().catch((error) => {
    clearTimeout(watchdog);
    console.error('FAIL — ' + error.stack);
    process.exitCode = 1;
});
