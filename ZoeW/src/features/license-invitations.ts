import { firebaseState, securityState } from '../core/state';
import { viewState } from '../core/view-state';
import { openModalIds } from '../core/modals';
import { appLocalStore, safeStoreGet, safeStoreSet, safeStoreRemove } from '../core/storage';
import { captureAuthDatabaseGuard } from './exchange-rate';
import { isNativeAndroid, isNativeApp } from '../platform/native';
import { openModalHelper } from '../ui/modal';
import { proceedAfterLogin } from './license';
import { fetchWithTimeout } from '../services/network';

const ENDPOINT = 'https://zoew.netlify.app/.netlify/functions/license-invitations';
const AUDIENCE = 'https://zoew.netlify.app';
const PREFIX = 'zoew_license_invitation_v1:';
const STEPS = [3000, 5000, 10000, 15000, 30000, 60000];
type Enrollment = { payload: string; signature: string; fingerprint: string };
type Pending = { inviteId: string; target: string; expiresAt: number; enrollment: Enrollment; requestId?: string; verificationCode?: string; paused?: boolean };
let operation: { current: () => boolean; abort: AbortController; storageKey?: string } | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let attempt = 0;
let activationOwner: typeof operation = null;
let pendingLink: { code: string; at: number } | null = null;
let pendingStorageKey: string | null = null;

export function invitationTarget(): 'apk' | 'pwa' | null {
    if (isNativeAndroid()) return 'apk';
    if (isNativeApp()) return null;
    return navigator.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches ? 'pwa' : null;
}

export function parseInvitationCode(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const code = value.trim().toUpperCase();
    return /^[A-Z0-9]{16,40}\.[0-9A-HJKMNP-TV-Z]{16}$/.test(code) ? code : null;
}

function stopLicenseInvitation(pausePending: boolean) {
    if (timer) clearTimeout(timer);
    timer = null;
    const key = operation?.storageKey || pendingStorageKey;
    if (pausePending && key) {
        const saved = readPending(key);
        if (saved) safeStoreSet(appLocalStore, key, JSON.stringify({ ...saved, paused: true }));
    }
    if (pausePending) pendingStorageKey = null;
    if (activationOwner === operation && activationOwner) { viewState.activationBusy = false; activationOwner = null; }
    operation?.abort.abort();
    operation = null;
    viewState.invitationBusy = false;
    viewState.invitationVerificationCode = '';
    viewState.invitationMessage = '';
}

export function cancelLicenseInvitation() {
    stopLicenseInvitation(true);
}

export function editLicenseInvitation(input: { value?: string }) {
    cancelLicenseInvitation();
    viewState.invitationCode = typeof input?.value === 'string' ? input.value.slice(0, 64) : '';
}

export function clearLicenseInvitationIntent() {
    pendingLink = null;
    viewState.invitationCode = '';
}

export function restoreLicenseInvitationIntent() {
    if (!pendingLink) return false;
    if (performance.now() - pendingLink.at > 15 * 60 * 1000 || performance.now() < pendingLink.at) { pendingLink = null; return false; }
    if (viewState.backendKind !== 'firebase' || !firebaseState.auth?.currentUser || securityState.appIsLocked || securityState.pinTargetAction || openModalIds().some(id => id !== 'loginModal' && id !== 'activationModal')) return false;
    viewState.invitationCode = pendingLink.code;
    pendingLink = null;
    return true;
}

export function routeLicenseInvitation() {
    const match = /^#license-invite=([^&]+)$/.exec(window.location.hash || '');
    if (!match) return;
    window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search);
    cancelLicenseInvitation();
    const code = parseInvitationCode(match[1]);
    viewState.invitationCode = code || '';
    pendingLink = code ? { code, at: performance.now() } : null;
    viewState.invitationMessage = code
        ? 'សូមបើក App ដែលបានដំឡើង រួចបញ្ចូលលេខកូដអញ្ជើញនេះ។ សម្រាប់ Android សូមបើក APK ហើយបិទភ្ជាប់លេខកូដនៅប្រអប់អាជ្ញាប័ណ្ណ។'
        : 'លេខកូដអញ្ជើញមិនត្រឹមត្រូវទេ។ សូមស្នើលេខថ្មីពីអ្នកលក់។';
    if (restoreLicenseInvitationIntent()) {
        viewState.seatEnrollmentOnly = true;
        openModalHelper('activationModal');
    }
}

async function storageKey(inviteId: string, target: string) {
    const scope = JSON.stringify([firebaseState.auth?.currentUser?.uid, safeStoreGet(appLocalStore, 'zoew_firebase_config'), inviteId, target]);
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(scope));
    return PREFIX + Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
}

function readPending(key: string): Pending | null {
    try {
        const value = JSON.parse(safeStoreGet(appLocalStore, key) || 'null');
        if (!value || !parseInvitationCode(value.inviteId) || !['pwa', 'apk'].includes(value.target) || !Number.isSafeInteger(value.expiresAt) ||
            typeof value.enrollment?.payload !== 'string' || typeof value.enrollment?.signature !== 'string' || !/^[a-f0-9]{64}$/.test(value.enrollment?.fingerprint)) return null;
        return value;
    } catch { return null; }
}

async function post(body: unknown, signal: AbortSignal) {
    const result = await fetchWithTimeout(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal, credentials: 'omit', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer' }, 45000, 'invitation-unavailable', async response => {
        if (!response.ok) {
            if (response.status === 410 || response.status === 503) {
                let failure;
                try { failure = await response.json(); } catch { }
                if (response.status === 410 && failure?.reason === 'invitation-unavailable') throw new Error('invitation-terminal');
                if (response.status === 503 && failure?.reason === 'invitation-disabled') throw new Error('invitation-disabled');
            }
            throw new Error('invitation-unavailable');
        }
        return response.json();
    });
    return result.body;
}

function trustedNow() {
    const now = ZoeLicense?.getTrustedServerNow?.();
    if (typeof now !== 'number' || !Number.isFinite(now) || now < 1 || now > Number.MAX_SAFE_INTEGER - 60000) throw new Error('invitation-clock');
    return Math.floor(now);
}

async function enrollmentBinding(enrollment: Enrollment) {
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify({ payload: enrollment.payload, signature: enrollment.signature })));
    const requestId = Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
    return { requestId, verificationCode: String(BigInt('0x' + requestId) % BigInt(100000000)).padStart(8, '0') };
}

function client() { return (window as any).ZoeSeatClient; }

export async function requestLicenseInvitation(resumeOnly = false) {
    if (operation?.current() || viewState.activationBusy || viewState.seatEnrollmentBusy || viewState.backendKind !== 'firebase' || !firebaseState.auth?.currentUser || !openModalIds().includes('activationModal')) return;
    const inviteId = parseInvitationCode(viewState.invitationCode);
    const target = invitationTarget();
    if (!inviteId || !target) {
        if (!resumeOnly) viewState.invitationMessage = 'សូមបើក PWA ដែលបានដំឡើង ឬ APK រួចបញ្ចូលលេខកូដអញ្ជើញពីអ្នកលក់។';
        return;
    }
    stopLicenseInvitation(false);
    const authCurrent = captureAuthDatabaseGuard();
    const config = safeStoreGet(appLocalStore, 'zoew_firebase_config');
    const epoch = viewState.seatEnrollmentEpoch;
    const input = viewState.invitationCode;
    const op = { current: () => operation === op && !op.abort.signal.aborted && authCurrent() && viewState.backendKind === 'firebase' && viewState.seatEnrollmentEpoch === epoch &&
        viewState.invitationCode === input && invitationTarget() === target && openModalIds().includes('activationModal') && safeStoreGet(appLocalStore, 'zoew_firebase_config') === config,
        abort: new AbortController(), storageKey: '' };
    operation = op;
    const deadline = setTimeout(() => {
        const owned = op.current();
        op.abort.abort();
        if (owned) {
            viewState.invitationBusy = false;
            viewState.invitationMessage = 'ការរង់ចាំយូរពេក។ សូមពិនិត្យអ៊ីនធឺណិត រួចចុចសាកម្ដងទៀត។';
        }
        if (activationOwner === op) { viewState.activationBusy = false; activationOwner = null; }
    }, 45000);
    viewState.invitationBusy = true;
    let pending: Pending | null = null;
    let persisted = false;
    try {
        op.storageKey = await storageKey(inviteId, target);
        if (!op.current()) return;
        pending = readPending(op.storageKey);
        if (!pending && safeStoreGet(appLocalStore, op.storageKey) !== null) throw new Error('invitation-storage-corrupt');
        if (resumeOnly && (!pending || pending.paused)) return;
        if (!ZoeLicense?.getTrustedServerNow?.()) await ZoeLicense?.syncServerTime?.({ priority: true });
        if (!op.current()) return;
        trustedNow();
        const keyId = inviteId.split('.')[0];
        if (!pending) {
            const opened = await post({ action: 'open', inviteId }, op.abort.signal);
            if (!op.current()) return;
            if (opened.scope?.inviteId !== inviteId || opened.scope?.target !== target || !Number.isSafeInteger(opened.scope?.expiresAt) || opened.scope.expiresAt <= trustedNow()) throw new Error('invitation-target');
            await client().createIdentity('ZOE', keyId);
            if (!op.current()) return;
            const enrollment = await client().invitationEnrollmentRequest('ZOE', keyId, inviteId, target);
            if (!op.current()) return;
            pending = { inviteId, target, expiresAt: opened.scope.expiresAt, enrollment };
        }
        if (pending.inviteId !== inviteId || pending.target !== target || pending.expiresAt <= trustedNow()) throw new Error('invitation-expired');
        const identity = await client().loadIdentity('ZOE', keyId);
        const fingerprint = identity && await client().fingerprint(identity.publicKey);
        if (!op.current()) return;
        if (fingerprint !== pending.enrollment.fingerprint) throw new Error('invitation-identity');
        pending.paused = false;
        const persist = () => {
            const serialized = JSON.stringify(pending);
            if (!safeStoreSet(appLocalStore, op.storageKey, serialized) || safeStoreGet(appLocalStore, op.storageKey) !== serialized) throw new Error('invitation-storage');
            pendingStorageKey = op.storageKey;
            persisted = true;
        };
        persist();
        const indexKey = await storageKey('', target);
        if (!op.current()) return;
        if (!safeStoreSet(appLocalStore, indexKey, inviteId)) throw new Error('invitation-storage');
        const binding = await enrollmentBinding(pending.enrollment);
        if (!op.current()) return;
        if (pending.requestId && pending.requestId !== binding.requestId) throw new Error('invitation-storage-corrupt');
        const action = pending.requestId ? 'status' : 'submit';
        const signed = await client().signInvitationCommand('ZOE', keyId, {
            domain: 'zoe-license-invitation-v1', audience: AUDIENCE, app: 'ZOE', keyId, inviteId, action, expiresAt: trustedNow() + 45000,
            ...(pending.requestId ? { requestId: pending.requestId } : { enrollment: { payload: pending.enrollment.payload, signature: pending.enrollment.signature } })
        });
        if (!op.current()) return;
        const result = await post(signed, op.abort.signal);
        if (!op.current()) return;
        if (result.requestId !== binding.requestId || result.verificationCode !== binding.verificationCode) throw new Error('invitation-result');
        if (result.status === 'rejected' || result.status === 'expired' || result.status === 'cancelled') {
            pending.paused = true; persist();
            viewState.invitationMessage = 'សំណើនេះត្រូវបានបដិសេធ បោះបង់ ឬផុតកំណត់។ សូមទាក់ទងអ្នកលក់។';
            return;
        }
        if (result.status === 'approved' && action === 'submit') {
            pending.requestId = binding.requestId;
            pending.verificationCode = binding.verificationCode;
            persist();
            timer = setTimeout(() => {
                timer = null;
                if (!op.current()) return;
                operation = null;
                void requestLicenseInvitation(true);
            }, 0);
            return;
        }
        if (result.status === 'approved' && pending.requestId) {
            if (typeof result.keyString !== 'string' || !result.keyString.startsWith('ZOEKEY-')) throw new Error('invitation-result');
            const latestIdentity = await client().loadIdentity('ZOE', keyId);
            const latestFingerprint = latestIdentity && await client().fingerprint(latestIdentity.publicKey);
            if (!op.current()) return;
            if (latestFingerprint !== pending.enrollment.fingerprint) throw new Error('invitation-identity');
            viewState.activationBusy = true;
            activationOwner = op;
            let rejectActivation: () => void;
            const aborted = new Promise<never>((_resolve, reject) => {
                rejectActivation = () => reject(new Error('invitation-timeout'));
                op.abort.signal.onabort = rejectActivation;
            });
            let activated;
            try { activated = await Promise.race([ZoeLicense.activate(result.keyString, 'ZOE', op.current, 2), aborted]); }
            finally { if (op.abort.signal.onabort === rejectActivation) op.abort.signal.onabort = null; }
            if (!op.current()) return;
            if (!activated?.valid) throw new Error('invitation-activation');
            safeStoreRemove(appLocalStore, op.storageKey);
            safeStoreRemove(appLocalStore, indexKey);
            pendingStorageKey = null;
            viewState.invitationCode = '';
            viewState.invitationVerificationCode = '';
            viewState.invitationMessage = 'អាជ្ញាប័ណ្ណត្រូវបានផ្ទៀងផ្ទាត់ជោគជ័យ។';
            await proceedAfterLogin(firebaseState.auth.currentUser, firebaseState.authGeneration);
            return;
        }
        if (result.status !== 'pending' || typeof result.requestId !== 'string' || !/^[0-9]{8}$/.test(result.verificationCode)) throw new Error('invitation-result');
        pending.requestId = result.requestId;
        pending.verificationCode = result.verificationCode;
        persist();
        viewState.invitationVerificationCode = result.verificationCode;
        viewState.invitationMessage = 'សូមប្រាប់លេខផ្ទៀងផ្ទាត់ ៨ ខ្ទង់នេះឱ្យអ្នកលក់តាមទំនាក់ទំនងដែលអ្នកស្គាល់។ កំពុងរង់ចាំការយល់ព្រម។';
        if (attempt < STEPS.length) {
            const check = op.current;
            timer = setTimeout(() => {
                timer = null;
                if (!check()) return;
                operation = null;
                void requestLicenseInvitation(true);
            }, STEPS[attempt++]);
        } else viewState.invitationMessage += ' សូមចុចពិនិត្យម្ដងទៀត។';
    } catch (error) {
        if (op.current() && error instanceof Error && ['invitation-expired', 'invitation-terminal'].includes(error.message)) {
            if (pending) safeStoreSet(appLocalStore, op.storageKey, JSON.stringify({ ...pending, paused: true }));
            viewState.invitationMessage = 'ការអញ្ជើញបានផុតកំណត់ ឬត្រូវបានបោះបង់។ សូមស្នើលេខថ្មីពីអ្នកលក់។';
        } else if (op.current() && error instanceof Error && error.message === 'invitation-target') {
            viewState.invitationMessage = 'លេខអញ្ជើញនេះមិនត្រូវនឹងប្រភេទ App នេះទេ។ សូមបើក PWA ដែលបានដំឡើង ឬ APK តាមការណែនាំរបស់អ្នកលក់។';
        } else if (op.current() && error instanceof Error && error.message === 'invitation-disabled') {
            viewState.invitationMessage = 'ការអញ្ជើញមិនទាន់បើកប្រើទេ។ សូមទាក់ទងអ្នកលក់ ឬប្រើជម្រើសដាក់ Key ដោយដៃ។';
        } else if (op.current()) viewState.invitationMessage = 'មិនទាន់អាចបញ្ជាក់លទ្ធផលបានទេ។ សូមពិនិត្យលេខកូដ ប្រភេទ App អ៊ីនធឺណិត និង Storage រួចចុចសាកម្ដងទៀត។' + (persisted ? ' សំណើដើមត្រូវបានរក្សាទុក។' : ' មិនទាន់អាចបញ្ជាក់ថាសំណើត្រូវបានរក្សាទុកទេ។');
    } finally {
        clearTimeout(deadline);
        if (operation === op) {
            viewState.invitationBusy = false;
            if (activationOwner === op) { viewState.activationBusy = false; activationOwner = null; }
            if (!timer) operation = null;
        }
    }
}

export function submitLicenseInvitation() {
    if (viewState.invitationBusy) return;
    if (timer) clearTimeout(timer);
    timer = null;
    operation = null;
    attempt = 0;
    return requestLicenseInvitation();
}

export async function resumeLicenseInvitation() {
    if (viewState.backendKind !== 'firebase' || !firebaseState.auth?.currentUser || !openModalIds().includes('activationModal')) return;
    if (!viewState.invitationCode) {
        const target = invitationTarget();
        if (!target) return;
        const current = captureAuthDatabaseGuard();
        const epoch = viewState.seatEnrollmentEpoch;
        try {
            const key = await storageKey('', target);
            if (!current() || viewState.seatEnrollmentEpoch !== epoch || viewState.invitationCode) return;
            const code = parseInvitationCode(safeStoreGet(appLocalStore, key));
            if (code) viewState.invitationCode = code;
        } catch { return; }
    }
    return requestLicenseInvitation(true);
}
