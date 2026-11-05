import { fieldChecked, fieldValue, setFieldChecked, setFieldValue } from '../app/refs';
import { dataState, uiState } from '../core/state';
import { appLocalStore, safeStoreGet, safeStoreSet } from '../core/storage';
import { LABEL_PRINT_OPTIONS_KEY } from '../core/storage-keys';
import { STATS_DAILY_VIEW_KEYS } from '../core/text';
import { viewState } from '../core/view-state';
import { emptyViewMessage } from '../services/db-listeners';
import { rowOperationActive } from '../services/row-operation-lock';
import { beginPdfPrint, filteredHistoryItems, getCurrentFilterLabel, getExportFilenameBase } from './export';
import { closeModal, openModalHelper } from '../ui/modal';
import { showToast } from '../ui/toast';
import { shareImageFiles } from '../platform/file-output';
import { noteAppLockExcuse } from './app-lock';
import { drawLabelImage } from './label-image';

export type LabelLayout = '50x30' | '40x30' | '60x40' | 'single' | 'a4-3' | 'a4-2';

export interface LabelOptions {
    layout: LabelLayout;
    money: boolean;
    locker: boolean;
    date: boolean;
    openOnly: boolean;
}

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
    options: LabelOptions;
}

export interface LabelPrintPreview {
    rows: LabelRow[];
    total: number;
    customers: number;
    options: LabelOptions;
}

export type LabelPrintScope = { kind: 'filter' } | { kind: 'item'; id: string };

export const LABEL_NO_PHONE_TEXT = '—';
export const LABEL_PREVIEW_MAX = 6;
export const LABEL_LAYOUTS: readonly LabelLayout[] = ['50x30', '40x30', '60x40', 'single', 'a4-3', 'a4-2'];
export const DEFAULT_LABEL_OPTIONS: LabelOptions = { layout: '50x30', money: true, locker: true, date: true, openOnly: true };
const LABEL_PRICE_PENDING_TEXT = '⏳ ការកែតម្លៃមិនទាន់ផ្ទៀងបញ្ចប់ — សូមរង់ចាំមុនបោះពុម្ព ឬរក្សាទុកស្លាក។';

let labelPrintScope: LabelPrintScope | null = null;

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

export function normalizeLabelOptions(raw): LabelOptions {
    const src = raw && typeof raw === 'object' ? raw : {};
    const layout = LABEL_LAYOUTS.indexOf(src.layout) === -1 ? DEFAULT_LABEL_OPTIONS.layout : src.layout;
    const flag = (key: keyof LabelOptions) => (typeof src[key] === 'boolean' ? src[key] : DEFAULT_LABEL_OPTIONS[key]) as boolean;
    return { layout, money: flag('money'), locker: flag('locker'), date: flag('date'), openOnly: flag('openOnly') };
}

export function loadLabelOptions(): LabelOptions {
    try {
        return normalizeLabelOptions(JSON.parse(safeStoreGet(appLocalStore, LABEL_PRINT_OPTIONS_KEY) || 'null'));
    } catch {
        return normalizeLabelOptions(null);
    }
}

export function saveLabelOptions(options: LabelOptions) {
    safeStoreSet(appLocalStore, LABEL_PRINT_OPTIONS_KEY, JSON.stringify(normalizeLabelOptions(options)));
}

export function buildLabelRows(items, options?: { openOnly?: boolean }) {
    const openOnly = !!(options && options.openOnly);
    const rows: LabelRow[] = [];
    (Array.isArray(items) ? items : []).forEach((item) => {
        if (!item) return;
        const barcodes = Array.isArray(item.barcodes) ? item.barcodes : [];
        const phone = item.phone && item.phone !== 'គ្មានលេខ' ? String(item.phone) : LABEL_NO_PHONE_TEXT;
        const date = labelDateOf(item.scanDate);
        barcodes.forEach((b) => {
            const code = b && b.code ? String(b.code).trim() : '';
            if (!code) return;
            if (openOnly && b.isClosed) return;
            const locker = String((b && b.locker) || item.locker || '').trim();
            rows.push({ phone, barcode: code, date, locker: locker && locker !== 'N/A' ? locker : '', cod: labelMoneyOf(b && b.cod), dod: labelMoneyOf(b && b.dod) });
        });
    });
    return rows;
}

export function labelCustomerCount(rows: LabelRow[]) {
    return new Set((Array.isArray(rows) ? rows : []).map((r) => (r && r.phone) || '')).size;
}

function labelScopeItems(scope: LabelPrintScope | null) {
    if (!scope) return [];
    if (scope.kind === 'item') {
        const item = dataState.scanHistory.find((i) => i && i.id === scope.id);
        return item ? [item] : [];
    }
    return filteredHistoryItems();
}

function labelPricesAreSettled(items) {
    return !(Array.isArray(items) ? items : []).some((item) => item?.pricePending != null && rowOperationActive(item));
}

function labelScopeTitle(scope: LabelPrintScope | null) {
    if (scope && scope.kind === 'item') {
        const item = dataState.scanHistory.find((i) => i && i.id === scope.id);
        const phone = item && item.phone && item.phone !== 'គ្មានលេខ' ? String(item.phone) : LABEL_NO_PHONE_TEXT;
        return 'អតិថិជន ' + phone;
    }
    return 'តម្រង «' + getCurrentFilterLabel() + '»';
}

export function readLabelOptionsFromFields(): LabelOptions {
    return normalizeLabelOptions({
        layout: fieldValue('labelLayoutSelect'),
        money: fieldChecked('labelShowMoney'),
        locker: fieldChecked('labelShowLocker'),
        date: fieldChecked('labelShowDate'),
        openOnly: fieldChecked('labelOpenOnly')
    });
}

function applyLabelOptionsToFields(options: LabelOptions) {
    setFieldValue('labelLayoutSelect', options.layout);
    setFieldChecked('labelShowMoney', options.money);
    setFieldChecked('labelShowLocker', options.locker);
    setFieldChecked('labelShowDate', options.date);
    setFieldChecked('labelOpenOnly', options.openOnly);
}

export function updateLabelPrintPreview() {
    const options = readLabelOptionsFromFields();
    saveLabelOptions(options);
    const items = labelScopeItems(labelPrintScope);
    const settled = labelPricesAreSettled(items);
    const rows = settled ? buildLabelRows(items, options) : [];
    const preview: LabelPrintPreview = { rows: rows.slice(0, LABEL_PREVIEW_MAX), total: rows.length, customers: labelCustomerCount(rows), options };
    viewState.labelPrintPreview = preview;
    viewState.labelPrintSummary = !settled ? LABEL_PRICE_PENDING_TEXT : rows.length
        ? 'ស្លាក ' + rows.length + ' · អតិថិជន ' + preview.customers + (rows.length > LABEL_PREVIEW_MAX ? ' · បង្ហាញគំរូ ' + LABEL_PREVIEW_MAX + ' ដំបូង' : '')
        : (options.openOnly ? 'គ្មានកញ្ចប់ដែលមិនទាន់យកក្នុងវិសាលភាពនេះ — បិទ «បង្ហាញតែកញ្ចប់មិនទាន់យក» ដើម្បីបោះពុម្ពទាំងអស់' : 'គ្មានកញ្ចប់ក្នុងវិសាលភាពនេះ');
    return preview;
}

export function openLabelPrintModal(scope: LabelPrintScope) {
    const items = labelScopeItems(scope);
    if (!labelPricesAreSettled(items)) { showToast(LABEL_PRICE_PENDING_TEXT); return false; }
    if (!items.length || !buildLabelRows(items).length) {
        showToast(emptyViewMessage(STATS_DAILY_VIEW_KEYS, '⚠️ គ្មានកញ្ចប់សម្រាប់បោះពុម្ពស្លាកទេ!'));
        return false;
    }
    labelPrintScope = scope;
    viewState.labelPrintTitle = labelScopeTitle(scope);
    applyLabelOptionsToFields(loadLabelOptions());
    updateLabelPrintPreview();
    openModalHelper('labelPrintModal');
    return true;
}

function labelRowsFromModal(): { options: LabelOptions; rows: LabelRow[] } | null {
    const options = readLabelOptionsFromFields();
    saveLabelOptions(options);
    const items = labelScopeItems(labelPrintScope);
    if (!labelPricesAreSettled(items)) { updateLabelPrintPreview(); showToast(LABEL_PRICE_PENDING_TEXT); return null; }
    const rows = buildLabelRows(items, options);
    if (!rows.length) {
        showToast(emptyViewMessage(STATS_DAILY_VIEW_KEYS, '⚠️ គ្មានកញ្ចប់សម្រាប់បោះពុម្ពស្លាកទេ!'));
        return null;
    }
    return { options, rows };
}

export function printLabelsFromModal() {
    const picked = labelRowsFromModal();
    if (!picked) return false;
    const { options, rows } = picked;
    const scope = labelPrintScope;
    const fileLabel = scope && scope.kind === 'item'
        ? 'ZoeW_label_' + String(scope.id).replace(/[^a-zA-Z0-9_-]/g, '')
        : getExportFilenameBase() + '_labels';
    const view: LabelPrintView = { kind: 'labels', title: 'ស្លាកកញ្ចប់ (' + labelScopeTitle(scope) + ')', labels: rows, options };
    closeModal('labelPrintModal');
    uiState.pdfExportView = view;
    beginPdfPrint(fileLabel);
    return true;
}

export const LABEL_IMAGE_MAX = 200;

export function labelImageFiles(rows: LabelRow[], options: LabelOptions): Array<{ name: string; dataUrl: string }> {
    const used = new Map<string, number>();
    const files: Array<{ name: string; dataUrl: string }> = [];
    for (const row of Array.isArray(rows) ? rows : []) {
        if (!row || !row.barcode) continue;
        const canvas = drawLabelImage({
            phone: row.phone,
            barcode: row.barcode,
            money: options.money ? labelMoneyText(row) : '',
            date: options.date ? row.date : '',
            locker: options.locker ? row.locker : ''
        }, options.layout);
        if (!canvas) return [];
        const base = 'ZoeW_label_' + (String(row.barcode).replace(/[^a-zA-Z0-9]/g, '') || 'x');
        const seen = (used.get(base) || 0) + 1;
        used.set(base, seen);
        const name = seen === 1 ? base + '.png' : base + '_' + seen + '.png';
        files.push({ name, dataUrl: canvas.toDataURL('image/png') });
    }
    return files;
}

export function saveLabelImagesFromModal() {
    const picked = labelRowsFromModal();
    if (!picked) return false;
    const { options, rows } = picked;
    if (rows.length > LABEL_IMAGE_MAX) {
        showToast('⚠️ ស្លាក ' + rows.length + ' ច្រើនពេក (រូបភាព ≤ ' + LABEL_IMAGE_MAX + ' ក្នុងមួយដង) — ជ្រើសថ្ងៃក្នុងតម្រង ឬបោះពុម្ពតាមជួរ');
        return false;
    }
    const files = labelImageFiles(rows, options);
    if (!files.length) {
        showToast('❌ បង្កើតរូបភាពស្លាកមិនបាន — សូមផ្ទៀង Barcode និងជ្រើសទំហំស្លាកធំជាងនេះ។');
        return false;
    }
    noteAppLockExcuse();
    return Promise.resolve(shareImageFiles(files, 'ស្លាកកញ្ចប់ ZoeW')).then((result) => {
        if (result === 'cancelled') return true;
        showToast(result === 'shared'
            ? '✅ រូបភាពស្លាក ' + files.length + ' — រក្សាទុកក្នុង Gallery ឬបើកក្នុង App NIIMBOT'
            : '✅ បានទាញយករូបភាពស្លាក ' + files.length);
        return true;
    }, (e) => {
        if (window.ZoeErrors) ZoeErrors.capture(e, { context: 'Label image share failed:' });
        showToast('❌ រក្សាទុករូបភាពស្លាកមិនបាន');
        return false;
    });
}

export function resetLabelPrint() {
    labelPrintScope = null;
    viewState.labelPrintPreview = null;
    viewState.labelPrintSummary = '';
    viewState.labelPrintTitle = '';
}
