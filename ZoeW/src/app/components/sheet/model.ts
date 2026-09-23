/**
 * ទិដ្ឋភាពរបស់ប្រអប់ «នាំចូល Excel ទៅ Sheet» ។
 *
 * ⛔ វត្ថុតែមួយកាន់ផ្ទៃទាំង ៦ ៖ សារ · សេចក្តីសង្ខេប · tab · ការផ្គូផ្គង ·
 *    chip · មើលជាមុន។ ការបំបែកជា state ៦ នឹងបង្កើតលំដាប់គូរ ៦ ដែល
 *    អាចឃ្លាតគ្នា — ⛔ ផ្ទៃទាំងនោះរាយលេខ *ដេរីវេពីទិន្នន័យតែមួយ*។
 */
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

/** ធានាថា `uiState.sheetImportView` មានរូបរាងពេញ មុនការកែផ្នែកណាមួយ */
export function sheetImportViewOf(current: any): SheetImportView {
    if (!current) return emptySheetImportView();
    return current as SheetImportView;
}
