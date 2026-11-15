import type { ParcelRow } from '../domain/parcel';
import type { LabelPrintView } from '../features/label-print';
import type { PdfTableView } from '../app/components/PdfPrintArea';
import type { SheetImportView as SheetImportModel } from '../app/components/sheet/model';

export type { BarcodeListRow } from '../app/components/barcode/BarcodeListContainer';
export type { EntryListRow } from '../app/components/entry/EntryListTableBody';
export type { LockerListView } from '../app/components/entry/LockerListTableBody';
export type { LockerGridView } from '../app/components/locker/LockerGrid';
export type { MoreMenuItem } from '../app/components/menu/MoreMenuContent';
export type { MonthlyReportView } from '../app/components/reports/MonthlyReportBody';
export type { CardsView, CollectedStatCard, DailyStatCard } from '../app/components/stats/StatsCards';
export type { TrashSummaryModel, TrashView } from '../app/components/trash/model';
export type { LabelPrintPreview } from '../features/label-print';

export type PdfExportView = (PdfTableView & { kind?: never }) | LabelPrintView;
export type SheetImportView = Omit<SheetImportModel, 'mapping'> & {
    mapping: Record<string, SheetImportModel['mapping'][string] & { filled?: boolean }>;
};

export interface PhoneSuggestion {
    phone: string;
    packages: number;
    digits?: string;
    stamp?: number;
}

export interface LockerBarcodeEntry {
    itemId: string;
    barcodeIdx: number;
    item: ParcelRow;
}

export interface ScannedRemoval {
    itemId: string;
    barcodeCode: string;
}

export interface ScannedRemovalOperation extends ScannedRemoval {
    operationToken: object;
}

export type ToastKind = 'info' | 'success' | 'warn' | 'error';

export interface ToastView {
    id: number;
    msg: string;
    kind: ToastKind;
    show: boolean;
    live: string | null;
}
