import { dataState } from '../../../core/state';
import { formatScanStamp } from '../../../core/timezone';

export interface HistoryRowAction {
    action: string;
    args: string[];
    /** `data-self` / `data-evt` ដូច `readActionArgs()` ដើម */
    self?: boolean;
    evt?: boolean;
}

export interface MoneyLine {
    kind: 'cod' | 'dod' | 'sum' | 'none';
    label: string;
    dollars: number;
    riel: number;
}

export interface HistoryRowModel {
    isClosedRow: boolean;
    rowNum: number;
    rowNumClass: string;
    rowNumLabel: string;
    hasPhone: boolean;
    phone: string;
    calledBadge: boolean;
    statusBadge: 'closed' | 'old' | 'new';
    scanTime: string | null;
    lockerLoc: string;
    totalPackageCount: number;
    activeCount: number;
    money: { hasCod: boolean; hasDod: boolean; cod: number; dod: number; codRiel: number; dodRiel: number; sum: number; sumRiel: number };
    callKind: 'none' | 'fix-phone' | 'called' | 'call';
    needsRecall: boolean;
    closeIsReopen: boolean;
    id: string;
}

/**
 * តក្កវិជ្ជានៃជួរដេក — **ដកចេញពី `buildHistoryRowHtml()` ដោយមិនប្តូរ
 * រូបមន្តណាមួយ**។ ការបំបែក *ទិន្នន័យ* ចេញពី *ការគូរ* ធ្វើឲ្យវាស់បាន ៖
 * `tests/history-row-parity.test.ts` រត់ទាំងផ្លូវចាស់ និងថ្មីលើទិន្នន័យ
 * ដដែល រួចប្រៀបធៀបលទ្ធផល។
 */
export function buildHistoryRowModel(item: any, rowNum: number, isOld: boolean, needsRecall: boolean): HistoryRowModel {
    let rowNumClass = '';
    let rowNumLabel = '';
    if (item.callMark === 'no-answer') { rowNumClass = 'row-num-no-answer'; rowNumLabel = 'ខល អត់លើក'; }
    else if (item.callMark === 'no-connect') { rowNumClass = 'row-num-no-connect'; rowNumLabel = 'ខល អត់ចូល'; }
    else if (item.callMark === 'wrong-number') { rowNumClass = 'row-num-wrong-number'; rowNumLabel = 'ខុសលេខ'; }

    let lockerLoc: any = 'N/A';
    if (item.barcodes && Array.isArray(item.barcodes) && item.barcodes.length > 0) {
        const allLockers = item.barcodes.map((b: any) => b.locker || 'N/A').filter((l: any) => l && l !== 'N/A');
        const uniqueLockers = [...new Set(allLockers)];
        if (uniqueLockers.length > 1) lockerLoc = `${uniqueLockers.join(', ')} (${uniqueLockers.length} កន្លែង)`;
        else if (uniqueLockers.length === 1) lockerLoc = uniqueLockers[0];
        else lockerLoc = item.locker || 'N/A';
    } else {
        lockerLoc = item.locker || 'N/A';
    }

    const hasPhone = item.phone !== 'គ្មានលេខ';
    let callKind: HistoryRowModel['callKind'] = 'none';
    if (hasPhone) {
        if (item.callMark === 'wrong-number') callKind = 'fix-phone';
        else if (item.isCalled && !needsRecall) callKind = 'called';
        else callKind = 'call';
    }

    const totalPackageCount = item.barcodes && Array.isArray(item.barcodes) ? item.barcodes.length : (parseFloat(item.count) || 1);

    let activeCod = 0;
    let activeDod = 0;
    let activeCount = parseFloat(item.count) || 1;
    if (item.barcodes && Array.isArray(item.barcodes)) {
        activeCod = item.barcodes.filter((b: any) => !b.isClosed).reduce((sum: number, b: any) => sum + (parseFloat(b.cod) || 0), 0);
        activeDod = item.barcodes.filter((b: any) => !b.isClosed).reduce((sum: number, b: any) => sum + (parseFloat(b.dod) || 0), 0);
        activeCount = item.barcodes.filter((b: any) => !b.isClosed).length;
    } else {
        activeCod = !item.isClosed ? (parseFloat(item.cod) || 0) : 0;
        activeDod = !item.isClosed ? (parseFloat(item.dod) || 0) : 0;
        activeCount = !item.isClosed ? (parseFloat(item.count) || 1) : 0;
    }
    activeCod = Math.round(activeCod * 100) / 100;
    activeDod = Math.round(activeDod * 100) / 100;

    const codRiel = Math.round(activeCod * dataState.exchangeRateRiel);
    const dodRiel = Math.round(activeDod * dataState.exchangeRateRiel);
    const sum = Math.round((activeCod + activeDod) * 100) / 100;

    return {
        id: item.id,
        isClosedRow: !!item.isClosed,
        rowNum,
        rowNumClass,
        rowNumLabel,
        hasPhone,
        phone: item.phone,
        calledBadge: !!item.isCalled,
        statusBadge: item.isClosed ? 'closed' : (isOld ? 'old' : 'new'),
        scanTime: item.time ? formatScanStamp(item.time) : null,
        lockerLoc: String(lockerLoc),
        totalPackageCount,
        activeCount,
        money: { hasCod: activeCod > 0, hasDod: activeDod > 0, cod: activeCod, dod: activeDod, codRiel, dodRiel, sum, sumRiel: codRiel + dodRiel },
        callKind,
        needsRecall,
        closeIsReopen: !!item.isClosed
    };
}
