import { firebaseState } from './state';

export const PICKUP_DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const pendingHistoryPatches = new Map();

export const HISTORY_PATCH_RETRY_MAX = 5;

export const HISTORY_PATCH_QUEUE_MAX = 50;

export const pendingRegistryReleases = new Map();

export const REGISTRY_RELEASE_RETRY_MAX = 6;

export const REGISTRY_RELEASE_QUEUE_MAX = 500;

export const SERVER_CLOCK_DIVERGENCE_MS = 2000;

export const SERVER_CLOCK_REFRESH_GAP_MS = 30000;

let serverClockSample = null;
let serverClockGeneration = 0;
let serverClockRefresh = null;
let serverClockRefreshAt = -Infinity;

export function setServerClockRefresh(refresh) {
    serverClockRefresh = typeof refresh === 'function' ? refresh : null;
}

function serverClockInterval(sample, monotonicMs, wallMs) {
    const monotonic = monotonicMs - sample.monotonicMs;
    const wall = wallMs - sample.wallMs;
    if (!Number.isFinite(monotonic) || monotonic < 0 || !Number.isFinite(wall) || wall < 0
        || Math.abs(wall - monotonic) > SERVER_CLOCK_DIVERGENCE_MS) return null;
    return { lowerMs: sample.epochMs + Math.min(monotonic, wall), upperMs: sample.epochMs + sample.uncertaintyMs + Math.max(monotonic, wall) };
}

function invalidateServerClock() {
    if (firebaseState.serverClockTrusted) serverClockGeneration++;
    firebaseState.serverClockTrusted = false;
}

export function serverClockIsTrustworthy() {
    const sample = serverClockSample;
    if (sample && sample.database === firebaseState.db) {
        if (!serverClockInterval(sample, performance.now(), Date.now())) invalidateServerClock();
    }
    if (!Number.isFinite(firebaseState.serverTimeOffsetMs)) invalidateServerClock();
    if (!firebaseState.serverClockTrusted && serverClockRefresh) {
        const monotonic = performance.now();
        const now = Number.isFinite(monotonic) ? monotonic : Date.now();
        if (Number.isFinite(now) && (now < serverClockRefreshAt || now - serverClockRefreshAt >= SERVER_CLOCK_REFRESH_GAP_MS)) {
            serverClockRefreshAt = now;
            const refresh = serverClockRefresh;
            Promise.resolve().then(() => {
                if (refresh === serverClockRefresh && sample === serverClockSample && !firebaseState.serverClockTrusted) refresh();
            });
        }
    }
    return firebaseState.serverClockTrusted;
}

export function captureClockOperation() {
    const trusted = serverClockIsTrustworthy();
    const generation = serverClockGeneration;
    const database = firebaseState.db;
    return { current: () => trusted && serverClockIsTrustworthy() && generation === serverClockGeneration && database === firebaseState.db };
}

export function resetServerClock() {
    serverClockGeneration++;
    serverClockSample = null;
    serverClockRefreshAt = -Infinity;
    firebaseState.serverClockTrusted = false;
    firebaseState.serverTimeOffsetMs = 0;
}

export function acceptServerClockOffset(offsetMs, sample, initial) {
    if (!Number.isFinite(offsetMs) || (!(sample && Object.isFrozen(sample)) && !serverClockOffsetIsFromServer(offsetMs))) return false;
    if (sample !== null && sample !== undefined && (typeof sample !== 'object' || Array.isArray(sample))) return false;
    const uncertaintyMs = sample?.uncertaintyMs === undefined ? 0 : sample.uncertaintyMs;
    if (!Number.isFinite(uncertaintyMs) || uncertaintyMs < 0) return false;
    const previous = serverClockSample;
    if (previous && previous.database === firebaseState.db) serverClockIsTrustworthy();
    if (previous && previous.database === firebaseState.db && ((!sample && initial) || sample && previous.source === sample)) return serverClockIsTrustworthy();
    const monotonicMs = sample ? sample.monotonicMs : performance.now();
    const wallMs = sample ? sample.wallMs : Date.now();
    const epochMs = sample ? sample.epochMs : wallMs + offsetMs;
    const defaultEstimate = sample && Object.isFrozen(sample) && ['nonce', 'http-date'].includes(sample.source) ? Math.round(epochMs + uncertaintyMs / 2) : epochMs;
    const estimateEpochMs = sample?.estimateEpochMs === undefined ? defaultEstimate : sample.estimateEpochMs;
    if (!Number.isFinite(estimateEpochMs) || estimateEpochMs < epochMs || estimateEpochMs > epochMs + uncertaintyMs) return false;
    if (!Number.isFinite(monotonicMs) || monotonicMs < 0 || !Number.isFinite(epochMs) || epochMs <= 0 || !Number.isFinite(wallMs)) return false;
    if (sample && previous && previous.database === firebaseState.db && sample.monotonicMs < previous.monotonicMs) return false;
    const providerGeneration = sample && Object.isFrozen(sample) && ['nonce', 'http-date'].includes(sample.source)
        && Number.isSafeInteger(sample.generation) && sample.generation >= 0 ? sample.generation : null;
    if (previous && previous.database === firebaseState.db && previous.providerGeneration !== null
        && providerGeneration !== null && previous.providerGeneration !== providerGeneration) invalidateServerClock();
    const priorInterval = previous && previous.database === firebaseState.db ? serverClockInterval(previous, monotonicMs, wallMs) : null;
    if (priorInterval && firebaseState.serverClockTrusted
        && (epochMs > priorInterval.upperMs + SERVER_CLOCK_DIVERGENCE_MS || epochMs + uncertaintyMs < priorInterval.lowerMs - SERVER_CLOCK_DIVERGENCE_MS)) invalidateServerClock();
    if (!firebaseState.serverClockTrusted && firebaseState.auth?.currentUser
        && firebaseState.sessionExpiryCheck !== 'expired' && firebaseState.sessionExpiryCheck !== 'pending') firebaseState.sessionExpiryCheck = 'unverified';
    serverClockSample = { database: firebaseState.db, epochMs, estimateEpochMs, monotonicMs, wallMs, uncertaintyMs, providerGeneration, source: sample };
    serverClockRefreshAt = -Infinity;
    firebaseState.serverTimeOffsetMs = offsetMs;
    firebaseState.serverClockTrusted = true;
    return serverClockIsTrustworthy();
}

export function getServerClockBounds() {
    if (!serverClockIsTrustworthy()) return null;
    const sample = serverClockSample;
    if (!sample || sample.database !== firebaseState.db) {
        const now = Date.now() + firebaseState.serverTimeOffsetMs;
        return Number.isFinite(now) ? { lowerMs: now, upperMs: now } : null;
    }
    return serverClockInterval(sample, performance.now(), Date.now());
}

export function getServerNow() {
    const sample = serverClockSample;
    if (!sample || sample.database !== firebaseState.db) return Date.now() + firebaseState.serverTimeOffsetMs;
    serverClockIsTrustworthy();
    const elapsed = performance.now() - sample.monotonicMs;
    if (!Number.isFinite(elapsed) || elapsed < 0) {
        invalidateServerClock();
        return sample.estimateEpochMs;
    }
    return sample.estimateEpochMs + Math.floor(elapsed);
}

export function serverClockOffsetIsFromServer(offsetMs) {
    return offsetMs !== 0 || firebaseState.isDatabaseConnected || firebaseState.hasEverConnectedToDatabase;
}

export function cleanupClockIsTrustworthy() {
    return serverClockIsTrustworthy() && firebaseState.isDatabaseConnected;
}
