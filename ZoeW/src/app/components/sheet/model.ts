export type SheetImportView = {
    msgs: Record<string, { text: string; kind: string } | null>;
    summary: { url: string } | null;
    sheetNames: string[];
    sheetValue: string;
    mapping: Record<string, { options: { value: string; label: string }[]; value: string }>;
    chips: { text: string; kind: string }[];
    previewRows: string[][];
};

export function emptySheetImportView(): SheetImportView {
    return { msgs: {}, summary: null, sheetNames: [], sheetValue: '', mapping: {}, chips: [], previewRows: [] };
}

