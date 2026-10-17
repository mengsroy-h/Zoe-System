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
    if (!cfg?.palmTokenEnc || !securityState.lookupSecretKey) {
        showToast('⚠️ សូមបើក API ស្វែងរកអតិថិជនដោយ PIN ហើយ Login ZTO Palm ជាមុនសិន។');
        return;
    }
    const item = dataState.scanHistory.find((row) => row.id === itemId);
    const codes = Array.isArray(item?.barcodes) ? item.barcodes.filter((b) => !b.isClosed && (!barcode || b.code === barcode)).map((b) => b.code) : [];
    if (!codes.length) { showToast('⚠️ រកមិនឃើញកញ្ចប់បើកដែលមាន Barcode សម្រាប់ Sign។'); return; }
    palmSignState.generation++;
    palmSignState.itemId = itemId;
    palmSignState.codes = [...new Set<string>(codes)];
    palmSignState.selectedCodes = palmSignState.codes;
    palmSignState.message = '';
    palmSignState.results = [];
    openModalHelper('ztoPalmSignModal');
}

export function cancelZtoPalmSign() {
    palmSignState.generation++;
    palmSignState.codes = [];
    palmSignState.selectedCodes = [];
    palmSignState.itemId = '';
    palmSignState.message = '';
    palmSignState.results = [];
}

export function setPalmSignSelected(code: string, selected: boolean) {
    if (palmSignState.busy || !palmSignState.codes.includes(code)
        || palmSignState.results.some((row) => row.code === code && row.state !== 'failed')) return;
    palmSignState.selectedCodes = selected
        ? [...new Set(palmSignState.selectedCodes.concat(code))]
        : palmSignState.selectedCodes.filter((value) => value !== code);
}

export function acceptPalmSignBarcode(raw: string) {
    if (!modalIsOpen('ztoPalmSignModal')) return false;
    if (palmSignState.busy) return true;
    const code = palmSignState.codes.find((value) => value.toUpperCase() === raw.trim().toUpperCase());
    if (!code) { palmSignState.message = 'Barcode នេះមិនមានក្នុងបញ្ជីកញ្ចប់ដែលបានជ្រើស។'; return true; }
    if (!palmSignState.selectedCodes.includes(code)) palmSignState.selectedCodes = palmSignState.selectedCodes.concat(code);
    palmSignState.message = '✅ បានស្កេន ' + code;
    return true;
}

function failureMessage(code: string) {
    const messages = {
        ZTO_PALM_SIGN_PAYMENT_REQUIRED: 'ZTO មិនទាន់បញ្ជាក់បង់ប្រាក់រួច។ សូមបំពេញការបង់ប្រាក់ក្នុង ZTO Palm រួចសាកម្ដងទៀត។',
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
    const current = () => generation === palmSignState.generation && shopScope() === shop && auth === firebaseState.authGeneration
        && firebaseState.db === signDatabase && securityState.lookupSecretKey === secret && modalIsOpen('ztoPalmSignModal')
        && JSON.stringify(getLookupApiConfig()) === signature && palmSignMode();
    return { cfg, itemId, current };
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

export async function submitZtoPalmSign(codes: string[], signMan: string, photo: string, requestId: string) {
    if (palmSignState.busy || !palmSignMode()) return;
    const op = operation();
    if (!op.cfg?.palmTokenEnc || !securityState.lookupSecretKey || !shopScope()) return;
    const chosen = [...new Set(codes)].filter((code) => palmSignState.codes.includes(code));
    if (!chosen.length || !signMan.trim() || !photo) { palmSignState.message = 'សូមជ្រើសកញ្ចប់ ថតរូប និងបញ្ចូលឈ្មោះអ្នកទទួល។'; return; }
    palmSignState.busy = true;
    palmSignState.message = 'កំពុងផ្ញើទៅ ZTO…';
    try {
        const url = endpoint(op.cfg, 'sign');
        const headers = { ...await headersFor(op.cfg), 'Content-Type': 'application/json' };
        if (!op.current()) return;
        for (const code of chosen) {
            if (!op.current()) break;
            if (palmSignState.results.some((row) => row.code === code && row.state !== 'failed')) continue;
            const item = dataState.scanHistory.find((row) => row.id === op.itemId);
            if (!item?.barcodes?.some((b) => b.code === code && !b.isClosed)) continue;
            let result: PalmSignResult;
            try {
                const out = await fetchWithTimeout(url, { method: 'POST', headers, cache: 'no-store', body: JSON.stringify({ barcode: code, signMan: signMan.trim(), photo, requestId }) },
                    20000, 'Palm sign timed out', (r) => r.json().catch(() => null));
                if (!op.current()) break;
                const body = out.body;
                if (out.res.ok && body?.success === true && body.barcode === code && body.ztoClosed === true) {
                    const saved = await recordSigned(op.itemId, code, op.current);
                    result = { code, state: 'signed', saved, message: saved ? '✅ ZTO Sign ជោគជ័យ' : '✅ ZTO Sign រួច · ការបិទក្នុង ZoeW កំពុងរង់ចាំបញ្ជាក់' };
                } else if (body?.uncertain || !body?.code || out.res.status >= 500 && body?.code !== 'ZTO_PALM_SIGN_PHOTO_REJECTED') {
                    result = { code, state: 'unknown', message: '⏳ មិនទាន់បញ្ជាក់ Sign។ ចុច «ពិនិត្យ ZTO» មុនផ្ញើម្ដងទៀត។' };
                } else {
                    result = { code, state: 'failed', message: failureMessage(body.code) };
                    if (body.code === 'ZTO_AUTH_EXPIRED') noteZtoPalmSessionRejected(op.cfg);
                }
            } catch (_) {
                result = { code, state: 'unknown', message: '⏳ ចម្លើយពី ZTO មិនទាន់មក។ ចុច «ពិនិត្យ ZTO»។' };
            }
            if (!op.current()) break;
            palmSignState.results = palmSignState.results.filter((row) => row.code !== code).concat(result);
            if (result.state === 'unknown') break;
        }
        if (op.current()) palmSignState.message = 'បានបញ្ចប់ការផ្ញើ។ សូមមើលលទ្ធផលតាម Barcode ខាងក្រោម។';
    } catch (_) {
        if (op.current()) palmSignState.message = 'ភ្ជាប់ Palm មិនបាន។ សូមពិនិត្យ Config និងបណ្ដាញ។';
    } finally {
        palmSignState.busy = false;
    }
}

export async function recheckZtoPalmSign() {
    if (palmSignState.busy || !palmSignMode()) return;
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
