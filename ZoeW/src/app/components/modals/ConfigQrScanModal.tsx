import { Modal } from './Modal';
import { onAct } from '../../actions';
import { refTo } from '../../refs';

const qrVideoRef = refTo('configQrVideo');

function bindQrVideo(el: HTMLElement | null) {
    if (el) { (el as HTMLVideoElement).muted = true; el.setAttribute('muted', ''); }
    qrVideoRef(el);
}

export function ConfigQrScanModal() {
    return (
        <Modal id="configQrScanModal" close="closeConfigQrScanner">
            <div className="modal-content">
                <h3>📷 ស្កេន QR (Setup Link)</h3>
                <p>ដាក់ QR Code ចូលក្នុងស៊ុមកាមេរ៉ា — Config នឹងបំពេញដោយស្វ័យប្រវត្តិ (មិនទាន់រក្សាទុក សូមចុច "រក្សាទុក" ម្តងទៀត)។</p>
                <video
                    id="configQrVideo"
                    style={{ width: "100%", borderRadius: "8px", background: "#000" }}
                    playsInline
                    muted
                    autoPlay
                    ref={bindQrVideo}
                ></video>
                <div className="modal-btns">
                    <button className="btn-cancel" onClick={onAct("closeConfigQrScanner")}>បោះបង់</button>
                </div>
            </div>
        </Modal>
    );
}
