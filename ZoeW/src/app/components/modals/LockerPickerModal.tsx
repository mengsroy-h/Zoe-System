import { refTo } from '../../refs';
import { Modal } from './Modal';
import { onAct } from '../../actions';
import { LockerGrid } from '../locker/LockerGrid';

export function LockerPickerModal() {
    return (
        <Modal id="lockerPickerModal" style={{ zIndex: "1055" }}>
            <div className="modal-content">
                <h3>📍 ជ្រើសរើសទីតាំង Locker</h3>
                <p>រាល់ Barcode ដែលស្កេនបន្ទាប់ពីនេះ នឹងត្រូវកំណត់ទីតាំងតាមទូដែលបានជ្រើសរើស។</p>
                <div className="locker-grid" id="lockerGrid">
                    <LockerGrid />
                </div>
                <div className="locker-custom-row">
                    <input type="text" id="customLockerInput" ref={refTo('customLockerInput')} placeholder="ទីតាំងផ្សេង (ឧ. A1, VIP...)" maxLength={24} />
                    <button type="button" onClick={onAct("selectCustomLocker")}>ជ្រើសរើស</button>
                </div>
                <div className="modal-btns" style={{ marginTop: "10px" }}>
                    <button className="btn-cancel" onClick={onAct("closeModal", { args: ["lockerPickerModal"] })}>បិទ</button>
                </div>
            </div>
        </Modal>
    );
}
