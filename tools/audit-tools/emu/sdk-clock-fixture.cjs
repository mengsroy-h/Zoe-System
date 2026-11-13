'use strict';
const assert = require('node:assert/strict');

function initializeSdkClock(api) {
    api.resetServerClock();
    const wallMs = Date.now(), monotonicMs = performance.now();
    const sample = Object.freeze({ epochMs: wallMs, wallMs, monotonicMs, uncertaintyMs: 0, source: 'nonce', generation: 1 });
    assert.equal(api.acceptServerClockOffset(0, sample, true), true, 'SDK fixture ត្រូវមាន clock ដែលបានផ្ទៀងផ្ទាត់');
    api.firebaseState.sessionExpiryCheck = 'live';
}

module.exports = { initializeSdkClock };
