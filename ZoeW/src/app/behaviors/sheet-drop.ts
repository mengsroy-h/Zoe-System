import { viewState } from '../../core/view-state';
import { handleSheetImportFile } from '../../features/sheet-import';
import { elementOf } from '../refs';

/**
 * ទម្លាក់ឯកសារលើប្រអប់ «ជ្រើសឯកសារ» ៖ `si-drop-hot` ជា state · ឯកសារ ➜
 * `handleSheetImportFile()` ។ listener ជា native ដូចដើម (ចាក់ម្តងពេល boot)។
 */
export function setupSheetImportDropZone() {
    const drop = elementOf('siDrop');
    if (!drop) return;
    ['dragenter', 'dragover'].forEach((name) => {
        drop.addEventListener(name, (evt) => {
            evt.preventDefault();
            viewState.siDropHot = true;
        });
    });
    ['dragleave', 'drop'].forEach((name) => {
        drop.addEventListener(name, (evt) => {
            evt.preventDefault();
            viewState.siDropHot = false;
        });
    });
    drop.addEventListener('drop', (evt: DragEvent) => {
        if (evt.dataTransfer && evt.dataTransfer.files && evt.dataTransfer.files.length) {
            handleSheetImportFile(evt.dataTransfer.files[0]);
        }
    });
}
