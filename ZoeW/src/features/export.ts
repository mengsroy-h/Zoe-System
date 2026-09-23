import { renderNow } from '../app/flush';
import { byId } from '../core/dom';
import { dataState, uiState } from '../core/state';
import { PICKUP_DATE_KEY_PATTERN, getServerNow } from '../core/clock';
import { DB_LISTENER_KEY_DAILY_REVENUE, DB_LISTENER_KEY_DELETED, DB_LISTENER_KEY_HISTORY, STATS_DAILY_VIEW_KEYS, VIEW_NOT_MEASURABLE_TEXT } from '../core/text';
import { getFormattedClockTime, getFormattedDate, getZoneDateKey } from '../core/timezone';
import { sanitizeInput } from '../domain/barcode';
import { noteAppLockExcuse } from './app-lock';
import { MONTHLY_REPORT_UNKNOWN, monthlyReportRiel, statsMoney } from './monthly-report';
import { dbListenerViewIsStale, emptyViewMessage } from '../services/db-listeners';
import { closeModal, openModalHelper } from '../ui/modal';
import { getFilteredDataByDate } from '../ui/more-menu';
import { showToast } from '../ui/toast';

export const EXPORT_LIBS = {
    xlsx: { url: './vendor/xlsx.full.min.js' }
};

export const loadedScriptPromises = {};

export function exportFailureMessage(e) {
    if (e && e.code === 'SCRIPT_LOAD_TIMEOUT') {
        return "❌ Export Excel បរាជ័យ! ផ្ទុកឯកសារ Excel យូរពេក (បណ្តាញឆ្លើយមិនចេញ) — សូមសាកម្តងទៀត";
    }
    if (e && e.code === 'SCRIPT_LOAD_FAILED') {
        return (navigator.onLine as boolean) === false
            ? "❌ Export Excel បរាជ័យ! ឧបករណ៍ក្រៅបណ្ដាញ ហើយឯកសារ Excel មិនទាន់ចូល cache ទេ"
            : "❌ Export Excel បរាជ័យ! ផ្ទុកឯកសារ Excel មិនបានទេ — សូម Refresh ទំព័រម្តង";
    }
    const detail = e && e.message ? e.message : String(e);
    return "❌ Export Excel បរាជ័យ! " + detail;
}

export function loadScriptOnce(key) {
    if (loadedScriptPromises[key]) return loadedScriptPromises[key];
    const lib = EXPORT_LIBS[key];
    const SCRIPT_LOAD_TIMEOUT_MS = 25000;
    const pending = new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        let settled = false;
        let timer = null;
        const stop = () => {
            if (timer === null) return;
            clearTimeout(timer);
            timer = null;
        };
        const failWith = (code, message) => {
            if (settled) return;
            settled = true;
            stop();
            if (loadedScriptPromises[key] === pending) delete loadedScriptPromises[key];
            const err: any = new Error(message);
            err.code = code;
            reject(err);
        };
        script.src = lib.url;
        if (lib.integrity) {
            script.integrity = lib.integrity;
            script.crossOrigin = 'anonymous';
        }
        script.onload = () => {
            if (settled) return;
            settled = true;
            stop();
            resolve();
        };
        script.onerror = () => failWith('SCRIPT_LOAD_FAILED', 'Failed to load ' + lib.url);
        timer = setTimeout(() => failWith('SCRIPT_LOAD_TIMEOUT', 'Script load timed out: ' + lib.url), SCRIPT_LOAD_TIMEOUT_MS);
        document.head.appendChild(script);
    });
    loadedScriptPromises[key] = pending;
    return pending;
}

export function getFilterTargetDateKey() {
    const now = getServerNow();
    if (uiState.currentFilterMode === 'today') return getZoneDateKey(now, 0);
    if (uiState.currentFilterMode === 'yesterday') return getZoneDateKey(now, -1);
    if (uiState.currentFilterMode === 'dayBefore') return getZoneDateKey(now, -2);
    if (uiState.currentFilterMode === 'custom') return uiState.customFilterDate;
    return "";
}

export function getPickupResetTargetDates() {
    if (uiState.currentFilterMode === 'all') {
        return Object.keys(dataState.dailyPickupData).filter((d) => PICKUP_DATE_KEY_PATTERN.test(d)).sort();
    }
    const key = getFilterTargetDateKey();
    return PICKUP_DATE_KEY_PATTERN.test(key) ? [key] : [];
}

export function getCurrentFilterLabel() {
    if (uiState.currentFilterMode === 'yesterday') return "ម្សិលមិញ";
    if (uiState.currentFilterMode === 'dayBefore') return "ម្សិលម្ងៃ";
    if (uiState.currentFilterMode === 'custom') return uiState.customFilterDate || "ថ្ងៃផ្សេង";
    if (uiState.currentFilterMode === 'all') return "ទាំងអស់";
    return "ថ្ងៃនេះ";
}

export function getExportFilenameBase() {
    const label = (uiState.currentFilterMode === 'custom' ? uiState.customFilterDate : uiState.currentFilterMode) || 'data';
    return `ZoeW_${label}_${getFormattedDate()}`.replace(/[^a-zA-Z0-9_\-]/g, '');
}

export function buildExportRows() {
    const filteredData = getFilteredDataByDate();
    const rows = [];
    let rowNum = 0;
    filteredData.forEach(item => {
        const barcodes = (item.barcodes && Array.isArray(item.barcodes) && item.barcodes.length)
            ? item.barcodes
            : [{ code: item.barcode, cod: item.cod, dod: item.dod, locker: item.locker, isClosed: item.isClosed, time: item.time }];
        barcodes.forEach(b => {
            rowNum++;
            const cod = parseFloat(b.cod) || 0;
            const dod = parseFloat(b.dod) || 0;
            rows.push({
                no: rowNum,
                phone: item.phone === "គ្មានលេខ" ? "" : String(item.phone || ''),
                barcode: String(b.code || ''),
                locker: b.locker || 'N/A',
                cod: cod,
                dod: dod,
                total: Math.round((cod + dod) * 100) / 100,
                status: b.isClosed ? 'យកហើយ' : 'នៅសល់',
                scanDate: item.scanDate || '',
                time: b.time || item.time || ''
            });
        });
    });
    return rows;
}

export const EXPORT_HEADERS = ['ល.រ', 'លេខទូរស័ព្ទ', 'Barcode', 'ទីតាំង Locker', 'COD ($)', 'DOD ($)', 'សរុប ($)', 'ស្ថានភាព', 'ថ្ងៃស្កេន', 'ម៉ោង'];

export const EXPORT_TEXT_COLUMN_INDEXES = [1, 2];

export function forceSheetTextCells(ws, rowCount, columnIndexes) {
    const cols = Array.isArray(columnIndexes) ? columnIndexes : [];
    const cellCount = ws && typeof ws === 'object' ? Object.keys(ws).length : 0;
    const rows = Math.min(Math.floor(rowCount), cellCount);
    if (!cols.length || !Number.isFinite(rows) || rows < 1) return;
    for (let r = 1; r <= rows; r++) {
        cols.forEach(c => {
            const cell = ws[XLSX.utils.encode_cell({ r: r, c: c })];
            if (!cell) return;
            cell.t = 's';
            cell.v = String(cell.v === undefined || cell.v === null ? '' : cell.v);
            cell.z = '@';
            delete cell.w;
            delete cell.f;
        });
    }
}

export function forceExportTextCells(ws, rowCount) {
    forceSheetTextCells(ws, rowCount, EXPORT_TEXT_COLUMN_INDEXES);
}

export function openExportDataModal() {
    const lbl = byId('exportFilterLabel');
    if (lbl) lbl.innerText = getCurrentFilterLabel();
    openModalHelper('exportDataModal');
}

export async function exportDataAsExcel() {
    const rows = buildExportRows();
    if (!rows.length) { showToast(emptyViewMessage(STATS_DAILY_VIEW_KEYS, "⚠️ គ្មានទិន្នន័យសម្រាប់ Export ទេ!")); return; }
    closeModal('exportDataModal');
    showToast("⏳ កំពុងរៀបចំ Excel...");
    try {
        await loadScriptOnce('xlsx');
        const aoa = [EXPORT_HEADERS, ...rows.map(r => [r.no, r.phone, r.barcode, r.locker, r.cod, r.dod, r.total, r.status, r.scanDate, r.time])];
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        forceExportTextCells(ws, rows.length);
        ws['!cols'] = [{ wch: 6 }, { wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 10 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'ប្រវត្តិ');
        XLSX.writeFile(wb, getExportFilenameBase() + '.xlsx', { bookSST: true });
        showToast("✅ បាន Export ជា Excel ជោគជ័យ!");
    } catch (e) {
        console.error("Excel export failed:", e);
        if (window.ZoeErrors) ZoeErrors.capture(e, { context: "Excel export failed:" });
        showToast(exportFailureMessage(e));
    }
}

export function restoreAfterPdfExport() {
    if (uiState.pdfExportOriginalTitle !== null) {
        document.title = uiState.pdfExportOriginalTitle;
        uiState.pdfExportOriginalTitle = null;
    }
    uiState.pdfExportView = null;
    uiState.touch();
}

export function exportDataAsPDF() {
    const rows = buildExportRows();
    if (!rows.length) { showToast(emptyViewMessage(STATS_DAILY_VIEW_KEYS, "⚠️ គ្មានទិន្នន័យសម្រាប់ Export ទេ!")); return; }
    closeModal('exportDataModal');

    const printArea = byId('pdfExportPrintArea');
    if (!printArea) { showToast("❌ Export PDF បរាជ័យ!"); return; }

    const totalCod = Math.round(rows.reduce((sum, r) => sum + r.cod, 0) * 100) / 100;
    const totalDod = Math.round(rows.reduce((sum, r) => sum + r.dod, 0) * 100) / 100;
    const totalAll = Math.round((totalCod + totalDod) * 100) / 100;

    uiState.pdfExportView = {
        title: 'ZoeW — របាយការណ៍ប្រវត្តិកញ្ចប់ (' + getCurrentFilterLabel() + ')',
        headers: EXPORT_HEADERS,
        rows: rows.map((r) => [String(r.no), r.phone, r.barcode, r.locker,
            r.cod.toFixed(2), r.dod.toFixed(2), r.total.toFixed(2), r.status, r.scanDate, r.time]),
        totalRow: {
            cells: ['សរុប (' + rows.length + ' កញ្ចប់)', totalCod.toFixed(2), totalDod.toFixed(2), totalAll.toFixed(2), ''],
            spans: [4, undefined, undefined, undefined, 3]
        },
        footer: 'នាំចេញនៅ ' + (getZoneDateKey(getServerNow(), 0) + ' ' + getFormattedClockTime(getServerNow()))
    };
    // ⛔ `window.print()` អានDOM ភ្លាមៗ ➜ ការគូរត្រូវចប់ **មុន** វា
    renderNow(uiState);

    if (uiState.pdfExportOriginalTitle === null) uiState.pdfExportOriginalTitle = document.title;
    document.title = getExportFilenameBase();
    window.addEventListener('afterprint', restoreAfterPdfExport);
    noteAppLockExcuse();
    window.print();
}

export function exportDataAsCsvForSheets() {
    const rows = buildExportRows();
    if (!rows.length) { showToast(emptyViewMessage(STATS_DAILY_VIEW_KEYS, "⚠️ គ្មានទិន្នន័យសម្រាប់ Export ទេ!")); return; }
    closeModal('exportDataModal');

    const csvEscape = (val) => {
        let s = String(val === undefined || val === null ? '' : val);
        if (/[",\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
        return s;
    };
    const sheetsText = (val) => {
        const s = String(val === undefined || val === null ? '' : val);
        return s === '' ? '' : '="' + s.replace(/"/g, '""') + '"';
    };
    const csvSafeText = (val) => {
        const s = String(val === undefined || val === null ? '' : val);
        return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
    };
    const lines = [EXPORT_HEADERS.map(csvEscape).join(',')];
    rows.forEach(r => {
        lines.push([r.no, sheetsText(r.phone), sheetsText(r.barcode), csvSafeText(r.locker), r.cod.toFixed(2), r.dod.toFixed(2), r.total.toFixed(2), csvSafeText(r.status), r.scanDate, r.time].map(csvEscape).join(','));
    });

    const csvContent = '\uFEFF' + lines.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = getExportFilenameBase() + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast("✅ បាន Export ជា CSV ជោគជ័យ! បើក Google Sheets ➜ File ➜ Import ដើម្បីនាំចូល");
}

export function uncollectedBarcodeValue(entry) {
    if (!entry || typeof entry !== 'object') return null;
    return { cod: statsMoney(entry.cod), dod: statsMoney(entry.dod) };
}

export function uncollectedItemValue(item) {
    const out = { cod: 0, dod: 0 };
    if (!item || typeof item !== 'object') return out;
    const add = (source) => {
        const value = uncollectedBarcodeValue(source);
        if (!value) return;
        out.cod += value.cod;
        out.dod += value.dod;
    };
    const entries = (item.barcodes && Array.isArray(item.barcodes)) ? item.barcodes : null;
    if (entries) {
        entries.forEach((b) => { if (b && !b.isClosed && !b.isDeducted) add(b); });
        return out;
    }
    if (!item.isClosed && !item.isDeducted) add(item);
    return out;
}

export function uncollectedValueByDate() {
    const out = {};
    [dataState.scanHistory, dataState.deletedItems].forEach((list) => {
        if (!Array.isArray(list)) return;
        list.forEach((item) => {
            if (!item || typeof item !== 'object') return;
            const date = String(item.scanDate === undefined || item.scanDate === null ? '' : item.scanDate);
            if (!PICKUP_DATE_KEY_PATTERN.test(date)) return;
            const value = uncollectedItemValue(item);
            if (!value.cod && !value.dod) return;
            const bucket = out[date] || (out[date] = { cod: 0, dod: 0 });
            bucket.cod += value.cod;
            bucket.dod += value.dod;
        });
    });
    return out;
}

export function collectedValueOf(ledgerCod, ledgerDod, uncollected) {
    const open = (uncollected && typeof uncollected === 'object') ? uncollected : {};
    const cod = Math.round(Math.max(0, statsMoney(ledgerCod) - statsMoney(open.cod)) * 100) / 100;
    const dod = Math.round(Math.max(0, statsMoney(ledgerDod) - statsMoney(open.dod)) * 100) / 100;
    return { cod: cod, dod: dod, total: Math.round((cod + dod) * 100) / 100 };
}

export function collectedValueIsMeasurable() {
    return !dbListenerViewIsStale(DB_LISTENER_KEY_HISTORY)
        && !dbListenerViewIsStale(DB_LISTENER_KEY_DELETED)
        && !dbListenerViewIsStale(DB_LISTENER_KEY_DAILY_REVENUE);
}

export function collectedMoneyText(dollar, measurable) {
    if (!measurable) return MONTHLY_REPORT_UNKNOWN;
    return '$' + statsMoney(dollar).toFixed(2);
}

export function collectedRielText(dollar, measurable) {
    if (!measurable) return VIEW_NOT_MEASURABLE_TEXT;
    return monthlyReportRiel(statsMoney(dollar)).toLocaleString() + ' ៛';
}
