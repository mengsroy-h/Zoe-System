import type { DataState } from '../../../../ZoeW/src/core/state';

type Assert<T extends true> = T;
type IsAny<T> = 0 extends (1 & T) ? true : false;
type HistoryItem = DataState['scanHistory'][number];
type DeletedItem = DataState['deletedItems'][number];

export type HistoryHasDomainShape = Assert<IsAny<HistoryItem> extends false ? true : false>;
export type DeletedHasDomainShape = Assert<IsAny<DeletedItem> extends false ? true : false>;
export type HistoryRejectsTextMoney = Assert<{ cod: string } extends HistoryItem ? false : true>;
export type DeletedRejectsTextMoney = Assert<{ cod: string } extends DeletedItem ? false : true>;
export type HistoryBarcodeHasDomainShape = Assert<IsAny<NonNullable<HistoryItem['barcodes']>[number]> extends false ? true : false>;
export type HistoryBarcodeRejectsTextMoney = Assert<{ cod: string } extends NonNullable<HistoryItem['barcodes']>[number] ? false : true>;
