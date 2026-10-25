import { endpoint, failureMessage, headersFor, palmSignConfigKey, recordSigned, requestPalmSignWithConfirmation } from '../services/palm-sign-transport';
import { canQueuePalmSign, persistPalmSignJob } from './palm-sign-outbox';
import { capturePalmSignPhoto } from '../services/palm-sign-camera';
import { dataState, firebaseState, securityState } from '../core/state';
import { palmSignState, type PalmSignResult, type PalmSignConfirmation } from '../core/palm-sign-state';
import { modalIsOpen } from '../core/modals';
import { shopScope } from '../core/shop-scope';
import { barcodeSignIdentity } from '../domain/barcode';
import { getLookupApiConfig } from './lookup-config';
import { lookupApiIsPalm } from './customer-table-prefetch';
import { noteZtoPalmSessionRejected } from './zto-palm-login';
import { fetchWithTimeout } from '../services/network';
import { playBeep, primeBeep } from '../services/history-write';
import { hapticScan } from '../platform/haptics';
import { closeModal, openModalHelper } from '../ui/modal';
import { showToast } from '../ui/toast';

const pendingPalmSignPhotos = new Map<string, { current: () => boolean }>();
let palmSignWrites: { database: unknown; auth: number; shop: string; tail: Promise<void> } | null = null;

function recordPalmSignResult(...args: Parameters<typeof recordSigned>) {
    const [itemId, code, current, expectedIdentity, signedAt] = args;
    if (!current()) return Promise.resolve(false);
    const shop = shopScope();
    if (!palmSignWrites || palmSignWrites.database !== firebaseState.db || palmSignWrites.auth !== firebaseState.authGeneration || palmSignWrites.shop !== shop) {
        palmSignWrites = { database: firebaseState.db, auth: firebaseState.authGeneration, shop, tail: Promise.resolve() };
    }
    const owner = palmSignWrites;
    const item = dataState.scanHistory.find((row) => row.id === itemId);
    const barcode = item?.barcodes?.find((row) => row.code === code);
    const identity = expectedIdentity ?? (barcode ? barcodeSignIdentity(item, barcode) : undefined);
    const result = owner.tail.then(() => recordSigned(itemId, code, current, identity, signedAt));
    owner.tail = result.then(() => {}, () => {});
    return result;
}

export function palmSignMode() {
    const cfg = getLookupApiConfig();
    return !!(cfg?.enabled && lookupApiIsPalm(cfg));
}

export function refreshPalmSignMode() {
    palmSignState.mode = palmSignMode();
    palmSignState.generation++;
    pendingPalmSignPhotos.clear();
    if (modalIsOpen('ztoPalmSignModal')) closeModal('ztoPalmSignModal');
}

export const PALM_SIGN_STATUS_CONCURRENCY = 4;

export const PALM_SIGN_SEND_CONCURRENCY = 3;

async function runPool<T>(items: T[], limit: number, work: (item: T) => Promise<boolean | void>) {
    let next = 0;
    let stopped = false;
    const lane = async () => {
        while (!stopped && next < items.length) {
            const item = items[next++];
            if (await work(item) === false) stopped = true;
        }
    };
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, lane));
}

function primeScanFeedback() {
    primeBeep();
}

function scanSuccessFeedback() {
    playBeep();
    hapticScan();
}

export function openZtoPalmSign(itemId: string, barcode?: string) {
    if (!palmSignMode()) return;
    if (palmSignState.busy || palmSignState.checking || palmSignState.confirmation || Object.keys(palmSignState.dispatching).length) {
        showToast('⏳ ការ Sign មុនកំពុងរង់ចាំចម្លើយ ZTO — សូមរង់ចាំបន្តិច រួចចុចម្តងទៀត។');
        return;
    }
    const cfg = getLookupApiConfig();
    if ((!cfg?.palmTokenEnc && !cfg?.palmShared) || !securityState.lookupSecretKey) {
        showToast('⚠️ សូមបើក API ស្វែងរកអតិថិជនដោយ PIN ហើយ Login ZTO ជាមុនសិន។');
        return;
    }
    const item = dataState.scanHistory.find((row) => row.id === itemId);
    const codes = Array.isArray(item?.barcodes) ? item.barcodes.filter((b) => !b.isClosed && (!barcode || b.code === barcode)).map((b) => b.code) : [];
    if (!codes.length) { showToast('⚠️ រកមិនឃើញកញ្ចប់បើកដែលមាន Barcode សម្រាប់ Sign។'); return; }
    primeScanFeedback();
    palmSignState.generation++;
    pendingPalmSignPhotos.clear();
    palmSignState.itemId = itemId;
    palmSignState.codes = [...new Set<string>(codes)];
    palmSignState.selectedCodes = [];
    palmSignState.photos = {};
    palmSignState.checked = {};
    palmSignState.dispatching = {};
    palmSignState.confirmation = null;
    palmSignState.warnings = {};
    palmSignState.problemScans = {};
    palmSignState.signMan = '';
    palmSignState.requestId = crypto.randomUUID();
    palmSignState.dispatchResults = [];
    palmSignState.message = '';
    palmSignState.results = [];
    openModalHelper('ztoPalmSignModal');
    void checkZtoPalmSignStages();
}

export function cancelZtoPalmSign() {
    palmSignState.generation++;
    pendingPalmSignPhotos.clear();
    palmSignState.codes = [];
    palmSignState.selectedCodes = [];
    palmSignState.itemId = '';
    palmSignState.checked = {};
    palmSignState.dispatching = {};
    palmSignState.confirmation = null;
    palmSignState.warnings = {};
    palmSignState.problemScans = {};
    palmSignState.signMan = '';
    palmSignState.checking = false;
    palmSignState.photos = {};
    palmSignState.dispatchResults = [];
    palmSignState.requestId = '';
    palmSignState.message = '';
    palmSignState.results = [];
}

export function palmSignCodeOf(raw: string) {
    const wanted = String(raw || '').trim().toUpperCase();
    return wanted ? palmSignState.codes.find((value) => value.toUpperCase() === wanted) || '' : '';
}

export function palmSignSigned(code: string) {
    return palmSignState.results.some((row) => row.code === code && row.state === 'signed');
}

export function palmSignProof(code: string) {
    return palmSignState.dispatchResults.find((row) => row.code === code && row.state === 'dispatched' && row.proof)?.proof || '';
}

export function palmSignReady(code: string) {
    return !!palmSignState.checked[code] && !!palmSignState.photos[code] && !!palmSignProof(code) && !palmSignSigned(code)
        && !palmSignState.results.some((row) => row.code === code && ['unknown', 'queued'].includes(row.state));
}

export function palmSignReadyCodes() {
    return palmSignState.selectedCodes.filter((code) => palmSignReady(code));
}

export function removePalmSignScan(code: string) {
    if (palmSignState.busy || palmSignState.confirmation || !palmSignState.photos[code] || palmSignSigned(code)
        || palmSignState.results.some((row) => row.code === code && ['queued', 'unknown'].includes(row.state))) return;
    const photos = { ...palmSignState.photos };
    delete photos[code];
    palmSignState.photos = photos;
    palmSignState.selectedCodes = palmSignState.selectedCodes.filter((value) => value !== code);
    palmSignState.results = palmSignState.results.filter((row) => row.code !== code || row.state === 'unknown');
}

export function palmSignWantsFrame(code: string) {
    const known = palmSignCodeOf(code);
    return !known || (!palmSignSigned(known) && !palmSignState.photos[known]);
}

export function acceptPalmSignBarcode(raw: string, capturedPhoto?: string, replacePhoto = false) {
    if (!modalIsOpen('ztoPalmSignModal')) return false;
    if (palmSignState.confirmation) return true;
    const code = palmSignCodeOf(raw);
    if (!code) { palmSignState.message = 'Barcode នេះមិនមែនរបស់កញ្ចប់នេះទេ។'; return true; }
    if (palmSignState.busy || palmSignState.results.some((row) => row.code === code && row.state === 'unknown')) return true;
    if (palmSignSigned(code)) { palmSignState.message = '✅ ' + code + ' Sign រួចហើយ'; return true; }
    if (palmSignState.results.some((row) => row.code === code && row.state === 'queued')) { palmSignState.message = '⏳ ' + code + ' កំពុងរង់ចាំ ZTO'; return true; }
    if (palmSignState.photos[code] && !replacePhoto) {
        if (!palmSignState.selectedCodes.includes(code)) palmSignState.selectedCodes = palmSignState.selectedCodes.concat(code);
        void dispatchPalmSignCode(code);
        return true;
    }
    if (capturedPhoto === undefined) {
        if (pendingPalmSignPhotos.get(code)?.current()) return true;
        const op = operation();
        pendingPalmSignPhotos.set(code, op);
        void capturePalmSignPhoto().then((photo) => {
            if (op.current()) acceptPalmSignBarcode(code, photo);
        }).catch(() => {
            if (op.current()) palmSignState.message = 'ចាប់រូបភាពមិនបាន។ សូមថតរូបកញ្ចប់នេះ ឬជ្រើសពី Gallery។';
        }).finally(() => {
            if (pendingPalmSignPhotos.get(code) === op) pendingPalmSignPhotos.delete(code);
        });
        return true;
    }
    const photo = capturedPhoto;
    if (!photo) { palmSignState.message = 'សូមបើកកាមេរ៉ាដើម្បីចាប់រូបពេលស្កេន ឬថតរូបកញ្ចប់នេះ។'; return true; }
    palmSignState.photos = { ...palmSignState.photos, [code]: photo };
    if (!palmSignState.selectedCodes.includes(code)) palmSignState.selectedCodes = palmSignState.selectedCodes.concat(code);
    palmSignState.message = '✅ បានស្កេន ' + code;
    scanSuccessFeedback();
    void dispatchPalmSignCode(code);
    return true;
}


function operation() {
    const cfg = getLookupApiConfig();
    const shop = shopScope();
    const auth = firebaseState.authGeneration;
    const signDatabase = firebaseState.db;
    const secret = securityState.lookupSecretKey;
    const generation = palmSignState.generation;
    const itemId = palmSignState.itemId;
    const signature = palmSignConfigKey(cfg);
    const current = () => generation === palmSignState.generation && shopScope() === shop && auth === firebaseState.authGeneration
        && firebaseState.db === signDatabase && securityState.lookupSecretKey === secret && modalIsOpen('ztoPalmSignModal')
        && palmSignConfigKey(getLookupApiConfig()) === signature && palmSignMode();
    const ready = () => (!!op.cfg?.palmTokenEnc || !!op.cfg?.palmShared) && !!securityState.lookupSecretKey && !!shopScope();
    const op = { cfg, itemId, current, ready, generation };
    return op;
}


function finishPalmSign(current: () => boolean) {
    if (!current() || !palmSignState.codes.length || !palmSignState.codes.every((code) =>
        palmSignState.results.some((row) => row.code === code && (row.state === 'queued' || row.state === 'signed' && row.saved === true)))) return false;
    const count = palmSignState.codes.length;
    const queued = palmSignState.results.some((row) => row.state === 'queued');
    if (!queued) scanSuccessFeedback();
    closeModal('ztoPalmSignModal');
    showToast(queued ? '⏳ បានរក្សាការងារ Sign · អាចធ្វើកញ្ចប់បន្ទាប់បាន · មើលលទ្ធផលក្នុងបញ្ជី Sign' : '✅ ZTO Sign ជោគជ័យ ' + count + ' កញ្ចប់');
    return true;
}

export async function submitZtoPalmSign(codes: string[] = palmSignReadyCodes()) {
    if (palmSignState.confirmation) return;
    return sendPalmSign(codes);
}

export function cancelPalmSignConfirmation() {
    if (palmSignState.busy || !palmSignState.confirmation) return;
    const dispatching = palmSignState.confirmation.stage === 'dispatch';
    palmSignState.confirmation = null;
    palmSignState.message = dispatching ? 'បានបោះបង់ការបញ្ជាក់។ កញ្ចប់នេះមិនទាន់បានចែកចាយទេ (ស្កេនម្តងទៀតដើម្បីសាក)។'
        : 'បានបោះបង់ការបញ្ជាក់។ កញ្ចប់នេះមិនទាន់បាន Sign ទេ។';
}

export async function confirmPalmSignWarning() {
    const pending = palmSignState.confirmation;
    if (!pending || palmSignState.busy) return;
    palmSignState.confirmation = null;
    if (!pending.current()) return;
    if (pending.stage === 'dispatch') {
        palmSignState.message = '';
        return dispatchPalmSignCode(pending.code, pending);
    }
    return sendPalmSign(pending.codes, pending);
}

function storeDispatchResult(result: PalmSignResult) {
    palmSignState.dispatchResults = palmSignState.dispatchResults.filter((row) => row.code !== result.code).concat(result);
}

function storeResult(result: PalmSignResult) {
    palmSignState.results = palmSignState.results.filter((row) => row.code !== result.code).concat(result);
}

function itemHoldsOpen(itemId: string, code: string) {
    const item = dataState.scanHistory.find((row) => row.id === itemId);
    return !!item?.barcodes?.some((b) => b.code === code && !b.isClosed);
}

function currentSignParcel(op: ReturnType<typeof operation>, code: string, expectedIdentity?: string) {
    const item = dataState.scanHistory.find((row) => row.id === op.itemId);
    const barcode = item?.barcodes?.find((entry) => entry.code === code);
    const identity = expectedIdentity ?? (barcode ? barcodeSignIdentity(item, barcode) : '');
    return Object.assign(() => {
        if (!op.current() || !identity) return false;
        const currentItem = dataState.scanHistory.find((row) => row.id === op.itemId);
        const currentBarcode = currentItem?.barcodes?.find((entry) => entry.code === code);
        return !!currentBarcode && barcodeSignIdentity(currentItem, currentBarcode) === identity;
    }, { identity });
}

export async function dispatchPalmSignCode(code: string, approval?: PalmSignConfirmation) {
    if (!palmSignMode() || palmSignState.confirmation || !palmSignState.checked[code] || palmSignProof(code) || palmSignSigned(code)
        || palmSignState.dispatching[code] || !palmSignState.photos[code]) return;
    const op = operation();
    if (!op.ready() || !itemHoldsOpen(op.itemId, code)) return;
    const current = currentSignParcel(op, code);
    palmSignState.dispatching = { ...palmSignState.dispatching, [code]: true };
    let result: PalmSignResult | null = null;
    try {
        const headers = { ...await headersFor(op.cfg), 'Content-Type': 'application/json' };
        if (!op.current()) return;
        const out = await requestPalmSignWithConfirmation((body) => fetchWithTimeout(endpoint(op.cfg, 'sign'), { method: 'POST', headers,
            body: JSON.stringify(body) }, 45000, 'Palm dispatch timed out', (r) => r.json().catch(() => null)),
        { barcode: code, stage: 'dispatch', signMan: '', requestId: palmSignState.requestId,
            confirmationToken: approval?.code === code ? approval.token : undefined }, current,
        ({ message }) => { if (current()) palmSignState.warnings = { ...palmSignState.warnings, [code]: message }; });
        if (!op.current()) return;
        const body = out.body;
        if (out.res.ok && body?.success === true && body.barcode === code && body.stage === 'dispatch' && body.ztoClosed === false
            && typeof body.dispatchProof === 'string' && body.dispatchProof) {
            result = { code, state: 'dispatched', proof: body.dispatchProof, message: '✅ ចែកចាយរួច' };
        } else if (out.res.status === 409 && body?.code === 'ZTO_PALM_SIGN_CONFIRM_REQUIRED' && body.barcode === code && body.stage === 'dispatch'
            && typeof body.message === 'string' && body.message.trim() && body.message.length <= 4000
            && typeof body.confirmationToken === 'string' && body.confirmationToken.length > 0 && body.confirmationToken.length <= 8192) {
            palmSignState.warnings = { ...palmSignState.warnings, [code]: body.message };
            const free = !palmSignState.confirmation && !palmSignState.busy;
            if (free) {
                palmSignState.confirmation = { code, message: body.message, token: body.confirmationToken, codes: [code], current, stage: 'dispatch' };
                palmSignState.message = 'សូមអានសារ ZTO ហើយបញ្ជាក់ ឬបោះបង់។';
            }
            result = { code, state: 'failed', message: free ? '⚠️ ZTO ស្នើឲ្យបញ្ជាក់កញ្ចប់នេះ មុនចែកចាយ។'
                : '⚠️ ZTO ស្នើឲ្យបញ្ជាក់កញ្ចប់នេះ — ស្កេនម្តងទៀតក្រោយបញ្ជាក់កញ្ចប់មុន។' };
        } else if (body?.uncertain || !body?.code || out.res.status >= 500) {
            result = { code, state: 'unknown', message: '⏳ ការចែកចាយមិនទាន់បញ្ជាក់ — ចុច «🔄 ពិនិត្យ ZTO»។' };
        } else {
            const warning = body.code === 'ZTO_PALM_SIGN_CHECK_REJECTED' && typeof body.message === 'string' && body.message.length <= 4000 ? body.message : '';
            if (warning) palmSignState.warnings = { ...palmSignState.warnings, [code]: warning };
            result = { code, state: 'failed', message: warning ? '⛔ ZTO មិនអនុញ្ញាតឲ្យចែកចាយ' : failureMessage(body.code, body.reason) };
            if (body.code === 'ZTO_AUTH_EXPIRED' || body.code === 'ZTO_PALM_RELOGIN_REQUIRED') noteZtoPalmSessionRejected(op.cfg);
        }
    } catch (_) {
        if (current()) result = { code, state: 'unknown', message: '⏳ ចម្លើយចែកចាយពី ZTO មិនទាន់មក — ចុច «🔄 ពិនិត្យ ZTO»។' };
    } finally {
        if (op.generation === palmSignState.generation) {
            const rest = { ...palmSignState.dispatching };
            delete rest[code];
            palmSignState.dispatching = rest;
        }
    }
    if (!result || !op.current()) return;
    storeDispatchResult(result);
    if (result.state === 'unknown') palmSignState.checked = { ...palmSignState.checked, [code]: false };
}

async function sendPalmSign(codes: string[], approval?: PalmSignConfirmation) {
    if (palmSignState.busy || palmSignState.confirmation || !palmSignMode()) return;
    const op = operation();
    if (!op.ready()) return;
    const background = approval?.background ?? canQueuePalmSign();
    if (background && !canQueuePalmSign()) return;
    const signMan = palmSignState.signMan.trim();
    if (!signMan) { palmSignState.message = 'សូមវាយឈ្មោះអ្នកទទួលជាមុនសិន។'; return; }
    const chosen = [...new Set(codes)].filter((code) => palmSignReady(code) && !palmSignState.results.some((row) => row.code === code && row.state !== 'failed'));
    if (!chosen.length) { palmSignState.message = 'សូមស្កេន Barcode ដើម្បីចាប់រូបសិន។'; return; }
    palmSignState.busy = true;
    palmSignState.message = background ? 'កំពុងរក្សារូប និងការងារ Sign…' : 'កំពុង Sign ក្នុង ZTO…';
    const staleProofs: string[] = [];
    try {
        if (background) {
            const jobs = chosen.map((code) => ({ current: currentSignParcel(op, code), input: { code, itemId: op.itemId, photo: palmSignState.photos[code], signMan,
                requestId: palmSignState.requestId, dispatchProof: palmSignProof(code),
                confirmationToken: approval?.code === code ? approval.token : undefined, autoConfirm: true } }));
            await runPool(jobs, PALM_SIGN_SEND_CONCURRENCY, async ({ input: job, current }) => {
                if (!op.current()) return false;
                if (!current() || !itemHoldsOpen(op.itemId, job.code)) return;
                let result: PalmSignResult;
                try {
                    await persistPalmSignJob(job, () => current() && itemHoldsOpen(op.itemId, job.code));
                    result = { code: job.code, state: 'queued', message: '⏳ បានរក្សាទុក · កំពុងផ្ញើរូប និង Sign ទៅ ZTO' };
                } catch (error) {
                    result = { code: job.code, state: 'failed', message: error?.message === 'outbox:duplicate'
                        ? '⚠️ កញ្ចប់នេះមានការងារ Sign រង់ចាំរួច។ សូមពិនិត្យបញ្ជី Sign។'
                        : '⚠️ រក្សារូប និងការងារ Sign មិនបាន។ សូមពិនិត្យទំហំផ្ទុក និងបញ្ជី Sign រង់ចាំ។' };
                }
                if (!op.current()) return false;
                storeResult(result);
            });
            if (op.current()) palmSignState.message = chosen.some((code) => palmSignState.results.some((row) => row.code === code && row.state === 'failed'))
                ? 'មានការងារ Sign រក្សាទុកមិនបាន — សូមមើលលទ្ធផលខាងក្រោម។' : '';
            return;
        }
        const url = endpoint(op.cfg, 'sign');
        const parcels = new Map(chosen.map((code) => [code, currentSignParcel(op, code)]));
        const headers = { ...await headersFor(op.cfg), 'Content-Type': 'application/json' };
        if (!op.current()) return;
        await runPool(chosen, PALM_SIGN_SEND_CONCURRENCY, async (code) => {
            if (!op.current() || palmSignState.confirmation && approval?.code !== code) return false;
            const current = parcels.get(code)!;
            const holdStale = () => {
                if (op.current()) storeResult({ code, state: 'unknown', parcelIdentity: current.identity,
                    message: '⚠️ កញ្ចប់នេះត្រូវបានស្តារ ឬបញ្ចូលឡើងវិញ។ រូបនៅរក្សាទុក។ សូមផ្ទៀងការងារ Sign ដើមក្នុង ZTO មុនបន្ត។' });
                return false;
            };
            if (!current()) return holdStale();
            if (!itemHoldsOpen(op.itemId, code)) return;
            let result: PalmSignResult;
            try {
                const photo = palmSignState.photos[code];
                const dispatchProof = palmSignProof(code);
                const requestId = palmSignState.requestId;
                const confirmationToken = approval?.code === code ? approval.token : undefined;
                if (!op.current()) return false;
                const out = await requestPalmSignWithConfirmation((body) => fetchWithTimeout(url, { method: 'POST', headers, body: JSON.stringify(body) },
                    45000, 'Palm sign timed out', (r) => r.json().catch(() => null)),
                { barcode: code, stage: 'receipt', signMan, photo, requestId, confirmationToken, dispatchProof }, current,
                ({ message }) => { if (current()) palmSignState.warnings = { ...palmSignState.warnings, [code]: message }; });
                if (!op.current()) return false;
                const body = out.body;
                if (out.res.status === 409 && body?.code === 'ZTO_PALM_SIGN_CONFIRM_REQUIRED' && body.barcode === code && body.stage === 'receipt'
                    && typeof body.message === 'string' && body.message.trim() && body.message.length <= 4000
                    && typeof body.confirmationToken === 'string' && body.confirmationToken.length > 0 && body.confirmationToken.length <= 8192) {
                    palmSignState.warnings = { ...palmSignState.warnings, [code]: body.message };
                    if (!palmSignState.confirmation) {
                        palmSignState.confirmation = { code, message: body.message, token: body.confirmationToken, codes: chosen, current, background };
                        palmSignState.message = 'សូមអានសារ ZTO ហើយបញ្ជាក់ ឬបោះបង់។';
                    }
                    result = { code, state: 'failed', message: '⚠️ ZTO ស្នើឲ្យបញ្ជាក់កញ្ចប់នេះ មុនទទួល។' };
                } else if (out.res.ok && body?.success === true && body.barcode === code && body.stage === 'receipt' && body.ztoClosed === true
                    && body.requestId === requestId && body.photoAccepted === true) {
                    const saved = await recordPalmSignResult(op.itemId, code, current, current.identity);
                    result = { code, state: 'signed', saved, message: saved ? '✅ ZTO Sign ជោគជ័យ' : '✅ ZTO Sign រួច · ការបិទក្នុង ZoeW កំពុងរង់ចាំបញ្ជាក់' };
                } else if (body?.code === 'ZTO_PALM_SIGN_REPORTED_REJECTED' && body.barcode === code && body.verificationRequired === true) {
                    result = { code, state: 'unknown', message: failureMessage(body.code) };
                } else if (body?.uncertain || !body?.code || out.res.status >= 500 && body?.code !== 'ZTO_PALM_SIGN_PHOTO_REJECTED') {
                    result = { code, state: 'unknown', message: '⏳ មិនទាន់បញ្ជាក់ Sign។ ចុច «🔄 ពិនិត្យ ZTO» មុនផ្ញើម្ដងទៀត។' };
                } else {
                    const warning = body.code === 'ZTO_PALM_SIGN_CHECK_REJECTED' && typeof body.message === 'string' && body.message.length <= 4000 ? body.message : '';
                    if (warning) palmSignState.warnings = { ...palmSignState.warnings, [code]: warning };
                    result = { code, state: 'failed', message: warning ? '⛔ ZTO មិនអនុញ្ញាតឲ្យ Sign' : failureMessage(body.code, body.reason) };
                    if (body.code === 'ZTO_AUTH_EXPIRED' || body.code === 'ZTO_PALM_RELOGIN_REQUIRED') noteZtoPalmSessionRejected(op.cfg);
                    if (body.code === 'ZTO_PALM_DISPATCH_REQUIRED') staleProofs.push(code);
                }
            } catch (_) {
                if (!current()) return holdStale();
                result = { code, state: 'unknown', message: '⏳ ចម្លើយពី ZTO មិនទាន់មក។ ចុច «🔄 ពិនិត្យ ZTO»។' };
            }
            if (!current()) return holdStale();
            storeResult({ ...result, parcelIdentity: current.identity });
            return result.state !== 'unknown';
        });
        if (op.current() && !palmSignState.confirmation) palmSignState.message = palmSignState.results.some((row) => row.state !== 'signed')
            ? 'មានកញ្ចប់មិនទាន់ Sign — សូមមើលលទ្ធផលខាងក្រោម។' : '';
    } catch (_) {
        if (op.current()) palmSignState.message = 'ភ្ជាប់ ZTO មិនបាន។ សូមពិនិត្យ Config និងបណ្ដាញ។';
    } finally {
        palmSignState.busy = false;
        if (!finishPalmSign(op.current) && staleProofs.length && op.current() && !palmSignState.confirmation) {
            palmSignState.checked = { ...palmSignState.checked, ...Object.fromEntries(staleProofs.map((code) => [code, false])) };
            palmSignState.dispatchResults = palmSignState.dispatchResults.filter((row) => !staleProofs.includes(row.code));
            void checkZtoPalmSignStages();
        }
    }
}

export function setPalmSignName(value: string) {
    if (palmSignState.busy || palmSignState.confirmation || palmSignState.results.some((row) => row.state === 'unknown')) return;
    palmSignState.signMan = value;
}

export async function checkZtoPalmSignStages() {
    if (palmSignState.busy || palmSignState.confirmation || palmSignState.checking || !palmSignMode()) return;
    const op = operation();
    const due = palmSignState.codes.filter((code) => !palmSignState.checked[code] && !palmSignSigned(code));
    if (!due.length) return;
    palmSignState.checking = true;
    palmSignState.message = 'កំពុងពិនិត្យស្ថានភាព ZTO…';
    let statusFailure = '';
    try {
        const headers = { ...await headersFor(op.cfg), 'Content-Type': 'application/json' };
        const url = endpoint(op.cfg, 'sign');
        await runPool(due, PALM_SIGN_STATUS_CONCURRENCY, async (code) => {
            if (!op.current()) return false;
            const statusItem = dataState.scanHistory.find((row) => row.id === op.itemId);
            const statusBarcode = statusItem?.barcodes?.find((row) => row.code === code);
            const statusIdentity = barcodeSignIdentity(statusItem, statusBarcode);
            const parcelCurrent = currentSignParcel(op, code);
            const current = () => parcelCurrent() && !palmSignState.results.some((row) => row.code === code && ['unknown', 'queued'].includes(row.state));
            if (!current()) return;
            let out;
            try {
                out = await fetchWithTimeout(url, { method: 'POST', headers, body: JSON.stringify({ stage: 'status', barcode: code, requestId: palmSignState.requestId }) },
                    20000, 'Palm stage status timed out', (r) => r.json().catch(() => null));
            } catch (_) {
                statusFailure = 'ពិនិត្យស្ថានភាព ZTO មិនបាន។ សូមចុចពិនិត្យម្ដងទៀត។';
                return;
            }
            if (!op.current()) return false;
            if (!current()) return;
            const body = out.body;
            if (!out.res.ok || body?.success !== true || body.barcode !== code || body.stage !== 'status'
                || typeof body.dispatched !== 'boolean' || typeof body.ztoClosed !== 'boolean'
                || body.dispatched && !body.ztoClosed && !body.dispatchProof) {
                statusFailure = failureMessage(body?.code, body?.reason);
                return;
            }
            const problem = body.problemScan;
            if (problem && typeof problem.action === 'string' && typeof problem.time === 'string' && problem.time.length <= 32
                && typeof problem.message === 'string' && problem.message.length > 0 && problem.message.length <= 4000) {
                palmSignState.problemScans = { ...palmSignState.problemScans, [code]: { action: problem.action, time: problem.time, message: problem.message } };
            }
            if (body.ztoClosed) {
                if (palmSignState.results.some((row) => row.code === code && row.state === 'failed')) return;
                const saved = await recordPalmSignResult(op.itemId, code, current, statusIdentity);
                if (!current()) return;
                storeResult({ code, state: 'signed', saved, parcelIdentity: statusIdentity, message: '✅ ZTO បានទទួលរួចហើយ' });
            } else if (body.dispatched) {
                storeDispatchResult({ code, state: 'dispatched', proof: body.dispatchProof, message: '✅ ចែកចាយរួច' });
            }
            palmSignState.checked = { ...palmSignState.checked, [code]: true };
            if (palmSignState.selectedCodes.includes(code)) void dispatchPalmSignCode(code);
        });
        if (op.current() && !palmSignState.busy && !palmSignState.confirmation) palmSignState.message = palmSignState.codes.every((code) => palmSignState.checked[code] || palmSignSigned(code)) ? '' : statusFailure
            || 'មិនទាន់បញ្ជាក់ស្ថានភាពគ្រប់កញ្ចប់។ សូមចុចពិនិត្យម្ដងទៀត។';
    } catch (_) {
        if (op.current() && !palmSignState.busy && !palmSignState.confirmation) palmSignState.message = 'ពិនិត្យស្ថានភាព ZTO មិនបាន។ សូមចុចពិនិត្យម្ដងទៀត។';
    } finally {
        if (op.generation === palmSignState.generation) {
            palmSignState.checking = false;
            if (op.current() && !palmSignState.busy && !palmSignState.confirmation && !finishPalmSign(op.current)) palmSignState.selectedCodes.forEach((code) => { void dispatchPalmSignCode(code); });
        }
    }
}

export async function recheckZtoPalmSign() {
    if (palmSignState.busy || palmSignState.confirmation || !palmSignMode()) return;
    const op = operation();
    palmSignState.busy = true;
    const requestId = palmSignState.requestId;
    const due = palmSignState.results.filter((row) => row.state === 'unknown' || row.state === 'signed' && !row.saved);
    const parcels = new Map(due.map((row) => [row.code, currentSignParcel(op, row.code, row.parcelIdentity)]));
    try {
        const headers = { ...await headersFor(op.cfg), 'Content-Type': 'application/json' };
        const url = endpoint(op.cfg, 'sign');
        const verdicts = new Map<string, boolean>();
        let failed = false;
        await runPool(due, PALM_SIGN_STATUS_CONCURRENCY, async (row) => {
            const current = parcels.get(row.code)!;
            if (!current()) return false;
            if (row.state === 'signed') {
                verdicts.set(row.code, true);
                return;
            }
            try {
                const out = await fetchWithTimeout(url, { method: 'POST', headers, body: JSON.stringify({ stage: 'receipt-status', barcode: row.code, requestId }) },
                    13000, 'Palm status timed out', (r) => r.json());
                if (!current()) return false;
                const body = out.body;
                if (out.res.ok && body?.success === true && body.barcode === row.code && body.stage === 'receipt'
                    && body.requestId === requestId && body.photoAccepted === true && body.ztoClosed === true) verdicts.set(row.code, true);
                else if (out.res.status === 409 && body?.code === 'ZTO_PALM_SIGN_RETRY_READY' && body.barcode === row.code && body.retryable === true) verdicts.set(row.code, false);
                else if (out.res.status === 409 && body?.code === 'ZTO_PALM_SIGN_REPORTED_REJECTED' && body.barcode === row.code && body.verificationRequired === true) {
                    storeResult({ code: row.code, state: 'unknown', parcelIdentity: current.identity, message: failureMessage(body.code) });
                }
            } catch (_) {
                failed = true;
                return false;
            }
        });
        for (const row of due) {
            if (!op.current()) break;
            const current = parcels.get(row.code)!;
            if (!current()) continue;
            if (verdicts.get(row.code) === false) palmSignState.results = palmSignState.results.filter((r) => r.code !== row.code);
            if (verdicts.get(row.code) === true) {
                const saved = await recordPalmSignResult(op.itemId, row.code, current, current.identity);
                if (current()) storeResult({ code: row.code, state: 'signed', saved, parcelIdentity: current.identity, message: saved ? '✅ ZTO Sign ជោគជ័យ' : '✅ ZTO Sign រួច · ZoeW កំពុងរង់ចាំបញ្ជាក់' });
            }
        }
        if (op.current()) palmSignState.message = failed ? 'ពិនិត្យ ZTO មិនបាន។ សូមសាកម្ដងទៀត។' : 'បានពិនិត្យ ZTO។ កញ្ចប់ដែលមិនទាន់បញ្ជាក់នៅតែបើកក្នុង ZoeW។';
    } catch (_) {
        if (op.current()) palmSignState.message = 'ពិនិត្យ ZTO មិនបាន។ សូមសាកម្ដងទៀត។';
    } finally {
        palmSignState.busy = false;
        if (!finishPalmSign(op.current) && op.current()) void checkZtoPalmSignStages();
    }
}
