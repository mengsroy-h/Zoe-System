import { refTo } from '../../refs';
import { Modal } from './Modal';
import { onAct } from '../../actions';

export function LockerSettingsModal() {
    return (
        <Modal id="lockerSettingsModal" style={{ zIndex: "1060" }}>
            <div className="modal-content">
                <h3>🗄️ កំណត់ទូ Locker</h3>
                <p>កំណត់បុព្វបទ (Prefix) និងចំនួនទូ ដែលបង្ហាញក្នុងអេក្រង់ជ្រើសរើសទីតាំង</p>
                <input type="text" id="lockerPrefixInput" ref={refTo('lockerPrefixInput')} placeholder="បុព្វបទ (ឧ. ទូ)" maxLength={10} />
                <input
                    type="number"
                    id="lockerCountInput" ref={refTo('lockerCountInput')}
                    placeholder="ចំនួនទូ (ឧ. 24)"
                    min={1}
                    max={200}
                    style={{ marginTop: "4px" }}
                />
                <div className="modal-btns" style={{ marginTop: "6px" }}>
                    <div className="modal-btns-row">
                        <button className="btn-confirm" id="lockerSettingsSaveBtn" onClick={onAct("saveLockerSettings")}>រក្សាទុក</button>
                        <button className="btn-cancel" onClick={onAct("closeModal", { args: ["lockerSettingsModal"] })}>បោះបង់</button>
                    </div>
                </div>
            </div>
        </Modal>
    );
}
