'use strict';

// Exclusive Web Locks subset used by the real Reset/write-recovery sources.
// Each instance models one device. It is not a browser lock implementation.
function createFixtureLocks({ held = new Set(), queued = new Set(), trackedHeld = held, prefix = '', current = () => true, onRequest = () => {} } = {}) {
    const queues = new Map();
    let serial = 0, closed = false;
    const abortError = () => Object.assign(new Error('Fixture lock request aborted'), { name: 'AbortError' });
    const ended = () => Object.assign(new Error('Fixture lock owner ended'), { name: 'AbortError' });
    const state = () => ({ closed, held: [...held], queued: [...queues.values()].flat().map(ticket => ticket.name) });
    const remove = ticket => {
        queued.delete(ticket.key);
        ticket.signal?.removeEventListener('abort', ticket.abort);
        const queue = queues.get(ticket.name);
        if (queue) { const at = queue.indexOf(ticket); if (at !== -1) queue.splice(at, 1); if (!queue.length) queues.delete(ticket.name); }
    };
    const rejectWaiting = (ticket, reason) => {
        if (ticket.granted || ticket.done) return;
        ticket.done = true; remove(ticket); ticket.reject(reason); pump(ticket.name);
    };
    const pump = name => {
        if (held.has(name)) return;
        const ticket = queues.get(name)?.[0];
        if (!ticket) return;
        if (closed || !current()) { rejectWaiting(ticket, ended()); return; }
        ticket.granted = true; remove(ticket); held.add(name); trackedHeld.add(prefix + name);
        const release = () => { ticket.done = true; held.delete(name); trackedHeld.delete(prefix + name); pump(name); };
        Promise.resolve().then(() => ticket.action({ name, mode: 'exclusive' })).then(value => { release(); ticket.resolve(value); }, error => { release(); ticket.reject(error); });
    };
    const request = (name, options, action) => {
        if (typeof options === 'function') { action = options; options = {}; }
        options ||= {};
        return new Promise((resolve, reject) => {
            if (typeof name !== 'string' || typeof action !== 'function' || options.mode && options.mode !== 'exclusive'
                || options.steal || options.ifAvailable && options.signal) { reject(new TypeError('Unsupported fixture Web Locks request')); return; }
            if (closed || !current()) { reject(ended()); return; }
            if (options.signal?.aborted) { reject(options.signal.reason === undefined ? abortError() : options.signal.reason); return; }
            onRequest();
            const busy = held.has(name) || !!queues.get(name)?.length;
            if (options.ifAvailable === true && busy) { Promise.resolve().then(() => action(null)).then(resolve, reject); return; }
            const ticket = { name, action, resolve, reject, signal: options.signal, key: prefix + name + ':' + (++serial), granted: false, done: false, abort: null };
            ticket.abort = () => rejectWaiting(ticket, ticket.signal.reason === undefined ? abortError() : ticket.signal.reason);
            if (!queues.has(name)) queues.set(name, []);
            queues.get(name).push(ticket); queued.add(ticket.key);
            ticket.signal?.addEventListener('abort', ticket.abort, { once: true });
            queueMicrotask(() => pump(name));
        });
    };
    const close = () => { closed = true; for (const ticket of [...queues.values()].flat()) rejectWaiting(ticket, ended()); };
    return { request, close, state };
}

async function verifyFixtureLocks(create = createFixtureLocks) {
    const assert = require('node:assert/strict'), checks = [];
    const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
    const tick = async () => { for (let index = 0; index < 6; index++) await Promise.resolve(); };
    const check = (id, value) => { assert.ok(value, id); checks.push({ id, pass: true }); };
    const exercise = async () => {
        const held = new Set(), queued = new Set(), locks = create({ held, queued }), controller = new AbortController();
        let raw = 0;
        await locks.request('ordinary-write', { signal: controller.signal }, () => { raw++; });
        check('blocking-signal-path-reaches-action-once', raw === 1 && held.size === 0 && queued.size === 0);
        const gate = deferred(), entered = deferred(), order = [];
        const first = locks.request('fifo', {}, async () => { order.push(0); entered.resolve(); await gate.promise; });
        await entered.promise;
        const second = locks.request('fifo', {}, () => { order.push(1); });
        const third = locks.request('fifo', {}, () => { order.push(2); });
        let busy = 0;
        await locks.request('fifo', { ifAvailable: true }, lock => { assert.equal(lock, null); busy++; });
        check('busy-ifAvailable-does-not-barge-or-dispatch', busy === 1 && order.join() === '0' && queued.size === 2);
        gate.resolve(); await Promise.all([first, second, third]);
        check('blocking-contention-is-FIFO-exclusive', order.join() === '0,1,2' && held.size === 0 && queued.size === 0);
        const different = deferred(), differentEntered = deferred(); let otherName = 0;
        const occupiedName = locks.request('one-name', {}, async () => { differentEntered.resolve(); await different.promise; }); await differentEntered.promise;
        await locks.request('different-name', {}, () => { otherName++; });
        check('different-names-are-not-globally-serialized', otherName === 1 && held.has('one-name'));
        different.resolve(); await occupiedName;
        const occupied = deferred(), active = deferred(), abortHead = new AbortController();
        const holding = locks.request('abort', {}, async () => { active.resolve(); await occupied.promise; }); await active.promise;
        let abortedCalls = 0, nextCalls = 0, rejected = false;
        const waiting = locks.request('abort', { signal: abortHead.signal }, () => { abortedCalls++; });
        const observed = waiting.then(() => {}, error => { rejected = error.name === 'AbortError'; });
        const next = locks.request('abort', {}, () => { nextCalls++; }); abortHead.abort(); await observed;
        check('queued-abort-removes-only-waiter', rejected && abortedCalls === 0 && nextCalls === 0 && queued.size === 1);
        occupied.resolve(); await Promise.all([holding, next]);
        const pre = new AbortController(); pre.abort(false); let preCalls = 0, preRejected = false;
        await locks.request('pre', { signal: pre.signal }, () => { preCalls++; }).then(() => {}, error => { preRejected = error === false; });
        check('pre-abort-preserves-falsy-reason-zero-dispatch', preRejected && preCalls === 0);
        const granted = deferred(), settled = deferred(), afterGrant = new AbortController(); let following = 0;
        const running = locks.request('held', { signal: afterGrant.signal }, async () => { granted.resolve(); await settled.promise; }); await granted.promise;
        const followingWork = locks.request('held', {}, () => { following++; }); afterGrant.abort(); await tick();
        check('abort-after-grant-keeps-lock-until-callback-settles', held.has('held') && following === 0);
        settled.resolve(); await Promise.all([running, followingWork]);
        const failure = new Error('exact callback failure'); let same = false;
        await locks.request('throw', {}, () => { throw failure; }).then(() => {}, error => { same = error === failure; });
        check('callback-error-preserved-and-lock-released', same && held.size === 0 && queued.size === 0);
        const closeGate = deferred(), closeEntered = deferred(); let closedCalls = 0, closeRejected = false;
        const closeActive = locks.request('close', {}, async () => { closeEntered.resolve(); await closeGate.promise; }); await closeEntered.promise;
        const closeWaiting = locks.request('close', {}, () => { closedCalls++; }).then(() => {}, error => { closeRejected = error.name === 'AbortError'; });
        locks.close(); await closeWaiting;
        check('close-cancels-waiters-and-retains-unsettled-holder', closeRejected && closedCalls === 0 && held.has('close'));
        closeGate.resolve(); await closeActive;
        let afterCloseCalls = 0, afterCloseRejected = false;
        await locks.request('closed', {}, () => { afterCloseCalls++; }).then(() => {}, error => { afterCloseRejected = error.name === 'AbortError'; });
        check('closed-owner-refuses-new-callback', afterCloseRejected && afterCloseCalls === 0);
        let current = true, staleCalls = 0, staleRejected = false;
        const stale = create({ current: () => current }); current = false;
        await stale.request('stale', {}, () => { staleCalls++; }).then(() => {}, error => { staleRejected = error.name === 'AbortError'; });
        check('stale-owner-refuses-new-callback', staleRejected && staleCalls === 0);
        let unsupported = false;
        await create().request('unsupported', { mode: 'shared' }, () => {}).then(() => {}, error => { unsupported = error instanceof TypeError; });
        check('unsupported-lock-mode-is-explicitly-rejected', unsupported);
        const left = create(), right = create(), bothGate = deferred(); let devices = 0;
        const both = [left, right].map(manager => manager.request('same-name', {}, async () => { devices++; await bothGate.promise; })); await tick();
        check('separate-modeled-devices-keep-independent-managers', devices === 2); bothGate.resolve(); await Promise.all(both);
        check('all-owned-lock-resources-settled', held.size === 0 && queued.size === 0);
        return checks;
    };
    let timer;
    try { return await Promise.race([exercise(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Fixture lock controls timed out')), 1500); })]); }
    finally { clearTimeout(timer); }
}

module.exports = { createFixtureLocks, verifyFixtureLocks };
