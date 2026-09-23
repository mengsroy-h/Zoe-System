import { onAct } from '../../actions';

export function EditBarcodePriceModal() {
    return (
        <div
            id="editBarcodePriceModal"
            className="modal"
            style={{ zIndex: "1050" }}
            data-close="closeEditBarcodeModal"
        >
            <div className="modal-content">
                <h3>💵 កែទឹកប្រាក់តាមកញ្ចប់ (COD & DOD)</h3>
                <p>
                    Barcode:{' '}
                    <strong id="editBcPcText" style={{ color: "var(--primary)" }}></strong>
                </p>
                <input type="number" id="editBcCodInput" placeholder="តម្លៃ COD ថ្មី ($)" step={0.01} min={0} />
                <input
                    type="number"
                    id="editBcDodInput"
                    placeholder="តម្លៃ DOD ថ្មី ($)"
                    step={0.01}
                    min={0}
                    style={{ marginTop: "4px" }}
                />
                <div className="modal-btns" style={{ marginTop: "6px" }}>
                    <div className="modal-btns-row">
                        <button className="btn-confirm" onClick={onAct("saveEditedBarcodePrice")}>រក្សាទុក</button>
                        <button className="btn-cancel" onClick={onAct("closeEditBarcodeModal")}>បោះបង់</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
