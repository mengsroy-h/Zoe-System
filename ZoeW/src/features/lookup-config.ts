import { byId } from '../core/dom';
import { securityState } from '../core/state';
import { appLocalStore, safeStoreSet } from '../core/storage';
import { LOOKUP_TEST_TIMEOUT_MS, ZTO_TEST_TIMEOUT_MS } from './auto-lookup';
import { clearCustomerDataTableCache, prefetchCustomerDataTableRowsIfConfigured } from './customer-table';
import { lookupApiIsZto } from './customer-table-prefetch';
import { lookupApiIsAppsScript, lookupApiSendsHeader } from './lookup-api';
import { refreshZtoListSyncUi } from './zto-list-sync';
import { refreshZtoAutoCloseUi } from './zto-status';
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
    const setVal = (id, val) => { const el = byId(id); if (el) el.value = val || ''; };

    const enabledCb = byId('lookupApiEnabledCheckbox');
    if (enabledCb) enabledCb.checked = !!cfg.enabled;

    const autoSubmitCb = byId('lookupApiAutoSubmitCheckbox');
    if (autoSubmitCb) autoSubmitCb.checked = !!cfg.autoSubmit;

    const fastModeCb = byId('lookupApiFastModeCheckbox');
    if (fastModeCb) fastModeCb.checked = !!cfg.fastMode;

    setVal('lookupApiUrlInput', cfg.url);
    setVal('lookupApiHeaderNameInput', cfg.headerName);
    const headerValueIn = byId('lookupApiHeaderValueInput');
    if (headerValueIn) {
        headerValueIn.value = '';
        headerValueIn.placeholder = (cfg.headerValueEnc || cfg.headerValue) ? '•••••••• (មានរួច — ទុកទទេប្រសិនបើមិនចង់ប្តូរ)' : 'ឧ. Bearer xxxxx ឬ Secret Key';
    }
    setVal('lookupApiPhoneFieldInput', cfg.phoneField || 'phone');
    setVal('lookupApiCodFieldInput', cfg.codField || 'cod');
    setVal('lookupApiDodFieldInput', cfg.dodField || 'dod');

    openModalHelper('lookupApiConfigModal');
}

export async function saveLookupApiConfig() {
    const enabledCb = byId('lookupApiEnabledCheckbox');
    const autoSubmitCb = byId('lookupApiAutoSubmitCheckbox');
    const fastModeCb = byId('lookupApiFastModeCheckbox');
    const urlIn = byId('lookupApiUrlInput');
    const headerNameIn = byId('lookupApiHeaderNameInput');
    const headerValueIn = byId('lookupApiHeaderValueInput');
    const phoneFieldIn = byId('lookupApiPhoneFieldInput');
    const codFieldIn = byId('lookupApiCodFieldInput');
    const dodFieldIn = byId('lookupApiDodFieldInput');

    let url = urlIn ? urlIn.value.trim() : '';
    let enabled = enabledCb ? enabledCb.checked : false;

    if (enabled && (!url || !url.includes('{barcode}'))) {
        alert("URL ត្រូវតែមាន {barcode} ជាកន្លែងដាក់លេខបាកូដ! (ឧ. https://example.com/api?code={barcode})");
        return;
    }

    const existingCfg = getLookupApiConfig() || {};
    const headerValueRaw = headerValueIn ? headerValueIn.value.trim() : '';
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
        autoSubmit: autoSubmitCb ? autoSubmitCb.checked : false,
        fastMode: fastModeCb ? fastModeCb.checked : false,
        url: url,
        headerName: headerNameIn ? headerNameIn.value.trim() : '',
        headerValueEnc: headerValueEnc,
        phoneField: (phoneFieldIn && phoneFieldIn.value.trim()) || 'phone',
        codField: (codFieldIn && codFieldIn.value.trim()) || 'cod',
        dodField: (dodFieldIn && dodFieldIn.value.trim()) || 'dod'
    };
    if (legacyHeaderValue) cfg.headerValue = legacyHeaderValue;

    if (!safeStoreSet(appLocalStore, 'zoew_lookup_api_config', JSON.stringify(cfg))) {
        alert("មិនអាចរក្សាទុក Config បានទេ! ទំហំផ្ទុករបស់ browser ពេញ ឬត្រូវបានបិទ (ឧ. Private Mode)។");
        return;
    }
    clearCustomerDataTableCache();
    if (headerValueIn) headerValueIn.value = '';
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
    const urlIn = byId('lookupApiUrlInput');
    const headerNameIn = byId('lookupApiHeaderNameInput');
    const headerValueIn = byId('lookupApiHeaderValueInput');

    let url = urlIn ? urlIn.value.trim() : '';
    if (!url || !url.includes('{barcode}')) {
        alert("សូមបញ្ចូល URL ដែលមាន {barcode} ជាមុនសិន!");
        return;
    }

    let testBarcode = prompt("បញ្ចូលលេខ Barcode សាកល្បង (សម្រាប់សាកល្បង API មុននឹងរក្សាទុក):", "");
    if (!testBarcode || !testBarcode.trim()) return;

    const testUrl = url.replace('{barcode}', encodeURIComponent(testBarcode.trim()));
    const headers = {};
    const hName = headerNameIn ? headerNameIn.value.trim() : '';
    const existingCfg = getLookupApiConfig() || {};
    const typedValue = headerValueIn ? headerValueIn.value.trim() : '';
    const hValue = typedValue || (existingCfg.headerValueEnc ? await decryptLookupSecret(existingCfg.headerValueEnc) : (existingCfg.headerValue || ''));
    if (hValue && lookupApiSendsHeader({ url: url, headerName: hName })) headers[hName] = hValue;

    const testIsZto = lookupApiIsZto({ url: url });
    const testTimeoutMs = testIsZto ? ZTO_TEST_TIMEOUT_MS : LOOKUP_TEST_TIMEOUT_MS;
    showToast(testIsZto ? "⏳ កំពុងសាកល្បង ZTO..." : "⏳ កំពុងសាកល្បង API...");
    if (btnEl) btnEl.disabled = true;
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
        if (btnEl) btnEl.disabled = false;
    }
}
