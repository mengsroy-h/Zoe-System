import { byId } from '../core/dom';
import { lookupState } from '../core/state';
import { elapsedSince } from '../core/elapsed';
import { getFormattedClockTime } from '../core/timezone';
import { sanitizeInput } from '../domain/barcode';
import { autoLookupFailureAt, autoLookupInFlight, clearAutoLookupQueueRetries, lookupFastCache } from './auto-lookup';
import { CUSTOMER_TABLE_CACHE_MS, CUSTOMER_TABLE_FAIL_COOLDOWN_MS, clearCustomerTableRetry, clearCustomerTableSoonRefresh, customerTablePrefetchAllowed, scheduleCustomerTableRetry, scheduleCustomerTableSoonRefresh, warmZtoLookupProxyIfConfigured } from './customer-table-prefetch';
import { buildCustomerListApiUrl, clearZtoWarmSoon, lookupApiSendsHeader, lookupApiSupportsList, scheduleZtoWarmSoon } from './lookup-api';
import { getLookupApiConfig } from './lookup-config';
import { sheetImportCellToText, sheetImportToMoney } from './sheet-import';
import { decryptLookupSecret } from '../services/crypto';
import { fetchWithTimeout, preconnectToLookupHost, retryAsync, retryTransientLookupResponse } from '../services/network';

export async function fetchCustomerDataTableRows(force?, wantFresh?) {
    const cfg = getLookupApiConfig();
    const statusEl = byId('customerDataTableStatus');
    if (!lookupApiSupportsList(cfg)) return;

    const isFresh = lookupState.customerDataTableRows && (elapsedSince(lookupState.customerDataTableFetchedAt) < CUSTOMER_TABLE_CACHE_MS);
    if (!force && isFresh) {
        renderCustomerDataTableStatus(lookupState.customerDataTableRows);
        filterCustomerDataTable();
        return;
    }

    if (lookupState.customerDataTableFetchPromise) {
        if (statusEl) statusEl.textContent = "កំពុងទាញយកទិន្នន័យ...";
        return lookupState.customerDataTableFetchPromise;
    }

    if (!force && elapsedSince(lookupState.customerDataTableLastFailedAt) < CUSTOMER_TABLE_FAIL_COOLDOWN_MS) {
        return;
    }

    const listUrl = buildCustomerListApiUrl(cfg, wantFresh);
    if (!listUrl) return;

    if (statusEl) statusEl.textContent = "កំពុងទាញយកទិន្នន័យ...";

    const myGeneration = lookupState.customerDataTableSessionGeneration;
    lookupState.customerDataTableFetchPromise = (async () => {
        try {
            const headers = {};
            if (lookupApiSendsHeader(cfg)) {
                if (cfg.headerValueEnc) {
                    const decrypted = await decryptLookupSecret(cfg.headerValueEnc);
                    if (decrypted) headers[cfg.headerName] = decrypted;
                } else if (cfg.headerValue) {
                    headers[cfg.headerName] = cfg.headerValue;
                }
            }
            const out = await retryAsync(
                () => fetchWithTimeout(listUrl, { headers }, 20000, 'Customer table fetch timed out',
                    (r) => (r.ok ? r.json() : null)).then(retryTransientLookupResponse),
                2, 2000
            );
            if (!out.res.ok) throw new Error('HTTP ' + out.res.status);
            const data = out.body;
            if (data && data.error) throw new Error(data.error);
            if (myGeneration !== lookupState.customerDataTableSessionGeneration) return;
            const rows = Array.isArray(data && data.rows) ? data.rows : [];
            lookupState.customerDataTableRows = rows;
            lookupState.customerDataTableFetchedAt = Date.now();
            lookupState.customerDataTableLastFailedAt = 0;
            lookupState.customerTableIsPartial = false;
            clearCustomerTableRetry();
            clearCustomerTableSoonRefresh();
            renderCustomerDataTableStatus(rows);
            filterCustomerDataTable();
        } catch (e) {
            if (myGeneration !== lookupState.customerDataTableSessionGeneration) return;
            lookupState.customerDataTableLastFailedAt = Date.now();
            scheduleCustomerTableRetry();
            if (window.ZoeErrors) ZoeErrors.capture(e, { zone: 'lookup', context: 'fetchCustomerDataTableRows' });
            const curStatusEl = byId('customerDataTableStatus');
            if (curStatusEl) curStatusEl.textContent = "❌ ទាញយកទិន្នន័យបរាជ័យ៖ " + (e && e.message === 'Customer table fetch timed out' ? "អស់ពេល (Timeout)" : (e && e.message ? e.message : ''));
            if (lookupState.customerDataTableRows) filterCustomerDataTable();
        } finally {
            if (myGeneration === lookupState.customerDataTableSessionGeneration) lookupState.customerDataTableFetchPromise = null;
        }
    })();

    return lookupState.customerDataTableFetchPromise;
}

export function renderCustomerDataTableStatus(rows) {
    const statusEl = byId('customerDataTableStatus');
    if (!statusEl) return;
    const ts = lookupState.customerDataTableFetchedAt ? getFormattedClockTime(lookupState.customerDataTableFetchedAt) : '';
    statusEl.textContent = rows.length + ' ជួរដេក' + (ts ? (' — ទាញយកចុងក្រោយ ' + ts) : '');
}

export function filterCustomerDataTable() {
    const body = byId('customerDataTableBody');
    if (!body) return;
    const rows = lookupState.customerDataTableRows || [];
    const searchInput = byId('customerDataTableSearchInput');
    const q = (searchInput ? searchInput.value.trim().toLowerCase() : '');

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
    lookupState.customerDataTableRows = null;
    lookupState.customerDataTableFetchedAt = 0;
    lookupState.customerDataTableFetchPromise = null;
    lookupState.customerDataTableLastFailedAt = 0;
    autoLookupFailureAt.clear();
    autoLookupInFlight.clear();
    clearAutoLookupQueueRetries();
    lookupFastCache.clear();
    lookupState.customerTableView = null;
    const statusEl = byId('customerDataTableStatus');
    if (statusEl) statusEl.textContent = '';
}

export function findCustomerDataTableRow(barcode) {
    if (!lookupState.customerDataTableRows || !barcode) return null;
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
        const record = {
            barcode: barcode,
            dod: sheetImportToMoney(row[1]),
            cod: sheetImportToMoney(row[2]),
            phone: sheetImportCellToText(row[3])
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

export function seedCustomerTableFromImport(rows, mode, rowsAfter) {
    const records = normalizeImportedCustomerRows(rows);
    if (!records.length) return false;
    const base = (mode === 'replace' || !Array.isArray(lookupState.customerDataTableRows)) ? [] : lookupState.customerDataTableRows;
    const merged = [];
    const index = Object.create(null);
    for (let i = 0; i < base.length; i++) {
        const row = base[i];
        const key = String((row && row.barcode) || '').trim().toUpperCase();
        if (!key || index[key] !== undefined) continue;
        index[key] = merged.length;
        merged.push({ barcode: row.barcode, dod: Number(row.dod) || 0, cod: Number(row.cod) || 0, phone: row.phone || '' });
    }
    for (let j = 0; j < records.length; j++) {
        const record = records[j];
        const key = record.barcode.toUpperCase();
        if (index[key] !== undefined) {
            if (mode !== 'newOnly') merged[index[key]] = record;
        } else {
            index[key] = merged.length;
            merged.push(record);
        }
    }
    lookupState.customerDataTableSessionGeneration++;
    lookupState.customerDataTableFetchPromise = null;
    lookupState.customerDataTableRows = merged;
    lookupState.customerDataTableFetchedAt = Date.now();
    lookupState.customerDataTableLastFailedAt = 0;
    autoLookupFailureAt.clear();
    lookupState.customerTableIsPartial = merged.length !== Number(rowsAfter);
    clearCustomerTableRetry();
    renderCustomerDataTableStatus(merged);
    filterCustomerDataTable();
    return true;
}

export function rememberCustomerTableRow(barcode, phone, cod, dod) {
    if (!Array.isArray(lookupState.customerDataTableRows)) return;
    const key = String(barcode || '').trim().toUpperCase();
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
