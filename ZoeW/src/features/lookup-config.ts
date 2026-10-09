import { fieldChecked, fieldValue, setFieldChecked, setFieldValue } from '../app/refs';
import { viewState } from '../core/view-state';
import { securityState } from '../core/state';
import { appLocalStore, safeStoreSet } from '../core/storage';
import { LOOKUP_TEST_TIMEOUT_MS, ZTO_TEST_TIMEOUT_MS } from './auto-lookup';
import { clearCustomerDataTableCache, prefetchCustomerDataTableRowsIfConfigured } from './customer-table';
import { lookupApiIsZto } from './customer-table-prefetch';
import { addZtoIdentityHeader, lookupApiIsAppsScript, lookupApiSendsHeader } from './lookup-api';
import { refreshZtoListSyncUi } from './zto-list-sync';
import { clearZtoPickupStatusStore, refreshZtoAutoCloseUi } from './zto-status';
import { decryptLookupSecret, encryptLookupSecret } from '../services/crypto';
import { fetchWithTimeout } from '../services/network';
import { closeModal, openModalHelper } from '../ui/modal';
import { showToast } from '../ui/toast';

export function getLookupApiConfig() {
    try {
        const raw = appLocalStore.getItem('zoew_lookup_api_config');
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
}

export async function migrateLookupSecretIfNeeded() {
    const cfg = getLookupApiConfig();
    if (!cfg || !cfg.headerValue || cfg.headerValueEnc || !securityState.lookupSecretKey) return false;
    const encrypted = await encryptLookupSecret(cfg.headerValue);
    if (!encrypted) return false;
    const migrated = Object.assign({}, cfg, { headerValueEnc: encrypted });
    delete migrated.headerValue;
    return safeStoreSet(appLocalStore, 'zoew_lookup_api_config', JSON.stringify(migrated));
}

export function openLookupApiConfigModal() {
    const cfg = getLookupApiConfig() || {};
    const setVal = (id, val) => { setFieldValue(id, val || ''); };

    setFieldChecked('lookupApiEnabledCheckbox', !!cfg.enabled);

    setFieldChecked('lookupApiAutoSubmitCheckbox', !!cfg.autoSubmit);

    setFieldChecked('lookupApiFastModeCheckbox', !!cfg.fastMode);

    setVal('lookupApiUrlInput', cfg.url);
    setVal('lookupApiHeaderNameInput', cfg.headerName);
    setFieldValue('lookupApiHeaderValueInput', '');
    viewState.lookupHeaderValuePlaceholder = (cfg.headerValueEnc || cfg.headerValue) ? '•••••••• (មានរួច — ទុកទទេប្រសិនបើមិនចង់ប្តូរ)' : 'ឧ. Bearer xxxxx ឬ Secret Key';
    setVal('lookupApiPhoneFieldInput', cfg.phoneField || 'phone');
    setVal('lookupApiCodFieldInput', cfg.codField || 'cod');
    setVal('lookupApiDodFieldInput', cfg.dodField || 'dod');

    openModalHelper('lookupApiConfigModal');
}

export async function saveLookupApiConfig() {
    let url = fieldValue('lookupApiUrlInput').trim();
    let enabled = fieldChecked('lookupApiEnabledCheckbox');

    if (enabled && (!url || !url.includes('{barcode}'))) {
        alert("URL ត្រូវតែមាន {barcode} ជាកន្លែងដាក់លេខបាកូដ! (ឧ. https://example.com/api?code={barcode})");
        return;
    }

    const existingCfg = getLookupApiConfig() || {};
    const headerValueRaw = fieldValue('lookupApiHeaderValueInput').trim();
    let headerValueEnc = existingCfg.headerValueEnc || null;
    let legacyHeaderValue = existingCfg.headerValue || '';

    if (headerValueRaw) {
        if (!securityState.lookupSecretKey) {
            alert("សម័យ PIN បានផុតកំណត់! សូមបិទ Config នេះ ហើយបើកម្តងទៀតដើម្បីបញ្ចូល PIN សាជាថ្មី មុននឹងផ្លាស់ប្តូរ Secret។");
            return;
        }
        const encryptedHeaderValue = await encryptLookupSecret(headerValueRaw);
        if (!encryptedHeaderValue) {
            alert("មិនអាចអ៊ិនគ្រីប Secret បានទេ! សូមសាកល្បងម្តងទៀត។ ការផ្លាស់ប្តូរមិនទាន់ត្រូវបានរក្សាទុកទេ។");
            return;
        }
        headerValueEnc = encryptedHeaderValue;
        legacyHeaderValue = '';
    } else if (!headerValueEnc && legacyHeaderValue && securityState.lookupSecretKey) {
        const migratedHeaderValue = await encryptLookupSecret(legacyHeaderValue);
        if (migratedHeaderValue) {
            headerValueEnc = migratedHeaderValue;
            legacyHeaderValue = '';
        }
    }

    const cfg: any = {
        enabled: enabled,
        autoSubmit: fieldChecked('lookupApiAutoSubmitCheckbox'),
        fastMode: fieldChecked('lookupApiFastModeCheckbox'),
        url: url,
        headerName: fieldValue('lookupApiHeaderNameInput').trim(),
        headerValueEnc: headerValueEnc,
        phoneField: fieldValue('lookupApiPhoneFieldInput').trim() || 'phone',
        codField: fieldValue('lookupApiCodFieldInput').trim() || 'cod',
        dodField: fieldValue('lookupApiDodFieldInput').trim() || 'dod'
    };
    if (legacyHeaderValue) cfg.headerValue = legacyHeaderValue;

    if (!safeStoreSet(appLocalStore, 'zoew_lookup_api_config', JSON.stringify(cfg))) {
        alert("មិនអាចរក្សាទុក Config បានទេ! ទំហំផ្ទុករបស់ browser ពេញ ឬត្រូវបានបិទ (ឧ. Private Mode)។");
        return;
    }
    clearCustomerDataTableCache();
    clearZtoPickupStatusStore();
    setFieldValue('lookupApiHeaderValueInput', '');
    closeModal('lookupApiConfigModal');
    refreshZtoAutoCloseUi();
    refreshZtoListSyncUi();
    prefetchCustomerDataTableRowsIfConfigured();
    showToast(enabled ? "✅ បានបើក API ស្វែងរកអតិថិជនស្វ័យប្រវត្តិ!" : "ℹ️ បានរក្សាទុក Config (មិនទាន់បើកដំណើរការ)!");
    if (cfg.headerName && lookupApiIsAppsScript(cfg)) {
        showToast("ℹ️ Google Apps Script អាន Header មិនបានទេ — សោត្រូវដាក់ក្នុង URL។ Header នេះនឹងមិនត្រូវផ្ញើ។");
    }
}

export async function testLookupApiConfig(btnEl?) {
    let url = fieldValue('lookupApiUrlInput').trim();
    if (!url || !url.includes('{barcode}')) {
        alert("សូមបញ្ចូល URL ដែលមាន {barcode} ជាមុនសិន!");
        return;
    }

    let testBarcode = prompt("បញ្ចូលលេខ Barcode សាកល្បង (សម្រាប់សាកល្បង API មុននឹងរក្សាទុក):", "");
    if (!testBarcode || !testBarcode.trim()) return;

    const testUrl = url.replace('{barcode}', encodeURIComponent(testBarcode.trim()));
    const headers = {};
    const hName = fieldValue('lookupApiHeaderNameInput').trim();
    const existingCfg = getLookupApiConfig() || {};
    const typedValue = fieldValue('lookupApiHeaderValueInput').trim();
    const hValue = typedValue || (existingCfg.headerValueEnc ? await decryptLookupSecret(existingCfg.headerValueEnc) : (existingCfg.headerValue || ''));
    if (hValue && lookupApiSendsHeader({ url: url, headerName: hName })) headers[hName] = hValue;
    await addZtoIdentityHeader({ url: url }, headers);

    const testIsZto = lookupApiIsZto({ url: url });
    const testTimeoutMs = testIsZto ? ZTO_TEST_TIMEOUT_MS : LOOKUP_TEST_TIMEOUT_MS;
    showToast(testIsZto ? "⏳ កំពុងសាកល្បង ZTO..." : "⏳ កំពុងសាកល្បង API...");
    viewState.lookupTestBusy = true;
    const progressTimers = testIsZto ? [
        setTimeout(() => showToast("⏳ នៅរង់ចាំ ZTO ឆ្លើយតប...", 'warn'), 6000)
    ] : [];
    try {
        const out = await fetchWithTimeout(testUrl, { headers }, testTimeoutMs, 'Test API timed out', (r) => r.text());
        alert("ស្ថានភាព HTTP៖ " + out.res.status + "\n\nលទ្ធផល JSON (ប្រើដើម្បីដឹងឈ្មោះ Field)៖\n" + String(out.body).substring(0, 1500));
    } catch (e) {
        if (window.ZoeErrors) ZoeErrors.capture(e, { zone: 'lookup', context: 'testLookupApiConfig' });
        const timedOut = e && e.message === 'Test API timed out';
        const slowNote = testIsZto
            ? "អស់ពេល (Timeout) — មិនទាន់ទទួលបានចម្លើយពី ZTO។ សូមពិនិត្យបណ្ដាញ ហើយសាកល្បងម្ដងទៀត"
            : "អស់ពេល (Timeout) — Google Apps Script ដំបូងអាចយឺត (cold start), សូមសាកល្បងម្តងទៀត ឬពិនិត្យ URL/ការតភ្ជាប់អ៊ីនធឺណិត";
        alert("❌ បរាជ័យក្នុងការភ្ជាប់៖ " + (timedOut ? slowNote : e.message));
    } finally {
        progressTimers.forEach((timer) => clearTimeout(timer));
        viewState.lookupTestBusy = false;
    }
}
