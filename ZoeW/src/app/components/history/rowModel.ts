import { rowOperationActive } from '../../../services/row-operation-lock';
import { dataState } from '../../../core/state';
import { formatScanStamp } from '../../../core/timezone';
import { itemOriginSummary } from '../../../features/barcode-origin';
import { itemReopenLockedByZto } from '../../../features/zto-final-marks';

export interface HistoryRowModel {
    operationBusy: boolean;
    isClosedRow: boolean;
    rowNum: number;
    rowNumClass: string;
    rowNumLabel: string;
    hasPhone: boolean;
    phone: string;
    calledBadge: boolean;
    statusBadge: 'closed' | 'old' | 'new';
    scanTime: string | null;
    originIcon: string;
    origin: string;
    originFull: string;
    originMore: number;
    lockerLoc: string;
    activeCount: number;
    money: { hasCod: boolean; hasDod: boolean; cod: number; dod: number; codRiel: number; dodRiel: number; sum: number; sumRiel: number };
    callKind: 'none' | 'fix-phone' | 'called' | 'call';
    needsRecall: boolean;
    closeIsReopen: boolean;
    reopenLocked: boolean;
    id: string;
}

export function buildHistoryRowModel(item: any, rowNum: number, isOld: boolean, needsRecall: boolean): HistoryRowModel {
    let rowNumClass = '';
    let rowNumLabel = '';
    if (item.callMark === 'no-answer') { rowNumClass = 'row-num-no-answer'; rowNumLabel = 'ខល អត់លើក'; }
    else if (item.callMark === 'no-connect') { rowNumClass = 'row-num-no-connect'; rowNumLabel = 'ខល អត់ចូល'; }
    else if (item.callMark === 'wrong-number') { rowNumClass = 'row-num-wrong-number'; rowNumLabel = 'ខុសលេខ'; }

    const barcodes = Array.isArray(item.barcodes) ? item.barcodes : [];
    const uniqueLockers = [...new Set(barcodes.map((b: any) => b.locker || 'N/A').filter((l: any) => l && l !== 'N/A'))];
    let lockerLoc: any;
    if (uniqueLockers.length > 1) lockerLoc = `${uniqueLockers.join(', ')} (${uniqueLockers.length} កន្លែង)`;
    else if (uniqueLockers.length === 1) lockerLoc = uniqueLockers[0];
    else lockerLoc = item.locker || 'N/A';

    const hasPhone = item.phone !== 'គ្មានលេខ';
    let callKind: HistoryRowModel['callKind'] = 'none';
    if (hasPhone) {
        if (item.callMark === 'wrong-number') callKind = 'fix-phone';
        else if (item.isCalled && !needsRecall) callKind = 'called';
        else callKind = 'call';
    }


    const openBarcodes = barcodes.filter((b: any) => !b.isClosed);
    const activeCod = Math.round(openBarcodes.reduce((sum: number, b: any) => sum + (parseFloat(b.cod) || 0), 0) * 100) / 100;
    const activeDod = Math.round(openBarcodes.reduce((sum: number, b: any) => sum + (parseFloat(b.dod) || 0), 0) * 100) / 100;
    const activeCount = openBarcodes.length;

    const origin = itemOriginSummary(item);
    const codRiel = Math.round(activeCod * dataState.exchangeRateRiel);
    const dodRiel = Math.round(activeDod * dataState.exchangeRateRiel);
    const sum = Math.round((activeCod + activeDod) * 100) / 100;

    return {
        id: item.id,
        operationBusy: rowOperationActive(item),
        isClosedRow: !!item.isClosed,
        rowNum,
        rowNumClass,
        rowNumLabel,
        hasPhone,
        phone: item.phone,
        calledBadge: !!item.isCalled,
        statusBadge: item.isClosed ? 'closed' : (isOld ? 'old' : 'new'),
        scanTime: item.time ? formatScanStamp(item.time) : null,
        originIcon: origin.icon,
        origin: origin.text,
        originFull: origin.full,
        originMore: origin.more,
        lockerLoc: String(lockerLoc),
        activeCount,
        money: { hasCod: activeCod > 0, hasDod: activeDod > 0, cod: activeCod, dod: activeDod, codRiel, dodRiel, sum, sumRiel: codRiel + dodRiel },
        callKind,
        needsRecall,
        closeIsReopen: !!item.isClosed,
        reopenLocked: itemReopenLockedByZto(item)
    };
}

function sameFlatValue(a: unknown, b: unknown): boolean {
    if (Object.is(a, b)) return true;
    if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
    const keys = Object.keys(a);
    if (keys.length !== Object.keys(b).length) return false;
    for (const k of keys) {
        if (!Object.is((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) return false;
    }
    return true;
}

export function sameHistoryRowModel(a: HistoryRowModel, b: HistoryRowModel): boolean {
    if (a === b) return true;
    const keys = Object.keys(a) as (keyof HistoryRowModel)[];
    if (keys.length !== Object.keys(b).length) return false;
    for (const k of keys) {
        if (!sameFlatValue(a[k], b[k])) return false;
    }
    return true;
}
