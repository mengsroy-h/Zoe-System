'use strict';

// នាឡិកាក្លែងសម្រាប់ browser fixture ប៉ុណ្ណោះ៖ ដំឡើងក្រោយ API របស់ license។
// getter មិនបង្កើត sample ទេ៖ មានតែ sync ដែលជោគជ័យប៉ុណ្ណោះ។
// sample ប្រើ Date និង performance របស់ browser រួមទាំងនាឡិកា Playwright។
// fixture បណ្តាញអាចផ្តល់ពេល server ដាច់ពី wall skew របស់ឧបករណ៍។
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
            const anchor = window.__fixtureServerTime;
            const epochMs = anchor ? anchor.epochMs + monotonicMs - anchor.monotonicMs
                : typeof window.__zoeFixtureServerNow === 'function' ? window.__zoeFixtureServerNow() : wallMs;
            if (!Number.isFinite(epochMs) || epochMs < 1 || epochMs > 8640000000000000) return Promise.resolve(false);
            sample = Object.freeze({ epochMs: Math.floor(epochMs), wallMs, monotonicMs, uncertaintyMs: 0,
                generation, observation: ++observation, source: 'nonce' });
            return Promise.resolve(true);
        }
    });
}

module.exports.CLOCK_FIXTURE = '\n;(' + installBrowserClockFixture.toString() + ')();\n';

// ផ្លាស់ប្រភពពេលវេលាក្លែង ហើយឱ្យ bridge/session ពិតផ្ទៀងផ្ទាត់ម្ដងទៀត។
// មិនកំណត់ trust ឬ session verdict ដោយផ្ទាល់ទេ។
module.exports.setBrowserScenarioTime = async function setBrowserScenarioTime(epochMs) {
    if (epochMs === null) {
        delete window.__fixtureServerTime;
        delete window.__fixtureAuthTime;
    } else {
        window.__fixtureServerTime = { epochMs, monotonicMs: performance.now() };
        window.__fixtureAuthTime = epochMs;
    }
    if (!await window.ZoeLicense.syncServerTime()) throw new Error('Fixture clock sync failed');
    window.__fireAll();
    await window.runSessionExpiryCheck();
};
