import { Modal } from './Modal';
import { viewState } from '../../../core/view-state';
import { onAct } from '../../actions';
import { useStoreFields } from '../../hooks/useStore';
import { refTo } from '../../refs';

export function PhoneModal() {
    const v = useStoreFields(viewState, ['modalBarcodeText', 'phoneModalBusy', 'lookupStatus']);
    const status = v.lookupStatus;
    return (
        <Modal id="phoneModal" noDismiss>
            <div className="modal-content">
                <button
                    type="button"
                    className="modal-close-x"
                    id="phoneModalCloseX"
                    disabled={v.phoneModalBusy}
                    title="បិទ"
                    aria-label="បិទ"
                    onClick={onAct("dismissPhoneModal")}
                >
                    ✖
                </button>
                <h3>🎉 ស្កេនបានជោគជ័យ!</h3>
                <p>
                    Barcode:{' '}
                    <strong id="modalBarcodeText">{v.modalBarcodeText}</strong>
                </p>
                <div
                    id="lookupStatus"
                    className={status.kind ? 'lookup-status ' + status.kind : 'lookup-status'}
                    role="status"
                    aria-live="polite"
                    hidden={!status.text}
                >{status.text}</div>
                <input type="tel" id="modalPhoneInput" ref={refTo('modalPhoneInput')} placeholder="លេខទូរស័ព្ទអតិថិជន" list="recentPhonesList" />
                <input
                    type="text"
                    id="modalLockerInput"
                    ref={refTo('modalLockerInput')}
                    placeholder="ទីតាំង Locker (ឧ. A1)"
                    style={{ marginTop: "4px" }}
                />
                <input
                    type="number"
                    id="modalCodInput"
                    ref={refTo('modalCodInput')}
                    placeholder="តម្លៃ COD ($)"
                    step={0.01}
                    min={0}
                    style={{ marginTop: "4px" }}
                />
                <input
                    type="number"
                    id="modalDodInput"
                    ref={refTo('modalDodInput')}
                    placeholder="តម្លៃ DOD ($)"
                    step={0.01}
                    min={0}
                    style={{ marginTop: "4px" }}
                />
                <div className="modal-btns" style={{ marginTop: "6px" }}>
                    <div className="modal-btns-row">
                        <button
                            className="btn-skip"
                            id="phoneModalSkipBtn"
                            disabled={v.phoneModalBusy}
                            onClick={onAct("confirmPhone", { args: [true] })}
                        >
                            រំលង
                        </button>
                        <button
                            className="btn-confirm"
                            id="phoneModalConfirmBtn"
                            disabled={v.phoneModalBusy}
                            onClick={onAct("confirmPhone", { args: [false] })}
                        >
                            យល់ព្រម
                        </button>
                    </div>
                    <button
                        className="btn-cancel"
                        id="phoneModalCancelBtn"
                        disabled={v.phoneModalBusy}
                        onClick={onAct("closeModal", { args: ["phoneModal"] })}
                    >
                        បោះបង់
                    </button>
                </div>
            </div>
        </Modal>
    );
}
