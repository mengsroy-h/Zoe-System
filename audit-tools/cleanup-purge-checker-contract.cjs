'use strict';
const vm = require('vm');

// រត់ម្ចាស់ cleanup ដែល checker ស្រង់ពិត៖ callback ត្រូវរក្សាម្ចាស់ និងព្រំអាយុ
// ទាំងការហៅដំបូង និងការហៅក្រោយ settle។ មិនធ្វើ I/O ឬប្ដូរ state របស់ App ទេ។
async function cleanupPurgeOwnerContract(source, currentSource) {
    let valid = true;
    let calls = 0;
    let settled = 0;
    let released = 0;
    let lease = true;
    let trusted = true;
    let now = 10000;
    let scope = 'checker-shop';
    const item = { id: 'checker-purge', deletedAt: 1, trashReason: 'deleted' };
    const state = { db: {}, fb: {}, authGeneration: 1, auth: { currentUser: { uid: 'checker-owner' } } };
    const data = { deletedItems: [item], deletedCleanupInFlight: false };
    const context = {
        firebaseState: state, dataState: data,
        deletedCleanupOwner: null, deletedCleanupCursor: null,
        sessionVerificationRequired: () => false,
        captureClockOperation: () => ({ current: () => lease }),
        cleanupClockIsTrustworthy: () => trusted,
        getServerClockBounds: () => ({ lowerMs: now, upperMs: now }),
        trashRetentionMs: () => 1000,
        liveShopScope: () => scope,
        cleanupLedgerKeyOf: () => null,
        dbOp: promise => promise,
        showToast() {},
        purgeDeductionWaits: new Map(),
        purgeDeductionWaitKey: () => 'checker-purge',
        releaseCleanupLedgerKeys: async () => { released++; },
        settlePurgeDeduction: async (_candidate, _owner, current) => { settled++; probe(current); return '2026-09-22'; },
        purgeTrashWithRegistry: async (candidate, current) => {
            calls++;
            if (JSON.stringify(candidate) !== JSON.stringify(item)) valid = false;
            probe(current);
            return calls === 1 ? null : true;
        }
    };
    // ភ្ជាប់ទាំង module view និង aliases របស់ audit concatenation ពិត។
    for (const owner of [state, data]) for (const key of Object.keys(owner)) {
        Object.defineProperty(context, key, { configurable: true, get: () => owner[key], set: value => { owner[key] = value; } });
    }
    function probe(current) {
        if (typeof current !== 'function') { valid = false; return; }
        const owner = context.deletedCleanupOwner;
        try {
            if (current() !== true) valid = false;
            context.deletedCleanupOwner = null;
            if (current() !== false) valid = false;
            context.deletedCleanupOwner = owner;
            for (const key of ['db', 'fb', 'authGeneration', 'auth']) {
                const previous = state[key];
                state[key] = key === 'authGeneration' ? 2 : key === 'auth' ? { currentUser: { uid: 'other-owner' } } : {};
                if (current() !== false) valid = false;
                state[key] = previous;
            }
            scope = 'other-shop';
            if (current() !== false) valid = false;
            scope = 'checker-shop';
            lease = false;
            if (current() !== false) valid = false;
            lease = true; trusted = false;
            if (current() !== false) valid = false;
            trusted = true; now = item.deletedAt + 1000;
            if (current() !== false) valid = false;
            now = item.deletedAt + 1001;
            if (current() !== true) valid = false;
        } catch (_) { valid = false; }
        finally { context.deletedCleanupOwner = owner; lease = true; trusted = true; now = 10000; scope = 'checker-shop'; }
    }
    let timer;
    try {
        vm.createContext(context);
        const work = vm.runInContext(currentSource + '\n' + source + '\nrunAutomaticDeletedCleanup();', context, { timeout: 1000 });
        const completed = await Promise.race([Promise.resolve(work).then(() => true), new Promise(resolve => { timer = setTimeout(() => resolve(false), 1000); })]);
        return completed && valid && calls === 2 && settled === 1 && released === 1
            && data.deletedItems.length === 0 && !data.deletedCleanupInFlight && context.deletedCleanupOwner === null;
    } catch (_) { return false; }
    finally { clearTimeout(timer); }
}

module.exports = { cleanupPurgeOwnerContract };
