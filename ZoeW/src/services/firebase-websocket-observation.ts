import { firebaseState } from '../core/state';
import { elapsedSince } from '../core/elapsed';
import { healthDatabaseRead } from '../features/health-database-read';
import { isSupabaseConfig } from './supabase-config';

export const FIREBASE_WEBSOCKET_WAIT_MS = 20000;
export const FIREBASE_WEBSOCKET_RECHECK_MS = 30000;
export const FIREBASE_WEBSOCKET_BLOCKED_TEXT = 'បណ្ដាញនេះបិទ WebSocket — សូមប្តូរ Wi-Fi ឬប្រើ 4G';

type Observation = {
    database: any; sdk: any; epoch: number; uid: string; url: string;
    connectedOnce: boolean; blocked: boolean; pending: boolean; verifiedAt: number;
    timer: ReturnType<typeof setTimeout> | null; notify: () => void;
};
let websocketObservation: Observation | null = null;

function observationIsCurrent(observation: Observation) {
    return websocketObservation === observation && firebaseState.db === observation.database && firebaseState.fb === observation.sdk
        && firebaseState.authGeneration === observation.epoch && firebaseState.auth?.currentUser?.uid === observation.uid
        && firebaseState.firebaseConfig?.databaseURL === observation.url && !isSupabaseConfig(firebaseState.firebaseConfig)
        && !firebaseState.firebaseSdkUnavailable && (navigator.onLine as boolean) !== false;
}

function stopObservation() {
    if (websocketObservation?.timer !== null && websocketObservation?.timer !== undefined) clearTimeout(websocketObservation.timer);
    websocketObservation = null;
}

function scheduleObservation(observation: Observation, delay: number) {
    observation.timer = setTimeout(async () => {
        observation.timer = null;
        if (!observationIsCurrent(observation) || observation.connectedOnce || firebaseState.isDatabaseConnected) return;
        observation.pending = true;
        observation.blocked = false;
        observation.notify();
        let readable = false;
        try { readable = await healthDatabaseRead() === true; } catch (e) {}
        if (!observationIsCurrent(observation) || observation.connectedOnce || firebaseState.isDatabaseConnected) return;
        observation.pending = false;
        observation.blocked = readable;
        observation.verifiedAt = readable ? Date.now() : 0;
        scheduleObservation(observation, FIREBASE_WEBSOCKET_RECHECK_MS);
        observation.notify();
    }, delay);
}

export function watchFirebaseWebsocket(notify: () => void) {
    const uid = firebaseState.auth?.currentUser?.uid;
    const url = firebaseState.firebaseConfig?.databaseURL;
    if (!firebaseState.db || typeof firebaseState.fb?.ref !== 'function' || !uid || !url || isSupabaseConfig(firebaseState.firebaseConfig)
        || firebaseState.firebaseSdkUnavailable || (navigator.onLine as boolean) === false) {
        stopObservation(); return;
    }
    if (websocketObservation && !observationIsCurrent(websocketObservation)) stopObservation();
    if (!websocketObservation) {
        websocketObservation = { database: firebaseState.db, sdk: firebaseState.fb, epoch: firebaseState.authGeneration, uid, url,
            connectedOnce: firebaseState.isDatabaseConnected || firebaseState.hasEverConnectedToDatabase,
            blocked: false, pending: false, verifiedAt: 0, timer: null, notify };
    }
    const observation = websocketObservation;
    observation.notify = notify;
    if (firebaseState.isDatabaseConnected) {
        observation.connectedOnce = true;
        observation.blocked = false;
        if (observation.timer !== null) clearTimeout(observation.timer);
        observation.timer = null;
    }
    if (!observation.connectedOnce && !observation.pending && observation.timer === null) scheduleObservation(observation, FIREBASE_WEBSOCKET_WAIT_MS);
}

export function firebaseWebsocketIsBlocked() {
    const observation = websocketObservation;
    if (!observation || !observationIsCurrent(observation) || !observation.blocked || observation.connectedOnce || firebaseState.isDatabaseConnected) return false;
    return elapsedSince(observation.verifiedAt) <= FIREBASE_WEBSOCKET_RECHECK_MS;
}
