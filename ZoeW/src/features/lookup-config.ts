import { refreshPalmSignMode } from './zto-palm-sign';
import { fieldChecked, fieldValue, setFieldChecked, setFieldValue } from '../app/refs';
import { viewState } from '../core/view-state';
import { firebaseState, securityState } from '../core/state';
import { sameShop, shopOwnsSetting, shopScope } from '../core/shop-scope';
import { appLocalStore, safeStoreGet, safeStoreSet } from '../core/storage';
import { LOOKUP_TEST_TIMEOUT_MS, ZTO_TEST_TIMEOUT_MS } from './auto-lookup';
import { clearCustomerDataTableCache, prefetchCustomerDataTableRowsIfConfigured } from './customer-table';
import { lookupApiIsPalm, lookupApiIsZto } from './customer-table-prefetch';
import { addPalmSessionHeader, addZtoIdentityHeader, lookupApiIsAppsScript, lookupApiSendsHeader } from './lookup-api';
import { PALM_CONFIG_FIELDS, refreshZtoPalmLogin } from './zto-palm-login';
import { refreshZtoListSyncUi } from './zto-list-sync';
import { clearZtoPickupStatusStore, refreshZtoAutoCloseUi } from './zto-status';
import { decryptLookupSecret, encryptLookupSecret } from '../services/crypto';
import { fetchWithTimeout } from '../services/network';
import { lookupUrlSplitKey, lookupUrlWithKey } from '../services/setup-lookup';
import { effectiveZtoTrashMode, lastSeenShopZtoTrashMode, markZtoTrashMode, pruneZtoTrashMode, withdrawLeftZtoTrashModes, withdrawZtoTrashMode } from '../services/zto-trash-mode';
import { closeModal, openModalHelper } from '../ui/modal';
import { showToast } from '../ui/toast';

export const LOOKUP_URL_KEY_NOTE = '🔒 key របស់ Apps Script រក្សាទុកអ៊ិនគ្រីបក្រោម PIN — URL ខាងលើគ្មាន key · បិទភ្ជាប់ URL ពេញដែលមាន &key=… ដើម្បីប្តូរ';

export function lookupSecretLocked(cfg) {
    return !!cfg && ((lookupApiSendsHeader(cfg) && !!cfg.headerValueEnc) || !!cfg.urlKeyEnc) && !securityState.lookupSecretKey;
}

export async function lookupKeyedUrl(cfg, url) {
    if (!cfg || !cfg.urlKeyEnc) return url;
    const key = await decryptLookupSecret(cfg.urlKeyEnc);
    return key ? lookupUrlWithKey(url, key) : url;
}

export function refreshShopBoundUi() {
    refreshZtoTrashModeMark();
    refreshPalmSignMode();
    refreshZtoAutoCloseUi();
    refreshZtoListSyncUi();
}

export function getLookupApiConfig() {
    try {
        const raw = appLocalStore.getItem('zoew_lookup_api_config');
        const cfg = raw ? JSON.parse(raw) : null;
        return shopOwnsSetting(cfg, 'zoew_lookup_api_config') ? cfg : null;
    } catch (e) {
        return null;
    }
}

export function ztoTrashModeOf(cfg) {
    if (!cfg?.enabled || !lookupApiIsZto(cfg)) return 'local';
    return lookupApiIsPalm(cfg) ? 'palm' : 'cookie';
}

export function getZtoTrashMode() {
    return ztoTrashModeOf(getLookupApiConfig());
}

function storedZtoTrashModeHere() {
    try {
        const cfg = JSON.parse(safeStoreGet(appLocalStore, 'zoew_lookup_api_config') || 'null');
        return cfg && (!cfg.shop || sameShop(cfg.shop, shopScope())) ? ztoTrashModeOf(cfg) : 'local';
    } catch (e) {
        return 'local';
    }
}

export function getShopZtoTrashMode() {
    return effectiveZtoTrashMode(getZtoTrashMode());
}

export function getManualZtoTrashMode() {
    return getShopZtoTrashMode() || lastSeenShopZtoTrashMode() || 'local';
}

export function refreshZtoTrashModeMark() {
    const mode = getZtoTrashMode();
    pruneZtoTrashMode();
    withdrawLeftZtoTrashModes(mode);
    return markZtoTrashMode(mode);
}

export function openLookupApiConfigModal() {
    viewState.lookupTestResult = '';
    refreshZtoPalmLogin();
    const cfg = getLookupApiConfig() || {};
    const setVal = (id, val) => { setFieldValue(id, val || ''); };

    setFieldChecked('lookupApiEnabledCheckbox', !!cfg.enabled);

    setFieldChecked('lookupApiAutoSubmitCheckbox', !!cfg.autoSubmit);

    setFieldChecked('lookupApiFastModeCheckbox', !!cfg.fastMode);

    setVal('lookupApiUrlInput', cfg.url);
    viewState.lookupUrlKeyNote = cfg.urlKeyEnc ? LOOKUP_URL_KEY_NOTE : '';
    setVal('lookupApiHeaderNameInput', cfg.headerName);
    setFieldValue('lookupApiHeaderValueInput', '');
    viewState.lookupHeaderValuePlaceholder = cfg.headerValueEnc ? '•••••••• (មានរួច — ទុកទទេប្រសិនបើមិនចង់ប្តូរ)' : 'ឧ. Bearer xxxxx ឬ Secret Key';
    setVal('lookupApiPhoneFieldInput', cfg.phoneField || 'phone');
    setVal('lookupApiCodFieldInput', cfg.codField || 'cod');
    setVal('lookupApiDodFieldInput', cfg.dodField || 'dod');

    openModalHelper('lookupApiConfigModal');
}

export function storeLookupApiConfig(cfg) {
    const before = storedZtoTrashModeHere();
    if (!safeStoreSet(appLocalStore, 'zoew_lookup_api_config', JSON.stringify(cfg))) {
        alert("មិនអាចរក្សាទុក Config បានទេ! ទំហំផ្ទុករបស់ browser ពេញ ឬត្រូវបានបិទ (ឧ. Private Mode)។");
        return false;
    }
    clearCustomerDataTableCache();
    clearZtoPickupStatusStore();
    if (ztoTrashModeOf(cfg) !== before) withdrawZtoTrashMode(before);
    return true;
}

let lookupSaveGeneration = 0;

export async function saveLookupApiConfig() {
    const generation = ++lookupSaveGeneration;
    const shop = shopScope();
    const authEpoch = firebaseState.authGeneration;
    const key = securityState.lookupSecretKey;
    const current = () => generation === lookupSaveGeneration && shopScope() === shop
        && firebaseState.authGeneration === authEpoch && securityState.lookupSecretKey === key;
    let url = fieldValue('lookupApiUrlInput').trim();
    let enabled = fieldChecked('lookupApiEnabledCheckbox');

    if (enabled && (!url || !url.includes('{barcode}'))) {
        alert("URL ត្រូវតែមាន {barcode} ជាកន្លែងដាក់លេខបាកូដ! (ឧ. https://example.com/api?code={barcode})");
        return;
    }

    const snapshot = {
        autoSubmit: fieldChecked('lookupApiAutoSubmitCheckbox'), fastMode: fieldChecked('lookupApiFastModeCheckbox'),
        headerName: fieldValue('lookupApiHeaderNameInput').trim(),
        phoneField: fieldValue('lookupApiPhoneFieldInput').trim() || 'phone',
        codField: fieldValue('lookupApiCodFieldInput').trim() || 'cod',
        dodField: fieldValue('lookupApiDodFieldInput').trim() || 'dod'
    };
    const existingCfg = getLookupApiConfig() || {};
    const headerValueRaw = fieldValue('lookupApiHeaderValueInput').trim();
    if (lookupApiIsPalm({ url }) && (headerValueRaw || snapshot.headerName !== 'X-Zoe-Proxy-Key')) {
        alert('សូមប្រើ Login ZTO ដើម្បីប្តូរសោភ្ជាប់។');
        return;
    }
    let headerValueEnc = existingCfg.headerValueEnc || null;
    const appsScript = lookupApiIsAppsScript({ url });
    const typedKey = appsScript ? lookupUrlSplitKey(url) : { url, secret: '' };
    let urlKeyEnc = appsScript ? existingCfg.urlKeyEnc || null : null;
    if (typedKey.secret) {
        if (!securityState.lookupSecretKey) {
            alert("សម័យ PIN បានផុតកំណត់! សូមបិទ Config នេះ ហើយបើកម្តងទៀតដើម្បីបញ្ចូល PIN សាជាថ្មី មុននឹងផ្លាស់ប្តូរ Secret។");
            return;
        }
        urlKeyEnc = await encryptLookupSecret(typedKey.secret);
        if (!current()) return;
        if (!urlKeyEnc) {
            alert("មិនអាចអ៊ិនគ្រីប Secret បានទេ! សូមសាកល្បងម្តងទៀត។ ការផ្លាស់ប្តូរមិនទាន់ត្រូវបានរក្សាទុកទេ។");
            return;
        }
        url = typedKey.url;
    }

    if (headerValueRaw) {
        if (!securityState.lookupSecretKey) {
            alert("សម័យ PIN បានផុតកំណត់! សូមបិទ Config នេះ ហើយបើកម្តងទៀតដើម្បីបញ្ចូល PIN សាជាថ្មី មុននឹងផ្លាស់ប្តូរ Secret។");
            return;
        }
        const encryptedHeaderValue = await encryptLookupSecret(headerValueRaw);
        if (!current()) return;
        if (!encryptedHeaderValue) {
            alert("មិនអាចអ៊ិនគ្រីប Secret បានទេ! សូមសាកល្បងម្តងទៀត។ ការផ្លាស់ប្តូរមិនទាន់ត្រូវបានរក្សាទុកទេ។");
            return;
        }
        headerValueEnc = encryptedHeaderValue;
    }

    if (!current()) return;
    const cfg: any = Object.assign({}, snapshot, { enabled, url, headerValueEnc });
    if (urlKeyEnc) cfg.urlKeyEnc = urlKeyEnc;
    if (lookupApiIsPalm(cfg)) {
        if (!existingCfg.palmTokenEnc && !existingCfg.palmShared && !lookupApiIsPalm(existingCfg)) { alert('សូម Login ZTO ជាមុនសិន។'); return; }
        for (const name of PALM_CONFIG_FIELDS) if (existingCfg[name] !== undefined) cfg[name] = existingCfg[name];
    }
    if (shop) cfg.shop = shop;

    if (!storeLookupApiConfig(cfg)) return;
    setFieldValue('lookupApiHeaderValueInput', '');
    setFieldValue('lookupApiUrlInput', url);
    closeModal('lookupApiConfigModal');
    refreshShopBoundUi();
    prefetchCustomerDataTableRowsIfConfigured();
    showToast(enabled ? "✅ បានបើក API ស្វែងរកអតិថិជនស្វ័យប្រវត្តិ!" : "ℹ️ បានរក្សាទុក Config (មិនទាន់បើកដំណើរការ)!");
    if (cfg.headerName && lookupApiIsAppsScript(cfg)) {
        showToast("ℹ️ Google Apps Script អាន Header មិនបានទេ — សោត្រូវដាក់ក្នុង URL។ Header នេះនឹងមិនត្រូវផ្ញើ។");
    }
}

let lookupTestGeneration = 0;

export async function testLookupApiConfig(btnEl?) {
    const generation = ++lookupTestGeneration;
    viewState.lookupTestBusy = false;
    viewState.lookupTestResult = '';
    const shop = shopScope();
    const authEpoch = firebaseState.authGeneration;
    const key = securityState.lookupSecretKey;
    const current = () => generation === lookupTestGeneration && shopScope() === shop
        && firebaseState.authGeneration === authEpoch && securityState.lookupSecretKey === key;
    let url = fieldValue('lookupApiUrlInput').trim();
    if (!url || !url.includes('{barcode}')) {
        alert("សូមបញ្ចូល URL ដែលមាន {barcode} ជាមុនសិន!");
        return;
    }

    let testBarcode = prompt("បញ្ចូលលេខ Barcode សាកល្បង (សម្រាប់សាកល្បង API មុននឹងរក្សាទុក):", "");
    if (!testBarcode || !testBarcode.trim()) return;

    const existingCfg = getLookupApiConfig() || {};
    let testUrl = url.replace('{barcode}', encodeURIComponent(testBarcode.trim()));
    if (lookupApiIsAppsScript({ url }) && !lookupUrlSplitKey(url).secret) testUrl = await lookupKeyedUrl(existingCfg, testUrl);
    if (!current()) return;
    if (lookupApiIsPalm({ url })) {
        const palmTestUrl = new URL(testUrl, window.location.href);
        palmTestUrl.searchParams.set('track', '1');
        testUrl = palmTestUrl.href;
    }
    const headers = {};
    const hName = fieldValue('lookupApiHeaderNameInput').trim();
    const typedValue = fieldValue('lookupApiHeaderValueInput').trim();
    const hValue = typedValue || (existingCfg.headerValueEnc ? await decryptLookupSecret(existingCfg.headerValueEnc) : '');
    if (!current()) return;
    if (hValue && lookupApiSendsHeader({ url: url, headerName: hName })) headers[hName] = hValue;
    try { await addPalmSessionHeader({ ...existingCfg, url }, headers); }
    catch (_) { if (current()) alert('សូម Login ZTO ម្តងទៀត។'); return; }
    await addZtoIdentityHeader({ url: url }, headers);
    if (!current()) return;

    const testIsZto = lookupApiIsZto({ url: url });
    const testTimeoutMs = testIsZto ? ZTO_TEST_TIMEOUT_MS : LOOKUP_TEST_TIMEOUT_MS;
    showToast(testIsZto ? "⏳ កំពុងសាកល្បង ZTO..." : "⏳ កំពុងសាកល្បង API...");
    viewState.lookupTestBusy = true;
    const progressTimers = testIsZto ? [
        setTimeout(() => { if (current()) showToast("⏳ នៅរង់ចាំ ZTO ឆ្លើយតប...", 'warn'); }, 6000)
    ] : [];
    try {
        const out = await fetchWithTimeout(testUrl, { headers }, testTimeoutMs, 'Test API timed out', (r) => r.text());
        if (!current()) return;
        if (testIsZto) {
            let body = String(out.body);
            try { body = JSON.stringify(JSON.parse(body), null, 2); } catch (_) {}
            viewState.lookupTestResult = "ស្ថានភាព HTTP៖ " + out.res.status + "\n\n" + body;
        } else {
            alert("ស្ថានភាព HTTP៖ " + out.res.status + "\n\nលទ្ធផល JSON (ប្រើដើម្បីដឹងឈ្មោះ Field)៖\n" + String(out.body).substring(0, 1500));
        }
    } catch (e) {
        if (!current()) return;
        if (window.ZoeErrors) ZoeErrors.capture(e, { zone: 'lookup', context: 'testLookupApiConfig' });
        const timedOut = e && e.message === 'Test API timed out';
        const slowNote = testIsZto
            ? "អស់ពេល (Timeout) — មិនទាន់ទទួលបានចម្លើយពី ZTO។ សូមពិនិត្យបណ្ដាញ ហើយសាកល្បងម្ដងទៀត"
            : "អស់ពេល (Timeout) — Google Apps Script ដំបូងអាចយឺត (cold start), សូមសាកល្បងម្តងទៀត ឬពិនិត្យ URL/ការតភ្ជាប់អ៊ីនធឺណិត";
        alert("❌ បរាជ័យក្នុងការភ្ជាប់៖ " + (timedOut ? slowNote : e.message));
    } finally {
        progressTimers.forEach((timer) => clearTimeout(timer));
        if (generation === lookupTestGeneration) viewState.lookupTestBusy = false;
    }
}
