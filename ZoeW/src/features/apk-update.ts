import { elapsedSince } from '../core/elapsed';
import { uiState } from '../core/state';
import { documentIsHidden } from '../platform/document-io';
import { isNativeAndroid } from '../platform/native';
import { withTimeout } from '../services/network';
import { noteAppLockExcuse } from './app-lock';

export const APK_PLUGIN_NAME = 'ZoeApkUpdate';
export const APK_PROBE_TIMEOUT_MS = 20000;
export const APK_RELEASE_RECHECK_MS = 2 * 60 * 1000;
export const APK_RELEASE_RETRY_MS = 30 * 1000;
export const APK_DOWNLOAD_STALL_MS = 45000;
export const APK_STALL_TICK_MS = 1000;
export const APK_INSTALL_TIMEOUT_MS = 3 * 60 * 1000;

const APK_VERSION_RE = /^\d{1,4}\.\d{1,4}\.\d{1,4}$/;

export type ApkReleaseState = { version: string; state: 'idle' | 'checking' | 'ready' | 'absent' | 'failed'; checkedAt: number };
export type ApkUpdatePhase = 'idle' | 'download' | 'install' | 'opened' | 'denied' | 'error';
export type ApkUpdateState = { phase: ApkUpdatePhase; version: string; received: number; total: number; error: string };

export const APK_ERROR_TEXT: Record<string, string> = {
    network: '⚠️ បណ្តាញដាច់ ឬយឺតពេក — សូមចុចទាញយកម្តងទៀត',
    stalled: '⚠️ ការទាញយកឈប់រីក — សូមពិនិត្យបណ្តាញ ហើយចុចម្តងទៀត',
    http: '⚠️ GitHub ឆ្លើយមិនប្រក្រតី — សូមចុចម្តងទៀតបន្តិចទៀត',
    size: '⚠️ ឯកសារទាញមកមិនពេញ — សូមចុចម្តងទៀត',
    'bad-apk': '⚠️ ឯកសារដែលទាញមកមិនមែន APK ZoeW កំណែនេះ — សូមចុចម្តងទៀត',
    storage: '⚠️ ទំហំផ្ទុកក្នុងទូរស័ព្ទមិនគ្រប់ — សូមលុបឯកសារខ្លះ ហើយចុចម្តងទៀត',
    'no-installer': '⚠️ ទូរស័ព្ទនេះបើកផ្ទាំងដំឡើង APK មិនបាន',
    failed: '⚠️ ទាញយក ឬដំឡើង APK មិនបាន — សូមចុចម្តងទៀត'
};

let pluginLoad: Promise<{ AU: any }> | null = null;
let updateSeq = 0;

function loadApkPlugin(): Promise<{ AU: any }> {
    if (!pluginLoad) {
        pluginLoad = import('@capacitor/core').then((m) => ({ AU: m.registerPlugin(APK_PLUGIN_NAME) }));
        pluginLoad.catch(() => { pluginLoad = null; });
    }
    return pluginLoad;
}

function setApkUpdate(patch: Partial<ApkUpdateState>) {
    uiState.apkUpdate = { ...uiState.apkUpdate, ...patch };
}

function errorCodeOf(e: any): string {
    const code = e && typeof e.code === 'string' ? e.code : '';
    return code || 'failed';
}

function finiteBytes(n: any): number {
    const v = Number(n);
    return Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
}

export function checkApkRelease(version: string, force?: boolean): Promise<void> {
    if (!isNativeAndroid() || typeof version !== 'string' || !APK_VERSION_RE.test(version)) return Promise.resolve();
    const cur = uiState.apkRelease;
    if (cur.version === version) {
        if (cur.state === 'checking' || cur.state === 'ready') return Promise.resolve();
        if (force) return probeApkRelease(version);
        const gap = cur.state === 'absent' ? APK_RELEASE_RECHECK_MS : APK_RELEASE_RETRY_MS;
        if (elapsedSince(cur.checkedAt) < gap) return Promise.resolve();
    }
    return probeApkRelease(version);
}

function probeApkRelease(version: string): Promise<void> {
    uiState.apkRelease = { version: version, state: 'checking', checkedAt: Date.now() };
    return withTimeout(loadApkPlugin().then(({ AU }) => AU.probe({ version: version })), APK_PROBE_TIMEOUT_MS, 'APK release probe timed out')
        .then((res: any) => (res && res.available === true ? 'ready' : res && res.available === false ? 'absent' : 'failed'), () => 'failed')
        .then((state) => {
            if (uiState.apkRelease.version !== version) return;
            uiState.apkRelease = { version: version, state: state as ApkReleaseState['state'], checkedAt: Date.now() };
        });
}

function markReleaseAbsent(version: string) {
    if (uiState.apkRelease.version === version) uiState.apkRelease = { version: version, state: 'absent', checkedAt: Date.now() };
}

async function downloadWithStallGuard(AU: any, version: string, seq: number): Promise<any> {
    let lastProgressAt = Date.now();
    let handle: any = null;
    const onProgress = (e: any) => {
        if (seq !== updateSeq || !e || e.version !== version) return;
        lastProgressAt = Date.now();
        setApkUpdate({ received: finiteBytes(e.received), total: finiteBytes(e.total) });
    };
    try {
        handle = await withTimeout(Promise.resolve().then(() => AU.addListener('progress', onProgress)), APK_PROBE_TIMEOUT_MS, 'APK progress listener timed out');
    } catch (e) {
        handle = null;
    }
    let timer: any = 0;
    let settled = false;
    const stalled = new Promise((_, reject) => {
        const tick = () => {
            if (settled) return;
            if (documentIsHidden()) lastProgressAt = Date.now();
            if (elapsedSince(lastProgressAt) < APK_DOWNLOAD_STALL_MS) {
                timer = setTimeout(tick, APK_STALL_TICK_MS);
                return;
            }
            Promise.resolve().then(() => AU.cancel()).catch(() => {});
            reject(Object.assign(new Error('APK download stalled'), { code: 'stalled' }));
        };
        timer = setTimeout(tick, APK_STALL_TICK_MS);
    });
    try {
        return await Promise.race([Promise.resolve().then(() => AU.download({ version: version })), stalled]);
    } finally {
        settled = true;
        clearTimeout(timer);
        if (handle && typeof handle.remove === 'function') Promise.resolve().then(() => handle.remove()).catch(() => {});
    }
}

async function openInstaller(AU: any, version: string): Promise<'opened' | 'denied'> {
    for (let round = 0; round < 2; round++) {
        noteAppLockExcuse();
        const res: any = await withTimeout(Promise.resolve().then(() => AU.install({ version: version })), APK_INSTALL_TIMEOUT_MS, 'APK install timed out');
        const status = res && res.status;
        if (status === 'opened') return 'opened';
        if (status !== 'permission-granted') return 'denied';
    }
    return 'denied';
}

export async function startApkUpdate(version?: string): Promise<void> {
    const v = String(version || '');
    if (!isNativeAndroid() || !APK_VERSION_RE.test(v)) return;
    const rel = uiState.apkRelease;
    if (rel.version !== v || rel.state !== 'ready') return;
    const phase = uiState.apkUpdate.phase;
    if (phase === 'download' || phase === 'install') return;
    const seq = ++updateSeq;
    uiState.apkUpdate = { phase: 'download', version: v, received: 0, total: 0, error: '' };
    try {
        const { AU } = await withTimeout(loadApkPlugin(), APK_PROBE_TIMEOUT_MS, 'APK plugin load timed out');
        await downloadWithStallGuard(AU, v, seq);
        if (seq !== updateSeq) return;
        setApkUpdate({ phase: 'install' });
        const result = await openInstaller(AU, v);
        if (seq !== updateSeq) return;
        setApkUpdate({ phase: result, error: '' });
    } catch (e) {
        if (seq !== updateSeq) return;
        const code = errorCodeOf(e);
        if (code === 'cancelled') {
            setApkUpdate({ phase: 'idle', error: '' });
            return;
        }
        if (code === 'not-found') {
            setApkUpdate({ phase: 'idle', error: '' });
            markReleaseAbsent(v);
            return;
        }
        setApkUpdate({ phase: 'error', error: APK_ERROR_TEXT[code] ? code : 'failed' });
    }
}

export function cancelApkUpdate(): Promise<void> {
    if (uiState.apkUpdate.phase !== 'download') return Promise.resolve();
    return withTimeout(loadApkPlugin(), APK_PROBE_TIMEOUT_MS, 'APK plugin load timed out')
        .then(({ AU }) => AU.cancel())
        .then(() => {}, () => {});
}
