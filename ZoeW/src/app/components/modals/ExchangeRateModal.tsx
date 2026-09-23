import { refTo } from '../../refs';
import { Modal } from './Modal';
import { onAct } from '../../actions';

export function ExchangeRateModal() {
    return (
        <Modal id="exchangeRateModal">
            <div className="modal-content">
                <h3>💱 កំណត់អត្រាប្តូរប្រាក់ (1$ = ? ៛)</h3>
                <p>បញ្ចូលអត្រាប្តូរប្រាក់រៀលសម្រាប់ 1 ដុល្លារ (USD)</p>
                <input type="number" id="exchangeRateInput" ref={refTo('exchangeRateInput')} placeholder="ឧ. 4100" min={1} step={1} />
                <div className="modal-btns">
                    <button className="btn-confirm" onClick={onAct("saveExchangeRate")}>រក្សាទុកអត្រាប្រាក់</button>
                    <button className="btn-cancel" onClick={onAct("closeModal", { args: ["exchangeRateModal"] })}>បោះបង់</button>
                </div>
            </div>
        </Modal>
    );
}
