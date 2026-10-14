import { viewState } from '../../../core/view-state';
import { onAct } from '../../actions';
import { useStoreFields } from '../../hooks/useStore';
import { refTo } from '../../refs';
import { Modal } from './Modal';

export function BatchScanModal() {
    const v = useStoreFields(viewState, ['batchScanCountText']);
    return (
        <Modal id="batchScanModal">
            <div className="modal-content">
                <h3>📋 បញ្ចូល Barcode ច្រើន</h3>
                <p className="batch-scan-hint">ស្កេនដោយឧបករណ៍ ឬវាយ Barcode មួយជួរមួយ (១០–២០ ក៏បាន) រួចចុច «ចាប់ផ្តើម» ៖ App បញ្ចូលម្តងមួយៗ ដូចស្កេនធម្មតា (Lookup ស្វ័យប្រវត្តិ · ផ្ទាំងបញ្ជាក់ពេលរកមិនឃើញ)។</p>
                <textarea
                    id="batchBarcodeInput"
                    ref={refTo('batchBarcodeInput')}
                    className="batch-scan-input"
                    rows={8}
                    placeholder={'77100000308\n77100000841\n…'}
                    autoComplete="off"
                    spellCheck={false}
                    onInput={onAct('updateBatchScanCount')}
                />
                <p className="batch-scan-count" id="batchScanCount" aria-live="polite">{v.batchScanCountText}</p>
                <div className="modal-btns">
                    <button className="btn-confirm" onClick={onAct('startBatchScan')}>▶️ ចាប់ផ្តើម</button>
                    <button className="btn-cancel" onClick={onAct('closeModal', { args: ['batchScanModal'] })}>បិទ</button>
                </div>
            </div>
        </Modal>
    );
}
