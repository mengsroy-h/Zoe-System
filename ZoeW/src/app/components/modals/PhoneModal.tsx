import { onAct } from '../../actions';

export function PhoneModal() {
    return (
        <div id="phoneModal" className="modal" data-nodismiss="true">
            <div className="modal-content">
                <button
                    type="button"
                    className="modal-close-x"
                    id="phoneModalCloseX"
                    title="បិទ"
                    aria-label="បិទ"
                    onClick={onAct("dismissPhoneModal")}
                >
                    ✖
                </button>
                <h3>🎉 ស្កេនបានជោគជ័យ!</h3>
                <p>
                    Barcode:{' '}
                    <strong id="modalBarcodeText"></strong>
                </p>
                <div id="lookupStatus" className="lookup-status" role="status" aria-live="polite" hidden></div>
                <input type="tel" id="modalPhoneInput" placeholder="លេខទូរស័ព្ទអតិថិជន" list="recentPhonesList" />
                <input
                    type="text"
                    id="modalLockerInput"
                    placeholder="ទីតាំង Locker (ឧ. A1)"
                    style={{ marginTop: "4px" }}
                />
                <input
                    type="number"
                    id="modalCodInput"
                    placeholder="តម្លៃ COD ($)"
                    step={0.01}
                    min={0}
                    style={{ marginTop: "4px" }}
                />
                <input
                    type="number"
                    id="modalDodInput"
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
                            onClick={onAct("confirmPhone", { args: [true] })}
                        >
                            រំលង
                        </button>
                        <button
                            className="btn-confirm"
                            id="phoneModalConfirmBtn"
                            onClick={onAct("confirmPhone", { args: [false] })}
                        >
                            យល់ព្រម
                        </button>
                    </div>
                    <button
                        className="btn-cancel"
                        id="phoneModalCancelBtn"
                        onClick={onAct("closeModal", { args: ["phoneModal"] })}
                    >
                        បោះបង់
                    </button>
                </div>
            </div>
        </div>
    );
}
