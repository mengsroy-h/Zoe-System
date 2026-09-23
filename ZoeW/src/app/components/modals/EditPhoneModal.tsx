import { refTo } from '../../refs';
import { viewState } from '../../../core/view-state';
import { useStoreFields } from '../../hooks/useStore';
import { Modal } from './Modal';
import { onAct } from '../../actions';

export function EditPhoneModal() {
    const v = useStoreFields(viewState, ['editModalBarcodeText']);
    return (
        <Modal id="editPhoneModal">
            <div className="modal-content">
                <h3>✏️ កែប្រែព័ត៌មានអតិថិជន</h3>
                <p>
                    Barcode:{' '}
                    <strong id="editModalBarcodeText">{v.editModalBarcodeText}</strong>
                </p>
                <input type="tel" id="editPhoneInput" ref={refTo('editPhoneInput')} placeholder="លេខទូរស័ព្ទថ្មី" list="recentPhonesList" />
                <div className="modal-btns" style={{ marginTop: "6px" }}>
                    <div className="modal-btns-row">
                        <button className="btn-confirm" id="editPhoneSaveBtn" onClick={onAct("saveEditedPhone")}>រក្សាទុក</button>
                        <button className="btn-cancel" onClick={onAct("closeModal", { args: ["editPhoneModal"] })}>បោះបង់</button>
                    </div>
                </div>
            </div>
        </Modal>
    );
}
