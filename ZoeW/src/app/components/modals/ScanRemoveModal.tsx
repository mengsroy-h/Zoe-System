import { Modal } from './Modal';
import { viewState } from '../../../core/view-state';
import { useStoreValue } from '../../hooks/useStore';
import { onAct } from '../../actions';

export function ScanRemoveModal() {
    const texts = useStoreValue(viewState, (s) => s.scanRemoveTexts);
    return (
        <Modal
            id="scanRemoveModal"
            style={{ zIndex: "1065" }}
            close="cancelScannedRemoval"
            role="dialog"
            aria-modal="true"
            aria-labelledby="scanRemoveModalTitle"
        >
            <div className="modal-content scan-remove-modal-content">
                <h3 id="scanRemoveModalTitle">🗑️ ផ្ទៀងផ្ទាត់មុនដកកញ្ចប់</h3>
                <p>សូមពិនិត្យ Barcode និងព័ត៌មានកញ្ចប់ឲ្យត្រូវ មុនបញ្ជាក់ការដក។</p>
                <dl className="scan-remove-preview">
                    <div className="scan-remove-field scan-remove-field-wide">
                        <dt>Barcode</dt>
                        <dd id="scanRemoveBarcodeText">{texts.scanRemoveBarcodeText}</dd>
                    </div>
                    <div className="scan-remove-field scan-remove-field-wide">
                        <dt>លេខទូរស័ព្ទ</dt>
                        <dd id="scanRemovePhoneText">{texts.scanRemovePhoneText}</dd>
                    </div>
                    <div className="scan-remove-field">
                        <dt>ទីតាំង Locker</dt>
                        <dd id="scanRemoveLockerText">{texts.scanRemoveLockerText}</dd>
                    </div>
                    <div className="scan-remove-field">
                        <dt>ស្ថានភាព</dt>
                        <dd id="scanRemoveStateText">{texts.scanRemoveStateText}</dd>
                    </div>
                    <div className="scan-remove-field">
                        <dt>COD</dt>
                        <dd id="scanRemoveCodText">{texts.scanRemoveCodText}</dd>
                    </div>
                    <div className="scan-remove-field">
                        <dt>DOD</dt>
                        <dd id="scanRemoveDodText">{texts.scanRemoveDodText}</dd>
                    </div>
                </dl>
                <div className="scan-remove-warning">ការដកនេះនឹងកាត់ទឹកប្រាក់ និងចំនួនកញ្ចប់ចេញពីស្ថិតិភ្លាមៗ។ អ្នកអាចស្តារពីធុងសំរាម ដើម្បីបូកត្រឡប់វិញបាន។</div>
                <div className="modal-btns scan-remove-actions">
                    <div className="modal-btns-row">
                        <button
                            type="button"
                            className="btn-danger"
                            id="scanRemoveConfirmBtn"
                            onClick={onAct("confirmScannedRemoval")}
                        >
                            🗑️ បញ្ជាក់ដក
                        </button>
                        <button
                            type="button"
                            className="btn-cancel"
                            id="scanRemoveCancelBtn"
                            onClick={onAct("cancelScannedRemoval")}
                        >
                            បោះបង់
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
}
