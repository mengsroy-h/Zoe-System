import type { DragEvent } from 'react';
import { viewState } from '../../core/view-state';
import { handleSheetImportFile } from '../../features/sheet-import';

/**
 * ទម្លាក់ឯកសារលើប្រអប់ «ជ្រើសឯកសារ» ៖ `si-drop-hot` ជា state · ឯកសារ ➜
 * `handleSheetImportFile()` ។ handler ទាំងនេះជា prop របស់ JSX (`SheetImportModal`)។
 * ⛔ `preventDefault()` លើ `dragenter`/`dragover` ចាំបាច់ — បើអត់ browser បើកឯកសារជំនួស App។
 */
export function sheetDropEnter(evt: DragEvent) {
    evt.preventDefault();
    viewState.siDropHot = true;
}

export function sheetDropLeave(evt: DragEvent) {
    evt.preventDefault();
    viewState.siDropHot = false;
}

export function sheetDropFile(evt: DragEvent) {
    sheetDropLeave(evt);
    if (evt.dataTransfer && evt.dataTransfer.files && evt.dataTransfer.files.length) {
        handleSheetImportFile(evt.dataTransfer.files[0]);
    }
}
