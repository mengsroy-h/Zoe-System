import { uiState } from '../../../core/state';
import { useStore } from '../../hooks/useStore';
import { loadSheetImportSelectedSheet, renderSheetImportPreview } from '../../../features/sheet-import';
import { emptySheetImportView } from './model';

function view(): any {
    return uiState.sheetImportView || emptySheetImportView();
}

function setView(patch: any) {
    uiState.sheetImportView = Object.assign({}, view(), patch);
}

/**
 * Tab ក្នុងឯកសារ Excel។
 * ⛔ តម្លៃរស់ក្នុង store ➜ `loadSheetImportSelectedSheet()` លែងអាន
 *    `sel.value` ➜ លំដាប់ «គូរជម្រើស រួចអានតម្លៃ» លែងជាការប្រណាំង។
 */
export function SiSheetSelect() {
    useStore(uiState);
    const v = view();
    return (
        <select id="siSheetSel"
            value={v.sheetValue}
            onChange={(e) => { setView({ sheetValue: e.target.value }); loadSheetImportSelectedSheet(); }}>
            {v.sheetNames.map((name: string) => <option value={name} key={name}>{name}</option>)}
        </select>
    );
}

/**
 * ជម្រើសផ្គូផ្គងជួរឈរ (៤)។
 * ⛔ «— មិនប្រើ —» មានតម្លៃ `-1` ➜ វាជាសាលក្រម «វាលនេះមិនប្រើ» មិនមែន
 *    ជួរឈរទី ០ (ការច្រឡំ = COD ចូលវាល Barcode)។
 */
function MapSelect({ id }: { id: string }) {
    useStore(uiState);
    const cfg = view().mapping[id] || { options: [], value: '', filled: false };
    return (
        <select id={id}
            value={cfg.filled ? cfg.value : ''}
            onChange={(e) => {
                const next = Object.assign({}, view().mapping);
                next[id] = Object.assign({}, next[id] || { options: [], filled: false }, { value: e.target.value });
                setView({ mapping: next });
                renderSheetImportPreview();
            }}>
            {/* ⛔ មុន `fillSheetImportMappingSelects()` រត់ `<select>` ត្រូវ **ទទេ**
                ដូចដើមបេះបិទ ៖ ធាតុលើស នៅពេលសម្រាក = ការបាត់ parity ។ */}
            {cfg.filled ? <option value="-1">— មិនប្រើ —</option> : null}
            {cfg.options.map((o: any) => <option value={o.value} key={o.value}>{o.label}</option>)}
        </select>
    );
}

export function SiMapBarcode() { return <MapSelect id="siMapBarcode" />; }
export function SiMapDod() { return <MapSelect id="siMapDod" />; }
export function SiMapCod() { return <MapSelect id="siMapCod" />; }
export function SiMapPhone() { return <MapSelect id="siMapPhone" />; }
