import type { DragEvent } from 'react';
import { viewState } from '../../core/view-state';
import { handleSheetImportFile } from '../../features/sheet-import';

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
