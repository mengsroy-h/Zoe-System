import { dataState } from '../core/state';
import { barcodeSignIdentity } from '../domain/barcode';
import { addZtoIdentityHeader, buildLookupRequestHeaders } from '../features/lookup-api';
import { applyBarcodeCloseChange } from '../features/barcode-ops';
import { scheduleZtoFinalMarks } from '../features/zto-final-marks';
import { setZtoPickupVerdict } from '../features/zto-status';
import { resolveNativeApiUrl, ztoIdentityTargetTrusted } from '../platform/native';

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


export async function headersFor(cfg) {
    const identityHeaders = {};
    const [headers] = await Promise.all([buildLookupRequestHeaders(cfg), addZtoIdentityHeader(cfg, identityHeaders)]);
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
