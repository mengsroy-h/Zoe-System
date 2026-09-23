import { onAct } from '../../actions';

export function EditPhoneModal() {
    return (
        <div id="editPhoneModal" className="modal">
            <div className="modal-content">
                <h3>✏️ កែប្រែព័ត៌មានអតិថិជន</h3>
                <p>
                    Barcode:{' '}
                    <strong id="editModalBarcodeText"></strong>
                </p>
                <input type="tel" id="editPhoneInput" placeholder="លេខទូរស័ព្ទថ្មី" list="recentPhonesList" />
                <div className="modal-btns" style={{ marginTop: "6px" }}>
                    <div className="modal-btns-row">
                        <button className="btn-confirm" id="editPhoneSaveBtn" onClick={onAct("saveEditedPhone")}>រក្សាទុក</button>
                        <button className="btn-cancel" onClick={onAct("closeModal", { args: ["editPhoneModal"] })}>បោះបង់</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
