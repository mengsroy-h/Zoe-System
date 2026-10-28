import { setModalDisplay } from '../core/modals';
import { buildTrashRowModel, buildTrashSummaryModel } from '../app/components/trash/model';
import { fieldValue, setFieldValue } from '../app/refs';
import { dataState, uiState } from '../core/state';
import { DB_LISTENER_KEY_DELETED } from '../core/text';
import { barcodeEntriesOf } from '../domain/barcode';
import { DELETED_LIST_MAX_ROWS, expandedTrashGroups } from './locker';
import { emptyViewMessage } from '../services/db-listeners';
import { closeModal, openModalHelper } from '../ui/modal';
import { explainZtoRestoreBlock, trashItemMisplaced, trashItemSentOut, trashRestoreBlockOf } from './zto-final-marks';

export const TRASH_PAGE_ROWS = 20;

export const TRASH_REASON_META = {
    remove: { label: 'ដក', cls: 'trash-tag-remove', deducted: true },
    returned: { label: 'ត្រឡប់', cls: 'trash-tag-returned', deducted: true },
    misplaced: { label: 'ខុសទីតាំង', cls: 'trash-tag-returned', deducted: true },
    sent: { label: 'បញ្ជូនចេញ', cls: 'trash-tag-returned', deducted: true },
    pickup: { label: 'យករួច', cls: 'trash-tag-pickup', deducted: false },
    delete: { label: 'លុប', cls: 'trash-tag-delete', deducted: false }
};

export const TRASH_FILTER_META = {
    deducted: { note: 'បង្ហាញតែ ➖ ដក + ត្រឡប់', empty: 'គ្មានកញ្ចប់ «ដក» ឬ «ត្រឡប់» ក្នុងធុងសំរាមទេ' },
    kept: { note: 'បង្ហាញតែ ✅ យករួច + លុប', empty: 'គ្មានកញ្ចប់ «យករួច» ឬ «លុប» ក្នុងធុងសំរាមទេ' }
};

export function trashFilterOf(value) {
    return value === 'deducted' || value === 'kept' ? value : '';
}

export function trashGroupInFilter(group, filter) {
    if (!filter) return true;
    const meta = TRASH_REASON_META[group && group.reason] || TRASH_REASON_META.delete;
    return (meta.deducted ? 'deducted' : 'kept') === filter;
}

export function trashReasonOf(item) {
    if (!item) return 'delete';
    if (typeof item.trashReason === 'string' && TRASH_REASON_META[item.trashReason] && item.trashReason !== 'misplaced' && item.trashReason !== 'sent') return item.trashReason;
    if (item.isFromDeletion) return item.isClosed ? 'pickup' : 'delete';
    return 'remove';
}

export function trashReasonDeducted(item) {
    return TRASH_REASON_META[trashReasonOf(item)].deducted;
}

export function trashDisplayReasonOf(item) {
    const reason = trashReasonOf(item);
    if (reason !== 'returned') return reason;
    if (trashItemMisplaced(item)) return 'misplaced';
    return trashItemSentOut(item) ? 'sent' : reason;
}

export function trashItemTotals(item) {
    const entries = barcodeEntriesOf(item && item.barcodes);
    if (entries.length) {
        let cod = 0;
        let dod = 0;
        entries.forEach(({ barcode }) => {
            cod += parseFloat(barcode && barcode.cod) || 0;
            dod += parseFloat(barcode && barcode.dod) || 0;
        });
        return { cod: Math.round(cod * 100) / 100, dod: Math.round(dod * 100) / 100, count: entries.length };
    }
    const cod = parseFloat(item && item.cod) || 0;
    const dod = parseFloat(item && item.dod) || 0;
    const count = parseFloat(item && item.count) || 1;
    return { cod: Math.round(cod * 100) / 100, dod: Math.round(dod * 100) / 100, count: count };
}

export function trashItemCodes(item) {
    const codes = [];
    barcodeEntriesOf(item && item.barcodes).forEach(({ barcode }) => {
        const code = barcode && barcode.code;
        if (code && codes.indexOf(code) === -1) codes.push(code);
    });
    if (!codes.length && item && item.barcode) codes.push(item.barcode);
    return codes;
}

export function trashGroupKeyOf(item, reason) {
    return [reason, item.phone || '', item.scanDate || '', item.time || '']
        .map((part) => String(part).length + ':' + part).join('');
}

export function buildTrashGroups(items) {
    const groups = [];
    const byKey = new Map();
    (Array.isArray(items) ? items : []).forEach((item) => {
        if (!item || !item.id) return;
        const reason = trashDisplayReasonOf(item);
        const key = trashGroupKeyOf(item, reason);
        let group = byKey.get(key);
        if (!group) {
            group = {
                key: key, reason: reason, phone: item.phone || 'គ្មានលេខ',
                scanDate: item.scanDate || '', time: item.time || '',
                items: [], codes: [], cod: 0, dod: 0, count: 0, total: 0, deletedAt: 0
            };
            byKey.set(key, group);
            groups.push(group);
        }
        const totals = trashItemTotals(item);
        group.items.push(item);
        group.cod += totals.cod;
        group.dod += totals.dod;
        group.count += totals.count;
        trashItemCodes(item).forEach((code) => { if (group.codes.indexOf(code) === -1) group.codes.push(code); });
        const deletedAt = parseFloat(item.deletedAt) || 0;
        if (deletedAt > group.deletedAt) group.deletedAt = deletedAt;
    });
    groups.forEach((group) => {
        group.cod = Math.round(group.cod * 100) / 100;
        group.dod = Math.round(group.dod * 100) / 100;
        group.total = Math.round((group.cod + group.dod) * 100) / 100;
        group.items.sort((a, b) => (parseFloat(b.deletedAt) || 0) - (parseFloat(a.deletedAt) || 0));
    });
    return groups.sort((a, b) => b.deletedAt - a.deletedAt);
}

export function trashGroupMatchesQuery(group, query) {
    if (!query) return true;
    if (String(group.phone).toLowerCase().indexOf(query) !== -1) return true;
    return group.codes.some((code) => String(code).toLowerCase().indexOf(query) !== -1);
}

export function filterRecentlyDeleted() {
    uiState.deletedSearchQuery = fieldValue('deletedSearchInput');
    uiState.trashRenderLimit = TRASH_PAGE_ROWS;
    renderRecentlyDeleted();
}

export function toggleTrashGroup(key?) {
    if (!key) return;
    if (expandedTrashGroups.has(key)) expandedTrashGroups.delete(key);
    else expandedTrashGroups.add(key);
    renderRecentlyDeleted();
}

export function toggleTrashReasonFilter(bucket?) {
    const next = trashFilterOf(bucket);
    uiState.trashReasonFilter = trashFilterOf(uiState.trashReasonFilter) === next ? '' : next;
    uiState.trashRenderLimit = TRASH_PAGE_ROWS;
    renderRecentlyDeleted();
}

export function closeRecentlyDeletedModal() {
    uiState.deletedSearchQuery = '';
    uiState.trashReasonFilter = '';
    expandedTrashGroups.clear();
    setFieldValue('deletedSearchInput', '');
    closeModal('recentlyDeletedModal');
}

export function showMoreTrashRows() {
    uiState.trashRenderLimit = Math.min(DELETED_LIST_MAX_ROWS, trashRenderCap() + TRASH_PAGE_ROWS);
    renderRecentlyDeleted();
}

export function trashRenderCap() {
    const limit = Number(uiState.trashRenderLimit);
    return Math.min(DELETED_LIST_MAX_ROWS, Math.max(TRASH_PAGE_ROWS, Number.isFinite(limit) ? limit : TRASH_PAGE_ROWS));
}

export function openRecentlyDeletedModal() {
    setFieldValue('deletedSearchInput', uiState.deletedSearchQuery);
    uiState.trashRenderLimit = TRASH_PAGE_ROWS;
    renderRecentlyDeleted();
    openModalHelper('recentlyDeletedModal');
}

export function renderTrashSummary(groups, query, filter = '') {
    uiState.trashSummary = buildTrashSummaryModel(groups, query, filter);
    uiState.touch();
}

export function renderRecentlyDeleted() {
    const query = String(uiState.deletedSearchQuery || '').trim().toLowerCase();
    const filter = trashFilterOf(uiState.trashReasonFilter);
    const allGroups = buildTrashGroups(dataState.deletedItems);
    const found = query ? allGroups.filter((group) => trashGroupMatchesQuery(group, query)) : allGroups;
    const groups = filter ? found.filter((group) => trashGroupInFilter(group, filter)) : found;
    renderTrashSummary(found, query, filter);

    const liveKeys = new Set(allGroups.map((group) => group.key));
    Array.from(expandedTrashGroups).forEach((key) => { if (!liveKeys.has(key)) expandedTrashGroups.delete(key); });

    if (groups.length === 0) {
        uiState.trashView = {
            empty: query
                ? 'រកមិនឃើញលេខ ឬ Barcode នេះក្នុងធុងសំរាមទេ' + (filter && found.length ? ' (' + TRASH_FILTER_META[filter].note + ')' : '')
                : emptyViewMessage([DB_LISTENER_KEY_DELETED], filter ? TRASH_FILTER_META[filter].empty : 'គ្មានទិន្នន័យដែលបានលុបទេ'),
            rows: [],
            more: 0,
            overflow: 0
        };
        uiState.touch();
        return;
    }

    const cap = trashRenderCap();
    const listed = Math.min(groups.length, DELETED_LIST_MAX_ROWS);
    uiState.trashView = {
        empty: null,
        rows: groups.slice(0, cap).map((group) => buildTrashRowModel(group, expandedTrashGroups)),
        more: Math.max(0, listed - cap),
        overflow: Math.max(0, groups.length - DELETED_LIST_MAX_ROWS)
    };
    uiState.touch();
}

export function promptRestoreDeletedItem(id?) {
    const block = trashRestoreBlockOf(dataState.deletedItems.find((item) => item && item.id === id));
    if (block) {
        explainZtoRestoreBlock(block);
        return;
    }
    uiState.pendingRestoreId = id;
    setModalDisplay('recentlyDeletedModal', 'none');
    openModalHelper('restoreWarningModal');
}

export function cancelRestoreItem() {
    uiState.pendingRestoreId = null;
    closeModal('restoreWarningModal');
    openRecentlyDeletedModal();
}
