import { getServerNow } from '../core/clock';
import { elapsedSince } from '../core/elapsed';
import { dataState, firebaseState, uiState } from '../core/state';
import { appLocalStore, safeStoreGet, safeStoreSet } from '../core/storage';
import { DB_LISTENER_KEY_HISTORY } from '../core/text';
import { isNativeAndroid } from '../platform/native';
import { dbListenerViewIsStale } from '../services/db-listeners';
import { fetchWithTimeout, withTimeout } from '../services/network';
import { LICENSE_APP_CODE } from './license';
import { expiryScheduleTimes, fetchNotifyFeed, openNotifyDrawer } from './notifications';

export type PushStatus = 'unknown' | 'unsupported' | 'needs-install' | 'native-unconfigured' | 'no-license'
    | 'off' | 'busy' | 'on' | 'denied' | 'server-off' | 'error';

export const PUSH_FUNCTION_PATH = '/.netlify/functions/push';
export const PUSH_STATE_KEY = 'zoew_push_v1';
export const PUSH_TIMEOUT_MS = 12000;
export const PUSH_RESYNC_MS = 24 * 60 * 60 * 1000;
export const PUSH_SCHEDULE_MIN_GAP_MS = 10 * 60 * 1000;
export const PUSH_SCHEDULE_REFRESH_MS = 6 * 60 * 60 * 1000;
export const FCM_CHANNEL_ID = 'zoew_notify';
export const PUSH_OPEN_PARAM = 'notify';
export const pushNativeBuild = { fcm: typeof __FCM_CONFIGURED__ !== 'undefined' && __FCM_CONFIGURED__ === true };

export const PUSH_STATUS_TEXT: Record<PushStatus, string> = {
    unknown: '⏳ កំពុងពិនិត្យ…',
    unsupported: '⚠️ Browser នេះមិនគាំទ្រការជូនដំណឹងលើទូរស័ព្ទ',
    'needs-install': '📲 iPhone ៖ ចុច Share ➜ «Add to Home Screen» រួចបើក ZoeW ពីរូបនៅលើអេក្រង់ ទើបបើកការជូនដំណឹងបាន',
    'native-unconfigured': '⚠️ APK នេះមិនទាន់ភ្ជាប់ FCM (google-services.json) — សូមដំឡើង APK ថ្មី',
    'no-license': '⚠️ ឧបករណ៍នេះមិនទាន់ Activate — ការជូនដំណឹងត្រូវការ Activation Key',
    off: 'ការជូនដំណឹងលើទូរស័ព្ទបិទ — បើកវាដើម្បីទទួលដំណឹងពីអ្នកលក់ និងកញ្ចប់ជិតផុតកំណត់ ទោះ App បិទ',
    busy: '⏳ កំពុងភ្ជាប់…',
    on: '✅ បើករួច — ដំណឹងពីអ្នកលក់ និងការរំលឹកកញ្ចប់ជិតផុតកំណត់ (ម៉ោង ៨ ព្រឹក) លោតលើទូរស័ព្ទ ទោះ App បិទ',
    denied: '⛔ ទូរស័ព្ទបដិសេធការជូនដំណឹង — បើកវិញក្នុង Settings របស់ទូរស័ព្ទ ➜ ZoeW ➜ Notifications',
    'server-off': '⚠️ Server មិនទាន់កំណត់ការជូនដំណឹង (VAPID/FCM) — សូមទាក់ទងអ្នកលក់',
    error: '⚠️ បើកការជូនដំណឹងមិនបាន — ពិនិត្យអ៊ីនធឺណិត រួចសាកម្តងទៀត'
};

interface PushSaved {
    on: boolean;
    kind: string;
    syncedAt: number;
    schedSig: string;
    schedAt: number;
}

export const pushRuntime = {
    nativeListeners: false,
    nativeEnabling: false,
    scheduleAttemptAt: 0,
    scheduleInFlight: false
};

function readSaved(): PushSaved {
    let raw: any = null;
    try { raw = JSON.parse(safeStoreGet(appLocalStore, PUSH_STATE_KEY) || 'null'); } catch (e) { raw = null; }
    return {
        on: !!(raw && raw.on === true),
        kind: raw && typeof raw.kind === 'string' ? raw.kind : '',
        syncedAt: raw && typeof raw.syncedAt === 'number' ? raw.syncedAt : 0,
        schedSig: raw && typeof raw.schedSig === 'string' ? raw.schedSig : '',
        schedAt: raw && typeof raw.schedAt === 'number' ? raw.schedAt : 0
    };
}

function writeSaved(patch: Partial<PushSaved>) {
    const next = Object.assign(readSaved(), patch);
    safeStoreSet(appLocalStore, PUSH_STATE_KEY, JSON.stringify(next));
    return next;
}

function setStatus(status: PushStatus) {
    uiState.pushStatus = status;
}

export function pushSupport(): 'native' | 'web' | 'needs-install' | 'native-unconfigured' | 'unsupported' {
    if (isNativeAndroid()) return pushNativeBuild.fcm ? 'native' : 'native-unconfigured';
    try {
        const nav: any = navigator;
        const hasWorker = !!nav && 'serviceWorker' in nav;
        const hasPush = typeof window !== 'undefined' && 'PushManager' in window && 'Notification' in window;
        if (hasWorker && hasPush) return 'web';
        if (nav && nav.standalone === false) return 'needs-install';
        return 'unsupported';
    } catch (e) {
        return 'unsupported';
    }
}

export function activationKey(): string {
    try {
        const lic: any = typeof window !== 'undefined' ? window.ZoeLicense : null;
        if (!lic || typeof lic.activationKeyString !== 'function') return '';
        return String(lic.activationKeyString(LICENSE_APP_CODE) || '');
    } catch (e) {
        return '';
    }
}

export function b64urlToBytes(text: string): Uint8Array {
    const raw = String(text || '').replace(/-/g, '+').replace(/_/g, '/');
    const pad = raw.length % 4 ? '===='.slice(raw.length % 4) : '';
    const bin = atob(raw + pad);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}

function bytesToB64url(buf: ArrayBuffer | null): string {
    if (!buf) return '';
    const bytes = new Uint8Array(buf);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function readReply(res: Response) {
    return res.json().then((body) => ({ status: res.status, body: body }), () => ({ status: res.status, body: null }));
}

export function postPush(op: string, payload: unknown): Promise<{ status: number; body: any }> {
    return fetchWithTimeout(PUSH_FUNCTION_PATH + '?op=' + op, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
    }, PUSH_TIMEOUT_MS, 'Push ' + op + ' timed out', readReply).then((out) => out.body, () => ({ status: 0, body: null }));
}

export function fetchPushConfig(): Promise<{ vapidPublicKey: string; web: boolean; fcm: boolean } | null> {
    return fetchWithTimeout(PUSH_FUNCTION_PATH + '?op=config', { method: 'GET', cache: 'no-store' }, PUSH_TIMEOUT_MS,
        'Push config timed out', readReply).then((out) => {
        const b = out && out.body && out.body.body;
        if (!out || !out.body || out.body.status !== 200 || !b || typeof b !== 'object') return null;
        return { vapidPublicKey: typeof b.vapidPublicKey === 'string' ? b.vapidPublicKey : '', web: b.web === true, fcm: b.fcm === true };
    }, () => null);
}

function replyOk(reply: { status: number; body: any }) {
    return !!(reply && reply.status === 200 && reply.body && reply.body.ok === true);
}

function statusFromReply(reply: { status: number; body: any }): PushStatus {
    const reason = reply && reply.body && typeof reply.body.reason === 'string' ? reply.body.reason : '';
    if (/^(vapid|fcm):unset$/.test(reason)) return 'server-off';
    if (/^license:(format|signature|app|unknown|revoked|expired)$/.test(reason)) return 'no-license';
    return 'error';
}

export function refreshPushStatus() {
    const support = pushSupport();
    if (support === 'unsupported' || support === 'needs-install' || support === 'native-unconfigured') {
        setStatus(support);
        return;
    }
    if (uiState.pushStatus === 'busy') return;
    const saved = readSaved();
    if (support === 'web') {
        let permission = 'default';
        try { permission = Notification.permission; } catch (e) { permission = 'default'; }
        if (permission === 'denied') { setStatus('denied'); return; }
        setStatus(saved.on && permission === 'granted' ? 'on' : 'off');
        return;
    }
    setStatus(saved.on ? 'on' : 'off');
}

async function subscribeWeb(license: string): Promise<PushStatus> {
    const cfg = await fetchPushConfig();
    if (!cfg || !cfg.web || !cfg.vapidPublicKey) return 'server-off';
    const reg: any = await withTimeout(navigator.serviceWorker.ready, PUSH_TIMEOUT_MS, 'Service worker not ready');
    let sub = await reg.pushManager.getSubscription();
    const wantKey = cfg.vapidPublicKey;
    if (sub && sub.options && sub.options.applicationServerKey && bytesToB64url(sub.options.applicationServerKey) !== wantKey) {
        try { await sub.unsubscribe(); } catch (e) {}
        sub = null;
    }
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64urlToBytes(wantKey) });
    const json = sub && typeof sub.toJSON === 'function' ? sub.toJSON() : null;
    if (!json || !json.endpoint || !json.keys) return 'error';
    const nav: any = navigator;
    const reply = await postPush('subscribe', {
        license: license,
        platform: nav.standalone === true ? 'ios' : 'web',
        sub: { kind: 'web', endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } }
    });
    if (!replyOk(reply)) return statusFromReply(reply);
    writeSaved({ on: true, kind: 'web', syncedAt: Date.now() });
    return 'on';
}

function loadNativePush(): Promise<any> {
    return import('@capacitor/push-notifications').then((m) => m.PushNotifications);
}

async function onNativeToken(token: string) {
    const license = activationKey();
    if (!license) { setStatus('no-license'); pushRuntime.nativeEnabling = false; return; }
    const reply = await postPush('subscribe', { license: license, platform: 'android', sub: { kind: 'fcm', token: token } });
    const enabling = pushRuntime.nativeEnabling;
    pushRuntime.nativeEnabling = false;
    if (replyOk(reply)) {
        writeSaved({ on: true, kind: 'fcm', syncedAt: Date.now() });
        setStatus('on');
        syncExpirySchedule(true);
        return;
    }
    if (enabling || uiState.pushStatus !== 'on') setStatus(statusFromReply(reply));
}

export async function ensureNativePushListeners(PN?: any) {
    if (pushRuntime.nativeListeners || !isNativeAndroid() || !pushNativeBuild.fcm) return;
    pushRuntime.nativeListeners = true;
    try {
        const plugin = PN || await loadNativePush();
        await plugin.addListener('registration', (t: any) => { if (t && typeof t.value === 'string') onNativeToken(t.value); });
        await plugin.addListener('registrationError', () => {
            if (pushRuntime.nativeEnabling) { pushRuntime.nativeEnabling = false; setStatus('error'); }
        });
        await plugin.addListener('pushNotificationActionPerformed', () => { openNotifyDrawer(); });
        await plugin.addListener('pushNotificationReceived', () => { fetchNotifyFeed(true); });
    } catch (e) {
        pushRuntime.nativeListeners = false;
    }
}

async function enableNative(): Promise<boolean> {
    const license = activationKey();
    if (!license) { setStatus('no-license'); return false; }
    setStatus('busy');
    try {
        const PN = await loadNativePush();
        let perm = await PN.checkPermissions();
        if (perm.receive !== 'granted' && perm.receive !== 'denied') perm = await PN.requestPermissions();
        if (perm.receive !== 'granted') { setStatus('denied'); return false; }
        await PN.createChannel({
            id: FCM_CHANNEL_ID,
            name: 'ការជូនដំណឹង ZoeW',
            description: 'ដំណឹងពីអ្នកលក់ និងកញ្ចប់ជិតផុតកំណត់',
            importance: 5,
            visibility: 1,
            vibration: true
        });
        await ensureNativePushListeners(PN);
        pushRuntime.nativeEnabling = true;
        await PN.register();
        return true;
    } catch (e) {
        pushRuntime.nativeEnabling = false;
        setStatus('error');
        return false;
    }
}

export function enablePush(): Promise<boolean> {
    const support = pushSupport();
    if (support === 'native') return enableNative();
    if (support !== 'web') { setStatus(support); return Promise.resolve(false); }
    const license = activationKey();
    if (!license) { setStatus('no-license'); return Promise.resolve(false); }
    let permission: Promise<string>;
    try {
        permission = Promise.resolve(Notification.requestPermission());
    } catch (e) {
        permission = Promise.resolve('default');
    }
    setStatus('busy');
    return permission.then((perm) => {
        if (perm !== 'granted') {
            setStatus(perm === 'denied' ? 'denied' : 'off');
            return false;
        }
        return subscribeWeb(license).then((status) => {
            setStatus(status);
            if (status === 'on') syncExpirySchedule(true);
            return status === 'on';
        });
    }).catch(() => {
        setStatus('error');
        return false;
    });
}

export async function disablePush(): Promise<boolean> {
    const support = pushSupport();
    setStatus('busy');
    try {
        if (support === 'web') {
            const reg: any = await withTimeout(navigator.serviceWorker.ready, PUSH_TIMEOUT_MS, 'Service worker not ready');
            const sub = await reg.pushManager.getSubscription();
            if (sub) {
                const json = typeof sub.toJSON === 'function' ? sub.toJSON() : null;
                if (json && json.endpoint && json.keys) {
                    await postPush('unsubscribe', { sub: { kind: 'web', endpoint: json.endpoint, keys: json.keys } });
                }
                try { await sub.unsubscribe(); } catch (e) {}
            }
        } else if (support === 'native') {
            const PN = await loadNativePush();
            try { await PN.unregister(); } catch (e) {}
        }
    } catch (e) {}
    writeSaved({ on: false, kind: '', syncedAt: 0, schedSig: '', schedAt: 0 });
    setStatus('off');
    return true;
}

export function togglePush(): Promise<boolean> {
    if (uiState.pushStatus === 'busy') return Promise.resolve(false);
    return uiState.pushStatus === 'on' ? disablePush() : enablePush();
}

export function resyncPush(): Promise<boolean> {
    refreshPushStatus();
    const saved = readSaved();
    if (!saved.on || uiState.pushStatus !== 'on') return Promise.resolve(false);
    if (elapsedSince(saved.syncedAt) < PUSH_RESYNC_MS) return Promise.resolve(false);
    if ((navigator.onLine as boolean) === false) return Promise.resolve(false);
    const license = activationKey();
    if (!license) return Promise.resolve(false);
    if (pushSupport() === 'native') {
        return loadNativePush().then((PN) => ensureNativePushListeners(PN).then(() => PN.register())).then(() => true, () => false);
    }
    return navigator.serviceWorker.ready.then((reg: any) => reg.pushManager.getSubscription()).then((sub: any) => {
        if (!sub) {
            writeSaved({ on: false, syncedAt: 0 });
            setStatus('off');
            return false;
        }
        const json = sub.toJSON();
        const nav: any = navigator;
        return postPush('subscribe', {
            license: license,
            platform: nav.standalone === true ? 'ios' : 'web',
            sub: { kind: 'web', endpoint: json.endpoint, keys: json.keys }
        }).then((reply) => {
            if (replyOk(reply)) writeSaved({ syncedAt: Date.now() });
            return replyOk(reply);
        });
    }).catch(() => false);
}

export function scheduleSignature(times: number[]): string {
    let h = 0;
    for (let i = 0; i < times.length; i++) {
        const t = Math.floor(times[i] / 60000);
        h = (Math.imul(h, 31) + t) | 0;
    }
    return times.length + ':' + (h >>> 0).toString(36);
}

export function syncExpirySchedule(force?: boolean): Promise<boolean> {
    const saved = readSaved();
    if (!saved.on || pushRuntime.scheduleInFlight) return Promise.resolve(false);
    if (!firebaseState.isDatabaseInitialized || dbListenerViewIsStale(DB_LISTENER_KEY_HISTORY)) return Promise.resolve(false);
    if (!force && elapsedSince(pushRuntime.scheduleAttemptAt) < PUSH_SCHEDULE_MIN_GAP_MS) return Promise.resolve(false);
    const license = activationKey();
    if (!license) return Promise.resolve(false);
    const times = expiryScheduleTimes(dataState.scanHistory, getServerNow());
    const sig = scheduleSignature(times);
    if (!force && sig === saved.schedSig && elapsedSince(saved.schedAt) < PUSH_SCHEDULE_REFRESH_MS) return Promise.resolve(false);
    pushRuntime.scheduleAttemptAt = Date.now();
    pushRuntime.scheduleInFlight = true;
    return postPush('schedule', { license: license, times: times }).then((reply) => {
        pushRuntime.scheduleInFlight = false;
        if (!replyOk(reply)) return false;
        writeSaved({ schedSig: sig, schedAt: Date.now() });
        return true;
    });
}

export function consumePushOpenRequest(): boolean {
    let wants = false;
    try {
        const params = new URLSearchParams(window.location.search || '');
        wants = params.get(PUSH_OPEN_PARAM) === '1';
        if (wants) {
            params.delete(PUSH_OPEN_PARAM);
            const rest = params.toString();
            history.replaceState(null, '', window.location.pathname + (rest ? '?' + rest : '') + window.location.hash);
        }
    } catch (e) { wants = false; }
    if (wants) openNotifyDrawer();
    return wants;
}

export function handleServiceWorkerMessage(data: any) {
    if (!data || typeof data !== 'object') return;
    if (data.type === 'zoew-open-notify') openNotifyDrawer();
    else if (data.type === 'zoew-push') fetchNotifyFeed(true);
}

