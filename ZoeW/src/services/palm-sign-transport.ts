import { shopScope } from '../core/shop-scope';
import { dataState, firebaseState, securityState } from '../core/state';
import { barcodeSignIdentity } from '../domain/barcode';
import { addZtoIdentityHeader, buildLookupRequestHeaders } from '../features/lookup-api';
import { applyBarcodeCloseChange } from '../features/barcode-ops';
import { scheduleZtoFinalMarks } from '../features/zto-final-marks';
import { setZtoPickupVerdict } from '../features/zto-status';
import { resolveNativeApiUrl, ztoIdentityTargetTrusted } from '../platform/native';
import { decryptLookupSecret } from './crypto';

export function failureMessage(code: string, reason = '') {
    if (reason === 'palm:no-session') return 'សាខានេះមិនទាន់មាន Login ZTO លើ Server។ សូម Login ZTO ជាមុនសិន។';
    if (reason === 'palm:branch-unknown') return 'សូមភ្ជាប់ Login ZTO របស់សាខានេះជាមុនសិន។';
    if (reason === 'palm:login-rejected') return 'ZTO បដិសេធគណនី ZTO របស់សាខា។ សូម Login ម្ដងទៀត។';
    const messages = {
        ZTO_PALM_DISPATCH_REQUIRED: 'ភស្តុតាងចែកចាយត្រូវផ្ទៀងម្ដងទៀត។ ZoeW កំពុងពិនិត្យ ZTO ឡើងវិញ រួចចុច «⬆ ផ្ញើបញ្ជី» ម្ដងទៀត។',
        ZTO_PALM_RELOGIN_REQUIRED: 'សូម Login ZTO ម្ដងទៀត ដើម្បីភ្ជាប់អ្នកចែកចាយ។',
        ZTO_PALM_SIGN_NAME_REQUIRED: 'ZTO គ្មានឈ្មោះអ្នកទទួល។ សូមបញ្ចូលឈ្មោះ រួចផ្ញើម្ដងទៀត។',
        ZTO_PALM_SIGN_CHECK_REJECTED: 'ZTO មិនអនុញ្ញាតឲ្យ Sign កញ្ចប់នេះ។ សូមពិនិត្យក្នុង ZTO។',
        ZTO_PALM_SIGN_PHOTO_REJECTED: 'ZTO មិនទទួលរូបភាព។ សូមសាកម្ដងទៀត។',
        ZTO_PALM_SIGN_REPORTED_REJECTED: 'ZTO រាយការណ៍ថា Sign មានបញ្ហា។ រូបនៅរក្សាទុក ហើយ ZoeW មិនផ្ញើស្ទួនទេ។ សូមផ្ទៀងកញ្ចប់ និងរូបក្នុង ZTO មុនបន្ត។',
        ZTO_PALM_SIGN_REJECTED: 'ZTO បដិសេធ Sign កញ្ចប់នេះ។',
        ZTO_PALM_SIGN_OTHER_REQUEST: 'កញ្ចប់នេះបាន Sign ពីការងារផ្សេង។ រូបរបស់ការងារនេះមិនទាន់បានបញ្ជាក់ថាទៅដល់ ZTO ទេ។ សូមពិនិត្យក្នុង ZTO។',
        ZTO_AUTH_EXPIRED: 'Session ZTO ផុតកំណត់។ សូម Login ZTO ម្ដងទៀត។',
        ZTO_OTHER_BRANCH: 'សាខា ZoeW និងគណនី ZTO មិនត្រូវគ្នា។',
        ZTO_PALM_SIGN_INVALID: 'Barcode ឈ្មោះអ្នកទទួល ឬរូបភាពមិនត្រឹមត្រូវ។'
    };
    return messages[code] || 'ផ្ញើទៅ ZTO មិនបាន។ សូមពិនិត្យបណ្ដាញ និងការភ្ជាប់ ZTO។';
}

const PALM_SESSION_FIELDS = ['palmTokenEnc', 'palmRefreshTokenEnc', 'palmExpiresAt', 'palmLoginAt', 'palmShared'];

export function palmSignConfigKey(cfg) {
    if (!cfg || typeof cfg !== 'object') return JSON.stringify(cfg ?? null);
    const rest = { ...cfg };
    for (const name of PALM_SESSION_FIELDS) delete rest[name];
    if (rest.palmAccount && typeof rest.palmAccount === 'object') rest.palmAccount = { siteCode: rest.palmAccount.siteCode };
    return JSON.stringify(rest);
}

const CONNECTION_SECRETS_MAX = 8;
const connectionSecrets = new WeakMap<object, Map<string, string>>();

function connectionSlot(cfg) {
    const key = securityState.lookupSecretKey;
    return key && cfg && typeof cfg === 'object' && cfg.headerValueEnc ? { key, enc: JSON.stringify(cfg.headerValueEnc) } : null;
}

async function rememberConnectionSecret(slot: { key: object; enc: string }, secret: string) {
    const digest = secret ? Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('palm-sign-connection\n' + secret))),
        (value) => value.toString(16).padStart(2, '0')).join('') : '';
    const known = connectionSecrets.get(slot.key) || new Map<string, string>();
    known.delete(slot.enc);
    known.set(slot.enc, digest);
    while (known.size > CONNECTION_SECRETS_MAX) known.delete(known.keys().next().value as string);
    connectionSecrets.set(slot.key, known);
}

export function palmSignConnectionKeyNow(cfg): string | undefined {
    const slot = connectionSlot(cfg);
    if (!slot || typeof cfg.url !== 'string') return '';
    const digest = connectionSecrets.get(slot.key)?.get(slot.enc);
    if (digest === undefined) return undefined;
    let base = '';
    try { const url = new URL(resolveNativeApiUrl(cfg.url), window.location.href); base = url.origin + url.pathname; } catch { return ''; }
    const site = cfg.palmAccount && typeof cfg.palmAccount.siteCode === 'string' ? cfg.palmAccount.siteCode.trim() : '';
    return digest ? JSON.stringify(['palm-sign-connection', base, String(cfg.headerName || '').trim().toLowerCase(), digest, site]) : '';
}

export async function palmSignConnectionKey(cfg): Promise<string> {
    const known = palmSignConnectionKeyNow(cfg);
    if (known !== undefined) return known;
    try { await rememberConnectionSecret(connectionSlot(cfg)!, await decryptLookupSecret(cfg.headerValueEnc)); } catch { return ''; }
    return palmSignConnectionKeyNow(cfg) ?? '';
}


export async function headersFor(cfg) {
    const identityHeaders = {};
    const slot = connectionSlot(cfg);
    const [headers] = await Promise.all([buildLookupRequestHeaders(cfg), addZtoIdentityHeader(cfg, identityHeaders)]);
    const secret = slot && typeof cfg.headerName === 'string' ? headers[cfg.headerName] : '';
    if (slot && typeof secret === 'string' && secret && securityState.lookupSecretKey === slot.key && palmSignConnectionKeyNow(cfg) === undefined) {
        void rememberConnectionSecret(slot, secret).catch(() => {});
    }
    return { ...headers, ...identityHeaders };
}

export function endpoint(cfg, action: string) {
    const target = new URL(resolveNativeApiUrl(cfg.url), window.location.href);
    if (!ztoIdentityTargetTrusted(target.href)) throw new Error('host');
    target.search = '?palm=' + action;
    target.hash = '';
    return target.href;
}

type PalmSignRequest = { barcode: string; stage: string; confirmationToken?: string; [key: string]: unknown };
type PalmSignReply = { res: { status: number }; body: any };

export async function requestPalmSignWithConfirmation<T extends PalmSignReply>(send: (body: PalmSignRequest) => Promise<T>,
    body: PalmSignRequest, current: () => boolean,
    onConfirmation?: (confirmation: { token: string; message: string }) => void | Promise<void>): Promise<T> {
    const input = { ...body };
    if (!current()) throw new Error('palm:session');
    const out = await send(input);
    if (!current()) throw new Error('palm:session');
    const stage = input.stage === 'receipt-check' ? 'receipt' : input.stage;
    const warning = out.body;
    if (input.confirmationToken || !['dispatch', 'receipt'].includes(stage) || out.res.status !== 409
        || warning?.code !== 'ZTO_PALM_SIGN_CONFIRM_REQUIRED' || warning.uncertain === true || warning.barcode !== input.barcode || warning.stage !== stage
        || typeof warning.message !== 'string' || !warning.message.trim() || warning.message.length > 4000
        || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(warning.message)
        || typeof warning.confirmationToken !== 'string' || !warning.confirmationToken.trim() || warning.confirmationToken.length > 8192) return out;
    const confirmation = { token: warning.confirmationToken, message: warning.message };
    if (!current()) throw new Error('palm:session');
    if (onConfirmation) await onConfirmation(confirmation);
    if (!current()) throw new Error('palm:session');
    const replay = await send({ ...input, confirmationToken: confirmation.token });
    if (!current()) throw new Error('palm:session');
    return replay;
}

export async function recordSigned(itemId: string, code: string, current: () => boolean, expectedSignIdentity?: string, signedAt?: number | string) {
    if (!current()) return false;
    const item = dataState.scanHistory.find((row) => row.id === itemId);
    const barcode = item?.barcodes?.find((b) => b.code === code);
    if (expectedSignIdentity !== undefined && (!barcode || barcodeSignIdentity(item, barcode) !== expectedSignIdentity)) return false;
    setZtoPickupVerdict(code, true, signedAt);
    scheduleZtoFinalMarks();
    if (barcode?.isClosed && expectedSignIdentity === undefined) return true;
    if (!barcode) return false;
    return await applyBarcodeCloseChange(itemId, code, true, { silent: true, showModal: false, ...(expectedSignIdentity !== undefined ? { expectedSignIdentity } : {}) }) === true;
}

let palmSignWrites: { database: unknown; auth: number; shop: string; tail: Promise<void> } | null = null;

export function recordPalmSignResult(...args: Parameters<typeof recordSigned>) {
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

export const PALM_PHOTO_PROTOCOL = 'original-sha256-v1';

export async function palmOriginalPhotoHash(photo: string) {
    const raw = atob(photo.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, ''));
    const hash = await crypto.subtle.digest('SHA-256', Uint8Array.from(raw, (value) => value.charCodeAt(0)));
    return Array.from(new Uint8Array(hash), (value) => value.toString(16).padStart(2, '0')).join('');
}

export function palmScanConfirmed(out, code: string, requestId: string) {
    return typeof code === 'string' && !!code && typeof requestId === 'string' && !!requestId
        && out?.res?.ok === true && out.body?.success === true && out.body.barcode === code && out.body.stage === 'receipt'
        && out.body.ztoClosed === true && out.body.requestId === requestId;
}

export function palmPhotoConfirmed(out, job: { code: string; requestId: string; originalSHA256?: string }) {
    if (!job || typeof job !== 'object') return false;
    const proof = out?.body?.photoProof;
    return palmScanConfirmed(out, job.code, job.requestId) && proof?.protocol === PALM_PHOTO_PROTOCOL && proof.verified === true
        && proof.barcode === job.code && proof.requestId === job.requestId && /^[a-f0-9]{64}$/.test(job.originalSHA256 || '')
        && proof.originalSHA256 === job.originalSHA256;
}


export async function palmOriginalFingerprint(barcode: string, requestId: string, signMan: string, photo: string) {
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify([barcode, requestId, signMan.trim(), photo])));
    return Array.from(new Uint8Array(hash), (value) => value.toString(16).padStart(2, '0')).join('');
}
