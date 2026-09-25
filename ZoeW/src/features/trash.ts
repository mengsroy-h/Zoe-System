import { setModalDisplay } from '../core/modals';
import { buildTrashRowModel, buildTrashSummaryModel } from '../app/components/trash/model';
import { fieldValue, setFieldValue } from '../app/refs';
import { dataState, uiState } from '../core/state';
import { DB_LISTENER_KEY_DELETED } from '../core/text';
import { barcodeEntriesOf } from '../domain/barcode';
import { DELETED_LIST_MAX_ROWS, expandedTrashGroups } from './locker';
import { emptyViewMessage } from '../services/db-listeners';
import { closeModal, openModalHelper } from '../ui/modal';

export const TRASH_REASON_META = {
    remove: { label: 'ដក', cls: 'trash-tag-remove', deducted: true },
    expired: { label: 'ផុតកំណត់', cls: 'trash-tag-expired', deducted: true },
    pickup: { label: 'យករួច', cls: 'trash-tag-pickup', deducted: false },
    delete: { label: 'លុប', cls: 'trash-tag-delete', deducted: false }
};

export function trashReasonOf(item) {
    if (!item) return 'delete';
    if (typeof item.trashReason === 'string' && TRASH_REASON_META[item.trashReason]) return item.trashReason;
    if (item.isFromDeletion) return item.isClosed ? 'pickup' : 'delete';
    return 'remove';
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
        const reason = trashReasonOf(item);
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
    });
    return groups;
}

export function trashGroupMatchesQuery(group, query) {
    if (!query) return true;
    if (String(group.phone).toLowerCase().indexOf(query) !== -1) return true;
    return group.codes.some((code) => String(code).toLowerCase().indexOf(query) !== -1);
}

export function filterRecentlyDeleted() {
    uiState.deletedSearchQuery = fieldValue('deletedSearchInput');
    renderRecentlyDeleted();
}

export function toggleTrashGroup(key?) {
    if (!key) return;
    if (expandedTrashGroups.has(key)) expandedTrashGroups.delete(key);
    else expandedTrashGroups.add(key);
    renderRecentlyDeleted();
}

export function closeRecentlyDeletedModal() {
    uiState.deletedSearchQuery = '';
    expandedTrashGroups.clear();
    setFieldValue('deletedSearchInput', '');
    closeModal('recentlyDeletedModal');
}

export function openRecentlyDeletedModal() {
    setFieldValue('deletedSearchInput', uiState.deletedSearchQuery);
    renderRecentlyDeleted();
    openModalHelper('recentlyDeletedModal');
}

export function renderTrashSummary(groups, query) {
    // ➜ `TrashSummaryBox` (React) គូរ។ រូបមន្តរស់ក្នុង `buildTrashSummaryModel()`
    //   ដែលដេរីវេ ២ ក្រុមពី `TRASH_REASON_META[r].deducted` ដដែល។
    uiState.trashSummary = buildTrashSummaryModel(groups, query);
    uiState.touch();
}

export function renderRecentlyDeleted() {
    const query = String(uiState.deletedSearchQuery || '').trim().toLowerCase();
    const allGroups = buildTrashGroups(dataState.deletedItems);
    const groups = query ? allGroups.filter((group) => trashGroupMatchesQuery(group, query)) : allGroups;
    renderTrashSummary(groups, query);

    const liveKeys = new Set(allGroups.map((group) => group.key));
    Array.from(expandedTrashGroups).forEach((key) => { if (!liveKeys.has(key)) expandedTrashGroups.delete(key); });

    if (groups.length === 0) {
        uiState.trashView = {
            empty: query
                ? 'រកមិនឃើញលេខ ឬ Barcode នេះក្នុងធុងសំរាមទេ'
                : emptyViewMessage([DB_LISTENER_KEY_DELETED], 'គ្មានទិន្នន័យដែលបានលុបទេ'),
            rows: [],
            overflow: 0
        };
        uiState.touch();
        return;
    }

    uiState.trashView = {
        empty: null,
        rows: groups.slice(0, DELETED_LIST_MAX_ROWS).map((group) => buildTrashRowModel(group, expandedTrashGroups)),
        overflow: Math.max(0, groups.length - DELETED_LIST_MAX_ROWS)
    };
    uiState.touch();
}

export function promptRestoreDeletedItem(id?) {
    uiState.pendingRestoreId = id;
    setModalDisplay('recentlyDeletedModal', 'none');
    openModalHelper('restoreWarningModal');
}

export function cancelRestoreItem() {
    uiState.pendingRestoreId = null;
    closeModal('restoreWarningModal');
    openRecentlyDeletedModal();
}
