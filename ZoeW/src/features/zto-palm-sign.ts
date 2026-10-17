import { palmSignFramePhoto } from '../services/palm-sign-camera';
import { dataState, firebaseState, securityState } from '../core/state';
import { palmSignState, type PalmSignResult } from '../core/palm-sign-state';
import { modalIsOpen } from '../core/modals';
import { shopScope } from '../core/shop-scope';
import { getLookupApiConfig } from './lookup-config';
import { lookupApiIsPalm } from './customer-table-prefetch';
import { addPalmSessionHeader, addZtoIdentityHeader, buildLookupRequestHeaders } from './lookup-api';
import { noteZtoPalmSessionRejected } from './zto-palm-login';
import { applyBarcodeCloseChange } from './barcode-ops';
import { resolveNativeApiUrl, ztoIdentityTargetTrusted } from '../platform/native';
import { fetchWithTimeout } from '../services/network';
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

export function openZtoPalmSign(itemId: string, barcode?: string) {
    if (palmSignState.busy || !palmSignMode()) return;
    const cfg = getLookupApiConfig();
    if ((!cfg?.palmTokenEnc && !cfg?.palmShared) || !securityState.lookupSecretKey) {
        showToast('⚠️ សូមបើក API ស្វែងរកអតិថិជនដោយ PIN ហើយ Login ZTO Palm ជាមុនសិន។');
        return;
    }
    const item = dataState.scanHistory.find((row) => row.id === itemId);
    const codes = Array.isArray(item?.barcodes) ? item.barcodes.filter((b) => !b.isClosed && (!barcode || b.code === barcode)).map((b) => b.code) : [];
    if (!codes.length) { showToast('⚠️ រកមិនឃើញកញ្ចប់បើកដែលមាន Barcode សម្រាប់ Sign។'); return; }
    palmSignState.generation++;
    palmSignState.itemId = itemId;
    palmSignState.codes = [...new Set<string>(codes)];
    palmSignState.selectedCodes = [];
    palmSignState.photos = {};
    palmSignState.checked = {};
    palmSignState.signMan = '';
    palmSignState.stage = 'dispatch';
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
    palmSignState.signMan = '';
    palmSignState.checking = false;
    palmSignState.photos = {};
    palmSignState.dispatchResults = [];
    palmSignState.requestId = '';
    palmSignState.message = '';
    palmSignState.results = [];
}

export function setPalmSignSelected(code: string, selected: boolean) {
    if (palmSignState.busy || !palmSignState.codes.includes(code) || !palmSignState.photos[code]) return;
    palmSignState.selectedCodes = selected
        ? [...new Set(palmSignState.selectedCodes.concat(code))]
        : palmSignState.selectedCodes.filter((value) => value !== code);
}

export function palmSignStageResults() {
    return palmSignState.stage === 'dispatch' ? palmSignState.dispatchResults : palmSignState.results;
}

export function palmSignStageCodes() {
    return palmSignState.stage === 'dispatch' ? palmSignState.codes.filter((code) => !palmSignState.dispatchResults.some((row) => row.code === code && row.state === 'dispatched'))
        : palmSignState.codes.filter((code) => palmSignState.dispatchResults.some((row) => row.code === code && row.state === 'dispatched' && row.proof));
}

export function advancePalmSignStage() {
    if (palmSignState.busy || palmSignState.checking || palmSignState.stage !== 'dispatch' || !palmSignState.codes.length
        || !palmSignState.codes.every((code) => palmSignState.dispatchResults.some((row) => row.code === code && row.state === 'dispatched' && row.proof)
            || palmSignState.results.some((row) => row.code === code && row.state === 'signed'))) return;
    palmSignState.stage = 'receipt';
    palmSignState.photos = {};
    palmSignState.selectedCodes = [];
    palmSignState.message = 'សូមស្កេន Barcode ម្ដងទៀត។ រូបភាពថ្មីនឹងត្រូវចាប់ស្វ័យប្រវត្តិ។';
}

export function acceptPalmSignBarcode(raw: string, capturedPhoto?: string) {
    if (!modalIsOpen('ztoPalmSignModal')) return false;
    if (palmSignState.busy || palmSignState.checking) return true;
    if (palmSignState.stage === 'receipt' && !palmSignState.signMan.trim()) { palmSignState.message = 'សូមវាយឈ្មោះអតិថិជនជាមុន រួចស្កេន Barcode។'; return true; }
    const code = palmSignStageCodes().find((value) => value.toUpperCase() === raw.trim().toUpperCase());
    if (code && !palmSignState.checked[code]) { palmSignState.message = 'សូមពិនិត្យស្ថានភាព ZTO ជាមុនសិន។'; return true; }
    if (!code) { palmSignState.message = 'Barcode នេះមិនមានក្នុងបញ្ជីសម្រាប់ជំហាននេះ។'; return true; }
    if (palmSignStageResults().some((row) => row.code === code && row.state !== 'failed')) return true;
    const photo = capturedPhoto || palmSignFramePhoto();
    if (!photo) { palmSignState.message = 'សូមបើកកាមេរ៉ាដើម្បីចាប់រូបពេលស្កេន ឬថតរូបកញ្ចប់នេះ។'; return true; }
    if (!palmSignState.photos[code]) palmSignState.photos = { ...palmSignState.photos, [code]: photo };
    if (!palmSignState.selectedCodes.includes(code)) palmSignState.selectedCodes = palmSignState.selectedCodes.concat(code);
    palmSignState.message = '✅ បានស្កេន និងចាប់រូប ' + code;
    return true;
}

function failureMessage(code: string, reason = '') {
    if (reason === 'palm:no-session') return 'សាខានេះមិនទាន់មាន Login Palm លើ Server។ សូម Login ZTO Palm ជាមុនសិន។';
    if (reason === 'palm:branch-unknown') return 'សូមភ្ជាប់ Login Palm របស់សាខានេះជាមុនសិន។';
    if (reason === 'palm:login-rejected') return 'ZTO បដិសេធគណនី Palm របស់សាខា។ សូម Login ម្ដងទៀត។';
    const messages = {
        ZTO_PALM_DISPATCH_REQUIRED: 'សូមផ្ញើបញ្ជីស្កេនចែកចាយជោគជ័យជាមុនសិន។',
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

function operation() {
    const cfg = getLookupApiConfig();
    const shop = shopScope();
    const auth = firebaseState.authGeneration;
    const signDatabase = firebaseState.db;
    const secret = securityState.lookupSecretKey;
    const generation = palmSignState.generation;
    const itemId = palmSignState.itemId;
    const signature = JSON.stringify(cfg);
    const stage = palmSignState.stage;
    const current = () => stage === palmSignState.stage && generation === palmSignState.generation && shopScope() === shop && auth === firebaseState.authGeneration
        && firebaseState.db === signDatabase && securityState.lookupSecretKey === secret && modalIsOpen('ztoPalmSignModal')
        && JSON.stringify(getLookupApiConfig()) === signature && palmSignMode();
    return { cfg, itemId, current, stage, generation };
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
    const item = dataState.scanHistory.find((row) => row.id === itemId);
    const barcode = item?.barcodes?.find((b) => b.code === code);
    if (barcode?.isClosed) return true;
    if (!barcode) return false;
    return await applyBarcodeCloseChange(itemId, code, true, { silent: true, showModal: false }) === true;
}

export async function submitZtoPalmSign(codes: string[]) {
    if (palmSignState.busy || palmSignState.checking || !palmSignMode()) return;
    const op = operation();
    if ((!op.cfg?.palmTokenEnc && !op.cfg?.palmShared) || !securityState.lookupSecretKey || !shopScope()) return;
    const signMan = palmSignState.signMan.trim();
    if (op.stage === 'receipt' && !signMan) { palmSignState.message = 'សូមវាយឈ្មោះអតិថិជនជាមុនសិន។'; return; }
    const chosen = [...new Set(codes)].filter((code) => palmSignStageCodes().includes(code));
    if (!chosen.length || chosen.some((code) => !palmSignState.photos[code] || !palmSignState.checked[code])) { palmSignState.message = 'សូមស្កេន Barcode ដើម្បីចាប់រូបសិន។'; return; }
    palmSignState.busy = true;
    palmSignState.message = 'កំពុងផ្ញើទៅ ZTO…';
    try {
        const url = endpoint(op.cfg, 'sign');
        const headers = { ...await headersFor(op.cfg), 'Content-Type': 'application/json' };
        if (!op.current()) return;
        for (const code of chosen) {
            if (!op.current()) break;
            if (palmSignStageResults().some((row) => row.code === code && row.state !== 'failed')) continue;
            const item = dataState.scanHistory.find((row) => row.id === op.itemId);
            if (!item?.barcodes?.some((b) => b.code === code && !b.isClosed)) continue;
            let result: PalmSignResult;
            try {
                const out = await fetchWithTimeout(url, { method: 'POST', headers, cache: 'no-store', body: JSON.stringify({ barcode: code, stage: op.stage, signMan: signMan.trim(), photo: palmSignState.photos[code], requestId: palmSignState.requestId,
                    dispatchProof: op.stage === 'receipt' ? palmSignState.dispatchResults.find((row) => row.code === code)?.proof : undefined }) },
                    45000, 'Palm sign timed out', (r) => r.json().catch(() => null));
                if (!op.current()) break;
                const body = out.body;
                if (out.res.ok && body?.success === true && body.barcode === code && body.stage === 'dispatch' && op.stage === 'dispatch'
                    && body.ztoClosed === false && typeof body.dispatchProof === 'string' && body.dispatchProof) {
                    result = { code, state: 'dispatched', proof: body.dispatchProof, message: '✅ ផ្ញើបញ្ជីចែកចាយជោគជ័យ' };
                } else if (out.res.ok && body?.success === true && body.barcode === code && body.stage === 'receipt' && op.stage === 'receipt' && body.ztoClosed === true) {
                    const saved = await recordSigned(op.itemId, code, op.current);
                    result = { code, state: 'signed', saved, message: saved ? '✅ ZTO Sign ជោគជ័យ' : '✅ ZTO Sign រួច · ការបិទក្នុង ZoeW កំពុងរង់ចាំបញ្ជាក់' };
                } else if (body?.uncertain || !body?.code || out.res.status >= 500 && body?.code !== 'ZTO_PALM_SIGN_PHOTO_REJECTED') {
                    result = { code, state: 'unknown', message: '⏳ មិនទាន់បញ្ជាក់ Sign។ ចុច «ពិនិត្យ ZTO» មុនផ្ញើម្ដងទៀត។' };
                } else {
                    result = { code, state: 'failed', message: failureMessage(body.code, body.reason) };
                    if (body.code === 'ZTO_AUTH_EXPIRED' || body.code === 'ZTO_PALM_RELOGIN_REQUIRED') noteZtoPalmSessionRejected(op.cfg);
                }
            } catch (_) {
                result = { code, state: 'unknown', message: '⏳ ចម្លើយពី ZTO មិនទាន់មក។ ចុច «ពិនិត្យ ZTO»។' };
            }
            if (!op.current()) break;
            if (op.stage === 'dispatch') palmSignState.dispatchResults = palmSignState.dispatchResults.filter((row) => row.code !== code).concat(result);
            else palmSignState.results = palmSignState.results.filter((row) => row.code !== code).concat(result);
            if (result.state === 'unknown') {
                if (op.stage === 'dispatch') palmSignState.checked = { ...palmSignState.checked, [code]: false };
                break;
            }
        }
        if (op.current()) palmSignState.message = 'បានបញ្ចប់ការផ្ញើ។ សូមមើលលទ្ធផលតាម Barcode ខាងក្រោម។';
    } catch (_) {
        if (op.current()) palmSignState.message = 'ភ្ជាប់ Palm មិនបាន។ សូមពិនិត្យ Config និងបណ្ដាញ។';
    } finally {
        palmSignState.busy = false;
    }
}

export function setPalmSignName(value: string) {
    if (palmSignState.busy || palmSignState.results.some((row) => row.state !== 'failed')) return;
    palmSignState.signMan = value;
}

export async function checkZtoPalmSignStages() {
    if (palmSignState.busy || palmSignState.checking || !palmSignMode()) return;
    const op = operation();
    palmSignState.checking = true;
    palmSignState.message = 'កំពុងពិនិត្យថា ZTO បានចែកចាយរួចឬនៅ…';
    try {
        let statusFailure = '';
        const headers = { ...await headersFor(op.cfg), 'Content-Type': 'application/json' };
        const url = endpoint(op.cfg, 'sign');
        for (const code of palmSignState.codes) {
            if (!op.current()) return;
            if (palmSignState.checked[code] && !palmSignState.dispatchResults.some((row) => row.code === code && row.state === 'unknown')) continue;
            const out = await fetchWithTimeout(url, { method: 'POST', headers, cache: 'no-store', body: JSON.stringify({ stage: 'status', barcode: code, requestId: palmSignState.requestId }) },
                20000, 'Palm stage status timed out', (r) => r.json().catch(() => null));
            if (!op.current()) return;
            const body = out.body;
            if (!out.res.ok || body?.success !== true || body.barcode !== code || body.stage !== 'status'
                || typeof body.dispatched !== 'boolean' || typeof body.ztoClosed !== 'boolean'
                || body.dispatched && !body.ztoClosed && !body.dispatchProof) {
                statusFailure = failureMessage(body?.code, body?.reason);
                continue;
            }
            if (body.ztoClosed) {
                const saved = await recordSigned(op.itemId, code, op.current);
                if (!op.current()) return;
                palmSignState.results = palmSignState.results.concat({ code, state: 'signed', saved, message: '✅ ZTO បានទទួលរួចហើយ' });
            } else if (body.dispatched) {
                palmSignState.dispatchResults = palmSignState.dispatchResults.filter((row) => row.code !== code).concat({ code, state: 'dispatched', proof: body.dispatchProof, message: '✅ ZTO ចែកចាយរួច · រំលងជំហានទី១' });
            }
            palmSignState.checked = { ...palmSignState.checked, [code]: !palmSignState.dispatchResults.some((row) => row.code === code && row.state === 'unknown') };
        }
        if (op.current()) palmSignState.message = palmSignState.codes.every((code) => palmSignState.checked[code])
            ? 'បានពិនិត្យស្ថានភាព ZTO រួច។ សូមបន្តស្កេន។' : statusFailure || 'មិនទាន់បញ្ជាក់ស្ថានភាពគ្រប់កញ្ចប់។ សូមចុចពិនិត្យម្ដងទៀត។';
    } catch (_) {
        if (op.current()) palmSignState.message = 'ពិនិត្យស្ថានភាព ZTO មិនបាន។ សូមចុចពិនិត្យម្ដងទៀត។';
    } finally {
        if (op.generation === palmSignState.generation) { palmSignState.checking = false; if (op.current()) advancePalmSignStage(); }
    }
}

export async function recheckZtoPalmSign() {
    if (palmSignState.busy || !palmSignMode() || palmSignState.stage !== 'receipt') return;
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
            }
            if (signed && op.current()) {
                const saved = await recordSigned(op.itemId, row.code, op.current);
                if (op.current()) palmSignState.results = palmSignState.results.map((r) => r.code === row.code
                    ? { code: row.code, state: 'signed', saved, message: saved ? '✅ ZTO Sign ជោគជ័យ' : '✅ ZTO Sign រួច · ZoeW កំពុងរង់ចាំបញ្ជាក់' } : r);
            }
        }
        if (op.current()) palmSignState.message = 'បានពិនិត្យ ZTO។ កញ្ចប់ដែលមិនទាន់បញ្ជាក់នៅតែបើកក្នុង ZoeW។';
    } catch (_) {
        if (op.current()) palmSignState.message = 'ពិនិត្យ ZTO មិនបាន។ សូមសាកម្ដងទៀត។';
    } finally { palmSignState.busy = false; }
}
