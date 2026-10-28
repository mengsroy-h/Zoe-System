import { fieldValue } from '../app/refs';
import { viewState } from '../core/view-state';
import { lookupState } from '../core/state';
import { elapsedSince } from '../core/elapsed';
import { getFormattedClockTime } from '../core/timezone';
import { autoLookupFailureAt, autoLookupInFlight, clearAutoLookupQueueRetries, lookupFastCache } from './auto-lookup';
import { CUSTOMER_TABLE_CACHE_MS, CUSTOMER_TABLE_FAIL_COOLDOWN_MS, CUSTOMER_TABLE_TICK_SLACK_MS, CUSTOMER_TABLE_TRUST_MS, clearCustomerTableRetry, clearCustomerTableSoonRefresh, customerTablePrefetchAllowed, scheduleCustomerTableRetry, scheduleCustomerTableSoonRefresh, warmZtoLookupProxyIfConfigured } from './customer-table-prefetch';
import { buildCustomerListApiUrl, clearZtoWarmSoon, lookupApiSendsHeader, lookupApiSupportsList, scheduleZtoWarmSoon } from './lookup-api';
import { getLookupApiConfig, lookupKeyedUrl, lookupSecretLocked } from './lookup-config';
import { sheetImportCellToText, sheetImportToMoney } from './sheet-import';
import { decryptLookupSecret } from '../services/crypto';
import { fetchWithTimeout, preconnectToLookupHost, retryAsync, retryTransientLookupResponse } from '../services/network';

export const lookupsSupersededByImport = new Map();

export async function fetchCustomerDataTableRows(force?, wantFresh?) {
    const cfg = getLookupApiConfig();
    if (!lookupApiSupportsList(cfg)) return;
    if (lookupSecretLocked(cfg)) {
        viewState.customerTableStatus = "🔒 សូមវាយ PIN ម្តង ដើម្បីដោះសោការទាញតារាងអតិថិជន";
        return;
    }

    const isFresh = lookupState.customerDataTableRows && (elapsedSince(lookupState.customerDataTableFetchedAt) < CUSTOMER_TABLE_CACHE_MS - CUSTOMER_TABLE_TICK_SLACK_MS);
    if (!force && isFresh) {
        renderCustomerDataTableStatus(lookupState.customerDataTableRows);
        filterCustomerDataTable();
        return;
    }

    if (lookupState.customerDataTableFetchPromise) {
        viewState.customerTableStatus = "កំពុងទាញយកទិន្នន័យ...";
        return lookupState.customerDataTableFetchPromise;
    }

    if (!force && elapsedSince(lookupState.customerDataTableLastFailedAt) < CUSTOMER_TABLE_FAIL_COOLDOWN_MS) {
        return;
    }

    const listUrl = buildCustomerListApiUrl(cfg, wantFresh);
    if (!listUrl) return;

    viewState.customerTableStatus = "កំពុងទាញយកទិន្នន័យ...";

    const myGeneration = lookupState.customerDataTableFetchGeneration;
    const startedAt = Date.now();
    lookupState.customerDataTableFetchPromise = (async () => {
        try {
            const headers = {};
            if (lookupApiSendsHeader(cfg) && cfg.headerValueEnc) {
                const decrypted = await decryptLookupSecret(cfg.headerValueEnc);
                if (decrypted) headers[cfg.headerName] = decrypted;
            }
            const keyedUrl = cfg.urlKeyEnc ? await lookupKeyedUrl(cfg, listUrl) : listUrl;
            const out = await retryAsync(
                () => fetchWithTimeout(keyedUrl, { headers }, 20000, 'Customer table fetch timed out',
                    (r) => (r.ok ? r.json() : null)).then(retryTransientLookupResponse),
                2, 2000
            );
            if (!out.res.ok) throw new Error('HTTP ' + out.res.status);
            const data = out.body;
            if (data && data.error) throw new Error(data.error);
            if (myGeneration !== lookupState.customerDataTableFetchGeneration) return;
            const rows = Array.isArray(data && data.rows) ? data.rows : [];
            lookupState.customerDataTableRows = rows;
            lookupState.customerDataTableFetchedAt = startedAt;
            lookupState.customerDataTableLastFailedAt = 0;
            lookupState.customerTableIsPartial = false;
            clearCustomerTableRetry();
            clearCustomerTableSoonRefresh();
            renderCustomerDataTableStatus(rows);
            filterCustomerDataTable();
        } catch (e) {
            if (myGeneration !== lookupState.customerDataTableFetchGeneration) return;
            lookupState.customerDataTableLastFailedAt = Date.now();
            scheduleCustomerTableRetry();
            if (window.ZoeErrors) ZoeErrors.capture(e, { zone: 'lookup', context: 'fetchCustomerDataTableRows' });
            viewState.customerTableStatus = "❌ ទាញយកទិន្នន័យបរាជ័យ៖ " + (e && e.message === 'Customer table fetch timed out' ? "អស់ពេល (Timeout)" : (e && e.message ? e.message : ''));
            if (lookupState.customerDataTableRows) filterCustomerDataTable();
        } finally {
            if (myGeneration === lookupState.customerDataTableFetchGeneration) lookupState.customerDataTableFetchPromise = null;
        }
    })();

    return lookupState.customerDataTableFetchPromise;
}

export function renderCustomerDataTableStatus(rows) {
    const ts = lookupState.customerDataTableFetchedAt ? getFormattedClockTime(lookupState.customerDataTableFetchedAt) : '';
    viewState.customerTableStatus = rows.length + ' ជួរដេក' + (ts ? (' — ទាញយកចុងក្រោយ ' + ts) : '');
}

export function filterCustomerDataTable() {
    const rows = lookupState.customerDataTableRows || [];
    const q = fieldValue('customerDataTableSearchInput').trim().toLowerCase();

    const filtered = q ? rows.filter((r) =>
        String(r.barcode || '').toLowerCase().indexOf(q) !== -1 ||
        String(r.phone || '').toLowerCase().indexOf(q) !== -1 ||
        String(r.cod || '').indexOf(q) !== -1 ||
        String(r.dod || '').indexOf(q) !== -1
    ) : rows;

    if (filtered.length === 0) {
        lookupState.customerTableView = { empty: rows.length === 0 ? 'មិនទាន់មានទិន្នន័យ' : 'រកមិនឃើញ', rows: [], overflow: 0 };
        lookupState.touch();
        return;
    }

    const maxRender = 500;
    lookupState.customerTableView = {
        empty: null,
        rows: filtered.slice(0, maxRender).map((r) => ({
            barcode: String(r.barcode == null ? '' : r.barcode),
            dod: Number(r.dod || 0).toFixed(2),
            cod: Number(r.cod || 0).toFixed(2),
            phone: String(r.phone == null ? '' : r.phone)
        })),
        overflow: Math.max(0, filtered.length - maxRender)
    };
    lookupState.touch();
}

export function clearCustomerDataTableCache() {
    lookupState.sheetScriptVersionSeen = null;
    clearCustomerTableRetry();
    clearCustomerTableSoonRefresh();
    clearZtoWarmSoon();
    lookupState.customerTableIsPartial = false;
    lookupState.customerDataTableSessionGeneration++;
    lookupState.customerDataTableFetchGeneration++;
    lookupState.customerDataTableRows = null;
    lookupState.customerDataTableFetchedAt = 0;
    lookupState.customerDataTableFetchPromise = null;
    lookupState.customerDataTableLastFailedAt = 0;
    autoLookupFailureAt.clear();
    autoLookupInFlight.clear();
    lookupsSupersededByImport.clear();
    clearAutoLookupQueueRetries();
    lookupFastCache.clear();
    lookupState.customerTableView = null;
    viewState.customerTableStatus = '';
}

export function customerTableIsTrusted() {
    if (!lookupState.customerDataTableRows) return false;
    if ((navigator.onLine as boolean) === false) return true;
    return elapsedSince(lookupState.customerDataTableFetchedAt) < CUSTOMER_TABLE_TRUST_MS;
}

export function findCustomerDataTableRow(barcode) {
    if (!lookupState.customerDataTableRows || !barcode) return null;
    if (!customerTableIsTrusted()) return null;
    const target = String(barcode).trim().toUpperCase();
    for (let i = 0; i < lookupState.customerDataTableRows.length; i++) {
        const r = lookupState.customerDataTableRows[i];
        if (String(r.barcode || '').trim().toUpperCase() === target) return r;
    }
    return null;
}

export function normalizeImportedCustomerRows(rows) {
    const out = [];
    const seen = Object.create(null);
    const list = Array.isArray(rows) ? rows : [];
    for (let i = 0; i < list.length; i++) {
        const row = list[i] || [];
        const barcode = sheetImportCellToText(row[0]);
        if (!barcode) continue;
        const phone = sheetImportCellToText(row[3]);
        const record = {
            barcode: barcode,
            dod: sheetImportToMoney(row[1]),
            cod: sheetImportToMoney(row[2]),
            phone: /\d/.test(phone) ? phone : ''
        };
        const key = barcode.toUpperCase();
        if (seen[key] !== undefined) out[seen[key]] = record;
        else {
            seen[key] = out.length;
            out.push(record);
        }
    }
    return out;
}

export function seedCustomerTableFromImport(rows, mode, rowsAfter, proof?) {
    const records = normalizeImportedCustomerRows(rows);
    if (!lookupApiSupportsList(getLookupApiConfig())) return true;
    if (mode === 'replace') lookupFastCache.clear();
    else records.forEach((record) => lookupFastCache.delete(record.barcode.toUpperCase()));
    const importedKeys = new Set(records.map((record) => record.barcode.toUpperCase()));
    lookupsSupersededByImport.forEach((run, key) => { if (autoLookupInFlight.get(key) !== run) lookupsSupersededByImport.delete(key); });
    autoLookupInFlight.forEach((run, key) => { if (mode === 'replace' || importedKeys.has(key)) lookupsSupersededByImport.set(key, run); });
    if (!records.length) return false;
    const keep = proof && proof.keep ? proof.keep : null;
    const writerAdded = proof && Number.isFinite(proof.added) ? proof.added : null;
    const hadTable = mode !== 'replace' && Array.isArray(lookupState.customerDataTableRows);
    const base = hadTable ? lookupState.customerDataTableRows : [];
    const baseComplete = hadTable && !lookupState.customerTableIsPartial;
    const merged = [];
    const index = Object.create(null);
    for (let i = 0; i < base.length; i++) {
        const row = base[i];
        const key = String((row && row.barcode) || '').trim().toUpperCase();
        if (!key || index[key] !== undefined) continue;
        index[key] = merged.length;
        merged.push({ barcode: row.barcode, dod: Number(row.dod) || 0, cod: Number(row.cod) || 0, phone: row.phone || '' });
    }
    const added = Object.create(null);
    let addedCount = 0;
    for (let j = 0; j < records.length; j++) {
        const record = records[j];
        const key = record.barcode.toUpperCase();
        if (index[key] !== undefined) {
            if (mode === 'newOnly') continue;
            const current = merged[index[key]];
            merged[index[key]] = keep ? {
                barcode: current.barcode,
                dod: keep.dod ? current.dod : record.dod,
                cod: keep.cod ? current.cod : record.cod,
                phone: keep.phone ? current.phone : record.phone
            } : record;
        } else {
            index[key] = merged.length;
            merged.push(record);
            added[key] = true;
            addedCount++;
        }
    }
    let table = merged;
    const countsAgree = merged.length === Number(rowsAfter) && (writerAdded === null || writerAdded === addedCount);
    let partial = !countsAgree;
    if ((mode === 'newOnly' || keep) && !(baseComplete && countsAgree && writerAdded !== null)) {
        table = merged.filter((row) => !added[String(row.barcode).toUpperCase()]);
        partial = true;
    }
    lookupState.customerDataTableFetchGeneration++;
    lookupState.customerDataTableFetchPromise = null;
    lookupState.customerDataTableRows = table;
    if (!hadTable) lookupState.customerDataTableFetchedAt = Date.now();
    lookupState.customerDataTableLastFailedAt = 0;
    autoLookupFailureAt.clear();
    lookupState.customerTableIsPartial = partial;
    clearCustomerTableRetry();
    renderCustomerDataTableStatus(table);
    filterCustomerDataTable();
    return true;
}

export function rememberCustomerTableRow(barcode, phone, cod, dod) {
    const key = String(barcode || '').trim().toUpperCase();
    const supersededRun = lookupsSupersededByImport.get(key);
    if (supersededRun !== undefined) {
        lookupsSupersededByImport.delete(key);
        if (autoLookupInFlight.get(key) === supersededRun) {
            lookupFastCache.delete(key);
            return;
        }
    }
    if (!Array.isArray(lookupState.customerDataTableRows)) return;
    if (!key) return;
    const hasPhone = phone !== null && phone !== undefined && String(phone) !== '';
    const hasCod = cod !== null && cod !== undefined && !isNaN(parseFloat(cod));
    const hasDod = dod !== null && dod !== undefined && !isNaN(parseFloat(dod));
    if (!hasPhone && !hasCod && !hasDod) return;
    const row = {
        barcode: String(barcode),
        dod: hasDod ? parseFloat(dod) : 0,
        cod: hasCod ? parseFloat(cod) : 0,
        phone: hasPhone ? String(phone) : ''
    };
    for (let i = 0; i < lookupState.customerDataTableRows.length; i++) {
        const current = lookupState.customerDataTableRows[i];
        if (String((current && current.barcode) || '').trim().toUpperCase() === key) {
            lookupState.customerDataTableRows[i] = row;
            return;
        }
    }
    lookupState.customerDataTableRows.push(row);
}

export function prefetchCustomerDataTableRowsIfConfigured() {
    const cfg = getLookupApiConfig();
    if (!cfg || !cfg.enabled || !cfg.url) {
        clearCustomerTableRetry();
        clearCustomerTableSoonRefresh();
        return;
    }
    preconnectToLookupHost();
    if (!lookupApiSupportsList(cfg)) {
        clearCustomerTableRetry();
        clearCustomerTableSoonRefresh();
        if (customerTablePrefetchAllowed()) {
            clearZtoWarmSoon();
            warmZtoLookupProxyIfConfigured(cfg);
        } else {
            scheduleZtoWarmSoon();
        }
        return;
    }
    if (!customerTablePrefetchAllowed()) {
        scheduleCustomerTableSoonRefresh();
        return;
    }
    fetchCustomerDataTableRows(false);
}

export function getNestedField(obj, path) {
    if (!obj || !path) return null;
    return path.split('.').reduce((acc, key) => (acc !== null && acc !== undefined && acc[key] !== undefined) ? acc[key] : null, obj);
}
