import { palmSignFramePhoto } from '../services/palm-sign-camera';
import { dataState, firebaseState, securityState } from '../core/state';
import { palmSignState, type PalmSignResult, type PalmSignConfirmation } from '../core/palm-sign-state';
import { modalIsOpen } from '../core/modals';
import { shopScope } from '../core/shop-scope';
import { getLookupApiConfig } from './lookup-config';
import { lookupApiIsPalm } from './customer-table-prefetch';
import { addPalmSessionHeader, addZtoIdentityHeader, buildLookupRequestHeaders } from './lookup-api';
import { noteZtoPalmSessionRejected } from './zto-palm-login';
import { applyBarcodeCloseChange } from './barcode-ops';
import { scheduleZtoFinalMarks } from './zto-final-marks';
import { setZtoPickupVerdict } from './zto-status';
import { resolveNativeApiUrl, ztoIdentityTargetTrusted } from '../platform/native';
import { fetchWithTimeout } from '../services/network';
import { playBeep, primeBeep } from '../services/history-write';
import { hapticScan } from '../platform/haptics';
import { closeModal, openModalHelper } from '../ui/modal';
import { showToast } from '../ui/toast';

export function palmSignMode() {
    const cfg = getLookupApiConfig();
    return !!(cfg?.enabled && lookupApiIsPalm(cfg));
}

export function refreshPalmSignMode() {
    palmSignState.mode = palmSignMode();
    palmSignState.generation++;
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
        showToast('⚠️ សូមបើក API ស្វែងរកអតិថិជនដោយ PIN ហើយ Login ZTO Palm ជាមុនសិន។');
        return;
    }
    const item = dataState.scanHistory.find((row) => row.id === itemId);
    const codes = Array.isArray(item?.barcodes) ? item.barcodes.filter((b) => !b.isClosed && (!barcode || b.code === barcode)).map((b) => b.code) : [];
    if (!codes.length) { showToast('⚠️ រកមិនឃើញកញ្ចប់បើកដែលមាន Barcode សម្រាប់ Sign។'); return; }
    primeScanFeedback();
    palmSignState.generation++;
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
    return !!palmSignState.photos[code] && !!palmSignProof(code) && !palmSignSigned(code)
        && !palmSignState.results.some((row) => row.code === code && row.state === 'unknown');
}

export function palmSignReadyCodes() {
    return palmSignState.selectedCodes.filter((code) => palmSignReady(code));
}

export function removePalmSignScan(code: string) {
    if (palmSignState.busy || palmSignState.confirmation || !palmSignState.photos[code] || palmSignSigned(code)) return;
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
    if (palmSignSigned(code)) { palmSignState.message = '✅ ' + code + ' Sign រួចហើយ'; return true; }
    if (palmSignState.photos[code] && !replacePhoto) {
        if (!palmSignState.selectedCodes.includes(code)) palmSignState.selectedCodes = palmSignState.selectedCodes.concat(code);
        void dispatchPalmSignCode(code);
        return true;
    }
    const photo = capturedPhoto || palmSignFramePhoto();
    if (!photo) { palmSignState.message = 'សូមបើកកាមេរ៉ាដើម្បីចាប់រូបពេលស្កេន ឬថតរូបកញ្ចប់នេះ។'; return true; }
    palmSignState.photos = { ...palmSignState.photos, [code]: photo };
    if (!palmSignState.selectedCodes.includes(code)) palmSignState.selectedCodes = palmSignState.selectedCodes.concat(code);
    palmSignState.message = '✅ បានស្កេន ' + code;
    scanSuccessFeedback();
    void dispatchPalmSignCode(code);
    return true;
}

function failureMessage(code: string, reason = '') {
    if (reason === 'palm:no-session') return 'សាខានេះមិនទាន់មាន Login Palm លើ Server។ សូម Login ZTO Palm ជាមុនសិន។';
    if (reason === 'palm:branch-unknown') return 'សូមភ្ជាប់ Login Palm របស់សាខានេះជាមុនសិន។';
    if (reason === 'palm:login-rejected') return 'ZTO បដិសេធគណនី Palm របស់សាខា។ សូម Login ម្ដងទៀត។';
    const messages = {
        ZTO_PALM_DISPATCH_REQUIRED: 'ភស្តុតាងចែកចាយត្រូវផ្ទៀងម្ដងទៀត។ ZoeW កំពុងពិនិត្យ ZTO ឡើងវិញ រួចចុច «⬆ ផ្ញើបញ្ជី» ម្ដងទៀត។',
        ZTO_PALM_RELOGIN_REQUIRED: 'សូម Login ZTO Palm ម្ដងទៀត ដើម្បីភ្ជាប់អ្នកចែកចាយ។',
        ZTO_PALM_SIGN_NAME_REQUIRED: 'ZTO គ្មានឈ្មោះអ្នកទទួល។ សូមបញ្ចូលឈ្មោះ រួចផ្ញើម្ដងទៀត។',
        ZTO_PALM_SIGN_CHECK_REJECTED: 'ZTO មិនអនុញ្ញាតឲ្យ Sign កញ្ចប់នេះ។ សូមពិនិត្យក្នុង ZTO Palm។',
        ZTO_PALM_SIGN_PHOTO_REJECTED: 'ZTO មិនទទួលរូបភាព។ សូមសាកម្ដងទៀត។',
        ZTO_PALM_SIGN_REJECTED: 'ZTO បដិសេធ Sign កញ្ចប់នេះ។',
        ZTO_AUTH_EXPIRED: 'Session Palm ផុតកំណត់។ សូម Login ZTO Palm ម្ដងទៀត។',
        ZTO_OTHER_BRANCH: 'សាខា ZoeW និងគណនី Palm មិនត្រូវគ្នា។',
        ZTO_PALM_SIGN_INVALID: 'Barcode ឈ្មោះអ្នកទទួល ឬរូបភាពមិនត្រឹមត្រូវ។'
    };
    return messages[code] || 'ផ្ញើទៅ ZTO មិនបាន។ សូមពិនិត្យបណ្ដាញ និងការភ្ជាប់ Palm។';
}

const PALM_SESSION_FIELDS = ['palmTokenEnc', 'palmRefreshTokenEnc', 'palmExpiresAt', 'palmLoginAt', 'palmShared'];

function palmSignConfigKey(cfg) {
    if (!cfg || typeof cfg !== 'object') return JSON.stringify(cfg ?? null);
    const rest = { ...cfg };
    for (const name of PALM_SESSION_FIELDS) delete rest[name];
    if (rest.palmAccount && typeof rest.palmAccount === 'object') rest.palmAccount = { siteCode: rest.palmAccount.siteCode };
    return JSON.stringify(rest);
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

async function headersFor(cfg) {
    const headers = await buildLookupRequestHeaders(cfg);
    await addZtoIdentityHeader(cfg, headers);
    await addPalmSessionHeader(cfg, headers);
    return headers;
}

function endpoint(cfg, action: string) {
    const target = new URL(resolveNativeApiUrl(cfg.url), window.location.href);
    if (!ztoIdentityTargetTrusted(target.href)) throw new Error('host');
    target.search = '?palm=' + action;
    target.hash = '';
    return target.href;
}

async function recordSigned(itemId: string, code: string, current: () => boolean) {
    if (!current()) return false;
    setZtoPickupVerdict(code, true);
    scheduleZtoFinalMarks();
    const item = dataState.scanHistory.find((row) => row.id === itemId);
    const barcode = item?.barcodes?.find((b) => b.code === code);
    if (barcode?.isClosed) return true;
    if (!barcode) return false;
    return await applyBarcodeCloseChange(itemId, code, true, { silent: true, showModal: false }) === true;
}

function finishPalmSign(current: () => boolean) {
    if (!current() || !palmSignState.codes.length || !palmSignState.codes.every((code) =>
        palmSignState.results.some((row) => row.code === code && row.state === 'signed' && row.saved === true))) return false;
    const count = palmSignState.codes.length;
    scanSuccessFeedback();
    closeModal('ztoPalmSignModal');
    showToast('✅ ZTO Sign ជោគជ័យ ' + count + ' កញ្ចប់');
    return true;
}

export async function submitZtoPalmSign(codes: string[] = palmSignReadyCodes()) {
    if (palmSignState.confirmation) return;
    return sendPalmSign(codes);
}

export function cancelPalmSignConfirmation() {
    if (palmSignState.busy || !palmSignState.confirmation) return;
    palmSignState.confirmation = null;
    palmSignState.message = 'បានបោះបង់ការបញ្ជាក់។ កញ្ចប់នេះមិនទាន់បាន Sign ទេ។';
}

export async function confirmPalmSignWarning() {
    const pending = palmSignState.confirmation;
    if (!pending || palmSignState.busy) return;
    palmSignState.confirmation = null;
    if (!pending.current()) return;
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

export async function dispatchPalmSignCode(code: string) {
    if (!palmSignMode() || palmSignState.confirmation || !palmSignState.checked[code] || palmSignProof(code) || palmSignSigned(code)
        || palmSignState.dispatching[code] || !palmSignState.photos[code]) return;
    const op = operation();
    if (!op.ready() || !itemHoldsOpen(op.itemId, code)) return;
    palmSignState.dispatching = { ...palmSignState.dispatching, [code]: true };
    let result: PalmSignResult | null = null;
    try {
        const headers = { ...await headersFor(op.cfg), 'Content-Type': 'application/json' };
        if (!op.current()) return;
        const out = await fetchWithTimeout(endpoint(op.cfg, 'sign'), { method: 'POST', headers, cache: 'no-store',
            body: JSON.stringify({ barcode: code, stage: 'dispatch', signMan: '', requestId: palmSignState.requestId }) },
            45000, 'Palm dispatch timed out', (r) => r.json().catch(() => null));
        if (!op.current()) return;
        const body = out.body;
        if (out.res.ok && body?.success === true && body.barcode === code && body.stage === 'dispatch' && body.ztoClosed === false
            && typeof body.dispatchProof === 'string' && body.dispatchProof) {
            result = { code, state: 'dispatched', proof: body.dispatchProof, message: '✅ ចែកចាយរួច' };
        } else if (body?.uncertain || !body?.code || out.res.status >= 500) {
            result = { code, state: 'unknown', message: '⏳ ការចែកចាយមិនទាន់បញ្ជាក់ — ចុច «🔄 ពិនិត្យ ZTO»។' };
        } else {
            result = { code, state: 'failed', message: failureMessage(body.code, body.reason) };
            if (body.code === 'ZTO_AUTH_EXPIRED' || body.code === 'ZTO_PALM_RELOGIN_REQUIRED') noteZtoPalmSessionRejected(op.cfg);
        }
    } catch (_) {
        if (op.current()) result = { code, state: 'unknown', message: '⏳ ចម្លើយចែកចាយពី ZTO មិនទាន់មក — ចុច «🔄 ពិនិត្យ ZTO»។' };
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
    if (palmSignState.busy || palmSignState.confirmation || palmSignState.checking || !palmSignMode()) return;
    const op = operation();
    if (!op.ready()) return;
    const signMan = palmSignState.signMan.trim();
    if (!signMan) { palmSignState.message = 'សូមវាយឈ្មោះអ្នកទទួលជាមុនសិន។'; return; }
    const chosen = [...new Set(codes)].filter((code) => palmSignReady(code) && !palmSignState.results.some((row) => row.code === code && row.state !== 'failed'));
    if (!chosen.length) { palmSignState.message = 'សូមស្កេន Barcode ដើម្បីចាប់រូបសិន។'; return; }
    palmSignState.busy = true;
    palmSignState.message = 'កំពុង Sign ក្នុង ZTO…';
    const staleProofs: string[] = [];
    try {
        const url = endpoint(op.cfg, 'sign');
        const headers = { ...await headersFor(op.cfg), 'Content-Type': 'application/json' };
        if (!op.current()) return;
        await runPool(chosen, PALM_SIGN_SEND_CONCURRENCY, async (code) => {
            if (!op.current() || palmSignState.confirmation && approval?.code !== code) return false;
            if (!itemHoldsOpen(op.itemId, code)) return;
            let result: PalmSignResult;
            try {
                const out = await fetchWithTimeout(url, { method: 'POST', headers, cache: 'no-store', body: JSON.stringify({ barcode: code, stage: 'receipt', signMan,
                    photo: palmSignState.photos[code], requestId: palmSignState.requestId,
                    confirmationToken: approval?.code === code ? approval.token : undefined, dispatchProof: palmSignProof(code) }) },
                    45000, 'Palm sign timed out', (r) => r.json().catch(() => null));
                if (!op.current()) return false;
                const body = out.body;
                if (out.res.status === 409 && body?.code === 'ZTO_PALM_SIGN_CONFIRM_REQUIRED' && body.barcode === code && body.stage === 'receipt'
                    && typeof body.message === 'string' && body.message.trim() && body.message.length <= 4000
                    && typeof body.confirmationToken === 'string' && body.confirmationToken.length > 0 && body.confirmationToken.length <= 8192) {
                    palmSignState.warnings = { ...palmSignState.warnings, [code]: body.message };
                    if (!palmSignState.confirmation) {
                        palmSignState.confirmation = { code, message: body.message, token: body.confirmationToken, codes: chosen, current: op.current };
                        palmSignState.message = 'សូមអានសារ ZTO ហើយបញ្ជាក់ ឬបោះបង់។';
                    }
                    result = { code, state: 'failed', message: '⚠️ ZTO ស្នើឲ្យបញ្ជាក់កញ្ចប់នេះ មុនទទួល។' };
                } else if (out.res.ok && body?.success === true && body.barcode === code && body.stage === 'receipt' && body.ztoClosed === true) {
                    const saved = await recordSigned(op.itemId, code, op.current);
                    result = { code, state: 'signed', saved, message: saved ? '✅ ZTO Sign ជោគជ័យ' : '✅ ZTO Sign រួច · ការបិទក្នុង ZoeW កំពុងរង់ចាំបញ្ជាក់' };
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
                result = { code, state: 'unknown', message: '⏳ ចម្លើយពី ZTO មិនទាន់មក។ ចុច «🔄 ពិនិត្យ ZTO»។' };
            }
            if (!op.current()) return false;
            storeResult(result);
            return result.state !== 'unknown';
        });
        if (op.current() && !palmSignState.confirmation) palmSignState.message = palmSignState.results.some((row) => row.state !== 'signed')
            ? 'មានកញ្ចប់មិនទាន់ Sign — សូមមើលលទ្ធផលខាងក្រោម។' : '';
    } catch (_) {
        if (op.current()) palmSignState.message = 'ភ្ជាប់ Palm មិនបាន។ សូមពិនិត្យ Config និងបណ្ដាញ។';
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
    if (palmSignState.busy || palmSignState.confirmation) return;
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
            let out;
            try {
                out = await fetchWithTimeout(url, { method: 'POST', headers, cache: 'no-store', body: JSON.stringify({ stage: 'status', barcode: code, requestId: palmSignState.requestId }) },
                    20000, 'Palm stage status timed out', (r) => r.json().catch(() => null));
            } catch (_) {
                statusFailure = 'ពិនិត្យស្ថានភាព ZTO មិនបាន។ សូមចុចពិនិត្យម្ដងទៀត។';
                return;
            }
            if (!op.current()) return false;
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
                const saved = await recordSigned(op.itemId, code, op.current);
                if (!op.current()) return false;
                storeResult({ code, state: 'signed', saved, message: '✅ ZTO បានទទួលរួចហើយ' });
            } else if (body.dispatched) {
                storeDispatchResult({ code, state: 'dispatched', proof: body.dispatchProof, message: '✅ ចែកចាយរួច' });
            }
            palmSignState.checked = { ...palmSignState.checked, [code]: true };
        });
        if (op.current()) palmSignState.message = palmSignState.codes.every((code) => palmSignState.checked[code] || palmSignSigned(code)) ? '' : statusFailure
            || 'មិនទាន់បញ្ជាក់ស្ថានភាពគ្រប់កញ្ចប់។ សូមចុចពិនិត្យម្ដងទៀត។';
    } catch (_) {
        if (op.current()) palmSignState.message = 'ពិនិត្យស្ថានភាព ZTO មិនបាន។ សូមចុចពិនិត្យម្ដងទៀត។';
    } finally {
        if (op.generation === palmSignState.generation) {
            palmSignState.checking = false;
            if (op.current() && !finishPalmSign(op.current)) palmSignState.selectedCodes.forEach((code) => { void dispatchPalmSignCode(code); });
        }
    }
}

export async function recheckZtoPalmSign() {
    if (palmSignState.busy || palmSignState.confirmation || !palmSignMode()) return;
    const op = operation();
    palmSignState.busy = true;
    try {
        const headers = await headersFor(op.cfg);
        const url = endpoint(op.cfg, '1');
        for (const row of palmSignState.results) {
            if (!op.current()) break;
            if (row.state !== 'unknown' && !(row.state === 'signed' && !row.saved)) continue;
            let signed = row.state === 'signed';
            if (!signed) {
                const out = await fetchWithTimeout(url + '&status=1&barcode=' + encodeURIComponent(row.code), { headers, cache: 'no-store' }, 13000, 'Palm status timed out', (r) => r.json());
                if (!op.current()) break;
                signed = out.res.ok && out.body?.barcode === row.code && out.body?.ztoClosed === true;
                if (!signed && out.res.ok && out.body?.barcode === row.code && out.body?.ztoClosed === false) palmSignState.results = palmSignState.results.filter((r) => r.code !== row.code);
            }
            if (signed && op.current()) {
                const saved = await recordSigned(op.itemId, row.code, op.current);
                if (op.current()) storeResult({ code: row.code, state: 'signed', saved, message: saved ? '✅ ZTO Sign ជោគជ័យ' : '✅ ZTO Sign រួច · ZoeW កំពុងរង់ចាំបញ្ជាក់' });
            }
        }
        if (op.current()) palmSignState.message = 'បានពិនិត្យ ZTO។ កញ្ចប់ដែលមិនទាន់បញ្ជាក់នៅតែបើកក្នុង ZoeW។';
    } catch (_) {
        if (op.current()) palmSignState.message = 'ពិនិត្យ ZTO មិនបាន។ សូមសាកម្ដងទៀត។';
    } finally {
        palmSignState.busy = false;
        if (!finishPalmSign(op.current) && op.current()) void checkZtoPalmSignStages();
    }
}
