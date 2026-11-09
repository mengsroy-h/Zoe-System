'use strict';

// នាឡិកាក្លែងសម្រាប់ browser fixture ប៉ុណ្ណោះ៖ ដំឡើងក្រោយ API របស់ license។
// getter មិនបង្កើត sample ទេ៖ មានតែ sync ដែលជោគជ័យប៉ុណ្ណោះ។
// sample ប្រើ Date និង performance របស់ browser រួមទាំងនាឡិកា Playwright។
function installBrowserClockFixture() {
    let sample = null;
    let generation = 0;
    let observation = 0;
    function current() {
        if (!sample) return null;
        const mono = performance.now() - sample.monotonicMs;
        const wall = Date.now() - sample.wallMs;
        if (!Number.isFinite(mono) || !Number.isFinite(wall) || mono < 0 || wall < 0
            || Math.abs(mono - wall) > 2000 || Math.max(mono, wall) > 3 * 24 * 60 * 60 * 1000) {
            sample = null;
            generation++;
            observation++;
        }
        return sample;
    }
    Object.assign(window.ZoeLicense, {
        getServerTimeSample() { return current(); },
        getServerTimeGeneration() { current(); return generation; },
        getServerTimeOffset() { return current() ? sample.epochMs - sample.wallMs : 0; },
        syncServerTime() {
            current();
            const wallMs = Date.now();
            const monotonicMs = performance.now();
            if (!Number.isFinite(wallMs) || wallMs <= 0 || wallMs > 8640000000000000
                || !Number.isFinite(monotonicMs) || monotonicMs < 0) return Promise.resolve(false);
            sample = Object.freeze({ epochMs: wallMs, wallMs, monotonicMs, uncertaintyMs: 0,
                generation, observation: ++observation, source: 'nonce' });
            return Promise.resolve(true);
        }
    });
}

module.exports.CLOCK_FIXTURE = '\n;(' + installBrowserClockFixture.toString() + ')();\n';
