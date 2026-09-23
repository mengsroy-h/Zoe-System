import { onAct } from '../../actions';

export function ConfigQrScanModal() {
    return (
        <div id="configQrScanModal" className="modal" data-close="closeConfigQrScanner">
            <div className="modal-content">
                <h3>📷 ស្កេន QR (Setup Link)</h3>
                <p>ដាក់ QR Code ចូលក្នុងស៊ុមកាមេរ៉ា — Config នឹងបំពេញដោយស្វ័យប្រវត្តិ (មិនទាន់រក្សាទុក សូមចុច "រក្សាទុក" ម្តងទៀត)។</p>
                <video
                    id="configQrVideo"
                    style={{ width: "100%", borderRadius: "8px", background: "#000" }}
                    playsInline
                    muted
                    autoPlay
                    ref={(el) => { if (el) { el.muted = true; el.setAttribute('muted', ''); } }}
                ></video>
                <div className="modal-btns">
                    <button className="btn-cancel" onClick={onAct("closeConfigQrScanner")}>បោះបង់</button>
                </div>
            </div>
        </div>
    );
}
