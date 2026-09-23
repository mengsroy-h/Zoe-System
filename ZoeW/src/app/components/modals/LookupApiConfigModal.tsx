import { onAct } from '../../actions';

export function LookupApiConfigModal() {
    return (
        <div id="lookupApiConfigModal" className="modal">
            <div className="modal-content">
                <h3>🔌 API ស្វែងរកអតិថិជនស្វ័យប្រវត្តិ</h3>
                <p style={{ textAlign: "left" }}>
                    ភ្ជាប់ទៅប្រព័ន្ធផ្ទាល់ខ្លួនរបស់អ្នក (Google Sheet/Apps Script, ប្រព័ន្ធក្រុមហ៊ុន...) ដើម្បីស្កេន Barcode រួចទាញយក លេខទូរស័ព្ទ/COD/DOD ដោយស្វ័យប្រវត្តិ។
                </p>
                <label className="remember-container" style={{ marginBottom: "8px" }}>
                    <input type="checkbox" id="lookupApiEnabledCheckbox" />
                    <span>បើកការទាញយកទិន្នន័យស្វ័យប្រវត្តិពេលស្កេន</span>
                </label>
                <label className="remember-container" style={{ marginBottom: "8px" }}>
                    <input type="checkbox" id="lookupApiAutoSubmitCheckbox" />
                    <span>រក្សាទុកភ្លាមៗពេលរកឃើញលេខទូរស័ព្ទ (មិនចាំចុច "យល់ព្រម")</span>
                </label>
                <label className="remember-container" style={{ marginBottom: "8px" }}>
                    <input type="checkbox" id="lookupApiFastModeCheckbox" />
                    <span>Fast Mode សម្រាប់ ZTO Lookup</span>
                </label>
                <label
                    style={{ fontSize: "calc(10 * var(--fs-unit))", fontWeight: "600", color: "var(--text-muted)", display: "block", textAlign: "left", marginBottom: "2px" }}
                >
                    URL API (ដាក់ {"{"}barcode{"}"} ជំនួសកន្លែងលេខបាកូដ):
                </label>
                <input
                    type="text"
                    id="lookupApiUrlInput"
                    placeholder={"https://your-api.com/lookup?code={barcode}"}
                />
                <label
                    style={{ fontSize: "calc(10 * var(--fs-unit))", fontWeight: "600", color: "var(--text-muted)", display: "block", textAlign: "left", marginBottom: "2px" }}
                >
                    ឈ្មោះ Header (ជម្រើស, ឧ. X-API-Key):
                </label>
                <input type="text" id="lookupApiHeaderNameInput" placeholder="ឧ. X-API-Key ឬ Authorization" />
                <label
                    style={{ fontSize: "calc(10 * var(--fs-unit))", fontWeight: "600", color: "var(--text-muted)", display: "block", textAlign: "left", marginBottom: "2px" }}
                >
                    តម្លៃ Header / API Key / Secret (ជម្រើស — ទុកទទេដើម្បីរក្សាតម្លៃចាស់):
                </label>
                <input
                    type="password"
                    autoComplete="off"
                    id="lookupApiHeaderValueInput"
                    placeholder="ឧ. Bearer xxxxx ឬ Secret Key"
                />
                <label
                    style={{ fontSize: "calc(10 * var(--fs-unit))", fontWeight: "600", color: "var(--text-muted)", display: "block", textAlign: "left", marginBottom: "2px" }}
                >
                    ឈ្មោះ Field លេខទូរស័ព្ទក្នុង JSON:
                </label>
                <input type="text" id="lookupApiPhoneFieldInput" placeholder="ឧ. phone ឬ data.phone" />
                <label
                    style={{ fontSize: "calc(10 * var(--fs-unit))", fontWeight: "600", color: "var(--text-muted)", display: "block", textAlign: "left", marginBottom: "2px" }}
                >
                    ឈ្មោះ Field COD ក្នុង JSON:
                </label>
                <input type="text" id="lookupApiCodFieldInput" placeholder="ឧ. cod ឬ data.cod" />
                <label
                    style={{ fontSize: "calc(10 * var(--fs-unit))", fontWeight: "600", color: "var(--text-muted)", display: "block", textAlign: "left", marginBottom: "2px" }}
                >
                    ឈ្មោះ Field DOD ក្នុង JSON:
                </label>
                <input type="text" id="lookupApiDodFieldInput" placeholder="ឧ. dod ឬ data.dod" />
                <div className="modal-btns" style={{ marginTop: "6px" }}>
                    <div className="modal-btns-row">
                        <button className="btn-info" onClick={onAct("testLookupApiConfig", { self: true })}>🧪 សាកល្បង</button>
                        <button className="btn-confirm" onClick={onAct("saveLookupApiConfig")}>រក្សាទុក</button>
                    </div>
                    <button className="btn-cancel" onClick={onAct("closeModal", { args: ["lookupApiConfigModal"] })}>បោះបង់</button>
                </div>
            </div>
        </div>
    );
}
