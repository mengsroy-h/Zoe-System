import { fieldChecked, fieldValue, setFieldChecked, setFieldValue } from '../app/refs';
import { modalIsOpen } from '../core/modals';
import { firebaseState, securityState } from '../core/state';
import { viewState } from '../core/view-state';
import { shopScope } from '../core/shop-scope';
import { appLocalStore, safeStoreGet, safeStoreSet } from '../core/storage';
import { resolveNativeApiUrl, ztoIdentityTargetTrusted } from '../platform/native';
import { decryptLookupSecret, encryptLookupSecret } from '../services/crypto';
import { fetchWithTimeout } from '../services/network';
import { getLookupApiConfig, refreshShopBoundUi, storeLookupApiConfig } from './lookup-config';
import { lookupApiIsPalm, safeLookupReason } from './customer-table-prefetch';
import { addZtoIdentityHeader } from './lookup-api';

let editGeneration = 0;

const PALM_LOGIN_MESSAGES = {
    ZTO_PALM_LOGIN_REJECTED: 'ZTO បដិសេធការចូល — គណនី ឬពាក្យសម្ងាត់ Palm មិនត្រឹមត្រូវ ឬគណនីមិនមានសិទ្ធិ។',
    ZTO_PALM_VERIFICATION_REQUIRED: 'ZTO ស្នើការផ្ទៀងផ្ទាត់បន្ថែម។ សូមផ្ទៀងផ្ទាត់តាមកម្មវិធី ZTO ផ្លូវការ។',
    ZTO_PALM_NOT_CONFIGURED: 'Server មិនទាន់បានកំណត់ការភ្ជាប់ ZTO Palm។',
    ZTO_PALM_COUNTRY_UNSUPPORTED: 'Lookup នេះគាំទ្រគណនី ZTO កម្ពុជា (KH)។',
    ZTO_PROXY_NOT_CONFIGURED: 'Server មិនទាន់បានកំណត់សោភ្ជាប់ ZoeW។',
    ZTO_CONFIG_INVALID: 'Config ZTO នៅ Netlify មិនត្រឹមត្រូវ។',
    ZTO_IDENTITY_REQUIRED: 'Server ត្រូវការគណនី ZoeW ដែលកំពុងចូល — សូមចាកចេញ ហើយចូលគណនីម្តងទៀត។',
    ZTO_IDENTITY_UNAVAILABLE: 'ផ្ទៀងផ្ទាត់គណនី ZoeW ជាមួយ Server មិនបាន — សូមសាកម្ដងទៀត។',
    ZTO_RATE_LIMITED: 'ZTO កំណត់ល្បឿន — សូមរង់ចាំបន្តិច ហើយសាកម្ដងទៀត។',
    ZTO_TIMEOUT: 'ZTO ឆ្លើយតបយឺតពេក — សូមសាកម្ដងទៀត។'
};

function palmLoginFailureText(body, status) {
    const code = body && typeof body.code === 'string' ? body.code : '';
    const reason = safeLookupReason(body && body.reason);
    const text = PALM_LOGIN_MESSAGES[code] || (status === 401 ? 'សោភ្ជាប់ ZoeW មិនត្រឹមត្រូវ។' : 'ភ្ជាប់ ZTO Palm មិនបាន។ សូមសាកម្ដងទៀត។');
    return reason ? text + ' (' + reason + ')' : text;
}

function palmAccountOf(account) {
    return {
        siteCode: String((account && account.siteCode) || '').slice(0, 64),
        siteName: String((account && account.siteName) || '').slice(0, 120)
    };
}

export function cancelZtoPalmLogin() {
    editGeneration++;
    setFieldValue('ztoPalmPasswordInput', '');
    viewState.palmLoginBusy = false;
}

export function refreshZtoPalmLogin() {
    cancelZtoPalmLogin();
    const cfg = getLookupApiConfig();
    viewState.palmLoginConnected = !!(lookupApiIsPalm(cfg) && cfg.palmTokenEnc);
    viewState.palmLoginStatus = viewState.palmLoginConnected
        ? '✅ បានភ្ជាប់ Palm · សាខា ' + (cfg.palmAccount?.siteName || cfg.palmAccount?.siteCode || '—')
        : 'ចូលគណនី Palm ដើម្បីទាញលេខទូរស័ព្ទ និង COD/DOD ពេលស្កេន។';
    setFieldValue('ztoPalmUsernameInput', '');
}

export async function submitZtoPalmLogin(event?: Event) {
    event?.preventDefault();
    if (viewState.palmLoginBusy) return;
    const generation = ++editGeneration;
    const shop = shopScope();
    const auth = firebaseState.authGeneration;
    const key = securityState.lookupSecretKey;
    const cfg = getLookupApiConfig() || {};
    const stored = safeStoreGet(appLocalStore, 'zoew_lookup_api_config');
    const current = () => generation === editGeneration && shopScope() === shop && firebaseState.authGeneration === auth
        && securityState.lookupSecretKey === key && modalIsOpen('lookupApiConfigModal')
        && safeStoreGet(appLocalStore, 'zoew_lookup_api_config') === stored;
    const dropped = () => {
        if (generation === editGeneration && modalIsOpen('lookupApiConfigModal')) {
            viewState.palmLoginStatus = 'ការកំណត់បានប្តូរខណៈកំពុងចូល — សូម Login ZTO Palm ម្តងទៀត។';
        }
    };
    const username = fieldValue('ztoPalmUsernameInput').trim();
    const password = fieldValue('ztoPalmPasswordInput');
    setFieldValue('ztoPalmPasswordInput', '');
    if (!username || !password) { viewState.palmLoginStatus = 'សូមបញ្ចូលគណនី និងពាក្យសម្ងាត់ Palm។'; return; }
    if (!key) { viewState.palmLoginStatus = 'សូមបើកការកំណត់នេះដោយ PIN ម្តងទៀត។'; return; }
    if (!shop) { viewState.palmLoginStatus = 'សូមចូលគណនី ZoeW ជាមុនសិន។'; return; }
    viewState.palmLoginBusy = true;
    viewState.palmLoginStatus = 'កំពុងចូល ZTO Palm…';
    try {
        const base = new URL(resolveNativeApiUrl('/.netlify/functions/zto-order-detail'), window.location.href);
        if (!ztoIdentityTargetTrusted(base.href)) throw new Error('host');
        const typedKey = fieldValue('lookupApiHeaderValueInput').trim();
        const proxyKey = typedKey || (cfg.headerName?.toLowerCase() === 'x-zoe-proxy-key'
            ? (cfg.headerValueEnc ? await decryptLookupSecret(cfg.headerValueEnc) : cfg.headerValue || '') : '');
        if (!current()) return dropped();
        if (!proxyKey) { viewState.palmLoginStatus = 'សូមបញ្ចូលសោភ្ជាប់ ZoeW ក្នុងប្រអប់ Secret ខាងក្រោម។'; return; }
        let deviceSn = safeStoreGet(appLocalStore, 'zoew_palm_device_id');
        if (!deviceSn || !/^[A-Za-z0-9-]{8,80}$/.test(deviceSn)) {
            deviceSn = 'zoew-' + crypto.randomUUID();
            if (!safeStoreSet(appLocalStore, 'zoew_palm_device_id', deviceSn)) throw new Error('storage');
        }
        base.search = '?palm=login';
        const headers = { 'Content-Type': 'application/json', 'X-Zoe-Proxy-Key': proxyKey };
        await addZtoIdentityHeader({ url: base.href }, headers);
        if (!current()) return dropped();
        const out = await fetchWithTimeout(base.href, {
            method: 'POST', headers,
            body: JSON.stringify({ username, password, deviceSn }), cache: 'no-store'
        }, 15000, 'Palm login timed out', (response) => response.json().catch(() => null));
        if (!current()) return dropped();
        const body = out.body;
        if (!out.res.ok || !body?.success || typeof body.sessionToken !== 'string' || !body.sessionToken || !Number.isFinite(body.expiresAt)) {
            viewState.palmLoginStatus = palmLoginFailureText(body, out.res.status);
            return;
        }
        const [palmTokenEnc, headerValueEnc] = await Promise.all([encryptLookupSecret(body.sessionToken), encryptLookupSecret(proxyKey)]);
        if (!current()) return dropped();
        if (!palmTokenEnc || !headerValueEnc) throw new Error('encryption');
        base.search = '?palm=1&barcode={barcode}';
        const url = base.href.replace('%7Bbarcode%7D', '{barcode}');
        const next = {
            enabled: true, fastMode: true, autoSubmit: fieldChecked('lookupApiAutoSubmitCheckbox'),
            url, headerName: 'X-Zoe-Proxy-Key', headerValueEnc, phoneField: 'phone', codField: 'cod', dodField: 'dod',
            palmTokenEnc, palmExpiresAt: body.expiresAt, palmAccount: palmAccountOf(body.account), shop
        };
        if (!storeLookupApiConfig(next)) return;
        setFieldChecked('lookupApiEnabledCheckbox', true);
        setFieldChecked('lookupApiFastModeCheckbox', true);
        setFieldValue('lookupApiUrlInput', url);
        setFieldValue('lookupApiHeaderNameInput', next.headerName);
        setFieldValue('lookupApiHeaderValueInput', '');
        for (const [field, value] of [['lookupApiPhoneFieldInput', 'phone'], ['lookupApiCodFieldInput', 'cod'], ['lookupApiDodFieldInput', 'dod']] as const) setFieldValue(field, value);
        viewState.lookupHeaderValuePlaceholder = '•••••••• (មានរួច — ទុកទទេដើម្បីរក្សា)';
        viewState.palmLoginConnected = true;
        viewState.palmLoginStatus = '✅ ចូល Palm រួច · សាខា ' + (next.palmAccount.siteName || next.palmAccount.siteCode || '—') + ' · Lookup បានបើក';
        refreshShopBoundUi();
    } catch (_) {
        if (current()) viewState.palmLoginStatus = 'ភ្ជាប់ ZTO Palm មិនបាន។ សូមពិនិត្យបណ្ដាញ ហើយសាកម្ដងទៀត។';
        else dropped();
    } finally {
        if (generation === editGeneration) viewState.palmLoginBusy = false;
    }
}

export function disconnectZtoPalm() {
    cancelZtoPalmLogin();
    const cfg = getLookupApiConfig();
    if (!lookupApiIsPalm(cfg)) return;
    const next = { ...cfg, enabled: false };
    for (const name of ['provider', 'palmTokenEnc', 'palmAccount', 'palmExpiresAt']) delete next[name];
    const url = new URL(next.url, window.location.href);
    url.searchParams.delete('palm');
    next.url = url.href.replace('%7Bbarcode%7D', '{barcode}');
    if (!storeLookupApiConfig(next)) return;
    setFieldChecked('lookupApiEnabledCheckbox', false);
    setFieldValue('lookupApiUrlInput', next.url);
    refreshZtoPalmLogin();
    refreshShopBoundUi();
}
