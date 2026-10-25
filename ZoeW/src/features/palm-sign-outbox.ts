import { createStore, registerStore } from '../core/store';
import { dataState, firebaseState, securityState } from '../core/state';
import { shopScope } from '../core/shop-scope';
import { barcodeSignIdentity } from '../domain/barcode';
import { getLookupApiConfig } from './lookup-config';
import { lookupApiIsPalm } from './customer-table-prefetch';
import { noteZtoPalmSessionRejected } from './zto-palm-login';
import { fetchWithTimeout } from '../services/network';
import { endpoint, failureMessage, headersFor, palmSignConfigKey, recordSigned, requestPalmSignWithConfirmation } from '../services/palm-sign-transport';
import { addSignJob, listSignJobs, openSignJob, replaceSignJob, sealSignJob, SIGN_OUTBOX_LEASE_MS, type SignJob, type StoredSignJob } from '../services/palm-sign-outbox-store';
import type { LifecycleScope } from '../app/lifecycle/scope';
import { showToast } from '../ui/toast';
import { documentIsHidden } from '../platform/document-io';

export type SignQueueView = { id: string; code: string; message: string; phase: SignJob['phase']; warning?: string; busy: boolean };
export const palmSignOutboxState = createStore('palmSignOutbox', { owner: '', rows: [] as SignQueueView[], message: '' });
registerStore(palmSignOutboxState);
let running: Promise<void> | null = null;
let rerun = false;
const activeJobs = new Map<string, Promise<void>>();
let lifecycle: LifecycleScope | null = null;
const busyActions = new Set<string>();

function pendingDeadline(deadline: number, now: number, maximum: number) {
    return Number.isFinite(deadline) && deadline > now && deadline - now <= maximum;
}

function waiting(row: StoredSignJob['row'], now: number) {
    return pendingDeadline(row.leaseUntil, now, SIGN_OUTBOX_LEASE_MS) || pendingDeadline(row.due, now, 15000);
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
    if (!barcode) throw new Error('outbox:parcel');
    const row = await sealSignJob(op.owner, op.key, { ...input, signature: op.signature, parcelIdentity: barcodeSignIdentity(item, barcode), phase: 'queued', attempts: 0, message: '⏳ កំពុងផ្ញើរូប និង Sign ទៅ ZTO' });
    let added = await addSignJob(row, () => op.current() && current());
    if (!added && op.current() && current()) {
        const existing = (await listSignJobs(op.owner)).find((value) => value.id === row.id);
        if (existing && !await openSignJob(existing, op.key).then(() => true, () => false)) added = await replaceSignJob(existing, row, () => op.current() && current());
    }
    if (!added) throw new Error('outbox:duplicate');
    if (op.current()) {
        if (palmSignOutboxState.owner !== op.owner) palmSignOutboxState.rows = [];
        palmSignOutboxState.owner = op.owner;
        palmSignOutboxState.rows = palmSignOutboxState.rows.concat({ id: row.id, code: input.code, phase: 'queued', message: '⏳ កំពុងផ្ញើរូប និង Sign ទៅ ZTO', busy: false });
    }
    void runPalmSignOutbox();
}

async function updateJob(op: NonNullable<ReturnType<typeof context>>, value: StoredSignJob, patch: Partial<SignJob>, due = 0, leaseUntil = 0) {
    const job = { ...value.job, ...patch };
    const sealed = await sealSignJob(op.owner, op.key, job);
    const next = { ...sealed, revision: value.row.revision + 1, due, leaseUntil };
    if (!await replaceSignJob(value.row, next, op.current)) throw new Error('outbox:changed');
    value.row = next;
    value.job = job;
}

async function request(op: NonNullable<ReturnType<typeof context>>, body: object) {
    const headers = { ...await headersFor(getLookupApiConfig()), 'Content-Type': 'application/json' };
    if (!op.current()) throw new Error('outbox:session');
    return fetchWithTimeout(endpoint(op.cfg, 'sign'), { method: 'POST', headers, body: JSON.stringify(body) },
        45000, 'Palm sign timed out', (r) => r.json().catch(() => null));
}

function confirmed(out, code: string, requestId: string) {
    return out.res.ok && out.body?.success === true && out.body.barcode === code && out.body.stage === 'receipt'
        && out.body.ztoClosed === true && out.body.photoAccepted === true && out.body.requestId === requestId;
}

function warningOf(out, code: string) {
    const b = out.body;
    return out.res.status === 409 && b?.code === 'ZTO_PALM_SIGN_CONFIRM_REQUIRED' && b.barcode === code && b.stage === 'receipt'
        && typeof b.message === 'string' && b.message.trim() && b.message.length <= 4000
        && typeof b.confirmationToken === 'string' && b.confirmationToken.length > 0 && b.confirmationToken.length <= 8192;
}

async function finishLocal(op: NonNullable<ReturnType<typeof context>>, value: StoredSignJob) {
    if (!op.current()) return;
    if (await recordSigned(value.job.itemId, value.job.code, op.current, value.job.parcelIdentity) && op.current()) {
        if (await replaceSignJob(value.row, null, op.current)) showToast('✅ ' + value.job.code + ' · ZTO ទទួលរូប និង Sign រួច');
    } else if (op.current()) {
        await updateJob(op, value, { message: '✅ ZTO ទទួលរូប និង Sign រួច · ⏳ រង់ចាំរក្សាទុកក្នុង ZoeW' }, Date.now() + 10000);
    }
}

async function processJob(op: NonNullable<ReturnType<typeof context>>, value: StoredSignJob) {
    const { job } = value;
    if (!op.current() || job.phase === 'action' || waiting(value.row, Date.now())) return;
    if (job.signature !== op.signature) return;
    const lease = { ...value.row, revision: value.row.revision + 1, leaseUntil: Date.now() + SIGN_OUTBOX_LEASE_MS };
    if (!await replaceSignJob(value.row, lease, op.current)) return;
    value.row = lease;
    try {
        const item = dataState.scanHistory.find((v) => v.id === job.itemId);
        const barcode = item?.barcodes?.find((b) => b.code === job.code);
        if (barcode && barcodeSignIdentity(item, barcode) !== job.parcelIdentity) {
            await updateJob(op, value, { phase: 'action', message: '⚠️ កញ្ចប់នេះត្រូវបានស្តារ ឬបញ្ចូលឡើងវិញ។ សូមពិនិត្យការងារ Sign ដើមក្នុង ZTO។', confirmationToken: '', warningToken: '' });
            return;
        }
        if (job.phase === 'confirmed') { await finishLocal(op, value); return; }
        let out;
        if (job.phase === 'checking') {
            out = await request(op, { stage: 'receipt-status', barcode: job.code, requestId: job.requestId });
            if (!op.current()) return;
            if (out.body?.code === 'ZTO_PALM_SIGN_RETRY_READY' && out.body.barcode === job.code && out.body.retryable === true) {
                const status = await request(op, { stage: 'status', barcode: job.code, requestId: job.requestId });
                if (!op.current()) return;
                if (!status.res.ok || status.body?.success !== true || status.body.barcode !== job.code || status.body.stage !== 'status') {
                    out = status;
                } else if (status.body.ztoClosed !== false || status.body.dispatched !== true || typeof status.body.dispatchProof !== 'string' || !status.body.dispatchProof) {
                    await updateJob(op, value, { phase: 'action', message: '⚠️ ស្ថានភាព ZTO ប្រែ។ សូមពិនិត្យកញ្ចប់ក្នុង ZTO មុនបន្ត។', confirmationToken: '', warningToken: '' });
                    return;
                } else {
                    await updateJob(op, value, { dispatchProof: status.body.dispatchProof, phase: 'queued', confirmationToken: '' }, 0, lease.leaseUntil);
                    out = null;
                }
            }
        }
        if (!out) {
            if (!dataState.scanHistory.some((item) => item.id === job.itemId && item.barcodes?.some((b) => b.code === job.code))) {
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
                return !!currentBarcode && barcodeSignIdentity(currentItem, currentBarcode) === send.parcelIdentity;
            };
            const body = { barcode: send.code, requestId: send.requestId, stage: 'receipt', signMan: send.signMan, photo: send.photo,
                dispatchProof: send.dispatchProof, confirmationToken: send.confirmationToken || undefined, background: true };
            out = send.autoConfirm === true
                ? await requestPalmSignWithConfirmation((input) => request(op, input), body, current, async (confirmation) => {
                    await updateJob(op, value, { confirmationToken: confirmation.token, warningToken: '' }, 0, Date.now() + SIGN_OUTBOX_LEASE_MS);
                })
                : await request(op, body);
        }
        if (!op.current()) return;
        if (confirmed(out, job.code, job.requestId)) {
            await updateJob(op, value, { phase: 'confirmed', message: '✅ ZTO ទទួលរូប និង Sign រួច', confirmationToken: '', warningToken: '' }, 0, value.row.leaseUntil);
            await finishLocal(op, value);
        } else if (warningOf(out, job.code)) {
            await updateJob(op, value, { phase: 'action', message: out.body.message, confirmationToken: '', warningToken: out.body.confirmationToken });
            showToast('⚠️ ' + job.code + ' · សូមបើកបញ្ជី Sign ដើម្បីបញ្ជាក់សារ ZTO');
        } else if (out.body?.code === 'ZTO_PALM_DISPATCH_REQUIRED') {
            await updateJob(op, value, { phase: 'checking', confirmationToken: '', message: '⏳ កំពុងផ្ទៀងស្ថានភាពចែកចាយឡើងវិញ' }, Date.now() + 2000);
        } else if (out.body?.uncertain || !out.body?.code || out.res.status >= 500 && out.body?.code !== 'ZTO_PALM_SIGN_PHOTO_REJECTED') {
            await updateJob(op, value, { phase: 'checking', message: '⏳ រង់ចាំផ្ទៀង ZTO · មិនទាន់បញ្ជាក់ Sign' }, Date.now() + 15000);
        } else {
            const code = out.body.code;
            const message = code === 'ZTO_PALM_SIGN_CHECK_REJECTED' && typeof out.body.message === 'string' && out.body.message.length <= 4000
                ? out.body.message : failureMessage(code, out.body.reason);
            await updateJob(op, value, { phase: 'action', message, warningToken: '', confirmationToken: '' });
            if (code === 'ZTO_AUTH_EXPIRED' || code === 'ZTO_PALM_RELOGIN_REQUIRED') noteZtoPalmSessionRejected(op.cfg);
        }
    } catch (_) {
        if (op.current()) {
            try { await updateJob(op, value, { message: '⏳ បណ្ដាញ ឬការរក្សាទុកមិនទាន់បញ្ជាក់ · ការងារនៅរង់ចាំ' }, Date.now() + 15000); } catch {}
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
    palmSignOutboxState.rows = jobs.map(({ row, job }) => ({ id: row.id, code: job.code, phase: job.phase,
        message: job.signature === op.signature ? job.message : '⚠️ ការភ្ជាប់ ZTO ប្រែ។ សូមស្តារការភ្ជាប់ដើមដើម្បីបន្ត Sign។',
        warning: job.warningToken ? job.message : '', busy: pendingDeadline(row.leaseUntil, Date.now(), SIGN_OUTBOX_LEASE_MS) || busyActions.has(row.id) || activeJobs.has(row.id) }));
}

export async function refreshPalmSignQueue() {
    const local = localContext();
    const op = local && { ...local, signature: palmSignConfigKey(getLookupApiConfig()) };
    if (!op) { palmSignOutboxState.owner = ''; palmSignOutboxState.rows = []; return; }
    try { await publish(op); }
    catch { if (op.current()) palmSignOutboxState.message = '⚠️ បើកបញ្ជី Sign ដែលរក្សាទុកមិនបាន។ សូមកុំលុបទិន្នន័យ App។'; }
}

export function runPalmSignOutbox(): Promise<void> {
    if (running) { rerun = true; return running; }
    const op = context();
    if (!op) return refreshPalmSignQueue();
    if (palmSignOutboxState.owner !== op.owner) { palmSignOutboxState.owner = op.owner; palmSignOutboxState.rows = []; }
    running = (async () => {
        try {
            const loaded = await readJobs(op);
            if (!op.current()) return;
            if (navigator.onLine !== false && !documentIsHidden() && (!lifecycle || !lifecycle.disposed)) {
                for (const value of loaded.jobs) {
                    if (activeJobs.size >= 2 || !op.current()) break;
                    if (activeJobs.has(value.row.id) || value.job.phase === 'action' || value.job.signature !== op.signature
                        || waiting(value.row, Date.now())) continue;
                    const work = processJob(op, value).catch(() => {}).finally(() => {
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

export async function actOnQueuedSign(id: string, action: 'approve' | 'cancel' | 'retry') {
    const op = context();
    if (!op || busyActions.has(id)) return;
    busyActions.add(id);
    try {
        const value = (await readJobs(op)).jobs.find((v) => v.row.id === id);
        if (!value || !op.current() || pendingDeadline(value.row.leaseUntil, Date.now(), SIGN_OUTBOX_LEASE_MS) || value.job.signature !== op.signature || value.job.phase !== 'action') return;
        if (action === 'cancel') {
            if (value.job.warningToken) await replaceSignJob(value.row, null, op.current);
        } else if (action === 'approve') {
            if (value.job.warningToken) await updateJob(op, value, { phase: 'queued', confirmationToken: value.job.warningToken, warningToken: '', message: '⏳ កំពុងផ្ញើរូប និង Sign ទៅ ZTO' });
        } else {
            await updateJob(op, value, { phase: 'checking', confirmationToken: '', warningToken: '', message: '⏳ កំពុងពិនិត្យ ZTO' });
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
        if (!op || palmSignOutboxState.owner !== op.owner) { palmSignOutboxState.rows = []; palmSignOutboxState.owner = op?.owner || ''; palmSignOutboxState.message = ''; }
        if (!scope.disposed) void runPalmSignOutbox();
    };
    scope.listen(window, 'online', wake);
    scope.listen(document, 'visibilitychange', wake);
    scope.every(5000, wake);
    scope.onDispose(firebaseState.subscribe(wake));
    scope.onDispose(securityState.subscribe(wake));
    scope.onLoad(wake);
}
