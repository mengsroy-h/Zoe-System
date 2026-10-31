import { rowOperationActive } from '../services/row-operation-lock';
import { getServerNow, cleanupClockIsTrustworthy } from '../core/clock';
import { palmOriginalFingerprint } from '../services/palm-sign-transport';
import { PALM_PHOTO_PROTOCOL as PHOTO_PROTOCOL, palmOriginalPhotoHash, palmScanConfirmed as scanConfirmed, palmPhotoConfirmed } from '../services/palm-sign-transport';
import { createStore, registerStore } from '../core/store';
import { dataState, firebaseState, securityState } from '../core/state';
import { shopScope } from '../core/shop-scope';
import { barcodeSignIdentity, barcodeZtoSigned } from '../domain/barcode';
import { cleanupHistoryForRecovery, cleanupPartialTrashId } from '../domain/cleanup';
import { getLookupApiConfig } from './lookup-config';
import { lookupApiIsPalm } from './customer-table-prefetch';
import { noteZtoPalmSessionRejected } from './zto-palm-login';
import { dbOp, fetchWithTimeout } from '../services/network';
import { endpoint, failureMessage, headersFor, palmSignConfigKey, recordPalmSignResult, requestPalmSignWithConfirmation } from '../services/palm-sign-transport';
import { addSignJob, listSignJobs, openSignJob, PALM_RESERVATION_PROTOCOL, replaceSignJob, sealSignJob, SIGN_OUTBOX_LEASE_MS, type SignJob, type SignRecoveryCheck, type StoredSignJob } from '../services/palm-sign-outbox-store';
import type { LifecycleScope } from '../app/lifecycle/scope';
import { showToast } from '../ui/toast';
import { documentIsHidden } from '../platform/document-io';

export type SignQueueView = { restartAllowed?: boolean; restartPending?: boolean; restartReady?: boolean; id: string; code: string; signMan?: string; message: string; phase: SignJob['phase']; warning?: string; continuationAllowed?: boolean; verificationRequired?: boolean; manualReviewReason?: string; recovery?: boolean; recoveryContinuation?: boolean; dismissed?: boolean; signed?: boolean; statusUnavailable?: boolean; photoVerified?: boolean; cleanupAt?: number; busy: boolean };
export const palmSignOutboxState = createStore('palmSignOutbox', { owner: '', rows: [] as SignQueueView[], recoveryRows: [] as SignQueueView[], message: '' });
registerStore(palmSignOutboxState);
let running: Promise<void> | null = null;
let rerun = false;
const activeJobs = new Map<string, Promise<void>>();
let lifecycle: LifecycleScope | null = null;
const busyActions = new Set<string>();
const PHOTO_GRACE_MS = 300000;
const SIGN_QUEUE_WAIT_MS = 600000;
const SIGN_CLEANUP_MS = 86400000;
const SIGN_STATUS_RECHECK_MS = 300000;
const PHOTO_GRACE_CHECKS = 5;
const PHOTO_POLL_DELAYS = [15000, 30000, 60000, 120000, 300000];

function pendingDeadline(deadline: number, now: number, maximum: number) {
    return Number.isFinite(deadline) && deadline > now && deadline - now <= maximum;
}

function waiting(row: StoredSignJob['row'], now: number, job: SignJob) {
    if (!pendingDeadline(row.leaseUntil, now, SIGN_OUTBOX_LEASE_MS) && photoGraceEnded(job, now)) return false;
    const step = job.photoPollStep;
    const maximum = job.scanCompleted && !job.photoVerified && Number.isInteger(step) && step! > 0 && step! <= PHOTO_POLL_DELAYS.length
        && typeof job.photoPollDelay === 'number' && job.photoPollDelay > 0 && job.photoPollDelay <= PHOTO_POLL_DELAYS[step! - 1] ? job.photoPollDelay : 15000;
    return pendingDeadline(row.leaseUntil, now, SIGN_OUTBOX_LEASE_MS) || pendingDeadline(row.due, now, maximum);
}

function photoPoll(job: SignJob) {
    const step = Number.isInteger(job.photoPollStep) && job.photoPollStep! >= 0 && job.photoPollStep! <= PHOTO_POLL_DELAYS.length ? job.photoPollStep! : 0;
    const next = Math.min(step + 1, PHOTO_POLL_DELAYS.length);
    return { photoPollStep: next, photoPollDelay: PHOTO_POLL_DELAYS[next - 1] };
}

function photoGraceEnded(job: SignJob, now: number) {
    if (!job.scanCompleted || job.photoVerified) return false;
    const start = job.photoGraceStartedAt;
    if (start === undefined) return (job.photoPollStep || 0) >= PHOTO_GRACE_CHECKS;
    return !Number.isFinite(start) || start <= 0 || now < start || now - start >= PHOTO_GRACE_MS
        || job.photoGraceLastObservedAt !== undefined && (!Number.isFinite(job.photoGraceLastObservedAt) || now < job.photoGraceLastObservedAt)
        || (job.photoGraceChecks || 0) >= PHOTO_GRACE_CHECKS;
}

async function holdUnverifiedPhoto(op: NonNullable<ReturnType<typeof context>>, value: StoredSignJob) {
    await updateJob(op, value, { phase: 'action', continuationAllowed: false, continueRequested: false, confirmationToken: '', warningToken: '',
        manualReviewReason: 'photo_unverified', message: '✅ ZTO បង្ហាញថា Sign រួច។ មិនទាន់ផ្ទៀងថារូបនៅ ZTO ដូចរូបដើមទេ; រូបដើមនៅរក្សាទុក។ អាចរក្សាទុករូប ឬចុចពិនិត្យស្ថានភាពឡើងវិញ។' });
}

async function waitForPhoto(op: NonNullable<ReturnType<typeof context>>, value: StoredSignJob, message: string) {
    if (value.job.scanCompleted && !value.job.photoVerified && (value.job.readOnlyProbe || photoGraceEnded(value.job, Date.now()))) { await holdUnverifiedPhoto(op, value); return; }
    const poll: Partial<Pick<SignJob, 'photoPollStep' | 'photoPollDelay'>> = value.job.scanCompleted && !value.job.photoVerified ? photoPoll(value.job) : {};
    if (poll.photoPollDelay && value.job.photoGraceStartedAt !== undefined) poll.photoPollDelay = Math.min(poll.photoPollDelay, Math.max(1, value.job.photoGraceStartedAt + PHOTO_GRACE_MS - Date.now()));
    await updateJob(op, value, { phase: value.job.phase === 'confirmed' && value.job.photoVerified ? 'confirmed' : 'checking', ...poll, message }, Date.now() + (poll.photoPollDelay || 15000));
}

function localContext() {
    const shop = shopScope();
    const uid = firebaseState.auth?.currentUser?.uid;
    const key = securityState.lookupSecretKey as CryptoKey;
    const operationDb = firebaseState.db;
    if (!shop || !uid || !key || !operationDb || securityState.appIsLocked || securityState.appLockVeiled) return null;
    const owner = JSON.stringify([shop, uid]);
    const generation = firebaseState.authGeneration;
    const scope = lifecycle;
    const current = () => shopScope() === shop && firebaseState.auth?.currentUser?.uid === uid && firebaseState.db === operationDb
        && firebaseState.authGeneration === generation && securityState.lookupSecretKey === key
        && !securityState.appIsLocked && !securityState.appLockVeiled
        && lifecycle === scope && !scope?.disposed;
    return { owner, key, current };
}

function context() {
    const cfg = getLookupApiConfig();
    const local = localContext();
    if (!local || !cfg?.enabled || !lookupApiIsPalm(cfg)) return null;
    const signature = palmSignConfigKey(cfg);
    return { ...local, cfg, signature, current: () => local.current() && palmSignConfigKey(getLookupApiConfig()) === signature };
}

export function canQueuePalmSign() {
    return typeof indexedDB !== 'undefined' && !!context();
}

export async function persistPalmSignJob(input: Pick<SignJob, 'code' | 'itemId' | 'requestId' | 'signMan' | 'photo' | 'dispatchProof' | 'confirmationToken' | 'autoConfirm'>, current: () => boolean) {
    const op = context();
    if (!op || !current()) throw new Error('outbox:session');
    const item = dataState.scanHistory.find((v) => v.id === input.itemId);
    const barcode = item?.barcodes?.find((b) => b.code === input.code);
    if (!barcode || rowOperationActive(item)) throw new Error('outbox:parcel');
    const identity = barcodeSignIdentity(item, barcode);
    const parcelCurrent = () => {
        const currentItem = dataState.scanHistory.find((row) => row.id === input.itemId);
        const currentBarcode = currentItem?.barcodes?.find((entry) => entry.code === input.code);
        return !!currentBarcode && !rowOperationActive(currentItem) && barcodeSignIdentity(currentItem, currentBarcode) === identity;
    };
    const row = await sealSignJob(op.owner, op.key, { ...input, signQueuedAt: getServerNow(), signMan: input.signMan.trim(), reservationProtocol: PALM_RESERVATION_PROTOCOL,
        originalFingerprint: await palmOriginalFingerprint(input.code, input.requestId, input.signMan, input.photo), originalSHA256: await palmOriginalPhotoHash(input.photo), signature: op.signature, parcelIdentity: barcodeSignIdentity(item, barcode), phase: 'queued', attempts: 0, message: '⏳ កំពុងផ្ញើរូប និង Sign ទៅ ZTO' });
    const added = await addSignJob(row, () => op.current() && current() && parcelCurrent());
    if (!added) throw new Error('outbox:duplicate');
    if (op.current()) {
        if (palmSignOutboxState.owner !== op.owner) { palmSignOutboxState.rows = []; palmSignOutboxState.recoveryRows = []; }
        palmSignOutboxState.owner = op.owner;
        palmSignOutboxState.rows = palmSignOutboxState.rows.concat({ id: row.id, code: input.code, phase: 'queued', message: '⏳ កំពុងផ្ញើរូប និង Sign ទៅ ZTO', busy: false });
    }
    void runPalmSignOutbox();
}

async function updateJob(op: NonNullable<ReturnType<typeof localContext>>, value: StoredSignJob, patch: Partial<SignJob>, due = 0, leaseUntil = 0) {
    const job = { ...value.job, ...patch };
    const sealed = await sealSignJob(op.owner, op.key, job);
    const next = { ...sealed, revision: value.row.revision + 1, due, leaseUntil };
    if (!await replaceSignJob(value.row, next, op.current)) throw new Error('outbox:changed');
    value.row = next;
    value.job = job;
}

async function request(op: NonNullable<ReturnType<typeof context>>, body: object, current = op.current) {
    const headers = { ...await headersFor(getLookupApiConfig()), 'Content-Type': 'application/json' };
    if (!current()) throw new Error('outbox:session');
    return fetchWithTimeout(endpoint(op.cfg, 'sign'), { method: 'POST', headers, body: JSON.stringify(body) },
        45000, 'Palm sign timed out', (r) => r.json().catch(() => null));
}

function reservationBinding(body, job: SignJob) {
    return body?.stage === 'receipt'
        && body.barcode === job.code && body.requestId === job.requestId && body.photoProtocol === PHOTO_PROTOCOL
        && body.originalSHA256 === job.originalSHA256 && body.originalFingerprint === job.originalFingerprint
        && body.reservationProtocol === PALM_RESERVATION_PROTOCOL
        && typeof body.reservationOwner === 'string' && body.reservationOwner.length > 0 && body.reservationOwner.length <= 256
        && (!job.reservationOwner || body.reservationOwner === job.reservationOwner)
        && typeof body.reservationToken === 'string' && body.reservationToken.length > 0 && body.reservationToken.length <= 8192;
}

function reservationReady(out, job: SignJob) {
    return out?.res?.status === 409 && out.body?.code === 'ZTO_PALM_SIGN_RESUME_READY' && reservationBinding(out.body, job);
}

function warningRefreshRequired(out, job: SignJob) {
    return out?.res?.status === 409 && out.body?.code === 'ZTO_PALM_SIGN_WARNING_REFRESH_REQUIRED' && out.body.warningRefreshRequired === true
        && reservationBinding(out.body, job) && out.body.reservationToken === job.reservationToken
        && !!job.confirmationToken && out.body.confirmationToken === job.confirmationToken;
}

function manualReview(out, job: SignJob) {
    const body = out?.body;
    return body?.code === 'ZTO_PALM_SIGN_MANUAL_REVIEW_REQUIRED' && body.manualReview === true && body.stage === 'receipt'
        && body.barcode === job.code && body.requestId === job.requestId && body.photoProtocol === PHOTO_PROTOCOL
        && body.originalSHA256 === job.originalSHA256
        && body.reservationProtocol === job.reservationProtocol && body.originalFingerprint === job.originalFingerprint
        && typeof body.reason === 'string' && /^[a-z_]{1,64}$/.test(body.reason);
}

function manualReviewMessage(reason: string) {
    const reasons: Record<string, string> = {
        missing_journal: 'Server មិនរកឃើញការកក់ការងារដើមដែលបានបញ្ជាក់។',
        preimage_uncertain: 'មិនទាន់បញ្ជាក់លទ្ធផលផ្ញើរូបដើម ដូច្នេះមិនផ្ញើស្ទួន។',
        photo_unverified: 'មិនទាន់ផ្ទៀងរូបនៅ ZTO ថាដូចរូបដើម។',
        blocked: 'ZTO មិនអនុញ្ញាតឱ្យបន្តការងារនេះដោយស្វ័យប្រវត្តិ។',
        reservation_conflict: 'ភស្តុតាងកក់ការងារមិនត្រូវនឹងសំណើនេះ។',
        different_request: 'Barcode នេះមានការងារសំណើផ្សេងដែលត្រូវផ្ទៀងជាមុន។',
        unsupported_photo: 'ទម្រង់ចម្លើយរូបពី ZTO មិនទាន់អាចផ្ទៀងដោយស្វ័យប្រវត្តិ។',
        server_unavailable: 'មិនទាន់អានស្ថានភាពសំណើដើមពី Server បាន។',
        parent_unavailable: 'មិនមានកញ្ចប់សកម្មដែលត្រូវនឹងការងារដើមសម្រាប់បន្ត។'
    };
    return '⚠️ ' + (reasons[reason] || 'ត្រូវផ្ទៀងការងារ និងរូបដើមក្នុង ZTO ដោយដៃ។') + ' រូបដើមនៅរក្សាទុក; អាចចុចពិនិត្យស្ថានភាពឡើងវិញ។';
}

function matchingTrash(job: SignJob) {
    if (dataState.scanHistory.some(item => item.id === job.itemId && item.barcodes?.some(barcode => barcode.code === job.code))) return null;
    return dataState.deletedItems.find(item => trashMatches(job, item));
}

function trashMatches(job: SignJob, item) {
    return item && typeof item.id === 'string' && /^[a-zA-Z0-9_-]+$/.test(item.id)
        && Number.isFinite(item.deletedAt) && item.deletedAt > 0 && Array.isArray(item.barcodes)
        && (item.id === job.itemId || item.trashReason === 'pickup' && item.id === cleanupPartialTrashId(job.itemId, 'close', item))
        && item.barcodes.some(barcode => barcode?.code === job.code && barcodeSignIdentity(item, barcode) === job.parcelIdentity);
}

function signedEvidence(job: SignJob) {
    if (job.scanCompleted === true || job.recoveryCheck?.signed === true) return true;
    const item = dataState.scanHistory.find(row => row.id === job.itemId && row.barcodes?.some(barcode => barcode.code === job.code)) || matchingTrash(job);
    const barcode = item?.barcodes?.find(row => row.code === job.code && barcodeSignIdentity(item, row) === job.parcelIdentity);
    return !!barcode && barcodeZtoSigned(barcode);
}

function recoveryMessage(check: SignRecoveryCheck) {
    const status = check.signed === true ? check.photoVerified ? '✅ Sign និងរូបដើមរបស់ការងារនេះបានផ្ទៀង។' : '✅ Sign រួច · មិនទាន់ផ្ទៀងរូបដើមរបស់ការងារនេះ។'
        : check.signed === false ? 'ℹ️ ពេលផ្ទៀងចុងក្រោយ ZTO មិនទាន់ Sign។' : 'ℹ️ មិនទាន់បានស្ថានភាព Sign ថ្មីពី ZTO។';
    const detail = check.continuation ? ' អាចស្នើបន្តការផ្ញើដើម; App នឹងផ្ទៀងសិទ្ធិម្ដងទៀតមុនបន្ត។'
        : check.signed === true ? ' មិនផ្ញើ Sign ឬបន្ថែមរូបស្វ័យប្រវត្តិ។'
            : check.reason ? ' ' + manualReviewMessage(check.reason) : ' ត្រូវផ្ទៀងសំណើដើម មុនអាចបន្តបាន។';
    return (check.statusUnavailable ? 'ពិនិត្យ ZTO ថ្មីមិនបាន។ ស្ថានភាពដែលរក្សាទុក៖ ' : '') + status + detail + ' រូប និងការងារដើមនៅរក្សាទុកក្នុងឧបករណ៍នេះ។';
}

function freshSignStatus(out, job: SignJob): boolean | undefined {
    if (out?.res?.ok === true && out.res.status === 200 && out.body?.success === true && out.body.stage === 'status'
        && out.body.barcode === job.code && typeof out.body.ztoClosed === 'boolean' && out.body.cached !== true
        && out.body.returned !== true && out.body.ztoReturned !== true) return out.body.ztoClosed;
}

function freshSignedStatus(out, job: SignJob) {
    return freshSignStatus(out, job) === true;
}

function previousSignCheck(job: SignJob): SignRecoveryCheck {
    return { at: Date.now(), signed: job.recoveryCheck?.signed ?? (signedEvidence(job) ? true : undefined),
        photoVerified: job.photoVerified === true || job.recoveryCheck?.photoVerified === true,
        statusChecked: true, statusUnavailable: true, signedStatusVerified: false };
}

function applyFreshSignStatus(check: SignRecoveryCheck, out, job: SignJob) {
    const signed = freshSignStatus(out, job);
    check.statusChecked = true;
    check.statusUnavailable = signed === undefined;
    check.signedStatusVerified = signed === true;
    if (signed !== undefined) check.signed = signed;
}

function retainedParcelCurrent(job: SignJob) {
    const item = dataState.scanHistory.find(row => row.id === job.itemId);
    const trash = matchingTrash(job);
    return item?.barcodes?.some(barcode => barcode.code === job.code && barcodeSignIdentity(item, barcode) === job.parcelIdentity)
        || !!trash && !trash.restoreClaim && !trash.restoreClaimId && !trash.restoreClaimToken;
}

async function retainSignedJob(op: NonNullable<ReturnType<typeof context>>, value: StoredSignJob, check: SignRecoveryCheck) {
    if (!op.current() || !check.signedStatusVerified || !retainedParcelCurrent(value.job)) return false;
    const verifiedAt = value.job.signedVerifiedAt || (cleanupClockIsTrustworthy() ? getServerNow() : undefined);
    await updateJob({ ...op, current: () => op.current() && retainedParcelCurrent(value.job) }, value, { recovery: { ...(value.job.recovery || { archivedAt: Date.now(), previousPhase: value.job.phase, previousMessage: value.job.message }), dismissed: true },
        phase: 'action', readOnlyProbe: true, continueRequested: false, continuationAllowed: false,
        recoveryCheck: { ...check, continuation: undefined }, signedCleanupConfirmed: true, signedVerifiedAt: verifiedAt,
        signedCleanupAt: verifiedAt ? verifiedAt + SIGN_CLEANUP_MS : undefined, message: '✅ ZTO បញ្ជាក់ Sign រួច។ ការងារ រូបដើម និងប្រវត្តិក្នុងឧបករណ៍នឹងលុបអចិន្ត្រៃយ៍ក្រោយ 24 ម៉ោង។' });
    return true;
}

async function reconcileHeldSign(op: NonNullable<ReturnType<typeof context>>, value: StoredSignJob) {
    if (!op.current() || !retainedParcelCurrent(value.job)) return;
    await updateJob(op, value, {}, 0, Date.now() + SIGN_OUTBOX_LEASE_MS);
    const check = previousSignCheck(value.job);
    try {
        const out = await request(op, { stage: 'status', barcode: value.job.code });
        applyFreshSignStatus(check, out, value.job);
        if (await retainSignedJob(op, value, check)) return;
    } catch {}
    if (op.current()) await updateJob(op, value, { recoveryCheck: check, ...(!check.statusUnavailable && check.signed === false ? { signedCleanupConfirmed: false, signedCleanupAt: undefined, signedVerifiedAt: undefined } : {}) });
}

async function checkTrashedParent(op: NonNullable<ReturnType<typeof context>>, value: StoredSignJob) {
    const trash = matchingTrash(value.job);
    if (!trash) return false;
    const current = () => {
        const latest = matchingTrash(value.job);
        return op.current() && latest?.id === trash.id && latest.deletedAt === trash.deletedAt
            && !latest.restoreClaim && !latest.restoreClaimId && !latest.restoreClaimToken;
    };
    let verified = false, signed: boolean | undefined = signedEvidence(value.job) || undefined, statusChecked = false, statusUnavailable = false;
    try {
        await updateJob(op, value, { phase: 'checking', manualReviewReason: 'parent_in_trash', readOnlyProbe: true,
            continuationAllowed: false, continueRequested: false }, 0, value.row.leaseUntil);
        if (!current()) throw new Error('outbox:changed');
        const job = value.job;
        const body = { stage: 'receipt-status', barcode: job.code, requestId: job.requestId, photoProtocol: PHOTO_PROTOCOL,
            originalSHA256: job.originalSHA256, reservationProtocol: job.reservationProtocol, originalFingerprint: job.originalFingerprint,
            reservationOwner: job.reservationOwner, reservationToken: job.reservationToken };
        let out = await request(op, body, current);
        if (current() && out.body?.code === 'ZTO_PALM_SIGN_PHOTO_BIND_REQUIRED' && out.body.barcode === job.code && out.body.requestId === job.requestId) {
            out = await request(op, { ...body, photo: job.photo, signMan: job.signMan }, current);
        }
        verified = current() && palmPhotoConfirmed(out, job);
        signed = signed || current() && out.body?.barcode === job.code && out.body?.ztoClosed === true;
        if (!verified && signed && current()) {
            statusChecked = true;
            statusUnavailable = true;
            const status = await request(op, { stage: 'status', barcode: job.code }, current);
            const fresh = freshSignStatus(status, job);
            statusUnavailable = fresh === undefined;
            if (fresh !== undefined) signed = fresh;
            if (current() && freshSignedStatus(status, job) && await retainSignedJob(op, value, { at: Date.now(), signed: true, photoVerified: false, statusChecked: true, signedStatusVerified: true })) return true;
        }
        const api = firebaseState.fb, database = firebaseState.db;
        if (verified && firebaseState.isDatabaseConnected && /^[a-zA-Z0-9_-]+$/.test(job.itemId) && api?.get && api?.ref) {
            const readTrash = async () => (await dbOp(api.get(api.ref(database, `zoew_recently_deleted_cod_dod/${trash.id}`)))).val();
            const sameTrash = item => trashMatches(job, item) && item.id === trash.id && item.deletedAt === trash.deletedAt
                && !item.restoreClaim && !item.restoreClaimId && !item.restoreClaimToken;
            const deleted = await readTrash();
            if (current() && sameTrash(deleted)) {
                const history = await cleanupHistoryForRecovery(job.itemId, deleted, database);
                if (current() && history && !history.some(item => item.barcodes?.some(barcode => barcode.code === job.code))
                    && sameTrash(await readTrash()) && current() && firebaseState.isDatabaseConnected
                    && await retainSignedJob(op, value, { at: Date.now(), signed: true, photoVerified: true, statusChecked: true, signedStatusVerified: true })) {
                    showToast('✅ ZTO បានផ្ទៀង Sign និងរូបដើម។ កញ្ចប់នៅក្នុងធុងសំរាមដដែល; ការងារ Sign បានបញ្ចប់។');
                    return true;
                }
            }
        }
    } catch {}
    if (op.current()) await updateJob(op, value, { phase: 'action', manualReviewReason: 'parent_in_trash', readOnlyProbe: true,
        continuationAllowed: false, continueRequested: false, recoveryCheck: { at: Date.now(), signed, photoVerified: verified, statusChecked, statusUnavailable },
        message: '⚠️ កញ្ចប់ដើមនេះបង្ហាញក្នុងធុងសំរាម ZoeW។ ' + (verified ? 'Sign និងរូបដើមនៅ ZTO បានផ្ទៀង តែស្ថានភាពកញ្ចប់ក្នុង ZoeW មិនទាន់បញ្ជាក់។' : signed ? 'Sign រួច · មិនទាន់ផ្ទៀងរូបដើមរបស់ការងារនេះ។' : 'មិនទាន់បានស្ថានភាព Sign ថ្មី និងភស្តុតាងរូបដើមរបស់ការងារនេះ។')
            + ' រូបដើមនៅរក្សាទុក; អាចរក្សាទុករូប និងពិនិត្យឡើងវិញដោយមិនផ្ញើ Sign។' });
    return true;
}

function warningOf(out, code: string) {
    const b = out.body;
    return out.res.status === 409 && b?.code === 'ZTO_PALM_SIGN_CONFIRM_REQUIRED' && b.barcode === code && b.stage === 'receipt'
        && typeof b.message === 'string' && b.message.trim() && b.message.length <= 4000
        && typeof b.confirmationToken === 'string' && b.confirmationToken.length > 0 && b.confirmationToken.length <= 8192;
}

async function finishLocal(op: NonNullable<ReturnType<typeof context>>, value: StoredSignJob) {
    const current = () => {
        const item = dataState.scanHistory.find((row) => row.id === value.job.itemId);
        const barcode = item?.barcodes?.find((entry) => entry.code === value.job.code);
        return op.current() && !!barcode && barcodeSignIdentity(item, barcode) === value.job.parcelIdentity;
    };
    if (!current()) { if (op.current()) await checkTrashedParent(op, value); return; }
    if (await recordPalmSignResult(value.job.itemId, value.job.code, current, value.job.parcelIdentity) && current()) {
        if (!value.job.photoVerified) {
            await waitForPhoto(op, value, '✅ Sign រួច · ⏳ រង់ចាំផ្ទៀងរូបដើមពី ZTO; រូបនៅរក្សាទុក');
            return;
        }
        if (await retainSignedJob(op, value, { at: Date.now(), signed: true, photoVerified: true, statusChecked: true, signedStatusVerified: true })) showToast('✅ ' + value.job.code + ' · ZTO ទទួលរូប និង Sign រួច');
    } else if (op.current()) {
        if (!value.job.photoVerified) { await waitForPhoto(op, value, '✅ ZTO បង្ហាញថា Sign រួច · រង់ចាំរក្សាទុកក្នុង ZoeW និងផ្ទៀងរូបដើម; រូបនៅរក្សាទុក'); return; }
        await updateJob(op, value, { message: value.job.photoVerified ? '✅ Sign និងរូបដើមបានផ្ទៀង · ⏳ រង់ចាំរក្សាទុកក្នុង ZoeW' : '✅ Sign រួច · ⏳ រង់ចាំរក្សាទុកក្នុង ZoeW និងផ្ទៀងរូបដើម; រូបនៅរក្សាទុក' }, Date.now() + 10000);
    }
}

async function cancelJob(op: NonNullable<ReturnType<typeof context>>, value: StoredSignJob) {
    const job = value.job;
    const current = () => {
        const item = dataState.scanHistory.find((row) => row.id === job.itemId);
        const barcode = item?.barcodes?.find((entry) => entry.code === job.code);
        return op.current() && !!barcode && barcodeSignIdentity(item, barcode) === job.parcelIdentity;
    };
    if (!current()) return;
    if (!job.reservationOwner || !job.reservationToken || !job.cancelConfirmationToken) {
        await updateJob(op, value, { phase: 'action', message: '⚠️ មិនអាចបញ្ជាក់ការបោះបង់ការងារដើមបាន។ រូបនៅរក្សាទុក។' });
        return;
    }
    const out = await request(op, { stage: 'receipt-cancel', barcode: job.code, requestId: job.requestId, photoProtocol: PHOTO_PROTOCOL,
        originalSHA256: job.originalSHA256, reservationProtocol: job.reservationProtocol, originalFingerprint: job.originalFingerprint,
        reservationOwner: job.reservationOwner, reservationToken: job.reservationToken, confirmationToken: job.cancelConfirmationToken }, current);
    if (!current()) return;
    const body = out.body;
    if (out.res.ok && body?.success === true && body.cancelled === true && body.stage === 'receipt-cancel'
        && body.barcode === job.code && body.requestId === job.requestId && body.photoProtocol === PHOTO_PROTOCOL
        && body.originalSHA256 === job.originalSHA256 && body.reservationProtocol === job.reservationProtocol
        && body.originalFingerprint === job.originalFingerprint && body.reservationOwner === job.reservationOwner
        && body.reservationToken === job.reservationToken) {
        if (await replaceSignJob(value.row, null, current)) showToast('✅ បានបោះបង់ការងារមិនទាន់ផ្ញើ និងលុបរូបដើមតាមការបញ្ជាក់របស់អ្នក។');
    } else if (out.res.status >= 400 && out.res.status < 500 && body?.code) {
        await updateJob(op, value, { phase: 'action', cancelRequested: false, warningToken: '', confirmationToken: '',
            message: '⚠️ Server មិនបញ្ជាក់ការបោះបង់។ រូបដើមនៅរក្សាទុក; សូមផ្ទៀងការងារក្នុង ZTO។' });
    } else {
        await updateJob(op, value, { phase: 'checking', message: '⏳ រង់ចាំបញ្ជាក់ការបោះបង់; រូបដើមនៅរក្សាទុក និងមិនផ្ញើ Sign។' }, Date.now() + 15000);
    }
}

async function refreshBeforeWrite(op: NonNullable<ReturnType<typeof context>>, value: StoredSignJob, stage: 'receipt-warning-refresh' | 'receipt-prewrite-refresh', current: () => boolean) {
    if (!current()) return null;
    if (pendingDeadline(value.job.warningRefreshRetryAfter || 0, Date.now(), 300000)) {
        if (stage === 'receipt-prewrite-refresh') {
            const status = await request(op, { stage: 'receipt-status', barcode: value.job.code, requestId: value.job.requestId, photoProtocol: PHOTO_PROTOCOL,
                originalSHA256: value.job.originalSHA256, reservationProtocol: value.job.reservationProtocol, originalFingerprint: value.job.originalFingerprint,
                reservationOwner: value.job.reservationOwner, reservationToken: value.job.reservationToken, refreshRequestId: value.job.refreshRequestId }, current);
            if (!current()) return null;
            if (status.body?.refreshRequestId || status.body?.warningRefreshed) return applyRefreshDecision(op, value, status);
            if (scanConfirmed(status, value.job.code, value.job.requestId) || manualReview(status, value.job)
                && (status.body.reason !== 'blocked' || status.body.continuationAllowed !== true)) return status;
        }
        await updateJob(op, value, { phase: 'checking', message: '⏳ រង់ចាំផ្ទៀងលក្ខខណ្ឌ Sign ឡើងវិញ; រូបដើមនៅរក្សាទុក។' }, Date.now() + 15000);
        return null;
    }
    await updateJob(op, value, { refreshRequestId: value.job.refreshRequestId || crypto.randomUUID(), refreshStage: stage, warningRefreshRetryAfter: Date.now() + 300000 }, 0, value.row.leaseUntil);
    const body = () => ({ stage, refreshRequestId: value.job.refreshRequestId, barcode: value.job.code, requestId: value.job.requestId, photoProtocol: PHOTO_PROTOCOL,
        originalSHA256: value.job.originalSHA256, reservationProtocol: value.job.reservationProtocol, originalFingerprint: value.job.originalFingerprint,
        reservationOwner: value.job.reservationOwner, reservationToken: value.job.reservationToken, photo: value.job.photo, signMan: value.job.signMan,
        dispatchProof: value.job.dispatchProof, confirmationToken: stage === 'receipt-warning-refresh' ? value.job.confirmationToken : undefined, background: true });
    let out = await request(op, body(), current);
    if (!current()) return null;
    if (out.body?.code === 'ZTO_PALM_DISPATCH_REQUIRED' && out.body.barcode === value.job.code
        && (!out.body.requestId || out.body.requestId === value.job.requestId)) {
        const status = await request(op, { stage: 'status', barcode: value.job.code, requestId: value.job.requestId }, current);
        if (!current()) return null;
        if (status.res.ok && status.body?.success === true && status.body.stage === 'status' && status.body.barcode === value.job.code
            && status.body.ztoClosed === false && status.body.dispatched === true && typeof status.body.dispatchProof === 'string'
            && status.body.dispatchProof.length > 0 && status.body.dispatchProof.length <= 8192) {
            await updateJob(op, value, { dispatchProof: status.body.dispatchProof }, 0, value.row.leaseUntil);
            out = await request(op, body(), current);
            if (!current()) return null;
        } else {
            await updateJob(op, value, { phase: 'action', continueRequested: false, message: '⚠️ មិនទាន់ផ្ទៀងភស្តុតាងចែកចាយថ្មីបាន។ មិនផ្ញើចែកចាយ ឬ Sign ស្ទួន; រូបនៅរក្សាទុក។' });
            return null;
        }
    }
    return applyRefreshDecision(op, value, out);
}

async function applyRefreshDecision(op: NonNullable<ReturnType<typeof context>>, value: StoredSignJob, out: Awaited<ReturnType<typeof request>>) {
    const result = out.body;
    const bound = value.job.refreshStage && typeof value.job.refreshRequestId === 'string' && /^[a-f0-9-]{36}$/i.test(value.job.refreshRequestId)
        && result?.refreshRequestId === value.job.refreshRequestId && reservationBinding(result, value.job);
    if (manualReview(out, value.job) && bound) {
        await updateJob(op, value, { reservationOwner: result.reservationOwner, reservationToken: result.reservationToken, everReserved: true,
            continueRequested: false, refreshRequestId: undefined, refreshStage: undefined, warningRefreshRetryAfter: 0 }, 0, value.row.leaseUntil);
        return out;
    }
    if (result?.warningRefreshed === true && bound) {
        if (warningOf(out, value.job.code) && result.warningChanged === true) {
            await updateJob(op, value, { phase: 'action', reservationOwner: result.reservationOwner, reservationToken: result.reservationToken,
                everReserved: true, confirmationToken: '', warningToken: result.confirmationToken, autoConfirm: false, continueRequested: false,
                continuationAllowed: false, warningRefreshRetryAfter: 0, refreshRequestId: undefined, refreshStage: undefined, message: result.message });
            return null;
        }
        if (reservationReady(out, value.job) && typeof result.confirmationToken === 'string' && result.confirmationToken.length <= 8192) {
            await updateJob(op, value, { reservationOwner: result.reservationOwner, reservationToken: result.reservationToken, everReserved: true,
                confirmationToken: result.confirmationToken, warningToken: '', autoConfirm: false, continueRequested: false, continuationAllowed: false, warningRefreshRetryAfter: 0, refreshRequestId: undefined, refreshStage: undefined }, 0, value.row.leaseUntil);
            return out;
        }
    }
    if (result?.code === 'ZTO_PALM_SIGN_RESUME_READY' || result?.warningRefreshed || result?.refreshRequestId || result?.code === 'ZTO_PALM_DISPATCH_REQUIRED') {
        await updateJob(op, value, { phase: 'action', continueRequested: false, message: '⚠️ ភស្តុតាងផ្ទៀងលក្ខខណ្ឌថ្មីមិនពេញលេញ។ មិនបន្ត Sign; រូបដើមនៅរក្សាទុក។' });
        return null;
    }
    if (manualReview(out, value.job) || out.res.status >= 400 && out.res.status < 500 && result?.code && !result.uncertain) {
        await updateJob(op, value, { continueRequested: false, warningRefreshRetryAfter: 0 }, 0, value.row.leaseUntil);
    }
    return out;
}

async function processJob(op: NonNullable<ReturnType<typeof context>>, value: StoredSignJob) {
    const { job } = value;
    if (!op.current() || job.recovery || job.phase === 'action' || job.verificationRequired || waiting(value.row, Date.now(), value.job)) return;
    if (job.signature !== op.signature) return;
    const lease = { ...value.row, revision: value.row.revision + 1, leaseUntil: Date.now() + SIGN_OUTBOX_LEASE_MS };
    if (!await replaceSignJob(value.row, lease, op.current)) return;
    value.row = lease;
    try {
        const item = dataState.scanHistory.find((v) => v.id === job.itemId);
        const barcode = item?.barcodes?.find((b) => b.code === job.code);
        if (rowOperationActive(item)) {
            await updateJob(op, value, { message: '⏳ កញ្ចប់នេះកំពុងរង់ចាំផ្ទៀងប្រតិបត្តិការ; ការងារ Sign និងរូបដើមនៅរក្សាទុក។' }, Date.now() + 10000);
            return;
        }
        if (!barcode && await checkTrashedParent(op, value)) return;
        if (!job.readOnlyProbe && photoGraceEnded(job, Date.now())) { await holdUnverifiedPhoto(op, value); return; }
        if (!barcode) {
            await updateJob(op, value, { message: '⏳ រង់ចាំផ្ទៀងកញ្ចប់ក្នុង ZoeW' }, Date.now() + 10000);
            return;
        }
        const parcelCurrent = () => {
            const currentItem = dataState.scanHistory.find((row) => row.id === job.itemId);
            const currentBarcode = currentItem?.barcodes?.find((entry) => entry.code === job.code);
            return op.current() && !!currentBarcode && barcodeSignIdentity(currentItem, currentBarcode) === job.parcelIdentity;
        };
        const sendCurrent = () => parcelCurrent() && !rowOperationActive(dataState.scanHistory.find((row) => row.id === job.itemId));
        if (barcodeSignIdentity(item, barcode) !== job.parcelIdentity) {
            await updateJob(op, value, { phase: 'action', message: '⚠️ កញ្ចប់នេះត្រូវបានស្តារ ឬបញ្ចូលឡើងវិញ។ សូមពិនិត្យការងារ Sign ដើមក្នុង ZTO។', confirmationToken: '', warningToken: '' });
            return;
        }
        if (job.cancelRequested === true && !job.readOnlyProbe) { await cancelJob(op, value); return; }
        if (job.phase === 'confirmed' && job.photoVerified) { await finishLocal(op, value); return; }
        if (job.everReserved && (!job.reservationOwner || !job.reservationToken)) {
            await updateJob(op, value, { phase: 'action', message: '⚠️ ភស្តុតាងកក់ការងារ Sign មិនពេញលេញ។ រូបនៅរក្សាទុក; សូមពិនិត្យការងារដើម។' });
            return;
        }
        let out;
        if (job.continueRequested === true) {
            if (job.continuationAllowed !== true || job.readOnlyProbe === true) {
                await updateJob(op, value, { phase: 'action', continueRequested: false, message: '⚠️ មិនមានភស្តុតាងសម្រាប់បន្ត Sign។ រូបដើមនៅរក្សាទុក។' });
                return;
            }
            out = await refreshBeforeWrite(op, value, 'receipt-prewrite-refresh', sendCurrent);
            if (!out) return;
        } else {
            if (job.phase === 'queued') await updateJob(op, value, { phase: 'checking' }, 0, lease.leaseUntil);
            const statusBody = { stage: 'receipt-status', barcode: job.code, requestId: job.requestId, photoProtocol: PHOTO_PROTOCOL, originalSHA256: value.job.originalSHA256,
                reservationProtocol: job.reservationProtocol, originalFingerprint: job.originalFingerprint,
                reservationOwner: job.reservationOwner, reservationToken: job.reservationToken, confirmationToken: job.confirmationToken || undefined,
                refreshRequestId: job.refreshStage ? job.refreshRequestId : undefined };
            out = await request(op, statusBody, sendCurrent);
            if (!op.current()) return;
            if (out.body?.warningRefreshed || out.body?.refreshRequestId) {
                out = await applyRefreshDecision(op, value, out);
                if (!out) return;
            }
            if (warningRefreshRequired(out, value.job)) {
                out = await refreshBeforeWrite(op, value, 'receipt-warning-refresh', sendCurrent);
                if (!out) return;
            }
            if (out.body?.code === 'ZTO_PALM_SIGN_PHOTO_BIND_REQUIRED' && out.body.barcode === job.code && !pendingDeadline(value.job.photoBindRetryAfter || 0, Date.now(), 300000)) {
                await updateJob(op, value, { photoBindRetryAfter: Date.now() + 300000 }, 0, lease.leaseUntil);
                out = await request(op, { ...statusBody, photo: job.photo, signMan: job.signMan }, sendCurrent);
                if (!op.current()) return;
            }
        }
        if (reservationReady(out, value.job)) {
            await updateJob(op, value, { reservationOwner: out.body.reservationOwner, reservationToken: out.body.reservationToken, everReserved: true }, 0, lease.leaseUntil);
            if (value.job.readOnlyProbe === true) {
                await updateJob(op, value, { phase: 'action', message: 'ℹ️ បានពិនិត្យសិទ្ធិសំណើ។ ការផ្ទៀងនេះមិនផ្ញើរូប ឬ Sign ឡើងវិញទេ; រូបដើមនៅរក្សាទុក។' });
                return;
            }
            out = null;
        }
        if (!out) {
            if (!dataState.scanHistory.some((item) => item.id === job.itemId && item.barcodes?.some((b) => b.code === job.code))) {
                if (await checkTrashedParent(op, value)) return;
                await updateJob(op, value, { message: '⏳ រង់ចាំផ្ទៀងកញ្ចប់ក្នុង ZoeW' }, Date.now() + 10000);
                return;
            }
            await updateJob(op, value, { phase: 'checking', attempts: value.job.attempts + 1 }, 0, lease.leaseUntil);
            if (!op.current()) return;
            const send = value.job;
            const current = () => {
                if (!op.current()) return false;
                const currentItem = dataState.scanHistory.find((row) => row.id === send.itemId);
                const currentBarcode = currentItem?.barcodes?.find((entry) => entry.code === send.code);
                return !!currentBarcode && !rowOperationActive(currentItem) && barcodeSignIdentity(currentItem, currentBarcode) === send.parcelIdentity;
            };
            if (!current()) return;
            const body = { reservationProtocol: send.reservationProtocol, originalFingerprint: send.originalFingerprint, reservationOwner: send.reservationOwner, reservationToken: send.reservationToken,
                photoProtocol: PHOTO_PROTOCOL, originalSHA256: send.originalSHA256, barcode: send.code, requestId: send.requestId, stage: 'receipt', signMan: send.signMan, photo: send.photo,
                dispatchProof: send.dispatchProof, confirmationToken: send.confirmationToken || undefined, background: true };
            out = send.autoConfirm === true
                ? await requestPalmSignWithConfirmation((input) => request(op, input, current), body, parcelCurrent, async (confirmation) => {
                    await updateJob(op, value, { confirmationToken: confirmation.token, warningToken: '', refreshRequestId: crypto.randomUUID(), refreshStage: undefined, warningRefreshRetryAfter: 0 }, 0, Date.now() + SIGN_OUTBOX_LEASE_MS);
                })
                : await request(op, body, current);
        }
        if (!op.current()) return;
        if (manualReview(out, value.job)) {
            await updateJob(op, value, { phase: 'action', continueRequested: false, continuationAllowed: out.body.reason === 'blocked' && out.body.continuationAllowed === true && out.body.reservationOwner === value.job.reservationOwner,
                manualReviewReason: out.body.reason, message: manualReviewMessage(out.body.reason) });
        } else if (scanConfirmed(out, job.code, job.requestId)) {
            if (!palmPhotoConfirmed(out, value.job)) {
                const check: SignRecoveryCheck = { at: Date.now(), signed: true, photoVerified: false, statusChecked: true, statusUnavailable: true };
                try {
                    const status = await request(op, { stage: 'status', barcode: job.code }, parcelCurrent);
                    applyFreshSignStatus(check, status, job);
                    if (parcelCurrent() && await retainSignedJob(op, value, check)) return;
                } catch {}
                if (!parcelCurrent()) return;
                await updateJob(op, value, { recoveryCheck: check }, 0, value.row.leaseUntil);
            }
            const grace = palmPhotoConfirmed(out, value.job) ? {} : { photoGraceStartedAt: value.job.photoGraceStartedAt ?? Date.now(),
                photoGraceLastObservedAt: Math.max(value.job.photoGraceLastObservedAt || 0, Date.now()),
                photoGraceChecks: Math.min(PHOTO_GRACE_CHECKS, (value.job.photoGraceChecks || 0) + (value.job.readOnlyProbe ? 0 : 1)) };
            await updateJob(op, value, { ...grace, phase: 'confirmed', scanCompleted: true, photoVerified: palmPhotoConfirmed(out, value.job), message: '✅ Sign រួច · ⏳ កំពុងផ្ទៀងរូបដើម និងរក្សាទុកក្នុង ZoeW', confirmationToken: '', warningToken: '' }, 0, value.row.leaseUntil);
            await finishLocal(op, value);
        } else if (out.body?.code === 'ZTO_PALM_SIGN_REPORTED_REJECTED' && out.body.barcode === job.code && out.body.verificationRequired === true) {
            await updateJob(op, value, { phase: 'action', verificationRequired: true, message: failureMessage(out.body.code), confirmationToken: '', warningToken: '' });
        } else if (warningOf(out, job.code)) {
            await updateJob(op, value, { phase: 'action', message: out.body.message, confirmationToken: '', warningToken: out.body.confirmationToken });
            showToast('⚠️ ' + job.code + ' · សូមបើកបញ្ជី Sign ដើម្បីបញ្ជាក់សារ ZTO');
        } else if (out.body?.code === 'ZTO_PALM_DISPATCH_REQUIRED') {
            await updateJob(op, value, { phase: 'checking', confirmationToken: '', message: '⏳ កំពុងផ្ទៀងស្ថានភាពចែកចាយឡើងវិញ' }, Date.now() + 2000);
        } else if (out.body?.uncertain || !out.body?.code || out.res.status >= 500 && out.body?.code !== 'ZTO_PALM_SIGN_PHOTO_REJECTED') {
            await waitForPhoto(op, value, value.job.scanCompleted ? '✅ Sign រួច · ⏳ មិនទាន់ផ្ទៀងរូបដើម; រូបនៅរក្សាទុក' : '⏳ រង់ចាំផ្ទៀង ZTO · មិនទាន់បញ្ជាក់ Sign');
        } else {
            const code = out.body.code;
            const message = code === 'ZTO_PALM_SIGN_CHECK_REJECTED' && typeof out.body.message === 'string' && out.body.message.length <= 4000
                ? out.body.message : failureMessage(code, out.body.reason);
            await updateJob(op, value, { phase: 'action', message, warningToken: '', confirmationToken: '' });
            if (code === 'ZTO_AUTH_EXPIRED' || code === 'ZTO_PALM_RELOGIN_REQUIRED') noteZtoPalmSessionRejected(op.cfg);
        }
    } catch (_) {
        if (op.current()) {
            try { await waitForPhoto(op, value, '⏳ បណ្ដាញ ឬការរក្សាទុកមិនទាន់បញ្ជាក់ · ការងារនៅរង់ចាំ'); } catch {}
        }
    }
}

async function readJobs(op: NonNullable<ReturnType<typeof localContext>>) {
    const rows = await listSignJobs(op.owner);
    const jobs: StoredSignJob[] = [];
    let unreadable = 0;
    for (const row of rows) {
        try { jobs.push({ row, job: await openSignJob(row, op.key) }); }
        catch { unreadable++; }
    }
    return { jobs, unreadable };
}

async function publish(op: NonNullable<ReturnType<typeof localContext>> & { signature: string }, loaded?: Awaited<ReturnType<typeof readJobs>>) {
    const { jobs, unreadable } = loaded || await readJobs(op);
    if (!op.current()) return;
    palmSignOutboxState.owner = op.owner;
    palmSignOutboxState.message = unreadable ? '⚠️ ការងារ Sign ' + String(unreadable).replace(/\d/g, (digit) => '០១២៣៤៥៦៧៨៩'[Number(digit)]) + ' អានមិនបានដោយ PIN បច្ចុប្បន្ន (ឧ. ក្រោយប្តូរ PIN)។ ទិន្នន័យអ៊ិនគ្រីបនៅរក្សាទុក។ សូមប្រើ PIN ដើមដើម្បីអានរូប ហើយកុំលុបទិន្នន័យ App។' : '';
    const views = jobs.map(({ row, job }) => ({ id: row.id, code: job.code, signMan: job.signMan, phase: job.phase, recovery: !!job.recovery,
        cleanupAt: job.signedCleanupAt, dismissed: job.recovery?.dismissed === true, signed: job.recoveryCheck?.signed ?? (signedEvidence(job) ? true : undefined),
        statusUnavailable: job.recoveryCheck?.statusUnavailable === true || job.recoveryCheck?.statusChecked === true && job.recoveryCheck.signed === undefined,
        photoVerified: job.recoveryCheck?.photoVerified ?? job.photoVerified === true,
        restartAllowed: job.signature === op.signature && restartEligible(job), restartPending: job.restartIntent?.pending === true,
        restartReady: !!job.restartHistory?.length && !job.restartIntent?.pending && !signedEvidence(job)
            && (!!job.recovery && !!job.recoveryCheck?.continuation || job.continuationAllowed === true && !job.refreshStage),
        recoveryContinuation: !job.restartIntent?.pending && !!job.recovery && !!job.recoveryCheck?.continuation && !signedEvidence(job),
        continuationAllowed: job.continuationAllowed === true && !job.refreshStage,
        verificationRequired: job.verificationRequired, manualReviewReason: job.manualReviewReason,
        message: job.signature === op.signature ? job.message : '⚠️ ការភ្ជាប់ ZTO ប្រែ។ សូមស្តារការភ្ជាប់ដើមដើម្បីបន្ត Sign។',
        warning: !job.recovery && job.warningToken && job.manualReviewReason !== 'parent_in_trash' ? job.message : '', busy: pendingDeadline(row.leaseUntil, Date.now(), SIGN_OUTBOX_LEASE_MS) || busyActions.has(row.id) || activeJobs.has(row.id) }));
    palmSignOutboxState.rows = views.filter(row => !row.recovery);
    palmSignOutboxState.recoveryRows = views.filter(row => row.recovery);
}

export async function refreshPalmSignQueue() {
    const local = localContext();
    const op = local && { ...local, signature: palmSignConfigKey(getLookupApiConfig()) };
    if (!op) { palmSignOutboxState.owner = ''; palmSignOutboxState.rows = []; palmSignOutboxState.recoveryRows = []; return; }
    try { await publish(op); }
    catch { if (op.current()) palmSignOutboxState.message = '⚠️ បើកបញ្ជី Sign ដែលរក្សាទុកមិនបាន។ សូមកុំលុបទិន្នន័យ App។'; }
}

function queuedStatusDue(job: SignJob, now: number) {
    const check = job.recoveryCheck;
    if (!check?.statusChecked) return signedEvidence(job) || !!job.recovery && (now < job.recovery.archivedAt || now - job.recovery.archivedAt >= SIGN_STATUS_RECHECK_MS);
    return !Number.isFinite(check.at) || now < check.at || now - check.at >= SIGN_STATUS_RECHECK_MS;
}

export function runPalmSignOutbox(): Promise<void> {
    if (running) { rerun = true; return running; }
    const op = context();
    if (!op) {
        const local = localContext();
        if (!local) return refreshPalmSignQueue();
        return (async () => { await maintainQueueLifecycle(local, (await readJobs(local)).jobs); await refreshPalmSignQueue(); })().catch(() => {});
    }
    if (palmSignOutboxState.owner !== op.owner) { palmSignOutboxState.owner = op.owner; palmSignOutboxState.rows = []; palmSignOutboxState.recoveryRows = []; }
    running = (async () => {
        try {
            let loaded = await readJobs(op);
            if (!op.current()) return;
            await maintainQueueLifecycle(op, loaded.jobs);
            loaded = await readJobs(op);
            if (!op.current()) return;
            if (navigator.onLine !== false && !documentIsHidden() && (!lifecycle || !lifecycle.disposed)) {
                for (const value of loaded.jobs) {
                    if (activeJobs.size >= 2 || !op.current()) break;
                    const observedSign = (value.job.recovery || value.job.phase === 'action') && !value.job.signedCleanupAt
                        && queuedStatusDue(value.job, Date.now()) && retainedParcelCurrent(value.job);
                    if (activeJobs.has(value.row.id) || busyActions.has(value.row.id) || !observedSign && (value.job.recovery || value.job.phase === 'action' || value.job.verificationRequired) || value.job.signature !== op.signature
                        || waiting(value.row, Date.now(), value.job)) continue;
                    const work = (observedSign ? reconcileHeldSign(op, value) : processJob(op, value)).catch(() => {}).finally(() => {
                        activeJobs.delete(value.row.id);
                        void runPalmSignOutbox();
                    });
                    activeJobs.set(value.row.id, work);
                }
            }
            if (op.current()) await publish(op, loaded);
        } catch (_) {
            if (op.current()) palmSignOutboxState.message = '⚠️ បើកបញ្ជី Sign ដែលរក្សាទុកមិនបាន។ សូមកុំលុបទិន្នន័យ App។';
        }
    })().finally(() => {
        running = null;
        if (rerun) { rerun = false; queueMicrotask(() => { void runPalmSignOutbox(); }); }
    });
    return running;
}

async function maintainQueueLifecycle(op: NonNullable<ReturnType<typeof localContext>>, jobs: StoredSignJob[]) {
    for (const value of jobs) {
        if (!op.current()) return;
        if (activeJobs.has(value.row.id) || busyActions.has(value.row.id)
            || pendingDeadline(value.row.leaseUntil, Date.now(), SIGN_OUTBOX_LEASE_MS)) continue;
        const now = getServerNow();
        if (!Number.isFinite(now) || now <= 0) continue;
        const job = value.job;
        if (job.signedCleanupAt !== undefined) {
            if (cleanupClockIsTrustworthy() && Number.isFinite(now) && Number.isFinite(job.signedVerifiedAt)
                && job.signedVerifiedAt! > 0 && job.signedCleanupAt === job.signedVerifiedAt! + SIGN_CLEANUP_MS
                && now >= job.signedCleanupAt && job.signedCleanupConfirmed === true) {
                await replaceSignJob(value.row, null, () => {
                    const commitNow = getServerNow();
                    return op.current() && cleanupClockIsTrustworthy() && Number.isFinite(commitNow) && commitNow >= job.signedCleanupAt!;
                });
            }
            continue;
        }
        if (job.signedCleanupConfirmed === true) {
            if (cleanupClockIsTrustworthy() && Number.isFinite(now) && now > 0) await updateJob(op, value, { signedVerifiedAt: now, signedCleanupAt: now + SIGN_CLEANUP_MS });
            continue;
        }
        if (job.recovery || signedEvidence(job)) continue;
        if (!Number.isFinite(job.signQueuedAt) || job.signQueuedAt! <= 0 || job.signQueuedAt! > now) {
            await updateJob(op, value, { signQueuedAt: now }, value.row.due, value.row.leaseUntil);
        } else if (now - (Number.isFinite(job.userRetryAt) && job.userRetryAt! >= job.signQueuedAt! && job.userRetryAt! <= now ? job.userRetryAt! : job.signQueuedAt!) >= SIGN_QUEUE_WAIT_MS) {
            await updateJob(op, value, { recovery: { archivedAt: now, previousPhase: job.phase, previousMessage: job.message },
                phase: 'action', readOnlyProbe: true, continueRequested: false, continuationAllowed: false,
                message: '⚠️ ហួសពេលរង់ចាំ 10 នាទី។ ' + job.message });
        }
    }
}

async function deleteQueuedSign(id: string) {
    const local = localContext();
    if (!local || busyActions.has(id) || activeJobs.has(id)) return;
    const op = { ...local, signature: palmSignConfigKey(getLookupApiConfig()) };
    busyActions.add(id);
    try {
        const value = (await readJobs(op)).jobs.find(entry => entry.row.id === id);
        if (!value || !op.current() || activeJobs.has(id)
            || pendingDeadline(value.row.leaseUntil, Date.now(), SIGN_OUTBOX_LEASE_MS)) return;
        if (!confirm('លុបការងារ Sign ' + value.job.code + ' អចិន្ត្រៃយ៍?\nរូបដើម និងប្រវត្តិការងារក្នុងឧបករណ៍នេះនឹងបាត់ គ្មាន Undo។ កំណត់ត្រាកញ្ចប់ លុយ និង ZTO មិនលុប។ សំណើដែលបានផ្ញើទៅ Server មិនត្រូវបានបោះបង់ដោយការលុបនេះទេ ហើយអាចនៅតែត្រូវផ្ទៀងមុន Sign ថ្មី។')) return;
        const remote = context();
        let cancelled = false;
        if (remote && remote.signature === value.job.signature && navigator.onLine !== false) {
            await updateJob(op, value, {}, 0, Date.now() + SIGN_OUTBOX_LEASE_MS);
            try {
                const job = value.job;
                const statusBody = { stage: 'receipt-status', barcode: job.code, requestId: job.requestId, photoProtocol: PHOTO_PROTOCOL,
                    originalSHA256: job.originalSHA256, reservationProtocol: job.reservationProtocol, originalFingerprint: job.originalFingerprint,
                    reservationOwner: job.reservationOwner, reservationToken: job.reservationToken,
                    confirmationToken: job.warningToken || job.confirmationToken || undefined };
                const status = await request(remote, statusBody);
                const blocked = manualReview(status, job) && status.body.reason === 'blocked'
                    && status.body.reservationOwner === job.reservationOwner;
                const original = { ...statusBody, stage: 'receipt' };
                const capability = ![200, 409].includes(status.res.status)
                    || status.body?.code === 'ZTO_PALM_SIGN_MANUAL_REVIEW_REQUIRED' && !blocked ? null
                    : reservationBinding(status.body, job) ? status.body
                        : blocked && reservationBinding(original, job) ? original : null;
                if (remote.current() && capability) {
                    await updateJob(op, value, {}, 0, Date.now() + SIGN_OUTBOX_LEASE_MS);
                    const result = await request(remote, { ...statusBody, stage: 'receipt-cancel', reservationOwner: capability.reservationOwner,
                        reservationToken: capability.reservationToken });
                    cancelled = result.res.ok && result.body?.success === true && result.body.cancelled === true
                        && result.body.stage === 'receipt-cancel' && result.body.barcode === job.code && result.body.requestId === job.requestId
                        && result.body.photoProtocol === PHOTO_PROTOCOL && result.body.originalSHA256 === job.originalSHA256
                        && result.body.originalFingerprint === job.originalFingerprint && result.body.reservationProtocol === job.reservationProtocol
                        && result.body.reservationOwner === capability.reservationOwner && result.body.reservationToken === capability.reservationToken;
                }
            } catch {}
        }
        if (await replaceSignJob(value.row, null, () => op.current() && !activeJobs.has(id))) {
            showToast(cancelled ? '✅ លុបការងារ និងរូបដើមរួច។ Server បានបោះបង់សំណើមិនទាន់ផ្ញើ។'
                : '✅ លុបការងារ និងរូបក្នុងឧបករណ៍រួច។ សំណើចាស់នៅ Server អាចត្រូវផ្ទៀងមុន Sign ថ្មី។');
        }
    } catch {
        if (op.current()) showToast('⚠️ លុបមិនបាន។ ការងារនៅដដែល សូមសាកម្ដងទៀត។');
    } finally {
        busyActions.delete(id);
        if (op.current()) await publish(op).catch(() => {});
    }
}

async function archiveQueuedSign(id: string) {
    const local = localContext();
    if (!local || busyActions.has(id) || activeJobs.has(id)) return;
    const op = { ...local, signature: palmSignConfigKey(getLookupApiConfig()) };
    busyActions.add(id);
    try {
        const value = (await readJobs(op)).jobs.find(entry => entry.row.id === id);
        if (!value || value.job.recovery || !op.current() || activeJobs.has(id)) return;
        if (value.row.leaseUntil > 0) { showToast('⏳ សំណើមុននៅរង់ចាំផ្ទៀងថាចប់។ មិនផ្លាស់ការងារកំពុងដំណើរការ; រូបដើមនៅរក្សាទុក។'); return; }
        const check: SignRecoveryCheck = { at: Date.now(), signed: signedEvidence(value.job) ? true : value.job.recoveryCheck?.signed,
            photoVerified: value.job.photoVerified === true, reason: value.job.manualReviewReason };
        await updateJob(op, value, { recovery: { archivedAt: Date.now(), previousPhase: value.job.phase, previousMessage: value.job.message },
            recoveryCheck: check, phase: 'action', readOnlyProbe: true, continueRequested: false, continuationAllowed: false, message: recoveryMessage(check) });
    } catch {
        if (op.current()) showToast('⚠️ ផ្លាស់ទៅការងារត្រូវសង្គ្រោះមិនបាន។ រូប និងការងារដើមនៅដដែល។');
    } finally {
        busyActions.delete(id);
        if (op.current()) await publish(op).catch(() => {});
    }
}

function recoveryParentCurrent(job: SignJob) {
    const item = dataState.scanHistory.find(row => row.id === job.itemId);
    const barcode = item?.barcodes?.find(row => row.code === job.code);
    return !!barcode && barcodeSignIdentity(item, barcode) === job.parcelIdentity && !barcodeZtoSigned(barcode);
}

async function inspectRecovery(op: NonNullable<ReturnType<typeof context>>, value: StoredSignJob) {
    const job = value.job;
    const check = previousSignCheck(job);
    const actualHash = await palmOriginalPhotoHash(job.photo);
    if (actualHash !== job.originalSHA256 || await palmOriginalFingerprint(job.code, job.requestId, job.signMan, job.photo) !== job.originalFingerprint) {
        check.reason = 'reservation_conflict';
        return check;
    }
    const body = { stage: 'receipt-status', barcode: job.code, requestId: job.requestId, photoProtocol: PHOTO_PROTOCOL, originalSHA256: actualHash,
        reservationProtocol: job.reservationProtocol, originalFingerprint: job.originalFingerprint, reservationOwner: job.reservationOwner,
        reservationToken: job.reservationToken, confirmationToken: job.confirmationToken || job.warningToken || undefined };
    let out = await request(op, body);
    if (!op.current()) return check;
    if (out.body?.code === 'ZTO_PALM_SIGN_PHOTO_BIND_REQUIRED' && out.body.barcode === job.code && out.body.requestId === job.requestId) {
        out = await request(op, { ...body, photo: job.photo, signMan: job.signMan });
        if (!op.current()) return check;
    }
    check.photoVerified = check.photoVerified || palmPhotoConfirmed(out, value.job);
    if (out.body?.barcode === job.code && out.body?.ztoClosed === true) check.signed = true;
    else if (out.res.ok && out.body?.success === true && out.body?.barcode === job.code && out.body?.ztoClosed === false && check.signed !== true) check.signed = false;
    try {
        const status = await request(op, { stage: 'status', barcode: job.code });
        if (op.current()) applyFreshSignStatus(check, status, job);
    } catch {}
    if (!op.current()) return check;
    check.reason = manualReview(out, value.job) ? out.body.reason : out.body?.requestId && out.body.requestId !== job.requestId ? 'different_request'
        : out.res.status >= 500 ? 'server_unavailable' : check.photoVerified ? undefined : 'photo_unverified';
    const heldOwner = !job.everReserved || !!job.reservationOwner && !!job.reservationToken;
    const ready = reservationReady(out, value.job);
    const blocked = manualReview(out, value.job) && out.body.reason === 'blocked' && out.body.continuationAllowed === true && reservationBinding(out.body, value.job);
    if ((ready || blocked) && !recoveryParentCurrent(value.job)) check.reason = 'parent_unavailable';
    if (heldOwner && !check.statusUnavailable && check.signed === false && !signedEvidence(value.job) && !job.verificationRequired && !job.cancelRequested && !job.refreshStage
        && recoveryParentCurrent(value.job) && (ready || blocked)) {
        await updateJob(op, value, { reservationOwner: out.body.reservationOwner, reservationToken: out.body.reservationToken, everReserved: true }, 0, value.row.leaseUntil);
        check.continuation = blocked ? 'blocked' : 'reserved'; check.reason = undefined;
    }
    return check;
}

async function recoverQueuedSign(id: string, resume: boolean) {
    const op = context();
    if (!op || busyActions.has(id) || activeJobs.has(id)) return;
    busyActions.add(id);
    let value: StoredSignJob | undefined;
    let start = false;
    try {
        value = (await readJobs(op)).jobs.find(entry => entry.row.id === id);
        if (!value?.job.recovery || value.job.restartIntent?.pending || !op.current() || value.job.signature !== op.signature || activeJobs.has(id)
            || pendingDeadline(value.row.leaseUntil, Date.now(), SIGN_OUTBOX_LEASE_MS)) return;
        await updateJob(op, value, { phase: 'action', readOnlyProbe: true, continueRequested: false, continuationAllowed: false,
            recoveryCheck: previousSignCheck(value.job),
            message: '⏳ កំពុងផ្ទៀងស្ថានភាព និងសិទ្ធិសំណើដើម; មិនផ្ញើ Sign។' }, 0, Date.now() + SIGN_OUTBOX_LEASE_MS);
        const check = await inspectRecovery(op, value);
        if (!op.current()) return;
        if (await retainSignedJob(op, value, check)) return;
        if (!check.statusUnavailable && check.signed === false) await updateJob(op, value, { signedCleanupConfirmed: false, signedCleanupAt: undefined, signedVerifiedAt: undefined }, 0, value.row.leaseUntil);
        if (resume && check.continuation && check.signed === false && !signedEvidence(value.job) && recoveryParentCurrent(value.job)) {
            const blocked = check.continuation === 'blocked' || !!value.job.restartHistory?.length && !value.job.dispatchProof;
            await updateJob(op, value, { recoveryHistory: [...(value.job.recoveryHistory || []), { ...value.job.recovery!, resumedAt: Date.now() }],
                recovery: undefined, userRetryAt: getServerNow(), recoveryCheck: { ...check, continuation: undefined }, phase: 'checking', readOnlyProbe: false, autoConfirm: false,
                continuationAllowed: blocked, continueRequested: blocked, refreshRequestId: blocked ? crypto.randomUUID() : undefined,
                refreshStage: blocked ? 'receipt-prewrite-refresh' : undefined, warningRefreshRetryAfter: 0, confirmationToken: '', warningToken: '',
                message: '⏳ កំពុងបន្តការផ្ញើដើមតាមការស្នើរបស់អ្នក; រូបដើមនៅរក្សាទុក។' });
            start = true;
        } else await updateJob(op, value, { recoveryCheck: check, message: recoveryMessage(check) });
    } catch {
        if (value && op.current()) {
            const check: SignRecoveryCheck = { ...previousSignCheck(value.job), reason: 'server_unavailable' };
            try { await updateJob(op, value, { phase: 'action', recoveryCheck: check, message: recoveryMessage(check) }); } catch {}
        }
    } finally {
        busyActions.delete(id);
        if (op.current()) await publish(op).catch(() => {});
    }
    if (start) void runPalmSignOutbox();
}

function restartEligible(job: SignJob) {
    return !signedEvidence(job) && recoveryParentCurrent(job) && !job.verificationRequired && !job.cancelRequested
        && !job.refreshStage && (job.restartIntent !== undefined || (job.manualReviewReason || job.recoveryCheck?.reason) === 'different_request');
}

function restartBinding(body, job: SignJob) {
    return !!job.restartIntent && body?.barcode === job.code && body.requestId === job.restartIntent.requestId
        && body.restartFromRequestId === job.requestId && body.photoProtocol === PHOTO_PROTOCOL
        && body.originalSHA256 === job.originalSHA256 && body.reservationProtocol === PALM_RESERVATION_PROTOCOL
        && body.originalFingerprint === job.restartIntent.originalFingerprint;
}

async function restartQueuedSign(id: string) {
    const session = context();
    if (!session || navigator.onLine === false || busyActions.has(id) || activeJobs.has(id)) return;
    busyActions.add(id);
    let value: StoredSignJob | undefined;
    try {
        value = (await readJobs(session)).jobs.find(entry => entry.row.id === id);
        if (!value || !session.current() || value.job.signature !== session.signature || !restartEligible(value.job)
            || pendingDeadline(value.row.leaseUntil, Date.now(), SIGN_OUTBOX_LEASE_MS)) return;
        const original = value.job;
        const op = { ...session, current: () => session.current() && recoveryParentCurrent(original) && !signedEvidence(original) };
        const actualHash = await palmOriginalPhotoHash(original.photo);
        if (!op.current() || original.originalSHA256 !== actualHash) return;
        const nextId = original.restartIntent?.requestId || crypto.randomUUID();
        const fingerprint = await palmOriginalFingerprint(original.code, nextId, original.signMan, original.photo);
        if (original.restartIntent && original.restartIntent.originalFingerprint !== fingerprint) return;
        await updateJob(op, value, { originalSHA256: actualHash,
            restartIntent: original.restartIntent || { requestId: nextId, originalFingerprint: fingerprint, pending: false },
            phase: 'action', readOnlyProbe: true, continueRequested: false, continuationAllowed: false,
            message: '⏳ កំពុងពិនិត្យផ្លូវចាប់ផ្ដើមថ្មី; មិនផ្ញើរូប ឬ Sign។' }, 0, Date.now() + SIGN_OUTBOX_LEASE_MS);
        await publish(op);
        const body = { barcode: original.code, requestId: nextId, restartFromRequestId: original.requestId,
            photoProtocol: PHOTO_PROTOCOL, originalSHA256: actualHash, reservationProtocol: PALM_RESERVATION_PROTOCOL, originalFingerprint: fingerprint };
        let out = await request(op, { ...body, stage: 'receipt-restart-check' }, op.current);
        if (!op.current()) return;
        const challenge = out.res.status === 409 && out.body?.code === 'ZTO_PALM_SIGN_RESTART_CONFIRM_REQUIRED'
            && out.body.stage === 'receipt-restart-check' && restartBinding(out.body, value.job)
            && typeof out.body.restartToken === 'string' && out.body.restartToken.length > 0 && out.body.restartToken.length <= 8192
            && Number.isFinite(out.body.expiresAt) && out.body.expiresAt > getServerNow();
        if (challenge) {
            await updateJob(op, value, {}, 0, Date.now() + SIGN_OUTBOX_LEASE_MS);
            if (!confirm('ចាប់ផ្ដើម Sign ថ្មីសម្រាប់ ' + original.code + '?\nរូប ឬសំណើមុនអាចបានទៅដល់ ZTO ឬមកដល់យឺត។ សូមផ្ទៀងក្នុង ZTO មុនបញ្ជាក់ ព្រោះការបន្តអាចផ្ញើស្ទួន។ រូបដើមនៅរក្សាទុក។\nជំហាននេះមិនផ្ញើរូប ឬ Sign ទេ។ ក្រោយចាប់ផ្ដើមថ្មី អ្នកត្រូវពិនិត្យរូប ឈ្មោះអ្នកទទួល ហើយចុចបន្តដោយចេតនា។')) {
                await updateJob(op, value, { restartIntent: original.restartIntent?.pending ? original.restartIntent : undefined, message: original.message });
                return;
            }
            await updateJob(op, value, { restartIntent: { ...value.job.restartIntent!, pending: true } }, 0, Date.now() + SIGN_OUTBOX_LEASE_MS);
            out = await request(op, { ...body, stage: 'receipt-restart-confirm', restartToken: out.body.restartToken, restartConsent: true }, op.current);
            if (!op.current()) return;
        }
        const successor = { ...value.job, requestId: nextId, reservationProtocol: PALM_RESERVATION_PROTOCOL,
            originalFingerprint: fingerprint, reservationOwner: undefined, reservationToken: undefined };
        if (restartBinding(out.body, value.job) && out.body.restarted === true && reservationReady(out, successor)) {
            await updateJob(op, value, { requestId: nextId, originalFingerprint: fingerprint, reservationProtocol: PALM_RESERVATION_PROTOCOL,
                reservationOwner: out.body.reservationOwner, reservationToken: out.body.reservationToken, everReserved: true,
                restartHistory: [...(original.restartHistory || []).slice(-4), { requestId: original.requestId, originalFingerprint: original.originalFingerprint, reservationOwner: original.reservationOwner, at: Date.now() }],
                restartIntent: undefined, recovery: original.recovery || { archivedAt: Date.now(), previousPhase: original.phase, previousMessage: original.message },
                recoveryCheck: { at: Date.now(), signed: false, photoVerified: false, continuation: 'reserved', statusChecked: true, statusUnavailable: false },
                phase: 'action', readOnlyProbe: true, autoConfirm: false, verificationRequired: false, continuationAllowed: false, continueRequested: false,
                manualReviewReason: undefined, confirmationToken: '', warningToken: '', dispatchProof: '', attempts: 0,
                scanCompleted: false, photoVerified: false, signedCleanupConfirmed: false, signedCleanupAt: undefined, signedVerifiedAt: undefined,
                message: '✅ ចាប់ផ្ដើមការងារថ្មីរួច; មិនទាន់ផ្ញើរូប ឬ Sign។ សូមពិនិត្យរូបដើម និងឈ្មោះអ្នកទទួល រួចចុចបន្តដោយចេតនា។' });
        } else {
            const bound = out.res.status === 409 && restartBinding(out.body, value.job);
            const wait = bound && out.body.code === 'ZTO_PALM_SIGN_RESTART_WAIT';
            const minutes = Number.isFinite(out.body?.retryAfterMs) && out.body.retryAfterMs > 0
                ? Math.min(15, Math.ceil(out.body.retryAfterMs / 60000)) : 0;
            const reasons: Record<string, string> = {
                signed: 'ZTO បង្ហាញថា Sign រួច។ សូមចុចពិនិត្យស្ថានភាពធម្មតាឡើងវិញ; មិនចាប់ផ្ដើម Sign ថ្មី។',
                ineligible: 'កញ្ចប់មិនត្រូវលក្ខខណ្ឌចាប់ផ្ដើមថ្មី។ សូមពិនិត្យស្ថានភាពក្នុង ZTO។',
                active: 'សំណើមុនកំពុងដំណើរការ។ សូមរង់ចាំ ហើយពិនិត្យម្ដងទៀត។',
                conflict: 'សំណើលើ Server បានផ្លាស់ប្តូរ។ សូមពិនិត្យការចាប់ផ្ដើមថ្មីម្ដងទៀត។',
                not_restartable: 'ស្ថានភាពសំណើមុនមិនអនុញ្ញាតឱ្យចាប់ផ្ដើមថ្មី។ សូមពិនិត្យក្នុង ZTO។',
                missing_journal: 'Server មិនរកឃើញកំណត់ត្រាសំណើមុន។ សូមពិនិត្យស្ថានភាពឡើងវិញ។'
            };
            const reason = bound && out.body.code === 'ZTO_PALM_SIGN_RESTART_BLOCKED' ? reasons[out.body.reason] : '';
            await updateJob(op, value, { message: wait ? '⏳ Server កំណត់ឱ្យរង់ចាំ' + (minutes ? ' ប្រហែល ' + minutes + ' នាទី' : '') + '។ សូមពិនិត្យការចាប់ផ្ដើមថ្មីម្ដងទៀតពេលក្រោយ; មិនផ្ញើ Sign។'
                : '⚠️ ' + (reason || 'មិនទាន់បញ្ជាក់ការចាប់ផ្ដើមថ្មីបាន។ សូមពិនិត្យម្ដងទៀត។') + ' មិនសាកបញ្ជាក់ឡើងវិញដោយស្វ័យប្រវត្តិ។ រូបដើមនៅរក្សាទុក។' });
        }
    } catch {
        if (value && session.current()) {
            try { await updateJob(session, value, { phase: 'action', readOnlyProbe: true, message: '⚠️ មិនទាន់ដឹងលទ្ធផលចាប់ផ្ដើមថ្មី។ សូមចុចពិនិត្យការចាប់ផ្ដើមថ្មី; មិនផ្ញើរូប ឬ Sign ស្ទួន។ រូបដើមនៅរក្សាទុក។' }); } catch {}
        }
    } finally {
        busyActions.delete(id);
        if (session.current()) await publish(session).catch(() => {});
    }
}

async function setRetainedVisibility(id: string, dismissed: boolean) {
    const local = localContext();
    if (!local || busyActions.has(id) || activeJobs.has(id)) return;
    const op = { ...local, signature: palmSignConfigKey(getLookupApiConfig()) };
    busyActions.add(id);
    try {
        const value = (await readJobs(op)).jobs.find(entry => entry.row.id === id);
        if (!value?.job.recovery || !op.current() || activeJobs.has(id) || value.row.leaseUntil > 0) return;
        await updateJob(op, value, { recovery: { ...value.job.recovery, dismissed } });
    } catch {
        if (op.current()) showToast('⚠️ ប្ដូរបញ្ជីមិនបាន។ រូប និងការងារដើមនៅដដែល។');
    } finally {
        busyActions.delete(id);
        if (op.current()) await publish(op).catch(() => {});
    }
}

export async function actOnQueuedSign(id: string, action: 'approve' | 'cancel' | 'retry' | 'continue' | 'archive' | 'recover' | 'resume' | 'dismiss' | 'show' | 'delete' | 'restart') {
    if (action === 'restart') return restartQueuedSign(id);
    if (action === 'delete') return deleteQueuedSign(id);
    if (action === 'dismiss' || action === 'show') return setRetainedVisibility(id, action === 'dismiss');
    if (action === 'archive') return archiveQueuedSign(id);
    if (action === 'recover' || action === 'resume') return recoverQueuedSign(id, action === 'resume');
    const op = context();
    if (!op || busyActions.has(id)) return;
    busyActions.add(id);
    try {
        const value = (await readJobs(op)).jobs.find((v) => v.row.id === id);
        if (!value || value.job.restartIntent?.pending || value.job.recovery || value.job.verificationRequired || !op.current() || pendingDeadline(value.row.leaseUntil, Date.now(), SIGN_OUTBOX_LEASE_MS) || value.job.signature !== op.signature || value.job.phase !== 'action') return;
        if (matchingTrash(value.job) && action !== 'retry') {
            await updateJob(op, value, { phase: 'action', manualReviewReason: 'parent_in_trash', readOnlyProbe: true,
                continuationAllowed: false, continueRequested: false, message: '⚠️ កញ្ចប់ដើមបង្ហាញក្នុងធុងសំរាម។ សូមរក្សាទុករូបដើម ហើយពិនិត្យស្ថានភាពដោយមិនផ្ញើ Sign។' });
            return;
        }
        if (value.job.manualReviewReason === 'parent_in_trash' && action !== 'retry') return;
        if (action === 'cancel') {
            if (value.job.warningToken) {
                if (!confirm('បោះបង់ការងារដែលមិនទាន់ផ្ញើ និងលុបរូបដើមក្នុងឧបករណ៍?\n\nសូមប្រើ «រក្សាទុករូបដើម» មុនបញ្ជាក់ បើអ្នកចង់រក្សាច្បាប់ចម្លង។ រូបនឹងត្រូវលុបតែក្រោយ Server បញ្ជាក់ថាការងារមិនទាន់ផ្ញើ និងបានបោះបង់។')) return;
                await updateJob(op, value, { cancelRequested: true, cancelConfirmationToken: value.job.warningToken, phase: 'checking',
                    photoPollStep: 0, photoPollDelay: undefined, message: '⏳ កំពុងបញ្ជាក់ការបោះបង់; រូបដើមនៅរក្សាទុក។' });
            }
        } else if (action === 'continue') {
            if (value.job.continuationAllowed !== true || value.job.warningToken || value.job.refreshStage) return;
            await updateJob(op, value, { phase: 'checking', userRetryAt: getServerNow(), continueRequested: true, refreshRequestId: crypto.randomUUID(), refreshStage: 'receipt-prewrite-refresh', readOnlyProbe: false, autoConfirm: false,
                confirmationToken: '', warningRefreshRetryAfter: 0, photoPollStep: 0, photoPollDelay: undefined, message: '⏳ កំពុងផ្ទៀងលក្ខខណ្ឌថ្មី មុនបន្ត Sign ដែលអ្នកបានស្នើ។' });
        } else if (action === 'approve') {
            if (value.job.warningToken) await updateJob(op, value, { userRetryAt: getServerNow(), phase: 'queued', readOnlyProbe: false, refreshRequestId: crypto.randomUUID(), refreshStage: undefined, warningRefreshRetryAfter: 0, confirmationToken: value.job.warningToken, warningToken: '', message: '⏳ កំពុងផ្ញើរូប និង Sign ទៅ ZTO' });
        } else {
            await updateJob(op, value, { phase: 'checking', readOnlyProbe: true, continueRequested: false, photoPollStep: 0, photoPollDelay: undefined, manualReviewReason: undefined, confirmationToken: value.job.refreshStage === 'receipt-warning-refresh' ? value.job.confirmationToken : '', warningToken: '', message: '⏳ កំពុងពិនិត្យ ZTO' });
        }
    } catch (_) {
        if (op.current()) showToast('⚠️ រក្សាទុកការសម្រេចមិនបាន។ សូមសាកម្ដងទៀត។');
    } finally {
        busyActions.delete(id);
        if (op.current()) await publish(op).catch(() => {});
    }
    void runPalmSignOutbox();
}

export function setupPalmSignOutbox(scope: LifecycleScope) {
    lifecycle = scope;
    const wake = () => {
        const op = localContext();
        if (!op || palmSignOutboxState.owner !== op.owner) { palmSignOutboxState.rows = []; palmSignOutboxState.recoveryRows = []; palmSignOutboxState.owner = op?.owner || ''; palmSignOutboxState.message = ''; }
        if (!scope.disposed) void runPalmSignOutbox();
    };
    scope.listen(window, 'online', wake);
    scope.listen(document, 'visibilitychange', wake);
    scope.every(5000, wake);
    scope.onDispose(firebaseState.subscribe(wake));
    scope.onDispose(securityState.subscribe(wake));
    scope.onLoad(wake);
}
