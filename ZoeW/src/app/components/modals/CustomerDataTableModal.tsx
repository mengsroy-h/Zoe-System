import { onAct } from '../../actions';
import { CustomerTableBody } from '../customer/CustomerTableBody';

export function CustomerDataTableModal() {
    return (
        <div id="customerDataTableModal" className="modal">
            <div
                className="modal-content"
                style={{ textAlign: "left", display: "flex", flexDirection: "column", height: "88vh" }}
            >
                <h3 style={{ textAlign: "center" }}>📊 តារាងអតិថិជន (Barcode / DOD / COD / Phone)</h3>
                <p style={{ textAlign: "center" }}>ទាញពី Google Sheet — Read-only, ស្វែងរកលឿនក្នុងឧបករណ៍ដោយផ្ទាល់</p>
                <div style={{ display: "flex", gap: "6px", alignItems: "center", marginBottom: "8px" }}>
                    <input
                        type="text"
                        id="customerDataTableSearchInput"
                        placeholder="🔍 ស្វែងរក Barcode / លេខទូរស័ព្ទ..."
                        style={{ marginBottom: "0", textAlign: "left" }}
                        autoComplete="off"
                        onInput={onAct("filterCustomerDataTable")}
                    />
                    <button
                        className="btn-cancel"
                        style={{ width: "auto", whiteSpace: "nowrap", padding: "8px 10px" }}
                        onClick={onAct("fetchCustomerDataTableRows", { args: [true,true] })}
                    >
                        🔄
                    </button>
                </div>
                <p
                    id="customerDataTableStatus"
                    style={{ fontSize: "calc(10.5 * var(--fs-unit))", color: "var(--text-muted)", marginBottom: "6px" }}
                ></p>
                <div className="table-responsive" style={{ flex: "1", minHeight: "0" }}>
                    <table>
                        <thead>
                            <tr>
                                <th style={{ width: "32%" }}>Barcode</th>
                                <th style={{ width: "22%" }}>DOD ($)</th>
                                <th style={{ width: "22%" }}>COD ($)</th>
                                <th style={{ width: "24%" }}>Phone</th>
                            </tr>
                        </thead>
                        <tbody id="customerDataTableBody">
                            <CustomerTableBody />
                        </tbody>
                    </table>
                </div>
                <div className="modal-btns" style={{ marginTop: "8px" }}>
                    <button className="btn-cancel" onClick={onAct("closeModal", { args: ["customerDataTableModal"] })}>បិទ</button>
                </div>
            </div>
        </div>
    );
}
