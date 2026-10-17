import { fieldChecked, fieldValue, setFieldChecked, setFieldValue } from '../app/refs';
import { modalIsOpen } from '../core/modals';
import { firebaseState, securityState, ztoState } from '../core/state';
import { viewState } from '../core/view-state';
import { elapsedSince } from '../core/elapsed';
import { shopScope } from '../core/shop-scope';
import { appLocalStore, safeStoreGet, safeStoreSet } from '../core/storage';
import { resolveNativeApiUrl, ztoIdentityTargetTrusted } from '../platform/native';
import { decryptLookupSecret, encryptLookupSecret } from '../services/crypto';
import { fetchWithTimeout } from '../services/network';
import { getLookupApiConfig, refreshShopBoundUi, storeLookupApiConfig } from './lookup-config';
import { lookupApiIsPalm, safeLookupReason } from './customer-table-prefetch';
import { addZtoIdentityHeader } from './lookup-api';
import { showToast } from '../ui/toast';

let editGeneration = 0;

export const PALM_REFRESH_AGE_MS = 4 * 60 * 60 * 1000;
export const PALM_REFRESH_RETRY_MS = 2 * 60 * 1000;
export const PALM_REFRESH_REJECTED_GAP_MS = 60 * 1000;
export const PALM_REFRESH_TIMEOUT_MS = 15000;
export const PALM_REFRESH_FINAL_CODES = ['ZTO_PALM_REFRESH_INVALID', 'ZTO_PALM_LOGIN_REJECTED', 'ZTO_PALM_VERIFICATION_REQUIRED', 'ZTO_PALM_COUNTRY_UNSUPPORTED'];

let palmRefreshRun = null;
let palmRefreshFailedAt = 0;
let palmRefreshRejectedAt = 0;
let palmRefreshDue = false;

const PALM_DEVICE_FIELDS = ['palmTokenEnc', 'palmExpiresAt', 'palmRefreshTokenEnc'];
export const PALM_CONFIG_FIELDS = ['palmTokenEnc', 'palmExpiresAt', 'palmAccount', 'palmRefreshTokenEnc', 'palmLoginAt', 'palmShared'];

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
    ZTO_TIMEOUT: 'ZTO ឆ្លើយតបយឺតពេក — សូមសាកម្ដងទៀត។',
    ZTO_OTHER_BRANCH: 'គណនី ZTO Palm នេះជាសាខាផ្សេងពីគណនី ZoeW ដែលកំពុងចូល។',
    ZTO_PALM_STORE_UNAVAILABLE: 'Server រក្សាទុក Login Palm មិនបានឥឡូវ — សូមសាកម្ដងទៀត។'
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

export function palmIsShared(cfg) {
    return !!(cfg && lookupApiIsPalm(cfg) && cfg.palmShared === true);
}

function palmSiteText(account) {
    return (account && (account.siteName || account.siteCode)) || '—';
}

export function refreshZtoPalmLogin() {
    cancelZtoPalmLogin();
    const cfg = getLookupApiConfig();
    viewState.palmLoginConnected = !!(lookupApiIsPalm(cfg) && (cfg.palmTokenEnc || cfg.palmShared));
    viewState.palmLoginStatus = !viewState.palmLoginConnected
        ? 'ចូលគណនី Palm ម្តង ➜ ទូរស័ព្ទគ្រប់គ្រឿងក្នុងហាងដែលមានសោភ្ជាប់ដដែលប្រើបានដោយមិនបាច់ Login ទៀត។'
        : palmIsShared(cfg)
            ? '✅ ប្រើ Login Palm របស់ហាង (ទុកលើ Server) · សាខា ' + palmSiteText(cfg.palmAccount)
            : '✅ បានភ្ជាប់ Palm · សាខា ' + palmSiteText(cfg.palmAccount);
    setFieldValue('ztoPalmUsernameInput', '');
}

function palmConfigFor(url, headerValueEnc, account, shop, extra) {
    const next: any = {
        enabled: true, fastMode: true, autoSubmit: fieldChecked('lookupApiAutoSubmitCheckbox'),
        url, headerName: 'X-Zoe-Proxy-Key', headerValueEnc, phoneField: 'phone', codField: 'cod', dodField: 'dod',
        palmAccount: palmAccountOf(account), shop, palmLoginAt: Date.now(), ...extra
    };
    return next;
}

function applyPalmConfig(next) {
    if (!storeLookupApiConfig(next)) return false;
    setFieldChecked('lookupApiEnabledCheckbox', true);
    setFieldChecked('lookupApiFastModeCheckbox', true);
    setFieldValue('lookupApiUrlInput', next.url);
    setFieldValue('lookupApiHeaderNameInput', next.headerName);
    setFieldValue('lookupApiHeaderValueInput', '');
    for (const [field, value] of [['lookupApiPhoneFieldInput', 'phone'], ['lookupApiCodFieldInput', 'cod'], ['lookupApiDodFieldInput', 'dod']] as const) setFieldValue(field, value);
    viewState.lookupHeaderValuePlaceholder = '•••••••• (មានរួច — ទុកទទេដើម្បីរក្សា)';
    viewState.palmLoginConnected = true;
    return true;
}

function addPalmSiteHeader(cfg, headers) {
    const site = cfg && cfg.palmAccount && typeof cfg.palmAccount.siteCode === 'string' ? cfg.palmAccount.siteCode.trim() : '';
    if (/^[A-Za-z0-9_-]{1,32}$/.test(site)) headers['X-Zoe-Palm-Site'] = site;
    return headers;
}

function palmFunctionBase() {
    return new URL(resolveNativeApiUrl('/.netlify/functions/zto-order-detail'), window.location.href);
}

function palmLookupUrl(base) {
    base.search = '?palm=1&barcode={barcode}';
    base.hash = '';
    return base.href.replace('%7Bbarcode%7D', '{barcode}');
}

function palmEditSession(inModal: boolean) {
    const generation = ++editGeneration;
    const shop = shopScope();
    const auth = firebaseState.authGeneration;
    const key = securityState.lookupSecretKey;
    const stored = safeStoreGet(appLocalStore, 'zoew_lookup_api_config');
    const current = () => generation === editGeneration && shopScope() === shop && firebaseState.authGeneration === auth
        && securityState.lookupSecretKey === key && (!inModal || modalIsOpen('lookupApiConfigModal'))
        && safeStoreGet(appLocalStore, 'zoew_lookup_api_config') === stored;
    return { generation, shop, key, current };
}

async function palmProxyKey(cfg) {
    const typedKey = fieldValue('lookupApiHeaderValueInput').trim();
    if (typedKey) return typedKey;
    if (!cfg || String(cfg.headerName || '').toLowerCase() !== 'x-zoe-proxy-key') return '';
    return cfg.headerValueEnc ? await decryptLookupSecret(cfg.headerValueEnc) : cfg.headerValue || '';
}

export async function submitZtoPalmLogin(event?: Event) {
    event?.preventDefault();
    if (viewState.palmLoginBusy) return;
    const { generation, shop, key, current } = palmEditSession(true);
    const cfg = getLookupApiConfig() || {};
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
        const base = palmFunctionBase();
        if (!ztoIdentityTargetTrusted(base.href)) throw new Error('host');
        const proxyKey = await palmProxyKey(cfg);
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
        const shared = body.shared === true;
        const refreshToken = !shared && typeof body.refreshToken === 'string' ? body.refreshToken : '';
        const [palmTokenEnc, headerValueEnc, palmRefreshTokenEnc] = await Promise.all([shared ? Promise.resolve('') : encryptLookupSecret(body.sessionToken),
            encryptLookupSecret(proxyKey), refreshToken ? encryptLookupSecret(refreshToken) : Promise.resolve('')]);
        if (!current()) return dropped();
        if ((!shared && !palmTokenEnc) || !headerValueEnc || (refreshToken && !palmRefreshTokenEnc)) throw new Error('encryption');
        const next = palmConfigFor(palmLookupUrl(base), headerValueEnc, body.account, shop, shared
            ? { palmShared: true }
            : { palmTokenEnc, palmExpiresAt: body.expiresAt, ...(palmRefreshTokenEnc ? { palmRefreshTokenEnc } : {}) });
        if (!applyPalmConfig(next)) return;
        viewState.palmLoginStatus = '✅ ចូល Palm រួច · សាខា ' + palmSiteText(next.palmAccount) + ' · Lookup បានបើក'
            + (shared ? ' · ទូរស័ព្ទផ្សេងក្នុងហាងប្រើបានដោយមិនបាច់ Login' : '');
        refreshShopBoundUi();
    } catch (_) {
        if (current()) viewState.palmLoginStatus = 'ភ្ជាប់ ZTO Palm មិនបាន។ សូមពិនិត្យបណ្ដាញ ហើយសាកម្ដងទៀត។';
        else dropped();
    } finally {
        if (generation === editGeneration) viewState.palmLoginBusy = false;
    }
}

function disconnectZtoPalmLocally(cfg) {
    const next = { ...cfg, enabled: false };
    for (const name of ['provider', ...PALM_CONFIG_FIELDS]) delete next[name];
    const url = new URL(next.url, window.location.href);
    url.searchParams.delete('palm');
    next.url = url.href.replace('%7Bbarcode%7D', '{barcode}');
    if (!storeLookupApiConfig(next)) return false;
    setFieldChecked('lookupApiEnabledCheckbox', false);
    setFieldValue('lookupApiUrlInput', next.url);
    refreshZtoPalmLogin();
    refreshShopBoundUi();
    return true;
}

export async function connectSharedZtoPalm() {
    if (viewState.palmLoginBusy) return;
    const { generation, shop, key, current } = palmEditSession(true);
    const cfg = getLookupApiConfig() || {};
    if (!key) { viewState.palmLoginStatus = 'សូមបើកការកំណត់នេះដោយ PIN ម្តងទៀត។'; return; }
    if (!shop) { viewState.palmLoginStatus = 'សូមចូលគណនី ZoeW ជាមុនសិន។'; return; }
    viewState.palmLoginBusy = true;
    viewState.palmLoginStatus = 'កំពុងរក Login Palm របស់ហាងលើ Server…';
    try {
        const base = palmFunctionBase();
        if (!ztoIdentityTargetTrusted(base.href)) throw new Error('host');
        const proxyKey = await palmProxyKey(cfg);
        if (!current()) return;
        if (!proxyKey) { viewState.palmLoginStatus = 'សូមបញ្ចូលសោភ្ជាប់ ZoeW ក្នុងប្រអប់ Secret ខាងក្រោម។'; return; }
        base.search = '?palm=status';
        const headers = { 'X-Zoe-Proxy-Key': proxyKey };
        await addZtoIdentityHeader({ url: base.href }, headers);
        if (!current()) return;
        const out = await fetchWithTimeout(base.href, { headers, cache: 'no-store' }, 15000, 'Palm status timed out',
            (response) => response.json().catch(() => null));
        if (!current()) return;
        const body = out.body;
        if (!out.res.ok || !body?.success) { viewState.palmLoginStatus = palmLoginFailureText(body, out.res.status); return; }
        if (body.otherBranch) { viewState.palmLoginStatus = PALM_LOGIN_MESSAGES.ZTO_OTHER_BRANCH; return; }
        if (body.branchUnknown) {
            viewState.palmLoginStatus = 'សោភ្ជាប់នេះមាន Login Palm ច្រើនសាខា ហើយ Server មិនស្គាល់សាខារបស់គណនី ZoeW នេះ — សូម Login ZTO Palm ដោយគណនីរបស់សាខានេះ។';
            return;
        }
        if (!body.shared) {
            viewState.palmLoginStatus = body.rejected
                ? 'ZTO បដិសេធ Login Palm របស់ហាង — សូម Login ZTO Palm ម្តងទៀតដោយគណនី និងពាក្យសម្ងាត់។'
                : 'ហាងនេះមិនទាន់ Login ZTO Palm លើ Server — សូម Login ម្តងដោយគណនី និងពាក្យសម្ងាត់។';
            return;
        }
        const headerValueEnc = await encryptLookupSecret(proxyKey);
        if (!current()) return;
        if (!headerValueEnc) throw new Error('encryption');
        const next = palmConfigFor(palmLookupUrl(base), headerValueEnc, body.account, shop, { palmShared: true });
        if (!applyPalmConfig(next)) return;
        viewState.palmLoginStatus = '✅ ប្រើ Login Palm របស់ហាង · សាខា ' + palmSiteText(next.palmAccount) + ' · Lookup បានបើក';
        refreshShopBoundUi();
    } catch (_) {
        if (current()) viewState.palmLoginStatus = 'ភ្ជាប់ ZTO Palm មិនបាន។ សូមពិនិត្យបណ្ដាញ ហើយសាកម្ដងទៀត។';
    } finally {
        if (generation === editGeneration) viewState.palmLoginBusy = false;
    }
}

export function disconnectZtoPalm() {
    cancelZtoPalmLogin();
    const cfg = getLookupApiConfig();
    if (!lookupApiIsPalm(cfg)) return;
    if (!palmIsShared(cfg)) {
        disconnectZtoPalmLocally(cfg);
        return;
    }
    if (!window.confirm('ផ្តាច់ Login ZTO Palm របស់សាខានេះពី Server? ទូរស័ព្ទគ្រប់គ្រឿងនៃសាខានេះប្រើ Palm បានវិញក្រោយ Login ZTO Palm ម្តងទៀត។')) return;
    return disconnectSharedZtoPalm(cfg);
}

async function disconnectSharedZtoPalm(cfg) {
    const { generation, current } = palmEditSession(false);
    viewState.palmLoginBusy = true;
    viewState.palmLoginStatus = 'កំពុងផ្តាច់ Login Palm ពី Server…';
    try {
        const base = new URL(String(cfg.url).replace('{barcode}', 'x'), window.location.href);
        base.search = '?palm=logout';
        base.hash = '';
        if (!ztoIdentityTargetTrusted(base.href)) throw new Error('host');
        const proxyKey = cfg.headerValueEnc ? await decryptLookupSecret(cfg.headerValueEnc) : '';
        if (!current()) return;
        if (!proxyKey) { viewState.palmLoginStatus = 'សូមបើកការកំណត់នេះដោយ PIN ម្តងទៀត។'; return; }
        const headers = addPalmSiteHeader(cfg, { 'X-Zoe-Proxy-Key': proxyKey });
        await addZtoIdentityHeader({ url: base.href }, headers);
        if (!current()) return;
        const out = await fetchWithTimeout(base.href, { method: 'POST', headers, cache: 'no-store' }, 15000, 'Palm logout timed out',
            (response) => response.json().catch(() => null));
        if (!current()) return;
        if (!out.res.ok || !out.body?.success) { viewState.palmLoginStatus = palmLoginFailureText(out.body, out.res.status); return; }
        disconnectZtoPalmLocally(cfg);
        viewState.palmLoginStatus = 'បានផ្តាច់ Login Palm របស់ហាងពី Server។';
    } catch (_) {
        if (current()) viewState.palmLoginStatus = 'ផ្តាច់ពី Server មិនបាន។ សូមពិនិត្យបណ្ដាញ ហើយសាកម្ដងទៀត។';
    } finally {
        if (generation === editGeneration) viewState.palmLoginBusy = false;
    }
}

export function palmRefreshAvailable(cfg?) {
    const current = cfg || getLookupApiConfig();
    return !!(current && lookupApiIsPalm(current) && current.palmRefreshTokenEnc);
}

export function noteZtoPalmSessionRejected(cfg) {
    const current = getLookupApiConfig();
    if (!palmRefreshAvailable(current)) return false;
    if (cfg && JSON.stringify(cfg.palmTokenEnc) !== JSON.stringify(current.palmTokenEnc)) return true;
    if (!palmRefreshRun) {
        if (palmRefreshRejectedAt && elapsedSince(palmRefreshRejectedAt) < PALM_REFRESH_REJECTED_GAP_MS) return true;
        palmRefreshRejectedAt = Date.now();
        palmRefreshDue = true;
        palmRefreshFailedAt = 0;
    }
    refreshZtoPalmSession();
    return true;
}

function storedLookupConfigWith(stored, changes, drop) {
    let raw = null;
    try { raw = JSON.parse(stored); } catch (_) { raw = null; }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
    const next = Object.assign(raw, changes);
    for (const name of drop) delete next[name];
    return safeStoreSet(appLocalStore, 'zoew_lookup_api_config', JSON.stringify(next));
}

export function refreshZtoPalmSession() {
    if (palmRefreshRun) return palmRefreshRun;
    palmRefreshRun = runZtoPalmRefresh().finally(() => { palmRefreshRun = null; });
    return palmRefreshRun;
}

async function runZtoPalmRefresh() {
    const cfg = getLookupApiConfig();
    if (!palmRefreshAvailable(cfg)) return 'skipped';
    const due = palmRefreshDue || !Number.isFinite(Number(cfg.palmLoginAt)) || elapsedSince(Number(cfg.palmLoginAt)) >= PALM_REFRESH_AGE_MS;
    if (!due) return 'fresh';
    if (palmRefreshFailedAt && elapsedSince(palmRefreshFailedAt) < PALM_REFRESH_RETRY_MS) return 'skipped';
    const key = securityState.lookupSecretKey;
    const shop = shopScope();
    if (!key || !shop || (navigator.onLine as boolean) === false || ztoState.ztoListSyncInFlight || viewState.palmLoginBusy) return 'skipped';
    const auth = firebaseState.authGeneration;
    const stored = safeStoreGet(appLocalStore, 'zoew_lookup_api_config');
    const current = () => shopScope() === shop && firebaseState.authGeneration === auth && securityState.lookupSecretKey === key
        && safeStoreGet(appLocalStore, 'zoew_lookup_api_config') === stored && !viewState.palmLoginBusy;
    const asked = palmRefreshDue;
    try {
        const base = new URL(String(cfg.url).replace('{barcode}', 'x'), window.location.href);
        base.search = '?palm=refresh';
        base.hash = '';
        if (!ztoIdentityTargetTrusted(base.href)) return 'skipped';
        const [proxyKey, refreshToken] = await Promise.all([cfg.headerValueEnc ? decryptLookupSecret(cfg.headerValueEnc) : Promise.resolve(''),
            decryptLookupSecret(cfg.palmRefreshTokenEnc)]);
        if (!current()) return 'skipped';
        if (!proxyKey || !refreshToken) {
            palmRefreshFailedAt = Date.now();
            return 'failed';
        }
        const headers = addPalmSiteHeader(cfg, { 'Content-Type': 'application/json', 'X-Zoe-Proxy-Key': proxyKey });
        await addZtoIdentityHeader({ url: base.href }, headers);
        if (!current()) return 'skipped';
        const out = await fetchWithTimeout(base.href, { method: 'POST', headers, body: JSON.stringify({ refreshToken }), cache: 'no-store' },
            PALM_REFRESH_TIMEOUT_MS, 'Palm refresh timed out', (response) => response.json().catch(() => null));
        if (!current()) return 'skipped';
        const body = out.body;
        const code = body && typeof body.code === 'string' ? body.code : '';
        const site = cfg.palmAccount && typeof cfg.palmAccount.siteCode === 'string' ? cfg.palmAccount.siteCode : '';
        const ok = out.res.ok && body && body.success === true && typeof body.sessionToken === 'string' && body.sessionToken
            && typeof body.refreshToken === 'string' && body.refreshToken && Number.isFinite(body.expiresAt);
        const moved = ok && palmAccountOf(body.account).siteCode !== site;
        if (moved || (!out.res.ok && PALM_REFRESH_FINAL_CODES.indexOf(code) !== -1)) {
            storedLookupConfigWith(stored, {}, ['palmRefreshTokenEnc']);
            palmRefreshDue = false;
            showToast('⚠️ Login ZTO Palm ស្វ័យប្រវត្តិមិនបាន — ' + (moved ? 'គណនី Palm ជាសាខាផ្សេង។' : palmLoginFailureText(body, out.res.status))
                + ' សូម Login ZTO Palm ម្តងទៀតក្នុង «API ស្វែងរកអតិថិជន»');
            return 'rejected';
        }
        if (!ok) {
            palmRefreshFailedAt = Date.now();
            return 'failed';
        }
        const shared = body.shared === true;
        const [palmTokenEnc, palmRefreshTokenEnc] = shared ? ['', ''] : await Promise.all([encryptLookupSecret(body.sessionToken), encryptLookupSecret(body.refreshToken)]);
        if (!current()) return 'skipped';
        if (!shared && (!palmTokenEnc || !palmRefreshTokenEnc)) {
            palmRefreshFailedAt = Date.now();
            return 'failed';
        }
        const renewed = shared
            ? storedLookupConfigWith(stored, { palmShared: true, palmLoginAt: Date.now() }, PALM_DEVICE_FIELDS)
            : storedLookupConfigWith(stored, { palmTokenEnc, palmRefreshTokenEnc, palmExpiresAt: body.expiresAt, palmLoginAt: Date.now() }, []);
        if (!renewed) {
            palmRefreshFailedAt = Date.now();
            return 'failed';
        }
        palmRefreshFailedAt = 0;
        palmRefreshDue = false;
        if (asked) showToast('✅ Login ZTO Palm ឡើងវិញរួច — សូមស្កេន ឬទាញម្តងទៀត');
        return 'renewed';
    } catch (_) {
        if (current()) palmRefreshFailedAt = Date.now();
        return current() ? 'failed' : 'skipped';
    }
}

export function notePalmSiteName(site, siteName) {
    const name = typeof siteName === 'string' ? siteName.trim().slice(0, 120) : '';
    const code = typeof site === 'string' ? site.trim() : '';
    const cfg = getLookupApiConfig();
    if (!name || !code || !lookupApiIsPalm(cfg) || !cfg.palmAccount || cfg.palmAccount.siteCode !== code || cfg.palmAccount.siteName) return false;
    const stored = safeStoreGet(appLocalStore, 'zoew_lookup_api_config');
    return storedLookupConfigWith(stored, { palmAccount: { siteCode: code, siteName: name } }, []);
}

export function resetZtoPalmRefresh() {
    palmRefreshFailedAt = 0;
    palmRefreshRejectedAt = 0;
    palmRefreshDue = false;
}
