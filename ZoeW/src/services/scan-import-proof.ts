export const SCAN_IMPORT_CACHE_PREFIX = 'zoew_scan_import_proof_v1:';
export const SCAN_IMPORT_CACHE_TTL_MS = 3 * 24 * 60 * 60 * 1000;
export const SCAN_IMPORT_CACHE_MAX = 2000;

export type ScanImportProof = {
    v: 1; provider: 'palm' | 'cookie'; observedAt: number; signedAt: number; signedAtExact: boolean; identity: string;
};
export type ScanImportBinding = {
    v: 1; provider: 'palm' | 'cookie'; scope: string; actorUid: string; intent: string; code: string; birth: number; identity: string;
};
export type ScanImportCandidate = { scope: string; intent: string; code: string; birth: number; identity: string };
export type ScanImportCacheEntry = {
    closed: true; at: number; signedAt: number; signedAtExact: boolean; binding: ScanImportBinding;
};

export type ScanImportCacheRead = { status: 'bound'; entry: ScanImportCacheEntry }
    | { status: 'absent' | 'invalid' | 'expired'; entry?: undefined };

const exact = (value: unknown, keys: string[]): value is Record<string, any> => !!value && typeof value === 'object'
    && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(key => Object.prototype.hasOwnProperty.call(value, key));
const text = (value: unknown, max: number): value is string => typeof value === 'string' && value.length > 0 && value.length <= max;
const stamp = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0;
const provider = (value: unknown) => value === 'palm' || value === 'cookie';
const identityBirth = (value: unknown): number | null => {
    if (!text(value, 2048)) return null;
    try {
        const parts = JSON.parse(value);
        return Array.isArray(parts) && parts.length === 4 && typeof parts[0] === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parts[0])
            && stamp(parts[1]) && text(parts[2], 256) && parts[3] === null && JSON.stringify(parts) === value ? parts[1] : null;
    } catch (e) { return null; }
};

export function scanImportProofValid(value: unknown): value is ScanImportProof {
    return exact(value, ['v', 'provider', 'observedAt', 'signedAt', 'signedAtExact', 'identity']) && value.v === 1
        && provider(value.provider) && stamp(value.observedAt) && stamp(value.signedAt)
        && typeof value.signedAtExact === 'boolean' && identityBirth(value.identity) !== null;
}

export function scanImportBindingValid(value: unknown): value is ScanImportBinding {
    return exact(value, ['v', 'provider', 'scope', 'actorUid', 'intent', 'code', 'birth', 'identity']) && value.v === 1
        && provider(value.provider) && text(value.scope, 2048) && text(value.actorUid, 2048) && text(value.code, 256)
        && typeof value.intent === 'string' && /^scan_[a-f0-9]{32}$/.test(value.intent)
        && stamp(value.birth) && identityBirth(value.identity) === value.birth;
}

export function scanImportBindingMatches(left: unknown, right: unknown): boolean {
    return scanImportBindingValid(left) && scanImportBindingValid(right)
        && Object.keys(left).every(key => left[key] === right[key]);
}

export function scanImportCacheEntryValid(value: unknown): value is ScanImportCacheEntry {
    return exact(value, ['closed', 'at', 'signedAt', 'signedAtExact', 'binding']) && value.closed === true
        && stamp(value.at) && stamp(value.signedAt) && typeof value.signedAtExact === 'boolean' && scanImportBindingValid(value.binding);
}

function candidateValid(value: unknown): value is ScanImportCandidate {
    return exact(value, ['scope', 'intent', 'code', 'birth', 'identity']) && text(value.scope, 2048) && text(value.code, 256)
        && typeof value.intent === 'string' && /^scan_[a-f0-9]{32}$/.test(value.intent)
        && stamp(value.birth) && identityBirth(value.identity) === value.birth;
}

const keyOf = (value: { scope: string; intent: string }) => SCAN_IMPORT_CACHE_PREFIX + encodeURIComponent(value.scope) + ':' + value.intent;
const ageOf = (at: number, now: number) => stamp(now) && now >= at ? now - at : null;

export function createScanImportProofCache(storage: Storage | null | undefined) {
    const read = (key: string) => {
        if (!storage) throw new Error('Import proof storage unavailable');
        return storage.getItem(key);
    };
    const keys = () => {
        if (!storage) throw new Error('Import proof storage unavailable');
        const result = new Set<string>();
        for (let index = 0; index < storage.length; index++) {
            const key = storage.key(index);
            if (key?.startsWith(SCAN_IMPORT_CACHE_PREFIX)) result.add(key);
        }
        return [...result];
    };
    const parse = (raw: string | null) => {
        if (raw === null) return null;
        try { return JSON.parse(raw); } catch (e) { return null; }
    };
    const validStored = (key: string, entry: unknown): entry is ScanImportCacheEntry => scanImportCacheEntryValid(entry) && keyOf(entry.binding) === key;
    const count = (now: number) => {
        let live = 0;
        for (const key of keys()) {
            const raw = read(key);
            if (raw === null) continue;
            const entry = parse(raw);
            if (!validStored(key, entry)) throw new Error('Import proof storage malformed');
            const age = ageOf(entry.at, now);
            if (age !== null && age > SCAN_IMPORT_CACHE_TTL_MS) {
                if (read(key) === raw) storage!.removeItem(key);
                if (read(key) !== null) live++;
            } else live++;
        }
        return live;
    };
    const inspect = (candidate: ScanImportCandidate, now = Date.now()): ScanImportCacheRead => {
        if (!candidateValid(candidate)) return { status: 'absent' };
        try {
            const key = keyOf(candidate);
            const raw = read(key);
            if (raw === null) return { status: 'absent' };
            const entry = parse(raw);
            if (!validStored(key, entry)) return { status: 'invalid' };
            if (!Object.keys(candidate).every(field => candidate[field] === entry.binding[field])) return { status: 'absent' };
            const age = ageOf(entry.at, now);
            if (age === null) return { status: 'invalid' };
            return age <= SCAN_IMPORT_CACHE_TTL_MS ? { status: 'bound', entry } : { status: 'expired' };
        } catch (e) { return { status: 'invalid' }; }
    };
    return {
        inspect,
        publish(binding: ScanImportBinding, proof: ScanImportProof, now = Date.now()): 'stored' | 'expired' | 'hold' {
            if (!scanImportBindingValid(binding) || !scanImportProofValid(proof)
                || proof.identity !== binding.identity || proof.provider !== binding.provider) return 'hold';
            const age = ageOf(proof.observedAt, now);
            if (age === null) return 'hold';
            if (age > SCAN_IMPORT_CACHE_TTL_MS) return 'expired';
            const entry: ScanImportCacheEntry = { closed: true, at: proof.observedAt, signedAt: proof.signedAt, signedAtExact: proof.signedAtExact,
                binding: { v: 1, provider: binding.provider, scope: binding.scope, actorUid: binding.actorUid, intent: binding.intent,
                    code: binding.code, birth: binding.birth, identity: binding.identity } };
            const encoded = JSON.stringify(entry);
            try {
                const key = keyOf(binding);
                const existing = read(key);
                if (existing !== null) {
                    const saved = parse(existing);
                    if (existing !== encoded && !(validStored(key, saved) && scanImportBindingMatches(saved.binding, binding)
                        && saved.at > proof.observedAt && ageOf(saved.at, now) !== null)) return 'hold';
                    return read(key) === existing ? 'stored' : 'hold';
                }
                if (count(now) >= SCAN_IMPORT_CACHE_MAX || read(key) !== null) return 'hold';
                storage!.setItem(key, encoded);
                return read(key) === encoded && count(now) <= SCAN_IMPORT_CACHE_MAX && read(key) === encoded ? 'stored' : 'hold';
            } catch (e) { return 'hold'; }
        },
        lookup(candidate: ScanImportCandidate, now = Date.now()): ScanImportCacheEntry | null {
            const result = inspect(candidate, now);
            return result.status === 'bound' ? result.entry : null;
        },
        clear(): boolean {
            try {
                for (const key of keys()) storage!.removeItem(key);
                return keys().length === 0;
            } catch (e) { return false; }
        }
    };
}
