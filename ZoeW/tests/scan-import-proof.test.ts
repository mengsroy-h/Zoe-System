import { describe, expect, it } from 'vitest';
import {
    createScanImportProofCache, SCAN_IMPORT_CACHE_MAX, SCAN_IMPORT_CACHE_PREFIX, SCAN_IMPORT_CACHE_TTL_MS,
    scanImportBindingMatches, scanImportBindingValid, scanImportCacheEntryValid, scanImportProofValid,
    type ScanImportBinding, type ScanImportCandidate, type ScanImportProof
} from '../src/services/scan-import-proof';

const NOW = Date.UTC(2026, 9, 30, 10);
const birth = NOW - 60000;
const identity = JSON.stringify(['2026-10-30', birth, '17:00:00 (2026-10-30)', null]);
const binding: ScanImportBinding = { v: 1, provider: 'cookie', scope: 'https://shop.invalid', actorUid: 'original-actor',
    intent: 'scan_' + 'a'.repeat(32), code: 'PARCEL0001', birth, identity };
const proof: ScanImportProof = { v: 1, provider: 'cookie', observedAt: NOW - 1000, signedAt: NOW - 5000, signedAtExact: true, identity };
const candidate: ScanImportCandidate = { scope: binding.scope, intent: binding.intent, code: binding.code, birth, identity };
const key = (b = binding) => SCAN_IMPORT_CACHE_PREFIX + encodeURIComponent(b.scope) + ':' + b.intent;
const entry = (b = binding, p = proof) => ({ closed: true, at: p.observedAt, signedAt: p.signedAt, signedAtExact: p.signedAtExact, binding: b });
function memory() {
    const map = new Map<string, string>();
    const store: Storage = {
        get length() { return map.size; },
        key(index) { return [...map.keys()][index] ?? null; },
        getItem(k) { return map.get(k) ?? null; },
        setItem(k, v) { map.set(k, String(v)); },
        removeItem(k) { map.delete(k); },
        clear() { map.clear(); }
    };
    return { map, store };
}

describe('ភស្តុតាង ZTO import ក្នុងឧបករណ៍៖ ចង intent និងជីវិតកញ្ចប់', () => {
    it('scope Unicode ខូចនៅ HOLD មិនបោះ exception ឬសរសេរ', () => {
        const { store } = memory(); const cache = createScanImportProofCache(store);
        expect(cache.publish({ ...binding, scope: '\ud800' }, proof, NOW)).toBe('hold');
        expect(cache.inspect({ ...candidate, scope: '\ud800' }, NOW).status).toBe('invalid');
        expect(store.length).toBe(0);
    });
    it('រក្សាម៉ោងដើម និងអានក្រោយ reboot ដោយគ្មាន viewer UID ថ្មី', () => {
        const { store } = memory();
        expect(createScanImportProofCache(store).publish(binding, proof, NOW)).toBe('stored');
        const found = createScanImportProofCache(store).lookup(candidate, NOW + 1000);
        expect(found).toEqual(entry());
        expect(found?.binding.actorUid).toBe('original-actor');
        expect(scanImportCacheEntryValid(found)).toBe(true);
        expect(store.length).toBe(1);
    });
    it('សរសេរ bytes ដដែលម្ដងទៀតមិនប្ដូរម៉ោង ឬអាយុ', () => {
        const { store } = memory(); const cache = createScanImportProofCache(store);
        expect(cache.publish(binding, proof, NOW)).toBe('stored');
        const before = store.getItem(key());
        expect(cache.publish(binding, proof, NOW + 5000)).toBe('stored');
        expect(store.getItem(key())).toBe(before);
    });
    for (const field of ['scope', 'intent', 'code', 'birth', 'identity'] as const) it('candidate ខុស ' + field + ' មិនយក Sign ជីវិតចាស់', () => {
        const { store } = memory(); const cache = createScanImportProofCache(store);
        cache.publish(binding, proof, NOW);
        const changed: any = { ...candidate, [field]: field === 'birth' ? birth + 1 : 'different' };
        expect(cache.lookup(changed, NOW)).toBeNull();
    });
    it('កញ្ចប់ Restore មិនទទួល proof ចាស់ ទោះលេខដដែល', () => {
        const { store } = memory(); const cache = createScanImportProofCache(store);
        cache.publish(binding, proof, NOW);
        expect(cache.lookup({ ...candidate, identity: JSON.stringify(['2026-10-30', birth, '17:00:00 (2026-10-30)', NOW]) }, NOW)).toBeNull();
    });
    it('provider និង identity proof ត្រូវស្មើ binding', () => {
        const { store } = memory(); const cache = createScanImportProofCache(store);
        expect(cache.publish(binding, { ...proof, provider: 'palm' }, NOW)).toBe('hold');
        expect(cache.publish(binding, { ...proof, identity: JSON.stringify(['2026-10-29', birth, '17:00:00', null]) }, NOW)).toBe('hold');
        expect(store.length).toBe(0);
    });
    it('actor ជា provenance៖ publish ខុស actor មិនជំនួស record ចាស់', () => {
        const { store } = memory(); const cache = createScanImportProofCache(store);
        cache.publish(binding, proof, NOW);
        expect(cache.publish({ ...binding, actorUid: 'another-actor' }, proof, NOW)).toBe('hold');
        expect(scanImportBindingMatches(binding, { ...binding, actorUid: 'another-actor' })).toBe(false);
        expect(cache.lookup(candidate, NOW)).toEqual(entry());
    });
    it('observation ថ្មីជាងដែលបានរក្សារួច និង binding ដូចគ្នាអាចបញ្ជាក់បាន មិនសរសេរជាន់', () => {
        const { store } = memory(); const cache = createScanImportProofCache(store);
        const newer = { ...proof, observedAt: NOW - 500, signedAt: NOW - 3000 };
        expect(cache.publish(binding, newer, NOW)).toBe('stored');
        const saved = store.getItem(key());
        expect(cache.publish(binding, proof, NOW)).toBe('stored');
        expect(store.getItem(key())).toBe(saved);
        expect(cache.lookup(candidate, NOW)).toEqual(entry(binding, newer));
    });
    it('observation ថ្មីមិន overwrite record immutable ចាស់ និងម៉ោងស្មើតែសាលក្រមខុស HOLD', () => {
        const { store } = memory(); const cache = createScanImportProofCache(store);
        cache.publish(binding, proof, NOW);
        expect(cache.publish(binding, { ...proof, observedAt: NOW }, NOW)).toBe('hold');
        expect(cache.publish(binding, { ...proof, signedAtExact: false }, NOW)).toBe('hold');
        expect(cache.lookup(candidate, NOW)).toEqual(entry());
    });
    it('TTL ប្រើ observation ដើម៖ ព្រំដែននៅត្រឹមត្រូវ បន្ទាប់មកមិនបន្តអាយុ', () => {
        const { store } = memory(); const cache = createScanImportProofCache(store);
        cache.publish(binding, proof, NOW);
        const boundary = proof.observedAt + SCAN_IMPORT_CACHE_TTL_MS;
        expect(cache.lookup(candidate, boundary)).toEqual(entry());
        expect(cache.lookup(candidate, boundary + 1)).toBeNull();
        expect(cache.publish(binding, proof, boundary + 1)).toBe('expired');
    });
    it('ម៉ោង observation នៅអនាគត HOLD; signedAt ពី server offset មិនប្រៀបជាមួយ local now', () => {
        const { store } = memory(); const cache = createScanImportProofCache(store);
        expect(cache.publish(binding, { ...proof, observedAt: NOW + 1 }, NOW)).toBe('hold');
        expect(cache.publish(binding, { ...proof, signedAt: NOW + 60000 }, NOW)).toBe('stored');
        expect(cache.lookup(candidate, proof.observedAt - 1)).toBeNull();
    });
    for (const bad of [null, [], {}, { ...proof, extra: true }, { ...proof, observedAt: '123' }, { ...proof, observedAt: 1.5 },
        { ...proof, signedAt: NaN }, { ...proof, signedAtExact: 1 }, { ...proof, identity: '[]' }, { ...proof, provider: 'unknown' }]) {
        it('proof malformed ត្រូវបដិសេធ៖ ' + JSON.stringify(bad), () => { expect(scanImportProofValid(bad)).toBe(false); });
    }
    it('binding មិនទទួល shape បន្ថែម ឬ birth មិនស្មើ identity', () => {
        expect(scanImportBindingValid(binding)).toBe(true);
        expect(scanImportBindingValid({ ...binding, birth: birth + 1 })).toBe(false);
        expect(scanImportBindingValid({ ...binding, extra: true })).toBe(false);
        expect(scanImportBindingValid({ ...binding, intent: 'scan_bad' })).toBe(false);
    });
    it('malformed record មិនអាចក្លាយជាសាលក្រម unbound ឬត្រូវ overwrite', () => {
        const { store } = memory(); const cache = createScanImportProofCache(store);
        store.setItem(key(), JSON.stringify({ ...entry(), binding: { ...binding, provider: null } }));
        const bad = store.getItem(key());
        expect(cache.lookup(candidate, NOW)).toBeNull();
        expect(cache.publish(binding, proof, NOW)).toBe('hold');
        expect(store.getItem(key())).toBe(bad);
    });
    it('record សរសេរខុស key មិនអាចត្រូវទុកចិត្ត', () => {
        const { store } = memory(); const cache = createScanImportProofCache(store);
        store.setItem(key(), JSON.stringify(entry({ ...binding, scope: 'other-shop' })));
        expect(cache.lookup(candidate, NOW)).toBeNull();
        expect(cache.publish(binding, proof, NOW)).toBe('hold');
    });
    it('storage ទទេ/បដិសេធ/មិនរក្សា bytes ទុក HOLD មិនបញ្ជាក់ success', () => {
        expect(createScanImportProofCache(null).publish(binding, proof, NOW)).toBe('hold');
        for (const fail of ['read', 'write', 'lost-write', 'enumerate']) {
            const { store } = memory();
            if (fail === 'read') store.getItem = () => { throw new Error('blocked'); };
            if (fail === 'write') store.setItem = () => { throw new Error('quota'); };
            if (fail === 'lost-write') store.setItem = () => {};
            if (fail === 'enumerate') Object.defineProperty(store, 'length', { get() { throw new Error('blocked'); } });
            expect(createScanImportProofCache(store).publish(binding, proof, NOW), fail).toBe('hold');
        }
    });
    it('ពិដាន records មិនលុប fresh record ដើម្បីឱ្យបញ្ចូលថ្មីបាន', () => {
        const { store } = memory(); const cache = createScanImportProofCache(store);
        for (let n = 0; n < SCAN_IMPORT_CACHE_MAX; n++) {
            const b = { ...binding, intent: 'scan_' + n.toString(16).padStart(32, '0') };
            store.setItem(key(b), JSON.stringify(entry(b)));
        }
        expect(cache.publish(binding, proof, NOW)).toBe('hold');
        expect(store.length).toBe(SCAN_IMPORT_CACHE_MAX);
        expect(store.getItem(key())).toBeNull();
    });
    it('prune តែ expired record; legacy map មិនប៉ះ និង clear តែ bound records', () => {
        const { store } = memory(); const cache = createScanImportProofCache(store);
        const oldBinding = { ...binding, intent: 'scan_' + 'b'.repeat(32) };
        store.setItem(key(oldBinding), JSON.stringify(entry(oldBinding, { ...proof, observedAt: NOW - SCAN_IMPORT_CACHE_TTL_MS - 1 })));
        store.setItem('zoew_zto_status', 'legacy-data');
        expect(cache.publish(binding, proof, NOW)).toBe('stored');
        expect(store.getItem(key(oldBinding))).toBeNull();
        expect(cache.clear()).toBe(true);
        expect(store.getItem('zoew_zto_status')).toBe('legacy-data');
    });
    it('newer observation ខុស binding មិនយកជាភស្តុតាង supersession', () => {
        const { store } = memory(); const cache = createScanImportProofCache(store);
        store.setItem(key(), JSON.stringify(entry({ ...binding, actorUid: 'other' }, { ...proof, observedAt: NOW })));
        expect(cache.publish(binding, proof, NOW)).toBe('hold');
    });
    it('record ផ្លាស់ប្ដូរពេល readback ➜ HOLD មិនបញ្ជាក់ persisted', () => {
        const { store } = memory(); const write = store.setItem.bind(store);
        store.setItem = (k, value) => { write(k, value); write(k, JSON.stringify(entry({ ...binding, actorUid: 'foreign' }))); };
        expect(createScanImportProofCache(store).publish(binding, proof, NOW)).toBe('hold');
    });
    it('record ថ្មីកើតក្រោយ preflight ➜ មិនសរសេរជាន់', () => {
        const { store } = memory(); const read = store.getItem.bind(store); let reads = 0;
        const foreign = JSON.stringify(entry({ ...binding, actorUid: 'foreign' }));
        store.getItem = k => {
            if (k === key() && ++reads === 2) store.setItem(k, foreign);
            return read(k);
        };
        expect(createScanImportProofCache(store).publish(binding, proof, NOW)).toBe('hold');
        expect(read(key())).toBe(foreign);
    });
    it('malformed prefix record មិនលុបចោលដើម្បីបង្កើត capacity', () => {
        const { store } = memory(); store.setItem(SCAN_IMPORT_CACHE_PREFIX + 'bad', '{');
        expect(createScanImportProofCache(store).publish(binding, proof, NOW)).toBe('hold');
        expect(store.getItem(SCAN_IMPORT_CACHE_PREFIX + 'bad')).toBe('{');
    });
    it('identity មិន canonical ឬ date ជា array មិនទទួល', () => {
        expect(scanImportProofValid({ ...proof, identity: JSON.stringify([['2026-10-30'], birth, '17:00', null]) })).toBe(false);
        expect(scanImportProofValid({ ...proof, identity: ' ' + identity })).toBe(false);
    });
    it('clear បរាជ័យប្រាប់ false និងរក្សា proof ដែលមិនអាចលុប', () => {
        const { store } = memory(); const cache = createScanImportProofCache(store);
        cache.publish(binding, proof, NOW); store.removeItem = () => {};
        expect(cache.clear()).toBe(false);
        expect(cache.lookup(candidate, NOW)).toEqual(entry());
    });

    it('inspect ចែក absent/malformed/expired/future និង proof មានជីវិតត្រឹមត្រូវ', () => {
        const { store } = memory(); const cache = createScanImportProofCache(store);
        expect(cache.inspect(candidate, NOW)).toEqual({ status: 'absent' });
        cache.publish(binding, proof, NOW);
        expect(cache.inspect(candidate, NOW)).toEqual({ status: 'bound', entry: entry() });
        expect(cache.inspect(candidate, proof.observedAt - 1)).toEqual({ status: 'invalid' });
        expect(cache.inspect(candidate, proof.observedAt + SCAN_IMPORT_CACHE_TTL_MS + 1)).toEqual({ status: 'expired' });
        store.setItem(key(), '{');
        expect(cache.inspect(candidate, NOW)).toEqual({ status: 'invalid' });
        expect(cache.lookup(candidate, NOW)).toBeNull();
    });
    it('inspect lifecycle ផ្សេងមិនរារាំងសាលក្រម network ថ្មីរបស់វា', () => {
        const { store } = memory(); const cache = createScanImportProofCache(store);
        cache.publish(binding, proof, NOW);
        const newBirth = birth + 1;
        expect(cache.inspect({ ...candidate, birth: newBirth, identity: JSON.stringify(['2026-10-30', newBirth, '17:00:01', null]) }, NOW)).toEqual({ status: 'absent' });
        expect(cache.inspect({ ...candidate, identity: JSON.stringify(['2026-10-30', birth, '17:00:00 (2026-10-30)', NOW]) }, NOW)).toEqual({ status: 'absent' });
    });
    it('inspect storage មិនអាចអាន មិនបន្លំជា absent', () => {
        expect(createScanImportProofCache(null).inspect(candidate, NOW)).toEqual({ status: 'invalid' });
    });

});
