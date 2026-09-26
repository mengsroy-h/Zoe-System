import { uiState } from '../../../core/state';
import { useStore } from '../../hooks/useStore';
import { act } from '../../actions';
import { emptySheetImportView } from './model';

function view(): any {
    return uiState.sheetImportView || emptySheetImportView();
}

function setView(patch: any) {
    uiState.sheetImportView = Object.assign({}, view(), patch);
}

export function SiSheetSelect() {
    useStore(uiState);
    const v = view();
    return (
        <select id="siSheetSel"
            value={v.sheetValue}
            onChange={(e) => { setView({ sheetValue: e.target.value }); act('loadSheetImportSelectedSheet'); }}>
            {v.sheetNames.map((name: string) => <option value={name} key={name}>{name}</option>)}
        </select>
    );
}

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
                act('renderSheetImportPreview');
            }}>
            {cfg.filled ? <option value="-1">— មិនប្រើ —</option> : null}
            {cfg.options.map((o: any) => <option value={o.value} key={o.value}>{o.label}</option>)}
        </select>
    );
}

export function SiMapBarcode() { return <MapSelect id="siMapBarcode" />; }
export function SiMapDod() { return <MapSelect id="siMapDod" />; }
export function SiMapCod() { return <MapSelect id="siMapCod" />; }
export function SiMapPhone() { return <MapSelect id="siMapPhone" />; }
