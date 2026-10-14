import { dataState, uiState } from '../core/state';
import { STATS_DAILY_VIEW_KEYS } from '../core/text';
import { emptyViewMessage } from '../services/db-listeners';
import { getFilteredDataByDate } from '../ui/more-menu';
import { beginPdfPrint, getCurrentFilterLabel, getExportFilenameBase } from './export';
import { showToast } from '../ui/toast';

export interface LabelRow {
    phone: string;
    barcode: string;
    date: string;
    locker: string;
    cod: number;
    dod: number;
}

export interface LabelPrintView {
    kind: 'labels';
    title: string;
    labels: LabelRow[];
}

export const LABEL_NO_PHONE_TEXT = '—';

export function labelMoneyText(row: { cod: number; dod: number }) {
    const parts: string[] = [];
    if (row.cod > 0) parts.push('COD $' + row.cod.toFixed(2));
    if (row.dod > 0) parts.push('DOD $' + row.dod.toFixed(2));
    return parts.join(' · ');
}

function labelMoneyOf(value) {
    const n = Math.round((parseFloat(value) || 0) * 100) / 100;
    return Number.isFinite(n) && n > 0 ? n : 0;
}

export function labelDateOf(scanDate) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(scanDate || ''));
    if (!m) return '';
    return m[3] + '/' + m[2];
}

export function buildLabelRows(items) {
    const rows: LabelRow[] = [];
    (Array.isArray(items) ? items : []).forEach((item) => {
        if (!item) return;
        const barcodes = (Array.isArray(item.barcodes) && item.barcodes.length)
            ? item.barcodes
            : (item.barcode ? [{ code: item.barcode, locker: item.locker, cod: item.cod, dod: item.dod }] : []);
        const phone = item.phone && item.phone !== 'គ្មានលេខ' ? String(item.phone) : LABEL_NO_PHONE_TEXT;
        const date = labelDateOf(item.scanDate);
        barcodes.forEach((b) => {
            const code = b && b.code ? String(b.code).trim() : '';
            if (!code) return;
            const locker = String((b && b.locker) || item.locker || '').trim();
            rows.push({ phone, barcode: code, date, locker: locker && locker !== 'N/A' ? locker : '', cod: labelMoneyOf(b && b.cod), dod: labelMoneyOf(b && b.dod) });
        });
    });
    return rows;
}

function printLabelRows(rows: LabelRow[], title: string, fileLabel: string) {
    if (!rows.length) {
        showToast(emptyViewMessage(STATS_DAILY_VIEW_KEYS, '⚠️ គ្មានកញ្ចប់សម្រាប់បោះពុម្ពស្លាកទេ!'));
        return false;
    }
    const view: LabelPrintView = { kind: 'labels', title, labels: rows };
    uiState.pdfExportView = view;
    beginPdfPrint(fileLabel);
    return true;
}

export function printLabelsForFilter() {
    const rows = buildLabelRows(getFilteredDataByDate());
    return printLabelRows(rows, 'ស្លាកកញ្ចប់ (' + getCurrentFilterLabel() + ')', getExportFilenameBase() + '_labels');
}

export function printLabelsForItem(id) {
    const item = dataState.scanHistory.find((i) => i && i.id === id);
    const rows = buildLabelRows(item ? [item] : []);
    return printLabelRows(rows, 'ស្លាកកញ្ចប់', 'ZoeW_label_' + String(id || '').replace(/[^a-zA-Z0-9_-]/g, ''));
}
