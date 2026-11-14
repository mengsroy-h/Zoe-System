import { dataState } from '../../../core/state';
import { TRASH_FILTER_META, TRASH_REASON_META, trashGroupInFilter, trashItemTotals, trashItemCodes } from '../../../features/trash';
import { TRASH_CODES_PREVIEW } from '../../../features/locker';
import { trashRestoreBlockOf, trashZtoTerminalDecision } from '../../../features/zto-final-marks';
import { barcodeEntriesOf, barcodeReturnBasis, barcodeZtoSigned } from '../../../domain/barcode';

export interface TrashBucket { total: number; count: number; riel: number }

export interface TrashSummaryModel {
    deducted: TrashBucket;
    kept: TrashBucket;
    grandTotal: number;
    grandCount: number;
    groupCount: number;
    scopeNote: string;
    filter: string;
}

export interface TrashTerminalBadge { kind: 'signed' | 'returned'; label: string; cls: string }
export interface TrashSubRow { id: string; codes: string[]; count: number; total: number; restoreBlock: string; restoreExplain?: string; restoreHalf: boolean; terminalBadges: TrashTerminalBadge[] }

export interface TrashRowModel {
    key: string;
    phone: string;
    metaLabel: string;
    metaCls: string;
    terminalBadges: TrashTerminalBadge[];
    whenText: string;
    codes: string[];
    moreCodes: number;
    count: number;
    total: number;
    riel: number;
    singleId: string | null;
    singleBlock: string;
    singleExplain?: string;
    singleHalf: boolean;
    expanded: boolean;
    itemCount: number;
    subRows: TrashSubRow[];
}

export interface TrashView {
    empty: string | null;
    rows: TrashRowModel[];
    more: number;
    overflow: number;
}

export function trashRestoreHalf(item) {
    return !!item && item.restoreBlocked !== true && !trashZtoTerminalDecision(item) && !!item.restoreClaim;
}

function trashStoredSigned(item) {
    return barcodeEntriesOf(item.barcodes).some(({ barcode }) => barcodeZtoSigned(barcode));
}

function trashStoredReturned(item) {
    return barcodeEntriesOf(item.barcodes).some(({ barcode }) => Number(barcode?.ztoReturnedAt) > 0
        && barcode.ztoReturnedAt >= barcodeReturnBasis(barcode, item.createdAt)
        && barcode.ztoReturnedAt > Math.max(Number(barcode.ztoSentOutAt) || 0, Number(barcode.ztoMisplacedAt) || 0));
}

function trashTerminalBadgeKind(item) {
    const decision = trashZtoTerminalDecision(item);
    if (decision) return decision;
    if (!['palm', 'cookie'].includes(item.trashMode)) return '';
    if (trashStoredSigned(item)) return 'signed';
    if (!trashStoredReturned(item)) return '';
    return item.restoreBlocked === true || item.trashMode === 'palm' && item.trashReason === 'pickup' ? 'signed' : 'returned';
}

function terminalBadges(items): TrashTerminalBadge[] {
    const rows = Array.isArray(items) ? items : [];
    return (['signed', 'returned'] as const).flatMap(kind => {
        const matching = rows.filter(item => trashTerminalBadgeKind(item) === kind
            || kind === 'returned' && trashTerminalBadgeKind(item) === 'signed' && !trashStoredSigned(item) && trashStoredReturned(item));
        if (!matching.length) return [];
        const actual = matching.every(kind === 'signed' ? trashStoredSigned : trashStoredReturned);
        return [{ kind, label: kind === 'signed' ? actual ? 'ZTO Sign រួច' : 'ZTO ហាមស្តារ'
            : actual ? 'ZTO ត្រឡប់' : 'ZTO ហាមស្តារ៖ ត្រឡប់', cls: kind === 'signed' ? 'trash-tag-pickup' : 'trash-tag-remove' }];
    });
}

function restoreExplanation(item) {
    const block = trashRestoreBlockOf(item);
    return (block === 'signed' || block === 'palm') && trashTerminalBadgeKind(item) === 'signed'
        && !trashStoredSigned(item) ? 'decision-signed' : block;
}

export function buildTrashSummaryModel(groups: any[], query: string, filter = ''): TrashSummaryModel {
    const deducted = { total: 0, count: 0 };
    const kept = { total: 0, count: 0 };
    groups.forEach((group) => {
        const meta = TRASH_REASON_META[group.reason] || TRASH_REASON_META.delete;
        const bucket = meta.deducted ? deducted : kept;
        bucket.total += group.total;
        bucket.count += group.count;
    });
    deducted.total = Math.round(deducted.total * 100) / 100;
    kept.total = Math.round(kept.total * 100) / 100;
    const shown = filter === 'deducted' ? deducted : (filter === 'kept' ? kept : null);
    const scope = query ? 'លទ្ធផលស្វែងរក' : 'ធុងសំរាមទាំងមូល';
    return {
        deducted: { ...deducted, riel: Math.round(deducted.total * dataState.exchangeRateRiel) },
        kept: { ...kept, riel: Math.round(kept.total * dataState.exchangeRateRiel) },
        grandTotal: shown ? shown.total : Math.round((deducted.total + kept.total) * 100) / 100,
        grandCount: shown ? shown.count : deducted.count + kept.count,
        groupCount: shown ? groups.filter((group) => trashGroupInFilter(group, filter)).length : groups.length,
        scopeNote: shown ? TRASH_FILTER_META[filter].note + (query ? ' · ' + scope : '') : scope,
        filter: shown ? filter : ''
    };
}

export function buildTrashRowModel(group: any, expandedKeys: Set<any>): TrashRowModel {
    const meta = TRASH_REASON_META[group.reason] || TRASH_REASON_META.delete;
    const expanded = expandedKeys.has(group.key);
    const whenText = [group.scanDate, group.time].filter(Boolean).join(' ') || 'មិនស្គាល់ពេល';
    return {
        key: group.key,
        phone: group.phone,
        metaLabel: meta.label,
        metaCls: meta.cls,
        terminalBadges: terminalBadges(group.items),
        whenText,
        codes: group.codes.slice(0, TRASH_CODES_PREVIEW),
        moreCodes: Math.max(0, group.codes.length - TRASH_CODES_PREVIEW),
        count: group.count,
        total: group.total,
        riel: Math.round(group.total * dataState.exchangeRateRiel),
        singleId: group.items.length === 1 ? group.items[0].id : null,
        singleBlock: group.items.length === 1 ? trashRestoreBlockOf(group.items[0]) : '',
        singleExplain: group.items.length === 1 ? restoreExplanation(group.items[0]) : '',
        singleHalf: group.items.length === 1 && trashRestoreHalf(group.items[0]),
        expanded,
        itemCount: group.items.length,
        subRows: expanded && group.items.length > 1
            ? group.items.map((item: any) => {
                const totals = trashItemTotals(item);
                return {
                    id: item.id,
                    codes: trashItemCodes(item),
                    count: totals.count,
                    total: Math.round((totals.cod + totals.dod) * 100) / 100,
                    restoreBlock: trashRestoreBlockOf(item),
                    restoreExplain: restoreExplanation(item),
                    restoreHalf: trashRestoreHalf(item),
                    terminalBadges: terminalBadges([item])
                };
            })
            : []
    };
}
