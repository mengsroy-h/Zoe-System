import { viewState } from '../../../core/view-state';
import type { LabelPrintPreview } from '../../../features/label-print';
import { onAct } from '../../actions';
import { useStoreFields } from '../../hooks/useStore';
import { refTo } from '../../refs';
import { LabelSheet } from '../PdfPrintArea';
import { Modal } from './Modal';

export function LabelPrintModal() {
    const v = useStoreFields(viewState, ['labelPrintTitle', 'labelPrintSummary', 'labelPrintPreview']);
    const preview = v.labelPrintPreview as LabelPrintPreview | null;
    return (
        <Modal id="labelPrintModal">
            <div className="modal-content label-print-modal-content">
                <h3>🖨️ បោះពុម្ពស្លាកកញ្ចប់</h3>
                <p className="label-print-scope">
                    វិសាលភាព ៖ <strong id="labelPrintTitle">{v.labelPrintTitle}</strong>
                </p>
                <p className="label-print-summary" id="labelPrintSummary" aria-live="polite">{v.labelPrintSummary}</p>
                <label className="label-print-field">
                    <span>ប្លង់ក្រដាស</span>
                    <select id="labelLayoutSelect" ref={refTo('labelLayoutSelect')} onChange={onAct('updateLabelPrintPreview')}>
                        <option value="a4-3">A4 ផ្ដេក · ៣ ជួរឈរ (៩ ស្លាកក្នុងមួយទំព័រ)</option>
                        <option value="a4-2">A4 ផ្ដេក · ២ ជួរឈរ (ស្លាកធំ)</option>
                        <option value="single">ម៉ាស៊ីនបោះពុម្ពស្លាក · មួយស្លាកមួយទំព័រ</option>
                    </select>
                </label>
                <div className="label-print-toggles">
                    <label className="remember-container">
                        <input type="checkbox" id="labelShowMoney" ref={refTo('labelShowMoney')} onChange={onAct('updateLabelPrintPreview')} />
                        <span>បង្ហាញតម្លៃ COD/DOD ($)</span>
                    </label>
                    <label className="remember-container">
                        <input type="checkbox" id="labelShowDate" ref={refTo('labelShowDate')} onChange={onAct('updateLabelPrintPreview')} />
                        <span>បង្ហាញថ្ងៃ/ខែ</span>
                    </label>
                    <label className="remember-container">
                        <input type="checkbox" id="labelShowLocker" ref={refTo('labelShowLocker')} onChange={onAct('updateLabelPrintPreview')} />
                        <span>បង្ហាញទីតាំង Locker</span>
                    </label>
                    <label className="remember-container">
                        <input type="checkbox" id="labelOpenOnly" ref={refTo('labelOpenOnly')} onChange={onAct('updateLabelPrintPreview')} />
                        <span>តែកញ្ចប់មិនទាន់យក</span>
                    </label>
                </div>
                <div className="label-preview" id="labelPrintPreview" aria-label="គំរូស្លាក">
                    {preview && preview.rows.length
                        ? <LabelSheet view={{ kind: 'labels', title: '', labels: preview.rows, options: preview.options }} />
                        : <div className="label-preview-empty">📭 គ្មានស្លាកសម្រាប់បង្ហាញ</div>}
                </div>
                <div className="modal-btns">
                    <button className="btn-confirm" onClick={onAct('printLabelsFromModal')} disabled={!preview || !preview.total}>🖨️ បោះពុម្ព</button>
                    <button className="btn-cancel" onClick={onAct('closeModal', { args: ['labelPrintModal'] })}>បិទ</button>
                </div>
            </div>
        </Modal>
    );
}
