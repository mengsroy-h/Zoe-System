import { onAct } from '../../actions';

export function LocationWarningModal() {
    return (
        <div
            id="locationWarningModal"
            className="modal"
            style={{ zIndex: "1065" }}
            data-close="cancelLocationChange"
        >
            <div className="modal-content">
                <h3 style={{ color: "var(--warning)" }}>⚠️ កញ្ចប់នេះមានទីតាំងស្រាប់</h3>
                <p id="locationWarningText"></p>
                <div className="modal-btns" style={{ marginTop: "10px" }}>
                    <div className="modal-btns-row">
                        <button
                            className="btn-confirm btn-warning"
                            id="locationWarningConfirmBtn"
                            onClick={onAct("confirmLocationChange")}
                        >
                            យល់ព្រម ផ្លាស់ទី
                        </button>
                        <button className="btn-cancel" onClick={onAct("cancelLocationChange")}>បោះបង់</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
