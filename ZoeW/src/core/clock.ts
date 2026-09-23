import { firebaseState } from './state';
import { appLocalStore, safeStoreGet } from './storage';

export const PICKUP_DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const pendingHistoryPatches = new Map();

export const HISTORY_PATCH_RETRY_MAX = 5;

export const HISTORY_PATCH_QUEUE_MAX = 50;

export const pendingRegistryReleases = new Map();

export const REGISTRY_RELEASE_RETRY_MAX = 6;

export const REGISTRY_RELEASE_QUEUE_MAX = 500;

export function getServerNow() {
    return Date.now() + firebaseState.serverTimeOffsetMs;
}

export function serverClockOffsetIsFromServer(offsetMs) {
    return offsetMs !== 0 || firebaseState.isDatabaseConnected || firebaseState.hasEverConnectedToDatabase;
}

export function cleanupClockIsTrustworthy() {
    return firebaseState.serverClockTrusted && firebaseState.isDatabaseConnected;
}
